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
  CUP, PARTNER_FORCE, DWELL_TIME, createCup, stepCup, stepPartner, aimFor,
  createDwell, stepDwell, clearDwellMemory, createSpeller, stepSpeller,
} from '../src/scenes/medium/medium.physics.js';

const DT = 1 / 60;
const f = n => n.toFixed(4);

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
const at = ch => LETTERS.find(l => l.ch === ch);

// ─── 1. Can it spell, when the visitor rests their hand and lets it drift? ───
// The visitor is present and touching but not driving: a slow aimless wander
// with no destination, which is what people actually do at a board.
//
// "HELLO" rather than a word with no repeat, because doubled letters are the
// case that breaks: a cup at rest on L cannot take L again without leaving, and
// the first version of this stalled at "HEL" forever. createSpeller handles the
// retreat, and this is the test that says whether it does.
{
  const want = 'HELLO';
  const cup = createCup(0.5, 0.62);
  const partner = { x: null, y: null };
  const dwell = createDwell();
  const sp = createSpeller(want);
  let out = '', t = 0;
  for (let i = 0; i < Math.round(60 / DT) && sp.i < want.length; i++) {
    t += DT;
    const vis = { x: cup.x + Math.sin(t * 0.9) * 0.02, y: cup.y + Math.cos(t * 0.7) * 0.02 };
    const aim = stepSpeller(sp, null, cup, at);
    const p = stepPartner(partner, aim, DT);
    stepCup(cup, DT, vis, p);
    clearDwellMemory(dwell, cup);
    const got = stepDwell(dwell, cup, LETTERS, DT);
    if (got) { out += got.ch; stepSpeller(sp, got, cup, at); }
  }
  console.log(`spell   passive visitor: spelled "${out}" (wanted "${want}") in ${f(t)}s`);
  console.log(`        ${sp.i === want.length ? `finished — ${f(t / want.length)}s per letter` : 'DID NOT finish — the board cannot spell'}`);
}

// ─── 2. Can the visitor override it? ─────────────────────────────────────────
// The partner tries to reach a letter on the left; the visitor pulls right and
// holds. The visitor must win, completely — a board that fights back is a
// puppet show, and a real one is trivially overridden.
{
  const cup = createCup(0.5, 0.62);
  const partner = { x: null, y: null };
  const target = at('A');
  let t = 0, worst = 0;
  for (let i = 0; i < Math.round(6 / DT); i++) {
    t += DT;
    const vis = { x: 0.86, y: 0.62 };           // visitor pulls hard right, and holds
    const p = stepPartner(partner, aimFor(target, cup), DT);
    stepCup(cup, DT, vis, p);
    worst = Math.max(worst, Math.hypot(cup.x - vis.x, cup.y - vis.y));
  }
  console.log(`\noverride visitor holds at 0.860; partner pulls toward "${target.ch}" at ${f(target.x)}`);
  console.log(`        cup ends at ${f(cup.x)}, ${f(cup.y)} — ${cup.x > 0.8 ? 'visitor wins outright' : 'PARTNER IS OVERPOWERING THE VISITOR'}`);
  console.log(`        furthest the partner ever dragged it from the visitor's hand: ${f(worst)} board units`);
}

// ─── 3. Does a driving visitor spell by accident? ────────────────────────────
// Someone sweeping the cup around should NOT produce letters — dwell is what
// takes a letter, and a moving cup should take none.
{
  const cup = createCup(0.5, 0.62);
  const partner = { x: null, y: null };
  const dwell = createDwell();
  let out = '', t = 0;
  for (let i = 0; i < Math.round(20 / DT); i++) {
    t += DT;
    const vis = { x: 0.5 + Math.sin(t * 1.6) * 0.28, y: 0.5 + Math.cos(t * 1.1) * 0.18 };
    const p = stepPartner(partner, aimFor(at('E'), cup), DT);
    stepCup(cup, DT, vis, p);
    clearDwellMemory(dwell, cup);
    const got = stepDwell(dwell, cup, LETTERS, DT);
    if (got) out += got.ch;
  }
  console.log(`\ndriving  20s of the visitor sweeping the cup around: spelled "${out}"`);
  console.log(`        ${out.length <= 2 ? 'motion alone does not spell' : 'TOO CHATTY — a moving cup is taking letters'}`);
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
