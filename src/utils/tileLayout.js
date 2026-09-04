// ─── The landing page's layout arithmetic ───────────────────────────────────
// NO DOM AND NO CSS IMPORTS, and that is the whole reason this file exists
// separately from main.js: this arithmetic states the site's one hard layout
// requirement, and a requirement that cannot be imported by a test is a
// requirement that can only be checked by opening a browser and squinting.
// `scripts/verify-landing.mjs` imports it and sweeps a viewport matrix.
//
// Same reasoning that put the registry in its own file, and the same shape of
// bug behind it: 4.11.0 shipped a version of this that reported "all twelve
// above the fold" while the page scrolled by 80 pixels, and the only thing that
// caught it was measuring a real scrollHeight by hand.
import { SCENES } from '../scenes/registry.js';

// If no column count reaches TILE_FLOOR, nothing fits legibly and the page
// stops trying: it falls back to the phone layout, which scrolls, and that is
// the honest answer rather than shrinking the tiles until they are decoration.
//
// **This is the scaling threshold, and it now announces itself.** Twelve fit.
// Sixteen probably fit at a smaller tile. Twenty-four will not, and the moment
// they do not is the moment `.rows-forced` stops going on — visible, measurable,
// and not a judgement call. That is when the index has to become something
// else, and `src/utils/sceneField.js` is shelved for exactly that.
export const TILE_MAX = 272;
// The floor is a legibility claim and so it is sourced rather than picked: the
// phone layout has shipped 136px tiles at 320px since 4.9.1 and the previews
// are recognisable there, and a desktop is viewed from further away than a
// phone.
//
// 168 until 4.11.15, and lowered because it now applies to the SMALLEST tile on
// the page rather than to all of them. A uniform grid's floor and a varied
// field's floor are different quantities: the old number said "no tile below
// 168" about thirteen identical tiles, and holding it while the tiles vary
// would have meant a mean tile of about 190 and a largest near 235, which does
// not fit the height any real laptop has. 152 is still 12% above the phone
// precedent, on a screen further from the eye, and it is what lets the sizes
// differ at all.
export const TILE_FLOOR = 152;
export const TILE_GAP = 24;      // #scene-previews' gap at >=769px
export const LIST_PAD = 32;      // its own padding, both axes (1rem each side)

// ─── Every tile is a different size now, and the arithmetic has to know ─────
// `registry.js` gives each scene a `tile` multiplier and a `nudge` — see its own
// comment for why those are facts about the scene. What that costs here is that
// "the tile size" is no longer one number: it is a BASE, and every tile is the
// base times its own multiplier, offset by its own nudge.
//
// Two constraints instead of one, and they pull opposite ways:
//
//   - the LARGEST tile has to fit the width and height budget, so the column
//     and row allowances are sized against `maxScale`;
//   - the SMALLEST tile has to stay legible, so the floor is checked against
//     `base * minScale` rather than against the base.
//
// Which is the whole change. Nothing about the requirement moves: all thirteen
// visible without scrolling, at a size you can read. It is simply no longer the
// same size for all thirteen. `scripts/verify-landing.mjs` sweeps a viewport
// matrix and asserts it, because the last time this arithmetic was changed it
// claimed a fit it did not have by 80 pixels, and a claim like that should not
// be checkable only by opening a browser and squinting.
const TILE_SCALES = Object.values(SCENES).map(s => s.tile ?? 1);
const TILE_NUDGES = Object.values(SCENES).map(s => s.nudge ?? 0);
export const MAX_TILE_SCALE = Math.max(...TILE_SCALES);
const MAX_SCALE = MAX_TILE_SCALE;
const MIN_SCALE = Math.min(...TILE_SCALES);
// ─── The stagger is paid for out of the gap, not out of the height ──────────
// The first version added the nudge span to every row's budget, which is the
// obvious accounting and is wrong twice over: it is expensive — three rows pay
// for it three times, and it cost 1440x700 and 1024x700 their fit outright,
// both of which used to work — and it is not what a gap is for. TILE_GAP is 24
// pixels of breathing room between rows; a stagger of eight or twenty pixels
// lives inside that and no two tiles come closer than they already were.
//
// So the span is bounded by the gap instead of budgeted for, and `nudgeScale`
// below shrinks the offsets if a large base would push them past it. Checked in
// `scripts/verify-landing.mjs` rather than asserted here.
const NUDGE_SPAN = Math.max(...TILE_NUDGES) - Math.min(...TILE_NUDGES);

// How much of each scene's nudge is actually spent, given a base — 1 normally,
// and less on a very large tile where the full span would eat the whole gap.
export function nudgeScale(base) {
  const span = base * NUDGE_SPAN;
  return span > TILE_GAP ? TILE_GAP / span : 1;
}

// ─── Variation is spent from SLACK, and can never cost a fit ────────────────
// The first version sized the columns against the largest multiplier and checked
// the floor against the smallest, which is correct arithmetic and the wrong
// design: a fixed 1.24 of dynamic range against a fixed budget and a fixed floor
// simply loses fits at tight viewports. It cost 1440x700 and 1024x700 outright,
// both of which had worked, and the second only showed up because the control
// was run — the uniform layout, in the current code, at the same sizes.
//
// So `v` is how much of each scene's variation is actually applied, from 1 (all
// of it) down to 0 (a uniform grid, pixel-identical to what shipped before any
// of this). The layout takes the largest `v` that still fits. **The requirement
// always wins and the variation is a luxury bought with whatever is left over**,
// which means this can never be worse than a uniform grid — a property the
// verifier asserts rather than a promise this comment makes.
//
// On a large screen `v` is 1 and the tiles range 0.90 to 1.12. On a 1024px
// window it lands somewhere in between and the field is subtler. On a laptop
// too small for thirteen legible tiles it is a uniform grid again, and then the
// page gives up and scrolls, which it always did.
const V_STEPS = 16;

export function tileLayout(n, width, height) {
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    // The vertical budget has two terms that are easy to miss, and missing them
    // made an earlier version of this claim a fit it did not have — the page
    // reported "all twelve above the fold" while #landing scrolled by 80px.
    // Both were found by measuring the real scrollHeight rather than by
    // trusting the arithmetic that produced the layout.
    //
    //   - The list's own vertical padding, which is not part of any tile.
    //   - A .preview-row-break is a flex ITEM, so it sits on its own line and
    //     takes a row-gap on BOTH sides. Three rows of tiles is five flex
    //     lines, not three, and four row-gaps rather than two.
    //
    // The stagger is not a third term — see `nudgeScale`: it is spent out of
    // the gap that already exists between rows rather than out of new height.
    const wBudget = width - (cols - 1) * TILE_GAP - LIST_PAD;
    const hBudget = height - (2 * rows - 2) * TILE_GAP - LIST_PAD;

    // Most variation first, and stop at the first amount that fits.
    for (let step = V_STEPS; step >= 0; step--) {
      const v = step / V_STEPS;
      const hi = 1 + (MAX_SCALE - 1) * v;
      const lo = 1 - (1 - MIN_SCALE) * v;
      const base = Math.min(wBudget / cols / hi, hBudget / rows / hi, TILE_MAX / hi);
      // The floor is a legibility claim, so it applies to the SMALLEST tile that
      // will actually be drawn and not to the base, which nothing draws.
      if (base * lo < TILE_FLOOR) continue;
      // ─── Tie-breaks, in order, and only ever among ties ───────────────────
      // Tile size decides first and nothing below can overrule it — that is the
      // requirement. Two arrangements often show the tiles at exactly the same
      // size, and then: no orphan last row (a single tile under two full rows
      // reads as an afterthought rather than as the newest scene), then fewer
      // rows, since at equal size the shallower arrangement puts more of the
      // set in the eye at once. And variation last of all, which is what makes
      // it a luxury: it never buys a smaller tile.
      //
      // `base` is kept as a raw float and floored only at the end. An earlier
      // version stored Math.floor(base) and compared the next candidate's float
      // against it, so 214.67 beat a stored 214 by "more than half a pixel" and
      // every tie scored as an improvement — which is why the orphan rule
      // appeared to do nothing.
      const orphan = n % cols === 1 && rows > 1;
      const cand = { cols, rows, base, orphan, v };
      if (!best) { best = cand; break; }
      const better =
        base > best.base + 0.5 ? true :
        base < best.base - 0.5 ? false :
        best.orphan !== orphan ? !orphan :
        rows !== best.rows ? rows < best.rows :
        v > best.v;
      if (better) best = cand;
      break;
    }
  }
  return best && { ...best, base: Math.floor(best.base) };   // null when nothing fits legibly
}

// The multiplier a scene's tile actually gets, given a fit — its registry value
// pulled toward 1 by however much variation the viewport could afford.
export function tileScale(spec, fit) {
  return 1 + ((spec?.tile ?? 1) - 1) * (fit?.v ?? 0);
}
export function tileNudge(spec, fit) {
  return (spec?.nudge ?? 0) * (fit?.v ?? 0) * nudgeScale(fit?.base ?? 0);
}

// What the layout above actually occupies, in pixels, given a fit. Exported for
// `scripts/verify-landing.mjs`, which asserts it against the height it was told
// it had — the arithmetic checking itself against its own inputs rather than
// against a browser nobody is looking at.
export function tileLayoutHeight(fit) {
  if (!fit) return 0;
  const hi = 1 + (MAX_SCALE - 1) * fit.v;
  return fit.rows * fit.base * hi + (2 * fit.rows - 2) * TILE_GAP + LIST_PAD;
}

