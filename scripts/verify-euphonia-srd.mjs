// Holds the builder's SRD 5.2.1 export (euphonia.srd.json) to its licence,
// to the site's rules, and to itself: tables whose rows agree with the rules
// they tabulate, and names that resolve where one part points at another.
// The exporter holds every paragraph to the PDF's own text; this gate, which
// runs without the PDF, holds what the builder computes from.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ABILITIES, problems as ruleProblems } from './verify-euphonia.mjs';

const read = name => JSON.parse(readFileSync(new URL(`../src/euphonia/euphonia.${name}.json`, import.meta.url), 'utf8'));
export const srdData = () => read('srd');

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
  for (const [path, s] of strings({ backgrounds: srd.backgrounds, species: srd.species, feats: srd.feats, tables: srd.tables, adapted: srd.adapted })) {
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
  const { standard_array: array = [], point_budget: budget } = srd.ability_scores ?? {};
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

  const log = problems.length
    ? [`\neuphonia srd: ${problems.length} problem(s):`, ...problems.map(m => `  ${m}`)]
    : [`ok: SRD 5.2.1 under its CC-BY attribution, ${srd.adapted.changes.length} change(s) recorded; ${checked} strings clean under the site's rules; ${srd.backgrounds.length} backgrounds, ${srd.species.length} species, ${srd.feats.length} feats resolving; advancement, modifiers, point costs and ${slots.length} rows of multiclass slots agreeing with the rules they tabulate`];
  return { ok: problems.length === 0, failures: problems.length, log };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log } = verifyEuphoniaSrd();
  log.forEach(l => console.log(l));
  process.exit(ok ? 0 : 1);
}
