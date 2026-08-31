import { initColophon }    from './components/colophon/colophon.js';
import { prefersReducedMotion } from './utils/sceneKit.js';

// ─── Scene registry ──────────────────────────────────────────────────────────
// Each entry's `load()` is a dynamic import() rather than a static top-of-
// file import — Rollup code-splits each one into its own lazily-fetched
// chunk instead of folding all ten scenes (plus main.js's own logic) into
// one monolithic bundle. Before this (v3.9.17 and earlier), every scene's
// full module was a static import here, so opening *any* scene — even just
// rendering its landing-page preview thumbnail via initPreviews() below —
// required all ten to already be parsed and evaluated, which is exactly
// what tripped Rollup's "chunks larger than 500kB" warning (main chunk was
// ~558kB gzipped ~208kB). `exportName` records which named export each
// scene's module hands back (`createSphere`, `createharmonics` — note the
// lowercase h, kept internal-only per harmonics.js's own header — etc.),
// since dynamic import() resolves to the whole module namespace object,
// not a single function the way the old static imports destructured
// directly.
//
// This does NOT, by itself, shrink first-load bytes: initPreviews() still
// needs every scene's real create() to render its thumbnail (no scene's
// preview/full split has been done yet — see NOTES.md's open-items entry
// for the follow-up), so a first visit still fetches all ten chunks, just
// now as parallel per-scene requests instead of one blocking chunk. Real,
// present-tense wins: (1) editing one scene no longer invalidates every
// visitor's cached copy of the other nine on the next deploy; (2) chunks
// land under Rollup's 500kB threshold individually; (3) this is the
// infrastructure a future preview/full split plugs into for free — once a
// scene's preview branch stops needing its full-mode code, only
// initPreviews()'s call needs to change, not this registry or expandScene.
const SCENES = {
  sphere:    { load: () => import('./scenes/sphere/sphere.js'),       exportName: 'createSphere',
               label: 'The Sphere — full screen experience. Press Escape to return.',
               ariaLabel: 'The Sphere — interactive geodesic sphere with text fragments.' },
  butterfly: { load: () => import('./scenes/butterfly/butterfly.js'), exportName: 'createButterfly',
               label: 'Chaos Butterfly in Phase Space, 2026.',
               ariaLabel: 'Chaos Butterfly in Phase Space, 2026 — Lorenz attractor. Drag to orbit, scroll to zoom.' },
  scroll:    { load: () => import('./scenes/scroll/scroll.js'),       exportName: 'createScroll',
               label: 'Selected Works — A Scroll of Found Writing.',
               ariaLabel: 'Selected Works — a scroll of found writing, carved fragments, 2000 to the 2010s. Scroll to read.' },
  theater:   { load: () => import('./scenes/theater/theater.js'),     exportName: 'createTheater',
               label: 'The Theater — Now Playing.',
               ariaLabel: 'The Theater — scenes from Truth and Beauty, Paul Revere, and You’ve Got a Friend in Satan, performed by ASCII actors. A different program each visit; click or use the controls to advance.' },
  orbiter:   { load: () => import('./scenes/orbiter/orbiter.js'),     exportName: 'createOrbiter',
               label: 'Orbiter — A p-Orbital, Satellites.',
               ariaLabel: 'Orbiter — a hydrogen atom’s p-orbital rendered as a fuzzy probability cloud, with satellites in clean elliptical orbits around it. Drag to orbit.' },
  orrery:    { load: () => import('./scenes/orrery/orrery.js'),       exportName: 'createOrrery',
               label: 'The Orrery of Los Feliz.',
               ariaLabel: 'The Orrery of Los Feliz — a found story, told through a 30-foot orrery: nine planets, their moons, an asteroid belt, in a warehouse you can walk around. Use the arrow keys or WASD to walk, click to look around, click the orrery to read.' },
  library:   { load: () => import('./scenes/library/library.js'),     exportName: 'createLibrary',
               label: 'The Library — once removed.',
               ariaLabel: 'The Library — a real bookshelf, 107 books, films, and divination decks, rebuilt as a shelf you can turn in space. Drag to orbit, scroll to zoom, click a spine to read what it is.' },
  // A staged sequence of curved mirrors, real reflection geometry (not
  // transmission) bouncing a beam between them.
  beamline:  { load: () => import('./scenes/beamline/beamline.js'),   exportName: 'createBeamline',
               label: 'Beamline.',
               ariaLabel: 'Beamline — a staged sequence of curved mirrors, a beam of light bouncing between them, found text surfacing at each bounce. Drag to orbit, scroll to zoom, click a mirror to read.' },
  // Harmonics — ninth scene, Phase 3 (2026-08-16), renamed from "The
  // harmonics" 2026-08-18 (user-facing name only — internal module/
  // folder/class names stay `harmonics`, see harmonics.js's own header for
  // why). Visualizes src/resonances.js's approved Layer 2 links; see
  // harmonics.js's own header comment for the full picture.
  harmonics: { load: () => import('./scenes/harmonics/harmonics.js'), exportName: 'createharmonics',
               label: 'Harmonics.',
               ariaLabel: 'Harmonics — resonant pieces across every other scene, laid out by how strongly they connect and pulsing in sync with whatever they resonate with. Drag to orbit, scroll to zoom, touch a node.' },
  // Outside — tenth scene (2026-08-24), pivoted to a floral cosmology map
  // round 3 (same day): a generated lotus mapping the five Power Sources
  // (petals) and their Folk Origins, Magi/Psi as the center. The earlier
  // 7-vs-11 OER/Apherion projection thesis this scene shipped with is
  // fully retired — see outside.js's own header for the full picture.
  outside:   { load: () => import('./scenes/outside/outside.js'),     exportName: 'createOutside',
               label: 'Outside.',
               ariaLabel: 'Outside — a generated lotus mapping the five Sources of Power as petals and their Folk Origins, Magi and Psi at the center. The flower breathes continuously on its own. Drag to orbit, scroll to zoom, touch a petal.' },
};

// One in-flight/resolved promise per scene, shared by every caller
// (initPreviews' thumbnail render, expandScene's full-mode open, and the
// hover/touch-intent prefetch below) — import() itself already caches by
// module specifier, but caching the promise here too means a prefetch
// started on pointerenter and a click a moment later resolve the exact
// same request rather than each independently awaiting import()'s own
// cache (harmless either way, just keeps there being one obvious place to
// ask "has scene X's module been requested yet").
const sceneModulePromises = {};
function loadSceneCreate(name) {
  const entry = SCENES[name];
  return (sceneModulePromises[name] ??= entry.load()).then(mod => mod[entry.exportName]);
}
// Fire off a scene's dynamic import without waiting on it — used for
// hover/touch-intent prefetch, where the point is only to warm the cache
// before a click arrives, not to block on anything.
function prefetchScene(name) {
  if (Object.hasOwn(SCENES, name)) loadSceneCreate(name);
}

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
// Extended 2026-08-16 to a second, optional segment — `#scene/id` — naming
// a specific piece within the scene (the `id` every scene's pieces now
// carry, see NOTES.md's "Linking & addressing" entry), not just the scene
// itself. Before this, no hash below the scene level existed at all: every
// scene's own piece-open functions (openFragment, navigateToItem,
// navigateToPoem, scroll's onLinkClick, beamline's equivalent) lived
// entirely in JS memory, so a link could only ever say "open this scene,"
// never "here's the specific piece." `id` (not a title-derived slug) for
// the same reason every scene migrated off title/patch keys onto real ids
// — it's stable across a piece being retitled, and it's the same value
// links.js and every scene's own render code already key off.
//
// `syncingHash` guards the round trip: assigning location.hash fires
// hashchange, which would otherwise re-enter expandScene/returnToGallery
// for the very transition that just set it.
let syncingHash = false;

// ─── "Elsewhere" — the one cross-scene signal the harmonics reads ──────
// No scene has ever read another scene's live state (each scene's own
// "currently open piece" — orbiter's selectedSat, beamline's
// selectedStation, etc. — is a private closure, reported outward only via
// onPieceChange, which used to go nowhere but the URL hash). The
// harmonics's spider needs one thing more than the hash gives it:
// "what was the visitor just doing, elsewhere" surviving the trip INTO
// the harmonics scene itself, not just visible in the address bar of
// whatever scene they left. sessionStorage (not persisted, cleared when
// the tab closes) is the right lifetime for that — a real memory of the
// current visit, not a permanent record. harmonics reads this once on
// mount (harmonics.js); nothing else on the site reads it.
function rememberElsewhere(sceneName, pieceId) {
  if (!sceneName || sceneName === 'harmonics' || pieceId == null) return;
  try {
    sessionStorage.setItem('pm_elsewhere', JSON.stringify({ scene: sceneName, id: pieceId, t: Date.now() }));
  } catch { /* private-mode/storage-disabled — harmonics just treats every strand as un-primed */ }
}

function navIconFor(sceneName) {
  return document.querySelector(`.nav-icon[data-scene="${sceneName}"]`);
}

// ─── Public URL slug for Harmonics (3.1.3, 2026-08-23) ─────────────────────
// The 2026-08-18 rename deliberately kept every INTERNAL name —
// src/scenes/harmonics/, the SCENES registry key below, .harmonics-*
// CSS classes — as `harmonics` (see main.js's own header and
// harmonics.js's), reasoning that none of that is visible to a visitor.
// The URL hash turned out to be the one exception: it's the literal address
// bar text, seen and shareable, not implementation detail — flagged live by
// Scott after the rename had otherwise fully shipped. No real `#harmonics`
// links exist anywhere to preserve (the scene only just started writing that
// hash at all, and never publicly), so this is NOT a backward-compat shim —
// it's a one-way translation at the two seams where a hash is actually read
// or written: setHash writes the public slug, parseHash reads it back. The
// SCENES key itself stays `harmonics` rather than being renamed
// (cascades into index.html's data-scene attributes, #preview-harmonics,
// main.js's own PM_GLIMPSE_WORDS key, and every other place the internal
// string is compared, for a complaint that was specifically about the URL).
const PUBLIC_SLUG = { harmonics: 'harmonics', outside: 'outside' }; // internal SCENES key -> URL slug
const SLUG_TO_INTERNAL = Object.fromEntries(Object.entries(PUBLIC_SLUG).map(([k, v]) => [v, k]));

// Returns { scene, pieceId } — pieceId is null when the hash only names a
// scene (`#scroll`) or the piece segment isn't a valid positive integer.
function parseHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
  const [rawKey, pieceRaw] = raw.split('/');
  const sceneKey = SLUG_TO_INTERNAL[rawKey] ?? rawKey;
  // hasOwn, not `key in SCENES` — `in` walks the prototype chain, so
  // /#toString would otherwise resolve to a "scene" and throw on .create.
  const scene = Object.hasOwn(SCENES, sceneKey) ? sceneKey : null;
  const pieceId = pieceRaw !== undefined && /^\d+$/.test(pieceRaw) ? Number(pieceRaw) : null;
  return { scene, pieceId: scene ? pieceId : null };
}

// `push`: true for a real scene-to-scene navigation (adds a Back-able
// history entry, existing behavior, unchanged) — false for a piece-level
// update inside a scene that's already open (a click on a fragment/poem/
// item link, or the jump list). Those use replaceState so following ten
// cross-links doesn't leave ten dead entries between the visitor and the
// Back button; Back still means "leave the scene," same as before this
// piece-level hash existed at all.
function setHash(sceneName, pieceId, { push = true } = {}) {
  syncingHash = true;
  const publicName = sceneName ? (PUBLIC_SLUG[sceneName] ?? sceneName) : sceneName;
  const next = publicName ? (pieceId ? `${publicName}/${pieceId}` : publicName) : '';
  if (next) {
    if (push) {
      location.hash = next;
    } else {
      history.replaceState(null, '', `${location.pathname}${location.search}#${next}`);
    }
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
const fsToggle     = document.getElementById('fullscreen-toggle');

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
const chromeEls = [siteTitle, fsToggle, ...document.querySelectorAll('.nav-icon')];
function setChromeInert(hidden) {
  chromeEls.forEach(el => el.setAttribute('tabindex', hidden ? '-1' : '0'));
  pmNav.setAttribute('aria-hidden', String(hidden));
  siteTitle.setAttribute('aria-hidden', String(hidden));
  fsToggle?.setAttribute('aria-hidden', String(hidden));
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
//
// `pieceId`: which piece (fragment/poem/item/patch/bounce — the `id` each
// scene's pieces now carry) to open immediately, if any. Passed through as
// `initialPieceId` to the scene's own create(), which is what actually
// opens it — main.js has no idea what a "piece" looks like inside a given
// scene, only that scenes which support this open one on mount and report
// every subsequent change back via `onPieceChange`. Scenes that don't
// support piece-level addressing yet (theater's shuffled reel has no
// random-access "open scene N" the way the others have "open piece N";
// orrery has exactly one piece and no separate open/closed state to begin
// with) just ignore `initialPieceId`/`onPieceChange` — see each scene's own
// create() for whether it's wired.
// True only for the span between a swap-transition's fade-out starting
// and its fade-in finishing mounting — guards against a second nav click
// or Escape landing mid-fade and racing the pending mountNext() below
// (dispose-ing/creating on top of a transition already in flight).
let transitioning = false;

function expandScene(sceneName, triggerEl = null, pieceId = null) {
  if (transitioning) return;
  if (activeScene === sceneName) {
    // Already open — a same-scene deep link (address-bar edit, or a
    // cross-link that happens to land back on this scene) still needs to
    // open the new piece, just without tearing the scene down and
    // rebuilding it from scratch.
    if (pieceId) fullInstance?.openPieceById?.(pieceId);
    return;
  }
  lastTrigger = triggerEl;

  // Direct scene-to-scene (one full instance already live, jumping
  // straight to a different one) vs. gallery-to-scene (activeScene is
  // null, the overlay is about to fade in from nothing for the first
  // time). Only the former ever cut instantly with no transition at all
  // — reported 2026-08-18 via a Harmonics resonant-link click, but the
  // instant cut was never specific to that path: nav-icon-to-nav-icon
  // while a scene is already open goes through this exact same branch
  // and was equally an instant cut, just rarely exercised (most
  // navigation goes scene → gallery → scene, which already had the fade
  // below via returnToGallery). Fixed at the root (this function, the
  // one seam every direct scene jump already shares — nav icon,
  // preview tile, hash change, pm:navigate alike) rather than special-
  // cased for Harmonics.
  const swapping = activeScene !== null;

  function mountNext() {
    if (fullInstance) {
      fullInstance.dispose();
      fullInstance = null;
      expContainer.innerHTML = '';
    }

    activeScene = sceneName;
    setActiveIcon(sceneName);
    setHash(sceneName, pieceId);
    rememberElsewhere(sceneName, pieceId);
    setChromeInert(true);

    landing.style.display = 'none';
    overlay.classList.add('active');
    overlay.classList.toggle('butterfly-bg', sceneName === 'butterfly');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-label', SCENES[sceneName]?.ariaLabel ?? 'Full screen experience.');

    // The scene's module is usually already resolved by the time this
    // runs — initPreviews() below requests every scene's module on page
    // load, and hovering/touching a nav icon or preview tile prefetches it
    // too (see the pointerenter/touchstart listeners further down) — so
    // loadSceneCreate() below typically settles on the very next
    // microtask. `pm-loading` is only added if it DOESN'T settle within
    // 150ms, so the fast/common path never flashes a spinner for one
    // frame; the slow path (a cold click against a chunk nothing prefetched
    // yet — the case this whole loading state exists for) gets a real
    // "still working" signal instead of an apparent freeze.
    let loadingShown = false;
    const loadingTimer = setTimeout(() => {
      loadingShown = true;
      overlay.classList.add('pm-loading');
    }, 150);

    loadSceneCreate(sceneName).then(create => {
      clearTimeout(loadingTimer);
      if (loadingShown) overlay.classList.remove('pm-loading');
      // A second navigation could have moved on to a different scene
      // while this one's module was still in flight (rapid nav-icon
      // clicks, or a hashchange landing mid-fetch) — activeScene would
      // already point at that later scene by the time this resolves, so
      // bail rather than mounting a scene nobody's looking at anymore.
      if (activeScene !== sceneName) return;

      fullInstance = create(expContainer, {
        preview: false,
        initialPieceId: pieceId,
        // A piece opened *inside* the already-open scene (a fragment click, a
        // jump-list selection, a cross-link) updates the hash's piece segment
        // without pushing a new history entry — see setHash's own comment for
        // why (`push: false`). sceneName is closed over rather than read from
        // `activeScene` so this can't fire against a hash update for a scene
        // that's since been torn down and replaced.
        onPieceChange: id => { setHash(sceneName, id, { push: false }); rememberElsewhere(sceneName, id); },
      });
      // Focus the container for screen readers
      expContainer.setAttribute('tabindex', '-1');
      setTimeout(() => expContainer.focus(), 100);
      transitioning = false;
    });
  }

  // Guards re-entrancy for the whole async span now, not just the fade —
  // a nav click landing while the previous scene's module is still being
  // fetched (mountNext above, between being called and its loadSceneCreate
  // resolving) should no-op via the `if (transitioning) return` at the top
  // of this function, same as during the fade itself.
  transitioning = true;

  if (swapping && !prefersReducedMotion()) {
    // Reuses #experience-overlay's own opacity transition (styles/main.css,
    // 0.6s ease) — the same fade returnToGallery already plays on the
    // gallery edge — just retriggered here for a scene-to-scene jump
    // instead of only scene-to-gallery. Toggling `.active` off fades the
    // whole overlay (background + the old scene's own canvas, both
    // children of it) down through near-black (#000811, matching body's
    // own #000 — no flash to an unrelated color); mountNext tears down
    // the old instance, builds the new one, and turns `.active` back on
    // once there's something real to fade up into.
    overlay.classList.remove('active');
    setTimeout(mountNext, 600);
  } else {
    // Reduced motion: main.css already sets `#experience-overlay
    // { transition: none }` under this media query, so toggling `.active`
    // off/on would just be two instant jumps with a dead 600ms gap in
    // between — worse than today's true instant cut, not an accommodation.
    // Skip the delay entirely instead, matching every other reduced-motion
    // check on the site (skip the motion, don't replace it with a pause).
    mountNext();
  }
}

// ─── Return to gallery ────────────────────────────────────────────────────────
function returnToGallery() {
  if (transitioning || !activeScene) return;

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
// pointerenter/touchstart prefetch the scene's module ahead of the actual
// click — mouse visitors reliably hover before they click, and a touch's
// touchstart fires before its trailing click by enough margin to matter on
// a warm cache. { once: true } isn't used here: hovering off and back onto
// a nav icon should be free to prefetch again if the very first attempt
// somehow failed (a dropped request), and loadSceneCreate's own promise
// cache already makes every prefetch after the first a no-op, not a
// second real fetch.
document.querySelectorAll('.nav-icon').forEach(btn => {
  const scene = btn.dataset.scene;
  btn.addEventListener('pointerenter', () => prefetchScene(scene));
  btn.addEventListener('touchstart', () => prefetchScene(scene), { passive: true });
  btn.addEventListener('click', () => {
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
  const scene = w.dataset.scene;
  container.addEventListener('pointerenter', () => prefetchScene(scene));
  container.addEventListener('touchstart', () => prefetchScene(scene), { passive: true });
  container.addEventListener('click', () => expandScene(scene, container));
});

// ─── Init previews ────────────────────────────────────────────────────────────
// Still requests every scene's real module immediately on page load — no
// scene's preview branch has been split from its full-mode code yet (see
// the SCENES registry comment above and NOTES.md's open-items entry), so
// there's no lighter path to render a thumbnail with yet. What changed:
// each request is now its own dynamic import() (parallel per-scene chunks)
// instead of all ten already sitting in one statically-imported bundle —
// loadSceneCreate() shares its promise cache with expandScene() and the
// hover/touch prefetch listeners above, so none of these ever double-fetch
// the same scene.
async function initPreviews() {
  const map = {
    sphere:     document.getElementById('preview-sphere'),
    butterfly:  document.getElementById('preview-butterfly'),
    scroll:     document.getElementById('preview-scroll'),
    theater:    document.getElementById('preview-theater'),
    orbiter:    document.getElementById('preview-orbiter'),
    orrery:     document.getElementById('preview-orrery'),
    library:    document.getElementById('preview-library'),
    beamline:   document.getElementById('preview-beamline'),
    harmonics: document.getElementById('preview-harmonics'),
    outside:    document.getElementById('preview-outside'),
  };
  await Promise.all(Object.entries(map).map(async ([name, el]) => {
    if (!el) return;
    const create = await loadSceneCreate(name);
    previews[name] = create(el, { preview: true });
  }));
}

initPreviews();

// ─── Open whatever the URL names ─────────────────────────────────────────────
// Called right after initPreviews() kicks off (not after it finishes —
// initPreviews() is async now, see above) so the landing grid behind the
// overlay still ends up fully built either way once its own loads settle;
// returning to the gallery from a deep link then finds a real page
// underneath, not an empty one. expandScene() here fires its own
// loadSceneCreate() for the target scene immediately — this is the
// "initial-page-load deep link triggers the lazy import right away" path —
// and shares loadSceneCreate's promise cache with initPreviews' own request
// for the same scene, so a deep link never double-fetches the scene it's
// opening. The nav icon is passed as the trigger so returnToGallery()'s
// focus restore still has somewhere sensible to send focus, same as a
// click would.
const initialHash = parseHash();
if (initialHash.scene) expandScene(initialHash.scene, navIconFor(initialHash.scene), initialHash.pieceId);

window.addEventListener('hashchange', () => {
  if (syncingHash) return; // our own write, not a real navigation
  const { scene, pieceId } = parseHash();
  if (scene) expandScene(scene, navIconFor(scene), pieceId);
  else returnToGallery();
});

// ─── pm:navigate ─────────────────────────────────────────────────────────
// Generic cross-scene jump, dispatched rather than imported directly so a
// scene module never needs a reference to expandScene or to know main.js
// exists — routed through expandScene (not a bespoke path) so it gets the
// exact same history/hash/focus handling as a nav-icon click. Originally
// built for two Harmonics-specific entry points (ground-glimpse, thread-
// follow — both retired 2026-08-18, see src/utils/harmonicsEntry.js's
// own header) plus Harmonics' own payoff panel jumping to either side of a
// resonance; only the last of those three still fires this event. `pieceId`
// is whatever the target scene's own `initialPieceId` expects (a real piece
// id, per each scene's own create()) — main.js has no idea what a "piece"
// looks like inside any given scene, same as every other cross-scene deep
// link passing through this file.
window.addEventListener('pm:navigate', e => {
  const { scene: targetScene, pieceId } = e.detail ?? {};
  if (targetScene && Object.hasOwn(SCENES, targetScene)) {
    expandScene(targetScene, navIconFor(targetScene), pieceId ?? null);
  }
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
  harmonics: 'vibe',
  outside: 'bloom',
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

// ─── Fullscreen toggle ───────────────────────────────────────────────────────
// Standard Fullscreen API, wired once here rather than duplicated into each
// scene — see index.html's own comment at the button. Fullscreens
// document.documentElement (the whole page: nav, landing, and any open
// scene alike), matching the brief's "site-wide," not "per-scene."
//
// Feature-detected at load, not just at click time: iOS Safari has no
// element/document Fullscreen API outside a <video>, so the button stays
// `hidden` there rather than showing a control that would silently do
// nothing on tap — the same "withhold what the platform doesn't actually
// support" principle as every other honest-capability-signaling choice on
// this site (e.g. NEWEST_ORIGINS's glow layer only marking what's actually
// new, not decorating every origin the same way).
const fsEnabled = document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? false;
if (fsToggle && fsEnabled) {
  fsToggle.hidden = false;

  const FS_ICON_ENTER = '<path d="M8 3H4a1 1 0 0 0-1 1v4M16 3h4a1 1 0 0 1 1 1v4M8 21H4a1 1 0 0 1-1-1v-4M16 21h4a1 1 0 0 0 1-1v-4"/>';
  const FS_ICON_EXIT = '<path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"/>';

  const isFullscreen = () => Boolean(document.fullscreenElement ?? document.webkitFullscreenElement);

  function syncFsToggle() {
    const active = isFullscreen();
    fsToggle.setAttribute('aria-pressed', String(active));
    fsToggle.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
    fsToggle.title = active ? 'Exit fullscreen' : 'Enter fullscreen';
    const svg = fsToggle.querySelector('svg');
    if (svg) svg.innerHTML = active ? FS_ICON_EXIT : FS_ICON_ENTER;
  }

  fsToggle.addEventListener('click', () => {
    if (isFullscreen()) {
      const exit = document.exitFullscreen ?? document.webkitExitFullscreen;
      exit?.call(document);
    } else {
      const root = document.documentElement;
      const request = root.requestFullscreen ?? root.webkitRequestFullscreen;
      // Denied, blocked, or simply unsupported as a Promise (older
      // webkit-prefixed implementations don't return one) — nothing to
      // recover either way, the button's own state just stays "not
      // fullscreen," which is already accurate.
      request?.call(root)?.catch?.(() => {});
    }
  });

  // 'fullscreenchange' fires on document per spec — covers Escape, the
  // browser's own chrome control, and this button alike, so syncFsToggle
  // only needs to live in one place regardless of how fullscreen was
  // exited. webkitfullscreenchange alongside it for older Safari.
  document.addEventListener('fullscreenchange', syncFsToggle);
  document.addEventListener('webkitfullscreenchange', syncFsToggle);
  syncFsToggle();
}
