# perceptualmechanics — coding standards

Durable house rules for this codebase, with the reasoning attached. Read
this file first before any future "modernize the code" pass — the point
of writing it down is so a pattern doesn't get re-flagged, re-argued, or
re-fixed from scratch each time someone (a person or an AI assistant)
looks at this project fresh. NOTES.md has the dated changelog of what
shipped when; this file has the standing rules those changes established.

## General principle

Something that looks outdated isn't automatically wrong. The bar for
changing a pattern is "is there a strictly better tool for what this
specific code is doing," not "is this the newest available syntax." A
full-site audit (v3.9.15, v3.9.16) went through every CSS file and a
representative sweep of the JS looking for exactly this distinction, and
found real anti-patterns alongside patterns that only *look* dated. Both
kinds are recorded below so the next pass doesn't have to re-derive the
reasoning.

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
  no fallback — a real gap, not a style choice).
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

### Scenes load via dynamic `import()`, not a static top-of-file import

As of v3.10.0, `main.js`'s `SCENES` registry holds a `load: () =>
import('./scenes/<name>/<name>.js')` per scene, not a static
`import { createX } from ...` at the top of the file — a new scene added
to the registry should follow the same pattern, not revert to a static
import. Static imports for all ten scenes were the direct cause of the
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
