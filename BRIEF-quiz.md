# Brief — Quiz, the fourteenth scene

*Scott's brief, given in conversation on 6 September 2026. Written to a file
after the build rather than before it, which is the wrong order — see
`WORKING-PROTOCOL.md` rule 7. The reconstruction below is Cowork's, from the
conversation, and Scott should correct it where it has drifted.*

**Why this file exists.** The brief governed a build and lived only in a chat
message. "Consult the brief before assessing the build" has no object when the
brief has no path. Every other governing document here is a file; this one now
is too. A brief that governs a build goes into the repo *before* the build
starts.

---

## The subject

W. B. Yeats, `A Vision`. A sincere personality inventory that places the
visitor on the Wheel of the twenty-eight incarnations.

## The rules, as stated

**Nothing signals what is coming. No self-awareness anywhere.** The scene is a
personality quiz until the moment it is not. Until the form is submitted,
nothing may name Yeats, the Wheel, the phases, or the number twenty-eight —
not the preamble, not the items, not the hint, not the landing tile's
description, and not the picture behind the questions.

**The items are boring on purpose.** Survey-flat, indistinguishable from a
magazine instrument. *"I would rather be good at what I already do than start
something I would be bad at."* A line that reads as literary is a tell, however
good it is: a reader with an ear knows something is coming, and the ending is
spent.

**The system is treated as literal truth.** No hedging, no "of course this is
only a poetic schema", no wink. As detailed as Yeats allowed.

**The verdict is a judgment, not a summary.** Once the quiz is done it
disappears, the gyres whirl into full frame, and the judgment is dispensed. All
caps, in your face, a total tonal contrast to what came before. *This is your
destiny as determined by the cycle.*

**Facts and structure are free; prose is not.** Yeats's own designations — the
phase names, the Faculties, the symbols, the people he named — are the system's
vocabulary and can be quoted. Nobody's paragraphs can.

**State must not persist.** No storage, no hash argument. Leaving and coming
back gives a blank form.

**A `/text/` page is required**, and real form accessibility: fieldsets,
labels, keyboard-completable, an `sr-live` result.

**The landing requirement is a ship gate.** No icons below the fold on desktop.
Thirteen fit in two rows; fourteen had to be shown to fit before this shipped.

**Two questions Scott decided during the build.** Eight items per scale, so the
keying splits evenly — seven would have split four and three and left an
acquiescence drift in the result. And a scrim behind the text rather than a
text colour chosen to survive a spiral crossing it, because no single colour
does.

## What was corrected mid-build

The first build broke the first rule in four places at once: the preamble named
Yeats, the phases and the Wheel and said two of them could not be yours; the
items read as Yeats-adjacent prose; the registry blurb repeated the whole
premise on the landing tile's aria-label; and a second gyre and a rim of
twenty-eight marks turned behind the questions. All four are fixed, and the
reasoning is in the files rather than here: `quiz.text.js` for the preamble and
the items, `quiz.js` for the picture, `registry.js` for the landing copy.

## What is still open

- Whether the reconstruction above matches what Scott actually wrote.
- Whether the single gyre behind the form is still a tell to somebody who would
  know the diagram.
