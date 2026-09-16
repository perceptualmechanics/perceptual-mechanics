
export const CUP = {
  mass: 1.0,
  handStiffness: 26,
  visitorStiffness: 78,
  handDamping: 3.4,
  kineticFriction: 0.72,
  staticFriction: 1.25,
  restSpeed: 0.012,
  maxSpeed: 2.2,
};

export const PARTNER_FORCE = 1.9;

export const LEAN_MAX = 0.075;

export const LEAN_GRIP = 0.085;

export function holdOnCup(hand, cup, max = LEAN_MAX) {
  const dx = hand.x - cup.x, dy = hand.y - cup.y;
  const d = Math.hypot(dx, dy);
  if (d <= max || d === 0) return hand;
  hand.x = cup.x + (dx / d) * max;
  hand.y = cup.y + (dy / d) * max;
  const out = (hand.vx * dx + hand.vy * dy) / d;
  if (out > 0) { hand.vx -= out * (dx / d); hand.vy -= out * (dy / d); }
  return hand;
}
export const PARTNER_HAND_SPEED = 0.6;

export const DWELL_RADIUS = 0.048;
export const DWELL_SPEED = 0.09;
export const DWELL_TIME = 0.55;

export const DWELL_EASE = 0.5;
export const DWELL_RESIST = 4.0;

export const BURST_MIN = 0.2;
export const BURST_VAR = 0.45;
export const PAUSE_MIN = 0.3;
export const PAUSE_VAR = 0.7;
export const STOP_DAMP = 9;

export const LEAN_SPRING = 26;
export const BRACE = 26;

export const TEMPO_FULL = 0.30;    // cup speed, board units/s, that means full energy
export const TEMPO_FLOOR = 0.20;   // what a motionless pair keeps
export const TEMPO_EASE = 1.7;     // per second — how fast the other hand matches
export const EDGE_LEAN = 40;

export const WANDER_SIGMA = 2.5;     // impulse strength, board units/s^1.5
export const WANDER_DAMP = 2.0;      // how fast an impulse dies, per second
export const WANDER_BOUNDS = { x0: 0.07, y0: 0.15, x1: 0.93, y1: 0.755 };

export const WANDER_START = { x0: 0.16, y0: 0.21, x1: 0.84, y1: 0.52 };

export const FIELD_PULL = 12;
export const FIELD_RANGE = 0.28;

export function createCup(x = 0.5, y = 0.62) {
  return { x, y, vx: 0, vy: 0, resting: true };
}

export function stepCup(cup, dt, visitor, partner) {
  let fx = 0, fy = 0;

  if (visitor) {
    const sx = (visitor.x - cup.x) * CUP.visitorStiffness - cup.vx * CUP.handDamping;
    const sy = (visitor.y - cup.y) * CUP.visitorStiffness - cup.vy * CUP.handDamping;
    fx += sx; fy += sy;
  }
  if (partner) {
    let sx = (partner.x - cup.x) * CUP.handStiffness - cup.vx * CUP.handDamping;
    let sy = (partner.y - cup.y) * CUP.handStiffness - cup.vy * CUP.handDamping;
    const mag = Math.hypot(sx, sy);
    if (mag > PARTNER_FORCE) { sx = (sx / mag) * PARTNER_FORCE; sy = (sy / mag) * PARTNER_FORCE; }
    fx += sx; fy += sy;
  }

  const speed = Math.hypot(cup.vx, cup.vy);
  const applied = Math.hypot(fx, fy);

  if (cup.resting && applied < CUP.staticFriction) {
    cup.vx = 0; cup.vy = 0;
    return;
  }
  cup.resting = false;

  let ax = fx / CUP.mass, ay = fy / CUP.mass;

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
}

export const RELAX = 18;

export const DRIVE_SPEED = 0.22;    // pointer speed, board units/s, that means grip 1
export const GRIP_ATTACK = 22;      // per second, tightening
export const GRIP_RELEASE = 0.6;    // per second, letting go — slow, and see medium-feel's override test

export const HAND_DRIFT = 0.013;

export const POINTER_EASE = 14;    // per second, cleaning filter
export const REF_EASE = 5;         // per second, the trailing reference
export const DRIVE_EPS = 0.004;

export function createVisitor(x, y) {
  return {
    x, y, sx: x, sy: y, ax: x, ay: y, px: x, py: y,
    fx: x, fy: y, lx: x, ly: y, grip: 0, t: 0, down: false,
  };
}

export function stepVisitor(v, cup, dt) {
  if (!v.down) return null;
  v.t += dt;

  const fk = Math.min(1, POINTER_EASE * dt);
  v.fx += (v.x - v.fx) * fk;
  v.fy += (v.y - v.fy) * fk;
  const rk = Math.min(1, REF_EASE * dt);
  v.lx += (v.fx - v.lx) * rk;
  v.ly += (v.fy - v.ly) * rk;
  const lag = Math.hypot(v.fx - v.lx, v.fy - v.ly);
  const speed = lag > DRIVE_EPS ? lag * REF_EASE : 0;

  const want = Math.min(1, speed / DRIVE_SPEED);
  const rate = want > v.grip ? GRIP_ATTACK : GRIP_RELEASE;
  v.grip += (want - v.grip) * Math.min(1, rate * dt);

  const k = Math.min(1, RELAX * dt);
  v.sx += (cup.x - v.sx) * k;
  v.sy += (cup.y - v.sy) * k;

  v.ax = v.sx + (v.x - v.sx) * v.grip;
  v.ay = v.sy + (v.y - v.sy) * v.grip;

  const drift = HAND_DRIFT * (1 - v.grip);
  const p = {
    x: v.ax + Math.sin(v.t * 0.61) * drift,
    y: v.ay + Math.cos(v.t * 0.43) * drift,
    vx: 0, vy: 0,
  };
  holdOnCup(p, cup, LEAN_MAX + v.grip * LEAN_GRIP);
  v.px = p.x; v.py = p.y;
  return p;
}

export function createDwell() {
  return { on: null, held: 0, last: null };
}

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
    if (d.last === near) return null;
    d.last = near;
    return near;
  }
  return null;
}

export function clearDwellMemory(d, cup) {
  if (d.last && Math.hypot(d.last.x - cup.x, d.last.y - cup.y) > DWELL_RADIUS * 2.2) d.last = null;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createWander(seed = 0x5EA9CE) {
  const rnd = mulberry32(seed);
  const S = WANDER_START;
  return {
    x: S.x0 + rnd() * (S.x1 - S.x0), y: S.y0 + rnd() * (S.y1 - S.y0),
    ox: 0, oy: 0, vx: 0, vy: 0,
    tempo: 0,
    moving: false, left: PAUSE_MIN + rnd() * PAUSE_VAR, rnd,
  };
}

export function stepWander(w, dt, cup, letters, weightOf, hold = 0) {
  const R = w.rnd;

  const free = 1 - Math.min(1, hold);

  const speed = Math.hypot(cup.vx, cup.vy);
  w.tempo += (speed - w.tempo) * Math.min(1, TEMPO_EASE * dt);
  const energy = TEMPO_FLOOR + (1 - TEMPO_FLOOR) * Math.min(1, w.tempo / TEMPO_FULL);
  const brace = BRACE * Math.min(1, hold);

  const pace = 1 / (0.45 + 0.55 * energy);
  w.left -= dt;
  if (w.left <= 0) {
    w.moving = !w.moving;
    w.left = (w.moving ? BURST_MIN + R() * BURST_VAR : PAUSE_MIN + R() * PAUSE_VAR) * pace;
  }

  if (w.moving) {
    const g = () => (R() + R() + R() - 1.5) * 2;
    const k = WANDER_SIGMA * Math.sqrt(dt) * energy;
    w.vx += g() * k; w.vy += g() * k;
  }
  const stop = w.moving ? 0 : STOP_DAMP;
  w.vx -= w.vx * (WANDER_DAMP + brace + stop) * dt;
  w.vy -= w.vy * (WANDER_DAMP + brace + stop) * dt;

  if (weightOf && letters) {
    let gx = 0, gy = 0, gw = 0;
    for (const l of letters) {
      const dx = l.x - cup.x, dy = l.y - cup.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const wt = weightOf(l) * Math.exp(-d / FIELD_RANGE);
      gx += (dx / d) * wt; gy += (dy / d) * wt; gw += wt;
    }
    if (gw > 0) { w.vx += (gx / gw) * FIELD_PULL * free * dt; w.vy += (gy / gw) * FIELD_PULL * free * dt; }
  }

  const B = WANDER_BOUNDS;
  const back = (v, lo, hi) => (v < lo ? lo - v : v > hi ? hi - v : 0);
  w.vx += back(cup.x, B.x0, B.x1) * EDGE_LEAN * dt;
  w.vy += back(cup.y, B.y0, B.y1) * EDGE_LEAN * dt;

  w.vx -= w.ox * LEAN_SPRING * dt;
  w.vy -= w.oy * LEAN_SPRING * dt;

  const sp = Math.hypot(w.vx, w.vy);
  if (sp > PARTNER_HAND_SPEED) { w.vx = (w.vx / sp) * PARTNER_HAND_SPEED; w.vy = (w.vy / sp) * PARTNER_HAND_SPEED; }
  w.ox += w.vx * dt; w.oy += w.vy * dt;

  const od = Math.hypot(w.ox, w.oy);
  if (od > LEAN_MAX) {
    w.ox = (w.ox / od) * LEAN_MAX; w.oy = (w.oy / od) * LEAN_MAX;
    const out = (w.vx * w.ox + w.vy * w.oy) / LEAN_MAX;
    if (out > 0) { w.vx -= out * (w.ox / LEAN_MAX); w.vy -= out * (w.oy / LEAN_MAX); }
  }

  w.x = cup.x + w.ox; w.y = cup.y + w.oy;
  return w;
}
