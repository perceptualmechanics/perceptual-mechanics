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


// ─── Scene registry ──────────────────────────────────────────────────────────
// Each entry's `load()` is a dynamic import() rather than a static top-of-
// file import — Rollup code-splits each one into its own lazily-fetched
// chunk instead of folding all ten scenes (plus main.js's own logic) into
// one monolithic bundle. Before this (v3.9.17 and earlier), every scene's
// full module was a static import here, so opening *any* scene — even just
// rendering its landing-page preview thumbnail via initPreviews() below —
// required all ten to already be parsed and evaluated, which is exactly
// what tripped Rollup's "chunks larger than 500kB" warning (main chunk was
// ~558kB gzipped ~208kB). `exportName` records which named export each
// scene's module hands back (`createSphere`, `createharmonics` — note the
// lowercase h, kept internal-only per harmonics.js's own header — etc.),
// since dynamic import() resolves to the whole module namespace object,
// not a single function the way the old static imports destructured
// directly.
//
// This does NOT, by itself, shrink first-load bytes: initPreviews() still
// needs every scene's real create() to render its thumbnail (no scene's
// preview/full split has been done yet — see NOTES.md's open-items entry
// for the follow-up), so a first visit still fetches all ten chunks, just
// now as parallel per-scene requests instead of one blocking chunk. Real,
// present-tense wins: (1) editing one scene no longer invalidates every
// visitor's cached copy of the other nine on the next deploy; (2) chunks
// land under Rollup's 500kB threshold individually; (3) this is the
// infrastructure a future preview/full split plugs into for free — once a
// scene's preview branch stops needing its full-mode code, only
// initPreviews()'s call needs to change, not this registry or expandScene.
export const SCENES = {
  sphere:    { exportName: 'createSphere',
               label: 'The Sphere — full screen experience. Press Escape to return.',
               ariaLabel: 'The Sphere — interactive geodesic sphere with text fragments.' },
  butterfly: { exportName: 'createButterfly',
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
  scroll:    { exportName: 'createScroll',
               label: 'Selected Works — A Scroll of Found Writing.',
               ariaLabel: 'Selected Works — a scroll of found writing, carved fragments, 2000 to the 2010s. Scroll to read.' },
  theater:   { exportName: 'createTheater',
               label: 'The Theater — Now Playing.',
               ariaLabel: 'The Theater — scenes from Truth and Beauty, Paul Revere, and You’ve Got a Friend in Satan, performed by ASCII actors. A different program each visit; click or use the controls to advance.' },
  orbiter:   { exportName: 'createOrbiter',
               label: 'Orbiter — A p-Orbital, Satellites.',
               ariaLabel: 'Orbiter — a hydrogen atom’s p-orbital rendered as a fuzzy probability cloud, with satellites in clean elliptical orbits around it. Drag to orbit.' },
  orrery:    { exportName: 'createOrrery',
               label: 'The Orrery of Los Feliz.',
               ariaLabel: 'The Orrery of Los Feliz — a found story, told through a 30-foot orrery: nine planets, their moons, an asteroid belt, in a warehouse you can walk around. Use the arrow keys or WASD to walk, click to look around, click the orrery to read.' },
  library:   { exportName: 'createLibrary',
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
  beamline:  { exportName: 'createBeamline',
               label: 'Beamline.',
               ariaLabel: 'Beamline — a small vessel travelling a glowing rail across a night wilderness, with ten stations along it, each holding a fragment of found text. Drag to orbit, scroll to zoom, click a station to read.' },
  // Harmonics — ninth scene, Phase 3 (2026-08-16), renamed from "The
  // harmonics" 2026-08-18 (user-facing name only — internal module/
  // folder/class names stay `harmonics`, see harmonics.js's own header for
  // why). Visualizes src/resonances.js's approved Layer 2 links; see
  // harmonics.js's own header comment for the full picture.
  harmonics: { exportName: 'createharmonics',
               label: 'Harmonics.',
               ariaLabel: 'Harmonics — resonant pieces across every other scene, laid out by how strongly they connect and pulsing in sync with whatever they resonate with. Drag to orbit, scroll to zoom, touch a node.' },
  // Outside — tenth scene (2026-08-24), pivoted to a floral cosmology map
  // round 3 (same day): a generated lotus mapping the five Power Sources
  // (petals) and their Folk Origins, Magi/Psi as the center. The earlier
  // 7-vs-11 OER/Apherion projection thesis this scene shipped with is
  // fully retired — see outside.js's own header for the full picture.
  outside:   { exportName: 'createOutside',
               label: 'Outside.',
               ariaLabel: 'Outside — a generated lotus mapping the five Sources of Power as petals and their Folk Origins, Magi and Psi at the center. The flower breathes continuously on its own. Drag to orbit, scroll to zoom, touch a petal.' },
  // The eleventh, and the first whose content is another scene's content: it
  // measures Theater's dialogue rather than publishing any writing of its own.
  // That is why its /text/ page carries the measurement and not the plays —
  // see scripts/prerender.js, and the exempt map the scenes-sum assertion
  // checks this registry against.
  spectra:   { exportName: 'createSpectra',
               label: 'Spectra — a plate of voices. Press Escape to return.',
               ariaLabel: 'Spectra — every speaker in the Theater’s three plays read as a light source: the lines their dialogue emits, and the lines the rest of their cast has that they absorb. Click an exposure to read it, or use the up and down arrows.' },
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
