// ─── Psyshell — what the lens holds ─────────────────────────────────────────
// Lens RE73415, recovered from the lower pools. It holds 3,244 filapixels: one
// for every sentence of this site's writing.
//
// NO DOM AND NO THREE.JS IN THIS FILE. `scripts/prerender.js` imports it to
// build `/text/psyshell/` from the same numbers the scene reads.
//
// ─── What changed at 4.8.0, and why it is a subtraction ─────────────────────
// This file used to compute a geometry. v4.6.0 made the corpus a chrysanthemum
// and v4.7.0 made it a branch, and both were forms that *encoded* the writing:
// angle was reading order, length was sentence length, thickness was Murray's
// law, branch angles were the golden angle. Every one of those was derived, and
// none of them was a reason. **They were rigour supplied where a subject was
// needed** — Scott's own naming of the error, and it is the right one.
//
// A lens does not encode what it holds. It holds it. So the geometry left this
// file entirely and lives in `psyshell.object.js`, which builds an object out
// of the manuscript's own description and knows nothing about the corpus.
//
// **The filapixels' positions on the object encode nothing.** Not sentence
// order, not length, not source scene. They are assigned by a seeded shuffle,
// which is deterministic — the same lens every visit, because it is a specific
// lens — and carries no information. **Do not re-introduce a mapping.** It has
// been tried twice; both times it produced a diagram rather than an object, and
// both times the geometry problems that followed were the mapping's fault.
//
// What survives, and should: the count, the sentences themselves, which scene
// each came from (for the screen reader and the jump list), and the base-e
// notation at the bottom of this file.
import { readCorpus, flatSentences, wordCount } from '../../utils/corpus.js';
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

const ORDER = ['sphere', 'butterfly', 'scroll', 'theater', 'orbiter', 'orrery', 'library', 'beamline', 'apollo'];
const LABELS = {
  sphere: 'The Sphere', butterfly: 'Chaos Butterfly', scroll: 'Selected Works',
  theater: 'The Theater', orbiter: 'Orbiter', orrery: 'The Orrery of Los Feliz',
  library: 'The Library', beamline: 'Beamline', apollo: 'Apollo',
};

const corpus = readCorpus(MODULES);
const byKey = Object.fromEntries(flatSentences(corpus).map(c => [c.key, c.sentences]));
const piecesOf = Object.fromEntries(corpus.map(c => [c.key, c.pieces.length]));
const present = ORDER.filter(k => (byKey[k]?.length ?? 0) > 0);

// The sentences, in reading order across the whole corpus. The ORDER is still
// the registry's, so the ordinal a filapixel reports is the same number the
// /text/ page could count to — but nothing about where it sits on the object
// follows from it.
//
// The piece level survives here as a COUNT and nothing more. It was the middle
// rank the branch was built on — a limb's pieces were its branches — and with
// the mapping gone it divides nothing in the geometry. It is still a true fact
// about the corpus and the /text/ page still reports it; it is simply no longer
// load-bearing, which is worth saying so that a later session does not go
// looking for the structure it used to imply.
export const TEXTS = [];
const sourceOf = [];
export const SOURCES = [];
for (const key of present) {
  const list = byKey[key];
  SOURCES.push({
    key, label: LABELS[key] ?? key, count: list.length, first: TEXTS.length,
    pieces: piecesOf[key] ?? 0,
    words: list.reduce((a, t) => a + wordCount(t), 0),
  });
  for (const t of list) { TEXTS.push(t); sourceOf.push(SOURCES.length - 1); }
}
export const SOURCE_OF = Uint8Array.from(sourceOf);
export const FILAPIXEL_COUNT = TEXTS.length;
export const PIECE_COUNT = SOURCES.reduce((a, s) => a + s.pieces, 0);
export const CORPUS_WORDS = SOURCES.reduce((a, s) => a + s.words, 0);

// Three scenes are absent and it is a fact about them rather than an omission:
// Harmonics publishes no writing of its own, Outside publishes five
// power-source names and two origin labels, none of which are sentences, and
// Medium publishes nothing FIXED at all — the letters on its tape are produced
// while you watch, differently every time, so there is no sentence of the
// site's for the crystal to hold. It has a /text/ page all the same, and that
// page is a transcript rather than writing: one séance, run at build time.
export const ABSENT = ['harmonics', 'medium', 'outside'];

// ─── The assertion this file makes about itself ─────────────────────────────
// Thrown at import time, so the build fails rather than the scene. An
// off-by-one here is invisible and permanent, and it is *more* important now
// than when position encoded something: nothing else about the object would
// look wrong if a sentence went missing.
{
  const summed = SOURCES.reduce((a, s) => a + s.count, 0);
  if (summed !== FILAPIXEL_COUNT || SOURCE_OF.length !== FILAPIXEL_COUNT) {
    throw new Error(`psyshell: filapixel count disagrees with sentence count — sources sum to ${summed}, texts ${FILAPIXEL_COUNT}, sources ${SOURCE_OF.length}`);
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

