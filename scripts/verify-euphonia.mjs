import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { plain, blocks } from '../src/euphonia/euphonia.markdown.js';
import { ABILITIES } from '../src/euphonia/euphonia.character.js';
import { wheelOf } from '../src/euphonia/euphonia.wheel.js';

const ROOT = new URL('../', import.meta.url);
const read = rel => readFileSync(new URL(rel, ROOT), 'utf8');
const FILES = ['classes', 'subclasses', 'items', 'people', 'sheets', 'regions', 'adventures', 'legal', 'hidden', 'characters', 'wheel', 'welcome', 'languages'];

// What may never reach a Euphonia page, besides draft brackets and braced names
// awaiting replacement: other people's names, and "Fey" outside the creature
// type. The one copy is euphonia.rules.json. The exporter (class-kit/site_export.py)
// reads it from this folder and records it in each file's provenance; this gate
// refuses an export made under rules the file no longer holds.
export function euphoniaFiles() {
  const d = Object.fromEntries(FILES.map(f => [f, JSON.parse(read(`src/euphonia/euphonia.${f}.json`))]));
  d.rules = JSON.parse(read('src/euphonia/euphonia.rules.json'));
  return d;
}

export function euphoniaData() {
  const d = euphoniaFiles();
  // The master is on Scott's machine and nowhere else, the deploy included.
  const path = d.classes.provenance?.master?.replace(/^~(?=\/)/, homedir());
  d.master = path && existsSync(path) ? { path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') } : null;
  return d;
}

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function problems(text, rules) {
  const out = [];
  if (/[[\]]/.test(text)) out.push('a bracket');
  if (/[{}]/.test(text)) out.push('a brace');
  rules.banned.forEach((w, i) => { if (new RegExp(`(?<!\\w)${escape(w)}(?!\\w)`, 'i').test(text)) out.push(`banned word ${i + 1}`); });
  if (/\bfey\b/i.test(text.replace(new RegExp(rules.fey_type, 'g'), ''))) out.push('the creature type used as prose');
  return out;
}

// Key order is the exporter's business; what the rules say is the gate's.
const canonical = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v);

function* strings(o) {
  if (typeof o === 'string') yield o;
  else if (Array.isArray(o)) for (const v of o) yield* strings(v);
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { yield k; yield* strings(v); }
}

export function verifyEuphonia(d = euphoniaData()) {
  const log = [];
  const warnings = [];
  const problemsFound = [];
  const fail = m => problemsFound.push(m);

  // One export, from one master, under these rules.
  const prov = FILES.map(f => d[f]?.provenance);
  FILES.forEach((f, i) => {
    const p = prov[i];
    if (!/^[0-9a-f]{64}$/.test(p?.sha256 ?? '')) fail(`euphonia.${f}.json: no SHA-256 of the master in its provenance`);
    if (typeof p?.master !== 'string' || !p.master.endsWith('/Euphonia.md')) fail(`euphonia.${f}.json: provenance doesn't say where the master was read`);
    if (p?.exporter !== 'class-kit/site_export.py' || !Number.isInteger(p?.exporter_version)) fail(`euphonia.${f}.json: provenance doesn't name the exporter and its version`);
    if (p?.sha256 !== prov[0]?.sha256 || p?.exporter_version !== prov[0]?.exporter_version) fail(`euphonia.${f}.json: from a different export than euphonia.classes.json; refresh them all together`);
    if (canonical(p?.rules) !== canonical(d.rules)) fail(`euphonia.${f}.json: exported under different rules than euphonia.rules.json holds; run npm run euphonia:refresh`);
  });
  const rulesFailures = problemsFound.length;
  if (!Array.isArray(d.rules.banned) || !d.rules.banned.length || !d.rules.banned.every(w => typeof w === 'string' && w)) fail('euphonia.rules.json: "banned" is not a list of names');
  try { new RegExp(d.rules.fey_type); } catch { fail('euphonia.rules.json: "fey_type" is not a pattern'); }
  const rulesHold = problemsFound.length === rulesFailures;

  // Whether the master has moved on since this export. A warning, not a failure:
  // a build in the middle of an edit is fine, and the deploy can't see the master.
  if (typeof prov[0]?.master === 'string') {
    if (!d.master) log.push(`euphonia: the master (${prov[0].master}) isn't on this machine, so whether it changed since the export isn't checked`);
    else if (d.master.sha256 !== prov[0].sha256) warnings.push(`Euphonia.md has changed since this export (${prov[0].sha256?.slice(0, 12)}… → ${d.master.sha256.slice(0, 12)}…); run npm run euphonia:refresh to bring the site up to it`);
  }

  // Nothing forbidden in what's shown, or in the record of what was withheld,
  // once there are rules to check it by.
  let checked = 0;
  for (const f of rulesHold ? FILES : []) {
    for (const s of strings([d[f].data, d[f].withheld])) {
      checked++;
      const why = problems(s, d.rules);
      if (why.length) fail(`euphonia.${f}.json: ${why.join(', ')} in "${s.slice(0, 80)}"`);
    }
  }

  // The regions are Claude's draft of Scott's setting, shown as one (Scott, 2026-10-28).
  if (d.regions.status !== 'draft') fail(`euphonia.regions.json: status is "${d.regions.status}", not "draft"; the chapters call themselves a draft`);

  // The Tide the map reads, whole: the rule names each thing the map shows.
  const tide = d.hidden.data?.tide ?? '';
  for (const word of ['**The Tide.**', '**at the flood**', '**at the ebb**', '**dark half**', 'Samhain', 'Beltane', '**open nights**']) {
    if (!tide.includes(word)) fail(`euphonia.hidden.json: the Tide doesn't say ${word}, which the map shows`);
  }

  // What the files say about each other.
  const regionNames = new Set(d.regions.data.map(r => r.name));
  for (const g of d.adventures.data) {
    for (const r of g.regions) if (!regionNames.has(r)) fail(`the game "${g.title}" is placed in "${r}", which isn't a region`);
  }
  for (const c of d.classes.data) {
    // The builder multiclasses from these: the score asked, and how the
    // class's levels count toward multiclass spell slots, as its paragraph says.
    const mc = c.multiclass;
    // A paragraph withheld for a placeholder is absent, and the record says
    // so; the builder then sets the class aside.
    const withheldMc = mc === null && d.classes.withheld?.some(w => w.where === `${c.name} · As a Multiclass Character`);
    if (!withheldMc && (!mc || mc.abilities?.length !== 1 || mc.any !== false || !ABILITIES.includes(mc.abilities[0]) || !Number.isInteger(mc.score) || !mc.text?.includes(`${mc.abilities[0]} score of ${mc.score}`))) fail(`${c.name}: no multiclass prerequisite the builder can read`);
    else if (mc && mc.spell_slots !== null && !(mc.spell_slots?.fraction === 1 || (mc.spell_slots?.fraction === 0.5 && ['up', 'down'].includes(mc.spell_slots.round)))) fail(`${c.name}: multiclass spell slots read ${JSON.stringify(mc.spell_slots)}`);
    else if (mc && (mc.spell_slots !== null) !== /multiclass spell slots/.test(mc.text)) fail(`${c.name}: its multiclass paragraph and its spell-slot count disagree`);
    // A subclass shown has something to show: one whose every feature was
    // withheld is withheld whole, or the builder offers a choice that gives
    // nothing.
    for (const sub of c.subclasses) if (!sub.features.length) fail(`${c.name}: the subclass ${sub.name} is shown with no features`);
    // A class whose features send the reader to its own spell list has one:
    // the Courtier's, written as a table, once read as nothing.
    const sendsToList = c.features.some(x => x.text.includes(`the ${c.name} spell list`));
    if (sendsToList && !Object.values(c.spells ?? {}).flat().length) fail(`${c.name}: its features name the ${c.name} spell list, but the export has no spells for it`);
    const kept = new Set(c.features.map(x => x.name));
    for (const row of c.table.rows) {
      for (const name of row['Class Features'].split(/,\s*/)) {
        if (name && name !== '—' && !name.endsWith('Subclass') && !kept.has(name)) fail(`${c.name}'s table lists "${name}" at level ${row.Level}, but no such feature is shown`);
      }
    }
  }

  // A Cosmography's summary names each of its Revelations once, and nothing
  // else (a Dominion's Revelation by its realm's: "The Sphere of the Moon").
  for (const c of d.classes.data.filter(x => x.cosmography)) {
    const names = c.cosmography.groups.flatMap(g => g.revelations.map(r => r.name.replace(/^.+?: /, '')));
    const rows = c.cosmography.summary.rows.map(r => r.Plane);
    const missing = names.filter(n => !rows.includes(n)), extra = rows.filter(n => !names.includes(n));
    if (missing.length || extra.length || rows.length !== names.length) fail(`${c.name}'s Cosmography: the summary lacks ${missing.join(', ') || 'none'} and adds ${extra.join(', ') || 'none'}`);
  }
  // The subclasses the books add to the core classes: each to an SRD class,
  // named as none of its own is, beginning at the level the class takes its
  // subclass (the builder offers it beside the SRD's there), from a book the
  // page can cite, with features to show.
  const srdClasses = JSON.parse(read('src/euphonia/euphonia.srd.json')).classes;
  const BOOKS = ['Euphonia: The Classes', 'Euphonia: Life on the Border'];
  for (const sub of d.subclasses.data) {
    const core = srdClasses.find(c => c.name === sub.class_name);
    const at = `${sub.class_name} subclass ${sub.name}`;
    if (!core) { fail(`${at}: ${sub.class_name} isn't one of the SRD's classes`); continue; }
    const first = Math.min(...core.subclasses.flatMap(s => s.features.map(f => f.level)));
    if (core.subclasses.some(s => s.name === sub.name) || d.subclasses.data.filter(s => s.class_name === sub.class_name && s.name === sub.name).length > 1) fail(`${at}: its name is taken`);
    if (!sub.features.length) fail(`${at}: shown with no features`);
    else if (Math.min(...sub.features.map(f => f.level)) !== first) fail(`${at}: begins at level ${Math.min(...sub.features.map(f => f.level))}, but ${sub.class_name} takes its subclass at ${first}`);
    if (!BOOKS.includes(sub.book)) fail(`${at}: from "${sub.book}", which isn't one of the books`);
  }

  // The books' items, for the builder's gear: each from a book the page can
  // cite, a magic item with a rarity and a piece of gear without one, and
  // each period weapon counted as a weapon the SRD has.
  const ITEM_BOOKS = ['Euphonia: The Setting', ...BOOKS];
  for (const it of d.items.data.items) {
    if (!ITEM_BOOKS.includes(it.place.book)) fail(`item ${it.name}: from "${it.place.book}", which isn't one of the books`);
    if (it.magical !== Boolean(it.rarities.length)) fail(`item ${it.name}: ${it.magical ? 'a magic item with no rarity' : 'gear with a rarity'}`);
  }
  const srdWeapons = JSON.parse(read('src/euphonia/euphonia.srd.json')).weapons.map(w => w.name);
  for (const w of d.items.data.weapons) for (const n of w.counts_as) if (!srdWeapons.includes(n)) fail(`period weapon ${w.name}: counts as "${n}", which the SRD hasn't`);

  // Every chapter's lists nest as the master writes them: no item opens on a
  // sub-list with nothing of its own (the empty bullet a list indented four
  // spaces once left).
  for (const r of d.regions.data) for (const sec of r.sections) if (/<li>\s*<ul>/.test(blocks(sec.text))) fail(`${r.name}, ${sec.heading}: a list item with nothing in it but a sub-list`);

  // Each title, ruler or power a chapter places (its @names line) stands in
  // that chapter's text, so its link has somewhere to be.
  for (const r of d.regions.data) for (const n of r.names ?? []) {
    if (!new RegExp(`(?<![\\p{L}])${n.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu').test(r.sections.map(s => s.text).join('\n'))) fail(`${r.name}: its @names line places "${n.name}", which its chapter never names`);
  }

  // The people a table meets: each region's, in the regions' order, each
  // named once and standing in its chapter's People section as the chapter
  // shows it; and Notable People, whole, its headings the book's.
  const people = d.people.data;
  if (people.regions.map(r => r.region).join('|') !== d.regions.data.map(r => r.name).join('|')) fail(`euphonia.people.json: its regions (${people.regions.map(r => r.region).join(', ')}) aren't the chapters'`);
  for (const r of people.regions) {
    const shown = d.regions.data.find(x => x.name === r.region)?.sections.find(sec => sec.heading === 'People')?.text ?? '';
    if (!r.people.length) fail(`euphonia.people.json: ${r.region} has no people`);
    if (new Set(r.people.map(p => p.name)).size !== r.people.length) fail(`euphonia.people.json: ${r.region} names someone twice`);
    for (const p of r.people) if (!shown.includes(`**${p.name}.** ${p.text}`)) fail(`euphonia.people.json: ${r.region}'s ${p.name} isn't as the chapter's People section shows them`);
  }
  if (people.notable.title !== 'Notable People' || !people.notable.blocks.length || people.notable.blocks.some(b => b.kind === 'heading' && ![3, 4].includes(b.level))) fail('euphonia.people.json: Notable People is missing or not the book\'s shape');

  // The character sheets the People page links (euphonia.sheets.json, copied
  // into public/euphonia/sheets): each one a person the page shows, its file
  // there and titled with their name and the class it lists, its text clean,
  // with no script and nothing from elsewhere, its one link back to the
  // People page; no other page in the folder; and the folder's own policy,
  // which lets the sheets' inline styles through and runs no script.
  const SHEETS = 'public/euphonia/sheets/';
  const unescape = t => t.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&(lt|gt|quot|apos|amp);/g, (_, e) => ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' })[e]);
  const shown = new Set([...people.regions.flatMap(r => r.people.map(p => p.name)), ...people.notable.blocks.filter(b => b.kind === 'heading' && b.level === 3).map(b => b.text)]);
  const files = d.sheetFiles ?? (existsSync(new URL(SHEETS, ROOT)) ? readdirSync(new URL(SHEETS, ROOT)).filter(f => f.endsWith('.html')) : []);
  const sheetText = d.sheetText ?? (f => read(SHEETS + f));
  for (const sh of d.sheets.data) {
    const at = `character sheet ${sh.file}`;
    if (!shown.has(sh.name)) { fail(`${at}: ${sh.name} isn't on the People page`); continue; }
    if (!files.includes(sh.file)) { fail(`${at}: not in ${SHEETS}`); continue; }
    const src = sheetText(sh.file), title = unescape(src.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '').trim();
    if (title !== `${sh.name} (${sh.line})`) fail(`${at}: titled "${title}", not ${sh.name} (${sh.line})`);
    if (/<script|<iframe|<object|<embed|\son\w+\s*=/i.test(src)) fail(`${at}: it carries a script`);
    const links = [...src.matchAll(/(?:src|href)\s*=\s*["']([^"']*)/g)].map(m => m[1]);
    if (links.some(l => l !== '/euphonia/#people') || /url\((?!["']?(?:data:|#))/.test(src)) fail(`${at}: it links or loads ${links.filter(l => l !== '/euphonia/#people').join(', ') || 'something from elsewhere'}`);
    const why = problems(unescape(src.replace(/<style[\s\S]*?<\/style>|<[^>]+>/g, ' ')), d.rules);
    if (why.length) fail(`${at}: its text has ${why.join(', ')}`);
  }
  for (const f of files) if (!d.sheets.data.some(sh => sh.file === f)) fail(`${SHEETS}${f}: a page no person links`);
  if (!/script-src 'none'/.test(d.sheetPolicy ?? (existsSync(new URL(`${SHEETS}.htaccess`, ROOT)) ? read(`${SHEETS}.htaccess`) : ''))) fail(`${SHEETS}.htaccess: no policy that runs no script`);

  // The Wheel behind the globe: every plane the table files by height and
  // bearing reads as a place on it, no two share a place, and each of the
  // Revelator's five roads runs through two or more of them.
  const wheel = wheelOf(d.wheel.data, d.classes.data);
  for (const p of d.wheel.data.planes) {
    if (/\b(Good|Evil|Law|Chaos)\b/.test(p.filed) && !wheel.realms.some(r => r.name === p.name.replace(/\*\*/g, ''))) fail(`euphonia.wheel.json: ${p.name} is filed "${p.filed}", which isn't a place on the Wheel`);
  }
  const places = wheel.realms.map(r => r.at);
  if (new Set(places).size !== places.length) fail('euphonia.wheel.json: two planes share a place on the Wheel');
  if (wheel.roads.length !== 5) fail(`the Revelator has ${wheel.roads.length} pathways, not the five roads`);
  for (const r of wheel.roads) if (r.through.length < 2) fail(`the road ${r.name} runs through ${r.through.length} plane(s) the Wheel files`);

  // The colophon: what Euphonia is, in the book's own words.
  if (!d.welcome.data?.opening?.length || !d.welcome.data?.world?.length) fail('euphonia.welcome.json: no opening or no "What Will Your World Be?" for the colophon');
  // The builder names languages by the book's rule: Common is the vernacular.
  if (!d.languages.data?.paragraphs?.some(p => /^- \*\*Common\*\* is the character's own vernacular/.test(p))) fail('euphonia.languages.json: no "Common is the character\'s own vernacular" for the builder');

  // The footer's text: the SRD attribution, the ORC Notice, the copyright line.
  const legal = d.legal.data;
  if (!/System Reference Document 5\.2\.1/.test(legal.srd_attribution ?? '') || !/Creative Commons Attribution 4\.0/.test(legal.srd_attribution ?? '')) fail('euphonia.legal.json: the SRD attribution is missing or not the SRD 5.2.1 CC-BY 4.0 one');
  if (!/not affiliated with, endorsed by, or sponsored by Wizards of the Coast/.test(legal.independence ?? '')) fail('euphonia.legal.json: no line beside the SRD attribution saying Euphonia is unaffiliated');
  if (!legal.orc_notice?.length) fail('euphonia.legal.json: no ORC Notice');
  if (!/^Euphonia © \d{4} \S/.test(legal.copyright ?? '')) fail(`euphonia.legal.json: the copyright line reads "${legal.copyright}"`);

  if (problemsFound.length) {
    log.push(`\neuphonia: ${problemsFound.length} problem(s):`);
    for (const p of problemsFound) log.push(`  ${p}`);
  } else {
    const n = k => d[k].data.length;
    log.push(`ok: one export (${prov[0].sha256.slice(0, 12)}…, exporter v${prov[0].exporter_version}) under this gate's rules; ${checked} strings clean; ${n('classes')} classes, ${n('subclasses')} subclasses for the SRD's classes, ${d.items.data.items.length} items and ${d.items.data.weapons.length} period weapons, ${people.regions.reduce((n, r) => n + r.people.length, 0)} people in the regions besides Notable People, ${d.sheets.data.length} character sheets shown (${d.sheets.withheld.length} waiting), ${n('regions')} regions (draft), ${n('adventures')} games, ${d.characters.data.backgrounds.length} backgrounds, ${wheel.realms.length} places on the Wheel and ${wheel.roads.length} roads; the ORC Notice is ${legal.orc_notice_status === 'draft' ? `a draft with ${legal.orc_open_slots.length} open slots` : 'final'}`);
  }
  return { ok: problemsFound.length === 0, failures: problemsFound.length, log, warnings };
}

// What a reader gets of a built page's footer: its text, entities decoded,
// whitespace as it reads.
function footerText(html) {
  const m = [...html.matchAll(/<footer\b([^>]*)>([\s\S]*?)<\/footer>/g)].find(f => /class="legal"/.test(f[1]));
  if (!m) return null;
  if (/\b(hidden|aria-hidden)\b/.test(m[1])) return null;
  // Inline tags join their words as a reader sees them; block tags separate.
  return m[2].replace(/<\/?(?:a|em|strong)\b[^>]*>/g, '').replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

// Every built Euphonia page carries the copyright line, the ORC Notice and the
// SRD 5.2.1 attribution in its own text, so they reach a reader with scripting
// off and survive printing. Run on the build's output, not the template.
export function verifyEuphoniaPages(outDir, legal = euphoniaFiles().legal.data) {
  const log = [];
  const problemsFound = [];
  const dir = join(outDir, 'euphonia');
  const pages = existsSync(dir) ? readdirSync(dir, { recursive: true }).filter(f => f.endsWith('.html')) : [];
  if (!pages.length) problemsFound.push(`no Euphonia pages were built under ${dir}`);
  const owed = [
    ['the copyright line', legal.copyright],
    ...legal.orc_notice.map((p, i) => [`ORC Notice paragraph ${i + 1}`, plain(p)]),
    ['the SRD 5.2.1 attribution', legal.srd_attribution],
    ['the line beside it, that Euphonia is unaffiliated', legal.independence],
  ].map(([what, text]) => [what, text.replace(/\s+/g, ' ')]);
  for (const page of pages) {
    const text = footerText(readFileSync(join(dir, page), 'utf8'));
    if (text === null) { problemsFound.push(`euphonia/${page}: no visible <footer class="legal">`); continue; }
    for (const [what, want] of owed) if (!text.includes(want)) problemsFound.push(`euphonia/${page}: the footer doesn't carry ${what} as written`);
  }
  if (problemsFound.length) {
    log.push(`\neuphonia pages: ${problemsFound.length} problem(s):`);
    for (const p of problemsFound) log.push(`  ${p}`);
  } else {
    log.push(`ok: all ${pages.length} Euphonia page(s) carry the copyright line, the ORC Notice (${legal.orc_notice.length} paragraphs) and the SRD 5.2.1 attribution in their footer`);
  }
  return { ok: problemsFound.length === 0, failures: problemsFound.length, log };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log, warnings } = verifyEuphonia();
  log.forEach(l => console.log(l));
  warnings.forEach(w => console.warn(`warning: ${w}`));
  if (!ok) process.exit(1);
}
