# Spectra — does the corpus have lines in it?

> ## CORRECTED 2026-09-02, after the fact
>
> **Two of the word counts in the first version of this document were wrong,
> and they were wrong because of a defect in my own extraction.** A dialogue-
> scoped measurement done independently against `theater.text.js` came back with
> 7,326 words where this document said 25,328, and flagged it. That reading is
> right and this one was not.
>
> **The cause, stated with the method, because this document's own rule applies
> to itself.** The extraction walked each module's entire export namespace and
> summed every string it found. Two scenes export *both* a source and a derived
> index over the same text:
>
> - **theater** exports `PIECES` (nested: piece → scene → beat) *and* `BEATS`, a
>   flattened 736-entry index over the same beats. Walking both counted every
>   word twice — and `BEATS` additionally repeats `sceneSlug` and `playTitle` on
>   every one of the 736 rows, which is 7,508 words of duplicated metadata on its
>   own. Five of the sixteen slugs contain "HELL" (`INT. HELL. OFFICE.` and
>   friends), which is where 114 of the 139 `hell` hits came from. 16,921 + 8,407
>   = 25,328, exactly the number reported.
> - **scroll** exports the twelve pieces individually *and* `scrollPieces`, the
>   assembled superset. 19,490 + 19,621 = 39,111, exactly the number reported.
>
> So the two largest scenes — and only those two — were each counted twice. The
> corrected extraction takes one copy: `scrollPieces` for scroll, and theater's
> beat `t` (dialogue) and `a` (stage direction) fields, which is 6,004 + 1,322 =
> **7,326**, matching the independent reading to the word. Bare-token `hell` in
> theater is **15**, also matching.
>
> **What this changes.** The corpus is 36,782 words, not 74,274. Scroll and
> Theater hold **73.2%**, not 87% — and Scroll alone holds 53.3%, so the
> concentration is more lopsided toward one scene than the original claim was.
> The "87%" figure was passed on as belonging in the briefs; it never got written
> there, and should not be. Theater's intensity profile also changes: its
> top-three share was reported at 65% dominated by `hell` at 481, and that was
> entirely the repeated slugs — corrected it is 34%, with the `hell` group at 32.
>
> **What this does not change.** Every structural finding. Presence and absence
> don't move when text is duplicated, so the emission and absorption counts, the
> spread distribution, the zero universal lines and the zero unique lines are
> identical before and after. The recommendation stands unaltered. All tables
> below are the corrected ones.


*Measurement, 2026-09-02. No code was written. The recommendation is at the bottom
and it is **don't build this**, with one narrower thing that survives and one
finding that matters more than the scene did.*

---

## The short version

Three of the six measurements come back empty, and two of those three are the
ones the idea rests on.

- **Universal lines: none.** No element appears in nine or ten scenes. The widest
  spread in the table is 7 of 10.
- **Unique lines: none.** Not one element appears in exactly one scene. At scene
  granularity or at piece granularity, zero. The claim that a spectrum identifies
  its source has no support in this corpus.
- **Half the sources aren't sources.** Emission runs 39 / 36 / 30 / 27 / 26 / 19
  / 6 / 3 / 1 / 0 lines out of 40. Harmonics has no text of its own by design and
  emits nothing at all. Butterfly emits one line. Outside three, Orrery six.

A spectrum plate of ten sources where five are blank, none share a signature, and
none are individually identifiable is not a fingerprint. It is a ranking of the
scenes by how much prose they contain, drawn as a barcode.

---

## The ruler

State the method with the number, so this can be argued with rather than
re-derived.

**Corpus.** Every string field each scene publishes — what the scene renders or
its `/text/` page carries. Library's private `catalog` field is excluded, and its
`note` field is included only for the 54 items the scene actually shows, matching
`LIBRARY_NOTE_VISIBLE`. HTML tags and entities stripped. Word counts:

| scene | words | share | | scene | words | share |
|---|---:|---:|---|---|---:|---:|
| scroll | 19,621 | 53.3% | | beamline | 283 | 0.8% |
| theater | 7,326 | 19.9% | | orrery | 263 | 0.7% |
| sphere | 4,386 | 11.9% | | outside | 33 | 0.1% |
| library | 3,007 | 8.2% | | butterfly | 12 | 0.0% |
| orbiter | 1,851 | 5.0% | | harmonics | 0 | 0.0% |
| | | | | **total** | **36,782** | |

Named exports only, one copy each — see the correction note at the top for what
the first version of this table double-counted.

**Element table.** 40 entries, derived in the order the brief asked for:

1. All 64 approved resonance rationales read for the vocabulary that made each
   pair a pair. That yields a real seed list — resonance/vibration, mirrors,
   fire and lightning, moon, bone, wound, soul, wings, chaos and attractors,
   equations, physics, earthquake, mask and persona, channeling, synchronicity,
   strange loops, orrery and cosmos, prism, glass, L.A., invention, chi, feather,
   Hermes-as-messenger, kayfabe, egg.
2. Widened by frequency across all ten modules, keeping terms appearing in more
   than one scene that a reader would recognise as carrying meaning.
3. Matched as **variant groups**, not single words, and the grouping is a
   decision rather than a lookup. `wings` is one element covering wing, winged,
   wingspan, flight, flying, flew, feather, plume, peacock — the resonance rows
   treat flight and plumage as one image system, so they are one line here.
   `bone` absorbs boneyard rather than standing separately, which is the specific
   call row 10 flagged as worth Scott's judgment. Split any of these differently
   and the counts move, but not the conclusion — see below.

**A caveat that cuts toward the conclusion.** These regexes are generous.
`theatre` matches "scene" and "play"; `writing` matches every word beginning
"writ". Over-broad matching *inflates* how many scenes an element reaches, so the
real spread is narrower than what follows, and "no universal lines, no unique
lines" would only get more true with tighter matching, not less.

---

## The table

Raw counts. `·` is absent.

```
element         spher  scrol  orrer  orbit  butte  beaml  theat  outsi  harmo  libra   scenes
resonance           8      ·      ·      2      ·      8      2      ·      ·     16       5
mirror              1      8      ·      3      ·      2      ·      ·      ·      1       5
light              10     24      ·      6      ·      8     13      ·      ·      5       6
fire                8     19      ·      3      ·      1      3      ·      ·      2       6
electricity         5      9      ·      3      ·      3      ·      ·      ·      1       5
moon                3      ·      1      4      ·      ·      ·      ·      ·      ·       3
star                5      1      ·      ·      ·      1      2      ·      ·      ·       4
sun                 5      8      1      5      ·      ·      ·      ·      ·      ·       4
cosmos              2     16      8      ·      ·      ·      2      ·      ·      6       5
prism               3      2      ·      ·      ·      3      ·      ·      ·      3       4
bone                2      2      ·      2      ·      ·      1      ·      ·      ·       4
body               13     55      ·      2      ·      3      6      ·      ·      8       6
wound               4     14      ·      2      ·      ·      4      ·      ·      ·       4
death               2     31      ·      4      ·      ·      5      ·      ·      4       5
soul                4     18      ·      ·      ·      3     11      ·      ·      4       5
wings               5     19      ·      1      ·      ·      2      ·      ·      ·       4
angel               5     12      ·      1      ·      ·      1      ·      ·      1       5
god                12     27      1      4      ·      4     18      ·      ·      7       7
hell                1     23      ·      ·      ·      ·     32      1      ·      5       5
chaos               5     17      ·      1      4      ·      ·      1      ·      1       6
quantum             4     17      ·      1      ·      ·      ·      ·      ·      2       4
mathematics        23     10      ·      ·      ·      ·      4      ·      ·      ·       3
earthquake          4      2      ·      ·      ·      ·      ·      ·      ·      ·       2
weather             5     10      ·      4      ·      ·      4      ·      ·      4       5
water               4     18      ·      6      ·      1     13      ·      ·      ·       5
mask                4     15      ·      1      ·      ·      ·      ·      ·      2       4
theatre             9     31      ·      2      ·      ·     14      ·      ·     11       5
channeling          1      4      ·      ·      ·      3      2      ·      ·      6       5
synchronicity       3      ·      1      1      ·      ·      ·      ·      ·      ·       3
loop                3     13      ·      6      ·      1      ·      ·      ·      3       5
desire             17     32      ·      2      ·      1     23      ·      ·      ·       5
love                6     36      ·     10      ·      2     15      ·      ·      1       6
dream               2     23      ·      3      ·      1      7      ·      ·     10       6
machine             7     11      ·      3      ·      1      2      1      ·      4       7
writing            13     52      ·     10      ·      1     11      ·      ·     42       6
losangeles          3     29      2      ·      ·      ·      1      ·      ·      ·       4
glass               ·     12      ·      6      ·      3      3      ·      ·      1       5
threshold           7     17      ·      2      ·      ·     16      ·      ·      3       5
energybody          1      1      ·      ·      ·      ·      ·      ·      ·      ·       2
egg                 1      ·      ·      1      ·      ·      ·      ·      ·      ·       2
```

---

## The six measurements

### 1. Do sources differ?

Yes, but along an axis that isn't interesting.

| scene | emits | absorbs | words |
|---|---:|---:|---:|
| sphere | 39 | 1 | 4,386 |
| scroll | 36 | 4 | 19,621 |
| orbiter | 30 | 10 | 1,851 |
| theater | 27 | 13 | 7,326 |
| library | 26 | 14 | 3,007 |
| beamline | 19 | 21 | 283 |
| orrery | 6 | 34 | 263 |
| outside | 3 | 37 | 33 |
| butterfly | 1 | 39 | 12 |
| harmonics | 0 | 40 | 0 |

The ten patterns are certainly distinguishable — you could tell them apart at a
glance. But what distinguishes them is overwhelmingly how much prose the scene
contains, which is a fact about the site's construction rather than about what
any piece is made of. Five of the ten collapse into "mostly empty."

One genuine signal hides in there and is worth keeping: **Sphere emits more lines
than Scroll on a fifth of the words.** 39 of 40 from 4,386 words against 36 of 40
from 19,621. Sphere is a catalog scene — 25 fragments, each dense with unrelated
imagery — so it is broad-spectrum in a way that isn't a size artifact. Scroll is
long but thematically narrow per piece. That contrast is real, and it is the one
thing in this measurement that looks like a spectrum rather than a word count.

### 2. Are there universal lines?

**No.** Nothing reaches nine or ten scenes. The distribution:

| appears in | count | elements |
|---:|---:|---|
| 2 scenes | 3 | earthquake, energybody, egg |
| 3 scenes | 3 | moon, mathematics, synchronicity |
| 4 scenes | 9 | star, sun, prism, bone, wound, wings, quantum, mask, losangeles |
| 5 scenes | 16 | resonance, mirror, electricity, cosmos, death, soul, angel, hell, weather, water, theatre, channeling, loop, desire, glass, threshold |
| 6 scenes | 7 | light, fire, body, chaos, love, dream, writing |
| 7 scenes | 2 | god, machine |

The mode is 5 of 10 — but four of the ten scenes are nearly textless, so "5 of 10"
is really "5 of the 6 that have prose." Among scenes that *can* carry an element,
most elements are near-universal. That is the worst of both: no site-wide
signature to read, and no differentiation among the scenes that matter.

### 3. Are there unique lines?

**None. Zero.** Not one of the 40 elements appears in exactly one scene.

This is the measurement that decides it. Unique lines are what make a source
identifiable, and they are the whole argument for a spectrum as opposed to a bar
chart. Without them there is nothing to identify.

I re-ran the same test at **piece** granularity — 52 individual pieces of 40+
words across Sphere's fragments, Scroll's pieces, Orbiter's poems, Theater's
scenes and Beamline's bounces — on the theory that scenes are the wrong unit and
pieces are comparably sized. Still **zero unique elements**. The median element
appears in 13 of 52 pieces. The closest anything gets to diagnostic is four
elements confined to one to three pieces: `resonance`, `synchronicity`,
`energybody`, `egg`.

### 4. Is absorption legible?

Inverted from what would make it work.

The five prose-carrying scenes absorb 1, 4, 10, 13 and 14 lines of 40. Sphere's
absorption spectrum is **one line**. There is nothing to look at. The five thin
scenes absorb 21, 34, 37, 39 and 40 — nearly everything, which is legible but
says only "this scene has no text."

So absorption is empty exactly where emission is rich, and total exactly where
emission is empty. The two views are not two positions on one fingerprint; they
are a single quantity (word count) drawn twice, once positive and once negative.

At piece granularity this one measurement improves markedly: the median piece
emits 7 of 40 and therefore absorbs 33, which is dense and readable. If any
version of this survives, it is a per-piece absorption view — see the
recommendation.

### 5. Does Butterfly break it?

Butterfly emits **1 of 40** — `chaos`, from its own title. That is honest and
arguably beautiful: the scene that renders a Lorenz attractor emits the chaos
line and nothing else.

**Harmonics is the structural problem, not Butterfly.** It emits **0 of 40**,
and this cannot be fixed by a better element table, because Harmonics has no text
of its own by construction — it is made entirely of other scenes' content. A
scene meant to cover the site cannot render a spectrum for the one scene that is
already a view of the whole site. Either Harmonics is excluded, which breaks the
premise of coverage, or it is included as a blank plate, which is a hole rather
than a statement.

Outside (3) and Orrery (6) sit in the same category for a less interesting
reason: 33 and 263 words respectively.

### 6. Intensity, or just presence?

Intensity is real in the raw counts but measures the wrong thing, and correcting
for that inverts it.

Raw, per scene: Sphere has 39 lines ranging 1–23; Scroll 36 ranging 1–55;
Theater 27 ranging 1–32; Library 26 ranging 1–42. Library's top three account for
**45%** of its total and Theater's for 34%, so the distributions are skewed but
not degenerate.

*(The first version of this document reported Theater's top-three share at 65%
with `hell` at 481, and read that as a plot fact intruding on a spectral
measurement. It wasn't a plot fact — it was `INT. HELL. OFFICE.` repeated on 736
index rows. Corrected, `hell` is 32 and the skew is ordinary. A good illustration
of the risk this whole document is about: a number that has an obvious
explanation is the one you stop checking.)*

Normalised per 1,000 words the ranking still reverses: Beamline and Orrery come
out densest, against Scroll near the bottom. Short texts are dense by
construction. Neither version measures what a spectral line's brightness should
mean.

---

## Excluded, with reasons

Recording what looked like an element and wasn't, since that is as useful as the
table.

**Dropped as connective tissue** — high frequency, spread across every prose
scene, no discriminating power. Counts are total occurrences / scenes present:

| candidate | total | scenes | why dropped |
|---|---:|---:|---|
| night / dark / shadow | 645 | 5 | 607 of the 645 are Theater's stage directions |
| life / living / alive | 414 | 6 | ubiquitous; carries no image |
| eye / see / look / watch | 401 | 6 | every narrative uses it |
| time / moment / hour | 213 | 6 | same |
| world / earth / ground | 146 | 6 | same |
| voice / speak / sound | 71 | 5 | same |

**Dropped as too rare to be a line** — real vocabulary from the resonance
rationales that turns out to occur once or twice in the whole corpus:

| candidate | total | scenes | note |
|---|---:|---:|---|
| kayfabe | 1 | 1 | one library note |
| hermes | 0 | 0 | the resonance is about *iconography* — winged sneakers — not the word, which never appears |
| ouija | 4 | 2 | folded into `channeling` |
| boneyard | 2 | 2 | folded into `bone`; this is the row-10 judgment call |
| matrix | 7 | 2 | a proper noun about a specific film, and the resonance is about *refusing* the word |

`hermes` is the instructive one. A resonance can turn entirely on an image that
is never named — a messenger with wings painted on his heels — which no term
frequency method of any kind will find. Several of the 64 rows are like this.
That is a real limit on the whole approach, not a gap in this particular table.

---

## Recommendation

**Don't build it.**

The idea is good and the physics analogy is exact — emission and absorption
genuinely are one fingerprint read from two positions. The corpus just doesn't
have the shape the analogy needs. Specifically:

- No unique lines means no source is identifiable, which removes the reason to
  render a spectrum rather than a bar chart.
- No universal lines means there is no shared signature either, so the site has
  no composition to reveal.
- Five of ten scenes have almost no text, and one of them — Harmonics — has none
  by design and cannot be given any. Any honest rendering shows half the plate
  blank, and the blankness reports word count rather than meaning.
- Emission and absorption are exact complements of a single quantity, so the two
  views carry one piece of information between them, not two.

The barcode geometry concern in the brief turns out to be the smaller problem.
The data doesn't suggest a way out of it, because none of the three escape routes
is available: unique lines would have made it about identification (there are
none), and real intensity would have given the lines weight (intensity is a proxy
for text length in one direction and for brevity in the other).

**What survives, if anything does.** Two things, neither of them this scene.

1. **Per-piece absorption.** At piece granularity the median piece emits 7 of 40
   and absorbs 33 — dense, readable, and genuinely about the piece rather than
   about its length. There are still no unique lines, so it can't identify a
   piece, but "what this poem does not contain" against a fixed 40-element table
   is a real and strange thing to show. It is a different scene from the one
   proposed: ~52 sources, not 10, and absorption-primary rather than a paired
   emission/absorption view. Worth a separate afternoon if it appeals; it is not
   a narrower version of this, it is a different idea that this measurement
   happened to find.

2. **Sphere is broad-spectrum and Scroll is not.** 39 of 40 lines from 4,386
   words against 36 from 19,621. That contrast is the one place the data behaved
   like a spectrum instead of a word count, and it says something true about how
   the two scenes are built — a catalog of unrelated images against a small
   number of sustained pieces. It doesn't need a scene to say it, but it is worth
   knowing.

**The finding that matters more than the scene.** The corpus is far more
lopsided than any document on this project currently admits, and the correction
above makes it *more* so rather than less: **Scroll alone holds 53.3% of the
published words, and Scroll plus Theater hold 73.2%.** Sphere, Library and
Orbiter share most of the remainder; Beamline, Orrery, Outside and Butterfly have
591 words between the four of them, and Harmonics has none. Every brief describes
the ten scenes as peers. Numerically they are nothing like it, and that shapes
anything measured across "the corpus" — including this measurement, and including
any future one.

The chat brief's 57,000-word figure was re-derived rather than reconciled, and
now reads **36,886 published / 37,955 authored** with its ruler stated inline in
that document. Its provenance turns out to be recoverable: 36,886 plus Scroll's
19,490 individual-export words is 56,376 — "roughly 57,000." The old figure
almost certainly carried the same Scroll double-count this document did, from a
different direction.

---

*Method stated above. Corpus read from the live content modules on 2026-09-02 at
commit `3257bd6`. No files in the repo were changed by this work. Corrected the
same day after an independent dialogue-scoped measurement of `theater.text.js`
disagreed with the Theater column by 3.5×; the disagreement was real, the cause
was a double-count in this document's extraction, and the correction is at the
top.*
