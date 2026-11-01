// Vendors Natural Earth's populated places (public domain) as the gazetteer
// the map looks its places up in: the calendars' seats and the regions'
// places. A deliberate step, like euphonia-world:
//   node scripts/euphonia-gazetteer.mjs <dir holding the unzipped NE folders>
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { readDbf } from './euphonia-world.mjs';

const LAYER = 'ne_10m_populated_places_simple';
const OUT = new URL('../src/euphonia/euphonia.gazetteer.json', import.meta.url);

const dir = process.argv[2];
if (!dir) throw new Error('usage: node scripts/euphonia-gazetteer.mjs <dir of unzipped Natural Earth folders>');
const base = `${dir}/${LAYER}/${LAYER}`;
const dbf = readFileSync(`${base}.dbf`);
// Each place as [name, ascii name, other names, country, latitude, longitude,
// province],
// as Natural Earth spells them; the lookup does any cleaning.
const places = readDbf(dbf).map(p => [p.name, p.nameascii, p.namealt ? p.namealt.split('|') : [], p.adm0name, p.latitude, p.longitude, p.adm1name]);
writeFileSync(OUT, `${JSON.stringify({
  provenance: {
    source: 'Natural Earth (naturalearthdata.com), public domain',
    layer: LAYER,
    version: readFileSync(`${base}.VERSION.txt`, 'utf8').trim(),
    sha256: createHash('sha256').update(dbf).digest('hex'),
    fetched: '2026-11-01',
    columns: ['name', 'nameascii', 'namealt', 'adm0name', 'latitude', 'longitude', 'adm1name'],
    note: 'Modern towns and cities. Where a place of 1668 has no entry, the book names a modern stand-in and says so.',
  },
  places,
})}\n`);
console.log(`euphonia.gazetteer.json: ${places.length} places, ${readFileSync(OUT).length} bytes`);
