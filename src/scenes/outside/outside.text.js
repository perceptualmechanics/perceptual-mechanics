// ─── Outside — cosmology data (Apherion's eleven dimensions, the five
// Sources of Power, OER's rank-7 account, Michael/Gabriel/Lucifer) ─────────
// Every name and keyword here is transcribed verbatim from Scott's own
// Holography.scriv project notes (uploaded 2026-08-24) — nothing invented.
// Per the site's standing rule, no new writing: what's on screen is found
// text, same as every other scene's own .text.js.
//
// Round 2 correction (2026-08-24): the scene itself no longer displays
// ANY of this as text — no panel, no labels (see outside.js's own round-2
// header note). DIMENSIONS' names/keywords and ACCOUNTS' labels are kept
// here anyway as the underlying source-of-truth data (dimension NAMES/
// indices still drive outside.js's math and comments even though the
// keyword lists themselves aren't rendered), not dead weight — same
// "content lives in its own .text.js regardless of how it's currently
// consumed" convention every other scene's data module follows.
//
// Source: Holography.scriv/Files/Data/.../content.rtf ("Notes"), the
// section headed "Apherion's eleven-dimension cosmology, mapped to the
// Muses" — marked settled/Reference, not a pending item. Order (1–11) and
// every keyword preserved exactly as written.
export const DIMENSIONS = [
  { name: 'Eurydice',        keywords: ['Death', 'Tragedy', 'Loss', 'Change', 'Despair', 'Ordeal', 'Emergence', 'Song', 'Wisdom', 'Return', 'Persephone', 'Anger'] },
  { name: 'Clio',            keywords: ['Time', 'Marijuana', 'Survey', 'Amplify', 'Recursive', 'Analysis', 'Systems', 'Language', 'Code', 'Math', 'Electronics', 'Insight', 'Meta', 'The Programmer', 'Chaos', 'Accounting', 'Loops', 'Iteration'] },
  { name: 'Thalia',          keywords: ['Prime', 'Magic', 'Inspiration', 'Truth', 'Generator', 'Soul', 'Adamant', 'Magus', 'Mercury', 'Joy', 'Wonder', 'The World', 'Writing'] },
  { name: 'Urania',          keywords: ['Mind', 'Plato', 'Forms', 'Designs', 'Phoenix', 'Manifestation', 'The Veil', 'The Surround', 'Transformation', 'Angels', 'Daniel', 'Silver', 'Screens'] },
  { name: 'Mnemosyne',       keywords: ['Life', 'Light', 'Serenity', 'Chaos', 'Sky', 'Flow', 'Priest', 'Egypt', 'God Biology', 'Sun', 'Freyr', 'Einstein', 'Michael'] },
  { name: 'Terpsichore',     keywords: ['Space', 'Correspondence', 'Principles', 'Hermetic', 'Focus', 'Flow', 'Commerce', 'Resolution', 'Balance', 'Brahma', 'Kubrick', 'Buddhism', 'Martial Arts', 'Perception', 'Electricity'] },
  { name: 'Euterpe',         keywords: ['Forces', 'Love', 'Romance', 'Journeys', 'Fury', 'Infinity', 'Counterpoint', 'Score', 'Bard', 'Apollo', 'Lightning', 'Me', 'The Storm'] },
  { name: 'Erota',           keywords: ['Spirit', 'Chemistry', 'Prana', 'Imbas', 'Druid', 'Celestial', 'Moon', 'Rabbit', 'Gold', 'Arcadia', 'Shaman', 'Astral'] },
  { name: 'Calliope',        keywords: ['Matter', 'The Work', 'Play', 'Vignette', 'Alchemy', 'Wealth', 'Holography', 'Construct', 'Work', 'Information Artistry', 'Nabokov', 'Butts', 'Raphael', 'Money', 'Gravity'] },
  { name: 'Aphrodite',       keywords: ['Fate', 'Divinity', 'Beauty', 'Illusion', 'Glamour', 'Freya', 'Eros', 'Sex', 'Slack', 'Water', 'Emmanuel'] },
  { name: 'The Kinetic Muse', keywords: ['Unity', 'Synthesis', 'Syncretism', 'Arts', 'Sciences', 'Work', 'Information', 'Nature', 'Frigg', 'Weaving', 'Rose and Platinum', 'Shakespeare', 'Experience', 'Shekinah', 'Archer', 'Ranger', 'All at Once', 'Waveform Collapse', 'Psionics', 'Psyche', 'Air'] },
];

// ─── The five Sources of Power ──────────────────────────────────────────────
// Verbatim from "Sources of Power": "The bright idea, the singularity, the
// antimatter bottle, the portable hell, and the chaos engine." Each is
// anchored to one of the eleven dimensions above (index into DIMENSIONS).
// Anchoring confidence noted honestly — only the Chaos Engine's anchor is
// already established in the source (Notes.txt: Nature is "diffuse
// substrate ... the Chaos Engine," and Nature is itself a Kinetic Muse
// keyword). The other four are inferred from each Power Source's own
// Interlude chapter, reviewed and approved 2026-08-24 — not claimed as
// pre-existing canon.
export const POWER_SOURCES = [
  {
    name: 'The Portable Hell',
    dimension: 0, // Eurydice — Death/Tragedy/Loss/Despair/Wisdom; the Interlude is grief and perceptual distortion through loss
    excerpt: 'The portable hell is a vestigial appendage of the psyche, the appendix of the soul... The trick of the portable hell is that it is reflective only on the inside, like a funhouse mirror.',
  },
  {
    name: 'The Bright Idea',
    dimension: 1, // Clio — Systems/Accounting/Loops/Iteration; growth with no natural stopping point
    excerpt: 'Bright Idea was defined as an unfettered idea with no natural stopping point — additive, not self-limiting, the endless loop around a cyclotron.',
  },
  {
    name: 'Singularities',
    dimension: 4, // Mnemosyne — carries "Einstein" as a keyword directly
    excerpt: 'We used to think singularities were rare, but as it turns out, they’re embarrassingly common.',
  },
  {
    name: 'The Antimatter Bottle',
    dimension: 8, // Calliope — Matter; Antimatter as its direct conceptual negation (no body text exists for this Interlude, title only)
    excerpt: null,
  },
  {
    name: 'The Chaos Engine',
    dimension: 10, // The Kinetic Muse — established: Nature's diffuse substrate, "dark matter, dark energy, the Chaos Engine"
    excerpt: 'Any attempt to deliberately build a chaos engine never works. Chaos engines are emergent phenomena.',
  },
];

// ─── OER's rank-7 account ───────────────────────────────────────────────────
// OER (Overland, Edwards, and Rouch) — a global economic conglomerate that
// "has only ever viewed the Veil and Surround as resources to be sold."
// Which four dimensions this account drops has no precedent anywhere in the
// notes; chosen 2026-08-24 against OER's own documented character rather
// than invented arbitrarily. KEPT are OER's literal operating vocabulary
// (Accounting, Wealth, Commerce) or its dream-factory/mediasphere business
// (Manifestation, Screens, Glamour, Infinity). DROPPED are the four a pure
// extraction-and-growth entity is structurally blind to: grief/mortality-
// wisdom (Eurydice), soul/truth/wonder (Thalia), embodied spirit (Erota),
// and holistic synthesis — the literal opposite of one-directional growth
// (The Kinetic Muse). Two of these four (Eurydice, Thalia) independently
// matched an earlier, unverified guess — a decent cross-check, not proof.
export const OER_DROPPED = [0, 2, 7, 10]; // Eurydice, Thalia, Erota, The Kinetic Muse
export const OER_KEPT = DIMENSIONS.map((_, i) => i).filter(i => !OER_DROPPED.includes(i));

// ─── Michael / Gabriel / Lucifer ────────────────────────────────────────────
// Verbatim, Lucifer's own document: "I am the intersection of Michael and
// Gabriel." Michael carries forward as a Mnemosyne keyword (dimension 4) —
// the only one of the two with any other anchor in the notes — so both
// points sit along that axis, opposite each other, with Lucifer always
// exactly at their midpoint: not a third point, literally their
// intersection, matching the line above.
export const LUCIFER_LINE = 'I am the intersection of Michael and Gabriel.';
export const MICHAEL_GABRIEL_AXIS = 4; // Mnemosyne

// ─── Accounts ────────────────────────────────────────────────────────────────
// Extensible list of named projections. Apherion and OER ship first;
// Ring of Light and the Machinists' Union are both real, defined factions
// (Factions.txt) and safe future additions once they have their own
// projection matrices defined — nothing here needs a structural rework to
// add them.
export const ACCOUNTS = {
  apherion: { label: 'Apherion', rank: 11 },
  oer: { label: 'OER', rank: 7 },
};
