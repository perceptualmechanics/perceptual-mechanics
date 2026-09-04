// ─── The reading, as a burst of chimes — an AudioWorkletProcessor ───────────
//
// THIS FILE IS NOT BUNDLED. It is loaded by URL with `audioWorklet.addModule()`
// and runs in the AudioWorkletGlobalScope, which is a different global with no
// DOM, no window, and no module graph of this app. It therefore imports nothing
// and must stay self-contained; `psyshell.js` takes its URL through
// `new URL(..., import.meta.url)` so the file is emitted as an asset exactly
// once. CSP: it is same-origin, so `script-src 'self'` already covers it — a
// worklet module is fetched under script-src.
//
// ─── What this is, and what it stopped being ────────────────────────────────
// 4.8.1 built a shiver: one resonator ringing up over 20 ms under a shaped
// noise burst. That was a careful answer to the wrong question. The ask is
// **nerve couriers racing along the strands, like a bright chime** — fast,
// discrete, plural, with a bell's attack — and a body ringing up slowly is the
// opposite gesture. A ring-up says "something is responding". A chime says
// "something arrived", and several of them say the thing that arrived was
// carried.
//
// So: a small burst of struck voices. What survives from the shiver is the
// judgement that inharmonic partials were right; the envelope and the count are
// what change.
//
//   1. **Struck, not driven.** Each voice is additive sine partials with a
//      1.5 ms attack and no excitation stage at all. There is nothing to ring
//      up, so the onset is the onset.
//   2. **Plural and discrete.** Three taps across about a quarter of a second,
//      spaced irregularly, so they read as separate arrivals rather than as a
//      chord or a flam. The spacing is drawn per note; there is no rate to
//      learn. Three rather than five because a bell rings for seconds and five
//      overlapping rings is a wash.
//   3. **A bell, not a bar.** Shell modes rather than the free-bar series, and
//      every partial split into a beating doublet. See the constants below for
//      what went wrong the first time and why the fix is the object rather than
//      the tuning.
//   4. **Bright, and it stays bright.** The second partial is the loudest, the
//      way a small bell's strike tone sits above its fundamental, and the upper
//      modes hold on for a second or more instead of dying at once.
//   5. **It rises.** Each courier lands above the one before — a relay passing
//      forward, and the same "delight rises rather than falls" decision the
//      shiver was carrying.
//
// ─── Underrun accounting ────────────────────────────────────────────────────
// A worklet runs in a hard-realtime thread: a slow `process()` produces a
// dropout, not lag. This one reports the worst `process()` duration it has seen
// and any discontinuity in `currentFrame`, which advances by exactly one render
// quantum per call unless the thread missed one. The gaps are classified —
// device start, suspend, underrun — because only the third is a defect, and
// counting them together reports an underrun nobody heard.

// ─── A bell, not a bar ──────────────────────────────────────────────────────
// The first version of this used 1 : 2.76 : 5.40 : 8.93 — and those are the
// transverse modes of an IDEAL FREE BAR, which is to say a xylophone. Scott
// heard a xylophone, because that is what it was. The code even named it: "the
// ideal free bar" was written down as the justification, and a free bar is not
// a bell. **The ratios were correct for the wrong object.**
//
// What is wanted is a bell hop's bell: a small struck shell. Three things
// separate one from a bar, and only the first is about ratios.
//
//   1. **Shell modes, not bar modes.** A bar's modes climb steeply (2.76, 5.40,
//      8.93 of the fundamental) and are what make a xylophone dry and woody. A
//      shell's sit much closer together, and the ones below are in the region a
//      small hemispherical bell's do. They are chosen to sit in that region
//      rather than measured off one particular bell, and that is said here
//      rather than dressed up as a citation.
//   2. **Every partial is a DOUBLET, and that is the actual signature.** A real
//      bell is never perfectly axisymmetric, so each mode splits into two
//      frequencies a hair apart and they beat — the shimmer or warble that says
//      "bell" before anything else does. A bar has no such thing, and its
//      absence is most of why the first version read as percussion.
//   3. **It rings for seconds, not for a third of one.** A bar is damped by its
//      own mounting and its overtones die almost at once. A shell holds on.
const PARTIALS = [1, 1.63, 2.13, 2.87, 3.71, 5.03];
const PARTIAL_GAIN = [0.85, 1.0, 0.72, 0.55, 0.36, 0.22];
// Seconds to −60 dB per partial. Long, and long at the top too: a bell stays
// bright as it fades, where a bar goes dull immediately.
const PARTIAL_T60 = [2.4, 2.0, 1.5, 1.1, 0.8, 0.55];
// Beat rates in Hz, one per partial — the two halves of each doublet are
// detuned by this much. Different per mode, because a bell's asymmetries are
// not one asymmetry.
const PARTIAL_BEAT = [1.7, 2.9, 4.3, 5.6, 7.1, 9.4];

// A bell hop's bell is small and high. The scene's own pitch mapping runs
// 280–620 Hz, which is where the bar was struck; a shell that size sounds about
// an octave and a fifth above it.
const BELL_LIFT = 2.35;

const COURIERS = 3;
const GAP = [0.085, 0.155];   // seconds between taps, drawn per note
const STEP = 1.6;             // semitones each courier lands above the last
const ATTACK = 0.0012;        // seconds — a plunger, not a build
const CLAPPER = 0.004;        // seconds of strike noise, quiet, at the very top

class Chime {
  constructor(sr, hz, gain, delay, seed) {
    this.sr = sr;
    this.hz = hz * BELL_LIFT;
    this.gain = gain;
    this.t = -delay;
    this.done = false;
    let s = (seed >>> 0) || 1;
    const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    this.rnd = rnd;
    // Two phases per partial: the doublet. They start together and drift apart,
    // which is exactly what beating is.
    this.phaseA = new Float32Array(PARTIALS.length);
    this.phaseB = new Float32Array(PARTIALS.length);
    for (let i = 0; i < PARTIALS.length; i++) {
      this.phaseA[i] = rnd() * Math.PI * 2;
      this.phaseB[i] = this.phaseA[i] + (rnd() - 0.5) * 0.4;
    }
    this.life = PARTIAL_T60[0] * 1.15;
  }

  render(out, n) {
    const sr = this.sr;
    const TAU = Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const t = this.t;
      this.t += 1 / sr;
      if (t < 0) continue;
      if (t >= this.life) { this.done = true; return; }
      const atk = 1 - Math.exp(-t / ATTACK);
      let v = 0;
      for (let k = 0; k < PARTIALS.length; k++) {
        const f = this.hz * PARTIALS[k];
        if (f > sr * 0.45) continue;
        const half = PARTIAL_BEAT[k] * 0.5;
        this.phaseA[k] += TAU * (f - half) / sr;
        this.phaseB[k] += TAU * (f + half) / sr;
        const a = Math.exp(-t * 6.9 / PARTIAL_T60[k]) * PARTIAL_GAIN[k];
        v += (Math.sin(this.phaseA[k]) + Math.sin(this.phaseB[k])) * 0.5 * a;
      }
      // The plunger. Four milliseconds of noise under the onset, quiet enough
      // to be felt rather than heard — a struck bell has a hand in it.
      if (t < CLAPPER) v += (this.rnd() * 2 - 1) * 0.30 * (1 - t / CLAPPER);
      out[i] += v * atk * this.gain * 0.30;
    }
  }
}

class ShiverProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.voices = [];
    this.seed = 1;
    this.lastFrame = -1;
    this.worstMs = 0;
    this.dropped = 0;
    this.startupGaps = 0;
    this.suspends = 0;
    this.maxGap = 0;
    this.maxGapAt = 0;
    // A note can also be given at construction. That exists for one reason and
    // it is worth stating: an OfflineAudioContext delivers port messages after
    // the render has finished, so a note posted to the port cannot be measured
    // offline at all. Every number in the release notes about this sound was
    // rendered through this path, which is the same processor the scene runs.
    const first = options?.processorOptions?.note;
    if (first) this.burst(first.hz, first.gain);
    this.port.onmessage = e => {
      const d = e.data || {};
      if (d.type === 'shiver') this.burst(d.hz, d.gain);
      else if (d.type === 'report') {
        this.port.postMessage({
          type: 'report', worstMs: this.worstMs, dropped: this.dropped,
          startupGaps: this.startupGaps, suspends: this.suspends,
          maxGap: this.maxGap, maxGapAt: this.maxGapAt, frames: currentFrame,
        });
      }
    };
  }

  // One reading is one burst: five couriers, each landing above the one before,
  // at irregular intervals. Voices are capped rather than queued — a visitor
  // reading quickly should get a thickening, not a backlog.
  burst(hz, gain) {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    let s = this.seed || 1;
    const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    let delay = 0;
    for (let i = 0; i < COURIERS; i++) {
      if (this.voices.length >= 24) this.voices.shift();
      const f = hz * Math.pow(2, (i * STEP + (rnd() - 0.5) * 0.5) / 12);
      // The later couriers are quieter: a relay fades as it goes past.
      const g = gain * (1 - 0.11 * i);
      this.voices.push(new Chime(sampleRate, f, g, delay, this.seed + i * 7919));
      delay += GAP[0] + (GAP[1] - GAP[0]) * rnd();
    }
  }

  process(_inputs, outputs) {
    // `performance` is not defined in AudioWorkletGlobalScope in every engine —
    // it is absent in the one this was measured in — so the duration probe is
    // written to be inert rather than to throw, and `worstMs: 0` in a report
    // means "not measurable here", not "free". Said plainly because a zero that
    // means nothing is worse than no number.
    const t0 = typeof performance !== 'undefined' && performance.now ? performance.now() : 0;

    // A render quantum is 128 frames, so `currentFrame` advances by exactly 128
    // between calls unless the thread missed one.
    if (this.lastFrame >= 0) {
      const gap = currentFrame - this.lastFrame;
      if (gap > 128) {
        if (gap > this.maxGap) { this.maxGap = gap; this.maxGapAt = currentFrame; }
        if (currentFrame < sampleRate) this.startupGaps++;
        else if (gap < sampleRate * 0.25) this.dropped++;
        else this.suspends++;
      }
    }
    this.lastFrame = currentFrame;

    const out = outputs[0][0];
    if (!out) return true;
    out.fill(0);
    for (let v = this.voices.length - 1; v >= 0; v--) {
      this.voices[v].render(out, out.length);
      if (this.voices[v].done) this.voices.splice(v, 1);
    }
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);

    if (t0) {
      const ms = performance.now() - t0;
      if (ms > this.worstMs) this.worstMs = ms;
    }
    return true;
  }
}

registerProcessor('psyshell-shiver', ShiverProcessor);
