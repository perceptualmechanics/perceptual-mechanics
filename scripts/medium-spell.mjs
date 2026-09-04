// ─── medium: what the board actually spells ─────────────────────────────────
// Run with `node scripts/medium-spell.mjs`. Not part of the build — the bench
// for the one claim the scene cannot make in a comment: that a hand with no
// destination produces a tape that reads like English rather than like a
// keyboard smash.
//
// Nothing in here is a copy of the scene. It is the real physics, the real
// lexicon and the real board — `medium.text.js`'s MARKS, the same array
// `medium.js` draws — with a visitor stubbed in. An earlier version of this
// file kept its own copy of the letter arcs, which meant the thing being
// measured was not quite the thing that shipped.
import {
  DWELL_EASE, DWELL_RESIST,
  createCup, stepCup, createWander, stepWander,
  createDwell, stepDwell, clearDwellMemory,
} from '../src/scenes/medium/medium.physics.js';
import {
  createReader, decayReader, weightOf, takeMark, readerHasWord, readerWord, lexiconSize,
} from '../src/scenes/medium/medium.lexicon.js';
import { MARKS, BOARD_HOME } from '../src/scenes/medium/medium.text.js';

const DT = 1 / 60;

// ─── A session ──────────────────────────────────────────────────────────────
// `visitor(t, cup)` returns the visitor's fingertip, or null if they are not
// touching. `flat` is the control: it sends every mark to the same weight, so
// the field becomes a uniform pull and the dwell threshold becomes a constant.
// Everything else is the scene as it ships.
function session({ seconds = 300, seed, visitor = null, flat = false }) {
  const hand = createWander(seed, BOARD_HOME.x, BOARD_HOME.y);
  const cup = createCup(hand.x, hand.y);
  const dwell = createDwell();
  const reader = createReader();
  const plaus = flat ? () => 1 : (m) => weightOf(reader, m);
  const scale = (m) => DWELL_RESIST + (DWELL_EASE - DWELL_RESIST) * plaus(m);

  let t = 0, taken = 0, tape = '';
  const words = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    t += DT;
    decayReader(reader, DT);
    stepCup(cup, DT, visitor ? visitor(t, cup) : null, stepWander(hand, DT, MARKS, plaus));
    clearDwellMemory(dwell, cup);
    const got = stepDwell(dwell, cup, MARKS, DT, scale);
    if (got) {
      const added = takeMark(reader, got);
      tape = got.ch === 'GOODBYE' ? '' : tape + added;
      taken++;
      if (readerHasWord(reader)) words.push(readerWord(reader));
    }
  }
  return { tape, rate: taken / seconds, words };
}

// The visitor most people are: touching, not driving. A slow aimless circle of
// about two centimetres on a thirty-centimetre board, which is what a hand
// resting on a cup does whether or not its owner thinks it is doing anything.
const resting = (t, cup) => ({
  x: cup.x + Math.sin(t * 0.9) * 0.02,
  y: cup.y + Math.cos(t * 0.7) * 0.02,
});

const show = (s) => s.replace(/(.{58})/g, '$1\n           ');
// Letters only. The tape also carries digits, punctuation and the spaces after
// it, and counting those in the denominator quietly moved the number two points
// the day punctuation was added — a ruler that changes when the thing being
// measured gains a new part is not a ruler.
const vowels = (s) => {
  const letters = s.replace(/[^A-Z]/g, '');
  return (letters.match(/[AEIOU]/g) || []).length / (letters.length || 1);
};

console.log(`lexicon  ${lexiconSize().toLocaleString()} words\n`);

for (const seed of [611853, 7, 1031, 66613]) {
  const alone = session({ seconds: 240, seed });
  const held = session({ seconds: 240, seed, visitor: resting });
  console.log(`seed ${String(seed).padStart(6)}  nobody touching, ${alone.rate.toFixed(2)} letters/s`);
  console.log(`           ${show(alone.tape)}`);
  console.log(`           a hand resting on it, ${held.rate.toFixed(2)} letters/s`);
  console.log(`           ${show(held.tape)}`);
  console.log(`           words it passed through: ${held.words.slice(-12).join(' ') || '(none)'}\n`);
}

// ─── The control ────────────────────────────────────────────────────────────
// Same hands, same seeds, plausibility flattened — the field becomes a uniform
// pull toward the middle of the letters and every mark costs the same dwell. If
// this reads like the runs above, the lexicon is decoration.
{
  // Ten seeds, not one. A single four-minute tape is forty letters long and its
  // vowel share swings by fifteen points from seed to seed; reporting one of
  // them as the result was the first version of this and it was noise.
  const seeds = [7, 1031, 66613, 5, 99, 404, 8123, 31337, 2, 555];
  const on = seeds.map(seed => session({ seed, visitor: resting }));
  const off = seeds.map(seed => session({ seed, visitor: resting, flat: true }));
  const avg = (rs, f) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
  console.log('control  same hands, same seeds, plausibility flat:');
  console.log(`           ${show(off[0].tape.slice(0, 116))}`);
  console.log(`\n         over ${seeds.length} seeds x 300s`);
  console.log(`         letters/s    on ${avg(on, r => r.rate).toFixed(3)}   off ${avg(off, r => r.rate).toFixed(3)}`);
  console.log(`         vowel share  on ${(100 * avg(on, r => vowels(r.tape))).toFixed(1)}%  off ${(100 * avg(off, r => vowels(r.tape))).toFixed(1)}%   (English is 38.1%)`);
}
