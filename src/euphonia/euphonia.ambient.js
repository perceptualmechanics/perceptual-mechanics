// The Wheel's ambient life, on its own canvas under the globe's, after the
// site's Outside: a slow breath under everything, glows that drift, and
// points of light that travel. Each takes its manner from the book.
//
// - Each realm glows at its place, warm gold toward the heavens and ember
//   toward the pit, by its height. The ordered side breathes as one, in kept
//   time; toward the churning side ("storms, revels and raw elements") each
//   glow flickers and wanders on its own, as far as its bearing leans.
// - Along each of the Revelator's roads, scarlet motes travel the way it runs,
//   from the plane its pathway's opening says it rises in.
// - Each planet stands on its sphere at its longitude for the map's day.
//
// It draws only while the map can be seen and motion is allowed: under
// reduced motion, or paused with the bar's button, it holds one still frame.
import { wheelGeometry, GOLDEN } from './euphonia.draw.js';
import { SPHERES, planetsAt } from './euphonia.wheel.js';
import { PLANETS } from '../bench/bench.text.js';
import { createFrameClock } from '../utils/sceneKit.js';

const RAD = Math.PI / 180;
// Outside's breath: its BREATHE_FREQ of 0.11 radians a second, a cycle of
// about 57 seconds, and how deep the Wheel's glows breathe with it.
const BREATHE_FREQ = 0.11, BREATH_DEPTH = 0.25;
// A glow's radius in rem, and how bright at the top of the breath.
const GLOW_REM = 3.2, GLOW_ALPHA = 0.2;
// Toward the churning side: how deep a glow flickers, and how far it
// wanders, in rem, at Chaos itself. Two incommensurate rates (radians a
// second) make the flicker that never repeats exactly.
const FLICKER_DEPTH = 0.6, WANDER_REM = 0.5, FLICKER_RATES = [0.7, 1.83];
// How far a realm's light reaches from its place, in rem: its glow, and as
// far again as it wanders.
export const REALM_REACH_REM = GLOW_REM + WANDER_REM;
// Motes on the roads: one to this many CSS pixels of road, travelling this
// many CSS pixels a second, this bright in the middle of the road.
const MOTE_GAP = 70, MOTE_SPEED = 9, MOTE_ALPHA = 0.55, MOTE_RADIUS = 1.4;
// A planet's light: its radius in rem and how bright.
const PLANET_REM = 0.9, PLANET_ALPHA = 0.5;

// A soft round light in a colour ([r, g, b]), drawn once to reuse every
// frame. It fades to its own colour at no opacity: "transparent" is black's,
// and a gradient toward it greys on the way.
function sprite(radius, [r, g, b]) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.max(2, Math.ceil(2 * radius));
  const ctx = c.getContext('2d'), grad = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}
// A #rrggbb colour as [r, g, b], and the mix of two.
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t));

export function createAmbient(canvas, { wheel, colors, instant, sky, top }) {
  const ctx = canvas.getContext('2d');
  const clock = createFrameClock();
  const planets = planetsAt(instant, sky.sun, sky.moon);
  let frame = null, layout = null, running = 0, seen = true, shown = 1;

  // Everything that depends only on the window's size, worked out once each
  // time it changes: where the realms, roads and planets are, and the lights.
  function setFrame(next) {
    frame = next;
    const { view, rim, dpr, rem } = frame;
    const geo = wheelGeometry(view, rim, wheel.roads.length);
    const place = new Map(wheel.realms.map(r => [r.name, r.at]));
    const glowR = GLOW_REM * rem * dpr;
    const realms = wheel.realms.filter(r => r.at !== 'centre').map((r, i) => {
      const height = (1 + Math.sin(r.at * RAD)) / 2, churn = (1 + Math.cos(r.at * RAD)) / 2;
      const color = height < 0.5 ? mix(colors['wheel-low'], colors.paper, height * 2) : mix(colors.paper, colors.sun, height * 2 - 1);
      // Each realm's flicker set apart from its neighbours' by the golden angle.
      return { at: geo.point(geo.realmT, r.at), churn, phase: i * GOLDEN, light: sprite(glowR, color) };
    });
    // Each road as a path from where it rises, sampled by length.
    const roads = wheel.roads.map((road, j) => {
      const t = geo.roadT(j), ring = road.through.map(n => place.get(n)).filter(a => a !== 'centre');
      let points;
      if (road.centre) {
        const first = place.get(road.rises) === 'centre' ? ring[0] : place.get(road.rises), last = ring.find(a => a !== first) ?? first;
        points = [geo.point(t, first), [geo.cx, geo.cy], geo.point(t, last)];
      } else {
        // From the end nearer where it rises, round the arc to the other.
        const rise = place.get(road.rises), d = a => Math.abs(((a - rise + 540) % 360) - 180);
        const forward = d(road.from) <= d(road.from + road.span);
        const steps = Math.max(2, Math.ceil(road.span / 2));
        points = Array.from({ length: steps + 1 }, (_, s) => geo.point(t, forward ? road.from + road.span * s / steps : road.from + road.span * (1 - s / steps)));
      }
      const lengths = [0];
      for (let s = 1; s < points.length; s++) lengths.push(lengths[s - 1] + Math.hypot(points[s][0] - points[s - 1][0], points[s][1] - points[s - 1][1]));
      const length = lengths.at(-1);
      return { points, lengths, length, motes: Math.max(1, Math.round(length / (MOTE_GAP * dpr))) };
    });
    const planetR = PLANET_REM * rem * dpr;
    const planetLights = Object.entries(planets).map(([p, lon]) => {
      const i = SPHERES.indexOf(PLANETS[p].name.replace(/^the /, ''));
      return { at: geo.point(geo.sphereT(i), lon), light: sprite(planetR, rgb(colors.sun)) };
    });
    layout = { realms, roads, planets: planetLights, wander: WANDER_REM * rem * dpr, dpr };
    draw(clock.elapsed);
  }

  // The point a length along a road, written into `spot`, so the frame loop
  // allocates nothing.
  const spot = [0, 0];
  const along = (road, s) => {
    let i = 1;
    while (i < road.lengths.length - 1 && road.lengths[i] < s) i++;
    const a = road.points[i - 1], b = road.points[i], seg = road.lengths[i] - road.lengths[i - 1] || 1, u = (s - road.lengths[i - 1]) / seg;
    spot[0] = a[0] + (b[0] - a[0]) * u; spot[1] = a[1] + (b[1] - a[1]) * u;
    return spot;
  };

  // `still` is whether motion is held: by the reader's settings or the button.
  function draw(t, still = !moving()) {
    if (!frame) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(frame.wheel, 0, 0);
    const breath = 1 + BREATH_DEPTH * Math.sin(t * BREATHE_FREQ);
    ctx.globalCompositeOperation = 'lighter';
    for (const r of layout.realms) {
      const flicker = still ? 0 : r.churn * FLICKER_DEPTH * (0.6 * Math.sin(FLICKER_RATES[0] * t + r.phase) + 0.4 * Math.sin(FLICKER_RATES[1] * t + 2 * r.phase));
      const wx = still ? 0 : r.churn * layout.wander * Math.sin(FLICKER_RATES[0] * 0.37 * t + r.phase);
      const wy = still ? 0 : r.churn * layout.wander * Math.cos(FLICKER_RATES[1] * 0.29 * t + r.phase);
      ctx.globalAlpha = Math.max(0, GLOW_ALPHA * breath * (1 + flicker) / (1 + BREATH_DEPTH));
      ctx.drawImage(r.light, r.at[0] - r.light.width / 2 + wx, r.at[1] - r.light.height / 2 + wy);
    }
    for (const p of layout.planets) {
      ctx.globalAlpha = PLANET_ALPHA * breath / (1 + BREATH_DEPTH);
      ctx.drawImage(p.light, p.at[0] - p.light.width / 2, p.at[1] - p.light.height / 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (!still) {
      ctx.fillStyle = colors['signal-text'];
      const travelled = t * MOTE_SPEED * layout.dpr;
      for (const road of layout.roads) {
        for (let m = 0; m < road.motes; m++) {
          const s = (travelled + m * road.length / road.motes) % road.length, u = s / road.length;
          ctx.globalAlpha = MOTE_ALPHA * Math.sin(Math.PI * u) ** 2;
          const [x, y] = along(road, s);
          ctx.beginPath(); ctx.arc(x, y, MOTE_RADIUS * layout.dpr, 0, 2 * Math.PI); ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  const lessMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const moving = () => !lessMotion.matches && !top.classList.contains('motion-paused');
  // Running means moving: sync stops the loop the moment motion is held.
  const tick = () => { running = requestAnimationFrame(tick); clock.tick(); draw(clock.elapsed, false); };
  // Runs while there's something to see and motion to show; otherwise holds
  // the frame it has.
  function sync() {
    const go = seen && shown > 0 && frame && moving() && !document.hidden && canvas.clientWidth > 0;
    if (go && !running) { clock.resync(); running = requestAnimationFrame(tick); }
    if (!go && running) { cancelAnimationFrame(running); running = 0; draw(clock.elapsed); }
  }
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; sync(); }).observe(canvas);
  document.addEventListener('visibilitychange', sync);
  lessMotion.addEventListener('change', sync);
  new MutationObserver(sync).observe(top, { attributes: true, attributeFilter: ['class'] });

  // How much of the Wheel shows, 0 to 1; wholly faded, it stops drawing.
  const fade = a => { if (a === shown) return; shown = a; canvas.style.opacity = String(a); sync(); };
  return { setFrame: next => { setFrame(next); sync(); }, sync, fade };
}
