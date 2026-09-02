// ─── Apollo — the physics and the element table ─────────────────────────────
// Eleventh scene (2026-09-02). An absorption spectrum you can play: a band of
// starlight with the lines missing from it, and clicking a gap sounds that
// wavelength as a pitch.
//
// This module is the scene's content, and it is also what `scripts/prerender.js`
// imports to build /text/apollo/. That is why it is a plain data-and-maths
// module with no DOM, no THREE, and no CSS import — Node has to be able to run
// it. Same rule `theater.text.js` and the rest follow.
//
// ─── What is computed and what is looked up, and why the line is where it is ─
// Hydrogen is COMPUTED, from the Rydberg formula, all the way to the series
// limit. Everything else is TABULATED, from NIST.
//
// That split is not laziness on the tabulated side. Hydrogen has one electron
// and its energy levels fall out of a closed-form expression a browser
// evaluates in nanoseconds; the Balmer convergence — lines crowding tighter
// and tighter toward the ultraviolet until they pile up at 364.6nm and stop —
// is this scene's best gesture, and it should be real rather than a list of
// four numbers someone typed. Sodium's doublet, iron's forest and helium's
// scatter come out of many-body quantum mechanics that nobody solves in a
// browser, or anywhere else, in closed form. Deriving them would be effort
// that does not show AND would produce wrong numbers. So they are looked up,
// from the people whose job is to measure them.
//
// ─── Sources ────────────────────────────────────────────────────────────────
// Tabulated wavelengths and relative intensities: NIST Handbook of Basic
// Atomic Spectroscopic Data (J. E. Sansonetti and W. C. Martin), strong-lines
// tables, https://physics.nist.gov/PhysRefData/Handbook/ — US Government work,
// public domain. Air wavelengths in Angstroms there; nanometres here, divided
// by ten and nothing else. Values retrieved 2026-09-02.
//
// One honesty note about `rel`. NIST's relative intensities are EMISSION
// intensities — how bright a line is when the element is made to glow — and
// this scene draws ABSORPTION, how deep a line cuts when the element sits in
// front of a hotter source. Those correlate strongly (both track the same
// transition probabilities) but they are not the same quantity, and a real
// absorption depth also depends on temperature, ionization state and how much
// of the element is in the path. `rel` is used here as a line-strength proxy
// for a visual instrument, not as a photometric claim. Said once, here, rather
// than implied by silence.
//
// Colour-matching functions: Wyman, Sloan & Shirley (2013), "Simple Analytic
// Approximations to the CIE XYZ Color Matching Functions", Journal of Computer
// Graphics Techniques 2(2). Vacuum-to-air refraction: Edlen (1966), the IAU
// standard form.

// ─── Constants ──────────────────────────────────────────────────────────────
export const VISIBLE_MIN = 380; // nm — the band's left edge (violet)
export const VISIBLE_MAX = 750; // nm — the band's right edge (deep red)

export const C_LIGHT = 2.99792458e8;            // m/s, exact by definition
export const RYDBERG_INF = 1.0973731568160e7;   // m^-1, CODATA — infinite nuclear mass
export const ELECTRON_PROTON_MASS_RATIO = 1 / 1836.15267343;

// The Rydberg constant for hydrogen specifically. R_inf assumes a nucleus of
// infinite mass; a real proton recoils, and the reduced-mass correction is the
// difference between landing on the published Balmer wavelengths and missing
// them in the third significant figure. Small correction, visible result.
export const RYDBERG_H = RYDBERG_INF / (1 + ELECTRON_PROTON_MASS_RATIO);

// ─── Vacuum to air ──────────────────────────────────────────────────────────
// The Rydberg formula gives a VACUUM wavelength. Every published table of
// visible-range spectral lines — NIST's included, and the 656.3 / 486.1 /
// 434.0 / 410.2 everyone learns Balmer by — gives an AIR wavelength, because
// that is what a spectrograph on the ground measures. Air's refractive index
// is about 1.00028 across the visible, so the two differ by roughly 0.2nm at
// H-alpha: not a rounding error, and exactly the size of the gap between a
// computed series that agrees with the textbook and one that doesn't.
//
// Getting this right is what lets hydrogen be genuinely computed. The
// alternative — quietly using a Rydberg constant tuned to make the vacuum
// arithmetic land on the air numbers — would produce the same four wavelengths
// from a fudged constant, and would break the moment anyone asked for a
// different series or a hydrogenic ion.
//
// Edlen (1966), the form adopted as the IAU standard. sigma is the vacuum
// wavenumber in inverse micrometres.
export function vacuumToAir(nmVacuum) {
  const sigma = 1e3 / nmVacuum;
  const s2 = sigma * sigma;
  const n = 1 + 8342.13e-8 + 2406030e-8 / (130 - s2) + 15997e-8 / (38.9 - s2);
  return nmVacuum / n;
}

// ─── The Rydberg formula ────────────────────────────────────────────────────
//   1/lambda = R * Z^2 * (1/m^2 - 1/n^2)
// m = 2 is the Balmer series (the one in the visible range); n = 3, 4, 5, ...
// Z^2 is why hydrogenic ions come free from the same function: He+ (Z=2) and
// Li2+ (Z=3) have one electron each and scale exactly, which is a real and
// slightly astonishing fact rather than an approximation. Not exposed in the
// instrument — neither is present in a stellar photosphere in any quantity
// that would show — but the function takes Z because writing it without would
// be pretending the formula is narrower than it is.
export function rydbergLine({ m = 2, n, Z = 1, R = RYDBERG_H }) {
  const invLambdaMetres = R * Z * Z * (1 / (m * m) - 1 / (n * n));
  return vacuumToAir(1e9 / invLambdaMetres);
}

// The series limit: n -> infinity, so the 1/n^2 term vanishes and the whole
// series converges on a single wavelength. The lines do not stop at the limit
// because anything runs out; they pile up against it, infinitely many of them
// in the last fraction of a nanometre, and the continuum takes over past it.
export function seriesLimit({ m = 2, Z = 1, R = RYDBERG_H }) {
  return vacuumToAir(1e9 * (m * m) / (R * Z * Z));
}

// Balmer as far as the eye and the band go. nMax is where to stop drawing, not
// where the series stops — by n = 12 the lines are inside a nanometre of each
// other and a screen cannot separate them, which is the convergence made
// visible rather than a truncation hidden.
//
// `rel` falls off with n because it genuinely does: the transition probability
// drops roughly as n^-3, so H-alpha dominates and the ultraviolet members are
// faint. Modelled rather than tabulated, and labelled as modelled.
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

// ─── Wavelength to pitch ────────────────────────────────────────────────────
// A wavelength has a real frequency: c / lambda. For 589nm that is 5.09e14 Hz,
// which is not a sound. Dividing by a single constant is the whole mapping —
// no scale, no quantization, no per-element tuning — so the pitch relationships
// you hear ARE the wavelength relationships you see.
//
// The divisor is 1e12, stated here because a magic number in a sonification is
// the place a listener is entitled to be suspicious. It puts the visible band
// at 400 Hz (750nm, deep red) to 789 Hz (380nm, violet) — which is a fact
// about light, not a choice: 750 / 380 is 1.97, so the visible spectrum is
// almost exactly one octave wide. The whole instrument lives inside it.
//
// Shorter wavelength is higher frequency, so violet is treble and red is bass,
// with no inversion anywhere in the code. That ordering is the one thing in the
// mapping that should feel obvious the first time it is heard.
export const AUDIO_DIVISOR = 1e12;
export function wavelengthToHz(nm) {
  return (C_LIGHT / (nm * 1e-9)) / AUDIO_DIVISOR;
}

// ─── Wavelength to colour ───────────────────────────────────────────────────
// The obvious cheap version is a hue sweep: map 380-750nm onto hue 270-0 and
// hand it to hsl(). It is wrong in a way that shows. A hue wheel spends equal
// angle on every hue, so it gives cyan and magenta the same width as green,
// and the real spectrum has no magenta in it at all — magenta is what the eye
// invents when it sees red and blue together, and there is no single
// wavelength that produces it. A hue sweep also puts the brightness peak in
// the wrong place: the eye is most sensitive around 555nm, so a real spectrum
// is brilliant in the yellow-green and falls off toward both ends, which is
// the thing that makes a photographed spectrum look like an object.
//
// So: the actual route through colour science. Wavelength -> CIE XYZ via the
// 1931 colour-matching functions -> linear sRGB -> gamma. The colour-matching
// functions are the measured answer to "what does a human see at this
// wavelength", and the multi-lobe Gaussian fits below (Wyman, Sloan & Shirley
// 2013) reproduce the tabulated curves to well under a perceptible difference
// while staying eight lines of arithmetic.
//
// Each lobe is an asymmetric Gaussian: a different sigma either side of the
// peak, which is how these curves actually look.
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

// XYZ -> linear sRGB (sRGB primaries, D65 white). Single-wavelength colours sit
// on the outer boundary of the visible gamut and most of them are OUTSIDE what
// an sRGB display can produce — a real limit rather than a bug, and the reason
// a photograph of a spectrum never looks as saturated as the thing itself. The
// textbook handling is to desaturate toward white by exactly the amount needed
// to bring every channel non-negative, then normalize so the brightest channel
// is 1.
//
// Both halves of that were tried first and both are wrong HERE, which was only
// visible once a strip was rendered and looked at. Six variants were drawn side
// by side as 1000-column strips and compared against photographs of real solar
// spectra; the numbers below are the one that won, and the two it beat are
// worth recording because they are the defaults:
//
//   Adding the FULL white (1.0) put a visible pink through 620-680nm. That is
//   not a rounding artefact, it is the desaturation working as designed —
//   moving a deep red toward D65 white adds blue — and it is still wrong,
//   because there is no pink anywhere in a spectrum and a viewer knows it. At
//   0.60 the red end stays red and the residual out-of-gamut error clips
//   instead, the way film clips.
//
//   Normalizing each column to its own brightest channel pinned every colour to
//   a gamut corner: 520nm and 546nm came out as the identical pure green, and
//   the blue-to-green transition became a hard step. Dropping the per-column
//   normalization is what keeps 26nm of green distinguishable.
//
// A further 6% desaturation is applied on top, uniformly. That is not colour
// science, it is atmosphere: a spectrum photographed through any real optics
// scatters slightly, and the fully saturated version reads as a hue wheel no
// matter how it was computed.
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

// Photopic luminous efficiency, normalized to 1 at its peak. This is the ybar
// curve on its own — the eye's own brightness response — and it is what gives
// the band its rolloff: the violet and deep-red ends of a real spectrum are
// dim because the eye barely registers them, not because there is less light
// there. Multiplying the continuum by this is a one-line change that does more
// for "reads as an object" than any amount of added grain.
const YBAR_PEAK = 0.99818; // this fit's own maximum, at 554.2nm — swept at 0.1nm
export function luminousEfficiency(nm) {
  const [, y] = cieXYZ(nm);
  return Math.min(1, y / YBAR_PEAK);
}

// ─── The elements ───────────────────────────────────────────────────────────
// Ten, curated for what they do to the band and to the sound, not for
// coverage. Most of the periodic table is inert here: the transition metals
// are indistinguishable forests, and most of everything else has nothing at
// all in the visible range. A control surface full of dead elements would be a
// barcode, so this is the ruthless version — an element earns a fader by
// producing either a distinct visual or a distinct sound, and preferably both.
//
// `lines` are [air wavelength in nm, NIST relative intensity]. EVERY tabulated
// value here was read off the NIST strong-lines table for that element and
// divided by ten; nothing is filled in from memory, and lines that could not
// be found in the table were dropped rather than kept on a hunch. Half a dozen
// were dropped that way on the first pass, which is the reason this note
// exists — a table like this is exactly where a plausible wrong number
// survives forever, because nothing downstream can tell.
//
// Ordered by atomic number, which is the one ordering that is a fact rather
// than an opinion; the sparse-to-dense story the instrument is actually about
// is told in the prose rather than smuggled into the layout.
//
// `character` is what that element does as an instrument. Those are claims
// about the data — countable, checkable — not decoration on it.

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

// ─── Derived ────────────────────────────────────────────────────────────────
export const ELEMENT_BY_KEY = Object.fromEntries(ELEMENTS.map(e => [e.key, e]));

export function visibleLines(el) {
  return el.lines.filter(([nm]) => nm >= VISIBLE_MIN && nm <= VISIBLE_MAX);
}

// Every line in the band, flattened, with its element and its pitch — the
// array the scene hit-tests against and the /text/ page tabulates. Built once,
// here, so the instrument and the crawlable page cannot drift apart: the page
// is generated from the same array the instrument plays.
export const ALL_LINES = ELEMENTS.flatMap(el =>
  visibleLines(el).map(([nm, rel]) => ({ el: el.key, nm, rel, hz: wavelengthToHz(nm) }))
).sort((a, b) => a.nm - b.nm);

// The scene caps how many lines one gesture can sound. Iron would otherwise
// start fifty oscillators from a single press, which is both a bad noise and a
// real load; twelve is enough for iron to read as a cluster and for helium to
// read as a chord, and it is the same cap for every element, so the comparison
// between them stays honest.
export const CHORD_CAP = 12;

export const SOURCES = {
  nist: 'NIST Handbook of Basic Atomic Spectroscopic Data (Sansonetti & Martin), strong-lines tables, physics.nist.gov/PhysRefData/Handbook/ — a US Government work, public domain. Retrieved 2026-09-02.',
  cmf: 'Wyman, Sloan & Shirley (2013), “Simple Analytic Approximations to the CIE XYZ Color Matching Functions”, Journal of Computer Graphics Techniques 2(2).',
  edlen: 'Edlén (1966), the vacuum-to-air refraction formula adopted as the IAU standard.',
  codata: 'CODATA recommended value for the Rydberg constant, with the reduced-mass correction for hydrogen applied here.',
};

// ─── The sun's own mixture ──────────────────────────────────────────────────
// Apollo's ambient mode plays the composition of sunlight, from the elements
// already in the instrument. The instrument was built out of the sun; this is
// it playing the thing it came from.
//
// WHICH ELEMENTS. Sourced, not chosen. The standard Fraunhofer table assigns
// letters to the most prominent features of the solar spectrum, and once the
// three atmospheric oxygen bands (A, B, a — absorbed by Earth's air, not the
// sun's) are set aside, five elements own every remaining labelled line:
//
//   Calcium    K 393.4, H 396.8, g 422.7
//   Iron       E 527.0, c 495.8, d 466.8, e 438.4, G 430.8
//   Hydrogen   C 656.3, F 486.1, f 434.0, h 410.2
//   Magnesium  b1-b4 516.7-518.4
//   Sodium     D1 589.6, D2 589.0
//
// The other five elements in the instrument sit at zero, which is a fact about
// the sun rather than an omission. Helium is the one worth naming: it was
// found IN THE SUN in 1868, twenty-seven years before anyone found it on
// Earth, and it is still not part of the sun's visible fingerprint — its D3
// line at 587.6nm belongs to the chromosphere and to prominences, not to the
// photospheric absorption spectrum this band draws. The element named after
// the sun is not in the sun's visible signature.
//
// HOW MUCH OF EACH — and this is a ruler, not a measurement, so it is stated
// as one. What the fader controls is column density in THIS model: Gaussian
// line profiles, NIST relative intensities as a strength proxy, and an
// arbitrary maximum optical depth. No published quantity maps onto that. Solar
// equivalent widths would be the right physical input and no machine-readable
// table of them was reachable; photospheric abundances are available and would
// be actively WRONG here, because they would put helium second and calcium
// near nothing, when calcium's H and K are the deepest features in the visible
// solar spectrum. Abundance is not line strength.
//
// So: the ORDERING below is sourced from the Fraunhofer table above, and the
// VALUES are set so the rendered band reproduces that ordering. Each was
// checked by computing the peak optical depth it produces rather than by
// looking at it:
//
//   Ca 0.95 -> tau 4.37 at K, 1.3% transmission   (deepest, as it should be)
//   H  0.85 -> tau 3.91 at H-alpha, 2.0%
//   Na 0.80 -> tau 3.68 at D2, 2.5%
//   Fe 0.70 -> tau 1.32 at 438.4, 26.7%, across 50 lines — crowding, not depth
//   Mg 1.00 -> tau 1.07 at b1, 34.5%
//
// AND ONE HONEST FAILURE, because it is the emission-versus-absorption caveat
// in this file's header turning into a number. Magnesium cannot be made dark
// enough. Its b triplet is comparable in depth to sodium's D lines in the real
// solar spectrum, but NIST's EMISSION intensity for b1 is 70 against sodium
// D2's 1000 — so at the maximum fader position magnesium's strongest line
// still transmits 34.5%. The fader is already at 1.00 and there is nowhere
// further to push it. This is the proxy being wrong in a specific, measurable
// place, and the alternative — a per-element correction factor invented to
// make one line look right — would be worse: it would be taste wearing the
// costume of data, in the one module whose whole claim is that its numbers
// came from somewhere.
export const SOLAR_MIXTURE = { Ca: 0.95, H: 0.85, Na: 0.80, Fe: 0.70, Mg: 1.00 };

// Fraunhofer's own letters, for the lines that carry them. He assigned these
// in 1814 — mapping over 570 dark lines, the exact count differing by source —
// with no idea what they were; Kirchhoff and Bunsen worked out that they were
// elements forty-five years later. The letters outlived the ignorance: the
// sodium D lines and the calcium H and K lines are still called that.
//
// EACH LETTER IS BOUND TO ITS ELEMENT, and that is not decoration. A first
// version matched letters to wavelengths alone, and calcium promptly claimed
// Fraunhofer G — which the table assigns to iron — because calcium happens to
// have a line 0.016nm away from it. A letter is a fact about a feature in the
// solar spectrum, not about a coordinate, and two elements can sit close enough
// to swap one. (The G band is genuinely a blend of Fe, Ca and CH in the real
// sun; the point stands anyway, because the table names iron and a lookup that
// can hand a letter to whichever element is nearest will eventually hand one to
// something the table never mentioned.)
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
