// The character builder: the choices on one side, the sheet they make on the
// other. Every number on the sheet is the engine's (euphonia.character.js);
// this file only asks and shows. The character lives in the address (?c=),
// so a link is the character, and this browser remembers the last one.
import srdUrl from './euphonia.srd.json?url';
import classesUrl from './euphonia.classes.json?url';
import subclassesUrl from './euphonia.subclasses.json?url';
import itemsUrl from './euphonia.items.json?url';
import legalUrl from './euphonia.legal.json?url';
import charactersUrl from './euphonia.characters.json?url';
import languagesUrl from './euphonia.languages.json?url';
import tonguesUrl from './euphonia.tongues.json?url';
import places from 'virtual:euphonia-places';
import { ABILITIES, MAX_LEVEL, rulebook, character, speciesOptions, featsAllowed, featIncrease, qualifies } from './euphonia.character.js';
import { inline, blocks } from './euphonia.markdown.js';
import { khipu } from './euphonia.ornament.js';

const STORE_KEY = 'pm-euphonia-character';
const PARAM = 'c';
// A number the sheet can't know yet (no scores chosen, say) shows as a dash.
const known = n => (Number.isFinite(n) ? String(n) : '—');
const signed = n => (!Number.isFinite(n) ? '—' : n >= 0 ? `+${n}` : `−${-n}`);
const blank = () => ({ name: '', species: '', option: '', size: '', background: '', increases: {}, method: 'standard', base: {}, classes: [{ class: '', level: 1, subclass: '' }], skills: {}, improvements: {}, originFeats: {}, featLists: {}, spells: {}, homeland: '', market: '', styles: {}, expertise: {}, options: {}, optionArts: {}, languages: {} });

// The character in the address: its choices as JSON, base64url.
const encode = state => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(state)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function decode(code) {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    const state = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    return state && typeof state === 'object' && Array.isArray(state.classes) ? { ...blank(), ...state } : null;
  } catch { return null; }
}

// A small element builder: h('p', { class: 'x' }, 'text', child).
// A part of the page comes as nodes, lists of them nested however deep the
// sheet builds them, and nulls where it leaves something out.
const present = children => children.flat(Infinity).filter(c => c !== null && c !== undefined && c !== false);
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...present(children));
  return el;
}
const options = (values, chosen, prompt) => [
  ...(prompt ? [h('option', { value: '' }, prompt)] : []),
  ...values.map(v => (typeof v === 'string' ? h('option', { value: v, selected: v === chosen }, v) : h('option', { value: v.value, selected: v.value === chosen, disabled: v.disabled }, v.label))),
];
// "A", "A and B", "A, B and C".
const listed = items => (items.length < 3 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const idFor = field => `problem-${field.replace(/[^\w-]+/g, '-')}`;
// Rebuilding a group of controls keeps the keyboard where it was: the
// control with the same key takes focus back.
function rebuild(container, ...children) {
  const key = container.contains(document.activeElement) ? document.activeElement.dataset.key : null;
  container.replaceChildren(...present(children));
  if (key) container.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus();
}

export async function initBuilder(panel) {
  const form = panel.querySelector('.builder-form');
  const sheet = panel.querySelector('.sheet');
  const status = form.querySelector('.builder-status');
  let book, srd, languages, tongueNames, legal;
  try {
    const [s, e, c, l, t, a, g, f] = await Promise.all([srdUrl, classesUrl, charactersUrl, languagesUrl, tonguesUrl, subclassesUrl, itemsUrl, legalUrl].map(u => fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })));
    srd = s; book = rulebook(s, e, c, a, g.data); languages = l.data; legal = f.data;
    // What a language field suggests: the real tongues of the cultures the
    // book names (the ribbons' list), then the rules' own languages.
    tongueNames = [...new Set([...t.tongues.map(x => x.language), ...book.languages.standard, ...book.languages.rare])];
  } catch (err) {
    status.textContent = `The rules didn't load (${err.message}); reload the page to try again.`;
    return;
  }

  let state = decode(new URLSearchParams(location.search).get(PARAM) ?? '');
  if (!state) { try { state = decode(localStorage.getItem(STORE_KEY) ?? ''); } catch { /* storage unavailable */ } }
  state ??= blank();

  // ---------- the controls, built once; the parts whose shape depends on
  // earlier choices are rebuilt only when that shape changes.
  const problemSlot = field => h('p', { class: 'b-problem', id: idFor(field), hidden: true });
  const section = (title, ...body) => h('fieldset', { class: 'b-section' }, h('legend', {}, title), ...body);

  const nameInput = h('input', { name: 'name', type: 'text', autocomplete: 'off', maxlength: 80, value: state.name });
  const classList = h('ol', { class: 'b-classes' });
  const addClass = h('button', { type: 'button', class: 'b-button' }, 'Add another class (multiclass)');
  const speciesSelect = h('select', { name: 'species', 'aria-describedby': idFor('species') }, options(book.species.map(s => s.name), state.species, 'Choose a species'));
  const optionLabel = h('span');
  const optionSelect = h('select', { name: 'option', 'aria-describedby': idFor('option') });
  const optionRow = h('label', { class: 'b-field', hidden: true }, optionLabel, optionSelect);
  const sizeSelect = h('select', { name: 'size', 'aria-describedby': idFor('size') });
  const sizeRow = h('label', { class: 'b-field', hidden: true }, h('span', {}, 'Size'), sizeSelect);
  const speciesTraits = h('div', { class: 'b-about' });
  // Sources side by side: the setting's own first, as with the classes.
  const bySource = (list, chosen, label) => ['Euphonia', 'SRD 5.2.1'].map(src => h('optgroup', { label: src === 'Euphonia' ? `Euphonia’s ${label}` : `The SRD’s ${label}` },
    options(list.filter(x => x.source === src).map(x => x.name), chosen)));
  const backgroundSelect = h('select', { name: 'background', 'aria-describedby': idFor('background') }, h('option', { value: '' }, 'Choose a background'), bySource(book.backgrounds, state.background, 'backgrounds'));
  // A people: where the family comes from, one of the State of the World's
  // regions, whose chapter opens on the map.
  const homelandSelect = h('select', { name: 'homeland' }, options(places.regions.map(r => r.name), state.homeland, 'Choose a region'));
  const homelandLink = h('p', { class: 'b-note' });
  // Where the character buys what the books price by distance (a Mutapan
  // curiosity), among the places they name; by default, the homeland's.
  const marketSelect = h('select', { name: 'market' }, h('option', { value: '' }), options([...new Set(book.items.flatMap(i => i.prices?.places.map(p => p.place) ?? []))], state.market));
  const styleBox = h('div', { class: 'b-styles' });
  const optionBox = h('div', { class: 'b-options' });
  const pickBox = h('div', { class: 'b-picks' });
  const revelationBox = h('div', { class: 'b-picks' });
  const spellSetBox = h('div', { class: 'b-picks' });
  const kindBox = h('div', { class: 'b-picks' });
  const saveBox = h('div', { class: 'b-picks' });
  const weaponBox = h('div', { class: 'b-picks' });
  const targetBox = h('div', { class: 'b-picks' });
  const ruleBox = h('div', { class: 'b-picks' });
  const formBox = h('div', { class: 'b-picks' });
  const swapBox = h('div', { class: 'b-picks' });
  const walkedBox = h('div', { class: 'b-picks' });
  const noteBox = h('div', { class: 'b-picks' });
  const toolsBox = h('div', { class: 'b-skill-groups' });
  const masteryBox = h('div', { class: 'b-mastery' });
  const featureOriginBox = h('div', { class: 'b-origin' });
  const languageBox = h('div', { class: 'b-languages' });
  const tongueList = h('datalist', { id: 'b-tongues' }, tongueNames.map(n => h('option', { value: n })));
  const languageAbout = h('details', { class: 'b-about' }, h('summary', {}, 'Languages in 1668'), h('div', { html: blocks(languages.paragraphs.join('\n\n')) }));
  const expertiseBox = h('div', { class: 'b-expertise' });
  const increases = h('div', { class: 'b-increases', role: 'group', 'aria-label': 'Ability increases', 'aria-describedby': idFor('increases') });
  const backgroundAbout = h('div', { class: 'b-about' });
  const methods = [['standard', 'Standard array'], ['point', 'Point cost'], ['rolled', 'Rolled']];
  const methodGroup = h('div', { class: 'b-choice', role: 'radiogroup', 'aria-label': 'How to generate scores' },
    methods.map(([value, label]) => h('label', {}, h('input', { type: 'radio', name: 'method', value, checked: state.method === value }), ` ${label}`)));
  const scoreGrid = h('div', { class: 'b-scores', role: 'group', 'aria-label': 'Base scores', 'aria-describedby': idFor('base') });
  const pointsLeft = h('p', { class: 'b-note', 'aria-live': 'polite' });
  const skillsBox = h('div', { class: 'b-skill-groups' });
  const featsBox = h('div', { class: 'b-feats' });
  const originBox = h('div', { class: 'b-origin' });
  const skillNotes = h('ul', { class: 'b-notes' });
  const spellsBox = h('div', { class: 'b-spells' });

  // The choices a class's own features ask: shown only when there are some.
  const optionSection = h('fieldset', { class: 'b-section', hidden: true }, h('legend', {}, 'Class choices'), kindBox, swapBox, pickBox, revelationBox, walkedBox, spellSetBox, formBox, saveBox, weaponBox, masteryBox, optionBox, targetBox, noteBox, ruleBox);

  status.remove();
  form.append(
    section('Name', h('label', { class: 'b-field' }, h('span', {}, 'Character name'), nameInput)),
    section('Class', h('p', { class: 'b-note' }, 'The first is the class you began in. Its levels and the others’ make your character level.'), classList, addClass, problemSlot('classes'),
      book.unfinished.length ? h('p', { class: 'b-note' }, `${listed(book.unfinished.map((n, i) => `${i ? 'the' : 'The'} ${n}`))} ${book.unfinished.length === 1 ? 'is' : 'are'} still being written, and join${book.unfinished.length === 1 ? 's' : ''} the builder when finished.`) : null),
    optionSection,
    section('Species', h('label', { class: 'b-field' }, h('span', {}, 'Species'), speciesSelect), problemSlot('species'), optionRow, problemSlot('option'), sizeRow, problemSlot('size'), originBox, speciesTraits),
    section('Homeland', h('p', { class: 'b-note' }, 'Every species takes its traits as written; your people is where the family comes from, and the trouble comes with the country.'),
      h('label', { class: 'b-field' }, h('span', {}, 'Region'), homelandSelect), homelandLink,
      h('label', { class: 'b-field' }, h('span', {}, 'Buying in'), marketSelect),
      h('p', { class: 'b-note' }, `Mutapan curiosities cost more the farther they travel from ${book.items.find(i => i.prices)?.prices.home}, where they’re made.`)),
    section('Background', h('label', { class: 'b-field' }, h('span', {}, 'Background'), backgroundSelect), problemSlot('background'), increases, problemSlot('increases'), backgroundAbout),
    section('Languages', tongueList, languageBox, languageAbout),
    section('Ability scores', methodGroup, scoreGrid, pointsLeft, problemSlot('base'), problemSlot('method')),
    section('Skills', skillsBox, expertiseBox, skillNotes),
    section('Tools', toolsBox),
    section('Feats', styleBox, featureOriginBox, featsBox),
    section('Spells', spellsBox),
  );

  // ---------- reading the controls into the state
  const set = (mutate) => { mutate(state); update(); };
  nameInput.addEventListener('input', () => set(s => { s.name = nameInput.value; }));
  speciesSelect.addEventListener('change', () => set(s => { s.species = speciesSelect.value; s.option = ''; s.size = ''; }));
  optionSelect.addEventListener('change', () => set(s => { s.option = optionSelect.value; }));
  sizeSelect.addEventListener('change', () => set(s => { s.size = sizeSelect.value; }));
  backgroundSelect.addEventListener('change', () => set(s => { s.background = backgroundSelect.value; s.increases = {}; }));
  homelandSelect.addEventListener('change', () => set(s => { s.homeland = homelandSelect.value; s.market = ''; }));
  marketSelect.addEventListener('change', () => set(s => { s.market = marketSelect.value; }));
  methodGroup.addEventListener('change', e => set(s => { s.method = e.target.value; s.base = {}; }));
  addClass.addEventListener('click', () => {
    set(s => { s.classes.push({ class: '', level: 1, subclass: '' }); });
    classList.lastElementChild?.querySelector('select')?.focus();
  });

  // A class's subclasses, the setting's first and each named with its book
  // where a book adds it to an SRD class; a source with none isn't shown.
  const subclassGroups = (list, chosen) => ['Euphonia', 'SRD 5.2.1'].filter(src => list.some(x => x.source === src)).map(src => h('optgroup', { label: src === 'Euphonia' ? 'Euphonia’s subclasses' : 'The SRD’s subclasses' },
    list.filter(x => x.source === src).map(x => h('option', { value: x.name, selected: x.name === chosen || null }, x.book ? `${x.name} (${x.book.replace(/^Euphonia: /, '')})` : x.name))));
  // The classes, the setting's own first; then the SRD's it adds subclasses
  // to, apart from those it leaves as they are.
  const withOurs = c => c.subclasses.some(x => x.source === 'Euphonia');
  const classGroups = [
    ['Euphonia’s classes', book.classes.filter(c => c.source === 'Euphonia')],
    ['The SRD’s classes, with Euphonia’s subclasses', book.classes.filter(c => c.source === 'SRD 5.2.1' && withOurs(c))],
    ['The SRD’s classes', book.classes.filter(c => c.source === 'SRD 5.2.1' && !withOurs(c))],
  ].filter(([, list]) => list.length);
  // The class rows: a class, its level, its subclass once it has one.
  let classShape = null;
  function renderClasses(result) {
    const shape = state.classes.map(c => c.class).join('|');
    if (shape !== classShape) {
      classShape = shape;
      rebuild(classList, ...state.classes.map((c, i) => {
        const rules = book.classNamed(c.class);
        const groups = classGroups.map(([label, list]) => h('optgroup', { label }, options(list.map(x => x.name), c.class)));
        return h('li', { class: 'b-class' },
          h('label', { class: 'b-field' }, h('span', {}, i ? 'Then' : 'Class'),
            h('select', { 'data-key': `class-${i}`, 'aria-describedby': idFor('classes'), onchange: e => set(s => { s.classes[i] = { ...s.classes[i], class: e.target.value, subclass: '' }; }) }, h('option', { value: '' }, 'Choose a class'), groups)),
          h('label', { class: 'b-field b-level' }, h('span', {}, 'Level'),
            h('input', { 'data-key': `level-${i}`, type: 'number', min: 1, max: MAX_LEVEL, inputmode: 'numeric', value: c.level, oninput: e => set(s => { s.classes[i].level = Number(e.target.value); }) })),
          rules ? h('label', { class: 'b-field b-subclass' }, h('span', {}, `Subclass (from level ${rules.subclassLevel})`),
            h('select', { 'data-key': `subclass-${i}`, 'data-sub': c.class, 'aria-describedby': idFor(`subclass:${c.class}`), onchange: e => set(s => { s.classes[i].subclass = e.target.value; }) },
              h('option', { value: '' }, 'Choose a subclass'), subclassGroups(rules.subclasses, c.subclass))) : null,
          rules ? problemSlot(`subclass:${c.class}`) : null,
          state.classes.length > 1 ? h('button', { type: 'button', class: 'b-button b-remove', 'data-key': `remove-${i}`, onclick: () => { set(s => { s.classes.splice(i, 1); }); classList.querySelector('select')?.focus(); } }, `Remove ${c.class || 'this class'}`) : null);
      }));
    }
    // A subclass is chosen from the level the class grants one.
    for (const sel of classList.querySelectorAll('[data-sub]')) {
      const c = state.classes.find(x => x.class === sel.dataset.sub);
      sel.disabled = !(c && c.level >= book.classNamed(c.class).subclassLevel);
    }
    addClass.disabled = result.level >= MAX_LEVEL;
  }

  // The species' one choice and its size, and its traits to read.
  function renderSpecies(result) {
    const species = result.species;
    const opts = speciesOptions(species);
    optionRow.hidden = !opts;
    if (opts) {
      optionLabel.textContent = opts.label;
      if (optionSelect.dataset.for !== species.name) {
        optionSelect.dataset.for = species.name;
        optionSelect.replaceChildren(...options(opts.names, state.option, `Choose a ${opts.label.toLowerCase()}`));
      }
    }
    const sizes = species?.size.match(/\b(Tiny|Small|Medium|Large)\b/g) ?? [];
    sizeRow.hidden = sizes.length < 2;
    if (sizes.length > 1 && sizeSelect.dataset.for !== species.name) {
      sizeSelect.dataset.for = species.name;
      sizeSelect.replaceChildren(...options(sizes, state.size, 'Choose a size'));
    }
    if (speciesTraits.dataset.for !== (species?.name ?? '')) {
      speciesTraits.dataset.for = species?.name ?? '';
      const placed = species && book.placement(species.name);
      rebuild(speciesTraits, ...(species ? [
        placed ? h('p', { class: 'b-note' }, `In Euphonia${placed.status === 'draft' ? ' (a draft)' : ''}: ${placed.line}.`) : null,
        h('details', {}, h('summary', {}, `${species.name}: ${species.creature_type}, ${species.size}, speed ${species.speed}`),
        ...species.traits.map(t => h('div', { html: blocks(`**${t.name}.** ${t.text}`) + (t.options ?? []).map(o => blocks(`**${o.name}.** ${o.text}`)).join('') })))] : []));
    }
  }

  // The background's increases: +2 and +1, or +1 to all three, among its
  // three abilities, in the rule's own numbers.
  function renderBackground(result) {
    const bg = result.background;
    const rule = book.backgroundIncreases;
    const key = bg?.name ?? '';
    if (increases.dataset.for !== key) {
      increases.dataset.for = key;
      if (!bg) { increases.replaceChildren(); backgroundAbout.replaceChildren(); return; }
      const [big, small] = rule.choices[0], all = rule.choices[1][0];
      const values = Object.values(state.increases ?? {}).filter(Boolean);
      const shape = values.length === 3 ? 'all' : 'two';
      const pick = (n, label) => h('label', { class: 'b-field' }, h('span', {}, label),
        h('select', { 'data-by': n, 'data-key': `by-${n}`, onchange: readIncreases }, options(bg.ability_scores, Object.entries(state.increases ?? {}).find(([, v]) => v === n && shape === 'two')?.[0], 'Choose')));
      increases.replaceChildren(
        h('div', { class: 'b-choice', role: 'radiogroup', 'aria-label': 'How the background raises your scores' },
          h('label', {}, h('input', { type: 'radio', name: 'shape', value: 'two', checked: shape === 'two', onchange: readIncreases }), ` +${big} to one, +${small} to another`),
          h('label', {}, h('input', { type: 'radio', name: 'shape', value: 'all', checked: shape === 'all', onchange: readIncreases }), ` +${all} to all three`)),
        h('div', { class: 'b-pair' }, pick(big, `+${big}`), pick(small, `+${small}`)));
      backgroundAbout.replaceChildren(h('dl', { class: 'b-facts' },
        h('dt', {}, 'Feat'), h('dd', {}, bg.feat), h('dt', {}, 'Skills'), h('dd', {}, `${bg.skills.join(' and ')}${bg.skill_choice ? `, and ${bg.skill_choice.from.join(' or ')}` : ''}`),
        h('dt', {}, 'Tool'), h('dd', {}, bg.tool), h('dt', {}, 'Equipment'), h('dd', {}, bg.equipment),
        // The setting's backgrounds each give a Door (somewhere it gets you
        // in) and a Debt (someone who wants something from you).
        bg.door ? [h('dt', {}, 'Door'), h('dd', {}, bg.door)] : null, bg.debt ? [h('dt', {}, 'Debt'), h('dd', {}, bg.debt)] : null),
        bg.about ? h('details', {}, h('summary', {}, 'About this background'), h('div', { html: blocks(bg.about) })) : null);
    }
    const two = increases.querySelector('input[value=two]')?.checked;
    for (const sel of increases.querySelectorAll('[data-by]')) sel.disabled = !two;
  }
  function readIncreases() {
    const bg = book.backgrounds.find(b => b.name === state.background);
    const rule = book.backgroundIncreases;
    set(s => {
      if (increases.querySelector('input[value=all]').checked) s.increases = Object.fromEntries(bg.ability_scores.map(a => [a, rule.choices[1][0]]));
      else {
        s.increases = {};
        for (const sel of increases.querySelectorAll('[data-by]')) if (sel.value) s.increases[sel.value] = (s.increases[sel.value] ?? 0) + Number(sel.dataset.by);
      }
    });
  }

  // The six base scores, by method: the array's scores to place, the costs'
  // scores to buy, or what was rolled.
  function renderScores() {
    const shape = state.method;
    if (scoreGrid.dataset.for !== shape) {
      scoreGrid.dataset.for = shape;
      const costs = [...book.pointCosts.keys()];
      scoreGrid.replaceChildren(...ABILITIES.map(a => h('label', { class: 'b-field' }, h('span', {}, a),
        shape === 'standard'
          ? h('select', { 'data-ability': a, onchange: readScores }, options([...new Set(book.standardArray)].map(String), String(state.base?.[a] ?? ''), '—'))
          : h('input', { 'data-ability': a, type: 'number', inputmode: 'numeric', min: shape === 'point' ? Math.min(...costs) : 3, max: shape === 'point' ? Math.max(...costs) : 18, value: state.base?.[a] ?? '', oninput: readScores }))));
    }
    if (shape === 'point') {
      const spent = ABILITIES.reduce((n, a) => n + (book.pointCosts.get(Number(state.base?.[a])) ?? 0), 0);
      pointsLeft.textContent = `${book.pointBudget - spent} of ${book.pointBudget} points left.`;
    } else pointsLeft.textContent = shape === 'standard' ? `Place ${book.standardArray.join(', ')}, one to each.` : 'Four d6 each, the highest three: 3 to 18.';
  }
  function readScores() {
    set(s => { s.base = Object.fromEntries([...scoreGrid.querySelectorAll('[data-ability]')].map(el => [el.dataset.ability, el.value === '' ? '' : Number(el.value)])); });
  }

  // The skill choices, as the engine lists them.
  // A skill chosen in one choice leaves the others, since proficiency counts
  // once; one the character has without choosing (a background's, a
  // feature's) is marked as theirs already and can't be chosen again.
  function renderSkills(result) {
    const chosenAnywhere = new Set(Object.values(state.skills ?? {}).flat());
    const already = result.skills.filter(sk => sk.proficient && !chosenAnywhere.has(sk.name)).map(sk => sk.name);
    const shape = result.choices.map(c => `${c.key}:${c.count}:${c.upTo}:${c.from.join()}`).join('|') + `|${already.join()}`;
    if (skillsBox.dataset.for === shape) return;
    skillsBox.dataset.for = shape;
    rebuild(skillsBox, ...(result.choices.length ? result.choices.map(c => {
      const picked = state.skills?.[c.key] ?? [];
      const read = e => {
        const skill = e.target.value;
        if (e.target.checked) for (const box of skillsBox.querySelectorAll('input[type=checkbox]')) if (box.value === skill && box !== e.target) box.checked = false;
        set(s => {
          s.skills = Object.fromEntries(Object.entries(s.skills ?? {}).map(([k, v]) => [k, k === c.key || !e.target.checked ? v : v.filter(x => x !== skill)]));
          s.skills[c.key] = [...group.querySelectorAll('input:checked')].map(x => x.value);
        });
      };
      const group = h('fieldset', { class: 'b-skills', 'aria-describedby': idFor(`skills:${c.key}`) },
        h('legend', {}, `${c.label}: ${c.given.length ? `${c.given.join(', ')}, plus ` : ''}choose ${c.upTo ? 'up to ' : ''}${c.count}${c.upTo ? ' (the rest tools)' : ''}`),
        h('div', { class: 'b-checks' }, c.from.map(skill => {
          const yours = already.includes(skill) && !picked.includes(skill);
          return h('label', { class: yours ? 'is-yours' : null }, h('input', { type: 'checkbox', value: skill, 'data-key': `skill-${c.key}-${skill}`, checked: picked.includes(skill), disabled: yours || null, onchange: read }), ` ${skill}`, yours ? h('span', { class: 'b-mark' }, ' (already yours)') : null);
        })),
        problemSlot(`skills:${c.key}`));
      return group;
    }) : [h('p', { class: 'b-note' }, 'Your class and species bring their skill choices here.')]));
  }

  // The options a class's table counts (the Courtier's accomplishments): a
  // choice for each, from those open at its level, grouped by the level that
  // opens them, one taken as often as it allows closed in the rest; the art
  // it counts as where two are left; what it does; what the subclass gives
  // and closes; and the Regard they make.
  const capital = w => w[0].toUpperCase() + w.slice(1);
  // Languages: the vernacular (the rules' Common), the two standard ones and
  // each feature's, named in the player's words, the real tongues suggested;
  // a language a feature names, given. Rebuilt only when the asking changes,
  // so typing keeps its place.
  function renderLanguages(result) {
    const shape = JSON.stringify(result.languageChoices.map(c => [c.key, c.count, c.given]));
    if (languageBox.dataset.for === shape) return;
    languageBox.dataset.for = shape;
    rebuild(languageBox, ...result.languageChoices.map(c => {
      const names = state.languages?.[c.key] ?? [];
      const read = () => set(s => { s.languages = { ...s.languages, [c.key]: [...group.querySelectorAll('input')].map(x => x.value.trim()).filter(Boolean) }; });
      const label = i => (c.key === 'Common' ? 'Your vernacular (Common)' : `${c.given.length ? 'One more language' : 'Language'}${c.count > 1 ? ` ${i + 1}` : ''}`);
      const group = h('fieldset', { class: 'b-language', 'aria-describedby': idFor(`language:${c.key}`) },
        h('legend', {}, c.key === 'Common' ? 'Common: the language of the place that raised you' : c.key === 'standard' ? `Two more: a second vernacular, a trade tongue or a learned one` : c.label),
        c.given.length ? h('p', { class: 'b-note' }, `${listed(c.given)}, given.`) : null,
        Array.from({ length: c.count }, (_, i) => h('label', { class: 'b-field' }, h('span', {}, label(i)),
          h('input', { type: 'text', list: 'b-tongues', autocomplete: 'off', 'data-key': `language-${c.key}-${i}`, value: names[i] ?? '', onchange: read }))),
        problemSlot(`language:${c.key}`));
      return group;
    }));
  }
  // A Revelation a feature teaches (The Near Planes, The Circuit): a radio
  // for each plane it can, its Spirit Aspect, Influence and Planar Strike in
  // a line, its rules a click away; one another choice took can't be taken
  // twice. Once a feature grants every Revelation, the choice is moot.
  const partName = p => p.label.replace(/^(Spirit Aspect|Influence): /, '');
  const revelationLine = r => r.parts.map(p => (p.label === 'Planar Strike' ? `Strike: ${p.text.replace(/ damage\.?$/, '')}` : p.label.includes(':') ? `${p.label.split(':')[0]}: ${partName(p)}` : null)).filter(Boolean).join(' · ');
  const revelationRules = r => h('div', { class: 'b-pick-text', html: blocks(r.parts.map(p => `***${p.label}.*** ${p.text}`).join('\n\n')) });
  function renderRevelations(result) {
    const live = result.revelationChoices.filter(c => !c.moot);
    const shape = JSON.stringify(live.map(c => [c.key, c.chosen, c.options.length]));
    if (revelationBox.dataset.for === shape) return;
    revelationBox.dataset.for = shape;
    rebuild(revelationBox, ...live.map(c => {
      const elsewhere = new Set(live.filter(o => o !== c).map(o => o.chosen).filter(Boolean));
      return h('fieldset', { class: 'b-pick', 'aria-describedby': idFor(`revelation:${c.key}`) },
        h('legend', {}, `${c.label}: a Revelation from ${listed(c.groups)}`),
        c.options.map(r => h('div', { class: 'b-pick-row' },
          h('label', { class: 'b-pick-option' },
            h('input', { type: 'radio', name: `revelation-${c.key}`, value: r.name, 'data-key': `revelation-${c.key}-${r.name}`, checked: c.chosen === r.name || null, disabled: (elsewhere.has(r.name) && c.chosen !== r.name) || null, onchange: () => set(s => { s.revelations = { ...s.revelations, [c.key]: r.name }; }) }),
            h('span', {}, h('strong', {}, r.name), h('span', { class: 'b-pick-text' }, revelationLine(r)))),
          h('details', { class: 'b-pick-rules' }, h('summary', {}, `What ${r.name} gives`), revelationRules(r)))),
        problemSlot(`revelation:${c.key}`));
    }));
  }
  // A feature with a spell table for each of several sets (the Circle of
  // the Land's lands): a radio for each, the spells it brings at this level.
  function renderSpellSets(result) {
    const shape = JSON.stringify(result.spellSetChoices.map(c => [c.key, c.chosen, c.sets]));
    if (spellSetBox.dataset.for === shape) return;
    spellSetBox.dataset.for = shape;
    rebuild(spellSetBox, ...result.spellSetChoices.map(c => h('fieldset', { class: 'b-pick', 'aria-describedby': idFor(`spellset:${c.key}`) },
      h('legend', {}, `${c.label}: your ${c.noun}`),
      c.sets.map(x => h('label', { class: 'b-pick-option' },
        h('input', { type: 'radio', name: `spellset-${c.key}`, value: x.name, 'data-key': `spellset-${c.key}-${x.name}`, checked: c.chosen === x.name || null, onchange: () => set(s => { s.spellSets = { ...s.spellSets, [c.key]: x.name }; }) }),
        h('span', {}, h('strong', {}, x.name), h('span', { class: 'b-pick-text' }, `Always prepared: ${listed(x.spells)}.`)))),
      problemSlot(`spellset:${c.key}`))));
  }
  // A choice of one, as radios, each named: a feature's list (Attuned
  // Energy's damage type, the Danae's Half), a saving throw (Closed Mind).
  const oneOf = (c, field, store, legend, line = () => null) => h('fieldset', { class: 'b-pick', 'aria-describedby': idFor(`${field}:${c.key}`) },
    h('legend', {}, legend),
    c.offered.map(x => h('label', { class: 'b-pick-option' },
      h('input', { type: 'radio', name: `${field}-${c.key}`, value: x, 'data-key': `${field}-${c.key}-${x}`, checked: c.chosen === x || null, onchange: () => set(s => { s[store] = { ...s[store], [c.key]: x }; }) }),
      h('span', {}, h('strong', {}, x), line(x) ? h('span', { class: 'b-pick-text' }, line(x)) : null))),
    problemSlot(`${field}:${c.key}`));
  const fresh = (box, shape) => { if (box.dataset.for === shape) return false; box.dataset.for = shape; return true; };
  function renderKinds(result) {
    if (!fresh(kindBox, JSON.stringify(result.kindChoices))) return;
    rebuild(kindBox, ...result.kindChoices.map(c => oneOf(c, 'kind', 'kinds', `${c.label}: your ${c.noun}`)));
  }
  function renderSaves(result) {
    if (!fresh(saveBox, JSON.stringify(result.saveChoices))) return;
    rebuild(saveBox, ...result.saveChoices.map(c => oneOf(c, 'save', 'saves', `${c.label}: a saving throw, as you already have the one it names`)));
  }
  // A weapon of the player's choice, and the known cantrip an option
  // improves: a select each.
  function renderWeapons(result) {
    if (!fresh(weaponBox, JSON.stringify(result.weaponChoices.map(c => [c.key, c.chosen])))) return;
    rebuild(weaponBox, ...result.weaponChoices.map(c => [
      h('label', { class: 'b-field' }, h('span', {}, `${c.label}: a ${c.category} weapon`),
        h('select', { 'data-key': `weapon-${c.key}`, 'aria-describedby': idFor(`weapon:${c.key}`), onchange: e => set(s => { s.weapons = { ...s.weapons, [c.key]: e.target.value }; }) }, options(c.from.map(w => w.name), c.chosen, 'Choose a weapon'))),
      problemSlot(`weapon:${c.key}`)]).flat());
  }
  function renderTargets(result) {
    if (!fresh(targetBox, JSON.stringify(result.cantripTargets))) return;
    rebuild(targetBox, ...result.cantripTargets.map(c => [
      h('label', { class: 'b-field' }, h('span', {}, `${c.label}: the cantrip it improves${c.condition ? ` (one that ${c.condition})` : ''}`),
        h('select', { 'data-key': `cantrip-${c.key}`, 'aria-describedby': idFor(`cantrip:${c.key}`), onchange: e => set(s => { s.cantripTargets = { ...s.cantripTargets, [c.key]: e.target.value }; }) }, options(c.from, c.chosen, c.from.length ? 'Choose a cantrip' : 'Choose your cantrips first'))),
      problemSlot(`cantrip:${c.key}`)]).flat());
  }
  // An optional rule, where the DM allows it (The Monster Within): taken or
  // not, then each Rite reached and, at its level, the Final Rite; what the
  // record brings, said beneath.
  function renderRules(result) {
    if (!fresh(ruleBox, JSON.stringify(result.optionalRules))) return;
    const keep = (key, change) => set(s => { const was = s.optional?.[key] ?? {}; s.optional = { ...s.optional, [key]: change(was) }; });
    rebuild(ruleBox, ...result.optionalRules.map(r => h('fieldset', { class: 'b-pick' },
      h('legend', {}, `${r.name}, an optional rule (${r.class} ${r.at})`),
      h('div', { class: 'b-pick-text', html: blocks(r.lead) }),
      h('label', { class: 'b-check' }, h('input', { type: 'checkbox', 'data-key': `rule-${r.key}`, checked: r.taken || null, onchange: e => keep(r.key, was => ({ ...was, taken: e.target.checked })) }), ` Take ${r.name} (the DM turns it on)`),
      r.taken ? r.rites.map(rite => h('label', { class: 'b-field' }, h('span', {}, `The Rite at level ${rite.level}`),
        h('select', { 'data-key': `rite-${r.key}-${rite.level}`, 'aria-describedby': idFor(`optional:${r.key} ${rite.level}`), onchange: e => keep(r.key, was => ({ ...was, rites: { ...was.rites, [rite.level]: e.target.value } })) },
          options(rite.level === r.at ? ['passed', 'failed'] : ['passed', 'failed', 'declined'], rite.outcome, 'How did it go?')))) : null,
      r.taken ? r.rites.map(rite => problemSlot(`optional:${r.key} ${rite.level}`)) : null,
      r.final ? [h('label', { class: 'b-field' }, h('span', {}, `The Final Rite (level ${r.final.level})`),
        h('select', { 'data-key': `rite-${r.key}-final`, 'aria-describedby': idFor(`optional:${r.key} final`), onchange: e => keep(r.key, was => ({ ...was, final: e.target.value })) }, options(r.final.offered, r.final.chosen, 'Resign, or the outcome rolled'))), problemSlot(`optional:${r.key} final`)] : null,
      r.taken ? h('p', { class: 'b-note' }, `${r.boons.length ? `Ascendance: ${r.boons.length} of ${r.ascendance.length} boons. ` : ''}${r.carries ? `You carry the Monster${r.growth.length ? `, grown ${r.growth.length} of ${r.overgrowth.length} times` : ''}.` : 'You don’t carry the Monster.'}`) : null)));
  }
  // Wild Shape's known forms, by Challenge Rating; the Revelation a first
  // voyage walked; a name for each someone or somewhere a feature has the
  // player choose.
  const crText = cr => (cr < 1 && cr > 0 ? `1/${Math.round(1 / cr)}` : String(cr));
  function renderForms(result) {
    if (!fresh(formBox, JSON.stringify(result.formChoices.map(c => [c.key, c.count, c.cr, c.fly, c.chosen])))) return;
    rebuild(formBox, ...result.formChoices.map(c => {
      const read = () => set(s => { s.forms = { ...s.forms, [c.key]: [...box.querySelectorAll('input:checked')].map(x => x.value) }; });
      const crs = [...new Set(c.from.map(b => b.challenge))].sort((a, b) => a - b);
      const box = h('fieldset', { class: 'b-spell-choice', 'aria-describedby': idFor(`forms:${c.key}`) },
        h('legend', {}, `${c.label}: ${c.chosen.length} of ${c.count} Beast forms, up to Challenge Rating ${crText(c.cr)}${c.fly ? '' : ', none that flies'}`),
        crs.map(cr => h('details', {}, h('summary', {}, `Challenge Rating ${crText(cr)}`),
          h('div', { class: 'b-checks' }, c.from.filter(b => b.challenge === cr).map(b => h('label', {}, h('input', { type: 'checkbox', value: b.name, 'data-key': `form-${c.key}-${b.name}`, checked: c.chosen.includes(b.name), onchange: read }), ` ${b.name}`, h('span', { class: 'b-mark' }, ` ${b.size}, ${b.speed}`)))))),
        problemSlot(`forms:${c.key}`));
      return box;
    }));
  }
  // An Attunement's set, each place its own spell or another of its level
  // that deals the attuned type.
  function renderSwaps(result) {
    if (!fresh(swapBox, JSON.stringify(result.swapChoices))) return;
    rebuild(swapBox, ...(result.swapChoices.length ? [h('fieldset', { class: 'b-pick' },
      h('legend', {}, `${result.swapChoices[0].label.split(':')[0]}: your set, each spell its own or another that deals your damage type`),
      result.swapChoices.map(c => h('label', { class: 'b-field' }, h('span', {}, capital(c.label.split(': ')[1])),
        h('select', { 'data-key': `swap-${c.key}`, onchange: e => set(s => { s.swaps = { ...s.swaps, [c.key]: e.target.value }; }) },
          c.offered.map(n => h('option', { value: n, selected: n === c.chosen || null }, n === c.own ? `${n} (the set's)` : n))))))] : []));
  }
  function renderWalked(result) {
    if (!fresh(walkedBox, JSON.stringify(result.walkedChoices))) return;
    rebuild(walkedBox, ...result.walkedChoices.map(c => oneOf(c, 'walked', 'walked', `${c.label}: the Revelation your first voyage walked`)));
  }
  function renderNotes(result) {
    if (!fresh(noteBox, JSON.stringify(result.noteChoices.map(c => [c.key, c.what])))) return;
    rebuild(noteBox, ...result.noteChoices.map(c => [
      h('label', { class: 'b-field' }, h('span', {}, `${c.label}: your ${c.what}`),
        h('input', { type: 'text', 'data-key': `note-${c.key}`, value: c.named, autocomplete: 'off', 'aria-describedby': idFor(`note:${c.key}`), onchange: e => set(s => { s.notes = { ...s.notes, [c.key]: e.target.value }; }) })),
      problemSlot(`note:${c.key}`)]).flat());
  }
  // Tools: those given, a choice of so many from a list or a kind, and
  // Expertise with tools; a tool taken in one choice leaves the others.
  function renderTools(result) {
    const given = result.tools.filter(t => !result.toolChoices.some(c => c.chosen.includes(t.name))).map(t => t.name);
    if (!fresh(toolsBox, JSON.stringify([result.toolChoices.map(c => [c.key, c.count, c.from, c.chosen]), result.toolExpertise.map(c => [c.key, c.from, c.chosen]), result.tools]))) return;
    // A tool the character has from anywhere else can't be taken again: its
    // box is disabled and says so. Expertise is with tools already had.
    const elsewhere = (c, t) => result.tools.some(x => x.name === t && x.from.some(src => src !== c.label));
    const checks = (c, store, legend, field, owned = true) => {
      const read = () => set(s => { s[store] = { ...s[store], [c.key]: [...group.querySelectorAll('input:checked')].map(x => x.value) }; });
      const group = h('fieldset', { class: 'b-skills', 'aria-describedby': idFor(`${field}:${c.key}`) }, h('legend', {}, legend),
        h('div', { class: 'b-checks' }, c.from.map(t => {
          const yours = owned && elsewhere(c, t) && !c.chosen.includes(t);
          return h('label', { class: yours ? 'is-yours' : null }, h('input', { type: 'checkbox', value: t, 'data-key': `tool-${c.key}-${t}`, checked: c.chosen.includes(t), disabled: yours || null, onchange: read }), ` ${t}`, yours ? h('span', { class: 'b-mark' }, ' (already yours)') : null);
        })),
        problemSlot(`${field}:${c.key}`));
      return group;
    };
    rebuild(toolsBox,
      given.length ? h('p', { class: 'b-note' }, `Yours already: ${listed(given)}.`) : null,
      ...result.toolChoices.map(c => checks(c, 'tools', `${c.label}: choose ${c.count}`, 'tools')),
      ...result.toolExpertise.map(c => checks(c, 'tools', `${c.label}: Expertise with ${c.count}${c.skill ? `, ${c.skill} among them if you like` : ''}`, 'tools', false)),
      !given.length && !result.toolChoices.length ? h('p', { class: 'b-note' }, 'Your class, background and features bring their tools here.') : null);
  }
  // A feature's one-of choice (Divine Order, Elemental Fury): a radio for
  // each option, its rule under its name.
  function renderPicks(result) {
    const shape = JSON.stringify(result.pickChoices.map(c => [c.key, c.chosen]));
    if (pickBox.dataset.for === shape) return;
    pickBox.dataset.for = shape;
    rebuild(pickBox, ...result.pickChoices.map(c => h('fieldset', { class: 'b-pick', 'aria-describedby': idFor(`pick:${c.key}`) },
      h('legend', {}, c.label),
      c.offered.map(x => h('label', { class: 'b-pick-option' },
        h('input', { type: 'radio', name: `pick-${c.key}`, value: x.name, 'data-key': `pick-${c.key}-${x.name}`, checked: c.chosen === x.name || null, onchange: () => set(s => { s.picks = { ...s.picks, [c.key]: x.name }; }) }),
        h('span', {}, h('strong', {}, x.name), h('span', { class: 'b-pick-text', html: inline(x.text) })))),
      problemSlot(`pick:${c.key}`))));
  }
  // Weapon Mastery: the kinds the feature allows, grouped as the Weapons
  // table groups them, each with its mastery property, the rest set aside
  // once the count is reached.
  function renderMastery(result) {
    const shape = JSON.stringify(result.masteryChoices.map(c => [c.key, c.count, c.from.map(w => w.name), state.mastery?.[c.key]]));
    if (masteryBox.dataset.for === shape) return;
    masteryBox.dataset.for = shape;
    rebuild(masteryBox, ...result.masteryChoices.map(c => {
      const picked = state.mastery?.[c.key] ?? [], full = picked.length >= c.count;
      const groups = [...new Set(c.from.map(w => `${w.category} ${w.range}`))];
      const read = () => set(s => { s.mastery = { ...s.mastery, [c.key]: [...box.querySelectorAll('input:checked')].map(x => x.value) }; });
      const box = h('fieldset', { class: 'b-weapons', 'aria-describedby': idFor(`mastery:${c.key}`) },
        h('legend', {}, `${c.label}: ${picked.length} of ${c.count} kinds of weapon`),
        groups.map(g => [h('p', { class: 'b-group' }, `${g} weapons`),
          h('div', { class: 'b-checks' }, c.from.filter(w => `${w.category} ${w.range}` === g).map(w => h('label', {},
            h('input', { type: 'checkbox', value: w.name, 'data-key': `mastery-${c.key}-${w.name}`, checked: picked.includes(w.name) || null, disabled: (full && !picked.includes(w.name)) || null, onchange: read }),
            ` ${w.name}`, h('span', { class: 'b-mark' }, ` ${w.mastery}`))))]),
        problemSlot(`mastery:${c.key}`));
      return box;
    }));
  }
  function renderOptions(result) {
    const shape = JSON.stringify([result.optionChoices.map(o => [o.class, o.count, o.extra, o.forgone, o.open.map(x => x.name), o.given.map(g => g.name), o.regard]), state.options, state.optionArts]);
    if (optionBox.dataset.for === shape) return;
    optionBox.dataset.for = shape;
    const artPick = (label, arts, chosen, key, onchange) => h('label', { class: 'b-field b-art' }, h('span', {}, label),
      h('select', { 'data-key': key, onchange: e => onchange(e.target.value) }, options(arts, chosen, 'Choose an art')));
    const about = (x, key) => h('details', { class: 'b-about', 'data-key': key, open: openLevels.has(key) || null, ontoggle: e => (e.target.open ? openLevels.add(key) : openLevels.delete(key)) },
      h('summary', {}, 'What it does'), h('div', { html: blocks([x.prerequisite && `*Prerequisite: ${x.prerequisite}.*`, x.cost && `*Cost: ${x.cost}.*`, x.text].filter(Boolean).join('\n\n')) }));
    rebuild(optionBox, ...result.optionChoices.map(o => {
      const picks = state.options?.[o.class] ?? [];
      const artsOf = x => x.arts.filter(a => a !== o.forgone);
      const regard = [...new Set([...o.given, ...o.taken].map(t => t.art).filter(Boolean))];
      const levels = [...new Set(o.open.map(x => x.level))];
      const setPick = (i, change) => set(s => { const list = [...(s.options?.[o.class] ?? [])]; list[i] = change(list[i] ?? {}); s.options = { ...s.options, [o.class]: list }; });
      return h('fieldset', { class: 'b-option-class' },
        h('legend', {}, `${capital(o.noun)}s (${o.class})`),
        h('p', { class: 'b-note' }, `${o.count} at level ${result.classes.find(c => c.class === o.class)?.level}.${o.arts.length ? ` Your Regard is ${regard.length}${regard.length ? ` (${listed(regard)})` : ''}.` : ''}${o.forgone ? ` ${o.subclass} forgoes ${o.forgone}: nothing counts as it.` : ''}`),
        o.given.map(g => h('div', { class: 'b-option' },
          h('p', { class: 'b-given' }, `${g.name}, given by ${g.from}`),
          artsOf(g).length > 1 ? artPick(`${g.name} counts as`, artsOf(g), state.optionArts?.[`${o.class} ${g.name}`], `option-art-${o.class}-${g.name}`, v => set(s => { s.optionArts = { ...s.optionArts, [`${o.class} ${g.name}`]: v }; })) : null,
          about(g, `option-about-${o.class}-${g.name}`), problemSlot(g.field))),
        // After the column's, one more of an art a subclass gives instead of
        // one already taken ("one more accomplishment from the art of Arms").
        Array.from({ length: o.count + o.extra.length }, (_, i) => {
          const pick = picks[i], instead = i >= o.count ? o.extra[i - o.count] : null;
          const x = o.open.find(y => y.name === pick?.name);
          const elsewhere = name => [...o.given.map(g => g.name), ...picks.filter((p, j) => j !== i && j < o.count + o.extra.length).map(p => p?.name)].filter(n => n === name).length;
          const select = h('select', { 'data-key': `option-${o.class}-${i}`, 'aria-describedby': idFor(`option:${o.class}:${i}`), onchange: e => setPick(i, () => ({ name: e.target.value })) },
            h('option', { value: '' }, `Choose ${/^[aeiou]/i.test(o.noun) ? 'an' : 'a'} ${o.noun}`),
            levels.map(lv => h('optgroup', { label: `From ${o.class} level ${lv}` }, o.open.filter(y => y.level === lv && (!instead || artsOf(y).includes(instead.art))).map(y => h('option', { value: y.name, selected: y.name === pick?.name || null, disabled: (y.name !== pick?.name && elsewhere(y.name) >= y.repeat) || null },
              `${y.name}${y.arts.length ? ` (${artsOf(y).join(', ')})` : y.cost ? ` (${y.cost})` : y.requires?.length ? ` (needs ${listed(y.requires)})` : ''}`)))));
          return h('div', { class: 'b-option' },
            h('div', { class: 'b-option-row' },
              h('label', { class: 'b-field' }, h('span', {}, instead ? `One more ${o.noun} of ${instead.art} (${instead.from})` : `${capital(o.noun)} ${i + 1}`), select),
              x && !instead && artsOf(x).length > 1 ? artPick('Counts as', artsOf(x), pick.art, `option-art-${o.class}-${i}`, v => setPick(i, p => ({ ...p, art: v }))) : null),
            x ? about(x, `option-about-${o.class}-${i}`) : null,
            problemSlot(`option:${o.class}:${i}`));
        }));
    }));
  }

  // The feats each improvement level brings, and how a feat raises scores.
  function renderFeats(result) {
    // Which feats qualify turns on the level and the scores, and which
    // pickers show on the shape of increase chosen, so they're part of the
    // shape.
    const shape = [result.level, ...ABILITIES.map(a => result.scores[a]), ...result.improvements.map(i => `${i.key}:${state.improvements?.[i.key]?.feat ?? ''}:${state.improvements?.[i.key]?.shape ?? ''}`)].join('|');
    if (featsBox.dataset.for === shape) return;
    featsBox.dataset.for = shape;
    const background = result.feats.find(f => f.from === result.background?.name);
    rebuild(featsBox,
      background ? h('p', { class: 'b-note' }, `${background.feat.name}${background.note ? ` (${background.note})` : ''}, from your background.`) : null,
      ...(result.improvements.length ? result.improvements.map(imp => {
        const pick = state.improvements?.[imp.key] ?? {};
        const feat = book.feats.find(f => f.name === pick.feat);
        const inc = feat && featIncrease(feat);
        const eligible = featsAllowed(book, imp.kind);
        const write = mutate => set(s => { s.improvements = { ...s.improvements, [imp.key]: mutate({ ...(s.improvements?.[imp.key] ?? {}) }) }; });
        // The shape chosen (one score by 2, or two by 1), and the scores
        // its pickers name; a feat with one shape needs no choosing.
        // A character saved before the shape was kept implies it by how many
        // scores it raised.
        const implied = inc?.shapes.findIndex(sh => sh.length === Object.values(pick.increases ?? {}).filter(Boolean).length);
        const shapeNow = inc && (inc.shapes.length === 1 ? 0 : pick.shape ?? (implied >= 0 ? implied : null));
        const readInc = () => write(p => {
          p.increases = {};
          for (const sel of box.querySelectorAll('[data-by]')) if (sel.value) p.increases[sel.value] = (p.increases[sel.value] ?? 0) + Number(sel.dataset.by);
          return p;
        });
        const readShape = e => write(p => ({ ...p, shape: Number(e.target.value), increases: {} }));
        const shapeWords = shape => (shape.every(v => v === shape[0]) ? `+${shape[0]} to ${shape.length === 1 ? 'one score' : `${['', 'one', 'two', 'three'][shape.length]} scores`}` : shape.map(v => `+${v}`).join(' and '));
        // The scores picked so far, in picker order; one picked in a picker
        // can't be picked in the other.
        const taken = Object.entries(pick.increases ?? {}).filter(([, v]) => v).map(([a]) => a);
        const pickers = shapeNow === null || !inc ? null : h('div', { class: 'b-pair' }, inc.shapes[shapeNow].map((by, j) => {
          const mine = taken[j] ?? '';
          return h('label', { class: 'b-field' }, h('span', {}, `${j ? 'and ' : ''}+${by} to`),
            h('select', { 'data-by': by, 'data-key': `inc-${imp.key}-${shapeNow}-${j}`, onchange: readInc },
              options(inc.from.map(a => ({ value: a, label: a, disabled: a !== mine && taken.includes(a) })), mine, 'Choose a score')));
        }));
        const box = h('fieldset', { class: 'b-feat', 'aria-describedby': idFor(`improvement:${imp.key}`) },
          h('legend', {}, `${imp.class} level ${imp.level}: ${imp.kind}`),
          h('label', { class: 'b-field' }, h('span', {}, 'Feat'),
            h('select', { 'data-key': `feat-${imp.key}`, onchange: e => write(() => ({ feat: e.target.value, increases: {} })) },
              options(eligible.map(f => {
                const ok = qualifies(book, f, { level: result.level, scores: result.scores, features: result.features });
                return { value: f.name, label: ok.ok ? f.name : `${f.name} (needs ${ok.why.join(' and ')})`, disabled: !ok.ok && f.name !== pick.feat };
              }), pick.feat, 'Choose a feat'))),
          inc && inc.shapes.length > 1 ? h('div', { class: 'b-choice', role: 'radiogroup', 'aria-label': `How ${feat.name} raises your scores` },
            inc.shapes.map((shape, k) => h('label', {}, h('input', { type: 'radio', name: `inc-shape-${imp.key}`, 'data-key': `shape-${imp.key}-${k}`, value: String(k), checked: shapeNow === k, onchange: readShape }), ` ${shapeWords(shape)}`))) : null,
          pickers,
          problemSlot(`improvement:${imp.key}`));
        return box;
      }) : [h('p', { class: 'b-note' }, 'Ability Score Improvements and the Epic Boon come with levels; choose their feats here.')]));
  }

  // An Origin feat a trait grants (the Human's Versatile).
  // An Origin feat a species' trait grants, with the species; one a class
  // feature grants (Lessons of the First Ones), with the feats.
  function renderOrigin(result) {
    for (const [box, source] of [[originBox, 'species'], [featureOriginBox, 'feature']]) renderOriginIn(box, result.originChoices.filter(c => c.source === source));
  }
  function renderOriginIn(box, choices) {
    const shape = choices.map(c => c.key).join('|');
    if (box.dataset.for === shape) return;
    box.dataset.for = shape;
    const origin = book.feats.filter(f => f.category === 'Origin').map(f => f.name);
    rebuild(box, ...choices.map(c => [
      h('label', { class: 'b-field' }, h('span', {}, `${c.label}: an Origin feat`),
        h('select', { 'data-key': `origin-${c.key}`, 'aria-describedby': idFor(`origin:${c.key}`), onchange: e => set(s => { s.originFeats = { ...s.originFeats, [c.key]: e.target.value }; }) },
          options(origin, state.originFeats?.[c.key], 'Choose a feat'))),
      problemSlot(`origin:${c.key}`),
    ]).flat());
  }

  // The homeland, a link to its chapter on the map, and where the character
  // buys: the homeland's place unless another is chosen.
  function renderHomeland(result) {
    const region = places.regions.find(r => r.name === state.homeland);
    homelandSelect.value = region ? region.name : '';
    homelandLink.replaceChildren(...(region ? [h('a', { href: `#${region.id}` }, `Read ${region.name}`), ' on the map.'] : []));
    const { place, chosen } = result.equipment.buying;
    marketSelect.value = chosen ? state.market : '';
    marketSelect.options[0].textContent = !chosen && place ? `At home: ${place}` : 'Choose a place';
  }

  // The Fighting Style feats features grant, and the Expertise they ask.
  function renderStyles(result) {
    const shape = result.styleChoices.map(c => `${c.key}:${state.styles?.[c.key] ?? ''}`).join('|');
    if (styleBox.dataset.for === shape) return;
    styleBox.dataset.for = shape;
    const styles = book.feats.filter(f => f.category === 'Fighting Style').map(f => f.name);
    rebuild(styleBox, ...result.styleChoices.map(c => [
      h('label', { class: 'b-field' }, h('span', {}, `${c.label}: a Fighting Style feat${c.instead.length ? ` or ${listed(c.instead.map(x => x.name), 'or')}` : ''}`),
        h('select', { 'data-key': `style-${c.key}`, 'aria-describedby': idFor(`style:${c.key}`), onchange: e => set(s => { s.styles = { ...s.styles, [c.key]: e.target.value }; }) },
          c.instead.length ? [h('option', { value: '' }, 'Choose a feat or the option'), h('optgroup', { label: 'Fighting Style feats' }, options(styles, state.styles?.[c.key])), h('optgroup', { label: 'Instead of a feat' }, options(c.instead.map(x => x.name), state.styles?.[c.key]))]
            : options(styles, state.styles?.[c.key], 'Choose a feat'))),
      problemSlot(`style:${c.key}`),
    ]).flat());
  }
  function renderExpertise(result) {
    const shape = result.expertiseChoices.map(c => `${c.key}:${c.count}:${c.from.join()}`).join('|');
    if (expertiseBox.dataset.for === shape) return;
    expertiseBox.dataset.for = shape;
    rebuild(expertiseBox, ...result.expertiseChoices.map(c => {
      const picked = state.expertise?.[c.key] ?? [];
      const read = () => set(s => { s.expertise = { ...s.expertise, [c.key]: [...group.querySelectorAll('input:checked')].map(x => x.value) }; });
      const group = h('fieldset', { class: 'b-skills', 'aria-describedby': idFor(`expertise:${c.key}`) },
        h('legend', {}, `${c.label}: Expertise in ${c.count}`),
        c.from.length ? h('div', { class: 'b-checks' }, c.from.map(skill => h('label', {}, h('input', { type: 'checkbox', value: skill, 'data-key': `expertise-${c.key}-${skill}`, checked: picked.includes(skill), onchange: read }), ` ${skill}`)))
          : h('p', { class: 'b-note' }, 'Choose skills first: Expertise is in skills you’re proficient in.'),
        problemSlot(`expertise:${c.key}`));
      return group;
    }));
  }

  // The spells: each caster's and each feat's, by level, as the engine
  // bounds them; a feat's list where the player chooses it.
  const openLevels = new Set();
  function renderSpells(result) {
    const shape = [JSON.stringify(result.spellbooks.map(b => [b.key, b.free, b.offered.length, b.chosen.map(sp => sp.name), b.granted.map(sp => sp.name), b.extra.map(x => [x.key, x.count, x.chosen.map(sp => sp.name)])])), ...result.listChoices.map(l => `${l.from}:${l.chosen}`), ...result.spellChoices.map(c => `${c.key}:${c.cantrips}:${c.prepared}:${c.highest}:${c.chosen.map(sp => sp.name).join()}:${c.always.map(sp => sp.name).join()}:${c.given.map(sp => sp.name).join()}:${c.list.map(sp => sp.name).join()}`)].join('|');
    if (spellsBox.dataset.for === shape) return;
    spellsBox.dataset.for = shape;
    for (const d of spellsBox.querySelectorAll('details[data-key]')) if (d.open) openLevels.add(d.dataset.key); else openLevels.delete(d.dataset.key);
    const lists = result.listChoices.map(l => [
      h('label', { class: 'b-field' }, h('span', {}, `${l.feat}, from ${l.from}: its spell list`),
        h('select', { 'data-key': `list-${l.from}`, 'aria-describedby': idFor(l.field), onchange: e => set(s => { s.featLists = { ...s.featLists, [l.from]: e.target.value }; }) }, options(l.lists, l.chosen, 'Choose a list'))),
      result.spellChoices.some(c => c.key === l.field.replace(/^spells:/, '')) ? null : problemSlot(l.field),
    ]).flat();
    // A spellbook: the spells written in by choice, a level at a time, what
    // features wrote in, and any a feature adds free of a school.
    const byLevel = (key, offered, picked, read) => [...new Set(offered.map(sp => sp.level))].sort((a, b) => a - b).map(level => {
      const k = `${key}-${level}`, here = offered.filter(sp => sp.level === level), n = here.filter(sp => picked.has(sp.name)).length;
      return h('details', { 'data-key': k, open: openLevels.has(k) || null }, h('summary', {}, `Level ${level}${n ? `: ${n} written` : ''}`),
        h('div', { class: 'b-checks' }, here.map(sp => h('label', {}, h('input', { type: 'checkbox', value: sp.name, 'data-key': `book-${key}-${sp.name}`, checked: picked.has(sp.name), onchange: read }), ` ${sp.name}`))));
    });
    const books = result.spellbooks.flatMap(b => {
      const write = (key, box) => () => set(s => { s.spellbooks = { ...s.spellbooks, [key]: [...box.querySelectorAll('input:checked')].map(x => x.value) }; });
      const main = h('fieldset', { class: 'b-spell-choice', 'aria-describedby': idFor(`spells:${b.key}`) },
        h('legend', {}, `${b.class}'s spellbook: ${b.chosen.length} of ${b.free} spells of your choice, the first ${b.start} of level 1`),
        b.granted.length ? h('p', { class: 'b-note' }, `Written in by features: ${listed([...new Set(b.granted.map(sp => `${sp.name} (${sp.from})`))])}.`) : null);
      main.append(...byLevel(b.key, b.offered, new Set(b.chosen.map(sp => sp.name)), write(b.class, main)), problemSlot(`spells:${b.key}`));
      const extra = b.extra.map(x => {
        const box = h('fieldset', { class: 'b-spell-choice', 'aria-describedby': idFor(`spells:${x.key}`) }, h('legend', {}, `${x.label}: ${x.chosen.length} of ${x.count} free`));
        box.append(...byLevel(x.key, x.from, new Set(x.chosen.map(sp => sp.name)), write(x.key, box)), problemSlot(`spells:${x.key}`));
        return box;
      });
      return [main, ...extra];
    });
    const groups = result.spellChoices.map(c => {
      const picked = new Set(c.chosen.map(sp => sp.name));
      const read = () => set(s => { s.spells = { ...s.spells, [c.key]: [...box.querySelectorAll('input:checked')].map(x => x.value) }; });
      const levels = [...new Set(c.list.map(sp => sp.level))].sort((a, b) => a - b);
      const count = level => c.chosen.filter(sp => (level ? sp.level > 0 : sp.level === 0)).length;
      const box = h('fieldset', { class: 'b-spell-choice', 'aria-describedby': idFor(`spells:${c.key}`) },
        h('legend', {}, c.mixed ? `${c.label}: ${c.chosen.length} of ${c.prepared}, cantrips or spells up to level ${c.highest}, ${c.verb}` : `${c.label}: ${c.cantrips ? `${count(0)} of ${c.cantrips} ${c.cantrips === 1 ? 'cantrip' : 'cantrips'}, ` : ''}${count(1)} of ${c.prepared} ${c.verb} ${c.prepared === 1 ? 'spell' : 'spells'}, up to level ${c.highest}`),
        c.given.length ? h('p', { class: 'b-note' }, `Always known: ${listed(c.given.map(sp => sp.name))}.`) : null,
        c.always.length ? h('p', { class: 'b-note' }, `Always prepared, besides these: ${[...new Set(c.always.map(sp => sp.from))].map(from => `${listed(c.always.filter(sp => sp.from === from).map(sp => sp.name))} (${from})`).join('; ')}.`) : null,
        levels.map(level => {
          const key = `${c.key}-${level}`;
          const here = c.list.filter(sp => sp.level === level);
          const chosenHere = here.filter(sp => picked.has(sp.name)).length;
          return h('details', { 'data-key': key, open: openLevels.has(key) || null },
            h('summary', {}, `${level ? `Level ${level}` : 'Cantrips'}${chosenHere ? `: ${chosenHere} chosen` : ''}`),
            h('div', { class: 'b-checks' }, here.map(sp => h('label', {}, h('input', { type: 'checkbox', value: sp.name, 'data-key': `spell-${c.key}-${sp.name}`, checked: picked.has(sp.name), onchange: read }),
              ` ${sp.name}`, sp.special && !/^[—–]$/.test(sp.special) ? h('span', { class: 'b-mark' }, ` ${sp.special}`) : null))));
        }),
        problemSlot(`spells:${c.key}`));
      return box;
    });
    rebuild(spellsBox, ...(lists.length || groups.length || books.length ? [...books, ...lists, ...groups] : [h('p', { class: 'b-note' }, 'Your spellcasting classes and feats bring their spells here.')]));
  }

  // The problems, each beside the choice it belongs to; the notes, beside
  // theirs.
  function renderProblems(result) {
    const by = list => {
      const out = new Map();
      for (const p of list) out.set(idFor(p.field), [...(out.get(idFor(p.field)) ?? []), p.message]);
      return out;
    };
    const problems = by(result.problems);
    for (const slot of form.querySelectorAll('.b-problem')) {
      const messages = problems.get(slot.id) ?? [];
      slot.textContent = messages.join(' ');
      slot.hidden = !messages.length;
    }
    skillNotes.replaceChildren(...result.notes.map(n => h('li', {}, n.message)));
  }

  // ---------- the sheet
  // What the export changed from the SRD, as the licence asks it be said:
  // the names it renamed, each once (Conjure Fae is renamed in the Druid's
  // list and in the spells), and how many passages besides.
  const renames = srd.adapted.changes.filter(c => c.path.endsWith('/name'));
  const renamed = [...new Set(renames.map(c => c.to))];
  const passages = srd.adapted.changes.length - renames.length;
  const adaptedNote = srd.adapted.changes.length ? `Adapted to the setting's names${renamed.length ? `: ${renamed.join(', ')}` : ''}${passages ? `, and ${passages} passage${passages === 1 ? '' : 's'}` : ''}.` : '';
  const open = new Set();
  function renderSheet(result) {
    for (const d of sheet.querySelectorAll('details[data-key]')) if (d.open) open.add(d.dataset.key); else open.delete(d.dataset.key);
    const det = (key, summary, ...body) => h('details', { 'data-key': key, open: open.has(key) }, h('summary', {}, summary), ...body);
    const gear = result.equipment;
    const classLine = result.classes.map(c => `${c.class} ${c.level}${c.subclass ? ` (${c.subclass})` : ''}`).join(' / ');
    const homeland = places.regions.find(r => r.name === state.homeland);
    const placed = result.species && book.placement(result.species.name);
    const who = [result.species && `${result.species.name}${result.option ? ` (${result.option})` : ''}`, homeland && `of ${homeland.name}`, result.background?.name, classLine].filter(Boolean).join(' · ');
    // Spellcasting: the slots and what each class prepares, then the spells
    // chosen, a caster's and a feat's alike.
    const casting = result.spellcasting.length ? [
      result.slots.some(Boolean) ? h('table', { class: 'sheet-slots' }, h('caption', {}, result.casterLevel ? `Spell slots, as a level ${result.casterLevel} multiclass spellcaster` : 'Spell slots'),
        h('thead', {}, h('tr', {}, h('th', { scope: 'row' }, 'Level'), result.slots.map((n, i) => (n ? h('th', { scope: 'col' }, String(i + 1)) : null)))),
        h('tbody', {}, h('tr', {}, h('th', { scope: 'row' }, 'Slots'), result.slots.map(n => (n ? h('td', {}, String(n)) : null))))) : null,
      result.pacts.map(p => h('p', {}, `Pact Magic (${p.class}): ${p.slots} slot${p.slots === 1 ? '' : 's'} of level ${p.level}.`)),
      h('ul', {}, result.spellcasting.map(s => h('li', {}, `${s.class}: ${s.cantrips ? `${s.cantrips} cantrips${s.given.length ? ` and ${s.given.length} always known` : ''}, ` : ''}${s.prepared} ${s.verb} spells, up to level ${s.highest}.`)))] : [];
    const chosenSpells = result.spellChoices.filter(c => c.chosen.length || c.given.length || c.always.length).map(c => h('div', { class: 'sheet-spell-list' },
      h('h4', {}, c.label),
      h('ul', {}, [...c.given.map(sp => ({ ...sp, kept: 'always known' })), ...c.always.map(sp => ({ ...sp, kept: `always prepared, from ${sp.from}` })), ...c.chosen].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)).map(sp => h('li', {},
        `${sp.level ? `Level ${sp.level}` : 'Cantrip'}: ${sp.name}${sp.school ? `, ${sp.school}` : ''}${sp.special && !/^[—–]$/.test(sp.special) ? ` (${sp.special})` : ''}${sp.kept ? `, ${sp.kept}` : ''}`)))));
    rebuild(sheet,
      h('header', { class: 'sheet-head' },
        h('h2', { id: 'sheet-title' }, state.name.trim() || 'Your character'),
        h('p', {}, who || 'Choose a class, a species and a background.'),
        h('p', { class: 'sheet-level' }, `Level ${result.level} · Proficiency Bonus ${signed(result.bonus)} · ${result.xp.toLocaleString('en')} XP${result.nextXp ? `, the next level at ${result.nextXp.toLocaleString('en')}` : ''}`),
        result.languageChoices.some(c => c.chosen.length || c.given.length) ? h('p', { class: 'sheet-languages' }, `Languages: ${result.languageChoices.flatMap(c => [...(c.key === 'Common' ? c.chosen.map(n => `${n} (vernacular)`) : c.chosen), ...c.given]).join(', ')}`) : null),
      result.background?.door || result.background?.debt ? h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-background' },
        h('h3', { id: 'sheet-background' }, result.background.name),
        h('dl', { class: 'sheet-facts' },
          result.background.door ? [h('dt', {}, 'Door'), h('dd', {}, result.background.door)] : null,
          result.background.debt ? [h('dt', {}, 'Debt'), h('dd', {}, result.background.debt)] : null)) : null,
      h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-abilities' },
        h('h3', { id: 'sheet-abilities' }, 'Abilities'),
        h('table', { class: 'sheet-abilities' },
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Ability'), h('th', { scope: 'col' }, 'Score'), h('th', { scope: 'col' }, 'Modifier'), h('th', { scope: 'col' }, 'Saving throw'))),
          h('tbody', {}, result.saves.map(s => h('tr', {},
            h('th', { scope: 'row' }, s.ability), h('td', {}, known(result.scores[s.ability])),
            h('td', {}, signed(result.mod[s.ability])), h('td', {}, `${signed(s.bonus)}${s.proficient ? ' (proficient)' : ''}`))))),
        // The scores again as a khipu, where the theme has one: the table says it to a screen reader.
        h('div', { class: 'sheet-khipu', 'aria-hidden': 'true', html: khipu(result.saves.map(s => result.scores[s.ability])) })),
      h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-combat' },
        h('h3', { id: 'sheet-combat' }, 'In a fight'),
        h('dl', { class: 'sheet-facts' },
          h('dt', {}, 'Hit points'), h('dd', {}, `${known(result.hp)}${result.hpFrom.length ? ` (${result.hpFrom.map(x => `+${known(x.hp)} from ${x.from}`).join(', ')})` : ''}, with ${result.hitDice.map(d => `${d.count} d${d.die}`).join(' and ') || 'no'} Hit Dice`),
          h('dt', {}, 'Armor Class'), h('dd', {}, `${known(result.armorClass.ac)} (${result.armorClass.from})${result.armor ? '' : result.unarmored.length > 1 ? `; without armor, one at a time: ${result.unarmored.map(u => `${known(u.ac)} (${u.from})`).join(', ')}` : ''}`),
          h('dt', {}, 'Initiative'), h('dd', {}, signed(result.initiative)),
          h('dt', {}, 'Speed'), h('dd', {}, result.speed ? `${result.speed} feet` : '—'),
          h('dt', {}, 'Size'), h('dd', {}, result.size ?? '—'),
          h('dt', {}, 'Passive Perception'), h('dd', {}, known(result.passivePerception)),
          result.masteryChoices.some(c => c.chosen.length) ? [h('dt', {}, 'Weapon Mastery'), h('dd', {}, result.masteryChoices.flatMap(c => c.chosen).map(w => `${w.name} (${w.mastery})`).join(', '))] : null)),
      // The gear the builder sets the character up with: the kits, the armour
      // it chose, the money left, and the magic items for its level.
      h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-equipment' },
        h('h3', { id: 'sheet-equipment' }, 'Equipment'),
        h('dl', { class: 'sheet-facts' },
          h('dt', {}, 'Armor'), h('dd', {}, `${result.armor?.name ?? 'None'}${result.shield ? ' and a Shield' : ''}${gear.bought ? `, the armor bought for ${gear.bought.cost.toLocaleString('en')} GP` : ''}`),
          h('dt', {}, 'Training'), h('dd', {}, result.training.length ? listed(result.training.map(t => (t === 'Shield' ? 'Shields' : `${t} armor`))) : 'None'),
          gear.kits.map(k => [h('dt', {}, `${k.from}’s kit`), h('dd', {}, k.items.join(', ') || 'Nothing but the coin')]),
          h('dt', {}, 'Money'), h('dd', {}, `${gear.gold.toLocaleString('en')} GP${gear.levelGold ? `, with the ${gear.levelGold.toLocaleString('en')} GP a character starting at level ${result.level} has; roll ${gear.roll} more` : ''}`)),
        gear.magicItems.length ? [h('h4', {}, 'Magic items'),
          h('ul', { class: 'sheet-items' }, gear.magicItems.map((m, i) => h('li', {}, m.item
            ? det(`item-${i}`, `${m.rarity}: ${m.item.name}${m.item.member ? ` (${m.item.member})` : ''}${m.item.bonus ? `, ${m.item.bonus}` : ''}${m.item.attunement ? `, requires Attunement${m.item.attunement.by ? ` by ${m.item.attunement.by}` : ''}` : ''}${m.item.living ? ', a living tradition of your homeland' : ''}`, h('div', { html: blocks(m.item.text) }))
            : `${m.rarity}: none of the books’ items fits; the DM’s choice`)))] : null,
        gear.forSale.length ? [h('h4', {}, 'The books’ gear you could buy'),
          h('ul', { class: 'sheet-gear' }, gear.forSale.map(x => h('li', {}, `${x.name}${x.of ? ` (${x.of})` : ''}${x.countsAs ? `, counts as ${x.countsAs.join(' or ')}` : ''}, ${x.cost === null ? x.note : `${x.cost.toLocaleString('en')} GP${x.note ? ` (${x.note})` : ''}`}`)))] : null),
      h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-skills' },
        h('h3', { id: 'sheet-skills' }, 'Skills'),
        h('ul', { class: 'sheet-skills' }, result.skills.map(s => h('li', { class: s.proficient ? 'is-proficient' : null },
          h('span', {}, `${s.name}`), h('span', { class: 'sheet-ability' }, ` (${s.ability.slice(0, 3)})`), h('span', { class: 'sheet-bonus' }, ` ${signed(s.bonus)}`), s.proficient ? h('span', { class: 'sheet-mark' }, s.expertise ? ' expertise' : ' proficient') : null,
          s.extra.length ? h('span', { class: 'sheet-mark' }, ` with ${s.extra.map(x => `${signed(x.value)} from ${x.from}`).join(' and ')}`) : null,
          s.name === 'Stealth' && result.stealthDisadvantage ? h('span', { class: 'sheet-mark' }, ' with Disadvantage, in this armor') : null)))),
      casting.length || chosenSpells.length ? h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-spells' }, h('h3', { id: 'sheet-spells' }, 'Spells'), casting, chosenSpells) : null,
      result.feats.length ? h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-feats' },
        h('h3', { id: 'sheet-feats' }, 'Feats'),
        result.feats.map(f => det(`feat-${f.from}`, `${f.feat.name}${f.note ? ` (${f.note})` : ''}, from ${f.from}`,
          h('div', { html: blocks([f.feat.description, ...f.feat.benefits.map(b => `**${b.name}.** ${b.text}`)].filter(Boolean).join('\n\n')) })))) : null,
      result.species ? h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-traits' },
        h('h3', { id: 'sheet-traits' }, `${result.species.name} traits`),
        placed ? h('p', { class: 'sheet-placement' }, `In Euphonia${placed.status === 'draft' ? ' (a draft)' : ''}: ${placed.line}.`) : null,
        result.species.traits.map(t => det(`trait-${t.name}`, t.name, h('div', { html: blocks(t.text) }),
          (t.options ?? []).filter(o => o.name === result.option).map(o => h('div', { html: blocks(`**${o.name}.** ${o.text}`) }))))) : null,
      result.optionChoices.map(o => (o.given.length || o.taken.length ? h('section', { class: 'sheet-block', 'aria-labelledby': `sheet-options-${o.class.replace(/\W+/g, '-')}` },
        h('h3', { id: `sheet-options-${o.class.replace(/\W+/g, '-')}` }, `${capital(o.noun)}s`),
        h('p', {}, `Regard ${o.regard}${o.forgone ? ` (${o.subclass} forgoes ${o.forgone})` : ''}`),
        [...o.given, ...o.taken].map(t => det(`option-${o.class}-${t.index ?? t.name}`, `${t.name}${t.art ? ` (${t.art})` : ''}${t.from ? `, from ${t.from}` : ''}`, h('div', { html: blocks(t.text) })))) : null)),
      ...result.optionalRules.filter(r => r.card).map(r => h('section', { class: 'sheet-block', 'aria-labelledby': `sheet-card-${r.key.replace(/\W+/g, '-')}` },
        h('h3', { id: `sheet-card-${r.key.replace(/\W+/g, '-')}` }, 'Monster Form'),
        h('table', { class: 'sheet-scores' }, h('caption', {}, 'Ability scores, swapped'), h('tbody', {}, ABILITIES.map(a => h('tr', {}, h('th', { scope: 'row' }, a), h('td', {}, Number.isFinite(r.card.scores[a]) ? String(r.card.scores[a]) : '—'), h('td', {}, signed(r.card.mods[a])))))),
        h('ul', {},
          h('li', {}, `Armor Class ${Number.isFinite(r.card.armorClass.ac) ? r.card.armorClass.ac : '—'} (${r.card.armorClass.from})`),
          h('li', {}, `${r.card.tempHp} Temporary Hit Points on transforming`),
          h('li', {}, `Unarmed Strike ${signed(r.card.strike.attack)} to hit, ${r.card.strike.damage}${r.card.strike.attacks > 1 ? `; ${r.card.strike.attacks} attacks when you take the Attack action` : ''}`),
          h('li', {}, `Saving throws: ${r.card.saves.map(x => `${x.ability} ${signed(x.bonus)}${x.proficient ? '*' : ''}`).join(', ')}`),
          h('li', {}, `Skills: ${r.card.skills.map(x => `${x.name} ${signed(x.bonus)}`).join(', ')}; no others`),
          h('li', {}, `Monstrous Aura: ${r.card.aura.feet} feet, ${r.card.aura.save} save DC ${r.card.aura.dc}`),
          r.card.resistance ? h('li', {}, `Resistance to ${r.card.resistance} damage`) : null))),
      result.noteChoices.some(c => c.named) || result.walkedChoices.some(c => c.chosen) || result.formChoices.some(c => c.chosen.length) ? h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-choices' }, h('h3', { id: 'sheet-choices' }, 'Chosen'),
        h('ul', {},
          result.noteChoices.filter(c => c.named).map(c => h('li', {}, `${c.label}: ${c.named}`)),
          result.walkedChoices.filter(c => c.chosen).map(c => h('li', {}, `${c.label}: ${c.chosen}, walked`)),
          result.formChoices.filter(c => c.chosen.length).map(c => h('li', {}, `${c.label}: ${listed(c.chosen)}`)))) : null,
      result.tools.length ? h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-tools' }, h('h3', { id: 'sheet-tools' }, 'Tools'),
        h('ul', {}, result.tools.map(t => h('li', {}, `${t.name}${t.expertise ? ', with Expertise' : ''} (${listed(t.from)})`)))) : null,
      result.spellbooks.length ? h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-books' }, h('h3', { id: 'sheet-books' }, 'Spellbooks'),
        result.spellbooks.map(b => h('div', { class: 'sheet-spell-list' }, h('h4', {}, `${b.class}'s spellbook`),
          h('ul', {}, [...b.written].sort((x, y) => x.level - y.level || x.name.localeCompare(y.name)).map(sp => h('li', {}, `Level ${sp.level}: ${sp.name}${sp.school ? `, ${sp.school}` : ''}${sp.from ? `, from ${sp.from}` : ''}`)))))) : null,
      result.revelationsKnown.length ? h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-revelations' },
        h('h3', { id: 'sheet-revelations' }, 'Revelations'),
        result.revelationsKnown.map(k => h('div', { class: 'sheet-revelations' },
          h('h4', {}, `${k.class}: ${k.every ? `every Revelation (${k.known.length})` : `${k.known.length} known`}`),
          k.known.map(r => det(`revelation-${k.class}-${r.name}`, `${r.name}, from ${r.from}`, h('p', { class: 'b-note' }, revelationLine(r)), revelationRules(r)))))) : null,
      result.classes.length ? h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-features' },
        h('h3', { id: 'sheet-features' }, 'Class features'),
        result.classes.map(c => h('div', { class: 'sheet-class' },
          h('h4', {}, `${c.class} ${c.level}${c.subclass ? `, ${c.subclass}` : ''}`, h('span', { class: 'sheet-source' }, ` · ${c.source}${c.subclassBook ? `; ${c.subclass} from ${c.subclassBook}` : ''}`)),
          result.features.filter(f => f.class === c.class && !f.option && !(f.name === 'Ability Score Improvement' || f.name === 'Epic Boon'))
            .map(f => det(`feature-${c.class}-${f.level}-${f.name}`, `Level ${f.level}: ${f.name}${f.subclass ? ` (${f.subclass})` : ''}`, h('div', { html: blocks(f.text) })))))) : null,
      h('footer', { class: 'sheet-credit' },
        h('p', { html: inline(`Rules: ${srd.provenance.source}. ${adaptedNote}`) }),
        // The book sets this beside every SRD attribution (Appendix E).
        h('p', {}, legal.independence),
        h('p', {}, 'Euphonia’s classes are Scott Cohen’s.')),
    );
  }

  // ---------- one pass from the choices to the page
  function update() {
    const result = character(book, state);
    renderClasses(result);
    renderLanguages(result);
    optionSection.hidden = ![result.optionChoices, result.pickChoices, result.masteryChoices, result.spellSetChoices, result.kindChoices, result.saveChoices, result.weaponChoices, result.cantripTargets, result.optionalRules, result.formChoices, result.walkedChoices, result.noteChoices, result.swapChoices].some(x => x.length) && !result.revelationChoices.some(c => !c.moot);
    renderForms(result);
    renderSwaps(result);
    renderWalked(result);
    renderNotes(result);
    renderKinds(result);
    renderSaves(result);
    renderWeapons(result);
    renderTargets(result);
    renderRules(result);
    renderTools(result);
    renderPicks(result);
    renderRevelations(result);
    renderSpellSets(result);
    renderMastery(result);
    renderOptions(result);
    renderSpecies(result);
    renderBackground(result);
    renderScores();
    renderOrigin(result);
    renderHomeland(result);
    renderStyles(result);
    renderExpertise(result);
    renderSkills(result);
    renderFeats(result);
    renderSpells(result);
    renderProblems(result);
    renderSheet(result);
    const url = new URL(location.href);
    url.searchParams.set(PARAM, encode(state));
    history.replaceState(history.state, '', url);
    try { localStorage.setItem(STORE_KEY, encode(state)); } catch { /* storage unavailable */ }
  }

  // A blank character: the fixed controls cleared, the rest rebuilt.
  function startAgain() {
    state = blank();
    for (const el of form.querySelectorAll('[data-for]')) delete el.dataset.for;
    classShape = null;
    nameInput.value = ''; speciesSelect.value = ''; backgroundSelect.value = '';
    form.querySelector('input[name=method][value=standard]').checked = true;
    update();
    nameInput.focus();
  }

  const tools = h('div', { class: 'b-tools' },
    h('button', { type: 'button', class: 'b-button', onclick: () => print() }, 'Print the sheet'),
    h('button', { type: 'button', class: 'b-button', onclick: startAgain }, 'Start again'),
    h('p', { class: 'b-note' }, 'The address holds this character: copy it to keep or share it.'));
  form.prepend(tools);
  // A printed sheet has every feature's text: closed disclosures don't print,
  // so they open for it and close again after.
  let closed = [];
  addEventListener('beforeprint', () => { closed = [...sheet.querySelectorAll('details:not([open])')]; for (const d of closed) d.open = true; });
  addEventListener('afterprint', () => { for (const d of closed) d.open = false; closed = []; });
  sheet.hidden = false;
  update();
}
