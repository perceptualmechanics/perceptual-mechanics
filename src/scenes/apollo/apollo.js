import {
  bindGuardedResize, prefersReducedMotion, onReducedMotionChange, parseHTML,
  createFrameClock, trackTimers, claimContainer, bindPersistedSoundToggle,
  createJumpList,
} from '../../utils/sceneKit.js';
import {
  ELEMENTS, VISIBLE_MIN, VISIBLE_MAX, CHORD_CAP,
  wavelengthToRGB, luminousEfficiency, wavelengthToHz, visibleLines,
} from './apollo.text.js';
import apolloHtml from './apollo.html?raw';
import './apollo.css';

// ─── Apollo — an absorption spectrum you can play ──────────────────────────
// Eleventh scene, 2026-09-02. A near-full-width band of starlight with the
// lines missing from it, a corona streaming toward the viewer from the right,
// and ten faders that put elements into the light. Clicking a gap sounds that
// wavelength as a pitch.
//
// Absorption rather than emission, and that is the whole scene. Emission is
// bright lines on black: easier to draw, and much less interesting. Absorption
// is a full band of colour with the lines taken OUT of it, so clicking a gap
// and getting a tone means playing the absences. It is also what actually
// happens — Fraunhofer found these in sunlight in 1814 because the sun's own
// outer atmosphere absorbs on the way out. The scene is that mechanism,
// animated: light on the right, the sampling plane in the middle, and what is
// left when it arrives.
//
// Nothing to do with the Spectra scene shelved earlier the same day. That one
// measured this site's own writing and treated the pieces as sources; it was
// built, measured, and taken back out (see src/scenes/spectra/SHELVED.md).
// This shares the subject and none of the design. Both are recorded so neither
// gets re-proposed.
//
// ─── Why 2D canvas and not Three.js ────────────────────────────────────────
// Every other WebGL scene here goes through manageRenderer, and its own
// comment in sceneKit.js explains the ceiling this scene would have walked
// into: eight preview contexts alive permanently plus one per open scene,
// against a browser cap near sixteen, with the browser force-losing the OLDEST
// context when it runs out — which is the landing tiles. An eleventh WebGL
// scene is an eleventh permanent context. That is a real cost for no benefit
// here: this scene draws a coloured strip, some strokes, and text. There is no
// geometry, no camera, no lighting. A 2D context does all of it, adds nothing
// to the WebGL budget, and is the reason the tile count could go to eleven
// without re-testing the context ceiling.
//
// The consequence for the preview tile is worth stating too. The clipped-blit
// workaround (mountClippedPreviewCanvas) exists because Firefox promotes heavy
// WebGL canvases to a compositing layer that ignores CSS clipping; a 2D canvas
// is not promoted and clips normally, so this scene appends its canvas
// directly in both modes. It therefore has no `data-blits` — but it keeps the
// observability that counter was added for, as `data-frames` on the canvas,
// written on the same power-of-two crossings for the same reason (see the
// blit counter's own comment: a fixed cadence sits on "1" for half a minute on
// a slow machine, which reads exactly like the failure it exists to rule out).
//
// ─── Frame-rate independence ───────────────────────────────────────────────
// createFrameClock, and no fixed per-frame constant anywhere — INCLUDING
// counts. Butterfly's PPF survived two audit sweeps because it was a count
// rather than a rate, and STANDARDS.md now says so in as many words.
//
// So, stated rather than implied, because "no counts here" is the kind of
// claim that is only worth anything if someone checked: this scene contains
// three accumulators and no per-frame counts at all. The corona's drift
// (`t * f.speed`), the struck-line fade (`s.t += udt`) and the disturbance
// decay (`d.t += udt`) are all rates against dt. Every loop in the draw path
// is a traversal of a fixed population — the filaments, the elements, the
// lines of one element — which STANDARDS.md's own wording calls the fine
// kind. Nothing decides how many things to do this frame, so there is nothing
// that would need a carry. If a later change introduces one, it needs the
// carry, not a round.

const BAND_LEFT_NM = VISIBLE_MIN;
const BAND_RIGHT_NM = VISIBLE_MAX;

// Optical depth at a fader's maximum for the strongest possible line. Beer's
// law does the rest: transmission is exp(-tau), taus from different elements
// ADD, and that is why two elements overlapping in the same place go darker
// than either alone without any special case for it. 4.6 puts a full-strength
// line at 1% transmission — black to the eye, but never a hard clamp.
const TAU_MAX = 4.6;

// Relative intensities span three orders of magnitude, and a linear map would
// render everything except the resonance lines invisible. The 0.55 power keeps
// the ordering exactly (it is monotonic) while compressing the range enough
// that iron's forest is a forest rather than four lines and a rumour.
const RELATIVE_STRENGTH_EXPONENT = 0.55;

export function createApollo(container, { preview = false } = {}) {
  let disposed = false;
  const timers = trackTimers();

  // Two clocks, the same split Outside uses and for the same reason. `clock`
  // is the motion clock and it stops under reduced motion, which is what
  // freezes the corona. Struck-line flashes need a clock that always runs,
  // because a flash that cannot end is a bright mark stuck on the band
  // forever — the exact bug Outside's touch pulse had.
  const clock = createFrameClock();
  const uiClock = createFrameClock();

  // ─── Two instruments, one set of lines ────────────────────────────────────
  // Absorption and emission are the same wavelengths seen from opposite sides,
  // so the element data does not change at all. What changes is what the light
  // is doing, and that difference is physical rather than a colour inversion:
  //
  //   Absorption is light passing through and arriving depleted. Continuous,
  //   sustained, something you interrupt. Bowed.
  //   Emission is an excited gas releasing. Discrete, decaying — every photon
  //   is an electron falling. Plucked.
  //
  // So absorption sustains and emission strikes, and the picture follows the
  // same logic: in emission there is no starlight passing through, so there is
  // no band and no streaming corona — a dark field with bright lines standing
  // in it at their own colours, and whatever remains of the flow is local to
  // the lines rather than travelling past them.
  //
  // `modeMix` is 0 in absorption and 1 in emission, eased rather than switched,
  // so the change reads as the light going out rather than as a redraw. It runs
  // on the UI clock, because it answers something the visitor did — the same
  // reason the struck-line flash does.
  let mode = 'absorption';
  let modeMix = 0;
  const MODE_FADE = 0.55; // seconds
  // What is left of the streaming field in emission. Not zero: the gas is in a
  // stellar atmosphere, not a vacuum jar, and a hard cut to black loses the
  // sense that the two modes are the same scene.
  const CORONA_IN_EMISSION = 0.14;
  // Not a flat dimming. In emission what remains has to be LOCAL to the lines
  // rather than streaming past them, so the residue keeps most of its
  // brightness within about a band-height of the band and falls to the 14%
  // floor away from it. The field stops being a river crossing the frame and
  // becomes a haze around the source, which is the actual difference between
  // light in transit and a gas that is glowing.
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

  // Device pixel ratio capped at 2, the same cap manageRenderer applies to
  // every WebGL scene here. An uncapped DPR-3 phone would be filling nine
  // times the pixels this was tuned against, and the continuum build is a
  // per-pixel loop.
  const dpr = () => Math.min(2, window.devicePixelRatio || 1);

  // ─── Layout ───────────────────────────────────────────────────────────────
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
      // A 200px circular tile. The band runs edge to edge and takes a third of
      // the height — inside the circle at the horizontal midline, where the
      // chord is widest, so none of it is clipped away.
      bandX = 0; bandW = W;
      bandH = Math.round(H * 0.34);
      bandY = Math.round(H * 0.5 - bandH / 2);
    } else {
      const pad = Math.round(Math.min(W * 0.06, 90 * r));
      bandX = pad; bandW = Math.max(1, W - pad * 2);
      bandH = Math.round(Math.min(H * 0.22, 210 * r));
      // Sits above centre, so the rail and the site's own bottom chrome have
      // the lower third and the band is not crowded from underneath.
      bandY = Math.round(H * 0.40 - bandH / 2);
    }
  }

  // ─── The continuum ────────────────────────────────────────────────────────
  // Figured out first, because it decides whether this is an object or a
  // diagram. A CSS gradient with black bars over it is a chart. A real
  // spectrum photographed as a strip has grain, uneven intensity across the
  // band, rolloff at both ends, and vertical structure from the slit — and
  // when the lines cut into THAT, they read as absences in a thing rather
  // than as rectangles on a diagram.
  //
  // Four ingredients, in order of how much each one does:
  //
  // 1. Colour from the CIE colour-matching functions, not a hue sweep. See
  //    wavelengthToRGB's comment in apollo.text.js — a hue wheel invents a
  //    magenta that no wavelength produces and puts the brightness peak in
  //    the wrong place.
  // 2. Rolloff from the eye's own luminous efficiency curve. This is the
  //    single biggest contributor to "reads as an object": a real spectrum is
  //    brilliant in the yellow-green and dim at both ends because the eye
  //    barely registers 400nm or 720nm, not because there is less light there.
  //    Raised to a 0.30 power rather than used raw — the raw curve is 8% at
  //    H-alpha, which would render the entire red half nearly black.
  // 3. A fixed vertical stripe pattern, constant down each column. This is
  //    what a flat-field looks like on a real spectrograph: dust and figure on
  //    the slit, printed identically into every row.
  // 4. Per-pixel grain, and a vertical vignette so the strip has an edge
  //    rather than a border.
  // Rolloff shape. The raw luminous-efficiency curve is 8% at H-alpha and
  // 0.003% at 400nm, which would render most of the band black; raised to a
  // 0.38 power with a 5% floor it keeps the eye's own falloff — the reason a
  // real spectrum is brilliant in the yellow-green and dark at both ends —
  // without throwing the ends away. Chosen by rendering strips and comparing
  // them against photographs, not derived.
  const ROLLOFF_EXPONENT = 0.38;
  const ROLLOFF_FLOOR = 0.05;
  const EMISSION_EXPONENT = 0.22;
  const EMISSION_FLOOR = 0.34;

  const continuumCanvas = document.createElement('canvas');
  const continuumCtx = continuumCanvas.getContext('2d');
  // Column -> wavelength -> colour is pure and expensive; hoisted out of the
  // per-pixel loop and kept for the hit-testing and the ruler as well.
  let colNm = null, colR = null, colG = null, colB = null;
  // A second colour table for emission. The continuum's rolloff is right for a
  // continuum — it is the eye's own falloff and it is what makes the band read
  // as an object — but applied to a bright line it renders H-alpha at 25% and
  // the deep red end of an emission spectrum is not that dim. A gentler curve
  // over the same luminous-efficiency function: still visibly dimmer at the
  // ends, because that is true, but present.
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
    // Column stripe: three superposed periods so it does not read as a ruled
    // pattern. Same value for every row of a column, which is the point.
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
      // Slow horizontal banding — the emulsion, not the optics.
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

  // ─── Absorption ───────────────────────────────────────────────────────────
  // Column density per element, 0 to 1 — literally how much of it is in the
  // light's path. Not a mode switch and not a checkbox: more of an element
  // deepens its lines toward black and less leaves them faint, continuously,
  // which is what a fader is for and what a real column density does.
  const density = Object.fromEntries(ELEMENTS.map(e => [e.key, 0]));
  if (preview) {
    // A first-visit answer for a 200px tile, and it is answered on frame one
    // rather than accumulated: hydrogen for the wide Balmer spacing, calcium
    // for the two black bars at the violet edge, sodium and magnesium for
    // something in the middle. Butterfly's thumbnail needed twenty-five
    // seconds to reach its subject before 4.1.3; this scene's has nothing to
    // converge to, so the tile is complete the first time it paints.
    density.H = 0.85; density.Ca = 0.45; density.Na = 0.80; density.Mg = 0.50;
  } else {
    // Sodium alone at the start. One element, two lines, and the doublet is
    // the thing the scene most wants a first-time visitor to look at twice.
    density.Na = 0.7;
  }

  const maskCanvas = document.createElement('canvas');
  const maskCtx = maskCanvas.getContext('2d');
  // The emission strip. Same one-row-stretched-down-the-band trick as the
  // absorption mask, and built from the SAME tau array — because 1 - exp(-tau)
  // is how much of the light a column takes out in absorption and how brightly
  // that column glows in emission. One quantity, two readings, which is the
  // physical claim the whole mode switch rests on: these are the same lines
  // seen from opposite sides.
  const emitCanvas = document.createElement('canvas');
  const emitCtx = emitCanvas.getContext('2d');
  let tau = null;
  let bandDirty = true;

  // Line width in columns. Kept under one column at full width on purpose:
  // the sodium doublet is 0.597nm apart, which is 2.3 columns at 1400 columns
  // across 370nm, so a sigma of 0.7 leaves the pair 3.3 sigma apart and
  // visibly two. A wider, prettier line would have merged the one feature the
  // sonification's whole claim rests on.
  function lineSigma() {
    return Math.max(0.55, (bandW / 1400) * 0.7);
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

    // One row of black at alpha = 1 - transmission, stretched down the band.
    // Source-over black over the continuum gives result = continuum * (1-alpha)
    // = continuum * transmission, which is Beer's law exactly, for the price of
    // one drawImage. The stretch is in y only, so no horizontal resampling can
    // smear the doublet.
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

  // ─── The corona ───────────────────────────────────────────────────────────
  // Procedural, not footage. Parker Solar Probe imagery is public domain and
  // it would have been a large asset on a site that just cut a 2.9MB PNG to
  // 30KB — and, more to the point, a video loop cannot react when a line is
  // struck. Generated flow can.
  //
  // Real coronal imagery is filamentary and unevenly bright, with structure at
  // several scales: broad streamers with fine texture inside them. Closer to
  // grain than to smoke, and nothing like a field of discrete dots. So: long
  // strands, each a sum of three sine terms at different spatial frequencies,
  // drawn as tapered polylines with additive blending, in a few brightness
  // classes so some read as bright streamers and most as texture between them.
  const FILAMENT_COUNT = preview ? 60 : 260;
  const SEGMENTS = preview ? 8 : 14;
  const filaments = [];

  function seedFilaments() {
    filaments.length = 0;
    for (let i = 0; i < FILAMENT_COUNT; i++) {
      const bright = Math.random() < 0.14;
      filaments.push({
        y: Math.random(),                                  // 0..1 of height
        // Drift rate in fractions of the frame width per second. A RATE, so
        // it is multiplied by dt; nothing here advances by a per-frame step.
        // 0.035-0.09 puts a strand's crossing time between eleven and
        // twenty-nine seconds — slow enough to be coronal, fast enough that
        // the eye catches it without being asked to look. See advance().
        speed: 0.035 + Math.random() * 0.055,
        phase: Math.random() * Math.PI * 2,
        // Nearly straight, gently curving, slightly sloped. Two wrong
        // versions got here, and both are worth keeping written down because
        // they are opposite mistakes:
        //
        //   Low frequency and large amplitude (k1 near 2, a1 up at 0.075) gave
        //   smooth full-width waves, and a hundred of those at mixed heights
        //   read as a contour map — a topographic diagram of nothing.
        //
        //   High frequency and small amplitude (k1 near 6) fixed the contours
        //   and produced ZIGZAGS: six cycles sampled at eighteen segments is
        //   three samples per cycle, so what rendered was the polyline, not
        //   the curve. The lesson is that a strand's texture cannot come from
        //   its own vertices at this segment count.
        //
        // So the texture comes from DENSITY instead — 260 short, near-straight,
        // overlapping strands at mixed slopes and low alpha, which is what a
        // coronal image actually is. Each strand only has to be plausible on
        // its own; none of them carries the look.
        k1: 0.8 + Math.random() * 1.4,
        k2: 2.5 + Math.random() * 2.5,
        a1: 0.002 + Math.random() * 0.008,
        a2: 0.001 + Math.random() * 0.002,
        slope: (Math.random() - 0.5) * 0.16,
        width: bright ? 1.2 + Math.random() * 1.0 : 0.4 + Math.random() * 0.7,
        alpha: bright ? 0.19 + Math.random() * 0.13 : 0.048 + Math.random() * 0.075,
        warm: Math.random(),
        // Each strand covers only a short part of the width, starting
        // somewhere of its own — overlapping short spans at mixed lengths is
        // what turns the same maths into texture rather than into lines. The
        // 0.55 power biases the starts toward the right, where the light is
        // coming from: the field genuinely thins out as it crosses.
        x: 0.05 + Math.pow(Math.random(), 0.55) * 1.05,
        len: 0.10 + Math.random() * 0.26,
      });
    }
  }

  // ─── Drift ────────────────────────────────────────────────────────────────
  // The strands TRANSLATE, right to left, and until this was written they did
  // not. The first build advanced only each strand's wiggle phase and left its
  // x fixed, under a variable called `speed` and a comment that said "right to
  // left" — so the field vibrated in place at an amplitude of half a percent of
  // the frame height and read, correctly, as static texture on the backdrop.
  //
  // That mattered more than a missing flourish, because it took the strike
  // response down with it. A response only registers as a response if the
  // resting state was legibly at rest; with nothing moving, a local
  // displacement had nothing to differ FROM, and the one gesture that makes
  // the corona the sounding medium rather than a background image was
  // invisible. The fix is motion, not opacity.
  //
  // A rate against dt, and the wrap is a rate too — nothing here counts frames.
  const SPAWN_MARGIN = 0.25;
  function advanceFilaments(dt) {
    for (const f of filaments) {
      f.x -= f.speed * dt;
      if (f.x < -f.len) f.x += 1 + f.len + SPAWN_MARGIN;
    }
  }

  // ─── Disturbance: a wavefront, not a wobble ───────────────────────────────
  // Striking a line disturbs the flow, and the disturbance TRAVELS. It starts
  // at the struck line's own x and expands outward as a ring, so the medium is
  // visibly carrying it — which is what the scene is about. The first version
  // displaced everything within a fixed radius and oscillated it in time, which
  // is a global effect wearing a local mask: every strand inside the circle
  // moved at once, and nothing went anywhere.
  //
  // The ring's radius is `t * DISTURB_SPEED` — a rate — and the displacement
  // is a Gaussian shell around it, so a strand is pushed as the front passes
  // and settles once it has gone by. The sine is a function of distance from
  // the front rather than of time, which is what makes the ripples move
  // outward rather than blink.
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
    // The field is measured in fractions of width and height, which are not the
    // same distance — without this a ring in normalized space is an ellipse on
    // screen, and a wavefront that is visibly taller than it is wide reads as a
    // stretch rather than as a wave.
    const aspect = H / Math.max(1, W);
    for (const d of disturbances) {
      const ddx = fx - d.x, ddy = (fy - d.y) * aspect;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      const radius = d.t * DISTURB_SPEED;
      const off = (dist - radius) / DISTURB_SHELL;
      if (off < -4 || off > 4) continue;
      const shell = Math.exp(-0.5 * off * off);
      // Fades with age AND with distance travelled: a front spreading over a
      // larger circumference carries the same energy through more of it.
      const fade = (1 - d.t / DISTURB_LIFE) / (1 + radius * 3.5);
      dy += 0.075 * shell * fade * Math.sin(off * 2.4);
    }
    return dy;
  }

  // ─── The pitch ruler ──────────────────────────────────────────────────────
  // A prototype the brief asked for and asked to be looked at before
  // committing: the same lines shown a second time, laid out by pitch instead
  // of by wavelength. It earns its place because the two axes are genuinely
  // different — pitch goes as 1/lambda, so a set of lines evenly spaced in the
  // band is unevenly spaced on the ruler, and the hydrogen series that crowds
  // toward the violet end of the band SPREADS toward the treble end of the
  // ruler. That is the reciprocal made visible, and it is not something the
  // band can show on its own.
  //
  // Off by default and toggleable, because it is the one element here that is
  // a diagram rather than an object, and a visitor who only wants to play the
  // instrument should not have to look at it.
  let rulerOn = false;
  const HZ_MIN = wavelengthToHz(BAND_RIGHT_NM);
  const HZ_MAX = wavelengthToHz(BAND_LEFT_NM);
  const xForNm = nm => bandX + ((nm - BAND_LEFT_NM) / (BAND_RIGHT_NM - BAND_LEFT_NM)) * bandW;
  const xForHz = hz => bandX + ((hz - HZ_MIN) / (HZ_MAX - HZ_MIN)) * bandW;

  // ─── How long a note lasts, and why it differs by mode ────────────────────
  // Absorption sustains: a long tone the visitor carves gaps into. Emission
  // strikes: fast attack and a decay, because every photon is an electron
  // falling and nothing about that is held.
  //
  // The emission decay is NOT constant, and the reason is a real constraint
  // rather than a preference. The sodium doublet beats at 0.5154 Hz — a period
  // of 1.94 seconds — and that beat is the best demonstration the sonification
  // has. A decay short enough to feel plucked is shorter than one beat period,
  // which would silence exactly the thing worth hearing. So the decay depends
  // on how many voices are sounding: a few lines ring long enough for the beat
  // to complete twice, and only a crowd decays fast. Sodium's six lines get 4.2
  // seconds; iron's twelve get 1.4, which is what makes fifty lines a swarm
  // rather than a wall of sustain.
  //
  // That is a mixing decision, stated as one, not dressed up as physics — real
  // excited-state lifetimes are nanoseconds and give no anchor at audible
  // scale, so there is nothing here to be faithful to.
  const ABSORPTION_SUSTAIN = 5.5;
  const EMISSION_RING = 4.2;      // seconds, few voices — two full sodium beats
  const EMISSION_SWARM = 1.4;     // seconds, at the chord cap
  const EMISSION_CROWD = 6;       // voices below which the ring is kept whole
  function noteLength(voices) {
    if (mode === 'absorption') return ABSORPTION_SUSTAIN;
    const t = Math.max(0, Math.min(1, (voices - EMISSION_CROWD) / (CHORD_CAP - EMISSION_CROWD)));
    return EMISSION_RING - t * (EMISSION_RING - EMISSION_SWARM);
  }

  // Struck lines, for the flash on the band and the marker on the ruler. Each
  // carries its OWN life rather than reading a shared constant, because two
  // notes no longer last the same time — not across modes, and not across
  // elements within emission. What is lit is what is sounding.
  const struck = [];

  // ─── Drawing ──────────────────────────────────────────────────────────────
  function drawCorona() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const t = clock.elapsed;
    for (const f of filaments) {
      // Right to left: the strand's phase advances so the pattern travels
      // toward the band and past it. The light is in transit; the band is
      // where it is sampled.
      // The wiggle phase still advances — that is the strand's own internal
      // shimmer — but the strand's POSITION now comes from f.x, which
      // advance() moves. Both are rates; neither counts frames.
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
      // Two things at once. Along the strand: fade in and out at both ends, so
      // it has no visible start or stop — a hard-ended stroke reads as a drawn
      // line, and this is meant to read as something the eye resolves out of
      // grain. Across the frame: dimmer the further left the strand sits,
      // because light that has crossed the sampling plane has had something
      // taken out of it.
      const depth = 0.5 + 0.5 * Math.min(1, Math.max(0, (xRight + xLeft) * 0.5));
      // In emission there is no light in transit — the gas is the source — so
      // the streaming field goes with the continuum, leaving only a residue.
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

    // Absorption: the continuum, then Beer's law as one black-over-colour
    // drawImage. Faded out by modeMix rather than switched off, so the two
    // modes cross rather than cut.
    if (modeMix < 1) {
      ctx.globalAlpha = 1 - modeMix;
      ctx.drawImage(continuumCanvas, bandX, bandY);
      ctx.drawImage(maskCanvas, 0, 0, bandW, 1, bandX, bandY, bandW, bandH);
    }

    // Emission: bright lines standing in the dark, added rather than composited
    // over, because that is what light does. Drawn twice — once at the band's
    // own height for the line, and once taller and much fainter for the glow
    // that spills past its edges. The gas is the source here, so it should not
    // stop dead at a rectangle it has no reason to respect.
    if (modeMix > 0) {
      ctx.globalCompositeOperation = 'lighter';
      // 0.32, not the 0.42 this started at: the taller bloom made the lines
      // read as full-height bars and lost the band's own extent, which the
      // wavelength scale underneath still refers to. Enough spill to say the
      // gas is not respecting a rectangle, not so much that the rectangle
      // stops existing.
      const glow = Math.round(bandH * 0.32);
      ctx.globalAlpha = modeMix * 0.30;
      ctx.drawImage(emitCanvas, 0, 0, bandW, 1, bandX, bandY - glow, bandW, bandH + glow * 2);
      ctx.globalAlpha = modeMix;
      ctx.drawImage(emitCanvas, 0, 0, bandW, 1, bandX, bandY, bandW, bandH);
    }
    ctx.restore();

    // A hairline top and bottom so the strip has an edge. Brass, like every
    // other rule in the scene.
    // The band's edges. Faded in emission rather than dropped: with no band
    // there, a full-width hairline top and bottom reads as a leftover frame
    // around nothing — but removing them entirely leaves the lines floating
    // with no relation to the nm scale under them. A third of the way down is
    // enough to say "this is how far the band went" without drawing a box.
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
      // The flash is drawn as light ADDED at the line's own colour, which is
      // the honest gesture: sounding an absence briefly gives back what was
      // taken out of it.
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
    if (!rulerOn || preview) return;
    const r = dpr();
    // Below the wavelength scale, not through it. The first version put the
    // ruler 34px under the band, which is where the nm labels are — so every
    // connector crossed a number on its way down and the two axes read as one
    // tangle. They are two different axes and have to look like it.
    const y = bandY + bandH + 66 * r;
    ctx.save();
    ctx.strokeStyle = 'rgba(201,174,116,0.35)';
    ctx.lineWidth = Math.max(1, r * 0.5);
    ctx.beginPath(); ctx.moveTo(bandX, y); ctx.lineTo(bandX + bandW, y); ctx.stroke();

    // Twelve equal-tempered steps across the band's own span. The whole
    // visible spectrum is 400Hz to 789Hz, which is a ratio of 1.97 — the
    // visible spectrum is almost exactly one octave wide, and the ruler is
    // where that stops being a sentence and becomes a picture.
    ctx.fillStyle = 'rgba(201,174,116,0.5)';
    ctx.strokeStyle = 'rgba(201,174,116,0.28)';
    for (let n = 0; n <= 12; n++) {
      const hz = HZ_MIN * Math.pow(2, n / 12);
      if (hz > HZ_MAX) break;
      const x = xForHz(hz);
      const tall = n % 12 === 0;
      ctx.beginPath();
      ctx.moveTo(x, y - (tall ? 7 : 4) * r);
      ctx.lineTo(x, y + (tall ? 7 : 4) * r);
      ctx.stroke();
    }

    // The axis says what it is, in the same grammar as the nm scale above it.
    // Without this the lower row is a mystery second set of dots.
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
      // Starts below the nm labels, so a connector never crosses a number.
      ctx.strokeStyle = `rgba(201,174,116,${0.22 * age})`;
      ctx.beginPath();
      ctx.moveTo(xb, bandY + bandH + 24 * r);
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

  // ─── Audio ────────────────────────────────────────────────────────────────
  // Wavelength to pitch is one division by one constant — see AUDIO_DIVISOR in
  // apollo.text.js. No scale, no quantization, no per-element tuning, so the
  // intervals heard are the intervals seen.
  //
  // On the lookahead scheduler this project's other two audio scenes use:
  // there is deliberately none here, and that is not a shortcut past a house
  // rule. Outside and Harmonics need it because they GENERATE notes over time,
  // and a per-frame Bernoulli check on requestAnimationFrame stops being a
  // Poisson process the moment the tab is backgrounded and rAF throttles.
  // Apollo has no generative layer at all: it is an instrument and it is
  // silent until it is played, so every note here is a response to a gesture
  // that just happened. There is no window to schedule ahead. The principle
  // the scheduler exists to protect is still followed — every envelope
  // breakpoint below is scheduled against audioCtx.currentTime, the audio
  // hardware's own clock, and nothing about the sound is driven from the
  // render loop.
  let audioCtx = null, muteGain = null, busGain = null, comp = null, verb = null, wetGain = null;
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
    // Twelve sine oscillators at once is a real chance of clipping, and iron
    // is the case it was sized for. The compressor is doing headroom work, not
    // colouring the sound.
    comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.3;
    comp.connect(muteGain);
    busGain = audioCtx.createGain(); busGain.gain.value = 1;
    busGain.connect(comp);
    // A short synthesized room rather than an anechoic click. Modest wet — a
    // long tail would smear the sodium beat, which is the one thing here that
    // has to stay legible.
    verb = audioCtx.createConvolver();
    verb.buffer = makeImpulseResponse(audioCtx, 1.6, 2.6);
    verb.connect(comp);
    wetGain = audioCtx.createGain(); wetGain.gain.value = 0.22;
    wetGain.connect(verb);
  }

  function setSoundEnabled(on) {
    // The same guard Outside and Harmonics carry, for the same bug:
    // bindPersistedSoundToggle leaves a first-gesture listener on the shared
    // #experience-container, which main.js empties but never replaces, so a
    // pointer-down inside a LATER scene used to call straight back into a
    // torn-down one. The helper's dispose() closes that path; this makes a
    // stale call a no-op from any other route as well.
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

  // One note: a sine at the line's own transposed frequency. Sine and not
  // something richer on purpose — harmonics of their own would put energy at
  // frequencies no line in the band corresponds to, and the beat between two
  // close lines is only clean between two pure tones.
  function playLine(nm, rel, voices) {
    if (!audioCtx || !soundEnabled) return;
    const now = audioCtx.currentTime;
    const hz = wavelengthToHz(nm);
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = hz;
    const env = audioCtx.createGain();
    const life = noteLength(voices);
    // Bowed versus plucked, and the only difference in the graph is the attack
    // and the length. Same oscillator, same wavelength-to-frequency division,
    // so a given line is the same pitch in both modes and a visitor learns it
    // once.
    const attack = mode === 'emission' ? 0.006 : 0.05;
    // Amplitude from the line's own relative intensity, divided down by how
    // many voices are sounding together so a fifty-line element and a
    // one-line element arrive at the ear at the same loudness. Without this,
    // iron is simply the loud one, and "iron sounds like noise" would be a
    // claim about the mixer rather than about iron.
    const amp = 0.16 * Math.pow(rel / 1000, 0.5) / Math.sqrt(Math.max(1, voices));
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(amp, now + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + life);
    osc.connect(env);
    env.connect(busGain);
    env.connect(wetGain);
    osc.start(now);
    osc.stop(now + life + 0.2);
  }

  function markStruck(nm, el, voices = 1) {
    struck.push({ nm, el, t: 0, life: noteLength(voices) });
    if (struck.length > 64) struck.shift();
    const x = xForNm(nm);
    disturbAt(x, bandY + bandH * 0.5);
  }

  function srSay(text) { if (srLiveEl) srLiveEl.textContent = text; }

  // ─── The mode switch ──────────────────────────────────────────────────────
  // One control, and it names the SITUATION rather than the display: the light
  // source is either behind the gas or is the gas. Two radios in a fieldset
  // rather than a toggle button, because that is what a two-position choice is
  // and because it lets the legend say what the two positions are choices
  // about. Same reasoning as the rail: use the control that already means this.
  //
  // Fader state is untouched by the switch. Six elements in the light stay six
  // elements in the light, so a mixture built in one mode can be heard in the
  // other — which is most of the point of having both.
  function setMode(next) {
    if (next === mode) return;
    mode = next;
    // The band is rebuilt from the same tau either way (see buildBand), so
    // nothing needs recomputing — only the blend needs to move.
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
      // Pressing an element puts it in the light. Cause and effect, not a mode
      // switch: the lines appear in the band BECAUSE it is now absorbing.
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

  // ─── Chrome and the rail ──────────────────────────────────────────────────
  let titleRowEl = null, hintEl = null, rulerToggleEl = null, railEl = null;
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

  // The switch lives INSIDE the rail, spanning it, rather than floating
  // somewhere near it: it is a control on the instrument, and on a phone there
  // is no spare band of screen between the wavelength scale and the faders to
  // put it in anyway.
  function buildModeSwitch() {
    const fs = document.createElement('fieldset');
    fs.className = 'apollo-mode';
    const legend = document.createElement('legend');
    // Named for the screen reader and not drawn: the two options are legible as
    // a pair, and a label over a two-position switch is a line of type that
    // tells a sighted visitor what they can already see.
    legend.textContent = 'The light source';
    fs.appendChild(legend);
    for (const [value, label] of [['absorption', 'Behind the gas'], ['emission', 'The gas itself']]) {
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
    railEl.appendChild(fs);
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
      // A range input announces its own role and value; what it cannot know is
      // what the value MEANS. Column density is the real quantity, so that is
      // what the label says.
      input.setAttribute('aria-label', `${el.name} in the light — column density`);
      input.addEventListener('input', () => {
        setDensity(el.key, Number(input.value) / 100);
        cell.dataset.active = String(density[el.key] > 0.001);
      });
      // Announced on release rather than on every step, so dragging a fader
      // does not read out a hundred values.
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

  // ─── The keyboard path to an individual line ──────────────────────────────
  // The rail is native controls, so every element is already reachable: Tab to
  // a fader, arrow keys to change how much of it is in the light, Tab to its
  // symbol and Enter to sound it. Nothing there needed a parallel keyboard
  // path invented for it, which is most of why the rail is made of real inputs
  // rather than drawn knobs.
  //
  // The one thing a pointer can do that no control covers is strike a single
  // line inside the band. That is what this is: the same select-and-sound
  // function the click handler calls, over the lines actually in the band
  // right now, rebuilt whenever the active set changes.
  //
  // Capped at 24. With every fader up there are 218 lines, and 218 tab stops
  // is not an accessible path, it is a trap with good intentions. The cap
  // takes the strongest, which are the ones a sighted visitor can see to aim
  // at; the aria-label says the list is a selection and how big it is, so
  // nobody is told they are getting all of them.
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

  // ─── Pointer ──────────────────────────────────────────────────────────────
  // No orbit drag and no raycast in this scene, so no bindTapVsDrag: there is
  // no camera gesture whose trailing click needs filtering. A click on the
  // canvas is always a click on the canvas.
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

  // ─── Loop ─────────────────────────────────────────────────────────────────
  let animId = null;
  let paused = false;
  let reduced = prefersReducedMotion();
  let frames = 0;

  function animate() {
    animId = requestAnimationFrame(animate);
    // Under reduced motion the MOTION clock is resynced rather than ticked, so
    // `elapsed` does not advance and the corona holds still — and so the first
    // frame after the visitor turns reduced motion back off is an ordinary dt
    // rather than one enormous one. The UI clock always ticks: a flash has to
    // be able to end, which is the bug Outside's touch pulse had when its
    // pulse was keyed to a clock that froze.
    let dt = 0;
    if (reduced) clock.resync(); else dt = clock.tick();
    const udt = uiClock.tick();

    // Drift is motion the scene imposes, so it stops under reduced motion. The
    // mode crossfade is a response to something the visitor just did, so it
    // runs on the UI clock and keeps working either way.
    if (dt > 0) advanceFilaments(dt);
    const target = mode === 'emission' ? 1 : 0;
    if (modeMix !== target) {
      const step = udt / MODE_FADE;
      modeMix = target > modeMix ? Math.min(target, modeMix + step) : Math.max(target, modeMix - step);
    }

    for (let i = struck.length - 1; i >= 0; i--) {
      struck[i].t += udt;
      if (struck[i].t >= struck[i].life) struck.splice(i, 1);
    }
    for (let i = disturbances.length - 1; i >= 0; i--) {
      disturbances[i].t += udt;
      if (disturbances[i].t >= DISTURB_LIFE) disturbances.splice(i, 1);
    }

    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, W, H);
    drawCorona();
    drawBand();
    drawStruck();
    drawRuler();
    drawScale();

    // Same power-of-two cadence, and the same reason, as data-blits: from any
    // console, `document.querySelector('#preview-apollo canvas').dataset.frames`
    // distinguishes "never drew" from "drew once and stopped" from "fine".
    frames++;
    if ((frames & (frames - 1)) === 0) canvas.dataset.frames = String(frames);
  }

  // ─── Reduced motion ───────────────────────────────────────────────────────
  // Stills the corona and nothing else. The instrument stays entirely
  // playable: faders move, lines can be struck, notes sound, the flash and the
  // ruler marker still appear — those are responses to something the visitor
  // did, which is the category `prefers-reduced-motion` is not about. What
  // stops is the one thing moving on its own.
  const reducedWatch = onReducedMotionChange(next => {
    reduced = next;
    clock.resync();
  });

  // ─── Resize ───────────────────────────────────────────────────────────────
  const resize = bindGuardedResize(container, () => {
    layout();
    buildContinuum();
    bandDirty = true;
  });

  // ─── Mount ────────────────────────────────────────────────────────────────
  layout();
  buildContinuum();
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
    rulerToggleEl.addEventListener('click', () => {
      rulerOn = !rulerOn;
      rulerToggleEl.setAttribute('aria-pressed', String(rulerOn));
      srSay(rulerOn
        ? 'Pitch ruler shown: the same lines laid out by frequency instead of wavelength.'
        : 'Pitch ruler hidden.');
    });
    container.appendChild(rulerToggleEl);

    canvas.addEventListener('click', onCanvasClick);
    rebuildJumpList();
  }

  // Some engines suspend the AudioContext on backgrounding and expect an
  // explicit resume. Nothing is generating sound here, so there is no
  // scheduler to stop — but a note still ringing when the tab is hidden should
  // stop being audible out of a background tab, the same decision Outside and
  // Harmonics both landed on.
  const onVisibilityChange = () => {
    if (disposed) return;
    if (document.hidden) {
      if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
      return;
    }
    clock.resync(); uiClock.resync();
    if (soundEnabled && audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  // Directly, not scheduled. main.js runs syncPreviewPlayback() the moment
  // initPreviews() resolves and that can setPaused(true), cancelling a queued
  // first callback before it ever runs — which is exactly how Harmonics and
  // Outside shipped tiles that had drawn nothing at all (4.1.1). A new scene is
  // where that would recur, so: call it.
  animate();

  return {
    setPaused(next) {
      if (next === paused) return;
      paused = next;
      if (paused) {
        if (animId !== null) { cancelAnimationFrame(animId); animId = null; }
      } else {
        clock.resync(); uiClock.resync();
        if (animId === null) animate();
      }
    },
    dispose() {
      disposed = true;
      if (animId !== null) cancelAnimationFrame(animId);
      timers.dispose();
      resize.dispose();
      reducedWatch.dispose();
      canvas.removeEventListener('click', onCanvasClick);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      soundToggle.dispose();
      jumpList?.dispose();
      // Close AND null, in that order. The missing null is precisely why
      // Outside's version of the stale-listener bug presented as an
      // unclearable setInterval instead of a stack of orphaned contexts; both
      // dispose paths in this project are the same shape now, and this one is
      // built that way from the start rather than corrected into it.
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
