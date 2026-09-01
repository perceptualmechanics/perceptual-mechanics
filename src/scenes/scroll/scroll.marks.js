// ─── The scroll's presentation tables ──────────────────────────────────────
// Five lookup tables, all of them keyed off the `key` strings scroll.text.js
// gives its twelve pieces, all of them presentation rather than content —
// which is why they were never in scroll.text.js and aren't now. What
// changed in v4.0 is only WHERE they live: they used to sit at module scope
// in scroll.js, which imports './scroll.css' and './scroll.html?raw' and so
// can only ever be loaded by Vite. That put them permanently out of reach of
// a plain `node` verification script, and these are exactly the tables that
// most need one — RUBRICS and INTENSITIES carry verbatim copies of phrases
// from the prose AND hard-coded paragraph indices, with nothing checking
// either. scripts/verify-scroll-marks.mjs is that check, and this file is
// what makes it possible to write: pure data, no DOM, no Vite-only imports,
// importable from the browser bundle and from a bare node process alike —
// the same shape scroll.text.js already has, for the same reason.
//
// The silent-failure modes this file's own verifier exists to catch:
//   * A phrase drifts by a character (a curly apostrophe, a corrected typo)
//     and renderParagraph's String.replace quietly matches nothing. The
//     paragraph still renders; the mark just isn't there.
//   * A paragraph is inserted above one of the hard-coded `para` indices and
//     every mark below it in that piece lands on the wrong sentence.
//   * A piece is renamed, and TONES[key] ?? 0 / OGHAM_LINES[key] || 1 hand
//     back a plausible default instead of failing — the scroll renders, just
//     with the wrong hide colour and the wrong marginal line.

// Hide darkness per patch — oldest hide darkest and most soot-stained, newest
// still pale. Presentation, so it lives here rather than in scroll.text.js,
// keyed off the piece's own key. The ordering and the text itself come from
// scroll.text.js, which the prerender step for /text/scroll/ also reads —
// one list, so the scroll and the published page can't fall out of order or
// out of sync with each other.
export const TONES = {
  iron: 0, flying: 1, death: 1, pygmalion: 1,
  selfmutilation: 2, cartography: 2, firevigil: 2, firecalamity: 2, identity: 2,
  holography: 3, projection: 4, crocodile: 5,
};

// Rubric ink — color only, no link. Sparingly applied, echoing across pieces.
export const RUBRICS = [
  { patch: 'iron',           para: 0,  phrase: 'absolute lie' },
  { patch: 'flying',         para: 8,  phrase: "I'm flying. Finally." },
  { patch: 'death',          para: 2,  phrase: 'Thoughts of death abound' },
  { patch: 'selfmutilation', para: 16, phrase: 'Fuck them.' },
  { patch: 'identity',       para: 18, phrase: 'Something detached.' },
  { patch: 'projection',     para: 7,  phrase: 'Los Angeles is an otherworld' },
];

// Intense passages — letter-spacing distortion only, no color, no link.
// 'wide' pulls the tracking apart for the declarative/ominous lines;
// 'tight' crushes it for the breathless/visceral ones. Every phrase below
// is verbatim, already present in the source text at that paragraph.
export const INTENSITIES = [
  { patch: 'iron',           para: 10, phrase: 'the men with the cold smiles and the iron eyes smile with satisfaction, and they turn off the stars.', mode: 'wide' },
  { patch: 'flying',         para: 6,  phrase: 'Tied down shackled chained to the ground wrapped in iron and thrown in a river', mode: 'tight' },
  { patch: 'death',          para: 11, phrase: 'Sometimes, you must be ready to lose everything before you grasp what you need.', mode: 'wide' },
  { patch: 'selfmutilation', para: 9,  phrase: 'my entire body torn apart by horses', mode: 'tight' },
  { patch: 'holography',     para: 29, phrase: 'he has no idea where on Earth he is', mode: 'wide' },
  { patch: 'projection',     para: 18, phrase: 'the earth fissuring and swallowing me whole', mode: 'tight' },
  { patch: 'projection',     para: 38, phrase: 'swirling upwards and out, like smoke over hills refracting the endless yellow light', mode: 'wide' },
];

// A verbatim scene, pulled out of its home paragraph and set in real
// screenplay format — rendered after the given paragraph index (post-split,
// i.e. the index the scene's *lead-in* paragraph has once it's isolated
// from the script content that used to trail it).
// Derived from scroll.text.js rather than restated here, so the scroll and
// the published /text/scroll/ page insert the scene at the same place.
// Also moved inside createScroll's dynamic import (see buildPatches()) —
// same reason as PATCHES above.

// How many opening sentences of each patch's first paragraph get set as an
// Ogham line in the margin — computed from the real paragraph text itself
// (not retyped), so it can never drift out of sync with it. Most pieces open
// on one complete, substantial sentence; a couple open short ("A symphony.")
// and read better with their second sentence carried along too.
export const OGHAM_LINES = {
  iron: 1, flying: 2, death: 1, pygmalion: 1, selfmutilation: 2, cartography: 1,
  firevigil: 1, firecalamity: 1, identity: 1, holography: 1, projection: 2,
  crocodile: 1,
};

// The Ogham margin line and the opening paragraph's drop cap both float left
// (scroll.css), and by default a float keeps pulling every SUBSEQUENT sibling
// narrower until something finally clears past its bottom edge. That's the
// intended look for ordinary prose — a paragraph or two visibly wrapping
// around the marginal note is the point, and it self-clears naturally once a
// paragraph's own lines run long enough — true for every piece except the
// ones listed here, where a short opening (relative to its own Ogham column)
// or a run of short paragraphs (Fire Vigil's back-and-forth dialogue) means
// nothing clears the float for a while. Each value is how many leading
// paragraphs get boxed together with the Ogham line into one `.scroll-
// opening` clearfix (scroll.css) instead of left to wrap naturally — picked
// by eye once per piece, the same way TONES and OGHAM_LINES above are:
// there are twelve of these, fixed, not a thousand, so a live look beats a
// general-purpose measurement pass. A piece not listed here needs no
// grouping at all; paragraph 0 already clears its own Ogham line on its own.
export const OPENING_GROUP = {
  flying: 3, death: 2, pygmalion: 3, selfmutilation: 2, cartography: 6,
  firevigil: 3, identity: 2, holography: 2, projection: 2, crocodile: 4,
};
