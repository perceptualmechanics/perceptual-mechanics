// The globe's mount, as a globe-maker's: the globe turns on its axis inside
// a brass meridian ring, and the ring stands in a wooden horizon. Pure;
// verify-euphonia-map holds it.
//
// The stand's frame: X along the horizon to its north point (right on the
// page), Y up, Z along the horizon to its east point, toward the eye. The
// axis stands upright in the meridian ring, in the plane Z = 0, so north is
// always up, and the horizon, in the plane Y = 0, lies at the equator. The
// reader's eye looks at the stand from `eye` degrees above the horizon
// (below it when negative), and so sees that latitude at the globe's centre,
// as anyone sees a place on a globe by stooping or rising to face it.
// Lengths are in the globe's radius.
import { solarParams } from '../bench/bench.sky.js';

const RAD = Math.PI / 180;
const DAY_MS = 86400000;

// The lamp the stand is seen by: the cartographers' light, from the upper
// left, 45° up (azimuth 315°), in the eye's frame (x right, y up, z toward
// the eye). The relief's hillshading is lit by it too: with north up, the
// map's east, north and up at the globe's centre are the eye's right, up and
// toward. ROOM is the light that reaches a surface turned from the lamp: an
// authored balance, as a painter sets a lamp against the room, enough that
// the globe's far side keeps its colours.
export const LIGHT_AZIMUTH = 315, LIGHT_ALTITUDE = 45, ROOM = 0.45;
export const LAMP = [Math.sin(LIGHT_AZIMUTH * RAD) * Math.cos(LIGHT_ALTITUDE * RAD), Math.cos(LIGHT_AZIMUTH * RAD) * Math.cos(LIGHT_ALTITUDE * RAD), Math.sin(LIGHT_ALTITUDE * RAD)];
// How much of the lamp a surface facing `n` takes: all of it facing the lamp,
// the room's share turned away.
export const lit = n => ROOM + (1 - ROOM) * Math.max(0, n[0] * LAMP[0] + n[1] * LAMP[1] + n[2] * LAMP[2]);

// Where the eye stands when nothing chooses for it: high enough to read the
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

// How far the eye may rise above the horizon or sink below it: as far as the
// horizon's far rim and edge stay within the meridian ring's height, which
// the ring reaches seen from level. Within that the stand fills the same
// frame from every eye, so the globe keeps its size as the reader looks north
// or south. outer·sin E + thickness·cos E = ring is R·sin(E + φ) = ring.
export const EYE_MAX = (Math.asin(MERIDIAN.outer / Math.hypot(HORIZON.outer, HORIZON.thickness)) - Math.atan2(HORIZON.thickness, HORIZON.outer)) / RAD;
export const clampEye = eye => Math.max(-EYE_MAX, Math.min(EYE_MAX, eye));

// A point of the stand on the page, seen from `eye`: x right, y up, and its
// depth toward the eye.
export function onPage([X, Y, Z], eye) {
  const s = Math.sin(eye * RAD), c = Math.cos(eye * RAD);
  return [X, Y * c - Z * s, Y * s + Z * c];
}

// The globe as the eye sees it: the meridian lon0 turned to face the eye, and
// the latitude the eye stands at in the middle, north up. The orthographic
// view of euphonia.projection.js.
export const viewOf = ({ lon0, eye }) => ({ lon0, lat0: eye });

// The page's extent of the globe in its mount, about the globe's centre, from
// any eye within EYE_MAX: the meridian ring's height above and below.
export const EXTENT = { halfWidth: HORIZON.outer, top: MERIDIAN.outer, bottom: MERIDIAN.outer };

// Whether the mount stands between the eye and the globe at (x, y) on the
// page, seen from `eye`. Any point of the stand is beyond the globe's radius,
// so where it lies on the eye's side of the centre it is nearer than the
// sphere along its line of sight; the stand hides the globe wherever one of
// its surfaces does that: the meridian ring, the horizon's two faces, and its
// outer and inner walls.
export function covers(x, y, eye) {
  const s = Math.sin(eye * RAD), c = Math.cos(eye * RAD), near = (Y, Z) => Y * s + Z * c > 0;
  const ringY = y / c, r = Math.hypot(x, ringY);
  if (r >= MERIDIAN.inner && r <= MERIDIAN.outer && near(ringY, 0)) return true;
  // The faces are seen edge-on from level, and hide nothing then.
  if (s) for (const Y of [0, -HORIZON.thickness]) {
    const Z = (Y * c - y) / s, h = Math.hypot(x, Z);
    if (h >= HORIZON.inner && h <= HORIZON.outer && near(Y, Z)) return true;
  }
  for (const R of [HORIZON.outer, HORIZON.inner]) {
    if (Math.abs(x) > R) continue;
    for (const Z of [Math.sqrt(R * R - x * x), -Math.sqrt(R * R - x * x)]) {
      const Y = (y + Z * s) / c;
      if (Y <= 0 && Y >= -HORIZON.thickness && near(Y, Z)) return true;
    }
  }
  return false;
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
