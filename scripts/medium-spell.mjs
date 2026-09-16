import {
  DWELL_EASE, DWELL_RESIST,
  createCup, stepCup, createWander, stepWander,
  createVisitor, stepVisitor,
  createDwell, stepDwell, clearDwellMemory,
} from '../src/scenes/medium/medium.physics.js';
import {
  createReader, decayReader, weightOf, takeMark, readerHasWord, readerWord, lexiconSize,
} from '../src/scenes/medium/medium.lexicon.js';
import { MARKS, BOARD_HOME, LETTER_ARCS, DIGITS, PUNCTUATION, WORDS, MARK_GAP } from '../src/scenes/medium/medium.text.js';

const DT = 1 / 60;

function session({ seconds = 300, seed, touching = false, flat = false, marks = MARKS, home = BOARD_HOME }) {
  const hand = createWander(seed, home.x, home.y);
  const cup = createCup(hand.x, hand.y);
  const visitor = createVisitor(cup.x, cup.y);
  visitor.down = touching;
  const dwell = createDwell();
  const reader = createReader();
  const plaus = flat ? () => 1 : (m) => weightOf(reader, m);
  const scale = (m) => DWELL_RESIST + (DWELL_EASE - DWELL_RESIST) * plaus(m);

  let t = 0, taken = 0, tape = '';
  const words = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    t += DT;
    decayReader(reader, DT);
    stepCup(cup, DT, stepVisitor(visitor, cup, DT), touching ? stepWander(hand, DT, cup, marks, plaus, visitor.grip) : null);
    clearDwellMemory(dwell, cup);
    const got = touching ? stepDwell(dwell, cup, marks, DT, scale) : null;
    if (got) {
      const added = takeMark(reader, got);
      tape = got.ch === 'GOODBYE' ? '' : tape + added;
      taken++;
      if (readerHasWord(reader)) words.push(readerWord(reader));
    }
  }
  return { tape, rate: taken / seconds, words };
}

const show = (s) => s.replace(/(.{58})/g, '$1\n           ');
const vowels = (s) => {
  const letters = s.replace(/[^A-Z]/g, '');
  return (letters.match(/[AEIOU]/g) || []).length / (letters.length || 1);
};

console.log(`lexicon  ${lexiconSize().toLocaleString()} words\n`);

for (const seed of [611853, 7, 1031, 66613]) {
  const alone = session({ seconds: 240, seed });
  const held = session({ seconds: 240, seed, touching: true });
  console.log(`seed ${String(seed).padStart(6)}  nobody touching: "${alone.tape}" (${alone.rate.toFixed(2)}/s) — must be empty`);
  console.log(`           a hand resting on it, ${held.rate.toFixed(2)} marks/s`);
  console.log(`           ${show(held.tape)}`);
  console.log(`           words it passed through: ${held.words.slice(-12).join(' ') || '(none)'}\n`);
}

{
  const seeds = [7, 1031, 66613, 5, 99, 404, 8123, 31337, 2, 555];
  const on = seeds.map(seed => session({ seed, touching: true }));
  const off = seeds.map(seed => session({ seed, touching: true, flat: true }));
  const avg = (rs, f) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
  console.log('control  same hands, same seeds, plausibility flat:');
  console.log(`           ${show(off[0].tape.slice(0, 116))}`);
  console.log(`\n         over ${seeds.length} seeds x 300s`);
  console.log(`         letters/s    on ${avg(on, r => r.rate).toFixed(3)}   off ${avg(off, r => r.rate).toFixed(3)}`);
  console.log(`         vowel share  on ${(100 * avg(on, r => vowels(r.tape))).toFixed(1)}%  off ${(100 * avg(off, r => vowels(r.tape))).toFixed(1)}%   (English is 38.1%)`);
}

const EQUAL_ANGLE = (chars, spread, radius, cy, ry) =>
  chars.split('').map((ch, i) => {
    const t = (i / (chars.length - 1) - 0.5) * spread;
    return { ch, x: 0.5 + Math.sin(t) * radius, y: cy + (1 - Math.cos(t)) * ry, kind: 'letter' };
  });
{
  const oldLetters = [
    ...EQUAL_ANGLE('ABCDEFGHIJKLM', 1.90, 0.46, 0.245, 0.13),
    ...EQUAL_ANGLE('NOPQRSTUVWXYZ', 1.78, 0.41, 0.440, 0.11),
  ];
  const boardOf = (letters) => [...letters, ...DIGITS, ...PUNCTUATION, ...WORDS];
  const homeOf = (letters) => ({
    x: letters.reduce((a, l) => a + l.x, 0) / letters.length,
    y: letters.reduce((a, l) => a + l.y, 0) / letters.length,
  });
  const seeds = [7, 1031, 66613, 5, 99, 404, 8123, 31337, 2, 555];
  const avg = (rs, f) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
  const gap = (arr) => {
    const g = [];
    for (const arc of [arr.slice(0, 13), arr.slice(13)]) {
      for (let i = 1; i < arc.length; i++) g.push(Math.hypot(arc[i].x - arc[i - 1].x, arc[i].y - arc[i - 1].y));
    }
    return [Math.min(...g), Math.max(...g)];
  };
  const rows = [
    ['equal angle (before 5.0)', oldLetters],
    ['equal arc length (now)  ', LETTER_ARCS.flat()],
  ];
  console.log('\ngeometry same hands, same seeds, letters placed two ways:');
  for (const [name, letters] of rows) {
    const marks = boardOf(letters), home = homeOf(letters);
    const on = seeds.map(seed => session({ seed, touching: true, marks, home }));
    const off = seeds.map(seed => session({ seed, touching: true, flat: true, marks, home }));
    const [lo, hi] = gap(letters);
    console.log(`         ${name}  spacing ${lo.toFixed(4)}-${hi.toFixed(4)} (ratio ${(hi / lo).toFixed(2)})`);
    console.log(`           letters/s ${avg(on, r => r.rate).toFixed(3)}   vowel share ${(100 * avg(on, r => vowels(r.tape))).toFixed(1)}%`
              + `   flat control ${(100 * avg(off, r => vowels(r.tape))).toFixed(1)}%`);
  }
  console.log(`         MARK_GAP is ${MARK_GAP}; English is 38.1% vowels.`);
}
