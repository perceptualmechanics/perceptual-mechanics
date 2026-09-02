import { initColophon }    from './components/colophon/colophon.js';
import { anyPanelOpen, prefersReducedMotion } from './utils/sceneKit.js';
import { SCENES } from './scenes/registry.js';

// The registry is deliberately import-free (see its header), so the loaders are
// derived here from its keys rather than listed beside them. `import.meta.glob`
// is Vite's own build-time directory read: it produces the same per-scene
// dynamic imports the registry used to spell out, still lazy and still code-
// split, but with no second list of eleven scene names to fall out of step with
// the first. A scene whose folder and file don't match its registry key fails
// on open with a named error rather than a bare undefined.
const sceneModules = import.meta.glob('./scenes/*/*.js');
function loadSceneModule(name) {
  const id = `./scenes/${name}/${name}.js`;
  const loader = sceneModules[id];
  if (!loader) {
    return Promise.reject(new Error(
      `scene "${name}" is in the registry but ${id} does not exist — a scene's folder and entry file must both be named after its registry key`));
  }
  return loader();
}

// One in-flight/resolved promise per scene, shared by every caller
// (initPreviews' thumbnail render, expandScene's full-mode open, and the
// hover/touch-intent prefetch below) — import() itself already caches by
// module specifier, but caching the promise here too means a prefetch
// started on pointerenter and a click a moment later resolve the exact
// same request rather than each independently awaiting import()'s own
// cache (harmless either way, just keeps there being one obvious place to
// ask "has scene X's module been requested yet").
const sceneModulePromises = {};
// A REJECTED import() must be evicted from this cache, never kept. The
// realistic trigger for one isn't exotic: a returning visitor whose cached
// index.html still names a hashed chunk that a later deploy replaced — the
// fetch 404s and the promise rejects. Before 4.0 that rejected promise
// stayed in sceneModulePromises forever, so every subsequent attempt at
// that scene (a second click, the nav icon, a hash change, the preview)
// re-awaited the same dead promise and could never re-fetch: the scene was
// permanently unopenable until a manual reload, which is also the one
// action that would have fixed it. Deleting the entry on rejection is what
// makes a retry an actual retry. It lives here, in the one function every
// caller already shares, rather than being repeated at each call site.
function loadSceneCreate(name) {
  const entry = SCENES[name];
  sceneModulePromises[name] ??= loadSceneModule(name).catch(err => {
    delete sceneModulePromises[name];
    throw err;
  });
  return sceneModulePromises[name].then(mod => mod[entry.exportName]);
}
// Fire off a scene's dynamic import without waiting on it — used for
// hover/touch-intent prefetch, where the point is only to warm the cache
// before a click arrives, not to block on anything.
// The .catch() here isn't politeness. A prefetch is fire-and-forget by
// definition — nobody awaits it — so a failed chunk fetch on hover would
// otherwise surface as an unhandled promise rejection in the console (and
// in any error reporting) for a visitor who never even clicked the scene.
// The eviction in loadSceneCreate has already done the only useful work
// there is to do about a warm-up that didn't warm up.
function prefetchScene(name) {
  if (Object.hasOwn(SCENES, name)) loadSceneCreate(name).catch(() => {});
}

let activeScene  = null;
let fullInstance = null;
let lastTrigger  = null; // whichever nav icon / preview tile launched the active scene
// True only while the CURRENT activeScene's module failed to load, so the
// error state is showing instead of a scene. Lets a second click on the
// same nav icon/tile be a real retry rather than expandScene's
// already-open early return — see expandScene.
let sceneLoadFailed = false;
// Handle for the one animation frame between a scene mounting and focus
// moving into it, kept only so returnToGallery can cancel it — see
// mountNext. 0 is cancelAnimationFrame's safe no-op argument.
let pendingFocusFrame = 0;

// ─── Preview playback ────────────────────────────────────────────────────
// This map was written by initPreviews() and read by absolutely nothing
// from 3.10.0 until 4.0 — which is the whole bug. expandScene() sets
// `landing.style.display = 'none'`, and display:none does NOT stop a
// requestAnimationFrame loop: the callbacks keep being scheduled and the
// WebGL draw calls keep being issued, they just render into a subtree
// nobody can see. Counted live before the fix: nine live canvases on a
// machine showing exactly one scene — the open scene plus all ten
// previews still drawing at 60fps behind an opaque overlay. Each scene's
// create() may now return a `setPaused(paused)`; every call below is
// optional-chained because scene modules adopt it independently of this
// file, and a scene that hasn't yet simply keeps its old behavior.
const previews = {};
// Per-preview visibility, from the IntersectionObserver in initPreviews().
// Undefined until the observer has reported on a tile for the first time,
// which is deliberately treated as "on screen" — the tiles that matter are
// above the fold, and a tile that has never been observed should render,
// not sit frozen waiting for a callback that already fired.
const previewOnScreen = {};
// Site-level reasons to stop ALL previews at once, independent of which
// tiles happen to be scrolled into view: a scene is open on top of them,
// or the tab isn't being looked at.
let previewsSuspended = false;

function syncPreviewPlayback() {
  previewsSuspended = Boolean(activeScene) || document.hidden;
  for (const [name, instance] of Object.entries(previews)) {
    instance?.setPaused?.(previewsSuspended || previewOnScreen[name] === false);
  }
}

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

// Returns { scene, pieceId, arg }.
//
// `pieceId` is null when the hash only names a scene (`#scroll`) or the second
// segment isn't a valid positive integer. `arg` is that second segment when it
// is present and NOT a piece id — a third hash shape, added 4.5.0 so Apollo can
// carry a mixture in a link (`#apollo/ca95,h85,na80`).
//
// The two shapes cannot be confused, and that is a property of the existing
// code rather than something this had to add: the piece segment has always
// required `/^\d+$/`, so anything non-numeric already fell through as "no
// piece". What did have to change is setHash below, which used to rebuild the
// hash from scene + pieceId alone and so erased a mixture from the address bar
// the instant a visitor arrived at a shared link.
function parseHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
  const slash = raw.indexOf('/');
  const rawKey = slash === -1 ? raw : raw.slice(0, slash);
  const rest = slash === -1 ? undefined : raw.slice(slash + 1);
  const sceneKey = SLUG_TO_INTERNAL[rawKey] ?? rawKey;
  // hasOwn, not `key in SCENES` — `in` walks the prototype chain, so
  // /#toString would otherwise resolve to a "scene" and throw on .create.
  const scene = Object.hasOwn(SCENES, sceneKey) ? sceneKey : null;
  const isPiece = rest !== undefined && /^\d+$/.test(rest);
  return {
    scene,
    pieceId: scene && isPiece ? Number(rest) : null,
    arg: scene && rest !== undefined && !isPiece && rest !== '' ? rest : null,
  };
}

// `push`: true for a real scene-to-scene navigation (adds a Back-able
// history entry, existing behavior, unchanged) — false for a piece-level
// update inside a scene that's already open (a click on a fragment/poem/
// item link, or the jump list). Those use replaceState so following ten
// cross-links doesn't leave ten dead entries between the visitor and the
// Back button; Back still means "leave the scene," same as before this
// piece-level hash existed at all.
function setHash(sceneName, pieceId, { push = true, arg = null } = {}) {
  syncingHash = true;
  const publicName = sceneName ? (PUBLIC_SLUG[sceneName] ?? sceneName) : sceneName;
  // A piece id wins over an arg — they occupy the same segment, and no scene
  // has both. `arg` is passed through verbatim rather than re-encoded: it is
  // the scene's own string and the scene is what has to be able to read it
  // back.
  const suffix = pieceId ? `/${pieceId}` : (arg ? `/${arg}` : '');
  const next = publicName ? `${publicName}${suffix}` : '';
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
const expHeading   = document.getElementById('experience-heading');
const expError     = document.getElementById('experience-error');
const expReload    = document.getElementById('experience-error-reload');
const landing      = document.getElementById('landing');
const siteTitle    = document.getElementById('site-title');
const titleRow     = document.getElementById('site-title-row');
const pmNav        = document.getElementById('pm-nav');
const fsToggle     = document.getElementById('fullscreen-toggle');
const skipLink     = document.querySelector('.skip-link');

// ─── The crossfade duration, declared once ───────────────────────────────
// #experience-overlay's `transition: opacity var(--scene-crossfade)` and the
// setTimeout()s that wait for that transition to finish have to agree, or
// the teardown either lands mid-fade (visible flash) or after a dead pause.
// They used to agree by three separate hardcoded 600s — one in main.css,
// two here. Reading the custom property means the stylesheet stays the
// single source of truth and a designer retuning the fade doesn't have to
// know this file exists. The fallback matters: getPropertyValue returns ''
// for an undeclared property, and `600 * NaN` timeouts fire immediately,
// which would tear the old scene down on the first frame of its own fade.
const CROSSFADE_MS = (() => {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--scene-crossfade').trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return 600;
  return raw.endsWith('ms') ? n : n * 1000;
})();

// ─── Nav icons ────────────────────────────────────────────────────────────────
function setActiveIcon(sceneName) {
  document.querySelectorAll('.nav-icon').forEach(b => {
    b.classList.toggle('active', b.dataset.scene === sceneName);
  });
}

// ─── Focus containment while a scene is open ─────────────────────────────
// What this used to be (3.x): a hand-rolled setChromeInert() that stamped
// tabindex="-1" onto #site-title, #fullscreen-toggle and every .nav-icon,
// then set aria-hidden="true" on #pm-nav / #site-title / #fullscreen-toggle,
// and on the way back out stamped an explicit tabindex="0" onto native
// <button>s that never needed one. Two things were wrong with it:
//
//   1. aria-hidden on #pm-nav while its <button> descendants stayed
//      focusable is the textbook ARIA-in-HTML violation — a screen reader
//      lands on a control it has been told does not exist. It only avoided
//      that in practice because the same call happened to set tabindex="-1"
//      in the same breath; the two lines were load-bearing for each other
//      with nothing saying so.
//   2. It was hiding, from assistive tech, chrome that stays fully VISIBLE
//      and fully CLICKABLE during a scene. #pm-nav (z-index 500) and
//      #site-title-row (400) both sit above #experience-overlay (300) on
//      purpose — index.html says it outright at the overlay: "no close
//      button; nav is the navigation." A sighted mouse or touch visitor
//      jumps straight from scene to scene, or taps the title to leave.
//      Telling a screen-reader user that navigation isn't there is not a
//      containment policy, it's a worse experience for one group only.
//
// The obvious-looking modernization — `inert` on #pm-nav and
// #site-title-row — was tried and rejected here, and this comment exists so
// it doesn't get re-proposed every audit: `inert` also kills POINTER
// interaction, which on a phone removes the only two exits a scene has.
// There is no Escape key on a touch device; the nav icons and the site
// title ARE the close button. Inerting them strands the visitor in the
// scene with nothing but the browser's own Back gesture. `inert` is the
// right tool for genuinely background content; this chrome isn't
// background, it's the dialog's own controls that happen to live outside
// its box.
//
// So: nothing gets hidden or un-focusable any more. `aria-modal="true"`
// came off #experience-overlay in the same pass (index.html) for exactly
// the same reason — it asserts "everything outside me is inert," which was
// never true here and was the thing pushing this file toward hiding real
// controls to make the assertion honest. Containment is now done purely by
// the Tab ring below, which includes every control that is actually on
// screen and excludes #landing (display:none already removes it from both
// the tab order and the AT tree).

// The full Tab ring while a scene is open, in the order a visitor should
// walk it. Four groups, in this order:
//   1. Whatever the scene itself put inside #experience-container — a
//      read-more panel's close button and cross-links, a jump list's
//      entries. Some scenes (butterfly) have none at all.
//   2. The overlay's own furniture outside that container, which today
//      means the scene-load error state's Reload button.
//   3. Body-level scene chrome marked `.pm-scene-chrome`. Harmonics' and
//      Outside's sound toggles are deliberately appended to document.body,
//      not to #experience-container, because the z-index scale (see the top
//      of styles/main.css) requires body-level scene overlays to sit at
//      >=310 to clear the overlay itself. That put them outside every query
//      this function used to make: confirmed live that
//      .outside-sound-toggle's parentNode is BODY, and that the toggle was
//      therefore keyboard-unreachable for as long as it has existed — Tab
//      from inside the scene wrapped back to the top of the container and
//      never reached it. `.pm-scene-chrome` is the agreed marker class for
//      exactly this: a scene adds it to anything it hangs off <body> that a
//      visitor is meant to be able to operate.
//   4. The persistent site chrome — skip link, nav icons, site title,
//      fullscreen toggle — which is where a keyboard visitor goes to leave
//      the scene, and now the same route a mouse visitor already had.
//
// The four groups say what's IN the ring, not what order it's walked in.
// The list is sorted into document order before use, because this handler
// only ever intercepts the two ends (Tab off the last element, Shift+Tab
// off the first) and lets the browser sequence everything in between —
// imposing a different order here would just make the wrap points land in
// the middle of the visitor's actual path. Document order is already the
// right story anyway: site chrome, then the scene, then the scene's own
// body-level controls.
const FOCUSABLE = 'button, a[href], [tabindex]';
function collect(root) {
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter(el =>
    // tabIndex -1 is opt-out (expContainer itself, colophon's h2).
    el.tabIndex !== -1 &&
    // `hidden` on an ancestor (the error state when there's no error,
    // #fullscreen-toggle where the platform has no Fullscreen API) means
    // display:none, which is not focusable however it got there.
    !el.closest('[hidden]') &&
    !el.disabled
  );
}
function overlayFocusables() {
  // `.pm-scene-chrome` may be ON the control itself (a bare sound-toggle
  // <button> hung off body) or on a wrapper around several — accept both.
  const sceneChrome = Array.from(document.querySelectorAll('.pm-scene-chrome'))
    .filter(el => !overlay.contains(el))
    .flatMap(el => (el.matches(FOCUSABLE) ? [el] : []).concat(collect(el)))
    .filter(el => el.tabIndex !== -1 && !el.closest('[hidden]') && !el.disabled);
  const siteChrome = [skipLink, ...document.querySelectorAll('.nav-icon'), siteTitle, fsToggle]
    .filter(el => el && !el.hidden);
  // A Set, not concat: `.pm-scene-chrome` on a control that is itself inside
  // another `.pm-scene-chrome` wrapper would otherwise appear twice and make
  // the wrap points stutter.
  return [...new Set([...collect(overlay), ...sceneChrome, ...siteChrome])]
    .sort((a, b) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
}

// ─── Scene-load failure ──────────────────────────────────────────────────
// The first error state this site has ever had. Until 4.0 there was no
// .catch() anywhere in the load path at all, and a single rejected
// import() bricked the entire page: loadingTimer was never cleared, so the
// spinner ran forever; `transitioning` never went back to false, and both
// expandScene() and returnToGallery() open with `if (transitioning)
// return`, so from that moment every nav click, every hash change and
// every Escape was a silent no-op. The page looked alive and answered
// nothing.
//
// Copy rules, deliberately: say what happened and say what fixes it, in
// the reader's terms. No status codes, no "chunk", no "module", no
// "error" — and no apology, which would put the visitor in the position of
// consoling the site. Reload genuinely is the fix in the common case (a
// cached index.html pointing at a filename a deploy replaced), and the
// button is a real button so it's reachable by keyboard and included in
// the Tab ring above.
function showSceneLoadError() {
  overlay.classList.remove('pm-loading');
  overlay.classList.add('pm-load-error');
  if (expError) expError.hidden = false;
}
function clearSceneLoadError() {
  sceneLoadFailed = false;
  overlay.classList.remove('pm-load-error');
  if (expError) expError.hidden = true;
}
expReload?.addEventListener('click', () => location.reload());

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

function expandScene(sceneName, triggerEl = null, pieceId = null, sceneArg = null) {
  if (transitioning) return;
  // `!sceneLoadFailed` is what makes a retry possible: when the module
  // never arrived, activeScene still names this scene (the overlay is
  // genuinely showing its slot, and Escape still has to mean "leave it"),
  // so without this the early return below would swallow the second click
  // on the very icon the visitor is using to try again.
  if (activeScene === sceneName && !sceneLoadFailed) {
    // Already open — a same-scene deep link (address-bar edit, or a
    // cross-link that happens to land back on this scene) still needs to
    // open the new piece, just without tearing the scene down and
    // rebuilding it from scratch.
    // A mixture arriving for the scene that is already open — a second shared
    // link followed from the first, or an address-bar edit. Applied before the
    // piece branch because they are different segments of the same slot and no
    // scene has both.
    if (sceneArg) { fullInstance?.applyArg?.(sceneArg); setHash(sceneName, null, { push: false, arg: sceneArg }); return; }
    if (pieceId) fullInstance?.openPieceById?.(pieceId);
    // ...and `#scene/id` edited back down to `#scene` has to mean "close
    // the piece," which is the whole point of a hash that addresses one.
    // Before 4.0 this branch simply did nothing in that case: the URL said
    // no piece was open while the panel was still sitting there on screen.
    // Optional-chained rather than requiring the method — a scene with no
    // piece-level open/closed state (theater, orrery) has nothing to close
    // and needs no no-op stub of its own to satisfy this call.
    else fullInstance?.closePiece?.();
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

    clearSceneLoadError();
    activeScene = sceneName;
    setActiveIcon(sceneName);
    setHash(sceneName, pieceId, { arg: sceneArg });
    rememberElsewhere(sceneName, pieceId);

    landing.style.display = 'none';
    // Every preview stops here, not just visually. See the `previews`
    // comment above for what display:none does and doesn't do to a
    // requestAnimationFrame loop.
    syncPreviewPlayback();
    overlay.classList.add('active');
    // `.butterfly-bg` used to hardcode one scene's name into both this file
    // and main.css. The backdrop is now a registry field surfaced as a
    // custom property, and `data-scene` is on the overlay for anything that
    // wants to style or debug per-scene without another class to remember.
    overlay.dataset.scene = sceneName;
    const overlayBg = SCENES[sceneName]?.overlayBg;
    if (overlayBg) overlay.style.setProperty('--overlay-bg', overlayBg);
    else overlay.style.removeProperty('--overlay-bg');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-label', SCENES[sceneName]?.ariaLabel ?? 'Full screen experience.');
    // #landing owns the page's only <main> and its only <h1>, and
    // expandScene hides it — so from the moment a scene opened, a screen
    // reader navigating this page by landmark or by heading found exactly
    // nothing: inside #sphere the tree was NAV (itself aria-hidden) and
    // MAIN (hidden), with no heading at any level. #experience-container
    // carries role="main" statically (index.html); this fills in the
    // heading. SCENES[].label is the field for it — it has read as a
    // human-facing sentence since the registry was written and, until now,
    // had no reader anywhere in the codebase.
    if (expHeading) expHeading.textContent = SCENES[sceneName]?.label ?? 'Full screen experience.';

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
        // The third hash shape, handed to the scene as an opaque string. Only
        // Apollo reads it today (a fader mixture); every other scene ignores an
        // option it was not written to expect, which is why this is one extra
        // property rather than a routing change.
        initialArg: sceneArg,
        // How a scene writes that string back. Explicit action only —
        // replaceState so a fader drag can never fill the history with junk,
        // and nothing calls this on its own.
        onStateChange: str => setHash(sceneName, null, { push: false, arg: str || null }),
        // A piece opened *inside* the already-open scene (a fragment click, a
        // jump-list selection, a cross-link) updates the hash's piece segment
        // without pushing a new history entry — see setHash's own comment for
        // why (`push: false`). sceneName is closed over rather than read from
        // `activeScene` so this can't fire against a hash update for a scene
        // that's since been torn down and replaced.
        onPieceChange: id => { setHash(sceneName, id, { push: false }); rememberElsewhere(sceneName, id); },
      });
      // Focus the container for screen readers. It needs tabindex="-1" to
      // be focusable at all: only some scenes set it themselves (sphere,
      // via claimContainer), and the ones that don't — butterfly among them
      // — leave a plain <div> that .focus() silently declines to move focus
      // to, so the skip link and this call both landed nowhere. Set here,
      // unconditionally, after create() has had its say.
      //
      // The frame, meanwhile, was a bare
      // setTimeout(..., 100) — an arbitrary number nobody could justify and
      // a handle nobody kept, so a visitor who pressed Escape inside that
      // window got focus yanked back into a container that was already
      // being torn down. One animation frame is the actual thing being
      // waited for (the scene's first layout), it's cancellable, and
      // returnToGallery cancels it.
      expContainer.setAttribute('tabindex', '-1');
      cancelAnimationFrame(pendingFocusFrame);
      pendingFocusFrame = requestAnimationFrame(() => {
        pendingFocusFrame = 0;
        if (activeScene === sceneName) expContainer.focus();
      });
      transitioning = false;
    }).catch(() => {
      // Reached when the scene's chunk genuinely didn't arrive — the
      // returning-visitor-with-a-stale-index.html case above, an offline
      // tab, a proxy eating the request. Everything this handler does is
      // state that the success path would have reset and that nothing else
      // ever will: the spinner's timer, the spinner class, and above all
      // `transitioning`, which stays true forever otherwise and turns every
      // subsequent click, hash change and Escape on the whole site into a
      // silent no-op.
      clearTimeout(loadingTimer);
      transitioning = false;
      // A later navigation already moved on; that scene owns the overlay
      // now and must not be replaced by this one's error.
      if (activeScene !== sceneName) return;
      sceneLoadFailed = true;
      showSceneLoadError();
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
    setTimeout(mountNext, CROSSFADE_MS);
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

  cancelAnimationFrame(pendingFocusFrame);
  pendingFocusFrame = 0;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  clearSceneLoadError();
  setHash(null);

  function finish() {
    if (fullInstance) { fullInstance.dispose(); fullInstance = null; expContainer.innerHTML = ''; }
    delete overlay.dataset.scene;
    overlay.style.removeProperty('--overlay-bg');
    if (expHeading) expHeading.textContent = '';
    activeScene = null;
    setActiveIcon(null);
    landing.style.display = '';
    // The previews are on screen again — un-pause whichever of them the
    // IntersectionObserver says are actually visible.
    syncPreviewPlayback();
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
  }

  // expandScene()'s own reduced-motion branch (see its comment) skips the
  // delay outright rather than replacing the motion with a pause, on the
  // grounds that main.css sets `#experience-overlay { transition: none }`
  // under this query so there is no fade left to wait for. This function
  // never got the same check and sat through a dead CROSSFADE_MS gap on
  // every return — the same accommodation applied in one direction only,
  // which is worse than not having it: leaving a scene felt slower than
  // entering one, for exactly the visitors who asked for less motion.
  if (prefersReducedMotion()) finish();
  else setTimeout(finish, CROSSFADE_MS);
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
  btn.addEventListener('pointerenter', () => { prefetchScene(scene); pmGlimpse(scene); });
  btn.addEventListener('touchstart', () => prefetchScene(scene), { passive: true });
  btn.addEventListener('click', () => {
    // `&& !sceneLoadFailed`: clicking the icon of the scene you're already
    // in means "close it" — except when it never opened. Pressing the same
    // icon again is the obvious thing to do when a piece didn't load, and
    // it used to return to the gallery instead, which reads as the site
    // giving up on you. Verified live: fail beamline's chunk, press its
    // icon a second time, and the retry now re-fetches and mounts.
    if (activeScene === scene && !sceneLoadFailed) {
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
siteTitle.addEventListener('pointerenter', () => pmGlimpse(siteTitle.dataset.glimpse));

// ─── Keyboard: Escape → gallery, Tab trapped inside the open scene ─────────────
document.addEventListener('keydown', e => {
  if (!activeScene) return;
  if (e.key === 'Escape') {
    // A scene's read-more panel is the innermost thing Escape can close,
    // so it gets first refusal. Both handlers sit on `document` and this
    // one is registered at module evaluation — before any scene has
    // mounted — so it ALWAYS runs first, and stopPropagation from the
    // panel's side can't help (that only stops other elements, not an
    // earlier listener on the same node). Reproduced before the fix:
    // deep-link #sphere/3, confirm .sphere-panel.open, press Escape, land
    // back on the gallery with the panel never having closed. The panel
    // registry that answers this lives in sceneKit's createPanelCloser, so
    // a scene gets the right behavior by using the shared helper it
    // already has to use, with nothing to remember.
    if (anyPanelOpen()) return;
    returnToGallery();
    return;
  }
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
  container.addEventListener('pointerenter', () => { prefetchScene(scene); pmGlimpse(scene); });
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
// A tile that isn't on screen isn't worth a frame. On a phone
// #scene-previews is a single column taller than the viewport (see
// main.css), so at any scroll position most of the ten tiles are nowhere
// near it and were still rendering anyway. rootMargin gives a tile a
// screen-height of runway so it's already running by the time it scrolls
// into view rather than visibly starting up under the reader's thumb.
const previewVisibility = 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => {
      // Ignore everything reported while a scene is open. #landing is
      // display:none for that whole span, so every tile dutifully reports
      // "not intersecting" — for a reason that has nothing to do with
      // scrolling. Recording it left every preview still frozen after the
      // visitor came back to the gallery, waiting on an observer callback
      // that had already been spent. Caught live: return from a scene, all
      // ten tiles paused, nothing moving.
      if (activeScene) return;
      for (const entry of entries) {
        const name = entry.target.closest('.preview-wrapper')?.dataset.scene;
        if (name) previewOnScreen[name] = entry.isIntersecting;
      }
      syncPreviewPlayback();
    }, { rootMargin: '100% 0px' })
  : null;

async function initPreviews() {
  // The ten-entry id map this replaced was a hand-written duplicate of the
  // registry: every id was mechanically 'preview-' + the SCENES key, so the
  // only thing the map could ever contribute was a typo or a scene silently
  // missing from it. Derived from SCENES now, which is also what makes an
  // eleventh scene a one-line registry change rather than a two-place one.
  const entries = Object.keys(SCENES)
    .map(name => [name, document.getElementById(`preview-${name}`)])
    .filter(([, el]) => el);

  // allSettled, not all: Promise.all rejects on the FIRST failure and
  // abandons the rest, so one scene's chunk failing to load took down the
  // whole landing page's previews and left an unhandled rejection behind
  // it. Each tile stands or falls on its own; a missing thumbnail is a
  // quiet gap in the gallery, not a broken page.
  const results = await Promise.allSettled(entries.map(async ([name, el]) => {
    const create = await loadSceneCreate(name);
    previews[name] = create(el, { preview: true });
    previewVisibility?.observe(el);
  }));
  for (const [i, r] of results.entries()) {
    if (r.status === 'rejected') console.warn(`preview "${entries[i][0]}" did not load`, r.reason);
  }
  syncPreviewPlayback();
}

// ─── Layout that depends on the scene count is computed, never typed ────────
// The nav-icon row has been broken four separate times by a scene being added
// and a number somewhere not being re-tuned to match — icons clipped off both
// edges of every phone, invisible with nothing else visibly wrong. v4.2's
// derived nav formula fixed the arithmetic but left `--nav-count: 11` sitting
// in the stylesheet as a hand-maintained value, and the tile grid was worse
// still: a `.preview-row-break` element hand-placed in index.html, moved after
// the 4th tile and then after the 5th, with a comment that had to say which
// scene currently sat in that slot.
//
// Both now come from one place — the length of the registry — so adding a
// scene is a registry entry, a folder, an icon and a tile, and no layout
// decision at all.
const SCENE_COUNT = Object.keys(SCENES).length;

// How many tiles per row. Not a formula anyone would derive from first
// principles, so the rule is stated: try 3, 4 and 5 columns; refuse a last row
// of one outright, then prefer the fullest last row, then the fewest columns
// because fewer columns means bigger tiles.
//
//   10 -> 5  (5/5)     11 -> 4  (4/4/3)     12 -> 4  (4/4/4)
//   13 -> 5  (5/5/3)   14 -> 5  (5/5/4)     15 -> 5  (5/5/5)
//
// An orphan row is the thing being avoided: eleven tiles at five columns is
// 5/5/1, and the single tile under the pair of full rows reads as an
// afterthought rather than as the newest scene. Twelve gives 4/4/4 out of the
// same rule with no second decision to make, which is the point.
function tileColumns(n) {
  if (n <= 4) return Math.max(1, n);
  let best = 4, bestScore = -Infinity;
  for (let c = 3; c <= 5; c++) {
    const last = n % c === 0 ? c : n % c;
    const score = (last === 1 ? -100 : 0) + last * 10 - c;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

function applyDerivedLayout() {
  const list = document.getElementById('scene-previews');
  const nav = document.getElementById('pm-nav');
  const tiles = list ? [...list.querySelectorAll('.preview-wrapper')] : [];
  const icons = nav ? nav.querySelectorAll('.nav-icon').length : 0;

  // The markup and the registry are two lists of the same scenes, and the
  // formulas below are only correct while they agree. `scripts/prerender.js`
  // asserts that at build time and fails the build; this is the runtime half,
  // for the case where a deployed page and a deployed bundle disagree.
  if (icons !== SCENE_COUNT || tiles.length !== SCENE_COUNT) {
    console.warn(`landing layout: registry has ${SCENE_COUNT} scenes but the page has ${icons} nav icons and ${tiles.length} tiles — the derived nav and grid sizing assume all three agree`);
  }

  const cols = tileColumns(SCENE_COUNT);
  if (nav) nav.style.setProperty('--nav-count', String(SCENE_COUNT));
  if (list) list.style.setProperty('--tile-cols', String(cols));

  // Explicit breaks rather than letting flex-wrap find the edge of the
  // container: a zero-height 100%-wide flex item pushes everything after it
  // onto a new line, and each resulting row centres itself, which is what gives
  // the short last row of 4/4/3 a centred three instead of three tiles jammed
  // left. A CSS grid cannot do that on its own — an incomplete last grid row
  // stays left-aligned — which is why this is flex and not `grid-template-
  // columns`, despite the latter being the obvious reach.
  list?.querySelectorAll('.preview-row-break').forEach(el => el.remove());
  for (let i = cols; i < tiles.length; i += cols) {
    const br = document.createElement('li');
    br.className = 'preview-row-break';
    br.setAttribute('aria-hidden', 'true');
    tiles[i].before(br);
  }

  // And the width at which the deliberate rows are worth enforcing is derived
  // too, because it depends on the column count exactly as much as the breaks
  // do. Forcing 4-per-row on a 700px browser produces 2+2 twice and a mess;
  // below the threshold the row falls back to ordinary flex-wrap, which is
  // what it should do. The stylesheet cannot express this — a media query
  // cannot read a custom property — so the class is toggled here and
  // `#scene-previews.rows-forced` does the rest. Tiles grow at the same
  // moment, since the threshold is exactly the width at which the larger
  // tile fits `cols` across.
  if (list) {
    const TILE_PX = 272, GAP_PX = 24, PAD_PX = 32;
    const needed = cols * TILE_PX + (cols - 1) * GAP_PX + PAD_PX;
    const mq = window.matchMedia(`(min-width: ${needed}px)`);
    const sync = () => list.classList.toggle('rows-forced', mq.matches);
    mq.addEventListener('change', sync);
    sync();
  }
}
applyDerivedLayout();

initPreviews();

// ─── Stop rendering what nobody is looking at ────────────────────────────
// A backgrounded tab already gets its requestAnimationFrame throttled hard
// by the browser, but "throttled" is not "stopped" — and it does nothing at
// all about a scene's audio, its physics integration, or the GPU work of
// the frames it does still run. This is the one signal that covers both the
// open scene and the previews behind it, so it lives here rather than being
// re-implemented per scene.
document.addEventListener('visibilitychange', () => {
  fullInstance?.setPaused?.(document.hidden);
  syncPreviewPlayback();
});

// ─── Leaving the page ────────────────────────────────────────────────────
// pagehide, not beforeunload/unload: it's the event that actually fires on
// iOS Safari and the one that fires when a page enters the back/forward
// cache, which is exactly the case where an undisposed WebGL context and a
// still-running AudioContext keep holding real resources for a page the
// visitor thinks they've left. Guarded because a scene's dispose() runs
// arbitrary teardown and an exception here would abort the rest of it.
window.addEventListener('pagehide', () => {
  try { fullInstance?.dispose?.(); } catch { /* leaving anyway */ }
  fullInstance = null;
  previewsSuspended = true;
  for (const instance of Object.values(previews)) {
    try { instance?.setPaused?.(true); } catch { /* leaving anyway */ }
  }
});

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
// A hash that names nothing — a typo, a truncated share, a stale link to a
// scene that has since been retired, or the '#' a plain anchor leaves
// behind — used to just sit in the address bar looking like a real
// address, with no scene opening and nothing said about it. Nothing can be
// DONE about an unknown route on a static single-page site, so the honest
// response is to quietly stop claiming it: replaceState (not a hash
// assignment, which would push a dead history entry — see setHash's own
// comment) puts the visitor on the gallery's real URL. A bare '#' counts:
// location.hash is '' for it, so the check is on the raw string.
function dropUnknownHash() {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

const initialHash = parseHash();
if (initialHash.scene) expandScene(initialHash.scene, navIconFor(initialHash.scene), initialHash.pieceId, initialHash.arg);
else dropUnknownHash();

window.addEventListener('hashchange', () => {
  if (syncingHash) return; // our own write, not a real navigation
  const { scene, pieceId, arg } = parseHash();
  if (scene) expandScene(scene, navIconFor(scene), pieceId, arg);
  else { returnToGallery(); dropUnknownHash(); }
});

// ─── Skip link ───────────────────────────────────────────────────────────
// The skip link's href is #landing, which is both a real fragment (so it
// still works with no JavaScript at all, which is the whole point of a
// skip link) and a string the hash router sees. Two problems came out of
// that: activating it wrote '#landing' into the address bar, where the
// router reads it as an unknown route; and #landing is display:none the
// entire time a scene is open, so "skip to main content" pointed at
// something that wasn't there. Handled rather than re-pointed: whatever is
// currently the main content is where it goes — #landing on the gallery,
// the open scene's container during a scene — and preventDefault keeps the
// URL out of it. #landing carries tabindex="-1" (index.html) because a
// <main> is not focusable on its own and focus would otherwise stay on the
// link while only the scroll position moved.
skipLink?.addEventListener('click', e => {
  e.preventDefault();
  (activeScene ? expContainer : landing).focus();
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
// Deliberately rare enough that most visitors never see it once.
//
// Module-private as of 4.0. It used to be `window.pmGlimpse` for one
// reason only: index.html carried 42 inline event-handler attributes
// (onmouseover + onfocus on ten nav icons, ten preview tiles, and
// #site-title), and an inline attribute's body executes in global scope,
// not this module's. All 42 are gone, so the global went with them —
// nothing outside this file has ever called it. That removal is not
// optional cleanup: `.htaccess`'s CSP is now `script-src 'self'` with the
// eleven sha256- hashes and 'unsafe-hashes' dropped, so in production the
// browser refuses to run an inline handler at all.
//
// The rewrite fixed a real bug along the way, not just the CSP. `mouseover`
// BUBBLES: on a nav icon, it fires on every child shape of the SVG the
// pointer crosses and again on the button as each one bubbles up, so a
// single hover pass over the Sphere icon (a circle, an ellipse, a line and
// a path) fired pmGlimpse four times — four independent 1-in-100 rolls
// against a documented 1-in-100 chance, measured live. `pointerenter` does
// not bubble and fires exactly once per element entry, which is why the
// prefetch listeners three lines from the old attributes had always used
// it. Hover now goes through those same per-element listeners; keyboard
// goes through one delegated `focusin` (which does bubble, correctly —
// focus lands on the button itself, never on an SVG child).
//
// PM_GLIMPSE_WORDS is a plain object, keyed by the same `data-scene` value
// the nav icons and preview wrappers already carry, so the bracket lookup
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
function pmGlimpse(key) {
  if (!key) return;
  if (Math.random() >= 0.01) return;
  const word = PM_GLIMPSE_WORDS[key];
  if (!word) return; // unknown key — fail silently, never show "undefined"
  document.title = word;
  clearTimeout(pmGlimpseTimer);
  pmGlimpseTimer = setTimeout(() => { document.title = PM_ORIGINAL_TITLE; }, 1100);
}

// Keyboard half of the pair, delegated: `focusin` bubbles (`focus` does
// not), so one listener covers every trigger element, including any added
// later. #site-title is the one trigger with no scene of its own, so it
// carries data-glimpse="title" (index.html); everything else reuses the
// data-scene the nav icons and preview wrappers already had.
function glimpseKeyFor(node) {
  const el = node instanceof Element
    ? node.closest('[data-glimpse], .nav-icon, .preview-container')
    : null;
  if (!el) return null;
  return el.dataset.glimpse
    ?? el.dataset.scene
    ?? el.closest('.preview-wrapper')?.dataset.scene
    ?? null;
}
document.addEventListener('focusin', e => pmGlimpse(glimpseKeyFor(e.target)));

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
