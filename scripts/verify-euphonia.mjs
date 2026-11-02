import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { plain } from '../src/euphonia/euphonia.markdown.js';
import { ABILITIES } from '../src/euphonia/euphonia.character.js';

const ROOT = new URL('../', import.meta.url);
const read = rel => readFileSync(new URL(rel, ROOT), 'utf8');
const FILES = ['classes', 'regions', 'adventures', 'legal', 'hidden', 'characters'];

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
    if (!mc || mc.abilities?.length !== 1 || mc.any !== false || !ABILITIES.includes(mc.abilities[0]) || !Number.isInteger(mc.score) || !mc.text?.includes(`${mc.abilities[0]} score of ${mc.score}`)) fail(`${c.name}: no multiclass prerequisite the builder can read`);
    else if (mc.spell_slots !== null && !(mc.spell_slots?.fraction === 1 || (mc.spell_slots?.fraction === 0.5 && ['up', 'down'].includes(mc.spell_slots.round)))) fail(`${c.name}: multiclass spell slots read ${JSON.stringify(mc.spell_slots)}`);
    else if ((mc.spell_slots !== null) !== /multiclass spell slots/.test(mc.text)) fail(`${c.name}: its multiclass paragraph and its spell-slot count disagree`);
    const kept = new Set(c.features.map(x => x.name));
    for (const row of c.table.rows) {
      for (const name of row['Class Features'].split(/,\s*/)) {
        if (name && name !== '—' && !name.endsWith('Subclass') && !kept.has(name)) fail(`${c.name}'s table lists "${name}" at level ${row.Level}, but no such feature is shown`);
      }
    }
  }

  // The footer's text: the SRD attribution, the ORC Notice, the copyright line.
  const legal = d.legal.data;
  if (!/System Reference Document 5\.2\.1/.test(legal.srd_attribution ?? '') || !/Creative Commons Attribution 4\.0/.test(legal.srd_attribution ?? '')) fail('euphonia.legal.json: the SRD attribution is missing or not the SRD 5.2.1 CC-BY 4.0 one');
  if (!legal.orc_notice?.length) fail('euphonia.legal.json: no ORC Notice');
  if (!/^Euphonia © \d{4} \S/.test(legal.copyright ?? '')) fail(`euphonia.legal.json: the copyright line reads "${legal.copyright}"`);

  if (problemsFound.length) {
    log.push(`\neuphonia: ${problemsFound.length} problem(s):`);
    for (const p of problemsFound) log.push(`  ${p}`);
  } else {
    const n = k => d[k].data.length;
    log.push(`ok: one export (${prov[0].sha256.slice(0, 12)}…, exporter v${prov[0].exporter_version}) under this gate's rules; ${checked} strings clean; ${n('classes')} classes, ${n('regions')} regions (draft), ${n('adventures')} games, ${d.characters.data.backgrounds.length} backgrounds; the ORC Notice is ${legal.orc_notice_status === 'draft' ? `a draft with ${legal.orc_open_slots.length} open slots` : 'final'}`);
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log, warnings } = verifyEuphonia();
  log.forEach(l => console.log(l));
  warnings.forEach(w => console.warn(`warning: ${w}`));
  if (!ok) process.exit(1);
}
