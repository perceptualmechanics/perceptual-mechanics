import * as THREE from 'three';
import { bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion, createPanelCloser, createJumpList, mountClippedPreviewCanvas, bindTapVsDrag, parseHTML } from '../../utils/sceneKit.js';
import './orrery.css';
import orreryHtml from './orrery.html?raw';
// The found story lives alongside this scene (orrery.text.js) — shared with
// the prerender step that builds /text/orrery/, so the placard and the
// published page can't drift.
import { ORRERY } from './orrery.text.js';
import { createGroundGlimpse, wireResonanceThread } from '../../utils/constellationEntry.js';

// ─── The Orrery of Los Feliz ───────────────────────────────────────────────
// A found short-short, full and unedited, undated. Investigators track a
// mysterious 30-foot orrery — a moving model of the solar system, a working
// radio telescope at its peak — to a warehouse in Los Feliz.
//
// The scene grounds this as junk-metal, Survival Research Labs-style
// construction rather than a free-floating sci-fi prop: the whole
// mechanism hangs from chains bolted to the roof trusses rather than
// standing on the floor (a machine installed by a crew who had a hoist
// and a warehouse ceiling, not a foundation crew), the walls carry a few
// taped-up early-90s show flyers (Nirvana, R.E.M., For Squirrels — dating
// the space itself, not just the machine), and the nine bodies are the
// actual planets: correct order, roughly-correct relative sizes and
// orbital spacing (compressed with a square root so Mercury and Pluto
// both fit on screen), their real notable moons, Saturn's rings, and the
// asteroid belt sitting where it actually does — between Mars and
// Jupiter, not stuck out past Pluto. The "few other unidentified cosmic
// objects" from the text read as what's left after naming nine real
// planets: the odd stuff further out, past Pluto.


// Real planets, in order. `au` (semi-major axis, real units) drives orbital
// spacing; `relDiameter` (Earth = 1) drives body size. Both are compressed
// with a square root before being mapped to screen units — used at real
// scale, Mercury and Pluto can't share a small scene at all.
// Colors match a print Scott owns — a minimalist "The Solar System" poster,
// flat bold color per planet against dark slate green. Applied here as a
// spray-paint job over bronze bodies (see makeSprayPaintTexture) rather than
// the poster's own clean flat fills — junk-metal orrery, not a print. That
// paint job is decades old by the time a visitor sees it, per the found
// text ("great bronze balls... painted a most royal purple," found still
// hanging, mid-motion, in a warehouse) — see the "Planet-body aging" block
// above buildAgedPlanetGeometry for the worn-paint/patina/seam-grime pass
// built on top of this base texture.
// ─── Real solar-system data vs. deliberate visual compression ───────────
// `au` here is the real semi-major axis (average orbital distance from
// the sun) of each planet in astronomical units (1 AU = Earth's own
// distance from the sun) — genuine solar-system data, STRUCTURAL, not
// invented or stylized for this scene. Same for `relDiameter` (each
// planet's real diameter relative to Earth's). What IS a deliberate
// visual choice, applied later where these values get used (see the
// sqrtAU/sqrtDia compression below), is how those real ratios get
// squeezed down to fit one small room — the underlying numbers
// themselves are just the actual solar system.
// e (orbital eccentricity) and m0Deg (mean anomaly at the J2000.0 epoch,
// in degrees) are real values — JPL/Meeus low-precision elements, mean
// anomaly derived as M0 = L - ϖ (mean longitude minus longitude of
// perihelion) at J2000. Used by buildOrrery's Keplerian orbit math (see
// keplerOrbitPosition) — real eccentricities kept as-is rather than
// exaggerated for legibility (see that comment for the reasoning): most
// planets' orbits really are nearly circular, and that's worth showing
// honestly rather than papering over; Mercury and Pluto (also,
// conveniently, the innermost and outermost rings) are eccentric enough
// in reality to read clearly at a glance, which is real physics doing the
// work of visual variety on its own, not something added for effect.
const PLANET_DATA = [
  { name: 'Mercury', color: 0xe0447a, au: 0.39, relDiameter: 0.38, moons: [], e: 0.2056, m0Deg: 174.79 },
  { name: 'Venus',   color: 0x9974c9, au: 0.72, relDiameter: 0.95, moons: [], e: 0.0068, m0Deg: 50.45 },
  { name: 'Earth',   color: 0x35c4d4, au: 1.00, relDiameter: 1.00, moons: [{ relSize: 0.27 }], e: 0.0167, m0Deg: 357.52 },
  { name: 'Mars',    color: 0xe35440, au: 1.52, relDiameter: 0.53, moons: [{ relSize: 0.06 }, { relSize: 0.04 }], e: 0.0934, m0Deg: 19.41 },
  { name: 'Jupiter', color: 0xf0821f, au: 5.20, relDiameter: 11.2, moons: [{ relSize: 0.09 }, { relSize: 0.08 }, { relSize: 0.13 }, { relSize: 0.12 }], e: 0.0484, m0Deg: 19.65 },
  { name: 'Saturn',  color: 0xf0c020, au: 9.54, relDiameter: 9.45, moons: [{ relSize: 0.12 }], ring: true, e: 0.0542, m0Deg: 317.51 },
  { name: 'Uranus',  color: 0xa8cc32, au: 19.2, relDiameter: 4.0,  moons: [{ relSize: 0.03 }], e: 0.0472, m0Deg: 142.27 },
  { name: 'Neptune', color: 0xa8a284, au: 30.1, relDiameter: 3.88, moons: [{ relSize: 0.03 }], e: 0.0086, m0Deg: 259.91 },
  { name: 'Pluto',   color: 0xd9d0ba, au: 39.5, relDiameter: 0.18, moons: [{ relSize: 0.5 }], e: 0.2488, m0Deg: 14.86 },
];

// ─── Weathered-metal textures — canvas, not image assets, same rule as
// every other texture on this site. Base steel/rust, an optional pass of
// chipped royal-purple paint (the mast only — "painted a most royal
// purple"), and a bronze variant for the planets ("great bronze balls").
function makeMetalTexture({ base, rust, highlight, paint }) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const cx = c.getContext('2d');
  cx.fillStyle = base;
  cx.fillRect(0, 0, 128, 128);

  cx.globalAlpha = 0.18;
  cx.strokeStyle = highlight;
  for (let i = 0; i < 14; i++) {
    cx.lineWidth = 0.6 + Math.random() * 1.6;
    const x = Math.random() * 128;
    cx.beginPath();
    cx.moveTo(x, 0);
    cx.lineTo(x + (Math.random() - 0.5) * 18, 128);
    cx.stroke();
  }

  cx.globalAlpha = 0.4;
  cx.fillStyle = rust;
  for (let i = 0; i < 16; i++) {
    const bx = Math.random() * 128, by = Math.random() * 128, br = 3 + Math.random() * 9;
    cx.beginPath();
    cx.arc(bx, by, br, 0, Math.PI * 2);
    cx.fill();
  }

  if (paint) {
    cx.globalAlpha = 0.75;
    cx.fillStyle = paint;
    for (let i = 0; i < 9; i++) {
      const bx = Math.random() * 128, by = Math.random() * 128;
      const bw = 6 + Math.random() * 22, bh = 4 + Math.random() * 12;
      cx.beginPath();
      cx.ellipse(bx, by, bw, bh, Math.random() * Math.PI, 0, Math.PI * 2);
      cx.fill();
    }
  }

  cx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function steelMaterial(preview, repeat = 2) {
  const tex = makeMetalTexture({ base: '#39322b', rust: '#241e18', highlight: '#6d5c48' });
  tex.repeat.set(repeat, repeat);
  return new THREE.MeshStandardMaterial({ map: preview ? null : tex, color: preview ? 0x39322b : 0xffffff, roughness: 0.75, metalness: 0.55 });
}
function paintedMastMaterial(preview) {
  const tex = makeMetalTexture({ base: '#39322b', rust: '#241e18', highlight: '#6d5c48', paint: '#5b3a72' });
  tex.repeat.set(1, 3);
  return new THREE.MeshStandardMaterial({ map: preview ? null : tex, color: preview ? 0x4d3a5c : 0xffffff, roughness: 0.7, metalness: 0.5 });
}
function bronzeMaterial() {
  const tex = makeMetalTexture({ base: '#8a6438', rust: '#5a4022', highlight: '#d9ab6c' });
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.85 });
}

// A rattle-can paint job over a rust primer — not a clean flat fill, built
// from hundreds of tiny semi-transparent dabs so coverage is uneven (denser
// center, thinner and speckled toward the edge, same way a real spray can
// lays down color), plus a couple of gravity-drip streaks and a scatter of
// fine dark grit on top. Used for the planets — the print Scott's palette
// comes from uses flat vector fills; this is the same colors, but as if
// someone actually painted scrap-metal balls with them.
function makeSprayPaintTexture(hex) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const cx = c.getContext('2d');
  const col = new THREE.Color(hex);
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  const light = `${Math.min(255, Math.round(col.r * 255 + 60))},${Math.min(255, Math.round(col.g * 255 + 60))},${Math.min(255, Math.round(col.b * 255 + 60))}`;

  // Rust primer showing through at the very edges only — the base coat
  // below covers most of the ball, this just gives the rim something to
  // peek through.
  cx.fillStyle = '#332a22';
  cx.fillRect(0, 0, 128, 128);

  // Solid-ish base coat first, so the planet's actual color reads clearly
  // even from a distance — then the speckle passes on top add the
  // hand-sprayed unevenness without erasing the color itself.
  cx.fillStyle = `rgba(${rgb},0.92)`;
  cx.fillRect(0, 0, 128, 128);

  // Layered dabs, weighted toward the center of each "spray pass" so
  // coverage builds up unevenly — some lighter (thinner-coat) patches,
  // some darker/primer patches — rather than a flat, uniform fill.
  const passes = 6;
  for (let p = 0; p < passes; p++) {
    const cx0 = 20 + Math.random() * 88, cy0 = 20 + Math.random() * 88;
    const passRadius = 40 + Math.random() * 45;
    const lighten = Math.random() > 0.45;
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 1.4) * passRadius;
      const x = cx0 + Math.cos(a) * r, y = cy0 + Math.sin(a) * r;
      const alpha = (1 - r / passRadius) * (0.22 + Math.random() * 0.3);
      cx.fillStyle = lighten
        ? `rgba(${light},${Math.max(0, alpha) * 0.8})`
        : `rgba(${rgb},${Math.max(0, alpha)})`;
      cx.beginPath();
      cx.arc(x, y, 0.8 + Math.random() * 2.2, 0, Math.PI * 2);
      cx.fill();
    }
  }

  // A couple of gravity drips.
  cx.strokeStyle = `rgba(${rgb},0.6)`;
  for (let i = 0; i < 3; i++) {
    const x = 20 + Math.random() * 88;
    const y0 = 20 + Math.random() * 50;
    const len = 15 + Math.random() * 35;
    cx.lineWidth = 0.8 + Math.random() * 1.2;
    cx.beginPath();
    cx.moveTo(x, y0);
    cx.lineTo(x + (Math.random() - 0.5) * 4, y0 + len);
    cx.stroke();
  }

  // Fine grit, dark speckle on top — kept light so it reads as texture,
  // not as a haze that dulls the color back down.
  cx.globalAlpha = 0.18;
  for (let i = 0; i < 70; i++) {
    cx.fillStyle = Math.random() > 0.5 ? '#000000' : '#1a1a1a';
    cx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
  }
  cx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// ─── Planet-body aging: seamless 3D noise shared by geometry + texture ──
// "De-pristine the planets": the found text calls these "great bronze
// balls," painted, hanging in a warehouse for decades — the flat spray-
// paint job above reads as freshly made, not as a machine that's sat
// mostly still, occasionally bumped and handled, for that long. Patina,
// worn paint over bronze, irregular geometry, and seam grime should read
// as ONE material story rather than four separate effects layered on
// top of each other, so all four below share a single height field: a
// raised/exposed point on an object handled over decades wears its
// paint down to bare bronze and burnishes shiny in the process; a
// recessed/sheltered point never gets touched, so its paint survives but
// dust and tarnish settle into it instead. Both are opposite readings of
// the SAME field, not two unrelated noise sources — so the color,
// roughness, metalness, and emissive maps below, and the mesh
// displacement itself (buildAgedPlanetGeometry), all agree with each
// other about which points on the sphere are "high" and which are "low."
//
// That field has to be genuinely seamless across the whole sphere,
// including the UV wrap and both poles — a flat 2D (u,v) noise lookup
// creases visibly at u=0/u=1 and pinches at the poles. Feeding each
// point's own 3D unit direction into the noise instead sidesteps that
// entirely, since there's no wraparound edge in 3D space to begin with.
// Same deterministic lattice-hash value-noise technique as beamline.js's
// WILDERNESS_NOISE (own seeded hash, not Math.random, so a single seed
// reproduces an identical field wherever it's sampled again), extended
// from 2 dimensions to 3, with the same avalanche-mixing recipe
// (XOR-shift, multiply, XOR-shift) and structural constants as
// beamline.js's hash2, plus one more large odd multiplier for the third
// input.
function hash3(ix, iy, iz, seed) {
  let h = (ix * 374761393 + iy * 668265263 + iz * 2147483647 + seed * 2246822519) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}
function smoothstep01(t) { return t * t * (3 - 2 * t); }
// Trilinear interpolation between the 8 lattice-cell corners surrounding
// (x, y, z) — the 3D generalization of beamline.js's valueNoise2D.
function valueNoise3D(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = smoothstep01(x - ix), fy = smoothstep01(y - iy), fz = smoothstep01(z - iz);
  const c000 = hash3(ix, iy, iz, seed),         c100 = hash3(ix + 1, iy, iz, seed);
  const c010 = hash3(ix, iy + 1, iz, seed),     c110 = hash3(ix + 1, iy + 1, iz, seed);
  const c001 = hash3(ix, iy, iz + 1, seed),     c101 = hash3(ix + 1, iy, iz + 1, seed);
  const c011 = hash3(ix, iy + 1, iz + 1, seed), c111 = hash3(ix + 1, iy + 1, iz + 1, seed);
  const x00 = c000 + (c100 - c000) * fx, x10 = c010 + (c110 - c010) * fx;
  const x01 = c001 + (c101 - c001) * fx, x11 = c011 + (c111 - c011) * fx;
  const y0 = x00 + (x10 - x00) * fy, y1 = x01 + (x11 - x01) * fy;
  return y0 + (y1 - y0) * fz;
}
// Fractal Brownian motion — same octave-stacking as beamline.js's fbm:
// stack several frequencies of valueNoise3D so the result has broad
// blotchy shape (low-frequency, high-amplitude early octaves) with
// finer variation layered on top, instead of looking uniformly smooth.
function fbm3(x, y, z, seed, octaves = 4) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise3D(x * freq, y * freq, z * freq, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2.15;
  }
  return sum / norm; // 0..1
}
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function remap01(x, lo, hi) { return clamp01((x - lo) / (hi - lo)); }

// A pulse that genuinely never repeats within any practical viewing
// window, without reaching for Math.random() or any accumulated
// per-frame state: three sines at deliberately non-integer-ratio
// frequencies (1, the golden ratio PHI, and sqrt(2)*1.3 — none a clean
// multiple of another) summed with independent phases and weights. No
// two of the three share a common period, so the sum's own period is
// effectively infinite in practice — the same reasoning (and the same
// trick a synthesizer uses for a "breathing" pad or vibrato) as the FM
// phase math in the telescope's traveling pulse below. Still a pure,
// deterministic function of `clock` — same "fixed base state + function
// of time" rule as everything else in this file. Returns 0..1.
const PHI = 1.6180339887;
function organicPulse(clock, freq = 1) {
  const a = Math.sin(clock * freq);
  const b = Math.sin(clock * freq * PHI + 1.7);
  const c = Math.sin(clock * freq * Math.SQRT2 * 1.3 + 4.1);
  return (a * 0.5 + b * 0.32 + c * 0.18 + 1) / 2; // weights sum to 1, so the raw sum stays in [-1,1]
}

// ─── Real Keplerian orbital motion for the orrery's planets and moons ───
// (2.2.22). The orrery never stopped running — nobody was there to see
// it, but time kept passing — so a visit should show wherever the real
// mechanism has actually gotten to by now, not a reshuffled arrangement.
// That requires position to be a function of actual wall-clock time
// (Date.now(), real milliseconds since the Unix epoch), never
// performance.now() or any per-frame accumulated value: session time
// resets on every reload, so a position keyed to it would always start
// from the same configuration and the bug would be invisible within any
// single test session — it would only ever show up across genuinely
// separate visits, exactly the kind of mistake this is easy to make and
// hard to catch. orreryNowMs() is the one place that decision gets made;
// everything else in this section takes a `nowMs` parameter rather than
// calling Date.now() itself, so there's exactly one seam to check.
//
// __orreryTimeOverrideMs lets testing fast-forward or jump to an
// arbitrary date without waiting for real time to pass (set it from the
// console, e.g. `window.__orreryTimeOverrideMs = Date.now() + 86400000*30`
// to preview 30 days out) — the verification method this feature
// explicitly needs, since reloading twice in a row barely moves real time
// at all. Left in permanently (not stripped before shipping): harmless
// when unset, useful for real debugging later, and it's the only way
// anyone can practically confirm the elliptical shape or long-term
// configuration changes without waiting for actual months to pass.
function orreryNowMs() {
  return (typeof window !== 'undefined' && typeof window.__orreryTimeOverrideMs === 'number')
    ? window.__orreryTimeOverrideMs
    : Date.now();
}

const J2000_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0); // J2000.0 — the standard epoch PLANET_DATA's m0Deg values are anchored to
// TUNABLE: real orbital periods span ~0.24 years (Mercury) to ~248 years
// (Pluto) — direct real time would make Mercury take 88 real days per
// orbit and Pluto effectively motionless for any viewing session. One
// global multiplier compresses this onto a human-watchable timescale
// without disturbing Kepler's third law at all (uniform scaling preserves
// ratios exactly, so T^2 ∝ a^3 stays exactly true in compressed time too)
// — 250 real seconds per "visual year" lands Mercury's orbit around a
// minute (close to this scene's earlier hand-tuned pacing) while Pluto's
// takes several real hours, the same roughly 1030x real ratio between
// them, not a stylized approximation of it.
const SECONDS_PER_VISUAL_YEAR = 250;

function normalizeAngle(a) {
  const twoPi = Math.PI * 2;
  return ((a % twoPi) + twoPi) % twoPi;
}

// Solves Kepler's equation M = E - e*sin(E) for the eccentric anomaly E
// via Newton's method (starting guess E0 = M, per the standard textbook
// approach — converges in a handful of iterations for realistic orbital
// eccentricities; 6 iterations here is a safety margin over the 3-5 that
// are typically sufficient, still trivially cheap).
function solveEccentricAnomaly(M, e) {
  let E = M;
  for (let i = 0; i < 6; i++) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

// A single shared function for both planets (real au/e/m0Deg data) and
// moons (small fixed illustrative e, deterministic spread of m0 — see the
// moon-building comment in buildOrrery for why no real per-moon data is
// used) — the physics is identical at either scale, which is exactly the
// "same math, applied recursively" the brief asked for. `orbit.a` and
// `orbit.screenRadius` can be in any consistent units (real AU for
// planets, already-compressed screen units for moons): what actually
// drives the returned screen radius is the dimensionless ratio
// rReal/orbit.a, which is scale-invariant by construction.
//
// Returns { rScreen, angle }: angle is the true anomaly (0 at perihelion,
// increasing in the direction of real orbital motion), and rScreen is the
// body's current screen-space distance from its orbit's center — this is
// what makes the motion genuinely elliptical rather than a circular
// approximation: rScreen oscillates between orbit.screenRadius*(1-e) and
// orbit.screenRadius*(1+e) over one full period, exactly the same
// fractional variation the real orbit has, applied to the (sqrt-
// compressed, for planets) baseline radius already established elsewhere
// in this file for unrelated spacing reasons.
function keplerOrbitPosition(orbit, nowMs) {
  const visualYears = (nowMs - J2000_EPOCH_MS) / 1000 / SECONDS_PER_VISUAL_YEAR;
  const M = normalizeAngle(orbit.m0 + (2 * Math.PI * visualYears) / orbit.periodYears);
  const E = solveEccentricAnomaly(M, orbit.e);
  // x = a(cosE - e), y = a*sqrt(1-e^2)*sinE — the orbital-plane position
  // this form gives directly (no separate true-anomaly trig-branch
  // handling needed); rReal = distance from the focus = a(1 - e*cosE),
  // and atan2 of the same two components gives the true anomaly for the
  // angle. This automatically satisfies Kepler's second law (equal areas
  // in equal times — faster near perihelion, slower near aphelion): that
  // speed variation isn't authored anywhere, it falls straight out of
  // solving the equation.
  const rReal = orbit.a * (1 - orbit.e * Math.cos(E));
  const angle = Math.atan2(Math.sqrt(1 - orbit.e * orbit.e) * Math.sin(E), Math.cos(E) - orbit.e);
  return { rScreen: orbit.screenRadius * (rReal / orbit.a), angle };
}

// Positions a body (already time-varying via keplerOrbitPosition) within
// its own orbit's local X/Z plane, and rotates it to match — replicating
// exactly what the old "rotate a fixed-offset pivot every frame" approach
// produced (the mounting arm, built along local -X, always pointing back
// toward the orbit's own center), just computed directly instead of
// accumulated: bodyGroup.rotation.y = angle applied to a
// (rScreen, 0, 0)-relative offset is mathematically identical to the old
// parent-pivot-rotation scheme, with the rotation moved from parent to
// self so it can be set fresh from the clock every frame rather than
// integrated.
function applyKeplerPosition(mesh, orbit, nowMs) {
  const { rScreen, angle } = keplerOrbitPosition(orbit, nowMs);
  mesh.position.set(rScreen * Math.cos(angle), 0, -rScreen * Math.sin(angle));
  mesh.rotation.y = angle;
}

// Moons have no real per-body orbital-element data at this scale, so their
// Kepler inputs are fixed, deliberately-illustrative constants rather than
// sourced values (see the moons.map comment in buildOrrery for the full
// reasoning): a small, gently-visible eccentricity; a real-time period for
// the innermost moon of each planet that further moons then scale up from
// via T ∝ r^1.5 (Kepler's third law, applied recursively); and a
// deterministic (not random) per-moon initial phase spread by the golden
// angle, so multiple moons around one planet never land in a repeating or
// coincidentally-aligned arrangement.
const MOON_E = 0.06;
const MOON_PERIOD_BASE_SECONDS = 6;
const MOON_GOLDEN_ANGLE = 2.399963229; // radians, ~137.5°

// (u, v) -> the point on the unit sphere that (u, v) addresses. Used
// identically by buildAgedPlanetGeometry and makeAgedPlanetTextures
// below so a texture pixel and a geometry vertex at the same (u, v)
// always land on the exact same physical point on the body — the whole
// wear/patina/grime system depends on that agreement holding exactly,
// not approximately, which is also why this scene hand-builds the
// sphere geometry below rather than trusting THREE.SphereGeometry's own
// (unverified-from-here) UV layout to match.
function sphericalDir(u, v, out) {
  const theta = u * Math.PI * 2, phi = v * Math.PI;
  const s = Math.sin(phi);
  out.x = s * Math.cos(theta);
  out.y = Math.cos(phi);
  out.z = s * Math.sin(theta);
  return out;
}

const AGE_FREQ_H = 2.4;       // TUNABLE: roughly how many broad wear/patina blotches wrap the sphere
const AGE_FREQ_EDGE = 8;      // TUNABLE: finer noise that roughens the wear/grime boundary into an organic chip/tarnish edge instead of a smooth gradient ring
const AGE_EDGE_JITTER = 0.08; // TUNABLE: how far AGE_FREQ_EDGE can locally shift the wear/grime threshold
// fbm3 at these settings empirically lands around mean 0.5, std ~0.11 (see
// verify_planet_aging.mjs, run once during development, not part of the
// repo) — NOT a uniform 0..1 spread, so these bands are calibrated against
// that actual distribution rather than guessed against the theoretical
// range: WEAR/GRIME both start around the ~85th/15th percentile and reach
// full effect around the ~98th/2nd, so only a minority of each body's
// surface (its highest and lowest points) ever shows real wear or grime —
// "aged, not decayed," per the brief's own ceiling.
const WEAR_LO = 0.58, WEAR_HI = 0.74;   // TUNABLE: band of the height field that transitions from intact paint to bare, burnished bronze
const GRIME_LO = 0.58, GRIME_HI = 0.74; // TUNABLE: band of (1 - height) that transitions from clean to patinated/grimy — same band as WEAR_LO/HI by design: fbm3's own spread is close to symmetric around 0.5
const AGE_DISPLACE_AMT = 0.07;          // TUNABLE: fraction of radius the surface bulges/dimples by — kept modest, "aged, not decayed"
const SEAM_DIR = new THREE.Vector3(-1, 0, 0); // every planet's mounting arm attaches along local -X (see arm.position.x below) — one fixed direction, true for all nine bodies, not derived per-planet
const SEAM_DOT_LO = 0.55;               // TUNABLE: angular reach (as a dot-product threshold) of the grime smudge around SEAM_DIR
const AGE_SEGMENTS_W = 28, AGE_SEGMENTS_H = 20; // resolution for the hand-built planet geometry below — enough to carry the displacement as real bumps rather than a faceted lump, still trivial at nine bodies

// A UV sphere built by hand (rather than THREE.SphereGeometry) so its UV
// layout is known exactly instead of assumed — see sphericalDir above
// for why that guarantee matters here. Standard grid-of-quads
// construction: a (segH+1) x (segW+1) vertex grid, each quad split into
// two triangles, computeVertexNormals afterward so the displaced
// surface still shades correctly (a perfect sphere's own analytic
// normals are no longer right once vertices have moved).
function buildAgedPlanetGeometry(radius, seedH) {
  const positions = [], uvs = [];
  const dir = new THREE.Vector3();
  for (let iy = 0; iy <= AGE_SEGMENTS_H; iy++) {
    const v = iy / AGE_SEGMENTS_H;
    for (let ix = 0; ix <= AGE_SEGMENTS_W; ix++) {
      const u = ix / AGE_SEGMENTS_W;
      sphericalDir(u, v, dir);
      const h = fbm3(dir.x * AGE_FREQ_H, dir.y * AGE_FREQ_H, dir.z * AGE_FREQ_H, seedH, 4);
      const r = radius * (1 + (h - 0.5) * 2 * AGE_DISPLACE_AMT);
      positions.push(dir.x * r, dir.y * r, dir.z * r);
      uvs.push(u, v);
    }
  }
  const indices = [];
  const rowLen = AGE_SEGMENTS_W + 1;
  for (let iy = 0; iy < AGE_SEGMENTS_H; iy++) {
    for (let ix = 0; ix < AGE_SEGMENTS_W; ix++) {
      const a = iy * rowLen + ix, b = a + 1, c = a + rowLen, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// Builds the color/roughness/metalness/emissive canvas maps for one
// planet body, all four sampled together in a single pass over the same
// per-pixel field so they stay consistent with each other and with
// buildAgedPlanetGeometry's displacement (same seedH, same sphericalDir,
// same AGE_FREQ_H). W/H match makeSprayPaintTexture's own canvas size,
// whose output is reused here as the "paint as originally applied"
// layer — this pass adds decades of aging on top of that existing
// texture, it doesn't replace it. `texture.flipY = false` on every
// output canvas is what keeps a canvas pixel at (u, v) and a geometry
// vertex at UV (u, v) addressing the same point; THREE's default flipY
// would otherwise vertically mirror the mapping between them.
function makeAgedPlanetTextures(hex, seedH) {
  const W = 128, H = 128;
  const paintTex = makeSprayPaintTexture(hex);
  const paintData = paintTex.image.getContext('2d').getImageData(0, 0, W, H).data;

  const colorC = document.createElement('canvas'); colorC.width = W; colorC.height = H;
  const roughC = document.createElement('canvas'); roughC.width = W; roughC.height = H;
  const metalC = document.createElement('canvas'); metalC.width = W; metalC.height = H;
  const emisC = document.createElement('canvas'); emisC.width = W; emisC.height = H;
  const colorCx = colorC.getContext('2d'), roughCx = roughC.getContext('2d');
  const metalCx = metalC.getContext('2d'), emisCx = emisC.getContext('2d');
  const colorImg = colorCx.createImageData(W, H), roughImg = roughCx.createImageData(W, H);
  const metalImg = metalCx.createImageData(W, H), emisImg = emisCx.createImageData(W, H);

  const col = new THREE.Color(hex);
  // Matches bronzeMaterial's own base/highlight tones, so an exposed
  // patch of "bronze" here reads as the same metal the moons are cast
  // from elsewhere in the scene, not an unrelated color invented just
  // for this effect.
  const bronze = { r: 138, g: 100, b: 56 };
  const burnish = { r: 214, g: 178, b: 122 }; // the shine a handled/rubbed high point picks up
  // Dark, desaturated tarnish rather than green verdigris, on purpose —
  // verdigris needs sustained rain/moisture exposure, and this machine
  // has hung indoors, mostly undisturbed, for decades, which tarnishes
  // bronze toward soot-brown/black rather than green.
  const tarnish = { r: 27, g: 21, b: 15 };

  const dir = new THREE.Vector3();
  for (let py = 0; py < H; py++) {
    const v = py / H;
    for (let px = 0; px < W; px++) {
      const u = px / W;
      sphericalDir(u, v, dir);
      const h = fbm3(dir.x * AGE_FREQ_H, dir.y * AGE_FREQ_H, dir.z * AGE_FREQ_H, seedH, 4);
      const edge = fbm3(dir.x * AGE_FREQ_EDGE, dir.y * AGE_FREQ_EDGE, dir.z * AGE_FREQ_EDGE, seedH + 7919, 2);
      const jitter = (edge - 0.5) * AGE_EDGE_JITTER;
      const wearAmt = remap01(h, WEAR_LO + jitter, WEAR_HI + jitter);
      const grimeAmt = remap01(1 - h, GRIME_LO + jitter, GRIME_HI + jitter);
      const seamAmt = remap01(SEAM_DIR.dot(dir), SEAM_DOT_LO, 1) * 0.85;

      const i = (py * W + px) * 4;
      const bronzeR = bronze.r + (burnish.r - bronze.r) * wearAmt;
      const bronzeG = bronze.g + (burnish.g - bronze.g) * wearAmt;
      const bronzeB = bronze.b + (burnish.b - bronze.b) * wearAmt;
      let r = paintData[i] + (bronzeR - paintData[i]) * wearAmt;
      let g = paintData[i + 1] + (bronzeG - paintData[i + 1]) * wearAmt;
      let b = paintData[i + 2] + (bronzeB - paintData[i + 2]) * wearAmt;
      r += (tarnish.r - r) * grimeAmt * 0.8;
      g += (tarnish.g - g) * grimeAmt * 0.8;
      b += (tarnish.b - b) * grimeAmt * 0.8;
      const seamShadow = 1 - seamAmt * 0.55;
      colorImg.data[i] = r * seamShadow; colorImg.data[i + 1] = g * seamShadow; colorImg.data[i + 2] = b * seamShadow; colorImg.data[i + 3] = 255;

      // Roughness/metalness follow the same wear-vs-grime logic a
      // real-time PBR wear map would use: intact paint is matte and
      // non-metallic; bronze bared by wear is shinier and metallic,
      // brightest right at the burnished high points; grimy recesses are
      // duller, and slightly less reflectively metallic under a film of
      // dust, than whatever's underneath.
      let rough = lerp(0.78, 0.3, wearAmt);
      rough = lerp(rough, 0.92, grimeAmt);
      rough = lerp(rough, Math.min(0.97, rough + 0.15), seamAmt);
      const roughByte = Math.round(clamp01(rough) * 255);
      roughImg.data[i] = roughImg.data[i + 1] = roughImg.data[i + 2] = roughByte; roughImg.data[i + 3] = 255;

      let metal = lerp(0.08, 0.82, wearAmt);
      metal = lerp(metal, metal * 0.5, grimeAmt);
      const metalByte = Math.round(clamp01(metal) * 255);
      metalImg.data[i] = metalImg.data[i + 1] = metalImg.data[i + 2] = metalByte; metalImg.data[i + 3] = 255;

      // The scene's structure key light relies on a flat emissive tint
      // (see bodyMat below) to keep planet bodies legibly colored
      // without out-competing the ring/mast structure for attention —
      // that tint should follow the paint, not the bronze, so it fades
      // out exactly where the paint itself has worn away or gone under
      // grime, instead of uniformly glowing the original color straight
      // through the new wear/patina.
      const emisAmt = clamp01(1 - wearAmt - grimeAmt * 0.6);
      emisImg.data[i] = col.r * 255 * emisAmt;
      emisImg.data[i + 1] = col.g * 255 * emisAmt;
      emisImg.data[i + 2] = col.b * 255 * emisAmt;
      emisImg.data[i + 3] = 255;
    }
  }
  colorCx.putImageData(colorImg, 0, 0);
  roughCx.putImageData(roughImg, 0, 0);
  metalCx.putImageData(metalImg, 0, 0);
  emisCx.putImageData(emisImg, 0, 0);

  const asTexture = c => { const t = new THREE.CanvasTexture(c); t.flipY = false; return t; };
  return { map: asTexture(colorC), roughnessMap: asTexture(roughC), metalnessMap: asTexture(metalC), emissiveMap: asTexture(emisC) };
}

const BOLT_TONE = 0x18140f;

// ─── First-person walkthrough tuning ─────────────────────────────────────
// Arrow-key movement, mouse-look, and collision — a Myst-like walkthrough
// feel. ────
const PLAYER_RADIUS = 0.3;
const EYE_HEIGHT = 1.7;          // above floorY — happens to land almost
                                 // exactly at the control hub's own height
                                 // (see hub.position in buildOrrery) and
                                 // below the suspended rings, both by
                                 // design rather than coincidence: it's
                                 // the height a visitor would actually
                                 // look the machine in the eye at.
const WALK_SPEED = 2.6;         // units/sec, full speed
const MOVE_ACCEL = 14;          // how briskly velocity eases to target
const LOOK_SENS_MOUSE = 0.0022; // pointer-lock's raw, unscaled movementX/Y
const PITCH_LIMIT = 1.3;        // ~74°, keeps the view from flipping over

function addBolts(parent, radius, count, ringGeoRadius) {
  const boltGeo = new THREE.SphereGeometry(radius, 6, 6);
  const boltMat = new THREE.MeshStandardMaterial({ color: BOLT_TONE, roughness: 0.6, metalness: 0.6 });
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const bolt = new THREE.Mesh(boltGeo, boltMat);
    bolt.position.set(Math.cos(a) * ringGeoRadius, Math.sin(a) * ringGeoRadius, 0);
    parent.add(bolt);
  }
}

// A welded brace (or a chain link) between two arbitrary points — used both
// for the ring-to-mast braces and the ceiling-to-mast suspension chains.
// heightSegments defaults to 1 (just the two end rings), which is enough
// for every current caller — all static, never individually deformed.
// Left tunable rather than hardcoded because of a real lesson from 2.2.17:
// a strut with no vertices along its own length can't be bent by anything
// that displaces individual vertices, only by a transform on the whole
// mesh or its parent (see NOTES.md 2.2.17/2.2.18) — worth remembering
// before any future effect tries per-vertex strut deformation again.
function addStrut(parent, from, to, thickness, mat, heightSegments = 1) {
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const dist = from.distanceTo(to);
  const geo = new THREE.CylinderGeometry(thickness, thickness, dist, 6, heightSegments);
  const strut = new THREE.Mesh(geo, mat);
  strut.position.copy(mid);
  strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  parent.add(strut);
  return strut;
}

function lerp(a, b, t) { return a + (b - a) * t; }

// Classic cyclic Jacobi eigenvalue algorithm for a real symmetric matrix —
// used once, at load, to find the telescope lattice's own natural
// vibration modes (see the receiving-effect comment in buildOrrery). Not a
// general-purpose numerical library import: this is ~30 lines of a
// textbook algorithm, appropriate for the small (27x27) matrix it runs on
// exactly once, and it keeps the physics fully inspectable in this file
// rather than behind a dependency. Repeatedly zeroes the largest
// off-diagonal pair via a rotation until the matrix is (numerically)
// diagonal; the accumulated rotations are the eigenvectors, the final
// diagonal is the eigenvalues. Returns both sorted ascending (so index 0
// is always the lowest-frequency mode).
function jacobiEigenSymmetric(matrix, n, maxSweeps = 100) {
  const A = matrix.map(row => row.slice());
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let offDiagSum = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) offDiagSum += A[p][q] * A[p][q];
    if (offDiagSum < 1e-24) break; // converged
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-18) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        const app = A[p][p], aqq = A[q][q], apq = A[p][q];
        A[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
        A[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
        A[p][q] = 0; A[q][p] = 0;
        for (let i = 0; i < n; i++) {
          if (i === p || i === q) continue;
          const aip = A[i][p], aiq = A[i][q];
          A[i][p] = c * aip - s * aiq; A[p][i] = A[i][p];
          A[i][q] = s * aip + c * aiq; A[q][i] = A[i][q];
        }
        for (let i = 0; i < n; i++) {
          const vip = V[i][p], viq = V[i][q];
          V[i][p] = c * vip - s * viq;
          V[i][q] = s * vip + c * viq;
        }
      }
    }
  }
  const eigenvalues = Array.from({ length: n }, (_, i) => A[i][i]);
  const order = eigenvalues.map((v, i) => i).sort((a, b) => eigenvalues[a] - eigenvalues[b]);
  return {
    values: order.map(i => eigenvalues[i]),
    vectors: order.map(i => V.map(row => row[i])), // vectors[n] is mode n's own 27-component shape
  };
}

function buildOrrery(preview, suspendTopY, rafterY) {
  const group = new THREE.Group();
  const steelMat = steelMaterial(preview);
  const mastMat = paintedMastMaterial(preview);
  const bronzeMat = bronzeMaterial();

  // The orrery itself reads substantially bigger without growing the
  // warehouse around it. HW thickens the mast and hardware; SR widens the
  // orbit rings (capped just inside the side walls — wallDist is 6.5/5 in
  // buildWarehouse); SS grows the planet bodies themselves, with no wall
  // constraint. Mast height and every vertical anchor (baseY,
  // suspendTopY, rafterY, riserTopY) stay fixed — the room itself keeps
  // its own size regardless of these scale factors.
  const HW = 1.4, SR = 1.45, SS = 2.2;

  // ─── The mast — steel and wood, painted royal purple, hanging from the
  // suspension collar at the top rather than rooted in a floor: a core
  // shaft plus riveted collar flanges with diagonal cross-braces. ────────
  const mastHeight = preview ? 3.2 : 4.4;
  const baseY = suspendTopY - mastHeight;
  const coreGeo = new THREE.CylinderGeometry((preview ? 0.05 : 0.06) * HW, (preview ? 0.09 : 0.11) * HW, mastHeight, 8);
  const core = new THREE.Mesh(coreGeo, mastMat);
  core.position.y = baseY + mastHeight / 2;
  group.add(core);

  const collarCount = preview ? 3 : 5;
  const collarGeo = new THREE.TorusGeometry((preview ? 0.1 : 0.13) * HW, 0.012 * HW, 5, 6);
  let prevCollarY = null;
  for (let i = 0; i < collarCount; i++) {
    const y = baseY + (i / (collarCount - 1)) * mastHeight;
    const collar = new THREE.Mesh(collarGeo, steelMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = y;
    group.add(collar);
    if (!preview && prevCollarY !== null) {
      const braceGeo = new THREE.CylinderGeometry(0.008 * HW, 0.008 * HW, Math.hypot(mastHeight / (collarCount - 1), 0.1) * 1.3, 5);
      [0, Math.PI].forEach(rot => {
        const brace = new THREE.Mesh(braceGeo, steelMat);
        brace.position.y = (y + prevCollarY) / 2;
        brace.rotation.z = 0.55;
        brace.rotation.y = rot;
        group.add(brace);
      });
    }
    prevCollarY = y;
  }

  // ─── Suspension — four chains fanning from the top collar up to anchor
  // points near the roof trusses. What actually holds the thing up. ───────
  const anchorSpread = preview ? 0.75 : 1.0;
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => {
    const from = new THREE.Vector3(dx * (preview ? 0.11 : 0.14) * HW, suspendTopY, dz * (preview ? 0.11 : 0.14) * HW);
    const to = new THREE.Vector3(dx * anchorSpread, rafterY, dz * anchorSpread);
    addStrut(group, from, to, (preview ? 0.012 : 0.015) * HW, steelMat);
  });

  // A bolted control box near the bottom of the mast — the actual
  // click/hover target, with one small amber indicator lamp lit, the kind
  // of after-the-fact gauge box a scrap-built machine would have bolted on.
  const hubHalf = (preview ? 0.16 : 0.2) * HW;
  const hubGeo = new THREE.BoxGeometry((preview ? 0.22 : 0.28) * HW, (preview ? 0.16 : 0.2) * HW, (preview ? 0.16 : 0.2) * HW);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.7, metalness: 0.4 });
  const hub = new THREE.Mesh(hubGeo, hubMat);
  hub.position.set(hubHalf, baseY + 0.3, 0);
  group.add(hub);
  const lampGeo = new THREE.SphereGeometry((preview ? 0.035 : 0.045) * HW, 8, 8);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffaa33, emissive: 0xffaa33, emissiveIntensity: 1, roughness: 0.4 });
  const lamp = new THREE.Mesh(lampGeo, lampMat);
  lamp.position.set(0, hubHalf * 0.6, hubHalf * 0.6);
  hub.add(lamp);

  // ─── The radio telescope — "still on, receiving information from the
  // heavens." A riser from the suspension collar continues the mast upward,
  // through the roof, to a bronze lattice antenna. Riser height tuned so
  // this whole assembly clears the ceiling by a wide, unmistakable margin
  // (was clearing it by as little as 0.05-0.1 units before — technically
  // "poking out," but not legibly so): the found story's own text says it
  // plainly ("about 30 feet high, the peak poking out of the warehouse
  // skylights"), so the peak should read as clearly above the roofline,
  // surrounded by the sky/star field beyond it, not just barely grazing
  // the hole.
  //
  // Round 2 of this element — two things were actually wrong with the
  // first version, both caught from ground-camera screenshots: a filled
  // solid dish read as flat and unbraced up close (no visible structure to
  // it), and the "receiving" effect wasn't legible as its own deliberate
  // thing next to the skylight's own pre-existing, unrelated ambient light
  // beam (see beamMat in buildWarehouse — that beam was already there,
  // nothing to do with this telescope). Both are addressed by rebuilding
  // the dish as an actual open lattice — a bronze web of radial spokes and
  // cross-bracing rings, apex down, rim up, same cone silhouette as
  // before — rather than a filled surface: the lattice itself IS the
  // visible structure (no separate "add supports" step), and it gives the
  // receiving pulse below somewhere concrete to travel along.
  //
  // Worth being explicit about what IS and ISN'T designed here: this
  // object is found, not engineered by Peter Hight — its web shape is
  // just what it already was when found, not a mesh dish deliberately
  // optimized for wind load or reception the way a real one would be. It
  // happens to work as a receiver; nobody designed it to — a strange found
  // shape, not good engineering. That's also why it gets its own material
  // below instead of reusing bronzeMaterial() or the planet-body aging
  // system (see makeAgedPlanetTextures/buildAgedPlanetGeometry): every
  // other bronze surface on this sculpture is deliberately weathered, but
  // this one — sitting at the single most weather-exposed point on the
  // whole piece, poking through the roof itself — stays clean and bright.
  // Not an inconsistency; a second unexplained detail sitting alongside
  // "still on, receiving," same as that line: this hasn't aged the way
  // everything below it has.
  const riserTopY = suspendTopY + (preview ? 1.0 : 1.35);
  addStrut(group, new THREE.Vector3(0, suspendTopY, 0), new THREE.Vector3(0, riserTopY, 0), (preview ? 0.03 : 0.04) * HW, mastMat);
  const dishGroup = new THREE.Group();
  dishGroup.position.y = riserTopY;
  const dishR = (preview ? 0.34 : 0.44) * HW, dishH = (preview ? 0.24 : 0.32) * HW;
  // Apex (the web's own center/hub — where the receiving pulse below
  // actually converges) at -dishH/2, rim at +dishH/2: the same cone this
  // assembly used before, just realized as a lattice of struts along that
  // cone's surface instead of a filled mesh over it.
  const apexY = -dishH / 2, rimY = dishH / 2;
  // Round 3: the dish's own weirdness is now purely material, not
  // animated. Earlier passes tried to sell "still on" with a traveling
  // light pulse along the web's threads — it didn't land (flagged
  // directly: "it isn't working"). Static contrast carries this better —
  // this is the one clean, untarnished piece of bronze in a room full of
  // deliberately weathered ones (see the aging system below, and the
  // planet-body patina above it), full stop, no glow cycle. One shared,
  // unanimated material for every strut in the web — no more per-segment
  // .clone()s, since nothing needs to light independently anymore.
  // emissiveIntensity trimmed slightly (0.5 -> 0.38, 2.2.18) — still the
  // one clean, bright, unweathered surface on the piece per the comment
  // above, just eased back a touch after reading as a bit too contrasted
  // against the rest of the scene.
  const webMat = new THREE.MeshStandardMaterial({
    color: 0xd9a862, emissive: 0xffb35c, emissiveIntensity: 0.38, roughness: 0.28, metalness: 0.9,
  });
  const WEB_SPOKES = 9; // TUNABLE: radial threads, apex to rim
  const WEB_RINGS = 3;  // TUNABLE: cross-bracing circles between apex and rim (rim itself counts as the outermost)
  const spokeDirs = Array.from({ length: WEB_SPOKES }, (_, i) => {
    const a = (i / WEB_SPOKES) * Math.PI * 2;
    return { x: Math.cos(a), z: Math.sin(a) };
  });

  // ─── The receiving effect, round 5: real coupled-oscillator physics on
  // the lattice's own actual connectivity, not an authored waveform.
  //
  // Rounds 1-2 (particle beam, then a lensing patch) failed because this
  // scene already has visual vocabulary for "a small round-ish or
  // irregular thing near the hub" (the planets, the asteroid belt), so any
  // new mesh there gets sorted into that category regardless of shape —
  // whatever moves has to be the lattice's own existing geometry, not a
  // new object. Round 3 (2.2.14-2.2.18) displaced each strut's own
  // vertices independently, which (once 2.2.17 fixed the bug that had
  // kept it motionless) read as "everything's wobbling," not a resonant
  // object — an incoherent tangle of unrelated local motion is how cloth
  // moves, not a bronze lattice welded solid at every joint. Round 4
  // (2.2.19) fixed THAT by replacing per-vertex motion with one rigid
  // "wine glass" ovalizing transform on the whole dish — correct in kind
  // (coherent, anchored, rigid), but hand-authored: one shape, one
  // frequency, no relationship to which point actually got struck or how
  // far a disturbance is from there.
  //
  // This round replaces the hand-authored transform with the real thing:
  // every joint where struts actually meet is treated as a point mass,
  // every strut between two joints as a spring, and the whole lattice's
  // motion is the genuine solution to that system — standard textbook
  // mass-spring-damper network physics, the discrete version of how a
  // bell or a crystal actually rings when struck:
  //   m·ẍᵢ = −Σⱼ kᵢⱼ(xᵢ−xⱼ) − γ·ẋᵢ,  summed over every joint j that i is
  // actually connected to by a real strut (M·ẍ + C·ẋ + K·x = F(t) in
  // matrix form). This is NOT the closed-form phonon dispersion relation a
  // perfectly regular, evenly-repeating lattice would have (ω =
  // 2√(k/m)·|sin(ka/2)| for the simplest 1D chain) — that only applies to
  // a regular repeating structure, and this mesh, built from real strut
  // connectivity rather than a uniform grid, isn't one. The general
  // eigenmode approach below is the right fit for the geometry that
  // actually exists here, not a shortcut reached for by mistake.
  //
  // 28 joints: the apex/hub (pinned, see below) plus 3 rings of 9 points
  // each, at the same radii/heights the old cross-bracing rings used. Each
  // spoke, previously one continuous strut from apex straight to rim, is
  // now built as 3 shorter collinear struts (apex-ring1, ring1-ring2,
  // ring2-ring3/rim) so the RENDERED geometry has an actual joint
  // everywhere the physics says one exists — visually identical at rest,
  // but every strut endpoint is now a real dynamical point the physics can
  // move, rather than needing interior vertices on one long strut (the
  // 2.2.17 bug class doesn't apply here: nothing ever touches a strut's
  // own geometry after it's built, only its position/rotation/scale,
  // recomputed from its two joints' live positions the same way addStrut
  // itself computes them once).
  //
  // The apex is pinned — excluded as a free variable, always zero
  // displacement — because it's rigidly welded to the mast, a much
  // stiffer assembly than this web: physically the lattice's boundary
  // condition, not one more joint that vibrates. This also removes the
  // trivial rigid-body zero-mode an unanchored graph's Laplacian would
  // otherwise have, and keeps the hub visually anchored the way 2.2.19's
  // rigid transform did.
  const N_RING = WEB_SPOKES, N_LEVELS = WEB_RINGS, N_JOINTS = N_RING * N_LEVELS; // 27 free joints
  const jointIdx = (level, i) => level * N_RING + i; // level 0..2 = ring 1..3 (rim), i = spoke index
  const jointBasePos = [];
  for (let level = 0; level < N_LEVELS; level++) {
    const rt = (level + 1) / N_LEVELS, y = apexY + (rimY - apexY) * rt, r = dishR * rt;
    for (let i = 0; i < N_RING; i++) {
      const d = spokeDirs[i];
      jointBasePos.push(new THREE.Vector3(d.x * r, y, d.z * r));
    }
  }
  const apexBasePos = new THREE.Vector3(0, apexY, 0);
  // Spring stiffness: a real rod's axial stiffness scales with its
  // cross-section, so the ratio between the circumferential and radial
  // strut THICKNESSES already committed to below (0.008 vs 0.012 at full
  // scale) is reused directly as a relative-stiffness proxy, rather than
  // inventing an unrelated number — simplified (true stiffness would use
  // area and real beam bending, not just a thickness ratio), but grounded
  // in a value this file already chose for an unrelated reason, not
  // picked to make the animation look a particular way.
  const K_RADIAL = 1;
  const K_CIRCUM = (preview ? 0.006 : 0.008) / (preview ? 0.009 : 0.012);
  const K = Array.from({ length: N_JOINTS }, () => new Array(N_JOINTS).fill(0));
  function addSpring(a, b, k) {
    // a/b: a free-joint index (0..N_JOINTS-1), or -1 for the pinned apex.
    if (a >= 0) K[a][a] += k;
    if (b >= 0) K[b][b] += k;
    if (a >= 0 && b >= 0) { K[a][b] -= k; K[b][a] -= k; }
  }
  for (let i = 0; i < N_RING; i++) {
    addSpring(-1, jointIdx(0, i), K_RADIAL);              // apex - ring1 (this spoke's innermost segment)
    addSpring(jointIdx(0, i), jointIdx(1, i), K_RADIAL);  // ring1 - ring2
    addSpring(jointIdx(1, i), jointIdx(2, i), K_RADIAL);  // ring2 - ring3 (rim)
  }
  for (let level = 0; level < N_LEVELS; level++) {
    for (let i = 0; i < N_RING; i++) {
      addSpring(jointIdx(level, i), jointIdx(level, (i + 1) % N_RING), K_CIRCUM);
    }
  }
  // Solved once, here, at scene build — the lattice's topology never
  // changes at runtime, so its eigenmodes don't either. animate() below
  // only ever evaluates a closed-form sum over these fixed modes every
  // frame; nothing gets re-solved live.
  const modes = jacobiEigenSymmetric(K, N_JOINTS);

  // The actual strut meshes: 27 radial segments (3 per spoke, per the
  // joint layout above) + 27 circumferential (unchanged in count from
  // before — still literally the cross-bracing rings). Each is recorded
  // with which two joints it connects (a jointBasePos index, or -1 for
  // the pinned apex) and its own built length, so animate() can
  // reposition/reorient/rescale it from the joints' live physics
  // positions every frame.
  const ringStruts = []; // { mesh, jointA, jointB, baseFrom, baseTo, builtLen }
  function addRingStrut(fromPos, toPos, jointA, jointB, thickness) {
    const mesh = addStrut(dishGroup, fromPos, toPos, thickness, webMat);
    ringStruts.push({ mesh, jointA, jointB, baseFrom: fromPos.clone(), baseTo: toPos.clone(), builtLen: fromPos.distanceTo(toPos) || 1 });
  }
  for (let i = 0; i < N_RING; i++) {
    const thickness = (preview ? 0.009 : 0.012) * HW;
    addRingStrut(apexBasePos, jointBasePos[jointIdx(0, i)], -1, jointIdx(0, i), thickness);
    addRingStrut(jointBasePos[jointIdx(0, i)], jointBasePos[jointIdx(1, i)], jointIdx(0, i), jointIdx(1, i), thickness);
    addRingStrut(jointBasePos[jointIdx(1, i)], jointBasePos[jointIdx(2, i)], jointIdx(1, i), jointIdx(2, i), thickness);
  }
  for (let level = 0; level < N_LEVELS; level++) {
    const thickness = (preview ? 0.006 : 0.008) * HW;
    for (let i = 0; i < N_RING; i++) {
      addRingStrut(jointBasePos[jointIdx(level, i)], jointBasePos[jointIdx(level, (i + 1) % N_RING)], jointIdx(level, i), jointIdx(level, (i + 1) % N_RING), thickness);
    }
  }
  // The web's own physical center — where every spoke actually meets, and
  // (see above) the lattice's one pinned/anchored joint. Solid and
  // unanimated, same webMat as the rest of the structure; it never moves,
  // which is now a literal boundary condition of the physics rather than
  // an approximation of one.
  const webHub = new THREE.Mesh(new THREE.SphereGeometry((preview ? 0.028 : 0.036) * HW, 10, 10), webMat);
  webHub.position.y = apexY;
  dishGroup.add(webHub);

  // Baseline hum: a few of the lattice's own lowest, real natural modes,
  // driven continuously and gently rather than left silent between strike
  // events (the "solar system's own ongoing gravitational hum" from the
  // original brief) — captured here as a fixed random per-mode, per-axis
  // phase so the modes don't all peak in sync, same "random phase chosen
  // once at build, only ever read from in animate()" pattern as the
  // ripplers this replaced.
  const BASELINE_MODE_COUNT = 2; // TUNABLE: how many of the lowest modes hum continuously
  const basePhase = Array.from({ length: BASELINE_MODE_COUNT }, () => [Math.random(), Math.random(), Math.random()].map(r => r * Math.PI * 2));
  const gravLens = { dishGroup, jointBasePos, modes, ringStruts, nJoints: N_JOINTS, basePhase };
  group.add(dishGroup);

  // ─── The nine real planets — order, relative size, and orbital spacing
  // all pulled from the actual solar system (compressed with a square root
  // so Mercury and Pluto both fit), close to coplanar and braced back to
  // the mast so it reads as one welded machine, not nine floating rings. ──
  const planets = preview ? PLANET_DATA.slice(0, 5) : PLANET_DATA;
  // Real AU ratios span roughly 100x (Mercury 0.39 to Pluto 39.5) — mapped
  // directly onto a small room, Mercury's ring would sit almost on top of
  // the mast while the outer planets would need to be impossibly far out,
  // or the inner planets would bunch into visual noise. Math.sqrt is the
  // actual compression: it shrinks large values proportionally MORE than
  // small ones (sqrt(39.5)≈6.28 is only ~9x sqrt(0.39)≈0.62, not 100x),
  // while still preserving the correct ORDER and relative spacing rank —
  // Mercury is still closest, Pluto still farthest, everything in between
  // still lands in the right relative position, just with the extremes
  // pulled in toward the middle. This is a real, if simplified, technique
  // (softer than a log-scale, gentler than linear) — not an approximation
  // of the real distances so much as a deliberate, legible re-projection
  // of their real ORDER onto a room-sized budget.
  const sqrtAU = planets.map(p => Math.sqrt(p.au));
  // auMin/auMax normalize the compressed values to a 0..1 range (below,
  // (sqrtAU[i]-auMin)/(auMax-auMin)), which lerp (linear interpolation)
  // then maps onto the actual innerR..outerR screen-space band — same
  // "normalize then lerp into a target range" pattern used again just
  // below for planet size, and common throughout this file wherever a
  // real-world value needs to become a screen distance.
  const auMin = Math.min(...sqrtAU), auMax = Math.max(...sqrtAU);
  // Same sqrt-compression idea, independently applied to planet SIZE
  // (relDiameter spans an even wider real range — Jupiter is roughly 28x
  // Pluto's diameter) so the smallest and largest bodies both stay
  // visible and comparable at room scale, same reasoning as the orbital
  // spacing above.
  const sqrtDia = planets.map(p => Math.sqrt(p.relDiameter));
  const diaMin = Math.min(...sqrtDia), diaMax = Math.max(...sqrtDia);
  const innerR = (preview ? 0.55 : 0.6) * SR, outerR = (preview ? 2.1 : 3.7) * SR; // TUNABLE screen-space band the compressed orbits get mapped into — widen the gap for more visual separation between rings
  const minSize = (preview ? 0.018 : 0.024) * SS, maxSize = (preview ? 0.065 : 0.09) * SS; // TUNABLE screen-space band for compressed planet sizes, same idea
  // Read wall-clock time exactly once for the whole build, so every body's
  // initial (pre-first-frame) position reflects the same instant — matters
  // for reduced-motion visitors, who never reach the animate() loop's own
  // per-frame orreryNowMs() call, and for the very first rendered frame
  // before animate() has run at all.
  const buildNowMs = orreryNowMs();

  const orbits = [];
  const TILT_BASE = 0.52;
  const TILT_JITTER = 0.03;
  const ringYBase = baseY + mastHeight * 0.3;
  const radii = [];
  // Real radius/yOffset/tilt per ring, for createOrrery to work out where
  // (if anywhere) each ring's tilted low edge actually dips down to the
  // walkthrough's eye height — see the collision comment near the bottom
  // of createOrrery for the geometry.
  const ringInfo = [];

  planets.forEach((planet, i) => {
    const radius = lerp(innerR, outerR, (sqrtAU[i] - auMin) / (auMax - auMin));
    radii.push(radius);
    const size = lerp(minSize, maxSize, (sqrtDia[i] - diaMin) / (diaMax - diaMin));
    const tilt = TILT_BASE + (Math.random() - 0.5) * TILT_JITTER;
    const yOffset = ringYBase + i * (preview ? 0.06 : 0.05);
    ringInfo.push({ radius, yOffset, tilt });

    // Tube thickness is deliberately generous: the rings/mast are the
    // orrery's own namesake mechanism and should be the most
    // confidently-read structure in the room, not out-competed for
    // attention by the small planet bodies riding them. Doesn't change
    // radius/tilt (the collision math in createOrrery keys off those, not
    // tube thickness).
    const ringGeo = new THREE.TorusGeometry(radius, (preview ? 0.011 : 0.014) * HW, 6, 20);
    const ring = new THREE.Mesh(ringGeo, steelMat);
    ring.rotation.x = Math.PI / 2 + tilt;
    ring.position.y = yOffset;
    group.add(ring);
    addBolts(ring, (preview ? 0.012 : 0.015) * HW, 16, radius);

    // Two struts per ring, bracing it back to the mast.
    [0, Math.PI].forEach(angle => {
      const from = new THREE.Vector3(0, yOffset, 0);
      const to = new THREE.Vector3(Math.cos(angle) * radius * 0.94, yOffset, Math.sin(angle) * radius * 0.94);
      addStrut(group, from, to, (preview ? 0.007 : 0.009) * HW, steelMat);
    });

    const pivot = new THREE.Object3D();
    pivot.rotation.x = tilt;
    pivot.position.y = yOffset;
    group.add(pivot);

    // bodyGroup no longer sits at a fixed local offset with its PARENT
    // pivot rotating every frame — see the Keplerian-motion comment above
    // organicPulse. It's positioned directly, every frame, by
    // applyKeplerPosition below; pivot now only ever carries the fixed
    // ring tilt.
    const bodyGroup = new THREE.Group();
    pivot.add(bodyGroup);
    // seedH fixes ONE aging field for this body — see the "Planet-body
    // aging" block above buildAgedPlanetGeometry — reused for both its
    // displaced geometry and every map on its material, so the bumps,
    // the worn paint, the patina, and the seam grime all agree with each
    // other about where on this particular ball is "high" and "low."
    // Freshly randomized per body per page load, same as every other
    // procedural texture in this file (makeSprayPaintTexture,
    // makeMetalTexture) — no two visits render the same wear pattern.
    const seedH = Math.floor(Math.random() * 1e6);
    const bodyGeo = buildAgedPlanetGeometry(size, seedH);
    const agedMaps = makeAgedPlanetTextures(planet.color, seedH);
    // emissive is white (not planet.color) because the actual color now
    // lives in agedMaps.emissiveMap itself, already weighted by wear —
    // see the comment on that map inside makeAgedPlanetTextures.
    // Intensity kept at the same 0.17 as before this pass: moderate
    // rather than bright, so — together with the dedicated structure key
    // light (see createOrrery) — the planet bodies still read as
    // secondary to the ring/mast structure holding them, not more
    // prominent than it.
    const bodyMat = new THREE.MeshStandardMaterial({
      map: agedMaps.map,
      roughnessMap: agedMaps.roughnessMap, roughness: 1,
      metalnessMap: agedMaps.metalnessMap, metalness: 1,
      emissiveMap: agedMaps.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.17,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    bodyGroup.add(body);

    // A short mounting arm — the ball rides a bracket on the ring. Always
    // along local -X, which is exactly what SEAM_DIR (above,
    // makeAgedPlanetTextures) assumes when it darkens the body's own
    // surface with grime right where this arm actually meets it.
    const armGeo = new THREE.CylinderGeometry(0.006 * HW, 0.006 * HW, (preview ? 0.03 : 0.04) * HW, 5);
    const arm = new THREE.Mesh(armGeo, steelMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.x = -(preview ? 0.015 : 0.02) * HW;
    bodyGroup.add(arm);

    if (planet.ring) {
      const satRingGeo = new THREE.RingGeometry(size * 1.4, size * 2.2, 24);
      const satRingMat = new THREE.MeshStandardMaterial({
        color: 0xd8c48a, roughness: 0.6, metalness: 0.4, transparent: true, opacity: 0.75, side: THREE.DoubleSide,
      });
      const satRing = new THREE.Mesh(satRingGeo, satRingMat);
      satRing.rotation.x = Math.PI / 2 - 0.45;
      bodyGroup.add(satRing);
    }

    // Moons now get the same real Kepler treatment as planets (see the
    // comment block above organicPulse) applied recursively: each moon's
    // orbit is computed around bodyGroup's own current (moving) position,
    // simply by being a child of bodyGroup — no separate system needed,
    // exactly as specified. There's no real per-moon orbital-element data
    // at this level of a solar-system overview the way there is for the
    // planets themselves, so eccentricity and initial phase are fixed,
    // deliberately-documented illustrative choices rather than sourced
    // values: MOON_E is a small constant (a gentle, visible-but-not-wild
    // ellipse) and each moon's initial mean anomaly is spread by the
    // golden angle (~137.5°) per index — deterministic and non-repeating
    // across moons, not random, so it's still "same visit, same
    // configuration" like everything else here. Each moon's PERIOD still
    // obeys Kepler's third law relative to its own orbital radius
    // (T ∝ r^1.5), so a moon further from its planet genuinely moves
    // slower than one closer in, the same relationship the planets have
    // to the sun — just anchored to MOON_PERIOD_BASE_SECONDS (the
    // innermost moon's real-time period) instead of Earth's.
    const moons = planet.moons.map((moon, mi) => {
      const moonPivot = new THREE.Object3D();
      bodyGroup.add(moonPivot);
      const moonSize = Math.max(0.006 * HW, size * moon.relSize * (preview ? 0.8 : 1));
      const moonGeo = new THREE.SphereGeometry(moonSize, 8, 8);
      const moonMesh = new THREE.Mesh(moonGeo, bronzeMat);
      moonPivot.add(moonMesh);
      const moonRadius = size * 1.8 + mi * (size * 0.9 + 0.012 * HW);
      const baseMoonRadius = size * 1.8; // mi === 0 case, defines the base period
      const moonPeriodYears =
        (MOON_PERIOD_BASE_SECONDS * Math.pow(moonRadius / baseMoonRadius, 1.5)) /
        SECONDS_PER_VISUAL_YEAR;
      const moonOrbit = {
        a: moonRadius,
        e: MOON_E,
        m0: mi * MOON_GOLDEN_ANGLE,
        periodYears: moonPeriodYears,
        screenRadius: moonRadius,
      };
      applyKeplerPosition(moonPivot, moonOrbit, buildNowMs);
      return { pivot: moonPivot, orbit: moonOrbit };
    });

    // Real Kepler orbital elements, sourced from J2000.0 low-precision
    // planetary elements (see the PLANET_DATA comment for the source and
    // the deliberate real-vs-exaggerated-eccentricity decision). `a` reuses
    // the same planet.au already used for the ring's screen-space radius
    // above — one number, not two slightly-different copies of the same
    // fact. `periodYears` is derived from `a` via Kepler's third law
    // (T² ∝ a³, so T = a^1.5 when a is in AU and T is in years — the
    // standard solar-mass-normalized convention where Earth's own period
    // is exactly 1 at a = 1 AU) rather than being independently authored,
    // per the brief. `screenRadius` is the already-computed, compressed
    // ring radius — keplerOrbitPosition works in a dimensionless
    // rReal/a ratio, so it scales cleanly onto the compressed screen
    // geometry without needing real AU distances on screen.
    //
    // `speed` is kept, still in the OLD unit convention (radians per frame
    // at 60fps, divided by 0.01) purely for the asteroid belt's existing
    // `(orbits[marsIdx].speed + orbits[jupiterIdx].speed) / 2` averaging
    // below, which is out of scope for this pass — but it's now the real
    // mean angular velocity derived from periodYears, not a hand-tuned
    // legibility compromise, so the belt inherits genuine physics too as a
    // side effect.
    const periodYears = Math.pow(planet.au, 1.5);
    const meanAngularVelocity = (2 * Math.PI) / (periodYears * SECONDS_PER_VISUAL_YEAR);
    const orbitRecord = {
      pivot,
      bodyGroup,
      moons,
      a: planet.au,
      e: planet.e,
      m0: THREE.MathUtils.degToRad(planet.m0Deg),
      periodYears,
      screenRadius: radius,
      speed: meanAngularVelocity / 0.6,
      direction: 1, // real planets all orbit the same way — no alternating
    };
    applyKeplerPosition(bodyGroup, orbitRecord, buildNowMs);
    orbits.push(orbitRecord);
  });

  // ─── The asteroid belt — scrap and debris, sitting where it actually
  // does: between Mars and Jupiter, not out past everything else. ─────────
  const marsIdx = planets.findIndex(p => p.name === 'Mars');
  const jupiterIdx = planets.findIndex(p => p.name === 'Jupiter');
  let belt = null;
  if (marsIdx !== -1 && jupiterIdx !== -1) {
    const beltRadius = (radii[marsIdx] + radii[jupiterIdx]) / 2;
    const beltY = ringYBase + ((marsIdx + jupiterIdx) / 2) * (preview ? 0.06 : 0.05);
    const beltGroup = new THREE.Group();
    beltGroup.position.y = beltY;
    // Every ring in this scene (see ring.rotation.x above, per planet) is
    // tilted, each by its own independently-jittered amount — the belt sat
    // perfectly flat instead, which reads as floating out of plane with
    // the tilted structure around it rather than as one more ring of the
    // same machine. Splits the difference between its two neighbors'
    // actual tilts (Mars, Jupiter) rather than inventing an unrelated
    // value of its own.
    beltGroup.rotation.x = (ringInfo[marsIdx].tilt + ringInfo[jupiterIdx].tilt) / 2;
    group.add(beltGroup);
    // A touch of warm emissive on top of the dark scrap color — pure
    // diffuse-only 0x554433 chunks this small read as nearly black
    // against the room's own dark curtain backdrop under this scene's
    // deliberately sparse lighting (checked live: at normal viewing
    // distance they were effectively invisible), losing the "a scatter
    // of debris, distinct from the smooth painted planets" the found
    // text calls for. The glow is faint and doesn't change the belt's
    // actual color, just keeps it from vanishing into the dark.
    const debrisMat = new THREE.MeshStandardMaterial({ color: 0x554433, emissive: 0x3a2c1c, emissiveIntensity: 0.35, roughness: 0.85, metalness: 0.3 });
    const debrisGeo = new THREE.IcosahedronGeometry(1, 0);
    const beltCount = preview ? 14 : 34;
    const beltSpread = (radii[jupiterIdx] - radii[marsIdx]) * 0.35;
    for (let i = 0; i < beltCount; i++) {
      // Polar placement: uniform random angle `a` around the ring, and a
      // radius `r` drawn uniformly around beltRadius (not uniform-by-AREA,
      // which would need r ∝ sqrt(random()) — this scatters slightly denser
      // near the belt's mean radius than a true uniform-disc fill would,
      // but for a few dozen decorative chunks the difference isn't visible).
      // This is placement, not a physical asteroid-distribution model.
      const a = Math.random() * Math.PI * 2;
      const r = beltRadius + (Math.random() - 0.5) * beltSpread;
      const chunk = new THREE.Mesh(debrisGeo, debrisMat);
      // Slightly larger floor than before (was 0.01/0.014*HW) — same
      // legibility issue as the emissive bump above: too small to read
      // as a "scatter of debris" at normal viewing distance, easy to
      // mistake for visual noise or miss entirely.
      const s = ((preview ? 0.014 : 0.019) + Math.random() * (preview ? 0.012 : 0.015)) * HW;
      chunk.scale.setScalar(s);
      chunk.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 0.06, Math.sin(a) * r);
      chunk.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      beltGroup.add(chunk);
    }
    // Parented to beltGroup, in ITS local space (from beltGroup's own
    // origin, no beltY offset — already carried by beltGroup.position.y)
    // rather than to `group` in world space, so these braces automatically
    // inherit the same tilt the chunks above just got, instead of bracing
    // a tilted disk from an untilted anchor.
    [0, Math.PI / 2].forEach(angle => {
      const from = new THREE.Vector3(0, 0, 0);
      const to = new THREE.Vector3(Math.cos(angle) * beltRadius * 0.96, 0, Math.sin(angle) * beltRadius * 0.96);
      addStrut(beltGroup, from, to, (preview ? 0.006 : 0.008) * HW, steelMat);
    });
    // Static before this pass — every other ring/orbit in the room
    // continuously drifts (see orbits.forEach in animate()) except this
    // one, which read as inert/disconnected from the rest of the machine.
    // Speed splits the difference between Mars's and Jupiter's own orbital
    // speeds, same reasoning as the tilt above — debris between them
    // moving at a rate between theirs, not an arbitrary new number.
    belt = { group: beltGroup, speed: (orbits[marsIdx].speed + orbits[jupiterIdx].speed) / 2 };
  }

  // ─── "A few other unidentified cosmic objects" — past Pluto, welded on
  // cantilevered booms, each tumbling on its own slow spin. ────────────────
  const unknowns = [];
  const lastRadius = radii[radii.length - 1];
  const lastY = ringYBase + (planets.length - 1) * (preview ? 0.06 : 0.05);
  const unknownGeos = [new THREE.IcosahedronGeometry((preview ? 0.05 : 0.07) * HW, 0), new THREE.OctahedronGeometry((preview ? 0.045 : 0.06) * HW, 0)];
  const unknownMat = new THREE.MeshStandardMaterial({ color: 0x5a4d3a, roughness: 0.7, metalness: 0.5 });
  const unknownCount = preview ? 1 : 2;
  for (let i = 0; i < unknownCount; i++) {
    const radius = lastRadius + ((preview ? 0.25 : 0.34) + i * (preview ? 0.18 : 0.24)) * SR;
    const y = lastY + (i + 1) * (preview ? 0.05 : 0.06);
    const angle = i * (Math.PI * 0.7);
    const pivot = new THREE.Object3D();
    pivot.position.y = y;
    group.add(pivot);
    const mesh = new THREE.Mesh(unknownGeos[i % unknownGeos.length], unknownMat);
    mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    pivot.add(mesh);
    const from = new THREE.Vector3(0, y, 0);
    const to = new THREE.Vector3(Math.cos(angle) * radius * 0.9, y, Math.sin(angle) * radius * 0.9);
    addStrut(group, from, to, (preview ? 0.006 : 0.008) * HW, steelMat);
    unknowns.push({ pivot, mesh, speed: 0.05 + Math.random() * 0.03, direction: 1, spin: 0.3 + Math.random() * 0.4 });
  }

  // A single generous circle covers the mast trunk and the control hub
  // bolted to its side — the rings/struts/suspension chains all sit well
  // above eye height (see EYE_HEIGHT's comment), so nothing else down here
  // needs its own collider.
  const colliders = [{ x: 0, z: 0, r: 0.6 }];

  return { group, hitTarget: hub, lampMat, orbits, unknowns, gravLens, belt, baseY, mastHeight, colliders, ringInfo };
}

// ─── The warehouse — floor, a ceiling with a skylight cut into it, roof
// trusses to hang the orrery from, a couple of corrugated walls with a few
// taped-up show flyers, and a shaft of light falling through the hole the
// orrery's peak actually pokes through. ───────────────────────────────────
function makeConcreteTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const cx = c.getContext('2d');
  cx.fillStyle = '#232321';
  cx.fillRect(0, 0, 128, 128);
  cx.globalAlpha = 0.3;
  for (let i = 0; i < 20; i++) {
    cx.fillStyle = Math.random() > 0.5 ? '#1a1a18' : '#2c2c29';
    const bx = Math.random() * 128, by = Math.random() * 128, br = 6 + Math.random() * 20;
    cx.beginPath();
    cx.arc(bx, by, br, 0, Math.PI * 2);
    cx.fill();
  }
  cx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

function makeCorrugatedTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const cx = c.getContext('2d');
  cx.fillStyle = '#17150f';
  cx.fillRect(0, 0, 32, 32);
  cx.strokeStyle = '#2c2820';
  cx.lineWidth = 2;
  for (let x = 0; x < 32; x += 5) {
    cx.beginPath();
    cx.moveTo(x, 0);
    cx.lineTo(x, 32);
    cx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 4);
  return tex;
}

function makeCardboardTexture() {
  const c = document.createElement('canvas');
  c.width = 96; c.height = 96;
  const cx = c.getContext('2d');
  cx.fillStyle = '#a9884f';
  cx.fillRect(0, 0, 96, 96);
  cx.globalAlpha = 0.25;
  for (let i = 0; i < 10; i++) {
    cx.fillStyle = Math.random() > 0.5 ? '#8a6f3f' : '#c2a366';
    cx.fillRect(Math.random() * 96, Math.random() * 96, 20 + Math.random() * 30, 3 + Math.random() * 6);
  }
  cx.globalAlpha = 0.5;
  cx.fillStyle = '#d9c99a';
  cx.fillRect(0, 40, 96, 10);
  cx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// A pegboard with a few tool silhouettes — a wrench, a hammer, a saw —
// hung the way anyone's garage wall actually looks.
function makePegboardTexture() {
  const c = document.createElement('canvas');
  c.width = 200; c.height = 260;
  const cx = c.getContext('2d');
  cx.fillStyle = '#8a7856';
  cx.fillRect(0, 0, 200, 260);
  cx.fillStyle = '#5f5138';
  for (let y = 12; y < 260; y += 16) {
    for (let x = 12; x < 200; x += 16) {
      cx.beginPath();
      cx.arc(x, y, 1.6, 0, Math.PI * 2);
      cx.fill();
    }
  }
  cx.strokeStyle = '#1c1a16';
  cx.fillStyle = '#232019';

  // Wrench.
  cx.save();
  cx.translate(50, 70);
  cx.rotate(-0.4);
  cx.lineWidth = 6;
  cx.beginPath(); cx.moveTo(-30, 0); cx.lineTo(30, 0); cx.stroke();
  cx.beginPath(); cx.arc(-32, 0, 9, 0.6, Math.PI * 2 - 0.6); cx.stroke();
  cx.beginPath(); cx.arc(32, 0, 7, 0, Math.PI * 2); cx.fill();
  cx.restore();

  // Hammer.
  cx.save();
  cx.translate(140, 90);
  cx.rotate(0.3);
  cx.fillRect(-4, -10, 8, 55);
  cx.fillRect(-20, -22, 40, 16);
  cx.restore();

  // Hand saw.
  cx.save();
  cx.translate(90, 175);
  cx.rotate(-0.15);
  cx.beginPath();
  cx.moveTo(-45, 10); cx.lineTo(35, -20); cx.lineTo(35, 4); cx.lineTo(-45, 22); cx.closePath();
  cx.fill();
  cx.fillRect(30, -24, 22, 30);
  cx.restore();

  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// A taped-up early-90s show flyer — xeroxed, high-contrast, a little
// water-stained. Band names only (no logos/artwork reproduced) — enough to
// date the room without borrowing anyone's actual design.
// These are a good, specific "what IS this thing" hook — the found-object
// mixtape/flyer detail is exactly the kind of thing that sells the room
// as a real place someone lived in. Legibility from across the room comes
// down to two things: the physical plane size (handled at the call site,
// in buildWarehouse) and how much contrast survives getting minified from
// this canvas resolution down to a few dozen screen pixels — the band
// name's contrast is pushed high (pure black on a lightened paper stock,
// thicker outline) specifically so it still reads at a distance.
function makePosterTexture(band, sub) {
  const c = document.createElement('canvas');
  c.width = 260; c.height = 364;
  const cx = c.getContext('2d');
  cx.fillStyle = '#d8d2ba';
  cx.fillRect(0, 0, 260, 364);

  // Xerox speckle.
  cx.globalAlpha = 0.5;
  for (let i = 0; i < 340; i++) {
    cx.fillStyle = Math.random() > 0.5 ? '#00000022' : '#ffffff22';
    cx.fillRect(Math.random() * 260, Math.random() * 364, 1, 1);
  }
  cx.globalAlpha = 1;

  cx.strokeStyle = '#0e0c0a';
  cx.lineWidth = 8;
  cx.strokeRect(13, 13, 234, 338);

  cx.fillStyle = '#0a0908';
  cx.textAlign = 'center';
  cx.font = `bold ${band.length > 8 ? 34 : 44}px Impact, "Arial Narrow", sans-serif`;
  cx.save();
  cx.translate(130, 169);
  cx.rotate(-0.03);
  cx.fillText(band.toUpperCase(), 0, 0);
  cx.restore();

  cx.beginPath();
  cx.moveTo(39, 202); cx.lineTo(221, 202);
  cx.lineWidth = 4;
  cx.stroke();

  cx.font = 'bold 19px Georgia, serif';
  cx.fillText(sub, 130, 241);
  cx.font = '15px Georgia, serif';
  cx.fillText('$5 AT THE DOOR', 130, 273);

  // A faint water stain.
  const grad = cx.createRadialGradient(208, 299, 5, 208, 299, 65);
  grad.addColorStop(0, 'rgba(90,70,40,0.28)');
  grad.addColorStop(1, 'rgba(90,70,40,0)');
  cx.fillStyle = grad;
  cx.beginPath();
  cx.arc(208, 299, 65, 0, Math.PI * 2);
  cx.fill();

  // Tape marks at the top corners.
  cx.fillStyle = 'rgba(220,215,200,0.55)';
  cx.fillRect(8, 3, 44, 18);
  cx.fillRect(208, 3, 44, 18);

  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// ─── Poster audio ───────────────────────────────────────────────────────────
// Clicking a poster plays a short MIDI-style riff evocative of that band,
// like a staticy radio tuning in. Actual transcriptions of real
// Nirvana/R.E.M./Beastie Boys/For Squirrels recordings — even rendered as
// MIDI — would still be reproducing those bands' copyrighted compositions,
// so that's not what this builds. Instead: short,
// original note sequences only evocative of each poster's genre/era (a
// grunge-ish power-chord vamp, a jangly arpeggio, a syncopated bassline, an
// alt-rock progression), synthesized live with oscillators and run through
// a bandpass filter plus a hiss layer so it reads as "caught on a cheap
// radio." It also happens to fit the found story better than a real
// recording would — that story is *about* a pirate radio investigation, so
// clicking a flyer to "tune in" a ghost signal is the same idea, just
// interactive. Playback only ever starts from a click (never autoplay),
// which also keeps it inside browser autoplay-gesture rules.
const POSTER_RIFFS = {
  'Nirvana': { wave: 'square', notes: [
    [110, 0.22], [110, 0.22], [130.8, 0.22], [110, 0.22],
    [98, 0.22], [98, 0.22], [110, 0.22], [87.3, 0.42],
  ]},
  'R.E.M.': { wave: 'triangle', notes: [
    [196, 0.16], [247, 0.16], [294, 0.16], [247, 0.16],
    [220, 0.16], [262, 0.16], [330, 0.16], [294, 0.34],
  ]},
  'Beastie Boys': { wave: 'sawtooth', notes: [
    [82, 0.14], [82, 0.1], [110, 0.12], [82, 0.14],
    [73, 0.1], [98, 0.12], [82, 0.14], [65, 0.3],
  ]},
  'For Squirrels': { wave: 'triangle', notes: [
    [164, 0.2], [196, 0.2], [220, 0.2], [196, 0.2],
    [174, 0.2], [196, 0.2], [220, 0.2], [246, 0.4],
  ]},
};

function makeStaticBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// A small soft round sprite for the dust-mote particle system below —
// same "canvas gradient, no image asset" rule as every other texture on
// this site.
function makeDustMoteTexture() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const cx = c.getContext('2d');
  const g = cx.createRadialGradient(8, 8, 0, 8, 8, 8);
  g.addColorStop(0,   'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  g.addColorStop(1,   'rgba(255,255,255,0)');
  cx.fillStyle = g;
  cx.fillRect(0, 0, 16, 16);
  return new THREE.CanvasTexture(c);
}

function buildWarehouse(preview, floorY, ceilingY, rafterY) {
  const group = new THREE.Group();
  const span = preview ? 14 : 20;
  // Full-mode wall distance leaves real walking corridor beyond the
  // outermost rings' physical radius (~5.4) even before a ring collider
  // enters the picture. The preview tile stays at a smaller scale — it's
  // never walkable, so it doesn't need the same clearance.
  const wallDist = preview ? 5 : 8.5;

  const floorMat = new THREE.MeshStandardMaterial({ map: makeConcreteTexture(), roughness: 0.95, metalness: 0.05 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(span * 2, span * 2), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  group.add(floor);

  // Ceiling with a rectangular skylight hole, sized to what the mast
  // actually pokes through, plus a second, smaller skylight panel off to
  // one side — real warehouses almost never have just one skylight panel,
  // and the second opening gives the second angled beam below somewhere
  // to actually originate from, rather than a shaft of light with no
  // visible source.
  const holeW = preview ? 0.7 : 0.9, holeH = preview ? 0.7 : 0.9;
  const hole2W = holeW * 0.55, hole2H = holeH * 0.55;
  const hole2X = span * 0.22, hole2Z = -span * 0.16;
  const shape = new THREE.Shape();
  shape.moveTo(-span, -span);
  shape.lineTo(span, -span);
  shape.lineTo(span, span);
  shape.lineTo(-span, span);
  shape.lineTo(-span, -span);
  const hole = new THREE.Path();
  hole.moveTo(-holeW, -holeH);
  hole.lineTo(holeW, -holeH);
  hole.lineTo(holeW, holeH);
  hole.lineTo(-holeW, holeH);
  hole.lineTo(-holeW, -holeH);
  shape.holes.push(hole);
  const hole2 = new THREE.Path();
  hole2.moveTo(hole2X - hole2W, hole2Z - hole2H);
  hole2.lineTo(hole2X + hole2W, hole2Z - hole2H);
  hole2.lineTo(hole2X + hole2W, hole2Z + hole2H);
  hole2.lineTo(hole2X - hole2W, hole2Z + hole2H);
  hole2.lineTo(hole2X - hole2W, hole2Z - hole2H);
  shape.holes.push(hole2);
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x121110, roughness: 0.9, metalness: 0.1, side: THREE.DoubleSide });
  const ceiling = new THREE.Mesh(new THREE.ShapeGeometry(shape), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ceilingY;
  group.add(ceiling);

  // Roof trusses — a crossed pair spanning near the skylight, offset so
  // they don't cover the hole. What the suspension chains actually bolt to.
  const trussMat = new THREE.MeshStandardMaterial({ map: makeMetalTexture({ base: '#2a2620', rust: '#191510', highlight: '#544838' }), roughness: 0.85, metalness: 0.5 });
  const trussLen = preview ? 6 : 8;
  const trussA = new THREE.Mesh(new THREE.BoxGeometry(trussLen, preview ? 0.07 : 0.09, preview ? 0.07 : 0.09), trussMat);
  trussA.position.set(0, rafterY, 0);
  group.add(trussA);
  const trussB = new THREE.Mesh(new THREE.BoxGeometry(preview ? 0.07 : 0.09, preview ? 0.07 : 0.09, trussLen), trussMat);
  trussB.position.set(0, rafterY, 0);
  group.add(trussB);
  // Cross-braces down to the walls, just for texture — a truss doesn't
  // float on its own.
  [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dz]) => {
    const from = new THREE.Vector3(dx * trussLen / 2, rafterY, dz * trussLen / 2);
    const to = new THREE.Vector3(dx * trussLen / 2, ceilingY - (preview ? 0.5 : 0.7), dz * trussLen / 2);
    addStrut(group, from, to, preview ? 0.02 : 0.026, trussMat);
  });

  // ─── Skylight shafts ────────────────────────────────────────────────────
  // The room's ~30ft vertical scale (the mast poking out through the
  // roof) reads through the few lit things reading as genuinely lit,
  // rather than through added ambient light — the darkness/sparseness is
  // the right instinct for a Myst-style room. Two levers: the beam's own
  // opacity is high enough to actually see the shaft, and — the standard
  // cheap Myst-era trick for selling scale in an empty vertical space —
  // visible dust motes drift through it, added as a particle system just
  // below. Both beams are tilted off vertical ("angled shafts," not
  // straight-down columns) so they read as directional sunlight rather
  // than a generic glow column.
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xcfe0ff, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false,
  });
  const beamGeo = new THREE.CylinderGeometry(holeW * 0.4, holeW * 2.4, ceilingY - floorY, 16, 1, true);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = (ceilingY + floorY) / 2;
  beam.rotation.z = -0.1;
  beam.rotation.x = 0.04;
  group.add(beam);

  // Second, smaller shaft through the second skylight panel above —
  // fainter and narrower than the main one (a secondary opening, not an
  // equal twin), tilted the opposite way so the two don't read as a
  // mechanically repeated pair.
  const beam2Mat = new THREE.MeshBasicMaterial({
    color: 0xdce8ff, transparent: true, opacity: 0.065, side: THREE.DoubleSide, depthWrite: false,
  });
  const beam2Geo = new THREE.CylinderGeometry(hole2W * 0.4, hole2W * 2.1, ceilingY - floorY, 14, 1, true);
  const beam2 = new THREE.Mesh(beam2Geo, beam2Mat);
  beam2.position.set(hole2X * 0.6, (ceilingY + floorY) / 2, hole2Z * 0.6);
  beam2.rotation.z = 0.14;
  beam2.rotation.x = -0.06;
  group.add(beam2);

  // ─── Dust motes ─────────────────────────────────────────────────────────
  // A small particle system drifting slowly upward through both beams —
  // visible dust in a light shaft is the cheapest, most legible way to
  // sell "there is a huge volume of air in this room" that exists, not a
  // geometry problem the way the orrery structure's own scale is.
  // Returned (not animated here) so createOrrery's shared animate() loop
  // can update positions each frame, same pattern buildOrrery uses for
  // orbits/moons.
  const motePositions = [
    { x: 0, z: 0, r0: holeW * 0.4, r1: holeW * 2.4, tiltZ: -0.1, tiltX: 0.04, count: preview ? 70 : 170 },
    { x: hole2X * 0.6, z: hole2Z * 0.6, r0: hole2W * 0.4, r1: hole2W * 2.1, tiltZ: 0.14, tiltX: -0.06, count: preview ? 40 : 90 },
  ];
  const moteCount = motePositions.reduce((s, m) => s + m.count, 0);
  const motePos = new Float32Array(moteCount * 3);
  const moteBase = new Float32Array(moteCount * 3);
  const moteDrift = [];
  let mi = 0;
  motePositions.forEach(beamSpec => {
    for (let k = 0; k < beamSpec.count; k++) {
      const frac = Math.random(); // 0 = floor, 1 = ceiling, along this beam's own axis
      const y = floorY + frac * (ceilingY - floorY);
      const r = beamSpec.r0 + (beamSpec.r1 - beamSpec.r0) * (1 - frac); // wider low, narrower high, matching the cone
      const ang = Math.random() * Math.PI * 2;
      // The beam mesh itself is tilted (rotation.x/z above); approximate
      // that same tilt here so the motes actually sit inside the visible
      // cone rather than a plain vertical column next to it.
      let x = beamSpec.x + r * Math.cos(ang) * (0.55 + Math.random() * 0.45);
      let z = beamSpec.z + r * Math.sin(ang) * (0.55 + Math.random() * 0.45);
      x += Math.sin(beamSpec.tiltZ) * (y - (floorY + ceilingY) / 2);
      z += Math.sin(beamSpec.tiltX) * (y - (floorY + ceilingY) / 2);

      moteBase[mi * 3] = x; moteBase[mi * 3 + 1] = y; moteBase[mi * 3 + 2] = z;
      motePos[mi * 3] = x; motePos[mi * 3 + 1] = y; motePos[mi * 3 + 2] = z;
      moteDrift.push({
        // Slow upward drift (dust rising on thermals) plus a little
        // independent side-to-side wander — each mote loops back to its
        // own start height once it drifts past the ceiling, via modulo in
        // the animate loop rather than a hard reset that would pop.
        riseSpeed: 0.02 + Math.random() * 0.035,
        wobbleAmp: 0.02 + Math.random() * 0.03,
        wobbleSpeed: 0.2 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
        span: ceilingY - floorY,
      });
      mi++;
    }
  });
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteTex = makeDustMoteTexture();
  const moteMat = new THREE.PointsMaterial({
    color: 0xe8ecff, size: preview ? 0.018 : 0.014, map: moteTex,
    transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending,
    depthWrite: false, sizeAttenuation: true,
  });
  const dustMotes = new THREE.Points(moteGeo, moteMat);
  group.add(dustMotes);

  // A couple of dark corrugated walls, back and to one side, pulled in
  // closer than the floor/ceiling extent so the flyers taped to them
  // actually read at a legible size.
  const wallMat = new THREE.MeshStandardMaterial({ map: makeCorrugatedTexture(), roughness: 0.9, metalness: 0.2 });
  const wallHeight = ceilingY - floorY;
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(span * 2, wallHeight), wallMat);
  backWall.position.set(0, (ceilingY + floorY) / 2, -wallDist);
  group.add(backWall);
  const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(span * 2, wallHeight), wallMat);
  sideWall.rotation.y = Math.PI / 2;
  sideWall.position.set(-wallDist, (ceilingY + floorY) / 2, 0);
  group.add(sideWall);

  // Since a visitor can walk around inside the room, all four sides need
  // real walls, or "wandering around" would let you walk straight out
  // into the starfield beyond. Same texture, undecorated — the flyers/pegboard/
  // clutter stay on the original two walls; these just keep the room a
  // room. Normals face inward (rotation chosen the same way the two walls
  // above already do: pointing back toward the room's center).
  const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(span * 2, wallHeight), wallMat);
  frontWall.rotation.y = Math.PI;
  frontWall.position.set(0, (ceilingY + floorY) / 2, wallDist);
  group.add(frontWall);
  const farSideWall = new THREE.Mesh(new THREE.PlaneGeometry(span * 2, wallHeight), wallMat);
  farSideWall.rotation.y = -Math.PI / 2;
  farSideWall.position.set(wallDist, (ceilingY + floorY) / 2, 0);
  group.add(farSideWall);

  // Floor-level colliders for the first-person walkthrough (full mode
  // only — preview never walks around, so this stays empty there). Circle
  // approximations, not exact hitboxes: enough to keep a visitor from
  // walking through the set without needing real per-mesh collision.
  const colliders = [];

  let bulbPosition = null;

  // ─── A ramshackle garage's worth of clutter, plus a few taped-up early-
  // '90s show flyers spaced the way a real wall of flyers actually looks —
  // overlapping, crooked, different sizes, added over time, not evenly
  // gridded. Skipped in preview for performance. ──────────────────────────
  const posterMeshes = [];
  if (!preview) {
    const baseY = floorY + wallHeight * 0.34;
    // Sized and spaced so all four posters read at normal viewing
    // distance without walking up close, with enough gap between them
    // that the larger planes don't lap over each other.
    const posters = [
      { band: 'Nirvana', sub: 'Live — All Ages', x: -2.75, y: baseY + 0.2, rot: -0.09, scale: 1.08, z: -wallDist + 0.03 },
      { band: 'R.E.M.', sub: 'Live — Doors 8pm', x: -0.75, y: baseY - 0.34, rot: 0.05, scale: 0.86, z: -wallDist + 0.025 },
      { band: 'Beastie Boys', sub: 'Live — 18+', x: 0.55, y: baseY + 0.44, rot: -0.05, scale: 1.0, z: -wallDist + 0.035 },
      { band: 'For Squirrels', sub: 'Live — This Fri.', x: 2.45, y: baseY - 0.1, rot: 0.09, scale: 0.78, z: -wallDist + 0.02 },
    ];
    posters.forEach(p => {
      const posterMat = new THREE.MeshStandardMaterial({
        map: makePosterTexture(p.band, p.sub), roughness: 0.85, metalness: 0,
        // High base emissive intensity — these read as lit focal objects
        // worth noticing across a dark room, Myst-style, not just legible
        // once you're already standing in front of one.
        emissive: 0x0c0a08, emissiveIntensity: 0.78,
      });
      const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.3 * p.scale, 1.82 * p.scale), posterMat);
      poster.position.set(p.x, p.y, p.z);
      poster.rotation.z = p.rot;
      group.add(poster);
      // Tracked so the scene can raycast these separately from the hub —
      // clicking one "tunes in" a few bars of static-laden radio (see
      // playPosterRiff in createOrrery). Fits the found story's own
      // premise (a pirate radio investigation) better than a silent wall.
      posterMeshes.push({ mesh: poster, band: p.band, baseEmissive: 0.78 });
    });

    // Pegboard with tools, on the side wall.
    const pegboardMat = new THREE.MeshStandardMaterial({ map: makePegboardTexture(), roughness: 0.9, metalness: 0 });
    const pegboard = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.9), pegboardMat);
    pegboard.rotation.y = Math.PI / 2;
    pegboard.position.set(-wallDist + 0.03, floorY + wallHeight * 0.5, 2.6);
    group.add(pegboard);

    // A stack of cardboard boxes, in the back corner.
    const cardboardMat = new THREE.MeshStandardMaterial({ map: makeCardboardTexture(), roughness: 0.95, metalness: 0 });
    const boxSizes = [[0.55, 0.4, 0.45], [0.42, 0.35, 0.4], [0.48, 0.3, 0.3]];
    let stackY = floorY;
    boxSizes.forEach((size, i) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(...size), cardboardMat);
      stackY += size[1] / 2;
      box.position.set(-wallDist + 1.2 + i * 0.05, stackY, -wallDist + 0.9 - i * 0.08);
      box.rotation.y = (Math.random() - 0.5) * 0.5;
      stackY += size[1] / 2;
      group.add(box);
    });
    colliders.push({ x: -wallDist + 1.22, z: -wallDist + 0.85, r: 0.45 });

    // An old tire, leaning against the back wall.
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x18161a, roughness: 0.85, metalness: 0.1 });
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.11, 10, 20), tireMat);
    tire.rotation.x = Math.PI / 2 + 0.28;
    tire.position.set(2.9, floorY + 0.34, -wallDist + 0.35);
    group.add(tire);
    colliders.push({ x: 2.9, z: -wallDist + 0.35, r: 0.42 });

    // A workbench along the side wall, a little clutter on top, and a bare
    // bulb hanging over it on a cord from the roof truss.
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a4530, roughness: 0.85, metalness: 0 });
    const benchHeight = floorY + 0.55;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 1.6), woodMat);
    bench.position.set(-wallDist + 0.4, benchHeight, -1.5);
    group.add(bench);
    [[-0.6, -2.1], [-0.6, -0.9], [0.6, -2.1], [0.6, -0.9]].forEach(([dx, dz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, benchHeight - floorY, 6), woodMat);
      leg.position.set(-wallDist + 0.4 + dx * 0.15, floorY + (benchHeight - floorY) / 2, dz + 0.6);
      group.add(leg);
    });
    colliders.push({ x: -wallDist + 0.4, z: -1.5, r: 0.9 });
    const clutterMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7, metalness: 0.3 });
    [[-0.05, -1.7, 0.12], [0.08, -1.3, 0.09]].forEach(([dx, dz, s]) => {
      const clutter = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s), clutterMat);
      clutter.position.set(-wallDist + 0.4 + dx, benchHeight + 0.025 + s * 0.4, dz);
      clutter.rotation.y = Math.random();
      group.add(clutter);
    });

    // ─── A few inert mechanical details — micro-Myst objects you'd poke
    // at without being told what they do. None of these are wired to
    // anything; they're not meant to be understood, just found, the way a
    // real workshop accumulates fittings whose original purpose outlived
    // whoever installed them. ──────────────────
    const detailMat = new THREE.MeshStandardMaterial({ color: 0x2e2a24, roughness: 0.65, metalness: 0.55 });
    const detailAccentMat = new THREE.MeshStandardMaterial({ color: 0x8a2a1f, roughness: 0.45, metalness: 0.3 });

    // A wall-mounted gauge above the pegboard, needle frozen at whatever
    // it was last reading — a different angle every time the scene loads.
    const gaugeFaceMat = new THREE.MeshStandardMaterial({ color: 0xc9bfa0, roughness: 0.6, metalness: 0.1 });
    const gaugeGroup = new THREE.Group();
    const gaugeHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 16), detailMat);
    gaugeHousing.rotation.z = Math.PI / 2;
    gaugeGroup.add(gaugeHousing);
    const gaugeFace = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.008, 16), gaugeFaceMat);
    gaugeFace.rotation.z = Math.PI / 2;
    gaugeFace.position.x = 0.015;
    gaugeGroup.add(gaugeFace);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.058, 0.004), detailAccentMat);
    needle.position.set(0.02, 0.02, 0);
    needle.rotation.z = 0.6 + Math.random() * 1.4;
    gaugeGroup.add(needle);
    gaugeGroup.position.set(-wallDist + 0.045, floorY + wallHeight * 0.5 + 0.75, 2.2);
    group.add(gaugeGroup);

    // An idle toggle lever bolted to the front edge of the workbench,
    // thrown to some mid-position and going nowhere.
    const leverBase = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.05), detailMat);
    leverBase.position.set(-wallDist + 0.4 + 0.14, benchHeight + 0.04, -2.0);
    group.add(leverBase);
    const leverArm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), detailMat);
    leverArm.position.set(0, 0.06, 0);
    leverArm.rotation.z = -0.35;
    leverBase.add(leverArm);
    const leverKnob = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), detailAccentMat);
    leverKnob.position.y = 0.12;
    leverArm.add(leverKnob);

    // A valve wheel on a pipe stub, low on the same wall, half-forgotten
    // — sitting at whatever angle it was last turned to.
    const pipeStub = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), detailMat);
    pipeStub.rotation.z = Math.PI / 2;
    pipeStub.position.set(-wallDist + 0.08, floorY + 0.5, 0.6);
    group.add(pipeStub);
    const wheelGroup = new THREE.Group();
    const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.009, 6, 16), detailMat);
    wheelGroup.add(wheelRim);
    for (let i = 0; i < 4; i++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 5), detailMat);
      spoke.rotation.z = (i / 4) * Math.PI;
      wheelGroup.add(spoke);
    }
    wheelGroup.rotation.y = Math.PI / 2;
    wheelGroup.rotation.z = Math.random() * Math.PI * 2;
    wheelGroup.position.set(-wallDist + 0.16, floorY + 0.5, 0.6);
    group.add(wheelGroup);

    // ─── More clutter — a second corner and the space between it and the
    // first are filled out too, reusing the existing texture/material
    // helpers so nothing new gets pulled into the bundle. ───────────────────────────────────────────

    // A second stack of crates, opposite corner from the first, different
    // sizes and offsets so the two piles don't read as copy-pasted.
    const boxSizes2 = [[0.5, 0.45, 0.5], [0.38, 0.3, 0.42], [0.3, 0.28, 0.3], [0.44, 0.22, 0.36]];
    let stackY2 = floorY;
    boxSizes2.forEach((size, i) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(...size), cardboardMat);
      stackY2 += size[1] / 2;
      box.position.set(wallDist - 1.4 - i * 0.08, stackY2, -wallDist + 1.1 + i * 0.1);
      box.rotation.y = (Math.random() - 0.5) * 0.7;
      stackY2 += size[1] / 2;
      group.add(box);
    });
    colliders.push({ x: wallDist - 1.4, z: -wallDist + 1.1, r: 0.5 });

    // A couple of oil drums, grouped near the back wall.
    const drumMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.75, metalness: 0.4 });
    [[1.6, -wallDist + 0.45, 0.2], [2.05, -wallDist + 0.4, 0.6]].forEach(([x, z, rotOffset]) => {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.72, 14), drumMat);
      drum.position.set(x, floorY + 0.36, z);
      drum.rotation.y = rotOffset;
      group.add(drum);
      colliders.push({ x, z, r: 0.35 });
    });

    // A ladder leaning against the back wall, off-center from everything
    // else.
    const ladderMat = new THREE.MeshStandardMaterial({ color: 0x6b5a3c, roughness: 0.8, metalness: 0.1 });
    const ladderGroup = new THREE.Group();
    const railLen = 2.2;
    [-0.18, 0.18].forEach(dx => {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, railLen, 6), ladderMat);
      rail.position.set(dx, 0, 0);
      ladderGroup.add(rail);
    });
    for (let i = 0; i < 6; i++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 6), ladderMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, -railLen / 2 + 0.2 + i * 0.34, 0);
      ladderGroup.add(rung);
    }
    ladderGroup.rotation.x = -0.22;
    ladderGroup.position.set(-3.4, floorY + railLen * 0.46, -wallDist + 0.5);
    group.add(ladderGroup);
    colliders.push({ x: -3.4, z: -wallDist + 0.5, r: 0.3 });

    // Loose lumber, stacked at a slight angle near the second crate pile.
    const plankMat = new THREE.MeshStandardMaterial({ color: 0x4a3c28, roughness: 0.9, metalness: 0 });
    for (let i = 0; i < 4; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.14), plankMat);
      plank.position.set(wallDist - 0.5, floorY + 0.08 + i * 0.05, -wallDist + 2.6);
      plank.rotation.z = 0.05 + i * 0.01;
      plank.rotation.y = 0.15;
      group.add(plank);
    }

    // Coiled cable on the floor near the workbench — loose torus segments
    // rather than one perfect ring, so it reads as slack coil.
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.7, metalness: 0.1 });
    for (let i = 0; i < 3; i++) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.22 - i * 0.03, 0.018, 6, 16), cableMat);
      loop.rotation.x = Math.PI / 2;
      loop.position.set(-wallDist + 1.0, floorY + 0.02 + i * 0.015, -0.4);
      group.add(loop);
    }

    // A stool at the workbench, pushed slightly out as though someone
    // just stood up.
    const stoolMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.7, metalness: 0.3 });
    const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12), stoolMat);
    stoolSeat.position.set(-wallDist + 0.9, floorY + 0.42, -1.3);
    group.add(stoolSeat);
    colliders.push({ x: -wallDist + 0.9, z: -1.3, r: 0.3 });
    for (let i = 0; i < 3; i++) {
      const legAngle = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6), stoolMat);
      leg.position.set(
        -wallDist + 0.9 + Math.cos(legAngle) * 0.13,
        floorY + 0.21,
        -1.3 + Math.sin(legAngle) * 0.13
      );
      leg.rotation.x = Math.sin(legAngle) * 0.08;
      leg.rotation.z = Math.cos(legAngle) * 0.08;
      group.add(leg);
    }

    // A couple of loose flyers that missed the wall, curled on the floor —
    // reusing the same poster-texture generator with two more band names.
    [[1.1, -wallDist + 0.9, 0.3, 'Fugazi'], [1.6, -wallDist + 1.4, -0.2, 'Pavement']].forEach(([x, z, rot, band]) => {
      const fallenMat = new THREE.MeshStandardMaterial({
        map: makePosterTexture(band, 'Live — Doors 9pm'),
        roughness: 0.9, metalness: 0, side: THREE.DoubleSide,
      });
      const fallen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), fallenMat);
      fallen.rotation.x = -Math.PI / 2;
      fallen.rotation.z = rot;
      fallen.position.set(x, floorY + 0.01, z);
      group.add(fallen);
    });

    // A couple of idle chains hanging from the truss, well clear of the
    // orrery's own suspension near the center — leftover rigging a working
    // space just accumulates and never takes down.
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x201d18, roughness: 0.6, metalness: 0.7 });
    [[-2.6, 0.6], [2.4, -0.4]].forEach(([x, z]) => {
      addStrut(group, new THREE.Vector3(x, rafterY - 0.03, z), new THREE.Vector3(x, floorY + 1.4, z), 0.008, chainMat);
    });

    bulbPosition = new THREE.Vector3(-wallDist + 0.6, benchHeight + 0.9, -1.5);
    const cordMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    addStrut(group, new THREE.Vector3(bulbPosition.x, rafterY - 0.05, bulbPosition.z), bulbPosition, 0.006, cordMat);
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe8b0, emissive: 0xffcc77, emissiveIntensity: 1.6, roughness: 0.4 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), bulbMat);
    bulb.position.copy(bulbPosition);
    group.add(bulb);
  }

  return {
    group, bulbPosition, posters: posterMeshes, colliders, wallDist,
    dust: { geo: moteGeo, mat: moteMat, tex: moteTex, base: moteBase, drift: moteDrift, count: moteCount },
  };
}

// ─── First-person rig ──────────────────────────────────────────────────────
// Scott: "have first-person camera movement in orrery, like someone's
// wandering around with arrow keys... with mouse-look and collision...
// feel like a Myst level." Full scene only — the preview tile keeps its
// old drag-orbits-the-room illusion (see createOrrery's interaction
// section), since a thumbnail-sized tile isn't somewhere anyone's going to
// walk around. Here, the room stays fixed in world space and the camera
// actually moves through it.
//
// Mouse-look has two input paths feeding the same yaw/pitch state:
// pointer-lock (desktop, click once to engage — raw movementX/Y) and
// plain drag (mouse-down-and-drag, or touch — works without a lock,
// everywhere pointer lock doesn't, e.g. mobile). Both use the same sign
// convention — drag/move right turns the view right — standard "mouse-
// look," matching three.js's own PointerLockControls. This deliberately
// does NOT match the sitewide drag-to-orbit convention used elsewhere
// (sphere/orbiter/butterfly/the orrery preview tile, where dragging right
// rotates the OBJECT rather than the view): those scenes are rotating a
// thing you're looking at from outside; this one is you, inside the room,
// turning your head. Different enough mechanics that matching the old
// convention would be a coincidence, not a consistency win — the two
// look/drag paths within this one first-person rig matching each other
// matters more than either one matching a different kind of scene.
function createFirstPersonRig({ container, camera, renderer, colliders, wallLimit, eyeY, startPos, startYaw, isBlocked, crosshair, prompt, padEl }) {
  let yaw = startYaw, pitch = 0;
  camera.rotation.order = 'YXZ';
  camera.position.set(startPos.x, eyeY, startPos.z);
  camera.rotation.set(pitch, yaw, 0);

  const pos = new THREE.Vector2(startPos.x, startPos.z);
  const velocity = new THREE.Vector2();
  const forward3 = new THREE.Vector3();
  const moveDir = new THREE.Vector2();
  const canvasEl = renderer.domElement;

  // Held-key / held-button state — keyboard and the on-screen touch d-pad
  // (mobile, no keyboard to hold WASD/arrows on) both just flip these same
  // four flags, so the movement math below never has to know which input
  // it came from.
  const move = { forward: false, back: false, left: false, right: false };

  let locked = false;
  const canLock = typeof canvasEl.requestPointerLock === 'function';

  // ─── Crosshair ──────────────────────────────────────────────────────────
  // Once the pointer's locked there's no visible OS cursor to hover things
  // with — and even before locking, drag-to-look already decouples the
  // literal cursor position from where the camera's actually pointed. So
  // the scene always raycasts from screen-center now (see animate() in
  // createOrrery), locked or not; this dot is what that point actually is,
  // and the OS cursor itself is hidden the whole time in full mode (see
  // container.style.cursor in createOrrery). Markup itself (.orrery-
  // crosshair/-lock-prompt/-walkpad) lives in orrery.html, parsed once in
  // createOrrery and handed down here so both consumers share one fragment.
  container.appendChild(crosshair);

  // ─── "click to look around" prompt — pointer lock can only ever be
  // requested from a real user gesture, never automatically, so this
  // stays up until the first click (or just fades out on touch, where
  // there's no lock to request — drag-to-look already works there without
  // it).
  prompt.textContent = canLock ? 'click to look around' : 'drag to look around';
  container.appendChild(prompt);
  let promptFadeTimer = null;
  if (!canLock) {
    prompt.style.pointerEvents = 'none';
    promptFadeTimer = setTimeout(() => prompt.classList.add('hidden'), 2400);
  }

  // ─── On-screen walk buttons — coarse-pointer (touch) devices only;
  // there's no keyboard there to hold WASD/arrows on. Only appended (and
  // wired up) when actually needed; otherwise padEl is left in the
  // detached fragment and simply garbage-collected. ──────────────────────
  const isCoarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  if (isCoarse) {
    container.appendChild(padEl);
    const bind = (cls, key) => {
      const el = padEl.querySelector(cls);
      const on = e => { e.preventDefault(); move[key] = true; };
      const off = () => { move[key] = false; };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointerleave', off);
      el.addEventListener('pointercancel', off);
    };
    bind('.wp-fwd', 'forward');
    bind('.wp-back', 'back');
    bind('.wp-left', 'left');
    bind('.wp-right', 'right');
  }

  // ─── Keyboard ───────────────────────────────────────────────────────────
  const KEY_MAP = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back',    ArrowDown: 'back',
    KeyA: 'left',    ArrowLeft: 'left',
    KeyD: 'right',   ArrowRight: 'right',
  };
  const onKeyDown = e => {
    const flag = KEY_MAP[e.code];
    if (!flag) return;
    move[flag] = true;
    e.preventDefault(); // arrows shouldn't also scroll the page underneath
  };
  const onKeyUp = e => {
    const flag = KEY_MAP[e.code];
    if (flag) move[flag] = false;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  // If focus leaves the window mid-stride (alt-tab, devtools) a key can
  // get stuck "down" forever, since its keyup never reaches here — drop
  // all movement the moment the window blurs.
  const onBlur = () => { move.forward = move.back = move.left = move.right = false; };
  window.addEventListener('blur', onBlur);

  // ─── Mouse-look ─────────────────────────────────────────────────────────
  const onPointerLockChange = () => {
    locked = document.pointerLockElement === canvasEl;
    // Simple toggle, on purpose: tryEngage genuinely re-engages on any
    // click while unlocked (see below), so a visible "click to look
    // around" is a real, working invitation every time you're unlocked —
    // including right after closing the read-more panel (releaseLock(),
    // below), which is exactly when a visitor most needs the reminder
    // that clicking gets them back into look-around mode.
    prompt.classList.toggle('hidden', locked);
  };
  document.addEventListener('pointerlockchange', onPointerLockChange);

  const onMouseMoveLocked = e => {
    if (!locked) return;
    yaw   -= e.movementX * LOOK_SENS_MOUSE;
    pitch -= e.movementY * LOOK_SENS_MOUSE;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
  };
  document.addEventListener('mousemove', onMouseMoveLocked);

  const orbitDrag = bindOrbitDrag(container, {
    onDrag: (dx, dy) => {
      if (locked) return; // pointer-lock's own mousemove above already owns this
      // Same sign as the pointer-lock path above: dx is positive for a
      // rightward drag (bindOrbitDrag's own convention), so this matches
      // "drag/move right, view turns right" in both input paths.
      yaw -= dx;
      pitch -= dy;
      pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
    },
  });

  // Click/tap engages pointer lock (desktop) instead of acting on whatever's
  // under the crosshair — returns true when it consumed the event that way,
  // so the scene's own click handler can bail out early rather than also
  // opening a panel the visitor didn't mean to open. Not just a first-click
  // gate: any click while unlocked re-engages, which matters once
  // releaseLock() (below) has been used — the click that follows closing
  // the read-more panel should resume look-around, not be treated as a
  // fresh "select whatever's under the crosshair" click.
  function tryEngage(e) {
    if (isBlocked?.(e)) return false;
    if (!canLock || locked) return false;
    prompt.classList.add('hidden');
    canvasEl.requestPointerLock();
    return true;
  }
  const onPromptClick = e => { tryEngage(e); };
  prompt.addEventListener('click', onPromptClick);

  // Pointer lock routes every mouse event exclusively to the element that
  // holds it (the canvas) — a sibling DOM element, like the read-more
  // panel's own close button or the keyboard jump list, never receives a
  // real click while locked, no matter where the invisible OS cursor
  // conceptually is. createOrrery calls this from openPanel() so the
  // panel becomes clickable the moment it opens; tryEngage (above)
  // re-engages on the click that follows closing it.
  function releaseLock() {
    if (document.pointerLockElement === canvasEl) document.exitPointerLock();
  }

  // ─── Movement + collision ───────────────────────────────────────────────
  // Circle-vs-circle push-out against every collider, plus a hard clamp to
  // the four walls — enough fidelity for "don't walk through the set,"
  // not a full physics engine. Two passes so overlapping colliders (e.g.
  // a corner where two crate piles are close) both get to push.
  function resolveCollisions(x, z) {
    for (let pass = 0; pass < 2; pass++) {
      for (const c of colliders) {
        const dx = x - c.x, dz = z - c.z;
        const dist = Math.hypot(dx, dz);
        const minDist = c.r + PLAYER_RADIUS;
        if (dist > 0 && dist < minDist) {
          const push = (minDist - dist) / dist;
          x += dx * push;
          z += dz * push;
        }
      }
    }
    x = Math.max(-wallLimit, Math.min(wallLimit, x));
    z = Math.max(-wallLimit, Math.min(wallLimit, z));
    return { x, z };
  }

  function update(dt) {
    camera.rotation.set(pitch, yaw, 0);

    // Forward/right in the horizontal plane only — looking up or down
    // shouldn't change walking speed or fly you into the floor/ceiling.
    camera.getWorldDirection(forward3);
    forward3.y = 0;
    if (forward3.lengthSq() < 1e-6) forward3.set(0, 0, -1); else forward3.normalize();
    const rightX = -forward3.z, rightZ = forward3.x;

    moveDir.set(0, 0);
    if (move.forward) { moveDir.x += forward3.x; moveDir.y += forward3.z; }
    if (move.back)    { moveDir.x -= forward3.x; moveDir.y -= forward3.z; }
    if (move.right)   { moveDir.x += rightX;      moveDir.y += rightZ; }
    if (move.left)    { moveDir.x -= rightX;      moveDir.y -= rightZ; }
    if (moveDir.lengthSq() > 1e-6) moveDir.normalize();

    const targetVel = moveDir.multiplyScalar(WALK_SPEED);
    const ease = 1 - Math.exp(-MOVE_ACCEL * dt);
    velocity.lerp(targetVel, ease);

    const next = resolveCollisions(pos.x + velocity.x * dt, pos.y + velocity.y * dt);
    pos.set(next.x, next.z);
    camera.position.set(pos.x, eyeY, pos.y);
  }

  return {
    update,
    tryEngage,
    releaseLock,
    crosshairEl: crosshair,
    get locked() { return locked; },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMoveLocked);
      orbitDrag.dispose();
      prompt.removeEventListener('click', onPromptClick);
      if (promptFadeTimer) clearTimeout(promptFadeTimer);
      if (document.pointerLockElement === canvasEl) document.exitPointerLock();
      crosshair.remove();
      prompt.remove();
      padEl?.remove();
    },
  };
}

export function createOrrery(container, { preview = false } = {}) {
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(54, w / h, 0.1, 500);
  // Preview tile: same fixed, pulled-back establishing shot as before —
  // it never got the first-person treatment (see the interaction section
  // below), so this framing is untouched. Full scene: the camera's actual
  // starting transform is set by createFirstPersonRig() further down,
  // since it now lives inside the walkable room rather than at a distant
  // vantage point outside it.
  if (preview) {
    camera.position.set(1.1, 0.3, 13.3);
    camera.lookAt(0, -0.15, 0);
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  // A touch of warmth over pure black (0x030303 before) — the fog is doing
  // real atmospheric-haze work now that the compressed-video overlay isn't
  // around to fake it, so it reads closer to a lamp-lit room's own dim
  // ambient color than a void.
  renderer.setClearColor(0x0a0704, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  // Preview tiles: never append the WebGL canvas itself — see
  // mountClippedPreviewCanvas's own comment in sceneKit.js (Scott
  // confirmed this scene has the same Firefox square-tile bug the fix was
  // originally written for). Full scene is unaffected (no circular tile
  // there), so it keeps the plain direct append it always had.
  const clippedPreview = preview ? mountClippedPreviewCanvas(container, renderer) : null;
  if (!preview) container.appendChild(renderer.domElement);

  // Programmatically focusable so closing the panel (✕, outside click, or
  // Escape) has somewhere real to send focus back to, rather than leaving
  // it on a now-hidden close button or nowhere at all.
  if (!preview) container.tabIndex = -1;

  // Fog matched to the clear color so only genuinely distant geometry
  // (far wall corners, stars beyond the skylight) softens into haze — the
  // soft render-distance falloff of early-90s pre-rendered CG adventure
  // games (Myst, Return to Zork, The 7th Guest) doing the work honestly,
  // in the render itself, rather than an overlay standing in for it.
  // Far distance kept well beyond the camera-to-orrery range (camera now
  // sits at z 13.3/16.8) so the machine itself never fogs out — it had
  // been eating into the enlarged orrery and washing out the preview tile
  // almost entirely.
  scene.fog = new THREE.Fog(0x0a0704, preview ? 9 : 12, preview ? 30 : 42);

  // ─── Lighting — dim industrial ambience, brightened a step (Scott: it
  // was starting too dark), a cool wash falling through the skylight, a
  // warm accent low down near the machine itself. ────────────────────────
  scene.add(new THREE.HemisphereLight(0x64778a, 0x14100c, 0.8));
  const skyLight = new THREE.DirectionalLight(0xcfe0ff, 1.15);
  skyLight.position.set(0.4, 6, 0.3);
  scene.add(skyLight);
  scene.add(new THREE.AmbientLight(0x554a3c, 0.35));

  // ─── Warehouse vertical layout — decided here, then handed down: the
  // ceiling and roof truss height are fixed first, and the orrery hangs
  // from a suspension point below the truss, with clear air beneath it
  // before the floor. ───────────────────────────────────────────────────
  const ceilingY  = preview ? 2.5 : 3.3;
  const rafterY   = ceilingY - (preview ? 0.35 : 0.45);
  const suspendTopY = rafterY - (preview ? 0.3 : 0.4);
  const orrery = buildOrrery(preview, suspendTopY, rafterY);

  const floorY = orrery.baseY - (preview ? 0.9 : 1.3);
  const warehouse = buildWarehouse(preview, floorY, ceilingY, rafterY);

  // ─── Ground glimpse (Constellation entry point) ─────────────────────────
  // Orrery is one of only two scenes with a real ground plane — the other
  // is beamline's terrain; see src/utils/constellationEntry.js's own
  // header comment for why every other scene doesn't get this. The floor
  // here is genuinely flat concrete (buildWarehouse above), not a height
  // field, so pickPoint is simpler than beamline's own: a random offset
  // from wherever the visitor is actually standing right now (camera.
  // position tracks the first-person rig's own world position at eye
  // height), clamped inside the walls — near the visitor on purpose,
  // since a glimpse spawning across the warehouse from a walking visitor
  // would rarely actually be seen.
  const GLIMPSE_TRIGGER_PROBABILITY = 0.012; // calibrated live, 2026-08-16 — see NOTES.md's Phase 3 entry
  const groundGlimpse = !preview ? createGroundGlimpse({
    scene,
    pickPoint: () => {
      const ang = Math.random() * Math.PI * 2;
      const dist = 3 + Math.random() * 6;
      const bound = warehouse.wallDist - 1;
      return {
        x: THREE.MathUtils.clamp(camera.position.x + Math.cos(ang) * dist, -bound, bound),
        y: floorY,
        z: THREE.MathUtils.clamp(camera.position.z + Math.sin(ang) * dist, -bound, bound),
      };
    },
    radius: 2.2, // human-scale, not beamline's landscape scale — this floor is walked on close-up, not viewed from a distant orbit
    checkIntervalSec: 2.5,
    triggerProbability: GLIMPSE_TRIGGER_PROBABILITY,
  }) : null;
  // Live calibration/testing hook only — never read by production code.
  if (!preview && groundGlimpse) window.__pmGroundGlimpse = groundGlimpse;

  // The orrery's own ring/mast structure is the namesake mechanism and
  // should be the single most confidently-lit object in the room, ahead
  // of the small planet bodies it carries. A dedicated spotlight aimed at
  // the ring assembly (rather than another global fill light, which would
  // fight the deliberate Myst-style darkness everywhere else) — angled
  // down from roughly where the main skylight shaft above falls, so the
  // two read as the same light source rather than two unrelated ones.
  const structureTarget = new THREE.Object3D();
  structureTarget.position.set(0, orrery.baseY + orrery.mastHeight * 0.32, 0);
  scene.add(structureTarget);
  const structureKey = new THREE.SpotLight(
    0xffe9c4, preview ? 1.8 : 2.6, preview ? 11 : 16,
    Math.PI / 4.2, 0.45, 1.3
  );
  structureKey.position.set(1.5, orrery.baseY + orrery.mastHeight * 1.05, 1.1);
  structureKey.target = structureTarget;
  scene.add(structureKey);

  // The work light lives at the hanging bulb prop if the garage clutter
  // pass built one (full mode only); otherwise a plain accent near the
  // machine, same as before.
  const workLight = new THREE.PointLight(0xffaa55, 0.9, preview ? 9 : 13);
  if (warehouse.bulbPosition) workLight.position.copy(warehouse.bulbPosition);
  else workLight.position.set(1.2, -0.6, 1.4);
  scene.add(workLight);

  // Sparse sky beyond the skylight — only really visible through the hole
  // and at the frame edges, not an all-encompassing backdrop.
  const starCount = preview ? 140 : 320;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * (preview ? 18 : 28);
    positions[i * 3 + 1] = ceilingY + Math.random() * (preview ? 4 : 6);
    positions[i * 3 + 2] = (Math.random() - 0.5) * (preview ? 18 : 28);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xddeeff, size: preview ? 0.03 : 0.045, transparent: true, opacity: 0.55, sizeAttenuation: true,
  });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  const root = new THREE.Group();
  scene.add(root);
  root.add(orrery.group);
  root.add(warehouse.group);

  // ─── Panel + window-chrome styling ───────────────────────────────────────
  // Panel/hint/caption/title/crosshair/walkpad markup+styles live in
  // orrery.html and orrery.css — no runtime element construction or style
  // injection needed now that both are real files, pulled in via parseHTML.

  // ─── Panel (full only) ────────────────────────────────────────────────────
  let panel = null, panelTitle = null, panelEra = null, panelNote = null, panelCloser = null, jumpList = null, threadUI = null;
  let hint = null, caption = null, vignette = null, grain = null, title = null;
  let checkTitleHintCollision = null;
  let shell = null, crosshairEl = null, lockPromptEl = null, walkpadEl = null;
  if (!preview) {
    shell = parseHTML(orreryHtml);
    vignette = shell.querySelector('.orrery-vignette');
    grain = shell.querySelector('.orrery-grain');
    title = shell.querySelector('.orrery-title');
    panel = shell.querySelector('.orrery-panel');
    hint = shell.querySelector('.orrery-hint');
    caption = shell.querySelector('.orrery-caption');
    crosshairEl = shell.querySelector('.orrery-crosshair');
    lockPromptEl = shell.querySelector('.orrery-lock-prompt');
    walkpadEl = shell.querySelector('.orrery-walkpad');

    container.appendChild(vignette);
    container.appendChild(grain);
    document.body.appendChild(title);

    // The ambient title and the panel's own heading both show ORRERY.name
    // (orrery.text.js) — real data, set here rather than baked into
    // orrery.html, same convention as library.js's per-item panel text.
    title.querySelector('.orrery-title-main').textContent = ORRERY.name;

    // role/aria-modal/aria-labelledby live directly on .orrery-panel in
    // orrery.html. The ✦ bullet + era/provenance line here is deliberate,
    // not an inconsistency with orbiter.js's Haiku panel or sphere.js's
    // Digression panel, which have neither: this scene's whole panel is
    // ONE found artifact (a real short-short someone else wrote, author
    // and provenance unknown — see the colophon's Bibliography), so it
    // gets real attribution, the same way library.js's per-item panel
    // shows creator/publisher/year for its found books and films. Orbiter/
    // Sphere's panels cycle through many of Scott's own WRITTEN pieces —
    // his own authorship is already stated once in the colophon, so
    // there's no per-item provenance to show, and no bullet either.
    // Found gets attribution; written doesn't. Site-wide rule, not a gap.
    panelTitle = panel.querySelector('.orrery-panel-title');
    panelEra   = panel.querySelector('.orrery-panel-era');
    panelNote  = panel.querySelector('.orrery-panel-note');
    panelTitle.textContent = `✦ ${ORRERY.name}`;
    panelEra.textContent = ORRERY.era;
    panelNote.innerHTML = ORRERY.note;
    // Thread-follow filament, wired once here rather than from openPanel()
    // — the orrery's panel content is entirely static (one found artifact,
    // ORRERY.id === 1 always), same "no separate open-time population" case
    // as scroll's own per-patch wiring.
    threadUI = wireResonanceThread(panel, 'orrery', ORRERY.id);
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    // First-person pass: the OS cursor is hidden the whole time in full
    // mode — hover/click targeting always raycasts from screen-center now
    // (see createFirstPersonRig's crosshair), so a wandering system arrow
    // would just be a visual mismatch with what's actually being aimed at.
    container.style.cursor = 'none';
    container.appendChild(panel);

    // Close callback shared by the close button, Escape, and an outside
    // click (via createPanelCloser/panelCloser.close() below): resets
    // `selected` and re-syncs emphasis to whatever's actually hovered right
    // now, not just unconditionally off — matters because the crosshair can
    // still be resting on the control box the instant the panel closes.
    panelCloser = createPanelCloser(panel, container, {
      closeBtn: panel.querySelector('.orrery-panel-close'),
      onClose: () => {
        hideAmbient(false);
        selected = false;
        setEmphasis(hovered);
        // Undo openPanel()'s cursor reveal — back to crosshair-only aiming
        // once the panel's gone. Pointer lock itself isn't re-requested
        // here (browsers only grant it from a direct user gesture); the
        // next real click on the canvas re-engages it via fp.tryEngage.
        container.style.cursor = 'none';
      },
    });

    // Keyboard equivalent for "look at the control box" or "look at a
    // flyer" — the control box and the flyers are otherwise raycast-only,
    // aimed via the first-person crosshair. One button for the found
    // story, one per flyer (each plays its own riff directly, same as
    // playPosterRiff(band) below the click
    // handler already does), so a keyboard-only visitor can read and listen
    // without ever having to aim.
    jumpList = createJumpList(container, {
      label: 'Read the found story, or tune in a flyer on the wall',
      items: [{ kind: 'panel' }, ...warehouse.posters.map(p => ({ kind: 'poster', band: p.band }))],
      getLabel: item => item.kind === 'panel' ? 'Read the found story (control box)' : `Tune in: ${item.band} flyer`,
      onSelect: item => {
        if (item.kind === 'panel') { selected = true; setEmphasis(true); openPanel(); }
        else playPosterRiff(item.band);
      },
    });

    document.body.appendChild(hint);
    document.body.appendChild(caption);

    // See the .orrery-hint.stacked comment above: measure the actual
    // rendered rects instead of guessing a pixel breakpoint. rAF-deferred
    // so it reads layout after the browser has actually placed both
    // elements (their width depends on font load / letter-spacing, not
    // just the numbers in this file), and re-checked on every resize.
    checkTitleHintCollision = () => {
      if (!title || !hint) return;
      const t = title.getBoundingClientRect();
      const h = hint.getBoundingClientRect();
      const overlaps = t.right > h.left && t.left < h.right && t.bottom > h.top && t.top < h.bottom;
      hint.classList.toggle('stacked', overlaps);
      // Measured, not guessed (see the block comment above this function):
      // .stacked's own top:7.6rem in CSS assumes the title block is
      // exactly two short lines, but at some widths the subtitle wraps to
      // two lines itself, pushing its real bottom edge past that fixed
      // offset and crowding the hint right up against it. Once stacked,
      // position the hint a fixed gap below the title's own *measured*
      // bottom instead, so it tracks however many lines the title block
      // actually rendered as, at any width or font metrics. Cleared on
      // the non-stacked path so the default CSS top:4.5rem (title and
      // hint side by side, not stacked) applies again.
      hint.style.top = overlaps ? `${t.bottom + 16}px` : '';
    };
    requestAnimationFrame(checkTitleHintCollision);
  }

  // ─── Interaction ─────────────────────────────────────────────────────────
  // Hover/click targeting always raycasts from screen-center now (the
  // first-person crosshair), not literal mouse position — see animate()
  // below and createFirstPersonRig's own comment for why.
  const raycaster = new THREE.Raycaster();
  let hovered = false, selected = false, hoveredGlimpse = false;
  let fp = null;

  function setEmphasis(on) {
    orrery.lampMat.emissiveIntensity = on ? 2.2 : 1;
    orrery.hitTarget.scale.setScalar(on ? 1.4 : 1.0);
  }

  // The ambient title/hint/caption are fixed to document.body at
  // z-index:310, specifically so they clear #experience-overlay's own
  // z-index:300 (see the CSS comments above). .orrery-panel lives inside
  // that overlay and can never out-rank a body-level sibling no matter its
  // own z-index — so once the panel's open, fade the ambient labels out
  // instead; they're redundant once the panel has its own title showing.
  function hideAmbient(hidden) {
    title.classList.toggle('panel-open', hidden);
    hint.classList.toggle('panel-open', hidden);
    caption.classList.toggle('panel-open', hidden);
  }

  function openPanel() {
    panel.classList.add('open');
    hideAmbient(true);
    // Release pointer lock so the panel's own buttons (close, jump list)
    // become clickable — see releaseLock()'s own comment in
    // createFirstPersonRig for why they otherwise can't be. fp.tryEngage
    // (already wired into every click path) re-engages on whatever click
    // follows the panel closing. The OS cursor is CSS-hidden the rest of
    // the time (crosshair-based aiming, see container.style.cursor='none'
    // at scene setup) — restore it too, or the panel would be clickable
    // but the visitor still couldn't see where to click.
    fp?.releaseLock();
    container.style.cursor = '';
    setTimeout(() => panelTitle.focus(), 50);
  }

  // ─── Poster audio ─────────────────────────────────────────────────────
  // Lazily created on first click, per instance, so preview + full-scene
  // audio contexts never fight each other and dispose() has a clean
  // context of its own to close. See POSTER_RIFFS/makeStaticBuffer above
  // for what this plays and why it's original material, not a real track.
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playPosterRiff(band) {
    const riff = POSTER_RIFFS[band];
    if (!riff) return;
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const totalDur = riff.notes.reduce((s, [, d]) => s + d, 0) + 0.6;

    // "Tuning in": a quick swell up, a hold, then a fade — rather than a
    // hard on/off — so it reads as catching a signal, not a sound effect.
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.5, now + 0.15);
    master.gain.setValueAtTime(0.5, now + Math.max(0.15, totalDur - 0.45));
    master.gain.linearRampToValueAtTime(0, now + totalDur);
    master.connect(ctx.destination);

    // Bandpass stands in for a cheap speaker's narrow frequency response —
    // everything (notes and static both) gets routed through this.
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1400;
    bandpass.Q.value = 0.7;
    bandpass.connect(master);

    // Static/hiss bed underneath the notes.
    const staticSrc = ctx.createBufferSource();
    staticSrc.buffer = makeStaticBuffer(ctx, totalDur);
    const staticGain = ctx.createGain();
    staticGain.gain.value = 0.07;
    staticSrc.connect(staticGain).connect(bandpass);
    staticSrc.start(now);
    staticSrc.stop(now + totalDur);

    // The original, genre-evocative note sequence itself.
    let t = now + 0.15;
    riff.notes.forEach(([freq, dur]) => {
      const osc = ctx.createOscillator();
      osc.type = riff.wave;
      osc.frequency.value = freq;
      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0.9, t);
      noteGain.gain.setValueAtTime(0.9, t + dur * 0.7);
      noteGain.gain.linearRampToValueAtTime(0, t + dur);
      osc.connect(noteGain).connect(bandpass);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    });
  }

  let hoveredPoster = null;

  // Named so dispose() can remove them — container is the shared
  // #experience-container element every scene reuses (main.js only clears
  // its innerHTML between scenes, it never replaces the node itself), so
  // any listener bound directly to it and never removed keeps firing
  // after the scene it belongs to is gone. That's exactly what Scott hit:
  // clicking on the orbiter scene played an orrery poster's audio riff,
  // because this click handler — bound here, on that same shared
  // container — was still attached and its closure still had a hovered
  // poster reference from before the switch.
  let onContainerClick;
  let touchGuard;

  if (!preview) {
    // Tap-vs-drag distinction still matters in first-person mode — a
    // touch-drag to look around shouldn't also register as a click on
    // whatever the crosshair happened to end up over.
    touchGuard = bindTapVsDrag(container);
    onContainerClick = e => {
      if (touchGuard.consume()) return;
      // First click/tap just engages mouse-look (desktop pointer lock);
      // it doesn't also act on whatever's under the crosshair.
      if (fp.tryEngage(e)) return;
      // Glimpse takes priority over everything else a click could mean
      // here — it's rare and brief on purpose, so if one happens to be
      // active when a visitor clicks, that's almost certainly what they
      // meant to hit, poster/orrery/panel notwithstanding.
      if (hoveredGlimpse && groundGlimpse?.consumeIfHit([groundGlimpse.hitMesh])) return;
      if (panel.classList.contains('open')) {
        // Only close on an actual empty-space click, letting a poster hit
        // still play whether the panel is open or not — hovered/
        // hoveredPoster are both updated every frame from the crosshair
        // regardless of panel state (see the animate() loop), so they're
        // already current here.
        if (hoveredPoster) { playPosterRiff(hoveredPoster.band); return; }
        if (!panel.contains(e.target)) panelCloser.close();
        return;
      }
      if (hoveredPoster) { playPosterRiff(hoveredPoster.band); return; }
      if (!hovered) return;
      selected = true;
      setEmphasis(true);
      openPanel();
    };
    container.addEventListener('click', onContainerClick);
  }

  // ─── Camera control ──────────────────────────────────────────────────────
  // Reduced motion: the continuous orbital rotation below (planets/
  // unknowns) is exactly the kind of autonomous, never-stopping motion
  // prefers-reduced-motion is for — walking/mouse-look/drag-to-orbit all
  // stay available regardless, since that's motion the visitor asks for,
  // not motion imposed on them.
  const reduceMotion = prefersReducedMotion();

  let orbitDrag = null, wheelZoom = null, targetRotationY = root.rotation.y;

  if (preview) {
    // Preview tile: drag nudges a target angle, animate() eases root's
    // rotation toward it, no camera movement at all. See the first-person
    // rig above for what full mode does instead.
    orbitDrag = bindOrbitDrag(container, {
      onDrag: dx => { targetRotationY += dx; },
    });
    wheelZoom = bindWheelZoom(container, {
      onZoom: deltaY => {
        camera.position.z = Math.max(1.4, Math.min(38, camera.position.z + deltaY * 0.01));
      },
    });
  } else {
    // ─── Ring-dip colliders ───────────────────────────────────────────
    // Each ring is a torus tilted by `tilt` about the X axis (see the
    // ring.rotation.x = π/2 + tilt in buildOrrery). Most of a tilted ring
    // stays well overhead — only the low side of the biggest rings ever
    // dips down near eye height at all, at two points (mirrored across
    // x=0). Solving the tilted-torus parametric equation
    // (x,y,z) = (R cosθ, yOffset − R sinθ sin(tilt), R sinθ cos(tilt))
    // for the θ where y = eyeY gives exactly those two points — everyone
    // else on the ring is either above or below that height and never
    // actually blocks a walking visitor at eye level.
    const eyeYAbs = floorY + EYE_HEIGHT;
    const ringDipColliders = [];
    orrery.ringInfo.forEach(({ radius, yOffset, tilt }) => {
      const sinTilt = Math.sin(tilt);
      if (Math.abs(sinTilt) < 1e-6) return;
      const sinTheta = (yOffset - eyeYAbs) / (radius * sinTilt);
      if (sinTheta < -1 || sinTheta > 1) return; // this ring never reaches eye height
      const cosTheta = Math.sqrt(Math.max(0, 1 - sinTheta * sinTheta));
      const zDip = radius * sinTheta * Math.cos(tilt);
      const xDip = radius * cosTheta;
      // A small collider at each mirrored dip point — sized a bit past
      // the ring's own thin tube radius, enough to actually register as
      // "something's there" without becoming its own obstacle course.
      ringDipColliders.push({ x: xDip, z: zDip, r: 0.22 });
      ringDipColliders.push({ x: -xDip, z: zDip, r: 0.22 });
    });

    const allColliders = [...warehouse.colliders, ...orrery.colliders, ...ringDipColliders];
    fp = createFirstPersonRig({
      container, camera, renderer,
      colliders: allColliders,
      wallLimit: warehouse.wallDist - PLAYER_RADIUS,
      eyeY: floorY + EYE_HEIGHT,
      // Starting just inside the (new) front wall, already facing the
      // machine — yaw 0 is the camera's default forward (-Z), which from
      // this spot looks straight at the mast without any rotation needed.
      startPos: new THREE.Vector3(0.8, 0, warehouse.wallDist - 1.2),
      startYaw: 0,
      isBlocked: e => panel && panel.contains(e.target),
      crosshair: crosshairEl, prompt: lockPromptEl, padEl: walkpadEl,
    });
  }

  // Reusable scratch objects for the telescope's per-frame modal physics
  // (see the ripple-driver comment inside animate() below) — allocated
  // once here rather than per-frame, so 54 struts' worth of vector math
  // every frame doesn't churn the garbage collector.
  const _jointDisp = Array.from({ length: orrery.gravLens.nJoints }, () => new THREE.Vector3());
  const _qRing = [[], [], []]; // [axis][mode] scratch — this frame's modal amplitude, baseline + ring combined
  const _scratchFrom = new THREE.Vector3(), _scratchTo = new THREE.Vector3(), _scratchMid = new THREE.Vector3(), _scratchDir = new THREE.Vector3();
  const _UP = new THREE.Vector3(0, 1, 0);

  // ─── Animate ──────────────────────────────────────────────────────────────
  let animId, t = 0, lastFrame = performance.now();
  function animate() {
    animId = requestAnimationFrame(animate);
    t += 0.001;
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastFrame) / 1000); // clamp: tab-away shouldn't teleport the walk
    lastFrame = now;

    if (preview) {
      // Ease the tile's rotation toward wherever the last drag left the
      // target, rather than jumping straight there. Reduced-motion
      // visitors get direct 1:1 tracking instead (no lingering post-drag
      // motion they didn't ask for).
      root.rotation.y = reduceMotion ? targetRotationY : root.rotation.y + (targetRotationY - root.rotation.y) * 0.07;
    } else {
      fp.update(dt);

      // Hover/click targeting — always from screen-center (the crosshair),
      // every frame, regardless of whether the pointer is locked or the
      // visitor has ever touched the mouse at all. See createFirstPersonRig.
      raycaster.setFromCamera({ x: 0, y: 0 }, camera);
      const hits = raycaster.intersectObject(orrery.hitTarget);
      const newHover = hits.length > 0;
      if (newHover !== hovered) {
        hovered = newHover;
        if (!selected) setEmphasis(hovered);
      }
      if (warehouse.posters.length) {
        const posterHits = raycaster.intersectObjects(warehouse.posters.map(p => p.mesh));
        const newPosterHover = posterHits.length
          ? warehouse.posters.find(p => p.mesh === posterHits[0].object)
          : null;
        if (newPosterHover !== hoveredPoster) {
          if (hoveredPoster) hoveredPoster.mesh.material.emissiveIntensity = hoveredPoster.baseEmissive;
          hoveredPoster = newPosterHover;
          if (hoveredPoster) hoveredPoster.mesh.material.emissiveIntensity = hoveredPoster.baseEmissive * 2.4;
        }
      }
      const glimpseHit = groundGlimpse?.hitMesh;
      hoveredGlimpse = glimpseHit ? raycaster.intersectObject(glimpseHit).length > 0 : false;
      fp.crosshairEl.classList.toggle('active', hovered || !!hoveredPoster || hoveredGlimpse);
    }

    // Ground glimpse ticks unconditionally, same reasoning as beamline's
    // own — it's the entry-point mechanism itself, not ambient decoration
    // to quiet under reduceMotion.
    groundGlimpse?.update(dt);

    if (!reduceMotion) {
      // Real Kepler motion (2.2.22): each planet's position is a
      // deterministic function of real wall-clock time (orreryNowMs, which
      // reads Date.now() unless window.__orreryTimeOverrideMs is set for
      // testing — see the comment above organicPulse), not an
      // accumulated per-frame rotation. The orrery keeps running whether
      // or not anyone's watching; reloading the page doesn't reset it,
      // and two visits at genuinely different real moments show genuinely
      // different configurations. One orreryNowMs() call per frame keeps
      // every body in the scene reading the same instant, then
      // applyKeplerPosition solves Kepler's equation fresh for each body
      // (bodyGroup for planets, moonPivot for moons — a moon's own orbit
      // is computed around its parent bodyGroup's current, already-moving
      // position simply because it's a child of it, no separate system
      // needed).
      const nowMs = orreryNowMs();
      orrery.orbits.forEach(o => {
        applyKeplerPosition(o.bodyGroup, o, nowMs);
        o.moons.forEach(m => { applyKeplerPosition(m.pivot, m.orbit, nowMs); });
      });
      // The asteroid belt drifts the same way every planet ring does —
      // rotating the whole (already-tilted, see buildOrrery) beltGroup
      // around its own local Y axis, same "pivot.rotation.y += speed *
      // 0.01" shape as the planet orbits just above.
      if (orrery.belt) orrery.belt.group.rotation.y += orrery.belt.speed * 0.01;
      // The "unidentified cosmic objects" past Pluto get the same orbit
      // treatment plus their own independent tumble (mesh.rotation.x/y
      // advancing at different rates than the orbit itself, and than each
      // other) — spin and orbit are two unrelated rotations layered on the
      // same object, which is why they read as tumbling debris rather than
      // planets. TUNABLE: the 0.01/0.007 spin-rate ratio controls how
      // "tumbly" vs. simply-spinning each object looks.
      orrery.unknowns.forEach(u => {
        u.pivot.rotation.y += u.speed * u.direction * 0.01;
        u.mesh.rotation.x += u.spin * 0.01;
        u.mesh.rotation.y += u.spin * 0.007;
      });

      // Dust motes drifting up through the skylight shafts. Each one wraps
      // from ceiling back to its own start height near the floor once it
      // rises past the top — a real jump when it happens, not a fade, but
      // with 260 motes at independent phases/speeds no two wrap in the
      // same frame, so across the whole swarm it reads as continuous
      // drift rather than any single visible reset (checked numerically:
      // one mote's own wrap is a ~5.8-unit jump once per multi-minute
      // cycle, not something a visitor is likely watching for). `t` here
      // is already scaled way down (see `t += 0.001` above) for the
      // orrery's own slow orbital motion, so it's rescaled back up locally
      // for the mote math below rather than reusing riseSpeed/wobbleSpeed
      // constants tuned against a different clock.
      const dustAttr = warehouse.dust.geo.attributes.position;
      const dustClock = t * 60;
      for (let i = 0; i < warehouse.dust.count; i++) {
        const d = warehouse.dust.drift[i];
        const i3 = i * 3;
        const startFrac = warehouse.dust.base[i3 + 1] - floorY; // 0..span, this mote's own start height
        const risenFrac = (startFrac + dustClock * d.riseSpeed) % d.span;
        const wobble = Math.sin(dustClock * d.wobbleSpeed + d.phase) * d.wobbleAmp;
        dustAttr.array[i3]     = warehouse.dust.base[i3] + wobble;
        dustAttr.array[i3 + 1] = floorY + risenFrac;
        dustAttr.array[i3 + 2] = warehouse.dust.base[i3 + 2] + Math.cos(dustClock * d.wobbleSpeed + d.phase) * d.wobbleAmp;
      }
      dustAttr.needsUpdate = true;

      // The radio telescope's receiving effect — see the "round 5: real
      // coupled-oscillator physics" comment on gravLens in buildOrrery.
      // Two closed-form sums, evaluated fresh every frame from the modes
      // solved once at build (nothing here re-solves anything live):
      //
      //  1. Baseline (continuous, "solar system's own gravitational hum")
      //     — the lattice's own lowest `BASELINE_MODE_COUNT` natural modes,
      //     each driven as a simple ongoing sinusoid at that mode's own
      //     real frequency, small and fixed-amplitude, never decaying.
      //  2. Ring (occasional struck event) — an impulse applied at one
      //     joint, decomposed onto EVERY mode (an impulse excites every
      //     mode in proportion to how much that mode "lives" at the
      //     struck point), each then ringing at its own frequency and
      //     decaying at its own rate: x(t) = Σₙ Aₙ·e^(−γₙt)·sin(ωₙt). Which
      //     joint gets struck, and from which direction, is a deterministic
      //     hash of the event index (hash3, already used elsewhere in this
      //     file for planet aging) — not Math.random() per frame, so it's
      //     reproducible and varies strike to strike without any runtime
      //     state to drift.
      //
      // realSeconds, not t: t is the orrery's own slow orbital clock
      // (+0.001/frame, ~0.06/real-second) but a scheduled "every 34
      // seconds" event needs to mean actual seconds a visitor experiences.
      // now (performance.now(), already computed above for dt) gives that
      // directly, frame-rate independent.
      const realSeconds = now / 1000;
      const RING_PERIOD = 34;   // TUNABLE: real seconds between struck events
      const RING_WINDOW = 6;    // TUNABLE: wide enough for every mode's own decay to die out (shorter than earlier rounds' 9s — see NOTES.md 2.2.20, the real modal decay settles faster)
      const FREQ_SCALE = 14;    // TUNABLE: converts the graph's raw sqrt(eigenvalue) units into real angular frequency (rad/s) — chosen so the lowest modes land around ~1Hz, the highest around ~5Hz, a similar range to the single hand-picked RING_FREQ earlier rounds used
      const DAMP_BASE = 0.5;    // TUNABLE: every mode's own minimum damping (per second)
      const DAMP_FREQ_SCALE = 0.05; // TUNABLE: additional damping proportional to a mode's own frequency — "real materials damp higher frequencies faster" (the brief's optional refinement), cheap to include since it's just one more multiply per mode
      const IMPULSE_STRENGTH = 0.55; // TUNABLE: overall strike strength — calibrated (see NOTES.md 2.2.20/2.2.21) against this specific graph's own eigenvector magnitudes, not a generic constant
      const BASELINE_AMP = 0.006;    // TUNABLE: continuous per-mode hum amplitude, well below the strike's own peak

      const { values, vectors } = orrery.gravLens.modes;
      const nJoints = orrery.gravLens.nJoints;
      const eventIndex = Math.floor(realSeconds / RING_PERIOD);
      const strikeSeed = 91711; // arbitrary fixed seed, just needs to differ from other hash3 callers in this file
      const strikeJoint = Math.floor(hash3(eventIndex, 0, 0, strikeSeed) * nJoints);
      // A mostly-horizontal strike direction (real events here are struck
      // from "outside," roughly along the dish's own X/Z plane) with a
      // small vertical component for variety — one unit vector per event,
      // reused for all 3 axes' impulse strength below.
      const strikeTheta = hash3(eventIndex, 1, 0, strikeSeed) * Math.PI * 2;
      const strikeVertical = (hash3(eventIndex, 2, 0, strikeSeed) - 0.5) * 0.5;
      const impulseDir = [Math.cos(strikeTheta), strikeVertical, Math.sin(strikeTheta)];
      const tSinceStrike = realSeconds - eventIndex * RING_PERIOD;
      const ringActive = tSinceStrike >= 0 && tSinceStrike < RING_WINDOW;

      // qTotal[axis][mode]: this frame's scalar modal amplitude, summed
      // from baseline + ring, before being projected back onto the 27
      // joints via each mode's own eigenvector.
      for (let axis = 0; axis < 3; axis++) {
        for (let n = 0; n < nJoints; n++) {
          let q = 0;
          if (n < orrery.gravLens.basePhase.length) {
            const omega = Math.sqrt(Math.max(values[n], 0)) * FREQ_SCALE;
            q += BASELINE_AMP * Math.sin(omega * realSeconds + orrery.gravLens.basePhase[n][axis]);
          }
          if (ringActive) {
            const omega = Math.sqrt(Math.max(values[n], 0)) * FREQ_SCALE;
            if (omega > 1e-6) {
              const gamma = DAMP_BASE + DAMP_FREQ_SCALE * omega;
              const omegaD2 = omega * omega - gamma * gamma;
              if (omegaD2 > 1e-6) {
                const omegaD = Math.sqrt(omegaD2);
                const v0 = impulseDir[axis] * IMPULSE_STRENGTH * vectors[n][strikeJoint];
                q += (v0 / omegaD) * Math.exp(-gamma * tSinceStrike) * Math.sin(omegaD * tSinceStrike);
              }
            }
          }
          _qRing[axis][n] = q;
        }
      }
      // Project modal amplitudes back onto physical joint displacement —
      // one 27x27 matrix-vector product per axis, cheap (~2000 multiply-
      // adds total, once a frame).
      for (let j = 0; j < nJoints; j++) {
        let dx = 0, dy = 0, dz = 0;
        for (let n = 0; n < nJoints; n++) {
          const vn = vectors[n][j];
          dx += vn * _qRing[0][n];
          dy += vn * _qRing[1][n];
          dz += vn * _qRing[2][n];
        }
        _jointDisp[j].set(dx, dy, dz);
      }
      // Reposition every strut from its two joints' live displaced
      // positions — the exact same position/quaternion math addStrut()
      // itself used once at construction, just re-run every frame instead
      // of once. builtLen/current-length ratio rescales along the strut's
      // own axis too, so a strut whose two joints happen to move slightly
      // farther apart or closer together doesn't visibly detach from
      // either end.
      orrery.gravLens.ringStruts.forEach(rs => {
        _scratchFrom.copy(rs.baseFrom);
        if (rs.jointA >= 0) _scratchFrom.add(_jointDisp[rs.jointA]);
        _scratchTo.copy(rs.baseTo);
        if (rs.jointB >= 0) _scratchTo.add(_jointDisp[rs.jointB]);
        _scratchMid.copy(_scratchFrom).add(_scratchTo).multiplyScalar(0.5);
        _scratchDir.copy(_scratchTo).sub(_scratchFrom);
        const dist = _scratchDir.length();
        if (dist < 1e-6) return; // degenerate (shouldn't happen at these displacement scales), skip rather than divide by zero
        _scratchDir.divideScalar(dist);
        rs.mesh.position.copy(_scratchMid);
        rs.mesh.quaternion.setFromUnitVectors(_UP, _scratchDir);
        rs.mesh.scale.y = dist / rs.builtLen;
      });
    }

    if (!hovered && !selected) {
      orrery.hitTarget.scale.setScalar(1.0 + Math.sin(t * 8) * 0.03);
    }

    renderer.render(scene, camera);
    clippedPreview?.blit();
  }
  animate();

  const resize = bindGuardedResize(container, (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    checkTitleHintCollision?.();
  });

  return {
    dispose() {
      cancelAnimationFrame(animId);
      orbitDrag?.dispose();
      wheelZoom?.dispose();
      fp?.dispose();
      resize.dispose();
      panelCloser?.dispose();
      jumpList?.dispose();
      threadUI?.dispose();
      if (!preview) {
        touchGuard?.dispose();
        container.removeEventListener('click', onContainerClick);
      }
      if (audioCtx) { audioCtx.close(); audioCtx = null; }
      groundGlimpse?.dispose();
      renderer.dispose();
      clippedPreview?.dispose();
      starGeo.dispose();
      starMat.dispose();
      warehouse.group.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) { obj.material.map?.dispose(); obj.material.dispose(); }
      });
      orrery.group.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) { obj.material.map?.dispose(); obj.material.dispose(); }
      });
      if (panel) panel.remove();
      if (hint) hint.remove();
      if (caption) caption.remove();
      if (vignette) vignette.remove();
      if (grain) grain.remove();
      if (title) title.remove();
      renderer.domElement.remove();
    }
  };
}
