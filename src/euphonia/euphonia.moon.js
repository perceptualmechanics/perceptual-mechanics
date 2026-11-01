// The moon's phases and its face at an instant, from Jean Meeus, Astronomical
// Algorithms (2nd ed., 1998): chapter 49 for the instants of new, quarter and
// full moon, chapter 48 (48.4) for the phase angle. Pure; verify-euphonia-map
// holds the phases to Fred Espenak's catalogue, computed after the same book.
const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const JD_UNIX = 2440587.5;
const J2000 = 2451545;
export const SYNODIC = 29.530588861;
const sin = d => Math.sin(d * RAD), cos = d => Math.cos(d * RAD);

// ΔT, dynamical time less universal time, in seconds: Espenak and Meeus's
// polynomial for 1600–1700 (Five Millennium Canon of Solar Eclipses, NASA
// TP-2006-214141). About 27 s in 1668.
export function deltaT(year) {
  if (year < 1600 || year >= 1700) throw new RangeError(`ΔT is held here for 1600–1700 only, not ${year}`);
  const t = year - 1600;
  return 120 - 0.9808 * t - 0.01532 * t * t + t ** 3 / 7129;
}
const yearOf = ms => { const d = new Date(ms); return d.getUTCFullYear() + d.getUTCMonth() / 12; };
const jde = ms => ms / DAY_MS + JD_UNIX + deltaT(yearOf(ms)) / 86400;
const msOf = jdeValue => {
  const approx = (jdeValue - JD_UNIX) * DAY_MS;
  return approx - deltaT(yearOf(approx)) * 1000;
};

export const PHASES = ['new', 'first quarter', 'full', 'last quarter'];

// Periodic terms of chapter 49: [coefficient, power of E, M, M′, F, Ω] with
// the argument M·m + M′·m′ + F·f + Ω·o.
const NEW = [
  [-0.40720, 0, 0, 1, 0, 0], [0.17241, 1, 1, 0, 0, 0], [0.01608, 0, 0, 2, 0, 0],
  [0.01039, 0, 0, 0, 2, 0], [0.00739, 1, -1, 1, 0, 0], [-0.00514, 1, 1, 1, 0, 0],
  [0.00208, 2, 2, 0, 0, 0], [-0.00111, 0, 0, 1, -2, 0], [-0.00057, 0, 0, 1, 2, 0],
  [0.00056, 1, 1, 2, 0, 0], [-0.00042, 0, 0, 3, 0, 0], [0.00042, 1, 1, 0, 2, 0],
  [0.00038, 1, 1, 0, -2, 0], [-0.00024, 1, -1, 2, 0, 0], [-0.00017, 0, 0, 0, 0, 1],
  [-0.00007, 0, 2, 1, 0, 0], [0.00004, 0, 0, 2, -2, 0], [0.00004, 0, 3, 0, 0, 0],
  [0.00003, 0, 1, 1, -2, 0], [0.00003, 0, 0, 2, 2, 0], [-0.00003, 0, 1, 1, 2, 0],
  [0.00003, 0, -1, 1, 2, 0], [-0.00002, 0, -1, 1, -2, 0], [-0.00002, 0, 1, 3, 0, 0],
  [0.00002, 0, 0, 4, 0, 0],
];
const FULL = [
  [-0.40614, 0, 0, 1, 0, 0], [0.17302, 1, 1, 0, 0, 0], [0.01614, 0, 0, 2, 0, 0],
  [0.01043, 0, 0, 0, 2, 0], [0.00734, 1, -1, 1, 0, 0], [-0.00515, 1, 1, 1, 0, 0],
  [0.00209, 2, 2, 0, 0, 0], ...NEW.slice(7),
];
const QUARTER = [
  [-0.62801, 0, 0, 1, 0, 0], [0.17172, 1, 1, 0, 0, 0], [-0.01183, 1, 1, 1, 0, 0],
  [0.00862, 0, 0, 2, 0, 0], [0.00804, 0, 0, 0, 2, 0], [0.00454, 1, -1, 1, 0, 0],
  [0.00204, 2, 2, 0, 0, 0], [-0.00180, 0, 0, 1, -2, 0], [-0.00070, 0, 0, 1, 2, 0],
  [-0.00040, 0, 0, 3, 0, 0], [-0.00034, 1, -1, 2, 0, 0], [0.00032, 1, 1, 0, 2, 0],
  [0.00032, 1, 1, 0, -2, 0], [-0.00028, 2, 2, 1, 0, 0], [0.00027, 1, 2, 0, 0, 0],
  [-0.00017, 0, 0, 0, 0, 1], [-0.00005, 0, -1, 1, -2, 0], [0.00004, 0, 0, 2, 2, 0],
  [-0.00004, 0, 1, 1, 2, 0], [0.00004, 0, -2, 1, 0, 0], [0.00003, 0, 1, 1, -2, 0],
  [0.00003, 0, 3, 0, 0, 0], [0.00002, 0, 0, 2, -2, 0], [0.00002, 0, -1, 1, 2, 0],
  [-0.00002, 0, 1, 3, 0, 0],
];
// The planetary arguments A1–A14: [base, rate per lunation, coefficient].
const PLANETARY = [
  [299.77, 0.107408, 0.000325], [251.88, 0.016321, 0.000165], [251.83, 26.651886, 0.000164],
  [349.42, 36.412478, 0.000126], [84.66, 18.206239, 0.000110], [141.74, 53.303771, 0.000062],
  [207.14, 2.453732, 0.000060], [154.84, 7.306860, 0.000056], [34.52, 27.261239, 0.000047],
  [207.19, 0.121824, 0.000042], [291.34, 1.844379, 0.000040], [161.72, 24.198154, 0.000037],
  [239.56, 25.513099, 0.000035], [331.55, 3.592518, 0.000023],
];

// The instant (UT ms) of the phase numbered k: k whole for new moon, +0.25
// first quarter, +0.5 full, +0.75 last quarter, counted from January 2000.
export function phaseInstant(k) {
  const T = k / 1236.85;
  let t = 2451550.09766 + SYNODIC * k + 0.00015437 * T ** 2 - 0.000000150 * T ** 3 + 0.00000000073 * T ** 4;
  const E = 1 - 0.002516 * T - 0.0000074 * T ** 2;
  const M = 2.5534 + 29.10535670 * k - 0.0000014 * T ** 2 - 0.00000011 * T ** 3;
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T ** 2 + 0.00001238 * T ** 3 - 0.000000058 * T ** 4;
  const F = 160.7108 + 390.67050284 * k - 0.0016118 * T ** 2 - 0.00000227 * T ** 3 + 0.000000011 * T ** 4;
  const Om = 124.7746 - 1.56375588 * k + 0.0020672 * T ** 2 + 0.00000215 * T ** 3;
  const quarter = ((k % 1) + 1) % 1;
  const terms = quarter === 0 ? NEW : quarter === 0.5 ? FULL : QUARTER;
  for (const [c, e, m, mp, f, o] of terms) t += c * E ** e * sin(m * M + mp * Mp + f * F + o * Om);
  if (terms === QUARTER) {
    const W = 0.00306 - 0.00038 * E * cos(M) + 0.00026 * cos(Mp) - 0.00002 * cos(Mp - M) + 0.00002 * cos(Mp + M) + 0.00002 * cos(2 * F);
    t += quarter === 0.25 ? W : -W;
  }
  PLANETARY.forEach(([base, rate, c], i) => {
    t += c * sin(base + rate * k - (i === 0 ? 0.009173 * T ** 2 : 0));
  });
  return msOf(t);
}

// Every phase whose instant falls in [fromMs, toMs], in order.
export function phases(fromMs, toMs) {
  const k0 = Math.floor((yearOf(fromMs) - 2000) * 12.3685) - 1;
  const out = [];
  for (let q = k0 * 4; ; q++) {
    const ms = phaseInstant(q / 4);
    if (ms > toMs) break;
    if (ms >= fromMs) out.push({ ms, phase: PHASES[((q % 4) + 4) % 4] });
  }
  return out;
}

// The moon at an instant: waxing from new to full and waning from full to
// new, its age since the last new moon, and the fraction of its face lit,
// from the phase angle of (48.4).
export function moonAt(ms) {
  const around = phases(ms - 32 * DAY_MS, ms + 32 * DAY_MS);
  const last = around.filter(p => p.ms <= ms && (p.phase === 'new' || p.phase === 'full')).at(-1);
  const lastNew = around.filter(p => p.ms <= ms && p.phase === 'new').at(-1);
  const T = (jde(ms) - J2000) / 36525;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T ** 2 + T ** 3 / 545868 - T ** 4 / 113065000;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T ** 2 + T ** 3 / 24490000;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T ** 2 + T ** 3 / 69699 - T ** 4 / 14712000;
  const i = 180 - D - 6.289 * sin(Mp) + 2.100 * sin(M) - 1.274 * sin(2 * D - Mp) - 0.658 * sin(2 * D) - 0.214 * sin(2 * Mp) - 0.110 * sin(D);
  return {
    waxing: last.phase === 'new',
    age: (ms - lastNew.ms) / DAY_MS,
    lit: (1 + cos(i)) / 2,
    next: around.find(p => p.ms > ms),
  };
}
