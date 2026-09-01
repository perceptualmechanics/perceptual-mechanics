# perceptualmechanics — project brief

*Prepared 2026-08-31, current as of v3.9.17. Written as a handoff/context document for a fresh chat — everything here should be enough to pick up work on this project without re-deriving it.*

## What this is

perceptualmechanics.com is Scott Cohen's personal digital-art portfolio: a single-page, full-screen WebGL/canvas site built around **10 interactive scenes**, each a small standalone piece combining generative visuals, curated writing/found text, and (in most scenes) generative or triggered audio. It's a static site (no backend, no database) — everything client-rendered, deployed as a plain `dist/` upload.

Collaborators: Scott (vision, writing, curation) and Claude (code, literary analysis, implementation) — this has been a long-running, deeply iterative collaboration, not a one-off build.

## Tech stack

- **Vite 6.4.3** build pipeline (esbuild-based), no framework — vanilla JS modules, no React/Vue/etc.
- **Three.js 0.185** for every WebGL scene.
- Plain CSS per scene (`<scene>.css`), no CSS framework, no preprocessor.
- Node 24 (`engines: ">=22.0.0"`), deploys to **DreamHost** via manual `dist/` upload to the public root. No server-side dependencies.
- `npm run build` runs two build-time content-integrity gates via Vite plugin hooks (not npm lifecycle hooks, which silently don't fire under `vite build` directly — see conventions below): `verify-links` and `verify-resonances`, which check that every cross-reference/resonance link in the content actually resolves to a real piece.
- `scripts/prerender.js` generates static `/text/<scene>/` pages from the same content modules the scenes render from, so crawlers (which don't click) can still index the writing — this was a deliberate SEO fix, not incidental.

## Architecture — per-scene folder convention

Every scene is a fully self-contained folder: `src/scenes/<name>/<name>.{js,css,html}` plus `<name>.text.js` (or multiple `.text.js`-style modules for scenes with more than one kind of content — e.g. library has `library.text.js` + `library.cdRack.js`). Nothing about a scene lives outside its folder except `src/utils/sceneKit.js` (shared helpers: `bindEscapeClose`, `createPanelCloser`, `createJumpList`, `wireCrossLinks`, `mountClippedPreviewCanvas`, and others extracted once logic showed up in a third scene) and the one-line registration in `src/main.js`.

Static shell markup lives in `<name>.html`, imported as a raw string and parsed into a real `DocumentFragment` via `parseHTML()`. Content (a scene's actual writing, per-item data) always lives in a `.text.js` module that both the scene *and* `scripts/prerender.js` import — never copied, never duplicated, so the live site and the crawlable `/text/` pages can't drift apart.

`src/main.js` owns: the scene registry (`SCENES`), hash-based deep linking (`#scene` or `#scene/pieceId`, with a small public-slug translation layer for the one scene — Harmonics — whose URL differs from its internal name), scene-swap transitions (crossfade via `#experience-overlay`'s opacity), modal focus containment while a scene is open (Tab-trapping, `aria-hidden` on the chrome), the shared fullscreen toggle, and a small easter egg (`pmGlimpse` — a 1-in-100 chance per hover that the tab title flickers to a one-word association for that scene).

## The 10 scenes

1. **Sphere** — interactive geodesic sphere with embedded text fragments.
2. **Butterfly** — a Lorenz attractor ("Chaos Butterfly in Phase Space"), drag to orbit.
3. **Scroll** — "Selected Works," a scroll of found writing/carved fragments, 2000s–2010s.
4. **Theater** — ASCII-rendered actors performing scenes from three different pieces, MST3K-style with a silhouetted "house" audience; different program each visit.
5. **Orbiter** — a hydrogen p-orbital rendered as a probability cloud with satellites in clean elliptical orbits.
6. **Orrery** ("The Orrery of Los Feliz") — a found story told through a 30-foot walkable orrery (nine planets, moons, asteroid belt) — WASD/arrow-key movement, not orbit-drag.
7. **Library** — a real bookshelf (147 items + 115 CD-rack items) rebuilt as a shelf you can turn and read spines from.
8. **Beamline** — a staged sequence of curved mirrors with a beam of light *reflecting* (not transmitting) between them, found text surfacing at each bounce.
9. **Harmonics** (9th scene; internally still named/keyed `harmonics` everywhere except the public URL slug — a deliberate, documented exception) — visualizes resonant connections across every other scene's content as a force-directed node graph with Kuramoto phase-sync animation and sonification.
10. **Outside** (10th scene) — a generated lotus/flower (Gielis superformula geometry) mapping a five-part cosmology (Power Sources as petals, Folk Origins, Magi/Psi at center); breathes continuously, Fresnel-based petal translucency, five distinct per-petal chime timbres plus a Kumoi-scale ambient chime bed.

A few earlier scenes (leaf, egg, prism, cycle, and older constellation/ground-glimpse/thread-follow mechanics) were built, shipped, and later **retired/shelved** over the project's history — the current registry above is the live set as of v3.9.17.

## Standing conventions (full detail in `STANDARDS.md`)

This is the durable house-rules file (created v3.9.16) — **read it first** before any future "modernize/audit the code" pass, since it already contains reasoned answers rather than requiring re-derivation:

- **Centering:** flex/grid by default. `left`/`top` + `transform` is reserved for two legitimate cases only — coordinate-anchoring (a DOM overlay positioned against a point projected from a Three.js scene) or a decorative element at a fixed offset within its own positioned ancestor. Never for viewport/row self-centering (that was a real, fixed bug — letter-spacing's trailing gap threw off self-width-measuring transforms).
- **Vendor prefixes:** kept only with a stated, individually-checked reason, never by default in either direction.
- **`!important`:** exactly two legitimate categories — overriding a third-party library's inline styles (Three.js's `renderer.setSize()`), and accessibility overrides (`prefers-reduced-motion`, state-flip utilities like `.no-transition`).
- **Mobile-first CSS, non-negotiable going forward.** Base rules target the smallest viewport; `min-width` layers on enhancements. As of v3.9.17, **all 12 of 12 stylesheets are converted** (the last two — `main.css` and `theater.css` — were held back from the v3.9.16 pass deliberately due to real regression risk and converted as a dedicated v3.9.17 follow-up with live-browser verification; see below).
- **Media queries are nested inside their selector**, tab-indented — not separate top-level `@media` blocks. Standing convention since v3.9.16, confirmed harmless for browser support since Vite/esbuild flattens nesting to plain CSS at build time regardless.
- **Semantic HTML, classes for styling** (ids reserved for real DOM uniqueness or ARIA idrefs), **mobile + accessibility checks are now standard** parts of shipping any change (not a separate later pass).
- General principle: "looks outdated" isn't the test for whether to change a pattern — "is there a strictly better tool for what this code is doing" is. A full-site audit found real anti-patterns *and* patterns that only look dated; both got recorded so the distinction doesn't need re-litigating.

## Recent history (chronological highlights, oldest → newest)

- **3.9.4–3.9.8:** Node LTS bump (Node 20 → 24, security-support-driven), shared fullscreen toggle added site-wide, Outside's ambient audio decoupled from `requestAnimationFrame` (rAF throttles when a tab backgrounds — audio scheduling needs a `setInterval` lookahead scheduler instead), site-wide title/subtitle consistency pass, serif swap to Arapey (including canvas-rendered text in Beamline/Butterfly).
- **3.9.9–3.9.12:** Persisted sound on/off toggle for Harmonics and Outside — went through several iterations (shared key → activation-not-firing bug → TDZ crash from the fix → finally un-shared into per-scene keys).
- **3.9.13–3.9.14:** Fixed a real letter-spacing centering bug (Chrome adds the tracking gap after the last character too) and used it to drive a full site-wide refactor from `transform`-based centering to flexbox.
- **3.9.15:** Full-site CSS audit — removed genuinely dead code (a stale `#butterfly-exp-label` block, an inert `-webkit-overflow-scrolling: touch`) and fixed a real missing-fallback bug (`theater.css`'s mask had only the `-webkit-` prefix).
- **3.9.16:** Much larger modernization pass — full CSS + JS sweep, mobile-first conversion for 10 of 12 stylesheets (2 flagged for dedicated follow-up), native CSS nesting for all converted media queries, a real dead-cascade-order bug found and fixed in `sphere.css`, and the creation of `STANDARDS.md` itself.
- **3.9.17 (current, 2026-08-30):** Closed out the mobile-first audit — converted the final two flagged files. `main.css`'s nav-icon/landing responsive system (which has a real, four-times-recurred regression history: icon count changes have repeatedly reintroduced silent edge-clipping at specific pixel thresholds) was converted and live-verified at the exact widths that broke before. `theater.css`'s one genuinely compound media query (`@media (max-width:480px), (max-width:700px) and (orientation:portrait)`) was inverted using actual De Morgan's-law algebra rather than a naive per-clause flip, verified with an orientation-aware cascade simulator plus live-browser spot checks. One honest gap recorded rather than papered over: the narrowest region (width ≤480px AND portrait) couldn't be reached live in this session due to a sandbox browser-pane width floor — it rests on the simulator/hand-derivation only, flagged as such in both `STANDARDS.md` and `NOTES.md`.

## Known open items (from the standing best-practices review, first pass 2026-08-25 — check whether these are still current before acting)

- No security headers in place (HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, frame-ancestors) — `.htaccess` currently handles canonical-host redirects only.
- No CSP — complicated by inline `onmouseover`/`onclick` attributes used site-wide for the `pmGlimpse` easter egg and scene-opening; a naive lockdown would break them without a refactor.
- Google Fonts loaded at request time rather than self-hosted (LCP cost + sends visitor IPs to Google).
- Vite is 2 majors behind latest (6.4.3 vs. 8.2.2) — `npm audit` clean as of last check, but nothing in CI gates future dependency regressions the way the content-integrity scripts do.
- The Rollup "chunks larger than 500kB" warning has fired on every build without being resolved or explicitly accepted — root cause is that every scene's full-mode code loads eagerly on first paint, not lazily on expand. Genuinely undecided: accept current size + raise the warning threshold, or pursue lazy-loading (bigger change, real Core Web Vitals payoff). Scott's call, not yet made.
- `butterfly` auto-rotate/camera-sweep for a vertical (9:16) YouTube Shorts export — listed as a "next up" item, not started.

## Where things live

- **This repo** (`perceptualmechanics`) — the live site + all code. Deploys via manual `dist/` upload.
- **`STANDARDS.md`** — durable coding standards with reasoning attached. Check first before any modernization pass.
- **`NOTES.md`** — the dated changelog + working punch list. Very long; recent entries are at the top (reverse-chronological), older architecture/convention notes live in named sections throughout.
- **Content sourcing** (the two books this site's writing is drawn from) lives outside this repo, in a separate Scrivener project (`Holography.scriv`) plus `seeds.md` in this repo's root for material not yet promoted into that project.
