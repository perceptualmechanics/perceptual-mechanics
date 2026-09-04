// ─── The rush — an AudioWorkletProcessor ────────────────────────────────────
//
// THIS FILE IS NOT BUNDLED. It is loaded by URL with `audioWorklet.addModule()`
// and runs in the AudioWorkletGlobalScope: a different global with no DOM, no
// window, and no module graph of this app. It imports nothing and must stay
// self-contained. `psyshell.js` takes its URL through
// `new URL(..., import.meta.url)` so it is emitted as an asset exactly once,
// and `main.js`'s scene glob excludes `*.worklet.js` so it is not also compiled
// as a chunk. CSP: same-origin, so `script-src 'self'` covers it.
//
// ─── What this is ──────────────────────────────────────────────────────────
// **Wind going past you, made of metal.** Not a strike and not a ring: a rush.
// Three sounds preceded it and each was the wrong gesture in a different way —
// a shiver (a body responding), a xylophone (a bar, named in the code as a
// bell), a bell (right object, still a thing sounding AT you rather than
// passing you). The difference this time is the signal path rather than the
// tuning, so the oscillator bank is gone entirely.
//
// Four properties, none of them a taste:
//
//   1. **Noise, not oscillators.** The source is white noise through a moving
//      filter. That is what wind is. A tone with modulation on it is not wind,
//      however carefully the modulation is shaped — which is what the last
//      three versions kept rediscovering.
//   2. **Metal is inharmonic resonance.** A bank of narrow resonators at
//      non-integer ratios, excited by that noise as it goes past. The same
//      mechanism that makes a bell or a struck sheet read as metal rather than
//      as a string — excited continuously here rather than struck, because
//      nothing is being struck.
//   3. **It passes: a Doppler glide and a stereo sweep.** The pitch steps down
//      across the note, steepest in the middle, which is the real shape of the
//      Doppler ratio for something crossing in front of you rather than a
//      linear fall. The image sweeps at the same time. **This is what makes it
//      move THROUGH the listener rather than sound AT them**, and it is the
//      property the previous three had none of.
//   4. **A zephyr swells and goes.** The envelope is a raised sine with zeros
//      at both ends: no attack transient at all. Nothing is struck, so nothing
//      may click.
//
// And the tie that makes it one event rather than two: **the duration and the
// direction come from the transmission.** The scene passes in the life of the
// base-e train and the screen direction of the strand it runs along, so the
// sound crosses at the same time, and the same way, as the light does.
//
// ─── Underrun accounting ───────────────────────────────────────────────────
// A worklet runs in a hard-realtime thread: a slow `process()` produces a
// dropout, not lag. `currentFrame` advances by exactly one render quantum per
// call unless the thread missed one. Gaps are classified — device start,
// suspend, underrun — because only the third is a defect.

// Non-integer, and that is the whole point: whole-number ratios are a string.
const MODES = [1, 1.58, 2.31, 3.07, 4.19, 5.63];
const MODE_GAIN = [0.55, 1.0, 0.82, 0.62, 0.40, 0.24];
const MODE_Q = [38, 46, 52, 58, 64, 70];

// How far the pitch moves each side of the crossing. Real Doppler for a source
// passing at a distance is (c ± v)/c either side of closest approach, so the
// curve is a tanh rather than a ramp — nearly flat approaching, steep at the
// crossing, nearly flat leaving. 5.5% each way is about a semitone in total.
const DOPPLER = 0.055;
const DOPPLER_SHARPNESS = 0.16;   // fraction of the pass the crossing occupies

// The wind: a broad band of noise whose centre falls as it goes by, well above
// the resonators so it reads as air rather than as another mode.
const WIND_HI = 3.4;        // × the body's frequency, at the start
const WIND_LO = 1.15;       // × at the end
const WIND_Q = 1.3;
const WIND_DIRECT = 0.22;   // how much raw wind is heard beside the metal

class Rush {
  constructor(sr, hz, gain, dur, panFrom, panTo, seed) {
    this.sr = sr;
    this.hz = hz;
    this.gain = gain;
    this.dur = Math.max(0.25, dur);
    this.panFrom = panFrom;
    this.panTo = panTo;
    this.t = 0;
    this.done = false;
    let s = (seed >>> 0) || 1;
    this.rand = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 * 2 - 1; };
    // State-variable filter state: one for the wind, one per mode.
    this.wl = 0; this.wb = 0;
    this.ml = new Float32Array(MODES.length);
    this.mb = new Float32Array(MODES.length);
  }

  render(outL, outR, n) {
    const sr = this.sr;
    const PI = Math.PI;
    for (let i = 0; i < n; i++) {
      const t = this.t;
      this.t += 1 / sr;
      if (t >= this.dur) { this.done = true; return; }
      const u = t / this.dur;

      // Swell and go. Zero at both ends by construction, so there is no
      // transient to remove and none can be put back by retuning.
      const env = Math.sin(PI * u);
      const amp = env * env;

      // The pass. +DOPPLER approaching, −DOPPLER leaving, steep in the middle.
      const shift = 1 + DOPPLER * -Math.tanh((u - 0.5) / DOPPLER_SHARPNESS);

      const noise = this.rand();

      // Wind: broad, centre falling.
      const wf = this.hz * shift * (WIND_HI + (WIND_LO - WIND_HI) * u);
      const wc = 2 * Math.sin(PI * Math.min(0.45, wf / sr));
      const wd = 1 / WIND_Q;
      const wh = noise - this.wl - wd * this.wb;
      this.wb += wc * wh;
      this.wl += wc * this.wb;
      const wind = this.wb;

      // Metal: narrow resonators, excited by the wind rather than struck.
      let metal = 0;
      for (let k = 0; k < MODES.length; k++) {
        const f = this.hz * shift * MODES[k];
        if (f > sr * 0.45) continue;
        const c = 2 * Math.sin(PI * f / sr);
        const d = 1 / MODE_Q[k];
        const h = wind - this.ml[k] - d * this.mb[k];
        this.mb[k] += c * h;
        this.ml[k] += c * this.mb[k];
        metal += this.mb[k] * MODE_GAIN[k];
      }

      // 0.20, measured: a bank of high-Q resonators summing continuously is
      // far louder than a struck voice at the same nominal gain, and at 0.5 the
      // pass peaked at 0.33 against the 0.15 everything else on this site sits
      // at. The scene's own gain is unchanged; this is the bank's.
      const v = (metal + wind * WIND_DIRECT) * amp * this.gain * 0.20;

      // Equal-power pan, sweeping across the pass.
      const p = this.panFrom + (this.panTo - this.panFrom) * u;
      const th = (Math.max(-1, Math.min(1, p)) + 1) * 0.25 * PI;
      outL[i] += v * Math.cos(th);
      outR[i] += v * Math.sin(th);
    }
  }
}

class RushProcessor extends AudioWorkletProcessor {
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
    // A note can also be given at construction, and that exists for one reason
    // worth stating: an OfflineAudioContext delivers port messages after the
    // render has finished, so a note posted to the port cannot be measured
    // offline at all. Every number in the release notes about this sound was
    // rendered through this path, which is the same processor the scene runs.
    const first = options?.processorOptions?.note;
    if (first) this.rush(first);
    this.port.onmessage = e => {
      const d = e.data || {};
      if (d.type === 'rush') this.rush(d);
      else if (d.type === 'report') {
        this.port.postMessage({
          type: 'report', worstMs: this.worstMs, dropped: this.dropped,
          startupGaps: this.startupGaps, suspends: this.suspends,
          maxGap: this.maxGap, maxGapAt: this.maxGapAt, frames: currentFrame,
        });
      }
    };
  }

  // One reading is one pass. Voices are capped rather than queued: reading
  // quickly gives overlapping passes, which is what several things going by
  // sounds like, not a backlog.
  rush(d) {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    if (this.voices.length >= 8) this.voices.shift();
    this.voices.push(new Rush(
      sampleRate, d.hz, d.gain, d.dur ?? 0.9,
      d.panFrom ?? -0.8, d.panTo ?? 0.8, this.seed));
  }

  process(_inputs, outputs) {
    // `performance` is not defined in AudioWorkletGlobalScope in every engine —
    // it is absent in the one this was measured in — so the duration probe is
    // inert rather than throwing, and `worstMs: 0` means "not measurable here",
    // not "free".
    const t0 = typeof performance !== 'undefined' && performance.now ? performance.now() : 0;

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

    const ch = outputs[0];
    if (!ch || !ch[0]) return true;
    const outL = ch[0];
    const outR = ch.length > 1 ? ch[1] : ch[0];
    outL.fill(0);
    if (outR !== outL) outR.fill(0);
    for (let v = this.voices.length - 1; v >= 0; v--) {
      this.voices[v].render(outL, outR, outL.length);
      if (this.voices[v].done) this.voices.splice(v, 1);
    }
    for (let c = 2; c < ch.length; c++) ch[c].set(outL);

    if (t0) {
      const ms = performance.now() - t0;
      if (ms > this.worstMs) this.worstMs = ms;
    }
    return true;
  }
}

registerProcessor('psyshell-rush', RushProcessor);
