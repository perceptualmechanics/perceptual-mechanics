// The Reading's logic, apart from any page: what euphonia.reading.json must
// hold, who the answers lead to, and what a night's play does to a sheet.
export const AXES = ['approach', 'pace', 'values', 'ties'];
export const ABILITY_ORDER = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];

// Every step of the reading, in order, as the address names them.
export const steps = d => ['start', ...d.symbols.map((_, i) => `s${i + 1}`), ...d.dilemmas.map((_, i) => `d${i + 1}`), 'map', 'reveal', 'tonight'];

// What's wrong with the file, as sentences; none means the screens can use it.
export function checkReading(d, { regions = [], drawn = [] } = {}) {
  const out = [], need = (ok, m) => { if (!ok) out.push(m); };
  const traits = d.traits ?? {};
  const weighs = (w, where) => { need(w && Object.keys(w).length, `${where} leans toward nothing`); for (const t of Object.keys(w ?? {})) need(traits[t], `${where} names the unknown trait "${t}"`); };
  for (const [id, t] of Object.entries(traits)) { need(AXES.includes(t.axis), `trait ${id}: no axis`); need(t.name && t.description, `trait ${id}: needs a name and a description`); }
  for (const key of ['begin', 'skip', 'restore']) need(d.frame?.[key], `frame: no "${key}" label`);
  for (const key of ['intro', 'plain']) need(d.frame?.[key]?.title && d.frame[key].text, `frame: "${key}" needs a title and text`);
  need(d.symbols?.length, 'no symbol rounds'); need(d.dilemmas?.length, 'no dilemmas'); need(d.roster?.length >= 3, 'fewer than three people');
  (d.symbols ?? []).forEach((r, i) => {
    need(r.prompt && r.plain_prompt, `symbol round ${i + 1}: needs both prompts`); need(r.options?.length >= 2, `symbol round ${i + 1}: too few symbols`);
    for (const o of r.options ?? []) { need(o.id && o.name && o.description, `symbol round ${i + 1}: every symbol needs an id, a name and a description`); need(drawn.includes(o.id), `symbol "${o.id}" has no drawing`); weighs(o.weights, `symbol "${o.id}"`); }
  });
  (d.dilemmas ?? []).forEach((q, i) => {
    need(q.scene && q.options?.length === 2, `dilemma ${i + 1}: needs a scene and two answers`);
    for (const o of q.options ?? []) { need(o.label && o.said, `dilemma ${i + 1}: every answer needs a label and what it said`); weighs(o.weights, `dilemma ${i + 1}`); }
  });
  need(d.map?.prompt && d.map.plain_prompt && d.map.weight > 0, 'map: needs both prompts and a weight');
  const ids = new Set();
  for (const p of d.roster ?? []) {
    const who = p.name ?? p.id; need(p.id && !ids.has(p.id), `${who}: needs an id of its own`); ids.add(p.id);
    for (const k of ['name', 'region', 'class', 'line', 'scene', 'play', 'class_note', 'sheet']) need(p[k], `${who}: no ${k}`);
    if (regions.length) need(regions.includes(p.region), `${who}: "${p.region}" isn't a region`);
    need(p.traits?.length, `${who}: no traits`); for (const t of p.traits ?? []) need(traits[t], `${who}: unknown trait "${t}"`);
    need(p.build?.classes?.[0]?.level === (d.level ?? 3), `${who}: its build isn't level ${d.level ?? 3}`);
    need(p.signature?.name && p.signature.line && p.signature.uses > 0 && ['short', 'long'].includes(p.signature.per), `${who}: its signature needs a name, a line, uses and a rest`);
  }
  for (const key of ['attack', 'signature', 'help', 'try']) need(d.teach?.[key], `teach: no line for "${key}"`);
  for (const a of ABILITY_ORDER) need(d.tries?.[a], `tries: no words for ${a}`);
  return out;
}

export function tally(answers) {
  const w = {};
  for (const a of Object.values(answers)) for (const [t, n] of Object.entries(a.weights ?? {})) w[t] = (w[t] ?? 0) + n;
  return w;
}
// Everyone, best fit first: their traits' weight, and the map's for the region
// chosen; a tie goes by name, so a set of answers always reads the same.
export function ranked(d, answers) {
  const w = tally(answers), region = answers.map?.region;
  return d.roster.map(p => ({ p, n: p.traits.reduce((s, t) => s + (w[t] ?? 0), 0) + (p.region === region ? d.map.weight : 0) }))
    .sort((a, b) => b.n - a.n || a.p.name.localeCompare(b.p.name)).map(x => x.p);
}
// The order dealt into pages of `size`, each page's people of different
// classes where the roster allows, so a player sees range.
export function pages(order, size = 3) {
  const left = [...order], out = [];
  while (left.length) {
    const page = [];
    for (let i = 0; i < left.length && page.length < size;) { if (page.some(p => p.class === left[i].class)) i++; else page.push(...left.splice(i, 1)); }
    while (page.length < size && left.length) page.push(left.shift());
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

// What a night does: Hit Points inside their range, a use spent only if one's
// left, and each rest giving back what it gives back.
export const freshPlay = (p, hp) => ({ hp, uses: p.signature.uses });
export function act(play, p, maxHp, what) {
  if (what === 'hurt') return { ...play, hp: Math.max(0, play.hp - 1) };
  if (what === 'heal') return { ...play, hp: Math.min(maxHp, play.hp + 1) };
  if (what === 'signature') return play.uses > 0 ? { ...play, uses: play.uses - 1 } : play;
  if (what === 'short') return p.signature.per === 'short' ? { ...play, uses: p.signature.uses } : play;
  if (what === 'long') return freshPlay(p, maxHp);
  throw new Error(`no such action: ${what}`);
}
// The sheet's numbers the tracker shows, from what the engine built.
export function tonight(r) {
  const attack = r.attacks.find(a => !a.save && a.kind !== 'unarmed') ?? r.attacks[0];
  const tries = ABILITY_ORDER.map(a => ({ ability: a, bonus: r.mod[a] })).sort((a, b) => b.bonus - a.bonus).slice(0, 2);
  return { hp: r.hp, ac: r.armorClass.ac, speed: r.speed, initiative: r.initiative, attack, tries, mods: r.mod };
}
