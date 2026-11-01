// The map's geometry: two hemispheres in the equatorial stereographic
// projection, the one the period's double-hemisphere world maps used. It is
// conformal and carries circles on the globe to circles on the page, so the
// terminator and the twilights are drawn as exact circles. Pure; verify-
// euphonia-map holds it.
//
// Page coordinates are the unit disc, Y up: the hemisphere's centre at (0, 0),
// its rim at radius 1.
import { solarParams } from '../bench/bench.sky.js';

const RAD = Math.PI / 180;
const DAY_MINUTES = 1440;

// The hemispheres meet at 20°W and 160°E, so only the Pacific is cut.
const SPLIT = -20;
export const HEMISPHERES = [
  { name: 'Occidens', lon0: SPLIT - 90 },
  { name: 'Oriens', lon0: SPLIT + 90 },
];

// The rising or setting sun's upper limb on the horizon (bench.sky.js's
// ZENITH), then the civil, nautical and astronomical twilights.
export const DUSKS = [-0.833, -6, -12, -18];

// A point on the globe in the hemisphere's frame: x east, y north, z away
// from the viewer, so the hemisphere's centre is z = -1.
export function local(lon, lat, lon0) {
  const c = Math.cos(lat * RAD), dl = (lon - lon0) * RAD;
  return [c * Math.sin(dl), Math.sin(lat * RAD), -c * Math.cos(dl)];
}

// Projected from the far pole, z = 1.
export function project(lon, lat, lon0) {
  const [x, y, z] = local(lon, lat, lon0);
  return [x / (1 - z), y / (1 - z)];
}

// The point of the globe at (X, Y) on the disc, or null off the disc: the
// projection run backwards, P = (2X, 2Y, |X|² − 1) / (|X|² + 1) in the
// hemisphere's frame.
export function unproject(X, Y, lon0) {
  const q = X * X + Y * Y;
  if (q > 1) return null;
  const x = 2 * X / (q + 1), y = 2 * Y / (q + 1), z = (q - 1) / (q + 1);
  const lon = lon0 + Math.atan2(x, -z) / RAD;
  return { lat: Math.asin(Math.max(-1, Math.min(1, y))) / RAD, lon: ((lon + 540) % 360) - 180 };
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

// The sun overhead: its declination, and the meridian where true solar time
// is noon. ms is a UT instant.
export function subsolar(ms) {
  const { decl, eqTime, obliquity } = solarParams(ms);
  const minutes = ((ms / 60000) % DAY_MINUTES + DAY_MINUTES) % DAY_MINUTES;
  const lon = ((720 - minutes - eqTime) / 4 + 540) % 360 - 180;
  return { lat: decl, lon, obliquity };
}

// Where the sun is more than `dusk` degrees below the horizon: the small
// circle P·S < sin(dusk). Substituting the inverse projection into P·S = s
// gives (nz − s)|X|² + 2(nx X + ny Y) − (nz + s) = 0, a circle, or a line
// when nz = s. `inside` says which side is dark.
export function darkRegion(sun, dusk, lon0) {
  const [nx, ny, nz] = local(sun.lon, sun.lat, lon0), s = Math.sin(dusk * RAD);
  const a = nz - s;
  // A circle through the projection's far pole is a line on the page; within
  // 1e-9 the circle's radius would pass 10⁹ discs, which no page can show.
  if (Math.abs(a) < 1e-9) return { line: true, nx, ny, c: (nz + s) / 2 };
  const cx = -nx / a, cy = -ny / a;
  return { line: false, cx, cy, r: Math.sqrt(cx * cx + cy * cy + (nz + s) / a), inside: a > 0 };
}

// The cap of angular radius rho degrees around a point, as a circle on the
// page: the complement of darkRegion's P·C < cos(rho). Null when the cap holds
// the projection's far pole, where its outline would bound everything else.
export function capCircle(center, rho, lon0) {
  const g = darkRegion(center, 90 - rho, lon0);
  return g.line || g.inside ? null : { cx: g.cx, cy: g.cy, r: g.r };
}

// Sutherland–Hodgman against one meridian; keep is +1 for lon >= m, -1 for <=.
function clipSide(ring, m, keep) {
  const out = [], inside = p => keep * (p[0] - m) >= 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) out.push([m, a[1] + (b[1] - a[1]) * (m - a[0]) / (b[0] - a[0])]);
  }
  return out;
}

// A run along a cut meridian lies on the rim; filling it in by latitude keeps
// it on the rim's circle instead of cutting a chord across the disc. Two
// degrees a step keeps the chord's sag under a thousandth of the radius.
const RIM_STEP = 2;
function followRim(ring, lo, hi) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    out.push(a);
    if (a[0] === b[0] && (a[0] === lo || a[0] === hi)) {
      const n = Math.ceil(Math.abs(b[1] - a[1]) / RIM_STEP);
      for (let k = 1; k < n; k++) out.push([a[0], a[1] + (b[1] - a[1]) * k / n]);
    }
  }
  return out;
}

// The data's longitudes run −180…180, a hemisphere's may run past either end,
// so each ring is tried at its own longitude and one turn either side.
const TURNS = [-360, 0, 360];
const spans = (pts, lo, hi) => {
  let min = Infinity, max = -Infinity;
  for (const [x] of pts) { if (x < min) min = x; if (x > max) max = x; }
  return TURNS.filter(t => max + t >= lo && min + t <= hi);
};

export function ringsIn(rings, lon0) {
  const lo = lon0 - 90, hi = lon0 + 90, out = [];
  for (const ring of rings) for (const t of spans(ring, lo, hi)) {
    const clipped = clipSide(clipSide(ring.map(([x, y]) => [x + t, y]), lo, 1), hi, -1);
    if (clipped.length > 2) out.push(followRim(clipped, lo, hi));
  }
  return out;
}

export function linesIn(lines, lon0) {
  const lo = lon0 - 90, hi = lon0 + 90, out = [];
  for (const line of lines) for (const t of spans(line, lo, hi)) {
    let run = [];
    for (const [x, y] of line) {
      if (x + t >= lo && x + t <= hi) run.push([x + t, y]);
      else { if (run.length > 1) out.push(run); run = []; }
    }
    if (run.length > 1) out.push(run);
  }
  return out;
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

// Graticule lines as lon/lat polylines inside one hemisphere: meridians and
// parallels every `step` degrees, sampled every RIM_STEP.
export function graticule(lon0, step) {
  const n = 180 / RIM_STEP, lines = [];
  for (let lon = lon0 - 90; lon <= lon0 + 90; lon += step) {
    lines.push(Array.from({ length: n + 1 }, (_, k) => [lon, -90 + RIM_STEP * k]));
  }
  for (let lat = step - 90; lat < 90; lat += step) lines.push(parallel(lon0, lat));
  return lines;
}
export const parallel = (lon0, lat) =>
  Array.from({ length: 180 / RIM_STEP + 1 }, (_, k) => [lon0 - 90 + RIM_STEP * k, lat]);
