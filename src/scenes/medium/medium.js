import {
  bindGuardedResize, prefersReducedMotion, onReducedMotionChange, parseHTML,
  createFrameClock, claimContainer,
} from '../../utils/sceneKit.js';
import {
  DWELL_RADIUS, DWELL_TIME, DWELL_EASE, DWELL_RESIST,
  createCup, stepCup, createWander, stepWander,
  createVisitor, stepVisitor,
  createDwell, stepDwell, clearDwellMemory,
} from './medium.physics.js';
import { createReader, decayReader, weightOf, takeMark } from './medium.lexicon.js';
import { LETTER_ARCS, MARKS, BOARD_HOME, CARD } from './medium.text.js';
import mediumHtml from './medium.html?raw';
import './medium.css';


const CUP_R = DWELL_RADIUS * 1.06;

const FLASH_TIME = 1.25;

const HUSH_TIME = 2.6;

const TAPE_MAX = 96;

export function createMedium(container, { preview = false, initialArg = null, onStateChange = null } = {}) {
  let disposed = false;
  let titleEl = null, hintEl = null;

  const clock = createFrameClock();
  const uiClock = createFrameClock();
  let reduced = prefersReducedMotion();

  const parseSeed = (str) => {
    const n = Number.parseInt(String(str ?? '').replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const freshSeed = () => (((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) & 0x7fffffff) || 1);
  let seed = preview ? 611853 : (parseSeed(initialArg) ?? freshSeed());

  const claim = claimContainer(container, {
    position: 'relative', overflow: 'hidden',
    cursor: preview ? undefined : 'crosshair',
    tabIndex: preview ? undefined : 0,
  });
  container.classList.add('medium-scene');

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.dataset.frames = '0';
  container.appendChild(canvas);
  const ctx2d = canvas.getContext('2d', { alpha: false });

  const dpr = () => Math.min(2, window.devicePixelRatio || 1);

  const TAPE_BAND = 54;              // CSS px reserved under the card for the tape
  const TITLE_RESERVE = 104;         // CSS px for the title at the foot of the page
  const CARD_W = CARD.x1 - CARD.x0, CARD_H = CARD.y1 - CARD.y0;
  let W = 0, H = 0, side = 0, ox = 0, oy = 0, tapeY = 0;

  function layout() {
    const cw = container.clientWidth || window.innerWidth;
    const ch = container.clientHeight || window.innerHeight;
    const r = dpr();
    W = Math.max(1, Math.round(cw * r));
    H = Math.max(1, Math.round(ch * r));
    canvas.width = W; canvas.height = H;

    if (preview) {
      side = Math.max(W / CARD_W, H / CARD_H) * 1.06;
      ox = W / 2 - (CARD.x0 + CARD_W / 2) * side;
      oy = H / 2 - (CARD.y0 + CARD_H / 2) * side;
      tapeY = 0;
      return;
    }

    const cb = container.getBoundingClientRect();
    const toDevice = (clientY) => (clientY - cb.top) * (H / Math.max(1, cb.height));
    let ceiling = 0;
    if (hintEl) {
      const hb = hintEl.getBoundingClientRect();
      if (hb.height) ceiling = Math.max(ceiling, toDevice(hb.bottom) + 14 * r);
    }
    const band = TAPE_BAND * r;
    const floor = H - TITLE_RESERVE * r;
    const availH = Math.max(1, floor - ceiling);
    side = Math.max(1, Math.min((W * 0.97) / CARD_W, (availH - band) / CARD_H));

    const cardH = CARD_H * side;
    const top = ceiling + (availH - (cardH + band)) / 2;
    ox = W / 2 - (CARD.x0 + CARD_W / 2) * side;
    oy = top - CARD.y0 * side;
    tapeY = top + cardH + band * 0.5;
  }

  const bx = (x) => ox + x * side;
  const by = (y) => oy + y * side;
  const bs = (v) => v * side;                     // a board-space length, in pixels
  const toBoard = (px, py) => ({ x: (px - ox) / side, y: (py - oy) / side });

  let hand = createWander(seed);
  const cup = createCup(hand.x, hand.y);
  const dwell = createDwell();
  let reader = createReader();

  const visitor = createVisitor(BOARD_HOME.x, BOARD_HOME.y + 0.18);
  visitor.down = preview;

  const plaus = (mark) => weightOf(reader, mark);
  const dwellScale = (mark) => DWELL_RESIST + (DWELL_EASE - DWELL_RESIST) * plaus(mark);

  let tape = '';
  let flash = null;            // { mark, t } — the mark lit under the cup
  let hush = 0;                // seconds of stillness left after GOODBYE
  let handleAngle = -Math.PI / 2;
  let srPending = '';
  let srClock = 0;
  let frames = 0;

  const KEY_SPEED = 0.55;
  const held = new Set();

  function take(mark) {
    const added = takeMark(reader, mark);
    tape = mark.ch === 'GOODBYE' ? '' : (tape + added);
    if (mark.ch === 'GOODBYE') hush = HUSH_TIME;
    if (tape.length > TAPE_MAX) tape = tape.slice(-TAPE_MAX);
    flash = { mark, t: 0 };
    srPending += mark.kind === 'letter' ? mark.ch : ` ${mark.ch} `;
  }

  const SR_EVERY = 3.4;
  let srLiveEl = null;
  function announce(udt) {
    srClock += udt;
    if (srClock < SR_EVERY) return;
    srClock = 0;
    if (!srLiveEl || !srPending) return;
    srLiveEl.textContent = `spelled ${srPending.trim().split('').join(' ')}`;
    srPending = '';
  }

  function step(dt, udt) {
    if (hush > 0) hush = Math.max(0, hush - udt);


    if (held.size) {
      const d = KEY_SPEED * dt;
      if (held.has('ArrowLeft')) visitor.x -= d;
      if (held.has('ArrowRight')) visitor.x += d;
      if (held.has('ArrowUp')) visitor.y -= d;
      if (held.has('ArrowDown')) visitor.y += d;
      visitor.x = Math.min(0.95, Math.max(0.05, visitor.x));
      visitor.y = Math.min(0.95, Math.max(0.05, visitor.y));
    }

    decayReader(reader, dt);

    const contact = visitor.down;
    const partner = (contact && !reduced && hush <= 0) ? stepWander(hand, dt, cup, MARKS, plaus, visitor.grip) : null;
    stepCup(cup, dt, stepVisitor(visitor, cup, dt), partner);

    clearDwellMemory(dwell, cup);
    const got = contact ? stepDwell(dwell, cup, MARKS, dt, dwellScale) : null;
    if (got) take(got);

    if (flash) { flash.t += udt; if (flash.t >= FLASH_TIME) flash = null; }
    announce(udt);

    const sp = Math.hypot(cup.vx, cup.vy);
    if (sp > 0.02) {
      const want = Math.atan2(cup.vy, cup.vx) + Math.PI;   // trailing, not leading
      let d = want - handleAngle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      handleAngle += d * Math.min(1, dt * 4.5);
    }
  }

  const INK = '#2b2119';
  const INK_SOFT = 'rgba(43, 33, 25, 0.72)';
  const CARD_FILL = '#d9cdb4';
  const CARD_EDGE = '#b9a988';
  const VOID = '#0a0a0c';

  function measureTracked(str, track) {
    let total = 0;
    for (const ch of str) total += ctx2d.measureText(ch).width + track;
    return Math.max(0, total - track);
  }

  function fillTracked(str, cx, cy, track) {
    let total = 0;
    const widths = [];
    for (const ch of str) { const w = ctx2d.measureText(ch).width; widths.push(w); total += w + track; }
    total -= track;                              // no trailing gap: see STANDARDS.md's centering rule
    let x = cx - total / 2;
    let i = 0;
    for (const ch of str) {
      ctx2d.fillText(ch, x + widths[i] / 2, cy);
      x += widths[i] + track; i++;
    }
  }

  function cardPath(x, y, w, h, r) {
    ctx2d.beginPath();
    if (ctx2d.roundRect) { ctx2d.roundRect(x, y, w, h, r); return; }
    ctx2d.moveTo(x + r, y);
    ctx2d.arcTo(x + w, y, x + w, y + h, r);
    ctx2d.arcTo(x + w, y + h, x, y + h, r);
    ctx2d.arcTo(x, y + h, x, y, r);
    ctx2d.arcTo(x, y, x + w, y, r);
    ctx2d.closePath();
  }

  function markFont(scale = 1) {
    return `${Math.round(bs(0.042) * scale)}px Arapey, Georgia, serif`;
  }

  function drawCard() {
    const x = bx(CARD.x0), y = by(CARD.y0);
    const w = bs(CARD.x1 - CARD.x0), h = bs(CARD.y1 - CARD.y0);
    const r = bs(0.028);
    cardPath(x, y, w, h, r);
    ctx2d.fillStyle = CARD_FILL;
    ctx2d.fill();
    ctx2d.lineWidth = Math.max(1, bs(0.004));
    ctx2d.strokeStyle = CARD_EDGE;
    ctx2d.stroke();
    cardPath(x + bs(0.014), y + bs(0.014), w - bs(0.028), h - bs(0.028), r * 0.7);
    ctx2d.lineWidth = Math.max(1, bs(0.0018));
    ctx2d.strokeStyle = 'rgba(43, 33, 25, 0.35)';
    ctx2d.stroke();
  }

  function drawArcRules() {
    ctx2d.lineWidth = Math.max(1, bs(0.0015));
    ctx2d.strokeStyle = 'rgba(43, 33, 25, 0.22)';
    for (const arc of LETTER_ARCS) {
      ctx2d.beginPath();
      arc.forEach((l, i) => {
        const px = bx(l.x), py = by(l.y + 0.035);
        if (i === 0) ctx2d.moveTo(px, py); else ctx2d.lineTo(px, py);
      });
      ctx2d.stroke();
    }
  }

  function drawMarks() {
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';

    const cand = dwell.on;
    const prog = cand && visitor.down
      ? Math.min(1, dwell.held / Math.max(1e-6, DWELL_TIME * dwellScale(cand)))
      : 0;

    for (const m of MARKS) {
      const lit = flash && flash.mark === m
        ? 1 - flash.t / FLASH_TIME
        : (m === cand ? prog * 0.6 : 0);
      const word = m.kind === 'word';
      const track = word ? bs(0.010) : 0;
      ctx2d.font = word
        ? `${Math.round(bs(0.030))}px Arapey, Georgia, serif`
        : markFont(m.kind === 'digit' ? 0.78 : m.kind === 'punct' ? 1.35 : 1);
      if (lit > 0) {
        ctx2d.save();
        ctx2d.shadowColor = `rgba(196, 122, 58, ${0.85 * lit})`;
        ctx2d.shadowBlur = bs(0.05) * lit;
        ctx2d.fillStyle = `rgb(${Math.round(43 + 130 * lit)}, ${Math.round(33 + 60 * lit)}, ${Math.round(25 + 20 * lit)})`;
        fillTracked(m.ch, bx(m.x), by(m.y), track);
        ctx2d.restore();
      } else {
        ctx2d.fillStyle = m.kind === 'letter' ? INK : INK_SOFT;
        fillTracked(m.ch, bx(m.x), by(m.y), track);
      }
    }
  }

  function drawFinger(px, py, fromTop, alpha) {
    const r = bs(0.030);
    const dir = fromTop ? -1 : 1;
    const reach = bs(0.105);
    ctx2d.save();
    ctx2d.globalAlpha = alpha;
    ctx2d.filter = `blur(${Math.max(1, bs(0.006))}px)`;

    const g = ctx2d.createLinearGradient(px, py, px, py + dir * reach);
    g.addColorStop(0, 'rgba(26, 20, 16, 0.34)');
    g.addColorStop(1, 'rgba(26, 20, 16, 0)');
    ctx2d.fillStyle = g;
    ctx2d.beginPath();
    ctx2d.moveTo(px - r * 0.86, py);
    ctx2d.quadraticCurveTo(px - r * 1.22, py + dir * reach * 0.55, px - r * 1.12, py + dir * reach);
    ctx2d.lineTo(px + r * 1.12, py + dir * reach);
    ctx2d.quadraticCurveTo(px + r * 1.22, py + dir * reach * 0.55, px + r * 0.86, py);
    ctx2d.closePath();
    ctx2d.fill();

    ctx2d.beginPath();
    ctx2d.ellipse(px, py, r * 0.88, r * 1.06, 0, 0, Math.PI * 2);
    ctx2d.fillStyle = 'rgba(22, 17, 13, 0.42)';
    ctx2d.fill();
    ctx2d.restore();
  }

  function drawCup() {
    const px = bx(cup.x), py = by(cup.y), r = bs(CUP_R);

    ctx2d.save();
    ctx2d.globalAlpha = 0.40;
    ctx2d.filter = `blur(${Math.max(1, bs(0.010))}px)`;
    ctx2d.beginPath();
    ctx2d.ellipse(px + r * 0.14, py + r * 0.36, r * 1.06, r * 1.0, 0, 0, Math.PI * 2);
    ctx2d.fillStyle = '#000';
    ctx2d.fill();
    ctx2d.restore();

    ctx2d.save();
    ctx2d.translate(px, py);
    ctx2d.rotate(handleAngle);
    ctx2d.beginPath();
    ctx2d.arc(r * 1.02, 0, r * 0.40, -Math.PI * 0.62, Math.PI * 0.62);
    ctx2d.lineWidth = r * 0.20;
    ctx2d.lineCap = 'round';
    ctx2d.strokeStyle = 'rgba(247, 246, 242, 0.97)';
    ctx2d.stroke();
    ctx2d.lineWidth = r * 0.06;
    ctx2d.strokeStyle = 'rgba(74, 98, 138, 0.30)';
    ctx2d.stroke();
    ctx2d.restore();

    ctx2d.beginPath();
    ctx2d.arc(px, py, r, 0, Math.PI * 2);
    ctx2d.fillStyle = 'rgba(250, 250, 247, 0.62)';
    ctx2d.fill();
    ctx2d.lineWidth = Math.max(1, bs(0.0055));
    ctx2d.strokeStyle = 'rgba(255, 255, 253, 0.98)';
    ctx2d.stroke();
    ctx2d.beginPath();
    ctx2d.arc(px, py, r * 0.88, Math.PI * 1.06, Math.PI * 1.62);
    ctx2d.lineWidth = Math.max(1, bs(0.006));
    ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx2d.stroke();

    ctx2d.beginPath();
    ctx2d.arc(px, py, r * 0.80, 0, Math.PI * 2);
    ctx2d.lineWidth = Math.max(1, bs(0.0026));
    ctx2d.strokeStyle = 'rgba(74, 98, 138, 0.5)';
    ctx2d.stroke();
  }

  function drawTape() {
    if (preview || !tape) return;
    ctx2d.save();
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    const size = Math.max(9 * dpr(), Math.min(bs(0.030), 22 * dpr()));
    ctx2d.font = `${Math.round(size)}px Arapey, Georgia, serif`;
    const track = size * 0.34;
    const per = ctx2d.measureText('M').width + track;
    const room = bs(CARD.x1 - CARD.x0) * 0.98;
    const fits = Math.max(6, Math.floor(room / Math.max(1, per)));
    const shown = tape.slice(-fits);
    const width = measureTracked(shown, track);
    ctx2d.fillStyle = 'rgba(226, 214, 192, 0.78)';
    fillTracked(shown, bx(CARD.x1) - width / 2, tapeY, track);
    ctx2d.restore();
  }

  function draw() {
    ctx2d.fillStyle = VOID;
    ctx2d.fillRect(0, 0, W, H);
    drawCard();
    drawArcRules();
    drawMarks();
    drawCup();
    if (!reduced && hush <= 0 && hand.x != null) {
      drawFinger(bx(hand.x), by(hand.y), true, 0.92);
    }
    if (visitor.down) drawFinger(bx(visitor.px), by(visitor.py), false, 1);
    drawTape();

    frames++;
    if ((frames & (frames - 1)) === 0) canvas.dataset.frames = String(frames);
  }

  let animId = null, paused = false;
  function animate() {
    animId = requestAnimationFrame(animate);
    if (disposed) return;
    const udt = uiClock.tick();
    const dt = reduced ? udt : clock.tick();
    step(dt, udt);
    draw();
  }

  const PRESS_R = CUP_R * 2.6;

  let pointerId = null;
  function pointFrom(e) {
    const rect = canvas.getBoundingClientRect();
    return toBoard((e.clientX - rect.left) * (W / rect.width), (e.clientY - rect.top) * (H / rect.height));
  }
  function onPointerDown(e) {
    if (preview) return;
    const p = pointFrom(e);
    if (Math.hypot(p.x - cup.x, p.y - cup.y) > PRESS_R) return;
    pointerId = e.pointerId;
    visitor.x = p.x; visitor.y = p.y; visitor.down = true;
    visitor.sx = p.x; visitor.sy = p.y; visitor.ax = p.x; visitor.ay = p.y;
    visitor.fx = p.x; visitor.fy = p.y; visitor.lx = p.x; visitor.ly = p.y; visitor.grip = 1;
    canvas.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (preview || !visitor.down || e.pointerId !== pointerId) return;
    const p = pointFrom(e);
    visitor.x = p.x; visitor.y = p.y;
  }
  function onPointerUp(e) {
    if (preview || e.pointerId !== pointerId) return;
    visitor.down = false;
    pointerId = null;
    canvas.releasePointerCapture?.(e.pointerId);
  }

  function onKeyDown(e) {
    if (preview) return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (!visitor.down) {
        visitor.x = cup.x; visitor.y = cup.y;
        visitor.sx = cup.x; visitor.sy = cup.y;
        visitor.ax = cup.x; visitor.ay = cup.y;
        visitor.fx = cup.x; visitor.fy = cup.y;
        visitor.lx = cup.x; visitor.ly = cup.y; visitor.grip = 0;
      }
      visitor.down = !visitor.down;
      e.preventDefault();
      return;
    }
    if (/^Arrow(Up|Down|Left|Right)$/.test(e.key)) { held.add(e.key); e.preventDefault(); }
  }
  function onKeyUp(e) { held.delete(e.key); }
  function onBlur() { held.clear(); }

  const reducedWatch = onReducedMotionChange(next => {
    reduced = next;
    clock.resync();
  });

  const resize = bindGuardedResize(container, () => { layout(); if (paused) draw(); });

  if (!preview) {
    const frag = parseHTML(mediumHtml);
    titleEl = frag.querySelector('.medium-title-row');
    hintEl = frag.querySelector('.medium-hint');
    srLiveEl = frag.querySelector('.medium-sr-live');
    document.body.append(titleEl, hintEl);
    container.appendChild(srLiveEl);

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    container.addEventListener('keydown', onKeyDown);
    container.addEventListener('keyup', onKeyUp);
    container.addEventListener('blur', onBlur);
    onStateChange?.(String(seed));
  }

  layout();

  animate();

  return {
    applyArg(str) {
      const next = parseSeed(str);
      if (!next || next === seed) return;
      seed = next;
      hand = createWander(seed);
      cup.x = hand.x; cup.y = hand.y; cup.vx = 0; cup.vy = 0; cup.resting = true;
      reader = createReader();
      tape = ''; flash = null; hush = 0;
    },
    setPaused(next) {
      if (next === paused) return;
      paused = next;
      if (paused) {
        if (animId !== null) { cancelAnimationFrame(animId); animId = null; }
      } else {
        clock.resync(); uiClock.resync();
        if (animId === null) animate();
      }
    },
    dispose() {
      disposed = true;
      if (animId !== null) cancelAnimationFrame(animId);
      resize.dispose();
      reducedWatch.dispose();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      container.removeEventListener('keydown', onKeyDown);
      container.removeEventListener('keyup', onKeyUp);
      container.removeEventListener('blur', onBlur);
      held.clear();
      titleEl?.remove(); hintEl?.remove(); srLiveEl?.remove();
      srLiveEl = null;
      container.classList.remove('medium-scene');
      claim.restore();
      container.innerHTML = '';
    },
  };
}
