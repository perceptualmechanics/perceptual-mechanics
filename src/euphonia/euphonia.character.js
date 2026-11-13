// The character builder's rules: a character, as the choices that make one,
// worked out by the SRD 5.2.1 and the setting's own classes. Everything comes
// from the two exports (euphonia.srd.json, euphonia.classes.json): where a
// rule is a table the table is read, and where it is only a sentence, the
// sentence, in the SRD's own words; a sentence the engine can't read is an
// error, not a guess. Pure, so the gate (verify-euphonia-builder) runs it
// against the SRD's own worked examples.

export const ABILITIES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
export const MAX_LEVEL = 20;

const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
const number = s => (s === '—' || s === '–' || s === undefined ? 0 : Number(String(s).replace(/[,+]/g, '').replace('−', '-')));
const list = s => s.replace(/\*/g, '').split(/,\s*(?:or\s+|and\s+)?|\s+(?:or|and)\s+/).map(x => x.trim()).filter(Boolean);
const trait = (c, name) => c.traits.find(t => t.trait === name)?.value ?? '';
const listed = (items, word = 'and') => (items.length < 3 ? items.join(` ${word} `) : `${items.slice(0, -1).join(', ')} ${word} ${items.at(-1)}`);

// A class's skill choice, as either export words it: "Choose 2: A, B, or C",
// "*Choose 3:* A, B, or C", "Medicine, plus *choose 2:* A or B", "Choose any
// 3 skills".
function skillChoice(text, skills, where) {
  const plain = text.replace(/\*/g, '');
  // "Choose any 3 skills" (the SRD's Bard), or "Choose any 3" (the Courtier).
  const any = plain.match(/^Choose any (\d+)(?: skills\b|$)/);
  if (any) return { fixed: [], count: +any[1], from: skills };
  const m = plain.match(/^(?:(.+?), plus )?[Cc]hoose (\d+): (.+)$/);
  if (!m) throw new Error(`${where}: a skill choice the builder doesn't read: "${text}"`);
  const from = list(m[3]), fixed = m[1] ? list(m[1]) : [];
  for (const s of [...from, ...fixed]) if (!skills.includes(s)) throw new Error(`${where}: "${s}" isn't a skill`);
  return { fixed, count: +m[2], from };
}

// A skill a sentence grants: "proficiency in the Insight, Perception, or
// Survival skill" (or "proficiency with Longbows and in the Animal Handling
// skill"), "proficiency in one skill of your choice", or "…of your choice
// from the Ranger’s skill list" (the setting writes a straight apostrophe),
// or "from the skill list available to Barbarians at level 1".
function skillGrant(text, skills, classFrom) {
  const named = text.match(/proficiency (?:with [^.]+? and )?in the ([A-Z][\w ,]+?) skill\b/);
  if (named) return list(named[1]);
  if (/proficiency in one skill of your choice from the .+?[’']s skill list/.test(text) || /proficiency in another skill of your choice from the skill list available to \w+ at level 1/.test(text)) return classFrom;
  if (/proficiency in one skill of your choice/.test(text)) return skills;
  return null;
}

// Options a class takes as its table counts them, written into a feature as
// ***Name (Art, Art).*** entries under "**From Courtier level 11**" headings:
// the Courtier's accomplishments. Read for the column that counts them, the
// name the feature gives one ("You gain two accomplishments from the list
// below"), and each option's level, the arts it can count as, how often it
// can be taken ("twice", "more than once") and its text. A subclass's lead
// says the art it gives up ("Its price: it forgoes Letters", or "forgoes no
// art"), and a subclass feature can give an option outright ("You have The
// Code without spending an accomplishment on it").
function optionsOf(c) {
  if (c.options?.length) return sectionOptions(c);
  const f = c.features.find(x => /^\*\*From .+? level \d+\*\*$/m.test(x.text));
  if (!f) return null;
  const column = f.text.match(/as shown in the ([\w' ]+) column of the/)?.[1];
  const noun = f.text.match(/You gain \w+ (\w+?)s from the list below/)?.[1];
  if (!column || !c.table.columns.includes(column) || !noun) throw new Error(`${c.name}: ${f.name} lists options the builder can't count`);
  const list = [];
  for (const g of f.text.matchAll(/^\*\*From .+? level (\d+)\*\*$([\s\S]*?)(?=^\*\*From |(?![\s\S]))/gm)) {
    for (const o of g[2].matchAll(/^\*\*\*(.+?) \(([^)]+)\)\.\*\*\* (.+)$/gm)) {
      const repeat = new RegExp(`can take this ${noun} twice`).test(o[3]) ? 2 : new RegExp(`can take this ${noun} more than once`).test(o[3]) ? Infinity : 1;
      list.push({ name: o[1], arts: o[2].split(/,\s*/), level: +g[1], repeat, text: o[3] });
    }
  }
  if (!list.length) throw new Error(`${c.name}: ${f.name} names no options the builder can read`);
  const forgoes = Object.fromEntries(c.subclasses.map(s => {
    const art = s.lead?.match(/it forgoes (\w+)\./)?.[1];
    if (!art && !/forgoes no art/.test(s.lead ?? '')) throw new Error(`${c.name}: the ${s.name} subclass doesn't say which art it forgoes`);
    return [s.name, art ?? null];
  }));
  const given = Object.fromEntries(c.subclasses.map(s => [s.name, s.features.flatMap(x => [...x.text.matchAll(new RegExp(`You have ([A-Z][\\w' ]+?) without spending an? ${noun} on it`, 'g'))].map(m => {
    if (!list.some(o => o.name === m[1])) throw new Error(`${c.name}: ${s.name} gives "${m[1]}", which isn't one of its ${noun}s`);
    return { name: m[1], level: x.level, from: x.name };
  }))]));
  return { feature: f.name, column, noun, list, forgoes, given };
}
// Or as the SRD's classes keep them: a section of their own ("Metamagic
// Options") that a feature names, the feature saying how many ("you gain two
// Metamagic options of your choice", "one invocation") and how many more: by
// a column ("as shown in the Invocations column") or at levels it names
// ("two more at Sorcerer level 10"). Each option is open from the level its
// prerequisite names ("Level 5+ Warlock"), needs the invocations it names
// ("Pact of the Blade Invocation"), and can be taken again if it says it's
// Repeatable. What else a prerequisite asks ("a Warlock Cantrip That Deals
// Damage") the export doesn't carry, so it's said, not checked.
const soft = t => t.replace(/\u00ad/g, '');
function sectionOptions(c) {
  if (c.options.length > 1) throw new Error(`${c.name}: more than one options section`);
  const sec = c.options[0], title = soft(sec.title);
  const f = c.features.find(x => soft(x.text).includes(`“${title}”`));
  if (!f) throw new Error(`${c.name}: no feature names its "${title}"`);
  const text = soft(f.text);
  const first = text.match(/you gain (\w+) ([\w ]+?) of your choice/i);
  if (!first || NUMBERS.indexOf(first[1]) < 1) throw new Error(`${c.name}: ${f.name} doesn't say how many it gives`);
  const named = text.match(/as shown in the ([\w' ]+) column of the/)?.[1];
  const column = named ? c.table.columns.find(k => k === named || k.endsWith(` ${named}`)) : null;
  if (named && !column) throw new Error(`${c.name}: ${f.name} names a column, "${named}", its table doesn't have`);
  const more = [...text.matchAll(/(\w+) more(?: options)? at \w+ level (\d+)/g)].map(m => ({ count: NUMBERS.indexOf(m[1]), level: +m[2] }));
  const list = sec.items.map(o => {
    const parts = (o.prerequisite ?? '').split(/,\s*/).filter(Boolean);
    const level = +(parts.map(x => x.match(/^Level (\d+)\+ /)?.[1]).find(Boolean) ?? 1);
    const requires = parts.map(x => x.match(/^(.+) Invocation$/)?.[1]).filter(Boolean);
    const needs = parts.filter(x => !/^Level \d+\+ /.test(x) && !/ Invocation$/.test(x));
    return { name: o.name, arts: [], level, requires, needs, cost: o.cost ?? null, prerequisite: o.prerequisite ?? null, repeat: /\*\*Repeatable\.\*\*/.test(o.text) ? Infinity : 1, text: o.text };
  });
  for (const o of list) for (const r of o.requires) if (!list.some(x => x.name === r)) throw new Error(`${c.name}: ${o.name} needs "${r}", which isn't one of its options`);
  return { feature: f.name, column, base: NUMBERS.indexOf(first[1]), more, noun: first[2].replace(/s$/, ''), list, forgoes: {}, given: {} };
}

// The rules as the builder uses them: the SRD's tables and options, every
// class and background, the SRD's and the setting's own, in one shape, and
// where the setting places each species. `added` holds the subclasses the
// books add to the SRD's classes.
export function rulebook(srd, euphonia, setting, added) {
  const skills = srd.tables.skills.map(r => r.Skill);
  const modifiers = srd.tables.ability_modifiers.map(r => {
    const [lo, hi = lo] = r.Score.split('–').map(Number);
    return { lo, hi, mod: number(r.Modifier) };
  });
  // A setting class with a class feature withheld (a placeholder the master
  // hasn't filled yet) is still being written: the builder names it and
  // doesn't offer it until its features are whole (Scott, 9 November). The
  // export names a withheld class feature by its heading ("Level 9: Reach
  // Beyond") or, where the heading itself names a placeholder, as "level 9
  // feature"; a subclass's carry the subclass between.
  const classUnit = /^(?:level \d+ feature|Level \d+: .+|As a Multiclass Character)$/;
  const unfinished = euphonia.data.map(c => c.name).filter(name => euphonia.withheld.some(w => {
    const [cls, unit, ...rest] = w.where.split(' · ');
    return cls === name && !rest.length && classUnit.test(unit);
  }));
  const classes = [...srd.classes.map(c => ({ ...c, source: 'SRD 5.2.1' })), ...euphonia.data.filter(c => !unfinished.includes(c.name)).map(c => ({ ...c, source: 'Euphonia' }))].map(c => {
    const die = number(trait(c, 'Hit Point Die').match(/^D(\d+) per /)?.[1]);
    if (!die) throw new Error(`${c.name}: no Hit Point Die`);
    const saves = trait(c, 'Saving Throw Proficiencies').split(' and ');
    // The feature that grants the subclass comes at the level the subclasses'
    // own features begin, and names each of them: read from the class's
    // structure, not the SRD's wording, which the setting's classes needn't
    // keep (the Courtier gains "a Courtier College of your choice").
    const first = Math.min(...c.subclasses.flatMap(s => s.features.map(f => f.level)));
    const grants = c.features.filter(f => f.level === first && c.subclasses.every(s => f.text.includes(s.name.replace(/^The /, ''))));
    if (grants.length !== 1) throw new Error(`${c.name}: ${grants.length} features grant a subclass`);
    const choice = skillChoice(trait(c, 'Skill Proficiencies'), skills, c.name);
    const slotLevels = c.table.columns.filter(k => /^\d$/.test(k)).map(Number);
    // Its spell list, by level, in one shape for both exports (the SRD's
    // carry a school and C, R or M; the setting's say which are new).
    const spells = Object.entries(c.spells ?? {}).flatMap(([level, list]) => list.map(sp => ({ ...sp, level: +level })));
    // A caster that knows its spells counts them in Spells Known, as the
    // Courtier does; its Cantrips paragraph can name ones it always knows
    // ("You know *Prestidigitation*, *Mending*, and *Message* … and two
    // cantrips of your choice"), besides those it chooses.
    const spellsColumn = c.table.columns.includes('Spells Known') ? 'Spells Known' : 'Prepared Spells';
    const cantripLine = c.table.columns.includes('Cantrips') ? null : c.features.map(f => f.text.match(/\*\*Cantrips\.\*\* You know (.+?), and (\w+) cantrips of your choice from the .+? spell list/)).find(Boolean);
    // The feature that lists the options keeps its own rules; the options
    // themselves are choices, each a feature of its own once taken.
    const choices = optionsOf(c);
    const inline = f => f.text.search(/^\*\*From .+? level \d+\*\*$/m);
    const features = c.features.map(f => (f.name === choices?.feature && inline(f) >= 0 ? { ...f, text: f.text.slice(0, inline(f)).trim() } : f));
    return {
      ...c, features, die, saves, skills: choice, subclassLevel: grants[0].level, spellList: spells,
      // Its subclasses, the setting's first: an SRD class takes the books'
      // beside its own, found after the feature that grants them, whose text
      // names only the SRD's. Each says where it's from.
      subclasses: [...(c.source === 'SRD 5.2.1' ? added.data.filter(s => s.class_name === c.name).map(s => ({ ...s, source: 'Euphonia' })) : []),
        ...c.subclasses.map(s => ({ ...s, source: c.source }))],
      // The levels that bring a feat: an Ability Score Improvement, or the
      // Epic Boon at 19.
      improvements: c.table.rows.flatMap(r => (r['Class Features'] ?? '').split(/,\s*/).filter(n => n === 'Ability Score Improvement' || n === 'Epic Boon').map(kind => ({ level: number(r.Level), kind }))),
      slotLevels,
      spellsColumn,
      // With no Cantrips column, its cantrips are what its features grant by
      // the class's level: "two cantrips of your choice from the Revelator
      // spell list" (Planar Adept), or the Courtier's Cantrips paragraph.
      cantripGrants: c.table.columns.includes('Cantrips') ? null : c.features.flatMap(f => [...f.text.matchAll(/\b(\w+) cantrips of your choice from the (.+?) spell list/g)]
        .filter(m => m[2] === c.name).map(m => {
          if (NUMBERS.indexOf(m[1]) < 1) throw new Error(`${c.name}: ${f.name} grants "${m[1]}" cantrips, a count the builder doesn't read`);
          return { level: f.level, count: NUMBERS.indexOf(m[1]) };
        })),
      givenCantrips: cantripLine ? [...cantripLine[1].matchAll(/\*([^*]+)\*/g)].map(m => m[1]) : [],
      choices,
      pact: c.table.columns.includes('Slot Level'),
      multiclassSkills: skillGrant(c.multiclass.gains, skills, choice.from),
    };
  });
  return {
    skills: srd.tables.skills.map(r => ({ name: r.Skill, ability: r.Ability })),
    modifier: score => {
      const band = modifiers.find(b => score >= b.lo && score <= b.hi);
      // The table runs from 3; a score below it follows the table's rule,
      // which the gate holds it to.
      return band ? band.mod : Math.floor((score - 10) / 2);
    },
    advancement: srd.tables.advancement.map(r => ({ level: number(r.Level), xp: number(r['Experience Points']), bonus: number(r['Proficiency Bonus']) })),
    multiclassSlots: srd.tables.multiclass_slots.map(r => Array.from({ length: 9 }, (_, i) => number(r[i + 1]))),
    pointCosts: new Map(srd.tables.point_costs.map(r => [number(r.Score), number(r.Cost)])),
    standardArray: srd.ability_scores.standard_array,
    pointBudget: srd.ability_scores.point_budget,
    backgroundIncreases: srd.ability_scores.background,
    species: srd.species, feats: srd.feats, armor: srd.armor, weapons: srd.weapons, languages: srd.languages, classes,
    backgrounds: [...srd.backgrounds.map(b => ({ ...b, source: 'SRD 5.2.1' })), ...setting.data.backgrounds.map(b => ({ ...b, source: 'Euphonia' }))],
    placement: name => {
      const row = setting.data.species.find(x => x.species.includes(name));
      return row ? { line: row.line, status: setting.data.species_status } : null;
    },
    classNamed: name => classes.find(c => c.name === name),
    unfinished,
  };
}

// The feats a level's improvement can be: an Ability Score Improvement any
// General feat; the Epic Boon an Epic Boon feat too. Whether the character
// qualifies is qualifies()'s.
export function featsAllowed(book, kind) {
  return book.feats.filter(f => f.category === 'General' || (kind === 'Epic Boon' && f.category === 'Epic Boon'));
}

// A feat's prerequisite, as the SRD words them: a level, a score ("Strength
// or Dexterity 13+"), a feature.
export function qualifies(book, feat, { level, scores, features }) {
  const why = [];
  for (const part of (feat.prerequisite ?? '').split(/,\s*/).filter(Boolean)) {
    const lv = part.match(/^Level (\d+)\+$/);
    const score = part.match(/^([A-Z]\w+(?: or [A-Z]\w+)*) (\d+)\+$/);
    const feature = part.match(/^(.+) Feature$/);
    if (lv) { if (level < +lv[1]) why.push(`level ${lv[1]}`); }
    else if (score) { if (!score[1].split(' or ').some(a => scores?.[a] >= +score[2])) why.push(`${score[1]} ${score[2]}`); }
    else if (feature) { if (!features?.some(f => f.name === feature[1])) why.push(`the ${feature[1]} feature`); }
    else throw new Error(`${feat.name}: a prerequisite the builder doesn't read: "${part}"`);
  }
  return { ok: !why.length, why };
}

// An ability increase a feat gives, from its own words: the Ability Score
// Improvement's "by 2, or … two … by 1", or a feat's Ability Score Increase
// ("Increase your Strength or Dexterity score by 1, to a maximum of 20").
export function featIncrease(feat) {
  if (feat.asi) return { from: feat.asi.from, shapes: [[feat.asi.by]], max: feat.asi.max };
  const m = feat.description?.match(/Increase one ability score of your choice by (\d+), or increase two ability scores of your choice by (\d+)\. This feat can’t increase an ability score above (\d+)\./);
  return m ? { from: ABILITIES, shapes: [[+m[1]], [+m[2], +m[2]]], max: +m[3] } : null;
}

// Whether increases fit one of the shapes a rule allows (one score by 2, or
// two by 1), among the abilities it names.
function fits(increases, from, shapes) {
  const given = Object.entries(increases ?? {}).filter(([, v]) => v);
  if (!given.every(([a]) => from.includes(a))) return false;
  const values = given.map(([, v]) => v).sort((a, b) => b - a);
  return shapes.some(s => s.length === values.length && [...s].sort((a, b) => b - a).every((v, i) => v === values[i]));
}

// A species' one choice, where it has one: a row of the table a trait names
// (Elven Lineages, Draconic Ancestors) or one of a trait's options (Gnomish
// Lineage, Giant Ancestry).
export function speciesOptions(species) {
  const [table, rows] = Object.entries(species?.tables ?? {})[0] ?? [];
  if (table) return { label: table.replace(/s$/, ''), names: rows.map(r => Object.values(r)[0]) };
  const t = species?.traits.find(x => x.options);
  return t ? { label: t.name, names: t.options.map(o => o.name) } : null;
}

// The level the Multiclass Spellcaster table is read at: each class's
// levels, all or half as its count says.
export function casterLevel(classes) {
  let n = 0;
  for (const { rules, level } of classes) {
    const { fraction, round } = rules.multiclass.spell_slots ?? {};
    if (fraction) n += fraction === 1 ? level : round === 'up' ? Math.ceil(level * fraction) : Math.floor(level * fraction);
  }
  return n;
}

// A character, worked out. `state` is the choices, as the builder saves them;
// what's missing or broken comes back as problems, keyed to the choice they
// belong to, and everything that can still be worked out is.
export function character(book, state) {
  // Problems stop a character being built as chosen; warnings are the rules'
  // consequences of a legal choice (armour without training), and notes are
  // facts worth saying (a skill granted twice).
  const problems = [], warnings = [], notes = [];
  const fail = (field, message) => problems.push({ field, message });
  const warn = (field, message) => warnings.push({ field, message });
  const species = book.species.find(s => s.name === state.species) ?? null;
  const background = book.backgrounds.find(b => b.name === state.background) ?? null;
  if (!species) fail('species', 'Choose a species.');
  if (!background) fail('background', 'Choose a background.');

  // The base scores, by the method chosen.
  const base = Object.fromEntries(ABILITIES.map(a => [a, Number(state.base?.[a])]));
  const given = ABILITIES.map(a => base[a]);
  if (state.method === 'standard') {
    const sorted = [...given].sort((a, b) => b - a), array = [...book.standardArray].sort((a, b) => b - a);
    if (!sorted.every((v, i) => v === array[i])) fail('base', `Give each ability one of the standard array's scores: ${book.standardArray.join(', ')}.`);
  } else if (state.method === 'point') {
    if (!given.every(v => book.pointCosts.has(v))) fail('base', `Point Cost buys scores from ${Math.min(...book.pointCosts.keys())} to ${Math.max(...book.pointCosts.keys())}.`);
    else {
      const spent = given.reduce((n, v) => n + book.pointCosts.get(v), 0);
      if (spent > book.pointBudget) fail('base', `That costs ${spent} points; you have ${book.pointBudget}.`);
    }
  } else if (state.method === 'rolled') {
    // Four d6, the highest three: 3 to 18.
    if (!given.every(v => Number.isInteger(v) && v >= 3 && v <= 18)) fail('base', 'Rolled scores run from 3 to 18.');
  } else fail('method', 'Choose how to generate your scores.');

  // The background's increases.
  const scores = { ...base };
  const raise = (increases, max) => { for (const [a, v] of Object.entries(increases ?? {})) if (v) scores[a] = Math.min(max, scores[a] + v); };
  if (background) {
    const rule = book.backgroundIncreases;
    if (!fits(state.increases, background.ability_scores, rule.choices)) fail('increases', `Increase one of ${background.ability_scores.join(', ')} by ${rule.choices[0][0]} and another by ${rule.choices[0][1]}, or all three by ${rule.choices[1][0]}.`);
    for (const [a, v] of Object.entries(state.increases ?? {})) if (v && base[a] + v > rule.max) fail('increases', `${a} would rise above ${rule.max}.`);
    raise(state.increases, rule.max);
  }

  // The classes, the first the one the character began in.
  const classes = (state.classes ?? []).map(c => ({ ...c, rules: book.classNamed(c.class) }));
  for (const c of classes) if (c.class && !c.rules) fail('classes', `There's no class "${c.class}".`);
  const known = classes.filter(c => c.rules);
  if (!known.length) fail('classes', 'Choose a class.');
  if (new Set(known.map(c => c.class)).size !== known.length) fail('classes', 'Each class can be taken once; give it more levels instead.');
  for (const c of known) if (!(Number.isInteger(c.level) && c.level >= 1)) fail('classes', `Give ${c.class} a level of 1 or more.`);
  const level = known.reduce((n, c) => n + (c.level || 0), 0);
  if (level > MAX_LEVEL) fail('classes', `That's level ${level}; characters go up to ${MAX_LEVEL}.`);
  const total = Math.min(Math.max(level, 1), MAX_LEVEL);
  const advancement = book.advancement[total - 1];

  // Each class's features to its level, its subclass's from the level it
  // grants one, and the feats its improvement levels bring.
  const features = [];
  const improvements = [];
  for (const c of known) {
    for (const f of c.rules.features) if (f.level <= c.level) features.push({ class: c.class, level: f.level, name: f.name, text: f.text });
    if (c.level >= c.rules.subclassLevel) {
      const sub = c.rules.subclasses.find(s => s.name === c.subclass);
      if (!sub) fail(`subclass:${c.class}`, `Choose a ${c.class} subclass.`);
      else for (const f of sub.features) if (f.level <= c.level) features.push({ class: c.class, subclass: sub.name, level: f.level, name: f.name, text: f.text });
    } else if (c.subclass) fail(`subclass:${c.class}`, `${c.class} gains a subclass at level ${c.rules.subclassLevel}.`);
    for (const imp of c.rules.improvements) if (imp.level <= c.level) improvements.push({ key: `${c.class} ${imp.level}`, class: c.class, ...imp });
  }
  // The options a class's table counts (the Courtier's accomplishments): as
  // many as its column says at its level, each from those its level opens
  // and its subclass hasn't closed, as often as each allows, besides any its
  // subclass gives. Each counts as one of its arts, the player's choice where
  // two are left, and Regard is how many different arts they make. Each one
  // taken is a feature from then on, so what it grants is read as any
  // feature's is.
  const optionChoices = [];
  for (const c of known) {
    const o = c.rules.choices;
    if (!o) continue;
    const sub = c.level >= c.rules.subclassLevel ? c.rules.subclasses.find(x => x.name === c.subclass) : null;
    const forgone = sub ? o.forgoes[sub.name] : null;
    const artsOf = x => x.arts.filter(a => a !== forgone);
    const open = o.list.filter(x => x.level <= c.level && (!x.arts.length || artsOf(x).length));
    const count = o.column ? number(c.rules.table.rows[c.level - 1]?.[o.column]) : o.base + o.more.filter(m => c.level >= m.level).reduce((n, m) => n + m.count, 0);
    const artOf = (x, chosen, field) => {
      const arts = artsOf(x), art = arts.length === 1 ? arts[0] : chosen;
      if (!arts.includes(art)) fail(field, `Choose which art ${x.name} counts as: ${arts.join(' or ')}.`);
      return arts.includes(art) ? art : null;
    };
    const given = (sub ? o.given[sub.name] ?? [] : []).filter(g => g.level <= c.level).map(g => {
      const x = o.list.find(y => y.name === g.name), field = `option:${c.class}:given:${g.name}`;
      return { ...x, from: g.from, field, art: artOf(x, state.optionArts?.[`${c.class} ${g.name}`], field) };
    });
    const picks = state.options?.[c.class] ?? [];
    const taken = [];
    for (let i = 0; i < count; i++) {
      const field = `option:${c.class}:${i}`, pick = picks[i];
      const x = open.find(y => y.name === pick?.name);
      if (!x) { fail(field, pick?.name ? `${pick.name} isn't open to a level ${c.level} ${c.class}${forgone ? ` of ${sub.name}, which forgoes ${forgone}` : ''}.` : `Choose ${o.noun} ${i + 1} of ${count}.`); continue; }
      const had = [...given, ...taken].filter(t => t.name === x.name).length;
      if (had >= x.repeat) { fail(field, `${x.name} can be taken ${x.repeat === 1 ? 'once' : 'twice'}${given.some(g => g.name === x.name) ? `, and ${given.find(g => g.name === x.name).from} gives it` : ''}.`); continue; }
      taken.push({ ...x, field, index: i, art: x.arts.length ? artOf(x, pick.art, field) : null });
    }
    // An option that needs another ("Pact of the Blade Invocation") needs it
    // among those taken.
    for (const t of taken) for (const r of t.requires ?? []) if (![...given, ...taken].some(x => x.name === r)) fail(t.field, `${t.name} needs ${r}.`);
    const regard = new Set([...given, ...taken].map(t => t.art).filter(Boolean)).size;
    optionChoices.push({ class: c.class, noun: o.noun, column: o.column, count, open, forgone, subclass: sub?.name ?? null, given, taken, regard, arts: [...new Set(o.list.flatMap(x => x.arts))] });
    for (const t of [...given, ...taken]) features.push({ class: c.class, level: t.level, name: t.name, text: t.text, key: `${c.class} ${o.noun} ${t.index ?? t.name}`, option: o.noun, label: t.index === undefined ? `${t.name} (from ${t.from})` : `${t.name} (${c.class} ${o.noun} ${t.index + 1})` });
  }
  // A feature that offers "one of the following … of your choice", each a
  // named paragraph (the Cleric's Divine Order, the Druid's Elemental Fury):
  // the player's, and the one chosen a feature from then on. One whose
  // choices are a list ("you learn one of the following facts about it of
  // your choice", then items) is chosen in play, each time, not here; one of
  // "the following skills" is a skill choice, read with the skills; one named
  // in its own sentence ("one of the following tools of your choice:
  // Cartographer's Tools, Mason's Tools, or Navigator's Tools") is a tool,
  // which the sheet shows as text, as it shows a background's.
  const pickChoices = [];
  for (const f of [...features]) {
    const offers = f.text.match(/\bone of the following (?:[\w ]+ )?of your choice(?:[^.\n]*)[.:]\s*(\S)?/);
    if (!offers || /one of the following skills/.test(f.text) || offers[1] !== '*') continue;
    const offered = [...f.text.matchAll(/^\*\*([^*]+?)\.\*\* (.+)$/gm)].map(m => ({ name: m[1], text: m[2] }));
    if (offered.length < 2) throw new Error(`${f.name}: "one of the following" names ${offered.length} option(s)`);
    const key = `${f.class} ${f.level} ${f.name}`, chosen = offered.find(x => x.name === state.picks?.[key]);
    // The feature keeps its lead; its options are the choice, the one taken a
    // feature of its own, so nothing reads the one not taken.
    f.text = f.text.split('\n\n').filter(p => !offered.some(x => p.startsWith(`**${x.name}.**`))).join('\n\n');
    pickChoices.push({ key, label: `${f.name} (${f.class} ${f.level})`, offered, chosen: chosen?.name ?? null });
    if (!chosen) { fail(`pick:${key}`, `Choose ${listed(offered.map(x => x.name), 'or')} for ${f.name}.`); continue; }
    features.push({ class: f.class, level: f.level, name: `${f.name}: ${chosen.name}`, text: chosen.text, key: `${key} ${chosen.name}` });
  }
  // In the order they come: by level, and at one level the class's before
  // its subclass's (the sort is stable, and they were gathered that way).
  features.sort((a, b) => a.level - b.level);

  // The feats: the background's, then each improvement's, in order, so a
  // feat's increase counts toward the next one's prerequisite.
  const feats = [];
  // A background's feat, and in its parentheses the lists it allows: "Magic
  // Initiate (Cleric)", or "(Cleric or Wizard, your choice)".
  if (background) {
    const [, name, note] = background.feat.match(/^(.+?)(?: \((.+)\))?$/);
    const feat = book.feats.find(f => f.name === name);
    if (!feat) fail('background', `${background.name}'s feat "${name}" isn't one the builder has.`);
    else feats.push({ from: background.name, feat, note: note ?? null, lists: note ? note.replace(/, your choice$/, '').split(/,\s*(?:or\s+)?|\s+or\s+/) : null });
  }
  for (const imp of improvements) {
    const pick = state.improvements?.[imp.key];
    const feat = book.feats.find(f => f.name === pick?.feat);
    if (!feat) { fail(`improvement:${imp.key}`, `Choose a feat for ${imp.class} level ${imp.level}.`); continue; }
    const allowed = featsAllowed(book, imp.kind).includes(feat);
    const ok = qualifies(book, feat, { level: total, scores, features });
    if (!allowed) fail(`improvement:${imp.key}`, `${feat.name} isn't a feat ${imp.kind === 'Epic Boon' ? 'an Epic Boon' : 'an Ability Score Improvement'} can be.`);
    else if (!ok.ok) fail(`improvement:${imp.key}`, `${feat.name} needs ${ok.why.join(' and ')}.`);
    if (!feat.repeatable && feats.some(f => f.feat.name === feat.name)) fail(`improvement:${imp.key}`, `${feat.name} can be taken once.`);
    const inc = featIncrease(feat);
    if (inc) {
      if (!fits(pick.increases, inc.from, inc.shapes)) fail(`improvement:${imp.key}`, `Choose how ${feat.name} raises your scores.`);
      else raise(pick.increases, inc.max);
    }
    feats.push({ from: `${imp.class} ${imp.level}`, feat });
  }
  // A feature that grants "a Fighting Style feat of your choice" (or
  // "another"): a feat from that category, the player's.
  const styleChoices = [];
  for (const f of features) {
    if (!/gain (?:a|another) Fighting Style feat of your choice/.test(f.text)) continue;
    const key = f.key ?? `${f.class} ${f.level} ${f.name}`, from = `${f.class} ${f.level}`;
    styleChoices.push({ key, label: f.label ?? `${f.name} (${from})` });
    const feat = book.feats.find(x => x.name === state.styles?.[key] && x.category === 'Fighting Style');
    if (!feat) { fail(`style:${key}`, `Choose a Fighting Style feat for ${f.name}.`); continue; }
    if (feats.some(x => x.feat.name === feat.name)) fail(`style:${key}`, `${feat.name} is already yours; choose another.`);
    feats.push({ from, feat });
  }
  // A trait that grants an Origin feat of the player's choice (the Human's
  // Versatile).
  // Or a feature, as the Warlock's Lessons of the First Ones ("allowing you
  // to gain one Origin feat of your choice").
  const originChoices = [];
  const grantsOrigin = [...(species?.traits ?? []).filter(t => /^You gain an Origin feat of your choice\b/.test(t.text)).map(t => ({ key: `${species.name} ${t.name}`, from: `${t.name} (${species.name})`, name: t.name, source: 'species' })),
    ...features.filter(f => /gain one Origin feat of your choice/.test(f.text)).map(f => ({ key: f.key ?? `${f.class} ${f.level} ${f.name}`, from: f.label ?? `${f.name} (${f.class})`, name: f.name, source: 'feature' }))];
  for (const t of grantsOrigin) {
    const { key, from } = t;
    originChoices.push({ key, label: from, source: t.source });
    const feat = book.feats.find(f => f.name === state.originFeats?.[key] && f.category === 'Origin');
    if (!feat) { fail(`origin:${key}`, `Choose an Origin feat for ${t.name}.`); continue; }
    if (!feat.repeatable && feats.some(f => f.feat.name === feat.name)) fail(`origin:${key}`, `${feat.name} can be taken once.`);
    feats.push({ from, feat });
  }

  const mod = Object.fromEntries(ABILITIES.map(a => [a, book.modifier(scores[a])]));

  // Multiclassing: every class's primary ability at 13 or more, the one the
  // character began in included, checked against the scores shown.
  if (known.length > 1) {
    for (const c of known) {
      const { abilities, any, score } = c.rules.multiclass;
      const met = any ? abilities.some(a => scores[a] >= score) : abilities.every(a => scores[a] >= score);
      if (!met) fail('classes', `Multiclassing needs ${abilities.join(any ? ' or ' : ' and ')} ${score} or more, for ${c.class}.`);
    }
  }

  // Proficiencies: the first class's saves and skills; a later class's
  // skill, the background's, and what the species' traits grant.
  const first = known[0]?.rules ?? null;
  const saves = first?.saves ?? [];
  const sources = new Map(), choices = [];
  const grant = (skill, source) => sources.set(skill, [...(sources.get(skill) ?? []), source]);
  // A grant of one named skill is given; a choice of several is the
  // player's, and the builder asks it as the engine lists it. A feat's
  // "any combination of three skills or tools" is up to three skills, the
  // rest tools.
  const chosen = (key, from, count, picks, label, upTo = false, given = []) => {
    if (from.length === count && !upTo) { for (const s of from) grant(s, label); return; }
    choices.push({ key, label, from, count, upTo, given });
    const got = (picks ?? []).filter(Boolean);
    if ((upTo ? got.length > count : got.length !== count) || new Set(got).size !== got.length || !got.every(s => from.includes(s))) fail(`skills:${key}`, `Choose ${upTo ? 'up to ' : ''}${count} skill${count === 1 ? '' : 's'}${from.length < book.skills.length ? ` from ${from.join(', ')}` : ''}.`);
    for (const s of got.filter(x => from.includes(x))) grant(s, label);
  };
  if (first) { for (const s of first.skills.fixed) grant(s, first.name); chosen(first.name, first.skills.from, first.skills.count, state.skills?.[first.name], first.name, false, first.skills.fixed); }
  for (const c of known.slice(1)) if (c.rules.multiclassSkills) chosen(c.class, c.rules.multiclassSkills, 1, state.skills?.[c.class], `${c.class}, as a multiclass`);
  for (const s of background?.skills ?? []) grant(s, background.name);
  if (background?.skill_choice) chosen(`${background.name} skills`, background.skill_choice.from, background.skill_choice.count, state.skills?.[`${background.name} skills`], background.name);
  if (species) {
    for (const t of species.traits) {
      const from = skillGrant(t.text, book.skills.map(s => s.name));
      if (from) chosen(`${species.name} ${t.name}`, from, 1, state.skills?.[`${species.name} ${t.name}`], `${t.name} (${species.name})`);
    }
  }
  // What a feature grants in skills, as it words it: "proficiency in two of
  // these skills: Deception, Insight, Intimidation, or Persuasion", or a
  // skill named, or one of several named.
  for (const f of features) {
    const key = f.key ?? `${f.class} ${f.level} ${f.name}`, label = f.label ?? `${f.name} (${f.class} ${f.level})`;
    const some = f.text.match(/You gain proficiency in (\w+) of (?:these skills|the following skills of your choice): (.+?)\./);
    if (some) {
      if (NUMBERS.indexOf(some[1]) < 1) throw new Error(`${f.name}: a skill count the builder doesn't read: "${some[1]}"`);
      chosen(key, list(some[2]), NUMBERS.indexOf(some[1]), state.skills?.[key], label);
      continue;
    }
    const from = skillGrant(f.text, book.skills.map(s => s.name), book.classNamed(f.class)?.skills.from);
    if (from) chosen(key, from, 1, state.skills?.[key], label);
  }
  for (const f of feats) {
    const m = [f.feat.description, ...f.feat.benefits.map(b => b.text)].join(' ').match(/proficiency in any combination of (\w+) skills or tools of your choice/);
    if (!m) continue;
    const count = NUMBERS.indexOf(m[1]);
    if (count < 1) throw new Error(`${f.feat.name}: "${m[1]}" isn't a number the builder reads`);
    chosen(`feat ${f.from}`, book.skills.map(s => s.name), count, state.skills?.[`feat ${f.from}`], `${f.feat.name}, from ${f.from}`, true);
  }
  for (const [skill, from] of sources) if (from.length > 1) notes.push({ field: 'skills', message: `${skill} comes from ${from.join(' and ')}; proficiency counts once.` });
  const proficient = new Set(sources.keys());
  // Expertise, as the features word it: "in two of your skill proficiencies
  // of your choice" (and "At Rogue level 6, … two more"), "Choose two of
  // your skill proficiencies", "Choose one of the following skills in
  // which you have proficiency: …", or a named skill "gaining proficiency
  // in it first if you lack it". A skill takes Expertise once.
  const expertiseChoices = [], expert = new Set();
  const skillNames = book.skills.map(s => s.name);
  for (const f of features) {
    const asks = [];
    const yours = f.text.match(/gain Expertise (?:\(see “Rules Glossary”\) )?in (\w+) of your skill proficiencies of your choice/);
    if (yours) asks.push({ count: NUMBERS.indexOf(yours[1]), from: null });
    for (const m of f.text.matchAll(/At (\w[\w ]*?) level (\d+), you gain Expertise in (\w+) more of your skill proficiencies of your choice/g)) {
      const at = known.find(c => c.class === m[1])?.level ?? 0;
      if (at >= +m[2]) asks.push({ count: NUMBERS.indexOf(m[3]), from: null, at: +m[2] });
    }
    const choose = f.text.match(/Choose (\w+) of your skill proficiencies(?: with which you lack Expertise)?\. You (?:gain|have) Expertise (?:in|with) (?:those skills|that skill)\./);
    if (choose) asks.push({ count: NUMBERS.indexOf(choose[1]), from: null });
    const listed = f.text.match(/Choose one of the following skills in which you have proficiency: (.+?)\. You have Expertise in the chosen skill\./);
    if (listed) asks.push({ count: 1, from: list(listed[1]) });
    const named = f.text.match(/You gain Expertise in the ([A-Z][\w ]*?)(?: or ([A-Z][\w ]*?))? skill, gaining proficiency in it first if you lack it/);
    if (named) asks.push({ count: 1, from: [named[1], named[2]].filter(Boolean), grants: true });
    for (const [k, ask] of asks.entries()) {
      if (ask.count < 1) throw new Error(`${f.name}: an Expertise count the builder doesn't read`);
      const key = `${f.key ?? `${f.class} ${f.level} ${f.name}`}${k ? ` ${k + 1}` : ''}`;
      const from = (ask.from ?? skillNames).filter(sk => skillNames.includes(sk) && (ask.grants || proficient.has(sk)));
      const label = `${f.name} (${f.class} ${ask.at ?? f.level})`;
      expertiseChoices.push({ key, label, count: ask.count, from });
      const got = (state.expertise?.[key] ?? []).filter(Boolean);
      if (got.length !== ask.count || !got.every(sk => from.includes(sk))) fail(`expertise:${key}`, `Choose ${ask.count} skill${ask.count === 1 ? '' : 's'} for ${label}, from ${from.join(', ') || 'your skill proficiencies'}.`);
      for (const sk of got.filter(x => from.includes(x))) {
        if (expert.has(sk)) fail(`expertise:${key}`, `${sk} already has Expertise.`);
        expert.add(sk);
        if (ask.grants) { grant(sk, f.name); proficient.add(sk); }
      }
    }
  }
  const bonus = advancement.bonus;
  // Expertise doubles the Proficiency Bonus.
  // A feature's bonus to checks with skills it names ("a bonus to your
  // Intelligence (Arcana or Religion) checks. The bonus equals your Wisdom
  // modifier (minimum of +1)"), the Thaumaturge's and the Magician's.
  const checkBonus = {};
  for (const f of features) {
    const m = f.text.match(/a bonus to your \w+ \(([\w ]+?) or ([\w ]+?)\) checks\. The bonus equals your (\w+) modifier \(minimum (?:bonus )?of \+(\d+)\)/);
    if (!m) continue;
    for (const sk of [m[1], m[2]]) (checkBonus[sk] ??= []).push({ from: f.name, value: Math.max(+m[4], mod[m[3]]) });
  }
  const skills = book.skills.map(s => ({ ...s, proficient: proficient.has(s.name), expertise: expert.has(s.name), extra: checkBonus[s.name] ?? [],
    bonus: mod[s.ability] + (proficient.has(s.name) ? bonus : 0) * (expert.has(s.name) ? 2 : 1) + (checkBonus[s.name] ?? []).reduce((n, x) => n + x.value, 0) }));
  const stealthy = book.armor.items.find(a => a.name === state.armor)?.stealth_disadvantage;

  // Hit points: the first class's die at level 1, then each level's fixed
  // half die plus one, each with the Constitution modifier, at least 1.
  let hp = 0;
  const dice = {};
  for (const [k, c] of known.entries()) {
    for (let l = 1; l <= (c.level || 0); l++) hp += Math.max(1, (k === 0 && l === 1 ? c.rules.die : c.rules.die / 2 + 1) + mod.Constitution);
    dice[c.rules.die] = (dice[c.rules.die] ?? 0) + (c.level || 0);
  }
  // What a sentence adds: "Your Hit Point maximum increases by 3, and it
  // increases by 1 whenever you gain another Sorcerer level", counted from
  // the level the feature comes at; "… again whenever you gain a level",
  // from the character's first.
  const hpFrom = [];
  for (const t of [...features, ...(species?.traits ?? []).map(t => ({ ...t, level: 1 }))]) {
    const m = t.text.match(/Your Hit Point maximum increases by (\d+), and it increases by (\d+)(?: again)? whenever you gain (?:another (.+?) level|a level)\./);
    if (!m) continue;
    const at = m[3] ? known.find(c => c.class === m[3])?.level : total;
    if (at === undefined) throw new Error(`${t.name}: "another ${m[3]} level", but no ${m[3]} levels`);
    hpFrom.push({ from: t.name, hp: +m[1] + +m[2] * (at - t.level) });
  }
  hp += hpFrom.reduce((n, x) => n + x.hp, 0);

  // Spell slots: one class with Spellcasting follows its own table; two or
  // more add their levels, all or half, and read the Multiclass Spellcaster
  // table. Pact Magic keeps its own.
  const casters = known.filter(c => c.rules.slotLevels.length);
  let slots = Array(9).fill(0);
  const shared = casters.length > 1 ? casterLevel(casters) : null;
  if (casters.length === 1) {
    const row = casters[0].rules.table.rows[casters[0].level - 1];
    slots = slots.map((_, i) => number(row?.[i + 1]));
  } else if (casters.length > 1) {
    for (const c of casters) if (!c.rules.multiclass.spell_slots) fail('classes', `${c.class} has spell slots but no multiclass count.`);
    slots = book.multiclassSlots[Math.min(shared, MAX_LEVEL) - 1] ?? slots;
  }
  const pacts = known.filter(c => c.rules.pact).map(c => {
    const row = c.rules.table.rows[c.level - 1];
    return { class: c.class, slots: number(row['Spell Slots']), level: number(row['Slot Level']) };
  });
  // The spells chosen: each caster's from its own list, up to its table's
  // cantrips and prepared spells and its highest slot level; a feat's from
  // the list its sentence names ("two cantrips of your choice from the
  // Cleric, Druid, or Wizard spell list", "a level 1 spell from the same
  // list"), the background's choice of list in its name ("Magic Initiate
  // (Cleric)"), or the player's.
  // A caster prepares its spells, or knows them (the Courtier); some
  // cantrips are known without choosing.
  const spellChoices = [];
  // Every spell once, the SRD's record first: it carries the school and the
  // Special column (C, R, M) the setting's lists leave out.
  const allSpells = [...book.classes.flatMap(c => c.spellList).reduce((all, sp) => (all.has(sp.name) ? all : all.set(sp.name, sp)), new Map()).values()];
  const pickSpells = (key, label, list, cantrips, prepared, highest, { verb = 'prepared', given = [] } = {}) => {
    const got = (state.spells?.[key] ?? []).map(n => list.find(sp => sp.name === n)).filter(Boolean);
    if (got.length !== (state.spells?.[key] ?? []).length) fail(`spells:${key}`, `A spell chosen isn't on the ${label} list.`);
    const c = got.filter(sp => sp.level === 0), p = got.filter(sp => sp.level > 0);
    if (c.length > cantrips) fail(`spells:${key}`, `${label} knows ${cantrips} cantrip${cantrips === 1 ? '' : 's'} of its choice; ${c.length} are chosen.`);
    if (p.length > prepared) fail(`spells:${key}`, `${label} ${verb === 'known' ? 'knows' : 'prepares'} ${prepared} spell${prepared === 1 ? '' : 's'}; ${p.length} are chosen.`);
    if (p.some(sp => sp.level > highest)) fail(`spells:${key}`, `${label}'s spells go up to level ${highest}.`);
    spellChoices.push({ key, label, list: list.filter(sp => sp.level <= highest && !given.includes(sp.name)), cantrips, prepared, highest, verb, given: given.map(n => allSpells.find(sp => sp.name === n) ?? { name: n, level: 0 }), chosen: got });
  };
  const spellcasting = known.filter(c => c.rules.slotLevels.length || c.rules.pact).map(c => {
    const row = c.rules.table.rows[c.level - 1];
    const verb = c.rules.spellsColumn === 'Spells Known' ? 'known' : 'prepared';
    // A feature's "one extra cantrip from the Cleric spell list" adds to it.
    const extra = features.filter(f => f.class === c.class && new RegExp(`You know one extra cantrip from the ${c.class} spell list`).test(f.text)).length;
    const granted = c.rules.cantripGrants ? c.rules.cantripGrants.filter(g => g.level <= c.level).reduce((n, g) => n + g.count, 0) : number(row.Cantrips);
    const entry = { class: c.class, cantrips: granted + extra, given: c.rules.givenCantrips, prepared: number(row[c.rules.spellsColumn]), verb, highest: c.rules.pact ? number(row['Slot Level']) : Math.max(0, ...c.rules.slotLevels.filter(l => number(row[l]))) };
    if (c.rules.spellList.length) pickSpells(c.class, c.class, c.rules.spellList, entry.cantrips, entry.prepared, entry.highest, { verb, given: entry.given });
    return entry;
  });
  // A feature's own spell: one of the player's choice from the list it names,
  // of a level the class has slots for (the Courtier's A Secret), or of the
  // level it names from any class's list, a level higher at each class level
  // it names (its Great Work).
  for (const f of features) {
    const key = f.key ?? `${f.class} ${f.level} ${f.name}`, label = f.label ?? `${f.name} (${f.class})`;
    // An arcanum: one spell of the level named, from the class's list, and
    // another at each class level the feature names ("13 (level 7 spell)").
    const arcanum = f.text.match(/Choose one level (\d) (.+?) spell as this arcanum/);
    if (arcanum) {
      const at = known.find(c => c.class === f.class)?.level ?? 0, list = book.classNamed(arcanum[2]).spellList;
      const levels = [{ level: +arcanum[1], from: f.level }, ...[...f.text.matchAll(/(\d+) \(level (\d) spell\)/g)].map(m => ({ level: +m[2], from: +m[1] }))];
      for (const l of levels.filter(x => at >= x.from)) pickSpells(`${key} ${l.level}`, `${f.name}, level ${l.level} (${f.class})`, list.filter(sp => sp.level === l.level), 0, 1, l.level, { verb: 'known' });
    }
    // A book of spells (Pact of the Tome): so many cantrips and so many level
    // 1 rituals (R in the spell's Special column) from any class's list.
    const tome = f.text.match(/choose (\w+) cantrips, and choose (\w+) level 1 spells that have the Ritual tag\. The spells can be from any class[’']s spell list/);
    if (tome) pickSpells(key, label, allSpells.filter(sp => sp.level === 0 || (sp.level === 1 && /\bR\b/.test(sp.special ?? ''))), NUMBERS.indexOf(tome[1]), NUMBERS.indexOf(tome[2]), 1, { verb: 'known' });
    const own = f.text.match(/You learn one spell of your choice from the (.+?) spell list, of a level for which you have spell slots/);
    if (own) pickSpells(key, label, book.classNamed(own[1]).spellList.filter(sp => sp.level > 0), 0, 1, spellcasting.find(s => s.class === f.class)?.highest ?? 0, { verb: 'known' });
    const any = f.text.match(/You learn one level (\d) spell of your choice from any class's spell list/);
    if (any) {
      const at = known.find(c => c.class === f.class)?.level ?? 0;
      const steps = f.text.match(/when you reach \w+ levels ([\d, and]+), you can replace the spell with one a level higher/);
      const highest = +any[1] + (steps ? steps[1].match(/\d+/g).map(Number).filter(t => at >= t).length : 0);
      pickSpells(key, label, allSpells.filter(sp => sp.level >= +any[1]), 0, 1, highest, { verb: 'known' });
    }
  }
  const featLists = [], listChoices = [];
  for (const f of feats) {
    const text = f.feat.benefits.map(b => b.text).join(' ');
    const m = text.match(/You learn (\w+) cantrips of your choice from the (.+?) spell list/);
    if (!m) continue;
    const offered = m[2].split(/,\s*(?:or\s+)?|\s+or\s+/);
    // The lists the feat offers, narrowed by its source's note.
    const lists = f.lists ? offered.filter(l => f.lists.includes(l)) : offered;
    if (f.lists && lists.length !== f.lists.length) throw new Error(`${f.from}: "${f.note}" names a list ${f.feat.name} doesn't offer`);
    const named = lists.length === 1 ? lists[0] : state.featLists?.[f.from];
    const key = `feat ${f.from}`;
    if (lists.length > 1) listChoices.push({ from: f.from, feat: f.feat.name, lists, chosen: named ?? null, field: `spells:${key}` });
    if (!lists.includes(named)) { fail(`spells:${key}`, `Choose the ${lists.join(', ')} list for ${f.feat.name}.`); continue; }
    if (/must choose a different spell list each time/.test(text) && featLists.includes(`${f.feat.name}|${named}`)) fail(`spells:${key}`, `${f.feat.name} takes a different list each time; the ${named} list is taken.`);
    featLists.push(`${f.feat.name}|${named}`);
    const level = +(text.match(/Choose a level (\d) spell from the same list/)?.[1] ?? 0);
    pickSpells(key, `${f.feat.name} (${named})`, book.classNamed(named).spellList, NUMBERS.indexOf(m[1]), level ? 1 : 0, level);
  }

  // Weapons: the kinds the character is proficient with, as the first
  // class's Weapon Proficiencies say ("Simple weapons and Martial weapons
  // that have the Finesse or Light property"), and a later class's or a
  // feature's "proficiency with Martial weapons".
  const hasProperty = (w, p) => w.properties.some(x => x === p || x.startsWith(`${p} (`));
  const weaponRules = text => {
    const rules = [];
    if (/\bSimple (?:and Martial )?weapons\b/.test(text)) rules.push(w => w.category === 'Simple');
    if (/\bSimple and Martial weapons\b|proficiency with Martial weapons/.test(text)) rules.push(w => w.category === 'Martial');
    const some = text.match(/Martial weapons that have the (.+?) propert(?:y|ies)/);
    if (some) {
      const props = some[1].split(/ (?:or|and) /), every = / and /.test(some[1]);
      rules.push(w => w.category === 'Martial' && (every ? props.every(p => hasProperty(w, p)) : props.some(p => hasProperty(w, p))));
    }
    return rules;
  };
  const proficientWith = [...(first ? weaponRules(first.traits.find(t => t.trait === 'Weapon Proficiencies')?.value ?? '') : []),
    ...known.slice(1).flatMap(c => weaponRules(c.rules.multiclass.gains)), ...features.flatMap(f => weaponRules(f.text.match(/proficiency with Martial weapons/)?.[0] ?? ''))];
  const proficientWeapons = (book.weapons ?? []).filter(w => proficientWith.some(r => r(w)));
  // Weapon Mastery: so many kinds of weapon, by the class's Weapon Mastery
  // column where it has one or by its sentence ("three kinds of Simple or
  // Martial weapons of your choice"), from what the sentence allows: its
  // categories, Melee or Ranged, a damage type ("two kinds of Slashing
  // weapons", the Chirurgeon's), and, where it says so, only the kinds the
  // character is proficient with.
  const masteryChoices = [];
  for (const f of features) {
    const m = f.text.match(/use the mastery properties of (\w+) kinds of (.+?) of your choice( with which you have proficiency)?/);
    if (!m) continue;
    const c = known.find(x => x.class === f.class), key = f.key ?? `${f.class} ${f.level} ${f.name}`;
    const column = c.rules.table.columns.includes('Weapon Mastery') ? number(c.rules.table.rows[c.level - 1]?.['Weapon Mastery']) : 0;
    const count = column || NUMBERS.indexOf(m[1]);
    if (count < 1) throw new Error(`${f.name}: a count the builder doesn't read: "${m[1]}"`);
    const kind = m[2].match(/^(?:(Simple|Martial)(?: or (Simple|Martial))? )?(?:(Melee|Ranged) )?(?:(Slashing|Piercing|Bludgeoning) )?weapons$/);
    if (!kind) throw new Error(`${f.name}: "${m[2]}", weapons the builder doesn't read`);
    const categories = [kind[1], kind[2]].filter(Boolean);
    const from = (m[3] ? proficientWeapons : book.weapons ?? []).filter(w => (!categories.length || categories.includes(w.category)) && (!kind[3] || w.range === kind[3]) && (!kind[4] || w.damage.includes(kind[4])));
    const got = (state.mastery?.[key] ?? []).filter(Boolean);
    masteryChoices.push({ key, label: `${f.name} (${f.class} ${f.level})`, count, from, chosen: from.filter(w => got.includes(w.name)) });
    if (got.length !== count || new Set(got).size !== got.length || !got.every(n => from.some(w => w.name === n))) fail(`mastery:${key}`, `Choose ${count} kind${count === 1 ? '' : 's'} of weapon for ${f.name}${from.length < (book.weapons ?? []).length ? `, from ${m[2]}${m[3] ? ' you\'re proficient with' : ''}` : ''}.`);
  }

  // Languages: what every character starts with, by the rules' sentence
  // ("Common plus two languages you roll or choose"; on a 1668 sheet Common is
  // the character's vernacular and the two are real tongues, which
  // euphonia.languages.json says), and what a feature gives: a language it
  // names ("You know Druidic, the secret language of Druids"), or so many of
  // the player's choice ("Thieves’ Cant and one other language of your
  // choice", "two languages of your choice"). Named in the player's words,
  // each once.
  const languageChoices = [];
  const tongues = book.languages;
  if (tongues) {
    languageChoices.push({ key: 'Common', label: 'Common', count: tongues.known.length, given: [] }, { key: 'standard', label: 'Standard languages', count: NUMBERS.indexOf(tongues.choose.count), given: [] });
    for (const f of features) {
      const key = f.key ?? `${f.class} ${f.level} ${f.name}`, label = f.label ?? `${f.name} (${f.class} ${f.level})`;
      const plus = f.text.match(/You know ([A-Z][\w’' ]+?) and (\w+) other languages? of your choice/);
      const named = f.text.match(/You know ([A-Z][\w’' ]+?), the secret language/);
      const some = f.text.match(/You (?:know|learn) (\w+) languages of your choice/);
      const ask = plus ? { given: [plus[1]], count: NUMBERS.indexOf(plus[2]) } : named ? { given: [named[1]], count: 0 } : some ? { given: [], count: NUMBERS.indexOf(some[1]) } : null;
      if (!ask) continue;
      if (ask.count < 0) throw new Error(`${f.name}: a language count the builder doesn't read`);
      languageChoices.push({ key, label, ...ask });
    }
    const seen = new Set();
    for (const c of languageChoices) {
      const got = (state.languages?.[c.key] ?? []).map(x => String(x).trim()).filter(Boolean);
      c.chosen = got;
      if (got.length !== c.count) fail(`language:${c.key}`, c.key === 'Common' ? 'Name your vernacular, the language of the place that raised you.' : `Name ${c.count} language${c.count === 1 ? '' : 's'} for ${c.label}.`);
      for (const name of [...c.given, ...got]) {
        if (seen.has(name.toLowerCase())) fail(`language:${c.key}`, `${name} is already one of your languages.`);
        seen.add(name.toLowerCase());
      }
    }
  }

  // What the sentences say: Initiative with a feat's Proficiency Bonus; an
  // Armor Class a feature gives without armor; a lineage's speed.
  const initiative = mod.Dexterity + (feats.some(f => f.feat.benefits.some(b => /^When you roll Initiative, you can add your Proficiency Bonus to the roll\.$/.test(b.text))) ? bonus : 0);
  // Armour: the table's own AC, the training the classes give (the first
  // class's Armor Training, a later one's "training with"), and a Shield's
  // bonus only with training. Without armour, each feature's own Armor
  // Class, and a Shield only where its sentence allows one ("aren't wearing
  // armor or wielding a Shield" doesn't).
  const trainedIn = text => [...new Set([...(text.match(/\b(Light|Medium|Heavy)\b/g) ?? []), ...(/\bShields?\b/.test(text) ? ['Shield'] : [])])];
  const training = [...new Set([...(first ? trainedIn(first.traits.find(t => t.trait === 'Armor Training')?.value ?? '') : []),
    ...known.slice(1).flatMap(c => trainedIn(c.rules.multiclass.gains.match(/training with (.+)$/)?.[1] ?? '')),
    // A feature's own ("training with Heavy armor", the Protector's).
    ...features.flatMap(f => trainedIn(f.text.match(/training with (\w+) armor/)?.[1] ?? ''))])];
  const worn = book.armor.items.find(a => a.name === state.armor && a.category !== 'Shield') ?? null;
  if (state.armor && !worn) fail('armor', `There's no armor "${state.armor}".`);
  const shield = state.shield ? book.armor.items.find(a => a.category === 'Shield') : null;
  const shieldBonus = shield && training.includes('Shield') ? shield.bonus : 0;
  if (worn && !training.includes(worn.category)) warn('armor', `Without training in ${worn.category} armor, you have Disadvantage on any D20 Test that involves Strength or Dexterity, and you can't cast spells.`);
  if (shield && !training.includes('Shield')) warn('armor', 'Without training with Shields, a Shield gives no Armor Class.');
  const unarmored = [{ from: 'No armor', ac: 10 + mod.Dexterity + shieldBonus }];
  for (const f of features) {
    const sentence = f.text.split(/(?<=\.)\s+/).find(x => /base Armor Class equals 10 plus your (\w+) and (\w+) modifiers/.test(x));
    if (!sentence) continue;
    const m = sentence.match(/base Armor Class equals 10 plus your (\w+) and (\w+) modifiers/);
    const noShield = /wearing (?:any )?armor or wielding a Shield/.test(sentence);
    if (shield && noShield) continue;
    unarmored.push({ from: f.name, ac: 10 + mod[m[1]] + mod[m[2]] + shieldBonus });
  }
  const armorClass = worn
    ? { from: worn.name, ac: worn.base + (worn.dex ? Math.min(mod.Dexterity, worn.dex_max ?? Infinity) : 0) + shieldBonus }
    : { ...unarmored.reduce((best, u) => (u.ac > best.ac ? u : best)) };
  if (shieldBonus) armorClass.from += ' and Shield';
  // A feat's own sentence: "While you’re wearing Light, Medium, or Heavy
  // armor, you gain a +1 bonus to Armor Class" (Defense).
  for (const f of feats) {
    const m = f.feat.description?.match(/While you’re wearing (.+?) armor, you gain a \+(\d+) bonus to Armor Class/);
    if (m && worn && list(m[1]).includes(worn.category)) { armorClass.ac += +m[2]; armorClass.from += ` and ${f.feat.name}`; }
  }
  const options = speciesOptions(species);
  if (options && !options.names.includes(state.option)) fail('option', `Choose your ${options.label}.`);
  const optionRow = species && Object.values(species.tables ?? {}).flat().find(r => Object.values(r)[0] === state.option);
  const faster = Object.values(optionRow ?? {}).join(' ').match(/Your Speed increases to (\d+) feet/)?.[1];
  const slowed = worn?.strength && scores.Strength < worn.strength ? book.armor.strength_speed_penalty : 0;
  if (slowed) warn('armor', `${worn.name} needs Strength ${worn.strength}; it takes ${slowed} feet off your speed.`);
  const speed = Number(faster ?? species?.speed.match(/^(\d+)/)?.[1] ?? 0) - slowed;
  const sizes = species?.size.match(/\b(Tiny|Small|Medium|Large)\b/g) ?? [];
  if (sizes.length > 1 && !sizes.includes(state.size)) fail('size', `Choose ${sizes.join(' or ')}.`);
  const size = sizes.length > 1 ? state.size : sizes[0];

  return {
    problems, warnings, notes, species, option: options?.names.includes(state.option) ? state.option : null, size, background, scores, base, mod, level: total, bonus,
    xp: advancement.xp, nextXp: book.advancement[total]?.xp ?? null,
    classes: known.map(c => ({ class: c.class, level: c.level, subclass: c.subclass ?? null, die: c.rules.die, source: c.rules.source, subclassBook: c.rules.subclasses.find(s => s.name === c.subclass)?.book ?? null })),
    saves: ABILITIES.map(a => ({ ability: a, proficient: saves.includes(a), bonus: mod[a] + (saves.includes(a) ? bonus : 0) })),
    skills, choices, originChoices, styleChoices, expertiseChoices, optionChoices, pickChoices, masteryChoices, proficientWeapons, languageChoices, stealthDisadvantage: Boolean(stealthy), passivePerception: 10 + skills.find(s => s.name === 'Perception').bonus, initiative, speed,
    hp, hpFrom, hitDice: Object.entries(dice).map(([die, n]) => ({ die: +die, count: n })).sort((a, b) => b.die - a.die),
    features, feats, improvements, unarmored, armorClass, armor: worn, shield: Boolean(shield), training,
    slots, casterLevel: shared, pacts, spellcasting, spellChoices, listChoices,
  };
}
