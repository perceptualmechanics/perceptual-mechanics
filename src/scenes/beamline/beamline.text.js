// ─── Beamline: the text ────────────────────────────────────────────────────
// All found text, sourced from Compendion.pages and Storyline.doc (Scott's
// personal writing archive, outside this repo) — no new writing anywhere
// in this piece, per the site's own standing no-new-writing rule. Ten
// bounces total, each carrying a fragment of a found passage.

// Primary epigraph — a complete, aphoristic line, same register as
// Orbiter's Kenney epigraph and the Spoonfed "If God is white light" line.
// Shown as the piece's own title-adjacent line.
export const EPIGRAPH_PRIMARY = 'The body is the prism of the dream.';

// Secondary/framing epigraph — very likely the actual naming-origin
// sentence for Kinetic Muse itself. Shown as a quieter line beneath the
// primary epigraph, the way Orrery layers a title line with a subtitle.
export const EPIGRAPH_SECONDARY = 'life has to go somewhere';

// One fragment per mirror. Most passages are split across two bounces at
// their own natural pauses, so each bounce reveals the next real fragment
// rather than the whole passage sitting static on one mirror; the
// electron-beam and laser/mirror passages each stay a single, undivided
// bounce, since the line that names each phenomenon most directly (e.g.
// "THE MIRROR") is the payoff, and splitting it would blunt it.
//
// **`passage` is why there are no totals in this paragraph.** Which bounces
// belong to which passage used to live only in the per-bounce comments below,
// and this header used to add them up for you: "Six found passages (nine
// fragments total)". There are ten fragments and seven passages, and both
// numbers had been wrong long enough to be quoted elsewhere. The grouping is
// a field now, so `scripts/verify-counts.mjs` derives both from the array and
// this comment does not have to.
//
// Placement: bounce 0 is the mirror closest to the beam's literal origin
// point, which is why the electron-beam passage sits there. The rest are
// staged in a loose arc as the beam travels outward: grounded/mechanical
// (electron beam) → real laser/mirror physics → focus/perception →
// musical (harps/superstrings) → elemental (lightning tetrahedrons) →
// cosmic (seven-colored/prisms).
export const BOUNCES = [
  {
    id: 1,
    passage: 'electron-beam',
    // Electron/CD passage — written 2008, no relationship to this piece,
    // genuine electron-beam-physics language ("channel of electrons,
    // glowing orange-red"). Single bounce, closest to the source.
    text: '...every solid-state hum of vacuum tubes warming up the channel of electrons, glowing orange-red on the back of the CD cover.',
  },
  {
    id: 2,
    passage: 'laser-mirror',
    // Find #1 — Storyline.doc, entry dated 9/30–10/1/2003, confirmed
    // identical across the original file and two independently-dated
    // backup copies. Single, undivided bounce — "THE MIRROR" is the
    // payoff line, same reasoning as the electron-beam passage.
    text: "HOLY CRAP! Lasers get hot! They need to be cooled! I swear this makes sense! Because I'm always, always, ALWAYS craving cold water! And me thinking about lasers and whatnot as a useful metaphor – jesus, there's a gem in my heart focusing all this light within and through me – oh my god, I'm the lasing medium…and the laser…no, wait, the light pours through me…and my psyche and mind and body are the medium…and the laser light is that which comes out of me. We're grasping our way towards an analogy, but jumping jesus…this could be something…and my third eye is the focusing mechanism – THE MIRROR – the fucking mirror isn't letting anything out",
  },
  {
    id: 3,
    passage: 'crystal-refractor',
    // Find #2a — Storyline.doc, ~9/29–30/2003, same cross-copy
    // verification as Find #1. A separate diary entry from 2b below, not
    // joined or ellipsis-bridged (that would be new writing the source
    // doesn't make).
    text: 'Circle the lenses over the crystal refractor of your heart.',
  },
  {
    id: 4,
    passage: 'lenses',
    // Find #2b — Storyline.doc, same week as 2a, same verification.
    text: 'I was just thinking, "I need focus," and suddenly I pictured lenses at my feet and at the top of my head (especially at my feet, though), and now things are definitely coming back into focus! How odd! Just saying the word evoked the image which affected the body.',
  },
  {
    id: 5,
    passage: 'harps-superstrings',
    // Harps/superstrings, part one.
    text: 'Here are harps, here are superstrings.',
  },
  {
    id: 6,
    passage: 'harps-superstrings',
    // Harps/superstrings, part two — same passage as part one.
    text: "Pluck at them both, send me vibrating, harmonics echoing at mathematically precise points... my own bow waits to be bent.",
  },
  {
    id: 7,
    passage: 'lightning-tetrahedrons',
    // Lightning tetrahedrons, part one.
    text: 'Microscopic lightning tetrahedrons shimmering in air for half a second and then phasing out...',
  },
  {
    id: 8,
    passage: 'lightning-tetrahedrons',
    // Lightning tetrahedrons, part two — split at the same ellipsis pause
    // the source text already has.
    text: 'union of heaven and earth, union of thought and action, union of spark and fusion, the blend, the soul and psyche, the divine fire.',
  },
  {
    id: 9,
    passage: 'prisms',
    // Seven-colored/prisms, part one.
    text: 'Seven-colored, prisms, starlight...',
  },
  {
    id: 10,
    passage: 'prisms',
    // Seven-colored/prisms, part two.
    text: 'Vibrating at a different frequency. Harmonics, tuning.',
  },
];
