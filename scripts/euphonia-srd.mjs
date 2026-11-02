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
  const [page, x, y, width, size, font, text] = l.split('\t');
  return { page: +page, x: +x, y: +y, width: +width, size: +size, font, text };
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
  const cols = groups(rows[heads - 1]).map(g => ({ left: g[0].x, right: right(g.at(-1)), above: [], words: g.map(w => w.text) }));
  for (const r of rows.slice(0, heads - 1)) {
    for (const g of groups(r)) {
      const over = cols.filter(c => g[0].x < c.right && right(g.at(-1)) > c.left);
      if (over.length === 1) { over[0].above.push(...g.map(w => w.text)); over[0].left = Math.min(over[0].left, g[0].x); }
    }
  }
  const names = cols.map(c => [...c.above, ...c.words].join(' '));
  const colOf = w => { const mid = w.x + w.width / 2; let k = 0; cols.forEach((c, i) => { if (c.left <= mid) k = i; }); return k; };
  // A range takes no space around its dash (12–13), but kerning can split
  // one into two words ("10", "–11").
  const cell = ws => ws.map(w => w.text).join(' ').replace(/(\d) ([–—]\d)/g, '$1$2');
  return { names, rows: rows.slice(heads).map(r => names.map((n, i) => cell(r.filter(w => colOf(w) === i)))) };
}

// A table's rows as objects keyed by its column names, checked against the
// names the caller expects when it gives them. A table that names its
// columns twice (Dragon, Damage Type, Dragon, Damage Type) is two halves
// side by side, read left half first, as the SRD runs them.
function table(block, expected) {
  const { names, rows } = grid(block);
  if (expected && names.join(' | ') !== expected.join(' | ')) throw new Error(`a table headed "${names.join(' | ')}", not "${expected.join(' | ')}"`);
  const half = names.length / 2;
  const paired = Number.isInteger(half) && names.slice(0, half).join() === names.slice(half).join();
  const parts = paired ? [[0, half], [half, names.length]] : [[0, names.length]];
  const out = [];
  for (const [a, b] of parts) {
    const mine = [];
    for (const r of rows.map(g => g.slice(a, b))) {
      if (r[0]) mine.push(r);
      else if (mine.length) r.forEach((c, i) => { if (c) mine.at(-1)[i] = `${mine.at(-1)[i]} ${c}`; });
      else if (r.some(Boolean)) throw new Error(`table "${names.join(' | ')}": a row with no first cell`);
    }
    out.push(...mine.map(r => Object.fromEntries(names.slice(a, b).map((h, i) => [h, r[i]]))));
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
const markdownTable = ({ names, rows }) => [`| ${names.join(' | ')} |`, `|${names.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n');
// Rules text as the setting's export writes it: paragraphs, a named
// paragraph's name in bold, bullets as a list, a table under its title.
function prose(from, to, skip) {
  const out = [];
  let title = null;
  for (const b of blocks(from, to, skip)) {
    if (b.kind === 'title') { title = b.text; continue; }
    if (b.kind === 'table') { out.push(`${title ? `**${title}**\n\n` : ''}${markdownTable(grid(b))}`); title = null; continue; }
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
    const read = { backgrounds: backgrounds(), species: species(), feats: feats(), classes: coreClasses() };
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
console.log(`euphonia.srd.json: ${data.classes.length} classes (${data.classes.reduce((n, c) => n + c.features.length, 0)} features), ${data.backgrounds.length} backgrounds, ${data.species.length} species (${data.species.reduce((n, s) => n + s.traits.length, 0)} traits), ${data.feats.length} feats`);
