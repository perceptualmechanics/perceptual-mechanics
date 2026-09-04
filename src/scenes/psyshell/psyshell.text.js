// ─── Psyshell — the branch, derived from the corpus ─────────────────────────
// "a thousand light trails form, taking the shape of a white fiber-optic
// chrysanthemum, each filapixel a moment in time, demarcated in the code of
// the Union." — the Holography manuscript, Untgract's workshop.
//
// One filapixel is one sentence of this site's writing. There are 3,221.
//
// NO DOM AND NO THREE.JS IN THIS FILE. `scripts/prerender.js` imports it to
// build `/text/psyshell/` from the same numbers the scene renders, so the page
// and the object cannot disagree. That also rules out importing THREE for its
// vector maths — `vite.config.js` imports prerender, and Vite bundles its own
// config, so a THREE import here would pull the renderer into the config
// bundle. The vector helpers below are plain arrays for that reason.
//
// ─── Why a branch and not a blossom (4.7.0) ─────────────────────────────────
// The blossom was built, rendered, looked at, and replaced. Keeping the reason
// so it is not re-proposed:
//
// **It converged 3,221 rays on one origin.** That is structurally why the core
// clipped to white and why the inner two-thirds of every ray was lost — a sum
// taken at a point cannot be fixed by staggering the inner radius, and 4.6.0
// spent three passes discovering that. The density that was paid for was not
// visible: three thousand rays went in and a viewer saw a bright core with a
// fringe.
//
// **And the radial form threw away what the data is.** Reading order is
// linear. A flower had to wrap it into an angle, and the wrap is what forced
// the √contribution correction, because equal arcs gave a 1,382:1 density
// ratio between Scroll and Butterfly. A branch has an axis and a hierarchy,
// which is what the corpus has, and the concentration becomes legible instead
// of being a density problem to correct for.
//
// The passage survives the change: a fibre-optic spray from a stem is still a
// thousand light trails in which each filapixel is a moment in time, and still
// a flower's part.
//
// ─── The structure is the corpus, unmodified ────────────────────────────────
//   site → scene → piece → sentence
//   trunk → limb  → branch → filapixel
//
// Nine limbs, not eleven: Harmonics publishes no text of its own and Outside
// publishes only labels, neither of which is an omission (4.6.0's finding).
// 119 branches. 3,221 filapixels. Position along an axis is position in
// reading order — directly, with no wrapping.
import { readCorpus, wordCount } from '../../utils/corpus.js';
import * as scroll from '../scroll/scroll.text.js';
import * as theater from '../theater/theater.text.js';
import * as sphere from '../sphere/sphere.text.js';
import * as library from '../library/library.text.js';
import * as orbiter from '../orbiter/orbiter.text.js';
import * as apollo from '../apollo/apollo.text.js';
import * as beamline from '../beamline/beamline.text.js';
import * as orrery from '../orrery/orrery.text.js';
import * as butterfly from '../butterfly/butterfly.text.js';

const MODULES = { scroll, theater, sphere, library, orbiter, apollo, beamline, orrery, butterfly };

// Registry order, so the branch reads in the same sequence as the nav rather
// than in a second order nobody can check.
const LIMB_ORDER = ['sphere', 'butterfly', 'scroll', 'theater', 'orbiter', 'orrery', 'library', 'beamline', 'apollo'];
const LABELS = {
  sphere: 'The Sphere', butterfly: 'Chaos Butterfly', scroll: 'Selected Works',
  theater: 'The Theater', orbiter: 'Orbiter', orrery: 'The Orrery of Los Feliz',
  library: 'The Library', beamline: 'Beamline', apollo: 'Apollo',
};

// ─── Murray's law ───────────────────────────────────────────────────────────
// Cecil Murray, 1926: the physiological principle of minimum work. For a
// branching transport network, the parent radius cubed equals the sum of the
// daughters' radii cubed —
//
//     r_parent^α = Σ r_daughter^α        with α = 3
//
// It governs arteries, lungs and xylem, and it is the law for optimal
// transport through a branching network, which is what a fibre-optic branch
// is. The same kind of fact as base e: a minimisation result, which is why the
// Union would reach for both.
//
// **State which exponent shipped, because this is the sort of true thing that
// garbles on restatement.** α = 2 is Leonardo's rule, which preserves total
// cross-sectional area. α = 3 is Murray's, which optimises flow. Real plants
// measure across the range and not at one value: vines scale closer to
// Murray's 3, and woody trees closer to da Vinci's 2. **This ships α = 3**, on
// the grounds that the object is a transport network rather than a tree —
// which means it is deliberately NOT the exponent a real woody branch would
// measure at, and that is a choice rather than an oversight.
//
// One consequence worth naming: with every terminal filament the same radius,
// Murray reduces exactly to **radius ∝ (number of filapixels)^(1/3)**. Scroll's
// limb is 1350^(1/3) = 11.05 terminal radii and Butterfly's is 1. The 1,382:1
// spread that broke the blossom's arcs becomes 11:1 in thickness, and it is
// the law that does it rather than a correction applied on top.
export const MURRAY_EXPONENT = 3;
const murray = n => Math.pow(n, 1 / MURRAY_EXPONENT);

// ─── The golden angle ───────────────────────────────────────────────────────
// 137.507764…°, the divergence angle of classical phyllotaxis: successive
// organs emerge that far around the axis from their predecessor. It is what
// determines emergence position in real plants, and here it does one concrete
// job — **it distributes children around an axis so that no two align**, which
// is precisely what keeps 3,221 filapixels from occluding each other.
//
// A precision note, since the standard citation is easy to over-apply: Vogel's
// 1979 model is the standard formulation of the SUNFLOWER HEAD, a spiral
// packing in a disc. The divergence angle used here for emergence around a
// stem is the older, general phyllotactic fact, not Vogel's disc model.
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // 137.5077…°

// ─── Proportions ────────────────────────────────────────────────────────────
// Built in natural units and fitted to the viewport at layout time, never
// scaled by a constant — the 4.4.2 rule. `psyshell.js` measures the bounding
// sphere this file reports and frames it.
const TRUNK_LEN = 3.0;
const TRUNK_BASE = 0.10;        // where the first limb may attach
const TRUNK_SPAN = 0.86;        // fraction of the trunk limbs attach along
// A limb's length and its radius both scale as the cube root of what it
// carries, so a branch is self-similar: the same law sets both, and a limb
// carrying one sentence is a spur rather than a thin wire of full length.
const LIMB_UNIT = 0.195;
const PIECE_UNIT = 0.115;
const TERMINAL_RADIUS = 0.0042; // r0 — every filapixel is this thick
// Limbs angle UP rather than out, and the reason is the frame rather than
// botany alone. The object turns, so what has to fit is the cylinder its
// silhouette sweeps — and at 52° off the trunk that cylinder was wider (1.875)
// than the branch was tall (2.88), which on a 320x568 portrait viewport meant
// the width constraint set the distance and the object filled a third of the
// height. Raising the limbs narrows the sweep and lengthens the object, which
// is what a portrait frame wants and what a side limb on a real branch does.
const LIMB_ELEV = 26 * Math.PI / 180;   // off the parent axis
const PIECE_ELEV = 52 * Math.PI / 180;
const FILAMENT_ELEV = 64 * Math.PI / 180;
// A filapixel's own length still comes from its sentence's word count.
const FIL_MIN = 0.030;
const FIL_MAX = 0.125;

// ─── Vector helpers, plain arrays ───────────────────────────────────────────
const norm = v => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
// An orthonormal pair perpendicular to `d`, chosen so it does not degenerate
// when `d` is the Y axis — which the trunk is.
function frame(d) {
  const ref = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(d, ref));
  return [u, norm(cross(d, u))];
}
// A child direction: `az` around the parent axis, `elev` away from it.
function childDir(d, az, elev) {
  const [u, v] = frame(d);
  const s = Math.sin(elev), c = Math.cos(elev);
  return norm([
    d[0] * c + (u[0] * Math.cos(az) + v[0] * Math.sin(az)) * s,
    d[1] * c + (u[1] * Math.cos(az) + v[1] * Math.sin(az)) * s,
    d[2] * c + (u[2] * Math.cos(az) + v[2] * Math.sin(az)) * s,
  ]);
}

// ─── Build ──────────────────────────────────────────────────────────────────
const corpus = readCorpus(MODULES);
const byKey = Object.fromEntries(corpus.map(c => [c.key, c.pieces]));
const present = LIMB_ORDER.filter(k => (byKey[k]?.length ?? 0) > 0);

const TOTAL = present.reduce((a, k) => a + byKey[k].reduce((b, p) => b + p.length, 0), 0);

// Word-count → length, the same square-root map with a percentile clamp the
// blossom used, restated here because the numbers it needs are computed below.
const allWords = [];
for (const k of present) for (const p of byKey[k]) for (const t of p) allWords.push(wordCount(t));
const sortedWords = [...allWords].sort((a, b) => a - b);
export const WORDS_MEDIAN = sortedWords[Math.floor(sortedWords.length * 0.5)];
export const WORDS_CLAMP = sortedWords[Math.floor(sortedWords.length * 0.99)];
export const WORDS_MAX = sortedWords[sortedWords.length - 1];
export const CLAMPED_FILAMENTS = allWords.filter(w => w > WORDS_CLAMP).length;
const rootMin = 1, rootMax = Math.sqrt(WORDS_CLAMP);
const filLength = w => {
  const t = (Math.sqrt(Math.min(w, WORDS_CLAMP)) - rootMin) / Math.max(1e-6, rootMax - rootMin);
  return FIL_MIN + (FIL_MAX - FIL_MIN) * Math.max(0, Math.min(1, t));
};

export const TEXTS = [];
const F = { ox: [], oy: [], oz: [], dx: [], dy: [], dz: [], len: [], words: [],
  limb: [], piece: [], orderInLimb: [], pathA: [], pathP: [], pathL: [] };
// Structural members, for the second instanced mesh: trunk segments, limbs and
// branches, each as { from, to, radius }.
export const STEMS = [];
export const LIMBS = [];

let cumBefore = 0;
const trunkDir = [0, 1, 0];
let limbAz = 0;

// The trunk tapers by Murray as limbs leave it: its radius at any height is
// set by what is still above. Nine attachments give ten segments, and the
// taper is the law rather than a look.
const attachAt = [];
for (let li = 0; li < present.length; li++) {
  const key = present[li];
  const pieces = byKey[key];
  const n = pieces.reduce((a, p) => a + p.length, 0);
  const t = cumBefore / TOTAL;
  const attachY = TRUNK_BASE + TRUNK_SPAN * TRUNK_LEN * t;
  attachAt.push({ y: attachY, remaining: TOTAL - cumBefore });

  const limbLen = LIMB_UNIT * murray(n);
  const limbRadius = TERMINAL_RADIUS * murray(n);
  limbAz += GOLDEN_ANGLE;
  const limbDir = childDir(trunkDir, limbAz, LIMB_ELEV);
  const limbFrom = [0, attachY, 0];
  const limbTo = add(limbFrom, limbDir, limbLen);
  STEMS.push({ from: limbFrom, to: limbTo, radius: limbRadius, kind: 'limb', limb: li });

  const limb = { key, label: LABELS[key] ?? key, index: li, pieces: pieces.length,
    count: n, words: 0, attachY, length: limbLen, radius: limbRadius,
    azimuth: (limbAz % (2 * Math.PI)) * 180 / Math.PI, childRadii: [] };
  LIMBS.push(limb);

  let cumInLimb = 0;
  let pieceAz = 0;
  for (let pi = 0; pi < pieces.length; pi++) {
    const sents = pieces[pi];
    const m = sents.length;
    // Along the limb by reading order within the limb.
    const pAlong = limbLen * (0.10 + 0.86 * (cumInLimb / Math.max(1, n)));
    const pieceFrom = add(limbFrom, limbDir, pAlong);
    const pieceLen = PIECE_UNIT * murray(m);
    const pieceRadius = TERMINAL_RADIUS * murray(m);
    limb.childRadii.push(pieceRadius);
    pieceAz += GOLDEN_ANGLE;
    const pieceDir = childDir(limbDir, pieceAz, PIECE_ELEV);
    STEMS.push({ from: pieceFrom, to: add(pieceFrom, pieceDir, pieceLen), radius: pieceRadius, kind: 'piece', limb: li });

    let filAz = 0;
    for (let si = 0; si < m; si++) {
      const along = pieceLen * (0.08 + 0.88 * (si / Math.max(1, m)));
      const from = add(pieceFrom, pieceDir, along);
      filAz += GOLDEN_ANGLE;
      const dir = childDir(pieceDir, filAz, FILAMENT_ELEV);
      const w = wordCount(sents[si]);
      F.ox.push(from[0]); F.oy.push(from[1]); F.oz.push(from[2]);
      F.dx.push(dir[0]); F.dy.push(dir[1]); F.dz.push(dir[2]);
      F.len.push(filLength(w)); F.words.push(w);
      F.limb.push(li); F.piece.push(STEMS.length - 1);
      F.orderInLimb.push(cumInLimb + si);
      // Path coordinates, in world units, for the propagation's tree distance.
      F.pathA.push(along);      // filapixel → its branch's base
      F.pathP.push(pAlong);     // that branch's base → its limb's base
      F.pathL.push(attachY);    // that limb's base → the trunk's base
      TEXTS.push(sents[si]);
      limb.words += w;
    }
    cumInLimb += m;
  }
  cumBefore += n;
}

// Trunk segments, from the base up, each carrying what is still above it.
{
  let y = 0;
  for (const a of attachAt) {
    if (a.y > y) STEMS.push({ from: [0, y, 0], to: [0, a.y, 0], radius: TERMINAL_RADIUS * murray(a.remaining), kind: 'trunk', limb: -1 });
    y = a.y;
  }
  STEMS.push({ from: [0, y, 0], to: [0, TRUNK_LEN, 0], radius: TERMINAL_RADIUS * murray(1), kind: 'trunk', limb: -1 });
}

export const FILAMENT_COUNT = TEXTS.length;
export const PIECE_COUNT = LIMBS.reduce((a, l) => a + l.pieces, 0);
export const CORPUS_WORDS = F.words.reduce((a, b) => a + b, 0);
export const TRUNK_RADIUS = TERMINAL_RADIUS * murray(TOTAL);
export const TERMINAL_RADIUS_OUT = TERMINAL_RADIUS;

export const FILAMENTS = {
  origin: Float32Array.from(F.ox.flatMap((_, i) => [F.ox[i], F.oy[i], F.oz[i]])),
  dir: Float32Array.from(F.dx.flatMap((_, i) => [F.dx[i], F.dy[i], F.dz[i]])),
  length: Float32Array.from(F.len),
  words: Uint16Array.from(F.words),
  limb: Uint8Array.from(F.limb),
  piece: Uint16Array.from(F.piece),
  orderInLimb: Uint16Array.from(F.orderInLimb),
  pathA: Float32Array.from(F.pathA),
  pathP: Float32Array.from(F.pathP),
  pathL: Float32Array.from(F.pathL),
};

// ─── Bounding sphere ────────────────────────────────────────────────────────
// Reported rather than assumed, because the scene fits the frame to it at
// every layout pass and a constant here would be the 4.4.2 defect again.
export const BOUNDS = (() => {
  let minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1e9, maxY = -1e9, maxZ = -1e9;
  const see = (x, y, z) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  };
  for (const s of STEMS) { see(...s.from); see(...s.to); }
  for (let i = 0; i < FILAMENT_COUNT; i++) {
    const o = i * 3, L = FILAMENTS.length[i];
    see(FILAMENTS.origin[o] + FILAMENTS.dir[o] * L,
      FILAMENTS.origin[o + 1] + FILAMENTS.dir[o + 1] * L,
      FILAMENTS.origin[o + 2] + FILAMENTS.dir[o + 2] * L);
  }
  const center = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
  let r = 0;
  const reach = (x, y, z) => { const d = Math.hypot(x - center[0], y - center[1], z - center[2]); if (d > r) r = d; };
  for (const s of STEMS) { reach(...s.from); reach(...s.to); }
  for (let i = 0; i < FILAMENT_COUNT; i++) {
    const o = i * 3, L = FILAMENTS.length[i];
    reach(FILAMENTS.origin[o] + FILAMENTS.dir[o] * L,
      FILAMENTS.origin[o + 1] + FILAMENTS.dir[o + 1] * L,
      FILAMENTS.origin[o + 2] + FILAMENTS.dir[o + 2] * L);
  }
  // A sphere is the wrong hull for this object and fitting one wastes most of
  // the frame: the branch is tall and narrow, so its bounding sphere is mostly
  // empty. The idle turn is about Y, so the shape the silhouette actually
  // sweeps is a CYLINDER about that axis — rotation-invariant like the sphere,
  // and far tighter. Reported alongside so the scene can frame to it.
  let radiusXZ = 0;
  const reachXZ = (x, _y, z) => {
    const d = Math.hypot(x - center[0], z - center[2]);
    if (d > radiusXZ) radiusXZ = d;
  };
  for (const s of STEMS) { reachXZ(...s.from); reachXZ(...s.to); }
  for (let i = 0; i < FILAMENT_COUNT; i++) {
    const o = i * 3, L = FILAMENTS.length[i];
    reachXZ(FILAMENTS.origin[o] + FILAMENTS.dir[o] * L,
      FILAMENTS.origin[o + 1] + FILAMENTS.dir[o + 1] * L,
      FILAMENTS.origin[o + 2] + FILAMENTS.dir[o + 2] * L);
  }
  // ─── The fitting hull ─────────────────────────────────────────────────────
  // A single radius-and-height pair over-fits, because it assumes the tallest
  // points are also the widest ones. They are not: the trunk's top is ON the
  // axis, where rotation moves it not at all, while the widest points are at
  // mid-height. Fitting to max(height) and max(radius) together therefore
  // reserves room for a point that does not exist, and the object came out at
  // 41–62% of the frame.
  //
  // So: every point is reduced to (rho, |y|) — its distance from the turning
  // axis and its height above the centre — and the Pareto frontier of that set
  // is kept. A point dominated by another with both a larger rho and a larger
  // |y| can never be the binding constraint, so a few dozen survive out of
  // ~6,700. The scene evaluates the exact requirement at each of them:
  //
  //     D >= rho / sin(hHalf)                  (cannot clip sideways at any turn)
  //     D >= |y| / tan(vHalf) + rho            (nearest face is rho closer)
  //
  // which is tight rather than safe-by-margin, and is per-viewport by
  // construction because both half-angles come from the live aspect.
  const pts = [];
  const seeHull = (x, y, z) => pts.push([Math.hypot(x - center[0], z - center[2]), Math.abs(y - center[1])]);
  for (const s of STEMS) { seeHull(...s.from); seeHull(...s.to); }
  for (let i = 0; i < FILAMENT_COUNT; i++) {
    const o = i * 3, L = FILAMENTS.length[i];
    seeHull(FILAMENTS.origin[o] + FILAMENTS.dir[o] * L,
      FILAMENTS.origin[o + 1] + FILAMENTS.dir[o + 1] * L,
      FILAMENTS.origin[o + 2] + FILAMENTS.dir[o + 2] * L);
  }
  pts.sort((a, b) => b[0] - a[0]);
  const hull = [];
  let bestY = -1;
  for (const p of pts) if (p[1] > bestY) { hull.push(p); bestY = p[1]; }

  // Signed frontiers, above and below the centre. The unsigned hull is enough
  // to size the object but not to CENTRE it: with the camera tilted down, the
  // projection of the box's centre is not the centre of the projected box, and
  // fitting symmetrically about it put the base 20px into the title on the
  // three narrowest viewports. The scene solves for distance and offset
  // together from these two.
  const signed = [];
  const seeSigned = (x, y, z) => signed.push([Math.hypot(x - center[0], z - center[2]), y - center[1]]);
  for (const s of STEMS) { seeSigned(...s.from); seeSigned(...s.to); }
  for (let i = 0; i < FILAMENT_COUNT; i++) {
    const o = i * 3, L = FILAMENTS.length[i];
    seeSigned(FILAMENTS.origin[o] + FILAMENTS.dir[o] * L,
      FILAMENTS.origin[o + 1] + FILAMENTS.dir[o + 1] * L,
      FILAMENTS.origin[o + 2] + FILAMENTS.dir[o + 2] * L);
  }
  const frontier = sign => {
    const list = signed.filter(p => sign * p[1] > 0).map(p => [p[0], Math.abs(p[1])]);
    list.sort((a, b) => b[0] - a[0]);
    const out = []; let best = -1;
    for (const p of list) if (p[1] > best) { out.push(p); best = p[1]; }
    return out;
  };
  const hullUp = frontier(1), hullDown = frontier(-1);

  // A sample of real 3D points for the scene to PROJECT. Two passes of
  // analytic fitting were tried first and both under- or over-shot, because
  // the quantity that matters — where the object lands on screen — depends on
  // the projection and the camera's tilt together, and reconstructing that in
  // closed form is reimplementing the renderer badly. Every stem endpoint plus
  // every sixteenth filament tip is a few hundred points; the scene projects
  // them at eight rotations and reads the answer off.
  const probes = [];
  for (const s of STEMS) { probes.push(s.from, s.to); }
  for (let i = 0; i < FILAMENT_COUNT; i += 16) {
    const o = i * 3, L = FILAMENTS.length[i];
    probes.push([FILAMENTS.origin[o] + FILAMENTS.dir[o] * L,
      FILAMENTS.origin[o + 1] + FILAMENTS.dir[o + 1] * L,
      FILAMENTS.origin[o + 2] + FILAMENTS.dir[o + 2] * L]);
  }

  return { center, radius: r, radiusXZ, height: maxY - minY, hull, hullUp, hullDown, probes,
    min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
})();

// ─── Tree distance ──────────────────────────────────────────────────────────
// The propagation travels along the structure, not through space: up to the
// parent, out to siblings, down other limbs. This is the exact path length
// between two filapixels in world units, which is why the front speed can be
// stated in world units per second and needs no invented weights.
export function pathDistance(a, b) {
  if (FILAMENTS.piece[a] === FILAMENTS.piece[b]) {
    return Math.abs(FILAMENTS.pathA[a] - FILAMENTS.pathA[b]);
  }
  const up = FILAMENTS.pathA[a] + FILAMENTS.pathA[b];
  if (FILAMENTS.limb[a] === FILAMENTS.limb[b]) {
    return up + Math.abs(FILAMENTS.pathP[a] - FILAMENTS.pathP[b]);
  }
  return up + FILAMENTS.pathP[a] + FILAMENTS.pathP[b]
    + Math.abs(FILAMENTS.pathL[a] - FILAMENTS.pathL[b]);
}

// ─── The assertions this file makes about itself ────────────────────────────
// Thrown at import time, so the build fails rather than the scene.
{
  const summed = LIMBS.reduce((a, l) => a + l.count, 0);
  if (summed !== FILAMENT_COUNT || TEXTS.length !== FILAMENT_COUNT ||
      FILAMENTS.length.length !== FILAMENT_COUNT || FILAMENTS.origin.length !== FILAMENT_COUNT * 3) {
    throw new Error(`psyshell: filapixel count disagrees with sentence count — limbs sum to ${summed}, texts ${TEXTS.length}, lengths ${FILAMENTS.length.length}, origins ${FILAMENTS.origin.length / 3}`);
  }
  // Murray's law holds at every junction, checked rather than assumed: a
  // limb's radius cubed must equal the sum of its branches' radii cubed.
  for (const l of LIMBS) {
    const lhs = Math.pow(l.radius, MURRAY_EXPONENT);
    const rhs = l.childRadii.reduce((a, r) => a + Math.pow(r, MURRAY_EXPONENT), 0);
    if (Math.abs(lhs - rhs) > 1e-12) {
      throw new Error(`psyshell: Murray's law fails at limb ${l.key} — r^3 = ${lhs}, Σ daughters^3 = ${rhs}`);
    }
  }
  // And successive children really are a golden angle apart.
  const step = (GOLDEN_ANGLE * 180 / Math.PI) % 360;
  if (Math.abs(step - 137.5077640500378) > 1e-9) {
    throw new Error(`psyshell: golden angle is ${step}°, not 137.5077640500378°`);
  }
}
// ─── The notation: base e ───────────────────────────────────────────────────
// A struck filament transmits its own ordinal along its length, in base e.
// Legible as transmission, never readable as text — which is the Union's
// relationship to everything. English travelling up the strand would mean the
// visitor is being addressed, and they are not.
//
// **Base e is not a gag.** Under the standard radix-economy cost model — the
// cost of representing numbers is the radix times the number of digits, r·w —
// the optimum is e, and 3 is the nearest integer and therefore almost always
// the most economical integer radix. Ternary computers were built on exactly
// this reasoning: the Setun, built at Moscow State University by Brusentsov's
// group, about fifty machines between 1958 and 1965, eighteen trits.
// (Brian Hayes, "Third Base", American Scientist, 2001.) Binary is a
// compromise forced by transistors, and an entity optimising representation
// rather than engineering uses the actual optimum rather than the nearest
// buildable one.
//
// **State the cost model with the claim.** "Base e is the most efficient
// radix" unqualified is exactly the kind of true-sounding sentence that gets
// garbled on restatement — it is efficient under r·w, and other cost models
// give other answers.
//
// The joke underneath, which does not go on the page: the most efficient
// possible notation is unreadable, and Setun spent its own radix advantage by
// storing each trit in two magnetic cores. That is history rather than
// invention, and it is the Union in one line.
//
// Two properties of a non-integer radix earn their place here beyond the
// argument:
//   - **Representations are not unique.** The digit set {0,1,2} is larger than
//     e, so a value generally has several valid encodings and none is
//     canonical. No canon in a number system.
//   - **Nothing lands on a grid.** Powers of e are irrational, so the digit
//     durations never line up and the train has no visible beat — which is
//     what makes it unlike every data-transmission cliché, all of which are
//     square waves.
export const RADIX = Math.E;
export const DIGIT_SET = 3;          // {0, 1, 2}
export const FRACTIONAL_PLACES = 3;  // where a non-terminating expansion is cut

// Greedy expansion, most significant place first. Returns
// { digits: [d], highest: K } for value = Σ d_k · e^k, k from K down to
// −FRACTIONAL_PLACES. Greedy is a choice and not the only valid one — see the
// non-uniqueness note above — so it is named rather than assumed.
export function baseEDigits(value) {
  if (!(value > 0)) return { digits: [0], highest: 0 };
  let highest = Math.floor(Math.log(value) / Math.log(RADIX));
  if (Math.pow(RADIX, highest + 1) <= value) highest += 1;
  const digits = [];
  let rem = value;
  for (let k = highest; k >= -FRACTIONAL_PLACES; k--) {
    const place = Math.pow(RADIX, k);
    let d = Math.floor(rem / place);
    if (d > DIGIT_SET - 1) d = DIGIT_SET - 1;
    if (d < 0) d = 0;
    digits.push(d);
    rem -= d * place;
  }
  return { digits, highest };
}

// The value a decoder recovers from those digits — the round trip the /text/
// page prints, and the reason the truncation error is stated rather than
// hidden.
export function decodeBaseE(digits, highest) {
  let v = 0;
  for (let i = 0; i < digits.length; i++) v += digits[i] * Math.pow(RADIX, highest - i);
  return v;
}

