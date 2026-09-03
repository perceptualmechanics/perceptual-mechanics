import * as THREE from 'three';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion,
  createJumpList, bindTapVsDrag, mountClippedPreviewCanvas, parseHTML,
  claimContainer, manageRenderer, createFrameClock, trackTimers,
  bindPersistedSoundToggle, onReducedMotionChange,
} from '../../utils/sceneKit.js';
import './psyshell.css';
import psyshellHtml from './psyshell.html?raw';
import { BANDS, PETALS, PETAL_COUNT, TEXTS } from './psyshell.text.js';

// ─── Psyshell — flower magic ────────────────────────────────────────────────
//
//   Iplaisc lifts herself up from the editbay and enters the workshop, punches
//   in the text of Strange Attractors: A Love Affair with Chaos, begins the
//   computation. The middle of the workbench revolves, glows, and a thousand
//   light trails form, taking the shape of a white fiber-optic chrysanthemum,
//   each filapixel a moment in time, demarcated in the code of the Union.
//
//   — Is there any effect you're looking for?  — Tessier curve.  — Hmm. It
//   definitely appears to be capable, although it will need some amplification
//   around the root here to properly sling it forward.
//
// Two things the scene owes that passage: a spatial structure whose every
// element is a temporal index, and a single touch with a structural
// consequence. The first is `psyshell.text.js`, which is where every number
// about the flower's shape is derived and where the three rulers are stated.
// This file is the object and the touch.
//
// ─── Why a chrysanthemum, and why this many ─────────────────────────────────
// Botanically the passage is right: hundreds of narrow ray florets radiating
// from a dense centre is what a chrysanthemum is, and it is what the data
// wants. The count is the one place the fiction and the corpus disagree — the
// passage says a thousand light trails and the corpus has 3,221 sentences, so
// the flower is three times denser than its own description. That is not
// corrected. The corpus decides the count; the passage was written about a
// different text.
//
// The density has a real consequence, stated here because it is the first
// thing anyone will notice: at 3,221 rays the spacing around the rim is 0.11°,
// which at any plausible screen size is under a pixel. A flat ring of them
// would be a disc, not a flower. What separates them is elevation — see
// ELEV_MAX — and additive blending, which lets a dense centre sum to light and
// a sparse rim resolve into individual rays. The flower is legible because the
// long sentences are rare, not because the rays were spaced out.

// ─── Palette ────────────────────────────────────────────────────────────────
// The void is green because in the source fiction life is the only thing that
// functions in the green, and a psyshell is living apparatus a dead thing
// borrows. Nobody has to explain the pools. It is also the furthest available
// separation from Outside, this site's other flower, which is violet on
// violet-black — see psyshell.css's header for the thumbnail argument.
const VOID_COLOR = 0x06231a;
const CORE_COLOR = 0xffeec4;
// Base emission of an untouched ray. This started at 0.34, which is what one
// ray wants and what 3,221 additive rays cannot have: the first render was a
// solid white disc across the middle 40% of the flower with every ray in it
// lost. **3,221 rays all beginning at the same radius means the centre is the
// sum of three thousand overlaps**, so the base has to be set by what the pile
// sums to rather than by what one ray looks like. Rendered and looked at, not
// reasoned about.
const PETAL_BASE = 0.022;
// What a fully activated petal reaches. Above 1 on purpose — additive blending
// clips to white at the tip, which is what a struck fibre should do.
const PETAL_PEAK = 1.9;
// How far an activated petal moves toward white, on top of the brightness.
// Its band's tint survives at rest and is overwhelmed at the strike.
const PETAL_WHITEN = 0.75;

// ─── Geometry ───────────────────────────────────────────────────────────────
// Short sentences stand up, long ones lie over and then droop below the
// horizontal. One number — the sentence's own length — sets how far a ray
// reaches, how far it leans and how much it curves, which is how a real
// chrysanthemum is built: the outer florets are the long ones and they fall
// away under their own length. It is also the only thing that stops 3,221
// coincident rays being a disc.
//
// The exponent is where the elevation range gets SPENT, and the corpus decides
// where it should be. Half these sentences are between 4 and 14 words, so half
// the flower arrives inside a narrow slice of length — and a gentle curve maps
// all of them to nearly the same elevation, which is what produced the second
// render's white cap. A steeper exponent spends the range on the crowded short
// end and compresses the rare long one, which is the right way round: it gives
// elevation to the petals there are thousands of.
//
// The droop is the correction the first render asked for. Elevation ran
// [0°, 74°] — everything tilting UP and nothing below the equator — and the
// result was a shaving brush: a dome with a hard flat underside. A
// chrysanthemum has a skirt. Letting the longest rays go 22° below horizontal
// is what turns the silhouette from a hemisphere into a flower, and it costs
// one constant.
const ELEV_TOP = 76 * Math.PI / 180;
const ELEV_DROOP = -22 * Math.PI / 180;
const ELEV_CURVE = 2.6;
// Ray florets are not needles. Each ray curves downward along its own length —
// baked into the geometry rather than applied per instance, so it is free —
// which is what separates a chrysanthemum from a firework. The first render
// was straight quads and read as an explosion.
const RAY_CURVE = 0.16;
const RAY_SEGMENTS = 7;
// The dense centre the passage describes: every ray starts here rather than at
// the axis, so the middle is a solid glowing pad rather than a point where
// three thousand triangles meet.
const CORE_RADIUS = 0.13;
const OUTER_RADIUS = 1.0;
// Half-width of a ray at its base, in world units, tapering to a needle. Sized
// against the rim spacing rather than picked: at 3,221 petals the rim step is
// about 0.0017 world units, so a base this wide overlaps its neighbours near
// the centre (which is what makes the pad) and separates as it goes out.
const RAY_HALF_WIDTH = 0.0075;
const RAY_TIP_FRACTION = 0.12;

// ─── Propagation ────────────────────────────────────────────────────────────
// "it will need some amplification around the root here to properly sling it
// forward." A touch is a local intervention with a structural consequence: the
// disturbance travels along READING ORDER, to the sentences adjacent in the
// text, then further, falling off with distance.
//
// It is asymmetric, and that is the line about slinging it forward taken
// literally — the front runs about two and a half times further toward later
// sentences than toward earlier ones. It costs nothing and it is the difference
// between a ripple and a direction.
//
// Reading order is GLOBAL, not per-band, so a disturbance that starts near the
// end of Scroll crosses into Theater. The corpus is one sequence; the bands are
// a fact about where its sentences came from, not a wall between them.
const PROP_SPEED_FWD = 430;   // petals per second, toward later sentences
const PROP_SPEED_BACK = 175;  // and toward earlier ones
const PROP_SHELL = 24;        // petals — the half-width of the travelling front
const PROP_REACH = 780;       // petals — the e-folding distance of the amplitude
const PROP_LIFE = 3.4;        // seconds
const MAX_DISTURBANCES = 5;

// ─── Audio ──────────────────────────────────────────────────────────────────
// One soft strike at the touched petal, and nothing else. Outside chimes per
// petal because Outside has seven petals; three thousand chiming is noise, and
// the restraint is more interesting than the alternative.
//
// No lookahead scheduler, and the reason is Apollo's at 4.3.0 rather than an
// oversight: there is no generative layer here, so there is no window to
// schedule ahead — every note is a response to a gesture that just happened.
// The principle the scheduler protects is still kept, in that every envelope
// breakpoint below is scheduled against audioCtx.currentTime and nothing about
// the sound is driven from the render loop. **This is a fact with an expiry
// date**: the moment anything in this scene sounds without being touched, it
// needs the scheduler, exactly as Apollo's statement stopped being true at
// 4.5.0.
const STRIKE_LIFE = 1.25;
const STRIKE_GAIN = 0.16;

function buildRayGeometry() {
  // Two perpendicular strips rather than one, so a ray catches the eye from any
  // camera angle instead of vanishing when it turns edge-on — it removes a
  // whole class of "half the flower disappeared when I dragged" that a single
  // quad has. Segmented along its length so the curve is a curve and not a
  // bent stick. 28 triangles a petal, ~90,000 in the flower, one draw call.
  const pos = [], col = [], idx = [];
  const N = RAY_SEGMENTS;
  // Local space: the ray runs along +X from 0 to 1, curving down in Y as it
  // goes, and is scaled to its real length by the instance matrix.
  const halfW = x => 1 - (1 - RAY_TIP_FRACTION) * x;
  const drop = x => -RAY_CURVE * x * x;
  // The brightness ramp is the fix for the blown-out centre as much as the
  // base level is. A linear ramp still puts real light at the base, and the
  // base is where three thousand rays overlap; a steep power keeps almost all
  // of a ray's light in its outer third, which is where it has the sky to
  // itself. It is also what a fibre does.
  const bright = x => Math.pow(x, 2.2);
  const strip = axis => {
    for (let i = 0; i <= N; i++) {
      const x = i / N, w = halfW(x), y = drop(x), b = bright(x);
      if (axis === 0) { pos.push(x, y, -w, x, y, w); } else { pos.push(x, y - w, 0, x, y + w, 0); }
      col.push(b, b, b, b, b, b);
      if (i > 0) {
        const o = (pos.length / 3) - 4;
        idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      }
    }
  };
  strip(0);
  strip(1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

export function createPsyshell(container, { preview = false } = {}) {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(VOID_COLOR);

  const camera = new THREE.PerspectiveCamera(42, w / h, 0.05, 40);
  // Spherical camera state. The default elevation looks down on the flower at
  // about 34°, which is the angle at which a chrysanthemum reads as a radial
  // burst rather than as a dome or a disc — checked by rendering, not chosen.
  let camAz = 0.6, camEl = 0.60, camDist = preview ? 3.05 : 2.9;
  const CAM_EL_MIN = 0.08, CAM_EL_MAX = 1.45;
  const CAM_DIST_MIN = 1.5, CAM_DIST_MAX = 6.5;
  // The flower's visual centre is not the origin. Its mass sits above the
  // seedpod — the dome is 76° of elevation and the skirt only 22° — so aiming
  // at 0,0,0 puts the object high in frame and, inside a preview tile's
  // circular crop, cuts the skirt off at the bottom edge. Both numbers below
  // came from cropping the tile and looking at it, which is the only way this
  // kind of error shows up: at full screen it reads as framing, and only the
  // 200px circle makes it a clipped subject.
  const LOOK_Y = preview ? 0.13 : 0.08;
  function placeCamera() {
    camera.position.set(
      camDist * Math.cos(camEl) * Math.sin(camAz),
      LOOK_Y + camDist * Math.sin(camEl),
      camDist * Math.cos(camEl) * Math.cos(camAz));
    camera.lookAt(0, LOOK_Y, 0);
  }
  placeCamera();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  const managedRenderer = manageRenderer(renderer);
  renderer.setSize(w, h);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';

  // A preview tile renders off-DOM and is blitted through a circular clip;
  // the full scene mounts its canvas directly. Same split every other WebGL
  // scene here uses.
  const previewCanvas = preview ? mountClippedPreviewCanvas(container, renderer) : null;
  if (!preview) container.appendChild(renderer.domElement);

  const containerClaim = !preview ? claimContainer(container, { cursor: 'crosshair' }) : null;
  const timers = trackTimers();
  const clock = createFrameClock();
  let reduced = prefersReducedMotion();

  // ─── The flower ───────────────────────────────────────────────────────────
  const rayGeo = buildRayGeometry();
  const rayMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    // Additive with depth writing on produces holes: a near ray writes depth
    // and the rays behind it stop contributing, which for an object made
    // entirely of overlapping light is the whole effect thrown away.
    depthWrite: false,
    transparent: true,
  });
  const flower = new THREE.InstancedMesh(rayGeo, rayMat, PETAL_COUNT);
  flower.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  flower.frustumCulled = false;

  // Per-band tint, computed once. HSL at low saturation: these are tints on
  // white, not colours — see psyshell.text.js's BAND_SAT for why.
  const bandColor = BANDS.map(b => new THREE.Color().setHSL(b.hue / 360, b.sat, b.light));

  const dummy = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const scl = new THREE.Vector3();
  const pos0 = new THREE.Vector3();

  // Static transforms, written once. Length and elevation both come from the
  // sentence's own word count (see the geometry note above); azimuth is its
  // place in reading order.
  const elevation = new Float32Array(PETAL_COUNT);
  for (let i = 0; i < PETAL_COUNT; i++) {
    const lenF = PETALS.length[i];
    const t = Math.max(0, Math.min(1, (lenF - 0.36) / (1 - 0.36)));
    const el = ELEV_DROOP + (ELEV_TOP - ELEV_DROOP) * Math.pow(1 - t, ELEV_CURVE);
    elevation[i] = el;
    const az = PETALS.angle[i];
    const reach = CORE_RADIUS + lenF * (OUTER_RADIUS - CORE_RADIUS);
    scl.set(reach, RAY_HALF_WIDTH, RAY_HALF_WIDTH);
    e.set(0, az, el, 'YZX');
    q.setFromEuler(e);
    pos0.set(0, 0, 0);
    dummy.compose(pos0, q, scl);
    flower.setMatrixAt(i, dummy);
  }
  flower.instanceMatrix.needsUpdate = true;

  // Activation, one float per petal, written by the propagation and read by
  // the instance colour buffer. A plain array touched by the CPU — no GPGPU
  // ping-pong, no WebGPU: 3,221 petals at 144fps is under half a million
  // operations a second, and Harmonics already integrates 76 coupled
  // oscillators on the CPU without trouble. WebGPU is genuinely available now
  // and is a real option for a later scene; what would change the answer here
  // is a petal count above ~50,000 or neighbour coupling in more than one
  // dimension, and neither applies.
  const activation = new Float32Array(PETAL_COUNT);
  const tint = new THREE.Color();
  function writeColors() {
    for (let i = 0; i < PETAL_COUNT; i++) {
      const a = activation[i];
      const base = bandColor[PETALS.band[i]];
      const level = PETAL_BASE + (PETAL_PEAK - PETAL_BASE) * a;
      const wm = PETAL_WHITEN * a;
      tint.setRGB(
        (base.r * (1 - wm) + wm) * level,
        (base.g * (1 - wm) + wm) * level,
        (base.b * (1 - wm) + wm) * level);
      flower.setColorAt(i, tint);
    }
    flower.instanceColor.needsUpdate = true;
  }
  writeColors();
  scene.add(flower);

  // The dense centre. Small, warm and NOT white — the one place in the flower
  // that is not the corpus, so it is the one place with its own colour.
  const coreGeo = new THREE.SphereGeometry(CORE_RADIUS * 0.62, 20, 14);
  const coreMat = new THREE.MeshBasicMaterial({
    // Dim, because it is adding on top of three thousand ray bases. At 0.55 it
    // was part of what made the first render's white hole rather than a warm
    // seedpod inside a flower.
    color: CORE_COLOR, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.16,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  scene.add(core);

  // ─── Sound ────────────────────────────────────────────────────────────────
  let audioCtx = null, muteGain = null, busGain = null;
  let soundEnabled = false;
  let soundToggleEl = null, soundLabelEl = null, srLiveEl = null;
  let disposed = false;

  function buildAudioGraph() {
    if (disposed || audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    muteGain = audioCtx.createGain();
    muteGain.gain.value = 0;
    muteGain.connect(audioCtx.destination);
    busGain = audioCtx.createGain();
    busGain.gain.value = 1;
    busGain.connect(muteGain);
  }

  function setSoundEnabled(on) {
    // The guard every scene with a persisted toggle carries:
    // bindPersistedSoundToggle leaves a first-gesture listener on the shared
    // #experience-container, which main.js empties but never replaces, so a
    // pointer-down inside a LATER scene can call back into a torn-down one.
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
      if (soundLabelEl) soundLabelEl.textContent = on ? 'Sound on' : 'Sound off';
    }
  }

  // Pitch comes from the petal's own visible property — its length. A short
  // sentence is a short high ping and a long one is lower, so what you hear
  // and what you see are the same fact rather than two decorations of it. The
  // range is a little over an octave, which is as much as one soft strike can
  // carry without becoming a scale.
  function strike(index) {
    if (!audioCtx || !soundEnabled) return;
    const now = audioCtx.currentTime;
    const lenF = PETALS.length[index];
    const hz = 620 * Math.pow(2, -1.15 * (lenF - 0.36) / (1 - 0.36));
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = hz;
    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(STRIKE_GAIN, now + 0.006);
    env.gain.exponentialRampToValueAtTime(STRIKE_GAIN * 0.2, now + 0.09);
    env.gain.exponentialRampToValueAtTime(0.0001, now + STRIKE_LIFE);
    osc.connect(env);
    env.connect(busGain);
    osc.start(now);
    osc.stop(now + STRIKE_LIFE + 0.1);
  }

  // ─── The touch ────────────────────────────────────────────────────────────
  const disturbances = [];
  function disturb(index) {
    disturbances.push({ origin: index, t: 0 });
    if (disturbances.length > MAX_DISTURBANCES) disturbances.shift();
    strike(index);
  }

  function advance(dt) {
    for (let i = disturbances.length - 1; i >= 0; i--) {
      disturbances[i].t += dt;
      if (disturbances[i].t >= PROP_LIFE) disturbances.splice(i, 1);
    }
    activation.fill(0);
    for (const d of disturbances) {
      // Under reduced motion the front does not travel: the disturbance is the
      // amplitude envelope alone, applied at once and fading. The object keeps
      // its shape, the touch keeps its structural consequence, and nothing
      // moves across the screen. That is what "still the propagation without
      // stilling the object" has to mean for a scene whose whole subject is
      // propagation.
      const decay = 1 - d.t / PROP_LIFE;
      const fade = decay * decay;
      if (reduced) {
        const lo = Math.max(0, d.origin - PROP_REACH * 1.2);
        const hi = Math.min(PETAL_COUNT - 1, d.origin + PROP_REACH * 1.2);
        for (let i = lo; i <= hi; i++) {
          const dist = Math.abs(i - d.origin);
          const amp = Math.exp(-dist / PROP_REACH) * fade;
          if (amp > activation[i]) activation[i] = amp;
        }
        continue;
      }
      const frontF = PROP_SPEED_FWD * d.t;
      const frontB = PROP_SPEED_BACK * d.t;
      // Only the shell is touched, not the whole array — the same "an
      // expanding ring, not a global brightness change" the corona's
      // disturbance in Apollo 4.4.0 had to be corrected into.
      const loB = Math.max(0, Math.floor(d.origin - frontB - 3 * PROP_SHELL));
      const hiB = Math.min(PETAL_COUNT - 1, Math.ceil(d.origin - frontB + 3 * PROP_SHELL));
      const loF = Math.max(0, Math.floor(d.origin + frontF - 3 * PROP_SHELL));
      const hiF = Math.min(PETAL_COUNT - 1, Math.ceil(d.origin + frontF + 3 * PROP_SHELL));
      const apply = (lo, hi, front) => {
        for (let i = lo; i <= hi; i++) {
          const dist = Math.abs(i - d.origin);
          const s = (dist - front) / PROP_SHELL;
          const amp = Math.exp(-s * s) * Math.exp(-dist / PROP_REACH) * fade;
          if (amp > activation[i]) activation[i] = amp;
        }
      };
      apply(loB, hiB, frontB);
      apply(loF, hiF, frontF);
    }
  }

  // ─── Chrome ───────────────────────────────────────────────────────────────
  let titleEl = null, hintEl = null, readoutEl = null, readoutTextEl = null,
    readoutSourceEl = null, jumpList = null, soundToggle = null;

  const srSay = msg => { if (srLiveEl) srLiveEl.textContent = msg; };

  function showPetal(index) {
    const band = BANDS[PETALS.band[index]];
    if (readoutEl) {
      readoutEl.hidden = false;
      readoutTextEl.textContent = TEXTS[index];
      readoutSourceEl.textContent =
        `${band.label} · sentence ${PETALS.orderInBand[index] + 1} of ${band.count}`;
    }
    srSay(`${band.label}, sentence ${PETALS.orderInBand[index] + 1} of ${band.count}. ${TEXTS[index]}`);
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let touchGuard = null, orbitDrag = null, wheelZoom = null, resizeCtl = null,
    reducedWatch = null;

  function onClick(ev) {
    if (touchGuard?.consume()) return;
    if (ev.target.closest?.('.pm-jumplist, .psyshell-sound-toggle, .psyshell-readout')) return;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(flower, false);
    if (!hits.length || hits[0].instanceId === undefined) return;
    const index = hits[0].instanceId;
    disturb(index);
    showPetal(index);
  }

  if (!preview) {
    const frag = parseHTML(psyshellHtml);
    titleEl = frag.querySelector('.psyshell-title');
    hintEl = frag.querySelector('.psyshell-hint');
    readoutEl = frag.querySelector('.psyshell-readout');
    readoutTextEl = frag.querySelector('.psyshell-readout-text');
    readoutSourceEl = frag.querySelector('.psyshell-readout-source');
    soundToggleEl = frag.querySelector('.psyshell-sound-toggle');
    soundLabelEl = frag.querySelector('.psyshell-sound-label');
    srLiveEl = frag.querySelector('.psyshell-sr-live');
    document.body.append(titleEl, hintEl, readoutEl, soundToggleEl, srLiveEl);

    soundToggle = bindPersistedSoundToggle(container, soundToggleEl, setSoundEnabled, 'psyshell');

    // The jump list is over BANDS, not petals. Three thousand two hundred and
    // twenty-one buttons is not an accessible alternative to a flower, it is a
    // denial-of-service on a screen reader; nine named scenes is the same
    // structure a sighted visitor actually navigates by.
    jumpList = createJumpList(container, {
      label: 'Bands of the flower, by scene',
      items: BANDS,
      getLabel: b => `${b.label} — ${b.count}`,
      onSelect: band => {
        // Turn the flower so the band faces the camera, and strike its first
        // sentence, so selecting a band does the same thing touching one does.
        const mid = (band.startDeg + band.arcDeg / 2) * Math.PI / 180;
        camAz = -mid;
        placeCamera();
        let first = 0;
        for (let i = 0; i < PETAL_COUNT; i++) {
          if (BANDS[PETALS.band[i]].key === band.key) { first = i; break; }
        }
        disturb(first);
        showPetal(first);
      },
    });

    touchGuard = bindTapVsDrag(container);
    orbitDrag = bindOrbitDrag(container, {
      onDrag: (dx, dy) => {
        camAz -= dx;
        camEl = Math.max(CAM_EL_MIN, Math.min(CAM_EL_MAX, camEl + dy));
        placeCamera();
      },
    });
    wheelZoom = bindWheelZoom(container, {
      onZoom: dy => {
        camDist = Math.max(CAM_DIST_MIN, Math.min(CAM_DIST_MAX, camDist * (1 + dy * 0.0012)));
        placeCamera();
      },
    });
    container.addEventListener('click', onClick);

    reducedWatch = onReducedMotionChange(next => {
      reduced = next;
      clock.resync();
    });
  }

  // ─── Layout ───────────────────────────────────────────────────────────────
  // The readout is the one element whose room depends on something else's
  // size: it sits under the hint, and the hint's height is whatever the font
  // and the viewport make it. Measured, never assumed — the 4.4.2 lesson,
  // which was two constants taken from a desktop window and never re-derived.
  function relayout() {
    if (preview || !readoutEl || !hintEl) return;
    const hintBox = hintEl.getBoundingClientRect();
    const top = Math.max(hintBox.bottom + 12, 64);
    readoutEl.style.top = `${Math.round(top)}px`;
    // And what is left below it, so a long sentence scrolls inside the box
    // rather than running under the title block.
    const titleBox = titleEl ? titleEl.getBoundingClientRect() : null;
    const floor = titleBox ? titleBox.top - 16 : window.innerHeight - 96;
    readoutEl.style.maxHeight = `${Math.max(120, Math.round(floor - top))}px`;
  }

  resizeCtl = bindGuardedResize(container, (cw, ch) => {
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();
    renderer.setSize(cw, ch);
    relayout();
  });

  // ─── Loop ─────────────────────────────────────────────────────────────────
  let animId = null;
  let paused = false;
  // Idle turn. One autonomous motion in the whole scene, deliberately — the
  // flower is a thing on a workbench that revolves, and a second moving
  // element would be decoration. Stopped under reduced motion.
  const IDLE_TURN = 0.045; // radians per second
  let dirty = true;

  function animate() {
    animId = requestAnimationFrame(animate);
    const dt = clock.tick();
    if (!reduced && !preview) {
      // Only when nothing is being dragged would be a second state to track;
      // the turn is slow enough that it reads as the object rather than as the
      // camera fighting the drag.
      camAz += IDLE_TURN * dt;
      placeCamera();
    } else if (preview && !reduced) {
      camAz += IDLE_TURN * 1.6 * dt;
      placeCamera();
    }
    if (disturbances.length) {
      advance(dt);
      writeColors();
      dirty = true;
    } else if (dirty) {
      // One last write to clear the final frame's activation, then stop
      // uploading 9,663 floats a frame to say nothing changed.
      activation.fill(0);
      writeColors();
      dirty = false;
    }
    renderer.render(scene, camera);
    previewCanvas?.blit();
  }

  relayout();
  // Directly, not scheduled. main.js runs syncPreviewPlayback() the moment
  // initPreviews() resolves and that can setPaused(true), cancelling a queued
  // first callback before it ever runs — which is exactly how Harmonics and
  // Outside shipped tiles that had drawn nothing at all (4.1.1). A new scene is
  // where that would recur, so: call it.
  animate();

  return {
    setPaused(next) {
      const want = Boolean(next);
      if (want === paused) return;
      paused = want;
      if (paused) {
        if (animId !== null) { cancelAnimationFrame(animId); animId = null; }
      } else {
        clock.resync();
        if (animId === null) animate();
      }
    },
    dispose() {
      disposed = true;
      if (animId !== null) cancelAnimationFrame(animId);
      disturbances.length = 0;
      timers.dispose();
      resizeCtl?.dispose();
      orbitDrag?.dispose();
      wheelZoom?.dispose();
      touchGuard?.dispose();
      reducedWatch?.dispose();
      soundToggle?.dispose();
      jumpList?.dispose();
      if (!preview) container.removeEventListener('click', onClick);
      titleEl?.remove(); hintEl?.remove(); readoutEl?.remove();
      soundToggleEl?.remove(); srLiveEl?.remove();
      // Close AND null, in that order. The missing null is why Outside's
      // version of the stale-listener bug presented as an unclearable
      // setInterval instead of a stack of orphaned contexts; every dispose
      // path in this project is the same shape now, and this one is built that
      // way from the start rather than corrected into it.
      if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
      muteGain = busGain = null;
      soundEnabled = false;
      rayGeo.dispose();
      rayMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      flower.dispose();
      previewCanvas?.dispose();
      // renderer.dispose() + forceContextLoss() + canvas removal in one call —
      // see manageRenderer for why a plain renderer.dispose() never frees the
      // context.
      managedRenderer.dispose();
      containerClaim?.restore();
    },
  };
}
