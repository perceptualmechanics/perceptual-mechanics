// ─── Lens RE73415 ───────────────────────────────────────────────────────────
//
//   …opens it to reveal a crystalline fractalanch, two inches long, shaped like
//   the antler of an imaginary animal, all branches and nubs.
//
// That is the whole specification, and this file is an attempt to build it.
//
// NO THREE.JS AND NO DOM. Plain arrays, so the object can be described by the
// build as well as rendered by the scene.
//
// ─── What this file deliberately does not do ────────────────────────────────
// **It knows nothing about the corpus.** No sentence count, no reading order,
// no source scene, no word length. Two previous versions of Psyshell built a
// geometry out of the writing — a chrysanthemum whose angle was reading order,
// then a branch whose thickness was Murray's law — and both were rigour
// standing in for a subject. A lens does not encode what it holds.
//
// So the proportions below are not derived from anything and are not presented
// as if they were. They were chosen by rendering the object and looking at it
// until it read as an antler. That is the honest description of how they were
// arrived at, and it is a better reason than a citation would be here.
//
// ─── What an antler is, since it is neither a tree nor a flower ─────────────
// It forks irregularly rather than at a fixed rate. It thickens toward the
// base. It ends in blunt nubs rather than tapering to nothing. It has no axis
// of symmetry — one side carries more than the other. It is palmate in places
// (a flattened fan sharing one plane) and tined in others (a single spike
// continuing alone). And `fractalanch` is doing real work as a word: the
// forking is self-similar, and the thing is an antler.
import { mulberry32, hashSeed } from '../../utils/prng.js';

// One specific object, recovered once. The seed is its catalogue number, so
// the lens is the same lens on every visit — which is the point of it being
// this lens rather than a lens.
export const LENS_ID = 'RE73415';
const rnd = mulberry32(hashSeed(LENS_ID));
const rand = (a, b) => a + (b - a) * rnd();
const pick = arr => arr[Math.floor(rnd() * arr.length)];

// ─── Proportions, chosen by looking ─────────────────────────────────────────
const BEAM_SEGMENTS = 9;        // the main shaft, subdivided so it can curve
const BEAM_LENGTH = 1.0;
const BASE_RADIUS = 0.115;      // thick: an antler's burr, not a twig
const TIP_RADIUS_FLOOR = 0.008;
const MAX_DEPTH = 3;            // an antler forks a few times; a tree forks forever
const NUB_SCALE = 1.5;          // a nub is wider than the tine it ends
const SUB_SEGMENTS = 3;         // per tine, so tines curve rather than kink
// Every tine curves up as it goes, which is the single strongest antler cue and
// the thing the first render was missing: without it the object read as a bare
// winter tree, whose branches leave their trunk and then go straight.
const UPSWEEP = 0.34;

const norm = v => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function frame(d) {
  const ref = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(d, ref));
  return [u, norm(cross(d, u))];
}
// A direction `elev` away from `d`, `az` around it.
function offAxis(d, az, elev) {
  const [u, v] = frame(d);
  const s = Math.sin(elev), c = Math.cos(elev);
  return norm([
    d[0] * c + (u[0] * Math.cos(az) + v[0] * Math.sin(az)) * s,
    d[1] * c + (u[1] * Math.cos(az) + v[1] * Math.sin(az)) * s,
    d[2] * c + (u[2] * Math.cos(az) + v[2] * Math.sin(az)) * s,
  ]);
}

export const SEGMENTS = [];   // { from, to, radius, parent, depth }
export const NUBS = [];       // { pos, radius }

// A tine: a run of sub-segments that curves as it goes, then either forks or
// ends in a nub. `bend` is a fixed drift applied each sub-segment, which is
// what makes a tine an arc rather than a straight spike.
function tine(from, dir, len, radius, depth, parent, bend) {
  let p = from, d = dir, r = radius, last = parent;
  const subLen = len / SUB_SEGMENTS;
  for (let i = 0; i < SUB_SEGMENTS; i++) {
    d = norm(add(d, bend, subLen));
    const q = add(p, d, subLen);
    const rr = Math.max(TIP_RADIUS_FLOOR, r * (1 - 0.38 * (i + 1) / SUB_SEGMENTS));
    SEGMENTS.push({ from: p, to: q, radius: rr, parent: last, depth });
    last = SEGMENTS.length - 1;
    p = q; r = rr;
  }
  if (depth >= MAX_DEPTH || len < 0.16) {
    // "all branches and nubs" — every tine ends in one, blunt rather than sharp.
    NUBS.push({ pos: p, radius: r * NUB_SCALE });
    return;
  }

  // How many children, and of what kind. Irregular on purpose: an antler that
  // forks at a fixed rate reads as a fractal diagram, which is the thing this
  // release exists to stop being.
  const kind = pick(['tine', 'fork', 'fork', 'palm', 'tine']);
  const children = kind === 'tine' ? 1 : kind === 'fork' ? 2 : rnd() < 0.5 ? 3 : 4;
  // Thickening toward the base is a look, not a law: the radius each child
  // keeps is set so a fork visibly narrows and a lone tine barely does. This is
  // NOT Murray's law and is not offered as one — see this file's header for why
  // the previous version's citation was the problem rather than the support.
  const keep = children === 1 ? 0.88 : children === 2 ? 0.74 : 0.62;
  // A palmate cluster shares one plane; a fork does not.
  const [u, v] = frame(d);
  const palmAz = rnd() * Math.PI * 2;
  for (let i = 0; i < children; i++) {
    const az = kind === 'palm'
      ? palmAz + (i - (children - 1) / 2) * 0.34 + rand(-0.08, 0.08)
      : rnd() * Math.PI * 2;
    const elev = kind === 'palm' ? rand(0.30, 0.52) : rand(0.34, 0.78);
    const cd = kind === 'palm'
      ? norm(add(offAxis(d, 0, elev * (i - (children - 1) / 2) * 0.9),
        u, Math.cos(palmAz) * 0.0001))
      : offAxis(d, az, elev);
    const cl = len * rand(0.58, 0.80);
    // Each child gets its own drift, biased the same way as its parent's, so
    // the whole object leans rather than splaying evenly — and biased upward,
    // so a tine turns toward vertical as it goes instead of continuing on the
    // line it left at.
    const cb = norm(add(add(bend, [rand(-0.5, 0.5), rand(-0.2, 0.5), rand(-0.5, 0.5)], 0.55),
      [0, 1, 0], UPSWEEP * rand(0.4, 1.6)));
    tine(p, cd, cl, Math.max(TIP_RADIUS_FLOOR, r * keep), depth + 1, last, cb);
  }
}

// ─── The beam, and the tines off it ─────────────────────────────────────────
// One main shaft, thick at the base, curving as it rises; tines leave it at
// irregular heights and on no fixed schedule. The asymmetry is deliberate: real
// antlers are not mirror-symmetric and neither is this.
{
  let p = [0, 0, 0];
  let d = norm([0.34, 1, 0.10]);
  // A real sweep, not a lean. An antler's beam is an arc — it leaves the skull
  // going up and out and is heading backward by the time it reaches the top —
  // and that arc is most of what separates it from a sapling.
  const beamBend = [0.62, 0, -0.30];
  let r = BASE_RADIUS;
  let last = -1;
  const subLen = BEAM_LENGTH / BEAM_SEGMENTS;
  // Where tines leave the beam: irregular, and one low brow tine, because the
  // low one is the tine anybody would draw if asked to draw an antler.
  const tineAt = new Set([0, 2, 3, 5, 6, 8]);
  for (let i = 0; i < BEAM_SEGMENTS; i++) {
    d = norm(add(d, beamBend, subLen));
    const q = add(p, d, subLen);
    // Tapers to a little over half rather than to a third: the beam stays a
    // beam the whole way up.
    const rr = BASE_RADIUS * (1 - 0.45 * (i + 1) / BEAM_SEGMENTS);
    SEGMENTS.push({ from: p, to: q, radius: rr, parent: last, depth: 0 });
    last = SEGMENTS.length - 1;
    p = q; r = rr;
    if (tineAt.has(i)) {
      // Tines leave the beam roughly forward rather than in every direction:
      // an antler's tines share a side, and a beam with tines all round it is
      // a bottlebrush.
      const az = rand(-0.9, 0.9) + (rnd() < 0.22 ? Math.PI : 0);
      const elev = rand(0.62, 1.02);
      const len = BEAM_LENGTH * rand(0.26, 0.48) * (1 - 0.30 * i / BEAM_SEGMENTS);
      tine(p, offAxis(d, az, elev), len, r * rand(0.48, 0.66), 1, last,
        norm(add([rand(-0.5, 0.5), rand(-0.1, 0.4), rand(-0.5, 0.5)], [0, 1, 0], UPSWEEP * rand(0.5, 1.7))));
    }
    // A few nubs on the shaft itself, not only at the ends — the passage says
    // branches AND nubs, and an antler carries pearling along its beam.
    if (rnd() < 0.35) NUBS.push({ pos: mix(p, q, rand(0.2, 0.8)), radius: rr * rand(1.15, 1.6) });
  }
  NUBS.push({ pos: p, radius: r * NUB_SCALE });
}

export const SEGMENT_COUNT = SEGMENTS.length;
export const NUB_COUNT = NUBS.length;

// ─── Where the filapixels sit, and why it means nothing ─────────────────────
// A filapixel's position is a seeded random draw over the object's arc length.
// It is stable across visits — the same lens every time, because it is a
// specific lens — and it carries **no order, no length and no source**. The
// index of a sentence tells you nothing about where its filapixel is, and the
// position of a filapixel tells you nothing about its sentence.
//
// **This is the release's central subtraction and it should not be undone.**
// Twice now the corpus has been mapped into the geometry, and both times the
// result was a diagram: the object had to carry an argument instead of being
// an object, and every visual problem that followed came from the mapping.
export function placeFilapixels(count) {
  const place = mulberry32(hashSeed(LENS_ID + ':filapixels'));
  const lengths = SEGMENTS.map(s => Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1], s.to[2] - s.from[2]));
  const cum = [];
  let total = 0;
  for (const l of lengths) { total += l; cum.push(total); }

  const pos = new Float32Array(count * 3);
  const seg = new Uint16Array(count);
  const at = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const target = place() * total;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < target) lo = mid + 1; else hi = mid; }
    const s = SEGMENTS[lo];
    const t = place();
    // Nudged off the axis so a filapixel sits inside the crystal's body rather
    // than on its centre line, where it would be hidden by the material.
    const [u, v] = frame(norm([s.to[0] - s.from[0], s.to[1] - s.from[1], s.to[2] - s.from[2]]));
    const a = place() * Math.PI * 2;
    const off = s.radius * (0.35 + 0.5 * place());
    const p = add(add(mix(s.from, s.to, t), u, Math.cos(a) * off), v, Math.sin(a) * off);
    pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
    seg[i] = lo; at[i] = t;
  }
  return { pos, seg, at };
}

// ─── Bounds ─────────────────────────────────────────────────────────────────
// Reported rather than assumed: the scene frames the object against this at
// every layout pass. A sphere is enough here — unlike the branch, this object
// is roughly as wide as it is tall, so a sphere wastes very little.
export const BOUNDS = (() => {
  let minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1e9, maxY = -1e9, maxZ = -1e9;
  const see = ([x, y, z], pad = 0) => {
    if (x - pad < minX) minX = x - pad; if (x + pad > maxX) maxX = x + pad;
    if (y - pad < minY) minY = y - pad; if (y + pad > maxY) maxY = y + pad;
    if (z - pad < minZ) minZ = z - pad; if (z + pad > maxZ) maxZ = z + pad;
  };
  for (const s of SEGMENTS) { see(s.from, s.radius); see(s.to, s.radius); }
  for (const n of NUBS) see(n.pos, n.radius);
  const center = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
  let r = 0;
  const reach = ([x, y, z], pad = 0) => {
    const d = Math.hypot(x - center[0], y - center[1], z - center[2]) + pad;
    if (d > r) r = d;
  };
  for (const s of SEGMENTS) { reach(s.from, s.radius); reach(s.to, s.radius); }
  for (const n of NUBS) reach(n.pos, n.radius);
  return { center, radius: r, min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
})();

// The chain of segments from one segment outward to a tip, for the
// transmission to run along. Capped, because a pulse that runs the whole object
// stops reading as coming from somewhere.
const childrenOf = new Map();
for (let i = 0; i < SEGMENTS.length; i++) {
  const p = SEGMENTS[i].parent;
  if (p < 0) continue;
  if (!childrenOf.has(p)) childrenOf.set(p, []);
  childrenOf.get(p).push(i);
}
export function pathToTip(segIndex, maxSteps = 9) {
  const out = [segIndex];
  let cur = segIndex;
  for (let i = 0; i < maxSteps; i++) {
    const kids = childrenOf.get(cur);
    if (!kids || !kids.length) break;
    cur = kids[0];
    out.push(cur);
  }
  return out;
}
