// ─── The candle ────────────────────────────────────────────────────────────
// A flame is not a loop, and it is not a dimmer either. Both of those were
// wrong here in turn, and the second mistake is the more interesting one.
//
// Version one was a CSS keyframe list, which is periodic by construction: the
// last of them replayed its whole flicker gesture every 1.7s, comfortably
// inside the window an eye reads as rhythm. Version two replaced it with this
// noise process, which fixed the repetition and still looked wrong — Scott:
// *"the candle is just reading as a strobe... I think part of the problem is
// that I feel like we should be seeing the light on the walls, with some
// shadows, and the light itself would shift. Imagine the candle being on the
// desk of the person reading this scroll."*
//
// He was right, and the diagnosis is exact. Version two modelled the flame's
// LUMINANCE over time and applied it as a uniform multiplier to one static
// layer. Two things follow from that, and both of them are the strobe:
//
//   1. Uniform is the wrong axis. What you actually see across a room lit by
//      a candle is not the room getting brighter and darker together — it is
//      the light MOVING. The flame leans, the highlight slides, the shadows
//      swing. Brightness modulation is the secondary channel and it was the
//      only one being driven. So position is now the primary output and the
//      brightness swing is a quarter of what it was.
//
//   2. That one layer carried the room's darkness as well as the candle's
//      light, so dimming it lifted the shadows. A frame where the highlights
//      fall and the dark corners rise at the same instant is a flash, not a
//      flame. scroll.css now splits them: .scroll-root::before is the light
//      and moves, ::after is the room and does not.
//
// So `at(t)` returns a position as well as a brightness, and they are
// COUPLED rather than being two independent noises laid over each other — a
// flame pushed sideways is stretched, and a stretched flame is dimmer. Two
// uncorrelated channels is one of the reliable tells of an animation.
//
// What the signal models:
//
//   * The lean. The flame's own sway, slower and much larger than its
//     flicker, and wider horizontally than vertically because a flame leans
//     before it stretches. This is what moves the light.
//
//   * The buoyancy flicker. A candle-scale diffusion flame oscillates because
//     hot gas off the wick outruns the cold air feeding it; the frequency
//     scales as roughly 1/sqrt(wick width) and lands near 10-12Hz, which is
//     why the 11.3Hz octave carries a deliberately larger amplitude than its
//     neighbours. A noisy oscillator, not a tone — the phase slips
//     continuously, which is what an octave of value noise gives and a sine
//     does not.
//
//   * The room. Draught and convection: the low octaves, falling off roughly
//     as 1/f, and the reason a candle has a shape over ten seconds as well as
//     over one.
//
//   * Guttering. The rare moment air actually catches the flame: it ducks,
//     it is thrown sideways, it flickers harder while it is down, and it
//     climbs back. Its own slow channel, thresholded near the top so only a
//     few percent of it does anything — a gutter that arrives on a schedule
//     is just another wobble.
//
// Brightness is bounded above and not below, which is the asymmetry that
// makes it read as fire rather than as tremble: fuel rate caps how bright it
// can burn, nothing caps how far a draught pushes it down.

// Value noise on an integer lattice: hash the two neighbours, smoothstep
// between them. Deterministic in (t, seed), continuous, and defined for
// arbitrarily large t — which is the whole point. The lattice index just keeps
// counting, so the signal never comes back around to anywhere it has been.
const hash = (i) => {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

const noise = (t, seed) => {
  const i = Math.floor(t);
  const f = t - i;
  const a = hash((i | 0) + seed);
  const b = hash((i | 0) + 1 + seed);
  return a + (b - a) * (f * f * (3 - 2 * f));
};

// [frequency in Hz, amplitude]. Falling roughly as 1/f, with the bump at
// 11.3Hz that is the buoyancy instability. Amplitudes are well under half
// what they were: this is now the secondary channel, and the total swing is
// small enough that no single frame reads as a flash.
const OCTAVES = [
  [0.31, 0.052],
  [0.83, 0.034],
  [2.30, 0.022],
  [6.10, 0.015],
  [11.30, 0.026],
  [19.70, 0.009],
];

// The lean. Slower than the flicker and far larger — this is the channel that
// actually carries the effect, so it gets the amplitude the brightness used
// to waste. Horizontal is roughly twice vertical: a flame leans before it
// stretches, and a vertical bob that matches the sideways sway reads as a
// hovering blob rather than as a flame on a wick.
// The last band in each is the flame's own flicker showing up as MOVEMENT
// rather than only as brightness, and it is small on purpose. A candle's
// high-frequency motion is mostly at the tip, so what it does to the pool of
// light on a desk is shimmer its edge, not translate the whole pool — a large
// amplitude here would read as the page vibrating. At the multipliers
// scroll.css uses it works out around 3px, which is shimmer.
const SWAY_X = [[0.37, 0.62], [0.93, 0.26], [2.10, 0.12], [9.70, 0.030]];
const SWAY_Y = [[0.29, 0.30], [1.13, 0.15], [2.70, 0.07], [11.30, 0.022]];

const sum = (bands, t, s, base) => {
  let v = 0;
  for (let i = 0; i < bands.length; i++) v += (noise(t * bands[i][0], s + base + i * 977) - 0.5) * bands[i][1];
  return v;
};

/**
 * A candle. `seed` gives each mount its own flame; omit it for a random one.
 * `at(seconds)` returns `{ lum, x, y }` — brightness nominally 1 and dipping,
 * and a lean in roughly [-1, 1] on each axis.
 */
export function createFlame(seed = (Math.random() * 1e9) | 0) {
  const s = seed | 0;
  return {
    at(t) {
      // The draught channel that decides whether the flame is being caught
      // right now. Thresholded hard and squared, so most of the time this is
      // exactly zero and the events, when they come, have a shape.
      const g = noise(t * 0.23, s + 4400);
      const gutter = g > 0.9 ? ((g - 0.9) / 0.1) ** 2 : 0;

      // A caught flame does not just dim, it thrashes — and it is thrown.
      const agitation = 1 + gutter * 1.4;

      // The lean, and the gutter shoves it. Clamped to [-1, 1] so the CSS
      // that multiplies these by a percentage has a bound it can rely on.
      const drift = noise(t * 0.11, s + 8100) - 0.5;   // where the draught is coming from
      const clamp = v => (v < -1 ? -1 : v > 1 ? 1 : v);
      const x = clamp((sum(SWAY_X, t, s, 100) + drift * gutter * 2.6) * 2.0);
      const y = clamp(sum(SWAY_Y, t, s, 300) * 2.0 - gutter * 0.55);

      // Flicker, coupled to the lean: a flame pushed off vertical is
      // stretched, and a stretched flame is dimmer. This is what keeps the
      // two channels from reading as two unrelated animations played at once.
      const lean = Math.hypot(x, y);
      let v = 0.995 + sum(OCTAVES, t, s, 0) * 1.9 * agitation - lean * 0.055;

      // Bounded above: past its fuel rate the flame has nowhere to go, so
      // excursions over 1 compress hard instead of clipping flat.
      if (v > 1) v = 1 + (v - 1) * 0.3;

      v -= gutter * 0.14;

      return { lum: v < 0.72 ? 0.72 : v > 1.02 ? 1.02 : v, x, y };
    },
  };
}
