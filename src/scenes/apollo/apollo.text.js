
export const VISIBLE_MIN = 380; // nm — the band's left edge (violet)
export const VISIBLE_MAX = 750; // nm — the band's right edge (deep red)

export const C_LIGHT = 2.99792458e8;            // m/s, exact by definition
export const RYDBERG_INF = 1.0973731568160e7;   // m^-1, CODATA — infinite nuclear mass
export const ELECTRON_PROTON_MASS_RATIO = 1 / 1836.15267343;

export const RYDBERG_H = RYDBERG_INF / (1 + ELECTRON_PROTON_MASS_RATIO);

export function vacuumToAir(nmVacuum) {
  const sigma = 1e3 / nmVacuum;
  const s2 = sigma * sigma;
  const n = 1 + 8342.13e-8 + 2406030e-8 / (130 - s2) + 15997e-8 / (38.9 - s2);
  return nmVacuum / n;
}

export function rydbergLine({ m = 2, n, Z = 1, R = RYDBERG_H }) {
  const invLambdaMetres = R * Z * Z * (1 / (m * m) - 1 / (n * n));
  return vacuumToAir(1e9 / invLambdaMetres);
}

export function seriesLimit({ m = 2, Z = 1, R = RYDBERG_H }) {
  return vacuumToAir(1e9 * (m * m) / (R * Z * Z));
}

export function balmerSeries({ nMax = 14, Z = 1 } = {}) {
  const out = [];
  for (let n = 3; n <= nMax; n++) {
    const nm = rydbergLine({ m: 2, n, Z });
    if (nm < VISIBLE_MIN - 6 || nm > VISIBLE_MAX) continue;
    out.push({ nm, rel: Math.round(1000 * Math.pow(3 / n, 3)), n });
  }
  return out;
}

export const BALMER_LIMIT = seriesLimit({ m: 2, Z: 1 });

export const AUDIO_DIVISOR = 1e12;
export function wavelengthToHz(nm) {
  return (C_LIGHT / (nm * 1e-9)) / AUDIO_DIVISOR;
}

function lobe(x, mu, sigma1, sigma2) {
  const t = (x - mu) * (x < mu ? 1 / sigma1 : 1 / sigma2);
  return Math.exp(-0.5 * t * t);
}
export function cieXYZ(nm) {
  const x = 1.056 * lobe(nm, 599.8, 37.9, 31.0)
          + 0.362 * lobe(nm, 442.0, 16.0, 26.7)
          - 0.065 * lobe(nm, 501.1, 20.4, 26.2);
  const y = 0.821 * lobe(nm, 568.8, 46.9, 40.5)
          + 0.286 * lobe(nm, 530.9, 16.3, 31.1);
  const z = 1.217 * lobe(nm, 437.0, 11.8, 36.0)
          + 0.681 * lobe(nm, 459.0, 26.0, 13.8);
  return [x, y, z];
}

const GAMUT_WHITE = 0.60;
const SCATTER_DESATURATION = 0.06;
export function wavelengthToRGB(nm, { intensity = 1 } = {}) {
  const [X, Y, Z] = cieXYZ(nm);
  let r =  3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b =  0.0557 * X - 0.2040 * Y + 1.0570 * Z;

  const min = Math.min(r, g, b);
  if (min < 0) { const w = -min * GAMUT_WHITE; r += w; g += w; b += w; }
  r = Math.max(0, r); g = Math.max(0, g); b = Math.max(0, b);

  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  r += (lum - r) * SCATTER_DESATURATION;
  g += (lum - g) * SCATTER_DESATURATION;
  b += (lum - b) * SCATTER_DESATURATION;

  const enc = v => {
    const c = Math.max(0, Math.min(1, v * intensity));
    return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
  };
  return [enc(r), enc(g), enc(b)];
}

const YBAR_PEAK = 0.99818; // this fit's own maximum, at 554.2nm — swept at 0.1nm
export function luminousEfficiency(nm) {
  const [, y] = cieXYZ(nm);
  return Math.min(1, y / YBAR_PEAK);
}


const H_LINES = balmerSeries({ nMax: 16 }).map(l => [Number(l.nm.toFixed(3)), l.rel]);

export const ELEMENTS = [
  {
    key: 'H', symbol: 'H', name: 'Hydrogen', z: 1,
    computed: true,
    character: 'Four lines wide apart, then a crowd. The tutorial element: sparse enough to count, and the only one here whose wavelengths are calculated rather than looked up.',
    note: 'The Balmer series, computed live from the Rydberg formula and converted from vacuum to air. The lines crowd tighter toward the violet and converge on the series limit at ' + BALMER_LIMIT.toFixed(1) + 'nm, just past the left edge of the band. They do not stop there because anything runs out — infinitely many of them pile up in the last fraction of a nanometre.',
    lines: H_LINES,
  },
  {
    key: 'He', symbol: 'He', name: 'Helium', z: 2,
    character: 'Sparse and widely spaced across the whole band. Sounds like a chord — five or six pitches far enough apart to hear separately.',
    note: 'Found in the sun in 1868, in an eclipse spectrum with a yellow line nobody could match to a terrestrial element, and not found on Earth until 1895. The line was 587.6nm, and it is the strongest one on this fader.',
    lines: [
      [381.961, 10], [386.748, 3], [388.865, 300], [396.473, 20],
      [400.927, 1], [402.619, 50], [412.082, 12], [414.376, 3],
      [438.793, 10], [443.755, 3], [447.148, 200], [471.315, 30],
      [492.193, 20], [501.568, 100], [504.774, 10], [587.562, 500],
      [667.815, 200], [706.518, 100],
    ],
  },
  {
    key: 'Li', symbol: 'Li', name: 'Lithium', z: 3,
    character: 'One dominant line in the deep red and almost nothing else. The minimal case — nearly a single tone, and the closest this instrument gets to a plain note.',
    note: 'The 670.8nm resonance line is itself a doublet, 670.778 and 670.793nm, fifteen thousandths of a nanometre apart. At this scale they land on the same pixel and the same pitch. Sodium is where a doublet becomes wide enough to see, and to hear.',
    lines: [
      [413.262, 2], [460.290, 30], [497.175, 10], [610.365, 400], [670.793, 1000],
    ],
  },
  {
    key: 'Ne', symbol: 'Ne', name: 'Neon', z: 10,
    character: 'Dense in the orange and red, nearly empty in the blue. The most strongly coloured set here — and everyone already knows what neon looks like, which makes it the one element whose spectrum can be checked against memory.',
    note: 'That red-orange crowding is the sign in the window. A neon tube glows the colour it does because almost all of its strong lines sit between 580 and 750nm, and the eye sums them into one colour.',
    lines: [
      [453.775, 100], [470.439, 150], [470.886, 120], [471.007, 100],
      [471.206, 150], [471.534, 150], [478.893, 100], [482.734, 100],
      [488.492, 100], [533.078, 60], [534.109, 100], [540.056, 200],
      [571.922, 50], [574.830, 50], [576.442, 70], [580.445, 50],
      [582.016, 50], [585.249, 200], [587.283, 50], [588.190, 100],
      [594.483, 50], [596.547, 50], [597.463, 50], [597.553, 60],
      [598.791, 15], [603.000, 100], [607.434, 100], [609.616, 30],
      [612.845, 10], [614.306, 100], [616.359, 100], [618.215, 15],
      [621.728, 100], [626.650, 100], [630.479, 100], [632.817, 30],
      [633.443, 100], [638.299, 100], [640.225, 200], [650.653, 150],
      [653.288, 10], [659.895, 100], [665.209, 15], [667.828, 50],
      [692.947, 1000], [702.405, 300], [703.241, 800], [705.911, 100],
      [717.394, 800], [724.517, 800], [748.887, 300],
    ],
  },
  {
    key: 'Na', symbol: 'Na', name: 'Sodium', z: 11,
    character: 'Two lines so close together they read as one until you look. Sonically this is the point of the whole instrument: the pair is half a hertz apart after transposition, and half a hertz apart is not two notes — it is one note that pulses.',
    note: 'The D doublet, 588.995 and 589.592nm. The split is real: it is the sodium atom’s outer electron feeling its own orbital motion, and resolving 0.597nm of it is most of what a spectroscope was invented for. Here the visual spacing IS the harmonic relationship, and that is the claim the sonification stands or falls on.',
    lines: [
      [568.263, 4], [568.820, 7], [588.995, 1000], [589.592, 500],
      [615.423, 2], [616.075, 3],
    ],
  },
  {
    key: 'Mg', symbol: 'Mg', name: 'Magnesium', z: 12,
    character: 'Three close lines in the green — the b triplet. The middle case between sodium’s two and iron’s hundreds: still countable, already a chord rather than a beat.',
    note: 'Fraunhofer labelled the triplet b when he catalogued the dark lines in sunlight in 1814, decades before anyone knew what element made them. The name stuck to the letter, not the metal.',
    lines: [
      [382.936, 25], [383.230, 50], [383.829, 80], [457.110, 5],
      [516.732, 12], [517.268, 40], [518.360, 70], [571.109, 5],
      [738.769, 2],
    ],
  },
  {
    key: 'Ca', symbol: 'Ca', name: 'Calcium', z: 20,
    character: 'Two enormous lines crammed against the violet edge, and a scatter of ordinary ones across the rest. H and K are among the deepest features in real sunlight, so this fader is the one that makes the band look most like a photograph of the sun.',
    note: 'H at 396.847nm and K at 393.366nm are singly-ionized calcium, not the neutral metal — which is why they survive in a stellar atmosphere hot enough to strip an electron off. Fraunhofer’s letters again.',
    lines: [
      [393.366, 1000], [396.847, 1000], [422.673, 1000], [430.253, 500],
      [430.774, 500], [442.544, 500], [443.496, 500], [443.569, 500],
      [445.478, 600], [445.589, 600], [445.661, 400], [487.813, 500],
      [518.885, 500], [526.556, 500], [527.027, 500], [534.947, 500],
      [558.197, 500], [558.876, 500], [559.012, 500], [559.447, 500],
      [559.849, 500], [585.745, 600], [610.272, 500], [612.222, 600],
      [616.217, 600], [616.906, 500], [616.956, 600], [643.907, 700],
      [644.981, 600], [646.257, 700], [647.166, 600], [649.378, 600],
      [649.965, 600], [657.278, 500], [671.769, 600], [714.815, 700],
      [720.219, 600], [732.615, 700],
    ],
  },
  {
    key: 'Fe', symbol: 'Fe', name: 'Iron', z: 26,
    character: 'A wall. Fifty lines here and thousands in reality, most of them jammed into the blue and violet, and struck together they are not a chord but a cluster — noise with a shape. Iron is in the instrument precisely because it breaks it.',
    note: 'That crowding is why the blue end of the solar spectrum is darker and busier than the red end. Iron is abundant, and it has twenty-six electrons arranged so that almost every one of them has somewhere to go.',
    lines: [
      [381.296, 60], [381.584, 150], [382.043, 500], [382.444, 250],
      [382.588, 150], [382.782, 120], [383.422, 100], [384.044, 50],
      [384.105, 80], [385.637, 250], [385.991, 500], [387.857, 150],
      [388.628, 300], [388.851, 30], [389.566, 80], [389.971, 120],
      [390.295, 40], [392.026, 60], [392.291, 120], [392.792, 120],
      [393.030, 200], [400.524, 40], [404.581, 300], [406.359, 150],
      [407.174, 120], [413.206, 40], [414.387, 80], [420.203, 30],
      [421.618, 40], [425.079, 30], [426.047, 80], [427.176, 120],
      [428.240, 120], [430.790, 120], [432.576, 150], [437.593, 80],
      [438.354, 200], [440.475, 120], [441.512, 30], [442.730, 60],
      [446.165, 40], [492.050, 50], [495.760, 150], [516.749, 250],
      [517.160, 50], [522.715, 100], [526.954, 120], [527.036, 80],
      [532.804, 80], [532.853, 30],
    ],
  },
  {
    key: 'Ba', symbol: 'Ba', name: 'Barium', z: 56,
    character: 'One strong green line with blue company. The firework colour, and the only green-dominant element on the rail.',
    note: 'Barium 553.5nm is the green in a firework shell. 455.4 and 493.4nm are singly-ionized barium — the same element in a different state, sitting at different places on the band, which is a thing an absorption spectrum can show and a flame test cannot.',
    lines: [
      [389.178, 20], [413.065, 25], [413.243, 9], [416.600, 3],
      [428.310, 30], [452.493, 2], [455.403, 1000], [489.993, 6],
      [493.408, 300], [553.548, 1000], [577.762, 80], [585.368, 40],
      [599.709, 80], [611.078, 250], [614.171, 300], [649.690, 200],
      [649.876, 250], [652.731, 110], [659.533, 100], [667.527, 50],
      [669.384, 50], [686.569, 9], [705.994, 200], [712.033, 30],
      [719.523, 9], [728.030, 150],
    ],
  },
  {
    key: 'Hg', symbol: 'Hg', name: 'Mercury', z: 80,
    character: 'Few lines, all bright, all far apart, spread from violet to yellow. The cleanest chord in the set — the classic lab lamp, and the spectrum most likely to be recognised by anyone who has ever calibrated an instrument.',
    note: 'The 435.8nm violet and 546.1nm green are the two lines a spectroscope is usually calibrated against: strong, isolated, and known to more decimal places than any instrument needs.',
    lines: [
      [404.656, 400], [433.922, 60], [434.749, 100], [435.833, 1000],
      [546.074, 500], [576.960, 50], [579.066, 60], [708.190, 25],
    ],
  },
];

export const ELEMENT_BY_KEY = Object.fromEntries(ELEMENTS.map(e => [e.key, e]));

export function visibleLines(el) {
  return el.lines.filter(([nm]) => nm >= VISIBLE_MIN && nm <= VISIBLE_MAX);
}

export const ALL_LINES = ELEMENTS.flatMap(el =>
  visibleLines(el).map(([nm, rel]) => ({ el: el.key, nm, rel, hz: wavelengthToHz(nm) }))
).sort((a, b) => a.nm - b.nm);

export const CHORD_CAP = 12;

export const SOURCES = {
  nist: 'NIST Handbook of Basic Atomic Spectroscopic Data (Sansonetti & Martin), strong-lines tables, physics.nist.gov/PhysRefData/Handbook/ — a US Government work, public domain. Retrieved 2026-09-02.',
  cmf: 'Wyman, Sloan & Shirley (2013), “Simple Analytic Approximations to the CIE XYZ Color Matching Functions”, Journal of Computer Graphics Techniques 2(2).',
  edlen: 'Edlén (1966), the vacuum-to-air refraction formula adopted as the IAU standard.',
  codata: 'CODATA recommended value for the Rydberg constant, with the reduced-mass correction for hydrogen applied here.',
};

export const SOLAR_MIXTURE = { Ca: 0.95, H: 0.85, Na: 0.80, Fe: 0.70, Mg: 1.00 };

export const FRAUNHOFER = [
  { letter: 'K',  nm: 393.366, el: 'Ca' },
  { letter: 'H',  nm: 396.847, el: 'Ca' },
  { letter: 'h',  nm: 410.178, el: 'H'  },
  { letter: 'g',  nm: 422.673, el: 'Ca' },
  { letter: 'G',  nm: 430.790, el: 'Fe' },
  { letter: 'f',  nm: 434.051, el: 'H'  },
  { letter: 'e',  nm: 438.354, el: 'Fe' },
  { letter: 'F',  nm: 486.138, el: 'H'  },
  { letter: 'c',  nm: 495.760, el: 'Fe' },
  { letter: 'b4', nm: 516.732, el: 'Mg' },
  { letter: 'b2', nm: 517.268, el: 'Mg' },
  { letter: 'b1', nm: 518.360, el: 'Mg' },
  { letter: 'E',  nm: 526.954, el: 'Fe' },
  { letter: 'D2', nm: 588.995, el: 'Na' },
  { letter: 'D1', nm: 589.592, el: 'Na' },
  { letter: 'C',  nm: 656.288, el: 'H'  },
];
export function fraunhoferFor(nm, elKey = null) {
  for (const f of FRAUNHOFER) {
    if (elKey && f.el !== elKey) continue;
    if (Math.abs(f.nm - nm) < 0.05) return f.letter;
  }
  return null;
}
