import * as THREE from 'three';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, bindTapVsDrag,
  prefersReducedMotion, parseHTML, createJumpList,
} from '../../utils/sceneKit.js';
import { getApprovedResonances } from '../../resonances.js';
import constellationHtml from './constellation.html?raw';
import './constellation.css';

// ─── The Constellation ──────────────────────────────────────────────────────
// The ninth scene, and the only one with no found text of its own — it
// visualizes src/resonances.js's Layer 2 (cross-scene, connotative links),
// approved rows only. Camera orbits BELOW a canopy of thin glowing
// strands, looking up — the same "underside of the web" framing the
// spider's own premise depends on (constellation-brief.md), just the
// visitor's version of it rather than the spider's. Purely atmospheric:
// touching a strand makes the spider react, nothing more — no panel, no
// titles disclosed, no click-through to the pieces a strand connects
// (that's what the pieces' own scenes, and links.js's Layer 1, are for).
//
// Reached two ways (both additive, per the 2026-08-16 entry-point brief):
// the ground glimpse (src/utils/constellationEntry.js, wired into beamline
// and orrery, the only two scenes with a literal floor) and the
// thread-follow filament (same file, wired into every found-text scene's
// panel). Both dispatch `pm:navigate` on window; main.js's own listener
// is what actually calls expandScene('constellation', ..., resonanceId) —
// this file has no idea how it got opened, only whether `initialPieceId`
// (reused here to mean a resonance row's own `id`, not a piece id — see
// this scene's own entry in main.js's SCENES map for why that's safe)
// names a specific strand to arrive already oriented at.

const SCENE_ORDER = ['sphere', 'orbiter', 'library', 'scroll', 'theater', 'orrery', 'beamline', 'butterfly'];
const LEG_COUNT = 8;
const GOLD_ACCENT = 0xffdc78; // same accent beamline/sphere already use — see NOTES.md's "gold presence" entry

// ─── Deterministic layout ───────────────────────────────────────────────────
// A small string hash (xmur3-family, not cryptographic — just needs to be
// stable and evenly spread) so every piece's node position is the same
// every load/build, without persisting coordinates anywhere. Two different
// resonance rows that share an endpoint (several pieces sit in more than
// one approved row) must resolve to the exact same node, which is why this
// is keyed by piece identity, not by row.
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

// One node per unique piece touched by an approved row, positioned on the
// upper part of a sphere centered at the world origin (the camera orbits
// BELOW the origin — see updateCamera below — so every node ends up with
// y > 0, "overhead," without the camera and the canopy needing separate
// pivots). Each scene gets its own 45-degree azimuth wedge (SCENE_ORDER),
// so a scene's pieces cluster together rather than scattering randomly —
// legible as "the sphere's corner of the sky," not just noise.
function buildNodes(rows, domeRadius) {
  const nodes = new Map();
  const SECTOR = (Math.PI * 2) / SCENE_ORDER.length;
  rows.forEach(r => {
    [r.a, r.b].forEach(ep => {
      const key = pieceKey(ep);
      if (nodes.has(key)) return;
      const sceneIdx = Math.max(0, SCENE_ORDER.indexOf(ep.scene));
      const az = hashStr01(key + ':az');
      const po = hashStr01(key + ':po');
      const ra = hashStr01(key + ':ra');
      const azimuth = sceneIdx * SECTOR + (az - 0.5) * SECTOR * 0.86;
      // Polar angle off zenith (+Y): kept within a band well short of the
      // equator so the whole canopy reads as a dome overhead rather than
      // wrapping down to camera height, where it would compete with the
      // strands for a visitor's attention right in front of the lens.
      const polar = 0.14 + po * 0.60;
      const radius = domeRadius * (0.9 + ra * 0.16);
      const x = radius * Math.sin(polar) * Math.cos(azimuth);
      const z = radius * Math.sin(polar) * Math.sin(azimuth);
      const y = radius * Math.cos(polar);
      nodes.set(key, {
        key, scene: ep.scene, sceneIdx,
        pos: new THREE.Vector3(x, y, z),
      });
    });
  });
  return nodes;
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

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x00010a);

  const camera = new THREE.PerspectiveCamera(46, w / h, 0.1, 2000);
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

  // ─── Deep-field stars, same construction as orbiter.js's own (a uniform
  // random direction via acos(2u-1), not a naive polar-biased sample). ───
  const starCount = preview ? 300 : 900;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 300 + Math.random() * 300;
    const theta = Math.random() * Math.PI * 2;
    const phiA = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(phiA) * Math.cos(theta);
    starPos[i * 3 + 1] = Math.abs(r * Math.sin(phiA) * Math.sin(theta));
    starPos[i * 3 + 2] = r * Math.cos(phiA);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xbbccff, size: 0.9, transparent: true, opacity: 0.5, sizeAttenuation: true });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  // ─── Nodes + strands, built from the approved Layer 2 set only ─────────
  const rows = getApprovedResonances();
  const DOME_RADIUS = preview ? 78 : 130;
  const nodeMap = buildNodes(rows, DOME_RADIUS);
  const nodeList = Array.from(nodeMap.values());

  const dotTex = makeDotTexture();
  const nodeGeo = new THREE.BufferGeometry();
  const nodePos = new Float32Array(nodeList.length * 3);
  const nodeColor = new Float32Array(nodeList.length * 3);
  const tmpColor = new THREE.Color();
  nodeList.forEach((n, i) => {
    nodePos[i * 3] = n.pos.x; nodePos[i * 3 + 1] = n.pos.y; nodePos[i * 3 + 2] = n.pos.z;
    tmpColor.setHSL(n.sceneIdx / SCENE_ORDER.length, 0.55, 0.68);
    nodeColor[i * 3] = tmpColor.r; nodeColor[i * 3 + 1] = tmpColor.g; nodeColor[i * 3 + 2] = tmpColor.b;
  });
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
  nodeGeo.setAttribute('color', new THREE.BufferAttribute(nodeColor, 3));
  const nodeMat = new THREE.PointsMaterial({
    size: preview ? 2.2 : 2.6, map: dotTex, vertexColors: true,
    transparent: true, opacity: 0.9, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const nodePoints = new THREE.Points(nodeGeo, nodeMat);
  scene.add(nodePoints);

  // Strand rods — thin InstancedMesh boxes, same house technique as
  // library.js's hexagon edges/strands (see the Phase 3 architecture
  // survey: this codebase avoids THREE.Line for anything but a single
  // simple wireframe, for known cross-browser line-width limitations).
  // Two meshes sharing identical per-instance transforms: `strandMesh`
  // (thin, visible) and `strandHit` (thick, invisible) — the "small
  // visible body, generous invisible hit target" idiom orbiter's
  // satellites and beamline's stations already use, needed here because
  // a 0.05-unit-thick rod is not a reasonable raycast target on its own.
  const strandGeo = new THREE.BoxGeometry(1, 0.07, 0.07);
  const strandMat = new THREE.MeshBasicMaterial({
    color: 0xbfd6ff, transparent: true, opacity: 0.34, depthWrite: false,
  });
  const strandMesh = rows.length ? new THREE.InstancedMesh(strandGeo, strandMat, rows.length) : null;
  // Cross-section padding around each strand's true 0.07-unit rendered
  // width. 1.4 (the original figure) measured out to only ~5px wide on
  // screen at this scene's own default/zoomed-out camera distances (46°
  // FOV, CAM_MAX 260) — nowhere near a real click target. 4.4 keeps a
  // ~12px-wide target even at full zoom-out, without the strands (sparse,
  // 22 of them across a wide dome) starting to overlap each other's hit
  // regions at normal viewing distance.
  const hitGeo = new THREE.BoxGeometry(1, 4.4, 4.4);
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const strandHit = rows.length ? new THREE.InstancedMesh(hitGeo, hitMat, rows.length) : null;

  const strandInfo = []; // { row, mid, len, phase, speed, excite }
  if (strandMesh) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const AXIS_X = new THREE.Vector3(1, 0, 0);
    rows.forEach((row, i) => {
      const a = nodeMap.get(pieceKey(row.a)).pos;
      const b = nodeMap.get(pieceKey(row.b)).pos;
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = Math.max(0.001, dir.length());
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      q.setFromUnitVectors(AXIS_X, dir.clone().normalize());
      m.compose(mid, q, new THREE.Vector3(len, 1, 1));
      strandMesh.setMatrixAt(i, m);
      strandHit.setMatrixAt(i, m);
      strandInfo.push({
        row, mid, len,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.6,
        excite: 0, // 0..1, decays after a touch — brightens the strand briefly
      });
    });
    strandMesh.instanceMatrix.needsUpdate = true;
    strandHit.instanceMatrix.needsUpdate = true;
    scene.add(strandMesh, strandHit);
  }

  // ─── "Elsewhere" priming ─────────────────────────────────────────────────
  // main.js stashes the last piece opened in ANY scene into sessionStorage
  // (see its own comment there) whenever a visitor opens something — this
  // is the only cross-scene "what are you currently interacting with"
  // signal the site has (no scene reads another scene's live state; see
  // the Phase 3 architecture survey). A strand touching that piece gets a
  // bigger reaction than an unrelated one — constellation-brief.md's
  // "rests until a strand tied to whatever the visitor's currently
  // interacting with elsewhere gets touched, then reacts."
  let elsewhereKey = null;
  try {
    const raw = sessionStorage.getItem('pm_elsewhere');
    if (raw) {
      const e = JSON.parse(raw);
      if (e && e.scene) elsewhereKey = `${e.scene}:${e.id}`;
    }
  } catch { /* sessionStorage unavailable (private mode etc.) — elsewhere stays null, every touch reads as an equal, un-primed strand */ }
  function isPrimed(row) {
    if (!elsewhereKey) return false;
    return pieceKey(row.a) === elsewhereKey || pieceKey(row.b) === elsewhereKey;
  }

  // ─── The spider ─────────────────────────────────────────────────────────
  // Eight legs, standard anatomy, each a two-segment (femur/tibia)
  // hierarchy so it reads as a real jointed limb rather than a rigid
  // spoke. Idles on its own slow cycle; a touched strand makes the
  // nearest leg (or, for a primed strand, every leg at once) flick — a
  // fast decaying sine burst layered on top of the idle sway, not a
  // separate animation state to blend.
  function buildSpider() {
    const group = new THREE.Group();
    // No body mesh — pure radiating leg geometry, hub is an empty point in
    // space where all eight hips share the same local origin. Consistent
    // with the site's existing Tempest-style vector-line aesthetic (thin
    // glowing strokes, no filled/solid forms) rather than a bulbous or
    // solid mass at the center.
    const legMat = new THREE.MeshBasicMaterial({ color: GOLD_ACCENT, transparent: true, opacity: 0.6 });
    const femurLen = preview ? 2.3 : 3.1, tibiaLen = preview ? 2.6 : 3.5;
    const femurGeo = new THREE.BoxGeometry(femurLen, 0.2, 0.2);
    const tibiaGeo = new THREE.BoxGeometry(tibiaLen, 0.16, 0.16);
    const legs = [];
    for (let i = 0; i < LEG_COUNT; i++) {
      const hip = new THREE.Group();
      hip.rotation.y = (i / LEG_COUNT) * Math.PI * 2;
      group.add(hip);

      const femurPivot = new THREE.Group();
      const baseSplay = -0.5 - (i % 2) * 0.12; // slight alternating splay, less mechanically uniform
      femurPivot.rotation.z = baseSplay;
      hip.add(femurPivot);
      const femur = new THREE.Mesh(femurGeo, legMat);
      femur.position.x = femurLen / 2;
      femurPivot.add(femur);

      const knee = new THREE.Group();
      knee.position.x = femurLen;
      femurPivot.add(knee);
      const baseBend = 0.9;
      knee.rotation.z = baseBend;
      const tibia = new THREE.Mesh(tibiaGeo, legMat);
      tibia.position.x = tibiaLen / 2;
      knee.add(tibia);

      legs.push({
        femurPivot, knee, baseSplay, baseBend,
        idlePhase: Math.random() * Math.PI * 2,
        idleSpeed: 0.5 + Math.random() * 0.25,
        reactionT: null, // null = not reacting; else seconds since triggered
        reactionAmp: 0,
      });
    }
    return { group, legMat, femurGeo, tibiaGeo, legs };
  }
  const spider = buildSpider();
  scene.add(spider.group);
  const SPIDER_RADIUS = DOME_RADIUS * 0.5;
  let spiderAzimuth = Math.random() * Math.PI * 2;
  let spiderPolarPhase = Math.random() * Math.PI * 2;

  function spiderPositionAt(az, polarPhaseVal) {
    const polar = 0.32 + Math.sin(polarPhaseVal) * 0.14 + 0.28; // stays comfortably below the node band, above the camera's usual range
    return new THREE.Vector3(
      SPIDER_RADIUS * Math.sin(polar) * Math.cos(az),
      SPIDER_RADIUS * Math.cos(polar),
      SPIDER_RADIUS * Math.sin(polar) * Math.sin(az),
    );
  }
  function updateSpiderTransform() {
    const pos = spiderPositionAt(spiderAzimuth, spiderPolarPhase);
    spider.group.position.copy(pos);
    // Body's local +Y (the plane the legs radiate around) faces AWAY from
    // the world origin — outward into the canopy, belly toward the
    // camera below — "walking its underside" made literal.
    const outward = pos.clone().normalize();
    spider.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outward);
    return pos;
  }
  updateSpiderTransform();

  // Triggers a reaction: `bigReaction` (a primed strand, or the strand a
  // thread-follow deep link arrived on) flicks every leg at once; an
  // ordinary touch flicks only the leg nearest the strand's own direction
  // from the spider, so a visitor idly touching several strands sees the
  // reaction move around the spider rather than the same leg every time.
  function triggerReaction(strandMidWorld, bigReaction) {
    if (bigReaction) {
      spider.legs.forEach(l => { l.reactionT = 0; l.reactionAmp = 1; });
      return;
    }
    const spiderPos = spider.group.position;
    const toStrand = new THREE.Vector3().subVectors(strandMidWorld, spiderPos);
    const localDir = toStrand.applyQuaternion(spider.group.quaternion.clone().invert());
    const angle = Math.atan2(localDir.z, localDir.x);
    const norm = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const nearest = Math.round(norm / (Math.PI * 2 / LEG_COUNT)) % LEG_COUNT;
    spider.legs[nearest].reactionT = 0;
    spider.legs[nearest].reactionAmp = 1;
    // A faint sympathetic twitch on its two neighbors reads as a real
    // body responding, not one limb operating in isolation.
    [(nearest + 1) % LEG_COUNT, (nearest - 1 + LEG_COUNT) % LEG_COUNT].forEach(ni => {
      if (spider.legs[ni].reactionT === null) { spider.legs[ni].reactionT = 0; spider.legs[ni].reactionAmp = 0.35; }
    });
  }

  // ─── Camera: real spherical orbit, pivot at the world origin, clamped to
  // the LOWER hemisphere so it always stays under the node canopy above —
  // "orbit underneath," not a generic look-at-center orbit. ────────────────
  const PIVOT = new THREE.Vector3(0, 0, 0);
  const CAM_MIN = preview ? 30 : 45;
  const CAM_MAX = preview ? 140 : 260;
  let camDist = (CAM_MIN + CAM_MAX) * 0.42;
  let theta = Math.random() * Math.PI * 2;
  // phi measured from +Y: Math.PI/2 is eye-level with the pivot, Math.PI is
  // straight down from above the pivot looking... no — cos(phi) negative
  // for phi>PI/2 puts the camera BELOW the pivot's own height, which is
  // what "underneath" needs. Clamped well short of straight-up (PHI_MAX)
  // so the view never flips through the zenith into looking straight down
  // the strands' own long axis, where the canopy reads as a flat smear.
  const PHI_MIN = Math.PI / 2 + 0.12;
  const PHI_MAX = Math.PI - 0.08;
  let phi = Math.PI - 0.55;
  function updateCamera() {
    const sinPhi = Math.sin(phi);
    camera.position.set(
      PIVOT.x + camDist * sinPhi * Math.sin(theta),
      PIVOT.y + camDist * Math.cos(phi),
      PIVOT.z + camDist * sinPhi * Math.cos(theta),
    );
    camera.lookAt(PIVOT);
  }
  updateCamera();

  // Thread-follow deep link: `initialPieceId` (main.js's generic piece-id
  // hash slot, reused here as a resonance row's own `id` — see this
  // file's header comment) names the exact strand this scene should
  // arrive already oriented at. Orients theta/phi toward that strand's
  // midpoint and fires the same big reaction a primed strand touch would
  // — arriving via a followed thread IS the "elsewhere interaction" this
  // scene reacts to, whether or not sessionStorage's own elsewhere match
  // happens to agree.
  let followedStrand = null;
  if (!preview && initialPieceId !== null) {
    const info = strandInfo.find(s => s.row.id === initialPieceId);
    if (info) {
      followedStrand = info;
      const dir = info.mid.clone().sub(PIVOT);
      const r = dir.length() || 1;
      theta = Math.atan2(dir.x, dir.z);
      phi = THREE.MathUtils.clamp(Math.acos(THREE.MathUtils.clamp(dir.y / r, -1, 1)), PHI_MIN, PHI_MAX);
      // If the strand's own polar angle is above PHI_MIN's ceiling (steep,
      // near-overhead strands are common given the node dome sits mostly
      // near zenith), phi still clamps into range above — theta alone
      // (which direction to face) carries most of "oriented at the strand
      // that brought you" in that case, same as any other steep strand.
      camDist = THREE.MathUtils.clamp(r * 1.35, CAM_MIN, CAM_MAX);
      updateCamera();
    }
  }

  // ─── Title/hint chrome (full only) ───────────────────────────────────────
  let titleEl = null, hintEl = null;
  if (!preview) {
    const frag = parseHTML(constellationHtml);
    titleEl = frag.querySelector('.constellation-title');
    hintEl = frag.querySelector('.constellation-hint');
    document.body.appendChild(titleEl);
    document.body.appendChild(hintEl);
  }

  // ─── Drag to orbit + wheel zoom ──────────────────────────────────────────
  let autoRotate = true;
  const touchGuard = !preview ? bindTapVsDrag(container) : null;
  const orbitDrag = !preview ? bindOrbitDrag(container, {
    onDragStart: () => { autoRotate = false; },
    onDrag: (dx, dy) => {
      theta -= dx;
      phi = THREE.MathUtils.clamp(phi - dy, PHI_MIN, PHI_MAX);
      updateCamera();
    },
    onDragEnd: () => { setTimeout(() => { autoRotate = true; }, 3000); },
  }) : null;
  const wheelZoom = !preview ? bindWheelZoom(container, {
    onZoom: deltaY => {
      camDist = THREE.MathUtils.clamp(camDist + deltaY * 0.05, CAM_MIN, CAM_MAX);
      updateCamera();
    },
  }) : null;

  // ─── Touch a strand ───────────────────────────────────────────────────────
  // `pickStrandAt` is the one raycast both hover and click funnel through.
  // The original version only had this logic inline inside `onMove`, and
  // `onClick` trusted whatever `hoveredIdx` that had last left behind —
  // fine on a desktop where mousemove reliably precedes click at the same
  // coordinates, but a real click/tap has no such guarantee (a touch tap's
  // compatibility mousemove doesn't fire on every browser, and the canopy's
  // own slow autoRotate means even a desktop hover can go stale by a few
  // pixels between "aim" and "click"). Click now always re-checks the ray
  // at its own event coordinates rather than trusting stale hover state.
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let hoveredIdx = -1;
  let onMove = null, onClick = null;
  function pickStrandAt(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObject(strandHit);
    return hits.length ? hits[0].instanceId : -1;
  }
  if (!preview && strandHit) {
    onMove = e => {
      const newHover = pickStrandAt(e.clientX, e.clientY);
      if (newHover !== hoveredIdx) {
        hoveredIdx = newHover;
        container.style.cursor = hoveredIdx !== -1 ? 'pointer' : 'default';
      }
    };
    container.addEventListener('mousemove', onMove);
    onClick = e => {
      if (touchGuard?.consume()) return;
      const idx = pickStrandAt(e.clientX, e.clientY);
      if (idx === -1) return;
      hoveredIdx = idx;
      const info = strandInfo[idx];
      info.excite = 1;
      triggerReaction(info.mid, isPrimed(info.row));
    };
    container.addEventListener('click', onClick);
  }

  // Keyboard equivalent — strands are otherwise raycast-only. Labels stay
  // generic ("Strand N"), same "atmospheric, not curated" restraint as the
  // rest of the scene: this triggers the same reaction a touch would,
  // nothing about which two pieces a strand connects is ever disclosed.
  let jumpList = null;
  if (!preview && strandInfo.length) {
    jumpList = createJumpList(container, {
      label: 'Touch a strand',
      items: strandInfo,
      getLabel: (_info, i) => `Strand ${i + 1}`,
      onSelect: info => { info.excite = 1; triggerReaction(info.mid, isPrimed(info.row)); },
    });
  }

  if (followedStrand) { followedStrand.excite = 1; triggerReaction(followedStrand.mid, true); }

  const reduceMotion = prefersReducedMotion();

  // ─── Animate ──────────────────────────────────────────────────────────────
  let animId, lastT = performance.now();
  const tmpM = new THREE.Matrix4();
  const tmpPos = new THREE.Vector3(), tmpQuat = new THREE.Quaternion(), tmpScale = new THREE.Vector3();
  function animate(now) {
    animId = requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    if (!reduceMotion) {
      if (autoRotate && !(orbitDrag && orbitDrag.isDragging)) {
        theta += preview ? 0.0018 : 0.0006;
        updateCamera();
      }
      spiderAzimuth += 0.012 * dt * 10;
      spiderPolarPhase += 0.4 * dt;
      updateSpiderTransform();
    }

    // Strand shimmer + touch excitement decay.
    if (strandMesh) {
      strandInfo.forEach((s, i) => {
        s.phase += dt * s.speed;
        const shimmer = reduceMotion ? 0.7 : 0.55 + Math.sin(s.phase) * 0.35;
        s.excite = Math.max(0, s.excite - dt * 1.6);
        const brightness = Math.min(1.4, shimmer + s.excite * 1.1);
        tmpColor.setRGB(0.75, 0.84, 1).multiplyScalar(brightness);
        strandMesh.setColorAt(i, tmpColor);
      });
      strandMesh.instanceColor.needsUpdate = true;
    }

    // Node shimmer, cheap per-vertex-color reuse of the same technique.
    if (!reduceMotion) {
      const colAttr = nodeGeo.attributes.color;
      nodeList.forEach((n, i) => {
        const b = 0.75 + Math.sin(now * 0.0012 + i * 0.7) * 0.25;
        tmpColor.setHSL(n.sceneIdx / SCENE_ORDER.length, 0.55, 0.68).multiplyScalar(b);
        colAttr.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
      });
      colAttr.needsUpdate = true;
    }

    // Spider legs: idle sway (gated by reduceMotion) plus a reaction burst
    // (always runs — a reaction is a direct response to something the
    // visitor just did, not ambient decoration, same distinction every
    // other scene's own click-driven transitions already make).
    spider.legs.forEach(l => {
      const idle = reduceMotion ? 0 : Math.sin(now * 0.001 * l.idleSpeed + l.idlePhase) * 0.05;
      let burst = 0;
      if (l.reactionT !== null) {
        l.reactionT += dt;
        const decay = Math.exp(-l.reactionT * 5.5);
        burst = Math.sin(l.reactionT * 26) * 0.5 * decay * l.reactionAmp;
        if (l.reactionT > 1.2) l.reactionT = null;
      }
      l.femurPivot.rotation.z = l.baseSplay + idle + burst;
      l.knee.rotation.z = l.baseBend - idle * 0.6 - burst * 0.8;
    });

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
      if (onMove) container.removeEventListener('mousemove', onMove);
      if (onClick) container.removeEventListener('click', onClick);
      renderer.dispose();

      starGeo.dispose(); starMat.dispose();
      nodeGeo.dispose(); nodeMat.dispose(); dotTex.dispose();
      strandGeo.dispose(); strandMat.dispose();
      hitGeo.dispose(); hitMat.dispose();
      spider.legMat.dispose(); spider.femurGeo.dispose(); spider.tibiaGeo.dispose();

      titleEl?.remove();
      hintEl?.remove();
      renderer.domElement.remove();
    },
  };
}
