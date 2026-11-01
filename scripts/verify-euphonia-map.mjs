// Holds the map of 1668 to its sources: the vendored Natural Earth geometry to
// its provenance, and the projection to the sphere it projects.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as projection from '../src/euphonia/euphonia.projection.js';
import * as lunar from '../src/euphonia/euphonia.moon.js';

const RAD = Math.PI / 180;
const DAY_MS = 86400000;

const vendored = name => () =>
  JSON.parse(readFileSync(new URL(`../src/euphonia/euphonia.${name}.json`, import.meta.url), 'utf8'));
export const worldData = vendored('world');
export const fixturesData = vendored('fixtures');

// The sun's place against JPL Horizons. NOAA calls its approximations "very
// good" only from 1800, so 1668 is held to an ephemeris instead. Measured
// worst: 0.0116° in longitude, 0.0017° in declination. 0.02° is a quarter of
// a pixel at the rim, where a 1440px-wide page spends 13 pixels a degree.
const SUN_TOLERANCE = 0.02;
// The phases against Espenak, who gives them to the minute. New and full
// agree within his rounding; quarters stray up to 0.94 min either way. A
// minute is a fifth of the map's 5-minute time step.
const PHASE_TOLERANCE_MIN = 1;
// At a quarter the Moon is 90° of longitude from the Sun, which leaves it
// lit 0.0013 over a half because the Sun is 389 lunar distances away, not
// infinitely far; (48.4)'s phase angle adds at most 0.0011 here. Half a
// hundredth holds both.
const LIT_TOLERANCE = 0.005;
const LIT_AT = { new: 0, 'first quarter': 0.5, full: 1, 'last quarter': 0.5 };

// Spherical area of a lon/lat ring in steradians (Chamberlain & Duquette,
// "Some algorithms for polygons on a sphere", JPL 2007), signed by winding.
function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [l1, p1] = ring[i], [l2, p2] = ring[(i + 1) % ring.length];
    sum += (l2 - l1) * RAD * (2 + Math.sin(p1 * RAD) + Math.sin(p2 * RAD));
  }
  return sum / 2;
}

// Unit vectors on the small circle P·S = sin(dusk), every 0.5°.
function duskCircle(sun, dusk) {
  const S = [Math.cos(sun.lat * RAD) * Math.cos(sun.lon * RAD), Math.cos(sun.lat * RAD) * Math.sin(sun.lon * RAD), Math.sin(sun.lat * RAD)];
  const u = Math.abs(S[2]) < 0.9 ? [-S[1], S[0], 0] : [0, -S[2], S[1]];
  const ul = Math.hypot(...u), U = u.map(v => v / ul);
  const V = [S[1] * U[2] - S[2] * U[1], S[2] * U[0] - S[0] * U[2], S[0] * U[1] - S[1] * U[0]];
  const s = Math.sin(dusk * RAD), c = Math.cos(dusk * RAD);
  return Array.from({ length: 720 }, (_, k) => {
    const t = k * Math.PI / 360;
    const P = [0, 1, 2].map(i => s * S[i] + c * (Math.cos(t) * U[i] + Math.sin(t) * V[i]));
    return [Math.atan2(P[1], P[0]) / RAD, Math.asin(P[2]) / RAD];
  });
}

export function verifyEuphoniaMap({ world = worldData(), fixtures = fixturesData(), geo = projection, moon = lunar } = {}) {
  const problems = [];
  const fail = m => problems.push(m);

  // The geometry, and where it came from.
  const prov = world.provenance ?? {};
  if (!/Natural Earth/.test(prov.source ?? '')) fail('euphonia.world.json: its provenance doesn\'t name Natural Earth');
  if (!prov.files?.length) fail('euphonia.world.json: its provenance lists no files');
  for (const f of prov.files ?? []) {
    if (!/^[0-9a-f]{64}$/.test(f.sha256 ?? '')) fail(`euphonia.world.json: ${f.layer} has no SHA-256`);
    if (!/^\d+\.\d+\.\d+$/.test(f.version ?? '')) fail(`euphonia.world.json: ${f.layer} has no Natural Earth version`);
  }
  const historic = new Map((world.historic ?? []).map(h => [h.name, h]));
  for (const [modern, old] of Object.entries(prov.replaced ?? {})) {
    if (!historic.has(old)) fail(`euphonia.world.json: the modern ${modern} is left out, but there's no historic ${old} in its place`);
  }
  for (const h of world.historic ?? []) if (!h.date) fail(`euphonia.world.json: the historic ${h.name} has no date, and the map has to say which year its outline is`);
  let points = 0;
  for (const layer of ['land', 'lakes', 'rivers']) {
    if (!world[layer]?.length) fail(`euphonia.world.json: no ${layer}`);
    for (const line of world[layer] ?? []) for (const [x, y] of line) {
      points++;
      if (!(x >= -180 && x <= 180 && y >= -90 && y <= 90)) { fail(`euphonia.world.json: ${layer} has a point at ${x}, ${y}`); break; }
    }
  }

  // The sun overhead, against Horizons: the subsolar longitude is the Sun's
  // apparent right ascension less Greenwich's apparent sidereal time.
  const sunRows = fixtures.sun?.rows ?? [];
  if (!/Horizons/.test(fixtures.sun?.source ?? '') || sunRows.length < 100) fail('euphonia.fixtures.json: no year of Horizons positions for the sun');
  let sunWorst = 0;
  for (const [utc, ra, dec, sidereal] of sunRows) {
    const s = geo.subsolar(Date.parse(utc));
    const dLon = Math.abs((s.lon - (ra - 15 * sidereal) + 900) % 360 - 180);
    const off = Math.max(dLon, Math.abs(s.lat - dec));
    if (!(off <= SUN_TOLERANCE)) { fail(`the sun at ${utc} stands ${off.toFixed(4)}° from where Horizons puts it`); break; }
    sunWorst = Math.max(sunWorst, off);
  }

  // The moon's phases, against Espenak's catalogue: the same phases in the
  // same order, each within a minute; the face lit as each phase means it;
  // waxing from new to full, waning from full to new.
  const phaseRows = fixtures.moon?.rows ?? [];
  if (!/Espenak/.test(fixtures.moon?.source ?? '') || !fixtures.moon?.acknowledgment || phaseRows.length < 48) fail('euphonia.fixtures.json: no year of Espenak\'s phases, or no acknowledgment to show with them');
  const computed = phaseRows.length ? moon.phases(Date.parse(phaseRows[0][0]) - 60 * 60000, Date.parse(phaseRows.at(-1)[0]) + 60 * 60000) : [];
  if (computed.length !== phaseRows.length) fail(`the moon has ${computed.length} phases where Espenak has ${phaseRows.length}`);
  let phaseWorst = 0, litWorst = 0;
  for (const [i, [utc, phase]] of phaseRows.entries()) {
    const c = computed[i];
    if (!c) break;
    const off = Math.abs(c.ms - Date.parse(utc)) / 60000;
    if (c.phase !== phase || !(off <= PHASE_TOLERANCE_MIN)) { fail(`Espenak's ${phase} at ${utc}: the map has a ${c.phase} ${off.toFixed(2)} min away`); break; }
    phaseWorst = Math.max(phaseWorst, off);
    const at = moon.moonAt(c.ms);
    const litOff = Math.abs(at.lit - LIT_AT[phase]);
    if (!(litOff <= LIT_TOLERANCE)) { fail(`at the ${phase} of ${utc} the moon is ${at.lit.toFixed(4)} lit`); break; }
    litWorst = Math.max(litWorst, litOff);
    const after = moon.moonAt(c.ms + 60000);
    if (phase === 'new' && !(after.waxing && after.age < 0.01)) { fail(`a minute after the new moon of ${utc} the moon is ${after.waxing ? '' : 'not '}waxing, ${after.age.toFixed(2)} days old`); break; }
    if (phase === 'full' && after.waxing) { fail(`a minute after the full moon of ${utc} the moon is still waxing`); break; }
  }

  // The projection: the centre at the middle, the hemisphere's edge on the rim.
  for (const h of geo.HEMISPHERES) {
    const [cx, cy] = geo.project(h.lon0, 0, h.lon0);
    if (Math.hypot(cx, cy) > 1e-12) fail(`${h.name}: its centre projects to ${cx}, ${cy}`);
    const [px, py] = geo.project(h.lon0, 90, h.lon0);
    if (Math.abs(px) > 1e-12 || Math.abs(py - 1) > 1e-12) fail(`${h.name}: the north pole projects to ${px}, ${py}`);
    for (let lat = -88; lat <= 88; lat += 4) for (const side of [-90, 90]) {
      const r = Math.hypot(...geo.project(h.lon0 + side, lat, h.lon0));
      if (Math.abs(r - 1) > 1e-9) { fail(`${h.name}: the edge meridian at ${lat}° lands at radius ${r}`); break; }
    }
  }
  if (Math.abs(geo.HEMISPHERES[1].lon0 - geo.HEMISPHERES[0].lon0) !== 180) fail('the two hemispheres don\'t cover the globe between them');

  // Clipping: the land the two hemispheres show is all the land, once.
  const area = rings => rings.reduce((a, r) => a + ringArea(r), 0);
  const whole = area(world.land ?? []);
  const shown = geo.HEMISPHERES.reduce((a, h) => a + area(geo.ringsIn(world.land ?? [], h.lon0)), 0);
  // Clipping interpolates each cut edge's latitude linearly, which the area
  // formula integrates as sin(φ); the difference is far under this.
  if (!(Math.abs(shown - whole) <= 1e-4 * Math.abs(whole)) || !(whole > 0)) fail(`the hemispheres show ${shown.toFixed(5)} sr of land against the data's ${whole.toFixed(5)}`);

  // The dark side: the analytic circle is the projected dusk circle, sampled
  // independently, and the antisolar point lies on its dark side. Every
  // week of the year from Samhain 1668, at a time of day that walks round.
  let circles = 0;
  for (let k = 0; k < 53; k++) {
    const t = Date.UTC(1668, 10, 1) + k * 7 * DAY_MS + k * 97 * 60000;
    const sun = geo.subsolar(t);
    const anti = { lon: sun.lon > 0 ? sun.lon - 180 : sun.lon + 180, lat: -sun.lat };
    for (const h of geo.HEMISPHERES) for (const dusk of geo.DUSKS) {
      const region = geo.darkRegion(sun, dusk, h.lon0);
      circles++;
      for (const [lon, lat] of duskCircle(sun, dusk)) {
        if (geo.local(lon, lat, h.lon0)[2] > 0) continue;
        const [X, Y] = geo.project(lon, lat, h.lon0);
        const off = region.line ? Math.abs(region.nx * X + region.ny * Y - region.c) : Math.abs(Math.hypot(X - region.cx, Y - region.cy) - region.r);
        if (off > 1e-9) { fail(`${h.name}, ${new Date(t).toISOString()}, dusk ${dusk}°: a point on the dusk circle sits ${off} off the drawn one`); break; }
      }
      if (geo.local(anti.lon, anti.lat, h.lon0)[2] <= 0 && !region.line) {
        const [X, Y] = geo.project(anti.lon, anti.lat, h.lon0);
        if ((Math.hypot(X - region.cx, Y - region.cy) < region.r) !== region.inside) fail(`${h.name}, ${new Date(t).toISOString()}: the point opposite the sun is drawn in daylight`);
      }
    }
  }

  const log = problems.length
    ? [`\neuphonia map: ${problems.length} problem(s):`, ...problems.map(p => `  ${p}`)]
    : [`ok: ${points} Natural Earth points under their provenance; the sun within ${sunWorst.toFixed(4)}° of Horizons at ${sunRows.length} instants; ${computed.length} moon phases within ${phaseWorst.toFixed(2)} min of Espenak, lit within ${litWorst.toFixed(4)}; the hemispheres show all ${(whole / (4 * Math.PI) * 100).toFixed(1)}% of the globe that is land, once; ${circles} dusk circles drawn where the sky darkens`];
  return { ok: problems.length === 0, failures: problems.length, log };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log } = verifyEuphoniaMap();
  log.forEach(l => console.log(l));
  process.exit(ok ? 0 : 1);
}
