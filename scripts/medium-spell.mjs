// ─── medium: what the board actually spells ─────────────────────────────────
// Run with `node scripts/medium-spell.mjs`. Not part of the build — the bench
// for the one claim the scene cannot make in a comment: that a hand with no
// destination, plus a bias that only affects how long a letter takes to land,
// produces a tape that reads like English rather than like a keyboard smash.
//
// Nothing in here is the scene. It is the physics, the lexicon, a plausible
// board geometry and a visitor who does what visitors do — and the output is
// the honest answer to "so what does it say?".
import {
  DWELL_EASE, DWELL_RESIST,
  createCup, stepCup, createWander, stepWander,
  createDwell, stepDwell, clearDwellMemory,
} from '../src/scenes/medium/medium.physics.js';
import { letterWeights, createContext, advance, isWord, lexiconSize } from '../src/scenes/medium/medium.lexicon.js';

const DT = 1 / 60;

// How sharply plausibility is felt. letterWeights returns a max-normalised row,
// and most letters sit far below the maximum on any given prefix — so a linear
// read would put nearly everything at DWELL_RESIST and the board would only
// ever take the single likeliest letter. The exponent lifts the middle of the
// row: at 0.5 a letter with a hundredth of the leader's weight still comes out
// a tenth of the way from resist to ease.
const GAMMA = 0.5;

// A plausible homemade board: two arcs of letters, digits under them.
const LETTERS = (() => {
  const out = [];
  const A = 'ABCDEFGHIJKLM', B = 'NOPQRSTUVWXYZ';
  A.split('').forEach((ch, i) => {
    const t = (i / (A.length - 1) - 0.5) * 1.55;
    out.push({ ch, x: 0.5 + Math.sin(t) * 0.36, y: 0.30 + (1 - Math.cos(t)) * 0.20 });
  });
  B.split('').forEach((ch, i) => {
    const t = (i / (B.length - 1) - 0.5) * 1.42;
    out.push({ ch, x: 0.5 + Math.sin(t) * 0.30, y: 0.47 + (1 - Math.cos(t)) * 0.16 });
  });
  '0123456789'.split('').forEach((ch, i) => {
    out.push({ ch, x: 0.5 + (i / 9 - 0.5) * 0.52, y: 0.70 });
  });
  return out;
})();

// ─── A session ──────────────────────────────────────────────────────────────
// `visitor(t, cup)` returns the visitor's fingertip, or null if they are not
// touching. Everything else is the scene as it will ship.
function session({ seconds = 120, seed = 0x5EA9CE, visitor, gamma = GAMMA }) {
  const cup = createCup(0.5, 0.44);
  const hand = createWander(seed, 0.5, 0.44);
  const dwell = createDwell();
  const ctx = createContext();
  let bias = letterWeights(ctx.live);
  // Digits are outside the model — no English word continues into a 7 — so they
  // get a flat plausibility rather than a computed one. Low, because a board
  // that drops numbers into the middle of words is noise.
  const plaus = (l) => {
    const c = l.ch.charCodeAt(0) - 65;
    return (c < 0 || c > 25) ? 0.06 : Math.pow(bias[c], gamma);
  };
  const scale = (l) => DWELL_RESIST + (DWELL_EASE - DWELL_RESIST) * plaus(l);

  let t = 0, taken = 0;
  const marks = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    t += DT;
    const p = stepWander(hand, DT, LETTERS, plaus);
    stepCup(cup, DT, visitor(t, cup), p);
    clearDwellMemory(dwell, cup);
    const got = stepDwell(dwell, cup, LETTERS, DT, scale);
    if (got) {
      advance(ctx, got.ch);
      bias = letterWeights(ctx.live);
      taken++;
      if (isWord(ctx.live) && ctx.live.length >= 3) marks.push(ctx.live);
    }
  }
  return { text: ctx.text, rate: taken / seconds, words: marks };
}

// The visitor most people are: touching, not driving. A slow aimless circle of
// about two centimetres on a thirty-centimetre board, which is what a hand
// resting on a cup does whether or not its owner thinks it is doing anything.
const resting = (t, cup) => ({
  x: cup.x + Math.sin(t * 0.9) * 0.02,
  y: cup.y + Math.cos(t * 0.7) * 0.02,
});

const show = (s) => s.replace(/(.{60})/g, '$1\n           ');

console.log(`lexicon  ${lexiconSize().toLocaleString()} words\n`);

for (const seed of [0x5EA9CE, 7, 1031, 66613]) {
  const r = session({ seconds: 180, seed, visitor: resting });
  console.log(`seed ${String(seed).padStart(6)}  ${r.rate.toFixed(2)} letters/s`);
  console.log(`           ${show(r.text)}`);
  console.log(`           words passed through: ${r.words.slice(-14).join(' ') || '(none)'}\n`);
}

// ─── The control: does the bias do anything at all? ─────────────────────────
// Same seed, same hand, same everything — with plausibility switched off by
// flattening the exponent to zero, which sends every letter to DWELL_EASE. If
// this reads the same as the run above, the lexicon is decoration.
{
  const vowels = (s) => (s.match(/[AEIOU]/g) || []).length / (s.length || 1);
  // Ten seeds, not one. A single 180-second tape is thirty letters long and its
  // vowel share swings by fifteen points from seed to seed — reporting one of
  // them as the result was the first version of this and it was noise.
  const seeds = [7, 1031, 66613, 5, 99, 404, 8123, 31337, 2, 555];
  const mean = (f) => seeds.reduce((a, s) => a + f(s), 0) / seeds.length;
  const on = seeds.map(seed => session({ seconds: 300, seed, visitor: resting }));
  const off = seeds.map(seed => session({ seconds: 300, seed, visitor: resting, gamma: 0 }));
  console.log('control  same hands, same seeds, plausibility off:');
  console.log(`           ${show(off[0].text)}`);
  const avg = (rs, f) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
  console.log(`\n         over ${seeds.length} seeds x 300s`);
  console.log(`         letters/s    on ${avg(on, r => r.rate).toFixed(3)}   off ${avg(off, r => r.rate).toFixed(3)}`);
  console.log(`         vowel share  on ${(100 * avg(on, r => vowels(r.text))).toFixed(1)}%  off ${(100 * avg(off, r => vowels(r.text))).toFixed(1)}%   (English is 38.1%)`);
}
