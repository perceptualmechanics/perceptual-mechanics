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
// Standing exclusions for any discovery pass, mechanical or manual — real
// mistakes a past pass actually made, not hypothetical ones:
//   - SAME-SOURCE-DOCUMENT SPLITS. Two pieces that are excerpts of the
//     SAME underlying document (e.g. scroll's Holography and Projection,
//     both drawn from one ~10,500-word chapter per scroll.text.js's own
//     header) aren't a discovered echo — they're one text that got cut
//     into two pieces. A pass should recognize this from each piece's own
//     sourcing comment before proposing a row, not rely on a human
//     reviewer to catch it after the fact.
//   - SAME-SCENE PAIRS. This file is Layer 2 — CROSS-scene links, by
//     design (see the top of this header). A same-scene connotative echo
//     (e.g. two Sphere fragments resonating with each other) is real, but
//     it isn't this file's job: links.js/Layer 1 already covers in-scene
//     linking, on a "Referenced from X" model. A round-3 pass surfaced
//     three same-scene candidates (Sphere's Matrices/In The Flesh and
//     Stolnaphase/Starbought, Scroll's Pygmalion/Identity Theft) and they
//     were excluded here for exactly this reason — genuinely additive
//     material if the site ever wants a same-scene connotative layer, but
//     that's a scope decision for Scott to make deliberately, not
//     something a discovery pass should fold in by default.
//
// This file feeds the Constellation scene (src/scenes/constellation/),
// shipped since v2.5.0 — only 'approved' rows are ever rendered there
// (see getApprovedResonances below), so a 'pending' row added here has no
// live effect until Scott reviews and approves it. Rows 1–20 were reviewed and approved by
// Scott on 2026-08-16 (docs/constellation_resonances.md, "i'm good with
// all of these"). Rows 21–22 were added the same day after Scott pointed
// out that Butterfly has found text too (its own placard title), and
// approved separately ("approved, fold them in") once he'd read them. All
// 22 rows are now 'approved'; a future discovery pass adding more rows
// still starts them at 'pending', same as every round so far.

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
  // ── Added after the 2.4.2 approval round: Butterfly was pointed out as
  // having found text after all — not body copy like the other six, but
  // its own placard title, "Chaos Butterfly in Phase Space, 2026"
  // (src/scenes/butterfly/butterfly.text.js). That title turns out to be a
  // near-verbatim echo of the exact phrase two already-approved pieces use
  // (row 18's own Sphere/Scroll pairing). Reviewed and approved 2026-08-16.
  {
    id: 21,
    basis: 'connotative',
    a: { scene: 'butterfly', id: 1 },
    b: { scene: 'scroll', id: 11 },
    rationale: 'Butterfly\'s entire found text is its own title, "Chaos Butterfly in Phase Space, 2026" — a near-exact echo of Projection\'s own phrase, "a chaos butterfly; a Lorenz attractor; two focal points around which events swirl." The scene is, in effect, a working visualization of the image Projection names outright (it renders a Lorenz attractor; "phase space" is the literal mathematical term for the plot Projection is describing in prose).',
    status: 'approved',
  },
  {
    id: 22,
    basis: 'connotative',
    a: { scene: 'butterfly', id: 1 },
    b: { scene: 'sphere', id: 4 },
    rationale: '"Fractal"\'s catalog phrase "Chaos butterflies... Waveform collapsing" shares the same two words as Butterfly\'s title (singular in the title, plural in the list). Already linked to Projection via row 18 for the identical reason; flagging separately because Butterfly is the one piece on the site that isn\'t just referencing this phrase but is named after it and renders the thing itself, so leaving it out of that existing pairing would be the more arbitrary choice.',
    status: 'approved',
  },

  // ── Round 3 discovery pass (2026-08-17): expanded resonance discovery ───
  // Scott's own instruction for this round: the first pass's high approval
  // rate (22/22) is evidence it was too conservative, not that the corpus
  // is thin, and "quality over coverage, small defensible list" is
  // explicitly retired as a governing instruction — the review gate below
  // (his own read of each row) is the real quality control, not list
  // length. Run as three separate targeted passes across the full corpus
  // (all 8 found-text scenes, read in full for this round) rather than one
  // holistic read: shared vocabulary/imagery beyond the mechanical
  // exact-phrase scanner, emotional/thematic shape independent of shared
  // words, and structural/documentary echoes (direct naming, shared
  // source documents, library notes that already cite a piece by name —
  // row 17's Projection/Truth and Beauty pairing is the existing model for
  // this last category). Deliberately left large and uneven rather than
  // pre-filtered for defensibility, per instruction; every row below is
  // 'pending', additive only — rows 1–22 above are untouched.
  {
    id: 23,
    basis: 'connotative',
    a: { scene: 'sphere', id: 1 },
    b: { scene: 'scroll', id: 2 },
    rationale: '"Stolnaphase"\'s opening — "the angel puckers his lips, waiting for the expected grace from on high, but it never comes... he flies down to Earth" — and "Flying"\'s own visitation — "HE is there, enveloping me, my essence, my body... he has wings, he\'s filling and growing beyond me... power is the fire of heaven under your wings" — both stage a winged figure as the vehicle for a grace that either withholds itself or overwhelms. Independently written, same image system.',
    status: 'pending',
  },
  {
    id: 24,
    basis: 'connotative',
    a: { scene: 'sphere', id: 3 },
    b: { scene: 'library', id: 111 },
    rationale: '"Thalia" describes itself as a mask that outlives its own telling — "I am the construct you project outward... I am the lie you tell yourselves to keep you sane" — the same structure the library\'s own note names in Pale Fire: "a 999-line poem followed by a commentary whose annotator, not the poet, turns out to be the real subject." Both pieces make the frame around a story the actual subject of the story.',
    status: 'pending',
  },
  {
    id: 25,
    basis: 'connotative',
    a: { scene: 'sphere', id: 17 },
    b: { scene: 'library', id: 113 },
    rationale: '"Starbought" names its own resolution outright — "This will be the way, this Slack, this zen" — capitalized exactly the way the library\'s own note identifies the word\'s source: The Book of the SubGenius, "the source scripture of \'Slack\' as a concept... almost certainly where that word entered Scott\'s own private vocabulary for it." A single shared word, but a traceable one — the library note is effectively naming this poem\'s source.',
    status: 'pending',
  },
  {
    id: 26,
    basis: 'connotative',
    a: { scene: 'sphere', id: 17 },
    b: { scene: 'scroll', id: 11 },
    rationale: 'Both pieces independently reach for the same specific, unusual detail — Starbought\'s "Here, on the 32nd floor, the view is spectacular if looked outward, daunting if looking down" and Projection\'s "a second quake shook me while on the 32nd floor of a skyscraper days later" — an oddly precise number to coincide by chance. Below the mechanical scanner\'s phrase-length threshold; found by direct reading.',
    status: 'pending',
  },
  {
    id: 27,
    basis: 'connotative',
    a: { scene: 'sphere', id: 17 },
    b: { scene: 'scroll', id: 8 },
    rationale: 'Starbought\'s earnest "here it is anyway in its raw form, my chi, circulating once more after this daftness" and fireCalamity\'s self-conscious "this isn\'t some New Age bullshit, either... you got chakras, most people call \'em glands" reach for the same body-as-energy-system vocabulary from opposite registers — one sincere, one defensively ironic — which is itself worth noticing rather than a weakness in the pairing.',
    status: 'pending',
  },
  {
    id: 28,
    basis: 'connotative',
    a: { scene: 'sphere', id: 21 },
    b: { scene: 'scroll', id: 11 },
    rationale: 'Algebra works a breakup entirely through equation language — "the variables don\'t change... irrational and nonlinear" — while Projection works the same kind of breakup through physics instead: "a chaos butterfly; a Lorenz attractor; two focal points around which events swirl," the double-slit experiment, Feynman diagrams. Different branch of math/science, same underlying move: a heartbreak rendered legible only by treating it as a fixed structural fact rather than a feeling that could have gone differently — the same argument row 16 makes pairing Algebra with the Symposium, run a second time against a different piece. A separate close-reading pass landed on this exact pair independently, adding one more specific: Projection\'s own fictional bestseller is literally titled Strange Attractors: A Love Affair with Chaos, a mathematician\'s romance — not just the same theme as Algebra, the same conceit.',
    status: 'pending',
  },
  {
    id: 29,
    basis: 'connotative',
    a: { scene: 'sphere', id: 24 },
    b: { scene: 'scroll', id: 11 },
    rationale: 'Aftershock\'s "another quake deep within my core, rumbling to the surface... the ground once more stabilizes" is a metaphor; Projection\'s own account is the literal event underneath it — "I was going through my first earthquake in L.A... a second quake shook me while on the 32nd floor of a skyscraper days later, as I was thinking about moving back to Boston... You can\'t write these things; you can only recount them later." One piece supplies the image, the other supplies the real occasion for it. A separate close-reading pass landed on this same pair independently, describing it the same way: "real heartbreak reframed at cosmic scale... same coping mechanism, different scale."',
    status: 'pending',
  },
  {
    id: 30,
    basis: 'connotative',
    a: { scene: 'sphere', id: 22 },
    b: { scene: 'orbiter', id: 9 },
    rationale: 'Trapdoor\'s "the bottom drops out... I become a conduit, a tunnel, something not myself" and Haiku\'s "It feels like her tongue / Parting the walls of desire / Against both our wills" both frame desire/intimacy as something that happens to the speaker rather than something the speaker does — an involuntary loss of the self\'s own boundary, not a chosen act.',
    status: 'pending',
  },
  {
    id: 31,
    basis: 'connotative',
    a: { scene: 'orbiter', id: 4 },
    b: { scene: 'scroll', id: 9 },
    rationale: 'Raise a Glass stages transformation as literal violence done to a body — "Burnt beyond recognition, Spontaneously from the inside... the bone fragments had their code extracted" — while Identity Theft stages a different transformation the same way: "Something detached... I was staring at my right hand, which clutched what looked like Gary\'s... skin." Both treat becoming something/someone else as a bodily event, not a metaphorical one.',
    status: 'pending',
  },
  {
    id: 32,
    basis: 'connotative',
    a: { scene: 'orbiter', id: 5 },
    b: { scene: 'library', id: 130 },
    rationale: 'The library\'s own note names this poem directly: Planetary is "structurally close to Scott\'s own \'Lament for the Future Never Realized\' (Tesla, Verne, Wells, and Edison conspiring to vanish before their inventions are weaponized)" — exactly Lament\'s own plot (Nikola, Wells, Verne and the assembled inventors resolving to disappear from public view rather than see their machines "usurped... to kill the hope within Man\'s breast"). Not an inferred echo; the library entry is already pointing at this specific poem.',
    status: 'pending',
  },
  {
    id: 33,
    basis: 'connotative',
    a: { scene: 'orbiter', id: 12 },
    b: { scene: 'library', id: 73 },
    rationale: 'The poem is explicitly about noticing you\'re caught inside a repeating structure — "Not deja vu, but a sense of an assumed role / That I\'ve stepped into once again. / We might need a rewrite" — a plain-language description of the same shape Hofstadter spends 800 pages formalizing as a "strange loop," per the library\'s own note (already cited for Finnegans Wake\'s opening/closing sentence elsewhere on that shelf).',
    status: 'pending',
  },
  {
    id: 34,
    basis: 'connotative',
    a: { scene: 'orbiter', id: 6 },
    b: { scene: 'sphere', id: 15 },
    rationale: 'Weaker than the other rows here, flagged as such: Moon Song\'s "the egg giving way to the peacock of fire" and Circumstance\'s "Where the feathers fall, we just don\'t know" both reach for feather/plumage imagery at a moment of uncertain fate, but it\'s a shared image register more than a shared specific word — real, but softer evidence than row 10\'s "boneyard," worth Scott\'s own judgment.',
    status: 'pending',
  },
  {
    id: 35,
    basis: 'connotative',
    a: { scene: 'beamline', id: 2 },
    b: { scene: 'library', id: 127 },
    rationale: 'Beamline\'s bounce 2 is drawn from Storyline.doc, dated 9/30–10/1/2003 (per beamline.text.js\'s own header) — the same document the library\'s Neuromancer note quotes directly: "I cannot use the word matrix anymore, fuck you very much, Wachowski Brothers," cited as evidence of "Scott\'s own 2003 cosmology-in-progress." Bounce 2\'s "we\'re grasping our way towards an analogy... the fucking mirror isn\'t letting anything out" is that same 2003 project in motion — reaching for original vocabulary (lasing medium, focusing mirror) rather than the borrowed word the library note says he\'d already rejected.',
    status: 'pending',
  },
  {
    id: 36,
    basis: 'connotative',
    a: { scene: 'scroll', id: 8 },
    b: { scene: 'library', id: 127 },
    rationale: 'fireCalamity\'s extended rant against The Matrix\'s physics — "No, fuck The Matrix, you\'re not a battery for shitty robots... it\'s all some sort of Gnostic bullshit about a world of lies and shit, but it\'s a shitty metaphor" — and the library\'s Neuromancer note, quoting a separate 2003 document\'s identical refusal ("I cannot use the word matrix anymore, fuck you very much, Wachowski Brothers"), are two different pieces from the same year independently reaching the same specific target for the same reason. A separate close-reading pass found this same pair independently, in the same terms.',
    status: 'pending',
  },
  {
    id: 37,
    basis: 'connotative',
    a: { scene: 'scroll', id: 11 },
    b: { scene: 'library', id: 112 },
    rationale: 'The library\'s own note states this outright: "Scott\'s own The L.A. Project takes its epigraph from this play: \'Not Physics but Ecstatics Makes the Engine Run.\'" Projection is explicitly that project, by its own account — "the project, to write about what happened to me in L.A." — and its entire argument is the epigraph\'s argument staged at essay length: physics and quantum vocabulary (double-slit experiment, Feynman diagrams, parallel universes) reached for again and again to describe something that was never actually about physics. Not an inferred echo — the library entry is naming this piece\'s own epigraph.',
    status: 'pending',
  },
  {
    id: 38,
    basis: 'connotative',
    a: { scene: 'scroll', id: 2 },
    b: { scene: 'library', id: 112 },
    rationale: 'A second, smaller echo of the same source: Flying\'s own word for what it\'s after — "I\'m seeking ekstasis" — is the Greek root of the exact word the library note quotes from this play\'s epigraph, "Ecstatics." Below the mechanical scanner\'s threshold (a single shared root, not a phrase); found by direct reading.',
    status: 'pending',
  },
  {
    id: 39,
    basis: 'connotative',
    a: { scene: 'scroll', id: 3 },
    b: { scene: 'library', id: 121 },
    rationale: '"Thoughts Of Death Abounds" narrates a Yoruba shell divination without ever settling whether it\'s superstition or something real — "An orisha? Then he tapped my hand... Death? It came up 7-9" — the narrator both performing the ritual in earnest and holding it at arm\'s length. That\'s precisely the position the library\'s Daimonic Reality note describes: daimons as "neither literally real beings nor mere psychological projection, but a third category," a question the essay dramatizes rather than answers.',
    status: 'pending',
  },
  {
    id: 40,
    basis: 'connotative',
    a: { scene: 'scroll', id: 11 },
    b: { scene: 'library', id: 25 },
    rationale: 'Projection is the piece that coins the site\'s own "strange attractors" vocabulary — "a chaos butterfly; a Lorenz attractor; two focal points around which events swirl" — and even titles its fictional bestseller after the term (Strange Attractors: A Love Affair with Chaos). Gleick\'s book is the real, nontechnical popularization of exactly that vocabulary sitting on Scott\'s own shelf — the reference the essay\'s metaphor is drawing on, not a coincidence of two pieces landing on the same word independently.',
    status: 'pending',
  },
  {
    id: 41,
    basis: 'connotative',
    a: { scene: 'butterfly', id: 1 },
    b: { scene: 'library', id: 25 },
    rationale: 'Butterfly\'s whole found text is its own placard title, "Chaos Butterfly in Phase Space, 2026," already linked to Projection and Fractal for sharing that phrase (rows 18/21/22). Gleick\'s book is the nonfiction source underneath all three — the actual popular-science text that put "chaos," "phase space," and "the butterfly effect" into circulation as a single cluster of terms, making this the fourth and most literal node in that cluster rather than a fifth coincidence.',
    status: 'pending',
  },
  {
    id: 42,
    basis: 'connotative',
    a: { scene: 'scroll', id: 11 },
    b: { scene: 'theater', id: 4, beatId: 217 },
    rationale: 'Projection names this directly: "I have another friend, Chris Sadler. I used him as the basis for a character in two scripts... He became a character in my scripts as a free spirit, mad, unhinged yet unabashedly vital and dynamic." Theater\'s own Sadler — introduced here as "Zen and scruffy," holding court from a wheelchair, mid-shoot on a deliberately unhinged marshmallow-fluff epic — is that character on stage. Same relationship as row 17\'s Kirstin/Euterpe pairing, a second named character instead of the first. A separate close-reading pass landed on this same pair independently ("verifiable against both texts directly, distinct from the already-established Brian/Jeremy origin link") — see also the two other, genuinely distinct Projection/Truth-and-Beauty threads added below (Kirstin\'s Lysander note, beat 363).',
    status: 'pending',
  },
  {
    id: 43,
    basis: 'connotative',
    a: { scene: 'theater', id: 4, beatId: 229 },
    b: { scene: 'library', id: 108 },
    rationale: 'Sadler\'s cast explains their absurd movie lore with a single deadpan line — "How do you all know this?" / "Ouija board." — the exact device Merrill spent twenty-five years of actual transcripts turning into a 560-page epic, per the library\'s own note. Same channeling apparatus, opposite register: one played for a laugh line, one taken seriously enough to become The Changing Light at Sandover. A separate close-reading pass landed on this same pair independently — worth noting since another new row below (Sadler\'s "Channeling." beat, also paired with this same SubGenius book) is a related but distinct find, not a restatement of this one.',
    status: 'pending',
  },
  {
    id: 44,
    basis: 'connotative',
    a: { scene: 'theater', id: 6, beatId: 360 },
    b: { scene: 'library', id: 132 },
    rationale: 'The bicycle messenger who delivers Brian\'s letter is given one unmistakable detail — "he notices the messenger\'s sneakers have wings painted on the heels" — literal Hermes iconography attached to a minor background character. The library\'s own note on Hyde\'s book names Hermes specifically as "a single figure who exists to cross boundaries that are supposed to be uncrossable," exactly this messenger\'s narrative function: he\'s the one who crosses from a stranger at the door into the letter that reopens Brian and Kirstin\'s story.',
    status: 'pending',
  },
  {
    id: 45,
    basis: 'connotative',
    a: { scene: 'theater', id: 10, beatId: 513 },
    b: { scene: 'library', id: 137 },
    rationale: 'Satan\'s voice breaks the fourth wall to call it out directly — "Don\'t even try to lie, Horace, you were talking to the audience" — a play openly admitting its own performed reality mid-scene. The library\'s note on wrestling\'s kayfabe describes the same structure played straight: "the collectively maintained fiction that scripted violence is real... its own kind of belief technology." One names the fiction as a joke, the other studies it as a real social mechanism.',
    status: 'pending',
  },
  {
    id: 46,
    basis: 'connotative',
    a: { scene: 'theater', id: 8, beatId: 445 },
    b: { scene: 'library', id: 147 },
    rationale: 'Alex and Jeff\'s drunk 3am bit — "I want to be God Emperor of the planet" / "And what does that make me?" / "Goddess Empress" — is played entirely for laughs, but it\'s structurally the same fantasy Nobilis builds an entire game around, per the library\'s note: "players anchor a Power — Death, the Sun, Entropy itself — into a human vessel." One is a joke two friends make up on a couch; the other is a whole rules system for taking the same joke seriously.',
    status: 'pending',
  },

  // ── Second discovery pass (2026-08-18): a separate close read of the
  // full corpus, run independently of the round-3 pass above (same
  // instruction — no pre-filtering for defensibility, weaker candidates
  // flagged rather than cut). Five of that pass's candidates turned out
  // to be the same pair as an existing row above (28, 29, 36, 42, 43) —
  // each of those rationales was appended with a one-line note rather
  // than duplicated into a new row, since two independent passes landing
  // on the same connection is itself worth recording. Three more (Sphere
  // Matrices/In The Flesh, Sphere Stolnaphase/Starbought, Scroll
  // Pygmalion/Identity Theft) were same-scene pairs, excluded per the
  // standing exclusion documented at the top of this file. What follows
  // is everything else from that pass: genuinely new, cross-scene,
  // non-duplicate candidates.
  {
    id: 47,
    basis: 'connotative',
    a: { scene: 'orbiter', id: 4 },
    b: { scene: 'beamline', id: 5 },
    rationale: 'Raise a Glass\'s "the glass resonated, the Brownian motion harmonized with a frequency echoed by angels" lands in the same vocabulary as the verbatim harps/superstrings cluster above (rows 1–2, also sourced through Beamline\'s bounce 5) — independently, no shared source text, just the same resonance/vibration register reached for from a different poem entirely.',
    status: 'pending',
  },
  {
    id: 48,
    basis: 'connotative',
    a: { scene: 'sphere', id: 5 },
    b: { scene: 'scroll', id: 8 },
    rationale: 'Digression #1\'s abstract Southland apocalypse-dread — "we dig for fire... we keep watch on the fault lines and fractures, waiting for what will spit up through the cracks... we tend the flames" — and fireCalamity\'s literal wildfire, visible in the middle distance during a party while characters joke about it, are the same regional anxiety at two different removes: one mythologized into ritual language, one staged as background color nobody in the scene takes seriously enough.',
    status: 'pending',
  },
  {
    id: 49,
    basis: 'connotative',
    a: { scene: 'sphere', id: 16 },
    b: { scene: 'scroll', id: 2 },
    rationale: 'Wingspan\'s catalog opens with flight imagery ("Free flight, gliding over wheat fields") among dozens of other fragments; Flying is the full narrative version of that same image — terror, freefall, and an eventual release, ending "I\'m flying. Finally." A catalog entry and the complete arc it comes from.',
    status: 'pending',
  },
  {
    id: 50,
    basis: 'connotative',
    a: { scene: 'sphere', id: 8 },
    b: { scene: 'orrery', id: 1 },
    rationale: 'Both pieces use the actual word "synchronicity" for the same underlying question: Called Shot\'s "Was it coincidence? Synchronicity?" over a lightning strike that seems to follow the narrator\'s own pointing finger, and the Orrery\'s "our synchronicity sensitives finding a common link" between a news item and a lawsuit. A memoir fragment and an invented cosmology, same specific word for the same kind of maybe-meaningful coincidence.',
    status: 'pending',
  },
  {
    id: 51,
    basis: 'connotative',
    a: { scene: 'sphere', id: 9 },
    b: { scene: 'library', id: 89 },
    rationale: 'Joycean is a deliberate Wake-style portmanteau piece ("Crimkranng off the sodden walls... unbound and unhinged, careening like a bumper car") sitting in the same corpus as the library\'s own entry on the book it\'s imitating, whose note even names the specific formal device ("strange loop") this fragment is playing with rather than just referencing.',
    status: 'pending',
  },
  {
    id: 52,
    basis: 'connotative',
    a: { scene: 'sphere', id: 14 },
    b: { scene: 'scroll', id: 5 },
    rationale: 'Quiver\'s "Here are harps, here are superstrings. Pluck at them both, send me vibrating" — wanting to be played, surrendered to, tender — and Self-Mutilation\'s profane, escalating comedy of deliberate self-surrender are the same structural move at opposite registers: giving yourself over to something as its own kind of proof. Distinct from row 12 above (Everything\'s A Number, a different Sphere piece, paired with this same Self-Mutilation for a different reason — pain as a route to relief, not surrender as proof).',
    status: 'pending',
  },
  {
    id: 53,
    basis: 'connotative',
    a: { scene: 'orbiter', id: 8 },
    b: { scene: 'scroll', id: 5 },
    rationale: 'The Lovers\' "physics has a heart all its own" — control overtaken by something outside the self — against Self-Mutilation\'s deliberate self-surrender played as body horror: the same structural move as row 52 above, reached a second time from a different Orbiter poem. Worth reviewing both Sphere-Quiver and Orbiter-Lovers against Self-Mutilation together rather than picking one, since they\'re making a related but not identical claim.',
    status: 'pending',
  },
  {
    id: 54,
    basis: 'connotative',
    a: { scene: 'scroll', id: 11 },
    b: { scene: 'theater', id: 13, beatId: 603 },
    rationale: 'Projection floats the idea that a stranger encountered in L.A. might be a scripted actor sent to nudge the day toward something ("this little scene you witnessed is one of the pivot points of the forward motion of space-time"). You\'ve Got a Friend in Satan makes the identical premise literal: Horace\'s pitch — "I\'ve been sent here to ask you kindly for your souls, for which, in return, you will get ANYTHING you want" — and Art really do perform a script that reshapes four strangers\' lives, beat by beat.',
    status: 'pending',
  },
  {
    id: 55,
    basis: 'connotative',
    a: { scene: 'theater', id: 4, beatId: 276 },
    b: { scene: 'library', id: 113 },
    rationale: 'Sadler\'s single-word answer for how he knows an invented piece of movie lore — "Channeling." — right after swallowing a spoonful of marshmallow fluff "to honor our subject," is mock-devotion played as a bit. The library\'s own note calls the source of "Slack" real scripture for the Church of the SubGenius. Same register — absurd material handled with genuine devotional seriousness — landed on independently: a 2001 script and a 2026 shelf note.',
    status: 'pending',
  },
  {
    id: 56,
    basis: 'connotative',
    a: { scene: 'sphere', id: 15 },
    b: { scene: 'scroll', id: 4 },
    rationale: 'Circumstance and Pygmalion both state the persona-theory explicitly rather than only dramatizing it: "we can only come to understand that our roles are so much more flexible than we ever think they are" against "there are two modes of sensing... projection and observation... we create a person, and we trust that it\'s accurate." A statement-of-thesis pairing, one level up from the dramatized instances (Identity Theft, Archibald Query) this file already links elsewhere.',
    status: 'pending',
  },
  {
    id: 57,
    basis: 'connotative',
    a: { scene: 'sphere', id: 20 },
    b: { scene: 'theater', id: 3, beatId: 150 },
    rationale: 'Steamroll\'s "Why are you keeping me at arms\' length?" / "If I don\'t, you\'ll flatten me" and Kirstin\'s "It\'s scary to embrace something you love. Because love is lack of control, being at the mercy of something else" are the same specific claim: guardedness as protection from being overwhelmed by something wanted, not from indifference to it.',
    status: 'pending',
  },
  {
    id: 58,
    basis: 'connotative',
    a: { scene: 'sphere', id: 23 },
    b: { scene: 'scroll', id: 6 },
    rationale: 'Current\'s impressionistic weather-as-mood ("skittery across wavelines, turbulence... the anticipation, the knowledge of what will be, the settling sun") and Cartography\'s explicit staged physics of a single raindrop\'s fall are the same vehicle — a real or quasi-real physical process — used to meditate on inevitability, one worked out in full mechanical detail, the other left as mood.',
    status: 'pending',
  },
  {
    id: 59,
    basis: 'connotative',
    a: { scene: 'sphere', id: 17 },
    b: { scene: 'theater', id: 13, beatId: 603 },
    rationale: 'Starbought demands a sign from an indifferent god who never quite answers — "Show me an act of God to shatter this enclave... what one expects of any reasonably competent deity." Horace\'s pitch offers exactly that transaction from the other direction, and someone in the room takes the deal a few beats later. Same plea, unanswered in one piece and answered in the other.',
    status: 'pending',
  },
  {
    id: 60,
    basis: 'connotative',
    a: { scene: 'orbiter', id: 9 },
    b: { scene: 'scroll', id: 11 },
    rationale: 'A deliberate inversion, not a similarity: Haiku ends on effortless creative flow — "When pen hits paper, / Thought meets fiction, and the words / Flow forth perfectly" — while Projection is an entire essay about that not happening, "going nowhere. Around and around in circles." Same subject (writing as a channel for feeling), opposite outcome. Distinct from row 30 above, which pairs this same Haiku with Sphere\'s Trapdoor for a different reason (desire as involuntary loss of self).',
    status: 'pending',
  },
  {
    id: 61,
    basis: 'connotative',
    a: { scene: 'theater', id: 8, beatId: 444 },
    b: { scene: 'sphere', id: 6 },
    rationale: 'A group of friends inventing shared fantasy roles together after a chaotic night ("We\'ll all become rich and own the world... I call Towel Boy... Can I be the Bard?") and Digression #2\'s account of the same impulse in miniature — "we find someone that has a high caliber of energy... invented some rules and just let the whole thing run its course" — are both about a found group improvising arbitrary shared meaning on the spot, one at party-scene length, one compressed into a paragraph.',
    status: 'pending',
  },
  {
    id: 62,
    basis: 'connotative',
    a: { scene: 'scroll', id: 11 },
    b: { scene: 'theater', id: 6, beatId: 363 },
    rationale: 'A third, distinct thread between this pair — beyond row 17\'s Kirstin-naming and row 42\'s Sadler-sourcing above. Projection invokes "Titania and Oberon... standing by the pool" as the register for how unreal L.A. felt, a fae-enchantment metaphor. Truth and Beauty\'s closing beat has Kirstin suggesting Brian for Lysander in an actual, real production of A Midsummer Night\'s Dream — the same play, metaphor in one piece and literal plot in the other.',
    status: 'pending',
  },
  {
    id: 63,
    basis: 'connotative',
    a: { scene: 'orbiter', id: 10 },
    b: { scene: 'library', id: 108 },
    rationale: 'Weaker, flagged as such: DNA\'s sacred genetic "sequence... Word and phrase manifesting character" and the library\'s note on Sandover\'s channeled scripture are both about revelation arriving pre-encoded in a text, but the echo is abstract — a real resonance in kind, not in any shared specific image, worth Scott\'s own read rather than a confident claim either way.',
    status: 'pending',
  },
  {
    id: 64,
    basis: 'connotative',
    a: { scene: 'orbiter', id: 1 },
    b: { scene: 'theater', id: 3, beatId: 150 },
    rationale: 'Weaker, flagged as such, included for completeness rather than pushed hard: Courtesans of the Old World\'s untouchable, transactionally-guarded women ("hidden behind bulletproof glass, isolated and precious beyond words") loosely rhyme with Kirstin\'s own guardedness in the same beat already linked above (row 57) — looser than that pairing, more mood than argument.',
    status: 'pending',
  },
];

// ─── Query helpers ──────────────────────────────────────────────────────────
// Same shape as links.js's getOutboundLinks/getInboundLinks, for the two
// consumers Phase 3 actually has: the Constellation scene itself (needs
// every approved row, full stop) and each found-text scene's own panel
// code (needs "does the piece I'm currently showing participate in any
// approved resonance" — the thread-follow entry point).

// Every row the Constellation scene should render as a strand. Only
// 'approved' — 'pending'/'rejected' rows exist for the review record, not
// for display.
export function getApprovedResonances() {
  return RESONANCES.filter(r => r.status === 'approved');
}

// Round 10 (2026-08-18): Harmonics' "living atmosphere" — faint, unlit,
// independently drifting points representing the pieces named in rows
// still awaiting review. Deliberately NOT the same query as approved rows:
// this is an honest picture of the system's actual current state (more
// connections found than confirmed, some always still in motion), not
// decoration invented for its own sake — see constellation.js's own
// comment where this is consumed for how these render (never Kuramoto-
// coupled, no full payoff panel). 'rejected' rows are excluded on purpose:
// Scott already looked at those and said no, so surfacing them again,
// even faintly, would contradict a real decision rather than just show
// an in-progress one.
export function getPendingResonances() {
  return RESONANCES.filter(r => r.status === 'pending');
}

function endpointMatches(ep, scene, id, beatId) {
  if (ep.scene !== scene) return false;
  if (scene === 'theater') return beatId !== undefined && ep.beatId === beatId;
  return ep.id === id;
}

// Approved rows where the given piece is either endpoint — what a scene's
// panel checks to decide whether to show a thread-follow filament next to
// whatever's currently open. `beatId` only matters for theater; every
// other scene passes just (scene, id).
export function getResonancesForPiece(scene, id, beatId) {
  return RESONANCES.filter(r =>
    r.status === 'approved' &&
    (endpointMatches(r.a, scene, id, beatId) || endpointMatches(r.b, scene, id, beatId))
  );
}
