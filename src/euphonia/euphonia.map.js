// The globe of 1668: Natural Earth's coasts on one sphere in a globe-maker's
// mount, with the book's regions where the book places them. Drag or the
// arrow keys spin it and set its latitude; the wheel, a pinch or the keys
// zoom; a region's name spins the globe to it.
import worldUrl from './euphonia.world.json?url';
import reliefUrl from './euphonia.relief.bin?url';
import { createRelief } from './euphonia.relief.js';
import roseData from './euphonia.roses.json';
import { orthoLocal, orthoUnproject, subsolar, onLand } from './euphonia.projection.js';
import { globeWorld, projectionFor, faces } from './euphonia.globe.js';
import { solarParams, solarEvents } from '../bench/bench.sky.js';
import { fromScreen, palette, drawFills, drawLines, drawMarks, drawMount, maxZoom } from './euphonia.draw.js';
import { viewOf, covers, EXTENT, calendarOf, azimuthOf } from './euphonia.mount.js';
import { moonAt } from './euphonia.moon.js';
import { datesAt } from './euphonia.calendars.js';
import { tideAt, hiddenAt } from './euphonia.tide.js';
import calendars from './euphonia.calendars.json';
import places from 'virtual:euphonia-places';
import { apart, regionShape } from './euphonia.places.js';
import { prefersReducedMotion, createFrameClock, createPanelCloser, setPanelSide } from '../utils/sceneKit.js';

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
// The globe opens turned to Europe and Africa, where the book starts, and the
// Indian Ocean beyond, set for Amsterdam's latitude, where Blaeu made his.
const HOME = { lon0: 15, setting: 52.37 };
// The site's renderers stop at 2x; past it the canvases grow for nothing.
const MAX_PIXEL_RATIO = 2;
// Wheel delta, in pixels, for each doubling of the zoom: Chrome's notch is
// 100, so a notch zooms by 2^(100/240), about a third.
const WHEEL_DOUBLING = 240;
// The keys turn the globe, or its latitude setting, five degrees at a time
// (a third of a time zone's width), and zoom by half again.
const KEY_TURN = 5;
const KEY_ZOOM = 1.5;
// A region's places fill this share of the globe's radius when it's chosen.
const REGION_FIT = 0.8;
// A region's zoom plays over this long, unless the reader asks for less motion.
const ZOOM_MS = 450;
// A press that moves less than this, in CSS pixels, before it lifts is a tap,
// not a drag: a finger's or a hand's jitter.
const TAP_SLOP = 4;
// The Earth's mean radius in kilometres (IUGG), for distances to places.
const EARTH_KM = 6371;
// The tropics' and polar circles' names sit this many degrees of longitude
// west of the globe's centre, on the facing side, as globes lettered them.
const CIRCLE_NAME_WEST = 60;
// The regions' names, in rem: the size of the page's notes.
const LABEL_REM = 0.85;

const regions = places.regions.map(regionShape);

// Where names would print over each other, the larger region's goes first
// (its places spread furthest), and each after it tries its own spot, then
// just below or just above the name in its way, moving at most its own
// height; a name that fits none of them, or wouldn't lie whole on the
// globe's open face (inside its limb, clear of the mount), isn't drawn at
// this size. Zooming in makes room, and every region's
// chapter is in the panel's contents. Boxes are centred on (x, y), with
// each name measured once per type size: reading the layout back each frame
// would lay out the whole page each time.
function place(boxes, open) {
  const placed = [];
  const blockerOf = b => placed.find(o => Math.abs(b.x - o.x) < (b.w + o.w) / 2 && Math.abs(b.y - o.y) < (b.h + o.h) / 2);
  const inside = b => [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([sx, sy]) => open(b.x + sx * b.w / 2, b.y + sy * b.h / 2));
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
// A place as the book names it, with the modern town it's found at when that
// differs: a later name for the same city, or a stand-in nearby.
const placeName = p => (p.modern && p.modern !== p.name ? `${p.name}, at modern ${p.modern}` : p.name);
const degrees = (v, pos, neg) => `${Math.abs(v).toFixed(1)}° ${v >= 0 ? pos : neg}`;

// The mount's outer strokes, in CSS pixels, kept inside the canvas.
const EDGE_PX = 2;

export async function initMap(stage) {
  // The world's rings, kept for land-or-sea, and as the globe draws them.
  const data = await (await fetch(worldUrl)).json();
  const world = globeWorld(data, roseData.roses);
  const tolerance = data.provenance.tolerance_deg;
  const colors = palette(stage);
  const cell = stage.querySelector('.map-disc'), canvas = cell.querySelector('canvas');
  cell.style.setProperty('--mount-aspect', String(2 * EXTENT.halfWidth / (EXTENT.top + EXTENT.bottom)));
  const g = {
    cell, canvas, ctx: canvas.getContext('2d'),
    fills: document.createElement('canvas'), lines: document.createElement('canvas'),
    labels: cell.querySelector('.map-labels'),
    tip: Object.assign(document.createElement('span'), { className: 'map-place', hidden: true }),
    ...HOME, zoom: 1, focus: [0, 0], width: 0, height: 0, cssWidth: 0, cssHeight: 0, dpr: 1, baseKey: '',
  };
  // The relief arrives after the coasts and joins them when it does.
  let relief = null;
  fetch(reliefUrl).then(r => r.arrayBuffer()).then(bytes => {
    relief = createRelief(bytes, colors);
    g.baseKey = '';
    redraw();
  });

  const form = stage.querySelector('form');
  const date = form.elements.date, time = form.elements.time;
  const shown = form.querySelector('output');
  // The moment's readouts, on the panel's This moment page, kept up to date
  // whether or not it's open.
  const moment = stage.querySelector('.map-panel-moment');
  const readout = moment.querySelector('.map-readout');
  const moonLine = moment.querySelector('.map-moon'), moonLit = moonLine.querySelector('.lit'), moonText = moonLine.querySelector('span');
  const datesTable = moment.querySelector('.map-dates'), datesBody = datesTable.tBodies[0];
  const tideLine = moment.querySelector('.map-tide');
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

  // The labels: one button per region, at its places' mean while the globe
  // faces it.
  g.buttons = regions.map(r => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'map-region';
    b.textContent = r.name;
    b.addEventListener('click', () => openChapter(r, b));
    b.addEventListener('pointerenter', () => hover(r));
    b.addEventListener('pointerleave', () => hover(null));
    b.addEventListener('focus', () => hover(r));
    b.addEventListener('blur', () => hover(null));
    g.labels.append(b);
    return b;
  });

  // A region lights while its name or its glow is under the pointer or
  // focused, and while its chapter is open; a lit region shows its places,
  // and the place under the pointer or focus is ringed and named.
  let hovered = null, chosen = null, hoverPlace = null;
  function light() {
    for (const r of regions) r.lit = r === hovered || r === chosen;
    g.buttons.forEach((b, k) => b.classList.toggle('is-lit', regions[k].lit));
    redraw();
  }
  function hover(r, place = null) {
    if (hovered === r && hoverPlace === place) return;
    hovered = r; hoverPlace = place;
    light();
  }
  // The place whose glow holds a point of the globe, the nearest of any that
  // do as a share of its glow's reach, and its region.
  function placeAt(at) {
    let best = null;
    for (const r of regions) for (const g of r.glows) {
      const reach = apart(g, at) / g.rho;
      if (reach <= 1 && (!best || reach < best.reach)) best = { region: r, place: g, reach };
    }
    return best;
  }
  // The point of the globe under (x, y), unless the mount is in the way.
  const pointAt = (x, y) => {
    const v = cssView();
    if (covers((x - v.cx) / v.k, (v.cy - y) / v.k)) return null;
    return orthoUnproject(...fromScreen(v, x, y), v.lon0, v.lat0);
  };
  g.labels.append(g.tip);
  // The circles' names, lettered on the globe: placed with the regions'
  // names, giving way to them where the two would print over each other.
  const circleNames = ['Equator', 'Tropic of Cancer', 'Tropic of Capricorn', 'Arctic Circle', 'Antarctic Circle'];
  g.circleNames = circleNames.map(name => {
    const span = Object.assign(document.createElement('span'), { className: 'map-circle-name', textContent: name });
    span.setAttribute('aria-hidden', 'true');
    g.labels.append(span);
    return span;
  });
  g.tip.setAttribute('aria-hidden', 'true');

  // The scenes' panel, beside the map, and everything there is to read: the
  // contents, a region's chapter, a picked place (its facts first, then its
  // region's chapter, opened where the chapter names the place), and the
  // book's other pages. It takes focus on opening and gives it back to what
  // opened it on closing, by Escape or the ✕.
  const panel = stage.querySelector('.map-panel');
  const panelTitle = panel.querySelector('.map-panel-title'), panelContent = panel.querySelector('.map-panel-content');
  const panelPlaces = panel.querySelector('.map-panel-places'), panelRegion = panel.querySelector('.map-panel-region');
  const pickSection = panel.querySelector('.map-panel-pick'), pickFacts = panel.querySelector('.map-panel-facts');
  const mentionLine = panel.querySelector('.map-panel-mention');
  const nearby = panel.querySelector('.map-panel-nearby'), readNearby = panel.querySelector('.map-panel-read');
  const status = stage.querySelector('.map-status');
  const pages = [...panel.querySelectorAll('.map-panel-page')], back = panel.querySelector('.map-panel-back');
  const contentsOpen = stage.querySelector('.map-contents-open');
  let opener = null, pick = null, nearest = null;
  createPanelCloser(panel, { focus: () => opener?.focus() }, {
    closeBtn: panel.querySelector('.map-panel-close'),
    onClose: () => { chosen = null; pick = null; status.textContent = ''; light(); },
  });
  panel.querySelector('.map-panel-zoom').addEventListener('click', () => zoomToRegion(chosen));
  readNearby.addEventListener('click', () => {
    showRegion(nearest.region);
    nearby.hidden = true;
    jumpTo(nearest.place);
  });

  // One page at a time: the contents, a book page, or a region (with a
  // picked place over it); every page but the contents leads back to it.
  const pageName = p => p.dataset.page ?? 'contents';
  function showPage(name) {
    for (const p of pages) p.hidden = pageName(p) !== name;
    pickSection.hidden = true; panelRegion.hidden = true;
    chosen = null; pick = null; light();
    back.hidden = name === 'contents';
    panelTitle.textContent = pages.find(p => pageName(p) === name).dataset.title;
    panel.scrollTop = 0;
  }
  contentsOpen.addEventListener('click', () => {
    showPage('contents');
    openPanel(contentsOpen);
    requestAnimationFrame(() => panelTitle.focus());
  });
  back.querySelector('button').addEventListener('click', () => { showPage('contents'); panelTitle.focus(); });
  panel.querySelector('.map-panel-contents').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.page) { showPage(b.dataset.page); panelTitle.focus(); return; }
    const r = regions.find(x => x.id === b.dataset.region);
    showRegion(r);
    clearMention();
    redraw();
    panelTitle.focus();
  });

  // The panel comes in from the right, over the globe's eastern edge.
  function openPanel(button) {
    opener = button;
    if (panel.classList.contains('from-left')) setPanelSide(panel, false);
    panel.scrollTop = 0;
    panel.classList.add('open');
  }
  function showRegion(r) {
    for (const p of pages) p.hidden = true;
    back.hidden = false;
    if (chosen !== r) {
      chosen = r;
      panelContent.replaceChildren(panel.querySelector(`template[data-region="${r.id}"]`).content.cloneNode(true));
      // Its places, each lighting on the map under the pointer or focus, and
      // taking the reader to where the chapter names it.
      panelPlaces.replaceChildren(...r.glows.map(g => {
        const li = document.createElement('li'), b = document.createElement('button');
        b.type = 'button';
        b.textContent = placeName(g);
        b.addEventListener('pointerenter', () => hover(r, g));
        b.addEventListener('focus', () => hover(r, g));
        b.addEventListener('pointerleave', () => hover(null));
        b.addEventListener('blur', () => hover(null));
        b.addEventListener('click', () => jumpTo(g));
        li.append(b);
        return li;
      }));
    }
    panelTitle.textContent = r.name;
    panelRegion.hidden = false;
    light();
  }
  // A region's name opens its chapter at the start.
  function openChapter(r, button) {
    pick = null;
    pickSection.hidden = true;
    showRegion(r);
    clearMention();
    openPanel(button);
    redraw();
    requestAnimationFrame(() => panelTitle.focus());
  }

  // Where the chapter names a place, by the book's name or the modern one,
  // accents aside ("Nojpeten" finds "Nojpetén"): marked, scrolled to, and
  // focused, so reading goes on from there. Where it doesn't, the panel says so.
  const fold = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function findName(names) {
    for (const name of names) {
      const re = new RegExp(`(?<![\\p{L}])${fold(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'u');
      const walker = document.createTreeWalker(panelContent, NodeFilter.SHOW_TEXT);
      for (let node; (node = walker.nextNode());) {
        // Folding can shorten the text, so each folded character keeps the
        // index of the one it came from.
        let folded = '';
        const from = [];
        for (let k = 0; k < node.data.length; k++) for (const ch of fold(node.data[k])) { folded += ch; from.push(k); }
        const m = re.exec(folded);
        if (m) return { node, start: from[m.index], end: from[m.index + m[0].length - 1] + 1 };
      }
    }
    return null;
  }
  function clearMention() {
    for (const m of panelContent.querySelectorAll('mark.map-mention')) m.replaceWith(...m.childNodes);
    panelContent.normalize();
    mentionLine.textContent = '';
  }
  function jumpTo(place) {
    clearMention();
    const hit = findName([place.name, place.modern]);
    if (!hit) {
      mentionLine.textContent = `${chosen.name}'s chapter doesn't name ${place.name}; it begins below.`;
      return null;
    }
    const range = document.createRange();
    range.setStart(hit.node, hit.start); range.setEnd(hit.node, hit.end);
    const mark = Object.assign(document.createElement('mark'), { className: 'map-mention', tabIndex: -1 });
    range.surroundContents(mark);
    requestAnimationFrame(() => {
      mark.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      mark.focus({ preventScroll: true });
    });
    return mark;
  }

  // The globe's radius at zoom 1, in CSS pixels: the whole mount fitted to
  // the canvas. At zoom 1 the globe's centre sits at `anchor`; zoomed, the
  // mount is magnified about the point `focus` (in globe radii from there),
  // as under a glass.
  const fit = () => Math.min((g.cssWidth - 2 * EDGE_PX) / (2 * EXTENT.halfWidth), (g.cssHeight - 2 * EDGE_PX) / (EXTENT.top + EXTENT.bottom));
  const anchor = () => [g.cssWidth / 2, g.cssHeight / 2 + fit() * (EXTENT.top - EXTENT.bottom) / 2];
  const viewAt = scale => {
    const k = fit() * g.zoom, [ax, ay] = anchor();
    return {
      ...viewOf(g), k: k * scale,
      cx: (ax - k * g.focus[0]) * scale, cy: (ay + k * g.focus[1]) * scale,
      width: Math.round(g.cssWidth * scale), height: Math.round(g.cssHeight * scale),
    };
  };
  const view = () => viewAt(g.dpr);
  const cssView = () => viewAt(1);
  const atHome = () => g.zoom === 1 && g.lon0 === HOME.lon0 && g.setting === HOME.setting;
  // The horizon's calendar, made once for each year shown.
  let calendar = null;
  const calendarFor = year => (calendar?.year === year ? calendar : (calendar = { year, days: calendarOf(year) }));
  const font = getComputedStyle(stage).fontFamily;

  let frame = 0;
  const redraw = () => { if (!frame) frame = requestAnimationFrame(render); };

  function render() {
    frame = 0;
    if (!g.width) return;
    const v = view();
    const key = `${g.lon0}|${g.setting}|${g.zoom}|${g.focus}|${g.width}x${g.height}`;
    if (key !== g.baseKey) {
      for (const c of [g.fills, g.lines]) { c.width = g.width; c.height = g.height; }
      drawFills(g.fills.getContext('2d'), v, world, colors, g.dpr, relief);
      drawLines(g.lines.getContext('2d'), v, world, colors, g.dpr);
      g.baseKey = key;
      // What Enter picks, marked at the globe's centre when it's focused,
      // and the setting, for those who can't see the ring's degrees.
      g.cell.style.setProperty('--globe-x', `${v.cx / g.dpr}px`);
      g.cell.style.setProperty('--globe-y', `${v.cy / g.dpr}px`);
      g.cell.setAttribute('aria-label', `The globe, set for ${degrees(g.setting, 'N', 'S')}`);
    }
    const mount = { setting: g.setting, calendar: calendarFor(new Date(instant).getUTCFullYear()).days, today: azimuthOf(instant), font };
    g.ctx.clearRect(0, 0, g.width, g.height);
    drawMount(g.ctx, v, 'back', mount, colors, g.dpr);
    g.ctx.drawImage(g.fills, 0, 0);
    g.ctx.drawImage(g.lines, 0, 0);
    drawMarks(g.ctx, v, { obliquity: subsolar(instant).obliquity, regions, hoverPlace, pick }, colors, g.dpr);
    drawMount(g.ctx, v, 'front', mount, colors, g.dpr);
    placeLabels();
    reset.hidden = atHome();
  }

  function placeLabels() {
    const v = cssView(), project = projectionFor(v);
    // A point of the canvas on the globe's open face: inside its limb, on
    // the canvas, and clear of the mount.
    const open = (x, y) => Math.hypot(x - v.cx, y - v.cy) <= v.k && x >= 0 && x <= v.width && y >= 0 && y <= v.height
      && !covers((x - v.cx) / v.k, (v.cy - y) / v.k);
    const tip = hoverPlace && faces(v, hoverPlace) && project([hoverPlace.lon, hoverPlace.lat]);
    g.tip.hidden = !tip;
    if (tip) {
      g.tip.textContent = placeName(hoverPlace);
      g.tip.style.transform = `translate(${tip[0] + 10}px, ${tip[1]}px) translate(0, -50%)`;
    }
    const boxes = [];
    regions.forEach((r, k) => {
      if (!faces(v, r.centre)) { g.buttons[k].hidden = true; return; }
      const [x, y] = project([r.centre.lon, r.centre.lat]);
      boxes.push({ k, x, y, anchorY: y, spread: r.spread, ...g.labelSizes[k] });
    });
    // The circles' names, only on the whole globe, left-aligned just above
    // their lines; below every region's name in priority.
    const eps = subsolar(instant).obliquity;
    [0, eps, -eps, 90 - eps, eps - 90].forEach((lat, k) => {
      const p = { lon: g.lon0 - CIRCLE_NAME_WEST, lat };
      if (g.zoom !== 1 || !faces(v, p)) { g.circleNames[k].hidden = true; return; }
      const [x, y] = project([p.lon, p.lat]), { w, h } = g.circleSizes[k];
      boxes.push({ circle: k, x: x + w / 2, y: y - h / 2, anchorY: y - h / 2, spread: -1, w, h });
    });
    place(boxes, open);
    for (const { k, circle, x, y, shown } of boxes) {
      const b = circle === undefined ? g.buttons[k] : g.circleNames[circle];
      b.hidden = !shown;
      if (shown) b.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
  }

  // A picked place: its facts at the top of the panel, kept up to date as
  // time runs; inside a region's glow, the region's chapter under them,
  // opened where it names the place; outside every glow, the nearest named
  // place offered instead. A line for screen readers says what was picked.
  function pickPoint(at) {
    pick = at;
    const hit = placeAt(at);
    pickSection.hidden = false;
    readouts();
    clearMention();
    if (hit) {
      showRegion(hit.region);
      nearby.hidden = true;
    } else {
      for (const p of pages) p.hidden = true;
      back.hidden = false;
      panelTitle.textContent = 'A place on the map';
      panelRegion.hidden = true;
      chosen = null;
      light();
      nearby.hidden = false;
      readNearby.textContent = `Read about ${placeName(nearest.place)}, in ${nearest.region.name}`;
    }
    openPanel(g.cell);
    const mark = hit && jumpTo(hit.place);
    status.textContent = `Picked ${degrees(at.lat, 'N', 'S')}, ${degrees(at.lon, 'E', 'W')}${hit ? `, in ${hit.region.name}${mark ? `; its chapter opens where it names ${hit.place.name}` : ''}` : ''}.`;
    if (!mark) requestAnimationFrame(() => panelTitle.focus());
    redraw();
  }
  // A time of day by the sun at a longitude: true solar time, from the
  // longitude and the equation of time.
  const sunClock = (ms, lon) => {
    const m = ((ms / 60000 + 4 * lon + solarParams(ms).eqTime) % 1440 + 1440) % 1440;
    return `${two(Math.floor(m / 60))}:${two(Math.floor(m % 60))}`;
  };
  function pickFactsAt(at) {
    const minutes = ((instant / 60000 + 4 * at.lon + solarParams(instant).eqTime) % 1440 + 1440) % 1440;
    const noon = instant + (720 - minutes) * 60000;
    const events = solarEvents(noon - DAY_MS / 2, noon + DAY_MS / 2, at.lat, at.lon);
    const rise = events.find(e => e.kind === 'rise'), set = events.find(e => e.kind === 'set');
    const sun = subsolar(instant);
    // With no rise or set today, the sun is up all day if it stands above
    // the horizon at noon: its height then is 90° less the angle between
    // the place's latitude and the sun's declination.
    const sunDay = rise || set
      ? `${rise ? `rises ${sunClock(rise.t, at.lon)}` : 'already up'}, ${set ? `sets ${sunClock(set.t, at.lon)}` : 'up past midnight'}`
      : 90 - Math.abs(at.lat - sun.lat) > 0 ? "doesn't set today" : "doesn't rise today";
    nearest = null;
    for (const r of regions) for (const g of r.glows) {
      const deg = apart(g, at);
      if (!nearest || deg < nearest.deg) nearest = { region: r, place: g, deg };
    }
    const half = hiddenAt(instant, null, at).half;
    return [
      ['Where', `${degrees(at.lat, 'N', 'S')}, ${degrees(at.lon, 'E', 'W')}, ${onLand(data.land, at.lat, at.lon) ? 'on land' : 'at sea'} (Natural Earth's modern coasts)`],
      ['Nearest named place', `${placeName(nearest.place)}, in ${nearest.region.name}: ${Math.round(nearest.deg * RAD * EARTH_KM).toLocaleString('en-GB')} km`],
      ['By the sun', `${sunClock(instant, at.lon)}; the sun ${sunDay}`],
      ['The Hidden (Euphonia)', `at the ${tideAt(instant)}; ${half === 'dark' ? 'the dark half, by the sun between the tropics' : half === 'other' ? 'the other half, by the sun between the tropics' : 'the half of the year as the DM says: the book gives this place no calendar'}`],
    ];
  }

  function readouts() {
    if (pick) {
      pickFacts.replaceChildren(...pickFactsAt(pick).flatMap(([term, text]) => {
        const dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = term; dd.textContent = text;
        return [dt, dd];
      }));
    }
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
    readout.textContent = `${new Date(instant).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })} (Gregorian), ${shown.value} UT: the sun stands overhead at ${degrees(sun.lat, 'N', 'S')}, ${degrees(sun.lon, 'E', 'W')}.`;
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
  // Time runs only while the map can be seen: the builder's tab hides it,
  // and the page can scroll it away. Playing, it waits and goes on after.
  let seen = true;
  function setPlaying(on) {
    playing = on;
    play.textContent = on ? 'Pause' : 'Play';
    play.setAttribute('aria-pressed', String(on));
    cancelAnimationFrame(ticking); clearInterval(stepping);
    if (on && !seen) return;
    if (on && prefersReducedMotion()) stepping = setInterval(() => advance(STEP_MS * Number(rate.value)), STEP_MS);
    else if (on) { clockFrame.resync(); ticking = requestAnimationFrame(tick); }
    else readouts();
  }
  new IntersectionObserver(([entry]) => {
    seen = entry.isIntersecting;
    if (playing) setPlaying(true);
  }).observe(stage.querySelector('.map-globe'));
  play.addEventListener('click', () => setPlaying(!playing));
  rate.addEventListener('change', () => { if (playing) setPlaying(true); });

  // Sizes in device pixels, from the globe's drawn size; the names keep the
  // page's small type size whatever the globe's.
  new ResizeObserver(() => {
    // A hidden stage measures nothing; the globe keeps its size until it
    // shows again.
    if (!g.cell.clientWidth) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    g.cssWidth = g.cell.clientWidth;
    g.cssHeight = g.cell.clientHeight;
    g.dpr = Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
    g.width = g.canvas.width = Math.round(g.cssWidth * g.dpr);
    g.height = g.canvas.height = Math.round(g.cssHeight * g.dpr);
    g.labels.style.fontSize = `${LABEL_REM * rem}px`;
    const measure = b => { b.hidden = false; return { w: b.offsetWidth, h: b.offsetHeight }; };
    g.labelSizes = g.buttons.map(measure);
    g.circleSizes = g.circleNames.map(measure);
    g.baseKey = '';
    clampZoom();
    redraw();
  }).observe(stage.querySelector('.map-globe'));

  // Zoom stays between the whole mount and the coasts' resolution, and the
  // glass's focus where the magnified mount still fills the canvas.
  function clampZoom() {
    if (!g.cssWidth) return;
    g.zoom = Math.min(Math.max(g.zoom, 1), maxZoom(tolerance, fit()));
    const free = 1 - 1 / g.zoom;
    g.focus = [Math.max(-EXTENT.halfWidth * free, Math.min(EXTENT.halfWidth * free, g.focus[0])),
      Math.max(-EXTENT.bottom * free, Math.min(EXTENT.top * free, g.focus[1]))];
  }
  // Zoom by `factor` keeping what's under (x, y) still: the glass's focus
  // moves so the same point of the mount stays under the pointer.
  function zoomAt(factor, x, y) {
    const [ax, ay] = anchor(), at = k => [(x - ax) / k, -(y - ay) / k];
    const before = at(fit() * g.zoom), p = [g.focus[0] + before[0], g.focus[1] + before[1]];
    g.zoom *= factor;
    clampZoom();
    const after = at(fit() * g.zoom);
    g.focus = [p[0] - after[0], p[1] - after[1]];
    clampZoom();
    redraw();
  }
  // A drag works the mount: across, it spins the globe on its axis (at the
  // centre a radius of travel per radian, so dx pixels turn it dx / k
  // radians); up or down, it slides the meridian ring through the horizon's
  // notches, raising or lowering the pole, to the zenith at most.
  function drag(dx, dy) {
    const k = fit() * g.zoom;
    g.lon0 = ((g.lon0 - dx / k / RAD + 540) % 360) - 180;
    g.setting = Math.max(-90, Math.min(90, g.setting + dy / k / RAD));
    redraw();
  }

  // A region chosen: the globe spins its places' mean to face the eye, at
  // the setting the reader left it, and the glass closes on it until they
  // fill REGION_FIT of the globe's radius (orthographic carries an angle rho
  // from the centre to sin rho).
  let zooming = 0;
  function zoomToRegion(r) {
    const lon0 = r.centre.lon, v = viewOf({ lon0, setting: g.setting });
    const [x, y] = orthoLocal(r.centre.lon, r.centre.lat, v.lon0, v.lat0), c = Math.cos(v.roll * RAD), s = Math.sin(v.roll * RAD);
    const target = { lon0, zoom: REGION_FIT / Math.sin(Math.max(r.spread, 1) * RAD), focus: [x * c + y * s, -x * s + y * c] };
    const from = { lon0: g.lon0, zoom: g.zoom, focus: g.focus };
    const dlon = ((target.lon0 - from.lon0 + 540) % 360) - 180;
    const step = t => {
      const e = t * t * (3 - 2 * t);
      g.zoom = Math.exp(Math.log(from.zoom) + (Math.log(target.zoom) - Math.log(from.zoom)) * e);
      g.lon0 = ((from.lon0 + dlon * e + 540) % 360) - 180;
      g.focus = from.focus.map((f, i) => f + (target.focus[i] - f) * e);
      clampZoom();
      redraw();
    };
    cancelAnimationFrame(zooming);
    if (prefersReducedMotion()) { step(1); return; }
    const start = performance.now();
    const tick = now => { const t = Math.min(1, (now - start) / ZOOM_MS); step(t); if (t < 1) zooming = requestAnimationFrame(tick); };
    zooming = requestAnimationFrame(tick);
  }

  const pointers = new Map();
  let pinch = 0, travel = 0;
  g.canvas.addEventListener('pointerdown', e => {
    if (!pointers.size) travel = 0;
    g.canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    cancelAnimationFrame(zooming);
  });
  g.canvas.addEventListener('pointermove', e => {
    const last = pointers.get(e.pointerId);
    if (!last) {
      const at = pointAt(e.offsetX, e.offsetY), hit = at && placeAt(at);
      hover(hit?.region ?? null, hit?.place ?? null);
      return;
    }
    travel += Math.hypot(e.offsetX - last[0], e.offsetY - last[1]);
    const next = [e.offsetX, e.offsetY];
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pointers.set(e.pointerId, next);
      const [c, f] = [...pointers.values()];
      const span = Math.hypot(c[0] - f[0], c[1] - f[1]);
      pinch = pinch || Math.hypot(a[0] - b[0], a[1] - b[1]);
      zoomAt(span / pinch, (c[0] + f[0]) / 2, (c[1] + f[1]) / 2);
      pinch = span;
    } else {
      drag(next[0] - last[0], next[1] - last[1]);
      pointers.set(e.pointerId, next);
    }
  });
  // A single press that barely moved picks the place under it.
  const lift = e => {
    const tap = pointers.size === 1 && pointers.has(e.pointerId) && travel < TAP_SLOP && e.type === 'pointerup';
    pointers.delete(e.pointerId); pinch = 0;
    const at = tap && pointAt(e.offsetX, e.offsetY);
    if (at) pickPoint(at);
  };
  g.canvas.addEventListener('pointerleave', () => { if (!pointers.size) hover(null); });
  g.canvas.addEventListener('pointerup', lift);
  g.canvas.addEventListener('pointercancel', lift);
  // The wheel zooms wherever it is over the globe, a region's name included.
  g.cell.addEventListener('wheel', e => {
    e.preventDefault();
    const r = g.canvas.getBoundingClientRect();
    zoomAt(2 ** (-e.deltaY / WHEEL_DOUBLING), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  g.cell.addEventListener('keydown', e => {
    if (e.target !== g.cell) return;
    const step = KEY_TURN * RAD * fit() * g.zoom, mid = [g.cssWidth / 2, g.cssHeight / 2];
    const keys = {
      ArrowLeft: () => drag(step, 0), ArrowRight: () => drag(-step, 0),
      ArrowUp: () => drag(0, step), ArrowDown: () => drag(0, -step),
      '+': () => zoomAt(KEY_ZOOM, ...mid), '=': () => zoomAt(KEY_ZOOM, ...mid),
      '-': () => zoomAt(1 / KEY_ZOOM, ...mid),
      0: resetView,
      Enter: () => { const v = viewOf(g); pickPoint({ lon: v.lon0, lat: v.lat0 }); },
      ' ': () => setPlaying(!playing),
      '[': () => advance(-HOUR_MS), ']': () => advance(HOUR_MS),
      '{': () => advance(-DAY_MS), '}': () => advance(DAY_MS),
    };
    if (!keys[e.key]) return;
    e.preventDefault();
    keys[e.key]();
  });

  function resetView() {
    Object.assign(g, HOME, { zoom: 1, focus: [0, 0] });
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

  // A link to a region (#europe) opens its chapter.
  function openFromAddress() {
    const r = regions.find(x => x.id === location.hash.slice(1));
    if (r) openChapter(r, g.cell);
  }
  addEventListener('hashchange', openFromAddress);
  openFromAddress();
}

const stage = document.getElementById('map-figure');
if (stage) initMap(stage);
