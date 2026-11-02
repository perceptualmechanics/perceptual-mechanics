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
  method: 'rolled', base: ABLE, classes, ...extra,
});

export function verifyEuphoniaBuilder({ engine = defaultEngine, srd = read('srd'), euphonia = read('classes') } = {}) {
  const problems = [];
  const fail = m => problems.push(m);
  let book;
  try { book = engine.rulebook(srd, euphonia); } catch (e) { return { ok: false, failures: 1, log: [`\neuphonia builder: the rulebook doesn't build: ${e.message}`] }; }
  const run = (state, where) => { try { return engine.character(book, state); } catch (e) { fail(`${where}: ${e.message}`); return null; } };
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
    const got = run(state, c.name);
    if (!got) continue;
    // An Epic Boon level can't take the Ability Score Improvement past 20,
    // which point-buy scores never reach here.
    if (got.problems.length) fail(`${c.name} at level 20: ${got.problems.map(p => p.message).join(' ')}`);
    if (got.features.filter(f => f.subclass).length !== c.subclasses[0].features.length) fail(`${c.name}: its subclass's features don't all come through at level 20`);
    if (got.hp !== c.die + 19 * (c.die / 2 + 1) + 20 * book.modifier(POINT_BUY.Constitution + 1)) fail(`${c.name}: ${got.hp} hit points at level 20`);
    classes++;
  }
  // Each class alone, level by level, shows its own table's Proficiency
  // Bonus and spell slots; and through the Multiclass Spellcaster table, at
  // the level its count gives, the same slots, as the SRD's table is built.
  let levels = 0;
  for (const c of book.classes) {
    for (let l = 1; l <= 20; l++) {
      const row = c.table.rows[l - 1];
      const got = run(someone([{ class: c.name, level: l, subclass: c.subclasses[0].name }], { skills: { [c.name]: c.skills.from.slice(0, c.skills.count), 'Human Skillful': ['Arcana'] } }), `${c.name} ${l}`);
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
  // A Wood Elf's speed, and an unarmored defense, from their sentences.
  const elf = run({ ...someone([{ class: 'Barbarian', level: 1 }]), species: 'Elf', option: 'Wood Elf', skills: { Barbarian: ['Athletics', 'Survival'], 'Elf Keen Senses': ['Insight'] } }, 'Wood Elf');
  if (elf?.speed !== 35) fail(`a Wood Elf's speed is ${elf?.speed}, not the 35 feet its lineage gives`);
  if (elf?.unarmored.find(u => u.from === 'Unarmored Defense')?.ac !== 10 + elf.mod.Dexterity + elf.mod.Constitution) fail('a Barbarian\'s Unarmored Defense isn\'t 10 plus Dexterity and Constitution');

  const log = problems.length
    ? [`\neuphonia builder: ${problems.length} problem(s):`, ...problems.map(m => `  ${m}`)]
    : [`ok: the SRD's ${examples.length} worked examples hold; ${classes} classes built to level 20, and ${levels} class levels showing their own tables' bonus and slots; ${book.species.length} species and ${book.feats.length} feats read`];
  return { ok: problems.length === 0, failures: problems.length, log };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log } = verifyEuphoniaBuilder();
  log.forEach(l => console.log(l));
  process.exit(ok ? 0 : 1);
}
