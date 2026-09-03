// ─── The corpus, read once, in reading order ────────────────────────────────
// Added 4.6.0 for Psyshell, which is made of the site's own sentences and so
// needs a definition of "the site's own sentences" that something other than
// one scene can hold.
//
// THIS FILE HAS NO DOM. `scripts/prerender.js` imports it to build Psyshell's
// /text/ page from the same numbers the scene renders, which is the rule every
// scene's *.text.js already follows — the page and the scene must not be able
// to disagree.
//
// ─── Why this is not scene-local ────────────────────────────────────────────
// The sentence split it uses was measured and chosen in `spectra.data.js`, and
// Spectra is SHELVED — unregistered, unloaded, deliberately out of the build
// (see `src/scenes/spectra/SHELVED.md`). A live scene importing from it would
// pull a shelved scene back into the bundle to reach one regex, which is the
// wrong shape twice over. So the rule moves here, where a second consumer can
// have it without resurrecting anything, and Spectra keeps its own copy for the
// day it is unshelved.
//
// ─── The sentence split ─────────────────────────────────────────────────────
// Three rules were measured against each other in `spectra.data.js` (2026-09-02)
// before `prose` was chosen there:
//
//   blunt     every . ! ? is a boundary. An ellipsis is three sentences.
//   prose     ellipsis and em-dash are NOT boundaries.        ← what ships
//   beatwise  em-dash IS a boundary; a cut-off ends a unit of speech.
//
// `prose` ships for the reason it shipped there: an interrupted or trailing
// line is dramatically one sentence — a character trailing off has not finished
// three thoughts, they have not finished one.
//
// **Worth knowing, because the earlier work makes this look more contested than
// it is here.** Across Theater's dialogue the rule genuinely moved things:
// Horace's words-per-sentence went 6.3 → 7.0 → 6.6. Across the WHOLE corpus,
// measured 2026-09-03, the three rules give 4,054 / 4,047 / 4,191 sentences —
// a 3.6% spread. The choice is defensible either way at this scale, and
// Psyshell's petal count moves by about one part in thirty if it is revisited.
export const SENTENCE_SPLIT = 'prose';

const strip = s => String(s).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

export function splitSentences(text) {
  return strip(text)
    .replace(/\.{2,}|…/g, ' ')
    .replace(/—|--/g, ' ')
    // Split *after* terminal punctuation, keeping it attached. Splitting ON it
    // throws it away, and anything counted by looking for it then reads near
    // zero — the failure `spectra.data.js` records, which was plausible rather
    // than obviously wrong and is why this line is spelled out in both places.
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

export const wordCount = s => strip(s).split(' ').filter(Boolean).length;

// ─── What counts as a sentence ──────────────────────────────────────────────
// Measured before deciding: harvesting every published string yields 4,047
// units under `prose`, of which **508 are not sentences** — four words or
// fewer with no terminal punctuation. Outside's five power-source names,
// Library's cataloguing apparatus ("edition uncertain, flag for Scott"),
// Apollo's element labels. Petal length is sentence length in Psyshell, so
// each of those would have become a stub at the rim, and a stub is a claim
// about the writing that the writing did not make.
export const isSentence = s => /[.!?]$/.test(s) || wordCount(s) > 4;

// ─── Reading order is declared, not inferred ────────────────────────────────
// The obvious implementation — walk every named export of every *.text.js —
// is wrong in two ways that only show up once you look. It **double-counts**:
// `scroll.text.js` exports its twelve patches individually AND `scrollPieces`
// as an ordered index over them, which is exactly the double-count
// `spectra-measurement-2026-09-02.md` had to correct. And it **loses the
// order**: a module namespace object has its keys sorted alphabetically by
// specification, so a walk visits Cartography before Iron Gods regardless of
// what the scene shows first.
//
// Psyshell's whole geometric claim is "angle around the axis = position in
// reading order," so the order cannot be an accident of alphabetisation. Each
// scene names the one export that carries its order and the fields that carry
// its writing. That list is a decision, and it is short enough to argue with.
//
// Two scenes are absent and that is a fact about them rather than an omission:
// **harmonics** publishes no text of its own (it is in `TEXT_EXEMPT` for that
// reason — it is a view of the connections between other scenes), and
// **outside** publishes only five power-source names and two origin labels,
// none of which survive `isSentence`.
//
// Library is excerpts only. Its `note` field is editorial apparatus about the
// book rather than writing the site is publishing, and `catalog` is private;
// the earlier corpus measurement included visible notes and reached a larger
// number, so the two rulers differ by design and this one is the narrower.
export const CORPUS_SOURCES = [
  { key: 'scroll', read: m => m.scrollPieces.flatMap(p => p.body) },
  { key: 'theater', read: m => m.BEATS.map(b => b.text) },
  { key: 'sphere', read: m => m.fragments.map(f => f.text) },
  { key: 'library', read: m => m.libraryItems.map(i => i.excerpt) },
  { key: 'orbiter', read: m => m.poems.flatMap(p => p.stanzas) },
  { key: 'apollo', read: m => m.ELEMENTS.flatMap(e => [e.character, e.note]) },
  { key: 'beamline', read: m => [m.EPIGRAPH_PRIMARY, m.EPIGRAPH_SECONDARY, ...m.BOUNCES.map(b => b.text)] },
  { key: 'orrery', read: m => [m.ORRERY.note] },
  { key: 'butterfly', read: m => [m.BUTTERFLY.text] },
];

// Returns [{ key, sentences: [string] }] in the order above, each scene's
// sentences in the order that scene publishes them. Pure and deterministic:
// the same modules always produce the same array, which is what lets the
// build's /text/ page and the running scene agree without sharing a cache.
export function readCorpus(modules) {
  return CORPUS_SOURCES.map(({ key, read }) => {
    const mod = modules[key];
    if (!mod) throw new Error(`corpus: no module supplied for "${key}"`);
    const sentences = read(mod)
      .filter(v => typeof v === 'string' && v.trim())
      .flatMap(splitSentences)
      .filter(isSentence);
    return { key, sentences };
  });
}
