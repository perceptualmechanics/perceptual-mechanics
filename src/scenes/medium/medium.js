import {
  bindGuardedResize, prefersReducedMotion, onReducedMotionChange, parseHTML,
  createFrameClock, claimContainer,
} from '../../utils/sceneKit.js';
import {
  DWELL_RADIUS, DWELL_EASE, DWELL_RESIST,
  createCup, stepCup, createWander, stepWander,
  createDwell, stepDwell, clearDwellMemory,
} from './medium.physics.js';
import { createReader, decayReader, weightOf, takeMark } from './medium.lexicon.js';
import { LETTER_ARCS, MARKS, BOARD_HOME, EPIGRAPH } from './medium.text.js';
import mediumHtml from './medium.html?raw';
import './medium.css';

// ─── Medium — a Ouija board that can spell ─────────────────────────────────
// Thirteenth scene, 2026-09-04. A homemade board seen from above, an
// upside-down willowware teacup on it, and two pairs of fingertips: yours, and
// somebody else's. Press and the cup follows your finger. Let go and it keeps
// moving. Either way letters land, and the tape at the bottom fills up.
//
// This file DRAWS. It decides nothing. `medium.physics.js` is the cup and the
// two hands and is pure; `medium.lexicon.js` is the only thing that knows any
// English; `medium.text.js` is the board's geometry and is shared with the
// build, so /text/medium/ and this scene cannot lay the board out differently.
// The reasoning for all three lives in those files and is not repeated here.
//
// ─── The one thing worth restating ─────────────────────────────────────────
// **Nothing holds what the board is going to say.** There is no queue, no
// script, no sentence in a variable. The other hand wanders and leans toward
// letters that would plausibly continue what has already been spelled — all
// twenty-six at once, weighted, never one chosen — and a letter lands when the
// cup comes to rest on it. What comes out is genuinely produced by the pair,
// which is what the ideomotor literature says happens at a real board, and it
// is why a visitor who drives gets nothing and a visitor who rests gets
// sentences.
//
// ─── No beginning and no end ───────────────────────────────────────────────
// Scott's rule, and it shapes the whole scene: there is no session. The board
// is already going when you arrive and does not stop when you let go. Nothing
// here opens, closes, resets, times out, or congratulates. GOODBYE is on the
// board because a board has one, it sits below the other hand's reach so only
// a visitor can take it, and taking it clears the tape and stills the other
// hand for a moment — and then it starts again, because it always does.
//
// ─── Why 2D canvas ─────────────────────────────────────────────────────────
// The same reason Apollo is: a thirteenth WebGL scene would be a thirteenth
// permanent preview context against a browser cap near sixteen, and this scene
// draws a card, some lettering and a teacup. There is no geometry and no
// camera. A 2D context does all of it, stays off the WebGL budget, and clips
// normally in the round tile without the mountClippedPreviewCanvas blit.
//
// ─── No sound ──────────────────────────────────────────────────────────────
// Deliberate, and the one place this scene departs from its neighbours. The
// subject is a resistance you feel through your fingertips, and the brief says
// a mimicked one "will feel wrong in a way nobody can name." A synthesised
// scrape is exactly that mimicry, one sense over: it would be a sound effect
// standing in for the thing the physics is already doing honestly. The cup is
// silent, which is also what a cup on felt very nearly is.
//
// ─── Frame-rate independence ───────────────────────────────────────────────
// createFrameClock, and every rate in the physics is per-second and integrated
// against dt there. This file adds three of its own — the letter flash, the
// GOODBYE hush and the handle's ease toward its heading — and all three are
// accumulators against dt rather than per-frame decrements. No loop here
// decides how many things to do this frame; every one is a traversal of a
// fixed population (the marks, the two arcs, the tape's visible tail), which
// is the kind STANDARDS.md calls fine.

// The teacup, in board units. Sized against DWELL_RADIUS on purpose: the cup's
// rim is what a visitor aims, so the thing they can see has to be the thing the
// dwell test is using. A cup drawn smaller than its own catchment would take
// letters it was visibly not on.
const CUP_R = DWELL_RADIUS * 1.06;

// How long a taken mark stays lit under the cup, in seconds. Long enough to
// read through the china, short enough that two letters in a row do not smear.
const FLASH_TIME = 1.25;

// How long the other hand rests after GOODBYE. Not an ending — see the header.
const HUSH_TIME = 2.6;

// The tape keeps this many characters. It is a tape, not a transcript: the
// early part scrolls off, the way it would if somebody were writing it down on
// a strip of paper and you were reading the near end.
const TAPE_MAX = 96;

export function createMedium(container, { preview = false, initialArg = null, onStateChange = null } = {}) {
  let disposed = false;
  let titleEl = null, hintEl = null, placardEl = null;

  // Two clocks, the split Apollo and Outside use. `clock` is the motion clock
  // and it stops under reduced motion, which is what stills the other hand.
  // `uiClock` always runs, because the letter flash is a response to something
  // that happened and a flash that cannot end is a mark stuck on the board.
  const clock = createFrameClock();
  const uiClock = createFrameClock();
  let reduced = prefersReducedMotion();

  // ─── The seed ─────────────────────────────────────────────────────────────
  // The other hand's wander is seeded, so a séance can be linked to:
  // `#medium/8134` replays the same hand. It replays the same TAPE only if
  // nobody touches the cup, which is the honest version of a shareable link
  // here — the moment a visitor puts a finger down they are in it, and the
  // board says something else. Stated rather than hidden, because a link that
  // silently means something different for the person who follows it is worse
  // than no link.
  const parseSeed = (str) => {
    const n = Number.parseInt(String(str ?? '').replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  // A fixed seed in the tile so the thumbnail is the same board every load and
  // can be looked at twice; a fresh one in the scene, because a séance that
  // said the same thing to everybody would be a recording.
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

  // Capped at 2, the same cap manageRenderer applies to every WebGL scene here.
  const dpr = () => Math.min(2, window.devicePixelRatio || 1);

  // ─── Layout ───────────────────────────────────────────────────────────────
  // The board is a square object on a table, so it is fitted as a square and
  // centred. Board coordinates are 0..1 and `bx`/`by` are the only mapping
  // between them and pixels — nothing below computes a pixel position any
  // other way.
  //
  // ─── The ceiling and the floor are ASKED FOR, not assumed ─────────────────
  // The card is pale and the chrome is not, so anything the chrome overlaps is
  // chrome nobody can read: the hint is white at 60% and disappears the moment
  // it crosses the board, and a dark panel over aged card composites to a grey
  // its own text does not clear. Reserving a fixed number of pixels top and
  // bottom is exactly the mistake this project keeps relearning — Apollo's
  // wavelength scale spent a release behind the fader rail because 66px had
  // been measured once, on a desktop — so this asks the DOM where the hint
  // actually ends and where the placard actually begins, on every relayout, and
  // fits the board between them. On a phone the hint is two lines and the
  // placard is five, and the board gets what is left.
  const TAPE_BAND = 54;              // CSS px reserved under the card for the tape
  const TITLE_RESERVE = 104;         // CSS px for the title, if there is no placard to measure
  let W = 0, H = 0, side = 0, ox = 0, oy = 0, tapeY = 0;

  function layout() {
    const cw = container.clientWidth || window.innerWidth;
    const ch = container.clientHeight || window.innerHeight;
    const r = dpr();
    W = Math.max(1, Math.round(cw * r));
    H = Math.max(1, Math.round(ch * r));
    canvas.width = W; canvas.height = H;

    if (preview) {
      // Overfilled, because the tile is a circle cut out of a square and the
      // board's corners are empty anyway. The arcs reach the edge and the
      // silhouette — two curves of lettering with something sitting on one of
      // them — is what makes a 200px tile recognisable as a board.
      side = Math.min(W, H) * 1.34;
      ox = (W - side) / 2; oy = (H - side) / 2;
      tapeY = 0;
      return;
    }

    const cb = container.getBoundingClientRect();
    const toDevice = (clientY) => (clientY - cb.top) * (H / Math.max(1, cb.height));
    let ceiling = 0;
    let floor = H - TITLE_RESERVE * r;
    if (hintEl) {
      const hb = hintEl.getBoundingClientRect();
      if (hb.height) ceiling = Math.max(ceiling, toDevice(hb.bottom) + 14 * r);
    }
    const band = TAPE_BAND * r;

    // ─── The placard only lowers the floor if it is in the way ──────────────
    // It is a narrow panel in the bottom-left corner on a desktop and a
    // full-width one on a phone, and those are two different situations. The
    // test is whether it sits under the MIDDLE of the viewport, because that is
    // where the tape is written and the tape is the thing that must not land on
    // top of the placard's prose. On a desktop it does not, and letting it set
    // the floor anyway cost the board a third of its size to protect an empty
    // corner; on a phone it does, and the board has to give up the room.
    let underCentre = false;
    let pTop = H;
    if (placardEl) {
      const pb = placardEl.getBoundingClientRect();
      if (pb.height) {
        pTop = toDevice(pb.top);
        const pLeft = (pb.left - cb.left) * (W / Math.max(1, cb.width));
        const pRight = (pb.right - cb.left) * (W / Math.max(1, cb.width));
        underCentre = pLeft < W / 2 && pRight > W / 2;
      }
    }
    if (underCentre) floor = Math.min(floor, pTop - 14 * r);

    const avail = Math.max(1, floor - band - ceiling);
    side = Math.max(1, Math.min(W * 0.96, avail));
    ox = (W - side) / 2;
    oy = ceiling + (avail - side) / 2;

    // Centred in the gap that is actually left, between the bottom of the CARD
    // and the floor. Not `oy + side`: the card is inset inside the board's unit
    // square, so the unit square's bottom edge is 4.5% of a board below the
    // last thing anybody can see, and measuring from it put the tape inside the
    // placard on a 390px phone.
    tapeY = (oy + side * 0.955 + floor) / 2;
  }

  const bx = (x) => ox + x * side;
  const by = (y) => oy + y * side;
  const bs = (v) => v * side;                     // a board-space length, in pixels
  const toBoard = (px, py) => ({ x: (px - ox) / side, y: (py - oy) / side });

  // ─── The pair ─────────────────────────────────────────────────────────────
  // The other hand first, and the cup starts UNDER it rather than at the middle
  // of the board — which is where a cup with somebody's fingers already on it
  // would be. It also fixes something measurable: with the cup always starting
  // at the centre, every séance opened with the same two or three letters,
  // because the first thing that happens is always a stop near where it began.
  let hand = createWander(seed, BOARD_HOME.x, BOARD_HOME.y);
  const cup = createCup(hand.x, hand.y);
  const dwell = createDwell();
  let reader = createReader();

  // The visitor. `down` is contact: a finger resting on the cup, not a cursor
  // hovering over the board. Everything that separates this scene from a
  // dragging toy is in that distinction — you can move your hand around the
  // board all day without touching, and nothing happens, because nothing
  // should.
  const visitor = { x: BOARD_HOME.x, y: BOARD_HOME.y + 0.18, down: false };

  const plaus = (mark) => weightOf(reader, mark);
  const dwellScale = (mark) => DWELL_RESIST + (DWELL_EASE - DWELL_RESIST) * plaus(mark);

  // ─── The tape ─────────────────────────────────────────────────────────────
  let tape = '';
  let flash = null;            // { mark, t } — the mark lit under the cup
  let hush = 0;                // seconds of stillness left after GOODBYE
  let handleAngle = -Math.PI / 2;
  let srPending = '';
  let srClock = 0;
  let frames = 0;

  // Board units per second while an arrow key is held. Slower than the other
  // hand's top speed, because a finger that outran the cup would be dragging a
  // handle rather than leaning on a cup.
  const KEY_SPEED = 0.55;
  const held = new Set();

  function take(mark) {
    // The reader owns what the board knows: the live context, the fatigue, and
    // what a taken mark adds to the tape. GOODBYE returns an empty string and
    // clears its own context, which is why this can be four lines rather than a
    // switch that the build would then have to reimplement.
    const added = takeMark(reader, mark);
    tape = mark.ch === 'GOODBYE' ? '' : (tape + added);
    if (mark.ch === 'GOODBYE') hush = HUSH_TIME;
    if (tape.length > TAPE_MAX) tape = tape.slice(-TAPE_MAX);
    flash = { mark, t: 0 };
    srPending += mark.kind === 'letter' ? mark.ch : ` ${mark.ch} `;
  }

  // ─── Announcing ───────────────────────────────────────────────────────────
  // Batched, because a live region that fires on every letter reads a single
  // character out loud every few seconds forever, which is unusable. This says
  // what has accumulated, at a pace somebody can follow, and only when there is
  // something new.
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

  // ─── One step ─────────────────────────────────────────────────────────────
  function step(dt, udt) {
    if (hush > 0) hush = Math.max(0, hush - udt);

    // The arrow keys are a finger, not a cursor: they move the visitor's
    // fingertip and the cup follows it through the same spring everything else
    // goes through. Integrated here rather than in the key handler so a held
    // key travels at a rate per second instead of per keydown repeat, which is
    // an OS setting and not a frame rate.
    if (held.size) {
      const d = KEY_SPEED * dt;
      if (held.has('ArrowLeft')) visitor.x -= d;
      if (held.has('ArrowRight')) visitor.x += d;
      if (held.has('ArrowUp')) visitor.y -= d;
      if (held.has('ArrowDown')) visitor.y += d;
      // Bounded to the card, so a held key cannot walk the finger into the
      // margin and leave the cup stranded at the edge with nothing to do.
      visitor.x = Math.min(0.95, Math.max(0.05, visitor.x));
      visitor.y = Math.min(0.95, Math.max(0.05, visitor.y));
    }

    // Reduced motion stills the other hand and nothing else. The cup still
    // moves when the visitor moves it, letters are still taken, the tape still
    // fills — those are responses to something the visitor did, which is the
    // category prefers-reduced-motion is not about. What stops is the one thing
    // moving on its own, which here is also the one thing that is unsettling,
    // and that is the point of the setting rather than a compromise with it.
    decayReader(reader, dt);
    const partner = (reduced || hush > 0) ? null : stepWander(hand, dt, MARKS, plaus);
    const vis = visitor.down ? { x: visitor.x, y: visitor.y } : null;
    stepCup(cup, dt, vis, partner);

    clearDwellMemory(dwell, cup);
    const got = stepDwell(dwell, cup, MARKS, dt, dwellScale);
    if (got) take(got);

    if (flash) { flash.t += udt; if (flash.t >= FLASH_TIME) flash = null; }
    announce(udt);

    // The handle turns to trail the cup's motion, easing rather than snapping,
    // and holds its last heading when the cup stops. A handle that pointed
    // instantaneously at the velocity would spin on the spot every time the cup
    // came to rest, which is the one moment the scene most needs to be still.
    const sp = Math.hypot(cup.vx, cup.vy);
    if (sp > 0.02) {
      const want = Math.atan2(cup.vy, cup.vx) + Math.PI;   // trailing, not leading
      let d = want - handleAngle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      handleAngle += d * Math.min(1, dt * 4.5);
    }
  }

  // ─── Drawing ──────────────────────────────────────────────────────────────
  const INK = '#2b2119';
  const INK_SOFT = 'rgba(43, 33, 25, 0.55)';
  const CARD = '#d9cdb4';
  const CARD_EDGE = '#b9a988';
  const VOID = '#0a0a0c';

  // ─── Letter-spaced text, by hand ──────────────────────────────────────────
  // `ctx.letterSpacing` is the obvious way and is not available everywhere this
  // site is read — it landed in Firefox long after Chrome, and this project's
  // screenshots come from Firefox. Measuring and placing each glyph works in
  // every engine, costs one measureText per character on a string that is never
  // longer than the tape, and cannot silently render un-tracked on the one
  // browser nobody tested in.
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

  // roundRect is recent enough that a board on an older phone would throw
  // rather than lose a corner radius, which is a blank scene for a rounding.
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
    // The card. A rounded rectangle in aged paper, with a burnt edge that is
    // two strokes rather than a gradient — a gradient reads as a vignette and
    // this needs to read as an object with a border printed on it.
    const x = bx(0.045), y = by(0.04), w = bs(0.91), h = bs(0.915);
    const r = bs(0.035);
    cardPath(x, y, w, h, r);
    ctx2d.fillStyle = CARD;
    ctx2d.fill();
    ctx2d.lineWidth = Math.max(1, bs(0.004));
    ctx2d.strokeStyle = CARD_EDGE;
    ctx2d.stroke();
    cardPath(x + bs(0.018), y + bs(0.018), w - bs(0.036), h - bs(0.036), r * 0.7);
    ctx2d.lineWidth = Math.max(1, bs(0.0018));
    ctx2d.strokeStyle = 'rgba(43, 33, 25, 0.35)';
    ctx2d.stroke();
  }

  function drawArcRules() {
    // A hairline under each arc of letters, the way a hand-drawn board has a
    // pencil line the letters were set on. Drawn from the letters themselves,
    // so it cannot disagree with them.
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
    for (const m of MARKS) {
      const lit = flash && flash.mark === m ? 1 - flash.t / FLASH_TIME : 0;
      const word = m.kind === 'word';
      const track = word ? bs(0.010) : 0;
      // Punctuation is set LARGER than a letter, not smaller: a full stop is a
      // dot, and a dot set at the size of an A on a board this wide is a speck
      // of dust on the card. The glyph is small even when the type is not.
      ctx2d.font = word
        ? `${Math.round(bs(0.030))}px Arapey, Georgia, serif`
        : markFont(m.kind === 'digit' ? 0.78 : m.kind === 'punct' ? 1.35 : 1);
      if (lit > 0) {
        // The taken mark burns through the china rather than being circled.
        // A ring around a letter under a translucent cup is two shapes saying
        // the same thing; this is the one the cup was drawn translucent for.
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
    // ─── The hands are shadows ────────────────────────────────────────────────
    // Not drawn as skin, and that is a decision rather than a shortcut. Two of
    // them, in order:
    //
    // The practical one: a fingertip painted in any plausible skin tone is
    // within a few percent of the aged card it sits on, so it disappears. The
    // first version was, and it read as a smear of light on the board rather
    // than as a hand — the one thing in the scene that has to be legible at a
    // glance, illegible.
    //
    // The real one: a séance is lit from one side and low, and what you can
    // actually see of the other person's hand across a board in that light is
    // its shadow. Drawing the hands as shadows is what the scene looks like,
    // it puts the only bright thing on the screen on the china where it
    // belongs, and it means the scene does not have to pick a skin colour for
    // somebody it has deliberately declined to give a face.
    const r = bs(0.036);
    const dir = fromTop ? -1 : 1;
    const reach = bs(0.20);
    ctx2d.save();
    ctx2d.globalAlpha = alpha;
    ctx2d.filter = `blur(${Math.max(1, bs(0.006))}px)`;

    // The finger behind the tip, and it is SHORT — a hand seen from directly
    // above a table is almost entirely foreshortened, so what shows is a
    // fingertip and an inch of finger, not a column.
    const g = ctx2d.createLinearGradient(px, py, px, py + dir * reach);
    g.addColorStop(0, 'rgba(26, 20, 16, 0.38)');
    g.addColorStop(1, 'rgba(26, 20, 16, 0)');
    ctx2d.fillStyle = g;
    ctx2d.beginPath();
    ctx2d.moveTo(px - r * 0.86, py);
    ctx2d.quadraticCurveTo(px - r * 1.22, py + dir * reach * 0.55, px - r * 1.12, py + dir * reach);
    ctx2d.lineTo(px + r * 1.12, py + dir * reach);
    ctx2d.quadraticCurveTo(px + r * 1.22, py + dir * reach * 0.55, px + r * 0.86, py);
    ctx2d.closePath();
    ctx2d.fill();

    // The tip, darker than the finger, because it is where the hand is actually
    // touching and a shadow is densest where the thing casting it is closest.
    ctx2d.beginPath();
    ctx2d.ellipse(px, py, r * 0.88, r * 1.06, 0, 0, Math.PI * 2);
    // Light enough to read the letter through, which matters because the tip
    // sits on the cup and the cup is standing on the letter it just took. A
    // denser shadow is more convincing and hides the one thing the scene is
    // for.
    ctx2d.fillStyle = 'rgba(22, 17, 13, 0.42)';
    ctx2d.fill();
    ctx2d.restore();
  }

  function drawCup() {
    const px = bx(cup.x), py = by(cup.y), r = bs(CUP_R);

    // Shadow, offset toward the bottom of the board: one light source, high and
    // behind the visitor, which is where a room's light is when you are sitting
    // at a table with your back to it.
    ctx2d.save();
    ctx2d.globalAlpha = 0.40;
    ctx2d.filter = `blur(${Math.max(1, bs(0.010))}px)`;
    ctx2d.beginPath();
    ctx2d.ellipse(px + r * 0.14, py + r * 0.36, r * 1.06, r * 1.0, 0, 0, Math.PI * 2);
    ctx2d.fillStyle = '#000';
    ctx2d.fill();
    ctx2d.restore();

    // ─── The handle ───────────────────────────────────────────────────────────
    // A C, with a real gap in it, sitting against the rim rather than beside it.
    // The first version was a thick arc centred nearly a radius away from the
    // cup, which drew a second complete circle: at the size this renders, a
    // teacup with two rings reads as a pair of spectacles. So the arc is tight,
    // its centre sits ON the rim, and it is stroked in the same china as the
    // body so it reads as part of the object.
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

    // The body. Upside down, so what you are looking at is the foot ring and
    // the underside of the base — and it is translucent because the letter it
    // is standing on has to be readable through it. A cup that hid its own
    // answer would be a cup you had to move off the board to read.
    // Opaque enough to be the brightest thing on the board and translucent
    // enough to read the letter through — 0.62 rather than the 0.42 it shipped
    // with for an afternoon, which put white china on pale card at a contrast
    // the cup lost. The cup has to be findable at a glance; it is the only
    // thing on the screen anybody touches.
    ctx2d.beginPath();
    ctx2d.arc(px, py, r, 0, Math.PI * 2);
    ctx2d.fillStyle = 'rgba(250, 250, 247, 0.62)';
    ctx2d.fill();
    ctx2d.lineWidth = Math.max(1, bs(0.0055));
    ctx2d.strokeStyle = 'rgba(255, 255, 253, 0.98)';
    ctx2d.stroke();
    // One specular arc, upper left, from the same light that casts the shadow
    // down and right. It is what makes the disc read as glazed rather than as a
    // hole cut in the board.
    ctx2d.beginPath();
    ctx2d.arc(px, py, r * 0.88, Math.PI * 1.06, Math.PI * 1.62);
    ctx2d.lineWidth = Math.max(1, bs(0.006));
    ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx2d.stroke();

    // One willow-blue band just inside the rim, and nothing else. Willowware is
    // the pattern every one of these stories has a cup of, and one band is what
    // survives at 40 pixels — the foot ring that used to be here made three
    // concentric circles out of an object that should read as one.
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
    // How much of the tape fits is measured rather than assumed. A fixed
    // character count is the nav-icon bug one layer down: correct at the width
    // it was written at, and on a 390px phone it runs off both edges.
    const track = size * 0.34;
    const per = ctx2d.measureText('M').width + track;
    const fits = Math.max(6, Math.floor((W * 0.92) / Math.max(1, per)));
    ctx2d.fillStyle = 'rgba(214, 200, 176, 0.42)';
    fillTracked(tape.slice(-fits), W / 2, tapeY, track);
    ctx2d.restore();
  }

  function draw() {
    ctx2d.fillStyle = VOID;
    ctx2d.fillRect(0, 0, W, H);
    drawCard();
    drawArcRules();
    drawMarks();
    drawCup();
    // Fingers on top of the cup, and the other hand first so yours is the one
    // over it — you are the nearer of the two.
    if (!reduced && hush <= 0 && hand.x != null) {
      drawFinger(bx(hand.x), by(hand.y), true, 0.92);
    }
    if (visitor.down) drawFinger(bx(visitor.x), by(visitor.y), false, 1);
    drawTape();

    frames++;
    if ((frames & (frames - 1)) === 0) canvas.dataset.frames = String(frames);
  }

  // ─── The loop ─────────────────────────────────────────────────────────────
  let animId = null, paused = false;
  function animate() {
    animId = requestAnimationFrame(animate);
    if (disposed) return;
    const udt = uiClock.tick();
    const dt = reduced ? udt : clock.tick();
    step(dt, udt);
    draw();
  }

  // ─── Input ────────────────────────────────────────────────────────────────
  // Contact, not dragging. A press only puts a finger on the cup if it lands on
  // the cup; a press anywhere else on the board is a hand on the table, and a
  // hand on the table does nothing. That is the rule that makes the cup an
  // object rather than a handle — you cannot teleport it, you can only lean.
  const PRESS_R = CUP_R * 2.6;   // fingertips are wide and a phone is imprecise

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

  // ─── Keyboard ─────────────────────────────────────────────────────────────
  // The arrow keys are a finger, not a cursor: they move the visitor's
  // fingertip, and the cup follows it through the same spring everything else
  // goes through. Space is the press. A keyboard visitor is therefore playing
  // the same instrument at the same disadvantage against the same other hand,
  // rather than being handed a letter picker — which is what a jump list would
  // have been, and would have made the board a menu.
  function onKeyDown(e) {
    if (preview) return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (!visitor.down) {
        // A keyboard visitor cannot aim before touching, so the finger arrives
        // on the cup — the equivalent of reaching out and finding it.
        visitor.x = cup.x; visitor.y = cup.y;
      }
      visitor.down = !visitor.down;
      e.preventDefault();
      return;
    }
    if (/^Arrow(Up|Down|Left|Right)$/.test(e.key)) { held.add(e.key); e.preventDefault(); }
  }
  function onKeyUp(e) { held.delete(e.key); }
  function onBlur() { held.clear(); }

  // ─── Reduced motion ───────────────────────────────────────────────────────
  const reducedWatch = onReducedMotionChange(next => {
    reduced = next;
    clock.resync();
  });

  const resize = bindGuardedResize(container, layout);

  // ─── Mount ────────────────────────────────────────────────────────────────
  // Chrome first, then layout: the board is fitted between the hint and the
  // placard, and neither can be measured before it is in the document.
  if (!preview) {
    const frag = parseHTML(mediumHtml);
    titleEl = frag.querySelector('.medium-title-row');
    hintEl = frag.querySelector('.medium-hint');
    placardEl = frag.querySelector('.medium-placard');
    srLiveEl = frag.querySelector('.medium-sr-live');
    placardEl.querySelector('.medium-epigraph').textContent = EPIGRAPH;
    document.body.append(titleEl, hintEl, placardEl);
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

  // Directly, not scheduled. main.js runs syncPreviewPlayback() the moment
  // initPreviews() resolves and that can setPaused(true), cancelling a queued
  // first callback before it ever runs — which is how Harmonics and Outside
  // shipped tiles that had drawn nothing at all (4.1.1).
  animate();

  return {
    // A hash change that lands on Medium while Medium is already open. A new
    // seed is a new hand: the tape is cleared and the other hand starts over,
    // because a seed that only half applied would be a link that lied.
    applyArg(str) {
      const next = parseSeed(str);
      if (!next || next === seed) return;
      seed = next;
      hand = createWander(seed, BOARD_HOME.x, BOARD_HOME.y);
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
      titleEl?.remove(); hintEl?.remove(); placardEl?.remove(); srLiveEl?.remove();
      srLiveEl = null;
      container.classList.remove('medium-scene');
      claim.restore();
      container.innerHTML = '';
    },
  };
}
