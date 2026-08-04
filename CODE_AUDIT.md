# Code audit — perceptualmechanics.com

Scope: `index.html`, `styles/main.css`, `src/main.js`, `src/utils/sceneKit.js`, `src/components/colophon.js`, `vite.config.js`, and all nine scene files (`src/scenes/*.js`, ~14,000 lines). Every finding below is cited to a specific file and line and was verified by reading the code, not inferred from a generic checklist — a fair number of things a first-pass audit usually flags (missing skip link, div-as-button, no reduced-motion handling, unsplit vendor bundle, XSS-shaped `innerHTML`) turned out to already be handled deliberately here, and are noted in "Already solid" so this doesn't read as ignorant of that work.

## Headline finding: a copy-pasted hint label is both the biggest duplication and the biggest contrast failure

Seven scenes (`prism.js:256`, `orbiter.js:645,668`, `library.js:1236,1249`, `sphere.js:235`, `orrery.js:1668`, `main.js:149` for butterfly, plus `beamline.js:1283-1285` in modified form) each hand-roll their own `#[scene]-hint` element — the small "drag to orbit · scroll to zoom" style control legend, top-right of the full-screen view. Six of the seven use the literal same three values:

```css
font-size: 0.55rem;
color: rgba(255,255,255,0.3);
```

That's roughly **2.5:1 contrast against black** (WCAG requires 4.5:1 for text this small — 0.55rem is ~8.8px, nowhere near the ~18.7px-bold/24px threshold where the 3:1 "large text" allowance kicks in). Beamline's own version (`beamline.js:1285`, `rgba(120,170,255,0.5)` at `0.7rem`) is a real improvement over the older pattern but still lands around **2.8:1** — still short. Beamline's caption subtitle (`beamline.js:1281`, `rgba(150,190,255,0.55)`) is closer but still under: **~3.7:1**.

This is worth fixing once, not seven times: it's simultaneously the clearest "abstract and hoist" case in the codebase (identical markup/CSS duplicated with drift already visible between versions) and the clearest a11y regression (a value that quietly fails contrast in one scene and gets silently copied into the next five). A single `sceneKit.js` helper — something like `createHintLabel(container, { text })` returning the element with a contrast-safe default (either raise opacity to ~0.55-0.6, which gets pure white to ~4.6:1 at that size, or add a faint scrim behind it the way `#site-title` already does at `styles/main.css:141`) — would fix all seven at once and remove ~40 lines of copy-pasted CSS.

## Best practices — abstraction & hoisting

**`butterfly.js` reimplements four things `sceneKit.js` already centralizes, instead of using them.** `sceneKit.js`'s own header comment (`sceneKit.js:1-12`) explicitly cites butterfly as one of the two scenes whose orbit-drag implementation was used as the reference when the shared helper was extracted — but the migration back into butterfly itself never happened. Concretely, `butterfly.js:229-269` hand-rolls, near-verbatim:
- mouse/touch drag-to-orbit (→ `bindOrbitDrag`)
- wheel zoom (→ `bindWheelZoom`)
- guarded resize (→ `bindGuardedResize`, and without the guard's orientationchange retry)
- the `prefers-reduced-motion` check (→ `prefersReducedMotion()`)

This is real drift risk, the exact failure mode `sceneKit.js` was built to prevent (its own comment: "boilerplate... had drifted slightly out of sync across scenes"). Every other scene with orbit controls (`sphere`, `orbiter`, `orrery`, `library`, `prism`, `leaf`, `beamline`) already imports these. Butterfly's scene-specific policy on top (phi clamp, radius clamp, resume-jitter-after-3s) all still fits cleanly into the callback shape `bindOrbitDrag`/`bindWheelZoom` already expect — this isn't a case where the shared helper is a bad fit, it's just never been wired up.

**`escapeHtml` adoption is inconsistent, though not currently a real risk.** `sceneKit.js:287-298` centralizes HTML-escaping for injected text; `scroll.js`, `orbiter.js`, `theater.js`, and `library.js` use it, but `sphere.js`, `orrery.js`, `prism.js`, `leaf.js`, and `beamline.js` still call `.innerHTML =` directly. I checked every call site — none of them handle untrusted input (it's all first-party literary content, and several, like `sphere.js:310`, deliberately need real HTML because the source text itself contains `<p>`/`<a class="fragment-link">` markup for in-panel cross-links), so this isn't exploitable. Still worth standardizing for the same reason as any lint rule: the next scene added copies whichever pattern is nearest at hand, and five-of-nine is already close to losing the convention.

## Semantic / a11y sweep

**`.fragment-link` (`sphere.js`) is missing a focus style that its two siblings both have.** Three scenes independently built the same "clickable phrase inside a reading panel that jumps to related content" pattern: `sphere.js`'s `.fragment-link`, `orbiter.js`'s `.poem-link`, `library.js`'s `.library-link`. `orbiter.js:709` and `library.js:1356` both style `:hover, :focus` together; `sphere.js:284-286` only styles `:hover`, leaving keyboard focus to whatever the browser's default outline happens to be against this site's dark backgrounds. Same fix as the hint label above, but for one file.

Related, smaller inconsistency: the three implementations disagree on ARIA role — `sphere.js:321,358` and `orbiter.js:836` use `role="button"`, `library.js:287` uses `role="link"`. These are functionally identical (a phrase that navigates you to a different piece of content within the same panel) — that's a link, not a button, and `library.js`'s choice is the semantically correct one. Worth converging the other two on it.

**The keyboard-focus / mouseover parity gap in the `pmGlimpse` easter egg is real but minor.** `index.html`'s nav icons, `#site-title`, and preview tiles all trigger the 1%-chance tab-title flicker via `onmouseover="pmGlimpse(...)"` (e.g. `index.html:88`) — a keyboard user tabbing through the same controls can never trigger it, since `onmouseover` doesn't fire on focus. Purely cosmetic (the feature is a rare, deliberately-invisible-most-of-the-time easter egg, not conveyed information), but a one-line fix: add a matching `onfocus="pmGlimpse(...)"` to each control, or bind both events once at the document level in `main.js` instead of 20+ inline attributes.

**`#experience-overlay`'s `aria-modal="true"` doesn't match its actual behavior — flagged, not necessarily a bug.** `main.js:194` sets `aria-modal="true"` on the overlay, but `#pm-nav` and `#site-title` deliberately stay reachable/interactive while it's open (the overlay's own `aria-label` comment says as much: "no close button; nav is the navigation"). `aria-modal="true"` tells assistive tech everything outside the dialog is inert — that's not actually true here, which a strict automated audit (axe, Lighthouse) would flag. I want to be precise about this one: `colophon.js:356-364` shows this was already thought through carefully elsewhere in the codebase — the colophon dialog is the one place on the site that implements a *real* focus trap (Tab/Shift+Tab cycling), specifically because it's the one place full modality is actually intended, and its own comment explicitly contrasts itself against `#experience-overlay`'s different, deliberate tradeoff. So this isn't an oversight so much as a live semantic tension between "the ARIA attribute says modal" and "the design intentionally isn't." Worth a second look, but I'm not calling it a defect without you weighing in on which way to resolve it (drop `aria-modal`, or make nav genuinely reachable-but-inert to the dialog's contents via a different pattern).

## Already solid (so this audit doesn't ignore the existing work)

- Skip link, landmark `<nav aria-label>`, real `<ul>/<li>/<button>` (not div+role) for the preview grid, `sr-only` heading — all present and dated to a 2026-07-22 a11y pass (`index.html:80,85,228,237,247`).
- `createJumpList` (`sceneKit.js:270-285`) gives keyboard-only visitors a real way into every scene whose interactive objects are raycast-only (sphere, orbiter, orrery, library, prism, beamline) — genuinely uncommon for a WebGL-heavy site to have at all.
- Reduced motion is checked in JS for every scene with a continuous `requestAnimationFrame` loop (`prefersReducedMotion()`, adopted everywhere it's needed), and via CSS media query for the two CSS-only scenes (`scroll.js:653`, `theater.js:261`) — correctly not over- or under-applied.
- `colophon.js` implements a textbook-correct modal: real focus trap, focus returns to the trigger on close, `Escape` closes, backdrop click closes.
- `vite.config.js:55-57` already splits `three` into its own chunk specifically for caching reasons (documented, deliberate) — the "chunks >500kB" build warning isn't an oversight, it's a known tradeoff explained in the config's own comment.
- No `var`, no leftover `console.log`/`debug`, no XSS-shaped `innerHTML` (checked every call site).
- Touch targets (44px minimum, `main.css:91-92`), focus-visible outlines on nav/preview/jump-list controls, and `rel="noopener noreferrer"` on every external link in the colophon are all already correct.

## Suggested next step

The hint-label fix (one new `sceneKit.js` helper, ~7 call-site swaps) resolves the largest duplication and the clearest a11y failure in a single pass, and is low-risk — it only touches static label markup, not any scene's actual rendering/interaction logic. The `butterfly.js` refactor is the next-highest-value item and also low-risk (swapping hand-rolled listeners for the exact same behavior via existing, already-proven helpers). The `.fragment-link` focus style is a two-line CSS fix. The two smaller items (glimpse keyboard parity, `aria-modal` semantics) are worth a decision but not urgent.

I haven't touched any code yet — this is the audit only.
