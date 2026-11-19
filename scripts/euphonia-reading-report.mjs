// What each person in the Reading still needs before their level 3 build is
// complete, as the site's engine sees it: for the book's side of S4.
//   node scripts/euphonia-reading-report.mjs <output folder>
// Writes REPORT-reading-builds.md (to read) and .json (every message, by field).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as engine from '../src/euphonia/euphonia.character.js';
import { blank } from '../src/euphonia/euphonia.build.js';
import { resolveLevel3 } from '../src/euphonia/euphonia.reading.js';

const src = n => JSON.parse(readFileSync(new URL(`../src/euphonia/euphonia.${n}.json`, import.meta.url), 'utf8'));
const book = engine.rulebook(src('srd'), src('classes'), src('characters'), src('subclasses'), src('items').data);
const file = src('reading'), roster = file.data.roster, ABILITIES = engine.ABILITIES;
const array = [...book.standardArray].sort((a, b) => b - a).join();
const spent = base => ABILITIES.reduce((n, a) => n + (book.pointCosts.get(base[a]) ?? Infinity), 0);

// How the scores could have been made: the background's allowed increases taken
// off them, leaving the standard array, a legal Point Cost, or neither.
function scoresFrom(scores, background) {
  if (!background) return { fits: null, why: 'no such background' };
  const allowed = background.ability_scores, shapes = [Object.fromEntries(allowed.map(a => [a, 1]))];
  for (const a of allowed) for (const b of allowed) if (a !== b) shapes.push({ [a]: 2, [b]: 1 });
  const tries = shapes.map(increases => ({ increases, base: Object.fromEntries(ABILITIES.map(a => [a, scores[a] - (increases[a] ?? 0)])) }));
  const standard = tries.find(t => ABILITIES.map(a => t.base[a]).sort((x, y) => y - x).join() === array);
  if (standard) return { fits: 'standard', ...standard };
  const point = tries.find(t => spent(t.base) <= book.pointBudget);
  return point ? { fits: 'point', ...point } : { fits: null, why: `no increase ${background.name} allows (${allowed.join(', ')}) leaves the standard array or a legal Point Cost` };
}
const kindOf = field => field.split(':')[0];
// The builder's own name for each set of picks, and where it lists what it can
// use, so a pick stored under a name it never asks for shows up.
const CHOICES = { skills: 'choices', tools: ['toolChoices', 'toolExpertise'], languages: 'languageChoices', spells: 'spellChoices', expertise: 'expertiseChoices', mastery: 'masteryChoices', styles: 'styleChoices', originFeats: 'originChoices', kinds: 'kindChoices', notes: 'noteChoices', picks: 'pickChoices', forms: 'formChoices', spellSets: 'spellSetChoices', spellAbilities: 'abilityChoices' };
const unusedPicks = (state, built) => Object.entries(CHOICES).flatMap(([slot, list]) => { const known = new Set([list].flat().flatMap(name => built[name] ?? []).map(c => c.key)); return Object.keys(state[slot] ?? {}).filter(k => !known.has(k)).map(k => `${slot}["${k}"]`); });
// The engine lets a caster leave spells unpicked, so a finished build needs
// this checked too.
const spellsShort = built => (built.spellChoices ?? []).flatMap(c => { const cantrips = c.chosen.filter(s => s.level === 0).length, others = c.chosen.length - cantrips, out = []; if (c.mixed ? c.chosen.length < c.prepared : others < c.prepared) out.push(`${c.label}: ${c.mixed ? c.chosen.length : others} of ${c.prepared} spells`); if (cantrips < c.cantrips) out.push(`${c.label}: ${cantrips} of ${c.cantrips} cantrips`); return out; }).concat((built.spellbooks ?? []).filter(b => b.chosen.length < b.free).map(b => `${b.class}'s spellbook: ${b.chosen.length} of ${b.free} spells`));

const people = roster.map(p => {
  const l = p.level3, r = resolveLevel3(p, book, engine.speciesOptions), made = scoresFrom(p.scores, r.background), wanted = [], options = r.species && engine.speciesOptions(r.species);
  if (!r.cls) wanted.push(`the class ${l.class} isn't in the builder`);
  if (l.subclass && !r.subclass) wanted.push(`the subclass "${l.subclass}" isn't in the builder for ${l.class}`);
  if (!r.species) wanted.push(`the species "${l.species}" isn't in the builder`);
  if (options && !r.option) wanted.push(`"${l.species}" doesn't name one of ${r.species.name}'s ${options.label} choices (${options.names.join(', ')})`);
  if (!r.background) wanted.push(`the background "${l.background}" isn't in the builder`);
  if (!made.fits) wanted.push(`scores: ${made.why}`);
  const state = p.build ? { ...blank(), ...p.build } : { ...blank(), name: p.name, species: r.species?.name ?? '', option: r.option ?? '', background: l.background, homeland: p.region, classes: [{ class: l.class, level: 3, subclass: r.subclass ?? '' }],
    ...(made.fits ? { method: made.fits, base: made.base, increases: made.increases } : { method: 'rolled', base: p.scores }) };
  if (p.build) wanted.length = 0;
  let built;
  try { built = engine.character(book, state); } catch (e) { return { id: p.id, name: p.name, class: l.class, subclass: l.subclass, resolved: {}, scores: {}, needsDecision: [`the engine couldn't read this build: ${e.message}`], breaksRule: [], toChoose: [], unusedPicks: [], spellsShort: [] }; }
  const broken = built.problems.filter(x => !x.open), open = built.problems.filter(x => x.open);
  for (const a of ABILITIES) if (built.scores[a] !== p.scores[a]) wanted.push(`${a} builds as ${built.scores[a]}, and the export says ${p.scores[a]}`);
  if (built.load.over) wanted.push(`its kit is ${(built.load.items + built.load.coins).toFixed(1)} lb., over the ${built.load.carry} lb. it can carry`);
  return { id: p.id, name: p.name, class: l.class, subclass: l.subclass, resolved: { subclass: r.subclass, species: r.species?.name ?? null, option: r.option, background: r.background?.name ?? null }, scores: { method: made.fits, base: made.base ?? null, increases: made.increases ?? null },
    needsDecision: wanted, breaksRule: broken.map(x => ({ field: x.field, message: x.message })), toChoose: open.map(x => ({ field: x.field, message: x.message })), unusedPicks: unusedPicks(state, built), spellsShort: spellsShort(built) };
});

const count = xs => { const m = {}; for (const x of xs) m[x] = (m[x] ?? 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]); };
const decide = people.filter(p => p.needsDecision.length || p.breaksRule.length);
const missingSub = count(people.filter(p => p.subclass && !p.resolved.subclass).map(p => `${p.class}: ${p.subclass}`));
const summary = { master: file.provenance.sha256.slice(0, 8), people: people.length, withDecisions: decide.length, subclassesMissing: people.filter(p => p.subclass && !p.resolved.subclass).length, scoresThatDontFit: people.filter(p => !p.scores.method).length, choicesToMake: people.reduce((n, p) => n + p.toChoose.length, 0), complete: people.filter(p => !p.needsDecision.length && !p.breaksRule.length && !p.toChoose.length && !p.unusedPicks.length && !p.spellsShort.length).length, unusedPicks: people.reduce((n, p) => n + p.unusedPicks.length, 0), spellsShort: people.reduce((n, p) => n + p.spellsShort.length, 0) };
const out = process.argv[2];
if (!out) throw new Error('usage: node scripts/euphonia-reading-report.mjs <output folder>');
writeFileSync(join(out, 'REPORT-reading-builds.json'), `${JSON.stringify({ summary, people }, null, 1)}\n`);
writeFileSync(join(out, 'REPORT-reading-builds.md'), `# The Reading's level 3 builds: what each person still needs

From the site's engine, master ${summary.master}. Regenerate with \`node scripts/euphonia-reading-report.mjs <folder>\` on the site's \`reading\` branch. Every message, by the builder's field, is in \`REPORT-reading-builds.json\`.

A complete \`build\` has **no** entries in any column here. "To choose" are picks the source build must supply; the first column needs someone to decide something.

- **People:** ${summary.people}
- **People with something to decide or a rule broken:** ${summary.withDecisions}
- **Subclasses the builder doesn't have:** ${summary.subclassesMissing} people
- **Scores no allowed increase explains:** ${summary.scoresThatDontFit} people
- **Picks to make, across everyone:** ${summary.choicesToMake}
- **Picks stored where the builder doesn't look:** ${summary.unusedPicks}
- **Spell choices left short:** ${summary.spellsShort}
- **Complete builds:** ${summary.complete}

## Subclasses to remap

| Subclass | People |
|---|---|
${missingSub.map(([k, n]) => `| ${k} | ${n} |`).join('\n')}

## Picks to make, by kind

The part of each field before the colon names the builder's choice.

| Choice | Count |
|---|---|
${count(people.flatMap(p => p.toChoose.map(x => kindOf(x.field)))).map(([k, n]) => `| \`${k}\` | ${n} |`).join('\n')}

## To decide

${decide.map(p => `- **${p.name}** (\`${p.id}\`, ${p.class}${p.subclass ? `, ${p.subclass}` : ''}): ${[...p.needsDecision, ...p.breaksRule.map(x => x.message)].join('; ')}`).join('\n') || 'Nothing.'}

## Everyone

| Person | Class | Scores | Picks to make | To decide |
|---|---|---|---|---|
${people.map(p => `| ${p.name} | ${p.class}${p.resolved.subclass ? `, ${p.resolved.subclass}` : ''} | ${p.scores.method ?? 'doesn’t fit'} | ${p.toChoose.length} | ${p.needsDecision.length + p.breaksRule.length} |`).join('\n')}
`);
console.log(JSON.stringify(summary));
