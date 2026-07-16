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
// Respects prefers-reduced-motion by not running at all — a creature that
// only exists by wandering has nothing left to offer once the wandering is
// switched off, so rather than show it inert, it stays out of the way
// entirely.

const HARE_TEXT = 'A Golden Hare ran across the sky, carrying the sun in its belly, where it would be safe. The hare ran up the ladder to the sky.';

const HARE_SVG = `
<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 44 Q20 30 34 30 Q30 20 36 12 Q40 20 40 28 Q52 24 62 30 Q72 24 82 28 Q78 34 70 36 Q80 40 84 46 Q70 42 60 44 Q46 50 30 48 Q20 48 14 44 Z"/>
    <path d="M36 12 Q34 4 30 2 M40 14 Q42 5 47 3"/>
    <circle cx="30" cy="26" r="1.6" fill="currentColor" stroke="none"/>
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
      animation: golden-hare-run var(--hare-duration, 13s) linear forwards;
    }
    #golden-hare.reverse { animation-name: golden-hare-run-reverse; }
    #golden-hare svg { display: block; width: 100%; height: auto; }
    @keyframes golden-hare-run {
      from { transform: translateX(0) scaleX(1); }
      to   { transform: translateX(124vw) scaleX(1); }
    }
    @keyframes golden-hare-run-reverse {
      from { left: auto; right: -12vw; transform: translateX(0) scaleX(-1); }
      to   { left: auto; right: -12vw; transform: translateX(-124vw) scaleX(-1); }
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
