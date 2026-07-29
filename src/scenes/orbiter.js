import * as THREE from 'three';
import { poems } from '../text/poems.js';
import { bindOrbitDrag, bindGuardedResize, prefersReducedMotion, createPanelCloser, createJumpList, escapeHtml } from '../utils/sceneKit.js';

// ─── Poem cross-links, 2026-07-17 ──────────────────────────────────────────
// Same mechanism, and the same rule, as the geodesic sphere's facet-to-
// fragment links in sphere.js and the scroll's LINKS in scroll.js: only
// phrases already sitting in the raw text get wired up, nothing added to
// make a connection exist. Keyed by poem title + stanza index (0-based,
// matching poem.stanzas) rather than an id, since poems.js entries don't
// carry one. A few of these pairs turned out to already share a source —
// Moon Song and Raise a Glass are parts 9 and 11 of the same unpublished
// cycle, thirty-six.doc (see poems.js's header comment) — which is
// presumably why the vocabulary echoes at all; the DNA/Apocrypha and
// DNA/Haiku pairs, by contrast, are two completely unrelated source
// documents landing on the same word independently.
const POEM_LINKS = [
  { title: 'Lament for the Future Never Realized', stanza: 1,  phrase: 'stones',      target: 'Moon Song' },
  { title: 'Moon Song',                             stanza: 3,  phrase: 'stones',      target: 'Lament for the Future Never Realized' },
  { title: 'The Lovers',                            stanza: 0,  phrase: 'mirrors',     target: 'Lament for the Future Never Realized' },
  { title: 'Lament for the Future Never Realized', stanza: 3,  phrase: 'Mirrors',     target: 'The Lovers' },
  { title: 'Moon Song',                             stanza: 10, phrase: 'latticework', target: 'Raise a Glass' },
  { title: 'Raise a Glass',                         stanza: 1,  phrase: 'latticework', target: 'Moon Song' },
  { title: 'DNA',                                   stanza: 0,  phrase: 'Coalescing',  target: 'Apocrypha' },
  { title: 'Apocrypha',                             stanza: 0,  phrase: 'Coalescing',  target: 'DNA' },
  { title: 'DNA',                                   stanza: 0,  phrase: 'Reveal',      target: 'Haiku' },
  { title: 'Haiku',                                 stanza: 4,  phrase: 'revealed',    target: 'DNA' },
];

// ─── Orbiter: p-orbital, Satellites ────────────────────────────────────────
// Design pass, 2026-07-29 — full conceptual pivot, replacing the piece that
// used to live here. The old version was Earth (tinted green) with its
// magnetic field traced in glowing lines and an aurora at the poles; before
// that, an even older "worldline" concept (Google Maps satellite tiles + a
// personal geographic path). Scott's note on the magnetosphere version,
// after two rounds of trying to make its day/tail asymmetry read clearly:
// drop the concept entirely rather than keep tuning it.
//
// What's here now: a hydrogen atom's p-orbital — the actual shape an
// electron's wavefunction takes in that state, rendered as a fuzzy
// probability cloud rather than a solid mesh. A p-orbital is two lobes on
// opposite sides of a center, split by a flat nodal plane where the
// electron's presence-probability is exactly zero — a dumbbell silhouette,
// recognizable without a label, and genuinely different from a sphere in a
// way the old magnetosphere shape never quite managed to be from every
// angle. The two lobes reuse this file's own existing geometry: what used
// to be the aurora bands at the poles (see buildOrbitalCloud, formerly
// buildAurorae) are now the two lobes, and the green/violet color split
// that used to be "arbitrary polar aurora colors" now stands for
// wavefunction phase — the two lobes of a real p-orbital carry opposite
// sign, and that's genuinely what the color difference is showing.
//
// The satellites (buildSatellites, below) are untouched — same clean,
// deterministic, tilted elliptical orbits as before. What changed is what
// they mean: precise classical paths swept through and around a cloud that
// has no precise path at all, the same word ("orbit") doing two completely
// different kinds of work at two different scales in the same frame. Kept
// deliberately crisp against the cloud's own deliberate fuzziness — that
// contrast is the point, not something to soften.
//
// No textures fetched over the network — every texture on this site,
// including the small nucleus below, is a canvas gradient drawn at load
// time, not an image asset.

const NUCLEUS_RADIUS = 0.16;

// ─── Nucleus ────────────────────────────────────────────────────────────────
// The old Earth surface/cloud-shell texture generators (photoreal continents,
// separate rotating cloud layer) are gone — a hydrogen atom's nucleus is a
// single proton, not a textured planet. Replaced with one small, simple,
// bright canvas texture: a hot, mottled plasma-like core rather than a flat
// sphere, just enough surface interest to read as an energetic point rather
// than an inert ball, small enough that the p-orbital cloud around it is
// unmistakably the visual subject.
function makeNucleusTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const cx = c.getContext('2d');
  const g = cx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0,    '#fff8e8');
  g.addColorStop(0.35, '#ffe9b8');
  g.addColorStop(0.7,  '#e8a860');
  g.addColorStop(1,    '#7a4520');
  cx.fillStyle = g;
  cx.fillRect(0, 0, 256, 256);
  // A handful of soft mottled patches so the core reads as roiling plasma
  // rather than a flat gradient ball.
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const r = 14 + Math.random() * 34;
    const patch = cx.createRadialGradient(x, y, 0, x, y, r);
    const bright = Math.random() > 0.5;
    patch.addColorStop(0, bright ? 'rgba(255,250,230,0.35)' : 'rgba(120,50,20,0.3)');
    patch.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = patch;
    cx.beginPath();
    cx.arc(x, y, r, 0, Math.PI * 2);
    cx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// ─── p-orbital probability cloud ───────────────────────────────────────────
// Rebuilt 2026-07-17 — Scott, seeing it running, questioned the original
// design: a torus-shaped "aurora band" hugging the surface at each pole.
// Replaced 2026-07-29 with a genuinely fuzzy particle-density cloud — no
// solid mesh, no hard edge anywhere. The green/violet colors and the two
// pole positions are the only things carried over from that old version
// (see the file-header comment above); everything about how the shape
// itself is generated is new.
//
// Refined again 2026-07-29, second round — Scott, after seeing it live:
// the two lobes read as visibly unequal in size (one taller than the
// other), and each one read as a roughly uniform-width column rather than
// a teardrop that bulges in the middle. The first version's approach (a
// triangular distribution for how far out a particle sits, a parabola for
// how wide) was a hand-built approximation of the right shape, not the
// real thing, and evidently not a close enough one. Replaced with actual
// rejection sampling against the real 2p-orbital probability density,
// |psi|^2 ∝ r^2 * e^(-r/a0) * cos^2(theta) — the formula Scott supplied —
// which fixes both notes at once rather than needing separate hand-tuned
// fixes for "equal size" and "bulges in the middle":
//   - r^2 * e^(-r/a0) genuinely peaks at r = 2*a0 (basic calculus: the
//     r^2 growth wins for small r, the exponential decay wins for large
//     r, so the product rises then falls) — a real bulge-then-taper along
//     the lobe's own length, not an approximation of one.
//   - cos^2(theta), with theta measured from the lobe's own axis, is
//     exactly zero at theta = 90° (the nodal plane through the nucleus)
//     and maximal along the axis — this is what actually produces the
//     two-lobe dumbbell in the real wavefunction, not a separate "two
//     poles" placement decision.
//   - Sampled with theta spanning the FULL 0..180° range in one pass
//     (cos^2 is symmetric, so this naturally produces both lobes from a
//     single distribution) and then, for exact rather than merely
//     statistical mirror symmetry, only the upper half is actually
//     sampled — the lower lobe is built as a precise reflection (y -> -y)
//     of the upper one, particle for particle. That guarantees identical
//     particle count and identical vertical extent between the two
//     lobes, which is what "equal size" actually requires; leaving it to
//     two independent random draws (the first version's approach, and
//     still what a naive full-range sample of this same distribution
//     would do) only gives equal counts on average, not the particle-for-
//     particle match Scott's note called for.
// a0 (A0 below) is a tuning constant, not the real Bohr radius — chosen
// (see check_porbital3.mjs/check_porbital4.mjs in the working notes) so
// the bulk of the sampled cloud sits comfortably inside the satellites'
// own inner orbit radius (1.35), with only its naturally fading tail
// occasionally reaching past it — verified numerically: less than 2% of
// particles fall beyond r=1.35 at a0=0.175, and the r-histogram rises
// from near-zero, peaks around r=2*a0, and tapers back down, confirming
// the bulge is real and not just visually assumed.
function makePOrbitalDotTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const cx = c.getContext('2d');
  const g = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0,    'rgba(255,255,255,1)');
  g.addColorStop(0.4,  'rgba(255,255,255,0.5)');
  g.addColorStop(1,    'rgba(255,255,255,0)');
  cx.fillStyle = g;
  cx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

function buildOrbitalCloud(preview) {
  const count = preview ? 900 : 2800;
  // Tuning constant (not the real Bohr radius) for r^2 * e^(-r/A0) — chosen
  // so the bulk of the sampled cloud sits comfortably inside the
  // satellites' own inner orbit radius (1.35); see the function-header
  // comment above for the numerical check behind this value.
  const A0 = 0.175;
  const R_MAX = A0 * 9; // truncation radius — e^(-9) is negligible, this just bounds the rejection-sampling proposal
  const F_MAX = 4 * A0 * A0 * Math.exp(-2); // max of r^2*e^(-r/A0) (at r=2*A0) times max of cos^2(theta)=1

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  // Undisturbed envelope position for each particle — animate() adds a
  // small per-particle sinusoidal drift on top of this each frame rather
  // than mutating it directly, so the underlying teardrop shape never
  // erodes or random-walks away from what was actually sampled.
  const base = new Float32Array(count * 3);
  const drift = [];

  // Same two hues the old aurora band carried (see makeShimmerTexture's
  // retired '120,255,180' / '195,140,255' pair) — now standing for
  // wavefunction phase rather than an arbitrary color choice: the
  // teal-green lobe is the orbital's +phase lobe, the violet lobe is -phase.
  const colorPos = new THREE.Color(0x78ffb4);
  const colorNeg = new THREE.Color(0xc978ff);

  // Rejection-sample one point in the UPPER lobe only (theta measured from
  // the +Y axis, u = cos(theta) confined to [0,1] here) — the lower lobe
  // is built below as an exact mirror of this one, not sampled
  // independently, so the two lobes match particle-for-particle rather
  // than merely "on average."
  function sampleUpperLobePoint() {
    let r, u, weight;
    do {
      r = Math.random() * R_MAX;
      u = Math.random();
      weight = r * r * Math.exp(-r / A0) * u * u;
    } while (Math.random() * F_MAX >= weight);
    const phi = Math.random() * Math.PI * 2;
    const y = r * u;
    const perpR = r * Math.sqrt(Math.max(0, 1 - u * u));
    return { x: perpR * Math.cos(phi), y, z: perpR * Math.sin(phi), r };
  }

  const half = count / 2;
  for (let i = 0; i < half; i++) {
    const p = sampleUpperLobePoint();
    // Density-based brightness — particles near the true probability peak
    // (r near 2*A0, close to the lobe's own axis) read hotter than ones
    // out toward the fading tail, on top of what sheer overlap density
    // under additive blending already does for free.
    const dens = 0.35 + 0.65 * Math.min(1, (p.r * p.r * Math.exp(-p.r / A0)) / (4 * A0 * A0 * Math.exp(-2)));

    [1, -1].forEach(lobeSign => {
      const idx = lobeSign > 0 ? i : half + i;
      const x = p.x, y = p.y * lobeSign, z = p.z;
      base[idx * 3] = x; base[idx * 3 + 1] = y; base[idx * 3 + 2] = z;
      positions[idx * 3] = x; positions[idx * 3 + 1] = y; positions[idx * 3 + 2] = z;

      const col = lobeSign > 0 ? colorPos : colorNeg;
      colors[idx * 3] = col.r * dens; colors[idx * 3 + 1] = col.g * dens; colors[idx * 3 + 2] = col.b * dens;

      // Slow drift/shimmer per particle, not a static point cloud: a fixed
      // random direction (normalized) each particle nudges along, at its
      // own phase and speed, so the swarm reads as gently alive rather
      // than frozen — closer to butterfly.js's per-particle damped-
      // velocity drift in spirit, though the underlying math here is
      // simpler since there's no physical simulation to run, just an
      // oscillation. Each mirrored pair gets its OWN independent drift
      // (not mirrored motion) — only the static shape is a mirror image;
      // synced motion between the two lobes would look mechanical.
      let dx = Math.random() * 2 - 1, dy = Math.random() * 2 - 1, dz = Math.random() * 2 - 1;
      const dl = Math.hypot(dx, dy, dz) || 1;
      dx /= dl; dy /= dl; dz /= dl;
      drift[idx] = {
        dx, dy, dz,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
        amp: 0.015 + Math.random() * 0.02,
      };
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const dotTex = makePOrbitalDotTexture();
  const mat = new THREE.PointsMaterial({
    size: preview ? 0.05 : 0.045,
    map: dotTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);

  const group = new THREE.Group();
  group.add(points);

  return {
    group, points, geo, mat, dotTex, base, drift, count,
    baseOpacity: mat.opacity, phase: Math.random() * Math.PI * 2,
  };
}

// ─── Nucleus internal detail (click to reveal) ─────────────────────────────
// Added 2026-07-29 — the nucleus was previously a plain accent sphere with
// no interaction. Click it (same affordance as a satellite: cursor
// changes, it brightens on hover) and it resolves into internal structure
// instead of staying an inert dot; click again to collapse it back.
// Built lazily, on first click only — nothing here costs anything while
// the nucleus sits collapsed.
//
// Color confinement, and why there's no membrane here: individual quarks
// and gluons are never observable in isolation at any achievable energy —
// there is no boundary a shimmer could plausibly be "peeking through,"
// because there's no surface there at all. What's actually happening
// inside a proton or neutron is a constant, ongoing exchange of color
// charge between its three bound (valence) quarks, with no point where
// that exchange stops and something solid begins. So: no membrane, no
// boundary anywhere. Each nucleon (proton or neutron) is rendered as its
// own small, soft particle cloud — same "no hard edge" logic already
// used for the p-orbital lobes above, just isotropic rather than lobed,
// since a nucleon has no directional structure the way an orbital does —
// with three brighter points inside standing for its three valence
// quarks (uud for a proton, udd for a neutron — the count and the
// confinement behavior are what matters here, not distinguishing flavor
// visually), connected by a continuously pulsing shimmer rather than a
// static wireframe triangle, so the exchange reads as restless and
// ongoing rather than a solved, finished shape.
//
// Genuine scale compromise, on top of one already in this scene: the
// visible nucleus is already vastly oversized relative to the electron
// cloud around it (a true-to-scale atom would render it as a single
// invisible point). This adds nucleon/quark-level detail on top of that
// existing compromise — deliberately not an attempt to make the relative
// sizes here "make sense." It's a reward for clicking, not another real
// zoom level of the same model.
function makeNucleonDotTexture(rgb) {
  const c = document.createElement('canvas');
  c.width = 24; c.height = 24;
  const cx = c.getContext('2d');
  const g = cx.createRadialGradient(12, 12, 0, 12, 12, 12);
  g.addColorStop(0,   `rgba(${rgb},1)`);
  g.addColorStop(0.5, `rgba(${rgb},0.4)`);
  g.addColorStop(1,   `rgba(${rgb},0)`);
  cx.fillStyle = g;
  cx.fillRect(0, 0, 24, 24);
  return new THREE.CanvasTexture(c);
}

function buildNucleusDetail(preview) {
  const group = new THREE.Group();

  // Four nucleons in a small tetrahedral cluster — two protons, two
  // neutrons (a helium-4-shaped cluster, not a literal hydrogen nucleus;
  // see the scale-compromise note above) — the smallest arrangement that
  // actually reads as "a cluster" rather than just "a pair." Offsets are a
  // regular tetrahedron's own vertex directions, scaled to sit just
  // outside the old plain sphere's radius.
  const NUCLEON_R = NUCLEUS_RADIUS * 0.62;
  const SPREAD = NUCLEUS_RADIUS * 0.5;
  const offsets = [
    new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, -1, -1),
    new THREE.Vector3(-1, 1, -1), new THREE.Vector3(-1, -1, 1),
  ].map(v => v.normalize().multiplyScalar(SPREAD));
  const kinds = ['proton', 'neutron', 'proton', 'neutron'];
  const PROTON_RGB = '255,140,120';
  const NEUTRON_RGB = '150,180,255';
  const particleCount = preview ? 40 : 70;

  const nucleons = [];

  offsets.forEach((offset, ni) => {
    const rgb = kinds[ni] === 'proton' ? PROTON_RGB : NEUTRON_RGB;

    // The nucleon's own soft cloud — isotropic radial falloff (no angular
    // dependence needed the way the p-orbital's cos^2(theta) term
    // required; a nucleon has no comparable directional structure to get
    // right). Cube-rooting a min-of-two-uniforms draw biases samples
    // toward the center while keeping a continuous, no-hard-edge falloff
    // toward the surface — same spirit as the orbital cloud's own
    // density-by-construction approach, just isotropic instead of lobed.
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const rad = NUCLEON_R * Math.cbrt(Math.min(Math.random(), Math.random()));
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = Math.random() * Math.PI * 2;
      positions[i * 3]     = offset.x + rad * Math.sin(theta) * Math.cos(phi);
      positions[i * 3 + 1] = offset.y + rad * Math.cos(theta);
      positions[i * 3 + 2] = offset.z + rad * Math.sin(theta) * Math.sin(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dotTex = makeNucleonDotTexture(rgb);
    const mat = new THREE.PointsMaterial({
      size: preview ? 0.02 : 0.016, map: dotTex, color: new THREE.Color(`rgb(${rgb})`),
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    group.add(points);

    // Three valence quarks, in their own small triangle inside the
    // nucleon's cloud — jittered continuously in animate() rather than
    // sitting rigid, since "restless" is the whole point.
    const quarkR = NUCLEON_R * 0.4;
    const quarkAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
    const quarks = quarkAngles.map(a => {
      const qGeo = new THREE.SphereGeometry(NUCLEON_R * 0.14, 6, 6);
      const qMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(qGeo, qMat);
      const base = new THREE.Vector3(
        offset.x + Math.cos(a) * quarkR,
        offset.y + Math.sin(a) * quarkR * 0.6,
        offset.z + Math.sin(a * 1.3) * quarkR * 0.6
      );
      mesh.position.copy(base);
      group.add(mesh);
      // Same fixed-direction/own-phase drift pattern as the orbital
      // cloud's own particles above — a quark never actually sits still,
      // "restless" is the point, not a static wireframe vertex.
      let jx = Math.random() * 2 - 1, jy = Math.random() * 2 - 1, jz = Math.random() * 2 - 1;
      const jl = Math.hypot(jx, jy, jz) || 1;
      jx /= jl; jy /= jl; jz /= jl;
      return {
        mesh, geo: qGeo, mat: qMat, base,
        jitterDir: new THREE.Vector3(jx, jy, jz),
        jitterAmp: NUCLEON_R * 0.22,
        jitterPhase: Math.random() * Math.PI * 2,
        jitterSpeed: 0.8 + Math.random() * 0.6,
      };
    });

    // Gluon-exchange shimmer — three thin additive lines, one per pair of
    // this nucleon's own quarks, each pulsing on its own independent phase
    // so the exchange reads as continuous and ongoing rather than a
    // static wireframe triangle. No membrane, no boundary rendered — just
    // the exchange itself, same reasoning as the header comment above.
    const shimmerPairs = [[0, 1], [1, 2], [2, 0]];
    const shimmerLines = shimmerPairs.map(([a, b]) => {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([quarks[a].base, quarks[b].base]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      group.add(line);
      return { line, geo: lineGeo, mat: lineMat, a, b, phase: Math.random() * Math.PI * 2, speed: 1.1 + Math.random() * 0.9 };
    });

    nucleons.push({ offset, geo, mat, dotTex, points, quarks, shimmerLines });
  });

  return { group, nucleons };
}

// ─── Satellites ─────────────────────────────────────────────────────────────
// Same tilted-pivot orbit trick as the orrery in orrery.js: rotate the pivot,
// the body (attached at a fixed radius on the pivot) sweeps a real orbit.
// 2026-07-17: each satellite now carries one of Scott's poems (src/text/
// poems.js) and is clickable, same mechanism as the geodesic sphere's
// facet-to-fragment links in sphere.js — a raycast hit opens a text panel.
// A small emissive beacon and a generous invisible hit-sphere (the visible
// body is tiny) make them findable/clickable at this scale.
function buildSatellites(preview) {
  const group = new THREE.Group();
  // Design pass, 2026-07-29 — Scott: satellite/orbit density felt thin
  // next to Butterfly's particle count, and the fourteen poems weren't
  // otherwise surfaced anywhere in-scene. Bumping the full count to
  // poems.length turns the offset trick below into a full bijection —
  // every poem gets exactly one satellite, every load, rather than only
  // whichever 8-poem slice happened to land — so density and "the poems
  // live here" are the same fix. Preview stays modest; it's a 320px tile
  // with no click-through anyway.
  const count = preview ? 6 : poems.length;
  const sats = [];
  // Design pass, 2026-07-17: with poems.length (now 14, after folding the
  // opening-fragment poems into poems.js) bigger than the old fixed
  // `count` of 8, a plain `i % poems.length` always equals `i` — the same
  // first 8 poems, every load, forever; nothing past index `count-1` was
  // ever reachable. A random per-load offset means a different
  // consecutive slice of the pool each visit instead (or, now that count
  // equals poems.length in the full scene, a different rotation of the
  // same full set) — fits the site's own found-by-chance logic (the
  // colophon's own hidden mark and bibliography) better than a fixed 1:1
  // index mapping would.
  const poemOffset = Math.floor(Math.random() * poems.length);
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0xe8e4d8 });
  const panelMat = new THREE.MeshBasicMaterial({
    color: 0x3f6fb0, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
  });
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  // Identical for every satellite, so built once here rather than per-loop
  // like bodyMat/panelMat already are — was previously re-created inside
  // the loop below (harmless but wasteful: up to 14 redundant BufferGeometry
  // allocations per scene load).
  const coreGeo = new THREE.BoxGeometry(0.026, 0.026, 0.026);
  const panelGeo = new THREE.PlaneGeometry(0.09, 0.026);

  for (let i = 0; i < count; i++) {
    const radius = 1.35 + Math.random() * 0.85;

    const pivot = new THREE.Object3D();
    // Design pass, 2026-07-29 — Scott: orbits read as roughly coplanar.
    // The old Euler-angle composition (rotation.x = inclination,
    // rotation.z = a small ascending-node wobble, rotation.y = random)
    // doesn't sample orientation space uniformly, and with only 8
    // satellites the bias showed. Building the pivot's orientation from a
    // genuinely random point on the unit sphere — used as the orbit's own
    // normal — gives real variety instead: every satellite's orbital
    // plane tilts independently, the way a real population (launched at
    // different times, into different mission-specific inclinations)
    // actually would, rather than clustering near a shared tilt.
    const normal = new THREE.Vector3(
      Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1
    ).normalize();
    pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    pivot.rotateZ(Math.random() * Math.PI * 2); // free ascending-node spin around that normal
    group.add(pivot);

    const body = new THREE.Group();
    body.add(new THREE.Mesh(coreGeo, bodyMat));
    const p1 = new THREE.Mesh(panelGeo, panelMat); p1.position.x =  0.06;
    const p2 = new THREE.Mesh(panelGeo, panelMat); p2.position.x = -0.06;
    body.add(p1, p2);
    // A small glowing beacon — reads as "this one's alive/clickable"
    // against the tiny grey box. Its own material instance (not shared)
    // so hovering one satellite doesn't light up every satellite's beacon.
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x9fffc8 });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), beaconMat);
    body.add(beacon);
    // Invisible, generous hit target — the visible parts are too small to
    // reliably click/hover on their own. Scott: still too hard to land on
    // — bumped up further (0.09 -> 0.16).
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), hitMat);
    body.add(hit);
    body.position.x = radius;
    pivot.add(body);

    // Faint orbit ring, so the path is visible even when the satellite itself
    // is a single small point.
    const ringGeo = new THREE.TorusGeometry(radius, 0.002, 6, 64);
    // Opacity varied per ring now (was a flat 0.12 for all) — a real
    // satellite population's paths wouldn't all read with equal
    // prominence; some fainter, some a little more distinct, reads as
    // messier/richer rather than a uniform stack of identical rings.
    // Pulled down again (0.07-0.18 -> 0.045-0.11), second design pass —
    // these are perfectly circular by nature, and were competing with —
    // and diluting — the one shape actually telling this scene's story.
    // (Written when that story was a magnetosphere with field lines to
    // compete against; the reasoning about not diluting the shape still
    // holds now that the shape is a p-orbital cloud instead — see the
    // 2026-07-29 pivot note at the top of this file.)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffe08a, transparent: true, opacity: 0.045 + Math.random() * 0.065,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    pivot.add(ring);

    sats.push({
      pivot, body, hit, beacon, beaconMat,
      // Scott: slow these down — was (0.25 + rand*0.35), now less than half that.
      speed: (0.09 + Math.random() * 0.14) * (Math.random() < 0.5 ? 1 : -1),
      ringMat, ringGeo,
      poemIndex: (i + poemOffset) % poems.length,
    });
  }

  return { group, sats, bodyMat, panelMat, hitMat, coreGeo, panelGeo };
}

export function createOrbiter(container, { preview = false } = {}) {
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  camera.position.set(0, 0.6, preview ? 4.2 : 5.2);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  // Programmatically focusable so closing the panel (✕, outside click, or
  // Escape) has somewhere real to send focus back to, rather than leaving
  // it on a now-hidden close button or nowhere at all.
  if (!preview) container.tabIndex = -1;

  const root = new THREE.Group();
  scene.add(root);

  scene.add(new THREE.AmbientLight(0x224422, 1.1));
  const key = new THREE.DirectionalLight(0x88ffaa, 1.1);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x44ff88, 0.5);
  rim.position.set(-4, -2, -3);
  scene.add(rim);

  // ─── Deep-field stars ───────────────────────────────────────────────────
  const starCount = preview ? 250 : 700;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 20 + Math.random() * 20;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xddeeff, size: 0.045, transparent: true, opacity: 0.5 });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  // ─── Nucleus ────────────────────────────────────────────────────────────
  // A single small, bright, plasma-textured core standing in for the
  // proton at the center of a hydrogen atom — no continents, no cloud
  // shell, nothing planet-like. Kept deliberately small so the p-orbital
  // cloud around it (below) is unmistakably the thing the scene is about.
  const nucleusTex = makeNucleusTexture();
  const geo = new THREE.SphereGeometry(NUCLEUS_RADIUS, preview ? 24 : 40, preview ? 24 : 40);
  // Design pass, 2026-07-29 — transparent:true added (opacity itself
  // stays 1 until someone actually clicks) so this can fade out in favor
  // of the internal detail below without needing a material swap.
  const NUCLEUS_BASE_EMISSIVE = 0.55;
  const mat = new THREE.MeshStandardMaterial({
    map: nucleusTex,
    emissive: 0xffb060,
    emissiveIntensity: NUCLEUS_BASE_EMISSIVE,
    roughness: 0.6,
    transparent: true,
  });
  const earth = new THREE.Mesh(geo, mat);
  root.add(earth);

  // Invisible, generous hit target for the nucleus — same "the visible
  // body is small, the click target isn't" pattern the satellites already
  // use just below, not a new interaction language. Full scene only
  // (preview never has click-through).
  const nucleusHitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const nucleusHit = new THREE.Mesh(new THREE.SphereGeometry(NUCLEUS_RADIUS * 1.7, 12, 12), nucleusHitMat);
  root.add(nucleusHit);

  // Nucleus internal detail — built lazily on first click by
  // toggleNucleusDetail() further down, not here; see buildNucleusDetail's
  // own header comment for why.
  let nucleusDetail = null;
  let nucleusRevealed = false;
  let nucleusRevealT = 0; // 0 = fully collapsed (plain sphere), 1 = fully revealed (internal detail), eased in animate()

  // ─── p-orbital cloud + satellites ───────────────────────────────────────
  const aurorae = buildOrbitalCloud(preview);
  root.add(aurorae.group);

  const satellites = buildSatellites(preview);
  root.add(satellites.group);

  // ─── Caption + hint + poem panel (full only) ────────────────────────────
  let caption = null, hint = null, panel = null, panelTitle = null, panelContent = null, panelCloser = null, jumpList = null;
  if (!preview && !document.getElementById('orbiter-styles')) {
    const style = document.createElement('style');
    style.id = 'orbiter-styles';
    style.textContent = `
      /* z-index must clear #experience-overlay (styles/main.css: fixed,
         z-index:300) — appended to document.body, outside that overlay,
         same reasoning as orrery.js's hint/caption/title fix. */
      #orbiter-caption, #orbiter-hint {
        position: fixed; color: rgba(255,255,255,0.35);
        pointer-events: none; text-align: center; z-index: 310;
        font-family: 'Times New Roman', serif;
      }
      #orbiter-caption {
        bottom: 3rem; left: 50%; transform: translateX(-50%);
        /* Design pass, 2026-07-29 — Scott: nothing in the scene signalled
           there was text content here at all, unlike Butterfly's own
           title/date label (#butterfly-exp-label in main.js: clamp
           .85-1.6rem, opacity .85). This carried the epigraph
           ("sing, orbiter," Richard Kenney) the whole time but at a size
           and opacity that read as ambient chrome, not a title. Brought
           up to comparable weight — same clamp floor/ceiling as
           Butterfly's label, same rough opacity — while keeping the
           italic/green identity that's orbiter's own, not Butterfly's. */
        font-size: clamp(0.85rem, 2.3vw, 1.5rem); letter-spacing: 0.08em;
        font-style: italic; white-space: nowrap;
        color: rgba(165,255,205,0.8);
        text-shadow: 0 0 16px rgba(120,255,180,0.35);
      }
      #orbiter-hint {
        top: 4.5rem; right: 1.2rem; font-size: 0.55rem; letter-spacing: 0.2em;
        text-transform: uppercase; line-height: 1.8; text-align: right;
        color: rgba(255,255,255,0.3);
      }
      @media (max-width: 600px) {
        #orbiter-caption { white-space: normal; width: 88vw; font-size: 0.7rem; }
      }
      #orbiter-panel {
        position: absolute; top: 0; right: 0; width: 38%; height: 100%;
        background: #060a07; border-left: 1px solid rgba(160,255,200,0.15);
        padding: 3rem 2rem; transform: translateX(100%);
        transition: transform .5s cubic-bezier(.16,1,.3,1);
        overflow-y: scroll; z-index: 10;
        scrollbar-color: rgba(160,255,200,0.3) #060a07; scrollbar-width: thin;
        font-family: 'Times New Roman', serif;
      }
      #orbiter-panel.open { transform: translateX(0); }
      #orbiter-panel-title {
        font-size: 0.95rem; letter-spacing: 0.2em; text-transform: uppercase;
        color: rgba(190,255,210,0.8);
        /* No more separate #orbiter-panel-source line below this (moved to the
           colophon's bibliography) — the border/padding it used to carry
           now sits directly under the title instead. */
        border-bottom: 1px solid rgba(160,255,200,0.15);
        padding-bottom: 1.4rem; margin-bottom: 1.6rem;
      }
      #orbiter-panel-content { color: rgba(210,235,220,0.75); font-size: 0.98rem; line-height: 1.85; }
      #orbiter-panel-content p { margin: 0 0 1.4rem; }
      /* Poem cross-links, 2026-07-17 — same mechanism as sphere.js's
         fragment-links (see its own panelStyle comment) and scroll.js's
         scroll-link, tuned to orbiter's own green/white palette instead of sphere's
         blue. A phrase glimmers faintly on its own, on a long slow loop, so
         it reads as something ambient in the text rather than a UI
         affordance shouting for attention; hover/focus stops the glimmer
         and lights it up gold to invite the click. */
      @keyframes poem-glimmer {
        0%, 85%, 100% { color: inherit; text-shadow: none; }
        92% { color: rgba(200,255,220,.35); text-shadow: 0 0 6px rgba(200,255,220,.15); }
      }
      .poem-link {
        color: inherit; text-decoration: none; border-bottom: none; cursor: default;
        transition: color .2s; animation: poem-glimmer 12s ease-in-out infinite;
      }
      .poem-link:hover, .poem-link:focus {
        color: rgba(255,230,150,.95); cursor: pointer; animation: none;
        text-shadow: 0 0 12px rgba(255,230,150,.3);
      }
      @media (prefers-reduced-motion: reduce) { .poem-link { animation: none; } }
      #orbiter-panel-close {
        position: absolute; top: 1.5rem; right: 1.5rem; background: none;
        border: none; color: rgba(255,255,255,0.4); font-size: 1.2rem;
        cursor: pointer; padding: .5rem; z-index: 2;
      }
      #orbiter-panel-close:hover { color: rgba(255,255,255,0.9); }
      @media (max-width: 700px) {
        #orbiter-panel { width: 88%; padding: 4rem 1.3rem 2rem; }
      }
    `;
    document.head.appendChild(style);
  }
  if (!preview) {
    caption = document.createElement('p');
    caption.id = 'orbiter-caption';
    // Epigraph, uncredited in-scene by design — full attribution (Richard
    // Kenney, "The Invention of the Zero") now lives in the colophon's
    // bibliography instead, same as every poem's source line below.
    caption.textContent = 'sing, orbiter';
    caption.setAttribute('aria-hidden', 'true');
    document.body.appendChild(caption);

    hint = document.createElement('p');
    hint.id = 'orbiter-hint';
    hint.innerHTML = 'drag to orbit &nbsp;·&nbsp; click a satellite to read a poem &nbsp;·&nbsp; click the nucleus to look inside';
    hint.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hint);

    panel = document.createElement('aside');
    panel.id = 'orbiter-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'orbiter-panel-title');
    panel.innerHTML = `
      <button type="button" id="orbiter-panel-close" aria-label="Close panel">✕</button>
      <div id="orbiter-panel-title" tabindex="-1"></div>
      <div id="orbiter-panel-content"></div>
    `;
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.appendChild(panel);
    panelTitle   = panel.querySelector('#orbiter-panel-title');
    panelContent = panel.querySelector('#orbiter-panel-content');

    panelCloser = createPanelCloser(panel, container, {
      closeBtn: panel.querySelector('#orbiter-panel-close'),
      onClose: () => { selectedSat = null; },
    });

    panelContent.addEventListener('click', e => {
      const link = e.target.closest('.poem-link');
      if (!link) return;
      e.stopPropagation();
      navigateToPoem(link);
    });
    panelContent.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const link = e.target.closest('.poem-link');
      if (!link) return;
      e.preventDefault();
      e.stopPropagation();
      navigateToPoem(link);
    });

    // Keyboard access, 2026-07-26: satellites are otherwise raycast-only —
    // no keyboard equivalent existed for "point at a satellite" — so a
    // keyboard-only visitor could orbit the scene but never actually read a
    // poem. One button per satellite, calling the exact same
    // selectedSat-then-openPoem() beat the mouse click below already does.
    // 2026-07-29: the nucleus is now a second raycast-only interaction, so
    // it gets a button in this exact same list rather than a separate
    // mechanism — one more <li> in the same jump list, not new UI chrome.
    const NUCLEUS_JUMP_ITEM = {};
    jumpList = createJumpList(container, {
      label: 'Read a poem from one of the satellites, or look inside the nucleus',
      items: [...satellites.sats, NUCLEUS_JUMP_ITEM],
      getLabel: item => item === NUCLEUS_JUMP_ITEM ? 'Look inside the nucleus' : poems[item.poemIndex].title,
      onSelect: item => {
        if (item === NUCLEUS_JUMP_ITEM) { toggleNucleusDetail(); return; }
        selectedSat = item; openPoem(item);
      },
    });
  }

  // ─── Satellite hover/click → poem panel, same raycast pattern as the
  // orrery's control box and sphere's facets. ───────────────────────────
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredSat = null, selectedSat = null, hoveredNucleus = false;
  // Named so dispose() can remove them — container is the shared
  // #experience-container element every scene reuses (main.js only clears
  // its innerHTML between scenes, never replaces the node), so a listener
  // bound directly to it and never removed keeps firing after this scene
  // is gone, reading stale closures against a disposed scene.
  let onContainerMouseMove = null, onContainerClick = null;

  // A stanza can carry more than one live link (DNA's single stanza has
  // two), so this walks every POEM_LINKS entry for that stanza rather than
  // stopping at the first match the way scroll.js's per-paragraph
  // LINKS/RUBRICS/INTENSITIES lookups do — those never needed more than one
  // hit per paragraph, this does.
  function renderStanza(title, index, text) {
    let html = escapeHtml(text);
    POEM_LINKS.filter(l => l.title === title && l.stanza === index).forEach(link => {
      const esc = escapeHtml(link.phrase);
      html = html.replace(esc, `<a class="poem-link" data-target="${escapeHtml(link.target)}" role="link" tabindex="0">${esc}</a>`);
    });
    return html.replace(/\n/g, '<br>');
  }
  function renderPoemInto(poem) {
    panelTitle.textContent = poem.title;
    panelContent.innerHTML = poem.stanzas
      .map((st, i) => `<p>${renderStanza(poem.title, i, st)}</p>`)
      .join('');
    panelContent.scrollTop = 0;
    // Stagger glimmer delays + a11y attributes, same treatment as sphere's
    // fragment-links on open/navigate.
    panelContent.querySelectorAll('.poem-link').forEach(link => {
      const delay = (Math.random() * 12).toFixed(1);
      const duration = (9 + Math.random() * 7).toFixed(1);
      link.style.animationDelay = `-${delay}s`;
      link.style.animationDuration = `${duration}s`;
      link.setAttribute('role', 'button');
      link.setAttribute('tabindex', '0');
      link.setAttribute('aria-label', `Follow the echo to: ${link.dataset.target}`);
    });
  }
  function openPoem(sat) {
    const poem = poems[sat.poemIndex];
    if (!panel || !poem) return;
    renderPoemInto(poem);
    panel.classList.add('open');
    setTimeout(() => panelTitle.focus(), 50);
  }
  // Poem link navigation — follow the threads (click + keyboard), same
  // fade-out/swap-content/fade-in beat as sphere's navigateToFragment.
  // Deliberately doesn't touch selectedSat/the satellite the panel was
  // opened from — sphere's own navigateToFragment leaves the clicked
  // facet's highlight alone too, same precedent.
  function navigateToPoem(link) {
    const targetIdx = poems.findIndex(p => p.title === link.dataset.target);
    if (targetIdx === -1) return;
    panelContent.style.transition = 'opacity .18s';
    panelTitle.style.transition = 'opacity .18s';
    panelContent.style.opacity = '0';
    panelTitle.style.opacity = '0';
    setTimeout(() => {
      renderPoemInto(poems[targetIdx]);
      panelContent.style.opacity = '1';
      panelTitle.style.opacity = '1';
    }, 180);
  }

  // Toggles the nucleus between its plain collapsed sphere and its
  // internal proton/neutron/quark detail — see buildNucleusDetail's own
  // header comment for what that detail actually is. Lazily builds the
  // detail group on the first call only; every call after that just
  // flips nucleusRevealed, and animate() eases nucleusRevealT toward
  // whichever state that's currently set to.
  function toggleNucleusDetail() {
    if (!nucleusDetail) {
      nucleusDetail = buildNucleusDetail(preview);
      root.add(nucleusDetail.group);
    }
    nucleusRevealed = !nucleusRevealed;
  }

  if (!preview) {
    onContainerMouseMove = e => {
      const rect = container.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      // One combined raycast against satellites' hit spheres and the
      // nucleus's own hit sphere — intersectObjects already returns hits
      // sorted nearest-first, so whichever of the two is actually closer
      // to the camera wins if they ever overlapped (they don't in
      // practice: the nucleus sits at the very center, satellites orbit
      // no closer than radius 1.35).
      const hits = raycaster.intersectObjects([...satellites.sats.map(s => s.hit), nucleusHit]);
      const hit = hits[0]?.object;
      const hitSat = hit ? satellites.sats.find(s => s.hit === hit) : null;
      const hitNucleus = hit === nucleusHit;
      if (hitSat !== hoveredSat) {
        if (hoveredSat) hoveredSat.beaconMat.color.setHex(0x9fffc8);
        hoveredSat = hitSat;
        if (hoveredSat) hoveredSat.beaconMat.color.setHex(0xffffff);
      }
      if (hitNucleus !== hoveredNucleus) {
        hoveredNucleus = hitNucleus;
        // Brightens on hover — same idiom the orrery's own poster hover
        // already uses (emissiveIntensity bump), not a new one.
        mat.emissiveIntensity = hoveredNucleus ? NUCLEUS_BASE_EMISSIVE * 1.8 : NUCLEUS_BASE_EMISSIVE;
      }
      container.style.cursor = (hoveredSat || hoveredNucleus) ? 'pointer' : 'default';
    };
    container.addEventListener('mousemove', onContainerMouseMove);
    onContainerClick = e => {
      // Was `panel.classList.contains('open') && !panel.contains(e.target)`
      // — closed the panel on any canvas click while open, even one that
      // hit a different satellite (hoveredSat is tracked live by mousemove
      // above regardless of panel state). Fixed 2026-07-23, same root
      // cause as library.js's identical bug: only close on an actual
      // empty-space click. hoveredNucleus gets the same treatment now it's
      // a second real click target — clicking the nucleus while the poem
      // panel happens to be open should toggle the nucleus, not also (or
      // instead) close the panel.
      if (panel.classList.contains('open') && !hoveredSat && !hoveredNucleus) {
        panelCloser.close();
        return;
      }
      if (hoveredNucleus) { toggleNucleusDetail(); return; }
      if (!hoveredSat) return;
      selectedSat = hoveredSat;
      openPoem(selectedSat);
    };
    container.addEventListener('click', onContainerClick);
  }

  // ─── Drag to orbit (mouse + touch, via sceneKit) ────────────────────────
  let autoRotate = true;
  const orbitDrag = bindOrbitDrag(container, {
    onDragStart: () => { autoRotate = false; },
    onDrag: (dx, dy) => {
      root.rotation.y += dx;
      root.rotation.x += dy;
    },
    onDragEnd: () => { setTimeout(() => { autoRotate = true; }, 2500); },
  });

  // Reduced motion: gates the autonomous rotation below (nucleus spin,
  // orbital-cloud precession + particle drift, satellite orbits, orbiter
  // auto-rotate). Drag-to-orbit stays available regardless — that's
  // motion the visitor asks for, not motion imposed on them.
  const reduceMotion = prefersReducedMotion();

  const cloudPosAttr = aurorae.geo.attributes.position;

  // ─── Animate ──────────────────────────────────────────────────────────────
  let animId, t = 0;
  function animate() {
    animId = requestAnimationFrame(animate);
    t += 0.01;

    if (!reduceMotion) {
      earth.rotation.y = t * (preview ? 0.06 : 0.03);
      // Slow precession of the whole p-orbital cloud, distinct from the
      // nucleus's own spin and the satellites' independent orbits — keeps
      // the dumbbell shape from ever settling into one static silhouette.
      aurorae.group.rotation.y = t * 0.008;
      satellites.sats.forEach(s => {
        s.pivot.rotation.y += s.speed * 0.01;
      });
      if (autoRotate && !orbitDrag.isDragging) {
        root.rotation.y += preview ? 0.0015 : 0.0005;
      }

      // Per-particle drift/shimmer — each point nudges along its own fixed
      // direction on its own sine wave, so the cloud reads as gently alive
      // rather than a static point cloud, per the brief's explicit ask.
      for (let i = 0; i < aurorae.count; i++) {
        const d = aurorae.drift[i];
        const s = Math.sin(t * d.speed + d.phase) * d.amp;
        const i3 = i * 3;
        cloudPosAttr.array[i3]     = aurorae.base[i3]     + d.dx * s;
        cloudPosAttr.array[i3 + 1] = aurorae.base[i3 + 1] + d.dy * s;
        cloudPosAttr.array[i3 + 2] = aurorae.base[i3 + 2] + d.dz * s;
      }
      cloudPosAttr.needsUpdate = true;
    }

    // A slow overall shimmer on top of the per-particle drift — the whole
    // cloud's brightness breathes gently, same beat the old aurora bands
    // used to pulse on.
    aurorae.phase += 0.012;
    aurorae.mat.opacity = Math.max(0.5, aurorae.baseOpacity + Math.sin(aurorae.phase) * 0.15);

    // ─── Nucleus reveal/collapse ────────────────────────────────────────
    // The fade itself is a direct response to a click (toggleNucleusDetail
    // above flips nucleusRevealed; this eases toward whichever state that
    // now is) — same as the poem panel's own slide transition, so it runs
    // regardless of reduced motion. Only the continuous quark jitter/
    // shimmer pulse further down is autonomous decorative motion, gated
    // the same way the orbital cloud's own drift is above.
    nucleusRevealT += ((nucleusRevealed ? 1 : 0) - nucleusRevealT) * 0.08;
    mat.opacity = 1 - nucleusRevealT;
    earth.visible = nucleusRevealT < 0.995;
    if (nucleusDetail) {
      nucleusDetail.group.visible = nucleusRevealT > 0.005;
      if (nucleusDetail.group.visible) {
        nucleusDetail.nucleons.forEach(n => {
          n.mat.opacity = 0.75 * nucleusRevealT;
          n.quarks.forEach(q => {
            q.mat.opacity = nucleusRevealT;
            if (!reduceMotion) {
              q.jitterPhase += 0.02 * q.jitterSpeed;
              const s = Math.sin(q.jitterPhase) * q.jitterAmp;
              q.mesh.position.set(
                q.base.x + q.jitterDir.x * s,
                q.base.y + q.jitterDir.y * s,
                q.base.z + q.jitterDir.z * s
              );
            }
          });
          n.shimmerLines.forEach(l => {
            if (!reduceMotion) l.phase += 0.03 * l.speed;
            // Ongoing exchange, not a fixed glow — oscillates between a
            // dim and a bright state on its own independent phase, same
            // "never resolving into something more solid" the header
            // comment on buildNucleusDetail calls for.
            const pulse = 0.3 + 0.55 * (0.5 + 0.5 * Math.sin(l.phase));
            l.mat.opacity = pulse * nucleusRevealT;
            // Endpoints follow the (possibly jittering) quarks each frame.
            const qa = n.quarks[l.a], qb = n.quarks[l.b];
            const posAttr = l.geo.attributes.position;
            posAttr.setXYZ(0, qa.mesh.position.x, qa.mesh.position.y, qa.mesh.position.z);
            posAttr.setXYZ(1, qb.mesh.position.x, qb.mesh.position.y, qb.mesh.position.z);
            posAttr.needsUpdate = true;
          });
        });
      }
    }

    renderer.render(scene, camera);
  }
  animate();

  const resize = bindGuardedResize(container, (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  return {
    dispose() {
      cancelAnimationFrame(animId);
      orbitDrag.dispose();
      resize.dispose();
      panelCloser?.dispose();
      if (onContainerMouseMove) container.removeEventListener('mousemove', onContainerMouseMove);
      if (onContainerClick) container.removeEventListener('click', onContainerClick);
      renderer.dispose();
      geo.dispose(); mat.dispose(); nucleusTex.dispose();
      nucleusHit.geometry.dispose(); nucleusHitMat.dispose();
      if (nucleusDetail) {
        nucleusDetail.nucleons.forEach(n => {
          n.geo.dispose(); n.mat.dispose(); n.dotTex.dispose();
          n.quarks.forEach(q => { q.geo.dispose(); q.mat.dispose(); });
          n.shimmerLines.forEach(l => { l.geo.dispose(); l.mat.dispose(); });
        });
      }
      starGeo.dispose(); starMat.dispose();
      aurorae.geo.dispose(); aurorae.mat.dispose(); aurorae.dotTex.dispose();
      satellites.sats.forEach(s => {
        s.ringMat.dispose();
        s.ringGeo.dispose();
        s.hit.geometry.dispose();
        s.beacon.geometry.dispose();
        s.beaconMat.dispose();
      });
      satellites.bodyMat.dispose();
      satellites.panelMat.dispose();
      satellites.hitMat.dispose();
      satellites.coreGeo.dispose();
      satellites.panelGeo.dispose();
      if (caption) caption.remove();
      if (hint) hint.remove();
      if (panel) panel.remove();
      jumpList?.dispose();
      renderer.domElement.remove();
    }
  };
}
