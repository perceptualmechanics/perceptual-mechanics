// Holds the globe of 1668 to its sources: the vendored Natural Earth geometry
// to its provenance, and the projection to the sphere it projects.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { geoArea, geoPath } from 'd3-geo';
import * as projection from '../src/euphonia/euphonia.projection.js';
import { globeWorld, projectionFor, ellipseOf } from '../src/euphonia/euphonia.globe.js';
import * as lunar from '../src/euphonia/euphonia.moon.js';
import * as calendar from '../src/euphonia/euphonia.calendars.js';
import * as hidden from '../src/euphonia/euphonia.tide.js';
import { resolvePlaces, regionShape, apart, lookup } from '../src/euphonia/euphonia.places.js';
import { solarEvents } from '../src/bench/bench.sky.js';
import * as mounting from '../src/euphonia/euphonia.mount.js';
import { nearestVertex, parallelStep } from './euphonia-borders.mjs';
import { wheelNames } from '../src/euphonia/euphonia.draw.js';
import { wheelOf } from '../src/euphonia/euphonia.wheel.js';
import { REALM_REACH_REM } from '../src/euphonia/euphonia.ambient.js';

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const EARTH_KM = 6371;

const vendored = name => () =>
  JSON.parse(readFileSync(new URL(`../src/euphonia/euphonia.${name}.json`, import.meta.url), 'utf8'));
export const worldData = vendored('world');
export const fixturesData = vendored('fixtures');
export const calendarsData = vendored('calendars');
export const reliefData = () => ({ ...vendored('relief')(), bytes: new Int8Array(readFileSync(new URL('../src/euphonia/euphonia.relief.bin', import.meta.url)).buffer.slice(0)) });
export const rosesData = vendored('roses');
export const bordersData = vendored('borders');
export const gazetteerData = vendored('gazetteer');
// The seats, the regions' places and the people's, looked up in the gazetteer.
export const placesData = () =>
  resolvePlaces({ gazetteer: gazetteerData(), regions: vendored('regions')().data, calendars: calendarsData(), people: vendored('people')().data });

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
// The book's own floor: the setting chat's note asks four to eight places a
// region, enough to show its reach.
const MIN_PLACES = 4;

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

// Views of the globe the projection is held at: centres from pole to pole,
// round the world, on round degrees, where the keys turn it and where the
// data's rounded coordinates line up with the limb.
const VIEWS = [];
for (let lat0 = -90; lat0 <= 90; lat0 += 15) for (let lon0 = -180; lon0 < 180; lon0 += 15) VIEWS.push({ lon0, lat0 });

export function verifyEuphoniaMap({ mount = mounting, world = worldData(), fixtures = fixturesData(), calendars = calendarsData(), gazetteer = gazetteerData(), regions = vendored('regions')().data, people = vendored('people')().data, relief = reliefData(), roses = rosesData(), borders = bordersData(), geo = projection, moon = lunar, cal = calendar, tide = hidden } = {}) {
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

  // The places: every calendar's seat, every region's place and every
  // person's the book places, found in the gazetteer exactly once; each
  // region naming enough places to show where it reaches; and each placed
  // person named once, since a name on the page finds its person by name.
  if (!/Natural Earth/.test(gazetteer.provenance?.source ?? '') || !/^[0-9a-f]{64}$/.test(gazetteer.provenance?.sha256 ?? '')) fail('euphonia.gazetteer.json: no Natural Earth provenance');
  const resolved = resolvePlaces({ gazetteer, regions, calendars, people });
  for (const e of resolved.errors) fail(`a place the map can't find: ${e}`);
  for (const p of resolved.people) if (resolved.people.filter(q => q.name === p.name).length > 1) { fail(`${p.name} is placed in two places`); break; }
  for (const r of regions) if (!(r.places?.length >= MIN_PLACES)) fail(`${r.name} names ${r.places?.length ?? 0} places; the map needs ${MIN_PLACES} to show where a region reaches`);
  // Each place's glow reaches halfway to the region's nearest place
  // somewhere else (euphonia.map.js); a region with every place at one site,
  // or a glow that comes out zero or not a number, draws nothing or throws.
  for (const r of resolved.regions) {
    const shape = regionShape(r);
    for (const g of shape.glows) {
      if (!(Number.isFinite(g.rho) && g.rho > 0)) fail(`${r.name}: ${g.name}'s glow reaches ${g.rho}°, not a distance the map can draw`);
      // The ellipse the globe draws it in, from views that face it and
      // views that see it at the limb.
      for (const v of VIEWS) {
        const e = ellipseOf(g, g.rho, v);
        if (e && ![e.cx, e.cy, e.along, e.major, e.minor].every(Number.isFinite)) { fail(`${r.name}: ${g.name}'s glow draws as ${JSON.stringify(e)} from ${v.lat0}°, ${v.lon0}°`); break; }
      }
    }
    if (!(Number.isFinite(shape.centre.lat) && Number.isFinite(shape.centre.lon))) fail(`${r.name}: its name has no place to stand (its places' mean is ${JSON.stringify(shape.centre)})`);
  }
  const seats = { seats: resolved.seats };
  const regionPlaces = resolved.regions.reduce((n, r) => n + r.places.length, 0);

  // The calendars. Each polity's has a source that says so, and a seat
  // the gazetteer places.
  let placed = true;
  for (const p of calendars.polities ?? []) {
    const c = calendars.calendars?.[p.calendar];
    if (!c) { placed = false; fail(`${p.name} keeps a calendar the data doesn't define: ${p.calendar}`); }
    if (!calendars.sources?.[p.source]?.url || !p.says) fail(`${p.name}'s calendar cites no source, or doesn't say what the source says`);
    if (seats.seats[p.seat?.[0]]?.error) placed = false;
  }
  for (const [id, c] of Object.entries(calendars.calendars ?? {})) if (!calendars.sources?.[c.source]?.url) fail(`the ${id} calendar cites no source`);

  // The arithmetic, against Fourmilab's converter: the same day number, and
  // the same Julian and Hijri dates, for each Gregorian date it was asked.
  const conversions = fixtures.calendars?.rows ?? [];
  if (!/fourmilab/.test(fixtures.calendars?.url ?? '') || conversions.length < 24) fail('euphonia.fixtures.json: no year of Fourmilab conversions');
  const same = (a, { y, m, d }) => a.join() === [y, m, d].join();
  for (const [greg, jdMidnight, jul, hij] of conversions) {
    const jdn = cal.jdnFromGregorian(...greg);
    if (jdn !== jdMidnight + 0.5 || !same(greg, cal.gregorianFromJdn(jdn)) || !same(jul, cal.julianFromJdn(jdn)) || cal.jdnFromJulian(...jul) !== jdn || !same(hij, cal.hijriFromJdn(jdn))) {
      fail(`Fourmilab dates ${greg.join('-')} (Gregorian) as JD ${jdMidnight}, ${jul.join('-')} (Julian), ${hij.join('-')} (Hijri); the map doesn't`);
      break;
    }
  }
  // Every day of the year: the Julian ten days behind, each calendar round-
  // tripping, and the Hijri date as ICU's islamic-civil gives it.
  const icu = new Intl.DateTimeFormat('en-u-ca-islamic-civil-nu-latn', { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' });
  if (icu.resolvedOptions().calendar !== 'islamic-civil') fail(`this Node's ICU has no islamic-civil calendar (it gave ${icu.resolvedOptions().calendar}), so nothing checks the Hijri dates day by day`);
  // 1079–1080 AH are years 29 and 30 of their cycle, where every tabular
  // scheme agrees; 1065–1066 AH (1654–56) are years 15 and 16, where the
  // scheme the page names, leap in 16 and not 15, shows itself.
  const SCHEME_YEARS = [cal.jdnFromGregorian(1654, 10, 1), cal.jdnFromGregorian(1656, 9, 1)];
  const days = [];
  for (let jdn = cal.jdnFromGregorian(1668, 11, 1); jdn <= cal.jdnFromGregorian(1669, 11, 1); jdn++) days.push(jdn);
  for (let jdn = SCHEME_YEARS[0]; jdn <= SCHEME_YEARS[1]; jdn++) days.push(jdn);
  let calendarDays = 0;
  for (const jdn of days) {
    const g = cal.gregorianFromJdn(jdn), j = cal.julianFromJdn(jdn), h = cal.hijriFromJdn(jdn);
    const parts = Object.fromEntries(icu.formatToParts(new Date((jdn - 2440587.5) * DAY_MS)).map(p => [p.type, Number(p.value)]));
    const problem = cal.jdnFromGregorian(g.y, g.m, g.d) !== jdn ? 'the Gregorian date doesn\'t come back to its day'
      : cal.jdnFromJulian(j.y, j.m, j.d) !== jdn ? 'the Julian date doesn\'t come back to its day'
      : cal.jdnFromJulian(g.y, g.m, g.d) !== jdn + 10 ? 'the Julian date isn\'t ten days behind'
      : !same([parts.year, parts.month, parts.day], h) ? `ICU dates it ${parts.year}-${parts.month}-${parts.day} (Hijri), the map ${h.y}-${h.m}-${h.d}` : null;
    if (problem) { fail(`${g.y}-${g.m}-${g.d}: ${problem}`); break; }
    calendarDays++;
  }
  // The brief's equivalence, the years from Creation turning on 1 September,
  // England's year on Lady Day, and the Hijri day beginning at sunset.
  if (cal.jdnFromJulian(1668, 11, 1) !== cal.jdnFromGregorian(1668, 11, 11)) fail('1 November 1668 (Julian) isn\'t 11 November (Gregorian)');
  if (cal.annoMundi({ y: 1669, m: 8 }) !== 7177 || cal.annoMundi({ y: 1669, m: 9 }) !== 7178) fail('the years from Creation don\'t turn on 1 September');
  const datedIn = (ms, name) => cal.datesAt(ms, calendars, seats.seats).find(r => r.polities.includes(name))?.date;
  // These date each polity by its calendar at its seat, so they wait until
  // every polity has both.
  const london = placed && calendars.polities?.find(p => p.year_starts);
  if (london) {
    const at = (y, m, d) => Date.UTC(y, m - 1, d, 12) + 10 * DAY_MS;
    if (!/24 March 1668\/9$/.test(datedIn(at(1669, 3, 24), london.name) ?? '') || !/25 March 1669$/.test(datedIn(at(1669, 3, 25), london.name) ?? '')) fail(`${london.name}'s year doesn't turn on 25 March`);
  }
  const ottoman = placed && calendars.polities?.find(p => p.calendar === 'hijri-tabular');
  if (ottoman) {
    const { lat, lon } = seats.seats[ottoman.seat[0]];
    const set = solarEvents(Date.UTC(1669, 2, 1), Date.UTC(1669, 2, 2), lat, lon).find(e => e.kind === 'set').t;
    const before = datedIn(set - 60000, ottoman.name), after = datedIn(set + 60000, ottoman.name);
    if (!before || before === after || parseInt(after) !== parseInt(before) + 1) fail(`at ${ottoman.seat[0]} the Hijri day doesn't turn at sunset (${before} → ${after})`);
  }

  // The Tide, as the map reads the rule. Its inputs are the checks above;
  // these hold the reading: the flood from each first quarter, the ebb from
  // each last; each polity's eves at its own sunset on its own 31 October and
  // 30 April, the autumn open night opening the dark half and the spring
  // open night closing it at sunrise, the two trading dates south of the
  // equator; each seat's half by its hemisphere, the tropics' included; and
  // no half where the calendar has no 31 October.
  let eves = 0;
  for (const [utc, phase] of placed ? phaseRows : []) {
    if (!phase.endsWith('quarter')) continue;
    const c = computed.find(p => Math.abs(p.ms - Date.parse(utc)) < 2 * 60000);
    const want = phase === 'first quarter' ? 'flood' : 'ebb';
    if (!c || tide.tideAt(c.ms + 60000) !== want) { fail(`a minute after the ${phase} moon of ${utc} the Hidden aren't at the ${want}`); break; }
  }
  const sunsetOn = (jdn, seat) => solarEvents((jdn - 2440587.5) * DAY_MS - DAY_MS / 2, (jdn - 2440587.5) * DAY_MS + DAY_MS, seat.lat, seat.lon)
    .find(e => e.kind === 'set' && cal.localDay(e.t, seat.lon) === jdn)?.t;
  const sunriseOn = (jdn, seat) => solarEvents((jdn - 2440587.5) * DAY_MS - DAY_MS / 2, (jdn - 2440587.5) * DAY_MS + DAY_MS, seat.lat, seat.lon)
    .find(e => e.kind === 'rise' && cal.localDay(e.t, seat.lon) === jdn)?.t;
  // At each eve: the open night it is, the half before its sunset, after it,
  // and after the next sunrise.
  const EVES = { north: [[1668, 10, 31, 'autumn', 'light', 'dark', 'dark'], [1669, 4, 30, 'spring', 'dark', 'dark', 'light']],
    south: [[1668, 10, 31, 'spring', 'dark', 'dark', 'light'], [1669, 4, 30, 'autumn', 'light', 'dark', 'dark']] };
  let hemispheres = 0;
  for (const p of placed ? calendars.polities : []) {
    const seat = seats.seats[p.seat[0]];
    const at = ms => tide.hiddenAt(ms, p, seat);
    if (p.calendar === 'hijri-tabular') {
      const any = [0, 60, 120, 180, 240, 300].map(d => at(Date.UTC(1668, 10, 1) + d * DAY_MS));
      if (any.some(h => h.half || h.open)) fail(`${p.name} keeps no 31 October, but the map gives it a half or an open night`);
      continue;
    }
    const toJdn = p.calendar === 'gregorian' ? cal.jdnFromGregorian : cal.jdnFromJulian;
    for (const [year, m, d, name, before, after, morn] of EVES[seat.lat >= 0 ? 'north' : 'south']) {
      const jdn = toJdn(year, m, d), set = sunsetOn(jdn, seat), rise = sunriseOn(jdn + 1, seat);
      const was = at(set - 60000), is = at(set + 60000), morning = at(rise + 60000);
      if (was.half !== before || is.half !== after || morning.half !== morn || was.open || is.open !== name || morning.open) {
        fail(`${p.name}: at sunset on ${d} ${m === 10 ? 'October' : 'April'} ${year} (its own calendar) the map goes from ${was.half}${was.open ? ', ' + was.open : ''} to ${is.half}${is.open ? ', ' + is.open : ''}, and the morning after is ${morning.half}${morning.open ? ', ' + morning.open : ''}`);
        break;
      }
      eves++;
    }
    // Midwinter and midsummer by its own hemisphere, whatever the sun does.
    for (const [m, northHalf] of [[0, 'dark'], [6, 'light']]) {
      const { half } = at(Date.UTC(1669, m, 15, 12) - seat.lon / 360 * DAY_MS);
      const want = seat.lat >= 0 ? northHalf : northHalf === 'dark' ? 'light' : 'dark';
      if (half !== want) { fail(`${p.name} (${seat.lat.toFixed(1)}°) is in the ${half} half on 15 ${m ? 'July' : 'January'} 1669, not the ${want}`); break; }
      hemispheres++;
    }
  }
  if (placed && tide.hiddenAt(Date.UTC(1669, 0, 15, 12), null, { lat: 50, lon: 0 }).half !== null) fail('a place with no known calendar is given a half');

  // The projection: the formulas the relief's shader runs, against d3-geo's
  // own orthographic, from every view; the centre at the middle, a point and
  // back where it started, and nothing off the disc. The round trip is held
  // where the disc can hold it: at the limb √(1 − X² − Y²) turns an ulp of
  // X² + Y² into its square root, so points within LIMB_DEPTH of the limb
  // are left to the comparison with d3.
  const LIMB_DEPTH = 1e-6;
  let roundTrips = 0, d3Worst = 0;
  for (const v of VIEWS) {
    const d3 = projectionFor({ ...v, k: 1, cx: 0, cy: 0 });
    const [cx, cy] = geo.orthoProject(v.lon0, v.lat0, v.lon0, v.lat0);
    if (Math.hypot(cx, cy) > 1e-12) fail(`from ${v.lat0}°, ${v.lon0}°: the centre projects to ${cx}, ${cy}`);
    for (let lat = -88; lat <= 88; lat += 4) for (let lon = -178; lon <= 180; lon += 4) {
      const mine = geo.orthoProject(lon, lat, v.lon0, v.lat0);
      if (!mine) continue;
      const [x, y] = d3([lon, lat]);
      d3Worst = Math.max(d3Worst, Math.hypot(x - mine[0], -y - mine[1]));
      if (geo.orthoLocal(lon, lat, v.lon0, v.lat0)[2] < LIMB_DEPTH) continue;
      const back = geo.orthoUnproject(...mine, v.lon0, v.lat0);
      const off = back ? Math.max(Math.abs(back.lat - lat), Math.abs(lat) < 89 ? Math.abs(((back.lon - lon + 540) % 360) - 180) : 0) : Infinity;
      if (!(off < 1e-8)) { fail(`from ${v.lat0}°, ${v.lon0}°: ${lat}°, ${lon}° projects and comes back ${off}° away`); break; }
      roundTrips++;
    }
    if (geo.orthoUnproject(0.8, 0.8, v.lon0, v.lat0) !== null) fail(`from ${v.lat0}°, ${v.lon0}°: a point off the disc unprojects to the globe`);
  }
  if (!(d3Worst < 1e-9)) fail(`the orthographic formulas stray ${d3Worst} from d3-geo's`);
  // Land and sea, at points whose answer no coastline could move: inland
  // capitals, the South Pole, and open ocean far from any island.
  const KNOWN = [
    ['Madrid', 40.4, -3.7, true], ['Harare', -17.8, 31.1, true], ['Ulaanbaatar', 47.9, 106.9, true],
    ['the South Pole', -89.9, 0, true], ['the mid-Atlantic', 0, -30, false], ['the South Pacific', -45, -120, false],
    ['the Indian Ocean', -30, 80, false], ['the Arctic Ocean', 85, 0, false],
  ];
  for (const [name, lat, lon, land] of KNOWN) {
    if (geo.onLand(world.land ?? [], lat, lon) !== land) fail(`the map puts ${name} ${land ? 'at sea' : 'on land'}`);
  }
  // The relief: ETOPO5 under its provenance, laid out as it says, deep
  // where the sea is deepest and high where the land is highest; and its
  // hillshading's exaggeration the one its own land slopes give.
  const L = relief.layout ?? {};
  if (!/ETOPO5/.test(relief.provenance?.source ?? '') || !/^[0-9a-f]{64}$/.test(relief.provenance?.sha256 ?? '')) fail('euphonia.relief.json: no ETOPO5 provenance');
  if (relief.bytes.length !== L.rows * L.cols) fail(`euphonia.relief.bin has ${relief.bytes.length} cells where its layout says ${L.rows}×${L.cols}`);
  const height = i => { const b = relief.bytes[i]; return b * Math.abs(b) * L.extreme / (L.scale * L.scale); };
  const at = (lat, lon) => height(Math.round((L.lat0 - lat) / L.step) * L.cols + Math.round(((lon - L.lon0) % 360 + 360) % 360 / L.step) % L.cols);
  const RELIEF_KNOWN = [['the Everest cell', 27.99, 86.93, 5000, 9000], ['the Mariana Trench', 11.35, 142.2, -11000, -7500],
    ['the Tibetan plateau', 32, 90, 4000, 6000], ['the mid-Atlantic', 0, -30, -5000, -3000], ['the North Sea', 56, 3, -200, 0]];
  for (const [name, lat, lon, lo, hi] of RELIEF_KNOWN) {
    const h = at(lat, lon);
    if (!(h >= lo && h <= hi)) fail(`the relief puts ${name} at ${Math.round(h)} m, outside ${lo}…${hi}`);
  }
  {
    const METRES_PER_DEGREE = 6371000 * RAD, slopes = [];
    for (let r = 1; r < L.rows - 1; r++) {
      const dy = 2 * L.step * METRES_PER_DEGREE, dx = dy * Math.cos((L.lat0 - r * L.step) * RAD);
      for (let c = 0; c < L.cols; c++) {
        if (height(r * L.cols + c) <= 0) continue;
        const e = height(r * L.cols + (c + 1) % L.cols) - height(r * L.cols + (c + L.cols - 1) % L.cols);
        const n = height((r - 1) * L.cols + c) - height((r + 1) * L.cols + c);
        slopes.push(Math.hypot(e / dx, n / dy));
      }
    }
    slopes.sort((a, b) => a - b);
    const steepest = slopes[Math.floor(slopes.length * relief.shading.steepest_percentile / 100)];
    if (!(Math.abs(relief.shading.exaggeration * steepest - 1) < 1e-9)) fail(`the hillshading's exaggeration is ${relief.shading.exaggeration}, but the grid's steepest land slopes give ${1 / steepest}`);
  }

  // The wind roses: each at sea, as far from the map's coasts as its file
  // says, and farther than every step a tenth of a degree around it.
  const coastUnits = (world.land ?? []).flat().map(([lon, lat]) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)]);
  const toCoast = (lat, lon) => {
    const p = [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];
    let best = -1;
    for (const c of coastUnits) { const d = p[0] * c[0] + p[1] * c[1] + p[2] * c[2]; if (d > best) best = d; }
    return Math.acos(Math.min(1, best)) / RAD;
  };
  for (const r of roses.roses ?? []) {
    const here = toCoast(r.lat, r.lon);
    if (geo.onLand(world.land ?? [], r.lat, r.lon)) fail(`a wind rose stands on land at ${r.lat}, ${r.lon}`);
    if (Math.abs(here * RAD * EARTH_KM - r.nearest_coast_km) > 5) fail(`the rose at ${r.lat}, ${r.lon} is ${Math.round(here * RAD * EARTH_KM)} km from the coast, not the ${r.nearest_coast_km} its file says`);
    for (const [a, b] of [[0.1, 0], [-0.1, 0], [0, 0.1], [0, -0.1]]) {
      if (toCoast(r.lat + a, r.lon + b) > here + 1e-9) { fail(`the rose at ${r.lat}, ${r.lon} isn't the farthest point from land around it`); break; }
    }
  }
  if ((roses.roses ?? []).length < 1) fail('euphonia.roses.json: no roses');

  // Rhumb lines keep their bearing: due east keeps its latitude, due north
  // its longitude, and between any two points of one at 45°, Δλ = Δψ.
  const merc = lat => Math.log(Math.tan(Math.PI / 4 + lat * RAD / 2));
  const east = geo.rhumb(-30, 10, 90, 40, 1), north = geo.rhumb(-30, 10, 0, 40, 1), diagonal = geo.rhumb(-30, 10, 45, 40, 1);
  const rhumbOff = [
    ...east.map(([, lat]) => Math.abs(lat + 30)),
    ...north.map(([lon]) => Math.abs(lon - 10)),
    ...diagonal.slice(1).map(([lon, lat], i) => Math.abs((lon - diagonal[i][0]) * RAD - (merc(lat) - merc(diagonal[i][1])))),
  ];
  if (!(Math.max(...rhumbOff) < 1e-9) || east.length < 40) fail(`a rhumb line strays from its bearing by ${Math.max(...rhumbOff)}`);

  // The land as the globe fills it: each ring's winding read as d3 reads
  // it, no polygon more than half the sphere, and the total d3 measures the
  // total of the rings' own areas by an independent formula.
  const globe = globeWorld(world, roses.roses ?? [], borders);
  const whole = (world.land ?? []).reduce((a, r) => a + Math.abs(ringArea(r)), 0);
  const filled = geoArea(globe.land);
  const flooding = globe.land.coordinates.filter(c => geoArea({ type: 'Polygon', coordinates: c }) > 2 * Math.PI).length;
  if (flooding) fail(`${flooding} land polygon(s) would cover more than half the sphere`);
  if (!(Math.abs(filled - whole) <= 1e-3 * whole) || !(whole > 0)) fail(`the globe fills ${filled.toFixed(5)} sr of land against the rings' ${whole.toFixed(5)}`);
  // The cuts stitched: no land polygon on the sphere keeps an edge along the
  // antimeridian or the pole, unless the cut's other side is missing from
  // Natural Earth's own vertices there.
  const key = ([lon, lat]) => `${lon},${lat}`;
  const seamEdge = (a, b) => (Math.abs(a[0]) === 180 && a[0] === b[0]) || (a[1] === -90 && b[1] === -90);
  const edges = rings => rings.flatMap(r => r.slice(1).map((b, i) => [r[i], b]));
  const onCut = new Set((world.land ?? []).flat().filter(q => Math.abs(q[0]) === 180).map(key));
  const cutSeams = edges(world.land ?? []).filter(([a, b]) => seamEdge(a, b)).length;
  const leftSeams = edges(globe.land.coordinates.map(c => c[0])).filter(([a, b]) => seamEdge(a, b));
  const orphans = leftSeams.filter(([a, b]) => a[1] !== -90 && !(onCut.has(key([-a[0], a[1]])) && onCut.has(key([-b[0], b[1]]))));
  if (orphans.length < leftSeams.length) fail(`${leftSeams.length - orphans.length} seam edge(s) left in the globe's land where Natural Earth carries the other side`);
  // Clipping. The disc's area is the sphere's foreshortened by z ≤ 1, so no
  // polygon draws larger on the disc than it is on the sphere: from every
  // view, each land, lake and shore polygon as d3 clips it and closes it
  // along the limb is held to that. A ring d3 put on the wrong side of the
  // limb fills the disc, π, whatever its size.
  const drawnArea = (shape, v) => {
    let area = 0, ring = [];
    const close = () => { let a = 0; for (let i = 0; i < ring.length; i++) { const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length]; a += x1 * y2 - x2 * y1; } area += Math.abs(a) / 2; ring = []; };
    geoPath(projectionFor({ ...v, k: 1, cx: 0, cy: 0 }), { moveTo(x, y) { close(); ring.push([x, y]); }, lineTo(x, y) { ring.push([x, y]); }, closePath: close })(shape);
    close();
    return area;
  };
  const AREA_SLACK = 1e-6;
  let clipped = 0;
  for (const v of VIEWS) for (const layer of ['land', 'lakes', 'historic']) for (const coordinates of globe[layer].coordinates) {
    const shape = { type: 'Polygon', coordinates }, drawn = drawnArea(shape, v);
    if (drawn > geoArea(shape) + AREA_SLACK) { fail(`from ${v.lat0}°, ${v.lon0}°: a ${layer} polygon of ${geoArea(shape).toExponential(2)} sr draws ${drawn.toFixed(4)} of the disc`); break; }
    clipped++;
  }
  // And from three views the land d3 draws against the land found by
  // sampling the disc point by point. The sampling's error is about the
  // coast's length over the grid's step; 2% of the disc holds it.
  const CLIP_GRID = 72, CLIP_TOLERANCE = 0.02;
  let clipWorst = 0;
  for (const v of [{ lon0: 15, lat0: 20 }, { lon0: -165, lat0: -20 }, { lon0: 0, lat0: -90 }]) {
    let land = 0, disc = 0;
    for (let i = 0; i < CLIP_GRID; i++) for (let j = 0; j < CLIP_GRID; j++) {
      const p = geo.orthoUnproject(-1 + (2 * i + 1) / CLIP_GRID, -1 + (2 * j + 1) / CLIP_GRID, v.lon0, v.lat0);
      if (!p) continue;
      disc++;
      if (geo.onLand(world.land ?? [], p.lat, p.lon)) land++;
    }
    const drawn = drawnArea(globe.land, v) / Math.PI, sampled = land / disc;
    clipWorst = Math.max(clipWorst, Math.abs(drawn - sampled));
    if (Math.abs(drawn - sampled) > CLIP_TOLERANCE) fail(`from ${v.lat0}°, ${v.lon0}°: the globe draws land over ${(drawn * 100).toFixed(1)}% of the disc, sampling finds ${(sampled * 100).toFixed(1)}%`);
  }

  // The mount. The globe as the page draws it (euphonia.mount.js's view,
  // through d3) against the globe as it stands: the axis upright in the
  // meridian ring, the meridian lon0 turned to face the eye, a point carried
  // into the stand and seen from the eye's height, from eyes across the whole
  // range the reader can move it, south of the equator as well as north.
  const { MERIDIAN, EYE_MAX } = mount;
  if (!(EYE_MAX > 0 && EYE_MAX <= 90)) fail(`the eye's range is ${EYE_MAX}°`);
  const EYES = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map(f => f * EYE_MAX).concat(mount.EYE);
  let mountWorst = 0, mountPoints = 0;
  for (const eyeAt of EYES) for (const lon0 of [-150, -15, 15, 120]) {
    const axis = [0, 1, 0], facing = [0, 0, 1], east = [1, 0, 0];
    const d3 = projectionFor({ ...mount.viewOf({ lon0, eye: eyeAt }), k: 1, cx: 0, cy: 0 });
    for (let lat = -80; lat <= 80; lat += 20) for (let lon = -180; lon < 180; lon += 20) {
      const c = Math.cos(lat * RAD), dl = (lon - lon0) * RAD;
      const g = [c * Math.cos(dl), c * Math.sin(dl), Math.sin(lat * RAD)];
      const stand = [0, 1, 2].map(i => g[0] * facing[i] + g[1] * east[i] + g[2] * axis[i]);
      const [x, y, depth] = mount.onPage(stand, eyeAt);
      if (depth < 1e-3) continue;
      const [px, py] = d3([lon, lat]);
      mountWorst = Math.max(mountWorst, Math.hypot(px - x, -py - y));
      mountPoints++;
    }
  }
  if (!(mountWorst < 1e-9) || !mountPoints) fail(`the mounted globe strays ${mountWorst} from the globe as it stands, over ${mountPoints} points`);
  // What the mount hides, by casting the eye's line through each point of
  // the globe's face and finding where it meets the meridian ring's plane,
  // within the ring, before the sphere, from each of those eyes.
  const MOUNT_GRID = 300;
  let coverMisses = 0, covered = 0, coverMissAt = '';
  for (const eyeAt of EYES) {
    const E = eyeAt * RAD, sE = Math.sin(E), cE = Math.cos(E);
    for (let i = 0; i < MOUNT_GRID; i++) for (let j = 0; j < MOUNT_GRID; j++) {
      const x = -1 + (2 * i + 1) / MOUNT_GRID, y = -1 + (2 * j + 1) / MOUNT_GRID;
      if (x * x + y * y >= 1) continue;
      const sphere = Math.sqrt(1 - x * x - y * y);
      // The line of sight: P(t) = x·X + y·up + t·eye, up = (0, cos E, −sin E), eye = (0, sin E, cos E).
      const at = t => [x, y * cE + t * sE, -y * sE + t * cE];
      const t = y * sE / cE, P = at(t), r = Math.hypot(P[0], P[1]);
      const hidden = r >= MERIDIAN.inner && r <= MERIDIAN.outer && t > sphere;
      if (hidden !== mount.covers(x, y, eyeAt)) { coverMisses++; coverMissAt ||= `${x.toFixed(3)}, ${y.toFixed(3)} from ${eyeAt.toFixed(1)}°`; }
      if (hidden) covered++;
    }
  }
  if (coverMisses || !covered) fail(`the mount's cover is wrong at ${coverMisses} of the globe's points (${covered} hidden by casting), first at ${coverMissAt}`);
  // The mount's extent holds every part of it from every eye, and is reached:
  // the frame is the stand's, not a margin.
  const { EXTENT } = mount;
  let reach = 0;
  for (const eyeAt of EYES) for (let a = 0; a < 360; a++) {
    const c = Math.cos(a * RAD), s = Math.sin(a * RAD);
    for (const P of [[MERIDIAN.outer * c, MERIDIAN.outer * s, 0]]) {
      const [x, y] = mount.onPage(P, eyeAt);
      reach = Math.max(reach, Math.abs(y));
      if (Math.abs(x) > EXTENT.halfWidth + 1e-12 || y > EXTENT.top + 1e-12 || y < -EXTENT.bottom - 1e-12) { fail(`from ${eyeAt.toFixed(1)}° the mount reaches ${x.toFixed(3)}, ${y.toFixed(3)}, outside its extent`); a = 360; break; }
    }
  }
  if (!(Math.abs(reach - Math.max(EXTENT.top, EXTENT.bottom)) < 1e-9)) fail(`the mount's extent is ${EXTENT.top}, but it reaches only ${reach}`);

  // The polities of 1668, held to Cliopatria and to the book's lines. The
  // release and its hash name what was vendored, and the book it was drawn
  // from is the export's; every part of a row is drawn as the region it's
  // drawn under classes it (firm a line, zone a reach, replaced gone: a row
  // two regions list is classed part by part, by the nearer region, and a
  // part an @ground line cuts off is that line's zone); every
  // correction quotes its chapter or
  // cites a source; and each ✦ departure is drawn from its @departs line,
  // its sentence its chapter's, holding what it holds and not what it
  // stands beside.
  const bp = borders.provenance ?? {};
  if (!/Cliopatria/.test(bp.source ?? '') || bp.licence !== 'https://creativecommons.org/licenses/by/4.0/') fail('euphonia.borders.json: its provenance must name Cliopatria and its CC BY 4.0 licence');
  if (!/^v\d+\.\d+\.\d+$/.test(bp.release ?? '') || !/^[0-9a-f]{64}$/.test(bp.sha256 ?? '')) fail('euphonia.borders.json: no release or SHA-256 for what was vendored');
  if (bp.tolerance_deg !== prov.tolerance_deg) fail(`euphonia.borders.json is simplified at ${bp.tolerance_deg}°, the coasts at ${prov.tolerance_deg}°`);
  if (bp.book !== vendored('regions')().provenance?.sha256) fail('euphonia.borders.json was drawn from another export of the book; run scripts/euphonia-borders.mjs again');
  if (bp.book !== vendored('release')().sha256) fail(`euphonia.borders.json was drawn from master ${bp.book?.slice(0, 12)}…, not the released one euphonia.release.json pins`);
  const text = name => (regions.find(r => r.name === name)?.sections ?? []).map(sec => sec.text).join('\n');
  const record = (borders.polities ?? []).filter(q => q.kind !== 'departs');
  for (const q of record) {
    if (!/^Q\d+$/.test(q.wikidata ?? '') || !q.label || !q.polys?.length) fail(`euphonia.borders.json: ${q.name} needs a Wikidata id, a name and its polygons`);
    if (q.ground) {
      if (!regions.find(r => r.name === q.region)?.ground?.some(g => g.name === q.ground && g.qid === q.wikidata)) fail(`euphonia.borders.json: ${q.name}'s ${q.ground} is drawn under ${q.region}, which has no @ground line for it`);
      else if (q.kind !== 'reach') fail(`euphonia.borders.json: ${q.name}'s ${q.ground} is an @ground zone, drawn as a ${q.kind}`);
      continue;
    }
    const c = regions.find(r => r.name === q.region)?.borders?.find(b => b.qid === q.wikidata);
    if (!c) fail(`euphonia.borders.json: ${q.name} is drawn under ${q.region}, whose @borders line doesn't class it`);
    else if (c.cls === 'replaced') fail(`euphonia.borders.json: ${q.name} is drawn under ${q.region}, whose @borders line replaces it`);
    else if (q.kind !== { firm: 'line', zone: 'reach' }[c.cls]) fail(`euphonia.borders.json: ${q.name} is drawn as a ${q.kind}, but ${q.region} classes it ${c.cls}`);
  }
  // Each @ground line: its place stands on its line; its row's part beyond is
  // drawn, as that zone, and none of the row's firm ground is left beyond; a
  // cut along a parallel is stepped so the globe draws it as one.
  const grounds = regions.flatMap(r => (r.ground ?? []).map(g => ({ ...g, region: r.name })));
  // How far a point lies past a line, in degrees: across a meridian, round
  // the shorter way.
  const past = ({ side, deg }) => ([x, y]) => ({ north: y - deg, south: deg - y, east: (((x - deg + 180) % 360) + 360) % 360 - 180, west: 180 - (((x - deg + 180) % 360) + 360) % 360 })[side];
  if (JSON.stringify((bp.ground ?? []).map(g => [g.name, g.side, g.deg])) !== JSON.stringify(grounds.map(g => [g.name, g.side, g.deg]))) fail("euphonia.borders.json: its cuts aren't the book's @ground lines; run scripts/euphonia-borders.mjs again");
  for (const g of grounds) {
    const at = lookup(gazetteer, g.place.modern, g.place.country, g.place.province), by = past(g);
    if (at.error) fail(`${g.region}'s @ground ${g.name}: ${at.error}`);
    else if (Math.abs(by([at.lon, at.lat])) > 0.1) fail(`${g.region}'s @ground ${g.name}: ${g.place.name} lies ${Math.abs(by([at.lon, at.lat])).toFixed(2)}° off its line, not within a tenth of a degree`);
    const zone = record.filter(q => q.ground === g.name && q.wikidata === g.qid);
    if (!zone.length) fail(`euphonia.borders.json: ${g.region}'s @ground ${g.name} isn't drawn`);
    for (const q of zone) if (q.polys.flat(2).some(p => by(p) < -1e-9)) fail(`euphonia.borders.json: ${q.name}'s ${g.name} reaches back across its line`);
    for (const q of record.filter(x => x.wikidata === g.qid && x.kind === 'line')) if (q.polys.flat(2).some(p => by(p) > 1e-9)) fail(`euphonia.borders.json: ${q.label} is firm ${g.side} of ${g.deg}°, where ${g.name} ends its firm ground`);
  }
  for (const lat of new Set(grounds.filter(g => g.side === 'north' || g.side === 'south').map(g => g.deg))) {
    const step = parallelStep(lat), all = [...record.flatMap(q => q.polys.flat()), ...(borders.reaches ?? []), ...(borders.lines ?? [])];
    if (all.some(line => line.some((p, i) => line[i + 1] && p[1] === lat && line[i + 1][1] === lat && Math.abs(line[i + 1][0] - p[0]) > step + 1e-9))) fail(`euphonia.borders.json: a cut along ${lat}° has a chord longer than ${step.toFixed(2)}°, and the globe would bow it off the parallel`);
  }
  // Each people the book letters stands on no firm ground: there the map
  // already says who holds it.
  const firmGround = (borders.polities ?? []).filter(q => q.kind === 'line' || q.cls === 'firm');
  for (const r of resolved.regions) for (const n of r.peoples) {
    const q = Number.isFinite(n.lon) && firmGround.find(x => geo.onLand(x.polys.flat(), n.lat, n.lon));
    if (q) fail(`${r.name}'s @peoples letters ${n.name} at ${n.modern}, inside ${q.label}'s firm ground`);
  }
  for (const c of bp.corrections ?? []) {
    if (!(c.parts >= 1)) fail(`euphonia.borders.json: the correction of ${c.row} moved nothing`);
    if (c.region) { for (const w of c.because ?? []) if (!text(c.region).includes(w)) fail(`euphonia.borders.json: "${w}" isn't in ${c.region}'s chapter`); }
    else if (!/^https:\/\//.test(c.source?.url ?? '')) fail(`euphonia.borders.json: the correction of ${c.row} neither quotes the book nor cites a source`);
    if (c.region && !c.because?.length) fail(`euphonia.borders.json: the correction of ${c.row} quotes nothing from ${c.region}`);
  }
  // Inside, or on the outline itself: a ring drawn through a place it holds
  // passes over it, within the simplification.
  const holds = (q, [lon, lat]) => geo.onLand(q.polys.flat(), lat, lon) || q.polys.some(p => p.some(r => r.some(([x, y]) => Math.hypot((x - lon) * Math.cos(lat * RAD), y - lat) <= bp.tolerance_deg)));
  // A place held from outside its ring is a port: the sea lies within the
  // shore band of it.
  const coastal = ([lon, lat]) => Array.from({ length: 8 }, (_, i) => i * Math.PI / 4).some(a => !geo.onLand(world.land, lat + bp.shore_deg * Math.sin(a), lon + bp.shore_deg * Math.cos(a) / Math.cos(lat * RAD)));
  const departed = (borders.polities ?? []).filter(q => q.kind === 'departs');
  for (const r of regions) for (const d of (r.departs ?? []).filter(x => x.cls !== 'front')) {
    const q = departed.find(x => x.name === d.name);
    if (!q) { fail(`euphonia.borders.json: ${r.name}'s departure ${d.name} isn't drawn`); continue; }
    if (q.cls !== d.cls) fail(`euphonia.borders.json: ${d.name} is drawn ${q.cls}, but ${r.name} calls it ${d.cls}`);
    if (!q.star?.startsWith('✦') || !text(r.name).includes(q.star)) fail(`euphonia.borders.json: ${d.name}'s ✦ sentence isn't ${r.name}'s`);
    for (const h of q.holds ?? []) if (!holds(q, h.lonlat) && !coastal(h.lonlat)) fail(`euphonia.borders.json: ${d.name} holds ${h.name}, which lies outside it and inland`);
  }
  for (const n of borders.names ?? []) {
    const q = departed.find(x => x.name === n.of);
    if (!q) { fail(`euphonia.borders.json: ${n.name} is named against ${n.of}, which isn't drawn`); continue; }
    if (n.kind === 'within' && !holds(q, n.lonlat)) fail(`euphonia.borders.json: ${n.name} should lie within ${n.of}`);
    if (n.kind === 'beside' && holds(q, n.lonlat)) fail(`euphonia.borders.json: ${n.name} should lie beside ${n.of}, not in it`);
  }
  for (const f of borders.fronts ?? []) {
    const [lon, lat] = f.around.lonlat;
    const off = f.ring.map(([x, y]) => Math.abs(apart({ lon, lat }, { lon: x, lat: y }) * RAD * EARTH_KM - f.radius_km) / f.radius_km);
    if (!f.ring.length || Math.max(...off) > 0.01) fail(`euphonia.borders.json: ${f.name}'s ring strays ${(Math.max(...off) * 100).toFixed(1)}% from its ${f.radius_km} km`);
    // The front's town is the record's, not the departure's.
    for (const q of departed) if (holds(q, f.around.lonlat)) fail(`euphonia.borders.json: ${q.name} holds ${f.around.name}, which ${f.name} keeps contested`);
    if (!record.some(q => holds(q, f.around.lonlat))) fail(`euphonia.borders.json: no state of the record holds ${f.around.name}, inside ${f.name}`);
  }
  const politiesFlooding = globe.polities.filter(q => q.shape.coordinates.some(c => geoArea({ type: 'Polygon', coordinates: c }) > 2 * Math.PI)).length;
  if (politiesFlooding) fail(`${politiesFlooding} polities would cover more than half the sphere`);
  // The shore's threshold is the histogram's trough, as the vendoring found it.
  const hist = bp.shore_histogram ?? [];
  let trough = hist.indexOf(Math.max(...hist));
  while (trough + 1 < hist.length && hist[trough + 1] < hist[trough]) trough++;
  if (!hist.length || Math.abs(trough * bp.tolerance_deg - bp.shore_deg) > 1e-9) fail(`euphonia.borders.json: the shore is ${bp.shore_deg}°, but its histogram's trough is at ${trough * bp.tolerance_deg}°`);
  // Every edge drawn runs over land: the middle of each segment, as drawn.
  const segs = [...(borders.lines ?? []), ...(borders.reaches ?? []), ...(borders.dashed ?? [])].flatMap(l => l.slice(1).map((b, i) => [l[i], b]));
  const wet = segs.filter(([a, b]) => !geo.onLand(world.land, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2)).length;
  const WET_SHARE = 0.01;
  if (!segs.length || wet > WET_SHARE * segs.length) fail(`${wet} of ${segs.length} border segments run over the sea, more than ${WET_SHARE * 100}%`);

  // The Wheel's names, framed as the page frames them, at a phone's widths
  // and a desktop's, with widths a little over any face's: on a phone none
  // lost and none over another, the mount or the window; on a desktop none
  // moved. Above a phone's open sheet, where the names would meet and can't
  // move up or down, the Wheel is unlettered.
  const wheelData = wheelOf(JSON.parse(readFileSync(new URL('../src/euphonia/euphonia.wheel.json', import.meta.url), 'utf8')).data, JSON.parse(readFileSync(new URL('../src/euphonia/euphonia.classes.json', import.meta.url), 'utf8')).data);
  const REM = 16, NAME_EM = 0.62, named = wheelData.realms.filter(r => r.at !== 'centre').length + wheelData.roads.length;
  const sizes = [[320, 568], [360, 640], [375, 690], [390, 720], [414, 760], [768, 900], [1280, 780], [1920, 960]];
  const aboveSheet = [[375, 290], [390, 350], [440, 400]];
  let wheelMoved = 0;
  for (const [W, H] of [...sizes, ...aboveSheet]) for (const dpr of [1, 2]) {
    const sheet = aboveSheet.some(([w, h]) => w === W && h === H);
    const m = REALM_REACH_REM * REM, f = Math.min(W - 2 * m, H - 2 * m) / (2 * mounting.MERIDIAN.outer);
    const view = { cx: W / 2 * dpr, cy: H / 2 * dpr, k: f * dpr }, rim = { x: (W / 2 - m) / f, y: (H / 2 - m) / f, margin: m / f };
    const got = [...wheelNames(view, wheelData, rim, REM, dpr, (t, road) => t.length * NAME_EM * (road ? 0.62 : 0.72) * REM * dpr).values()];
    if (got.length !== (sheet ? 0 : named)) fail(`the Wheel at ${W}x${H}: ${got.length} of ${named} names placed${sheet ? ', above a phone\'s open sheet' : ''}`);
    got.forEach((n, i) => {
      const { l, r, t, b } = n.box, near = Math.hypot(Math.max(l, Math.min(view.cx, r)) - view.cx, Math.max(t, Math.min(view.cy, b)) - view.cy);
      if (W >= H && !sheet) { if (n.moved > 1e-6) fail(`the Wheel at ${W}x${H}: ${n.text} moved ${n.moved.toFixed(1)}px with room to spare`); return; }
      wheelMoved = Math.max(wheelMoved, n.moved / dpr);
      // On a phone a name stays by its realm: past at most its two
      // neighbours above or below, a line each, and its own line's room.
      if (W < 768 && n.moved > 4 * n.h) fail(`the Wheel at ${W}x${H}: ${n.text} moved ${(n.moved / n.h).toFixed(1)} of its lines from its realm`);
      if (l < 0 || r > W * dpr || t < 0 || b > H * dpr) fail(`the Wheel at ${W}x${H}: ${n.text} leaves the window`);
      if (near < mounting.MERIDIAN.outer * view.k) fail(`the Wheel at ${W}x${H}: ${n.text} runs under the mount`);
      for (const o of got.slice(i + 1)) if (l < o.box.r && o.box.l < r && t < o.box.b && o.box.t < b) fail(`the Wheel at ${W}x${H}: ${n.text} is over ${o.text}`);
    });
  }

  const log = problems.length
    ? [`\neuphonia map: ${problems.length} problem(s):`, ...problems.map(p => `  ${p}`)]
    : [`ok: ${points} Natural Earth points under their provenance; the sun within ${sunWorst.toFixed(4)}° of Horizons at ${sunRows.length} instants; ${computed.length} moon phases within ${phaseWorst.toFixed(2)} min of Espenak, lit within ${litWorst.toFixed(4)}; ${regionPlaces} places in ${regions.length} regions and ${calendars.polities.length} seats, each found once in Natural Earth; ${calendars.polities.length} polities' calendars cited, ${conversions.length} Fourmilab conversions and ${calendarDays} days against ICU; the Tide turning at ${eves} eves and holding ${hemispheres} seasons by hemisphere; the globe fills the ${(whole / (4 * Math.PI) * 100).toFixed(1)}% of it that is land, ${cutSeams - leftSeams.length} of its ${cutSeams} seam edges stitched across the cut, ${orphans.length} kept where Natural Earth has no other side; ${clipped} polygons clipped from ${VIEWS.length} views, none drawn larger than it is, the land within ${(clipWorst * 100).toFixed(1)}% of sampling from three; ${roundTrips} points projected and back, within ${d3Worst.toExponential(0)} of d3-geo's orthographic; land and sea right at ${KNOWN.length} known points; the relief right at ${RELIEF_KNOWN.length} known places, its shading's exaggeration its slopes'; ${roses.roses.length} wind roses at their poles; rhumb lines on their bearings; the mounted globe within ${mountWorst.toExponential(0)} of the globe as it stands at ${mountPoints} points, the mount's cover as the eye's line finds it at every one of ${MOUNT_GRID}² points from ${EYES.length} eyes, north and south, its extent the same from all; ${record.length} polities of ${bp.year} from Cliopatria ${bp.release}, each as its region classes it, ${departed.length} ✦ departures and ${(borders.fronts ?? []).length} front from the book, cut at its ${grounds.length} @ground lines, its ${resolved.regions.reduce((n, r) => n + r.peoples.length, 0)} peoples on no firm ground, ${(bp.corrections ?? []).length} corrections sourced, ${segs.length} border segments with ${wet} over the sea`];
  return { ok: problems.length === 0, failures: problems.length, log };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log } = verifyEuphoniaMap();
  log.forEach(l => console.log(l));
  process.exit(ok ? 0 : 1);
}
