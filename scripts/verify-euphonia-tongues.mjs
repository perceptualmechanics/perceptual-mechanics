import { readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { brotliDecompressSync } from 'node:zlib';
import { euphoniaData } from './verify-euphonia.mjs';
import { injectEuphonia } from './euphonia-page.js';
import { THEMES } from '../src/euphonia/euphonia.themes.js';

const ROOT = new URL('../', import.meta.url);
const read = rel => readFileSync(new URL(rel, ROOT), 'utf8');
const FONTS = 'public/fonts/euphonia/';

export const tonguesData = () => JSON.parse(read('src/euphonia/euphonia.tongues.json'));

// The code points a WOFF2 font maps, read from its cmap. WOFF2 stores the
// tables, in directory order and unpadded, as one Brotli stream; only glyf
// and loca are transformed, and cmap is neither.
export function woff2Cmap(buf) {
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error('not WOFF2');
  const numTables = buf.readUInt16BE(12), compressed = buf.readUInt32BE(20);
  let p = 48;
  const base128 = () => { let v = 0; for (let i = 0; i < 5; i++) { const b = buf[p++]; v = v * 128 + (b & 127); if (!(b & 128)) return v; } throw new Error('bad UIntBase128'); };
  let offset = 0, cmap = null;
  for (let i = 0; i < numTables; i++) {
    const flags = buf[p++], index = flags & 63, version = flags >> 6;
    if (index === 63) p += 4;
    const length = base128();
    // glyf (10) and loca (11) are transformed unless version 3; others only if nonzero.
    const transformed = index === 10 || index === 11 ? version !== 3 : version !== 0;
    const stored = transformed ? base128() : length;
    if (index === 0) cmap = { offset, length };
    offset += stored;
  }
  if (!cmap) throw new Error('no cmap');
  const t = brotliDecompressSync(buf.subarray(p, p + compressed)).subarray(cmap.offset, cmap.offset + cmap.length);
  const points = new Set();
  for (let i = 0, n = t.readUInt16BE(2); i < n; i++) {
    const at = t.readUInt32BE(4 + i * 8 + 4), format = t.readUInt16BE(at);
    if (format === 4) {
      const seg = t.readUInt16BE(at + 6) / 2, ends = at + 14, starts = ends + 2 * seg + 2, deltas = starts + 2 * seg, ranges = deltas + 2 * seg;
      for (let s = 0; s < seg; s++) {
        const end = t.readUInt16BE(ends + 2 * s), start = t.readUInt16BE(starts + 2 * s), delta = t.readUInt16BE(deltas + 2 * s), range = t.readUInt16BE(ranges + 2 * s);
        for (let c = start; c <= end && c !== 0xFFFF; c++) {
          const glyph = range ? t.readUInt16BE(ranges + 2 * s + range + 2 * (c - start)) : c;
          if (glyph && (glyph + delta) & 0xFFFF) points.add(c);
        }
      }
    } else if (format === 12) {
      for (let g = 0, groups = t.readUInt32BE(at + 12); g < groups; g++) {
        const start = t.readUInt32BE(at + 16 + g * 12), end = t.readUInt32BE(at + 20 + g * 12);
        for (let c = start; c <= end; c++) points.add(c);
      }
    }
  }
  return points;
}

// How alike two words look on the ribbons, from 0 to 1: in one script, half
// for the script and half for how near their spellings are; across scripts,
// how near their romanisations are, so εὐφωνία counts as kin to eufonia.
// Spellings are compared in capitals without marks, as the ribbons set them.
const look = w => [...w.normalize('NFD').replace(/\p{M}/gu, '').toLocaleUpperCase().replace(/[^\p{L}]/gu, '')];
const near = (a, b) => {
  const x = look(a), y = look(b), row = [...y.keys(), y.length];
  for (let i = 1; i <= x.length; i++) {
    let diag = row[0]; row[0] = i;
    for (let j = 1; j <= y.length; j++) { const up = row[j]; row[j] = Math.min(up + 1, row[j - 1] + 1, diag + (x[i - 1] !== y[j - 1])); diag = up; }
  }
  return 1 - row[y.length] / Math.max(x.length, y.length);
};
export const alike = (a, b) => Math.max(a.script === b.script ? 0.5 + 0.5 * near(a.word, b.word) : 0, near(a.roman ?? a.word, b.roman ?? b.word));
// Words this alike or more read as the same word twice.
export const LOOKALIKE = 0.75;

// The ribbons' line, ordered so words that look alike stand far apart. The
// line loops, so distance runs around it. Each pair costs its likeness
// squared over its distance squared; from the book's order, single moves and
// swaps are taken while any lowers the total, which settles in a few passes
// and always the same way.
export function ribbonOrder(words) {
  const n = words.length, like = new Float64Array(n * n), fall = new Float64Array(n);
  words.forEach((a, i) => words.forEach((b, j) => { like[i * n + j] = alike(a, b) ** 2; }));
  for (let g = 1; g < n; g++) fall[g] = 1 / Math.min(g, n - g) ** 2;
  const cost = o => { let c = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) c += like[o[i] * n + o[j]] * fall[j - i]; return c; };
  let order = [...words.keys()], best = cost(order), moved = true;
  while (moved) {
    moved = false;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const shift = [...order]; shift.splice(j, 0, ...shift.splice(i, 1));
      const swap = [...order]; [swap[i], swap[j]] = [swap[j], swap[i]];
      for (const o of [shift, swap]) { const c = cost(o); if (c < best) { best = c; order = o; moved = true; } }
    }
  }
  return order.map(k => words[k]);
}

// The code points each shipped face maps, and those of some characters that
// none does.
const shippedMaps = () => readdirSync(new URL(FONTS, ROOT)).filter(f => f.endsWith('.woff2')).map(f => woff2Cmap(readFileSync(new URL(FONTS + f, ROOT))));
const bareOf = (chars, maps) => chars.filter(c => !maps.some(m => m.has(c.codePointAt(0)))).map(c => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ');

// The faces euphonia.css declares, by file and family, and the families each
// theme's type stack names (euphonia.themes.json): a face in no stack would
// ship and never set a word. `stack` is the reference theme's, the order a
// character falls through on the page as it ships.
const named = type => [...type.matchAll(/'([^']+)'/g)].map(m => m[1]);
export function declaredFaces(css = read('styles/euphonia.css'), themes = THEMES) {
  const faces = [...css.matchAll(/@font-face\s*{[^}]*?font-family:\s*'([^']+)'[^}]*?url\('\/fonts\/euphonia\/([^']+)'\)[^}]*}/g)].map(m => ({ family: m[1], file: m[2] }));
  return { faces, stack: named(themes[0].type), stacks: themes.map(t => ({ id: t.id, families: named(t.type) })) };
}

// The characters of some text that need a glyph: not spaces, and not the
// format characters (joiners, direction marks, soft hyphens), which only
// shape or steer their neighbours.
const inkOf = text => [...new Set(text.normalize('NFC'))].filter(c => c.trim() && !/\p{Cf}/u.test(c));
// A word's, in its own case and in the capitals the ribbons set it in (in its
// language's casing).
const inked = (word, lang) => inkOf(word + word.toLocaleUpperCase(lang));

// Everything the page sets in type: the page's text, as the build makes it,
// every string of the data it loads, and the ribbons' words in capitals. The
// faces are cut from this (scripts/euphonia-fonts.py) and held to it here.
const decode = t => t.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(n)).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' })[e]);
export function pageText(html = injectEuphonia(read('euphonia/index.html')), data = tonguesData()) {
  const strings = o => typeof o === 'string' ? [o] : o && typeof o === 'object' ? Object.values(o).flatMap(strings) : [];
  // The themes' file is the record behind the page's looks (its sources'
  // titles, in their own scripts), not text the page sets; the theme names the
  // switcher shows are in the built page.
  const json = readdirSync(new URL('src/euphonia/', ROOT)).filter(f => f.endsWith('.json') && f !== 'euphonia.themes.json').flatMap(f => strings(JSON.parse(read(`src/euphonia/${f}`))));
  const shown = decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' '));
  // Attributes a reader meets as text: titles and labels.
  const said = [...html.matchAll(/\s(?:title|aria-label|alt|placeholder)="([^"]*)"/g)].map(m => decode(m[1]));
  return [shown, ...said, ...json, ...data.tongues.map(t => t.word.toLocaleUpperCase(t.lang))].join(' ');
}

export function verifyEuphoniaTongues({ data = tonguesData(), book = euphoniaData(), declared = declaredFaces(), fonts = null } = {}) {
  const faces = declared.faces.map(f => f.file);
  const errors = [];
  const regions = book.regions.data;
  const flat = o => typeof o === 'string' ? o : Array.isArray(o) ? o.map(flat).join(' ') : o && typeof o === 'object' ? Object.values(o).map(flat).join(' ') : '';
  // The cultures are held to the book: the chapters the site carries, and on
  // Scott's machine the master itself, which carries every one.
  const exported = ['classes', 'regions', 'adventures', 'hidden', 'characters'].map(f => flat(book[f])).join(' ');
  const master = book.master ? readFileSync(book.master.path, 'utf8') : null;
  const named = (name, text) => new RegExp(`(?<![\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'u').test(text);
  let unexported = 0;
  const culture = (who, name) => {
    if (named(name, exported)) return;
    unexported++;
    if (master && !named(name, master)) errors.push(`${who}: the book never names ${name}`);
  };
  const languages = new Set();
  for (const t of data.tongues) {
    const who = t.language;
    for (const k of ['language', 'lang', 'script', 'word', 'culture', 'region', 'sense']) if (!t[k]) errors.push(`${who}: no ${k}`);
    if (languages.has(who)) errors.push(`${who}: listed twice`);
    languages.add(who);
    try { Intl.getCanonicalLocales(t.lang); } catch { errors.push(`${who}: ${t.lang} isn't a language tag`); }
    let script;
    try { script = new RegExp(`^[\\p{Script=${t.script}}\\p{Script=Common}\\p{Script=Inherited}]+$`, 'u'); } catch { errors.push(`${who}: ${t.script} isn't a Unicode script`); }
    if (script && !script.test(t.word)) errors.push(`${who}: "${t.word}" isn't all ${t.script}`);
    if ((t.script === 'Latin') === Boolean(t.roman)) errors.push(`${who}: ${t.script === 'Latin' ? 'a romanisation it doesn\'t need' : 'no romanisation'}`);
    if (!t.source?.title || !t.source?.by) errors.push(`${who}: its source isn't named`);
    try { if (!/^https?:$/.test(new URL(t.source?.url).protocol)) throw 0; } catch { errors.push(`${who}: its source has no address`); }
    // Assigned to a region whose chapter names the culture, where any does.
    const naming = regions.filter(r => named(t.culture, flat(r))).map(r => r.name);
    if (!regions.some(r => r.name === t.region)) errors.push(`${who}: no region ${t.region}`);
    else if (naming.length && !naming.includes(t.region)) errors.push(`${who}: ${t.region}'s chapter doesn't name ${t.culture} (${naming.join(', ')} do)`);
    culture(who, t.culture);
  }
  for (const u of data.unfound) {
    if (languages.has(u.language)) errors.push(`${u.language}: both found and not found`);
    if (!u.searched?.length) errors.push(`${u.language}: nothing searched`);
    culture(u.language, u.culture);
  }
  // Every face declared is shipped, every face shipped is declared, and every
  // character on the ribbons has a glyph in one of them.
  const shipped = readdirSync(new URL(FONTS, ROOT)).filter(f => f.endsWith('.woff2'));
  for (const f of faces) if (!shipped.includes(f)) errors.push(`euphonia.css declares ${f}, which isn't in ${FONTS}`);
  for (const f of shipped) if (!faces.includes(f)) errors.push(`${FONTS}${f} is shipped but never declared`);
  for (const { family } of declared.faces) if (!declared.stacks.some(t => t.families.includes(family))) errors.push(`${family} is declared but in no theme's type stack`);
  for (const t of declared.stacks) for (const family of t.families) if (!declared.faces.some(f => f.family === family)) errors.push(`the ${t.id} theme's type names ${family}, which no face declares`);
  const maps = fonts ?? shippedMaps();
  for (const t of data.tongues) {
    const bare = bareOf(inked(t.word, t.lang), maps);
    if (bare) errors.push(`${t.language}: no face has ${bare}`);
  }
  errors.forEach(e => console.error(`  ✗ verify-euphonia-tongues: ${e}`));
  return { failures: errors.length, words: data.tongues.length, unexported, master: Boolean(master) };
}

// The built page sets every word, in its language, on the ribbon a reader
// reaches: the one list classed only ribbon-words, not its hidden copy or the
// bottom ribbon's echo of it. No two look-alikes stand within two places of
// each other around the loop, and the nearest pair's distance is returned
// (null when no two look alike).
// Every character the page inks has a glyph in a face it ships.
export function verifyTongueRibbons(html, data = tonguesData(), maps = shippedMaps()) {
  const errors = [];
  const bare = bareOf(inkOf(pageText(html, data)), maps);
  if (bare) errors.push(`the page's text: no face has ${bare}; recut the faces (scripts/euphonia-fonts.py)`);
  const ribbons = [...html.matchAll(/<ul class="ribbon-words"[^>]*>([\s\S]*?)<\/ul>/g)].map(m => m[1]).join('');
  for (const t of data.tongues) {
    const lang = new RegExp(`lang="${t.lang}"[^>]*>${t.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`);
    if (!lang.test(ribbons)) errors.push(`${t.language}: "${t.word}" isn't on the ribbons in lang ${t.lang}`);
  }
  const line = [...ribbons.matchAll(/lang="([^"]+)"[^>]*>([^<]+)</g)].map(([, lang, word]) => data.tongues.find(t => t.lang === lang && t.word === word)).filter(Boolean);
  const n = line.length;
  let apart = null;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (alike(line[i], line[j]) < LOOKALIKE) continue;
    const g = Math.min(j - i, n - j + i);
    apart = Math.min(apart ?? g, g);
    if (g < 3) errors.push(`"${line[i].word}" and "${line[j].word}" look alike and stand ${g === 1 ? 'side by side' : 'one word apart'}`);
  }
  errors.forEach(e => console.error(`  ✗ verify-euphonia-tongues: ${e}`));
  return { failures: errors.length, apart };
}

// For the font cutter: every character the page inks, and for each theme its
// families' faces in the order its type stack tries them, which is the order a
// character falls through to the first family that has it.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2] === '--inventory') {
  const { faces, stacks } = declaredFaces();
  const files = family => faces.filter(f => f.family === family).map(f => f.file);
  console.log(JSON.stringify({ chars: inkOf(pageText()), themes: stacks.map(t => ({ id: t.id, smallCaps: THEMES.find(x => x.id === t.id).smallCaps, families: t.families.map(files) })) }));
}
