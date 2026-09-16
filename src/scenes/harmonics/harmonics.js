import * as THREE from 'three';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, bindTapVsDrag,
  prefersReducedMotion, parseHTML, createJumpList, createPanelCloser, escapeHtml,
  mountClippedPreviewCanvas, bindPersistedSoundToggle, setPanelSide, clickedLeftHalf,
  manageRenderer, createFrameClock, trackTimers,
} from '../../utils/sceneKit.js';
import { getApprovedResonances, getPendingResonances } from '../../resonances.js';
import { navigateToPiece } from '../../utils/harmonicsEntry.js';
import { extractQuotes, snippetFor } from '../../utils/resonanceExcerpts.js';
import harmonicsHtml from './harmonics.html?raw';
import './harmonics.css';


const SCENE_ACCENT = {
  sphere:    0xffdc78, // sphere.css .fragment-link hover/focus gold
  orbiter:   0x78ffb4, // orbiter.js's "+phase" particle-cloud green — "the italic/green identity that's orbiter's own"
  library:   0xe6b45f, // library.js HOVER_GLOW_HEX, the panel's own named gold accent
  scroll:    0xc17a3d, // scroll.css's drop-cap/rubric ink, "an inscriptional accent"
  theater:   0xe8b84b, // theater.css's marquee-bulb/bumper gold
  orrery:    0xffaa55, // orrery.js's workLight, "a plain accent near the machine"
  beamline:  0x50c878, // beamline.js's own named canonical accent
  butterfly: 0xff9e1f, // median of butterfly.js's warm gold-to-red-orange trajectory palette
};

function hashStr01(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function pieceKey(ep) {
  return ep.scene === 'theater' && ep.beatId !== undefined
    ? `theater:beat${ep.beatId}`
    : `${ep.scene}:${ep.id}`;
}

function buildNodes(rows) {
  const nodes = new Map();
  rows.forEach(r => {
    [r.a, r.b].forEach(ep => {
      const key = pieceKey(ep);
      if (nodes.has(key)) return;
      nodes.set(key, { key, scene: ep.scene, endpoint: ep, pos: new THREE.Vector3() });
    });
  });
  return nodes;
}

function buildAdjacency(nodeList, rows) {
  const idx = new Map(nodeList.map((nd, i) => [nd.key, i]));
  const adj = nodeList.map(() => []);
  const edges = [];
  rows.forEach(row => {
    const a = idx.get(pieceKey(row.a));
    const b = idx.get(pieceKey(row.b));
    if (a === undefined || b === undefined || a === b) return;
    adj[a].push(b);
    adj[b].push(a);
    edges.push([a, b]);
  });
  return { adj, edges };
}

function layoutForceDirected(nodeList, edges, scale) {
  const n = nodeList.length;
  if (n === 0) return;

  nodeList.forEach(nd => {
    const ax = hashStr01(nd.key + ':x') * 2 - 1;
    const ay = hashStr01(nd.key + ':y') * 2 - 1;
    const az = hashStr01(nd.key + ':z') * 2 - 1;
    nd.pos.set(ax, ay, az).multiplyScalar(scale * 0.5);
  });

  const k = scale / Math.cbrt(n); // ideal edge length — standard FR sizing for n nodes in a volume ~scale³
  const GRAVITY = 1.0; // calibrated live so disconnected islands settle at a bounded, still-clearly-separate distance
  const ITERATIONS = 400;
  const t0 = scale * 0.06;

  const disp = nodeList.map(() => new THREE.Vector3());
  const delta = new THREE.Vector3();

  for (let iter = 0; iter < ITERATIONS; iter++) {
    disp.forEach(v => v.set(0, 0, 0));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        delta.subVectors(nodeList[i].pos, nodeList[j].pos);
        let dist = delta.length();
        if (dist < 0.05) dist = 0.05;
        const force = (k * k) / dist;
        delta.multiplyScalar(force / dist);
        disp[i].add(delta);
        disp[j].sub(delta);
      }
    }

    edges.forEach(([a, b]) => {
      delta.subVectors(nodeList[a].pos, nodeList[b].pos);
      let dist = delta.length();
      if (dist < 0.05) dist = 0.05;
      const force = (dist * dist) / k;
      delta.multiplyScalar(force / dist);
      disp[a].sub(delta);
      disp[b].add(delta);
    });

    for (let i = 0; i < n; i++) {
      disp[i].addScaledVector(nodeList[i].pos, -GRAVITY);
    }

    const t = t0 * (1 - iter / ITERATIONS);
    for (let i = 0; i < n; i++) {
      const len = disp[i].length();
      if (len > 0.0001) {
        const capped = Math.min(len, Math.max(t, 0.02));
        nodeList[i].pos.addScaledVector(disp[i], capped / len);
      }
    }
  }

  const centroid = new THREE.Vector3();
  nodeList.forEach(nd => centroid.add(nd.pos));
  centroid.multiplyScalar(1 / n);
  nodeList.forEach(nd => nd.pos.sub(centroid));
}

const layoutCache = new Map();

function layoutSignature(nodeList, edges, scale) {
  const keys = nodeList.map(nd => nd.key).join(',');
  const wiring = edges.map(([a, b]) => a + '-' + b).join(',');
  return `${scale}|${nodeList.length}|${edges.length}|${hashStr01(keys)}|${hashStr01(wiring)}`;
}

function layoutForceDirectedCached(nodeList, edges, scale) {
  const sig = layoutSignature(nodeList, edges, scale);
  const cached = layoutCache.get(sig);
  if (cached) {
    nodeList.forEach((nd, i) => nd.pos.set(cached[i * 3], cached[i * 3 + 1], cached[i * 3 + 2]));
    return;
  }
  layoutForceDirected(nodeList, edges, scale);
  const settled = new Float64Array(nodeList.length * 3);
  nodeList.forEach((nd, i) => {
    settled[i * 3] = nd.pos.x; settled[i * 3 + 1] = nd.pos.y; settled[i * 3 + 2] = nd.pos.z;
  });
  layoutCache.set(sig, settled);
}

function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const cx = c.getContext('2d');
  const g = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = g;
  cx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export function createharmonics(container, { preview = false, initialPieceId = null } = {}) {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  let disposed = false;
  const timers = trackTimers();

  const rows = getApprovedResonances();
  const nodeMap = buildNodes(rows);
  const nodeList = Array.from(nodeMap.values());
  const { adj, edges } = buildAdjacency(nodeList, rows);
  const GRAPH_SCALE = preview ? 120 : 200;
  layoutForceDirectedCached(nodeList, edges, GRAPH_SCALE);
  let boundRadius = 1;
  nodeList.forEach(n => { boundRadius = Math.max(boundRadius, n.pos.length()); });

  const CAM_MIN = Math.max(20, boundRadius * 0.45);
  const CAM_MAX = boundRadius * 3.0;
  const CAM_DEFAULT = boundRadius * 1.9;
  const STAR_R_MIN = CAM_MAX * 1.25;
  const STAR_R_MAX = CAM_MAX * 1.75;
  const GALAXY_R_MIN = STAR_R_MAX * 1.3;
  const GALAXY_R_MAX = GALAXY_R_MIN * 3.5;
  const CAM_FAR = Math.max(2000, GALAXY_R_MAX * 1.3);
  const SCALE_FACTOR = CAM_MAX / (preview ? 140 : 260);

  const KURAMOTO_BASE_HZ = 0.2;
  const KURAMOTO_SPREAD_HZ = 0.06;
  const KURAMOTO_K = 2 * Math.PI * 0.15;
  const N = nodeList.length;
  const omega = new Float64Array(N);
  const theta = new Float64Array(N);
  const boost = new Float64Array(N); // 0..~1, decays after a click — briefly emphasizes the clicked node and its synced neighbors rather than drawing new geometry
  const effHz = new Float64Array(N).fill(KURAMOTO_BASE_HZ); // dθ/dt of the last integration step, in Hz — round 10's sonification pitch input, see below
  nodeList.forEach((n, i) => {
    omega[i] = 2 * Math.PI * (KURAMOTO_BASE_HZ + (hashStr01(n.key + ':freq') * 2 - 1) * KURAMOTO_SPREAD_HZ);
    theta[i] = hashStr01(n.key + ':phase0') * Math.PI * 2;
  });
  const adjStart = new Int32Array(N + 1);
  for (let i = 0; i < N; i++) adjStart[i + 1] = adjStart[i] + adj[i].length;
  const adjIdx = new Int32Array(adjStart[N]);
  for (let i = 0, k = 0; i < N; i++) for (let j = 0; j < adj[i].length; j++) adjIdx[k++] = adj[i][j];
  const thetaNext = new Float64Array(N); // reused every frame, never reallocated
  function triggerBoost(i) {
    boost[i] = 1;
    adj[i].forEach(j => { boost[j] = Math.max(boost[j], 0.7); });
  }

  const LAYER_NEBULA = 0;
  const LAYER_DUST = 1;
  const LAYER_NODES = 2;

  const scene = new THREE.Scene();
  const BG_COLOR = 0x00010a;
  scene.background = new THREE.Color(BG_COLOR);

  const camera = new THREE.PerspectiveCamera(46, w / h, 0.1, CAM_FAR);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  const managedRenderer = manageRenderer(renderer);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const clippedPreview = preview ? mountClippedPreviewCanvas(container, renderer) : null;
  if (!preview) container.appendChild(renderer.domElement);


  const starCount = preview ? 550 : 1600;
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  const STAR_PALETTE = [
    new THREE.Color(0xdbe6ff), // cool blue-white — majority
    new THREE.Color(0xffffff), // white
    new THREE.Color(0xfff3d6), // warm pale gold — occasional outlier
  ];
  for (let i = 0; i < starCount; i++) {
    const r = STAR_R_MIN + Math.random() * (STAR_R_MAX - STAR_R_MIN);
    const theta2 = Math.random() * Math.PI * 2;
    const phiA = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(phiA) * Math.cos(theta2);
    starPos[i * 3 + 1] = Math.abs(r * Math.sin(phiA) * Math.sin(theta2));
    starPos[i * 3 + 2] = r * Math.cos(phiA);
    const pick = Math.random();
    const c = pick < 0.62 ? STAR_PALETTE[0] : pick < 0.92 ? STAR_PALETTE[1] : STAR_PALETTE[2];
    const b = 0.75 + Math.random() * 0.5; // per-star brightness variance
    starCol[i * 3] = c.r * b;
    starCol[i * 3 + 1] = c.g * b;
    starCol[i * 3 + 2] = c.b * b;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  const starMat = new THREE.PointsMaterial({ vertexColors: true, size: 1.15 * SCALE_FACTOR, transparent: true, opacity: 0.72, sizeAttenuation: true, fog: false });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  function buildGalaxy(R_MIN, R_MAX) {
    const COUNT = preview ? 1700 : 5000;
    const CLUSTER_COUNT = preview ? 6 : 14;
    const FILAMENT_FRACTION = 0.3; // fraction of points strung between two clusters rather than clumped inside one
    const coreColor = new THREE.Color(0xff3d5c); // H-alpha — warm hydrogen emission
    const armColor = new THREE.Color(0x3fb8ff); // O-III — cool oxygen emission

    function gauss() {
      return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    }

    const clusters = [];
    for (let k = 0; k < CLUSTER_COUNT; k++) {
      const r = R_MIN + Math.random() * (R_MAX - R_MIN);
      const theta2 = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      clusters.push({
        center: new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta2),
          r * Math.sin(phi) * Math.sin(theta2) * 0.75,
          r * Math.cos(phi),
        ),
        spread: (R_MAX - R_MIN) * (0.08 + Math.random() * 0.16), // each clump's own size — irregular, not uniform
        hueBias: Math.random(), // 0 = this clump leans O-III blue, 1 = leans H-alpha red
      });
    }

    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const c = new THREE.Color();

    for (let i = 0; i < COUNT; i++) {
      let x, y, z, blend;
      if (clusters.length >= 2 && Math.random() < FILAMENT_FRACTION) {
        const a = clusters[(Math.random() * clusters.length) | 0];
        let b = clusters[(Math.random() * clusters.length) | 0];
        for (let tries = 0; b === a && tries < 5; tries++) b = clusters[(Math.random() * clusters.length) | 0];
        const t = Math.random();
        const jitter = (R_MAX - R_MIN) * 0.035;
        x = THREE.MathUtils.lerp(a.center.x, b.center.x, t) + gauss() * jitter;
        y = THREE.MathUtils.lerp(a.center.y, b.center.y, t) + gauss() * jitter;
        z = THREE.MathUtils.lerp(a.center.z, b.center.z, t) + gauss() * jitter;
        blend = THREE.MathUtils.lerp(a.hueBias, b.hueBias, t);
      } else {
        const cl = clusters[(Math.random() * clusters.length) | 0];
        x = cl.center.x + gauss() * cl.spread;
        y = cl.center.y + gauss() * cl.spread;
        z = cl.center.z + gauss() * cl.spread;
        blend = THREE.MathUtils.clamp(cl.hueBias + gauss() * 0.15, 0, 1);
      }

      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;

      c.copy(armColor).lerp(coreColor, blend).multiplyScalar(0.6 + Math.random() * 0.35);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: (preview ? 1.5 : 2.0) * SCALE_FACTOR, vertexColors: true, transparent: true,
      opacity: 0.55, depthWrite: false, sizeAttenuation: true, fog: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.rotation.x = 0.3;
    points.rotation.z = 0.15;
    const baseColor = col.slice();
    return { points, geo, mat, count: COUNT, baseColor };
  }
  const galaxy = buildGalaxy(GALAXY_R_MIN, GALAXY_R_MAX);
  galaxy.points.renderOrder = LAYER_NEBULA;
  scene.add(galaxy.points);

  function buildDustLanes(R_MIN, R_MAX) {
    const COUNT = preview ? 700 : 2200;
    const LANE_COUNT = preview ? 6 : 14;
    const dustColor = new THREE.Color(0x140b1e); // near-black, faint cool-violet cast — never pure 0x000 (would just vanish against the bg)

    function gauss() {
      return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    }

    const anchors = [];
    for (let k = 0; k < LANE_COUNT; k++) {
      const r = R_MIN + Math.random() * (R_MAX - R_MIN);
      const theta2 = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      anchors.push(new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta2),
        r * Math.sin(phi) * Math.sin(theta2) * 0.75,
        r * Math.cos(phi),
      ));
    }

    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const c = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      const a = anchors[(Math.random() * anchors.length) | 0];
      let b = anchors[(Math.random() * anchors.length) | 0];
      for (let tries = 0; b === a && tries < 5; tries++) b = anchors[(Math.random() * anchors.length) | 0];
      const t = Math.random();
      const jitter = (R_MAX - R_MIN) * 0.05;
      pos[i * 3] = THREE.MathUtils.lerp(a.x, b.x, t) + gauss() * jitter;
      pos[i * 3 + 1] = THREE.MathUtils.lerp(a.y, b.y, t) + gauss() * jitter;
      pos[i * 3 + 2] = THREE.MathUtils.lerp(a.z, b.z, t) + gauss() * jitter;
      c.copy(dustColor).multiplyScalar(0.7 + Math.random() * 0.6);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const dustTex = makeDotTexture();
    const mat = new THREE.PointsMaterial({
      size: (preview ? 21 : 28) * SCALE_FACTOR, map: dustTex, vertexColors: true,
      transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true, fog: false,
    });
    const points = new THREE.Points(geo, mat);
    points.renderOrder = LAYER_DUST;
    points.rotation.x = -0.22;
    points.rotation.z = 0.4; // deliberately different tilt than galaxy.points' own — independent rotation axes read as real parallax, not two layers moving in lockstep
    return { points, geo, mat, tex: dustTex, count: COUNT };
  }
  const dustLanes = buildDustLanes(GALAXY_R_MIN, GALAXY_R_MAX);
  scene.add(dustLanes.points);

  const galaxyColAttr = galaxy.geo.attributes.color;
  const galaxyActive = new Map(); // index -> current boost, decaying toward 0
  const GALAXY_TWINKLE_KICKS_PER_SEC = (preview ? 2 : 10) * 60;
  const GALAXY_TWINKLE_DECAY = 2.0; // roughly half a second to fade back to base

  const dotTex = makeDotTexture();
  const nodeGeo = new THREE.BufferGeometry();
  const nodePos = new Float32Array(nodeList.length * 3);
  const nodeColor = new Float32Array(nodeList.length * 3);
  const tmpColor = new THREE.Color();
  nodeList.forEach((n, i) => {
    nodePos[i * 3] = n.pos.x; nodePos[i * 3 + 1] = n.pos.y; nodePos[i * 3 + 2] = n.pos.z;
    tmpColor.setHex(SCENE_ACCENT[n.scene] ?? 0xffffff);
    nodeColor[i * 3] = tmpColor.r; nodeColor[i * 3 + 1] = tmpColor.g; nodeColor[i * 3 + 2] = tmpColor.b;
  });
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
  nodeGeo.setAttribute('color', new THREE.BufferAttribute(nodeColor, 3));
  const nodeMat = new THREE.PointsMaterial({
    size: (preview ? 3.1 : 3.6) * SCALE_FACTOR, map: dotTex, vertexColors: true,
    transparent: true, opacity: 0.95, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false,
  });
  const nodePoints = new THREE.Points(nodeGeo, nodeMat);
  nodePoints.renderOrder = LAYER_NODES;

  const nodeHaloMat = new THREE.PointsMaterial({
    size: (preview ? 8 : 10) * SCALE_FACTOR, map: dotTex, vertexColors: true,
    transparent: true, opacity: 0.32, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false,
  });
  const nodeHalo = new THREE.Points(nodeGeo, nodeHaloMat);
  nodeHalo.renderOrder = LAYER_NODES;
  scene.add(nodeHalo);
  scene.add(nodePoints);

  const hoverSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dotTex, color: 0xffffff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  hoverSprite.visible = false;
  if (!preview) scene.add(hoverSprite);
  let hoverScale = 0;

  let pendingList = [];
  let pendingPoints = null, pendingGeo = null, pendingMat = null;
  let pendingVel = [];
  const DRIFT_R = boundRadius * 1.35;
  if (!preview) {
    const pendingRows = getPendingResonances();
    const pendingMap = new Map();
    pendingRows.forEach(r => {
      [r.a, r.b].forEach(ep => {
        const key = pieceKey(ep);
        if (nodeMap.has(key) || pendingMap.has(key)) return;
        pendingMap.set(key, { key, scene: ep.scene, endpoint: ep });
      });
    });
    pendingList = Array.from(pendingMap.values());
    if (pendingList.length) {
      const pPos = new Float32Array(pendingList.length * 3);
      const pCol = new Float32Array(pendingList.length * 3);
      const pc = new THREE.Color();
      pendingList.forEach((p, i) => {
        const v = new THREE.Vector3(
          hashStr01(p.key + ':dx') * 2 - 1,
          hashStr01(p.key + ':dy') * 2 - 1,
          hashStr01(p.key + ':dz') * 2 - 1,
        ).multiplyScalar(DRIFT_R * (0.2 + hashStr01(p.key + ':r') * 0.8));
        pPos[i * 3] = v.x; pPos[i * 3 + 1] = v.y; pPos[i * 3 + 2] = v.z;
        pc.setHex(SCENE_ACCENT[p.scene] ?? 0xffffff).lerp(new THREE.Color(0x888899), 0.55).multiplyScalar(0.4);
        pCol[i * 3] = pc.r; pCol[i * 3 + 1] = pc.g; pCol[i * 3 + 2] = pc.b;
        const speed = DRIFT_R * (0.006 + hashStr01(p.key + ':speed') * 0.01);
        const dir = new THREE.Vector3(
          hashStr01(p.key + ':vx') * 2 - 1,
          hashStr01(p.key + ':vy') * 2 - 1,
          hashStr01(p.key + ':vz') * 2 - 1,
        ).normalize();
        pendingVel.push(dir.multiplyScalar(speed));
      });
      pendingGeo = new THREE.BufferGeometry();
      pendingGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
      pendingGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
      pendingMat = new THREE.PointsMaterial({
        size: 2.0 * SCALE_FACTOR, map: dotTex, vertexColors: true,
        transparent: true, opacity: 0.4, depthWrite: false,
        sizeAttenuation: true, fog: false,
      });
      pendingPoints = new THREE.Points(pendingGeo, pendingMat);
      scene.add(pendingPoints);
    }
  }

  const PIVOT = new THREE.Vector3(0, 0, 0);
  let camDist = CAM_DEFAULT;
  let theta0 = Math.random() * Math.PI * 2;
  const PHI_MIN = 0.15;
  const PHI_MAX = Math.PI - 0.15;
  let phi = Math.PI / 2 - 0.25;
  function updateCamera() {
    const sinPhi = Math.sin(phi);
    camera.position.set(
      PIVOT.x + camDist * sinPhi * Math.sin(theta0),
      PIVOT.y + camDist * Math.cos(phi),
      PIVOT.z + camDist * sinPhi * Math.cos(theta0),
    );
    camera.lookAt(PIVOT);
  }
  updateCamera();

  let resolveEndpointPromise = null;
  function loadResolveEndpoint() {
    return (resolveEndpointPromise ??= import('./harmonicsPieces.js')).then(m => m.resolveEndpoint);
  }

  let titleEl = null, hintEl = null, panel = null, panelCloser = null;
  let panelTitleEl = null, panelSubtitleEl = null, panelResonancesEl = null;
  let soundToggleEl = null, soundToggleLabelEl = null;
  if (!preview) {
    loadResolveEndpoint();
    const frag = parseHTML(harmonicsHtml);
    titleEl = frag.querySelector('.harmonics-title-row');
    hintEl = frag.querySelector('.harmonics-hint');
    document.body.appendChild(titleEl);
    document.body.appendChild(hintEl);

    soundToggleEl = frag.querySelector('.harmonics-sound-toggle');
    soundToggleLabelEl = soundToggleEl.querySelector('.harmonics-sound-toggle-label');
    document.body.appendChild(soundToggleEl);

    panel = frag.querySelector('.harmonics-panel');
    container.appendChild(panel);
    panelTitleEl = panel.querySelector('.harmonics-panel-title');
    panelSubtitleEl = panel.querySelector('.harmonics-panel-subtitle');
    panelResonancesEl = panel.querySelector('.harmonics-panel-resonances');
    panelCloser = createPanelCloser(panel, container, {
      closeBtn: panel.querySelector('.harmonics-panel-close'),
    });
  }

  function nodeResonances(nodeIndex) {
    const node = nodeList[nodeIndex];
    return rows
      .filter(row => pieceKey(row.a) === node.key || pieceKey(row.b) === node.key)
      .map(row => ({ row, other: pieceKey(row.a) === node.key ? row.b : row.a }));
  }

  function focusPanelTitle() {
    if (disposed || !panelTitleEl) return;
    panelTitleEl.focus();
  }

  async function openNodePanel(nodeIndex, { fromLeft } = {}) {
    if (!panel) return;
    const node = nodeList[nodeIndex];
    const resolveEndpoint = await loadResolveEndpoint();
    if (disposed) return;
    const self = resolveEndpoint(node.endpoint);
    const selfHex = `#${(SCENE_ACCENT[node.scene] ?? 0xffffff).toString(16).padStart(6, '0')}`;
    const conns = nodeResonances(nodeIndex);

    const populate = () => {
      panelTitleEl.textContent = self.title;
      panelSubtitleEl.textContent = conns.length === 1 ? 'Resonates with 1 piece' : `Resonates with ${conns.length} pieces`;
      panelResonancesEl.innerHTML = '';
      conns.forEach(({ row, other }, i) => {
        const resolved = resolveEndpoint(other);
        const otherHex = `#${(SCENE_ACCENT[other.scene] ?? 0xffffff).toString(16).padStart(6, '0')}`;
        const quotes = extractQuotes(row.rationale);
        const selfSnippet = snippetFor(self.rawText, quotes);
        const otherSnippet = snippetFor(resolved.rawText, quotes);

        const entry = document.createElement('div');
        entry.className = 'harmonics-resonance-entry';
        entry.style.setProperty('--entry-accent', otherHex);

        if (conns.length > 1) {
          const indexEl = document.createElement('span');
          indexEl.className = 'harmonics-entry-index';
          indexEl.textContent = `${i + 1} of ${conns.length}`;
          entry.appendChild(indexEl);
        }

        const pair = document.createElement('div');
        pair.className = 'harmonics-excerpt-pair';
        const quoteBox = (hex, title, snippet) => {
          const q = document.createElement('blockquote');
          q.className = snippet ? 'harmonics-excerpt' : 'harmonics-excerpt harmonics-excerpt--bare';
          q.style.borderLeftColor = hex;
          q.style.setProperty('--q-accent', hex);
          q.innerHTML = `<span class="harmonics-excerpt-label">${escapeHtml(title)}</span>${escapeHtml(snippet)}`;
          return q;
        };
        const selfQ = quoteBox(selfHex, self.title, selfSnippet);
        const glyph = document.createElement('div');
        glyph.className = 'harmonics-resonance-glyph';
        glyph.setAttribute('aria-hidden', 'true');
        glyph.textContent = '⟡';
        const otherQ = quoteBox(otherHex, resolved.title, otherSnippet);
        pair.appendChild(selfQ);
        pair.appendChild(glyph);
        pair.appendChild(otherQ);
        entry.appendChild(pair);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'harmonics-endpoint-link';
        btn.textContent = `Open ${resolved.title} →`;
        btn.setAttribute('aria-label', `Open ${resolved.title}`);
        btn.addEventListener('click', e => {
          e.stopPropagation();
          navigateToPiece(other.scene, resolved.pieceId);
        });
        entry.appendChild(btn);

        panelResonancesEl.appendChild(entry);
      });
    };

    const wasOpen = panel.classList.contains('open');
    const sideMismatch = fromLeft !== undefined && panel.classList.contains('from-left') !== fromLeft;
    if (wasOpen && sideMismatch) {
      panel.classList.remove('open');
      timers.after(500, () => {
        setPanelSide(panel, fromLeft);
        populate();
        panel.classList.add('open');
        timers.after(50, focusPanelTitle);
      });
      return;
    }
    if (!wasOpen && sideMismatch) setPanelSide(panel, fromLeft);
    populate();
    panel.classList.add('open');
    timers.after(50, focusPanelTitle);
  }

  async function openPendingPanel(pendingIndex, { fromLeft } = {}) {
    if (!panel) return;
    const p = pendingList[pendingIndex];
    const resolveEndpoint = await loadResolveEndpoint();
    if (disposed) return; // same late-resolution guard as openNodePanel above
    const info = resolveEndpoint(p.endpoint);

    const populate = () => {
      panelTitleEl.textContent = info.title;
      panelSubtitleEl.textContent = 'Pending review';
      panelResonancesEl.innerHTML = '';
    };

    const wasOpen = panel.classList.contains('open');
    const sideMismatch = fromLeft !== undefined && panel.classList.contains('from-left') !== fromLeft;
    if (wasOpen && sideMismatch) {
      panel.classList.remove('open');
      timers.after(500, () => {
        setPanelSide(panel, fromLeft);
        populate();
        panel.classList.add('open');
        timers.after(50, focusPanelTitle);
      });
      return;
    }
    if (!wasOpen && sideMismatch) setPanelSide(panel, fromLeft);
    populate();
    panel.classList.add('open');
    timers.after(50, focusPanelTitle);
  }

  let followedNodeIndex = -1;
  if (!preview && initialPieceId !== null) {
    const row = rows.find(r => r.id === initialPieceId);
    if (row) {
      const aKey = pieceKey(row.a), bKey = pieceKey(row.b);
      const aPos = nodeMap.get(aKey).pos, bPos = nodeMap.get(bKey).pos;
      const mid = aPos.clone().add(bPos).multiplyScalar(0.5);
      const dir = mid.clone().sub(PIVOT);
      const r = dir.length() || 1;
      theta0 = Math.atan2(dir.x, dir.z);
      phi = THREE.MathUtils.clamp(Math.acos(THREE.MathUtils.clamp(dir.y / r, -1, 1)), PHI_MIN, PHI_MAX);
      camDist = THREE.MathUtils.clamp(r * 1.6, CAM_MIN, CAM_MAX);
      updateCamera();
      followedNodeIndex = nodeList.findIndex(n => n.key === aKey);
    }
  }

  let autoRotate = true;
  let autoRotateTimer = null;
  const touchGuard = !preview ? bindTapVsDrag(container) : null;
  const orbitDrag = !preview ? bindOrbitDrag(container, {
    onDragStart: () => { autoRotate = false; },
    onDrag: (dx, dy) => {
      theta0 -= dx;
      phi = THREE.MathUtils.clamp(phi - dy, PHI_MIN, PHI_MAX);
      updateCamera();
    },
    onDragEnd: () => {
      if (autoRotateTimer !== null) timers.cancel(autoRotateTimer);
      autoRotateTimer = timers.after(3000, () => { autoRotateTimer = null; autoRotate = true; });
    },
  }) : null;
  const wheelZoom = !preview ? bindWheelZoom(container, {
    onZoom: deltaY => {
      camDist = THREE.MathUtils.clamp(camDist + deltaY * 0.05 * SCALE_FACTOR, CAM_MIN, CAM_MAX);
      updateCamera();
    },
  }) : null;

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let hoveredIdx = -1;
  let onMove = null, onClick = null, onLeave = null;
  function pickNodeAt(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    raycaster.params.Points.threshold = 8 * SCALE_FACTOR;
    const hits = raycaster.intersectObject(nodePoints);
    return hits.length ? hits[0].index : -1;
  }
  function pickPendingAt(clientX, clientY) {
    if (!pendingPoints) return -1;
    const rect = container.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    raycaster.params.Points.threshold = 6 * SCALE_FACTOR;
    const hits = raycaster.intersectObject(pendingPoints);
    return hits.length ? hits[0].index : -1;
  }
  if (!preview && nodeList.length) {
    onMove = e => {
      const newHover = pickNodeAt(e.clientX, e.clientY);
      if (newHover !== hoveredIdx) {
        hoveredIdx = newHover;
        container.style.cursor = hoveredIdx !== -1 ? 'pointer' : 'default';
      }
    };
    container.addEventListener('mousemove', onMove);
    onLeave = () => {
      if (hoveredIdx === -1) return;
      hoveredIdx = -1;
      container.style.cursor = 'default';
    };
    container.addEventListener('pointerleave', onLeave);
    onClick = e => {
      if (touchGuard?.consume()) return;
      const idx = pickNodeAt(e.clientX, e.clientY);
      if (idx !== -1) {
        hoveredIdx = idx;
        triggerBoost(idx);
        const rect = container.getBoundingClientRect();
        openNodePanel(idx, { fromLeft: clickedLeftHalf(e, rect) });
        return;
      }
      const pIdx = pickPendingAt(e.clientX, e.clientY);
      if (pIdx !== -1) {
        const rect = container.getBoundingClientRect();
        openPendingPanel(pIdx, { fromLeft: clickedLeftHalf(e, rect) });
      }
    };
    container.addEventListener('click', onClick);
  }

  let jumpList = null;
  const jumpItems = [
    ...nodeList.map((node, i) => ({ node, index: i, pending: false })),
    ...pendingList.map((node, i) => ({ node, index: i, pending: true })),
  ];
  if (!preview && jumpItems.length) {
    jumpList = createJumpList(container, {
      label: 'Touch a node',
      items: jumpItems,
      getLabel: item => (item.pending ? `Pending resonance ${item.index + 1}` : `Piece ${item.index + 1}`),
      onSelect: item => {
        if (item.pending) { openPendingPanel(item.index, { fromLeft: false }); return; }
        triggerBoost(item.index);
        openNodePanel(item.index, { fromLeft: false });
      },
    });
    loadResolveEndpoint().then(resolveEndpoint => {
      if (disposed || !jumpList) return;
const btns = document.querySelectorAll('.pm-jumplist button');
      jumpItems.forEach((item, i) => {
        const btn = btns[i];
        if (!btn) return;
        const { title } = resolveEndpoint(item.node.endpoint);
        btn.textContent = item.pending ? `${title} — pending review` : title;
      });
    }).catch(() => {  });
  }

  if (followedNodeIndex !== -1) {
    triggerBoost(followedNodeIndex);
    openNodePanel(followedNodeIndex, { fromLeft: false });
  }

  const FUNDAMENTAL_HZ = 55; // A1 — low enough that the 3rd–9th harmonics used below land in a comfortable mid-range
  const HARMONIC_MIN = 3, HARMONIC_MAX = 9;
  const EFF_HZ_MIN = KURAMOTO_BASE_HZ - KURAMOTO_SPREAD_HZ * 1.5;
  const EFF_HZ_MAX = KURAMOTO_BASE_HZ + KURAMOTO_SPREAD_HZ * 1.5;
  const VOICE_SCALE = nodeList.length ? 1 / Math.sqrt(nodeList.length) : 0;
  const MASTER_TARGET_GAIN = 0.16;
  let audioCtx = null, masterGain = null, compressor = null, reverb = null, reverbGain = null, voices = null; // voices: [{osc, osc2, gain}] parallel to nodeList
  let soundEnabled = false;

  function pitchForEffHz(hz) {
    const t = THREE.MathUtils.clamp((hz - EFF_HZ_MIN) / (EFF_HZ_MAX - EFF_HZ_MIN), 0, 1);
    const harmonic = Math.round(THREE.MathUtils.lerp(HARMONIC_MIN, HARMONIC_MAX, t));
    return FUNDAMENTAL_HZ * harmonic;
  }

  function makeReverbImpulse(ctx, duration = 3.2, decay = 2.6) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  function buildAudioGraph() {
    if (audioCtx || !nodeList.length) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0;
    compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -28;
    compressor.knee.value = 18;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.02;
    compressor.release.value = 0.3;
    masterGain.connect(compressor);
    reverb = audioCtx.createConvolver();
    reverb.buffer = makeReverbImpulse(audioCtx);
    reverbGain = audioCtx.createGain();
    reverbGain.gain.value = 0.4;
    masterGain.connect(reverb);
    reverb.connect(reverbGain);
    reverbGain.connect(compressor);
    compressor.connect(audioCtx.destination);
    voices = nodeList.map((n, i) => {
      const baseFreq = pitchForEffHz(omega[i] / (2 * Math.PI));
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = baseFreq;
      const osc2 = audioCtx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = baseFreq;
      osc2.detune.value = 5 + Math.random() * 7;
      const gain = audioCtx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(masterGain);
      osc.start();
      osc2.start();
      return { osc, osc2, gain };
    });
  }

  function setSoundEnabled(on) {
    if (disposed) return;
    soundEnabled = on;
    if (on) buildAudioGraph();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (masterGain) {
      const now = audioCtx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.linearRampToValueAtTime(on ? MASTER_TARGET_GAIN : 0, now + 0.25);
    }
    if (soundToggleEl) {
      soundToggleEl.setAttribute('aria-pressed', String(on));
      if (soundToggleLabelEl) soundToggleLabelEl.textContent = on ? 'Sound on' : 'Sound off';
    }
  }

  const soundToggle = bindPersistedSoundToggle(container, soundToggleEl, setSoundEnabled, 'harmonics');

  const onVisibilityChange = () => {
    if (disposed) return;
    if (document.hidden) {
      if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
      return;
    }
    clock.resync();
    if (soundEnabled && audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  const reduceMotion = prefersReducedMotion();

  if (reduceMotion && N) {
    const SETTLE_DT = 0.05;
    const SETTLE_STEPS = Math.round(15 / SETTLE_DT);
    for (let step = 0; step < SETTLE_STEPS; step++) {
      for (let i = 0; i < N; i++) {
        let coupling = 0;
        for (let k = adjStart[i]; k < adjStart[i + 1]; k++) coupling += Math.sin(theta[adjIdx[k]] - theta[i]);
        const dtheta = omega[i] + KURAMOTO_K * coupling;
        effHz[i] = Math.abs(dtheta) / (2 * Math.PI);
        thetaNext[i] = theta[i] + SETTLE_DT * dtheta;
      }
      theta.set(thetaNext);
    }
  }

  const clock = createFrameClock();
  let twinkleCarry = 0;
  let animId = null;
  let paused = false;

  let paintedHoverIdx = -2; // -2 = nothing painted yet; -1 is a real "no hover"
  let painted = false;

  const lastFreq = new Float64Array(N).fill(-1);
  const GAIN_UPDATE_INTERVAL = 0.05; // seconds — ~20Hz
  let gainAccum = GAIN_UPDATE_INTERVAL;

  function animate(now) {
    animId = requestAnimationFrame(animate);
    const dt = clock.tick();

    if (!reduceMotion) {
      if (autoRotate && !(orbitDrag && orbitDrag.isDragging)) {
        theta0 += preview ? 0.0018 : 0.0006;
        updateCamera();
      }
      galaxy.points.rotation.y += dt * 0.012;
      dustLanes.points.rotation.y -= dt * 0.008;

      twinkleCarry += GALAXY_TWINKLE_KICKS_PER_SEC * dt;
      const kicks = Math.floor(twinkleCarry);
      twinkleCarry -= kicks;
      for (let k = 0; k < kicks; k++) {
        if (Math.random() < 0.5) continue;
        const idx = (Math.random() * galaxy.count) | 0;
        galaxyActive.set(idx, 0.5 + Math.random() * 1.6);
      }
      if (galaxyActive.size) {
        galaxyActive.forEach((boost, idx) => {
          const decayed = boost - dt * GALAXY_TWINKLE_DECAY;
          const bi = idx * 3;
          if (decayed <= 0.02) {
            galaxyColAttr.setXYZ(idx, galaxy.baseColor[bi], galaxy.baseColor[bi + 1], galaxy.baseColor[bi + 2]);
            galaxyActive.delete(idx);
          } else {
            galaxyActive.set(idx, decayed);
            const mult = 1 + decayed;
            galaxyColAttr.setXYZ(idx, galaxy.baseColor[bi] * mult, galaxy.baseColor[bi + 1] * mult, galaxy.baseColor[bi + 2] * mult);
          }
        });
        galaxyColAttr.needsUpdate = true;
      }
    }

    if (!reduceMotion) {
      for (let i = 0; i < N; i++) {
        let coupling = 0;
        for (let k = adjStart[i]; k < adjStart[i + 1]; k++) coupling += Math.sin(theta[adjIdx[k]] - theta[i]);
        const dtheta = omega[i] + KURAMOTO_K * coupling;
        effHz[i] = Math.abs(dtheta) / (2 * Math.PI);
        thetaNext[i] = theta[i] + dt * dtheta;
      }
      theta.set(thetaNext);
    }

    const targetHoverScale = hoveredIdx !== -1 ? 1 : 0;
    hoverScale = reduceMotion ? targetHoverScale : hoverScale + (targetHoverScale - hoverScale) * Math.min(1, dt * 10);
    if (hoveredIdx !== -1 && hoverScale > 0.01) {
      const hn = nodeList[hoveredIdx];
      hoverSprite.visible = true;
      hoverSprite.position.set(hn.pos.x, hn.pos.y, hn.pos.z);
      hoverSprite.material.color.setHex(SCENE_ACCENT[hn.scene] ?? 0xffffff);
      hoverSprite.material.opacity = 0.55 * hoverScale;
      hoverSprite.scale.setScalar((preview ? 2.8 : 3.2) * SCALE_FACTOR * (1.4 + 2.4 * hoverScale));
    } else {
      hoverSprite.visible = false;
    }

    let boostActive = false;
    for (let i = 0; i < N; i++) { if (boost[i] > 0) { boostActive = true; break; } }
    if (!reduceMotion || !painted || boostActive || hoveredIdx !== paintedHoverIdx) {
      const colAttr = nodeGeo.attributes.color;
      for (let i = 0; i < N; i++) {
        boost[i] = Math.max(0, boost[i] - dt * 1.2);
        const pulse = 0.5 + 0.5 * Math.sin(theta[i]);
        const hoverMult = i === hoveredIdx ? 1 + 0.9 * hoverScale : 1;
        const brightness = Math.min(2.6, (0.35 + 1.0 * pulse) * (1 + boost[i]) * hoverMult);
        tmpColor.setHex(SCENE_ACCENT[nodeList[i].scene] ?? 0xffffff).multiplyScalar(brightness);
        colAttr.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
      }
      colAttr.needsUpdate = true;
      paintedHoverIdx = hoveredIdx;
      painted = true;
    }

    if (pendingPoints && !reduceMotion) {
      const pPosAttr = pendingGeo.attributes.position;
      for (let i = 0; i < pendingList.length; i++) {
        const ix = i * 3;
        let x = pPosAttr.array[ix] + pendingVel[i].x * dt;
        let y = pPosAttr.array[ix + 1] + pendingVel[i].y * dt;
        let z = pPosAttr.array[ix + 2] + pendingVel[i].z * dt;
        if (Math.hypot(x, y, z) > DRIFT_R) {
          const key = pendingList[i].key + ':respawn:' + Math.floor(now / 20000);
          const rx = (hashStr01(key + 'x') * 2 - 1);
          const ry = (hashStr01(key + 'y') * 2 - 1);
          const rz = (hashStr01(key + 'z') * 2 - 1);
          const rlen = Math.hypot(rx, ry, rz) || 1;
          const r = DRIFT_R * 0.9;
          x = (rx / rlen) * r; y = (ry / rlen) * r; z = (rz / rlen) * r;
        }
        pPosAttr.array[ix] = x; pPosAttr.array[ix + 1] = y; pPosAttr.array[ix + 2] = z;
      }
      pPosAttr.needsUpdate = true;
    }

    if (soundEnabled && audioCtx && voices && !document.hidden) {
      const now2 = audioCtx.currentTime;
      const DIST_FLOOR = 0.12;
      gainAccum += dt;
      const writeGain = gainAccum >= GAIN_UPDATE_INTERVAL;
      if (writeGain) gainAccum = 0;
      for (let i = 0; i < N; i++) {
        const targetFreq = pitchForEffHz(effHz[i]);
        if (targetFreq !== lastFreq[i]) {
          lastFreq[i] = targetFreq;
          voices[i].osc.frequency.setTargetAtTime(targetFreq, now2, 0.4);
          voices[i].osc2.frequency.setTargetAtTime(targetFreq, now2, 0.4);
        }
        if (!writeGain) continue;
        const pulse = 0.5 + 0.5 * Math.sin(theta[i]);
        const dist = camera.position.distanceTo(nodeList[i].pos);
        const distFactor = THREE.MathUtils.clamp(1 - (dist - CAM_MIN) / (CAM_MAX - CAM_MIN), DIST_FLOOR, 1);
        const targetGain = Math.min(1, (0.03 + 0.22 * pulse) * (1 + boost[i] * 0.2)) * VOICE_SCALE * distFactor;
        voices[i].gain.gain.setTargetAtTime(targetGain, now2, 0.35);
      }
    }

    renderer.render(scene, camera);
    clippedPreview?.blit();
  }
  animate();

  const resize = bindGuardedResize(container, (nw, nh) => {
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
    managedRenderer.applyPixelRatio();
  });

  return {
    setPaused(next) {
      if (disposed || paused === next) return;
      paused = next;
      if (paused) {
        if (animId !== null) cancelAnimationFrame(animId);
        animId = null;
      } else {
        clock.resync();
        animId = requestAnimationFrame(animate);
      }
    },
    dispose() {
      disposed = true;
      if (animId !== null) cancelAnimationFrame(animId);
      timers.dispose();
      resize.dispose();
      orbitDrag?.dispose();
      wheelZoom?.dispose();
      touchGuard?.dispose();
      jumpList?.dispose();
      panelCloser?.dispose();
      soundToggle.dispose();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (onMove) container.removeEventListener('mousemove', onMove);
      if (onLeave) container.removeEventListener('pointerleave', onLeave);
      if (onClick) container.removeEventListener('click', onClick);
      managedRenderer.dispose();
      clippedPreview?.dispose();

      starGeo.dispose(); starMat.dispose();
      galaxy.geo.dispose(); galaxy.mat.dispose();
      dustLanes.geo.dispose(); dustLanes.mat.dispose(); dustLanes.tex.dispose();
      nodeGeo.dispose(); nodeMat.dispose(); nodeHaloMat.dispose(); dotTex.dispose();
      hoverSprite.material.dispose();
      pendingGeo?.dispose(); pendingMat?.dispose();

      if (voices) {
        voices.forEach(v => {
          try { v.osc.stop(); } catch {  }
          try { v.osc2.stop(); } catch {  }
          v.osc.disconnect(); v.osc2.disconnect(); v.gain.disconnect();
        });
      }
      masterGain?.disconnect();
      compressor?.disconnect();
      reverb?.disconnect();
      reverbGain?.disconnect();
      if (audioCtx) { audioCtx.close(); audioCtx = null; }
      masterGain = compressor = reverb = reverbGain = voices = null;
      soundEnabled = false;

      titleEl?.remove();
      hintEl?.remove();
      soundToggleEl?.remove();
      panel?.remove();
    },
  };
}
