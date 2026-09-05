# 5.0 — the audit punch list

Eight parallel audits, 2026-09-05, one per scene plus the shared layer and the
build. Every line below was confirmed by the auditor against the code, not
inferred — where a comment claimed another file guaranteed something, that file
was opened; where a number was asserted, it was recomputed.

**The shape of it.** Four real bugs were found by hand earlier this week and all
four had the same form: a comment that was true when it was written and false by
the time somebody relied on it. This list is what happens when that hypothesis
is taken seriously and applied to every file at once. The single largest
category is not broken code. It is **an effect that has never once rendered**,
usually with a careful comment above it explaining how it works.

Status: `[ ]` open · `[x]` fixed in 5.0 · `[-]` deliberately not doing

---

## Tier 1 — a visitor meets this

### Shared chrome
- [x] `main.css:1563` — `.preview-container:hover { transform: none }` under reduced motion discards `--tile-nudge`; hovering a tile snaps it up to 11px, instantly (no transition under that media query). This is 4.11.16's bug, one rule further along, in the file that documents 4.11.16's bug.
- [x] `main.js:1121` — `PM_GLIMPSE_WORDS` has no entry for **apollo, psyshell, medium**. Six of the twenty-seven glimpse triggers roll a die that can never win.
- [x] `main.js:351` — `FOCUSABLE = 'button, a[href], [tabindex]'` cannot match `<input>`. Apollo mounts 12 real inputs inside the overlay. Latent today (the body-level toggle still sorts last), false as documented.
- [x] `main.css:379` — nav-row fit thresholds (612px / 1132px) were measured at twelve scenes. At thirteen the formula gives **656px / 1216px**. Between 612 and 655 the comment says it fits and it scrolls.

### Published and indexed
- [x] `index.html:469` — Beamline's tile `aria-label` describes *curved mirrors and a bouncing beam*. The scene has no mirrors. `registry.js:99` documents this exact wording being fixed — the fix never reached the markup.
- [x] `index.html:508` — Psyshell's tile says *on a workshop bench*. `psyshell.js:55`: "there is no bench, no floor and no lamp."
- [x] `index.html:448` / `registry.js:95` — "107 books". Real: 104 books, 44 films, 2 decks, 115 CDs.
- [x] `prerender.js:546,548,551` — the **published** `/text/beamline/` description, lede and JSON-LD all describe the mirror design. This one is crawlable and in the sitemap.
- [x] `registry.js:99` — the claim that the registry `ariaLabel` is "the ONLY account a screen-reader visitor gets" is false: the landing tile carries a separate hand-maintained string and nothing compares them.

### Scroll
- [x] `scroll.js:274` — every ink stain is a **full-height vertical band**. `h` is computed as a fraction of `w` and written as a percentage `height`, which resolves against the containing block's height — 1,200 to 14,000px. `border-radius: 50%` and a radial gradient confirm a blob was intended.
- [x] `scroll.css:21` — the candlelight `::before` (`z-index: -1`) paints **behind `.scroll-root`'s own opaque background**, because `.scroll-root` is `position: relative` with no `z-index` and so is not a stacking context. The flicker the scene header describes has never been visible.
- [x] `scroll.js:264` — the patch `drop-shadow` is removed by the same element's `clip-path`. Same for `.scroll-flash`'s 2px inset ring, which is the only feedback a cross-link jump has.
- [x] `scroll.css:371` — `.scroll-ogham-line--wide` is unconditional; below 601px it *narrows* the column from ~310px to 220px, the opposite of its stated purpose.
- [x] `scroll.css:305` — `.scroll-patch-refs` at 9.9px measures 1.65–2.18:1 against the three patches that actually show it.

### Sphere
- [x] `sphere.js:356,419` — `panelContent.scrollTop = 0` targets the wrong element; `.sphere-panel` is the scroll container. Following a link inside a long fragment lands the reader mid-text.
- [x] `sphere.css:159` — `silk-glimmer` drops the link's alpha 0.78 → 0.28, so contrast falls **9.60:1 → 1.92:1**. The link's only affordance is a momentary near-disappearance.

### Theater
- [x] `theater.js:376` — `_placeBubble` corrects horizontally only. The seven tallest bubbles run off the top of `.tab-root`'s `overflow: hidden`; the worst is ~349px tall at 375px wide. `theater.css:257` claims the clipping is fixed.
- [x] `Player.js:23` — `MAX_DUR = 10000` truncates 29 of 736 beats. The longest wants 35.1s at the comment's own stated reading rate.
- [x] `theater.html:23` — the screen's `aria-label` names two of the three plays; `friendInSatan` is 211 of 615 beats.

### Butterfly
- [ ] `butterfly.css:23` — placard at `bottom: 3rem` instead of `var(--title-block-bottom)`. That leaves **~2.6px** above the footer pill — the exact geometry `main.css:183` records measuring and rejecting. `main.css`'s "every scene anchors to this value" is false.

### Orbiter
- [ ] `orbiter.css:151` — under reduced motion the poem link's animation is removed and **nothing replaces it**. Colour is inherited, no underline, no border, `cursor: default` — there is no cue at all. `sphere.css:167` documents this exact defect being fixed, and library and scroll both carry a static rule unconditionally.
- [ ] `orbiter.css:84` + `orbiter.css:152` — the panel `✕` is `position: absolute` inside the scroll container, so it scrolls away on a long poem. Same in orrery.
- [ ] `sceneKit.js:523` — `escapeHtml`'s comment claims it escapes quotes. It does not (text-node serialisation). Worse: the phrase is escaped and then matched against **decoded** text in `wireCrossLinks`, so a phrase containing `&`, `<` or `>` silently drops its link — and `verify-links` compares the raw pair, so it passes.

### Orrery
- [ ] `orrery.js:2269,3650` — the poster hover highlight changes the rendered image by **0–4 of 255**. The emissive colour is `0x0c0a08`, so a 2.4× intensity bump is sub-visible. The crosshair is what everybody was actually confirming.
- [ ] `orrery.css:110,131` — two rules set `text-align` on `.orrery-hint`; `center` is dead.

### Harmonics
- [ ] `harmonics.js:779` — the "pending" layer renders **zero points**; the comment says 42. The whole subsystem (`pickPendingAt`, `openPendingPanel`, the drift integration, `DRIFT_R`) is unreachable. The same file says so correctly 470 lines later.
- [ ] `resonanceExcerpts.js:98` — **10 of 128** excerpt slots print reviewer apparatus into the panel: *"(no rationale quote matched this piece — showing opening text instead)"*, in pull-quote italics.
- [ ] `harmonicsPieces.js:66` — **4 of 128** slots render as an empty bordered quote box; the documented fallback is unreachable for empty text because the length check short-circuits first.
- [ ] `harmonics.js:922`, `harmonics.css:190,251`, `harmonics.html:13` — the panel's density design is calibrated against a 6-card maximum. The real maximum is **12** (`scroll:11`, "Projection"). Four comments, three of them the stated reason for a layout decision.
- [ ] `harmonics.css:49,61` — the reduced-motion blocks are on the two elements with no transitions; the panel's 500ms slide, the largest motion in the scene, is unguarded.
- [ ] `harmonics.css:273,177,229` — three panel colours measure **3.2:1** (9.3px), **4.2:1**, **3.7:1**. All fail AA; two carry explicit legibility claims.
- [ ] `harmonics.js:694` — the dust layer's `renderOrder: 1` puts it **over** the nodes (which are 0), multiplying their brightness by ~0.45 where it covers them.
- [ ] `harmonics.js:422,453` — `scene.fog` and both lights affect nothing: every material is `Points`/`Sprite` and all seven set `fog: false`.

### Beamline
- [ ] `beamline.js:1634` — station labels are sized so their **on-screen size is constant**, ~524 CSS px wide. All ten overflow a 390px phone; the longest is 567px tall on an 844px screen.
- [ ] `beamline.js:981,1873,1919` — the emerald palette pass left three blue glow textures (214°, 202°, 213°) on the terminus, grid bugs and sky motes. The file header says the transcription problem was "resolved by fixing the code"; the fix reached the dust and not these.
- [ ] `beamline.js:2401` — a 2.7 Hz glow flicker sits outside the `if (!reduceMotion)` block that gates everything else in the scene.
- [ ] `beamline.js:60` — `ACCENT_SHADOW` documented "unused directly here"; it is the bottom stop of the terrain colour ramp.

### Outside
- [ ] `outside.js:137` — the seam texture is **flipped**: the gold root glow renders at the petal tip, and the veins converge at the tip instead of fanning from the root. `flipY` is never set and defaults true.
- [ ] `outside.js:546` — the emissive map has no `colorSpace`, so it uploads raw and reads **3.4–11.7×** the flat emissive the comment says it reproduces.
- [ ] `outside.js:1018` — the comment says the sound preference is one shared site-wide key; `sceneKit.js:270` records Scott's direct correction that it must be per-scene, and the code is per-scene.

### Apollo
- [ ] `apollo.js:395` — the **sodium doublet merges into one line** on every phone and every 1× laptop under ~1400 band columns. `lineSigma`'s floor pins σ at 0.55 while the separation keeps shrinking. The scene's own text calls this "the point of the whole instrument".
- [ ] `apollo.js:279,287,305` — three numbers in the rolloff block are stale: exponent stated 0.30 (is 0.38), 400nm efficiency stated 0.003% (is 0.127%), H-alpha stated 25% (is 41.4%).
- [ ] `main.css:1516` — `.pm-jumplist`'s `z-index: 320` cannot beat body-level chrome at 310, because it is inside `#experience-overlay` (`z-index: 300`), which **is** a stacking context. The comment says `position: fixed` escapes to the page root; it escapes the containing block, not the stacking context. Apollo's and Outside's hints paint over the focused jump-list label.

### Psyshell
- [ ] `psyshell.html:39` — the sound toggle is appended to `<body>` **without `.pm-scene-chrome`**, so it is outside the Tab ring entirely. This is verbatim the Outside bug `main.js:327` records as fixed.
- [ ] `psyshell.js:1253` — the ordinal's collision guard measures a `display: none` element, so `overlaps` is always true and an inline `bottom` is always written. The authored bottom-right position has never rendered.
- [ ] `psyshell.js:1259` — the resize handler never calls `applyPixelRatio()`. Nine other WebGL scenes do.

### Medium
- [ ] `medium.js:404` — `INK_SOFT` at **3.15:1** paints the digits, all four punctuation marks and YES/NO/GOODBYE — 17 of 43 marks, at ~12px on a phone. `medium.css:14` measured the two chrome elements and skipped the canvas, which is the surface the scene is about.
- [ ] `medium.physics.js:213` — `STOP_DAMP = 9` is exported and never used. The burst-end stop the comment credits with fixing a measured 20% adjacent-letter rate is a 4.5× slower glide.
- [ ] `medium.physics.js:412` — `stepCup` computes `leader`/`moved`/`applied` every frame; all seven call sites discard them. The comment names a consumer that does not exist.

---

## Tier 2 — dead, and documented as live

- [ ] `harmonics.js` — `FOG_DENSITY`, `DRIFT_R`, `pendingVel`, the whole pending path.
- [ ] `beamline.js` — `CYCLE_SECONDS` (zero references), the "ground glimpse" section header for a feature retired 2026-08-18, two unreachable default params, two exports nothing imports.
- [ ] `sceneKit.js:521` — `HINT_TEXT_COLOR` exported, **zero importers**; two files call it the single source and one of them ("0.6 gets pure white to ~4.6:1", `main.css:177`) has the wrong number — it is 7.37:1.
- [ ] `sceneKit.js:778` — `trackTimers.cancel` calls both `clearTimeout` and `cancelAnimationFrame` on one id; the two counters share a namespace.
- [ ] `main.js:177` — `PUBLIC_SLUG` / `SLUG_TO_INTERNAL` are identity maps behind a 17-line comment describing a translation that cannot happen.
- [ ] `main.css:999` — `.preview-row-break` declared twice; the first is fully overridden, and three claims around it (a 1200px breakpoint, a fixed 5th-tile break, "the two axes") describe machinery that does not exist.
- [ ] `main.css:935` — `--tile-cols` written every layout pass, read by nobody.
- [ ] `psyshell.js:401,244` — `trackTimers()` allocated and never used; `MAX_DIGITS = 16` can never bind.
- [ ] `medium.physics.js:291,684` — `WANDER_CENTRE` documents a term not in the code; `homeX`/`homeY` written and never read.
- [ ] `medium.lexicon.js:338,176,307` — `readerAtWordEnd` unimported; `isWord`'s comment wrong twice; an unreachable `??` fallback.
- [ ] `orbiter.js:1162` — the jump-list guard is unreachable (`sceneKit.js:506` stops the click at the `<ul>`), and its comment claims it is the fix.
- [ ] `orbiter.js:1300` — a `Math.max(0.5, …)` floor on a range whose minimum is 0.70.
- [ ] `orbiter.js:695,304,503` — returned fields nothing reads.
- [ ] `orrery.js:1483,1130,1093` — `direction: 1` is a constant; `dishGroup`/`jointBasePos` unread; a distance recomputed two lines after it was stored.
- [ ] `apollo.js:834` — the closing octave tick can never be drawn (`HZ_MIN × 2 > HZ_MAX`).
- [ ] `apollo.js:7`, `apollo.css:286` — two dead imports; a `grid-column` on a flex item.
- [ ] `sphere.js:581`, `sphere.css:27` — `viewW`/`viewH` now unread; a `transform-origin` left from the removed tilt.
- [ ] `theater.js:351`, `theater.css:529` — `currentLine.el` unread; `.tab-preview.paused` pauses an animation the element does not have.
- [ ] `butterfly.css:42,54`, `outside.css:48,60`, `psyshell.css:194` — reduced-motion blocks cancelling transitions that are never declared.
- [ ] `scroll.js:150`, `scroll.text.js:437`, `scroll.marks.js:62` — a dead em-dash branch whose justification is false; `SPACE_MARK` is U+0020, not the Ogham space mark it names; a comment duplicated from another file describing symbols that are not there.

---

## Tier 3 — counts and claims that the data outgrew

- [ ] Sphere says **320 labels** in five places and `sphere.css:29`; it is **180**. Three optimisations cite the wrong figure as their justification.
- [ ] Harmonics says 61 nodes / 122 oscillators / a 22-row corpus; it is **76 / 152 / 64**. Two line citations have drifted.
- [ ] Psyshell says 252 segments (144), degree 1–17 mean 3.04 (2–9, mean 3.51), fourteen bridge strands (70), 20,868 floats (37,156), 3,221 filapixels (3,244) — and the site's own `/text/psyshell/` page already prints the right numbers.
- [ ] `prerender.js:750` publishes "**223 pieces**"; the current answer is **218**, largest 22.0% not 19.8%. Also in `psyshell.web.js:156` and `STANDARDS.md:308`, in a section titled "A structural claim gets measured, not described".
- [ ] Theater says "all 404 bubbles"; the reel has **614**. 404 is the two-play count from before `friendInSatan`.
- [ ] Orrery — `BRICK_PX_PER_UNIT` does not exist; `wallDist is 6.5/5` is 8.5/5; "camera at z 16.8" describes a camera the walkthrough removed; "the four innermost rings" is five.
- [ ] Butterfly — `PPS = 400` justified by "the tile's real 240px size"; the tile caps at 224 and butterfly's `tile: 0.90` makes it the smallest on the page (max measured 218px).
- [ ] Medium — `DWELL_RADIUS` reasoned against "0.051 apart" while `medium.text.js` says 0.072; real spread is 0.043–0.073, and the drawn cup is wider than the tightest gap. `BOARD_HOME`'s comment is false on both claims. `LEAN_MAX`'s force ceiling is 12.5, not 5.9. The reduced-motion clock comment is backwards. A duplicated comment block whose first copy describes a tile stub that does not exist.
- [ ] "Ten scenes" survives in `index.html:47,106,328`, `vite.config.js:241,282`, `sceneField.js`, `sceneKit.js:203`, `main.js:964`, `STANDARDS.md` ×4, `.htaccess:87`. "Twelve" survives in `main.js:837,885`.
- [ ] "Eight prerendered pages" in `.htaccess:74,135` and `prerender.js:109,124`; it is eleven.
- [ ] `registry.js:191` — Outside's `TEXT_EXEMPT` reason is wrong on both halves: it names 7 strings (there are 21) and says they are visible on the landing tile (they are not; they exist only in full-scene mode).
- [ ] `sceneKit.js:470` — `createJumpList`'s comment names four scenes; **nine** use it, and one of the four named does not.
- [ ] `deploy.yml:69` — "16 node --test tests"; there are 20.
- [ ] `.htaccess:98` — "zero inline script of any kind"; there is one `application/ld+json` block per page. CSP-safe, but the sentence is why someone would believe it impossible.
- [ ] `.htaccess:115` — a "note for the next reader" pointing at a `STANDARDS.md` passage that was fixed in 4.0.
- [ ] `prerender.js:11` — "src/text/*" does not exist.
- [ ] `butterfly.text.js:4` — "main.js's SCENES map"; it moved to `registry.js` in 4.2.0.
- [ ] `SHELVED.md:64` — the Spectra restore procedure says to set `--nav-count` back to 11. It is 13; a restore makes it 14.

---

## Tier 4 — build, deploy, docs

- [ ] **`scripts/verify-landing.mjs` runs nowhere.** Not in `package.json`, not in `vite.config.js`, not in CI. Three source files cite it as the thing that *proves* the landing requirement. It needs the `export function` shape the other three verifiers have before it can hook `buildStart`.
- [ ] `build-resonances-doc.mjs` writes `docs/harmonics_resonances.md`; the file in the tree is `docs/constellation_resonances.md` (pre-rename), whose own header says "do not hand-edit — generated by this script". Running it produces a second file and orphans the first.
- [ ] The shelved Spectra scene **ships in every deploy** — `main.js:17`'s glob matches it, and `dist/` carries three chunks nothing can reach.
- [ ] `.htaccess:299` — `Permissions-Policy: fullscreen=(self)` does not delegate to the cross-origin YouTube embed that asks for it (`library.js:198`). Either the header or the `allowFullscreen` is the half to change.
- [ ] `robots.txt:3` — disallows `/packages/`, which stopped shipping in 4.0.
- [ ] **SITE.md is a release behind**: "the twelve scenes" with no Medium row, "all twelve tiles" as the landing requirement, Library "30 excerpts / 100 notes" (68 excerpts, and the note field no longer exists), "Links (146 rows)" (65), psyshell corpus figures a release stale, and "a page for every scene" (10 of 13, 3 exempt).
- [ ] **NOTES.md archival.** 18,000+ lines. Scott's call at 5.0: move the version-by-version history into an archive and leave the standing rules, the current state and the recent releases in the working file.

---

## What this list is evidence of

The audits were told to hunt five categories. The counts came back lopsided in a
way worth recording: **effects that never render** and **claims the data
outgrew** are most of it, and the second keeps producing the first. A number is
measured honestly, written into a comment, and then the thing it measured
changes — the corpus grows, a scene is renamed, a third play is added, a zoom
control is introduced — and the comment goes on being read as current. Nobody
re-derives a number that is already written down with its working shown.

The countermeasure the codebase already knows about is in `STANDARDS.md`:
derive, do not type. Every finding in Tier 3 is a value that was typed where it
could have been computed, and every one of them was right on the day it was
written.
