
import { scrollPieces } from '../src/scenes/scroll/scroll.text.js';
import { TONES, RUBRICS, INTENSITIES, OGHAM_LINES, OPENING_GROUP } from '../src/scenes/scroll/scroll.marks.js';
import { LINKS } from '../src/links.js';
import { pathToFileURL } from 'node:url';

export function verifyScrollMarks() {
  const log = [];
  let failures = 0;
  const fail = msg => { failures++; log.push(`FAIL: ${msg}`); };
  const ok = msg => log.push(`ok: ${msg}`);

  const byKey = new Map(scrollPieces.map(p => [p.key, p]));

  const objectTables = [['TONES', TONES], ['OGHAM_LINES', OGHAM_LINES], ['OPENING_GROUP', OPENING_GROUP]];
  let unknownKeys = 0;
  for (const [label, table] of objectTables) {
    for (const key of Object.keys(table)) {
      if (!byKey.has(key)) {
        unknownKeys++;
        fail(`${label}: key "${key}" does not name any piece in scroll.text.js (keys are: ${[...byKey.keys()].join(', ')})`);
      }
    }
  }
  const rowTables = [['RUBRICS', RUBRICS], ['INTENSITIES', INTENSITIES]];
  for (const [label, rows] of rowTables) {
    rows.forEach((r, i) => {
      if (!byKey.has(r.patch)) {
        unknownKeys++;
        fail(`${label}[${i}]: patch "${r.patch}" does not name any piece in scroll.text.js`);
      }
    });
  }
  if (!unknownKeys) ok(`table keys: every key in all five tables names a real piece`);

  let missingTotals = 0;
  for (const [label, table, fallback] of [['TONES', TONES, '0 (darkest hide)'], ['OGHAM_LINES', OGHAM_LINES, '1 sentence']]) {
    for (const piece of scrollPieces) {
      if (!Object.hasOwn(table, piece.key)) {
        missingTotals++;
        fail(`${label}: no entry for piece "${piece.key}" (${piece.title}) — scroll.js falls back to ${fallback} rather than failing, so this renders as a deliberate choice nobody made.`);
      }
    }
  }
  if (!missingTotals) ok(`TONES / OGHAM_LINES: all ${scrollPieces.length} pieces have an explicit entry`);

  const ungrouped = scrollPieces.filter(p => !Object.hasOwn(OPENING_GROUP, p.key)).map(p => p.key);
  if (ungrouped.length) {
    log.push(`note: OPENING_GROUP omits ${ungrouped.length} piece(s) (${ungrouped.join(', ')}) — deliberate, per its own comment: paragraph 0 there already clears its Ogham float. Flagged, not failed.`);
  }

  function countOccurrences(haystack, needle) {
    if (!needle) return 0;
    let n = 0, at = 0;
    for (;;) {
      const found = haystack.indexOf(needle, at);
      if (found === -1) return n;
      n++;
      at = found + needle.length;
    }
  }

  let phraseFailures = 0;
  let phrasesChecked = 0;
  const marks = [
    ...RUBRICS.map((r, i) => ({ ...r, label: `RUBRICS[${i}]` })),
    ...INTENSITIES.map((r, i) => ({ ...r, label: `INTENSITIES[${i}]` })),
  ];

  for (const mark of marks) {
    const piece = byKey.get(mark.patch);
    if (!piece) continue; // already failed above
    const where = `${mark.label} (${mark.patch} para ${mark.para})`;
    const para = piece.body?.[mark.para];
    if (typeof para !== 'string') {
      phraseFailures++;
      fail(`${where}: piece "${mark.patch}" has no body[${mark.para}] (it has ${piece.body?.length ?? 0} paragraphs) — a paragraph was almost certainly added or removed above this index.`);
      continue;
    }
    const n = countOccurrences(para, mark.phrase);
    if (n !== 1) {
      phraseFailures++;
      fail(
        n === 0
          ? `${where}: phrase "${mark.phrase}" does not occur in that paragraph. Either the prose changed under it, or the paragraph index is stale — renderParagraph's replace would silently render the paragraph unmarked.`
          : `${where}: phrase "${mark.phrase}" occurs ${n} times in that paragraph — first-occurrence replace can't tell which one was meant. Extend the phrase until it appears exactly once.`
      );
      continue;
    }
    phrasesChecked++;
  }
  if (!phraseFailures) ok(`mark phrases: all ${phrasesChecked} RUBRICS/INTENSITIES phrases occur exactly once in the paragraph they name`);

  const spans = new Map(); // `${key}|${para}` -> [{ label, phrase }]
  const push = (key, para, label, phrase) => {
    const k = `${key}|${para}`;
    if (!spans.has(k)) spans.set(k, []);
    spans.get(k).push({ label, phrase });
  };
  for (const mark of marks) push(mark.patch, mark.para, mark.label, mark.phrase);
  LINKS.forEach((l, i) => {
    if (l.from?.scene !== 'scroll' || l.from?.field !== 'body') return;
    const piece = scrollPieces.find(p => p.id === l.from.id);
    if (piece) push(piece.key, l.from.index, `LINKS[${i}]`, l.phrase);
  });

  let overlaps = 0;
  for (const [k, entries] of spans) {
    if (entries.length < 2) continue;
    const [key, para] = k.split('|');
    const text = byKey.get(key)?.body?.[Number(para)];
    if (typeof text !== 'string') continue;
    const ranges = entries
      .map(e => ({ ...e, at: text.indexOf(e.phrase) }))
      .filter(e => e.at !== -1)
      .map(e => ({ ...e, end: e.at + e.phrase.length }));
    for (let a = 0; a < ranges.length; a++) {
      for (let b = a + 1; b < ranges.length; b++) {
        if (ranges[a].at < ranges[b].end && ranges[b].at < ranges[a].end) {
          overlaps++;
          fail(`${key} para ${para}: ${ranges[a].label} ("${ranges[a].phrase}") and ${ranges[b].label} ("${ranges[b].phrase}") cover overlapping text. renderParagraph substitutes in a fixed order over one string, so whichever runs second finds its phrase already split by the first one's markup and silently renders nothing.`);
        }
      }
    }
  }
  if (!overlaps) ok(`overlaps: no cross-link, rubric or intensity phrase overlaps another in the same paragraph`);

  return { ok: failures === 0, failures, log };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, failures, log } = verifyScrollMarks();
  log.forEach(line => console.log(line));
  console.log('');
  if (ok) {
    console.log('All checks passed.');
  } else {
    console.error(`${failures} check(s) failed.`);
    process.exit(1);
  }
}
