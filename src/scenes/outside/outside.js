import * as THREE from 'three';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, bindTapVsDrag,
  prefersReducedMotion, parseHTML,
} from '../../utils/sceneKit.js';
import { POWER_SOURCES, OER_DROPPED, OER_KEPT, MICHAEL_GABRIEL_AXIS } from './outside.text.js';
import outsideHtml from './outside.html?raw';
import './outside.css';

// ─── Outside — the tenth scene, 2026-08-24 ─────────────────────────────────
// Renamed from "Vantage." Every other scene on this site visualizes ONE
// account of its own material. This one visualizes the fact that Apherion's
// own cosmology — eleven dimensions, mapped to the Muses — is itself just
// one account among several the project's own notes describe (OER's,
// eventually Ring of Light's, the Machinists' Union's), and per the
// project's own standing principle ("No canon — no origin/account in
// Holography is ever authoritative"), none of them is privileged as the
// default. This scene makes both of those things literally true,
// mechanically, not just illustrated: the eleven dimensions are real
// 11-component vectors in genuine 11-dimensional space (src/scenes/outside/
// outside.text.js, transcribed verbatim from Scott's own project notes —
// nothing here is invented prose), Apherion's and OER's "views" are two
// different, real 3×11 projection matrices applied to that same underlying
// data, and there is no default: orientation drifts continuously on its own
// ambient cycle from load, never resting on either account's exact
// alignment, occasionally and briefly coinciding with one without pausing
// there or announcing it.
//
// ─── The math, in outline ───────────────────────────────────────────────────
// Apherion's eleven dimensions are the standard basis vectors of R^11
// (dimension i = e_i). Centered on their own centroid, these are exactly
// the eleven vertices of a regular 10-simplex — the unique highest-
// symmetry shape with eleven equidistant points, guaranteed by construction,
// not styled to look that way. Apherion's own "account" is the specific 3D
// projection that best preserves that symmetry: the real/imaginary parts of
// the first two nontrivial discrete-Fourier eigenvectors of the 11-cycle
// permutation (the Coxeter element of the simplex's own symmetry group) —
// closed-form, not an arbitrary nice-looking camera angle. The first
// harmonic alone places all eleven points on a regular hendecagon; this
// scene's third axis comes from the second harmonic of that same symmetry,
// not a bolted-on depth hack.
//
// OER's account is a genuine coordinate projection: a 3×11 matrix built the
// same way, but restricted to just its seven KEPT dimensions (OER_KEPT,
// outside.text.js) — the four dropped dimensions get literal zero columns,
// mathematically absent from this view, not dimmed or occluded.
//
// True rotation in 11 dimensions happens in a plane spanned by two basis
// vectors, not around one axis (eleven dimensions have 55 independent such
// planes, dim(SO(11)) = n(n-1)/2). This scene never exposes that as 55
// controls: the ambient drift continuously rotates a small, fixed set of
// coordinate-index planes (rotateInPlane, below); manual drag maps to two
// further planes built from the account structure itself — horizontal drag
// rotates within the plane separating OER's kept dimensions from its
// dropped ones, vertical drag rotates toward Apherion's own maximal-
// symmetry basis.
//
// ─── Round 2 correction (2026-08-24) ────────────────────────────────────
// Scott's read of the live v3.3.0 build: eleven correctly-positioned
// points is not a shape, it's a scatter — a shape is the points AND
// every connection between them. Also: this scene isn't Harmonics with
// different math, it's closer to Butterfly's register — a pure visual
// object, no text, no panel, no click-for-keywords. Two changes below,
// both load-bearing, not decoration:
//   1. All C(11,2) = 55 possible edges between the eleven dimension
//      points now render continuously (buildEdgePairs/the wireframe
//      LineSegments below), not on hover/click. This turns out to be the
//      actual payoff, not just a visual fix: OER's basis already zeroes
//      four dimensions' basis-vector components (see buildOerBasis), so
//      a dropped dimension's projected position already collapses toward
//      the origin as the current basis approaches OER's own — that was
//      true in the math from the start, it just had nothing rendered
//      that could show it. With the wireframe in place, watching four
//      vertices visibly pull inward and drag their edges with them AS
//      the drift or drag approaches OER's basis tells the entire OER-
//      vs-Apherion story with zero text, purely through geometry gaining
//      and losing connectivity.
//   2. The panel is gone. No title, no keyword chips, no excerpts —
//      nothing displays a word once the scene is running. Touching a
//      point instead triggers a real traveling pulse: a brightness wave
//      computed from straight-line distance from the touched point
//      (frozen at touch time) to every other point, propagating outward
//      and fading, applied as a genuine time/distance function
//      (triggerPulse/pulseWave below), not a hand-waved animation.
const N = 11; // Apherion's full dimensionality

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

// ─── 11D linear algebra — small, closed-form, no matrix library needed ─────
function zeros() { return new Array(N).fill(0); }
function basisVector(i) { const v = zeros(); v[i] = 1; return v; }
function dot(a, b) { let s = 0; for (let i = 0; i < N; i++) s += a[i] * b[i]; return s; }
function norm(a) { return Math.sqrt(dot(a, a)); }
function normalized(a) { const n = norm(a) || 1; return a.map(x => x / n); }
function addScaled(target, v, scale) { for (let i = 0; i < N; i++) target[i] += v[i] * scale; }

// Real rotation of `vecs` (an array of 11D vectors, mutated in place) within
// the 2-plane spanned by orthonormal p1/p2, by `angle` radians. Works for
// ANY orthonormal pair — a coordinate-index pair (the ambient drift) or an
// arbitrary derived pair (the account-structure planes manual drag uses).
function rotateInPlane(vecs, p1, p2, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  for (const v of vecs) {
    const a = dot(v, p1), b = dot(v, p2);
    const na = a * c - b * s, nb = a * s + b * c;
    addScaled(v, p1, na - a);
    addScaled(v, p2, nb - b);
  }
}

// Apherion's canonical 3-basis: k=1 and k=2 real DFT harmonics of the
// 11-cycle. See header comment for why this is the real maximal-symmetry
// projection, not a chosen camera angle.
function buildApherionBasis() {
  const bx = zeros(), by = zeros(), bz = zeros();
  for (let i = 0; i < N; i++) {
    bx[i] = Math.cos((2 * Math.PI * i) / N);
    by[i] = Math.sin((2 * Math.PI * i) / N);
    bz[i] = Math.cos((4 * Math.PI * i) / N);
  }
  return [normalized(bx), normalized(by), normalized(bz)];
}

// OER's canonical 3-basis: the same construction, restricted to its seven
// kept dimensions only — dropped dimensions get a literal 0 in every basis
// vector, so they contribute nothing to the projection at all.
function buildOerBasis() {
  const kept = OER_KEPT;
  const M = kept.length;
  const bx = zeros(), by = zeros(), bz = zeros();
  kept.forEach((dimIdx, rank) => {
    bx[dimIdx] = Math.cos((2 * Math.PI * rank) / M);
    by[dimIdx] = Math.sin((2 * Math.PI * rank) / M);
    bz[dimIdx] = Math.cos((4 * Math.PI * rank) / M);
  });
  return [normalized(bx), normalized(by), normalized(bz)];
}

// Every one of the C(11,2) = 55 possible edges of the simplex — the
// complete graph on eleven vertices, computed once. See the round-2
// header note for why all 55 render continuously rather than none.
const EDGE_PAIRS = [];
for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) EDGE_PAIRS.push([i, j]);

export function createOutside(container, { preview = false, initialPieceId = null } = {}) {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  const SCALE = preview ? 90 : 150;
  const SCALE_FACTOR = (preview ? 90 : 150) / 150;

  const APHERION_BASIS = buildApherionBasis();
  const OER_BASIS = buildOerBasis();

  // The plane separating OER's kept dimensions from its dropped ones —
  // manual horizontal drag rotates within this, per the header comment.
  const keptDir = normalized(OER_KEPT.reduce((acc, i) => { addScaled(acc, basisVector(i), 1); return acc; }, zeros()));
  let droppedRaw = OER_DROPPED.reduce((acc, i) => { addScaled(acc, basisVector(i), 1); return acc; }, zeros());
  addScaled(droppedRaw, keptDir, -dot(droppedRaw, keptDir)); // Gram-Schmidt against keptDir
  const droppedDir = normalized(droppedRaw);
  const OER_SPLIT_PLANE = [keptDir, droppedDir];
  const APHERION_PLANE = [APHERION_BASIS[0], APHERION_BASIS[2]];

  // ─── The ambient orientation basis — the scene's real "camera" in 11D.
  // Starts deliberately off both named accounts (no privileged starting
  // account), drifts continuously, occasionally and briefly passes near
  // one or the other. ────────────────────────────────────────────────────
  let Cx = basisVector(0).slice(), Cy = basisVector(1).slice(), Cz = basisVector(2).slice();
  // Seed away from any coordinate axis or either account's own basis so
  // load never coincidentally starts aligned.
  rotateInPlane([Cx, Cy, Cz], normalized(basisVector(0).map((v, i) => v + 0.3 * ((i * 7919) % 11))), normalized(basisVector(5).map((v, i) => v + 0.2 * ((i * 104729) % 11))), 0.9);

  const DRIFT_PLANES = [
    { i: 0, j: 3, freq: 0.021 },
    { i: 1, j: 6, freq: 0.017 },
    { i: 2, j: 9, freq: 0.013 },
    { i: 4, j: 8, freq: 0.026 },
    { i: 5, j: 10, freq: 0.011 },
    { i: 0, j: 7, freq: 0.009 },
  ];

  // ─── Temperature — Michael/Gabriel/Lucifer, honest crossover ──────────────
  // Real electroweak symmetry restoration is a smooth crossover for the
  // actual measured Higgs mass, not a sharp phase transition — modeled here
  // with a tanh blend (C-infinity smooth everywhere, no kink at the
  // midpoint), never a clean threshold. Runs on its own ambient cycle,
  // deliberately built from different, incommensurate frequencies than the
  // orientation drift above, so nothing implies the two are causally
  // linked.
  const T_CRIT = 0.5, T_WIDTH = 0.12;
  function temperatureAt(t) {
    const raw = Math.sin(t * 0.083) * 0.6 + Math.sin(t * 0.031 + 1.7) * 0.4;
    return THREE.MathUtils.clamp((raw + 1) / 2, 0, 1);
  }
  // 1 = fully split (cold, low T), 0 = fully fused (hot, high T).
  function separationFraction(temp) {
    return (1 - Math.tanh((temp - T_CRIT) / T_WIDTH)) / 2;
  }
  const MG_CENTER_RADIUS = 1.25;
  const MG_MAX_OFFSET = 0.85;

  const scene = new THREE.Scene();
  const BG_COLOR = 0x040108;
  scene.background = new THREE.Color(BG_COLOR);
  scene.fog = new THREE.FogExp2(BG_COLOR, 0.9 / (SCALE * 2.6));

  const CAM_DEFAULT = SCALE * 2.6;
  const CAM_MIN = SCALE * 1.3, CAM_MAX = SCALE * 4.5;
  const camera = new THREE.PerspectiveCamera(46, w / h, 0.1, CAM_MAX * 3);
  let camDist = CAM_DEFAULT;
  camera.position.set(0, 0, camDist);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);
  if (!preview) container.tabIndex = -1;

  scene.add(new THREE.AmbientLight(0x223355, 1.0));

  // ─── Deep field, minimal — this scene's own subject is already dense;
  // the backdrop stays sparse and quiet on purpose. ─────────────────────────
  const starCount = preview ? 250 : 700;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = SCALE * (3.2 + Math.random() * 2.2);
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    starPos[i * 3 + 2] = r * Math.cos(ph);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0x8899cc, size: 0.8 * SCALE_FACTOR, transparent: true, opacity: 0.4, sizeAttenuation: true, fog: false });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  const dotTex = makeDotTexture();

  // ─── Palette — continuity with Harmonics' own Hubble blend for Apherion's
  // fuller view; OER's rank-7 view goes colder/flatter/more desaturated,
  // per the brief. `accountBlend` (computed each frame from how closely
  // the drifting basis currently matches each account) drives both. ───────
  const APHERION_WARM = new THREE.Color(0xff3d5c), APHERION_COOL = new THREE.Color(0x3fb8ff);
  const OER_COLOR = new THREE.Color(0x8fa3b0);

  // ─── Dimension points (11) ──────────────────────────────────────────────
  const dimGeo = new THREE.BufferGeometry();
  const dimPos = new Float32Array(N * 3);
  const dimCol = new Float32Array(N * 3);
  dimGeo.setAttribute('position', new THREE.BufferAttribute(dimPos, 3));
  dimGeo.setAttribute('color', new THREE.BufferAttribute(dimCol, 3));
  const dimMat = new THREE.PointsMaterial({
    size: (preview ? 3.4 : 4.0) * SCALE_FACTOR, map: dotTex, vertexColors: true,
    transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false,
  });
  const dimPoints = new THREE.Points(dimGeo, dimMat);
  scene.add(dimPoints);
  // Soft corona riding on the same position/color buffers — same
  // technique as harmonics.js's own nodeHaloMat: eleven sparse points
  // alone, even at a readable core size, read as faint specks against a
  // near-black backdrop (found the hard way tuning Harmonics' own
  // dust-lane layer this session). A second, larger, lower-opacity
  // additive layer sharing the same geometry is what actually makes
  // each one read as a landmark rather than a stray star.
  const dimHaloMat = new THREE.PointsMaterial({
    size: (preview ? 9 : 11) * SCALE_FACTOR, map: dotTex, vertexColors: true,
    transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false,
  });
  const dimHalo = new THREE.Points(dimGeo, dimHaloMat);
  scene.add(dimHalo);

  // ─── Power Source points (5) — anchored further out along their own
  // dimension's axis, same convention Harmonics uses for its atmosphere:
  // visually distinct from, not competing with, the dimension vertices. ───
  const psGeo = new THREE.BufferGeometry();
  const psPos = new Float32Array(POWER_SOURCES.length * 3);
  const psCol = new Float32Array(POWER_SOURCES.length * 3);
  psGeo.setAttribute('position', new THREE.BufferAttribute(psPos, 3));
  psGeo.setAttribute('color', new THREE.BufferAttribute(psCol, 3));
  const psMat = new THREE.PointsMaterial({
    size: (preview ? 2.6 : 3.1) * SCALE_FACTOR, map: dotTex, vertexColors: true,
    transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false,
  });
  const psPoints = new THREE.Points(psGeo, psMat);
  scene.add(psPoints);
  const psHaloMat = new THREE.PointsMaterial({
    size: (preview ? 7 : 9) * SCALE_FACTOR, map: dotTex, vertexColors: true,
    transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false,
  });
  const psHalo = new THREE.Points(psGeo, psHaloMat);
  scene.add(psHalo);
  const PS_RADIUS = 1.4;

  // ─── Michael / Gabriel — Lucifer is their intersection, not a third
  // point (see outside.text.js's LUCIFER_LINE). ───────────────────────────
  const mgGeo = new THREE.BufferGeometry();
  const mgPos = new Float32Array(2 * 3);
  const mgCol = new Float32Array(2 * 3);
  mgGeo.setAttribute('position', new THREE.BufferAttribute(mgPos, 3));
  mgGeo.setAttribute('color', new THREE.BufferAttribute(mgCol, 3));
  const mgMat = new THREE.PointsMaterial({
    size: (preview ? 3.0 : 3.6) * SCALE_FACTOR, map: dotTex, vertexColors: true,
    transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false,
  });
  const mgPoints = new THREE.Points(mgGeo, mgMat);
  scene.add(mgPoints);
  const mgHaloMat = new THREE.PointsMaterial({
    size: (preview ? 8 : 10) * SCALE_FACTOR, map: dotTex, vertexColors: true,
    transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false,
  });
  const mgHalo = new THREE.Points(mgGeo, mgHaloMat);
  scene.add(mgHalo);

  // ─── The wireframe — the actual shape, not just its vertices ───────────
  // All 55 edges of the complete graph on the eleven dimension points,
  // always on. Vertex colors are copied from dimCol every frame (below),
  // so the OER-dropped dimming and warm/cool account blend already
  // computed for the points carry straight through to the edges that
  // touch them — one color computation, not two. Thin and additive so
  // density reads as structure, not noise; WIRE_BRIGHTNESS keeps it
  // visibly quieter than the points themselves, and depthFadeFor()
  // (computed per-frame from actual camera distance, not a fixed value)
  // dims far edges relative to near ones as the shape turns in 3D.
  const WIRE_BRIGHTNESS = 0.6, WIRE_DEPTH_FLOOR = 0.28;
  const wireGeo = new THREE.BufferGeometry();
  const wirePos = new Float32Array(EDGE_PAIRS.length * 2 * 3);
  const wireCol = new Float32Array(EDGE_PAIRS.length * 2 * 3);
  wireGeo.setAttribute('position', new THREE.BufferAttribute(wirePos, 3));
  wireGeo.setAttribute('color', new THREE.BufferAttribute(wireCol, 3));
  const wireMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const wireframe = new THREE.LineSegments(wireGeo, wireMat);
  scene.add(wireframe);

  // ─── Power Source anchor edges (5) — each Power Source point connects
  // straight back to the dimension it's anchored to (their positions are
  // already exactly colinear with the origin: PS position = PS_RADIUS ×
  // that dimension's own basis vector, so this is a real edge, not a
  // decorative line), gradient-colored from the dimension's own color to
  // the Power Source's own — nothing floats disconnected from the
  // simplex. ─────────────────────────────────────────────────────────────
  const psEdgeGeo = new THREE.BufferGeometry();
  const psEdgePos = new Float32Array(POWER_SOURCES.length * 2 * 3);
  const psEdgeCol = new Float32Array(POWER_SOURCES.length * 2 * 3);
  psEdgeGeo.setAttribute('position', new THREE.BufferAttribute(psEdgePos, 3));
  psEdgeGeo.setAttribute('color', new THREE.BufferAttribute(psEdgeCol, 3));
  const psEdgeMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const psEdges = new THREE.LineSegments(psEdgeGeo, psEdgeMat);
  scene.add(psEdges);

  // ─── Michael/Gabriel edge — their whole relationship is already
  // "opposite ends of one axis" in the data; Lucifer is already exactly
  // its midpoint. One edge, in its own color rather than blended from
  // Michael's warm/Gabriel's cool, so it doesn't disappear into the
  // denser 55-edge structure. No pre-existing "Lucifer color" turned up
  // anywhere in the codebase (checked) — this lavender is newly chosen
  // here, a threshold tone distinct from both the simplex edges' warm/
  // cool family and the scene's own violet chrome. ─────────────────────
  const LUCIFER_EDGE_COLOR = new THREE.Color(0x9a6bff);
  const mgEdgeGeo = new THREE.BufferGeometry();
  const mgEdgePos = new Float32Array(2 * 3);
  const mgEdgeCol = new Float32Array(2 * 3);
  mgEdgeGeo.setAttribute('position', new THREE.BufferAttribute(mgEdgePos, 3));
  mgEdgeGeo.setAttribute('color', new THREE.BufferAttribute(mgEdgeCol, 3));
  const mgEdgeMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.75,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const mgEdge = new THREE.LineSegments(mgEdgeGeo, mgEdgeMat);
  scene.add(mgEdge);

  // Faint ghost of the underlying crossover curve — separation vs.
  // temperature, plotted as its own small diagram near Michael/Gabriel
  // rather than warped into the 11D projection (every point at every
  // temperature sits on the SAME straight line through their shared axis
  // in the real data, so the curve shape only reads as a curve here, as a
  // graph). Static geometry, billboarded toward the camera each frame.
  const GHOST_SAMPLES = 40;
  const ghostGeo = new THREE.BufferGeometry();
  const ghostPos = new Float32Array(GHOST_SAMPLES * 3);
  // Deliberately small — a corner diagram beside Michael/Gabriel's own
  // points, not a screen-spanning feature. First pass at 0.9/0.55×SCALE
  // dominated the whole frame next to eleven sparse dimension points;
  // live-tuned down to a scale that reads as "a small trace," matching
  // the brief's own "faint" framing.
  const GHOST_SPAN = SCALE * 0.16, GHOST_HEIGHT = SCALE * 0.11;
  for (let i = 0; i < GHOST_SAMPLES; i++) {
    const temp = i / (GHOST_SAMPLES - 1);
    const sep = separationFraction(temp);
    ghostPos[i * 3] = (temp - 0.5) * GHOST_SPAN;
    ghostPos[i * 3 + 1] = sep * GHOST_HEIGHT;
    ghostPos[i * 3 + 2] = 0;
  }
  ghostGeo.setAttribute('position', new THREE.BufferAttribute(ghostPos, 3));
  const ghostMatTop = new THREE.LineBasicMaterial({ color: 0xffcc88, transparent: true, opacity: 0.16, fog: false });
  const ghostLineTop = new THREE.Line(ghostGeo, ghostMatTop);
  const ghostGeoBottom = ghostGeo.clone();
  const ghostBottomPos = ghostGeoBottom.attributes.position.array;
  for (let i = 0; i < GHOST_SAMPLES; i++) ghostBottomPos[i * 3 + 1] *= -1;
  ghostGeoBottom.attributes.position.needsUpdate = true;
  const ghostLineBottom = new THREE.Line(ghostGeoBottom, ghostMatTop);
  const ghostGroup = new THREE.Group();
  ghostGroup.add(ghostLineTop, ghostLineBottom);
  scene.add(ghostGroup);

  // ─── Account-closeness — a continuous similarity score between the
  // current drifting basis and each account's own canonical basis (sum of
  // squared dot products across both 3-bases — 1 when the subspaces fully
  // align, ~0 when orthogonal). Drives palette blend, the passive account
  // label, and the shared sound filter — never a hard state switch. ──────
  function subspaceScore(basisA, basisB) {
    let s = 0;
    for (const a of basisA) for (const b of basisB) s += dot(a, b) ** 2;
    return s / 3;
  }
  let accountBlend = 0.5; // 0 = reads as OER, 1 = reads as Apherion

  // ─── Chrome: title/hint/sound-toggle only — no panel, no account label.
  // Round 2 correction: nothing in this scene displays a word once it's
  // running. Title/hint/sound-toggle stay because they're the site-wide
  // grammar every scene carries (what every visitor already expects,
  // not scene-specific content) — the account label and the read-more
  // panel were both scene-specific content, and are gone entirely. ────────
  let titleEl = null, hintEl = null;
  let soundToggleEl = null, soundToggleLabelEl = null;
  if (!preview) {
    const frag = parseHTML(outsideHtml);
    titleEl = frag.querySelector('.outside-title');
    hintEl = frag.querySelector('.outside-hint');
    document.body.appendChild(titleEl);
    document.body.appendChild(hintEl);

    soundToggleEl = frag.querySelector('.outside-sound-toggle');
    soundToggleLabelEl = soundToggleEl.querySelector('.outside-sound-toggle-label');
    document.body.appendChild(soundToggleEl);
  }

  // ─── Manual drag → SO(11) planes, not a camera orbit. Horizontal drag
  // rotates within the plane separating OER's kept dimensions from its
  // dropped ones; vertical drag rotates toward Apherion's own maximal-
  // symmetry basis. Temporarily takes over from the ambient drift, same
  // site-wide grammar every other scene uses, resuming on release. ────────
  let autoRotate = true;
  let resumeTimer = null;
  const orbitDrag = !preview ? bindOrbitDrag(container, {
    onDragStart: () => {
      autoRotate = false;
      if (resumeTimer) clearTimeout(resumeTimer);
    },
    onDrag: (dx, dy) => {
      // dx/dy already come out sensitivity-scaled (see bindOrbitDrag) —
      // scaled again here only to a comfortable angular speed for a
      // basis rotation rather than a camera pan.
      rotateInPlane([Cx, Cy, Cz], OER_SPLIT_PLANE[0], OER_SPLIT_PLANE[1], dx);
      rotateInPlane([Cx, Cy, Cz], APHERION_PLANE[0], APHERION_PLANE[1], -dy);
    },
    onDragEnd: () => {
      resumeTimer = setTimeout(() => { autoRotate = true; }, 3000);
    },
  }) : null;
  const touchGuard = !preview ? bindTapVsDrag(container) : null;
  const wheelZoom = !preview ? bindWheelZoom(container, {
    onZoom: deltaY => {
      camDist = THREE.MathUtils.clamp(camDist + deltaY * 0.05 * SCALE_FACTOR, CAM_MIN, CAM_MAX);
      camera.position.set(0, 0, camDist);
    },
  }) : null;

  // ─── Touch a node ─────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  function pickAt(clientX, clientY, obj, threshold) {
    const rect = container.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    raycaster.params.Points.threshold = threshold;
    const hits = raycaster.intersectObject(obj);
    return hits.length ? hits[0].index : -1;
  }
  // ─── Touch response — a real traveling pulse, not a panel. Straight-
  // line distance from the touched point (frozen at the moment of touch)
  // to every other point drives a genuine time/distance wave function
  // (pulseWave, in the animate loop below) — a brightness boost that
  // reaches nearer points sooner and farther points later, then fades.
  // No text is ever displayed; this is the entire response. ───────────────
  const PULSE_SPEED = SCALE * 3;   // world units/sec the wavefront travels
  const PULSE_WIDTH = 0.14;        // seconds — how wide the wavefront is
  const PULSE_DURATION = 1.4;      // seconds — hard cutoff, wave has long since passed
  const PULSE_BOOST = 0.9;         // added brightness at the wavefront's peak
  let pulseActive = false, pulseStart = 0;
  const pulseOrigin = new THREE.Vector3();
  const _pulseVec = new THREE.Vector3();
  function triggerPulse(x, y, z) {
    pulseOrigin.set(x, y, z);
    pulseStart = elapsed;
    pulseActive = true;
  }
  // Gaussian wavefront centered at `t == dist/PULSE_SPEED` — reaches
  // nearer points sooner, farther points later, real distance/time math
  // rather than a hand-tuned easing curve.
  function pulseWave(t, dist) {
    if (t < 0) return 0;
    const wavefront = t - dist / PULSE_SPEED;
    return Math.exp(-(wavefront * wavefront) / (2 * PULSE_WIDTH * PULSE_WIDTH));
  }
  function pulseBoostAt(x, y, z) {
    if (!pulseActive) return 0;
    _pulseVec.set(x, y, z);
    return pulseWave(elapsed - pulseStart, pulseOrigin.distanceTo(_pulseVec)) * PULSE_BOOST;
  }
  // Depth cueing for the wireframe: real per-frame distance-to-camera,
  // normalized against the CURRENT spread of the eleven points (not a
  // fixed world-scale constant), so it self-adjusts at any zoom level.
  const dimCamDist = new Float32Array(N);
  const _depthVec = new THREE.Vector3();
  function depthFadeAt(camDistForIndex, minD, maxD) {
    const t = maxD > minD ? (camDistForIndex - minD) / (maxD - minD) : 0;
    return THREE.MathUtils.lerp(1, WIRE_DEPTH_FLOOR, THREE.MathUtils.clamp(t, 0, 1));
  }
  let onClick = null;
  if (!preview) {
    onClick = e => {
      if (touchGuard?.consume()) return;
      const th = 7 * SCALE_FACTOR;
      let idx = pickAt(e.clientX, e.clientY, dimPoints, th);
      if (idx !== -1) { triggerPulse(dimPos[idx * 3], dimPos[idx * 3 + 1], dimPos[idx * 3 + 2]); return; }
      idx = pickAt(e.clientX, e.clientY, psPoints, th);
      if (idx !== -1) { triggerPulse(psPos[idx * 3], psPos[idx * 3 + 1], psPos[idx * 3 + 2]); return; }
      idx = pickAt(e.clientX, e.clientY, mgPoints, th);
      if (idx !== -1) { triggerPulse(mgPos[idx * 3], mgPos[idx * 3 + 1], mgPos[idx * 3 + 2]); return; }
    };
    container.addEventListener('click', onClick);
  }

  // ─── Sound — one voice, two mechanisms on the same signal ──────────────
  // Temperature (Michael/Gabriel split): two oscillators, same base pitch,
  // detuning apart as separationFraction moves — the beat between them is
  // the split's audible signature, resolving gradually, no clean threshold.
  // Account (OER/Apherion): that same pair runs through one shared lowpass
  // filter — OER's rank-7 view keeps only the fundamentals (narrow),
  // Apherion's fuller view opens toward the full harmonic series (wide).
  // The filter acts on the beat pair directly; there is no separate
  // "account tone." Lazy AudioContext on first gesture, same convention as
  // every other scene's own sound toggle.
  let audioCtx = null, oscA = null, oscB = null, filter = null, masterGain = null;
  let soundEnabled = false;
  const BASE_HZ = 220, MAX_DETUNE_HZ = 7;
  const FILTER_MIN_HZ = 480, FILTER_MAX_HZ = 9000;
  function buildAudioGraph() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0;
    filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1.2;
    filter.frequency.value = FILTER_MIN_HZ;
    oscA = audioCtx.createOscillator();
    oscB = audioCtx.createOscillator();
    oscA.type = 'sine'; oscB.type = 'sine';
    oscA.frequency.value = BASE_HZ; oscB.frequency.value = BASE_HZ;
    oscA.connect(filter); oscB.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(audioCtx.destination);
    oscA.start(); oscB.start();
  }
  function setSoundEnabled(on) {
    soundEnabled = on;
    if (on) buildAudioGraph();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (masterGain) {
      const now = audioCtx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.linearRampToValueAtTime(on ? 0.14 : 0, now + 0.25);
    }
    if (soundToggleEl) {
      soundToggleEl.setAttribute('aria-pressed', String(on));
      if (soundToggleLabelEl) soundToggleLabelEl.textContent = on ? 'Sound on' : 'Sound off';
    }
  }
  if (soundToggleEl) soundToggleEl.addEventListener('click', () => setSoundEnabled(!soundEnabled));

  const reduceMotion = prefersReducedMotion();
  let elapsed = 0;
  let animId, lastT = performance.now();
  function animate(now) {
    animId = requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!reduceMotion) elapsed += dt;

    // Ambient orientation drift — independent of everything else,
    // deliberately never resting on a named account's own alignment.
    if (!reduceMotion && autoRotate) {
      for (const p of DRIFT_PLANES) rotateInPlane([Cx, Cy, Cz], basisVector(p.i), basisVector(p.j), p.freq * dt);
    }

    // Temperature — its own independent ambient cycle, uncorrelated with
    // the orientation drift above (different, incommensurate frequencies).
    const temp = temperatureAt(elapsed);
    const sep = separationFraction(temp);

    // Project every point through the CURRENT drifting basis.
    for (let i = 0; i < N; i++) {
      const v = basisVector(i);
      dimPos[i * 3] = dot(Cx, v) * SCALE;
      dimPos[i * 3 + 1] = dot(Cy, v) * SCALE;
      dimPos[i * 3 + 2] = dot(Cz, v) * SCALE;
    }
    dimGeo.attributes.position.needsUpdate = true;

    POWER_SOURCES.forEach((ps, i) => {
      const v = basisVector(ps.dimension).map(x => x * PS_RADIUS);
      psPos[i * 3] = dot(Cx, v) * SCALE;
      psPos[i * 3 + 1] = dot(Cy, v) * SCALE;
      psPos[i * 3 + 2] = dot(Cz, v) * SCALE;
    });
    psGeo.attributes.position.needsUpdate = true;

    const axis = basisVector(MICHAEL_GABRIEL_AXIS);
    const mVec = axis.map(x => x * (MG_CENTER_RADIUS + sep * MG_MAX_OFFSET));
    const gVec = axis.map(x => x * (MG_CENTER_RADIUS - sep * MG_MAX_OFFSET));
    mgPos[0] = dot(Cx, mVec) * SCALE; mgPos[1] = dot(Cy, mVec) * SCALE; mgPos[2] = dot(Cz, mVec) * SCALE;
    mgPos[3] = dot(Cx, gVec) * SCALE; mgPos[4] = dot(Cy, gVec) * SCALE; mgPos[5] = dot(Cz, gVec) * SCALE;
    mgGeo.attributes.position.needsUpdate = true;
    ghostGroup.position.set(mgPos[0], mgPos[1], mgPos[2]);
    ghostGroup.quaternion.copy(camera.quaternion);

    camera.lookAt(0, 0, 0);

    // Account closeness — continuous, drives the palette (no label left
    // to lean on — see round-2 header note — so this now has to carry
    // the OER/Apherion distinction on its own, together with the
    // wireframe's own vertex-collapse).
    const apherionScore = subspaceScore([Cx, Cy, Cz], APHERION_BASIS);
    const oerScore = subspaceScore([Cx, Cy, Cz], OER_BASIS);
    const targetBlend = apherionScore / (apherionScore + oerScore + 0.0001);
    accountBlend += (targetBlend - accountBlend) * Math.min(1, dt * 2);

    if (pulseActive && elapsed - pulseStart > PULSE_DURATION) pulseActive = false;

    const tmp = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const dropped = OER_DROPPED.includes(i);
      const legibility = dropped ? THREE.MathUtils.lerp(0.15, 1, accountBlend) : 1;
      tmp.copy(APHERION_WARM).lerp(APHERION_COOL, (i % 7) / 7).lerp(OER_COLOR, 1 - accountBlend);
      const boost = pulseBoostAt(dimPos[i * 3], dimPos[i * 3 + 1], dimPos[i * 3 + 2]);
      dimCol[i * 3] = Math.min(1, tmp.r * legibility + boost);
      dimCol[i * 3 + 1] = Math.min(1, tmp.g * legibility + boost);
      dimCol[i * 3 + 2] = Math.min(1, tmp.b * legibility + boost);
      dimCamDist[i] = camera.position.distanceTo(_depthVec.set(dimPos[i * 3], dimPos[i * 3 + 1], dimPos[i * 3 + 2]));
    }
    dimGeo.attributes.color.needsUpdate = true;
    POWER_SOURCES.forEach((ps, i) => {
      tmp.copy(APHERION_WARM).lerp(APHERION_COOL, 0.5).lerp(OER_COLOR, 1 - accountBlend);
      const boost = pulseBoostAt(psPos[i * 3], psPos[i * 3 + 1], psPos[i * 3 + 2]);
      psCol[i * 3] = Math.min(1, tmp.r + boost);
      psCol[i * 3 + 1] = Math.min(1, tmp.g + boost);
      psCol[i * 3 + 2] = Math.min(1, tmp.b + boost);
    });
    psGeo.attributes.color.needsUpdate = true;
    {
      const boostM = pulseBoostAt(mgPos[0], mgPos[1], mgPos[2]);
      const boostG = pulseBoostAt(mgPos[3], mgPos[4], mgPos[5]);
      mgCol[0] = Math.min(1, 1 + boostM); mgCol[1] = Math.min(1, 0.85 + boostM); mgCol[2] = Math.min(1, 0.55 + boostM);
      mgCol[3] = Math.min(1, 0.55 + boostG); mgCol[4] = Math.min(1, 0.75 + boostG); mgCol[5] = Math.min(1, 1 + boostG);
    }
    mgGeo.attributes.color.needsUpdate = true;

    // ─── The wireframe itself — all 55 edges, positions and colors both
    // pulled straight from the point data just computed above, so the
    // OER-collapse, account blend, and pulse all carry through for free.
    let minD = Infinity, maxD = -Infinity;
    for (let i = 0; i < N; i++) { if (dimCamDist[i] < minD) minD = dimCamDist[i]; if (dimCamDist[i] > maxD) maxD = dimCamDist[i]; }
    EDGE_PAIRS.forEach(([a, b], e) => {
      const p0 = e * 6, p1 = e * 6 + 3;
      wirePos[p0] = dimPos[a * 3]; wirePos[p0 + 1] = dimPos[a * 3 + 1]; wirePos[p0 + 2] = dimPos[a * 3 + 2];
      wirePos[p1] = dimPos[b * 3]; wirePos[p1 + 1] = dimPos[b * 3 + 1]; wirePos[p1 + 2] = dimPos[b * 3 + 2];
      const fa = depthFadeAt(dimCamDist[a], minD, maxD) * WIRE_BRIGHTNESS;
      const fb = depthFadeAt(dimCamDist[b], minD, maxD) * WIRE_BRIGHTNESS;
      wireCol[p0] = dimCol[a * 3] * fa; wireCol[p0 + 1] = dimCol[a * 3 + 1] * fa; wireCol[p0 + 2] = dimCol[a * 3 + 2] * fa;
      wireCol[p1] = dimCol[b * 3] * fb; wireCol[p1 + 1] = dimCol[b * 3 + 1] * fb; wireCol[p1 + 2] = dimCol[b * 3 + 2] * fb;
    });
    wireGeo.attributes.position.needsUpdate = true;
    wireGeo.attributes.color.needsUpdate = true;

    // Power Source anchor edges — gradient from the anchor dimension's
    // own current color to the Power Source's own, nothing floats free.
    POWER_SOURCES.forEach((ps, i) => {
      const p0 = i * 6, p1 = i * 6 + 3;
      const d = ps.dimension;
      psEdgePos[p0] = dimPos[d * 3]; psEdgePos[p0 + 1] = dimPos[d * 3 + 1]; psEdgePos[p0 + 2] = dimPos[d * 3 + 2];
      psEdgePos[p1] = psPos[i * 3]; psEdgePos[p1 + 1] = psPos[i * 3 + 1]; psEdgePos[p1 + 2] = psPos[i * 3 + 2];
      psEdgeCol[p0] = dimCol[d * 3]; psEdgeCol[p0 + 1] = dimCol[d * 3 + 1]; psEdgeCol[p0 + 2] = dimCol[d * 3 + 2];
      psEdgeCol[p1] = psCol[i * 3]; psEdgeCol[p1 + 1] = psCol[i * 3 + 1]; psEdgeCol[p1 + 2] = psCol[i * 3 + 2];
    });
    psEdgeGeo.attributes.position.needsUpdate = true;
    psEdgeGeo.attributes.color.needsUpdate = true;

    // Michael/Gabriel edge — Lucifer's own color, boosted by the same
    // pulse math as everything else if either endpoint was touched.
    {
      mgEdgePos[0] = mgPos[0]; mgEdgePos[1] = mgPos[1]; mgEdgePos[2] = mgPos[2];
      mgEdgePos[3] = mgPos[3]; mgEdgePos[4] = mgPos[4]; mgEdgePos[5] = mgPos[5];
      const boostM = pulseBoostAt(mgPos[0], mgPos[1], mgPos[2]);
      const boostG = pulseBoostAt(mgPos[3], mgPos[4], mgPos[5]);
      mgEdgeCol[0] = Math.min(1, LUCIFER_EDGE_COLOR.r + boostM); mgEdgeCol[1] = Math.min(1, LUCIFER_EDGE_COLOR.g + boostM); mgEdgeCol[2] = Math.min(1, LUCIFER_EDGE_COLOR.b + boostM);
      mgEdgeCol[3] = Math.min(1, LUCIFER_EDGE_COLOR.r + boostG); mgEdgeCol[4] = Math.min(1, LUCIFER_EDGE_COLOR.g + boostG); mgEdgeCol[5] = Math.min(1, LUCIFER_EDGE_COLOR.b + boostG);
    }
    mgEdgeGeo.attributes.position.needsUpdate = true;
    mgEdgeGeo.attributes.color.needsUpdate = true;

    if (audioCtx && soundEnabled) {
      const nowT = audioCtx.currentTime;
      const detune = sep * MAX_DETUNE_HZ;
      oscA.frequency.setTargetAtTime(BASE_HZ + detune, nowT, 0.4);
      oscB.frequency.setTargetAtTime(BASE_HZ - detune, nowT, 0.4);
      filter.frequency.setTargetAtTime(THREE.MathUtils.lerp(FILTER_MIN_HZ, FILTER_MAX_HZ, accountBlend), nowT, 0.5);
    }

    renderer.render(scene, camera);
  }
  animId = requestAnimationFrame(animate);

  const resize = bindGuardedResize(container, () => {
    const nw = container.clientWidth || window.innerWidth;
    const nh = container.clientHeight || window.innerHeight;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });

  if (initialPieceId != null) {
    // No sub-scene piece addressing yet for this scene (unlike Sphere/
    // Orbiter/etc.'s own numbered pieces) — a deep link just opens the
    // scene itself, same as Orrery's own single-piece scenes.
  }

  return {
    dispose() {
      cancelAnimationFrame(animId);
      if (resumeTimer) clearTimeout(resumeTimer);
      resize.dispose();
      orbitDrag?.dispose();
      touchGuard?.dispose();
      wheelZoom?.dispose();
      if (onClick) container.removeEventListener('click', onClick);
      renderer.dispose();
      starGeo.dispose(); starMat.dispose();
      dimGeo.dispose(); dimMat.dispose(); dimHaloMat.dispose();
      psGeo.dispose(); psMat.dispose(); psHaloMat.dispose();
      mgGeo.dispose(); mgMat.dispose(); mgHaloMat.dispose();
      wireGeo.dispose(); wireMat.dispose();
      psEdgeGeo.dispose(); psEdgeMat.dispose();
      mgEdgeGeo.dispose(); mgEdgeMat.dispose();
      ghostGeo.dispose(); ghostGeoBottom.dispose(); ghostMatTop.dispose();
      dotTex.dispose();
      if (oscA) { try { oscA.stop(); } catch { /* already stopped */ } oscA.disconnect(); }
      if (oscB) { try { oscB.stop(); } catch { /* already stopped */ } oscB.disconnect(); }
      filter?.disconnect(); masterGain?.disconnect();
      if (audioCtx) audioCtx.close().catch(() => {});
      titleEl?.remove(); hintEl?.remove(); soundToggleEl?.remove();
      container.innerHTML = '';
    },
  };
}
