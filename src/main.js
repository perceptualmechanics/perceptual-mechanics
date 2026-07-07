import { createSphere }    from './scenes/sphere.js';
import { createButterfly } from './scenes/butterfly.js';
import { createNebula }    from './scenes/nebula.js';
import { createEgg }       from './scenes/egg.js';

// ─── Scene registry ──────────────────────────────────────────────────────────
const SCENES = {
  sphere:    { create: createSphere,    label: 'The Sphere — full screen experience. Press Escape to return.',
               ariaLabel: 'The Sphere — interactive geodesic sphere with text fragments.' },
  butterfly: { create: createButterfly, label: 'Chaos Butterfly in Phase Space, 2026.',
               ariaLabel: 'Chaos Butterfly in Phase Space, 2026 — Lorenz attractor. Drag to orbit, scroll to zoom.' },
  nebula:    { create: createNebula,    label: 'Nebula — The Gaze.',
               ariaLabel: 'Nebula — a constellation interface.' },
  egg:       { create: createEgg,       label: 'The Egg — Worldline.',
               ariaLabel: 'The Egg — your geographic worldline through spacetime.' },
};

let activeScene  = null;
let fullInstance = null;
const previews   = {};

const overlay      = document.getElementById('experience-overlay');
const expContainer = document.getElementById('experience-container');
const landing      = document.getElementById('landing');
const siteTitle    = document.getElementById('site-title');

// ─── Butterfly overlay extras (label + hint) ──────────────────────────────────
const butterflyStyle = document.createElement('style');
butterflyStyle.textContent = `
  #butterfly-exp-label {
    position: fixed;
    bottom: 2rem; left: 50%; transform: translateX(-50%);
    color: rgba(255,255,255,0.85);
    font-size: clamp(0.85rem, 2.5vw, 1.6rem);
    letter-spacing: clamp(0.1em, 1vw, 0.4em);
    text-transform: uppercase;
    pointer-events: none; text-align: center;
    white-space: nowrap; z-index: 202;
    font-family: 'Times New Roman', serif;
  }
  @media (max-width: 600px) {
    #butterfly-exp-label {
      white-space: normal; width: 88vw;
      left: 6vw; transform: none;
      bottom: 5.5rem;
    }
  }
  #butterfly-hint {
    position: fixed; top: 4.5rem; right: 1.2rem;
    color: rgba(255,255,255,0.3);
    font-size: 0.55rem; letter-spacing: 0.2em;
    text-transform: uppercase; pointer-events: none;
    text-align: right; z-index: 202; line-height: 1.8;
    font-family: 'Times New Roman', serif;
  }
  @media (prefers-reduced-motion: reduce) {
    #butterfly-exp-label, #butterfly-hint { transition: none; }
  }
`;
document.head.appendChild(butterflyStyle);

// ─── Nav icons ────────────────────────────────────────────────────────────────
function setActiveIcon(sceneName) {
  document.querySelectorAll('.nav-icon').forEach(b => {
    b.classList.toggle('active', b.dataset.scene === sceneName);
  });
}

// ─── Expand a scene ───────────────────────────────────────────────────────────
function expandScene(sceneName) {
  if (activeScene === sceneName) return;

  // Tear down previous full instance
  if (fullInstance) {
    fullInstance.dispose();
    fullInstance = null;
    expContainer.innerHTML = '';
  }

  // Clean up butterfly extras
  document.getElementById('butterfly-exp-label')?.remove();
  document.getElementById('butterfly-hint')?.remove();

  activeScene = sceneName;
  setActiveIcon(sceneName);

  landing.style.display = 'none';
  overlay.classList.add('active');
  overlay.classList.toggle('butterfly-bg', sceneName === 'butterfly');
  overlay.setAttribute('aria-hidden', 'false');
  overlay.setAttribute('aria-label', SCENES[sceneName]?.ariaLabel ?? 'Full screen experience.');

  // Butterfly extras
  if (sceneName === 'butterfly') {
    const label = document.createElement('p');
    label.id = 'butterfly-exp-label';
    label.textContent = 'Chaos Butterfly in Phase Space, 2026';
    label.setAttribute('aria-hidden', 'true');
    document.body.appendChild(label);

    const hint = document.createElement('p');
    hint.id = 'butterfly-hint';
    hint.innerHTML = 'drag to orbit &nbsp;·&nbsp; scroll to zoom';
    hint.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hint);
  }

  fullInstance = SCENES[sceneName].create(expContainer, { preview: false });
  // Focus the container for screen readers
  expContainer.setAttribute('tabindex', '-1');
  setTimeout(() => expContainer.focus(), 100);
}

// ─── Return to gallery ────────────────────────────────────────────────────────
function returnToGallery() {
  if (!activeScene) return;

  overlay.classList.remove('active', 'butterfly-bg');
  overlay.setAttribute('aria-hidden', 'true');
  document.getElementById('butterfly-exp-label')?.remove();
  document.getElementById('butterfly-hint')?.remove();

  setTimeout(() => {
    if (fullInstance) { fullInstance.dispose(); fullInstance = null; expContainer.innerHTML = ''; }
    activeScene = null;
    setActiveIcon(null);
    landing.style.display = '';
    // Return focus to the preview that was clicked
    document.querySelector('.preview-container:focus-within')?.focus();
  }, 600);
}

// ─── Nav icon clicks ──────────────────────────────────────────────────────────
document.querySelectorAll('.nav-icon').forEach(btn => {
  btn.addEventListener('click', () => {
    const scene = btn.dataset.scene;
    if (activeScene === scene) {
      returnToGallery(); // clicking active icon returns to gallery
    } else {
      expandScene(scene);
    }
  });
});

// ─── Site title → gallery ─────────────────────────────────────────────────────
siteTitle.addEventListener('click', e => {
  e.preventDefault();
  returnToGallery();
});
siteTitle.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); returnToGallery(); }
});

// ─── Keyboard: Escape → gallery ───────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && activeScene) returnToGallery();
});

// ─── Preview container clicks + keyboard ─────────────────────────────────────
document.querySelectorAll('.preview-wrapper').forEach(w => {
  const container = w.querySelector('.preview-container');
  const launch = () => expandScene(w.dataset.scene);
  w.addEventListener('click', launch);
  container.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); launch(); }
  });
});

// ─── Init previews ────────────────────────────────────────────────────────────
function initPreviews() {
  const map = {
    sphere:    document.getElementById('preview-sphere'),
    butterfly: document.getElementById('preview-butterfly'),
    nebula:    document.getElementById('preview-nebula'),
    egg:       document.getElementById('preview-egg'),
  };
  for (const [name, el] of Object.entries(map)) {
    if (el) previews[name] = SCENES[name].create(el, { preview: true });
  }
}

initPreviews();
