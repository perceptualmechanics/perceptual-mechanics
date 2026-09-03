// ─── Psyshell — the flower's geometry, derived from the corpus ──────────────
// "a white fiber-optic chrysanthemum, each filapixel a moment in time,
// demarcated in the code of the Union" — the Holography manuscript, Untgract's
// workshop. One filapixel is one sentence of this site's writing. One petal.
//
// NO DOM AND NO THREE.JS IN THIS FILE. `scripts/prerender.js` imports it to
// build `/text/psyshell/` from the same numbers the scene renders, so the page
// and the flower cannot disagree about what the corpus is.
//
// ─── What is claimed, and what is not ───────────────────────────────────────
// This is the distinction from the shelved Spectra work, which claimed the
// corpus had a hidden spectral property and measured that it does not (see
// `src/scenes/spectra/SHELVED.md`). Nothing here is claimed about the writing.
// The writing has a shape — a number of sentences, of certain lengths, in a
// certain order, from certain scenes — and that shape is trivially and
// verifiably true. The geometry is that shape and nothing else.
//
//   angle around the axis  = position in reading order
//   petal length           = sentence length
//   band                   = which scene it came from
//
// ─── The three rulers, stated ───────────────────────────────────────────────
// **Sentence split:** `prose`, from `src/utils/corpus.js` — see that file for
// the three rules that were compared and why this one ships.
//
// **Band arc ∝ √petals.** Not equal, and not proportional, and the reason is
// measured rather than aesthetic. Scroll and Theater are 82% of the corpus
// between them. Equal arcs give a density ratio of 1,382:1 and leave three
// consecutive 40° sectors holding 35 rays between them — a third of the
// circumference reading as a gap. Proportional arcs give uniform density and
// squeeze Butterfly, whose entire published text is its own placard title, into
// 0.1°, which is invisible. The square root compresses the range to 37:1: every
// scene is visible at 2.9° or wider, and Scroll and Theater still take 208°
// between them, so the lopsidedness is legible as density rather than erased.
//
// **Petal length ∝ √words, clamped at the 99th percentile.** Sentence length
// runs from 1 word to 358 (median 7, p95 31, p99 52). Linear length would make
// one ray twenty times the flower's radius; √ compresses it to a readable
// spread and the clamp puts the longest 1% — 32 of 3,221 — at the rim
// together. That is a real loss of information at the top end, and it is the
// price of the object still being a flower.
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

// The order bands appear in going around the axis is the registry's own order,
// so the flower reads in the same sequence as the nav rather than in a second
// order nobody can check. Scenes the corpus reader returns nothing for are not
// here — see `CORPUS_SOURCES` for why harmonics and outside are absent, which
// is a fact about them and not an omission.
const BAND_ORDER = ['sphere', 'butterfly', 'scroll', 'theater', 'orbiter', 'orrery', 'library', 'beamline', 'apollo'];

const LABELS = {
  sphere: 'The Sphere', butterfly: 'Chaos Butterfly', scroll: 'Selected Works',
  theater: 'The Theater', orbiter: 'Orbiter', orrery: 'The Orrery of Los Feliz',
  library: 'The Library', beamline: 'Beamline', apollo: 'Apollo',
};

// The flower is white. These are tints, not colours — the passage says white
// fibre-optic, and nine saturated sectors would be a pie chart wearing a
// flower. Saturation stays under 0.2 so a band is something you notice on
// looking rather than the first thing you see, and hue walks the wheel by the
// golden angle so no two adjacent bands land near each other.
const BAND_SAT = 0.17;
const BAND_LIGHT = 0.93;

const raw = readCorpus(MODULES);
const byKey = Object.fromEntries(raw.map(c => [c.key, c.sentences]));

// ─── Bands ──────────────────────────────────────────────────────────────────
const present = BAND_ORDER.filter(k => (byKey[k]?.length ?? 0) > 0);
const roots = present.map(k => Math.sqrt(byKey[k].length));
const rootSum = roots.reduce((a, b) => a + b, 0);

let cursor = 0;
export const BANDS = present.map((key, i) => {
  const count = byKey[key].length;
  const arcDeg = 360 * roots[i] / rootSum;
  const band = {
    key,
    label: LABELS[key] ?? key,
    count,
    words: byKey[key].reduce((a, s) => a + wordCount(s), 0),
    startDeg: cursor,
    arcDeg,
    hue: (i * 137.507) % 360,
    sat: BAND_SAT,
    light: BAND_LIGHT,
  };
  cursor += arcDeg;
  return band;
});

// ─── Petals ─────────────────────────────────────────────────────────────────
// Typed arrays because the propagation writes one float per petal per frame and
// the instance buffer reads them straight back out. `TEXTS` is the parallel
// array of the sentences themselves — the flower is made of them, and touching
// a petal has to be able to say which one it touched.
export const TEXTS = [];
const bandIndex = [];
const angleDeg = [];
const words = [];
const orderInBand = [];

for (let b = 0; b < BANDS.length; b++) {
  const band = BANDS[b];
  const list = byKey[band.key];
  for (let i = 0; i < list.length; i++) {
    // Petal i sits at i/(n) of the way through its band's arc. Dividing by n
    // rather than n-1 leaves one petal's worth of gap before the next band
    // begins, which is what keeps two bands from sharing an edge ray — and it
    // is defined for a band of one, which Butterfly is.
    angleDeg.push(band.startDeg + band.arcDeg * (i / list.length));
    bandIndex.push(b);
    orderInBand.push(i);
    words.push(wordCount(list[i]));
    TEXTS.push(list[i]);
  }
}

export const PETAL_COUNT = TEXTS.length;

// The corpus total, stated so the /text/ page and any brief quoting it are
// reading the same number this scene drew.
export const CORPUS_WORDS = words.reduce((a, b) => a + b, 0);

// Percentile clamp for the length map, computed rather than typed — a constant
// here would be a number that silently stops matching the corpus the first time
// anything is written.
const sortedWords = [...words].sort((a, b) => a - b);
export const WORDS_MEDIAN = sortedWords[Math.floor(sortedWords.length * 0.5)];
export const WORDS_CLAMP = sortedWords[Math.floor(sortedWords.length * 0.99)];
export const WORDS_MAX = sortedWords[sortedWords.length - 1];
export const CLAMPED_PETALS = words.filter(w => w > WORDS_CLAMP).length;

// 0..1, the fraction of the flower's outer reach this petal takes.
const rootMin = 1;                      // √1 word
const rootMax = Math.sqrt(WORDS_CLAMP);
export const PETAL_MIN_FRACTION = 0.36; // a one-word sentence is still a ray
function lengthFraction(w) {
  const r = Math.sqrt(Math.min(w, WORDS_CLAMP));
  const t = (r - rootMin) / Math.max(1e-6, rootMax - rootMin);
  return PETAL_MIN_FRACTION + (1 - PETAL_MIN_FRACTION) * Math.max(0, Math.min(1, t));
}

export const PETALS = {
  band: Uint8Array.from(bandIndex),
  angle: Float32Array.from(angleDeg, d => d * Math.PI / 180),
  length: Float32Array.from(words, lengthFraction),
  words: Uint16Array.from(words),
  orderInBand: Uint16Array.from(orderInBand),
};

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

// ─── The one assertion this file makes about itself ─────────────────────────
// Petal count must equal sentence count exactly. An off-by-one here is
// invisible and permanent: the flower would still look like a flower, the
// /text/ page would still print a number, and one sentence would be missing
// from the site's portrait of itself forever. Thrown at import time, so the
// build fails rather than the scene.
{
  const summed = BANDS.reduce((a, b) => a + b.count, 0);
  if (summed !== PETAL_COUNT || TEXTS.length !== PETAL_COUNT ||
      PETALS.angle.length !== PETAL_COUNT || PETALS.length.length !== PETAL_COUNT ||
      PETALS.band.length !== PETAL_COUNT) {
    throw new Error(
      `psyshell: petal count disagrees with sentence count — bands sum to ${summed}, ` +
      `texts ${TEXTS.length}, angles ${PETALS.angle.length}, lengths ${PETALS.length.length}, ` +
      `bands ${PETALS.band.length}`);
  }
  if (BANDS.length && Math.abs((BANDS.at(-1).startDeg + BANDS.at(-1).arcDeg) - 360) > 1e-6) {
    throw new Error(`psyshell: band arcs sum to ${BANDS.at(-1).startDeg + BANDS.at(-1).arcDeg}°, not 360°`);
  }
}
