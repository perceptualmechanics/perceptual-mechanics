# perceptualmechanics — coding standards

Durable house rules for this codebase, with the reasoning attached. Read
this file first before any future "modernize the code" pass — the point
of writing it down is so a pattern doesn't get re-flagged, re-argued, or
re-fixed from scratch each time someone (a person or an AI assistant)
looks at this project fresh. NOTES.md has the dated changelog of what
shipped when; this file has the standing rules those changes established.

**`WORKING-PROTOCOL.md` is the companion to this file** and should be read
alongside it. This file holds rules about the code; that one holds rules about
how the two instances working on it get things wrong — the chat instance writes
from documents, this side writes from source, and every correction over a
two-day arc ran in that one direction. It carries the assumptions-block rule,
the "stop rather than adapt" instruction, "state the ruler with the result",
and "report the invalid harness, not just the working one".

## General principle

Something that looks outdated isn't automatically wrong. The bar for
changing a pattern is "is there a strictly better tool for what this
specific code is doing," not "is this the newest available syntax." A
full-site audit (v3.9.15, v3.9.16) went through every CSS file and a
representative sweep of the JS looking for exactly this distinction, and
found real anti-patterns alongside patterns that only *look* dated. Both
kinds are recorded below so the next pass doesn't have to re-derive the
reasoning.

## Tooling

### Never run `npm install` from an assistant sandbox — it poisons `node_modules`

Learned 2026-09-02, during the Vite 8 upgrade, and it will recur because the
setup that causes it is the normal one.

When Claude works on this project it runs commands in a Linux sandbox that
**mounts this folder**. The repo is shared; the platform is not. So an
`npm install` run from there resolves and downloads **Linux** binaries into
the same `node_modules/` macOS then tries to use, and every package with a
native component breaks on the Mac. The Vite 8 upgrade did exactly this and
left `npm run dev` dead with:

    Error: Cannot find native binding.
    cause: Cannot find module '@rolldown/binding-darwin-arm64'

Nothing about that message points at the actual cause, which is why it is
worth writing down. It is not an npm bug, not a corrupt install, and not
anything wrong with the upgrade — the sandbox simply installed for the wrong
operating system into a folder the other operating system reads.

**The fix is `npm ci` on the Mac**, and it is reliable rather than a guess:
`package-lock.json` records every platform variant with its own `os`/`cpu`
constraints (15 rolldown bindings, 26 esbuild packages), so a clean install
picks the right ones. Use `npm ci`, not `npm install` — `ci` wipes
`node_modules` and installs exactly what the lock says, which both fixes the
platform mismatch and leaves the pinned versions untouched. `npm install`
into the existing broken tree can skip optional dependencies (npm/cli#4828)
and appear to succeed.

**Going forward:** dependency changes are fine to *decide* in the sandbox —
the lockfile it writes is correct and complete, and CI (Linux) is unaffected
— but the Mac needs `npm ci` afterwards before anything will run locally.
Treat "the sandbox ran npm install" as implying "run `npm ci` here next."

**What the sandbox actually is, confirmed 2026-09-02.** The shell that mounts
this folder is a Linux VM running on this Mac, not the Mac itself. That is the
whole mechanism, and naming it explains a second symptom as well as the first:
`npx vite` run from there fails immediately with `Cannot find module
'@rolldown/binding-linux-arm64-gnu'` — the mirror image of the darwin error
above, from the same one `node_modules` serving two platforms. So the assistant
cannot start the dev server for this folder either, and asking it to is asking
it to install Linux binaries here.

**Two consequences that are easy to get wrong.** First: when a live look at
`localhost:5173` is wanted, a person has to start `npm run dev` on the Mac. The
assistant can drive the browser once it is up; it cannot bring it up. Second:
that VM's `localhost` is not this Mac's `localhost`, verified by serving a
probe page from it and failing to reach it from Chrome — so the assistant
cannot work around the above by serving anything from the mounted shell either.
What it can do without help is build and serve `dist/` inside its own container
and drive a headless browser there, which is a real live look, on a different
machine, and should be reported as such rather than as "verified in the
browser".

### Git writes from the assistant's side leave a lock file behind

Learned 2026-09-02, while committing v4.3.0. The mounted view of this folder is
read/write but **deletion is denied**, and git's normal working method is to
write `X.lock`, do the work, then unlink it. So every `git commit`, `git add` —
and even a plain `git status`, which refreshes the index — succeeds and then
prints `warning: unable to unlink .git/index.lock: Operation not permitted`,
leaving a zero-byte lock file in place.

That file is real, and the Mac sees it. The next git write on this machine will
refuse with "Unable to create '.git/index.lock': File exists" until it is
removed. Deleting it here is exactly the operation that isn't permitted, so the
assistant's move is `mv` rather than `rm`: stale locks and the `tmp_obj_*` files
the same restriction stranded in `.git/objects/` go to **`.git/_stale-tmp/`**,
which git ignores. If that directory exists and has anything in it, this is why,
and it is safe to delete from the Mac at any time.

**The rule:** clear the lock **before every git write and again after the last
one**. The first version of this rule said "after the last command" and was
wrong within the hour — a `git status` run to check the tree left a lock, and
the `git commit` that followed died with *"Unable to create index.lock: File
exists. Another git process seems to be running."* Nothing else was running. It
was the previous read.

So: `mv .git/*.lock .git/_stale-tmp/` is the first thing in any command that
ends in a git write, not only the last. And anything left behind at the end is a
trap for the next person to type `git commit` here — the person who created it
is the one who knows it exists.

### The assistant builds from its own checkout, not from this folder

The repair above is `npm ci`; the actual fix is to stop two operating systems
sharing one `node_modules` at all. There is no version of that arrangement
that works, because `npm ci` installs only the platform variants matching the
machine it runs on — so whichever side installed last is the side that works,
and the other one breaks. Alternating repairs is not a workflow.

So: when a build or a gate run needs to happen on the assistant's side, it
happens in a **separate working copy** in the assistant's own container, with
its own `npm ci`. The tracked tree is about 3.5 MB (`assets/` and `artifacts/`
are ignored personal files and the build doesn't read them) and it builds and
passes all four gates in about a second.

**That copy has no `.git`, deliberately, and this is the second version of this
rule.** The first said to use a clone and to move work with `git format-patch` /
`git am`, which is right when the two sides share history. They do not: releases
4.6.0 onward are committed on the Mac and unpushed, so a fresh clone's
`origin/main` sits far behind the tree being copied into it, and the copy cannot
be described in git terms at all. That produced a trap with no good side: a
dirty tree trips the stop hook's uncommitted-changes check, and committing to
quiet it produces local commits on `main` that trip its unpushed-commits check —
**and those are the one thing that must never be pushed**, since pushing them
would put Scott's unpushed work on the remote under an assistant's commit
message and a history that matches nothing.

With no `.git` there is no branch to be ahead of and nothing to reconcile. Work
travels as files written to the Mac with the device bridge and committed there,
which is what has actually been happening for every release since 4.6.0. The
copy carries a `WORKING-COPY.md` saying so.

**Leave that clone clean before ending a turn.** The build writes into it, and
a dirty clone is what the stop hook reports — it says "the repository" and
checks whichever one it is pointed at, so the warning is accurate about the
state and silent about the location. It has now fired across two separate
sessions with the same cause and the same first response, which was to explain
it. `git checkout -- . && git clean -fd` in the clone is the whole fix and
takes a second; explaining the discrepancy again is not one. This sentence
exists because the correction had been living in a reply.

This folder's `node_modules` belongs to the Mac. Nothing on the assistant side
should write to it — not `npm install`, not `npm ci`, not `npm run build`
(which runs the local `vite` binary out of it).

## Measuring a scene

### Sample at scene-time, and drive the clock

Learned across three releases of harnesses that each had to fail first, and now
general enough to be a rule rather than a note in one file.

**A harness that samples a running scene on wall-clock time measures its own
latency.** Under the software rasterizer available in the assistant sandbox a
single frame of Sphere costs about 570 ms; `page.screenshot()` costs another
160 ms. A harness that asks for "a frame every 100 ms" gets whatever the machine
managed, which is a different point in each scene's own cycle for each scene,
and the comparison it then makes is between scenes sampled at different times.

So take the clock away from the page:

- `performance.now()` returns a counter the harness owns.
- `requestAnimationFrame` **queues** the callback; it does not schedule it.
- A frame happens only when the harness steps it, and the step advances the
  counter by a fixed amount.
- `Math.random` is seeded, so a scene that scatters points scatters the same
  points on every run.
- The mount path (dynamic import, the crossfade's `setTimeout`) keeps real
  timers. Only the frame clock is virtual.

Three things that were got wrong doing this and will be got wrong again:

- **Step in chunks.** Stepping 180 frames inside one `evaluate()` blocked the
  renderer long enough that Chromium closed the target. Fifteen per call, with
  a yield between.
- **Do not detect "mounted" by polling for a canvas, and do not break out of
  the boot loop early.** Scroll has no canvas at all and reported "not mounted"
  while rendering perfectly; worse, because the poll stepped a frame per
  iteration, a scene that mounted late got *more* frames before warm-up than
  one that mounted early, and came out 0.33 s further into its own cycle. That
  is "same elapsed time for every scene" being violated by the instrument
  rather than the subject. Use a **fixed** number of boot frames for every
  scene.
- **The landing's preview canvases keep their frame loops running behind an
  open scene.** They are paused by the app but the loop still ticks, costing
  about a quarter of every frame and contributing nothing to the image. Drop
  their contexts before sampling.

**And report the invalid attempts.** Three releases running, the finding came
from a probe that failed first — the dt clamp that invalidated a frame-rate
harness, the `?url` that emitted a worklet twice, the mount detector above. A
harness quietly replaced is a measurement nobody can weigh.

---

## Documentation

### The knowledge base is current; a brief is a missive

Five files carry what a future session needs, and none of them is dated except
the one that is meant to be:

- **`SITE.md`** — what the site is. The scenes, the corpus and its rulers, what
  is real in each scene and what is a rendering, the short form of what has been
  decided, and the maintained list of open items.
- **`STANDARDS.md`** — how we build, with the reason attached to every rule,
  because a prohibition without a reason invites a workaround.
- **`CORRECTED-FACTS.md`** — claims that were made, turned out wrong, and came
  back. Read in full before writing a brief.
- **`WORKING-PROTOCOL.md`** — how the two instances work together, and the
  failure mode that made it necessary. It keeps its own application log, which
  is right: it is the one file that documents its own use.
- **`NOTES.md`** — what shipped, dated by version, append-only. The only
  legitimately historical file.

**A brief is not one of these.** It is addressed, dated, about one piece of work,
and dead on arrival. Nobody should read a brief again after its release ships.
It is where thinking goes, and where the reasoning for a rejected alternative
lives so it is not re-proposed. **A brief is never a source of truth about the
project.**

**The rule that follows from that: if something written in a brief is a thing a
future session needs to know, it belongs in a knowledge-base file, and the brief
says which file it went to.** Otherwise it dies with the release and somebody
restates it wrong in a month. That is not hypothetical — it is why
`CORRECTED-FACTS.md` exists, and it happened to the document that described the
whole project.

**Fix in place.** No correction notes, no superseded markers, no changelog
inside a knowledge-base file. `NOTES.md` carries the history; the KB carries the
present.

**One rule per file.** If a fact is in two KB files, one of them is a pointer.
Two copies drift, and the drift is invisible until they disagree.

**Who owns what.** The coding instance owns accuracy: it reads source, it can
verify, and it should correct KB files freely and say what it changed. The chat
instance owns structure: it proposes what a file should contain and where a fact
belongs, and cites rather than asserts when a fact came from a document.

### Measuring the corpus: name the export, not the module

The rule belongs to `SITE.md`, under "The corpus", with the other measurement
rules. The short form, because a coding session is exactly who walks a module's
exports: **`theater.text.js` and `scroll.text.js` each publish both a source and
a derived index over the same text**, on purpose and for good reasons. Summing a
module's namespace counts those words twice and produces a plausible number
rather than an obviously wrong one. This cost a published measurement its two
largest figures.


### A brief closes by naming which knowledge-base files it makes untrue

Any brief, handoff or write-up produced for this project ends by naming **which
knowledge-base files its work makes untrue, and what changed in each** — the
specific claims, not "the docs may need updating", so the correction is a
two-minute edit rather than a re-read.

**Name knowledge-base files and nothing else.** An earlier version of this rule
had briefs invalidating other briefs, which was wrong twice over: briefs are
messages rather than repo documents, so the reference frequently pointed at a
file the other instance could not open; and a brief cannot go stale, because it
was only ever true on the day it was sent.

**Why it earned a rule.** The project brief sat fourteen minor versions stale
before anyone noticed: it announced itself as current as of a version fourteen
behind, three of its six standing open items had been resolved and were still
listed as open, and a fourth had flipped the other way. Separately, a correction
pass found the two briefs disagreeing with each other and with the data — one
said the Library holds 147 items and the other 150 (the data says 150), and one
still described Beamline as a sequence of curved mirrors, a design the scene left
behind long enough ago that the same stale sentence had also reached `main.js`'s
`ariaLabel`, where it was the only account of that scene a screen-reader visitor
got.

None of that is exotic. It is the ordinary fate of a document nobody is required
to touch. A document that is wrong is worse than no document, because it is read
as current.

This is the only gate documentation here will ever have: no test fails when a
sentence stops being true, and no build step can tell. Naming the invalidated
files at the end of the work that invalidated them is the one moment when
someone reliably knows.

## CSS

### A structural claim gets measured, not described

If a scene's premise is a property of its data — connected, ordered, evenly
covered, one component — then measure the property and fail the build when it is
false. A sentence in a comment saying the thing is connected is not a check, and
the reader of the /text/ page cannot tell the difference.

**What it cost.** Psyshell's field and its object are meant to be one web that
can be traced from inside the crystal to a far knot. A nearest-neighbour graph
looks connected and is not: over this point set it fell into **223 pieces**, the
largest holding a fifth of the nodes, while every render of it looked exactly as
intended. Nothing on screen would ever have said otherwise. The build now walks
the graph from a node inside the object and throws if any node is unreachable,
and the /text/ page prints the hop count it found.

The general form: **a claim about structure is cheap to check and invisible to
looking.** Visual claims go to a screenshot; structural ones go to a gate.

### One block per selector in a stylesheet — a second block is not an edit

If a rule needs changing, change it where it is. Do not add a second block for
the same selector further down the file.

**What it cost.** `psyshell.css` carried `.psyshell-title`, `.psyshell-title-name`,
`.psyshell-title-sub` and `.psyshell-hint` twice for two releases: the corrected
title lockup first, the superseded version second, and the cascade used the
second one. The scene shipped a fixed 1.9rem title with `text-indent` the whole
time, while the fix's own comment — explaining at length why `text-indent` was
wrong and `margin-right` was right — sat directly above the block overriding it.

**Why it survived.** Nothing rendered obviously wrong. A duplicate block does not
error, does not warn, and produces a page that looks approximately right, so the
only thing that finds it is reading the file or measuring the rendered element
against what the file says it should be. That makes it worth a rule rather than a
habit.

### Centering: flexbox/grid by default, `left`/`top` + `transform` for coordinate-anchoring only

Default to `display:flex;justify-content:center` (or `align-items:center`
for a column stack) to center static layout content — a title, a panel,
a row of tiles. Never `left:50%; transform:translateX(-50%)` (or the
Y-axis/both-axis equivalent) for this. This was a real, shipped bug: see
[[feedback_letter_spacing_trailing_gap_centering]] and
[[feedback_no_transform_centering_use_flexbox]] in project memory —
letter-spacing adds a trailing gap after the last character, which a
self-width-measuring `transform` centers along with the invisible gap,
visibly off-centering tracked-out titles. Flexbox centers by margin box
without ever needing to know the element's own width, which sidesteps
the whole problem. Fixed site-wide in v3.9.13/v3.9.14.

`left`/`top` + `transform: translate(...)` is still the *correct* tool —
not a legacy leftover — for two different jobs:

1. **Anchoring an element to a precise, often dynamically-computed
   coordinate.** The standing example in this codebase is a DOM overlay
   positioned against a point projected from a Three.js/WebGL canvas —
   touch-point overlays and labels in Outside's petals, Harmonics' nodes,
   Beamline's stations. The technique's real advantage here is that it
   doesn't need to know the element's own rendered size in advance,
   which flexbox has no equivalent for when the position itself is
   computed per-frame from a 3D projection, not a static layout slot.
2. **Centering a small decorative element within its own positioned
   ancestor at a precise, arbitrary offset along one or both axes** — a
   speech bubble anchored above a character, a pin dot on a rotated
   card, a seat silhouette's head-and-body pseudo-elements, a glow ring
   centered inside a circular frame. Flexbox has no clean equivalent for
   this, especially for `::before`/`::after` pseudo-elements, which
   can't themselves be flex containers. Confirmed case-by-case in the
   v3.9.15 audit (theater.css, scroll.css) — eight instances, all
   legitimate, none touched.

Classify every `left`/`top` + `transform` instance individually before
touching it: is it self-measuring its own width to center across a
full-width row/viewport (the actual bug — convert to flex/grid), or is
it anchoring to a specific point or offset (leave it)? A blanket
find-and-replace would have broken real positioning code across most of
the site's interactive scenes.

### Vendor prefixes: kept only with a stated reason, checked individually

Don't keep a vendor prefix by default ("it's always been there") and
don't remove one by default ("prefixes are old, therefore bad") either.
Check current browser-support data for each one and record the
reasoning:

- `-webkit-backdrop-filter` (`styles/main.css`) — **keep.** Unprefixed
  `backdrop-filter` only shipped in Safari 18 (June 2024); Safari 9–17
  and older iOS still need the prefix. Checked 2026-08-26.
- `-webkit-mask` — **keep, always paired with unprefixed `mask`.**
  Firefox and Safari 15.4+ support the unprefixed property, but older
  Safari doesn't; declare both, prefixed first (v3.9.15 found and fixed
  one instance in `theater.css` that had only the prefixed version with
  no fallback — a real gap, not a style choice). **The rule stands but
  has no example left in the codebase**: v4.0 deleted that `theater.css`
  declaration entirely, because a second look showed the mask did
  nothing at all — `mask-clip` defaults to `border-box`, so masking with
  a solid `linear-gradient(#000 0 0)` masks nothing, and the frame-only
  bulb ring it was meant to produce was already happening by paint order.
  Worth recording as its own lesson: v3.9.15 correctly fixed the
  *pairing* without anyone asking whether the declaration had any effect.
  Checking that a property is well-formed and checking that it does
  something are different checks.

  **The rule is not about CSS.** `sphere.js` called
  `IcosahedronGeometry(...).toNonIndexed()` with a correct comment explaining
  why the geometry has to be non-indexed for per-face colouring — and
  `IcosahedronGeometry` is already non-indexed, so the call did nothing but
  print a warning on every visit for as long as the scene has existed. Removed
  2026-09-02; the requirement it documented is still written down there, because
  a future change to the geometry does have to hold it. Same three checks every
  time: is it well-formed, does it do anything, and is the thing it does still
  needed.
- `-webkit-overflow-scrolling: touch` — **removed** (v3.9.15). WebKit
  shipped native momentum scrolling for all overflow elements in iOS 13
  (2019); the property has had zero effect since. This is the version
  the standing rule (below) means to catch — a prefix kept out of habit
  long after its reason expired.
- `-webkit-appearance: slider-vertical` (`apollo.css`, the element faders) —
  **removed 2026-09-02**, one release after it was added. It was the
  pre-standard way to stand a range input on end, kept for Safari below 17.4.
  Two things changed the answer: Chrome now emits a deprecation warning for it
  on every page view, naming the exact replacement (`writing-mode: vertical-lr;
  direction: rtl`) that the same rule already carried — so the prefix was buying
  nothing on the browser that was complaining — and the unprefixed form reached
  full cross-browser support in 2024. The cost of removal is stated where it
  lives: on Safari before 17.4 the slider renders horizontally in a cell sized
  for a vertical one, which is cosmetic rather than functional. This is the same
  shape as `-webkit-overflow-scrolling: touch` below, caught faster because the
  engine said so out loud.
- `-webkit-transform: translateZ(0)` (`scroll.css`, the medallion/crack
  elements) — **keep.** Not a generic "force a GPU layer" cargo-cult
  hack; the element's own code comment documents it as a targeted fix
  for a specific Safari filter+animation compositing bug, kept
  deliberately alongside `will-change`. If touching this code again,
  re-verify the underlying Safari bug is still present before removing.

### `!important`: two legitimate categories, nothing else

1. **Overriding a third-party library's own inline styles.** Example:
   `.preview-container canvas { width:100% !important; height:100%
   !important; }` in `styles/main.css` — Three.js's `renderer.setSize()`
   sets inline `style.width`/`style.height` directly on the canvas
   element, and inline styles beat any non-`!important` stylesheet rule
   regardless of specificity. There's no other way to win that fight.
2. **Accessibility overrides that must win the specificity fight.**
   `prefers-reduced-motion` blocks and explicit state-flip utilities like
   `.no-transition` (used to suppress a transition for exactly one frame
   during a panel's from-left/from-right flip) both use `!important` to
   guarantee the override applies regardless of what else targets that
   element.

Anything outside those two categories is a real flag, not a pass —
audit it the way the CSS `!important` audit did in v3.9.15/v3.9.16
(read the actual reason each one exists before deciding).

### Scenes do not persist state. Preferences may.

Written down 4.5.0, when it was asked for the first time, so it is not
re-derived the next time.

**Scenes reset between visits, and that is a decision rather than a limitation
to work around.** Ten of the eleven are encounters with writing rather than
configurations — nobody wants to return to Scroll at the paragraph they left.
`sceneKit`'s entire lifecycle layer exists to guarantee that leaving a scene
leaves nothing behind, and persisted state would be the first thing deliberately
surviving a dispose. Apollo is the only real candidate, being the only scene
where you build something, and it is the clearest case against: the instrument's
pleasure is starting from an empty band, and a second visit that opens inside an
arrangement you made weeks ago and no longer remember is worse than one that
does not.

**A preference is a different category and may persist.** The sound toggle is
the precedent (`bindPersistedSoundToggle`): it records what the visitor wants to
be true of every scene, not what they were doing in one.

**When state seems to want persisting, make it addressable instead.** Apollo
encodes a mixture in the hash — `#apollo/ca95,h85,na80` — so an arrangement
becomes a thing you can send someone. Arriving at it is deliberate rather than
residual, it costs nothing when unused, and nothing survives a dispose. Two
constraints that came out of building it: the encoding must round-trip exactly
(a fader with 101 positions cannot be encoded in 11 and handed back), and
arriving at a link must never start audio — audio needs a gesture anyway, and
somebody else's arrangement should be silent until the visitor asks.

### Content derived from more than one scene lives in one module, and declares its order

Added 4.6.0, when Psyshell needed "every sentence on this site" and there was no
such thing to import.

**A rule that was measured belongs where a second consumer can reach it.** The
sentence split Psyshell needs was chosen in `spectra.data.js` after three rules
were compared — and Spectra is shelved, unregistered, deliberately outside the
build. Importing from it would have pulled a shelved scene back into the bundle
to reach one regex. The split moved to `src/utils/corpus.js`, Spectra keeps its
own copy for the day it is unshelved, and neither file is now the other's
dependency.

**The reader declares each scene's order and fields explicitly.** Walking every
named export of every `*.text.js` is the obvious implementation and it is wrong
in two ways that do not show up in a diff:

- It **double-counts**. `scroll.text.js` exports its twelve patches individually
  *and* an ordered index over them. This is the same double-count
  `spectra-measurement-2026-09-02.md` had to correct, arriving a second time in
  a different consumer.
- It **loses the order**. A module namespace object has its keys sorted
  alphabetically by specification, so a walk visits scenes' pieces in
  alphabetical order regardless of what they publish first. Any scene claiming
  to render reading order would be rendering an alphabetisation.

So `CORPUS_SOURCES` names, per scene, the one export carrying the order and the
fields carrying the writing. It is a decision, it is short enough to argue with,
and its exclusions are stated: Library is excerpts only because a cataloguing
note is apparatus rather than writing, and two scenes are absent because they
publish no sentences.

**The module has no DOM, because the build imports it too.** `prerender.js`
builds the `/text/` page from the same numbers the scene renders, which for a
scene whose entire subject is a count is the only arrangement worth having —
there is no third place holding a stale total.

### An AudioWorklet is a separate file, a separate global, and a third thing to dispose

Three Web Audio scenes on this site were built with oscillators and gain
envelopes, and that is the right tool for a tone with a shape on it. It is the
wrong tool when the SHAPE OF THE EXCITATION is the point — a body responding to
being touched, rather than a note being started — because a `GainNode` can only
scale what a source already produces. That is when a worklet earns its cost.

What ships with one:

- **The processor is its own file and is not bundled.** It runs in
  `AudioWorkletGlobalScope`, which has no DOM, no `window`, and none of this
  app's module graph, so it imports nothing and stays self-contained. Its URL
  comes from `new URL('./x.worklet.js', import.meta.url).href`, which the
  bundler understands as "emit this as an asset". **`?url` also works and emits
  the file twice** — once raw and referenced, once minified and loaded by
  nothing.
- **It must be excluded from `main.js`'s scene glob.** `import.meta.glob` over
  `./scenes/*/*.js` matches a `*.worklet.js` sitting in a scene folder and
  compiles it a second time as a lazy scene chunk. The glob carries a negative
  pattern for that reason.
- **`performance` is not defined in every engine's worklet global.** Timing
  probes must degrade to inert rather than throw, and a reported zero from one
  means "not measurable here", not "free".
- **A rename is not three renames.** Renaming a worklet touches the file, the
  processor name in `registerProcessor`, and the `new URL(...)` beside it — and
  a scripted rename across the scene file will happily also delete the node's
  own declarations if they sit inside a comment block being replaced. That
  happened; the scene threw `rushNode is not defined` on the first read, and
  what caught it was the audio harness asserting that a node exists rather than
  any build step. **The check that a worklet node was constructed is worth
  keeping in the harness for that reason alone.**
- **Dispose is three things, not one.** `port.onmessage = null`, `port.close()`,
  then `disconnect()` — and then the context's own close as before. A live port
  keeps a message channel referencing the scene that created it, which is the
  same shape as the stranded-`AudioContext` defect 4.0 fixed. A new node type is
  a new place for it to come back, and it is verified the same way: one context
  per visit, the previous one closed, zero orphans, **with the node in place**.
- **Report underruns, and classify them.** A worklet runs in a hard-realtime
  thread, so slow code produces dropouts rather than lag. `currentFrame`
  advances by exactly one render quantum per call; anything larger is a gap. A
  gap in the first second of a context's life is the device starting, a very
  large one is a suspend, and what is left is the only one that is a defect.
  Counting all three together reports an underrun nobody heard.
- **CSP:** a worklet module is fetched under `script-src`, and this one is
  same-origin, so `'self'` already covers it. No policy change.

### Sound that outlives the page's visibility needs a gesture that meant it, and a bound

Added 4.5.1, when the first exception to "suspend on hide" was made. The rule
before it was unconditional and had been since v4.0, for a good reason: a page
playing out of a tab whose only control the visitor cannot see is the thing
people close twenty tabs to stop.

**`document.hidden` cannot tell a locked phone from a forgotten tab.** It is the
same event with the same fields, and there is no second API that separates them.
Anything built on "detect the lock" is building on a signal that does not exist.

**So the discriminator is the state the visitor left, not the transition.** Sound
on *and* a generative layer armed is two deliberate acts, the second meaning
"play on your own." A forgotten tab is not in that state, because sound needs a
gesture. A scene whose ambient layer simply comes on with the sound has no such
signal available and does not get the exception — which is why Outside and
Harmonics still suspend unconditionally and Apollo does not.

**It is bounded, because the discriminator is a guess about intent.** Ten
minutes in Apollo. Being wrong then costs a visitor ten minutes of sound they
did not want; an unbounded version costs them a page that never stops, which is
the original problem restored. **The bound is measured on the audio clock and
checked inside the scheduler's own tick**, not on a `setTimeout`: the tick's
running is the sound, so a deadline read off it cannot outlive a frozen page,
and the audio clock stops when the sound does, so the bound counts sound rather
than wall time.

**And check what stops running while hidden.** Two things nearly broke this
silently — `main.js`'s own `visibilitychange` listener pauses the expanded scene
*before* the scene's handler runs, so the predicate has to be consulted in both;
and anything drained from the render loop is not being drained, so a queue that
grows one entry per event empties as a single frame of hundreds.

### Layout that depends on something else's size is measured, not constant

Added 4.4.0 as a rule about the scene count; widened 4.5.0, because the scene
count turned out to be one input rather than the subject.

**The rule:** any number in the layout that depends on something the stylesheet
cannot see — how many scenes exist, how tall another element renders, how much
vertical room is left — is measured or derived at runtime, never typed as a
constant. Three instances in three days, all the same shape:

- The **scene count**, derived at runtime from `Object.keys(SCENES).length` in
  `applyDerivedLayout()`, never typed into a stylesheet or positioned by hand in
  markup.
- The **rail's height** in Apollo, asked of the DOM by `layout()`. Two constants
  taken from a desktop window covered the wavelength scale and the bottom of the
  band on every phone once the rail grew a row (4.4.2).
- The **budget under the band**, which in 4.5.0 grew past what the space could
  hold again the moment another control row appeared.

**And where a constant genuinely cannot be avoided, the layout needs an
invariant instead of a number.** 4.4.2 made the band shrink to fit with a floor;
a floor cannot prevent an overlap when the available space is smaller than the
floor plus everything below it. 4.5.0 replaced it with an order of yielding —
the diagram goes first, then the floor gives way — so "nothing overlaps the
rail" is guaranteed rather than true at the sizes that were checked. When a
control cannot be honoured, it should say so on itself; a button reporting
pressed while nothing appeared is a worse failure than the missing thing.

**What the constant version costs**, since a prohibition without a reason
invites a workaround: it is not that it looks wrong. It looks exactly right, on
the day it is written, at the size it was checked at. The cost is that it leaves
the reason in place for the next change to inherit, and the person who inherits
it is looking at an overlap with no indication which of three files is lying.

#### The scene-count case, in full

**The rule:** any number in the layout that has to change when a scene is added
or removed is derived at runtime from `Object.keys(SCENES).length`, never typed
into a stylesheet or positioned by hand in markup. `main.js`'s
`applyDerivedLayout()` is where that happens, and `scripts/prerender.js` fails
the build if `index.html`'s nav icons and landing tiles don't match the
registry, so the derivation can't be quietly wrong about what it is deriving
from.

**Why it earned a rule, twice.** The nav-icon row was broken by an added scene
four separate times — icons clipped off both edges of every phone, invisible
with nothing else visibly wrong — and each fix was the same shape: re-tune a
number against the count of the day. v4.2 fixed the *arithmetic* with a derived
formula but left `--nav-count` in the stylesheet as a hand-maintained value, so
the bug's last remaining foothold survived a fix aimed directly at it. The
landing grid was worse: a `.preview-row-break` element hand-placed in the
markup, moved after the 4th tile and then after the 5th, with a comment that
had to keep saying which scene currently occupied that slot.

**What the hardcoded version costs, since a prohibition without a reason invites
a workaround.** It is not that the hardcoded version looks wrong — it looks
exactly right, on the day it is written, at the width it is checked at. The cost
is that it leaves the reason in place for the next scene to inherit, and the
person who inherits it will be looking at a nav row that is one icon too wide
with no indication of which of three files is lying.

**Where CSS genuinely cannot do it, say so and put the derivation in JS.** A
media query cannot read a custom property, so the width at which the deliberate
row breaks are worth enforcing is computed in `applyDerivedLayout()` and applied
as a class. That is not a workaround for a stylesheet limitation to be fixed
later; it is the one part of this that is not expressible in CSS, and the
comment at that line says which part and why.

**And flex, not grid, for the tile rows** — checked rather than assumed. An
incomplete last grid row stays left-aligned, so eleven tiles at four columns
would put three hard against the left edge under two centred rows. Flex rows
each centre themselves.

### Mobile-first, going forward — non-negotiable

All new CSS is authored mobile-first: base rules target the smallest
viewport by default; wider-viewport enhancements are layered on top via
`min-width` media queries. Never author full desktop styles with
`max-width` queries simplifying them back down for mobile — that was
this codebase's actual pattern before v3.9.16 (every one of the 12
stylesheets used `max-width` exclusively; zero `min-width` queries
existed anywhere), and it's exactly backwards from how the CSS cascade
is meant to be used for progressive enhancement.

**Per-file status as of v3.9.17: all 12 of 12 stylesheets converted.**

| File | Status |
|---|---|
| `styles/main.css` | Converted (v3.9.17 — see below for why it waited) |
| `src/scenes/theater/theater.css` | Converted (v3.9.17 — see below for why it waited) |
| `src/scenes/beamline/beamline.css` | Converted |
| `src/scenes/orbiter/orbiter.css` | Converted |
| `src/scenes/harmonics/harmonics.css` | Converted |
| `src/scenes/butterfly/butterfly.css` | Converted |
| `src/scenes/outside/outside.css` | Converted |
| `src/components/colophon/colophon.css` | Converted |
| `src/scenes/library/library.css` | Converted |
| `src/scenes/sphere/sphere.css` | Converted (also fixed a real dead-code bug — see NOTES.md v3.9.16) |
| `src/scenes/orrery/orrery.css` | Converted |
| `src/scenes/scroll/scroll.css` | Converted |

### Nest media queries inside their selector — non-negotiable

A `@media` query that targets one selector (or a small selector group
that all get the same override) is written *inside* that selector's own
rule block, using native CSS nesting, not as a separate top-level
`@media { ... }` block elsewhere in the file:

```css
.foo {
  color: red;
  padding: 1rem;

	@media (min-width: 601px) {
		padding: 2rem;
	}
}
```

**Why:** a selector's responsive behavior belongs next to its base rule,
not scattered into a same-file-but-far-away block the reader has to go
find. This was a real problem in the pre-v3.9.16 codebase: every one of
`sphere.css`'s three panel selectors had their `max-width` override
sitting *before* an unrelated unconditional rule later in the file with
identical specificity — meaning the override was silently dead at every
viewport width, discovered only because nesting forced a full re-read of
each selector's complete responsive story in one place (see the
mobile-first table above, sphere.css row). Nesting doesn't just read
better, it makes this class of bug structurally harder to introduce,
because there's no "far away" place for a stray override to get lost.

**Formatting:** the nested `@media` block and everything inside it is
indented with tab characters, not spaces — this visually distinguishes
"this is nested, breakpoint-specific behavior" from the file's ordinary
2-space property-declaration indent at a glance. Regular declarations in
a rule come before any nested `@media` block, not interleaved with it.

**Browser support isn't actually a constraint here.** Native CSS nesting
reached Baseline Widely Available in June 2026 (Chrome 120+, Firefox
117+, Safari 17.2+, ~94% global support), which would already be enough
to use directly — but it's moot either way: Vite's build pipeline
(esbuild) expands nested syntax into ordinary flat `@media` blocks at
build time, confirmed by inspecting `dist/assets/*.css` after a
production build. The browser visiting the live site never sees nested
syntax at all, regardless of what it supports; nesting is purely a
source-authoring convenience.

**Multi-selector media blocks** (a query that applies to several
unrelated selectors, like a `prefers-reduced-motion` block spanning five
different elements) got the same treatment where practical in v3.9.16 —
nested separately into each selector it touches, even though that means
writing the query condition more than once — but this wasn't pushed
through as an exhaustive mechanical pass across every existing
`prefers-reduced-motion` block sitewide (some remain top-level,
multi-selector blocks, which is still valid and legible for a query that
genuinely wants "these five things, together"). Nest on touch: any time
a selector with a top-level media override gets edited again, move its
query inline as part of that edit.

Every converted file was verified property-by-property equivalent at
representative viewport widths bracketing each breakpoint (using a small
CSS-cascade simulator, not visual screenshots — this sandbox has no live
browser) before and after the restructure, so the conversion changed
*only* the direction of the media query, not any actual rendered value,
except where noted (sphere.css).

**`main.css` and `theater.css` were deliberately held back from the
v3.9.16 pass** and converted as a dedicated v3.9.17 follow-up instead,
with live-browser verification this sandbox didn't have access to at the
time (a `claude-in-chrome`-connected real Chrome browser became
available for the follow-up). Both carried precisely-tuned, historically
fragile responsive logic where a hand-transcription error during
inversion would have carried real regression risk:

- `main.css`'s nav-icon/landing responsive system has pixel-perfect math
  tied to the live scene count, which has changed at least four times
  and caused a real production bug (icons clipped off both edges,
  invisible with nothing else visibly wrong) each time it did. It also
  had interacting breakpoints at 1200px/768px/480px (`.preview-row-break`,
  the nav-icon shrink, `#landing-bottom-fade`, `#scene-previews`'s
  column-stack switch) and a cascade-order-dependent progressive-
  enhancement trick (`align-items: center` then `align-items: safe
  center`, relying on declaration order). Converted in v3.9.17: every
  selector's responsive story now lives nested in its own rule (see
  `#pm-nav`/`.nav-icon`'s shared comment for the full icon-count math,
  now consolidated in one place instead of split across two old
  breakpoints). Live-verified via `claude-in-chrome` at 500px, 606px,
  650px, and 716px (the exact width the 2026-08-23 3.0 QA pass caught
  the dead zone at) — all 10 icons rendered fully visible at every
  width, with the correct tier switch confirmed above 769px.
- `theater.css` had a genuine compound media query —
  `@media (max-width: 480px), (max-width: 700px) and (orientation:
  portrait)` — mixing an OR of a width-only condition and a
  width-AND-orientation condition. Inverting each clause independently
  would have changed the logical relationship between them, not just the
  direction, so this used De Morgan's law on the whole condition instead:
  `NOT((width<=480) OR (width<=700 AND portrait))` reduces to
  `(width>700) OR (width>480 AND landscape)`, i.e.
  `@media (min-width: 701px), (min-width: 481px) and (orientation:
  landscape)` — the exact logical complement, not an approximation. Two
  selectors (`.tab-house`, `.tab-screen`) were touched by three
  overlapping source queries at once and needed more than one
  min-width/orientation tier per property; see their own comments in the
  file for the derivation. Verified with a cascade simulator extended to
  understand `orientation` (not just width) across 18 width×orientation
  points spanning every distinct region, then live-verified via
  `claude-in-chrome` at three of the four regions — full-desktop
  (900×198 landscape), the compound-query-active mobile tier (500×722
  portrait), and critically the narrow-but-landscape "in-between" tier
  (600×198 landscape, the case most likely to expose a De Morgan's-law
  error) — all matched the derived values exactly. The fourth region
  (width<=480 AND portrait) could not be reached live: this sandbox's
  browser pane has a hard ~500px width floor that repeated resize
  attempts (different widths, different aspect ratios, multiple tabs)
  couldn't get under, so that region rests on the cascade-simulator
  verification and hand derivation alone, not a live render. Flagged
  here rather than silently treated as fully live-verified.

## JavaScript

Swept for `var` (none — the codebase already uses `let`/`const`
exclusively), nested callback chains (none — the few `async`/`await` and
`.then()` usages found, in `butterfly.js`, `sceneKit.js`, and
`beamline.js`, are each a single well-scoped async operation, not a
pyramid), and manual per-item `addEventListener` where delegation would
help (found eight `querySelectorAll(...).forEach(...)` sites, all
attaching listeners to small, bounded lists — nav icons, a handful of
cross-links per opened panel — that get replaced wholesale via
`innerHTML` on each re-render, so old listeners are garbage-collected
with their nodes rather than leaking; delegation would be
over-engineering here, not a fix).

`src/utils/sceneKit.js` already exists specifically to hold logic that
was duplicated across scene files and got extracted once it showed up a
third time — `bindEscapeClose`, `createPanelCloser`, `createJumpList`,
`wireCrossLinks`, `formatInboundNote`, `escapeHtml`, `parseHTML`,
`bindPersistedSoundToggle`, and others. A grep for raw `key === 'Escape'`
checks outside `sceneKit.js` turns up nothing — every scene with a
closeable panel already goes through the shared helper rather than
reimplementing it. This is the standing pattern: when the same logic
appears in a third scene file, it belongs in `sceneKit.js`, not
copy-pasted again.

**Conclusion:** the JS audit (v3.9.16) found no genuine anti-patterns in
the categories checked. This is worth stating plainly rather than
manufacturing findings to justify the pass — the honest result of a
"look for dated patterns" sweep can be "didn't find any," and that's the
useful thing to record here so a future pass doesn't have to redo this
sweep from a standing start.

### A constant scaled against the thing it measures is invalidated by a form change

When a scene's form changes, every constant that was tuned against the old form
is suspect, and the dangerous ones are those whose units are the object's own.

**What it cost.** Psyshell's propagation ran at 4.3 world units a second with a
front 0.24 units wide, tuned on a branch whose paths ran five units and more.
The lens that replaced it is 1.7 units across, so the front crossed the entire
object in under half a second and **the scene's central gesture was invisible** —
no error, no warning, and the code was exactly as correct as it had been.

**Two things follow.** When a form changes, list the constants whose units are
the object's own and re-derive each one against the new object; and where a
constant must be preserved through such a scaling (Psyshell's τ is a ratio of two
of them, and the transmission's whole verified timing depends on it), scale the
group together rather than retuning members individually, and say in the code
which quantity the scaling is protecting.

**And check it by looking.** This was found by capturing frames after a real
click and finding the excitation already gone by the first one — with a real time
axis, because `page.screenshot()` costs far more than the interval it is asked
for.

### Scene lifecycle goes through `sceneKit`, not hand-rolled per scene

v4.0 extracted five lifecycle helpers, each because the same hazard was
found independently in most of the ten scenes. A new scene uses these
rather than reinventing them, and an existing scene being touched for
another reason should be moved onto them while it's open:

- **`claimContainer(container, opts)` → `{ setCursor, restore }`.**
  `#experience-container` is one element that `main.js` empties but never
  replaces, so any inline style a scene writes on it survives into the
  next scene. Seven scenes wrote `position`/`overflow`, two wrote
  `tabIndex`, several wrote `cursor` on hover, and exactly one put
  anything back. The visible version: Orrery sets `cursor: none` for its
  crosshair, so leaving Orrery for Theater, Scroll, Butterfly or Outside
  left the visitor with no mouse pointer at all. Route hover through
  `setCursor` so `restore()` is guaranteed to cover it.
- **`disposeSceneGraph(root)`.** `material.dispose()` does not dispose the
  textures hanging off the material. Every scene's hand-written traversal
  disposed `material.map` and nothing else, so `roughnessMap`,
  `metalnessMap` and `emissiveMap` leaked — 27 canvas textures per visit
  in Orrery alone. Taking the root rather than a hand-kept array also
  closes the other half of that bug: objects added straight to `scene`
  instead of into the group the old traversal walked were never freed.
- **`manageRenderer(renderer, opts)` → `{ applyPixelRatio, dispose }`.**
  Caps `devicePixelRatio` at 2 (uncapped, a DPR-3 phone renders nine
  times the fragments; Beamline had capped since v3.9.x and looked
  identical doing it), binds a `webglcontextlost` handler, and actually
  releases the context — `THREE.WebGLRenderer.dispose()` does not, and
  with eight preview contexts alive permanently plus one per open scene
  against a browser cap near sixteen, scene switches accumulated orphans
  until the browser force-lost the *oldest*, i.e. the landing tiles.
- **`createFrameClock()` → `{ tick, elapsed, resync }`.** No animation
  advances by a fixed per-frame constant. `requestAnimationFrame` runs at
  the display's refresh rate, so `t += 0.01` is double speed on a 120Hz
  panel. Orbiter was measured at 0.713 rad/s against a tuned 0.60. In
  Beamline it wasn't even cosmetic: `computeSustain()` derives a reading
  duration in real seconds from a words-per-second constant and compared
  it against a frame counter, so a 116-word passage got 25 seconds of its
  specified 50. Multiply a rate tuned at 60fps by `dt * 60` rather than
  re-deriving it.

  **Why the 4.0 pass missed four more, and it is not the reason first
  recorded here.** The correction matters more than the original claim, so
  both are kept.

  The first account was that audit finding 16 searched for the *rate* shape
  (`+=` against a tuned value) and could not see the *count* shape (how many
  things to do this frame — Butterfly's `PPF`, Harmonics'
  `GALAXY_TWINKLE_KICKS`). That distinction is real and worth keeping: a loop
  whose iteration count decides how far state advances is as frame-coupled as
  `t += 0.01`, and it contains no `+=` at all. When sweeping, say for each
  loop whether it is that or a traversal of a fixed population — the latter
  is fine and is most of them.

  But it is not the operative cause, because it does not explain Sphere.
  `lightAngle += 0.003` is a plain rate in exactly the syntax being searched
  for, in a file the audit read in full (its stated method: all ten scenes
  read in full, 22,626 lines). It survived anyway.

  What actually happened is visible in finding 16's own table, whose column
  header is **"Symptom at 120 Hz"**. Every row is a coupling that
  *contradicted something else*: Beamline derived a reading duration in real
  seconds and compared it to a frame counter; Orbiter had a tuned 0.60 rad/s
  to measure against; Library had a named shimmer rate; Orrery's belt visibly
  outran the Kepler planets its own speed was derived from. Sphere's ambient
  rotation and Butterfly's `PPF` have no referent — nothing in either file
  says what they are supposed to be, and running twice as fast on a 120Hz
  panel produces no contradiction, just a slightly different look nobody can
  call wrong. **An audit organised around symptoms finds every instance that
  is inconsistent with something, and is blind to every instance that is
  uniformly wrong.**

  The durable lesson is therefore about method, not about counts: the scope
  was stated — it is right there in the column header — and nobody read it as
  a limit, so "frame-rate coupling in four scenes" was taken to mean there
  were four. Report an audit's ruler as loudly as its findings, the same way
  this project already requires a measurement to be reported with its method.

  A second thing that survived because nobody looked for it: **four scenes
  have no frame clock at all.** Butterfly, Sphere, Scroll and Theater. Scroll
  and Theater are correct — their motion is CSS and DOM, with no `rAF` loop
  to couple to. Butterfly and Sphere are not: Sphere runs `lightAngle +=
  0.003` and two rotation constants with no clock in the file, and Butterfly
  integrates from a fixed per-frame `t += 0.008`. Butterfly's is at least
  *argued* — a comment on its `setPaused` reasons that a Lorenz trajectory
  has no notion of real time, which is true of the trajectory and irrelevant
  to how fast a viewer watches it drawn. Sphere's has no comment at all.
- **Converting a per-frame count needs a carry, not a round.** Rates convert
  cleanly — `x += 0.003` becomes `x += 0.003 * dt * 60` and that is the whole
  change. Counts don't: 240 points per second divides into no real refresh
  rate evenly, and `Math.round` per frame rounds the same direction every
  frame at a given rate, which is frame-rate dependence again in a quieter
  form. Keep the fractional remainder in a variable that outlives the frame
  (`carry += rate * dt; const n = Math.floor(carry); carry -= n;`) so the
  count is exact over an interval rather than merely close per frame. At
  144fps this is the difference between landing on the tuned value and
  drifting off it. Butterfly's trail advance and Harmonics' twinkle spawn both
  do this.
- **And check what else read that count.** Butterfly's glow trail copied "the
  last `PPF` points" out of the main ring buffer — a back-reference that was
  correct only while `PPF` *was* the number written each frame. The moment the
  count became variable, the same expression started reading the wrong window,
  silently, and identically at 60fps where `dt` barely moves. A per-frame
  count is often load-bearing somewhere else; grep every use before converting
  one, and make the converted value a single variable both sites read.
- **Every scene draws its first frame before `create()` returns.** Call
  `animate()` directly; do not merely schedule it with
  `requestAnimationFrame`. `main.js` runs `syncPreviewPlayback()` the moment
  `initPreviews()` resolves, and that can `setPaused(true)` — cancelling a
  queued first callback before it ever runs. A scene that scheduled its first
  frame has then drawn *nothing*, and for a preview tile using
  `mountClippedPreviewCanvas` that means a canvas still at the 300x150
  default with no pixels in it. Orrery, Beamline and Sphere always called
  `animate()` directly; Harmonics and Outside scheduled it, and they are
  precisely the two tiles reported blank on 2026-09-01. Reproduced by
  stubbing `requestAnimationFrame` to a no-op before load: the three direct
  callers hold a frame, the two schedulers hold nothing.
- **`trackTimers()` → `{ after, nextFrame, cancel, dispose }`.** Fifteen
  untracked `setTimeout`s existed across six scenes. Library's 500ms
  panel side-flip was the live one: it re-entered `populatePanel()` on a
  detached panel, which called `onPieceChange()`, which is how `main.js`
  writes the URL — so a scene you had already left could rewrite
  `location.hash` out from under the scene that replaced it. Prefer
  `nextFrame` over a magic millisecond constant guessing at a CSS
  transition.

**Related contract:** a scene's `create(container, {preview})` returns an
object that should expose `setPaused(paused)`. `display: none` does not
stop `requestAnimationFrame`, so before v4.0 all eight WebGL preview
tiles kept rendering at 60fps behind an opaque overlay alongside the open
scene, and in a background tab. `main.js` now pauses them on expand, on
`visibilitychange`, and per-tile via an `IntersectionObserver`.

### Scenes load via dynamic `import()`, and the registry lists names only

**Updated 4.2.0 — the first paragraph of this rule was stale for one release
and is corrected here rather than rewritten away, because the correction is the
interesting part.** The rule as originally written said a new scene adds its own
`load: () => import(...)` to the registry. That is no longer where loaders live,
and following it now would break the build outright — see the registry file's
own header. The mechanism it describes is right; the address is wrong.

**The rule as it now stands:** `src/scenes/registry.js` holds names and metadata
and **no imports of any kind**. `main.js` derives each scene's loader from those
keys with `import.meta.glob('./scenes/*/*.js')`, which produces the same lazy,
code-split per-scene dynamic imports and removes the second list of scene names.
Adding a scene is one registry key plus a folder and entry file named after it;
a mismatch fails on open with a named error rather than a bare `undefined`.

**Why the registry must stay import-free**, since "a dynamic import is lazy, so
it's harmless" is the reasonable-sounding thing that broke it: `vite.config.js`
imports `scripts/prerender.js`, which imports the registry — and Vite bundles
its own config, following dynamic imports statically as it goes. Keeping
`load:` there pulled the entire scene graph, `?raw` templates and CSS
side-effect imports included, into the config bundle, and the build died before
it started.

**The historical reasoning, unchanged and still the point of all this:**
as of v3.10.0 scenes load by dynamic `import()` rather than a static
`import { createX } from ...` at the top of `main.js` — a new scene should
follow that pattern, not revert to a static import. Static imports for all ten scenes were the direct cause of the
Rollup `chunks larger than 500kB` warning (every scene's code, whether
needed yet or not, landed in one bundle); dynamic `import()` lets Rollup
code-split each scene into its own chunk instead. See `main.js`'s own
`SCENES` registry comment and NOTES.md's 3.10.0 entry for the full
reasoning, and `loadSceneCreate()`/`prefetchScene()` for the shared
promise-cache pattern every caller (previews, `expandScene`, hover/touch
prefetch) goes through so the same scene never gets fetched twice.

**Update, v3.10.3, arc closed:** every scene is still one file, one
exported `create(container, {preview})` with a runtime branch — that
part of the shape never changed and isn't going to. What changed is
whether a scene's own *content* (`<name>.text.js` — the actual
poems/fragments/scripts/catalog) loads eagerly or not. Five scenes
(Harmonics, Orrery's audio, Sphere, Scroll, Theater) now dynamically
`import()` that content only inside their full-mode branch, so a preview
thumbnail that never displays it doesn't pay for it. Two scenes
(Beamline, Library) were assessed and found to have no safe version of
this: Beamline's full-mode-only code all closes over scene/camera/
renderer state, and Library's preview mode needs the real catalog to lay
out the shelf's own geometry, not just to texture it. Three scenes
(Orbiter, Butterfly, Outside) remain untouched — checked and found to be
not worth the risk for the remaining payload (see NOTES.md's 3.10.3
entry for the exact byte breakdown). Don't assume "scene chunk exists"
means "that scene's content chunk is deferred" — check the scene's own
import (static top-of-file vs `import()` inside `if (!preview)`) before
touching it.

### New interactive code always uses `addEventListener`, never inline handlers

**Settled in v4.0: `script-src` is now plain `'self'`.** No
`'unsafe-hashes'`, no `sha256-` entries, nothing to maintain.

The history matters, because it is why the rule is worth keeping. v3.12.0
allowlisted exactly 11 hashes — one per distinct `onmouseover`/`onfocus`
`pmGlimpse('<scene>')` string, the only inline handlers left anywhere in
the codebase — and declared that list closed at 11, legacy-only, with the
friction of computing a new hash deliberately left in place so it
couldn't quietly grow. v4.0 removed the legacy instead: all 42 attributes
across 21 elements became two delegated listeners in `main.js` keyed off
`data-scene`.

That turned out to fix a live behavioural bug as a side effect, which is
the part worth remembering. `mouseover` **bubbles**, so an
`onmouseover` on a nav `<button>` fired once for every child shape in
its icon SVG as the pointer crossed them — measured at four calls for a
single hover pass over the Sphere icon, against a documented "1-in-100
chance per hover". The delegated replacement uses `pointerenter`, which
doesn't bubble, and now fires exactly once. The prefetch listeners three
lines away in the same file had used `pointerenter` correctly all along;
the inline attributes were the only place the distinction got lost.

So the standing rule is unchanged and now costs nothing to hold: any new
interactive markup wires up via `addEventListener` from the start. Adding
an `onclick=`/`onmouseover=` attribute now means re-opening `script-src`,
which is a much larger conversation than appending a hash was. See
`.htaccess`'s own CSP comment block and NOTES.md's 3.12.0 and 4.0
entries.
