import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const read = rel => readFileSync(new URL(rel, ROOT), 'utf8');
const FILES = ['classes', 'regions', 'adventures', 'legal'];

// What may never reach a Euphonia page: draft brackets, braced names awaiting
// replacement, and other people's names. The exporter (class-kit/site_export.py)
// applies the same rules and writes them into each file's provenance; this gate
// is their authority on the site, and refuses an export made under any other.
export const BANNED = ['eladrin', 'Feywild', 'Shadowfell', 'changeling', 'genasi', 'Seelie', 'Unseelie', 'Imbas', 'Dungeons & Dragons', 'D&D'];
// "Fey" survives only as the creature type; the setting's prose says "fae".
export const FEY_TYPE = /\bFey(?=\s+(?:creatures?\b|among the creature types))|(?<=\*)Fey(?=\.\*)/g;

export function euphoniaData() {
  return Object.fromEntries(FILES.map(f => [f, JSON.parse(read(`src/euphonia/euphonia.${f}.json`))]));
}

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function problems(text) {
  const out = [];
  if (/[[\]]/.test(text)) out.push('a bracket');
  if (/[{}]/.test(text)) out.push('a brace');
  BANNED.forEach((w, i) => { if (new RegExp(`(?<!\\w)${escape(w)}(?!\\w)`, 'i').test(text)) out.push(`banned word ${i + 1}`); });
  if (/\bfey\b/i.test(text.replace(FEY_TYPE, ''))) out.push('the creature type used as prose');
  return out;
}

function* strings(o) {
  if (typeof o === 'string') yield o;
  else if (Array.isArray(o)) for (const v of o) yield* strings(v);
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { yield k; yield* strings(v); }
}

export function verifyEuphonia(d = euphoniaData()) {
  const log = [];
  const problemsFound = [];
  const fail = m => problemsFound.push(m);

  // One export, from one master, under these rules.
  const prov = FILES.map(f => d[f]?.provenance);
  FILES.forEach((f, i) => {
    const p = prov[i];
    if (!/^[0-9a-f]{64}$/.test(p?.sha256 ?? '')) fail(`euphonia.${f}.json: no SHA-256 of the master in its provenance`);
    if (p?.exporter !== 'class-kit/site_export.py' || !Number.isInteger(p?.exporter_version)) fail(`euphonia.${f}.json: provenance doesn't name the exporter and its version`);
    if (p?.sha256 !== prov[0]?.sha256 || p?.exporter_version !== prov[0]?.exporter_version) fail(`euphonia.${f}.json: from a different export than euphonia.classes.json; refresh all four together`);
    if (JSON.stringify(p?.rules?.banned) !== JSON.stringify(BANNED)) fail(`euphonia.${f}.json: exported under a different banned list than this gate's`);
    if (p?.rules?.fey_type !== FEY_TYPE.source) fail(`euphonia.${f}.json: exported under a different creature-type rule than this gate's`);
  });

  // Nothing forbidden in what's shown, or in the record of what was withheld.
  let checked = 0;
  for (const f of FILES) {
    for (const s of strings([d[f].data, d[f].withheld])) {
      checked++;
      const why = problems(s);
      if (why.length) fail(`euphonia.${f}.json: ${why.join(', ')} in "${s.slice(0, 80)}"`);
    }
  }

  // The regions are Claude's draft of Scott's setting, shown as one (Scott, 2026-10-28).
  if (d.regions.status !== 'draft') fail(`euphonia.regions.json: status is "${d.regions.status}", not "draft"; the chapters call themselves a draft`);

  // What the files say about each other.
  const regionNames = new Set(d.regions.data.map(r => r.name));
  for (const g of d.adventures.data) {
    for (const r of g.regions) if (!regionNames.has(r)) fail(`the game "${g.title}" is placed in "${r}", which isn't a region`);
  }
  for (const c of d.classes.data) {
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
    log.push(`ok: one export (${prov[0].sha256.slice(0, 12)}…, exporter v${prov[0].exporter_version}) under this gate's rules; ${checked} strings clean; ${n('classes')} classes, ${n('regions')} regions (draft), ${n('adventures')} games; the ORC Notice is ${legal.orc_notice_status === 'draft' ? `a draft with ${legal.orc_open_slots.length} open slots` : 'final'}`);
  }
  return { ok: problemsFound.length === 0, failures: problemsFound.length, log };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log } = verifyEuphonia();
  log.forEach(l => console.log(l));
  if (!ok) process.exit(1);
}
