// Where the hours are reckoned from: the visitor's own position when they have
// given it, otherwise the principal city of their time zone, otherwise the
// clock. Pure functions, so the build's gate can run them; the browser's side
// (permission, position, loading the zone table) is in bench.locate.js.
import { planetaryHours, equalHours, hourAt } from './bench.sky.js';

// zone.tab coordinates are ISO 6709: ±DDMM±DDDMM or ±DDMMSS±DDDMMSS.
export function parseIso6709(s) {
  const m = /^([+-])(\d{2})(\d{2})(\d{2})?([+-])(\d{3})(\d{2})(\d{2})?$/.exec(s);
  if (!m) return null;
  const deg = (sign, d, mm, ss = '0') => (sign === '-' ? -1 : 1) * (Number(d) + Number(mm) / 60 + Number(ss) / 3600);
  return { lat: deg(m[1], m[2], m[3], m[4]), lon: deg(m[5], m[6], m[7], m[8]) };
}

// "America/Argentina/Buenos_Aires" is Buenos Aires.
export const cityOf = zone => zone.split('/').pop().replace(/_/g, ' ');

export function parseZoneTab(text) {
  const zones = new Map();
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [, coords, zone] = line.split('\t');
    const at = coords && parseIso6709(coords);
    if (zone && at) zones.set(zone, { ...at, city: cityOf(zone) });
  }
  return zones;
}

// backward's "Link TARGET LINK-NAME" lines, as name -> target.
export function parseLinks(text) {
  const links = new Map();
  for (const line of text.split('\n')) {
    const f = line.split(/\s+/);
    if (f[0] === 'Link' && f[1] && f[2]) links.set(f[2], f[1]);
  }
  return links;
}

export function zonePlace(zone, zones, links) {
  let name = zone;
  for (let hops = 0; name && hops < 4; hops++) {
    const hit = zones.get(name);
    if (hit) return hit;
    name = links.get(name);
  }
  return null;
}

// The current hour and where it was reckoned from. Polar day or night has no
// sunrise to count from, so it falls to equal hours at that longitude and says so.
export function reckon(now, place) {
  if (place.kind === 'sky' || place.kind === 'zone') {
    const table = planetaryHours(now, place.lat, place.lon);
    if (table) return { hour: hourAt(table, now), provenance: place };
    return { hour: hourAt(equalHours(now, place.lon), now), provenance: { kind: 'polar' } };
  }
  return { hour: hourAt(equalHours(now), now), provenance: { kind: 'equal' } };
}
