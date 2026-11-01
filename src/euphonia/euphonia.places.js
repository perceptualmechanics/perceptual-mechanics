// Looks a place up in the vendored gazetteer (Natural Earth's populated
// places) by its name and its country, as the book writes them. Pure; the
// build and verify-euphonia-map both use it, so a place the gazetteer can't
// find exactly once stops the build.

// Natural Earth carries a few invisible marks in its names (its two Granadas
// end in a left-to-right mark); they aren't part of any name a writer types.
const clean = s => s.normalize('NFC').replace(/[​-‏⁠﻿]/g, '').trim();

// The one gazetteer entry for `place` in `country` (and `province`, where the
// country has two of the name), matched against its name, its ASCII name and
// its other names: { lat, lon }, or { error } saying why not.
export function lookup({ places }, place, country, province = null) {
  const want = clean(place), land = clean(country);
  const found = places.filter(([name, ascii, alt, adm0, , , adm1]) =>
    clean(adm0) === land && (!province || clean(adm1) === clean(province)) && [name, ascii, ...alt].some(n => clean(n) === want));
  if (found.length === 1) return { lat: found[0][4], lon: found[0][5] };
  if (found.length > 1) return { error: `${found.length} places named ${place} in ${country}, in ${found.map(p => clean(p[6])).join(' and ')}: name the province` };
  const elsewhere = [...new Set(places.filter(([name, ascii, alt]) => [name, ascii, ...alt].some(n => clean(n) === want)).map(p => clean(p[3])))];
  return { error: elsewhere.length ? `${place} isn't in ${country} in Natural Earth; it has one in ${elsewhere.join(', ')}` : `Natural Earth has no place called ${place}` };
}

export const slug = name => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Every place the map needs, looked up once: the calendars' seats, by seat
// name, and each region's places, with the name the book shows for each.
// errors lists any the gazetteer can't place exactly once.
export function resolvePlaces({ gazetteer, regions, calendars }) {
  const errors = [];
  const at = (where, place, country, province) => {
    const found = lookup(gazetteer, place, country, province);
    if (found.error) errors.push(`${where}: ${found.error}`);
    return found;
  };
  const seats = Object.fromEntries(calendars.polities.map(p => [p.seat[0], at(`${p.name}'s seat`, ...p.seat)]));
  const placed = regions.map(r => ({
    name: r.name,
    id: slug(r.name),
    places: r.places.map(p => ({ name: p.name, ...at(r.name, p.modern, p.country, p.province) })),
  }));
  return { seats, regions: placed, errors };
}
