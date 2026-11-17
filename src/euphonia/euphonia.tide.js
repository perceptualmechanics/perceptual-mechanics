// The Tide of the Hidden, as this map reads Euphonia's rule (The Setting,
// Running Euphonia, Running the Hidden, The Tide, vendored verbatim in
// euphonia.hidden.json). The rule is Scott's and authored; its inputs, the
// moon, the sun and each place's own date, are derived. The rule says:
//  - at the flood from the first quarter to the last, at the ebb from the
//    last quarter to the first;
//  - the dark half runs from 31 October to 1 May north of the equator and
//    from 1 May to 31 October south of it, the tropics following their
//    hemisphere; its first night is the autumn open night, its last the
//    spring open night.
// Scott's reading of 1 November 2026 settles the rest: a night runs from
// sunset to sunrise in the place's own calendar, so the dark half begins at
// sunset on its first night and ends at sunrise after its last; where the
// place's calendar is unknown, it is as the DM says.
// Pure; verify-euphonia-map holds it.
import { phases } from './euphonia.moon.js';
import { solarEvents } from '../bench/bench.sky.js';
import { christianMonthDay, localDay } from './euphonia.calendars.js';

const DAY_MS = 86400000;
// The dark half's first and last nights north of the equator, by their
// eves; south of it the two trade dates.
export const OCTOBER_EVE = { m: 10, d: 31 };
export const APRIL_EVE = { m: 4, d: 30 };

// At the flood from the first quarter to the last, at the ebb from the last
// to the first: everywhere at once. A quarter falls every 7.4 days or so, so
// the last 20 hold at least one of each.
export const tideAt = ms => (phases(ms - 20 * DAY_MS, ms).findLast(p => p.phase.endsWith('quarter')).phase === 'first quarter' ? 'flood' : 'ebb');

// The local day a place is keeping at an instant, counted as the rule's eves
// count it: from sunset, so after sunset on 31 October it is already
// 1 November. Null where the sun neither set nor rose in the last two days.
function eveningDay(ms, lat, lon) {
  const events = solarEvents(ms - 2 * DAY_MS, ms + 1, lat, lon).filter(e => e.t <= ms);
  const set = events.findLast(e => e.kind === 'set'), rise = events.findLast(e => e.kind === 'rise');
  if (!set || !rise) return null;
  const night = set.t > rise.t;
  return { night, sunset: set.t, after: night && localDay(set.t, lon) === localDay(ms, lon) };
}

// The half of the year and the open night at a place, by the reading above.
// half is 'dark' or 'light', or null where the map can't say; open names the
// open night it is ('autumn' or 'spring'), or null.
export function hiddenAt(ms, polity, seat) {
  const { lat, lon } = seat;
  const north = lat >= 0;
  const evening = eveningDay(ms, lat, lon);
  const known = polity && evening && christianMonthDay(ms, polity, seat);
  if (!known) return { half: null, open: null };
  // The day as the eves count it: tomorrow, between sunset and midnight.
  const day = evening.after ? christianMonthDay(ms + DAY_MS, polity, seat) : known;
  // An open night runs from the eve's sunset to the next sunrise.
  const eve = evening.night && christianMonthDay(evening.sunset, polity, seat);
  const on = date => eve && eve.m === date.m && eve.d === date.d;
  const open = on(north ? OCTOBER_EVE : APRIL_EVE) ? 'autumn' : on(north ? APRIL_EVE : OCTOBER_EVE) ? 'spring' : null;
  // North, every day from 1 November to 30 April as the eves count days;
  // south, 1 May to 31 October; and either way the spring open night, the
  // dark half's last.
  const winter = day.m >= 11 || day.m <= 4;
  return { half: open === 'spring' || winter === north ? 'dark' : 'light', open };
}
