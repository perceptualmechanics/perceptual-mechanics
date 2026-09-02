# perceptualmechanics — chat brief

*Handoff for a fresh Claude chat. Current as of **v4.1.3**, 2026-09-02.*

This is the **chat** brief, not the code brief. It assumes no file access, no
repo, no terminal. Its companion, `perceptualmechanics-project-brief.md`, lives
in this repo and is written for a coding session.

---

## What the site is

perceptualmechanics.com — Scott Jason Cohen's digital-art portfolio. A
single-page, full-screen site built around **ten interactive scenes**, each a
small standalone piece combining generative visuals, curated writing and found
text, and in most cases generative or triggered audio. Static: no backend, no
database, everything client-rendered.

The writing is the point. Roughly **57,000 words** of prose, poetry, scripts and
catalog entries are published across the ten scenes, most of it drawn from two
book projects that live outside the repo in a Scrivener file
(`Holography.scriv`). The visuals
are how the writing is encountered, not decoration around it.

The working relationship on the code side has been Scott (vision, writing,
curation) and Claude (implementation, literary analysis) — a long-running
iterative collaboration with a deep written record. `NOTES.md` is a dated
changelog running to hundreds of thousands of words; `STANDARDS.md` holds the
durable rules with the reasoning attached.

---

## The ten scenes

Counts read from the live content modules.

| Scene | What it is | Content |
|---|---|---|
| **Sphere** | An interactive geodesic sphere with text fragments embedded in its faces | 25 fragments |
| **Butterfly** | A Lorenz attractor — "Chaos Butterfly in Phase Space" — drag to orbit | a title, essentially |
| **Scroll** | "Selected Works" — a scroll of found writing and carved fragments, 2000s–2010s | 12 pieces, 314 paragraphs |
| **Theater** | ASCII actors performing scenes from three pieces, MST3K-style, with a silhouetted house audience. Different program each visit | 3 plays, 736 beats |
| **Orbiter** | A hydrogen p-orbital as a probability cloud, satellites in clean elliptical orbits | 14 poems |
| **Orrery** | "The Orrery of Los Feliz" — a found story told through a 30-foot walkable orrery. WASD, not orbit-drag | 1 found account |
| **Library** | A real bookshelf rebuilt as a shelf you can turn and read spines from | 150 items + 115 CDs |
| **Beamline** | A vessel travelling a glowing rail across a night wilderness; found text surfaces at each station | 10 stations |
| **Harmonics** | Resonant connections across every other scene's content, as a force-directed graph with Kuramoto phase-sync and sonification | 64 approved resonances |
| **Outside** | A generated lotus (Gielis superformula) mapping a five-part cosmology — Power Sources as petals, Folk Origins, Magi/Psi at centre | 5 power sources |

Earlier scenes — leaf, egg, prism, cycle, and some older constellation and
ground-glimpse mechanics — were built, shipped, and retired. The ten above are
the live set.

**Two cross-cutting layers.** *Links* (146 rows) are explicit editorial
connections: a verbatim phrase already sitting in one piece's text becomes a live
jump to another piece. One row, addressed `{scene, id}` on both ends, and the
target says "Referenced from —" back. *Resonances* (64 approved rows) are the
looser associative layer Harmonics visualises.

---

## Rules the content follows

Each of these was learned expensively. A chat proposing work that touches content
should know them.

**Published copies import, they never copy.** A scene's writing lives in one
content module beside the scene, and anything that republishes it — the live
scene, the crawlable `/text/` pages, an export — imports that same module. Two
copies of the same paragraph will drift, and the drift is invisible until someone
notices the site and the archive disagree.

**Client-rendered content is invisible content.** Crawlers run JavaScript but
don't click. Anything built inside a click handler is unreachable, which is why
every scene carrying real writing gets a plain `/text/` page generated from the
same module. A new scene with writing needs that page in the same pass or it
ships unfindable.

**A field the scene doesn't render was withheld on purpose.** The Library's
per-item `note` field holds some of the best writing in the file and is
deliberately not displayed — Scott's call, and it stands. An earlier pass
published all of them anyway on the reasoning that they were good. That reasoning
was true and irrelevant. "Is this good?" is the wrong question; "does the site
show this?" is the right one.

**An audit's scope is part of its result.** New, and it cost two passes to
see. A 2026-09-01 finding listed frame-rate-coupled animation in four scenes,
in a table whose column header read "Symptom at 120 Hz". Everything in it was
a coupling that contradicted something else — a reading time in seconds
compared against a frame counter, a belt outrunning the planets it was
derived from. Two more scenes had the same defect with nothing to contradict:
an ambient rotation is not *wrong* at double speed, it is just faster. They
survived, and "coupling in four scenes" was read as "there were four." An
audit organised around symptoms is blind to whatever is uniformly wrong, so
say what was looked for as prominently as what was found — the same rule as
the one above, applied to a survey instead of a number.

**Report a measurement with its method.** Word counts, ratios and "N checks
passed" are all method-dependent. Quoting a number from an earlier run after
changing the method produces a real error. State the ruler alongside the number.

**Renames don't get to touch the art.** New in 4.0, and it cost a real defect to
learn. A 2026-08-18 global rename of *constellations → harmonics* reached inside
a Sphere fragment and left the word `harmonicss` sitting in published found text.
The verifier passed the whole time, because the same rename corrupted the phrase
on both sides of the check. Prose is not a namespace.

---

## Where things stand

Everything below is deployed and confirmed live. Four numbered releases landed
on 2026-09-02, and they divide cleanly into one big one and the ones that came
out of looking closely at what it left behind.

**v4.0 — the audit release.** An outside-in review produced 71 findings, eight
of them live on the production site, and 4.0 closed all eight plus most of the
rest. The headline items: every `/text/` page had been rendering unstyled
since a CSP change months earlier; leaving a scene with sound on stranded a
running audio context; the navigation icons were clipped off both edges of
every 375px phone; a 2.9 MB image was loading on every visit to fill a
36-pixel box. Also a substantial accessibility pass, a shared scene-lifecycle
layer that fixed a class of leaks rather than instances of them, and large
measured performance wins — one scene went from 1,070 draw calls a frame to
18. Findings in `punch-list-2026-09-01.md`; what shipped, in `NOTES.md`.

**v4.0.1–4.0.3** followed it: Sphere's per-label rotation made to actually
reach the screen, the eight held Library notes rewritten and released, HSTS
ramped to a year on evidence rather than on schedule.

**v4.1.0 — Vite 6 → 8**, held back from 4.0 because the build gates hang off
plugin hooks. Vite 8 turned out to replace Rollup with Rolldown entirely — a
different bundler, not a major of the same one. Every gate was proven to still
fail, on purpose, before the site was allowed to build. The real damage was in
the new CSS minifier, which silently deleted three documented fallbacks.

**v4.1.1 — two landing thumbnails that had never drawn.** Harmonics and
Outside only *scheduled* their first frame rather than drawing it, and the
landing page can pause a tile before a queued callback ever runs. So those two
had rendered nothing, on every visit, for as long as the code had been that
way — and nobody could tell, because a thumbnail that has never drawn looks
exactly like one still loading. That indistinguishability was the actual
finding, and the same release made the two states tell apart from the page
itself.

**v4.1.3 — Butterfly's thumbnail** now reaches a legible attractor in about a
second rather than twenty-five. The tile had always run at half the full
scene's rate — a decision made long before any of this and never argued for —
and at that rate it read as a single dim dot for longer than anyone looks at a
landing page, which by the site's own rule is content nobody sees. Preview
only; the full scene is untouched.

**v4.1.2 — frame-rate coupling** out of Butterfly (both the thumbnail and the
full scene), Sphere, and Harmonics' galaxy twinkle. The attractor had been
drawing at the display's refresh rate: twice as fast on a 120Hz panel as on a
60Hz one. The tuned 60fps look is unchanged by construction; what changed is
that it is now the same look on every machine, verified by measurement across
30/60/120/144 fps rather than by looking at it.

---

## Open questions that need a person

These are the ones where a chat is genuinely more useful than a coding session —
they're editorial, not technical.

*(One that is closed, so it isn't re-opened: `beamline.text.js` fragment 6's
"harmonics echoing at mathematically precise points" was flagged during the 4.0
content fix as a possible second victim of the rename that produced `harmonicss`.
Scott confirmed 2026-09-02 that it is his own word, about a plucked string. Leave
it. Also closed in 4.0.1: Sphere's per-label rotation, which had never reached the
screen and now does — folded out of inversion and tapered so it can't snap. It
ships. Closed in 4.1.3: **why Butterfly's thumbnail draws faster than the
scene it previews** — 400 points a second against the full scene's 240. It is
deliberate. The tile is 240px and gets a few seconds of a visitor's attention;
a preview that hasn't become its subject in that window has failed at its one
job. The two rates have in fact always differed (the tile ran at half speed for
years), so this changed the number rather than the principle. Don't "restore"
it to match. And closed in 4.0.3: the eight held Library notes. Scott rewrote all
eight, they were applied verbatim, the catalogue chatter moved to a private
`catalog` field, the dated quote was deleted outright, and `NOTE_HOLD` is now
empty — don't re-open this as a writing job.)*

- **The `/text/` archive publishes no Library notes** while the scene now
  shows 54 of them. Settled as deliberate — the archive stays a strict subset
  of the scene, and the link-graph problem that drove 4.0.2 doesn't exist on
  prerendered pages — but it is a content decision that could be revisited,
  not a technical constraint. That makes it a conversation rather than a
  build task.
- **The eleventh scene**, whenever it comes. The content-sourcing question — what
  in `Holography.scriv`'s Research/Notes document is ready to be promoted — is
  a conversation, not a build task. One place to look, not two.

---

## Keeping this file true

Any implementation brief or write-up for this project ends by naming which
lines of this file and of `perceptualmechanics-project-brief.md` its work
makes untrue — the specific claims, not "the briefs may need updating."
That is the only gate this documentation gets: no test fails when a brief
goes stale. If something here contradicts the repo, the repo is right.

## Working with this from a chat

A chat has no view of the repo. It can't read the content modules, can't check
whether a phrase is verbatim, can't run the verifiers, and can't confirm what a
scene currently renders. Those all matter more than usual here, because half this
project's standing rules exist precisely to catch confident-but-wrong assumptions
about what's on screen.

So the honest division is: **a chat is good for the writing and the judgement,
and should ask for the material rather than reconstruct it.**

**Useful things to paste in:** a scene's content module, for line editing,
sequencing, or finding link candidates. A stretch of `NOTES.md`, for picking up a
thread. The library catalog, for curation questions. A draft of new writing being
considered for promotion into a scene.

**One caution worth carrying:** much of the text on this site is *found* —
transcribed, overheard, or salvaged, not composed to be improved. Before
suggesting an edit to a passage, establish whether it's Scott's prose or
something he found. The instinct to smooth a sentence is the wrong instinct on
half this corpus.

**Where things live**

- **The repo** — the live site and all code. Deploys to DreamHost.
- **`STANDARDS.md`** — durable coding rules with reasoning. Read before any
  "modernise the code" suggestion; it already contains answers rather than
  requiring them to be re-derived.
- **`NOTES.md`** — the dated changelog and working punch list,
  reverse-chronological, very long.
- **`Holography.scriv`** — the Scrivener project holding the books the
  published writing is drawn from. Outside the repo.
- **`seeds.md`** — retired 2026-08-10. Its three entries were folded into the
  Research/Notes document inside `Holography.scriv` and removed; the empty file
  was left in place in case a holding pen outside Scrivener was ever wanted
  again. It is not in use, and the Research/Notes document is the canonical
  intake.
- **`The New.scriv`** — a separate Scrivener project. It does not feed the
  scenes and is not part of either book project the site draws on. Listed only
  so it isn't mistaken for a source; nothing on this site comes from it.

---

*Written 2026-09-02 after the v4.0 release and kept current through v4.1.3, by
the sessions that shipped them. Scene counts and content totals were read from the live modules
rather than recalled. If this file and the repo disagree, the repo is right and
this file is stale — refresh it alongside any release that changes the answers in
it, the way the code brief now says to.*
