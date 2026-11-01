// The same instant as each polity of 1668 dated it. Days are counted as Julian
// Day Numbers (the day whose noon is that integer Julian Date); each calendar
// is arithmetic on them. Pure; verify-euphonia-map holds the arithmetic to
// Fourmilab's converter and, for the Hijri dates, to ICU's.
import { solarParams, solarEvents } from '../bench/bench.sky.js';

const DAY_MS = 86400000;
const MINUTE_MS = 60000;
const JD_UNIX = 2440587.5;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const HIJRI_MONTHS = ['Muharram', 'Safar', 'Rabiʿ al-Awwal', 'Rabiʿ al-Thani', 'Jumada al-Ula', 'Jumada al-Akhira', 'Rajab', 'Shaʿban', 'Ramadan', 'Shawwal', 'Dhu al-Qaʿda', 'Dhu al-Hijja'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Fliegel and Van Flandern's day count, counted from March so the leap day
// falls last; the Julian calendar is the same without the century rule.
export function jdnFromGregorian(y, m, d) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
export function jdnFromJulian(y, m, d) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083;
}
// Their inverses, from the March-based year back to the calendar's.
function fromMarchDays(days) {
  const m5 = Math.floor((5 * days + 2) / 153);
  return { d: days - Math.floor((153 * m5 + 2) / 5) + 1, m: m5 < 10 ? m5 + 3 : m5 - 9, carry: m5 < 10 ? 0 : 1 };
}
export function gregorianFromJdn(jdn) {
  const a = jdn + 32044, c = Math.floor((4 * a + 3) / 146097), b = a - Math.floor(146097 * c / 4);
  const y4 = Math.floor((4 * b + 3) / 1461), { d, m, carry } = fromMarchDays(b - Math.floor(1461 * y4 / 4));
  return { y: 100 * c + y4 - 4800 + carry, m, d };
}
export function julianFromJdn(jdn) {
  const b = jdn + 32082, y4 = Math.floor((4 * b + 3) / 1461), { d, m, carry } = fromMarchDays(b - Math.floor(1461 * y4 / 4));
  return { y: y4 - 4800 + carry, m, d };
}

// The tabular Hijri calendar: 30-year cycles of 10,631 days with leap years
// 2, 5, 7, 10, 13, 16, 18, 21, 24, 26 and 29, months of 30 and 29 days in turn
// and a 30th day for the last in a leap year, counted from the civil epoch,
// Friday 16 July 622 (Julian).
const HIJRI_EPOCH = jdnFromJulian(622, 7, 16);
const CYCLE_DAYS = 10631;
export const hijriLeap = y => (14 + 11 * y) % 30 < 11;
export function hijriFromJdn(jdn) {
  const days = jdn - HIJRI_EPOCH;
  const cycles = Math.floor(days / CYCLE_DAYS);
  let rest = days - cycles * CYCLE_DAYS, y = cycles * 30 + 1;
  while (rest >= (hijriLeap(y) ? 355 : 354)) rest -= hijriLeap(y++) ? 355 : 354;
  let m = 1;
  for (;;) {
    const len = m % 2 ? 30 : m === 12 && hijriLeap(y) ? 30 : 29;
    if (rest < len) return { y, m, d: rest + 1 };
    rest -= len;
    m++;
  }
}

// The Byzantine era Muscovy counted in: years from Creation, each beginning on
// 1 September, year one running from 1 September 5509 BC.
export const annoMundi = ({ y, m }) => y + (m >= 9 ? 5509 : 5508);

// The day a place was in at an instant, by its own sundials: local apparent
// solar time, from the longitude and the equation of time.
export function localDay(ms, lon) {
  const minutes = ms / MINUTE_MS + 4 * lon + solarParams(ms).eqTime;
  return Math.floor(minutes / 1440 + JD_UNIX + 0.5);
}

// The Hijri day begins at sunset, the evening before the civil day it shares
// a date with.
function hijriDay(ms, lat, lon) {
  const civil = localDay(ms, lon);
  const sets = solarEvents(ms - DAY_MS, ms + DAY_MS, lat, lon).filter(e => e.kind === 'set');
  const after = sets.some(e => e.t <= ms && localDay(e.t, lon) === civil);
  return civil + (after ? 1 : 0);
}

// A polity's month and day at an instant in its own Christian calendar, or
// null where it kept another (the Hijri has no 1 November).
export function christianMonthDay(ms, polity, seat) {
  if (polity.calendar === 'hijri-tabular') return null;
  const jdn = localDay(ms, seat.lon);
  const { m, d } = polity.calendar === 'gregorian' ? gregorianFromJdn(jdn) : julianFromJdn(jdn);
  return { m, d };
}

// How each polity dated the instant, grouped where they wrote the same thing
// and `also` (anything else said of each) agrees.
export function datesAt(ms, { calendars, polities }, seats, also = () => '') {
  const rows = new Map();
  for (const p of polities) {
    const { lat, lon } = seats[p.seat[0]];
    let text;
    if (p.calendar === 'hijri-tabular') {
      const { y, m, d } = hijriFromJdn(hijriDay(ms, lat, lon));
      text = `${d} ${HIJRI_MONTHS[m - 1]} ${y}`;
    } else {
      const jdn = localDay(ms, lon);
      const weekday = WEEKDAYS[(jdn + 1) % 7];
      const date = p.calendar === 'gregorian' ? gregorianFromJdn(jdn) : julianFromJdn(jdn);
      let year = p.calendar === 'anno-mundi' ? annoMundi(date) : date.y;
      // A year that began on Lady Day was still the old one until 25 March;
      // the period wrote the overlap as 1668/9.
      if (p.year_starts && (date.m < p.year_starts[0] || (date.m === p.year_starts[0] && date.d < p.year_starts[1]))) {
        year = `${date.y - 1}/${String(date.y).slice(-1)}`;
      }
      text = `${weekday} ${date.d} ${MONTHS[date.m - 1]} ${year}`;
    }
    const extra = also(p, seats[p.seat[0]]);
    const key = `${p.calendar}|${text}|${extra}`;
    if (!rows.has(key)) rows.set(key, { calendar: calendars[p.calendar].name, date: text, also: extra, polities: [] });
    rows.get(key).polities.push(p.name);
  }
  return [...rows.values()];
}
