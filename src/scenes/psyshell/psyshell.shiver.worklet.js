// ─── The shiver — an AudioWorkletProcessor ──────────────────────────────────
//
// THIS FILE IS NOT BUNDLED. It is loaded by URL with
// `audioWorklet.addModule()` and runs in the AudioWorkletGlobalScope, which is
// a different global with no DOM, no window, and no module graph of this app.
// It therefore imports nothing and must stay self-contained; `psyshell.js`
// takes its URL through Vite's `?url` so the file is emitted as an asset
// rather than inlined into a chunk. CSP: it is same-origin, so `script-src
// 'self'` already covers it — a worklet module is fetched under script-src.
//
// ─── Why this is not an oscillator and a gain curve ─────────────────────────
// The gesture was wrong, not the tuning. **A strike is an impact; a shiver is a
// body responding**, and the difference is in the first forty milliseconds,
// which is exactly the part a `GainNode` envelope cannot shape. The lens is a
// neuron. A neuron does not ring, it fires, so what is wanted is conduction:
// an excitation entering a resonant body and the body answering.
//
// Three properties, and each one is a decision rather than a taste:
//
//   1. **The onset is not instantaneous.** It is not made non-instantaneous by
//      an attack ramp either. A high-Q resonator RINGS UP over roughly Q/(π·f)
//      seconds, so the build is the body's own response time. The excitation is
//      a short shaped noise burst; the note you hear is what the resonator does
//      with it.
//   2. **The tremble is irregular.** One-pole-filtered white noise, not an LFO.
//      A clean LFO is audible as a period and reads as a synthesiser; a
//      listener should not be able to hear a rate. This is the property that
//      carries "nerve".
//   3. **The pitch rises.** A shiver of alarm falls; delight rises. The drift
//      is +6% across the note (about one semitone), and a slightly inharmonic
//      partial fades in on top of it, so it brightens as well as rises.
//
// ─── Underrun accounting ────────────────────────────────────────────────────
// A worklet runs in a hard-realtime thread: a slow `process()` produces a
// dropout, not lag. This one reports two things back on its port — the worst
// `process()` duration it has seen, and any discontinuity in `currentFrame`,
// which advances by exactly one render quantum per call unless the thread
// missed one. That is a real underrun detector rather than a promise that the
// code is fast.

const TAU = Math.PI * 2;

class Voice {
  constructor(sr, hz, gain, seed) {
    this.sr = sr;
    this.hz = hz;
    this.gain = gain;
    this.t = 0;
    this.done = false;

    // Excitation: a noise burst, shaped. Short, and NOT the note — it is what
    // the body is hit with, and everything audible is the body's answer.
    this.excAttack = 0.008;
    this.excDecay = 0.075;

    // The body. Two state-variable bandpasses: the fundamental, and a partial
    // at 2.02× — deliberately not 2.0, because an exact octave fuses into the
    // fundamental and stops reading as a second thing.
    this.l1 = 0; this.b1 = 0;
    this.l2 = 0; this.b2 = 0;

    // Q rises across the note, so the body tightens as it responds: the ring-up
    // is slower at the start (which is the build) and the tail is longer.
    this.q0 = 34; this.q1 = 95;

    // The tremble. One-pole lowpassed noise at about 7 Hz, twice, so the
    // amplitude and the pitch wander independently — a body's two hands do not
    // shake together.
    this.n1 = 0; this.n2 = 0;
    this.nCoef = Math.exp(-TAU * 7 / sr);
    let s = seed >>> 0;
    this.rand = () => {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296 * 2 - 1;
    };

    this.life = 1.5;
  }

  render(out, n) {
    const sr = this.sr;
    for (let i = 0; i < n; i++) {
      const t = this.t;
      if (t >= this.life) { this.done = true; return; }
      const age = t / this.life;

      // Excitation envelope: up in 8 ms, gone in about 80.
      const exc = t < this.excAttack
        ? t / this.excAttack
        : Math.exp(-(t - this.excAttack) / this.excDecay);

      // Two independent wanders, both irregular by construction.
      this.n1 = this.n1 * this.nCoef + this.rand() * (1 - this.nCoef);
      this.n2 = this.n2 * this.nCoef + this.rand() * (1 - this.nCoef);
      const wobble = this.n1 * 6.2;   // amplitude, ±~18% after smoothing
      const drift = this.n2 * 5.4;    // pitch, ±~1.5%

      // Delight rises. The drift is against a fixed time rather than against
      // `age`, and that is a correction rather than a preference: the note's
      // audible part is the resonator's decay — about 0.6s — not the 1.5s the
      // voice is allowed, so a rise spread over `age` had delivered a fifth of
      // itself before the sound was gone. The coefficient is set from the
      // MEASURED rise rather than from the number in it: a noise-excited
      // resonator does not sit exactly on its tuning frequency, so 0.105 here
      // comes out at about +6% of real, audible pitch across the note.
      const f = this.hz * (1 + 0.105 * Math.min(1, t / 0.42)) * (1 + 0.015 * drift);
      const q = this.q0 + (this.q1 - this.q0) * Math.min(1, age * 3);

      const noise = this.rand() * exc;

      const f1 = 2 * Math.sin(Math.PI * Math.min(0.45, f / sr));
      const damp1 = 1 / q;
      const h1 = noise - this.l1 - damp1 * this.b1;
      this.b1 += f1 * h1;
      this.l1 += f1 * this.b1;

      const f2 = 2 * Math.sin(Math.PI * Math.min(0.45, f * 2.02 / sr));
      const damp2 = 1 / (q * 0.7);
      const h2 = noise - this.l2 - damp2 * this.b2;
      this.b2 += f2 * h2;
      this.l2 += f2 * this.b2;

      // The partial fades IN, which is the brightening half of "delight".
      // Later and stronger than the first version, for the same reason: it has
      // to arrive while the note is still sounding to be heard arriving.
      const partial = 0.8 * Math.max(0, Math.min(1, (t - 0.06) / 0.28));
      const body = this.b1 + this.b2 * partial;

      // The amplitude envelope has no attack of its own — the ring-up is the
      // onset — and only a long fall, so nothing here can put a click back.
      const fall = Math.pow(1 - age, 1.7);
      // 1.1 rather than a round number: measured, so that a note at the
      // scene's own gain peaks where the strike it replaces peaked (0.16) and
      // the release is not suddenly louder than everything else on the site.
      out[i] += body * fall * this.gain * (1 + 0.18 * wobble) * 1.1;

      this.t += 1 / sr;
    }
  }
}

class ShiverProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.voices = [];
    this.seed = 1;
    // A note can also be given at construction. That exists for one reason and
    // it is worth stating: an OfflineAudioContext delivers port messages after
    // the render has finished, so a note posted to the port cannot be measured
    // offline at all. Every number in the release notes about this sound was
    // rendered through this path, which is the same processor the scene runs.
    const first = options?.processorOptions?.note;
    if (first) this.voices.push(new Voice(sampleRate, first.hz, first.gain, 99991));
    this.lastFrame = -1;
    this.worstMs = 0;
    this.dropped = 0;
    this.suspends = 0;
    this.startupGaps = 0;
    this.maxGap = 0;
    this.maxGapAt = 0;
    this.port.onmessage = e => {
      const d = e.data || {};
      if (d.type === 'shiver') {
        if (this.voices.length >= 8) this.voices.shift();
        this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
        this.voices.push(new Voice(sampleRate, d.hz, d.gain, this.seed));
      } else if (d.type === 'report') {
        this.port.postMessage({ type: 'report', worstMs: this.worstMs, dropped: this.dropped, startupGaps: this.startupGaps, suspends: this.suspends,
          maxGap: this.maxGap, maxGapAt: this.maxGapAt, frames: currentFrame });
      }
    };
  }

  process(_inputs, outputs) {
    // `performance` is not defined in AudioWorkletGlobalScope in every engine —
    // it is absent in the one this was measured in — so the duration probe is
    // written to be inert rather than to throw, and `worstMs: 0` in a report
    // means "not measurable here", not "free". Said plainly because a zero that
    // means nothing is worse than no number.
    const t0 = typeof performance !== 'undefined' && performance.now ? performance.now() : 0;

    // A render quantum is 128 frames, so `currentFrame` advances by exactly 128
    // between calls unless the thread missed one. A LARGE jump is not a dropout
    // though — it is the context having been suspended and resumed, which this
    // scene does on every tab hide — so the two are counted separately. Without
    // that split the first report after any suspend claims an underrun that
    // nobody heard, which is the sort of number that gets quoted for a year.
    if (this.lastFrame >= 0) {
      const gap = currentFrame - this.lastFrame;
      if (gap > 128) {
        if (gap > this.maxGap) { this.maxGap = gap; this.maxGapAt = currentFrame; }
        // Three kinds, kept apart because only one of them is a defect. A gap
        // in the first second of a context's life is the audio device starting
        // — measured at one per visit, about 67 ms, at roughly frame 6,800, and
        // never again in eight seconds of rendering. A very large gap is a
        // suspend, which this site does on every tab hide. What is left is an
        // underrun: the thread missing a quantum while playing.
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
    // Copy to any further channels rather than rendering twice.
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);

    if (t0) {
      const ms = performance.now() - t0;
      if (ms > this.worstMs) this.worstMs = ms;
    }
    return true;
  }
}

registerProcessor('psyshell-shiver', ShiverProcessor);
