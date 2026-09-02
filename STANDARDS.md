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
happens in a **separate clone** in the assistant's own container, with its own
`npm ci`. The repo is public, the tracked tree is about 3.5 MB (`assets/` and
`artifacts/` are ignored personal files and the build doesn't read them), and
a clean clone builds and passes all four gates in about a second. Unpushed
local work travels as a `git format-patch` and `git am`, not as a copied
folder.

This folder's `node_modules` belongs to the Mac. Nothing on the assistant side
should write to it — not `npm install`, not `npm ci`, not `npm run build`
(which runs the local `vite` binary out of it).

## Documentation

### Measuring the corpus: name the export, not the module

Lives in full in `perceptualmechanics-chat-brief.md` under "Rules the content
follows", with the other two measurement rules it belongs beside — it is a rule
about counting the writing rather than about writing code, so it is stated once
there rather than twice. The short form, because a coding session is exactly who
walks a module's exports: **`theater.text.js` and `scroll.text.js` each publish
both a source and a derived index over the same text**, on purpose and for good
reasons. Summing a module's namespace counts those words twice and produces a
plausible number rather than an obviously wrong one. This cost a published
measurement its two largest figures on 2026-09-02.


### An implementation brief closes by naming what it invalidates

Standing rule, added 2026-09-02 at the request of the chat instance that
reads these files. Any implementation brief, handoff, or write-up produced
for this project ends by naming **which lines of
`perceptualmechanics-project-brief.md` and
`perceptualmechanics-chat-brief.md` the work it describes makes untrue.**

Not "the briefs may need updating" — the specific claims, so the correction
is a two-minute edit rather than a re-read of both documents.

**Why it earned a rule.** The project brief sat fourteen minor versions
stale before anyone noticed: it announced itself as "current as of v3.9.17",
three of its six standing open items had been resolved and were still listed
as open, and a fourth had flipped the other way. Separately, a 2026-09-02
correction pass found the two briefs disagreeing with each other and with
the data — one said the Library holds 147 items and the other 150 (the
data says 150), and one still described Beamline as a sequence of curved
mirrors, a design the scene left behind long enough ago that the same stale
sentence had also reached `main.js`'s `ariaLabel`, where it was the only
account of that scene a screen-reader visitor got.

None of that is exotic. It is the ordinary fate of a document nobody is
required to touch. A brief that is wrong is worse than no brief, because it
is read as current — and these two exist precisely to stop work being
re-derived or re-proposed, which is the thing they stop doing first when
they drift.

This is the only gate documentation here will ever have: there is no test
that fails when a brief goes stale, and no build step can tell that a
sentence stopped being true. Naming the invalidated lines at the end of the
work that invalidated them is the one moment when someone reliably knows.

## CSS

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
- `-webkit-overflow-scrolling: touch` — **removed** (v3.9.15). WebKit
  shipped native momentum scrolling for all overflow elements in iOS 13
  (2019); the property has had zero effect since. This is the version
  the standing rule (below) means to catch — a prefix kept out of habit
  long after its reason expired.
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

### Layout that depends on the scene count is computed from the registry

Added 4.4.0, and it is one rule with two applications rather than two rules.

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
