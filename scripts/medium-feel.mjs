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

const LETTERS = MARKS;
const at = ch => MARKS.find(l => l.ch === ch);

{
  const say = (drive) => {
    const cup = createCup(BOARD_HOME.x, BOARD_HOME.y), hand = createWander(909), dwell = createDwell();
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
  const a = say(() => {});
  const b = say((t, v) => {
    if (Math.floor(t * 0.5) % 2) return;
    v.x = 0.5 + Math.sin(t * 1.7) * 0.22; v.y = 0.36 + Math.cos(t * 0.9) * 0.10;
  });
  console.log(`stored   same partner, same seed, visitor A: "${a}"`);
  console.log(`                                  visitor B: "${b}"`);
  console.log(`         ${a === b ? 'IDENTICAL — something is holding the message' : 'different — the sentence is not stored anywhere'}`);
}

{
  const cup = createCup(BOARD_HOME.x, BOARD_HOME.y);
  const hand = createWander(11);
  const v = createVisitor(cup.x, cup.y); v.down = true;
  let worst = 0, t = 0;
  for (let i = 0; i < Math.round(2.5 / DT); i++) {
    t += DT;
    v.x = 0.5 + Math.min(1, t / 0.5) * 0.36; v.y = BOARD_HOME.y;
    stepCup(cup, DT, stepVisitor(v, cup, DT), stepWander(hand, DT, cup, LETTERS, l => (l.ch.charCodeAt(0) % 7) / 6, v.grip));
    if (t > 0.8) worst = Math.max(worst, Math.hypot(cup.x - v.x, cup.y - v.y));
  }
  console.log(`\noverride visitor drags to 0.860 and means it`);
  console.log(`         cup ends at ${f(cup.x)}, ${f(cup.y)} — ${cup.x > 0.8 ? 'visitor wins outright' : 'PARTNER IS OVERPOWERING THE VISITOR'}`);
  console.log(`         furthest the partner ever held it off the visitor's hand: ${f(worst)} board units`);
}

{
  const cup = createCup(BOARD_HOME.x, BOARD_HOME.y);
  const hand = createWander(11);
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

{
  const q = at('Q');
  const cup = createCup(q.x, q.y);
  const hand = createWander(3);
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
