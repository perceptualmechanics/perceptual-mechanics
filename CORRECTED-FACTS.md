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
  obvious permanent home (`NOTES.md`, `STANDARDS.md`, a code comment, one of
  the briefs) it goes there *as well*; this file is the index, and the
  last-resort home for facts with nowhere else to live.

**This file is read in full before every brief.** That is the whole design
constraint: if it stops being readable in one sitting, it has failed at its own
job, and a corrections file nobody finishes is worse than none — it looks like
diligence. Length is managed by *Retired* at the bottom rather than by leaving
rows out.

**Every row cites a source that can be checked in seconds.** A corrections file
whose corrections are themselves unverified is the original problem with extra
steps, so nothing goes in here from memory — each entry below was re-read from
the tree at the version named.

**Verified against `v4.6.1`, 2026-09-03.**

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
| Every other scene leaves the lower third clear, so Psyshell's title is the one colliding with its object | **Beamline is worse.** With the type hidden and the title's own band sampled, mean luminance reads Beamline 0.311, Psyshell 0.121, Butterfly 0.058, Apollo 0.056, Outside 0.032, Harmonics 0.011. Beamline's title sits at **2.6:1 against its backdrop — below WCAG AA for large text** — where Psyshell cleared it at 5.4:1. Psyshell is not the noisiest either: Butterfly's local gradient is ~5× higher. Psyshell was lifted anyway (aesthetic, not a contrast failure); **Beamline is an unlogged defect** and is now in the project brief's open items. | measured 2026-09-03 · project brief, Genuinely open |
| Psyshell's tile clips its own skirt and sits high in the circle | **Fixed in 4.6.0**, in the same pass that found it — `LOOK_Y` in `psyshell.js` aims the camera above the origin, higher in preview than in the full scene, because the flower's visual centre is not the origin. Carried into the 4.6.1 brief's open list from the 4.6.0 report, where it was named as a defect that had been *found and repaired*. A fixed item restated as open is the punch-list failure this project already has a rule about. | `src/scenes/psyshell/psyshell.js`, `LOOK_Y` · `NOTES.md` 4.6.0 |
| Fraunhofer catalogued exactly 574 lines | Sources differ — "over 570" and "some 700" both appear in reputable ones. Say "over 570" or give the source with the number. | `apollo.text.js`, `FRAUNHOFER` comment |

## True when written, false now

The category the table shape did not have. Not an error and not current: a fact
with an expiry date, which is the kind most likely to be quoted correctly years
later and be wrong anyway. Record the version it was true at.

| Claim | What is true | Source |
|---|---|---|
| Apollo has no generative layer, so it needs no lookahead scheduler | **True until v4.5.0 and false after it.** Sunlight is a generative layer and uses `setInterval` with lookahead, never rAF. The v4.3.0 statement was correct when written — a good example of a fact with an expiry date. | `NOTES.md` 4.3.0 and 4.5.0 |
| Outside's lookahead scheduler exists so the pad keeps breathing in a background tab | **True from 3.9.5 until v4.0 and false after it.** v4.0 reversed it: `outside.js`'s visibility handler now stops the scheduler and suspends on hide. The 3.9.5 entry saying otherwise is still in `NOTES.md` and is where this keeps being read from. Worth knowing before proposing background audio: the decision has already been made both ways. | `NOTES.md` 3.9.5 vs `src/scenes/outside/outside.js`, `onVisibilityChange` |
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
