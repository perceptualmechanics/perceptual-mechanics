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

// Exposed for the bench, so `scripts/medium-spell.mjs` can report the size of
// the thing it is sampling from without reaching into module internals.
export function lexiconSize() { ensure(); return words.length; }
