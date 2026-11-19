// The Reading's logic, apart from any page: what euphonia.reading.json must
// hold, who the answers lead to (by the rule the book's fairness check uses),
// and what a night's play does to a sheet.
export const AXES = ['way', 'heart'];
export const ABILITY_ORDER = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
const PER = ['long rest', 'short rest', 'turn', 'at will'];
const SHOWN = 3;

// Every step of the reading, in order, as the address names them.
export const steps = d => ['start', ...d.symbols.map((_, i) => `s${i + 1}`), ...d.dilemmas.map((_, i) => `d${i + 1}`), 'map', 'reveal', 'tonight'];

// What's wrong with the file, as sentences; none means the screens can use it.
export function checkReading(d, { regions = [], drawn = [] } = {}) {
  const out = [], need = (ok, m) => { if (!ok) out.push(m); };
  const traits = d.traits ?? {};
  const weighs = (w, where) => { need(w && Object.keys(w).length, `${where} leans toward nothing`); for (const t of Object.keys(w ?? {})) need(traits[t], `${where} names the unknown trait "${t}"`); };
  for (const [id, t] of Object.entries(traits)) { need(AXES.includes(t.axis), `trait ${id}: no axis`); need(t.name && t.description, `trait ${id}: needs a name and a description`); }
  for (const key of ['skip', 'restore', 'resume', 'plain_resume']) need(d.frame?.[key], `frame: no "${key}" label`);
  for (const key of ['play', 'explore', 'know']) need(d.frame?.doors?.[key], `frame: no name for the "${key}" door`);
  for (const key of ['intro', 'plain']) need(d.frame?.[key]?.title && d.frame[key].text && d.frame[key].begin, `frame: "${key}" needs a title, text and a way to begin`);
  for (const key of ['title', 'more', 'plain_title', 'plain_more']) need(d.reveal?.[key], `reveal: no "${key}"`);
  need(d.symbols?.length, 'no symbol rounds'); need(d.dilemmas?.length, 'no dilemmas'); need(d.roster?.length >= SHOWN, 'too few people');
  (d.symbols ?? []).forEach((r, i) => {
    need(r.prompt && r.plain_prompt, `symbol round ${i + 1}: needs both prompts`); need(r.options?.length >= 2, `symbol round ${i + 1}: too few symbols`);
    for (const o of r.options ?? []) { need(o.id && o.name && o.description, `symbol round ${i + 1}: every symbol needs an id, a name and a description`); need(drawn.includes(o.id), `symbol "${o.id}" has no drawing`); weighs(o.weights, `symbol "${o.id}"`); }
  });
  (d.dilemmas ?? []).forEach((q, i) => {
    need(q.title && q.scene && q.options?.length === 2, `dilemma ${i + 1}: needs a title, a scene and two answers`);
    for (const o of q.options ?? []) { need(o.label && o.said, `dilemma ${i + 1}: every answer needs a label and what it said`); weighs(o.weights, `dilemma ${i + 1}`); }
  });
  need(d.map?.prompt && d.map.plain_prompt && d.map.weight > 0, 'map: needs both prompts and a weight');
  need(d.regions?.length, 'no regions'); for (const r of regions) need(d.regions?.includes(r), `the regions list lacks ${r}`);
  const ids = new Set(), names = (d.roster ?? []).map(p => p.name);
  need(names.every((n, i) => !i || cmpPoints(names[i - 1], n) <= 0), 'the roster isn’t in name order, which the lot counts along');
  for (const p of d.roster ?? []) {
    const who = p.name ?? p.id; need(p.id && !ids.has(p.id), `${who}: needs an id of its own`); ids.add(p.id);
    for (const k of ['name', 'region', 'class', 'line', 'scene', 'play', 'class_note', 'sheet']) need(p[k], `${who}: no ${k}`);
    need(d.regions?.includes(p.region), `${who}: "${p.region}" isn't a region`);
    need(p.traits?.length === 4, `${who}: needs four traits`); for (const t of p.traits ?? []) need(traits[t], `${who}: unknown trait "${t}"`);
    need(p.build || (p.level3?.class && p.scores), `${who}: no build, and nothing to try one from`);
    const s = p.signature ?? {}; need(s.name && s.line && PER.includes(s.per), `${who}: its signature needs a name, a line and a rest`);
    need(s.uses === null || Number.isInteger(s.uses) || s.uses === 'Proficiency Bonus' || /^\w+ modifier$/.test(s.uses ?? ''), `${who}: can't read its uses "${s.uses}"`);
  }
  for (const key of ['attack', 'signature', 'help', 'help_short', 'try', 'short', 'long']) need(d.teach?.[key], `teach: no line for "${key}"`);
  for (const a of ABILITY_ORDER) need(d.tries?.[a], `tries: no words for ${a}`);
  return out;
}
// Python's default string order, which the export sorts the roster by: by code
// point, where JavaScript's own comparison goes by UTF-16 unit.
function cmpPoints(a, b) {
  const x = [...a], y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i].codePointAt(0) - y[i].codePointAt(0);
  return x.length - y.length;
}

export function fnv1a(text) {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) h = Math.imul(h ^ byte, 0x01000193) >>> 0;
  return h;
}
// The answers as the book's rule writes them: S<symbols>|D<answers>|R<region>.
export const answerKey = (d, a) => `S${d.symbols.map((_, i) => a[`s${i + 1}`].index).join('')}|D${d.dilemmas.map((_, i) => a[`d${i + 1}`].index).join('')}|R${d.regions.indexOf(a.map.region)}`;
export function tally(answers) {
  const w = {};
  for (const a of Object.values(answers)) for (const [t, n] of Object.entries(a.weights ?? {})) w[t] = (w[t] ?? 0) + n;
  return w;
}
// Everyone, best fit first, as How the Reading Chooses says: their four traits'
// totals and the map's weight for their region; ties by the lot, counting along
// the roster from the place the answers hash to.
export function ranked(d, answers) {
  const w = tally(answers), N = d.roster.length, lot = fnv1a(answerKey(d, answers)) % N;
  return d.roster.map((p, i) => ({ p, n: p.traits.reduce((s, t) => s + (w[t] ?? 0), 0) + (p.region === answers.map.region ? d.map.weight : 0), at: (i - lot + N) % N }))
    .sort((a, b) => b.n - a.n || a.at - b.at).map(x => x.p);
}
// The order dealt into reveals: each takes the best fits left whose classes it
// doesn't have yet (Scott, 18 November), and only when too few classes remain
// fills up with the next in order.
export function pages(order, size = SHOWN) {
  const left = [...order], out = [];
  while (left.length) {
    const page = [];
    for (let i = 0; i < left.length && page.length < size;) { if (page.some(p => p.class === left[i].class)) i++; else page.push(...left.splice(i, 1)); }
    page.push(...left.splice(0, size - page.length));
    out.push(page);
  }
  return out;
}
// Why the reading chose someone, in the player's own answers.
export function why(d, p, answers, most = 3) {
  const said = d.dilemmas.map((_, i) => answers[`d${i + 1}`]).filter(a => a && Object.keys(a.weights).some(t => p.traits.includes(t))).map(a => a.said);
  if (answers.map?.region === p.region) said.push(`your road starts in ${p.region}`);
  return said.slice(0, most);
}

// What a person's level 3 names, found among what the builder offers: the
// subclass by its whole words ("Lore" is the College of Lore), the species by
// its leading name, and its lineage or ancestry by the words in brackets.
const wholeWords = (name, words) => new RegExp(`(?:^|\\s)${words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`, 'i').test(name);
export function resolveLevel3({ level3: l }, book, speciesOptions) {
  const cls = book.classNamed(l.class), species = book.species.find(s => l.species.startsWith(s.name)) ?? null;
  const option = species && speciesOptions(species)?.names.find(n => wholeWords(l.species.replace(/[();]/g, ' ').replace(/\s+/g, ' '), n.split(/ [(’]/)[0]) || new RegExp(`\\b${n.split(' ')[0]}\\b`, 'i').test(l.species.slice(species.name.length)));
  return { cls, subclass: cls?.subclasses.find(s => s.name === l.subclass || wholeWords(s.name, l.subclass))?.name ?? null, species, option: option ?? null, background: book.backgrounds.find(b => b.name === l.background) ?? null };
}
// A character the engine can build from what the export has so far, with its
// scores as they stand. The roster's full builds replace this.
export function trialBuild(p, book, blank, speciesOptions) {
  if (p.build) return p.build;
  const r = resolveLevel3(p, book, speciesOptions);
  return { ...blank, name: p.name, species: r.species?.name ?? '', option: r.option ?? '', size: 'Medium', background: p.level3.background, homeland: p.region, method: 'rolled', base: p.scores, classes: [{ class: p.level3.class, level: 3, subclass: r.subclass ?? '' }] };
}
// How many uses the signature has, which may hang on the character's numbers;
// null where it isn't counted out over rests.
export function usesOf(sig, r) {
  if (!['long rest', 'short rest'].includes(sig.per) || sig.uses === null) return null;
  if (sig.uses === 'Proficiency Bonus') return r.bonus;
  return typeof sig.uses === 'string' ? Math.max(1, r.mod[sig.uses.replace(' modifier', '')]) : sig.uses;
}
// What a night does: Hit Points inside their range, a use spent only if one's
// left, and each rest giving back what the signature says it does.
export const freshPlay = (hp, uses) => ({ hp, uses });
export function act(play, { maxHp, uses, signature: s }, what) {
  if (what === 'hurt') return { ...play, hp: Math.max(0, play.hp - 1) };
  if (what === 'heal') return { ...play, hp: Math.min(maxHp, play.hp + 1) };
  if (what === 'signature') return uses !== null && play.uses > 0 ? { ...play, uses: play.uses - 1 } : play;
  if (what === 'long') return freshPlay(maxHp, uses);
  if (what === 'short') return uses === null ? play : { ...play, uses: s.per === 'short rest' ? uses : s.back ? Math.min(uses, play.uses + 1) : play.uses };
  throw new Error(`no such action: ${what}`);
}
// The sheet's numbers the tracker shows, from what the engine built.
export function tonight(r) {
  // Their own attack first (the Arc Gun, a Planar Strike), then their best.
  const attack = r.attacks.filter(a => !a.save && a.kind !== 'unarmed').sort((a, b) => (b.kind === 'feature') - (a.kind === 'feature') || b.bonus - a.bonus)[0] ?? r.attacks[0];
  const tries = ABILITY_ORDER.map(a => ({ ability: a, bonus: r.mod[a] })).sort((a, b) => b.bonus - a.bonus).slice(0, 2);
  return { hp: r.hp, ac: r.armorClass.ac, speed: r.speed, initiative: r.initiative, attack, tries, mods: r.mod };
}
