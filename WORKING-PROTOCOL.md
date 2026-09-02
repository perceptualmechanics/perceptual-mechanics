# Working protocol — chat instance and Cowork

*Written by Scott, 2026-09-02, after a run of corrections that were all the same
shape. For the chat instance that writes briefs, for Cowork that builds from
them, and for later sessions of both.*

*Not a process document. A record of a specific failure mode and what actually
reduces it.*

> **Why this is a file in the repo.** It was written as a message, and a
> protocol only later sessions cannot read is not one — which is the same
> observation the document itself makes about the briefs. Scott's text is
> reproduced unedited; the two sections marked *(added by Cowork)* at the end
> are not his and can be cut freely. Revised 2026-09-02 to Scott's second
> version, which added the Butterfly row, rule 4, and four entries to the
> shared-lesson list. `STANDARDS.md` points here for the rules that outlive any
> one release; **`CORRECTED-FACTS.md` is the durable surface rule 4 asks for.**

---

## The failure mode, named

Over a two-day arc, nearly every correction ran one direction: **the chat
instance stated something as fact that came from a document, and Cowork found
the code said otherwise.**

The instances:

| What was claimed | What was true | Source of the error |
|---|---|---|
| Iron has 218 lines in the band | 218 is the **total across all ten elements**; iron has 50 | Number lifted from a report where it was correctly labelled, and re-attached to the thing being written about |
| `PPF` is preview-only | `preview ? 2 : 4`, one shared loop — full mode equally coupled | Assumed from symptom |
| `PPF` has one consumer | Three, one of which is a back-reference that must equal the frame's actual step count | Assumed from the first sighting |
| Blank tiles were an unsized renderer | The 300×150 is a 2D display canvas that sizes lazily in `blit()` — it means *no frame ever completed* | Inferred from a default value |
| A CSP collector needs its domain in `connect-src` | Reports are sent out of band and aren't subject to the policy | Recalled, not checked |
| Two `.htaccess` items were open | Both fixed in v4.0 with reasoning in comments | Punch list read as current |
| v4.0.1–4.0.3 not deployed | Deployed; the punch list's own status block had been corrected earlier that day | Punch list read as current |
| Butterfly's thumbnail takes 25s to become legible — "a live open question" | Fixed in v4.1.3. `butterfly.js:617`, `PPS = preview ? 400 : 240` — the tile reaches the shape in about a second | **Stated three times across three briefs, corrected by Cowork each time** |

**This is not a communication problem between two instances.** It is one
structural fact:

> **The chat instance writes from documents. Cowork writes from source.
> Documents on this project go stale faster than anyone updates them.**

Everything below follows from that.

---

## Rules for the chat instance

### 1. Don't restate measured numbers as fact

A number in a brief reads as measured. Most of the chat instance's numbers
aren't — they're quoted from a prior report, sometimes correctly and sometimes
with the label dropped, which is exactly how 218 became iron's line count.

**Write instead:** *"The v4.3.0 report gives 218 lines total across ten
elements; confirm iron's own count before building on it."* Provenance and
version, or don't state it.

**Never** re-derive, round, or re-attribute a number from another document. If
it needs restating, restate it with its original scope attached.

### 2. `punch-list-2026-09-01.md` is not a source of open items

It is a dated snapshot whose own status block says so and defers to the project
brief. It has now been cited as current twice after the work had shipped.

**The maintained list is `perceptualmechanics-project-brief.md` → *Known open
items*.** That's the only one to quote. The punch list is worth reading for the
*evidence* attached to each finding — what was reproduced in a browser versus
read from code — and for the two findings it left uncorrected on purpose. Not
for status.

### 3. The assumptions block stays, and names its source

Three consecutive Butterfly briefs had a false assumption caught at the top.
The block works. One addition:

**When an assumption comes from a document rather than from source, say which
document and which version.** "From `NOTES.md` 4.1.2" is checkable in seconds;
"I believe X" makes Cowork re-derive the whole thing.

Keep the standing instruction: **if an assumption is false, stop and say so
rather than adapting around it.** That instruction is why nothing broken
shipped.

### 4. A correction goes into a file, not a reply

**This is the rule the Butterfly recurrence exists to produce.**

Cowork corrected the 25-second thumbnail claim at the top of the Apollo build.
The chat instance acknowledged it in the reply, and then repeated it in the next
brief. Then again. Three times, because **the correction lived in conversation
and the next brief was written from documents.**

A reply is not a durable surface. The moment a correction lands, it goes into
whichever file the next session will actually read — the project brief,
`NOTES.md`, `STANDARDS.md`, or the working notes. If there is no obvious file,
that is itself the finding: the fact had nowhere to live, which is why it came
back. **`CORRECTED-FACTS.md` is that file** — a durable surface for corrections
with no better home. The chat instance reads it before writing a brief; Cowork
adds a row whenever it corrects a claim that came from one.

**Corollary for the chat instance specifically:** when Cowork corrects a claim,
write it down before writing the next brief. Not after.

### 5. Prohibitions get reasons

A brief that says "don't fix this with a hardcoded size" without saying why
invites a workaround. Say what the bad version costs — *it makes the tiles look
right and leaves the reason in place for the next scene to inherit* — so the
constraint survives contact with an easier path.

### 6. Every brief closes by naming what it invalidates

Already a standing rule in `STANDARDS.md`. The specific claims, not "the briefs
may need updating."

---

## Rules for Cowork

### 1. Stop rather than adapt — this is working, keep it

Three false premises caught before any code was written, one of which would
have shipped a silent change to the art (the `PPF` back-reference). Adapting
around a wrong assumption produces something that builds, passes, and is wrong.

### 2. When a correction reveals a document is wrong, fix the document in the same pass

**This is the addition.** The Beamline "curved mirrors" sentence lived in at
least four places for months — `main.js`'s ariaLabel, both briefs, and
`scripts/prerender.js`'s live crawlable page — because each discoverer fixed
the copy in front of them.

A correction is a finding about a document, not just about a number. Fix every
copy, or name the ones not fixed and why.

### 3. State the ruler with the result

Already practiced and worth keeping written down. The instances that earned it:

- The sentence-split sensitivity analysis, three rules compared rather than one
  asserted.
- The absorption stoplist — reverse-engineered to reproduce the reference
  figures exactly, then reported as *ordering is robust, absolute percentages
  are a ruler choice*, with the design consequence named.
- The L.A. Project sieve, tightened after a first pass kept 66% — "which is not
  a sieve."
- The corpus double-count, traced to two modules exporting both a source and a
  derived index, with the arithmetic shown.

### 4. Report the invalid harness, not just the working one

The first frame-rate probe compared the whole canvas and two 60fps runs
differed from each other. Saying so is what made the second probe trustworthy.
Same for the first sentence-split regex that read question rates at 0–4% for
everyone — uniformly wrong rather than obviously wrong, and only caught against
an independent table.

**A method that failed is a finding.** It tells the next session what not to
try.

---

## The shared lesson these all point at

Four separate mechanisms, one shape:

- `verify-links` passed because the same rename corrupted both sides —
  **corrupt compared against corrupt.**
- The Report-Only CSP pass was a complete audit *of the SPA at `/`* and never
  opened a page outside it — **zero violations because the violating pages
  never loaded.**
- Finding 16's frame-coupling table was organised around "Symptom at 120 Hz,"
  so it found everything inconsistent with something and was **blind to
  everything uniformly wrong.**
- The deploy's `/text/` check fetched a page and asserted a status code, under
  a comment claiming it proved the CSP hash matched — **a comment claiming a
  scope the code never had.**
- Sorting sodium's lines by frequency selects a pair whose spacing is within 7%
  of the D doublet's, producing a beat of 0.5165 Hz — **a number that agreed
  with the prediction to three figures and was measuring the wrong pair.**
- A comment on `sphere.js`'s face count used `20 × 4²` where the formula is
  `20 × (d+1)²`. **It agrees at detail 0 and detail 1** — the two cases anyone
  would check by hand.
- Apollo's corona had an `x` that never moved, under a variable named `speed`
  and a comment reading "right to left." **The name and comment claimed a scope
  the code never had.**
- Solar **photospheric abundances** are published, sourceable, and would have
  been actively wrong as line-strength weights — helium second, calcium near
  nothing, when calcium's H and K are the deepest features in the visible
  spectrum. **A citation on a wrong answer is worse than an honest ruler**, and
  this is the most dangerous variant of the pattern because it arrives with a
  source attached.

> **A number that has an obvious explanation is the one you stop checking.**
> `hell` at 481, in a play set in Hell.

And the corollary, which is the one that applies to this document:

> **An audit's ruler is part of its result.** Say what was looked for as
> prominently as what was found.

And one about sample size, from the ambient scheduler:

> **A 25-second sample of Apollo's ambient stream read 0.72 notes/s. The
> ten-minute run read 0.560, against a configured 0.55.** A listen would have
> passed. The short sample wasn't wrong about anything except how much it could
> see.

---

## Division of labour, restated

**The chat instance is good for the writing and the judgement.** Diagnosis,
architecture, deciding what a thing is for, naming why a fix is the wrong
shape. It should ask for material rather than reconstruct it.

**Cowork is good for what is true right now.** It reads source, runs the gates,
measures, and looks at the screen.

**Where they overlap is where the errors are.** Any claim about current state —
a count, a version, a file's contents, what shipped — belongs to Cowork. The
chat instance's version of that claim is a hypothesis with a citation attached,
and should be written as one.

---

## A category the list above does not cover *(added by Cowork)*

Not Scott's text. Kept because it came out of his own observation on 4.4.0 —
"the failure mode is now recursive" — and it is a different mechanism from the
ones above rather than another instance of them.

**The failure mode is recursive: a fix can invalidate the instrument that
verified it.** v4.3.0's frame-rate probe read a single pixel's brightness. 4.4.0
made the corona behind that pixel *move*, and it is randomly seeded per page
load — so the probe that had proved 4.3.0 correct started returning different
answers for identical inputs, and would have reported a frame-rate coupling that
did not exist.

This is not the same as a stale document. A document goes wrong by standing
still while the code moves; **a measurement goes wrong by measuring something
the code has since started doing.** The instrument was right when it was
written, was never edited, and became wrong anyway.

What follows practically: **when a change alters what is on screen or what is
audible, re-derive the probes that read the screen or the audio before trusting
them — starting with a repeatability check against the change, not against the
old code.** Two runs at the same frame rate differing from each other is what
caught this, and it cost one run to ask.

---

---

## Log of this protocol being applied *(added by Cowork)*

Kept because rule 4 says a method that failed is a finding, and because a
protocol with no record of use is indistinguishable from one nobody reads.

- **2026-09-02, v4.4.0.** The brief for emission mode stated "iron currently
  breaks the absorption instrument — 218 lines in the band." Iron has **50**;
  218 is the ten-element total, exactly the error this document's first table
  row describes, made again in the same session the document was written. Named
  before building, and the corrected figure is what went into the code comments
  and `NOTES.md`.
- **2026-09-02, the stop hook.** A git hook reported "there are uncommitted
  changes in the repository" after four consecutive turns. Each time it was
  correct that *a* repository was dirty and wrong only about which: it was
  reading the assistant's disposable build clone, not Scott's tree. Each time
  the response was to explain the discrepancy in the reply. The fourth time,
  cleaning the clone took one command and the warning stopped.

  **Explaining a warning repeatedly instead of removing its cause is the same
  pattern one level out** — a correction that lives in a reply, made four times,
  because the thing that would have ended it was a change to state rather than a
  sentence. It also has the shape of the entries in the shared-lesson list: the
  hook's message says "the repository" and checks whichever one it is pointed
  at, which is a message claiming a scope the check never had.

- **2026-09-02, retiring rows.** The retirement rule landed and was applied the
  same pass rather than left for later: nine of the seventeen rows in
  `CORRECTED-FACTS.md` had already been absorbed into documents the next session
  reads, and moved to one-line pointers. One section emptied completely and was
  removed rather than left as a header over nothing. The Butterfly row does not
  retire and is the standing example of a fact with no home — it is already in
  `NOTES.md` and the project brief and came back three times anyway.

- **2026-09-02, after v4.5.0.** Rule 4 arrived naming `CORRECTED-FACTS.md`, a
  file that did not exist. Created, and every row in it re-verified from the
  tree at v4.5.0 rather than copied out of the replies that first made the
  corrections — a corrections file whose corrections are themselves unchecked
  would be the original problem with extra steps. Two rows were rewritten in the
  process: "Fraunhofer catalogued 574 lines" became "over 570, sources differ",
  and the v4.3.0 statement that Apollo needs no lookahead scheduler was recorded
  as *true when written and false after 4.5.0* rather than as an error — a fact
  with an expiry date is a third category the table did not have.
- **2026-09-02, v4.5.0.** **The Butterfly claim came back.** The ambient-mode
  brief again gave "Butterfly's thumbnail takes twenty-five seconds… a live open
  question" as a reason, three briefs after the same sentence was corrected at
  the top of the Apollo build. The recurrence is the finding, not the error: the
  correction lived in a reply, and a reply is not a document the next brief
  reads. This is rule 1's table row happening to the correction rather than to
  the original fact. Nothing depended on it — the argument for running ambient
  in the preview tile stands on its own and is better without it — but a stale
  reason attached to a sound decision is how a stale fact acquires a third life.
  **The fix that would actually work is to state a corrected fact where the next
  brief will read it**, which is what `NOTES.md` 4.1.3 and the project brief
  already say and what a chat instance working from documents evidently does not
  reach. Worth Scott's attention: this file is read by both instances, so the
  correction is repeated here.
- **2026-09-02, v4.5.0.** Two measurements that changed a design rather than
  confirming it. Photospheric abundances were the obvious quantitative source
  for the solar mixture and would have been actively wrong (helium second,
  calcium near nothing) — abundance is not line strength, and the citation would
  have made a wrong answer look sourced. And a 25-second sample of the ambient
  stream read 0.72 notes/s against a configured 0.55; ten minutes read 0.560.
  The short sample was variance and would have been reported as a rate error.
- **2026-09-02, v4.4.2.** Scott asked for one thing — "double-check the pitch
  ruler on mobile" — and checking it found three, which is the argument for
  checking rather than reasoning. The ruler was drawn under the rail on phones,
  and so were the wavelength labels and the bottom of the band; a Three.js
  console warning traced to a `.toNonIndexed()` call that had never done
  anything, and the comment beside it carried a face-count formula that is wrong
  at every detail level above 1. The formula agreed with reality at detail 0 and
  1 — the two cases anyone would check by hand — which is `hell` at 481 again.
  Also: the ruler's `66 * r` offset and the band's `H * 0.40` were both
  constants correct at the window they were written at, the same failure the
  nav-icon count and the tile grid had one layer up, found the day after that
  rule was written down.
- **2026-09-02, v4.4.1.** The percussiveness measurement states its own scope
  in its output: it reproduces ONE voice offline from the numbers the page
  schedules, without the compressor or the room, and the compressor is part of
  why the transient survives. Said in the result rather than left to be assumed,
  because a number labelled "measured" that quietly excludes half the signal
  path is the first row of the table above.
- **2026-09-02, v4.4.0.** Third invalid frame-rate harness, reported under rule
  4. v4.3.0's probe was contaminated by 4.4.0's own change: the corona now
  MOVES behind the sampled pixel, and it is randomly seeded per load, so two
  runs at the same frame rate differed. Fixed by seeding `Math.random` and
  running under reduced motion — which freezes the drift and leaves the strike
  response running, a behaviour verified separately rather than assumed. The
  first version of the wavefront measurement was invalid too: it found the peak
  change at a fixed radius because the struck-line flash is an order of
  magnitude brighter than a displaced filament and buried it.
