// ─── Outside — cosmology data (the five Power Sources, their Folk
// Origins, and the two cross-cutting Origins at the center) ────────────────
// Round 3 pivot (2026-08-24): the 7-vs-11 OER/Apherion projection thesis
// (Apherion's eleven-dimension Muses list, OER's rank-7 account) is fully
// retired — Scott's call after seeing it live twice. This scene now maps a
// different, simpler structure: the five Power Sources and the Folk Origins
// attached to each of them. Every name below is transcribed from Scott's own
// Holography.scriv project notes (the same source the retired build used),
// nothing invented — per the site's standing no-new-writing rule.
//
// Sources:
//  - Power Source → angel pairing: verbatim, a journal passage (content.rtf,
//    Data/4BC83498-…): "these devices of Gabriel's — wait wait, only the
//    portable hell is his. The chaos engine is Nature's; the black hole is
//    Emmanuel's; the antimatter bottle is Raphael's. The only one missing is
//    Michael's… The bright idea." ("Singularities" here is that same "black
//    hole" — the two terms already used interchangeably for this Power
//    Source in the retired build's own data.)
//  - Folk Origin names and category descriptions: the "Folk" document
//    (content.rtf, Data/76636C32-…) — Celestials and Divinities, Magi, Psi,
//    Fae, Elementals, Naturals, Quick and Infernals are all settled,
//    already-written categories there.
//  - Tempered and Psychopomps: NOT yet in the Folk document itself, but
//    fully specified in the project's own Notes checklist (content.rtf,
//    Data/86233CF1-…) as "New Folk Origin" entries — Psychopomps has full
//    drafted prose ready to drop in, Tempered's concept is locked with a
//    detailed three-wing writeup, prose not yet drafted. Both are real,
//    settled project vocabulary, not invented for this scene.
//
// The Power-Source ↔ Origin pairing itself (which Origin(s) sit on which
// petal) is Scott's own direction for this scene, not independently
// re-derived — every term used is established vocabulary, per the above.

export const POWER_SOURCES = [
  {
    device: 'The Portable Hell',
    angel: 'Gabriel',
    origins: ['Quick and Infernals'],
  },
  {
    device: 'The Bright Idea',
    angel: 'Michael',
    origins: ['Tempered'],
  },
  {
    device: 'The Antimatter Bottle',
    angel: 'Raphael',
    origins: ['Psychopomps'],
  },
  {
    device: 'Singularities',
    angel: 'Emmanuel',
    origins: ['Celestials and Divinities'],
  },
  {
    // Nature's own Power Source. Deliberately fuller than the other four:
    // Nature is already established in the notes as a trine, not a single
    // point ("the chaos engine is Nature's" sits alongside Nature already
    // carrying three Folk Origins at once) — the flower's one compound,
    // three-lobed petal cluster renders that asymmetry directly rather
    // than smoothing it into four-plus-one uniformity.
    device: 'The Chaos Engine',
    angel: 'Nature',
    origins: ['Naturals', 'Fae', 'Elementals'],
  },
];

// Magi and Psi: the one cross-cutting axis (will versus mind) that isn't
// anchored to any single Power Source — both are "capacity-based" Origins
// in the notes' own language (the Tempered entry describes itself as
// "a capacity-based Origin, like Magi, not place-based"), unlike the five
// petals above, which are each tied to one device/angel. Center of the
// flower, not a sixth petal.
export const CENTER_ORIGINS = ['Magi', 'Psi'];

// The newest two Origins in the whole cosmology, landed on the two Power
// Sources nothing else had claimed (Michael, Raphael) — Tempered and
// Psychopomps were both still open "New Folk Origin" entries in the Notes
// checklist as of this session. Used for the optional faint marker glow.
export const NEWEST_ORIGINS = ['Tempered', 'Psychopomps'];
