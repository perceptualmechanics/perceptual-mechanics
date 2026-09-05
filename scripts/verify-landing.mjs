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
import { TILE_FLOOR } from '../src/utils/tileLayout.js';

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
const SCALES = Object.values(SCENES).map(s => s.tile ?? 1);
const NUDGES = Object.values(SCENES).map(s => s.nudge ?? 0);
const MIN_SCALE = Math.min(...SCALES);
const NUDGE_SPAN = Math.max(...NUDGES) - Math.min(...NUDGES);

// Real desktop viewports, and the awkward ones on purpose: short laptops in
// landscape, tall narrow windows, the 601px edge where the requirement starts
// applying, and a 4K panel where TILE_MAX becomes the binding constraint.
const WIDTHS = [601, 768, 900, 1024, 1280, 1440, 1600, 1920, 2560, 3440];
const HEIGHTS = [400, 500, 600, 700, 768, 800, 900, 1080, 1440];

// The old uniform arithmetic, kept here as the control rather than imported,
// so that a change to tileLayout cannot quietly change what it is compared
// against.
function uniformBase(w, h) {
  let best = 0;
  for (let cols = 1; cols <= SCENE_COUNT; cols++) {
    const rows = Math.ceil(SCENE_COUNT / cols);
    const t = Math.min((w - (cols - 1) * TILE_GAP - 32) / cols,
                       (h - (2 * rows - 2) * TILE_GAP - 32) / rows, TILE_MAX);
    if (t >= TILE_FLOOR) best = Math.max(best, Math.floor(t));
  }
  return best;
}

let checked = 0, fits = 0, none = 0;
const failures = [];

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
    const used = tileLayoutHeight(fit);
    if (used > h + 0.5) {
      failures.push(`${w}x${h}: chose ${fit.cols}x${fit.rows} at base ${fit.base}px, which occupies ${used.toFixed(1)}px of ${h}px`);
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
if (import.meta.url === `file://${process.argv[1]}`) {
  const { ok, log } = verifyLanding();
  log.forEach(line => console.log(line));
  if (!ok) process.exit(1);
}

