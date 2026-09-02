# perceptual mechanics — audit punch list

*Standing best-practices review, 2026-09-01. Audited v3.16.2 (commit `109b53c`).
71 findings. Eight are live on the production site. 11 of the top 12 were reproduced
in a browser this session rather than inferred from reading.*

Read `STANDARDS.md` first throughout — nothing here re-litigates a decision the project
has already reasoned out. Six candidate findings were dropped during verification
because the code didn't support them.

---

> ## STATUS — read this before reading the findings
>
> **This document is a snapshot taken on 2026-09-01, before v4.0. Almost all
> of it is now history.** Sixty-three of the seventy-one findings were fixed
> across v4.0, v4.0.1, v4.0.2 and v4.0.3; the reasoning, the measurements and
> the things that turned out differently in practice are in `NOTES.md`'s 4.x
> entries, which supersede this file wherever they disagree.
>
> It is kept because it is the only record of what an outside-in look at this
> project actually surfaces, and because the evidence attached to each finding
> — what was reproduced in a browser versus read from the code — is worth more
> than the finding itself. **Read it as a survey, not as a to-do list.**
>
> **Two findings in here were simply wrong**, and are left uncorrected below so
> the correction is visible rather than quietly tidied away:
>
> - **Finding 19, the seven "broken" Theater gestures, was a grep artifact** —
>   `g: '…'` matches the tail of `tag: '…'`. Every authored gesture always
>   resolved. There was a real gap underneath it (seven characters name a prop
>   and all stood in the same neutral figure), which 4.0 implemented through
>   the mechanism that actually carries it, but the finding as written was
>   false.
> - **The cache-control finding was overstated.** DreamHost already served 30
>   days on `/assets/`; the real gain was `immutable`, not the absence of any
>   caching.
>
> ### What did NOT close
>
> Current as of v4.0.3. The maintained list lives in
> `perceptualmechanics-project-brief.md` under "Known open items" — if this
> and that disagree, that one is right.
>
> 2. ~~**The CSP report endpoint is a placeholder** that 404s.~~ **Closed
>    2026-09-02 as a decision rather than a fix (v4.2.1): the directives were
>    removed, not completed.** No server; Reporting-Endpoints is Chromium-only;
>    and most CSP reports in practice are browser extensions, which is a poor
>    thing to send a third party and a poor log to own. The reasoning is in
>    `public/.htaccess`. What reporting was wanted for — the unstyled `/text/`
>    pages — is now caught deterministically by the deploy, which hashes the
>    `<style>` block out of the served bytes and asserts it against the policy
>    on the same response. Worth reading that entry before re-proposing a
>    collector: for this failure the check is strictly better, because it is
>    pre-hoc and certain where a collector is post-hoc and probabilistic.
> 3. **Library's shelf is still 535 draw calls** (down from 1,603). Going
>    further breaks per-mesh raycast, the hover scale bump and per-spine
>    emissive glow at once; it needs a hover mechanism designed first.
> 4. **Library still builds 265 spine canvases in one synchronous task** at
>    scene open — ~4× cheaper in raster work now, still one long main-thread
>    block. Chunking it makes spines pop in, which is a taste decision.
> 5. **One Orrery navigation quirk**, kept deliberately: two rings' low arcs
>    leave a 0.46-unit gap a 0.6-unit-wide visitor can be pinched into.
>    Backing up frees you. Being unable to squeeze between two rings is
>    correct; a smaller collider would restore the walk-through it replaced.
> 6. **`catalog` is private only in the sense of not being rendered** — it
>    ships inside the public JS bundle, as every note did before 4.0.2.
> 7. **The `/text/` pages publish no Library notes** while the scene now shows
>    53. Deliberate, but now a decision awaiting Scott rather than a
>    consequence of the scene's behaviour.
> 8. **`createJumpList` still takes a flat list**, so Library carries its own
>    grouped nav — the one place in 4.0 where a scene reimplements something
>    shared.
>
> Vite is no longer among these: v4.1.0 took the 6 → 8 upgrade. Everything
> through **v4.1.0** is deployed and confirmed live (2026-09-02), by matching
> all 29 hashed asset names on the landing page against the Vite 8 build.
>
> **One thing this audit counted without checking.** Finding 22 counted nine
> live WebGL contexts and eight preview loops that never stopped, and 4.0
> fixed the stopping. It never asked whether all eight were ever *starting*.
> On 2026-09-01, three landing tiles were seen blank — two of them holding a
> canvas that proves no frame had ever completed — and they were inside that
> count the whole time. Same shape as the 2.9 MB hare: the accounting
> measured the thing it had gone looking for. The current state of that
> finding lives in the project brief under "Genuinely open"; the Butterfly
> half of it is understood, the other half is not currently reproducible.

---


## 1. Broken on the live site now

### 01 — Every `/text/` page has been unstyled in production since v3.12.1
`scripts/prerender.js:105–178` · `public/.htaccess:90` — **shipping bug, verified in production**

`page()` emits one inline `<style>` and links no external stylesheet. The CSP says
`style-src 'self'` — no hash, no nonce — so the browser drops it. All eight prerendered
pages render as Times black-on-white with no max-width.

Evidence: loaded `perceptualmechanics.com/text/`. The page carries a 3,984-byte `<style>`
and `document.styleSheets.length === 0`. Console:

> Applying inline style violates the following Content Security Policy directive
> `style-src 'self'`. Either the 'unsafe-inline' keyword, a hash
> (`sha256-B0wK80VpvQKVTrSyRQWgYS5EDa9fLFXKQxpDRnN2Ng8=`), or a nonce is required.

Fix: add that hash to `style-src` — but a hand-maintained hash is exactly the derived
artifact the standing rule forbids. Have the prerender plugin compute the SHA-256 of the
style string it just emitted and `this.error()` on drift. The Report-Only pass was a
complete audit of the SPA at `/`; it just never opened a page outside it.

### 02 — Leaving Harmonics with sound on strands a live `AudioContext`, and they stack
`src/utils/sceneKit.js:262–269` · `harmonics.js:1252` — **shipping bug, reproduced live**

`bindPersistedSoundToggle` attaches a `pointerdown` listener to `container` and returns
nothing — no `dispose()`. `container` is `#experience-container`, which `main.js` only
empties, never replaces, so the listener outlives the scene. One pointer-down in any later
scene fires the dead scene's `setSoundEnabled(true)`. Harmonics nulls `audioCtx` on
dispose, so it builds a brand-new context and starts 122 oscillators nothing can close.

Evidence: instrumented `AudioContext` on the dev server, ran Harmonics → gallery →
Butterfly → click four times. **4 orphaned contexts in state `running`** while sitting in
Butterfly; 8 constructed in total. Chrome caps a page at ~6 — after that the constructor
throws, unhandled.

Fix: return `{ dispose() }` from the helper and call it from both scenes; add a `disposed`
guard inside each scene's `setSoundEnabled` so a stale call is a no-op regardless.

### 03 — Outside's variant is quieter and worse: a `setInterval` nothing can clear
`src/scenes/outside/outside.js:1012–1022, 1405` — **shipping bug, reproduced live**

Same stale listener, different dispose: Outside calls `audioCtx.close()` but never nulls
it, so `buildAudioGraph()` early-returns. What does happen is `startAmbientScheduler()` —
whose only guard is `ambientSchedulerId != null || !audioCtx`, and after dispose the id is
null while the closed context is still truthy. A fresh interval starts on a dead closure,
and `stopAmbientScheduler` is only reachable from the scene that's gone.

Evidence: console from inside Butterfly, immediately after the pointer-down — a burst of
"Construction of OscillatorNode is not useful when context is closed" and "Connecting nodes
after the context has been closed."

Fix: same as 02. The asymmetry itself is worth noting: two scenes call one helper and fail
differently because one nulls a variable and the other doesn't.

### 04 — On a 375px phone the first and last nav icons are cut off; at 320px they're gone
`styles/main.css` (nav icon sizing) — **shipping bug, reproduced live**

Ten icons at 34px with a 5.6px gap need 390.4px. `#pm-nav` has zero padding and
`justify-content: center`, so below that it overflows symmetrically off both edges rather
than wrapping, shrinking, or scrolling. This is the four-times-recurred regression
`NOTES.md` warns about, back at the most common iPhone width.

Evidence:
- 375 × 812 — first icon at `left: −8`, last at `right: 383`. **8px clipped each end.**
- 320 × 720 — **35px clipped each side.** Sphere and Outside are entirely off-screen.
- Every icon is 34 × 38, below the 44 × 44 touch-target minimum.

Fix: below ~400px, wrap to two rows or shrink the icon box. Add a check at 320/360/375,
since "icon count changed" has caused this four times.

### 05 — Escape with a panel open exits the whole scene instead of closing the panel
`src/main.js:455–457` · `src/utils/sceneKit.js:282–286` — **shipping bug, reproduced live**

Both handlers are on `document` and neither stops propagation. `main.js` registers at
module evaluation, before any scene mounts, so it wins.

Evidence: deep-linked to `#sphere/3`, confirmed `class="sphere-panel open"`, dispatched
Escape → hash `""`, overlay class `""`, landing back to `display: flex`.

Fix: have `bindEscapeClose`'s handler `stopPropagation()` when it acted, or give `main.js`
a `fullInstance.hasOpenPanel?.()` check.

### 06 — A 2.9 MB hare loads on every visit to fill a 36 × 31 px box
`public/hare-colophon.png` · `colophon.html:13` · `colophon.css:39` — **perf, verified in production**

`initColophon()` is a static import called unconditionally, so `.colophon-mark` is in the
DOM on every load of `/`. Source is 2135 × 1839; it renders at 36 × 31 CSS px. Requested
twice — once by the `<img>`, once by the CSS `mask-image` — with no `width`/`height`,
`loading`, or `decoding`.

Evidence (production resource timing): PNG **3,036,690 bytes** against **277,502 bytes of
JS for the whole site**. Starts at 430 ms, takes 1,485 ms, carries `loadEventEnd` to
1,995 ms. The image is 91% of page weight. The 3.10.x arc deferred 82 kB of gzip; this is
36× that, and was never in the accounting because the accounting counted JS.

Fix: resize to ~150 × 129, ship WebP with a PNG fallback (expect 15–25 kB, >99% cut).
Point the mask at the same file, add explicit dimensions, move the original to `artifacts/`.

### 07 — A rejected `import()` bricks the site until reload
`src/main.js:337–362, 85–88, 506–510` — **shipping bug, code-verified**

Likeliest trigger: a returning visitor whose cached `index.html` points at a hashed chunk a
deploy replaced. On rejection `loadingTimer` is never cleared (spinner forever) and
`transitioning` is never reset — and both `expandScene()` and `returnToGallery()` open with
`if (transitioning) return`, so every click, hash change and Escape becomes a silent no-op.
`sceneModulePromises[name] ??= entry.load()` then caches the rejected promise, so retrying
can't work either.

Fix: a `.catch()` that clears the timer, resets the flag, removes `.pm-loading`, and renders
a real message in `#experience-loading`; delete the cache entry on rejection;
`Promise.allSettled` in `initPreviews`. There is currently no error UI at all for the site's
most likely runtime failure.

### 08 — A word inside a published art piece was corrupted by a global rename
`sphere.text.js:41` · `links.js:53` — **content bug, verified in source**

Sphere fragment 7 reads "There is nothing to be drawn from **harmonicss**, arbitrary
abstract lines." The doubled *s* is the fingerprint of the 2026-08-18
*constellations → harmonics* pass reaching into found text. `verify-links` passes because
the rename corrupted the phrase in `links.js` identically — corrupt against corrupt.

Fix: restore the original word in both files (they must stay byte-identical). Consider a
lint that fails when a scene key appears inside `.text.js` prose.

*Resolved 2026-09-02:* restored to `constellations` in both files. The bare "harmonics" in
`beamline.text.js:68` was flagged here as worth an eyeball — Scott confirmed it is original
prose, not rename damage. Settled, not an open question.

---

## 2. Accessibility

### 09 — Six invisible links and buttons sit in the tab order on every page load
`colophon.css:78–90` — **reproduced live**

The closed colophon uses only `opacity: 0` and `pointer-events: none`. It's appended to
`document.body` after `#experience-overlay`, so `setChromeInert()` doesn't cover it either.
Enumerated in the browser: ✕, the Patreon line, Abby Williams, YouTube, "read the writing on
its own", and the mailto are all focusable while invisible. Its `<h2>` and four `<h3>`s are
in the heading tree too.

The same shape applies to every scene panel — I focused `.sphere-panel-close` while the
panel was translated off-screen with `pointer-events: all`, and it took focus.
`orrery.css`, `orbiter.css`, `library.css` match.

Fix: `visibility: hidden` on the base rule, `visible` on `.open`, transitioned at `0s .35s`
— or toggle `inert`.

### 10 — The sound toggle in Harmonics and Outside can't be reached by keyboard
`src/main.js:248–251` · `harmonics.html:34` — **reproduced live**

`overlayFocusables()` queries only inside `#experience-container`, and the trap wraps from
the last match back to the first. Both sound toggles are deliberately appended to
`document.body` per the z-index scale. Confirmed: `.outside-sound-toggle`'s parent is
`BODY`; `#experience-container .outside-sound-toggle` matches nothing.

Fix: mark body-level scene chrome with a shared class (`.pm-scene-chrome`) and include it in
`overlayFocusables()`, ordered after the container's own.

### 11 — While a scene is open the document has no `<main>` and no heading
`index.html:111` · `src/main.js:315` — **reproduced live**

Inside `#sphere` the landmarks were `NAV` (itself `aria-hidden="true"`) and `MAIN(hidden)`.
The only headings in the tree belonged to the closed colophon.

Fix: give `#experience-overlay` an `sr-only` heading from `SCENES[name].label` — which
exists in the registry and currently has no reader anywhere.

### 12 — Reduced motion: seven exceptions, each the loudest motion in its scene

| Scene | What still moves | Where |
|---|---|---|
| Harmonics | Kuramoto integration + all 61 nodes' brightness pulse — the thing the file's own header calls the carrier of the scene's meaning | `harmonics.js:1305–1354` |
| Orbiter | Orbital cloud opacity "breathe" | `orbiter.js:1085–1088` |
| Butterfly | One drag re-enables jitter permanently (`autoJitter = true` unconditionally) | `butterfly.js:371` |
| Sphere | 320 face labels running `wisp` infinite; and killing `silk-glimmer` removes the *only* affordance a cross-link has | `sphere.css:12, 119` |
| Orrery | Control-box idle pulse, in preview tiles too; no `prefers-reduced-motion` block in the stylesheet at all | `orrery.js:3425` |
| Scroll | `scrollIntoView({behavior:'smooth'})` across twelve tall patches | `scroll.js:535` |
| Theater | Reel auto-plays at mount; four transitioned selectors missed by the `animation: none` block | `theater.js:225` |

Reduced motion is also sampled once at mount everywhere; a `matchMedia(...).addEventListener('change')` would make the OS toggle live.

### 13 — Orrery's movement keys swallow arrow keys while the panel is open
`orrery.js:2417–2423` · `orrery.css:20`

`onKeyDown` is on `window` and `preventDefault()`s arrows unconditionally, with no panel
guard. The panel is `overflow-y: scroll` and holds the full found story; `openPanel()` moves
focus into it. A keyboard visitor opens the panel via the jump list — the only accessible
route in — and then can't scroll it, while the camera walks around behind them.

Fix: early-return from `onKeyDown`/`onKeyUp` when the panel is open, and drop the movement
flags at the same moment.

### 14 — Contrast: measured failures

| Element | Ratio | Needs | Where |
|---|---|---|---|
| `.sphere-facet-id` — "Fragment N of 25" and the cross-reference line | 1.98:1 | 4.5:1 | `sphere.css:109` |
| `#site-title` over a bright scene | 1.77:1 | 4.5:1 | `main.css:407, 420` |
| `.library-panel-refs` — the "Referenced from" line | 2.10:1 | 4.5:1 | `library.css:169` |
| `.colophon-sub` | 2.98:1 | 4.5:1 | `colophon.css:129` |
| Panel ✕ — same rule copy-pasted in four scenes | 3.78:1 | 4.5:1 | orrery / orbiter / library / sphere |
| `.nav-icon` idle, 1.3px stroke | 3.00:1 | 3:1 | `main.css:340` |

The `#site-title` one contradicts its own comment, which claims a 0.4-alpha scrim is
"scene-brightness-agnostic." Over a white scene the composite is `#999`.

### 15 — The rest of the accessibility list

- Nav `aria-label="Sphere"` overrides `title="The Sphere — Interconnected Text Fragments"`. Screen readers get the terse name; the preview tiles already do this right. (10 icons)
- Harmonics never moves focus into the panel; its `tabindex="-1"` target is dead code. Orbiter does it correctly in both branches. (`harmonics.html:41`)
- Harmonics jump list reads "Piece 1"…"Piece 61". Real titles are already warmed at mount by `loadResolveEndpoint()`. (`harmonics.js:1097`)
- Library's jump list is 265 sequential stops with no grouping or skip — WCAG 2.4.1. (`library.js:1567`)
- Orrery's touch walkpad puts four real buttons inside `aria-hidden="true"` — WCAG 4.1.2. (`orrery.html:38–43`)
- Beamline and Butterfly mark their own found text `aria-hidden`. Hiding the hint is right; hiding the epigraphs isn't. (`beamline.html:13`, `butterfly.html:9`)
- Beamline's station label has no Escape-to-dismiss — the one scene not going through `bindEscapeClose`. (`beamline.js:1572`)
- Theater's speech bubble is `overflow-x: auto` with `pointer-events: none` and no tabindex — a scrollbar nothing can scroll. (`theater.css:187`)
- Skip link targets `#landing`, which is a router hash and is `display:none` mid-scene; `#landing` has no `tabindex="-1"`. (`index.html:74`)
- `setChromeInert` hand-rolls `tabindex` + `aria-hidden` on native buttons; `inert` does both and can't drift. The fullscreen toggle is inerted exactly when a keyboard user most wants it. (`main.js:234–240`)
- `:focus` where `:focus-visible` is meant in three chrome rules; four different ring colors; `.colophon-close` has no focus style at all. (`main.css:351, 425, 791`)

---

## 3. Correctness & robustness

### 16 — Frame-counted animation runs at double speed on a 120 Hz display

Beamline's is not cosmetic: `computeSustain()` derives a *reading duration* from
`WORDS_PER_SECOND = 2.3`, then compares it against a `tSec` advancing by `1/60` per frame.
On a ProMotion Mac the 116-word "THE MIRROR" passage gets 25 seconds instead of 50 — an
effective 4.6 words per second.

| Scene | Symptom at 120 Hz | Where |
|---|---|---|
| Beamline | Every station's reading window halved; Lévy step cap and label fade halved | `beamline.js:2005` + ~30 sites |
| Orbiter | Every rotation, drift, jitter and ease at 2× (`t += 0.01`) | `orbiter.js:1051` |
| Library | Babel shimmer at 2× (`babelT += 0.016`) | `library.js:1645` |
| Orrery | Asteroid belt and "unknowns" at 2× while the Kepler planets stay correct — the belt visibly outruns the Mars/Jupiter speeds it was derived from | `orrery.js:3213, 3275` |

Fix: one clamped `dt` helper in `sceneKit` — `Math.min(0.05, (now − last)/1000)` — and
multiply each tuned rate by `dt/0.01667` so today's 60 Hz look is preserved exactly.

### 17 — Orbiter and Library are the two raycast scenes missing `bindTapVsDrag`
`orbiter.js:1012` · `library.js:1497`

The helper exists for exactly this and is used by Orrery, Outside, Sphere, Harmonics and
Beamline. On a phone every orbit gesture ends in a synthetic click at the release point — so
spinning the shelf opens whatever spine was under your finger.

### 18 — 81 of the Library's 85 cross-links point at a field the scene doesn't render
`library.js:1409` · `links.js:111–146`

Withholding `note` is a documented, correct decision. But the links were authored against
it, and `getInboundLinks()` is field-agnostic — so the outbound half renders nowhere while
the inbound half still prints. *Throne of Blood*'s panel says "REFERENCED FROM SEVEN
SAMURAI"; *Seven Samurai*'s panel has nothing to click. 45 items show that line; for 41 of
them every inbound link originates in an unrendered field.

Fix: pick one — filter `getInboundLinks` to rendered fields, move the ~40 relationships onto
`excerpt`/`scene`, or re-enable notes. Then export a `RENDERED_FIELDS` set that
`verify-links.mjs` imports, so a link into a withheld field fails the build.

### 19 — Seven authored gestures name poses that don't exist
`theater.js:57–67` vs `theater.text.js`

`POSES` defines nine. The script authors seven more lines using `goth` (×2), `wheelchair`,
`violin`, `negligee`, `cello`, `briefcase` — all falling through `(POSES[mask] ||
POSES.idle)`. Three mirror character `tag`s in the same file, so the intent is unmistakable.

Same file: `Object.assign({}, ...PIECES.map(p => p.characters))` flattens three plays into
one namespace with no collision guard. Zero collisions today; a fourth play with a
`narrator` would silently take over.

### 20 — Scene state is written onto the shared container and never restored

Seven scenes set `container.style.position` and `overflow`; Orrery sets `cursor: 'none'`;
Sphere and Library set `tabIndex` and leave `cursor: pointer`. Only Orrery resets anything.
Leaving Orrery for Theater, Scroll, Butterfly or Outside hands you an invisible mouse
pointer. Well past the "third scene" threshold for a `sceneKit` `claimContainer()`.

### 21 — Smaller correctness items

- Orrery's ring colliders guard only the two eye-height crossings. Pluto's ring descends to 0.35 units above the floor; you walk through most of the lower arc of four rings. (`orrery.js:3163–3186`)
- Orrery's brick texture maps to 1.56 × 0.29 world units — 1.5-metre bricks at 5.4:1 on a walkable wall. Walls span `span*2` = 40 units where `wallDist*2` ≈ 17 would do. (`orrery.js:1456, 1690`)
- Orrery's dust motes keep their spawn radius as they rise, so the light shaft relaxes from a cone into a cylinder within a minute or two. (`orrery.js:1962, 3301`)
- `wireCrossLinks` uses first-occurrence `String.replace` on accumulated HTML including markup injected by earlier rows. Zero collisions today; 38 phrases are ≤12 characters and two are a bare em dash. (`sceneKit.js:407–416`)
- Beamline's `showLabel()` awaits fonts with no disposed-guard — leaks a texture and writes to a torn-down scene. Sphere and Butterfly both have the flag. (`beamline.js:1543–1571`)
- ~15 untracked `setTimeout`s across six scenes. Library's 500 ms side-flip is the live one: leave within half a second and `populatePanel` calls `onPieceChange`, so a scene you've left rewrites the URL hash. (`library.js:1536`, `main.js:360`)
- Auto-rotate resume timers aren't cleared on a second drag, so the first re-enables rotation early. (`harmonics.js:1019`, `orbiter.js:1038`)
- Under reduced motion an Outside touch pulse never expires — `elapsed` is pinned at 0, so a bright spot freezes on the flower. (`outside.js:723, 1253`)
- Library's zoom range is derived once from `camera.aspect`; rotating a phone to portrait runs the shelf's edges off-frame with no zoom able to recover them. (`library.js:1210–1225`)
- Hover state is never cleared on pointer-leave in Harmonics and Orbiter; Orbiter's click handler then branches on the stale target. Outside does it correctly.
- `#scene/id` → `#scene` can't close the open piece — the branch does nothing when `pieceId` is null. (`main.js:277–284`)
- An unknown hash leaves junk in the address bar with no feedback. (`main.js:170–179`)
- `returnToGallery()` doesn't check `prefersReducedMotion()`, so it runs a dead 600 ms pause — `expandScene()`'s own comment says not to do this. (`main.js:404–423`)

---

## 4. Performance

### 22 — Nine WebGL contexts alive at once; eight preview loops never stop
`main.js:99, 493–513` + every scene's `dispose()`

`const previews = {}` is written at line 509 and never read — the ten preview instances are
constructed once and never disposed or paused. `display: none` does not stop
`requestAnimationFrame`, so all eight WebGL previews keep rendering at 60 fps behind an
opaque overlay, alongside the scene you're looking at, and in a background tab.

Evidence: counted with Sphere open — **9 `<canvas>` elements**. A repo-wide grep finds zero
calls to `forceContextLoss`, and three.js's `dispose()` does not release the context, so
scene switches orphan contexts until the browser force-loses the oldest (the landing tiles).

Fix, increasing payoff: `renderer.forceContextLoss()` after `dispose()`; a
`previews[name].setPaused()` convention driven from `expandScene`/`returnToGallery` (the map
already exists and is dead); an `IntersectionObserver` per tile. A `pagehide` handler would
also let contexts and audio go on navigation away.

### 23 — Where the frame time actually goes

- **Library** — 265 spines × a 6-material `BoxGeometry` = **~1,590 draw calls/frame**, plus ~69 MB of spine canvas textures (~92 MB with mipmaps) for spines drawn at ~20 × 140 px. The Babel backdrop (197 nodes, 1,182 edge instances, ~1,700 `setColorAt` calls/frame) is not preview-gated and runs inside the 200px thumbnail.
- **Butterfly** — 867 separate `THREE.Line` objects + 220 individually-materialed sprites ≈ **1,090 draw calls** to render ~5,000 vertices.
- **Harmonics** — a 400-iteration O(n²) relaxation (~732,000 vector ops) runs synchronously at *every* mount, including the landing preview, concurrently with nine other scenes' setup. It is fully deterministic and therefore trivially cacheable. Separately: 183 `setTargetAtTime` calls per frame, ungated by the toggle, because `soundEnabled` is assigned and never read.
- **Sphere** — 320 labels: a style write on label N followed by a `clientWidth` read on N+1 forces **~320 synchronous layouts per frame**, plus ~1,600 allocations. This dominates the scene, not the WebGL.
- **Outside** — 1,008 vertex iterations + 7 `computeVertexNormals()` + 7 `computeBoundingSphere()` every frame; the color buffer re-uploads unconditionally though colors only change during a 1.6 s pulse. Under reduced motion every value is bit-identical to the previous frame and it all still runs.

### 24 — Seven scenes render 9× the pixels they need on a phone

`beamline.js:1193` already does `setPixelRatio(Math.min(2, window.devicePixelRatio))`.
Nobody else does. Worst exactly where it hurts: Orrery, Harmonics, Library, Outside.
One-line change per scene, matching an in-repo precedent — and re-apply it in the resize
callback.

### 25 — Pointer-rate work that should be frame-rate work

Library raycasts 265 meshes *and* calls `getBoundingClientRect()` on every `mousemove` — a
forced layout at up to 120 Hz. Outside raycasts up to 240 triangles per petal on every
`pointermove`, including throughout every touch-drag. Harmonics and Orbiter do the same in
smaller form. In all four the result is read exactly once per rendered frame.

### 26 — Smaller performance items

- Orrery's preview mode builds every metal texture then throws it away unused; aged-planet geometry (~800K hash calls per planet) runs unconditionally for 5 preview planets. (`orrery.js:126–200, 1103`)
- 144 individually-drawn bolt meshes with 9 duplicate geometry/material pairs, all identical in radius. (`orrery.js:678–690`)
- Beamline's NEAR tier re-uploads its full 26 KB color buffer every frame forever — the easing asymptotes but never reaches target. (`beamline.js:1944–1954`)
- Harmonics allocates `theta.slice()` plus ~3,700 closures per second in the Kuramoto loop. (`harmonics.js:1310–1318`)
- Per-frame object literals and arrays: `{x:0,y:0}` to the raycaster, `stations.map()`, `posters.map()`, `['x','y','z']` inside a 220-sprite loop.
- Scroll stacks three costs on one scrolling surface: a full-viewport `feTurbulence` with `mix-blend-mode: multiply`, twelve always-animating blended `::after` glows, and a five-function filter chain per patch. `content-visibility: auto` would skip the off-screen ones. (`scroll.css:110, 218`)

---

## 5. Build, deploy, security, CI

The content-integrity gates are doing their job — `verify-links` and `verify-resonances`
genuinely run from vite plugin hooks and genuinely fail CI. These are the gaps around them.

### 27 — Six standard security headers are still missing; CSP is the only one set
`public/.htaccess`

Fetched live: no `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`, `X-Frame-Options`, or `Cross-Origin-Opener-Policy`.

```apache
<IfModule mod_headers.c>
  # Ramp HSTS. 300s first, confirm nothing breaks, then 31536000.
  # No `preload` — effectively irreversible. includeSubDomains omitted
  # deliberately: shared hosting, and a future non-HTTPS subdomain would go dark.
  Header always set Strict-Transport-Security "max-age=300"
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  # fullscreen=(self) is load-bearing — main.js uses the Fullscreen API.
  Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)"
  Header always set X-Frame-Options "DENY"
  Header always set Cross-Origin-Opener-Policy "same-origin"
</IfModule>
```

`always` on each matters — without it the header is dropped on exactly the 301 responses
where HSTS counts. Deliberately excluded: `COEP: require-corp` would break the
YouTube-nocookie iframe, `i.ytimg.com` thumbnails and `covers.openlibrary.org` that the CSP
allows, and buys nothing without `SharedArrayBuffer`.

Also worth adding now that CSP is enforcing: a `report-to` endpoint. Findings 01 and 02 are
precisely the failure a reporting endpoint catches.

### 28 — The bard.js demo ships to production and is broken by the same CSP
`packages/bardjs/demo/index.html:7, 314` · `vite.config.js:101`

A real Rollup input, so `dist/packages/bardjs/demo/` exists and gets rsynced. Its 7,599-byte
inline `<style>` is blocked, and its `<script type="importmap">` is both blocked and dead
(Vite already rewrote the entry to a bundled chunk). Unlinked from the site and already
`Disallow`ed in robots.txt. Dropping `bardDemo` from the inputs removes a broken page, a
chunk from `dist/assets/`, and a console error, in one line.

### 29 — Sixteen passing tests exist and CI never runs them
`.github/workflows/deploy.yml` · `packages/bardjs/test/fountain.test.js`

The suite passes in 51 ms. The root `package.json` has no `test` script and `deploy.yml` has
no test step. bardjs isn't a toy: `theater.js` imports `Player`, `compileLegacyScript`,
`shuffle` and `asciiBubble` from it — the Theater scene's entire timing engine.

Fix: `"test": "npm test --workspaces --if-present"` at the root, plus one step before Build.

### 30 — The rest of the build and deploy list

- **No `permissions:` block** in the workflow. It needs only checkout and handles the production SSH key. `permissions: contents: read`.
- **Actions on floating tags** — `checkout@v4`, `setup-node@v4`. A re-pointed tag runs arbitrary code in a job holding `DREAMHOST_SSH_KEY`. Pin to SHAs.
- **No `concurrency` group** — two quick pushes race two `rsync --delete` runs against the live document root. Use `cancel-in-progress: false`.
- **`npm audit` is no longer clean** — nanoid 3.3.16, HIGH, via `vite → postcss`. Dev-only, never shipped, but `NOTES.md` still claims zero. `npm update nanoid` fixes it and refreshes the lock.
- **`package-lock.json` is stale** — root entry says version `1.2.3` against `package.json`'s `3.16.2`. Dependency sets match so `npm ci` is fine; it's six weeks unrefreshed.
- **Vite is two majors behind** — 6.4.3 vs 8.2.2; 6.x is outside even the "previous" dist-tag. three.js at 0.185.1 is exactly current. The Vite surface is 121 lines and three plugins; the real blockers are Rollup 4→5 hook changes affecting `closeBundle`/`buildStart`. Worth scoping deliberately rather than under pressure.
- **Cache-Control on hashed assets is 30 days, not a year** — DreamHost serves `max-age=2592000` for `/assets/`, `max-age=600` for HTML. Sane defaults, but the point of `manualChunks: { three: ['three'] }` is a cache hit that survives deploys; `immutable, max-age=31536000` on hashed files makes that reasoning pay off.
- **`rsync -rlgoDzvc`** — `-g`/`-o` are no-ops over SSH as a non-root user, and `-t` is absent, which is why `-c` is needed, checksumming all of `dist/` (including the 2.9 MB PNG) every deploy. `-rlptDzv` lets mtime do the work. Also `ssh -vvv` dumps key-negotiation detail into public logs.
- **Outside has real writing and no `/text/` page** — 3,929 bytes: five Power Sources, Folk Origins, sourced transcriptions. Butterfly and Harmonics are legitimately exempt, but nothing in the build knows the difference.
- **No scenes-sum assertion** — `prerender.js:449` asserts library types sum to the input, a good implementation of the standing rule applied in exactly one place. Apply it one level up: `Object.keys(SCENES)` vs pages built ∪ an explicit exempt map, and scene eleven can't ship unfindable. **Done 2026-09-02 (v4.2.0)**, and it took an eleventh scene being attempted to make it concrete. It fails in three directions rather than one: a scene with neither page nor exemption, a page for a scene that isn't registered, and an exemption for a scene that no longer exists. Each was made to fire before the gate was trusted green. It needed the registry out of `main.js` first — Node can't import that — and then needed the registry to have no imports at all, because Vite bundles its own config and follows dynamic imports statically.
- **`/text/` is orphaned from the served HTML** — zero `href="/text..."` in `dist/index.html`; the only link lives inside a `?raw` fragment injected into a `display:none` modal. The sitemap lists all eight, so they're discovered; what they've lost is internal link equity from the site's one high-authority page. One static, visually subdued anchor restores it.
- **Two generator scripts aren't wired to anything** — `build-resonances-doc.mjs` and `find-verbatim-overlaps.mjs` are in neither `package.json` nor the vite config. `docs/constellation_resonances.md` says "do not edit" and stays correct only if someone remembers — the `sitemap.xml` failure again.
- **Fragile CLI-entry guard** in both verify scripts — ``import.meta.url === `file://${process.argv[1]}` `` breaks on any path with a space or non-ASCII character, and fails *silently* (exit 0 having run nothing). Use `pathToFileURL`.
- **Prerendered pages request a font they never load** — `font-family: 'Arapey', Georgia` with no `@font-face` and no stylesheet, while the site self-hosts `arapey-400.woff2` at 8.8 kB.
- **Stale `Disallow: /utils/`** in robots.txt — the directory is empty since July.

---

## 6. Refactors worth scoping deliberately

**Retire the 42 inline handlers.** Exactly 42 attributes on 21 elements, 11 distinct
strings: ten nav icons, ten preview tiles, `#site-title`. Two delegated
`pointerenter`/`focusin` listeners keyed off `data-scene` replace all of them — removing
`'unsafe-hashes'` *and* all 11 SHA-256 hashes from `script-src`, dropping `window.pmGlimpse`
from the global namespace, and closing the seam where renaming a scene key means recomputing
a hash. It also fixes a live behavioural drift: `mouseover` bubbles from the SVG children, so
`pmGlimpse` fires once per child shape, not once per hover — measured **4 calls for one hover
pass** on the Sphere icon, against a documented 1-in-100. The prefetch listeners three lines
away correctly use `pointerenter`.

**Give cross-links a real `href`.** `wireCrossLinks` emits `<a role="link" tabindex="0">`
with no `href`, so four scenes each reimplement the same Enter/Space handler. The links also
can't be middle-clicked, opened in a tab, copied, or previewed in the status bar, and Space
activation is a semantic mismatch. `href="#${scene}/${id}"` is a URL shape the router already
handles, including the same-scene case.

**Three `sceneKit` helpers the tree is asking for.** `claimContainer()` (7 scenes set
container styles, 1 restores); `disposeSceneGraph()` (the same two-line traversal is
copy-pasted everywhere and only ever disposes `material.map` — Orrery alone leaks 27 textures
per visit from `roughnessMap`/`metalnessMap`/`emissiveMap`); `createManagedRenderer()`
(pixel-ratio cap, `forceContextLoss`, a `webglcontextlost` handler — none of which exist
anywhere today).

**Shrink the per-scene edit surface.** Adding a scene means editing the registry,
`index.html` twice, `initPreviews`'s hand-written id map, `PM_GLIMPSE_WORDS`, and the CSP
hash list. The id map is mechanically `'preview-' + key`; the hash list disappears with the
inline handlers. Same spirit: `.butterfly-bg` hardcodes one scene into both shell files,
where `overlay.dataset.scene` plus a registry field would do.

---

## 7. Housekeeping

**The project brief has drifted.** `perceptualmechanics-project-brief.md` says "current as
of v3.9.17"; HEAD is v3.16.2, fourteen minor versions on. Three of its six standing open
items are resolved and read as open: fonts *are* self-hosted (12 woff2 in `public/fonts/`,
12 `@font-face` blocks — the only `fonts.gstatic` string left is in a comment), CSP *does*
exist and enforces, and the chunk-size warning was fixed in 3.10.0. One item flipped the
other way: `npm audit` is no longer clean.

**What I checked and left alone**, so it doesn't get re-derived next pass:

- `parseHash`'s `Object.hasOwn` guard, the `syncingHash` round-trip, and the Back/Forward cases — all correct.
- The De Morgan inversion in `theater.css` — re-derived, matches.
- Orrery's Kepler math, eccentric-anomaly solve, moon `T ∝ r^1.5`, the Jacobi eigensolver, the tilted-torus dip solve, and long-horizon float precision — all correct.
- Outside's lookahead audio scheduler — genuinely well built, including the reseed-on-restart.
- Three.js disposal in Harmonics, Outside, Orbiter and Library — traced every resource, found no leak.
- Repo hygiene — `dist/`, `node_modules/`, `artifacts/` and `.DS_Store` are all genuinely untracked. 106 tracked files. The ignore rules are working.
- Every `sceneKit` helper returns a matching `dispose()` — except the one in finding 02.

---

*Method: all ten scenes, the shell, `sceneKit`, `links.js`, `resonances.js`, the colophon
component, both stylesheets, all five build scripts, the workflow, the htaccess and the
bardjs package read in full — 22,626 lines. Live session against `localhost:5173` and
against production. Contrast ratios computed with the WCAG relative-luminance formula
against each rule's actual composited background; byte counts from production resource
timing; context and oscillator counts from instrumented constructors in the page.*
