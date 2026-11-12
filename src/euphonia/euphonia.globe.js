// The globe as d3-geo draws it: the world's layers as GeoJSON on the sphere,
// and the orthographic projection for a view, clipped to the facing half and
// closed along the limb. Pure, so verify-euphonia-map holds it.
//
// A view is the point of the globe at its centre (lon0, lat0), north up,
// the globe's radius in canvas pixels (k) and its centre on the canvas
// (cx, cy).
import { geoOrthographic, geoArea, geoCircle, geoDistance, geoGraticule } from 'd3-geo';
import { orthoLocal, rhumb, coastOf } from './euphonia.projection.js';

const GRATICULE_STEP = 30;
// The wind roses, at the poles of inaccessibility euphonia.roses.json found:
// the 32 points of the compass as rhumb lines, as the period's charts drew
// them, reaching ROSE_REACH degrees, the cardinal and half-cardinal points
// apart from the rest.
const ROSE_POINTS = 32, ROSE_REACH = 30, ROSE_STEP = 1;

// A ring as a polygon on the sphere. d3 reads a ring's winding as which side
// is inside, so a ring wound the other way would cover the whole sphere but
// itself; none of the world's rings covers more than half of it, so any that
// measures more is turned round.
function polygon(ring) {
  const p = { type: 'Polygon', coordinates: [ring] };
  return geoArea(p) > 2 * Math.PI ? { type: 'Polygon', coordinates: [[...ring].reverse()] } : p;
}
const multi = rings => ({ type: 'MultiPolygon', coordinates: rings.map(r => polygon(r).coordinates) });

// Natural Earth cuts land at ±180° and closes each piece along the cut, and
// Antarctica along the pole, so the rings are polygons on the plane. On the
// sphere those seams aren't edges, and d3's clipping can't decide a point
// that falls on one. So the pieces are stitched back: each coast run that
// ends on the cut continues with the run that begins at the same latitude
// on the cut's other side (for Antarctica its own beginning, across the
// pole), and d3 crosses the antimeridian itself. A piece whose other half
// Natural Earth doesn't carry keeps its seam.
function stitched(rings) {
  const runsOf = ring => {
    const runs = coastOf(ring);
    // A run cut only by the ring's start continues into its first.
    if (runs.length > 1 && runs.at(-1).at(-1) === ring.at(-1) && runs[0][0] === ring[0]) runs[0] = [...runs.pop(), ...runs[0].slice(1)];
    return runs;
  };
  const cut = [], whole = [];
  for (const ring of rings) (ring.some(q => Math.abs(q[0]) === 180 || q[1] === -90) ? cut : whole).push(ring);
  const runs = cut.flatMap((ring, k) => runsOf(ring).map(run => ({ run, k })));
  const startingAt = new Map(runs.map(r => [`${r.run[0][0]},${r.run[0][1]}`, r]));
  const across = ([lon, lat]) => `${-lon},${lat}`;
  const kept = new Set(), out = [];
  for (const first of runs) {
    if (first.used) continue;
    const ring = [], pieces = [];
    let r = first;
    while (r && !r.used) { r.used = true; ring.push(...r.run); pieces.push(r.k); r = startingAt.get(across(r.run.at(-1))); }
    if (r === first) out.push([...ring, ring[0]]);
    else for (const k of pieces) kept.add(k);
  }
  return [...whole, ...out, ...cut.filter((_, k) => kept.has(k))];
}
const lines = list => ({ type: 'MultiLineString', coordinates: list });

// The world's layers, once: land, lakes and the dated older shores as fills;
// the coast (the land's rings without their seams), rivers and the
// graticule as lines; the roses' rhumb lines and their centres.
export function globeWorld(world, roses) {
  const roseLines = roses.flatMap(r => Array.from({ length: ROSE_POINTS }, (_, k) =>
    ({ main: k % (ROSE_POINTS / 8) === 0, line: rhumb(r.lat, r.lon, k * 360 / ROSE_POINTS, ROSE_REACH, ROSE_STEP) })));
  return {
    land: multi(stitched(world.land)),
    lakes: multi(stitched(world.lakes)),
    historic: multi(world.historic.flatMap(l => l.parts)),
    coast: lines(world.land.flatMap(coastOf)),
    rivers: lines(world.rivers),
    graticule: geoGraticule().step([GRATICULE_STEP, GRATICULE_STEP])(),
    roseMain: lines(roseLines.filter(l => l.main).map(l => l.line)),
    roseRest: lines(roseLines.filter(l => !l.main).map(l => l.line)),
    roseCentres: roses.map(r => ({ lon: r.lon, lat: r.lat })),
  };
}

// The view's projection: the centre turned to the globe's centre on the
// canvas, north up, the facing half drawn, everything beyond the limb
// clipped away. The clip
// circle sits LIMB_INSET inside the limb. At exactly 90° it's a great
// circle, and from a round view (the keys turn the globe in whole degrees)
// it runs through Natural Earth's rounded vertices, which floating point
// then puts on either side of it; d3 rejoins such a ring round the whole
// limb. Inset by more than d3's tolerance (1e-6 radians), the circle is a
// small one that no grid of round coordinates lies on, and the band it
// leaves undrawn is 1 − cos(LIMB_INSET), about 1.5e-12, of the radius.
const LIMB_INSET = 1e-4;
export function projectionFor(view) {
  return geoOrthographic()
    .rotate([-view.lon0, -view.lat0])
    .scale(view.k)
    .translate([view.cx, view.cy])
    .clipAngle(90 - LIMB_INSET);
}

// Whether the view faces a point of the globe.
export const faces = (view, { lon, lat }) => geoDistance([lon, lat], [view.lon0, view.lat0]) < Math.PI / 2;

// A small circle on the globe, its centre and angular radius rho, as a
// polygon d3 clips to the facing half.
export const capOf = ({ lon, lat }, rho) => geoCircle().center([lon, lat]).radius(rho)();

// The same circle on the page, exactly: a circle on the sphere lies in a
// plane, and orthographic projection carries it to an ellipse centred on its
// plane's centre (cos rho along the centre's direction), its long axis
// sin rho across that direction and its short axis sin rho · z along it,
// where z is how far the centre faces the viewer. Unit-disc units, Y up;
// null when the circle is wholly on the far side.
export function ellipseOf(p, rho, view) {
  const [x, y, z] = orthoLocal(p.lon, p.lat, view.lon0, view.lat0);
  const r = rho * Math.PI / 180;
  if (z < -Math.sin(r)) return null;
  return { cx: Math.cos(r) * x, cy: Math.cos(r) * y, along: Math.atan2(y, x), major: Math.sin(r), minor: Math.sin(r) * Math.abs(z) };
}
