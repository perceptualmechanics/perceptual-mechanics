// Holds the character builder's engine (src/euphonia/euphonia.character.js)
// to the SRD's own worked examples, each quoted from the rules it
// illustrates, and to every class, species and feat it reads: one it can't
// read is a failure here, not a guess on the page.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as defaultEngine from '../src/euphonia/euphonia.character.js';

const read = name => JSON.parse(readFileSync(new URL(`../src/euphonia/euphonia.${name}.json`, import.meta.url), 'utf8'));

// Scores that meet every class's primary ability, so an example tests the
// rule it quotes and nothing else.
const ABLE = { Strength: 15, Dexterity: 14, Constitution: 13, Intelligence: 13, Wisdom: 13, Charisma: 13 };
const POINT_BUY = { Strength: 15, Dexterity: 14, Constitution: 13, Intelligence: 12, Wisdom: 10, Charisma: 8 };
const someone = (classes, extra = {}) => ({
  species: 'Human', size: 'Medium', background: 'Soldier', increases: { Strength: 1, Dexterity: 1, Constitution: 1 },
  method: 'rolled', base: ABLE, classes, originFeats: { 'Human Versatile': 'Alert' }, styles: { 'Fighter 1 Fighting Style': 'Archery' }, ...extra,
});

export function verifyEuphoniaBuilder({ engine = defaultEngine, srd = read('srd'), euphonia = read('classes'), setting = read('characters') } = {}) {
  const problems = [];
  const fail = m => problems.push(m);
  let book;
  try { book = engine.rulebook(srd, euphonia, setting); } catch (e) { return { ok: false, failures: 1, log: [`\neuphonia builder: the rulebook doesn't build: ${e.message}`] }; }
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
      const planted = engine.rulebook(srd, { ...euphonia, withheld: [...euphonia.withheld, { where: `${whole.name} · ${where}`, reasons: ['bracket'] }] }, setting);
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
  // The SRD's armour example: “if you wear Leather Armor, your base AC is 11
  // plus your Dexterity modifier, whereas your AC is 16 in Chain Mail”; a
  // Shield's +2 only with training; Unarmored Defense with a Shield for a
  // Barbarian, not for a Monk; Chain Mail's Strength 13 or 10 feet slower.
  const worn = (cls, armor, shield, base = ABLE) => run(someone([{ class: cls, level: 1 }], { armor, shield, base }), `${cls} in ${armor || 'no armor'}`);
  const leather = worn('Fighter', 'Leather Armor', false), chain = worn('Fighter', 'Chain Mail', false);
  if (leather?.armorClass.ac !== 11 + leather.mod.Dexterity || chain?.armorClass.ac !== 16) fail(`Leather Armor gives ${leather?.armorClass.ac} and Chain Mail ${chain?.armorClass.ac}, not 11 + Dexterity and 16`);
  if (worn('Fighter', 'Chain Mail', true)?.armorClass.ac !== 18 || worn('Wizard', '', true)?.armorClass.ac !== 10 + book.modifier(ABLE.Dexterity + 1)) fail('a Shield adds +2 without training, or not with it');
  const barbarian = worn('Barbarian', '', true), monk = worn('Monk', '', true);
  if (!barbarian?.unarmored.some(u => u.from === 'Unarmored Defense') || monk?.unarmored.some(u => u.from === 'Unarmored Defense')) fail('Unarmored Defense with a Shield: the Barbarian\'s should hold and the Monk\'s shouldn\'t');
  // Medium armour takes Dexterity up to +2: Half Plate at Dexterity 18 is 17.
  const nimble = worn('Fighter', 'Half Plate Armor', false, { ...ABLE, Dexterity: 17 });
  if (nimble?.armorClass.ac !== 17) fail(`Half Plate at Dexterity 18 gives ${nimble?.armorClass.ac}, not 15 + 2`);
  const weak = worn('Fighter', 'Chain Mail', false, { ...ABLE, Strength: 11 });
  if (weak?.speed !== 30 - srd.armor.strength_speed_penalty || chain?.speed !== 30) fail(`Chain Mail at Strength 12 leaves speed ${weak?.speed}, at 16 ${chain?.speed}`);
  if (!worn('Wizard', 'Plate Armor', false)?.warnings.some(w => /can't cast spells/.test(w.message))) fail('a Wizard in Plate Armor isn\'t warned about the training it lacks');
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
    const got = run({ ...someone([{ class: 'Fighter', level: 1 }]), background: b.name, increases: { [a1]: 1, [a2]: 1, [a3]: 1 },
      originFeats: { 'Human Versatile': b.feat === 'Alert' ? 'Skilled' : 'Alert' }, featLists: { [b.name]: 'Wizard' },
      skills: { Fighter: ['Animal Handling', 'Persuasion'].filter(x => !b.skills.includes(x)).concat(['Acrobatics']).slice(0, 2), 'Human Skillful': ['Arcana'], [`${b.name} skills`]: b.skill_choice?.from.slice(0, 1) } }, b.name);
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
  const scholar = pick => run(someone([{ class: 'Wizard', level: 2 }], { skills: { Wizard: ['Arcana', 'History'], 'Human Skillful': ['Athletics'] }, expertise: { 'Wizard 2 Scholar': pick } }), 'Scholar')?.problems.length;
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
    if (!(w12?.problems.some(p => p.field === 'option:Warlock:0' && /isn't open/.test(p.message)) && w12.problems.some(p => /Devouring Blade needs Thirsting Blade/.test(p.message)) && !w12.problems.some(p => /Agonizing Blast/.test(p.message)))) fail('invocations\' prerequisites, or Agonizing Blast\'s repeat, aren\'t held');
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
  // knows its spells, two at level 1, with two cantrips chosen beside the
  // three it always knows. Every Table asks two skills of its four.
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
    if (!(casting?.prepared === 2 && casting.verb === 'known' && casting.cantrips === 2 && casting.given.map(s => s.name).join() === 'Prestidigitation,Mending,Message' && casting.list.some(sp => sp.name === 'Friends'))) fail(`the Courtier's spells read ${JSON.stringify(casting && { known: casting.prepared, verb: casting.verb, cantrips: casting.cantrips, given: casting.given.map(s => s.name) })}`);
    if (!(every?.count === 2 && every.from.join() === 'Deception,Insight,Intimidation,Persuasion')) fail('Every Table doesn\'t ask two of its four skills');
  }
  const fighter = (lv, styles, armor) => run(someone([{ class: 'Fighter', level: lv, subclass: lv >= 3 ? 'Champion' : '' }], { styles, armor, skills: { Fighter: ['Athletics', 'History'], 'Human Skillful': ['Arcana'] }, improvements: Object.fromEntries([4, 6].filter(x => x <= lv).map(x => [`Fighter ${x}`, { feat: 'Ability Score Improvement', increases: { Strength: 1, Constitution: 1 } }])) }), 'Fighting Style');
  const champion = fighter(7, { 'Fighter 1 Fighting Style': 'Archery', 'Fighter 7 Additional Fighting Style': 'Defense' }, 'Chain Mail');
  const same = fighter(7, { 'Fighter 1 Fighting Style': 'Archery', 'Fighter 7 Additional Fighting Style': 'Archery' }, 'Chain Mail');
  const bare = fighter(1, { 'Fighter 1 Fighting Style': 'Defense' }, '');
  if (!(champion?.problems.length === 0 && champion.armorClass.ac === 17 && same?.problems.some(p => /already yours/.test(p.message)) && bare?.armorClass.ac === 10 + bare.mod.Dexterity))
    fail(`Fighting Style: the Champion's second, Defense's +1 in armour and not out of it: ${JSON.stringify([champion?.problems, champion?.armorClass, bare?.armorClass])}`);

  // A Wood Elf's speed, and an unarmored defense, from their sentences.
  const elf = run({ ...someone([{ class: 'Barbarian', level: 1 }]), species: 'Elf', option: 'Wood Elf', skills: { Barbarian: ['Athletics', 'Survival'], 'Elf Keen Senses': ['Insight'] } }, 'Wood Elf');
  if (elf?.speed !== 35) fail(`a Wood Elf's speed is ${elf?.speed}, not the 35 feet its lineage gives`);
  if (!elf || elf.unarmored.find(u => u.from === 'Unarmored Defense')?.ac !== 10 + elf.mod.Dexterity + elf.mod.Constitution) fail('a Barbarian\'s Unarmored Defense isn\'t 10 plus Dexterity and Constitution');

  const log = problems.length
    ? [`\neuphonia builder: ${problems.length} problem(s):`, ...problems.map(m => `  ${m}`)]
    : [`ok: the SRD's ${examples.length} worked examples hold; ${classes} classes built to level 20, and ${levels} class levels showing their own tables' bonus and slots; armour, shields, the hit points sentences add, origin feats and spell choices held to their rules; the setting's ${backgrounds} backgrounds built${book.unfinished.length ? `, and ${book.unfinished.join(', ')} set aside as still being written` : ''}; ${book.species.length} species placed and ${book.feats.length} feats read`];
  return { ok: problems.length === 0, failures: problems.length, log };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log } = verifyEuphoniaBuilder();
  log.forEach(l => console.log(l));
  process.exit(ok ? 0 : 1);
}
