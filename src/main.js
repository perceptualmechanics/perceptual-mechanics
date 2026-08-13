import { createSphere }     from './scenes/sphere/sphere.js';
import { createButterfly }  from './scenes/butterfly/butterfly.js';
import { createScroll }    from './scenes/scroll/scroll.js';
import { createTheater } from './scenes/theater/theater.js';
import { createOrbiter }   from './scenes/orbiter/orbiter.js';
import { createOrrery }    from './scenes/orrery/orrery.js';
import { createLibrary }   from './scenes/library/library.js';
// A staged sequence of curved mirrors, real reflection geometry (not
// transmission) bouncing a beam between them.
import { createBeamline }  from './scenes/beamline/beamline.js';
import { initColophon }    from './components/colophon/colophon.js';

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
  orrery:      { create: createOrrery,     label: 'The Orrery of Los Feliz.',
                 ariaLabel: 'The Orrery of Los Feliz — a found story, told through a 30-foot orrery: nine planets, their moons, an asteroid belt, in a warehouse you can walk around. Use the arrow keys or WASD to walk, click to look around, click the orrery to read.' },
  library:     { create: createLibrary,    label: 'The Library — once removed.',
                 ariaLabel: 'The Library — a real bookshelf, 107 books, films, and divination decks, rebuilt as a shelf you can turn in space. Drag to orbit, scroll to zoom, click a spine to read what it is.' },
  beamline:    { create: createBeamline,   label: 'Beamline.',
                 ariaLabel: 'Beamline — a staged sequence of curved mirrors, a beam of light bouncing between them, found text surfacing at each bounce. Drag to orbit, scroll to zoom, click a mirror to read.' },
};

let activeScene  = null;
let fullInstance = null;
let lastTrigger  = null; // whichever nav icon / preview tile launched the active scene
const previews   = {};

// ─── Hash deep links ─────────────────────────────────────────────────────────
// A hash names the open scene (`/#scroll` etc.) so any scene can be linked
// to, bookmarked, shared, or reached from outside the page — the static
// text pages under /text/ send readers back into the piece they belong to
// this way. A full History API router would be overkill here (one page,
// eight client-rendered scenes, no server-side routes on a static host);
// a hash costs nothing to serve, and can't 404.
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
const pmNav        = document.getElementById('pm-nav');

// ─── Nav icons ────────────────────────────────────────────────────────────────
function setActiveIcon(sceneName) {
  document.querySelectorAll('.nav-icon').forEach(b => {
    b.classList.toggle('active', b.dataset.scene === sceneName);
  });
}

// ─── Modal focus containment ─────────────────────────────────────────────────
// #experience-overlay carries aria-modal="true" (index.html), which tells
// assistive tech everything outside it is inert. #pm-nav and #site-title
// sit outside #landing (which display:none already pulls out of the tab
// order and AT tree while a scene is open) but stay in the document at all
// times, so they need the same treatment made explicit: tabindex="-1"
// removes them from the keyboard tab order, aria-hidden="true" removes
// them from the AT tree. Neither touches their click handlers, so a mouse
// or touch visitor can still jump straight from one scene to another —
// only Tab-based and screen-reader navigation are actually contained,
// matching what aria-modal already promises. Escape (below) is the way
// out for keyboard/AT visitors, the same role a modal's own close control
// would play.
const chromeEls = [siteTitle, ...document.querySelectorAll('.nav-icon')];
function setChromeInert(hidden) {
  chromeEls.forEach(el => el.setAttribute('tabindex', hidden ? '-1' : '0'));
  pmNav.setAttribute('aria-hidden', String(hidden));
  siteTitle.setAttribute('aria-hidden', String(hidden));
}

// Every button/link inside the open scene, in DOM order — a read-more
// panel's close button and cross-links, a keyboard jump list's entries,
// whatever a given scene actually has. Some scenes (butterfly) have none
// at all, since there's nothing to click into; the Tab handling below
// still keeps focus contained in that case, it just has nowhere real to
// go but back to expContainer itself.
function overlayFocusables() {
  return Array.from(expContainer.querySelectorAll('button, a[href], [tabindex]'))
    .filter(el => el.tabIndex !== -1);
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

  activeScene = sceneName;
  setActiveIcon(sceneName);
  setHash(sceneName);
  setChromeInert(true);

  landing.style.display = 'none';
  overlay.classList.add('active');
  overlay.classList.toggle('butterfly-bg', sceneName === 'butterfly');
  overlay.setAttribute('aria-hidden', 'false');
  overlay.setAttribute('aria-label', SCENES[sceneName]?.ariaLabel ?? 'Full screen experience.');

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
  setChromeInert(false);
  setHash(null);

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
    // Return focus to whichever control launched this scene. Can't rely on
    // `.preview-container:focus-within` here: focus already moved into
    // expContainer the moment the scene launched (see expandScene below),
    // and clearing expContainer's innerHTML just above moves focus to
    // <body> once its focused descendant is removed from the DOM. Tracking
    // the real trigger element directly (both nav icons and preview tiles
    // stay in the DOM the whole time, just hidden) is what actually works.
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
// #site-title is a real <button> (index.html) — no href to
// preventDefault(), and Enter/Space activation comes free with the
// element, so no manual keydown handling is needed.
siteTitle.addEventListener('click', returnToGallery);

// ─── Keyboard: Escape → gallery, Tab trapped inside the open scene ─────────────
document.addEventListener('keydown', e => {
  if (!activeScene) return;
  if (e.key === 'Escape') { returnToGallery(); return; }
  if (e.key !== 'Tab') return;
  const els = overlayFocusables();
  const first = els[0] ?? expContainer;
  const last = els[els.length - 1] ?? expContainer;
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === expContainer)) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault(); first.focus();
  }
});

// ─── Preview container clicks ─────────────────────────────────────────────────
// .preview-container is a real <button> (index.html), so it gets
// Enter/Space activation for free — a single click listener on the button
// itself covers mouse, touch, and keyboard activation alike (native
// buttons dispatch a real click event for all three).
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
    orrery:     document.getElementById('preview-orrery'),
    library:    document.getElementById('preview-library'),
    beamline:   document.getElementById('preview-beamline'),
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
// Every trigger element is a real <button>, so it's keyboard-focusable —
// but onmouseover never fires on focus, so index.html pairs each
// onmouseover="pmGlimpse(...)" with a matching onfocus="pmGlimpse(...)",
// giving mouse and keyboard visitors the same 1-in-100 chance.
//
// PM_GLIMPSE_WORDS is a plain object, keyed by the same string every
// onmouseover="pmGlimpse('sphere')" etc. passes in, so the bracket lookup
// below is a real key lookup. An array of { key, text } pairs would look up
// by index instead, so a missing/renamed key would resolve to `undefined`
// rather than failing loudly.
const PM_ORIGINAL_TITLE = document.title;
const PM_GLIMPSE_WORDS = {
  sphere: 'zen archery',
  butterfly: 'complexity',
  scroll: 'savagery',
  theater: 'light entertainment',
  orbiter: 'atmosphere',
  orrery: 'will',
  library: 'medium',
  beamline: 'emergence',
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
