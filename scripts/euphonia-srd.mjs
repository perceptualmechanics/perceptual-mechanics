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
// A count the SRD spells out in words ("two beams at level 5", "fifty
// coins weigh a pound").
const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TENS = ['', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const wordNumber = w => { const n = UNITS.includes(w) ? UNITS.indexOf(w) : TENS.includes(w) ? TENS.indexOf(w) * 10 : NaN; if (Number.isNaN(n)) throw new Error(`a number the exporter doesn't read: "${w}"`); return n; };
const COLUMN_SPLIT = 300, FOOTER_Y = 740, INDENT = 8, LINE_TOLERANCE = 2.5;
const [pdfPath, wordsPath] = process.argv.slice(2);
if (!pdfPath || !wordsPath) throw new Error('usage: node scripts/euphonia-srd.mjs <SRD pdf> <srd-words.tsv>');

const words = readFileSync(wordsPath, 'utf8').trim().split('\n').map(l => {
  const [page, x, y, width, size, font, text] = l.split('\t');
  // A soft hyphen ("Short\u00adsword") is the typesetter's hint, not a letter.
  return { page: +page, x: +x, y: +y, width: +width, size: +size, font, text: text.replace(/\u00ad/g, '') };
}).filter(w => w.y < FOOTER_Y);

// Body text, table text and heading text: SemiBold Gill Sans is a heading,
// except under 9.9 pt, where it heads a table's columns.
const TABLE_HEAD_PT = 9.9;
// A sidebar, commentary set apart from the rules ("Breaking Your Oath"), is
// set smaller than a table, its title larger than body text.
const ASIDE_PT = 9.0, ASIDE_TITLE_PT = 11;
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
          : first.size <= ASIDE_PT || (l.family === 'body' && first.size >= ASIDE_TITLE_PT) ? 'aside'
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
// list. A bullet is a paragraph of its own.
let asides = 0;
function blocks(from, to, skip = new Set()) {
  const out = [];
  let para = null, list = false, prev = null;
  for (let i = from; i < to; i++) {
    if (skip.has(i)) continue;
    const l = lines[i];
    // A sidebar can stand in the middle of a paragraph, which runs on round
    // it; it is left out, and counted.
    if (l.kind === 'aside') {
      if (lines[i - 1]?.kind !== 'aside') asides++;
      prev = null;
      continue;
    }
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
    // A bullet ("• Gain the following traits…") hangs its lines under its
    // text, deeper than a paragraph's indent; the first line that doesn't
    // hang ends it.
    if (l.kind === 'body' && l.text.startsWith('• ')) {
      para = { kind: 'para', bullet: true, item: false, lines: [l.text.slice(2)] };
      out.push(para); list = false; prev = l;
      continue;
    }
    if (l.kind === 'body' && para?.bullet) {
      if (l.x - l.margin > INDENT + LINE_TOLERANCE) { para.lines.push(l.text); prev = l; continue; }
      // The space below a list of bullets is the list's, not a new list's.
      para = null; prev = null;
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
// Where a heading's section ends: at the next heading as large or larger.
const RANK = { section: 3, item: 2, title: 1 };
const sectionEnd = i => { let k = i + 1; while (k < lines.length && !((RANK[lines[k].kind] ?? 0) > RANK[lines[i].kind] || (lines[k].kind === lines[i].kind && lines[k].size >= lines[i].size))) k++; return k; };
const nextOf = (i, kinds) => { let k = i + 1; while (k < lines.length && !kinds.includes(lines[k].kind)) k++; return k; };

// A paragraph led by a bold name ("Darkvision. You have…"): the name, and the
// rest. Names are Title Case, as the SRD sets them.
// Names can carry a number ("Level 1 Spell."); an option names what it's from in parentheses ("Cloud’s Jaunt (Cloud
// Giant).").
const NAME_WORD = "(?:[A-Z][\\p{L}’'-]*|\\d+|of|the|and|a|an|to|or|in|with)";
const LEAD = new RegExp(`^([A-Z][\\p{L}’'-]*(?: ${NAME_WORD})*(?: \\([A-Z][\\p{L}’'-]*(?: ${NAME_WORD})*\\))?)\\. (.+)$`, 'u');
const lead = text => { const m = text.match(LEAD); return m ? { name: m[1], text: m[2] } : { name: null, text }; };

// ---------- a table: its rows, read by height (a table's words, unlike
// italic body text, report their heights truly), and its columns from its
// header's geometry. The header is the top rows set in SemiBold; it may stack
// a column's name over two rows ("Proficiency" over "Bonus"). In the lowest
// row, words a word space apart name one column and a wider gap starts the
// next: across the SRD's table headers every word space is 2.6 pt or less
// and every gap between columns 7.5 pt or more, so half the type's size
// (4.6 pt) parts them. A word above names the column it overlaps; one over
// several columns titles them ("Spell Slots per Spell Level") and names
// none. A body word belongs to the last column that starts left of its
// centre, which holds for centred numbers and left-set text alike. A row
// starts where the first column has a word; rows without one continue the
// row above (cells that wrap).
const SEMIBOLD = w => /SemiBold/.test(w.font);
const right = w => w.x + w.width;
function grid(block) {
  // A table that runs on into the next column or page repeats its header
  // there; each part is read on its own geometry. A part starts at a
  // header line that follows the body of the one before, unless it stands
  // beside that part's header (a table set in two halves, Point Costs).
  const parts = [];
  for (const l of block.lines) {
    const head = l.words.every(SEMIBOLD), last = parts.at(-1);
    const beside = last?.heads.some(h => h.page === l.page && Math.abs(h.y - l.y) <= LINE_TOLERANCE);
    if (!last || (head && last.body && !beside)) parts.push({ body: false, heads: [], words: [] });
    if (head) parts.at(-1).heads.push(l); else parts.at(-1).body = true;
    parts.at(-1).words.push(...l.words);
  }
  let names = null;
  const body = [];
  for (const part of parts) {
    const { names: n, rows } = gridPart(part.words);
    if (names && n.join(' | ') !== names.join(' | ')) throw new Error(`a table that runs on headed "${n.join(' | ')}", not "${names.join(' | ')}"`);
    names = n;
    body.push(...rows);
  }
  return { names, rows: body };
}
// A cell's value and the next cell's dash can come as one word ("+4—")
// where no space parts them. A dash alone is set an em wide (all 955 in the
// tables), so it splits off at the word's right edge, and the value keeps
// the width the same text has where it stands alone.
const widths = new Map();
for (const w of words) if (!widths.has(`${w.text} ${w.size}`)) widths.set(`${w.text} ${w.size}`, w.width);
function unmerge(w) {
  const m = !SEMIBOLD(w) && w.text.match(/^(.+?)(—)$/);
  if (!m) return [w];
  const width = widths.get(`${m[1]} ${w.size}`);
  if (width === undefined) throw new Error(`"${w.text}" on page ${w.page}: a value and a dash run together, and the value stands nowhere alone to measure`);
  return [{ ...w, text: m[1], width }, { ...w, text: m[2], x: right(w) - w.size, width: w.size }];
}
function gridPart(words) {
  const all = words.flatMap(unmerge).sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  for (const w of all) {
    if (!rows.length || w.y - rows.at(-1)[0].y > LINE_TOLERANCE) rows.push([]);
    rows.at(-1).push(w);
  }
  rows.forEach(r => r.sort((a, b) => a.x - b.x));
  const heads = rows.findIndex(r => !r.every(SEMIBOLD));
  if (heads < 1) throw new Error(`a table with no header row: "${rows[0]?.map(w => w.text).join(' ')}"`);
  const groups = r => r.reduce((out, w) => {
    const g = out.at(-1);
    if (g && w.x - right(g.at(-1)) <= w.size / 2) g.push(w); else out.push([w]);
    return out;
  }, []);
  // The header row that names the most columns sets them; a group in
  // another row names the one column it overlaps, above or below, or a
  // column of its own where it overlaps none ("Cleric / Level" beside
  // "Prepared Spells").
  const headRows = rows.slice(0, heads);
  const widest = headRows.reduce((best, r, i) => (groups(r).length > groups(headRows[best]).length ? i : best), 0);
  const cols = groups(headRows[widest]).map(g => ({ left: g[0].x, right: right(g.at(-1)), parts: [[widest, g.map(w => w.text)]] }));
  headRows.forEach((r, i) => {
    if (i === widest) return;
    for (const g of groups(r)) {
      const over = cols.filter(c => g[0].x < c.right && right(g.at(-1)) > c.left);
      if (over.length === 1) { over[0].parts.push([i, g.map(w => w.text)]); over[0].left = Math.min(over[0].left, g[0].x); over[0].right = Math.max(over[0].right, right(g.at(-1))); }
      else if (!over.length) cols.push({ left: g[0].x, right: right(g.at(-1)), parts: [[i, g.map(w => w.text)]] });
    }
  });
  cols.sort((a, b) => a.left - b.left);
  const names = cols.map(c => c.parts.sort((a, b) => a[0] - b[0]).flatMap(([, w]) => w).join(' '));
  const body = rows.slice(heads);
  // A row set wholly in italic from the first column across into the next
  // labels the rows under it ("Light Armor (1 Minute to Don or Doff)"); a
  // spell's name wrapping in italic stays in its column.
  const label = r => r.every(w => /Italic/.test(w.font)) && r[0].x <= cols[0].right && right(r.at(-1)) > cols[1]?.left;
  // The columns' reach, from where the body's words fall: runs of words a
  // word space apart, each taken by the heading it overlaps most (or, over
  // none, the nearest). A word belongs to the column whose reach holds its
  // centre, which reads centred numbers, left-set text and right-set
  // numbers ("20 lb. | 400 GP") alike.
  const runs = [];
  for (const w of body.filter(r => !label(r)).flat().sort((a, b) => a.x - b.x)) {
    const last = runs.at(-1);
    if (last && w.x - last.right <= w.size / 2) last.right = Math.max(last.right, right(w));
    else runs.push({ left: w.x, right: right(w) });
  }
  const reach = cols.map(c => ({ left: c.left, right: c.right }));
  for (const run of runs) {
    const overlap = c => Math.min(run.right, c.right) - Math.max(run.left, c.left);
    const mid = (run.left + run.right) / 2;
    const k = cols.reduce((best, c, i) => (overlap(c) > overlap(cols[best]) ? i : best), 0);
    const at = overlap(cols[k]) > 0 ? k : cols.reduce((best, c, i) => (Math.abs((c.left + c.right) / 2 - mid) < Math.abs((cols[best].left + cols[best].right) / 2 - mid) ? i : best), 0);
    reach[at].left = Math.min(reach[at].left, run.left);
    reach[at].right = Math.max(reach[at].right, run.right);
  }
  const colOf = w => {
    const mid = w.x + w.width / 2;
    const k = reach.findIndex(c => mid >= c.left && mid <= c.right);
    if (k >= 0) return k;
    throw new Error(`table "${names.join(' | ')}": "${w.text}" falls in no column`);
  };
  // A range takes no space around its dash (12–13), but kerning can split
  // one into two words ("10", "–11").
  const cell = ws => ws.map(w => w.text).join(' ').replace(/(\d) ([–—]\d)/g, '$1$2');
  return { names, rows: body.map((r, k) => Object.assign(label(r) ? names.map(() => '') : names.map((n, i) => cell(r.filter(w => colOf(w) === i))), { gap: k ? r[0].y - body[k - 1][0].y : Infinity, label: label(r) ? cell(r) : null })) };
}

// A table's rows as objects keyed by its column names, checked against the
// names the caller expects when it gives them. A line continues the row
// above where its first cell is empty, or where it stands closer than the
// table's row pitch, its commonest step, by more than a point: rows stand
// 15.1 pt apart, give or take 0.1, and a cell's lines wrap 2.6 pt closer
// ("Bard, Cleric, Druid, Monk," "Rogue, or Warlock"). A table that names its
// columns twice (Dragon, Damage Type, Dragon, Damage Type) is two halves
// side by side, read left half first, as the SRD runs them.
const PITCH_MARGIN = 1;
function table(block, expected) {
  const { names, rows } = grid(block);
  const steps = new Map();
  const step = r => Math.round(r.gap * 2) / 2;
  for (const r of rows) if (Number.isFinite(r.gap)) steps.set(step(r), (steps.get(step(r)) ?? 0) + 1);
  const pitch = [...steps].sort((a, b) => b[1] - a[1])[0]?.[0] ?? Infinity;
  if (expected && names.join(' | ') !== expected.join(' | ')) throw new Error(`a table headed "${names.join(' | ')}", not "${expected.join(' | ')}"`);
  const half = names.length / 2;
  const paired = Number.isInteger(half) && names.slice(0, half).join() === names.slice(half).join();
  const parts = paired ? [[0, half], [half, names.length]] : [[0, names.length]];
  const out = [];
  for (const [a, b] of parts) {
    const mine = [];
    let group = null;
    for (const row of rows) {
      if (row.label) { group = row.label; continue; }
      const r = Object.assign(row.slice(a, b), { group });
      if (r[0] && !(row.gap < pitch - PITCH_MARGIN)) mine.push(r);
      else if (mine.length) r.forEach((c, i) => { if (c) mine.at(-1)[i] = `${mine.at(-1)[i]} ${c}`; });
      else if (r.some(Boolean)) throw new Error(`table "${names.join(' | ')}": a row with no first cell`);
    }
    out.push(...mine.map(r => Object.assign(Object.fromEntries(names.slice(a, b).map((h, i) => [h, r[i]])), r.group ? { group: r.group } : {})));
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

// ---------- the core classes, in the shape euphonia.classes.json gives the
// setting's own, so the builder reads both alike.

// A heading that wraps runs on in the next heading line of its size
// ("Monk Subclass: Warrior of the", "Open Hand").
function heading(i) {
  let text = lines[i].text, k = i + 1;
  while (lines[k]?.kind === lines[i].kind && lines[k].size === lines[i].size) text += ` ${lines[k++].text}`;
  return { text, next: k };
}
// A titled table's lines: the title and the table lines after it in its
// column, to the next line of another kind there; the other column's text
// can fall between them in reading order (the Cleric's traits). And the
// table those lines make.
function tableLines(t) {
  const out = [t];
  for (let k = t + 1; k < lines.length && lines[k].page === lines[t].page; k++) {
    if (lines[k].right !== lines[t].right) continue;
    if (lines[k].kind !== 'table') break;
    out.push(k);
  }
  return out;
}
const titled = t => ({ kind: 'table', lines: tableLines(t).slice(1).map(k => lines[k]) });
// A table in the export's markdown, its wrapped cells joined as table()
// joins them.
// A table set in two halves (Land Type, Resistance, twice) reads as one, its
// halves in turn.
const markdownTable = block => {
  const names = [...new Set(grid(block).names)];
  return [`| ${names.join(' | ')} |`, `|${names.map(() => '---').join('|')}|`, ...table(block).map(r => `| ${names.map(n => r[n]).join(' | ')} |`)].join('\n');
};
// Rules text as the setting's export writes it: paragraphs, a named
// paragraph's name in bold, bullets as a list, a table under its title.
function prose(from, to, skip) {
  const out = [];
  let title = null;
  for (const b of blocks(from, to, skip)) {
    if (b.kind === 'title') { title = b.text; continue; }
    if (b.kind === 'table') { out.push(`${title ? `**${title}**\n\n` : ''}${markdownTable(b)}`); title = null; continue; }
    if (title) { out.push(`**${title}**`); title = null; }
    if (b.kind !== 'para') throw new Error(`a ${b.kind} line "${b.text}" inside rules text`);
    const p = lead(b.text);
    out.push(b.bullet ? `- ${b.text}` : p.name ? `**${p.name}.** ${p.text}` : p.text);
  }
  return out.join('\n\n').replace(/^(- .*)\n\n(?=- )/gm, '$1\n');
}
// A feature list: each "Level N: Name" item and its text, to the next item.
function levelFeatures(from, to, skip) {
  const out = [];
  for (let i = from; i < to; i++) {
    const m = lines[i].kind === 'item' && lines[i].text.match(/^Level (\d+): (.+)$/);
    if (!m) continue;
    out.push({ level: +m[1], name: m[2], text: prose(i + 1, Math.min(nextOf(i, ['item', 'section']), to), skip) });
  }
  return out;
}
// Options a class chooses from, each under a section of its own among its
// features ("Metamagic Options", "Eldritch Invocation Options"): each option
// an item, a first line of cost or prerequisite ("Cost: 1 Sorcery Point",
// "Prerequisite: Level 5+ Warlock"), then its rules. The label is set in
// italic, which reads a few points off the body's lines, so its lines and the
// body's interleave in height: it runs to the first line that steps back up
// the page, where the body begins.
function classOptions(from, to, skip) {
  const out = [];
  for (let i = from; i < to; i++) {
    if (!(lines[i].kind === 'section' && / Options$/.test(lines[i].text))) continue;
    const end = Math.min(nextOf(i, ['section']), to), items = [];
    for (let k = i + 1; k < end; k++) {
      if (lines[k].kind !== 'item') continue;
      const name = heading(k), stop = Math.min(nextOf(k, ['item', 'section']), end);
      let body = name.next, label = null;
      const kind = lines[body]?.text.match(/^(Cost|Prerequisite): /)?.[1];
      if (kind) {
        const own = [lines[body++].text];
        while (body < stop && lines[body].page === lines[body - 1].page && lines[body].right === lines[body - 1].right && lines[body].y > lines[body - 1].y) own.push(lines[body++].text);
        label = { [kind.toLowerCase()]: join(own).slice(kind.length + 2) };
      }
      items.push({ name: name.text, ...label, text: prose(body, stop, skip) });
    }
    if (!items.length) throw new Error(`"${lines[i].text}" has no options`);
    out.push({ title: lines[i].text, items });
  }
  return out;
}
// The spell-slot counts the Multiclassing rules give, class by class: all
// of a class's levels, or half of them rounded as they say.
function slotCounts() {
  const i = lines.findIndex(l => l.text === 'Multiclassing' && l.kind !== 'body');
  const paras = blocks(i + 1, sectionEnd(i));
  const at = paras.findIndex(b => b.kind === 'para' && lead(b.text).name === 'Spell Slots');
  const counts = {};
  for (const b of paras.slice(at + 1)) {
    if (!b.bullet) break;
    const m = b.text.match(/^(All|Half) your levels(?: \(round (up|down)\))? in the (.+) classes?$/);
    if (!m) throw new Error(`a Spell Slots bullet the exporter doesn't read: "${b.text}"`);
    for (const name of m[3].split(/,\s*(?:and\s+)?|\s+and\s+/)) counts[name] = m[1] === 'All' ? { fraction: 1 } : { fraction: 0.5, round: m[2] };
  }
  if (!Object.keys(counts).length) throw new Error('no Spell Slots bullets under Multiclassing');
  return counts;
}
const MULTICLASS_SCORE = (() => {
  const i = lines.findIndex(l => l.text === 'Prerequisites' && l.kind !== 'body');
  const score = blocks(i + 1, sectionEnd(i)).map(b => b.text).join(' ').match(/a score of at least (\d+) in the primary ability of the new class/)?.[1];
  if (!score) throw new Error('the Multiclassing prerequisite didn\'t read');
  return +score;
})();

// A class's traits table: a key, set in SemiBold, may wrap onto rows of its
// own ("Saving Throw" over "Proficiencies"), and so may its value; a row
// with both starts the next trait.
function traitsTable(block) {
  const all = block.lines.flatMap(l => l.words).sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  for (const w of all) {
    if (!rows.length || w.y - rows.at(-1)[0].y > LINE_TOLERANCE) rows.push([]);
    rows.at(-1).push(w);
  }
  const out = [];
  for (const r of rows) {
    const key = r.filter(SEMIBOLD).map(w => w.text).join(' '), value = r.filter(w => !SEMIBOLD(w)).map(w => w.text).join(' ');
    if (key && value) out.push({ trait: [key], value: [value] });
    else if (!out.length) throw new Error(`a traits table that opens on "${key || value}"`);
    else if (key) out.at(-1).trait.push(key);
    else out.at(-1).value.push(value);
  }
  return out.map(t => ({ trait: t.trait.join(' '), value: join(t.value) }));
}

function coreClasses() {
  const start = lines.findIndex(l => l.kind === 'section' && l.text === 'Classes');
  const end = lines.findIndex((l, k) => k > start && l.kind === 'section' && l.size >= lines[start].size);
  // A class is a heading its "Core … Traits" table follows.
  const starts = [];
  for (let i = start + 1; i < end; i++) if (lines[i].kind === 'section' && lines[i + 1]?.text === `Core ${lines[i].text} Traits`) starts.push(i);
  const counts = slotCounts();
  return starts.map((i, n) => {
    const name = lines[i].text, stop = starts[n + 1] ?? end;
    const find = (test, what) => {
      for (let k = i; k < stop; k++) if (test(lines[k])) return k;
      throw new Error(`${name}: no ${what}`);
    };
    const traitsAt = i + 1;
    const featuresTitle = find(l => l.kind === 'title' && l.text === `${name} Features`, `"${name} Features" table`);
    // The class's own tables sit among its features' text; the text runs
    // round them.
    const skip = new Set([...tableLines(traitsAt), ...tableLines(featuresTitle)]);
    const columns = grid(titled(featuresTitle)).names, rows = table(titled(featuresTitle));
    const featuresAt = find(l => l.kind === 'section' && l.text === `${name} Class Features`, `"${name} Class Features"`);
    const subAt = find(l => l.kind === 'section' && l.text.startsWith(`${name} Subclass:`), 'subclass');
    const listAt = lines.findIndex((l, k) => k > i && k < stop && l.kind === 'section' && l.text === `${name} Spell List`);
    const featuresEnd = [listAt, subAt].filter(k => k > featuresAt).sort((a, b) => a - b)[0];
    const traits = traitsTable(titled(traitsAt));
    // Becoming one: as a level 1 character, and as a multiclass character.
    const multiAt = find(l => l.kind === 'item' && l.text === 'As a Multiclass Character', '"As a Multiclass Character"');
    const multi = blocks(multiAt + 1, nextOf(multiAt, ['item', 'section']), skip).filter(b => b.bullet).map(b => b.text);
    // "Gain the following traits from the Core X Traits table: A, B, and C.",
    // or "Gain the Hit Point Die (trait) from the Core X Traits table."
    const gains = multi.map(t => t.match(/^Gain (?:the following traits? from the Core .+ Traits table: (.+)|the (.+?)(?: trait)? from the Core .+ Traits table)\.$/)).filter(Boolean).map(m => m[1] ?? m[2])[0];
    if (!gains) throw new Error(`${name}: its multiclass bullets don't say what traits it gains`);
    const primary = traits.find(t => t.trait === 'Primary Ability')?.value ?? '';
    const abilities = primary.split(/,\s*(?:or\s+|and\s+)?|\s+(?:or|and)\s+/);
    // The subclass: its name, wrapped or not; a line of tagline; its lead;
    // its features.
    const sub = heading(subAt);
    const subFeatures = lines.findIndex((l, k) => k >= sub.next && l.kind === 'item');
    const spells = listAt < 0 ? null : (() => {
      const out = {};
      for (let k = listAt; k < (subAt > listAt ? subAt : stop); k++) {
        const m = lines[k].kind === 'title' && lines[k].text.match(/^(?:Cantrips \(Level 0 .+ Spells\)|Level (\d) .+ Spells)$/);
        if (!m) continue;
        out[+(m[1] ?? 0)] = table(titled(k), ['Spell', 'School', 'Special']).map(r => ({ name: r.Spell, school: r.School, special: r.Special }));
      }
      return out;
    })();
    return {
      name,
      traits,
      table: { columns, rows },
      features: levelFeatures(featuresAt + 1, featuresEnd ?? subAt, skip),
      options: classOptions(featuresAt + 1, featuresEnd ?? subAt, skip),
      subclasses: [{
        name: sub.text.replace(`${name} Subclass: `, ''),
        lead: prose(sub.next, subFeatures, skip),
        features: levelFeatures(subFeatures, stop, skip),
      }],
      spells,
      multiclass: {
        abilities, any: /\bor\b/.test(primary), score: MULTICLASS_SCORE,
        gains, spell_slots: counts[name] ?? null, text: multi.join('\n'),
      },
    };
  });
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

// ---------- hit points by class: a table that names classes in groups
// ("Fighter, Paladin, or Ranger"), as a number for each class.
function hitPoints(title, column) {
  const out = {};
  for (const r of titledTable(title, ['Class', column])) {
    const n = r[column].match(/^(\d+) \+ Con\. modifier$/)?.[1];
    if (!n) throw new Error(`${title}: "${r[column]}"`);
    for (const c of r.Class.split(/,\s*(?:or\s+)?|\s+or\s+/)) out[c] = +n;
  }
  return out;
}

// ---------- the background's increases, from its paragraph under "Parts of
// a Background": one score by 2 and another by 1, or all three by 1, none
// above 20.
function backgroundIncreases() {
  const i = findLine('section', 'Parts of a Background');
  const k = lines.findIndex((l, n) => n > i && l.text === 'Ability Scores' && l.kind !== 'body');
  const text = blocks(k + 1, nextOf(k, ['item', 'title', 'section'])).map(b => b.text).join(' ');
  const m = text.match(/Increase one by (\d+) and another one by (\d+), or increase all three by (\d+)\. None of these increases can raise a score above (\d+)\./);
  if (!m) throw new Error(`the background's increases didn't read: "${text}"`);
  return { choices: [[+m[1], +m[2]], [+m[3], +m[3], +m[3]]], max: +m[4] };
}

// ---------- armour: the Armor table's rows under its category rows ("Light
// Armor (1 Minute to Don or Doff)"), each AC as the table writes it ("11 +
// Dex modifier", "14 + Dex modifier (max 2)", "16", "+2").
// An amount in gold pieces as the SRD writes it ("1,500 GP", "10 GP").
const gold = (text, where) => {
  const m = text.match(/^([\d,]+) GP$/i);
  if (!m) throw new Error(`${where}: a price the exporter doesn't read: "${text}"`);
  return +m[1].replace(/,/g, '');
};
// A weight in pounds as the tables set it ("8 lb.", "1½ lb.", "1/4 lb.",
// "1,320 lb.", a Waterskin's "5 lb. (full)"); a dash is nothing worth weighing, and "Varies" no one
// weight (null).
const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75 };
const pounds = (text, where) => {
  if (text === '—') return 0;
  if (text === 'Varies') return null;
  const m = text.match(/^(?:([\d,]+)?([½¼¾])?|(\d+)\/(\d+)) lb\.(?: \(\w+\))?$/);
  if (!m || !(m[1] || m[2] || m[3])) throw new Error(`${where}: a weight the exporter doesn't read: "${text}"`);
  return m[3] ? m[3] / m[4] : +(m[1] ?? '0').replace(/,/g, '') + (FRACTIONS[m[2]] ?? 0);
};
function armor() {
  const t = lines.findIndex((l, k) => l.kind === 'title' && l.text === 'Armor' && lines[k + 1]?.kind === 'table');
  if (t < 0) throw new Error('the SRD has no Armor table');
  const out = [];
  for (const r of table(titled(t), ['Armor', 'Armor Class (AC)', 'Strength', 'Stealth', 'Weight', 'Cost'])) {
    const category = r.group?.match(/^(Light|Medium|Heavy) Armor \(|^(Shield) \(/)?.slice(1).find(Boolean);
    if (!category) throw new Error(`armor "${r.Armor}" under no category ("${r.group}")`);
    const ac = r['Armor Class (AC)'].match(/^(\+)?(\d+)(?: \+ Dex modifier(?: \(max (\d+)\))?)?$/);
    if (!ac) throw new Error(`armor "${r.Armor}": an Armor Class the exporter doesn't read: "${r['Armor Class (AC)']}"`);
    out.push({
      name: r.Armor, category,
      ...(ac[1] ? { bonus: +ac[2] } : { base: +ac[2], dex: /Dex modifier/.test(r['Armor Class (AC)']), dex_max: ac[3] ? +ac[3] : null }),
      strength: +(r.Strength.match(/^Str (\d+)$/)?.[1] ?? 0) || null,
      stealth_disadvantage: r.Stealth === 'Disadvantage',
      // Its price in gold ("1,500 GP"), what a character buys it with.
      cost: gold(r.Cost, `armor "${r.Armor}"`), weight: pounds(r.Weight, `armor "${r.Armor}"`),
    });
  }
  return out;
}

// ---------- weapons: the Weapons table's rows under their category rows
// ("Simple Melee Weapons"), each with its properties as a list ("Finesse,
// Light, Thrown (Range 20/60)") and its mastery property.
function weapons() {
  const t = lines.findIndex((l, k) => l.kind === 'title' && l.text === 'Weapons' && lines[k + 1]?.kind === 'table');
  if (t < 0) throw new Error('the SRD has no Weapons table');
  return table(titled(t), ['Name', 'Damage', 'Properties', 'Mastery', 'Weight', 'Cost']).map(r => {
    const group = r.group?.match(/^(Simple|Martial) (Melee|Ranged) Weapons$/);
    if (!group) throw new Error(`weapon "${r.Name}" under no category ("${r.group}")`);
    return { name: r.Name, category: group[1], range: group[2], damage: r.Damage, properties: r.Properties === '—' ? [] : r.Properties.split(/,\s*(?![^(]*\))/), mastery: r.Mastery, weight: pounds(r.Weight, `weapon "${r.Name}"`) };
  });
}

// ---------- tools: the Artisan's Tools and the Other Tools, each an item
// with its price in brackets ("Alchemist’s Supplies (50 GP)"), then its
// entries, a line or more each: Ability, Utilize, Craft, and Variants where
// it has them (a Gaming Set's dice and cards, each "a separate proficiency").
function tools() {
  const out = [];
  for (const [title, category] of [['Artisan’s Tools', 'Artisan’s Tools'], ['Other Tools', 'Other']]) {
    const from = lines.findIndex(l => l.kind === 'section' && l.text === title);
    if (from < 0) throw new Error(`the SRD has no ${title}`);
    const to = lines.findIndex((l, k) => k > from && l.kind === 'section');
    for (let i = from + 1; i < to; i++) {
      const head = lines[i].kind === 'item' && lines[i].text.match(/^(.+?) \((?:[\d,]+ [GSC]P|Varies)\)$/);
      if (!head) continue;
      const end = lines.findIndex((l, k) => k > i && l.kind !== 'table');
      // A word broken across a line ("dul-", "cimer") is the typesetter's,
      // here always: a tool's entries break no compound at a line's end.
      const text = lines.slice(i + 1, end).map(l => l.text).reduce((all, t) => (/\p{L}-$/u.test(all) && /^\p{Ll}/u.test(t) ? all.slice(0, -1) + t : `${all} ${t}`));
      const entry = label => text.match(new RegExp(`${label}: (.+?)(?= (?:Weight|Utilize|Craft|Variants):|$)`))?.[1].trim() ?? null;
      const ability = entry('Ability');
      if (!ability) throw new Error(`the tool "${head[1]}" has no Ability`);
      const variants = entry('Variants')?.split(/,\s*(?![^(]*\))/).map(v => v.replace(/ \(.*\)$/, '').replace(/^\w/, c => c.toUpperCase()));
      const weight = entry('Weight');
      out.push({ name: head[1], category, ability, weight: weight ? pounds(weight, `the tool "${head[1]}"`) : null, utilize: entry('Utilize'), craft: entry('Craft'), ...(variants ? { variants } : {}) });
    }
  }
  return out;
}

// ---------- beasts: every Beast stat block (a Druid's Wild Shape forms come
// from them), each a 14.8 pt heading, then its size and type ("Large Beast
// (Dinosaur), Unaligned"), its Speed ("Speed 40 ft., Fly 60 ft.") and its
// Challenge Rating ("CR 1/4 (XP 50; PB +2)"), in the lines set beside it.
const STAT_BLOCK_PT = 14.8;
function beasts() {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].kind !== 'section' || Math.abs(lines[i].size - STAT_BLOCK_PT) > 0.05) continue;
    const block = [];
    for (let k = i + 1; k < lines.length && !(lines[k].kind === 'section'); k++) if (lines[k].kind === 'aside') block.push(lines[k].text);
    const type = block[0]?.match(/^(Tiny|Small|Medium|Large|Huge|Gargantuan) (\w+)/);
    if (type?.[2] !== 'Beast') continue;
    // A spell's creature (Giant Insect) has no Challenge Rating, and Wild
    // Shape counts its forms by theirs.
    const speed = block.find(t => /^Speed /.test(t)), cr = block.find(t => /^CR /.test(t))?.match(/^CR ([\d/]+)/)?.[1];
    if (!cr) continue;
    if (!speed) throw new Error(`the Beast "${lines[i].text}" has no Speed`);
    const [num, den] = cr.split('/').map(Number);
    out.push({ name: lines[i].text, size: type[1], cr, challenge: den ? num / den : num, speed: speed.replace(/^Speed /, ''), fly: /\bFly \d/.test(speed), swim: /\bSwim \d/.test(speed) });
  }
  if (!out.length) throw new Error('the SRD has no Beasts');
  return out;
}

// ---------- spells: each spell's level, school and casting time, and the
// damage types its text deals ("takes 1d10 Fire damage"), for the rules that
// turn on them (an Attunement's spells "that deal your attuned damage
// type", Spell Mastery's "casting time of an action"). Each is an item, then
// its line ("Level 3 Evocation (Sorcerer, Wizard)", "Evocation Cantrip
// (…)"), its Casting Time, and its text to the next item.
const DAMAGE = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];
// Damage dealt, not resisted: dice, or "takes", "take" or "deals", before the
// type in its clause ("takes 3d6 Fire damage", "an extra 1d6 Radiant
// damage"); "Immunity to Poison and Psychic damage" (Wall of Stone) isn't.
const dealt = d => new RegExp(`(?:\\d+d\\d+|\\btakes?\\b|\\bdeals?\\b|\\bdealing\\b)[^.;]{0,40}?\\b${d} damage`);
function spells() {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].kind !== 'item') continue;
    // A long list of classes wraps its line onto the next ("… Druid,",
    // "Paladin, Ranger)").
    let k = i + 1, line = lines[k]?.text ?? '';
    while (/^(?:Level \d \w+|\w+ Cantrip) \([^)]*$/.test(line) && lines[k + 1]) line += ` ${lines[++k].text}`;
    const head = line.match(/^(?:Level (\d) (\w+)|(\w+) Cantrip) \((.+)\)$/);
    if (!head) continue;
    const end = nextOf(i, ['item', 'section']);
    const text = join(lines.slice(k + 1, end).map(l => l.text));
    const casting = text.match(/Casting Time: (.+?) Range:/)?.[1];
    if (!casting) throw new Error(`the spell "${lines[i].text}" has no Casting Time`);
    // What a sheet needs to list it as an attack: its range, the spell
    // attack it makes or the save it forces, the damage its first effect
    // deals ("takes 1d10 Fire damage", "1d8 damage of a type you choose"),
    // and a cantrip's growth, in the five forms the SRD writes it: the damage
    // increases ("5 (2d10), 11 (3d10), and 17 (4d10)"), its die changes
    // (Shillelagh), it adds damage (True Strike), its range doubles (Spare
    // the Dying), or it makes more beams.
    const range = text.match(/Range: (.+?) Components?:/)?.[1];
    if (!range) throw new Error(`the spell "${lines[i].text}" has no Range`);
    const attack = text.match(/\b[Mm]ake an? (melee|ranged) spell attack\b/)?.[1] ?? null;
    // A spell of range Self that throws something has its own reach ("hurl
    // fire at a creature or an object within 60 feet of you").
    const reach = range === 'Self' && attack ? text.match(/within (\d+ feet) of you/)?.[1] ?? null : null;
    const save = text.match(/\b(?:succeed on|make|makes) an? (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw\b/)?.[1] ?? null;
    const hit = text.match(/\btakes? (\d+d\d+) (?:(\w+) damage|damage of a type you choose)/);
    const growth = text.match(/Cantrip Upgrade\. (.+?) when you reach levels (\d+) \(([^)]+)\), (\d+) \(([^)]+)\), and (\d+) \(([^)]+)\)\./);
    const beams = text.match(/Cantrip Upgrade\. The spell creates (\w+) beams at level (\d+), (\w+) beams at level (\d+), and (\w+) beams at level (\d+)\./);
    const kind = growth && (/^The damage increases by /.test(growth[1]) ? 'dice' : /^The damage die changes$/.test(growth[1]) ? 'die' : /extra \w+ damage$/.test(growth[1]) ? 'extra' : /^The range doubles$/.test(growth[1]) ? 'range' : null);
    if (/Cantrip Upgrade\./.test(text) && !(kind || beams)) throw new Error(`the cantrip "${lines[i].text}" grows in a way the export can't read`);
    const upgrade = kind ? { kind, steps: [[+growth[2], growth[3]], [+growth[4], growth[5]], [+growth[6], growth[7]]] }
      : beams ? { kind: 'beams', steps: [[+beams[2], wordNumber(beams[1])], [+beams[4], wordNumber(beams[3])], [+beams[6], wordNumber(beams[5])]] } : null;
    out.push({ name: lines[i].text, level: head[1] ? +head[1] : 0, school: head[2] ?? head[3], classes: head[4].split(/,\s*/), casting, damage: DAMAGE.filter(d => dealt(d).test(text)),
      range, reach, attack, save, dice: hit ? { dice: hit[1], type: hit[2] ?? null } : null, upgrade });
  }
  if (!out.length) throw new Error('the SRD has no spells');
  return out;
}

// ---------- attacks: how a character's attack and damage rolls are made,
// from the SRD's own rules: the Attack Roll Abilities table (Strength for a
// melee attack with a weapon or an Unarmed Strike, Dexterity for a ranged
// one), the Proficiency Bonus with a weapon one is proficient with, the same
// modifier added to damage, Finesse's choice and a thrown Melee weapon's
// melee ability, the Unarmed Strike's bonus and damage, and the spell save
// DC and attack modifier.
// The whole text, paragraph by paragraph (joining it at once is slow), the
// sidebars blocks() counts as it goes counted once, by the classes.
let whole = null;
function wholeText() {
  if (whole) return whole;
  const counted = asides;
  whole = blocks(0, lines.length).filter(b => b.text).map(b => b.text).join(' ');
  asides = counted;
  return whole;
}
function attackRules() {
  const text = wholeText();
  const need = (re, what) => { const m = text.match(re); if (!m) throw new Error(`the SRD's ${what} didn't read`); return m; };
  const rows = titledTable('Attack Roll Abilities', ['Ability', 'Attack Type']);
  const by = re => { const r = rows.find(x => re.test(x['Attack Type'])); if (!r) throw new Error(`the Attack Roll Abilities table has no row for ${re}`); return r.Ability; };
  need(/You add your Proficiency Bonus to your attack roll when you attack using a weapon you have proficiency with, as well as when you attack with a spell\./, 'Proficiency Bonus on attack rolls');
  need(/you add your ability modifier—the same modifier used for the attack roll—to the damage roll\./, 'damage roll modifier');
  const finesse = need(/When making an attack with a Finesse weapon, use your choice of your (\w+) or (\w+) modifier for the attack and damage rolls\./, 'Finesse property');
  need(/If the weapon is a Melee weapon, use the same ability modifier for the attack and damage rolls that you use for a melee attack/, 'Thrown property');
  const unarmed = need(/Your bonus to the roll equals your (\w+) modifier plus your Proficiency Bonus\. On a hit, the target takes (\w+) damage equal to (\d+) plus your \1 modifier\./, 'Unarmed Strike');
  const dc = need(/Spell save DC = (\d+) \+ your spellcasting ability modifier \+ your Proficiency Bonus/, 'spell save DC');
  need(/Spell attack modifier = your spellcasting ability modifier \+ your Proficiency Bonus/, 'spell attack modifier');
  return { melee: by(/^Melee attack with a weapon/), ranged: by(/^Ranged attack with a weapon/), finesse: [finesse[1], finesse[2]],
    unarmed: { ability: unarmed[1], type: unarmed[2], base: +unarmed[3] }, spell_save_dc_base: +dc[1] };
}

// ---------- languages: the rule a character starts by ("Common plus two
// languages you roll or choose from the Standard Languages table"), and both
// tables' languages, the rare table set in two halves.
function languages() {
  const text = lines.map(l => l.text).join(' ');
  const m = text.match(/Your character knows at least (\w+) languages: (\w+) plus (\w+) languages you roll or choose from the Standard Languages table\./);
  if (!m) throw new Error('the starting languages\' rule didn\'t read');
  const named = (title, headers, column) => {
    const t = findLine('title', title);
    return table(titled(t), headers).flatMap(r => column(r)).map(n => n.replace(/\*$/, '')).filter(Boolean);
  };
  const standard = named('Standard Languages', ['1d12', 'Language'], r => [r.Language]);
  const rare = named('Rare Languages', ['Language', 'Language'], r => [r.Language]);
  return { rule: m[0], known: [m[2]], choose: { count: m[3], from: 'Standard Languages' }, standard, rare };
}

// The Armor table's Strength column, in its own sentence: "that armor
// reduces the wearer’s speed by 10 feet unless the wearer has a Strength
// score equal to or higher than the listed score".
function armorStrengthPenalty() {
  const text = lines.map(l => l.text).join(' ');
  const m = text.match(/that armor reduces the wearer’s speed by (\d+) feet unless the wearer has a Strength score equal to or higher than the listed score/);
  if (!m) throw new Error('the Armor table\'s Strength rule didn\'t read');
  return +m[1];
}

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
function holdsToSource({ species: sp, feats: ft, backgrounds: bg, classes: cl }) {
  const flat = t => t.replace(/-/g, '').replace(/\s+/g, ' ').replace(/\b(\p{L}+) (\p{L})\b/gu, '$1$2').toLowerCase();
  // Titled tables and sidebars aren't held here, so the text runs on round
  // them as the export's does.
  const tabled = new Set(lines.flatMap((l, k) => (l.kind === 'title' && lines[k + 1]?.kind === 'table' ? tableLines(k) : [])));
  const source = flat(lines.filter((l, k) => !tabled.has(k) && l.kind !== 'aside').map(l => l.text).reduce((all, t) => (all.endsWith('-') ? all + t : `${all} ${t}`), ''));
  const runs = [];
  const paras = (where, name, text) => text.split('\n\n').forEach((p, i) => runs.push([where, i === 0 && name ? `${name}. ${p}` : p]));
  for (const s of sp) {
    runs.push([s.name, s.lead], [s.name, `Creature Type: ${s.creature_type}`, true], [s.name, `Size: ${s.size}`, true], [s.name, `Speed: ${s.speed}`, true]);
    for (const t of s.traits) { paras(`${s.name}, ${t.name}`, t.name, t.text); for (const o of t.options ?? []) paras(`${s.name}, ${o.name}`, o.name, o.text); }
  }
  for (const f of ft) { if (f.description) paras(f.name, null, f.description); for (const b of f.benefits) paras(`${f.name}, ${b.name}`, b.name, b.text); }
  for (const b of bg) runs.push([b.name, b.tool, true], [b.name, b.equipment, true]);
  // A class's rules text, paragraph by paragraph, with the markup it was
  // given taken off: bold names and list marks. Tables, its traits among
  // them, are read in an order that interleaves their cells, so the gate
  // holds them instead.
  const unmarked = md => md.split('\n\n').filter((p, i, all) => !p.startsWith('|') && !(/^\*\*[^*]+\*\*$/.test(p) && all[i + 1]?.startsWith('|')))
    .flatMap(p => p.split('\n')).map(p => [p.replace(/^- /, '').replace(/^\*\*(.+?)\*\* /, '$1 ').replace(/^\*\*(.+)\*\*$/, '$1'), p.startsWith('- ') || /^\*\*[^*]+\*\*$/.test(p)]);
  for (const c of cl) {
    for (const f of [...c.features, ...c.subclasses.flatMap(s => [{ name: s.name, text: s.lead }, ...s.features])]) {
      for (const [p, item] of unmarked(f.text)) runs.push([`${c.name}, ${f.name}`, p, item]);
    }
    for (const o of c.options.flatMap(x => x.items)) {
      for (const [label, value] of [['Cost', o.cost], ['Prerequisite', o.prerequisite]]) if (value) runs.push([`${c.name}, ${o.name}`, `${label}: ${value}`, true]);
      for (const [p, item] of unmarked(o.text)) runs.push([`${c.name}, ${o.name}`, p, item]);
    }
    for (const t of c.multiclass.text.split('\n')) runs.push([`${c.name}, As a Multiclass Character`, t, true]);
  }
  const astray = runs.filter(([, t]) => !source.includes(flat(t)));
  // A paragraph split in two leaves halves the text holds; the first stops
  // mid-sentence. A list's items and a label's value needn't end as
  // sentences do.
  for (const [where, t, item] of runs) if (!item && t && !/[.:!?”)]$/.test(t)) astray.push([where, `…${t.slice(-50)} (stops mid-sentence)`]);
  if (astray.length) throw new Error(`${astray.length} paragraph(s) not in the SRD as read: ${astray.map(([w, t]) => `${w}: "${t.slice(0, 50)}"`).join('; ')}`);
  console.log(`${runs.length} paragraphs, each found in the SRD's own text and ending as it ends; ${asides} sidebars left out`);
}

const pdf = readFileSync(pdfPath);
const data = {
  provenance: {
    source: 'System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, licensed under the Creative Commons Attribution 4.0 International License',
    url: 'https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf',
    license: 'https://creativecommons.org/licenses/by/4.0/legalcode',
    sha256: createHash('sha256').update(pdf).digest('hex'),
    fetched: '2026-11-01',
    extracted: 'Words with their positions and fonts (scripts/srd-words.swift), parsed by scripts/euphonia-srd.mjs; nothing typed. Sidebars, commentary set apart from the rules, are left out of the classes.',
  },
  ...(() => {
    const changes = [];
    const read = { backgrounds: backgrounds(), species: species(), feats: feats(), classes: coreClasses(), spells: spells() };
    holdsToSource(read);
    const content = adapt(read, '', changes);
    return { adapted: { rule: 'euphonia.rules.json fey_type', changes }, ...content };
  })(),
  ability_scores: { ...scoreMethods(), background: backgroundIncreases() },
  armor: { items: armor(), strength_speed_penalty: armorStrengthPenalty() },
  weapons: weapons(),
  tools: tools(),
  beasts: beasts(),
  languages: languages(),
  hit_points: { level_1: hitPoints('Level 1 Hit Points by Class', 'Hit Point Maximum'), fixed: hitPoints('Fixed Hit Points by Class', 'Hit Points per Level') },
  tables: {
    advancement: titledTable('Character Advancement', ['Level', 'Experience Points', 'Proficiency Bonus']),
    skills: titledTable('Skills', ['Skill', 'Ability', 'Example Uses']),
    point_costs: titledTable('Ability Score Point Costs', ['Score', 'Cost', 'Score', 'Cost']),
    ability_modifiers: titledTable('Ability Scores and Modifiers', ['Score', 'Modifier', 'Score', 'Modifier']),
    multiclass_slots: titledTable('Multiclass Spellcaster:', ['Level', ...LEVELS]),
    higher_level_equipment: titledTable('Starting Equipment at Higher Levels', ['Starting Level', 'Equipment and Money', 'Magic Items']),
    damage_types: titledTable('Damage Types', ['Type', 'Examples']),
  },
  // What things weigh, and what a character can carry: the Adventuring Gear
  // and Ammunition tables, and the Carrying Capacity table's multiples of the
  // Strength score by size ("Small/Medium | Str. × 15 lb.").
  gear: titledTable('Adventuring Gear', ['Item', 'Weight', 'Cost']).map(r => ({ name: r.Item, weight: pounds(r.Weight, `gear "${r.Item}"`) })),
  // A focus or symbol's forms, each its own weight ("Arcane Focus (crystal)").
  forms: Object.fromEntries([['Arcane Focus', 'Arcane Focuses', 'Focus'], ['Holy Symbol', 'Holy Symbols', 'Symbol'], ['Druidic Focus', 'Druidic Focuses', 'Focus']].map(([item, title, column]) =>
    [item, titledTable(title, [column, 'Weight', 'Cost']).map(r => ({ name: r[column].replace(/ \(.*\)$/, ''), also: r[column].match(/\(also an? (.+?)\)$/)?.[1] ?? null, weight: pounds(r.Weight, `${item} "${r[column]}"`) }))])),
  coins_per_pound: wordNumber(wholeText().match(/so (\w+) coins weigh a pound/)?.[1] ?? 'none'),
  ammunition: titledTable('Ammunition', ['Type', 'Amount', 'Storage', 'Weight', 'Cost']).map(r => ({ name: r.Type, amount: +r.Amount, storage: r.Storage, weight: pounds(r.Weight, `ammunition "${r.Type}"`) })),
  // What carrying more than the most means ("your Speed can be no more than
  // 5 feet").
  overloaded: wholeText().match(/While dragging, lifting, or pushing weight in ex?cess of the maximum weight you can carry, your Speed can be no more than (\d+) feet\./)?.[0] ?? (() => { throw new Error('the Carrying Capacity rule didn\'t read'); })(),
  carrying: titledTable('Carrying Capacity', ['Creature Size', 'Carry', 'Drag/Lift/Push']).map(r => {
    const times = t => +t.match(/^Str\. × ([\d.]+) lb\.$/)?.[1] || (() => { throw new Error(`Carrying Capacity: "${t}"`); })();
    return { sizes: r['Creature Size'].split('/'), carry: times(r.Carry), drag: times(r['Drag/Lift/Push']) };
  }),
  attacks: attackRules(),
};
writeFileSync(OUT, `${JSON.stringify(data, null, 1)}\n`);
console.log(`euphonia.srd.json: ${data.classes.length} classes (${data.classes.reduce((n, c) => n + c.features.length, 0)} features), ${data.backgrounds.length} backgrounds, ${data.species.length} species (${data.species.reduce((n, s) => n + s.traits.length, 0)} traits), ${data.feats.length} feats`);
