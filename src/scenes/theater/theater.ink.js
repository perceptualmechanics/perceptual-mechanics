// A cast colour as text on a given ground: the same hue, its OKLCH lightness
// moved only as far as WCAG's 4.5:1 needs. Pure, so node can measure it.

import { toLinear, luminance, contrast } from '../../utils/contrast.js';

export { luminance, contrast };
export const TEXT_CONTRAST = 4.5;

export function parseHex(hex) {
  const n = parseInt(hex.trim().slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255);
}

const toHex = rgb => '#' + rgb.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
const toGamma = v => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

// `fg` at `alpha` over `bg`, as the browser composites opacity: in sRGB.
export const over = (fg, bg, alpha) => fg.map((v, i) => alpha * v + (1 - alpha) * bg[i]);

// Björn Ottosson's OKLab, https://bottosson.github.io/posts/oklab/
function toOklch(rgb) {
  const [r, g, b] = rgb.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}

// Linear-light sRGB, unclamped: a channel outside 0..1 is out of gamut.
function fromOklch([L, C, h]) {
  const A = C * Math.cos(h), B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

const inGamut = lin => lin.every(v => v >= -1e-6 && v <= 1 + 1e-6);
const BISECT_STEPS = 24; // halves the interval to 6e-8 of a unit, far under one 8-bit step

// At lightness L, the most chroma up to C that sRGB can show (CSS Color 4's
// gamut mapping, without its tolerance), as an 8-bit colour.
function atLightness(L, C, h) {
  let lo = 0, hi = C;
  if (!inGamut(fromOklch([L, hi, h]))) {
    for (let i = 0; i < BISECT_STEPS; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(fromOklch([L, mid, h]))) lo = mid; else hi = mid;
    }
    hi = lo;
  }
  return parseHex(toHex(fromOklch([L, hi, h]).map(v => toGamma(Math.min(1, Math.max(0, v))))));
}

/**
 * `hex` as text on `ground` (0..1 sRGB): unchanged if it already reads at
 * 4.5:1, else darkened (on a light ground) or lightened (on a dark one) to
 * the nearest lightness that does, keeping its hue.
 */
export function inkOn(hex, ground) {
  const rgb = parseHex(hex);
  if (contrast(rgb, ground) >= TEXT_CONTRAST) return hex;
  const [L0, C, h] = toOklch(rgb);
  const darken = contrast([0, 0, 0], ground) >= contrast([1, 1, 1], ground);
  // `far` always reads (black or white at worst); `near` never does.
  let near = L0, far = darken ? 0 : 1;
  for (let i = 0; i < BISECT_STEPS; i++) {
    const mid = (near + far) / 2;
    if (contrast(atLightness(mid, C, h), ground) >= TEXT_CONTRAST) far = mid; else near = mid;
  }
  return toHex(atLightness(far, C, h));
}
