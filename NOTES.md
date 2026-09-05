# perceptual mechanics — notes & punch list

This file is solely about the perceptualmechanics site — the live code, deployment, and content
sourcing that feeds into it. Reorganized 2026-07-16: everything about the two other writing
projects (The Secret World, A Manual of Perceptual Mechanics) moved into their own Scrivener
files, which are now the source of truth for that material going forward. See "project map"
below for where things live.

Coding standards (centering technique, vendor-prefix policy, `!important`
policy, mobile-first convention, and the reasoning behind each) live in
`STANDARDS.md`, not here — check that file first before any future
"modernize the code" pass. This file stays a dated changelog of what
shipped when.

**Split at 5.0.** This file had reached 17,500 lines, which put the standing
sections below — the part that is actually read before doing work — under
sixteen thousand lines of dated entries. Everything from 1.0 through 4.8.9 now
lives in `NOTES.archive.md`; the standing sections and 4.9.0 onward stay here.
When this gets long again, the next block moves across the same way.

## Standing process — periodic best-practices review

Added 2026-08-25, at Scott's explicit request, as its own standing habit
rather than a one-off: periodically check this project against *current*
outside best practices (security headers, dependency support windows,
performance/Core Web Vitals guidance, accessibility standards), not just
against its own accumulated internal conventions. The two are different
failure modes — everything below this line can be internally consistent
and still be quietly behind what the wider web now considers baseline,
the same way "no console errors" doesn't mean "no accessibility gap" (see
the 2026-08-25 Outside `createJumpList` entry). Search for current
guidance rather than trusting stale training-era defaults — recommended
practice in this space (security headers, LTS windows, framework
versions) shifts on a timescale of months, not years.

**First pass, 2026-08-25 — findings, most not yet acted on:**
- ~~CI pins `node-version: 20`~~ **Fixed (3.9.4).** Node 20's security
  support window ended 2026-04-30 (confirmed via endoflife.date) — the
  live deploy pipeline had been running on an unsupported Node release
  for months. Bumped `deploy.yml` to Node 24 (current Active LTS; vite
  6's own `engines` range, `^18||^20||>=22`, already covers it) and added
  a real `engines.node: ">=22.0.0"` field to `package.json` documenting
  the actual floor, rather than leaving it undocumented.
- `.htaccess` handles canonical-host redirects only — no HSTS,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, or
  `frame-ancestors`/`X-Frame-Options`. None of these are in place today.
- No CSP. Real complication if one gets added later: the nav icons and
  preview tiles use inline `onmouseover`/`onfocus`/`onclick` attributes
  site-wide (the `pmGlimpse` easter egg, scene-opening) — a naive
  `script-src` lockdown breaks all of them without either a refactor to
  `addEventListener` or a CSP3 `'unsafe-hashes'`/nonce approach. Worth
  scoping deliberately, not bolting on as an afterthought.
- Google Fonts loaded from `fonts.googleapis.com`/`fonts.gstatic.com` at
  request time rather than self-hosted — an extra DNS/TLS hop against LCP,
  and (independent of that) sends visitor IPs to Google on every load.
- `vite` is on 6.4.3; latest is 8.2.2 — two majors behind. `npm audit`
  is clean (0 vulnerabilities) as of this check, but nothing in CI gates
  future regressions the way `verify-links`/`verify-resonances` gate
  content regressions.
- ~~The `(!) Some chunks are larger than 500 kB` Rollup warning~~ **Fixed
  (3.10.0).** All ten scenes moved behind dynamic `import()` — see the
  3.10.0 entry below. The warning is gone (`chunkSizeWarningLimit` raised
  to 600 for the one legitimate large chunk left, three.js's own vendor
  chunk, documented in `vite.config.js`). Note the honest caveat in that
  entry: this doesn't shrink first-visit bytes yet, since every scene's
  preview thumbnail still needs its full module — that's tracked
  separately as an open follow-up, not silently dropped.
- **Preview/full split — done, 2026-08-31 (3.10.3).** Five of ten scenes
  changed: Harmonics (3.10.1), Orrery (3.10.2, partial — audio only),
  Sphere/Scroll/Theater (3.10.3). Beamline and Library assessed and
  skipped for real architectural reasons, not shortcuts (Beamline has no
  self-contained full-mode-only code; Library's preview needs the real
  catalog to lay out the shelf's own geometry, not just to texture it).
  Orbiter/Butterfly/Outside not touched — see the Tier 2 call below.
  Pattern that held across the whole arc: every "sphere-pattern" scene (all but
  theater.js/scroll.js) builds its `animate()`/`dispose()` as ONE unified
  function where genuinely shared per-frame work (orbital motion, ambient
  particles, cellular automata, physics sims) is interleaved with
  full-mode-only interaction in the same function body — splitting that
  safely means restructuring `animate()` itself across a module boundary,
  real risk for what the survey already showed is often a small payoff
  (shared geometry/physics dominates most scenes' size either way). The
  one reliable win-shape: a self-contained full-mode-only subsystem with
  no closures over scene/camera/renderer state (Harmonics' cross-scene
  text resolution, Orrery's poster audio, Sphere/Scroll/Theater's own
  `.text.js` content). **Checkpoint, computed from real build output:**
  first-visit gzip is roughly 306kB, of which three.js's own vendor chunk
  is 142.5kB (46.6%, not prunable — genuinely needed by the 3D preview
  thumbnails). This arc keeps about 82kB gzip of content out of that
  number entirely, deferred to click-time. Tier 2 (Orbiter/Butterfly/
  Outside) was explicitly not pursued: the remaining eager `.text.js`
  content across all three sums to under 2.5% of the total even in the
  best case, and Orrery/Beamline already set real precedent that this
  scene shape (continuous, interleaved physics/animation loops) usually
  has nothing safe to extract. Full detail, exact byte breakdown, and
  reasoning per scene in the 3.10.1/3.10.2/3.10.3 entries above.

This section should get revisited on its own cadence going forward —
next time, check whether the items above got resolved, and run the same
"what's actually current now" search again rather than assuming this list
is still accurate.

## Standing notes — build tooling, generated output, SEO

Rules that earned their place by being learned the hard way. They apply to any
future build-step or search-visibility work, not just the entry that produced
them. Read these before adding anything that runs at build time.

- **Hook the command people actually run, not the one the docs say to run.**
  Verification around here is almost always a bare `npx vite build`, not
  `npm run build`. Anything that must happen on every build belongs in a vite
  plugin, not chained into the npm script — otherwise it silently no-ops during
  exactly the step meant to catch problems, and the build "passes" while
  producing incomplete output. This is why `scripts/prerender.js` runs from a
  `closeBundle` hook (1.7.0). Corollary: read the resolved `outDir` from config
  rather than hardcoding `dist`, or a `--outDir` build writes to the wrong place.
- **Derived artifacts get generated, never hand-maintained.** `sitemap.xml` sat
  stale at one URL for months because it was a file someone had to remember to
  edit. If a file's correct contents are a function of something else in the
  repo, generate it from that thing. The same goes for anything that has to
  agree with a list of scenes, pages, or routes.
- **Published copies import; they never copy.** Content lives in a `.text.js`
  module colocated with the scene that shows it (`src/scenes/<name>/<name>.text.js`
  — see the "Per-scene folder structure" convention below; `src/text/` doesn't
  exist as of 2.1.0), with no rendering attached, and anything that republishes
  it — a page, a feed, an export — imports that same module. Two copies of the
  same paragraph will drift, and the drift is invisible until someone notices
  the site and the archive disagree. When moving content to make this true,
  deep-compare the moved constants against `HEAD` and confirm lossless before
  shipping.
- **Client-rendered content is invisible content.** Anything built inside a
  click handler is unreachable to crawlers, which run JavaScript but don't
  click. Any new scene that carries real writing needs a `/text/` page in the
  same pass, or it ships unfindable — and the whole point of 1.7.0 was that this
  had quietly been true of everything for as long as the site existed.
- **A field the scene doesn't render was withheld on purpose.** Before
  republishing any data-module field, grep the scene for what it actually
  displays — not what the module contains. library.js keeps its `note`
  assignment commented out with Scott's reason attached ("I'm not sure I want
  it there yet", 2026-07-23), and 1.7.0 published all 97 of them anyway,
  editorial TODOs included, on the reasoning that they were the best writing in
  the file. That reasoning was true and irrelevant. "Is this good?" is the wrong
  question; "does the site show this?" is the right one. Same discipline as the
  copyright call on `excerpt`, and it's the one that got missed — a guard you
  chose to build doesn't cover the case you never thought to check.
- **Verify a deploy through a cache-buster.** The first fetch of the homepage
  after the 1.7.0 deploy served a stale copy missing the new link; `?cb=1`
  returned the current one immediately. Hashed asset filenames make JS/CSS
  self-busting, but `index.html` itself is cached at the edge, so a
  freshly-deployed page can look unchanged for a while. Don't diagnose a
  deploy from an uncache-busted request.
- **A filter that matches nothing looks exactly like a category that's empty.**
  1.7.1 verified the library page by checking that the bad thing was absent, and
  the bad thing was absent — but nobody checked that everything present was
  accounted for. A `type === 'box'` filter against data that says
  `divination_box` dropped two entries silently for a day while the page's own
  description advertised them. Any code that routes records into buckets should
  assert that the buckets sum to the input, and fail the build if they don't.
  Absence-checks and completeness-checks are different checks; the first one
  passing tells you nothing about the second.
- **Report a measurement with its method.** Word counts, ratios, and "N checks
  passed" are all method-dependent, and quoting a number from an earlier run
  after changing the method produces a real error (caught in 1.7.0: 40,267 vs
  39,930, same build, different counter). State the ruler alongside the number.
- **Keep two different kinds of unverified separate.** "Not verified live" means
  no browser route existed. "Not independently verifiable" means it was checked
  by a script whose output only ever existed in-session, so the person reading
  the note can't confirm it without the same artifacts. Both deserve saying;
  conflating them makes the second one sound stronger than it is. Give the
  reader a concrete spot-check they can run themselves.
- **Scope untestable server config narrowly.** Apache rewrite rules can't be
  tested from here. When extending them, add a new rule scoped to the new path
  rather than generalizing a proven one — a bad regex confined to `/text/` costs
  a few pages, the same mistake in the root rule can loop the homepage (1.7.0,
  following 1.2.3).
- **A script only wired as an npm pre-lifecycle hook ("prebuild" etc.) doesn't
  actually run.** Verification around here is almost always a bare
  `npx vite build`, which skips npm's own script lifecycle entirely — the same
  reason `scripts/prerender.js` runs from a `closeBundle` vite plugin hook
  (1.7.0) is why `scripts/verify-links.mjs` runs from a `buildStart` plugin hook
  (2.3.0) instead of a `"prebuild": "npm run verify-links"` line, which was
  the first draft and would have silently never fired. Anything that must
  gate every build belongs in `vite.config.js`, not `package.json`'s
  `scripts` block.
- **Linking & addressing: one scheme, one store.** Every scene's pieces carry
  a stable, unique-*within-that-scene* `id` (a real field on the piece, e.g.
  `sphere.text.js`'s fragments, never derived from a title or any other
  mutable text) — library's items were the original model for this; every
  other scene migrated onto it in 2.3.0. A link between two pieces —
  same-scene or, once anything actually does that, cross-scene — is one row
  in `src/links.js`, addressed by `{ scene, id }` pairs, not a value
  hand-authored into two different scenes' own files. `getOutboundLinks`/
  `getInboundLinks` (`src/links.js`) are how a scene reads its own links back
  out, including ones where it's only the target — see that file's own header
  for the full model and scripts/verify-links.mjs for how it's kept honest.
  Any future scene that wants clickable cross-piece links reads and writes
  `src/links.js`; it does not grow its own local link table the way sphere/
  orbiter/scroll/library each independently did before this.

## Per-scene folder structure & markup conventions

Established across 2.1.0 (folder restructure) and applied consistently to
every scene since. Read this before touching any scene's markup, styles, or
adding a new scene.

- **One self-contained folder per scene.** `src/scenes/<name>/<name>.{js,css,
  html}`, plus `<name>.text.js` (or `<name>.<thing>.js` for a scene with more
  than one data module, e.g. library's `library.text.js` +
  `library.cdRack.js`, or scroll's `scroll.text.js` + `scroll.bodies.js` +
  `scroll.ogham.js`) for anything that's real writing/content rather than
  scene logic. Components that aren't scenes (colophon) follow the same
  pattern one level up: `src/components/<name>/<name>.{js,css,html,text.js}`.
  Nothing about a scene should live outside its own folder except the shared
  `src/utils/sceneKit.js` grab-bag and the one-line registration in
  `src/main.js`.
- **Static shell markup lives in `<name>.html`, imported as a raw string.**
  `import fooHtml from './foo.html?raw'` at the top of `foo.js`, parsed via
  `parseHTML()` (`src/utils/sceneKit.js`) — a `<template>` element under the
  hood, so the string becomes a real, safely-queryable `DocumentFragment`
  before anything touches the live DOM. The dividing line for what goes in
  the `.html` file vs. stays JS-built: genuinely static structure (a panel's
  skeleton, a hint paragraph's fixed wording, a button) goes in the file;
  genuinely per-instance/data-driven content (a library spine's title, an
  orrery placard's found text pulled from `.text.js`, per-item DOM built in
  a loop) gets set via `textContent`/`innerHTML` on the parsed elements
  after mount, same as it would if hand-built. A scene with real preview-vs-
  full-mode branching (theater, library) keeps both mutually-exclusive
  fragments in the one `.html` file, since only one is ever mounted per call
  — see theater.html's own header comment for the reasoning.
- **Classes for styling; ids only where something genuinely needs one.** A
  real id is justified by exactly two things: it's the target of an ARIA
  idref (`aria-labelledby`, `aria-describedby`, `aria-controls` all require
  a real id per spec — every scene's panel title is the recurring example,
  e.g. `library-panel-title`), or the code needs `document.getElementById`
  / global DOM uniqueness (scroll's `scroll-svg-defs` guards against double-
  injecting its SVG filter defs across repeat scene visits; its three
  `<filter id="...">` elements are ids because CSS `filter: url(#id)`
  requires one). Everything else — a local `panel.querySelector(...)` scoped
  to one scene instance, a button a closure already holds a reference to —
  converts to a class with no functional difference, and should. When an
  element keeps its id for one of the two reasons above, give it a class
  too if it also needs styling (e.g. `id="library-panel-title"
  class="library-panel-title"`) — the id is there for the ARIA relationship
  alone, not doing double duty as a style hook.
- **Semantic HTML, fewer divs.** Reach for `<section>`, `<aside>`, `<nav>`,
  `<h1>`–`<h6>`, `<blockquote>`, `<figure>` before a bare `<div>`/`<span>`
  wherever a native element's meaning actually fits — a panel's title is a
  real heading (`<h2>`, still `tabindex="-1"` and focusable the same as a
  div was), a non-modal in-scene read-more panel is `<aside role="dialog"
  aria-modal="false">`, the site's one true modal (colophon) is `role=
  "dialog" aria-modal="true"`. A `<section>` with its own `aria-label` or
  `aria-labelledby` already implies an accessible landmark region — no need
  for an explicit `role="region"` alongside it. Converting a `<div>` to a
  heading/paragraph tag changes its user-agent default margins (headings
  carry top margin, paragraphs carry top+bottom) — reset them explicitly in
  CSS (`margin: 0 0 <old-bottom-value>`) so layout stays pixel-identical;
  every conversion this round called this out in a comment at the site of
  the change. Don't force semantics that don't fit just to avoid a div —
  scroll.js's excerpt text stays a plain `<p>`, not a `<blockquote>`, per
  Scott's own explicit call (see library.js's populatePanel comment) that
  quoted excerpts read better as plain text there.
- **Text data is real content, not scene logic — colocate it, but keep
  scene and prerender importing the same module.** Every `.text.js` (or
  `.<thing>.js`) module a scene imports must also be the exact module
  `scripts/prerender.js` imports for that scene's `/text/<name>/` pages —
  moving one without the other breaks the build (prerender.js's imports are
  live code, not just documentation) or silently forks the content into two
  copies that drift. `src/text/` as a shared top-level folder is gone as of
  2.1.0 — every module that used to live there moved into the scene folder
  that actually uses it.
- **Any new WebGL scene must wire its preview tile into
  `mountClippedPreviewCanvas` (sceneKit.js).** The landing page's
  `.preview-container` tiles are meant to be circular (`border-radius:50%`
  + `clip-path:circle(50%)`), but a sufficiently heavy WebGL canvas gets
  promoted to its own GPU compositing layer in Firefox and ignores that
  clip entirely — the tile renders as a plain square. First hit and fixed
  for leaf/orrery around 1.0.36-1.0.41 (full diagnostic history in this
  file); the fix itself lives in `sceneKit.js` and is opt-in per scene, not
  automatic, so it does nothing for a scene that never calls it. Harmonics
  and Outside were both built after the fix already existed and both
  shipped with the bug anyway (fixed in 3.9.2) because neither one was
  wired in — they just used the older, naive `container.appendChild
  (renderer.domElement)` pattern that predates the fix. Any scene with a
  `THREE.WebGLRenderer` needs, in its `preview` branch: skip the direct
  `appendChild`, call `mountClippedPreviewCanvas(container, renderer)`
  instead, add `clippedPreview?.blit()` right after `renderer.render(...)`
  in the animate loop, and `clippedPreview?.dispose()` in `dispose()` — see
  orrery.js, beamline.js, harmonics.js, or outside.js for the exact
  four-point pattern. Lighter scenes (sphere, butterfly, scroll) haven't
  hit this and clip fine via plain CSS, but there's no reliable weight
  threshold to predict which will — the safe default for any new WebGL
  scene is to wire the fix in from the start rather than wait for a Firefox
  screenshot to catch it.
- **Any new scene needs a secret word for the status-bar easter egg —
  abstract/thematic, never a literal noun for what's on screen.**
  `PM_GLIMPSE_WORDS` in `main.js` (see "Status-bar easter egg" comment
  there) keys every scene's `pmGlimpse('<key>')` hover trigger to a word
  that flickers into the browser tab title for ~1.1s on a 1-in-100
  hover/focus chance. Look at the existing set as a whole and the pattern
  is consistent: sphere → "zen archery", butterfly → "complexity", scroll →
  "savagery", orbiter → "atmosphere", orrery → "will", library → "medium",
  beamline → "emergence", harmonics → "vibe", outside → "bloom". None of
  these name the rendered object (no "sphere," "wings," "star field," or
  "flower") — every one names the *idea underneath* it: a mood, a theme, an
  abstract concept the scene is really about. That's the actual bar for a
  good word here, not just "Scott's own call, ask first" (though it is
  that too) — a proposed word should be judged against this pattern before
  it ships.
  Case in point, 2026-08-25: a brief (drafted externally, on Scott's
  behalf, by another assistant) called for changing Outside's word from
  "bloom" to "lotus." Made the change as asked, no pushback — but "lotus"
  is exactly the kind of literal, on-the-nose choice the existing set
  avoids (it just names the flower Outside already renders); "bloom" is
  the abstract-verb version of the same image, matching "will" and
  "atmosphere" and "emergence" in register. Scott reverted it back to
  "bloom" unprompted and called it out as the better call. Lesson: when a
  future brief — from Scott directly, or drafted on his behalf by another
  assistant — proposes a literal word for this slot, that's worth a
  flagged second look before implementing verbatim, not just a compliant
  edit. A new scene missing an entry fails silently either way
  (`pmGlimpse` no-ops on an unknown key rather than showing "undefined"),
  so there's no runtime signal forcing the question — it has to be asked.
- **A mobile viewport check and a keyboard/a11y check are part of shipping
  any scene or feature change, not a separate occasional pass.** Both were
  previously treated as their own standalone QA rounds (see the 2.x-era
  "Mobile QA pass" / "Accessibility audit" entries); as of 2026-08-25
  they're folded into the normal verification step for any visual or
  interactive change, the same way a `npx vite build` and a live check
  already are. Concrete case that prompted this: Outside's petal-touch
  interaction (pulse + chime) had had zero keyboard equivalent since the
  v3.5.0 pivot removed its old panel — every other click/touch-driven
  WebGL scene on the site (harmonics, library, orbiter, sphere, orrery,
  beamline) has a `createJumpList` (sceneKit.js) wired in as the keyboard/
  screen-reader path, but Outside's own touch system was raycast-only, and
  the gap went unnoticed for months because verification here has
  defaulted to a desktop-mouse Chrome run. Fixed in the same pass (a
  `createJumpList` over the five petals + an `aria-live` region announcing
  which one fired, reusing the exact same `triggerPulse`/`triggerChime`
  calls the mouse path uses — see outside.js's own comment at the jump-
  list call site).
  Going forward, before shipping: (1) any new click/touch-driven
  interaction on a WebGL canvas needs a `createJumpList` equivalent unless
  the scene is genuinely passive/non-interactive (butterfly, the nebula
  backdrops); (2) any new persistent DOM control (toggle, button) gets a
  real keyboard-focus-and-activate check, not just a glance at its aria
  attributes — an `aria-pressed` that's never actually reachable by Tab is
  no better than one that's missing; (3) resize the browser to ≤600px
  width (this project's own existing mobile breakpoint, see main.css) and
  confirm no layout collision before shipping a visual change, the same
  spirit as the 1.0.11/1.0.40 mobile bugs caught this way. One honest
  limitation of this sandbox, noted rather than glossed over: the
  browser-automation environment used for live verification caps window
  width around 500px and can't dispatch genuine touch events, so a mobile
  check here confirms responsive CSS at a narrow-but-not-true-phone width
  and confirms touch-adjacent code paths exist, not a literal on-device
  touch test.
- **A genuinely site-wide, persistent control belongs at the shared
  index.html/main.js level, not duplicated into each scene's own
  body-level chrome.** The distinction that matters: `#pm-nav` and
  `#site-title` are the actual shared layer — one implementation, present
  identically on the landing page and every scene, wired once in main.js.
  Each scene's own title/hint/sound-toggle (e.g. `outside.html`/
  `outside.js`) is a *different* thing that looks similar — scene-owned
  markup, appended/removed on that scene's own mount/dispose, tinted to
  that scene's own palette, and (for the sound toggle specifically) only
  present on the 2 of 10 scenes that actually have sound. A brief asking
  to "match the sound toggle" for something that needs to appear
  everywhere is really asking to match the site's pill-button/icon-button
  *grammar*, not to literally clone an element that doesn't exist on 8 of
  the 10 scenes it needs to appear on. Case in point, 2026-08-25: the
  fullscreen toggle (see 3.9.5 below) is genuinely site-wide, so it's one
  `<button id="fullscreen-toggle">` in `index.html`, wired once in
  `main.js`, sharing `#site-title`'s neutral white/black scrim treatment
  and z-index tier (400) rather than any one scene's accent color — not
  ten copies. Placed at `top:4.5rem; left:1.2rem` specifically because
  every scene's own `-hint` rule already owns `top:4.5rem; right:1.2rem`
  (confirmed by checking every scene's CSS, not assumed) — the opposite
  corner, same "clears `#pm-nav`" distance, so it can never collide with
  per-scene chrome on any of the ten.
  One real gotcha hit while building it, worth remembering: a `hidden`
  attribute (used to withhold the button entirely on platforms without
  the Fullscreen API, e.g. iOS Safari) only actually hides an element if
  nothing with higher CSS specificity than the UA stylesheet's plain
  `[hidden] { display: none }` sets its own `display`. An id selector
  (`#fullscreen-toggle { display: flex; ... }`) beats that attribute
  selector, so without an explicit `#fullscreen-toggle[hidden] { display:
  none; }` override, `hidden` would silently stop hiding anything the
  moment the element also has an id-level `display` rule — checked
  against the actual cascade, not assumed to just work.
- **Continuous or generative audio triggering must be scheduled off
  `AudioContext.currentTime`, never decided inside the render loop.** A
  real, already-encountered failure mode, not a hypothetical: Outside's
  ambient chime bed used to decide "should a note fire" once per
  `requestAnimationFrame` frame (`Math.random() < rate*dt`) — but rAF
  throttles hard in a backgrounded tab (first caught during the
  curtain-motion verification pass, see the Firefox-preview-tile entry's
  neighbor in memory: this sandbox reports itself backgrounded even while
  focused, and the render loop stalls). Anything gating audio on that loop
  goes silent exactly when backgrounding happens, the opposite of
  "persistent background audio." Fixed in 3.9.5 with the standard
  lookahead-scheduler pattern (Chris Wilson, "A Tale of Two Clocks"): a
  `setInterval` tick, independent of rAF, looks a short window ahead of
  `audioCtx.currentTime` (the audio hardware's own real-time clock, which
  keeps advancing in a hidden tab even when rAF and ordinary timers slow
  down) and schedules every note due inside that window via its own
  oscillator's `.start(exactTime)` — see `scheduleAmbientNotes()` /
  `startAmbientScheduler()` in `outside.js`. Any future scene with its own
  generative/ambient (not purely one-shot-on-click) audio should use the
  same pattern from the start rather than wiring a fresh instance of this
  bug.
- **A scene's bottom-center title/subtitle anchors to `--title-block-bottom`
  (main.css `:root`), never a separately-eyeballed offset.** Established in
  the 2026-08-25 site-wide title consistency pass: every scene converged on
  uppercase/tracked/bottom-center for its title, with an optional subtitle
  in a visually secondary treatment directly beneath (never replacing the
  title). Markup pattern: a wrapper (`position:fixed; bottom:
  var(--title-block-bottom); left:50%; transform:translateX(-50%)`,
  `display:flex; flex-direction:column`) containing the title span first,
  subtitle span(s) after — this grows the block *upward* as lines are
  added, so its bottom edge (the point closest to `#site-title`'s footer
  pill) never moves regardless of line count. Mobile gets its own
  `--title-block-bottom-mobile` on the same wrapper.
  Real bug, caught live rather than assumed safe: the shared var shipped
  this pass at `3rem`, sized against a single-line title and never actually
  measured against `#site-title`'s real footprint. `getBoundingClientRect()`
  on Beamline's block (the one scene with three lines — title + two-line
  epigraph-as-subtitle) showed only ~3px of true clearance between the
  block's bottom edge and the pill's top edge — invisible on a short,
  narrow subtitle (Orbiter, Library) but a real visible overlap once a
  subtitle's text happened to sit entirely within the pill's horizontal
  footprint, made worse by every title's own text-shadow blur (12–20px)
  bleeding straight through a 3px gap. This wasn't Beamline-specific — the
  block's bottom edge sits at the same distance from the pill on every
  scene regardless of line count, so all nine scenes referencing the var
  had the same razor-thin margin; it just hadn't been *visibly* triggered
  yet. Fixed by raising `--title-block-bottom` to `4.5rem` (~27px real
  clearance) rather than patching Beamline in isolation. Lesson: a shared
  CSS-var safe-zone still needs a live `getBoundingClientRect()` check
  against the thing it's meant to clear, not just an eyeballed value that
  happens to look fine on the first scene it's tried against.
  Scroll is the one exception to the "just use the shared var" rule,
  because it's the one scene whose own body content actually scrolls
  underneath this same bottom band — see `--footer-safe-zone` below.
- **`--footer-safe-zone` (main.css `:root`) is for an actual SCROLLABLE
  content region sharing the footer's bottom band, not fixed decorative
  title text — Scroll is currently the only scene that needs it.** Padding
  at the end of scrollable content only protects the last few lines; the
  scrollable viewport's own box has to stop short of the reserved band
  instead (`height: calc(100% - var(--footer-safe-zone))`), so real
  paragraph text can never render underneath fixed chrome at *any* scroll
  position, not just the start/end — see `scroll.css`'s `.scroll-viewport`
  rule and its inline comment for the full diagnosis. Two real collisions
  found and fixed here in the same pass, not one: first, `#site-title`'s
  footer pill was rendering directly over Scroll's own body text
  mid-paragraph (fixed by introducing this var at `4.5rem`); second, once
  Scroll gained its own bottom-center `.scroll-title` in this same pass,
  *that* title — also `position:fixed` chrome in the same band, sitting
  above the footer — started colliding with scrolling body text the exact
  same way, since `4.5rem` only cleared the footer, not the title now
  floating above it. Caught live by scrolling through multiple depths, not
  just checking the top of the scene. Raised to `7.5rem` to clear both.
  General lesson for any future scene with genuinely full-width scrolling
  body content (unlike every other scene's narrow side panel, which
  structurally never reaches the horizontally-centered footer): the
  reserved band has to clear *every* piece of fixed chrome stacked in it,
  not just the outermost one — check what's actually anchored in that
  space before picking a value, and verify by scrolling through the whole
  range live.
- **A site-wide webfont swap does not automatically extend to
  Canvas-drawn text (`ctx.font = '...'`) — it needs an explicit
  font-load guard, not a plain find-and-replace.** Real scope boundary
  hit in the 3.9.7 Arapey swap, then closed in 3.9.8: the shared
  editorial serif (`'Times New Roman', serif`, CSS-declared, DOM text)
  converted cleanly everywhere it appeared in 3.9.7, because DOM text
  automatically reflows once a `@font-face` finishes loading — no race
  to worry about there. `beamline.js`'s station-placard body text and
  `butterfly.js`'s axis-label sprites are drawn onto an offscreen
  `<canvas>` and baked into a static `THREE.CanvasTexture`/bitmap;
  if that draw call runs before a webfont has finished loading, the
  canvas silently falls back to the next generic in the stack and —
  unlike DOM text — never gets a chance to redraw once the real font
  arrives on its own. 3.9.7 left both on `"Times New Roman", serif`
  rather than risk that; 3.9.8 added a real guard to each and switched
  them to Arapey:
  - `beamline.js`: `labelFontsReady` (a `document.fonts.load(...)`
    promise) is kicked off once at scene setup — as early as possible,
    maximizing the time it has to resolve before a user's first click —
    and `showLabel()` (now `async`) awaits it before generating each
    station's texture. Every click regenerates the texture anyway (a
    pre-existing pattern, not new), so this only matters for whichever
    station happens to be the very first one clicked.
  - `butterfly.js`: draws its ~30 unique symbol textures once,
    synchronously, at scene mount — so a stale bake here would be
    permanent for the scene's whole lifetime, not just one label.
    Each texture keeps its own `redraw()` closure over its canvas/ctx;
    the scene renders immediately with whatever's available (same
    synchronous-mount contract every other scene follows), and a
    `document.fonts.load(...).then(...)` fires each texture's
    `redraw()` + `needsUpdate = true` once Arapey actually resolves —
    updates every sprite sharing that texture object at once, no need
    to walk and reassign 220 sprite materials individually. A
    `symbolsDisposed` flag (set in `dispose()`) guards the callback
    from touching an already-disposed texture if the scene unmounts
    before the font finishes loading.
  Verified the guard actually does something, not just that it compiles
  clean: `canvas.measureText()` with `'22px "Arapey", serif'` measures
  narrower than the same string in a knowingly-bogus font name (which
  the browser measures identically to the plain generic fallback) —
  confirms Arapey is the font actually in use, not silently falling
  back, more reliable than eyeballing tiny italic canvas glyphs in a
  screenshot.
  `library.js`'s `BOOK_TREATMENTS`/`DISC_TREATMENTS`/`CD_TREATMENTS`
  remain a separate, unrelated case, untouched by either pass: those
  intentionally cycle through *several* different system serif/sans
  fonts (Georgia, Times New Roman, Palatino, Verdana, ...) as a variety
  mechanism so shelf spines don't look uniform — see that file's own
  comment at `BOOK_TREATMENTS` — not an instance of "the site's shared
  serif" at all. `layoutSmallCaps`'s Orbitron usage in `beamline.js`
  (the "STATION N OF M" line, same texture) also has no font-load
  guard — a pre-existing gap, out of scope for this pass, flagged rather
  than silently left for a future reader to rediscover.

## Annotated math — where to start tuning

Comments-only pass (2026-08-06): the real math in each scene now has
line/block-level comments in the source explaining what it implements, why
each term is shaped the way it is, and which constants are safe to play with
vs. structural. No logic changed — this section is just a map of where to
look first.

(File paths below updated 2.1.0 to the current per-scene-folder locations —
see "Per-scene folder structure" under Standing notes. The math and constants
described are unchanged.)

- **`src/scenes/orbiter/orbiter.js`** — a p-orbital electron wavefunction (rejection
  sampling of `r²·e^(-r/a0)·cos²θ`) plus a small tetrahedral "quark shimmer"
  nucleus. Start with `A0` (lobe size), `R_MAX`/`F_MAX` (sampling envelope —
  raise `F_MAX` if the render looks sparse), and the nucleus's isotropic
  radial-sampling constants. Also documents a real, verified bias in
  `buildSatellites()`'s random-unit-vector construction (biased toward cube
  corners, not fixed by the 1.3.0 note's octant check) — left as a comment
  per scope, not corrected.
- **`src/scenes/beamline/beamline.js`** — three independent systems worth knowing
  apart: a real Conway's Game of Life (B3/S23) driving the `caPoints` growth
  lattice (`CA_COLS`/`CA_ROWS`/`CA_STEP_INTERVAL`/`CA_SEED_DENSITY` are the
  tunables; the birth/survival thresholds 2/3/3 are structural — they define
  the rule), a Lévy-flight (Pareto power-law) step distribution for vessel
  movement (`LEVY_MU`/`LEVY_L_MIN`/`LEVY_L_MAX`/`LEVY_FORWARD_BIAS`), and an
  elliptical radial edge-falloff applied twice — once to the terrain height
  field, once (more recently) to the point lattice's density/jitter/
  brightness (`EDGE_FALLOFF_START`/`CA_EDGE_START` are the tunable band
  widths; the plane-half and center constants are structural anchors).
  fBm/ridged-multifractal terrain noise is also annotated (`persistence`/
  `lacunarity`/octave count).
- **`src/scenes/butterfly/butterfly.js`** — the actual Lorenz attractor (not a
  stylized approximation): `SIGMA`/`RHO`/`BETA` are the classic chaotic
  parameters (structural — `RHO` below ~24.74 collapses the chaos into a
  fixed point), `DT` is the Euler-integration step size (tunable for
  smoothness vs. speed). `TRAJECTORIES`' near-identical starting points are
  there specifically to show sensitive dependence on initial conditions.
- **`src/scenes/orrery/orrery.js`** — real solar-system data (`au`, `relDiameter`
  in `PLANET_DATA`) compressed with `Math.sqrt` to fit a ~100x real ratio
  into a small room while preserving order — genuine data, deliberately
  non-linear display scaling. The orbital `speed` in `orbits.push()` is
  explicitly NOT Kepler's third law (that would freeze the outer planets
  for any human viewing session) — it's a linear-by-index legibility
  simplification, documented as such. `innerR`/`outerR`/`minSize`/`maxSize`
  are the tunable screen-space bands.
- **`src/scenes/sphere/sphere.js`** — genuine geodesic sphere subdivision, though
  the subdivision algorithm itself is `THREE.IcosahedronGeometry`'s built-
  in (not custom code); `detail` is the tunable face-count/smoothness knob.
  Also documents the label system's real vector math: a normal·view-
  direction dot product for backface visibility/fade, and an `atan2`-based
  screen-space angle recovery for keeping label text upright as the sphere
  rotates.
- ~~`src/scenes/leaf.js`~~ — Leaf (and its `buildFoliageClump()` per-vertex
  outward-jitter technique) was retired and deleted 2026-08-07 rather than
  picked back up; its one piece of writing lives on in the scroll now (see
  2.1.0 below). Removed from this map since the file no longer exists.

## Watching (no action needed yet)

- **Scene file size.** orrery.js (~2,320 lines) and library.js (~1,800) are now
  the two largest scene files by a wide margin. theater.js came off this list
  in 1.7.0 — moving its script content to src/text/theaterScript.js took it
  from ~1,580 lines to ~710, which is the same split this note suggested and a
  fair illustration of how cheap it is when the extracted part is self-contained.
  Not a current problem — each is genuinely self-contained scene-specific
  complexity (procedural textures, a first-person rig, generative content
  variety), not copy-paste bloat; sceneKit.js already owns the cross-scene
  duplication that would otherwise cause this. Flagging so it doesn't sneak up
  unnoticed if any of the three needs another big feature pass. If it ever is
  worth trimming, orrery.js's texture generators and first-person rig are the
  two most self-contained chunks to split out first.

## 5.0.1 (2026-09-05)

**A gate that models the thing instead of calling it, and a candle that was a
dimmer.** Both came out of Scott reading the 5.0 punch list rather than the
site — the first from a finding he named as one of its nastiest, the second
from looking at the scene the release had supposedly fixed.

### The checker could not see the class of failure it existed to catch

The 5.0 finding: `wireCrossLinks` escaped a link's phrase and then matched it
against decoded text, so any phrase containing `&`, `<` or `>` silently failed
to link — and `verify-links` compared the raw pair, so it passed. Scott's read
of it: *"a checker that can't see the class of failure it exists to catch."*

Checking it turned up the same shape one level down, which is the actual entry
here. The bug is dead — there is no escaping left, the matcher walked text
nodes and compared raw phrase to decoded data. But:

- **Zero of the 65 phrases contain any of those characters.** The corpus never
  exercised the fix. Nothing would have failed if the escaping came back.
- **`verify-links` still did not call `wireCrossLinks`.** It re-implemented a
  *model* of it, in `indexOf` and `countOccurrences` over raw text.
- **The model had drifted.** Its comment described `wireCrossLinks` as doing
  "a plain first-occurrence String.replace over HTML", which had not been true
  since the rewrite, and one of the two failure modes it carefully guarded
  against had become structurally impossible in the meantime. Nothing failed,
  because nothing compared the description to the code.

Scott named the category: *"those were comments describing code, and this is
code describing code, which reads as verification."* It is worse than a stale
comment for exactly that reason, and worse again because the drift is invisible
by construction — there is no observer.

**The fix is `derive, don't type` pointed at a checker: it should not describe
an algorithm, it should run it.** `src/utils/crossLinkMatch.js` now holds the
matching, DOM-free so a node build step can execute the real thing;
`wireCrossLinks` is a thin wrapper over it. Two options were on the table and
the extraction beat a DOM shim without much argument — a shim adds a dependency
and *preserves* the possibility of divergence, where the extraction removes it.

Three properties worth recording:

- **Proven equivalent, not asserted.** The old TreeWalker implementation and
  the new one were run side by side in a real browser over all 43 render groups
  and 65 links. Byte-identical output, every group. That comparison is what
  licensed the swap; it is not in the build (it needs both implementations) and
  it is not meant to be.
- **The output is the input plus two tags.** Matched text is emitted as the
  *original raw slice*, never a re-encoding of the phrase, so nothing outside
  the inserted `<a>`/`</a>` changes by a byte. The rule the original bug was
  about, stated as a design: decode before matching, and never re-encode what
  you did not decode.
- **The narrow scopes are enforced rather than assumed.** The matcher decodes a
  short list of entity forms and tokenizes for this corpus's markup (`p`, `em`,
  `i`, `br`). Both are safe while enforced and are the next finding the moment
  they are merely assumed, so `verify-links` fails the build on an entity or a
  tag outside those sets.

**And the gate can now fail.** A fixture exercises phrases containing `&` and
`< >` through the shipping matcher. Put the escaping back and five assertions
fire; break the entity table and three do. A fixture rather than corpus content
because the alternative is authoring an ampersand into a piece of Scott's
writing to satisfy a checker. Same family as the CSP audit that never opened a
page outside the SPA: a passing gate that cannot fail is indistinguishable from
no gate.

`verify-links` is now seven checks. The one that matters most is the plainest:
run the real matcher over the real text and fail if any row finds nowhere to
land — including for reasons nobody has thought of yet, which is the entire
point of running code instead of describing it.

*(The counts gate then caught a number in a comment written for this entry —
"all 65 rows", which collides with the phrasing `verify-counts` uses for
resonance rows. It wanted "65 link rows". Working as intended.)*

### The candle was a dimmer

Scott, on the 5.0 rebuild: *"the candle is just reading as a strobe. I think
part of the problem is that I feel like we should be seeing the light on the
walls, with some shadows, and the light itself would shift. Imagine the candle
being on the desk of the person reading this scroll."*

Right, and the diagnosis is exact. 5.0 replaced a periodic keyframe list with a
noise process, which fixed the repetition and left the real problem untouched:
it modelled the flame's **luminance** and applied it as a uniform multiplier to
one static layer. Two things follow, and both of them are the strobe.

**Uniform is the wrong axis.** What you see in a room lit by a candle is not
the room getting brighter and darker together — it is the light *moving*. The
flame leans, the highlight slides, the shadows swing. Brightness is the
secondary channel and it was the only one being driven. Position is now the
primary output: `at(t)` returns a lean as well as a brightness, the two are
**coupled** (a flame pushed sideways is stretched, and a stretched flame is
dimmer) rather than being two independent noises laid over each other, which is
one of the reliable tells of an animation. Measured, the inversion is undone —
0.43 units of lean travel per second against 0.17 of brightness.

**One layer carried the light and the room together**, so dimming it lifted the
shadows. A frame where the highlights fall and the dark corners rise at the
same instant is a flash. `.scroll-root::before` is now the candle's light and
moves; `::after` is the room's own darkness and its weave, and does neither.

The rest follows the light: each patch's warm wash slides with the same lean
(one candle, one direction, rather than twelve sheets brightening in place),
and the shading under each curled edge swings side to side with it — the two
side gradients answer to `--flame-x` in opposite directions, measured at 0.16
to 0.28 alpha against 0.055 to 0.17, a constant sum.

**The first amounts were arithmetically defensible and invisible.** At
1.5%/1.1% of the overscanned box, two frames 1.2s apart differed by a mean of
0.74 of 255 — well under what anyone notices in a scene this dark. A gradient
with no edges in it has to move a long way before the movement reads, which is
a fact about smooth gradients rather than about candles. At 4.5%/3% it is about
80px on a laptop. There is also a deliberately small high-frequency band in the
sway now, around 3px: a candle's fast motion is at the tip, so what it does to
a pool of light on a desk is shimmer its edge, not translate the pool, and a
large amplitude there reads as the page vibrating.

Everything still rides one `requestAnimationFrame` writing three custom
properties on one element; median frame 25ms in a headless 960x600 capture with
the whole scene painting.

## 5.0 (2026-09-05)

**The audit, and four things Scott saw that it didn't.** 5.0 is two halves. The
first is `PUNCH-LIST-5.0.md` — ninety-four findings from eight parallel audits of
the whole tree, worked through in four tiers and landed across nine commits
(`4d63748` through `de7827b`). That file is the record; it is not repeated here.
The second half is this entry: four things Scott noticed by looking at the site,
after an audit that had read every line of it.

**They are worth keeping together, because they have a shape.** Every one of them
is a thing that is *there*, that renders, that no check could fail — a flicker
that flickers, a title that is a title, letters that are letters, a warehouse
that is a warehouse. The audit's whole method was reading assertions and testing
them, and none of these four is an assertion. This is the class of defect that
survives an audit by not being a claim.

### The candle was a loop

Scott: *"the candlelight in scroll seems more pulsey than candle flicker"*, and
then, when the first repair was not enough: *"make sure the scroll's flicker
actually has the random movement of an actual candle or flame, it looks too clean
and synthetic right now."*

The first repair was the wrong kind. The old keyframe was six evenly spaced stops
eased across 4.2s dipping to 0.60 — a 0.24Hz breathe. Replacing it with fifteen
irregular stops across 1.7s plus a 4.1s brightness wander at a coprime period
measured much better (7.4 direction changes per second against 1.4) and still
looked synthetic, for a reason no measurement of *rate* can catch: 1.7s is inside
the window the eye reads as rhythm, and the whole flicker gesture was replaying
identically inside it. The coprime second animation moves the envelope, not the
gesture. **Any keyframe list is periodic. That is what a keyframe list is.**

So the candle is a signal now — `src/scenes/scroll/scroll.flame.js`, sampled at
absolute elapsed time, with no period at all. What it models:

- **The buoyancy flicker.** A candle-scale diffusion flame oscillates because hot
  gas off the wick outruns the cold air feeding it; the frequency scales as
  roughly 1/sqrt(wick width) and lands near 10-12Hz. Hence the deliberately
  larger amplitude on the 11.3Hz octave. It is a noisy oscillator and not a tone,
  which is what an octave of value noise gives and a sine does not.
- **The room** — draught and convection, the lower octaves, amplitudes falling
  off roughly as 1/f.
- **Guttering** — its own slow channel, thresholded near the top so only a few
  percent of it does anything, because a gutter that arrives on a schedule is
  just another wobble. The flame flickers harder while it is down.

Bounded above and not below, which is the asymmetry that makes it read as fire
rather than as tremble: fuel rate caps how bright it can burn, nothing caps how
far a draught pushes it down. Measured over ten minutes: mean 0.947, median
0.963, 1% of frames below 0.789, deepest gutter 0.609, ~12 direction changes per
second, and the closest recurrence of any 3-second window is 0.0275 mean absolute
difference away — a repeat would be zero.

**It also got cheaper.** One `requestAnimationFrame` writing one custom property
replaced thirteen infinite CSS animations. Every consumer — the root glow, the
twelve patch glows, the intense passages' text shadow — is `var(--flame)` in
`scroll.css` and follows for free. The `IntersectionObserver` that existed to
pause off-screen patch animations is gone with the animations it was pausing, and
so is `--glow-delay`: twelve patches were flickering out of phase with each other
to look "not in unison", which is twelve light sources in a room lit by one
candle. They duck together now, by different amounts (`--flame-gain` per patch),
which is what actually differs between two surfaces catching the same flame.
Under `prefers-reduced-motion` the loop never starts and every `var(--flame, 1)`
falls back to a steady flame, so that block needs no resets at all.

### The title band had a top, and nothing knew it

Scott: *"check the title on apollo."* The word APOLLO was rendering across the
bottom edge of the fader console.

`--title-block-bottom` says where the title block *starts*. It says nothing about
the ~28px of title sitting on top of it — so Apollo's rail, anchored at 5.5rem,
cleared `#site-title`'s footer pill perfectly and ran straight through the title
text above it. The hazard was already reasoned through in `main.css` for Scroll,
where the fix at the time was a hand-picked 7.5rem that had to be revisited by
hand when Scroll's title came and went.

`--title-block-clear` / `-mobile` is that value with a name, and the rail anchors
to it. Two related corrections came out of measuring rather than assuming:

- A sweep of all thirteen scenes at two viewports found Apollo was the **only**
  real collision. Harmonics and Outside looked like collisions against the title
  *row*, which is full-width; against the title *text*, which is centred, they are
  clear. The corner-anchored sound toggles sit beside the title, not under it.
- The short-screen rule dropped the rail to 7.5rem to reclaim height, which on a
  320x568 phone left **one pixel** between the panel and the title. That override
  is gone; the panel gets its height back from the four declarations that are
  actually about height. 9px of clearance there now.

`scripts/verify-css-invariants.mjs` gained a fourth check for it: anything both
bottom-anchored **and horizontally centred** must anchor to the variable. Centred
is the whole qualifier and it is what keeps the check from crying wolf — only
chrome sharing the title's horizontal middle can collide with it. Two false
positives on the first run taught it two real things: a pseudo-element's `bottom`
is measured against its originating element, not the viewport (Theater's
`.tab-seat.occupied::after` is a dot under a seat), and an unregistered scene
renders no title to collide with (Spectra is shelved).

### The letters were evenly spaced in the wrong variable

Scott: *"the spacing on the letters is a little odd, so just balance everything
out."*

`ARC` stepped through equal **angle**. On a circle that is equal spacing; these
arcs are flattened, ry/radius about 0.28, and on a flattened ellipse an equal
step of angle covers a distance of `dt * sqrt(r^2 cos^2 t + ry^2 sin^2 t)` —
largest in the middle, smallest at the ends. So the letters bunched towards A and
M and spread out around G: a 1.47x variation inside the first arc, 1.40x inside
the second, and the two arcs 0.0633 against 0.0538 as each other. The digit and
punctuation rows are straight lines stepped evenly and were exactly even the whole
time, which is precisely why the letters were the rows that looked wrong.

`ARC` now takes a **gap**, solves for the spread that makes the arc that many gaps
long, and walks the curve placing each letter at equal arc length. `MARK_GAP` is
0.069 and every mark on the board — letters, digits, punctuation — is now that far
from its neighbour. Measured: 0.0685 to 0.0690 across the whole board, a ratio of
1.008 against 1.47.

**It bought back most of a cost the widening pass had recorded and misattributed.**
Spreading the arcs was known to cost about two and a half points of vowel share.
Most of that was not the width; it was the placement. The cup spends its time in
the middle of the arcs, and equal-angle steps had thinned the letters exactly
there — while the file, two paragraphs above, stated that the arc shape exists so
no letter is cheaper to reach than any other. Ten seeds x 300s with a hand resting
on the board:

|                    | letters/s | vowel share |
|--------------------|-----------|-------------|
| equal angle        | 0.140     | 31.1%       |
| equal arc length   | 0.139     | 34.6%       |
| English            | —         | 38.1%       |

With plausibility switched off: 24.2% and 24.6%, unchanged. That control is what
says this is the lexicon getting a fairer board rather than the board being
tilted. `medium-feel.mjs`'s two must-pass questions still hold — the sentence is
not stored anywhere, and the visitor always wins outright.

One guard added while sweeping radii for a possible inset on the second arc: the
bisection that solves for spread runs on [0, pi], and asking for a gap that
cannot fit at a given radius returned pi with a straight face. It throws now. The
inset was not taken — matching arc lengths with a smaller radius means more
curvature, and N and Z sag visibly for a 1.5% gain.

### There was no way in

Scott: *"just realized: there's no door in the orrery :D how do people get in and
out?? :D"*

Four brick walls, a ceiling with a skylight, a concrete floor, and a thirty-foot
machine inside. The visitor spawns 1.2 units inside the front wall facing the
mast, so the first thing they see if they turn round was, until now, brick.

A **roll-up bay door** is the honest answer, and it answers the bigger question
rather than the smaller one: a machine assembled by a crew with a hoist and a
warehouse ceiling arrived in pieces on a truck, and a truck needs a bay. Slats
drawn at the panel's own aspect and not tiled (same reasoning as
`makeBrickTexture`), rust crowded up from the sill where a door actually rots,
two dents, a half-worn stencilled bay number, track rails, a roll housing, and a
strip of paler concrete at the threshold where the apron was cut out and
repoured. Beside it a **steel man door, standing ajar** — how a person comes and
goes once the bay is shut, and the easiest thing in the world to read across a
dark room.

**The light took two goes and the failure is the interesting part.** A PointLight
at the threshold lit the brick all around the doorway in a large orange halo:
nothing in this scene casts shadows, so light "arriving from outside" happily
illuminated the inside face of the wall it had supposedly just come through. A
`SpotLight` has a cone, and a cone aimed away from the wall cannot light it. So
it sits in the opening pointing into the room and slightly down, and the sodium
light falls on the floor and on the swung leaf and nowhere else.

Scott, seeing the first render: *"feel free to expand the warehouse if necessary,
like that might even be more atmospheric."* It was. `wallDist` 8.5 to 12.5 — 17m
square to 25m. The orrery's outermost ring reaches about 5.4, so the machine had
been taking up most of the floor and a visitor was never more than a few steps
from it. At 25m it stands alone in a room, the far corners fall past
`scene.fog`'s near distance into real darkness, and the sodium wedge reads as a
distant warm thing rather than as something you are standing in. Every piece of
clutter in the warehouse is positioned relative to `wallDist` rather than in
absolute coordinates, so the benches, boxes, ladder, flyers and light fixtures
moved out with the walls for free; the orrery is anchored to the room's centre
and its own scale constants, so it did not change size.

### Gates

Seven build gates, all passing: `verify-links`, `verify-resonances`,
`verify-scroll-marks`, `verify-landing`, `verify-aria`, `verify-css-invariants`
(now four checks), `verify-counts`. 20/20 bardjs tests. Both Medium benches. All
thirteen scenes mount with no console errors at 1280x800.

## 4.11.4 (2026-09-04)

**Medium — a Ouija board that can actually spell.** The physics only. Nothing is
drawn, nothing is registered, no scene ships: `medium.physics.js` is pure and
imported by nothing yet, and `scripts/medium-feel.mjs` measures it. Built in that
order because the brief calls the resistance the whole experience and says a
mimicked one "will feel wrong in a way nobody can name" — so it is named first,
as numbers, before a pixel argues for it.

**The second hand went through two complete designs in one sitting, and the
first one is worth recording because it was good and still wrong.**

*Version one: the partner was the visitor's own hand, delayed.* An echo. It gave
withdrawal-mirroring for free — Scott's "if the user stops clicking and pulls
back, the other hand mirrors" needs no exit logic, because that is what an echo
does when the thing it echoes leaves — and it made "the visitor cannot tell who
produced it" true rather than staged, since one of the two forces genuinely was
them at a different time. It measured well and it was elegant.

**It could not spell, by construction.** An echo has no intention, so nothing
chooses a letter. Scott: *"our method here is 'do it the hard way', so let's do
it the hard way. I don't want a mirroring, I want the board to be able to
spell."* Right call — bolting a letter queue onto an echo would have been
exactly the lie the brief warns about.

*Version two, which is what exists:* **the partner wants to say something and
leans toward the next letter.** Three rules make that honest instead of a puppet
show, and all three are measured below:

1. **It leans; it never shoves.** Its force is capped well below what a pushing
   hand produces. A visitor who wants to go elsewhere goes there, every time.
   Not a usability concession — a real board is trivially overridden, and one
   that fights back is a puppet show.
2. **So it only makes progress when the visitor is not pushing** — during the
   hesitation and aimless drift that is what people actually do at a board.
   Which is the ideomotor account exactly: the message emerges when nobody
   believes they are doing anything.
3. **A letter is taken by DWELL, not by contact.** The cup must settle near a
   letter and stay under a speed threshold before it counts, so passing over a
   letter spells nothing and the visitor's own pauses are what spell.

### What the bench says

```
spell    passive visitor: spelled "HELLO" in 12.95s — 2.59s per letter
override visitor holds at 0.860, partner pulls toward A at 0.248
         cup ends at 0.821 — visitor wins outright
driving  20s of sweeping the cup around: spelled ""   (motion alone does not spell)
cup      hand lands, breaks away 0.183s later; coasts 0.367s after the hand stops
         30 / 60 / 144Hz agree to 0.0017 board units
```

`PARTNER_FORCE` 1.9 comes from a sweep of force against both outcomes at once:
below it the board is too slow to say anything, above it the partner starts
dragging the cup out of a holding visitor's hand — 0.039 board units of drift at
1.9, 0.079 at 3.0. It is the one constant the whole scene balances on.

### Two bugs, and the second one is the good one

**Doubled letters were impossible.** A cup at rest on a letter cannot take that
letter again without leaving — otherwise a settled cup spells one character
forever — and with the partner aiming at the same letter it never left. HELLO
stalled at HEL, permanently. Fixed the way a real sitter does it: for a repeat,
move off and come back. `createSpeller` owns that retreat, and the cup really
does travel away and return rather than the second L being waved through.

**And the retreat did not work either, for a reason worth keeping.** It aimed at
`DWELL_RADIUS * 2.6` and ended at `* 2.2` — the same threshold that re-arms the
letter. The cup stopped **0.1210** board units from the letter and the threshold
**was 0.1210**, so a strict `>` never fired: a standoff exact to four decimal
places. Friction is why, and it generalises — **the cup never arrives at an aim
point, it stops short of one**, so any test placed exactly at an aim distance
will sit on its own boundary forever. The three distances are now separated and
each is labelled with what it is for.

Found by instrumenting the run rather than by reading the code, which had looked
correct twice.

**Files:** `src/scenes/medium/medium.physics.js` (new, pure, imported by nothing
yet), `scripts/medium-feel.mjs` (new, not part of the build).

## 4.11.3 (2026-09-04)

**Two tie-break bugs in the landing layout, found by measuring a thirteenth
scene before building one.** Scott's brief for *Medium* names two layout costs
and says both must be **measured rather than assumed** before the scene starts.
Doing that surfaced a regression 4.11.0 had introduced and twelve scenes had
hidden.

**How it was measured.** A scratch thirteenth scene — registry entry, nav icon,
landing tile, a stub module — built into the working copy and never committed,
so the numbers come from the real arithmetic rather than from a re-implementation
of it. Worth recording because it also exercised the build gates: the 4.8.9
`ABSENT` gate fired immediately, correctly, because Psyshell's `/text/` page
names the scenes that publish no writing in prose and a thirteenth silent scene
makes that sentence wrong. **A new non-publishing scene is a two-file change,
and the gate says so before anything ships.**

**The orphan row came back.** The scoring function 4.11.0 replaced refused a
last row of one outright — "a single tile under two full rows reads as an
afterthought rather than as the newest scene". The rewrite optimises tile size
and dropped that rule, which cost nothing at twelve because twelve divides
evenly into every column count worth choosing. At thirteen it appears
immediately: 1600×900 and 1440×900 both produced **6/6/1**, when 5/5/3 was
available at an identical 214px tile.

Restored as a tie-break rather than as a rule, which is the honest shape: tile
size decides first and nothing can overrule it, and among arrangements the
requirement has already declared equally good, prefer no orphan last row, then
fewer rows. Free by construction.

**And it did nothing at first, because of a second bug underneath it.** The
candidate's tile size was stored as `Math.floor(tile)` and the next candidate's
raw float compared against that stored integer — so 214.67 beat a stored 214 by
"more than half a pixel" and **every tie was being scored as an improvement.**
Not just the orphan rule: the "fewer rows" tie-break had never fired either. The
comparison and the stored value have to be the same quantity; the floor moves to
the caller.

That is why the first fix measured as no change at all, which is the useful
signal — a tie-break that changes nothing is either unnecessary or unreachable,
and it is worth finding out which.

**Measured after, at thirteen tiles**, every desktop width fitting above the
fold with zero overflow: 1920×1080 5/5/3 at 272px, 1920×800 7/6 at 249, 1600×900
and 1440×900 5/5/3 at 214 (was 6/6/1), 1440×820 5/5/3 at 188, 1440×700 7/6 at
180, 1280×800 and 1160×800 5/5/3 at 181, 1024×768 5/5/3 at 170. 768×1024 and the
phones fall back to scrolling, as the requirement says they should.

**And at twelve**, unchanged everywhere except 1024×768, which moves from 5/5/2
to **4/4/4** at the same 170px tile — the tie-break doing its job, since both
are orphan-free at equal size and 4/4/4 is the more regular of the two.

**The nav, which the brief flagged as the harder ceiling, has already been
resolved and this confirms it.** The brief's figures — twelve icons at 25.3 ×
44px on a 320px phone, clearing WCAG AA by 1.3px, with a thirteenth giving
23.4px and failing — describe the row as it was **before 4.9.0 made it
scrollable**. Measured now with thirteen icons: **44 × 44 at every width from
320px up**, scrolling below 768px, with the last icon reachable at each. The
ceiling the brief was written against no longer exists.

**Files:** `src/main.js`.

## 4.11.2 (2026-09-04)

**No behaviour change: an answer, written where the question gets asked.**
Scott, after 4.11.1: *do we still need that `!important` CSS? There was a
reason they didn't get purged, but does that still apply?*

`.preview-container canvas` carried **no comment at all**, in a file where
everything else is argued — which is the actual defect, and why the question had
to be asked rather than read. It also turns out to hold two unrelated things
under one selector.

**The sizing `!important`s: still needed, and checked rather than assumed.**
three.js's `setSize()` writes the size INLINE on the canvas — the live attribute
reads `display: block; width: 188px; height: 188px` — and an inline declaration
can only be beaten by `!important`. Deleting the rule at runtime and re-reading
the computed style returns `188px`, the inline value. So without it the canvas is
sized by whatever three.js last believed the container to be, rather than by the
container.

**And that is what kept 4.11.1's bug survivable**, which is the part worth
recording. While `bindGuardedResize` watched only the window, a tile that gained
its size without a window resize left three.js holding a stale, wrong-aspect
number indefinitely — and `width: 100% !important` kept the canvas BOX correct
regardless, so the symptom was a squashed picture filling its tile rather than
an oversized canvas hanging out of one. A wrong-resolution image is a much
better failure than a wrong-sized element. The box is right by construction and
only the pixels can lag, which is the property to keep.

**The way to retire them, named so it does not have to be rediscovered:**
`renderer.setSize(w, h, false)` — the third argument stops three.js writing
inline styles, after which plain CSS wins with no `!important` anywhere. Not
taken. It is a change to twelve scenes' resize paths to remove two correct
declarations, and it would hand the canvas's size entirely to CSS at exactly the
moment — mount, before layout — when the missing CSS is the whole problem.

**The `border-radius: 50%` is the vestigial one, and it is the one Scott was
remembering.** It was the third of three attempts to clip the canvas into a
circle (1.0.39); Firefox ignored all three, and `.preview-container::after`
solved it by painting an opaque ring on top instead. All three were kept as
"harmless, and each is still the technically correct fix for some other engine."
That reason is thinner now than it was — it is insurance against a hypothetical
engine rather than a fix for a real one — but it costs nothing and is the
correct property, so it stays, now labelled as insurance rather than looking
like part of the mechanism.

**Files:** `styles/main.css`, comment only.

## 4.11.1 (2026-09-04)

**The stretched preview thumbnail, found and fixed.** Scott photographed it on
an iPhone two days ago — Sphere drawn as a tall narrow ellipse, which is not a
sphere's silhouette at any camera angle. 4.9.1 recorded it as **not reproduced**
rather than guessed at. It reproduces now, and the answer to Scott's question —
*was that a consequence of the preview tile work?* — is **no**: both halves of
the mechanism predate all of it.

**The mechanism.** Every scene's constructor opens with

    const w = container.clientWidth  || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;

so a preview that mounts **before its stylesheet has applied** measures an
unstyled empty `<button>` — near-zero width, non-zero height from the user
agent's own padding — and falls back to the WINDOW's dimensions for one or both
axes. The renderer's buffer and the camera are built at the phone's aspect. CSS
arrives a moment later, the tile becomes a 171px square, and
`.preview-container canvas { width:100% !important; height:100% !important }`
squashes that portrait render into a square box.

**And nothing ever corrected it**, which is the half that made it visible rather
than a single bad frame: `bindGuardedResize` listened to `window.resize` and
`orientationchange` only, and **an element can change size without the window
changing at all.** The tile gaining its real size was not a signal anything
watched.

That also explains every way it behaved. Rotating the phone fixed it. Opening a
scene and coming back fixed it, because `returnToGallery` dispatches a synthetic
resize. And it would not reproduce on a fast local machine, where CSS is always
applied before the module graph runs — which is why it took forcing the
condition rather than waiting for it.

**Measured, on a 390×844 phone profile**, mounting Sphere into containers that
measure zero at mount:

| container at mount | buffer | render aspect | shown in a 171px square |
|---|---|---|---|
| 0 × 171 | 780 × 342 | 2.281 | **0.44 — a tall narrow ellipse** |
| 171 × 0 | 342 × 1688 | 0.203 | 4.94 — a wide flat one |
| 0 × 0 | 780 × 1688 | 0.462 | 2.16 — wide |
| 171 × 171 | 342 × 342 | 1.000 | correct |

The first row is the photograph, and it is the case an unstyled `<button>`
produces: no width, a little height. Giving the container its real size
afterwards left the buffer at 2.281. Dispatching a window resize fixed it.

**The fix is a ResizeObserver in `bindGuardedResize`**, which is one place and
covers **all twelve scenes** that use it — the element gaining its size IS the
signal, so the wrong aspect now self-corrects within a frame of layout instead
of persisting until something unrelated happens. The window listeners stay: a
`devicePixelRatio` change on a display swap moves nothing about the element's
box, and scenes re-apply pixel ratio from this same callback.

The eleven `clientWidth || window.innerWidth` fallbacks are left alone
deliberately. They are still wrong for one frame, and now they are only wrong
for one frame; changing eleven constructors to invent a square fallback would be
eleven edits to paper over a race the observer already ends.

**Verified:** the 0-width mount now goes 780×342 → 342×342 the moment the
element is sized, and holds — checked for a settle loop, since the callback
resizes a renderer whose canvas is inside the observed element (there is none;
the `!important` CSS means the canvas box never changes and the container is
never touched). Every live preview on the landing page reports a buffer aspect
of exactly 1, no console errors, and the 4.11.0 above-the-fold measurements are
unchanged across all seventeen viewport sizes.

**Files:** `src/utils/sceneKit.js`.

## 4.11.0 (2026-09-04)

**The landing page gets a requirement, and the layout becomes a consequence of
it.** Scott: *all twelve tiles visible without scrolling on desktop, at a
legible size — the layout is whatever satisfies that.*

**Why that is better than the two rows it replaces, stated because the
difference is the point.** "Two rows" was a preference, and 4.10.2 reached it by
widening a scoring loop until 6/6 won — picking an answer and then justifying
it. The requirement is measurable, so the row count stops being chosen at all.
The available band is the viewport minus the chrome that is always there; inside
it, for each candidate column count, the tile is capped by width one way and by
height the other, and the arrangement that makes the tile largest wins:

    rows      = ceil(n / cols)
    by width  = (W - (cols-1)*gap - padding) / cols
    by height = (H - (2*rows-2)*gap - padding) / rows
    tile      = min(both, 272px cap);  reject below the 168px floor

**The row count now moves with the window's SHAPE, not just its width**, which
is the visible proof that it is derived: 1440×820 gives six columns in two rows
at 214px, and 1160×800 gives four columns in three rows at 181px, because three
rows beats two once the window is narrow enough. Neither was chosen. None of it
could stay in CSS — no media query can express "twelve of these fit above the
fold" — which is why the arithmetic is in JS and the stylesheet only spends the
number it is handed.

**The floor is sourced rather than picked.** 168px, because the phone layout has
shipped 136px tiles since 4.9.1 and the previews are recognisable there, and a
desktop is viewed from further away than a phone.

**When the requirement cannot be met, the page stops claiming it can.** No
arrangement above the floor means `.rows-forced` does not go on and the grid
falls back to scrolling — the phone layout, and now also a short or narrow
desktop window. That is the honest answer rather than shrinking tiles into
decoration. **It is also the scaling threshold, and it announces itself**:
twelve fit, sixteen probably fit smaller, twenty-four will not, and the moment
they do not is a measurable event rather than a judgement call. That is when the
index has to stop being a grid, which is what `sceneField.js` is shelved for.

**The first version claimed a fit it did not have, and measuring caught it.**
The page reported all twelve above the fold while `#landing` scrolled by 80px.
Two terms missing from the vertical budget, neither obvious from reading the
code:

- the list's own vertical padding, which is not part of any tile; and
- **`.preview-row-break` is a flex item**, so it occupies its own line and takes
  a row-gap on *both* sides. Three rows of tiles is five flex lines and four
  row-gaps, not three and two.

Found by comparing the real `scrollHeight` against the layout that produced it,
rather than by trusting the arithmetic to describe its own output. Worth keeping
as the shape of the error: a formula that decides a layout cannot also be the
thing that verifies it.

**Measured after, seventeen viewport sizes.** Every case where the grid claims
the requirement now satisfies it — `allVisible` true and zero vertical overflow
at 1920×1080, 1920×800, 1600×900, 1440×900, 1440×820, 1440×700, 1440×600,
1280×800, 1280×720, 1160×800, 1024×768 and 768×1024, with tiles from 170 to
272px and arrangements of 6/6, 5/5/2, 4/4/4 and 3/3/3/3 chosen by the
arithmetic. The four that fall back — 900×700, 601×800, 390×844, 320×720 —
genuinely cannot hold twelve legible tiles above the fold, and scroll.

**One behaviour change worth knowing**: the 601–900px desktop band now scrolls
where it used to show 3/3/3/3, because at those sizes it cannot meet the
requirement. That is the requirement working, not a regression, but it is a
visible difference on a small laptop window.

**`SITE.md` states the requirement** as the thing every future layout decision
has to satisfy, which is where Scott asked for it and where a future session
will look first.

**Files:** `src/main.js` (the derivation replaces `tileColumns()` and the
width-only media-query threshold; re-derived on resize, since the answer now
depends on height), `styles/main.css` (the forced-row rules spend `--tile`
instead of recomputing a percentage), `SITE.md`.

## 4.10.4 (2026-09-04)

**A semantic HTML sweep, at Scott's request — "I'm always on the lookout for
too many unnecessary DIVs."** Audited `index.html`, all eleven scene modules,
the colophon, and `prerender.js` (which generates the ten crawlable `/text/`
pages), reading each generated element against what it actually contains and
does rather than against its class name.

**The headline is that the div count was already lean and the real defects were
elsewhere.** `index.html` has seven divs and every one has an id and a written
reason. The 2026-07-22 pass — which converted `role="list"`/`"listitem"`/
`"button"` divs into real `ul`/`li`/`button` — held: **no `role=` attribute is
set anywhere in the eleven scene JS files.** So most of this pass is not about
divs.

### The three real defects

- **Sphere published 320 sentence fragments to screen readers.** The CSS2D
  label layer holds one text node per face, each a *random 60-character window
  cut mid-word* out of a fragment — texture, not reading. The WebGL canvas
  beside it was hidden from the start; the label layer never was, only because
  three.js creates it rather than `sphere.js`. A screen reader walked 320
  truncated fragments before reaching anything the scene offers. One attribute.
- **The skip link on all ten `/text/` pages went nowhere.** `<main>` is not
  focusable on its own, so `Skip to the text` moved the scroll position and left
  focus on the link — the next Tab went straight back into the header the reader
  had just asked to skip. `index.html` fixed exactly this in 2026-07-22 and **the
  fix was never carried across to the generated pages**, which are the ones a
  reader actually arrives at from a search result.
- **Theater put an `<h1>` inside a `<button>`.** Three problems in one line: a
  `button`'s content model is *phrasing* content and `h1`/`pre`/`p` are all
  flow, so the end card was three violations; `#experience-heading` is already
  the page's `h1` while a scene is open, so this was a second one competing with
  it; and the button carries an `aria-label`, which overrides the whole subtree,
  so the heading was never announced at all. It contributed a phantom outline
  entry and nothing else. All three children are spans now, with the stylesheet
  supplying the `white-space` and monospace family the user-agent used to give
  `<pre>` for free. Verified by building the card live and looking at it: byte
  for byte the same picture, and zero flow descendants inside the button.

### Divs that had a native element

- **`scroll.js`: `div` + `role="region"` → `<section>`.** `NOTES.md` states the
  rule outright — a `section` with its own `aria-label` already implies the
  landmark — and Theater has complied since that pass. This was the holdout, and
  it is exactly the shape Scott's question is about: a div wearing the role of an
  element that exists.
- **`colophon.js`: `<br><br>` faking list separation.** Each scene's sources
  were one `<dd>` with entries joined by double breaks, so Orbiter's two distinct
  bibliographic sources published as one run-on definition whose separation
  existed only as whitespace. One `<dd>` per entry now (a `<dt>` is allowed any
  number), with the blank line moved to `dd + dd` in CSS, where a gap between two
  things belongs.

### The crawlable pages, where semantics matter most

- **261 work titles → `<cite>`** on the Library page (books, films, decks,
  albums). The highest-density change on the site; `.t`'s weight-600 stays and
  picks up a `font-style: normal` to reset `cite`'s user-agent italic.
- **Apollo's four sources → a real `<ul>`.** A bibliography is the canonical
  list of peers and was four sibling paragraphs, with nothing saying how many
  there were or where one ended.
- **Beamline's two epigraphs and Psyshell's two manuscript passages →
  `<blockquote>`.** These are quoted from outside the document, which is the one
  case blockquote exists for. Note what did NOT change: `.note` also carries
  editorial caveats in the site's own voice, and those stay `<p class="note">` —
  the class was doing two jobs and now the markup says which is which, while the
  look stays identical.
- **`og:type` is derived rather than constant.** Every page emitted
  `article`, including the `/text/` index, whose own JSON-LD a few lines down
  correctly calls a `CollectionPage` — two machine-readable claims about one
  document, disagreeing. `website` for the index now.
- **Orrery's `<article>` got a label.** It is the one page whose piece carries
  no heading — a single untitled found text — so it appeared in an assistive
  tech's region list as an anonymous "article". `aria-labelledby` now points at
  the masthead `h1`.

### Deliberately not done, with reasons

Several audit findings would have traded one accessibility problem for another,
and are recorded so they are not re-proposed:

- **Psyshell's ordinal and Theater's progress counter → `<output>`.** `output`
  carries an implicit `role="status"` — a polite live region — and both scenes
  already run one (`.psyshell-sr-live`, `.tab-sr-live`) announcing the same
  information. The change buys correct semantics and costs a double
  announcement on every read.
- **Harmonics' quote attribution → `figure`/`figcaption`.** Correct per spec
  (attribution belongs outside the `blockquote`), but `figure`'s user-agent
  margin lands inside a tuned flex column. Worth doing in a pass that can
  re-verify that panel; not worth doing blind.
- **Library's video and caption → `figure`/`figcaption`.** Breaks two `:empty`
  selectors that hide the pair when a row has no video. The fix is real work,
  the gain is modest, and the audit itself ranked it last.
- **`<section>` per titled region on the Apollo and Psyshell pages.** The
  biggest remaining structural improvement — every `h2` there already carries an
  `id` because it is a deep-link target — but it is a restructure of the
  crawlable documents rather than an element swap, and it deserves its own pass
  and its own verification.
- **`#experience-container`'s `role="main"` → a real `<main hidden>`.** The one
  live case of a role doing a native element's job. The spec permits multiple
  `main` when all but one are `hidden`, but `#landing` is hidden with
  `display:none` from JS rather than the `hidden` attribute, so this needs the
  show/hide path changed too — in the most-exercised code on the site. Flagged,
  not attempted.

**Verified after:** every one of the ten generated pages has exactly one `h1`,
no heading-level skips, a focusable `main`, and balanced tags across sixteen
element types; the live scenes show `SECTION` with no role and twelve patches
for Scroll, an `aria-hidden` label layer for Sphere, zero `h1`s inside Theater,
and six `dt` / seven `dd` / zero `br` in the colophon, with no console errors.

**Two build gates fired during this and both were right.** The CSP style-hash
gate caught the stylesheet change three times, which is the gate doing exactly
its job — `PAGE_STYLE_SHA256` and `.htaccess`'s `style-src` are updated in
lockstep. And a tag-balance check found my own prose: explanatory comments I had
written into the emitted `<style>` and markup quoted tag names in angle
brackets, which is harmless to a parser but makes every "count the tags" audit
of the shipped page lie. Build-time reasoning now stays in the source; **zero
HTML comments ship on the ten pages.**

**Files:** `src/scenes/sphere/sphere.js`, `src/scenes/theater/theater.js` +
`.css`, `src/scenes/scroll/scroll.js`, `src/components/colophon/colophon.js` +
`.css`, `scripts/prerender.js`, `public/.htaccess`.

## 4.10.3 (2026-09-04)

**Apollo's light-source switch is named for the spectra, not the geometry.**
"Behind the gas" and "The gas itself" become **"Absorption"** and
**"Emission"** — Scott's call.

The right one, and worth saying why rather than just recording it: these are
the terms of art for exactly these two situations. Kirchhoff's laws — a
continuous source seen *through* a cooler gas gives dark lines in a lit band,
and the gas itself, excited and seen against the dark, gives bright lines in a
dark band. The scene's own values have always been `absorption` and `emission`:
in `setMode`, in the deep link's token, in every NOTES entry. This is the
visible text catching up with what the code has called them since 4.4.0.

**Nothing about state changed.** The radio values, the deep-link token
(`#apollo/h50,emission`), the mode guard and the fader behaviour are all
untouched — round-tripped after the change and the switch still comes up on
Emission from a link, which is the bug 4.5.0 fixed and the thing most likely to
break under a rename.

**The plain-language version did not disappear**, which is what makes the rename
safe rather than a loss. It moved to where a description belongs: the hint line
("move a fader to add an element to the gas") and the screen-reader
announcement ("The gas is the light now. The band is dark and the lines stand
bright in it"). A visitor who does not know the words gets an instrument that
shows what they mean, with the plain reading one line away.

**One string a rename forgets: the invisible legend.** The fieldset's legend is
`.sr-only` and read "The light source," which was right over two labels naming
light sources and is wrong over two naming spectra — "The light source:
absorption" is a category error, and one only a screen-reader user would ever
have heard. Now "Spectrum".

**Measured after:** labels fit on one rail row at 320, 390 and 1440 with no
horizontal overflow (they are shorter than what they replaced, so this only
ever loosened), radio state follows a click, the announcement still fires, and
the deep-link round trip lands on Emission.

**Files:** `src/scenes/apollo/apollo.js` (the two labels, the legend, and the
mode-switch comment, which had explained the naming that just changed),
`src/scenes/apollo/apollo.css` (the same explanation, quoted in its header).
Historical entries in this file keep the old names — they are a record of what
shipped when, not a description of the current scene.

## 4.10.2 (2026-09-04)

**Two rows.** Twelve tiles as 6/6 instead of 4/4/4, which is what Scott asked
for and what 4.10.1 failed to deliver — that release reverted the field, which
was implied, and stopped there, which was the actual instruction missed.

**It is one number in a loop bound, not a new rule.** `tileColumns()` already
preferred the fullest last row, and 6/6 wins that comparison outright against
4/4/4 (last row 6, score 54, against last row 4, score 36). Six was simply
unreachable because the search stopped at five. Extending it to six also moves
eleven from 4/4/3 to 6/5, which follows from the rule that was already there
rather than from a second decision.

**The cost is the tile, and it is the price of two rows.** Six across at 1440px
is a 215px tile where four across was 272. The trigger for revisiting is the one
Scott named — when the tiles get too small to read — and what happens then is
`sceneField.js`, shelved one release ago for exactly that moment.

**Two things had to change for the rows to actually appear, and both were found
by measuring rather than by reading.**

- *The threshold was computed from the biggest tile, not the smallest.* The
  width at which the deliberate rows switch on was `cols × 272px`, which is a
  reasonable 1,192px at four columns and an absurd 1,784px at six — so two rows
  would have appeared only on a very wide desktop while every laptop silently
  wrapped to 5/5/2. What the threshold has to guarantee is a FLOOR on the tile,
  not a specific tile: `cols × 168px`, which is 1,160px.
- *Two percentages had nothing definite to resolve against.* The forced-row
  column width started on `.preview-container`, whose parent `.preview-wrapper`
  shrink-wraps to its content, so `width: 100%` there was circular — six columns
  came out as **17px tiles, one per row, at 1440px**. Moving the column width up
  to `.preview-wrapper` (where a percentage resolves against `#scene-previews`)
  fixed the shape but not the size: the list itself is a flex item of a centring
  `#landing` and was therefore *also* shrink-to-fit, so at 1920px it sized
  itself to 1,012px instead of 1,888 and the tiles froze at 143px at every width
  from 1160 up. Neither of those errors, so both need `width: 100%` above them
  to be true. The list has it now.

This is the same class of bug as 4.9.1's `43vw` being four pixels too wide at
320px, and it is worth naming as a class: **a percentage is only as good as the
definite width above it, and a shrink-to-fit ancestor is not one.** Both were
caught by measuring tiles-per-row across a range of widths rather than by
looking at one screenshot — at 1440 alone the 143px version looked deliberate.

**Measured after** (twelve tiles, tile width in px, rows):

```
1920  272  [6,6]      1160  168  [6,6]      768  224  [3,3,3,3]
1600  241  [6,6]      1152  224  [4,4,4]    600  200  [2,2,2,2,2,2]
1440  215  [6,6]      1024  224  [4,4,4]    390  171  [2,2,2,2,2,2]
1280  188  [6,6]       900  224  [3,3,3,3]  320  136  [2,2,2,2,2,2]
```

Every width square, inside the viewport, no horizontal scroll. The 168px floor
lands exactly at the 1,160px threshold, which is the arithmetic agreeing with
itself. **One honest discontinuity:** crossing 1,160px going wider takes the
tile from 224 down to 168, because the row count changes at the same moment.
It is a narrow band and the same shape the old threshold always had, but it is a
place where a wider window gives smaller tiles, and that is worth knowing before
somebody reports it as a bug.

**Below 1,160px nothing changed**: 4/4/4 at 224px down to 1,024, 3/3/3/3 to 768,
and the phone's two columns from 4.9.1 are untouched.

**Files:** `src/main.js` (`tileColumns`'s loop bound, the threshold's
`MIN_TILE`), `styles/main.css` (`#scene-previews` width, `.preview-wrapper`'s
forced-row column, `.preview-container`'s forced-row fill and cap).

## 4.10.1 (2026-09-04)

**The field is reverted. The landing page is a grid again.** Not because it
failed — it shipped, it worked, and every check in 4.10.0's entry passed — but
because **the problem it solves is not here yet.** Twelve tiles in two rows is
fine. Twenty would be a problem, and there are not twenty; the last two days
established that the ceiling on scene count is the quality bar, not the layout.
Solve it when it hurts, which is also cheaper, because by then the actual
constraint is known.

**The revert cost almost nothing, and that is a fact about how 4.10.0 was
built.** The field was a layout applied over the existing list — absolute
positioning and a transform on the same `<ul>` of twelve `<li><button>` that has
always been there. So reverting is removing a transform rather than rebuilding a
page: one block out of `main.js`, two rule groups out of `main.css`, one import
and one gate out of `prerender.js`. `index.html` was never touched in either
direction.

**Shelved, not deleted.** `src/utils/sceneField.js` keeps the twelve measured
pairs, the log transform, the anchored relaxation and the whole argument for the
axes — with a header saying it is out of the build and why, the same status
`src/scenes/spectra/` has. Nothing imports it, so Vite never sees it; confirmed
absent from every bundle. Re-measuring costs about 54 minutes of harness time,
so the numbers are kept rather than re-derived.

**The condition for unshelving is a thing you can look at**, not a judgement
call: *when the tiles get too small to read.*

**The build gate came out with the feature.** A gate enforcing "every registered
scene has a measured position" for a layout nothing renders is dead weight that
looks load-bearing, which is precisely the failure mode `CORRECTED-FACTS.md`
exists to catch. It goes back in with the import.

**What the detour produced, and where it lives now** — the reason none of this
was wasted:

- **The word-count correlation.** Scenes with more writing are the stiller,
  smoother ones: r = −0.862 against visual complexity, −0.798 against motion,
  across the nine publishing scenes. A scene you read holds still. In `SITE.md`,
  in the corpus section, true regardless of what the index looks like.
- **A clean negative result on text entropy**, recorded so nobody tries it
  again: character-level spans 0.109 bits against a 0.1-bit noise threshold,
  every whole-scene ruler is word count in disguise (H₃ at +0.979 with log N),
  and corrected properly it can place only eight of twelve — Butterfly's six
  words being a coverage failure rather than a convention problem. In `SITE.md`
  under "The landing page", with the misquotable versions in
  `CORRECTED-FACTS.md`.
- **The harness rule.** Sample at scene-time, drive the clock, use a fixed
  number of boot frames, and report the invalid attempts. In `STANDARDS.md`
  under "Measuring a scene" — general enough to outlive the thing it was
  written for, which is the test for whether it belonged in STANDARDS at all.
- **The index is a real list with a layout on top.** Worth keeping as a
  property rather than an accident: it is what made the field's no-JS fallback
  free, and it is what made this revert a deletion.

**Verified after:** desktop 1440×820 back to 4/4/4 at 272px with `.rows-forced`
and both row breaks live; phone 390×844 back to two columns × six rows at 171px;
no field DOM, no console errors, `sceneField.js` in no bundle.

**Files:** `src/main.js`, `styles/main.css`, `scripts/prerender.js` (field code
removed; `.rows-forced`'s condition back to what it was),
`src/utils/sceneField.js` (shelved in place), `SITE.md`, `CORRECTED-FACTS.md`.
`STANDARDS.md` is untouched — the harness rule stands on its own.

## 4.10.0 (2026-09-04)

**The landing page becomes a field.** Twelve scenes on one plane, each at a
position measured from its own rendered frames. The grid asserted that all
twelve were the same kind of thing, equally weighted and equally sized; true at
five, already slightly false at twelve, and a wall of circles at twenty.

**Measured first, designed second, and the first axis died in the measuring.**
The full report is in the session artifact; the short version, because these are
the reasons that get re-proposed:

- Shannon entropy of the writing was the proposed x-axis. Character-level spans
  **0.109 bits** across the nine publishing scenes — the stated noise threshold
  was 0.1. Every whole-scene ruler turned out to be word count (conditional H₃
  correlates **+0.979** with log N). Corrected by rarefaction to a matched
  250-word sample it survives and then places **eight of twelve**: Harmonics,
  Outside and Psyshell publish no sentences, and Butterfly's six words carry no
  estimate under any correction.
- The gate the whole idea had to clear was whether the two axes disagree. They
  do: nothing between any text ruler and any visual ruler reaches significance,
  the strongest being ρ = −0.62 at p = 0.10.
- **The failure produced a better fact than the axis would have.** Word *count*
  predicts visual disorder at r = −0.862 (complexity) and −0.798 (motion). The
  scenes with more writing are the stiller, smoother ones. A scene you read
  holds still. In `SITE.md` now, true whether or not anything is built on it —
  and the reason the length correction was load-bearing rather than fastidious,
  since an uncorrected axis would have collapsed the field onto a diagonal and
  the diagonal would have looked like a finding.

**What shipped: spatial complexity × motion.** Both cover all twelve, both span
more than two orders of magnitude (hf 1.03–60.5 %, mad 0.00016–0.0432), and they
are independent of each other at ρ = +0.38, p = 0.23. Within each, the candidate
rulers agree and collapse to one — hf against spectral slope is −0.87, the three
motion measures agree at ≈ +0.90 — so there are two rulers here, not six. Both
axes are log-scaled, which is a property of the measurements and not a
presentational preference: on a linear scale nine of the twelve pile into one
corner.

**It is a layout over the list, not a replacement for it, and that is the whole
design.** `index.html` is untouched. The same `<ul>` of twelve `<li><button>`
gets `position: absolute` and a transform per tile, so JavaScript off, a
crawler, a screen reader and the moment before the field initialises all get the
grid — which is a correct index. Nothing about the no-JS fallback had to be
written because nothing was replaced. Verified: real `<ul>`, twelve tiles, DOM
order still the registry's, every tile named and focusable, the axis legend
`aria-hidden` because the list underneath is the real navigation.

**Sorted, then mixed.** The tiles start in a compact centred block — the grid,
near enough, which is the low-entropy configuration — and diffuse out to their
measured positions over 1.5s with a 260ms stagger. That is the two-gas
demonstration run in the honest direction: the grid IS the sorted state, twelve
things in rows ordered by nothing but the registry, and the measured plane is
the mixed one. Nobody sorted it.

**Three stated departures from true position.** All three are named in the code
rather than left to look like derivations:

1. *Repulsion.* One pair genuinely collides — Orbiter and Apollo at 0.063 of the
   diagonal, against a median pair distance of 0.403. `relax()` separates them
   with an anchored relaxation, and returns `maxShift` so the size of the lie is
   a number rather than a comment.
2. *The wander.* At rest the tiles keep a slow Lissajous drift of 3.5 % of a
   tile. Equilibrium is detailed balance, not stillness — and a static
   arrangement would make this a chart with a metaphor attached.
3. *Anisotropy.* The plane is stretched to the container rather than letterboxed
   square, so on a phone a step along x is worth fewer pixels than the same step
   along y. Letterboxing was tried and rejected: it threw away a third of the
   room on a laptop for a distance metric that was never metric — one axis is a
   share of spectral power and the other a grayscale difference per unit time,
   and no rate of exchange between them exists to preserve.

**Four things went wrong and each was caught by a measurement rather than by
reading the code.**

- *`.rows-forced` beat the field on the cascade.* Its `.preview-container {
  width: 272px }` has exactly the same specificity as the field's
  `width: var(--tile)`, so source order decides — and Vite's minifier reorders
  those two rules relative to the source. Desktop tiles came out 272px at 72 %
  coverage, overlapping badly. Fixed by not putting the class on at all in field
  mode, which is also what it means: there are no rows to force.
- *The relaxation settled short.* The anchor and the push reach a standoff a few
  pixels before the pair is actually separated — measured at 0–3px of clearance
  where `minDist` asks for 8. A short separation-only tail fixes it exactly.
- *Library sat behind the footer scrim on a phone.* The plane was sized from
  `#landing`'s padding-bottom (4.5rem) while `#landing-bottom-fade` is 10rem —
  the same mistake the scrim itself had fixed one release earlier. The field now
  asks the page how much room its chrome takes.
- *The calm was frame-counted, not timed.* The wander stops when a pointer
  enters or a tile takes focus, eased over 0.25s — except the first version
  eased by a fixed fraction per FRAME, which is 0.8s at 60fps and about fifteen
  seconds at the 3fps the measurement sandbox manages. On any slow device "stops
  when you point at it" would have quietly become "stops eventually." Caught
  because the harness kept reporting movement a second after the pointer
  arrived, with the pointer events provably firing.

**The wander stops when somebody is aiming at it,** and that came out of a
failure too: Playwright would not click a tile at all, because its actionability
check waits for an element to hold still for two consecutive frames and a
wandering tile never does. A human can hit a 155px circle drifting 5px, so this
is not the same as broken — but a target that is never at rest is a real cost
that falls hardest on whoever has the least steady hand, and an automated check
that cannot click the site's own navigation is worth listening to. Note the
ordering, which is why `page.click()` still cannot be used here and the harness
uses `mouse.move` then `down`/`up`: Playwright waits for stillness *before* it
moves the pointer, and the field stills *because* the pointer arrived.
`prefers-reduced-motion` remains the mechanism for switching the motion off
outright, and it arrives settled with no animation at all — verified.

**Build gate, made to fail before it was trusted.** `prerender.js` now checks
the registry against `sceneField.js` in both directions; removing Outside's row
fails the build with the scene named. What it cannot check is whether the
numbers are still *true* — they are measurements of frames, and a scene reworked
hard enough to change how busy it looks needs re-measuring. `SITE.md` says so.

**Measured after:** desktop 1440×820 — plane 1392×692, 155px tiles, 23.5 %
coverage, closest pair 2px apart, nothing scrolls. Phone 390×844 — plane
342×628, 78px tiles, 26.7 % coverage, every tile clear of the footer chrome.
Resize re-places and every tile lands inside.

**Files:** `src/utils/sceneField.js` (new — the measurements, their rulers, and
the placing arithmetic; pure, no DOM), `src/main.js` (`initField`,
`layoutField`, the settle loop, and `.rows-forced`'s new condition),
`styles/main.css` (`.is-field`, the axis legend), `scripts/prerender.js` (the
gate), `SITE.md` (the field, and the word-count correlation),
`STANDARDS.md` ("Measuring a scene" — sample at scene-time, drive the clock),
`CORRECTED-FACTS.md` (entropy figures need their ruler attached).

## 4.9.1 (2026-09-04)

**The landing page on a phone.** Scott sent two screenshots from an iPhone.
Three things in them, two fixed and one not reproduced.

**One tile per row.** The base tier stacked the grid into a single column, so
twelve scenes measured **2,856px of scrolling against an 844px viewport** —
three and a half screens to read an index. That is the wall-of-circles problem
the entropy-box brief describes, reached from the other direction: not too many
tiles per row, but one. The row is the base now and the same twelve come to
1,378px at 390px wide, and 1,168px at 320px. Under half, at every width.

The two columns are declared on `.preview-wrapper` as `flex: 0 0 calc(50% -
0.5rem)` — a share of the LIST — and not on the tile as a share of the
viewport. The first attempt did use the viewport (`min(43vw, 200px)`) and it
was wrong by four pixels at 320px: 43vw is 137.6, and two of those plus one
1rem gap and the list's 2rem of padding come to 324 against a 320px viewport,
so the narrowest phone silently fell back to one column while every other width
worked. Caught by measuring tiles-per-row at ten widths rather than by looking
at one. `calc(50% - 0.5rem)` is exact by construction — two of them plus the
gap is 100% of the list's content box — and it also sees a classic scrollbar,
which a vw unit cannot and which `#landing`'s own `overflow-y` can produce.

**The tile-size tier moved 481px → 601px.** With a fitted tile below and a
fixed 224px tile above, 481 was a cliff rather than a step: two 224px tiles
plus the gap and padding need 496px, so the grid would have dropped from two
columns back to one at exactly the width the tier began. 601 is where the two
agree on two columns, and it is also where `#landing-bottom-fade` and
`#landing-textlink` already change behaviour — the phone layout now ends at one
width instead of three.

**The footer scrim was a tint, not a scrim.** `#landing-bottom-fade` was 7rem
tall ramping 0.9 → transparent, but `#landing-textlink` sits at bottom 5.2rem —
74% of the way up that ramp, where the gradient has fallen to about 0.23. So
"READ THE WRITING ON ITS OWN" was being read against whatever tile happened to
be scrolled behind it, with nothing but a text-shadow in between, and over
Library's bookshelf it was illegible. Now 10rem with the ramp held near-opaque
through the band the chrome actually occupies (measured: the link occupies
52–60% of the ramp at 390×844, `#site-title` 12–29%) and released above it.

Verified by screenshotting the band twice, once with the scrim and once
without, with the chrome itself hidden so the two shots differ only by the
scrim — the first version of that measurement left the white text in both and
inflated the ratio. Under the link, residual brightness went from 0.44 of the
unscrimmed tile to **0.048**, and the brightest pixel behind the text from
248/255 (a white book spine) to 13/255.

**Not reproduced: the stretched preview.** In Scott's first screenshot the
Sphere thumbnail is a tall ellipse rather than a circle, which cannot be a
sphere's silhouette at any camera angle. Rendered at 320/360/375/390/414/480
and it is a circle every time, so this is iOS Safari or a transient state
during load, and it is recorded here rather than guessed at. What the numbers
DO explain is the softness in that screenshot and not the shape: the preview
renderers cap `devicePixelRatio` at 2 site-wide (a deliberate, documented
decision — twelve live WebGL canvases on a phone is exactly the wrong place to
spend fill rate), so on a DPR-3 iPhone a 200px tile is drawn at 400px and
scaled up. The tiles are smaller now, which narrows the gap without changing
the cap.

**Files:** `styles/main.css` only — `#scene-previews` (row base, bottom padding
that clears the scrim), `.preview-wrapper` (the two columns),
`.preview-container` (fitted width, `aspect-ratio`, tier moved to 601),
`#landing-bottom-fade` (height, stops, tier moved to 601).

## 4.9.0 (2026-09-04)

**The nav row scrolls, and the fullscreen control moves into it.** Two changes
that are really one: the second is only possible because of the first.

**The complaint.** Scott, looking at Sphere with a fragment open: the fullscreen
icon should go somewhere less obtrusive. It sat at top-left as a fixed 38/44px
circle, and the corner had been checked — it clears every scene's hint text,
which all sit top-right — but clearing the other chrome is not the same as
being out of the way. Sphere puts a reading panel down the left side, and the
circle landed on the panel's heading rule and clipped the first letter of
MATRICES. That is a floating control sitting on somebody's content, and the
four corners of this site are spoken for (hints top-right, sound toggles
bottom-left, titles bottom-centre, Psyshell's ordinal bottom-right), so there
was no fifth corner to move it to. It stops floating instead.

**Why it could not just move into the nav.** The row was already exactly full.
`--nav-slot` guaranteed a fit by shrinking the icons until they fit — icon =
min(44px, slot) — so at 375px twelve icons were 30px wide and consumed the
whole width with nothing left over. Reserving a thirteenth slot would have
pushed a scene off the screen, which is the bug that file has a five-entry log
about.

**Scott's solve: make the navbar scrollable.** The comment in `styles/main.css`
had weighed exactly two options for three releases — shrink the icons, or wrap
to two rows — and rejected the second because #pm-nav's 3.5rem height is
load-bearing well outside that file (#landing and #experience-overlay pad their
tops by it; every scene stylesheet clears it at top:4.5rem). Scrolling is the
third, and it costs none of that. The bar stays 3.5rem, so nothing downstream
moves. And it retires a debt the same comment had been carrying in the open:
"10 x 44px is 440px, so a single row of ten cannot give every icon a 44x44
target on a 375px phone — that's arithmetic, not a choice." The arithmetic was
right; the choice it defended wasn't the only one. Icons are now a full 44 x 44
at every width, up from 30.4px at 320px.

**What is derived now.** The formula's job changed from "guarantee a fit" to
"say where the fit ends":

    slot      = min(84px, (100vw - 2*padding - rule) / units)
    icon size = 44px                     fixed, no longer derived down
    gap       = max(0, slot - icon size)

    row fits           <=>  100vw >= units*44 + rule + 2*padding
    gap reaches 2.5rem <=>  100vw >= units*84 + rule + 2*padding

`units` is `--nav-count` plus `--nav-extra`, and `--nav-extra` is 1 exactly
when #fullscreen-toggle is showing — set by main.js from the same feature test
that reveals the button, because on a platform with no Fullscreen API (iOS
Safari) the row must not reserve a slot for a control that is display:none.
`rule` is the 1.5rem separation before the toggle, reserved in the formula so
it stays honest about the whole row.

**Measured, not trusted from the algebra.** With today's twelve scenes and the
toggle showing (units = 13) the two thresholds are 612px and 1132px, and both
land exactly there in a browser: at 612px the row's scrollWidth equals its
clientWidth, at 611px it overflows, and the gap reaches exactly 40px at 1132px.
Above 1132px the row is pixel-for-pixel what it always was. At 375px eight
icons show and the ninth is cut mid-glyph at the edge, which is the scroll
affordance; scrolling to the end puts the toggle's right edge at 367px in a
375px viewport, i.e. flush against its own 8px padding, so the last item is
fully reachable.

**Two things that had to be gotten right rather than eyeballed.**

- *Centring a row that may overflow.* `justify-content: center` is the wrong
  tool: scrollable overflow only extends toward the end side, so a centred row
  that overflows puts its first icons at negative offsets no scrolling can
  reach — which is the exact bug in that file's log, arrived at from a new
  direction. Fixed with two `flex: 1 0 0` pseudo-element spacers, which split
  free space while there is any and collapse to zero when there isn't. `safe
  center` would also work in current browsers; spacers work in all of them and
  need no feature query.
- *The spacers' negative margins.* `gap` applies between every pair of flex
  items, so two spacers add two gaps the fit arithmetic never reserved, and the
  row would have overflowed by exactly one gap at every width where a gap
  exists — that is, it would have scrolled on desktop. Caught as arithmetic
  before it was written, and the cancelling margins are checked in the same
  terms: row = 11*slot + 44 + rule against an available 12*slot + rule, which
  holds for every slot >= 44px.

**The toggle is now nav furniture, not a button.** No circle, no scrim, no
backdrop blur: a bare 20px glyph at opacity 0.5 rising to 1 on hover, matching
.nav-icon exactly. The 0.5 is reused rather than re-derived — it is the value
.nav-icon's own comment measured at 5.3:1 against the bar's ground, past WCAG
1.4.11's 3:1 for a non-text control, and this is the same white glyph on the
same ground. It is still not a scene, and the row is otherwise a scene
switcher, so a 1px hairline sits in the reserved space before it. The hairline
is drawn in CSS rather than marked up: it is a visual grouping cue, and a `<hr>`
or `role="separator"` would announce a division of the navigation that does not
exist.

**Nothing downstream needed changing, and that was checked rather than
assumed.** main.js's focus ring collects `.nav-icon`, `#site-title` and
`#fullscreen-toggle` separately and sorts by document order, so the toggle
simply lands after the icons where a keyboard visitor now expects it (and a
focused off-screen icon scrolls itself into view, which is better than the
row's previous behaviour of having no off-screen icons because they were all
squeezed). prerender.js's nav gate counts `.nav-icon` against the registry —
the toggle carries no `data-scene` and is not one — so moving it inside `<nav>`
changes nothing there.

**One stale number found on the way.** `--nav-count` in the stylesheet was 11
while index.html has carried 12 icons since Psyshell shipped. Both gates that
were supposed to catch that drift watch the markup against the registry, and
neither reads the stylesheet. Harmless as it turned out — and now more
harmless, because with a fixed icon size that fallback only sets the pre-script
gap, where before it also set the pre-script icon width and a stale count meant
a momentarily clipped row. Corrected to 12 and the changed failure mode
recorded at the declaration.

**Files:** `styles/main.css` (nav sizing, scroll, spacers, toggle restyled, the
z-index scale and the responsive note updated), `index.html` (the button moved
inside `<nav>`), `src/main.js` (`--nav-extra`), `psyshell.css` (a comment that
described the old top-left circle as a live constraint — the corner is free
now, the ordinal stays where it is anyway, and the note says why so the freed
corner doesn't read as an invitation).

---

## Older releases — 4.8.9 and back

Moved to **`NOTES.archive.md`** at 5.0: 1.0 (2026-07-17) through 4.8.9, sixteen
thousand lines of it. The standing sections above and every release from 4.9.0
on stay here.

That file is history and is worth reading for exactly one thing — why a decision
was made, and which alternative was already tried and rejected. It is not worth
reading for a fact: every count and every path in it was true on its own date.
