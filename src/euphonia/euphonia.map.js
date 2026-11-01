// The map of 1668: two hemispheres from Natural Earth's coasts, with the
// night where it was at the chosen instant and the book's regions where the
// book places them. Drag or the arrow keys turn the world under the discs;
// the wheel, a pinch or the keys zoom; a region's name zooms to it.
import worldUrl from './euphonia.world.json?url';
import { HEMISPHERES, project, local, subsolar } from './euphonia.projection.js';
import {
  DISC_FILL, toScreen, fromScreen, projectWorld, prepareWorld, palette,
  drawBase, drawSky, maxZoom,
} from './euphonia.draw.js';
import { moonAt } from './euphonia.moon.js';
import { datesAt } from './euphonia.calendars.js';
import { tideAt, hiddenAt } from './euphonia.tide.js';
import calendars from './euphonia.calendars.json';
import places from 'virtual:euphonia-places';
import { prefersReducedMotion, createFrameClock } from '../utils/sceneKit.js';

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const HOUR_MS = 3600000;
// While time plays, the words under the map catch up four times a second:
// the dates table and the moon cost more than a frame, and nobody reads
// faster.
const READOUT_MS = 250;
// Under reduced motion, play steps once a second by the chosen rate instead
// of running.
const STEP_MS = 1000;
// Where the two hemispheres meet, 20°W and 160°E, until the reader turns them.
const SPLIT = HEMISPHERES[0].lon0 + 90;
// The site's renderers stop at 2x; past it the canvases grow for nothing.
const MAX_PIXEL_RATIO = 2;
// Wheel delta, in pixels, for each doubling of the zoom: Chrome's notch is
// 100, so a notch zooms by 2^(100/240), about a third.
const WHEEL_DOUBLING = 240;
// The keys turn the world by a degree in five, near a tenth of a time zone's
// width at a time, and zoom by half again.
const KEY_TURN = 5;
const KEY_ZOOM = 1.5;
// A region's places fill this share of the disc when its name is chosen.
const REGION_FIT = 0.8;
// A region's zoom plays over this long, unless the reader asks for less motion.
const ZOOM_MS = 450;
// The regions' names, in rem: the size of the page's notes.
const LABEL_REM = 0.85;

const unit = ({ lat, lon }) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];
const apart = (a, b) => Math.acos(Math.min(1, unit(a).reduce((s, v, i) => s + v * unit(b)[i], 0))) / RAD;

// A region as the book places it: a glow round each of its places, each
// reaching halfway to the place's nearest neighbour in the region so the
// glows meet and the region reads as one; its name at the places' mean.
const regions = places.regions.map(r => {
  const glows = r.places.map(p => ({ ...p, rho: Math.min(...r.places.filter(q => q !== p).map(q => apart(p, q))) / 2 }));
  const [x, y, z] = r.places.map(unit).reduce((a, v) => a.map((s, i) => s + v[i]));
  const centre = { lat: Math.atan2(z, Math.hypot(x, y)) / RAD, lon: Math.atan2(y, x) / RAD };
  return { ...r, glows, centre, spread: Math.max(...r.places.map(p => apart(p, centre))) };
});

// Where names would print over each other, the larger region's goes first
// (its places spread furthest), and each after it tries its own spot, then
// just below or just above the name in its way, moving at most its own
// height; a name that fits none of them, or would cross the disc's edge,
// isn't drawn at this size. Zooming in makes room, and every region's
// chapter is in the list below the map. Boxes are centred on (x, y), with
// each name measured once per type size: reading the layout back each frame
// would lay out the whole page each time.
function place(boxes, centre, radius) {
  const placed = [];
  const blockerOf = b => placed.find(o => Math.abs(b.x - o.x) < (b.w + o.w) / 2 && Math.abs(b.y - o.y) < (b.h + o.h) / 2);
  const inside = b => [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([sx, sy]) =>
    Math.hypot(b.x + sx * b.w / 2 - centre, b.y + sy * b.h / 2 - centre) <= radius);
  for (const b of [...boxes].sort((a, c) => c.spread - a.spread)) {
    const blocker = blockerOf(b);
    const tries = blocker ? [1, -1].map(side => blocker.y + side * (blocker.h + b.h) / 2) : [b.y];
    const y = tries.find(t => Math.abs(t - b.anchorY) <= b.h && !blockerOf({ ...b, y: t }) && inside({ ...b, y: t }));
    b.shown = y !== undefined;
    if (b.shown) { b.y = y; placed.push(b); }
  }
}

// The moon's face on a unit disc: the lit limb is a half circle and the
// terminator half an ellipse whose width is |1 − 2·lit|, bulging toward the
// lit limb while a crescent and away from it once gibbous. Drawn as seen from
// the north, lit on the right while waxing. At this size Chrome's looseness
// with half-circle arcs is under a hundredth of a pixel.
function facePath(lit, waxing) {
  const fmt = v => v.toFixed(4);
  const rx = Math.abs(1 - 2 * lit);
  const limb = `M0,-1A1,1 0 0 ${waxing ? 1 : 0} 0,1`;
  const crescentSweep = waxing ? 0 : 1;
  return `${limb}A${fmt(rx)},1 0 0 ${lit < 0.5 ? crescentSweep : 1 - crescentSweep} 0,-1Z`;
}

const two = n => String(n).padStart(2, '0');
const degrees = (v, pos, neg) => `${Math.abs(v).toFixed(1)}° ${v >= 0 ? pos : neg}`;

function disc(stage, i, h) {
  const cell = stage.querySelectorAll('.map-disc')[i];
  const canvas = cell.querySelector('canvas');
  return {
    name: h.name, cell, canvas, ctx: canvas.getContext('2d'),
    base: document.createElement('canvas'),
    labels: cell.querySelector('.map-labels'),
    zoom: 1, vx: 0, vy: 0, size: 0, cssSize: 0, dpr: 1, projected: null, baseKey: '',
  };
}

export async function initMap(stage) {
  const world = prepareWorld(await (await fetch(worldUrl)).json());
  const tolerance = world.provenance.tolerance_deg;
  const colors = palette(stage);
  const discs = HEMISPHERES.map((h, i) => disc(stage, i, h));
  let split = SPLIT;
  const lon0Of = i => ((split - 90 + 180 * i) % 360 + 540) % 360 - 180;

  const form = stage.querySelector('form');
  const date = form.elements.date, time = form.elements.time;
  const shown = form.querySelector('output');
  const caption = document.getElementById('map-caption');
  const readout = caption.querySelector('.map-readout');
  const moonLine = caption.querySelector('.map-moon'), moonLit = moonLine.querySelector('.lit'), moonText = moonLine.querySelector('span');
  const datesTable = caption.querySelector('.map-dates'), datesBody = datesTable.tBodies[0];
  const tideLine = caption.querySelector('.map-tide');
  const reset = stage.querySelector('.map-reset');
  const hiddenText = ({ half, open }) => [
    half === 'dark' ? 'the dark half' : half === 'other' ? 'the other half' : 'as the DM says',
    open && `${open}'s open night`,
  ].filter(Boolean).join('; ');
  const day = ms => new Date(ms).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long' });
  const clock = ms => { const d = new Date(ms); return `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`; };

  // The instant the map holds, which the date field and the slider show.
  // The year runs from Samhain 1668 to the end of Samhain 1669, as the date
  // field allows, and time that plays past its end comes round again.
  const yearStart = Date.parse(`${date.min}T00:00Z`), yearEnd = Date.parse(`${date.max}T00:00Z`) + DAY_MS;
  let instant;
  function setInstant(ms) {
    instant = yearStart + ((ms - yearStart) % (yearEnd - yearStart) + (yearEnd - yearStart)) % (yearEnd - yearStart);
    const at = new Date(instant);
    date.value = at.toISOString().slice(0, 10);
    time.value = at.getUTCHours() * 60 + at.getUTCMinutes();
  }
  const fromInputs = () => {
    const [y, m, d] = date.value.split('-').map(Number);
    instant = Date.UTC(y, m - 1, d) + Number(time.value) * 60000;
  };
  // It opens on today's month and day in that year, at this moment's UT.
  const now = new Date();
  setInstant(Date.UTC(now.getMonth() >= 10 ? 1668 : 1669, now.getMonth(), now.getDate(), now.getUTCHours(), now.getUTCMinutes()));

  // Each disc's labels: one button per region, on the disc that faces the
  // region's places' mean.
  for (const [i, d] of discs.entries()) {
    d.buttons = regions.map(r => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'map-region';
      b.textContent = r.name;
      b.addEventListener('click', () => zoomToRegion(i, r));
      d.labels.append(b);
      return b;
    });
  }

  const view = d => ({ lon0: d.lon0, zoom: d.zoom, vx: d.vx, vy: d.vy, size: d.size, R: d.size / 2 * DISC_FILL });
  const cssView = d => ({ ...view(d), size: d.cssSize, R: d.cssSize / 2 * DISC_FILL });

  let frame = 0;
  const redraw = () => { if (!frame) frame = requestAnimationFrame(render); };

  function render() {
    frame = 0;
    const sun = subsolar(instant);
    for (const [i, d] of discs.entries()) {
      if (!d.size) continue;
      d.lon0 = lon0Of(i);
      if (d.projected?.lon0 !== d.lon0) d.projected = projectWorld(world, d.lon0);
      const v = view(d);
      const key = `${d.lon0}|${d.zoom}|${d.vx}|${d.vy}|${d.size}`;
      if (key !== d.baseKey) {
        d.base.width = d.base.height = d.size;
        drawBase(d.base.getContext('2d'), v, d.projected, colors, d.dpr);
        d.baseKey = key;
      }
      d.ctx.clearRect(0, 0, d.size, d.size);
      d.ctx.drawImage(d.base, 0, 0);
      drawSky(d.ctx, v, { sun, regions }, colors, d.dpr);
      placeLabels(d);
    }
    reset.hidden = discs.every(d => d.zoom === 1) && split === SPLIT;
  }

  function placeLabels(d) {
    const v = cssView(d);
    const boxes = [];
    regions.forEach((r, k) => {
      const [x, y] = toScreen(v, ...project(r.centre.lon, r.centre.lat, d.lon0));
      if (local(r.centre.lon, r.centre.lat, d.lon0)[2] <= 0) boxes.push({ k, x, y, anchorY: y, spread: r.spread, ...d.labelSizes[k] });
      else d.buttons[k].hidden = true;
    });
    place(boxes, v.size / 2, v.R);
    for (const { k, x, y, shown } of boxes) {
      const b = d.buttons[k];
      b.hidden = !shown;
      if (shown) b.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
  }

  function readouts() {
    const sun = subsolar(instant);
    const moon = moonAt(instant);
    const tide = tideAt(instant);
    const tropicDark = sun.lat >= 0 ? 'south' : 'north';
    tideLine.textContent = `In Euphonia, Scott Cohen's setting (not history), the Hidden are at the ${tide}: the moon is ${tide === 'flood' ? 'waxing' : 'waning'}. Between the tropics the dark half lies ${tropicDark} of the equator, where the sun isn't.`;
    datesBody.replaceChildren(...datesAt(instant, calendars, places.seats, (p, seat) => hiddenText(hiddenAt(instant, p, seat))).map(r => {
      const tr = document.createElement('tr');
      for (const text of [r.calendar, r.date, r.also, r.polities.join(', ')]) tr.insertCell().textContent = text;
      return tr;
    }));
    moonLit.setAttribute('d', facePath(moon.lit, moon.waxing));
    moonText.textContent = `The moon is ${moon.waxing ? 'waxing' : 'waning'}, ${moon.age.toFixed(1)} days from new and ${Math.round(moon.lit * 100)}% lit; the ${moon.next.phase} moon is on ${day(moon.next.ms)} at ${clock(moon.next.ms)} UT.`;
    shown.value = clock(instant);
    readout.textContent = `${new Date(instant).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })} (Gregorian), ${shown.value} UT: the sun stands overhead at ${degrees(sun.lat, 'N', 'S')}, ${degrees(sun.lon, 'E', 'W')}. The night side is shaded, darker through each twilight.`;
  }
  function draw() { readouts(); redraw(); }

  // Play: the instant runs on at the chosen rate (seconds of 1668 a second),
  // through the scenes' frame clock, which caps a step so a tab come back
  // from the background doesn't leap the year. Under reduced motion it steps.
  const play = form.elements.play, rate = form.elements.rate;
  const clockFrame = createFrameClock();
  let playing = false, ticking = 0, stepping = 0, readAt = 0;
  function advance(ms) {
    setInstant(instant + ms);
    const t = performance.now();
    if (t - readAt >= READOUT_MS) { readouts(); readAt = t; }
    redraw();
  }
  const tick = () => { advance(clockFrame.tick() * 1000 * Number(rate.value)); ticking = requestAnimationFrame(tick); };
  function setPlaying(on) {
    playing = on;
    play.textContent = on ? 'Pause' : 'Play';
    play.setAttribute('aria-pressed', String(on));
    cancelAnimationFrame(ticking); clearInterval(stepping);
    if (on && prefersReducedMotion()) stepping = setInterval(() => advance(STEP_MS * Number(rate.value)), STEP_MS);
    else if (on) { clockFrame.resync(); ticking = requestAnimationFrame(tick); }
    else readouts();
  }
  play.addEventListener('click', () => setPlaying(!playing));
  rate.addEventListener('change', () => { if (playing) setPlaying(true); });

  // Sizes in device pixels, from each disc's drawn size; the names keep the
  // page's small type size whatever the disc's.
  new ResizeObserver(() => {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    for (const d of discs) {
      d.cssSize = d.cell.clientWidth;
      d.dpr = Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
      d.size = Math.round(d.cssSize * d.dpr);
      d.canvas.width = d.canvas.height = d.size;
      d.labels.style.fontSize = `${LABEL_REM * rem}px`;
      d.labelSizes = d.buttons.map(b => {
        b.hidden = false;
        return { w: b.offsetWidth, h: b.offsetHeight };
      });
      d.baseKey = '';
      clampZoom(d);
    }
    redraw();
  }).observe(stage.querySelector('.map-hemispheres'));

  // Zoom stays between the whole disc and the coasts' resolution, and the
  // view's centre stays where the disc still fills it.
  function clampZoom(d) {
    if (!d.cssSize) return;
    d.zoom = Math.min(Math.max(d.zoom, 1), maxZoom(tolerance, d.cssSize / 2 * DISC_FILL));
    const reach = Math.max(0, 1 - 1 / d.zoom), r = Math.hypot(d.vx, d.vy);
    if (r > reach) { d.vx *= reach / r; d.vy *= reach / r; }
  }
  // Zoom by `factor` keeping the unit-disc point under (x, y) still.
  function zoomAt(d, factor, x, y) {
    const [X, Y] = fromScreen(cssView(d), x, y);
    d.zoom *= factor;
    clampZoom(d);
    const [X2, Y2] = fromScreen(cssView(d), x, y);
    d.vx += X - X2; d.vy += Y - Y2;
    clampZoom(d);
    redraw();
  }
  // At the whole disc, a drag turns the world: at the disc's centre
  // stereographic spends half a radius per radian, so a drag of dx pixels
  // turns it by 2·dx/R radians. Zoomed in, a drag moves the view.
  function drag(d, dx, dy) {
    const R = d.cssSize / 2 * DISC_FILL;
    if (d.zoom === 1) split -= 2 * dx / R / RAD;
    else { d.vx -= dx / (R * d.zoom); d.vy += dy / (R * d.zoom); clampZoom(d); }
    redraw();
  }

  let zooming = 0;
  function zoomToRegion(i, r) {
    const d = discs[i];
    const pts = r.places.filter(p => local(p.lon, p.lat, d.lon0)[2] <= 0).map(p => project(p.lon, p.lat, d.lon0));
    if (!pts.length) return;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 || 0.05;
    const target = { zoom: REGION_FIT / DISC_FILL / half, vx: (Math.max(...xs) + Math.min(...xs)) / 2, vy: (Math.max(...ys) + Math.min(...ys)) / 2 };
    const from = { zoom: d.zoom, vx: d.vx, vy: d.vy };
    const step = t => {
      const e = t * t * (3 - 2 * t);
      d.zoom = Math.exp(Math.log(from.zoom) + (Math.log(target.zoom) - Math.log(from.zoom)) * e);
      d.vx = from.vx + (target.vx - from.vx) * e;
      d.vy = from.vy + (target.vy - from.vy) * e;
      clampZoom(d);
      redraw();
    };
    cancelAnimationFrame(zooming);
    if (prefersReducedMotion()) { step(1); return; }
    const start = performance.now();
    const tick = now => { const t = Math.min(1, (now - start) / ZOOM_MS); step(t); if (t < 1) zooming = requestAnimationFrame(tick); };
    zooming = requestAnimationFrame(tick);
  }

  for (const d of discs) {
    const pointers = new Map();
    let pinch = 0;
    d.canvas.addEventListener('pointerdown', e => {
      d.canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
      cancelAnimationFrame(zooming);
    });
    d.canvas.addEventListener('pointermove', e => {
      const last = pointers.get(e.pointerId);
      if (!last) return;
      const next = [e.offsetX, e.offsetY];
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pointers.set(e.pointerId, next);
        const [c, f] = [...pointers.values()];
        const span = Math.hypot(c[0] - f[0], c[1] - f[1]);
        pinch = pinch || Math.hypot(a[0] - b[0], a[1] - b[1]);
        zoomAt(d, span / pinch, (c[0] + f[0]) / 2, (c[1] + f[1]) / 2);
        pinch = span;
      } else {
        drag(d, next[0] - last[0], next[1] - last[1]);
        pointers.set(e.pointerId, next);
      }
    });
    const lift = e => { pointers.delete(e.pointerId); pinch = 0; };
    d.canvas.addEventListener('pointerup', lift);
    d.canvas.addEventListener('pointercancel', lift);
    // The wheel zooms wherever it is over the disc, a region's name included.
    d.cell.addEventListener('wheel', e => {
      e.preventDefault();
      const r = d.canvas.getBoundingClientRect();
      zoomAt(d, 2 ** (-e.deltaY / WHEEL_DOUBLING), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    d.cell.addEventListener('keydown', e => {
      if (e.target !== d.cell) return;
      const R = d.cssSize / 2 * DISC_FILL, step = KEY_TURN * RAD * R / 2;
      const keys = {
        ArrowLeft: () => drag(d, step, 0), ArrowRight: () => drag(d, -step, 0),
        ArrowUp: () => drag(d, 0, step), ArrowDown: () => drag(d, 0, -step),
        '+': () => zoomAt(d, KEY_ZOOM, d.cssSize / 2, d.cssSize / 2), '=': () => zoomAt(d, KEY_ZOOM, d.cssSize / 2, d.cssSize / 2),
        '-': () => zoomAt(d, 1 / KEY_ZOOM, d.cssSize / 2, d.cssSize / 2),
        0: resetView,
        ' ': () => setPlaying(!playing),
        '[': () => advance(-HOUR_MS), ']': () => advance(HOUR_MS),
        '{': () => advance(-DAY_MS), '}': () => advance(DAY_MS),
      };
      if (!keys[e.key]) return;
      e.preventDefault();
      keys[e.key]();
    });
  }

  function resetView() {
    split = SPLIT;
    for (const d of discs) { d.zoom = 1; d.vx = d.vy = 0; }
    redraw();
  }
  reset.addEventListener('click', resetView);

  date.addEventListener('input', () => { if (date.value) { fromInputs(); draw(); } });
  time.addEventListener('input', () => { fromInputs(); draw(); });
  draw();
  form.hidden = false;
  moonLine.hidden = false;
  datesTable.hidden = false;
  tideLine.hidden = false;
  stage.classList.add('is-drawn');
}

// A region's chapter opens from a link to it.
function openRegion(id) {
  const chapter = id ? document.getElementById(id) : null;
  if (chapter?.matches('details.region')) chapter.open = true;
}
addEventListener('hashchange', () => openRegion(location.hash.slice(1)));
openRegion(location.hash.slice(1));

const stage = document.getElementById('map-figure');
if (stage) initMap(stage);
