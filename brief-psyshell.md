# Psyshell — flower magic

> **SUPERSEDED by `brief-psyshell-branch.md` (v4.7.0, 2026-09-03).** The
> chrysanthemum geometry described below was built (v4.6.0), rendered, looked
> at, and replaced by a branch. **The scene's claims did not change and are not
> superseded** — one filapixel is one sentence, angle-or-position is reading
> order, length is sentence length, and the corpus is the structure. What was
> replaced is the *form* those claims were expressed in.
>
> **Why it was replaced, kept here so it is not re-proposed.** The blossom
> converged 3,221 rays on one origin, which is structurally why the core
> clipped to white and why the inner two-thirds of every ray was lost — a sum
> taken at a point cannot be fixed by staggering the inner radius, and three
> passes of v4.6.0 went into trying (base emission 0.34 → 0.022, a steeper
> brightness ramp, a drooping skirt). None addressed the cause. And the radial
> form threw away what the data is: reading order is linear, a flower had to
> wrap it into an angle, and that wrap is what forced the √contribution
> correction because equal arcs gave a 1,382:1 density ratio.
>
> **Why this file exists at all.** The v4.7.0 brief asked that this one be
> marked rather than deleted — and it did not exist: both Psyshell briefs
> arrived as chat messages and were never written down. That is
> `WORKING-PROTOCOL.md` rule 4 exactly, and it is the second time a brief has
> named a file that had to be created before it could be used. Scott's text is
> reproduced below unedited.

---

perceptualmechanics.com — Psyshell
flower magic

The twelfth scene. Named for the output rather than the object: the flower generates the shell. Untgract pins on the crystal flower and becomes a thin, slightly effeminate director — the chrysanthemum is the mechanism, the psyshell is what it produces.

Which lands the horror without stating it. A psyshell is living apparatus a dead thing borrows, because life is the only thing that functions in the green. So a visitor plays with a beautiful white flower made of two thousand sentences, and the title says what it is for. Nobody has to explain the pools.

flower magic is the subtitle and it is doing the Union's own move: light, almost twee, entirely accurate. The register of "we can engineer incentive, Autarch." How Iplaisc would describe her own work.

Naming note: Sphere, Orbiter, Butterfly, Beamline, Harmonics, Outside, Apollo — one evocative word, mostly borrowed from physics or myth. This is the first borrowed from the fiction itself, which is fine at scene twelve.

## The source passage

From the Holography manuscript, Untgract's workshop:

> Iplaisc lifts herself up from the editbay and enters the workshop, punches in the text of Strange Attractors: A Love Affair with Chaos, begins the computation. The middle of the workbench revolves, glows, and a thousand light trails form, taking the shape of a white fiber-optic chrysanthemum, each filapixel a moment in time, demarcated in the code of the Union.
>
> — Is there any effect you're looking for? — Tessier curve. — Hmm. It definitely appears to be capable, although it will need some amplification around the root here to properly sling it forward.

Two things the scene has to deliver: a spatial structure whose every element is a temporal index, and a single touch with a structural consequence.

## 1. What a filapixel is

One sentence of the site's corpus. One petal.

And the geometry is derived, not decorated — this is the distinction from the shelved corpus-spectra work, which claimed the text had a hidden spectral property and measured zero. This claims only that the text has a shape, which is trivially and verifiably true.

* Angle around the axis = position in reading order. Petal n is sentence n. Which makes "each filapixel a moment in time" literal: the moment is its place in the sequence.
* Petal length = sentence length. Real variation, visible immediately, no invention.
* Grouping/hue band = source scene, from the registry. Eleven bands around the flower, each a contiguous arc.

So the silhouette is the shape of the corpus. A scene with long sentences reads as a broad soft arc; a terse one as a spiky sector. Nothing is asserted about the writing. The writing is the geometry.

Sentence splitting: Cowork has done a sensitivity analysis on this before — three rules compared rather than one asserted. Reuse that work and state which rule was used. Report the resulting count; if it differs much from ~2,000–2,500, say so, because the visual density assumptions depend on it.

And a chrysanthemum is the right flower, botanically: hundreds of narrow ray florets radiating from a dense centre. That is what the passage describes and it is what the data wants.

## 2. What touching one does

Amplification, and the whole structure responds.

Touch a petal and a disturbance propagates outward along reading order — to the sentences adjacent in the text, then further, falling off with distance. Which is amplification around the root, to properly sling it forward: a local intervention with a structural consequence, visible.

The propagation must be legible as travelling, not as a global brightness change. Same lesson as Apollo's corona (v4.4.0): a response only reads as a response if it starts somewhere and moves. Measure it — an expanding front with a known origin, as with Apollo's annulus.

Consider making it asymmetric. A Tessier curve slings forward; propagation that runs further toward later sentences than earlier ones would encode that, and it costs nothing.

Audio, if it earns it: one soft strike at the touched petal, and nothing else. Outside chimes per petal because petals are few. Two thousand chiming is noise, and the restraint is more interesting than the alternative. Follow Outside's lookahead scheduler pattern and the standard dispose path regardless.

## 3. Tech: instancing, and why not the rest

`InstancedMesh`, one draw call, CPU-side propagation. No GPGPU, no WebGPU.

The arithmetic: ~2,000–2,500 petals, a propagation update per frame per petal, is roughly 150k operations/second. Harmonics already runs coupled Kuramoto oscillators on the CPU without trouble. GPGPU ping-pong and WebGPU compute are real effort that would not show, which is the Keller standard pointing away from them.

Recorded so it is not re-proposed: WebGPU is now genuinely available — stable in Chrome/Edge, Firefox 147+, Safari 26+ on macOS/iOS/iPadOS — so it is a real option for a later scene. What would change the answer here: petal count above ~50,000, or a per-petal simulation with neighbour coupling in more than one dimension. Neither applies.

Instanced attributes carry the data. Per-instance angle, length, hue band, and an activation float the propagation writes. Colour and scale come off the instance buffer; the CPU touches an array, not the scene graph.

## 4. The Outside problem

The site already has a flower. Outside is a violet five-petal lotus with broad translucent petals and Fresnel edges. This is a white fibre-optic chrysanthemum with two thousand fine linear rays.

Botanically and visually these are different objects, and the passage specifies chrysanthemum. But two floral scenes on a twelve-scene site is a real consideration, not a non-issue.

So: build it, render both tiles side by side at 200px, and look before committing. If they read as siblings at thumbnail size, the answer is a silhouette change — and the honest options are a tighter, denser, more radial-burst form, or a colour departure. Report what was seen rather than what was intended.

## 5. Scene requirements

Read `/mnt/skills/public/frontend-design/SKILL.md`, `STANDARDS.md`, and `CORRECTED-FACTS.md` first. New scene, so every convention applies from the first line.

* `src/scenes/psyshell/psyshell.{js,css,html}` plus `psyshell.text.js`.
* Registered by key only — the registry is import-free since v4.2.0, and loaders derive via `import.meta.glob` in `main.js`.
* All five `sceneKit` lifecycle helpers; `setPaused(paused)`; call `animate()` directly for the first frame, do not schedule it (the 4.1.1 bug, and a new scene is where it recurs).
* `bindTapVsDrag` — this raycasts.
* Layout derived from measurement, not constants. The v4.4.2 lesson: anything positioned against another element's size is queried, never assumed.
* Mobile-first CSS, media queries nested and tab-indented.
* Accessibility from the start: the jump list is over scene bands, not two thousand petals; `sr-live` announcing what was struck and which scene it came from; reduced-motion branch that stills the propagation without stilling the object; contrast measured against real composited backgrounds.
* `/text/` page required, generated from the same module the scene imports. The scenes-sum gate will fire — good.
* Twelve tiles. The grid is registry-derived as of v4.4.0, so 4/4/4 should fall out with no second decision. Confirm it does.
* Nav: this is the twelfth icon. Eleven cost 27.6 × 44 at 320px, down from 30.4. Measure the twelfth and report it — this is the number that decides whether the nav needs a rethink, and it has been flagged twice.

## 6. Verification

* Sentence count and split rule stated, with the sensitivity work referenced.
* Petal count matches sentence count exactly. Off-by-one here is invisible and permanent.
* Propagation measured as travelling — origin, front position at two or three times, falling off. Not asserted.
* Frame-rate independence at 60 and 144, via `createFrameClock`. No per-frame constants, including counts (`PPF` survived two sweeps because it was a count).
* One audio context per visit, closed on leave, zero orphans — verified by leaving and clicking inside another scene.
* All twelve tiles render, `data-blits` climbing, cold load in a fresh profile.
* Nav at 320 / 360 / 375 / 390 / 414 / 768 / 780 / 1280, with the 320px tap-target number.
* Grid at the same widths — 4/4/4, and the 768px tier that needed a fix at eleven.
* A live look at the scene, at its 200px tile, and at Outside's tile beside it.

## Closing: what this invalidates

`perceptualmechanics-chat-brief.md` — eleven scenes becomes twelve; table gains a row; the 36,886 figure is now used by a scene, which is worth a line. Where things stand gains a release entry.

`perceptualmechanics-project-brief.md` — What this is, the scene list, Recent history.

`STANDARDS.md` — if the corpus sentence split becomes a shared module rather than scene-local, that is a new rule about derived content living in one place.

---

## What was measured against this brief *(added by Cowork, v4.6.0)*

Four claims did not survive checking, and they are recorded in
`CORRECTED-FACTS.md` rather than only here:

- **The corpus is 3,221 sentences, not 2,000–2,500.**
- **Nine scenes contribute, not eleven.** Harmonics publishes nothing and
  Outside publishes only labels.
- **The WebGPU versions are wrong**, and omit that no browser ships it on Linux.
- **Outside's own header says its silhouette is explicitly not a lotus** — the
  lotus form was rendered and rejected.

And the distribution reversed the band-width decision after it was made: two
scenes are 82% of the corpus, so equal arcs gave a 1,382:1 density ratio.
