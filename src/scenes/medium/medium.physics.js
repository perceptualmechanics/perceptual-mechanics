// ─── Medium — the cup, and the two hands on it ──────────────────────────────
// NO DOM AND NO RENDERING IN THIS FILE. The scene draws what this produces;
// this decides what happens. Pure and deterministic, so the feel of the cup can
// be MEASURED — time to start, time to stop, overshoot, who is leading — rather
// than judged from a description. `medium.physics.test.js` drives it headless.
//
// ─── What this is a simulation of ───────────────────────────────────────────
// A willowware teacup upside-down on a homemade board, with two people's
// fingertips resting on it. That is a rigid body with mass and friction and TWO
// force inputs, and the brief is explicit that it has to be simulated rather
// than faked: "the resistance is the whole experience, and a mimicked one will
// feel wrong in a way nobody can name."
//
// The mechanism underneath is the ideomotor effect — Carpenter, 1852; Faraday's
// 1853 apparatus with an unattached top layer that moved before the table did.
// People really are moving the cup and really do not know they are. That is a
// description, not a debunking, and this file is built to be true to it.
//
// ─── Where the second hand comes from ───────────────────────────────────────
// **Nowhere. The partner has nothing to say.**
//
// Two versions were built and thrown away before that sentence was allowed to
// stand. The first made the partner an echo of the visitor's own hand, delayed;
// it gave withdrawal-mirroring and direction-change leading for free, and it
// **could not spell**, by construction — an echo has no intention, so nothing
// ever chooses a letter. The second gave the partner a message and had it lean
// toward the next letter of it, which spelled beautifully and was a puppet
// show: whatever the visitor did, the board said what it had been told to say.
// Both are recorded in NOTES 4.11.4 rather than left in the file.
//
// What is here instead is the ideomotor account taken literally, and it took
// one more failed version to get there. The obvious reading of the effect —
// that nobody aims, and the only thing English touches is how long a letter
// takes to land — was built, measured, and does not work: 0.03 letters per
// second and no words, for the reason set out at `stepWander`. A rule that can
// only reject cannot make a sentence out of a random walk.
//
// So the partner's hand does move on purpose, in the one sense the literature
// actually claims. It has no message, no plan and no next letter. It is drawn
// toward whichever letters near it would plausibly continue what has already
// been spelled — a gradient summed over the whole board at once, far too weak
// to insist — and a letter lands when the cup comes to rest on one, sooner for
// a plausible letter than an implausible one. Both halves of that come from
// `medium.lexicon.js`, which is the only file in the scene that knows any
// English, and neither half knows what it is spelling. **Nothing anywhere in
// this scene holds the sentence.** It exists only on the tape, after the fact,
// which is exactly the status a real transcript has.
//
// Three rules keep it honest:
//
//   1. **The partner leans; it never shoves.** Its force is capped at
//      PARTNER_FORCE, far below what a visitor's hand produces when the visitor
//      is actually pushing. A visitor who wants to go somewhere else goes
//      there, every time. That is not a concession to usability — a real board
//      is trivially overridden, and one that fights back is a puppet show.
//   2. **It therefore only makes progress when the visitor is not pushing** —
//      during hesitation, drift, the small aimless circling that is what people
//      actually do at a board. Which is the ideomotor account exactly: the
//      message emerges when nobody believes they are doing anything.
//   3. **A letter is taken by DWELL, not by contact.** The cup has to settle
//      near a letter before it counts. Real boards work by coming to rest, and
//      dwell is also what makes the visitor's own pauses the thing that spells —
//      they stop, and a letter lands.
//
// No letter is ever impossible. The plausibility scale is bounded at both ends
// (DWELL_EASE, DWELL_RESIST), so a visitor who parks the cup on Q gets a Q. If
// the board could refuse a letter it would be steering, and it does not steer.

// ─── Constants ──────────────────────────────────────────────────────────────
// All in board units — the board is 1.0 wide — and all per second, so nothing
// here is tied to a frame rate. See STANDARDS.md, "frame-rate independence".
export const CUP = {
  // Mass is what makes it hard to start and hard to stop. High enough that a
  // fingertip cannot flick it, low enough that it is not furniture.
  mass: 1.0,
  // The fingertip is a spring, not a handle: a hand does not TELL the cup where
  // to be, it leans on it. Stiffness sets how hard you can lean.
  handStiffness: 26,
  // The visitor's own spring, and it is stiffer than the partner's because the
  // visitor is PRESSING and the partner is resting. Without the asymmetry the
  // partner can hold the cup 0.046 board units off where the visitor is holding
  // it — very nearly one letter's spacing — so a visitor who parks the cup on Q
  // gets an R, which breaks the one promise the scene makes. At 78 the standoff
  // is 0.024, comfortably inside a letter.
  visitorStiffness: 78,
  // Damping on the spring, so a hand arriving fast does not launch the cup.
  // Back at 3.4 after an experiment that failed: it was lowered to 2.6 to make
  // the cup overshoot the hand it follows, and measuring across 3.4 / 2.6 /
  // 1.6 / 0.8 gave an overshoot of −0.0156 / −0.0154 / −0.0150 / −0.0156 board
  // units — identical, and negative at every value, meaning the cup always
  // creeps up from behind and never passes. **Damping is not what prevents
  // overshoot here; friction is.** The cup does not overshoot, which is right
  // for felt on card rather than a planchette on a slick board, and forcing it
  // would mean dropping the friction that makes the whole thing feel like an
  // object. Recorded so the same change is not tried twice.
  handDamping: 3.4,
  // Kinetic friction: felt, board-on-felt. A planchette GLIDES; it does not
  // slide freely and it does not stick. This is the single most important
  // number in the file for how the thing feels.
  kineticFriction: 0.9,
  // Stiction: the extra force needed to get it moving at all, and the reason
  // the first movement of a session is a lurch rather than a drift. Real, and
  // the thing everyone who has touched a board remembers.
  staticFriction: 1.55,
  // Below this speed the cup is treated as at rest, so stiction can re-arm.
  restSpeed: 0.012,
  maxSpeed: 2.2,
};

// ─── The partner ────────────────────────────────────────────────────────────
// A lean, capped. PARTNER_FORCE is the whole balance of the scene: it has to be
// enough to move a resting cup — above CUP.staticFriction, or the board can
// never start on its own — and far enough below what a pushing hand produces
// that it can never win an argument. A visitor's spring at a comfortable
// reach delivers several times this.
export const PARTNER_FORCE = 1.9;
// A hand, not a cursor: a speed limit in board units per second, clamped in
// `stepWander`. Without it a run of impulses in the same direction can produce
// a swipe no wrist would make.
export const PARTNER_HAND_SPEED = 0.6;

// ─── Taking a letter ────────────────────────────────────────────────────────
// By dwell, not by contact. The cup must be within DWELL_RADIUS of a letter and
// slower than DWELL_SPEED for DWELL_TIME before it counts — so passing over a
// letter on the way somewhere else spells nothing, which is how a real board
// behaves and is also what makes the visitor's own pauses the thing that
// spells.
// The catchment, and it is also the cup: CUP_R in medium.js is this times 1.06,
// because a cup drawn smaller than its own catchment would take letters it was
// visibly not on. So this number is both a rule and a size, and it was swept as
// both when the arcs were widened and the letters ended up 0.051 apart:
//
//     radius   repeated 6-grams   Spearman vs English
//      0.042         10.4%              0.822
//      0.048          4.0%              0.837     <- here
//      0.055          4.8%              0.856
//
// 0.048 rather than 0.055 because the cup has to be readable as sitting on ONE
// letter, and 0.055 is a teacup wide enough to cover two of them at this
// spread. 0.042 looks better still and measures much worse: too small a
// catchment means the cup takes fewer distinct letters and loops more.
export const DWELL_RADIUS = 0.048;
export const DWELL_SPEED = 0.09;
export const DWELL_TIME = 0.55;

// ─── How far plausibility is allowed to move that number ────────────────────
// The multipliers on DWELL_TIME for the likeliest next letter and for one no
// English word wants: 0.28s against 2.2s. Both finite, and that is the promise
// the scene makes — a visitor who parks the cup on Q and holds it there gets a
// Q, in a little over two seconds. The board can be slow to agree. It can
// never refuse.
export const DWELL_EASE = 0.5;
export const DWELL_RESIST = 4.0;

// ─── The partner's wander ───────────────────────────────────────────────────
// Bursts of travel separated by stillness, because that is what a hand does and
// because a continuously drifting cup crawls along the arc taking every letter
// it passes. Times in seconds; each interval is its minimum plus a uniform draw
// on its variance, so the rhythm never repeats.
export const BURST_MIN = 0.2;
export const BURST_VAR = 0.45;
export const PAUSE_MIN = 0.3;
export const PAUSE_VAR = 0.7;
// How fast the hand goes still when a burst ends, per second. High: the pause
// is a stop, not a glide, and the cup's own stiction does the rest.
export const STOP_DAMP = 9;

export const WANDER_SIGMA = 2.5;     // impulse strength, board units/s^1.5
export const WANDER_DAMP = 2.0;      // how fast an impulse dies, per second
// A spring back toward the middle of the letters, and it is ZERO — the term is
// kept because removing it would hide the finding. It was 0.8, and it made the
// middle of the board sticky: the letters at the centre of the two arcs are
// nearest to everything, so the hand spent its time there and S, T and R came
// out at twice their English rate while A and O came out at two thirds. Sweeping
// it against the board's own letter distribution measured 0.796 / 0.762 / 0.815
// / 0.830 Spearman against published English frequencies at 0.8 / 0.4 / 0.15 /
// 0, so the honest value is none at all. What keeps the hand on the board is
// WANDER_BOUNDS below, which is a wall rather than a preference.
export const WANDER_CENTRE = 0;
// ─── Where the hand is allowed to be ────────────────────────────────────────
// A box, not a disc, and the change was forced by looking at it: a disc of
// radius 0.46 about BOARD_HOME reaches y = −0.08, so the other hand wandered
// clean off the top edge of the card and sat there with the cup, above YES,
// on the black. A board is a rectangle and a hand on it stays on it.
//
// The bounds are the card's lettering, with a margin — and the bottom edge is
// doing real work. Punctuation sits at y 0.805 and GOODBYE at 0.885, so a floor
// of 0.83 puts the four marks inside the other hand's reach and GOODBYE outside
// it. That is the whole mechanism of "the board cannot say goodbye on its own",
// and it is one number rather than a special case.
export const WANDER_BOUNDS = { x0: 0.10, y0: 0.09, x1: 0.90, y1: 0.83 };

// Where a session starts — anywhere among the letters, which is where a cup
// gets left. This is not cosmetic. Starting it at BOARD_HOME, or in a small disc
// around it, put the cup on top of S and T at the beginning of every session,
// and since S and T are also the commonest first letters in English the board
// opened with STRE in seven séances out of eight. A board that always says the
// same thing first is a board with a script, which is the one thing this scene
// must not have. Drawn over the lettering rather than over the whole board,
// because a uniform draw parks a third of sessions in a corner against the
// border, which reads as a bug rather than as a cup somebody put down.
export const WANDER_START = { x0: 0.18, y0: 0.16, x1: 0.82, y1: 0.58 };

// ─── The field ──────────────────────────────────────────────────────────────
// How hard the hand leans toward plausible letters, and how far it can feel
// them. FIELD_PULL is in board units per second squared, and it is the single
// number that decides whether the board says anything. Measured over fifty
// minutes of simulated sitting, ten seeds, with a visitor who is touching but
// not driving:
//
//     pull    letters/s   vowel share
//        0        0.045         22.9%      alphabet soup
//        5        0.109         33.4%
//       12        0.146         34.2%      <- here
//       26        0.191         33.0%
//                              (38.1%)     English
//
// 12 rather than 26 because rate is not the only thing being bought: past this
// the hand starts to look like it is going somewhere, and the whole illusion is
// that it is not.
//
// FIELD_RANGE is the exponential falloff in board units — short enough that the
// hand is drawn to a plausible letter beside it rather than to the best one on
// the board, which is the difference between a drift and a destination. Swept
// again after the arcs were widened, on the guess that a longer range would let
// the hand feel the far ends of them: it does not, it makes everything worse.
// 0.28 / 0.38 / 0.50 measured Spearman 0.809 / 0.733 / 0.685 against English
// letter frequencies, with repeated six-grams going 5.2% / 7.2% / 6.0%. A wider
// kernel averages the whole board into one direction, and one direction is a
// destination.
export const FIELD_PULL = 12;
export const FIELD_RANGE = 0.28;

export function createCup(x = 0.5, y = 0.62) {
  return { x, y, vx: 0, vy: 0, resting: true };
}

// ─── One step ───────────────────────────────────────────────────────────────
// `dt` is real seconds from the frame clock, already clamped by the caller.
// `visitor` and `partner` are {x, y} or null — null meaning that hand is not
// on the cup, which is the ordinary state before the visitor touches it and
// again whenever they let go.
//
// Returns which force was larger this step, so the scene can draw the cup
// leaning without the renderer having to re-derive the physics. It is reported
// rather than displayed as a label: the visitor is never told who is leading.
export function stepCup(cup, dt, visitor, partner) {
  let fx = 0, fy = 0, fvMag = 0, fpMag = 0;

  if (visitor) {
    const sx = (visitor.x - cup.x) * CUP.visitorStiffness - cup.vx * CUP.handDamping;
    const sy = (visitor.y - cup.y) * CUP.visitorStiffness - cup.vy * CUP.handDamping;
    fx += sx; fy += sy; fvMag = Math.hypot(sx, sy);
  }
  if (partner) {
    let sx = (partner.x - cup.x) * CUP.handStiffness - cup.vx * CUP.handDamping;
    let sy = (partner.y - cup.y) * CUP.handStiffness - cup.vy * CUP.handDamping;
    // The cap is the scene's whole balance — see PARTNER_FORCE. It is applied
    // to the partner's force and not to the visitor's, and that asymmetry is
    // the design: one of them can shove and one of them can only lean.
    const mag = Math.hypot(sx, sy);
    if (mag > PARTNER_FORCE) { sx = (sx / mag) * PARTNER_FORCE; sy = (sy / mag) * PARTNER_FORCE; }
    fx += sx; fy += sy; fpMag = Math.min(mag, PARTNER_FORCE);
  }

  const speed = Math.hypot(cup.vx, cup.vy);
  const applied = Math.hypot(fx, fy);

  // Stiction, and it is a real branch rather than a large damping term: below
  // the rest speed the cup does not move at all until the applied force
  // exceeds staticFriction. That is the lurch — the cup holds, holds, and then
  // goes — and a smooth approximation of it does not feel the same.
  if (cup.resting && applied < CUP.staticFriction) {
    cup.vx = 0; cup.vy = 0;
    return { moved: false, leader: null, applied };
  }
  cup.resting = false;

  let ax = fx / CUP.mass, ay = fy / CUP.mass;

  // Kinetic friction opposes motion, and is applied as a velocity decrement
  // rather than a force so it cannot reverse the cup at low speed — the
  // classic sign-flip jitter of naive Coulomb friction in a discrete step.
  if (speed > 1e-6) {
    const drop = Math.min(speed, (CUP.kineticFriction / CUP.mass) * dt);
    cup.vx -= (cup.vx / speed) * drop;
    cup.vy -= (cup.vy / speed) * drop;
  }

  cup.vx += ax * dt; cup.vy += ay * dt;

  const ns = Math.hypot(cup.vx, cup.vy);
  if (ns > CUP.maxSpeed) { cup.vx = (cup.vx / ns) * CUP.maxSpeed; cup.vy = (cup.vy / ns) * CUP.maxSpeed; }
  if (ns < CUP.restSpeed && applied < CUP.staticFriction) {
    cup.vx = 0; cup.vy = 0; cup.resting = true;
  }

  cup.x += cup.vx * dt; cup.y += cup.vy * dt;

  return {
    moved: true,
    // Who is leaning harder this instant. Null while they are within a few
    // percent, which is most of the time and is the point.
    leader: Math.abs(fvMag - fpMag) < 0.06 * Math.max(fvMag, fpMag, 1e-6)
      ? null : (fvMag > fpMag ? 'visitor' : 'partner'),
    applied,
  };
}

// ─── Dwell ──────────────────────────────────────────────────────────────────
// Call once per frame with the cup and the board's letters. Returns the letter
// taken this frame, or null. Holds its own state, so a session is one instance.
export function createDwell() {
  return { on: null, held: 0, last: null };
}

// `scale` is optional and is where English enters the scene: given the letter
// the cup is sitting on, it returns a multiplier on DWELL_TIME. Called every
// frame rather than once on arrival, so that a letter which becomes plausible
// while the cup is already resting on it can still land — the visitor's pause
// and the board's priming are the same event.
export function stepDwell(d, cup, letters, dt, scale) {
  const speed = Math.hypot(cup.vx, cup.vy);
  let near = null, best = DWELL_RADIUS;
  for (const l of letters) {
    const dist = Math.hypot(l.x - cup.x, l.y - cup.y);
    if (dist < best) { best = dist; near = l; }
  }
  if (!near || speed > DWELL_SPEED) { d.on = near; d.held = 0; return null; }
  if (d.on !== near) { d.on = near; d.held = 0; }
  d.held += dt;
  const need = DWELL_TIME * (scale ? scale(near) : 1);
  if (d.held >= need) {
    d.held = 0;
    // The same letter cannot be taken twice without leaving it first, or a cup
    // that settles spells one character forever.
    if (d.last === near) return null;
    d.last = near;
    return near;
  }
  return null;
}

// Leaving a letter re-arms it. Called by the scene when the cup moves off.
export function clearDwellMemory(d, cup) {
  if (d.last && Math.hypot(d.last.x - cup.x, d.last.y - cup.y) > DWELL_RADIUS * 2.2) d.last = null;
}

// ─── The partner's hand ─────────────────────────────────────────────────────
// It has no message and no plan. What it has is a body: it moves in bursts and
// then holds still, it is drawn toward whatever nearby letter is currently
// plausible, and it is far too weak to insist on anything. Nothing in here
// stores a word, a sentence or a destination, and a session started twice with
// the same seed and a different visitor says different things.
//
// ─── Why there is a pull at all, when the design said there would not be ────
// The first version of this had NO pull. The hand wandered at random and the
// only thing English touched was how long a letter took to land — bias in the
// stopping, never in the pulling, which is the cleanest possible statement of
// the ideomotor account and is what the brief asked for.
//
// It was built, and measured, and it does not work. Over 25 minutes of
// simulated sitting across five seeds it took **0.03 to 0.06 letters per
// second** — one letter a minute at the setting where the letters were any
// good — with a vowel share of 20% against English's 38%, and it never
// produced a word. The arithmetic is unforgiving and worth writing down: a
// randomly wandering cup comes to rest near a letter about 0.6 times a second,
// the letter it stops near is one of twenty-six, and a stopping rule can only
// ever *reject*. Rejecting hard enough to get English costs a factor of twenty
// in rate; rejecting gently enough to keep the rate gets alphabet soup. There
// is no setting where both work, because a filter cannot manufacture the
// opportunities it is filtering.
//
// So the real effect must include direction, and it does — that is what the
// ideomotor literature describes. Faraday's sitters were not failing to stop;
// their hands were travelling, in a direction they did not know they had
// chosen. What is here is that, and only that:
//
//   **The hand drifts toward whichever letters near it would plausibly come
//   next, without knowing what it is spelling.**
//
// A gradient is not a target. There is no next letter chosen anywhere in this
// scene — FIELD_PULL is summed over every letter on the board at once, weighted
// by nearness and by plausibility, so the hand leans into a *region* and the
// board resolves which letter only when the cup stops. The sentence exists
// nowhere until it has been spelled. That is the difference between this and
// the puppet-show version, and it is a difference in the code rather than in
// the description: there is no variable anywhere holding what the board is
// going to say.
//
// `weightOf` is how English gets in, and it is a callback for a reason: this
// file knows where the letters are and nothing else. Swap it for `() => 1` and
// the hand wanders like a hand, with no idea that words exist.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createWander(seed = 0x5EA9CE, homeX = 0.5, homeY = 0.44) {
  const rnd = mulberry32(seed);
  // Start somewhere on the board rather than dead centre, or every session
  // opens with the same letter — measured: eight runs out of eight began T.
  const S = WANDER_START;
  return {
    x: S.x0 + rnd() * (S.x1 - S.x0), y: S.y0 + rnd() * (S.y1 - S.y0),
    vx: 0, vy: 0, homeX, homeY,
    moving: false, left: PAUSE_MIN + rnd() * PAUSE_VAR, rnd,
  };
}

// `letters` is the board — [{ch, x, y}] — and `weightOf(letter)` returns how
// plausible that letter is right now, in 0..1. Pass `null` for `weightOf` and
// the hand still moves; it just stops meaning anything.
export function stepWander(w, dt, letters, weightOf) {
  const R = w.rnd;

  // ─── Bursts and pauses ────────────────────────────────────────────────────
  // Not an Ornstein-Uhlenbeck drift, which was the first attempt: continuous
  // jitter makes the cup ooze along the arc of letters and take every one it
  // crawls past, which measured as 20% of taken letters being alphabetically
  // adjacent to the one before. Hands do not ooze. They go, and then they stop,
  // and the stopping is what a board is read by.
  w.left -= dt;
  if (w.left <= 0) {
    w.moving = !w.moving;
    w.left = w.moving ? BURST_MIN + R() * BURST_VAR : PAUSE_MIN + R() * PAUSE_VAR;
  }

  if (w.moving) {
    // Sum of three uniforms, centred and scaled: unit variance, and cheaper and
    // more bounded than Box-Muller, which can hand back a six-sigma kick that
    // reads as a twitch.
    const g = () => (R() + R() + R() - 1.5) * 2;
    const k = WANDER_SIGMA * Math.sqrt(dt);
    w.vx += g() * k - w.vx * WANDER_DAMP * dt - (w.x - w.homeX) * WANDER_CENTRE * dt;
    w.vy += g() * k - w.vy * WANDER_DAMP * dt - (w.y - w.homeY) * WANDER_CENTRE * dt;

  } else {
    w.vx -= w.vx * STOP_DAMP * dt; w.vy -= w.vy * STOP_DAMP * dt;
  }

  // ─── The field ────────────────────────────────────────────────────────────
  // Every letter pulls at once, by plausibility and by nearness; the
  // exponential falloff is what keeps it local, so the hand leans toward a
  // plausible letter beside it rather than setting off across the board toward
  // the best one in the alphabet.
  //
  // Outside the burst/pause branch on purpose. A lean does not switch off when
  // a hand stops moving — that is the whole of what "finds it harder to leave"
  // means — and it measured as the difference between 0.07 letters a second and
  // 0.16, which is the difference between a board that says something in three
  // minutes and one that does not.
  if (weightOf && letters) {
    let gx = 0, gy = 0, gw = 0;
    for (const l of letters) {
      const dx = l.x - w.x, dy = l.y - w.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const wt = weightOf(l) * Math.exp(-d / FIELD_RANGE);
      gx += (dx / d) * wt; gy += (dy / d) * wt; gw += wt;
    }
    if (gw > 0) { w.vx += (gx / gw) * FIELD_PULL * dt; w.vy += (gy / gw) * FIELD_PULL * dt; }
  }

  const sp = Math.hypot(w.vx, w.vy);
  if (sp > PARTNER_HAND_SPEED) { w.vx = (w.vx / sp) * PARTNER_HAND_SPEED; w.vy = (w.vy / sp) * PARTNER_HAND_SPEED; }
  w.x += w.vx * dt; w.y += w.vy * dt;

  // The edges of the board. Reflecting rather than clamping, so the hand turns
  // around instead of grinding along the boundary — a hand parked against an
  // invisible wall is the tell that there is one.
  const B = WANDER_BOUNDS;
  if (w.x < B.x0) { w.x = B.x0; if (w.vx < 0) w.vx = -w.vx; }
  else if (w.x > B.x1) { w.x = B.x1; if (w.vx > 0) w.vx = -w.vx; }
  if (w.y < B.y0) { w.y = B.y0; if (w.vy < 0) w.vy = -w.vy; }
  else if (w.y > B.y1) { w.y = B.y1; if (w.vy > 0) w.vy = -w.vy; }
  return w;
}
