import { mulberry32, hashSeed } from '../../utils/prng.js';

export const LENS_ID = 'RE73415';
const rnd = mulberry32(hashSeed(LENS_ID));
const rand = (a, b) => a + (b - a) * rnd();
const pick = arr => arr[Math.floor(rnd() * arr.length)];

const BEAM_SEGMENTS = 9;        // the main shaft, subdivided so it can curve
const BEAM_LENGTH = 1.0;
const BASE_RADIUS = 0.115;      // thick: an antler's burr, not a twig
const TIP_RADIUS_FLOOR = 0.008;
const MAX_DEPTH = 3;            // an antler forks a few times; a tree forks forever
const NUB_SCALE = 1.5;          // a nub is wider than the tine it ends
const SUB_SEGMENTS = 3;         // per tine, so tines curve rather than kink
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
    NUBS.push({ pos: p, radius: r * NUB_SCALE });
    return;
  }

  const kind = pick(['tine', 'fork', 'fork', 'palm', 'tine']);
  const children = kind === 'tine' ? 1 : kind === 'fork' ? 2 : rnd() < 0.5 ? 3 : 4;
  const keep = children === 1 ? 0.88 : children === 2 ? 0.74 : 0.62;
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
    const cb = norm(add(add(bend, [rand(-0.5, 0.5), rand(-0.2, 0.5), rand(-0.5, 0.5)], 0.55),
      [0, 1, 0], UPSWEEP * rand(0.4, 1.6)));
    tine(p, cd, cl, Math.max(TIP_RADIUS_FLOOR, r * keep), depth + 1, last, cb);
  }
}

{
  let p = [0, 0, 0];
  let d = norm([0.34, 1, 0.10]);
  const beamBend = [0.62, 0, -0.30];
  let r = BASE_RADIUS;
  let last = -1;
  const subLen = BEAM_LENGTH / BEAM_SEGMENTS;
  const tineAt = new Set([0, 2, 3, 5, 6, 8]);
  for (let i = 0; i < BEAM_SEGMENTS; i++) {
    d = norm(add(d, beamBend, subLen));
    const q = add(p, d, subLen);
    const rr = BASE_RADIUS * (1 - 0.45 * (i + 1) / BEAM_SEGMENTS);
    SEGMENTS.push({ from: p, to: q, radius: rr, parent: last, depth: 0 });
    last = SEGMENTS.length - 1;
    p = q; r = rr;
    if (tineAt.has(i)) {
      const az = rand(-0.9, 0.9) + (rnd() < 0.22 ? Math.PI : 0);
      const elev = rand(0.62, 1.02);
      const len = BEAM_LENGTH * rand(0.26, 0.48) * (1 - 0.30 * i / BEAM_SEGMENTS);
      tine(p, offAxis(d, az, elev), len, r * rand(0.48, 0.66), 1, last,
        norm(add([rand(-0.5, 0.5), rand(-0.1, 0.4), rand(-0.5, 0.5)], [0, 1, 0], UPSWEEP * rand(0.5, 1.7))));
    }
    if (rnd() < 0.35) NUBS.push({ pos: mix(p, q, rand(0.2, 0.8)), radius: rr * rand(1.15, 1.6) });
  }
  NUBS.push({ pos: p, radius: r * NUB_SCALE });
}

export const SEGMENT_COUNT = SEGMENTS.length;
export const NUB_COUNT = NUBS.length;

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
    const [u, v] = frame(norm([s.to[0] - s.from[0], s.to[1] - s.from[1], s.to[2] - s.from[2]]));
    const a = place() * Math.PI * 2;
    const off = s.radius * (0.35 + 0.5 * place());
    const p = add(add(mix(s.from, s.to, t), u, Math.cos(a) * off), v, Math.sin(a) * off);
    pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
    seg[i] = lo; at[i] = t;
  }
  return { pos, seg, at };
}

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
