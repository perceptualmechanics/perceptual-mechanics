// ─── The candle ────────────────────────────────────────────────────────────
// A flame is not a loop. Every version of this before now was a CSS keyframe
// list, and the last one was fifteen irregular stops across 1.7s at coprime
// periods with a 4.1s brightness wander on top — which does not repeat as a
// PAIR for 69.7s, but repeats the flicker gesture itself, identically, every
// 1.7 seconds. 1.7s is comfortably inside the window the eye reads as rhythm,
// so what it actually looked like was a machine with a slow wobble bolted on.
// You cannot fix that by adding stops. Any keyframe list is periodic; that is
// what a keyframe list is.
//
// So this is a signal instead, sampled as a function of absolute elapsed time,
// with no period at all. What it models:
//
//   * The buoyancy flicker. A diffusion flame of candle scale oscillates
//     because hot gas rising off the wick outruns the cold air feeding it and
//     the interface between them goes unstable. The frequency scales as
//     roughly 1/sqrt(burner width) and lands near 10-12Hz for a wick this
//     size — which is why the 11.3Hz octave below carries a deliberately
//     larger amplitude than the octaves either side of it. It is a noisy
//     oscillator, not a tone: the phase slips continuously, which is exactly
//     what an octave of value noise gives and a sine does not.
//
//   * The room. Draught, convection off the reader, the door being somewhere.
//     Slow, large, and the reason a candle's brightness has a shape over ten
//     seconds as well as over one. That is the lower octaves, amplitudes
//     falling off roughly as 1/f.
//
//   * Guttering. The rare moment air actually catches the flame: it ducks,
//     flickers harder while it is down, and climbs back. Its own slow channel,
//     thresholded near the top so only a few percent of it does anything —
//     these have to arrive as isolated events, because a gutter that happens
//     on a schedule is just another wobble.
//
// The flame is bounded above and not below, which is the asymmetry that makes
// it read as fire rather than as tremble: fuel rate caps how bright it can
// burn, nothing caps how far a draught can push it down.

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
// 11.3Hz that is the buoyancy instability. The frequencies are mutually
// irrational-ish on purpose, but that is belt-and-braces: nothing here has a
// period to align in the first place.
const OCTAVES = [
  [0.31, 0.115],
  [0.83, 0.070],
  [2.30, 0.045],
  [6.10, 0.030],
  [11.30, 0.052],
  [19.70, 0.018],
];

/**
 * A candle. `seed` gives each mount its own flame; omit it for a random one.
 * Call `at(seconds)` for the flame's luminance, nominally 1 and dipping.
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

      // A caught flame does not just dim, it thrashes. The flicker gains
      // amplitude for as long as the gutter lasts.
      const agitation = 1 + gutter * 1.4;

      let n = 0;
      for (let i = 0; i < OCTAVES.length; i++) {
        const [hz, amp] = OCTAVES[i];
        // +1 per octave so the same lattice serves all of them without the
        // channels correlating at t near 0.
        n += (noise(t * hz, s + i * 977 + 1) - 0.5) * amp;
      }

      let v = 0.955 + n * 1.9 * agitation;

      // Bounded above: past its fuel rate the flame has nowhere to go, so
      // excursions over 0.99 compress hard instead of clipping flat.
      if (v > 0.99) v = 0.99 + (v - 0.99) * 0.35;

      v -= gutter * 0.22;

      return v < 0.55 ? 0.55 : v > 1.03 ? 1.03 : v;
    },
  };
}
