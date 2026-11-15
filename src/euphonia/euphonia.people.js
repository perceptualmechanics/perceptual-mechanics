// The People page's finding: narrow it to one region (or Notable People) and
// search it by name. Everyone is in the page's own text (scripts/euphonia-
// page.js); this only hides who doesn't match and says how many remain.

const fold = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function initPeople(page) {
  const find = page.querySelector('.people-find');
  const region = find.querySelector('.people-in');
  const name = find.querySelector('.people-name');
  const said = page.querySelector('.people-said');
  const groups = [...page.querySelectorAll('.people-group')];
  function show() {
    const q = fold(name.value.trim());
    let found = 0;
    for (const g of groups) {
      const people = [...g.querySelectorAll('.person')];
      let here = 0;
      for (const p of people) {
        // A name, accents aside ("Etain" finds Étaín).
        const match = !q || fold(p.dataset.name).includes(q);
        p.hidden = !match;
        here += match;
      }
      // While searching, a group shows only the people who match, not the
      // lines that introduce them.
      for (const child of g.children) if (child.tagName !== 'H3' && !child.matches('.person') && !child.querySelector('.person')) child.hidden = Boolean(q);
      g.hidden = (region.value && g.dataset.group !== region.value) || (q && !here);
      if (!g.hidden) found += here;
    }
    said.hidden = !q && !region.value;
    said.textContent = found === 1 ? 'One person.' : `${found || 'No'} people.`;
  }
  region.addEventListener('change', show);
  name.addEventListener('input', show);
  find.hidden = false;
}

const page = document.querySelector('.map-panel-people');
if (page) initPeople(page);
