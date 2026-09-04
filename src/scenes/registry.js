// ─── Scene registry ─────────────────────────────────────────────────────────
// Moved out of main.js in 4.2.0 so that something other than the browser can
// read it. `scripts/prerender.js` imports this to assert that every scene
// either has a /text/ page or is named in TEXT_EXEMPT below — the assertion the
// 2026-09-01 punch list asked for, and an eleventh scene is the case it was
// proposed for. main.js cannot serve that purpose: importing it in Node runs
// its top-level bootstrap against a DOM that isn't there.
//
// THIS FILE HAS NO IMPORTS, and that is load-bearing rather than incidental.
// The first version kept each entry's `load: () => import('./x/x.js')` here,
// which read as harmless because a dynamic import is lazy — but vite.config.js
// imports prerender.js, Vite bundles its own config, and the bundler follows
// dynamic imports statically. The whole scene graph, `?raw` templates and CSS
// side-effect imports included, got pulled into the config bundle and the build
// died before it started. So the loaders live in main.js, derived from these
// keys by `import.meta.glob` rather than listed a second time.


// ─── Why the loaders are not here ───────────────────────────────────────────
// A long comment used to sit in this space explaining that each entry carried
// a `load: () => import('./scenes/<name>/<name>.js')`, why that beat ten static
// top-of-file imports (it did: static imports for every scene were the direct
// cause of Rollup's "chunks larger than 500kB" warning, and code-splitting per
// scene is what fixed it), and what it did and didn't buy. All of that is still
// TRUE about the architecture and none of it is true about this file any more —
// 4.2.0 moved the loaders to main.js and derives them from these keys with
// `import.meta.glob`, for the reason in the header above. The full reasoning
// lives in NOTES.md's 3.10.0 and 4.2.0 entries and in main.js's own comment at
// `sceneModules`. Removed rather than left standing: a comment describing a
// mechanism the file no longer has is how the next reader is told to look for
// something that isn't there.

// ─── `tile` — how big this scene's circle is on the landing page ────────────
// A multiplier on the derived tile size, and the reason it is here rather than
// in main.js is that it is a fact about the SCENE: whether its subject survives
// being small. Thirteen identical circles in two tidy rows is a contact sheet;
// what the page wants is a field of objects at different distances, which is
// what a shelf of thirteen unrelated things actually looks like.
//
// Assigned by looking, not by rule, and the reasoning is per-scene:
//
//   Large   the ones whose subject is a WHOLE OBJECT you read at a glance and
//           that gain from room — the sphere, the shelf, the lotus, the board.
//   Middle  the ones that read as a scene or a field, where a little more or
//           less changes nothing.
//   Small   the ones that are essentially one bright figure on black, which
//           stay legible at any size because there is nothing to lose — the
//           attractor, the beamline's rail, the orbital.
//
// The layout arithmetic in main.js takes these as given and sizes so that the
// LARGEST still fits the height budget and the SMALLEST still clears the
// legibility floor, so the landing requirement holds by construction rather
// than by hope. `scripts/verify-landing.mjs` proves it across a viewport
// matrix, because "by construction" is a claim and this project tests those.
//
// Default is 1 when a scene does not say. `nudge` is a vertical offset in the
// same units, which is what stops the two rows reading as two rows.
export const SCENES = {
  sphere:    { tile: 1.12, nudge: -0.045,
               exportName: 'createSphere',
               label: 'The Sphere — full screen experience. Press Escape to return.',
               ariaLabel: 'The Sphere — interactive geodesic sphere with text fragments.' },
  butterfly: { tile: 0.90, nudge: 0.05,
               exportName: 'createButterfly',
               label: 'Chaos Butterfly in Phase Space, 2026.',
               // The one scene that wants a different backdrop than the
               // shared #000811: its attractor is drawn on true black, and
               // the faint blue of the default read as a wash behind it.
               // Declared here rather than as a `.butterfly-bg` class named
               // in both main.js and main.css (which is how it lived until
               // 4.0) — one scene's name hardcoded into the shell twice is
               // exactly the thing that gets missed when a scene is renamed
               // or a second scene wants the same treatment.
               overlayBg: '#000000',
               ariaLabel: 'Chaos Butterfly in Phase Space, 2026 — Lorenz attractor. Drag to orbit, scroll to zoom.' },
  scroll:    { tile: 1.02, nudge: 0.03,
               exportName: 'createScroll',
               label: 'Selected Works — A Scroll of Found Writing.',
               ariaLabel: 'Selected Works — a scroll of found writing, carved fragments, 2000 to the 2010s. Scroll to read.' },
  theater:   { tile: 1.06, nudge: -0.02,
               exportName: 'createTheater',
               label: 'The Theater — Now Playing.',
               ariaLabel: 'The Theater — scenes from Truth and Beauty, Paul Revere, and You’ve Got a Friend in Satan, performed by ASCII actors. A different program each visit; click or use the controls to advance.' },
  orbiter:   { tile: 0.92, nudge: -0.05,
               exportName: 'createOrbiter',
               label: 'Orbiter — A p-Orbital, Satellites.',
               ariaLabel: 'Orbiter — a hydrogen atom’s p-orbital rendered as a fuzzy probability cloud, with satellites in clean elliptical orbits around it. Drag to orbit.' },
  orrery:    { tile: 1.00, nudge: 0.04,
               exportName: 'createOrrery',
               label: 'The Orrery of Los Feliz.',
               ariaLabel: 'The Orrery of Los Feliz — a found story, told through a 30-foot orrery: nine planets, their moons, an asteroid belt, in a warehouse you can walk around. Use the arrow keys or WASD to walk, click to look around, click the orrery to read.' },
  library:   { tile: 1.10, nudge: -0.03,
               exportName: 'createLibrary',
               label: 'The Library — once removed.',
               ariaLabel: 'The Library — a real bookshelf, 107 books, films, and divination decks, rebuilt as a shelf you can turn in space. Drag to orbit, scroll to zoom, click a spine to read what it is.' },
  // A small vessel travelling a glowing rail across a night wilderness, with
  // ten stations along it, each holding a fragment of found text.
  //
  // Both this comment and the ariaLabel below described curved mirrors and a
  // bouncing beam until 4.0 — a design the scene moved away from, leaving the
  // description behind. That mattered more than a stale comment usually does:
  // an ariaLabel is not decoration, it is the ONLY account of this scene a
  // screen-reader visitor gets, and it was telling them to click a mirror in a
  // scene with no mirrors in it. The wording now matches what the visible hint
  // ("click a station to read") and the jump list ("Station N of 10") already
  // say, so a sighted visitor and a screen-reader visitor are given the same
  // word for the same object. (`BOUNCES` still names the data array inside
  // beamline.text.js — harmless, since nobody reads a variable name out loud.)
  beamline:  { tile: 0.91, nudge: 0.05,
               exportName: 'createBeamline',
               label: 'Beamline.',
               ariaLabel: 'Beamline — a small vessel travelling a glowing rail across a night wilderness, with ten stations along it, each holding a fragment of found text. Drag to orbit, scroll to zoom, click a station to read.' },
  // Harmonics — ninth scene, Phase 3 (2026-08-16), renamed from "The
  // harmonics" 2026-08-18 (user-facing name only — internal module/
  // folder/class names stay `harmonics`, see harmonics.js's own header for
  // why). Visualizes src/resonances.js's approved Layer 2 links; see
  // harmonics.js's own header comment for the full picture.
  harmonics: { tile: 0.94, nudge: -0.04,
               exportName: 'createharmonics',
               label: 'Harmonics.',
               ariaLabel: 'Harmonics — resonant pieces across every other scene, laid out by how strongly they connect and pulsing in sync with whatever they resonate with. Drag to orbit, scroll to zoom, touch a node.' },
  // Outside — tenth scene (2026-08-24), pivoted to a floral cosmology map
  // round 3 (same day): a generated lotus mapping the five Power Sources
  // (petals) and their Folk Origins, Magi/Psi as the center. The earlier
  // 7-vs-11 OER/Apherion projection thesis this scene shipped with is
  // fully retired — see outside.js's own header for the full picture.
  outside:   { tile: 1.08, nudge: 0.025,
               exportName: 'createOutside',
               label: 'Outside.',
               ariaLabel: 'Outside — a generated lotus mapping the five Sources of Power as petals and their Folk Origins, Magi and Psi at the center. The flower breathes continuously on its own. Drag to orbit, scroll to zoom, touch a petal.' },
  // Apollo — eleventh scene (2026-09-02). An absorption spectrum you can play:
  // a band of starlight with the lines missing from it, a procedurally
  // generated corona streaming in from the right, and ten elements on faders
  // that put themselves into the light. Clicking a gap sounds that wavelength
  // as a pitch. Hydrogen's lines are computed from the Rydberg formula; the
  // other nine elements are NIST tables. The only 2D-canvas WebGL-free scene
  // with a live preview tile, deliberately — see apollo.js's own header for
  // the context-budget reasoning.
  //
  // Not to be confused with the SHELVED Spectra, which shares the subject
  // word and nothing else: that one measured this site's own writing, was
  // built and measured and taken back out the same day (see
  // src/scenes/spectra/SHELVED.md). Spectra's files are still in the tree and
  // still build; it is simply not registered, so nothing loads it and nothing
  // links to it. Restoring it is an entry here plus the three edits that file
  // lists — one of which, `--nav-count`, is now 11 for Apollo rather than 10,
  // so a restore would take it to 12.
  apollo:    { tile: 0.97, nudge: -0.05,
               exportName: 'createApollo',
               label: 'Apollo — an absorption spectrum you can play.',
               ariaLabel: 'Apollo — a solar absorption spectrum you can play. Ten elements on faders put their lines into a band of starlight; click a dark line to hear its wavelength as a pitch.' },
  // Psyshell — twelfth scene (2026-09-03). Rebuilt at 4.8.0: it was a
  // chrysanthemum, then a branch, and both encoded the corpus in their geometry
  // — petal angle was reading order, limb thickness was Murray's law. Neither
  // had a subject. It is now a lens held in a web: a crystal antler that
  // holds the site's sentences without encoding them, read with a lightpen. The
  // label and ariaLabel below have been rewritten twice for that reason, and
  // both times the previous wording described a scene that no longer existed —
  // an ariaLabel is the only account of a scene a screen-reader visitor gets,
  // so it is part of the form change rather than a follow-up to it.
  psyshell:  { tile: 0.93, nudge: 0.04,
               exportName: 'createPsyshell',
               label: 'Psyshell — lens RE73415.',
               ariaLabel: 'Psyshell — a small crystal antler suspended in a web of fine filaments, holding every sentence on this site inside it. The web and the object are one structure at two scales. Drag to turn it; point the lightpen at it to read one sentence and watch the light of its number travel through the crystal.' },
  // Medium — thirteenth scene (2026-09-04). A homemade Ouija board seen from
  // above, an upside-down teacup on it, and two pairs of fingertips. The
  // second scene here with no sound at all and the only one with no controls:
  // there is nothing to press but the cup.
  //
  // The label says "a board that can spell" rather than naming a message,
  // because there is no message — the scene's whole structural claim is that
  // nothing anywhere in it holds what the board is going to say. An ariaLabel
  // promising a séance with a spirit would be describing a scene that was
  // built and thrown away (see medium.physics.js's header for both of them).
  medium:    { tile: 1.12, nudge: -0.025,
               exportName: 'createMedium',
               label: 'Medium — a board that can spell.',
               ariaLabel: 'Medium — a homemade Ouija board seen from above, with an upside-down teacup on it and two pairs of fingertips: yours and somebody else\u2019s. Press on the cup and rest your hand; nothing moves until you do, and nothing moves once you let go. Letters land while you are touching it and fill a tape along the bottom.' },

};

// ─── /text/ exemptions ──────────────────────────────────────────────────────
// A scene belongs here only if it publishes no writing of its own, and the
// reason has to be written down. The rule this enforces is that a scene
// carrying real writing needs a crawlable page in the same pass or it ships
// unfindable — the exemption is for scenes where there is genuinely nothing to
// crawl, not for scenes whose page hasn't been written yet.
export const TEXT_EXEMPT = {
  butterfly: 'Its entire found text is its own placard title, which the landing page already carries.',
  harmonics: 'It publishes no text of its own — it is a view of the connections between other scenes, each of which has its own page.',
  outside:   'Five power-source names and two origin labels, all of which are visible on the landing tile.',
};
