// WCAG 2's relative luminance and contrast ratio, for sRGB channels from 0
// to 1: one copy for the scenes, the pages and the gates that hold them.
// (WCAG 2.0 printed the linear threshold as 0.03928; no 8-bit value lies
// between that and sRGB's 0.04045, so the two agree on every colour here.)

export const toLinear = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

export const luminance = ([r, g, b]) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

// The ratio of two luminances, the lighter over the darker.
export const ratio = (la, lb) => (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);

export const contrast = (a, b) => ratio(luminance(a), luminance(b));
