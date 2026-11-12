// Before the page is drawn, the theme it opens in: one named in the address
// (?theme=…) first, then the one this reader chose before, and on a first
// visit one of the powers' at random, whose region the globe then faces
// (euphonia.map.js reads data-theme). The ids, the storage key and the
// address's word are written onto <html> by the build from the theme data
// (src/euphonia/euphonia.themes.js), so this file names none of them. A
// plain blocking script on purpose: the theme must be set before the body
// is painted, or the page would show the first theme and then change.
(() => {
  const root = document.documentElement, ids = root.dataset.themes.split(' ');
  const known = id => (ids.includes(id) ? id : null);
  let id = known(new URLSearchParams(location.search).get(root.dataset.themeParam));
  if (!id) try { id = known(localStorage.getItem(root.dataset.themeKey)); } catch { /* no storage: as on a first visit */ }
  if (!id) { id = ids[Math.floor(Math.random() * ids.length)]; root.dataset.themeFirst = ''; }
  root.dataset.theme = id;
})();
