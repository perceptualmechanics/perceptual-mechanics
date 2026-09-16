
export const FIELD = [
  { key: 'sphere',    hf:  1.0293, mad: 0.007629 },
  { key: 'butterfly', hf: 60.5166, mad: 0.043210 },
  { key: 'scroll',    hf:  9.3880, mad: 0.000379 },
  { key: 'theater',   hf:  3.6037, mad: 0.002139 },
  { key: 'orbiter',   hf: 16.2655, mad: 0.001850 },
  { key: 'orrery',    hf: 40.0450, mad: 0.000347 },
  { key: 'library',   hf:  4.8922, mad: 0.000164 },
  { key: 'beamline',  hf: 10.7243, mad: 0.008940 },
  { key: 'apollo',    hf: 23.2025, mad: 0.001661 },
  { key: 'harmonics', hf: 57.1032, mad: 0.004003 },
  { key: 'outside',   hf:  2.8572, mad: 0.000224 },
  { key: 'psyshell',  hf: 38.8747, mad: 0.013034 },
];

const MAD_FLOOR = 1e-5;   // below any measured value; keeps log() finite
const lx = v => Math.log10(v);
const ly = v => Math.log10(Math.max(v, MAD_FLOOR));

function normalize(values) {
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  return values.map(v => (v - lo) / span);
}

export const COORDS = (() => {
  const xs = normalize(FIELD.map(f => lx(f.hf)));
  const ys = normalize(FIELD.map(f => ly(f.mad)));
  return FIELD.map((f, i) => ({ key: f.key, x: xs[i], y: ys[i] }));
})();

export function relax(points, { minDist, width, height, pad, passes = 60, anchor = 0.06 }) {
  const p = points.map(q => ({ ...q, px: q.px, py: q.py }));
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        let dx = p[j].px - p[i].px, dy = p[j].py - p[i].py;
        let d = Math.hypot(dx, dy);
        if (d >= minDist) continue;
        if (d < 1e-6) { dx = (j - i); dy = 0; d = Math.abs(dx); }
        const push = (minDist - d) / 2 / d;
        p[i].px -= dx * push; p[i].py -= dy * push;
        p[j].px += dx * push; p[j].py += dy * push;
      }
    }
    for (const q of p) {
      q.px += (q.tx - q.px) * anchor;
      q.py += (q.ty - q.py) * anchor;
      q.px = Math.min(width - pad, Math.max(pad, q.px));
      q.py = Math.min(height - pad, Math.max(pad, q.py));
    }
  }
  for (let pass = 0; pass < 8; pass++) {
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        let dx = p[j].px - p[i].px, dy = p[j].py - p[i].py;
        let d = Math.hypot(dx, dy);
        if (d >= minDist) continue;
        if (d < 1e-6) { dx = (j - i); dy = 0; d = Math.abs(dx); }
        const push = (minDist - d) / 2 / d;
        p[i].px -= dx * push; p[i].py -= dy * push;
        p[j].px += dx * push; p[j].py += dy * push;
      }
    }
    for (const q of p) {
      q.px = Math.min(width - pad, Math.max(pad, q.px));
      q.py = Math.min(height - pad, Math.max(pad, q.py));
    }
  }
  let maxShift = 0;
  for (const q of p) maxShift = Math.max(maxShift, Math.hypot(q.px - q.tx, q.py - q.ty));
  return { points: p, maxShift };
}

export function placeField({ width, height, tile, gap = 8 }) {
  const pad = tile / 2 + 4;
  const w = Math.max(1, width - 2 * pad), h = Math.max(1, height - 2 * pad);
  const seeded = COORDS.map(c => {
    const tx = pad + c.x * w;
    const ty = pad + (1 - c.y) * h;
    return { key: c.key, tx, ty, px: tx, py: ty };
  });
  return relax(seeded, { minDist: tile + gap, width, height, pad });
}
