// The map of 1668: two hemispheres from Natural Earth's coasts, with the
// night where it was at the chosen instant and the book's regions where the
// book places them. Drag or the arrow keys turn the world under the discs;
// the wheel, a pinch or the keys zoom; a region's name zooms to it.
import worldUrl from './euphonia.world.json?url';
import reliefUrl from './euphonia.relief.bin?url';
import { createRelief } from './euphonia.relief.js';
import roseData from './euphonia.roses.json';
import { HEMISPHERES, project, unproject, local, subsolar, onLand } from './euphonia.projection.js';
import { solarParams, solarEvents } from '../bench/bench.sky.js';
import {
  DISC_FILL, toScreen, fromScreen, projectWorld, prepareWorld, palette,
  drawFills, drawLines, drawNight, drawMarks, maxZoom,
} from './euphonia.draw.js';
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
// A press that moves less than this, in CSS pixels, before it lifts is a tap,
// not a drag: a finger's or a hand's jitter.
const TAP_SLOP = 4;
// The Earth's mean radius in kilometres (IUGG), for distances to places.
const EARTH_KM = 6371;
// The tropics' and polar circles' names sit this many degrees of longitude in
// from a disc's western rim, as the period's maps lettered them.
const CIRCLE_NAME_IN = 84;
// The regions' names, in rem: the size of the page's notes.
const LABEL_REM = 0.85;

const regions = places.regions.map(regionShape);

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
// A place as the book names it, with the modern town it's found at when that
// differs: a later name for the same city, or a stand-in nearby.
const placeName = p => (p.modern && p.modern !== p.name ? `${p.name}, at modern ${p.modern}` : p.name);
const degrees = (v, pos, neg) => `${Math.abs(v).toFixed(1)}° ${v >= 0 ? pos : neg}`;

function disc(stage, i, h) {
  const cell = stage.querySelectorAll('.map-disc')[i];
  const canvas = cell.querySelector('canvas');
  return {
    name: h.name, cell, canvas, ctx: canvas.getContext('2d'),
    fills: document.createElement('canvas'), lines: document.createElement('canvas'),
    labels: cell.querySelector('.map-labels'),
    tip: Object.assign(document.createElement('span'), { className: 'map-place', hidden: true }),
    zoom: 1, vx: 0, vy: 0, size: 0, cssSize: 0, dpr: 1, projected: null, baseKey: '',
  };
}

export async function initMap(stage) {
  const world = prepareWorld(await (await fetch(worldUrl)).json(), roseData.roses);
  const tolerance = world.provenance.tolerance_deg;
  const colors = palette(stage);
  const discs = HEMISPHERES.map((h, i) => disc(stage, i, h));
  // The relief arrives after the coasts and joins them when it does.
  let relief = null;
  fetch(reliefUrl).then(r => r.arrayBuffer()).then(bytes => {
    relief = createRelief(bytes, colors);
    for (const d of discs) d.baseKey = '';
    redraw();
  });
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
      b.addEventListener('click', () => openChapter(i, r, b));
      b.addEventListener('pointerenter', () => hover(r));
      b.addEventListener('pointerleave', () => hover(null));
      b.addEventListener('focus', () => hover(r));
      b.addEventListener('blur', () => hover(null));
      d.labels.append(b);
      return b;
    });
  }

  // A region lights while its name or its glow is under the pointer or
  // focused, and while its chapter is open; a lit region shows its places,
  // and the place under the pointer or focus is ringed and named.
  let hovered = null, chosen = null, hoverPlace = null;
  function light() {
    for (const r of regions) r.lit = r === hovered || r === chosen;
    for (const d of discs) d.buttons.forEach((b, k) => b.classList.toggle('is-lit', regions[k].lit));
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
  const pointAt = (d, x, y) => unproject(...fromScreen(cssView(d), x, y), d.lon0);
  for (const d of discs) d.labels.append(d.tip);
  // The circles' names, lettered on the map: placed with the regions' names,
  // giving way to them where the two would print over each other.
  const circleNames = ['Equator', 'Tropic of Cancer', 'Tropic of Capricorn', 'Arctic Circle', 'Antarctic Circle'];
  for (const d of discs) d.circleNames = circleNames.map(name => {
    const span = Object.assign(document.createElement('span'), { className: 'map-circle-name', textContent: name });
    span.setAttribute('aria-hidden', 'true');
    d.labels.append(span);
    return span;
  });
  for (const d of discs) d.tip.setAttribute('aria-hidden', 'true');

  // The scenes' panel, beside the map, for a region's chapter or a picked
  // place: the place's facts first, then its region's chapter, opened where
  // the chapter names the place. It takes focus on opening and gives it back
  // to what opened it on closing, by Escape or the ✕.
  const panel = stage.querySelector('.map-panel');
  const panelTitle = panel.querySelector('.map-panel-title'), panelContent = panel.querySelector('.map-panel-content');
  const panelPlaces = panel.querySelector('.map-panel-places'), panelRegion = panel.querySelector('.map-panel-region');
  const pickSection = panel.querySelector('.map-panel-pick'), pickFacts = panel.querySelector('.map-panel-facts');
  const mentionLine = panel.querySelector('.map-panel-mention');
  const nearby = panel.querySelector('.map-panel-nearby'), readNearby = panel.querySelector('.map-panel-read');
  const status = stage.querySelector('.map-status');
  let opener = null, openDisc = 0, pick = null, nearest = null;
  createPanelCloser(panel, { focus: () => opener?.focus() }, {
    closeBtn: panel.querySelector('.map-panel-close'),
    onClose: () => { chosen = null; pick = null; status.textContent = ''; light(); },
  });
  panel.querySelector('.map-panel-zoom').addEventListener('click', () => zoomToRegion(openDisc, chosen));
  readNearby.addEventListener('click', () => {
    showRegion(nearest.region);
    nearby.hidden = true;
    jumpTo(nearest.place);
  });

  function openPanel(i, button) {
    opener = button; openDisc = i;
    // From the side away from the disc it was opened from, over the other.
    const fromLeft = i === 1;
    if (panel.classList.contains('from-left') !== fromLeft) setPanelSide(panel, fromLeft);
    panel.scrollTop = 0;
    panel.classList.add('open');
  }
  function showRegion(r) {
    if (chosen !== r) {
      chosen = r;
      panelContent.replaceChildren(...[...document.getElementById(r.id).children].filter(c => c.tagName !== 'SUMMARY').map(c => c.cloneNode(true)));
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
  function openChapter(i, r, button) {
    pick = null;
    pickSection.hidden = true;
    showRegion(r);
    clearMention();
    openPanel(i, button);
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
        d.fills.width = d.fills.height = d.lines.width = d.lines.height = d.size;
        drawFills(d.fills.getContext('2d'), v, d.projected, colors, d.dpr, relief);
        drawLines(d.lines.getContext('2d'), v, d.projected, colors, d.dpr);
        d.baseKey = key;
      }
      d.ctx.clearRect(0, 0, d.size, d.size);
      d.ctx.drawImage(d.fills, 0, 0);
      if (night.checked) drawNight(d.ctx, v, sun, colors);
      d.ctx.drawImage(d.lines, 0, 0);
      drawMarks(d.ctx, v, { sun, regions, hoverPlace, pick }, colors, d.dpr);
      placeLabels(d);
    }
    reset.hidden = discs.every(d => d.zoom === 1) && split === SPLIT;
  }

  function placeLabels(d) {
    const v = cssView(d);
    const tip = hoverPlace && local(hoverPlace.lon, hoverPlace.lat, d.lon0)[2] <= 0 && toScreen(v, ...project(hoverPlace.lon, hoverPlace.lat, d.lon0));
    d.tip.hidden = !tip;
    if (tip) {
      d.tip.textContent = placeName(hoverPlace);
      d.tip.style.transform = `translate(${tip[0] + 10}px, ${tip[1]}px) translate(0, -50%)`;
    }
    const boxes = [];
    regions.forEach((r, k) => {
      const [x, y] = toScreen(v, ...project(r.centre.lon, r.centre.lat, d.lon0));
      if (local(r.centre.lon, r.centre.lat, d.lon0)[2] <= 0) boxes.push({ k, x, y, anchorY: y, spread: r.spread, ...d.labelSizes[k] });
      else d.buttons[k].hidden = true;
    });
    // The circles' names, only on the whole disc, left-aligned just above
    // their lines; below every region's name in priority.
    const eps = subsolar(instant).obliquity;
    [0, eps, -eps, 90 - eps, eps - 90].forEach((lat, k) => {
      if (d.zoom !== 1) { d.circleNames[k].hidden = true; return; }
      const [x, y] = toScreen(v, ...project(d.lon0 - CIRCLE_NAME_IN, lat, d.lon0)), { w, h } = d.circleSizes[k];
      boxes.push({ circle: k, x: x + w / 2, y: y - h / 2, anchorY: y - h / 2, spread: -1, w, h });
    });
    place(boxes, v.size / 2, v.R);
    for (const { k, circle, x, y, shown } of boxes) {
      const b = circle === undefined ? d.buttons[k] : d.circleNames[circle];
      b.hidden = !shown;
      if (shown) b.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
  }

  // A picked place: its facts at the top of the panel, kept up to date as
  // time runs; inside a region's glow, the region's chapter under them,
  // opened where it names the place; outside every glow, the nearest named
  // place offered instead. A line for screen readers says what was picked.
  function pickPoint(at, i = discs.findIndex((d, k) => local(at.lon, at.lat, lon0Of(k))[2] <= 0)) {
    pick = at;
    const hit = placeAt(at);
    pickSection.hidden = false;
    readouts();
    clearMention();
    if (hit) {
      showRegion(hit.region);
      nearby.hidden = true;
    } else {
      panelTitle.textContent = 'A place on the map';
      panelRegion.hidden = true;
      chosen = null;
      light();
      nearby.hidden = false;
      readNearby.textContent = `Read about ${placeName(nearest.place)}, in ${nearest.region.name}`;
    }
    openPanel(Math.max(0, i), discs[Math.max(0, i)].cell);
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
      ['Where', `${degrees(at.lat, 'N', 'S')}, ${degrees(at.lon, 'E', 'W')}, ${onLand(world.land, at.lat, at.lon) ? 'on land' : 'at sea'} (Natural Earth's modern coasts)`],
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
    readout.textContent = `${new Date(instant).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })} (Gregorian), ${shown.value} UT: the sun stands overhead at ${degrees(sun.lat, 'N', 'S')}, ${degrees(sun.lon, 'E', 'W')}. ${night.checked ? 'The night side is shaded, darker through each twilight.' : "The night isn't shaded."}`;
  }
  function draw() { readouts(); redraw(); }

  // Play: the instant runs on at the chosen rate (seconds of 1668 a second),
  // through the scenes' frame clock, which caps a step so a tab come back
  // from the background doesn't leap the year. Under reduced motion it steps.
  // The night can be turned off to see the whole world lit; the choice is
  // kept in this browser as a convenience, and the map works without it.
  const night = form.elements.night, NIGHT_KEY = 'pm-euphonia-night';
  try { if (localStorage.getItem(NIGHT_KEY) === 'off') night.checked = false; } catch { /* storage unavailable */ }
  night.addEventListener('change', () => {
    try { localStorage.setItem(NIGHT_KEY, night.checked ? 'on' : 'off'); } catch { /* storage unavailable */ }
    readouts();
    redraw();
  });

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
  }).observe(stage.querySelector('.map-hemispheres'));
  play.addEventListener('click', () => setPlaying(!playing));
  rate.addEventListener('change', () => { if (playing) setPlaying(true); });

  // Sizes in device pixels, from each disc's drawn size; the names keep the
  // page's small type size whatever the disc's.
  new ResizeObserver(() => {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    for (const d of discs) {
      // A hidden stage measures nothing; the discs keep their size until it
      // shows again.
      if (!d.cell.clientWidth) continue;
      d.cssSize = d.cell.clientWidth;
      d.dpr = Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
      d.size = Math.round(d.cssSize * d.dpr);
      d.canvas.width = d.canvas.height = d.size;
      d.labels.style.fontSize = `${LABEL_REM * rem}px`;
      const measure = b => { b.hidden = false; return { w: b.offsetWidth, h: b.offsetHeight }; };
      d.labelSizes = d.buttons.map(measure);
      d.circleSizes = d.circleNames.map(measure);
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
    let pinch = 0, travel = 0;
    d.canvas.addEventListener('pointerdown', e => {
      if (!pointers.size) travel = 0;
      d.canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
      cancelAnimationFrame(zooming);
    });
    d.canvas.addEventListener('pointermove', e => {
      const last = pointers.get(e.pointerId);
      if (!last) {
        const at = pointAt(d, e.offsetX, e.offsetY), hit = at && placeAt(at);
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
        zoomAt(d, span / pinch, (c[0] + f[0]) / 2, (c[1] + f[1]) / 2);
        pinch = span;
      } else {
        drag(d, next[0] - last[0], next[1] - last[1]);
        pointers.set(e.pointerId, next);
      }
    });
    // A single press that barely moved picks the place under it.
    const lift = e => {
      const tap = pointers.size === 1 && pointers.has(e.pointerId) && travel < TAP_SLOP && e.type === 'pointerup';
      pointers.delete(e.pointerId); pinch = 0;
      const at = tap && pointAt(d, e.offsetX, e.offsetY);
      if (at) pickPoint(at, discs.indexOf(d));
    };
    d.canvas.addEventListener('pointerleave', () => { if (!pointers.size) hover(null); });
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
        Enter: () => { const at = unproject(d.vx, d.vy, d.lon0); if (at) pickPoint(at, discs.indexOf(d)); },
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
