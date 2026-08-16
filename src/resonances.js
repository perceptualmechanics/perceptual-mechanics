// ─── Resonances: cross-scene, connotative links (Layer 2) ──────────────────
// This is deliberately a SEPARATE store from src/links.js, not an extension
// of it. links.js (Layer 1) is verbatim phrase-matched, one-directional
// (from carries the actual phrase, to is just an id), and scoped to
// relationships Scott hand-authored while writing each piece. This file
// (Layer 2) is discovered, not authored — thematic/associative connection
// between two pieces of found or written text, not necessarily sharing a
// phrase, discovered by a full-corpus reasoning pass rather than written in
// at piece-creation time. It exists to feed the Constellation scene.
//
// A row here is symmetric — two pieces evoke each other, neither is a
// "source" the way links.js's `from` is — and carries a `rationale`
// instead of a matched `phrase`, since there's no verbatim substring to
// check a connotative link against. The rationale is the only thing that
// makes a discovered link legible and reviewable at all; see
// docs/constellation_resonances.md for the actual candidate list and
// review status this file is meant to mirror once reviewed.
//
// `status` is the real review gate, not decoration:
//   'pending'  — proposed by the discovery pass, not yet reviewed.
//   'approved' — Scott read the rationale and confirmed it. Only these
//                should ever be read by the Constellation scene.
//   'rejected' — Scott read it and said no. Kept (not deleted) so the
//                discovery pass's full output stays auditable — a rejected
//                row is a record that this pair was considered and turned
//                down, not a gap that looks unconsidered.
//
// Endpoints use the same { scene, id } shape links.js already established,
// with one addition: theater endpoints carry `beatId` instead of `id`,
// addressing one specific beat (a line of dialogue or a stage direction)
// rather than a whole 16-scene-granularity piece. That's a genuinely
// different, disjoint id space from theater's own scene-level `id`
// (1..16, what links.js/verify-links.mjs already use) — see
// theater.text.js's own header for why the two never collide. Every other
// scene keeps using plain { scene, id } exactly as links.js does; only
// theater needs the extra field, because it's the one scene whose pieces
// (16 scenes covering 736 individual beats) are coarser than the unit a
// resonance actually wants to point at.
//
// Nothing in this file is wired into the live site yet — the Constellation
// scene doesn't exist yet, and won't read from here until Scott has been
// through docs/constellation_resonances.md and marked real approvals.
// Until then this is a data store with a review gate, not a feature.

export const RESONANCES = [
  // ── The shared "harps/superstrings/prisms" passage ──────────────────────
  // Sphere's "Quiver" (id 14) and "Matrices" (id 11) turn out to contain,
  // near-verbatim, the exact same found passage Beamline's BOUNCES split
  // across five stops (5, 6, 7, 8, 9, 10) — not a thematic echo, the same
  // source text reused whole in two different pieces. Six rows below, one
  // per Beamline bounce that overlaps one of the two Sphere fragments,
  // rather than one row trying to cover a passage split six ways.
  {
    id: 1,
    a: { scene: 'sphere', id: 14 },
    b: { scene: 'beamline', id: 5 },
    rationale: 'Beamline bounce 5 ("Here are harps, here are superstrings.") is the same found line "Quiver" opens its own harp/superstring passage with — not an echo, the identical source text reused in both pieces.',
    status: 'pending',
  },
  {
    id: 2,
    a: { scene: 'sphere', id: 14 },
    b: { scene: 'beamline', id: 6 },
    rationale: 'Beamline bounce 6 ("Pluck at them both, send me vibrating... my own bow waits to be bent.") continues the exact same passage "Quiver" carries in full — same source, split across two bounces here versus kept whole there.',
    status: 'pending',
  },
  {
    id: 3,
    a: { scene: 'sphere', id: 14 },
    b: { scene: 'beamline', id: 9 },
    rationale: 'Beamline bounce 9 ("Seven-colored, prisms, starlight...") is verbatim the closing turn of "Quiver"\'s own passage — the same found text landing in two different scenes.',
    status: 'pending',
  },
  {
    id: 4,
    a: { scene: 'sphere', id: 14 },
    b: { scene: 'beamline', id: 10 },
    rationale: 'Beamline bounce 10 ("Vibrating at a different frequency. Harmonics, tuning.") is the last line of the same passage "Quiver" ends on — same source text, not a coincidence of theme.',
    status: 'pending',
  },
  {
    id: 5,
    a: { scene: 'sphere', id: 11 },
    b: { scene: 'beamline', id: 7 },
    rationale: 'Beamline bounce 7 ("Microscopic lightning tetrahedrons shimmering in air...") opens "Matrices" verbatim — the same found passage, not a paraphrase.',
    status: 'pending',
  },
  {
    id: 6,
    a: { scene: 'sphere', id: 11 },
    b: { scene: 'beamline', id: 8 },
    rationale: 'Beamline bounce 8 ("union of heaven and earth... the divine fire.") continues the same passage "Matrices" carries whole — identical source text split differently across the two pieces.',
    status: 'pending',
  },

  // ── Direct naming / title echoes ─────────────────────────────────────────
  {
    id: 7,
    a: { scene: 'sphere', id: 16 },
    b: { scene: 'orrery', id: 1 },
    rationale: '"Wingspan"\'s opening catalog ("Arboretum. Orrery. Aerial photographs...") names the Orrery directly, by name — nothing currently connects the two even though the reference is explicit, not inferred.',
    status: 'pending',
  },
  {
    id: 8,
    a: { scene: 'sphere', id: 12 },
    b: { scene: 'orbiter', id: 6 },
    rationale: 'Sphere\'s own piece titled "Orbiter" (id 12) is a moon poem — Selene, "like a solar system" — that happens to live outside the scene actually called Orbiter, while Orbiter\'s own "Moon Song" is the poem doing that scene\'s moon-work. Two moon poems, each carrying the other\'s name.',
    status: 'pending',
  },

  // ── Shared image, different registers ────────────────────────────────────
  {
    id: 9,
    a: { scene: 'sphere', id: 1 },
    b: { scene: 'orbiter', id: 6 },
    rationale: 'Both pieces reach for the same specific, uncommon word — "boneyard" — for the same kind of image: a resting place for what\'s dead that becomes the site of transformation into something else ("Om-Alpha... boneyard to Arcadia" in Moon Song; the boneyard\'s "huge metallic ribcage" sheltering the last woman to walk the earth in Stolnaphase).',
    status: 'pending',
  },
  {
    id: 10,
    a: { scene: 'orbiter', id: 8 },
    b: { scene: 'beamline', id: 2 },
    rationale: 'Both use optics — mirrors and light specifically — as the vocabulary for a person becoming physically/emotionally overtaken by another: "The Lovers"\' "hall of mirrors... physics has a heart all its own" against Beamline\'s "I\'m the lasing medium... THE MIRROR — the fucking mirror isn\'t letting anything out."',
    status: 'pending',
  },
  {
    id: 11,
    a: { scene: 'sphere', id: 13 },
    b: { scene: 'scroll', id: 5 },
    rationale: '"Everything\'s A Number"\'s "healing your shoulder by reinjuring it... the body has to perform to help swath the soul" states plainly, in six words, the exact logic "The Impossible Bliss of Self-Mutilation" enacts at monologue length and full volume — pain deliberately chosen as the route to something like relief.',
    status: 'pending',
  },

  // ── Theater, beat-level ──────────────────────────────────────────────────
  {
    id: 12,
    a: { scene: 'theater', id: 16, beatId: 701 },
    b: { scene: 'scroll', id: 1 },
    rationale: 'Satan\'s pitch — "Don\'t think of it as damnation — think of it as your Final Promotion" — is "Iron Gods"\' entire argument played for laughs instead of fury: both describe ordinary economic participation as a soul sold under a friendlier name, one as corporate-satire farce, the other dead serious.',
    status: 'pending',
  },
  {
    id: 13,
    a: { scene: 'theater', id: 2, beatId: 65 },
    b: { scene: 'sphere', id: 14 },
    rationale: 'Brian\'s "Oh, to be a cello" (the instrument itself as the object of desire, not the music it makes) and "Quiver"\'s "Here are harps, here are superstrings. Pluck at them both, send me vibrating..." both reach for a stringed instrument as the image for wanting to be physically played/touched.',
    status: 'pending',
  },

  // ── Wonder pointed at the sky, built vs. borrowed ────────────────────────
  {
    id: 14,
    a: { scene: 'orrery', id: 1 },
    b: { scene: 'library', id: 63 },
    rationale: 'The Orrery\'s found story — a homemade, 30-foot backyard solar system with "a miniature radio telescope, pointed straight up, still on, receiving information from the heavens" — and 2001\'s stargate sequence (per the library\'s own note, a lineage running through Solaris and The Tree of Life) both stage the same gesture: a handmade instrument built to reach the cosmos, one in a warehouse, one on a soundstage.',
    status: 'pending',
  },

  // ── Love as a fixed, unchangeable structure ──────────────────────────────
  {
    id: 15,
    a: { scene: 'sphere', id: 21 },
    b: { scene: 'library', id: 13 },
    rationale: '"Algebra"\'s ex-relationship reduced to a solved equation whose "variables don\'t change... irrational and nonlinear" is the same shape as the Symposium\'s origin-of-love myth the library\'s own note cites — Aristophanes\' split halves each permanently searching for the other. Both treat a particular love as a fixed structural fact rather than a feeling that could have gone differently.',
    status: 'pending',
  },
];
