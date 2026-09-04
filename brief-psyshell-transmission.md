# Psyshell v4.6.1 — base-e transmission, and the lockup

> **PARTLY SUPERSEDED by `brief-psyshell-branch.md` (v4.7.0, 2026-09-03).**
> Everything about the transmission survives the form change and is still live:
> the base-e notation, the digit-duration mapping, τ tied to the propagation,
> the ordinal as the one legible text, and the decode. The v4.7.0 numbers were
> chosen so that τ is unchanged, and the worked example below still holds
> without recomputation. What is superseded is only section 3, the lockup fix —
> the blossom was lifted by a constant, and the branch is fitted to the band the
> chrome leaves, measured.
>
> Written down for the same reason as `brief-psyshell.md`: it arrived as a chat
> message and was never a file. Scott's text is reproduced unedited.

---

perceptualmechanics.com — Psyshell v4.6.1: base-e transmission, and the lockup

Three changes. The first replaces the readout entirely, the second is a real defect, the third is a look-and-decide.

Keep the sound as it is. An earlier note called the click an envelope defect; Scott likes it. Not a bug — leave it alone.

## 1. The panel goes. The filapixel transmits.

Remove the sentence readout box. A panel in the corner makes the visitor someone reading a database. What the scene should show is a system running.

When a filament is struck, it pulses the sentence along its own length — in the Union's notation, which is not for you.

The passage licenses this exactly: a fibre-optic chrysanthemum, each filapixel a moment in time, demarcated in the code of the Union.

The point is that it is legible as transmission and never readable as text. Which is the Union's relationship to everything — the Script unzips to garbage because it was never encoded for sequential reading. English travelling up the strand would mean the visitor is being addressed. They are not.

Rejected, with reasons, so it does not come back: a text panel (makes it a database viewer); the sentence itself drifting outward in screen space (readable, but it addresses the visitor and long sentences are unmanageable); binary pulses (reads as computer, and the Union are a labour bureaucracy of dead informational objects, not a machine).

## 2. The notation: base e

Not a gag — there is a real argument, and it is exactly the argument an informational object would make.

Base e is the most efficient possible radix. If the cost of representing numbers is radix × number of digits, the optimum is e. Base 3 is the closest integer and beats binary; ternary computers were built on this reasoning (Setun, Moscow, 1958). Binary is a compromise forced by transistors, and the Union has no transistors. An entity optimising representation rather than engineering uses the actual optimum.

And a non-integer radix has the right properties for this setting:

* Representations are not unique. In base e the same value can be written several ways, and most integers do not terminate. A notation where the same moment has several valid encodings and none is canonical is no canon in a number system.
* Nothing lands on a grid. Digits do not line up, so the output has no visible beat — which is what makes it look unlike every data-transmission cliché, since those are all square waves.

### How it renders

Pulse durations carry the digits. A strand shows a train of unequal flashes with irrational relative lengths, no repeat, no grid.

Derived from the actual sentence, so it is a real encoding rather than noise with a story attached. Cowork's call on the scheme — character values, the sentence's ordinal, a checksum — but state which, and make it reproducible. Someone should be able to work it out in principle. That is the site's posture: it does not announce itself and it is not fake.

Timing ties to the propagation. The pulse travels at the measured front speed — 428/s forward — so the transmission and the disturbance are the same event rather than two effects that happen together.

The joke underneath, which does not need saying on the page: the most efficient possible notation is unreadable and slightly wasteful in practice. Which is the Union in one line.

### What survives in plain text

The ordinal, somewhere quiet. 1091 of 1350 or equivalent — that is the one piece of legible text the scene needs, because it is what makes a petal's angle mean position in reading order. Without it the flower is a pretty object.

The source attribution goes. SELECTED WORKS is a citation, and the site's posture is read the writing on its own.

`sr-live` keeps everything, including the sentence text and its source. The screen reader path is navigation, not decoration, and a visitor who cannot see the pulse must still get the content.

## 3. The lockup collides with the object

Real defect. Every other scene leaves the lower third clear — Apollo's band sits mid-height, Outside's lotus is compact. Psyshell fills the centre, so "Psyshell / flower magic" is rendering inside the rays, at minimum contrast against maximum visual noise. The letterspaced italic subtitle is close to unreadable.

Preferred fix: change the object, not the type. Reduce the flower's vertical extent or lift it, so the bottom third is dark and the lockup sits in clear space the way it does in every other scene.

Fallback: a treatment the other scenes do not have. That breaks the family, so only if the first cannot be made to work — and say why.

This is a looking problem, not a reasoning one. Third release running where the answer came from rendering it (the shaving brush, the firework). Render both and report what was seen.

## Also open, from v4.6.0

* The hot patch on the far side of the dome — needs a real GPU rather than swiftshader.
* The 200px tile reads as a dandelion clock, not a chrysanthemum. Rays and seedpod legible, silhouette a fuzzy disc. It is plainly not Outside, which was the question asked — this is a separate and lesser issue.
* The tile clips its own skirt and sits high in the circle. That one is a defect.

## Verification

* The pulse encodes the actual sentence, reproducibly, with the scheme stated. Decode one by hand and show it.
* Pulse timing matches the propagation front speed, measured rather than asserted.
* No readable text renders in the scene except the ordinal.
* `sr-live` still announces the full sentence and its source.
* Frame-rate independence at 60 and 144 with the pulse running — durations are irrational, which is exactly the kind of thing a per-frame constant would quietly break.
* One audio context per visit, zero orphans, unchanged.
* The lockup is legible — contrast measured against the real composited background, both variants looked at.

## Closing: what this invalidates

`perceptualmechanics-chat-brief.md` — the Psyshell row gains the transmission behaviour; Where things stand gains a release entry.

`perceptualmechanics-project-brief.md` — the scene description.

`CORRECTED-FACTS.md` — if the base-e claim is going into a code comment or the `/text/` page, it should carry its source, since "most efficient radix" is the kind of true-sounding fact that gets garbled on restatement.

---

## What was measured against this brief *(added by Cowork, v4.6.1)*

- **"Every other scene leaves the lower third clear" is wrong twice.** Beamline's
  title band is 2.6× brighter than Psyshell's and sits at **2.6:1, below WCAG AA
  for large text**, where Psyshell cleared it at 5.4:1. Butterfly's local
  gradient is ~5× Psyshell's. Beamline is still open.
- **"The letterspaced italic subtitle"** — the subtitle was not italic. It became
  italic in this release, which is what Scott meant: the lockup should follow the
  site's family (caps, italic subhead), and it had diverged on four counts.
- **"The tile clips its own skirt. That one is a defect."** Fixed in v4.6.0, in
  the pass that found it.
- **The base-e claim is true under a stated cost model** and is now recorded with
  it, plus its source (Hayes, *American Scientist*, 2001).
