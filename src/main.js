import { createSphere }     from './scenes/sphere.js';
import { createButterfly }  from './scenes/butterfly.js';
import { createScroll }    from './scenes/scroll.js';
import { createTheater } from './scenes/theater.js';
import { createOrbiter }   from './scenes/orbiter.js';
// import { createLeaf } from './scenes/leaf.js'; // shelved again 2026-07-31
// — Scott: "shelve leaf for the time being," same pattern as every other
// shelve on this project (Cycle, the golden hare mechanic, Lens twice,
// Prism, and Leaf's own first shelving on 2026-07-29): comment out, don't
// delete. This is the 1.20.0 ground-up rebuild (locked-camera diorama,
// hard cut to a free-camera cosmic scene, real threshold-driven droplet
// physics) — unlike Prism, no verdict on the work itself came with this
// one, and "for the time being" reads as open to revisiting rather than
// closed for good. Re-enable by uncommenting this import, the SCENES
// entry below, the initPreviews() map entry, and the nav icon + preview
// tile in index.html (same four spots, all cross-referenced).
import { createOrrery }    from './scenes/orrery.js';
import { createLibrary }   from './scenes/library.js';
// New scene, 2026-07-31 — a staged sequence of curved mirrors, real
// reflection geometry (not transmission) bouncing a beam between them.
// See NOTES.md.
import { createBeamline }  from './scenes/beamline.js';
// Re-enabled 2026-07-23 — Scott: "given this analysis, curate the excerpts
// to create hyperlinks between them a la my other writings in the site,"
// after a close-read of the whole catalog (library_resonances.md) turned
// up genuine cross-title resonances. Shelved briefly the day before
// (1.0.54) while a data-correction round wrapped up; back live now that
// there are actual clickable cross-links (see library.js's LIBRARY_LINKS)
// worth being able to click through.
// import { createPrism } from './scenes/prism.js'; // shelved 2026-07-31 —
// Scott's call after watching the rebuilt version run live, performance
// fixes and all: still doesn't look right, not pursuing further right now.
// Same pattern as every other shelve on this project (Cycle, the golden
// hare mechanic, Lens twice, Leaf): comment out, don't delete. This closes
// out Prism's second full attempt — first an organically-grown DLA
// crystal (1.9.0-1.13.0), then this classical dispersion-prism rebuild
// (1.14.0-1.18.0, never committed) — see NOTES.md 1.19.0 for the full
// account. Neither landed; no third attempt is currently planned. Re-
// enable by uncommenting this import, the SCENES entry below, the
// initPreviews() map entry, and the nav icon + preview tile in index.html
// (same four spots Leaf's own shelving comment cross-references).
import { initColophon }    from './components/colophon.js';

// ─── Scene registry ──────────────────────────────────────────────────────────
const SCENES = {
  sphere:      { create: createSphere,     label: 'The Sphere — full screen experience. Press Escape to return.',
                 ariaLabel: 'The Sphere — interactive geodesic sphere with text fragments.' },
  butterfly:   { create: createButterfly,  label: 'Chaos Butterfly in Phase Space, 2026.',
                 ariaLabel: 'Chaos Butterfly in Phase Space, 2026 — Lorenz attractor. Drag to orbit, scroll to zoom.' },
  scroll:      { create: createScroll,     label: 'Selected Works — A Scroll of Found Writing.',
                 ariaLabel: 'Selected Works — a scroll of found writing, carved fragments, 2000 to the 2010s. Scroll to read.' },
  theater:     { create: createTheater,    label: 'The Theater — Now Playing.',
                 ariaLabel: 'The Theater — scenes from Truth and Beauty, Paul Revere, and You’ve Got a Friend in Satan, performed by ASCII actors. A different program each visit; click or use the controls to advance.' },
  orbiter:     { create: createOrbiter,    label: 'Orbiter — A p-Orbital, Satellites.',
                 ariaLabel: 'Orbiter — a hydrogen atom’s p-orbital rendered as a fuzzy probability cloud, with satellites in clean elliptical orbits around it. Drag to orbit.' },
  // leaf: { create: createLeaf, label: 'Leaf — In The End It Falls Slowly Through The Aether.',
  //         ariaLabel: 'Leaf — a raindrop’s fall from a leaf, told through real physics, locked to one fixed view; the moment it hits the ground, a hard cut opens onto a free-camera cosmic scene for the rest of the piece.' },
  // Shelved again 2026-07-31 — see the leaf.js import comment above for
  // the full re-enable checklist (four spots, cross-referenced).
  orrery:      { create: createOrrery,     label: 'The Orrery of Los Feliz.',
                 ariaLabel: 'The Orrery of Los Feliz — a found story, told through a 30-foot orrery: nine planets, their moons, an asteroid belt, in a warehouse you can walk around. Use the arrow keys or WASD to walk, click to look around, click the orrery to read.' },
  library:     { create: createLibrary,    label: 'The Library — once removed.',
                 ariaLabel: 'The Library — a real bookshelf, 107 books, films, and divination decks, rebuilt as a shelf you can turn in space. Drag to orbit, scroll to zoom, click a spine to read what it is.' },
  beamline:    { create: createBeamline,   label: 'Beamline.',
                 ariaLabel: 'Beamline — a staged sequence of curved mirrors, a beam of light bouncing between them, found text surfacing at each bounce. Drag to orbit, scroll to zoom, click a mirror to read.' },
  // prism: { create: createPrism, label: 'Prism — A Crystal, Grown.',
  //          ariaLabel: '...' },
  // Shelved 2026-07-31 — see the prism.js import comment above for the
  // full re-enable checklist (four spots, cross-referenced).
};

let activeScene  = null;
let fullInstance = null;
let lastTrigger  = null; // whichever nav icon / preview tile launched the active scene
const previews   = {};

// ─── Hash deep links ─────────────────────────────────────────────────────────
// Until 2026-07-29 the site had no routing of any kind: all eight scenes
// lived behind a click on one URL, so no scene could be linked to,
// bookmarked, shared, or reached from outside the page at all. The static
// text pages under /text/ need exactly that — a real way to send a reader
// from the writing into the piece it belongs to — so a scene needs a name
// in the URL. A full History API router would be overkill here (one page,
// eight client-rendered scenes, no server-side routes on a static host);
// a hash names a scene, costs nothing to serve, and can't 404.
//
// `syncingHash` guards the round trip: assigning location.hash fires
// hashchange, which would otherwise re-enter expandScene/returnToGallery
// for the very transition that just set it.
let syncingHash = false;

function navIconFor(sceneName) {
  return document.querySelector(`.nav-icon[data-scene="${sceneName}"]`);
}

function sceneFromHash() {
  const key = decodeURIComponent(location.hash.replace(/^#/, ''));
  // hasOwn, not `key in SCENES` — `in` walks the prototype chain, so
  // /#toString would otherwise resolve to a "scene" and throw on .create.
  return Object.hasOwn(SCENES, key) ? key : null;
}

function setHash(sceneName) {
  syncingHash = true;
  if (sceneName) {
    location.hash = sceneName;
  } else if (location.hash) {
    // replaceState rather than clearing the hash directly: assigning
    // location.hash = '' leaves a bare trailing '#' in the URL and pushes
    // a dead history entry that a Back press lands on with nothing to show.
    history.replaceState(null, '', location.pathname + location.search);
  }
  syncingHash = false;
}

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
  setHash(sceneName);

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
  setHash(null);
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
    scroll:     document.getElementById('preview-scroll'),
    theater:    document.getElementById('preview-theater'),
    orbiter:    document.getElementById('preview-orbiter'),
    // leaf:    document.getElementById('preview-leaf'), // shelved again
    // 2026-07-31, see the leaf.js import comment near the top of this
    // file for the full re-enable checklist.
    orrery:     document.getElementById('preview-orrery'),
    library:    document.getElementById('preview-library'),
    beamline:   document.getElementById('preview-beamline'),
    // prism:   document.getElementById('preview-prism'), // shelved
    // 2026-07-31, see the prism.js import comment near the top of this
    // file for the full re-enable checklist.
  };
  for (const [name, el] of Object.entries(map)) {
    if (el) previews[name] = SCENES[name].create(el, { preview: true });
  }
}

initPreviews();

// ─── Open whatever the URL names ─────────────────────────────────────────────
// Runs after initPreviews() so the landing grid behind the overlay is fully
// built either way — returning to the gallery from a deep link then finds a
// real page underneath, not an empty one. The nav icon is passed as the
// trigger so returnToGallery()'s focus restore still has somewhere sensible
// to send focus, same as a click would.
const initialScene = sceneFromHash();
if (initialScene) expandScene(initialScene, navIconFor(initialScene));

window.addEventListener('hashchange', () => {
  if (syncingHash) return; // our own write, not a real navigation
  const scene = sceneFromHash();
  if (scene) expandScene(scene, navIconFor(scene));
  else returnToGallery();
});

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
  orbiter: 'lantern',
  leaf: 'stillness',
  orrery: 'will',
  library: 'catalogued',
  prism: 'refraction',
  beamline: 'incidence',
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
