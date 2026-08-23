// ─── Find verbatim/near-verbatim overlaps across the whole found-text corpus
// ────────────────────────────────────────────────────────────────────────
// Mechanical duplicate detection for the harmonics's Step A: either two
// spans of text share the same underlying words or they don't — this is a
// fact, checkable by a script, not a judgment call for an LLM reasoning
// pass to make. Same category of check as verify-links.mjs, just for a
// different kind of claim.
//
// Method: word-level shingling (a classic plagiarism-detection technique).
// Every piece's text is normalized (lowercased, punctuation stripped except
// apostrophes, whitespace collapsed) and split into words. Every run of K
// consecutive words (a "shingle") is indexed; if the same shingle appears
// in two different pieces, that's a candidate match. Matches are then
// merged along a piece pair's alignment diagonal into contiguous runs, so
// "here are harps here are superstrings pluck at them" is reported as one
// 10-word overlap, not six separate 5-word ones. K=5 and a 6-word minimum
// reported-span length are both deliberately conservative — long enough
// that a match can't be generic sentence filler, short enough to still
// catch a real shared phrase.
//
// This is corpus-wide and scene-agnostic: it reports same-scene overlaps
// too (two pieces in the same scene sharing text), not just cross-scene
// ones, since that's still a fact worth surfacing even if it doesn't
// become a harmonics resonance. Output is plain, sorted by overlap
// length, meant to be read directly or piped to a file.

import { fragments } from '../src/scenes/sphere/sphere.text.js';
import { poems } from '../src/scenes/orbiter/orbiter.text.js';
import { scrollPieces } from '../src/scenes/scroll/scroll.text.js';
import { BOUNCES } from '../src/scenes/beamline/beamline.text.js';
import { libraryItems, cdRackItems } from '../src/scenes/library/library.text.js';
import { BEATS as theaterBeats } from '../src/scenes/theater/theater.text.js';
import { ORRERY } from '../src/scenes/orrery/orrery.text.js';

const K = 5; // shingle size, in normalized words
const MIN_RUN_WORDS = 6; // minimum merged-overlap length worth reporting

function stripHtml(s) {
  return s.replace(/<[^>]+>/g, ' ');
}

function normalize(s) {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Build the corpus ────────────────────────────────────────────────────
const corpus = [];
function addPiece(scene, addr, rawText, label) {
  if (!rawText || typeof rawText !== 'string') return;
  const norm = normalize(rawText);
  const words = norm.split(' ').filter(Boolean);
  if (words.length < K) return;
  corpus.push({ scene, addr, label, rawText, words });
}

fragments.forEach(f => addPiece('sphere', { id: f.id }, stripHtml(f.text), f.title));
poems.forEach(p => addPiece('orbiter', { id: p.id }, p.stanzas.join(' '), p.title));
scrollPieces.forEach(p => addPiece('scroll', { id: p.id }, p.body.join(' '), p.title));
BOUNCES.forEach(b => addPiece('beamline', { id: b.id }, b.text, `bounce ${b.id}`));
libraryItems.forEach(it =>
  addPiece('library', { id: it.id }, [it.excerpt, it.note].filter(Boolean).join(' '), it.title)
);
cdRackItems.forEach(it =>
  addPiece('library-cd', { id: it.id }, [it.note].filter(Boolean).join(' '), it.title)
);
addPiece('orrery', { id: ORRERY.id }, ORRERY.note, ORRERY.name);
theaterBeats.forEach(b =>
  addPiece('theater', { beatId: b.id }, b.text, `${b.playTitle} — ${b.sceneSlug} (beat ${b.id})`)
);

// ── Index shingles ──────────────────────────────────────────────────────
const shingleIndex = new Map(); // shingle -> [{ pieceIndex, wordStart }]
corpus.forEach((piece, pieceIndex) => {
  for (let i = 0; i + K <= piece.words.length; i++) {
    const shingle = piece.words.slice(i, i + K).join(' ');
    if (!shingleIndex.has(shingle)) shingleIndex.set(shingle, []);
    shingleIndex.get(shingle).push({ pieceIndex, wordStart: i });
  }
});

// ── Collect cross-piece matches, grouped by pair + alignment diagonal ──
const pairMatches = new Map(); // "aIdx|bIdx" -> [{ aStart, bStart }]
for (const occurrences of shingleIndex.values()) {
  if (occurrences.length < 2) continue;
  for (let i = 0; i < occurrences.length; i++) {
    for (let j = i + 1; j < occurrences.length; j++) {
      const o1 = occurrences[i], o2 = occurrences[j];
      if (o1.pieceIndex === o2.pieceIndex) continue;
      const [lo, hi] = o1.pieceIndex < o2.pieceIndex ? [o1, o2] : [o2, o1];
      const key = `${lo.pieceIndex}|${hi.pieceIndex}`;
      if (!pairMatches.has(key)) pairMatches.set(key, []);
      pairMatches.get(key).push({ aStart: lo.wordStart, bStart: hi.wordStart });
    }
  }
}

// ── Merge same-diagonal shingle starts into contiguous runs ────────────
const results = [];
for (const [key, matches] of pairMatches) {
  const [aIdx, bIdx] = key.split('|').map(Number);
  const byDiagonal = new Map();
  for (const m of matches) {
    const diag = m.bStart - m.aStart;
    if (!byDiagonal.has(diag)) byDiagonal.set(diag, []);
    byDiagonal.get(diag).push(m.aStart);
  }
  for (const [diag, startsRaw] of byDiagonal) {
    const starts = [...new Set(startsRaw)].sort((x, y) => x - y);
    let runStart = starts[0], prev = starts[0];
    const runs = [];
    for (let i = 1; i <= starts.length; i++) {
      const cur = starts[i];
      if (cur !== undefined && cur - prev <= K) { prev = cur; continue; }
      runs.push([runStart, prev + K]);
      if (cur !== undefined) { runStart = cur; prev = cur; }
    }
    for (const [aFrom, aTo] of runs) {
      const wordLen = aTo - aFrom;
      if (wordLen < MIN_RUN_WORDS) continue;
      const bFrom = aFrom + diag;
      const pieceA = corpus[aIdx], pieceB = corpus[bIdx];
      results.push({
        pieceA, pieceB, wordLen,
        textA: pieceA.words.slice(aFrom, aTo).join(' '),
        textB: pieceB.words.slice(bFrom, bFrom + wordLen).join(' '),
      });
    }
  }
}

results.sort((a, b) => b.wordLen - a.wordLen);

// ── Report ───────────────────────────────────────────────────────────────
function addrStr(scene, addr) {
  return addr.beatId !== undefined ? `${scene}#beat${addr.beatId}` : `${scene}#${addr.id}`;
}

console.log(`Corpus: ${corpus.length} pieces (K=${K}, min run=${MIN_RUN_WORDS} words)\n`);
console.log(`${results.length} overlapping span(s) found:\n`);
results.forEach((r, i) => {
  const exact = r.textA === r.textB;
  console.log(`${i + 1}. [${r.wordLen} words, ${exact ? 'EXACT' : 'near-match'}]`);
  console.log(`   A: ${addrStr(r.pieceA.scene, r.pieceA.addr)} ("${r.pieceA.label}")`);
  console.log(`   B: ${addrStr(r.pieceB.scene, r.pieceB.addr)} ("${r.pieceB.label}")`);
  console.log(`   shared: "${r.textA}"`);
  if (!exact) console.log(`   (as it appears in B: "${r.textB}")`);
  console.log('');
});
