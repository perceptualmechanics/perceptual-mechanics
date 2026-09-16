import { readFileSync } from 'node:fs';
import { tileLayout, tileLayoutHeight, nudgeScale, tileScale, tileNudge, TILE_GAP, TILE_MAX } from '../src/utils/tileLayout.js';
import { SCENES } from '../src/scenes/registry.js';
import { TILE_FLOOR, LIST_PAD } from '../src/utils/tileLayout.js';
import { pathToFileURL } from 'node:url';
const ROOT = new URL('../', import.meta.url);

export function verifyLanding() {
const log = [];
const say = (...a) => log.push(a.join(' '));
const console = { log: say, error: say };
let failed = 0;

const SCENE_COUNT = Object.keys(SCENES).length;

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

const WIDTHS = [601, 768, 900, 1024, 1280, 1440, 1600, 1920, 2560, 3440];
const HEIGHTS = [400, 500, 600, 700, 768, 800, 900, 1080, 1440];

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
      if (uniformBase(w, h) > 0) {
        failures.push(`${w}x${h}: no varied layout fits, but a uniform grid gets ${uniformBase(w, h)}px — variation has cost a fit`);
      }
      none++;
      continue;
    }
    fits++;
    const hi = 1 + (MAX_SCALE - 1) * fit.v;
    const used = fit.rows * fit.base * hi + (2 * fit.rows - 2) * cssGap + cssPad;
    if (used > h + 0.5) {
      failures.push(`${w}x${h}: chose ${fit.cols}x${fit.rows} at base ${fit.base}px, which occupies ${used.toFixed(1)}px of ${h}px measured with the stylesheet's own gap (${cssGap}px) and padding (${cssPad}px)`);
    }
    const span = fit.base * NUDGE_SPAN * nudgeScale(fit.base);
    if (span > TILE_GAP + 0.5) {
      failures.push(`${w}x${h}: stagger spans ${span.toFixed(1)}px, which is more than the ${TILE_GAP}px row gap it is spent from`);
    }
    const sizes = Object.values(SCENES).map(sp => fit.base * tileScale(sp, fit));
    const smallest = Math.min(...sizes), largest = Math.max(...sizes);
    if (smallest < TILE_FLOOR - 0.5) {
      failures.push(`${w}x${h}: smallest tile is ${smallest.toFixed(1)}px, below the ${TILE_FLOOR}px legibility floor`);
    }
    if (largest > TILE_MAX + 0.5) {
      failures.push(`${w}x${h}: largest tile is ${largest.toFixed(1)}px, over the ${TILE_MAX}px cap`);
    }
    const uni = uniformBase(w, h);
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log } = verifyLanding();
  log.forEach(line => console.log(line));
  if (!ok) process.exit(1);
}

