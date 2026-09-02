# perceptualmechanics — chat brief

*Handoff for a fresh Claude chat. Current as of **v4.5.0**, 2026-09-02.*

> **Read `CORRECTED-FACTS.md` before writing anything, then
> `WORKING-PROTOCOL.md`.** Both are in the repo and both are short.
> `CORRECTED-FACTS.md` is a source-cited index of claims that were made about
> this project and turned out to be wrong — it exists because one false claim
> reached three consecutive briefs after being corrected in conversation three
> times, and a reply is not a durable surface. If a number or a status you are
> about to state appears there, use the corrected form or say where yours came
> from.
>
> **`WORKING-PROTOCOL.md`** is the reasoning behind that. It
> records the one failure mode this collaboration keeps producing — a number or
> a status quoted from a document and stated as measured — and the rules that
> reduce it. The most load-bearing: quote numbers with their provenance and
> scope, never re-attribute one; `punch-list-2026-09-01.md` is a dated snapshot
> and not a source of open items; if an assumption turns out false, stop and say
> so rather than adapting around it.

This is the **chat** brief, not the code brief. It assumes no file access, no
repo, no terminal. Its companion, `perceptualmechanics-project-brief.md`, lives
in this repo and is written for a coding session.

---

## What the site is

perceptualmechanics.com — Scott Jason Cohen's digital-art portfolio. A
single-page, full-screen site built around **eleven interactive scenes**, each a
small standalone piece combining generative visuals, curated writing and found
text, and in most cases generative or triggered audio. Static: no backend, no
database, everything client-rendered.

Ten of the eleven publish Scott’s writing. The eleventh, **Apollo**, publishes
physics — it is an instrument rather than a piece of writing, and the one scene
whose content is a table of measurements. That distinction matters for the
number below.

The writing is the point. **36,886 words** of prose, poetry, scripts and catalog
entries are published across the ten scenes, most of it drawn from two
book projects that live outside the repo in a Scrivener file
(`Holography.scriv`). The visuals
are how the writing is encountered, not decoration around it.

*The ruler for that number, because it is the most-quoted figure on the project
and every previous version of it was measured differently.* Published means text
a reader can actually encounter — in a scene or on a `/text/` page. It counts
dialogue and **stage directions** (a reader reads them), titles, scene slugs and
the Library's bibliographic entries and CD rack, each once. It excludes the
Library's `catalog` field and its 47 withheld notes, which ship in the bundle but
are never rendered — 4.0.3 settled that private-means-not-rendered is a real
distinction, and this number honours it. It excludes Scroll's presentation-table
text, which is verbatim copies of phrases already counted in the body. Counting
the withheld material too gives **37,955 authored**; the honest range is
36,900–38,000 and the difference is entirely the Library. **Apollo does not move this figure
and its /text/ page is not in it** — the scene publishes no writing of Scott’s,
only wavelengths, and its page is documentation of an instrument. Said here so
the next measurement neither adds it silently nor has to re-derive why it
shouldn’t. Measured 2026-09-02
from the content modules, one export per scene — see
`spectra-measurement-2026-09-02.md` for why "one export" needs saying. The
previous figure of "roughly 57,000" is superseded: 36,886 plus Scroll's
double-counted 19,490 is 56,376, so it appears to have carried the same fault.

The working relationship on the code side has been Scott (vision, writing,
curation) and Claude (implementation, literary analysis) — a long-running
iterative collaboration with a deep written record. `NOTES.md` is a dated
changelog running to hundreds of thousands of words; `STANDARDS.md` holds the
durable rules with the reasoning attached.

---

## The eleven scenes

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
| **Apollo** | A solar spectrum you can play, in two modes, with an idle state. **Sunlight** puts the sun’s own composition in the light and lets its lines sound on their own — the only scene here that plays untouched. A mixture can be shared as a link (`#apollo/ca95,h85,na80`). Ten elements on faders; **absorption** puts their lines into a band of starlight as gaps you sound by clicking, **emission** darkens the band and stands the same lines in it bright, struck rather than sustained | 10 elements, 218 lines across all ten (iron 50, sodium 6) |

Earlier scenes — leaf, egg, prism, cycle, and some older constellation and
ground-glimpse mechanics — were built, shipped, and retired. The eleven above
are the live set.

**They are not peers, and anything measured across "the corpus" is measuring
Scroll unless it says otherwise.** The landing page shows ten equal tiles and
every document here has described ten equal scenes; the published word counts do
not agree:

| scene | words | share | | scene | words | share |
|---|---:|---:|---|---|---:|---:|
| scroll | 19,621 | 53.2% | | beamline | 283 | 0.8% |
| theater | 7,430 | 20.1% | | orrery | 263 | 0.7% |
| sphere | 4,386 | 11.9% | | outside | 33 | 0.1% |
| library | 3,007 | 8.2% | | butterfly | 12 | 0.0% |
| orbiter | 1,851 | 5.0% | | harmonics | 0 | 0.0% |

Scroll alone holds over half. Beamline, Orrery, Outside and Butterfly hold 591
words between the four of them, and Harmonics has none at all — by design, since
it is made of the other scenes' content. This is not a defect: a Lorenz attractor
does not want prose, and the scenes were never meant to be equal. But it is a
fact a session needs *before* it starts counting rather than after. The ruler is
in `spectra-measurement-2026-09-02.md`.

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

**A check's comment is a claim, and nothing verifies it.** The fourth instance,
2026-09-02, and the one that finally names the shape. The deploy workflow
fetched a `/text/` page under a comment reading *"fetching one proves the policy
that ships is the policy those pages were hashed against"* — and tested the
status code. A stylesheet blocked by CSP does not change the status code; the
bug that comment was written for served 200s for months. **The code was fine.**
It does check a status, correctly. The comment claimed a scope the code never
had, and comments are not run by anything. When reading a check, read what it
executes rather than what it says it executes — and when writing one, the
comment is the part most likely to be wrong, because it is the only part with
no test.

**Some modules export the same text twice, on purpose.** Any measurement that
walks a module's exports must name which export it counted, because
`theater.text.js` publishes both `PIECES` (nested) and `BEATS` (a flat index over
the same beats), and `scroll.text.js` publishes twelve pieces individually *and*
the assembled `scrollPieces`. Both derived exports are deliberate and load-bearing
— `BEATS` exists so Harmonics can address a single beat. Counting the namespace
counts the words twice, and because the duplication follows a *good*
architectural decision the result is plausible rather than obviously wrong:
25,328 and 39,111 both look like reasonable word counts for those scenes. Name
the export, not the module. And note the tell that got missed — `hell` appearing
481 times, in a play set in Hell. **A number that has an obvious explanation is
the one you stop checking.** That is the same failure as `verify-links` comparing
corrupt text against corrupt text, and as an audit organised around symptoms: a
result that looks like what you expected, produced by something other than what
you thought.

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

**v4.5.0 — Sunlight, and shareable mixtures.** Apollo gets an idle state, the
first on the site: the sun's own composition, from the five elements that own
every labelled line in the Fraunhofer table, with lines waking at their own
intervals weighted by depth. Not a loop by construction — Poisson arrivals, no
periodic component — and measured over ten minutes: 336 notes, sd/mean 0.970
against an exponential's 1.000, chi-square 2.21 on the weighting, longest
repeated run 3 notes where chance predicts 0.134. The composition is sourced
from the Fraunhofer table; the fader amounts are explicitly a ruler, because
abundances would have put helium second and calcium near nothing. **And the
answer on persistence is no** — scenes reset, and what persistence was reaching
for is a link that carries the mixture instead. See `STANDARDS.md`.

**v4.4.2 — the rail had been covering the wavelength scale on every phone.**
Asked to double-check the pitch ruler on mobile; found the ruler under the rail,
and the nm labels and the bottom of the band under it as well, since 4.4.0 made
the rail a row taller. Two constants that were correct at the desktop window
they were written at — the same failure as the nav-icon count, one layer down,
the day after that rule was written. The band's height and position now come
from where the rail actually is. Also two findings inside one Three.js console
warning: a `.toNonIndexed()` call in Sphere that had never done anything, and a
face-count formula beside it that is wrong at every detail above 1 while
agreeing at the two values anyone would check by hand.

**v4.4.1 — the gas itself made percussive.** Emission shipped sounding like a
tone that arrived quickly rather than a thing that was struck: 16.6% of the
first second's energy was in the first 60ms. Each voice now opens with a 50ms
noise burst band-passed at its own line's frequency — broadband at the moment of
contact, which is what a strike is — with the filter's Q tied to the note's
length, because a short-lived emission genuinely is spectrally broader. Plus a
two-stage envelope and a compressor that was eating the transient it existed to
protect against. Now 50.3% for sodium and 65.8% for iron, with the sodium beat
intact.

**v4.4.0 — Apollo gets a second instrument, and the gallery is 4/4/3.**
Emission mode: the same wavelengths from the other side, so the element data is
untouched and only what the light is doing changes. The band goes dark and the
lines stand bright in it; the corona goes with it, because there is no light in
transit when the gas is the source; and a note becomes a strike rather than a
tone. Fader state persists across the switch. The binding constraint turned out
to be the sodium beat — a plucked decay is shorter than its 1.94-second period —
so the emission decay depends on voice count: 4.2s for a few lines, 1.4s for a
crowd. Verified by rendering the pair offline and counting two beat maxima, not
by inferring them. Separately, the corona was found never to have translated at
all — only its wiggle phase advanced — which is why the resting state read as
wallpaper and why the strike response had nothing to differ from. And eleven
tiles no longer end in an orphan: 4/4/3 at desktop, 3/3/3/2 at tablet, with the
column count derived from the registry rather than typed anywhere.

**v4.3.0 — Apollo, the eleventh scene.** An absorption spectrum you can play:
a band of starlight with the lines missing from it, a corona streaming in from
the right, and ten elements on faders that put themselves into the light.
Clicking a dark line sounds that wavelength as a pitch, so what you play is the
absence. Hydrogen’s lines are computed live from the Rydberg formula and land
on the published values exactly — 656.288 / 486.138 / 434.051 / 410.178, limit
364.601 — which needs both the reduced-mass correction and a vacuum-to-air
conversion to come out right. The other nine elements are NIST tables. The
sodium doublet, which is the sonification’s whole claim, beats at a measured
0.52 Hz. Nothing to do with the shelved Spectra; see the closed question below.

**v4.2.1 (2026-09-02)** removed CSP reporting rather than completing it, and
fixed a check that described itself as testing the thing it could not see. The
deploy fetched a `/text/` page and read the status code, under a comment saying
that proved the served policy matched the hash those pages were built against —
a blocked stylesheet still returns 200, which is how eight pages stayed unstyled
for months. It now hashes the `<style>` block out of the served bytes and
asserts it against the policy on the same response. The reporting header was
pointing at a URL that 404s; it is gone, with the reasoning in `.htaccess`.

**v4.2.0 (2026-09-02)** taught the build to notice a scene with no `/text/`
page. A candidate eleventh scene was written to find that out and then shelved —
see the closed eleventh-scene question below. (The scene that actually became
the eleventh, Apollo, is a different piece of work and was this gate’s first
live customer: registering it without a `/text/` page fails the build.)

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
- ~~**The eleventh scene**~~ — **closed 2026-09-02.** It is **Apollo**, shipped
  in v4.3.0. It is *not* the Spectra candidate below and shares nothing with it
  but the subject word; both are recorded here so neither gets proposed again as
  the other. Apollo generates its own content from physics, which is also why it
  is the first scene that adds no words to the corpus.

  The candidate that was taken most of the way and put down, kept here so it is
  neither lost nor re-derived: **Spectra** would read each speaker in the Theater's three plays as a light
  source: emission is what a voice produces, absorption is what its cast says
  that it never does. Two measurements and one build happened on 2026-09-02:
  - The **site-wide** version — each *scene* as a source — was measured and
    **rejected on the numbers**. No element appeared in exactly one scene, none
    appeared in nine or ten, five of ten scenes had almost no text, and emission
    and absorption came out exact complements of a single quantity. Full working
    in `spectra-measurement-2026-09-02.md`.
  - The **dialogue-scoped** version — each *speaker* as a source — was measured
    and **survived**: no two of the eighteen qualifying speakers share a style
    profile, and absorption scoped to a cast is genuinely different information
    from emission rather than its inverse.
  - It was then **built, verified, and shelved for focus rather than for a
    defect**. It worked. The code is in `src/scenes/spectra/` and
    `SHELVED.md` there says what it is and the three edits that bring it back.

  So Spectra is a working scene on a shelf, not an unanswered question. Bringing
  it back is a decision about whether the site wants a *twelfth* scene, and
  `SHELVED.md` lists the three edits it needs — one of which, `--nav-count`, is
  now 11 for Apollo rather than 10, so a restore takes it to 12.

- **What in `Holography.scriv`’s Research/Notes document is ready to be
  promoted.** The content-sourcing question, and the one that is genuinely open.
  It is a conversation rather than a build task, and it survived both the
  Spectra shelving and the Apollo build untouched — Spectra measured writing
  that already exists, and Apollo brought its content from outside the corpus
  entirely. Neither one answered it. One place to look, not two.

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
