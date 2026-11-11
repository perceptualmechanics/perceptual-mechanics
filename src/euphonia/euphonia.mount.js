// The globe's mount, as a globe-maker's: the globe turns on its axis inside
// a brass meridian ring, the ring stands in notches of a wooden horizon, and
// sliding it through the notches sets the globe for a latitude, the pole
// raised that far above the horizon. Pure; verify-euphonia-map holds it.
//
// The stand's frame: X along the horizon to its north point (right on the
// page), Y up, Z along the horizon to its east point, toward the eye. The eye
// looks down on the stand from EYE degrees above the horizon, so the
// meridian ring, in the plane Z = 0, is seen nearly face-on, and the horizon,
// in the plane Y = 0, as an ellipse. Lengths are in the globe's radius.
import { solarParams } from '../bench/bench.sky.js';

const RAD = Math.PI / 180;
const DAY_MS = 86400000;

// How far above the horizon the eye stands: high enough to read the
// horizon's scales, low enough that its near side crosses only a band of the
// globe. An authored view, as an engraver chose his.
export const EYE = 25;
// The meridian ring clears the globe by MERIDIAN_GAP and is MERIDIAN_WIDTH
// wide: drawn proportions, not a measured ring.
const MERIDIAN_GAP = 0.02, MERIDIAN_WIDTH = 0.05;
export const MERIDIAN = { inner: 1 + MERIDIAN_GAP, outer: 1 + MERIDIAN_GAP + MERIDIAN_WIDTH };
// The horizon in the proportions of Mercator's, at Lausanne: 42.2 cm across
// inside, 54.2 cm outside, 5.8 cm wide and 2.9 cm thick. Its opening is the
// meridian ring's, which stands in notches cut through it.
const HORIZON_INNER_CM = 42.2, HORIZON_OUTER_CM = 54.2, HORIZON_WIDTH_CM = 5.8, HORIZON_THICK_CM = 2.9;
const horizonInner = MERIDIAN.inner, horizonOuter = horizonInner * HORIZON_OUTER_CM / HORIZON_INNER_CM;
export const HORIZON = {
  inner: horizonInner,
  outer: horizonOuter,
  thickness: (horizonOuter - horizonInner) * HORIZON_THICK_CM / HORIZON_WIDTH_CM,
};

const sinE = Math.sin(EYE * RAD), cosE = Math.cos(EYE * RAD);

// A point of the stand on the page: x right, y up, and its depth toward the
// eye.
export const onPage = ([X, Y, Z]) => [X, Y * cosE - Z * sinE, Y * sinE + Z * cosE];

// The globe as the eye sees it, set for `setting` degrees of latitude and
// turned so the meridian lon0 faces the eye: its axis lies in the meridian
// ring's plane, `setting` degrees above the horizon's north point. Returned
// as the orthographic view of euphonia.projection.js (the centre lon0, lat0,
// north up) and the turn that carries north to the axis on the page, roll
// degrees clockwise.
export function viewOf({ lon0, setting }) {
  const s = Math.sin(setting * RAD), c = Math.cos(setting * RAD);
  return { lon0, lat0: Math.asin(s * sinE) / RAD, roll: Math.atan2(c, s * cosE) / RAD };
}

// The page's extent of the globe in its mount, about the globe's centre.
const top = Math.max(1, MERIDIAN.outer * cosE, HORIZON.outer * sinE);
const bottom = Math.max(1, MERIDIAN.outer * cosE, HORIZON.outer * sinE + HORIZON.thickness * cosE);
export const EXTENT = { halfWidth: HORIZON.outer, top, bottom };

// Whether the mount stands between the eye and the globe at (x, y) on the
// page: the meridian ring's upper half and the horizon's near half, its top
// face and its outer edge, lie in front of the sphere wherever they are (a
// point of either beyond the globe's radius, on the eye's side of the
// centre, is nearer than the sphere along its line of sight).
export function covers(x, y) {
  if (y > 0) {
    const r = Math.hypot(x, y / cosE);
    return r >= MERIDIAN.inner && r <= MERIDIAN.outer;
  }
  const h = Math.hypot(x, y / sinE);
  if (h >= HORIZON.inner && h <= HORIZON.outer) return true;
  if (Math.abs(x) > HORIZON.outer) return false;
  // The outer edge: below the top face's outer rim by up to its thickness.
  const rim = -Math.sqrt(HORIZON.outer ** 2 - x * x) * sinE;
  return y <= rim && y >= rim - HORIZON.thickness * cosE;
}

// The horizon's scales are laid out by compass azimuth, clockwise from the
// north point seen from above: north at +X, east at +Z. The zodiac begins
// at the east point and runs toward the south, a sign each 30°, and the
// calendar puts each day beside the sun's place in the zodiac at its noon,
// for the year shown: a maker's calendar, set for one year.
export const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricornus', 'Aquarius', 'Pisces'];
export const MONTHS = ['Ianuarius', 'Februarius', 'Martius', 'Aprilis', 'Maius', 'Iunius', 'Iulius', 'Augustus', 'September', 'October', 'November', 'December'];
export const EAST = 90;
export const azimuthOf = ms => (EAST + solarParams(ms).longitude) % 360;

// The year's days on the calendar: each day's azimuth at its noon (UT), and
// its month and day of the month, in the Gregorian calendar the page shows.
export function calendarOf(year) {
  const days = [];
  for (let t = Date.UTC(year, 0, 1, 12); new Date(t).getUTCFullYear() === year; t += DAY_MS) {
    const d = new Date(t);
    days.push({ azimuth: azimuthOf(t), month: d.getUTCMonth(), day: d.getUTCDate() });
  }
  return days;
}
