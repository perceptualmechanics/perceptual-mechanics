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

**Every row cites a source that can be checked in seconds.** A corrections file
whose corrections are themselves unverified is the original problem with extra
steps, so nothing goes in here from memory — each entry below was re-read from
the tree at the version named.

**Verified against `v4.5.0`, 2026-09-02.**

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

## Counts and measurements

| Claim | What is true | Source |
|---|---|---|
| Iron has 218 lines in Apollo's band | **218 is the total across all ten elements.** Iron has **50**. Sodium has 6, calcium 38, hydrogen 7. | `ALL_LINES.length` and `visibleLines()` in `src/scenes/apollo/apollo.text.js` |
| `sphere.js`'s geodesic has 320 faces at `detail = 2`, and each `+1` quadruples the count | **180 faces.** `PolyhedronGeometry` splits each of 20 base faces into `(detail+1)²`, not `4^detail`, so 2→3 is 1.78x rather than 4x. The wrong formula agrees at detail 0 and 1 — the two cases anyone checks by hand. | `src/scenes/sphere/sphere.js:103` · counted from `geo.attributes.position.count / 3` at three.js 185 |
| The sodium doublet beats at 0.5165 Hz | **0.5154 Hz.** 0.5165 came from sorting sodium's lines by frequency, which selects the 568nm pair — whose spacing is within 7% of D's. Select the D lines by wavelength (588.995 / 589.592), never by "the two closest" or "the two loudest". | `wavelengthToHz` in `apollo.text.js`; the measurement is in `NOTES.md` 4.4.0 |
| A 25-second sample is enough to characterise Apollo's ambient rate | It is not. 25s read **0.72 notes/s**; ten minutes read **0.560** against a configured 0.55. | `NOTES.md` 4.5.0 |

## Architecture

| Claim | What is true | Source |
|---|---|---|
| A scene is registered with a `load: () => import(...)` in `SCENES` | **Not since v4.2.0.** `src/scenes/registry.js` is import-free — that is load-bearing, because `vite.config.js` imports `prerender.js` which imports the registry, and Vite bundles its own config following dynamic imports statically. Loaders are derived in `main.js` by `import.meta.glob`. Registering a scene is one key plus a folder and entry file named after it. | `src/scenes/registry.js` header · `src/main.js:12` |
| The scenes-sum assertion is unbuilt / needs implementing | **Shipped in v4.2.0**, and Apollo was its first live customer. It fails in three directions and there is now a second gate checking `index.html`'s nav icons and tiles against the registry. | `scripts/prerender.js`, `scene/page mismatch` |
| `--nav-count` in `styles/main.css` is the value an added scene changes | **A fallback only, since v4.4.0.** `applyDerivedLayout()` in `main.js` sets it from `Object.keys(SCENES).length`; adding a scene changes no number in the stylesheet. | `styles/main.css:386` · `src/main.js`, `applyDerivedLayout` |
| A mixture in the hash risks colliding with the `#scene/id` piece route | It cannot. `parseHash()` has always required `/^\d+$/` before treating a second segment as a piece id. What did need changing was `setHash()`, which rebuilt the hash from scene + piece id and erased a mixture on arrival. | `src/main.js:197` |
| Apollo's corona drifts right to left | **It did not until v4.4.1.** The loop advanced each strand's wiggle phase and left its `x` fixed, under a variable named `speed` and a comment saying "right to left". It drifts now, measured at 90px/s at 1280px wide. | `src/scenes/apollo/apollo.js`, `f.x -= f.speed * dt` |

## Sources and methods that look right and are not

| Claim | What is true | Source |
|---|---|---|
| A CSP report collector needs its domain in `connect-src` | It does not. CSP reports are sent out of band and are not subject to the policy. | `NOTES.md` 4.2.1 · `public/.htaccess` comment block |
| Solar photospheric abundances are the right weights for Apollo's solar mixture | **They are published, sourceable and would be actively wrong** — helium second, calcium near nothing, when calcium's H and K are the deepest features in the visible solar spectrum. Abundance is not line strength. The ordering comes from the Fraunhofer table; the fader values are a stated ruler. | `SOLAR_MIXTURE` in `apollo.text.js` |
| NIST relative intensities give absorption depth | They are **emission** intensities, used here as a line-strength proxy. The gap is measurable: magnesium's b1 is 70 against sodium D2's 1000, so at maximum fader magnesium still transmits 34.5% where the real sun's b triplet rivals the D lines. | header of `apollo.text.js` · `NOTES.md` 4.5.0 |
| Fraunhofer catalogued exactly 574 lines | Sources differ — "over 570" and "some 700" both appear in reputable ones. Say "over 570" or give the source with the number. | `apollo.text.js`, `FRAUNHOFER` comment |

## Status — where to look, and where not to

| Claim | What is true | Source |
|---|---|---|
| `punch-list-2026-09-01.md` lists what is currently open | It is a **dated snapshot** and its own status block says so. Several items were cited as open after the work had shipped. The maintained list is `perceptualmechanics-project-brief.md` → *Known open items*. The punch list is worth reading for the evidence attached to each finding, not for status. | `punch-list-2026-09-01.md` header |
| Two `.htaccess` items are open; v4.0.1–4.0.3 are not deployed | Both `.htaccess` items were fixed in v4.0 with the reasoning in comments; 4.0.1–4.0.3 were deployed. | `public/.htaccess` · `NOTES.md` |
| Apollo has no generative layer, so it needs no lookahead scheduler | **True until v4.5.0 and false after it.** Sunlight is a generative layer and uses `setInterval` with lookahead, never rAF. The v4.3.0 statement was correct when written — a good example of a fact with an expiry date. | `NOTES.md` 4.3.0 and 4.5.0 |

---

## What is *not* in here

Facts that were only ever right. This file is for claims that were made and
corrected, not a summary of the project — `perceptualmechanics-project-brief.md`
is that. A row earns its place by having been believed.
