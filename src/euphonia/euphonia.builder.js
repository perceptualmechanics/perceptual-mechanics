// The character builder: the choices on one side, the sheet they make on the
// other. Every number on the sheet is the engine's (euphonia.character.js);
// this file only asks and shows. The character lives in the address (?c=),
// so a link is the character, and this browser remembers the last one.
import srdUrl from './euphonia.srd.json?url';
import classesUrl from './euphonia.classes.json?url';
import charactersUrl from './euphonia.characters.json?url';
import places from 'virtual:euphonia-places';
import { ABILITIES, MAX_LEVEL, rulebook, character, speciesOptions, featsAllowed, featIncrease, qualifies } from './euphonia.character.js';
import { inline, blocks } from './euphonia.markdown.js';

const STORE_KEY = 'pm-euphonia-character';
const PARAM = 'c';
const signed = n => (n >= 0 ? `+${n}` : `−${-n}`);
const blank = () => ({ name: '', species: '', option: '', size: '', background: '', increases: {}, method: 'standard', base: {}, classes: [{ class: '', level: 1, subclass: '' }], skills: {}, improvements: {}, originFeats: {}, featLists: {}, spells: {}, armor: '', shield: false, homeland: '', styles: {}, expertise: {} });

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
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...children.flat().filter(c => c !== null && c !== undefined && c !== false));
  return el;
}
const options = (values, chosen, prompt) => [
  ...(prompt ? [h('option', { value: '' }, prompt)] : []),
  ...values.map(v => (typeof v === 'string' ? h('option', { value: v, selected: v === chosen }, v) : h('option', { value: v.value, selected: v.value === chosen, disabled: v.disabled }, v.label))),
];
const idFor = field => `problem-${field.replace(/[^\w-]+/g, '-')}`;
// Rebuilding a group of controls keeps the keyboard where it was: the
// control with the same key takes focus back.
function rebuild(container, ...children) {
  const key = container.contains(document.activeElement) ? document.activeElement.dataset.key : null;
  // What a group leaves out comes as null, which isn't an element to add.
  container.replaceChildren(...children.flat().filter(c => c !== null && c !== undefined && c !== false));
  if (key) container.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus();
}

export async function initBuilder(panel) {
  const form = panel.querySelector('.builder-form');
  const sheet = panel.querySelector('.sheet');
  const status = form.querySelector('.builder-status');
  let book, srd;
  try {
    const [s, e, c] = await Promise.all([srdUrl, classesUrl, charactersUrl].map(u => fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })));
    srd = s; book = rulebook(s, e, c);
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
  // A rule's consequence of a legal choice, beside it, said and not blocked.
  const warningSlot = field => h('p', { class: 'b-warning', id: `warning-${idFor(field)}`, hidden: true });
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
  const styleBox = h('div', { class: 'b-styles' });
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
  const armorSelect = h('select', { name: 'armor', 'aria-describedby': `${idFor('armor')} warning-${idFor('armor')}` }, h('option', { value: '' }, 'No armor'),
    ['Light', 'Medium', 'Heavy'].map(cat => h('optgroup', { label: `${cat} armor` }, options(book.armor.items.filter(a => a.category === cat).map(a => a.name), state.armor))));
  const shieldCheck = h('input', { type: 'checkbox', name: 'shield', checked: Boolean(state.shield) });
  const trainingNote = h('p', { class: 'b-note' });
  const spellsBox = h('div', { class: 'b-spells' });

  status.remove();
  form.append(
    section('Name', h('label', { class: 'b-field' }, h('span', {}, 'Character name'), nameInput)),
    section('Class', h('p', { class: 'b-note' }, 'The first is the class you began in. Its levels and the others’ make your character level.'), classList, addClass, problemSlot('classes')),
    section('Species', h('label', { class: 'b-field' }, h('span', {}, 'Species'), speciesSelect), problemSlot('species'), optionRow, problemSlot('option'), sizeRow, problemSlot('size'), originBox, speciesTraits),
    section('Homeland', h('p', { class: 'b-note' }, 'Every species takes its traits as written; your people is where the family comes from, and the trouble comes with the country.'),
      h('label', { class: 'b-field' }, h('span', {}, 'Region'), homelandSelect), homelandLink),
    section('Background', h('label', { class: 'b-field' }, h('span', {}, 'Background'), backgroundSelect), problemSlot('background'), increases, problemSlot('increases'), backgroundAbout),
    section('Ability scores', methodGroup, scoreGrid, pointsLeft, problemSlot('base'), problemSlot('method')),
    section('Armour', h('label', { class: 'b-field' }, h('span', {}, 'Armor'), armorSelect), h('label', { class: 'b-check' }, shieldCheck, ' A Shield'), trainingNote, problemSlot('armor'), warningSlot('armor')),
    section('Skills', skillsBox, expertiseBox, skillNotes),
    section('Feats', styleBox, featsBox),
    section('Spells', spellsBox),
  );

  // ---------- reading the controls into the state
  const set = (mutate) => { mutate(state); update(); };
  nameInput.addEventListener('input', () => set(s => { s.name = nameInput.value; }));
  speciesSelect.addEventListener('change', () => set(s => { s.species = speciesSelect.value; s.option = ''; s.size = ''; }));
  optionSelect.addEventListener('change', () => set(s => { s.option = optionSelect.value; }));
  sizeSelect.addEventListener('change', () => set(s => { s.size = sizeSelect.value; }));
  backgroundSelect.addEventListener('change', () => set(s => { s.background = backgroundSelect.value; s.increases = {}; }));
  homelandSelect.addEventListener('change', () => set(s => { s.homeland = homelandSelect.value; }));
  methodGroup.addEventListener('change', e => set(s => { s.method = e.target.value; s.base = {}; }));
  armorSelect.addEventListener('change', () => set(s => { s.armor = armorSelect.value; }));
  shieldCheck.addEventListener('change', () => set(s => { s.shield = shieldCheck.checked; }));
  addClass.addEventListener('click', () => {
    set(s => { s.classes.push({ class: '', level: 1, subclass: '' }); });
    classList.lastElementChild?.querySelector('select')?.focus();
  });

  // The class rows: a class, its level, its subclass once it has one.
  let classShape = null;
  function renderClasses(result) {
    const shape = state.classes.map(c => c.class).join('|');
    if (shape !== classShape) {
      classShape = shape;
      rebuild(classList, ...state.classes.map((c, i) => {
        const rules = book.classNamed(c.class);
        const groups = ['Euphonia', 'SRD 5.2.1'].map(src => h('optgroup', { label: src === 'Euphonia' ? 'Euphonia’s classes' : 'The SRD’s classes' },
          options(book.classes.filter(x => x.source === src).map(x => x.name), c.class)));
        return h('li', { class: 'b-class' },
          h('label', { class: 'b-field' }, h('span', {}, i ? 'Then' : 'Class'),
            h('select', { 'data-key': `class-${i}`, 'aria-describedby': idFor('classes'), onchange: e => set(s => { s.classes[i] = { ...s.classes[i], class: e.target.value, subclass: '' }; }) }, h('option', { value: '' }, 'Choose a class'), groups)),
          h('label', { class: 'b-field b-level' }, h('span', {}, 'Level'),
            h('input', { 'data-key': `level-${i}`, type: 'number', min: 1, max: MAX_LEVEL, inputmode: 'numeric', value: c.level, oninput: e => set(s => { s.classes[i].level = Number(e.target.value); }) })),
          rules ? h('label', { class: 'b-field b-subclass' }, h('span', {}, `Subclass (from level ${rules.subclassLevel})`),
            h('select', { 'data-key': `subclass-${i}`, 'data-sub': c.class, 'aria-describedby': idFor(`subclass:${c.class}`), onchange: e => set(s => { s.classes[i].subclass = e.target.value; }) },
              options(rules.subclasses.map(x => x.name), c.subclass, 'Choose a subclass'))) : null,
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
      speciesTraits.replaceChildren(...(species ? [
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
        h('dt', {}, 'Tool'), h('dd', {}, bg.tool), h('dt', {}, 'Equipment'), h('dd', {}, bg.equipment)),
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
  function renderSkills(result) {
    const shape = result.choices.map(c => `${c.key}:${c.count}:${c.upTo}:${c.from.join()}`).join('|');
    if (skillsBox.dataset.for === shape) return;
    skillsBox.dataset.for = shape;
    rebuild(skillsBox, ...(result.choices.length ? result.choices.map(c => {
      const picked = state.skills?.[c.key] ?? [];
      const read = () => set(s => { s.skills = { ...s.skills, [c.key]: [...group.querySelectorAll('input:checked')].map(x => x.value) }; });
      const group = h('fieldset', { class: 'b-skills', 'aria-describedby': idFor(`skills:${c.key}`) },
        h('legend', {}, `${c.label}: ${c.given.length ? `${c.given.join(', ')}, plus ` : ''}choose ${c.upTo ? 'up to ' : ''}${c.count}${c.upTo ? ' (the rest tools)' : ''}`),
        h('div', { class: 'b-checks' }, c.from.map(skill => h('label', {}, h('input', { type: 'checkbox', value: skill, 'data-key': `skill-${c.key}-${skill}`, checked: picked.includes(skill), onchange: read }), ` ${skill}`))),
        problemSlot(`skills:${c.key}`));
      return group;
    }) : [h('p', { class: 'b-note' }, 'Your class and species bring their skill choices here.')]));
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
  function renderOrigin(result) {
    const shape = result.originChoices.map(c => c.key).join('|');
    if (originBox.dataset.for === shape) return;
    originBox.dataset.for = shape;
    const origin = book.feats.filter(f => f.category === 'Origin').map(f => f.name);
    rebuild(originBox, ...result.originChoices.map(c => [
      h('label', { class: 'b-field' }, h('span', {}, `${c.label}: an Origin feat`),
        h('select', { 'data-key': `origin-${c.key}`, 'aria-describedby': idFor(`origin:${c.key}`), onchange: e => set(s => { s.originFeats = { ...s.originFeats, [c.key]: e.target.value }; }) },
          options(origin, state.originFeats?.[c.key], 'Choose a feat'))),
      problemSlot(`origin:${c.key}`),
    ]).flat());
  }

  // The homeland, and a link to its chapter on the map.
  function renderHomeland() {
    const region = places.regions.find(r => r.name === state.homeland);
    homelandSelect.value = region ? region.name : '';
    homelandLink.replaceChildren(...(region ? [h('a', { href: `#${region.id}` }, `Read ${region.name}`), ' on the map.'] : []));
  }

  // The Fighting Style feats features grant, and the Expertise they ask.
  function renderStyles(result) {
    const shape = result.styleChoices.map(c => `${c.key}:${state.styles?.[c.key] ?? ''}`).join('|');
    if (styleBox.dataset.for === shape) return;
    styleBox.dataset.for = shape;
    const styles = book.feats.filter(f => f.category === 'Fighting Style').map(f => f.name);
    rebuild(styleBox, ...result.styleChoices.map(c => [
      h('label', { class: 'b-field' }, h('span', {}, `${c.label}: a Fighting Style feat`),
        h('select', { 'data-key': `style-${c.key}`, 'aria-describedby': idFor(`style:${c.key}`), onchange: e => set(s => { s.styles = { ...s.styles, [c.key]: e.target.value }; }) }, options(styles, state.styles?.[c.key], 'Choose a feat'))),
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

  // Armour: what the classes train, said beside the choice.
  function renderArmor(result) {
    armorSelect.value = state.armor ?? '';
    shieldCheck.checked = Boolean(state.shield);
    trainingNote.textContent = result.training.length
      ? `Your classes train you in ${result.training.map(t => (t === 'Shield' ? 'Shields' : `${t} armor`)).join(', ')}.`
      : 'Your classes give no armor training.';
  }

  // The spells: each caster's and each feat's, by level, as the engine
  // bounds them; a feat's list where the player chooses it.
  const openLevels = new Set();
  function renderSpells(result) {
    const shape = [...result.listChoices.map(l => `${l.from}:${l.chosen}`), ...result.spellChoices.map(c => `${c.key}:${c.cantrips}:${c.prepared}:${c.highest}:${c.chosen.map(sp => sp.name).join()}`)].join('|');
    if (spellsBox.dataset.for === shape) return;
    spellsBox.dataset.for = shape;
    for (const d of spellsBox.querySelectorAll('details[data-key]')) if (d.open) openLevels.add(d.dataset.key); else openLevels.delete(d.dataset.key);
    const lists = result.listChoices.map(l => [
      h('label', { class: 'b-field' }, h('span', {}, `${l.feat}, from ${l.from}: its spell list`),
        h('select', { 'data-key': `list-${l.from}`, 'aria-describedby': idFor(l.field), onchange: e => set(s => { s.featLists = { ...s.featLists, [l.from]: e.target.value }; }) }, options(l.lists, l.chosen, 'Choose a list'))),
      result.spellChoices.some(c => c.key === l.field.replace(/^spells:/, '')) ? null : problemSlot(l.field),
    ]).flat();
    const groups = result.spellChoices.map(c => {
      const picked = new Set(c.chosen.map(sp => sp.name));
      const read = () => set(s => { s.spells = { ...s.spells, [c.key]: [...box.querySelectorAll('input:checked')].map(x => x.value) }; });
      const levels = [...new Set(c.list.map(sp => sp.level))].sort((a, b) => a - b);
      const count = level => c.chosen.filter(sp => (level ? sp.level > 0 : sp.level === 0)).length;
      const box = h('fieldset', { class: 'b-spell-choice', 'aria-describedby': idFor(`spells:${c.key}`) },
        h('legend', {}, `${c.label}: ${c.cantrips ? `${count(0)} of ${c.cantrips} ${c.cantrips === 1 ? 'cantrip' : 'cantrips'}, ` : ''}${count(1)} of ${c.prepared} prepared ${c.prepared === 1 ? 'spell' : 'spells'}, up to level ${c.highest}`),
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
    rebuild(spellsBox, ...(lists.length || groups.length ? [...lists, ...groups] : [h('p', { class: 'b-note' }, 'Your spellcasting classes and feats bring their spells here.')]));
  }

  // The problems, each beside the choice it belongs to; the warnings and
  // notes, beside theirs.
  function renderProblems(result) {
    const by = list => {
      const out = new Map();
      for (const p of list) out.set(idFor(p.field), [...(out.get(idFor(p.field)) ?? []), p.message]);
      return out;
    };
    const problems = by(result.problems), warnings = by(result.warnings);
    for (const slot of form.querySelectorAll('.b-problem')) {
      const messages = problems.get(slot.id) ?? [];
      slot.textContent = messages.join(' ');
      slot.hidden = !messages.length;
    }
    for (const slot of form.querySelectorAll('.b-warning')) {
      const messages = warnings.get(slot.id.replace(/^warning-/, '')) ?? [];
      slot.textContent = messages.join(' ');
      slot.hidden = !messages.length;
    }
    skillNotes.replaceChildren(...result.notes.map(n => h('li', {}, n.message)));
  }

  // ---------- the sheet
  // What the export changed from the SRD, as the licence asks it be said:
  // the names it renamed, and how many passages besides.
  const renamed = srd.adapted.changes.filter(c => c.path.endsWith('/name')).map(c => c.to);
  const passages = srd.adapted.changes.length - renamed.length;
  const adaptedNote = srd.adapted.changes.length ? `Adapted to the setting's names${renamed.length ? `: ${renamed.join(', ')}` : ''}${passages ? `, and ${passages} passage${passages === 1 ? '' : 's'}` : ''}.` : '';
  const open = new Set();
  function renderSheet(result) {
    for (const d of sheet.querySelectorAll('details[data-key]')) if (d.open) open.add(d.dataset.key); else open.delete(d.dataset.key);
    const det = (key, summary, ...body) => h('details', { 'data-key': key, open: open.has(key) }, h('summary', {}, summary), ...body);
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
      h('ul', {}, result.spellcasting.map(s => h('li', {}, `${s.class}: ${s.cantrips ? `${s.cantrips} cantrips, ` : ''}${s.prepared} prepared spells, up to level ${s.highest}.`)))] : [];
    const chosenSpells = result.spellChoices.filter(c => c.chosen.length).map(c => h('div', { class: 'sheet-spell-list' },
      h('h4', {}, c.label),
      h('ul', {}, [...c.chosen].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)).map(sp => h('li', {},
        `${sp.level ? `Level ${sp.level}` : 'Cantrip'}: ${sp.name}${sp.school ? `, ${sp.school}` : ''}${sp.special && !/^[—–]$/.test(sp.special) ? ` (${sp.special})` : ''}`)))));
    sheet.replaceChildren(
      h('header', { class: 'sheet-head' },
        h('h2', { id: 'sheet-title' }, state.name.trim() || 'Your character'),
        h('p', {}, who || 'Choose a class, a species and a background.'),
        h('p', { class: 'sheet-level' }, `Level ${result.level} · Proficiency Bonus ${signed(result.bonus)} · ${result.xp.toLocaleString('en')} XP${result.nextXp ? `, the next level at ${result.nextXp.toLocaleString('en')}` : ''}`)),
      h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-abilities' },
        h('h3', { id: 'sheet-abilities' }, 'Abilities'),
        h('table', { class: 'sheet-abilities' },
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Ability'), h('th', { scope: 'col' }, 'Score'), h('th', { scope: 'col' }, 'Modifier'), h('th', { scope: 'col' }, 'Saving throw'))),
          h('tbody', {}, result.saves.map(s => h('tr', {},
            h('th', { scope: 'row' }, s.ability), h('td', {}, Number.isFinite(result.scores[s.ability]) ? String(result.scores[s.ability]) : '—'),
            h('td', {}, signed(result.mod[s.ability])), h('td', {}, `${signed(s.bonus)}${s.proficient ? ' (proficient)' : ''}`)))))),
      h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-combat' },
        h('h3', { id: 'sheet-combat' }, 'In a fight'),
        h('dl', { class: 'sheet-facts' },
          h('dt', {}, 'Hit points'), h('dd', {}, `${result.hp}${result.hpFrom.length ? ` (${result.hpFrom.map(x => `+${x.hp} from ${x.from}`).join(', ')})` : ''}, with ${result.hitDice.map(d => `${d.count} d${d.die}`).join(' and ') || 'no'} Hit Dice`),
          h('dt', {}, 'Armor Class'), h('dd', {}, `${result.armorClass.ac} (${result.armorClass.from})${result.armor ? '' : result.unarmored.length > 1 ? `; without armor, one at a time: ${result.unarmored.map(u => `${u.ac} (${u.from})`).join(', ')}` : ''}`),
          h('dt', {}, 'Initiative'), h('dd', {}, signed(result.initiative)),
          h('dt', {}, 'Speed'), h('dd', {}, result.speed ? `${result.speed} feet` : '—'),
          h('dt', {}, 'Size'), h('dd', {}, result.size ?? '—'),
          h('dt', {}, 'Passive Perception'), h('dd', {}, String(result.passivePerception))),
        result.warnings.length ? h('ul', { class: 'sheet-warnings' }, result.warnings.map(w => h('li', {}, w.message))) : null),
      h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-skills' },
        h('h3', { id: 'sheet-skills' }, 'Skills'),
        h('ul', { class: 'sheet-skills' }, result.skills.map(s => h('li', { class: s.proficient ? 'is-proficient' : null },
          h('span', {}, `${s.name}`), h('span', { class: 'sheet-ability' }, ` (${s.ability.slice(0, 3)})`), h('span', { class: 'sheet-bonus' }, ` ${signed(s.bonus)}`), s.proficient ? h('span', { class: 'sheet-mark' }, s.expertise ? ' expertise' : ' proficient') : null,
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
      result.classes.length ? h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-features' },
        h('h3', { id: 'sheet-features' }, 'Class features'),
        result.classes.map(c => h('div', { class: 'sheet-class' },
          h('h4', {}, `${c.class} ${c.level}${c.subclass ? `, ${c.subclass}` : ''}`, h('span', { class: 'sheet-source' }, ` · ${c.source}`)),
          result.features.filter(f => f.class === c.class && !(f.name === 'Ability Score Improvement' || f.name === 'Epic Boon'))
            .map(f => det(`feature-${c.class}-${f.level}-${f.name}`, `Level ${f.level}: ${f.name}${f.subclass ? ` (${f.subclass})` : ''}`, h('div', { html: blocks(f.text) })))))) : null,
      h('footer', { class: 'sheet-credit' },
        h('p', { html: inline(`Rules: ${srd.provenance.source}. ${adaptedNote}`) }),
        h('p', {}, 'Euphonia’s classes are Scott Cohen’s.')),
    );
  }

  // ---------- one pass from the choices to the page
  function update() {
    const result = character(book, state);
    renderClasses(result);
    renderSpecies(result);
    renderBackground(result);
    renderScores();
    renderOrigin(result);
    renderHomeland();
    renderStyles(result);
    renderExpertise(result);
    renderArmor(result);
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
