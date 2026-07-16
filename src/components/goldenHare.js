// ─── The Golden Hare ────────────────────────────────────────────────────────
// "A Golden Hare ran across the sky, carrying the sun in its belly, where it
// would be safe. The hare ran up the ladder to the sky." — found, one
// sentence, complete as-is (archives/Writing archive/Golden Hare.pages).
//
// An interstitial, not a scene: it doesn't belong to any single experience
// (sphere, butterfly, manuscript, theater, nebula, egg) the way everything
// else in src/scenes/ does. It lives at the top level, initialized once from
// main.js, and wanders across whatever is currently on screen. Rare by
// design: it should read as a found thing you might miss, not a mascot on a
// loop. No canvas, no WebGL, no raster image — plain inline SVG, styled and
// positioned with CSS, same restraint as the rest of the site.
//
// Two variants, picked at random each time (second pass, 2026-07-16):
//
// 1. The single hare (~85% of appearances) — redrawn from a real tattoo
//    (Scott's own): one spiral-tipped ear, an arched bounding pose, and all
//    four body markings from the source ink (crescent moon, two Venus
//    circles, sun/bullseye) — the sun mark lines up with "carrying the sun
//    in its belly." It no longer just glides in a straight line; it scampers
//    — a few quick dashes with real pauses between them (a hare that's
//    stopped to listen, ears up, before the next dash), wandering in X/Y/Z
//    rather than one smooth diagonal.
//
// 2. The Three Hares (~15% of appearances) — three hares chasing nose-to-
//    tail around a center point, each one's ear reaching in to share the
//    small central knot, an old motif (Devon church "tinner's rabbits,"
//    Buddhist Mogao caves, medieval synagogues, all independently) that
//    turns out to already be sitting in Scott's own archive: "Three hares."
//    appears twice as a bare fragment in the sprawling "Energy Work"
//    document (present in both A Manual of Perceptual Mechanics.scriv and
//    The Secret World.scriv), once right next to "The multiplicity of
//    rabbits," once next to "Sun and moon are a pair." The center of the
//    ring carries a small sun mark, same reasoning as the single hare. This
//    variant doesn't cross the screen — it appears at a random point, spins
//    in place like a pinwheel with a slow breathing pulse in depth, and
//    fades back out.
//
// Both fall back to a plain static keyframe animation if the per-run
// dynamic injection fails for any reason, and both respect
// prefers-reduced-motion by not running at all — a creature that only
// exists by moving has nothing left to offer once the moving is switched
// off, so rather than show it inert, it stays out of the way entirely.

const HARE_TEXT = 'A Golden Hare ran across the sky, carrying the sun in its belly, where it would be safe. The hare ran up the ladder to the sky.';

const HARE_SVG = `
<svg viewBox="-4 -10 128 74" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
    <!-- ears: one long with a spiraled tip, one short tucked behind -->
    <path d="M86 18 Q78 6 76 -1 Q75 -6 79 -6 Q83 -5 81 0 Q79 4 75 2"/>
    <path d="M81 16 Q76 6 68 3"/>
    <!-- head flows straight out of the back line, blunt open snout -->
    <path d="M90 20 Q98 21 100 27 Q101 32 96 34"/>
    <path d="M96 34 Q92 34 89 30"/>
    <!-- back, arching from head down through the haunch/leg-root -->
    <path d="M90 20 Q75 8 60 10 Q45 12 32 18 Q22 22 20 28 Q19 31 21 33"/>
    <!-- tail: a small simple hook, deliberately plainer than the ear spiral -->
    <path d="M22 24 Q17 21 19 17"/>
    <!-- belly -->
    <path d="M21 33 Q38 41 55 41 Q72 41 86 36"/>
    <!-- rear legs, extended back for push-off -->
    <path d="M27 29 Q13 37 8 47 Q6 52 11 54"/>
    <path d="M33 31 Q19 39 12 49"/>
    <!-- front legs, tucked/reaching down -->
    <path d="M84 36 Q80 46 78 55"/>
    <path d="M91 35 Q92 46 89 57"/>
  </g>
  <circle cx="93" cy="26" r="1.8" fill="#7dd3ff" stroke="none"/>
  <g fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" opacity="0.7">
    <!-- sun / bullseye, near the shoulder -->
    <circle cx="73" cy="10" r="5"/>
    <circle cx="73" cy="10" r="1.3" fill="currentColor" stroke="none"/>
    <!-- two Venus circles, mid-back -->
    <circle cx="57" cy="11.5" r="3.4"/>
    <path d="M57 14.9 L57 20 M53.7 17.5 L60.3 17.5"/>
    <circle cx="44" cy="14.5" r="3.6"/>
    <path d="M44 18.1 L44 23 M40.8 20.6 L47.2 20.6"/>
    <!-- crescent moon, near the haunch -->
    <path d="M32 16 A5.2 5.2 0 1 0 32 26.4 A3.8 3.8 0 1 1 32 16 Z"/>
  </g>
</svg>`;

// Three hares chasing nose-to-tail around a shared center. One hare unit,
// defined once, replicated by rotation rather than hand-plotted three times
// — the 3-fold symmetry is exact by construction, same as the real motif.
const HARE_THREE_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <g id="hareUnit" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M50 47 Q52 39 56 32"/>
      <path d="M56 32 Q63 27 68 29 Q71 31 68 35 Q64 37 59 34"/>
      <path d="M68 29 Q80 22 90 32 Q94 37 90 43"/>
      <path d="M90 43 Q96 42 94 37"/>
      <path d="M60 35 Q72 46 84 47"/>
      <path d="M82 42 Q88 50 84 56"/>
      <path d="M88 40 Q94 47 91 54"/>
      <path d="M58 35 Q54 42 58 48"/>
      <circle cx="63" cy="31" r="1.4" fill="#7dd3ff" stroke="none"/>
    </g>
  </defs>
  <use href="#hareUnit"/>
  <use href="#hareUnit" transform="rotate(120 50 50)"/>
  <use href="#hareUnit" transform="rotate(240 50 50)"/>
  <circle cx="50" cy="50" r="4.5" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.75"/>
  <circle cx="50" cy="50" r="1.3" fill="currentColor" opacity="0.85"/>
</svg>`;

let styleInjected = false;
function injectStyles() {
  if (styleInjected || document.getElementById('golden-hare-styles')) { styleInjected = true; return; }
  styleInjected = true;
  const style = document.createElement('style');
  style.id = 'golden-hare-styles';
  style.textContent = `
    #golden-hare {
      position: fixed;
      color: rgba(255, 208, 110, 0.82);
      filter: drop-shadow(0 0 6px rgba(255, 200, 90, 0.45));
      pointer-events: auto;
      cursor: pointer;
      z-index: 350;
      transform-style: preserve-3d;
    }
    #golden-hare svg { display: block; width: 100%; height: auto; }
    /* Single hare: runs edge to edge along the bottom band. */
    #golden-hare.single {
      bottom: var(--hare-y, 12vh);
      left: -12vw;
      width: clamp(48px, 6vw, 84px);
      /* Fallback only — runScamper() assigns its own generated
         animation-name. This static rule just guarantees something plays if
         that dynamic injection fails for any reason. */
      animation: golden-hare-run var(--hare-duration, 13s) linear forwards;
    }
    #golden-hare.single.reverse { left: auto; right: -12vw; }
    @keyframes golden-hare-run {
      from { transform: translateX(0) scaleX(1); }
      to   { transform: translateX(124vw) scaleX(1); }
    }
    /* Three Hares: appears at a random point, doesn't travel. */
    #golden-hare.three {
      top: var(--hare-y2, 30vh);
      left: var(--hare-x2, 40vw);
      width: clamp(56px, 7vw, 100px);
      animation: golden-hare-three-fallback var(--hare-duration, 8s) ease-in-out forwards;
    }
    @keyframes golden-hare-three-fallback {
      0%   { opacity: 0; transform: perspective(700px) scale(0.6) rotate(0deg); }
      15%  { opacity: 1; }
      85%  { opacity: 1; }
      100% { opacity: 0; transform: perspective(700px) scale(0.6) rotate(360deg); }
    }
    #golden-hare-caption {
      position: fixed;
      max-width: min(80vw, 32rem);
      text-align: center;
      color: rgba(255, 224, 170, 0.85);
      font-family: 'Times New Roman', serif;
      font-style: italic;
      font-size: clamp(0.75rem, 1.6vw, 0.95rem);
      letter-spacing: 0.02em;
      line-height: 1.6;
      pointer-events: none;
      z-index: 351;
      opacity: 0;
      transition: opacity 0.6s ease;
    }
    #golden-hare-caption.visible { opacity: 1; }
    @media (prefers-reduced-motion: reduce) {
      #golden-hare { animation: none !important; display: none; }
    }
  `;
  document.head.appendChild(style);
}

function uniqueId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function injectKeyframes(name, body) {
  const styleEl = document.createElement('style');
  styleEl.id = `golden-hare-keyframes-${name}`;
  styleEl.textContent = `@keyframes ${name} {\n${body}\n}`;
  document.head.appendChild(styleEl);
  return styleEl;
}

// A few quick dashes with real pauses between them — X still crosses the
// whole screen by the end, but unevenly, with hops (Y) and near/far depth
// drift (Z, via translateZ + perspective) layered on top. No two runs move
// the same way.
function buildScamperKeyframes(sign) {
  const runId = uniqueId();
  const name = `golden-hare-scamper-${runId}`;
  const perspective = 600 + Math.random() * 200;

  const bursts = 3 + Math.floor(Math.random() * 3); // 3-5 dash/pause cycles
  const segments = [];
  for (let i = 0; i < bursts; i++) {
    segments.push({ type: 'dash', w: 6 + Math.random() * 8 });
    segments.push({ type: 'pause', w: 3 + Math.random() * 7 });
  }
  const totalW = segments.reduce((s, r) => s + r.w, 0);
  const totalDashW = segments.filter((r) => r.type === 'dash').reduce((s, r) => s + r.w, 0);

  const stops = [{ pct: 0, xFrac: 0, yPx: 0, zPx: 0, ease: null }];
  let pct = 0;
  let xFrac = 0;
  segments.forEach((seg) => {
    pct += (seg.w / totalW) * 100;
    if (seg.type === 'dash') xFrac += seg.w / totalDashW;
    const yPx = seg.type === 'dash'
      ? -(10 + Math.random() * 24)   // mid-dash hop
      : -(1 + Math.random() * 5);    // settled crouch, ears-up pause
    const zPx = (Math.random() * 2 - 1) * (seg.type === 'dash' ? 80 : 25);
    stops.push({
      pct: Math.min(97, pct),
      xFrac: Math.min(1, xFrac),
      yPx,
      zPx,
      ease: seg.type === 'dash' ? 'cubic-bezier(.3,.8,.4,1)' : 'ease-in-out',
    });
  });
  stops.push({ pct: 100, xFrac: 1, yPx: 0, zPx: 0, ease: null });

  const body = stops.map(({ pct: p, xFrac: xf, yPx, zPx, ease }) => {
    const brightness = (1 + zPx / 260).toFixed(2);
    const easing = ease ? ` animation-timing-function: ${ease};` : '';
    return `  ${p.toFixed(2)}% { transform: perspective(${perspective.toFixed(0)}px) translate3d(${(sign * 124 * xf).toFixed(2)}vw, ${yPx.toFixed(1)}px, ${zPx.toFixed(1)}px) scaleX(${sign}); filter: drop-shadow(0 0 6px rgba(255, 200, 90, 0.45)) brightness(${brightness});${easing} }`;
  }).join('\n');

  return { name, styleEl: injectKeyframes(name, body) };
}

// Spins the whole ring in place with a slow breathing pulse in depth, fading
// in and back out. Direction (cw/ccw) and total rotation are randomized.
function buildThreeHaresKeyframes() {
  const runId = uniqueId();
  const name = `golden-hare-three-${runId}`;
  const dir = Math.random() < 0.5 ? -1 : 1;
  const totalDeg = dir * (300 + Math.random() * 200);
  const perspective = 500 + Math.random() * 200;
  const peakScale = (1.05 + Math.random() * 0.15).toFixed(2);
  const peakZ = 40 + Math.random() * 40;

  const stops = [
    { pct: 0, deg: 0, scale: 0.6, z: -peakZ, op: 0 },
    { pct: 14, deg: totalDeg * 0.14, scale: 0.85, z: -peakZ * 0.4, op: 1 },
    { pct: 50, deg: totalDeg * 0.5, scale: peakScale, z: peakZ, op: 1 },
    { pct: 86, deg: totalDeg * 0.86, scale: 0.85, z: -peakZ * 0.4, op: 1 },
    { pct: 100, deg: totalDeg, scale: 0.6, z: -peakZ, op: 0 },
  ];

  const body = stops.map(({ pct, deg, scale, z, op }) =>
    `  ${pct}% { opacity: ${op}; transform: perspective(${perspective.toFixed(0)}px) translateZ(${z.toFixed(1)}px) scale(${scale}) rotate(${deg.toFixed(1)}deg); animation-timing-function: ease-in-out; }`
  ).join('\n');

  return { name, styleEl: injectKeyframes(name, body) };
}

function makeCaption() {
  const caption = document.createElement('p');
  caption.id = 'golden-hare-caption';
  caption.textContent = HARE_TEXT;
  caption.setAttribute('aria-hidden', 'true');
  return caption;
}

// Wires up click/touch-to-reveal, the click position derived from wherever
// the hare actually is on screen at the moment it's clicked (it may be
// mid-dash or mid-spin), and cleans up the hare/caption/injected keyframes
// once the run finishes.
function attachLifecycle(hare, runStyleEl) {
  const caption = makeCaption();
  let revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    const rect = hare.getBoundingClientRect();
    const margin = 12;
    const centerX = Math.min(window.innerWidth - margin, Math.max(margin, rect.left + rect.width / 2));
    caption.style.left = `${centerX}px`;
    caption.style.top = `${Math.min(window.innerHeight - 40, rect.bottom + 10)}px`;
    caption.style.transform = 'translate(-50%, 0)';
    document.body.appendChild(caption);
    requestAnimationFrame(() => caption.classList.add('visible'));
    setTimeout(() => {
      caption.classList.remove('visible');
      setTimeout(() => caption.remove(), 700);
    }, 4200);
  }
  hare.addEventListener('click', reveal);
  hare.addEventListener('touchstart', reveal, { passive: true });

  document.body.appendChild(hare);
  hare.addEventListener('animationend', () => {
    hare.remove();
    if (!revealed) caption.remove();
    if (runStyleEl) runStyleEl.remove();
  });
}

function runScamper() {
  const hare = document.createElement('div');
  hare.id = 'golden-hare';
  hare.className = 'single';
  hare.innerHTML = HARE_SVG;
  hare.setAttribute('aria-hidden', 'true');

  const reverse = Math.random() < 0.5;
  if (reverse) hare.classList.add('reverse');
  const duration = 12 + Math.random() * 8; // a bit longer than a straight run — bursts need room
  hare.style.setProperty('--hare-duration', `${duration.toFixed(1)}s`);
  hare.style.setProperty('--hare-y', `${8 + Math.random() * 22}vh`);

  let runStyleEl = null;
  try {
    const { name, styleEl } = buildScamperKeyframes(reverse ? -1 : 1);
    runStyleEl = styleEl;
    hare.style.animationName = name;
    hare.style.animationTimingFunction = 'linear';
    hare.style.animationFillMode = 'forwards';
  } catch {
    // Falls through to the static .single fallback keyframes.
  }

  attachLifecycle(hare, runStyleEl);
}

function runThreeHares() {
  const hare = document.createElement('div');
  hare.id = 'golden-hare';
  hare.className = 'three';
  hare.innerHTML = HARE_THREE_SVG;
  hare.setAttribute('aria-hidden', 'true');

  const duration = 7 + Math.random() * 4;
  hare.style.setProperty('--hare-duration', `${duration.toFixed(1)}s`);
  hare.style.setProperty('--hare-x2', `${15 + Math.random() * 60}vw`);
  hare.style.setProperty('--hare-y2', `${15 + Math.random() * 55}vh`);

  let runStyleEl = null;
  try {
    const { name, styleEl } = buildThreeHaresKeyframes();
    runStyleEl = styleEl;
    hare.style.animationName = name;
    hare.style.animationTimingFunction = 'ease-in-out';
    hare.style.animationFillMode = 'forwards';
  } catch {
    // Falls through to the static .three fallback keyframes.
  }

  attachLifecycle(hare, runStyleEl);
}

// Public entry point: call once, from main.js, outside any single scene's
// lifecycle. Schedules its own next appearance after each run — genuinely
// rare (roughly once every one to three minutes), never more than one hare
// (or ring of hares) on screen at a time, and mostly the single scampering
// hare with the Three Hares showing up only occasionally.
export function initGoldenHare() {
  function scheduleNext() {
    const delay = 60_000 + Math.random() * 120_000; // ~1–3 minutes
    setTimeout(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduced) {
        injectStyles();
        if (Math.random() < 0.15) runThreeHares();
        else runScamper();
      }
      scheduleNext();
    }, delay);
  }
  scheduleNext();
}
