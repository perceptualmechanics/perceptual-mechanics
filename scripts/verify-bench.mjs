import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as text from '../src/bench/bench.text.js';
import * as sky from '../src/bench/bench.sky.js';
import { SIGIL_PATHS } from '../src/bench/bench.sigils.js';
import { parseZoneTab, parseLinks, zonePlace, reckon } from '../src/bench/bench.place.js';
import { SCENES } from '../src/scenes/registry.js';

const ROOT = new URL('../', import.meta.url);
const read = rel => readFileSync(new URL(rel, ROOT), 'utf8');

// Everything the gate judges, gathered in one place so a check can be shown to
// fail by handing it a corrupted copy instead of editing the source.
export function benchData() {
  return {
    CHALDEAN: text.CHALDEAN,
    WEEKDAY_RULERS: text.WEEKDAY_RULERS,
    PLANETS: text.PLANETS,
    ripleyOrder: text.RIPLEY.order.lines,
    ripleyDivision: text.RIPLEY.division.lines,
    SIGILS: text.SIGILS,
    ASSIGNMENTS: text.ASSIGNMENTS,
    SIGIL_PATHS,
    scenes: Object.keys(SCENES),
    authorship: text.SIGIL_AUTHORSHIP,
    landingSource: read('scripts/landing.js'),
    unicode: read('src/bench/unicode-alchemy.txt'),
    usno: JSON.parse(read('src/bench/usno-fixtures.json')).fixtures,
    zoneTab: read('src/bench/zone.tab'),
    backward: read('src/bench/backward'),
    htaccess: read('public/.htaccess'),
    toleranceMin: 1,
  };
}

const MINUTE = 60000;
const hm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const sameSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

export function verifyBench(d = benchData()) {
  const log = [];
  const problems = [];
  const fail = m => problems.push(m);

  // Chaldean order -> the week. The literal is typed as the week reads, so
  // editing either alone fails.
  if (new Set(d.CHALDEAN).size !== 7) fail(`the Chaldean order has ${new Set(d.CHALDEAN).size} distinct planets, not 7`);
  if (!sameSet(d.CHALDEAN, Object.keys(d.PLANETS))) fail('PLANETS does not name exactly the seven planets of the Chaldean order');
  const derivedWeek = Array.from({ length: 7 }, (_, w) =>
    d.CHALDEAN[(d.CHALDEAN.indexOf('sun') + w * text.HOURS_PER_DAY) % 7]);
  if (derivedWeek.join() !== d.WEEKDAY_RULERS.join()) {
    fail(`stepping ${text.HOURS_PER_DAY} hours through the Chaldean order gives ${derivedWeek.join(' ')}, but WEEKDAY_RULERS reads ${d.WEEKDAY_RULERS.join(' ')}`);
  }
  if (d.CHALDEAN === text.CHALDEAN && sky.dayRuler(3) !== d.WEEKDAY_RULERS[3]) fail('bench.sky.js dayRuler() disagrees with the week');

  // Ripley: twelve gates, numbered by his own ordinals, the count his own.
  let gates = [];
  try { gates = text.parseGates(d.ripleyOrder); } catch (e) { fail(e.message); }
  const stated = text.statedGateCount(d.ripleyDivision);
  if (stated === null) fail('p. 127 no longer states how many chapters Ripley divides the work into');
  if (gates.length !== stated) fail(`p. 128 yields ${gates.length} gates, but p. 127 says "In number ${stated}"`);
  const ns = gates.map(g => g.n);
  if (ns.join() !== Array.from({ length: gates.length }, (_, i) => i + 1).join()) fail(`the gates are numbered ${ns.join(',')}, not 1..${gates.length} once each`);
  if (gates.some(g => /recapytulatyon/i.test(g.spelling))) fail('Recapytulatyon was counted as a gate; Ripley keeps it outside the twelve');
  if (gates.some(g => /y/.test(g.name))) fail('a gate kept a y through modernSpelling()');

  // Sigils: the assignment covers the registry exactly, no sigil twice, every
  // planet once, every code point and name as Unicode has it, every sigil drawn.
  const assigned = Object.entries(d.ASSIGNMENTS);
  if (!sameSet(Object.keys(d.ASSIGNMENTS), d.scenes)) {
    const missing = d.scenes.filter(s => !d.ASSIGNMENTS[s]);
    const extra = Object.keys(d.ASSIGNMENTS).filter(s => !d.scenes.includes(s));
    fail(`ASSIGNMENTS and the registry disagree — no sigil for [${missing}], sigil for unknown scene [${extra}]`);
  }
  const used = assigned.map(([, a]) => a.sigil);
  const twice = used.filter((s, i) => used.indexOf(s) !== i);
  if (twice.length) fail(`sigil(s) used twice: ${[...new Set(twice)].join(', ')}`);
  for (const planet of d.CHALDEAN) {
    const n = used.filter(s => d.SIGILS[s]?.planet === planet).length;
    if (n !== 1) fail(`${planet}'s sigil is carried by ${n} scenes, not exactly one`);
  }
  const ucd = new Map(d.unicode.split('\n').filter(l => l && !l.startsWith('#'))
    .map(l => { const [cp, name] = l.split(';'); return [parseInt(cp, 16), name]; }));
  for (const [scene, a] of assigned) {
    const s = d.SIGILS[a.sigil];
    if (!s) { fail(`${scene}'s sigil "${a.sigil}" is not in SIGILS`); continue; }
    if (ucd.get(s.cp) !== s.unicode) fail(`${a.sigil}: U+${s.cp.toString(16).toUpperCase()} is "${ucd.get(s.cp) ?? 'absent from the excerpt'}" in UnicodeData, not "${s.unicode}"`);
    if (!d.SIGIL_PATHS[a.sigil]?.trim()) fail(`${a.sigil} has no drawing in bench.sigils.js`);
    if (!a.why?.trim()) fail(`${scene}'s assignment gives no reason`);
  }
  const landingProse = d.landingSource.replace(/\n\s*\/\/\s*/g, ' ');
  if (!/Scott's assignment/.test(d.authorship ?? '')) fail("bench.text.js SIGIL_AUTHORSHIP no longer says the sigils are Scott's assignment");
  if (!/Scott's assignment/.test(landingProse)) fail("scripts/landing.js no longer says the sigils it draws are Scott's assignment");

  // The sky, against the US Naval Observatory. Its times are rounded to the
  // minute, so a minute either way is the tightest honest tolerance.
  let worst = 0;
  for (const f of d.usno) {
    const d0 = Date.parse(`${f.date}T00:00:00Z`);
    const events = sky.solarEvents(d0, d0 + 86400000, f.lat, f.lon);
    for (const kind of ['rise', 'set']) {
      const want = f[kind];
      const got = events.find(e => e.kind === kind);
      if (want === null && got) fail(`${f.place} ${f.date}: USNO has no sun${kind}, bench.sky.js puts one at ${new Date(got.t).toISOString()}`);
      if (want !== null && !got) fail(`${f.place} ${f.date}: USNO has sun${kind} at ${want} UTC, bench.sky.js has none`);
      if (want !== null && got) {
        const delta = Math.abs((got.t - d0) / MINUTE - hm(want));
        worst = Math.max(worst, delta);
        if (delta > d.toleranceMin) fail(`${f.place} ${f.date}: sun${kind} ${delta.toFixed(2)} min from USNO's ${want} UTC`);
      }
    }
  }

  // The hours: twenty-four, tiling sunrise to sunrise, the rulers in Chaldean
  // order, the day's ruler the planet of its weekday.
  let tables = 0;
  for (const f of d.usno.filter(f => f.rise)) {
    const d0 = Date.parse(`${f.date}T00:00:00Z`);
    const rise = sky.solarEvents(d0, d0 + 86400000, f.lat, f.lon).find(e => e.kind === 'rise');
    if (!rise) continue; // the sky check above has already said so
    const t = sky.planetaryHours(rise.t + 3600000, f.lat, f.lon);
    if (!t) { fail(`${f.place} ${f.date}: no planetary hours on a day with a sunrise`); continue; }
    tables++;
    const h = t.hours;
    if (h.length !== 24) fail(`${f.place} ${f.date}: ${h.length} hours, not 24`);
    if (Math.abs(h[0].start - t.rise) > 1) fail(`${f.place} ${f.date}: hour 1 does not begin at sunrise`);
    if (Math.abs(h[23].end - t.nextRise) > 1) fail(`${f.place} ${f.date}: hour 24 does not end at the next sunrise`);
    for (let k = 0; k < 23; k++) {
      if (Math.abs(h[k].end - h[k + 1].start) > 1) fail(`${f.place} ${f.date}: a gap or overlap between hours ${k + 1} and ${k + 2}`);
      const next = d.CHALDEAN[(d.CHALDEAN.indexOf(h[k].planet) + 1) % 7];
      if (h[k + 1].planet !== next) fail(`${f.place} ${f.date}: hour ${k + 2} is ${h[k + 1].planet}, Chaldean order says ${next}`);
    }
    const weekday = sky.meanSolarWeekday(t.rise, f.lon);
    if (t.ruler !== d.WEEKDAY_RULERS[weekday]) fail(`${f.place} ${f.date}: the day's ruler is ${t.ruler}, its weekday's planet is ${d.WEEKDAY_RULERS[weekday]}`);
  }
  for (const f of d.usno.filter(f => !f.rise && !f.set)) {
    const noon = Date.parse(`${f.date}T12:00:00Z`);
    if (sky.planetaryHours(noon, f.lat, f.lon)) fail(`${f.place} ${f.date}: planetary hours on a day the sun neither rises nor sets`);
    if (reckon(noon, { kind: 'sky', lat: f.lat, lon: f.lon }).provenance.kind !== 'polar') fail(`${f.place} ${f.date}: polar day or night is not reckoned as "polar"`);
  }
  const eq = sky.equalHours(Date.parse('2026-10-11T15:00:00Z'), -118.287);
  if (eq.hours.some(x => Math.abs(x.end - x.start - 3600000) > 1)) fail('equalHours() made an hour that is not sixty minutes');

  // The line on the page, every planet by every provenance.
  const provenances = [{ kind: 'sky' }, { kind: 'zone', city: 'Los Angeles' }, { kind: 'equal' }, { kind: 'polar' }];
  let lines = 0;
  for (const planet of d.CHALDEAN) {
    for (const p of provenances) {
      const s = text.hourLine(planet, p);
      lines++;
      if (!s.includes(d.PLANETS[planet].name) || !s.includes(d.PLANETS[planet].metal)) fail(`hourLine(${planet}, ${p.kind}) does not name the planet and its metal: "${s}"`);
      if (p.city && !s.includes(p.city)) fail(`hourLine(${planet}, zone) does not name the city: "${s}"`);
    }
  }
  let refused = false;
  try { text.hourLine('sun', { kind: 'zone' }); } catch { refused = true; }
  if (!refused) fail('hourLine() accepts a zone with no city');

  // The time-zone fallback.
  const zones = parseZoneTab(d.zoneTab);
  const links = parseLinks(d.backward);
  if (zones.size < 400) fail(`zone.tab parsed to ${zones.size} zones; the 2026e file has 418`);
  for (const [z, at] of zones) {
    if (!(Math.abs(at.lat) <= 90 && Math.abs(at.lon) <= 180)) fail(`zone.tab: ${z} parsed to ${at.lat}, ${at.lon}`);
  }
  for (const [zone, city] of [['America/Los_Angeles', 'Los Angeles'], ['Asia/Calcutta', 'Kolkata'], ['US/Pacific', 'Los Angeles'], ['Europe/Oslo', 'Oslo'], ['Europe/Kiev', 'Kyiv']]) {
    const got = zonePlace(zone, zones, links)?.city;
    if (got !== city) fail(`the zone ${zone} resolves to ${got ?? 'nothing'}, not ${city}`);
  }
  if (zonePlace('Etc/UTC', zones, links)) fail('Etc/UTC resolved to a city; it has none and should fall to equal hours');

  // The policy that lets the browser ask at all, and no wider.
  const policy = d.htaccess.match(/Header always set Permissions-Policy "([^\n]*)"\s*$/m)?.[1] ?? '';
  const geo = policy.match(/geolocation=\(([^)]*)\)/)?.[1];
  if (geo !== 'self') fail(`Permissions-Policy grants geolocation=(${geo ?? 'missing'}); the bench needs exactly (self)`);

  if (problems.length) {
    log.push(`\nbench: ${problems.length} problem(s):`);
    for (const p of problems) log.push(`  ${p}`);
  } else {
    log.push(`ok: the week falls out of the Chaldean order; p. 128 gives Ripley's ${gates.length} gates and p. 127 agrees; ${assigned.length} sigils, each planet once, all as Unicode names them; sunrise and sunset within ${worst.toFixed(2)} min of USNO at ${d.usno.length} fixtures; ${tables} days of hours tile sunrise to sunrise; ${lines} hour lines; ${zones.size} zones; geolocation=(self)`);
  }
  return { ok: problems.length === 0, failures: problems.length, log };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log } = verifyBench();
  log.forEach(l => console.log(l));
  if (!ok) process.exit(1);
}
