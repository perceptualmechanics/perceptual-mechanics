// ─── The Golden Hare ────────────────────────────────────────────────────────
// "A Golden Hare ran across the sky, carrying the sun in its belly, where it
// would be safe. The hare ran up the ladder to the sky." — found, one
// sentence, complete as-is (archives/Writing archive/Golden Hare.pages).
//
// An interstitial, not a scene: it doesn't belong to any single experience
// (sphere, butterfly, manuscript, theater, nebula, egg) the way everything
// else in src/scenes/ does. It lives at the top level, initialized once from
// main.js, and wanders across whatever is currently on screen — the landing
// grid or an open experience, it doesn't know or care which. Rare by design:
// it should read as a found thing you might miss, not a mascot on a loop.
// No canvas, no WebGL, no raster image — a plain inline SVG silhouette,
// styled and positioned with CSS, same restraint as the rest of the site.
//
// Redesigned 2026-07-16 after a real tattoo (Scott's own) — a leaping,
// Celtic/insular-style hare: one long ear with a spiraled terminal, an arched
// bounding body, and body markings lifted straight from the source ink — a
// crescent moon, two Venus circles, and a sun/bullseye — which happen to land
// squarely on "carrying the sun in its belly." Simplified for legibility at
// 48–84px; not a literal trace, but every mark in the tattoo is represented.
//
// Also new this pass: the run itself is a genuine three-axis path, not a
// straight horizontal line. Each appearance generates its own randomized
// @keyframes — X still crosses the screen start to finish, but Y bounds in a
// little hopping arc and Z drifts the hare nearer/farther via translateZ +
// perspective (with a matched brightness cue), so no two runs move quite the
// same way. Falls back to a plain straight-line run if anything about the
// dynamic keyframes fails to apply.
//
// Respects prefers-reduced-motion by not running at all — a creature that
// only exists by wandering has nothing left to offer once the wandering is
// switched off, so rather than show it inert, it stays out of the way
// entirely.

const HARE_TEXT = 'A Golden Hare ran across the sky, carrying the sun in its belly, where it would be safe. The hare ran up the ladder to the sky.';

const HARE_SVG = `
<svg viewBox="-4 -10 128 74" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
    <!-- ears: one long, spiraled terminal; one short, tucked behind -->
    <path d="M86 18 Q78 6 76 -1 Q75 -6 79 -6 Q83 -5 81 0 Q79 4 75 2"/>
    <path d="M81 16 Q76 6 68 3"/>
    <!-- compact head + blunt nose -->
    <path d="M90 20 Q99 22 100 29 Q100 33 95 34 Q91 34 90 30 Z"/>
    <!-- back, arching from head down through the haunch/leg-root -->
    <path d="M90 20 Q75 8 60 10 Q45 12 32 18 Q22 22 20 28 Q19 31 21 33"/>
    <!-- tail, a small flick well clear of the legs -->
    <path d="M23 19 Q15 13 18 8 Q20 5 23 8"/>
    <!-- belly -->
    <path d="M21 33 Q38 41 55 41 Q72 41 86 36"/>
    <!-- rear legs, extended back for push-off -->
    <path d="M27 29 Q13 37 8 47 Q6 52 11 54"/>
    <path d="M33 31 Q19 39 12 49"/>
    <!-- front legs, tucked/reaching down -->
    <path d="M84 36 Q80 46 78 55"/>
    <path d="M91 35 Q92 46 89 57"/>
  </g>
  <circle cx="92" cy="25" r="1.8" fill="#7dd3ff" stroke="none"/>
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

let styleInjected = false;
function injectStyles() {
  if (styleInjected || document.getElementById('golden-hare-styles')) { styleInjected = true; return; }
  styleInjected = true;
  const style = document.createElement('style');
  style.id = 'golden-hare-styles';
  style.textContent = `
    #golden-hare {
      position: fixed;
      bottom: var(--hare-y, 12vh);
      left: -12vw;
      width: clamp(48px, 6vw, 84px);
      color: rgba(255, 208, 110, 0.82);
      filter: drop-shadow(0 0 6px rgba(255, 200, 90, 0.45));
      pointer-events: auto;
      cursor: pointer;
      z-index: 350;
      transform-style: preserve-3d;
      /* Generic fallback only — normal runs get their own animation-name
         (and their own keyframes) assigned inline by runOnce(). This static
         keyframe set exists purely so something still plays if the dynamic
         per-run injection fails for any reason. */
      animation: golden-hare-run var(--hare-duration, 13s) linear forwards;
    }
    #golden-hare.reverse { left: auto; right: -12vw; }
    #golden-hare svg { display: block; width: 100%; height: auto; }
    @keyframes golden-hare-run {
      from { transform: translateX(0) scaleX(1); }
      to   { transform: translateX(124vw) scaleX(1); }
    }
    #golden-hare-caption {
      position: fixed;
      bottom: calc(var(--hare-y, 12vh) + clamp(48px, 6vw, 84px) + 0.6rem);
      left: 50%;
      transform: translateX(-50%);
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

// Builds one run's worth of randomized three-axis @keyframes and injects it
// as its own <style> element, returning the unique animation-name to use.
// X always progresses monotonically start to finish (it has to actually
// cross the screen); Y hops within a band and Z drifts near/far, both
// re-rolled per waypoint so the path never repeats exactly.
function injectRunKeyframes(sign) {
  const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const name = `golden-hare-run-${runId}`;
  const perspective = 600 + Math.random() * 200; // px, subtle variation run to run

  const stops = [0, 25, 50, 75, 100].map((pct) => {
    const atEdge = pct === 0 || pct === 100;
    const xVw = sign * (124 * (pct / 100));
    const yPx = atEdge ? 0 : -(8 + Math.random() * 26); // hop up, never down
    const zPx = atEdge ? 0 : (Math.random() * 2 - 1) * 80; // near/far drift
    const brightness = (1 + zPx / 260).toFixed(2); // nearer (z>0) reads brighter/bigger
    return { pct, xVw, yPx, zPx, brightness };
  });

  const body = stops.map(({ pct, xVw, yPx, zPx, brightness }, i) => {
    const easing = i > 0 && i < stops.length - 1 ? ' animation-timing-function: ease-in-out;' : '';
    return `  ${pct}% { transform: perspective(${perspective.toFixed(0)}px) translate3d(${xVw.toFixed(2)}vw, ${yPx.toFixed(1)}px, ${zPx.toFixed(1)}px) scaleX(${sign}); filter: drop-shadow(0 0 6px rgba(255, 200, 90, 0.45)) brightness(${brightness});${easing} }`;
  }).join('\n');

  const styleEl = document.createElement('style');
  styleEl.id = `golden-hare-keyframes-${runId}`;
  styleEl.textContent = `@keyframes ${name} {\n${body}\n}`;
  document.head.appendChild(styleEl);

  return { name, styleEl };
}

function runOnce() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return; // see header note — no inert fallback, just absent

  injectStyles();

  const hare = document.createElement('div');
  hare.id = 'golden-hare';
  hare.innerHTML = HARE_SVG;
  // Decorative easter egg, same category as nebula's hint/caption text:
  // aria-hidden, mouse/touch discoverable only, nothing essential gated
  // behind finding it.
  hare.setAttribute('aria-hidden', 'true');

  const reverse = Math.random() < 0.5;
  if (reverse) hare.classList.add('reverse');
  const duration = 11 + Math.random() * 6;
  hare.style.setProperty('--hare-duration', `${duration.toFixed(1)}s`);
  hare.style.setProperty('--hare-y', `${8 + Math.random() * 22}vh`);

  let runStyleEl = null;
  try {
    const { name, styleEl } = injectRunKeyframes(reverse ? -1 : 1);
    runStyleEl = styleEl;
    hare.style.animationName = name;
    hare.style.animationTimingFunction = 'linear'; // per-waypoint easing above overrides mid-run
    hare.style.animationFillMode = 'forwards';
  } catch {
    // Fall through to the static fallback keyframes baked into the stylesheet.
  }

  const caption = document.createElement('p');
  caption.id = 'golden-hare-caption';
  caption.textContent = HARE_TEXT;
  caption.setAttribute('aria-hidden', 'true');

  let revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
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

// Public entry point: call once, from main.js, outside any single scene's
// lifecycle. Schedules its own next appearance after each run — genuinely
// rare (roughly once every one to three minutes), and never more than one
// hare on screen at a time.
export function initGoldenHare() {
  function scheduleNext() {
    const delay = 60_000 + Math.random() * 120_000; // ~1–3 minutes
    setTimeout(() => {
      runOnce();
      scheduleNext();
    }, delay);
  }
  scheduleNext();
}
