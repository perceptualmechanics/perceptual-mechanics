import * as THREE from 'three';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, bindTapVsDrag,
  prefersReducedMotion, parseHTML, createJumpList, createPanelCloser, escapeHtml,
} from '../../utils/sceneKit.js';
import { getApprovedResonances } from '../../resonances.js';
import { navigateToPiece } from '../../utils/constellationEntry.js';
import { resolveEndpointTitle } from './constellationPieces.js';
import constellationHtml from './constellation.html?raw';
import './constellation.css';

// ─── The Constellation ──────────────────────────────────────────────────────
// The ninth scene, and the only one with no found text of its own — it
// visualizes src/resonances.js's Layer 2 (cross-scene, connotative links),
// approved rows only.
//
// Round 2 (2026-08-16) reversed the original "purely atmospheric, no
// panel" design: touching a piece opens a real read-more panel naming
// what it resonates with and showing the resonance's own reviewed
// rationale, with a jump link to jump straight there.
//
// Round 5 (2026-08-18) removed the spider entirely, brightened the
// visuals, and added a real logarithmic-spiral galactic backdrop.
//
// Round 7 (2026-08-18) replaced arbitrary node placement with a real
// Fruchterman-Reingold force-directed layout (see layoutForceDirected
// below) and gave the camera a full external orbit instead of an
// "underneath a canopy" constraint.
//
// Round 8 (2026-08-18) — dropped drawn connection lines entirely. A
// constellation shape drawn with lines only reads correctly from one
// vantage; once the camera could orbit freely (round 7), that's exactly
// why this kept looking like ball-and-stick molecules rather than a
// constellation. Fixed by making resonance a TEMPORAL signal instead of
// a spatial one: every node is a Kuramoto oscillator (see the Kuramoto
// section below) — the same coupled-oscillator physics behind the
// Orrery's resonator chime, extended here from one struck object ringing
// to many objects influencing each other's rhythm over time. Nodes that
// share an approved resonance pull each other's phase together; run
// forward, connected clusters spontaneously lock into a shared pulse,
// visibly breathing together from ANY angle — no single "correct"
// vantage required, which is the actual fix, not a stylistic swap. The
// force-directed layout stays (connected pieces already sitting closer
// together is a good complementary signal), just without lines drawn on
// top of it. Clicking a node now shows everything IT currently
// resonates with (possibly more than one piece), since there's no
// longer a single line to click.
//
// Known tension, flagged rather than resolved: the ground-glimpse entry
// point (src/utils/constellationEntry.js, wired into beamline/orrery)
// was built on the premise that this scene lives underneath something,
// revealed through a floor — retired as a live premise since round 7's
// camera reset. Still unresolved; left untouched. Thread-follow (the
// other entry point) is unaffected either way.

// ─── Per-scene accent colors ────────────────────────────────────────────────
// Each scene's own already-established signature color, used for a
// node's own dot color — pulled from each scene's own dominant
// material/light/glow color, not invented here.
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

// A small string hash (xmur3-family, not cryptographic — just needs to be
// stable and evenly spread) so every piece's node position AND Kuramoto
// natural frequency/initial phase are the same every load/build, without
// persisting anything. Two different resonance rows that share an
// endpoint must resolve to the exact same node, which is why this is
// keyed by piece identity, not by row.
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

// One node per unique piece touched by an approved row — no other piece
// in the corpus becomes a node at all, so there's nothing isolated/dim to
// contrast against; every dot on screen participates in at least one
// resonance by construction. `endpoint` keeps the raw {scene,id[,beatId]}
// shape so resolveEndpointTitle can resolve this node's OWN title later
// (the panel now needs that — round 7 only ever needed the other side's
// title). Position is a placeholder here; the real work happens in
// layoutForceDirected below.
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

// Adjacency list (node index -> [neighbor indices]) built once from the
// approved rows — shared by both the force-directed layout's attraction
// step and the Kuramoto coupling below, since both need to walk the same
// real resonance graph, not a different derived structure each.
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

// ─── Real force-directed layout ─────────────────────────────────────────────
// Fruchterman-Reingold — repulsion between every pair of nodes (F=k²/d),
// attraction between nodes sharing an approved resonance (F=d²/k), run to
// equilibrium under a linear cooling schedule. Extended to 3D directly.
// A mild gravity term (nodes pulled toward the centroid each step,
// proportional to their own distance from it) is the one addition beyond
// textbook FR — this graph is sparse and far from fully connected (22
// approved rows, 32 nodes, many small islands), and without it,
// disconnected components have no attractive force acting on them at all
// and drift apart under pure repulsion without bound (confirmed
// empirically in a throwaway test script — see NOTES.md's round-7 entry
// for the actual numbers). With it, loosely-connected clusters still land
// clearly apart from the rest — the desired "periphery" read — just not
// at unbounded distance.
//
// Deterministic: initial positions seed from hashStr01, and the
// relaxation itself has no randomness, so the same approved-rows set
// always settles into the same shape on every load/build.
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

// A soft round dot, reused for every node marker — same "canvas gradient,
// no image asset" convention as every other scene's own glow textures.
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

export function createConstellation(container, { preview = false, initialPieceId = null } = {}) {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  // ─── Graph first — everything else (camera bounds, fog density, where
  // the star field/galaxy backdrop sit) derives from the layout's own
  // actual resulting scale, computed here before any of that downstream
  // setup runs.
  const rows = getApprovedResonances();
  const nodeMap = buildNodes(rows);
  const nodeList = Array.from(nodeMap.values());
  const { adj, edges } = buildAdjacency(nodeList, rows);
  const GRAPH_SCALE = preview ? 90 : 150;
  layoutForceDirected(nodeList, edges, GRAPH_SCALE);
  let boundRadius = 1;
  nodeList.forEach(n => { boundRadius = Math.max(boundRadius, n.pos.length()); });

  const CAM_MIN = Math.max(20, boundRadius * 0.45);
  const CAM_MAX = boundRadius * 3.0;
  const CAM_DEFAULT = boundRadius * 1.9;
  const FOG_DENSITY = 1.55 / CAM_MAX;
  const STAR_R_MIN = CAM_MAX * 1.25;
  const STAR_R_MAX = CAM_MAX * 1.75;
  const GALAXY_R_MIN = STAR_R_MAX * 1.3;
  const GALAXY_R_MAX = GALAXY_R_MIN * 3.5;
  const CAM_FAR = Math.max(2000, GALAXY_R_MAX * 1.3);
  const SCALE_FACTOR = CAM_MAX / (preview ? 140 : 260);

  // ─── Kuramoto phase coupling ──────────────────────────────────────────────
  // Round 8: resonance as synchronization, not lines. Every node is a
  // coupled oscillator — phase θᵢ(t), natural frequency ωᵢ — with:
  //   dθᵢ/dt = ωᵢ + K · Σⱼ sin(θⱼ − θᵢ)
  // summed over j = this node's ACTUAL approved-resonance neighbors
  // (the same `adj` adjacency the layout above uses), not a mean-field
  // model where every node influences every other node — structurally
  // faithful to the real graph, same principle as the layout itself.
  // Node brightness is a function of its own current phase; visually,
  // nodes sharing enough coupled structure spontaneously lock into a
  // shared pulse (frequency AND roughly-shared phase), while nodes in a
  // different, uncoupled part of the graph settle into their OWN shared
  // rhythm at a different rate — real emergence, not a scripted cue.
  //
  // Frequencies/initial phases are seeded by hashStr01 (not live
  // randomness) for the same reason node position is: reproducible
  // behavior, not a different show every load. The frequency spread is
  // real (±0.06 Hz around a 0.2 Hz base) — non-uniform enough that any
  // observed lock is a genuine consequence of coupling overcoming a real
  // mismatch, not two nodes coincidentally starting at the same rate.
  // K was tuned by simulating the actual approved-rows graph in a
  // throwaway script before writing this (see NOTES.md's round-8 entry
  // for the numbers): at K=2π·0.15 rad/s, every multi-node cluster in
  // the current data reaches ~0.97–1.00 phase coherence within ~5
  // simulated seconds and holds it indefinitely, while separate
  // clusters — never coupled to each other at all, since Kuramoto
  // coupling only sums over real graph neighbors — settle at distinct
  // collective rates. The 22-row corpus happens to have no fully
  // isolated (zero-edge) node right now (every node exists only because
  // it's in ≥1 approved row), so the visible contrast today is
  // cluster-vs-cluster rather than synced-vs-totally-isolated; a future
  // approved row that leaves some piece with only a not-yet-approved
  // connection would introduce a genuinely drifting node without any
  // change to this code.
  const KURAMOTO_BASE_HZ = 0.2;
  const KURAMOTO_SPREAD_HZ = 0.06;
  const KURAMOTO_K = 2 * Math.PI * 0.15;
  const omega = nodeList.map(n => 2 * Math.PI * (KURAMOTO_BASE_HZ + (hashStr01(n.key + ':freq') * 2 - 1) * KURAMOTO_SPREAD_HZ));
  const theta = nodeList.map(n => hashStr01(n.key + ':phase0') * Math.PI * 2);
  const boost = nodeList.map(() => 0); // 0..~1, decays after a click — briefly emphasizes the clicked node and its synced neighbors rather than drawing new geometry
  function triggerBoost(i) {
    boost[i] = 1;
    adj[i].forEach(j => { boost[j] = Math.max(boost[j], 0.7); });
  }

  const scene = new THREE.Scene();
  const BG_COLOR = 0x00010a;
  scene.background = new THREE.Color(BG_COLOR);
  scene.fog = new THREE.FogExp2(BG_COLOR, FOG_DENSITY);

  const camera = new THREE.PerspectiveCamera(46, w / h, 0.1, CAM_FAR);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);
  if (!preview) container.tabIndex = -1;

  scene.add(new THREE.AmbientLight(0x223355, 1.0));
  const key = new THREE.DirectionalLight(0xaad4ff, 0.9);
  key.position.set(4, 8, 3);
  scene.add(key);

  // ─── Deep-field stars ─────────────────────────────────────────────────────
  const starCount = preview ? 300 : 900;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = STAR_R_MIN + Math.random() * (STAR_R_MAX - STAR_R_MIN);
    const theta2 = Math.random() * Math.PI * 2;
    const phiA = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(phiA) * Math.cos(theta2);
    starPos[i * 3 + 1] = Math.abs(r * Math.sin(phiA) * Math.sin(theta2));
    starPos[i * 3 + 2] = r * Math.cos(phiA);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xbbccff, size: 0.9 * SCALE_FACTOR, transparent: true, opacity: 0.5, sizeAttenuation: true, fog: false });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  // ─── Galactic backdrop (round 5, corrected round 6, rescaled round 7) ────
  function buildGalaxy(R_MIN, R_MAX) {
    const ARMS = 3;
    const PITCH = 0.3;
    const ARM_SCALE = R_MIN * 0.125;
    const DECAY_SCALE = (R_MAX - R_MIN) * 0.3;
    const COUNT = preview ? 1700 : 5000;
    const FIELD_FRACTION = 0.14;
    const THICK_BASE = R_MIN * 0.006;
    const THICK_CORE = R_MIN * 0.024;

    function sampleD() {
      let d;
      do { d = -Math.log(1 - Math.random()) * DECAY_SCALE; } while (d > R_MAX - R_MIN);
      return d;
    }

    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const coreColor = new THREE.Color(0xfff1d6);
    const armColor = new THREE.Color(0x5f7fd0);
    const c = new THREE.Color();

    for (let i = 0; i < COUNT; i++) {
      const d = sampleD();
      const r = R_MIN + d;
      const isArm = Math.random() >= FIELD_FRACTION;
      let theta2;
      if (!isArm) {
        theta2 = Math.random() * Math.PI * 2;
      } else {
        const armIdx = Math.floor(Math.random() * ARMS);
        const idealTheta = Math.log(r / ARM_SCALE) / PITCH;
        const scatter = (Math.random() - 0.5) * (0.05 + (d / (R_MAX - R_MIN)) * 0.22);
        theta2 = idealTheta + armIdx * (Math.PI * 2 / ARMS) + scatter;
      }
      const rj = r * (1 + (Math.random() - 0.5) * 0.05);
      const x = rj * Math.cos(theta2);
      const z = rj * Math.sin(theta2);
      const thickness = THICK_BASE + THICK_CORE * Math.exp(-d / (DECAY_SCALE * 0.5));
      const y = (Math.random() - 0.5) * thickness;

      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;

      const coreBlend = Math.exp(-d / (DECAY_SCALE * 0.18));
      const coreBoost = 1 + coreBlend * 2.2;
      const armFieldMult = isArm ? 1.5 : 0.4;
      c.copy(armColor).lerp(coreColor, coreBlend).multiplyScalar(0.62 * coreBoost * armFieldMult);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: (preview ? 1.5 : 2.0) * SCALE_FACTOR, vertexColors: true, transparent: true,
      opacity: 0.7, depthWrite: false, sizeAttenuation: true, fog: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.rotation.x = 0.3;
    points.rotation.z = 0.15;
    return { points, geo, mat };
  }
  const galaxy = buildGalaxy(GALAXY_R_MIN, GALAXY_R_MAX);
  scene.add(galaxy.points);

  // ─── Nodes — the sole on-screen carrier of resonance now that lines are
  // gone. Color is each node's own scene accent; brightness is driven
  // every frame by its live Kuramoto phase (see the animate loop below),
  // not a decorative shimmer. ────────────────────────────────────────────
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
    size: (preview ? 2.8 : 3.2) * SCALE_FACTOR, map: dotTex, vertexColors: true,
    transparent: true, opacity: 0.92, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false,
  });
  const nodePoints = new THREE.Points(nodeGeo, nodeMat);
  scene.add(nodePoints);

  // ─── Camera: full external orbit ─────────────────────────────────────────
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

  // ─── Title/hint chrome + resonance panel (full only) ─────────────────────
  let titleEl = null, hintEl = null, panel = null, panelCloser = null;
  let panelTitleEl = null, panelSubtitleEl = null, panelResonancesEl = null;
  if (!preview) {
    const frag = parseHTML(constellationHtml);
    titleEl = frag.querySelector('.constellation-title');
    hintEl = frag.querySelector('.constellation-hint');
    document.body.appendChild(titleEl);
    document.body.appendChild(hintEl);

    panel = frag.querySelector('.constellation-panel');
    container.appendChild(panel);
    panelTitleEl = panel.querySelector('.constellation-panel-title');
    panelSubtitleEl = panel.querySelector('.constellation-panel-subtitle');
    panelResonancesEl = panel.querySelector('.constellation-panel-resonances');
    panelCloser = createPanelCloser(panel, container, {
      closeBtn: panel.querySelector('.constellation-panel-close'),
    });
  }

  // Every approved row this node participates in, paired with the OTHER
  // endpoint — a node can carry more than one (sphere:14, the corpus's
  // one real hub, currently carries five).
  function nodeResonances(nodeIndex) {
    const node = nodeList[nodeIndex];
    return rows
      .filter(row => pieceKey(row.a) === node.key || pieceKey(row.b) === node.key)
      .map(row => ({ row, other: pieceKey(row.a) === node.key ? row.b : row.a }));
  }

  // Round 8's real click payoff: since there's no single line to touch
  // anymore, clicking a node shows everything IT currently resonates
  // with — one entry per approved row, each with that row's own reviewed
  // rationale and a jump straight to the other piece.
  function openNodePanel(nodeIndex) {
    if (!panel) return;
    const node = nodeList[nodeIndex];
    const self = resolveEndpointTitle(node.endpoint);
    const conns = nodeResonances(nodeIndex);
    panelTitleEl.textContent = self.title;
    panelSubtitleEl.textContent = conns.length === 1 ? 'Resonates with 1 piece' : `Resonates with ${conns.length} pieces`;
    panelResonancesEl.innerHTML = '';
    conns.forEach(({ row, other }) => {
      const resolved = resolveEndpointTitle(other);
      const entry = document.createElement('div');
      entry.className = 'constellation-resonance-entry';
      const p = document.createElement('p');
      p.className = 'constellation-panel-rationale';
      p.textContent = row.rationale;
      entry.appendChild(p);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'constellation-endpoint-link';
      btn.innerHTML = `${escapeHtml(resolved.title)}<span class="constellation-endpoint-go">Open this piece</span>`;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        navigateToPiece(other.scene, resolved.pieceId);
      });
      entry.appendChild(btn);
      panelResonancesEl.appendChild(entry);
    });
    panel.classList.add('open');
  }

  // Thread-follow deep link: `initialPieceId` (main.js's generic piece-id
  // hash slot, reused here as a resonance row's own `id`) names the
  // resonance this scene should arrive already oriented at. Orients the
  // camera at the midpoint between its two nodes (no strand to target
  // anymore, just the two positions) and opens the panel for one side of
  // it — main.js has no notion of which endpoint the visitor was
  // reading, so this deterministically picks row.a's node.
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

  // ─── Drag to orbit + wheel zoom ──────────────────────────────────────────
  let autoRotate = true;
  const touchGuard = !preview ? bindTapVsDrag(container) : null;
  const orbitDrag = !preview ? bindOrbitDrag(container, {
    onDragStart: () => { autoRotate = false; },
    onDrag: (dx, dy) => {
      theta0 -= dx;
      phi = THREE.MathUtils.clamp(phi - dy, PHI_MIN, PHI_MAX);
      updateCamera();
    },
    onDragEnd: () => { setTimeout(() => { autoRotate = true; }, 3000); },
  }) : null;
  const wheelZoom = !preview ? bindWheelZoom(container, {
    onZoom: deltaY => {
      camDist = THREE.MathUtils.clamp(camDist + deltaY * 0.05 * SCALE_FACTOR, CAM_MIN, CAM_MAX);
      updateCamera();
    },
  }) : null;

  // ─── Touch a node ─────────────────────────────────────────────────────────
  // `pickNodeAt` raycasts against the node Points object directly — a
  // generous world-unit threshold (Raycaster.params.Points.threshold)
  // stands in for the old dedicated hit-mesh now that there's nothing
  // else to click.
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 8 * SCALE_FACTOR;
  const pointerNdc = new THREE.Vector2();
  let hoveredIdx = -1;
  let onMove = null, onClick = null;
  function pickNodeAt(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObject(nodePoints);
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
    onClick = e => {
      if (touchGuard?.consume()) return;
      const idx = pickNodeAt(e.clientX, e.clientY);
      if (idx === -1) return;
      hoveredIdx = idx;
      triggerBoost(idx);
      openNodePanel(idx);
    };
    container.addEventListener('click', onClick);
  }

  // Keyboard equivalent — nodes are otherwise raycast-only. Labels stay
  // generic ("Piece N") — the panel itself is what discloses identity
  // once open.
  let jumpList = null;
  if (!preview && nodeList.length) {
    jumpList = createJumpList(container, {
      label: 'Touch a node',
      items: nodeList,
      getLabel: (_node, i) => `Piece ${i + 1}`,
      onSelect: (_node, i) => { triggerBoost(i); openNodePanel(i); },
    });
  }

  if (followedNodeIndex !== -1) {
    triggerBoost(followedNodeIndex);
    openNodePanel(followedNodeIndex);
  }

  const reduceMotion = prefersReducedMotion();

  // ─── Animate ──────────────────────────────────────────────────────────────
  let animId, lastT = performance.now();
  function animate(now) {
    animId = requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    if (!reduceMotion) {
      if (autoRotate && !(orbitDrag && orbitDrag.isDragging)) {
        theta0 += preview ? 0.0018 : 0.0006;
        updateCamera();
      }
    }

    // Kuramoto integration — explicit Euler, stable at this K/dt scale
    // (K·dt stays well under 1 even at the 0.05s frame cap). Coupling
    // sums only over each node's real adjacency, not every other node.
    const newTheta = theta.slice();
    for (let i = 0; i < nodeList.length; i++) {
      let coupling = 0;
      adj[i].forEach(j => { coupling += Math.sin(theta[j] - theta[i]); });
      newTheta[i] = theta[i] + dt * (omega[i] + KURAMOTO_K * coupling);
    }
    for (let i = 0; i < nodeList.length; i++) theta[i] = newTheta[i];

    // Brightness: a genuine function of each node's own current phase,
    // not a decorative shimmer — this IS the resonance signal now.
    // `boost` (click emphasis) rides on top, multiplicatively, and
    // decays back to nothing rather than staying as new geometry.
    const colAttr = nodeGeo.attributes.color;
    for (let i = 0; i < nodeList.length; i++) {
      boost[i] = Math.max(0, boost[i] - dt * 1.2);
      const pulse = 0.5 + 0.5 * Math.sin(theta[i]);
      const brightness = Math.min(2.3, (0.35 + 1.0 * pulse) * (1 + boost[i]));
      tmpColor.setHex(SCENE_ACCENT[nodeList[i].scene] ?? 0xffffff).multiplyScalar(brightness);
      colAttr.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
    }
    colAttr.needsUpdate = true;

    renderer.render(scene, camera);
  }
  animId = requestAnimationFrame(animate);

  const resize = bindGuardedResize(container, (nw, nh) => {
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });

  return {
    dispose() {
      cancelAnimationFrame(animId);
      resize.dispose();
      orbitDrag?.dispose();
      wheelZoom?.dispose();
      touchGuard?.dispose();
      jumpList?.dispose();
      panelCloser?.dispose();
      if (onMove) container.removeEventListener('mousemove', onMove);
      if (onClick) container.removeEventListener('click', onClick);
      renderer.dispose();

      starGeo.dispose(); starMat.dispose();
      galaxy.geo.dispose(); galaxy.mat.dispose();
      nodeGeo.dispose(); nodeMat.dispose(); dotTex.dispose();

      titleEl?.remove();
      hintEl?.remove();
      panel?.remove();
      renderer.domElement.remove();
    },
  };
}
