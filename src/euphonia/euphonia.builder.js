// The character builder: the choices on one side, the sheet they make on the
// other. Every number on the sheet is the engine's (euphonia.character.js);
// this file only asks and shows. The character lives in the address (?c=),
// so a link is the character, and this browser remembers the last one.
import { loadBook } from './euphonia.book.js';
import { h, present } from './euphonia.dom.js';
import { PARAM, blank, encode, decode } from './euphonia.build.js';
import { openSaves } from './euphonia.saves.js';
import places from 'virtual:euphonia-places';
import { ABILITIES, MAX_LEVEL, languageNotes, character, speciesOptions, featsAllowed, featIncrease, qualifies } from './euphonia.character.js';
import { inline, blocks } from './euphonia.markdown.js';
import { khipu } from './euphonia.ornament.js';

// A number the sheet can't know yet (no scores chosen, say) shows as a dash.
const known = n => (Number.isFinite(n) ? String(n) : '—');
const pounds = n => (Number.isFinite(n) ? `${n.toLocaleString('en', { maximumFractionDigits: 2 })} lb.` : '—');
const signed = n => (!Number.isFinite(n) ? '—' : n >= 0 ? `+${n}` : `−${-n}`);

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
    const rules = await loadBook();
    ({ srd, book, languages, legal } = rules);
    // What a language field suggests: the real tongues of the cultures the
    // book names (the ribbons' list), then the rules' own languages.
    tongueNames = [...new Set([...rules.tongues.tongues.map(x => x.language), ...book.languages.standard, ...book.languages.rare])];
  } catch (err) {
    status.textContent = `The rules didn't load (${err.message}); reload the page to try again.`;
    return;
  }

  // A link opens its character without touching the saved ones; it joins them
  // only once the player changes it.
  const saved = openSaves();
  let state = decode(new URLSearchParams(location.search).get(PARAM) ?? '') ?? decode(saved.current()?.code ?? '') ?? blank();
  let savedCode = encode(state), savedId = saved.list().find(c => c.code === savedCode)?.id ?? null, edited = false;
  if (savedId) saved.select(savedId);

  // ---------- the controls, built once; the parts whose shape depends on
  // earlier choices are rebuilt only when that shape changes.
  const problemSlot = field => h('p', { class: 'b-problem', id: idFor(field), hidden: true });
  const section = (title, ...body) => h('fieldset', { class: 'b-section' }, h('legend', {}, title), ...body);
  // An explanation, folded under its section until it's asked for.
  const why = (topic, ...body) => h('details', { class: 'b-about b-why' }, h('summary', {}, 'Why?', h('span', { class: 'visually-hidden' }, ` (${topic})`)), ...body);

  const nameInput = h('input', { name: 'name', type: 'text', autocomplete: 'off', maxlength: 80, value: state.name });
  const classList = h('ol', { class: 'b-classes' });
  // Only a character of more than one class needs to know which came first.
  const classNote = h('p', { class: 'b-note', hidden: true }, 'The first is the class you began in. Its levels and the others’ make your character level.');
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
  const packageBox = h('div', { class: 'b-picks' });
  const abilityBox = h('div', { class: 'b-picks' });
  const gearBox = h('div', { class: 'b-gear' });
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
  const languageNote = languageNotes(languages.paragraphs);
  const languageAbout = h('details', { class: 'b-about' }, h('summary', {}, 'Languages in 1668'), h('div', { html: blocks(languages.paragraphs.join('\n\n')) }));
  const expertiseBox = h('div', { class: 'b-expertise' });
  const increases = h('div', { class: 'b-increases', role: 'group', 'aria-label': 'Ability increases', 'aria-describedby': idFor('increases') });
  const backgroundAbout = h('div', { class: 'b-about' });
  const methods = [['standard', 'Standard array'], ['point', 'Point cost'], ['rolled', 'Rolled']];
  const methodGroup = h('div', { class: 'b-choice', role: 'radiogroup', 'aria-label': 'How to generate scores' },
    methods.map(([value, label]) => h('label', {}, h('input', { type: 'radio', name: 'method', value, checked: state.method === value }), ` ${label}`)));
  const scoreGrid = h('div', { class: 'b-scores', role: 'group', 'aria-label': 'Base scores', 'aria-describedby': idFor('base') });
  const hpMethodGroup = h('div', { class: 'b-choice', role: 'radiogroup', 'aria-label': 'Hit points after level 1' },
    ['Fixed', 'Rolled'].map(value => h('label', {}, h('input', { type: 'radio', name: 'hp-method', value, checked: (state.hp?.method ?? 'Fixed') === value }), ` ${value}`)));
  const rollBox = h('div', { class: 'b-rolls' });
  const pointsLeft = h('p', { class: 'b-note', 'aria-live': 'polite' });
  const skillsBox = h('div', { class: 'b-skill-groups' });
  const featsBox = h('div', { class: 'b-feats' });
  const originBox = h('div', { class: 'b-origin' });
  const skillNotes = h('ul', { class: 'b-notes' });
  const spellsBox = h('div', { class: 'b-spells' });

  // The choices a class's own features ask: shown only when there are some.
  const optionSection = h('fieldset', { class: 'b-section', hidden: true }, h('legend', {}, 'Class choices'), kindBox, swapBox, pickBox, revelationBox, walkedBox, spellSetBox, formBox, saveBox, weaponBox, masteryBox, optionBox, targetBox, noteBox, ruleBox);

  status.remove();
  // A newcomer meets four choices first: the name, and the class, species and
  // background everything else follows from. The rest opens once those three
  // are made, in the order a player needs it.
  const nextNote = h('p', { class: 'b-note' }, 'Your other choices open here once you’ve chosen a class, a species and a background.');
  const later = [
    section('Ability scores', methodGroup, scoreGrid, pointsLeft, problemSlot('base'), problemSlot('method')),
    section('Homeland', h('label', { class: 'b-field' }, h('span', {}, 'Region'), homelandSelect), homelandLink,
      h('label', { class: 'b-field' }, h('span', {}, 'Buying in'), marketSelect),
      why('Homeland', h('p', {}, book.speciesAndPeople), (item => h('p', {}, `${item.name}: ${item.prices.says}`))(book.items.find(i => i.prices)))),
    section('Languages', tongueList, languageBox, languageAbout),
    optionSection,
    section('Skills', skillsBox, expertiseBox, skillNotes),
    section('Tools', toolsBox),
    section('Feats', styleBox, featureOriginBox, featsBox),
    section('Spells', spellsBox),
    section('Starting equipment', h('p', { class: 'b-note' }, 'Each kit, or its gold to spend instead. The builder buys armor with what’s left.'), packageBox),
    section('Gear', h('p', { class: 'b-note' }, 'What the character carries: take out what it doesn’t, buy with its money, or add what the DM gives.'), gearBox, problemSlot('inventory'), problemSlot('wear')),
    section('Hit points', h('p', { class: 'b-note' }, 'Level 1 takes the Hit Die’s highest. Each level after, take the fixed value or roll the die and enter it.'), hpMethodGroup, rollBox),
  ];
  form.append(
    section('Name', h('label', { class: 'b-field' }, h('span', {}, 'Character name'), nameInput)),
    section('Class', classList, classNote, addClass, problemSlot('classes'),
      book.unfinished.length ? h('p', { class: 'b-note' }, `${listed(book.unfinished.map((n, i) => `${i ? 'the' : 'The'} ${n}`))} ${book.unfinished.length === 1 ? 'is' : 'are'} still being written, and join${book.unfinished.length === 1 ? 's' : ''} the builder when finished.`) : null),
    section('Species', h('label', { class: 'b-field' }, h('span', {}, 'Species'), speciesSelect), problemSlot('species'), optionRow, problemSlot('option'), sizeRow, problemSlot('size'), originBox, abilityBox, speciesTraits),
    section('Background', h('label', { class: 'b-field' }, h('span', {}, 'Background'), backgroundSelect), problemSlot('background'), increases, problemSlot('increases'), backgroundAbout),
    nextNote,
    ...later,
  );

  // ---------- reading the controls into the state
  const set = (mutate) => { mutate(state); edited = true; update(); };
  // What's left to choose reads as a note until the player works in its
  // section, on a new character or one brought back. Capturing, so the mark
  // is down before the render.
  const touch = e => e.target.closest('.b-section')?.setAttribute('data-touched', '');
  for (const type of ['change', 'input', 'click']) form.addEventListener(type, touch, true);
  nameInput.addEventListener('input', () => set(s => { s.name = nameInput.value; }));
  speciesSelect.addEventListener('change', () => set(s => { s.species = speciesSelect.value; s.option = ''; s.size = ''; }));
  optionSelect.addEventListener('change', () => set(s => { s.option = optionSelect.value; }));
  sizeSelect.addEventListener('change', () => set(s => { s.size = sizeSelect.value; }));
  backgroundSelect.addEventListener('change', () => set(s => { s.background = backgroundSelect.value; s.increases = {}; }));
  homelandSelect.addEventListener('change', () => set(s => { s.homeland = homelandSelect.value; s.market = ''; }));
  marketSelect.addEventListener('change', () => set(s => { s.market = marketSelect.value; }));
  methodGroup.addEventListener('change', e => set(s => { s.method = e.target.value; s.base = {}; }));
  hpMethodGroup.addEventListener('change', e => set(s => { s.hp = { ...s.hp, method: e.target.value }; }));
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

  // A choice of so many from a list, as short as its size allows. What the
  // character has from elsewhere isn't offered again; the section names it
  // once. A long list (the 37 tools) is a menu for each pick, grouped as the
  // SRD groups it; a short one, a box for each. A choice made folds to its
  // picks until the player opens it again, and stays open while they work in
  // it.
  const MENU_FROM = 12, opened = new Set();
  const toolKind = new Map(srd.tools.flatMap(t => (t.variants ? t.variants.map(v => [`${t.name} (${v})`, `${t.name}s`]) : [[t.name, t.category === 'Other' ? 'Other Tools' : t.category]])));
  function choiceGroup(result, { key, field, legend, count, from, chosen, taken = () => false, kind = () => null, write, empty }) {
    const offered = from.filter(x => chosen.includes(x) || !taken(x));
    // Made when the engine asks nothing more of it (a Skilled may take all
    // three as tools, and none here).
    const done = !result.problems.some(p => p.field === `${field}:${key}`);
    const shown = !done || opened.has(key);
    const pick = values => { opened.add(key); write(values); };
    const dataKey = `${field}-${key}`;
    let controls;
    if (!offered.length) controls = h('p', { class: 'b-note' }, empty);
    else if (offered.length > MENU_FROM && count <= 4) {
      // The SRD's own groups, the catch-all last.
      const kinds = [...new Set(offered.map(kind))].sort((x, y) => (x === 'Other Tools') - (y === 'Other Tools'));
      const menus = Array.from({ length: count }, (_, i) => h('select', {
        'data-key': `${dataKey}-${i}`, 'aria-label': count > 1 ? `${legend}, ${i + 1} of ${count}` : legend,
        onchange: () => pick([...new Set(menus.map(m => m.value).filter(Boolean))]),
      }, h('option', { value: '' }, 'Choose'), kinds.map(k => {
        const items = offered.filter(x => kind(x) === k).map(x => h('option', { value: x, selected: chosen[i] === x || null }, x));
        return k ? h('optgroup', { label: k }, items) : items;
      })));
      controls = h('div', { class: 'b-menus' }, menus);
    } else {
      controls = h('div', { class: 'b-checks' }, offered.map(x => h('label', {}, h('input', {
        type: 'checkbox', value: x, 'data-key': `${dataKey}-${x}`, checked: chosen.includes(x),
        onchange: () => pick([...controls.querySelectorAll('input:checked')].map(b => b.value)),
      }), ` ${x}`)));
    }
    const body = h('div', { class: 'b-choice-body', id: `choice-${idFor(dataKey)}`, hidden: !shown }, controls);
    const change = h('button', { type: 'button', class: 'b-link', 'data-key': `${dataKey}-change`, 'aria-expanded': 'false', 'aria-controls': body.id, onclick: () => {
      opened.add(key); folded.hidden = true; body.hidden = false; group.classList.remove('is-folded'); body.querySelector('input, select')?.focus();
    } }, 'Change', h('span', { class: 'visually-hidden' }, ` ${legend}`));
    const folded = h('p', { class: 'b-picked', hidden: shown }, `${chosen.length ? listed(chosen) : 'None'}. `, change);
    const group = h('fieldset', { class: shown ? 'b-skills' : 'b-skills is-folded', 'aria-describedby': idFor(`${field}:${key}`) }, h('legend', {}, legend), folded, body, problemSlot(`${field}:${key}`));
    // Folds once the keyboard leaves it, after the rebuild a pick makes.
    group.addEventListener('focusout', () => setTimeout(() => {
      if (!group.isConnected || group.contains(document.activeElement) || !done) return;
      opened.delete(key); body.hidden = true; folded.hidden = false; group.classList.add('is-folded');
    }));
    return group;
  }

  // The skill choices, as the engine lists them. Proficiency counts once, so
  // a skill the character has without choosing it (a background's, a
  // feature's) or has chosen in another of these choices (Insight by an elf's
  // Keen Senses, say) isn't offered in the rest; unticked where it was taken,
  // it is offered everywhere again.
  function renderSkills(result) {
    const chosenAnywhere = new Set(Object.values(state.skills ?? {}).flat());
    const already = result.skills.filter(sk => sk.proficient && !chosenAnywhere.has(sk.name)).map(sk => sk.name);
    if (!fresh(skillsBox, JSON.stringify([result.choices.map(c => [c.key, c.count, c.upTo, c.from]), state.skills, already, [...opened], result.problems.filter(p => p.field.startsWith('skills:')).map(p => p.field)]))) return;
    const taken = key => skill => already.includes(skill) || Object.entries(state.skills ?? {}).some(([k, picked]) => k !== key && picked.includes(skill));
    rebuild(skillsBox,
      already.length ? h('p', { class: 'b-note' }, `Yours already: ${listed(already)}.`) : null,
      ...(result.choices.length ? result.choices.map(c => choiceGroup(result, {
        key: c.key, field: 'skills', count: c.count, from: c.from, chosen: state.skills?.[c.key] ?? [], taken: taken(c.key),
        legend: `${c.label}: ${c.given.length ? `${c.given.join(', ')}, plus ` : ''}${c.upTo ? `${c.count} skills or tools in any mix, the skills here and the tools under Tools` : `choose ${c.count}`}`,
        write: picked => set(s => { s.skills = { ...s.skills, [c.key]: picked }; }), empty: 'Every skill here is yours already.',
      })) : [h('p', { class: 'b-note' }, 'Your class and species bring their skill choices here.')]));
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
        h('legend', {}, c.label),
        languageNote[c.key] ? h('p', { class: 'b-note' }, languageNote[c.key]) : null,
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
  // A box for each level's roll; rebuilt only when the levels change, so
  // typing a roll doesn't lose its place.
  function renderRolls(result) {
    if (!fresh(rollBox, JSON.stringify(result.hpRolls.map(r => [r.key, r.die])))) return;
    rebuild(rollBox, ...result.hpRolls.map(r => h('label', { class: 'b-field' }, h('span', {}, `${r.class} level ${r.level} (d${r.die})`),
      h('input', { type: 'number', min: 1, max: r.die, step: 1, value: r.roll ?? '', 'aria-describedby': idFor(`hp:${r.key}`),
        onchange: e => set(s => { s.hp = { ...s.hp, rolls: { ...s.hp?.rolls, [r.key]: e.target.value === '' ? undefined : Number(e.target.value) } }; }) }),
      problemSlot(`hp:${r.key}`))));
  }
  // The inventory as a tracker: what's carried, each with its Remove; what
  // to buy or add, from the SRD's priced goods and, given only, the books'
  // magic items; and the armor to wear. Rebuilt only when the gear changes.
  function renderGear(result) {
    const inv = result.inventory;
    if (!fresh(gearBox, JSON.stringify([inv, result.equipment.magicItems.map(m => m.item?.name)]))) return;
    const take = item => set(s => { s.inventory = { ...s.inventory, remove: [...(s.inventory?.remove ?? []), item] }; });
    const unadd = k => set(s => { s.inventory = { ...s.inventory, add: (s.inventory?.add ?? []).filter((_, i) => i !== k) }; });
    const putBack = k => set(s => { s.inventory = { ...s.inventory, remove: (s.inventory?.remove ?? []).filter((_, i) => i !== k) }; });
    const row = (label, button) => h('li', {}, h('span', {}, label), ' ', button);
    const remove = (what, onclick) => h('button', { type: 'button', class: 'b-button b-remove', 'aria-label': `Remove ${what}`, onclick }, 'Remove');
    const pick = h('select', { 'aria-label': 'An item to buy or add' }, h('option', { value: '' }, 'Choose an item'),
      [...new Set(book.catalog.map(c => c.kind))].map(kind => h('optgroup', { label: kind }, book.catalog.filter(c => c.kind === kind).map(c => h('option', { value: JSON.stringify({ name: c.name }) }, `${c.name}${c.bundle ? ` (${c.bundle})` : ''}, ${c.cost.toLocaleString('en')} GP`)))),
      h('optgroup', { label: 'Magic items, as the DM gives them' }, book.items.filter(i => i.magical).flatMap(i => i.rarities.map(r => h('option', { value: JSON.stringify({ name: i.name, rarity: r.rarity, magic: true }) }, `${i.name}${i.rarities.length > 1 ? `, ${r.rarity}${r.bonus ? ` ${r.bonus}` : ''}` : ''}`)))));
    const count = h('input', { type: 'number', min: 1, step: 1, value: 1, 'aria-label': 'How many' });
    const chosen = () => (pick.value ? JSON.parse(pick.value) : null);
    const buy = h('button', { type: 'button', class: 'b-button', disabled: true, onclick: () => { const c = chosen(); if (c && !c.magic) set(s => { s.inventory = { ...s.inventory, add: [...(s.inventory?.add ?? []), { name: c.name, count: Number(count.value) || 1, how: 'bought' }] }; }); } }, 'Buy');
    const give = h('button', { type: 'button', class: 'b-button', disabled: true, onclick: () => { const c = chosen(); if (c) set(s => { s.inventory = { ...s.inventory, add: [...(s.inventory?.add ?? []), { name: c.name, ...(c.magic ? { rarity: c.rarity } : { count: Number(count.value) || 1 }), how: 'given' }] }; }); } }, 'Add, given');
    pick.addEventListener('change', () => { const c = chosen(); buy.disabled = !c || Boolean(c.magic); give.disabled = !c; count.disabled = Boolean(c?.magic); });
    const wear = h('select', { 'aria-describedby': idFor('wear'), onchange: e => set(s => { s.inventory = { ...s.inventory, wear: e.target.value }; }) },
      options([{ value: 'auto', label: 'The builder’s pick' }, { value: 'none', label: 'No armor' }, ...inv.wearOptions.map(n => ({ value: n, label: n }))], inv.wear));
    // The list is rebuilt under the player's hand: a keyboard stays where it
    // was, on what took the removed row's place, not back at the page's top.
    const controls = () => [...gearBox.querySelectorAll('button:not(:disabled), select:not(:disabled), input:not(:disabled)')];
    const at = controls().indexOf(document.activeElement);
    rebuild(gearBox,
      h('ul', { class: 'b-gear-list' },
        inv.kept.map(item => row(item, remove(item, () => take(item)))),
        inv.goods.map(g => row(`${g.item}, ${g.how}${g.how === 'bought' ? ` for ${(g.cost * g.count).toLocaleString('en')} GP` : ''}`, remove(g.item, () => unadd(g.index)))),
        result.equipment.magicItems.filter(m => m.item).map(m => row(`${m.item.name} (${m.rarity}${m.given ? ', given' : ''})`, remove(m.item.name, () => (m.given ? unadd(m.index) : take(m.item.name)))))),
      inv.removed.length ? h('p', { class: 'b-note' }, 'Taken out: ', inv.removed.map((item, k) => [k ? ', ' : '', h('button', { type: 'button', class: 'b-link', 'aria-label': `Put back ${item}`, onclick: () => putBack(k) }, item)])) : null,
      h('div', { class: 'b-gear-add' }, pick, count, buy, give),
      inv.wearOptions.length ? h('label', { class: 'b-field' }, h('span', {}, 'Armor worn'), wear) : null);
    if (at >= 0) { const now = controls(); now[Math.min(at, now.length - 1)]?.focus({ preventScroll: true }); }
  }
  function renderAbilities(result) {
    if (!fresh(abilityBox, JSON.stringify(result.abilityChoices))) return;
    rebuild(abilityBox, ...result.abilityChoices.map(c => oneOf(c, 'ability', 'spellAbilities', `${c.label}: your spellcasting ability`)));
  }
  function renderPackages(result) {
    if (!fresh(packageBox, JSON.stringify(result.packageChoices))) return;
    rebuild(packageBox, ...result.packageChoices.map(c => oneOf(c, 'package', 'packages', c.label, x => c.lines[x])));
  }
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
    if (!fresh(toolsBox, JSON.stringify([result.toolChoices.map(c => [c.key, c.count, c.from, c.chosen]), result.toolExpertise.map(c => [c.key, c.from, c.chosen]), result.tools, [...opened], result.problems.filter(p => p.field.startsWith('tools:')).map(p => p.field)]))) return;
    // A tool the character has, and didn't take in this choice, isn't offered
    // again. Held, not sourced elsewhere: the Mhizha is given Tinker's Tools
    // and its own choice offers them too, under the same label. Expertise is
    // with tools already had.
    const taken = c => t => !c.chosen.includes(t) && result.tools.some(x => x.name === t);
    const kind = t => toolKind.get(t) ?? null;
    const write = c => picked => set(s => { s.tools = { ...s.tools, [c.key]: picked }; });
    rebuild(toolsBox,
      given.length ? h('p', { class: 'b-note' }, `Yours already: ${listed(given)}.`) : null,
      ...result.toolChoices.map(c => choiceGroup(result, { key: c.key, field: 'tools', legend: `${c.label}: choose ${c.count}`, count: c.count, from: c.from, chosen: c.chosen, taken: taken(c), kind, write: write(c), empty: 'Every tool here is yours already.' })),
      ...result.toolExpertise.map(c => choiceGroup(result, { key: c.key, field: 'tools', legend: `${c.label}: Expertise with ${c.count}${c.skill ? `, ${c.skill} among them if you like` : ''}`, count: c.count, from: c.from, chosen: c.chosen, kind, write: write(c), empty: 'Choose tools first: Expertise is with tools you’re proficient with.' })),
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
    if (!fresh(expertiseBox, JSON.stringify([result.expertiseChoices.map(c => [c.key, c.count, c.from]), state.expertise, [...opened], result.problems.filter(p => p.field.startsWith('expertise:')).map(p => p.field)]))) return;
    rebuild(expertiseBox, ...result.expertiseChoices.map(c => choiceGroup(result, {
      key: c.key, field: 'expertise', legend: `${c.label}: Expertise in ${c.count}`, count: c.count, from: c.from, chosen: state.expertise?.[c.key] ?? [],
      write: picked => set(s => { s.expertise = { ...s.expertise, [c.key]: picked }; }), empty: 'Choose skills first: Expertise is in skills you’re proficient in.',
    })));
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
    // A list's spells, a fold to each level: closed, the levels sit in a row;
    // an open one takes the width. A spellbook's are written, a list's chosen.
    const byLevel = (key, offered, picked, read, { prefix, verb }) => h('div', { class: 'b-levels' }, [...new Set(offered.map(sp => sp.level))].sort((a, b) => a - b).map(level => {
      const k = `${key}-${level}`, here = offered.filter(sp => sp.level === level), n = here.filter(sp => picked.has(sp.name)).length;
      return h('details', { 'data-key': k, open: openLevels.has(k) || null }, h('summary', {}, `${level ? `Level ${level}` : 'Cantrips'}${n ? `: ${n} ${verb}` : ''}`),
        h('div', { class: 'b-checks' }, here.map(sp => h('label', {}, h('input', { type: 'checkbox', value: sp.name, 'data-key': `${prefix}-${key}-${sp.name}`, checked: picked.has(sp.name), onchange: read }),
          h('span', {}, sp.name, sp.special && !/^[—–]$/.test(sp.special) ? h('span', { class: 'b-mark' }, ` ${sp.special}`) : null)))));
    }));
    const BOOK = { prefix: 'book', verb: 'written' };
    const books = result.spellbooks.flatMap(b => {
      const write = (key, box) => () => set(s => { s.spellbooks = { ...s.spellbooks, [key]: [...box.querySelectorAll('input:checked')].map(x => x.value) }; });
      const main = h('fieldset', { class: 'b-spell-choice', 'aria-describedby': idFor(`spells:${b.key}`) },
        h('legend', {}, `${b.class}'s spellbook: ${b.chosen.length} of ${b.free} spells of your choice, the first ${b.start} of level 1`),
        b.granted.length ? h('p', { class: 'b-note' }, `Written in by features: ${listed([...new Set(b.granted.map(sp => `${sp.name} (${sp.from})`))])}.`) : null);
      main.append(byLevel(b.key, b.offered, new Set(b.chosen.map(sp => sp.name)), write(b.class, main), BOOK), problemSlot(`spells:${b.key}`));
      const extra = b.extra.map(x => {
        const box = h('fieldset', { class: 'b-spell-choice', 'aria-describedby': idFor(`spells:${x.key}`) }, h('legend', {}, `${x.label}: ${x.chosen.length} of ${x.count} free`));
        box.append(byLevel(x.key, x.from, new Set(x.chosen.map(sp => sp.name)), write(x.key, box), BOOK), problemSlot(`spells:${x.key}`));
        return box;
      });
      return [main, ...extra];
    });
    const groups = result.spellChoices.map(c => {
      const picked = new Set(c.chosen.map(sp => sp.name));
      const read = () => set(s => { s.spells = { ...s.spells, [c.key]: [...box.querySelectorAll('input:checked')].map(x => x.value) }; });
      const count = level => c.chosen.filter(sp => (level ? sp.level > 0 : sp.level === 0)).length;
      const box = h('fieldset', { class: 'b-spell-choice', 'aria-describedby': idFor(`spells:${c.key}`) },
        h('legend', {}, c.mixed ? `${c.label}: ${c.chosen.length} of ${c.prepared}, cantrips or spells up to level ${c.highest}, ${c.verb}` : `${c.label}: ${c.cantrips ? `${count(0)} of ${c.cantrips} ${c.cantrips === 1 ? 'cantrip' : 'cantrips'}, ` : ''}${count(1)} of ${c.prepared} ${c.verb} ${c.prepared === 1 ? 'spell' : 'spells'}, up to level ${c.highest}`),
        c.given.length ? h('p', { class: 'b-note' }, `Always known: ${listed(c.given.map(sp => sp.name))}.`) : null,
        c.always.length ? h('p', { class: 'b-note' }, `Always prepared, besides these: ${[...new Set(c.always.map(sp => sp.from))].map(from => `${listed(c.always.filter(sp => sp.from === from).map(sp => sp.name))} (${from})`).join('; ')}.`) : null,
        byLevel(c.key, c.list, picked, read, { prefix: 'spell', verb: 'chosen' }),
        problemSlot(`spells:${c.key}`));
      return box;
    });
    rebuild(spellsBox, ...(lists.length || groups.length || books.length ? [...books, ...lists, ...groups] : [h('p', { class: 'b-note' }, 'Your spellcasting classes and feats bring their spells here.')]));
  }

  // The problems, each beside the choice it belongs to; the notes, beside
  // theirs.
  function renderProblems(result) {
    const problems = new Map();
    for (const p of result.problems) problems.set(idFor(p.field), [...(problems.get(idFor(p.field)) ?? []), p]);
    for (const slot of form.querySelectorAll('.b-problem')) {
      const here = problems.get(slot.id) ?? [];
      slot.textContent = here.map(p => p.message).join(' ');
      slot.hidden = !here.length;
      // A rule the build breaks is said plainly, whoever made the build.
      slot.classList.toggle('is-broken', here.some(p => !p.open));
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
    const withheldText = new Map((srd.spell_text_withheld ?? []).map(w => [w.spell, w.names]));
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
      h('ul', {}, result.spellcasting.map(s => h('li', {}, `${s.class}: ${s.cantrips ? `${s.cantrips} cantrips${s.given.length ? ` and ${s.given.length} always known` : ''}, ` : ''}${s.prepared} ${s.verb} spells, up to level ${s.highest}.${s.ability ? ` Spell save DC ${known(s.dc)}, spell attack ${signed(s.attack)} (${s.ability}${s.items ? `, with ${listed(s.items)}` : ''}).` : ''}`)))] : [];
    const chosenSpells = result.spellChoices.filter(c => c.chosen.length || c.given.length || c.always.length).map(c => h('div', { class: 'sheet-spell-list' },
      h('h4', {}, c.label),
      h('ul', {}, [...c.given.map(sp => ({ ...sp, kept: 'always known' })), ...c.always.map(sp => ({ ...sp, kept: `always prepared, from ${sp.from}` })), ...c.chosen].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)).map(sp => h('li', {},
        // Each spell opens to its header and text, as the books write them;
        // one the site holds back says why.
        (facts => det(`spell-${c.key}-${sp.name}`, `${sp.level ? `Level ${sp.level}` : 'Cantrip'}: ${sp.name}${sp.school ? `, ${sp.school}` : ''}${sp.special && !/^[—–]$/.test(sp.special) ? ` (${sp.special})` : ''}${sp.kept ? `, ${sp.kept}` : ''}`,
          facts ? h('p', { class: 'sheet-spell-head' }, `${facts.casting} · ${facts.range}${facts.area ? `, a ${facts.area}` : ''} · ${facts.components} · ${facts.duration}`) : null,
          facts?.text ? h('div', { html: blocks(facts.text) }) : h('p', { class: 'sheet-note' }, withheldText.has(sp.name) ? `The SRD's text names ${listed(withheldText.get(sp.name))}, which Euphonia doesn't publish; read it in SRD 5.2.1.` : 'Its text isn’t in the books’ export.')))(book.spellFacts.get(sp.name)))))));
    rebuild(sheet,
      h('header', { class: 'sheet-head' },
        h('button', { type: 'button', class: 'b-link b-jump', onclick: () => go(form.querySelector('.b-jump')) }, 'Back to your choices'),
        h('h2', { id: 'sheet-title', tabindex: '-1' }, state.name.trim() || 'Your character'),
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
          h('dt', {}, 'Hit points'), h('dd', {}, !result.hitDice.length ? '— (choose a class)' : `${known(result.hp)}${result.hpMethod === 'Rolled' ? ' (rolled)' : ''}${result.hpFrom.length ? ` (${result.hpFrom.map(x => `+${known(x.hp)} from ${x.from}`).join(', ')})` : ''}, with ${result.hitDice.map(d => `${d.count}d${d.die}`).join(' and ')} Hit Dice`),
          h('dt', {}, 'Armor Class'), h('dd', {}, `${known(result.armorClass.ac)} (${result.armorClass.from})${result.armor ? '' : result.unarmored.length > 1 ? `; without armor, one at a time: ${result.unarmored.map(u => `${known(u.ac)} (${u.from})`).join(', ')}` : ''}`),
          h('dt', {}, 'Initiative'), h('dd', {}, signed(result.initiative)),
          h('dt', {}, 'Speed'), h('dd', {}, `${result.speed ? `${result.speed} feet` : '—'}${Object.entries(result.speeds).map(([k, v]) => `; ${k} ${v} feet`).join('')}`),
          (d => (d.length ? [h('dt', {}, 'Defenses'), h('dd', {}, d.join('; '))] : null))([
            result.defenses.resistances.length && `Resistance to ${listed(result.defenses.resistances)} damage`,
            result.defenses.immunities.length && `Immunity to ${listed(result.defenses.immunities)} damage`,
            result.defenses.conditionImmunities.length && `Immunity to the ${listed(result.defenses.conditionImmunities)} condition${result.defenses.conditionImmunities.length > 1 ? 's' : ''}`,
            result.defenses.conditionAdvantages.length && `Advantage on saves against ${listed(result.defenses.conditionAdvantages)}`,
            ...result.defenses.saveAdvantages.map(x => `Advantage on ${x}`),
            result.saveItems.length && `saving throws include ${listed(result.saveItems)}`].filter(Boolean)),
          Object.keys(result.senses).length ? [h('dt', {}, 'Senses'), h('dd', {}, Object.entries(result.senses).map(([k, v]) => `${k} ${v} feet`).join('; '))] : null,
          h('dt', {}, 'Size'), h('dd', {}, result.size ?? '—'),
          h('dt', {}, 'Passive Perception'), h('dd', {}, known(result.passivePerception)),
          h('dt', {}, 'Attacks'), h('dd', {}, `${result.attacksPerAction} when you take the Attack action`),
          result.masteryChoices.some(c => c.chosen.length) ? [h('dt', {}, 'Weapon Mastery'), h('dd', {}, result.masteryChoices.flatMap(c => c.chosen).map(w => `${w.name} (${w.mastery})`).join(', '))] : null),
        // The attacks the sheet's numbers give: each weapon carried, the
        // Unarmed Strike, a feature's own or a species', and each spell known
        // or prepared that attacks or forces a save.
        // Five columns don't fit a phone's sheet: the table scrolls in its
        // own region, which a keyboard can reach and a screen reader names.
        h('div', { class: 'sheet-scroll', role: 'region', 'aria-labelledby': 'sheet-attacks-caption', tabindex: '0' },
        h('table', { class: 'sheet-attacks' }, h('caption', { id: 'sheet-attacks-caption' }, 'Attacks'),
          h('thead', {}, h('tr', {}, ['Attack', 'To hit or save', 'Damage', 'Range', 'Notes'].map(t => h('th', { scope: 'col' }, t)))),
          h('tbody', {}, result.attacks.map(a => h('tr', {},
            h('th', { scope: 'row' }, a.name),
            h('td', {}, a.save ? `DC ${known(a.save.dc)} ${a.save.ability}` : signed(a.bonus)),
            h('td', {}, `${a.damage}${a.beams ? `, ${a.beams} beams` : ''}${a.versatile ? `; two-handed ${a.versatile}` : ''}`),
            h('td', {}, a.reach),
            h('td', {}, [a.disadvantage && `Disadvantage: ${a.disadvantage}`, a.mastery && `Mastery: ${a.mastery}`, ...a.riders, !a.proficient && 'not proficient', a.kind === 'spell' && (a.level ? `level ${a.level} ${a.class} spell` : `${a.class} cantrip`)].filter(Boolean).join('; ') || '—'))))))),
      // The gear the builder sets the character up with: the kits, what its
      // features hand it, the armour it chose, the money left, and the magic
      // items for its level.
      h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-equipment' },
        h('h3', { id: 'sheet-equipment' }, 'Equipment'),
        h('dl', { class: 'sheet-facts' },
          h('dt', {}, 'Wearing'), h('dd', {}, `${result.armor?.name ?? 'No armor'}${result.armor?.madeFrom ? `, made from your ${result.armor.madeFrom}` : ''}${result.hoveringShield ? `, with ${result.hoveringShield.replace(/^The /, 'the ')} hovering beside you` : result.shield ? ', and holding a Shield' : ''}${gear.bought ? `; the armor bought for ${gear.bought.cost.toLocaleString('en')} GP` : ''}${result.shieldLeft ? `. Your Shield is packed, not held: ${result.shieldLeft}` : ''}`),
          h('dt', {}, 'Armor training'), h('dd', {}, result.training.length ? listed(result.training.map(t => (t === 'Shield' ? 'Shields' : `${t} armor`))) : 'None'),
          h('dt', {}, 'Weapon proficiencies'), h('dd', {}, listed([...result.weaponTraining.categories.map(k => `${k} weapons`), ...result.weaponTraining.named]) || 'None'),
          result.inventory.goods.length ? [h('dt', {}, 'Added'), h('dd', {}, result.inventory.goods.map(g => `${g.item} (${g.how})`).join(', '))] : null,
          result.inventory.removed.length ? [h('dt', {}, 'Taken out'), h('dd', {}, result.inventory.removed.join(', '))] : null,
          gear.carried.length ? [h('dt', {}, 'From your features'), h('dd', {}, gear.carried.map(x => `${x.name} (${x.from})`).join(', '))] : null,
          // Each kit item said where it is: the armour worn or made into the
          // suit, the Shield held or packed.
          gear.kits.map(k => [h('dt', {}, `${k.from}’s kit`), h('dd', {}, k.items.map(i => (i === result.armor?.madeFrom ? `${i} (made into your ${result.armor.name})` : i === result.armor?.name ? `${i} (worn)` : i === 'Shield' ? `${i} (${result.shield ? 'held' : 'packed'})` : i)).join(', ') || 'Nothing but the coin')]),
          h('dt', {}, 'Weight carried'), h('dd', {}, `${pounds(result.load.items + result.load.coins)}, ${pounds(result.load.coins)} of it coin, ${result.load.carry === null ? 'of what your size and Strength let you carry, once you’ve chosen them' : `of the ${pounds(result.load.carry)} you can carry; you can drag, lift or push ${pounds(result.load.drag)}`}${result.load.unweighed.length ? `; the books give no weight for ${listed(result.load.unweighed)}` : ''}`),
          result.load.over ? h('dd', { class: 'sheet-warning' }, `More than you can carry. ${result.load.over}`) : null,
          h('dt', {}, 'Money'), h('dd', {}, `${gear.gold.toLocaleString('en')} GP${gear.levelGold ? `, with the ${gear.levelGold.toLocaleString('en')} GP a character starting at level ${result.level} has; roll ${gear.roll} more` : ''}`)),
        gear.magicItems.length ? [h('h4', {}, 'Magic items'),
          h('ul', { class: 'sheet-items' }, gear.magicItems.map((m, i) => h('li', {}, m.item
            ? det(`item-${i}`, `${m.rarity}: ${m.item.name}${m.item.member ? ` (${m.item.member})` : ''}${m.item.bonus ? `, ${m.item.bonus}` : ''}${m.item.attunement ? `, requires Attunement${m.item.attunement.by ? ` by ${m.item.attunement.by}` : ''}${result.unattuned.includes(m.item.name) ? `; carried, not attuned (${result.attunementMax} at a time)` : '; attuned'}` : ''}${m.item.living ? ', a living tradition of your homeland' : ''}`, h('div', { html: blocks(m.item.text) }))
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
          c.columns.length ? h('p', { class: 'sheet-columns' }, c.columns.map(x => `${x.name} ${x.value}`).join(' · ')) : null,
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
    const ready = Boolean(state.classes[0]?.class && state.species && state.background);
    for (const s of later) s.hidden = !ready;
    nextNote.hidden = ready;
    classNote.hidden = state.classes.length < 2;
    optionSection.hidden = !ready || ![result.optionChoices, result.pickChoices, result.masteryChoices, result.spellSetChoices, result.kindChoices, result.saveChoices, result.weaponChoices, result.cantripTargets, result.optionalRules, result.formChoices, result.walkedChoices, result.noteChoices, result.swapChoices].some(x => x.length) && !result.revelationChoices.some(c => !c.moot);
    renderForms(result);
    renderSwaps(result);
    renderWalked(result);
    renderNotes(result);
    renderKinds(result);
    renderPackages(result);
    renderAbilities(result);
    renderGear(result);
    renderRolls(result);
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
    const url = new URL(location.href), code = encode(state);
    url.searchParams.set(PARAM, code);
    history.replaceState(history.state, '', url);
    if (edited && code !== savedCode) { savedCode = code; savedId = saved.put(savedId, state.name, code); renderSaved(); }
  }

  // A blank character: the fixed controls cleared, the rest rebuilt.
  function startAgain() {
    state = blank();
    savedCode = encode(state); savedId = null; edited = false;
    saved.select(null);
    asking = false;
    renderSaved();
    for (const el of form.querySelectorAll('[data-for]')) delete el.dataset.for;
    for (const s of form.querySelectorAll('[data-touched]')) delete s.dataset.touched;
    classShape = null;
    nameInput.value = ''; speciesSelect.value = ''; backgroundSelect.value = '';
    form.querySelector('input[name=method][value=standard]').checked = true;
    update();
    nameInput.focus();
  }

  // Where the sheet stacks under the form (narrow screens), it's thousands
  // of pixels down: a way there and back, moving focus with the view. Not a
  // #link, since the hash names the tab.
  const go = el => { el.scrollIntoView({ block: 'start' }); el.focus({ preventScroll: true }); };
  // The saved characters, and Start again, which asks first. Starting again
  // leaves a saved character in the list.
  const savedBox = h('div', { class: 'b-saved' });
  let asking = false;
  const nameOf = (c, i) => decode(c.code)?.name?.trim() || c.name || `Character ${i + 1}`;
  function renderSaved() {
    const list = saved.list();
    savedBox.replaceChildren(...present([
      asking ? [h('span', {}, savedId ? 'Start a new character? This one stays saved.' : 'Start again? This character isn’t saved.'),
        h('button', { type: 'button', class: 'b-button', 'data-key': 'again-yes', onclick: () => { startAgain(); } }, 'Start again'),
        h('button', { type: 'button', class: 'b-button', 'data-key': 'again-no', onclick: () => { asking = false; renderSaved(); savedBox.querySelector('[data-key=again]').focus(); } }, 'Keep working')]
        : h('button', { type: 'button', class: 'b-button', 'data-key': 'again', onclick: () => { asking = true; renderSaved(); savedBox.querySelector('[data-key=again-no]').focus(); } }, 'Start again'),
      list.length ? h('label', { class: 'b-saved-pick' }, h('span', {}, 'Saved characters'),
        h('select', { 'data-key': 'saved', onchange: e => { const c = list.find(x => x.id === e.target.value); if (c) { saved.select(c.id); location.assign(`${location.pathname}?${PARAM}=${c.code}#builder`); } } },
          h('option', { value: '', selected: !savedId }, savedId ? 'Choose one' : 'This one isn’t saved'), list.map((c, i) => h('option', { value: c.id, selected: c.id === savedId }, nameOf(c, i))))) : null,
      savedId ? h('button', { type: 'button', class: 'b-link', 'data-key': 'forget', onclick: () => { saved.remove(savedId); savedId = null; savedCode = ''; renderSaved(); } }, 'Remove from saved') : null,
      saved.ok ? null : h('span', { class: 'b-note' }, 'This browser can’t save, so keep the address.'),
    ]));
  }
  renderSaved();
  const tools = h('div', { class: 'b-tools' },
    h('button', { type: 'button', class: 'b-button', onclick: () => print() }, 'Print the sheet'),
    savedBox,
    h('button', { type: 'button', class: 'b-link b-jump', onclick: () => go(sheet.querySelector('#sheet-title')) }, 'See your sheet'),
    h('p', { class: 'b-note' }, 'The address holds this character: copy it to share it.'));
  form.prepend(tools);
  // A printed sheet has every feature's text: closed disclosures don't print,
  // so they open for it and close again after.
  let closed = [];
  addEventListener('beforeprint', () => { closed = [...sheet.querySelectorAll('details:not([open])')]; for (const d of closed) d.open = true; });
  addEventListener('afterprint', () => { for (const d of closed) d.open = false; closed = []; });
  sheet.hidden = false;
  update();
}
