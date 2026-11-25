// Draws the globe of 1668 and its mount onto a canvas. The geometry is
// d3-geo's through euphonia.globe.js and the mount's through
// euphonia.mount.js; this is only how it reaches pixels. A view is the point
// of the globe at its centre (lon0, lat0), north up, the globe's radius (k)
// and centre (cx, cy) and the canvas's size (width, height), all in canvas
// pixels.
import { geoPath } from 'd3-geo';
import { projectionFor, faces, capOf, ellipseOf } from './euphonia.globe.js';
import { MERIDIAN, lit } from './euphonia.mount.js';
import { AXES, SPHERES, SIXTEENTH } from './euphonia.wheel.js';

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
const SHARED_COLORS = ['frame', 'frame-edge', 'paper', 'ink', 'signal', 'signal-text'];
export function palette(el) {
  const css = getComputedStyle(el), v = name => css.getPropertyValue(`--${name}`).trim();
  return Object.fromEntries([...MAP_COLORS.map(n => [n, v(`map-${n}`)]), ...SHARED_COLORS.map(n => [n, v(n)])]);
}

// Water-lining, as the period's engravers drew the sea: lines following every
// coast outward, each a gap further than the last from the one before (1, 2,
// 3… gaps), fainter as they go. The GPU's drawing (euphonia.gl.js) takes them
// from each pixel's distance to the land; here each is an exact offset of
// the coast, cut as the rim of a stroke one line-width narrower than the
// stroke under it. dpr scales line widths, which are in CSS pixels.
const WATERLINES = 5, WATERLINE_GAP = 1.5, WATERLINE_WIDTH = 0.6;
export const WATERLINING = { count: WATERLINES, gap: WATERLINE_GAP, width: WATERLINE_WIDTH };
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

// The layers that change only with the view, as 2D draws them where the GPU
// can't (euphonia.gl.js draws them where it can, the relief with them): the
// fills (the sea, its water-lining, the land clipped to its coasts, the
// lakes), flat; and the lines (graticule, coasts, rivers, shores, rhumbs).
export function drawFills(ctx, view, world, colors, dpr) {
  const path = geoPath(projectionFor(view), ctx);
  ctx.clearRect(0, 0, view.width, view.height);
  ctx.save();
  clipToGlobe(ctx, view);
  ctx.fillStyle = colors.sea; ctx.fillRect(0, 0, view.width, view.height);
  ctx.drawImage(waterLines(view, world, colors, dpr), 0, 0);
  ctx.save();
  ctx.beginPath(); path(world.land); ctx.clip();
  ctx.fillStyle = colors.land; ctx.fillRect(0, 0, view.width, view.height);
  ctx.restore();
  ctx.fillStyle = colors.sea;
  ctx.beginPath(); path(world.lakes); ctx.fill();
  ctx.beginPath(); path(world.historic); ctx.fill();
  ctx.restore();
}
// The polities of 1668 (euphonia.borders.json), in the coast's ink, as the
// period's maps drew them. A border is a fine line, BORDER CSS pixels wide.
// A reach is a band of wash along the inside of a polity's edge, laid as
// Dutch colourists laid outline colour, with no line under it, fading to
// nothing `width` CSS pixels in: the narrowest that reads as a band rather
// than a soft line, so it stays that wide on a phone's smaller globe as on a
// desktop's. It carries a border's ink, no more: a
// linear fade from `alpha` holds width·alpha/2 of it, so alpha is
// 2·BORDER/width.
const BORDER = 0.5, REACH_WIDTH = 6;
export const REACH = { width: REACH_WIDTH, alpha: 2 * BORDER / REACH_WIDTH };
// The globe's lines, in the order they're drawn: each a layer of the world,
// its colour and its width in CSS pixels, the historic lakes dashed (3 on, 2
// off), the reaches washed (REACH); then the roses; then the equator,
// tropics and polar circles. Both the GPU's drawing (euphonia.gl.js) and
// this one read them.
export const GLOBE_LINES = [
  { layer: 'graticule', color: 'graticule', width: 0.5 },
  { layer: 'reaches', color: 'coast', width: REACH.width, alpha: REACH.alpha, wash: true },
  { layer: 'borders', color: 'coast', width: BORDER },
  // The book's departures (✦): a firm side dashed, as the historic lakes are
  // (not the record's line); a front's contested ring dotted.
  { layer: 'dashed', color: 'coast', width: BORDER, dash: [3, 2] },
  { layer: 'fronts', color: 'coast', width: BORDER, dash: [1, 2] },
  { layer: 'coast', color: 'coast', width: 0.7 },
  { layer: 'rivers', color: 'river', width: 0.7 },
  { layer: 'lakes', color: 'circles', width: 0.5 },
  { layer: 'historic', color: 'historic', width: 0.5, dash: [3, 2] },
  { layer: 'roseRest', color: 'rhumb', width: 0.4 },
  { layer: 'roseMain', color: 'rhumb', width: 0.8 },
];
export const CIRCLES_LINE = { color: 'circles', width: 0.7 };
// The equator, tropics and polar circles for the sun's obliquity, as lines a
// point each 2° of longitude.
export const circlesOf = obliquity => ({ type: 'MultiLineString', coordinates: [0, obliquity, -obliquity, 90 - obliquity, obliquity - 90].map(lat => Array.from({ length: 181 }, (_, k) => [-180 + 2 * k, lat])) });
// The marks, in CSS pixels: a lit place's dot, the ring round the place under
// the pointer, the picked place's open cross (from its gap to its end), the
// limb; and a rose's star, its points long, half-long (of the long) and short.
export const MARKS = { dot: 2.5, ring: 7, ringWidth: 1.5, cross: [3, 9], crossWidth: 1.5, limbWidth: 1.5, rose: 11, roseHalf: 0.6, roseShort: 0.3 };
// A wash along the inside of each line: strokes in WASH_STEPS widths, out
// to twice the band's width, each over the narrower, which sum to a fade
// from the edge inward. The polities clip them to their inside, so a reach
// facing land no polity holds washes only its own side. The GPU fades each
// segment's band exactly instead.
const WASH_STEPS = 4;
function washLines(ctx, path, world, layer, width, alpha) {
  ctx.save();
  ctx.beginPath(); path(world.polityShapes); ctx.clip();
  ctx.beginPath(); path(world[layer]);
  ctx.globalAlpha = 1 - (1 - alpha) ** (1 / WASH_STEPS);
  for (let s = WASH_STEPS; s >= 1; s--) { ctx.lineWidth = 2 * width * s / WASH_STEPS; ctx.stroke(); }
  ctx.restore();
}
export function drawLines(ctx, view, world, colors, dpr) {
  const path = geoPath(projectionFor(view), ctx);
  ctx.clearRect(0, 0, view.width, view.height);
  ctx.save();
  clipToGlobe(ctx, view);
  ctx.lineJoin = 'round';
  for (const { layer, color, width, dash, alpha = 1, wash } of GLOBE_LINES) {
    ctx.strokeStyle = colors[color]; ctx.lineWidth = width * dpr; ctx.setLineDash((dash ?? []).map(d => d * dpr));
    if (wash) washLines(ctx, path, world, layer, width * dpr, alpha);
    else if (layer === 'coast') ctx.stroke(coastPath(view, world));
    else { ctx.beginPath(); path(world[layer]); ctx.stroke(); }
  }
  ctx.setLineDash([]);
  // At each rose's pole an eight-pointed star, its north point to the
  // globe's north.
  ctx.fillStyle = colors.rose;
  const project = projectionFor(view);
  for (const c of world.roseCentres) {
    if (!faces(view, c)) continue;
    const [x, y] = project([c.lon, c.lat]), long = MARKS.rose * dpr;
    ctx.beginPath();
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, r = long * (k % 4 === 0 ? 1 : k % 2 === 0 ? MARKS.roseHalf : MARKS.roseShort);
      ctx[k ? 'lineTo' : 'moveTo'](x + r * Math.sin(a), y - r * Math.cos(a));
    }
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

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

// How a name set inward from the rim hangs from its point: right of centre
// it ends there, below centre it starts there.
function inwardOf(deg) {
  const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD);
  return { align: c > 0.25 ? 'right' : c < -0.25 ? 'left' : 'center', baseline: s > 0.25 ? 'top' : s < -0.25 ? 'bottom' : 'middle', ax: c > 0.25 ? 1 : c < -0.25 ? 0 : 0.5, ay: s > 0.25 ? 0 : s < -0.25 ? 1 : 0.5 };
}
// Line height and clear space of the Wheel's names, in their type size.
const NAME_LINE = 1.2, NAME_CLEAR = 0.2;

// Where each plane's and road's name goes: the point its bearing gives. On a
// window narrower than it is tall (a phone's, where the mount fills the
// width) those points crowd, so a name moves the least distance up or down,
// within its own place on the Wheel, that clears the mount, the window's edge,
// the rim's four words and the names already placed, the outermost placed
// first since they have the least room to move; at the side it may turn to run
// along the rim. One with no clear place isn't drawn, as the spheres' names
// aren't. `measure(text, road)` is its width in device pixels.
export function wheelNames(view, { realms, roads }, rim, rem, dpr, measure) {
  const { cx, cy, k } = view, { point, roadT } = wheelGeometry(view, rim, roads.length);
  const place = new Map(realms.map(r => [r.name, r.at]));
  const name = (of, text, at, [x, y], size, road) => ({ of, text, at, x, y, ...inwardOf(at), w: measure(text, road), h: size * rem * dpr * NAME_LINE });
  const realmNames = realms.filter(r => r.at !== 'centre').map(r => name(r, r.name, r.at, point(WHEEL_REALMS, r.at), WHEEL_REALM_REM, false));
  // A road's name stands at its source, where its pathway's opening says it
  // rises ("The River of Life rises in Elysium", the Mountain "rising from
  // Asphodel"), in the gap after that realm's name: half the Wheel's sixteenth
  // on along its arc, or, for a road through the centre, back from the way it
  // climbs, so two roads rising together part. One rising at the centre, under
  // the globe (the Tree, from the Middle World), is named at its far end, on
  // the side toward the rest of the road. One that runs straight in from the
  // only realm it touches on the ring to the Middle World (a shape the reader
  // allows, though no pathway takes it now) has no way along the ring, so it
  // leans away from the nearest other road's name, as two roads rising
  // together part.
  const turn = (to, from) => Math.sign(((to - from + 540) % 360) - 180);
  const courses = roads.map(road => {
    const ring = road.through.map(n => place.get(n)).filter(at => at !== 'centre'), rises = place.get(road.rises);
    const source = rises === 'centre' ? ring.at(-1) : rises, other = ring.find(at => at !== source);
    const along = other === undefined ? null : rises === 'centre' ? turn(ring.at(-2), source) : road.centre ? -turn(other, source) : source === road.from ? 1 : -1;
    return { source, at: along === null ? null : (source + along * SIXTEENTH / 2 + 360) % 360 };
  });
  const apart = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  const roadNames = roads.map((road, j) => {
    let { source, at } = courses[j];
    if (at === null) {
      const near = courses.filter(c => c.at !== null).reduce((n, c) => (apart(c.at, source) < apart(n, source) ? c.at : n), source + 180);
      at = (source - turn(near, source) * SIXTEENTH / 2 + 360) % 360;
    }
    return name(road, road.name, at, point(roadT(j), at), WHEEL_SMALL_REM, true);
  });
  const clear = WHEEL_SMALL_REM * rem * dpr * NAME_CLEAR, radius = MERIDIAN.outer * k + clear;
  const edge = { l: cx - k * (rim.x + rim.margin) + clear, r: cx + k * (rim.x + rim.margin) - clear, t: cy - k * (rim.y + rim.margin) + clear, b: cy + k * (rim.y + rim.margin) - clear };
  const taken = Object.entries(AXES).map(([word, at]) => {
    const c = Math.round(Math.cos(at * RAD)), s = Math.round(Math.sin(at * RAD)), out = k * rim.margin / 2, [x, y] = point(1, at);
    const long = measure(word.toUpperCase(), false) / 2, thick = WHEEL_RIM_REM * rem * dpr * NAME_LINE / 2, [hw, hh] = c ? [thick, long] : [long, thick];
    return { l: x + c * out - hw, r: x + c * out + hw, t: y - s * out - hh, b: y - s * out + hh };
  });
  const boxOf = (n, y) => {
    const l = Math.max(edge.l, Math.min(edge.r - n.w, n.x - n.ax * n.w)), t = y - n.ay * n.h;
    return { l, r: l + n.w, t, b: t + n.h };
  };
  const free = b => b.l >= edge.l - 1e-6 && b.r <= edge.r + 1e-6 && b.t >= edge.t && b.b <= edge.b
    && Math.hypot(Math.max(b.l, Math.min(cx, b.r)) - cx, Math.max(b.t, Math.min(cy, b.b)) - cy) >= radius
    && !taken.some(o => b.l < o.r + clear && o.l < b.r + clear && b.t < o.b + clear && o.t < b.b + clear);
  // Where every name stands clear where it falls (a desktop's window), each
  // stays there. On a narrow window each finds the nearest room up or down
  // its side. Where names would meet in a window wider than tall (above a
  // phone's open sheet) there's no such room, and a name moved off its realm
  // would mislead: the Wheel goes unlettered until it has room again.
  const names = [...realmNames.sort((a, b) => Math.abs(b.y - cy) - Math.abs(a.y - cy)), ...roadNames];
  const meet = (a, b) => a.l < b.r + clear && b.l < a.r + clear && a.t < b.b + clear && b.t < a.b + clear;
  const fallen = names.map(n => boxOf(n, n.y)), narrow = rim.x < rim.y;
  if (!narrow && fallen.some((a, i) => fallen.slice(i + 1).some(b => meet(a, b)))) return new Map();
  // A name moves only within its own place on the Wheel, so the order round
  // the rim holds and no name stands by another's realm: never past the next
  // name above or below that it could meet, and at the side (Law's or
  // Chaos's side of the diagonals, the diagonals included), where the names
  // stand in a column, never past halfway to it. A side name with no room
  // across there turns to run along the rim, as Law and Chaos do, as near its
  // realm as it fits.
  const SIDE = Math.SQRT1_2 + 1e-9, atSide = n => Math.abs(Math.sin(n.at * RAD)) <= SIDE;
  // Its neighbours a step away, or two where one isn't room enough.
  const range = (n, steps = 1) => {
    const mine = fallen[names.indexOf(n)], near = names.filter(o => o !== n && fallen[names.indexOf(o)].l < mine.r && mine.l < fallen[names.indexOf(o)].r).map(o => o.y);
    const ups = near.filter(y => y < n.y).sort((a, b) => b - a), downs = near.filter(y => y > n.y).sort((a, b) => a - b);
    const above = ups[steps - 1] ?? -Infinity, below = downs[steps - 1] ?? Infinity;
    return atSide(n) && steps === 1 ? [(n.y + above) / 2, (n.y + below) / 2] : [above, below];
  };
  const turnedBox = (x, y, n) => ({ l: x - n.h / 2, r: x + n.h / 2, t: y - n.w / 2, b: y + n.w / 2 });
  const along = (n, top, bottom) => {
    const c = Math.sign(Math.cos(n.at * RAD));
    if (!atSide(n)) return null;
    const across = Math.ceil((edge.r - edge.l) / step);
    for (let i = 0; i <= 2 * reach; i++) {
      const y = n.y + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * step;
      if (y < top || y > bottom) continue;
      for (let j = 0; j <= 2 * across; j++) {
        const x = n.x + (j % 2 ? 1 : -1) * Math.ceil(j / 2) * step, b = turnedBox(x, y, n);
        if (c * (x - cx) > 0 && free(b)) return { x, y, b, turn: -c * Math.PI / 2 };
      }
    }
    return null;
  };
  const out = new Map(), step = clear || 1, reach = Math.ceil(2 * k * rim.y / step);
  const across = (n, top, bottom) => {
    for (let i = 0; i <= 2 * reach; i++) {
      const y = n.y + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * step, b = boxOf(n, y);
      if (y >= top && y <= bottom && (!narrow || free(b))) return { ...n, x: b.l + n.ax * n.w, y, box: b };
    }
    return null;
  };
  const turned = (n, top, bottom) => {
    const t = along(n, top, bottom);
    return t && { ...n, x: t.x, y: t.y, box: t.b, turn: t.turn, align: 'center', baseline: 'middle' };
  };
  for (const n of names) {
    let placed = null;
    for (const steps of narrow ? [1, 2] : [1]) {
      const [top, bottom] = narrow ? range(n, steps) : [-Infinity, Infinity];
      placed = across(n, top, bottom) ?? (narrow ? turned(n, top, bottom) : null);
      if (placed) break;
    }
    if (!placed) continue;
    taken.push(placed.box);
    // How far it stands from its realm's own point: to the nearest of its
    // edges, so a name turned to run along the rim isn't counted by its middle.
    const { l, r, t, b } = placed.box;
    out.set(n.of, { ...placed, moved: Math.hypot(Math.max(l - n.x, 0, n.x - r), Math.max(t - n.y, 0, n.y - b)) });
  }
  return out;
}

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
  // Lettering that runs inward from the rim, each name where wheelNames
  // finds it room.
  const lettered = wheelNames(view, { realms, roads }, rim, rem, dpr, (text, road) => {
    ctx.save();
    if (road) type(WHEEL_SMALL_REM, 'italic');
    else { type(WHEEL_REALM_REM); ctx.fontVariantCaps = smallCaps ? 'small-caps' : 'normal'; }
    const { width } = ctx.measureText(text);
    ctx.restore();
    return width;
  });
  const letter = of => {
    const n = lettered.get(of);
    if (!n) return;
    ctx.save();
    ctx.translate(n.x, n.y);
    if (n.turn) ctx.rotate(n.turn);
    ctx.textAlign = n.align; ctx.textBaseline = n.baseline;
    ctx.fillText(n.text, 0, 0);
    ctx.restore();
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
    letter(road);
  });

  // The realms where the Wheel files them, in small capitals where the
  // theme's face has them; the Middle World is the globe.
  type(WHEEL_REALM_REM);
  ctx.fontVariantCaps = smallCaps ? 'small-caps' : 'normal';
  for (const r of realms) letter(r);
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
export function drawMarks(ctx, view, { obliquity, regions, hoverPlace, pick, polity }, colors, dpr) {
  const project = projectionFor(view), path = geoPath(project, ctx);
  const at = p => (faces(view, p) ? project([p.lon, p.lat]) : null);
  ctx.save();
  clipToGlobe(ctx, view);
  // The polity under the pointer, washed in the glow's colour.
  if (polity) { ctx.fillStyle = colors.glow; ctx.beginPath(); path(polity.shape); ctx.fill(); }
  ctx.beginPath();
  path(circlesOf(obliquity));
  ctx.strokeStyle = colors[CIRCLES_LINE.color]; ctx.lineWidth = CIRCLES_LINE.width * dpr; ctx.stroke();
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
    ctx.beginPath(); ctx.arc(...xy, MARKS.dot * dpr, 0, 2 * Math.PI); ctx.fill();
  }
  const ring = hoverPlace && at(hoverPlace);
  if (ring) { ctx.lineWidth = MARKS.ringWidth * dpr; ctx.beginPath(); ctx.arc(...ring, MARKS.ring * dpr, 0, 2 * Math.PI); ctx.stroke(); }
  // The place the reader picked: a cross, open at its centre.
  const cross = pick && at(pick);
  if (cross) {
    const [x, y] = cross, [a, b] = MARKS.cross.map(d => d * dpr);
    ctx.lineWidth = MARKS.crossWidth * dpr; ctx.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(x + dx * a, y + dy * a); ctx.lineTo(x + dx * b, y + dy * b); }
    ctx.stroke();
  }
  ctx.restore();
  // The limb.
  ctx.beginPath(); ctx.arc(view.cx, view.cy, view.k, 0, 2 * Math.PI);
  ctx.strokeStyle = colors.rim; ctx.lineWidth = MARKS.limbWidth * dpr; ctx.stroke();
}

// The mount, in two passes about the globe: 'back' before it (the meridian
// ring's far half, which the globe hides where it's in front of it) and
// 'front' after it (the near half, which stands before it). Seen from above
// the equator the ring's upper half is the nearer; from below, the lower.
// eye is the eye's height in degrees.
//
// The ring is drawn in its own plane, (X, −Y), through a transform that
// carries it to the page, foreshortened by the eye's height, so its degrees
// lie on the brass as they would.
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
// number each ten.
const TICK = 0.012, TICK_LONG = 0.022, MERIDIAN_TYPE = 0.026;
export function drawMount(ctx, view, pass, { eye, font }, colors, dpr) {
  const front = pass === 'front', above = eye >= 0;
  const cosE = Math.cos(eye * RAD);
  const meridianPlane = () => ctx.setTransform(view.k, 0, 0, view.k * cosE, view.cx, view.cy);
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
  // poles, 0 at the equator.
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
  ctx.restore();
}

// The zoom past which the coasts' simplification would show: its tolerance,
// at the globe's centre (where orthographic spends a radius per radian),
// reaching one CSS pixel.
export const maxZoom = (toleranceDeg, radiusCss) => Math.max(1, 1 / (toleranceDeg * RAD * radiusCss));
