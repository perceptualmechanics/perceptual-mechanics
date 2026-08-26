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
export function bindGuardedResize(container, onResize) {
  const handler = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    onResize(w, h);
  };
  const orientationHandler = () => setTimeout(handler, 100);
  window.addEventListener('resize', handler);
  window.addEventListener('orientationchange', orientationHandler);
  return {
    trigger: handler,
    dispose() {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', orientationHandler);
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
export function mountClippedPreviewCanvas(container, renderer) {
  const display = document.createElement('canvas');
  display.setAttribute('aria-hidden', 'true');
  display.style.width = '100%';
  display.style.height = '100%';
  display.style.display = 'block';
  container.appendChild(display);
  const ctx = display.getContext('2d');

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
    },
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
// harmonics, outside) — one localStorage key for the whole site, not one
// per scene, so turning sound on in one audio-enabled scene is remembered
// the next time you land on any other one, the same way a real mute switch
// would be, rather than each scene silently forgetting your choice the
// moment you navigate away.
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
export function bindPersistedSoundToggle(container, toggleEl, setSoundEnabled) {
  if (!toggleEl) return;
  const KEY = 'pm-sound-enabled';
  let storedOn = false;
  try { storedOn = localStorage.getItem(KEY) === '1'; } catch { /* private browsing / storage disabled — just skip persistence */ }

  let overridden = false; // set once the user explicitly clicks the toggle, so a later fallback activation can't undo their choice

  if (storedOn) {
    toggleEl.setAttribute('aria-pressed', 'true');
    const label = toggleEl.querySelector('span:last-child');
    if (label) label.textContent = 'Sound on';

    // Try starting audio right away — see the comment above for why this
    // is correct in this SPA's common case (the scene-switch gesture
    // itself already granted sticky activation) rather than overcautious.
    setSoundEnabled(true);

    // Cold-load fallback: only matters if the immediate attempt above
    // landed on a document with no activation yet at all.
    container.addEventListener('pointerdown', function activateStoredSound() {
      if (overridden) return;
      setSoundEnabled(true);
    }, { once: true });
  }

  toggleEl.addEventListener('click', () => {
    overridden = true;
    const nowOn = toggleEl.getAttribute('aria-pressed') !== 'true';
    setSoundEnabled(nowOn);
    try { localStorage.setItem(KEY, nowOn ? '1' : '0'); } catch { /* same as above */ }
  });
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
export function createPanelCloser(panel, container, { closeBtn, onClose } = {}) {
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
// into a read-more panel's innerHTML. Round-trips the string through a
// detached element's textContent/innerHTML rather than a hand-rolled regex,
// so it escapes quotes too — matters wherever the escaped string lands
// inside an HTML attribute, not just element content.
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
export function wireCrossLinks(html, links, linkClass) {
  let out = html;
  links.forEach(l => {
    out = out.replace(
      l.phrase,
      `<a class="${linkClass}" data-target-scene="${l.to.scene}" data-target-id="${l.to.id}" role="link" tabindex="0">${l.phrase}</a>`
    );
  });
  return out;
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
