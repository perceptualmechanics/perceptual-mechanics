// ─── medium: what the cup feels like, as numbers ────────────────────────────
// Run with `node scripts/medium-feel.mjs`. Not part of the build — a bench for
// the one scene whose whole experience is a resistance, kept in the repo
// because the constants in medium.physics.js were chosen by reading this
// output and cannot be re-tuned honestly without it.
//
// The brief's standard: "the resistance is the whole experience, and a mimicked
// one will feel wrong in a way nobody can name." So name it.
//
// The two questions that decide whether the scene is honest rather than a
// puppet show are at the bottom: CAN it spell when the visitor lets it, and CAN
// the visitor always override it. Both have to be yes.
import {
  CUP, PARTNER_FORCE, DWELL_EASE, DWELL_RESIST,
  createCup, stepCup, createWander, stepWander,
  createVisitor, stepVisitor,
  createDwell, stepDwell, clearDwellMemory,
} from '../src/scenes/medium/medium.physics.js';
import { createReader, decayReader, weightOf, takeMark } from '../src/scenes/medium/medium.lexicon.js';
import { MARKS, BOARD_HOME } from '../src/scenes/medium/medium.text.js';

const DT = 1 / 60;
const f = n => n.toFixed(4);

// The real board — the same MARKS array medium.js draws and the physics is
// handed at runtime. This file kept its own copy of the letter arcs until the
// board moved out into medium.text.js, which meant the thing being measured was
// not quite the thing that shipped.
const LETTERS = MARKS;
const at = ch => MARKS.find(l => l.ch === ch);

// ─── 1. Is the sentence stored anywhere? ─────────────────────────────────────
// The structural claim of the scene is that nothing holds what the board is
// going to say. So: the same partner, the same seed, the same board, two
// different visitors. If a message were stored, both would say it.
{
  const say = (drive) => {
    const cup = createCup(BOARD_HOME.x, BOARD_HOME.y), hand = createWander(909, BOARD_HOME.x, BOARD_HOME.y), dwell = createDwell();
    const reader = createReader();
    const plaus = l => weightOf(reader, l);
    const v = createVisitor(cup.x, cup.y); v.down = true;
    let out = '';
    for (let i = 0; i < Math.round(150 / DT); i++) {
      decayReader(reader, DT);
      drive(i * DT, v);
      stepCup(cup, DT, stepVisitor(v, cup, DT), stepWander(hand, DT, cup, LETTERS, plaus, v.grip));
      clearDwellMemory(dwell, cup);
      const got = stepDwell(dwell, cup, LETTERS, DT,
        l => DWELL_RESIST + (DWELL_EASE - DWELL_RESIST) * plaus(l));
      if (got) out += takeMark(reader, got);
    }
    return out;
  };
  // Visitor A rests. Visitor B nudges the cup every couple of seconds — the
  // same board, the same other hand, the same seed, and a different person.
  const a = say(() => {});
  const b = say((t, v) => {
    if (Math.floor(t * 0.5) % 2) return;
    v.x = 0.5 + Math.sin(t * 1.7) * 0.22; v.y = 0.36 + Math.cos(t * 0.9) * 0.10;
  });
  console.log(`stored   same partner, same seed, visitor A: "${a}"`);
  console.log(`                                  visitor B: "${b}"`);
  console.log(`         ${a === b ? 'IDENTICAL — something is holding the message' : 'different — the sentence is not stored anywhere'}`);
}

// ─── 2. Can the visitor override it? ─────────────────────────────────────────
// The visitor pulls right and holds while the partner does whatever it does.
// The visitor must win, completely — a board that fights back is a puppet show,
// and a real one is trivially overridden.
{
  const cup = createCup(BOARD_HOME.x, BOARD_HOME.y);
  const hand = createWander(11, BOARD_HOME.x, BOARD_HOME.y);
  const v = createVisitor(cup.x, cup.y); v.down = true;
  let worst = 0, t = 0;
  for (let i = 0; i < Math.round(8 / DT); i++) {
    t += DT;
    // Pulling and HOLDING. A hand that stops moving goes slack by design — grip
    // decays — so "holds" has to mean "keeps pushing", and the honest way to
    // say that is a pointer that keeps arriving rather than a flag that is set.
    // The tiny wobble is what a real hand pressing against something does and
    // is what keeps grip at 1; without it this would be testing a slack hand.
    v.x = 0.86 + Math.sin(t * 40) * 0.004; v.y = 0.44;
    stepCup(cup, DT, stepVisitor(v, cup, DT), stepWander(hand, DT, cup, LETTERS, l => (l.ch.charCodeAt(0) % 7) / 6, v.grip));
    // Only once the cup has arrived: the first seconds are the journey, not a
    // measure of how far the partner can hold it off.
    if (t > 2) worst = Math.max(worst, Math.hypot(cup.x - v.x, cup.y - v.y));
  }
  console.log(`\noverride visitor holds at 0.860; partner leans wherever it likes`);
  console.log(`         cup ends at ${f(cup.x)}, ${f(cup.y)} — ${cup.x > 0.8 ? 'visitor wins outright' : 'PARTNER IS OVERPOWERING THE VISITOR'}`);
  console.log(`         furthest the partner ever held it off the visitor's hand: ${f(worst)} board units`);
}

// ─── 3. Can a visitor spell a letter the board does not want? ────────────────
// Q after nothing is about as implausible as English gets. The visitor holds
// the cup on it. It has to land, and the time it takes is the promise the scene
// makes: the board may be slow to agree, and it may never refuse.
//
// The visitor here is closed-loop — they aim past the letter by whatever the
// error currently is — because that is what a person with their eyes open does,
// and because an open-loop visitor cannot win against stiction. A cup at rest
// stays at rest while the two hands are within CUP.staticFriction of each
// other, which leaves the partner able to park it up to 0.044 board units off
// the visitor's fingertip: more than half the gap between two letters. So a
// visitor who sets their hand on Q once and never adjusts may well get an R,
// and that is not a bug — it is what holding a planchette against somebody
// else's hand is like. Correcting takes a moment and always works.
{
  const q = at('Q');
  const cup = createCup(q.x, q.y);
  const hand = createWander(3, BOARD_HOME.x, BOARD_HOME.y);
  const dwell = createDwell();
  const reader = createReader();
  const v = createVisitor(q.x, q.y); v.down = true;
  let t = 0, got = null;
  const plaus = l => weightOf(reader, l);
  for (let i = 0; i < Math.round(20 / DT) && !got; i++) {
    t += DT;
    decayReader(reader, DT);
    v.x = q.x + (q.x - cup.x) * 1.6; v.y = q.y + (q.y - cup.y) * 1.6;
    stepCup(cup, DT, stepVisitor(v, cup, DT), stepWander(hand, DT, cup, LETTERS, plaus, v.grip));
    clearDwellMemory(dwell, cup);
    got = stepDwell(dwell, cup, LETTERS, DT,
      l => DWELL_RESIST + (DWELL_EASE - DWELL_RESIST) * plaus(l));
  }
  console.log(`\ninsist  visitor holds the cup on Q: ${got ? `took "${got.ch}" after ${f(t)}s` : 'NEVER LANDED — the board is refusing a letter'}`);
}

// ─── 4. The cup itself: start, stop, determinism, frame rate ─────────────────
{
  const run = (dt, seconds, hand) => {
    const cup = createCup(0.5, 0.6); let t = 0; const log = [];
    for (let i = 0; i < Math.round(seconds / dt); i++) {
      t += dt; const h = hand(t);
      stepCup(cup, dt, h, null);
      log.push({ t, x: cup.x, sp: Math.hypot(cup.vx, cup.vy) });
    }
    return log;
  };
  const a = run(DT, 4, t => (t < 0.2 ? null : { x: 0.5 + Math.min(0.25, (t - 0.2) * 0.35), y: 0.6 }));
  const first = a.find(r => r.sp > 0.001);
  console.log(`\ncup     hand lands at 0.200s, breaks away at ${f(first?.t ?? NaN)}s (holds ${f((first?.t ?? 0) - 0.2)}s)`);
  const b = run(DT, 4, t => ({ x: t < 1.5 ? 0.5 + t * 0.16 : 0.74, y: 0.6 }));
  const stop = b.findIndex((r, i) => r.t > 1.5 && r.sp < 0.005);
  console.log(`        hand stops at 1.500s, cup settles at ${f(b[stop]?.t ?? NaN)}s (coast ${f((b[stop]?.t ?? 0) - 1.5)}s)`);

  const ends = [30, 60, 144].map(hz => {
    const l = run(1 / hz, 3, t => (t < 0.15 ? null : { x: 0.5 + Math.min(0.3, (t - 0.15) * 0.3), y: 0.6 }));
    return { hz, x: l.at(-1).x };
  });
  console.log(`        30/60/144Hz end at ${ends.map(e => f(e.x)).join('  ')}  (spread ${f(Math.max(...ends.map(e => Math.abs(e.x - ends[1].x))))})`);
}
