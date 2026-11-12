// Draws the globe of 1668 and its mount onto a canvas. The geometry is
// d3-geo's through euphonia.globe.js and the mount's through
// euphonia.mount.js; this is only how it reaches pixels. A view is the point
// of the globe at its centre (lon0, lat0), north's turn on the page (roll,
// degrees clockwise), the globe's radius (k) and centre (cx, cy) and the
// canvas's size (width, height), all in canvas pixels.
import { geoPath } from 'd3-geo';
import { projectionFor, faces, capOf, ellipseOf } from './euphonia.globe.js';
import { EYE, MERIDIAN, HORIZON, SIGNS, MONTHS, EAST } from './euphonia.mount.js';
import { AXES, SPHERES } from './euphonia.wheel.js';

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

// The coast projected for a view, once: the water-lines and the coast's own
// stroke both trace it, and projecting its rings is most of a frame's work.
const coasts = new WeakMap();
function coastPath(view, world) {
  let coast = coasts.get(view);
  if (!coast) { coast = new Path2D(); geoPath(projectionFor(view), coast)(world.coast); coasts.set(view, coast); }
  return coast;
}

// The colours are the theme's, read from its custom properties: the globe's
// own (--map-…) and the materials and signal it shares with the page.
const MAP_COLORS = ['sea', 'graticule', 'circles', 'land', 'coast', 'river', 'historic', 'glow', 'glow-lit', 'sun', 'rim',
  'waterline', 'relief-shelf', 'relief-abyss', 'relief-land', 'relief-lit', 'relief-shade', 'rhumb', 'rose', 'wheel-low',
  'empyrean', 'heaven-far', 'heaven-near', 'fire', 'air'];
const SHARED_COLORS = ['frame', 'frame-edge', 'case', 'case-edge', 'paper', 'ink', 'signal', 'signal-text'];
export function palette(el) {
  const css = getComputedStyle(el), v = name => css.getPropertyValue(`--${name}`).trim();
  return Object.fromEntries([...MAP_COLORS.map(n => [n, v(`map-${n}`)]), ...SHARED_COLORS.map(n => [n, v(n)])]);
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
  const coast = coastPath(view, world);
  for (let k = WATERLINES; k >= 1; k--) {
    const offset = WATERLINE_GAP * k * (k + 1) / 2 * dpr;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1 - (k - 1) / WATERLINES;
    ctx.strokeStyle = colors.waterline; ctx.lineWidth = 2 * offset; ctx.stroke(coast);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2 * offset - 2 * WATERLINE_WIDTH * dpr; ctx.stroke(coast);
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
  ctx.strokeStyle = colors.coast; ctx.lineWidth = 0.7 * dpr; ctx.stroke(coastPath(view, world));
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

// The Wheel, faint behind the globe and its mount: the cosmos about the
// earth, which is the globe. Its rings run from the globe's limb (0) to its
// rim (1), the window's edge about the globe's centre less a margin, each
// ring's axes eased from the limb's circle to the rim's ellipse, so the
// cosmos fills the window about the globe whatever its shape. Nearest the
// earth are the spheres, then the Revelator's roads in the page's crimson,
// each on a track of its own, then the realms at their height and bearing,
// and past the rim, in the margin, the four words of the height and the
// bearing. `rim` is in globe radii at zoom
// 1 (its axes, and the margin beyond it); `view` is the globe as the window
// frames it at home, since the Wheel stays when the globe moves.
const WHEEL_SPHERES = [0, 0.6], WHEEL_ROADS = [0.66, 0.84], WHEEL_REALMS = 0.93;
// How faint: the rings, the roads, and the lettering.
const WHEEL_RING_ALPHA = 0.16, WHEEL_ROAD_ALPHA = 0.3, WHEEL_TYPE_ALPHA = 0.45;
// The spheres are named where their rings cross this bearing: up and to the
// ordered side, clear of the globe's meridian ring and the realms' names.
const WHEEL_SPHERE_NAMES = 150;
// Type sizes in rem: the realms, the spheres and roads, the rim's words.
const WHEEL_REALM_REM = 0.72, WHEEL_SMALL_REM = 0.62, WHEEL_RIM_REM = 0.66;
// Between two #rrggbb colours, a share of the way from the first.
const mixer = (a, b) => {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), [x, y] = [p(a), p(b)];
  return t => `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
};

// Where things stand on the Wheel, for its drawing and its ambient life
// (euphonia.ambient.js) alike: a ring's axes, a point at a ring and bearing,
// each sphere's ring, each road's track, and the realms' ring.
export function wheelGeometry(view, rim, roadCount) {
  const { cx, cy, k } = view;
  const axes = t => [k * (1 + (rim.x - 1) * t), k * (1 + (rim.y - 1) * t)];
  return {
    cx, cy, axes,
    point: (t, deg) => { const [rx, ry] = axes(t); return [cx + rx * Math.cos(deg * RAD), cy - ry * Math.sin(deg * RAD)]; },
    sphereT: i => WHEEL_SPHERES[0] + (WHEEL_SPHERES[1] - WHEEL_SPHERES[0]) * (i + 1) / SPHERES.length,
    roadT: j => WHEEL_ROADS[0] + (WHEEL_ROADS[1] - WHEEL_ROADS[0]) * j / Math.max(1, roadCount - 1),
    realmT: WHEEL_REALMS,
  };
}
export function drawWheel(ctx, view, { realms, roads }, rim, colors, dpr, font, rem) {
  const { cx, cy, axes, point, sphereT, roadT } = wheelGeometry(view, rim, roads.length), k = view.k;
  const type = (size, style = '') => { ctx.font = `${style} ${size * rem * dpr}px ${font}`; };
  // Lettering that runs inward from the rim: away from the edge it is near.
  const inward = deg => {
    const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD);
    ctx.textAlign = c > 0.25 ? 'right' : c < -0.25 ? 'left' : 'center';
    ctx.textBaseline = s > 0.25 ? 'top' : s < -0.25 ? 'bottom' : 'middle';
  };
  ctx.save();
  // The spheres painted, as the period painted them (Cellarius, 1660–61), not
  // the empty black of the Far Realm, which only the philosophers have found:
  // the heavens' light beyond and about the Empyrean, in the Wheel's own
  // shape, full at the Fixed Stars and gone into the page's ground by the
  // window's farthest corner; inside the Fixed Stars a deep blue, lightening
  // sphere by sphere through the planets to the Moon; then fire, then air
  // about the earth. Each ring filled, outermost first.
  const [ex, ey] = axes(sphereT(SPHERES.indexOf('Fixed Stars')));
  const corner = Math.max(...[[0, 0], [ctx.canvas.width, 0], [0, ctx.canvas.height], [ctx.canvas.width, ctx.canvas.height]].map(([x, y]) => Math.hypot((x - cx) / ex, (y - cy) / ey)));
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(ex, ey);
  const light = ctx.createRadialGradient(0, 0, 1, 0, 0, corner);
  light.addColorStop(0, colors.empyrean);
  light.addColorStop(1, `${colors.empyrean}00`);
  ctx.fillStyle = light;
  ctx.fillRect(-corner, -corner, 2 * corner, 2 * corner);
  ctx.restore();
  // Above and below, the window ends where the bar and the ribbons keep the
  // page's ground: the light fades to nothing across the Wheel's margin there,
  // so the two meet without a seam.
  const feather = k * rim.margin, H = ctx.canvas.height, W = ctx.canvas.width;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (const [from, to] of [[0, feather], [H, H - feather]]) {
    const edge = ctx.createLinearGradient(0, from, 0, to);
    edge.addColorStop(0, colors.empyrean);
    edge.addColorStop(1, `${colors.empyrean}00`);
    ctx.fillStyle = edge;
    ctx.fillRect(0, Math.min(from, to), W, feather);
  }
  ctx.restore();
  const fixedStars = SPHERES.indexOf('Fixed Stars'), moon = SPHERES.indexOf('Moon');
  const heaven = mixer(colors['heaven-far'], colors['heaven-near']);
  for (let i = fixedStars; i >= 0; i--) {
    const [rx, ry] = axes(sphereT(i));
    ctx.fillStyle = i >= moon ? heaven((fixedStars - i) / (fixedStars - moon)) : SPHERES[i] === 'Fire' ? colors.fire : colors.air;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI); ctx.fill();
  }
  ctx.lineWidth = 0.6 * dpr;
  ctx.strokeStyle = colors.rim;
  ctx.fillStyle = colors.paper;

  // The spheres, Air to the Empyrean, each named along its ring.
  ctx.globalAlpha = WHEEL_RING_ALPHA;
  SPHERES.forEach((_, i) => { const [rx, ry] = axes(sphereT(i)); ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI); ctx.stroke(); });
  ctx.globalAlpha = WHEEL_TYPE_ALPHA;
  type(WHEEL_SMALL_REM);
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  const a = WHEEL_SPHERE_NAMES * RAD;
  // Named only where the rings stand a line of type apart at that bearing; on
  // a narrow window they crowd together there and the names would pile up.
  const [x0, y0] = point(sphereT(0), WHEEL_SPHERE_NAMES), [x1, y1] = point(sphereT(1), WHEEL_SPHERE_NAMES);
  if (Math.hypot(x1 - x0, y1 - y0) >= WHEEL_SMALL_REM * rem * dpr) SPHERES.forEach((name, i) => {
    const [rx, ry] = axes(sphereT(i)), [x, y] = point(sphereT(i), WHEEL_SPHERE_NAMES);
    // Along the ring's tangent, turned to read left to right.
    let turn = Math.atan2(-ry * Math.cos(a), -rx * Math.sin(a));
    if (Math.abs(turn) > Math.PI / 2) turn += Math.PI;
    ctx.save(); ctx.translate(x, y); ctx.rotate(turn); ctx.fillText(name, 0, -1.5 * dpr); ctx.restore();
  });

  // The roads: an arc round the Wheel through their planes, or a line
  // through the centre for the one that passes the Middle World.
  const place = new Map(realms.map(r => [r.name, r.at]));
  roads.forEach((road, j) => {
    const t = roadT(j);
    const [rx, ry] = axes(t);
    const ring = road.through.map(n => place.get(n)).filter(at => at !== 'centre');
    ctx.globalAlpha = WHEEL_ROAD_ALPHA;
    ctx.strokeStyle = ctx.fillStyle = colors.signal;
    ctx.beginPath();
    if (road.centre) { ring.forEach((at, i) => { ctx[i ? 'lineTo' : 'moveTo'](...point(t, at)); if (!i) ctx.lineTo(cx, cy); }); }
    else ctx.ellipse(cx, cy, rx, ry, 0, -road.from * RAD, -(road.from + road.span) * RAD, true);
    ctx.stroke();
    for (const at of ring) { ctx.beginPath(); ctx.arc(...point(t, at), 1.6 * dpr, 0, 2 * Math.PI); ctx.fill(); }
    ctx.globalAlpha = WHEEL_TYPE_ALPHA;
    ctx.fillStyle = colors.paper;
    type(WHEEL_SMALL_REM, 'italic');
    const mid = road.centre ? ring[0] : road.from + road.span / 2;
    inward(mid);
    ctx.fillText(road.name, ...point(t, mid));
  });

  // The realms where the Wheel files them, in small capitals; the Middle
  // World is the globe.
  type(WHEEL_REALM_REM);
  ctx.fontVariantCaps = 'small-caps';
  for (const r of realms) {
    if (r.at === 'centre') continue;
    inward(r.at);
    ctx.fillText(r.name, ...point(WHEEL_REALMS, r.at));
  }
  // The height and the bearing, in the middle of the margin past the rim:
  // across it above and below, and turned to run along it at the sides.
  ctx.fontVariantCaps = 'normal';
  type(WHEEL_RIM_REM);
  ctx.letterSpacing = `${0.2 * WHEEL_RIM_REM * rem * dpr}px`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const [word, at] of Object.entries(AXES)) {
    const c = Math.round(Math.cos(at * RAD)), s = Math.round(Math.sin(at * RAD)), out = k * rim.margin / 2;
    const [x, y] = point(1, at);
    ctx.save(); ctx.translate(x + c * out, y - s * out); ctx.rotate(-c * Math.PI / 2);
    ctx.fillText(word.toUpperCase(), 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

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
  ctx.fillStyle = colors.frame; ctx.fill();
  ctx.strokeStyle = colors['frame-edge']; ctx.lineWidth = line(0.8); ctx.stroke();
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
    ctx.fillStyle = colors['case-edge']; ctx.fill();
  }
  half(ctx, HORIZON.inner, HORIZON.outer, h0, h1);
  ctx.fillStyle = colors.case; ctx.fill();
  if (!front) {
    ctx.beginPath();
    ctx.arc(0, 0, HORIZON.inner, Math.PI, 2 * Math.PI);
    ctx.save(); ctx.translate(0, edgeDrop); ctx.arc(0, 0, HORIZON.inner, 2 * Math.PI, Math.PI, true); ctx.restore();
    ctx.closePath();
    ctx.fillStyle = colors['case-edge']; ctx.fill();
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
