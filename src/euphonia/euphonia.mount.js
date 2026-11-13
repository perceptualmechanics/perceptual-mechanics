// The globe's mount, as a globe-maker's: the globe turns on its axis inside
// a brass meridian ring. Pure; verify-euphonia-map holds it.
//
// The stand's frame: X right on the page, Y up, Z toward the eye. The axis
// stands upright in the meridian ring, in the plane Z = 0, so north is always
// up. The reader's eye looks at the stand from `eye` degrees above its equator
// (below it when negative), and so sees that latitude at the globe's centre,
// as anyone sees a place on a globe by stooping or rising to face it.
// Lengths are in the globe's radius.
const RAD = Math.PI / 180;

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

// Where the eye stands when nothing chooses for it: a little above the
// equator, as a globe stands below the eye on a table. An authored view, as
// an engraver chose his.
export const EYE = 25;
// The meridian ring clears the globe by MERIDIAN_GAP and is MERIDIAN_WIDTH
// wide: drawn proportions, not a measured ring.
const MERIDIAN_GAP = 0.02, MERIDIAN_WIDTH = 0.05;
export const MERIDIAN = { inner: 1 + MERIDIAN_GAP, outer: 1 + MERIDIAN_GAP + MERIDIAN_WIDTH };

// The eye rises or sinks as far as the poles: past them north would turn
// down. The ring fills the same frame from every eye, so the globe keeps its
// size as the reader looks north or south.
export const EYE_MAX = 90;
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
// any eye: the meridian ring, seen face on from level, foreshortened only in
// height from any other.
export const EXTENT = { halfWidth: MERIDIAN.outer, top: MERIDIAN.outer, bottom: MERIDIAN.outer };

// Whether the meridian ring stands between the eye and the globe at (x, y)
// on the page, seen from `eye`: where its near half crosses the globe's face.
// Any point of the ring is beyond the globe's radius, so where it lies on the
// eye's side of the centre it is nearer than the sphere along its line of
// sight.
export function covers(x, y, eye) {
  const s = Math.sin(eye * RAD), c = Math.cos(eye * RAD);
  const ringY = y / c, r = Math.hypot(x, ringY);
  return r >= MERIDIAN.inner && r <= MERIDIAN.outer && ringY * s > 0;
}
