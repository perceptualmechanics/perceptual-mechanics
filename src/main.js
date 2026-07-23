import { createSphere }     from './scenes/sphere.js';
import { createButterfly }  from './scenes/butterfly.js';
import { createManuscript } from './scenes/manuscript.js';
import { createTheater } from './scenes/theater.js';
import { createEgg }       from './scenes/egg.js';
import { createLeaf }      from './scenes/leaf.js';
import { createOrrery }    from './scenes/orrery.js';
import { createLibrary }   from './scenes/library.js';
// Re-enabled 2026-07-23 — Scott: "given this analysis, curate the excerpts
// to create hyperlinks between them a la my other writings in the site,"
// after a close-read of the whole catalog (library_resonances.md) turned
// up genuine cross-title resonances. Shelved briefly the day before
// (1.0.54) while a data-correction round wrapped up; back live now that
// there are actual clickable cross-links (see library.js's LIBRARY_LINKS)
// worth being able to click through.
// import { createLens } from './scenes/lens.js'; // shelved again (2026-07-17,
// Scott: "ok, can you just comment out the lens then?" — after a work-in-
// progress round: tighter beam, princess-cut multi-facet gem, Tree of
// Life/chakra backdrop (see NOTES.md, 1.0.20), and a screenshot showing the
// gem crowding the frame and the facet steps reading too subtly. "let's
// just shelve this for the moment and look at it tomorrow with fresh
// eyes." Re-enable by uncommenting this import, the SCENES entry below,
// and the initPreviews() map entry, plus the nav icon + preview tile in
// index.html (same three spots commented out there).
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
                 ariaLabel: 'The Theater — scenes from Truth and Beauty, Paul Revere, and You’ve Got a Friend in Satan, performed by ASCII actors. A different program each visit; click or use the controls to advance.' },
  egg:         { create: createEgg,        label: 'The Egg — Aurorae, Magnetic Field, Satellites.',
                 ariaLabel: 'The Egg — Earth’s magnetic field, the aurorae it produces, and satellites in orbit. Drag to orbit.' },
  leaf:        { create: createLeaf,       label: 'Leaf — In The End It Falls Slowly Through The Aether.',
                 ariaLabel: 'Leaf — a raindrop’s fall from a leaf, told through physics, with the found text arriving in phase with the fall.' },
  orrery:      { create: createOrrery,     label: 'The Orrery of Los Feliz.',
                 ariaLabel: 'The Orrery of Los Feliz — a found story, told through a 30-foot orrery: nine planets, their moons, an asteroid belt, in a warehouse you can walk around. Use the arrow keys or WASD to walk, click to look around, click the orrery to read.' },
  library:     { create: createLibrary,    label: 'The Library — once removed.',
                 ariaLabel: 'The Library — a real bookshelf, 107 books, films, and divination decks, rebuilt as a shelf you can turn in space. Drag to orbit, scroll to zoom, click a spine to read what it is.' },
  // lens: { create: createLens, label: 'The Lens — Four facets, one light.',
  //         ariaLabel: 'The Lens — a single translucent cut gem with four colored sides, floating free, lit from directly above by a vertical spotlight named Prologue. Drag to orbit, click a facet or the light to read.' },
};

let activeScene  = null;
let fullInstance = null;
let lastTrigger  = null; // whichever nav icon / preview tile launched the active scene
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
    bottom: 3rem; left: 50%; transform: translateX(-50%);
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
// `triggerEl`: whichever control launched this (a nav icon or a preview
// tile) — stashed so returnToGallery() can send focus back to the actual
// thing the visitor activated, not guess at it after the fact.
function expandScene(sceneName, triggerEl = null) {
  if (activeScene === sceneName) return;
  lastTrigger = triggerEl;

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
    // Return focus to whichever control launched this scene. Used to
    // query `.preview-container:focus-within` here, which can never
    // actually match by this point: focus already moved into
    // expContainer the moment the scene launched (see expandScene below),
    // and clearing expContainer's innerHTML just above moves focus to
    // <body> once its focused descendant is removed from the DOM — so
    // the query always silently found nothing. Tracking the real trigger
    // element directly (both nav icons and preview tiles stay in the DOM
    // the whole time, just hidden) is the only thing that actually works.
    lastTrigger?.focus();
  }, 600);
}

// ─── Nav icon clicks ──────────────────────────────────────────────────────────
document.querySelectorAll('.nav-icon').forEach(btn => {
  btn.addEventListener('click', () => {
    const scene = btn.dataset.scene;
    if (activeScene === scene) {
      returnToGallery(); // clicking active icon returns to gallery
    } else {
      expandScene(scene, btn);
    }
  });
});

// ─── Site title → gallery ─────────────────────────────────────────────────────
// Semantic pass, 2026-07-22: #site-title is a real <button> now (index.html),
// not an <a href="#" role="button"> — no href to preventDefault(), and
// Enter/Space activation comes free with the element, so the manual
// keydown listener this used to need is gone too.
siteTitle.addEventListener('click', returnToGallery);

// ─── Keyboard: Escape → gallery ───────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && activeScene) returnToGallery();
});

// ─── Preview container clicks ─────────────────────────────────────────────────
// Semantic pass, 2026-07-22: .preview-container is a real <button> now
// (index.html), not a <div role="button" tabindex="0">, so it gets
// Enter/Space activation for free — the manual keydown listener this used
// to need is gone; a single click listener on the button itself covers
// mouse, touch, and keyboard activation alike (native buttons dispatch a
// real click event for all three).
document.querySelectorAll('.preview-wrapper').forEach(w => {
  const container = w.querySelector('.preview-container');
  container.addEventListener('click', () => expandScene(w.dataset.scene, container));
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
    library:    document.getElementById('preview-library'),
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
// pmGlimpse: a 1-in-100 chance per hover that the browser tab's own title
// flickers to that element's word for a moment before reverting on its
// own — not tied to how long the mouse stays put, so it reads as
// something that happened to you, not a hover state you're controlling.
// Deliberately rare enough that most visitors never see it once. Exposed
// on window rather than kept module-private because inline onmouseover=""
// attributes (index.html's nav icons, site-title, preview tiles) execute
// in global scope, not this module's.
//
// PM_GLIMPSE_WORDS is a plain object, keyed by the same string every
// onmouseover="pmGlimpse('sphere')" etc. passes in — a array of
// { key, text } pairs briefly lived here instead (2026-07-18ish) and broke
// this silently: truth['sphere'] on an array doesn't find the element
// whose .key is 'sphere', it just comes back undefined, so the tab title
// was flickering to the literal string "undefined" instead of the actual
// word. Keep this a plain object so the bracket lookup below is a real
// key lookup, not an array index.
const PM_ORIGINAL_TITLE = document.title;
const PM_GLIMPSE_WORDS = {
  sphere: 'zen archery',
  butterfly: 'complexity',
  scroll: 'savagery',
  theater: 'light entertainment',
  egg: 'lantern',
  leaf: 'stillness',
  orrery: 'will',
  library: 'catalogued',
  title: 'secrets',
};
let pmGlimpseTimer = null;
window.pmGlimpse = function (key) {
  if (Math.random() >= 0.01) return;
  const word = PM_GLIMPSE_WORDS[key];
  if (!word) return; // unknown key — fail silently, never show "undefined"
  document.title = word;
  clearTimeout(pmGlimpseTimer);
  pmGlimpseTimer = setTimeout(() => { document.title = PM_ORIGINAL_TITLE; }, 1100);
};
