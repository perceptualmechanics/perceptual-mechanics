// Draws one hemisphere of the map of 1668 onto a canvas. The geometry is
// euphonia.projection.js's; this is only how it reaches pixels. A view is a
// disc's centre meridian (lon0), a zoom (1 shows the whole disc) and the
// point of the unit disc at the canvas's centre.
import {
  project, local, ringsIn, linesIn, coastOf, graticule, parallel,
  darkRegion, capCircle, DUSKS, rhumb,
} from './euphonia.projection.js';

const RAD = Math.PI / 180;
const GRATICULE_STEP = 30;
// The disc's radius as a share of half the canvas, leaving room for the rim.
export const DISC_FILL = 1 / 1.04;
const QUARTER = Math.PI / 2;

// The canvas's pixel position of a unit-disc point, and back.
export function toScreen(view, X, Y) {
  const k = view.R * view.zoom;
  return [view.size / 2 + (X - view.vx) * k, view.size / 2 - (Y - view.vy) * k];
}
export function fromScreen(view, x, y) {
  const k = view.R * view.zoom;
  return [view.vx + (x - view.size / 2) / k, view.vy - (y - view.size / 2) / k];
}

// A pen draws unit-disc geometry onto a canvas path: lines, and arcs given by
// centre, radius, start angle and signed span (counter-clockwise positive on
// the Y-up disc). Canvas's y runs down, so a counter-clockwise span on the
// disc is canvas's anticlockwise. Arcs go in quarters at most, which keeps
// Chrome's rasteriser as close as a <circle> (measured for SVG: 8.9 px off on
// a half circle of 731 px, 0.7 px in quarters).
export function screenPen(ctx, view) {
  const k = view.R * view.zoom;
  return {
    moveTo: (X, Y) => ctx.moveTo(...toScreen(view, X, Y)),
    lineTo: (X, Y) => ctx.lineTo(...toScreen(view, X, Y)),
    arc(cx, cy, r, from, span) {
      const [x, y] = toScreen(view, cx, cy);
      const n = Math.max(1, Math.ceil(Math.abs(span) / QUARTER - 1e-9));
      for (let i = 0; i < n; i++) {
        const a = from + span * i / n, b = from + span * (i + 1) / n;
        ctx.arc(x, y, r * k, -a, -b, span > 0);
      }
    },
  };
}

const circle = (pen, cx, cy, r) => { pen.moveTo(cx + r, cy); pen.arc(cx, cy, r, 0, 2 * Math.PI); };
export const rim = pen => circle(pen, 0, 0, 1);

// Zoomed in, the disc's outline stays where it is and becomes a window onto
// the larger hemisphere: everything is clipped to the window and to the
// hemisphere's own rim.
function clipToDisc(ctx, view) {
  ctx.beginPath(); ctx.arc(view.size / 2, view.size / 2, view.R, 0, 2 * Math.PI); ctx.clip();
  ctx.beginPath(); rim(screenPen(ctx, view)); ctx.clip();
}

const isDark = (g, X, Y) => g.line
  ? g.nx * X + g.ny * Y < g.c
  : (Math.hypot(X - g.cx, Y - g.cy) < g.r) === g.inside;

// The arc of a circle from angle a to angle b on `want`'s side.
function arcTo(pen, cx, cy, r, a, b, want) {
  const ccw = ((b - a) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const mid = a + ccw / 2;
  pen.arc(cx, cy, r, a, want(cx + r * Math.cos(mid), cy + r * Math.sin(mid)) ? ccw : ccw - 2 * Math.PI);
}

// The dark part of the disc, bounded by the dusk circle (or line) and the
// rim. Built from the two points where they cross, so a circle passing near
// the projection's far pole, with a radius of millions, is drawn by its ends
// and never by its centre. Even-odd fills a disc with a hole.
export function darkShape(pen, g) {
  let pts;
  if (g.line) {
    const n = Math.hypot(g.nx, g.ny), dist = g.c / n;
    if (Math.abs(dist) >= 1) { if (isDark(g, 0, 0)) rim(pen); return; }
    const ux = g.nx / n, uy = g.ny / n, h = Math.sqrt(1 - dist * dist);
    pts = [[dist * ux - h * uy, dist * uy + h * ux], [dist * ux + h * uy, dist * uy - h * ux]];
  } else {
    const d = Math.hypot(g.cx, g.cy);
    if (d >= 1 + g.r) { if (!g.inside) rim(pen); return; }
    if (d <= Math.abs(g.r - 1)) {
      if (g.r < 1) { if (!g.inside) rim(pen); circle(pen, g.cx, g.cy, g.r); } else if (g.inside) rim(pen);
      return;
    }
    const a = (1 - g.r * g.r + d * d) / (2 * d), h = Math.sqrt(1 - a * a);
    const px = a * g.cx / d, py = a * g.cy / d, ox = -g.cy / d * h, oy = g.cx / d * h;
    pts = [[px + ox, py + oy], [px - ox, py - oy]];
  }
  const [A, B] = pts;
  pen.moveTo(...A);
  if (g.line) pen.lineTo(...B);
  else arcTo(pen, g.cx, g.cy, g.r, Math.atan2(A[1] - g.cy, A[0] - g.cx), Math.atan2(B[1] - g.cy, B[0] - g.cx), (X, Y) => Math.hypot(X, Y) < 1);
  arcTo(pen, 0, 0, 1, Math.atan2(B[1], B[0]), Math.atan2(A[1], A[0]), (X, Y) => isDark(g, X, Y));
}

// The world's layers projected for one centre meridian, as flat lists of
// unit-disc coordinates. Turning the world reprojects; zooming and panning
// only redraw these.
// The wind roses, at the poles of inaccessibility euphonia.roses.json found:
// the 32 points of the compass as rhumb lines, as the period's charts drew
// them, reaching ROSE_REACH degrees, the cardinal and half-cardinal points
// apart from the rest.
const ROSE_POINTS = 32, ROSE_REACH = 30, ROSE_STEP = 1;
const roseLines = r => Array.from({ length: ROSE_POINTS }, (_, k) =>
  ({ main: k % (ROSE_POINTS / 8) === 0, line: rhumb(r.lat, r.lon, k * 360 / ROSE_POINTS, ROSE_REACH, ROSE_STEP) }));

export function projectWorld(world, lon0) {
  const flat = lines => lines.map(line => {
    const xy = new Float64Array(line.length * 2);
    line.forEach(([lon, lat], i) => { const [X, Y] = project(lon, lat, lon0); xy[2 * i] = X; xy[2 * i + 1] = Y; });
    return xy;
  });
  return {
    lon0,
    graticule: flat(graticule(lon0, GRATICULE_STEP)),
    land: flat(ringsIn(world.land, lon0)),
    coast: flat(linesIn(world.coast, lon0)),
    rivers: flat(linesIn(world.rivers, lon0)),
    lakes: flat(ringsIn(world.lakes, lon0)),
    historic: flat(ringsIn(world.historic.flatMap(l => l.parts), lon0)),
    roseMain: flat(linesIn(world.roses.flatMap(r => r.lines.filter(l => l.main).map(l => l.line)), lon0)),
    roseRest: flat(linesIn(world.roses.flatMap(r => r.lines.filter(l => !l.main).map(l => l.line)), lon0)),
    roseCentres: world.roses.filter(r => local(r.lon, r.lat, lon0)[2] <= 0).map(r => project(r.lon, r.lat, lon0)),
  };
}
// The world with its coast taken once from the land's rings, and the wind
// roses with their rhumb lines.
export const prepareWorld = (world, roses) => ({
  ...world, coast: world.land.flatMap(coastOf), roses: roses.map(r => ({ ...r, lines: roseLines(r) })),
});

function trace(ctx, view, lines, close) {
  ctx.beginPath();
  const k = view.R * view.zoom, ox = view.size / 2 - view.vx * k, oy = view.size / 2 + view.vy * k;
  for (const xy of lines) {
    ctx.moveTo(ox + xy[0] * k, oy - xy[1] * k);
    for (let i = 2; i < xy.length; i += 2) ctx.lineTo(ox + xy[i] * k, oy - xy[i + 1] * k);
    if (close) ctx.closePath();
  }
}

// The colours are the page's, read from its custom properties once.
export function palette(el) {
  const css = getComputedStyle(el);
  const v = name => css.getPropertyValue(`--map-${name}`).trim();
  return Object.fromEntries(['sea', 'graticule', 'circles', 'land', 'coast', 'river', 'lake', 'historic', 'night', 'glow', 'glow-lit', 'sun', 'rim',
    'waterline', 'relief-shelf', 'relief-abyss', 'relief-land', 'relief-lit', 'relief-shade', 'rhumb', 'rose']
    .map(n => [n, v(n)]));
}

// The layers that change only with the view, in two: the fills (sea, land,
// lakes), which the night darkens, and the lines (graticule, coasts, rivers,
// lakes' shores), drawn over the night so the world's shape stays legible in
// the dark: at full night the coast had fallen to 1.42:1 against the sea,
// under the 3:1 a graphic needs. dpr scales line widths, which are in CSS
// pixels.
// Water-lining, as the period's engravers drew the sea: lines following every
// coast outward, each a gap further than the last from the one before (1, 2,
// 3… gaps), fainter as they go. Each is an exact offset of the coast, cut as
// the rim of a stroke one line-width narrower than the stroke under it.
const WATERLINES = 5, WATERLINE_GAP = 1.5, WATERLINE_WIDTH = 0.6;
let waterCanvas = null;
function waterLines(view, projected, colors, dpr) {
  waterCanvas ??= document.createElement('canvas');
  if (waterCanvas.width !== view.size) waterCanvas.width = waterCanvas.height = view.size;
  const ctx = waterCanvas.getContext('2d');
  ctx.clearRect(0, 0, view.size, view.size);
  ctx.lineJoin = ctx.lineCap = 'round';
  trace(ctx, view, projected.coast, false);
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

// relief, when the page has it, draws the sea's depths or the land's relief
// for this view (euphonia.relief.js); without it, the fills are flat.
export function drawFills(ctx, view, projected, colors, dpr, relief) {
  ctx.clearRect(0, 0, view.size, view.size);
  ctx.save();
  clipToDisc(ctx, view);
  if (relief) ctx.drawImage(relief(view, 'sea'), 0, 0);
  else { ctx.fillStyle = colors.sea; ctx.fillRect(0, 0, view.size, view.size); }
  ctx.drawImage(waterLines(view, projected, colors, dpr), 0, 0);
  ctx.save();
  trace(ctx, view, projected.land, true); ctx.clip('evenodd');
  if (relief) ctx.drawImage(relief(view, 'land'), 0, 0);
  else { ctx.fillStyle = colors.land; ctx.fillRect(0, 0, view.size, view.size); }
  ctx.restore();
  ctx.fillStyle = colors.sea;
  trace(ctx, view, projected.lakes, true); ctx.fill();
  trace(ctx, view, projected.historic, true); ctx.fill();
  ctx.restore();
}
export function drawLines(ctx, view, projected, colors, dpr) {
  ctx.clearRect(0, 0, view.size, view.size);
  ctx.save();
  clipToDisc(ctx, view);
  ctx.lineJoin = 'round';
  trace(ctx, view, projected.graticule, false); ctx.strokeStyle = colors.graticule; ctx.lineWidth = 0.5 * dpr; ctx.stroke();
  trace(ctx, view, projected.coast, false); ctx.strokeStyle = colors.coast; ctx.lineWidth = 0.7 * dpr; ctx.stroke();
  trace(ctx, view, projected.rivers, false); ctx.strokeStyle = colors.river; ctx.lineWidth = 0.7 * dpr; ctx.stroke();
  trace(ctx, view, projected.lakes, true); ctx.strokeStyle = colors.circles; ctx.lineWidth = 0.5 * dpr; ctx.stroke();
  trace(ctx, view, projected.historic, true); ctx.setLineDash([3 * dpr, 2 * dpr]); ctx.strokeStyle = colors.historic; ctx.stroke(); ctx.setLineDash([]);
  // The roses' rhumb lines, and at each pole an eight-pointed star.
  trace(ctx, view, projected.roseRest, false); ctx.strokeStyle = colors.rhumb; ctx.lineWidth = 0.4 * dpr; ctx.stroke();
  trace(ctx, view, projected.roseMain, false); ctx.lineWidth = 0.8 * dpr; ctx.stroke();
  ctx.fillStyle = colors.rose;
  for (const [X, Y] of projected.roseCentres) {
    const [x, y] = toScreen(view, X, Y), long = ROSE_STAR * dpr, short = long * 0.3;
    ctx.beginPath();
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, r = k % 4 === 0 ? long : k % 2 === 0 ? long * 0.6 : short;
      ctx[k ? 'lineTo' : 'moveTo'](x + r * Math.sin(a), y - r * Math.cos(a));
    }
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// A rose's star, its longest points, in CSS pixels.
const ROSE_STAR = 11;

// The night's four steps, between the fills and the lines.
export function drawNight(ctx, view, sun, colors) {
  const pen = screenPen(ctx, view);
  ctx.save();
  clipToDisc(ctx, view);
  ctx.fillStyle = colors.night;
  for (const dusk of DUSKS) {
    ctx.beginPath(); darkShape(pen, darkRegion(sun, dusk, view.lon0)); ctx.fill('evenodd');
  }
  ctx.restore();
}

// A mark at a point of the globe, if this hemisphere faces it: the canvas
// position, or null.
function facing(view, { lat, lon }) {
  return local(lon, lat, view.lon0)[2] <= 0 ? toScreen(view, ...project(lon, lat, view.lon0)) : null;
}

// Over the lines: the tropics and polar circles, the book's regions and
// their places, the picked place, the sun, and the rim over all.
export function drawMarks(ctx, view, { sun, regions, hoverPlace, pick }, colors, dpr) {
  const pen = screenPen(ctx, view);
  ctx.save();
  clipToDisc(ctx, view);
  const eps = sun.obliquity;
  const circles = [0, eps, -eps, 90 - eps, eps - 90].map(lat => parallel(view.lon0, lat));
  ctx.beginPath();
  for (const line of circles) line.forEach(([lon, lat], i) => pen[i ? 'lineTo' : 'moveTo'](...project(lon, lat, view.lon0)));
  ctx.strokeStyle = colors.circles; ctx.lineWidth = 0.7 * dpr; ctx.stroke();
  // The book's regions: they're where the book places them at every hour.
  for (const r of regions) for (const p of r.glows) {
    const c = capCircle(p, p.rho, view.lon0);
    if (!c) continue;
    const [x, y] = toScreen(view, c.cx, c.cy), rr = c.r * view.R * view.zoom;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, r.lit ? colors['glow-lit'] : colors.glow);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, 2 * Math.PI); ctx.fill();
  }
  // A lit region's places, each a dot at its exact point; the place under
  // the pointer, a ring round it.
  ctx.fillStyle = ctx.strokeStyle = colors.sun;
  for (const r of regions) if (r.lit) for (const p of r.glows) {
    const at = facing(view, p);
    if (!at) continue;
    ctx.beginPath(); ctx.arc(...at, 2.5 * dpr, 0, 2 * Math.PI); ctx.fill();
  }
  const ring = hoverPlace && facing(view, hoverPlace);
  if (ring) { ctx.lineWidth = 1.5 * dpr; ctx.beginPath(); ctx.arc(...ring, 7 * dpr, 0, 2 * Math.PI); ctx.stroke(); }
  // The place the reader picked: a cross, open at its centre.
  const cross = pick && facing(view, pick);
  if (cross) {
    const [x, y] = cross, a = 3 * dpr, b = 9 * dpr;
    ctx.lineWidth = 1.5 * dpr; ctx.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(x + dx * a, y + dy * a); ctx.lineTo(x + dx * b, y + dy * b); }
    ctx.stroke();
  }
  if (local(sun.lon, sun.lat, view.lon0)[2] <= 0) {
    const [x, y] = toScreen(view, ...project(sun.lon, sun.lat, view.lon0));
    ctx.strokeStyle = ctx.fillStyle = colors.sun; ctx.lineWidth = 1.2 * dpr;
    ctx.beginPath(); ctx.arc(x, y, 6 * dpr, 0, 2 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 1.5 * dpr, 0, 2 * Math.PI); ctx.fill();
  }
  // The hemisphere's rim where the window shows it, and the window's own.
  ctx.beginPath(); rim(pen); ctx.strokeStyle = colors.rim; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.arc(view.size / 2, view.size / 2, view.R, 0, 2 * Math.PI);
  ctx.strokeStyle = colors.rim; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
  // The rim graduated in degrees of latitude, in alternating ten-degree
  // bands as the period's frames were: on a hemisphere's rim, the angle from
  // its centre is the latitude itself (east rim) or its supplement (west).
  if (view.zoom === 1) {
    const c = view.size / 2, inner = view.R + RIM_GAP * dpr, outer = inner + RIM_BAND * dpr;
    ctx.fillStyle = colors.rim;
    for (let lat = -90; lat < 90; lat += 20) for (const side of [0, Math.PI]) {
      const a = side === 0 ? -lat * RAD : Math.PI + lat * RAD, b = side === 0 ? -(lat + 10) * RAD : Math.PI + (lat + 10) * RAD;
      ctx.beginPath(); ctx.arc(c, c, outer, a, b, side === 0); ctx.arc(c, c, inner, b, a, side !== 0); ctx.closePath(); ctx.fill();
    }
    ctx.lineWidth = 0.6 * dpr;
    ctx.beginPath(); ctx.arc(c, c, outer, 0, 2 * Math.PI); ctx.stroke();
  }
}
// The degree band just outside the rim, in CSS pixels.
const RIM_GAP = 2, RIM_BAND = 4;

// The zoom past which the coasts' simplification would show: its tolerance,
// at the rim's scale (where stereographic spends a disc radius per radian),
// reaching one CSS pixel.
export const maxZoom = (toleranceDeg, radiusCss) => Math.max(1, 1 / (toleranceDeg * RAD * radiusCss));
