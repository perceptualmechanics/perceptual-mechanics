// Draws the globe of 1668 and its mount onto a canvas. The geometry is
// d3-geo's through euphonia.globe.js and the mount's through
// euphonia.mount.js; this is only how it reaches pixels. A view is the point
// of the globe at its centre (lon0, lat0), north's turn on the page (roll,
// degrees clockwise), the globe's radius (k) and centre (cx, cy) and the
// canvas's size (width, height), all in canvas pixels.
import { geoPath } from 'd3-geo';
import { projectionFor, faces, capOf, ellipseOf } from './euphonia.globe.js';
import { EYE, MERIDIAN, HORIZON, SIGNS, MONTHS, EAST } from './euphonia.mount.js';

const RAD = Math.PI / 180;
const sinE = Math.sin(EYE * RAD), cosE = Math.cos(EYE * RAD);

// The canvas pixel of a point on the unit disc (the globe's limb at radius
// 1, Y up, north up), turned by the roll; and back.
export function toScreen(view, X, Y) {
  const c = Math.cos(view.roll * RAD), s = Math.sin(view.roll * RAD);
  return [view.cx + (X * c + Y * s) * view.k, view.cy - (-X * s + Y * c) * view.k];
}
export function fromScreen(view, x, y) {
  const c = Math.cos(view.roll * RAD), s = Math.sin(view.roll * RAD);
  const Xr = (x - view.cx) / view.k, Yr = (view.cy - y) / view.k;
  return [Xr * c - Yr * s, Xr * s + Yr * c];
}

// Everything on the globe is drawn inside its limb.
function clipToGlobe(ctx, view) {
  ctx.beginPath(); ctx.arc(view.cx, view.cy, view.k, 0, 2 * Math.PI); ctx.clip();
}

// The colours are the page's, read from its custom properties once.
export function palette(el) {
  const css = getComputedStyle(el);
  const v = name => css.getPropertyValue(`--map-${name}`).trim();
  return Object.fromEntries(['sea', 'graticule', 'circles', 'land', 'coast', 'river', 'lake', 'historic', 'glow', 'glow-lit', 'sun', 'rim',
    'waterline', 'relief-shelf', 'relief-abyss', 'relief-land', 'relief-lit', 'relief-shade', 'rhumb', 'rose',
    'brass', 'brass-edge', 'wood', 'wood-edge', 'paper', 'ink']
    .map(n => [n, v(n)]));
}

// Water-lining, as the period's engravers drew the sea: lines following every
// coast outward, each a gap further than the last from the one before (1, 2,
// 3… gaps), fainter as they go. Each is an exact offset of the coast, cut as
// the rim of a stroke one line-width narrower than the stroke under it.
// dpr scales line widths, which are in CSS pixels.
const WATERLINES = 5, WATERLINE_GAP = 1.5, WATERLINE_WIDTH = 0.6;
let waterCanvas = null;
function waterLines(view, world, colors, dpr) {
  waterCanvas ??= document.createElement('canvas');
  if (waterCanvas.width !== view.width || waterCanvas.height !== view.height) { waterCanvas.width = view.width; waterCanvas.height = view.height; }
  const ctx = waterCanvas.getContext('2d');
  ctx.clearRect(0, 0, view.width, view.height);
  ctx.lineJoin = ctx.lineCap = 'round';
  ctx.beginPath(); geoPath(projectionFor(view), ctx)(world.coast);
  for (let k = WATERLINES; k >= 1; k--) {
    const offset = WATERLINE_GAP * k * (k + 1) / 2 * dpr;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1 - (k - 1) / WATERLINES;
    ctx.strokeStyle = colors.waterline; ctx.lineWidth = 2 * offset; ctx.stroke();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2 * offset - 2 * WATERLINE_WIDTH * dpr; ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  return waterCanvas;
}

// The layers that change only with the view: the fills (sea, land, lakes)
// and the lines (graticule, coasts, rivers, shores, rhumbs). relief, when the
// page has it, draws the sea's depths or the land's relief for this view
// (euphonia.relief.js); without it, the fills are flat.
export function drawFills(ctx, view, world, colors, dpr, relief) {
  const path = geoPath(projectionFor(view), ctx);
  ctx.clearRect(0, 0, view.width, view.height);
  ctx.save();
  clipToGlobe(ctx, view);
  if (relief) ctx.drawImage(relief(view, 'sea'), 0, 0);
  else { ctx.fillStyle = colors.sea; ctx.fillRect(0, 0, view.width, view.height); }
  ctx.drawImage(waterLines(view, world, colors, dpr), 0, 0);
  ctx.save();
  ctx.beginPath(); path(world.land); ctx.clip();
  if (relief) ctx.drawImage(relief(view, 'land'), 0, 0);
  else { ctx.fillStyle = colors.land; ctx.fillRect(0, 0, view.width, view.height); }
  ctx.restore();
  ctx.fillStyle = colors.sea;
  ctx.beginPath(); path(world.lakes); ctx.fill();
  ctx.beginPath(); path(world.historic); ctx.fill();
  ctx.restore();
}
export function drawLines(ctx, view, world, colors, dpr) {
  const path = geoPath(projectionFor(view), ctx);
  const stroke = (layer, color, width) => { ctx.beginPath(); path(layer); ctx.strokeStyle = color; ctx.lineWidth = width * dpr; ctx.stroke(); };
  ctx.clearRect(0, 0, view.width, view.height);
  ctx.save();
  clipToGlobe(ctx, view);
  ctx.lineJoin = 'round';
  stroke(world.graticule, colors.graticule, 0.5);
  stroke(world.coast, colors.coast, 0.7);
  stroke(world.rivers, colors.river, 0.7);
  stroke(world.lakes, colors.circles, 0.5);
  ctx.setLineDash([3 * dpr, 2 * dpr]); stroke(world.historic, colors.historic, 0.5); ctx.setLineDash([]);
  // The roses' rhumb lines, and at each pole an eight-pointed star, its
  // north point to the globe's north.
  stroke(world.roseRest, colors.rhumb, 0.4);
  stroke(world.roseMain, colors.rhumb, 0.8);
  ctx.fillStyle = colors.rose;
  const project = projectionFor(view);
  for (const c of world.roseCentres) {
    if (!faces(view, c)) continue;
    const [x, y] = project([c.lon, c.lat]), long = ROSE_STAR * dpr, short = long * 0.3;
    ctx.beginPath();
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8 + view.roll * RAD, r = k % 4 === 0 ? long : k % 2 === 0 ? long * 0.6 : short;
      ctx[k ? 'lineTo' : 'moveTo'](x + r * Math.sin(a), y - r * Math.cos(a));
    }
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// A rose's star, its longest points, in CSS pixels.
const ROSE_STAR = 11;

// Over the lines: the tropics and polar circles, the book's regions and
// their places, the picked place, and the limb over all. obliquity places
// the tropics and polar circles for the moment shown.
export function drawMarks(ctx, view, { obliquity, regions, hoverPlace, pick }, colors, dpr) {
  const project = projectionFor(view), path = geoPath(project, ctx);
  const at = p => (faces(view, p) ? project([p.lon, p.lat]) : null);
  ctx.save();
  clipToGlobe(ctx, view);
  ctx.beginPath();
  path({ type: 'MultiLineString', coordinates: [0, obliquity, -obliquity, 90 - obliquity, obliquity - 90].map(lat => Array.from({ length: 181 }, (_, k) => [-180 + 2 * k, lat])) });
  ctx.strokeStyle = colors.circles; ctx.lineWidth = 0.7 * dpr; ctx.stroke();
  // The book's regions, a glow round each place: drawn in the ellipse the
  // place's circle makes on the page, and only on its facing part.
  for (const r of regions) for (const p of r.glows) {
    const e = ellipseOf(p, p.rho, view);
    if (!e) continue;
    ctx.save();
    ctx.beginPath(); path(capOf(p, p.rho)); ctx.clip();
    const [x, y] = toScreen(view, e.cx, e.cy);
    ctx.translate(x, y); ctx.rotate(view.roll * RAD - e.along); ctx.scale(Math.max(e.minor / e.major, 1e-3), 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, e.major * view.k);
    g.addColorStop(0, r.lit ? colors['glow-lit'] : colors.glow);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, e.major * view.k, 0, 2 * Math.PI); ctx.fill();
    ctx.restore();
  }
  // A lit region's places, each a dot at its exact point; the place under
  // the pointer, a ring round it.
  ctx.fillStyle = ctx.strokeStyle = colors.sun;
  for (const r of regions) if (r.lit) for (const p of r.glows) {
    const xy = at(p);
    if (!xy) continue;
    ctx.beginPath(); ctx.arc(...xy, 2.5 * dpr, 0, 2 * Math.PI); ctx.fill();
  }
  const ring = hoverPlace && at(hoverPlace);
  if (ring) { ctx.lineWidth = 1.5 * dpr; ctx.beginPath(); ctx.arc(...ring, 7 * dpr, 0, 2 * Math.PI); ctx.stroke(); }
  // The place the reader picked: a cross, open at its centre.
  const cross = pick && at(pick);
  if (cross) {
    const [x, y] = cross, a = 3 * dpr, b = 9 * dpr;
    ctx.lineWidth = 1.5 * dpr; ctx.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(x + dx * a, y + dy * a); ctx.lineTo(x + dx * b, y + dy * b); }
    ctx.stroke();
  }
  ctx.restore();
  // The limb.
  ctx.beginPath(); ctx.arc(view.cx, view.cy, view.k, 0, 2 * Math.PI);
  ctx.strokeStyle = colors.rim; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
}

// The mount, in two passes about the globe: 'back' before it (the meridian
// ring's lower half and the horizon's far half, which the globe hides where
// it's in front of them) and 'front' after it (the ring's upper half and the
// horizon's near half, which stand before it). setting turns the ring's
// degrees with the globe's axis; calendar is the year's days
// (euphonia.mount.js's calendarOf), today the azimuth of the sun's place.
//
// Each ring is drawn in its own plane, through a transform that carries the
// plane to the page: the meridian ring's (X, −Y) and the horizon's (X, Z),
// foreshortened by the eye's height, so lettering lies on the wood and the
// brass as it would.
const TURN = 2 * Math.PI;
const within = (a, from, to) => { const w = ((a % TURN) + TURN) % TURN; return w >= from && w <= to; };
const half = (ctx, inner, outer, from, to) => {
  ctx.beginPath(); ctx.arc(0, 0, outer, from, to); ctx.arc(0, 0, inner, to, from, true); ctx.closePath();
};
// The meridian ring's degrees: a tick each degree, longer each five, a
// number each ten. The horizon's: the zodiac's degrees inside, a tick each,
// longer each ten, the signs' names between; the calendar's days outside, a
// tick each, longer each fifth day, the months' names between.
const TICK = 0.012, TICK_LONG = 0.022, MERIDIAN_TYPE = 0.026, HORIZON_TYPE = 0.03;
const ZODIAC_BAND = 0.45;
// A month's name sits at its middle day.
const MID_MONTH = 16;
export function drawMount(ctx, view, pass, { setting, calendar, today, font }, colors, dpr) {
  const front = pass === 'front';
  const meridianPlane = () => ctx.setTransform(view.k, 0, 0, view.k * cosE, view.cx, view.cy);
  const horizonPlane = () => ctx.setTransform(view.k, 0, 0, view.k * sinE, view.cx, view.cy);
  const line = w => w * dpr / view.k;
  // Lettering is set at its size on the canvas, under the plane's
  // foreshortening: type a fraction of a pixel high, scaled up, rasterises
  // badly.
  const letter = (a, r, turn, size, text) => {
    ctx.save();
    ctx.translate(Math.cos(a) * r, Math.sin(a) * r); ctx.rotate(a + turn); ctx.scale(1 / view.k, 1 / view.k);
    ctx.font = `${size * view.k}px ${font}`;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // The meridian ring: its upper half (−Y up in its plane) in front, angles
  // [π, 2π] on the canvas; the lower half behind.
  meridianPlane();
  const [m0, m1] = front ? [Math.PI, 2 * Math.PI] : [0, Math.PI];
  half(ctx, MERIDIAN.inner, MERIDIAN.outer, m0, m1);
  ctx.fillStyle = colors.brass; ctx.fill();
  ctx.strokeStyle = colors['brass-edge']; ctx.lineWidth = line(0.8); ctx.stroke();
  // Its degrees, from the north pole (the axis, `setting` above the north
  // point) round: 90 at the poles, 0 at the equator.
  ctx.beginPath();
  for (let d = 0; d < 360; d++) {
    const a = (d - setting) * RAD, c = Math.cos(a), s = Math.sin(a);
    if (!within(a, m0, m1)) continue;
    const len = d % 5 ? TICK : TICK_LONG;
    ctx.moveTo(c * MERIDIAN.outer, s * MERIDIAN.outer); ctx.lineTo(c * (MERIDIAN.outer - len), s * (MERIDIAN.outer - len));
  }
  ctx.strokeStyle = colors.ink; ctx.lineWidth = line(0.6); ctx.stroke();
  ctx.fillStyle = colors.ink;
  for (let d = 0; d < 360; d += 10) {
    const a = (d - setting) * RAD;
    if (within(a, m0, m1)) letter(a, (MERIDIAN.inner + MERIDIAN.outer - TICK_LONG) / 2, Math.PI / 2, MERIDIAN_TYPE, String(Math.abs(90 - (d % 180))));
  }
  // The horizon: in front, its outer edge, then its top face; behind, its
  // top face, then its inner edge, which faces the eye across the opening.
  horizonPlane();
  const [h0, h1] = front ? [0, Math.PI] : [Math.PI, 2 * Math.PI];
  const edgeDrop = HORIZON.thickness * cosE / sinE;
  if (front) {
    ctx.beginPath();
    ctx.arc(0, 0, HORIZON.outer, 0, Math.PI);
    ctx.save(); ctx.translate(0, edgeDrop); ctx.arc(0, 0, HORIZON.outer, Math.PI, 0, true); ctx.restore();
    ctx.closePath();
    ctx.fillStyle = colors['wood-edge']; ctx.fill();
  }
  half(ctx, HORIZON.inner, HORIZON.outer, h0, h1);
  ctx.fillStyle = colors.wood; ctx.fill();
  if (!front) {
    ctx.beginPath();
    ctx.arc(0, 0, HORIZON.inner, Math.PI, 2 * Math.PI);
    ctx.save(); ctx.translate(0, edgeDrop); ctx.arc(0, 0, HORIZON.inner, 2 * Math.PI, Math.PI, true); ctx.restore();
    ctx.closePath();
    ctx.fillStyle = colors['wood-edge']; ctx.fill();
  }
  // The scales' paper, between the rims of the wood.
  const width = HORIZON.outer - HORIZON.inner, pad = width * 0.08;
  const z0 = HORIZON.inner + pad, z1 = z0 + (width - 2 * pad) * ZODIAC_BAND, c1 = HORIZON.outer - pad;
  half(ctx, z0, c1, h0, h1);
  ctx.fillStyle = colors.paper; ctx.fill();
  ctx.strokeStyle = colors.ink; ctx.lineWidth = line(0.5);
  for (const r of [z0, z1, c1]) { ctx.beginPath(); ctx.arc(0, 0, r, h0, h1); ctx.stroke(); }
  // An azimuth on the canvas: clockwise from the north point (+X) seen from
  // above is clockwise on the canvas too, toward +Z, the eye.
  const shows = az => within(az * RAD, h0, h1);
  const tick = (az, r, len) => { const a = az * RAD; ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a) * (r - len), Math.sin(a) * (r - len)); };
  ctx.beginPath();
  for (let d = 0; d < 360; d++) if (shows(EAST + d)) tick(EAST + d, z1, d % 30 === 0 ? z1 - z0 : d % 10 ? TICK : TICK_LONG);
  for (let i = 0; i < calendar.length; i++) {
    const day = calendar[i];
    if (shows(day.azimuth)) tick(day.azimuth, c1, day.day === 1 ? c1 - z1 : day.day % 5 ? TICK : TICK_LONG);
  }
  ctx.lineWidth = line(0.5); ctx.stroke();
  const onWood = (az, r, text) => { if (shows(az)) letter(az * RAD, r, -Math.PI / 2, HORIZON_TYPE, text); };
  ctx.fillStyle = colors.ink;
  SIGNS.forEach((sign, k) => onWood(EAST + 30 * k + 15, (z0 + z1 + TICK_LONG) / 2, sign));
  for (let i = 0; i < calendar.length; i++) {
    const day = calendar[i];
    if (day.day === MID_MONTH) onWood(day.azimuth, (z1 + c1 + TICK_LONG) / 2, MONTHS[day.month]);
  }
  // Today: a bead across both scales, at the sun's place.
  if (shows(today)) {
    const a = today * RAD;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * z0, Math.sin(a) * z0); ctx.lineTo(Math.cos(a) * c1, Math.sin(a) * c1);
    ctx.strokeStyle = colors.sun; ctx.lineWidth = line(1.5); ctx.stroke();
  }
  ctx.restore();
}

// The zoom past which the coasts' simplification would show: its tolerance,
// at the globe's centre (where orthographic spends a radius per radian),
// reaching one CSS pixel.
export const maxZoom = (toleranceDeg, radiusCss) => Math.max(1, 1 / (toleranceDeg * RAD * radiusCss));
