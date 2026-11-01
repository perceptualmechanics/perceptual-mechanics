// Vendors the coordinates of the seats euphonia.calendars.json names, from
// Natural Earth's populated places (public domain), into
// src/euphonia/euphonia.seats.json. A deliberate step, like euphonia-world:
//   node scripts/euphonia-seats.mjs <dir holding the unzipped NE folders>
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { readDbf } from './euphonia-world.mjs';

const LAYER = 'ne_10m_populated_places_simple';
const CALENDARS = new URL('../src/euphonia/euphonia.calendars.json', import.meta.url);
const OUT = new URL('../src/euphonia/euphonia.seats.json', import.meta.url);

const dir = process.argv[2];
if (!dir) throw new Error('usage: node scripts/euphonia-seats.mjs <dir of unzipped Natural Earth folders>');
const base = `${dir}/${LAYER}/${LAYER}`;
const dbf = readFileSync(`${base}.dbf`);
const places = readDbf(dbf);
const seats = {};
for (const { seat: [name, country] } of JSON.parse(readFileSync(CALENDARS, 'utf8')).polities) {
  const found = places.filter(p => p.name === name && p.adm0name === country);
  if (found.length !== 1) throw new Error(`Natural Earth has ${found.length} places named ${name} in ${country}`);
  seats[name] = { lat: found[0].latitude, lon: found[0].longitude };
}
writeFileSync(OUT, `${JSON.stringify({
  provenance: {
    source: 'Natural Earth (naturalearthdata.com), public domain',
    layer: LAYER,
    version: readFileSync(`${base}.VERSION.txt`, 'utf8').trim(),
    sha256: createHash('sha256').update(dbf).digest('hex'),
    fetched: '2026-11-01',
    note: 'Modern city points. A capital\'s point sits within a few kilometres of its 1668 seat, a few seconds of local time.',
  },
  seats,
}, null, 1)}\n`);
console.log(`euphonia.seats.json: ${Object.keys(seats).length} seats`);
