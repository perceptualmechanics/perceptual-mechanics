// Vendors the map's geometry from Natural Earth (public domain) into
// src/euphonia/euphonia.world.json, with its provenance. A deliberate step,
// like the tzdb refresh, never part of the build:
//   node scripts/euphonia-world.mjs <dir holding the unzipped NE folders>
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = new URL('../src/euphonia/euphonia.world.json', import.meta.url);
const LAYERS = {
  land: 'ne_50m_land',
  lakes: 'ne_50m_lakes',
  historic: 'ne_10m_lakes_historic',
  rivers: 'ne_50m_rivers_lake_centerlines',
};
// Natural Earth's modern outlines of the lakes it also has historic outlines
// for. Each must have a historic counterpart; the gate holds that.
export const REPLACED = { 'Lake Chad': 'Lake Chad', 'North Aral Sea': 'Aral Sea', 'South Aral Sea': 'Aral Sea' };
// The largest rivers only: Natural Earth ranks them 0 (most important) to 12.
const RIVER_RANK = 5;
// Douglas–Peucker tolerance in degrees. At 1440px wide each disc is about
// 750 device pixels across and its rim, where stereographic scale doubles,
// spends about 13 device pixels per degree, so 0.03° is under half a pixel.
export const TOLERANCE = 0.03;
const PLACES = 2;

export function readDbf(buf) {
  const n = buf.readUInt32LE(4), hlen = buf.readUInt16LE(8), rlen = buf.readUInt16LE(10);
  const fields = [];
  for (let p = 32; buf[p] !== 0x0d; p += 32) {
    fields.push({ name: buf.toString('latin1', p, p + 11).replace(/\0.*$/s, ''), type: String.fromCharCode(buf[p + 11]), size: buf[p + 16] });
  }
  const rows = [];
  for (let r = 0; r < n; r++) {
    let pos = hlen + r * rlen + 1;
    const row = {};
    for (const f of fields) {
      const raw = buf.toString('utf8', pos, pos + f.size).trim();
      pos += f.size;
      row[f.name] = 'NF'.includes(f.type) ? (raw === '' ? null : Number(raw)) : raw;
    }
    rows.push(row);
  }
  return rows;
}

// Polygons (type 5) and polylines (type 3), as arrays of parts of [lon, lat].
function readShp(buf) {
  const shapes = [];
  for (let pos = 100; pos < buf.length;) {
    const len = buf.readUInt32BE(pos + 4) * 2, body = pos + 8;
    pos = body + len;
    const type = buf.readInt32LE(body);
    if (type === 0) { shapes.push([]); continue; }
    if (type !== 3 && type !== 5) throw new Error(`shape type ${type} isn't handled`);
    const nParts = buf.readInt32LE(body + 36), nPoints = buf.readInt32LE(body + 40);
    const starts = Array.from({ length: nParts }, (_, k) => buf.readInt32LE(body + 44 + 4 * k)).concat(nPoints);
    const at = i => [buf.readDoubleLE(body + 44 + 4 * nParts + 16 * i), buf.readDoubleLE(body + 52 + 4 * nParts + 16 * i)];
    shapes.push(starts.slice(0, -1).map((s, k) => Array.from({ length: starts[k + 1] - s }, (_, i) => at(s + i))));
  }
  return shapes;
}

export function simplify(pts) {
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    let worst = -1, far = 0;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const dist = len ? Math.abs(dy * px - dx * py + bx * ay - by * ax) / len : Math.hypot(px - ax, py - ay);
      if (dist > far) { far = dist; worst = i; }
    }
    if (far > TOLERANCE) { keep[worst] = 1; stack.push([a, worst], [worst, b]); }
  }
  const round = v => Number(v.toFixed(PLACES));
  return pts.filter((_, i) => keep[i]).map(([x, y]) => [round(x), round(y)]);
}

// A closed ring keeps its seams (the ±180° meridian and the pole, which the
// map must not stroke as coast), so simplification runs between them, never
// across: each seam vertex is pinned.
function simplifyRing(ring) {
  const pinned = ring.map(([x, y], i) => i === 0 || i === ring.length - 1 || Math.abs(x) === 180 || y === -90);
  const out = [];
  let from = 0;
  for (let i = 1; i < ring.length; i++) {
    if (!pinned[i]) continue;
    const piece = simplify(ring.slice(from, i + 1));
    out.push(...(out.length ? piece.slice(1) : piece));
    from = i;
  }
  return out;
}

function layer(dir, name) {
  const base = `${dir}/${name}/${name}`;
  const shp = readFileSync(`${base}.shp`), dbf = readFileSync(`${base}.dbf`);
  const shapes = readShp(shp), rows = readDbf(dbf);
  if (shapes.length !== rows.length) throw new Error(`${name}: ${shapes.length} shapes but ${rows.length} rows`);
  return {
    file: { layer: name, version: readFileSync(`${base}.VERSION.txt`, 'utf8').trim(), sha256: createHash('sha256').update(shp).digest('hex') },
    records: shapes.map((parts, i) => ({ props: rows[i], parts })),
  };
}

export function buildWorld(dir) {
  const L = Object.fromEntries(Object.entries(LAYERS).map(([k, name]) => [k, layer(dir, name)]));
  const rings = recs => recs.flatMap(r => r.parts).map(simplifyRing).filter(r => r.length > 3);
  return {
    provenance: {
      source: 'Natural Earth (naturalearthdata.com), public domain',
      fetched: '2026-11-01',
      files: Object.values(L).map(l => l.file),
      simplified: `Douglas–Peucker at ${TOLERANCE}°, rounded to ${PLACES} decimal places`,
      tolerance_deg: TOLERANCE,
      replaced: REPLACED,
      river_rank: RIVER_RANK,
    },
    land: rings(L.land.records),
    lakes: rings(L.lakes.records.filter(r => !(r.props.name in REPLACED))),
    historic: L.historic.records.map(r => ({ name: r.props.name, date: r.props.date, parts: rings([r]) })),
    rivers: L.rivers.records
      .filter(r => r.props.featurecla === 'River' && r.props.scalerank <= RIVER_RANK)
      .flatMap(r => r.parts).map(simplify).filter(r => r.length > 1),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (!dir) throw new Error('usage: node scripts/euphonia-world.mjs <dir of unzipped Natural Earth folders>');
  const world = buildWorld(dir);
  writeFileSync(OUT, JSON.stringify(world));
  const pts = k => world[k].reduce((n, r) => n + r.length, 0);
  console.log(`euphonia.world.json: ${readFileSync(OUT).length} bytes; land ${world.land.length} rings (${pts('land')} points), lakes ${world.lakes.length}, historic ${world.historic.length}, rivers ${world.rivers.length} (${pts('rivers')} points)`);
}
