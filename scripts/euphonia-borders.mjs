// Vendors the polities of 1668 from Seshat's Cliopatria (CC BY 4.0) into
// src/euphonia/euphonia.borders.json, with its provenance. A deliberate step,
// like euphonia-world, never part of the build:
//   node scripts/euphonia-borders.mjs <cliopatria.geojson.zip> <its unzipped .geojson>
//
// The book decides how the record is drawn. Each region's @borders line
// (euphonia.regions.json, from the master) gives every Cliopatria row drawn
// there its label in that region and its class: firm, zone, or replaced by
// one of the book's own shapes. An edge is a line only where two firm rows
// meet, unless an @edges line makes it a reach. Every other edge is a reach,
// drawn as Dutch colourists coloured boundaries, a band of wash along the
// inside, but with no engraved line under it: a country thinning out, not a
// surveyor's mark. Each @departs line is a shape the book draws where it
// departs from the record. Its sides are reaches or dashed lines, and a front
// is a contested ring, not a border. The record's own errors, which the book
// or history corrects, are in CORRECTIONS, each with its source. Only the
// inland edges are kept. Where an outline runs along the shore, the coast is
// already drawn.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { geoCircle } from 'd3-geo';
import { simplify, TOLERANCE } from './euphonia-world.mjs';
import { lookup } from '../src/euphonia/euphonia.places.js';

const OUT = new URL('../src/euphonia/euphonia.borders.json', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(`../src/euphonia/euphonia.${name}.json`, import.meta.url), 'utf8'));
export const YEAR = 1668;
const RELEASE = 'v0.2.1';
const RAD = Math.PI / 180;
const EARTH_KM = 6371;

// Where the record errs and the book or history says otherwise: a row's part
// at a place, dropped or given to the row that held it in 1668. A part is at
// a place when it holds it or comes within the record's shore band of it, as
// a coastal post's outline does. Or, where the gazetteer lacks the place or
// the book speaks of a coast as a whole, every part of the row in a country
// (wholly south of a place, where one is named): a part is in the country whose
// gazetteer place lies nearest it. Each quotes the book in
// a region, or cites a source where the book is silent.
export const CORRECTIONS = [
  { row: 'Kingdom of Portugal', at: { name: 'Muscat', country: 'Oman' }, to: null,
    region: 'Mutapa and the Indian Ocean', because: ["The Ya'rubi imams took Muscat from the Portuguese"] },
  { row: 'New Netherland', at: { name: 'New York', country: 'United States of America' }, to: 'English Colonial Empire',
    region: 'The Americas', because: ['The English hold New York (Dutch until 1664)'] },
  { row: 'Swedish Empire', at: { name: 'Cape Coast', country: 'Ghana' }, to: 'English Colonial Empire',
    region: 'West and Central Africa', because: ['Cape Coast Castle'] },
  // Kochi, Cannanore and Nagapattinam: the gazetteer has only the first, so
  // the book's sentence is taken as it reads, every port south of Goa.
  { row: 'Portuguese Colonies', within: { country: 'India', southOf: { name: 'Panaji', country: 'India' } }, to: 'Dutch Republic', region: 'India', because: ['The Dutch have the Portuguese ports in the south'] },
  // Dunkirk, England's one part in France, which the gazetteer doesn't have.
  { row: 'Kingdom of England', within: { country: 'France' }, to: 'Kingdom of France',
    source: { title: 'Dunkirk: sold by Charles II to France, 1662', url: 'https://en.wikipedia.org/wiki/Dunkirk' } },
  { row: 'English Colonial Empire', at: { name: 'Paramaribo', country: 'Suriname' }, to: 'New Netherland',
    source: { title: 'Treaty of Breda (1667): Suriname to the Dutch', url: 'https://en.wikipedia.org/wiki/Treaty_of_Breda_(1667)' } },
];

// Lon/lat as a plane, longitude shrunk by the cosine of latitude so that a
// step east and a step north are about as long: enough for the short reaches
// below, which are a few hundredths of a degree.
const east = lat => Math.cos(lat * RAD);
const signedArea = ring => ring.reduce((s, [x1, y1], i) => { const [x2, y2] = ring[(i + 1) % ring.length]; return s + (x1 * y2 - x2 * y1); }, 0) / 2;
const wound = (ring, anticlockwise) => ((signedArea(ring) > 0) === anticlockwise ? ring : [...ring].reverse());
// How far a polygon's nearest vertex lies from a point, on that plane.
export const nearestVertex = (poly, [px, py]) => Math.min(...poly[0].map(([x, y]) => Math.hypot((x - px) * east(py), y - py)));

// Ray casting northward, by columns of edges: a point is inside where an odd
// number of a set of rings' edges cross the meridian above it.
const COLUMN = 0.5;
function columns(rings) {
  const cols = new Map();
  for (const ring of rings) for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
    for (let c = Math.floor(Math.min(x1, x2) / COLUMN); c <= Math.floor(Math.max(x1, x2) / COLUMN); c++) {
      if (!cols.has(c)) cols.set(c, []);
      cols.get(c).push(x1, y1, x2, y2);
    }
  }
  return ([x, y]) => {
    const e = cols.get(Math.floor(x / COLUMN));
    let inside = false;
    if (e) for (let i = 0; i < e.length; i += 4) {
      const x1 = e[i], y1 = e[i + 1], x2 = e[i + 2], y2 = e[i + 3];
      if ((x1 > x) !== (x2 > x) && y < y1 + (y2 - y1) * (x - x1) / (x2 - x1)) inside = !inside;
    }
    return inside;
  };
}
const closed = ring => (ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring : [...ring, ring[0]]);

// An outline that follows the shore but stops short of Natural Earth's
// leaves a strip of land no polity holds, and its edge would read as a
// frontier. Marching out from each edge with nothing beyond it, the distance
// to the sea falls into two groups: a peak within a few hundredths of a degree
// (the two shorelines' disagreement) and, past a trough, the real frontiers.
// The threshold is the trough's floor, found in the histogram (`shore` in the
// provenance), in steps of the tolerance out to MARCH_DEG.
const MARCH_DEG = 1;

export function buildBorders(zipPath, geojsonPath) {
  const world = read('world'), regions = read('regions').data, gazetteer = read('gazetteer');
  const source = JSON.parse(readFileSync(geojsonPath, 'utf8'));
  const at = (p, where) => {
    const hit = lookup(gazetteer, p.modern ?? p.name, p.country, p.province);
    if (hit.error) throw new Error(`${where}: ${hit.error}`);
    return [hit.lon, hit.lat];
  };
  const onLand = columns(world.land);
  const rows = source.features.filter(f => f.properties.FromYear <= YEAR && YEAR <= f.properties.ToYear && !f.properties.Name.startsWith('('));
  const key = (name, qid) => `${name} (${qid})`;
  const rowKey = f => key(f.properties.Name, f.properties.Wikidata);

  // The book's classes: each row listed in every region it's drawn in, with
  // one class wherever it isn't replaced; every row drawn, listed.
  const listed = new Map();
  for (const r of regions) for (const b of r.borders) {
    const k = key(b.source, b.qid);
    if (!rows.some(f => rowKey(f) === k)) throw new Error(`${r.name}'s @borders lists ${k}, which Cliopatria doesn't draw in ${YEAR}`);
    if (!listed.has(k)) listed.set(k, []);
    listed.get(k).push({ region: r.name, label: b.label, cls: b.cls });
  }
  for (const f of rows) if (!listed.has(rowKey(f))) throw new Error(`no region's @borders lists ${rowKey(f)}`);
  const classOf = k => {
    const kinds = [...new Set(listed.get(k).map(l => l.cls).filter(c => c !== 'replaced'))];
    if (kinds.length > 1) throw new Error(`${k} is ${kinds.join(' and ')} in different regions`);
    return kinds[0] ?? 'replaced';
  };

  // Each row's polygons, outer rings anticlockwise (inside on the left) and
  // holes the other way.
  const parts = new Map(rows.map(f => [rowKey(f), (f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates])
    .map(poly => poly.map((ring, k) => wound(ring, k === 0)))]));
  const byName = name => {
    const ks = [...parts.keys()].filter(k => k.startsWith(`${name} (`));
    if (ks.length !== 1) throw new Error(`${ks.length} rows for ${YEAR} are named ${name}`);
    return ks[0];
  };

  // The shore band, from every record outline's edges with nothing beyond.
  const beyond = ([x1, y1], [x2, y2], d = TOLERANCE) => {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, k = east(my), dx = (x2 - x1) * k, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    return { mid: [mx, my], out: [mx + (dy / len) * d / k, my - (dx / len) * d] };
  };
  const toSea = (a, b) => {
    for (let d = TOLERANCE; d <= MARCH_DEG; d += TOLERANCE) if (!onLand(beyond(a, b, d).out)) return d;
    return Infinity;
  };
  const insideAll = () => [...parts.entries()].map(([k, polys]) => ({ k, inside: columns(polys.flat().map(closed)) }));
  let insiders = insideAll();
  const hist = new Array(Math.round(MARCH_DEG / TOLERANCE) + 1).fill(0);
  for (const [k, polys] of parts) for (const ring of polys.flat()) for (let i = 0; i < ring.length - 1; i++) {
    const { mid, out } = beyond(ring[i], ring[i + 1]);
    if (!onLand(mid) || !onLand(out) || insiders.some(q => q.k !== k && q.inside(out))) continue;
    const d = toSea(ring[i], ring[i + 1]);
    if (Number.isFinite(d)) hist[Math.round(d / TOLERANCE)]++;
  }
  const peak = hist.indexOf(Math.max(...hist));
  let floor = peak;
  while (floor + 1 < hist.length && hist[floor + 1] < hist[floor]) floor++;
  if (floor === peak || floor + 1 === hist.length) throw new Error(`no trough after the shore's peak: ${hist.join(' ')}`);
  const shore = floor * TOLERANCE;

  // A row's part at a place: the one that holds it, or else the one that
  // comes within the shore band of it; exactly one.
  const partAt = (k, place, where) => {
    const xy = at(place, where), polys = parts.get(k);
    const holding = polys.filter(p => columns(p.map(closed))(xy));
    const near = holding.length ? holding : polys.filter(p => nearestVertex(p, xy) <= shore);
    if (near.length !== 1) throw new Error(`${where}: ${near.length} parts of ${k} are at ${place.name}`);
    return near[0];
  };
  const take = (k, part) => parts.set(k, parts.get(k).filter(p => p !== part));

  // The country a part lies in: that of the gazetteer place nearest its
  // first vertex.
  const countryOf = part => {
    const [x, y] = part[0][0];
    let best = null;
    for (const g of gazetteer.places) { const d = Math.hypot((g[5] - x) * east(y), g[4] - y); if (!best || d < best.d) best = { d, country: g[3] }; }
    return best.country;
  };
  const km2 = part => Math.round(Math.abs(signedArea(part[0])) * (RAD * EARTH_KM) ** 2 * east(part[0][0][1]));
  // The record's errors, corrected.
  const corrected = CORRECTIONS.map(c => {
    const k = byName(c.row), where = `the correction of ${c.row}`;
    let moved;
    if (c.within) {
      const south = c.within.southOf ? at(c.within.southOf, where)[1] : Infinity;
      // Wholly south: Goa's own part reaches north of Panaji, and stays.
      moved = parts.get(k).filter(p => Math.max(...p[0].map(v => v[1])) < south && countryOf(p) === c.within.country);
      if (!moved.length) throw new Error(`${where}: no part of ${k} lies in ${c.within.country}${c.within.southOf ? ` south of ${c.within.southOf.name}` : ''}`);
    } else moved = [partAt(k, { name: c.at.name, modern: c.at.name, country: c.at.country }, where)];
    for (const part of moved) { take(k, part); if (c.to) parts.get(byName(c.to)).push(part); }
    return { ...c, parts: moved.length, km2: moved.reduce((n, p) => n + km2(p), 0) };
  });

  // The book's shapes: each ring through the places it names, and each side's
  // kind. A front is a ring of its radius about its place.
  const departs = regions.flatMap(r => r.departs.map(d => ({ ...d, region: r.name, star: sentence(r, d.star) })));
  const capOf = d => {
    const [lon, lat] = at(d.around, `${d.name}'s around`);
    // A point every PRECISION degrees round the circle: chords of 2° of a
    // 30 km circle stray a few metres from it.
    const PRECISION = 2;
    // d3 closes the circle only to rounding; shut exactly, as every other
    // ring here is, or simplifying it measures from two endpoints a
    // rounding apart and keeps nothing.
    const ring = geoCircle().center([lon, lat]).radius(d.radius_km / EARTH_KM / RAD).precision(PRECISION)().coordinates[0];
    return wound([...ring.slice(0, -1), ring[0]], true);
  };
  const fronts = departs.filter(d => d.cls === 'front').map(d => ({ ...d, ring: capOf(d) }));
  const shapes = departs.filter(d => d.cls !== 'front').map(d => {
    const anchors = d.ring.map(p => at(p, `${d.name}'s ring`));
    const outer = wound(closed(anchors), true);
    // A front inside a shape is cut from it, and stays the record's row's.
    const cut = fronts.filter(f => columns([outer])(f.ring[0]));
    return { ...d, anchors, polys: [[outer, ...cut.map(f => wound(f.ring, false))]], cut };
  });
  for (const s of shapes) {
    const r = s.replaces;
    if (!r) continue;
    const k = key(r.source, r.qid);
    if (!parts.has(k)) throw new Error(`${s.name} replaces ${k}, which isn't drawn`);
    if (r.part === 'at') take(k, partAt(k, r.at, `${s.name}'s replaces`));
    else {
      // The shape lies inside one of the row's parts: it becomes a hole
      // there, and a front cut from the shape goes back to the row.
      const outer = s.polys[0][0], holder = parts.get(k).find(p => outer.every(pt => columns(p.map(closed))(pt)));
      if (!holder) throw new Error(`${s.name} doesn't lie inside one part of ${k}`);
      holder.push(wound(outer, false));
      for (const f of s.cut) {
        if (!(r.except ?? '').toLowerCase().includes(f.name.toLowerCase())) throw new Error(`${s.name} cuts out ${f.name}, which its replaces doesn't except`);
        parts.get(k).push([f.ring]);
      }
    }
  }

  // Each row's parts, labelled by the region that lists them: where a row is
  // drawn in several regions, a part is the region's whose own places lie
  // nearest it. A part a region marks replaced is dropped.
  const regionPoints = new Map(regions.map(r => [r.name, [...r.places, ...r.names].map(p => at(p, `${r.name}'s places`))]));
  const polities = [];
  for (const [k, polys] of parts) {
    const lists = listed.get(k), kind = classOf(k) === 'firm' ? 'line' : 'reach';
    for (const poly of polys) {
      const home = lists.length === 1 ? lists[0] : lists.reduce((a, b) => {
        const d = l => Math.min(...regionPoints.get(l.region).map(xy => nearestVertex(poly, xy)));
        return d(b) < d(a) ? b : a;
      });
      if (home.cls === 'replaced') continue;
      const name = k.replace(/ \(Q\d+\)$/, ''), qid = /\((Q\d+)\)$/.exec(k)[1];
      let q = polities.find(x => x.name === name && x.label === home.label);
      if (!q) polities.push(q = { name, wikidata: qid, label: home.label, region: home.region, kind, polys: [] });
      q.polys.push(poly);
    }
  }
  for (const s of shapes) polities.push({ name: s.name, label: s.name, region: s.region, kind: 'departs', star: s.star, polys: s.polys,
    holds: (s.holds ?? []).map(p => ({ name: p.name, lonlat: at(p, `${s.name}'s holds`) })) });

  // The edges. A record row's edge is shore (dropped), a line between two firm
  // rows (kept once), or a reach on its own side; an @edges line makes a pair
  // of firm rows' edges reaches where it says. A shape's sides are as the book
  // gives them.
  insiders = polities.map(q => columns(q.polys.flat().map(closed)));
  const overrides = regions.flatMap(r => r.edges);
  const softened = (a, b, lat) => overrides.some(o => [a, b].every(q => o.rows.some(x => x.source === q.name && x.qid === q.wikidata)) && (o.north === undefined || lat > o.north));
  const lines = [], reaches = [], dashed = [], tally = { edges: 0, shore: 0, line: 0, reach: 0, frontier: 0, softened: 0 };
  const runner = () => {
    let run = null, runKind = null;
    const out = { line: lines, reach: reaches, dashed };
    return {
      step(kind, a, b) {
        if (kind !== runKind) { this.flush(); if (kind) { run = [a]; runKind = kind; } }
        if (kind) run.push(b);
      },
      flush() { if (run?.length > 1) out[runKind].push(run); run = null; runKind = null; },
    };
  };
  polities.forEach((q, ai) => {
    if (q.kind === 'departs') return;
    for (const ring of q.polys.flat()) {
      const r = runner();
      for (let i = 0; i < ring.length - 1; i++) {
        tally.edges++;
        const { mid, out } = beyond(ring[i], ring[i + 1]);
        const bi = insiders.findIndex((inside, k) => k !== ai && inside(out)), b = polities[bi];
        let kind = null;
        if (!onLand(mid) || (bi < 0 && (!onLand(out) || toSea(ring[i], ring[i + 1]) <= shore))) tally.shore++;
        else if (b && q.kind === 'line' && b.kind === 'line' && !softened(q, b, mid[1])) { if (ai < bi) kind = 'line'; }
        else { kind = 'reach'; if (!b) tally.frontier++; if (b?.kind === 'line' && q.kind === 'line') tally.softened++; }
        if (kind) tally[kind]++;
        r.step(kind, ring[i], ring[i + 1]);
      }
      r.flush();
    }
  });
  // A shape's sides, each run from place to place at the tolerance's step, so
  // the stretches over the sea can drop out as the record's shore does.
  for (const s of shapes) {
    const r = runner(), forward = signedArea(closed(s.anchors)) > 0;
    const sides = s.edges.flatMap(e => e.through.slice(1).map((p, i) => ({ kind: e.cls === 'firm' ? 'dashed' : 'reach', from: at(e.through[i], s.name), to: at(p, s.name) })));
    for (const side of forward ? sides : sides.reverse().map(x => ({ ...x, from: x.to, to: x.from }))) {
      const n = Math.max(1, Math.ceil(Math.hypot((side.to[0] - side.from[0]) * east(side.from[1]), side.to[1] - side.from[1]) / TOLERANCE));
      for (let i = 0; i < n; i++) {
        const a = [0, 1].map(j => side.from[j] + (side.to[j] - side.from[j]) * i / n), b = [0, 1].map(j => side.from[j] + (side.to[j] - side.from[j]) * (i + 1) / n);
        r.step(onLand([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]) ? side.kind : null, a, b);
      }
    }
    r.flush();
  }

  const ringsOut = polys => polys.map(poly => poly.map(simplify).filter(r => r.length > 3)).filter(p => p.length);
  const label = (p, where) => ({ name: p.name, lonlat: at(p, where) });
  return {
    provenance: {
      source: 'Cliopatria, Seshat Global History Databank (github.com/Seshat-Global-History-Databank/cliopatria), CC BY 4.0',
      licence: 'https://creativecommons.org/licenses/by/4.0/',
      cite: 'Bennett et al., Cliopatria, Scientific Data 12 (2025), doi:10.1038/s41597-025-04516-9',
      release: RELEASE,
      sha256: createHash('sha256').update(readFileSync(zipPath)).digest('hex'),
      fetched: '2026-11-15',
      year: YEAR,
      rows: rows.length,
      book: read('regions').provenance.sha256,
      changed: "the rows covering 1668, less the unions Cliopatria composes from them; classed, labelled and replaced as the book's @borders and @departs lines say; the corrections below; edges along the shore dropped; simplified as the coasts are",
      simplified: `Douglas–Peucker at ${TOLERANCE}°, as euphonia.world.json`,
      tolerance_deg: TOLERANCE,
      shore_deg: Number(shore.toFixed(4)),
      shore_histogram: hist,
      edges: tally,
      corrections: corrected,
    },
    polities: polities.map(({ polys, ...q }) => ({ ...q, polys: ringsOut(polys) })),
    lines: lines.map(simplify).filter(l => l.length > 1),
    reaches: reaches.map(simplify).filter(l => l.length > 1),
    dashed: dashed.map(simplify).filter(l => l.length > 1),
    fronts: fronts.map(f => ({ name: f.name, region: f.region, star: f.star, radius_km: f.radius_km, around: label(f.around, f.name), ring: f.ring })),
    // Names without lines: a shape's own (its tributaries), the peoples the
    // book names beside it, and the places fought over inside it.
    names: shapes.flatMap(s => [
      ...(s.labels ?? []).map(p => ({ ...label(p, s.name), of: s.name, kind: 'within' })),
      ...(s.beyond ?? []).map(p => ({ ...label(p, s.name), of: s.name, kind: 'beside' })),
      ...(s.contested ? [{ ...label(s.contested, s.name), of: s.name, kind: 'contested' }] : []),
    ]),
  };
}

// The ✦ sentence a shape's star opens, whole, from the region's prose: the
// exporter has checked that it's there once.
function sentence(region, star) {
  const text = region.sections.map(s => s.text).join('\n\n'), from = text.indexOf(`✦ ${star}`);
  if (from < 0) throw new Error(`${region.name}: no "✦ ${star}"`);
  const end = text.slice(from).search(/[.!?](\s|$)/);
  return text.slice(from, from + end + 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [zip, geojson] = process.argv.slice(2);
  if (!zip || !geojson) throw new Error('usage: node scripts/euphonia-borders.mjs <cliopatria.geojson.zip> <its unzipped .geojson>');
  const b = buildBorders(zip, geojson);
  writeFileSync(OUT, JSON.stringify(b));
  const pts = list => list.reduce((n, l) => n + l.length, 0);
  console.log(`euphonia.borders.json: ${readFileSync(OUT).length} bytes; ${b.polities.length} polities (${pts(b.polities.flatMap(q => q.polys.flat()))} points), lines ${b.lines.length} (${pts(b.lines)}), reaches ${b.reaches.length} (${pts(b.reaches)}), dashed ${b.dashed.length} (${pts(b.dashed)}), fronts ${b.fronts.length}, names ${b.names.length}; shore ${b.provenance.shore_deg}°; edges ${JSON.stringify(b.provenance.edges)}; corrections ${b.provenance.corrections.map(c => `${c.row} ${c.at ? `at ${c.at.name}` : `in ${c.within.country}${c.within.southOf ? ` south of ${c.within.southOf.name}` : ''}`}: ${c.parts} part(s), ${c.km2} km²`).join('; ')}`);
}
