import {
  bindGuardedResize, prefersReducedMotion, onReducedMotionChange, parseHTML,
  createFrameClock, trackTimers, claimContainer, bindPersistedSoundToggle,
  createJumpList,
} from '../../utils/sceneKit.js';
import {
  ELEMENTS, ELEMENT_BY_KEY, VISIBLE_MIN, VISIBLE_MAX, CHORD_CAP, SOLAR_MIXTURE,
  wavelengthToRGB, luminousEfficiency, wavelengthToHz, visibleLines, fraunhoferFor,
} from './apollo.text.js';
import apolloHtml from './apollo.html?raw';
import './apollo.css';


const BAND_LEFT_NM = VISIBLE_MIN;
const BAND_RIGHT_NM = VISIBLE_MAX;

const TAU_MAX = 4.6;

const RELATIVE_STRENGTH_EXPONENT = 0.55;

export function createApollo(container, { preview = false, initialArg = null, onStateChange = null } = {}) {
  let disposed = false;
  const timers = trackTimers();

  const clock = createFrameClock();
  const uiClock = createFrameClock();

  let mode = 'absorption';
  let modeMix = 0;
  const MODE_FADE = 0.55; // seconds
  const CORONA_IN_EMISSION = 0.14;
  function coronaScale(fy) {
    if (modeMix <= 0) return 1;
    const cy = (bandY + bandH * 0.5) / Math.max(1, H);
    const half = (bandH * 1.5) / Math.max(1, H);
    const t = (fy - cy) / Math.max(1e-6, half);
    const local = Math.exp(-t * t);
    const inEmission = CORONA_IN_EMISSION + (1 - CORONA_IN_EMISSION) * local * 0.55;
    return 1 - (1 - inEmission) * modeMix;
  }

  const claim = claimContainer(container, { position: 'relative', overflow: 'hidden' });
  container.classList.add('apollo-scene');

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.dataset.frames = '0';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });

  const dpr = () => Math.min(2, window.devicePixelRatio || 1);

  let W = 0, H = 0;
  let bandX = 0, bandY = 0, bandW = 0, bandH = 0;

  function layout() {
    const cw = container.clientWidth || window.innerWidth;
    const ch = container.clientHeight || window.innerHeight;
    const r = dpr();
    W = Math.max(1, Math.round(cw * r));
    H = Math.max(1, Math.round(ch * r));
    canvas.width = W; canvas.height = H;

    if (preview) {
      bandX = 0; bandW = W;
      bandH = Math.max(1, Math.round(H * 0.34));
      bandY = Math.round(H * 0.5 - bandH / 2);
    } else {
      const pad = Math.round(Math.min(W * 0.06, 90 * r));
      bandX = pad; bandW = Math.max(1, W - pad * 2);

      const scaleBlock = SCALE_BLOCK * r;

      let floor = H - 8 * r;
      if (railEl) {
        const cb = container.getBoundingClientRect();
        const rb = railEl.getBoundingClientRect();
        if (rb.height && cb.height) floor = Math.min(floor, (rb.top - cb.top) * (H / cb.height) - 12 * r);
      }
      const ceiling = Math.round(H * 0.17);  // clear of the hint, which wraps to two lines on a phone

      const avail = floor - ceiling;
      rulerFits = !rulerOn || (avail - scaleBlock - RULER_BLOCK * r >= BAND_MIN * r);
      const below = scaleBlock + (rulerOn && rulerFits ? RULER_BLOCK * r : 0);
      const minBand = Math.max(24 * r, Math.min(BAND_MIN * r, avail - below));

      let h = Math.round(Math.min(H * 0.22, 210 * r));
      h = Math.max(minBand, Math.min(h, Math.round(avail - below)));
      bandH = h;

      let y = Math.round(H * 0.40 - bandH / 2);
      y = Math.min(y, Math.round(floor - below - bandH));
      bandY = Math.max(ceiling, y);
    }
  }

  const SCALE_BLOCK = 24;
  const RULER_BLOCK = 46;
  const BAND_MIN = 70;   // CSS px — the band's preferred floor
  let rulerFits = true;

  const ROLLOFF_EXPONENT = 0.38;
  const ROLLOFF_FLOOR = 0.05;
  const EMISSION_EXPONENT = 0.22;
  const EMISSION_FLOOR = 0.34;

  const continuumCanvas = document.createElement('canvas');
  const continuumCtx = continuumCanvas.getContext('2d');
  let colNm = null, colR = null, colG = null, colB = null;
  let emR = null, emG = null, emB = null;

  function buildContinuum() {
    continuumCanvas.width = bandW; continuumCanvas.height = bandH;
    colNm = new Float32Array(bandW);
    colR = new Float32Array(bandW); colG = new Float32Array(bandW); colB = new Float32Array(bandW);
    emR = new Float32Array(bandW); emG = new Float32Array(bandW); emB = new Float32Array(bandW);
    for (let x = 0; x < bandW; x++) {
      const nm = BAND_LEFT_NM + (BAND_RIGHT_NM - BAND_LEFT_NM) * (x / Math.max(1, bandW - 1));
      colNm[x] = nm;
      const [r, g, b] = wavelengthToRGB(nm);
      const V = luminousEfficiency(nm);
      const v = ROLLOFF_FLOOR + (1 - ROLLOFF_FLOOR) * Math.pow(V, ROLLOFF_EXPONENT);
      colR[x] = r * v; colG[x] = g * v; colB[x] = b * v;
      const e = EMISSION_FLOOR + (1 - EMISSION_FLOOR) * Math.pow(V, EMISSION_EXPONENT);
      emR[x] = r * e; emG[x] = g * e; emB[x] = b * e;
    }

    const img = continuumCtx.createImageData(bandW, bandH);
    const data = img.data;
    const stripe = new Float32Array(bandW);
    for (let x = 0; x < bandW; x++) {
      stripe[x] = 1
        + 0.012 * Math.sin(x * 1.93 + 1.7)
        + 0.009 * Math.sin(x * 0.61 + 0.4)
        + 0.007 * Math.sin(x * 4.27 + 2.9);
    }
    for (let y = 0; y < bandH; y++) {
      const ny = bandH <= 1 ? 0 : (y / (bandH - 1)) * 2 - 1;   // -1 .. 1
      const vignette = 1 - 0.30 * Math.pow(Math.abs(ny), 2.4);
      const band = 1 + 0.012 * Math.sin(y * 0.77 + 0.9) + 0.008 * Math.sin(y * 0.13);
      const rowScale = vignette * band;
      let o = y * bandW * 4;
      for (let x = 0; x < bandW; x++, o += 4) {
        const grain = 1 + (Math.random() - 0.5) * 0.10;
        const k = rowScale * stripe[x] * grain;
        data[o]     = Math.min(255, colR[x] * k);
        data[o + 1] = Math.min(255, colG[x] * k);
        data[o + 2] = Math.min(255, colB[x] * k);
        data[o + 3] = 255;
      }
    }
    continuumCtx.putImageData(img, 0, 0);
  }

  const density = Object.fromEntries(ELEMENTS.map(e => [e.key, 0]));
  if (preview) {
    for (const el of ELEMENTS) density[el.key] = SOLAR_MIXTURE[el.key] ?? 0;
  } else {
    density.Na = 0.7;
  }

  const maskCanvas = document.createElement('canvas');
  const maskCtx = maskCanvas.getContext('2d');
  const emitCanvas = document.createElement('canvas');
  const emitCtx = emitCanvas.getContext('2d');
  let tau = null;
  let bandDirty = true;

  const LINE_SIGMA_FLOOR = 0.35;
  function lineSigma() {
    return Math.max(LINE_SIGMA_FLOOR, (bandW / 1400) * 0.7);
  }

  function buildBand() {
    if (!bandW || !bandH) return;
    const sigma = lineSigma();
    const inv2s2 = 1 / (2 * sigma * sigma);
    const reach = Math.ceil(sigma * 4);
    const nmPerCol = (BAND_RIGHT_NM - BAND_LEFT_NM) / Math.max(1, bandW - 1);

    if (!tau || tau.length !== bandW) tau = new Float32Array(bandW);
    tau.fill(0);

    for (const el of ELEMENTS) {
      const d = density[el.key];
      if (d <= 0.001) continue;
      for (const [nm, rel] of visibleLines(el)) {
        const xc = (nm - BAND_LEFT_NM) / nmPerCol;
        const amp = d * TAU_MAX * Math.pow(rel / 1000, RELATIVE_STRENGTH_EXPONENT);
        const lo = Math.max(0, Math.floor(xc - reach));
        const hi = Math.min(bandW - 1, Math.ceil(xc + reach));
        for (let x = lo; x <= hi; x++) {
          const dx = x - xc;
          tau[x] += amp * Math.exp(-dx * dx * inv2s2);
        }
      }
    }

    maskCanvas.width = bandW; maskCanvas.height = 1;
    const m = maskCtx.createImageData(bandW, 1);
    for (let x = 0; x < bandW; x++) {
      const T = Math.exp(-tau[x]);
      m.data[x * 4 + 3] = Math.round(255 * (1 - T));
    }
    maskCtx.putImageData(m, 0, 0);

    emitCanvas.width = bandW; emitCanvas.height = 1;
    const e = emitCtx.createImageData(bandW, 1);
    for (let x = 0; x < bandW; x++) {
      const strength = 1 - Math.exp(-tau[x]);
      const o = x * 4;
      e.data[o]     = Math.min(255, emR[x] * strength);
      e.data[o + 1] = Math.min(255, emG[x] * strength);
      e.data[o + 2] = Math.min(255, emB[x] * strength);
      e.data[o + 3] = 255;
    }
    emitCtx.putImageData(e, 0, 0);
    bandDirty = false;
  }

  function setDensity(key, value) {
    density[key] = Math.max(0, Math.min(1, value));
    bandDirty = true;
    rebuildJumpList();
  }

  const FILAMENT_COUNT = preview ? 60 : 260;
  const SEGMENTS = preview ? 8 : 14;
  const filaments = [];

  function seedFilaments() {
    filaments.length = 0;
    for (let i = 0; i < FILAMENT_COUNT; i++) {
      const bright = Math.random() < 0.14;
      filaments.push({
        y: Math.random(),                                  // 0..1 of height
        speed: 0.035 + Math.random() * 0.055,
        phase: Math.random() * Math.PI * 2,
        k1: 0.8 + Math.random() * 1.4,
        k2: 2.5 + Math.random() * 2.5,
        a1: 0.002 + Math.random() * 0.008,
        a2: 0.001 + Math.random() * 0.002,
        slope: (Math.random() - 0.5) * 0.16,
        width: bright ? 1.2 + Math.random() * 1.0 : 0.4 + Math.random() * 0.7,
        alpha: bright ? 0.19 + Math.random() * 0.13 : 0.048 + Math.random() * 0.075,
        warm: Math.random(),
        x: 0.05 + Math.pow(Math.random(), 0.55) * 1.05,
        len: 0.10 + Math.random() * 0.26,
      });
    }
  }

  const SPAWN_MARGIN = 0.25;
  function advanceFilaments(dt) {
    for (const f of filaments) {
      f.x -= f.speed * dt;
      if (f.x < -f.len) f.x += 1 + f.len + SPAWN_MARGIN;
    }
  }

  const disturbances = [];
  const DISTURB_LIFE = 2.4;      // seconds — long enough to cross the frame
  const DISTURB_SPEED = 0.42;    // fractions of the frame width per second
  const DISTURB_SHELL = 0.055;   // half-width of the travelling front

  function disturbAt(px, py) {
    disturbances.push({ x: px / Math.max(1, W), y: py / Math.max(1, H), t: 0 });
    if (disturbances.length > 10) disturbances.shift();
  }

  function disturbanceOffset(fx, fy) {
    if (!disturbances.length) return 0;
    let dy = 0;
    const aspect = H / Math.max(1, W);
    for (const d of disturbances) {
      const ddx = fx - d.x, ddy = (fy - d.y) * aspect;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      const radius = d.t * DISTURB_SPEED;
      const off = (dist - radius) / DISTURB_SHELL;
      if (off < -4 || off > 4) continue;
      const shell = Math.exp(-0.5 * off * off);
      const fade = (1 - d.t / DISTURB_LIFE) / (1 + radius * 3.5);
      dy += 0.075 * shell * fade * Math.sin(off * 2.4);
    }
    return dy;
  }

  let rulerOn = false;
  const HZ_MIN = wavelengthToHz(BAND_RIGHT_NM);
  const HZ_MAX = wavelengthToHz(BAND_LEFT_NM);
  const xForNm = nm => bandX + ((nm - BAND_LEFT_NM) / (BAND_RIGHT_NM - BAND_LEFT_NM)) * bandW;
  const xForHz = hz => bandX + ((hz - HZ_MIN) / (HZ_MAX - HZ_MIN)) * bandW;

  const ABSORPTION_SUSTAIN = 5.5;
  const EMISSION_RING = 4.2;      // seconds, few voices — two full sodium beats
  const EMISSION_SWARM = 1.4;     // seconds, at the chord cap
  const EMISSION_CROWD = 6;       // voices below which the ring is kept whole
  const PIANO_PITCH_REF = 550;    // Hz, near the middle of the band
  const PIANO_PITCH_TILT = 0.9;   // decay ∝ (ref/hz)^tilt

  function crowdFraction(voices) {
    return Math.max(0, Math.min(1, (voices - EMISSION_CROWD) / (CHORD_CAP - EMISSION_CROWD)));
  }

  function noteLength(voices, hz = null) {
    if (mode === 'absorption') return ABSORPTION_SUSTAIN;
    const base = EMISSION_RING - crowdFraction(voices) * (EMISSION_RING - EMISSION_SWARM);
    if (hz === null) return base;
    return base * Math.pow(PIANO_PITCH_REF / hz, PIANO_PITCH_TILT);
  }

  const struck = [];

  function drawCorona() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const t = clock.elapsed;
    for (const f of filaments) {
      const ph = f.phase + t * f.speed * 6.0;
      const xRight = f.x, xLeft = f.x - f.len;
      ctx.beginPath();
      for (let s = 0; s <= SEGMENTS; s++) {
        const u = s / SEGMENTS;                 // 0 at the strand's right end
        const fx = xRight - u * f.len;
        let fy = f.y
          + f.slope * u * f.len
          + f.a1 * Math.sin(f.k1 * u * Math.PI * 2 + ph)
          + f.a2 * Math.sin(f.k2 * u * Math.PI * 2 - ph * 1.7);
        fy += disturbanceOffset(fx, fy);
        const px = fx * W, py = fy * H;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      const depth = 0.5 + 0.5 * Math.min(1, Math.max(0, (xRight + xLeft) * 0.5));
      const a = f.alpha * depth * coronaScale(f.y);
      const grad = ctx.createLinearGradient(xRight * W, 0, xLeft * W, 0);
      const warmR = 255, warmG = 236 - f.warm * 26, warmB = 198 - f.warm * 58;
      grad.addColorStop(0, `rgba(${warmR},${warmG},${warmB},0)`);
      grad.addColorStop(0.18, `rgba(${warmR},${warmG},${warmB},${a})`);
      grad.addColorStop(0.7, `rgba(${warmR},${warmG},${warmB},${a * 0.7})`);
      grad.addColorStop(1, `rgba(${warmR},${warmG},${warmB},0)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = f.width * dpr();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBand() {
    if (bandDirty) buildBand();
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (modeMix < 1) {
      ctx.globalAlpha = 1 - modeMix;
      ctx.drawImage(continuumCanvas, bandX, bandY);
      ctx.drawImage(maskCanvas, 0, 0, bandW, 1, bandX, bandY, bandW, bandH);
    }

    if (modeMix > 0) {
      ctx.globalCompositeOperation = 'lighter';
      const glow = Math.round(bandH * 0.32);
      ctx.globalAlpha = modeMix * 0.30;
      ctx.drawImage(emitCanvas, 0, 0, bandW, 1, bandX, bandY - glow, bandW, bandH + glow * 2);
      ctx.globalAlpha = modeMix;
      ctx.drawImage(emitCanvas, 0, 0, bandW, 1, bandX, bandY, bandW, bandH);
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = `rgba(201,174,116,${(0.30 * (1 - modeMix * 0.62)).toFixed(3)})`;
    ctx.lineWidth = Math.max(1, dpr() * 0.5);
    ctx.beginPath();
    ctx.moveTo(bandX, bandY - 0.5); ctx.lineTo(bandX + bandW, bandY - 0.5);
    ctx.moveTo(bandX, bandY + bandH + 0.5); ctx.lineTo(bandX + bandW, bandY + bandH + 0.5);
    ctx.stroke();
    ctx.restore();
  }

  function drawStruck() {
    if (!struck.length) return;
    const r = dpr();
    ctx.save();
    for (const s of struck) {
      const age = 1 - s.t / s.life;
      if (age <= 0) continue;
      const x = xForNm(s.nm);
      ctx.globalCompositeOperation = 'lighter';
      const [cr, cg, cb] = wavelengthToRGB(s.nm);
      const g = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},0)`);
      g.addColorStop(0.5, `rgba(${cr},${cg},${cb},${0.85 * age})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, bandY, 2 * r, bandH);

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(240,228,196,${0.9 * age})`;
      ctx.beginPath();
      ctx.arc(x, bandY - 7 * r, 2.2 * r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRuler() {
    if (!rulerOn || !rulerFits || preview) return;
    const r = dpr();
    const y = bandY + bandH + (SCALE_BLOCK + 22) * r;
    ctx.save();
    ctx.strokeStyle = 'rgba(201,174,116,0.35)';
    ctx.lineWidth = Math.max(1, r * 0.5);
    ctx.beginPath(); ctx.moveTo(bandX, y); ctx.lineTo(bandX + bandW, y); ctx.stroke();

    ctx.fillStyle = 'rgba(201,174,116,0.5)';
    ctx.strokeStyle = 'rgba(201,174,116,0.28)';
    for (let n = 0; n <= 11; n++) {
      const x = xForHz(HZ_MIN * Math.pow(2, n / 12));
      const tall = n === 0;
      ctx.beginPath();
      ctx.moveTo(x, y - (tall ? 7 : 4) * r);
      ctx.lineTo(x, y + (tall ? 7 : 4) * r);
      ctx.stroke();
    }

    ctx.font = `${Math.round(9 * r)}px Electrolize, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    for (const hzLabel of [400, 500, 600, 700]) {
      if (hzLabel < HZ_MIN || hzLabel > HZ_MAX) continue;
      ctx.fillText(String(hzLabel), xForHz(hzLabel), y + 9 * r);
    }
    ctx.textAlign = 'left';
    ctx.fillText('Hz', bandX + bandW + 4 * r, y + 9 * r);

    for (const s of struck) {
      const age = 1 - s.t / s.life;
      if (age <= 0) continue;
      const xb = xForNm(s.nm), xr = xForHz(wavelengthToHz(s.nm));
      ctx.strokeStyle = `rgba(201,174,116,${0.22 * age})`;
      ctx.beginPath();
      ctx.moveTo(xb, bandY + bandH + SCALE_BLOCK * r);
      ctx.lineTo(xr, y - 9 * r);
      ctx.stroke();
      ctx.fillStyle = `rgba(240,228,196,${0.95 * age})`;
      ctx.beginPath(); ctx.arc(xr, y, 2.6 * r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawScale() {
    if (preview) return;
    const r = dpr();
    ctx.save();
    ctx.fillStyle = 'rgba(201,174,116,0.55)';
    ctx.font = `${Math.round(9 * r)}px Electrolize, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let nm = 400; nm <= 700; nm += 50) {
      const x = xForNm(nm);
      ctx.fillRect(x, bandY + bandH + 2 * r, Math.max(1, r * 0.5), 4 * r);
      ctx.fillText(String(nm), x, bandY + bandH + 9 * r);
    }
    ctx.textAlign = 'left';
    ctx.fillText('nm', bandX + bandW + 4 * r, bandY + bandH + 9 * r);
    ctx.restore();
  }

  let audioCtx = null, muteGain = null, busGain = null, comp = null, verb = null, wetGain = null;
  let noiseBuf = null;
  let soundEnabled = false;
  let soundToggleEl = null, soundToggleLabelEl = null, srLiveEl = null;

  function makeImpulseResponse(c, duration, decay) {
    const rate = c.sampleRate;
    const length = Math.floor(rate * duration);
    const buf = c.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return buf;
  }

  function buildAudioGraph() {
    if (disposed || audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    muteGain = audioCtx.createGain(); muteGain.gain.value = 0;
    muteGain.connect(audioCtx.destination);
    comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 6; comp.attack.value = 0.010; comp.release.value = 0.28;
    comp.connect(muteGain);
    busGain = audioCtx.createGain(); busGain.gain.value = 1;
    busGain.connect(comp);
    verb = audioCtx.createConvolver();
    verb.buffer = makeImpulseResponse(audioCtx, 1.6, 2.6);
    verb.connect(comp);
    wetGain = audioCtx.createGain(); wetGain.gain.value = wetForMode();
    wetGain.connect(verb);
    noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }

  const wetForMode = () => (mode === 'emission' ? 0.10 : 0.22);

  function setSoundEnabled(on) {
    if (disposed) return;
    soundEnabled = on;
    if (on) buildAudioGraph();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (muteGain) {
      const now = audioCtx.currentTime;
      muteGain.gain.cancelScheduledValues(now);
      muteGain.gain.linearRampToValueAtTime(on ? 1 : 0, now + 0.25);
    }
    if (soundToggleEl) {
      soundToggleEl.setAttribute('aria-pressed', String(on));
      if (soundToggleLabelEl) soundToggleLabelEl.textContent = on ? 'Sound on' : 'Sound off';
    }
  }

  const TRANSIENT = 0.035; // seconds
  const HAMMER_CENTRE = 0.75;
  function strikeTransient(now, hz, amp, ring, v) {
    if (!noiseBuf) return;
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = hz * HAMMER_CENTRE;
    bp.Q.value = (1.6 + 6 * v) * (0.25 + 0.75 * ring);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(amp * (2.6 + 1.8 * v), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + TRANSIENT);
    src.connect(bp); bp.connect(g); g.connect(busGain);
    src.start(now, Math.random() * 0.9, TRANSIENT + 0.02);
  }

  function playLine(nm, rel, voices, when = null) {
    if (!audioCtx || !soundEnabled) return;
    const now = when === null ? audioCtx.currentTime : Math.max(when, audioCtx.currentTime);
    const hz = wavelengthToHz(nm);
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = hz;
    const env = audioCtx.createGain();
    const life = noteLength(voices, hz);
    const attack = mode === 'emission' ? 0.001 : 0.05;
    const amp = 0.16 * Math.pow(rel / 1000, 0.5) / Math.sqrt(Math.max(1, voices));
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(amp, now + attack);
    if (mode === 'emission') {
      env.gain.exponentialRampToValueAtTime(amp * 0.18, now + 0.08);
      env.gain.exponentialRampToValueAtTime(0.0001, now + life);
      strikeTransient(now, hz, amp, 1 - crowdFraction(voices), Math.pow(rel / 1000, 0.5));
    } else {
      env.gain.exponentialRampToValueAtTime(0.0001, now + life);
    }
    osc.connect(env);
    env.connect(busGain);
    env.connect(wetGain);
    osc.start(now);
    osc.stop(now + life + 0.2);
  }

  function markStruck(nm, el, voices = 1) {
    struck.push({ nm, el, t: 0, life: noteLength(voices, wavelengthToHz(nm)) });
    if (struck.length > 64) struck.shift();
    const x = xForNm(nm);
    disturbAt(x, bandY + bandH * 0.5);
  }

  function srSay(text) { if (srLiveEl) srLiveEl.textContent = text; }

  const MIX_TOKEN = /^([a-z]{1,2})(\d{1,3})$/;
  const SYMBOL_TO_KEY = Object.fromEntries(ELEMENTS.map(e => [e.symbol.toLowerCase(), e.key]));

  function mixtureString() {
    const parts = [];
    for (const el of ELEMENTS) {
      const pct = Math.round(density[el.key] * 100);
      if (pct > 0) parts.push(el.symbol.toLowerCase() + pct);
    }
    if (mode === 'emission') parts.push('emission');
    if (rulerOn) parts.push('ruler');
    if (ambientOn) parts.push('sun');
    return parts.join(',');
  }

  function applyMixture(str) {
    if (!str) return false;
    let touched = false, wantEmission = false, wantRuler = false, wantSun = false;
    const seen = new Set();
    for (const tokRaw of String(str).split(',')) {
      const tok = tokRaw.trim().toLowerCase();
      if (!tok) continue;
      if (tok === 'emission') { wantEmission = true; touched = true; continue; }
      if (tok === 'absorption') { touched = true; continue; }
      if (tok === 'ruler') { wantRuler = true; touched = true; continue; }
      if (tok === 'sun') { wantSun = true; touched = true; continue; }
      const m = MIX_TOKEN.exec(tok);
      if (!m) continue;
      const key = SYMBOL_TO_KEY[m[1]];
      if (!key) continue;
      seen.add(key);
      setDensity(key, Math.max(0, Math.min(100, Number(m[2]))) / 100);
      touched = true;
    }
    if (!touched) return false;
    for (const el of ELEMENTS) if (!seen.has(el.key)) setDensity(el.key, 0);
    for (const el of ELEMENTS) syncFader(el.key);
    setMode(wantEmission ? 'emission' : 'absorption');
    if (wantRuler !== rulerOn) toggleRuler();
    if (wantSun !== ambientOn) setAmbient(wantSun, { setMixture: false });
    return true;
  }

  async function copyMixtureLink() {
    const str = mixtureString();
    onStateChange?.(str);
    const url = location.href;
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch {  }
    if (copyLinkEl) {
      copyLinkEl.textContent = ok ? 'Copied' : 'In the address bar';
      timers.after(1800, () => { if (copyLinkEl) copyLinkEl.textContent = 'Copy link'; });
    }
    srSay(ok
      ? 'Link copied. It carries the current mixture, the light source, and whether the pitch ruler is showing.'
      : 'The link is in the address bar. It carries the current mixture, the light source, and whether the pitch ruler is showing.');
  }

  const AMBIENT_RATE = 0.55;              // notes per second, mean
  const AMBIENT_AHEAD = 1.2;              // seconds of lookahead per tick
  const AMBIENT_TICK = 250;               // ms — under the first background-throttle tier
  const AMBIENT_AHEAD_HIDDEN = 3.0;       // seconds
  const BACKGROUND_GRACE = 600;           // seconds
  let backgroundUntil = null;
  let ambientOn = false;
  let ambientTimer = null;
  let ambientNext = 0;
  let ambientLastNm = null;
  let ambientClockWasAudio = false;
  const ambientPending = [];

  const ambientNow = () => (audioCtx && audioCtx.state !== 'closed')
    ? audioCtx.currentTime
    : uiClock.elapsed;

  function ambientPool() {
    const pool = [];
    let total = 0;
    for (const el of ELEMENTS) {
      const d = density[el.key];
      if (d <= 0.001) continue;
      for (const [nm, rel] of visibleLines(el)) {
        total += d * Math.pow(rel / 1000, RELATIVE_STRENGTH_EXPONENT);
        pool.push({ nm, rel, el: el.key, cum: total });
      }
    }
    return { pool, total };
  }

  function pickAmbientLine() {
    const { pool, total } = ambientPool();
    if (!pool.length) return null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const r = Math.random() * total;
      let lo = 0, hi = pool.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (pool[mid].cum < r) lo = mid + 1; else hi = mid; }
      const p = pool[lo];
      if (p.nm !== ambientLastNm || pool.length === 1) { ambientLastNm = p.nm; return p; }
    }
    return pool[0];
  }

  function ambientTickFn() {
    if (disposed || !ambientOn) return;
    if (document.hidden && backgroundUntil !== null && ambientNow() >= backgroundUntil) {
      endBackgroundAudio();
      return;
    }
    const isAudio = !!(audioCtx && audioCtx.state !== 'closed');
    if (isAudio !== ambientClockWasAudio) {
      ambientClockWasAudio = isAudio;
      ambientNext = ambientNow() + 0.25;
      ambientPending.length = 0;
    }
    const now = ambientNow();
    if (document.hidden) {
      while (ambientPending.length && ambientPending[0].at <= now) ambientPending.shift();
    }
    let guard = 0;
    const ahead = document.hidden ? AMBIENT_AHEAD_HIDDEN : AMBIENT_AHEAD;
    while (ambientNext < now + ahead && guard++ < 64) {
      const line = pickAmbientLine();
      if (!line) { ambientNext = now + 1; break; }
      playLine(line.nm, line.rel, 1, isAudio ? ambientNext : null);
      ambientPending.push({ nm: line.nm, el: line.el, at: ambientNext });
      ambientNext += -Math.log(1 - Math.random()) / AMBIENT_RATE;
    }
  }

  function startAmbient() {
    if (ambientTimer !== null || disposed) return;
    ambientClockWasAudio = !!(audioCtx && audioCtx.state !== 'closed');
    ambientNext = ambientNow() + 0.25;
    ambientPending.length = 0;
    ambientTickFn();
    ambientTimer = setInterval(ambientTickFn, AMBIENT_TICK);
  }
  function stopAmbient() {
    if (ambientTimer !== null) { clearInterval(ambientTimer); ambientTimer = null; }
    ambientPending.length = 0;
  }

  const backgroundAudible = () =>
    !preview && soundEnabled && ambientOn && !!audioCtx && audioCtx.state !== 'closed';

  function endBackgroundAudio() {
    backgroundUntil = null;
    stopAmbient();
    if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
  }

  function drainAmbient() {
    if (!ambientPending.length) return;
    const now = ambientNow();
    while (ambientPending.length && ambientPending[0].at <= now) {
      const e = ambientPending.shift();
      markStruck(e.nm, e.el, 1);
    }
  }

  function setAmbient(on, { setMixture = true } = {}) {
    if (disposed) return;
    ambientOn = on;
    if (on) {
      if (setMixture) {
        for (const el of ELEMENTS) setDensity(el.key, SOLAR_MIXTURE[el.key] ?? 0);
        for (const el of ELEMENTS) syncFader(el.key);
      }
      startAmbient();
    } else {
      stopAmbient();
    }
    if (ambientToggleEl) {
      ambientToggleEl.setAttribute('aria-pressed', String(on));
    }
    if (!on) {
      srSay('Sunlight off. The mixture stays where it is.');
    } else if (setMixture) {
      srSay('Sunlight. The five elements that own every labelled line in the solar spectrum are now in the light — calcium, iron, hydrogen, magnesium, sodium — and their lines are sounding on their own, weighted by depth. Move a fader or strike a line and it keeps going underneath.');
    } else {
      srSay('Sunlight. The lines of this mixture are sounding on their own, weighted by depth.');
    }
  }

  function toggleRuler() {
    rulerOn = !rulerOn;
    rulerToggleEl?.setAttribute('aria-pressed', String(rulerOn));
    relayout();
    srSay(rulerOn
      ? (rulerFits
        ? 'Pitch ruler shown: the same lines laid out by frequency instead of wavelength.'
        : 'Pitch ruler requested, but there is no room for it at this window size. Turn the phone, or open a wider window.')
      : 'Pitch ruler hidden.');
    rulerToggleEl?.classList.toggle('no-room', rulerOn && !rulerFits);
  }

  function setMode(next) {
    if (next === mode) return;
    mode = next;
    const radio = document.querySelector(`.apollo-mode input[value="${mode}"]`);
    if (radio && !radio.checked) radio.checked = true;
    if (wetGain && audioCtx) {
      const t = audioCtx.currentTime;
      wetGain.gain.cancelScheduledValues(t);
      wetGain.gain.linearRampToValueAtTime(wetForMode(), t + MODE_FADE);
    }
    if (hintEl) hintEl.textContent = mode === 'emission'
      ? 'move a fader to add an element to the gas \u00a0\u00b7\u00a0 click a bright line to strike it'
      : 'move a fader to put an element in the light \u00a0\u00b7\u00a0 click a dark line to hear it';
    srSay(mode === 'emission'
      ? 'The gas is the light now. The band is dark and the lines stand bright in it; striking one plucks it rather than sustaining it.'
      : 'The light is behind the gas again. The band is lit and the lines are missing from it; striking one sounds a long tone.');
  }

  function strikeLine(line) {
    playLine(line.nm, line.rel, 1);
    markStruck(line.nm, line.el, 1);
    const el = ELEMENTS.find(e => e.key === line.el);
    srSay(`${el ? el.name : line.el} ${line.nm.toFixed(3)} nanometres, ${wavelengthToHz(line.nm).toFixed(1)} hertz.`);
  }

  function strikeElement(el) {
    const lines = visibleLines(el)
      .slice()
      .sort((a, b) => b[1] - a[1])
      .slice(0, CHORD_CAP);
    if (density[el.key] <= 0.001) {
      setDensity(el.key, 0.7);
      syncFader(el.key);
    }
    for (const [nm, rel] of lines) {
      playLine(nm, rel, lines.length);
      markStruck(nm, el.key, lines.length);
    }
    const total = visibleLines(el).length;
    srSay(`${el.name}: ${total} line${total === 1 ? '' : 's'} in the band, `
      + `${lines.length === total ? 'all' : `the strongest ${lines.length}`} sounding. ${el.character}`);
  }

  let titleRowEl = null, hintEl = null, rulerToggleEl = null, railEl = null, ambientToggleEl = null, copyLinkEl = null;
  const faderInputs = {};
  const faderCells = {};
  let soundToggle = { dispose() {} };
  let jumpList = null;

  function syncFader(key) {
    const input = faderInputs[key];
    if (input) input.value = String(Math.round(density[key] * 100));
    const cell = faderCells[key];
    if (cell) cell.dataset.active = String(density[key] > 0.001);
  }

  function buildModeSwitch() {
    const fs = document.createElement('fieldset');
    fs.className = 'apollo-mode';
    const legend = document.createElement('legend');
    legend.textContent = 'Spectrum';
    fs.appendChild(legend);
    for (const [value, label] of [['absorption', 'Absorption'], ['emission', 'Emission']]) {
      const wrap = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'apollo-light-source';
      input.value = value;
      input.checked = value === mode;
      input.addEventListener('change', () => { if (input.checked) setMode(value); });
      const span = document.createElement('span');
      span.textContent = label;
      wrap.append(input, span);
      fs.appendChild(wrap);
    }

    const row = document.createElement('div');
    row.className = 'apollo-mode-row';
    row.appendChild(fs);

    ambientToggleEl = document.createElement('button');
    ambientToggleEl.type = 'button';
    ambientToggleEl.className = 'apollo-ambient';
    ambientToggleEl.setAttribute('aria-pressed', 'false');
    ambientToggleEl.textContent = 'Sunlight';
    ambientToggleEl.title = 'Put the sun\u2019s own composition in the light and let its lines sound on their own';
    ambientToggleEl.addEventListener('click', () => setAmbient(!ambientOn));
    row.appendChild(ambientToggleEl);

    copyLinkEl = document.createElement('button');
    copyLinkEl.type = 'button';
    copyLinkEl.className = 'apollo-copy';
    copyLinkEl.textContent = 'Copy link';
    copyLinkEl.title = 'Copy a link to this exact mixture';
    copyLinkEl.addEventListener('click', copyMixtureLink);
    row.appendChild(copyLinkEl);

    railEl.appendChild(row);
  }

  function buildRail() {
    railEl = document.createElement('div');
    railEl.className = 'apollo-rail';
    buildModeSwitch();
    for (const el of ELEMENTS) {
      const count = visibleLines(el).length;
      const cell = document.createElement('div');
      cell.className = 'apollo-fader';
      cell.dataset.active = String(density[el.key] > 0.001);

      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0'; input.max = '100'; input.step = '1';
      input.value = String(Math.round(density[el.key] * 100));
      input.setAttribute('aria-label', `${el.name} in the light — column density`);
      input.addEventListener('input', () => {
        setDensity(el.key, Number(input.value) / 100);
        cell.dataset.active = String(density[el.key] > 0.001);
      });
      input.addEventListener('change', () => {
        const pct = Math.round(density[el.key] * 100);
        srSay(pct === 0
          ? `${el.name} out of the light.`
          : `${el.name} at ${pct} per cent, ${count} line${count === 1 ? '' : 's'} in the band.`);
      });

      const strike = document.createElement('button');
      strike.type = 'button';
      strike.className = 'apollo-strike';
      strike.textContent = el.symbol;
      strike.setAttribute('aria-label',
        `Sound ${el.name} — ${count} line${count === 1 ? '' : 's'} in the band`);
      strike.addEventListener('click', () => strikeElement(el));

      const countEl = document.createElement('span');
      countEl.className = 'apollo-fader-count';
      countEl.textContent = String(count);
      countEl.setAttribute('aria-hidden', 'true');

      cell.append(input, strike, countEl);
      railEl.appendChild(cell);
      faderInputs[el.key] = input;
      faderCells[el.key] = cell;
    }
    container.appendChild(railEl);
  }

  const JUMP_CAP = 24;
  function activeLines() {
    const out = [];
    for (const el of ELEMENTS) {
      if (density[el.key] <= 0.001) continue;
      for (const [nm, rel] of visibleLines(el)) out.push({ el: el.key, nm, rel });
    }
    return out;
  }
  function rebuildJumpList() {
    if (preview) return;
    jumpList?.dispose();
    const all = activeLines();
    const items = all.slice().sort((a, b) => b.rel - a.rel).slice(0, JUMP_CAP).sort((a, b) => a.nm - b.nm);
    if (!items.length) { jumpList = null; return; }
    jumpList = createJumpList(container, {
      label: items.length < all.length
        ? `The ${items.length} strongest of ${all.length} lines currently in the band`
        : `The ${items.length} lines currently in the band`,
      items,
      getLabel: line => {
        const el = ELEMENTS.find(e => e.key === line.el);
        return `${el ? el.name : line.el} ${line.nm.toFixed(3)}nm — ${wavelengthToHz(line.nm).toFixed(0)} Hz`;
      },
      onSelect: line => strikeLine(line),
    });
  }

  function onCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const r = dpr();
    const px = (e.clientX - rect.left) * (W / rect.width);
    const py = (e.clientY - rect.top) * (H / rect.height);
    const slack = 24 * r;
    if (py < bandY - slack || py > bandY + bandH + slack) return;
    const nm = BAND_LEFT_NM + ((px - bandX) / bandW) * (BAND_RIGHT_NM - BAND_LEFT_NM);
    const nmPerPx = (BAND_RIGHT_NM - BAND_LEFT_NM) / bandW;
    const tol = 9 * r * nmPerPx;
    let best = null, bestD = Infinity;
    for (const line of activeLines()) {
      const d = Math.abs(line.nm - nm);
      if (d < bestD && d <= tol) { bestD = d; best = line; }
    }
    if (best) strikeLine(best);
  }

  let animId = null;
  let paused = false;
  let reduced = prefersReducedMotion();
  let frames = 0;

  function animate() {
    animId = requestAnimationFrame(animate);
    let dt = 0;
    if (reduced) clock.resync(); else dt = clock.tick();
    const udt = uiClock.tick();

    if (dt > 0) advanceFilaments(dt);
    const target = mode === 'emission' ? 1 : 0;
    if (modeMix !== target) {
      const step = udt / MODE_FADE;
      modeMix = target > modeMix ? Math.min(target, modeMix + step) : Math.max(target, modeMix - step);
    }

    drainAmbient();
    for (let i = struck.length - 1; i >= 0; i--) {
      struck[i].t += udt;
      if (struck[i].t >= struck[i].life) struck.splice(i, 1);
    }
    for (let i = disturbances.length - 1; i >= 0; i--) {
      disturbances[i].t += udt;
      if (disturbances[i].t >= DISTURB_LIFE) disturbances.splice(i, 1);
    }

    paint();
  }

  function paint() {
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, W, H);
    drawCorona();
    drawBand();
    drawStruck();
    drawRuler();
    drawScale();

    frames++;
    if ((frames & (frames - 1)) === 0) canvas.dataset.frames = String(frames);
  }

  const reducedWatch = onReducedMotionChange(next => {
    reduced = next;
    clock.resync();
  });

  let lastBandW = 0, lastBandH = 0;
  function relayout() {
    layout();
    if (bandW !== lastBandW || bandH !== lastBandH) {
      lastBandW = bandW; lastBandH = bandH;
      buildContinuum();
      bandDirty = true;
    }
  }
  const resize = bindGuardedResize(container, () => { relayout(); if (paused) paint(); });

  relayout();
  seedFilaments();
  buildBand();

  if (!preview) {
    const frag = parseHTML(apolloHtml);
    titleRowEl = frag.querySelector('.apollo-title-row');
    hintEl = frag.querySelector('.apollo-hint');
    soundToggleEl = frag.querySelector('.apollo-sound-toggle');
    soundToggleLabelEl = soundToggleEl.querySelector('.apollo-sound-toggle-label');
    srLiveEl = frag.querySelector('.apollo-sr-live');
    document.body.append(titleRowEl, hintEl, soundToggleEl);
    container.appendChild(srLiveEl);

    soundToggle = bindPersistedSoundToggle(container, soundToggleEl, setSoundEnabled, 'apollo');

    buildRail();

    rulerToggleEl = document.createElement('button');
    rulerToggleEl.type = 'button';
    rulerToggleEl.className = 'apollo-ruler-toggle';
    rulerToggleEl.setAttribute('aria-pressed', 'false');
    rulerToggleEl.textContent = 'Pitch ruler';
    rulerToggleEl.addEventListener('click', toggleRuler);
    container.appendChild(rulerToggleEl);

    canvas.addEventListener('click', onCanvasClick);
    rebuildJumpList();
    applyMixture(initialArg);
    relayout();
  }

  const onVisibilityChange = () => {
    if (disposed) return;
    if (document.hidden) {
      if (backgroundAudible()) {
        backgroundUntil = ambientNow() + BACKGROUND_GRACE;
        return;
      }
      endBackgroundAudio();
      return;
    }
    backgroundUntil = null;
    clock.resync(); uiClock.resync();
    if (soundEnabled && audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (ambientOn && !paused) startAmbient();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  if (preview) setAmbient(true);

  animate();

  return {
    applyArg(str) { applyMixture(str); },
    setPaused(next) {
      if (next === paused) return;
      paused = next;
      if (paused) {
        if (animId !== null) { cancelAnimationFrame(animId); animId = null; }
        if (!(document.hidden && backgroundAudible())) stopAmbient();
      } else {
        clock.resync(); uiClock.resync();
        if (animId === null) animate();
        if (ambientOn) startAmbient();
      }
    },
    dispose() {
      disposed = true;
      if (animId !== null) cancelAnimationFrame(animId);
      ambientOn = false;
      stopAmbient();
      timers.dispose();
      resize.dispose();
      reducedWatch.dispose();
      canvas.removeEventListener('click', onCanvasClick);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      soundToggle.dispose();
      jumpList?.dispose();
      if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
      muteGain = busGain = comp = verb = wetGain = null;
      soundEnabled = false;
      titleRowEl?.remove(); hintEl?.remove(); soundToggleEl?.remove();
      railEl?.remove(); rulerToggleEl?.remove(); srLiveEl?.remove();
      container.classList.remove('apollo-scene');
      claim.restore();
      container.innerHTML = '';
    },
  };
}
