import * as THREE from 'three';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, bindTapVsDrag,
  prefersReducedMotion, parseHTML, createPanelCloser, escapeHtml,
} from '../../utils/sceneKit.js';
import { DIMENSIONS, POWER_SOURCES, OER_DROPPED, OER_KEPT, LUCIFER_LINE, MICHAEL_GABRIEL_AXIS, ACCOUNTS } from './outside.text.js';
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
const N = 11; // Apherion's full dimensionality
const RIGHT_KEY = 'ArrowRight';

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

  // ─── Chrome: title/hint/sound-toggle/panel (full only) ─────────────────
  let titleEl = null, hintEl = null, panel = null, panelCloser = null;
  let panelTitleEl = null, panelBodyEl = null;
  let soundToggleEl = null, soundToggleLabelEl = null, accountLabelEl = null;
  if (!preview) {
    const frag = parseHTML(outsideHtml);
    titleEl = frag.querySelector('.outside-title');
    hintEl = frag.querySelector('.outside-hint');
    document.body.appendChild(titleEl);
    document.body.appendChild(hintEl);

    accountLabelEl = frag.querySelector('.outside-account-label');
    document.body.appendChild(accountLabelEl);

    soundToggleEl = frag.querySelector('.outside-sound-toggle');
    soundToggleLabelEl = soundToggleEl.querySelector('.outside-sound-toggle-label');
    document.body.appendChild(soundToggleEl);

    panel = frag.querySelector('.outside-panel');
    container.appendChild(panel);
    panelTitleEl = panel.querySelector('.outside-panel-title');
    panelBodyEl = panel.querySelector('.outside-panel-body');
    panelCloser = createPanelCloser(panel, container, {
      closeBtn: panel.querySelector('.outside-panel-close'),
    });
  }

  function openDimensionPanel(i) {
    if (!panel) return;
    const dim = DIMENSIONS[i];
    panelTitleEl.textContent = dim.name;
    const dropped = OER_DROPPED.includes(i);
    panelBodyEl.innerHTML = `
      <p class="outside-panel-subtitle">${dropped ? 'Absent from OER’s account' : 'Present in both accounts'}</p>
      <ul class="outside-keyword-list">${dim.keywords.map(k => `<li>${escapeHtml(k)}</li>`).join('')}</ul>`;
    panel.classList.add('open');
  }
  function openPowerSourcePanel(i) {
    if (!panel) return;
    const ps = POWER_SOURCES[i];
    panelTitleEl.textContent = ps.name;
    const anchorName = DIMENSIONS[ps.dimension].name;
    panelBodyEl.innerHTML = `
      <p class="outside-panel-subtitle">Anchored to ${escapeHtml(anchorName)}</p>
      ${ps.excerpt ? `<blockquote class="outside-excerpt">${escapeHtml(ps.excerpt)}</blockquote>` : '<p class="outside-panel-subtitle">No text yet.</p>'}`;
    panel.classList.add('open');
  }
  function openLuciferPanel() {
    if (!panel) return;
    panelTitleEl.textContent = 'Lucifer';
    panelBodyEl.innerHTML = `<blockquote class="outside-excerpt">${escapeHtml(LUCIFER_LINE)}</blockquote>`;
    panel.classList.add('open');
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
  let onClick = null;
  if (!preview) {
    onClick = e => {
      if (touchGuard?.consume()) return;
      const th = 7 * SCALE_FACTOR;
      let idx = pickAt(e.clientX, e.clientY, dimPoints, th);
      if (idx !== -1) { openDimensionPanel(idx); return; }
      idx = pickAt(e.clientX, e.clientY, psPoints, th);
      if (idx !== -1) { openPowerSourcePanel(idx); return; }
      idx = pickAt(e.clientX, e.clientY, mgPoints, th);
      if (idx !== -1) { openLuciferPanel(); return; }
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

    // Account closeness — continuous, drives palette/sound/label together.
    const apherionScore = subspaceScore([Cx, Cy, Cz], APHERION_BASIS);
    const oerScore = subspaceScore([Cx, Cy, Cz], OER_BASIS);
    const targetBlend = apherionScore / (apherionScore + oerScore + 0.0001);
    accountBlend += (targetBlend - accountBlend) * Math.min(1, dt * 2);

    const tmp = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const dropped = OER_DROPPED.includes(i);
      const legibility = dropped ? THREE.MathUtils.lerp(0.15, 1, accountBlend) : 1;
      tmp.copy(APHERION_WARM).lerp(APHERION_COOL, (i % 7) / 7).lerp(OER_COLOR, 1 - accountBlend);
      dimCol[i * 3] = tmp.r * legibility; dimCol[i * 3 + 1] = tmp.g * legibility; dimCol[i * 3 + 2] = tmp.b * legibility;
    }
    dimGeo.attributes.color.needsUpdate = true;
    POWER_SOURCES.forEach((ps, i) => {
      tmp.copy(APHERION_WARM).lerp(APHERION_COOL, 0.5).lerp(OER_COLOR, 1 - accountBlend);
      psCol[i * 3] = tmp.r; psCol[i * 3 + 1] = tmp.g; psCol[i * 3 + 2] = tmp.b;
    });
    psGeo.attributes.color.needsUpdate = true;
    mgCol[0] = 1; mgCol[1] = 0.85; mgCol[2] = 0.55;
    mgCol[3] = 0.55; mgCol[4] = 0.75; mgCol[5] = 1;
    mgGeo.attributes.color.needsUpdate = true;

    camera.lookAt(0, 0, 0);

    // Passive account label — fades in only when the drift happens to
    // coincide closely with a named account, never a control, never paused.
    if (accountLabelEl) {
      const closeness = Math.max(apherionScore, oerScore);
      const show = closeness > 0.82;
      accountLabelEl.style.opacity = show ? String(THREE.MathUtils.clamp((closeness - 0.82) / 0.15, 0, 1)) : '0';
      accountLabelEl.textContent = apherionScore > oerScore ? ACCOUNTS.apherion.label : ACCOUNTS.oer.label;
    }

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
      panelCloser?.dispose();
      if (onClick) container.removeEventListener('click', onClick);
      renderer.dispose();
      starGeo.dispose(); starMat.dispose();
      dimGeo.dispose(); dimMat.dispose(); dimHaloMat.dispose();
      psGeo.dispose(); psMat.dispose(); psHaloMat.dispose();
      mgGeo.dispose(); mgMat.dispose(); mgHaloMat.dispose();
      ghostGeo.dispose(); ghostGeoBottom.dispose(); ghostMatTop.dispose();
      dotTex.dispose();
      if (oscA) { try { oscA.stop(); } catch { /* already stopped */ } oscA.disconnect(); }
      if (oscB) { try { oscB.stop(); } catch { /* already stopped */ } oscB.disconnect(); }
      filter?.disconnect(); masterGain?.disconnect();
      if (audioCtx) audioCtx.close().catch(() => {});
      titleEl?.remove(); hintEl?.remove(); soundToggleEl?.remove(); accountLabelEl?.remove(); panel?.remove();
      container.innerHTML = '';
    },
  };
}
