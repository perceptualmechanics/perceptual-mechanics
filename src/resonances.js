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
// instead of a matched `phrase`, since there's no single verbatim
// substring to check most of these against. The rationale is what makes a
// discovered link legible and reviewable at all; see
// docs/constellation_resonances.md for the actual candidate list, the
// verified quoted text behind each rationale, and review status.
//
// `basis` — added after round 1 review — separates two genuinely different
// KINDS of claim this file makes, which get verified and reviewed
// differently:
//   'verbatim'    — two spans of text are mechanically, provably the same
//                    (or the same with only punctuation/whitespace
//                    differences) found passage appearing in two different
//                    pieces. Not a judgment call — checked by
//                    scripts/find-verbatim-overlaps.mjs (word-shingle
//                    matching across the whole corpus), same category of
//                    certainty as verify-links.mjs checking a phrase
//                    exists. These rows don't need a close read to
//                    confirm; they need Scott to decide whether he *wants*
//                    the connection shown, since the fact of it isn't in
//                    question.
//   'connotative' — genuine thematic/imagistic/associative resonance with
//                    no shared source text, where the rationale is doing
//                    real interpretive work and is the only thing that
//                    makes the claim checkable at all. These need an
//                    actual read, not just a glance.
//
// `status` is the real review gate, not decoration:
//   'pending'  — proposed by the discovery pass, not yet reviewed.
//   'approved' — Scott read the rationale (or, for verbatim rows, decided
//                he wants the connection shown) and confirmed it. Only
//                these should ever be read by the Constellation scene.
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
// scene itself doesn't exist yet. All 20 rows were reviewed and approved
// by Scott on 2026-08-16 (docs/constellation_resonances.md, "i'm good
// with all of these") — the review gate this file exists for has been
// cleared for the current set. Building the actual scene against this
// data is the next phase, not this one; a future discovery pass adding
// more rows still starts them at 'pending', same as this round did.

export const RESONANCES = [
  // ── VERBATIM: mechanically confirmed shared found text ──────────────────
  // Every row below was found or confirmed by scripts/find-verbatim-
  // overlaps.mjs (word-shingle matching, K=5, 6-word minimum reported
  // span — see that script's own header) except #5, a 4-word overlap
  // ("seven colored prisms starlight") one word short of the script's
  // threshold but confirmed by direct reading; included because it's the
  // same passage family as #3/#4/#6 below, not a separate claim. The
  // script also surfaced 12 other exact-overlap pairs, all intra-scene
  // (library-note cross-references and theater's own intentional
  // callback lines within a single play) — real, but not Constellation
  // material: they're the site's existing internal annotation/callback
  // style working as designed, not a cross-piece discovery. Full script
  // output is reproducible by running `node
  // scripts/find-verbatim-overlaps.mjs`.
  {
    id: 1,
    basis: 'verbatim',
    a: { scene: 'sphere', id: 14 },
    b: { scene: 'beamline', id: 5 },
    rationale: 'Identical text: "here are harps, here are superstrings" opens the same passage in both pieces.',
    status: 'approved',
  },
  {
    id: 2,
    basis: 'verbatim',
    a: { scene: 'sphere', id: 14 },
    b: { scene: 'beamline', id: 6 },
    rationale: 'Identical text, two spans: "pluck at them both, send me vibrating, harmonics echoing at mathematically precise points" and "my own bow waits to be bent" — the same passage continuing, split by an ellipsis in Beamline that Sphere carries in full.',
    status: 'approved',
  },
  {
    id: 3,
    basis: 'verbatim',
    a: { scene: 'sphere', id: 14 },
    b: { scene: 'beamline', id: 9 },
    rationale: 'Identical text: "Seven-colored, prisms, starlight..." — the shortest of the shared spans (4 words), confirmed by direct reading rather than the mechanical scan\'s 5-word threshold, but the same source passage as #1/#2/#6.',
    status: 'approved',
  },
  {
    id: 4,
    basis: 'verbatim',
    a: { scene: 'sphere', id: 14 },
    b: { scene: 'beamline', id: 10 },
    rationale: 'Identical text: "Vibrating at a different frequency. Harmonics, tuning." closes the same passage in both pieces.',
    status: 'approved',
  },
  {
    id: 5,
    basis: 'verbatim',
    a: { scene: 'sphere', id: 11 },
    b: { scene: 'beamline', id: 7 },
    rationale: 'Identical text: "Microscopic lightning tetrahedrons shimmering in air for half a second and then phasing out" opens the same passage in both pieces.',
    status: 'approved',
  },
  {
    id: 6,
    basis: 'verbatim',
    a: { scene: 'sphere', id: 11 },
    b: { scene: 'beamline', id: 8 },
    rationale: 'Identical text: "union of heaven and earth, union of thought and action, union of spark and fusion, the blend, the soul and psyche, the divine fire" closes the same passage in both pieces — 24 words, the longest exact match found anywhere in the corpus.',
    status: 'approved',
  },
  {
    id: 7,
    basis: 'verbatim',
    a: { scene: 'sphere', id: 15 },
    b: { scene: 'beamline', id: 1 },
    rationale: 'Identical text, 23 words: "every solid-state hum of vacuum tubes warming up the channel of electrons, glowing orange-red on the back of the CD cover" — found by the mechanical scan, missed in the first read-through despite being nearly as long an exact match as the id-11/id-7 pair above.',
    status: 'approved',
  },

  // ── CONNOTATIVE: genuine thematic/associative resonance, no shared text ─
  {
    id: 8,
    basis: 'connotative',
    a: { scene: 'sphere', id: 16 },
    b: { scene: 'orrery', id: 1 },
    rationale: '"Wingspan"\'s opening catalog ("Arboretum. Orrery. Aerial photographs...") names the Orrery directly, by name — nothing currently connects the two even though the reference is explicit, not inferred.',
    status: 'approved',
  },
  {
    id: 9,
    basis: 'connotative',
    a: { scene: 'sphere', id: 12 },
    b: { scene: 'orbiter', id: 6 },
    rationale: 'Sphere\'s own piece titled "Orbiter" (id 12) is a moon poem — Selene, "like a solar system" — that happens to live outside the scene actually called Orbiter, while Orbiter\'s own "Moon Song" is the poem doing that scene\'s moon-work. Two moon poems, each carrying the other\'s name.',
    status: 'approved',
  },
  {
    id: 10,
    basis: 'connotative',
    a: { scene: 'sphere', id: 1 },
    b: { scene: 'orbiter', id: 6 },
    rationale: 'Both pieces reach for the same uncommon word, "boneyard," for the same kind of image: a resting place for what\'s dead that becomes the site of transformation into something else. Flagged explicitly: this is a single shared word, not a shared phrase — real, but weaker evidence than the other connotative rows here, worth Scott\'s own judgment on whether a one-word echo is meaningful or coincidental.',
    status: 'approved',
  },
  {
    id: 11,
    basis: 'connotative',
    a: { scene: 'orbiter', id: 8 },
    b: { scene: 'beamline', id: 2 },
    rationale: 'Both use optics — mirrors and light specifically — as the vocabulary for a person becoming physically/emotionally overtaken by another: "The Lovers"\' "hall of mirrors... physics has a heart all its own" against Beamline\'s "I\'m the lasing medium... THE MIRROR — the fucking mirror isn\'t letting anything out." No shared wording, same image system.',
    status: 'approved',
  },
  {
    id: 12,
    basis: 'connotative',
    a: { scene: 'sphere', id: 13 },
    b: { scene: 'scroll', id: 5 },
    rationale: '"Everything\'s A Number"\'s "healing your shoulder by reinjuring it... the body has to perform to help swath the soul" states plainly, in six words, the exact logic "The Impossible Bliss of Self-Mutilation" enacts at monologue length and full volume — pain deliberately chosen as the route to something like relief.',
    status: 'approved',
  },
  {
    id: 13,
    basis: 'connotative',
    a: { scene: 'theater', id: 16, beatId: 701 },
    b: { scene: 'scroll', id: 1 },
    rationale: 'Satan\'s pitch — "Don\'t think of it as damnation — think of it as your Final Promotion" — is "Iron Gods"\' entire argument played for laughs instead of fury: both describe ordinary economic participation as a soul sold under a friendlier name, one as corporate-satire farce, the other dead serious.',
    status: 'approved',
  },
  {
    id: 14,
    basis: 'connotative',
    a: { scene: 'theater', id: 2, beatId: 65 },
    b: { scene: 'sphere', id: 14 },
    rationale: 'Brian\'s "Oh, to be a cello" (the instrument itself as the object of desire, not the music it makes) and "Quiver"\'s "Here are harps, here are superstrings. Pluck at them both, send me vibrating..." both reach for a stringed instrument as the image for wanting to be physically played/touched. Checked against the mechanical scan: no shared text between these two specific pieces, confirming this is a real thematic pairing, not a duplicate — despite "Quiver" being one of the pieces in the verbatim cluster above, this particular connection to it is not.',
    status: 'approved',
  },
  {
    id: 15,
    basis: 'connotative',
    a: { scene: 'orrery', id: 1 },
    b: { scene: 'library', id: 63 },
    rationale: 'The Orrery\'s found story — a homemade, 30-foot backyard solar system with "a miniature radio telescope, pointed straight up, and it was still on, receiving information from the heavens" — and 2001\'s stargate sequence (per the library\'s own note, a lineage running through Solaris and The Tree of Life) both stage the same gesture: a handmade instrument built to reach the cosmos, one in a warehouse, one on a soundstage.',
    status: 'approved',
  },
  {
    id: 16,
    basis: 'connotative',
    a: { scene: 'sphere', id: 21 },
    b: { scene: 'library', id: 13 },
    rationale: '"Algebra"\'s ex-relationship reduced to a solved equation whose "variables don\'t change... irrational and nonlinear" is the same shape as the Symposium\'s origin-of-love myth the library\'s own note cites — Aristophanes\' split halves each permanently searching for the other. Both treat a particular love as a fixed structural fact rather than a feeling that could have gone differently.',
    status: 'approved',
  },
  {
    id: 17,
    basis: 'connotative',
    a: { scene: 'scroll', id: 11 },
    b: { scene: 'theater', id: 2, beatId: 93 },
    rationale: '"Projection" is the real-events essay Truth and Beauty was fictionalized from — its own text says so directly ("in 2001 I wrote a script called Truth and Beauty... about an out-of-work actor, Brian Sharp, who comes across a real, live Muse. Euterpe, as it turns out, muse of music"). Beat 93 is the moment the play names her: "Kirstin." Not an inferred echo — the essay explicitly identifies itself as this scene\'s source material.',
    status: 'approved',
  },
  {
    id: 18,
    basis: 'connotative',
    a: { scene: 'sphere', id: 4 },
    b: { scene: 'scroll', id: 11 },
    rationale: '"Fractal"\'s catalog phrase "Chaos butterflies... Waveform collapsing" and "Projection"\'s own recurring images — "a chaos butterfly; a Lorenz attractor," "the waveform collapsing in two similar yet very distinct ways" — reach for the identical chaos-theory vocabulary as a metaphor for an unpredictable relationship, independently of each other (Projection never mentions Sphere or vice versa).',
    status: 'approved',
  },
  {
    id: 19,
    basis: 'connotative',
    a: { scene: 'theater', id: 4, beatId: 285 },
    b: { scene: 'scroll', id: 9 },
    rationale: 'Brian stepping into "Archibald Query" ("Welcome to my laboratory. I am the head scientist here...") and the narrator becoming "Gary" in "Identity Theft" are both about the ease and appeal of casually inhabiting someone else\'s persona — one for a movie role, one for no reason at all — with neither treating it as a big decision until it already is one.',
    status: 'approved',
  },
  {
    id: 20,
    basis: 'connotative',
    a: { scene: 'theater', id: 10, beatId: 506 },
    b: { scene: 'orrery', id: 1 },
    rationale: 'Deliberate inversion, not similarity: Horace was "trained as an artist. Modern sculpture. I was good" before Hell reduced him to paperwork, while the Orrery\'s builder — "an unlikely candidate to construct such a thing. A dropout of community college" — produced an untrained masterpiece. Two sculptors, opposite relationships between training and output.',
    status: 'approved',
  },
];
