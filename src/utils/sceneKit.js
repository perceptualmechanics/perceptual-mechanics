// ─── Scene Kit ──────────────────────────────────────────────────────────────
// Small, dependency-free helpers shared across scenes for input handling
// (drag-to-orbit with unified mouse/touch support, wheel zoom, guarded
// resize), accessibility (reduced-motion checks, escape-to-close, keyboard
// jump lists), and DOM plumbing (HTML escaping, static-template parsing)
// that every scene would otherwise reimplement independently.
//
// Every helper here returns a `dispose()` (or is itself idempotent to call
// again), matching the teardown convention every scene's own `dispose()`
// already follows.

// ─── Orbit drag (mouse + touch, unified) ───────────────────────────────────
// Reports rotation deltas from either input, in the same units. The scene
// decides what to do with them (usually `group.rotation.y += dx`) and
// whether/how to resume any auto-rotation once dragging stops — this helper
// only owns "is a drag happening, and by how much," not the animation
// policy, since that already differs from scene to scene (orrery has none
// at all, by design; others resume after a pause).
export function bindOrbitDrag(container, { onDragStart, onDrag, onDragEnd, sensitivity = 0.004 } = {}) {
  let dragging = false;
  let prev = { x: 0, y: 0 };

  function start(x, y) {
    dragging = true;
    prev = { x, y };
    onDragStart?.();
  }
  function move(x, y) {
    if (!dragging) return;
    const dx = (x - prev.x) * sensitivity;
    const dy = (y - prev.y) * sensitivity;
    prev = { x, y };
    onDrag?.(dx, dy);
  }
  function end() {
    if (!dragging) return;
    dragging = false;
    onDragEnd?.();
  }

  const onMouseDown  = e => start(e.clientX, e.clientY);
  const onMouseMove  = e => move(e.clientX, e.clientY);
  const onMouseUp    = () => end();
  const onTouchStart = e => { if (e.touches.length === 1) start(e.touches[0].clientX, e.touches[0].clientY); };
  const onTouchMove  = e => { if (e.touches.length === 1) move(e.touches[0].clientX, e.touches[0].clientY); };
  const onTouchEnd   = () => end();

  container.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  container.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });

  return {
    get isDragging() { return dragging; },
    dispose() {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    },
  };
}

// ─── Wheel zoom ─────────────────────────────────────────────────────────────
// `onZoom(deltaY)` gets the raw wheel delta; the scene applies its own
// clamp/scale (ranges differ a lot: the orrery's zoom range isn't the
// sphere's). `isBlocked(event)` lets a scene opt out per-event — e.g. so
// scrolling inside an open read-more panel doesn't also zoom the camera.
export function bindWheelZoom(container, { onZoom, isBlocked } = {}) {
  const handler = e => {
    if (isBlocked?.(e)) return;
    onZoom?.(e.deltaY);
  };
  container.addEventListener('wheel', handler, { passive: true });
  return { dispose() { container.removeEventListener('wheel', handler); } };
}

// ─── Guarded resize ─────────────────────────────────────────────────────────
// Guards against a hidden ancestor (the landing grid sitting behind an
// active full-screen scene) reading clientWidth/Height as 0, which would
// otherwise resize a renderer to 0 or fall back to window size for what's
// actually a small preview tile. Also wires the orientationchange retry
// (some mobile browsers fire resize before the new dimensions are settled).
//
// ─── 4.11.1: it watches the ELEMENT now, not only the window ────────────────
// This listened to `window.resize` alone, and that is a real gap rather than a
// tidiness point: **an element can change size without the window changing at
// all.** Every scene's constructor opens with
//
//     const w = container.clientWidth  || window.innerWidth;
//     const h = container.clientHeight || window.innerHeight;
//
// so a preview that mounts before its stylesheet has applied measures an
// unstyled empty <button> — near-zero width, non-zero height from the UA's own
// padding — and falls back to the WINDOW's dimensions for one or both axes.
// The renderer is then built at the phone's aspect and the camera with it. CSS
// arrives a moment later, the tile becomes a 171px square, and
// `.preview-container canvas { width:100% !important; height:100% !important }`
// squashes that portrait render into a square box.
//
// The result is a sphere drawn as a tall narrow ellipse, and **it never
// recovered**, because the only thing that could re-measure it was a window
// resize that never came. Rotating the phone fixed it; so did opening a scene
// and coming back, because returnToGallery dispatches a synthetic resize. That
// is why it looked intermittent and why it would not reproduce on a fast local
// machine, where CSS is always applied before the module graph runs.
//
// Measured, on a 390x844 phone profile, mounting Sphere into a container that
// is 0 wide with a real height: buffer 780x342, render aspect 2.281, displayed
// in a 171px square — a 0.44 width-to-height ellipse. Giving the container its
// real size afterwards left it at 2.281. Dispatching a window resize fixed it.
//
// A ResizeObserver closes it at the source: the element gaining its size IS
// the signal. The window listeners stay — a devicePixelRatio change on a
// display swap moves nothing about the element's box, and scenes re-apply
// pixel ratio from this same callback.
export function bindGuardedResize(container, onResize) {
  const handler = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    onResize(w, h);
  };
  const orientationHandler = () => setTimeout(handler, 100);
  window.addEventListener('resize', handler);
  window.addEventListener('orientationchange', orientationHandler);
  // Guarded for environments without it (and for a container that is not an
  // Element, which no caller does today but the helper should not assume).
  let observer = null;
  if (typeof ResizeObserver !== 'undefined' && container instanceof Element) {
    observer = new ResizeObserver(handler);
    observer.observe(container);
  }
  return {
    trigger: handler,
    dispose() {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', orientationHandler);
      observer?.disconnect();
    },
  };
}

// ─── Reduced motion ─────────────────────────────────────────────────────────
// A `prefers-reduced-motion` CSS media query can't reach into a
// requestAnimationFrame loop, so scenes that spin/orbit continuously check
// this directly and skip their own autonomous motion (drag-to-orbit stays
// available either way — that's motion the visitor asked for, not motion
// imposed on them).
export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

// ─── Preview-tile circular clip (Firefox WebGL workaround) ─────────────────
// Firefox promotes some WebGL canvases (the heaviest scenes, orrery among
// them) to a GPU compositing layer that sits outside the page's normal
// paint/z-order entirely, unreachable by any CSS clip/overflow/z-index
// mechanism no matter which element in the chain owns the property.
//
// The one technique that isn't defeated by that: don't display the WebGL
// canvas at all. The scene keeps rendering into it exactly as normal
// (off-DOM, never appended), then this copies its finished pixels every
// frame onto a plain 2D `<canvas>` that IS in the DOM. `ctx.clip()` there
// is software rasterization, not GPU layer compositing — every browser
// honors it unconditionally, because there's no accelerated layer left to
// bypass it with.
//
// Opt-in per scene (call this only from a `preview` branch) rather than a
// blanket site-wide change: scenes that already clip fine with plain CSS
// don't need the extra per-frame copy, so this stays confined to the
// scenes that actually need it.
// The display canvas is sized inside blit(), from the WebGL canvas, because
// the renderer's backing size is the only correct answer and it isn't final
// until the first frame. That has one bad consequence, and it cost a real
// investigation before anyone named it: a canvas still at the HTML default
// 300x150 means "no frame has ever completed for this tile", and a canvas
// that has drawn exactly once is indistinguishable from one drawing every
// frame. So "hasn't drawn yet" and "will never draw" were the same
// observable. When three landing tiles were reported blank on 2026-09-01,
// that ambiguity is why the report could be neither confirmed nor dismissed
// from the page itself.
//
// `data-blits` closes it. On the DOM node rather than only on the returned
// object because the sighting was on the *live site*, where nothing holds a
// reference to these instances — from any console, anywhere:
//
//   document.querySelector('#preview-harmonics canvas').dataset.blits
//
// 0 means never drew. 1 means drew once and stopped. A number that climbs
// between two reads means it is fine. Written only when the count crosses a
// power of two — `(n & (n-1)) === 0` is one instruction, and 1/2/4/…/1024 is
// ample resolution for those three cases without a string conversion every
// frame. A fixed every-60th-frame cadence was the first attempt and was
// wrong: on a machine running the loop at 2fps it sits on "1" for half a
// minute, which reads exactly like the failure it exists to rule out.
//
// Considered and not shipped: a dev-mode `console.warn` when a tile has
// blitted nothing after N seconds. It is the nicer ergonomics, but a timer
// that fires into a page still constructing ten scenes could not be made to
// prove it fires under a forced zero-frame failure, and a diagnostic that
// stays silent is indistinguishable from a diagnostic with nothing to
// report — the same class of ambiguity this whole helper is being changed to
// remove. The counter is verifiable, so the counter is what ships.
export function mountClippedPreviewCanvas(container, renderer) {
  const display = document.createElement('canvas');
  display.setAttribute('aria-hidden', 'true');
  display.style.width = '100%';
  display.style.height = '100%';
  display.style.display = 'block';
  display.dataset.blits = '0';
  container.appendChild(display);
  const ctx = display.getContext('2d');

  let blits = 0;

  return {
    // Call once per frame, right after renderer.render(...) — copies
    // whatever's currently in the (off-DOM) WebGL canvas onto the visible
    // one, clipped to the tile's circle.
    blit() {
      const src = renderer.domElement;
      const w = src.width, h = src.height;
      if (!w || !h) return;
      if (display.width !== w) display.width = w;
      if (display.height !== h) display.height = h;
      ctx.save();
      ctx.clearRect(0, 0, w, h);
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(src, 0, 0, w, h);
      ctx.restore();
      blits++;
      if ((blits & (blits - 1)) === 0) display.dataset.blits = String(blits);
    },
    // Same number as `data-blits`, for a caller that already holds the
    // instance and shouldn't have to go back through the DOM for it.
    get blits() { return blits; },
    dispose() { display.remove(); },
  };
}

// ─── Tap-vs-drag guard ──────────────────────────────────────────────────────
// A touch-drag to orbit the camera also fires a trailing `click` once the
// finger lifts — without this, that click gets read the same as a genuine
// tap and opens whatever's under it. A scene's own click handler starts
// with `if (touchGuard.consume()) return;` to filter that out.
export function bindTapVsDrag(container) {
  let moved = false;
  const onTouchStart = () => { moved = false; };
  const onTouchMove = () => { moved = true; };
  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchmove', onTouchMove, { passive: true });
  return {
    // Reads and clears in one step, same as the inline `if (touchMoved) {
    // touchMoved = false; ... }` this replaces — a click handler calls this
    // once per click, right up front.
    consume() { const m = moved; moved = false; return m; },
    dispose() {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
    },
  };
}

// ─── Persisted sound-toggle ─────────────────────────────────────────────────
// Shared by every scene with its own sound-toggle button (currently
// harmonics, outside) — but each scene gets its own localStorage key
// (`pm-sound-enabled:${sceneKey}`), not one shared across the site.
// Scott's explicit call: he wants Harmonics and Outside independently
// mutable, e.g. Harmonics on and Outside off at the same time, rather
// than one preference governing both like a single site-wide mute
// switch (that was this helper's original design in v3.9.9 — reversed
// here per his direct correction, don't reintroduce a shared key).
//
// Two real constraints shape this, not just "read/write a value":
//   1. Browsers require a genuine user gesture before an AudioContext can
//      actually produce sound (autoplay policy) — but this site is a
//      single-page app, so scenes mount/unmount within the same document
//      rather than a real page navigation. Whatever gesture the user made
//      to switch scenes in the first place (a nav click, an earlier drag)
//      already set the document's sticky user-activation flag before this
//      scene's own mount code even runs, so calling setSoundEnabled(true)
//      immediately at mount works correctly in the overwhelming common
//      case. An earlier version of this deferred activation to the
//      scene's *own* first pointerdown instead — which sounds more
//      cautious, but was actually a bug: switching scenes is normally a
//      click on the shared nav, not a gesture inside the new scene's own
//      container, so the deferred listener could sit unfired forever and
//      the toggle would show "on" with no sound until the user happened
//      to drag the canvas. Fixed by trying immediately and keeping a
//      one-time 'pointerdown' fallback only for the one case immediate
//      activation can't cover: a cold page load landing directly on a
//      scene via a deep link, before any gesture has happened anywhere
//      on the page yet. setSoundEnabled(true) is idempotent —
//      buildAudioGraph() no-ops once a context exists, resume() is safe
//      to call again — so firing it twice (immediate + fallback) is free.
//   2. If the user explicitly clicks the toggle themselves before the
//      fallback gesture fires (most obviously: immediately turning a
//      remembered "on" back off before ever touching the canvas), that
//      choice must not get overridden a moment later — guarded by the
//      `overridden` flag the click handler sets.
//
// `setSoundEnabled` must already exist in the calling scene and, when
// called, both apply the real on/off state AND sync the toggle button's
// own aria-pressed/label (every scene's own setSoundEnabled already does
// this for its own click handler) — this helper only adds persistence and
// the deferred-first-gesture activation around it; it derives "what should
// a click flip to" from the button's own current aria-pressed rather than
// a scene-private variable, since that's the one piece of state already
// guaranteed to stay in sync no matter which scene calls this.
export function bindPersistedSoundToggle(container, toggleEl, setSoundEnabled, sceneKey) {
  if (!toggleEl) return { dispose() {} };
  const KEY = `pm-sound-enabled:${sceneKey}`;
  let storedOn = false;
  try { storedOn = localStorage.getItem(KEY) === '1'; } catch { /* private browsing / storage disabled — just skip persistence */ }

  let overridden = false; // set once the user explicitly clicks the toggle, so a later fallback activation can't undo their choice

  // Named rather than inline so dispose() below can remove them again.
  function activateStoredSound() {
    if (overridden) return;
    setSoundEnabled(true);
  }
  function onToggleClick() {
    overridden = true;
    const nowOn = toggleEl.getAttribute('aria-pressed') !== 'true';
    setSoundEnabled(nowOn);
    try { localStorage.setItem(KEY, nowOn ? '1' : '0'); } catch { /* same as above */ }
  }

  if (storedOn) {
    toggleEl.setAttribute('aria-pressed', 'true');
    const label = toggleEl.querySelector('span:last-child');
    if (label) label.textContent = 'Sound on';

    // Try starting audio right away — see the comment above for why this
    // is correct in this SPA's common case (the scene-switch gesture
    // itself already granted sticky activation) rather than overcautious.
    // Deferred to a microtask rather than called inline: this function is
    // typically invoked partway through a scene's own mount/setup code,
    // before every local variable the scene's setSoundEnabled might touch
    // has necessarily been declared yet (a `let` declared later in the
    // same function is still in its temporal dead zone at this point) —
    // queuing it lets the calling scene's mount function finish running
    // first, still well before the next paint/gesture, so there's no
    // user-visible delay.
    Promise.resolve().then(() => setSoundEnabled(true));

    // Cold-load fallback: only matters if the immediate attempt above
    // landed on a document with no activation yet at all.
    //
    // v4.0: this listener MUST come back off again. `container` is the one
    // shared #experience-container that main.js only ever empties, never
    // replaces, so a listener left on it outlives the scene that added it.
    // The bug that produced this fix: leave Harmonics with sound remembered
    // on, then pointer-down anywhere in ANY later scene, and this fired the
    // torn-down scene's setSoundEnabled(true) — which built a fresh
    // AudioContext and started 122 oscillators nothing could ever close.
    // Reproduced live at four orphaned running contexts against Chrome's
    // ~6-per-page cap. Outside had the same listener with a quieter
    // symptom (its audioCtx isn't nulled on dispose, so it re-armed an
    // unclearable setInterval instead). One helper, one teardown.
    container.addEventListener('pointerdown', activateStoredSound, { once: true });
  }

  toggleEl.addEventListener('click', onToggleClick);

  return {
    dispose() {
      container.removeEventListener('pointerdown', activateStoredSound);
      toggleEl.removeEventListener('click', onToggleClick);
    },
  };
}

// ─── Escape-to-close ────────────────────────────────────────────────────────
// Standard modal-dialog expectation for a read-more panel: Escape closes it
// alongside the explicit close button or a click outside. Attaches at the
// document level so it fires regardless of what currently has focus inside
// the panel.
export function bindEscapeClose(onEscape) {
  const handler = e => { if (e.key === 'Escape') onEscape(); };
  document.addEventListener('keydown', handler);
  return { dispose() { document.removeEventListener('keydown', handler); } };
}

// ─── Read-more panel: shared close mechanics ───────────────────────────────
// Every scene with a slide-in info panel (sphere's fragments, orbiter's poems,
// orrery's placards, library's spines) builds its own panel
// markup and CSS — colors, gradient tint, which side it slides in from — on
// purpose, tuned to that scene's own palette, so that part stays put in each
// scene file. What's genuinely identical across all four is how the panel
// CLOSES: remove the `.open` class, run whatever scene-specific cleanup
// closing implies (deselect a highlighted facet/satellite/spine, restore its
// color), and return focus to `container` — the same three steps whether the
// close was triggered by the close button, Escape, or a click outside the
// panel. This owns exactly that: the close-button and Escape wiring, the
// panel-internal click guard (so clicking inside the panel doesn't fall
// through to the canvas's own click-to-select handler underneath it), and a
// `close()` the scene calls itself from its own outside-click/hover-loss
// logic — one close path, three triggers, instead of the same three-line
// body copy-pasted at each trigger site.
// Every panel that goes through createPanelCloser registers itself here, so
// main.js can ask "is a read-more panel currently open?" before deciding what
// Escape means. Without this, main.js's own document-level Escape handler —
// registered at module evaluation, i.e. before any scene mounts, so it always
// runs first — tore the whole scene down while the reader was only trying to
// close the panel they were reading. Verified live: deep-link to #sphere/3,
// press Escape, land back on the gallery. Both handlers sit on `document`, so
// stopPropagation from the panel's side can't help (that only stops OTHER
// elements, and main.js's is on the same node and earlier); the fix has to be
// main.js asking first. Registration lives here rather than in a per-scene
// return value because STANDARDS.md already establishes that every closeable
// panel goes through this helper — so there is nothing for a scene to forget.
const openPanels = new Set();

// Not every dismissible thing is a DOM panel. Beamline's station label is a
// THREE.Sprite in the 3D scene — it has no element to register and no `.open`
// class, but Escape should still dismiss it before Escape means "leave the
// scene". A scene declares one by handing over a predicate.
const transientOverlays = new Set();

export function registerTransientOverlay(isOpen) {
  transientOverlays.add(isOpen);
  return { dispose() { transientOverlays.delete(isOpen); } };
}

export function anyPanelOpen() {
  for (const panel of openPanels) {
    if (panel.isConnected && panel.classList.contains('open')) return true;
  }
  for (const isOpen of transientOverlays) {
    if (isOpen()) return true;
  }
  return false;
}

export function createPanelCloser(panel, container, { closeBtn, onClose } = {}) {
  openPanels.add(panel);
  function close() {
    if (!panel || !panel.classList.contains('open')) return;
    panel.classList.remove('open');
    onClose?.();
    container.focus();
  }

  const onPanelClick = e => e.stopPropagation();
  panel.addEventListener('click', onPanelClick);
  const onCloseBtnClick = e => { e.stopPropagation(); close(); };
  closeBtn?.addEventListener('click', onCloseBtnClick);
  const escape = bindEscapeClose(close);

  return {
    close,
    dispose() {
      openPanels.delete(panel);
      panel.removeEventListener('click', onPanelClick);
      closeBtn?.removeEventListener('click', onCloseBtnClick);
      escape.dispose();
    },
  };
}

// ─── Keyboard jump list ─────────────────────────────────────────────────────
// sphere, orbiter, orrery, and library all raycast their interactive 3D objects
// (facets, satellites, posters, spines) — real, readable content a mouse or
// touch visitor reaches by hovering and clicking, but that a keyboard-only
// visitor has no way to reach otherwise: nothing simulates "point at a
// facet" from a keyboard. This builds the accessible way in — a real
// list of real `<button>`s, one per selectable item, that call the exact
// same select-and-open function the mouse click already does (each scene
// passes that in as `onSelect`; this owns none of the panel/selection logic
// itself, only the list). `.pm-jumplist` (styles/main.css) hides it using
// the same idiom as the skip-link already at the top of the page: invisible
// until a button in it actually has focus, so it doesn't clutter the
// deliberately chrome-free canvas for mouse/touch visitors, and every
// button occupies the same on-screen slot so Tabbing through reveals one
// label at a time rather than a wall of text.
export function createJumpList(container, { label, items, getLabel, onSelect }) {
  const list = document.createElement('ul');
  list.className = 'pm-jumplist';
  list.setAttribute('aria-label', label);
  items.forEach((item, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = getLabel(item, i);
    btn.addEventListener('click', () => onSelect(item, i));
    li.appendChild(btn);
    list.appendChild(li);
  });

  // The list mounts INSIDE the scene's container, so without this a click on
  // one of its buttons bubbles on to the container's own canvas click handler
  // — which sees an open panel and a raycast that hit nothing (a
  // keyboard-activated click reports clientX/clientY 0,0) and closes the very
  // panel the button just opened. The whole accessible path opened and shut in
  // the same event. Found independently in library and orbiter during the 4.0
  // pass, and it was latent in every scene that uses this helper, so the guard
  // belongs here rather than in five separate click handlers.
  list.addEventListener('click', e => e.stopPropagation());

  container.appendChild(list);
  return { dispose() { list.remove(); } };
}

// ─── Shared hint-label color ────────────────────────────────────────────────
// The color for every scene's top-right "drag to orbit · scroll to zoom"
// style control-hint text (sphere, orbiter, orrery, library, and butterfly
// via main.js). 0.6 alpha white measures ~7.4:1 contrast against a black
// background at the ~8.8px size these hints use — well clear of WCAG's
// 4.5:1 minimum for text that small (the 3:1 "large text" allowance only
// applies at ~18.7px bold or larger). Centralized here so any future
// adjustment is one edit instead of several; doesn't touch each scene's own
// positioning, font, or responsive/collision-avoidance CSS — only the color.
export const HINT_TEXT_COLOR = 'rgba(255,255,255,0.6)';

// ─── HTML escaping ──────────────────────────────────────────────────────────
// Used by every scene that injects found text (poems, notes, spine titles)
// into a read-more panel's innerHTML.
//
// ELEMENT CONTENT ONLY. The round trip through a detached element is text-node
// serialisation, which per the HTML spec escapes exactly &, <, > and U+00A0 —
// NOT quotes. All 24 call sites put the result between tags, which is what
// this is safe for; putting it in an attribute would not be.
//
// It cannot simply be widened to cover quotes either, and the reason is worth
// having here. scroll.js's rubric marking runs
// `html.replace(escapeHtml(phrase), …)` over HTML that came back out of a
// <template>, so the two escapers have to agree character for character; the
// template's serialiser will never escape an apostrophe, and one rubric
// phrase ("I'm flying. Finally.") contains one. Escaping quotes here would
// stop that phrase matching, silently, with the paragraph still rendering.
// An attribute-safe variant would have to be a second function, not a change
// to this one.
export function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ─── Cross-piece links (src/links.js) ──────────────────────────────────────
// The one place that turns a list of links.js rows into live markup —
// sphere, orbiter, scroll, and library all called this same beat
// separately before the 2026-08-16 linking pass (find a phrase already
// sitting in a field's text, wrap it in an anchor pointing at another
// piece), copy-pasted four times with a different data attribute and
// class name each time. Now it's one function; each scene still owns its
// own link class name (fragment-link/poem-link/scroll-link/library-link)
// for its own CSS, and still decides what `html` is before calling this —
// escaped plain text for a field that's just prose (library's note/scene/
// excerpt, orbiter's stanza, scroll's paragraph), or a field's own already-
// trusted HTML as-authored for a field that IS markup (sphere's fragment
// text, which keeps its own <p> tags). This never escapes anything itself,
// only replaces a literal phrase with that phrase wrapped in an <a>.
//
// `links` is whatever a scene's own call to `getOutboundLinks(scene, id,
// field, index)` (src/links.js) returned — every row already resolved to
// the one field/slot the caller is about to render, so this just wires
// each one in turn. The target now carries both a scene and an id
// (data-target-scene/data-target-id) rather than the single `data-target`
// each scene used to write by hand — a link can only ever name one piece
// unambiguously once more than one scene's pieces share the same address
// space, which is exactly what unifying every scene onto `{ scene, id }`
// (NOTES.md's "Linking & addressing" entry) was for.
//
// v4.0 changed two things here, both of which had been latent rather than
// broken:
//
//   1. The anchor now carries a real `href="#scene/id"` instead of
//      `role="link" tabindex="0"`. That URL shape is exactly what main.js's
//      hash router already parses, including the same-scene "open this piece"
//      path, so native activation now does the whole job. Four scenes
//      (sphere, orbiter, library, scroll) each carried their own copy of the
//      same Enter/Space keydown handler purely because an <a> with no href
//      isn't activatable — precisely the duplication this file exists to
//      absorb. It also gives the links back everything a real link has and a
//      div-with-a-role never did: middle-click, open-in-new-tab, copy link,
//      the status-bar preview, and Enter-only activation (Space on a link was
//      always a semantic mismatch).
//
//   2. The phrase substitution walks text nodes instead of running
//      String.replace over an accumulating HTML string. The old version
//      searched its own output, markup included, so a phrase could in
//      principle match inside an attribute an earlier row had just injected,
//      and a phrase that was a substring of another row's phrase could land
//      the anchor on the wrong text. There were zero such collisions in the
//      data — the guarantee was accidental, and 38 phrases are twelve
//      characters or shorter with two of them a bare em dash. A TreeWalker
//      can only ever see text, so the class of bug is gone rather than
//      merely unexercised; verify-links.mjs now asserts the same property in
//      the data as a second line of defence.
export function wireCrossLinks(html, links, linkClass) {
  if (!links?.length) return html;
  const template = document.createElement('template');
  template.innerHTML = html;

  for (const l of links) {
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    let node, hit = null;
    while ((node = walker.nextNode())) {
      // Never nest one cross-link inside another's own text.
      if (node.parentElement?.closest(`a.${linkClass}`)) continue;
      const i = node.data.indexOf(l.phrase);
      if (i !== -1) { hit = { node, i }; break; }
    }
    if (!hit) continue;

    const tail = hit.node.splitText(hit.i);
    tail.splitText(l.phrase.length);
    const a = document.createElement('a');
    a.className = linkClass;
    a.href = `#${l.to.scene}/${l.to.id}`;
    a.dataset.targetScene = l.to.scene;
    a.dataset.targetId = String(l.to.id);
    a.textContent = l.phrase;
    tail.parentNode.replaceChild(a, tail);
  }

  return template.innerHTML;
}

// ─── Inbound-reference note ─────────────────────────────────────────────────
// "Referenced from X" / "X and Y" / "X, Y, and Z" — the target side of a
// links.js relationship. Added 2026-08-16 alongside wireCrossLinks() above:
// wireCrossLinks is the outbound half (a phrase in the source piece's own
// text becomes a clickable jump), this is the inbound half (the target
// piece says something back), which is what actually makes a link "surface
// from both ends" rather than only being discoverable by clicking through
// from the source. `titles`: display names for each link in
// getInboundLinks()'s result, same order — a scene passes these in rather
// than this function looking them up, since only the scene knows how to
// resolve its own (and any other scene's) pieces to a title. Returns null
// for no inbound links, so a caller can skip rendering the line entirely
// rather than showing an empty "Referenced from ".
export function formatInboundNote(titles) {
  const names = titles.filter(Boolean);
  if (!names.length) return null;
  if (names.length === 1) return `Referenced from ${names[0]}`;
  if (names.length === 2) return `Referenced from ${names[0]} and ${names[1]}`;
  return `Referenced from ${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

// ─── Side-adaptable slide-in panel ──────────────────────────────────────────
// Sphere and Library both independently arrived at the same pattern: a
// slide-in read-more panel that docks on whichever side of the container
// WASN'T clicked, so opening it doesn't pop up underneath the reader's own
// hand — the click's x-position decides `fromLeft`, and a `.from-left` CSS
// class each scene's own stylesheet keys off (`.sphere-panel.from-left` /
// `.library-panel.from-left`) flips which side the panel docks on. Real,
// confirmed duplication in both scenes — the `fromLeft` formula and the
// `.from-left` toggle mechanics were identical, independently arrived at,
// which is exactly the "third scene" threshold this project's own
// convention treats as belonging here (design-notes pass, 2026-09-01).
// Consolidation only — behavior-neutral, both scenes already worked
// correctly; this doesn't change what either one does, just where the code
// that does it lives.
//
// `setPanelSide` is deliberately narrow: only the class-toggle mechanics,
// not when to call it. Toggling `.from-left` needs a one-frame
// no-transition guard — the panel's own CSS transitions that class the same
// as `open`, so flipping it in the same frame `open` is about to be added
// would visibly animate a fully-hidden panel sliding across before it's
// ever shown. Both scenes fixed this the same way: add `.no-transition`,
// force a synchronous reflow (`void panel.offsetWidth`) so the browser
// can't coalesce the class change with the one about to follow, then remove
// `.no-transition`. This is exactly that sequence, and only that sequence —
// each scene still owns its own decision about WHEN to call it (a fresh
// open vs. an already-open panel crossing sides, which involves a
// close/wait/reopen dance tuned around each scene's own content-population
// and focus-management code, so that orchestration stays in sphere.js's
// openFragment and library.js's openItem/onContainerClick rather than
// being forced into a one-size-fits-all shape here).
export function setPanelSide(panel, fromLeft) {
  panel.classList.add('no-transition');
  panel.classList.toggle('from-left', fromLeft);
  void panel.offsetWidth; // force reflow before re-enabling the transition
  panel.classList.remove('no-transition');
}

// The formula both scenes use to decide which half of the container a click
// landed in. `rect` is the container's own getBoundingClientRect(), already
// computed by the caller for its own raycasting — this doesn't force a
// second one.
export function clickedLeftHalf(e, rect) {
  return (e.clientX - rect.left) < rect.width / 2;
}

// ─── Static HTML template parsing ──────────────────────────────────────────
// Each scene's static shell markup (hint, caption, panel skeleton, and
// similar chrome that doesn't change shape at runtime) lives in its own
// <scene>.html file, imported as a raw string via Vite's `?raw` suffix
// (e.g. `import html from './sphere.html?raw'`). A <template> element is
// the standard way to turn that string into real, inert DOM nodes without
// executing embedded scripts or triggering premature image loads —
// `.content` is a DocumentFragment you can querySelector into
// before anything is attached to the visible document. One scene's HTML file
// can (and often does) contain more than one top-level element — e.g. a hint
// paragraph that belongs on document.body and a panel that belongs inside
// the scene's own container, which have different mount points (see any
// scene's z-index-scale comment for why) — so the caller pulls each piece
// out by id and appends it wherever it actually needs to live, exactly as
// the old createElement-based code did.
export function parseHTML(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content;
}


// ─── Live reduced-motion changes ────────────────────────────────────────────
// prefersReducedMotion() above is a one-shot read, and every scene sampled it
// exactly once at mount — so a visitor who turned the OS setting on while a
// scene was already open kept getting the motion until they navigated away.
// This is the subscription half. Scenes that can cheaply flip their own
// autonomous motion at runtime use it; ones that bake the decision into
// geometry at build time legitimately don't.
export function onReducedMotionChange(onChange) {
  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (!mq) return { dispose() {} };
  const handler = e => onChange(e.matches);
  mq.addEventListener('change', handler);
  return { dispose() { mq.removeEventListener('change', handler); } };
}

// ─── Frame clock ────────────────────────────────────────────────────────────
// requestAnimationFrame fires at the display's refresh rate, not at 60Hz, so
// anything advanced by a fixed per-frame constant runs at double speed on a
// 120Hz display and half speed on a throttled one. Four scenes were doing
// exactly that in v3.16.2 — and in Beamline's case it wasn't cosmetic:
// computeSustain() derives a *reading duration* in real seconds from
// WORDS_PER_SECOND, then compared it against a counter advancing by 1/60 per
// frame, so the 116-word "THE MIRROR" passage got 25 seconds instead of 50 on
// any ProMotion Mac. Harmonics, Outside and Orrery's planets already did this
// correctly from performance.now(); this is that pattern, extracted.
//
// `dt` is clamped (default 50ms) so a backgrounded tab or a long GC pause
// resumes rather than teleporting — a scene that integrates position from
// velocity would otherwise jump the camera through a wall on the first frame
// back. To preserve a rate that was hand-tuned at 60fps, multiply it by
// `dt * 60` rather than re-deriving the constant.
export function createFrameClock({ maxDelta = 0.05 } = {}) {
  let last = performance.now();
  let elapsed = 0;
  return {
    // Seconds since the previous tick, clamped. Call once at the top of animate().
    tick() {
      const now = performance.now();
      const dt = Math.min(maxDelta, (now - last) / 1000);
      last = now;
      elapsed += dt;
      return dt;
    },
    get elapsed() { return elapsed; },
    // After a deliberate pause, so the first frame back isn't one long dt.
    resync() { last = performance.now(); },
  };
}

// ─── Tracked timers ─────────────────────────────────────────────────────────
// Scenes schedule a lot of short deferred work — re-open a panel after its
// close transition, move focus once a slide-in has landed, resume auto-rotate
// a few seconds after a drag. Fifteen of those were untracked in v3.16.2, and
// one had a real consequence: Library's 500ms side-flip re-entered
// populatePanel() on a detached panel, which called onPieceChange(), which is
// how main.js writes the URL — so a scene you had already left could rewrite
// location.hash out from under the scene that replaced it. This is the
// bookkeeping, so a scene's dispose() can drop everything still pending in
// one call instead of naming each handle.
export function trackTimers() {
  const handles = new Set();
  return {
    after(ms, fn) {
      const id = setTimeout(() => { handles.delete(id); fn(); }, ms);
      handles.add(id);
      return id;
    },
    // For work that only needs to outlast the current frame — no magic
    // millisecond constant guessing at a CSS transition's duration.
    nextFrame(fn) {
      const id = requestAnimationFrame(() => { handles.delete(id); fn(); });
      handles.add(id);
      return id;
    },
    cancel(id) { clearTimeout(id); cancelAnimationFrame(id); handles.delete(id); },
    dispose() {
      for (const id of handles) { clearTimeout(id); cancelAnimationFrame(id); }
      handles.clear();
    },
  };
}

// ─── Claiming the shared container ──────────────────────────────────────────
// `container` is the single #experience-container element. main.js clears its
// innerHTML between scenes but never replaces the node, so any inline style a
// scene writes onto it survives into the next one. Seven scenes set
// position/overflow, two set tabIndex, several set cursor on hover — and in
// v3.16.2 exactly one of them put anything back. The visible version of the
// bug: Orrery sets `cursor: none` for its crosshair, so leaving Orrery for
// Theater, Scroll, Butterfly or Outside (the four that never touch cursor
// themselves) left the visitor with no mouse pointer at all.
//
// This records whatever was on the element first and hands back a restore(),
// which is the half that kept getting forgotten when it was seven separate
// two-line edits. Past the third-scene threshold STANDARDS.md sets for
// extraction several times over.
export function claimContainer(container, { position = 'relative', overflow = 'hidden', cursor, tabIndex } = {}) {
  const prev = {
    position: container.style.position,
    overflow: container.style.overflow,
    cursor: container.style.cursor,
    tabIndex: container.hasAttribute('tabindex') ? container.getAttribute('tabindex') : null,
  };
  container.style.position = position;
  container.style.overflow = overflow;
  if (cursor !== undefined) container.style.cursor = cursor;
  if (tabIndex !== undefined) container.tabIndex = tabIndex;

  return {
    // Hover handlers go through this rather than writing the property
    // directly, so the restore below is guaranteed to cover them too.
    setCursor(value) { container.style.cursor = value; },
    restore() {
      container.style.position = prev.position;
      container.style.overflow = prev.overflow;
      container.style.cursor = prev.cursor;
      if (prev.tabIndex === null) container.removeAttribute('tabindex');
      else container.setAttribute('tabindex', prev.tabIndex);
    },
  };
}

// ─── Three.js scene-graph disposal ──────────────────────────────────────────
// The two-line `traverse(o => { o.geometry?.dispose(); o.material?.dispose() })`
// was copy-pasted into nearly every scene, and every copy had the same hole:
// `material.dispose()` does NOT dispose the textures hanging off the material.
// Only `.map` was ever disposed by hand, so every other slot leaked. Orrery
// alone dropped 27 canvas textures per visit that way, because its planets
// carry a roughnessMap, a metalnessMap and an emissiveMap alongside the map.
//
// Takes the scene root rather than a hand-kept array so nothing added later
// can quietly escape it — which was the other half of the same bug: objects
// added straight to `scene` instead of into the group the old traversal
// walked were never freed at all.
const TEXTURE_SLOTS = [
  'map', 'alphaMap', 'aoMap', 'bumpMap', 'displacementMap', 'emissiveMap',
  'envMap', 'lightMap', 'metalnessMap', 'normalMap', 'roughnessMap',
  'specularMap', 'gradientMap', 'clearcoatMap', 'clearcoatNormalMap',
  'clearcoatRoughnessMap', 'sheenColorMap', 'sheenRoughnessMap',
  'transmissionMap', 'thicknessMap', 'iridescenceMap', 'matcap',
];

function disposeMaterial(material) {
  for (const slot of TEXTURE_SLOTS) material[slot]?.dispose?.();
  material.dispose();
}

export function disposeSceneGraph(root) {
  if (!root) return;
  root.traverse(obj => {
    obj.geometry?.dispose?.();
    const m = obj.material;
    if (!m) return;
    if (Array.isArray(m)) m.forEach(disposeMaterial);
    else disposeMaterial(m);
  });
  root.clear?.();
}

// ─── Managed WebGL renderer ─────────────────────────────────────────────────
// Wraps a renderer the scene has already constructed with its own options
// (antialias, alpha, depth settings differ per scene and stay the scene's
// call) and owns the three things every scene needed and none of them had:
//
//   1. A device-pixel-ratio cap. Uncapped, a DPR-3 phone renders nine times
//      the fragments — worst exactly on the heaviest scenes. Beamline already
//      capped at 2 and looked identical doing it; this is that, everywhere.
//   2. Real context release. THREE.WebGLRenderer.dispose() tears down caches
//      but does NOT free the GL context (checked against the pinned 0.185
//      build). With eight preview contexts alive permanently plus one per
//      open scene, against a browser cap around sixteen, scene switches
//      accumulated orphans until the browser force-lost the OLDEST contexts —
//      which are the landing tiles, so the symptom was a gallery thumbnail
//      going black for the rest of the session.
//   3. A webglcontextlost handler. Without one, a lost context (mobile
//      backgrounding, GPU reset, memory pressure) leaves a permanently black
//      canvas with the animation loop still burning CPU and nothing logged.
export function manageRenderer(renderer, { maxPixelRatio = 2, onLost } = {}) {
  const canvas = renderer.domElement;
  const applyPixelRatio = () =>
    renderer.setPixelRatio(Math.min(maxPixelRatio, window.devicePixelRatio || 1));
  applyPixelRatio();

  const onContextLost = e => {
    // preventDefault is what makes restoration possible at all; without it
    // the browser never fires webglcontextrestored.
    e.preventDefault();
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  return {
    // Call from the resize handler too — a window dragged between a Retina
    // and a non-Retina display changes devicePixelRatio without any other
    // signal.
    applyPixelRatio,
    dispose() {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
    },
  };
}
