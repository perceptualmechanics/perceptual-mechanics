// ─── Medium — how plausible the next letter is ──────────────────────────────
// NO DOM, NO RENDERING, NO PHYSICS. Given what the board has spelled so far,
// this says how strongly each of the twenty-six letters wants to be next. It is
// the only thing in the scene that knows English.
//
// ─── Why this exists ────────────────────────────────────────────────────────
// The ideomotor account (Carpenter 1852; Faraday 1853; Gauchou, Rensink & Fels
// 2012) is that nobody is choosing the letters and yet words come out. The
// reason words come out is that a person who has just watched the cup take
// T, H, E is *primed*, below the level of decision, for letters that continue
// something spellable. They do not aim at the E. They just find it slightly
// harder to leave.
//
// This module is consulted in exactly two places, and it is worth being precise
// about them because the difference between this scene and a puppet show is
// entirely in what it is NOT asked:
//
//   1. `stepWander` asks how plausible each letter on the board is, all
//      twenty-six at once, and leans the partner's hand into the weighted sum.
//      It never asks which letter is best and is never told one.
//   2. `stepDwell` asks how plausible the letter under the cup is, and takes
//      longer over an implausible one — 2.2 seconds against 0.28.
//
// Neither call names a next letter, and nothing in the scene stores a word.
// The bias in the second is bounded at both ends on purpose: a visitor who
// parks the cup on Q and holds it there gets a Q. The board can be slow to
// agree; it can never refuse.
//
// This is a predictive-text model, and saying so is the point rather than an
// embarrassment: phone keyboards and half-conscious hands are running the same
// process, one in a language model and one in a nervous system. The scene is
// the collision of the two.
//
// ─── Why a shallow list, and why not the site's own words ───────────────────
// The lexicon is the ten thousand commonest English words, not a dictionary.
// That is modelling rather than economising: the words a person is primed for
// are exactly the frequent ones, and a full 264k dictionary (360KB gzipped)
// would make ZYGOTE as reachable as THE. Rarity is the signal.
//
// It is plain English, not this site's prose, and that was measured rather than
// assumed. The site's own text is statistically ordinary English — its letter
// distribution matches published frequencies at Spearman 0.989, mean absolute
// error 0.26 percentage points — so seeding the board with the site would have
// changed nothing about the output while making the board a ventriloquist for
// the page it sits on. The board is not a mouthpiece. It spells English.

import { BODY, RANKS } from './medium.words.js';

// ─── Damping the top of the frequency curve ─────────────────────────────────
// Zipf weight is rank^-ZIPF. At 1.0 the true Zipf slope, the top hundred words
// swamp everything and the board reads like phone autocomplete — which is the
// one failure mode that would make this feel familiar rather than uncanny.
// Everybody has a phone; nobody has been haunted. Lowering the exponent
// flattens the curve so the hand reaches further down the list: at 0.55 the
// commonest word is 148x the weight of the ten-thousandth rather than 10,000x.
// Tuned by reading `node scripts/medium-spell.mjs` output, not by argument.
const ZIPF = 0.55;

// Every letter stays possible. This is the floor added to each of the twenty-
// six weights, as a fraction of the row's total, so the dwell scale is finite
// even for a letter no English word wants — the visitor can always spell
// nonsense by holding the cup still, and must be able to.
const FLOOR = 0.02;

// The longest context the board carries. Longer prefixes are more confident
// and more boring; this is also the ceiling on the backoff walk below.
const MAX_CONTEXT = 12;

const A = 97;

let words = null;      // the lexicon, sorted, decoded once on first use
let weight = null;     // Float64Array, parallel: Zipf weight of each word

function ensure() {
  if (words) return;
  // Front-coded: one delimiter char (shared-prefix length + 48) then the tail.
  // Tails are lowercase only, so the next non-letter starts the next entry.
  const body = BODY.replace(/\n/g, '');
  const ranks = RANKS.replace(/\n/g, '');
  words = new Array(ranks.length);
  weight = new Float64Array(ranks.length);
  // The rank bucket is round(log2(rank) * 1.5), so rank ~ 2^(b/1.5) and the
  // weight is a pure function of the bucket. Twenty-one of them; precompute.
  const byBucket = new Float64Array(64);
  for (let b = 0; b < 64; b++) byBucket[b] = Math.pow(Math.pow(2, b / 1.5), -ZIPF);
  let prev = '', n = 0;
  for (let i = 0; i < body.length;) {
    const k = body.charCodeAt(i++) - 48;
    let j = i;
    while (j < body.length && body.charCodeAt(j) >= A) j++;
    const w = prev.slice(0, k) + body.slice(i, j);
    words[n] = w;
    weight[n] = byBucket[ranks.charCodeAt(n) - 48];
    n++; prev = w; i = j;
  }
}

// First index whose word is >= p. Plain lower bound on a sorted array.
function lower(p) {
  let lo = 0, hi = words.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (words[m] < p) lo = m + 1; else hi = m; }
  return lo;
}

// The [lo, hi) span of words beginning with `p`. The upper end is the lower
// bound of the prefix with its last character bumped by one — which is why
// the lexicon is restricted to a-z: 'z' + 1 is '{', and it sorts after every
// tail this list can contain.
function span(p) {
  if (!p) return [0, words.length];
  const lo = lower(p);
  const hi = lower(p.slice(0, -1) + String.fromCharCode(p.charCodeAt(p.length - 1) + 1));
  return [lo, hi];
}

// ─── The one thing this module is for ───────────────────────────────────────
// Returns a Float32Array(26), scaled so the likeliest next letter is exactly 1
// and every other letter is its share of that. `context` is the live prefix
// from `advance` below, lowercase.
export function letterWeights(context) {
  ensure();
  const out = new Float32Array(26);
  const [lo, hi] = span(context);
  const n = context.length;
  let total = 0;
  for (let i = lo; i < hi; i++) {
    const w = words[i];
    if (w.length <= n) continue;             // the context is itself this word
    const c = w.charCodeAt(n) - A;
    out[c] += weight[i]; total += weight[i];
  }
  if (total <= 0) { out.fill(1); return out; }
  const floor = (total * FLOOR) / 26;
  let max = 0;
  for (let c = 0; c < 26; c++) { out[c] += floor; if (out[c] > max) max = out[c]; }
  for (let c = 0; c < 26; c++) out[c] /= max;
  return out;
}

// ─── Carrying the context ───────────────────────────────────────────────────
// A Ouija board does not have a space bar, and no real transcript arrives
// pre-divided into words — the sitters do that afterwards, and arguing about
// where the breaks go is half of what the sitters do. So this never decides
// that a word has ended. It keeps the LONGEST SUFFIX of what has been spelled
// that still has English continuing out of it, and drops a character off the
// front when it runs dry.
//
// The output is therefore a continuous stream that is word-like everywhere and
// a word almost nowhere: spell HELLO and the live context falls back to LO, so
// the next letters continue LOCAL or LONG, and the tape reads HELLOCAL. That
// is not a defect being tolerated. It is what Ouija transcripts actually look
// like, and it is the reason people can read them.
export function createContext() {
  return { text: '', live: '' };
}

export function advance(ctx, ch) {
  ensure();
  const c = ch.toLowerCase();
  if (c < 'a' || c > 'z') { ctx.text += ch; ctx.live = ''; return ctx.live; }
  ctx.text += ch;
  let p = (ctx.live + c).slice(-MAX_CONTEXT);
  // Walk down from the longest suffix to the shortest, stopping at the first
  // one English can continue. The empty prefix always can, so this terminates.
  while (p) {
    const [lo, hi] = span(p);
    let live = false;
    for (let i = lo; i < hi; i++) if (words[i].length > p.length) { live = true; break; }
    if (live) break;
    p = p.slice(1);
  }
  ctx.live = p;
  return p;
}

// True if the live context is itself a whole word — used by the scene only to
// decide when to let a word settle visibly on the tape, never to steer.
export function isWord(context) {
  ensure();
  if (!context) return false;
  const i = lower(context);
  return i < words.length && words[i] === context;
}

// ─── The reader ─────────────────────────────────────────────────────────────
// One object that carries everything the board's plausibility depends on, so
// the scene and the build cannot compute it differently. `medium.js` holds one
// and `scripts/prerender.js` holds another, and both go through `weightOf`.
//
// Two things live in here that `letterWeights` alone does not have:
//
// **The marks that are not letters.** English has nothing to say about a 7 — no
// word continues into one — so digits and the three words get a flat weight
// rather than a computed one, low enough that a board dropping numbers into the
// middle of a word stays the exception. GOODBYE is lower again: it sits outside
// the other hand's reach anyway, and this makes sure a visitor merely drifting
// past it does not trip it.
//
// **Fatigue.** A mark just taken is less plausible for a while, decaying with a
// thirty-second half-life. This is not a knob bolted on to make the output look
// nicer — it was added because the output was measurably worse without it, and
// the half-life was chosen the same way.
//
// The failure it fixes: the field pulls the hand toward a region, the region has
// a few letters in it, and the board loops. Without fatigue, three séances on
// three unrelated seeds all produced TSUNAMIBIAS. The ruler is the share of
// six-letter runs that a séance has already produced once, over two and a half
// hours of simulated sitting on twelve seeds:
//
//     half-life    repeated 6-grams    Spearman vs English    vowels
//        (none)              —                  —               —
//         6 s             14.4%              0.782            37.3%
//        15 s             12.5%              0.799            36.7%
//        30 s              5.9%              0.774            36.1%
//
// Repetition more than halves and nothing else moves, so 30. It is also the true
// thing to model: a hand does not reach twice for what it just reached for, and
// a basin of attraction that nothing tires of is a property of a simulation
// rather than of a séance.
const FATIGUE_DEPTH = 0.6;
const FATIGUE_HALFLIFE = 30;
const FATIGUE_FLOOR = 0.02;

// How sharply the plausibility curve is felt. `letterWeights` returns a row
// scaled so the likeliest letter is 1, and on any given prefix most of the
// other twenty-five sit far below that — so reading the row linearly would push
// nearly everything to full resistance and the board would only ever take the
// single best letter, which is a typewriter rather than a board. The exponent
// lifts the middle: at 0.5 a letter with a hundredth of the leader's weight
// still lands a tenth of the way from resist toward ease.
const GAMMA = 0.5;
const FLAT = { digit: 0.06, word: 0.04, goodbye: 0.02 };

// ─── Punctuation is the one mark that looks BACKWARD ────────────────────────
// Every letter is weighted by what could come next. A full stop is weighted by
// whether what has already been spelled is finished — which is the same model
// asked a different question, and is exactly what a phone keyboard is doing
// when it offers you a period. So a punctuation mark carries its own relative
// weight (roughly how often English uses it) and that weight is worth having
// only when the live context is itself a whole word; the rest of the time it is
// PUNCT_COLD, which is low but never zero, because a visitor who parks the cup
// on a comma has to get a comma.
//
// This does not make the board decide where the words are — the letters still
// never do, and the tape is still something the reader divides. It makes the
// board able to guess, at about the rate English guesses, and be wrong.
const PUNCT_WARM = 0.62;
const PUNCT_COLD = 0.03;

export function createReader() {
  return { ctx: createContext(), row: letterWeights(''), tired: new Map() };
}

// Call once a frame, before `weightOf`.
export function decayReader(r, dt) {
  if (!r.tired.size) return;
  const k = Math.pow(0.5, dt / FATIGUE_HALFLIFE);
  for (const [ch, v] of r.tired) {
    const next = v * k;
    if (next < FATIGUE_FLOOR) r.tired.delete(ch); else r.tired.set(ch, next);
  }
}

// `mark` is one of medium.text.js's MARKS: { ch, kind }. Returns 0..1.
export function weightOf(r, mark) {
  let w;
  if (mark.kind === 'letter') {
    w = Math.pow(r.row[mark.ch.charCodeAt(0) - 65], GAMMA);
  } else if (mark.kind === 'punct') {
    w = (mark.w ?? 0.5) * (isWord(r.ctx.live) && r.ctx.live.length >= 2 ? PUNCT_WARM : PUNCT_COLD);
  } else {
    w = mark.ch === 'GOODBYE' ? FLAT.goodbye : FLAT[mark.kind] ?? 0.05;
  }
  const t = r.tired.get(mark.ch);
  if (t) w *= 1 - FATIGUE_DEPTH * t;
  // Never zero. The dwell scale this feeds is bounded at both ends so that a
  // visitor who parks the cup on Q gets a Q, and a zero here would quietly
  // undo that promise from the other side.
  return Math.max(0.002, w);
}

// Call when a mark is taken. Returns the text the board now shows, which for
// GOODBYE is empty: taking it clears the tape. It is not an ending — nothing
// stops — it is the one mark that wipes the slate.
export function takeMark(r, mark) {
  r.tired.set(mark.ch, 1);
  if (mark.ch === 'GOODBYE') { r.ctx = createContext(); r.row = letterWeights(''); return ''; }
  if (mark.kind === 'letter') { advance(r.ctx, mark.ch); r.row = letterWeights(r.ctx.live); return mark.ch; }
  // A digit, a punctuation mark or YES/NO is not English and the context must
  // not try to continue one, so the run of letters ends here the way it would
  // for a sitter. Punctuation takes a space after it and none before, which is
  // the one typographic convention the tape observes.
  r.ctx = createContext();
  r.row = letterWeights('');
  if (mark.kind === 'punct') return `${mark.ch} `;
  return mark.kind === 'digit' ? mark.ch : ` ${mark.ch} `;
}

// True while the live context is itself a whole word — the scene uses it for
// nothing and the build's transcript page uses it to mark where words fell.
export function readerHasWord(r) { return isWord(r.ctx.live) && r.ctx.live.length >= 3; }
// True when a full stop would be plausible: the live context is a whole word.
export function readerAtWordEnd(r) { return isWord(r.ctx.live) && r.ctx.live.length >= 2; }
export function readerWord(r) { return r.ctx.live; }

// Exposed for the benches, so `scripts/medium-spell.mjs` can report the size of
// the thing it is sampling from without reaching into module internals.
export function lexiconSize() { ensure(); return words.length; }
