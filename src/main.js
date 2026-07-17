import { createSphere }     from './scenes/sphere.js';
import { createButterfly }  from './scenes/butterfly.js';
import { createManuscript } from './scenes/manuscript.js';
import { createTheater } from './scenes/theater.js';
import { createEgg }       from './scenes/egg.js';
import { createLeaf }      from './scenes/leaf.js';
import { createOrrery }    from './scenes/orrery.js';
// import { createLens } from './scenes/lens.js'; // file renamed from cycle.js
// (2026-07-17, Scott: "do a full rename -- change cycle to lens") but still
// shelved from the same day, pending Scott's decision — the rebuilt gem/Ein
// Soph scene is fully wired and verified-by-build (see NOTES.md, 1.0.14/15/16)
// under its new name. Re-enable by uncommenting this import, the SCENES entry
// below, and the initPreviews() map entry, plus the nav icon + preview tile
// in index.html (same three spots commented out there).
import { initColophon }    from './components/colophon.js';

// ─── Scene registry ──────────────────────────────────────────────────────────
const SCENES = {
  sphere:      { create: createSphere,     label: 'The Sphere — full screen experience. Press Escape to return.',
                 ariaLabel: 'The Sphere — interactive geodesic sphere with text fragments.' },
  butterfly:   { create: createButterfly,  label: 'Chaos Butterfly in Phase Space, 2026.',
                 ariaLabel: 'Chaos Butterfly in Phase Space, 2026 — Lorenz attractor. Drag to orbit, scroll to zoom.' },
  manuscript:  { create: createManuscript, label: 'Selected Works — An Illuminated Manuscript.',
                 ariaLabel: 'Selected Works — an illuminated manuscript of Scott’s best writing, 2000 to the 2010s. Scroll to read.' },
  theater:     { create: createTheater,    label: 'The Theater — Now Playing.',
                 ariaLabel: 'The Theater — scenes from Truth and Beauty and Paul Revere, performed by ASCII actors. A different program each visit; click or use the controls to advance.' },
  egg:         { create: createEgg,        label: 'The Egg — Aurorae, Magnetic Field, Satellites.',
                 ariaLabel: 'The Egg — Earth’s magnetic field, the aurorae it produces, and satellites in orbit. Drag to orbit.' },
  leaf:        { create: createLeaf,       label: 'Leaf — In The End It Falls Slowly Through The Aether.',
                 ariaLabel: 'Leaf — a raindrop’s fall from a leaf, told through physics, with the found text arriving in phase with the fall.' },
  orrery:      { create: createOrrery,     label: 'The Orrery of Los Feliz.',
                 ariaLabel: 'The Orrery of Los Feliz — a found story, told through a 30-foot orrery: nine planets, their moons, an asteroid belt. Drag to orbit, click the orrery to read.' },
  // lens: { create: createLens, label: 'The Lens — Four facets, one light, one stone.',
  //         ariaLabel: 'The Lens — a four-faceted gem lit from within by Ein Soph, held in a rough stone cradle. Drag to orbit, click a facet to read.' },
};

let activeScene  = null;
let fullInstance = null;
const previews   = {};

const overlay      = document.getElementById('experience-overlay');
const expContainer = document.getElementById('experience-container');
const landing      = document.getElementById('landing');
const siteTitle    = document.getElementById('site-title');

// ─── Butterfly overlay extras (label + hint) ──────────────────────────────────
// Both are position:fixed on document.body, outside #experience-overlay, so
// their z-index must clear #experience-overlay's own (300, styles/main.css)
// or they render behind its background/canvas once the fade-in finishes —
// visible only during the ~0.6s opacity transition, then gone. Must stay
// under #site-title (400) and #pm-nav (500) so those still win.
const butterflyStyle = document.createElement('style');
butterflyStyle.textContent = `
  #butterfly-exp-label {
    position: fixed;
    bottom: 2.5rem; left: 50%; transform: translateX(-50%);
    color: rgba(255,255,255,0.85);
    font-size: clamp(0.85rem, 2.5vw, 1.6rem);
    letter-spacing: clamp(0.1em, 1vw, 0.4em);
    text-transform: uppercase;
    pointer-events: none; text-align: center;
    white-space: nowrap; z-index: 310;
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
    text-align: right; z-index: 310; line-height: 1.8;
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
    // The preview canvases (sphere, butterfly) sat behind a hidden landing
    // grid — their own resize listeners were correctly ignoring 0-size
    // reads while hidden, but haven't re-measured since. Nudge them now
    // that they're visible again, in case the window changed size while
    // an experience was open.
    window.dispatchEvent(new Event('resize'));
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
    sphere:     document.getElementById('preview-sphere'),
    butterfly:  document.getElementById('preview-butterfly'),
    manuscript: document.getElementById('preview-manuscript'),
    theater:    document.getElementById('preview-theater'),
    egg:        document.getElementById('preview-egg'),
    leaf:       document.getElementById('preview-leaf'),
    orrery:     document.getElementById('preview-orrery'),
    // lens:    document.getElementById('preview-lens'),
  };
  for (const [name, el] of Object.entries(map)) {
    if (el) previews[name] = SCENES[name].create(el, { preview: true });
  }
}

initPreviews();

// ─── Colophon ─────────────────────────────────────────────────────────────────
// Persistent mark, bottom-right of the landing page. See components/
// colophon.js for why it needs no visibility logic of its own here.
// (The wandering golden-hare component that used to live here is retired —
// the mark itself is a hare now, so a second, separate wandering hare
// mechanic was redundant. See NOTES.md, "1.0.1" entry, for what replaced it.)
initColophon();

// ─── Status-bar easter egg ──────────────────────────────────────────────────
// The onmouseover/onmouseout wiring itself lives in index.html, inline,
// the actual 1999 way to do it — window.status='...' on hover, ''  on
// mouseout. That part does nothing visible anymore (every modern browser
// has ignored script writes to window.status since ~2014), which is fine;
// it's the actually-correct period technique, left in as-is, correct and
// inert in the page source.
//
// pmGlimpse is the part that's actually visible today, Scott's own
// refinement: a 1-in-100 chance per hover that the browser tab's own
// title flickers to that element's status word for a moment before
// reverting on its own — not tied to how long the mouse stays put, so it
// reads as something that happened to you, not a hover state you're
// controlling. Deliberately rare enough that most visitors never see it
// once. Exposed on window rather than kept module-private because inline
// onmouseover="" attributes execute in global scope, not this module's.
const PM_ORIGINAL_TITLE = document.title;
let pmGlimpseTimer = null;
window.pmGlimpse = function (text) {
  if (Math.random() >= 0.01) return;
  document.title = text;
  clearTimeout(pmGlimpseTimer);
  pmGlimpseTimer = setTimeout(() => { document.title = PM_ORIGINAL_TITLE; }, 1500);
};
