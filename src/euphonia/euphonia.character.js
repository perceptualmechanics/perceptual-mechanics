// The character builder's rules: a character, as the choices that make one,
// worked out by the SRD 5.2.1 and the setting's own classes. Everything comes
// from the two exports (euphonia.srd.json, euphonia.classes.json): where a
// rule is a table the table is read, and where it is only a sentence, the
// sentence, in the SRD's own words; a sentence the engine can't read is an
// error, not a guess. Pure, so the gate (verify-euphonia-builder) runs it
// against the SRD's own worked examples.


export const ABILITIES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
export const MAX_LEVEL = 20;

// An item's prices by distance, from the place table the book gives it: the
// home that prices it, its own sentence saying so, and each place's regions
// with its multiple or the buyer's words.
function pricesOf(item) {
  if (!item.prices?.length) return null;
  const home = item.prices.find(p => p.home)?.place, says = item.text.match(/Prices are for [^.]*\./)?.[0];
  if (!home || !says) throw new Error(`${item.name}: its prices name no home`);
  return { home, says, places: item.prices.map(p => ({ place: p.place, homelands: p.regions, times: p.times, ...(p.times === null ? { words: p.rate.split(' at ')[0] } : {}) })) };
}
// The class gear rules as The Classes words them: how far ahead of the table
// the gear arrives, that a Shield needs training, and what a subclass goes
// without.
function classGearRules({ rules, without }) {
  const text = lead => rules.find(r => r.lead === lead)?.text ?? '';
  const ahead = NUMBERS.indexOf(text('When it arrives').match(/arrives (\w+) rarit(?:y|ies) ahead/)?.[1]);
  if (ahead < 1) throw new Error(`Class gear: "${text('When it arrives')}" doesn't say how far ahead it arrives`);
  if (!/^A Shield goes only to a character with Shield training\b/.test(text('Shields'))) throw new Error(`Class gear: "${text('Shields')}" isn't the Shield rule`);
  return { ahead, without };
}
// What the book says the language choices are: its Common and standard
// languages lines, each to the end of its first sentence.
export function languageNotes(paragraphs) {
  const first = label => paragraphs.join('\n').match(new RegExp(`^- \\*\\*${label}\\*\\*[^\\n]*?\\.(?= |$)`, 'm'))?.[0].replace(/^- /, '').replaceAll('**', '') ?? null;
  return { Common: first('Common'), standard: first('The two standard languages') };
}

// How a problem reads when what it asks for hasn't been chosen yet.
const OPEN_CHOICE = /^(?:Choose|Name|Say how|Roll a|Increase one)\b/;
const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const number = s => (s === '—' || s === '–' || s === undefined ? 0 : Number(String(s).replace(/[,+]/g, '').replace('−', '-')));
const list = s => s.replace(/\*/g, '').split(/,\s*(?:or\s+|and\s+)?|\s+(?:or|and)\s+/).map(x => x.trim()).filter(Boolean);
const trait = (c, name) => c.traits.find(t => t.trait === name)?.value ?? '';
// What a feature says a firearm is ("A firearm is a Pistol, a Musket or a
// period firearm …", with or without the comma before "or"): the named ones.
const firearmsIn = text => text?.match(/A firearm is (.+?),? or a period firearm/)?.[1].split(/,\s*/).map(x => x.replace(/^an? /, '')) ?? [];
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
// can be taken ("twice", "more than once") and its text. Where the class
// has its subclasses give up an art, each says which, in its lead or its
// first feature ("Your college forgoes Letters", or "forgoes no art"); where
// it never speaks of forgoing, none does. A subclass feature can give an
// option outright ("You have The Code without spending an accomplishment on
// it").
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
  const arts = new Set(list.flatMap(o => o.arts));
  const saidOf = s => [s.lead ?? '', ...s.features.map(f => f.text)].join('\n');
  const forgoing = [...c.features.map(x => x.text), ...c.subclasses.map(saidOf)].some(t => /\bforgo/.test(t));
  const forgoes = Object.fromEntries(c.subclasses.map(s => {
    if (!forgoing) return [s.name, null];
    const said = saidOf(s);
    const art = said.match(/(?:\bit|Your college) forgoes (\w+)\b/)?.[1];
    if (!(art && arts.has(art)) && !/forgoes no art/.test(said)) throw new Error(`${c.name}: the ${s.name} subclass doesn't say which art it forgoes`);
    return [s.name, art ?? null];
  }));
  // One a subclass gives ("You have The Code without spending an
  // accomplishment on it"), and, where it says so, what it gives instead to
  // one who has it already ("if you already have it, you gain one more
  // accomplishment from the art of Arms instead").
  const given = Object.fromEntries(c.subclasses.map(s => [s.name, s.features.flatMap(x => [...x.text.matchAll(new RegExp(`You have ([A-Z][\\w' ]+?) without spending an? ${noun} on it(?: \\(if you already have it, you gain one more ${noun} from the art of (\\w+) instead\\))?`, 'g'))].map(m => {
    if (!list.some(o => o.name === m[1])) throw new Error(`${c.name}: ${s.name} gives "${m[1]}", which isn't one of its ${noun}s`);
    return { name: m[1], level: x.level, from: x.name, instead: m[2] ?? null };
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

// A feature's spell tables, a class level and the spells it brings in each
// row: the setting's, read by the exporter; the SRD's, as markdown in its
// text, its two columns a level ("Cleric Level") and spells ("Prepared
// Spells", "Circle Spells"). A feature with several, one per land, names
// each set in bold above it.
const SPELL_TABLE = /(?:^\*\*([^*\n]+)\*\*\n\n)?^\| *[^|\n]*Level *\| *[^|\n]*Spells? *\|\n\|[-| :]+\|\n((?:\|[^\n]*\|\n?)+)/gm;
export function spellTables(f) {
  if (f.spells) return [{ set: null, rows: f.spells }];
  return [...f.text.matchAll(SPELL_TABLE)].map(m => ({
    set: m[1] ?? null,
    rows: m[2].trim().split('\n').map(line => {
      const [lv, list] = line.split('|').slice(1, -1).map(x => x.trim());
      if (!/^\d+$/.test(lv)) throw new Error(`${f.name}: a spell table row for level "${lv}"`);
      return { level: +lv, spells: list.split(/,\s*/).map(x => x.replace(/\*/g, '').trim()) };
    }),
  }));
}
// "You thereafter always have the listed spells prepared"; the Circle of the
// Land's "you have the spells listed for your Druid level and lower
// prepared", from the land chosen.
const ALWAYS_PREPARED = /always have the listed spells? prepared|you have the spells listed for your \w+ level and lower prepared/;

// A starting equipment's packages, each a choice ("Choose A or B: (A)
// Leather Armor, 2 Daggers, …, and 19 GP; or (B) 90 GP"): its items, and its
// gold apart from them.
function packagesOf(text, where) {
  const found = [...text.replace(/\*/g, '').matchAll(/\(([A-C])\) (.+?)(?=;? (?:or )?\([A-C]\)|\.?$)/g)].map(m => {
    const parts = m[2].split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim());
    const gold = parts.filter(x => /^[\d,]+ GP$/i.test(x));
    return { label: m[1], items: parts.filter(x => !gold.includes(x)), gold: gold.reduce((n, x) => n + number(x.split(' ')[0]), 0) };
  });
  if (found.length < 2) throw new Error(`${where}: starting equipment "${text}" doesn't read as packages`);
  return found;
}

// The rules as the builder uses them: the SRD's tables and options, every
// class and background, the SRD's and the setting's own, in one shape, and
// where the setting places each species. `added` holds the subclasses the
// books add to the SRD's classes, and `goods` the books' items and period
// weapons.
export function rulebook(srd, euphonia, setting, added, goods) {
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
      ...c, features, die, saves, skills: choice, subclassLevel: grants[0].level, subclassFeature: grants[0].name, spellList: spells,
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
      // A class that keeps a spellbook prepares from it: so many level 1
      // spells to start ("It starts with six level 1 Wizard spells of your
      // choice"), so many more each level after 1, each of a level it has
      // slots for.
      spellbook: (() => {
        const text = c.features.map(f => f.text).join('\n');
        const start = text.match(/(?:starts with|contains) (\w+) level 1 [\w ]+? spells of your choice/), more = text.match(/gain an? [\w ]+? level after 1, (?:you can )?add (\w+) [\w ]+? spells of your choice to your spellbook/);
        if (!start !== !more) throw new Error(`${c.name}: a spellbook the builder half reads`);
        return start ? { start: NUMBERS.indexOf(start[1]), more: NUMBERS.indexOf(more[1]) } : null;
      })(),
      // Every Revelation its Cosmography holds (the Revelator's), each with
      // the group it's listed in.
      revelations: c.cosmography ? c.cosmography.groups.flatMap(g => g.revelations.map(r => ({ ...r, group: g.name }))) : null,
      multiclassSkills: skillGrant(c.multiclass.gains, skills, choice.from),
      packages: packagesOf(trait(c, 'Starting Equipment'), c.name),
    };
  });
  // Who an item is for, as its attunement line names them: a class ("a
  // Revelator"), a subclass and its class ("an Envoy Warlock", "a
  // Chirurgeon"), a class's subclass a family's member is for ("a Counsellor
  // of the Keepsake's Subclass", "a Courtier of the Keepsake's College", the
  // last word the family's own for a subclass), or a class's subclasses in
  // the item's own chapter ("a Sorcerer of an Origin in This Chapter"). A family's members
  // each name a subclass of the class whose chapter carries it; one is the
  // member for that subclass only where its line or its text says so ("works
  // only for a Mhizha of that subclass"). A class still being written
  // keeps its items back with it.
  const subclassesNamed = (cls, words) => cls.subclasses.filter(sc => sc.name === words || new RegExp(`(?:^|\\s)${words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`).test(sc.name));
  const waiting = new RegExp(`\\b(?:${unfinished.join('|') || '(?!)'})\\b`);
  const items = goods.items.filter(item => !waiting.test(`${item.place.class_name ?? ''} ${item.attunement?.by ?? ''}`)).map(item => {
    const home = classes.find(c => c.name === item.place.class_name) ?? null;
    let who = null;
    if (item.attunement?.by) {
      const by = item.attunement.by.replace(/^an? /, ''), family = item.members.length ? by.match(/^(.+?) of the \w+'s \w+$/) : null, chapter = by.match(/^(.+?) of an? \w+ in (This Chapter(?: or in .+)?)$/);
      const cls = classes.find(c => c.name === (family ?? chapter)?.[1] || c.name === by) ?? classes.find(c => by.endsWith(` ${c.name}`));
      // "in This Chapter or in A Player's Companion": the item's own book, then each book named.
      const books = chapter?.[2].split(' or in ').map(b => b === 'This Chapter' ? item.place.book : `Euphonia: ${b}`);
      if (family && cls) who = { class: cls.name, member: true };
      else if (chapter && cls) {
        const none = books.find(b => !cls.subclasses.some(sc => sc.book === b));
        if (none) throw new Error(`${item.name}: "Requires Attunement by ${item.attunement.by}" names ${none}, which holds no ${cls.name} subclass`);
        who = { class: cls.name, subclasses: cls.subclasses.filter(sc => books.includes(sc.book)).map(sc => sc.name) };
      }
      else if (cls && cls.name === by) who = { class: cls.name };
      else {
        const [c, sc] = cls ? [cls, subclassesNamed(cls, by.slice(0, -cls.name.length - 1))] : classes.map(c => [c, subclassesNamed(c, by)]).find(([, x]) => x.length) ?? [];
        if (sc?.length !== 1) throw new Error(`${item.name}: "Requires Attunement by ${item.attunement.by}" names no one class or subclass`);
        who = { class: c.name, subclasses: [sc[0].name] };
      }
    }
    const members = item.members.map(mb => {
      const of = home ? subclassesNamed(home, mb.subclass) : [];
      if (of.length !== 1) throw new Error(`${item.name}: its ${mb.name} is for "${mb.subclass}", which names no one subclass of ${item.place.class_name}`);
      return { ...mb, subclass: of[0].name };
    });
    const bound = Boolean(who?.member) || new RegExp(`works only for an? ${item.place.class_name} of that subclass`).test(item.text);
    for (const r of item.rarities) if (r.member && !members.some(mb => mb.name === r.member)) throw new Error(`${item.name}: it's ${r.rarity} for the ${r.member}, which isn't one of its members`);
    const living = item.living ? item.homelands : null;
    if (!living && /\*A living tradition\.\*/.test(item.text)) throw new Error(`${item.name}: its text calls it a living tradition, and the export doesn't`);
    // An item that comes only in the story ("No one starts play with a pair")
    // isn't starting gear.
    const story = /\bNo one starts play with\b/.test(item.text);
    return { ...item, who, members, bound, living, story, from: item.homelands, prices: pricesOf(item) };
  });
  return {
    items, periodWeapons: goods.weapons,
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
    damageTypes: srd.tables.damage_types.map(r => r.Type),
    // Hit points by Hit Point Die, from the SRD's tables (Level 1 Hit Points
    // and Fixed Hit Points by Class), so a setting class with the same die
    // takes the same: a d8's 8 at level 1, and 5 a level after.
    hitPoints: Object.fromEntries(srd.classes.map(c => [number(c.traits.find(t => t.trait === 'Hit Point Die').value.match(/^D(\d+)/)[1]), { first: srd.hit_points.level_1[c.name], fixed: srd.hit_points.fixed[c.name] }])),
    attunementMax: srd.attunement_max,
    // What a character can buy, at the SRD's prices in gold: its weapons,
    // armor, gear, a focus's forms, ammunition by the bundle, and tools by
    // their variants; each with what it reads as in the inventory.
    catalog: [
      ...srd.weapons.map(w => ({ name: w.name, kind: 'Weapons', cost: w.cost })),
      ...srd.armor.items.map(a => ({ name: a.name, kind: 'Armor', cost: a.cost })),
      ...srd.gear.filter(g => g.cost !== null).map(g => ({ name: g.name, kind: 'Adventuring Gear', cost: g.cost })),
      ...Object.entries(srd.forms).flatMap(([item, forms]) => forms.map(f => ({ name: `${item} (${f.name})`, kind: 'Adventuring Gear', cost: f.cost }))),
      ...srd.ammunition.map(a => ({ name: a.name, kind: 'Ammunition', cost: a.cost, bundle: a.amount })),
      ...srd.tools.flatMap(t => (t.variant_goods ? t.variant_goods.map(v => ({ name: `${t.name} (${v.name})`, kind: 'Tools', cost: v.cost, weight: v.weight })) : [{ name: t.name, kind: 'Tools', cost: t.cost }])),
    ].filter(x => x.cost !== null),
    weights: { gear: srd.gear, ammunition: srd.ammunition, forms: srd.forms, coinsPerPound: srd.coins_per_pound, carrying: srd.carrying, overloaded: srd.overloaded },
    attacks: srd.attacks,
    backgroundIncreases: srd.ability_scores.background,
    species: srd.species, feats: srd.feats, armor: srd.armor, weapons: srd.weapons, tools: srd.tools, beasts: srd.beasts, languages: srd.languages, classes,
    classGear: classGearRules(goods.class_gear), speciesAndPeople: setting.data.species_and_people.text,
    backgrounds: [...srd.backgrounds.map(b => ({ ...b, source: 'SRD 5.2.1' })), ...setting.data.backgrounds.map(b => ({ ...b, source: 'Euphonia' }))]
      .map(b => ({ ...b, packages: packagesOf(b.equipment, b.name) })),
    // What a character starting past level 1 adds to its starting equipment:
    // the money's fixed part ("500 GP plus 1d10 × 25 GP" counts 500; the roll
    // is the table's to make) and the magic items, by the levels each row
    // covers.
    higherLevelEquipment: srd.tables.higher_level_equipment.map(r => {
      const [lo, hi = lo] = r['Starting Level'].split('–').map(Number);
      const money = r['Equipment and Money'], gold = money.match(/^([\d,]+) GP plus 1d10 × [\d,]+ GP plus normal starting equipment$/i);
      if (!gold && money !== 'Normal starting equipment') throw new Error(`Starting Equipment at Higher Levels, ${r['Starting Level']}: "${money}" doesn't read as the builder reads it`);
      const magic = r['Magic Items'].split(/,\s*/).map(x => {
        const m = x.match(/^(\d+) (Common|Uncommon|Rare|Very Rare|Legendary)$/);
        if (!m) throw new Error(`Starting Equipment at Higher Levels, ${r['Starting Level']}: "${x}" isn't a count of magic items of one rarity`);
        return { count: +m[1], rarity: m[2] };
      });
      return { lo, hi, gold: gold ? number(gold[1]) : 0, roll: gold ? money.match(/1d10 × [\d,]+ GP/i)[0] : null, magic };
    }),
    placement: name => {
      const row = setting.data.species.find(x => x.species.includes(name));
      return row ? { line: row.line, status: setting.data.species_status } : null;
    },
    classNamed: name => classes.find(c => c.name === name),
    // What each spell deals and how it's cast: the SRD's, and the spells the
    // setting's classes add (Arc is a Sorcerer and Wizard spell the
    // Physician's chapter carries).
    spellFacts: new Map([...(srd.spells ?? []), ...euphonia.data.flatMap(c => c.new_spells ?? [])].map(sp => [sp.name, sp])),
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
  // Problems stop a character being built as chosen; notes are facts worth
  // saying (a skill granted twice).
  const problems = [], notes = [];
  // A problem is open (a choice not made yet) or a rule broken by what was
  // chosen. The sheet says the first quietly and the second plainly. The
  // wording tells them apart except where one check covers both, which says.
  const fail = (field, message, open = OPEN_CHOICE.test(message)) => problems.push({ field, message, open });
  const species = book.species.find(s => s.name === state.species) ?? null;
  const background = book.backgrounds.find(b => b.name === state.background) ?? null;
  if (!species) fail('species', 'Choose a species.');
  if (!background) fail('background', 'Choose a background.');

  // The base scores, by the method chosen.
  // An unassigned score is unknown (NaN), never Number(null)'s 0, so what's
  // derived from it stays unknown too.
  const base = Object.fromEntries(ABILITIES.map(a => [a, state.base?.[a] === null || state.base?.[a] === '' ? NaN : Number(state.base?.[a])]));
  const given = ABILITIES.map(a => base[a]), unscored = !given.every(Number.isFinite);
  if (state.method === 'standard') {
    const sorted = [...given].sort((a, b) => b - a), array = [...book.standardArray].sort((a, b) => b - a);
    if (!sorted.every((v, i) => v === array[i])) fail('base', `Give each ability one of the standard array's scores: ${book.standardArray.join(', ')}.`, unscored);
  } else if (state.method === 'point') {
    if (!given.every(v => book.pointCosts.has(v))) fail('base', `Point Cost buys scores from ${Math.min(...book.pointCosts.keys())} to ${Math.max(...book.pointCosts.keys())}.`, unscored);
    else {
      const spent = given.reduce((n, v) => n + book.pointCosts.get(v), 0);
      if (spent > book.pointBudget) fail('base', `That costs ${spent} points; you have ${book.pointBudget}.`);
    }
  } else if (state.method === 'rolled') {
    // Four d6, the highest three: 3 to 18.
    if (!given.every(v => Number.isInteger(v) && v >= 3 && v <= 18)) fail('base', 'Rolled scores run from 3 to 18.', unscored);
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
  // Every feature the engine reads into a grant or a choice, by class,
  // level and name: verify-euphonia-builder holds each feature that asks
  // for a lasting choice to be one of them.
  const read = new Set();
  const reads = f => read.add(`${f.class} ${f.level} ${f.name}`);
  // Spells beyond a feature's own count that another rule adds, by class
  // (The Monster Within's Deeper Draw adds one to Font-Touched).
  const moreTouched = {};
  for (const c of known) {
    for (const f of c.rules.features) if (f.level <= c.level) features.push({ class: c.class, level: f.level, name: f.name, text: f.text });
    if (c.level >= c.rules.subclassLevel) {
      const sub = c.rules.subclasses.find(s => s.name === c.subclass);
      if (!sub) fail(`subclass:${c.class}`, `Choose a ${c.class} subclass.`);
      else for (const f of sub.features) if (f.level <= c.level) features.push({ class: c.class, subclass: sub.name, level: f.level, name: f.name, text: f.text });
    } else if (c.subclass) fail(`subclass:${c.class}`, `${c.class} gains a subclass at level ${c.rules.subclassLevel}.`);
    for (const imp of c.rules.improvements) if (imp.level <= c.level) { improvements.push({ key: `${c.class} ${imp.level}`, class: c.class, ...imp }); reads({ class: c.class, level: imp.level, name: imp.kind }); }
    if (c.level >= c.rules.subclassLevel) reads({ class: c.class, level: c.rules.subclassLevel, name: c.rules.subclassFeature });
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
    const picks = state.options?.[c.class] ?? [];
    // One the subclass gives that's taken already gives one more instead,
    // of the art it names: a further choice, after the column's.
    const offered = (sub ? o.given[sub.name] ?? [] : []).filter(g => g.level <= c.level);
    const twice = offered.filter(g => g.instead && picks.slice(0, count).some(p => p?.name === g.name));
    const extra = twice.map(g => ({ art: g.instead, from: g.from }));
    const given = offered.filter(g => !twice.includes(g)).map(g => {
      const x = o.list.find(y => y.name === g.name), field = `option:${c.class}:given:${g.name}`;
      return { ...x, from: g.from, instead: g.instead, field, art: artOf(x, state.optionArts?.[`${c.class} ${g.name}`], field) };
    });
    const taken = [];
    for (let i = 0; i < count + extra.length; i++) {
      const field = `option:${c.class}:${i}`, pick = picks[i], instead = i >= count ? extra[i - count] : null;
      const x = open.find(y => y.name === pick?.name && (!instead || artsOf(y).includes(instead.art)));
      if (instead && !x) { fail(field, pick?.name ? `${pick.name} isn't of the art of ${instead.art}, which ${instead.from} gives instead.` : `Choose one more ${o.noun} of the art of ${instead.art}, which ${instead.from} gives instead.`); continue; }
      if (!x) { fail(field, pick?.name ? `${pick.name} isn't open to a level ${c.level} ${c.class}${forgone ? ` of ${sub.name}, which forgoes ${forgone}` : ''}.` : `Choose ${o.noun} ${i + 1} of ${count}.`); continue; }
      const had = [...given, ...taken].filter(t => t.name === x.name).length;
      if (had >= x.repeat) { fail(field, `${x.name} can be taken ${x.repeat === 1 ? 'once' : 'twice'}${given.some(g => g.name === x.name) ? `, and ${given.find(g => g.name === x.name).from} gives it` : ''}.`); continue; }
      taken.push({ ...x, field, index: i, art: instead ? instead.art : x.arts.length ? artOf(x, pick.art, field) : null });
    }
    // An option that needs another ("Pact of the Blade Invocation") needs it
    // among those taken.
    for (const t of taken) for (const r of t.requires ?? []) if (![...given, ...taken].some(x => x.name === r)) fail(t.field, `${t.name} needs ${r}.`);
    const regard = new Set([...given, ...taken].map(t => t.art).filter(Boolean)).size;
    optionChoices.push({ class: c.class, noun: o.noun, column: o.column, count, extra, open, forgone, subclass: sub?.name ?? null, given, taken, regard, arts: [...new Set(o.list.flatMap(x => x.arts))] });
    const lists = features.find(f => f.class === c.class && f.name === o.feature);
    if (lists) reads(lists);
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
  // read with the tools. Its named paragraphs can follow another (the
  // Hunter's Prey: "Whenever you finish a Short or Long Rest, you can
  // replace the chosen option").
  const pickChoices = [];
  for (const f of [...features]) {
    const offers = f.text.match(/\bone of the following (?:[\w ]+ )?of your choice(?:[^.\n]*)[.:]\s*(\S)?/);
    if (!offers || /one of the following skills/.test(f.text) || offers[1] === '-') continue;
    const offered = [...f.text.matchAll(/^\*\*([^*]+?)\.\*\* (.+)$/gm)].map(m => ({ name: m[1], text: m[2] }));
    if (offered.length < 2 && offers[1] === '*') throw new Error(`${f.name}: "one of the following" names ${offered.length} option(s)`);
    if (offered.length < 2) continue;
    reads(f);
    const key = `${f.class} ${f.level} ${f.name}`, chosen = offered.find(x => x.name === state.picks?.[key]);
    // The feature keeps its lead; its options are the choice, the one taken a
    // feature of its own, so nothing reads the one not taken.
    f.text = f.text.split('\n\n').filter(p => !offered.some(x => p.startsWith(`**${x.name}.**`))).join('\n\n');
    pickChoices.push({ key, label: `${f.name} (${f.class} ${f.level})`, offered, chosen: chosen?.name ?? null });
    if (!chosen) { fail(`pick:${key}`, `Choose ${listed(offered.map(x => x.name), 'or')} for ${f.name}.`); continue; }
    features.push({ class: f.class, level: f.level, name: `${f.name}: ${chosen.name}`, text: chosen.text, key: `${key} ${chosen.name}` });
  }
  // A class's optional rule, taken where the DM allows it (The Monster
  // Within): who may take it and when ("only an Immortalist can take it. You
  // choose it when you reach Physician level 4"), and the record it keeps,
  // as its text lays out: each Rite at the levels it names passed, failed or
  // declined; a pass the next of the Ascendance list's boons, the first
  // failure the Monster carried and each after it the next of the
  // Overgrowth list's; what The Shifting Balance gives a carrier by level;
  // and at the Final Rite's level, for one who attempted every Rite,
  // resignation or the outcome rolled at the table. Deeper Draw and the first
  // boon each add a spell to Font-Touched; Mastery brings Wish, always
  // prepared. Its sections are features from then on, the record's with them.
  const optionalRules = [], optionalSpells = [];
  for (const c of known) for (const rule of c.rules.optional_rules ?? []) {
    // Who may take it is the lead's; when, the lead's or a section's ("The
    // Path in Order": "You choose it when you reach Physician level 4").
    const who = rule.lead.match(/only an? (\w+) can take it\./)?.[1];
    const when = [rule.lead, ...rule.sections.map(x => x.text)].join('\n').match(/You choose it when you reach \w+ level (\d+)/);
    if (!who || !when) throw new Error(`${c.class}: the optional rule ${rule.name} doesn't say who may take it, and when`);
    const key = `${c.class} ${rule.name}`, kept = state.optional?.[key] ?? {}, at = +when[1];
    if (c.subclass !== who || c.level < at) continue;
    const section = name => rule.sections.find(x => x.name === name)?.text ?? '';
    const numbered = (text, title) => (text.match(new RegExp(`\\*\\*[^*]*${title}[^*]*\\*\\*[^\\n]*`))?.[0].split(/\*\*\(\d\)\*\*\s*/).slice(1) ?? []).map(x => x.replace(/[;.]\s*$/, '').trim());
    const rites = section('The Rites'), ascendance = numbered(rites, 'Ascendance'), overgrowth = numbered(rites, 'the Monster');
    const riteLevels = [at, ...(rites.match(/and again when you reach levels ([\d, and]+)/)?.[1].match(/\d+/g) ?? []).map(Number)].filter(l => c.level >= l);
    const entry = { key, class: c.class, name: rule.name, place: rule.place, at, lead: rule.lead, taken: Boolean(kept.taken), rites: [], ascendance, overgrowth, boons: [], growth: [], carries: false, final: null };
    optionalRules.push(entry);
    if (!entry.taken) continue;
    let passed = 0, failed = 0, declined = false;
    for (const level of riteLevels) {
      const outcome = ['passed', 'failed', ...(level === at ? [] : ['declined'])].find(o => o === kept.rites?.[level]) ?? null;
      entry.rites.push({ level, outcome });
      if (!outcome) { fail(`optional:${key} ${level}`, `Say how the Rite at level ${level} went.`); continue; }
      if (outcome === 'passed') entry.boons.push(ascendance[passed++]);
      if (outcome === 'failed') { if (failed++) entry.growth.push(overgrowth[failed - 2]); entry.carries = true; }
      if (outcome === 'declined') declined = true;
    }
    const finalText = section('The Final Rite'), finalAt = +(finalText.match(/When you reach \w+ level (\d+)/)?.[1] ?? 0);
    const outcomes = [...finalText.matchAll(/^\*\*(Resignation|Mastery|The Arrival|The Eruption|Acceptance)\.\*\*/gm)].map(m => m[1]);
    if (finalAt && c.level >= finalAt && !declined && entry.rites.length === riteLevels.length && riteLevels.length) {
      const offered = passed === 0 && entry.rites.every(r => r.outcome === 'failed') ? ['Acceptance'] : outcomes.filter(o => o !== 'Acceptance');
      const chosen = offered.find(o => o === kept.final) ?? (offered.length === 1 ? offered[0] : null);
      entry.final = { level: finalAt, offered, chosen };
      if (!chosen) fail(`optional:${key} final`, `Say how the Final Rite went: ${listed(offered, 'or')}.`);
      if (chosen === 'Resignation' && passed < ascendance.length) entry.boons.push(ascendance[passed]);
      if (chosen === 'Mastery') { entry.boons = [...ascendance]; if (entry.carries) entry.growth = [...overgrowth]; optionalSpells.push({ class: c.class, name: finalText.match(/\*\*Mastery\.\*\* You learn the \*([^*]+)\* spell/)?.[1], from: rule.name }); }
    }
    // Deeper Draw ("You also choose one additional spell with your
    // Font-Touched feature") and the boon that says the same.
    const touched = n => /choose one additional spell with your Font-Touched feature/.test(n);
    moreTouched[c.class] = (moreTouched[c.class] ?? 0) + (touched(section('Deeper Draw')) ? 1 : 0) + entry.boons.filter(touched).length;
    const balance = section('The Shifting Balance');
    const shown = rule.sections.filter(x => x.name !== 'The Shifting Balance' && (x.name !== 'Monster Form' || entry.carries));
    for (const x of shown) { features.push({ class: c.class, subclass: c.subclass, level: at, name: `${rule.name}: ${x.name}`, text: x.text, optional: true }); reads({ class: c.class, level: at, name: `${rule.name}: ${x.name}` }); }
    if (entry.carries) for (const m of balance.matchAll(/^- \*\*Level (\d+) — ([^.]+)\.\*\* (.+)$/gm)) if (c.level >= +m[1]) features.push({ class: c.class, subclass: c.subclass, level: +m[1], name: `${rule.name}: ${m[2]}`, text: m[3], optional: true });
  }
  // A lasting choice a feature writes as a list in a sentence of its own:
  // "Choose one of those types: Acid, …" (Elemental Affinity), "Choose the
  // light half or the dark half" (the Danae's Half), "Choose one damage
  // type, other than Force" (the SRD's types, Fiendish Resilience). A choice
  // made inside a "when" is made in play, and isn't one, except one that
  // stands until the next rest ("When you finish a Long Rest, choose the
  // suit's model, Infiltrator or Guardian"; "…, choose one of your
  // energies", from the list another of the class's features names as
  // them): the sheet shows the one in force. The one chosen is a feature
  // from then on, with what the feature sets beside it: its rows of a table
  // ("| Light | **Spring** |"), or its line of a list ("**Fire.** *Fire
  // Bolt*, then …", "- *Infiltrator model.* …").
  const kindChoices = [];
  for (const f of [...features]) {
    const named = f.text.match(/(?:^|[.!]\s+)Choose (?:an? |one of (?:those|these) )([a-z ]+?): ((?:[A-Z][\w']*(?: [A-Z][\w']*)*, )+[A-Z][\w']*(?: [A-Z][\w']*)*,? or [A-Z][\w']*(?: [A-Z][\w']*)*)\./);
    const pair = f.text.match(/(?:^|[.!]\s+)Choose the (\w+) (\w+) or the (\w+) \2\./);
    const typed = f.text.match(/(?:^|[.!]\s+)Choose (?:one|a) damage type(?!:)(?:, other than ([^,.]+),)?/);
    const rested = f.text.match(/(?:^|[.!]\*?\s+)When you finish a Long Rest, choose the [\w’']+ (\w+), ([A-Z]\w+) or ([A-Z]\w+)\./);
    const yours = f.text.match(/(?:^|[.!]\*?\s+)When you finish a Long Rest, choose one of your (\w+):/);
    const defined = yours && features.filter(x => x.class === f.class).map(x => x.text.match(new RegExp(`((?:[A-Z]\\w+, )+[A-Z]\\w+,? or [A-Z]\\w+)\\. These are your \\*\\*${yours[1]}\\*\\*`))).find(Boolean);
    if (!named && !pair && !typed && !rested && !defined) continue;
    // "One of those types" asks for one type; so does a choice among damage
    // types a feature names as yours.
    const own = defined ? list(defined[1]) : null;
    const noun = named ? named[1].replace(/s$/, '') : pair ? pair[2] : typed ? 'damage type' : rested ? rested[1] : own.every(t => book.damageTypes.includes(t)) ? 'damage type' : yours[1].replace(/s$/, ''), cap = x => x[0].toUpperCase() + x.slice(1);
    const offered = named ? list(named[2]) : pair ? [cap(pair[1]), cap(pair[3])] : typed ? book.damageTypes.filter(t => !list(typed[1] ?? '').includes(t)) : rested ? [rested[2], rested[3]] : own;
    const key = f.key ?? `${f.class} ${f.level} ${f.name}`, chosen = offered.find(x => x === state.kinds?.[key]) ?? null;
    kindChoices.push({ key, class: f.class, label: `${f.name} (${f.class} ${f.level})`, noun, offered, chosen });
    reads(f);
    if (!chosen) { fail(`kind:${key}`, `Choose ${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun} for ${f.name}.`); continue; }
    const rows = f.text.split('\n').filter(l => new RegExp(`^\\| ${chosen} \\||^> \\*\\*${chosen}\\.\\*\\*|^\\s*- \\*${chosen} ${noun}\\.\\*`).test(l));
    const head = rows[0]?.startsWith('|') ? f.text.split('\n').find(l => /^\| [A-Z]/.test(l)) : null;
    features.push({ class: f.class, subclass: f.subclass, level: f.level, name: `${f.name}: ${chosen}`, kind: true, text: rows.length ? [head, head && head.replace(/[^|]+/g, '---'), ...rows].filter(Boolean).map(l => l.replace(/^> |^\s*- /, '')).join('\n') : `${chosen}.` });
  }

  // The Revelations a class with a Cosmography knows: those its features
  // name ("You start knowing two, …: the Hidden and the Ghostlands", "You
  // know the Revelation of Elysium"), every one once a feature says so, and
  // one for each feature that teaches "one Revelation of your choice from
  // the Cosmography's Near Planes, …", from the groups it names and not one
  // already known. A choice is the player's, kept apart from the rest.
  const revelationChoices = [], revelationsKnown = [];
  const plane = name => name.toLowerCase().replace(/^the /, '');
  // A feature may name a group and then gloss it: "the Inner Circuit (the
  // five planes the pathways reach at level 7)", "the Dominions' Quiet
  // Corners". The group's name leads; a parenthesis or a possessive follows.
  const namesGroup = (ref, group) => {
    const r = plane(ref), g = plane(group);
    return r === g || (r.startsWith(g) && /^(?: \(|['’])/.test(r.slice(g.length)));
  };
  for (const c of known.filter(k => k.rules.revelations)) {
    const own = features.filter(f => f.class === c.class);
    const find = (name, f) => {
      const r = c.rules.revelations.find(x => plane(x.name) === plane(name.trim()));
      if (!r) throw new Error(`${c.class}: ${f.name} names the Revelation of "${name}", which its Cosmography doesn't hold`);
      return r;
    };
    const granted = new Map();
    for (const f of own) {
      const start = f.text.match(/You start knowing \w+, [^:]+: (.+?)\./);
      const names = [...(start ? start[1].split(/,\s*|\s+and\s+/) : []), ...[...f.text.matchAll(/You know the Revelation of ([^,.]+)/g)].map(m => m[1])];
      for (const n of names) granted.set(find(n, f).name, { ...find(n, f), from: f.name });
      // A choice of Revelation is read where it's offered, below.
      if (names.length || /Revelations are the planes you know|You know every Revelation/.test(f.text)) reads(f);
    }
    const every = own.find(f => /You know every Revelation in the Cosmography/.test(f.text));
    const chosen = [];
    for (const f of own) {
      // "…from the Cosmography's Near Planes: …", or "…from the Near Planes,
      // the Inner Circuit, the Borderlands, or the Dominions (The Planes by
      // Tier)." A parenthesis there points to where the groups are listed.
      const teaches = f.text.match(/You learn one Revelation of your choice from (?:the Cosmography's )?(.+?)(?: \([^)]*\))?[:.](?:\s|$)/);
      if (!teaches) continue;
      const groups = teaches[1].split(/,\s*(?:or\s+)?|\s+or\s+/).map(g => {
        const group = c.rules.cosmography.groups.find(x => namesGroup(g, x.name));
        if (!group) throw new Error(`${c.class}: ${f.name} teaches from the Cosmography's "${g}", which it doesn't have`);
        return group.name;
      });
      const key = `${c.class} ${f.level} ${f.name}`;
      reads(f);
      const options = c.rules.revelations.filter(r => groups.includes(r.group) && !granted.has(r.name));
      const pick = options.find(r => r.name === state.revelations?.[key]) ?? null;
      if (state.revelations?.[key] && !pick) fail(`revelation:${key}`, `${f.name} can't teach ${state.revelations[key]}.`);
      else if (pick && chosen.some(x => x.name === pick.name)) fail(`revelation:${key}`, `${pick.name} is already chosen.`);
      else if (!pick && !every) fail(`revelation:${key}`, `Choose a Revelation for ${f.name}.`);
      if (pick) chosen.push({ ...pick, from: f.name });
      revelationChoices.push({ key, class: c.class, label: `${f.name} (${c.class} ${f.level})`, groups, options, chosen: pick?.name ?? null, moot: Boolean(every) });
    }
    const list = every ? c.rules.revelations.map(r => ({ ...r, from: granted.get(r.name)?.from ?? every.name })) : [...granted.values(), ...chosen.filter(x => !granted.has(x.name))];
    revelationsKnown.push({ class: c.class, every: Boolean(every), known: list });
  }

  // A choice of someone or somewhere, with no rules to choose among: "a
  // patron at one court or great house of your choice", "artist to one
  // sovereign of your choice", "a fencing school in a city of your choice",
  // "Choose one gaming house, salon, or court", "Choose one of the laws the
  // DM named for it", "a house: a bank, a merchant company, or a guild,
  // which you and the DM choose together". Named in the player's words, and
  // kept on the sheet.
  // Only someone or somewhere: a court, a great house, a sovereign, a city,
  // a guild, an order and their like, the nouns the books choose them by.
  const NAMED = /\b(?:at|to|in) (?:one|a) ((?:court or great house|great house|court|sovereign|city|town|guild|house|order|temple|school|kingdom)) of your choice|Choose one ([\w ,]+?) where|Choose one of the (laws) the DM named|(?:of a )?(house): ([\w ,]+?), which you and the DM choose together/;
  const noteChoices = [];
  for (const f of features) {
    const m = f.text.match(NAMED);
    if (!m) continue;
    reads(f);
    const key = f.key ?? `${f.class} ${f.level} ${f.name}`, what = (m[1] ?? m[2] ?? m[3] ?? `${m[4]} (${m[5]})`).trim(), named = String(state.notes?.[key] ?? '').trim();
    noteChoices.push({ key, label: f.label ?? `${f.name} (${f.class} ${f.level})`, what, named });
    if (!named) fail(`note:${key}`, `Name your ${what.replace(/^(?:court or great house|gaming house, salon, or court)$/, x => x.replace(/, or | or /, ' or '))} for ${f.name}.`);
  }
  // A Revelation that counts as walked (Soul's Journey's First Voyage):
  // "one Revelation you know counts as walked", the player's, and none the
  // sentence rules out where it does ("other than your earth end or the
  // Border Ethereal").
  const walkedChoices = [];
  for (const k of revelationsKnown) for (const f of features.filter(x => x.class === k.class)) {
    const m = f.text.match(/one Revelation you know(?:, other than (.+?),)? counts as walked/);
    if (!m) continue;
    reads(f);
    const not = m[1]?.split(/,\s*(?:or\s+)?|\s+or\s+/) ?? [], key = `${f.class} ${f.level} ${f.name}`;
    const offered = k.known.filter(r => !not.some(n => (/earth end/.test(n) ? r.group === 'The Earth Ends' : plane(r.name) === plane(n)))).map(r => r.name);
    const pick = offered.find(n => n === state.walked?.[key]) ?? null;
    walkedChoices.push({ key, label: `${f.name} (${f.class} ${f.level})`, offered, chosen: pick });
    if (!pick) fail(`walked:${key}`, `Choose the Revelation your first voyage walked, for ${f.name}.`);
  }
  // Wild Shape's known forms: so many Beasts, each within the Challenge
  // Rating the feature's table gives the class's level and with a Fly Speed
  // only once it allows one ("| 2 | 4 | 1/4 | No |"), from the SRD's Beast
  // stat blocks.
  const formChoices = [];
  for (const f of features) {
    if (!/You know \w+ Beast forms for this feature, chosen from among Beast stat blocks/.test(f.text)) continue;
    reads(f);
    const c = known.find(k => k.class === f.class);
    const rows = [...f.text.matchAll(/^\| (\d+) \| (\d+) \| ([\d/]+) \| (Yes|No) \|$/gm)].map(m => ({ level: +m[1], count: +m[2], cr: m[3].split('/').map(Number).reduce((a, b) => a / b), fly: m[4] === 'Yes' })).filter(r => r.level <= c.level);
    const row = rows.at(-1);
    if (!row) continue;
    const key = `${f.class} ${f.level} ${f.name}`, from = (book.beasts ?? []).filter(b => b.challenge <= row.cr && (row.fly || !b.fly));
    const got = (state.forms?.[key] ?? []).filter(n => from.some(b => b.name === n));
    formChoices.push({ key, label: `${f.name} (${f.class} ${c.level})`, count: row.count, cr: row.cr, fly: row.fly, from, chosen: got });
    if (got.length !== row.count || new Set(got).size !== got.length) fail(`forms:${key}`, `Choose ${row.count} Beast forms for ${f.name}, up to Challenge Rating ${f.text.match(new RegExp(`^\\| ${row.level} \\| \\d+ \\| ([\\d/]+)`, 'm'))[1]}${row.fly ? '' : ', none that flies'}.`);
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
    else if (!ok.ok) fail(`improvement:${imp.key}`, `${feat.name} needs ${ok.why.join(' and ')}.`, unscored);
    if (!feat.repeatable && feats.some(f => f.feat.name === feat.name)) fail(`improvement:${imp.key}`, `${feat.name} can be taken once.`);
    const inc = featIncrease(feat);
    if (inc) {
      if (!fits(pick.increases, inc.from, inc.shapes)) fail(`improvement:${imp.key}`, `Choose how ${feat.name} raises your scores.`);
      else raise(pick.increases, inc.max);
    }
    feats.push({ from: `${imp.class} ${imp.level}`, feat });
  }
  // A feature that grants "a Fighting Style feat of your choice" (or
  // "another", or "proficiency with Martial weapons and a Fighting Style feat
  // of your choice"): a feat from that category, the player's, or the option
  // the feature offers instead ("Instead of choosing one of those feats, you
  // can choose the option below. **Blessed Warrior.** You learn two Cleric
  // cantrips of your choice"), whose cantrips count as the class's.
  const styleChoices = [], warriorCantrips = [];
  for (const f of features) {
    if (!/gain (?:proficiency with [^.]+? and )?(?:a|another) Fighting Style feat of your choice/.test(f.text)) continue;
    reads(f);
    const key = f.key ?? `${f.class} ${f.level} ${f.name}`, from = `${f.class} ${f.level}`;
    const instead = /Instead of choosing one of those feats, you can choose the option below/.test(f.text)
      ? [...f.text.matchAll(/^\*\*([^*]+?)\.\*\* You learn (\w+) (\w+) cantrips of your choice/gm)].map(m => ({ name: m[1], count: NUMBERS.indexOf(m[2]), list: m[3] })) : [];
    styleChoices.push({ key, label: f.label ?? `${f.name} (${from})`, instead });
    const alt = instead.find(x => x.name === state.styles?.[key]);
    if (alt) { warriorCantrips.push({ key: `${key} ${alt.name}`, label: `${alt.name} (${f.class})`, class: f.class, ...alt }); continue; }
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
  for (const f of features) if (/gain one Origin feat of your choice/.test(f.text)) reads(f);
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
      if (!met) fail('classes', `Multiclassing needs ${abilities.join(any ? ' or ' : ' and ')} ${score} or more, for ${c.class}.`, unscored);
    }
  }

  // Proficiencies: the first class's saves and skills; a later class's
  // skill, the background's, and what the species' traits grant.
  const first = known[0]?.rules ?? null;
  const saves = [...(first?.saves ?? [])], saveChoices = [];
  for (const f of features) {
    const m = f.text.match(/You gain proficiency in (\w+) saving throws\.(?: If you already have it, you instead gain proficiency in (\w+) or (\w+) saving throws \(your choice\))?/);
    if (!m) continue;
    reads(f);
    if (!saves.includes(m[1])) { saves.push(m[1]); continue; }
    if (!m[2]) continue;
    const key = `${f.class} ${f.level} ${f.name}`, pick = [m[2], m[3]].find(x => x === state.saves?.[key] && !saves.includes(x)) ?? null;
    saveChoices.push({ key, label: `${f.name} (${f.class} ${f.level})`, offered: [m[2], m[3]].filter(x => !saves.includes(x)), chosen: pick });
    if (pick) saves.push(pick); else fail(`save:${key}`, `Choose ${m[2]} or ${m[3]} saving throws for ${f.name}.`);
  }
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
    const valid = new Set(got).size === got.length && got.every(s => from.includes(s));
    if ((upTo ? got.length > count : got.length !== count) || !valid) fail(`skills:${key}`, `Choose ${upTo ? 'up to ' : ''}${count} skill${count === 1 ? '' : 's'}${from.length < book.skills.length ? ` from ${from.join(', ')}` : ''}.`, valid && got.length < count);
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
    const some = f.text.match(/You gain proficiency (?:with [^.]+? and )?in (\w+) of (?:these skills|the following skills of your choice): (.+?)\./);
    if (some) {
      reads(f);
      if (NUMBERS.indexOf(some[1]) < 1) throw new Error(`${f.name}: a skill count the builder doesn't read: "${some[1]}"`);
      chosen(key, list(some[2]), NUMBERS.indexOf(some[1]), state.skills?.[key], label);
      continue;
    }
    // Skills it names, each one ("proficiency in the Insight and Medicine
    // skills", "in the Stealth skill"): granted; one already the character's,
    // where the feature says "choose another skill" (from a class's list, if
    // it names one), is replaced by one of the player's choice.
    const all = f.text.match(/proficiency (?:with [^.]+? and )?in the ([A-Z][\w ]+?(?:,? and [A-Z][\w ]+?)?) skills?\b/);
    if (all && !/\bor\b/.test(all[1])) {
      reads(f);
      const instead = f.text.match(/choose another (?:tool or )?skill(?: from the (.+?)[’']s skill list)?/);
      for (const sk of list(all[1])) {
        if (!book.skills.some(x => x.name === sk)) throw new Error(`${f.name}: "${sk}" isn't a skill`);
        const k = `${key} instead of ${sk}`;
        if (sources.has(sk) && instead) chosen(k, (instead[1] ? book.classNamed(instead[1])?.skills.from : null) ?? book.skills.map(x => x.name), 1, state.skills?.[k], `${label}, instead of ${sk}`);
        else grant(sk, label);
      }
      continue;
    }
    const any = f.text.match(/proficiency with (\w+) skills of your choice/);
    if (any) { reads(f); chosen(key, book.skills.map(x => x.name), NUMBERS.indexOf(any[1]), state.skills?.[key], label); continue; }
    const from = skillGrant(f.text, book.skills.map(s => s.name), book.classNamed(f.class)?.skills.from);
    if (from) { reads(f); chosen(key, from, 1, state.skills?.[key], label); }
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
    // Or, where that skill has Expertise already, "Expertise in another
    // skill you're proficient in".
    const already = named && /if you already have Expertise in it, you gain Expertise in another skill you're proficient in/.test(f.text) && [named[1], named[2]].filter(Boolean).every(sk => expert.has(sk));
    if (named) asks.push(already ? { count: 1, from: null } : { count: 1, from: [named[1], named[2]].filter(Boolean), grants: true });
    if (asks.length) reads(f);
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
  // Tools, as the SRD's Tools section names them, a Gaming Set's and a
  // Musical Instrument's variants each "a separate proficiency": from the
  // first class's Tool Proficiencies, a later class's multiclass gain, the
  // background, the features ("proficiency with the Poisoner's Kit",
  // "Painter's Supplies and one other type of Artisan's Tools", "your
  // choice of Tinker's Tools or Woodcarver's Tools", "one of the following
  // tools of your choice: …"), and the Skilled feat's tools beside its
  // skills. One already the character's, where the feature says "choose
  // another tool" (or "another type of Artisan's Tools", or "another tool
  // from the Natural Philosopher's tool list"), is replaced by the player's
  // choice. Expertise with tools: "Choose two of your tool proficiencies".
  const toolBook = book.tools ?? [];
  const concrete = toolBook.flatMap(t => (t.variants ? t.variants.map(v => `${t.name} (${v})`) : [t.name]));
  const norm = x => x.replace(/'/g, '’').replace(/^(?:the|a|an) /i, '').trim().toLowerCase();
  const toolNamed = x => concrete.find(t => norm(t) === norm(x)) ?? null;
  const classTools = name => {
    const t = book.classNamed(name)?.traits.find(x => x.trait === 'Tool Proficiencies')?.value ?? '';
    return toolPhrase(t, name).flatMap(x => x.from ?? [x]);
  };
  // A category as concrete tools: "one type of Artisan's Tools", "a Gaming
  // Set (one of your choice)", "Musical Instruments", "one tool of your
  // choice from the Danae's tool list", "one tool".
  function toolCategory(phrase) {
    const p = norm(phrase).replace(/^(?:one|two|three|another|other) /, '').replace(/^(?:other )?(?:type|kind)s? of /, '').replace(/ \(one of your choice\)| of your choice$/g, '');
    const list = p.match(/^tool of your choice from the (.+?)’s tool list$/) ?? p.match(/^tool from the (.+?)’s tool list$/);
    if (list) return classTools(list[1].replace(/\b\w/g, c => c.toUpperCase()));
    if (/^artisan’s tools$/.test(p)) return toolBook.filter(t => t.category === 'Artisan’s Tools').map(t => t.name);
    if (/^gaming sets?$/.test(p)) return concrete.filter(t => t.startsWith('Gaming Set ('));
    if (/^musical instruments?$/.test(p)) return concrete.filter(t => t.startsWith('Musical Instrument ('));
    if (/^tools?$/.test(p)) return concrete;
    return null;
  }
  // A phrase's tools: each named (a string), or so many from a list or a
  // category ({ count, from }).
  function toolPhrase(text, where) {
    const t = text.replace(/\*/g, '').replace(/\s*\(see “Equipment”\)/, '').trim();
    if (!t) return [];
    const flat = items => [...new Set(items.flatMap(x => { const named = toolNamed(x); if (named) return [named]; const c = toolCategory(x); if (!c) throw new Error(`${where}: "${x}" isn't a tool the builder knows`); return c; }))];
    const choose = t.match(/^Choose (\w+):? (.+)$/i);
    if (choose && !/^(?:type|kind) of /.test(choose[2])) {
      const count = /^\d+$/.test(choose[1]) ? +choose[1] : NUMBERS.indexOf(choose[1].toLowerCase());
      const many = choose[2].match(/^(Musical Instruments|Gaming Sets)$/);
      return [{ count, from: many ? toolCategory(many[1]) : flat(list(choose[2])) }];
    }
    const kind = t.match(/^Choose (\w+) (?:type|kind) of (.+)$/i);
    if (kind) return [{ count: NUMBERS.indexOf(kind[1].toLowerCase()), from: flat(list(kind[2])) }];
    const pick = t.match(/^(?:your choice of|one of the following tools of your choice:) (.+)$/i);
    if (pick) return [{ count: 1, from: flat(list(pick[1])) }];
    // "one musical instrument, one type of Artisan's Tools, or the Disguise
    // Kit": one of them all.
    if (/,? or /.test(t) && !/ and /.test(t)) return [{ count: 1, from: flat(list(t)) }];
    return t.split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim()).filter(Boolean).map(x => {
      const named = toolNamed(x);
      if (named) return named;
      const some = x.match(/^(two|three) (.+)$/i), c = toolCategory(some ? some[2] : x);
      if (!c) throw new Error(`${where}: "${x}" isn't a tool the builder knows`);
      return { count: some ? NUMBERS.indexOf(some[1].toLowerCase()) : 1, from: c };
    });
  }
  const toolSources = new Map(), toolChoices = [];
  const ownTool = (name, from) => toolSources.set(name, [...(toolSources.get(name) ?? []), from]);
  const takeTools = (parts, key, label, instead = null) => parts.forEach((x, i) => {
    if (typeof x === 'string') {
      if (!toolSources.has(x) || !instead) { ownTool(x, label); return; }
      x = { count: 1, from: instead, replaces: x };
    }
    const k = `${key}${parts.length > 1 ? ` ${i + 1}` : ''}${x.replaces ? ` instead of ${x.replaces}` : ''}`;
    const got = (state.tools?.[k] ?? []).filter(t => x.from.includes(t));
    toolChoices.push({ key: k, label: x.replaces ? `${label}, instead of ${x.replaces}` : label, count: x.count, from: x.from, chosen: got });
    if (got.length !== x.count) fail(`tools:${k}`, x.ask ?? `Choose ${x.count} tool${x.count === 1 ? '' : 's'} for ${label}.`, got.length < x.count);
    for (const t of got) ownTool(t, label);
  });
  if (first) takeTools(toolPhrase(first.traits.find(t => t.trait === 'Tool Proficiencies')?.value ?? '', first.name), first.name, first.name);
  for (const c of known.slice(1)) {
    const m = c.rules.multiclass.gains.match(/proficiency with ((?:one |two )?[^,]*?(?:Tools|Kit|Supplies|Instrument|tool)[^,]*?)(?:,| and training)/);
    if (m) takeTools(toolPhrase(m[1], c.class), `${c.class} multiclass tools`, `${c.class}, as a multiclass`);
  }
  if (background?.tool) takeTools(toolPhrase(background.tool, background.name), `${background.name} tools`, background.name);
  for (const f of features) {
    const key = `tools ${f.key ?? `${f.class} ${f.level} ${f.name}`}`, label = f.label ?? `${f.name} (${f.class} ${f.level})`;
    for (const m of f.text.matchAll(/gain proficiency (?:in the [\w ]+? skills? and )?with ([^.;]+?)(?=[.;]| \(if| and in | and you (?:have|always)| and learn| and the master)/g)) {
      if (!/Tools|Kit|Supplies|Utensils|Gaming Sets?|[Ii]nstruments?|\btools?\b/.test(m[1]) || /weapons?\b/.test(m[1])) continue;
      reads(f);
      const instead = f.text.match(/choose another (skill or tool|tool from the [\w ]+?[’']s tool list|type of Artisan['’]s Tools|tool)/);
      takeTools(toolPhrase(m[1], f.name), key, label, instead ? toolCategory(instead[1].replace(/^skill or /, '')) : null);
    }
  }
  for (const f of feats) {
    if (!/proficiency in any combination of (\w+) skills or tools of your choice/.test(f.feat.description ?? '')) continue;
    const count = NUMBERS.indexOf(f.feat.description.match(/combination of (\w+)/)[1]), skillsTaken = (state.skills?.[`feat ${f.from}`] ?? []).filter(Boolean).length;
    // One choice of skills and tools together, asked in two places: what the
    // skills leave is asked here as tools, in the feat's own terms.
    const left = count - skillsTaken;
    if (left > 0) takeTools([{ count: left, from: concrete, ask: `Choose ${left} more skill${left === 1 ? '' : 's'} or tool${left === 1 ? '' : 's'} for ${f.feat.name}, from ${f.from}.` }], `feat ${f.from}`, `${f.feat.name}, from ${f.from}: the tools, after any skills you took with it`);
  }
  // A tool chosen that's the character's already, from another source or
  // another choice, gives nothing: one more of the list's instead.
  for (const c of toolChoices) for (const t of c.chosen) if (toolSources.get(t).length > 1) fail(`tools:${c.key}`, `${t} is already yours; choose another for ${c.label}.`);
  const bonus = advancement.bonus;
  // Expertise doubles the Proficiency Bonus.
  // Expertise with tools: "Choose two of your tool proficiencies. You have
  // Expertise with them", or "two of your tool proficiencies, or one tool
  // proficiency and the Investigation skill (gaining proficiency in
  // Investigation first if you lack it)".
  const toolExpertise = [], toolExpert = new Set();
  for (const f of features) {
    const m = f.text.match(/Choose (\w+) of your tool proficiencies(?:, or one tool proficiency and the (\w+) skill)?/);
    if (!m) continue;
    reads(f);
    const key = `tool expertise ${f.class} ${f.level} ${f.name}`, count = NUMBERS.indexOf(m[1]);
    const from = [...toolSources.keys(), ...(m[2] ? [m[2]] : [])];
    const got = (state.tools?.[key] ?? []).filter(t => from.includes(t));
    toolExpertise.push({ key, label: `${f.name} (${f.class} ${f.level})`, count, from, skill: m[2] ?? null, chosen: got });
    if (got.length !== count || (m[2] && got.filter(t => t !== m[2]).length < count - 1)) fail(`tools:${key}`, `Choose ${count} for ${f.name}${m[2] ? `: tools you're proficient with, or one of them and ${m[2]}` : ' from your tool proficiencies'}.`);
    for (const t of got) {
      if (t === m[2]) { if (expert.has(t)) fail(`tools:${key}`, `${t} already has Expertise.`); expert.add(t); grant(t, f.name); proficient.add(t); }
      else toolExpert.add(t);
    }
  }
  const tools = [...toolSources].map(([name, from]) => ({ name, from, expertise: toolExpert.has(name) }));
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

  // Hit points: the first class's die at level 1, then each level's fixed
  // half die plus one, each with the Constitution modifier, at least 1.
  // Hit points: the first class's level 1 from the SRD's table, and each
  // level after either the fixed value or, as the player chooses, the Hit
  // Die rolled ("Roll that die, add your Constitution modifier to the roll,
  // and add the total (minimum of 1)").
  let hp = 0;
  const dice = {}, rolled = state.hp?.method === 'Rolled', hpRolls = [];
  for (const [k, c] of known.entries()) {
    const table = book.hitPoints[c.rules.die];
    if (!table) throw new Error(`${c.class}: a d${c.rules.die} the SRD's hit point tables don't give`);
    for (let l = 1; l <= (c.level || 0); l++) {
      if (k === 0 && l === 1) { hp += Math.max(1, table.first + mod.Constitution); continue; }
      if (!rolled) { hp += Math.max(1, table.fixed + mod.Constitution); continue; }
      const key = `${c.class} ${l}`, roll = Number(state.hp?.rolls?.[key]);
      const fair = Number.isInteger(roll) && roll >= 1 && roll <= c.rules.die;
      hpRolls.push({ key, class: c.class, level: l, die: c.rules.die, roll: fair ? roll : null });
      if (fair) hp += Math.max(1, roll + mod.Constitution);
      else { fail(`hp:${key}`, `Roll a d${c.rules.die} for ${c.class} level ${l}.`); hp = NaN; }
    }
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
  // Each choice so many cantrips and so many spells of level 1+, or, mixed,
  // so many of either (Magical Discoveries' "a cantrip or a spell").
  const pickSpells = (key, label, list, cantrips, prepared, highest, { verb = 'prepared', given = [], always = [], mixed = false } = {}) => {
    const got = (state.spells?.[key] ?? []).map(n => list.find(sp => sp.name === n)).filter(Boolean);
    if (got.length !== (state.spells?.[key] ?? []).length) fail(`spells:${key}`, `A spell chosen isn't on the ${label} list.`);
    const c = mixed ? [] : got.filter(sp => sp.level === 0), p = mixed ? got : got.filter(sp => sp.level > 0);
    if (c.length > cantrips) fail(`spells:${key}`, `${label} knows ${cantrips} cantrip${cantrips === 1 ? '' : 's'} of its choice; ${c.length} are chosen.`);
    if (p.length > prepared) fail(`spells:${key}`, `${label} ${verb === 'known' ? 'knows' : 'prepares'} ${prepared} spell${prepared === 1 ? '' : 's'}; ${p.length} are chosen.`);
    if (p.some(sp => sp.level > highest)) fail(`spells:${key}`, `${label}'s spells go up to level ${highest}.`);
    spellChoices.push({ key, label, list: list.filter(sp => sp.level <= highest && !given.includes(sp.name) && !always.some(a => a.name === sp.name)), cantrips: mixed ? 0 : cantrips, prepared, mixed, highest, verb, given: given.map(n => allSpells.find(sp => sp.name === n) ?? { name: n, level: 0 }), always, chosen: got });
  };
  // Spells a class's features grant by name, as they word it: always
  // prepared ("You always have the Divine Smite spell prepared", "You always
  // have *Sending* prepared"); a cantrip known besides those chosen ("you
  // learn the *Vicious Mockery* cantrip", and one more of the list's if it
  // was already known); a spell added to the
  // spellbook ("You add *Telekinesis* and *Resilient Sphere* to your
  // spellbook", "**Level 5.** You add *Fly* …" from that level); and the
  // Attunements' picks, a cantrip known and a spell of each level from 1 to
  // 5 added to the spellbook once the class can cast it.
  const byName = name => allSpells.find(sp => sp.name === name) ?? { name, level: null };
  // The highest level of spell a class casts at its level: its slots', or
  // its Pact Magic's.
  const casterHighest = c => {
    const row = c.rules.table.rows[c.level - 1];
    return c.rules.pact ? number(row['Slot Level']) : Math.max(0, ...c.rules.slotLevels.filter(l => number(row[l])));
  };
  const granted = [], swapChoices = [];
  for (const f of features) {
    const c = known.find(k => k.class === f.class), give = (name, how, from = f.name) => { granted.push({ ...byName(name), class: f.class, how, from }); reads(f); };
    for (const m of f.text.matchAll(/always have (?:the )?\*?([A-Z][^*.]*?)\*?(?: and \*?([A-Z][^*.]*?)\*?)? (?:spells? )?prepared/g)) for (const n of [m[1], m[2]].filter(Boolean)) give(n, 'prepared');
    for (const m of f.text.matchAll(/(?:learn|know) the \*([^*]+)\* cantrip|You know \*([^*]+)\*(?=[;.])/g)) give(m[1] ?? m[2], 'cantrip');
    for (const line of f.text.split('\n')) {
      const at = line.match(/^- \*\*Level (\d+)\.\*\*/);
      if (at && c.level < +at[1]) continue;
      for (const m of line.matchAll(/You add \*([^*]+)\*(?: and \*([^*]+)\*)? to your spellbook/g)) for (const n of [m[1], m[2]].filter(Boolean)) give(n, 'book');
    }
    // An Attunements list whose every spell is picked from any of its sets
    // ("You gain spells from the Attunements list below, picking each one
    // from any of the five sets"): at each level the class casts, the sets'
    // spells of that level, or one more of it that deals one of their damage
    // types from the lists the swap names ("for another spell of the same
    // level that deals Cold, Fire, Lightning, Psychic, or Radiant damage,
    // from the Bard, Cleric, … spell list"). Each pick is the player's. A
    // build saved when the feature chose one energy for all of them keeps
    // that energy's spells (its kind, under the feature's key).
    if (/picking each one from any of the \w+ sets/.test(f.text)) {
      const sets = [...f.text.matchAll(/^> \*\*(\w+)\.\*\* \*([^*]+)\*.*?then \*([^*]+)\*/gm)].map(m => ({ type: m[1], spells: [m[2], ...m[3].replace(/\.$/, '').split(/\s*·\s*/)] }));
      const swap = f.text.match(/for another spell of the same level that deals ((?:\w+, )+\w+,? or \w+) damage, from the (.+?) spell lists?\./);
      const types = swap ? list(swap[1]) : [], lists = swap ? swap[2].split(/,\s*(?:or\s+)?|\s+or\s+/) : [];
      const pool = [...new Map([...lists.flatMap(n => book.classNamed(n)?.spellList ?? []), ...[...book.spellFacts.values()].filter(sp => sp.classes?.some(n => lists.includes(n)))].map(sp => [sp.name, sp])).values()]
        .filter(sp => types.some(t => book.spellFacts.get(sp.name)?.damage.includes(t)));
      const levelOf = sp => book.spellFacts.get(sp.name)?.level ?? sp.level;
      const saved = sets.find(x => x.type === state.kinds?.[`${f.class} ${f.level} ${f.name}`]);
      reads(f);
      sets[0].spells.forEach((_, level) => {
        if (level && casterHighest(c) < level) return;
        const from = Object.fromEntries(sets.map(x => [x.spells[level], x.type])), key = `${f.name} ${level}`;
        const offered = [...new Set([...Object.keys(from), ...pool.filter(sp => levelOf(sp) === level).map(sp => sp.name)])];
        const pick = offered.find(n => n === state.swaps?.[key]) ?? saved?.spells[level] ?? null;
        swapChoices.push({ key, class: f.class, label: `${f.name}: ${level ? `the level ${level} spell` : 'the cantrip'}`, from, offered, chosen: pick });
        if (pick) give(pick, level ? 'book' : 'cantrip');
        else fail(`swap:${key}`, `Choose ${level ? `a level ${level} spell` : 'a cantrip'} for ${f.name}.`);
      });
    }
  }
  // The spells a class's features keep always prepared, to its level, from
  // their tables: besides those it chooses, not counted among them. Where a
  // feature has several (a land each), the one chosen ("choose one type of
  // land") is the player's.
  const spellSetChoices = [];
  const alwaysPrepared = c => features.filter(f => f.class === c.class && ALWAYS_PREPARED.test(f.text)).flatMap(f => {
    reads(f);
    const tables = spellTables(f);
    let rows = tables[0]?.rows ?? [];
    if (tables.length > 1) {
      const key = `${c.class} ${f.level} ${f.name}`, sets = tables.map(t => t.set), chosen = sets.find(x => x === state.spellSets?.[key]) ?? null;
      const noun = f.text.match(/choose one ([\w ]+?):/)?.[1] ?? 'one';
      spellSetChoices.push({ key, class: c.class, label: `${f.name} (${c.class} ${f.level})`, noun, sets: tables.map(t => ({ name: t.set, spells: t.rows.filter(r => r.level <= c.level).flatMap(r => r.spells) })), chosen });
      if (!chosen) { fail(`spellset:${key}`, `Choose a ${noun} for ${f.name}.`); return []; }
      rows = tables.find(t => t.set === chosen).rows;
    }
    return rows.filter(r => r.level <= c.level).flatMap(r => r.spells.map(name => ({ ...(allSpells.find(sp => sp.name === name) ?? { name, level: null }), from: f.name })));
  });
  const spellbooks = [];
  const spellcasting = known.filter(c => c.rules.slotLevels.length || c.rules.pact).map(c => {
    const row = c.rules.table.rows[c.level - 1];
    const verb = c.rules.spellsColumn === 'Spells Known' ? 'known' : 'prepared';
    // A feature's "one extra cantrip from the Cleric spell list" adds to it.
    const extra = features.filter(f => f.class === c.class && new RegExp(`You know one extra cantrip from the ${c.class} spell list`).test(f.text)).length;
    for (const f of features.filter(x => x.class === c.class && new RegExp(`cantrips? (?:of your choice )?from the ${c.class} spell list|${c.class} cantrips of your choice|level 1 ${c.class} spells|You know one extra cantrip|spells of your choice from the ${c.class} spell list`).test(x.text))) reads(f);
    const count = c.rules.cantripGrants ? c.rules.cantripGrants.filter(g => g.level <= c.level).reduce((n, g) => n + g.count, 0) : number(row.Cantrips);
    const own = how => granted.filter(g => g.class === c.class && g.how === how);
    // A cantrip a feature names that's known already brings one of the
    // list's instead ("if you already did, learn another cantrip").
    const named = [...new Set(own('cantrip').map(g => g.name))], twice = own('cantrip').length - named.length + named.filter(n => c.rules.givenCantrips.includes(n)).length;
    const entry = { class: c.class, cantrips: count + extra + twice, given: [...new Set([...c.rules.givenCantrips, ...named])], always: [...alwaysPrepared(c), ...own('prepared'), ...optionalSpells.filter(o => o.class === c.class && o.name).map(o => ({ ...byName(o.name), from: o.from }))], book: own('book'), prepared: number(row[c.rules.spellsColumn]), verb, highest: casterHighest(c) };
    // The book: the player's spells (each on the list, of a level with
    // slots, the first ones level 1), what features write in, and any a
    // feature lets the player add free ("two Wizard spells from the
    // Evocation school, each of which must be no higher than level 2", and
    // one at each new level of slots). Its level 1+ spells are what the class
    // prepares from.
    let list = c.rules.spellList;
    const secrets = features.find(f => f.class === c.class && /choose any of your new prepared spells from the (.+?) spell lists/.test(f.text));
    if (secrets) {
      reads(secrets);
      const lists = secrets.text.match(/choose any of your new prepared spells from the (.+?) spell lists/)[1].split(/,\s*(?:and\s+)?|\s+and\s+/);
      list = [...new Map(lists.flatMap(n => book.classNamed(n)?.spellList ?? []).map(sp => [sp.name, sp])).values()];
    }
    if (c.rules.spellbook) {
      const { start, more } = c.rules.spellbook, free = start + more * (c.level - 1);
      const key = `book ${c.class}`, offered = c.rules.spellList.filter(sp => sp.level > 0 && sp.level <= entry.highest);
      const picks = (state.spellbooks?.[c.class] ?? []).map(n => offered.find(sp => sp.name === n)).filter(Boolean);
      reads(features.find(f => f.class === c.class && /\*\*Spellbook\.\*\*/.test(f.text)) ?? {});
      if (picks.length !== (state.spellbooks?.[c.class] ?? []).length) fail(`spells:${key}`, `A spell in the ${c.class}'s spellbook isn't a ${c.class} spell it has slots for.`);
      else if (picks.length !== free) fail(`spells:${key}`, `The ${c.class}'s spellbook takes ${free} spells of your choice; ${picks.length} are written in.`, picks.length < free);
      else if (picks.filter(sp => sp.level === 1).length < Math.min(start, free)) fail(`spells:${key}`, `The ${c.class}'s spellbook starts with ${start} level 1 spells.`);
      const extra = features.filter(f => f.class === c.class).map(f => ({ f, m: f.text.match(/Choose (\w+) [\w ]+? spells from the (\w+) school, each of which must be no higher than level (\d), and add them to your spellbook for free/) })).filter(x => x.m).map(({ f, m }) => {
        reads(f);
        const count = NUMBERS.indexOf(m[1]) + (/whenever you gain access to a new level of spell slots/.test(f.text) ? Math.max(0, entry.highest - +m[3]) : 0);
        const from = c.rules.spellList.filter(sp => sp.school === m[2] && sp.level > 0 && sp.level <= entry.highest);
        const fkey = `book ${c.class} ${f.name}`, got = (state.spellbooks?.[fkey] ?? []).map(n => from.find(sp => sp.name === n)).filter(Boolean);
        if (got.length !== count) fail(`spells:${fkey}`, `${f.name} writes ${count} ${m[2]} spells into the spellbook; ${got.length} are chosen.`, got.length < count);
        return { key: fkey, label: `${f.name} (${c.class} ${f.level})`, count, from, chosen: got };
      });
      const written = [...new Map([...picks, ...entry.book, ...extra.flatMap(x => x.chosen)].map(sp => [sp.name, sp])).values()];
      spellbooks.push({ class: c.class, key, free, start, offered, chosen: picks, granted: entry.book, extra, written });
      list = [...c.rules.spellList.filter(sp => sp.level === 0), ...written];
    }
    entry.list = list;
    if (list.length) pickSpells(c.class, c.class, list, entry.cantrips, entry.prepared, entry.highest, { verb, given: entry.given, always: entry.always });
    // Its ability, as its Spellcasting says ("Intelligence is your
    // spellcasting ability for your Wizard spells"), and with it the SRD's
    // save DC and attack modifier.
    const ability = c.rules.features.map(f => f.text.match(new RegExp(`(\\w+) is (?:your|the) spellcasting ability for your ${c.class} spells`))?.[1]).find(Boolean) ?? null;
    if (ability) Object.assign(entry, { ability, dc: book.attacks.spell_save_dc_base + mod[ability] + bonus, attack: mod[ability] + bonus });
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
      reads(f);
      const at = known.find(c => c.class === f.class)?.level ?? 0, list = book.classNamed(arcanum[2]).spellList;
      const levels = [{ level: +arcanum[1], from: f.level }, ...[...f.text.matchAll(/(\d+) \(level (\d) spell\)/g)].map(m => ({ level: +m[2], from: +m[1] }))];
      for (const l of levels.filter(x => at >= x.from)) pickSpells(`${key} ${l.level}`, `${f.name}, level ${l.level} (${f.class})`, list.filter(sp => sp.level === l.level), 0, 1, l.level, { verb: 'known' });
    }
    // A book of spells (Pact of the Tome): so many cantrips and so many level
    // 1 rituals (R in the spell's Special column) from any class's list.
    const tome = f.text.match(/choose (\w+) cantrips, and choose (\w+) level 1 spells that have the Ritual tag\. The spells can be from any class[’']s spell list/);
    if (tome) reads(f);
    if (tome) pickSpells(key, label, allSpells.filter(sp => sp.level === 0 || (sp.level === 1 && /\bR\b/.test(sp.special ?? ''))), NUMBERS.indexOf(tome[1]), NUMBERS.indexOf(tome[2]), 1, { verb: 'known' });
    // A spell chosen once, learned ("You learn one spell of your choice
    // from…") or kept prepared ("Choose one spell from… You always have it
    // prepared"), as the feature says.
    const kept = /You always have it prepared/.test(f.text) ? 'always prepared' : 'known';
    const own = f.text.match(/(?:You learn|Choose) one spell (?:of your choice )?from the (.+?) spell list, of a level for which you have spell slots/);
    if (own) reads(f);
    if (own) pickSpells(key, label, book.classNamed(own[1]).spellList.filter(sp => sp.level > 0), 0, 1, spellcasting.find(s => s.class === f.class)?.highest ?? 0, { verb: kept });
    // Spells a feature has the player choose and keeps always prepared:
    // "Choose two spells from the Cleric spell list, each of a level for which
    // the Physician Features table gives you spell slots" (and "an additional
    // spell this way at Physician levels 10 and 14"), "You learn two spells
    // of your choice. These spells can come from the Cleric, Druid, or Wizard
    // spell list" (a cantrip or a level with slots), "Choose a level 1 and a
    // level 2 spell in your spellbook", "Choose two level 3 spells in your
    // spellbook".
    const caster = spellcasting.find(sc => sc.class === f.class), highest = caster?.highest ?? 0, at = known.find(k => k.class === f.class)?.level ?? 0;
    const touched = f.text.match(/Choose (\w+) spells from the (\w+) spell list, each of a level for which the [\w ]+? table gives you spell slots/);
    if (touched) {
      const more = f.text.match(/You choose an additional spell this way at [\w ]+? levels ([\d, and]+)/);
      const count = NUMBERS.indexOf(touched[1]) + (more ? more[1].match(/\d+/g).map(Number).filter(t => at >= t).length : 0) + (moreTouched[f.class] ?? 0);
      reads(f);
      pickSpells(key, label, book.classNamed(touched[2]).spellList.filter(sp => sp.level > 0), 0, count, highest, { verb: 'always prepared' });
    }
    const discoveries = f.text.match(/You learn (\w+) spells of your choice\. These spells can come from the (.+?) spell list or any combination/);
    if (discoveries) {
      reads(f);
      const lists = discoveries[2].split(/,\s*(?:or\s+)?|\s+or\s+/), from = [...new Map(lists.flatMap(n => book.classNamed(n)?.spellList ?? []).map(sp => [sp.name, sp])).values()];
      pickSpells(key, label, from, NUMBERS.indexOf(discoveries[1]), NUMBERS.indexOf(discoveries[1]), highest, { verb: 'always prepared', mixed: true });
    }
    const written = spellbooks.find(b => b.class === f.class)?.written ?? [];
    const mastery = f.text.match(/Choose a level (\d) and a level (\d) spell in your spellbook( that have a casting time of an action)?/);
    if (mastery) { reads(f); for (const lv of [+mastery[1], +mastery[2]]) pickSpells(`${key} ${lv}`, `${f.name}, level ${lv} (${f.class})`, written.filter(sp => sp.level === lv && (!mastery[3] || book.spellFacts.get(sp.name)?.casting === 'Action')), 0, 1, lv, { verb: 'always prepared' }); }
    const signature = f.text.match(/Choose (\w+) level (\d) spells in your spellbook/);
    if (signature) { reads(f); pickSpells(key, label, written.filter(sp => sp.level === +signature[2]), 0, NUMBERS.indexOf(signature[1]), +signature[2], { verb: 'always prepared' }); }
    const any = f.text.match(/(?:You learn|Choose) one level (\d) spell (?:of your choice )?from any class's spell list/);
    if (any) {
      reads(f);
      const at = known.find(c => c.class === f.class)?.level ?? 0;
      const steps = f.text.match(/when you reach \w+ levels ([\d, and]+), you can replace (?:the spell|it) with one a level higher/);
      const highest = +any[1] + (steps ? steps[1].match(/\d+/g).map(Number).filter(t => at >= t).length : 0);
      pickSpells(key, label, allSpells.filter(sp => sp.level >= +any[1]), 0, 1, highest, { verb: kept });
    }
  }
  for (const w of warriorCantrips) pickSpells(w.key, w.label, book.classNamed(w.list).spellList.filter(sp => sp.level === 0), w.count, 0, 0, { verb: 'known' });
  // An option that improves one of the class's known cantrips ("Choose one of
  // your known Warlock cantrips that deals damage", Agonizing Blast): which,
  // of those chosen.
  const cantripTargets = [];
  for (const f of features) {
    const m = f.text.match(/Choose one of your known (\w+) cantrips(?: that ([^.]+))?\./);
    if (!m) continue;
    reads(f);
    const key = f.key ?? `${f.class} ${f.level} ${f.name}`, mine = spellChoices.find(sc => sc.key === m[1])?.chosen.filter(sp => sp.level === 0) ?? [];
    const pick = mine.find(sp => sp.name === state.cantripTargets?.[key]) ?? null;
    cantripTargets.push({ key, label: f.label ?? `${f.name} (${f.class} ${f.level})`, condition: m[2] ?? null, from: mine.map(sp => sp.name), chosen: pick?.name ?? null });
    if (!pick) fail(`cantrip:${key}`, mine.length ? `Choose which ${m[1]} cantrip ${f.name} improves.` : `${f.name} improves a ${m[1]} cantrip you know; choose one first.`, true);
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
  // A feature's weapons by name: "proficiency with Longbows" (Horse and
  // Bow), "with the following Martial weapons: the Battleaxe, Glaive, …"
  // (the Chirurgeon's).
  const namedIn = text => [...text.matchAll(/proficiency with ([^.;]+)/g)].flatMap(m => (book.weapons ?? [])
    .filter(w => new RegExp(`\\b${w.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`).test(m[1])).map(w => x => x.name === w.name));
  const proficientWith = [...(first ? weaponRules(first.traits.find(t => t.trait === 'Weapon Proficiencies')?.value ?? '') : []),
    ...known.slice(1).flatMap(c => weaponRules(c.rules.multiclass.gains)), ...features.flatMap(f => [...weaponRules(f.text.match(/proficiency with Martial weapons/)?.[0] ?? ''), ...namedIn(f.text)])];
  // And one weapon of the player's choice ("proficiency with one Martial
  // weapon of your choice", the Courtier's Second Weapon).
  const weaponChoices = [];
  for (const f of features) {
    const m = f.text.match(/proficiency with one (Simple|Martial) weapon of your choice/);
    if (!m) continue;
    reads(f);
    const key = f.key ?? `${f.class} ${f.level} ${f.name}`, from = (book.weapons ?? []).filter(w => w.category === m[1]);
    const pick = from.find(w => w.name === state.weapons?.[key]) ?? null;
    weaponChoices.push({ key, label: f.label ?? `${f.name} (${f.class} ${f.level})`, category: m[1], from, chosen: pick?.name ?? null });
    if (pick) proficientWith.push(w => w.name === pick.name); else fail(`weapon:${key}`, `Choose a ${m[1]} weapon for ${f.name}.`);
  }
  const proficientWeapons = (book.weapons ?? []).filter(w => proficientWith.some(r => r(w)));
  // As the sheet says it: each category the character has whole ("Simple
  // weapons"), then the others by name.
  const whole = ['Simple', 'Martial'].filter(k => (book.weapons ?? []).filter(w => w.category === k).every(w => proficientWeapons.includes(w)));
  const weaponTraining = { categories: whole, named: proficientWeapons.filter(w => !whole.includes(w.category)).map(w => w.name) };
  // Weapon Mastery: so many kinds of weapon, by the class's Weapon Mastery
  // column where it has one or by its sentence ("three kinds of Simple or
  // Martial weapons of your choice"), from what the sentence allows: its
  // categories, Melee or Ranged, a damage type ("two kinds of Slashing
  // weapons", the Chirurgeon's), and, where it says so, only the kinds the
  // character is proficient with.
  const masteryChoices = [];
  for (const f of features) {
    // Or one kind ("the mastery property of one kind of crossbow or firearm
    // you're proficient with"), a firearm what the feature says one is ("A
    // firearm is a Pistol, a Musket or …").
    const m = f.text.match(/use the mastery properties of (\w+) kinds of (.+?) of your choice( with which you have proficiency)?/)
      ?? f.text.match(/use the mastery property of (one) kind of ((?:weapon|crossbow|firearm)(?: or (?:crossbow|firearm))?)( you're proficient with)/);
    if (!m) continue;
    reads(f);
    const c = known.find(x => x.class === f.class), key = f.key ?? `${f.class} ${f.level} ${f.name}`;
    const column = c.rules.table.columns.includes('Weapon Mastery') ? number(c.rules.table.rows[c.level - 1]?.['Weapon Mastery']) : 0;
    const count = column || NUMBERS.indexOf(m[1]);
    if (count < 1) throw new Error(`${f.name}: a count the builder doesn't read: "${m[1]}"`);
    const firearms = firearmsIn(f.text);
    const named = /crossbow|firearm/.test(m[2]) ? w => (/crossbow/.test(m[2]) && /Crossbow/.test(w.name)) || (/firearm/.test(m[2]) && firearms.includes(w.name)) : null;
    const kind = named ? [] : m[2].match(/^(?:(Simple|Martial)(?: or (Simple|Martial))? )?(?:(Melee|Ranged) )?(?:(Slashing|Piercing|Bludgeoning) )?weapons?$/);
    if (!kind) throw new Error(`${f.name}: "${m[2]}", weapons the builder doesn't read`);
    const categories = [kind[1], kind[2]].filter(Boolean);
    const from = (m[3] ? proficientWeapons : book.weapons ?? []).filter(w => (named ? named(w) : true) && (!categories.length || categories.includes(w.category)) && (!kind[3] || w.range === kind[3]) && (!kind[4] || w.damage.includes(kind[4])));
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
  // A language a feature names outright ("You know Sylvan."), one of the
  // rules' own.
  const languageNamed = tongues && new RegExp(`[Yy]ou (?:also )?know (${[...tongues.standard, ...tongues.rare].map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=[.,;])`);
  if (tongues) {
    languageChoices.push({ key: 'Common', label: 'Common', count: tongues.known.length, given: [] }, { key: 'standard', label: 'Standard languages', count: NUMBERS.indexOf(tongues.choose.count), given: [] });
    for (const f of features) {
      const key = f.key ?? `${f.class} ${f.level} ${f.name}`, label = f.label ?? `${f.name} (${f.class} ${f.level})`;
      const plus = f.text.match(/You know ([A-Z][\w’' ]+?) and (\w+) other languages? of your choice/);
      const named = f.text.match(/You know ([A-Z][\w’' ]+?), the secret language/) ?? f.text.replace(/'/g, '’').match(languageNamed);
      const some = f.text.match(/(?:know|learn) (\w+) languages? of your choice/);
      const ask = plus ? { given: [plus[1]], count: NUMBERS.indexOf(plus[2]) } : named ? { given: [named[1]], count: 0 } : some ? { given: [], count: NUMBERS.indexOf(some[1]) } : null;
      if (!ask) continue;
      if (ask.count < 0) throw new Error(`${f.name}: a language count the builder doesn't read`);
      reads(f);
      languageChoices.push({ key, label, ...ask });
    }
    const seen = new Set();
    for (const c of languageChoices) {
      const got = (state.languages?.[c.key] ?? []).map(x => String(x).trim()).filter(Boolean);
      c.chosen = got;
      if (got.length !== c.count) fail(`language:${c.key}`, c.key === 'Common' ? 'Name your vernacular.' : `Name ${c.count} language${c.count === 1 ? '' : 's'} for ${c.label}.`, got.length < c.count);
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
  const ownTraining = [...new Set([...(first ? trainedIn(first.traits.find(t => t.trait === 'Armor Training')?.value ?? '') : []),
    ...known.slice(1).flatMap(c => trainedIn(c.rules.multiclass.gains.match(/training with (.+)$/)?.[1] ?? '')),
    // A feature's own, the whole clause ("training with Medium armor and
    // Shields", the Chirurgeon's) or the other order ("You gain Heavy armor
    // training", the Lionskin's).
    ...features.flatMap(f => [...f.text.matchAll(/training with ([^,.;]*(?:armor|Shields?)\b)|\b((?:Light|Medium|Heavy) armor) training\b/g)].flatMap(m => trainedIn(m[1] ?? m[2])))])];
  const higher = book.higherLevelEquipment.find(r => total >= r.lo && total <= r.hi) ?? null;
  // Magic items, as many of each rarity as the table gives past level 1,
  // from the books' own: one for no one in particular, or for one of the
  // character's classes or its subclass (a family's member for that
  // subclass), never one the DM hands out or one that comes only in the
  // story. The builder chooses, as with
  // armour: first what's made for its subclass (its chapter's, or the
  // family member for it), then its classes', then the setting's own, then
  // other classes' chapters, each the homeland's first, then in the books'
  // order; the rarest slots first, so an item that comes in several rarities
  // (+1, +2, +3) fills the rarest it can. A living tradition goes only to a
  // character of its homeland. A rarity no item fits is left for the DM to
  // fill.
  const has = cls => known.some(k => k.class === cls);
  const subclassOf = cls => known.find(k => k.class === cls && k.level >= k.rules.subclassLevel)?.subclass || null;
  const memberFor = item => item.members.find(mb => mb.subclass === subclassOf(item.place.class_name)) ?? null;
  const homeland = state.homeland || null;
  const usable = item => (!item.living || item.living.includes(homeland)) && (!item.who || (has(item.who.class) && (!item.who.subclasses || item.who.subclasses.includes(subclassOf(item.who.class))))) && (!item.bound || memberFor(item));
  // A rarity a family gives one member ("Uncommon, or Rare for the Spare
  // Barrel") is that member's, and the others take the rest.
  const ratedAt = (item, member) => (item.rarities.some(r => r.member && r.member === member?.name) ? item.rarities.filter(r => r.member === member.name) : item.rarities.filter(r => !r.member));
  const nearness = item => ((item.place.subclass && item.place.subclass === subclassOf(item.place.class_name)) || memberFor(item) ? 0 : has(item.place.class_name) || (item.who && has(item.who.class)) ? 1 : item.place.class_name ? 3 : 2);
  const athome = item => Number(item.from.includes(homeland) || Boolean(item.living));
  const taken = new Set();
  const RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];
  // A character also has its class's own gear, what the table never gives:
  // the chapter's items rarer than any of the table's, those the books
  // leave the DM to give (Scott, 17 November), and one whose text calls it
  // "class gear by the rules" (the Bonesaw, with its Chirurgeon in the
  // Companion). Each comes a rarity ahead of
  // the table, as The Classes rules (a Very Rare Bonesaw at 11–16, where the
  // table first gives Rare; the Legendary coat at 17–20), and all of it in
  // the table's last row; each for one who can use it (the Bonesaw a
  // Chirurgeon's), a Shield only for one with Shield training, and none a
  // subclass goes without.
  const tableTop = RARITIES.indexOf(book.higherLevelEquipment.at(-1).magic.at(-1).rarity);
  const gearArrives = r => higher && (higher === book.higherLevelEquipment.at(-1) || RARITIES.indexOf(r) <= RARITIES.indexOf(higher.magic.at(-1)?.rarity) + book.classGear.ahead);
  const classGear = () => book.items.filter(i => i.magical && !i.story && i.place.class_name && has(i.place.class_name) && usable(i) && !taken.has(i.name)
    && (i.dm || /\bclass gear by the rules\b/.test(i.text) || i.rarities.every(r => RARITIES.indexOf(r.rarity) > tableTop)) && gearArrives(i.rarities.at(-1).rarity)
    && !(i.kind === 'Armor' && i.base === 'Shield' && !ownTraining.includes('Shield')) && !book.classGear.without.some(w => w.without === i.name && w.subclass === subclassOf(i.place.class_name)))
    .map(i => { taken.add(i.name); return { rarity: i.rarities.at(-1).rarity, classGear: true, item: { name: i.name, kind: i.kind, base: i.base, member: memberFor(i) && (memberFor(i).name ?? memberFor(i).subclass), bonus: i.rarities.at(-1).bonus, attunement: i.attunement, living: Boolean(i.living), text: i.text } }; });
  // The inventory the player keeps (a tracker; Scott, 17 November): what
  // it takes out, what it adds, bought or given (a magic item only given,
  // as the DM gives one), and the armor it wears.
  const inventory = state.inventory ?? {};
  const givenMagic = (inventory.add ?? []).map((a, index) => ({ a, index, item: a.how === 'given' ? book.items.find(i => i.magical && i.name === a.name) : null })).filter(x => x.item).map(({ a, index, item }) => {
    taken.add(item.name);
    const at = item.rarities.find(r => r.rarity === a.rarity) ?? item.rarities.at(-1);
    return { rarity: at.rarity, given: true, index, item: { name: item.name, kind: item.kind, base: item.base, member: null, bonus: at.bonus, attunement: item.attunement, living: Boolean(item.living), text: item.text } };
  });
  const magicItems = (higher?.magic ?? []).toSorted((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity)).flatMap(({ count, rarity }) => Array.from({ length: count }, () => {
    const pick = book.items.filter(i => i.magical && !i.dm && !i.story && !taken.has(i.name) && usable(i))
      .map(i => ({ item: i, member: memberFor(i), at: ratedAt(i, memberFor(i)).find(r => r.rarity === rarity) }))
      .filter(x => x.at).sort((a, b) => nearness(a.item) - nearness(b.item) || athome(b.item) - athome(a.item))[0];
    if (!pick) return { rarity, item: null };
    taken.add(pick.item.name);
    return { rarity, item: { name: pick.item.name, kind: pick.item.kind, base: pick.item.base, member: pick.member && (pick.member.name ?? pick.member.subclass), bonus: pick.at.bonus, attunement: pick.item.attunement, living: Boolean(pick.item.living), text: pick.item.text } };
  })).concat(classGear(), givenMagic).filter(m => !m.item || !(inventory.remove ?? []).includes(m.item.name)).toSorted((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity));
  // What the magic items do to the numbers, each as its sentence says, the
  // character wearing or holding them and attuned to as many as the SRD
  // allows ("You can be attuned to no more than three magic items at a
  // time"; the builder attunes the rarest first), the rest carried: "a +1
  // bonus to Armor Class"; "your base Armor
  // Class is 15 plus your Dexterity modifier" without armor; "a +1 bonus to
  // saving throws"; a magic weapon's "+2 bonus to attack rolls and damage
  // rolls made with it", or the bonus its rarity gives; "a +3 bonus to spell
  // attack rolls and to the saving throw DCs of your Revelator spells", the
  // highest of those that "doesn't stack with another Danae focus's bonus";
  // and the Tuned Arc Gun's bonus to "attack rolls with the Arc Gun".
  const attuned = magicItems.filter(m => m.item?.attunement).toSorted((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity)).slice(0, book.attunementMax).map(m => m.item.name);
  const inUse = magicItems.filter(m => m.item && (!m.item.attunement || attuned.includes(m.item.name))).map(m => ({ ...m.item, rated: Number(m.item.bonus?.match(/^\+(\d+)$/)?.[1] ?? 0) }));
  const unattuned = magicItems.filter(m => m.item?.attunement && !inUse.some(x => x.name === m.item.name)).map(m => m.item.name);
  const said = (item, re) => item.text.match(re);
  const armorBonus = inUse.map(i => ({ name: i.name, n: +(said(i, /you have a \+(\d+) bonus to Armor Class/)?.[1] ?? 0) })).filter(x => x.n);
  const itemBare = inUse.flatMap(i => { const m = said(i, /If you aren[’']t wearing armor, your base Armor Class is (\d+) plus your (\w+) modifier/); return m ? [{ from: i.name, base: +m[1], ability: m[2] }] : []; });
  // A shield that hovers ("you don't need a free hand to benefit from it",
  // the Ward), the SRD's Shield, and the training it brings ("While attuned
  // to the shield, you have Shield training").
  const hovering = inUse.find(i => i.kind === 'Armor' && i.base === 'Shield' && /you don[’']t need a free hand to benefit from it/.test(i.text));
  const itemTraining = inUse.flatMap(i => [...i.text.matchAll(/you have (\w+) training/g)].map(m => m[1]));
  const saveBonus = inUse.map(i => ({ name: i.name, n: +(said(i, /you have a \+(\d+) bonus to saving throws/)?.[1] ?? 0) })).filter(x => x.n);
  const magicWeapons = inUse.flatMap(i => {
    const base = i.kind === 'Weapon' ? i.base : said(i, /It can be wielded as a magic (\w+)/)?.[1];
    const w = base && (book.weapons ?? []).find(x => x.name === base);
    if (!w) return [];
    const n = +(said(i, /(?:grants|You have|You gain) a \+(\d+) bonus to attack (?:rolls )?and damage rolls made with (?:it|this magic weapon)/)?.[1] ?? (/bonus to attack and damage rolls made with this magic weapon, determined by its rarity/.test(i.text) ? i.rated : 0));
    return [{ name: i.name, w, n }];
  });
  // Spell attacks and DCs, by class ("of your Revelator spells") or every
  // class's ("a +2 bonus to spell attack rolls").
  const bare = name => name.replace(/^(?:the|an?) /i, '');
  const castingBoosts = inUse.flatMap(i => {
    const m = said(i, /(?:a \+(\d+) bonus|a bonus(?:, determined by the item[’']s rarity,)?) to (?:spell attack rolls and to the saving throw DCs|the attack rolls and saving throw DCs|attack rolls with [^.]+?, and to the spell attack rolls and spell save DCs) of your (\w+) spells/);
    const any = said(i, /a \+(\d+) bonus to spell attack rolls\b(?! and)/);
    const both = said(i, /Your spell save DC and spell attack bonus each increase by (\d+)/);
    const focus = said(i, /doesn[’']t stack with another (\w+) focus[’']s bonus/)?.[1];
    // "This bonus doesn't stack with the Atlas of Roads or the Inked Wheel."
    const apart = said(i, /This bonus doesn[’']t stack with ((?:the |an? )?[A-Z][^.]*)\./)?.[1].split(/,? or |, /).map(bare) ?? [];
    return [m && { name: i.name, cls: m[2], n: m[1] ? +m[1] : i.rated, dc: true, focus, apart }, any && { name: i.name, cls: null, n: +any[1], dc: false, apart: [] }, both && { name: i.name, cls: null, n: +both[1], dc: true, apart: [] }].filter(x => x && x.n);
  });
  // Bonuses that don't stack (two of a class's foci, or an item and one its
  // sentence names): the larger counts.
  const clash = (a, b) => (a.focus && a.focus === b.focus) || a.apart.includes(bare(b.name)) || b.apart.includes(bare(a.name));
  for (const sc of spellcasting.filter(x => x.ability)) {
    const kept = castingBoosts.filter(b => !b.cls || b.cls === sc.class).toSorted((a, b) => b.n - a.n).reduce((k, b) => (k.some(x => clash(x, b)) ? k : [...k, b]), []);
    const n = kept.reduce((t, b) => t + b.n, 0), dcn = kept.filter(b => b.dc).reduce((t, b) => t + b.n, 0);
    if (n) sc.attack += n;
    if (dcn) sc.dc += dcn;
    if (n || dcn) sc.items = kept.map(b => b.name);
  }
  const featureBoosts = inUse.flatMap(i => { const m = said(i, /to attack rolls with the ([\w ]+?), /); return m ? [{ attack: m[1], n: i.rated, name: i.name }] : []; });
  // With an item's ("you have Shield training", the Ward).
  const training = [...new Set([...ownTraining, ...itemTraining.flatMap(trainedIn)])];
  // The Armor Class a body armour and a Shield give (either may be none),
  // by the modifiers it's worked from: the character's, or a form's that
  // swaps scores (the Monster's card). Without armour, each feature's own
  // base, and a Shield only where its sentence allows one.
  const acOf = (mods, worn, shield) => {
    const shieldBonus = shield?.bonus ?? 0;
    const unarmored = [{ from: 'No armor', ac: 10 + mods.Dexterity + shieldBonus }];
    for (const f of features) {
      const sentence = f.text.split(/(?<=\.)\s+/).find(x => /base Armor Class equals 10 plus your (\w+) and (\w+) modifiers/.test(x));
      if (!sentence) continue;
      const m = sentence.match(/base Armor Class equals 10 plus your (\w+) and (\w+) modifiers/);
      const noShield = /wearing (?:any )?armor or wielding a Shield/.test(sentence);
      if (shield && noShield) continue;
      unarmored.push({ from: f.name, ac: 10 + mods[m[1]] + mods[m[2]] + shieldBonus });
    }
    // An item's own ("your base Armor Class is 15 plus your Dexterity
    // modifier" without armor, the Doctor's Coat).
    for (const b of itemBare) unarmored.push({ from: b.from, ac: b.base + mods[b.ability] + shieldBonus });
    const ac = worn
      ? { from: worn.name, ac: worn.base + (worn.dex ? Math.min(mods.Dexterity, worn.dex_max ?? Infinity) : 0) + shieldBonus }
      : { ...unarmored.reduce((best, u) => (u.ac > best.ac ? u : best)) };
    if (shieldBonus) ac.from += hovering ? ` and ${hovering.name}` : ' and Shield';
    // And what an item adds ("a +1 bonus to Armor Class").
    for (const x of armorBonus) { ac.ac += x.n; ac.from += ` and ${x.name}`; }
    // A feat's own sentence: "While you’re wearing Light, Medium, or Heavy
    // armor, you gain a +1 bonus to Armor Class" (Defense).
    for (const f of feats) {
      const m = f.feat.description?.match(/While you’re wearing (.+?) armor, you gain a \+(\d+) bonus to Armor Class/);
      if (m && worn && list(m[1]).includes(worn.category)) { ac.ac += +m[2]; ac.from += ` and ${f.feat.name}`; }
    }
    return { unarmored, ac };
  };
  // Gear, as the rules set a character up at its level: the first class's
  // starting kit and the background's, each the package the player chooses
  // (A unless another is chosen: it carries the weapons, focus and tools the
  // others leave the player to buy), its "tool you chose" and "Gaming Set
  // (same as above)" the tools chosen for that class or background; and past
  // level 1 the money the Starting Equipment at Higher Levels table
  // adds. The armour is the builder's, not the player's: without armour, in
  // a kit's, or in any the character is trained in, has the Strength for
  // (without it, Speed drops) and can buy with that money, the highest Armor
  // Class, then one that doesn't hinder Stealth, then the least spent. A
  // Shield only as a kit gives one, carried where it adds (not where it ends
  // Unarmored Defense).
  const outfitters = [first && { from: first.name, packages: first.packages, tools: k => k === first.name || k.startsWith(`${first.name} `) },
    background && { from: background.name, packages: background.packages, tools: k => k === `${background.name} tools` || k.startsWith(`${background.name} tools `) }].filter(Boolean);
  const resolve = (item, chosen) => {
    const same = item.match(/^(.+?) \(same as above\)$/), named = same ? chosen.filter(t => t.startsWith(same[1])) : /^the (?:\w+ )?(?:[\w’'] ?)*?(?:tools?|Tools|Supplies|Kit) you chose$/.test(item) ? chosen : null;
    return named?.length ? named : [item];
  };
  const packageChoices = outfitters.map(src => {
    const pack = src.packages.find(p => p.label === state.packages?.[src.from]) ?? src.packages[0], chosen = toolChoices.filter(t => src.tools(t.key)).flatMap(t => t.chosen);
    return { key: src.from, label: `${src.from}’s starting equipment`, offered: src.packages.map(p => p.label), lines: Object.fromEntries(src.packages.map(p => [p.label, [...p.items, ...(p.gold ? [`${p.gold} GP`] : [])].join(', ')])), chosen: pack.label,
      kit: { from: src.from, items: pack.items.flatMap(i => resolve(i, chosen)), gold: pack.gold } };
  });
  const kits = packageChoices.map(c => c.kit);
  // The kits' items less those taken out, and the goods added, a bundle of
  // ammunition by its count ("40 Arrows"); what's bought comes out of the
  // money, and more than there is asks for less.
  const removing = [...(inventory.remove ?? [])];
  const kept = kits.flatMap(k => k.items).filter(i => { const at = removing.indexOf(i); if (at < 0) return true; removing.splice(at, 1); return false; });
  const goods = (inventory.add ?? []).map((a, index) => ({ ...a, index, count: Math.max(1, Math.floor(Number(a.count) || 1)), entry: book.catalog.find(c => c.name === a.name) })).filter(a => a.entry);
  for (const a of inventory.add ?? []) if (!book.catalog.some(c => c.name === a.name) && !book.items.some(i => i.magical && i.name === a.name)) fail('inventory', `${a.name} isn't in the books.`);
  const asItem = g => (g.entry.bundle ? `${g.count * g.entry.bundle} ${g.name}` : g.count > 1 ? `${g.count} ${g.name}` : g.name);
  const items = [...kept, ...goods.map(asItem)];
  const purse = kits.reduce((n, k) => n + k.gold, 0) + (higher?.gold ?? 0), bought = goods.filter(g => g.how === 'bought').reduce((n, g) => n + g.entry.cost * g.count, 0);
  const money = purse - bought;
  if (money < 0) fail('inventory', `What's bought costs ${bought.toLocaleString('en')} GP; there's ${purse.toLocaleString('en')}.`);
  const armorNamed = item => book.armor.items.find(a => a.name === item);
  // A Strength not yet assigned doesn't rule armor out; the score, once in,
  // does.
  const wearable = a => a.category !== 'Shield' && training.includes(a.category) && (!a.strength || !Number.isFinite(scores.Strength) || scores.Strength >= a.strength);
  const kitShield = items.map(armorNamed).find(a => a?.category === 'Shield' && training.includes('Shield'));
  const owned = items.map(armorNamed).filter(a => a && wearable(a));
  const wears = [[null, 0], ...owned.map(a => [a, 0]), ...book.armor.items.filter(a => wearable(a) && a.cost <= money && !owned.includes(a)).map(a => [a, a.cost])];
  // A suit a feature makes of the armour worn (the Lionskin's Powered Suit):
  // armour of its own category and base Armor Class, its Dexterity, Strength
  // and Stealth as the sentence gives them, worn without a Shield. The
  // subclass is built on it (its other features work only in the suit), so
  // the builder wears it, made from the armour that costs least to have.
  const suitOf = features.map(f => {
    const m = f.text.match(/make any armor you wear into your suit\. Whatever it was made from, the suit is (Light|Medium|Heavy) armor with a base Armor Class of (\d+)( \(your Dexterity doesn't add to it\))?/);
    if (!m) return null;
    reads(f);
    const [from, spent] = wears.filter(([a]) => a).sort((x, y) => x[1] - y[1])[0] ?? [];
    // Its model, where it has one, may lift the Disadvantage ("The suit
    // doesn't give you Disadvantage on Dexterity (Stealth) checks").
    const model = features.find(x => x.kind && x.name.startsWith(`${f.name}: `))?.text ?? '';
    const loud = /Disadvantage on Dexterity \(Stealth\) checks while you wear it/.test(f.text) && !/doesn[’']t give you Disadvantage on Dexterity \(Stealth\) checks/.test(model);
    return from && { worn: { name: f.name, madeFrom: from.name, category: m[1], base: +m[2], dex: !m[3], strength: /no Strength requirement/.test(f.text) ? null : from.strength, stealth_disadvantage: loud }, spent };
  }).find(Boolean);
  // The armor the player says to wear, of what it owns and can wear, or
  // none; otherwise the builder's pick. A suit stays on.
  const wearOptions = suitOf ? [] : owned.map(a => a.name);
  const told = !suitOf && inventory.wear && inventory.wear !== 'auto' ? (inventory.wear === 'none' ? [null, 0] : wears.find(([a, spent]) => a?.name === inventory.wear && spent === 0)) : null;
  if (!suitOf && inventory.wear && inventory.wear !== 'auto' && !told) fail('wear', `${inventory.wear} isn't armor the character owns and can wear.`);
  // The pick compares Armor Classes; an ability not yet assigned counts as
  // +0 here, so the armor in the kit is worn before the scores are in
  // (NaN compares as nothing, which left the character in no armor).
  const pickMods = Object.fromEntries(Object.entries(mod).map(([a, v]) => [a, Number.isFinite(v) ? v : 0]));
  let gear = null;
  if (suitOf) gear = { spent: suitOf.spent, worn: suitOf.worn, shield: null };
  else for (const shield of hovering ? [book.armor.items.find(x => x.category === 'Shield')] : kitShield ? [kitShield, null] : [null]) for (const [worn, spent] of told ? [told] : wears) {
    const ac = acOf(pickMods, worn, shield).ac.ac, quiet = !worn?.stealth_disadvantage;
    if (!gear || ac > gear.ac || (ac === gear.ac && (quiet > gear.quiet || (quiet === gear.quiet && spent < gear.spent)))) gear = { ac, quiet, spent, worn, shield };
  }
  const { worn, shield } = gear;
  // A shield the kit gives but the character doesn't hold, and why: the suit
  // works only without one, or the Armor Class is higher without it.
  const shieldLeft = kitShield && !shield ? (suitOf ? `your ${suitOf.worn.name} gives its Armor Class only while you aren't holding one` : 'your Armor Class is higher without it') : null;
  const { unarmored, ac: armorClass } = acOf(mod, worn, shield);
  // The books' gear, for the player to buy at the table with what's left:
  // the setting's own and its classes' chapters', each piece of a priced set
  // on its own, and the period's weapons that count as one the character is
  // proficient with, whatever it can afford (or the books leave unpriced),
  // the homeland's first. Where the books price an item by distance (a
  // Mutapan curiosity costs ten times as much in Europe), it's priced where
  // the character buys: the place chosen, or by default the one place the
  // books name in its homeland. Where the books give no number, the price at
  // home stands with their words, for the DM to set.
  const left = money - gear.spent, affordable = x => x.cost === null || x.cost <= left;
  const places = [...new Set(book.items.flatMap(i => i.prices?.places.map(p => p.place) ?? []))];
  const homePlaces = item => item.prices.places.filter(p => p.homelands.includes(homeland));
  const placeOf = item => item.prices.places.find(p => p.place === state.market) ?? (homePlaces(item).length === 1 ? homePlaces(item)[0] : null);
  const inSentence = place => place.replace(/^(?:The|A) /, w => w.toLowerCase());
  const priced = (item, cost) => {
    if (!item.prices) return { cost, note: item.pieces.length ? null : item.note };
    const at = placeOf(item), base = `${cost.toLocaleString('en')} GP in ${item.prices.home}`;
    if (!at) return { cost: null, note: homePlaces(item).length ? `${base}; the books price ${homeland} by place, so choose where you’re buying` : `${base}; the books give no price here, so the DM sets it` };
    if (at.times === null) return { cost: null, note: `${base}; in ${inSentence(at.place)}, ${at.words}` };
    return { cost: cost * at.times, note: at.times === 1 ? `in ${item.prices.home}` : `in ${inSentence(at.place)}, ${at.times} times the price in ${item.prices.home}` };
  };
  const market = book.items.find(i => i.prices) ? placeOf(book.items.find(i => i.prices))?.place ?? null : null;
  const forSale = [
    ...book.items.filter(i => !i.magical && (!i.place.class_name || has(i.place.class_name))).flatMap(i => (i.pieces.length ? i.pieces.map(p => ({ name: p.name, of: i.name, home: i.from.includes(homeland), ...priced(i, p.cost) })) : [{ name: i.name, of: null, home: i.from.includes(homeland), ...priced(i, i.cost) }])),
    ...book.periodWeapons.filter(w => w.counts_as.some(n => proficientWeapons.some(p => p.name === n))).map(w => ({ name: w.name, cost: w.cost, of: null, note: null, home: false, countsAs: w.counts_as })),
  ].filter(affordable).toSorted((a, b) => b.home - a.home);
  // What a feature hands the character with it ("You carry a weapon of your
  // own design", the Arc Gun; "You carry a map that draws itself"), named as
  // the feature is.
  const carried = features.filter(f => /(?:^|\.\s+)You carry an? /.test(f.text)).map(f => ({ name: f.name, from: `${f.subclass ?? f.class} ${f.level}` }));
  const equipment = { carried, buying: { place: market, places, chosen: places.includes(state.market) }, kits: kits.map(k => ({ from: k.from, items: k.items })), bought: gear.spent ? { name: worn.madeFrom ?? worn.name, cost: gear.spent } : null, gold: left, levelGold: higher?.gold ?? 0, roll: higher?.roll ?? null, magicItems, forSale };
  // What it all weighs, by the SRD's tables: the gear (and its inverted
  // names, "Clothes, Traveler's" for "Traveler's Clothes"), armor, weapons,
  // tools, ammunition by its bundle ("20 Arrows" from "Arrows | 20 | … |
  // 1 lb."), a focus's form ("Arcane Focus (crystal)", or a Quarterstaff for
  // its staff), what a feature says its own item weighs (a spellbook "is a
  // Tiny object that weighs 3 pounds"), and the coin, fifty to the pound;
  // anything the books give no weight is named, not guessed.
  // What the character can carry, and drag, lift or push: its Strength by
  // the Carrying Capacity table's multiple for its size.
  const W = book.weights, curly = x => x.replace(/'/g, '’').toLowerCase();
  const weightOf = new Map();
  const weighs = (name, weight) => { if (weight !== null && weight !== undefined) weightOf.set(curly(name), weight); };
  for (const g of W.gear) { weighs(g.name, g.weight); const inverted = g.name.match(/^(.+?), (.+)$/); if (inverted) weighs(`${inverted[2]} ${inverted[1]}`, g.weight); }
  for (const x of [...book.armor.items, ...(book.weapons ?? []), ...(book.tools ?? [])]) weighs(x.name, x.weight);
  for (const f of features) for (const m of f.text.matchAll(/\*\*([\w ]+)\.\*\*[^*]*?\bIt is an? \w+ object that weighs (\d+) pounds/g)) weighs(m[1], +m[2]);
  const weigh = item => item.split(/ and (?=\d)/).map(part => {
    const m = part.match(/^(?:(\d+) )?(.+?)(?: \((.+)\))?$/), n = +(m[1] ?? 1), name = m[2], kind = m[3];
    const ammo = W.ammunition.find(a => curly(a.name.split(',')[0]) === curly(name));
    if (ammo) return { item: part, weight: (n / ammo.amount) * ammo.weight };
    const form = kind && Object.entries(W.forms).find(([k]) => curly(k) === curly(name))?.[1].find(f => [f.name, f.also].filter(Boolean).map(curly).includes(curly(kind)));
    if (form) return { item: part, weight: n * form.weight };
    const known = [name, name.replace(/es$/, ''), name.replace(/s$/, '')].map(curly).find(x => weightOf.has(x));
    return { item: part, weight: known ? n * weightOf.get(known) : null };
  });
  // The species' option (a lineage, a legacy, an ancestry) and its row.
  const options = speciesOptions(species);
  if (options && !options.names.includes(state.option)) fail('option', `Choose your ${options.label}.`);
  const optionRow = species && Object.values(species.tables ?? {}).flat().find(r => Object.values(r)[0] === state.option);
  // The spellcasting ability a species trait or a feat lets the player
  // choose ("Intelligence, Wisdom, or Charisma is your spellcasting ability
  // for the spells you cast with this trait", the Tiefling's legacy; "for
  // this feat's spells", Magic Initiate), and the cantrips each brings: a
  // lineage's ("You also know the Poison Spray cantrip"), a trait's own ("You
  // know the Thaumaturgy cantrip … the same spellcasting ability you use for
  // your Fiendish Legacy trait"), the feat's chosen ones.
  const ABILITY_CHOICE = /(\w+), (\w+),? or (\w+) is your spellcasting ability for (?:the spells you cast with this trait|this feat[’']s spells)/;
  const abilityChoices = [];
  const askAbility = (key, label, text) => {
    const m = text.match(ABILITY_CHOICE);
    if (!m) return null;
    const offered = [m[1], m[2], m[3]], chosen = offered.find(a => a === state.spellAbilities?.[key]) ?? null;
    abilityChoices.push({ key, label, noun: 'spellcasting ability', offered, chosen });
    if (!chosen) fail(`ability:${key}`, `Choose the spellcasting ability for ${label}.`);
    return chosen;
  };
  const lineage = species ? Object.values(optionRow ?? {}).slice(1).join(' ') : '';
  // A trait's text with the options not chosen left out ("**Forest Gnome.**
  // You know the Minor Illusion cantrip …").
  const ownOption = text => text.split('\n').filter(l => { const o = l.replace(/^[-\s]*/, '').match(/^\*\*(.+?)\.\*\*/)?.[1]; return !o || !options?.names.includes(o) || o === state.option; }).join('\n');
  const innate = [];
  for (const t of species?.traits ?? []) {
    const ability = askAbility(`${species.name} ${t.name}`, `${t.name} (${species.name})`, t.text);
    const text = ownOption(t.text) + (ability !== null && /Lineage|Legacy|lineage|legacy/.test(t.name) ? ` ${lineage}` : '');
    const same = t.text.match(/uses the same spellcasting ability you use for your (.+?) trait/)?.[1];
    const by = ability ?? (same ? abilityChoices.find(c => c.label.startsWith(`${same} (`))?.chosen ?? null : null);
    for (const m of text.matchAll(/You (?:also )?know the ([A-Z][\w’' ]+?) cantrip/g)) innate.push({ name: m[1], ability: by, from: `${species.name}, ${t.name}` });
  }
  for (const f of feats) {
    const key = `feat ${f.from}`, ability = askAbility(key, `${f.feat.name} (${f.from})`, f.feat.benefits.map(b => b.text).join(' '));
    for (const sp of spellChoices.find(c => c.key === key)?.chosen.filter(x => x.level === 0) ?? []) innate.push({ name: sp.name, ability, from: f.feat.name });
  }
  // Fighting Style's cantrips ("The chosen cantrips count as Paladin spells
  // for you"), by the class's own ability.
  for (const w of warriorCantrips) for (const sp of spellChoices.find(c => c.key === w.key)?.chosen ?? []) innate.push({ name: sp.name, ability: spellcasting.find(x => x.class === w.class)?.ability ?? null, from: w.label });
  // Attacks, as the SRD's Attack Roll Abilities table sets them (Strength
  // for a melee weapon or an Unarmed Strike, Dexterity for a ranged one,
  // Finesse either), the Proficiency Bonus with a weapon the character is
  // proficient with and the same modifier on the damage. A feature's own
  // ability counts where it names the weapon ("When you make an attack roll
  // with a crossbow or a firearm, you can use your Intelligence modifier
  // instead", Ballistics; "of your Unarmed Strikes and Monk weapons",
  // Dexterous Attacks), the best one taken, as is its die where it's larger
  // (the Martial Arts column), each only while its condition holds; a feat's
  // bonus ("a +2 bonus to attack rolls you make with Ranged weapons"); and a
  // feature's own attack (the Arc Gun, its dice in its class's column). Then
  // each cantrip known that makes a spell attack or forces a save, its dice
  // grown with the character's level ("5 (2d10), 11 (3d10), and 17
  // (4d10)"), or its beams.
  const rules = book.attacks, UNARMED = { name: 'Unarmed Strike', range: 'Melee', properties: [] };
  const signedMod = n => (n ? ` ${n > 0 ? '+' : '−'} ${Math.abs(n)}` : '');
  const f0 = t => t[0].toUpperCase() + t.slice(1);
  const atLevel = (c, column) => { const k = known.find(x => x.class === c); return k?.rules.table.rows[k.level - 1]?.[column] ?? null; };
  const firearms = firearmsIn(features.find(f => firearmsIn(f.text).length)?.text);
  const mastered = masteryChoices.flatMap(c => c.chosen.map(w => w.name));
  // What a phrase names: "a Simple weapon", "a Martial weapon that has the
  // Finesse or Light property", "a crossbow", "a firearm", "a weapon whose
  // mastery property you can use", "your Unarmed Strikes", and a name the
  // feature defines ("Monk weapons, which are the following: …", "The Saw
  // is any of those weapons, or a Handaxe or Sickle").
  const covers = (phrase, w, f) => phrase.split(/,? (?:or|and) (?:with )?(?=an? |your |Monk |Unarmed )/).map(p => p.replace(/^(?:an?|your) /, '')).some(p => {
    if (/^Unarmed Strikes?$/.test(p)) return w === UNARMED;
    if (w === UNARMED) return false;
    const kind = p.match(/^(?:(Simple|Martial) )?(?:(Melee|Ranged) )?weapons?(?: that ha(?:s|ve) the (.+?) propert(?:y|ies))?$/);
    if (kind) return (!kind[1] || w.category === kind[1]) && (!kind[2] || w.range === kind[2]) && (!kind[3] || list(kind[3]).some(x => hasProperty(w, x)));
    if (/^crossbows?$/.test(p)) return /Crossbow/.test(w.name);
    if (/^firearms?$/.test(p)) return firearms.includes(w.name);
    if (/^weapon whose mastery property you can use$/.test(p)) return mastered.includes(w.name);
    const defined = f.text.match(new RegExp(`${p}, which are the following:\\s*((?:\\n- .+)+)`));
    if (defined) return defined[1].trim().split('\n').some(x => covers(x.replace(/^- /, ''), w, f));
    const saw = f.text.match(new RegExp(`The ${p} is any of those weapons, or an? (.+?)\\.`));
    if (saw) return [...(f.text.match(/following (?:Simple|Martial) weapons: (.+?)\./)?.[1].replace(/\bthe /g, '').split(/,(?: and)? /) ?? []), ...list(saw[1])].includes(w.name);
    return false;
  });
  // A feature's condition on its benefits ("while you are unarmed or
  // wielding only Monk weapons and you aren't wearing armor or wielding a
  // Shield").
  const free = f => !/while you are unarmed or wielding only \w+ weapons and you aren[’']t wearing armor or wielding a Shield/.test(f.text) || (!worn && !shield);
  const swaps = features.flatMap(f => [
    ...[...f.text.matchAll(/When you (?:make an attack roll with|attack with) (.+?), you can use your (\w+) modifier instead of your (?:Strength or Dexterity|Strength|Dexterity) modifier for the attack and damage rolls/g)].map(m => ({ f, phrase: m[1], ability: m[2] })),
    ...[...f.text.matchAll(/You can use your (\w+) modifier instead of your (?:Strength or Dexterity|Strength|Dexterity) modifier for the attack and damage rolls (?:of|you make with) (.+?)\./g)].map(m => ({ f, phrase: m[2], ability: m[1] })),
  ]).filter(x => free(x.f));
  const fists = features.map(f => ({ f, m: f.text.match(/Your Unarmed Strikes deal (\w+) damage equal to (\d+) plus your (\w+) modifier, and you use \3 for their attack rolls/) })).find(x => x.m);
  const ownDice = features.flatMap(f => { const m = f.text.match(/You can roll (\d+d\d+) in place of the normal damage of your Unarmed Strike or (\w+ weapons)\. This die changes as you gain \w+ levels, as shown in the ([\w ]+) column/); return m && free(f) ? [{ f, phrase: `Unarmed Strikes and ${m[2]}`, die: atLevel(f.class, m[3]) ?? m[1] }] : []; });
  const average = d => { const m = String(d).match(/^(\d+)d(\d+)$/); return m ? m[1] * (+m[2] + 1) / 2 : Number(d); };
  const featBonus = range => feats.reduce((n, f) => n + [f.feat.description, ...f.feat.benefits.map(b => b.text)].reduce((m, t) => m + Number(t?.match(new RegExp(`You gain a \\+(\\d+) bonus to attack rolls you make with ${range} weapons`))?.[1] ?? 0), 0), 0);
  const perAction = Math.max(1, ...features.map(f => ({ twice: 2, 'three times': 3, 'four times': 4 })[f.text.match(/You can attack (twice|three times|four times) instead of once/)?.[1]] ?? 1));
  const reach = w => {
    const thrown = w.properties.find(p => p.startsWith('Thrown'))?.match(/Range ([\d/]+)/)?.[1], ammo = w.properties.find(p => p.startsWith('Ammunition'))?.match(/Range ([\d/]+)/)?.[1];
    return w.range === 'Ranged' ? `${ammo ?? thrown} feet` : `reach ${hasProperty(w, 'Reach') ? 10 : 5} feet${thrown ? `, or thrown ${thrown} feet` : ''}`;
  };
  // What adds to an attack only now and then, noted on the attacks it can
  // add to, not added in, each as its sentence bounds it: a state ("When you
  // make an attack using Strength—with either a weapon or an Unarmed
  // Strike— … as shown in the Rage Damage column", Rage); once a turn
  // ("Once per turn, you can deal an extra 1d6 damage … if … the attack uses
  // a Finesse or a Ranged weapon", Sneak Attack; "Once on each of your turns
  // when you hit a creature with a weapon attack … your Telling Cut die plus
  // your Charisma modifier"; "when you hit a creature you're studying with an
  // attack roll using a crossbow or a firearm", Calculated Shot); against an
  // Observed creature (Exploit); and a Fighting Style's ("a Melee weapon that
  // you are holding with two hands … Two-Handed or Versatile property";
  // "an extra attack as a result of using a weapon that has the Light
  // property").
  const riders = features.flatMap(f => {
    const rage = f.text.match(/When you make an attack using (\w+)—with either a weapon or an Unarmed Strike—and deal damage to the target, you gain a bonus to the damage that increases as you gain levels as an? \w+, as shown in the ([\w ]+) column/);
    const sneak = f.text.match(/Once per turn, you can deal an extra \d+d\d+ damage to one creature you hit with an attack roll if .+? and the attack uses an? (\w+) or an? (\w+) weapon\.[\s\S]*?as shown in the ([\w ]+) column/);
    const cut = f.text.match(/Once on each of your turns when you hit a creature with a weapon attack, the creature takes extra (\w+) damage equal to a roll of your ([\w ]+) die plus your (\w+) modifier/);
    const shot = f.text.match(/Once per turn, when you hit a creature you[’']re studying with an attack roll using (.+?), the attack deals the extra damage shown in the ([\w ]+) column/);
    const exploit = /hits an Observed creature/.test(f.text) && f.text.match(/The attack deals the extra damage shown in the ([\w ]+) column/);
    return [
      rage && { test: (w, ability) => ability === rage[1], note: `${atLevel(f.class, rage[2])} damage in ${f.name}` },
      sneak && { test: w => w !== UNARMED && [sneak[1], sneak[2]].some(k => hasProperty(w, k) || w.range === k), note: `${f.name} ${atLevel(f.class, sneak[3])} once a turn` },
      cut && { test: w => w !== UNARMED, note: `${f.name} ${atLevel(f.class, cut[2])}${signedMod(mod[cut[3]])} ${cut[1]} once a turn` },
      shot && { test: w => covers(shot[1], w, f), note: `${shot[2]} ${atLevel(f.class, shot[2])} against a creature you're studying, once a turn` },
      exploit && { any: true, note: `${exploit[1]} ${atLevel(f.class, exploit[1])} against an Observed creature` },
    ].filter(Boolean);
  }).concat(feats.flatMap(f => {
    const text = [f.feat.description, ...f.feat.benefits.map(b => b.text)].join(' ');
    const great = text.match(/a Melee weapon that you are holding with two hands, you can treat any 1 or 2 on a damage die as a 3\. The weapon must have the (.+?) property/);
    const two = /an extra attack as a result of using a weapon that has the Light property, you can add your ability modifier to the damage/.test(text);
    return [great && { test: w => w !== UNARMED && w.range === 'Melee' && list(great[1]).some(k => hasProperty(w, k)), note: `${f.feat.name}: a 1 or 2 on a damage die counts as 3, two-handed` },
      two && { test: w => w !== UNARMED && hasProperty(w, 'Light'), note: `${f.feat.name}: the Light property's extra attack adds your modifier` }].filter(Boolean);
  }));
  const strike = (w, magic = null) => {
    const base = w === UNARMED ? rules.unarmed.ability : w.range === 'Melee' ? rules.melee : rules.ranged;
    // A feature that sets the ability ("you use Intelligence for their
    // attack rolls") leaves no choice; one that allows it ("you can use") adds one.
    const options = fists && w === UNARMED ? [fists.m[3]] : [[base], hasProperty(w, 'Finesse') ? rules.finesse : [], ...swaps.filter(x => covers(x.phrase, w, x.f)).map(x => [x.ability])].flat();
    const ability = options.reduce((best, a) => (mod[a] > mod[best] ? a : best));
    const proficient = w === UNARMED || proficientWeapons.some(p => p.name === w.name);
    const [, die, type] = w === UNARMED ? [null, null, fists ? fists.m[1] : rules.unarmed.type] : w.damage.match(/^(\S+) (\w+)$/);
    const bigger = ownDice.filter(x => covers(x.phrase, w, x.f)).map(x => x.die).find(d => average(d) > average(die ?? 0));
    const roll = bigger ?? die, flat = w === UNARMED && !bigger ? (fists ? +fists.m[2] : rules.unarmed.base) + mod[ability] : null;
    const versatile = w.properties.find(p => p.startsWith('Versatile'))?.match(/\((\d+d\d+)\)/)?.[1];
    // The SRD's Heavy property: Disadvantage below the score it asks.
    const heavy = w !== UNARMED && hasProperty(w, 'Heavy') && rules.heavy[w.range] && scores[rules.heavy[w.range].ability] < rules.heavy[w.range].score ? rules.heavy[w.range] : null;
    return {
      name: magic ? `${magic.name} (${w.name})` : w.name, kind: w === UNARMED ? 'unarmed' : 'weapon', ability, bonus: mod[ability] + (proficient ? bonus : 0) + featBonus(w.range) + (magic?.n ?? 0), proficient,
      damage: flat !== null ? `${Number.isFinite(flat) ? Math.max(flat, 0) : '—'} ${type}` : `${roll}${signedMod((/^\d+d\d+$/.test(roll) ? mod[ability] : 0) + (magic?.n ?? 0))} ${type}`,
      versatile: versatile && !bigger ? `${versatile}${signedMod(mod[ability] + (magic?.n ?? 0))} ${type}` : null, reach: w === UNARMED ? 'reach 5 feet' : reach(w),
      mastery: mastered.includes(w.name) ? w.mastery : null, disadvantage: heavy ? `Heavy, with ${heavy.ability} under ${heavy.score}` : null,
      riders: riders.filter(r => r.test?.(w, ability)).map(r => r.note),
    };
  };
  const carriedWeapons = [...new Map(items.map(item => {
    const m = item.match(/^(?:(\d+) )?(.+?)(?: and \d+ \w+)?$/), w = (book.weapons ?? []).find(x => [x.name, `${x.name}s`, `${x.name}es`].includes(m[2]));
    return w && [w.name, w];
  }).filter(Boolean)).values()];
  const ownAttacks = features.flatMap(f => {
    // A spell attack a feature makes, not a spell ("a melee spell attack
    // against a creature within 5 feet of yourself, or a ranged spell attack
    // … within 60 feet", "the dice shown in the Planar Strike column …, plus
    // your Wisdom modifier once for each of those dice").
    const planar = f.text.match(/a melee spell attack against a creature within (\d+) feet of yourself, or a ranged spell attack against a creature within (\d+) feet of yourself/);
    const planarDice = f.text.match(/the target takes the dice shown in the ([\w ]+) column of the \w+ Features table, plus your (\w+) modifier once for each of those dice/);
    if (planar && planarDice) {
      reads(f);
      const sc = spellcasting.find(x => x.class === f.class), dice = atLevel(f.class, planarDice[1]), n = +dice.match(/^(\d+)d/)[1];
      const type = f.text.match(/If you have no vista open, it[’']s (\w+) damage/)?.[1];
      return [{ name: f.name, kind: 'feature', ability: sc?.ability ?? planarDice[2], bonus: sc?.attack ?? mod[planarDice[2]] + bonus, proficient: true, damage: `${dice}${signedMod(n * mod[planarDice[2]])} ${type ? `${type}, or your open vista's type` : 'by your vista'}`, versatile: null, reach: `reach ${planar[1]} feet, or ${planar[2]} feet`, mastery: null }];
    }
    // A shot that's a spell attack with the class's modifier ("you fire the
    // Arc Gun: make a ranged spell attack with your Mhizha spell attack
    // modifier …"): the casting's attack, so its spell-attack items with it,
    // and an item's bonus to the shot alone where the casting hasn't counted
    // it already (the Tuned Arc Gun's one bonus is to both).
    const m = f.text.match(/make a ranged spell attack with your (\w+) spell attack modifier against a creature or object within (\d+) feet of you\. On a hit, the target takes (\w+) damage equal to the dice in the ([\w ]+) column of the \w+ Features table plus your (\w+) modifier/);
    if (!m) return [];
    reads(f);
    const sc = spellcasting.find(x => x.class === m[1]);
    const own = featureBoosts.filter(b => b.attack === f.name && !sc?.items?.includes(b.name)).reduce((n, b) => n + b.n, 0);
    return [{ name: f.name, kind: 'feature', ability: sc?.ability ?? m[5], bonus: (sc?.attack ?? mod[m[5]] + bonus) + own, proficient: true, damage: `${atLevel(f.class, m[4])}${signedMod(mod[m[5]])} ${m[3]}`, versatile: null, reach: `${m[2]} feet`, mastery: null }];
  });
  // A cantrip's step: by the character's level, or by its class's where the
  // spell says so ("when you reach Physician level 5"). And its damage's
  // words: its type, or its default where the spell sets another ("…, or
  // Force damage if you have no vista open"), and a modifier it adds ("1d10
  // damage plus your Wisdom modifier").
  const cantripStep = sp => { const at = sp.upgrade?.class ? known.find(k => k.class === sp.upgrade.class)?.level ?? 0 : total; return sp.upgrade?.steps.filter(([lv]) => at >= lv).at(-1)?.[1]; };
  const damageType = sp => (sp.dice.type ? `${sp.dice.type}${sp.dice.varies ? ', or as the spell gives' : ''}` : 'of the chosen type');
  const spellAttacks = spellcasting.filter(sc => sc.ability).flatMap(sc => {
    const pick = spellChoices.find(x => x.key === sc.class);
    const one = features.find(f => f.class === sc.class && new RegExp(`When you cast an? ${sc.class} cantrip that rolls only one damage die, add your (\\w+) modifier to the damage`).test(f.text));
    const addOne = one?.text.match(/add your (\w+) modifier to the damage/)?.[1];
    // Its cantrips, and its level 1+ spells prepared or always prepared, each
    // at its own level ("4d6 Radiant" for Guiding Bolt).
    const names = [...new Set([...(pick?.chosen ?? []).map(sp => sp.name), ...sc.given, ...sc.always.map(sp => sp.name)])];
    return names.map(n => book.spellFacts.get(n)).filter(sp => sp?.dice && (sp.attack || sp.save)).sort((a, b) => a.level - b.level).map(sp => {
      const step = sp.level === 0 ? cantripStep(sp) : undefined;
      // What an invocation chosen for it does ("its range increases by a
      // number of feet equal to 30 times your Warlock level", Eldritch Spear;
      // "When you hit a Large or smaller creature with that cantrip, you can
      // push the creature up to 10 feet straight away from you", Repelling
      // Blast).
      const targeted = cantripTargets.filter(t => t.chosen === sp.name).map(t => features.find(f => (f.key ?? `${f.class} ${f.level} ${f.name}`) === t.key)).filter(Boolean);
      const farther = targeted.reduce((n, f) => { const m = f.text.match(/its range increases by a number of feet equal to (\d+) times your (\w+) level/); return n + (m ? +m[1] * (known.find(k => k.class === m[2])?.level ?? 0) : 0); }, 0);
      const onHit = targeted.map(f => f.text.match(/When you hit (.+?) with that cantrip, you can (.+?)\./)).filter(Boolean).map(m => `${f0(m[2])} on a hit (${m[1]})`);
      const roll = sp.upgrade?.kind === 'dice' && step ? step : sp.dice.dice, beams = sp.upgrade?.kind === 'beams' ? step ?? 1 : 1;
      // And an improvement chosen for it ("You can add your Charisma modifier
      // to that spell's damage rolls", Agonizing Blast).
      const improved = cantripTargets.filter(t => t.chosen === sp.name).map(t => features.find(f => (f.key ?? `${f.class} ${f.level} ${f.name}`) === t.key)?.text.match(/You can add your (\w+) modifier to that spell[’']s damage rolls/)?.[1]).filter(Boolean);
      const plus = (addOne && /^1d\d+$/.test(roll) ? mod[addOne] : 0) + improved.reduce((n, a) => n + mod[a], 0) + (sp.dice.plus ? mod[sp.dice.plus] : 0);
      const range = sp.reach ?? (sp.area ? `${sp.range}, a ${sp.area}` : sp.range), feet = range.match(/^(\d+) feet$/);
      return { name: sp.name, kind: 'spell', class: sc.class, level: sp.level, ability: sc.ability, bonus: sp.attack ? sc.attack : null, save: sp.save ? { ability: sp.save, dc: sc.dc } : null, proficient: true,
        damage: `${roll}${signedMod(plus)} ${damageType(sp)}`, beams: beams > 1 ? beams : null, versatile: null, reach: farther && feet ? `${+feet[1] + farther} feet` : range, mastery: null,
        // A higher slot's effect, in the spell's own sentence.
        riders: [...onHit, ...(sp.higher ? [`With a higher slot: ${sp.higher.replace(/\.$/, '')}`] : [])] };
    });
  });
  // Those cantrips, by the ability their source gives, and a species'
  // own attack ("must make a Dexterity saving throw (DC 8 plus your
  // Constitution modifier and Proficiency Bonus) … takes 1d10 damage of the
  // type determined by your Draconic Ancestry trait … increases by 1d10 when
  // you reach character levels 5 (2d10), 11 (3d10), and 17 (4d10)").
  const innateAttacks = innate.filter(x => x.ability).map(x => ({ ...x, sp: book.spellFacts.get(x.name) })).filter(x => x.sp?.dice && (x.sp.attack || x.sp.save)).map(({ name, ability, from, sp }) => {
    const step = cantripStep(sp), roll = sp.upgrade?.kind === 'dice' && step ? step : sp.dice.dice;
    return { name, kind: 'spell', class: from, ability, bonus: sp.attack ? mod[ability] + bonus : null, save: sp.save ? { ability: sp.save, dc: book.attacks.spell_save_dc_base + mod[ability] + bonus } : null, proficient: true,
      damage: `${roll}${signedMod(sp.dice.plus ? mod[sp.dice.plus] : 0)} ${damageType(sp)}`, beams: sp.upgrade?.kind === 'beams' && step > 1 ? step : null, versatile: null, reach: sp.reach ?? sp.range, mastery: null };
  });
  const breaths = (species?.traits ?? []).flatMap(t => {
    const m = t.text.match(/(\d+)-foot Cone or a (\d+)-foot Line[^.]*\. Each creature in that area must make a (\w+) saving throw \(DC (\d+) plus your (\w+) modifier and Proficiency Bonus\)\. On a failed save, a creature takes (\d+d\d+) damage of the type determined by your .+? trait\..*?This damage increases by \d+d\d+ when you reach character levels (\d+) \((\d+d\d+)\), (\d+) \((\d+d\d+)\), and (\d+) \((\d+d\d+)\)/);
    if (!m) return [];
    const roll = [[+m[7], m[8]], [+m[9], m[10]], [+m[11], m[12]]].filter(([lv]) => total >= lv).at(-1)?.[1] ?? m[6];
    return [{ name: t.name, kind: 'trait', class: species.name, ability: m[5], bonus: null, save: { ability: m[3], dc: +m[4] + mod[m[5]] + bonus }, proficient: true,
      damage: `${roll} ${optionRow?.['Damage Type'] ?? 'of your ancestry'}`, beams: null, versatile: null, reach: `${m[1]}-foot Cone or ${m[2]}-foot Line`, mastery: null }];
  });
  const attacks = [...magicWeapons.map(x => strike(x.w, x)), ...carriedWeapons.map(w => strike(w)), strike(UNARMED), ...ownAttacks, ...spellAttacks, ...innateAttacks, ...breaths]
    .map(a => ({ ...a, riders: [...(a.riders ?? []), ...riders.filter(r => r.any && a.bonus !== null && a.bonus !== undefined).map(r => r.note)] }));
  // The Monster's card, for one who carries it, as Monster Form writes it:
  // the scores it swaps ("Your Strength and Intelligence scores swap, and
  // your Dexterity and Wisdom scores swap"), and with them the Armor Class
  // and saving throws; Temporary Hit Points ("twice your Physician level",
  // doubled by the first Overgrowth); the Unarmed Strike ("1d10 plus your
  // Strength modifier Bludgeoning damage", a d12 by the second), twice an
  // Attack action; the skills it keeps ("You lose your skill proficiencies
  // and gain proficiency in Athletics and Intimidation"); the Monstrous
  // Aura's reach and save DC.
  for (const r of optionalRules.filter(x => x.carries)) {
    const form = features.find(f => f.optional && f.class === r.class && f.name === `${r.name}: Monster Form`)?.text ?? '';
    const swaps = [...form.matchAll(/your (\w+) and (\w+) scores swap/gi)].map(m => [m[1], m[2]]);
    const temp = form.match(/Temporary Hit Points equal to twice your (\w+) level/), strike = form.match(/Unarmed Strikes deal (\d+)d(\d+) plus your (\w+) modifier (\w+) damage/);
    const kept = form.match(/You lose your skill proficiencies and gain proficiency in (.+?)\./), aura = form.match(/within (\d+) feet of you must succeed on a (\w+) saving throw \(DC 8 plus your Proficiency Bonus plus your (\w+) modifier\)/);
    if (!swaps.length || !temp || !strike || !kept || !aura) throw new Error(`${r.class}: ${r.name}'s Monster Form doesn't read as the card is worked from`);
    const at = known.find(k => k.class === temp[1])?.level ?? 0, grown = n => r.growth.some(g => n.test(g));
    const swapped = { ...scores };
    for (const [a, b] of swaps) [swapped[a], swapped[b]] = [scores[b], scores[a]];
    const mods = Object.fromEntries(ABILITIES.map(a => [a, book.modifier(swapped[a])]));
    const die = grown(/Unarmed Strike die in Monster Form becomes a d(\d+)/) ? +r.growth.find(g => /becomes a d\d+/.test(g)).match(/becomes a d(\d+)/)[1] : +strike[2];
    r.card = {
      scores: swapped, mods, armorClass: acOf(mods, worn, shield).ac,
      saves: ABILITIES.map(a => ({ ability: a, proficient: saves.includes(a), bonus: mods[a] + (saves.includes(a) ? advancement.bonus : 0) })),
      tempHp: 2 * at * (grown(/Temporary Hit Points you gain on transformation are doubled/) ? 2 : 1),
      strike: { attack: mods[strike[3]] + advancement.bonus, damage: `${strike[1]}d${die}${mods[strike[3]] ? ` ${mods[strike[3]] > 0 ? '+' : '−'} ${Math.abs(mods[strike[3]])}` : ''} ${strike[4]}`, attacks: /attack twice/.test(form) ? 2 : 1 },
      skills: list(kept[1]).map(sk => ({ name: sk, bonus: mods[book.skills.find(x => x.name === sk).ability] + advancement.bonus })),
      aura: { feet: grown(/radius of Monstrous Aura becomes (\d+) feet/) ? +r.growth.find(g => /Monstrous Aura becomes/.test(g)).match(/becomes (\d+) feet/)[1] : +aura[1], save: aura[2], dc: 8 + advancement.bonus + mods[aura[3]] },
      resistance: r.growth.find(g => /Resistance to/.test(g))?.match(/Resistance to (.+?) damage/)?.[1] ?? null,
    };
  }
  const faster = Object.values(optionRow ?? {}).join(' ').match(/Your Speed increases to (\d+) feet/)?.[1];
  // And what features add ("Your speed increases by 10 feet while you
  // aren't wearing Heavy armor", Fast Movement; "…, and your Speed increases
  // by 10 feet", the Infiltrator's model), each while its condition holds of
  // the armour worn, and by its class table's column where the table grows
  // it (Unarmored Movement).
  // A choice that stands until the next rest is in force on the sheet, so
  // what it gives holds there ("When you finish a Long Rest, choose one of
  // your energies: you have Resistance to that damage type …").
  const unchosen = f => {
    const k = kindChoices.find(c => c.key === (f.key ?? `${f.class} ${f.level} ${f.name}`));
    if (!k) return f.text;
    const kept = f.text.split('\n').filter(l => !k.offered.some(o => l.trimStart().startsWith(`- *${o} `) || l.startsWith(`> **${o}.`) || l.startsWith(`| ${o} |`))).join('\n');
    return k.chosen ? kept.replace(/(^|[.!]\s+)When you finish a Long Rest, choose one of your \w+: (\w)/, (m, lead, c) => lead + c.toUpperCase()) : kept;
  };
  const holds = condition => !condition || (/^Heavy armor$/.test(condition) ? worn?.category !== 'Heavy' : /^armor or wielding a Shield$/.test(condition) ? !worn && !shield : false);
  // A clause for one option of a lasting choice ("*Infiltrator:* you have a
  // Climb Speed …") counts only as chosen.
  const asChosen = text => text.split(/(?=\*\w+:\*)/).filter(part => { const label = part.match(/^\*(\w+):\*/)?.[1]; return !label || !kindChoices.some(c => c.offered.includes(label)) || kindChoices.some(c => c.chosen === label); }).join(' ');
  // The sentences of a text that hold on the sheet. One framed by a moment
  // or a state ("For 1 minute", "While charged", "In Monster Form") is for
  // play, as is the rest of its paragraph and the list that paragraph leads
  // ("While active, your Rage follows the rules below. **Damage
  // Resistance.** …"); a frame the sheet already meets ("While you wear the
  // suit", with the suit worn) isn't one.
  const FRAME = /^(?:For|While|When|Whenever|Until|If|As (?:a|an|part)|On your turn|Once|During|In Monster Form)\b/;
  // A frame inside one item of a list ends with that item.
  const standing = text => {
    let carried = false;
    return (text ?? '').split(/\n{2,}/).flatMap(par => {
      const item = /^\s*(?:\*\*|- |\*[A-Z])/.test(par), kept = [];
      let led = false;
      for (const line of par.split('\n')) {
        let framed = carried;
        for (const x of line.replace(/^\s*- /, '').split(/(?<=[.!])\s+/)) {
          const bare = x.replace(/^\*{1,3}[^*]+?\*{1,3}\s*/, '');
          if (FRAME.test(bare) && !(/^While you wear (?:the|your) suit\b/.test(bare) && worn?.madeFrom)) framed = true;
          else if (!framed) kept.push(x);
        }
        led = led || framed;
      }
      if (!item) carried = led && /(?:following \w+\.?|below\.|:)\s*$/.test(par.trim());
      return kept;
    });
  };
  const sayings = f => standing(asChosen(unchosen(f)));
  const added = features.reduce((n, f) => {
    const sentences = sayings(f);
    return n + sentences.reduce((m, x, i) => {
      const by = x.match(/\b[Yy]our [Ss]peed increases by (\d+) feet(?: while you aren[’']t wearing (.+?))?\.$/);
      if (!by || !holds(by[2])) return m;
      reads(f);
      const grows = /^This bonus increases when you reach certain \w+ levels, as shown on the .+? table\.$/.test(sentences[i + 1] ?? '');
      const row = grows && known.find(k => k.class === f.class)?.rules.table.rows[known.find(k => k.class === f.class).level - 1];
      return m + (grows ? Number(row?.[f.name]?.match(/^\+(\d+)/)?.[1] ?? 0) : +by[1]);
    }, 0);
  }, 0);
  const speed = Number(faster ?? species?.speed.match(/^(\d+)/)?.[1] ?? 0) + added;
  // Other speeds ("You also have a Climb Speed and a Swim Speed equal to
  // your Speed", "You have a Fly Speed of 60 feet").
  const moving = {};
  for (const x of features.flatMap(sayings)) {
    for (const m of x.matchAll(/\b[Yy]ou (?:also )?(?:have|gain) an? (Fly|Climb|Swim|Burrow) Speed(?: and an? (Fly|Climb|Swim|Burrow) Speed)? (?:equal to (your Speed|half your Speed)|of (\d+) feet)/g)) {
      const feet = m[4] ? +m[4] : m[3] === 'your Speed' ? speed : Math.floor(speed / 2);
      for (const k of [m[1], m[2]].filter(Boolean)) moving[k] = Math.max(moving[k] ?? 0, feet);
    }
  }
  // Defenses, as the species, feats and features write them: Resistance or
  // Immunity to damage types by name ("Resistance to Bludgeoning, Piercing,
  // and Slashing damage"), or to the type a choice set ("the damage type
  // determined by your Draconic Ancestry trait", the ancestry's row; "that
  // damage type", the feature's choice);
  // Immunity to conditions; and Advantage on saves against one ("to avoid
  // or end the Charmed condition"). One that holds only in a state ("while
  // your Rage is active", "In Monster Form") is for play.
  const defenses = { resistances: new Set(), immunities: new Set(), conditionImmunities: new Set(), conditionAdvantages: new Set(), saveAdvantages: new Set() };
  const typeChosen = f => kindChoices.find(c => c.class === f.class && c.noun === 'damage type' && c.chosen)?.chosen;
  const traitSayings = [...(species?.traits ?? []).map(t => t.text), Object.values(optionRow ?? {}).slice(1).join(' '), ...feats.map(f => [f.feat.description, ...f.feat.benefits.map(b => b.text)].join('\n\n'))].flatMap(standing);
  // An item's, worn or held as the builder has it ("While you wear the
  // shirt, you have …" is said of the shirt on).
  const itemSayings = inUse.flatMap(i => standing(i.text.replace(/(^|\. |\n- |\n)While (?:you (?:wear|hold|are attuned to)|wearing|holding) (?:it|them|the [\w’' ]+?), (\w)/g, (m, lead, c) => lead + c.toUpperCase())));
  const defenseSources = [...traitSayings.map(x => ({ x })), ...itemSayings.map(x => ({ x })), ...features.flatMap(f => sayings(f).map(x => ({ f, x })))];
  for (const { f, x } of defenseSources) {
    if (/\bwhile (?:your|you)\b|\bwhile in\b/.test(x) || !/\b[Yy]ou (?:have|gain|are immune)\b/.test(x)) continue;
    for (const m of x.matchAll(/\b(Resistance|Immunity) to ((?:[A-Z]\w+(?:,? (?:and |or )?)?)+) damage\b/g)) list(m[2]).filter(t => book.damageTypes.includes(t)).forEach(t => defenses[m[1] === 'Resistance' ? 'resistances' : 'immunities'].add(t));
    if (/Resistance to the damage type determined by your Draconic Ancestry/.test(x) && optionRow?.['Damage Type']) defenses.resistances.add(optionRow['Damage Type']);
    if (f && /Resistance to that damage type\b/.test(x) && typeChosen(f)) defenses.resistances.add(typeChosen(f));
    for (const m of x.matchAll(/\b(?:Immunity to|immune to) (?:disease and to )?the ((?:[A-Z]\w+(?:,? (?:and )?)?)+) conditions?\b/g)) list(m[1]).forEach(c => defenses.conditionImmunities.add(c));
    for (const m of x.matchAll(/Advantage on saving throws you make to avoid or end the (\w+) condition/g)) defenses.conditionAdvantages.add(m[1]);
    // Advantage on saves by ability, with what for where it says ("on
    // Intelligence, Wisdom, and Charisma saving throws", Gnomish Cunning;
    // "on Constitution saving throws to maintain Concentration").
    for (const m of x.matchAll(new RegExp(`Advantage on ((?:${ABILITIES.join('|')})(?:,? (?:and |or )?(?:${ABILITIES.join('|')}))*) saving throws( to [^.,;]+)?`, 'g'))) defenses.saveAdvantages.add(`${listed(list(m[1]))} saves${m[2] ?? ''}`);
    for (const m of x.matchAll(/Advantage on saving throws against (spells and other magical effects)/g)) defenses.saveAdvantages.add(`saves against ${m[1]}`);
    // A resistance by a choice's table ("a damage type associated with your
    // current land choice in the Circle Spells feature, as shown in the
    // Nature's Ward table"), the land chosen.
    const byTable = f && x.match(/Resistance to a damage type associated with your current (\w+) choice in the (.+?) feature, as shown in the (.+?) table/);
    if (byTable) {
      const chosen = spellSetChoices.find(c => c.class === f.class && c.chosen)?.chosen;
      // Its table names the land as the set's name does, or by its first word
      // ("Arid" for "Arid Land").
      const row = chosen && f.text.split('\n').map(l => l.split('|').map(c => c.trim())).find(c => c[1] && (chosen === c[1] || chosen.startsWith(`${c[1]} `)));
      const type = row?.[2];
      if (type && book.damageTypes.includes(type)) defenses.resistances.add(type);
    }
  }
  // Senses, as the species, its lineage, feats and features give them ("You
  // have Darkvision with a range of 60 feet", "The range of your Darkvision
  // increases to 120 feet", "…, or your Darkvision's range increases by 30
  // feet if you already have it", "grants you Blindsight with a range of 30
  // feet", "Tremorsense out to 30 feet"); one framed by a moment ("As a
  // Bonus Action, you gain Tremorsense …") is for play.
  const SENSES = 'Darkvision|Blindsight|Tremorsense|Truesight';
  const senses = {};
  for (const x of [...traitSayings, ...features.flatMap(sayings)]) {
    const has = x.match(new RegExp(`\\b(?:You have|grants you) (${SENSES}) (?:with a range of|out to) (\\d+) feet`)), to = x.match(new RegExp(`The range of your (${SENSES}) increases to (\\d+) feet`));
    const more = x.match(new RegExp(`or your (${SENSES})[’']s range increases by (\\d+) feet if you already have it`));
    if (has) senses[has[1]] = senses[has[1]] && more?.[1] === has[1] ? senses[has[1]] + +more[2] : Math.max(senses[has[1]] ?? 0, +has[2]);
    if (to) senses[to[1]] = Math.max(senses[to[1]] ?? 0, +to[2]);
  }
  const sizes = species?.size.match(/\b(Tiny|Small|Medium|Large)\b/g) ?? [];
  if (sizes.length > 1 && !sizes.includes(state.size)) fail('size', `Choose ${sizes.join(' or ')}.`);
  const size = sizes.length > 1 ? state.size : sizes[0];
  const things = [...items.flatMap(weigh), ...(equipment.bought ? weigh(equipment.bought.name) : [])];
  const unweighed = [...things.filter(x => x.weight === null).map(x => x.item), ...carried.map(x => x.name), ...magicItems.filter(m => m.item).map(m => m.item.name)];
  // Capacity needs both a size and a Strength; until the player has chosen
  // them it's unknown, not zero.
  const capacity = Number.isFinite(scores.Strength) ? W.carrying.find(r => r.sizes.includes(size)) ?? null : null;
  const load = {
    items: things.filter(x => x.weight !== null).reduce((n, x) => n + x.weight, 0), coins: left / W.coinsPerPound, unweighed,
    carry: capacity ? scores.Strength * capacity.carry : null, drag: capacity ? scores.Strength * capacity.drag : null,
  };
  // More than the character can carry is the rule's to say ("While dragging,
  // … your Speed can be no more than 5 feet").
  load.over = load.carry !== null && load.items + load.coins > load.carry ? W.overloaded : null;

  return {
    problems, notes, species, option: options?.names.includes(state.option) ? state.option : null, size, background, scores, base, mod, level: total, bonus,
    xp: advancement.xp, nextXp: book.advancement[total]?.xp ?? null,
    // Each class's own columns at its level (Rages, Rage Damage, Focus
    // Points, Favors), those the sheet shows elsewhere left out: the
    // features, the cantrips, the spells and the slots.
    classes: known.map(c => ({ class: c.class, level: c.level, subclass: c.subclass ?? null, die: c.rules.die, source: c.rules.source, subclassBook: c.rules.subclasses.find(s => s.name === c.subclass)?.book ?? null,
      columns: Object.entries(c.rules.table.rows[c.level - 1]).filter(([k]) => ![c.rules.table.columns[0], 'Proficiency Bonus', 'Class Features', 'Cantrips', c.rules.spellsColumn, ...c.rules.slotLevels.map(String), ...(c.rules.pact ? ['Spell Slots', 'Slot Level'] : [])].includes(k)).map(([name, value]) => ({ name, value })) })),
    saves: ABILITIES.map(a => ({ ability: a, proficient: saves.includes(a), bonus: mod[a] + (saves.includes(a) ? bonus : 0) + saveBonus.reduce((n, x) => n + x.n, 0) })), saveItems: saveBonus.map(x => x.name), unattuned, attunementMax: book.attunementMax,
    skills, choices, saveChoices, weaponChoices, cantripTargets, tools, toolChoices, toolExpertise, optionalRules, originChoices, styleChoices, expertiseChoices, optionChoices, pickChoices, kindChoices, swapChoices, noteChoices, revelationChoices, revelationsKnown, walkedChoices, formChoices, spellSetChoices, spellbooks, masteryChoices, proficientWeapons, weaponTraining, abilityChoices, packageChoices: packageChoices.map(({ kit, ...c }) => c), languageChoices, stealthDisadvantage: Boolean(worn?.stealth_disadvantage), passivePerception: 10 + skills.find(s => s.name === 'Perception').bonus, initiative, speed,
    hp, hpFrom, hpMethod: rolled ? 'Rolled' : 'Fixed', hpRolls, hitDice: Object.entries(dice).map(([die, n]) => ({ die: +die, count: n })).sort((a, b) => b.die - a.die),
    inventory: { kept, goods: goods.map(g => ({ name: g.name, count: g.count, how: g.how, cost: g.entry.cost, item: asItem(g), index: g.index })), given: givenMagic.map(m => m.item.name), removed: inventory.remove ?? [], bought, wear: told ? (told[0]?.name ?? 'none') : 'auto', wearOptions },
    load, attacks, attacksPerAction: perAction, senses, speeds: moving, defenses: Object.fromEntries(Object.entries(defenses).map(([k, v]) => [k, [...v]])),
    features, read: [...read], feats, improvements, unarmored, armorClass, armor: worn, shield: Boolean(shield), hoveringShield: shield ? hovering?.name ?? null : null, shieldLeft, equipment, training,
    slots, casterLevel: shared, pacts, spellcasting, spellChoices, listChoices,
  };
}
