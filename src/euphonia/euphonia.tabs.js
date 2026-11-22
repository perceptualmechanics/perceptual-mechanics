// The tabs over /euphonia/: the Reading first, once the book exports it, then
// the map and the character builder. The address says which is open (#builder; #reading
// and its steps; any other address is the map's, a region's chapter included),
// so a link to any of them opens it. Their code loads when the tab first opens.
import { LAST, landing } from './euphonia.door.js';

const BUILDER_HASH = '#builder', READING_HASH = '#reading';

function initTabs(list) {
  const tabs = [...list.querySelectorAll('[role=tab]')];
  const panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));
  const top = list.closest('.euphonia-top');
  const mapTab = tabs.findIndex(t => t.id === 'tab-map'), builderTab = tabs.findIndex(t => t.id === 'tab-builder'), readingTab = tabs.findIndex(t => t.id === 'tab-reading');
  // With the tabs running, the map's stage is a tab's panel, not a region of
  // its own.
  const map = panels[mapTab];
  map.setAttribute('role', 'tabpanel');
  map.removeAttribute('aria-label');
  map.setAttribute('aria-labelledby', tabs[mapTab].id);

  const fromAddress = () => (location.hash === BUILDER_HASH ? builderTab : readingTab >= 0 && location.hash.startsWith(READING_HASH) ? readingTab : mapTab);
  let builder = null, reading = null;
  function select(i, { focus = false, record = true } = {}) {
    tabs.forEach((t, k) => {
      t.setAttribute('aria-selected', String(k === i));
      t.tabIndex = k === i ? 0 : -1;
      panels[k].hidden = k !== i;
    });
    const isBuilder = i === builderTab, isReading = i === readingTab;
    top.classList.toggle('is-builder', i !== mapTab);
    // The sheet is what prints while the builder is open.
    document.documentElement.dataset.tab = isBuilder ? 'builder' : isReading ? 'reading' : 'map';
    if (focus) tabs[i].focus();
    if (record) history.replaceState(history.state, '', `${location.pathname}${location.search}${isBuilder ? BUILDER_HASH : isReading ? (location.hash.startsWith(READING_HASH) ? location.hash : READING_HASH) : ''}`);
    if (isBuilder && !builder) builder = import('./euphonia.builder.js').then(m => m.initBuilder(panels[i]));
    if (isReading && !reading) reading = import('./euphonia.reading.ui.js').then(m => m.initReading(panels[i]));
    // Where to come back to; the colophon, down the page, is no place to open.
    try { if (!document.getElementById(location.hash.slice(1))?.closest('.euphonia-foot')) localStorage.setItem(LAST, location.hash); } catch { /* no storage: every visit is a first */ }
  }

  list.addEventListener('click', e => {
    const i = tabs.indexOf(e.target.closest('[role=tab]'));
    if (i >= 0) select(i);
  });
  list.addEventListener('keydown', e => {
    const i = tabs.indexOf(document.activeElement);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (i < 0 || to === undefined) return;
    e.preventDefault();
    select((to + tabs.length) % tabs.length, { focus: true });
  });
  // A link within the page to the builder, or back to the map's chapters.
  addEventListener('hashchange', () => select(fromAddress(), { record: false }));

  list.hidden = false;
  let last = null;
  try { last = localStorage.getItem(LAST); } catch { /* as above */ }
  const door = landing({ hash: location.hash, search: location.search, last, hasReading: readingTab >= 0 });
  if (door) history.replaceState(history.state, '', `${location.pathname}${door}`);
  select(fromAddress(), { record: false });
}

const list = document.querySelector('.euphonia-tabs');
if (list) initTabs(list);

// On a phone the bar's buttons fold behind one: Menu opens them below the
// bar and closes again on Escape, on a click elsewhere, or once one of them
// has done its work. Wider, the button stays hidden by the CSS and the bar
// shows them all; without script it shows them all at any width.
function initMenu(bar) {
  const open = bar.querySelector('.euphonia-menu-open');
  const aside = bar.querySelector('.euphonia-aside');
  if (!open || !aside) return;
  const set = expanded => {
    open.setAttribute('aria-expanded', String(expanded));
    bar.classList.toggle('menu-open', expanded);
  };
  open.addEventListener('click', () => set(open.getAttribute('aria-expanded') !== 'true'));
  aside.addEventListener('click', e => { if (e.target.closest('button, a')) set(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && bar.classList.contains('menu-open')) { set(false); open.focus(); }
  });
  document.addEventListener('click', e => { if (!bar.contains(e.target)) set(false); });
  bar.classList.add('has-menu');
  open.hidden = false;
}

const bar = document.querySelector('.euphonia-bar');
if (bar) initMenu(bar);
