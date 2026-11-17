// The globe of 1668: Natural Earth's coasts on one sphere in a globe-maker's
// mount, with the book's regions where the book places them. Drag or the
// arrow keys spin it and set its latitude; the wheel, a pinch or the keys
// zoom; a region's name spins the globe to it.
import worldUrl from './euphonia.world.json?url';
import bordersUrl from './euphonia.borders.json?url';
import reliefUrl from './euphonia.relief.bin?url';
import { createGlobe } from './euphonia.gl.js';
import roseData from './euphonia.roses.json';
import { orthoLocal, orthoUnproject, subsolar, onLand } from './euphonia.projection.js';
import { globeWorld, projectionFor, faces } from './euphonia.globe.js';
import { solarParams, solarEvents } from '../bench/bench.sky.js';
import { fromScreen, palette, drawWheel, drawFills, drawLines, drawMarks, drawMount, maxZoom } from './euphonia.draw.js';
import { viewOf, covers, EXTENT, EYE, clampEye } from './euphonia.mount.js';
import { moonAt } from './euphonia.moon.js';
import { createAmbient, REALM_REACH_REM } from './euphonia.ambient.js';
import { THEMES } from './euphonia.themes.js';
import { currentTheme, setTheme } from './euphonia.theme.js';
import { datesAt } from './euphonia.calendars.js';
import { tideAt, hiddenAt } from './euphonia.tide.js';
import calendars from './euphonia.calendars.json';
import places from 'virtual:euphonia-places';
import wheel from 'virtual:euphonia-wheel';
import { apart, regionShape } from './euphonia.places.js';
import { prefersReducedMotion, createPanelCloser, setPanelSide } from '../utils/sceneKit.js';

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
// The globe opens north up, the whole mount in view, facing its theme's home
// (euphonia.themes.json says each and why): a place the book names, the eye
// at its latitude so it stands in the middle, as a map turned to it would;
// or a meridian, seen from the mount's own eye.
const home = () => {
  const h = currentTheme().home, at = h.place && places.regions.flatMap(r => r.places).find(p => p.name === h.place);
  return { lon0: at ? at.lon : h.lon0, eye: at ? clampEye(at.lat) : EYE, zoom: 1, focus: [0, 0] };
};
// The site's renderers stop at 2x; past it the canvases grow for nothing.
const MAX_PIXEL_RATIO = 2;
// Wheel delta, in pixels, for each doubling of the zoom: Chrome's notch is
// 100, so a notch zooms by 2^(100/240), about a third.
const WHEEL_DOUBLING = 240;
// The keys turn the globe, or raise and lower the eye, five degrees at a time
// (a third of a time zone's width), and zoom by half again.
const KEY_TURN = 5;
const KEY_ZOOM = 1.5;
// A held place follows the pointer to within this many CSS pixels, by at most
// this many of Newton's steps, each turning the mount at most this many
// degrees, its slopes measured over this many degrees.
const FOLLOW_PX = 0.25, FOLLOW_STEPS = 6, FOLLOW_MAX_DEG = 15, FOLLOW_DELTA = 1e-3;
// A step that overshoots is halved at most this many times.
const FOLLOW_HALVINGS = 10;
// zoomTo looks for the zoom that lets it centre a point in steps of this
// ratio, then halves the last step this many times, to well under a pixel; and
// a focus this close to clampZoom's edge (in globe radii) counts as inside.
const ZOOM_SEARCH = 1.25, ZOOM_HALVINGS = 30, ROOM_EPSILON = 1e-9;
// A region's places fill this share of the globe's radius when it's chosen.
const REGION_FIT = 0.8;
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

// A CSS timing function as a curve from time to progress: the keywords are
// cubic Béziers by the spec's own points, and progress at a time is found by
// halving the Bézier's parameter until its x is the time (thirty halvings
// pass a double's precision).
const KEYWORD_EASES = { linear: [0, 0, 1, 1], ease: [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1] };
function cubicBezier(css) {
  const [x1, y1, x2, y2] = KEYWORD_EASES[css] ?? css.match(/-?[\d.]+/g).map(Number);
  const at = (a, b, s) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  return t => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) { const s = (lo + hi) / 2; if (at(x1, x2, s) < t) lo = s; else hi = s; }
    return at(y1, y2, (lo + hi) / 2);
  };
}

const regions = places.regions.map(regionShape);

// Where names would print over each other, the larger region's goes first
// (its places spread furthest), and each after it tries its own spot, then
// just below or just above the name in its way, moving at most its own
// height; a name that fits none of them, or wouldn't lie whole on the
// globe's face (inside its limb), isn't drawn at this size. A name may print
// across the meridian ring, thin brass under its halo. Zooming in makes room, and every region's
// chapter is in the panel's contents. Boxes are centred on (x, y), with
// each name measured once per type size: reading the layout back each frame
// would lay out the whole page each time. Lettered names, bare type with no
// button round them, keep an em clear of each other side by side: closer
// than a word space (a quarter em), two names read as one.
function place(boxes, open) {
  const placed = [];
  const blockerOf = b => placed.find(o => Math.abs(b.x - o.x) < (b.w + o.w) / 2 + Math.max(b.clear ?? 0, o.clear ?? 0) && Math.abs(b.y - o.y) < (b.h + o.h) / 2);
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


export async function initMap(stage) {
  // The world's rings, kept for land-or-sea, and as the globe draws them,
  // with the polities of 1668.
  const [data, borders] = await Promise.all([worldUrl, bordersUrl].map(async url => (await fetch(url)).json()));
  const world = globeWorld(data, roseData.roses, borders);
  const tolerance = data.provenance.tolerance_deg;
  const colors = palette(stage);
  const cell = stage.querySelector('.map-disc'), canvas = cell.querySelector('canvas:not(.map-ambient)');
  const ambientCanvas = cell.querySelector('.map-ambient');
  const g = {
    cell, canvas, ctx: canvas.getContext('2d'),
    fills: document.createElement('canvas'), lines: document.createElement('canvas'), wheel: document.createElement('canvas'),
    mountBack: document.createElement('canvas'), mountFront: document.createElement('canvas'),
    labels: cell.querySelector('.map-labels'),
    tip: Object.assign(document.createElement('span'), { className: 'map-place', hidden: true }),
    ...home(), width: 0, height: 0, cssWidth: 0, cssHeight: 0, cover: 0, dpr: 1, baseKey: '',
  };

  // The moment's readouts, on the panel's This moment page, kept up to date
  // whether or not it's open.
  const moment = stage.querySelector('.map-panel-moment');
  const readout = moment.querySelector('.map-readout');
  const moonLine = moment.querySelector('.map-moon'), moonLit = moonLine.querySelector('.lit'), moonText = moonLine.querySelector('span');
  const datesTable = moment.querySelector('.map-dates'), datesBody = datesTable.tBodies[0];
  const tideLine = moment.querySelector('.map-tide');
  // The map's two buttons sit in the bar over it, beside the tabs.
  const reset = document.querySelector('.map-reset');
  const hiddenText = ({ half, open }) => [
    half === 'dark' ? 'the dark half' : half === 'other' ? 'the other half' : 'as the DM says',
    open && `${open}'s open night`,
  ].filter(Boolean).join('; ');
  const day = ms => new Date(ms).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long' });
  const clock = ms => { const d = new Date(ms); return `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`; };

  // The instant the map holds: today's month and day in the book's year,
  // which runs from Samhain 1668 to Samhain 1669, at this moment's UT.
  const now = new Date();
  const instant = Date.UTC(now.getMonth() >= 10 ? 1668 : 1669, now.getMonth(), now.getDate(), now.getUTCHours(), now.getUTCMinutes());
  // The globe in WebGL2 where it can be (euphonia.gl.js), on a canvas of its
  // own between two that hold the mount, behind it and before it; the canvas
  // the page has keeps the pointer and holds the mount's front. The relief's
  // grid joins it when it arrives. Without WebGL2, that one canvas draws it
  // all in 2D.
  const layer = () => Object.assign(document.createElement('canvas'), { className: 'map-layer' });
  const backCanvas = layer(), globeCanvas = layer();
  for (const c of [backCanvas, globeCanvas]) c.setAttribute('aria-hidden', 'true');
  let globe = null;
  try { globe = createGlobe(globeCanvas, world, colors, subsolar(instant).obliquity); } catch (err) { console.warn(`The globe falls back to 2D: ${err.message}`); }
  if (globe) {
    canvas.before(backCanvas, globeCanvas);
    fetch(reliefUrl).then(r => r.arrayBuffer()).then(bytes => { globe.grid(bytes); g.baseKey = ''; redraw(); });
  }
  // The Wheel behind the globe, alive on its own canvas (euphonia.ambient.js),
  // its planets where they stood at that instant.
  const ambient = createAmbient(ambientCanvas, {
    wheel, colors, instant, sky: { sun: solarParams(instant).longitude, moon: moonAt(instant) }, top: document.querySelector('.euphonia-top'),
  });

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
  let hovered = null, chosen = null, hoverPlace = null, held = null;
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
  // The polity of 1668 that holds a point of the globe, if any: the book's
  // ✦ departures first, for they stand where the record has someone else or
  // no one; then a place a departure holds from outside its ring (Sofala,
  // the plateau's port), within that place's glow; then the record's rings.
  // Each is tested as the land is, inside its box first.
  const departures = world.polities.filter(q => q.kind === 'departs');
  const ordered = [...departures, ...world.polities.filter(q => q.kind !== 'departs')];
  const boxes = ordered.map(q => {
    const pts = q.polys.flat(2);
    return [Math.min(...pts.map(c => c[0])), Math.min(...pts.map(c => c[1])), Math.max(...pts.map(c => c[0])), Math.max(...pts.map(c => c[1]))];
  });
  const inside = (k, at) => {
    const [x0, y0, x1, y1] = boxes[k];
    return at.lon >= x0 && at.lon <= x1 && at.lat >= y0 && at.lat <= y1 && onLand(ordered[k].polys.flat(), at.lat, at.lon);
  };
  const glows = new Map(regions.flatMap(r => r.glows.map(gl => [gl.name, gl])));
  const heldFrom = departures.flatMap(q => (q.holds ?? []).map(h => ({ q, glow: glows.get(h.name), at: { lon: h.lonlat[0], lat: h.lonlat[1] } })))
    .filter(x => x.glow && !onLand(x.q.polys.flat(), x.at.lat, x.at.lon));
  const polityAt = at => {
    const k = ordered.findIndex((q, i) => q.kind === 'departs' && inside(i, at));
    if (k >= 0) return ordered[k];
    const held = heldFrom.find(x => apart(x.glow, at) <= x.glow.rho);
    if (held) return held.q;
    const r = ordered.findIndex((q, i) => q.kind !== 'departs' && inside(i, at));
    return r >= 0 ? ordered[r] : null;
  };
  // Firm ground, the record's or the book's. A zone's polity is named under
  // the pointer but not washed: its outline is how far it reaches, and a
  // wash would claim the peoples within for it.
  const firm = q => q.kind === 'line' || q.cls === 'firm';
  // The polity under the pointer, where no place is: named, and washed if
  // it is firm.
  function hold(at) {
    const q = at && polityAt(at);
    if (!q && !held) return;
    held = q ? { polity: q, at, wash: firm(q) ? q : null } : null;
    redraw();
  }
  // The point of the globe under (x, y), unless the mount is in the way.
  const pointAt = (x, y) => {
    const v = cssView();
    if (inTheWay(v, x, y)) return null;
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
  // The names the book letters on the land: those it sets beside or within
  // its ✦ shapes (Butua beside Mutapa, the Cape's Khoekhoe, Laicacota fought
  // over) and the peoples each chapter sets on their country (its @peoples
  // line). Lettered once the glass frames their region, giving way to every
  // other name. The chapter carries them for a screen reader.
  const shapeRegion = new Map(world.polities.filter(q => q.kind === 'departs').map(q => [q.name, regions.find(r => r.name === q.region)]));
  // A people whose town is on the shore was the coast: its name is lettered
  // out over the sea from the town. The shore is the borders' band, and the
  // sea lies where a step of it in any of eight directions leaves the land;
  // seaward is the mean of those steps. A town with the sea all round (a
  // small island) has no one seaward side, and its name stays centred on it.
  const shore = borders.provenance.shore_deg;
  const seaward = at => {
    const wet = Array.from({ length: 8 }, (_, i) => i * Math.PI / 4)
      .map(a => ({ lon: at.lon + shore * Math.cos(a) / Math.cos(at.lat * RAD), lat: at.lat + shore * Math.sin(a) }))
      .filter(p => !onLand(data.land, p.lat, p.lon));
    if (!wet.length || wet.length === 8) return null;
    return { lon: wet.reduce((t, p) => t + p.lon, 0) / wet.length, lat: wet.reduce((t, p) => t + p.lat, 0) / wet.length };
  };
  const lettered = [
    ...world.names.map(n => ({ name: n.name, kind: n.kind, at: { lon: n.lonlat[0], lat: n.lonlat[1] }, region: shapeRegion.get(n.of) })),
    ...regions.flatMap(r => r.peoples.map(n => {
      const at = { lon: n.lon, lat: n.lat };
      return { name: n.name, kind: 'people', at, region: r, sea: seaward(at) };
    })),
  ];
  g.bookNames = lettered.map(n => {
    const span = Object.assign(document.createElement('span'), { className: `map-book-name is-${n.kind}`, textContent: n.name });
    span.setAttribute('aria-hidden', 'true');
    g.labels.append(span);
    return span;
  });
  g.tip.setAttribute('aria-hidden', 'true');

  // The scenes' panel, beside the map, and everything there is to read: the
  // contents, a region's chapter, a picked place (its facts first, then its
  // region's chapter, opened where the chapter names the place), and the
  // book's other pages. It takes focus on opening and gives it back to what
  // opened it on closing, by Escape or the ×.
  const panel = stage.querySelector('.map-panel');
  const panelTitle = panel.querySelector('.map-panel-title'), panelContent = panel.querySelector('.map-panel-content');
  const panelPlaces = panel.querySelector('.map-panel-places'), panelRegion = panel.querySelector('.map-panel-region');
  const pickSection = panel.querySelector('.map-panel-pick'), pickFacts = panel.querySelector('.map-panel-facts');
  const mentionLine = panel.querySelector('.map-panel-mention');
  const nearby = panel.querySelector('.map-panel-nearby'), readNearby = panel.querySelector('.map-panel-read');
  const status = stage.querySelector('.map-status');
  const pages = [...panel.querySelectorAll('.map-panel-page')], back = panel.querySelector('.map-panel-back');
  const contentsOpen = document.querySelector('.map-contents-open');
  let opener = null, pick = null, nearest = null;
  // What a name in the panel turned the glass to (a person, a place, a
  // ruler), ringed where it stands with its label.
  let marked = null;
  const closer = createPanelCloser(panel, { focus: () => opener?.focus() }, {
    closeBtn: panel.querySelector('.map-panel-close'),
    // Where the focus goes on closing is this page's to say (opener, above).
    returnToOrigin: false,
    // Closed, the glass draws back to the whole mount as the panel slides
    // away, the globe still turned where the reader left it.
    onClose: () => { unpeek(); chosen = null; pick = null; marked = null; status.textContent = ''; light(); zoomTo({ lon: g.lon0, lat: viewOf(g).lat0 }, 1); },
  });
  panel.querySelector('.map-panel-zoom').addEventListener('click', () => zoomToRegion(chosen));
  // A region whose power has a theme offers it; the page never changes on its
  // own.
  const themeOffer = panel.querySelector('.map-panel-theme'), themeButton = themeOffer.querySelector('button');
  function offerTheme(r) {
    const offer = r && THEMES.find(t => t.region === r.name && t.id !== currentTheme().id);
    themeOffer.hidden = !offer;
    if (offer) { themeButton.textContent = `See the page in the colours of ${offer.name}`; themeButton.dataset.theme = offer.id; }
  }
  themeButton.addEventListener('click', () => setTheme(themeButton.dataset.theme));
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
  // The front door's ways in: another page of the book, or out of the panel to
  // the globe, or by its link to the builder, whose tab then has the focus.
  panel.querySelector('.map-panel-welcome').addEventListener('click', e => {
    const b = e.target.closest('[data-page], [data-leave]');
    if (!b) return;
    if (b.dataset.page) { showPage(b.dataset.page); panelTitle.focus(); return; }
    opener = b.matches('a') ? document.getElementById('tab-builder') : cell;
    closer.close();
  });
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

  // The panel comes in from the right, over the globe's eastern edge. Whether
  // it was closed, and so is sliding in now.
  function openPanel(button) {
    unpeek();
    const arriving = !panel.classList.contains('open');
    opener = button;
    if (panel.classList.contains('from-left')) setPanelSide(panel, false);
    panel.scrollTop = 0;
    panel.classList.add('open');
    return arriving;
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
    offerTheme(r);
    light();
  }
  // A region's name, or a link to it, opens its chapter at the start, and the
  // glass closes on the region.
  function openChapter(r, button) {
    pick = null;
    pickSection.hidden = true;
    showRegion(r);
    clearMention();
    openPanel(button);
    zoomToRegion(r);
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
  // A panel still sliding in goes straight there, so its text arrives still.
  function jumpTo(place, smooth = true) {
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
    // The panel scrolls the mark to its middle; scrollIntoView would scroll
    // the page under the globe as well.
    requestAnimationFrame(() => {
      const top = mark.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop;
      panel.scrollTo({ top: top - panel.clientHeight / 2, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
      mark.focus({ preventScroll: true });
    });
    return mark;
  }

  // The globe's radius at zoom 1, in CSS pixels: the whole mount fitted
  // inside the Wheel's rim, which stands a realm's reach in from the window's
  // edge (g.margin), so the Wheel shows whole about it. At zoom 1 the
  // globe's centre sits at `anchor`; zoomed, the mount is magnified about the
  // point `focus` (in globe radii from there), as under a glass.
  // On a phone the open panel is a sheet over the stage's foot (g.cover, its
  // height there); the globe fits and centres in what is left above it.
  const freeHeight = () => g.cssHeight - g.cover;
  const fit = () => Math.min((g.cssWidth - 2 * g.margin) / (2 * EXTENT.halfWidth), (freeHeight() - 2 * g.margin) / (EXTENT.top + EXTENT.bottom));
  const anchor = () => [g.cssWidth / 2, freeHeight() / 2 + fit() * (EXTENT.top - EXTENT.bottom) / 2];
  // The view at a scale, with the globe turned as `turn` says (its spin and
  // the eye's height), by default as it stands.
  const viewAt = (scale, turn = g) => {
    const k = fit() * g.zoom, [ax, ay] = anchor();
    return {
      ...viewOf(turn), k: k * scale,
      cx: (ax - k * g.focus[0]) * scale, cy: (ay + k * g.focus[1]) * scale,
      width: Math.round(g.cssWidth * scale), height: Math.round(g.cssHeight * scale),
    };
  };
  const cssView = () => viewAt(1);
  const atHome = () => g.zoom === 1 && g.lon0 === home().lon0 && g.eye === home().eye;
  // The mount and the Wheel are lettered in the theme's type, roman and (the
  // Wheel's roads) italic, redrawn once the faces arrive.
  let font;
  function loadType() {
    font = getComputedStyle(cell).fontFamily;
    const asked = font;
    Promise.all([document.fonts.load(`16px ${font}`), document.fonts.load(`italic 16px ${font}`)]).then(() => { if (font === asked) { g.typeSet = font; redraw(); } });
  }
  loadType();

  let frame = 0;
  const redraw = () => { if (!frame) frame = requestAnimationFrame(render); };
  // While the globe turns, a frame at full resolution can cost more than a
  // frame's time on a slow machine, or where the globe falls back to 2D (a
  // drag measured 150 ms a frame in Firefox at 2× in 2D; in WebGL it keeps
  // to the display's frames). Then it turns at the CSS pixel's resolution, a
  // quarter the pixels, and is drawn at full resolution again once it has
  // been still for SETTLE_MS; each full frame measures the cost again.
  const FRAME_MS = 1000 / 60, SETTLE_MS = 150;
  let turned = '', lastTurn = -Infinity, slow = false, settle = 0;

  function render() {
    frame = 0;
    if (!g.width) return;
    const begun = performance.now(), turn = `${g.lon0}|${g.eye}|${g.zoom}|${g.focus}`, turning = turn !== turned;
    const scale = turning && slow && begun - lastTurn < SETTLE_MS ? 1 : g.dpr;
    if (turning) {
      turned = turn;
      clearTimeout(settle);
      if (scale !== g.dpr) settle = setTimeout(redraw, SETTLE_MS);
    }
    const v = viewAt(scale);
    if (g.canvas.width !== v.width || g.canvas.height !== v.height) { g.canvas.width = v.width; g.canvas.height = v.height; }
    // The Wheel is the frame the cosmos is read in, Good up and Law to the
    // left, not a place on the earth: it stays as the window frames it at
    // home while the globe turns, zooms and slides, and is drawn again only
    // when the window or the type changes.
    const framing = `${g.width}x${g.height}|${g.dpr}|${g.typeSet}`;
    if (framing !== g.wheelKey) {
      g.wheel.width = ambientCanvas.width = g.width; g.wheel.height = ambientCanvas.height = g.height;
      const [ax, ay] = anchor(), f = fit(), framed = { cx: ax * g.dpr, cy: ay * g.dpr, k: f * g.dpr };
      drawWheel(g.wheel.getContext('2d'), framed, wheel, g.rim, colors, g.dpr, font, g.rem, currentTheme().smallCaps);
      ambient.setFrame({ view: framed, rim: g.rim, dpr: g.dpr, rem: g.rem, wheel: g.wheel });
      g.wheelKey = framing;
    }
    const key = `${turn}|${v.width}x${v.height}`, based = key !== g.baseKey;
    if (based) {
      if (!globe) {
        for (const c of [g.fills, g.lines]) { c.width = v.width; c.height = v.height; }
        drawFills(g.fills.getContext('2d'), v, world, colors, scale);
        drawLines(g.lines.getContext('2d'), v, world, colors, scale);
      }
      g.baseKey = key;
      // What Enter picks, marked at the globe's centre when it's focused,
      // and the latitude it faces, for those who can't see it.
      g.cell.style.setProperty('--globe-x', `${v.cx / scale}px`);
      g.cell.style.setProperty('--globe-y', `${v.cy / scale}px`);
      // Set only when it reads differently: each set is news to a screen reader.
      const label = `The globe, facing ${degrees(g.eye, 'N', 'S')}`;
      if (g.cell.getAttribute('aria-label') !== label) g.cell.setAttribute('aria-label', label);
    }
    // The mount turns with nothing the globe does but the eye, the glass and
    // the theme, so its two passes are drawn into layers of their own and
    // kept until one of those changes; a turn of the globe reuses them.
    const shown = recede();
    const mountKey = `${g.eye}|${g.zoom}|${g.focus}|${v.width}x${v.height}|${g.typeSet}|${currentTheme().id}`;
    const layers = globe ? [[backCanvas, 'back'], [canvas, 'front']] : [[g.mountBack, 'back'], [g.mountFront, 'front']];
    if (shown && mountKey !== g.mountKey) {
      const mount = { eye: g.eye, font };
      for (const [layer, pass] of layers) {
        layer.width = v.width; layer.height = v.height;
        drawMount(layer.getContext('2d'), v, pass, mount, colors, scale);
      }
      g.mountKey = mountKey;
    }
    if (globe) {
      // The mount recedes by its layers' opacity; the globe is drawn whole.
      backCanvas.style.opacity = canvas.style.opacity = String(shown);
      globe(v, { regions, hoverPlace: hoverPlace ?? marked, pick, polity: held?.wash, scale });
    } else {
      g.ctx.clearRect(0, 0, v.width, v.height);
      g.ctx.globalAlpha = shown;
      if (shown) g.ctx.drawImage(g.mountBack, 0, 0);
      g.ctx.globalAlpha = 1;
      g.ctx.drawImage(g.fills, 0, 0);
      g.ctx.drawImage(g.lines, 0, 0);
      drawMarks(g.ctx, v, { obliquity: subsolar(instant).obliquity, regions, hoverPlace: hoverPlace ?? marked, pick, polity: held?.wash }, colors, scale);
      g.ctx.globalAlpha = shown;
      if (shown) g.ctx.drawImage(g.mountFront, 0, 0);
      g.ctx.globalAlpha = 1;
    }
    placeLabels();
    reset.hidden = atHome();
    ambient.fade(shown);
    // Still means no turn for SETTLE_MS after the last frame's end, however
    // long that frame took.
    if (based && scale === g.dpr) slow = performance.now() - begun > FRAME_MS;
    if (turning) lastTurn = performance.now();
  }
  // The Wheel and the mount recede as the glass closes on the earth: wholly
  // there at the whole mount, gone by the zoom at which the mount covers the
  // window on both axes, evenly in the zoom's logarithm, as the zoom itself
  // runs. They frame the whole globe; under the glass they'd stand in front
  // of the place looked at.
  function recede() {
    const f = fit(), cover = Math.max(g.cssWidth / (2 * EXTENT.halfWidth * f), g.cssHeight / ((EXTENT.top + EXTENT.bottom) * f));
    return cover > 1 ? 1 - Math.min(1, Math.log(g.zoom) / Math.log(cover)) : 1;
  }
  // The mount stands in the way of the globe only while it's whole: one the
  // eye sees through hides nothing behind it.
  const inTheWay = (v, x, y) => recede() === 1 && covers((x - v.cx) / v.k, (v.cy - y) / v.k, g.eye);

  function placeLabels() {
    const v = cssView(), project = projectionFor(v);
    // A point of the canvas on the globe's face: inside its limb, and on
    // the canvas.
    const open = (x, y) => Math.hypot(x - v.cx, y - v.cy) <= v.k && x >= 0 && x <= v.width && y >= 0 && y <= v.height;
    const ringed = hoverPlace ?? marked ?? held?.at;
    const tip = ringed && faces(v, ringed) && project([ringed.lon, ringed.lat]);
    g.tip.hidden = !tip;
    if (tip) {
      g.tip.textContent = hoverPlace ? placeName(hoverPlace) : marked ? marked.label : `${held.polity.label}${held.polity.kind === 'departs' ? ' ✦' : ''}`;
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
      const [x, y] = project([p.lon, p.lat]), { w, h, em } = g.circleSizes[k];
      boxes.push({ circle: k, x: x + w / 2, y: y - h / 2, anchorY: y - h / 2, spread: -1, w, h, clear: em });
    });
    // The book's names, last of all.
    lettered.forEach(({ at: p, region: r, sea }, k) => {
      if (!r || g.zoom < regionZoom(r) || !faces(v, p)) { g.bookNames[k].hidden = true; return; }
      const [x, y] = project([p.lon, p.lat]), { w, h, em } = g.bookNameSizes[k];
      // Seaward as the globe now turns: the side of the town the sea lies on.
      const side = sea ? Math.sign(project([sea.lon, sea.lat])[0] - x) : 0;
      boxes.push({ bookName: k, x: x + side * w / 2, y, anchorY: y, spread: -2, w, h, clear: em });
    });
    place(boxes, open);
    for (const { k, circle, bookName, x, y, shown } of boxes) {
      const b = bookName !== undefined ? g.bookNames[bookName] : circle === undefined ? g.buttons[k] : g.circleNames[circle];
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
    marked = null;
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
    const arriving = openPanel(g.cell);
    // The glass closes on the pick: to its region's scale (the nearest
    // region's, outside every glow), and a step past wherever it already is.
    zoomTo(at, Math.max(regionZoom(hit ? hit.region : nearest.region), g.zoom * KEY_ZOOM));
    const mark = hit && jumpTo(hit.place, !arriving);
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
    const polity = polityAt(at);
    return [
      ['Where', `${degrees(at.lat, 'N', 'S')}, ${degrees(at.lon, 'E', 'W')}, ${onLand(data.land, at.lat, at.lon) ? 'on land' : 'at sea'} (Natural Earth's modern coasts)`],
      ['In 1668', polity ? (polity.kind === 'departs' ? `${polity.label}, the book's: ${polity.star}` : polity.ground ? `${polity.label}'s reach, ${polity.ground}, by Cliopatria's record and the book's` : `${polity.label}, by Cliopatria's record`) : "no state, by Cliopatria's record"],
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
    readout.textContent = `${new Date(instant).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })} (Gregorian), ${clock(instant)} UT: the sun stands overhead at ${degrees(sun.lat, 'N', 'S')}, ${degrees(sun.lon, 'E', 'W')}.`;
  }
  function draw() { readouts(); redraw(); }

  // Sizes in device pixels, from the globe's drawn size; the names keep the
  // page's small type size whatever the globe's. The first measure settles
  // `measured`.
  let firstMeasure;
  const measured = new Promise(resolve => { firstMeasure = resolve; });
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
    // The Wheel's rim: the window's edge about the globe's centre at zoom 1,
    // less a realm's reach, in globe radii, so a realm on it keeps its whole
    // light in the window, and the four words lettered on it stand clear of
    // the edge. The mount fits inside it (fit), so it never meets the globe.
    g.rem = rem;
    g.margin = REALM_REACH_REM * rem;
    g.cover = sheetCover();
    placeRim();
    const measure = b => { b.hidden = false; return { w: b.offsetWidth, h: b.offsetHeight, em: parseFloat(getComputedStyle(b).fontSize) }; };
    g.labelSizes = g.buttons.map(measure);
    g.circleSizes = g.circleNames.map(measure);
    g.bookNameSizes = g.bookNames.map(measure);
    g.baseKey = '';
    clampZoom();
    redraw();
    firstMeasure();
  }).observe(stage.querySelector('.map-globe'));

  // Zoom stays between the whole mount and the coasts' resolution. Along
  // each axis the glass's focus keeps the magnified mount covering the canvas
  // where it overflows, its middle straying from the canvas's by at most the
  // difference of their half sizes; where the mount fits inside, it stands in
  // the middle, so the glass drawn back always brings the globe home, and the
  // room to stray closes to nothing just as the mount stops overflowing. Along
  // y the mount's middle sits `rise` above the globe's centre, which the anchor
  // offsets by rise at zoom 1, so focus `rise * (1 - 1 / zoom)` centres it.
  // The focus's room at a zoom, along each axis: its centre and how far it
  // may stray from it.
  const room = zoom => {
    const k = fit() * zoom, rise = (EXTENT.top - EXTENT.bottom) / 2;
    const slack = (half, size) => Math.max(0, half - size / (2 * k));
    return [[0, slack(EXTENT.halfWidth, g.cssWidth)], [rise * (1 - 1 / zoom), slack((EXTENT.top + EXTENT.bottom) / 2, freeHeight())]];
  };
  function clampZoom() {
    if (!g.cssWidth) return;
    g.zoom = Math.min(Math.max(g.zoom, 1), maxZoom(tolerance, fit()));
    g.focus = room(g.zoom).map(([centre, s], i) => Math.max(centre - s, Math.min(centre + s, g.focus[i])));
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
  // A drag that takes hold of the globe keeps the place it took hold of under
  // the pointer, moving only as the reader can: spinning the globe on its
  // axis and raising or lowering the eye. Those are two unknowns, and the
  // place landing on the pointer is two equations, met by Newton's method on
  // the projection the globe is drawn with, from where it stands. A place
  // dragged past the globe's edge, or farther than the eye can rise or sink
  // to carry it, can't follow; the globe goes as far toward the pointer as
  // brings it nearer, and holds.
  function follow(place, x, y) {
    const lonlat = [place.lon, place.lat];
    let turn = { lon0: g.lon0, eye: g.eye };
    const at = t => projectionFor(viewAt(1, t))(lonlat);
    const miss = t => { const [px, py] = at(t); return [px - x, py - y]; };
    for (let i = 0; i < FOLLOW_STEPS; i++) {
      const r = miss(turn);
      if (Math.hypot(...r) < FOLLOW_PX) break;
      const dl = miss({ ...turn, lon0: turn.lon0 + FOLLOW_DELTA }), ds = miss({ ...turn, eye: turn.eye + FOLLOW_DELTA });
      const j = [[(dl[0] - r[0]) / FOLLOW_DELTA, (ds[0] - r[0]) / FOLLOW_DELTA], [(dl[1] - r[1]) / FOLLOW_DELTA, (ds[1] - r[1]) / FOLLOW_DELTA]];
      const det = j[0][0] * j[1][1] - j[0][1] * j[1][0];
      if (!det) break;
      const cap = v => Math.max(-FOLLOW_MAX_DEG, Math.min(FOLLOW_MAX_DEG, v));
      const step = [cap((j[1][1] * r[0] - j[0][1] * r[1]) / det), cap((j[0][0] * r[1] - j[1][0] * r[0]) / det)];
      // Only toward the pointer, and only with the place still in front: a
      // step that overshoots is halved until it lands nearer, or given up.
      let next = null;
      for (let h = 0, f = 1; h < FOLLOW_HALVINGS && !next; h++, f /= 2) {
        const t = { lon0: turn.lon0 - f * step[0], eye: clampEye(turn.eye - f * step[1]) };
        if (Math.hypot(...miss(t)) < Math.hypot(...r) && faces(viewAt(1, t), place)) next = t;
      }
      if (!next) break;
      turn = next;
    }
    g.lon0 = ((turn.lon0 + 540) % 360) - 180;
    g.eye = turn.eye;
    redraw();
  }
  // A drag on the mount or the space about it works the globe directly:
  // across, it spins the globe on its axis (at the centre a radius of travel
  // per radian, so dx pixels turn it dx / k radians); down, the eye rises and
  // the north comes to the middle, and up it sinks toward the south, as far
  // as the poles.
  function drag(dx, dy) {
    const k = fit() * g.zoom;
    g.lon0 = ((g.lon0 - dx / k / RAD + 540) % 360) - 180;
    g.eye = clampEye(g.eye + dy / k / RAD);
    redraw();
  }

  // The globe spins a point to face the eye, the eye comes to its latitude,
  // and the glass closes on it to `zoom`. A region's zoom brings its
  // places to fill REGION_FIT of the globe's radius (orthographic carries an
  // angle rho from the centre to sin rho). The point comes to the middle of
  // what the open panel leaves showing, where that is the larger part, and
  // the glass closes at least far enough for clampZoom to let it: from the
  // zoom asked for, up until the focus that centres the point lies in the
  // room clampZoom allows, the edge of that room found by halving.
  //
  // On the way, the zoom runs evenly in scale (by its logarithm) while the
  // point glides on a straight line across the screen to where it settles:
  // each frame turns the globe, sets the scale, then puts the focus where the
  // point lands on that line. It moves as the panel slides, over the panel's
  // own transition (euphonia.css), from the first frame either draws; a
  // reader who asks for less motion has none there, and none here.
  let zooming = 0;
  const regionZoom = r => REGION_FIT / Math.sin(Math.max(r.spread, 1) * RAD);
  const zoomToRegion = r => zoomTo(r.centre, regionZoom(r));
  // A name in the panel turns the glass to where the book places it, a step
  // closer than its region's scale, and rings the spot with its label; the
  // page the reader came from stays open beside it. The names are a person's
  // (their entry's @at line), a place a chapter's @places line names, and a
  // title, ruler or power its @names line places.
  const people = new Map(places.people.map(p => [p.name, p]));
  // Where the panel covers most of the globe (a phone), it steps aside to a
  // strip along the globe's foot, the label and a way back, so the turn and
  // the ring show above it; back, the panel returns where the reader was.
  const peek = stage.querySelector('.map-peek'), peekLabel = peek.querySelector('.map-peek-label');
  let peekedFrom = null;
  function unpeek() {
    if (peek.hidden) return;
    panel.classList.remove('peeked');
    peek.hidden = true;
  }
  peek.addEventListener('click', () => {
    unpeek();
    peekedFrom?.focus({ preventScroll: true });
    peekedFrom = null;
  });
  function showMark(at, label, r, from) {
    marked = { lat: at.lat, lon: at.lon, label };
    if (panel.offsetWidth >= g.cssWidth / 2) {
      peekedFrom = from;
      panel.classList.add('peeked');
      peekLabel.textContent = label;
      peek.hidden = false;
      peek.querySelector('button').focus({ preventScroll: true });
    }
    zoomTo(at, Math.max(r ? regionZoom(r) : 1, g.zoom) * KEY_ZOOM);
    status.textContent = `${label}.`;
    redraw();
  }
  panel.addEventListener('click', e => {
    const b = e.target.closest('button.map-person, button.map-mark');
    if (!b) return;
    if (b.dataset.person) {
      const p = people.get(b.dataset.person);
      if (p) showMark(p, `${p.name}, at ${p.place}`, regions.find(x => x.id === p.region), b);
      return;
    }
    const r = regions.find(x => x.id === b.dataset.region);
    const place = b.dataset.place && r?.glows.find(x => x.name === b.dataset.place);
    const named = b.dataset.name && r?.names.find(x => x.name === b.dataset.name);
    if (place) showMark(place, placeName(place), r, b);
    else if (named) showMark(named, `${named.name}, at ${named.modern}`, r, b);
  });
  // Where the point (lon, lat) is on the mount, in radii at zoom 1 from the
  // globe's centre, with the globe turned to lon0 and seen from `eye`.
  const onMount = (at, lon0, eye = g.eye) => {
    const v = viewOf({ lon0, eye });
    return orthoLocal(at.lon, at.lat, v.lon0, v.lat0);
  };
  // Where the glass comes to rest on a point: the turn, the eye, zoom and
  // focus that centre it, with the panel's share of the canvas, `cover`, set
  // aside. The eye comes to the point's latitude, as far as it can go, so the
  // point stands at the globe's middle, where the mount never covers it.
  function aim(at, zoom, cover = panel.classList.contains('open') ? panel.offsetWidth : 0) {
    const lon0 = at.lon, eye = clampEye(at.lat), [px, py] = onMount(at, lon0, eye), f = fit();
    // Half the canvas, and the shift past the panel, in radii at zoom 1.
    const S = cover < g.cssWidth / 2 ? cover / (2 * f) : 0;
    const centred = z => [px + S / z, py];
    const fits = z => room(z).every(([centre, s], i) => Math.abs(centred(z)[i] - centre) <= s + ROOM_EPSILON);
    const most = maxZoom(tolerance, f);
    let z = Math.min(Math.max(zoom, 1), most);
    if (!fits(z)) {
      let lo = z;
      while (z < most && !fits(z)) { lo = z; z = Math.min(most, z * ZOOM_SEARCH); }
      for (let i = 0; i < ZOOM_HALVINGS && fits(z); i++) { const mid = Math.sqrt(lo * z); if (fits(mid)) z = mid; else lo = mid; }
    }
    return { lon0, eye, zoom: z, focus: [px + S / z, py], px, py };
  }
  function zoomTo(at, zoom) {
    const f = fit(), target = aim(at, zoom), { px, py, zoom: z } = target;
    const from = { lon0: g.lon0, eye: g.eye, zoom: g.zoom, focus: g.focus };
    const dlon = ((target.lon0 - from.lon0 + 540) % 360) - 180;
    // The point on the screen, about the anchor, for a turn, scale and focus.
    const onScreen = ([x, y], k, focus) => [k * (x - focus[0]), -k * (y - focus[1])];
    const start = onScreen(onMount(at, from.lon0), f * from.zoom, from.focus), end = onScreen([px, py], f * z, target.focus);
    const step = e => {
      g.zoom = Math.exp(Math.log(from.zoom) + (Math.log(target.zoom) - Math.log(from.zoom)) * e);
      g.lon0 = ((from.lon0 + dlon * e + 540) % 360) - 180;
      g.eye = from.eye + (target.eye - from.eye) * e;
      const [x, y] = onMount(at, g.lon0), k = f * g.zoom;
      const sx = start[0] + (end[0] - start[0]) * e, sy = start[1] + (end[1] - start[1]) * e;
      g.focus = [x - sx / k, y + sy / k];
      clampZoom();
      redraw();
    };
    cancelAnimationFrame(zooming);
    const { seconds, ease } = slide();
    if (!seconds) { step(1); return; }
    let begun = 0;
    const tick = now => {
      begun ||= now;
      const t = Math.min(1, (now - begun) / (seconds * 1000));
      step(ease(t));
      if (t < 1) zooming = requestAnimationFrame(tick);
    };
    zooming = requestAnimationFrame(tick);
  }
  // The panel's slide, as its stylesheet times it: how long, and the curve,
  // read from the computed transition on transform. None means no slide.
  function slide() {
    const css = getComputedStyle(panel), list = v => v.split(/,(?![^(]*\))/).map(x => x.trim());
    const k = list(css.transitionProperty).indexOf('transform');
    if (k < 0) return { seconds: 0 };
    return { seconds: parseFloat(list(css.transitionDuration)[k]), ease: cubicBezier(list(css.transitionTimingFunction)[k]) };
  }

  // The Wheel's rim, about the globe's centre, in the room the globe has.
  function placeRim() {
    const [ax, ay] = anchor(), f = fit(), margin = g.margin;
    g.rim = { x: (Math.min(ax, g.cssWidth - ax) - margin) / f, y: (Math.min(ay, freeHeight() - ay) - margin) / f, margin: margin / f };
  }
  // How far up the stage the open panel reaches where it spans the stage, as
  // a phone's sheet does: none while closed, stepped aside or at the side.
  function sheetCover() {
    const shown = panel.classList.contains('open') && !panel.classList.contains('peeked');
    return shown && panel.offsetWidth >= g.cssWidth ? Math.min(panel.offsetHeight, g.cssHeight) : 0;
  }
  // The globe rises and settles with the sheet, on the sheet's own timing.
  let covering = 0;
  function setCover() {
    const to = sheetCover(), from = g.cover;
    if (to === from) return;
    const step = e => { g.cover = from + (to - from) * e; placeRim(); clampZoom(); redraw(); };
    cancelAnimationFrame(covering);
    const { seconds, ease } = slide();
    if (!seconds) { step(1); return; }
    let begun = 0;
    const tick = now => {
      begun ||= now;
      const t = Math.min(1, (now - begun) / (seconds * 1000));
      step(ease(t));
      if (t < 1) covering = requestAnimationFrame(tick);
    };
    covering = requestAnimationFrame(tick);
  }
  new MutationObserver(setCover).observe(panel, { attributes: true, attributeFilter: ['class'] });

  const pointers = new Map();
  let pinch = 0, travel = 0, grip = null;
  g.canvas.addEventListener('pointerdown', e => {
    if (!pointers.size) travel = 0;
    // One pointer takes hold of the place under it, where there is one.
    grip = pointers.size ? null : pointAt(e.offsetX, e.offsetY);
    g.canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    cancelAnimationFrame(zooming);
  });
  g.canvas.addEventListener('pointermove', e => {
    const last = pointers.get(e.pointerId);
    if (!last) {
      const at = pointAt(e.offsetX, e.offsetY), hit = at && placeAt(at);
      hover(hit?.region ?? null, hit?.place ?? null);
      hold(hit ? null : at);
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
      if (grip) follow(grip, next[0], next[1]);
      else drag(next[0] - last[0], next[1] - last[1]);
      pointers.set(e.pointerId, next);
    }
  });
  // A single press that barely moved picks the place under it.
  const lift = e => {
    const tap = pointers.size === 1 && pointers.has(e.pointerId) && travel < TAP_SLOP && e.type === 'pointerup';
    pointers.delete(e.pointerId); pinch = 0; grip = null;
    const at = tap && pointAt(e.offsetX, e.offsetY);
    if (at) pickPoint(at);
  };
  g.canvas.addEventListener('pointerleave', () => { if (!pointers.size) { hover(null); hold(null); } });
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
    const step = KEY_TURN * RAD * fit() * g.zoom, mid = [g.cssWidth / 2, freeHeight() / 2];
    const keys = {
      ArrowLeft: () => drag(step, 0), ArrowRight: () => drag(-step, 0),
      ArrowUp: () => drag(0, step), ArrowDown: () => drag(0, -step),
      '+': () => zoomAt(KEY_ZOOM, ...mid), '=': () => zoomAt(KEY_ZOOM, ...mid),
      '-': () => zoomAt(1 / KEY_ZOOM, ...mid),
      0: resetView,
      Enter: () => { const v = viewOf(g); pickPoint({ lon: v.lon0, lat: v.lat0 }); },
    };
    if (!keys[e.key]) return;
    e.preventDefault();
    keys[e.key]();
  });

  function resetView() {
    Object.assign(g, home());
    redraw();
  }
  reset.addEventListener('click', resetView);

  // A new theme recolours the globe and its Wheel from the same geometry: the
  // palette is read again, the globe takes its new colours, and the view's
  // layers and the Wheel are drawn afresh in the theme's colours and type.
  document.addEventListener('euphonia:theme', () => {
    Object.assign(colors, palette(stage));
    globe?.recolor(colors);
    g.baseKey = '';
    g.wheelKey = '';
    loadType();
    offerTheme(chosen);
    redraw();
  });
  draw();
  contentsOpen.hidden = false;
  moonLine.hidden = false;
  datesTable.hidden = false;
  tideLine.hidden = false;
  stage.classList.add('is-drawn');

  // A link to a region (#europe) opens its chapter; one to the front door
  // (#welcome), that; one to the People page (#people), or to its Notable
  // People (#notable-people), that.
  function openFromAddress() {
    const id = location.hash.slice(1);
    const r = regions.find(x => x.id === id);
    if (r) { openChapter(r, g.cell); return; }
    if (id === 'welcome') { openWelcome(); requestAnimationFrame(() => panelTitle.focus()); return; }
    const people = panel.querySelector('.map-panel-people');
    if (id !== 'people' && !(id && people.querySelector(`#${CSS.escape(id)}`))) return;
    showPage('people');
    openPanel(contentsOpen);
    // The panel scrolls to the section itself; scrollIntoView would scroll
    // the page under the globe as well.
    requestAnimationFrame(() => {
      if (id === 'people') { panelTitle.focus(); return; }
      const head = people.querySelector(`#${CSS.escape(id)} h3`);
      panel.scrollTo({ top: head.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop });
    });
  }
  function openWelcome() {
    showPage('welcome');
    openPanel(contentsOpen);
  }
  addEventListener('hashchange', openFromAddress);
  // A first visit opens on the front door, without taking the focus from
  // where the page put it; the browser remembers it was shown, and where it
  // can't, every visit is a first. An address names what to open instead.
  const WELCOMED = 'pm-euphonia-welcomed';
  function firstVisit() {
    if (location.hash) return false;
    let seen = null;
    try { seen = localStorage.getItem(WELCOMED); localStorage.setItem(WELCOMED, '1'); } catch { /* no storage: a first visit */ }
    return !seen;
  }
  // The address the page opens at waits for the globe's first measure:
  // a chapter zooms to its region, and before the globe has a size the fit
  // is no number (and the zoom with it, for good).
  measured.then(() => (firstVisit() ? openWelcome() : openFromAddress()));
}

const stage = document.getElementById('map-figure');
if (stage) initMap(stage);
