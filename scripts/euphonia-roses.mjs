// Finds where the map's wind roses go: the points of the open ocean farthest
// from any coast, its poles of inaccessibility, from the vendored Natural
// Earth land. Writes src/euphonia/euphonia.roses.json. A deliberate step,
// rerun when the world is:
//   node scripts/euphonia-roses.mjs
//
// A 1° grid finds the far places; each is then refined against the coast's
// own vertices, a tenth of a degree at a time. These are the poles of the
// land this map draws: the Pacific's falls at 48.4°S 139.3°W, not at Point
// Nemo (48.9°S 123.4°W), which is measured from islands of a few square
// kilometres, Ducie and Motu Nui among them, that the map's coasts leave out.
// verify-euphonia-map holds each rose to the map's own coasts.
import { readFileSync, writeFileSync } from 'node:fs';
import { onLand } from '../src/euphonia/euphonia.projection.js';

const WORLD = new URL('../src/euphonia/euphonia.world.json', import.meta.url);
const OUT = new URL('../src/euphonia/euphonia.roses.json', import.meta.url);
// How many roses, and how far apart at least: one to an ocean, not a cluster
// in the widest one.
const ROSES = 3, APART_DEG = 60;
const RAD = Math.PI / 180, EARTH_KM = 6371;

const world = JSON.parse(readFileSync(WORLD, 'utf8'));
const unit = (lat, lon) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];
const coast = world.land.flatMap(r => r).map(([lon, lat]) => unit(lat, lon));
// The angle to the nearest coast vertex, in degrees.
const reach = (lat, lon) => {
  const p = unit(lat, lon);
  let best = -1;
  for (const c of coast) { const d = p[0] * c[0] + p[1] * c[1] + p[2] * c[2]; if (d > best) best = d; }
  return Math.acos(Math.min(1, best)) / RAD;
};

// The coarse pass, on 1° cells at sea, nearest coast by vertex.
const cells = [];
for (let lat = -79.5; lat < 80; lat += 1) for (let lon = -179.5; lon < 180; lon += 1) {
  if (!onLand(world.land, lat, lon)) cells.push({ lat, lon });
}
for (const c of cells) c.reach = reach(c.lat, c.lon);
cells.sort((a, b) => b.reach - a.reach);
const apart = (a, b) => Math.acos(Math.min(1, unit(a.lat, a.lon).reduce((s, v, i) => s + v * unit(b.lat, b.lon)[i], 0))) / RAD;
const peaks = [];
for (const c of cells) {
  if (peaks.every(p => apart(p, c) >= APART_DEG)) peaks.push(c);
  if (peaks.length === ROSES) break;
}
// The fine pass: climb from each peak a tenth of a degree at a time.
const STEP = 0.1;
const roses = peaks.map(p => {
  let { lat, lon, reach: r } = p;
  for (let moved = true; moved;) {
    moved = false;
    for (const [dl, dn] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP], [STEP, STEP], [STEP, -STEP], [-STEP, STEP], [-STEP, -STEP]]) {
      const r2 = reach(lat + dl, lon + dn);
      if (r2 > r) { lat += dl; lon += dn; r = r2; moved = true; }
    }
  }
  return { lat: Number(lat.toFixed(2)), lon: Number(lon.toFixed(2)), nearest_coast_km: Math.round(r * RAD * EARTH_KM) };
});
writeFileSync(OUT, `${JSON.stringify({
  method: `Poles of inaccessibility of the land the map draws (Natural Earth's, in euphonia.world.json, without islands too small to show): the ${ROSES} sea points farthest from any coast vertex, at least ${APART_DEG}° apart, found on a 1° grid and refined by ${STEP}° steps.`,
  roses,
}, null, 1)}\n`);
console.log(JSON.stringify(roses));
