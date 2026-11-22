import { SCENES } from '../scenes/registry.js';
import { mulberry32, hashSeed } from './prng.js';

export const TILE_MAX = 272;
export const TILE_FLOOR = 152;
export const LIST_PAD = 32;      // its own padding, both axes (1rem each side)

const TILE_SCALES = Object.values(SCENES).map(s => s.tile ?? 1);
const TILE_NUDGES = Object.values(SCENES).map(s => s.nudge ?? 0);
export const MAX_TILE_SCALE = Math.max(...TILE_SCALES);
const MAX_SCALE = MAX_TILE_SCALE;
const MIN_SCALE = Math.min(...TILE_SCALES);
const NUDGE_SPAN = Math.max(...TILE_NUDGES) - Math.min(...TILE_NUDGES);

export function nudgeScale(base, gap) {
  const span = base * NUDGE_SPAN;
  return span > gap ? gap / span : 1;
}

const V_STEPS = 16;

// `gap` is #scene-previews' gap at the width being laid out. The stylesheet
// owns it and changes it at a breakpoint, so main.js reads it from the
// computed style rather than this module keeping a copy that is right at
// only some widths.
export function tileLayout(n, width, height, gap) {
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const wBudget = width - (cols - 1) * gap - LIST_PAD;
    const hBudget = height - (2 * rows - 2) * gap - LIST_PAD;

    for (let step = V_STEPS; step >= 0; step--) {
      const v = step / V_STEPS;
      const hi = 1 + (MAX_SCALE - 1) * v;
      const lo = 1 - (1 - MIN_SCALE) * v;
      const base = Math.min(wBudget / cols / hi, hBudget / rows / hi, TILE_MAX / hi);
      if (base * lo < TILE_FLOOR) continue;
      const orphan = n % cols === 1 && rows > 1;
      const drawn = Math.floor(base) * hi;
      const cand = { cols, rows, base, orphan, v, drawn, gap };
      if (!best) { best = cand; break; }
      const better =
        drawn > best.drawn + 0.5 ? true :
        drawn < best.drawn - 0.5 ? false :
        best.orphan !== orphan ? !orphan :
        rows !== best.rows ? rows < best.rows :
        v > best.v;
      if (better) best = cand;
      break;
    }
  }
  return best && { ...best, base: Math.floor(best.base) };   // null when nothing fits legibly
}

export function tileScale(spec, fit) {
  return 1 + ((spec?.tile ?? 1) - 1) * (fit?.v ?? 0);
}
export function tileNudge(spec, fit) {
  return (spec?.nudge ?? 0) * (fit?.v ?? 0) * nudgeScale(fit?.base ?? 0, fit?.gap ?? 0);
}

// Each tile sits a little off its slot. The seed is the scene's key, so the
// arrangement is the same on every load and on every machine — a loose hand,
// not motion, and nothing a reader has to chase.
//
// DRIFT is a fraction of the gap, and the bound is what keeps it safe to apply
// without re-running the fit: two neighbours drifting at each other close at
// most 2 * DRIFT * gap of the gap between them, and vertically they also carry
// the registry's nudge, whose span nudgeScale already holds to one gap. The
// fitted rows are two gaps apart, so both axes keep clearance; the fallback
// grid's rows are one gap apart but carry no nudge, so they keep the across
// figure. The gap is whichever is in force, since that is what the tiles
// drift into. verify-landing checks the arithmetic rather than trusting this
// paragraph.
export const DRIFT = 0.28;

export function driftClearance(gap) {
  const amp = DRIFT * gap;
  return { amp, across: gap - 2 * amp, down: 2 * gap - (gap + 2 * amp) };
}

export function tileDrift(key, gap) {
  const rng = mulberry32(hashSeed(`pm-landing-drift:${key}`));
  const angle = rng() * Math.PI * 2;
  const radius = Math.sqrt(rng()) * DRIFT * gap;   // sqrt, so the disc fills evenly
  return { x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius) };
}
