import { SCENES } from '../scenes/registry.js';

export const TILE_MAX = 272;
export const TILE_FLOOR = 152;
export const TILE_GAP = 24;      // #scene-previews' gap at >=769px
export const LIST_PAD = 32;      // its own padding, both axes (1rem each side)

const TILE_SCALES = Object.values(SCENES).map(s => s.tile ?? 1);
const TILE_NUDGES = Object.values(SCENES).map(s => s.nudge ?? 0);
export const MAX_TILE_SCALE = Math.max(...TILE_SCALES);
const MAX_SCALE = MAX_TILE_SCALE;
const MIN_SCALE = Math.min(...TILE_SCALES);
const NUDGE_SPAN = Math.max(...TILE_NUDGES) - Math.min(...TILE_NUDGES);

export function nudgeScale(base) {
  const span = base * NUDGE_SPAN;
  return span > TILE_GAP ? TILE_GAP / span : 1;
}

const V_STEPS = 16;

export function tileLayout(n, width, height) {
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const wBudget = width - (cols - 1) * TILE_GAP - LIST_PAD;
    const hBudget = height - (2 * rows - 2) * TILE_GAP - LIST_PAD;

    for (let step = V_STEPS; step >= 0; step--) {
      const v = step / V_STEPS;
      const hi = 1 + (MAX_SCALE - 1) * v;
      const lo = 1 - (1 - MIN_SCALE) * v;
      const base = Math.min(wBudget / cols / hi, hBudget / rows / hi, TILE_MAX / hi);
      if (base * lo < TILE_FLOOR) continue;
      const orphan = n % cols === 1 && rows > 1;
      const drawn = Math.floor(base) * hi;
      const cand = { cols, rows, base, orphan, v, drawn };
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
  return (spec?.nudge ?? 0) * (fit?.v ?? 0) * nudgeScale(fit?.base ?? 0);
}

export function tileLayoutHeight(fit) {
  if (!fit) return 0;
  const hi = 1 + (MAX_SCALE - 1) * fit.v;
  return fit.rows * fit.base * hi + (2 * fit.rows - 2) * TILE_GAP + LIST_PAD;
}

