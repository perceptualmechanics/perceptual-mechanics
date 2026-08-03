// ─── Beamline: the text ────────────────────────────────────────────────────
// All found text, newly located in Compendion.pages (2026-07-31) and
// confirmed unused elsewhere on the site — no new writing anywhere in this
// piece, per the site's own standing no-new-writing rule. Staged exactly as
// handed off in the brief; this sandbox has no access to Compendion.pages
// itself (it lives outside the connected folder, same as every other piece
// of source material — see NOTES.md's "housekeeping" entry), so the
// wording below is copied from the brief verbatim, ellipses included,
// rather than independently re-checked against the source file. Worth a
// quick confirm against Compendion.pages directly before this ships, the
// same "not independently verifiable" caveat this project always flags
// when a source can't be checked from here. Two more passages were added
// in the 2026-07-31 scale-up (six-to-eight-mirror pass) — same caveat
// applies to those as to the original three.
//
// 2026-08-02: three more fragments added, this time sourced from
// Storyline.doc (Scott's personal writing archive, outside this repo —
// same "handed off in the brief, not independently re-checked" caveat as
// everything above) rather than Compendion.pages. The brief verified these
// against two independently-dated backup copies of the same document
// before calling the wording stable. Ten bounces total now — past the
// 6-8 "real EUV lithography paths" range the seven-mirror count was
// originally justified against; going to 10 was Scott's explicit call
// when asked directly, not a default assumed here.

// Primary epigraph — a complete, aphoristic line, same register as
// Orbiter's Kenney epigraph and the Spoonfed "If God is white light" line
// (that one now lives on the shelved Prism). Shown as the piece's own
// title-adjacent line.
export const EPIGRAPH_PRIMARY = 'The body is the prism of the dream.';

// Secondary/framing epigraph — very likely the actual naming-origin
// sentence for Kinetic Muse itself. Shown as a quieter line beneath the
// primary epigraph, the way Orrery layers a title line with a subtitle.
export const EPIGRAPH_SECONDARY = 'life has to go somewhere';

// Six found passages (nine fragments total), staged one fragment per
// mirror across ten bounces. Most passages are split across two bounces at
// their own natural pauses, so each bounce reveals the next real fragment
// rather than the whole passage sitting static on one mirror; the
// electron-beam and laser/mirror passages each stay a single, undivided
// bounce — the electron-beam one by Scott's explicit direction from the
// 2026-07-31 pass, the laser/mirror one by the same reasoning (Find #1's
// brief): the line that names the phenomenon most directly ("THE MIRROR")
// is the payoff, and splitting it would blunt it the same way.
//
// Placement: bounce 0 is the mirror closest to the beam's literal origin
// point (verified by script — see NOTES.md), which is why the
// electron-beam passage sits there, same as every prior pass. The rest
// are staged in a loose arc: grounded/mechanical (electron beam) → real
// laser/mirror physics (Find #1, added 2026-08-02 directly adjacent to
// the electron-beam bounce — both name real optics/light-propagation
// phenomena) → focus/perception (Find #2's two fragments, added the same
// pass, sitting between the mechanical and musical stretches per the
// brief's own suggested default) → musical (harps/superstrings) →
// elemental (lightning tetrahedrons) → cosmic (seven-colored/prisms) as
// the beam travels outward. Not load-bearing per the brief — this is a
// reasonable default, not a required order.
export const BOUNCES = [
  {
    // Electron/CD passage — written 2008, no relationship to this piece,
    // genuine electron-beam-physics language ("channel of electrons,
    // glowing orange-red"). Single bounce, closest to the source.
    text: '...every solid-state hum of vacuum tubes warming up the channel of electrons, glowing orange-red on the back of the CD cover.',
  },
  {
    // Find #1 — Storyline.doc, entry dated 9/30–10/1/2003, confirmed
    // identical across the original file and two independently-dated
    // backup copies. Single, undivided bounce — "THE MIRROR" is the
    // payoff line and the brief explicitly asked that splitting it not
    // blunt it, same reasoning as the electron-beam passage.
    text: "HOLY CRAP! Lasers get hot! They need to be cooled! I swear this makes sense! Because I'm always, always, ALWAYS craving cold water! And me thinking about lasers and whatnot as a useful metaphor – jesus, there's a gem in my heart focusing all this light within and through me – oh my god, I'm the lasing medium…and the laser…no, wait, the light pours through me…and my psyche and mind and body are the medium…and the laser light is that which comes out of me. We're grasping our way towards an analogy, but jumping jesus…this could be something…and my third eye is the focusing mechanism – THE MIRROR – the fucking mirror isn't letting anything out",
  },
  {
    // Find #2a — Storyline.doc, ~9/29–30/2003, same cross-copy
    // verification as Find #1. A separate diary entry from 2b below, not
    // joined or ellipsis-bridged (that would be new writing the source
    // doesn't make).
    text: 'Circle the lenses over the crystal refractor of your heart.',
  },
  {
    // Find #2b — Storyline.doc, same week as 2a, same verification.
    text: 'I was just thinking, "I need focus," and suddenly I pictured lenses at my feet and at the top of my head (especially at my feet, though), and now things are definitely coming back into focus! How odd! Just saying the word evoked the image which affected the body.',
  },
  {
    // Harps/superstrings, part one.
    text: 'Here are harps, here are superstrings.',
  },
  {
    // Harps/superstrings, part two — same passage, already staged this
    // way since the first scale-up.
    text: "Pluck at them both, send me vibrating, harmonics echoing at mathematically precise points... my own bow waits to be bent.",
  },
  {
    // Lightning tetrahedrons, part one.
    text: 'Microscopic lightning tetrahedrons shimmering in air for half a second and then phasing out...',
  },
  {
    // Lightning tetrahedrons, part two — split at the same ellipsis pause
    // the source text already has.
    text: 'union of heaven and earth, union of thought and action, union of spark and fusion, the blend, the soul and psyche, the divine fire.',
  },
  {
    // Seven-colored/prisms, part one.
    text: 'Seven-colored, prisms, starlight...',
  },
  {
    // Seven-colored/prisms, part two.
    text: 'Vibrating at a different frequency. Harmonics, tuning.',
  },
];
