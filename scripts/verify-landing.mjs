// ─── The landing requirement, checked rather than asserted ──────────────────
// Run with `node scripts/verify-landing.mjs`.
//
// SITE.md states it as the landing page's requirement, and it is the thing every
// future layout decision has to satisfy: **every scene's tile visible without
// scrolling, on a desktop, at a size you can read.** Layout is a consequence of
// it rather than a taste.
//
// It has been broken twice by arithmetic that looked right. 4.11.0 shipped a
// version that reported "all twelve above the fold" while the page scrolled by
// 80 pixels, because the list's own padding and the double row-gap either side
// of each break were missing from the budget. Both were found by measuring a
// real scrollHeight in a browser. That is a bad place for the only check to
// live: it needs somebody to open the page, at the right window size, and
// notice.
//
// So this sweeps a matrix of viewport sizes and asserts, for each one, that the
// layout the page would choose actually fits inside the height it was given —
// using the same tileLayout the page uses, and its own accounting of what it
// occupies. It cannot catch a CSS rule that disagrees with the arithmetic; it
// can catch the arithmetic disagreeing with itself, which is what happened.
import { readFileSync } from 'node:fs';
import { tileLayout, tileLayoutHeight, nudgeScale, tileScale, tileNudge, TILE_GAP, TILE_MAX } from '../src/utils/tileLayout.js';
import { SCENES } from '../src/scenes/registry.js';
import { TILE_FLOOR, LIST_PAD } from '../src/utils/tileLayout.js';
import { pathToFileURL } from 'node:url';
const ROOT = new URL('../', import.meta.url);

// Not from main.js: it imports CSS and boots against a DOM, so Node cannot load
// it. That is precisely why the arithmetic was lifted into its own module — an
// unimportable requirement is an unverifiable one.
// Returns { ok, failures, log } — the shape vite.config.js's build plugins
// take, so this runs on every build rather than only when somebody remembers.
export function verifyLanding() {
const log = [];
const say = (...a) => log.push(a.join(' '));
const console = { log: say, error: say };
let failed = 0;

const SCENE_COUNT = Object.keys(SCENES).length;

// ─── The second source ──────────────────────────────────────────────────────
// TILE_GAP and LIST_PAD are JS constants DESCRIBING CSS — "#scene-previews'
// gap at >=769px", "its own padding, both axes". So the CSS is where they can
// be checked against something that is not themselves, and this reads them
// back out of it.
//
// This is the repair for a check that could not fail. The height assertion
// below compared `tileLayoutHeight(fit)` against the height `tileLayout` had
// budgeted, and both are built from the same three terms in the same module —
// `used <= h` was algebra, not a result. Measured across the whole matrix, the
// largest `used - h` was -0.025px against a threshold of +0.5. Worse, the
// specific bug it was written for (4.11.0: the list's padding and the double
// row gap missing from the budget) passes silently when the omission is shared,
// which it is when one module owns both sides. Dropping the row-gap term from
// budget AND accounting: still green. From the budget alone: 35 failures.
//
// Reading the CSS gives it something to disagree with. Change the stylesheet
// without changing the constant, or the constant without the stylesheet, and
// this fires — which is the drift that actually happens.
function cssTileMetrics() {
  const css = readFileSync(new URL('styles/main.css', ROOT), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const start = css.indexOf('#scene-previews {');
  if (start === -1) return { error: 'no #scene-previews rule in styles/main.css' };
  let depth = 0, end = start;
  for (; end < css.length; end++) {
    if (css[end] === '{') depth++;
    else if (css[end] === '}' && --depth === 0) break;
  }
  const body = css.slice(start, end + 1);
  const rem = (v) => Math.round(parseFloat(v) * 16);
  // The tier this gate models is the desktop one: >=769px for the gap,
  // >=601px for the padding. Take the LAST declaration of each, which is the
  // innermost tier's.
  const gaps = [...body.matchAll(/(?:^|[\s;{])gap:\s*([\d.]+)rem/g)].map(m => rem(m[1]));
  const pads = [...body.matchAll(/(?:^|[\s;{])padding:\s*([\d.]+)rem\b(?!\s+[\d.])/g)].map(m => rem(m[1]));
  return { gap: gaps.length ? gaps[gaps.length - 1] : null,
           pad: pads.length ? pads[pads.length - 1] * 2 : null };
}

const SCALES = Object.values(SCENES).map(s => s.tile ?? 1);
const NUDGES = Object.values(SCENES).map(s => s.nudge ?? 0);
const MIN_SCALE = Math.min(...SCALES);
const MAX_SCALE = Math.max(...SCALES);
const NUDGE_SPAN = Math.max(...NUDGES) - Math.min(...NUDGES);

// Real desktop viewports, and the awkward ones on purpose: short laptops in
// landscape, tall narrow windows, the 601px edge where the requirement starts
// applying, and a 4K panel where TILE_MAX becomes the binding constraint.
const WIDTHS = [601, 768, 900, 1024, 1280, 1440, 1600, 1920, 2560, 3440];
const HEIGHTS = [400, 500, 600, 700, 768, 800, 900, 1080, 1440];

// The old uniform arithmetic, kept here as the control rather than imported —
// and now using the STYLESHEET's gap and padding rather than tileLayout's
// constants for them, which is what makes it a control. It previously imported
// three of its four numbers from the module it was controlling, so a change to
// any of them moved both sides identically: the one scenario the sentence
// claimed to exclude.
function uniformBase(w, h) {
  let best = 0;
  for (let cols = 1; cols <= SCENE_COUNT; cols++) {
    const rows = Math.ceil(SCENE_COUNT / cols);
    const t = Math.min((w - (cols - 1) * cssGap - cssPad) / cols,
                       (h - (2 * rows - 2) * cssGap - cssPad) / rows, TILE_MAX);
    if (t >= TILE_FLOOR) best = Math.max(best, Math.floor(t));
  }
  return best;
}

const metrics = cssTileMetrics();
const cssGap = metrics.gap ?? TILE_GAP;
const cssPad = metrics.pad ?? LIST_PAD;

let checked = 0, fits = 0, none = 0;
const failures = [];

if (metrics.error) {
  failures.push(`could not read #scene-previews out of styles/main.css (${metrics.error}) — this check has no second source without it`);
} else {
  if (metrics.gap !== TILE_GAP) failures.push(`tileLayout.js says TILE_GAP is ${TILE_GAP}px; styles/main.css gives #scene-previews a ${metrics.gap}px gap`);
  if (metrics.pad !== LIST_PAD) failures.push(`tileLayout.js says LIST_PAD is ${LIST_PAD}px; styles/main.css gives #scene-previews ${metrics.pad}px of padding across both axes`);
}

for (const w of WIDTHS) {
  for (const h of HEIGHTS) {
    checked++;
    const fit = tileLayout(SCENE_COUNT, w, h);
    if (!fit) {
      // Nothing legible fits: the page scrolls, and says so. But if a UNIFORM
      // grid would have fitted here, the variation has cost a fit outright,
      // which is the thing it is not allowed to do.
      if (uniformBase(w, h) > 0) {
        failures.push(`${w}x${h}: no varied layout fits, but a uniform grid gets ${uniformBase(w, h)}px — variation has cost a fit`);
      }
      none++;
      continue;
    }
    fits++;
    // Accounted from the CSS's own numbers, not the module's. Same shape as
    // tileLayoutHeight, different source for every term that has one.
    const hi = 1 + (MAX_SCALE - 1) * fit.v;
    const used = fit.rows * fit.base * hi + (2 * fit.rows - 2) * cssGap + cssPad;
    if (used > h + 0.5) {
      failures.push(`${w}x${h}: chose ${fit.cols}x${fit.rows} at base ${fit.base}px, which occupies ${used.toFixed(1)}px of ${h}px measured with the stylesheet's own gap (${cssGap}px) and padding (${cssPad}px)`);
    }
    // The stagger is spent out of the row gap rather than budgeted for, so the
    // thing that has to hold is that it fits in the gap. If it ever does not,
    // two tiles in adjacent rows are closer than the gap says they are.
    const span = fit.base * NUDGE_SPAN * nudgeScale(fit.base);
    if (span > TILE_GAP + 0.5) {
      failures.push(`${w}x${h}: stagger spans ${span.toFixed(1)}px, which is more than the ${TILE_GAP}px row gap it is spent from`);
    }
    // And the floor is a claim about the SMALLEST tile, so check the smallest
    // rather than the base — the base is a number nothing draws.
    const sizes = Object.values(SCENES).map(sp => fit.base * tileScale(sp, fit));
    const smallest = Math.min(...sizes), largest = Math.max(...sizes);
    if (smallest < TILE_FLOOR - 0.5) {
      failures.push(`${w}x${h}: smallest tile is ${smallest.toFixed(1)}px, below the ${TILE_FLOOR}px legibility floor`);
    }
    if (largest > TILE_MAX + 0.5) {
      failures.push(`${w}x${h}: largest tile is ${largest.toFixed(1)}px, over the ${TILE_MAX}px cap`);
    }
    // ─── The property that makes the variation safe ─────────────────────────
    // Variation is bought with slack, so it must never cost anything. The
    // control is the uniform layout — computed HERE, in this code, at this
    // viewport, rather than quoted from a measurement taken before the change.
    // That distinction has already produced one false positive in this project
    // and avoiding it costs one function call.
    //
    // The first version of this check compared the BASE against the uniform
    // tile and failed all 74 fitting viewports, which was the check being wrong
    // rather than the layout: the base is a number nothing draws, and it is
    // smaller than the uniform tile precisely because the largest tile is the
    // base times the largest multiplier. What has to hold is that the BIGGEST
    // tile is no smaller than the uniform grid's — variation adds sizes below
    // the old one and never below the floor, and takes nothing off the top.
    const uni = uniformBase(w, h);
    // 1.5px of tolerance, and it is rounding rather than slack: the base is
    // floored to a whole pixel and then multiplied by up to 1.12, so the
    // largest tile can land just over a pixel under the uniform one for that
    // reason alone. Every failure in the first run of this check was between
    // 0.5 and 1.1 pixels, which is what a rounding artefact looks like and not
    // what a design failure looks like.
    if (largest < uni - 1.5) {
      failures.push(`${w}x${h}: largest varied tile is ${largest.toFixed(1)}px where a uniform grid gets ${uni}px — variation is costing tile size`);
    }
  }
}

console.log(`landing: ${checked} viewports, ${fits} with a legible fit, ${none} that correctly decline`);
{
  const vs = [];
  for (const w of WIDTHS) for (const h of HEIGHTS) { const f = tileLayout(SCENE_COUNT, w, h); if (f) vs.push(f.v); }
  const full = vs.filter(v => v > 0.99).length;
  console.log(`         variation: full on ${full} of ${fits}, mean ${(vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(2)} — it is spent from slack, so tight viewports get less`);
}
// ─── Headroom: what the NEXT scene would cost, before anyone writes it ──────
// Not a gate. The requirement is about the scenes that exist, and a fourteenth
// scene failing to fit is not a defect in a thirteen-scene site. It is a
// FORECAST, and it is here because the alternative shipped for three releases:
// tileLayout.js used to guess in a comment — "Twelve fit. Sixteen probably fit
// at a smaller tile. Twenty-four will not" — which is exactly the shape of
// number nobody can re-run. This prints the real one every build.
//
// Two things can go wrong at n+1 and they are different: the layout can lose a
// viewport outright, or it can keep it at a smaller tile. Both are reported,
// because the second is the one that arrives first and quietly.
{
  const drawnOf = (f) => f.base * (1 + (MAX_SCALE - 1) * f.v);
  const lost = [], shrunk = [];
  let held = 0;
  for (const w of WIDTHS) {
    for (const h of HEIGHTS) {
      const now = tileLayout(SCENE_COUNT, w, h);
      if (!now) continue;
      const next = tileLayout(SCENE_COUNT + 1, w, h);
      if (!next) { lost.push(`${w}x${h}`); continue; }
      const d0 = drawnOf(now), d1 = drawnOf(next);
      // Same 1.5px rounding tolerance as the uniform-grid control above, and
      // for the same reason: base is floored before the multiplier is applied.
      if (d1 < d0 - 1.5) shrunk.push(`${w}x${h} ${d0.toFixed(0)}→${d1.toFixed(0)}px`);
      else held++;
    }
  }
  const n = SCENE_COUNT + 1;
  if (!lost.length && !shrunk.length) {
    console.log(`         headroom: scene ${n} costs nothing — all ${held} fitting viewports hold their arrangement and their tile size`);
  } else {
    console.log(`         headroom: scene ${n} holds ${held} of ${fits} viewports; loses ${lost.length}, shrinks ${shrunk.length}`);
    if (lost.length) console.log(`                   no fit at: ${lost.join(', ')}`);
    if (shrunk.length) console.log(`                   smaller at: ${shrunk.join(', ')}`);
  }
}

if (failures.length) {
  console.error(`\nlanding requirement VIOLATED in ${failures.length} of ${fits} fitting viewports:`);
  for (const f of failures) console.error(`  ${f}`);
  failed++;
} else {
  console.log(`ok: every fit occupies no more height than it was given, for all ${SCENE_COUNT} scenes`);
}

// ─── And that the page's tiles can actually be matched to the registry ──────
// The arithmetic above says how big each scene's tile should be. It says
// nothing about whether the right scene gets it, and 4.11.16 shipped a version
// where twelve of the thirteen did not: main.js walked the tiles in document
// order and the registry in its own order, and the two are not the same order.
// The output was thirteen circles at thirteen assorted sizes, which is what it
// looks like when it is working — so nothing about the page announced it.
//
// main.js now looks each tile up by its own `preview-<key>` id, which cannot
// drift. What can still drift is the SET: a tile with no registry entry, or a
// scene with no tile. So the check is a set comparison against the real
// index.html, not an ordering one — an ordering check would have gone stale
// the moment somebody rearranged the markup for a good reason.
{
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/id="preview-([a-z0-9-]+)"/g)].map(m => m[1]);
  const keys = Object.keys(SCENES);
  const orphanTiles = ids.filter(id => !keys.includes(id));
  const tilelessScenes = keys.filter(k => !ids.includes(k));
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  const problems = [
    ...orphanTiles.map(id => `index.html has a tile #preview-${id} with no registry entry`),
    ...tilelessScenes.map(k => `registry scene "${k}" has no #preview-${k} tile in index.html`),
    ...dupes.map(id => `#preview-${id} appears more than once in index.html`),
  ];
  if (problems.length) {
    console.error(`\nlanding tiles do not match the registry:`);
    for (const p of problems) console.error(`  ${p}`);
    failed++;
  } else {
    console.log(`ok: all ${ids.length} tiles in index.html resolve to a registry scene, and every scene has one`);
  }
}

  return { ok: failed === 0, failures: failed, log };
}

// Also runnable on its own, for working on the layout without a full build.
// pathToFileURL, not a template literal. `file://${process.argv[1]}` does not
// percent-encode, so from any path containing a space the comparison is false,
// the CLI branch never runs, and the script exits 0 having verified nothing —
// which for a verification script is the worst available failure mode. Two
// other verifiers here already carry that paragraph and do it correctly; these
// four were written later and did the thing it forbids. Proved by copying the
// tree under a directory with a space and injecting a real failure: no output,
// exit 0.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log } = verifyLanding();
  log.forEach(line => console.log(line));
  if (!ok) process.exit(1);
}

