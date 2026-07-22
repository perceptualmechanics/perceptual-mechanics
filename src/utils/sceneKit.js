// ─── Scene Kit ──────────────────────────────────────────────────────────────
// Small, dependency-free helpers factored out of repeated boilerplate that
// had drifted slightly out of sync across scenes — most notably: two of the
// four drag-to-orbit scenes (sphere.js, orrery.js) never actually had touch
// support for the rotation itself (only for telling a tap from a drag), so
// "drag to orbit" silently didn't work on phones/tablets in those two scenes
// even though the other two (egg.js, butterfly.js) had it fine. Centralizing
// this means that class of gap can't reopen the next time a scene is added.
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
// The same three-line guard was copy-pasted into every scene: a hidden
// ancestor (the landing grid sitting behind an active full-screen scene)
// makes clientWidth/Height read 0, and resizing a renderer to 0 (or falling
// back to window size for what's actually a small preview tile) is the bug
// that guard exists to prevent. Also wires the orientationchange retry
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
// A couple of the heaviest-animated WebGL scenes (orrery, egg) had no
// reduced-motion accommodation at all, while their CSS-driven siblings
// (leaf, manuscript, lens) did. Since a `prefers-reduced-motion` CSS media
// query can't reach into a requestAnimationFrame loop, scenes that spin/
// orbit continuously need to check this directly and skip their own
// autonomous motion (drag-to-orbit stays available either way — that's
// motion the visitor asked for, not motion imposed on them).
export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

// ─── Preview-tile circular clip (Firefox WebGL workaround) ─────────────────
// Four straight CSS-only attempts at clipping a preview tile's WebGL canvas
// to a circle failed in Firefox: `contain: paint` on `.preview-container`,
// `clip-path: circle(50%)` on the same, `border-radius: 50%` on the canvas
// element itself, and finally an opaque `::after` ring painted on top of the
// canvas — all defeated. Scott confirmed it's specifically the two heaviest
// scenes (orrery, leaf), not every WebGL preview tile — sphere/butterfly/egg
// clip fine in the same browser with the exact same CSS. That's the real
// signal: Firefox is promoting only the demanding canvases to a GPU
// compositing layer that sits outside the page's normal paint/z-order
// entirely, unreachable by any CSS clip/overflow/z-index mechanism, no
// matter which element in the chain owns the property.
//
// The one technique that can't be defeated by that: don't display the
// WebGL canvas at all. Let the scene keep rendering into it exactly as
// before (off-DOM, never appended), then copy its finished pixels every
// frame onto a plain 2D `<canvas>` that IS in the DOM. `ctx.clip()` there
// is software rasterization, not GPU layer compositing — every browser
// honors it unconditionally, because there's no accelerated layer left to
// bypass it with.
//
// Opt-in per scene (call this only from a `preview` branch) rather than a
// blanket site-wide change: the five scenes that already clip fine don't
// need the extra per-frame copy, and confining this to the two scenes that
// actually have the bug keeps the blast radius of any mistake small.
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

// ─── Escape-to-close ────────────────────────────────────────────────────────
// Standard modal-dialog expectation that none of the site's three read-more
// panels (sphere, orrery, egg) had — closing only worked via the explicit
// close button or a click outside. Attaches at the document level so it
// fires regardless of what currently has focus inside the panel.
export function bindEscapeClose(onEscape) {
  const handler = e => { if (e.key === 'Escape') onEscape(); };
  document.addEventListener('keydown', handler);
  return { dispose() { document.removeEventListener('keydown', handler); } };
}
