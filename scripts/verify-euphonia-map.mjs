// Holds the map of 1668 to its sources: the vendored Natural Earth geometry to
// its provenance, and the projection to the sphere it projects.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as projection from '../src/euphonia/euphonia.projection.js';
import * as lunar from '../src/euphonia/euphonia.moon.js';
import * as calendar from '../src/euphonia/euphonia.calendars.js';
import * as hidden from '../src/euphonia/euphonia.tide.js';
import { resolvePlaces } from '../src/euphonia/euphonia.places.js';
import { solarEvents } from '../src/bench/bench.sky.js';

const RAD = Math.PI / 180;
const DAY_MS = 86400000;

const vendored = name => () =>
  JSON.parse(readFileSync(new URL(`../src/euphonia/euphonia.${name}.json`, import.meta.url), 'utf8'));
export const worldData = vendored('world');
export const fixturesData = vendored('fixtures');
export const calendarsData = vendored('calendars');
export const gazetteerData = vendored('gazetteer');
// The seats and the regions' places, looked up in the gazetteer.
export const placesData = () =>
  resolvePlaces({ gazetteer: gazetteerData(), regions: vendored('regions')().data, calendars: calendarsData() });

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

export function verifyEuphoniaMap({ world = worldData(), fixtures = fixturesData(), calendars = calendarsData(), gazetteer = gazetteerData(), regions = vendored('regions')().data, geo = projection, moon = lunar, cal = calendar, tide = hidden } = {}) {
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

  // The places: every calendar's seat and every region's place, found in the
  // gazetteer exactly once; and each region naming enough places to show
  // where it reaches.
  if (!/Natural Earth/.test(gazetteer.provenance?.source ?? '') || !/^[0-9a-f]{64}$/.test(gazetteer.provenance?.sha256 ?? '')) fail('euphonia.gazetteer.json: no Natural Earth provenance');
  const resolved = resolvePlaces({ gazetteer, regions, calendars });
  for (const e of resolved.errors) fail(`a place the map can't find: ${e}`);
  for (const r of regions) if (!(r.places?.length >= MIN_PLACES)) fail(`${r.name} names ${r.places?.length ?? 0} places; the map needs ${MIN_PLACES} to show where a region reaches`);
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
  // these hold the reading: the flood from each new moon, the ebb from each
  // full; each polity's eves at its own sunset on its own 31 October and
  // 30 April, the dark half turning there and the open night ending at
  // sunrise; no half where the calendar has no 1 November; and between the
  // tropics, the dark half wherever the sun isn't.
  let eves = 0;
  for (const [utc, phase] of placed ? phaseRows : []) {
    if (phase !== 'new' && phase !== 'full') continue;
    const c = computed.find(p => Math.abs(p.ms - Date.parse(utc)) < 2 * 60000);
    const want = phase === 'new' ? 'flood' : 'ebb';
    if (!c || tide.tideAt(c.ms + 60000) !== want) { fail(`a minute after the ${phase} moon of ${utc} the Hidden aren't at the ${want}`); break; }
  }
  const sunsetOn = (jdn, seat) => solarEvents((jdn - 2440587.5) * DAY_MS - DAY_MS / 2, (jdn - 2440587.5) * DAY_MS + DAY_MS, seat.lat, seat.lon)
    .find(e => e.kind === 'set' && cal.localDay(e.t, seat.lon) === jdn)?.t;
  const sunriseOn = (jdn, seat) => solarEvents((jdn - 2440587.5) * DAY_MS - DAY_MS / 2, (jdn - 2440587.5) * DAY_MS + DAY_MS, seat.lat, seat.lon)
    .find(e => e.kind === 'rise' && cal.localDay(e.t, seat.lon) === jdn)?.t;
  for (const p of placed ? calendars.polities : []) {
    const seat = seats.seats[p.seat[0]];
    const at = ms => tide.hiddenAt(ms, p, seat);
    if (p.calendar === 'hijri-tabular') {
      const any = [0, 60, 120, 180, 240, 300].map(d => at(Date.UTC(1668, 10, 1) + d * DAY_MS));
      if (any.some(h => h.half || h.open)) fail(`${p.name} keeps no 1 November, but the map gives it a half or an open night`);
      continue;
    }
    const toJdn = p.calendar === 'gregorian' ? cal.jdnFromGregorian : cal.jdnFromJulian;
    for (const [name, year, m, d, before, after] of [['Samhain', 1668, 10, 31, 'other', 'dark'], ['Beltane', 1669, 4, 30, 'dark', 'other']]) {
      const jdn = toJdn(year, m, d), set = sunsetOn(jdn, seat), rise = sunriseOn(jdn + 1, seat);
      const was = at(set - 60000), is = at(set + 60000), morning = at(rise + 60000);
      const want = seat.lat >= 0 ? [before, after] : [after, before];
      if (was.half !== want[0] || is.half !== want[1] || was.open || is.open !== name || morning.open) {
        fail(`${p.name}: at sunset on ${d} ${m === 10 ? 'October' : 'April'} ${year} (its own calendar) the map goes from ${was.half}${was.open ? ', ' + was.open : ''} to ${is.half}${is.open ? ', ' + is.open : ''}, and the morning after is ${morning.open ?? 'no open night'}`);
        break;
      }
      eves++;
    }
  }
  let tropicChecks = 0;
  for (let k = 0; k < 53; k++) {
    const t = Date.UTC(1668, 10, 1) + k * 7 * DAY_MS + 12 * 3600000, sun = geo.subsolar(t);
    for (const lat of [-0.9, -0.5, -0.1, 0.1, 0.5, 0.9].map(f => f * sun.obliquity)) {
      const { half } = tide.hiddenAt(t, null, { lat, lon: 0 });
      if (half !== ((sun.lat >= 0) !== (lat >= 0) ? 'dark' : 'other')) { fail(`between the tropics, at ${lat.toFixed(1)}° on ${new Date(t).toISOString().slice(0, 10)}, the half doesn't follow the sun`); break; }
      tropicChecks++;
    }
    if (tide.hiddenAt(t, null, { lat: 50, lon: 0 }).half !== null) { fail('outside the tropics, a place with no known calendar is given a half'); break; }
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
  // The projection run backwards lands where it started: every 2° of
  // latitude and longitude across each hemisphere, and off the disc nothing.
  let roundTrips = 0;
  for (const h of geo.HEMISPHERES) {
    for (let lat = -88; lat <= 88; lat += 2) for (let dl = -88; dl <= 88; dl += 2) {
      const lon = ((h.lon0 + dl + 540) % 360) - 180;
      const back = geo.unproject(...geo.project(lon, lat, h.lon0), h.lon0);
      const off = back ? Math.max(Math.abs(back.lat - lat), Math.abs(((back.lon - lon + 540) % 360) - 180)) : Infinity;
      if (!(off < 1e-9)) { fail(`${h.name}: ${lat}°, ${lon}° projects and comes back ${off}° away`); break; }
      roundTrips++;
    }
    if (geo.unproject(0.8, 0.8, h.lon0) !== null) fail(`${h.name}: a point off the disc unprojects to the globe`);
  }
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
    : [`ok: ${points} Natural Earth points under their provenance; the sun within ${sunWorst.toFixed(4)}° of Horizons at ${sunRows.length} instants; ${computed.length} moon phases within ${phaseWorst.toFixed(2)} min of Espenak, lit within ${litWorst.toFixed(4)}; ${regionPlaces} places in ${regions.length} regions and ${calendars.polities.length} seats, each found once in Natural Earth; ${calendars.polities.length} polities' calendars cited, ${conversions.length} Fourmilab conversions and ${calendarDays} days against ICU; the Tide turning at ${eves} eves and ${tropicChecks} tropical readings; the hemispheres show all ${(whole / (4 * Math.PI) * 100).toFixed(1)}% of the globe that is land, once; ${roundTrips} points projected and back; land and sea right at ${KNOWN.length} known points; ${circles} dusk circles drawn where the sky darkens`];
  return { ok: problems.length === 0, failures: problems.length, log };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log } = verifyEuphoniaMap();
  log.forEach(l => console.log(l));
  process.exit(ok ? 0 : 1);
}
