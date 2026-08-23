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
  { from: { scene: 'sphere', id: 7, field: 'text' }, phrase: 'There is nothing to be drawn from harmonicss, arbitrary abstract lines.', to: { scene: 'sphere', id: 17 } },
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
  { from: { scene: 'library', id: 63, field: 'note' }, phrase: 'The Tree of Life', to: { scene: 'library', id: 33 } },
  { from: { scene: 'library', id: 63, field: 'note' }, phrase: 'Solaris', to: { scene: 'library', id: 53 } },
  { from: { scene: 'library', id: 53, field: 'note' }, phrase: '2001: A Space Odyssey', to: { scene: 'library', id: 63 } },
  { from: { scene: 'library', id: 53, field: 'note' }, phrase: 'The Tree of Life', to: { scene: 'library', id: 33 } },
  { from: { scene: 'library', id: 33, field: 'note' }, phrase: '2001: A Space Odyssey', to: { scene: 'library', id: 63 } },
  { from: { scene: 'library', id: 33, field: 'note' }, phrase: 'Solaris', to: { scene: 'library', id: 53 } },
  { from: { scene: 'library', id: 31, field: 'note' }, phrase: 'Throne of Blood', to: { scene: 'library', id: 41 } },
  { from: { scene: 'library', id: 31, field: 'note' }, phrase: 'Dreams', to: { scene: 'library', id: 44 } },
  { from: { scene: 'library', id: 31, field: 'note' }, phrase: 'Ghost Dog: The Way of the Samurai', to: { scene: 'library', id: 54 } },
  { from: { scene: 'library', id: 41, field: 'note' }, phrase: 'Seven Samurai', to: { scene: 'library', id: 31 } },
  { from: { scene: 'library', id: 44, field: 'note' }, phrase: 'Seven Samurai', to: { scene: 'library', id: 31 } },
  { from: { scene: 'library', id: 54, field: 'note' }, phrase: 'Seven Samurai', to: { scene: 'library', id: 31 } },
  { from: { scene: 'library', id: 11, field: 'note' }, phrase: 'Ulysses', to: { scene: 'library', id: 85 } },
  { from: { scene: 'library', id: 85, field: 'note' }, phrase: 'A Portrait of the Artist as a Young Man', to: { scene: 'library', id: 11 } },
  { from: { scene: 'library', id: 85, field: 'note' }, phrase: 'Finnegans Wake', to: { scene: 'library', id: 89 } },
  { from: { scene: 'library', id: 89, field: 'note' }, phrase: 'Gödel, Escher, Bach', to: { scene: 'library', id: 73 } },
  { from: { scene: 'library', id: 73, field: 'note' }, phrase: 'Finnegans Wake', to: { scene: 'library', id: 89 } },
  { from: { scene: 'library', id: 51, field: 'note' }, phrase: 'In Praise of Shadows', to: { scene: 'library', id: 75 } },
  { from: { scene: 'library', id: 75, field: 'note' }, phrase: 'Tokyo Story', to: { scene: 'library', id: 51 } },
  { from: { scene: 'library', id: 3, field: 'note' }, phrase: '1Q84', to: { scene: 'library', id: 86 } },
  { from: { scene: 'library', id: 86, field: 'note' }, phrase: 'Água Viva', to: { scene: 'library', id: 3 } },
  { from: { scene: 'library', id: 82, field: 'note' }, phrase: 'the Odyssey', to: { scene: 'library', id: 81 } },
  { from: { scene: 'library', id: 82, field: 'note' }, phrase: 'the Iliad', to: { scene: 'library', id: 80 } },
  { from: { scene: 'library', id: 82, field: 'note' }, phrase: 'The Divine Comedy', to: { scene: 'library', id: 91 } },
  { from: { scene: 'library', id: 81, field: 'note' }, phrase: 'the Aeneid', to: { scene: 'library', id: 82 } },
  { from: { scene: 'library', id: 80, field: 'note' }, phrase: 'the Aeneid', to: { scene: 'library', id: 82 } },
  { from: { scene: 'library', id: 91, field: 'note' }, phrase: 'the Aeneid', to: { scene: 'library', id: 82 } },
  { from: { scene: 'library', id: 108, field: 'note' }, phrase: 'Alchemy & Mysticism', to: { scene: 'library', id: 6 } },
  { from: { scene: 'library', id: 6, field: 'note' }, phrase: 'The Changing Light at Sandover', to: { scene: 'library', id: 108 } },
  { from: { scene: 'library', id: 109, field: 'note' }, phrase: 'The Lyrics', to: { scene: 'library', id: 103 } },
  { from: { scene: 'library', id: 103, field: 'note' }, phrase: 'The Beatles Anthology', to: { scene: 'library', id: 109 } },
  { from: { scene: 'library', id: 110, field: 'note' }, phrase: 'the Symposium', to: { scene: 'library', id: 13 } },
  { from: { scene: 'library', id: 110, field: 'note' }, phrase: 'Hedwig', to: { scene: 'library', id: 40 } },
  { from: { scene: 'library', id: 13, field: 'note' }, phrase: 'VALIS', to: { scene: 'library', id: 110 } },
  { from: { scene: 'library', id: 40, field: 'note' }, phrase: 'VALIS', to: { scene: 'library', id: 110 } },
  { from: { scene: 'library', id: 111, field: 'note' }, phrase: 'Lolita', to: { scene: 'library', id: 115 } },
  { from: { scene: 'library', id: 115, field: 'note' }, phrase: 'Pale Fire', to: { scene: 'library', id: 111 } },
  { from: { scene: 'library', id: 113, field: 'note' }, phrase: 'Revelation X', to: { scene: 'library', id: 114 } },
  { from: { scene: 'library', id: 114, field: 'note' }, phrase: 'The Book of the SubGenius', to: { scene: 'library', id: 113 } },
  { from: { scene: 'library', id: 116, field: 'note' }, phrase: 'Blood Treachery', to: { scene: 'library', id: 117 } },
  { from: { scene: 'library', id: 116, field: 'note' }, phrase: 'The Spirit Ways', to: { scene: 'library', id: 118 } },
  { from: { scene: 'library', id: 117, field: 'note' }, phrase: 'Mage: The Ascension', to: { scene: 'library', id: 116 } },
  { from: { scene: 'library', id: 118, field: 'note' }, phrase: 'Mage: The Ascension', to: { scene: 'library', id: 116 } },
  { from: { scene: 'library', id: 118, field: 'note' }, phrase: 'Blood Treachery', to: { scene: 'library', id: 117 } },
  { from: { scene: 'library', id: 119, field: 'note' }, phrase: '2001: A Space Odyssey', to: { scene: 'library', id: 63 } },
  { from: { scene: 'library', id: 119, field: 'note' }, phrase: 'Solaris', to: { scene: 'library', id: 53 } },
  { from: { scene: 'library', id: 119, field: 'note' }, phrase: 'The Tree of Life', to: { scene: 'library', id: 33 } },
  { from: { scene: 'library', id: 33, field: 'note' }, phrase: 'Prometheus Rising', to: { scene: 'library', id: 119 } },
  { from: { scene: 'library', id: 120, field: 'note' }, phrase: 'Gravity’s Rainbow', to: { scene: 'library', id: 78 } },
  { from: { scene: 'library', id: 120, field: 'note' }, phrase: 'Borges’s Collected Fictions', to: { scene: 'library', id: 79 } },
  { from: { scene: 'library', id: 78, field: 'note' }, phrase: 'Everything Is Under Control', to: { scene: 'library', id: 120 } },
  { from: { scene: 'library', id: 79, field: 'note' }, phrase: 'Everything Is Under Control', to: { scene: 'library', id: 120 } },
  { from: { scene: 'library', id: 121, field: 'note' }, phrase: 'The Changing Light at Sandover', to: { scene: 'library', id: 108 } },
  { from: { scene: 'library', id: 121, field: 'note' }, phrase: 'the Symposium', to: { scene: 'library', id: 13 } },
  { from: { scene: 'library', id: 121, field: 'note' }, phrase: 'Everything Is Under Control', to: { scene: 'library', id: 120 } },
  { from: { scene: 'library', id: 108, field: 'note' }, phrase: 'Daimonic Reality', to: { scene: 'library', id: 121 } },
  { from: { scene: 'library', id: 13, field: 'note' }, phrase: 'Daimonic Reality', to: { scene: 'library', id: 121 } },
  { from: { scene: 'library', id: 120, field: 'note' }, phrase: 'Daimonic Reality', to: { scene: 'library', id: 121 } },
  { from: { scene: 'library', id: 122, field: 'note' }, phrase: '2001: A Space Odyssey', to: { scene: 'library', id: 63 } },
  { from: { scene: 'library', id: 122, field: 'note' }, phrase: 'Solaris', to: { scene: 'library', id: 53 } },
  { from: { scene: 'library', id: 122, field: 'note' }, phrase: 'The Tree of Life', to: { scene: 'library', id: 33 } },
  { from: { scene: 'library', id: 33, field: 'note' }, phrase: 'Stories of Your Life and Others', to: { scene: 'library', id: 122 } },
  { from: { scene: 'library', id: 125, field: 'note' }, phrase: 'The Changing Light at Sandover', to: { scene: 'library', id: 108 } },
  { from: { scene: 'library', id: 128, field: 'note' }, phrase: 'Daimonic Reality', to: { scene: 'library', id: 121 } },
  { from: { scene: 'library', id: 131, field: 'note' }, phrase: 'Daimonic Reality', to: { scene: 'library', id: 121 } },
  { from: { scene: 'library', id: 129, field: 'note' }, phrase: 'Prometheus Rising', to: { scene: 'library', id: 119 } },
  { from: { scene: 'library', id: 129, field: 'note' }, phrase: 'Everything Is Under Control', to: { scene: 'library', id: 120 } },
  { from: { scene: 'library', id: 130, field: 'note' }, phrase: 'Gravity’s Rainbow', to: { scene: 'library', id: 78 } },
  { from: { scene: 'library', id: 130, field: 'note' }, phrase: 'Borges’s Collected Fictions', to: { scene: 'library', id: 79 } },
  { from: { scene: 'library', id: 130, field: 'note' }, phrase: 'Everything Is Under Control', to: { scene: 'library', id: 120 } },
  { from: { scene: 'library', id: 133, field: 'note' }, phrase: 'Alchemy & Mysticism', to: { scene: 'library', id: 6 } },
  { from: { scene: 'library', id: 139, field: 'note' }, phrase: 'Alchemy & Mysticism', to: { scene: 'library', id: 6 } },
  { from: { scene: 'library', id: 134, field: 'note' }, phrase: 'Wooderson', to: { scene: 'library', id: 32 } },
  { from: { scene: 'library', id: 134, field: 'note' }, phrase: 'Hedwig', to: { scene: 'library', id: 40 } },
  { from: { scene: 'library', id: 137, field: 'note' }, phrase: 'The Book of the SubGenius', to: { scene: 'library', id: 113 } },
  { from: { scene: 'library', id: 137, field: 'note' }, phrase: 'Everything Is Under Control', to: { scene: 'library', id: 120 } },
  { from: { scene: 'library', id: 124, field: 'note' }, phrase: 'Alexander McQueen', to: { scene: 'library', id: 141 } },
  { from: { scene: 'library', id: 141, field: 'note' }, phrase: 'Tord Boontje', to: { scene: 'library', id: 124 } },
  { from: { scene: 'library', id: 142, field: 'note' }, phrase: 'Wiseguy', to: { scene: 'library', id: 140 } },
  { from: { scene: 'library', id: 145, field: 'note' }, phrase: 'Hedwig', to: { scene: 'library', id: 40 } },
  { from: { scene: 'library', id: 145, field: 'note' }, phrase: 'VALIS', to: { scene: 'library', id: 110 } },
];

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
// this piece, regardless of which scene it's referenced from. Not read by
// any scene's rendering yet (see the file header); exposed for whatever
// the cross-scene-linking pass builds on top of this.
export function getInboundLinks(scene, id) {
  return LINKS.filter(l => l.to.scene === scene && l.to.id === id);
}
