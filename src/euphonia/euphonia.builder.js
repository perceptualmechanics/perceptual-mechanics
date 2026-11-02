// The character builder: the choices on one side, the sheet they make on the
// other. Every number on the sheet is the engine's (euphonia.character.js);
// this file only asks and shows. The character lives in the address (?c=),
// so a link is the character, and this browser remembers the last one.
import srdUrl from './euphonia.srd.json?url';
import classesUrl from './euphonia.classes.json?url';
import { ABILITIES, MAX_LEVEL, rulebook, character, speciesOptions, featsAllowed, featIncrease, qualifies } from './euphonia.character.js';
import { inline, blocks } from './euphonia.markdown.js';

const STORE_KEY = 'pm-euphonia-character';
const PARAM = 'c';
const signed = n => (n >= 0 ? `+${n}` : `−${-n}`);
const blank = () => ({ name: '', species: '', option: '', size: '', background: '', increases: {}, method: 'standard', base: {}, classes: [{ class: '', level: 1, subclass: '' }], skills: {}, improvements: {} });

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
  container.replaceChildren(...children);
  if (key) container.querySelector(`[data-key="${CSS.escape(key)}"]`)?.focus();
}

export async function initBuilder(panel) {
  const form = panel.querySelector('.builder-form');
  const sheet = panel.querySelector('.sheet');
  const status = form.querySelector('.builder-status');
  let book, srd;
  try {
    const [s, e] = await Promise.all([srdUrl, classesUrl].map(u => fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })));
    srd = s; book = rulebook(s, e);
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
  const backgroundSelect = h('select', { name: 'background', 'aria-describedby': idFor('background') }, options(book.backgrounds.map(b => b.name), state.background, 'Choose a background'));
  const increases = h('div', { class: 'b-increases', role: 'group', 'aria-label': 'Ability increases', 'aria-describedby': idFor('increases') });
  const backgroundAbout = h('div', { class: 'b-about' });
  const methods = [['standard', 'Standard array'], ['point', 'Point cost'], ['rolled', 'Rolled']];
  const methodGroup = h('div', { class: 'b-choice', role: 'radiogroup', 'aria-label': 'How to generate scores' },
    methods.map(([value, label]) => h('label', {}, h('input', { type: 'radio', name: 'method', value, checked: state.method === value }), ` ${label}`)));
  const scoreGrid = h('div', { class: 'b-scores', role: 'group', 'aria-label': 'Base scores', 'aria-describedby': idFor('base') });
  const pointsLeft = h('p', { class: 'b-note', 'aria-live': 'polite' });
  const skillsBox = h('div', { class: 'b-skill-groups' });
  const featsBox = h('div', { class: 'b-feats' });

  status.remove();
  form.append(
    section('Name', h('label', { class: 'b-field' }, h('span', {}, 'Character name'), nameInput)),
    section('Class', h('p', { class: 'b-note' }, 'The first is the class you began in. Its levels and the others’ make your character level.'), classList, addClass, problemSlot('classes')),
    section('Species', h('label', { class: 'b-field' }, h('span', {}, 'Species'), speciesSelect), problemSlot('species'), optionRow, problemSlot('option'), sizeRow, problemSlot('size'), speciesTraits),
    section('Background', h('label', { class: 'b-field' }, h('span', {}, 'Background'), backgroundSelect), problemSlot('background'), increases, problemSlot('increases'), backgroundAbout),
    section('Ability scores', methodGroup, scoreGrid, pointsLeft, problemSlot('base'), problemSlot('method')),
    section('Skills', skillsBox),
    section('Feats', featsBox),
  );

  // ---------- reading the controls into the state
  const set = (mutate) => { mutate(state); update(); };
  nameInput.addEventListener('input', () => set(s => { s.name = nameInput.value; }));
  speciesSelect.addEventListener('change', () => set(s => { s.species = speciesSelect.value; s.option = ''; s.size = ''; }));
  optionSelect.addEventListener('change', () => set(s => { s.option = optionSelect.value; }));
  sizeSelect.addEventListener('change', () => set(s => { s.size = sizeSelect.value; }));
  backgroundSelect.addEventListener('change', () => set(s => { s.background = backgroundSelect.value; s.increases = {}; }));
  methodGroup.addEventListener('change', e => set(s => { s.method = e.target.value; s.base = {}; }));
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
      speciesTraits.replaceChildren(...(species ? [h('details', {}, h('summary', {}, `${species.name}: ${species.creature_type}, ${species.size}, speed ${species.speed}`),
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
        h('dt', {}, 'Feat'), h('dd', {}, bg.feat), h('dt', {}, 'Skills'), h('dd', {}, bg.skills.join(', ')),
        h('dt', {}, 'Tool'), h('dd', {}, bg.tool), h('dt', {}, 'Equipment'), h('dd', {}, bg.equipment)));
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
    const shape = result.choices.map(c => `${c.key}:${c.count}:${c.from.join()}`).join('|');
    if (skillsBox.dataset.for === shape) return;
    skillsBox.dataset.for = shape;
    rebuild(skillsBox, ...(result.choices.length ? result.choices.map(c => {
      const picked = state.skills?.[c.key] ?? [];
      const read = () => set(s => { s.skills = { ...s.skills, [c.key]: [...group.querySelectorAll('input:checked')].map(x => x.value) }; });
      const group = h('fieldset', { class: 'b-skills', 'aria-describedby': idFor(`skills:${c.key}`) },
        h('legend', {}, `${c.label}: choose ${c.count}`),
        h('div', { class: 'b-checks' }, c.from.map(skill => h('label', {}, h('input', { type: 'checkbox', value: skill, 'data-key': `skill-${c.key}-${skill}`, checked: picked.includes(skill), onchange: read }), ` ${skill}`))),
        problemSlot(`skills:${c.key}`));
      return group;
    }) : [h('p', { class: 'b-note' }, 'Your class and species bring their skill choices here.')]));
  }

  // The feats each improvement level brings, and how a feat raises scores.
  function renderFeats(result) {
    // Which feats qualify turns on the level and the scores, so they're part
    // of the shape.
    const shape = [result.level, ...ABILITIES.map(a => result.scores[a]), ...result.improvements.map(i => `${i.key}:${state.improvements?.[i.key]?.feat ?? ''}`)].join('|');
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
        const readInc = () => write(p => {
          const shapeOf = box.querySelector('input[name^="inc-shape"]:checked')?.value ?? '0';
          p.increases = {};
          for (const sel of box.querySelectorAll(`[data-shape="${shapeOf}"]`)) if (sel.value) p.increases[sel.value] = (p.increases[sel.value] ?? 0) + Number(sel.dataset.by);
          return p;
        });
        const box = h('fieldset', { class: 'b-feat', 'aria-describedby': idFor(`improvement:${imp.key}`) },
          h('legend', {}, `${imp.class} level ${imp.level}: ${imp.kind}`),
          h('label', { class: 'b-field' }, h('span', {}, 'Feat'),
            h('select', { 'data-key': `feat-${imp.key}`, onchange: e => write(() => ({ feat: e.target.value, increases: {} })) },
              options(eligible.map(f => {
                const ok = qualifies(book, f, { level: result.level, scores: result.scores, features: result.features });
                return { value: f.name, label: ok.ok ? f.name : `${f.name} (needs ${ok.why.join(' and ')})`, disabled: !ok.ok && f.name !== pick.feat };
              }), pick.feat, 'Choose a feat'))),
          inc ? h('div', { class: 'b-choice' }, inc.shapes.map((shape, k) => h('div', { class: 'b-shape' },
            inc.shapes.length > 1 ? h('label', {}, h('input', { type: 'radio', name: `inc-shape-${imp.key}`, 'data-key': `shape-${imp.key}-${k}`, value: String(k), checked: Object.values(pick.increases ?? {}).filter(Boolean).length === shape.length, onchange: readInc }), ` ${shape.map(v => `+${v}`).join(' and ')}`) : null,
            h('div', { class: 'b-pair' }, shape.map((by, j) => h('label', { class: 'b-field' }, h('span', {}, `+${by}`),
              h('select', { 'data-shape': String(k), 'data-by': by, 'data-key': `inc-${imp.key}-${k}-${j}`, onchange: readInc }, options(inc.from, Object.entries(pick.increases ?? {}).filter(([, v]) => v === by)[j]?.[0], 'Choose')))))))) : null,
          problemSlot(`improvement:${imp.key}`));
        return box;
      }) : [h('p', { class: 'b-note' }, 'Ability Score Improvements and the Epic Boon come with levels; choose their feats here.')]));
  }

  // The problems, each beside the choice it belongs to.
  function renderProblems(result) {
    const by = new Map();
    for (const p of result.problems) by.set(p.field, [...(by.get(p.field) ?? []), p.message]);
    for (const slot of form.querySelectorAll('.b-problem')) {
      const messages = [...by].filter(([f]) => idFor(f) === slot.id).flatMap(([, m]) => m);
      slot.textContent = messages.join(' ');
      slot.hidden = !messages.length;
    }
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
    const who = [result.species && `${result.species.name}${result.option ? ` (${result.option})` : ''}`, result.background?.name, classLine].filter(Boolean).join(' · ');
    const casting = result.spellcasting.length ? h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-spells' },
      h('h3', { id: 'sheet-spells' }, 'Spellcasting'),
      result.slots.some(Boolean) ? h('table', { class: 'sheet-slots' }, h('caption', {}, result.casterLevel ? `Spell slots, as a level ${result.casterLevel} multiclass spellcaster` : 'Spell slots'),
        h('thead', {}, h('tr', {}, h('th', { scope: 'row' }, 'Level'), result.slots.map((n, i) => (n ? h('th', { scope: 'col' }, String(i + 1)) : null)))),
        h('tbody', {}, h('tr', {}, h('th', { scope: 'row' }, 'Slots'), result.slots.map(n => (n ? h('td', {}, String(n)) : null))))) : null,
      result.pacts.map(p => h('p', {}, `Pact Magic (${p.class}): ${p.slots} slot${p.slots === 1 ? '' : 's'} of level ${p.level}.`)),
      h('ul', {}, result.spellcasting.map(s => h('li', {}, `${s.class}: ${s.cantrips ? `${s.cantrips} cantrips, ` : ''}${s.prepared} prepared spells, up to level ${s.highest}.`)))) : null;
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
          h('dt', {}, 'Hit points'), h('dd', {}, `${result.hp}, with ${result.hitDice.map(d => `${d.count} d${d.die}`).join(' and ') || 'no'} Hit Dice`),
          h('dt', {}, 'Armor Class without armor'), h('dd', {}, result.unarmored.map(u => `${u.ac} (${u.from})`).join('; ')),
          h('dt', {}, 'Initiative'), h('dd', {}, signed(result.initiative)),
          h('dt', {}, 'Speed'), h('dd', {}, result.speed ? `${result.speed} feet` : '—'),
          h('dt', {}, 'Size'), h('dd', {}, result.size ?? '—'),
          h('dt', {}, 'Passive Perception'), h('dd', {}, String(result.passivePerception)))),
      h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-skills' },
        h('h3', { id: 'sheet-skills' }, 'Skills'),
        h('ul', { class: 'sheet-skills' }, result.skills.map(s => h('li', { class: s.proficient ? 'is-proficient' : null },
          h('span', {}, `${s.name}`), h('span', { class: 'sheet-ability' }, ` (${s.ability.slice(0, 3)})`), h('span', { class: 'sheet-bonus' }, ` ${signed(s.bonus)}`), s.proficient ? h('span', { class: 'sheet-mark' }, ' proficient') : null)))),
      casting,
      result.feats.length ? h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-feats' },
        h('h3', { id: 'sheet-feats' }, 'Feats'),
        result.feats.map(f => det(`feat-${f.from}`, `${f.feat.name}${f.note ? ` (${f.note})` : ''}, from ${f.from}`,
          h('div', { html: blocks([f.feat.description, ...f.feat.benefits.map(b => `**${b.name}.** ${b.text}`)].filter(Boolean).join('\n\n')) })))) : null,
      result.species ? h('section', { class: 'sheet-block', 'aria-labelledby': 'sheet-traits' },
        h('h3', { id: 'sheet-traits' }, `${result.species.name} traits`),
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
    renderSkills(result);
    renderFeats(result);
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
