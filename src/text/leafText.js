// ─── Leaf: the text ────────────────────────────────────────────────────────
// A found piece (Cartography.doc, archive/Writing archive, author: Scott
// Cohen) — a single raindrop's entire life told through real physics.
// Moved out of scenes/leaf.js (2026-07-29) so the prerender step that builds
// /text/leaf/ can import the same text the scene stages, rather than a copy.
//
// The comments on each stage describe the moment of the fall that stage is
// timed against; the scene derives its actual phase boundaries from the
// rendered paragraph heights at runtime, not from anything here.

export const TEXT_STAGES = [
  {
    // Gathering, surface tension holding — matches the leaf-tip pause.
    text: "As the droplets descend down the texture of the leaf, coalescing at the downward point, anticipating the end of their stable lives, joining a hundred million molecules for the freefall drop, poised on the brink before the gravity of the situation overwhelms the surface tension, for that brief instant every Mickey Mouse molecule knowing what is to come, feeling the onward surge as the weight increases, ever steadier, until there's no more time and —",
  },
  {
    // The drop releases, leaf recoils.
    text: "the pull downward begins, the drop falls from the leaf, which recoils upwards in release, and it is angels in a ball as they're pulled ever downward, freefall, guts flying, screaming, and everyone wants to fly apart but that surface tension pulls them in, forcing them to stick together, and together they fall, bound by forces outside their control —",
  },
  {
    // Friction — a few molecules escape (the drifting particles).
    text: "the friction as water flies by air frees a few of them, free oxygen and nitrogen creating heat simply by virtue of being there, a wrecking ball knocking aside everything in its path, forcing aside the free and creating more havoc than before —",
  },
  {
    text: "the drop surges like a lava lamp, suspended in aether, the invisible currents of reaction and action dancing intertwined as forces push and pull and shake and steady and everything prepares for the inevitable end —",
  },
  {
    // Ground rushing up.
    text: "it looms ahead of them, the only assurance they have, the ground rushing up, the knowledge of disaster, the circumstance of knowing the end ahead, every movement useless against the surface tension —",
  },
  {
    // The escaped few, watching.
    text: "and yet those few pulled away from the burning rim of the sphere, those few whose weight is that of the air, those few who lucked into friction, they hang there, suspended, and gaze at the others still in the grasp of the greedy giant as they fall until —",
  },
  {
    // Impact / splash.
    text: "the drop explodes on the ground, shattering the form, everything gone everywhere, vaporized, splashing its life away, a mushroom cloud of water, the sad remains absorbed by root or burnt by sun to climb upwards and start the whole sorry process downward —",
  },
  {
    // The free ones, adjusting to new forces — the loop's quiet close.
    text: "and those few floating adjust themselves to wind and water and follow forces other than the ones they've known.",
  },
];
