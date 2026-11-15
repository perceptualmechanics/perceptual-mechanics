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

const RAD = Math.PI / 180;
const unit = ({ lat, lon }) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];
// The angle between two places, in degrees.
export const apart = (a, b) => Math.acos(Math.min(1, unit(a).reduce((s, v, i) => s + v * unit(b)[i], 0))) / RAD;

// A region as the book places it: a glow round each of its places, each
// reaching halfway to the place's nearest neighbour in the region so the
// glows meet and the region reads as one; its name at the places' mean. Two
// period names can stand at one modern site, so the neighbour is the
// nearest place somewhere else: at other coordinates, since one site is one
// gazetteer entry. (Measured, two at one site come out 4e-7° apart, not 0,
// and a circle that small isn't one.) The map draws it; verify-euphonia-map
// holds it.
export function regionShape(r) {
  const elsewhere = p => q => q.lat !== p.lat || q.lon !== p.lon;
  const glows = r.places.map(p => ({ ...p, rho: Math.min(...r.places.filter(elsewhere(p)).map(q => apart(p, q))) / 2 }));
  const [x, y, z] = r.places.map(unit).reduce((a, v) => a.map((s, i) => s + v[i]));
  const centre = { lat: Math.atan2(z, Math.hypot(x, y)) / RAD, lon: Math.atan2(y, x) / RAD };
  return { ...r, glows, centre, spread: Math.max(...r.places.map(p => apart(p, centre))) };
}

export const slug = name => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Every place the map needs, looked up once: the calendars' seats, by seat
// name; each region's places, with the name the book shows for each; and
// each person the book places (euphonia.people.json: a region's people and
// Notable People's sections), with where. errors lists any the gazetteer
// can't place exactly once.
export function resolvePlaces({ gazetteer, regions, calendars, people = { regions: [], notable: { blocks: [] } } }) {
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
    places: r.places.map(p => ({ name: p.name, modern: p.modern, country: p.country, ...at(r.name, p.modern, p.country, p.province) })),
    // The titles, rulers and powers its chapter names, each where it stands.
    names: (r.names ?? []).map(n => ({ name: n.name, modern: n.modern, country: n.country, ...at(`${r.name}'s ${n.name}`, n.modern, n.country, n.province) })),
    // The peoples it names, each lettered on its country.
    peoples: (r.peoples ?? []).map(n => ({ name: n.name, modern: n.modern, country: n.country, ...at(`${r.name}'s ${n.name}`, n.modern, n.country, n.province) })),
  }));
  const placedPeople = [
    ...people.regions.flatMap(r => r.people.filter(p => p.at).map(p => ({ name: p.name, region: slug(r.region), at: p.at }))),
    ...people.notable.blocks.filter(b => b.kind === 'heading' && b.at).map(b => ({ name: b.text, region: null, at: b.at })),
  ].map(({ name, region, at: where }) => ({ name, region, place: where.name, ...at(`${name}'s place`, where.modern, where.country, where.province) }));
  return { seats, regions: placed, people: placedPeople, errors };
}
