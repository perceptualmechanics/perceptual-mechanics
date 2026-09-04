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
// **The partner wants to spell something, and leans toward the next letter.**
//
// This replaced an echo, and the replacement was Scott's call: the first
// version made the partner the visitor's own hand delayed, which gave
// withdrawal-mirroring and direction-change leading for free and was elegant
// and measured and **could not spell**, by construction — an echo has no
// intention, so nothing chooses a letter. Bolting a letter queue onto it would
// have been the exact lie the brief warns about. It is recorded in NOTES 4.11.4
// rather than left in the file.
//
// So the partner has an intention, and the honest problem becomes: how does a
// second hand steer the cup to a letter **without the visitor being able to
// tell they were steered**? Three rules, and they are what make it true rather
// than staged:
//
//   1. **The partner leans; it never shoves.** Its force is capped at
//      PARTNER_FORCE, which is far below what a visitor's hand produces when
//      the visitor is actually pushing. A visitor who wants to go somewhere
//      else goes there, every time. That is not a concession to usability — a
//      real board is trivially overridden, and one that fights back is a
//      puppet show.
//   2. **It therefore only makes progress when the visitor is not pushing** —
//      during hesitation, drift, the small aimless circling that is what people
//      actually do at a board. Which is the ideomotor account exactly: the
//      message emerges when nobody believes they are doing anything.
//   3. **A letter is taken by DWELL, not by contact.** The cup has to settle
//      near a letter for DWELL_TIME before it counts. Real boards work by
//      coming to rest, and dwell is also what makes the visitor's own pauses
//      the thing that spells — they stop, and a letter lands.
//
// So the board can spell, and whether it does is genuinely up to the pair. A
// visitor who drags it around gets nothing. A visitor who rests their hand and
// lets it drift gets sentences. Neither of them can point at who did it, and
// that remains true because it is true rather than because it is hidden.

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
// How fast the partner's own hand travels toward where it wants the cup to be.
// A hand, not a cursor: this is a speed limit in board units per second.
export const PARTNER_HAND_SPEED = 0.55;
// The partner aims a little past the letter rather than at it, because a hand
// resting on a cup pushes through a target rather than stopping on it. Also
// what stops the cup parking exactly on centre and looking mechanical.
export const PARTNER_OVERSHOOT = 0.035;

// ─── Taking a letter ────────────────────────────────────────────────────────
// By dwell, not by contact. The cup must be within DWELL_RADIUS of a letter and
// slower than DWELL_SPEED for DWELL_TIME before it counts — so passing over a
// letter on the way somewhere else spells nothing, which is how a real board
// behaves and is also what makes the visitor's own pauses the thing that
// spells.
export const DWELL_RADIUS = 0.055;
export const DWELL_SPEED = 0.09;
export const DWELL_TIME = 0.55;

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
    const sx = (visitor.x - cup.x) * CUP.handStiffness - cup.vx * CUP.handDamping;
    const sy = (visitor.y - cup.y) * CUP.handStiffness - cup.vy * CUP.handDamping;
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

// ─── The partner's hand, moving toward what it wants to say ─────────────────
// `hand` is mutated in place. `aim` is the board point the partner is currently
// trying to bring the cup to — the next letter, pushed a little past centre.
// Returns the hand, or null before the partner has joined.
export function stepPartner(hand, aim, dt) {
  if (!aim) return null;
  if (hand.x == null) { hand.x = aim.x; hand.y = aim.y; return hand; }
  const dx = aim.x - hand.x, dy = aim.y - hand.y;
  const d = Math.hypot(dx, dy);
  const step = PARTNER_HAND_SPEED * dt;
  if (d <= step) { hand.x = aim.x; hand.y = aim.y; }
  else { hand.x += (dx / d) * step; hand.y += (dy / d) * step; }
  return hand;
}

// Where the partner puts its hand to bring the cup to `letter`: on the far side
// of the letter from the cup, so the cup is pulled through rather than parked.
export function aimFor(letter, cup) {
  const dx = letter.x - cup.x, dy = letter.y - cup.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: letter.x + (dx / d) * PARTNER_OVERSHOOT,
           y: letter.y + (dy / d) * PARTNER_OVERSHOOT };
}

// ─── Dwell ──────────────────────────────────────────────────────────────────
// Call once per frame with the cup and the board's letters. Returns the letter
// taken this frame, or null. Holds its own state, so a session is one instance.
export function createDwell() {
  return { on: null, held: 0, last: null };
}

export function stepDwell(d, cup, letters, dt) {
  const speed = Math.hypot(cup.vx, cup.vy);
  let near = null, best = DWELL_RADIUS;
  for (const l of letters) {
    const dist = Math.hypot(l.x - cup.x, l.y - cup.y);
    if (dist < best) { best = dist; near = l; }
  }
  if (!near || speed > DWELL_SPEED) { d.on = near; d.held = 0; return null; }
  if (d.on !== near) { d.on = near; d.held = 0; }
  d.held += dt;
  if (d.held >= DWELL_TIME) {
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

// ─── The speller ────────────────────────────────────────────────────────────
// Owns what the partner is trying to say and turns it into an aim point each
// frame. Separate from the physics so the scene can hand it any source of text
// without the cup knowing anything about words.
//
// **It exists because of doubled letters.** A cup that settles on a letter must
// leave before that letter can count again — otherwise a cup at rest spells one
// character forever — and with the partner aiming at the same letter it never
// leaves, so HELLO stalls permanently at HEL. Measured exactly that way before
// this was written.
//
// The fix is what a real sitter does: for a repeat, move off and come back. The
// partner aims at a retreat point until the board has forgotten the letter,
// then aims at it again. Nothing is faked — the cup really does travel away and
// return, and the second L is really taken by dwell.
export function createSpeller(text) {
  return { text: text.toUpperCase(), i: 0, retreating: false };
}

// `taken` is the letter stepDwell just returned, or null.
export function stepSpeller(sp, taken, cup, letterAt) {
  if (taken && taken.ch === sp.text[sp.i]) {
    sp.i++;
    sp.retreating = sp.text[sp.i] === taken.ch;   // a repeat is coming
  }
  const want = sp.text[sp.i];
  if (!want) return null;                          // said everything it had
  const target = letterAt(want);
  if (!target) { sp.i++; return null; }            // a space, or an unmarked glyph
  if (sp.retreating) {
    // ─── Three distances, and they must not be the same number ─────────────
    // The first version aimed the retreat at DWELL_RADIUS * 2.6 and ended it at
    // * 2.2 — the same threshold clearDwellMemory uses. The cup stopped at
    // 0.1210 board units from the letter and the threshold WAS 0.1210, so the
    // strict `>` never fired and HELLO stalled at HEL forever, in a standoff
    // exact to four decimal places. Friction is why: the cup never arrives at
    // an aim point, it stops short of one.
    //
    // So the aim is placed well beyond both tests rather than just past them:
    //   4.2  where the partner aims — far enough that stopping short still
    //        clears everything below
    //   2.6  where the retreat ends
    //   2.2  where clearDwellMemory re-arms the letter (below this)
    const away = DWELL_RADIUS * 4.2;
    // Retreat outward from the board's centre, so the cup backs off the letter
    // rather than crossing the board and taking something else on the way.
    const dx = cup.x - 0.5, dy = cup.y - 0.5;
    const d = Math.hypot(dx, dy) || 1;
    const spot = { x: target.x + (dx / d) * away, y: target.y + (dy / d) * away };
    if (Math.hypot(cup.x - target.x, cup.y - target.y) > DWELL_RADIUS * 2.6) sp.retreating = false;
    return spot;
  }
  return aimFor(target, cup);
}
