
const hash = (i) => {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

const noise = (t, seed) => {
  const i = Math.floor(t);
  const f = t - i;
  const a = hash((i | 0) + seed);
  const b = hash((i | 0) + 1 + seed);
  return a + (b - a) * (f * f * (3 - 2 * f));
};

const OCTAVES = [
  [0.31, 0.052],
  [0.83, 0.034],
  [2.30, 0.022],
  [6.10, 0.015],
  [11.30, 0.026],
  [19.70, 0.009],
];

const SWAY_X = [[0.37, 0.62], [0.93, 0.26], [2.10, 0.12], [9.70, 0.030]];
const SWAY_Y = [[0.29, 0.30], [1.13, 0.15], [2.70, 0.07], [11.30, 0.022]];

const sum = (bands, t, s, base) => {
  let v = 0;
  for (let i = 0; i < bands.length; i++) v += (noise(t * bands[i][0], s + base + i * 977) - 0.5) * bands[i][1];
  return v;
};

/**
 * A candle. `seed` gives each mount its own flame; omit it for a random one.
 * `at(seconds)` returns `{ lum, x, y }` — brightness nominally 1 and dipping,
 * and a lean in roughly [-1, 1] on each axis.
 */
export function createFlame(seed = (Math.random() * 1e9) | 0) {
  const s = seed | 0;
  return {
    at(t) {
      const g = noise(t * 0.23, s + 4400);
      const gutter = g > 0.9 ? ((g - 0.9) / 0.1) ** 2 : 0;

      const agitation = 1 + gutter * 1.4;

      const drift = noise(t * 0.11, s + 8100) - 0.5;   // where the draught is coming from
      const clamp = v => (v < -1 ? -1 : v > 1 ? 1 : v);
      const x = clamp((sum(SWAY_X, t, s, 100) + drift * gutter * 2.6) * 2.0);
      const y = clamp(sum(SWAY_Y, t, s, 300) * 2.0 - gutter * 0.55);

      const lean = Math.hypot(x, y);
      let v = 0.995 + sum(OCTAVES, t, s, 0) * 1.9 * agitation - lean * 0.055;

      if (v > 1) v = 1 + (v - 1) * 0.3;

      v -= gutter * 0.14;

      return { lum: v < 0.72 ? 0.72 : v > 1.02 ? 1.02 : v, x, y };
    },
  };
}
