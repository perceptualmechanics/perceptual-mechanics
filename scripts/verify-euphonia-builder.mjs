// Holds the character builder's engine (src/euphonia/euphonia.character.js)
// to the SRD's own worked examples, each quoted from the rules it
// illustrates, and to every class, species and feat it reads: one it can't
// read is a failure here, not a guess on the page.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as defaultEngine from '../src/euphonia/euphonia.character.js';
import { LIVING, FROM, PRICES } from '../src/euphonia/euphonia.provenance.js';

const read = name => JSON.parse(readFileSync(new URL(`../src/euphonia/euphonia.${name}.json`, import.meta.url), 'utf8'));

// Scores that meet every class's primary ability, so an example tests the
// rule it quotes and nothing else.
const ABLE = { Strength: 15, Dexterity: 14, Constitution: 13, Intelligence: 13, Wisdom: 13, Charisma: 13 };
const POINT_BUY = { Strength: 15, Dexterity: 14, Constitution: 13, Intelligence: 12, Wisdom: 10, Charisma: 8 };
const someone = (classes, extra = {}) => ({
  species: 'Human', size: 'Medium', background: 'Soldier', increases: { Strength: 1, Dexterity: 1, Constitution: 1 },
  method: 'rolled', base: ABLE, classes, originFeats: { 'Human Versatile': 'Alert' }, styles: { 'Fighter 1 Fighting Style': 'Archery' }, tools: { 'Soldier tools': ['Gaming Set (Dice)'] }, ...extra,
});

export function verifyEuphoniaBuilder({ engine = defaultEngine, srd = read('srd'), euphonia = read('classes'), setting = read('characters'), subclasses = read('subclasses'), items = read('items').data } = {}) {
  const problems = [];
  const fail = m => problems.push(m);
  let book;
  try { book = engine.rulebook(srd, euphonia, setting, subclasses, items); } catch (e) { return { ok: false, failures: 1, log: [`\neuphonia builder: the rulebook doesn't build: ${e.message}`] }; }
  // Weapon Mastery and languages have checks of their own (below); a build
  // that doesn't name its weapons takes the first kinds the engine offers,
  // and one that doesn't name its languages takes as many distinct ones as
  // it's asked, so other checks test only what they quote.
  const run = (state, where) => {
    try {
      const got = engine.character(book, state);
      const fill = {};
      if (!state.mastery && got.masteryChoices?.length) fill.mastery = Object.fromEntries(got.masteryChoices.map(c => [c.key, c.from.slice(0, c.count).map(w => w.name)]));
      if (!state.languages && got.languageChoices?.length) { let n = 0; fill.languages = Object.fromEntries(got.languageChoices.map(c => [c.key, Array.from({ length: c.count }, () => `Tongue ${++n}`)])); }
      return Object.keys(fill).length ? engine.character(book, { ...state, ...fill }) : got;
    } catch (e) { fail(`${where}: ${e.message}`); return null; }
  };
  // The Fighting Style and Expertise a build leaves open, filled from what
  // the engine offers, distinct each time: what it asks for can be met.
  const complete = (state, where) => {
    for (let pass = 0; pass < 4; pass++) {
      const got = run(state, where);
      if (!got) return state;
      const styles = book.feats.filter(f => f.category === 'Fighting Style').map(f => f.name);
      state = { ...state, styles: Object.fromEntries(got.styleChoices.map((c, i) => [c.key, state.styles?.[c.key] ?? styles[i]])) };
      const taken = new Set();
      state.expertise = Object.fromEntries(got.expertiseChoices.map(c => { const pick = c.from.filter(x => !taken.has(x)).slice(0, c.count); pick.forEach(x => taken.add(x)); return [c.key, pick]; }));
      // The options a class's table counts: the first open ones it doesn't
      // already have, each counting as its first art the subclass leaves.
      state.options = Object.fromEntries(got.optionChoices.map(o => [o.class, o.open.filter(x => !o.given.some(g => g.name === x.name) && !x.requires?.length).slice(0, o.count).map(x => ({ name: x.name, art: x.arts.find(a => a !== o.forgone) }))]));
      state.optionArts = Object.fromEntries(got.optionChoices.flatMap(o => o.given.map(g => [`${o.class} ${g.name}`, g.arts.find(a => a !== o.forgone)])));
      // A one-of choice, its first option; a Weapon Mastery, its first kinds;
      // an Origin feat a feature grants, the first that can be taken.
      state.picks = Object.fromEntries(got.pickChoices.map(c => [c.key, state.picks?.[c.key] ?? c.offered[0].name]));
      state.mastery = Object.fromEntries(got.masteryChoices.map(c => [c.key, c.from.slice(0, c.count).map(w => w.name)]));
      state.originFeats = { ...Object.fromEntries(got.originChoices.map(c => [c.key, 'Skilled'])), ...state.originFeats };
      // A skill choice a feature brings, from what it offers.
      state.skills = { ...Object.fromEntries(got.choices.map(c => [c.key, c.from.slice(0, c.count)])), ...state.skills };
      // Tools: each choice its first that no other took; Expertise with the
      // first tools it offers. A list's choice (a damage type, a half), a
      // saving throw, a weapon, a Revelation, a land: the first offered, a
      // Revelation not chosen elsewhere.
      const tooled = new Set();
      const had = c => new Set(got.tools.filter(t => t.from.some(src => src !== c.label)).map(t => t.name));
      state.tools = Object.fromEntries([...got.toolChoices.map(c => { const pick = c.from.filter(t => !tooled.has(t) && !had(c).has(t)).slice(0, c.count); pick.forEach(t => tooled.add(t)); return [c.key, pick]; }),
        ...got.toolExpertise.map(c => [c.key, c.from.filter(t => t !== c.skill).slice(0, c.count)])]);
      state.kinds = Object.fromEntries(got.kindChoices.map(c => [c.key, state.kinds?.[c.key] ?? c.offered[0]]));
      state.saves = Object.fromEntries(got.saveChoices.map(c => [c.key, c.offered[0]]));
      state.weapons = Object.fromEntries(got.weaponChoices.map(c => [c.key, c.from[0].name]));
      const revealed = new Set();
      state.revelations = Object.fromEntries(got.revelationChoices.map(c => { const r = c.options.find(x => !revealed.has(x.name)); revealed.add(r.name); return [c.key, r.name]; }));
      state.spellSets = Object.fromEntries(got.spellSetChoices.map(c => [c.key, c.sets[0].name]));
      // A spellbook: its first level 1 spells, then the lowest others, to
      // its count; a school's free picks, the first it offers. A class's
      // cantrips, the first on its list (an invocation improves one).
      state.spellbooks = Object.fromEntries(got.spellbooks.flatMap(b => {
        const first = b.offered.filter(sp => sp.level === 1).slice(0, b.start), rest = b.offered.filter(sp => !first.includes(sp)).slice(0, b.free - first.length);
        return [[b.class, [...first, ...rest].map(sp => sp.name)], ...b.extra.map(x => [x.key, x.from.slice(0, x.count).map(sp => sp.name)])];
      }));
      state.spells = { ...Object.fromEntries(got.spellcasting.map(sc => [sc.class, got.spellChoices.find(c => c.key === sc.class)?.list.filter(sp => sp.level === 0).slice(0, sc.cantrips).map(sp => sp.name) ?? []])), ...state.spells };
      state.cantripTargets = Object.fromEntries(got.cantripTargets.map(c => [c.key, c.from[0]]));
      // Wild Shape's forms, the first it allows; a name for each named
      // choice; the first Revelation that can count as walked.
      state.forms = Object.fromEntries(got.formChoices.map(c => [c.key, c.from.slice(0, c.count).map(b => b.name)]));
      state.notes = Object.fromEntries(got.noteChoices.map(c => [c.key, `A ${c.what}`]));
      state.walked = Object.fromEntries(got.walkedChoices.map(c => [c.key, c.offered[0]]));
    }
    return state;
  };
  const level = n => book.advancement[n - 1];

  // The SRD's worked examples.
  const examples = [
    ['“a score of 14 costs 7 of your 27 points”', () => book.pointCosts.get(14) === 7 && book.pointBudget === 27],
    ['“a character [with] a Wisdom of 15 and proficiency in the Perception skill, … a Passive Perception of 14”', () => {
      const c = run(someone([{ class: 'Ranger', level: 1 }], { base: { ...ABLE, Wisdom: 15 }, skills: { Ranger: ['Perception', 'Stealth', 'Survival'], 'Human Skillful': ['Arcana'] } }), 'passive perception');
      return c?.passivePerception === 14;
    }],
    ['“if a character reaches level 8 and increases their Constitution score from 17 to 18, … the Hit Point maximum then increases by 8”', () => {
      const at = con => run(someone([{ class: 'Fighter', level: 8, subclass: 'Champion' }], { base: { ...ABLE, Constitution: con }, increases: { Strength: 1, Dexterity: 1, Wisdom: 1 } }), 'constitution')?.hp;
      return at(18) - at(17) === 8;
    }],
    ['“a Barbarian who decides to multiclass into the Druid class must have Strength and Wisdom scores of 13 or higher”', () => {
      const mc = wis => run(someone([{ class: 'Barbarian', level: 1 }, { class: 'Druid', level: 1 }], { base: { ...ABLE, Wisdom: wis } }), 'prerequisite')?.problems.some(p => /Multiclassing needs Wisdom 13/.test(p.message));
      return mc(12) === true && mc(13) === false;
    }],
    ['“if you are a level 6 Cleric / level 1 Fighter, you must gain enough XP to reach level 8”', () => {
      const c = run(someone([{ class: 'Cleric', level: 6, subclass: 'Life Domain' }, { class: 'Fighter', level: 1 }]), 'experience');
      return c?.level === 7 && c.nextXp === level(8).xp;
    }],
    ['“if you are a level 5 Fighter / level 5 Paladin, you have ten d10 Hit Dice”', () => {
      const c = run(someone([{ class: 'Fighter', level: 5, subclass: 'Champion' }, { class: 'Paladin', level: 5, subclass: 'Oath of Devotion' }]), 'hit dice');
      return JSON.stringify(c?.hitDice) === JSON.stringify([{ die: 10, count: 10 }]);
    }],
    ['“If you are a level 5 Cleric / level 5 Paladin, for example, you have five d8 Hit Dice and five d10 Hit Dice”', () => {
      const c = run(someone([{ class: 'Cleric', level: 5, subclass: 'Life Domain' }, { class: 'Paladin', level: 5, subclass: 'Oath of Devotion' }]), 'mixed hit dice');
      return JSON.stringify(c?.hitDice) === JSON.stringify([{ die: 10, count: 5 }, { die: 8, count: 5 }]);
    }],
    ['“if you are a level 3 Fighter / level 2 Rogue, you have the Proficiency Bonus of a level 5 character, which is +3”', () => run(someone([{ class: 'Fighter', level: 3, subclass: 'Champion' }, { class: 'Rogue', level: 2 }]), 'bonus')?.bonus === 3],
    ['“a level 4 Ranger / level 3 Sorcerer … count as a level 5 character … four level 1 spell slots, three level 2 slots, and two level 3 slots”', () => {
      const c = run(someone([{ class: 'Ranger', level: 4, subclass: 'Hunter' }, { class: 'Sorcerer', level: 3, subclass: 'Draconic Sorcery' }]), 'slots');
      return c?.casterLevel === 5 && c.slots.join() === '4,3,2,0,0,0,0,0,0';
    }],
    ['“you can prepare five level 1 Ranger spells, and you can prepare six Sorcerer spells of level 1 or 2 (as well as four Sorcerer cantrips)”', () => {
      const c = run(someone([{ class: 'Ranger', level: 4, subclass: 'Hunter' }, { class: 'Sorcerer', level: 3, subclass: 'Draconic Sorcery' }]), 'prepared');
      const r = c?.spellcasting.find(s => s.class === 'Ranger'), s = c?.spellcasting.find(x => x.class === 'Sorcerer');
      return r?.prepared === 5 && r.highest === 1 && s?.prepared === 6 && s.highest === 2 && s.cantrips === 4;
    }],
  ];
  for (const [quote, holds] of examples) if (!holds()) fail(`the SRD's example doesn't hold: ${quote}`);

  // The subclasses the books add to the SRD's classes: every one offered,
  // ahead of the SRD's own (Scott: emphasize them), and each built to level
  // 20 with nothing it can't read, only the problems its choices left open,
  // and every feature it has.
  const offered = book.classes.flatMap(c => c.subclasses.filter(s => s.class_name).map(s => `${c.name}: ${s.name}`));
  for (const s of subclasses.data) if (!offered.includes(`${s.class_name}: ${s.name}`)) fail(`${s.class_name}'s ${s.name} isn't offered`);
  for (const c of book.classes) {
    const order = c.subclasses.map(s => s.source);
    if (order.lastIndexOf('Euphonia') > order.indexOf('SRD 5.2.1') && order.includes('SRD 5.2.1')) fail(`${c.name}: an SRD subclass is offered before one of Euphonia's`);
  }
  let booked = 0;
  for (const s of subclasses.data) {
    const c = book.classNamed(s.class_name);
    if (!c?.subclasses.some(x => x.name === s.name)) continue;
    const state = someone([{ class: c.name, level: 20, subclass: s.name }], {
      method: 'point', base: POINT_BUY,
      improvements: Object.fromEntries(c.improvements.map(i => [`${c.name} ${i.level}`, { feat: 'Ability Score Improvement', increases: { Dexterity: 1, Wisdom: 1 } }])),
      skills: { [c.name]: c.skills.from.slice(0, c.skills.count), 'Human Skillful': ['Arcana'] },
    });
    const got = run(complete(state, `${c.name} ${s.name}`), `${c.name} ${s.name}`);
    if (!got) continue;
    if (got.problems.length) fail(`${c.name} (${s.name}) at level 20: ${got.problems.map(p => p.message).join(' ')}`);
    else if (got.features.filter(f => f.subclass === s.name).length !== s.features.length) fail(`${c.name} (${s.name}): its features don't all come through at level 20`);
    else booked++;
  }

  // Coverage: every feature of every class and subclass offered, every
  // option a class's features list, and every section of an optional rule,
  // that asks the player for a lasting choice, the engine reads into one.
  // A choice made in play isn't one: a sentence framed by the moment it's
  // made ("When you cast…", "Whenever you finish a Long Rest…", "As a Bonus
  // Action…"), or choosing whom or where an effect lands ("each creature of
  // your choice", "a point you choose", "a willing creature can choose to
  // fail"). Each is built at level 20 with its subclass, every choice made,
  // and each option taken alone.
  // A choice is asked in its own words, or in what a feature has the player
  // pick without saying "choose": forms known ("You know four Beast forms"),
  // a Revelation that "counts as walked", "another skill", "one more
  // accomplishment", an Attunement's spells ("You can swap any of them").
  const CHOICE = /\b(?:of your choice|[Cc]hoose|your choice|You know \w+ Beast forms|counts as walked|another (?:skill|tool|cantrip)|one more \w+ from|swap any of them)\b/;
  const INPLAY = new RegExp([
    '^(?:When|Whenever|If|As (?:a|an|part)|Once|Each (?:time|turn)|Until|While|On (?:each|a|your)|At (?:the start|the end|any point)|Immediately|After|Before|In addition, when|For (?:1|one) (?:minute|hour)|Outside combat|Out of a fight)\\b',
    '\\b(?:when|whenever|each time) you (?:cast|use|take|make|hit|open|call|spend|expend|finish|roll|curse|draw|go|create|gain an? \\w+ level|reach|replace|transform|teleport|inscribe|travel|end|sing|study|start|set)',
    '\\b(?:creatures?|points?|spaces?|direction|ally|allies|targets?|objects?|places?|patients?|one|two) (?:of your choice|you choose|that you choose)',
    '\\byou choose (?:which|for each|when|whether|the|one of them|either|how)\\b', '\\bwhen you choose\\b', '\\bChoose (?:a|any) number of\\b', '\\bcan choose to\\b', '\\byour choice for each\\b', '\\bChoose one:',
    '\\bChoose (?:a|an|one|any number of) (?:creature|point|Observed creature|ability score|damage type, other than)',
  ].join('|'));
  // Except a choice that stands until it's made again ("When you finish a
  // Long Rest, choose the suit's model", "Choose one damage type … whenever
  // you finish a Short or Long Rest") or is made once, as the feature comes
  // ("When you gain this feature, one Revelation you know counts as
  // walked"): the sheet shows it, so the builder has to offer it, as a
  // choice of that feature's own and not only by reading the feature.
  const STANDING = /^(?:When you gain this feature|(?:When|Whenever) you finish an? (?:Short or )?Long Rest, choose)\b|\bChoose [^.]+? whenever you finish\b/;
  // Sentences by paragraph, a sidebar (a blockquote: the book's commentary
  // and summaries) left out. A sentence after one made in play, in its
  // paragraph, tells what that does, and is in play too ("As a Bonus Action,
  // choose a creature … you learn one of the following facts about it of
  // your choice"); so is a list a paragraph made in play leads ("When you
  // cast Find Familiar, … the following benefits. **Aerial or Aquatic.** …
  // a Fly Speed or a Swim Speed (your choice)"). One that refuses a choice
  // ("can't choose to fail", "don't choose sides") asks none.
  const sentencesOf = text => {
    let framed = false;
    return text.replace(/^>.*$/gm, '').replace(/^\|.*\|$/gm, '').replace(/\n(?=- )/g, ' ').split(/\n{2,}/).filter(par => par.trim()).flatMap(par => {
      const all = par.replace(/\n/g, ' ').split(/(?<=[.!?:])\s+(?=[A-Z*_(>-])/).map(x => x.replace(/^[\s>*_-]+/, '').replace(/^\*{0,3}[^*]{1,60}?\.\*{0,3}\s+/, ''));
      const item = /^\s*(?:\*\*|- |\*[A-Z])/.test(par);
      if (!item) framed = false;
      const open = [];
      for (const x of all) { if (STANDING.test(x)) open.push(x); else if (INPLAY.test(x)) framed = true; else if (!framed) open.push(x); }
      // The frame carries into the list a paragraph leads ("… the following
      // benefits.", "…:"), and on through its items.
      framed = framed && (item || /(?:following \w+\.?|:)\s*$/.test(par.trim()));
      return open;
    });
  };
  const asks = text => sentencesOf(text).filter(x => CHOICE.test(x) && (!INPLAY.test(x) || STANDING.test(x)) && !/\b(?:can't|cannot|don't|doesn't) choose\b/.test(x));
  const unread = [];
  let units = 0;
  const cover = (c, got, f) => {
    units++;
    const left = asks(f.text), key = `${c.name} ${f.level} ${f.name}`;
    const offered = Object.entries(got).filter(([k, v]) => /Choices$/.test(k) && Array.isArray(v)).some(([, v]) => v.some(x => x.key === key));
    const standing = left.find(x => STANDING.test(x));
    if (left.length && !got.read.includes(key)) unread.push(`${c.name}${f.subclass ? ` (${f.subclass})` : ''} ${f.level}, ${f.name}: "${left[0].slice(0, 90)}"`);
    else if (standing && !offered) unread.push(`${c.name}${f.subclass ? ` (${f.subclass})` : ''} ${f.level}, ${f.name}, read but not offered: "${standing.slice(0, 90)}"`);
  };
  for (const c of book.classes) {
    for (const sub of c.subclasses) {
      const base = { method: 'point', base: POINT_BUY, skills: { [c.name]: c.skills.from.slice(0, c.skills.count), 'Human Skillful': ['Arcana'] },
        improvements: Object.fromEntries(c.improvements.map(i => [`${c.name} ${i.level}`, { feat: 'Ability Score Improvement', increases: { Dexterity: 1, Wisdom: 1 } }])),
        optional: Object.fromEntries((c.optional_rules ?? []).map(r => [`${c.name} ${r.name}`, { taken: true, rites: { 4: 'passed', 8: 'failed', 12: 'failed', 16: 'passed' }, final: 'Mastery' }])) };
      const got = run(complete(someone([{ class: c.name, level: 20, subclass: sub.name }], base), `${c.name} ${sub.name}`), `${c.name} ${sub.name}`);
      if (!got) continue;
      for (const f of got.features.filter(x => x.class === c.name && (!x.subclass || x.subclass === sub.name) && !x.option && !x.kind && (x.subclass || sub === c.subclasses[0]))) cover(c, got, { ...f, subclass: f.subclass });
      // Each option alone, the first subclass's character taking it.
      if (sub !== c.subclasses[0]) continue;
      for (const o of got.optionChoices) for (const x of [...o.open, ...o.given]) {
        const one = run({ ...complete(someone([{ class: c.name, level: 20, subclass: sub.name }], base), c.name), options: { [c.name]: [{ name: x.name, art: x.arts?.[0] }] } }, `${c.name} ${x.name}`);
        const f = one?.features.find(y => y.option && y.name === x.name);
        if (f) cover(c, one, f);
      }
    }
  }
  if (unread.length) fail(`${unread.length} feature(s) ask a lasting choice the builder doesn't offer:\n    ${unread.join('\n    ')}`);

  // Every class, to level 20 alone, with its first subclass, its feats and
  // its skills: nothing it can't read, and only the problems the choices
  // left open.
  let classes = 0;
  for (const c of book.classes) {
    const improvements = Object.fromEntries(c.improvements.map(i => [`${c.name} ${i.level}`, { feat: 'Ability Score Improvement', increases: { Dexterity: 1, Wisdom: 1 } }]));
    const state = someone([{ class: c.name, level: 20, subclass: c.subclasses[0].name }], {
      method: 'point', base: POINT_BUY, improvements,
      skills: { [c.name]: c.skills.from.slice(0, c.skills.count), 'Human Skillful': ['Arcana'] },
    });
    const got = run(complete(state, c.name), c.name);
    if (!got) continue;
    // An Epic Boon level can't take the Ability Score Improvement past 20,
    // which point-buy scores never reach here.
    if (got.problems.length) fail(`${c.name} at level 20: ${got.problems.map(p => p.message).join(' ')}`);
    // A caster whose list offers cantrips knows some, at the first level it
    // casts and at 20: the count comes from its table or from the feature
    // that grants them (the Revelator's Planar Adept).
    for (const lv of [1, 20]) {
      const at = lv === 20 ? got : run(complete(someone([{ class: c.name, level: 1 }], { method: 'point', base: POINT_BUY, skills: { [c.name]: c.skills.from.slice(0, c.skills.count), 'Human Skillful': ['Arcana'] } }), c.name), c.name);
      const casting = at?.spellChoices.find(x => x.key === c.name);
      if (casting?.list.some(sp => sp.level === 0) && !casting.cantrips) fail(`${c.name} at level ${lv}: its list offers cantrips, but it knows none`);
    }
    if (got.features.filter(f => f.subclass).length !== c.subclasses[0].features.length) fail(`${c.name}: its subclass's features don't all come through at level 20`);
    // In the order a character gains them: by level, the class's feature
    // that grants the subclass before the subclass's own at that level.
    if (got.features.some((f, i) => i && f.level < got.features[i - 1].level)) fail(`${c.name}: its features aren't in level order`);
    const grant = got.features.findIndex(f => /subclass of your choice/.test(f.text));
    if (got.features.findIndex(f => f.subclass) < grant) fail(`${c.name}: a subclass feature comes before the feature that grants the subclass`);
    // The class's own hit points; what a sentence adds is held below.
    if (got.hp - got.hpFrom.reduce((n, x) => n + x.hp, 0) !== c.die + 19 * (c.die / 2 + 1) + 20 * book.modifier(POINT_BUY.Constitution + 1)) fail(`${c.name}: ${got.hp} hit points at level 20`);
    classes++;
  }
  // Each class alone, level by level, shows its own table's Proficiency
  // Bonus and spell slots; and through the Multiclass Spellcaster table, at
  // the level its count gives, the same slots, as the SRD's table is built.
  let levels = 0;
  for (const c of book.classes) {
    for (let l = 1; l <= 20; l++) {
      const row = c.table.rows[l - 1];
      const got = run(complete(someone([{ class: c.name, level: l, subclass: c.subclasses[0].name }], { skills: { [c.name]: c.skills.from.slice(0, c.skills.count), 'Human Skillful': ['Arcana'] } }), `${c.name} ${l}`), `${c.name} ${l}`);
      if (!got) continue;
      if (got.bonus !== Number(row['Proficiency Bonus'].replace('+', ''))) fail(`${c.name} ${l}: Proficiency Bonus +${got.bonus}, its table's ${row['Proficiency Bonus']}`);
      const own = Array.from({ length: 9 }, (_, i) => Number(row[i + 1] === undefined || /^[—–]$/.test(row[i + 1]) ? 0 : row[i + 1]));
      if (got.slots.join() !== own.join()) fail(`${c.name} ${l}: slots ${got.slots.join(',')}, its table's ${own.join(',')}`);
      if (c.multiclass.spell_slots) {
        const at = engine.casterLevel([{ rules: c, level: l }]);
        if (book.multiclassSlots[at - 1]?.join() !== own.join()) fail(`${c.name} ${l}: counts as caster level ${at}, whose shared slots ${book.multiclassSlots[at - 1]?.join(',')} aren't its own ${own.join(',')}`);
      }
      levels++;
    }
  }
  // A primary ability of "Strength or Dexterity" is met by either (the
  // Soldier's increases add one to each).
  const fighterMc = (str, dex) => run(someone([{ class: 'Fighter', level: 1 }, { class: 'Rogue', level: 1 }], { base: { ...ABLE, Strength: str, Dexterity: dex } }), 'either')?.problems.some(p => /for Fighter/.test(p.message));
  if (!(fighterMc(7, 14) === false && fighterMc(11, 11) === true)) fail('the Fighter\'s “Strength or Dexterity” isn\'t read as either one');
  // Every Ability Score Improvement raises the scores it names: five of
  // +1 Dexterity take a 15 to 20.
  const raised = run(someone([{ class: 'Wizard', level: 20, subclass: 'Evoker' }], { base: { ...ABLE, Dexterity: 14 }, skills: { Wizard: ['Arcana', 'History'], 'Human Skillful': ['Insight'] }, improvements: Object.fromEntries(book.classNamed('Wizard').improvements.map(i => [`Wizard ${i.level}`, { feat: 'Ability Score Improvement', increases: { Dexterity: 1, Wisdom: 1 } }])) }), 'improvements');
  if (raised?.scores.Dexterity !== 20 || raised.scores.Wisdom !== 18) fail(`five Ability Score Improvements of +1 Dexterity and Wisdom gave ${raised?.scores.Dexterity} and ${raised?.scores.Wisdom}, not 20 and 18`);

  // An Epic Boon fills the Epic Boon's level, not an Ability Score
  // Improvement's.
  const boonAt = lv => run(someone([{ class: 'Fighter', level: lv, subclass: 'Champion' }], { skills: { Fighter: ['Athletics', 'History'], 'Human Skillful': ['Arcana'] }, improvements: { [`Fighter ${lv}`]: { feat: 'Boon of Fate', increases: { Wisdom: 1 } } } }), 'epic boon')?.problems.some(p => p.field === `improvement:Fighter ${lv}` && /isn't a feat/.test(p.message));
  if (!(boonAt(4) === true && boonAt(19) === false)) fail('an Epic Boon feat is allowed where an Ability Score Improvement is, or refused at the Epic Boon');

  // A setting class with a class feature withheld is set aside, by name,
  // and every other setting class is offered: plant a withheld feature in
  // one that's whole and it leaves too.
  for (const name of book.unfinished) if (book.classNamed(name)) fail(`${name} has a class feature withheld but is offered`);
  for (const c of euphonia.data) if (!book.unfinished.includes(c.name) && !book.classNamed(c.name)) fail(`${c.name} is whole but not offered`);
  const whole = euphonia.data.find(c => !book.unfinished.includes(c.name));
  // So does a withheld multiclass paragraph, which leaves the class no
  // multiclass rules to build with.
  for (const where of ['level 2 feature', 'Level 2: A Planted Feature', 'As a Multiclass Character']) {
    try {
      const planted = engine.rulebook(srd, { ...euphonia, withheld: [...euphonia.withheld, { where: `${whole.name} · ${where}`, reasons: ['bracket'] }] }, setting, subclasses, items);
      if (planted.classNamed(whole.name) || !planted.unfinished.includes(whole.name)) fail(`a withheld ${where} planted in ${whole.name} doesn't set it aside`);
    } catch (e) { fail(`a withheld ${where} planted in ${whole.name}: ${e.message}`); }
  }

  // Every species and its one choice; every feat's prerequisite.
  for (const s of book.species) {
    const options = engine.speciesOptions(s);
    const got = run({ ...someone([{ class: 'Fighter', level: 1 }]), species: s.name, option: options?.names[0], size: 'Medium', skills: { Fighter: ['Athletics', 'History'], [`${s.name} Keen Senses`]: ['Insight'], [`${s.name} Skillful`]: ['Arcana'] } }, s.name);
    if (got?.problems.length) fail(`${s.name}: ${got.problems.map(p => p.message).join(' ')}`);
  }
  for (const f of book.feats) {
    try { engine.qualifies(book, f, { level: 20, scores: ABLE, features: [] }); } catch (e) { fail(e.message); }
    if (f.benefits.some(b => b.name === 'Ability Score Increase') && !engine.featIncrease(f)) fail(`${f.name}: its Ability Score Increase doesn't read`);
  }
  // Hit points a sentence adds: Draconic Resilience's "by 3, and … by 1
  // whenever you gain another Sorcerer level", Dwarven Toughness's "by 1,
  // and … by 1 again whenever you gain a level".
  const added = (state, name) => run(state, name)?.hpFrom.find(x => x.from === name)?.hp;
  const sorcerer = lv => added(someone([{ class: 'Sorcerer', level: lv, subclass: 'Draconic Sorcery' }]), 'Draconic Resilience');
  const dwarf = lv => added({ ...someone([{ class: 'Fighter', level: lv, subclass: lv >= 3 ? 'Champion' : '' }]), species: 'Dwarf' }, 'Dwarven Toughness');
  const mixed = added(someone([{ class: 'Sorcerer', level: 3, subclass: 'Draconic Sorcery' }, { class: 'Fighter', level: 2 }]), 'Draconic Resilience');
  if (mixed !== 3) fail(`Draconic Resilience counts Sorcerer levels, not the character's: ${mixed} at Sorcerer 3 / Fighter 2, not 3`);
  if (!(sorcerer(3) === 3 && sorcerer(20) === 20)) fail(`Draconic Resilience adds ${sorcerer(3)} at Sorcerer 3 and ${sorcerer(20)} at 20, not 3 and 20`);
  if (!(dwarf(1) === 1 && dwarf(5) === 5)) fail(`Dwarven Toughness adds ${dwarf(1)} at level 1 and ${dwarf(5)} at 5, not 1 and 5`);
  // The gear the builder chooses: the kits, then the best armour the
  // character is trained in, has the Strength for and can buy, held to the
  // SRD's armour: “if you wear Leather Armor, your base AC is 11 plus your
  // Dexterity modifier, whereas your AC is 16 in Chain Mail”; a Shield's +2;
  // Medium armour's Dexterity up to +2; Unarmored Defense with a Shield for a
  // Barbarian, not for a Monk; and past level 1, the table's money.
  const geared = (classes, base = ABLE) => run(someone(classes, { base }), classes.map(c => `${c.class} ${c.level}`).join(' / '));
  const fighter1 = geared([{ class: 'Fighter', level: 1 }]), rogue1 = geared([{ class: 'Rogue', level: 1 }]);
  if (!(fighter1?.armor?.name === 'Chain Mail' && fighter1.armorClass.ac === 16 && !fighter1.equipment.bought && fighter1.equipment.gold === 4 + 14)) fail(`a level 1 Fighter should wear the kit's Chain Mail (AC 16) with 18 GP left: ${JSON.stringify(fighter1 && [fighter1.armor?.name, fighter1.armorClass, fighter1.equipment.gold])}`);
  if (!(rogue1?.armor?.name === 'Leather Armor' && rogue1.armorClass.ac === 11 + rogue1.mod.Dexterity)) fail(`a level 1 Rogue's kit Leather Armor gives ${rogue1?.armorClass.ac}, not 11 + Dexterity`);
  const paladin1 = geared([{ class: 'Paladin', level: 1 }]), wizard1 = geared([{ class: 'Wizard', level: 1 }]);
  if (!(paladin1?.shield && paladin1.armorClass.ac === 18)) fail(`a level 1 Paladin's Chain Mail and Shield give ${paladin1?.armorClass.ac}, not 18`);
  if (!(wizard1 && !wizard1.armor && wizard1.armorClass.ac === 10 + wizard1.mod.Dexterity)) fail('a Wizard, trained in no armor, should wear none');
  const fighter5 = geared([{ class: 'Fighter', level: 5, subclass: 'Champion' }]), weak5 = geared([{ class: 'Fighter', level: 5, subclass: 'Champion' }], { ...ABLE, Strength: 12 });
  if (!(fighter5?.armor?.name === 'Splint Armor' && fighter5.armorClass.ac === 17 && fighter5.equipment.gold === 4 + 14 + 500 - 200 && fighter5.equipment.levelGold === 500 && fighter5.equipment.roll === '1d10 × 25 GP'))
    fail(`a level 5 Fighter should buy Splint Armor with the table's 500 GP, 318 left: ${JSON.stringify(fighter5 && [fighter5.armor?.name, fighter5.equipment.gold, fighter5.equipment.roll])}`);
  if (!(weak5 && weak5.armor?.name === 'Breastplate' && weak5.armorClass.ac === 16 && weak5.speed === 30)) fail(`at Strength 13 a level 5 Fighter can't wear Splint, and takes the Breastplate over Chain Mail (the same AC, no Disadvantage on Stealth): ${weak5?.armor?.name}, ${weak5?.armorClass.ac}`);
  const barbarian11 = geared([{ class: 'Barbarian', level: 11, subclass: 'Path of the Berserker' }], { ...ABLE, Dexterity: 17 });
  if (!(barbarian11?.armor?.name === 'Half Plate Armor' && barbarian11.armorClass.ac === 17)) fail(`Half Plate at Dexterity 18 gives ${barbarian11?.armorClass.ac}, not 15 + 2`);
  const monkish = geared([{ class: 'Cleric', level: 1 }, { class: 'Monk', level: 1 }], { ...ABLE, Dexterity: 17, Wisdom: 18 });
  const raging = geared([{ class: 'Cleric', level: 1 }, { class: 'Barbarian', level: 1 }], { ...ABLE, Dexterity: 17, Constitution: 17 });
  if (!(monkish?.armorClass.from === 'Unarmored Defense' && !monkish.shield && monkish.armorClass.ac === 10 + monkish.mod.Dexterity + monkish.mod.Wisdom)) fail(`a Cleric/Monk should set down the kit's Shield for Unarmored Defense: ${JSON.stringify(monkish?.armorClass)}`);
  if (!(raging?.shield && raging.armorClass.ac === 10 + raging.mod.Dexterity + raging.mod.Constitution + 2)) fail(`a Cleric/Barbarian's Unarmored Defense should keep the kit's Shield: ${JSON.stringify(raging?.armorClass)}`);
  // The magic items, the table's count of each rarity, from the books': none
  // at level 1; a subclass's own family member first; a rarity a family
  // gives one member (the Gunner's Spare Barrel) only to that member; an
  // item in several rarities at the rarest slot it fills; none twice, none
  // the DM hands out, each one the character can use.
  if (fighter1?.equipment.magicItems.length) fail('a level 1 character has magic items; the table begins at level 2');
  const magic = (cls, level, subclass) => geared([{ class: cls, level, subclass }])?.equipment.magicItems ?? [];
  const named = list => list.map(m => (m.item ? `${m.rarity} ${m.item.name}${m.item.member ? ` (${m.item.member})` : ''}${m.item.bonus ?? ''}` : `${m.rarity} —`));
  const factor = magic('Counsellor', 5, 'Factor'), gunner = magic('Mhizha', 11, 'Gunner'), chemist = magic('Mhizha', 17, 'Chemist');
  if (named(factor).join() !== 'Common Cipher Wheel,Uncommon Keepsakes of the Disciplines (House Ledger)') fail(`a level 5 Factor Counsellor's magic items: ${named(factor).join(', ')}`);
  if (!named(gunner).includes("Rare Master's Piece (Spare Barrel)") || named(gunner).some(n => /^Uncommon Master's Piece/.test(n))) fail(`a level 11 Gunner's Master's Piece should be the Rare Spare Barrel: ${named(gunner).join(', ')}`);
  if (!named(chemist).includes("Uncommon Master's Piece (Athanor)") || !named(chemist).includes('Very Rare Tuned Arc Gun+3')) fail(`a level 17 Chemist should have the Athanor and the Tuned Arc Gun at +3: ${named(chemist).join(', ')}`);
  for (const c of book.classes) {
    const sub = c.subclasses.find(x => x.source === 'Euphonia') ?? c.subclasses[0];
    const got = geared([{ class: c.name, level: 17, subclass: sub.name }]);
    if (!got) continue;
    const table = book.higherLevelEquipment.find(r => r.lo <= 17 && r.hi >= 17).magic;
    if (got.equipment.magicItems.length !== table.reduce((n, r) => n + r.count, 0)) fail(`${c.name} 17: ${got.equipment.magicItems.length} magic item slots, not the table's`);
    const picked = got.equipment.magicItems.filter(m => m.item).map(m => book.items.find(i => i.name === m.item.name));
    if (new Set(picked.map(i => i.name)).size !== picked.length) fail(`${c.name} 17: an item given twice`);
    for (const i of picked) {
      if (i.dm) fail(`${c.name} 17: ${i.name} is one the DM hands out`);
      if (/No one starts play with/.test(i.text)) fail(`${c.name} 17: ${i.name} starts play, though "No one starts play with" one`);
      if (i.who && !(i.who.class === c.name && (!i.who.subclasses || i.who.subclasses.includes(sub.name)))) fail(`${c.name} (${sub.name}) 17: given ${i.name}, which requires Attunement by ${i.attunement.by}`);
    }
  }
  // Where the items come from (euphonia.provenance.js, authored): each
  // homeland a region of the State of the World, and each quote in the
  // item's name or text or a homeland's chapter. A living tradition goes
  // only to a character of its homeland; the homeland's items come first;
  // a Mutapan curiosity is priced where it's bought, as the books price it:
  // by default the one place they name in the homeland, none where they
  // split the region or don't price it, and the buyer's price at a court or
  // in Japan.
  const regions = read('regions').data;
  for (const x of [...LIVING, ...FROM, ...PRICES.flatMap(p => p.places.map(a => ({ ...a, item: p.item })))]) {
    const it = items.items.find(i => i.name === x.item);
    for (const h of x.homelands) if (!regions.some(r => r.name === h)) fail(`euphonia.provenance.js: ${x.item}'s homeland "${h}" isn't a region`);
    const where = [it?.name, it?.text, ...x.homelands.map(h => JSON.stringify(regions.find(r => r.name === h) ?? ''))].join('\n');
    for (const q of x.because) if (!where.includes(q)) fail(`euphonia.provenance.js: "${q}" isn't in ${x.item}'s text or its homelands' chapters`);
  }
  try {
    const marked = { ...items, items: items.items.map(i => (i.name === 'Water-Bearer\'s Bucket' ? { ...i, text: `${i.text}\n\n*A living tradition.* Planted.` } : i)) };
    engine.rulebook(srd, euphonia, setting, subclasses, marked);
    fail('an item planted as a living tradition, with no homeland in euphonia.provenance.js, builds');
  } catch { /* the rulebook refuses it, as it should */ }
  const from = (homeland, cls = 'Fighter', subclass = 'Champion') => run({ ...someone([{ class: cls, level: 11, subclass }]), homeland }, `${cls} of ${homeland || 'nowhere'}`)?.equipment;
  for (const r of ['', ...regions.map(x => x.name)]) {
    const got = from(r);
    for (const m of got?.magicItems ?? []) {
      const living = LIVING.find(x => x.item === m.item?.name);
      if (living && !living.homelands.includes(r)) fail(`${m.item.name}, a living tradition of ${living.homelands.join(' and ')}, given to a character of ${r || 'no homeland'}`);
    }
  }
  const named11 = h => (from(h)?.magicItems ?? []).map(m => m.item?.name);
  if (!named11('The Americas').includes('Khipu of Record') || !named11('East and Southeast Asia').includes('Talisman Papers (fu)') || !named11('India').includes('Lahore Astrolabe') || !named11('India').includes('Talismanic Shirt'))
    fail(`a homeland's items first: the Americas' ${named11('The Americas').join(', ')}; East and Southeast Asia's ${named11('East and Southeast Asia').join(', ')}; India's ${named11('India').join(', ')}`);
  const lamp = (homeland, market) => run({ ...someone([{ class: 'Fighter', level: 11, subclass: 'Champion' }]), homeland, market }, `a lamp bought by ${homeland || 'no one'} in ${market || 'the homeland'}`)?.equipment.forSale.find(x => x.name === 'Self-Lighting Lamp');
  const base = items.items.find(i => i.name === 'Mutapan Curiosities').pieces.find(p => p.name === 'Self-Lighting Lamp').cost;
  const LAMPS = [['Mutapa and the Indian Ocean', 'Sofala', base], ['India', '', 5 * base], ['Europe', '', 10 * base], ['The Americas', '', 10 * base], ['East and Southeast Asia', '', null], ['East and Southeast Asia', 'China', 10 * base],
    ['East and Southeast Asia', 'Malacca or Aceh', 5 * base], ['East and Southeast Asia', 'Japan, at Nagasaki', null], ['Europe', 'a court', null], ['West and Central Africa', '', null], ['', '', null],
    ['Mutapa and the Indian Ocean', '', null], ['Mutapa and the Indian Ocean', 'the Swahili coast', 5 * base], ['The Ottomans, Persia and the Horn', '', 5 * base]];
  const lamps = LAMPS.map(([h, m]) => lamp(h, m));
  if (!LAMPS.every(([, , cost], i) => lamps[i] && lamps[i].cost === cost) || !/whatever the buyer will bear/.test(lamps[7]?.note) || !/the DM sets it/.test(lamps[9]?.note) || !/by place/.test(lamps[4]?.note) || !/by place/.test(lamps[11]?.note))
    fail(`Self-Lighting Lamps: ${LAMPS.map(([h, m], i) => `${h || 'no homeland'}${m ? ` in ${m}` : ''} ${lamps[i]?.cost ?? 'no price'} (${lamps[i]?.note})`).join('; ')}`);
  // Every form "Requires Attunement by …" takes, each given to one who
  // qualifies and never to one who doesn't: a class (a multiclass character
  // with its levels qualifies), a subclass ("a Geomancer Wizard"), the
  // family member for the character's subclass or pathway ("a Danae of the
  // Token's Subclass"), and a chapter's subclasses ("a Sorcerer of an Origin
  // in This Chapter").
  const holds = (classes, item) => (geared(classes)?.equipment.magicItems ?? []).some(m => `${m.item?.name}${m.item?.member ? ` (${m.item.member})` : ''}` === item);
  const ATTUNED = [
    ['by a class', [{ class: 'Revelator', level: 17, subclass: 'The Bridge' }], "Wayfarer's Staff", [{ class: 'Fighter', level: 17, subclass: 'Champion' }]],
    ['by a class, multiclassed', [{ class: 'Fighter', level: 9, subclass: 'Champion' }, { class: 'Revelator', level: 8, subclass: 'The Bridge' }], "Wayfarer's Staff", [{ class: 'Fighter', level: 17, subclass: 'Champion' }]],
    ['by a subclass', [{ class: 'Wizard', level: 5, subclass: 'Geomancer' }], 'Mason\'s Square and Compasses', [{ class: 'Wizard', level: 5, subclass: 'Evoker' }]],
    ["by the Token's subclass", [{ class: 'Danae', level: 5, subclass: 'Binding' }], 'Tokens of Method (Binding)', [{ class: 'Danae', level: 5, subclass: 'Crossing' }]],
    ["by the Keepsake's pathway", [{ class: 'Revelator', level: 11, subclass: 'The Bridge' }], 'Pathway Keepsakes (The Bridge)', [{ class: 'Revelator', level: 11, subclass: 'The Tree' }]],
    ['by an origin in the chapter', [{ class: 'Sorcerer', level: 5, subclass: 'Earth Origin' }], 'Pressure Gauge', [{ class: 'Sorcerer', level: 5, subclass: 'Draconic Sorcery' }]],
  ];
  for (const [form, yes, item, no] of ATTUNED) {
    if (!holds(yes, item)) fail(`Attunement ${form}: ${yes.map(c => `${c.class} ${c.level} (${c.subclass})`).join(' / ')} isn't given ${item}`);
    if (holds(no, item)) fail(`Attunement ${form}: ${no.map(c => `${c.class} ${c.level} (${c.subclass})`).join(' / ')} is given ${item}`);
  }
  // The books' gear to buy: the period weapons that count as one the
  // character is proficient with, and a class chapter's gear only for that
  // class.
  const forSale = cls => geared([{ class: cls, level: 5, subclass: book.classNamed(cls).subclasses[0].name }])?.equipment.forSale.map(x => x.name) ?? [];
  const wizardGear = forSale('Wizard'), philosopherGear = forSale('Natural Philosopher');
  if (!(wizardGear.includes('Bagh nakh') && !wizardGear.includes('Sword cane') && !wizardGear.includes('Weatherglass') && philosopherGear.includes('Weatherglass')))
    fail(`the gear to buy: a Wizard's ${wizardGear.join(', ')}; a Natural Philosopher's ${philosopherGear.join(', ')}`);
  // A Human's Versatile takes an Origin feat, and Skilled from it up to
  // three skills.
  const versatile = run(someone([{ class: 'Fighter', level: 1 }], { originFeats: { 'Human Versatile': 'Skilled' }, skills: { Fighter: ['Athletics', 'History'], 'Human Skillful': ['Arcana'], 'feat Versatile (Human)': ['Stealth', 'Nature', 'Religion'] } }), 'versatile');
  if (!versatile?.feats.some(f => f.feat.name === 'Skilled') || !['Stealth', 'Nature', 'Religion'].every(n => versatile.skills.find(x => x.name === n).proficient) || versatile.problems.length) fail(`Versatile's Skilled doesn't grant its three skills: ${versatile?.problems.map(p => p.message).join(' ')}`);
  // Spells, by the SRD's example: a level 4 Ranger / level 3 Sorcerer
  // “can prepare five level 1 Ranger spells, and … six Sorcerer spells of
  // level 1 or 2 (as well as four Sorcerer cantrips)”.
  const list = (cls, level) => book.classNamed(cls).spellList.filter(sp => sp.level === level).map(sp => sp.name);
  const spellProblems = (state, where) => run(state, where)?.problems.filter(p => p.field.startsWith('spells:')).map(p => p.message);
  const caster = spells => spellProblems(someone([{ class: 'Ranger', level: 4, subclass: 'Hunter' }, { class: 'Sorcerer', level: 3, subclass: 'Draconic Sorcery' }], { spells }), 'spells');
  const fits = caster({ Ranger: list('Ranger', 1).slice(0, 5), Sorcerer: [...list('Sorcerer', 0).slice(0, 4), ...list('Sorcerer', 1).slice(0, 3), ...list('Sorcerer', 2).slice(0, 3)] });
  const over = [
    caster({ Ranger: list('Ranger', 1).slice(0, 6) }), caster({ Ranger: list('Ranger', 2).slice(0, 1) }),
    caster({ Sorcerer: list('Sorcerer', 0).slice(0, 5) }), caster({ Sorcerer: list('Sorcerer', 3).slice(0, 1) }),
    caster({ Sorcerer: list('Wizard', 1).filter(n => !list('Sorcerer', 1).includes(n)).slice(0, 1) }),
  ];
  if (fits?.length || !over.every(p => p?.length === 1)) fail(`the Ranger 4 / Sorcerer 3 example's spells aren't held to five, six and four: ${JSON.stringify([fits, over])}`);
  // Magic Initiate: an Acolyte's from the Cleric list; again by Versatile,
  // a different list.
  const initiate = (versatile, spells) => spellProblems({ ...someone([{ class: 'Fighter', level: 1 }]), background: 'Acolyte', increases: { Intelligence: 1, Wisdom: 1, Charisma: 1 }, originFeats: { 'Human Versatile': 'Magic Initiate' }, featLists: { 'Versatile (Human)': versatile }, spells }, 'magic initiate');
  const clean = initiate('Wizard', { 'feat Acolyte': [...list('Cleric', 0).slice(0, 2), list('Cleric', 1)[0]], 'feat Versatile (Human)': [...list('Wizard', 0).slice(0, 2), list('Wizard', 1)[0]] });
  const wrong = [
    initiate('Cleric', {}), initiate('Bard', {}),
    initiate('Wizard', { 'feat Acolyte': list('Wizard', 0).filter(n => !list('Cleric', 0).includes(n)).slice(0, 1) }),
    initiate('Wizard', { 'feat Acolyte': list('Cleric', 1).slice(0, 2) }),
    initiate('Wizard', { 'feat Acolyte': list('Cleric', 0).slice(0, 3) }),
  ];
  if (clean?.length || !wrong.every(p => p?.length === 1)) fail(`Magic Initiate isn't held to its list, two cantrips, one level 1 spell, and a different list each time: ${JSON.stringify([clean, wrong])}`);
  // The setting's backgrounds: each builds a character clean once its
  // choices are made; Schooled's either-or skill and its "Cleric or Wizard,
  // your choice" are choices, and nothing else.
  let backgrounds = 0;
  for (const b of book.backgrounds.filter(x => x.source === 'Euphonia')) {
    const [a1, a2, a3] = b.ability_scores;
    const initiate = b.feat.startsWith('Magic Initiate');
    const asked = { ...someone([{ class: 'Fighter', level: 1 }]), background: b.name, increases: { [a1]: 1, [a2]: 1, [a3]: 1 },
      originFeats: { 'Human Versatile': b.feat === 'Alert' ? 'Skilled' : 'Alert' }, featLists: { [b.name]: 'Wizard' },
      skills: { Fighter: ['Animal Handling', 'Persuasion'].filter(x => !b.skills.includes(x)).concat(['Acrobatics']).slice(0, 2), 'Human Skillful': ['Arcana'], [`${b.name} skills`]: b.skill_choice?.from.slice(0, 1) } };
    // Its tools, the first each choice offers (Skilled's are its three, as
    // no skills are taken with it here).
    const first = run(asked, b.name);
    const got = first && run({ ...asked, tools: Object.fromEntries(first.toolChoices.map(c => [c.key, c.from.filter(t => !first.tools.some(x => x.name === t && x.from.some(src => src !== c.label))).slice(0, c.count)])) }, b.name);
    if (got?.problems.length) fail(`${b.name}: ${got.problems.map(p => p.message).join(' ')}`);
    else if (!got?.feats.some(f => f.from === b.name) || (initiate && !got.spellChoices.some(c => c.key === `feat ${b.name}`))) fail(`${b.name}: its feat doesn't come through`);
    else backgrounds++;
  }
  const schooled = (list, skill) => run({ ...someone([{ class: 'Fighter', level: 1 }]), background: 'Schooled', increases: { Intelligence: 1, Wisdom: 1, Charisma: 1 }, featLists: { Schooled: list },
    skills: { Fighter: ['Athletics', 'Insight'], 'Human Skillful': ['Stealth'], 'Schooled skills': skill } }, 'Schooled')?.problems.map(p => p.field);
  if (!(schooled('Cleric', ['Religion'])?.length === 0 && schooled('Druid', ['Arcana'])?.includes('spells:feat Schooled') && schooled('Wizard', [])?.includes('skills:Schooled skills') && schooled('Wizard', ['Nature'])?.includes('skills:Schooled skills')))
    fail('Schooled isn\'t held to Religion or Arcana and to the Cleric or Wizard list');
  const unplaced = book.species.filter(s => !book.placement(s.name)).map(s => s.name);
  if (unplaced.length) fail(`the setting doesn't place ${unplaced.join(', ')}`);

  // Expertise doubles the bonus, once a skill: a Rogue's two at level 1 and
  // two more at 6; the Wizard's Scholar from its own list; a Crowner's
  // Investigation, proficiency first. Fighting Style: the Fighter's feat,
  // the Champion's second, and Defense's +1 only in armour.
  const rogue = (lv, expertise) => run(someone([{ class: 'Rogue', level: lv, subclass: lv >= 3 ? 'Thief' : '' }], { skills: { Rogue: ['Acrobatics', 'Deception', 'Insight', 'Stealth'], 'Human Skillful': ['Arcana'] }, expertise, improvements: lv >= 4 ? { 'Rogue 4': { feat: 'Ability Score Improvement', increases: { Dexterity: 1, Wisdom: 1 } } } : {} }), `Rogue ${lv}`);
  const r1 = rogue(1, { 'Rogue 1 Expertise': ['Stealth', 'Deception'] });
  const r6 = rogue(6, { 'Rogue 1 Expertise': ['Stealth', 'Deception'], 'Rogue 1 Expertise 2': ['Insight', 'Acrobatics'] });
  const twice = rogue(6, { 'Rogue 1 Expertise': ['Stealth', 'Deception'], 'Rogue 1 Expertise 2': ['Stealth', 'Acrobatics'] });
  const unskilled = rogue(1, { 'Rogue 1 Expertise': ['Stealth', 'Medicine'] });
  const stealth = r => r?.skills.find(x => x.name === 'Stealth');
  if (!(r1?.problems.length === 0 && stealth(r1).bonus === r1.mod.Dexterity + 2 * r1.bonus && r6?.problems.length === 0 && r6.expertiseChoices.length === 2
    && twice?.problems.some(p => /already has Expertise/.test(p.message)) && unskilled?.problems.some(p => p.field === 'expertise:Rogue 1 Expertise')))
    fail(`a Rogue's Expertise isn't doubled, two and two more, once a skill, among its proficiencies: ${JSON.stringify([r1?.problems, r6?.problems])}`);
  const scholar = pick => run(someone([{ class: 'Wizard', level: 2 }], { skills: { Wizard: ['Arcana', 'History'], 'Human Skillful': ['Athletics'] }, expertise: { 'Wizard 2 Scholar': pick } }), 'Scholar')?.problems.filter(p => p.field.startsWith('expertise:')).length;
  if (!(scholar(['Arcana']) === 0 && scholar(['Athletics']) === 1)) fail('the Wizard\'s Scholar isn\'t held to its own list of skills');
  const crowner = run(someone([{ class: 'Natural Philosopher', level: 3, subclass: 'Crowner' }], { skills: { 'Natural Philosopher': ['Arcana', 'History', 'Insight'], 'Human Skillful': ['Athletics'] }, expertise: { 'Natural Philosopher 2 Instruments': [], 'Natural Philosopher 3 Reconstruction': ['Investigation'] } }), 'Crowner');
  const investigation = crowner?.skills.find(x => x.name === 'Investigation');
  if (!(investigation?.proficient && investigation.expertise)) fail('a Crowner\'s Investigation isn\'t given proficiency and Expertise');
  // The SRD's choices, as their sentences and tables give them. A Cleric's
  // Divine Order: the Thaumaturge's extra cantrip and its bonus to Arcana
  // and Religion (the Wisdom modifier, at least +1), the Protector's Heavy
  // armor. Eldritch Invocations by their column (one at level 1, eight at
  // 12), Witch Sight closed until 15, Devouring Blade needing Thirsting
  // Blade, Agonizing Blast taken twice. Metamagic two, four and six at
  // levels 2, 10 and 17. Mystic Arcanum a spell at each of levels 6 to 9 by
  // 17. Weapon Mastery: the Fighter's by its column (four at 4), the
  // Barbarian's melee weapons only, the Rogue's Simple weapons and Martial
  // ones that are Finesse or Light (19), the Courtier's Simple and Martial
  // Finesse (18). Primal Knowledge from the Barbarian's list; the Danae's
  // Courtly Grace one skill of four.
  {
    const as = (cls, lv, extra = {}) => run(someone([{ class: cls, level: lv, subclass: lv >= 3 ? book.classNamed(cls).subclasses[0].name : '' }], { skills: {}, ...extra }), `${cls} ${lv}`);
    const order = pick => as('Cleric', 1, { base: { ...ABLE, Wisdom: 10 }, picks: { 'Cleric 1 Divine Order': pick } });
    const thaum = order('Thaumaturge'), prot = order('Protector');
    const arcana = r => r?.skills.find(s => s.name === 'Arcana');
    if (!(thaum?.spellChoices.find(s => s.key === 'Cleric')?.cantrips === 4 && prot?.spellChoices.find(s => s.key === 'Cleric')?.cantrips === 3)) fail('the Thaumaturge\'s extra cantrip isn\'t counted');
    if (!(arcana(thaum)?.bonus - arcana(prot)?.bonus === 1 && prot?.training.includes('Heavy') && !thaum?.training.includes('Heavy'))) fail('Divine Order\'s Arcana bonus or Heavy armor doesn\'t follow the choice');
    const warlock = (lv, names) => as('Warlock', lv, { options: { Warlock: names.map(name => ({ name })) } });
    const inv = r => r?.optionChoices.find(o => o.class === 'Warlock');
    const w12 = warlock(12, ['Witch Sight', 'Devouring Blade', 'Agonizing Blast', 'Agonizing Blast']);
    if (!(inv(warlock(1, []))?.count === 1 && inv(w12)?.count === 8)) fail(`Eldritch Invocations count ${inv(warlock(1, []))?.count} and ${inv(w12)?.count}, not 1 and 8`);
    if (!(w12?.problems.some(p => p.field === 'option:Warlock:0' && /isn't open/.test(p.message)) && w12.problems.some(p => /Devouring Blade needs Thirsting Blade/.test(p.message)) && !w12.problems.some(p => p.field.startsWith('option:') && /Agonizing Blast/.test(p.message)))) fail('invocations\' prerequisites, or Agonizing Blast\'s repeat, aren\'t held');
    const meta = lv => as('Sorcerer', lv).optionChoices.find(o => o.class === 'Sorcerer')?.count;
    if (`${meta(2)},${meta(10)},${meta(17)}` !== '2,4,6') fail(`Metamagic counts ${meta(2)}, ${meta(10)}, ${meta(17)}, not 2, 4, 6`);
    const arcanum = lv => warlock(lv, []).spellChoices.filter(s => /Mystic Arcanum/.test(s.label)).map(s => s.highest).join();
    if (arcanum(11) !== '6' || arcanum(17) !== '6,7,8,9') fail(`Mystic Arcanum reads ${arcanum(11)} at 11 and ${arcanum(17)} at 17`);
    const mastery = (cls, lv) => as(cls, lv, { mastery: {} }).masteryChoices[0];
    const kinds = m => `${m?.count}/${m?.from.length}`;
    if (kinds(mastery('Fighter', 4)) !== '4/38' || kinds(mastery('Barbarian', 1)) !== '2/28' || kinds(mastery('Rogue', 1)) !== '2/19' || (book.classNamed('Courtier') && kinds(mastery('Courtier', 2)) !== '2/18')) fail(`Weapon Mastery reads Fighter ${kinds(mastery('Fighter', 4))}, Barbarian ${kinds(mastery('Barbarian', 1))}, Rogue ${kinds(mastery('Rogue', 1))}, at Fighter 4, not 4/38, 2/28, 2/19`);
    // Pact of the Tome: three cantrips and two level 1 rituals from any list.
    const tome = warlock(1, ['Pact of the Tome']).spellChoices.find(c => /Pact of the Tome/.test(c.label));
    if (!(tome?.cantrips === 3 && tome.prepared === 2 && tome.list.some(sp => !sp.level) && tome.list.filter(sp => sp.level).length && tome.list.filter(sp => sp.level).every(sp => sp.level === 1 && /\bR\b/.test(sp.special)))) fail('Pact of the Tome doesn\'t offer three cantrips and two level 1 rituals');
    const primal = as('Barbarian', 3).choices.find(c => c.key === 'Barbarian 3 Primal Knowledge');
    if (primal?.from.join() !== book.classNamed('Barbarian').skills.from.join()) fail('Primal Knowledge doesn\'t offer the Barbarian\'s skill list');
    // Languages: Common and two more for everyone; the Rogue's Thieves' Cant
    // given with one more, the Druid's Druidic given, the Ranger's two; a
    // language named twice refused.
    const tongues = (cls, lv) => as(cls, lv, { languages: {} }).languageChoices.map(c => `${c.count}${c.given.length ? `+${c.given.join('+')}` : ''}`).join(',');
    if (tongues('Fighter', 1) !== '1,2' || tongues('Rogue', 1) !== '1,2,1+Thieves’ Cant' || tongues('Druid', 1) !== '1,2,0+Druidic' || tongues('Ranger', 2) !== '1,2,2') fail(`languages read Fighter ${tongues('Fighter', 1)}, Rogue ${tongues('Rogue', 1)}, Druid ${tongues('Druid', 1)}, Ranger ${tongues('Ranger', 2)}`);
    if (!as('Fighter', 1, { languages: { Common: ['Castilian'], standard: ['Latin', 'castilian'] } }).problems.some(p => /already one of your languages/.test(p.message))) fail('a language named twice is taken');
    const grace = book.classNamed('Danae') && as('Danae', 20).choices.find(c => /Courtly Grace/.test(c.key));
    if (book.classNamed('Danae') && !(grace?.count === 1 && grace.from.join() === 'Deception,Intimidation,Performance,Persuasion')) fail('Courtly Grace doesn\'t ask one of its four skills');
  }
  // The Courtier's accomplishments, as its table and its words count them:
  // two at level 1 and eight at 20; the College of Arms closes an
  // accomplishment that counts only as Letters and gives The Code; Regard is
  // the different arts; one taken "twice" can't be taken a third time; and it
  // prepares its spells, two at level 1, with two cantrips chosen beside
  // the three it always knows. Every Table asks two skills of its four.
  if (book.classNamed('Courtier')) {
    const courtier = (lv, sub, options, extra = {}) => run(someone([{ class: 'Courtier', level: lv, subclass: sub }], { skills: { Courtier: ['Arcana', 'History', 'Insight'], 'Human Skillful': ['Athletics'] }, options: { Courtier: options }, ...extra }), `Courtier ${lv}`);
    const accomplishments = got => got?.optionChoices.find(o => o.class === 'Courtier');
    const one = courtier(1, '', [{ name: 'The Library' }, { name: 'Every Table', art: 'Society' }]);
    const arms = courtier(3, 'Arms', [{ name: 'The Library' }, { name: 'A Secret' }, { name: 'The Stage' }, { name: 'Horse and Bow' }], { optionArts: { 'Courtier The Code': 'Society' } });
    const thrice = courtier(5, '', [{ name: 'A Secret' }, { name: 'A Secret' }, { name: 'A Secret' }, { name: 'The Stage' }]);
    const every = one?.choices.find(c => c.key === 'Courtier accomplishment 1');
    const casting = one?.spellChoices.find(c => c.key === 'Courtier');
    if (!(accomplishments(one)?.count === 2 && accomplishments(courtier(20, '', []))?.count === 8)) fail(`the Courtier's accomplishments count ${accomplishments(one)?.count} at level 1, not its table's 2`);
    if (!(arms?.problems.some(p => p.field === 'option:Courtier:0') && accomplishments(arms)?.given.some(g => g.name === 'The Code'))) fail('the College of Arms leaves Letters open, or doesn\'t give The Code');
    if (accomplishments(one)?.regard !== 2 || accomplishments(arms)?.regard !== 4) fail(`Regard reads ${accomplishments(one)?.regard} and ${accomplishments(arms)?.regard}, not 2 and 4`);
    if (!thrice?.problems.some(p => p.field === 'option:Courtier:2' && /twice/.test(p.message))) fail('a Courtier takes A Secret three times');
    if (!(casting?.prepared === 2 && casting.verb === 'prepared' && casting.cantrips === 2 && casting.given.map(s => s.name).join() === 'Prestidigitation,Mending,Message' && casting.list.some(sp => sp.name === 'Vicious Mockery'))) fail(`the Courtier's spells read ${JSON.stringify(casting && { prepared: casting.prepared, verb: casting.verb, cantrips: casting.cantrips, given: casting.given.map(s => s.name) })}`);
    if (!(every?.count === 2 && every.from.join() === 'Deception,Insight,Intimidation,Persuasion')) fail('Every Table doesn\'t ask two of its four skills');
    if (!arms?.proficientWeapons.some(w => w.name === 'Longbow')) fail('Horse and Bow gives no proficiency with Longbows');
  }
  const fighter = (lv, styles) => run(someone([{ class: 'Fighter', level: lv, subclass: lv >= 3 ? 'Champion' : '' }], { styles, skills: { Fighter: ['Athletics', 'History'], 'Human Skillful': ['Arcana'] }, improvements: Object.fromEntries([4, 6].filter(x => x <= lv).map(x => [`Fighter ${x}`, { feat: 'Ability Score Improvement', increases: { Strength: 1, Constitution: 1 } }])) }), 'Fighting Style');
  const champion = fighter(7, { 'Fighter 1 Fighting Style': 'Archery', 'Fighter 7 Additional Fighting Style': 'Defense' });
  const same = fighter(7, { 'Fighter 1 Fighting Style': 'Archery', 'Fighter 7 Additional Fighting Style': 'Archery' });
  const defended = fighter(1, { 'Fighter 1 Fighting Style': 'Defense' });
  if (!(champion?.problems.length === 0 && champion.armorClass.ac === 17 + 1 && same?.problems.some(p => /already yours/.test(p.message)) && defended?.armorClass.ac === 16 + 1 && defended.unarmored[0].ac === 10 + defended.mod.Dexterity))
    fail(`Fighting Style: the Champion's second, Defense's +1 in armour and not out of it: ${JSON.stringify([champion?.problems, champion?.armorClass, defended?.armorClass, defended?.unarmored])}`);

  // What a feature gives a character to fight and work with, from its
  // sentences: the Lionskin's suit, worn without the kit's Shield; the
  // Chirurgeon's training and the weapons it names; and what a feature hands
  // over to carry (the Arc Gun, the Mapmaker's map).
  const featureText = (cls, sub, name) => euphonia.data.find(c => c.name === cls)?.subclasses.find(s => s.name === sub)?.features.find(f => f.name === name)?.text ?? '';
  const lionskin = run(someone([{ class: 'Mhizha', level: 3, subclass: 'Lionskin' }]), 'Lionskin 3');
  const suitAc = +featureText('Mhizha', 'Lionskin', 'Powered Suit').match(/base Armor Class of (\d+)/)?.[1];
  if (!(suitAc && lionskin?.armor?.name === 'Powered Suit' && lionskin.armor.madeFrom === 'Scale Mail' && !lionskin.shield && lionskin.armorClass.ac === suitAc && lionskin.training.includes('Heavy') && lionskin.stealthDisadvantage))
    fail(`a Lionskin wears ${JSON.stringify(lionskin && { armor: lionskin.armor?.name, madeFrom: lionskin.armor?.madeFrom, shield: lionskin.shield, ac: lionskin.armorClass, training: lionskin.training })}, not its suit at ${suitAc} without a Shield`);
  const chirurgeon = run(someone([{ class: 'Physician', level: 3, subclass: 'Chirurgeon' }]), 'Chirurgeon 3');
  const theatre = featureText('Physician', 'Chirurgeon', 'Theatre Training').match(/following Martial weapons: (.+?)\./)?.[1].replace(/\bthe /g, '').split(/,(?: and)? /) ?? [];
  const missing = theatre.filter(n => !chirurgeon?.proficientWeapons.some(w => w.name === n));
  if (!theatre.length || missing.length || !['Medium', 'Shield'].every(t => chirurgeon?.training.includes(t)))
    fail(`a Chirurgeon's Theatre Training: training ${chirurgeon?.training.join(', ')}; ${theatre.length ? `not proficient with ${missing.join(', ') || 'nothing missing'}` : 'its weapons aren\'t read'}`);
  const carried = (lv, sub) => run(someone([{ class: 'Mhizha', level: lv, subclass: sub }]), `Mhizha ${lv} ${sub}`)?.equipment.carried?.map(x => x.name).join() ?? null;
  const CARRIED = [[1, '', 'Arc Gun'], [3, 'Mapmaker', 'Arc Gun,The Map'], [3, 'Gunner', 'Arc Gun']];
  for (const [lv, sub, want] of CARRIED) if (carried(lv, sub) !== want) fail(`a Mhizha ${lv}${sub ? ` ${sub}` : ''} carries ${carried(lv, sub)}, not ${want}`);

  // The Lionskin's model, as its lines say: the Infiltrator quiet in the suit
  // and 10 feet faster, the Guardian neither. The Fiend's Resilience, any of
  // the SRD's damage types but the one it rules out. Speed a feature adds,
  // as its condition and its class table allow (Fast Movement; Unarmored
  // Movement's column).
  const model = m => run(someone([{ class: 'Mhizha', level: 3, subclass: 'Lionskin' }], { kinds: { 'Mhizha 3 Powered Suit': m } }), `Lionskin ${m}`);
  const [infiltrator, guardian] = [model('Infiltrator'), model('Guardian')];
  const human = book.species.find(s => s.name === 'Human').speed.match(/^(\d+)/)?.[1];
  if (!(infiltrator?.speed === +human + 10 && !infiltrator.stealthDisadvantage && guardian?.speed === +human && guardian.stealthDisadvantage))
    fail(`the Lionskin's models: Infiltrator ${infiltrator?.speed} feet${infiltrator?.stealthDisadvantage ? ', loud' : ''}; Guardian ${guardian?.speed} feet${guardian?.stealthDisadvantage ? '' : ', quiet'}`);
  const resilience = run(someone([{ class: 'Warlock', level: 10, subclass: 'Fiend Patron' }]), 'Fiend 10')?.kindChoices.find(c => c.key === 'Warlock 10 Fiendish Resilience')?.offered ?? [];
  if (resilience.join() !== srd.tables.damage_types.map(r => r.Type).filter(t => t !== 'Force').join()) fail(`Fiendish Resilience offers ${resilience.join(', ') || 'nothing'}`);
  const monkRow = lv => +srd.classes.find(c => c.name === 'Monk').table.rows[lv - 1]['Unarmored Movement'].match(/^\+(\d+)/)[1];
  const fast = run(someone([{ class: 'Barbarian', level: 5, subclass: 'Path of the Berserker' }]), 'Barbarian 5')?.speed;
  const monks = [2, 6, 18].map(lv => run(someone([{ class: 'Monk', level: lv, subclass: lv >= 3 ? 'Warrior of the Open Hand' : '' }]), `Monk ${lv}`)?.speed);
  if (fast !== +human + 10 || monks.some((v, i) => v !== +human + monkRow([2, 6, 18][i]))) fail(`speed from features: a Barbarian 5 ${fast} feet; Monks 2, 6, 18 ${monks.join(', ')}`);

  // Attacks, each number worked from the SRD's tables: a weapon's die from
  // the Weapons table and its ability's modifier, the Proficiency Bonus, the
  // Attack action's count; a Monk's Martial Arts column; a cantrip's dice at
  // the character's level and its class's save DC; a feature that sets the
  // ability (the Lionskin's gauntlets) or offers one (Calculation).
  const weapon = n => srd.weapons.find(w => w.name === n);
  const hitOf = (r, n) => r?.attacks?.find(a => a.name === n);
  const champion11 = run(someone([{ class: 'Fighter', level: 11, subclass: 'Champion' }]), 'Fighter 11');
  const sword = hitOf(champion11, 'Greatsword'), plus = n => (n ? ` ${n > 0 ? '+' : '−'} ${Math.abs(n)}` : '');
  if (!(champion11?.attacksPerAction === 3 && sword?.bonus === champion11.mod.Strength + champion11.bonus && sword.damage === `${weapon('Greatsword').damage.split(' ')[0]}${plus(champion11.mod.Strength)} ${weapon('Greatsword').damage.split(' ')[1]}`))
    fail(`a Fighter 11's Greatsword: ${JSON.stringify(sword)}, ${champion11?.attacksPerAction} attacks`);
  const monk5 = run(someone([{ class: 'Monk', level: 5, subclass: 'Warrior of the Open Hand' }]), 'Monk 5');
  const art = srd.classes.find(c => c.name === 'Monk').table.rows[4]['Martial Arts'];
  if (!hitOf(monk5, 'Unarmed Strike')?.damage.startsWith(`${art} `)) fail(`a Monk 5's Unarmed Strike deals ${hitOf(monk5, 'Unarmed Strike')?.damage}, not its Martial Arts ${art}`);
  const wizard5 = run(someone([{ class: 'Wizard', level: 5, subclass: 'Evoker' }], { spells: { Wizard: ['Fire Bolt'] } }), 'Wizard 5');
  const bolt = hitOf(wizard5, 'Fire Bolt'), boltSpell = srd.spells.find(x => x.name === 'Fire Bolt');
  const casting = wizard5?.spellcasting.find(x => x.class === 'Wizard');
  if (!(casting?.dc === srd.attacks.spell_save_dc_base + wizard5.mod.Intelligence + wizard5.bonus && bolt?.bonus === wizard5.mod.Intelligence + wizard5.bonus && bolt.damage === `${boltSpell.upgrade.steps.filter(([lv]) => lv <= 5).at(-1)[1]} Fire`))
    fail(`a Wizard 5: ${JSON.stringify({ casting: casting && [casting.ability, casting.dc, casting.attack], bolt })}`);
  const fists = hitOf(model('Guardian'), 'Unarmed Strike'), lion = model('Guardian');
  if (!(fists?.ability === 'Intelligence' && fists.damage === `${1 + lion.mod.Intelligence} Force`)) fail(`a Lionskin's gauntlets: ${JSON.stringify(fists)}`);
  const counsellor = run(someone([{ class: 'Counsellor', level: 1 }], { base: { ...ABLE, Intelligence: 18 } }), 'Counsellor 1');
  if (hitOf(counsellor, 'Rapier')?.ability !== 'Intelligence') fail(`Calculation: a Counsellor's Rapier uses ${hitOf(counsellor, 'Rapier')?.ability}`);

  // Senses, speeds, defenses and weapon training, each from its sentence:
  // an Elf's Darkvision and the Drow's lineage row; a Dragonborn's
  // resistance from its ancestry's row, and none from Rage, whose benefits
  // hold only while it's active; the Lionskin's Climb Speed only as an
  // Infiltrator, and its Fly Speed at 14; a Rogue's weapons as its class
  // writes them.
  const elfSpecies = srd.species.find(x => x.name === 'Elf'), lineage = n => Object.values(elfSpecies.tables).flat().find(r => Object.values(r)[0] === n);
  const seeing = o => run({ ...someone([{ class: 'Fighter', level: 1 }]), species: 'Elf', option: o, skills: { Fighter: ['Athletics', 'History'], 'Elf Keen Senses': ['Insight'] } }, `${o}`)?.senses.Darkvision;
  const feetIn = t => +t.match(/(\d+) feet/)[1];
  if (seeing('Wood Elf') !== feetIn(elfSpecies.traits.find(t => t.name === 'Darkvision').text) || seeing('Drow') !== feetIn(lineage('Drow')['Level 1'])) fail(`Darkvision: a Wood Elf ${seeing('Wood Elf')} feet, a Drow ${seeing('Drow')}`);
  const blackResists = run({ ...someone([{ class: 'Fighter', level: 1 }]), species: 'Dragonborn', option: 'Black' }, 'Black Dragonborn')?.defenses.resistances;
  const ancestryType = Object.values(srd.species.find(x => x.name === 'Dragonborn').tables).flat().find(r => Object.values(r)[0] === 'Black')['Damage Type'];
  if (blackResists?.join() !== ancestryType) fail(`a Black Dragonborn resists ${blackResists?.join(', ')}, not ${ancestryType}`);
  const unraged = run(someone([{ class: 'Barbarian', level: 5, subclass: 'Path of the Berserker' }]), 'Barbarian 5')?.defenses.resistances;
  if (!unraged || unraged.length) fail(`a Barbarian out of Rage resists ${unraged?.join(', ')}`);
  const climbs = (m, lv) => run(someone([{ class: 'Mhizha', level: lv, subclass: 'Lionskin' }], { kinds: { 'Mhizha 3 Powered Suit': m } }), `Lionskin ${lv} ${m}`);
  const [inf6, grd6, grd14] = [climbs('Infiltrator', 6), climbs('Guardian', 6), climbs('Guardian', 14)];
  if (!(inf6?.speeds.Climb === inf6.speed && !grd6?.speeds.Climb && grd14?.speeds.Fly === grd14.speed && !grd6.speeds.Fly)) fail(`the Lionskin's speeds: ${JSON.stringify([inf6?.speeds, grd6?.speeds, grd14?.speeds])}`);
  const rogueWeapons = run(someone([{ class: 'Rogue', level: 1 }]), 'Rogue 1')?.weaponTraining;
  const finesseMartial = srd.weapons.filter(w => w.category === 'Martial' && w.properties.some(p => /^(?:Finesse|Light)\b/.test(p))).map(w => w.name);
  if (!(rogueWeapons?.categories.join() === 'Simple' && rogueWeapons.named.join() === finesseMartial.join())) fail(`a Rogue's weapons: ${JSON.stringify(rogueWeapons)}`);

  // A class's own columns at its level, as its table gives them (a
  // Barbarian 5's Rages and Rage Damage), and none the sheet shows
  // elsewhere (a Wizard's cantrips and spells).
  const barbarianRow = srd.classes.find(c => c.name === 'Barbarian').table.rows[4];
  const barbarianColumns = run(someone([{ class: 'Barbarian', level: 5, subclass: 'Path of the Berserker' }]), 'Barbarian 5')?.classes[0].columns;
  const wizardColumns = run(someone([{ class: 'Wizard', level: 5, subclass: 'Evoker' }]), 'Wizard 5')?.classes[0].columns;
  if (!(barbarianColumns?.find(x => x.name === 'Rages')?.value === barbarianRow.Rages && barbarianColumns.find(x => x.name === 'Rage Damage')?.value === barbarianRow['Rage Damage'] && wizardColumns?.length === 0))
    fail(`class columns: a Barbarian 5 ${JSON.stringify(barbarianColumns)}; a Wizard 5 ${JSON.stringify(wizardColumns)}`);

  // Starting equipment as chosen: the kit's "Gaming Set (same as above)"
  // the set chosen, a Rogue's Shortsword (its soft hyphen gone) an attack,
  // and a package of gold a kit of nothing but its coin.
  const soldierKit = run(someone([{ class: 'Fighter', level: 1 }]), 'Soldier')?.equipment.kits.find(k => k.from === 'Soldier')?.items ?? [];
  if (!soldierKit.includes('Gaming Set (Dice)') || soldierKit.some(i => /same as above/.test(i))) fail(`the Soldier's kit: ${soldierKit.join(', ')}`);
  if (!hitOf(run(someone([{ class: 'Rogue', level: 1 }]), 'Rogue 1'), 'Shortsword')) fail('a Rogue\'s Shortsword isn\'t among its attacks');
  const gilded = run(someone([{ class: 'Fighter', level: 1 }], { packages: { Fighter: 'C' } }), 'Fighter C');
  const fighterC = srd.classes.find(c => c.name === 'Fighter').traits.find(t => t.trait === 'Starting Equipment').value.match(/\(C\) ([\d,]+) GP/)?.[1];
  if (!(gilded?.equipment.kits[0].items.length === 0 && gilded.packageChoices?.[0].chosen === 'C' && gilded.packageChoices[0].lines.C === `${fighterC} GP`)) fail(`a Fighter's package C: ${JSON.stringify(gilded?.packageChoices?.[0])}`);

  // Hit points rolled, as the SRD says ("Roll that die, add your
  // Constitution modifier to the roll, and add the total (minimum of 1)"),
  // each level's roll asked for; and the weight of a Fighter's kits summed
  // here from the SRD's own tables, against Strength times the Carrying
  // Capacity table's multiple for its size.
  const rolledFighter = run(someone([{ class: 'Fighter', level: 3, subclass: 'Champion' }], { hp: { method: 'Rolled', rolls: { 'Fighter 2': 10, 'Fighter 3': 1 } } }), 'Fighter 3 rolled');
  const con = rolledFighter?.mod.Constitution, d10 = srd.hit_points.level_1.Fighter;
  if (rolledFighter?.hp !== Math.max(1, d10 + con) + Math.max(1, 10 + con) + Math.max(1, 1 + con)) fail(`a Fighter 3's rolled hit points are ${rolledFighter?.hp}`);
  if (!run(someone([{ class: 'Fighter', level: 2 }], { hp: { method: 'Rolled' } }), 'Fighter 2 unrolled')?.problems.some(p => p.field === 'hp:Fighter 2')) fail('a rolled level with no roll isn\'t asked for');
  const lbOf = name => srd.armor.items.find(x => x.name === name)?.weight ?? srd.weapons.find(x => x.name === name)?.weight ?? srd.tools.find(x => x.name === name)?.weight ?? srd.gear.find(x => x.name === name)?.weight;
  const kitWeight = lbOf('Chain Mail') + lbOf('Greatsword') + lbOf('Flail') + 8 * lbOf('Javelin') + lbOf('Dungeoneer’s Pack') + lbOf('Spear') + lbOf('Shortbow') + srd.ammunition.find(x => x.name === 'Arrows').weight + lbOf('Gaming Set') + lbOf('Healer’s Kit') + lbOf('Quiver') + lbOf('Clothes, Traveler’s');
  const laden = run(someone([{ class: 'Fighter', level: 1 }]), 'Fighter 1')?.load;
  const medium = srd.carrying.find(r => r.sizes.includes('Medium'));
  if (!(laden?.items === kitWeight && laden.unweighed.length === 0 && laden.carry === run(someone([{ class: 'Fighter', level: 1 }]), 'Fighter 1').scores.Strength * medium.carry))
    fail(`a Fighter's load: ${JSON.stringify(laden)}, not ${kitWeight} lb. of kit`);
  const weak = run(someone([{ class: 'Fighter', level: 1 }], { base: { ...ABLE, Strength: 3 } }), 'Fighter 1, Strength 3')?.load;
  if (!(laden.over === null && weak?.over === srd.overloaded)) fail(`carrying too much: ${weak?.over} at Strength 3, ${laden?.over} at ${ABLE.Strength}`);

  // What holds in a state or by a choice: Rage's damage noted on Strength
  // attacks, from its column, not added; Agonizing Blast's modifier on the
  // cantrip it improves; Nature's Ward's resistance for the land chosen, from
  // its table; and Advantage on saves by ability (Gnomish Cunning).
  const raging5 = run(someone([{ class: 'Barbarian', level: 5, subclass: 'Path of the Berserker' }]), 'Barbarian 5');
  const rageColumn = srd.classes.find(c => c.name === 'Barbarian').table.rows[4]['Rage Damage'];
  if (!(hitOf(raging5, 'Greataxe')?.riders?.some(r => r.startsWith(`${rageColumn} `)) && !hitOf(raging5, 'Shortbow')?.riders?.length)) fail(`Rage's damage on attacks: ${JSON.stringify(raging5?.attacks.map(a => [a.name, a.riders]))}`);
  const blasting = targets => run(someone([{ class: 'Warlock', level: 5, subclass: 'Fiend Patron' }], { base: { ...ABLE, Charisma: 16 }, spells: { Warlock: ['Eldritch Blast'] }, options: { Warlock: [{ name: 'Agonizing Blast' }] }, cantripTargets: targets }), 'Warlock 5');
  const agonized = blasting({ 'Warlock invocation 0': 'Eldritch Blast' });
  if (hitOf(agonized, 'Eldritch Blast')?.damage !== `1d10 + ${agonized?.mod.Charisma} Force`) fail(`Agonizing Blast: Eldritch Blast deals ${hitOf(agonized, 'Eldritch Blast')?.damage}`);
  const ward = srd.classes.find(c => c.name === 'Druid').subclasses.flatMap(x => x.features).find(f => /^Nature.s Ward$/.test(f.name)).text.split('\n').filter(l => /^\| (?!Land Type|-)/.test(l)).map(l => l.split('|').map(c => c.trim()).slice(1, 3));
  for (const [land, type] of ward) {
    const got = run(someone([{ class: 'Druid', level: 10, subclass: 'Circle of the Land' }], { spellSets: { 'Druid 3 Circle of the Land Spells': `${land} Land` } }), `Druid of ${land}`)?.defenses.resistances;
    if (got?.join() !== type) fail(`Nature's Ward in ${land} land resists ${got?.join(', ')}, not ${type}`);
  }
  const gnome = run({ ...someone([{ class: 'Fighter', level: 1 }]), species: 'Gnome', option: 'Forest Gnome' }, 'Gnome')?.defenses.saveAdvantages ?? null;
  if (gnome?.join() !== 'Intelligence, Wisdom and Charisma') fail(`Gnomish Cunning: ${JSON.stringify(gnome)}`);

  // A Wood Elf's speed, and an unarmored defense, from their sentences.
  const elf = run({ ...someone([{ class: 'Barbarian', level: 1 }]), species: 'Elf', option: 'Wood Elf', skills: { Barbarian: ['Athletics', 'Survival'], 'Elf Keen Senses': ['Insight'] } }, 'Wood Elf');
  if (elf?.speed !== 35) fail(`a Wood Elf's speed is ${elf?.speed}, not the 35 feet its lineage gives`);
  if (!elf || elf.unarmored.find(u => u.from === 'Unarmored Defense')?.ac !== 10 + elf.mod.Dexterity + elf.mod.Constitution) fail('a Barbarian\'s Unarmored Defense isn\'t 10 plus Dexterity and Constitution');

  const log = problems.length
    ? [`\neuphonia builder: ${problems.length} problem(s):`, ...problems.map(m => `  ${m}`)]
    : [`ok: the SRD's ${examples.length} worked examples hold; ${classes} classes and the books’ ${booked} subclasses for the SRD’s, offered first, built to level 20, and ${levels} class levels showing their own tables' bonus and slots; the gear for each level, armour, shields, magic items, the hit points sentences add, origin feats and spell choices held to their rules; the setting's ${backgrounds} backgrounds built${book.unfinished.length ? `, and ${book.unfinished.join(', ')} set aside as still being written` : ''}; ${book.species.length} species placed and ${book.feats.length} feats read`];
  return { ok: problems.length === 0, failures: problems.length, log };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log } = verifyEuphoniaBuilder();
  log.forEach(l => console.log(l));
  process.exit(ok ? 0 : 1);
}
