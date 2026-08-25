import * as THREE from 'three';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion,
  createJumpList, bindTapVsDrag, mountClippedPreviewCanvas, parseHTML,
} from '../../utils/sceneKit.js';
import './beamline.css';
import beamlineHtml from './beamline.html?raw';
import { EPIGRAPH_PRIMARY, EPIGRAPH_SECONDARY, BOUNCES } from './beamline.text.js';
import { mulberry32, hashSeed } from '../../utils/prng.js';

// ─── Canonical accent color ─────────────────────────────────────────────────
// Hue ~216°, one numeric hex value applied to every touchpoint (rail,
// stations, vessel, UI); only lightness/darkness varies per-touchpoint,
// never hue.
const ACCENT = 0x50C878;        // canonical — rail core, station glow, vessel light
const ACCENT_HALO = 0x8ADAA4;   // lighter tint, same hue — rail halo, dust
const ACCENT_DEEP = 0x309A54;   // darker tint, same hue — vessel/station chassis fill
const ACCENT_SHADOW = 0x1E6034; // darkest tint, same hue — unused directly here, kept for parity with the rest of the site's palette set

// Secondary gold accent — pulled from Sphere's own gold
// (src/scenes/sphere.js's .fragment-link:hover, rgba(255,220,120,.95)), not
// approximated from scratch. Previously scoped to the station numbering
// text only (see makeLabelTexture's bounceStyle below); as of the emerald
// palette pass it also gets one standing, non-text presence — see
// buildStation's warmed core and buildVessel's rim light below — so gold
// isn't entirely absent from the idle wide view (no station open) the way
// it used to be. Still deliberately minor next to ACCENT: a glint at each
// waypoint's own heart and a thin edge on the vessel, not a third field
// color competing with the rail for attention.
const GOLD_ACCENT_CSS = 'rgba(255,220,120,'; // canvas fillStyle prefix, same shape as makeGlowTexture's hue param
const GOLD_ACCENT = 0xffdc78; // numeric form of the same rgb(255,220,120) — Three.js materials want a hex, canvas 2D wants the rgba() string above; both derived from the same Sphere-sourced value, just for different APIs
// Station core, warmed — a hand-picked blend of ACCENT and GOLD_ACCENT at
// roughly 3:1 (green:gold), not a fresh color: R 80→124, G 200→205, B
// 120→120 (green and gold already share the same blue channel, so only R/G
// shift). Reads as "emerald with a warm glint at its heart," not a second
// hue — the core is the one small spot per waypoint that carries it; the
// ring around it (buildStation below) stays pure ACCENT.
const STATION_CORE_WARM = 0x7ccd78;

// The skybox's own horizon-band color (matches makeSkyboxTexture()'s sky
// gradient's final stop below) — pulled out to a shared
// constant so scene.fog can be set to the SAME value rather than an
// independently-chosen one. The terrain mesh (a single continuous mesh,
// see terrainHeight() below) is what actually prevents a horizon seam;
// matching this color to the skybox just keeps the terrain's own far edge
// (well past the fog line, see scene.fog below) from ever reading as a
// color step even in principle.
const HORIZON_COLOR = 0x1E6034;
// #rrggbb string form of the same constant — canvas 2D APIs (skybox
// gradient) want a CSS color string; THREE.Fog wants the numeric hex.
// Deriving one from the other keeps them structurally unable to drift apart.
const HORIZON_CSS = '#' + HORIZON_COLOR.toString(16).padStart(6, '0');

// ─── Solar Sailer ───────────────────────────────────────────────────────────
// A small craft — the vessel — travels a rail continuously across a
// wilderness terrain; the rail itself stays visible as its own glowing
// conduit (see makeLiquidLightTexture below). Ten stations along the rail
// anchor the found text (beamline.text.js).
//
// The terrain height field (terrainHeight() below) is a genuine continuous
// function evaluated per-vertex across one single PlaneGeometry — ground
// and "mountain" are the same mesh, not two objects whose colors have to
// be kept in sync by hand, so there's nothing that can fail to align at
// the horizon.
//
// The rail itself is hand-authored rather than generated from a rule:
// WAYPOINTS below (see createBeamline) are placed by eye, each one a real
// decision about where the conduit dips low across the flat grid (near
// the ambient ecology) or rises up over the terrain's mounds, then
// verified for terrain clearance and self-intersection.

const CYCLE_SECONDS = 10; // preview tiles only — one full pulse loop

// ─── Organic timing ──────────────────────────────────────────────────────
// Shared by every ambient-life effect (grid shimmer, station idle glow,
// growth patches) and, as of this pivot, the vessel's own engine-ring pulse
// too — a sum of a few incommensurate-frequency sine waves rather than one
// clean sine, so anything driven by it reads as a living pulse ("closer to
// a bioluminescent pulse than a machine blink") instead of visibly
// metronomic. Returns a value in [0,1]. `seed` shifts phase/frequency
// per-instance so multiple things driven by this never fall into lockstep.
function organicWave(t, seed = 0) {
  const a = Math.sin(t * 0.9 + seed * 2.1);
  const b = Math.sin(t * 1.37 + seed * 4.7 + 1.3);
  const c = Math.sin(t * 0.53 + seed * 0.8 + 2.6);
  return (a * 0.5 + b * 0.3 + c * 0.2) * 0.5 + 0.5;
}

// ─── Terrain height field ───────────────────────────────────────────────
// One continuous function, sampled per-vertex across a single
// PlaneGeometry (see createBeamline below) so "ground" and "mountain" are
// never two separate objects that could drift out of visual sync — there's
// nothing left to fail to align at any seam.
//
// FLOOR_Y is the flat baseline. Each mountain is a smooth radial mound
// added on top of that baseline via smoothstep falloff — smoothstep's own
// zero derivative at both t=0 and t=1 means a mound's height AND its slope
// both reach exactly 0 at its own radius, so it joins the flat plane with
// no crease or ring, regardless of how many mounds overlap or how close
// together they sit. A little angular "jag" (two sine harmonics of the
// angle around each mound's own center) keeps the mounds from reading as
// perfect smooth domes.
//
// Centers/radii/heights below are hand-placed, not solved — chosen so each
// mound sits directly under one of the rail's own hand-placed crest
// waypoints (see WAYPOINTS in createBeamline), with radii kept well short
// of the distance to any neighboring waypoint so a mound never bleeds height
// into a station or dip that isn't meant to be near it. Minimum terrain
// clearance along the whole rail curve is 6.491 units, with zero
// negative-clearance points anywhere along it. Every wilderness addition
// below is designed to contribute exactly zero inside CORRIDOR_X/CORRIDOR_Z
// (see below), so that clearance figure holds regardless of what the
// wilderness layers do further out.
export const FLOOR_Y = -4;
const MOUNTAINS = [
  { cx: 90, cz: 35, radius: 48, height: 40, seed: 11 },
  { cx: 246, cz: -82, radius: 55, height: 55, seed: 47 },
  { cx: 372, cz: 90, radius: 42, height: 32, seed: 83 },
];
// Generic smoothstep, t in [0,1] — used for the mound falloff below AND
// (as of the Lévy-flight pass) the vessel's own per-step glide easing.
function smoothstep01(t) { return t * t * (3 - 2 * t); }

// ─── Wilderness: real terrain beyond the rail ──────────────────────────────
// Beyond the rail and the three MOUNTAINS above lies real generated
// terrain rather than flat grid to a visible edge. Two more layers, both
// zeroed out inside a protected zone so the rail's own 6.491-unit
// clearance can't regress.
//
// The protected zone (SAFE_RADIUS/SAFE_FADE below) is a CIRCLE centered on
// CAM_TARGET with radius CAM_MAX+80 (700) — this covers every position the
// camera can reach at any theta/phi/dist within its normal orbit range,
// not just the rail corridor (which sits entirely inside this circle
// anyway, so rail clearance is unaffected). This alone isn't sufficient
// for the rail-adjacent MOUNTAINS, which sit *inside* the circle and can
// still be close enough at low phi/close zoom to graze the camera — so
// createBeamline's own updateCamera() (below) adds a second, independent
// safety net: a hard runtime floor where camera.y is never allowed below
// terrainHeight at its own (x,z) plus a safety margin, regardless of what
// the raw orbit math computes.
//
// Layer 1, FAR_PEAKS/VALLEYS: hand-placed background peaks and depressions
// at varied heights/radii/positions in a loose ring around the rail's own
// footprint — real, distinct silhouette variety (an actual skyline at
// different heights, not a symmetric pair) rather than leaving shape
// entirely to noise. Same smoothstep-mound technique as MOUNTAINS, just
// placed well beyond SAFE_RADIUS (each entry's distance from CAM_TARGET
// minus its own radius clears SAFE_RADIUS by a 40-unit margin) — visible
// on the horizon through the fog, but never physically reachable by the
// camera, the same "see it, never collide with it" arrangement real
// open-world scenes use for distant scenery.
const FAR_PEAKS = [
  { cx: -649, cz: 356, radius: 180, height: 130, seed: 5 },
  { cx: -352, cz: -698, radius: 150, height: 95, seed: 19 },
  { cx: 90, cz: 954, radius: 220, height: 150, seed: 31 },
  { cx: 763, cz: -740, radius: 190, height: 110, seed: 44 },
  { cx: 1089, cz: 459, radius: 260, height: 175, seed: 58 },
  { cx: 1081, cz: -227, radius: 170, height: 90, seed: 67 },
  { cx: -119, cz: 885, radius: 200, height: 120, seed: 79 },
  { cx: 704, cz: 734, radius: 150, height: 85, seed: 91 },
  { cx: -744, cz: -105, radius: 210, height: 140, seed: 103 },
  { cx: 1168, cz: 68, radius: 230, height: 160, seed: 121 },
];
const VALLEYS = [
  { cx: -758, cz: 59, radius: 220, depth: 22, seed: 137 },
  { cx: 1236, cz: -89, radius: 300, depth: 18, seed: 149 },
];

// CAM_TARGET's own x/z (the orbit pivot, defined as a runtime constant
// inside createBeamline below) — duplicated here at module scope since
// terrainHeight() has to stay a plain (x,z)→height function, callable
// without a scene instance. Kept in sync by hand; if CAM_TARGET's x/z ever
// change, update these too.
const CAM_TARGET_XZ = { x: 199.944150, z: 0.531666 };
const SAFE_RADIUS = 700; // CAM_MAX (620) + 80 margin — STRUCTURAL, tied to the camera's own max distance elsewhere in this file; shrinking it risks wilderness terrain poking up inside the camera's actual safe zone
const SAFE_FADE = 260; // TUNABLE — how many world units the wilderness layer takes to fade from 0 to full strength, moving outward past SAFE_RADIUS. Shorter = wilderness appears more abruptly right at the boundary; longer = a more gradual, harder-to-notice transition.
// A plain radial smoothstep fade-in, centered on the camera's own target
// point rather than the terrain's center: 0 (no wilderness contribution at
// all) inside SAFE_RADIUS, ramping smoothly up to 1 (full contribution)
// over the next SAFE_FADE units outward, 1 everywhere beyond that. This is
// what keeps the generated wilderness noise (wildernessHeight, used only
// where this factor is > 0 in terrainHeight below) from ever interfering
// with the hand-placed, camera-safe area right around where the camera
// actually operates.
function corridorFactor(x, z) {
  const dx = x - CAM_TARGET_XZ.x, dz = z - CAM_TARGET_XZ.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d <= SAFE_RADIUS) return 0;
  return smoothstep01(Math.min(1, (d - SAFE_RADIUS) / SAFE_FADE));
}

// Horizontal distance fog hides the terrain boundary when looking across
// the landscape, but does nothing for a straight-down view — from directly
// overhead, the whole extent is visible at a roughly uniform camera
// distance, so there's no near/far gradient for fog to fade through, and
// the plane's literal edge could show as a hard color line against the
// background. The fix is geometric: the wilderness layers (FAR_PEAKS/
// VALLEYS/noise — NOT MOUNTAINS, see below) taper to exactly flat by the
// plane's actual boundary, so there's no height (and therefore no lit
// slope/silhouette) left to see a "shape" of, edge or otherwise, from any
// angle including straight down. The taper matches the plane's own aspect
// ratio (an ellipse, not a circle — the plane is 8000×6400, not square) so
// it reaches exactly 0 at the real edge in every direction, not a circle
// that clips one axis early or leaves the other exposed.
// TERRAIN_CENTER/PLANE_HALF_X/PLANE_HALF_Z duplicate createBeamline's own
// terrain-plane constants for the same reason
// CAM_TARGET_XZ does above — kept in sync by hand.
// TERRAIN_CENTER/PLANE_HALF_X/PLANE_HALF_Z: STRUCTURAL — these must match
// the actual terrain plane's real center/dimensions elsewhere in this file
// (kept in sync by hand, per the comment above). They're not a "how big
// should the taper region feel" dial; they're where the plane's boundary
// actually IS, and the whole point of this function is to reach exactly 0
// exactly there.
const TERRAIN_CENTER = { x: 200, z: 0 };
const PLANE_HALF_X = 4000, PLANE_HALF_Z = 3200;
const EDGE_FALLOFF_START = 0.55; // fraction of half-extent where the taper begins — FAR_PEAKS/VALLEYS all sit well inside this (rNorm ≤ ~0.4), so the hand-placed skyline is untouched; only the noise layer actually reaches this far out
// rNorm is an ELLIPTICAL normalized radius, not a circular one: dividing x
// and z by DIFFERENT half-extents (PLANE_HALF_X vs PLANE_HALF_Z, since the
// plane is 8000x6400, not square) before combining them means rNorm=1
// traces an ellipse matching the plane's actual aspect ratio, not a circle
// that would clip the short axis early or leave the long axis's edge
// exposed. Below EDGE_FALLOFF_START, full strength (1, no taper at all);
// beyond rNorm=1 (off the plane entirely), zero; the smoothstep01 in
// between is what makes that transition a smooth ease rather than a
// visible hard edge — same smoothstep01 helper used throughout this file
// for exactly that "no visible seam" reason.
function edgeFalloff(x, z) {
  const nx = (x - TERRAIN_CENTER.x) / PLANE_HALF_X;
  const nz = (z - TERRAIN_CENTER.z) / PLANE_HALF_Z;
  const rNorm = Math.sqrt(nx * nx + nz * nz);
  if (rNorm <= EDGE_FALLOFF_START) return 1;
  if (rNorm >= 1) return 0;
  return 1 - smoothstep01((rNorm - EDGE_FALLOFF_START) / (1 - EDGE_FALLOFF_START));
}

// Layer 2, WILDERNESS_NOISE: deterministic hash-based 2D value noise (own
// seeded lattice hash, not Math.random — same determinism convention as
// mulberry32/hashSeed elsewhere in this project), summed across four
// octaves (fractal Brownian motion) for multi-scale rolling variation, plus
// a "ridged" variant (folds the noise around its midpoint so ridgelines
// read as creases rather than smooth rolling hills — the standard ridged-
// multifractal terrain technique) layered on top for sharper ridge detail.
// This is what fills the space between/around the hand-placed FAR_PEAKS so
// a ground-level view reads as real landscape in every direction, not
// isolated mounds floating on a flat plain between them.
// A deterministic integer hash: given a lattice cell (ix, iz) and a seed,
// always returns the SAME pseudo-random value in [0, 1) — this is what
// makes the noise below reproducible (same terrain every load) rather than
// different every time, without needing to store a giant precomputed grid.
// The three large multiplier constants (374761393, 668265263, 2246822519)
// and the bit-mixing steps below (XOR-shift, then a multiply, then another
// XOR-shift) are STRUCTURAL — they're a standard integer-hash recipe
// (similar in spirit to hashes used in Squirrel3/FastNoise-style lattice
// noise) chosen specifically for good avalanche behavior (a tiny change in
// ix/iz/seed should scramble the output unpredictably, with no visible
// pattern); swapping them for arbitrary different numbers can reintroduce
// visible grid-aligned artifacts (repeating stripes/checkerboards in the
// terrain) rather than just "looking a bit different."
function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 2246822519) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}
// "Value noise": hash each of the 4 integer lattice points surrounding
// (x, z) to get 4 independent random values at the cell corners, then
// smoothly interpolate between them based on how far (x, z) sits inside
// that cell — smoothstep01 (not plain linear interpolation) on the
// fractional position (fx, fz) is what keeps the result's slope
// continuous across cell boundaries, so adjacent cells blend seamlessly
// instead of showing visible creases where one cell's hash value hands
// off to the next. `ab`/`cd` interpolate along x first (top edge, bottom
// edge of the cell), then the final line interpolates those two along z —
// this two-step process is exactly bilinear interpolation.
function valueNoise2D(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = smoothstep01(fx), sz = smoothstep01(fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  const ab = a + (b - a) * sx;
  const cd = c + (d - c) * sx;
  return ab + (cd - ab) * sz;
}
// Fractal Brownian motion (fBm): the standard technique for natural-
// looking terrain noise — stack several "octaves" of the same noise
// function at increasing frequency and decreasing amplitude, then sum
// them, so the result has both broad rolling shape (early octaves: low
// frequency, high amplitude) AND fine detail on top (later octaves: high
// frequency, low amplitude) rather than looking uniformly smooth or
// uniformly jittery at only one scale.
//   octaves: TUNABLE — how many layers to stack. More octaves add finer
//     detail but cost more valueNoise2D calls per point; 4 is already the
//     point of diminishing visual return for terrain at this scale.
//   amp *= 0.5 each octave: TUNABLE ("persistence" in noise terminology —
//     how much amplitude survives each successive, higher-frequency
//     octave). Closer to 1 keeps high-frequency detail loud relative to
//     the broad shape (rougher-looking terrain); closer to 0 makes the
//     broad shape dominate and higher octaves nearly invisible.
//   freq *= 2.15 each octave: TUNABLE ("lacunarity" — how much finer each
//     successive octave's detail is). The classic default is exactly 2.0
//     (each octave doubles in frequency); 2.15 is a deliberate small
//     departure from that so the octaves' patterns don't line up as
//     regularly, avoiding faint repeating structure that landing exactly
//     on integer-doubled frequencies can produce.
//   norm: not tunable — this is bookkeeping, not a shaping choice. Since
//     the amplitudes summed (amp, amp*0.5, amp*0.25, ...) don't add up to
//     1 on their own, dividing by their actual total keeps the final
//     result normalized to a predictable 0..1 range regardless of how
//     many octaves are used above.
function fbm(x, z, seed, octaves = 4) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise2D(x * freq, z * freq, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2.15;
  }
  return sum / norm; // 0..1
}
// "Ridged" multifractal noise — same octave-stacking idea as fbm above,
// but each octave's raw noise value first gets folded around its own
// midpoint: `1 - Math.abs(noise*2 - 1)` maps noise=0.5 (the midpoint) to
// 1 (the fold's peak) and noise=0 or noise=1 (the extremes) to 0 — so
// instead of smooth rolling hills, values near the old midpoint become
// sharp ridgelines and values near the old extremes become valleys/flats.
// Squaring that folded value (`n * n`) sharpens the ridge crests further
// — a straight fold alone gives soft-topped ridges, squaring makes the
// peak of each ridge noticeably narrower/crisper than its base, which is
// what actually makes this read as "mountain ridges" rather than "rolling
// hills with creases."
function ridged(x, z, seed, octaves = 4) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(valueNoise2D(x * freq, z * freq, seed + o * 101) * 2 - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2.15;
  }
  return sum / norm; // 0..1
}
// WILDERNESS_SCALE / RIDGE_SCALE: TUNABLE — both are spatial frequencies
// (1 / feature-size-in-world-units) fed into fbm/ridged above. Smaller
// values (bigger denominator) stretch each noise feature across more
// world space — broader, slower-changing shapes; larger values compress
// features into a smaller area — busier, faster-changing detail. The two
// are set roughly 2.6x apart (340 vs 130) so the broad highlands/lowlands
// layer and the finer ridge layer read as genuinely different scales of
// feature rather than two copies of the same-sized bumps.
const WILDERNESS_SCALE = 1 / 340; // broad, slow features — which areas are highlands vs lowlands
const RIDGE_SCALE = 1 / 130;      // finer ridged layer on top, for actual ridgelines
function wildernessHeight(x, z) {
  // Both the ±34 and the 26 below are TUNABLE height ranges (world units)
  // — raise either to make that layer's contribution to the final terrain
  // taller/deeper. fbm's own output is remapped from its native 0..1 range
  // to -1..1 first (`(...- 0.5) * 2`) so the broad layer can push terrain
  // both up AND down from the baseline, not just up; ridged's output
  // stays 0..1 (ridges only add height, they don't carve below baseline).
  const base = (fbm(x * WILDERNESS_SCALE, z * WILDERNESS_SCALE, 5000) - 0.5) * 2 * 34; // ±34 broad relief
  const ridge = ridged(x * RIDGE_SCALE, z * RIDGE_SCALE, 9000) * 26; // 0..26 ridge detail on top
  return base + ridge;
}

export function terrainHeight(x, z) {
  // MOUNTAINS: rail-critical, verified against the curve's own 6.491-unit
  // minimum clearance — never scaled by edgeFalloff (they sit at rNorm well
  // under 0.03, deep inside the untapered zone, so this is purely a safety
  // discipline, not a visible change: multiplying by edgeFalloff here would
  // always be multiplying by exactly 1 in practice, but leaving the term
  // out entirely means it's structurally impossible for a future edit to
  // this file to accidentally make it otherwise).
  // Each hand-placed mountain (and, below, FAR_PEAKS/VALLEYS) is a radial
  // bump: distance `d` from the mountain's own center (m.cx, m.cz),
  // converted to `t` = 1 at the very center down to 0 at the mountain's
  // outer radius, then smoothstep01(t) turns that linear falloff into an
  // eased one (rises gently from the rim, not a sharp cone). `angle` is
  // this point's bearing around the mountain's center; `jag` perturbs the
  // otherwise perfectly circular bump by TWO overlaid sine waves at
  // different angular frequencies (7 and 13 "lobes" around the full
  // circle) and different strengths (0.15 and 0.08) — like two overlaid
  // ripples of different wavelengths — so the silhouette reads as an
  // irregular, natural peak rather than a smooth dome; m.seed offsets each
  // mountain's own jag pattern so multiple mountains don't share the
  // exact same jagged shape rotated. TUNABLE: raise 7/13 for a more
  // finely-serrated outline, raise 0.15/0.08 for deeper jaggedness (push
  // either too far and `jag` can go negative, inverting the bump into a
  // dip in that direction — the two are kept comfortably below 1 combined
  // specifically to avoid that).
  let h = 0;
  for (const m of MOUNTAINS) {
    const dx = x - m.cx, dz = z - m.cz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= m.radius) continue;
    const t = 1 - d / m.radius;
    const s = smoothstep01(t);
    const angle = Math.atan2(dz, dx);
    const jag = 1 + 0.15 * Math.sin(angle * 7 + m.seed) + 0.08 * Math.sin(angle * 13 + m.seed * 2);
    h += m.height * s * jag;
  }

  // Wilderness: FAR_PEAKS/VALLEYS/noise, scaled by edgeFalloff as a group
  // so all of it — hand-placed peaks and generated
  // noise alike — tapers to exactly 0 by the plane's real boundary.
  // Same radial-bump-plus-angular-jag technique as MOUNTAINS above, just
  // its own jag frequencies/strengths (5 & 11 lobes, 0.18 & 0.10 strength)
  // so these peaks don't share an identical jagged silhouette with the
  // near mountains.
  let wild = 0;
  for (const p of FAR_PEAKS) {
    const dx = x - p.cx, dz = z - p.cz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= p.radius) continue;
    const t = 1 - d / p.radius;
    const s = smoothstep01(t);
    const angle = Math.atan2(dz, dx);
    const jag = 1 + 0.18 * Math.sin(angle * 5 + p.seed) + 0.10 * Math.sin(angle * 11 + p.seed * 2);
    wild += p.height * s * jag;
  }
  // Valleys are the same radial-falloff idea as the peaks above, minus the
  // angular jag (a smooth circular dip reads fine for a depression, less
  // needs to fight against looking like a perfect crater the way a smooth
  // peak reads as an unnaturally perfect dome) — `wild -=` instead of
  // `wild +=` is the only real difference: this carves height away rather
  // than adding it.
  for (const v of VALLEYS) {
    const dx = x - v.cx, dz = z - v.cz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= v.radius) continue;
    const t = 1 - d / v.radius;
    wild -= v.depth * smoothstep01(t);
  }
  const cf = corridorFactor(x, z);
  if (cf > 0) wild += wildernessHeight(x, z) * cf;
  h += wild * edgeFalloff(x, z);

  return FLOOR_Y + h;
}

// ─── Terrain color: hypsometric ramp + noise, not a flat material color ──
// Confirmed live: the terrain material's own `color` was one flat value
// applied everywhere — sampling several distant mountain peaks returned
// literally identical RGB regardless of which peak, most obvious on the
// big continuous MOUNTAINS masses where a large uniform shape makes flat
// color impossible to miss. Fixed with real data-driven variation, not
// hand-tuned per-mountain colors — the same discipline as terrainHeight()
// itself and the Orrery's own patina work: reuse data that already exists.
//
// Layer 1, hypsometric tinting: color keyed to the SAME height value
// terrainHeight() already computes to build the geometry — no separate
// data source. The four stops are ACCENT_SHADOW → ACCENT_DEEP → ACCENT →
// ACCENT_HALO (all defined at the top of this file), reused wholesale
// rather than a new hand-picked ramp: this scene's own established green
// tints, already doing this exact "same hue, four brightness steps" job
// everywhere else it appears (rail halo, station chassis, vessel light).
// ACCENT_SHADOW is worth calling out specifically — it's the literal same
// hex as HORIZON_COLOR (0x1E6034), so the lowest ground ties directly into
// the fog/void color instead of an arbitrary invented "ground floor" hue.
const TERRAIN_COLOR_RANGE = 70; // TUNABLE — height (in world units above FLOOR_Y) the ramp spans before clamping to ACCENT_HALO. Set from MOUNTAINS' own tallest peak (55) plus headroom, not guessed: the three hand-placed near mountains — the ones actually confirmed flat during live testing — span nearly the full ramp this way. FAR_PEAKS (up to 175) simply clip to the top stop past this, same practical-range clipping real hypsometric maps use; they're deep enough in fog by then that the clip is never visible as a hard line.
const TERRAIN_COLOR_STOPS = [ACCENT_SHADOW, ACCENT_DEEP, ACCENT, ACCENT_HALO].map(hex => ({
  r: ((hex >> 16) & 255) / 255, g: ((hex >> 8) & 255) / 255, b: (hex & 255) / 255,
}));
function hypsometricColor(h) {
  const t = Math.max(0, Math.min(1, (h - FLOOR_Y) / TERRAIN_COLOR_RANGE));
  const seg = t * (TERRAIN_COLOR_STOPS.length - 1); // 0..3 across 4 stops
  const i = Math.min(TERRAIN_COLOR_STOPS.length - 2, Math.floor(seg));
  const localT = seg - i;
  const a = TERRAIN_COLOR_STOPS[i], b = TERRAIN_COLOR_STOPS[i + 1];
  return { r: a.r + (b.r - a.r) * localT, g: a.g + (b.g - a.g) * localT, b: a.b + (b.b - a.b) * localT };
}
// Layer 2, fine noise on top: real terrain color isn't perfectly correlated
// with height — it has its own texture, or hypsometric tinting alone reads
// as crude banding. Reuses fbm() (defined above, the exact same value-noise
// fBm terrainHeight()'s own wilderness layer already runs), just at a much
// finer spatial frequency — this is surface-level color texture, not
// landform shape, so it needs to change over ~20 units, not the ~130-340
// units WILDERNESS_SCALE/RIDGE_SCALE work at. Same technique category as
// the Orrery's bronze patina noise. Output remapped from fbm's native 0..1
// to a symmetric brightness multiplier centered on 1, so it reads as
// mottled brighter/darker patches breaking up the ramp rather than a flat
// tint shift.
const TERRAIN_NOISE_SCALE = 1 / 22; // TUNABLE — spatial frequency of the surface texture noise; smaller denominator = finer/busier mottling
const TERRAIN_NOISE_STRENGTH = 0.22; // TUNABLE — ±22% brightness variation; enough to visibly break up hypsometric banding without reading as static/noisy
const TERRAIN_NOISE_SEED = 13500; // distinct from terrainHeight's own noise seeds (5000, 9000) so this texture doesn't correlate 1:1 with the height field's own broad shape
function terrainVertexColor(wx, wz, h) {
  const base = hypsometricColor(h);
  const n = fbm(wx * TERRAIN_NOISE_SCALE, wz * TERRAIN_NOISE_SCALE, TERRAIN_NOISE_SEED, 3);
  const shade = 1 + (n - 0.5) * 2 * TERRAIN_NOISE_STRENGTH;
  return { r: base.r * shade, g: base.g * shade, b: base.b * shade };
}

// ─── Canvas textures ────────────────────────────────────────────────────
function makeGlowTexture(hue = 'rgba(200,225,255,') {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const cx = c.getContext('2d');
  const grad = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, hue + '1)');
  grad.addColorStop(0.35, hue + '0.55)');
  grad.addColorStop(1, hue + '0)');
  cx.fillStyle = grad;
  cx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// A faint grid, standing in for a digital landscape — Tron's own game-grid
// floor, draped over the real terrain geometry (see the terrain mesh in
// createBeamline) rather than a flat plane.
function makeGridTexture(repeat = 20) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const cx = c.getContext('2d');
  cx.fillStyle = '#02040a';
  cx.fillRect(0, 0, 512, 512);
  cx.strokeStyle = 'rgba(0,102,255,0.85)'; // canonical ACCENT (0x0066ff)
  cx.lineWidth = 1;
  for (let i = 0; i <= 16; i++) {
    const p = (512 / 16) * i;
    cx.beginPath(); cx.moveTo(p, 0); cx.lineTo(p, 512); cx.stroke();
    cx.beginPath(); cx.moveTo(0, p); cx.lineTo(512, p); cx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
}

// A handful of soft, low-contrast blobs on an otherwise transparent tile,
// repeated across the grid and scrolled via its own offset each frame
// (organicWave-driven) — the grid's own slow heartbeat, independent of
// camera/vessel/interaction. Unchanged by this pivot; as of this pass it's
// mapped onto a terrain-conforming plane (a translated clone of the actual
// terrain geometry, see createBeamline) instead of a flat one, so the
// shimmer hugs the mounds the same way the grid itself now does.
function makeShimmerTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const cx = c.getContext('2d');
  let seed = 4471;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 3; i++) {
    const x = rand() * 256, y = rand() * 256, r = 26 + rand() * 30;
    const grad = cx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(130,190,255,0.22)');
    grad.addColorStop(1, 'rgba(130,190,255,0)');
    cx.fillStyle = grad;
    cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// A thin bright band crossing an otherwise dim (never fully dark — current
// always flowing) strip, mounted on the vessel's own engine ring (see
// buildVessel below) and scrolled to read as current flowing through a
// conductor.
function makeRingPulseTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 16;
  const cx = c.getContext('2d');
  cx.fillStyle = '#1c1c1c';
  cx.fillRect(0, 0, 256, 16);
  const grad = cx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,1)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  cx.fillStyle = grad;
  cx.fillRect(0, 0, 256, 16);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ─── Skybox: the outlands ───────────────────────────────────────────────
// A fixed backdrop, not something orbit-drag spins — added straight to
// `scene`, never to `root`, so it reads as a distant, unmoving horizon
// while the camera genuinely orbits in front of it. Equirectangular-style
// canvas texture: dark upper sky fading to a glowing electric-blue horizon
// band, a scattering of stars above it.
//
// The terrain mesh (terrainHeight() above) carries the actual ground/
// mountain silhouette, so this texture only needs to carry the sky
// gradient, the horizon glow, and the stars; a plain dark fill stands in
// for whatever's below the horizon line that the terrain mesh doesn't
// itself cover at extreme zoom/angle.
function makeSkyboxTexture() {
  const w = 2048, h = 1024;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d');

  const horizonY = h * 0.58;
  const sky = cx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, '#00030c');
  sky.addColorStop(0.5, '#020d22');
  sky.addColorStop(0.82, '#042140');
  sky.addColorStop(0.95, '#0a6978');
  sky.addColorStop(1, HORIZON_CSS); // = scene.fog's color, see HORIZON_COLOR above
  cx.fillStyle = sky;
  cx.fillRect(0, 0, w, horizonY);

  // A soft glow band right at the horizon — the piece's one big saturated
  // light source other than the vessel/rail themselves.
  const glow = cx.createLinearGradient(0, horizonY - 55, 0, horizonY + 8);
  glow.addColorStop(0, 'rgba(0,102,255,0)');
  glow.addColorStop(0.72, 'rgba(0,102,255,0.4)');
  glow.addColorStop(1, 'rgba(170,205,255,0.65)');
  cx.fillStyle = glow;
  cx.fillRect(0, horizonY - 55, w, 63);

  // Below the horizon: dark and mostly featureless — real terrain geometry
  // (see terrainHeight() above) is what actually carries the ground/
  // mountain read now; this is only ever seen past the terrain mesh's own
  // edge, well beyond where fog has already faded it out.
  cx.fillStyle = '#010103';
  cx.fillRect(0, horizonY, w, h - horizonY);

  // A handful of stars above the glow — the outlands read as open sky, not
  // a sealed dome. Seeded so re-running the build reproduces the same
  // skyline every time.
  let seed = 771;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 260; i++) {
    const x = rand() * w, y = rand() * horizonY * 0.75;
    const b = rand();
    cx.fillStyle = `rgba(210,235,255,${(0.15 + b * 0.5).toFixed(2)})`;
    cx.fillRect(x, y, 1.4, 1.4);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─── Liquid light ───────────────────────────────────────────────────────
// A vertical alpha-streak texture, tiled and scrolled along the rail's own
// length, standing in for "liquid light" flow rather than a flat-shaded
// tube. Mapped onto a single TubeGeometry following the hand-placed curve
// (see buildRailTube below).
function makeLiquidLightTexture() {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 256;
  const cx = c.getContext('2d');
  cx.clearRect(0, 0, 8, 256);
  const grad = cx.createLinearGradient(0, 0, 0, 256);
  const stops = [
    [0.00, 0.35], [0.06, 0.95], [0.10, 0.55], [0.18, 0.20], [0.24, 0.85],
    [0.30, 0.30], [0.38, 0.70], [0.46, 0.15], [0.52, 1.00], [0.58, 0.40],
    [0.66, 0.75], [0.72, 0.25], [0.80, 0.90], [0.87, 0.35], [0.93, 0.65],
    [1.00, 0.30],
  ];
  stops.forEach(([pos, a]) => grad.addColorStop(pos, `rgba(255,255,255,${a})`));
  cx.fillStyle = grad;
  cx.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ─── Station label ────────────────────────────────────────────────────
// Text-only, no background panel. showLabel/dismissLabel in createBeamline
// (below) call into this to label a station on the rail.
//
// The "STATION N OF 10" header line ships in Orbitron small-caps, a short
// technical label; the found poetic text underneath stays in the site's
// standard italic serif, the same voice every other scene uses for its
// own found text — Orbitron would clash with both the lyrical content and
// the serif-italic epigraph sitting above it in the same scene. The gold
// accent lives on the body text (see bounceStyle below) rather than on
// the header, so there's still one deliberate warm accent without asking
// Orbitron to carry both jobs at once.
function wrapLines(cx, text, maxWidth) {
  const words = text.split(' ');
  let line = '', lines = [];
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (cx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}
function drawOutlinedText(cx, str, x, y, { fill, stroke, strokeWidth, glow, glowBlur }) {
  cx.save();
  cx.lineJoin = 'round';
  cx.miterLimit = 2;
  cx.shadowColor = glow;
  cx.shadowBlur = glowBlur;
  cx.strokeStyle = stroke;
  cx.lineWidth = strokeWidth;
  cx.strokeText(str, x, y);
  cx.shadowBlur = 0;
  cx.fillStyle = fill;
  cx.fillText(str, x, y);
  cx.restore();
}
const BOUNCE_FONT_PX = 24;
const SMALLCAPS_FONT_PX = 17; // ~0.71x BOUNCE_FONT_PX — the "small capitals" size
const BODY_FONT_PX = 34;
const BOUNCE_LINE_H = 30;
const BODY_LINE_H = 42;

// ─── Manual small-caps (canvas has no font-variant support) ─────────────
// The "STATION N OF M" line ships in Orbitron small-caps, same as the DOM
// hint text — but a canvas 2D context can't be told
// font-variant: small-caps the way real CSS can (browser support for that
// inside ctx.font's shorthand is unreliable to nonexistent), so this is the
// manual equivalent: each word's first letter draws at the full BOUNCE_FONT_PX,
// the rest of that word (and any pure-digit "word", which has no small-caps
// form to shrink FROM) draws at SMALLCAPS_FONT_PX, both uppercased, advanced
// character-by-character so the mixed sizes still kern against each other
// correctly. Baselines are approximated by nudging the smaller glyphs down
// by the size difference (textBaseline stays 'top' throughout) — close
// enough at this scale to read as sharing a baseline, the same "good enough,
// checked live" standard this file's canvas type already works to.
// Used for both measuring (draw:false, to size the canvas before anything
// is painted) and drawing (draw:true) — one function, two passes, same
// existing convention makeLabelTexture already uses for its body text below.
function layoutSmallCaps(cx, str, { bigPx, smallPx, weight = 700, letterGap = 1, wordGap = 7, draw = false, x = 0, y = 0, style }) {
  let cursorX = x;
  const words = str.split(' ').filter(Boolean);
  words.forEach((word, wi) => {
    const firstIsAlpha = /[A-Za-z]/.test(word[0]);
    for (let i = 0; i < word.length; i++) {
      const ch = word[i].toUpperCase();
      const big = firstIsAlpha && i === 0;
      const size = big ? bigPx : smallPx;
      cx.font = `${weight} ${size}px "Orbitron", sans-serif`;
      const glyphW = cx.measureText(ch).width;
      if (draw) drawOutlinedText(cx, ch, cursorX, y + (bigPx - size), style);
      cursorX += glyphW + letterGap;
    }
    if (wi < words.length - 1) cursorX += wordGap;
  });
  return cursorX - x;
}

function makeLabelTexture(bounceLabel, text) {
  const maxTextWidth = 620;
  const gap = 14;
  const pad = 20; // margin so the stroke/glow isn't clipped at the canvas edge

  const measure = document.createElement('canvas').getContext('2d');
  measure.textBaseline = 'top';
  // The numbering line stays near-white; the gold accent lives on the
  // found-text body instead (see the body's drawOutlinedText call below).
  const bounceStyle = {
    fill: 'rgba(238,247,255,0.98)', stroke: 'rgba(2,5,12,0.92)', strokeWidth: 4,
    glow: 'rgba(1,3,9,0.95)', glowBlur: 7,
  };
  const bounceWidth = layoutSmallCaps(measure, bounceLabel, { bigPx: BOUNCE_FONT_PX, smallPx: SMALLCAPS_FONT_PX, draw: false });

  measure.font = `italic ${BODY_FONT_PX}px "Arapey", serif`;
  measure.letterSpacing = '0px';
  const bodyLines = wrapLines(measure, text, maxTextWidth);
  const bodyWidth = Math.max(...bodyLines.map(l => measure.measureText(l).width));

  const contentW = Math.max(bounceWidth, bodyWidth);
  const contentH = BOUNCE_LINE_H + gap + bodyLines.length * BODY_LINE_H;
  const w = Math.ceil(contentW + pad * 2);
  const h = Math.ceil(contentH + pad * 2);

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d');
  cx.textBaseline = 'top';

  // "STATION N OF M" ships in Orbitron, manual small-caps (see
  // layoutSmallCaps above) — the piece's HUD-chrome font, near-white like
  // the rest of the piece's chrome. The found-text body below stays in
  // the site's standard italic serif (Arapey as of the 2026-08-25/26
  // serif swap — labelFontsReady above guards this specific draw call
  // against the webfont-loading race; Orbitron here has no such guard,
  // a pre-existing gap out of scope for that pass), since Orbitron reads
  // wrong on the poetic found text, and carries the gold accent
  // (GOLD_ACCENT_CSS, Sphere's own value, see the constant above) instead:
  // one deliberate warm accent, on the words themselves rather than the
  // numbering, not a wholesale palette change.
  layoutSmallCaps(cx, bounceLabel, {
    bigPx: BOUNCE_FONT_PX, smallPx: SMALLCAPS_FONT_PX, draw: true, x: pad, y: pad, style: bounceStyle,
  });

  cx.font = `italic ${BODY_FONT_PX}px "Arapey", serif`;
  cx.letterSpacing = '0px';
  bodyLines.forEach((line, i) => {
    drawOutlinedText(cx, line, pad, pad + BOUNCE_LINE_H + gap + i * BODY_LINE_H, {
      fill: GOLD_ACCENT_CSS + '0.95)', stroke: 'rgba(2,5,12,0.94)', strokeWidth: 5,
      glow: GOLD_ACCENT_CSS + '0.35)', glowBlur: 9,
    });
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, aspect: w / h, canvasH: h };
}

// ─── Station beacon ─────────────────────────────────────────────────────
// A small glowing waypoint marker on the rail. A faceted core "gem" (an
// Icosahedron, not a smooth sphere — reads as a deliberate marker, not a
// natural object) sits at a fixed point on the rail, ringed by a hoop
// oriented perpendicular to the rail's own tangent there, so the vessel
// visibly threads through it as it passes, reading as a real waypoint
// gate. No scrolling emissiveMap here — that traveling-pulse technique
// belongs exclusively to the vessel's own engine ring (see buildVessel
// below); stations instead get a slower, independent organic idle glow
// (driven by organicWave in createBeamline's animate loop), plus a brief
// real brighten when the vessel actually passes.
function buildStation(point, tangent) {
  const coreGeo = new THREE.IcosahedronGeometry(3.2, 0);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x0a0d18, metalness: 0.75, roughness: 0.22,
    // Warmed (STATION_CORE_WARM, see that constant's comment), not plain
    // ACCENT — the standing gold presence for tweak #2: every waypoint gem
    // carries a small warm glint at its own heart even with no station
    // open, so gold isn't only ever a text color. The ring just below stays
    // pure ACCENT, so the warmth reads as one small accent per marker, not
    // a second field color.
    emissive: STATION_CORE_WARM, emissiveIntensity: 1.0,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.copy(point);

  const ringGeo = new THREE.TorusGeometry(6.4, 0.24, 8, 40);
  const ringMat = new THREE.MeshStandardMaterial({
    color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.3,
    metalness: 0.3, roughness: 0.3,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(point);
  // TorusGeometry's hole runs along its own local Z by default — aligning
  // that to the rail's tangent here means the vessel travels straight
  // through the hoop, not across its face.
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
  ring.quaternion.copy(q);

  return { core, coreGeo, coreMat, ring, ringGeo, ringMat };
}

// ─── Terminus — a real destination, not a fade to nothing ───────────────
// The rail has a clear origin at P_START (the small start-glow sprite,
// below) and a matching real endpoint at the far end — one real bookend
// at each side, rather than trailing off into empty space. This doesn't
// resolve WHAT the terminus is narratively (the piece's own "maybe
// compiling into something, maybe not" ambiguity stays exactly as
// ambiguous as ever) — it only needs to visually exist as a real endpoint
// the eye can land on.
// Deliberately NOT just a bigger station: buildStation is one core plus one
// ring; this is a crossed double ring (a genuine gateway the vessel visibly
// passes through, not a hoop-plus-single-core silhouette) around a cluster
// of three small crystal cores instead of one, plus its own point light —
// several concrete differences, not just a scale bump on the same shape.
function buildTerminus(point, tangent) {
  const group = new THREE.Group();
  group.position.copy(point);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

  // Outer gate — the ring the vessel actually threads through, tangent-
  // aligned the same way buildStation's own ring is, just larger.
  const gateGeo = new THREE.TorusGeometry(11, 0.7, 10, 48);
  const gateMat = new THREE.MeshStandardMaterial({
    color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.4, metalness: 0.35, roughness: 0.28,
  });
  const gate = new THREE.Mesh(gateGeo, gateMat);
  gate.quaternion.copy(q);

  // Inner ring, crossed at a real angle rather than sitting flush with the
  // outer one — a torus is rotationally symmetric about its own axis, so
  // spinning or twisting it around THAT axis is invisible; tilting it about
  // a perpendicular axis is what actually reads as a second, structurally
  // distinct ring (an armillary/gyroscope register) instead of a duplicate.
  const gate2Geo = new THREE.TorusGeometry(7.6, 0.42, 8, 40);
  const gate2Mat = new THREE.MeshStandardMaterial({
    color: ACCENT_HALO, emissive: ACCENT_HALO, emissiveIntensity: 1.1, metalness: 0.3, roughness: 0.3,
  });
  const gate2 = new THREE.Mesh(gate2Geo, gate2Mat);
  const tiltQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.5);
  gate2.quaternion.copy(q).multiply(tiltQ);

  // Three small crystal cores clustered at the gate's center, not one —
  // even in silhouette this reads as a different kind of object than a
  // station's single core.
  const coreGeo = new THREE.IcosahedronGeometry(2.6, 0);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x0a0d18, metalness: 0.7, roughness: 0.2, emissive: ACCENT, emissiveIntensity: 1.2,
  });
  const cores = [];
  [[0, 0, 0], [1.7, 1.1, 0.3], [-1.5, -1.2, -0.2]].forEach(([ox, oy, oz]) => {
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.copy(new THREE.Vector3(ox, oy, oz).applyQuaternion(q));
    cores.push(core);
  });

  const glowTex = makeGlowTexture('rgba(150,195,255,');
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.75,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(9);

  const light = new THREE.PointLight(ACCENT, 2.4, 44, 2);

  group.add(gate, gate2, ...cores, glow, light);

  return { group, gate, gateGeo, gateMat, gate2, gate2Geo, gate2Mat, coreGeo, coreMat, cores, glow, glowMat, glowTex, light };
}

// ─── Rail conduit ───────────────────────────────────────────────────────
// A single continuous THREE.TubeGeometry following the hand-placed curve
// — the conduit itself, always visible, glowing, one piece of geometry
// along the curve's whole length. liquid=true (the bright inner core
// only) maps the liquid-light streak texture, repeated along the tube's
// own arc length so streak density stays consistent regardless of how
// long the curve is.
function buildRailTube(curve, radius, opacity, liquid = false) {
  const geo = new THREE.TubeGeometry(curve, 400, radius, 8, false);
  let map = null;
  if (liquid) {
    map = makeLiquidLightTexture();
    const len = curve.getLength();
    map.repeat.set(1, Math.max(1, len / 2.4));
  }
  const mat = new THREE.MeshBasicMaterial({
    color: liquid ? 0x0080ff : ACCENT_HALO, map, transparent: true, opacity, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, geo, mat, map };
}

// ─── The vessel ─────────────────────────────────────────────────────────
// "The difference between drawing a road and putting a car on it" — a
// small craft, distinct from the rail it travels, built once and moved
// each frame via the curve's own arc-length parametrization
// (curve.getPointAt/getTangentAt in createBeamline's animate loop). The
// hull points local +Z by default (see the ConeGeometry rotate below) so
// orienting the whole group to the rail's tangent each frame is a single
// quaternion, no separate per-frame "point it at the direction of travel"
// bookkeeping. The engine ring carries the traveling-pulse texture (see
// makeRingPulseTexture above), scrolled to read as the vessel's own light.
function buildVessel(ringPulseTex) {
  const hullGeo = new THREE.ConeGeometry(1.7, 4.6, 6);
  hullGeo.rotateX(Math.PI / 2); // apex now points local +Z (forward), not +Y
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x0a0d18, metalness: 0.85, roughness: 0.2,
    emissive: ACCENT_DEEP, emissiveIntensity: 0.8,
  });
  const hull = new THREE.Mesh(hullGeo, hullMat);

  // Rim light — the standing gold presence for tweak #2, on the vessel
  // itself. Cheap inverted-hull technique (a backface-only shell, scaled
  // slightly larger than the hull it wraps, sharing its geometry — no
  // second geometry to dispose): at any silhouette edge the backface
  // shows through past the front face, reading as a thin glowing outline;
  // everywhere else the front hull simply occludes it. No fresnel shader,
  // just depth + winding order doing the real work, same "cheap real
  // technique over a hand-tuned approximation" register as the rest of
  // this scene. Deliberately subtle (low opacity, additive) and confined
  // to the hull alone — the engine ring behind it keeps carrying the
  // vessel's actual light, so this never competes with that or the rail.
  const rimMat = new THREE.MeshBasicMaterial({
    color: GOLD_ACCENT, transparent: true, opacity: 0.3, side: THREE.BackSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const rim = new THREE.Mesh(hullGeo, rimMat);
  rim.scale.setScalar(1.14);

  const pulseMap = ringPulseTex.clone();
  pulseMap.needsUpdate = true;
  const ringGeo = new THREE.TorusGeometry(1.5, 0.22, 8, 32);
  const ringMat = new THREE.MeshStandardMaterial({
    color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.8, emissiveMap: pulseMap,
    metalness: 0.3, roughness: 0.25,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(0, 0, -1.9); // mounted at the hull's rear, facing back along the direction of travel

  const glowTex = makeGlowTexture('rgba(210,235,255,');
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(3.2);
  glow.position.set(0, 0, -2.2);

  const group = new THREE.Group();
  group.add(hull, rim, ring, glow);

  return { group, hull, hullGeo, hullMat, rim, rimMat, ring, ringGeo, ringMat, pulseMap, glow, glowMat, glowTex };
}

export function createBeamline(container, { preview = false, initialPieceId = null, onPieceChange = null } = {}) {
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  // Exponential fog (FogExp2), not linear — real atmospheric scattering
  // falls off as 1 - exp(-(density*distance)^2) (Beer-Lambert, the same
  // "real math over hand-tuned approximation" discipline as terrainHeight()
  // and the rail curve), not a straight ramp clamped hard at both ends.
  // THREE.Fog's old near/far pair had two flat plateaus baked in — fully
  // unfogged below `near`, fully fogged (one flat solid color) above `far`
  // — which is exactly why terrain read as "uniform regardless of
  // distance": anything past 560 units (most of FAR_PEAKS) was literally
  // the same clamped color, and a single nearby MOUNTAINS mound (~50 units
  // radius) span too little of the 500-unit linear window to show its own
  // near-to-far falloff. FogExp2 has no hard clamp — it keeps asymptotically
  // approaching the fog color at any distance, so a mound's own near and
  // far slopes read as visibly different, and the far peaks keep receding
  // rather than sitting at one flat plateau. Density chosen to land at the
  // same ~85-90% blend the old `far` value did (560 full / 400 preview),
  // preserving the scene's existing hazy, enclosed mood — this corrects the
  // clamping artifact, not the overall amount of haze. Still the SAME
  // HORIZON_COLOR terrain fades toward (see that constant's own comment —
  // matching the skybox's horizon band is what keeps the terrain's far edge
  // from ever reading as a color seam).
  const FOG_DENSITY = preview ? 0.0035 : 0.0025;
  scene.fog = new THREE.FogExp2(HORIZON_COLOR, FOG_DENSITY);
  scene.background = new THREE.Color(0x00020a);

  // Far plane cleared out to comfortably contain the skybox sphere (radius
  // 1400, see below) at the far edge of the camera's own orbit range
  // (CAM_TARGET's own distance from world origin, ~201, plus CAM_MAX, 620,
  // plus the sky radius itself).
  const camera = new THREE.PerspectiveCamera(46, w / h, 0.1, 2500);

  // ─── Rail: hand-placed control points, not solved/generated ────────────
  // Twelve points: the conduit's own visible ends (P_START/P_END) plus the
  // ten station waypoints, one per BOUNCES[] entry in beamline.text.js, same
  // order (S1 = bounce 0, closest to the path's start). Each point was
  // placed by hand, not solved: X advances roughly monotonically for a
  // legible left-to-right sense of travel, Z sweeps in a loose S-curve, and
  // Y alternates deliberately — low near the flat grid (close enough to
  // cross paths with the ambient ecology below) at S1/S5/S9, rising to
  // crest over one of the three terrain mounds (see MOUNTAINS above) at
  // S3/S7/S10, giving the path real vertical character across its length
  // rather than a flat wander at one height.
  //
  // Minimum terrain clearance is 6.491 units anywhere along 2000
  // arc-length-spaced samples, with zero self-intersections in plan view
  // and a curve length of 788.51 units. CatmullRomCurve3's 'centripetal'
  // type is used specifically because it doesn't overshoot past
  // hand-placed control points the way the default 'catmullrom' type can
  // — overshoot here would mean the curve dipping through terrain or
  // crossing itself between two points that are individually clear.
  const WAYPOINTS = [
    { name: 'P_START', x: -40, y: 6,  z: 10 },
    { name: 'S1',      x: 0,   y: 4,  z: -15 },
    { name: 'S2',      x: 42,  y: 22, z: -35 },
    { name: 'S3',      x: 85,  y: 46, z: 45 },
    { name: 'S4',      x: 128, y: 16, z: 65 },
    { name: 'S5',      x: 168, y: 5,  z: 20 },
    { name: 'S6',      x: 208, y: 30, z: -50 },
    { name: 'S7',      x: 250, y: 68, z: -95 },
    { name: 'S8',      x: 292, y: 18, z: -50 },
    { name: 'S9',      x: 330, y: 6,  z: 10 },
    { name: 'S10',     x: 372, y: 42, z: 92 },
    { name: 'P_END',   x: 410, y: 14, z: 60 },
  ];
  const curve = new THREE.CatmullRomCurve3(
    WAYPOINTS.map(p => new THREE.Vector3(p.x, p.y, p.z)),
    false, 'centripetal',
  );
  // Arc-length-uniform parameter (u, 0..1) for each of the ten stations,
  // matched from a 2000-point arc-length scan so these values are
  // consistent with curve.getPointAt(u)'s own arc-length parametrization
  // at runtime (three.js's default arcLengthDivisions, left untouched here
  // so the two stay in agreement).
  const STATION_ARC_T = [0.0600, 0.1255, 0.2470, 0.3210, 0.4005, 0.5085, 0.6025, 0.7055, 0.7980, 0.9255];

  // The camera targets the rail's real 3D centroid (not just its X/Z
  // footprint — this path has real vertical extent), computed from 2000
  // arc-length-spaced samples, transcribed at full precision. See the
  // ground-level camera section below for how the opening angle
  // (THETA/GROUND_PHI_Y) is derived. CAM_MIN is sized to read the
  // STATIONS/vessel clearly close-up (their own real size, not the rail's
  // total extent — scaling camera distance with path extent when the
  // object you're actually looking at barely changes size makes everything
  // an unreadable dot). CAM_MAX is sized off the rail's own
  // ~500-unit bounding diagonal, so zooming all the way out shows the whole
  // curve — scroll-to-zoom's own ceiling, unchanged.
  const CAM_TARGET = new THREE.Vector3(199.944150, 25.345350, 0.531666);
  const CAM_MIN = 28, CAM_MAX = 620;

  // The opening camera frames the whole route from ground level rather
  // than from well above CAM_TARGET's height, so it reads as a visitor
  // standing in a landscape rather than a drone survey of a bounded plot.
  //
  // The route's own real shape is long and thin (WAYPOINTS span 450 units
  // in X, only 187 in Z, 64 in Y): looking at it broadside needs real
  // distance to fit that width in frame, but looking down its own length
  // compresses most of that length into the depth axis instead, where
  // perspective — not distance — does the work. THETA below is real math,
  // not hand-tuned: it's the direction from CAM_TARGET (the curve's
  // centroid) toward P_START itself, so sitting beyond P_START on that same
  // line and looking back puts P_START in the near foreground with the
  // rest of the route receding toward P_END, the classic "road stretching
  // into the distance" establishing shot. GROUND_PHI_Y is a small
  // *negative* pitch (camera slightly below CAM_TARGET's own y=25.35,
  // closer to the valley floor) — ground-level, and looking very slightly
  // up at anything that rises above camera height.
  //
  // At THETA/GROUND_PHI_Y, fitRouteAtTheta's single-angle fit needs only
  // ~261 units at 16:9, scaling up to ~506 at a narrow phone portrait
  // aspect (9:19.5) — always comfortably under CAM_MAX, so the clamp below
  // is a safety net, not the normal case. Terrain clearance at that
  // position is 15.35 units (flat ground there, no nearby mound); swept
  // across the full autoRotate theta range at this same camDist/phi,
  // minimum clearance anywhere is 7.24 units — safe everywhere the idle
  // orbit will actually carry the camera, even though this fit is only
  // guaranteed to hold at the one starting theta, not the whole orbit —
  // autoRotate drifting to a less favorable angle after the first few
  // seconds is expected and fine; the terrain there is real, not a void,
  // so the view degrades gracefully rather than breaking.
  const P_START = WAYPOINTS[0];
  const THETA = Math.atan2(P_START.x - CAM_TARGET.x, P_START.z - CAM_TARGET.z);
  const GROUND_PHI_Y = -0.05;
  function fitRouteAtTheta(aspect) {
    const margin = 0.85; // NDC target — 15% padding on every side, so the route's own bookends aren't jammed against the frame edge
    const N = 120; // runtime curve-sample count — dense enough to catch the real shape; this samples for framing, not for terrain clearance
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const phi0 = Math.acos(THREE.MathUtils.clamp(GROUND_PHI_Y, -1, 1));
    const sinPhi = Math.sin(phi0), cosPhi = Math.cos(phi0);
    function fitsAt(dist) {
      camera.position.set(
        CAM_TARGET.x + dist * sinPhi * Math.sin(THETA),
        CAM_TARGET.y + dist * cosPhi,
        CAM_TARGET.z + dist * sinPhi * Math.cos(THETA),
      );
      camera.lookAt(CAM_TARGET);
      camera.updateMatrixWorld(true);
      const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      for (let i = 0; i <= N; i++) {
        const p = curve.getPointAt(i / N);
        // Vector3.applyMatrix4 divides by w internally without checking its
        // sign — a point behind the camera has negative w, and dividing by a
        // negative number silently flips the sign of the "NDC" result back
        // into a plausible-looking range, making a point that's actually
        // invisible (behind the camera) read as comfortably on-screen. Using
        // Vector4 here keeps w visible so behind-camera points are rejected
        // outright rather than false-positiving through the margin check.
        const v4 = new THREE.Vector4(p.x, p.y, p.z, 1).applyMatrix4(vp);
        if (v4.w <= 0) return false;
        const ndcX = v4.x / v4.w, ndcY = v4.y / v4.w;
        if (Math.abs(ndcX) > margin || Math.abs(ndcY) > margin) return false;
      }
      return true;
    }
    let lo = CAM_MIN, hi = 3000;
    for (let iter = 0; iter < 40; iter++) {
      const mid = (lo + hi) / 2;
      if (fitsAt(mid)) hi = mid; else lo = mid;
    }
    return hi;
  }
  let camDist = preview ? 95 : Math.min(fitRouteAtTheta(w / h), CAM_MAX);
  let theta = THETA;
  let phi = Math.acos(THREE.MathUtils.clamp(GROUND_PHI_Y, -1, 1));
  const PHI_EPS = 0.06;
  // Hard runtime floor: the shallow default phi barely raises camera
  // height with distance, so the raw spherical position can dip
  // underground near the rail-adjacent MOUNTAINS (close enough to the
  // orbit pivot to still be reachable) even though SAFE_RADIUS above keeps
  // the FAR_PEAKS out of reach entirely. CAMERA_GROUND_CLEARANCE never
  // lets the computed Y sit below the terrain directly beneath the
  // camera's own (x,z) plus this margin. Doesn't touch X/Z or the look
  // target, so orbit/zoom still feel the same; it just refuses to let the
  // camera go underground.
  const CAMERA_GROUND_CLEARANCE = 8;
  function updateCamera() {
    const sinPhi = Math.sin(phi);
    const x = CAM_TARGET.x + camDist * sinPhi * Math.sin(theta);
    const z = CAM_TARGET.z + camDist * sinPhi * Math.cos(theta);
    let y = CAM_TARGET.y + camDist * Math.cos(phi);
    const minY = terrainHeight(x, z) + CAMERA_GROUND_CLEARANCE;
    if (y < minY) y = minY;
    camera.position.set(x, y, z);
    camera.lookAt(CAM_TARGET);
  }
  updateCamera();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(w, h);
  renderer.setClearColor(0x00020a, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  if (!preview) container.appendChild(renderer.domElement);
  const clippedPreview = preview ? mountClippedPreviewCanvas(container, renderer) : null;

  const root = new THREE.Group();
  scene.add(root);
  const reduceMotion = prefersReducedMotion();

  // ─── Skybox: the outlands ────────────────────────────────────────────
  // Radius comfortably beyond CAM_MAX + CAM_TARGET's own distance from
  // world origin, so it's never clipped no matter how far the camera
  // dollies out.
  const skyTex = makeSkyboxTexture();
  const skyGeo = new THREE.SphereGeometry(1400, 32, 20);
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // ─── Lighting ────────────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(0x14468f, 0x020304, 0.4));
  const key = new THREE.DirectionalLight(0x6f9de8, 0.42);
  key.position.set(4, 6, 5);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0x071230, 0.28));
  // Rides the traveling vessel, added below once the vessel exists — real
  // dynamic light on the terrain and stations as the vessel actually passes
  // them, not a static highlight baked in.
  const vesselLight = new THREE.PointLight(0x0080ff, preview ? 1.8 : 2.9, 11, 2);
  scene.add(vesselLight);

  // ─── Terrain (single continuous mesh — the actual horizon-seam fix) ────
  // One PlaneGeometry, baked flat via geo.rotateX(-Math.PI/2) and then
  // displaced per-vertex by terrainHeight() (defined above, module scope,
  // shared with the ambient-ecology spawn code below so grid bugs and
  // growth patches sit correctly ON this same surface rather than floating
  // above or clipping into a mound).
  //
  // The plane is 8000×6400 at 640×512 segments (16 units/vertex),
  // 327,680 vertices total — still a single static mesh/draw call, well
  // within what a modern WebGL context handles for one-time per-vertex
  // displacement. MeshStandardMaterial's smooth-shaded normals still read
  // the mounds as real hills at this density; a true multi-LOD terrain
  // system (fine mesh near the rail, coarser tiling further out) would be
  // more precise but is more machinery than this scene needs. The plane's
  // actual edge sits well beyond the worst-case camera position (CAM_MAX +
  // CAM_TARGET's own offset from TERRAIN_CENTER), so no orbit/zoom
  // position can reach it. Gated to !preview — preview tiles stay cheap.
  //
  // Preview gets the exact same terrainHeight() field — mountains,
  // wilderness, edge falloff, all of it — just at a much smaller extent
  // and far coarser resolution (2,928 vertices vs. 327,680), so the
  // landing-page tile represents the same environment as the full scene
  // without a small, distant tile needing the full mesh's per-vertex cost.
  let terrain = null, terrainGeo = null, terrainMat = null, terrainTex = null;
  const TERRAIN_CENTER = { x: 200, z: 0 };
  {
    const W = preview ? 1600 : 8000, H = preview ? 1280 : 6400;
    const SEGX = preview ? 60 : 640, SEGY = preview ? 48 : 512;
    terrainGeo = new THREE.PlaneGeometry(W, H, SEGX, SEGY);
    terrainGeo.rotateX(-Math.PI / 2);
    const pos = terrainGeo.attributes.position;
    // Real per-vertex color, computed from the SAME height value used to
    // displace this vertex in the first place (see terrainVertexColor()
    // above) — not a second, independent data source. This is what
    // actually varies now; the grid texture below stays exactly what it
    // was, an emissive-only overlay.
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i) + TERRAIN_CENTER.x;
      const wz = pos.getZ(i) + TERRAIN_CENTER.z;
      const y = terrainHeight(wx, wz);
      pos.setY(i, y);
      const c = terrainVertexColor(wx, wz, y);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    pos.needsUpdate = true;
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    terrainTex = makeGridTexture(); // repeat arg irrelevant — both axes overridden next line for whichever extent above
    terrainTex.repeat.x = preview ? 145 : 727; // plane isn't square — keeps grid cells ~11 units on both axes (1600/145≈11.0, 8000/727≈11.0)
    terrainTex.repeat.y = preview ? 116 : 582; // 1280/116≈11.0, 6400/582≈11.0
    // side: DoubleSide is load-bearing here, not a leftover default: with
    // FrontSide, the mesh vanishes entirely once the camera drifts beneath
    // the mountains (nothing left to render but the backface, which
    // FrontSide culls), and the same mesh viewed nearly edge-on from a
    // moderate distance thins into what reads as a stray straight beam —
    // one root cause, two symptoms. DoubleSide means there's no "wrong
    // side" to view this single-sheet mesh from at any camera position.
    //
    // `color` is now white and `map` has been dropped from the diffuse
    // channel entirely (terrainTex still drives `emissiveMap`, unchanged)
    // — previously map AND color were both doing diffuse duty, and
    // terrainTex's own canvas fill is near-black (#02040a) everywhere
    // except its thin grid lines, so diffuse*map was crushing anything
    // in `color` to almost nothing regardless of what it was. That's
    // WHY the flat single color went unnoticed for as long as it did:
    // the terrain's visible read was already coming almost entirely from
    // emissive (the grid texture), not lit diffuse. vertexColors:true
    // wires in the real per-vertex color above; white `color` is a
    // neutral multiplier so it comes through at its own true value,
    // shaped by the scene's actual (dim, moody) lighting same as before.
    terrainMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: true, emissive: 0xffffff, emissiveMap: terrainTex,
      emissiveIntensity: 0.5, roughness: 0.85, metalness: 0.05, fog: true,
      side: THREE.DoubleSide,
    });
    terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.position.set(TERRAIN_CENTER.x, 0, TERRAIN_CENTER.z);
    root.add(terrain);
  }

  // ─── Rail conduit ────────────────────────────────────────────────────
  // Three concentric tubes, not one thin line — a bright inner core (the
  // only layer carrying the liquid-light streak texture), a mid glow, and a
  // wide, soft outer bloom that fades almost to nothing at its own edge.
  // This is the actual fix for the rail reading as a flat, thin line at
  // normal viewing distance: a single 0.09-radius tube is sub-pixel at
  // anything but point-blank range, no matter how bright its material is.
  // Stacking three additively-blended radii (each one roughly 3x the last)
  // is the same cheap, robust "layer multiple glows" technique this site
  // already uses for every sprite-based glow (makeGlowTexture's own radial
  // falloff, stacked the same way) — a real soft-falloff bloom, not a
  // shader, matching the Tron: Legacy light-rail register this was asked to
  // hit (real visual weight/structure, not a wireframe line).
  const railCore = buildRailTube(curve, 0.5, 0.95, true);
  const railMid = buildRailTube(curve, 1.6, 0.35);
  const railOuter = buildRailTube(curve, 3.2, 0.12);
  root.add(railOuter.mesh, railMid.mesh, railCore.mesh);
  const totalLength = curve.getLength();

  // ─── Stations — one per real point on the rail, real found text ────────
  const stations = [];
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < STATION_ARC_T.length; i++) {
    const t = STATION_ARC_T[i];
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    let lateral = tangent.clone().cross(WORLD_UP);
    if (lateral.lengthSq() < 1e-6) lateral.set(1, 0, 0); else lateral.normalize();
    const st = buildStation(point, tangent);
    root.add(st.core, st.ring);
    stations.push({
      ...st, point, tangent, lateral, arcT: t, baseEmissive: 1.0, stationIndex: i,
      // Per-station organic-pulse seed/rate — irrational-ish offsets so no
      // two stations fall into a shared rhythm.
      pulseSeed: i * 1.732 + 0.6, pulseRate: 0.5 + ((i * 37) % 11) * 0.03, idleGlow: 0,
    });
  }

  // Start glow — the rail's clear origin (makeGlowTexture, same technique
  // used throughout for point-light sprites).
  const startTex = makeGlowTexture('rgba(235,250,255,');
  const startMat = new THREE.SpriteMaterial({ map: startTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const startSprite = new THREE.Sprite(startMat);
  startSprite.scale.setScalar(2.2);
  startSprite.position.copy(curve.getPointAt(0));
  root.add(startSprite);

  // The far end's real terminus (see buildTerminus above) — a real bookend
  // matching the start glow, so the rail doesn't trail into nothing.
  const terminus = buildTerminus(curve.getPointAt(1), curve.getTangentAt(1).normalize());
  root.add(terminus.group);

  // ─── The vessel ──────────────────────────────────────────────────────
  const ringPulseTex = makeRingPulseTexture();
  const vessel = buildVessel(ringPulseTex);
  root.add(vessel.group);
  const STATION_GLOW_ARC = 20; // world units of arc-length either side of the vessel's real position that a station counts as "lit"
  const FORWARD_AXIS = new THREE.Vector3(0, 0, 1);
  // Reused every animation frame for the vessel's position/orientation
  // (see animate() below) instead of letting getPointAt/getTangentAt/the
  // orientation quaternion each allocate a fresh object 60 times a second.
  const vesselPos = new THREE.Vector3();
  const vesselTangent = new THREE.Vector3();
  const vesselQuat = new THREE.Quaternion();

  // ─── Lévy flight — real step-length statistics, not constant speed ─────
  // Bees, butterflies, and other foragers move in a well-documented real
  // pattern: mostly short, locally-random steps, punctuated by occasional
  // much longer, more direct jumps, with step LENGTHS following a power-law
  // (Pareto) distribution rather than one constant speed. sampleLevyStep()
  // below is the standard inverse-CDF sampler for that distribution
  // (L = Lmin * u^(-1/(mu-1)) for u ~ Uniform(0,1)); the empirical CCDF's
  // slope in log-log space matches the theoretical -(mu-1) almost exactly
  // across two decades of step length. mu=2.0 (a well-studied value in the
  // real Lévy-flight-foraging literature) puts about half of all steps
  // under 2×Lmin (lingering, small local drift) and roughly one in ten
  // past 10×Lmin (the occasional long, direct jump) — the clamp at
  // LEVY_L_MAX just keeps a rare extreme draw from ever exceeding a large
  // fraction of the whole rail in one bound.
  //
  // The rail/curve stays the fixed backbone the vessel is loosely
  // following — this governs the CHARACTER of motion ALONG that backbone
  // (progress in real arc-length units, wrapping at the ends), not a
  // replacement for having a real path.
  // ─── Tunable vs structural, at a glance ───
  // LEVY_MU: TUNABLE, but with a hard mathematical floor — must stay
  //   strictly greater than 1 (the formula below divides by MU-1; at
  //   exactly 1 that's a division by zero, and approaching 1 the exponent
  //   blows up toward -infinity, producing wildly huge steps almost
  //   always). Above that floor, it's a real dial on the distribution's
  //   SHAPE: lower mu (closer to 1) = heavier tail = more frequent extreme
  //   long jumps relative to short ones; higher mu = lighter tail = steps
  //   cluster more tightly around LEVY_L_MIN, behaving more like ordinary
  //   constant-ish motion. 2.0 is a real, commonly-cited value from the
  //   Lévy-flight-foraging literature (see the paragraph above), not an
  //   arbitrary round number.
  // LEVY_L_MIN / LEVY_L_MAX: TUNABLE — both are fractions of the rail's
  //   own total length (totalLength), so they scale automatically if the
  //   rail curve itself changes. LEVY_L_MIN sets the floor for EVERY
  //   step's length (raising it makes even the smallest local-drift steps
  //   bigger); LEVY_L_MAX is purely a safety clamp on the distribution's
  //   naturally unbounded tail (raising it lets rare extreme jumps cover
  //   more of the rail in one bound; it does not affect the many small/
  //   medium steps at all, since most draws never come close to it).
  // LEVY_FORWARD_BIAS: TUNABLE, plain probability in [0, 1] — 0.85 means
  //   85% of steps net-progress forward, 15% double back. 1.0 would
  //   remove backtracking entirely (a one-way conveyor); 0.5 would make
  //   direction a coin flip with no net forward drift at all.
  const LEVY_MU = 2.0;
  const LEVY_L_MIN = totalLength * 0.006;
  const LEVY_L_MAX = totalLength * 0.4;
  const LEVY_FORWARD_BIAS = 0.85; // most steps net-progress forward along the rail; a minority double back, real "local drift" rather than a one-way conveyor
  const levyRng = mulberry32(hashSeed('beamline-vessel-levy'));
  // The inverse-CDF sampling formula itself, term by term (see the big
  // comment above for how this was verified against the theoretical
  // slope): a Lévy/Pareto distribution's CDF is F(L) = 1 - (Lmin/L)^(mu-1)
  // for L ≥ Lmin. Solving F(L) = u for L (the standard "inverse transform
  // sampling" trick — plug in a uniform random u and solve for the value
  // whose cumulative probability equals it) gives exactly the formula
  // below. This is *why* it produces the right distribution, not just an
  // empirically-tuned formula that happens to look Lévy-ish.
  function sampleLevyStep() {
    const u = Math.max(levyRng(), 1e-9); // clamped away from exactly 0 — u=0 would make the exponentiation below divide by zero / return Infinity
    const L = LEVY_L_MIN * Math.pow(u, -1 / (LEVY_MU - 1));
    return Math.min(L, LEVY_L_MAX); // the safety clamp described above — without it, an extremely small u (rare but possible) could sample a step far larger than the whole rail
  }
  let vesselArc = 0, stepFromArc = 0, stepDelta = 0, stepStartT = 0, stepDuration = 1;
  function beginLevyStep(fromArc, atTime) {
    const L = sampleLevyStep();
    const sign = levyRng() < LEVY_FORWARD_BIAS ? 1 : -1;
    stepFromArc = fromArc;
    stepDelta = sign * L; // signed, NOT wrapped — wrapping happens only when computing the actual on-curve position each frame, so the glide always travels the intended direction even across the loop point
    stepStartT = atTime;
    // Bigger jumps glide a little longer, but capped — what should scale
    // with step length is DIRECTNESS (a long jump reads as "went straight
    // there"), not a proportionally slower crawl. TUNABLE: 3.2 (seconds,
    // the hard cap), 0.35 (minimum glide time for even a zero-length
    // step), and the totalLength*0.05 divisor (how much step length it
    // takes to add one extra second of glide) are all independent dials
    // on the vessel's pacing, not on the Lévy statistics themselves.
    stepDuration = Math.min(3.2, 0.35 + L / (totalLength * 0.05));
  }
  beginLevyStep(0, 0);

  // ─── Title card (epigraphs) ────────────────────────────────────────────
  let title = null, hint = null;
  let jumpList = null, srLive = null;
  let touchGuard = null;

  // Static shell markup (title container + span slots, hint text, sr-live
  // region) lives in beamline.html, parsed via parseHTML below. The two
  // epigraph strings are genuinely dynamic (pulled from beamline.text.js)
  // so they're filled in as textContent after parsing rather than baked
  // into the file. Title/hint/sr-live styles live in beamline.css,
  // imported above.

  if (!preview) {
    const shell = parseHTML(beamlineHtml);
    title = shell.querySelector('.beamline-title');
    title.querySelector('.beamline-title-main').textContent = EPIGRAPH_PRIMARY;
    title.querySelector('.beamline-title-sub').textContent = EPIGRAPH_SECONDARY;
    document.body.appendChild(title);

    hint = shell.querySelector('.beamline-hint');
    document.body.appendChild(hint);

    container.style.position = 'relative';
    container.style.overflow = 'hidden';

    srLive = shell.querySelector('.beamline-sr-live');
    container.appendChild(srLive);

    jumpList = createJumpList(container, {
      label: 'Read the found text staged at each station along the rail',
      items: stations,
      getLabel: (s, i) => `Station ${i + 1} of ${stations.length}`,
      onSelect: s => showLabel(s),
    });

    touchGuard = bindTapVsDrag(container);
  }

  // ─── Station label sprite ───────────────────────────────────────────────
  // makeLabelTexture's found-text body renders in Arapey (site-wide serif
  // swap, 2026-08-25/26) — a real webfont, unlike the system "Times New
  // Roman" it replaced, baked into a static THREE.CanvasTexture that never
  // gets told to redraw once the font actually finishes loading. Kicked
  // off here, as early as this scene's setup runs, rather than waited on
  // inside showLabel itself, so it has the whole time between scene mount
  // and a user's first station click to resolve — showLabel below still
  // awaits it, but in practice it should already be settled by then. See
  // NOTES.md's "A site-wide webfont swap does not automatically extend to
  // Canvas-drawn text" entry for why this guard exists at all (nothing
  // else in this codebase needed one, since every other canvas font here
  // is either Orbitron — a pre-existing, still-unguarded gap, out of
  // scope for this pass — or a system font with no loading race).
  const labelFontsReady = document.fonts.load(`italic ${BODY_FONT_PX}px "Arapey"`).catch(() => {});
  const LABEL_OFFSET = 7;     // world units off the station's own point, along its lateral direction
  const LABEL_LIFT = 3;       // small +Y nudge so the label reads as beside-and-above, not level with the station
  // A single fixed sustain doesn't work for this piece's real range —
  // BOUNCES text runs from 3 words to 116 (the "THE MIRROR" passage), and
  // one constant can't serve both without either blinking past the short
  // ones or cutting off the long one mid-read. Sustain is computed per
  // caption from its own word count (computeSustain, below) at a
  // deliberately unhurried pace — slower than typical silent-reading wpm,
  // since this is glowing found text floating in a 3D scene, not a
  // printed page, and takes longer to parse in practice.
  const WORDS_PER_SECOND = 2.3;
  const LABEL_SUSTAIN_MIN = 3.0; // floor so even the shortest fragment (3 words) doesn't blink past
  const LABEL_FADE = 2.4;        // seconds to fade out, unhurried enough to read comfortably
  function computeSustain(text) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(LABEL_SUSTAIN_MIN, words / WORDS_PER_SECOND);
  }
  let labelSustain = LABEL_SUSTAIN_MIN;
  const TEXT_TARGET_PX = 27;
  const TEXT_SCALE_RATIO = TEXT_TARGET_PX / BODY_FONT_PX;
  let labelTex = null, labelAspect = 620 / 120, labelCanvasH = 120;
  const labelMat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false });
  const labelSprite = new THREE.Sprite(labelMat);
  labelSprite.visible = false;
  labelSprite.renderOrder = 10;
  root.add(labelSprite);
  let labelShownAt = -Infinity;
  let viewportH = h; // kept in sync by the resize handler below

  function updateLabelScale() {
    const dist = camera.position.distanceTo(labelSprite.position);
    const fovRad = camera.fov * Math.PI / 180;
    const targetPx = labelCanvasH * TEXT_SCALE_RATIO;
    const k = targetPx * 2 * Math.tan(fovRad / 2) / viewportH;
    const worldH = k * dist;
    labelSprite.scale.set(worldH * labelAspect, worldH, 1);
  }

  async function showLabel(s) {
    selectedStation = s;
    onPieceChange?.(BOUNCES[s.stationIndex]?.id);
    // Awaits labelFontsReady (kicked off at scene setup, above) before the
    // canvas draw so Arapey has a chance to actually be the font in use —
    // resolves immediately once loaded, which in practice is almost always
    // already true by the time a user clicks a station. `await` on an
    // already-resolved promise still yields one microtask, not a visible
    // delay.
    await labelFontsReady;
    labelTex?.dispose();
    const stationLabel = `Station ${s.stationIndex + 1} of ${stations.length}`;
    const text = BOUNCES[s.stationIndex]?.text ?? '';
    const { tex, aspect, canvasH } = makeLabelTexture(stationLabel, text);
    labelTex = tex;
    labelAspect = aspect;
    labelCanvasH = canvasH;
    labelMat.map = labelTex;
    labelMat.opacity = 1;
    labelMat.needsUpdate = true;
    labelSprite.position.copy(s.point)
      .addScaledVector(s.lateral, LABEL_OFFSET)
      .add(new THREE.Vector3(0, LABEL_LIFT, 0));
    updateLabelScale();
    labelSprite.visible = true;
    labelShownAt = tSec;
    labelSustain = computeSustain(text);
    if (srLive) srLive.textContent = `${stationLabel}: ${text}`;
  }
  function dismissLabel() {
    if (labelSprite.visible) labelShownAt = tSec - labelSustain;
  }

  // Deep-link entry/re-entry — resolves a BOUNCES id to its station and
  // shows its label immediately, same call showLabel's own click/jump-list
  // paths make. The label is transient by design (see showLabel/
  // dismissLabel above — beamline never had a persistent open/closed panel
  // the way sphere/orbiter/library do), so this doesn't try to keep it
  // pinned open; it just surfaces on arrival the same as clicking the
  // station would.
  function openPieceById(id) {
    const station = stations.find(s => BOUNCES[s.stationIndex]?.id === id);
    if (station) showLabel(station);
  }
  // NOT called here — see the call site near animate() below for why.

  // ─── Drag to orbit + wheel zoom (sceneKit) ─────────────────────────────
  let autoRotate = true;
  const orbitDrag = !preview ? bindOrbitDrag(container, {
    onDragStart: () => { autoRotate = false; },
    onDrag: (dx, dy) => {
      theta -= dx;
      phi = Math.max(PHI_EPS, Math.min(Math.PI - PHI_EPS, phi - dy));
      updateCamera();
    },
    onDragEnd: () => { setTimeout(() => { autoRotate = true; }, 2500); },
  }) : null;
  const wheelZoom = !preview ? bindWheelZoom(container, {
    isBlocked: () => false,
    onZoom: deltaY => {
      camDist = Math.max(CAM_MIN, Math.min(CAM_MAX, camDist + deltaY * 0.02));
      updateCamera();
    },
  }) : null;

  // ─── Hover / click on stations (+ the ground glimpse, when active) ──────
  let hoveredStation = null, selectedStation = null;
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let disposeHoverClick = null;

  if (!preview) {
    const onMove = e => {
      const rect = container.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(stations.map(s => s.core));
      const newHover = hits.length ? stations.find(s => s.core === hits[0].object) : null;
      if (newHover !== hoveredStation) {
        hoveredStation = newHover;
        container.style.cursor = hoveredStation ? 'pointer' : 'default';
      }
    };
    container.addEventListener('mousemove', onMove);

    const onClick = () => {
      if (touchGuard.consume()) return;
      if (!hoveredStation) { dismissLabel(); return; }
      showLabel(hoveredStation);
    };
    container.addEventListener('click', onClick);

    disposeHoverClick = () => {
      container.removeEventListener('mousemove', onMove);
      container.removeEventListener('click', onClick);
    };
  }

  // ─── Ambient dust — a few faint drifting motes for atmosphere ───────────
  let dust = null, dustGeo = null, dustMat = null, dustTex = null;
  if (!preview) {
    dustTex = makeGlowTexture('rgba(140,180,255,');
    const n = 160;
    const positions = new Float32Array(n * 3);
    const dustCenter = CAM_TARGET;
    for (let i = 0; i < n; i++) {
      positions[i * 3]     = dustCenter.x + (Math.random() - 0.5) * 500;
      positions[i * 3 + 1] = dustCenter.y + (Math.random() - 0.5) * 90;
      positions[i * 3 + 2] = dustCenter.z + (Math.random() - 0.5) * 220;
    }
    dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    dustMat = new THREE.PointsMaterial({
      size: 0.46, map: dustTex, color: ACCENT_HALO, transparent: true, opacity: 0.4,
      depthWrite: false, sizeAttenuation: true,
    });
    dust = new THREE.Points(dustGeo, dustMat);
    root.add(dust);
  }

  // ─── Ambient ecology ─────────────────────────────────────────────────
  // Three bounded, sparse additions, deliberately not a terrain/weather/
  // day-night rebuild. Since the ground isn't flat, every spawn position
  // below samples terrainHeight() for its own Y rather than assuming a
  // fixed height, so bugs and growth patches sit correctly on the actual
  // surface wherever that surface happens to be — including up on a
  // mound's slope, not just the flat corridor.

  // Grid shimmer — a terrain-conforming clone of the terrain geometry
  // itself (same vertex positions, nudged up slightly), so the shimmer's
  // scrolled blob texture hugs the real surface the same way the grid
  // texture printed on the terrain material does, mounds included.
  let shimmer = null, shimmerGeo = null, shimmerMat = null, shimmerTex = null;
  if (!preview && terrainGeo) {
    shimmerTex = makeShimmerTexture();
    shimmerTex.repeat.set(46, 35);
    shimmerGeo = terrainGeo.clone();
    shimmerGeo.translate(0, 0.4, 0);
    shimmerMat = new THREE.MeshBasicMaterial({
      map: shimmerTex, transparent: true, opacity: 0.16, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: true, side: THREE.DoubleSide,
    });
    shimmer = new THREE.Mesh(shimmerGeo, shimmerMat);
    shimmer.position.set(TERRAIN_CENTER.x, 0, TERRAIN_CENTER.z);
    root.add(shimmer);
  }

  // Grid bugs — sparse wandering light particles, each an independent
  // steered random walk seeded via the shared mulberry32 PRNG (prng.js),
  // so the population is deterministic across reloads.
  let gridBugs = null, gridBugsGeo = null, gridBugsMat = null, gridBugsTex = null;
  const gridBugState = [];
  if (!preview) {
    gridBugsTex = makeGlowTexture('rgba(160,220,255,');
    const N_BUGS = 14;
    const bugRng = mulberry32(hashSeed('beamline-grid-bugs'));
    const positions = new Float32Array(N_BUGS * 3);
    for (let i = 0; i < N_BUGS; i++) {
      const x = CAM_TARGET.x + (bugRng() - 0.5) * 420;
      const z = CAM_TARGET.z + (bugRng() - 0.5) * 220;
      gridBugState.push({
        x, z, heading: bugRng() * Math.PI * 2,
        speed: 1.4 + bugRng() * 1.8,
        seed: bugRng() * 1000,
        bob: bugRng() * Math.PI * 2,
      });
      positions[i * 3] = x;
      positions[i * 3 + 1] = terrainHeight(x, z) + 0.5;
      positions[i * 3 + 2] = z;
    }
    gridBugsGeo = new THREE.BufferGeometry();
    gridBugsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    gridBugsMat = new THREE.PointsMaterial({
      size: 0.9, map: gridBugsTex, color: ACCENT_HALO, transparent: true, opacity: 0.8,
      depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending,
    });
    gridBugs = new THREE.Points(gridBugsGeo, gridBugsMat);
    root.add(gridBugs);
  }

  // Sky motes — a different scale of the same information-ecology. The
  // sky above the terrain would otherwise be empty aside from the
  // skybox's own painted-in stars (a flat 2D texture, see
  // makeSkyboxTexture — those never move and aren't real 3D objects the
  // camera can orbit around). These are real points, sparse and
  // deliberately bigger/slower/rarer than
  // the grid bugs just above — "distant data in transit," not ground-
  // ecology creatures at a higher altitude. Two concrete differences from
  // gridBugs keep them from reading as a mere recolor of the same system:
  // motion is a plain, unwavering drift rather than gridBugs' organicWave-
  // steered heading correction (nothing here "notices" a boundary and turns
  // back — it wraps to the opposite edge instead, reading as transiting
  // signal rather than a creature staying near home), and there are far
  // fewer of them, each several times gridBugs' own point size.
  const SKY_MOTE_HALF_X = 700, SKY_MOTE_HALF_Z = 500; // wrap bounds — well past the grid bugs' own ~420×220 footprint
  const SKY_MOTE_Y_MIN = 130, SKY_MOTE_Y_MAX = 340;   // comfortably above the terrain's tallest mound (~68) and the grid bugs' near-ground band
  let skyMotes = null, skyMotesGeo = null, skyMotesMat = null, skyMotesTex = null;
  const skyMoteState = [];
  if (!preview) {
    skyMotesTex = makeGlowTexture('rgba(200,220,255,');
    const N_MOTES = 10;
    const moteRng = mulberry32(hashSeed('beamline-sky-motes'));
    const positions = new Float32Array(N_MOTES * 3);
    for (let i = 0; i < N_MOTES; i++) {
      const x = CAM_TARGET.x + (moteRng() - 0.5) * 2 * SKY_MOTE_HALF_X;
      const y = CAM_TARGET.y + SKY_MOTE_Y_MIN + moteRng() * (SKY_MOTE_Y_MAX - SKY_MOTE_Y_MIN);
      const z = CAM_TARGET.z + (moteRng() - 0.5) * 2 * SKY_MOTE_HALF_Z;
      skyMoteState.push({
        x, y, z,
        heading: moteRng() * Math.PI * 2,
        speed: 0.35 + moteRng() * 0.5, // well under gridBugs' own 1.4-3.2 — slow enough to read as distant, not local
        bob: moteRng() * Math.PI * 2,
        bobRate: 0.05 + moteRng() * 0.05,
      });
      positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    }
    skyMotesGeo = new THREE.BufferGeometry();
    skyMotesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    skyMotesMat = new THREE.PointsMaterial({
      size: 5.5, map: skyMotesTex, color: ACCENT_HALO, transparent: true, opacity: 0.5,
      depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending,
    });
    skyMotes = new THREE.Points(skyMotesGeo, skyMotesMat);
    root.add(skyMotes);
  }

  // Growth patches — "a literal visual toehold for emergent information
  // forming a baseline for future life," now genuinely emergent: a real 2D
  // cellular automaton (Conway's Game of Life, standard B3/S23 rule — birth
  // on exactly 3 live neighbors, survival on 2 or 3, death otherwise),
  // running on a grid snapped to the terrain's own real grid-line spacing.
  // Whether a patch spreads, stabilizes, or dies out is the actual output of
  // stepGameOfLife() below running against the current generation — nothing
  // here scripts the outcome, the same "real math over hand-tuned
  // approximation" discipline as terrainHeight()/the rail curve. Matches
  // known Life ground truth (a blinker's period-2 oscillation, a block's
  // stability, an isolated cell dying of underpopulation).
  //
  // Two tiers, NEAR + FAR (see the createGrowthTier() calls below), not one
  // uniform grid stretched to cover more ground — the question that decided
  // this: does the simulation already scope itself to an active region near
  // the camera? It didn't. stepGameOfLife() ran the full COLS×ROWS grid
  // every generation regardless of distance, and — the actually expensive
  // part — a per-frame brightness-easing loop touched every point's color
  // attribute every single frame, also regardless of distance. Naively
  // growing COLS/ROWS to reach much farther out would have scaled BOTH
  // costs directly with area (quadratic in linear reach). The fix is the
  // one the brief asked for: cells far enough out that the scene's own fog
  // (see scene.fog, now FogExp2, above) already obscures cell-level detail
  // don't need full simulation fidelity to look correct. NEAR keeps
  // exactly today's grid, spacing, step rate, and per-frame eased fade —
  // no change, no regression risk to the close-up read. FAR is a second,
  // much larger, much coarser field (3x the cell spacing, so 9x fewer
  // points per unit area) that only re-simulates every 4th NEAR-generation
  // and snaps its brightness on those steps instead of easing every frame
  // — its steady per-frame cost is close to zero. Both tiers reuse the
  // SAME elliptical extent-falloff technique already established here
  // (mirroring the terrain's own edgeFalloff()) for their own outer
  // boundary, and both keep the default `fog: true` a PointsMaterial
  // already has — so it's the EXISTING fog system doing the actual
  // "recede into haze" work, at FAR's own much larger scale, not a new,
  // second fade invented for this pass.
  //
  // This lattice is a SEPARATE layer from the terrain mesh (its own
  // Points system, own fixed extent) — the wilderness edgeFalloff() above
  // only tapers terrain height, so it has no effect on this grid, which is
  // why a tier would otherwise read as a hard-edged rectangle even though
  // the terrain's own boundary dissolves smoothly. The same underlying idea
  // is applied here instead to density/position/brightness: each tier's
  // Game-of-Life SIMULATION still runs on its own full plain rectangular
  // COLS×ROWS grid (the neighbor topology has to stay a real rectangle),
  // but each point's RENDERED density/position/brightness is additionally
  // shaped by that tier's own edgeFactor/eligible arrays, computed once at
  // setup from the point's own distance from CAM_TARGET.
  const GRID_CELL = 2600 / 236; // ≈11.02 — the real on-screen cell spacing the terrain's own grid texture produces — STRUCTURAL: this is measured to match the terrain grid texture, not a free spacing choice; changing it desyncs either tier from the ground pattern it's meant to sit on. FAR uses a clean multiple of this (3x), not an unrelated spacing, so its points still land on real terrain grid intersections, just every third one.
  const CA_EDGE_START = 0.8; // fraction of a tier's own half-extent where its perimeter falloff begins — matches EDGE_FALLOFF_START's role for the terrain — TUNABLE, same effect as that constant: smaller = falloff band starts closer to center (more of the lattice looks "eroded"), closer to 1 = only the very outer rim fades. Shared by both tiers.
  const CA_SEED_DENSITY = 0.28; // classic "random soup" density for interesting Life activity — TUNABLE, but not freely: Life is known to behave interestingly (a mix of die-off, stabilization, and sustained activity) around densities roughly in the 0.2-0.4 range; push it much lower and almost everything dies in a few generations, push it much higher and the grid tends to collapse into a static, over-crowded mess faster
  // Conway's Game of Life, the standard B3/S23 rule, spelled out here in
  // full — this IS the entire rule, nothing else governs how the pattern
  // evolves generation to generation:
  //   - n = how many of this cell's 8 neighbors (the dx/dy loop below,
  //     skipping (0,0) which is the cell itself) are currently alive.
  //     Neighbors past the grid's own edge simply aren't counted (the
  //     nx/ny bounds check) — this grid does NOT wrap around; an edge
  //     cell has fewer effective neighbors than an interior one, which is
  //     itself part of why activity tends to die out faster right at the
  //     lattice's boundary.
  //   - B3/S23, read literally in the last line: a currently-DEAD cell is
  //     "Born" only if n is exactly 3; a currently-ALIVE cell "Survives"
  //     only if n is 2 or 3, and dies otherwise (from either loneliness —
  //     n<2 — or overcrowding — n>3). These specific thresholds (2, 3, 3)
  //     are STRUCTURAL, not a style choice: they're the exact numbers
  //     that make the classic Game of Life produce the well-known mix of
  //     stable shapes, oscillators, and gliders this scene's own
  //     comments reference verifying against. Changing them creates a
  //     genuinely different automaton (most other B/S rule combinations
  //     either die out almost immediately or fill the entire grid solid)
  //     — not "the same Life with a different look." Shared by both tiers
  //     — FAR runs the exact same rule, just less often (see
  //     createGrowthTier's stepInterval below), not a simplified rule.
  function stepGameOfLife(grid, cols, rows) {
    const next = new Uint8Array(cols * rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) n += grid[ny * cols + nx];
        }
        const alive = grid[y * cols + x] === 1;
        next[y * cols + x] = alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
      }
    }
    return next;
  }
  // Builds one tier of the growth lattice — called twice below (NEAR, FAR)
  // with different cols/rows/cellSize/stepInterval/ease, so the two tiers'
  // setup and per-frame update logic can't drift apart into two hand-
  // maintained copies of the same ~80 lines. `ease: true` reproduces the
  // original single-tier behavior exactly (per-frame exponential brightness
  // ease, reduceMotion snaps it to instant); `ease: false` is FAR's own
  // cheap path — brightness is written only on the tier's own (infrequent)
  // generation step, nothing touches its color attribute on the frames in
  // between, which is what actually keeps FAR's steady per-frame cost low
  // regardless of how many points it has.
  function createGrowthTier({ name, cols, rows, cellSize, stepInterval, ease, tex, colorRgb }) {
    const rng = mulberry32(hashSeed(`beamline-growth-ca-${name}`));
    const seedGrid = () => {
      const g = new Uint8Array(cols * rows);
      for (let i = 0; i < g.length; i++) g[i] = rng() < CA_SEED_DENSITY ? 1 : 0;
      return g;
    };
    let grid = seedGrid();
    const positions = new Float32Array(cols * rows * 3);
    const colors = new Float32Array(cols * rows * 3);
    const edgeFactor = new Float32Array(cols * rows);
    const eligible = new Uint8Array(cols * rows);
    const brightness = new Float32Array(cols * rows);
    const baseX = CAM_TARGET.x - (cols / 2) * cellSize;
    const baseZ = CAM_TARGET.z - (rows / 2) * cellSize;
    const halfW = (cols / 2) * cellSize, halfH = (rows / 2) * cellSize;
    // Same elliptical extent-falloff as the original single-tier version
    // (see the header comment above) — computed once here per tier against
    // THAT tier's own half-extents, not a shared/global one.
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const i = cy * cols + cx;
        const gx = baseX + cx * cellSize, gz = baseZ + cy * cellSize;
        const nx = (gx - CAM_TARGET.x) / halfW, nz = (gz - CAM_TARGET.z) / halfH;
        const rNorm = Math.sqrt(nx * nx + nz * nz);
        const edge = rNorm <= CA_EDGE_START ? 1
          : rNorm >= 1 ? 0
          : 1 - smoothstep01((rNorm - CA_EDGE_START) / (1 - CA_EDGE_START));
        edgeFactor[i] = edge;
        eligible[i] = rng() < edge ? 1 : 0;
        const jitterStrength = 1 - edge;
        const wx = gx + (rng() - 0.5) * cellSize * 2.2 * jitterStrength;
        const wz = gz + (rng() - 0.5) * cellSize * 2.2 * jitterStrength;
        positions[i * 3] = wx;
        positions[i * 3 + 1] = terrainHeight(wx, wz) + 0.35;
        positions[i * 3 + 2] = wz;
        brightness[i] = grid[i]; // start already at the seed's own state, no fade-in from black on load
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 4.4, map: tex, vertexColors: true, transparent: true,
      depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    const [cr, cg, cb] = colorRgb.map(v => v / 255);
    function writeColors() {
      const colorAttr = geo.attributes.color;
      for (let i = 0; i < grid.length; i++) {
        const b = brightness[i] * edgeFactor[i];
        colorAttr.setXYZ(i, cr * b, cg * b, cb * b);
      }
      colorAttr.needsUpdate = true;
    }
    writeColors(); // paint the seeded state immediately, don't wait for the first step
    let timer = 0;
    function tick(dt, reduceMotion) {
      timer += dt;
      let stepped = false;
      if (timer >= stepInterval) {
        timer -= stepInterval;
        grid = stepGameOfLife(grid, cols, rows);
        // A small/finite random-soup Life board commonly burns out to all-
        // dead or settles into static still-lifes; reseed (continuing the
        // SAME deterministic rng stream, so this stays reproducible across
        // reloads) if the board goes fully dark, rather than leaving the
        // grid permanently empty.
        let alive = 0;
        for (let i = 0; i < grid.length; i++) alive += grid[i];
        if (alive === 0) grid = seedGrid();
        stepped = true;
      }
      if (ease) {
        // NEAR's own behavior, unchanged: brightness closes 10% of the
        // remaining gap toward its target every frame (reduceMotion forces
        // that to 100%, i.e. instant) — see the original comment this was
        // lifted from for why that reads as a fade rather than a flicker.
        const rate = reduceMotion ? 1 : 0.1;
        for (let i = 0; i < grid.length; i++) {
          const target = eligible[i] ? grid[i] : 0;
          brightness[i] += (target - brightness[i]) * rate;
        }
        writeColors();
      } else if (stepped) {
        // FAR's own behavior: no per-frame work at all except on the rare
        // frame its own generation actually advances — snap straight to
        // the new state then. Cheap, and correct: fog already keeps this
        // tier from ever reading as a crisp, individually-legible flicker.
        for (let i = 0; i < grid.length; i++) brightness[i] = eligible[i] ? grid[i] : 0;
        writeColors();
      }
    }
    return { points, geo, mat, tick };
  }
  let caNear = null, caFar = null, caGlowTex = null;
  if (!preview) {
    caGlowTex = makeGlowTexture('rgba(120,220,190,'); // slightly green-shifted from ACCENT — reads as young growth, not more current. Shared by both tiers — one texture, not two.
    caNear = createGrowthTier({
      name: 'near', cols: 64, rows: 34, cellSize: GRID_CELL, stepInterval: 1.7,
      // TUNABLE: lower stepInterval = the pattern visibly evolves faster;
      // this only paces how often stepGameOfLife() is CALLED for this
      // tier, it has no effect on the rule itself. ≈705×375 units at
      // GRID_CELL spacing — unchanged from before this pass.
      ease: true, tex: caGlowTex, colorRgb: [120, 220, 190],
    });
    caFar = createGrowthTier({
      // 46×24 at 3x the cell spacing ≈1520×792 units (half-extents
      // ~760×396) — reasoned from the fog itself, not picked by eye: at
      // FOG_DENSITY 0.0025 (see scene.fog above), blend = 1-exp(-(d·k)^2)
      // reaches ~97% by d≈750 along the wider (x) axis. Past that, this
      // tier's own points are already almost entirely fog-colored before
      // its own edgeFactor/eligible erosion (same technique as NEAR, just
      // computed against this tier's own larger half-extents) does
      // anything — the fog is doing the real hiding, same as the terrain's
      // own wilderness layer sitting "visible on the horizon, never
      // reachable." The shorter (z) axis reaches only ~63% blend at ITS
      // own true edge — the same asymmetry NEAR already has (its own
      // aspect ratio is preserved here, not newly introduced), and the
      // erosion band covers the rest.
      name: 'far', cols: 46, rows: 24, cellSize: GRID_CELL * 3, stepInterval: 1.7 * 4,
      // 4x NEAR's own interval — still the real B3/S23 rule (see
      // stepGameOfLife), just ticking less often. A generation this far
      // out changing every ~6.8s instead of ~1.7s is not something anyone
      // could track through this much haze regardless.
      ease: false, tex: caGlowTex, colorRgb: [120, 220, 190],
    });
    root.add(caNear.points, caFar.points);
  }

  // ─── Animate ─────────────────────────────────────────────────────────────
  let animId, tSec = 0;
  function animate() {
    animId = requestAnimationFrame(animate);
    tSec += 1 / 60;

    if (!reduceMotion) {
      if (autoRotate && !(orbitDrag && orbitDrag.isDragging)) {
        theta += preview ? 0.003 : 0.0009;
        updateCamera();
      }
      if (dust) dust.rotation.y += 0.0006;
      // Liquid-light flow along the rail's single continuous tube.
      if (railCore.map) {
        railCore.map.offset.y -= (1 / 60) * (preview ? 0.5 : 0.85);
      }
      // Vessel's own light — the engine ring's traveling pulse.
      const engineRate = 0.35 + organicWave(tSec * 0.04, 2.4) * 0.45;
      vessel.pulseMap.offset.x -= engineRate * (1 / 60);
      vessel.ringMat.emissiveIntensity = 1.4 + organicWave(tSec * 0.6, 7.1) * 1.2;

      // Ambient ecology.
      if (shimmerTex) {
        shimmerTex.offset.x = organicWave(tSec * 0.05, 0.3) * 1.4 - 0.7;
        shimmerTex.offset.y = organicWave(tSec * 0.037, 1.9) * 1.4 - 0.7;
      }
      if (gridBugs) {
        const posAttr = gridBugsGeo.attributes.position;
        gridBugState.forEach((b, i) => {
          b.heading += (organicWave(tSec * 0.15, b.seed) - 0.5) * 0.05;
          b.x += Math.cos(b.heading) * b.speed * (1 / 60);
          b.z += Math.sin(b.heading) * b.speed * (1 / 60);
          const dx = b.x - CAM_TARGET.x, dz = b.z - CAM_TARGET.z;
          if (Math.abs(dx) > 210 || Math.abs(dz) > 110) {
            const home = Math.atan2(-dz, -dx);
            b.heading += (home - b.heading) * 0.03;
          }
          const y = terrainHeight(b.x, b.z) + 0.5 + Math.sin(tSec * 0.4 + b.bob) * 0.15;
          posAttr.setXYZ(i, b.x, y, b.z);
        });
        posAttr.needsUpdate = true;
        gridBugsMat.opacity = 0.55 + organicWave(tSec * 0.6, 3.3) * 0.3;
      }
      // Sky motes — plain linear drift, wrapping at the bounds rather than
      // steering back (see the construction comment above for why: this
      // should read as signal passing through, not a creature staying near
      // home the way gridBugs' own boundary correction does).
      if (skyMotes) {
        const posAttr = skyMotesGeo.attributes.position;
        skyMoteState.forEach((m, i) => {
          m.x += Math.cos(m.heading) * m.speed * (1 / 60);
          m.z += Math.sin(m.heading) * m.speed * (1 / 60);
          const dx = m.x - CAM_TARGET.x, dz = m.z - CAM_TARGET.z;
          if (dx > SKY_MOTE_HALF_X) m.x -= 2 * SKY_MOTE_HALF_X;
          else if (dx < -SKY_MOTE_HALF_X) m.x += 2 * SKY_MOTE_HALF_X;
          if (dz > SKY_MOTE_HALF_Z) m.z -= 2 * SKY_MOTE_HALF_Z;
          else if (dz < -SKY_MOTE_HALF_Z) m.z += 2 * SKY_MOTE_HALF_Z;
          const y = m.y + Math.sin(tSec * m.bobRate + m.bob) * 4;
          posAttr.setXYZ(i, m.x, y, m.z);
        });
        posAttr.needsUpdate = true;
      }
      // Station idle glow — a slow independent organic pulse, so stations
      // read as alive even between vessel passes. Reset to 0 (static) when
      // reduceMotion is set, same "stays visible, not disappearing"
      // convention as everything else gated here.
      stations.forEach(st => {
        st.idleGlow = organicWave(tSec * (0.3 + st.pulseRate * 0.3), st.pulseSeed + 5) * 0.6;
      });
      // Terminus — same idle-organic-pulse convention as the stations
      // above, just on the gate's cores and glow instead of a single core.
      terminus.coreMat.emissiveIntensity = 1.0 + organicWave(tSec * 0.35, 12.3) * 0.7;
      terminus.glowMat.opacity = 0.55 + organicWave(tSec * 0.3, 8.8) * 0.35;
    }

    // Growth-patch cellular automaton — the generation clock itself always
    // advances for both tiers (a real automaton's discrete ticks aren't the
    // kind of decorative ambient motion reduceMotion is meant to quiet, any
    // more than the vessel's own travel below is); what DOES respect
    // reduceMotion is NEAR's own per-frame brightness ease (see
    // createGrowthTier above) — eased over several frames normally, snapped
    // instantly when motion is reduced, so a reduced-motion visitor still
    // sees the automaton's real current state, just without the fade. FAR
    // already snaps unconditionally (no ease to begin with), so reduceMotion
    // has nothing further to do there.
    caNear?.tick(1 / 60, reduceMotion);
    caFar?.tick(1 / 60, reduceMotion);

    // Vessel travel — real Lévy-flight step statistics along the whole
    // hand-placed curve (see the Lévy setup above), not constant speed:
    // mostly small local glides, occasionally a longer, more direct one.
    // Always on, not gated under reduceMotion — this is the piece's own
    // core kinetic subject, not decorative ambient motion, same standing
    // this had as a constant-speed loop before.
    const rawT = (tSec - stepStartT) / stepDuration;
    if (rawT >= 1) {
      vesselArc = ((stepFromArc + stepDelta) % totalLength + totalLength) % totalLength;
      beginLevyStep(vesselArc, tSec);
    } else {
      const eased = smoothstep01(Math.max(0, rawT));
      const pos = stepFromArc + stepDelta * eased;
      vesselArc = ((pos % totalLength) + totalLength) % totalLength;
    }
    const vesselU = vesselArc / totalLength;
    // Written into the reusable vesselPos/vesselTangent/vesselQuat (declared
    // above, near FORWARD_AXIS) rather than letting getPointAt/getTangentAt
    // and the orientation quaternion each allocate a fresh object here,
    // every frame.
    curve.getPointAt(vesselU, vesselPos);
    curve.getTangentAt(vesselU, vesselTangent).normalize();
    vessel.group.position.copy(vesselPos);
    vessel.group.quaternion.copy(vesselQuat.setFromUnitVectors(FORWARD_AXIS, vesselTangent));
    vesselLight.position.copy(vesselPos);
    const flicker = 0.9 + Math.sin(tSec * 17) * 0.1;
    vessel.glowMat.opacity = flicker * 0.85;

    // Each station briefly brightens as the vessel actually arrives at its
    // own real point on the curve — the found text's reveal cue is tied to
    // the vessel's own arrival, not an arbitrary separate timer. Compared in
    // real arc-length units now (not a time window) since travel speed is no
    // longer constant under the Lévy-flight model — "close along the path,"
    // not "recently at a since-meaningless average pace," is what should
    // light a station up.
    stations.forEach(st => {
      let dArc = Math.abs(vesselArc - st.arcT * totalLength);
      dArc = Math.min(dArc, totalLength - dArc); // wrap-around distance, shortest way round the loop
      const near = Math.max(0, 1 - dArc / STATION_GLOW_ARC);
      const hoverBoost = (st === hoveredStation || st === selectedStation) ? 0.5 : 0;
      st.coreMat.emissiveIntensity = st.baseEmissive + st.idleGlow + near * 1.3 + hoverBoost;
      st.ringMat.emissiveIntensity = 1.3 + st.idleGlow * 0.5 + near * 1.0 + hoverBoost * 0.5;
    });

    // Station label — sustains, then fades, then hides, same single-block
    // state machine as before; dismissLabel() rewinds into the same window
    // rather than a separate close path.
    //
    // Bug fixed here: the hash gets set to `#beamline/<id>` the moment a
    // label opens (showLabel's own onPieceChange call), but nothing ever
    // cleared it back once the label finished its OWN auto-fade — unlike
    // sphere/orbiter/library's persistent panels, this label is transient
    // by design, so the hash has to be transient too, or it silently falls
    // out of sync with what's actually on screen: URL still says a specific
    // station is open, page shows nothing. A fresh load at that now-stale
    // URL still opens and plays the label through its own normal
    // sustain/fade right on schedule (openPieceById below), so it isn't a
    // crash — it just fades out exactly like a click would, and then
    // nothing on screen ever again matches what the address bar claims,
    // for as long as that tab stays open. onPieceChange(null) below resets
    // the hash to bare `#beamline` the moment the label actually hides,
    // the same "URL reflects what's visible, nothing more" contract every
    // other scene's own panel-close already keeps.
    if (labelSprite.visible) {
      updateLabelScale();
      const age = tSec - labelShownAt;
      if (age < labelSustain) {
        labelMat.opacity = 1;
      } else if (age < labelSustain + LABEL_FADE) {
        labelMat.opacity = 1 - (age - labelSustain) / LABEL_FADE;
      } else {
        labelSprite.visible = false;
        selectedStation = null;
        onPieceChange?.(null);
      }
    }

    renderer.render(scene, camera);
    clippedPreview?.blit();
  }

  // Deep-link entry — called here, not up by openPieceById's own
  // definition (where it used to sit), and that move is load-bearing, not
  // cosmetic. This scene's own click handler declares `let hoveredStation
  // = null, selectedStation = null;` further down the function than
  // openPieceById's own definition, and showLabel() (which openPieceById
  // calls) assigns `selectedStation` as its very first line. Calling
  // openPieceById(initialPieceId) any earlier than this — including right
  // after its own definition — runs into that `let` binding's temporal
  // dead zone and throws a real ReferenceError ("Cannot access
  // 'selectedStation' before initialization"), which aborts
  // createBeamline() entirely: a fresh load of `#beamline/<id>` (exactly
  // what this call exists to support) never rendered anything at all,
  // every time, and `expandScene` in main.js had nothing left to catch it
  // with. By this point in the function every variable showLabel touches
  // (selectedStation, labelSprite, labelMat, viewportH, camera) is long
  // since declared, so this is simply the first point in the function
  // where calling it is actually safe.
  if (!preview && initialPieceId !== null) openPieceById(initialPieceId);

  animate();

  const resize = bindGuardedResize(container, (nw, nh) => {
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
    viewportH = nh;
  });

  return {
    // Same-scene deep link support (main.js's expandScene) — see
    // openPieceById above.
    openPieceById,
    dispose() {
      cancelAnimationFrame(animId);
      resize.dispose();
      orbitDrag?.dispose();
      wheelZoom?.dispose();
      disposeHoverClick?.();
      touchGuard?.dispose();
      clippedPreview?.dispose();
      renderer.dispose();

      skyGeo.dispose(); skyMat.dispose(); skyTex.dispose();
      railCore.geo.dispose(); railCore.mat.dispose(); railCore.map?.dispose();
      railMid.geo.dispose(); railMid.mat.dispose();
      railOuter.geo.dispose(); railOuter.mat.dispose();
      stations.forEach(st => { st.coreGeo.dispose(); st.coreMat.dispose(); st.ringGeo.dispose(); st.ringMat.dispose(); });
      startTex.dispose(); startMat.dispose();
      terminus.gateGeo.dispose(); terminus.gateMat.dispose();
      terminus.gate2Geo.dispose(); terminus.gate2Mat.dispose();
      terminus.coreGeo.dispose(); terminus.coreMat.dispose();
      terminus.glowTex.dispose(); terminus.glowMat.dispose();
      vessel.hullGeo.dispose(); vessel.hullMat.dispose(); vessel.rimMat.dispose(); // rim shares hullGeo, disposed once above
      vessel.ringGeo.dispose(); vessel.ringMat.dispose(); vessel.pulseMap.dispose();
      vessel.glowTex.dispose(); vessel.glowMat.dispose();
      ringPulseTex.dispose();
      terrainGeo?.dispose(); terrainMat?.dispose(); terrainTex?.dispose();
      dustGeo?.dispose(); dustMat?.dispose(); dustTex?.dispose();
      shimmerGeo?.dispose(); shimmerMat?.dispose(); shimmerTex?.dispose();
      gridBugsGeo?.dispose(); gridBugsMat?.dispose(); gridBugsTex?.dispose();
      skyMotesGeo?.dispose(); skyMotesMat?.dispose(); skyMotesTex?.dispose();
      caNear?.geo.dispose(); caNear?.mat.dispose();
      caFar?.geo.dispose(); caFar?.mat.dispose();
      caGlowTex?.dispose(); // shared by both tiers, disposed once
      labelTex?.dispose(); labelMat.dispose();

      jumpList?.dispose();
      title?.remove();
      hint?.remove();
      srLive?.remove();
      renderer.domElement.remove();
    },
  };
}
