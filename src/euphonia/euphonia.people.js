// The People page's finding: narrow it to one region and search it by
// name. Everyone is in the page's own text (scripts/euphonia-page.js); this
// only hides who doesn't match and says how many remain. The book's
// guidance under the list, Notable People, shows with everyone and steps
// aside while the reader is finding someone.

const fold = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function initPeople(page) {
  const find = page.querySelector('.people-find');
  const region = find.querySelector('.people-in');
  const name = find.querySelector('.people-name');
  const said = page.querySelector('.people-said');
  const notes = page.querySelector('.people-notes');
  const groups = [...page.querySelectorAll('.people-group')];
  function show() {
    const q = fold(name.value.trim());
    let found = 0;
    for (const g of groups) {
      let here = 0;
      for (const p of g.querySelectorAll('.person')) {
        // A name, accents aside ("Etain" finds Étaín).
        const match = !q || fold(p.dataset.name).includes(q);
        p.hidden = !match;
        here += match;
      }
      g.hidden = (region.value && g.dataset.group !== region.value) || (q && !here);
      if (!g.hidden) found += here;
    }
    notes.hidden = Boolean(q || region.value);
    said.hidden = !q && !region.value;
    said.textContent = found === 1 ? 'One person.' : `${found || 'No'} people.`;
  }
  region.addEventListener('change', show);
  name.addEventListener('input', show);
  find.hidden = false;
}

const page = document.querySelector('.map-panel-people');
if (page) initPeople(page);
