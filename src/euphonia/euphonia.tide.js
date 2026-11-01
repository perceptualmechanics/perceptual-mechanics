// The Tide of the Hidden, as this map reads Euphonia's rule ("The Hidden, in
// the rules", Book Three's introduction, vendored verbatim in
// euphonia.hidden.json). The rule is Scott's and authored; its inputs, the
// moon, the sun and each place's own date, are derived. The readings below
// are Scott's answers of 1 November 2026, where the rule says "the DM says":
//  - the open nights are the eves: sunset on 31 October to sunrise on
//    1 November, and 30 April into 1 May, in the place's own calendar;
//  - the tide is at the flood or the ebb, nothing between;
//  - between the tropics the dark half follows the sun: dark while it stands
//    overhead in the other hemisphere;
//  - outside them the halves turn on those eves, and only where the place's
//    calendar is known; elsewhere it is as the DM says.
// Pure; verify-euphonia-map holds it.
import { moonAt } from './euphonia.moon.js';
import { subsolar } from './euphonia.projection.js';
import { solarEvents } from '../bench/bench.sky.js';
import { christianMonthDay, localDay } from './euphonia.calendars.js';

const DAY_MS = 86400000;
export const SAMHAIN_EVE = { m: 10, d: 31 };
export const BELTANE_EVE = { m: 4, d: 30 };

// At the flood from the new moon to the full, at the ebb from the full to
// the new: everywhere at once.
export const tideAt = ms => (moonAt(ms).waxing ? 'flood' : 'ebb');

// The local day a place is keeping at an instant, counted as the rule's eves
// count it: from sunset, so after sunset on 31 October it is already
// Samhain. Null where the sun neither set nor rose in the last two days.
function eveningDay(ms, lat, lon) {
  const events = solarEvents(ms - 2 * DAY_MS, ms + 1, lat, lon).filter(e => e.t <= ms);
  const set = events.findLast(e => e.kind === 'set'), rise = events.findLast(e => e.kind === 'rise');
  if (!set || !rise) return null;
  const night = set.t > rise.t;
  return { night, sunset: set.t, after: night && localDay(set.t, lon) === localDay(ms, lon) };
}

// The half of the year and the open night at a place, by the reading above.
// half is 'dark' or 'other', or null where the map can't say; open names the
// open night it is ('Samhain' or 'Beltane'), or null.
export function hiddenAt(ms, polity, seat) {
  const { lat, lon } = seat;
  const sun = subsolar(ms);
  const north = lat >= 0;
  const evening = eveningDay(ms, lat, lon);
  const known = polity && evening && christianMonthDay(ms, polity, seat);
  // The day as the eves count it: tomorrow, between sunset and midnight.
  const day = known && (evening.after ? christianMonthDay(ms + DAY_MS, polity, seat) : known);
  // An open night runs from the eve's sunset to the next sunrise.
  const eve = known && evening.night && christianMonthDay(evening.sunset, polity, seat);
  const open = !eve ? null
    : eve.m === SAMHAIN_EVE.m && eve.d === SAMHAIN_EVE.d ? 'Samhain'
      : eve.m === BELTANE_EVE.m && eve.d === BELTANE_EVE.d ? 'Beltane' : null;
  let half = null;
  if (Math.abs(lat) < sun.obliquity) half = (sun.lat >= 0) !== north ? 'dark' : 'other';
  // North of the tropics the dark half is Samhain to Beltane: every day from
  // 1 November to 30 April, as the eves count days. South of them, reversed.
  else if (day) half = (day.m >= 11 || day.m <= 4) === north ? 'dark' : 'other';
  return { half, open };
}
