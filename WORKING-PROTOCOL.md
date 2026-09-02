# Working protocol — chat instance and Cowork

*Written by Scott, 2026-09-02, after a run of corrections that were all the
same shape. For the chat instance that writes briefs, for Cowork that builds
from them, and for later sessions of both.*

*Not a process document. A record of a specific failure mode and what actually
reduces it.*

> **Why this is a file in the repo.** It was written as a message, and a
> protocol only later sessions cannot read is not one — which is the same
> observation the document itself makes about the briefs. Added to the tree
> 2026-09-02 in the same pass as v4.4.0, unedited except for this note.
> `STANDARDS.md` points here for the rules that outlive any one release.

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

### 4. Prohibitions get reasons

A brief that says "don't fix this with a hardcoded size" without saying why
invites a workaround. Say what the bad version costs — *it makes the tiles look
right and leaves the reason in place for the next scene to inherit* — so the
constraint survives contact with an easier path.

### 5. Every brief closes by naming what it invalidates

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
- Apollo's corona had a per-strand `speed`, a comment reading "right to left,"
  and an `x` that never changed. The code was correct at what it did — advance a
  wiggle phase — and **the name and the comment claimed a scope it never had.**
  The same shape as the `/text/` check, one file over, found four releases
  later. Nothing failed; the resting state just quietly read as wallpaper, and
  took the strike response down with it, because a response needs something to
  differ from.

> **A number that has an obvious explanation is the one you stop checking.**
> `hell` at 481, in a play set in Hell.

And the corollary, which is the one that applies to this document:

> **An audit's ruler is part of its result.** Say what was looked for as
> prominently as what was found.

### And one that is new, from 4.4.0

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

## Log of this protocol being applied

Kept because rule 4 says a method that failed is a finding, and because a
protocol with no record of use is indistinguishable from one nobody reads.

- **2026-09-02, v4.4.0.** The brief for emission mode stated "iron currently
  breaks the absorption instrument — 218 lines in the band." Iron has **50**;
  218 is the ten-element total, exactly the error this document's first table
  row describes, made again in the same session the document was written. Named
  before building, and the corrected figure is what went into the code comments
  and `NOTES.md`.
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
