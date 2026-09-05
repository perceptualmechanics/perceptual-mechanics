# 6.0 — the audit that had to run rather than read

Ten parallel audits, 2026-09-05, one per scene group plus the shared JS, the
shared CSS/markup/data, and the build. Scott: *"go through the code and
challenge every claim the comments make. if they're wrong, delete 'em. I'm
sick of this."*

**How this differs from 5.0, and why it had to.** 5.0 was ninety-four findings
produced by READING, and it recorded its own weakness afterwards: it was right
about every case where a comment asserted something checkable by reading, and
wrong about all seven cases where the answer needed a measurement. So every
agent here was given a browser, a freeze recipe, and one instruction — execute
it, do not reason about it. Findings are marked VERIFIED (something was run) or
HYPOTHESIS (reasoned only). Almost all are VERIFIED.

**Read this as a record, not as state.** Same warning as PUNCH-LIST-5.0.md, for
the same reason: every finding below is written in the present tense because
that is the clearest way to state a defect, and present tense read later is a
claim about now. Check `git log` before acting on any of it.

---

## What this pass says about the last one

**Five of the worst findings are in code written the same day, by the same
process that wrote this list.** That is the most useful thing in the document.

- Scroll's "swinging" edge shadow (5.0.1) does not measurably swing: **peak
  7/255, zero pixels over 8/255** across the flame's real p5–p95 range.
- Scroll's patch wash does not visibly slide: stepping only `--flame-x` gives
  **peak 8/255, 72 pixels**. The opacity term does all the visible work.
- The smoke's `z-index:-1` "emergence at a third strength" (5.0.3) is **zero
  pixels inside the pill for 92% of the cycle**. The wisp's geometry never
  occupies the pill it is supposed to emerge from behind.
- The Orrery's man-door opening (5.0) renders **zero pixels** — the emissive
  plane sits *inside* the solid frame box. Painting it magenta changes nothing.
- Turning round at the Orrery spawn shows **only brick**: both new doors are
  off-frame at the spawn the comment says was chosen so you would see them.

And the one that matters most, because it is the exact sin this release is
about: `medium.text.js:150-160` carries a table of measured numbers
(0.139 letters/s, 34.6% vowel share, 24.6% control) presented as the evidence
for today's geometry change. **The shipped bench prints 0.149 / 34.0% / 27.5%.**
The table came from a scratch harness that was never committed, quoted as
though it came from `scripts/medium-spell.mjs`. The control figure — the number
the whole argument rests on — is 2.9 points out.

The lesson is not "be more careful." It is that a comment stating a measurement
is a liability the moment the measurement is not re-runnable from the tree.

---

## Tier 1 — a visitor meets this

### Keyboard and screen-reader access

- [ ] `styles/main.css:1424` — **the tile focus ring never renders.** An inset
  `box-shadow` paints below in-flow descendants, and `.preview-container canvas`
  fills the button. Ring on vs off with the canvas present: peak 38/255, 334 px,
  **all of them in a sub-pixel band at radius 106.3–106.9** (tile radius 107) —
  mask anti-aliasing leak, not a ring. With the canvas hidden: peak 188/255,
  2304 px. These are the site's 13 primary keyboard targets. WCAG 2.4.11/1.4.11.
- [ ] `src/main.js:365-392` — **the focus trap does not work in Library.**
  `collect()` excludes `tabIndex === -1`, `[hidden]` and `disabled`, but not
  subtrees hidden by CSS. Library's three collapsed `<details>` contribute 265
  unfocusable buttons of 283. `last` is one of them, so **Shift+Tab from the
  skip link is a dead key** (measured: three presses, focus never moves) and the
  forward wrap is unsatisfiable. Separately `FOCUSABLE` omits `summary`, so the
  ring misses 3 controls that ARE on screen.
- [ ] `src/scenes/harmonics/harmonics.js:1322` — **the jump list is never
  relabelled.** It reads `container.querySelectorAll('.pm-jumplist button')`,
  but `createJumpList` mounts on `document.body` (sceneKit.js:533, with its own
  comment explaining the move). `btns` is empty; 76 buttons stay "Piece 1 …
  Piece 76" forever. The comment's own words: *"Sixty-one buttons that all read
  the same is not a list anyone can navigate."*
- [ ] `src/scenes/theater/theater.js:301-305` — **scene changes are never
  announced.** `.tab-slug` is `aria-hidden`, and `onSceneChange` writes only
  `slugEl.textContent`, never `srLive` (unlike `onChorus`/`onLine`). Measured:
  120 `next` clicks → 4 slug changes, 114 `srLive` writes, **zero** matching
  `/INT\.|EXT\./`.

### Contrast, measured against the real ground rather than black

- [ ] `styles/main.css:1191` — **`#landing-textlink` measures 1.09:1** in the
  601–999px band. The bottom fade goes `display:none` at 601px but `.rows-forced`
  does not engage until ~1000px, so the grid still scrolls under the link with
  no scrim. Worst ground: Apollo's spectrum tile. This is the exact failure the
  4.9.1 note says was found and fixed — the fix was applied to the phone tier only.
- [ ] `styles/main.css:530` — **`.nav-icon` measures 2.93:1** over the landing
  grid at 390px (the comment claims 5.3:1, correct only against black; no scene
  ever sits behind the bar, but the scrolling tile grid does). Below the 3:1
  floor for a 1.3px stroke. Same for `#fullscreen-toggle`, which reuses the claim.
- [ ] `styles/main.css:265` — **the focus ring measures 1.02:1** over bright
  grounds. `#site-title:focus-visible` draws a white ring at `outline-offset: 4px`,
  outside the pill's scrim. Raising a white ring's alpha cannot help here; the
  one rule that solved it correctly (a dark second ring) is the tile ring above,
  which does not render.
- [ ] `src/scenes/beamline/beamline.css:15,100,110` — the AA claims are computed
  against black; the rail passes through the title block at the opening framing.
  Measured: `.beamline-title-sub` **1.00:1** where the rail crosses,
  `.beamline-hint` **1.71:1** worst, `.beamline-title-main` **1.02:1** over the
  rail. `verify-css-invariants` passes because it deliberately checks only the
  best case — the CSS comment reads that as a guarantee.
- [ ] `src/scenes/library/library.js:466` — **"contrast-aware ink" is backwards
  on 17 spines.** `relLuminance` reads `THREE.Color`'s linear-sRGB channels
  against a perceptual 0.55 threshold. `#b59b00` (8 books) gets cream at
  **2.18:1** where dark would give 5.22:1; `#c9a227` (7 CDs) 1.94:1; `#a8b5bd`
  (2 CDs) 1.70:1.

### Effects that do not render, or render invisibly

- [ ] `src/scenes/orrery/orrery.js:2428` — the man-door opening is **fully
  occluded** by the frame box (plane at z=12.39 inside a box spanning 12.38–12.50).
  Painting it magenta: **0 pixels changed**. Hiding the frame: 3828 px, 2295 magenta.
- [ ] `src/scenes/orrery/orrery.js:2352` — **both doors are off-frame at the
  spawn.** Man door centre projects to sx −324 (off-screen), bay centre to
  sx 1825. The 1.2m offset predates the doors and was never retuned.
- [ ] `src/scenes/orrery/orrery.js:2458` — the street SpotLight **never lights
  the leaf**. The visible face's normal dots to −0.253 against the light
  direction; over the leaf's rect the delta is 9 px. The leaf renders
  (13.4, 14.5, 14.0) — the "dark rectangle" the comment says it avoids.
- [ ] `src/scenes/beamline/beamline.js:2041` — the sky motes' deliberate blue is
  **cancelled by the material's green `color`**. Measured `rgb(120,198,159)`
  where the intended texture gives `rgb(222,232,248)`. The same file names this
  exact bug at :1949 for the dust and fixes it there.
- [ ] `src/scenes/orbiter/orbiter.js:510` — the satellite rim glow is **20× under
  the visibility floor**: peak 8/255, 3 px ≥8. The same shader at `glow = 1.0`
  gives peak 103/255, 326 px, so it compiles and runs.
- [ ] `src/scenes/outside/outside.js:518` — **per-petal saturation identity does
  not survive to screen.** Intended saturation span 0.360, rendered **0.038**;
  all seven petals land in 0.15–0.19. Cause isolated: the round-6 white emissive
  map (removing it restores 0.153) and `scene.fog` (0.102). Both were added after
  the round-5 palette work the comment justifies.
- [ ] `src/scenes/outside/outside.js:449` — the curtain billow, called *"the
  entire effect"*, moves **peak 2/255, 0 px ≥8** over 35 seconds. `driftSpeed`
  advances the noise input by <1.0 in that time.
- [ ] `src/scenes/orbiter/orbiter.js:67` — `makeNucleusTexture` is uploaded with
  `colorSpace` unset (measured `""`). 2477 px change when set to sRGB. This is
  the failure documented at length in `outside.js:188-192` and fixed in four
  other scenes.
- [ ] `src/scenes/orbiter/orbiter.js:668` — the "faint" orbit rings have
  `depthWrite: true`, so they **erase** the additive cloud they claim to avoid
  diluting. 237 px, peak 135/255 when fixed.
- [ ] `src/scenes/butterfly/butterfly.js:766,808` — **reduced motion is ignored
  for 97% of the moving pixels.** The comment says the flag is re-checked where
  it is consumed *"so no code path can re-enable motion by forgetting about it"*;
  the grid distortion and 220 sprites never consult it. Under `reduce`:
  **205,155 px (26% of viewport) change by ≥8/255 in three seconds**.
- [ ] `src/scenes/sphere/sphere.js:734` — three orbiting lights run outside the
  `reduceMotion` guard. 101,604 px ≥8/255 over 4s with nothing else moving.
- [ ] `styles/main.css:1685` — under reduced motion the tile hover glow keeps
  `scale(1.04)` while the tile drops to 1, so the glow rings **4.3px outside**
  the artwork instead of on it.

### My own five, from today

- [ ] `src/scenes/scroll/scroll.css:268` — the swinging edge shadow: peak 7/255,
  **0 px ≥8** over the real signal range. Amplitude too small; the clip is not
  the cause (verified with `clip-path: none`).
- [ ] `src/scenes/scroll/scroll.css:321` — the patch wash slides by peak 8/255,
  72 px. It is visible (peak 46/255 when removed) but does not visibly move.
- [ ] `styles/main.css:671` — the smoke's emergence-from-behind-the-pill is
  0 px inside the pill for 92% of the cycle; `z-index:-1` is very nearly a no-op.
  Also `::after` has `animation-delay: 2.6s` with `fill-mode: none`, so for the
  first half of every hover **only one wisp exists**, against a comment claiming
  there is always one mid-rise.
- [ ] `src/scenes/medium/medium.text.js:150` — the vowel-share table does not
  reproduce from `scripts/medium-spell.mjs`. See the section above.
- [ ] `src/scenes/scroll/scroll.css:287` — *"only ever shows in the gaps between
  them"*: at 1440 the ambient light covers **32.7% of the viewport** with a patch
  on screen and no gap visible (69.7% of the side margins). True on a phone, false
  on a laptop.

---

## Tier 2 — dead, and documented as live

- [ ] `scripts/verify-{counts,css-invariants,aria,landing}.mjs` — all four use
  `import.meta.url === \`file://${process.argv[1]}\``, which **silently passes
  from any path containing a space**. Proved: with a real failure injected, no
  output, exit 0. `verify-links.mjs:465` and `verify-scroll-marks.mjs:189` both
  carry a paragraph forbidding exactly this and use `pathToFileURL`. Mitigated
  only because all four are also wired as build plugins.
- [ ] `scripts/verify-landing.mjs:82` — **the headline assertion cannot fail.**
  `used > h + 0.5` compares two expressions built from the same three terms;
  max measured `used - h` across the whole matrix is **−0.025**. Dropping the
  row-gap term from *both* budget and accounting still passes; dropping it from
  the budget alone fails 35. It detects asymmetric drift between two functions
  in one module, not the class of error it was written for.
- [ ] `scripts/verify-landing.mjs:50` — the "control kept here rather than
  imported, so that a change to tileLayout cannot quietly change what it is
  compared against" imports three of its four constants from `tileLayout.js`.
- [ ] `src/utils/tileLayout.js:96` — the tie-break compares `base` across
  candidates with different `v`, so "fewer rows" can pick the **smaller** drawn
  tile. Sweep of 245k viewports: 358 lose up to 3.64px, and **95 would fail
  `verify-landing`'s own worse-than-uniform predicate** — the gate's matrix
  samples none of them (they cluster at ~700–780 × ~990–1100).
- [ ] `src/scenes/psyshell/psyshell.object.js:107` — in the `palm` branch `az` is
  computed and discarded and `palmAz` reaches the geometry only through a ±1e-4
  nudge (≈0.02 px). The fan's orientation is always the `frame(d)` plane, never
  the random azimuth the code appears to choose.
- [ ] `src/scenes/medium/medium.css:14-31` — four custom properties declared,
  zero references, and they are scoped to `.medium-scene` while the elements
  they describe are appended to `document.body`.
- [ ] `src/scenes/medium/medium.html:20` — claims `.pm-scene-chrome` on three
  elements; none carries it (measured live: 0 in the DOM).
- [ ] `src/scenes/psyshell/psyshell.css:49,148,194` — opacity transitions on
  elements nothing ever animates, plus a reduced-motion block disabling them.
- [ ] `src/scenes/outside/outside.js:1602` — an empty `if (initialPieceId != null)`.
- [ ] Dead exports/imports: `tokenize` (crossLinkMatch.js:101), `LIST_PAD`
  (tileLayout.js:39, while verify-landing hardcodes `32`), `FULL_TEXT_THRESHOLD`
  / `WINDOW_CONTEXT` (resonanceExcerpts.js), `isRenderedField` (library.js:3),
  `ELEMENT_BY_KEY` / `fraunhoferFor` (apollo.js:7 — so **Fraunhofer letters never
  appear in the interactive scene at all**), `shaftSprites` / `fluorescentLights`
  (orrery.js:3316,3388), the `dvd` branches (library.js:735,768,1719).
- [ ] `src/scenes/orrery/orrery.js:3268` — `console.log('DIMS …')` on every
  full-mode mount. (Mine, from this morning's measurement.)

---

## Tier 3 — claims and counts the data outgrew

**Behavioural claims that are simply false:**

- [ ] `harmonics.js:369` — *"every multi-node cluster reaches ~0.97–1.00 phase
  coherence within ~5 simulated seconds and holds it indefinitely."* The 45-node
  giant component (59% of all nodes) settles at **R ≈ 0.22 forever** — frequency
  locked, phase splayed. Robust across three timesteps. The reduced-motion still
  image, which the same comment says shows "each cluster at its own shared
  brightness", spans 0.000–0.849 for that cluster.
- [ ] `harmonics.js:1368` — the sonification uses **3 of its 7 harmonics**, and
  **82% of nodes land on one pitch** (62 of 76 on 330 Hz). Nine never-coupled
  clusters, including the 45-node one, all sound identical.
- [ ] `apollo.js:410` — all three "measured on the real integer column grid"
  doublet figures are wrong. At 1400 columns there is **no saddle at all** (the
  comment says 32%); at 1126, none (says 23%). Root cause backwards: σ scales
  linearly with `bandW` and so does the separation, so the continuous profile is
  identical at every width — only the sampling *phase* changes, quasi-randomly.
  41% of widths in 700–1240 do resolve; 36 widths above 1240 do not.
- [ ] `apollo.text.js:466` — `SOLAR_MIXTURE`'s stated depth ordering **inverts on
  every phone-width band**: at 686 columns H-α goes from 2.0% to 23.6%
  transmission and calcium stops being deepest.
- [ ] `medium.text.js:15,129` — *"the arcs put every letter roughly the same
  distance from the middle."* Nearest T 0.0712, farthest N 0.4275 — **ratio 6.0**.
  Flattened ellipses are precisely the shape that is not equidistant. Stated twice.
- [ ] `medium.text.js:206` / `medium.physics.js:311` / `medium.lexicon.js:199` —
  *"the board cannot say goodbye on its own … that is the whole mechanism."*
  `stepWander` never bounds the hand; `WANDER_BOUNDS` only leans the cup. Measured
  over 6.7 simulated hours: the hand reaches y **0.8008** against a stated floor
  of 0.755, and the cup does enter GOODBYE's catchment. The conclusion holds — for
  a different reason (`FLAT.goodbye = 0.02` makes the dwell need 2.16s against
  0.05s of exposure). Three files attribute it to the wrong constant.
- [ ] `library.js:1434` — *"never fogs at any zoom level"* is false in portrait:
  at 390×844, `maxDist` 24.6 against `fog.near` 18. Measured 11/255 of fog.
- [ ] `harmonics.js:1601` — `theta0 += preview ? 0.0018 : 0.0006` with no `dt`, in
  a function that dt-scales everything else, in a file that documents fixing this
  exact bug 900 lines earlier. `STANDARDS.md:911` states the rule verbatim.
- [ ] `harmonics.css:59` — the sound toggle *"never collides with the panel"*;
  the panel has docked left since 2026-09-01 and the toggle paints over its text.
- [ ] `sphere.js:626` — the label-scale clamp `[0.5, 3.0]` **cannot bind** (camDist
  is clamped to [1.8, 6], so scale ∈ [0.633, 2.111]), while its comment calls the
  bounds tunable.
- [ ] `sphere.js:70` — "a random 60-character window"; `randomExcerpt` slices 55.
- [ ] `sphere.css:157` — "about a second in every twelve"; JS overwrites the
  duration with 9–16s on every link, so 12s never runs.
- [ ] `outside.js:479` — the curtain-radius guarantee does not hold as stated
  (camera reaches 30 units from a 690-wide plane). What actually prevents the
  failure is unstated: the camera always looks at the origin.
- [ ] `beamline.js:1236` — both stated camera-clearance figures are stale
  (recomputed 16.29, not 15.35 or 7.24).
- [ ] `beamline.js:1381,1393,2295` — 327,680 vertices → **328,833**; 2,928 → 2,989;
  "about three quarters of frames do no colour work" → **52%**.
- [ ] `beamline.js:1479` — "~350 strands" → **231**.
- [ ] `medium.physics.js:139` — the visitor's force cap is **12.48**, not 5.9
  (`LEAN_GRIP` was added and never folded back in). 6.6× the partner, not 3×.
- [ ] `medium.physics.js:80` — the 0.046 standoff recomputes to **0.0731**;
  measured dynamically 0.0988.
- [ ] `medium.physics.js:375` — a paragraph describing `stepCup`'s return value
  sits directly above its own retraction. It returns `undefined`.
- [ ] `medium.physics.js:5` — cites `medium.physics.test.js`, which does not exist.
- [ ] `medium.lexicon.js:176` — "used in two places"; used in one, and the file
  says so itself sixty lines later.
- [ ] `psyshell.js:78` — "252 segments" → **144**; ":429 250 instances" → 174.
  This is the stated derivation for `CRYSTAL_GAIN` and `FILAPIXEL_PEAK`.
- [ ] `psyshell.js:525` — "fourteen bridge strands" → **70**.
- [ ] `psyshell.rush.worklet.js:59` — "about a semitone" → **1.90 semitones**.
- [ ] `medium.js:265` — the same paragraph twice, the two copies disagreeing about
  whether the preview visitor circles or rests. No circle exists.

**Counts:** harmonics.js 375/440/476/1760/1827/990 and harmonics.html:13;
library.js 48/367/637/660/1207/1665; beamline.text.js:17; main.js 852/900/979/982
and tileLayout.js:18 ("all twelve tiles", "Twelve fit"); main.css 439/509/1229/1460;
registry.js 150/140/173/108; index.html 336; links.js:106 ("library (85)" → 4);
resonances.js:89 ("All 22 rows" → 64); sceneKit.js 556/620; sceneField.js
(12 of 13 scenes); psyshell.js 942/1264; orrery.js 833/1169/1524/1606/2301/2417.

---

## Tier 4 — build, deploy and docs

- [ ] `public/.htaccess:86` — the CSP was enforced after a Report-Only pass over
  *"all ten scenes"*. There are 13; four were never in the evidence.
  `verify-counts` has a rule for this phrase and misses it **only because the
  claim wraps a line** — joining the two lines makes the gate fail immediately.
- [ ] `verify-counts.mjs` — line-at-a-time matching misses every comment-wrapped
  claim (proved on `.htaccess:86`, `resonances.js:89`, `library.js:637`), and it
  has no rule shape for `── section (n) ──` subtotals (`links.js:106`).
- [ ] `verify-css-invariants.mjs:167` — check 3 iterates scene stylesheets only;
  `styles/main.css` is appended for check 2 but not check 3, while the pass line
  says *"every translucent text colour can reach AA."* Latent today. It also
  cannot see `opacity`-based dimming, which is how `.nav-icon` gets its contrast.
- [ ] `verify-css-invariants.mjs:210` — check 4 reads only the desktop var and
  requires a literal centring idiom, so **Apollo's mobile rule is skipped
  entirely**. main.css:234 overstates what it enforces.
- [ ] `verify-aria.mjs` — names three accounts of a scene; there is a fourth,
  `SCENES[].label`, written into the page's only `<h1>`. Nothing checks it and it
  has drifted: `sphere.label` is an instruction sentence where the other twelve
  are titles.
- [ ] `deploy.yml:161` — the live-header step fetches only the canonical https
  apex, so it never produces a 301, so the `always` flag that `.htaccess:196`
  calls *"load-bearing"* against redirects is never tested.
- [ ] `deploy.yml:144` + `.htaccess:224` — both still describe HSTS at
  `max-age=300` awaiting a ramp; `.htaccess:298` has shipped 31536000 since
  2026-09-02.
- [ ] `STANDARDS.md:349` — flexbox "sidesteps the whole problem" of the trailing
  letter-space. It does not; the negative `margin-right` does. Independently
  re-measured: removing only the margin moves the title 1.68px, exactly half the
  3.36px tracking.
- [ ] `STANDARDS.md:517` — "two scenes are absent"; four are.
- [ ] `STANDARDS.md:126` — "all four gates in about a second"; eight gates, 10.9s
  warm build, 19.5s for the verifiers standalone.
- [ ] `SITE.md:150` — "the floor is 168px"; `TILE_FLOOR = 152`.
- [ ] `SITE.md:146` — the worked layout example is wrong in every number.
- [ ] `vite.config.js:330,374` + `.htaccess:56` — "~565kB" three.js chunk; 576.05kB.
- [ ] `verify-css-invariants.mjs:5` — "all three checks"; there are four.
- [ ] `WORKING-PROTOCOL.md:178` — "Four separate mechanisms"; eight bullets follow.
- [ ] `main.css:1-30` — the stacking-order table omits three live z-index levels.
- [ ] `main.css:1059,1076` — a 1200px breakpoint that does not exist.
- [ ] `main.css:1141` — three claims about a 480px tier that does not exist.
- [ ] `main.css:1345` — two claims about rules deleted at 4.11.19/4.11.20.

---

## What came back clean

Worth recording so the next pass does not re-tread it. Sphere/butterfly category
1 (every visual layer isolated and measured painting); orbiter's entire
mathematics (P(r>1.35) = 1.08%, the direction-sampling figures to three digits,
`F_MAX`/`R_MAX`); outside's texture work (the `flipY`/sRGB pair verified by
repainting the canvas with a positional marker — the seam glow really is at the
root); orrery's astronomical data (every `au`, `relDiameter`, `e` and `m0Deg`
spot-checked against JPL, including M0 = L − ϖ at J2000); apollo's remaining
physics (Balmer limit, the 0.597nm split, the 0.5154Hz beat, the ybar peak, the
rolloff figures, all 16 Fraunhofer bindings); theater's bubble placement (0
escapes, 0 overlaps across 614 bubbles at two viewports) and its De Morgan
rewrite at 16 boundary viewports; setPaused and visibilitychange (11 rAF loops
on the landing page, exactly 1 with any scene open, 11 again on return);
dispose (three mount/dispose cycles × 13 scenes, zero net listener drift);
prng.js (FNV-1a verified against the canonical constant); the per-tile layout
application (the 4.11.16 bug is genuinely fixed); all 13 tile aria-labels
matching `tileAria()` verbatim with zero dangling idrefs; `.pm-panel-close` at
7.74–7.77:1 over all five panels; the nav fit thresholds at 13 scenes (overflow
ends at exactly 656px, gap reaches 2.5rem at exactly 1216px); the `/text/` CSP
hash check, which does now test a page outside the SPA from two independent
sources; and all 20 bardjs tests.
