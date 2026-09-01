# perceptualmechanics — chat brief

*Handoff for a fresh Claude chat. Current as of **v4.0**, 2026-09-02.*

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

**v4.0 shipped 2026-09-02 — the audit release.** An outside-in review produced 71
findings, eight of them live on the production site, and 4.0 closed all eight
plus most of the rest.

The headline items: every `/text/` page had been rendering unstyled since a CSP
change months earlier; leaving a scene with sound on stranded a running audio
context; the navigation icons were clipped off both edges of every 375px phone; a
2.9 MB image was loading on every visit to fill a 36-pixel box.

Also in that release: a substantial accessibility pass, a shared scene-lifecycle
layer that fixed a class of leaks rather than instances of them, and large
measured performance wins (one scene went from 1,070 draw calls a frame to 18).
The full findings document is `punch-list-2026-09-01.md`; what shipped is the 4.0
entry in `NOTES.md`.

**v4.1.0 (2026-09-02)** took the Vite 6 → 8 upgrade, which had been held back
because the build gates hang off plugin hooks. Vite 8 turned out to replace
Rollup with Rolldown entirely — a different bundler, not a major of the same
one. All four gates still fire and still name the specific fault; the real
damage was in the new CSS minifier, which silently deleted three documented
fallbacks. See NOTES.md's 4.1.0 entry.

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
ships.)*

- **Eight Library notes need one clause trimmed each.** v4.0.2 answered the
  bigger question — a note is now shown wherever it carries a cross-link, and
  stays private otherwise (45 render, 55 don't). Switching the field on then
  caught that a few of those notes are still working notes rather than
  criticism: edition and runtime chatter, and in one case a dated verbatim
  quote of Scott to Claude about an ISBN error, which would have gone live.
  Those eight are held in `NOTE_HOLD` with reasons; `verify-links` reports one
  as ready to release the moment it scans clean. This is genuinely a writing
  job — read the note, cut the bookkeeping clause, keep the criticism.
- **The eleventh scene**, whenever it comes. The content-sourcing question — what
  in `Holography.scriv` is ready to be promoted — is a
  conversation, not a build task.

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
- **`Holography.scriv`** — the Scrivener project holding the two books the
  writing is drawn from. Outside the repo.

---

*Written 2026-09-02, immediately after the v4.0 release, by the session that
shipped it. Scene counts and content totals were read from the live modules
rather than recalled. If this file and the repo disagree, the repo is right and
this file is stale — refresh it alongside any release that changes the answers in
it, the way the code brief now says to.*
