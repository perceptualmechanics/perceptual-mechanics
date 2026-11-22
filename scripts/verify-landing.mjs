import { readFileSync } from 'node:fs';
import { tileLayout, tileScale, tileNudge, tileDrift, driftClearance, DRIFT, TILE_MAX } from '../src/utils/tileLayout.js';
import { previewTilesHtml } from './landing.js';
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

// #scene-previews' declarations, each with the min-width of the @media it
// sits in (0 outside one). The gap changes at a breakpoint, so a single
// value for the rule would be right at only some widths; every width is
// checked against the declaration in force there.
function cssTileDeclarations() {
  const css = readFileSync(new URL('styles/main.css', ROOT), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const start = css.indexOf('#scene-previews {');
  if (start === -1) return { error: 'no #scene-previews rule in styles/main.css' };
  const decls = [];
  const stack = [];   // per open block: its min-width, or null for a nested selector
  let text = '';
  for (let i = start + '#scene-previews '.length; i < css.length; i++) {
    const c = css[i];
    if (c === '{') {
      const head = text.trim();
      const media = head.match(/^@media\b(.*)$/);
      const min = media ? Number(media[1].match(/min-width:\s*(\d+)px/)?.[1] ?? 0) : null;
      const outer = stack.length ? stack[stack.length - 1] : 0;
      stack.push(stack.length === 0 ? 0 : (media && outer !== null ? Math.max(outer, min) : null));
      text = '';
    } else if (c === '}' || c === ';') {
      const min = stack[stack.length - 1];
      const m = text.trim().match(/^([a-z-]+)\s*:\s*(.+)$/);
      if (m && min !== null) decls.push({ min, prop: m[1], value: m[2].trim() });
      text = '';
      if (c === '}') { stack.pop(); if (!stack.length) break; }
    } else {
      text += c;
    }
  }
  return { decls };
}

const declared = cssTileDeclarations();
const px = (v) => {
  const m = v.match(/^([\d.]+)(rem|px)$/);
  return m ? parseFloat(m[1]) * (m[2] === 'rem' ? 16 : 1) : NaN;
};
function inForce(prop, w) {
  let best = null;
  for (const d of declared.decls ?? []) if (d.prop === prop && d.min <= w && (!best || d.min >= best.min)) best = d;
  return best?.value ?? null;
}
const gapAt = (w) => px(inForce('gap', w) ?? '');
function padAt(w) {
  const v = (inForce('padding', w) ?? '').split(/\s+/).map(px);
  const [t, r = t, b = t, l = r] = v;
  return { across: l + r, down: t + b };
}

const SCALES = Object.values(SCENES).map(s => s.tile ?? 1);
const MAX_SCALE = Math.max(...SCALES);

const WIDTHS = [601, 768, 900, 1024, 1280, 1440, 1600, 1920, 2560, 3440];
const HEIGHTS = [400, 500, 600, 700, 768, 800, 900, 1080, 1440];

function uniformBase(w, h) {
  const gap = gapAt(w);
  let best = 0;
  for (let cols = 1; cols <= SCENE_COUNT; cols++) {
    const rows = Math.ceil(SCENE_COUNT / cols);
    const t = Math.min((w - (cols - 1) * gap - LIST_PAD) / cols,
                       (h - (2 * rows - 2) * gap - LIST_PAD) / rows, TILE_MAX);
    if (t >= TILE_FLOOR) best = Math.max(best, Math.floor(t));
  }
  return best;
}

let checked = 0, fits = 0, none = 0;
const failures = [];

if (declared.error) {
  failures.push(`could not read #scene-previews out of styles/main.css (${declared.error}) — this check has no second source without it`);
}
for (const w of WIDTHS) {
  if (!(gapAt(w) > 0)) failures.push(`${w}px: styles/main.css gives #scene-previews no gap this check can read`);
  const pad = padAt(w);
  if (pad.across !== LIST_PAD || pad.down !== LIST_PAD) {
    failures.push(`${w}px: tileLayout.js says LIST_PAD is ${LIST_PAD}px; styles/main.css gives #scene-previews ${pad.across}px of padding across and ${pad.down}px down`);
  }
}

for (const w of WIDTHS) {
  const gap = gapAt(w);
  for (const h of HEIGHTS) {
    checked++;
    const fit = tileLayout(SCENE_COUNT, w, h, gap);
    if (!fit) {
      if (uniformBase(w, h) > 0) {
        failures.push(`${w}x${h}: no varied layout fits, but a uniform grid gets ${uniformBase(w, h)}px — variation has cost a fit`);
      }
      none++;
      continue;
    }
    fits++;
    const hi = 1 + (MAX_SCALE - 1) * fit.v;
    const used = fit.rows * fit.base * hi + (2 * fit.rows - 2) * gap + LIST_PAD;
    if (used > h + 0.5) {
      failures.push(`${w}x${h}: chose ${fit.cols}x${fit.rows} at base ${fit.base}px, which occupies ${used.toFixed(1)}px of ${h}px measured with the stylesheet's own gap (${gap}px) and padding (${LIST_PAD}px)`);
    }
    const nudges = Object.values(SCENES).map(sp => fit.base * tileNudge(sp, fit));
    const span = Math.max(...nudges) - Math.min(...nudges);
    if (span > gap + 0.5) {
      failures.push(`${w}x${h}: stagger spans ${span.toFixed(1)}px, which is more than the ${gap}px row gap it is spent from`);
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
  for (const w of WIDTHS) for (const h of HEIGHTS) { const f = tileLayout(SCENE_COUNT, w, h, gapAt(w)); if (f) vs.push(f.v); }
  const full = vs.filter(v => v > 0.99).length;
  console.log(`         variation: full on ${full} of ${fits}, mean ${(vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(2)} — it is spent from slack, so tight viewports get less`);
}
{
  const drawnOf = (f) => f.base * (1 + (MAX_SCALE - 1) * f.v);
  const lost = [], shrunk = [];
  let held = 0;
  for (const w of WIDTHS) {
    for (const h of HEIGHTS) {
      const now = tileLayout(SCENE_COUNT, w, h, gapAt(w));
      if (!now) continue;
      const next = tileLayout(SCENE_COUNT + 1, w, h, gapAt(w));
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
  // The drift is a transform, so no fit is re-run when it moves a tile and
  // nothing downstream would notice a tile landing on its neighbour. What
  // holds it apart is arithmetic, so the arithmetic is what gets checked:
  // every scene's own displacement, against the clearance the gap allows.
  // Every gap the stylesheet declares is checked, the phone's included:
  // the fallback grid drifts too.
  const gaps = [...new Set((declared.decls ?? []).filter(d => d.prop === 'gap').map(d => px(d.value)))];
  const problems = [];
  const held = [];
  if (!gaps.length) problems.push('styles/main.css declares no gap for #scene-previews that this check can read');
  for (const gap of gaps) {
    const { amp, across, down } = driftClearance(gap);
    if (across <= 0) {
      problems.push(`two tiles in a row can drift ${(2 * amp).toFixed(1)}px at each other across a ${gap}px gap — they would touch`);
    }
    if (down <= 0) {
      problems.push(`two tiles in a column can close ${(gap + 2 * amp).toFixed(1)}px of their ${2 * gap}px gap once the registry's nudge is spent — they would touch`);
    }
    let worst = 0, worstKey = null;
    for (const key of Object.keys(SCENES)) {
      const a = tileDrift(key, gap);
      const b = tileDrift(key, gap);
      if (a.x !== b.x || a.y !== b.y) problems.push(`${key}'s drift is not the same twice — the seed is not the key`);
      const r = Math.hypot(a.x, a.y);
      if (r > amp + 1) problems.push(`${key} drifts ${r.toFixed(1)}px across a ${gap}px gap, past the ${amp.toFixed(1)}px it allows`);
      if (r > worst) { worst = r; worstKey = key; }
    }
    if (new Set(Object.keys(SCENES).map(k => JSON.stringify(tileDrift(k, gap)))).size < 2) {
      problems.push(`every scene drifts to the same place across a ${gap}px gap — the seed is not varying`);
    }
    held.push(`${gap}px gap: bounded at ${amp.toFixed(1)}px, furthest is ${worstKey} at ${worst.toFixed(1)}px, leaving ${across.toFixed(1)}px across and ${down.toFixed(1)}px down`);
  }
  if (problems.length) {
    console.error(`\ndrift: ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    failed++;
  } else {
    console.log(`ok: drift is seeded per scene and is ${DRIFT} of the gap in force — ${held.join('; ')}`);
  }
}

{
  // The tiles are generated from the registry, so matching them against it
  // answers itself. What is worth asking is whether the generator emits the ids
  // the rest of the site addresses, in the order the page lays them out:
  // main.js looks tiles up by `preview-<key>`, and a change to that template
  // would silently hand every tile another scene's size.
  const ids = [...previewTilesHtml().matchAll(/id="preview-([a-z0-9-]+)"/g)].map(m => m[1]);
  const keys = Object.keys(SCENES);
  const problems = [];
  if (ids.join(',') !== keys.join(',')) {
    problems.push(`the generated tiles are [${ids.join(', ')}] but the registry is [${keys.join(', ')}]`);
  }
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const id of dupes) problems.push(`#preview-${id} is generated more than once`);
  if (problems.length) {
    console.error(`\nthe generated tiles do not match the registry:`);
    for (const p of problems) console.error(`  ${p}`);
    failed++;
  } else {
    console.log(`ok: all ${ids.length} generated tiles carry their registry key as #preview-<key>, in registry order`);
  }
}

  return { ok: failed === 0, failures: failed, log };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log } = verifyLanding();
  log.forEach(line => console.log(line));
  if (!ok) process.exit(1);
}

