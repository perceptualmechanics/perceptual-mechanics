// ─── Links: the single source of truth for every cross-piece connection ────
// Every clickable jump between two pieces on this site — sphere facet to
// facet, poem to poem, scroll patch to patch, library item to library item,
// and (once anything actually uses it) any future link that crosses scenes
// — is one row in LINKS below, not a value hand-authored twice into two
// different files.
//
// Migrated 2026-08-16 from four separate per-scene tables (sphere.text.js's
// inline `<a class="fragment-link" data-target="Title">` anchors,
// orbiter.js's POEM_LINKS, scroll.js's LINKS, library.js's LIBRARY_LINKS —
// see NOTES.md's "Linking & addressing" entry for the full history). Those
// four tables used three incompatible keys (title string, an internal
// `patch` string, and library's own numeric id) and, wherever a
// relationship ran both ways, required the SAME relationship written out
// as two separate rows in two separate files — once from each side. This
// file fixes both problems: one array, and every piece addressed the same
// way, a `{ scene, id }` pair, using the stable per-scene `id` every
// scene's pieces now carry (see each scene's .text.js file).
//
// A row still only carries ONE phrase — the literal, verbatim substring
// already sitting in `from`'s own text that gets wrapped into a live link.
// That's a deliberate limit, not a leftover of the old model: the reverse
// direction's prose is separately authored (or may not exist at all — see
// "Wiseguy" below, a one-directional reference with nothing wired the
// other way), so there's no phrase to derive automatically for it.
// What IS automatic now: a scene no longer has to hand-author a second row
// to know it's a target. getInboundLinks() below answers "what points at
// this piece" for any piece, in any scene, from this one array — no
// second row required. Rendered as a quiet "Referenced from X" note next to
// each scene's own quiet-metadata element (sphere/orbiter/library), or as a
// nameless marker on scroll, which shows no titles anywhere else — see
// NOTES.md's 2.3.0 entry, part 5.
//
// Every phrase below is checked against its source field verbatim, and
// every `to` id checked to resolve, by scripts/verify-links.mjs — run it
// after editing this file or any scene's .text.js (`npm run verify-links`).

export const LINKS = [
  // ── sphere (45) ──
  { from: { scene: 'sphere', id: 1, field: 'text' }, phrase: 'the angel puckers his lips', to: { scene: 'sphere', id: 16 } },
  { from: { scene: 'sphere', id: 1, field: 'text' }, phrase: 'This is the world, or at least a few nodes of it.', to: { scene: 'sphere', id: 4 } },
  { from: { scene: 'sphere', id: 2, field: 'text' }, phrase: 'the realm where zephyr found valley was always the best place for them to find agreement', to: { scene: 'sphere', id: 5 } },
  { from: { scene: 'sphere', id: 3, field: 'text' }, phrase: 'shaped into a second-order geometric figure. It is crafted until it satisfies its authors.', to: { scene: 'sphere', id: 21 } },
  { from: { scene: 'sphere', id: 3, field: 'text' }, phrase: 'I am the lie you tell yourselves to keep you sane.', to: { scene: 'sphere', id: 5 } },
  { from: { scene: 'sphere', id: 3, field: 'text' }, phrase: 'the unwieldy ones, the poems, plays, novels and stories that don\'t fit neatly into any box, the ones with sharp corners and outlandish tangents and inhuman forces that their authors were unable or unwilling to tame.', to: { scene: 'sphere', id: 21 } },
  { from: { scene: 'sphere', id: 4, field: 'text' }, phrase: 'Chaos butterflies.', to: { scene: 'sphere', id: 15 } },
  { from: { scene: 'sphere', id: 4, field: 'text' }, phrase: 'Silver strings.', to: { scene: 'sphere', id: 14 } },
  { from: { scene: 'sphere', id: 4, field: 'text' }, phrase: 'Waveform collapsing.', to: { scene: 'sphere', id: 11 } },
  { from: { scene: 'sphere', id: 5, field: 'text' }, phrase: 'writing in air that keeps us truly stable.', to: { scene: 'sphere', id: 9 } },
  { from: { scene: 'sphere', id: 5, field: 'text' }, phrase: 'dig for fire.', to: { scene: 'sphere', id: 11 } },
  { from: { scene: 'sphere', id: 5, field: 'text' }, phrase: 'Nothing comes without sacrifice.', to: { scene: 'sphere', id: 24 } },
  { from: { scene: 'sphere', id: 6, field: 'text' }, phrase: 'This is how we bounce: we find someone that has a high caliber of energy, and we throw ourselves at them with all the force we can muster.', to: { scene: 'sphere', id: 22 } },
  { from: { scene: 'sphere', id: 7, field: 'text' }, phrase: 'There is nothing to be drawn from constellations, arbitrary abstract lines.', to: { scene: 'sphere', id: 17 } },
  { from: { scene: 'sphere', id: 7, field: 'text' }, phrase: 'light gives us everything we have.', to: { scene: 'sphere', id: 12 } },
  { from: { scene: 'sphere', id: 8, field: 'text' }, phrase: 'a flash from heaven to earth at the tip of my finger.', to: { scene: 'sphere', id: 17 } },
  { from: { scene: 'sphere', id: 8, field: 'text' }, phrase: 'Just the sense of knowing was worth it.', to: { scene: 'sphere', id: 24 } },
  { from: { scene: 'sphere', id: 8, field: 'text' }, phrase: 'a bolt from the skies.', to: { scene: 'sphere', id: 11 } },
  { from: { scene: 'sphere', id: 9, field: 'text' }, phrase: 'a shrunk, a shrunk for Sagnor Burns! — his gloumace is empty, fill it with haps!', to: { scene: 'sphere', id: 5 } },
  { from: { scene: 'sphere', id: 9, field: 'text' }, phrase: 'you are everywhere —', to: { scene: 'sphere', id: 15 } },
  { from: { scene: 'sphere', id: 10, field: 'text' }, phrase: 'The private mythologies boiling over.', to: { scene: 'sphere', id: 3 } },
  { from: { scene: 'sphere', id: 11, field: 'text' }, phrase: 'Your astounding geologic warmth, a fire running through earth, permeating everything.', to: { scene: 'sphere', id: 13 } },
  { from: { scene: 'sphere', id: 11, field: 'text' }, phrase: 'union of spark and fusion, the blend, the soul and psyche, the divine fire.', to: { scene: 'sphere', id: 8 } },
  { from: { scene: 'sphere', id: 11, field: 'text' }, phrase: 'The slow, profound swirl around us.', to: { scene: 'sphere', id: 12 } },
  { from: { scene: 'sphere', id: 12, field: 'text' }, phrase: 'like the iris of an eye and Selene Herself the glaring opalescent pupil', to: { scene: 'sphere', id: 11 } },
  { from: { scene: 'sphere', id: 12, field: 'text' }, phrase: 'staring straight at me.', to: { scene: 'sphere', id: 17 } },
  { from: { scene: 'sphere', id: 13, field: 'text' }, phrase: 'The torus, fingers joining through the center. Adding up to x when we were expecting y and no amount of finessing can make a number other than what it is.', to: { scene: 'sphere', id: 21 } },
  { from: { scene: 'sphere', id: 14, field: 'text' }, phrase: 'here are superstrings.', to: { scene: 'sphere', id: 4 } },
  { from: { scene: 'sphere', id: 14, field: 'text' }, phrase: 'Vibrating at a different frequency.', to: { scene: 'sphere', id: 24 } },
  { from: { scene: 'sphere', id: 15, field: 'text' }, phrase: 'indestructible soul energies like plutonium discovered and created simultaneously.', to: { scene: 'sphere', id: 17 } },
  { from: { scene: 'sphere', id: 15, field: 'text' }, phrase: 'we can only come to understand that our roles are so much more flexible than we ever think they are.', to: { scene: 'sphere', id: 3 } },
  { from: { scene: 'sphere', id: 16, field: 'text' }, phrase: 'his six wings unfolding, great god of guardian angels.', to: { scene: 'sphere', id: 1 } },
  { from: { scene: 'sphere', id: 17, field: 'text' }, phrase: 'Show me an act of God to shatter this enclave, to bring light into dark, to do, in short, what one expects of any reasonably competent deity.', to: { scene: 'sphere', id: 8 } },
  { from: { scene: 'sphere', id: 17, field: 'text' }, phrase: 'the light behind my eyes. That is where I shall worship.', to: { scene: 'sphere', id: 12 } },
  { from: { scene: 'sphere', id: 18, field: 'text' }, phrase: 'What happens once the mad rush is over, once it really is done? What comes after that? What now, now that the bittersweet taste is evaporating from my tongue?', to: { scene: 'sphere', id: 21 } },
  { from: { scene: 'sphere', id: 19, field: 'text' }, phrase: '—', to: { scene: 'sphere', id: 20 } },
  { from: { scene: 'sphere', id: 20, field: 'text' }, phrase: '—', to: { scene: 'sphere', id: 19 } },
  { from: { scene: 'sphere', id: 21, field: 'text' }, phrase: 'Please, please, some loophole overlooked, something —', to: { scene: 'sphere', id: 13 } },
  { from: { scene: 'sphere', id: 21, field: 'text' }, phrase: 'Irrational and nonlinear. That describes us perfectly.', to: { scene: 'sphere', id: 3 } },
  { from: { scene: 'sphere', id: 21, field: 'text' }, phrase: 'I hope their answer turns out better than ours.', to: { scene: 'sphere', id: 18 } },
  { from: { scene: 'sphere', id: 22, field: 'text' }, phrase: 'the bottom drops out, swings uselessly from my left foot, and everything becomes raw experience, all the sadness and shame and unhappiness consumes me.', to: { scene: 'sphere', id: 6 } },
  { from: { scene: 'sphere', id: 22, field: 'text' }, phrase: 'collecting experience once more.', to: { scene: 'sphere', id: 4 } },
  { from: { scene: 'sphere', id: 23, field: 'text' }, phrase: 'leaves will decorate the cracked concrete: the anticipation, the knowledge of what will be, the settling sun, the autumnal.', to: { scene: 'sphere', id: 24 } },
  { from: { scene: 'sphere', id: 24, field: 'text' }, phrase: 'I get the sense that any answer I receive will never be truly satisfying.', to: { scene: 'sphere', id: 21 } },
  { from: { scene: 'sphere', id: 24, field: 'text' }, phrase: 'the world continues, since no one feels that quake but me.', to: { scene: 'sphere', id: 8 } },

  // ── orbiter (10) ──
  { from: { scene: 'orbiter', id: 5, field: 'stanzas', index: 1 }, phrase: 'stones', to: { scene: 'orbiter', id: 6 } },
  { from: { scene: 'orbiter', id: 6, field: 'stanzas', index: 3 }, phrase: 'stones', to: { scene: 'orbiter', id: 5 } },
  { from: { scene: 'orbiter', id: 8, field: 'stanzas', index: 0 }, phrase: 'mirrors', to: { scene: 'orbiter', id: 5 } },
  { from: { scene: 'orbiter', id: 5, field: 'stanzas', index: 3 }, phrase: 'Mirrors', to: { scene: 'orbiter', id: 8 } },
  { from: { scene: 'orbiter', id: 6, field: 'stanzas', index: 10 }, phrase: 'latticework', to: { scene: 'orbiter', id: 4 } },
  { from: { scene: 'orbiter', id: 4, field: 'stanzas', index: 1 }, phrase: 'latticework', to: { scene: 'orbiter', id: 6 } },
  { from: { scene: 'orbiter', id: 10, field: 'stanzas', index: 0 }, phrase: 'Coalescing', to: { scene: 'orbiter', id: 11 } },
  { from: { scene: 'orbiter', id: 11, field: 'stanzas', index: 0 }, phrase: 'Coalescing', to: { scene: 'orbiter', id: 10 } },
  { from: { scene: 'orbiter', id: 10, field: 'stanzas', index: 0 }, phrase: 'Reveal', to: { scene: 'orbiter', id: 9 } },
  { from: { scene: 'orbiter', id: 9, field: 'stanzas', index: 4 }, phrase: 'revealed', to: { scene: 'orbiter', id: 10 } },

  // ── scroll (6) ──
  { from: { scene: 'scroll', id: 5, field: 'body', index: 0 }, phrase: 'You can’t be afraid to lose everything.', to: { scene: 'scroll', id: 3 } },
  { from: { scene: 'scroll', id: 11, field: 'body', index: 36 }, phrase: 'Jeremy Constantilios', to: { scene: 'scroll', id: 10 } },
  { from: { scene: 'scroll', id: 10, field: 'body', index: 0 }, phrase: 'Jeremy Constantilios', to: { scene: 'scroll', id: 11 } },
  { from: { scene: 'scroll', id: 10, field: 'body', index: 15 }, phrase: 'pilgrimage to Hell', to: { scene: 'scroll', id: 11 } },
  { from: { scene: 'scroll', id: 11, field: 'body', index: 2 }, phrase: 'pilgrimage to Hell', to: { scene: 'scroll', id: 10 } },
  { from: { scene: 'scroll', id: 4, field: 'body', index: 44 }, phrase: 'projection', to: { scene: 'scroll', id: 11 } },

  // ── library (85) ──
  { from: { scene: 'library', id: 49, field: 'scene' }, phrase: 'coin toss', to: { scene: 'library', id: 72 } },
  { from: { scene: 'library', id: 72, field: 'excerpt' }, phrase: 'A coin spins in the air', to: { scene: 'library', id: 49 } },
  { from: { scene: 'library', id: 40, field: 'scene' }, phrase: 'Origin of Love', to: { scene: 'library', id: 13 } },
  { from: { scene: 'library', id: 13, field: 'excerpt_from' }, phrase: 'Hedwig and the Angry Inch', to: { scene: 'library', id: 40 } },
];

// ─── Which fields each scene actually puts on screen ───────────────────────
// A link is only half a link if the field it is authored into never gets
// rendered. That was live in v3.16.2 and it looked like this: library.js
// deliberately withholds each item's `note` (Scott's call, 2026-07-23 —
// "I'm not sure I want it there yet"), but 81 of the library's 85 rows below
// are authored into `note`. So the outbound half rendered nowhere, while
// getInboundLinks() — which never knew about fields — happily kept printing
// the other end. Throne of Blood's panel said "REFERENCED FROM SEVEN
// SAMURAI"; Seven Samurai's panel had nothing to click. 45 library items
// showed that line, and for 41 of them every inbound link came from an
// unrendered field.
//
// The fix Scott chose for 4.0 keeps notes withheld and stops the dangling
// half from displaying, so a relationship is either visible from both ends or
// from neither. That needs the data to know what the scenes draw, which is
// what these two maps are.
//
// RENDERED_FIELDS is the allowlist. WITHHELD_FIELDS is the separate, explicit
// statement that a field exists in the data and is deliberately not shown —
// the distinction matters, because scripts/verify-links.mjs fails the build on
// a link from a field that is in NEITHER map (a typo, or a new field nobody
// wired up) while merely reporting the count of links into a withheld one.
// Without that split, "deliberately not rendered" and "misspelled" would look
// identical to the verifier, and the honest state of the library links would
// have to be papered over to keep the build green.
//
// Keep these in step with the scenes: library.js renders scene/excerpt/
// excerpt_from through renderLinkedField() and has its note line commented
// out; sphere renders `text`, orbiter `stanzas`, scroll `body`.
export const RENDERED_FIELDS = {
  sphere:  new Set(['text']),
  orbiter: new Set(['stanzas']),
  scroll:  new Set(['body']),
  library: new Set(['scene', 'excerpt', 'excerpt_from']),
};

export const WITHHELD_FIELDS = {
  // `catalog` is bibliographic bookkeeping — ISBNs of other printings, edition
  // uncertainty, "flag for Scott". Real reference value to Scott, not something
  // to publish and not something to throw away. Nothing renders it, nothing
  // links from it, and it should stay that way.
  //
  // `note` used to be listed here too and is simply gone from the data as of
  // 4.11.21 — see the block below.
  library: new Set(['catalog']),
};

// ─── Library notes: gone, and why the conditional machinery stayed ─────────
// From 2026-07-23 to 4.11.21 the library catalog carried a `note` on 100 of
// its items, and a long apparatus grew up around which of them to show: a
// derived visible set (a note that anchored a cross-link had to be displayed
// or the link had nothing to click), a NOTE_HOLD list for notes that did link
// work but were not publishable as written, and a build-time readiness scan
// in verify-links.mjs.
//
// **None of those notes were Scott's, and he never asked for them.** They
// were generated in an earlier cataloguing round, and 4.11.21 removed them at
// his call along with the 81 links authored into them — 55% of the site's
// entire link graph, which had been anchored in prose the author had not
// written. 146 links became 65. The library keeps 4, anchored in a film's
// `scene` caption and a book's `excerpt`/`excerpt_from`, which are content
// rather than commentary.
//
// The bibliographic half survived: 20 notes that were really edition
// bookkeeping moved into `catalog`, which nothing displays.
//
// What is deliberately kept is the CONDITIONAL_FIELDS mechanism below, now
// empty. It exists because "does the site show this field?" stopped having
// one answer for a whole field, and that can happen again to any scene; the
// verifier still refuses a link authored into a field that is neither
// rendered nor declared withheld. NOTE_HOLD and LIBRARY_NOTE_VISIBLE are gone
// with the notes they governed — verify-links.mjs reads NOTE_HOLD through a
// `?? new Map()` and its readiness scan iterates rows that no longer exist,
// so both simply have nothing to do rather than breaking.

// Fields a scene renders only for some items. Keyed the same way as
// RENDERED_FIELDS, but the value is a predicate on the piece id rather than a
// flat yes/no, because "does the site show this?" stopped having one answer
// for the whole field.
export const CONDITIONAL_FIELDS = {
  // Empty since 4.11.21, when library's `note` — the only conditional field
  // this project ever had — was removed from the data. Kept rather than
  // deleted: see the block above, and note that isRenderedField() below still
  // consults it, so a scene that needs per-item visibility again has a place
  // to say so instead of inventing a second mechanism.
};

// True when the scene draws this field for this specific piece. `id` is
// optional so existing callers that only care about unconditional fields keep
// working; omit it and a conditional field reports false, which is the safe
// direction — it can only ever hide a link, never surface one that shouldn't
// be there.
export function isRenderedField(scene, field, id) {
  if (RENDERED_FIELDS[scene]?.has(field) === true) return true;
  const cond = CONDITIONAL_FIELDS[scene]?.[field];
  return cond !== undefined && id !== undefined && cond(id) === true;
}

// ─── Query helpers ──────────────────────────────────────────────────────────

// Links where `scene`+`id` is the source — what a piece's own render code
// wires up as live, clickable phrases in its own text. `field` (and
// `index`, for scenes whose linkable text is array-valued — orbiter's
// stanzas, scroll's body paragraphs) narrows to one specific field/slot,
// matching how each scene calls this once per field it's about to render.
export function getOutboundLinks(scene, id, field, index) {
  return LINKS.filter(l =>
    l.from.scene === scene && l.from.id === id && l.from.field === field
    && (index === undefined ? l.from.index === undefined : l.from.index === index)
  );
}

// Links where `scene`+`id` is the target — every place that references
// this piece, regardless of which scene it's referenced from. Rendered as
// each scene's quiet "Referenced from X" note.
//
// v4.0: filtered by whether the SOURCE side is actually on screen. A
// reference the reader cannot follow back is worse than no reference — it
// names a piece and then, when they go looking, that piece says nothing in
// return. `includeWithheld` exists for tooling (verify-links, the resonance
// doc builder) that wants the raw relationship graph rather than what a
// visitor can see.
export function getInboundLinks(scene, id, { includeWithheld = false } = {}) {
  return LINKS.filter(l =>
    l.to.scene === scene && l.to.id === id
    && (includeWithheld || isRenderedField(l.from.scene, l.from.field, l.from.id))
  );
}
