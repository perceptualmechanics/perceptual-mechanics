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

// A class's skill choice, as either export words it: "Choose 2: A, B, or C",
// "*Choose 3:* A, B, or C", "Medicine, plus *choose 2:* A or B", "Choose any
// 3 skills".
function skillChoice(text, skills, where) {
  const plain = text.replace(/\*/g, '');
  const any = plain.match(/^Choose any (\d+) skills\b/);
  if (any) return { fixed: [], count: +any[1], from: skills };
  const m = plain.match(/^(?:(.+?), plus )?[Cc]hoose (\d+): (.+)$/);
  if (!m) throw new Error(`${where}: a skill choice the builder doesn't read: "${text}"`);
  const from = list(m[3]), fixed = m[1] ? list(m[1]) : [];
  for (const s of [...from, ...fixed]) if (!skills.includes(s)) throw new Error(`${where}: "${s}" isn't a skill`);
  return { fixed, count: +m[2], from };
}

// A skill a sentence grants: "proficiency in the Insight, Perception, or
// Survival skill", "proficiency in one skill of your choice", or "…of your
// choice from the Ranger’s skill list" (the setting writes a straight
// apostrophe).
function skillGrant(text, skills, classFrom) {
  const named = text.match(/proficiency in the ([A-Z][\w ,]+?) skill\b/);
  if (named) return list(named[1]);
  if (/proficiency in one skill of your choice from the .+?[’']s skill list/.test(text)) return classFrom;
  if (/proficiency in one skill of your choice/.test(text)) return skills;
  return null;
}

// The rules as the builder uses them: the SRD's tables and options, and every
// class, the SRD's twelve and the setting's own, in one shape.
export function rulebook(srd, euphonia) {
  const skills = srd.tables.skills.map(r => r.Skill);
  const modifiers = srd.tables.ability_modifiers.map(r => {
    const [lo, hi = lo] = r.Score.split('–').map(Number);
    return { lo, hi, mod: number(r.Modifier) };
  });
  const classes = [...srd.classes.map(c => ({ ...c, source: 'SRD 5.2.1' })), ...euphonia.data.map(c => ({ ...c, source: 'Euphonia' }))].map(c => {
    const die = number(trait(c, 'Hit Point Die').match(/^D(\d+) per /)?.[1]);
    if (!die) throw new Error(`${c.name}: no Hit Point Die`);
    const saves = trait(c, 'Saving Throw Proficiencies').split(' and ');
    const grants = c.features.filter(f => /subclass of your choice/.test(f.text));
    if (grants.length !== 1) throw new Error(`${c.name}: ${grants.length} features grant a subclass`);
    const choice = skillChoice(trait(c, 'Skill Proficiencies'), skills, c.name);
    const slotLevels = c.table.columns.filter(k => /^\d$/.test(k)).map(Number);
    // Its spell list, by level, in one shape for both exports (the SRD's
    // carry a school and C, R or M; the setting's say which are new).
    const spells = Object.entries(c.spells ?? {}).flatMap(([level, list]) => list.map(sp => ({ ...sp, level: +level })));
    return {
      ...c, die, saves, skills: choice, subclassLevel: grants[0].level, spellList: spells,
      // The levels that bring a feat: an Ability Score Improvement, or the
      // Epic Boon at 19.
      improvements: c.table.rows.flatMap(r => (r['Class Features'] ?? '').split(/,\s*/).filter(n => n === 'Ability Score Improvement' || n === 'Epic Boon').map(kind => ({ level: number(r.Level), kind }))),
      slotLevels,
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
    species: srd.species, backgrounds: srd.backgrounds, feats: srd.feats, armor: srd.armor, classes,
    classNamed: name => classes.find(c => c.name === name),
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

  // The feats: the background's, then each improvement's, in order, so a
  // feat's increase counts toward the next one's prerequisite.
  const feats = [];
  if (background) {
    const name = background.feat.replace(/ \(.*\)$/, '');
    const feat = book.feats.find(f => f.name === name);
    if (feat) feats.push({ from: background.name, feat, note: background.feat.match(/\((.*)\)$/)?.[1] ?? null });
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
  // A trait that grants an Origin feat of the player's choice (the Human's
  // Versatile).
  const originChoices = [];
  for (const t of species?.traits ?? []) {
    if (!/^You gain an Origin feat of your choice\b/.test(t.text)) continue;
    const key = `${species.name} ${t.name}`, from = `${t.name} (${species.name})`;
    originChoices.push({ key, label: from });
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
  const chosen = (key, from, count, picks, label, upTo = false) => {
    if (from.length === count && !upTo) { for (const s of from) grant(s, label); return; }
    choices.push({ key, label, from, count, upTo });
    const got = (picks ?? []).filter(Boolean);
    if ((upTo ? got.length > count : got.length !== count) || new Set(got).size !== got.length || !got.every(s => from.includes(s))) fail(`skills:${key}`, `Choose ${upTo ? 'up to ' : ''}${count} skill${count === 1 ? '' : 's'}${from.length < book.skills.length ? ` from ${from.join(', ')}` : ''}.`);
    for (const s of got.filter(x => from.includes(x))) grant(s, label);
  };
  if (first) { for (const s of first.skills.fixed) grant(s, first.name); chosen(first.name, first.skills.from, first.skills.count, state.skills?.[first.name], first.name); }
  for (const c of known.slice(1)) if (c.rules.multiclassSkills) chosen(c.class, c.rules.multiclassSkills, 1, state.skills?.[c.class], `${c.class}, as a multiclass`);
  for (const s of background?.skills ?? []) grant(s, background.name);
  if (species) {
    for (const t of species.traits) {
      const from = skillGrant(t.text, book.skills.map(s => s.name));
      if (from) chosen(`${species.name} ${t.name}`, from, 1, state.skills?.[`${species.name} ${t.name}`], `${t.name} (${species.name})`);
    }
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
  const bonus = advancement.bonus;
  const skills = book.skills.map(s => ({ ...s, proficient: proficient.has(s.name), bonus: mod[s.ability] + (proficient.has(s.name) ? bonus : 0) }));
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
  const spellChoices = [];
  const pickSpells = (key, label, list, cantrips, prepared, highest) => {
    const got = (state.spells?.[key] ?? []).map(n => list.find(sp => sp.name === n)).filter(Boolean);
    if (got.length !== (state.spells?.[key] ?? []).length) fail(`spells:${key}`, `A spell chosen isn't on the ${label} list.`);
    const c = got.filter(sp => sp.level === 0), p = got.filter(sp => sp.level > 0);
    if (c.length > cantrips) fail(`spells:${key}`, `${label} knows ${cantrips} cantrip${cantrips === 1 ? '' : 's'}; ${c.length} are chosen.`);
    if (p.length > prepared) fail(`spells:${key}`, `${label} prepares ${prepared} spell${prepared === 1 ? '' : 's'}; ${p.length} are chosen.`);
    if (p.some(sp => sp.level > highest)) fail(`spells:${key}`, `${label}'s spells go up to level ${highest}.`);
    spellChoices.push({ key, label, list: list.filter(sp => sp.level <= highest), cantrips, prepared, highest, chosen: got });
  };
  const spellcasting = known.filter(c => c.rules.slotLevels.length || c.rules.pact).map(c => {
    const row = c.rules.table.rows[c.level - 1];
    const entry = { class: c.class, cantrips: number(row.Cantrips), prepared: number(row['Prepared Spells']), highest: c.rules.pact ? number(row['Slot Level']) : Math.max(0, ...c.rules.slotLevels.filter(l => number(row[l]))) };
    if (c.rules.spellList.length) pickSpells(c.class, c.class, c.rules.spellList, entry.cantrips, entry.prepared, entry.highest);
    return entry;
  });
  const featLists = [], listChoices = [];
  for (const f of feats) {
    const text = f.feat.benefits.map(b => b.text).join(' ');
    const m = text.match(/You learn (\w+) cantrips of your choice from the (.+?) spell list/);
    if (!m) continue;
    const lists = m[2].split(/,\s*(?:or\s+)?|\s+or\s+/);
    const named = f.note ?? state.featLists?.[f.from];
    const key = `feat ${f.from}`;
    if (!f.note) listChoices.push({ from: f.from, feat: f.feat.name, lists, chosen: named ?? null, field: `spells:${key}` });
    if (!lists.includes(named)) { fail(`spells:${key}`, `Choose the ${lists.join(', ')} list for ${f.feat.name}.`); continue; }
    if (/must choose a different spell list each time/.test(text) && featLists.includes(`${f.feat.name}|${named}`)) fail(`spells:${key}`, `${f.feat.name} takes a different list each time; the ${named} list is taken.`);
    featLists.push(`${f.feat.name}|${named}`);
    const level = +(text.match(/Choose a level (\d) spell from the same list/)?.[1] ?? 0);
    pickSpells(key, `${f.feat.name} (${named})`, book.classNamed(named).spellList, NUMBERS.indexOf(m[1]), level ? 1 : 0, level);
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
    ...known.slice(1).flatMap(c => trainedIn(c.rules.multiclass.gains.match(/training with (.+)$/)?.[1] ?? ''))])];
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
    classes: known.map(c => ({ class: c.class, level: c.level, subclass: c.subclass ?? null, die: c.rules.die, source: c.rules.source })),
    saves: ABILITIES.map(a => ({ ability: a, proficient: saves.includes(a), bonus: mod[a] + (saves.includes(a) ? bonus : 0) })),
    skills, choices, originChoices, stealthDisadvantage: Boolean(stealthy), passivePerception: 10 + skills.find(s => s.name === 'Perception').bonus, initiative, speed,
    hp, hpFrom, hitDice: Object.entries(dice).map(([die, n]) => ({ die: +die, count: n })).sort((a, b) => b.die - a.die),
    features, feats, improvements, unarmored, armorClass, armor: worn, shield: Boolean(shield), training,
    slots, casterLevel: shared, pacts, spellcasting, spellChoices, listChoices,
  };
}
