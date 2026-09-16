import { initColophon }    from './components/colophon/colophon.js';
import { anyPanelOpen, prefersReducedMotion } from './utils/sceneKit.js';
import { SCENES, sceneAria } from './scenes/registry.js';

const sceneModules = import.meta.glob([
  './scenes/*/*.js',
  '!./scenes*.worklet.js',
  '!./scenes/spectra/*.js',
]);
function loadSceneModule(name) {
  const id = `./scenes/${name}/${name}.js`;
  const loader = sceneModules[id];
  if (!loader) {
    return Promise.reject(new Error(
      `scene "${name}" is in the registry but ${id} does not exist — a scene's folder and entry file must both be named after its registry key`));
  }
  return loader();
}

const sceneModulePromises = {};
function loadSceneCreate(name) {
  const entry = SCENES[name];
  sceneModulePromises[name] ??= loadSceneModule(name).catch(err => {
    delete sceneModulePromises[name];
    throw err;
  });
  return sceneModulePromises[name].then(mod => mod[entry.exportName]);
}
function prefetchScene(name) {
  if (Object.hasOwn(SCENES, name)) loadSceneCreate(name).catch(() => {});
}

let activeScene  = null;
let fullInstance = null;
let lastTrigger  = null;
let sceneLoadFailed = false;
let pendingFocusFrame = 0;

const previews = {};
const previewOnScreen = {};
let previewsSuspended = false;

function syncPreviewPlayback() {
  previewsSuspended = Boolean(activeScene) || document.hidden;
  for (const [name, instance] of Object.entries(previews)) {
    instance?.setPaused?.(previewsSuspended || previewOnScreen[name] === false);
  }
}

let syncingHash = false;

function rememberElsewhere(sceneName, pieceId) {
  if (!sceneName || sceneName === 'harmonics' || pieceId == null) return;
  try {
    sessionStorage.setItem('pm_elsewhere', JSON.stringify({ scene: sceneName, id: pieceId, t: Date.now() }));
  } catch {  }
}

function navIconFor(sceneName) {
  return document.querySelector(`.nav-icon[data-scene="${sceneName}"]`);
}

const PUBLIC_SLUG = { harmonics: 'harmonics', outside: 'outside' };
const SLUG_TO_INTERNAL = Object.fromEntries(Object.entries(PUBLIC_SLUG).map(([k, v]) => [v, k]));

function parseHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
  const slash = raw.indexOf('/');
  const rawKey = slash === -1 ? raw : raw.slice(0, slash);
  const rest = slash === -1 ? undefined : raw.slice(slash + 1);
  const sceneKey = SLUG_TO_INTERNAL[rawKey] ?? rawKey;
  const scene = Object.hasOwn(SCENES, sceneKey) ? sceneKey : null;
  const isPiece = rest !== undefined && /^\d+$/.test(rest);
  return {
    scene,
    pieceId: scene && isPiece ? Number(rest) : null,
    arg: scene && rest !== undefined && !isPiece && rest !== '' ? rest : null,
  };
}

function setHash(sceneName, pieceId, { push = true, arg = null } = {}) {
  syncingHash = true;
  const publicName = sceneName ? (PUBLIC_SLUG[sceneName] ?? sceneName) : sceneName;
  const suffix = pieceId ? `/${pieceId}` : (arg ? `/${arg}` : '');
  const next = publicName ? `${publicName}${suffix}` : '';
  if (next) {
    if (push) {
      location.hash = next;
    } else {
      history.replaceState(null, '', `${location.pathname}${location.search}#${next}`);
    }
  } else if (location.hash) {
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

const CROSSFADE_MS = (() => {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--scene-crossfade').trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return 600;
  return raw.endsWith('ms') ? n : n * 1000;
})();

function setActiveIcon(sceneName) {
  document.querySelectorAll('.nav-icon').forEach(b => {
    b.classList.toggle('active', b.dataset.scene === sceneName);
  });
}


const FOCUSABLE = 'button, a[href], input, select, textarea, summary, [tabindex]';

const onScreen = (el) => {
  if (typeof el.checkVisibility === 'function') {
    return el.checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true });
  }
  if (el.getClientRects().length === 0) return false;
  if (getComputedStyle(el).visibility === 'hidden') return false;
  return !(el.closest('details:not([open])') && !el.closest('summary'));
};

function collect(root) {
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter(el =>
    el.tabIndex !== -1 &&
    !el.closest('[hidden]') &&
    !el.disabled &&
    onScreen(el)
  );
}
function overlayFocusables() {
  const sceneChrome = Array.from(document.querySelectorAll('.pm-scene-chrome'))
    .filter(el => !overlay.contains(el))
    .flatMap(el => (el.matches(FOCUSABLE) ? [el] : []).concat(collect(el)))
    .filter(el => el.tabIndex !== -1 && !el.closest('[hidden]') && !el.disabled && onScreen(el));
  const siteChrome = [skipLink, ...document.querySelectorAll('.nav-icon'), siteTitle, fsToggle]
    .filter(el => el && !el.hidden && onScreen(el));
  return [...new Set([...collect(overlay), ...sceneChrome, ...siteChrome])]
    .sort((a, b) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
}

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

let transitioning = false;

function expandScene(sceneName, triggerEl = null, pieceId = null, sceneArg = null) {
  if (transitioning) return;
  if (activeScene === sceneName && !sceneLoadFailed) {
    if (sceneArg) { fullInstance?.applyArg?.(sceneArg); setHash(sceneName, null, { push: false, arg: sceneArg }); return; }
    if (pieceId) fullInstance?.openPieceById?.(pieceId);
    else fullInstance?.closePiece?.();
    return;
  }
  lastTrigger = triggerEl;

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
    syncPreviewPlayback();
    overlay.classList.add('active');
    overlay.dataset.scene = sceneName;
    const overlayBg = SCENES[sceneName]?.overlayBg;
    if (overlayBg) overlay.style.setProperty('--overlay-bg', overlayBg);
    else overlay.style.removeProperty('--overlay-bg');
    overlay.setAttribute('aria-hidden', 'false');
    const spec = SCENES[sceneName];
    overlay.setAttribute('aria-label', spec ? sceneAria(spec) : 'Full screen experience.');
    if (expHeading) expHeading.textContent = SCENES[sceneName]?.label ?? 'Full screen experience.';

    let loadingShown = false;
    const loadingTimer = setTimeout(() => {
      loadingShown = true;
      overlay.classList.add('pm-loading');
    }, 150);

    loadSceneCreate(sceneName).then(create => {
      clearTimeout(loadingTimer);
      if (loadingShown) overlay.classList.remove('pm-loading');
      if (activeScene !== sceneName) return;

      fullInstance = create(expContainer, {
        preview: false,
        initialPieceId: pieceId,
        initialArg: sceneArg,
        onStateChange: str => setHash(sceneName, null, { push: false, arg: str || null }),
        onPieceChange: id => { setHash(sceneName, id, { push: false }); rememberElsewhere(sceneName, id); },
      });
      expContainer.setAttribute('tabindex', '-1');
      cancelAnimationFrame(pendingFocusFrame);
      pendingFocusFrame = requestAnimationFrame(() => {
        pendingFocusFrame = 0;
        if (activeScene === sceneName) expContainer.focus();
      });
      transitioning = false;
    }).catch(() => {
      clearTimeout(loadingTimer);
      transitioning = false;
      if (activeScene !== sceneName) return;
      sceneLoadFailed = true;
      showSceneLoadError();
    });
  }

  transitioning = true;

  if (swapping && !prefersReducedMotion()) {
    overlay.classList.remove('active');
    setTimeout(mountNext, CROSSFADE_MS);
  } else {
    mountNext();
  }
}

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
    syncPreviewPlayback();
    window.dispatchEvent(new Event('resize'));
    lastTrigger?.focus();
  }

  if (prefersReducedMotion()) finish();
  else setTimeout(finish, CROSSFADE_MS);
}

document.querySelectorAll('.nav-icon').forEach(btn => {
  const scene = btn.dataset.scene;
  btn.addEventListener('pointerenter', () => { prefetchScene(scene); pmGlimpse(scene); });
  btn.addEventListener('touchstart', () => prefetchScene(scene), { passive: true });
  btn.addEventListener('click', () => {
    if (activeScene === scene && !sceneLoadFailed) {
      returnToGallery();
    } else {
      expandScene(scene, btn);
    }
  });
});

siteTitle.addEventListener('click', returnToGallery);
siteTitle.addEventListener('pointerenter', () => pmGlimpse(siteTitle.dataset.glimpse));

document.addEventListener('keydown', e => {
  if (!activeScene) return;
  if (e.key === 'Escape') {
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

document.querySelectorAll('.preview-wrapper').forEach(w => {
  const container = w.querySelector('.preview-container');
  const scene = w.dataset.scene;
  container.addEventListener('pointerenter', () => { prefetchScene(scene); pmGlimpse(scene); });
  container.addEventListener('touchstart', () => prefetchScene(scene), { passive: true });
  container.addEventListener('click', () => expandScene(scene, container));
});

const previewVisibility = 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => {
      if (activeScene) return;
      for (const entry of entries) {
        const name = entry.target.closest('.preview-wrapper')?.dataset.scene;
        if (name) previewOnScreen[name] = entry.isIntersecting;
      }
      syncPreviewPlayback();
    }, { rootMargin: '100% 0px' })
  : null;

async function initPreviews() {
  const entries = Object.keys(SCENES)
    .map(name => [name, document.getElementById(`preview-${name}`)])
    .filter(([, el]) => el);

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

const SCENE_COUNT = Object.keys(SCENES).length;

import { tileLayout, tileScale, tileNudge, MAX_TILE_SCALE } from './utils/tileLayout.js';

function applyDerivedLayout() {
  const list = document.getElementById('scene-previews');
  const nav = document.getElementById('pm-nav');
  const landing = document.getElementById('landing');
  const tiles = list ? [...list.querySelectorAll('.preview-wrapper')] : [];
  const icons = nav ? nav.querySelectorAll('.nav-icon').length : 0;

  if (icons !== SCENE_COUNT || tiles.length !== SCENE_COUNT) {
    console.warn(`landing layout: registry has ${SCENE_COUNT} scenes but the page has ${icons} nav icons and ${tiles.length} tiles — the derived nav and grid sizing assume all three agree`);
  }
  if (nav) nav.style.setProperty('--nav-count', String(SCENE_COUNT));
  if (!list || !landing) return;

  const desktop = window.matchMedia('(min-width: 601px)').matches;
  const width = landing.clientWidth;
  const cs = getComputedStyle(landing);
  const height = landing.clientHeight
    - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const fit = desktop ? tileLayout(SCENE_COUNT, width, height) : null;

  list.classList.toggle('rows-forced', Boolean(fit));
  if (fit) {
    list.style.setProperty('--tile-cols', String(fit.cols));
    list.style.setProperty('--tile', `${fit.base}px`);
    list.style.setProperty('--tile-row', `${Math.round(fit.base * (1 + (MAX_TILE_SCALE - 1) * fit.v))}px`);
  } else {
    list.style.removeProperty('--tile');
  }
  tiles.forEach((el) => {
    const key = el.querySelector('[id^="preview-"]')?.id.slice('preview-'.length);
    const spec = key ? SCENES[key] : null;
    if (fit && !spec) {
      console.warn(`landing layout: tile "${key || '(no id)'}" has no registry entry — it will draw at the base size`);
    }
    if (!fit || !spec) {
      el.style.removeProperty('--tile-self');
      el.style.removeProperty('--tile-nudge');
      return;
    }
    el.style.setProperty('--tile-self', `${Math.round(fit.base * tileScale(spec, fit))}px`);
    el.style.setProperty('--tile-nudge', `${Math.round(fit.base * tileNudge(spec, fit))}px`);
  });

  list.querySelectorAll('.preview-row-break').forEach(el => el.remove());
  if (fit) {
    for (let i = fit.cols; i < tiles.length; i += fit.cols) {
      const br = document.createElement('li');
      br.className = 'preview-row-break';
      br.setAttribute('aria-hidden', 'true');
      tiles[i].before(br);
    }
  }
}

let layoutTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(applyDerivedLayout, 120);
}, { passive: true });

applyDerivedLayout();

initPreviews();

document.addEventListener('visibilitychange', () => {
  fullInstance?.setPaused?.(document.hidden);
  syncPreviewPlayback();
});

window.addEventListener('pagehide', () => {
  try { fullInstance?.dispose?.(); } catch {  }
  fullInstance = null;
  previewsSuspended = true;
  for (const instance of Object.values(previews)) {
    try { instance?.setPaused?.(true); } catch {  }
  }
});

function dropUnknownHash() {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

const initialHash = parseHash();
if (initialHash.scene) expandScene(initialHash.scene, navIconFor(initialHash.scene), initialHash.pieceId, initialHash.arg);
else dropUnknownHash();

window.addEventListener('hashchange', () => {
  if (syncingHash) return;
  const { scene, pieceId, arg } = parseHash();
  if (scene) expandScene(scene, navIconFor(scene), pieceId, arg);
  else { returnToGallery(); dropUnknownHash(); }
});

skipLink?.addEventListener('click', e => {
  e.preventDefault();
  (activeScene ? expContainer : landing).focus();
});

window.addEventListener('pm:navigate', e => {
  const { scene: targetScene, pieceId } = e.detail ?? {};
  if (targetScene && Object.hasOwn(SCENES, targetScene)) {
    expandScene(targetScene, navIconFor(targetScene), pieceId ?? null);
  }
});

initColophon();

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
  apollo: 'absorption',
  psyshell: 'residue',
  medium: 'deux',
  title: 'secrets',
};
let pmGlimpseTimer = null;
function pmGlimpse(key) {
  if (!key) return;
  if (Math.random() >= 0.01) return;
  const word = PM_GLIMPSE_WORDS[key];
  if (!word) return;
  document.title = word;
  clearTimeout(pmGlimpseTimer);
  pmGlimpseTimer = setTimeout(() => { document.title = PM_ORIGINAL_TITLE; }, 1100);
}

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

const fsEnabled = document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? false;
if (fsToggle && fsEnabled) {
  fsToggle.hidden = false;
  pmNav?.style.setProperty('--nav-extra', '1');

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
      request?.call(root)?.catch?.(() => {});
    }
  });

  document.addEventListener('fullscreenchange', syncFsToggle);
  document.addEventListener('webkitfullscreenchange', syncFsToggle);
  syncFsToggle();
}
