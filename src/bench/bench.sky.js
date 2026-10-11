// Sunrise, sunset and the planetary hours, computed here rather than looked up.
// The solar position is NOAA's (the equations behind its Solar Calculator,
// after Meeus, Astronomical Algorithms); verify-bench holds the results to the
// US Naval Observatory's published times.
import { CHALDEAN, HOURS_PER_DAY } from './bench.text.js';

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const MINUTE_MS = 60000;
// The sun's upper limb on the horizon: 50 arcminutes of refraction and
// semidiameter below the geometric horizon.
const ZENITH = 90.833;

const julianCentury = ms => (ms / DAY_MS + 2440587.5 - 2451545) / 36525;

// Declination (degrees) and the equation of time (minutes) at an instant.
export function solarParams(ms) {
  const T = julianCentury(ms);
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T))
    + Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T)
    + Math.sin(3 * M * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const apparentLong = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const meanObliquity = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(obliquity * RAD) * Math.sin(apparentLong * RAD)) / RAD;
  const y = Math.tan(obliquity * RAD / 2) ** 2;
  const eqTime = 4 / RAD * (
    y * Math.sin(2 * L0 * RAD)
    - 2 * e * Math.sin(M * RAD)
    + 4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD)
    - 0.5 * y * y * Math.sin(4 * L0 * RAD)
    - 1.25 * e * e * Math.sin(2 * M * RAD));
  return { decl, eqTime };
}

// The rise or set nearest the solar noon of the UTC day starting at dayMs, or
// null when the sun does not cross the horizon. Refined twice at the event's
// own instant, since declination and the equation of time move during the day.
function crossing(dayMs, lat, lon, sign) {
  let t = dayMs + DAY_MS / 2;
  for (let i = 0; i < 3; i++) {
    const { decl, eqTime } = solarParams(t);
    const cosH = Math.cos(ZENITH * RAD) / (Math.cos(lat * RAD) * Math.cos(decl * RAD))
      - Math.tan(lat * RAD) * Math.tan(decl * RAD);
    if (cosH < -1 || cosH > 1) return null;
    const H = Math.acos(cosH) / RAD;
    t = dayMs + (720 - 4 * lon - eqTime + sign * 4 * H) * MINUTE_MS;
  }
  return t;
}

// Every sunrise and sunset whose instant falls in [fromMs, toMs).
export function solarEvents(fromMs, toMs, lat, lon) {
  const events = [];
  const first = Math.floor(fromMs / DAY_MS) * DAY_MS - DAY_MS;
  for (let d = first; d <= toMs + DAY_MS; d += DAY_MS) {
    const rise = crossing(d, lat, lon, -1);
    const set = crossing(d, lat, lon, +1);
    if (rise !== null && rise >= fromMs && rise < toMs) events.push({ kind: 'rise', t: rise });
    if (set !== null && set >= fromMs && set < toMs) events.push({ kind: 'set', t: set });
  }
  return events.sort((a, b) => a.t - b.t);
}

// A planetary day is named for the planet of its first hour; each day's ruler
// is HOURS_PER_DAY steps on from the last. Sunday is the Sun's.
export function dayRuler(weekday) {
  const sun = CHALDEAN.indexOf('sun');
  return CHALDEAN[(sun + weekday * HOURS_PER_DAY) % CHALDEAN.length];
}

export const rulerOfHour = (ruler, k) =>
  CHALDEAN[(CHALDEAN.indexOf(ruler) + k) % CHALDEAN.length];

// The weekday at a longitude by local mean solar time, so it does not depend on
// the clock the visitor's device happens to keep.
export const meanSolarWeekday = (ms, lon) => new Date(ms + lon / 15 * 3600000).getUTCDay();

// Twelve hours from sunrise to sunset and twelve from sunset to the next sunrise.
// Returns null where there is no such run today: polar day or polar night.
export function planetaryHours(now, lat, lon) {
  const events = solarEvents(now - 2 * DAY_MS, now + 2 * DAY_MS, lat, lon);
  const riseIdx = events.findLastIndex(e => e.kind === 'rise' && e.t <= now);
  if (riseIdx < 0) return null;
  const rise = events[riseIdx];
  const set = events[riseIdx + 1];
  const next = events[riseIdx + 2];
  if (!set || set.kind !== 'set' || !next || next.kind !== 'rise') return null;
  const ruler = dayRuler(meanSolarWeekday(rise.t, lon));
  return buildHours(ruler, rise.t, set.t, next.t);
}

// Equal hours, the day beginning at 06:00. With a longitude the clock is local
// mean solar time there; without one it is the device's own.
export function equalHours(now, lon = null) {
  const offsetMs = lon === null
    ? -new Date(now).getTimezoneOffset() * MINUTE_MS
    : lon / 15 * 3600000;
  const local = now + offsetMs;
  const sixAm = Math.floor((local - 6 * 3600000) / DAY_MS) * DAY_MS + 6 * 3600000;
  const start = sixAm - offsetMs;
  const ruler = dayRuler(new Date(sixAm).getUTCDay());
  return buildHours(ruler, start, start + DAY_MS / 2, start + DAY_MS);
}

function buildHours(ruler, rise, set, nextRise) {
  const day = (set - rise) / 12;
  const night = (nextRise - set) / 12;
  const hours = [];
  for (let k = 0; k < HOURS_PER_DAY; k++) {
    const start = k < 12 ? rise + k * day : set + (k - 12) * night;
    const end = k < 11 ? rise + (k + 1) * day : k === 11 ? set : k < 23 ? set + (k - 11) * night : nextRise;
    hours.push({ k, planet: rulerOfHour(ruler, k), start, end, daylight: k < 12 });
  }
  return { ruler, rise, set, nextRise, hours };
}

export const hourAt = (table, now) => table.hours.find(h => now >= h.start && now < h.end) ?? null;
