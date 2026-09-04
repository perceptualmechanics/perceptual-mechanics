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
// The visitor drags the cup hard to the right while the other hand leans
// wherever it likes. During the drag and for a second after it, the visitor must
// win completely — a board that fights back is a puppet show, and a real one is
// trivially overridden.
//
// ─── What this test used to claim, and why it was wrong ─────────────────────
// It used to hold the pointer at 0.860 for eight seconds and assert the cup was
// still there at the end. It passed for weeks and it was testing a fiction: in
// the input model a stationary pointer is a hand that has STOPPED PARTICIPATING,
// and a hand that has stopped participating does not hold a planchette
// anywhere — the other hand moves it and yours goes along, because that is what
// resting on an object means. The old test kept the visitor's grip up with a
// 40Hz wobble of four thousandths of a board, because grip used to be derived
// from frame-to-frame movement and a wobble was the only lever. When the input
// filter learned to tell jitter from motion — which it had to, for touchscreens,
// where a still finger jitters by two pixels — the wobble correctly stopped
// counting and this test correctly failed.
//
// So it asserts the thing that is actually promised: *while you are driving, you
// win.* Test 2b below asserts the other half, which is not a defect but the
// scene's whole thesis: stop participating and the other hand takes over.
{
  const cup = createCup(BOARD_HOME.x, BOARD_HOME.y);
  const hand = createWander(11, BOARD_HOME.x, BOARD_HOME.y);
  const v = createVisitor(cup.x, cup.y); v.down = true;
  let worst = 0, t = 0;
  for (let i = 0; i < Math.round(2.5 / DT); i++) {
    t += DT;
    // A real drag: half a second of travel to the right, then the visitor keeps
    // their hand there and keeps meaning it, which is a pointer that arrived
    // somewhere rather than one that is vibrating.
    v.x = 0.5 + Math.min(1, t / 0.5) * 0.36; v.y = BOARD_HOME.y;
    stepCup(cup, DT, stepVisitor(v, cup, DT), stepWander(hand, DT, cup, LETTERS, l => (l.ch.charCodeAt(0) % 7) / 6, v.grip));
    if (t > 0.8) worst = Math.max(worst, Math.hypot(cup.x - v.x, cup.y - v.y));
  }
  console.log(`\noverride visitor drags to 0.860 and means it`);
  console.log(`         cup ends at ${f(cup.x)}, ${f(cup.y)} — ${cup.x > 0.8 ? 'visitor wins outright' : 'PARTNER IS OVERPOWERING THE VISITOR'}`);
  console.log(`         furthest the partner ever held it off the visitor's hand: ${f(worst)} board units`);
}

// ─── 2b. And a visitor who stops taking part loses the cup ───────────────────
// Not a defect. It is the thesis: rest your hand and the other hand moves it,
// which is the entire scene. Asserted rather than discovered, because the
// previous version of test 2 asserted the opposite by accident.
{
  const cup = createCup(BOARD_HOME.x, BOARD_HOME.y);
  const hand = createWander(11, BOARD_HOME.x, BOARD_HOME.y);
  const v = createVisitor(cup.x, cup.y); v.down = true;
  let t = 0, parked = 0;
  for (let i = 0; i < Math.round(12 / DT); i++) {
    t += DT;
    v.x = 0.5 + Math.min(1, t / 0.5) * 0.36; v.y = BOARD_HOME.y;   // drag, then never touch it again
    stepCup(cup, DT, stepVisitor(v, cup, DT), stepWander(hand, DT, cup, LETTERS, l => (l.ch.charCodeAt(0) % 7) / 6, v.grip));
    if (Math.abs(t - 0.9) < DT) parked = cup.x;
  }
  const moved = Math.abs(cup.x - parked);
  console.log(`\nletgo    visitor drags to 0.860 and then does nothing for 11s`);
  console.log(`         cup drifted ${f(moved)} board units away — ${moved > 0.08 ? 'the other hand took over, as it should' : 'IT STAYED PUT — a resting hand is holding the cup'}`);
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
