# Harmonics (Constellation scene) — session brief

perceptualmechanics.com, 2026-08-23. Covers 3.0.0 through 3.1.3.

## Living atmosphere

Added a new layer to the Harmonics scene: faint, unlit points drifting independently through the scene, one per piece named in a resonance row still awaiting review (`getPendingResonances()` in `resonances.js`). Deliberately a different query than the approved rows — an honest picture of the corpus's actual state (more connections discovered than confirmed) rather than decoration. Never Kuramoto-coupled, no full payoff panel on click — just enough feedback (a minimal "pending review" panel) to distinguish them from confirmed nodes.

This later became relevant again: once all 42 pending resonances were approved (see below), the atmosphere had nothing left to draw. Left as-is rather than special-cased — it'll repopulate automatically whenever a future discovery pass adds new candidate rows.

## Sound

First audio this site has ever shipped. The existing Kuramoto phase-sync model now drives a real Web Audio graph, not just brightness: paired detuned oscillators per node (natural beating), a synthesized convolution reverb (no external audio asset), a compressor as a safety limiter, gain that falls off with camera distance. `.constellation-sound-toggle` is both the required first-gesture trigger and the ongoing mute control.

Level and timbre went through several rounds of live, ear-tuned feedback — started loud and plain, ended quiet and reverberant, aiming for a "spa / singing bells" character. The right number here was only findable by listening, not by guessing up front.

## Side-by-side passages

The payoff panel now shows each resonance's two pieces in their own words, not just a rationale describing them. `resolveEndpointTitle` became `resolveEndpoint`, now returning each endpoint's raw text; a new `src/utils/resonanceExcerpts.js` extracts the quoted span a rationale points to and windows a readable excerpt, shared with the doc-generation script so the live panel and the reviewed doc never disagree. The rationale caption that briefly sat under the excerpts was later removed entirely per direct instruction — the rationale still silently picks which quoted span each excerpt centers on, it just isn't printed as its own paragraph.

## Backdrop rewrite

The galactic backdrop's log-spiral-arm point distribution came out entirely, replaced by a cluster/filament model: points scatter around randomly placed cluster centers, with some interpolated between two clusters to form connective filaments, colored by blending H-alpha red against O-III blue per cluster. This followed direct feedback that rotation and twinkle alone weren't fixing it — the underlying point math itself read as "a constrained geometric band," so the fix had to be structural. Nodes also got a second, larger, dimmer halo layer so they'd read forward against the livelier background.

The separate deep-field starfield (distinct from the nebula) was punched up later in a follow-up: more stars, slightly bigger/brighter, and real per-star color variation (cool blue-white majority, white, occasional warm gold) instead of one flat tint.

## QA pass (3.0.0)

Full click-through of all nine scenes, a mobile pass to ~500px, and a `prefers-reduced-motion` audit, all verified live rather than assumed from code. Found and fixed: two reduced-motion gaps in this round's own new code (hover halo, atmosphere drift); a real, pre-existing sitewide bug where `#pm-nav`'s icon-shrink override was gated behind the wrong breakpoint, silently clipping 4 of 9 nav icons off-screen between 480–716px viewport widths; a malformed unclosed `<p>` and missing `rel` attribute in colophon.html.

**Known, not fixed**: on short mobile viewports, the resonance panel's excerpts can make it tall enough that its bottom content sits under the fixed title/sound-toggle chrome. Root cause is a shared cross-scene z-index relationship (the scene-mount wrapper caps the panel below body-level chrome regardless of the panel's own z-index) — documented in `constellation.css` rather than risked without a regression budget across all nine scenes.

## Resonance approvals (3.1.0)

Scott's call, made right after seeing 3.0.0 live: all 42 pending resonances approved. 64/64 rows now `approved`, 0 pending, 0 rejected. Named tradeoff at the time: this emptied the living atmosphere (see above) until a future discovery pass adds new candidates.

## Node spacing (3.1.1)

Approving 42 rows nearly doubled node count (~32 → ~61), which visibly tightened the force-directed layout even before Scott asked live for more room. `GRAPH_SCALE` bumped 90/150 → 120/200 — about 33% up, covering both the node-count growth and adding real extra spacing. Every downstream dimension (camera bounds, fog, star field, galaxy radius) derives from this one number, so it was the only thing that needed to move.

## URL hash fix (3.1.3)

The 2026-08-18 rename to "Harmonics" deliberately kept every internal name (folder, module, CSS classes, the scene registry key) as `constellation`, on the reasoning that none of it is visible to a visitor. The URL hash turned out to be the exception — literal, visible, address-bar text — and Scott caught it live. Fixed with a one-way slug translation at `main.js`'s two hash read/write points: the scene now writes `#harmonics`. (Initially over-built this as a backward-compat shim for old `#constellation` links; corrected after Scott pointed out no such links exist to preserve — simplified back down.)

## Current state

Local commits through `fabfb6d` (3.1.3) are in the repo. Everything through 3.1.2 has been pushed and confirmed live on production; 3.1.3 (the URL fix) was shipped most recently and should be pushed next to go live. No sandbox push access on my end — pushes have to happen from Scott's own machine.
