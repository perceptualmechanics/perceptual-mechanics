// ─── Prism: new growth ──────────────────────────────────────────────────────
// Everything in fragments.js/scrollPieces.js/theaterScript.js/poems.js/
// leafText.js/orreryStory.js is Prism's frozen "seed" — grown once, ambient
// only, never clickable (see prismManifest.js and prism.js's own headers).
// This file is the other half: genuinely new writing, added on purpose,
// going forward, one entry per new piece — each one becomes one additional
// DLA walker grown on top of the already-grown seed the next time the site
// builds, and (unlike the seed) IS clickable — it opens the site's standard
// plain read-more panel, same as every other scene.
//
// Same convention as scrollPieces.js/poems.js: a plain array, one object per
// piece, appended at the end — never reordered, never removed (see
// utils/prism-curator.html for the local tool that generates a ready-to-
// paste entry for here).
//
// Shape:
//   {
//     id: 'growth:<slug>',   // stable, unique, never reused even if the
//                            // entry is ever retired — matches this
//                            // project's own append-only convention so a
//                            // future entry can never collide with an
//                            // earlier one's identity.
//     title: 'A Title',
//     paragraphs: ['First paragraph.', 'Second paragraph.'],
//   }
//
// Starts empty — nothing has been added through the curator tool yet.
export const prismEntries = [];
