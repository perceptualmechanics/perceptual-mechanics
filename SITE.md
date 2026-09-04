# SITE.md — what perceptualmechanics is

**This file is current, not historical.** It carries no version number, no date
and no addressee, and nothing in it is written as an argument. Everything here
is a fact about the site as it stands. If something in it is wrong, fix it here
rather than writing a correction somewhere else.

It exists because the description of this project used to live in a brief, and a
brief is a missive: addressed, dated, about one piece of work, dead on arrival.
Facts kept in briefs go stale and get restated wrong, which is the failure
`CORRECTED-FACTS.md` was created to catch — and it was happening to the document
that described the whole project.

**Where each kind of thing goes.** Anything with a date goes in `NOTES.md`.
Anything that is an argument for doing one piece of work goes in a brief.
A rule about how we build goes in `STANDARDS.md`. A claim that was wrong and
came back goes in `CORRECTED-FACTS.md`. How the two Claude instances work
together goes in `WORKING-PROTOCOL.md`. What the site *is* goes here.

**One rule per file.** If a fact appears in two knowledge-base files, one of
them is a pointer. Two copies drift, and the drift is invisible until they
disagree.

---

## What the site is

perceptualmechanics.com is Scott Jason Cohen's digital-art portfolio: a
single-page, full-screen site built around **twelve interactive scenes**, each a
small standalone piece combining generative visuals, curated writing and found
text, and in most cases generative or triggered audio. It is static — no
backend, no database, everything client-rendered, deployed as a plain `dist/`
upload to DreamHost.

**The writing is the point.** The visuals are how the writing is encountered,
not decoration around it. Most of the published text is drawn from two book
projects that live outside this repo in a Scrivener file (`Holography.scriv`).

**Every page is fundamentally a document.** That premise is why a scene's
content lives in a `.text.js` module the scene and the crawlable `/text/` page
both import, why a scene that publishes writing must have a `/text/` page in the
same pass, and why the archive is generated rather than written.

The working relationship is Scott (vision, writing, curation) and Claude
(implementation, literary analysis).

---

## The corpus

**Two figures are in use, they measure different things, and both are correct
under their own ruler. Quote either one with its ruler attached.**

**36,886 published words.** Published means text a reader can actually
encounter, in a scene or on a `/text/` page. It counts dialogue and stage
directions, titles, scene slugs, and the Library's bibliographic entries and CD
rack, each once. It excludes the Library's `catalog` field and its withheld
notes, which ship in the bundle but are never rendered. It excludes Scroll's
presentation-table text, which is verbatim copies of phrases already counted in
the body. Apollo does not move this figure and its `/text/` page is not in it:
that scene publishes wavelengths, not writing. Counting the withheld material
as well gives **37,955 authored**; the honest range is 36,900–38,000 and the
difference is entirely the Library.

**3,221 sentences, 34,790 words, in 119 pieces across 9 scenes.** The narrower
ruler, defined in `src/utils/corpus.js` and printed on `/text/psyshell/`. This
is the figure Psyshell is built from rather than a figure about the site. It
counts only the fields that reader treats as writing — Library excerpts but not
Library notes, for instance — which is why it is smaller.

The gap between the two is the answer to "is a note about a book's edition part
of the site's writing", which is a real question with two defensible answers.

**The sentence split** is `prose`: an ellipsis and an em-dash are not sentence
boundaries, so an interrupted or trailing line is one sentence. Two alternatives
were measured against it; across the whole corpus the three give 4,054 / 4,047 /
4,191 units before filtering, a 3.6% spread. A unit must be a sentence to count:
four words or fewer with no terminal punctuation is not one, which excludes 508
fragments of cataloguing marginalia and element labels.

**Two scenes publish nothing of their own, and that is a fact about them rather
than an omission.** Harmonics is a view of the connections between other scenes.
Outside publishes five power-source names and two origin labels, none of which
are sentences. Both are named in `TEXT_EXEMPT` with that reason.

**The scenes are not peers, and anything measured across "the corpus" is
measuring Scroll unless it says otherwise.**

| scene | words | share | | scene | words | share |
|---|---:|---:|---|---|---:|---:|
| scroll | 19,621 | 53.2% | | beamline | 283 | 0.8% |
| theater | 7,430 | 20.1% | | orrery | 263 | 0.7% |
| sphere | 4,386 | 11.9% | | outside | 33 | 0.1% |
| library | 3,007 | 8.2% | | butterfly | 12 | 0.0% |
| orbiter | 1,851 | 5.0% | | harmonics | 0 | 0.0% |

Scroll alone holds over half. Four scenes hold 591 words between them. This is
not a defect — a Lorenz attractor does not want prose — but it is a fact a
session needs before it starts counting rather than after.

**The scenes with more writing are the stiller, smoother ones.** Measured
2026-09-04 across the nine publishing scenes: word count against visual
complexity is r = −0.862 (p = 0.003), and against motion r = −0.798 (p = 0.010).
A scene you read holds still. This is a fact about the site regardless of what is
built on it, and it came out of a measurement that failed at its stated purpose —
an attempt to use Shannon entropy of the writing as an axis for the landing
field, dropped because character-level entropy spans only 0.109 bits across the
nine (the noise threshold was 0.1), because every whole-scene ruler turned out to
be word count in disguise (conditional H₃ correlates +0.979 with log N), and
because corrected to a matched sample it can place only eight of the twelve
scenes. **Whenever an entropy figure for this corpus is quoted, quote the ruler
and the correction with it** — see `CORRECTED-FACTS.md`.

**Some modules export the same text twice, on purpose**, so any measurement that
walks a module's exports must name **which export** it counted.
`theater.text.js` publishes `PIECES` (nested) and `BEATS` (a flat index over the
same beats, so Harmonics can address one beat); `scroll.text.js` publishes twelve
pieces individually and the assembled `scrollPieces`. Counting the namespace
counts the words twice and produces a plausible number.

---

## The landing page

A grid of twelve circular tiles — two columns on a phone, three or four across
as the viewport allows, each tile a live preview of its scene. It is a real
`<ul>` of twelve `<li><button>` in a stated order, which is what makes it work
with JavaScript off, for a crawler, and for a screen reader.

**The grid asserts that all twelve scenes are the same kind of thing**, equally
weighted and equally sized. That is a real limitation and it is worth naming:
true at five, already slightly false at twelve, and a wall of circles at twenty.

**It was replaced once and put back.** v4.10.0 shipped "the field" — twelve
scenes on one plane, each at a position measured from its own rendered frames,
settling out of a sorted block the way a two-gas box mixes. It worked. It was
reverted at 4.10.1 because **the problem it solves is not here yet**: twelve
tiles in two rows is fine, and the ceiling on scene count is the quality bar
rather than the layout. Solve it when it hurts — which is also cheaper, because
by then the actual constraint is known.

The measurements and the placing arithmetic are kept, shelved and out of the
build, in `src/utils/sceneField.js` — the same status as `src/scenes/spectra/`.
**The condition for unshelving is a thing you can look at: when the tiles get
too small to read.** The revert was cheap, and will be again, because the field
was a layout applied over this same list rather than a replacement for it — the
markup never changed.

Two findings from that work outlived the feature and are recorded here rather
than in the shelved file: the word-count correlation above, and the entropy
negative result below.

### The entropy axis, and why it is a dead end

Recorded so nobody tries it a second time. Shannon entropy of each scene's
published writing was measured three ways as a candidate axis and dropped:

- **Character-level** spans **0.109 bits** across the nine publishing scenes
  (4.161–4.270). The stated threshold for calling a ruler noise was 0.1.
- **Every whole-scene ruler is word count in disguise.** Correlation with
  log(word count): word-level +0.965, conditional H₂ +0.959, H₃ +0.979, gzip
  −0.857.
- **Corrected, it can place eight of twelve.** Rarefied to a common 250-word
  sample it survives — spread 0.483 bits against a mean bootstrap SD of 0.102 —
  but Harmonics, Outside and Psyshell publish no sentences, and Butterfly's six
  words carry no estimate under any correction. That is a coverage failure, not
  a convention problem.

The visual rulers that replaced it, for the record: spatial complexity (share of
spectral power above a quarter of Nyquist, 1.03 %–60.5 % across the twelve) and
motion (mean absolute frame difference at 0.1 scene-seconds, 0.00016–0.0432).
Independent of each other at ρ = +0.38, p = 0.23, and independent of every text
ruler — which was the gate the idea had to clear, and did.

---

## The twelve scenes

Counts are read from the live content modules. "Real" and "rendered" are
separated because several of these scenes are built on actual data and the
distinction is the first thing a session gets wrong.

| Scene | What it is | Content | What is real, what is a rendering |
|---|---|---|---|
| **Sphere** | An interactive geodesic sphere with text fragments in its faces | 25 fragments | The geodesic subdivision is real geometry; the fragments are Scott's found text |
| **Butterfly** | A Lorenz attractor, "Chaos Butterfly in Phase Space" | a title, essentially | The attractor is integrated live from the Lorenz equations. Its only text is its own placard title |
| **Scroll** | "Selected Works" — a scroll of found writing and carved fragments | 12 pieces, 314 paragraphs | All writing; the scroll is presentation |
| **Theater** | ASCII actors performing scenes from three plays, with a silhouetted house audience. A different program each visit | 3 plays, 16 scenes, 736 beats | The scripts are real; the actors and staging are generated. The piece level is the **scene id**, not the play |
| **Orbiter** | A hydrogen p-orbital as a probability cloud, with satellites in elliptical orbits | 14 poems | The cloud is sampled from the orbital's probability density; the satellite orbits are decorative |
| **Orrery** | "The Orrery of Los Feliz" — a found story told through a 30-foot walkable orrery. WASD, not orbit-drag | 1 found account | The orrery is a described object rebuilt to scale; the account is found text |
| **Library** | A real bookshelf rebuilt as a shelf you can turn and read spines from | 150 items + 115 CD-rack items; 30 carry excerpts, 100 carry notes | The shelf is Scott's actual shelf. Excerpts are third-party text and are handled under the copyright rule below |
| **Beamline** | A vessel travelling a glowing rail across a night wilderness, with ten stations along it | 10 stations | The rail and vessel are generated; each station holds a fragment of found text |
| **Harmonics** | Resonant connections across every other scene's content, as a force-directed graph with Kuramoto phase-sync and sonification | 64 approved resonances | The resonance rows are editorial judgements, approved individually. The layout and phase-sync are generated |
| **Outside** | A generated lotus (Gielis superformula) mapping a five-part cosmology — Power Sources as petals, Folk Origins, Magi and Psi at the centre | 5 power sources | The superformula geometry is real; the cosmology is the fiction's |
| **Apollo** | A solar spectrum you can play, in two modes with an idle state. Absorption puts ten elements' lines into a band of starlight as gaps you sound by clicking; emission darkens the band and stands the same lines in it bright, struck rather than sustained; **Sunlight** is the idle state and puts the sun's own composition in the light, letting its lines sound on their own | 10 elements, 218 lines (iron 50, sodium 6) | **Hydrogen is computed live from the Rydberg formula**, with the reduced-mass correction and a vacuum-to-air conversion, which is why it lands on the published values. The other nine are NIST strong-lines tables. The corona is procedural. The only scene with no Three.js and no WebGL context, and the only one whose content is measurement rather than writing |
| **Psyshell** | *lens RE73415.* A small crystal antler suspended in a web that fills the frame — no floor, no room; the web is the ground. It holds every sentence on this site. A lightpen reads one, and the light of that sentence's ordinal travels through the crystal's own body in **base e** — unequal flashes, legible as transmission and never readable as text. The reading sounds as a rush going past &mdash; noise through a moving filter into inharmonic resonators, pitch falling through the crossing, sweeping across the stereo image, and lasting exactly as long as the transmission it belongs to | 3,221 sentences, 34,790 words | The corpus figures are real and asserted at import. **The object's shape encodes nothing** — positions are a seeded draw, deliberately; see below. **The field is not a backdrop**: the web is the same structure as the lens at a larger scale, its junctions are bright in proportion to how many strands meet there, and it is **one connected graph** (checked at build: every node reachable from a filapixel inside the crystal). It responds to the visitor in no way at all — not to the camera, not to hover — but it **carries** and it has **traffic**: one reading in a hundred escapes the crystal and runs out along the strands, and pulses cross the field on their own every few seconds, sometimes through the lens. Every point in it is a thing arriving from outside time — a photon travels a null worldline, so no proper time elapses along it and the delay is entirely ours |

Earlier scenes — leaf, egg, prism, cycle, and some older constellation and
ground-glimpse mechanics — were built, shipped and retired. The twelve above are
the live set.

**Spectra** is a thirteenth candidate that is in the tree, builds, and is
deliberately unregistered. It reads each speaker in the Theater's plays as a
light source. It was built, verified, and shelved for focus rather than for a
defect; `src/scenes/spectra/SHELVED.md` says what it is and the three edits that
bring it back. It shares nothing with Apollo but the subject word.

**Two cross-cutting layers.** *Links* (146 rows) are explicit editorial
connections: a verbatim phrase already sitting in one piece's text becomes a live
jump to another piece, addressed `{scene, id}` on both ends, with the target
saying "Referenced from —" back. *Resonances* (64 approved rows) are the looser
associative layer Harmonics visualises.

---

## How it is built

The rules and their reasoning live in `STANDARDS.md`. What follows is only the
shape of the thing.

- **Vite 8** (Rolldown-based; the CSS minifier is pinned to esbuild), no
  framework — vanilla JS modules. **Three.js** for every WebGL scene. Plain CSS
  per scene, no preprocessor. Node 24.
- **Every scene is a self-contained folder**: `src/scenes/<name>/<name>.{js,css,html}`
  plus one or more `.text.js` content modules. Nothing about a scene lives
  outside its folder except `src/utils/sceneKit.js` (the shared lifecycle and
  interaction helpers) and its one entry in `src/scenes/registry.js`.
- **`src/scenes/registry.js` has no imports**, and that is load-bearing:
  `vite.config.js` imports `scripts/prerender.js`, which imports the registry,
  and a bundler follows dynamic imports statically. Scene loaders live in
  `main.js`, derived from the registry's keys with `import.meta.glob`.
- **`scripts/prerender.js`** generates a static `/text/<scene>/` page for every
  scene from the same content modules the scenes render from.
- **The build fails rather than warns.** Gates that run on every build: every
  scene has a `/text/` page or a stated exemption, in three directions; every
  link and every resonance resolves to a real piece; `index.html`'s nav icons and
  landing tiles match the registry's length; and the `/text/` pages' inline style
  block hashes to the value the CSP allows.

---

## Decided, and why — the short version

The reasoning for each of these is in `STANDARDS.md` or in the file it governs.
Listed here so a session knows the answer exists rather than deriving it again.

- **Scenes do not persist state; preferences may.** A scene resets on entry. The
  sound toggle persists, per scene. An *arrangement* is made addressable instead
  — Apollo's mixtures are shareable as a hash.
- **Layout that depends on another element's size is measured, not constanted.**
  Constants taken from one window and re-used in another have caused the same
  class of bug repeatedly, including a scene drawing itself under its own
  controls on phones.
- **Visual claims are verified against screenshots.** "It should look like X" is
  not a result. Three consecutive Psyshell releases had their answer come from
  rendering rather than from reasoning.
- **A measurement is reported with its ruler**, and a number is never
  re-attributed from one method to another.
- **Published copies import, they never copy.** Two copies of a paragraph drift,
  and the drift is invisible until the site and the archive disagree.
- **A field the scene does not render was withheld on purpose.** "Is this good?"
  is the wrong question; "does the site show this?" is the right one.
- **Renames do not touch the art.** Prose is not a namespace. A global rename
  once reached inside a published fragment and the verifier passed the whole
  time, because the rename corrupted both sides of the check.
- **Third-party text is excluded from the `/text/` pages by policy**, and the
  Library's opening passages from published books are not republished there.
- **Psyshell's field responds to the visitor in no way, and nothing in it
  twinkles.** That indifference is what makes the lens's one response mean
  something, and the absence of scintillation is a fact about vacuum: twinkling
  is caused by matter in the path. Do not add an idle to the field. It does
  carry a reading outward along the strands — carrying is not responding.
- **Psyshell's geometry encodes nothing about the corpus.** Two versions mapped
  reading order and sentence length into the form, with real derivations behind
  both; both produced a diagram rather than an object, and every visual problem
  that followed came from the mapping. Do not re-introduce it.
- **The `/text/` archive is a strict subset of the scene.** It publishes no
  Library notes.

---

## Known open items

The maintained list. An item leaves this list when it is done or when it is
decided; a decision that was recorded as a decision does not belong here, because
this list has twice been read as a to-do after the work had shipped.

- **Beamline's title sits below WCAG AA against its own scene.** With the type
  hidden and the band the title occupies sampled directly, mean luminance behind
  it reads 0.311 — 2.6× the next brightest scene — putting the title at
  **2.6:1**, under the 3:1 minimum for large text. Every other scene clears it.
  The fix is a judgement about Beamline's rail, not a number to change. Logged
  three times; still open.
- **The nav is full at twelve, and a thirteenth scene is a precondition rather
  than a warning.** Twelve icons give a 25.3 × 44px tap target at 320px, which
  clears WCAG 2.5.8 AA (24px) by 1.3px and fails AAA. A thirteenth gives 23.4px
  and fails AA. The sizing is derived from the registry and cannot overflow at
  any count — what runs out is the tap target, not the row. A thirteenth scene
  needs the nav rethought in the same pass.
- **iOS locked-screen audio is untested and probably unsupported.** The desktop
  half is settled: the Mac plays Apollo's Sunlight through a screen lock, in both
  Chrome and Safari. iOS would require routing the whole audio graph through a
  media element the OS recognises as a session, on a path reported to break after
  about thirty seconds, and Wake Lock is unsupported in iOS Safari. **The next
  step is a listen, not a change.**
- **The `catalog` field is private only in the sense of not being rendered.** It
  lives in a module the scene imports, so it ships inside the public bundle.
  Getting it genuinely off the server means moving it out of the bundled module.
  Nobody has asked for this.
- **One Orrery navigation quirk, kept deliberately.** Two adjacent rings' low
  arcs leave a 0.46-unit gap, and a 0.6-unit-wide visitor pressed into it cannot
  strafe out sideways; backing up frees you. Being unable to squeeze between two
  rings is correct.
- **What in `Holography.scriv`'s Research/Notes document is ready to be
  promoted.** The genuinely open editorial question. It is a conversation, not a
  build task.

---

## Where things live

- **This repo** — the live site and all code. Deploys to DreamHost by manual
  `dist/` upload.
- **`SITE.md`** — this file. What the site is, now.
- **`STANDARDS.md`** — how we build, with the reason attached to each rule.
- **`CORRECTED-FACTS.md`** — claims that were wrong and came back, with the
  corrected form and a source for each. Read before writing a brief.
- **`WORKING-PROTOCOL.md`** — how the chat instance and the coding instance work
  together, and the failure mode that made it necessary.
- **`NOTES.md`** — the dated changelog. The one legitimately historical file:
  append-only, reverse-chronological, very long.
- **`Holography.scriv`** — the Scrivener project holding the books the published
  writing is drawn from. Outside the repo. `The New.scriv` is a separate project
  that does **not** feed the scenes; listed only so it is not mistaken for a
  source.
- **Briefs** (`brief-*.md`, `perceptualmechanics-*-brief.md`,
  `punch-list-*.md`, `*-measurement-*.md`) — missives. Each was written for one
  release, and none of them is a source of truth about the project. A brief is
  worth keeping for the reasoning behind a rejected alternative, so it is not
  re-proposed; it is not worth reading for a fact.
