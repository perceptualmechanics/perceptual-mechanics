
import { crossLinkPlan, applyCrossLinkPlan } from './crossLinkMatch.js';

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

export function bindWheelZoom(container, { onZoom, isBlocked } = {}) {
  const handler = e => {
    if (isBlocked?.(e)) return;
    onZoom?.(e.deltaY);
  };
  container.addEventListener('wheel', handler, { passive: true });
  return { dispose() { container.removeEventListener('wheel', handler); } };
}

export function bindGuardedResize(container, onResize) {
  const handler = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    onResize(w, h);
  };
  const orientationHandler = () => setTimeout(handler, 100);
  window.addEventListener('resize', handler);
  window.addEventListener('orientationchange', orientationHandler);
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

export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

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
    get blits() { return blits; },
    dispose() { display.remove(); },
  };
}

export function bindTapVsDrag(container) {
  let moved = false;
  const onTouchStart = () => { moved = false; };
  const onTouchMove = () => { moved = true; };
  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchmove', onTouchMove, { passive: true });
  return {
    consume() { const m = moved; moved = false; return m; },
    dispose() {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
    },
  };
}

export function bindPersistedSoundToggle(container, toggleEl, setSoundEnabled, sceneKey) {
  if (!toggleEl) return { dispose() {} };
  const KEY = `pm-sound-enabled:${sceneKey}`;
  let storedOn = false;
  try { storedOn = localStorage.getItem(KEY) === '1'; } catch {  }

  let overridden = false; // set once the user explicitly clicks the toggle, so a later fallback activation can't undo their choice

  function activateStoredSound() {
    if (overridden) return;
    setSoundEnabled(true);
  }
  function onToggleClick() {
    overridden = true;
    const nowOn = toggleEl.getAttribute('aria-pressed') !== 'true';
    setSoundEnabled(nowOn);
    try { localStorage.setItem(KEY, nowOn ? '1' : '0'); } catch {  }
  }

  if (storedOn) {
    toggleEl.setAttribute('aria-pressed', 'true');
    const label = toggleEl.querySelector('span:last-child');
    if (label) label.textContent = 'Sound on';

    Promise.resolve().then(() => setSoundEnabled(true));

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

export function bindEscapeClose(onEscape) {
  const handler = e => { if (e.key === 'Escape') onEscape(); };
  document.addEventListener('keydown', handler);
  return { dispose() { document.removeEventListener('keydown', handler); } };
}

const openPanels = new Set();

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

export function createJumpList(container, { label, items, getLabel, onSelect }) {
  const list = document.createElement('ul');
  list.className = 'pm-jumplist pm-scene-chrome';
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

  list.addEventListener('click', e => e.stopPropagation());

  document.body.appendChild(list);
  return { dispose() { list.remove(); } };
}

export const HINT_TEXT_COLOR = 'rgba(255,255,255,0.6)';

export function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

export function wireCrossLinks(html, links, linkClass) {
  if (!links?.length) return html;
  const plan = crossLinkPlan(html, links.map(l => l.phrase), linkClass);
  return applyCrossLinkPlan(html, links, linkClass, plan);
}

export function formatInboundNote(titles) {
  const names = titles.filter(Boolean);
  if (!names.length) return null;
  if (names.length === 1) return `Referenced from ${names[0]}`;
  if (names.length === 2) return `Referenced from ${names[0]} and ${names[1]}`;
  return `Referenced from ${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export function setPanelSide(panel, fromLeft) {
  panel.classList.add('no-transition');
  panel.classList.toggle('from-left', fromLeft);
  void panel.offsetWidth; // force reflow before re-enabling the transition
  panel.classList.remove('no-transition');
}

export function clickedLeftHalf(e, rect) {
  return (e.clientX - rect.left) < rect.width / 2;
}

export function parseHTML(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content;
}


export function onReducedMotionChange(onChange) {
  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (!mq) return { dispose() {} };
  const handler = e => onChange(e.matches);
  mq.addEventListener('change', handler);
  return { dispose() { mq.removeEventListener('change', handler); } };
}

export function createFrameClock({ maxDelta = 0.05 } = {}) {
  let last = performance.now();
  let elapsed = 0;
  return {
    tick() {
      const now = performance.now();
      const dt = Math.min(maxDelta, (now - last) / 1000);
      last = now;
      elapsed += dt;
      return dt;
    },
    get elapsed() { return elapsed; },
    resync() { last = performance.now(); },
  };
}

export function trackTimers() {
  const timeouts = new Set();
  const frames = new Set();
  return {
    after(ms, fn) {
      const id = setTimeout(() => { timeouts.delete(id); fn(); }, ms);
      timeouts.add(id);
      return id;
    },
    nextFrame(fn) {
      const id = requestAnimationFrame(() => { frames.delete(id); fn(); });
      frames.add(id);
      return id;
    },
    cancel(id) {
      if (timeouts.delete(id)) { clearTimeout(id); return; }
      if (frames.delete(id)) cancelAnimationFrame(id);
    },
    dispose() {
      for (const id of timeouts) clearTimeout(id);
      for (const id of frames) cancelAnimationFrame(id);
      timeouts.clear();
      frames.clear();
    },
  };
}

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

export function manageRenderer(renderer, { maxPixelRatio = 2, onLost } = {}) {
  const canvas = renderer.domElement;
  const applyPixelRatio = () =>
    renderer.setPixelRatio(Math.min(maxPixelRatio, window.devicePixelRatio || 1));
  applyPixelRatio();

  const onContextLost = e => {
    e.preventDefault();
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  return {
    applyPixelRatio,
    dispose() {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
    },
  };
}
