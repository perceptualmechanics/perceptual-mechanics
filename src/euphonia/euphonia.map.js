// The map of 1668, drawn in the page: two hemispheres from Natural Earth's
// coasts, with the night where it was at the chosen instant.
import worldUrl from './euphonia.world.json?url';
import {
  HEMISPHERES, DUSKS, project, subsolar, darkRegion,
  ringsIn, linesIn, coastOf, graticule, parallel,
} from './euphonia.projection.js';
import { moonAt } from './euphonia.moon.js';

const NS = 'http://www.w3.org/2000/svg';
const GRATICULE_STEP = 30;
// Unit-disc coordinates; four places is a twentieth of a pixel at the
// largest the discs are drawn.
const fmt = v => v.toFixed(4);

const el = (name, attrs, parent) => {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent.appendChild(e);
  return e;
};

// SVG's y runs down; the projection's runs up.
function pathOf(lines, lon0, close) {
  let d = '';
  for (const line of lines) {
    line.forEach(([lon, lat], i) => {
      const [X, Y] = project(lon, lat, lon0);
      d += `${i ? 'L' : 'M'}${fmt(X)},${fmt(-Y)}`;
    });
    if (close) d += 'Z';
  }
  return d;
}

// Chrome rasterises one long SVG arc loosely: a half circle of 731 pixels'
// radius strayed by 8.9 pixels, where the same circle in quarters stayed
// within 0.7, as close as a <circle>. So no arc here spans more than 90°.
const QUARTER = Math.PI / 2;
// The arc of radius r round (cx, cy) from angle `from` through a signed
// `span` (counter-clockwise positive, on the Y-up disc), as SVG commands.
// Counter-clockwise on the disc stays counter-clockwise on screen once y is
// flipped, and SVG draws that with sweep 0.
function arc(cx, cy, r, from, span) {
  const n = Math.max(1, Math.ceil(Math.abs(span) / QUARTER - 1e-9));
  let d = '';
  for (let k = 1; k <= n; k++) {
    const t = from + span * k / n;
    d += `A${fmt(r)},${fmt(r)} 0 0 ${span > 0 ? 0 : 1} ${fmt(cx + r * Math.cos(t))},${fmt(-(cy + r * Math.sin(t)))}`;
  }
  return d;
}
const circlePath = (cx, cy, r) => `M${fmt(cx + r)},${fmt(-cy)}${arc(cx, cy, r, 0, 2 * Math.PI)}Z`;
const RIM = circlePath(0, 0, 1);

const isDark = (g, X, Y) => g.line
  ? g.nx * X + g.ny * Y < g.c
  : (Math.hypot(X - g.cx, Y - g.cy) < g.r) === g.inside;

// The arc of a circle from angle a to angle b that passes through `want`'s
// side.
function arcTo(cx, cy, r, a, b, want) {
  const ccw = ((b - a) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const mid = a + ccw / 2;
  return arc(cx, cy, r, a, want(cx + r * Math.cos(mid), cy + r * Math.sin(mid)) ? ccw : ccw - 2 * Math.PI);
}

// The dark part of the disc, bounded by the dusk circle (or line) and the rim.
// Built from the two points where they cross, so a circle passing near the
// projection's far pole, with a radius of millions, is drawn by its ends and
// never by its centre.
function darkPath(g) {
  let pts;
  if (g.line) {
    const n = Math.hypot(g.nx, g.ny), dist = g.c / n;
    if (Math.abs(dist) >= 1) return isDark(g, 0, 0) ? RIM : '';
    const ux = g.nx / n, uy = g.ny / n, h = Math.sqrt(1 - dist * dist);
    pts = [[dist * ux - h * uy, dist * uy + h * ux], [dist * ux + h * uy, dist * uy - h * ux]];
  } else {
    const d = Math.hypot(g.cx, g.cy);
    if (d >= 1 + g.r) return g.inside ? '' : RIM;
    if (d <= Math.abs(g.r - 1)) {
      if (g.r < 1) return g.inside ? circlePath(g.cx, g.cy, g.r) : RIM + circlePath(g.cx, g.cy, g.r);
      return g.inside ? RIM : '';
    }
    const a = (1 - g.r * g.r + d * d) / (2 * d), h = Math.sqrt(1 - a * a);
    const px = a * g.cx / d, py = a * g.cy / d, ox = -g.cy / d * h, oy = g.cx / d * h;
    pts = [[px + ox, py + oy], [px - ox, py - oy]];
  }
  const [A, B] = pts;
  const inDisc = (X, Y) => Math.hypot(X, Y) < 1;
  const edge = g.line
    ? `L${fmt(B[0])},${fmt(-B[1])}`
    : arcTo(g.cx, g.cy, g.r, Math.atan2(A[1] - g.cy, A[0] - g.cx), Math.atan2(B[1] - g.cy, B[0] - g.cx), inDisc);
  const rim = arcTo(0, 0, 1, Math.atan2(B[1], B[0]), Math.atan2(A[1], A[0]), (X, Y) => isDark(g, X, Y));
  return `M${fmt(A[0])},${fmt(-A[1])}${edge}${rim}Z`;
}

function hemisphere(h, world, parent) {
  const svg = el('svg', { viewBox: '-1.08 -1.2 2.16 2.28', 'aria-hidden': 'true', focusable: 'false' }, parent);
  el('text', { class: 'map-name', x: 0, y: -1.1, 'text-anchor': 'middle' }, svg).textContent = h.name;
  el('path', { class: 'map-sea', d: RIM }, svg);
  el('path', { class: 'map-graticule', d: pathOf(graticule(h.lon0, GRATICULE_STEP), h.lon0, false) }, svg);
  const circles = el('path', { class: 'map-circles' }, svg);
  el('path', { class: 'map-land', d: pathOf(ringsIn(world.land, h.lon0), h.lon0, true) }, svg);
  el('path', { class: 'map-coast', d: pathOf(linesIn(world.land.flatMap(coastOf), h.lon0), h.lon0, false) }, svg);
  el('path', { class: 'map-river', d: pathOf(linesIn(world.rivers, h.lon0), h.lon0, false) }, svg);
  el('path', { class: 'map-lake', d: pathOf(ringsIn(world.lakes, h.lon0), h.lon0, true) }, svg);
  el('path', { class: 'map-lake historic', d: pathOf(ringsIn(world.historic.flatMap(l => l.parts), h.lon0), h.lon0, true) }, svg);
  const dark = DUSKS.map(() => el('path', { class: 'map-night', 'fill-rule': 'evenodd' }, svg));
  const sun = el('g', { class: 'map-sun' }, svg);
  el('circle', { r: 0.03 }, sun);
  el('circle', { class: 'dot', r: 0.007 }, sun);
  el('path', { class: 'map-rim', d: RIM }, svg);
  return { ...h, circles, dark, sun };
}

// The moon's face on a unit disc: the lit limb is a half circle and the
// terminator half an ellipse whose width is |1 − 2·lit|, bulging toward the
// lit limb while a crescent and away from it once gibbous. Drawn as seen from
// the north, lit on the right while waxing. At this size Chrome's looseness
// with half-circle arcs is under a hundredth of a pixel.
function facePath(lit, waxing) {
  const rx = Math.abs(1 - 2 * lit);
  const limb = `M0,-1A1,1 0 0 ${waxing ? 1 : 0} 0,1`;
  const crescentSweep = waxing ? 0 : 1;
  return `${limb}A${fmt(rx)},1 0 0 ${lit < 0.5 ? crescentSweep : 1 - crescentSweep} 0,-1Z`;
}

const two = n => String(n).padStart(2, '0');
const degrees = (v, pos, neg) => `${Math.abs(v).toFixed(1)}° ${v >= 0 ? pos : neg}`;

export async function initMap(figure) {
  const world = await (await fetch(worldUrl)).json();
  const holder = figure.querySelector('.map-hemispheres');
  const hemis = HEMISPHERES.map(h => hemisphere(h, world, holder));
  const form = figure.querySelector('form');
  const date = form.elements.date, time = form.elements.time;
  const shown = form.querySelector('output'), readout = figure.querySelector('.map-readout');
  const moonLine = figure.querySelector('.map-moon'), moonLit = moonLine.querySelector('.lit'), moonText = moonLine.querySelector('span');
  const day = ms => new Date(ms).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long' });
  const clock = ms => { const d = new Date(ms); return `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`; };

  // Today's month and day in the year that runs from Samhain 1668.
  const now = new Date();
  date.value = `${now.getMonth() >= 10 ? 1668 : 1669}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  time.value = now.getUTCHours() * 60 + now.getUTCMinutes();

  function draw() {
    const [y, m, d] = date.value.split('-').map(Number);
    const minutes = Number(time.value);
    const instant = Date.UTC(y, m - 1, d) + minutes * 60000;
    const sun = subsolar(instant);
    const moon = moonAt(instant);
    moonLit.setAttribute('d', facePath(moon.lit, moon.waxing));
    moonText.textContent = `The moon is ${moon.waxing ? 'waxing' : 'waning'}, ${moon.age.toFixed(1)} days from new and ${Math.round(moon.lit * 100)}% lit; the ${moon.next.phase} moon is on ${day(moon.next.ms)} at ${clock(moon.next.ms)} UT.`;
    for (const h of hemis) {
      DUSKS.forEach((dusk, k) => h.dark[k].setAttribute('d', darkPath(darkRegion(sun, dusk, h.lon0))));
      const eps = sun.obliquity;
      h.circles.setAttribute('d', pathOf([0, eps, -eps, 90 - eps, eps - 90].map(lat => parallel(h.lon0, lat)), h.lon0, false));
      const facing = Math.abs(((sun.lon - h.lon0 + 540) % 360) - 180) <= 90;
      h.sun.toggleAttribute('hidden', !facing);
      const [X, Y] = project(sun.lon, sun.lat, h.lon0);
      h.sun.setAttribute('transform', `translate(${fmt(X)},${fmt(-Y)})`);
    }
    shown.value = `${two(Math.floor(minutes / 60))}:${two(minutes % 60)}`;
    readout.textContent = `${date.valueAsDate.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })} (Gregorian), ${shown.value} UT: the sun stands overhead at ${degrees(sun.lat, 'N', 'S')}, ${degrees(sun.lon, 'E', 'W')}. The night side is shaded, darker through each twilight.`;
  }
  date.addEventListener('input', () => { if (date.value) draw(); });
  time.addEventListener('input', draw);
  draw();
  form.hidden = false;
  moonLine.hidden = false;
}

const figure = document.getElementById('map-figure');
if (figure) initMap(figure);
