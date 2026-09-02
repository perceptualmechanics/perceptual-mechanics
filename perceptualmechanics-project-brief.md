# perceptualmechanics — project brief

*Prepared 2026-08-31, refreshed 2026-09-02, current as of **v4.0**. Written as a handoff/context document for a fresh chat — everything here should be enough to pick up work on this project without re-deriving it.*

> **A note on keeping this file honest.** The 2026-09-01 audit found this
> brief fourteen minor versions stale: it still said "current as of
> v3.9.17", and three of its six standing open items had been resolved
> and were still listed as open, while a fourth had flipped the other way
> without anyone noticing. A handoff document that is wrong is worse than
> no handoff document, because it is read as current. Refresh this file
> in the same pass as any release that changes the answers in it.

## What this is

perceptualmechanics.com is Scott Cohen's personal digital-art portfolio: a single-page, full-screen WebGL/canvas site built around **10 interactive scenes**, each a small standalone piece combining generative visuals, curated writing/found text, and (in most scenes) generative or triggered audio. It's a static site (no backend, no database) — everything client-rendered, deployed as a plain `dist/` upload.

Collaborators: Scott (vision, writing, curation) and Claude (code, literary analysis, implementation) — this has been a long-running, deeply iterative collaboration, not a one-off build.

## Tech stack

- **Vite 8.2.2** build pipeline (Rolldown-based; CSS minifier pinned to esbuild — see `vite.config.js`), no framework — vanilla JS modules, no React/Vue/etc.
- **Three.js 0.185** for every WebGL scene.
- Plain CSS per scene (`<scene>.css`), no CSS framework, no preprocessor.
- Node 24 (`engines: ">=22.0.0"`), deploys to **DreamHost** via manual `dist/` upload to the public root. No server-side dependencies.
- `npm run build` runs two build-time content-integrity gates via Vite plugin hooks (not npm lifecycle hooks, which silently don't fire under `vite build` directly — see conventions below): `verify-links` and `verify-resonances`, which check that every cross-reference/resonance link in the content actually resolves to a real piece.
- `scripts/prerender.js` generates static `/text/<scene>/` pages from the same content modules the scenes render from, so crawlers (which don't click) can still index the writing — this was a deliberate SEO fix, not incidental.

## Architecture — per-scene folder convention

Every scene is a fully self-contained folder: `src/scenes/<name>/<name>.{js,css,html}` plus `<name>.text.js` (or multiple `.text.js`-style modules for scenes with more than one kind of content — e.g. library has `library.text.js` + `library.cdRack.js`). Nothing about a scene lives outside its folder except `src/utils/sceneKit.js` (shared helpers: `bindEscapeClose`, `createPanelCloser`, `createJumpList`, `wireCrossLinks`, `mountClippedPreviewCanvas`, and others extracted once logic showed up in a third scene) and the one-line registration in `src/main.js`.

Static shell markup lives in `<name>.html`, imported as a raw string and parsed into a real `DocumentFragment` via `parseHTML()`. Content (a scene's actual writing, per-item data) always lives in a `.text.js` module that both the scene *and* `scripts/prerender.js` import — never copied, never duplicated, so the live site and the crawlable `/text/` pages can't drift apart.

`src/main.js` owns: hash-based deep linking (`#scene` or `#scene/pieceId`, with a small public-slug translation layer for the one scene — Harmonics — whose URL differs from its internal name), scene-swap transitions (crossfade via `#experience-overlay`'s opacity), modal focus containment while a scene is open (Tab-trapping, `aria-hidden` on the chrome), the shared fullscreen toggle, and a small easter egg (`pmGlimpse` — a 1-in-100 chance per hover that the tab title flickers to a one-word association for that scene). The scene registry itself moved to `src/scenes/registry.js` in 4.2.0 so that `scripts/prerender.js` can read it; `main.js` derives each scene's loader from its keys with `import.meta.glob` rather than listing them a second time.

## The 10 scenes

1. **Sphere** — interactive geodesic sphere with embedded text fragments.
2. **Butterfly** — a Lorenz attractor ("Chaos Butterfly in Phase Space"), drag to orbit.
3. **Scroll** — "Selected Works," a scroll of found writing/carved fragments, 2000s–2010s.
4. **Theater** — ASCII-rendered actors performing scenes from three different pieces, MST3K-style with a silhouetted "house" audience; different program each visit.
5. **Orbiter** — a hydrogen p-orbital rendered as a probability cloud with satellites in clean elliptical orbits.
6. **Orrery** ("The Orrery of Los Feliz") — a found story told through a 30-foot walkable orrery (nine planets, moons, asteroid belt) — WASD/arrow-key movement, not orbit-drag.
7. **Library** — a real bookshelf (150 items + 115 CD-rack items — counted from `library.text.js`, not recalled) rebuilt as a shelf you can turn and read spines from.
8. **Beamline** — a small vessel travelling a glowing rail across a night wilderness, with ten stations along it, each holding a fragment of found text. (It was a sequence of curved mirrors with a beam reflecting between them; the scene moved on and the description didn't. Corrected here, in the chat brief, and in `main.js`'s `ariaLabel` in 4.0 — that last one mattered most, being the only account of the scene a screen-reader visitor gets.)
9. **Harmonics** (9th scene; internally still named/keyed `harmonics` everywhere except the public URL slug — a deliberate, documented exception) — visualizes resonant connections across every other scene's content as a force-directed node graph with Kuramoto phase-sync animation and sonification.
10. **Outside** (10th scene) — a generated lotus/flower (Gielis superformula geometry) mapping a five-part cosmology (Power Sources as petals, Folk Origins, Magi/Psi at center); breathes continuously, Fresnel-based petal translucency, five distinct per-petal chime timbres plus a Kumoi-scale ambient chime bed.

A few earlier scenes (leaf, egg, prism, cycle, and older constellation/ground-glimpse/thread-follow mechanics) were built, shipped, and later **retired/shelved** over the project's history — the current registry above is the live set as of v4.0.3.

## Standing conventions (full detail in `STANDARDS.md`)

This is the durable house-rules file (created v3.9.16) — **read it first** before any future "modernize/audit the code" pass, since it already contains reasoned answers rather than requiring re-derivation:

- **Centering:** flex/grid by default. `left`/`top` + `transform` is reserved for two legitimate cases only — coordinate-anchoring (a DOM overlay positioned against a point projected from a Three.js scene) or a decorative element at a fixed offset within its own positioned ancestor. Never for viewport/row self-centering (that was a real, fixed bug — letter-spacing's trailing gap threw off self-width-measuring transforms).
- **Vendor prefixes:** kept only with a stated, individually-checked reason, never by default in either direction.
- **`!important`:** exactly two legitimate categories — overriding a third-party library's inline styles (Three.js's `renderer.setSize()`), and accessibility overrides (`prefers-reduced-motion`, state-flip utilities like `.no-transition`).
- **Mobile-first CSS, non-negotiable going forward.** Base rules target the smallest viewport; `min-width` layers on enhancements. **All 12 of 12 stylesheets are converted** (completed v3.9.17, still true through v4.0.3, which touched every one of them) (the last two — `main.css` and `theater.css` — were held back from the v3.9.16 pass deliberately due to real regression risk and converted as a dedicated v3.9.17 follow-up with live-browser verification; see below).
- **Media queries are nested inside their selector**, tab-indented — not separate top-level `@media` blocks. Standing convention since v3.9.16, confirmed harmless for browser support since Vite/esbuild flattens nesting to plain CSS at build time regardless.
- **Semantic HTML, classes for styling** (ids reserved for real DOM uniqueness or ARIA idrefs), **mobile + accessibility checks are now standard** parts of shipping any change (not a separate later pass).
- General principle: "looks outdated" isn't the test for whether to change a pattern — "is there a strictly better tool for what this code is doing" is. A full-site audit found real anti-patterns *and* patterns that only look dated; both got recorded so the distinction doesn't need re-litigating.

## Recent history (chronological highlights, oldest → newest)

- **3.9.4–3.9.8:** Node LTS bump (Node 20 → 24, security-support-driven), shared fullscreen toggle added site-wide, Outside's ambient audio decoupled from `requestAnimationFrame` (rAF throttles when a tab backgrounds — audio scheduling needs a `setInterval` lookahead scheduler instead), site-wide title/subtitle consistency pass, serif swap to Arapey (including canvas-rendered text in Beamline/Butterfly).
- **3.9.9–3.9.12:** Persisted sound on/off toggle for Harmonics and Outside — went through several iterations (shared key → activation-not-firing bug → TDZ crash from the fix → finally un-shared into per-scene keys).
- **3.9.13–3.9.14:** Fixed a real letter-spacing centering bug (Chrome adds the tracking gap after the last character too) and used it to drive a full site-wide refactor from `transform`-based centering to flexbox.
- **3.9.15:** Full-site CSS audit — removed genuinely dead code (a stale `#butterfly-exp-label` block, an inert `-webkit-overflow-scrolling: touch`) and fixed a real missing-fallback bug (`theater.css`'s mask had only the `-webkit-` prefix).
- **3.9.16:** Much larger modernization pass — full CSS + JS sweep, mobile-first conversion for 10 of 12 stylesheets (2 flagged for dedicated follow-up), native CSS nesting for all converted media queries, a real dead-cascade-order bug found and fixed in `sphere.css`, and the creation of `STANDARDS.md` itself.
- **3.9.17 (2026-08-30):** Closed out the mobile-first audit — converted the final two flagged files. `main.css`'s nav-icon/landing responsive system (which has a real, four-times-recurred regression history: icon count changes have repeatedly reintroduced silent edge-clipping at specific pixel thresholds) was converted and live-verified at the exact widths that broke before. `theater.css`'s one genuinely compound media query (`@media (max-width:480px), (max-width:700px) and (orientation:portrait)`) was inverted using actual De Morgan's-law algebra rather than a naive per-clause flip, verified with an orientation-aware cascade simulator plus live-browser spot checks. One honest gap recorded rather than papered over: the narrowest region (width ≤480px AND portrait) couldn't be reached live in this session due to a sandbox browser-pane width floor — it rests on the simulator/hand-derivation only, flagged as such in both `STANDARDS.md` and `NOTES.md`.
- **4.0–4.1.0 (2026-09-02):** the audit release and its follow-ons.
  4.0 closed 63 of the 71 audit findings, including all eight that were live
  on production — unstyled `/text/` pages, a stranded audio context on scene
  exit, nav icons clipped at 375px, a 2.9 MB image in a 36-pixel box — plus
  an accessibility pass, a shared scene-lifecycle layer in `sceneKit.js`, and
  large measured wins (one scene 1,070 → 18 draw calls a frame). 4.0.1 made
  Sphere's label rotation actually render. 4.0.2/4.0.3 released the eight
  held Library notes, routed catalogue chatter to a private `catalog` field,
  and ramped HSTS to a year. 4.1.0 took Vite 6 → 8 — a bundler swap, since
  Vite 8 replaces Rollup with Rolldown — gates proven to still fail before
  the site was allowed to build, and the CSS minifier pinned because the new
  default deleted three documented fallbacks.

- **4.1.1–4.1.3 (2026-09-02):** the landing page's ten thumbnails.
  4.1.1 gave every scene a first frame before `create()` returns — Harmonics
  and Outside had only scheduled theirs, so a pause arriving before that
  callback left them having drawn nothing at all, which is what the blank-tile
  sighting was — and added `data-blits` to the clipped-preview canvases so
  "hasn't drawn yet" and "will never draw" stopped being the same observable.
  4.1.2 took frame-rate coupling out of Butterfly (both modes), Sphere and
  Harmonics' twinkle, verified by measurement across 30/60/144 fps rather
  than by looking. 4.1.3 then raised Butterfly's *thumbnail* rate from 120 to
  400 points a second — preview only, one constant, full mode untouched — so
  the tile reaches a legible attractor in about a second instead of
  twenty-five. The suggested 5–8× starting point overshot: the Lorenz
  silhouette reads from a few hundred points, so the faster candidate reached
  steady state before anyone had finished looking and flattened the brightness
  ramp on the way.

- **4.2.0 (2026-09-02):** the scenes-sum assertion from the 2026-09-01
  audit, finally concrete because an eleventh scene was attempted. Every scene
  either builds a `/text/` page or is named in `TEXT_EXEMPT` with a reason, and
  the build fails in three directions rather than one. That needed the scene
  registry out of `main.js` into an import-free `src/scenes/registry.js`, with
  the loaders derived by `import.meta.glob` so scene names are listed once. The
  eleventh scene itself — Spectra, a plate of dramatic voice — was built,
  verified, and shelved for focus rather than for a defect; see
  `src/scenes/spectra/SHELVED.md`.
- **4.2.1 (current, 2026-09-02):** the deploy's `/text/` check made to test what
  its own comment claimed. It fetched the page and read the status code, under a
  comment saying it proved the served policy matched the hash those pages were
  built against; a blocked stylesheet still returns 200, so it proved nothing,
  and the bug it was named for hid behind exactly that for months. It now pulls
  the `<style>` block out of the bytes actually served, hashes it the way the
  build's own gate hashes the emitted one, and asserts that hash appears in the
  policy on the same response. In the same pass, CSP reporting was removed
  rather than completed — see Known open items.

## Keeping this file true

Any implementation brief or write-up for this project ends by naming which
lines of this file and of `perceptualmechanics-chat-brief.md` its work makes
untrue — the specific claims, not "the briefs may need updating." See
STANDARDS.md, "An implementation brief closes by naming what it
invalidates", for why that is the only gate this documentation gets.

## Known open items (as of v4.0, 2026-09-02)

The 2026-09-01 audit produced 71 findings and 4.0 closed all but the
following. Full evidence for each is in `punch-list-2026-09-01.md`; the
4.0 entry in `NOTES.md` records what was fixed and what was measured.

**Settled in 4.0.1:** Sphere's per-label rotation, which had never had any
effect because `CSS2DRenderer` overwrote the inline transform later in the
same frame. It now applies after the render, folded out of inversion and
tapered by `cos(angle)` so it can't snap at the fold boundary. Shipped
after looking at it in motion — see the 4.0.1 entry in NOTES.md, including
the two defects that only a live look surfaced.

**Settled, so it isn't re-opened:** `beamline.text.js:68`'s "harmonics
echoing at mathematically precise points" was flagged during the 4.0
content fix as a possible second victim of the same rename that produced
`harmonicss`. **Scott confirmed 2026-09-02 that it is original.** It is
the word he wrote, about a plucked string, and it stays. Don't re-flag it.

**Deployment state:** everything through **v4.1.0** is deployed. Confirmed
2026-09-02 against the live site: all 29 hashed asset names the landing page
references match the Vite 8 build exactly (`main-Hm0591ih.js`,
`three-5o05UEa6.js`, `main-Ccghcr8I.css` among them), which also means CI on
Linux/Node 24 and a local build on Node 22 produce identical content hashes —
the build is reproducible. `strict-transport-security: max-age=31536000`, the
CSP `style-src` hash matching the build gate's, `/assets/` at
`max-age=31536000, immutable`, and `/text/library/` returning 200. Repo and
production agree.

**Settled in 4.1.0:** the Vite 6 → 8 upgrade. Also settled: the `/text/`
pages deliberately publish no Library notes — the link-graph problem that
drove 4.0.2 does not exist on prerendered pages, and the notes are not
wanted public regardless. The archive stays a strict subset of the scene;
`scripts/prerender.js` records the reasoning.

**Settled in 4.0.3:** HSTS is at `max-age=31536000`. It was ramped on
evidence rather than on schedule — v4.0 deployed, and the live site returned
the header alongside `nosniff` and the cleaned `script-src`, which proved
DreamHost reads `.htaccess` and `mod_headers` is present. That was the only
thing the 300-second window existed to test. Still no `preload`, still no
`includeSubDomains`. Also settled: the eight held Library notes were
rewritten and released, `NOTE_HOLD` is empty, and all 81 note links render.

**Resolved in 4.0, listed here so they aren't re-derived as open:**
security headers (all six now set, with reasoning in `.htaccess`); the
Google Fonts item, which was *already* stale before the audit — the fonts
have been self-hosted for a while and only a comment still mentioned
`fonts.gstatic`; the Rollup chunk-size warning, fixed back in 3.10.0; the
CSP, which now exists, enforces, and is down to `script-src 'self'` with
no hashes at all.

**Genuinely open:**

- **The three landing tiles reported blank on 2026-09-01 are all accounted
  for.** Harmonics and Outside were a first-frame race, fixed in 4.1.1 and
  confirmed live — they had only *scheduled* their first frame, and the page
  can pause a tile before a queued callback runs. Butterfly was frame-coupled
  accumulation, fixed in 4.1.2. Nothing here is open; the entry is kept only
  so the sighting isn't re-investigated from scratch. If blank tiles are ever
  seen again, `document.querySelector('#preview-<scene> canvas').dataset.blits`
  is the first thing to read: `0` never drew, `1` drew once and stopped, a
  number that climbs between two reads means the tile is fine and something
  else is wrong.
- **Settled 2026-09-02: there is no CSP reporting, and that is a decision.**
  Not an open item any more. `report-to` and `Reporting-Endpoints` are removed
  rather than wired up — a header advertising a collector that 404s is a
  configured-looking nothing. Three reasons, in full in `public/.htaccess`:
  there is no server, and the only on-origin option makes "static, no backend"
  untrue; `Reporting-Endpoints` is Chromium-only, so building it buys reporting
  from some browsers and silence from the rest, which is a blind spot shaped
  like a working system; and in practice most CSP reports are browser
  extensions, which on a third-party collector means a stream of what visitors
  have installed leaving the origin. The specific failure it was wanted for —
  the `/text/` pages unstyled from 3.12.1 — is covered deterministically
  instead, by the deploy check in 4.2.1 below. Don't re-open this without a
  reason that answers those three.
- **A `catalog` field is private only in the sense of not being rendered.**
  It lives in `library.text.js`, which the scene imports, so the seven
  catalogue fragments still ship inside the public JS bundle and are
  fetchable by anyone who requests the chunk. That was equally true of every
  note before 4.0.2. Getting them genuinely off the server means moving them
  out of the bundled module — a real architectural change nobody has asked
  for. Recorded so "private" isn't read as stronger than it is.
- **`createJumpList` still takes a flat list.** Library needed grouping (265
  stops, a WCAG 2.4.1 problem) and built its own grouped `<nav>` locally
  rather than extending the shared helper. It is the one place in 4.0 where a
  scene reimplements something shared instead of using it — exactly the drift
  STANDARDS.md's third-scene rule exists to prevent. What it would need:
  an optional `groups: [{label, items}]` shape, a `skipLabel` for a leading
  bypass control, and a caller-supplied sort, with today's flat callers
  unchanged.
- **Library's shelf is still 535 draw calls** (down from 1,603). Merging
  the 265 spines further breaks per-mesh raycast, the hover scale bump
  and per-spine emissive glow simultaneously; it needs a hover mechanism
  designed first, not a bigger merge.
- **Library builds 265 spine canvases in one synchronous task** at scene
  open — now ~4× cheaper in raster work, but still one long main-thread
  block. Chunking it across frames would make spines pop in; that's a
  taste decision, not a technical one.
- **One Orrery navigation quirk** introduced by the collider fix and kept
  deliberately: two adjacent rings' low arcs leave a 0.46-unit gap, and a
  0.6-unit-wide visitor pressed into it can't strafe out sideways.
  Backing up frees you immediately. Being unable to squeeze between two
  rings is correct; papering over it with a smaller collider radius would
  restore the walk-through it replaced.

## Where things live

- **This repo** (`perceptualmechanics`) — the live site + all code. Deploys via manual `dist/` upload.
- **`STANDARDS.md`** — durable coding standards with reasoning attached. Check first before any modernization pass.
- **`NOTES.md`** — the dated changelog + working punch list. Very long; recent entries are at the top (reverse-chronological), older architecture/convention notes live in named sections throughout.
- **Content sourcing** (the two books this site's writing is drawn from) lives outside this repo, in a separate Scrivener project (`Holography.scriv`).
