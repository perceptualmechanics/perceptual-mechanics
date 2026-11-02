// The tabs over /euphonia/: the map and the character builder. The address
// says which is open (#builder; any other address is the map's, a region's
// chapter included), so a link to either opens it. The builder's code and
// rules load the first time its tab opens.

const BUILDER_HASH = '#builder';

function initTabs(list) {
  const tabs = [...list.querySelectorAll('[role=tab]')];
  const panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));
  const top = list.closest('.euphonia-top');
  // With the tabs running, the map's stage is a tab's panel, not a region of
  // its own.
  const map = panels[0];
  map.setAttribute('role', 'tabpanel');
  map.removeAttribute('aria-label');
  map.setAttribute('aria-labelledby', tabs[0].id);

  const builderTab = tabs.findIndex(t => t.id === 'tab-builder');
  let builder = null;
  function select(i, { focus = false, record = true } = {}) {
    tabs.forEach((t, k) => {
      t.setAttribute('aria-selected', String(k === i));
      t.tabIndex = k === i ? 0 : -1;
      panels[k].hidden = k !== i;
    });
    const isBuilder = i === builderTab;
    top.classList.toggle('is-builder', isBuilder);
    // The sheet is what prints while the builder is open.
    document.documentElement.dataset.tab = isBuilder ? 'builder' : 'map';
    if (focus) tabs[i].focus();
    if (record) history.replaceState(history.state, '', `${location.pathname}${location.search}${isBuilder ? BUILDER_HASH : ''}`);
    if (isBuilder && !builder) builder = import('./euphonia.builder.js').then(m => m.initBuilder(panels[i]));
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
  addEventListener('hashchange', () => select(location.hash === BUILDER_HASH ? builderTab : 0, { record: false }));

  list.hidden = false;
  select(location.hash === BUILDER_HASH ? builderTab : 0, { record: false });
}

const list = document.querySelector('.euphonia-tabs');
if (list) initTabs(list);
