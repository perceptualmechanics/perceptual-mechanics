# Outside — session brief

What got built: the tenth scene on perceptualmechanics.com, shipped as **v3.3.0** (tag `v3.3.0`, committed locally — needs a `git push` from Scott, same as everything else this session since the sandbox has no SSH access).

## The idea

Every other scene on the site visualizes one account of its own found material — Beamline's mirrors, Harmonics' resonances, and so on. Outside does something different: it visualizes the fact that Apherion's own eleven-dimension cosmology (from Scott's *Holography* notes) is itself just *one account among several* the source material describes. Not illustrated with a metaphor — made mechanically true.

Concretely: Apherion's eleven dimensions are real 11-component vectors in genuine 11-dimensional space. "Apherion's view" and "OER's view" are two different, real 3×11 projection matrices applied to that same underlying data. There's no default account — the on-screen orientation drifts continuously from load and occasionally, briefly, happens to align with one account or the other, without ever pausing there or announcing it.

## The math

- Apherion's eleven dimensions are the standard basis of ℝ¹¹. Centered, they form the vertices of a regular 10-simplex. Apherion's own projection is the closed-form maximal-symmetry view of that shape — the first two nontrivial discrete-Fourier eigenvectors of the 11-cycle. No eigendecomposition library needed, just trigonometry.
- OER's projection is the same construction restricted to seven of the eleven dimensions (`OER_KEPT`). The four dropped dimensions get a literal zero in every basis vector — mathematically absent from that view, not dimmed.
- True rotation in 11D happens in 2-plane rotations (`rotateInPlane`), general enough for any orthonormal pair, not just coordinate axes. Ambient drift continuously rotates six fixed coordinate-index planes at different, incommensurate frequencies. Dragging (which replaces camera-orbit here) rotates two account-derived planes instead — horizontal drag separates OER's kept/dropped dimensions, vertical drag pulls toward Apherion's own basis.

## Michael, Gabriel, Lucifer

Real electroweak symmetry restoration, at the actual measured Higgs mass, is a smooth crossover — not a sharp phase transition. So the split between Michael and Gabriel uses a `tanh`-based blend with no clean threshold, rather than a kinked animation curve. They sit opposite each other along the one axis either name is textually anchored to (Mnemosyne). Lucifer has no independent position at all — always exactly their midpoint, literally realizing the found line *"I am the intersection of Michael and Gabriel."* A faint trace of the underlying separation-vs-temperature curve sits nearby as its own small diagram, since the real 3D positions only trace a straight line, not a curve — the curve only exists as a 2D plot of the relationship.

## Sound

Two oscillators at a shared pitch, detuned apart by up to ±7Hz as the Michael/Gabriel split moves — the beat frequency is the split's audible signature. Both run through one shared lowpass filter driven by how closely the current view matches a named account: OER's narrow view keeps only the fundamentals, Apherion's fuller view opens the filter toward ~9kHz. Same lazy-`AudioContext`-on-first-click convention as Harmonics.

## Content

Every label, keyword, and quoted excerpt is transcribed verbatim from Scott's own `Holography.scriv` project notes (uploaded this session) — no new writing, matching the site's standing rule. Two of the five "Power Source" anchors and all four of OER's dropped dimensions are explicitly flagged as reasoned inference rather than claimed pre-existing canon, and the Antimatter Bottle's excerpt is honestly `null` rather than backfilled, because that Interlude chapter was never actually written.

Along the way, reading the real source material caught two things a pasted brief got wrong: the five "Sources of Power" don't include Michael and Gabriel at all (they're the bright idea, singularities, antimatter bottle, portable hell, and chaos engine — Michael/Gabriel are angels tied to Lucifer's own document instead), and Scott's own Notes.txt attributes OER's "seven-layer cosmology" to the wrong source excerpt (it actually describes the Machinists' Union). Both were surfaced rather than silently resolved or silently followed.

## A real bug, caught before shipping

The panel's content functions were updating the title and body correctly, but never adding the `.open` CSS class — so touching a point silently did nothing. Found this by wiring a temporary debug hook through the *exact* pick/click code path (not a shortcut around it), confirming the raycasting itself was correct, and then confirming with a real mouse click on rendered geometry that the panel still didn't visibly open. Fixed, then re-verified with another real click.

Also needed: halo layers on the sparse dimension/Power-Source/Michael-Gabriel points (they were nearly invisible at a size that looked reasonable in code — same lesson as Harmonics' dust-lane layer earlier this session), and the ghosting bifurcation curve needed scaling down after an initial pass rendered it screen-spanning instead of faint.

## Site wiring

New nav icon (a real regular 9-gon with one axis line, echoing the projection idea at icon scale), new landing preview tile, and the landing grid's row-break moved from a 4-and-5 split to an even 5-and-5 now that there are ten scenes. Colophon copy updated to "ten small experiences."

## Verification

Live on Scott's own dev server, not from a screenshot: dragged and watched the point cloud genuinely reconfigure (SO(11)-plane rotation, not a camera orbit); froze the ambient drift via a debug hook and confirmed the account-closeness scores track a real subspace-alignment computation rather than a fixed default, and that the temperature-to-separation mapping follows the tanh formula exactly; opened and closed a real panel via a real pointer click (Aphrodite's keywords); toggled sound on and off; checked the console for errors from the scene's own code (none). All debug hooks stripped before the final build. Clean `npx vite build`.

---

*Not committed to git — this is a scratch handoff document, matching the earlier Harmonics session brief.*
