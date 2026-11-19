// Holds the builder's SRD 5.2.1 export (euphonia.srd.json) to its licence,
// to the site's rules, and to itself: tables whose rows agree with the rules
// they tabulate, and names that resolve where one part points at another.
// The exporter holds every paragraph to the PDF's own text; this gate, which
// runs without the PDF, holds what the builder computes from.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { problems as ruleProblems } from './verify-euphonia.mjs';
import { ABILITIES } from '../src/euphonia/euphonia.character.js';

const read = name => JSON.parse(readFileSync(new URL(`../src/euphonia/euphonia.${name}.json`, import.meta.url), 'utf8'));
export const srdData = () => read('srd');
// Where the SRD disagrees with itself: these spells' headings name the class,
// and the class's printed list leaves them off. The list is what's exported.
const SRD_LIST_OMITS = ['Bard: Phantasmal Force', 'Sorcerer: Mind Spike', 'Sorcerer: Phantasmal Force', 'Wizard: Phantasmal Force'];

const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const LEVELS = 20, SPELL_LEVELS = 9;
const number = s => (s === '—' ? 0 : Number(String(s).replace(/[,+]/g, '').replace('−', '-')));
// A score's modifier, the rule the Ability Scores and Modifiers table
// tabulates: half the score's distance from 10, rounded down.
const modifier = score => Math.floor((score - 10) / 2);

function* strings(o, path = '') {
  if (typeof o === 'string') yield [path, o];
  else if (Array.isArray(o)) for (const [i, v] of o.entries()) yield* strings(v, `${path}/${i}`);
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { yield [`${path}/${k}`, k]; yield* strings(v, `${path}/${k}`); }
}
const at = (o, path) => path.split('/').slice(1).reduce((v, k) => v?.[k], o);

export function verifyEuphoniaSrd({ srd = srdData(), rules = read('rules') } = {}) {
  const problems = [];
  const fail = m => problems.push(m);

  // The licence: CC-BY 4.0 asks for the attribution and a note of changes.
  const p = srd.provenance ?? {};
  if (!/System Reference Document 5\.2\.1/.test(p.source ?? '') || !/Creative Commons Attribution 4\.0/.test(p.source ?? '')) fail('provenance: the SRD 5.2.1 CC-BY 4.0 attribution is missing');
  if (!/^[0-9a-f]{64}$/.test(p.sha256 ?? '')) fail('provenance: no SHA-256 of the PDF read');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.fetched ?? '')) fail('provenance: no date fetched');
  if (!Array.isArray(srd.adapted?.changes)) fail('adapted: no record of the changes made to the SRD text');
  for (const c of srd.adapted?.changes ?? []) {
    if (at(srd, c.path) !== c.to) fail(`adapted: ${c.path} doesn't read "${c.to}" as recorded`);
  }

  // The site's rules, over everything shown and the record of what changed.
  let checked = 0;
  // Spells too, now each carries its text; one held back is held back for a
  // word the rules ban.
  // Each spell whole for the sheet: its components, its duration, and its
  // text, or a reason it's held back.
  for (const sp of srd.spells ?? []) if (!sp.components || !sp.duration || (!sp.text && !(srd.spell_text_withheld ?? []).some(w => w.spell === sp.name))) fail(`spells: ${sp.name} lacks its components, duration or text`);
  for (const w of srd.spell_text_withheld ?? []) if (srd.spells.find(x => x.name === w.spell)?.text !== null || !w.names.every(n => rules.banned.includes(n))) fail(`spell_text_withheld: ${w.spell} isn't held back for a banned word`);
  for (const [path, s] of strings({ backgrounds: srd.backgrounds, species: srd.species, feats: srd.feats, classes: srd.classes, tables: srd.tables, spells: srd.spells, adapted: srd.adapted })) {
    checked++;
    const why = ruleProblems(s, rules);
    if (why.length) fail(`${path}: ${why.join(', ')} in "${s.slice(0, 60)}"`);
  }

  const t = srd.tables ?? {};
  // Character Advancement: a row a level, the bonus 2 at level 1 and one more
  // every four levels, the experience rising.
  const adv = t.advancement ?? [];
  if (adv.length !== LEVELS) fail(`advancement: ${adv.length} rows, not ${LEVELS}`);
  adv.forEach((r, i) => {
    if (number(r.Level) !== i + 1) fail(`advancement: row ${i + 1} is level ${r.Level}`);
    if (number(r['Proficiency Bonus']) !== 2 + Math.floor(i / 4)) fail(`advancement: level ${i + 1}'s Proficiency Bonus reads ${r['Proficiency Bonus']}`);
    if (i && !(number(r['Experience Points']) > number(adv[i - 1]['Experience Points']))) fail(`advancement: level ${i + 1}'s experience doesn't rise`);
  });

  // Ability Scores and Modifiers: bands that run without a gap to 20, each
  // score in a band carrying the band's modifier.
  let next = null;
  for (const r of t.ability_modifiers ?? []) {
    const [lo, hi = lo] = String(r.Score).split('–').map(Number);
    if (next !== null && lo !== next) fail(`ability modifiers: the band ${r.Score} doesn't follow on from ${next - 1}`);
    for (let s = lo; s <= hi; s++) if (modifier(s) !== number(r.Modifier)) fail(`ability modifiers: ${s} reads ${r.Modifier}, the rule gives ${modifier(s)}`);
    next = hi + 1;
  }
  if (next !== 21) fail(`ability modifiers: the bands end at ${next - 1}, not 20`);

  // Point Cost: consecutive scores, each costing more, and the standard
  // array costing the whole budget: the two methods are set to be even.
  const costs = t.point_costs ?? [];
  costs.forEach((r, i) => {
    if (i && number(r.Score) !== number(costs[i - 1].Score) + 1) fail(`point costs: ${r.Score} doesn't follow ${costs[i - 1].Score}`);
    if (i && !(number(r.Cost) > number(costs[i - 1].Cost))) fail(`point costs: ${r.Score} doesn't cost more than ${costs[i - 1].Score}`);
  });
  const { standard_array: array = [], point_budget: budget, background: increases } = srd.ability_scores ?? {};
  // The background's increases: each choice adds three, none above 20.
  if (!(increases?.choices?.length === 2 && increases.choices.every(c => c.reduce((n, v) => n + v, 0) === 3) && increases.max === 20)) fail(`ability scores: the background's increases read ${JSON.stringify(increases)}`);
  for (const t of ['level_1', 'fixed']) if (Object.keys(srd.hit_points?.[t] ?? {}).length !== 12) fail(`hit points: ${t} names ${Object.keys(srd.hit_points?.[t] ?? {}).length} classes, not 12`);
  const cost = new Map(costs.map(r => [number(r.Score), number(r.Cost)]));
  if (array.length !== ABILITIES.length || !array.every(s => cost.has(s))) fail(`ability scores: the standard array ${array.join(', ')} isn't six scores the point costs price`);
  else if (array.reduce((n, s) => n + cost.get(s), 0) !== budget) fail(`ability scores: the standard array costs ${array.reduce((n, s) => n + cost.get(s), 0)} points, the budget is ${budget}`);

  // Multiclass spell slots: a row a level, no more slots of a higher spell
  // level than a lower, and none lost as levels rise.
  const slots = t.multiclass_slots ?? [];
  if (slots.length !== LEVELS) fail(`multiclass slots: ${slots.length} rows, not ${LEVELS}`);
  slots.forEach((r, i) => {
    if (number(r.Level) !== i + 1) fail(`multiclass slots: row ${i + 1} is level ${r.Level}`);
    for (let s = 1; s <= SPELL_LEVELS; s++) {
      if (!Number.isInteger(number(r[s]))) fail(`multiclass slots: level ${r.Level}'s ${s} reads "${r[s]}"`);
      if (s > 1 && number(r[s]) > number(r[s - 1])) fail(`multiclass slots: level ${r.Level} has more level-${s} slots than level-${s - 1}`);
      if (i && number(r[s]) < number(slots[i - 1][s])) fail(`multiclass slots: level ${r.Level} has fewer level-${s} slots than level ${i}`);
    }
  });

  // Skills: each once, each under one of the six abilities.
  const skills = new Map((t.skills ?? []).map(r => [r.Skill, r.Ability]));
  if (skills.size !== (t.skills ?? []).length) fail('skills: a skill is listed twice');
  for (const [s, a] of skills) if (!ABILITIES.includes(a)) fail(`skills: ${s} is under "${a}"`);

  // Backgrounds: three abilities, an origin feat that exists, skills that do.
  const feats = new Map((srd.feats ?? []).map(f => [f.name, f]));
  for (const b of srd.backgrounds ?? []) {
    if (b.ability_scores.length !== 3 || !b.ability_scores.every(a => ABILITIES.includes(a))) fail(`${b.name}: ability scores ${b.ability_scores.join(', ')}`);
    const feat = feats.get(b.feat.replace(/ \(.*\)$/, ''));
    if (feat?.category !== 'Origin') fail(`${b.name}: its feat "${b.feat}" isn't an origin feat in the export`);
    for (const s of b.skills) if (!skills.has(s)) fail(`${b.name}: the skill "${s}" isn't in the Skills table`);
  }

  // Species: a type, a size and a speed, and every table a trait names.
  for (const s of srd.species ?? []) {
    if (!s.creature_type) fail(`${s.name}: no creature type`);
    if (!SIZES.some(z => s.size?.startsWith(z)) || !/\)$|\bspecies$/.test(s.size ?? '')) fail(`${s.name}: its size reads "${s.size}"`);
    if (!/^\d+ feet$/.test(s.speed ?? '')) fail(`${s.name}: its speed reads "${s.speed}"`);
    if (!s.traits?.length) fail(`${s.name}: no traits`);
    for (const tr of s.traits ?? []) {
      for (const [, name] of tr.text.matchAll(/the ([A-Z][\w ]+?) table/g)) if (!s.tables?.[name]) fail(`${s.name}, ${tr.name}: names the ${name} table, which isn't exported`);
    }
  }

  // Feats: a known category, a level matching the prerequisite, increases
  // only to abilities.
  for (const f of srd.feats ?? []) {
    if (!['Origin', 'General', 'Fighting Style', 'Epic Boon'].includes(f.category)) fail(`${f.name}: category "${f.category}"`);
    const level = Number(f.prerequisite?.match(/Level (\d+)\+/)?.[1] ?? 1);
    if (f.level !== level) fail(`${f.name}: level ${f.level}, its prerequisite says ${level}`);
    if (f.asi && !(f.asi.from.length && f.asi.from.every(a => ABILITIES.includes(a)) && f.asi.by > 0 && f.asi.max >= 20)) fail(`${f.name}: its ability score increase reads ${JSON.stringify(f.asi)}`);
    if (!f.description && !f.benefits.length) fail(`${f.name}: no text`);
  }

  // Classes: the twelve, each with its traits; a features table of twenty
  // levels whose bonus is the advancement table's; every feature it names
  // described by its level; and its spell slots, where it has them, the
  // Multiclass Spellcaster table's at the level its count gives.
  const classes = srd.classes ?? [];
  if (classes.length !== 12) fail(`classes: ${classes.length}, not the SRD's 12`);
  let slotRows = 0;
  for (const c of classes) {
    const trait = name => c.traits.find(t => t.trait === name)?.value;
    for (const t of ['Primary Ability', 'Hit Point Die', 'Saving Throw Proficiencies', 'Skill Proficiencies', 'Weapon Proficiencies', 'Armor Training', 'Starting Equipment']) if (!trait(t)) fail(`${c.name}: no ${t}`);
    if (!new RegExp(`^D(4|6|8|10|12) per ${c.name} level$`).test(trait('Hit Point Die') ?? '')) fail(`${c.name}: its Hit Point Die reads "${trait('Hit Point Die')}"`);
    const saves = (trait('Saving Throw Proficiencies') ?? '').split(' and ');
    if (saves.length !== 2 || !saves.every(a => ABILITIES.includes(a))) fail(`${c.name}: its saving throws read "${trait('Saving Throw Proficiencies')}"`);
    const rows = c.table?.rows ?? [];
    if (rows.length !== LEVELS) fail(`${c.name}: ${rows.length} rows in its table, not ${LEVELS}`);
    rows.forEach((r, i) => {
      if (number(r.Level) !== i + 1) fail(`${c.name}: table row ${i + 1} is level ${r.Level}`);
      if (r['Proficiency Bonus'] !== adv[i]?.['Proficiency Bonus']) fail(`${c.name}: level ${i + 1}'s Proficiency Bonus is ${r['Proficiency Bonus']}, the advancement table's ${adv[i]?.['Proficiency Bonus']}`);
    });
    // A feature the table names is described at its level or before (an
    // Ability Score Improvement is described once); the table may note its
    // uses in parentheses ("Action Surge (one use)").
    const described = new Map();
    for (const f of c.features) if (!described.has(f.name)) described.set(f.name, f.level);
    for (const r of rows) {
      for (const n of (r['Class Features'] ?? '').split(/,\s*/)) {
        const name = n.replace(/ \(.*\)$/, '');
        if (!name || name === '—' || name === 'Subclass feature' || name === `${c.name} Subclass`) continue;
        if (!(described.get(name) <= number(r.Level))) fail(`${c.name}: its table names ${n} at level ${r.Level}, but no feature describes it by then`);
      }
    }
    if (!c.features.some(f => f.name === `${c.name} Subclass`)) fail(`${c.name}: no feature that grants its subclass`);
    if (c.subclasses?.length !== 1 || !c.subclasses[0].features.length) fail(`${c.name}: its subclass isn't exported whole`);
    // Hit points: the die's highest roll at level 1, then half the die
    // plus one a level, as the SRD's two tables give them for every class;
    // the builder applies the same to the setting's classes.
    const die = number(trait('Hit Point Die')?.match(/^D(\d+)/)?.[1]);
    if (srd.hit_points?.level_1?.[c.name] !== die) fail(`${c.name}: level 1 hit points ${srd.hit_points?.level_1?.[c.name]}, its die's highest roll is ${die}`);
    if (srd.hit_points?.fixed?.[c.name] !== die / 2 + 1) fail(`${c.name}: fixed hit points ${srd.hit_points?.fixed?.[c.name]} a level, half its d${die} plus one is ${die / 2 + 1}`);
    // Multiclassing: the primary ability, and the spell-slot count.
    const mc = c.multiclass ?? {};
    const primary = trait('Primary Ability') ?? '';
    if (!mc.abilities?.length || !mc.abilities.every(a => ABILITIES.includes(a) && primary.includes(a)) || mc.any !== / or /.test(primary) || mc.score !== 13) fail(`${c.name}: its multiclass prerequisite reads ${JSON.stringify([mc.abilities, mc.any, mc.score])} for "${primary}"`);
    if (!/^Hit Point Die\b/.test(mc.gains ?? '')) fail(`${c.name}: multiclassing gains "${mc.gains}"`);
    const levels = c.table.columns.filter(k => /^\d$/.test(k));
    const count = mc.spell_slots;
    if (count && !levels.length) fail(`${c.name}: counts toward multiclass slots, but its table has no slots`);
    if (!count && levels.length) fail(`${c.name}: has spell slots, but doesn't count toward multiclass slots`);
    if (count) {
      const at = level => (count.fraction === 1 ? level : count.round === 'up' ? Math.ceil(level * count.fraction) : Math.floor(level * count.fraction));
      rows.forEach((r, i) => {
        const shared = slots[at(i + 1) - 1];
        for (let s = 1; s <= SPELL_LEVELS; s++) if (number(r[s] ?? '—') !== number(shared?.[s] ?? '—')) fail(`${c.name} ${i + 1}: ${r[s] ?? '—'} level-${s} slots, the Multiclass Spellcaster table gives ${shared?.[s]} at ${at(i + 1)}`);
        slotRows++;
      });
    }
    // Its spells: under the levels it has slots for, each with a school and
    // its C, R or M marks, or a dash for none (False Life's is an en dash in
    // the SRD, kept as it is).
    for (const [level, list] of Object.entries(c.spells ?? {})) {
      if (+level && !levels.includes(level) && !c.table.columns.includes('Slot Level')) fail(`${c.name}: level-${level} spells but no level-${level} slots`);
      for (const sp of list) if (!sp.name || !/^[A-Z][a-z]+$/.test(sp.school) || !/^([—–]|[CRM](, [CRM])*)$/.test(sp.special)) fail(`${c.name}: the spell ${JSON.stringify(sp)}`);
      // The SRD says it twice, in the class's list and in each spell's own
      // heading: a list cut short at a page turn shows here.
      const listed = new Set(list.map(sp => sp.name));
      const headed = (srd.spells ?? []).filter(sp => sp.level === +level && sp.classes.includes(c.name)).map(sp => sp.name);
      for (const name of headed) {
        const omitted = SRD_LIST_OMITS.includes(`${c.name}: ${name}`);
        if (listed.has(name) === omitted) fail(omitted ? `${c.name}: ${name} is on its level ${level} list, where the SRD's leaves it off` : `${c.name}: ${name} names the class in its heading, but isn't on its level ${level} list`);
      }
      for (const name of listed) if (!headed.includes(name)) fail(`${c.name}: ${name} is on its level ${level} list, but its heading doesn't name the class`);
    }
  }

  // The weapons the builder's Weapon Mastery offers: each in a category and a
  // range, with its mastery property. The languages a character starts with,
  // the known one on the Standard table. Each class's options with rules to
  // show, their cost or prerequisite apart.
  const weapons = srd.weapons ?? [];
  if (!weapons.length) fail('no weapons');
  for (const w of weapons) if (!w.name || !['Simple', 'Martial'].includes(w.category) || !['Melee', 'Ranged'].includes(w.range) || !/^[A-Z][a-z]+$/.test(w.mastery)) fail(`the weapon ${JSON.stringify(w)}`);
  // The tools: the Artisan's Tools and the Other Tools, each with its
  // ability, a Gaming Set's and a Musical Instrument's variants each a
  // proficiency of its own. The Beasts a Druid's Wild Shape takes, each with
  // a Challenge Rating and a speed, the forms the class recommends among
  // them at theirs.
  const tools = srd.tools ?? [], ABILITY = /^(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)$/;
  const artisans = tools.filter(t => t.category === 'Artisan’s Tools'), others = tools.filter(t => t.category === 'Other');
  if (artisans.length !== 17 || others.length !== 8) fail(`${artisans.length} Artisan's Tools and ${others.length} others, where the SRD lists 17 and 8`);
  for (const t of tools) if (!ABILITY.test(t.ability) || !t.utilize || /\p{L}-\s|\s-\p{L}/u.test(JSON.stringify(t))) fail(`the tool ${JSON.stringify(t).slice(0, 120)}`);
  const variants = name => tools.find(t => t.name === name)?.variants?.length ?? 0;
  if (variants('Gaming Set') !== 4 || variants('Musical Instrument') !== 10) fail(`the Gaming Set has ${variants('Gaming Set')} variants and the Musical Instrument ${variants('Musical Instrument')}, where the SRD lists 4 and 10`);
  const beasts = srd.beasts ?? [];
  for (const b of beasts) if (!Number.isFinite(b.challenge) || !/^\d+(?:\/\d+)?$/.test(b.cr) || !/^\d+ ft\./.test(b.speed) || b.fly !== /Fly \d/.test(b.speed)) fail(`the Beast ${JSON.stringify(b)}`);
  const recommended = { Rat: '0', 'Riding Horse': '1/4', Spider: '0', Wolf: '1/4' };
  for (const [name, cr] of Object.entries(recommended)) if (beasts.find(b => b.name === name)?.cr !== cr) fail(`Wild Shape's recommended ${name} isn't among the Beasts at CR ${cr}`);
  const tongues = srd.languages;
  if (!tongues?.known?.every(l => tongues.standard.includes(l)) || !tongues.standard.length || !tongues.rare.length) fail(`the languages ${JSON.stringify(tongues)}`);
  const options = classes.flatMap(c => (c.options ?? []).flatMap(o => o.items.map(i => ({ c, i }))));
  for (const { c, i } of options) if (!i.text || /^(Cost|Prerequisite):/.test(i.text)) fail(`${c.name}: the option ${i.name} reads "${i.text.slice(0, 60)}"`);

  const log = problems.length
    ? [`\neuphonia srd: ${problems.length} problem(s):`, ...problems.map(m => `  ${m}`)]
    : [`ok: SRD 5.2.1 under its CC-BY attribution, ${srd.adapted.changes.length} change(s) recorded; ${checked} strings clean under the site's rules; ${srd.backgrounds.length} backgrounds, ${srd.species.length} species, ${srd.feats.length} feats and ${classes.length} classes resolving; ${slotRows} class levels' spell slots the Multiclass Spellcaster table's; advancement, modifiers, point costs and ${slots.length} rows of multiclass slots agreeing with the rules they tabulate; ${weapons.length} weapons with their masteries, ${tools.length} tools, ${beasts.length} Beasts, ${tongues.standard.length + tongues.rare.length} languages and ${options.length} class options read`];
  return { ok: problems.length === 0, failures: problems.length, log };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log } = verifyEuphoniaSrd();
  log.forEach(l => console.log(l));
  process.exit(ok ? 0 : 1);
}
