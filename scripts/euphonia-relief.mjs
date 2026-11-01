// Vendors the map's relief and ocean depths from NOAA's ETOPO5 (public
// domain): src/euphonia/euphonia.relief.bin, a quarter-degree grid of
// elevations averaged from ETOPO5's five-minute one, and euphonia.relief.json,
// its provenance and layout. A deliberate step, like euphonia-world:
//   node scripts/euphonia-relief.mjs <dir holding ETOPO5.DAT>
//
// A quarter degree: at the largest the discs are drawn, the rim spends about
// 13 device pixels a degree, so a cell is about three pixels and the shader's
// interpolation between cells is never seen as steps; five minutes would be
// nine times the bytes for detail the map can't show.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const OUT_BIN = new URL('../src/euphonia/euphonia.relief.bin', import.meta.url);
// Stored as a signed byte, the square root of the height with its sign, scaled
// so the deepest or highest cell is ±127: fine steps near sea level, where the
// shelf's 200 m edge needs them, coarse only at the extremes. Measured against
// the 16-bit means: at most 14.7 m off within 400 m of sea level, 69.8 m
// anywhere, at a third of the bytes (499 kB gzipped, against 1,578 kB).
const SCALE = 127;
const OUT_JSON = new URL('../src/euphonia/euphonia.relief.json', import.meta.url);
// ETOPO5: 2160 rows from 90°N southward and 4320 columns from 0° eastward,
// each the centre of a five-minute cell, big-endian 16-bit metres.
const ROWS = 2160, COLS = 4320, BLOCK = 3;

const dir = process.argv[2];
if (!dir) throw new Error('usage: node scripts/euphonia-relief.mjs <dir holding ETOPO5.DAT>');
const raw = readFileSync(`${dir}/ETOPO5.DAT`);
if (raw.length !== ROWS * COLS * 2) throw new Error(`ETOPO5.DAT is ${raw.length} bytes, not ${ROWS * COLS * 2}`);

const rows = ROWS / BLOCK, cols = COLS / BLOCK;
const grid = new Int16Array(rows * cols);
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) for (let j = 0; j < BLOCK; j++) sum += raw.readInt16BE(2 * ((r * BLOCK + i) * COLS + c * BLOCK + j));
  grid[r * cols + c] = Math.round(sum / (BLOCK * BLOCK));
}
let lo = Infinity, hi = -Infinity;
for (const v of grid) { if (v < lo) lo = v; if (v > hi) hi = v; }
const extreme = Math.max(-lo, hi), k = SCALE / Math.sqrt(extreme);
const bytes = Int8Array.from(grid, v => Math.round(Math.sign(v) * Math.sqrt(Math.abs(v)) * k));
writeFileSync(OUT_BIN, Buffer.from(bytes.buffer));

// How much the land's slopes are steepened for the hillshading: on a
// quarter-degree grid the Earth's slopes are a few in a thousand, too gentle
// for light to show, so they are scaled until the steepest hundredth of land
// slopes shades as 45°. Slopes by central differences, east–west cells
// narrowing with the cosine of latitude.
const METRES_PER_DEGREE = 6371000 * Math.PI / 180;
const decoded = i => { const b = bytes[i]; return b * Math.abs(b) * extreme / (SCALE * SCALE); };
const slopes = [];
for (let r = 1; r < rows - 1; r++) {
  const dy = 2 * (BLOCK / 12) * METRES_PER_DEGREE, dx = dy * Math.cos((90 - BLOCK / 24 - r * BLOCK / 12) * Math.PI / 180);
  for (let c = 0; c < cols; c++) {
    if (decoded(r * cols + c) <= 0) continue;
    const e = decoded(r * cols + (c + 1) % cols) - decoded(r * cols + (c + cols - 1) % cols);
    const n = decoded((r - 1) * cols + c) - decoded((r + 1) * cols + c);
    slopes.push(Math.hypot(e / dx, n / dy));
  }
}
slopes.sort((a, b) => a - b);
const steepest = slopes[Math.floor(slopes.length * 0.99)];
writeFileSync(OUT_JSON, `${JSON.stringify({
  provenance: {
    source: 'NOAA National Geophysical Data Center, ETOPO5 (1988), public domain',
    url: 'https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO5/TOPO/ETOPO5/ETOPO5.DAT',
    sha256: createHash('sha256').update(raw).digest('hex'),
    fetched: '2026-11-01',
    note: 'Five-minute resolution over the oceans, the U.S.A., western Europe, Japan and Australia; as coarse as one degree in data-deficient parts of Asia, South America, northern Canada and Africa. Superseded by later grids; enough for this map\'s scale.',
    reduced: `${BLOCK}×${BLOCK} means of five-minute cells`,
  },
  // Signed bytes, row by row from the northernmost, each row from 0°
  // eastward; each the mean over its quarter-degree cell, whose centre is at
  // (lat0 − row·step, lon0 + col·step). A byte b is b·|b|·extreme/127² metres.
  layout: { rows, cols, step: BLOCK / 12, lat0: 90 - BLOCK / 24, lon0: BLOCK / 24, encoding: 'int8-sqrt', scale: SCALE, extreme },
  range: { min: lo, max: hi },
  // The hillshading's vertical exaggeration, from the land's own slopes.
  shading: { steepest_percentile: 99, steepest_slope: steepest, exaggeration: 1 / steepest },
}, null, 1)}\n`);
console.log(`euphonia.relief.bin: ${rows}×${cols}, ${bytes.length} bytes, ${lo}…${hi} m; steepest 1% of land slopes ${steepest.toFixed(4)}, exaggeration ${(1 / steepest).toFixed(1)}`);
