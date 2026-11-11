// The map's geometry: one globe, seen as a period globe is, in orthographic
// projection, turned to centre on any point (lon0, lat0) with north kept up.
// Pure; verify-euphonia-map holds it, the formulas below against d3-geo's
// own orthographic, which draws the globe (euphonia.globe.js). The relief's
// shader runs orthoUnproject per pixel, so it's written out here too.
//
// Page coordinates are the unit disc, Y up: the globe's centre at (0, 0), its
// limb at radius 1.
import { solarParams } from '../bench/bench.sky.js';

const RAD = Math.PI / 180;
const DAY_MINUTES = 1440;

// A point of the globe in the view's frame: x east, y north, z toward the
// viewer, so the facing half is z > 0.
export function orthoLocal(lon, lat, lon0, lat0) {
  const c = Math.cos(lat * RAD), s = Math.sin(lat * RAD), dl = (lon - lon0) * RAD;
  const c0 = Math.cos(lat0 * RAD), s0 = Math.sin(lat0 * RAD);
  return [c * Math.sin(dl), c0 * s - s0 * c * Math.cos(dl), s0 * s + c0 * c * Math.cos(dl)];
}

// The point on the disc, or null on the far side.
export function orthoProject(lon, lat, lon0, lat0) {
  const [x, y, z] = orthoLocal(lon, lat, lon0, lat0);
  return z >= 0 ? [x, y] : null;
}

// The point of the globe at (X, Y) on the disc, or null off it: the facing
// point is (X, Y, √(1 − X² − Y²)), turned back from the view's frame.
export function orthoUnproject(X, Y, lon0, lat0) {
  const q = X * X + Y * Y;
  if (q > 1) return null;
  const Z = Math.sqrt(1 - q), c0 = Math.cos(lat0 * RAD), s0 = Math.sin(lat0 * RAD);
  const lat = Math.asin(Math.max(-1, Math.min(1, Y * c0 + Z * s0))) / RAD;
  const lon = lon0 + Math.atan2(X, Z * c0 - Y * s0) / RAD;
  return { lat, lon: ((lon + 540) % 360) - 180 };
}

// Whether a point of the globe is on land, by Natural Earth's rings: an even
// number of edges crossed on the way north is outside. The rings are cut at
// ±180° and Antarctica's runs along the pole, so lon/lat is a plane for them.
export function onLand(land, lat, lon) {
  let inside = false;
  for (const ring of land) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((xi > lon) !== (xj > lon) && lat < yi + (yj - yi) * (lon - xi) / (xj - xi)) inside = !inside;
    }
  }
  return inside;
}

// A rhumb line: the course that keeps one compass bearing, as a sailor held
// it, from a point, every `step` degrees of its length. Its longitude follows
// from the Mercator latitude ψ = ln tan(45° + φ/2): Δλ = Δψ·tan(bearing),
// or along a parallel, distance over cos φ. It stops short of the poles,
// which it would circle for ever.
const RHUMB_LIMIT = 85;
const mercator = lat => Math.log(Math.tan(Math.PI / 4 + lat * RAD / 2));
export function rhumb(lat0, lon0, bearing, length, step) {
  const b = bearing * RAD, points = [];
  for (let s = 0; s <= length + 1e-9; s += step) {
    const lat = lat0 + s * Math.cos(b);
    if (Math.abs(lat) > RHUMB_LIMIT) break;
    const dpsi = mercator(lat) - mercator(lat0);
    const q = Math.abs(lat - lat0) > 1e-9 ? (lat - lat0) * RAD / dpsi : Math.cos(lat0 * RAD);
    points.push([lon0 + s * Math.sin(b) / q, lat]);
  }
  return points;
}

// The sun overhead: its declination, and the meridian where true solar time
// is noon. ms is a UT instant.
export function subsolar(ms) {
  const { decl, eqTime, obliquity } = solarParams(ms);
  const minutes = ((ms / 60000) % DAY_MINUTES + DAY_MINUTES) % DAY_MINUTES;
  const lon = ((720 - minutes - eqTime) / 4 + 540) % 360 - 180;
  return { lat: decl, lon, obliquity };
}

// Natural Earth closes rings that cross the antimeridian along ±180° and
// Antarctica's along the pole. Those edges bound the fill but aren't coast.
const seam = (a, b) => (Math.abs(a[0]) === 180 && a[0] === b[0]) || (a[1] === -90 && b[1] === -90);
export function coastOf(ring) {
  const runs = [];
  let run = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    if (seam(ring[i - 1], ring[i])) { if (run.length > 1) runs.push(run); run = []; }
    run.push(ring[i]);
  }
  if (run.length > 1) runs.push(run);
  return runs;
}
