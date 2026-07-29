import * as THREE from 'three';
import { poems } from '../text/poems.js';
import { bindOrbitDrag, bindGuardedResize, prefersReducedMotion, createPanelCloser, createJumpList, escapeHtml } from '../utils/sceneKit.js';

// ─── Poem cross-links, 2026-07-17 ──────────────────────────────────────────
// Same mechanism, and the same rule, as the geodesic sphere's facet-to-
// fragment links in sphere.js and the scroll's LINKS in manuscript.js: only
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
// Each lobe is a swarm of small additive points sampled, not placed by
// hand, from a simple artistic stand-in for a real 2p-orbital's
// probability density: `t`, the fraction of the way out along the lobe's
// own axis, is drawn as the *average of two independent random numbers* —
// a triangular distribution that is exactly zero at t=0 (the nodal plane,
// right at the nucleus, where a real p-orbital's density is genuinely
// zero) and zero again at t=1 (the lobe's own outer fringe), peaking at
// t=0.5. That one distribution does double duty: it's used directly for
// how far out a particle sits, and it drives a parabola (also zero at
// both ends) for how wide the lobe is allowed to be at that same point —
// together they produce a teardrop with density falling off gradually in
// every direction and no boundary surface anywhere, satisfying the brief's
// "no hard edge" requirement by construction rather than by tuning opacity
// after the fact.
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
  const LOBE_LENGTH = 1.15; // sits comfortably inside the satellites' own orbit radii (1.35+)
  const GIRTH_MAX = 0.5;

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

  for (let i = 0; i < count; i++) {
    const lobeSign = i < count / 2 ? 1 : -1;
    const t = (Math.random() + Math.random()) / 2; // triangular 0..1, peak at 0.5
    const axial = lobeSign * t * LOBE_LENGTH;
    const girth = GIRTH_MAX * 4 * t * (1 - t); // parabola, zero at t=0 and t=1
    const phi = Math.random() * Math.PI * 2;
    const perpFrac = Math.random() * Math.random(); // skewed toward the lobe's own core axis
    const perpR = girth * perpFrac;
    const x = perpR * Math.cos(phi);
    const z = perpR * Math.sin(phi);

    base[i * 3] = x; base[i * 3 + 1] = axial; base[i * 3 + 2] = z;
    positions[i * 3] = x; positions[i * 3 + 1] = axial; positions[i * 3 + 2] = z;

    // Brightness weighted by the same density term, so particles near
    // each lobe's own middle read hotter than the ones trailing off
    // toward the node or the outer fringe — on top of what sheer overlap
    // density under additive blending already does for free.
    const dens = 0.45 + 0.55 * (4 * t * (1 - t));
    const col = lobeSign > 0 ? colorPos : colorNeg;
    colors[i * 3] = col.r * dens; colors[i * 3 + 1] = col.g * dens; colors[i * 3 + 2] = col.b * dens;

    // Slow drift/shimmer per particle, not a static point cloud: a fixed
    // random direction (normalized) each particle nudges along, at its
    // own phase and speed, so the swarm reads as gently alive rather than
    // frozen — closer to butterfly.js's per-particle damped-velocity
    // drift in spirit, though the underlying math here is simpler since
    // there's no physical simulation to run, just an oscillation.
    let dx = Math.random() * 2 - 1, dy = Math.random() * 2 - 1, dz = Math.random() * 2 - 1;
    const dl = Math.hypot(dx, dy, dz) || 1;
    dx /= dl; dy /= dl; dz /= dl;
    drift.push({
      dx, dy, dz,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.5,
      amp: 0.015 + Math.random() * 0.02,
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
  const trailMat = new THREE.LineBasicMaterial({
    color: 0xffe08a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false,
  });

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
    const coreGeo = new THREE.BoxGeometry(0.026, 0.026, 0.026);
    body.add(new THREE.Mesh(coreGeo, bodyMat));
    const panelGeo = new THREE.PlaneGeometry(0.09, 0.026);
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
      ringMat,
      poemIndex: (i + poemOffset) % poems.length,
    });
  }

  return { group, sats, bodyMat, panelMat, hitMat, trailMat };
}

export function createEgg(container, { preview = false } = {}) {
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
  const mat = new THREE.MeshStandardMaterial({
    map: nucleusTex,
    emissive: 0xffb060,
    emissiveIntensity: 0.55,
    roughness: 0.6,
  });
  const earth = new THREE.Mesh(geo, mat);
  root.add(earth);

  // ─── p-orbital cloud + satellites ───────────────────────────────────────
  const aurorae = buildOrbitalCloud(preview);
  root.add(aurorae.group);

  const satellites = buildSatellites(preview);
  root.add(satellites.group);

  // ─── Caption + hint + poem panel (full only) ────────────────────────────
  let caption = null, hint = null, panel = null, panelTitle = null, panelContent = null, panelCloser = null, jumpList = null;
  if (!preview && !document.getElementById('egg-styles')) {
    const style = document.createElement('style');
    style.id = 'egg-styles';
    style.textContent = `
      /* z-index must clear #experience-overlay (styles/main.css: fixed,
         z-index:300) — appended to document.body, outside that overlay,
         same reasoning as orrery.js's hint/caption/title fix. */
      #egg-caption, #egg-hint {
        position: fixed; color: rgba(255,255,255,0.35);
        pointer-events: none; text-align: center; z-index: 310;
        font-family: 'Times New Roman', serif;
      }
      #egg-caption {
        bottom: 3rem; left: 50%; transform: translateX(-50%);
        /* Design pass, 2026-07-29 — Scott: nothing in the scene signalled
           there was text content here at all, unlike Butterfly's own
           title/date label (#butterfly-exp-label in main.js: clamp
           .85-1.6rem, opacity .85). This carried the epigraph
           ("sing, orbiter," Richard Kenney) the whole time but at a size
           and opacity that read as ambient chrome, not a title. Brought
           up to comparable weight — same clamp floor/ceiling as
           Butterfly's label, same rough opacity — while keeping the
           italic/green identity that's egg's own, not Butterfly's. */
        font-size: clamp(0.85rem, 2.3vw, 1.5rem); letter-spacing: 0.08em;
        font-style: italic; white-space: nowrap;
        color: rgba(165,255,205,0.8);
        text-shadow: 0 0 16px rgba(120,255,180,0.35);
      }
      #egg-hint {
        top: 4.5rem; right: 1.2rem; font-size: 0.55rem; letter-spacing: 0.2em;
        text-transform: uppercase; line-height: 1.8; text-align: right;
        color: rgba(255,255,255,0.3);
      }
      @media (max-width: 600px) {
        #egg-caption { white-space: normal; width: 88vw; font-size: 0.7rem; }
      }
      #egg-panel {
        position: absolute; top: 0; right: 0; width: 38%; height: 100%;
        background: #060a07; border-left: 1px solid rgba(160,255,200,0.15);
        padding: 3rem 2rem; transform: translateX(100%);
        transition: transform .5s cubic-bezier(.16,1,.3,1);
        overflow-y: scroll; z-index: 10;
        scrollbar-color: rgba(160,255,200,0.3) #060a07; scrollbar-width: thin;
        font-family: 'Times New Roman', serif;
      }
      #egg-panel.open { transform: translateX(0); }
      #egg-panel-title {
        font-size: 0.95rem; letter-spacing: 0.2em; text-transform: uppercase;
        color: rgba(190,255,210,0.8);
        /* No more separate #egg-panel-source line below this (moved to the
           colophon's bibliography) — the border/padding it used to carry
           now sits directly under the title instead. */
        border-bottom: 1px solid rgba(160,255,200,0.15);
        padding-bottom: 1.4rem; margin-bottom: 1.6rem;
      }
      #egg-panel-content { color: rgba(210,235,220,0.75); font-size: 0.98rem; line-height: 1.85; }
      #egg-panel-content p { margin: 0 0 1.4rem; }
      /* Poem cross-links, 2026-07-17 — same mechanism as sphere.js's
         fragment-links (see its own panelStyle comment) and manuscript.js's
         ms-link, tuned to egg's own green/white palette instead of sphere's
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
      #egg-panel-close {
        position: absolute; top: 1.5rem; right: 1.5rem; background: none;
        border: none; color: rgba(255,255,255,0.4); font-size: 1.2rem;
        cursor: pointer; padding: .5rem; z-index: 2;
      }
      #egg-panel-close:hover { color: rgba(255,255,255,0.9); }
      @media (max-width: 700px) {
        #egg-panel { width: 88%; padding: 4rem 1.3rem 2rem; }
      }
    `;
    document.head.appendChild(style);
  }
  if (!preview) {
    caption = document.createElement('p');
    caption.id = 'egg-caption';
    // Epigraph, uncredited in-scene by design — full attribution (Richard
    // Kenney, "The Invention of the Zero") now lives in the colophon's
    // bibliography instead, same as every poem's source line below.
    caption.textContent = 'sing, orbiter';
    caption.setAttribute('aria-hidden', 'true');
    document.body.appendChild(caption);

    hint = document.createElement('p');
    hint.id = 'egg-hint';
    hint.innerHTML = 'drag to orbit &nbsp;·&nbsp; click a satellite to read a poem';
    hint.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hint);

    panel = document.createElement('aside');
    panel.id = 'egg-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'egg-panel-title');
    panel.innerHTML = `
      <button type="button" id="egg-panel-close" aria-label="Close panel">✕</button>
      <div id="egg-panel-title" tabindex="-1"></div>
      <div id="egg-panel-content"></div>
    `;
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.appendChild(panel);
    panelTitle   = panel.querySelector('#egg-panel-title');
    panelContent = panel.querySelector('#egg-panel-content');

    panelCloser = createPanelCloser(panel, container, {
      closeBtn: panel.querySelector('#egg-panel-close'),
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
    // keyboard-only visitor could orbit the egg but never actually read a
    // poem. One button per satellite, calling the exact same
    // selectedSat-then-openPoem() beat the mouse click below already does.
    jumpList = createJumpList(container, {
      label: 'Read a poem from one of the satellites',
      items: satellites.sats,
      getLabel: sat => poems[sat.poemIndex].title,
      onSelect: sat => { selectedSat = sat; openPoem(sat); },
    });
  }

  // ─── Satellite hover/click → poem panel, same raycast pattern as the
  // orrery's control box and sphere's facets. ───────────────────────────
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredSat = null, selectedSat = null;
  // Named so dispose() can remove them — container is the shared
  // #experience-container element every scene reuses (main.js only clears
  // its innerHTML between scenes, never replaces the node), so a listener
  // bound directly to it and never removed keeps firing after this scene
  // is gone, reading stale closures against a disposed scene.
  let onContainerMouseMove = null, onContainerClick = null;

  // A stanza can carry more than one live link (DNA's single stanza has
  // two), so this walks every POEM_LINKS entry for that stanza rather than
  // stopping at the first match the way manuscript.js's per-paragraph
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

  if (!preview) {
    onContainerMouseMove = e => {
      const rect = container.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(satellites.sats.map(s => s.hit));
      const hitSat = hits.length ? satellites.sats.find(s => s.hit === hits[0].object) : null;
      if (hitSat !== hoveredSat) {
        if (hoveredSat) hoveredSat.beaconMat.color.setHex(0x9fffc8);
        hoveredSat = hitSat;
        if (hoveredSat) hoveredSat.beaconMat.color.setHex(0xffffff);
      }
      container.style.cursor = hoveredSat ? 'pointer' : 'default';
    };
    container.addEventListener('mousemove', onContainerMouseMove);
    onContainerClick = e => {
      // Was `panel.classList.contains('open') && !panel.contains(e.target)`
      // — closed the panel on any canvas click while open, even one that
      // hit a different satellite (hoveredSat is tracked live by mousemove
      // above regardless of panel state). Fixed 2026-07-23, same root
      // cause as library.js's identical bug: only close on an actual
      // empty-space click.
      if (panel.classList.contains('open') && !hoveredSat) {
        panelCloser.close();
        return;
      }
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
  // orbital-cloud precession + particle drift, satellite orbits, egg
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
      starGeo.dispose(); starMat.dispose();
      aurorae.geo.dispose(); aurorae.mat.dispose(); aurorae.dotTex.dispose();
      satellites.sats.forEach(s => {
        s.ringMat.dispose();
        s.hit.geometry.dispose();
        s.beacon.geometry.dispose();
        s.beaconMat.dispose();
      });
      satellites.bodyMat.dispose();
      satellites.panelMat.dispose();
      satellites.hitMat.dispose();
      satellites.trailMat.dispose();
      if (caption) caption.remove();
      if (hint) hint.remove();
      if (panel) panel.remove();
      jumpList?.dispose();
      renderer.domElement.remove();
    }
  };
}
