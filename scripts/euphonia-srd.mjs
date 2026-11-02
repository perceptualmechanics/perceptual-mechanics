// Exports what the character builder takes from the System Reference
// Document 5.2.1 (Wizards of the Coast, CC-BY-4.0): its backgrounds, species,
// feats, and the tables the rules compute from. Nothing is typed: the text
// and tables are read from the PDF's own words, where they sit and how they
// are set (scripts/srd-words.swift). A deliberate step, like the other
// vendoring scripts:
//   swift scripts/srd-words.swift SRD_CC_v5.2.1.pdf > srd-words.tsv
//   node scripts/euphonia-srd.mjs SRD_CC_v5.2.1.pdf srd-words.tsv
//
// How the SRD is set, which is all the parser leans on: two columns, their
// margins at x 63 and 313.5; section headings 14 pt and item headings 12 pt
// in Gill Sans SemiBold, labels ("Creature Type:") 10 pt SemiBold, table
// titles 10.5 pt SemiBold, tables in Gill Sans, body text 10 pt, a
// paragraph's first line indented 8 pt; the page number and the document's
// name at the foot, y 745.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = new URL('../src/euphonia/euphonia.srd.json', import.meta.url);
const COLUMN_SPLIT = 300, FOOTER_Y = 740, INDENT = 8, LINE_TOLERANCE = 2.5;
const [pdfPath, wordsPath] = process.argv.slice(2);
if (!pdfPath || !wordsPath) throw new Error('usage: node scripts/euphonia-srd.mjs <SRD pdf> <srd-words.tsv>');

const words = readFileSync(wordsPath, 'utf8').trim().split('\n').map(l => {
  const [page, x, y, size, font, text] = l.split('\t');
  return { page: +page, x: +x, y: +y, size: +size, font, text };
}).filter(w => w.y < FOOTER_Y);

// Body text, table text and heading text: SemiBold Gill Sans is a heading,
// except under 9.9 pt, where it heads a table's columns.
const TABLE_HEAD_PT = 9.9;
const family = (font, size) => (/SemiBold/.test(font) && size >= TABLE_HEAD_PT ? 'heading' : /Gill/.test(font) ? 'table' : 'body');

// ---------- lines, in reading order. The words come in the page's own text
// order, which PDFKit reads column by column; their heights can't be trusted
// for order (an italic line reports itself 5 pt below the line that follows
// it), so a line is a run of words in that order at about one height, in one
// column, set alike: a heading can share its baseline with body text beside
// it ("Feat Descriptions" does).
const lines = [];
let line = null;
for (const w of words) {
  // Tables can span both columns (Elven Lineages does), so their lines don't
  // break at the gutter; body text and headings do.
  const right = family(w.font, w.size) === 'table' && line?.family === 'table' && line.page === w.page ? line.right : w.x >= COLUMN_SPLIT;
  if (!line || line.page !== w.page || line.right !== right || Math.abs(w.y - line.y) > LINE_TOLERANCE || line.size !== w.size || line.family !== family(w.font, w.size)) {
    line = { page: w.page, right, y: w.y, size: w.size, family: family(w.font, w.size), words: [] };
    lines.push(line);
  }
  line.words.push(w);
}
for (const l of lines) {
  const first = l.words[0];
  l.text = l.words.map(w => w.text).join(' ');
  l.x = first.x; l.size = first.size; l.font = first.font;
  l.margin = l.right ? 313.5 : 63;
  l.kind = /Gill/.test(first.font) && first.font.endsWith('SemiBold') && first.size >= 13.5 ? 'section'
    : /Gill/.test(first.font) && first.font.endsWith('SemiBold') && first.size >= 11.5 ? 'item'
      : /Gill/.test(first.font) && first.font.endsWith('SemiBold') && first.size >= 10.4 ? 'title'
        : /Gill/.test(first.font) && first.font.endsWith('SemiBold') && first.size >= 9.9 ? 'label'
          : /Gill/.test(first.font) ? 'table' : 'body';
  l.indented = l.kind === 'body' && Math.abs(l.x - (l.margin + INDENT)) < 1.5;
}

// ---------- words the SRD itself uses, and how often, to rejoin words broken
// at a line's end only where the joined word is one of them, and to mend
// kerning splits ("Dexterit y") where the joined word is the commoner: the
// fragment is in the vocabulary too, once.
const uses = new Map();
for (const w of words) {
  const k = w.text.replace(/[^\p{L}’'-]/gu, '').toLowerCase();
  if (k) uses.set(k, (uses.get(k) ?? 0) + 1);
}
const vocabulary = new Set(uses.keys());
function join(lineTexts) {
  let out = '';
  for (const t of lineTexts) {
    if (!out) { out = t; continue; }
    const m = out.match(/(\p{L}+)-$/u), first = t.match(/^([\p{L}’']+)/u);
    if (m && first && vocabulary.has((m[1] + first[1]).toLowerCase())) out = out.slice(0, -1) + t;
    else out += (out.endsWith('-') && first ? '' : ' ') + t;
  }
  return out.replace(/\b(\p{L}+) (\p{L})\b/gu, (all, a, b) => ((uses.get((a + b).toLowerCase()) ?? 0) > (uses.get(a.toLowerCase()) ?? 0) ? a + b : all));
}

// The body text's leading, the commonest step between one line and the next
// in a column: a wider step is the space the SRD sets around a list.
const LEADING = (() => {
  const steps = new Map();
  for (let i = 1; i < lines.length; i++) {
    const a = lines[i - 1], b = lines[i];
    if (a.kind === 'body' && b.kind === 'body' && a.page === b.page && a.right === b.right) {
      const d = Math.round(b.y - a.y);
      steps.set(d, (steps.get(d) ?? 0) + 1);
    }
  }
  return [...steps].sort((a, b) => b[1] - a[1])[0][0];
})();

// A run of lines between two headings, as paragraphs. A paragraph's first
// line is indented and the rest are flush; a list's items (a trait's
// options: "Forest Gnome.", "Cloud’s Jaunt (Cloud Giant).") hang the other
// way, flush and then indented, and the SRD sets a space above and below the
// list.
function blocks(from, to) {
  const out = [];
  let para = null, list = false, prev = null;
  for (let i = from; i < to; i++) {
    const l = lines[i];
    // A label's value starts beside it and may wrap onto the next line, set
    // as it is and hanging.
    const label = out.at(-1), last = label?.lines.at(-1);
    const beside = label?.kind === 'label' && label.lines.length === 1 && last.page === l.page && Math.abs(last.y - l.y) <= LINE_TOLERANCE;
    const wraps = label?.kind === 'label' && label.lines.length > 1 && last.page === l.page && l.kind !== 'label'
      && l.font === last.font && l.size === last.size && l.y - last.y > LINE_TOLERANCE && l.y - last.y <= LEADING + LINE_TOLERANCE;
    if (beside || wraps) {
      label.lines.push(l);
      label.text += ` ${l.text}`;
      continue;
    }
    if (l.kind === 'body') {
      const spaced = prev && prev.page === l.page && prev.right === l.right && l.y - prev.y > LEADING + LINE_TOLERANCE;
      if (spaced) list = !l.indented;
      const starts = !para || (list ? !l.indented : l.indented);
      if (starts) { para = { kind: 'para', item: list, lines: [] }; out.push(para); }
      para.lines.push(l.text);
      prev = l;
    } else {
      para = null; list = false; prev = null;
      if (l.kind === 'table' && out.at(-1)?.kind === 'table') out.at(-1).lines.push(l);
      else out.push({ kind: l.kind, lines: [l], text: l.text });
    }
  }
  for (const b of out) if (b.kind === 'para') b.text = join(b.lines);
  return out;
}
const findLine = (kind, text, from = 0) => {
  const i = lines.findIndex((l, k) => k >= from && l.kind === kind && l.text === text);
  if (i < 0) throw new Error(`the SRD has no ${kind} "${text}"`);
  return i;
};
const nextOf = (i, kinds) => { let k = i + 1; while (k < lines.length && !kinds.includes(lines[k].kind)) k++; return k; };

// A paragraph led by a bold name ("Darkvision. You have…"): the name, and the
// rest. Names are Title Case, as the SRD sets them.
// Names can carry a number ("Level 1 Spell."); an option names what it's from in parentheses ("Cloud’s Jaunt (Cloud
// Giant).").
const NAME_WORD = "(?:[A-Z][\\p{L}’'-]*|\\d+|of|the|and|a|an|to|or|in|with)";
const LEAD = new RegExp(`^([A-Z][\\p{L}’'-]*(?: ${NAME_WORD})*(?: \\([A-Z][\\p{L}’'-]*(?: ${NAME_WORD})*\\))?)\\. (.+)$`, 'u');
const lead = text => { const m = text.match(LEAD); return m ? { name: m[1], text: m[2] } : { name: null, text }; };

// ---------- a table: its rows, read by height (a table's words, unlike
// italic body text, report their heights truly), its columns from the
// header's word positions. A row starts where the first column has a word;
// rows without one continue the row above (cells that wrap). A table that
// names its columns twice (Dragon, Damage Type, Dragon, Damage Type) is two
// halves side by side, read left half first, as the SRD runs them.
function table(block, headers) {
  const all = block.lines.flatMap(l => l.words).sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  for (const w of all) {
    if (!rows.length || w.y - rows.at(-1)[0].y > LINE_TOLERANCE) rows.push([]);
    rows.at(-1).push(w);
  }
  const [head, ...body] = rows.map(r => r.sort((a, b) => a.x - b.x));
  const headText = head.map(w => w.text).join(' ');
  // Each header's first word, found left to right after the one before.
  let from = 0;
  const cols = headers.map(h => {
    const k = head.findIndex((x, i) => i >= from && x.text === h.split(' ')[0]);
    if (k < 0) throw new Error(`table header "${h}" not found in "${headText}"`);
    from = k + h.split(' ').length;
    return head[k].x;
  });
  if (from !== head.length) throw new Error(`table header "${headText}" has columns beyond ${headers.join(', ')}`);
  const colOf = x => { let k = 0; for (let i = 0; i < cols.length; i++) if (x >= cols[i] - 3) k = i; return k; };
  // A range takes no space around its dash (12–13), but kerning can split
  // one into two words ("10", "–11").
  const cell = ws => ws.map(w => w.text).join(' ').replace(/(\d) ([–—]\d)/g, '$1$2');
  const grid = body.map(r => headers.map((h, i) => cell(r.filter(w => colOf(w.x) === i))));
  const half = headers.length / 2;
  const paired = Number.isInteger(half) && headers.slice(0, half).join() === headers.slice(half).join();
  const parts = paired ? [[0, half], [half, headers.length]] : [[0, headers.length]];
  const out = [];
  for (const [a, b] of parts) {
    const names = headers.slice(a, b), mine = [];
    for (const r of grid.map(g => g.slice(a, b))) {
      if (r[0]) mine.push(r);
      else if (mine.length) r.forEach((c, i) => { if (c) mine.at(-1)[i] = `${mine.at(-1)[i]} ${c}`; });
      else if (r.some(Boolean)) throw new Error(`table "${headText}": a row with no first cell`);
    }
    out.push(...mine.map(r => Object.fromEntries(names.map((h, i) => [h, r[i]]))));
  }
  return out;
}

// ---------- backgrounds
function backgrounds() {
  const start = findLine('section', 'Background Descriptions'), end = nextOf(start, ['section']);
  const out = [];
  for (let i = start + 1; i < end; i++) {
    if (lines[i].kind !== 'item') continue;
    const stop = nextOf(i, ['item', 'section']);
    const fields = {};
    let key = null;
    for (let k = i + 1; k < Math.min(stop, end); k++) {
      const l = lines[k];
      const m = l.text.match(/^(Ability Scores|Feat|Skill Proficiencies|Tool Proficiency|Equipment):\s*(.*)$/);
      if (m) { key = m[1]; fields[key] = [m[2]]; } else if (key) fields[key].push(l.text);
    }
    const f = k => join(fields[k] ?? []);
    out.push({
      name: lines[i].text,
      ability_scores: f('Ability Scores').split(/,\s*/),
      feat: f('Feat').replace(/\s*\(see “Feats”\)$/, ''),
      skills: f('Skill Proficiencies').split(/\s+and\s+/),
      tool: f('Tool Proficiency'),
      equipment: f('Equipment'),
    });
  }
  return out;
}

// ---------- species, with the tables their traits name
const SPECIES_TABLES = {
  'Draconic Ancestors': ['Dragon', 'Damage Type', 'Dragon', 'Damage Type'],
  'Elven Lineages': ['Lineage', 'Level 1', 'Level 3', 'Level 5'],
  'Fiendish Legacies': ['Legacy', 'Level 1', 'Level 3', 'Level 5'],
};
function species() {
  const start = findLine('section', 'Species Descriptions'), end = nextOf(start, ['section']);
  const out = [];
  for (let i = start + 1; i < end; i++) {
    if (lines[i].kind !== 'item') continue;
    const stop = Math.min(nextOf(i, ['item', 'section']), end);
    const s = { name: lines[i].text, traits: [], tables: {} };
    let title = null;
    for (const b of blocks(i + 1, stop)) {
      if (b.kind === 'label') {
        const m = b.text.match(/^(Creature Type|Size|Speed):\s*(.*)$/);
        if (m) s[{ 'Creature Type': 'creature_type', Size: 'size', Speed: 'speed' }[m[1]]] = m[2];
      } else if (b.kind === 'title') title = b.text;
      else if (b.kind === 'table' && title) {
        if (!SPECIES_TABLES[title]) throw new Error(`${s.name}: a table "${title}" the exporter doesn't know`);
        s.tables[title] = table(b, SPECIES_TABLES[title]);
        title = null;
      } else if (b.kind === 'para' && b.item) {
        // A list's items are the options of the trait above it.
        const p = lead(b.text);
        if (!p.name || !s.traits.length) throw new Error(`${s.name}: an unnamed option "${b.text.slice(0, 40)}"`);
        (s.traits.at(-1).options ??= []).push(p);
      } else if (b.kind === 'para') {
        const p = lead(b.text);
        if (p.name) s.traits.push({ name: p.name, text: p.text });
        else if (s.traits.length) s.traits.at(-1).text += `\n\n${p.text}`;
        else s.lead = p.text;
      }
    }
    out.push(s);
  }
  return out;
}

// ---------- feats
const ABILITIES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
function feats() {
  const start = findLine('section', 'Feat Descriptions');
  const end = nextOf(findLine('section', 'Epic Boon Feats', start), ['section']);
  const out = [];
  for (let i = start + 1; i < end; i++) {
    if (lines[i].kind !== 'item') continue;
    const stop = Math.min(nextOf(i, ['item', 'section']), end);
    const paras = blocks(i + 1, stop).filter(b => b.kind === 'para').map(b => b.text);
    // The category line, and any prerequisite in its parentheses.
    const head = paras.shift() ?? '';
    const m = head.match(/^(Origin|General|Fighting Style|Epic Boon) Feat(?: \(Prerequisite: ([^)]*)\))?\s*(.*)$/);
    if (!m) throw new Error(`${lines[i].text}: no category line in "${head}"`);
    if (m[3]) paras.unshift(m[3]);
    const led = paras.map(lead);
    // Named paragraphs are the feat's benefits; the rest describe it.
    const benefits = led.filter(b => b.name);
    const description = led.filter(b => !b.name).map(b => b.text).join('\n\n');
    const asiText = benefits.find(b => b.name === 'Ability Score Increase')?.text ?? '';
    const asi = asiText && {
      from: /one ability score of your choice/.test(asiText) ? ABILITIES : ABILITIES.filter(a => asiText.includes(a)),
      by: +(asiText.match(/by (\d+)/)?.[1] ?? 0),
      max: +(asiText.match(/maximum of (\d+)/)?.[1] ?? 0),
    };
    const prerequisite = m[2] ?? null;
    out.push({
      name: lines[i].text, category: m[1], prerequisite,
      level: prerequisite ? +(prerequisite.match(/Level (\d+)\+/)?.[1] ?? 1) : 1,
      repeatable: benefits.some(b => b.name === 'Repeatable'),
      description, benefits, ...(asi ? { asi } : {}),
    });
  }
  return out;
}

// ---------- rules tables
function titledTable(title, headers, section) {
  const from = section ? findLine('section', section) : 0;
  const t = findLine('title', title, from);
  // The first table under the title; a subtitle may come between
  // ("Multiclass Spellcaster:", then "Spell Slots per Spell Level").
  const b = blocks(t + 1, nextOf(t, ['section', 'item'])).find(x => x.kind === 'table');
  if (!b) throw new Error(`no table under "${title}"`);
  return table(b, headers);
}
const LEVELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

// ---------- the ability-score methods, from their paragraphs under
// "Generate Your Scores": the standard array's six scores and the point
// cost's budget.
function scoreMethods() {
  const i = lines.findIndex(l => l.text === 'Generate Your Scores');
  if (i < 0) throw new Error('the SRD has no "Generate Your Scores"');
  const paras = blocks(i + 1, nextOf(i, ['section', 'item', 'title'])).filter(b => b.kind === 'para').map(b => lead(b.text));
  const named = name => paras.find(p => p.name === name)?.text ?? (() => { throw new Error(`no "${name}." paragraph`); })();
  const array = named('Standard Array').match(/:\s*([\d,\s]+)\./)?.[1].split(/,\s*/).map(Number);
  const budget = +named('Point Cost').match(/You have (\d+) points to spend/)?.[1];
  if (array?.length !== 6 || !budget) throw new Error('the score methods didn\'t read');
  return { standard_array: array, point_budget: budget };
}

// ---------- the setting's one rename: "Fey" survives only as the creature
// type, and elsewhere reads "Fae" (euphonia.rules.json, the site's one copy
// of the rule). Each change is recorded, as the licence asks of an adaptation.
const RULES = JSON.parse(readFileSync(new URL('../src/euphonia/euphonia.rules.json', import.meta.url), 'utf8'));
function adapt(o, path = '', changes = []) {
  if (Array.isArray(o)) return o.map((v, i) => adapt(v, `${path}/${i}`, changes));
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, adapt(v, `${path}/${k}`, changes)]));
  if (typeof o !== 'string') return o;
  const kept = [...o.matchAll(new RegExp(RULES.fey_type, 'g'))].map(m => [m.index, m.index + m[0].length]);
  const out = o.replace(/\b([Ff])ey\b/g, (word, f, at) => (kept.some(([a, b]) => at >= a && at < b) ? word : `${f === 'F' ? 'F' : 'f'}ae`));
  // The record keeps where and what it reads now: it is held to the rule too.
  if (out !== o) changes.push({ path, to: out });
  return out;
}

// ---------- every paragraph read must run, word for word, in the SRD's own
// lines: a join, a split or a label taken wrongly breaks the run. The lines
// are joined as set, a line ending in a hyphen straight onto the next, and
// hyphens are then set aside on both sides, since the page's line-end hyphens
// can't be told from the words' own. A kerning split ("Dexterit y") is mended
// on both sides alike.
function holdsToSource({ species: sp, feats: ft, backgrounds: bg }) {
  const flat = t => t.replace(/-/g, '').replace(/\s+/g, ' ').replace(/\b(\p{L}+) (\p{L})\b/gu, '$1$2').toLowerCase();
  const source = flat(lines.map(l => l.text).reduce((all, t) => (all.endsWith('-') ? all + t : `${all} ${t}`), ''));
  const runs = [];
  const paras = (where, name, text) => text.split('\n\n').forEach((p, i) => runs.push([where, i === 0 && name ? `${name}. ${p}` : p]));
  for (const s of sp) {
    runs.push([s.name, s.lead], [s.name, `Creature Type: ${s.creature_type}`], [s.name, `Size: ${s.size}`], [s.name, `Speed: ${s.speed}`]);
    for (const t of s.traits) { paras(`${s.name}, ${t.name}`, t.name, t.text); for (const o of t.options ?? []) paras(`${s.name}, ${o.name}`, o.name, o.text); }
  }
  for (const f of ft) { if (f.description) paras(f.name, null, f.description); for (const b of f.benefits) paras(`${f.name}, ${b.name}`, b.name, b.text); }
  for (const b of bg) runs.push([b.name, b.tool], [b.name, b.equipment]);
  const astray = runs.filter(([, t]) => !source.includes(flat(t)));
  if (astray.length) throw new Error(`${astray.length} paragraph(s) not in the SRD as read: ${astray.map(([w, t]) => `${w}: "${t.slice(0, 50)}"`).join('; ')}`);
  console.log(`${runs.length} paragraphs, each found in the SRD's own text`);
}

const pdf = readFileSync(pdfPath);
const data = {
  provenance: {
    source: 'System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, licensed under the Creative Commons Attribution 4.0 International License',
    url: 'https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf',
    license: 'https://creativecommons.org/licenses/by/4.0/legalcode',
    sha256: createHash('sha256').update(pdf).digest('hex'),
    fetched: '2026-11-01',
    extracted: 'Words with their positions and fonts (scripts/srd-words.swift), parsed by scripts/euphonia-srd.mjs; nothing typed.',
  },
  ...(() => {
    const changes = [];
    const read = { backgrounds: backgrounds(), species: species(), feats: feats() };
    holdsToSource(read);
    const content = adapt(read, '', changes);
    return { adapted: { rule: 'euphonia.rules.json fey_type', changes }, ...content };
  })(),
  ability_scores: scoreMethods(),
  tables: {
    advancement: titledTable('Character Advancement', ['Level', 'Experience Points', 'Proficiency Bonus']),
    skills: titledTable('Skills', ['Skill', 'Ability', 'Example Uses']),
    point_costs: titledTable('Ability Score Point Costs', ['Score', 'Cost', 'Score', 'Cost']),
    ability_modifiers: titledTable('Ability Scores and Modifiers', ['Score', 'Modifier', 'Score', 'Modifier']),
    multiclass_slots: titledTable('Multiclass Spellcaster:', ['Level', ...LEVELS]),
  },
};
writeFileSync(OUT, `${JSON.stringify(data, null, 1)}\n`);
console.log(`euphonia.srd.json: ${data.backgrounds.length} backgrounds, ${data.species.length} species (${data.species.reduce((n, s) => n + s.traits.length, 0)} traits), ${data.feats.length} feats`);
