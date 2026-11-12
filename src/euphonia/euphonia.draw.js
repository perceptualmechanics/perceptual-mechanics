// Draws the globe of 1668 and its mount onto a canvas. The geometry is
// d3-geo's through euphonia.globe.js and the mount's through
// euphonia.mount.js; this is only how it reaches pixels. A view is the point
// of the globe at its centre (lon0, lat0), north up, the globe's radius (k)
// and centre (cx, cy) and the canvas's size (width, height), all in canvas
// pixels.
import { geoPath } from 'd3-geo';
import { projectionFor, faces, capOf, ellipseOf } from './euphonia.globe.js';
import { MERIDIAN, HORIZON, SIGNS, MONTHS, EAST, lit } from './euphonia.mount.js';
import { AXES, SPHERES } from './euphonia.wheel.js';

const RAD = Math.PI / 180;
// The golden angle: steps by it never line up, so what it spaces never
// repeats in step with its neighbours.
export const GOLDEN = Math.PI * (3 - Math.sqrt(5));

// The canvas pixel of a point on the unit disc (the globe's limb at radius
// 1, Y up, north up); and back.
export const toScreen = (view, X, Y) => [view.cx + X * view.k, view.cy - Y * view.k];
export const fromScreen = (view, x, y) => [(x - view.cx) / view.k, (view.cy - y) / view.k];

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
const SHARED_COLORS = ['frame', 'frame-edge', 'case', 'paper', 'ink', 'signal', 'signal-text'];
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
      const a = k * Math.PI / 8, r = k % 4 === 0 ? long : k % 2 === 0 ? long * 0.6 : short;
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
export function drawWheel(ctx, view, { realms, roads }, rim, colors, dpr, font, rem, smallCaps = true) {
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

  // The realms where the Wheel files them, in small capitals where the
  // theme's face has them; the Middle World is the globe.
  type(WHEEL_REALM_REM);
  ctx.fontVariantCaps = smallCaps ? 'small-caps' : 'normal';
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
    ctx.translate(x, y); ctx.rotate(-e.along); ctx.scale(Math.max(e.minor / e.major, 1e-3), 1);
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
// ring's far half and the horizon's far half, which the globe hides where
// it's in front of them) and 'front' after it (the ring's near half and the
// horizon's near half, which stand before it). Seen from above the horizon
// the ring's upper half is the nearer and the horizon shows its top face,
// with the scales; from below, the lower half, and the bare wood beneath.
// eye is the eye's height in degrees; calendar is the year's days
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
// A colour in more or less light: the hex's channels taken to linear light,
// scaled, and back to sRGB.
const inLight = (hex, f) => {
  const h = hex.length === 4 ? [...hex.slice(1)].map(x => x + x).join('') : hex.slice(1);
  return `#${[0, 2, 4].map(i => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255, l = (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) * f;
    return Math.round(Math.min(1, l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055) * 255).toString(16).padStart(2, '0');
  }).join('')}`;
};
// The horizon's walls in the lamp, across the page: each azimuth's normal,
// in the eye's frame, lit relative to the top face, whose colour the theme
// gives. A wall's azimuth a stands at x = r·cos a in its plane, so its light
// is a gradient along x; this many stops follow it. Made again only when the
// eye or the wood changes.
const WALL_STOPS = 24;
let walls = { key: '' };
function wallLight(ctx, eye, wood) {
  const key = `${eye}|${wood}`;
  if (walls.key === key) return walls;
  const s = Math.sin(eye * RAD), c = Math.cos(eye * RAD), face = lit([0, c, s]);
  // The outer wall's near half faces out, a in [0, π]; the inner wall's far
  // half faces in across the opening, a in [π, 2π].
  const make = (r, from, normal) => {
    const g = ctx.createLinearGradient(-r, 0, r, 0);
    for (let i = 0; i <= WALL_STOPS; i++) {
      const a = from + Math.PI * i / WALL_STOPS;
      g.addColorStop((Math.cos(a) + 1) / 2, inLight(wood, lit(normal(a)) / face));
    }
    return g;
  };
  walls = {
    key,
    // The face the eye sees: the top, as the theme gives it, or from below
    // the underside, turned down from the lamp.
    face: s >= 0 ? wood : inLight(wood, lit([0, -c, -s]) / face),
    [HORIZON.outer]: make(HORIZON.outer, 0, a => [Math.cos(a), -Math.sin(a) * s, Math.sin(a) * c]),
    [HORIZON.inner]: make(HORIZON.inner, Math.PI, a => [-Math.cos(a), Math.sin(a) * s, -Math.sin(a) * c]),
  };
  return walls;
}

// The outer wall's grain: lines running round the ring, each wandering a
// little in height, as wood's grain, lacquer's layers or stone's bedding run
// round a turned ring. In the wall's own colour, multiplied for the darker
// lines and screened for the lighter, so it brings no colour of its own and
// the lamp's light along the wall stays. Each line's height, waves and phase
// step by the golden angle, not chance, so the grain never shifts. Drawn in
// the page's plane (radii, y down) so it keeps its weight from every eye;
// made again only when the eye moves. An authored texture: how many lines,
// how far each wanders (a share of the gap between lines), the points along
// each, how strongly it shows, and every how many lines one is light.
const GRAIN = { lines: 11, wander: 0.6, steps: 120, alpha: 0.4, lightEvery: 3 };
let grain = { eye: NaN };
function grainOf(eye) {
  if (grain.eye === eye) return grain;
  const s = Math.sin(eye * RAD), c = Math.cos(eye * RAD), r = HORIZON.outer, t = HORIZON.thickness;
  const dark = new Path2D(), light = new Path2D();
  for (let j = 0; j < GRAIN.lines; j++) {
    const turn = (j * GOLDEN) / (2 * Math.PI) % 1, waves = 2 + Math.floor(turn * 5), phase = j * GOLDEN;
    const path = j % GRAIN.lightEvery === GRAIN.lightEvery - 1 ? light : dark;
    for (let i = 0; i <= GRAIN.steps; i++) {
      const a = Math.PI * i / GRAIN.steps;
      const depth = (j + 0.5 + GRAIN.wander * (turn - 0.5) + GRAIN.wander / 2 * Math.sin(waves * a + phase)) / GRAIN.lines;
      // The near half of the wall, a in [0, π], depth below the top face.
      const x = r * Math.cos(a), y = r * Math.sin(a) * s + Math.min(1, Math.max(0, depth)) * t * c;
      if (i) path.lineTo(x, y); else path.moveTo(x, y);
    }
  }
  grain = { eye, dark, light, faces: new Map() };
  return grain;
}
// The same grain turned round the ring on a face, the top's wooden rims or
// the whole underside: concentric lines at the wall's own spacing, so the
// grain runs on from wall to face, each wandering as the wall's do, over the
// half of the ring from `from` to `from + π`.
function faceGrainOf(eye, from, bottom) {
  const all = grainOf(eye), key = `${from}|${bottom}`;
  if (all.faces.has(key)) return all.faces.get(key);
  const s = Math.sin(eye * RAD), c = Math.cos(eye * RAD), t = HORIZON.thickness, spacing = t / GRAIN.lines;
  const count = Math.floor((HORIZON.outer - HORIZON.inner) / spacing), dark = new Path2D(), light = new Path2D();
  for (let j = 0; j < count; j++) {
    const turn = (j * GOLDEN) / (2 * Math.PI) % 1, waves = 2 + Math.floor(turn * 5), phase = j * GOLDEN;
    const path = j % GRAIN.lightEvery === GRAIN.lightEvery - 1 ? light : dark;
    for (let i = 0; i <= GRAIN.steps; i++) {
      const a = from + Math.PI * i / GRAIN.steps;
      const r = HORIZON.inner + spacing * (j + 0.5 + GRAIN.wander * (turn - 0.5) + GRAIN.wander / 2 * Math.sin(waves * a + phase));
      const x = r * Math.cos(a), y = r * Math.sin(a) * s + (bottom ? t * c : 0);
      if (i) path.lineTo(x, y); else path.moveTo(x, y);
    }
  }
  const out = { dark, light };
  all.faces.set(key, out);
  return out;
}
// The grain's lines, in the page's plane, in the material's own colour.
function strokeGrain(ctx, view, { dark, light }, wood, width) {
  ctx.save();
  ctx.setTransform(view.k, 0, 0, view.k, view.cx, view.cy);
  ctx.strokeStyle = wood; ctx.lineWidth = width; ctx.globalAlpha = GRAIN.alpha;
  ctx.globalCompositeOperation = 'multiply'; ctx.stroke(dark);
  ctx.globalCompositeOperation = 'screen'; ctx.stroke(light);
  ctx.restore();
}
// The meridian ring is a band with thickness, and its rims catch the lamp:
// each rim's normal runs out from the ring's centre (in from the inner rim)
// in the ring's plane, lit relative to the ring's face, whose colour the
// theme gives. A conic gradient round the centre follows it, this many stops;
// made again only when the eye or the metal changes.
const RIM_STOPS = 36;
let rims = { key: '' };
function rimLight(ctx, eye, metal) {
  const key = `${eye}|${metal}`;
  if (rims.key === key) return rims;
  const s = Math.sin(eye * RAD), c = Math.cos(eye * RAD), face = lit([0, -s, c]);
  const make = sign => {
    const g = ctx.createConicGradient(0, 0, 0);
    for (let i = 0; i <= RIM_STOPS; i++) {
      const a = 2 * Math.PI * i / RIM_STOPS;
      g.addColorStop(i / RIM_STOPS, inLight(metal, lit([sign * Math.cos(a), -sign * Math.sin(a) * c, -sign * Math.sin(a) * s]) / face));
    }
    return g;
  };
  rims = { key, [MERIDIAN.outer]: make(1), [MERIDIAN.inner]: make(-1) };
  return rims;
}

// The meridian ring's degrees: a tick each degree, longer each five, a
// number each ten. The horizon's: the zodiac's degrees inside, a tick each,
// longer each ten, the signs' names between; the calendar's days outside, a
// tick each, longer each fifth day, the months' names between.
const TICK = 0.012, TICK_LONG = 0.022, MERIDIAN_TYPE = 0.026, HORIZON_TYPE = 0.03;
const ZODIAC_BAND = 0.45;
// A month's name sits at its middle day.
const MID_MONTH = 16;
export function drawMount(ctx, view, pass, { eye, calendar, today, font }, colors, dpr) {
  const front = pass === 'front', above = eye >= 0;
  const sinE = Math.sin(eye * RAD), cosE = Math.cos(eye * RAD);
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
  // The meridian ring: its upper half (−Y up in its plane) is angles [π, 2π]
  // on the canvas, the nearer seen from above; the lower half [0, π].
  meridianPlane();
  const [m0, m1] = front === above ? [Math.PI, 2 * Math.PI] : [0, Math.PI];
  half(ctx, MERIDIAN.inner, MERIDIAN.outer, m0, m1);
  ctx.fillStyle = colors.frame; ctx.fill();
  ctx.strokeStyle = colors['frame-edge']; ctx.lineWidth = line(0.8); ctx.stroke();
  const rim = rimLight(ctx, eye, colors.frame);
  for (const r of [MERIDIAN.outer, MERIDIAN.inner]) {
    ctx.beginPath(); ctx.arc(0, 0, r, m0, m1);
    ctx.strokeStyle = rim[r]; ctx.lineWidth = line(1.4); ctx.stroke();
  }
  // Its degrees, from the north pole, upright at the top, round: 90 at the
  // poles, 0 at the equator, where the horizon stands.
  ctx.beginPath();
  for (let d = 0; d < 360; d++) {
    const a = (d - 90) * RAD, c = Math.cos(a), s = Math.sin(a);
    if (!within(a, m0, m1)) continue;
    const len = d % 5 ? TICK : TICK_LONG;
    ctx.moveTo(c * MERIDIAN.outer, s * MERIDIAN.outer); ctx.lineTo(c * (MERIDIAN.outer - len), s * (MERIDIAN.outer - len));
  }
  ctx.strokeStyle = colors.ink; ctx.lineWidth = line(0.6); ctx.stroke();
  ctx.fillStyle = colors.ink;
  for (let d = 0; d < 360; d += 10) {
    const a = (d - 90) * RAD;
    if (within(a, m0, m1)) letter(a, (MERIDIAN.inner + MERIDIAN.outer - TICK_LONG) / 2, Math.PI / 2, MERIDIAN_TYPE, String(Math.abs(90 - (d % 180))));
  }
  // The horizon: in front, its outer wall, then the face toward the eye;
  // behind, that face, then its inner wall, which faces the eye across the
  // opening. Seen from level the faces are edge-on and only the walls show.
  horizonPlane();
  const [h0, h1] = front ? [0, Math.PI] : [Math.PI, 2 * Math.PI];
  // The bottom face lies the thickness below the top: in the plane's
  // coordinates, foreshortened as the plane is, a drop of thickness·cos E /
  // sin E. From below it's the face the eye sees.
  const drop = sinE ? HORIZON.thickness * cosE / sinE : 0, face = above ? 0 : drop;
  const light = wallLight(ctx, eye, colors.case);
  const wall = r => {
    ctx.fillStyle = light[r];
    // From level the wall is a band the thickness deep, below the plane.
    if (!sinE) {
      ctx.save(); ctx.setTransform(view.k, 0, 0, view.k, view.cx, view.cy);
      ctx.fillRect(-r, 0, 2 * r, HORIZON.thickness);
      ctx.restore(); return;
    }
    ctx.beginPath();
    ctx.arc(0, 0, r, h0, h1);
    ctx.save(); ctx.translate(0, drop); ctx.arc(0, 0, r, h1, h0, true); ctx.restore();
    ctx.closePath();
    ctx.fill();
  };
  if (front) {
    wall(HORIZON.outer);
    strokeGrain(ctx, view, grainOf(eye), colors.case, line(0.6));
  }
  if (sinE) {
    ctx.save(); ctx.translate(0, face);
    half(ctx, HORIZON.inner, HORIZON.outer, h0, h1);
    ctx.fillStyle = light.face; ctx.fill();
    ctx.restore();
    // Its grain, which the scales' paper covers on the top face, leaving
    // the wooden rims either side.
    strokeGrain(ctx, view, faceGrainOf(eye, h0, !above), colors.case, line(0.6));
  }
  if (!front) wall(HORIZON.inner);
  // The scales are on the top face: from below there's only wood.
  if (!above || !sinE) { ctx.restore(); return; }
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
