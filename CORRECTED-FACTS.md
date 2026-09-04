# Corrected facts

*The durable surface `WORKING-PROTOCOL.md` rule 4 asks for. Created 2026-09-02,
after the same false claim was written into three consecutive briefs, corrected
in a reply each time, and came back each time — because a reply is not
something the next brief is written from.*

**Who uses this, and how.**

- **The chat instance reads this before writing a brief.** It is short on
  purpose. If a claim you are about to make appears here, use the corrected
  form, or say where your version came from.
- **Cowork adds a row whenever it corrects a claim that came out of a
  document** — before writing the next thing, not after. If the fact has an
  obvious permanent home (`SITE.md`, `STANDARDS.md`, `NOTES.md`, a code
  comment) it goes there *as well*; this file is the index, and the last-resort
  home for facts with nowhere else to live. **A brief is never that home** —
  see `STANDARDS.md`, "The knowledge base is current; a brief is a missive".

**This file is read in full before every brief.** That is the whole design
constraint: if it stops being readable in one sitting, it has failed at its own
job, and a corrections file nobody finishes is worse than none — it looks like
diligence. Length is managed by *Retired* at the bottom rather than by leaving
rows out.

**Every row cites a source that can be checked in seconds.** A corrections file
whose corrections are themselves unverified is the original problem with extra
steps, so nothing goes in here from memory — each entry below was re-read from
the tree at the version named.

**Verified against `v4.8.3`.**

---

## Recurring — check these first

One row, because one claim has come back three times. If a brief contains it, the
brief is quoting a reply rather than the code.

| Claim | What is true | Source |
|---|---|---|
| Butterfly's landing thumbnail takes ~25 seconds to become a recognisable Lorenz shape, and this is "a live open question" | **Fixed in v4.1.3.** The preview accumulates at 400 points/sec against 240 in full mode and reaches the shape in about a second. Not open. | `src/scenes/butterfly/butterfly.js:617` — `const PPS = preview ? 400 : 240;` · `NOTES.md` 4.1.3 |

**Why it recurs**, since that is the more useful fact: the correction was made in
conversation three times and never written anywhere a brief-writer reads. That
is what this file exists to stop. It is also why the argument it kept being
attached to was worth re-deriving: Apollo's tile is complete on its first frame,
so the reason to run ambient in it is that the tile becomes *alive*, not that it
becomes legible. The stale reason was propping up a sound decision.

---

## Architecture

| Claim | What is true | Source |
|---|---|---|
| A scene is registered with a `load: () => import(...)` in `SCENES` | **Not since v4.2.0.** `src/scenes/registry.js` is import-free — that is load-bearing, because `vite.config.js` imports `prerender.js` which imports the registry, and Vite bundles its own config following dynamic imports statically. Loaders are derived in `main.js` by `import.meta.glob`. Registering a scene is one key plus a folder and entry file named after it. | `src/scenes/registry.js` header · `src/main.js:12` |
| The scenes-sum assertion is unbuilt / needs implementing | **Shipped in v4.2.0**, and Apollo was its first live customer. It fails in three directions and there is now a second gate checking `index.html`'s nav icons and tiles against the registry. | `scripts/prerender.js`, `scene/page mismatch` |
| `--nav-count` in `styles/main.css` is the value an added scene changes | **A fallback only, since v4.4.0.** `applyDerivedLayout()` in `main.js` sets it from `Object.keys(SCENES).length`; adding a scene changes no number in the stylesheet. | `styles/main.css:386` · `src/main.js`, `applyDerivedLayout` |
| A mixture in the hash risks colliding with the `#scene/id` piece route | It cannot. `parseHash()` has always required `/^\d+$/` before treating a second segment as a piece id. What did need changing was `setHash()`, which rebuilt the hash from scene + piece id and erased a mixture on arrival. | `src/main.js:197` |

## Sources and methods that look right and are not

| Claim | What is true | Source |
|---|---|---|
| NIST relative intensities give absorption depth | They are **emission** intensities, used here as a line-strength proxy. The gap is measurable: magnesium's b1 is 70 against sodium D2's 1000, so at maximum fader magnesium still transmits 34.5% where the real sun's b triplet rivals the D lines. | header of `apollo.text.js` · `NOTES.md` 4.5.0 |
| A 250ms ambient tick is "under the first background-throttle tier", so a 1.2s lookahead covers a hidden tab | The tier that matters is not the one 250ms is under. A hidden page that is **audibly** playing is exempt from Chrome's intensive throttling and gets the **standard** tier, which is once per second — so the lookahead was covering a 1s worst case with 200ms to spare. Widened to 3.0s while hidden in 4.5.1. A page that is hidden and **silent** is not exempt at all and is throttled to once a minute; Chrome is explicit that a silent stream earns nothing. | Chrome's timer-throttling post, intensive-throttling conditions · `apollo.js`, `AMBIENT_AHEAD_HIDDEN` |
| An element's other spectral lines can serve as a struck line's overtones, giving the voice a body without leaving the one-line-one-pitch rule | **They cannot, and the reason is arithmetic.** Every line of every element in this instrument is inside one octave — the band is 788.9–399.7Hz, a ratio of 1.97 — so there is nothing above a line to be its overtone. Rendered and measured: a struck line plus its element's three strongest other visible lines put 5.4% of energy above 1.2kHz against 5.7% for the plain voice. A same-octave cluster, not a partial stack. **Correction, 2026-09-03: the octave fact was not a finding.** Apollo's own `/text/` page has said "the visible spectrum is almost exactly one octave wide — the instrument has one octave and cannot have more" since v4.3.0, on a page this session helped write. What was new was only the consequence for partials. Reported as a discovery because the site was never checked for it, which is this file's own failure mode arriving from the other direction. | `/text/apollo/`, "Wavelength as pitch" (since 4.3.0) · `NOTES.md` 4.5.2 |
| The site's corpus is roughly 2,000–2,500 sentences | **3,221 under the ruler that ships**, measured 2026-09-03 for Psyshell. Harvesting every published string gives 4,047 units under the `prose` split (4,054 blunt, 4,191 beatwise — a 3.6% spread), of which 508 are not sentences and 318 more fall outside the declared per-scene manifest. The distribution matters more than the total: **Scroll and Theater are 82% of it**, Harmonics publishes nothing at all, and Butterfly's entire contribution is one sentence. Any design that assumes even spread across scenes is designing against a corpus that does not exist. | `src/utils/corpus.js` · `src/scenes/psyshell/psyshell.text.js` · `/text/psyshell/` |
| WebGPU is stable in Chrome/Edge and Firefox 147+, and in Safari 26+ on macOS/iOS/iPadOS | Two of the three are off. Firefox is **141** on Windows and **145+** on macOS Tahoe 26, **ARM64 only** — not 147, and not Intel Macs. Chrome on Android needs **121+ with Qualcomm or ARM GPUs**. And the omission that matters most for a project whose CI is Linux: **no browser ships WebGPU on Linux at all.** Safari's list is right (macOS Tahoe 26, iOS 26, iPadOS 26, visionOS 26). | web.dev, "WebGPU is now supported in major browsers", read 2026-09-03 |
| Outside is a violet five-petal lotus | Its own header says the lotus silhouette was tried, **rendered as a PNG, and rejected** — it reads as "a five-pointed star with a pinched waist between each point, not a lotus." Four simple petals plus one compound cluster of three lobes, at five-fold angles. Only the gold seedpod and the violet are lotus, and those are real botany (Nelumbo nucifera). Worth having right whenever Outside is being compared to something, which is what it was being used for. | `src/scenes/outside/outside.js:33-56` |
| Base e is the most efficient possible radix | **True, and only under a stated cost model.** If the cost of representing a number is the radix times the number of digits (r·w), the optimum is e and 3 is the most economical integer radix — which is what ternary machines were built on (Setun, Moscow State University, ~50 machines 1958–1965). Other cost models give other answers, so **the model goes wherever the claim goes**: it is in `psyshell.text.js` and on `/text/psyshell/`, never as a bare superlative. Source: Brian Hayes, "Third Base", *American Scientist*, 2001 — which also records that Setun spent its own radix advantage by storing each trit in two magnetic cores. | `src/scenes/psyshell/psyshell.text.js`, the RADIX block · `/text/psyshell/` |
| Every other scene leaves the lower third clear, so Psyshell's title is the one colliding with its object | **Beamline is worse.** With the type hidden and the title's own band sampled, mean luminance reads Beamline 0.311, Psyshell 0.121, Butterfly 0.058, Apollo 0.056, Outside 0.032, Harmonics 0.011. Beamline's title sits at **2.6:1 against its backdrop — below WCAG AA for large text** — where Psyshell cleared it at 5.4:1. Psyshell is not the noisiest either: Butterfly's local gradient is ~5× higher. Psyshell was lifted anyway (aesthetic, not a contrast failure); **Beamline is an unlogged defect** and is in `SITE.md`'s open items. | measured 2026-09-03 · `SITE.md`, Known open items |
| Psyshell's tile clips its own skirt and sits high in the circle | **Fixed in 4.6.0**, in the same pass that found it — `LOOK_Y` in `psyshell.js` aims the camera above the origin, higher in preview than in the full scene, because the flower's visual centre is not the origin. Carried into the 4.6.1 brief's open list from the 4.6.0 report, where it was named as a defect that had been *found and repaired*. A fixed item restated as open is the punch-list failure this project already has a rule about. | `src/scenes/psyshell/psyshell.js`, `LOOK_Y` · `NOTES.md` 4.6.0 |
| Murray's law gives the branch-thickness exponent; real trees follow it | **State the exponent, always.** The relation is r_parent^α = Σ r_daughter^α. **α = 2** is Leonardo da Vinci's rule, preserving cross-sectional area; **α = 3** is Murray's, optimising flow. Real plants measure across that range rather than at one value — vines closer to Murray, woody trees closer to da Vinci, and classic artworks measured from 1.5 to 2.8. "Trees follow Murray's law" is false as stated; "trees are between 2 and 3" is true and useless without saying which end. Psyshell shipped **α = 3** for one release and **no longer uses the law at all** — 4.8.0 removed every corpus-to-geometry mapping from that scene, so a session reaching for `MURRAY_EXPONENT` will not find it. The correction about the exponent stands on its own: state which α, always. | PNAS Nexus, "Scaling in branch thickness and the fractal aesthetic of trees" · `src/scenes/psyshell/psyshell.object.js` header |
| Vogel's model is the standard formulation of phyllotactic emergence | Vogel (1979) is the standard formulation of the **sunflower head** — a spiral packing in a disc. The divergence angle for organs emerging around a **stem** is the older, general phyllotactic fact and is not Vogel's disc model. Both use 137.5°, which is why the citation slides; they are not the same claim. | `psyshell.text.js`, `GOLDEN_ANGLE` |
| `brief-psyshell.md` and `brief-psyshell-transmission.md` can be marked as superseded | **Neither existed.** Both Psyshell briefs arrived as chat messages and were never written to files, so there was nothing to mark. Created in 4.7.0 with Scott's text unedited and a superseded header. **This is the second time a brief has named a file that had to be created first** — rule 4 itself arrived naming `CORRECTED-FACTS.md`. The pattern: a brief refers to a durable surface that only ever existed in conversation. **Superseded by the rule that replaced it:** a brief now names knowledge-base files and nothing else, because a brief cannot go stale and frequently is not a file at all. | `WORKING-PROTOCOL.md` rule 4 · `STANDARDS.md`, "A brief closes by naming which knowledge-base files it makes untrue" |
| Fraunhofer catalogued exactly 574 lines | Sources differ — "over 570" and "some 700" both appear in reputable ones. Say "over 570" or give the source with the number. | `apollo.text.js`, `FRAUNHOFER` comment |
| Psyshell's transmission "reads as a flash travelling inside the crystal" (4.8.1 note, on lowering its gain from 3.0 to 2.0) | **It rendered as a flat untextured quad.** The ribbon was geometry — a strip built along the struck filament, painted colour × level × gain with no falloff across its width — so a lit digit was a white polygon standing in the object, and lowering the gain made a dimmer polygon. The claim was made from the constants rather than from looking at a strike, which is the failure this project already has a rule about. Fixed in 4.8.2 by removing the geometry: the digits light the crystal's own segments and the web's strands. | `NOTES.md` 4.8.1 vs 4.8.2 · `psyshell.js`, "The transmission, as light in the body" |
| The ratios 1 : 2.76 : 5.40 : 8.93 are a chime's, or a bell's | **They are a free bar's, which is a xylophone.** Those are the transverse modes of a bar free at both ends, and they are why a glockenspiel sounds dry and woody. A bell is a *shell*: its modes sit much closer together (a small hemispherical bell around 1 : 1.6 : 2.1 : 2.9), and — the part that actually identifies it — **every mode is split into a beating doublet**, because no real bell is symmetric. Psyshell shipped a xylophone for one release with "the ideal free bar" written in the code as its justification. The ratios were right for the wrong object. | `psyshell.shiver.worklet.js`, "A bell, not a bar" · `NOTES.md` 4.8.2 vs 4.8.3 |
| A photon experiences no time, so light from a distant galaxy arrives with nothing having elapsed for it | **True as a statement about the interval, and only as that.** A photon travels a null worldline: the spacetime interval between emission and absorption is zero, so no proper time elapses along the path. But **there is no valid inertial rest frame for a photon**, so "what the photon experiences" is not a well-formed quantity in relativity, and the loose form of the claim is the kind of true-sounding sentence that becomes false on restatement. State the interval, not the experience. | `/text/psyshell/`, "What the field is made of" · `src/scenes/psyshell/psyshell.js`, the idle comment |
| Stars twinkle, so a field of distant points should scintillate | **Scintillation is caused by matter in the path** — atmospheric turbulence — and is therefore exactly wrong for a field whose claim is that nothing impedes the light. Two supporting facts: a planet does not twinkle because it is an extended source and averages the distortion across its own angular size, and interstellar scintillation, which is real, is a radio-wavelength plasma effect rather than anything visible. Psyshell's glimmer was removed in 4.8.1 for this reason. | `src/scenes/psyshell/psyshell.js`, "No idle, and that is the change" |
| A CPU-throttling harness measures frame-rate independence | **Not below 20 fps it does not.** `sceneKit.createFrameClock` clamps dt at `maxDelta = 0.05`, so every rate a throttled headless browser could reach for Psyshell (20.4, 11.3, 8.3 fps) was at or below the clamp, and the harness measured the clamp working as designed — it read as a coupling and was not one. Drive the clock instead: replace `requestAnimationFrame` and `performance.now` after the scene mounts and run the same scene-seconds at 30, 60 and 144. | `src/utils/sceneKit.js:694` · `NOTES.md` 4.8.1 |

## True when written, false now

The category the table shape did not have. Not an error and not current: a fact
with an expiry date, which is the kind most likely to be quoted correctly years
later and be wrong anyway. Record the version it was true at.

| Claim | What is true | Source |
|---|---|---|
| Apollo has no generative layer, so it needs no lookahead scheduler | **True until v4.5.0 and false after it.** Sunlight is a generative layer and uses `setInterval` with lookahead, never rAF. The v4.3.0 statement was correct when written — a good example of a fact with an expiry date. | `NOTES.md` 4.3.0 and 4.5.0 |
| Outside's lookahead scheduler exists so the pad keeps breathing in a background tab | **True from 3.9.5 until v4.0 and false after it.** v4.0 reversed it: `outside.js`'s visibility handler now stops the scheduler and suspends on hide. The 3.9.5 entry saying otherwise is still in `NOTES.md` and is where this keeps being read from. Worth knowing before proposing background audio: the decision has already been made both ways. | `NOTES.md` 3.9.5 vs `src/scenes/outside/outside.js`, `onVisibilityChange` |
| Psyshell's geometry encodes the corpus — petal angle is reading order, limb thickness is Murray's law | **True from 4.6.0 to 4.7.0 and false after 4.8.0.** The object is now built from the manuscript's description and knows nothing about the corpus; filapixel positions are a seeded draw and carry no order, length or source. Both mappings were real and checkable, and both produced a diagram rather than an object. `psyshell.object.js` says outright that it must not be re-introduced. | `src/scenes/psyshell/psyshell.object.js` · `NOTES.md` 4.8.0 |
| Psyshell's ordinal reads *n* of its limb | **True at 4.7.0 and false after 4.8.0.** It reads `n / 3221` — the sentence's place in the whole corpus. There are no limbs. | `src/scenes/psyshell/psyshell.js`, `showRead` |
| Psyshell is the one scene that sits still until touched | **False since 4.7.0**, which added a glint and an idle turn; 4.8.0 replaced the glint with a sparse shimmer. It has not been a still scene since the release before the brief that said so. | `src/scenes/psyshell/psyshell.js`, `SHIMMER_RATE`, `IDLE_TURN` |
| Apollo suspends the AudioContext whenever the page is hidden, the same as Outside and Harmonics | **True at v4.5.0 and false after v4.5.1.** One condition is now exempt — sound on *and* Sunlight armed — bounded at ten minutes on the audio clock. Every other combination is unchanged, and Outside and Harmonics are unchanged. | `src/scenes/apollo/apollo.js`, `backgroundAudible()` · `NOTES.md` 4.5.1 |

---

## Retired

**A row earns retirement when the fact has been absorbed into a document the
next session reads anyway** — the way the deploy's rsync flags belong in
`public/.htaccess`'s own comment block and the punch list's status belongs in
the project brief. Move it there, leave the one-line pointer below, and this
file stays short enough to read.

**If a row cannot find a home, that is the signal it belongs here permanently.**
The Butterfly claim is the standing example: it is already in `NOTES.md` 4.1.3
and in the project brief, and it came back three times anyway. It stays at the
top of this file and does not retire.

Retired 2026-09-02, on the first pass of this rule:

- **Iron has 218 lines** → `WORKING-PROTOCOL.md`, first table row, with the
  corrected count; and the chat brief's Apollo row now carries "218 across all
  ten (iron 50, sodium 6)".
- **`sphere.js`'s 320 faces at detail 2** → the code comment at
  `src/scenes/sphere/sphere.js:103`, which shows the formula and the counted
  values; and `WORKING-PROTOCOL.md`'s shared-lesson list.
- **The sodium beat measured on the wrong pair** → `WORKING-PROTOCOL.md`'s
  shared-lesson list, where it is stated as the method warning it actually is.
- **Apollo's corona "drifts right to left"** → the same list, plus the code
  comment at the drift itself.
- **Photospheric abundances as line-strength weights** → the same list, where it
  is the entry about a citation on a wrong answer.
- **A 25-second sample characterises the ambient rate** → the same document's
  closing observation on sample size.
- **A CSP collector needs `connect-src`; two `.htaccess` items are open;
  v4.0.1–4.0.3 undeployed; the punch list lists what is open** → all four are
  rows in `WORKING-PROTOCOL.md`'s own table, and rule 2 there covers the punch
  list directly.

Nothing above is *less* true for having been retired. The pointer exists so a
reader who half-remembers one of these knows where it went.

---

## What is *not* in here

Facts that were only ever right. This file is for claims that were made and
corrected, not a summary of the project — `perceptualmechanics-project-brief.md`
is that. A row earns its place by having been believed.
