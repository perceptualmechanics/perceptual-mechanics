// Holds the Reading's logic and, once the book exports it, its data file: the
// file's shape, the book's rule for who is chosen, and a sheet the engine can
// build for every person. Saving is held either way.
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as engine from '../src/euphonia/euphonia.character.js';
import { checkReading, steps, ranked, pages, why, fnv1a, answerKey, usesOf, freshPlay, act, tonight } from '../src/euphonia/euphonia.reading.js';
import { SYMBOLS } from '../src/euphonia/euphonia.reading.symbols.js';
import { openSaves } from '../src/euphonia/euphonia.saves.js';
import { landing } from '../src/euphonia/euphonia.door.js';
import { injectEuphonia } from './euphonia-page.js';

const json = url => JSON.parse(readFileSync(url, 'utf8'));
const src = n => json(new URL(`../src/euphonia/euphonia.${n}.json`, import.meta.url));
const EXPORT = new URL('../src/euphonia/euphonia.reading.json', import.meta.url);
const fakeStore = (start = {}) => { const m = new Map(Object.entries(start)); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k), m }; };

export function verifyEuphoniaReading({ exported = existsSync(EXPORT) ? json(EXPORT) : null } = {}) {
  const problems = [], fail = m => problems.push(m);
  // FNV-1a's published values, so the lot is the book's.
  if (fnv1a('') !== 0x811c9dc5 || fnv1a('a') !== 0xe40c292c || fnv1a('foobar') !== 0xbf9cf968) fail('the lot isn\'t FNV-1a');
  // Saving: an old single character joins the list, play stays out of the
  // build, and a browser that refuses storage still works and says so.
  const store = fakeStore({ 'pm-euphonia-character': 'OLD' }), s = openSaves(store);
  if (s.list()[0]?.code !== 'OLD' || s.current()?.code !== 'OLD' || store.getItem('pm-euphonia-character') !== null) fail('the old saved character isn\'t carried into the list');
  const id = s.put(null, 'B', 'NEW'); s.setPlay(id, { hp: 1 });
  if (s.list().length !== 2 || s.current().id !== id || s.play(id).hp !== 1 || s.list().some(c => 'hp' in c)) fail(`saving: ${JSON.stringify(s.list())}`);
  s.remove(id); if (s.list().length !== 1 || s.play(id) !== null) fail('removing a character leaves it or its play');
  const refused = openSaves({ getItem: () => null, setItem: () => { throw new Error('no'); }, removeItem: () => {} }), mem = refused.put(null, 'C', 'X');
  if (refused.ok || refused.list()[0]?.id !== mem) fail('a browser that refuses storage breaks saving, or goes unmentioned');
  // The front door: only the bare address gets it, and a return goes back.
  const bare = { hash: '', search: '', last: null, hasReading: true };
  for (const [given, want] of [[{}, '#reading'], [{ last: '' }, null], [{ last: '#builder' }, '#builder'], [{ last: '#europe' }, '#europe'], [{ last: '#reading-d2' }, '#reading'], [{ last: '#reading-tonight' }, '#reading-tonight'], [{ hash: '#people' }, null], [{ search: '?c=x' }, null], [{ hasReading: false }, null]]) {
    const got = landing({ ...bare, ...given });
    if (got !== want) fail(`the front door: ${JSON.stringify(given)} opens ${got}, not ${want}`);
  }
  let people = 0;
  if (exported) {
    const page = injectEuphonia(readFileSync(new URL('../euphonia/index.html', import.meta.url), 'utf8'));
    const ways = [...(page.match(/<nav class="r-doors"[\s\S]*?<\/nav>/)?.[0] ?? '').matchAll(/<li><a href="#([\w-]+)">/g)].map(m => m[1]);
    if (ways.join() !== 'games,contents,builder') fail(`the front door's ways in are ${ways.join() || 'missing'}`);
    if (!page.includes('data-page="games"') || !page.includes('data-go="#reading"')) fail('the Reading or the adventures can\'t be reached from the panel');
    // People open each person's level 3 build by its id.
    const linked = [...new Set([...page.matchAll(/\?person=([\w-]+)#builder/g)].map(m => m[1]))];
    if (!linked.length) fail('no person on the People page opens a level 3 build');
    for (const pid of linked) if (!exported.data.roster.some(p => p.id === pid && p.build)) fail(`the People page opens "${pid}", which has no build in the Reading`);
    const d = exported.data, rules = { regions: src('regions').data.map(r => r.name), drawn: Object.keys(SYMBOLS) };
    for (const m of checkReading(d, rules)) fail(`euphonia.reading.json: ${m}`);
    for (const id2 of Object.keys(SYMBOLS)) if (!d.symbols.some(r => r.options.some(o => o.id === id2))) fail(`the symbol "${id2}" is drawn but no round uses it`);
    const broken = fn => { const c = structuredClone(d); fn(c); return checkReading(c, rules).length > 0; };
    for (const [what, fn] of [['an unknown trait', c => { c.roster[0].traits[0] = 'nothing'; }], ['an undrawn symbol', c => { c.symbols[0].options[0].id = 'undrawn'; }], ['an unknown region', c => { c.roster[0].region = 'Atlantis'; }], ['a roster out of order', c => { c.roster.reverse(); }], ['a missing signature', c => { delete c.roster[0].signature; }]])
      if (!broken(fn)) fail(`the file check passes ${what}`);
    // Who the answers lead to: the book's rule, worked by hand for one path.
    const a = { map: { region: d.regions[4] } };
    d.symbols.forEach((r, i) => { a[`s${i + 1}`] = { index: 1, weights: r.options[1].weights }; });
    d.dilemmas.forEach((q, i) => { a[`d${i + 1}`] = { index: 0, said: q.options[0].said, weights: q.options[0].weights }; });
    if (answerKey(d, a) !== `S${'1'.repeat(d.symbols.length)}|D${'0'.repeat(d.dilemmas.length)}|R4`) fail(`the answer string: ${answerKey(d, a)}`);
    const w = {}; for (const x of Object.values(a)) for (const [t, n] of Object.entries(x.weights ?? {})) w[t] = (w[t] ?? 0) + n;
    const N = d.roster.length, lot = fnv1a(answerKey(d, a)) % N, score = p => p.traits.reduce((t, x) => t + (w[x] ?? 0), 0) + (p.region === a.map.region ? d.map.weight : 0);
    const order = ranked(d, a), top = Math.max(...d.roster.map(score));
    const first = Array.from({ length: N }, (_, i) => d.roster[(lot + i) % N]).find(p => score(p) === top);
    if (order[0] !== first) fail(`the first person shown is ${order[0].name}, and the rule gives ${first.name}`);
    const dealt = pages(order);
    if (dealt.flat().length !== N || new Set(dealt.flat()).size !== N || dealt[0][0] !== order[0]) fail('paging loses or repeats someone, or moves the best fit');
    if (dealt[0].length !== 3 || new Set(dealt[0].map(p => p.class)).size !== 3) fail(`the first reveal isn't three classes: ${dealt[0].map(p => p.class)}`);
    const twoClasses = [{ class: 'A' }, { class: 'A' }, { class: 'A' }, { class: 'B' }, { class: 'C' }, { class: 'A' }];
    if (pages(twoClasses)[0].map(p => p.class).join() !== 'A,B,C' || pages(twoClasses)[1].length !== 3) fail('a reveal doesn\'t reach past a repeated class, or the rest don\'t fill up');
    const fit = order.find(p => p.traits.some(t => t in a.d1.weights));
    if (!why(d, fit, a).includes(a.d1.said)) fail(`why ${fit.name} doesn't use the player's answer`);
    if (steps(d).length !== 1 + d.symbols.length + d.dilemmas.length + 3) fail(`the steps: ${steps(d)}`);
    // Every person has a sheet to play from tonight.
    const book = engine.rulebook(src('srd'), src('classes'), src('characters'), src('subclasses'), src('items').data);
    for (const p of d.roster ?? []) {
      people++;
      const built = engine.character(book, p.build), n = tonight(built), uses = usesOf(p.signature, built);
      for (const x of built.problems) fail(`${p.name}: its build: ${x.message}`);
      if (!(n.hp > 0 && n.ac > 0 && n.attack) || (uses !== null && !(uses > 0))) fail(`${p.name}: the tracker has nothing to show: ${JSON.stringify({ hp: n.hp, ac: n.ac, uses })}`);
    }
    // A night's play stays in range, and each rest gives back only its own.
    const ctx = { maxHp: 2, uses: 2, signature: { per: 'long rest', back: 'one on a Short Rest' } }; let play = freshPlay(2, 2);
    for (const x of ['hurt', 'hurt', 'hurt', 'signature', 'signature', 'signature']) play = act(play, ctx, x);
    if (play.hp !== 0 || play.uses !== 0) fail(`spending went out of range: ${JSON.stringify(play)}`);
    if (act(play, ctx, 'short').uses !== 1 || act(play, { ...ctx, signature: { per: 'long rest' } }, 'short').uses !== 0 || act(play, { ...ctx, signature: { per: 'short rest' } }, 'short').uses !== 2 || act(play, ctx, 'long').hp !== 2) fail('a rest gave back the wrong amount');
  }
  return { ok: !problems.length, failures: problems.length, log: problems.length ? [`\neuphonia reading: ${problems.length} problem(s):`, ...problems.slice(0, 20).map(x => `  ${x}`)] : [`ok: the Reading ${exported ? `chooses by the book's rule and has a sheet for all ${people} people from their full builds` : 'has no export yet, so its tab stays hidden'}; saving keeps builds and play apart`] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { const r = verifyEuphoniaReading(); r.log.forEach(l => console.log(l)); process.exit(r.ok ? 0 : 1); }
