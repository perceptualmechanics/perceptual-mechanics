// The Reading's map, for its one pick: the coastlines the globe draws, thinned
// to what a flat map this size can show, and a mark at each region's centre.
// It stops short of Antarctica, where no one in the setting's regions starts.
import { geoEquirectangular, geoGraticule, geoPath } from 'd3-geo';
import { worldData } from './verify-euphonia-map.mjs';
import { regionShape } from '../src/euphonia/euphonia.places.js';

const WIDTH = 1000, TOP = 40, HEIGHT = 395, RISE = 20, MIN_POINTS = 8, SOUTH_LIMIT = -58, MIN_STEP = 1.6, WRAP = 400, EDGE = 18, GRID_DEG = 30;

export function readingMap(regions, world = worldData()) {
  const project = geoEquirectangular().scale(WIDTH / (2 * Math.PI)).translate([WIDTH / 2, WIDTH / 4 + RISE]);
  const land = world.land.filter(r => r.length >= MIN_POINTS && r.some(([, lat]) => lat > SOUTH_LIMIT)).map(ring => {
    let last = null, d = '';
    for (const p of ring) {
      const [x, y] = project(p);
      if (last && Math.hypot(x - last[0], y - last[1]) < MIN_STEP) continue;
      d += `${!d || (last && Math.abs(x - last[0]) > WRAP) ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      last = [x, y];
    }
    return `${d}Z`;
  }).join('');
  const pins = regions.map(r => { const { lon, lat } = regionShape(r).centre, [x, y] = project([lon, lat]); return { name: r.name, x: Math.min(WIDTH - EDGE, Math.round(x)), y: Math.round(y) }; });
  const grid = geoPath(project)(geoGraticule().step([GRID_DEG, GRID_DEG])()).replace(/(\.\d)\d+/g, '$1');
  return { viewBox: `0 ${TOP} ${WIDTH} ${HEIGHT}`, land, grid, pins };
}
