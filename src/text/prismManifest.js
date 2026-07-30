// ─── Prism: the manifest ────────────────────────────────────────────────────
// Prism supersedes Lens entirely (2026-07-30) — an organically-grown crystal,
// not a cut gem. This file is pure data: the six anchors, the frozen "seed"
// generation grown from the site's existing writing, the open-ended
// "growth" generation grown from genuinely new writing, and the combined
// structure — position + parent for every point — computed once here so
// prism.js only has to import numbers, never recompute them.
//
// Same rule as every other file in src/text/: content, no rendering
// attached. prism.js owns turning a piece's raw fields into panel HTML, the
// same division scripts/prerender.js already keeps for the six original
// modules this file also reads from.
//
// ─── Seed vs. growth (round 2, 2026-07-30) ─────────────────────────────────
// The first pass treated all 68 pieces from the six original scenes as an
// open-ended, ever-extending body that could keep sprouting new walkers
// forever, and let any of them open the standard read panel on click. Two
// problems, both corrected here:
//
// 1. Each of the six arms only collided against its own growth (plus the
//    six bare anchor points) — never another arm's grown branches. Combined
//    with anchor spacing wider than any arm's actual reach, that produced
//    six isolated clusters, not one geode: nothing ever grew *toward* a
//    different scene's material. Fixed in dla.js's growPoints(): collision
//    is now fully global.
//
// ─── Round 3 (2026-07-30): connectivity was real in the data, invisible on
// screen — fixed twice, not once ─────────────────────────────────────────
// R=0.45 (round 2's number) did produce real cross-scene bonds in the data
// (43 of 68 pieces), verified with a throwaway point-to-point distance
// check. But on screen it still read as five or six separate small jacks
// with visible gaps between them — a real bug, not a misreading: the
// rendered branch radius (0.009-0.014) was 3-5x thinner than the DLA
// model's own PARTICLE_RADIUS (0.045, dla.js), so even genuinely-touching
// points had no visible mass bridging them, and unattached-but-nearby
// points (a real gap in the walk, not a rendering illusion) read as fully
// isolated instead of merely close. Two independent fixes, verified with a
// second throwaway script before landing on numbers:
//   - R tightened 0.45 → 0.14. The six original arms carry wildly uneven
//     mass (Sphere 25 pieces, Orbiter 14, Theater 16, Scroll 11, but Leaf
//     and Orrery just 1 each) — a single-piece arm's one walker only ever
//     wanders a short distance from its own anchor, so no R that's
//     comfortable for the big arms was ever going to let Leaf and Orrery's
//     lone walkers reach anything. 0.14 was chosen by sweeping R from 0.45
//     down to 0.10 against the real per-scene piece counts and tracking the
//     worst (largest) minimum gap between any two arms' actual points —
//     0.14 minimizes it (worst pair down from 0.845 to 0.155 units) without
//     collapsing the six arms into an indistinguishable blob (structure
//     still spans ~0.55-0.78 units across).
//   - Branch/joint rendering thickened to match PARTICLE_RADIUS instead of
//     being drawn as thin decorative rods (see prism.js) — every stuck
//     point now gets a bead-like sphere plus a proportionally thick
//     connecting shard, so material that's genuinely close (whether or not
//     it's a direct parent-child bond) actually shows as touching/
//     overlapping mass instead of two thin lines with black space between.
// 2. The brief never actually distinguished "seed" content from "new
//    growth" content, so click-to-open-the-standard-panel on anything was a
//    reasonable reading at the time — corrected on Scott's explicit
//    instruction: the six scenes' 68 pieces are ambient atmosphere only,
//    never clickable, no panel, no exceptions. They're the material Prism
//    grows FROM, not content living inside it. Real new writing — added
//    going forward through prismEntries.js / utils/prism-curator.html — is
//    the only thing that's actually browsable; each entry there is one more
//    DLA walker grown on top of the seed, and does open the standard panel.
//
// Practically, this also means the seed generation is now genuinely frozen:
// nothing ever adds a 69th piece to fragments.js's own contribution here.
// New material only ever enters through prismEntries.js, growing on top of
// the seed via its own dedicated call to growPoints() with its own RNG
// stream — appending an entry there is stable (see dla.js's own header) the
// same way the original design intended appends to the six source scenes to
// be, just scoped to where new material now actually lands.
//
// ─── The six anchors ────────────────────────────────────────────────────────
// One per existing text-bearing scene, per the brief: Sphere, Scroll,
// Theater, Orbiter, Leaf, and Orrery. Leaf's text counts even though the
// scene itself is shelved and unreachable from the nav (see main.js) — its
// writing still exists, pulled from src/text/leafText.js, the same shared
// module 1.7.0's /text/leaf/ page reads, not from scenes/leaf.js directly.
// Butterfly is excluded — it carries no text, same reasoning the colophon's
// own experience count already uses. Library is excluded too: the brief
// names exactly these six scenes and no others, and Library's own text
// (per-book notes) is already withheld even from its own /text/library/
// page (see prerender.js's buildLibrary) — not a scene this pass touches.
//
// Positioned at the six vertices of a regular octahedron — a real
// crystallographic form, not an arbitrary layout — in the order the brief
// lists them.
const R = 0.14;
export const ANCHORS_META = [
  { key: 'sphere',  label: 'The Sphere',   position: { x:  R, y: 0, z: 0 } },
  { key: 'scroll',  label: 'The Scroll',   position: { x: -R, y: 0, z: 0 } },
  { key: 'theater', label: 'The Theater',  position: { x: 0, y:  R, z: 0 } },
  { key: 'orbiter', label: 'Orbiter',      position: { x: 0, y: -R, z: 0 } },
  { key: 'leaf',    label: 'Leaf',         position: { x: 0, y: 0, z:  R } },
  { key: 'orrery',  label: 'The Orrery',   position: { x: 0, y: 0, z: -R } },
];

import { fragments } from './fragments.js';
import { scrollPieces } from './scrollPieces.js';
import { SCENES as theaterScenes } from './theaterScript.js';
import { poems } from './poems.js';
import { TEXT_STAGES } from './leafText.js';
import { ORRERY } from './orreryStory.js';
import { prismEntries } from './prismEntries.js';
import { growPoints } from '../utils/dla.js';

// ─── Seed pieces, in each anchor's own existing array order ────────────────
// One entry per piece of writing already on the site, `kind` telling
// prism.js which raw shape to expect (mirrors prerender.js's own per-section
// renderers, reading the same six modules — used here only for the ambient
// single-line surfacing, never for a click-to-open panel). IDs are
// `${anchor}:${index}` — stable, but no longer meaningfully "appendable":
// this whole list is the frozen seed, not something new material joins.
function spherePieces() {
  return fragments.map((f, i) => ({ id: `sphere:${i}`, sceneKey: 'sphere', kind: 'fragment', title: f.title, data: f }));
}
function scrollPiecesList() {
  return scrollPieces.map((p, i) => ({ id: `scroll:${i}`, sceneKey: 'scroll', kind: 'scroll', title: p.title, data: p }));
}
function theaterPieces() {
  return theaterScenes.map((s, i) => ({ id: `theater:${i}`, sceneKey: 'theater', kind: 'theater', title: s.slug, data: s }));
}
function orbiterPieces() {
  return poems.map((p, i) => ({ id: `orbiter:${i}`, sceneKey: 'orbiter', kind: 'poem', title: p.title, data: p }));
}
function leafPieces() {
  return [{ id: 'leaf:0', sceneKey: 'leaf', kind: 'leaf',
    title: 'In The End It Falls Slowly Through The Aether', data: { stages: TEXT_STAGES } }];
}
function orreryPieces() {
  return [{ id: 'orrery:0', sceneKey: 'orrery', kind: 'orrery', title: ORRERY.name, data: ORRERY }];
}

const SEED_PIECES_BY_ANCHOR = {
  sphere: spherePieces(),
  scroll: scrollPiecesList(),
  theater: theaterPieces(),
  orbiter: orbiterPieces(),
  leaf: leafPieces(),
  orrery: orreryPieces(),
};

// Flat list, anchor-block order (Sphere, Scroll, Theater, Orbiter, Leaf,
// Orrery), each anchor's own pieces in their own existing order — 68 total.
// Ambient-only: prism.js must never wire a click/hover/panel handler to
// anything in this list.
export const SEED_PIECES = ANCHORS_META.flatMap(a => SEED_PIECES_BY_ANCHOR[a.key]);
export const SEED_PIECES_BY_ID = new Map(SEED_PIECES.map(p => [p.id, p]));

// ─── Growth pieces ──────────────────────────────────────────────────────────
// Genuinely new writing, added going forward through prismEntries.js — the
// only thing on the crystal that's actually clickable/browsable. Starts
// empty; grows one entry at a time as real content is added through
// utils/prism-curator.html.
export const GROWTH_PIECES = prismEntries.map((e, i) => ({
  id: e.id ?? `growth:${i}`, sceneKey: null, kind: 'growth', title: e.title, data: e,
}));
export const GROWTH_PIECES_BY_ID = new Map(GROWTH_PIECES.map(p => [p.id, p]));

// ─── The grown structure ────────────────────────────────────────────────────
// Two calls to growPoints(), computed once here at module-evaluation time —
// this module is only ever imported by prism.js, so it runs once per page
// load (ES modules are evaluated once and cached), which is exactly the
// "once at build time (or on first load, cached)" the brief asks for, with
// no separate build step, no generated file, and nothing that can go stale.
//
// Phase 1 — seed: six batches, one per anchor, each with its own fixed
// spawnCenter (so the six origins stay legible), one shared RNG stream,
// fully-global collision (so arms genuinely bond to each other).
const seedBatches = ANCHORS_META.map(a => ({
  key: a.key,
  spawnCenter: a.position,
  pieces: SEED_PIECES_BY_ANCHOR[a.key].map(p => ({ id: p.id, sceneKey: p.sceneKey })),
}));
const anchorSeedPoints = ANCHORS_META.map(a => ({
  id: `anchor:${a.key}`, sceneKey: a.key, parentId: null,
  x: a.position.x, y: a.position.y, z: a.position.z, isAnchor: true,
}));
const seedResult = growPoints({ seedPoints: anchorSeedPoints, batches: seedBatches, salt: 'prism-seed-2026-07-30' });

// Phase 2 — growth: one batch, no fixed spawnCenter (new material has no
// single natural origin — it spawns relative to the crystal's own current
// extent instead), grown on top of the seed's own frozen output. A
// dedicated RNG stream, re-run in full from scratch every load — piece N's
// simulation never reads anything about piece N+1, so appending a new entry
// to prismEntries.js can't move anything that already existed.
const growthResult = growPoints({
  seedPoints: seedResult.points,
  batches: [{ key: 'growth', spawnCenter: null, pieces: GROWTH_PIECES.map(p => ({ id: p.id, sceneKey: 'growth' })) }],
  salt: 'prism-growth-2026-07-30',
});

export const PRISM_STRUCTURE = growthResult;
export const STRUCTURE_BY_ID = new Map(PRISM_STRUCTURE.points.map(p => [p.id, p]));
