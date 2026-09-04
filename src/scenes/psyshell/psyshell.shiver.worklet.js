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
//   2. **Plural and discrete.** Five voices across about 150 ms, spaced
//      irregularly, so they read as separate arrivals rather than as a chord or
//      a flam. The spacing is drawn per note; there is no rate to learn.
//   3. **Inharmonic.** Partials at 1, 2.76, 5.40, 8.93 and 13.34 — the ideal
//      free-bar series that gives tubular bells and glockenspiels their metal.
//      A harmonic stack would read as a tone.
//   4. **Bright.** Upper partials are kept loud and dominate the first tenth of
//      a second, which is where a chime's brightness lives; they decay faster
//      than the fundamental, so the note darkens as it falls rather than
//      staying glassy.
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

// The ideal free bar. These ratios are what make a struck metal object sound
// like metal rather than like a pitch, and they are measured constants rather
// than a choice: 2.76, 5.40 and 8.93 are the classic transverse modes.
const PARTIALS = [1, 2.76, 5.40, 8.93, 13.34];
const PARTIAL_GAIN = [1.0, 0.78, 0.62, 0.46, 0.28];
// Higher partials die faster, which is what makes a chime darken as it falls.
const PARTIAL_T60 = [0.42, 0.30, 0.21, 0.15, 0.10];

const COURIERS = 5;
const GAP = [0.022, 0.044];   // seconds between arrivals, drawn per note
const STEP = 1.32;            // semitones each courier lands above the last
const ATTACK = 0.0015;        // seconds — a strike, not a build

class Chime {
  constructor(sr, hz, gain, delay, seed) {
    this.sr = sr;
    this.hz = hz;
    this.gain = gain;
    this.t = -delay;
    this.done = false;
    let s = (seed >>> 0) || 1;
    const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    // Each courier is detuned by a hair, so five of them are five things rather
    // than one thing five times.
    this.detune = 1 + (rnd() - 0.5) * 0.012;
    this.phase = new Float32Array(PARTIALS.length);
    for (let i = 0; i < PARTIALS.length; i++) this.phase[i] = rnd() * Math.PI * 2;
    this.life = PARTIAL_T60[0] * 1.7;
  }

  render(out, n) {
    const sr = this.sr;
    const TAU = Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const t = this.t;
      this.t += 1 / sr;
      if (t < 0) continue;
      if (t >= this.life) { this.done = true; return; }
      // One shared attack across the partials — a strike excites the whole bar
      // at once — and a decay per partial.
      const atk = 1 - Math.exp(-t / ATTACK);
      let v = 0;
      for (let k = 0; k < PARTIALS.length; k++) {
        const f = this.hz * this.detune * PARTIALS[k];
        if (f > sr * 0.45) continue;
        this.phase[k] += TAU * f / sr;
        v += Math.sin(this.phase[k]) * PARTIAL_GAIN[k] * Math.exp(-t * 6.9 / PARTIAL_T60[k]);
      }
      out[i] += v * atk * this.gain * 0.42;
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
      if (this.voices.length >= 40) this.voices.shift();
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
