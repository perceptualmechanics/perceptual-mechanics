
const MODES = [1, 1.58, 2.31, 3.07, 4.19, 5.63];
const MODE_GAIN = [0.55, 1.0, 0.82, 0.62, 0.40, 0.24];
const MODE_Q = [38, 46, 52, 58, 64, 70];

const DOPPLER = 0.055;
const DOPPLER_SHARPNESS = 0.16;   // fraction of the pass the crossing occupies

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

      const env = Math.sin(PI * u);
      const amp = env * env;

      const shift = 1 + DOPPLER * -Math.tanh((u - 0.5) / DOPPLER_SHARPNESS);

      const noise = this.rand();

      const wf = this.hz * shift * (WIND_HI + (WIND_LO - WIND_HI) * u);
      const wc = 2 * Math.sin(PI * Math.min(0.45, wf / sr));
      const wd = 1 / WIND_Q;
      const wh = noise - this.wl - wd * this.wb;
      this.wb += wc * wh;
      this.wl += wc * this.wb;
      const wind = this.wb;

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

      const v = (metal + wind * WIND_DIRECT) * amp * this.gain * 0.20;

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

  rush(d) {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    if (this.voices.length >= 8) this.voices.shift();
    this.voices.push(new Rush(
      sampleRate, d.hz, d.gain, d.dur ?? 0.9,
      d.panFrom ?? -0.8, d.panTo ?? 0.8, this.seed));
  }

  process(_inputs, outputs) {
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
