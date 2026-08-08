function makeClassList() {
  const set = new Set();
  return {
    add: (...c) => c.forEach(x => set.add(x)),
    remove: (...c) => c.forEach(x => set.delete(x)),
    toggle: (c, on) => { on ? set.add(c) : set.delete(c); },
    contains: c => set.has(c),
  };
}
function makeOpenFragment(panel) {
  return function openFragment(fi, { fromLeft } = {}) {
    const populate = () => {};
    const wasOpen = panel.classList.contains('open');
    const sideMismatch = fromLeft !== undefined && panel.classList.contains('from-left') !== fromLeft;
    if (wasOpen && sideMismatch) {
      panel.classList.remove('open');
      panel._pendingReopen = () => {
        panel.classList.toggle('from-left', fromLeft);
        populate();
        panel.classList.add('open');
      };
      return 'closing-then-reopening';
    }
    panel.classList.toggle('from-left', fromLeft ?? panel.classList.contains('from-left'));
    populate();
    panel.classList.add('open');
    return 'opened-in-place';
  };
}
function runReopenTimers(panel) {
  if (panel._pendingReopen) { panel._pendingReopen(); delete panel._pendingReopen; }
}

const panel = { classList: makeClassList() };
const openFragment = makeOpenFragment(panel);

let r = openFragment(0, { fromLeft: true });
console.assert(r === 'opened-in-place', 'first open should be immediate');
console.assert(panel.classList.contains('open') && panel.classList.contains('from-left'), 'panel open, anchored left');

r = openFragment(1, { fromLeft: false });
console.assert(r === 'closing-then-reopening', 'cross-side click while open must close-then-reopen');
console.assert(!panel.classList.contains('open'), 'panel closed mid-transition');
console.assert(panel.classList.contains('from-left'), 'anchor unchanged until after transition');
runReopenTimers(panel);
console.assert(panel.classList.contains('open') && !panel.classList.contains('from-left'), 'now open, anchored right');

r = openFragment(2, { fromLeft: false });
console.assert(r === 'opened-in-place', 'same-side click while open should swap in place');
console.assert(panel.classList.contains('open'), 'stays open for same-side swap');

console.log('SPHERE PANEL CROSS-SIDE FIX: all assertions passed');
