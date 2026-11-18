// Holds the Reading's logic and its data file. It always tests the logic on a
// sample with placeholder words (euphonia-reading.sample.json); once the book
// exports euphonia.reading.json, it holds that file too, and every person in
// it must build in the site's engine with nothing left to choose.
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as engine from '../src/euphonia/euphonia.character.js';
import { checkReading, steps, ranked, pages, why, freshPlay, act, tonight } from '../src/euphonia/euphonia.reading.js';
import { SYMBOLS } from '../src/euphonia/euphonia.reading.symbols.js';
import { openSaves } from '../src/euphonia/euphonia.saves.js';

const json = url => JSON.parse(readFileSync(url, 'utf8'));
const src = n => json(new URL(`../src/euphonia/euphonia.${n}.json`, import.meta.url));
const SAMPLE = new URL('./euphonia-reading.sample.json', import.meta.url), EXPORT = new URL('../src/euphonia/euphonia.reading.json', import.meta.url);
const fakeStore = (start = {}) => { const m = new Map(Object.entries(start)); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k), m }; };

export function verifyEuphoniaReading({ exported = existsSync(EXPORT) ? json(EXPORT) : null } = {}) {
  const problems = [], fail = m => problems.push(m);
  const d = json(SAMPLE).data, regions = src('regions').data.map(r => r.name), rules = { regions, drawn: Object.keys(SYMBOLS) };
  const book = engine.rulebook(src('srd'), src('classes'), src('characters'), src('subclasses'), src('items').data);
  for (const m of checkReading(d, rules)) fail(`the sample: ${m}`);
  // The file check catches what would break a screen.
  const broken = fn => { const c = structuredClone(d); fn(c); return checkReading(c, rules).length > 0; };
  for (const [what, fn] of [['an unknown trait', c => { c.roster[0].traits.push('nothing'); }], ['an undrawn symbol', c => { c.symbols[0].options[0].id = 'undrawn'; }], ['an unknown region', c => { c.roster[0].region = 'Atlantis'; }], ['a build at the wrong level', c => { c.roster[0].build.classes[0].level = 9; }], ['a missing signature', c => { delete c.roster[0].signature; }]])
    if (!broken(fn)) fail(`the file check passes ${what}`);
  // Who the answers lead to: the same answers the same people, the map's
  // region counted, three classes to a page, and everyone reachable by paging.
  const answers = { d1: { said: 'you went after the drowning stranger', weights: d.dilemmas[0].options[0].weights }, map: { region: d.roster[3].region } };
  const order = ranked(d, answers), all = pages(order);
  if (JSON.stringify(order.map(p => p.id)) !== JSON.stringify(ranked(d, structuredClone(answers)).map(p => p.id))) fail('the same answers rank differently');
  if (order[0].region !== answers.map.region && order[0].traits.every(t => !(t in answers.d1.weights))) fail('the map and the dilemma moved no one to the top');
  if (new Set(all[0].map(p => p.class)).size !== 3) fail(`the first three aren't three classes: ${all[0].map(p => p.class)}`);
  if (all.flat().length !== d.roster.length || new Set(all.flat().map(p => p.id)).size !== d.roster.length) fail('paging loses or repeats someone');
  const person = order.find(p => p.traits.some(t => t in answers.d1.weights));
  if (person && !why(d, person, answers).includes('you went after the drowning stranger')) fail(`why ${person.name} doesn't use the player's answer`);
  if (steps(d).length !== 1 + d.symbols.length + d.dilemmas.length + 3) fail(`the steps: ${steps(d)}`);
  // A night's play stays in range, and each rest gives back only its own.
  const p = { ...d.roster[0], signature: { ...d.roster[0].signature, uses: 1, per: 'long' } };
  let play = freshPlay(p, 2);
  play = act(act(act(play, p, 2, 'hurt'), p, 2, 'hurt'), p, 2, 'hurt');
  if (play.hp !== 0) fail(`Hit Points fell to ${play.hp}`);
  play = act(act(act(act(play, p, 2, 'heal'), p, 2, 'heal'), p, 2, 'heal'), p, 2, 'signature');
  if (play.hp !== 2 || play.uses !== 0 || act(play, p, 2, 'signature').uses !== 0) fail(`healing or spending went out of range: ${JSON.stringify(play)}`);
  if (act(play, p, 2, 'short').uses !== 0 || act(play, p, 2, 'long').uses !== 1) fail('a rest gave back the wrong uses');
  // Saving: an old single character joins the list, play stays out of the
  // build, and a browser that refuses storage still works and says so.
  const store = fakeStore({ 'pm-euphonia-character': 'OLD' }), s = openSaves(store);
  if (s.list()[0]?.code !== 'OLD' || s.current()?.code !== 'OLD' || store.getItem('pm-euphonia-character') !== null) fail('the old saved character isn\'t carried into the list');
  const id = s.put(null, 'B', 'NEW'); s.setPlay(id, { hp: 1 });
  if (s.list().length !== 2 || s.current().id !== id || s.play(id).hp !== 1 || s.list().some(c => 'hp' in c)) fail(`saving: ${JSON.stringify(s.list())}`);
  s.remove(id); if (s.list().length !== 1 || s.play(id) !== null) fail('removing a character leaves it or its play');
  const refused = openSaves({ getItem: () => null, setItem: () => { throw new Error('no'); }, removeItem: () => {} }), mem = refused.put(null, 'C', 'X');
  if (refused.ok || refused.list()[0]?.id !== mem) fail('a browser that refuses storage breaks saving, or goes unmentioned');
  // The numbers the tracker shows come from the engine.
  for (const q of d.roster) { const n = tonight(engine.character(book, q.build)); if (!(n.hp > 0 && n.ac > 0 && n.attack && n.tries.length === 2)) fail(`${q.name}: the tracker has nothing to show: ${JSON.stringify(n).slice(0, 120)}`); }
  let people = 0;
  if (exported) {
    for (const m of checkReading(exported.data, rules)) fail(`euphonia.reading.json: ${m}`);
    if (exported.provenance?.sample) fail('euphonia.reading.json is the sample');
    for (const q of exported.data.roster ?? []) { people++; for (const x of engine.character(book, q.build).problems) fail(`${q.name}: its build: ${x.message}`); }
  }
  return { ok: !problems.length, failures: problems.length, log: problems.length ? [`\neuphonia reading: ${problems.length} problem(s):`, ...problems.map(x => `  ${x}`)] : [`ok: the Reading's logic holds on the sample (${d.roster.length} people, ${d.symbols.length} symbol rounds, ${d.dilemmas.length} dilemmas); ${exported ? `its export builds all ${people} people` : 'no export yet, so its tab stays hidden'}; saving keeps builds and play apart`] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { const r = verifyEuphoniaReading(); r.log.forEach(l => console.log(l)); process.exit(r.ok ? 0 : 1); }
