// The landing's share of the workbench: the hour line, the scene whose planet
// rules the hour, and the offer to reckon by the visitor's own sky. Location is
// never asked for on load; the browser is only asked when the button is pressed.
import { hourLine, sceneOfPlanet } from './bench.text.js';
import { reckon } from './bench.place.js';
import { geolocationState, requestPosition, zoneFallback } from './bench.locate.js';

// setTimeout's ceiling. An hour never runs this long.
const MAX_DELAY = 2 ** 31 - 1;
// The boundary timer can fire late: hidden tabs throttle timers, and on some
// systems the clock timers run on stops while the machine sleeps, so a laptop
// woken with the page still showing would keep a stale hour. A coarse check
// catches that within a minute and costs a comparison when nothing is stale.
const STALE_CHECK_MS = 60000;

export function initBench() {
  const line = document.getElementById('bench-hour');
  const text = document.getElementById('bench-hour-text');
  const ask = document.getElementById('bench-sky');
  if (!line || !text) return;

  let place = null;
  let timer = 0;
  let lit = [];
  let shown = null; // the hour on screen: { start, end }

  function light(planet) {
    for (const el of lit) el.classList.remove('is-hour');
    const scene = sceneOfPlanet[planet];
    lit = scene
      ? [...document.querySelectorAll(`.nav-icon[data-scene="${scene}"], .preview-wrapper[data-scene="${scene}"]`)]
      : [];
    for (const el of lit) el.classList.add('is-hour');
  }

  function render() {
    clearTimeout(timer);
    if (!place) return;
    const now = Date.now();
    const { hour, provenance } = reckon(now, place);
    if (!hour) return;
    text.textContent = hourLine(hour.planet, provenance);
    line.hidden = false;
    light(hour.planet);
    shown = { start: hour.start, end: hour.end };
    timer = setTimeout(render, Math.min(MAX_DELAY, Math.max(0, hour.end - now) + 50));
  }

  // Re-reckons only when the hour on screen is not the hour it is now, which
  // also catches a device clock set back.
  function refreshIfStale() {
    const now = Date.now();
    if (shown && (now >= shown.end || now < shown.start)) render();
  }

  async function useSky() {
    const sky = await requestPosition();
    if (ask) ask.hidden = true;
    if (sky) { place = sky; render(); }
  }

  ask?.addEventListener('click', useSky);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshIfStale(); });
  window.addEventListener('focus', refreshIfStale);
  window.addEventListener('pageshow', e => { if (e.persisted) refreshIfStale(); });
  setInterval(() => { if (!document.hidden) refreshIfStale(); }, STALE_CHECK_MS);

  (async () => {
    const state = await geolocationState();
    if (state === 'granted') {
      const sky = await requestPosition();
      if (sky) { place = sky; render(); return; }
    }
    const zone = await zoneFallback();
    if (place) return; // the visitor gave their sky while the zone table loaded
    place = zone;
    render();
    if (ask) ask.hidden = state !== 'prompt';
  })();
}
