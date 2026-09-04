import * as THREE from 'three';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion,
  createJumpList, bindTapVsDrag, mountClippedPreviewCanvas, parseHTML,
  claimContainer, manageRenderer, createFrameClock, trackTimers,
  bindPersistedSoundToggle, onReducedMotionChange,
} from '../../utils/sceneKit.js';
import './psyshell.css';
import psyshellHtml from './psyshell.html?raw';
import {
  LIMBS, STEMS, FILAMENTS, FILAMENT_COUNT, TEXTS, BOUNDS, pathDistance,
  baseEDigits, TERMINAL_RADIUS_OUT,
} from './psyshell.text.js';

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
// ─── Why a branch, and what it fixed ────────────────────────────────────────
// The blossom is gone and `psyshell.text.js` carries the full reason. The short
// version is that it converged 3,221 rays on one origin, which is structurally
// why the core clipped white and why the inner two-thirds of every ray was
// lost — a sum taken at a point. Three passes of 4.6.0 went into staggering the
// inner radius, dropping the base emission and steepening the brightness ramp,
// and none of them addressed the cause.
//
// **A branch distributes the origin along an axis, so there is no single place
// where three thousand things sum.** That is the fix; the rest of this file's
// brightness arithmetic follows from it rather than fighting it. See
// FILAMENT_BASE for the number that changed and by how much.
//
// ─── Palette ────────────────────────────────────────────────────────────────
// The void is green because in the source fiction life is the only thing that
// functions in the green, and a psyshell is living apparatus a dead thing
// borrows. Nobody has to explain the pools. It is also the furthest available
// separation from Outside, this site's other flower, which is violet on
// violet-black — see psyshell.css's header for the thumbnail argument.
const VOID_COLOR = 0x06231a;
const CORE_COLOR = 0xffeec4;
// ─── Base emission, re-derived for the branch ──────────────────────────────
// The blossom ended at 0.022 and that number was a symptom: with every ray
// starting at one radius, the centre was the sum of three thousand overlaps and
// the level had to be set by what the pile summed to rather than by what one
// ray wanted. **The branch has no such pile.** Filapixels start at 3,221
// different points along 119 branches, so the worst-case overlap is one
// branch's worth — the largest branch is 382 filapixels (Scroll's longest
// piece) and they are spread along its length rather than stacked at its base.
//
// Re-derived by rendering and measuring peak luminance rather than carried
// over: 0.022 → 0.13, about six times brighter, with the frame's brightest
// pixel below clipping. The measurement is in NOTES 4.7.0.
const FILAMENT_BASE = 0.13;
const FILAMENT_PEAK = 2.1;
const FILAMENT_WHITEN = 0.75;
// The structure is dimmer than what it carries: a branch is the conduit and
// the filapixels are the signal, and inverting that reads as a diagram of a
// tree rather than as something lit from within.
const STEM_LEVEL = 0.30;

// ─── Geometry ───────────────────────────────────────────────────────────────
// Every position, direction, length and radius comes from `psyshell.text.js`,
// which derives them from the corpus by Murray's law and the golden angle.
// Nothing about the form is decided here — this file places what that file
// computed and lights it.
const RAY_CURVE = 0.16;     // filapixels droop along their own length
const RAY_SEGMENTS = 7;
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
// **The distance is the path along the structure**, not a radius and not an
// index gap: up to the parent, out to siblings, down other limbs. That is
// `pathDistance()` in psyshell.text.js, exact in world units, which is why the
// speeds below are world units per second and need no invented weights. It is
// also a better claim than a spherical shell was — a Tessier curve slinging
// forward along an actual path.
//
// The asymmetry is unchanged in principle: the front runs about two and a half
// times further toward later sentences than toward earlier ones.
//
// **The numbers are chosen so that DIGIT_TIME is unchanged.** 0.24 / 4.3 =
// 0.055814s, exactly what SHELL/SPEED gave in the blossom, so the transmission
// decodes to the same digits and the same durations as 4.6.1 and the worked
// example on the /text/ page did not have to be recomputed.
const PROP_SPEED_FWD = 4.3;   // world units per second, toward later sentences
const PROP_SPEED_BACK = 1.75; // and toward earlier ones
const PROP_SHELL = 0.24;      // world units — the half-width of the front
const PROP_REACH = 3.0;       // world units — the e-folding distance
const PROP_LIFE = 3.4;        // seconds
const MAX_DISTURBANCES = 5;

// ─── The transmission ───────────────────────────────────────────────────────
// A struck filament pulses its own ordinal along its length, in base e. See
// psyshell.text.js for why base e and where the radix-economy argument comes
// from; this is how it is rendered.
//
// **The digit rate is the propagation rate, so the transmission and the
// disturbance are the same event rather than two effects that happen
// together.** One digit lasts the time the travelling front takes to cross one
// shell width — PROP_SHELL / PROP_SPEED_FWD, which is 55.8ms. Nothing here is
// hand-tuned to look right; change the propagation and the transmission
// changes with it.
const DIGIT_TIME = PROP_SHELL / PROP_SPEED_FWD; // seconds
// A digit d occupies τ·e^(d−1), so the three durations stand in the ratio
// 1 : e : e² and never land on a grid. The base is both the radix and the time
// base, which is the whole of the mapping — measure a segment, divide by τ,
// take the natural log, add one.
const digitDuration = d => DIGIT_TIME * Math.exp(d - 1);
// Segments alternate lit and dark by place, most significant first, so the
// boundaries ARE the digit boundaries and nothing in the train is filler.
//
// How fast the pattern runs outward along the strand. This one is a legibility
// choice rather than a derivation, and it is stated as one: at this speed a
// digit of average length occupies about a fifth of the ray, so several digits
// of the train are on the strand at once and it reads as something travelling
// rather than as a filament blinking.
const WAVE_SPEED = 0.20 / DIGIT_TIME;  // ray-lengths per second
const MAX_DIGITS = 16;                 // an ordinal of 1350 needs 11
// The transmitting strand has to be the brightest thing on screen or the event
// is invisible: it is one ray among 3,221, drawn additively over a flower whose
// centre already clips to white. Set by rendering a strike into the dense
// middle and into the sparse skirt and finding a value legible in both.
const TRANSMIT_GAIN = 3.2;


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

function buildRayGeometry(curve) {
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
  const drop = x => -curve * x * x;
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
  // ─── Framing: fit the frame, do not bleed off it ──────────────────────────
  // The structure is built in natural units by `psyshell.text.js` and framed
  // here. The camera distance is DERIVED from the bounding sphere that file
  // reports and from the viewport's own aspect at every layout pass — never a
  // constant, which is the 4.4.2 rule, and it has to be per-viewport because
  // 320×568 and 1280×800 differ enough in aspect that one fitted distance
  // cannot serve both.
  //
  // A sphere rather than a box, deliberately: the object turns, so a box fit
  // would be correct at one rotation and bleed at another.
  const FIT_MARGIN = 1.04;
  const center = new THREE.Vector3(...BOUNDS.center);
  let lookOffsetY = 0;
  const target = new THREE.Vector3();
  // ─── The box the chrome leaves ────────────────────────────────────────────
  // Fitting to the whole viewport guarantees a collision, because the title
  // block sits bottom-centre in every scene on this site and the branch is
  // fitted to fill: its base arrived exactly where PSYSHELL is. 4.6.1 solved
  // the blossom's version of this by lifting the object a constant, which was
  // a number tuned at one window.
  //
  // This measures instead. `usableTop` and `usableBottom` are read from the
  // hint and the title's own rendered boxes each layout pass, the height fit
  // uses that band rather than the frame, and the camera aims below the
  // object's centre by exactly the offset that puts the object in the middle
  // of it. Both numbers move with the font, the viewport and the wrap.
  let usableTop = 0, usableBottom = 1;
  let camAz = 0.6, camEl = 0.34, camZoom = 1;
  const CAM_EL_MIN = -0.35, CAM_EL_MAX = 1.30;
  const ZOOM_MIN = 0.55, ZOOM_MAX = 2.4;
  let camDist = 4;
  // ─── Fitting, by projection ───────────────────────────────────────────────
  // Two analytic fits were written before this one and both were wrong in the
  // same way: the quantity that matters is where the object LANDS ON SCREEN,
  // and that depends on the perspective divide and the camera's downward tilt
  // together. Reconstructing it in closed form is reimplementing the renderer,
  // badly — the second attempt put the branch's base 15px inside the title on
  // three viewports while claiming to have centred it.
  //
  // So the object's own points are projected through the actual camera, at
  // eight rotations because the visitor can drag to any of them, and the
  // distance and the aim point are corrected from what comes back. Three
  // passes converge. It runs at layout only.
  const projV = new THREE.Vector3();
  function projectedBox() {
    const saveAz = camAz;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (let k = 0; k < 8; k++) {
      camAz = saveAz + k * Math.PI / 4;
      placeCamera();
      camera.updateMatrixWorld();
      for (const p of BOUNDS.probes) {
        projV.set(p[0], p[1], p[2]).project(camera);
        if (projV.x < minX) minX = projV.x; if (projV.x > maxX) maxX = projV.x;
        if (projV.y < minY) minY = projV.y; if (projV.y > maxY) maxY = projV.y;
      }
    }
    camAz = saveAz;
    placeCamera();
    return { minX, maxX, minY, maxY };
  }

  function fitCamera() {
    const H = Math.max(1, container.clientHeight || window.innerHeight);
    // The band in normalised device coordinates, where +1 is the top.
    const bandTop = 1 - 2 * usableTop / H;
    const bandBot = 1 - 2 * usableBottom / H;
    const wantH = Math.max(0.2, bandTop - bandBot);
    const wantMid = (bandTop + bandBot) / 2;
    const vHalf = (camera.fov * Math.PI / 180) / 2;

    // Reset each fit: the loop is a fixed point, and starting it from the
    // previous viewport's answer is how a converging loop becomes a compounding
    // one — the first version carried camDist across calls and ran away.
    camDist = BOUNDS.radius * 3;
    lookOffsetY = 0;
    camera.updateProjectionMatrix();
    placeCamera();

    // Distance and aim point are solved ALTERNATELY, not together. Corrected
    // in the same loop they fight: changing the distance changes how much
    // world-height an NDC unit is worth, so the recentring is computed against
    // a scale that is about to move, and the pair oscillates. The version that
    // did that settled with the branch 44px above the band at every viewport.
    const sizePass = () => {
      const box = projectedBox();
      if (!isFinite(box.maxY) || box.maxY <= box.minY) return;
      const gotH = Math.max(1e-4, box.maxY - box.minY);
      const gotW = Math.max(1e-4, box.maxX - box.minX);
      camDist *= Math.max(gotH / wantH, gotW / 2.0);
      placeCamera();
    };
    // At a fixed distance the map from aim point to projected centre is very
    // nearly linear, so this converges in a couple of steps without damping.
    const centrePass = () => {
      const box = projectedBox();
      if (!isFinite(box.maxY) || box.maxY <= box.minY) return;
      const err = (box.maxY + box.minY) / 2 - wantMid;
      // PLUS, not minus. The camera is placed relative to the aim point, so
      // lowering the aim lowers the camera with it and the object — which has
      // not moved — appears HIGHER. The sign is the opposite of the one a
      // fixed camera would want, and getting it wrong sent the offset from
      // −2.5 to −13.2 in two rounds with the object off the top of the frame.
      lookOffsetY += err * camDist * Math.tan(vHalf);
      placeCamera();
    };
    for (let round = 0; round < 5; round++) {
      sizePass(); sizePass();
      centrePass(); centrePass();
    }
    camDist = camDist * FIT_MARGIN / camZoom;
    placeCamera();
  }

  function placeCamera() {
    target.set(center.x, center.y + lookOffsetY, center.z);
    camera.position.set(
      target.x + camDist * Math.cos(camEl) * Math.sin(camAz),
      target.y + camDist * Math.sin(camEl),
      target.z + camDist * Math.cos(camEl) * Math.cos(camAz));
    camera.lookAt(target);
  }
  fitCamera();
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

  // ─── The branch ───────────────────────────────────────────────────────────
  const rayGeo = buildRayGeometry(RAY_CURVE);
  // Structural members are straight. A branch that droops like a floret reads
  // as a second layer of filapixels rather than as what carries them.
  const stemGeo = buildRayGeometry(0);
  const filMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    // Additive with depth writing on produces holes: a near filament writes
    // depth and everything behind it stops contributing, which for an object
    // made entirely of overlapping light is the whole effect thrown away.
    depthWrite: false,
    transparent: true,
  });
  const stemMat = new THREE.MeshBasicMaterial({
    vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });

  const filaments = new THREE.InstancedMesh(rayGeo, filMat, FILAMENT_COUNT);
  filaments.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  filaments.frustumCulled = false;
  const stems = new THREE.InstancedMesh(stemGeo, stemMat, STEMS.length);
  stems.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  stems.frustumCulled = false;

  // Per-limb tint. Now that a limb is a region of space rather than an arc of a
  // disc, the bands have somewhere to be legible, so saturation goes up from
  // the blossom's 0.17 — where it was invisible — to 0.24. Still tints on white:
  // the passage says white fibre-optic, and nine saturated regions would be a
  // pie chart wearing a branch.
  const LIMB_SAT = 0.24, LIMB_LIGHT = 0.92;
  const limbColor = LIMBS.map((l, i) =>
    new THREE.Color().setHSL(((i * 137.507) % 360) / 360, LIMB_SAT, LIMB_LIGHT));
  const STEM_COLOR = new THREE.Color(0xbfe8d4);

  // ─── Placing what the data computed ───────────────────────────────────────
  // A member runs from `from` along `dir` for `len`, with `radius` across. The
  // ray geometry's local +X is its length and its local Y/Z are its width, so
  // one compose() per instance does it.
  const dummy = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const vFrom = new THREE.Vector3(), vDir = new THREE.Vector3(), vScale = new THREE.Vector3();
  const X_AXIS = new THREE.Vector3(1, 0, 0);
  function placeMember(mesh, i, fx, fy, fz, dx, dy, dz, len, radius) {
    vFrom.set(fx, fy, fz);
    vDir.set(dx, dy, dz).normalize();
    q.setFromUnitVectors(X_AXIS, vDir);
    vScale.set(len, radius, radius);
    dummy.compose(vFrom, q, vScale);
    mesh.setMatrixAt(i, dummy);
  }

  for (let i = 0; i < FILAMENT_COUNT; i++) {
    const o = i * 3;
    placeMember(filaments, i,
      FILAMENTS.origin[o], FILAMENTS.origin[o + 1], FILAMENTS.origin[o + 2],
      FILAMENTS.dir[o], FILAMENTS.dir[o + 1], FILAMENTS.dir[o + 2],
      FILAMENTS.length[i], TERMINAL_RADIUS_OUT);
  }
  filaments.instanceMatrix.needsUpdate = true;

  for (let i = 0; i < STEMS.length; i++) {
    const s0 = STEMS[i];
    const dx = s0.to[0] - s0.from[0], dy = s0.to[1] - s0.from[1], dz = s0.to[2] - s0.from[2];
    const len = Math.hypot(dx, dy, dz) || 1e-6;
    placeMember(stems, i, s0.from[0], s0.from[1], s0.from[2], dx, dy, dz, len, s0.radius);
    stems.setColorAt(i, STEM_COLOR.clone().multiplyScalar(STEM_LEVEL));
  }
  stems.instanceMatrix.needsUpdate = true;
  stems.instanceColor.needsUpdate = true;

  // Distance from the trunk's base to each filapixel, along the structure. Used
  // by the idle glint, which is the one thing in this scene that could not
  // exist in the blossom: there was no axis for a travelling highlight to run
  // along.
  const pathTotal = new Float32Array(FILAMENT_COUNT);
  let pathMax = 0;
  for (let i = 0; i < FILAMENT_COUNT; i++) {
    pathTotal[i] = FILAMENTS.pathL[i] + FILAMENTS.pathP[i] + FILAMENTS.pathA[i];
    if (pathTotal[i] > pathMax) pathMax = pathTotal[i];
  }

  // ─── The idle ─────────────────────────────────────────────────────────────
  // Apollo's corona drifts and Outside's lotus breathes; this sat still except
  // for a slow turn, which read as a diagram rather than a thing. A glint runs
  // up the structure — base to tip, in path length, the same coordinate the
  // propagation uses — with a pause between passes so it is an event and not a
  // metronome. Stopped under reduced motion along with everything else.
  const GLINT_SPEED = 0.62;   // world units per second
  const GLINT_WIDTH = 0.34;
  const GLINT_AMP = 0.42;
  const GLINT_GAP = 2.4;      // world units of dark between passes
  let glintPos = -GLINT_GAP;

  const activation = new Float32Array(FILAMENT_COUNT);
  const tint = new THREE.Color();
  function writeColors() {
    for (let i = 0; i < FILAMENT_COUNT; i++) {
      const a = activation[i];
      let level = FILAMENT_BASE + (FILAMENT_PEAK - FILAMENT_BASE) * a;
      if (!reduced) {
        const g = (pathTotal[i] - glintPos) / GLINT_WIDTH;
        level += GLINT_AMP * Math.exp(-g * g);
      }
      const base = limbColor[FILAMENTS.limb[i]];
      const wm = FILAMENT_WHITEN * a;
      tint.setRGB(
        (base.r * (1 - wm) + wm) * level,
        (base.g * (1 - wm) + wm) * level,
        (base.b * (1 - wm) + wm) * level);
      filaments.setColorAt(i, tint);
    }
    filaments.instanceColor.needsUpdate = true;
  }

  // One group, so the idle turn moves the object and not the camera.
  const bloom = new THREE.Group();
  scene.add(bloom);
  bloom.add(stems);
  bloom.add(filaments);
  writeColors();

  // ─── Transmitters ─────────────────────────────────────────────────────────
  // One short-lived object per struck filament, drawn over that filament's own
  // ray with the digit train running outward along it. A separate mesh rather
  // than a mode of the main InstancedMesh because instanceColor is one colour
  // per petal and this needs a pattern ALONG the strand — the value at position
  // x at time t is the digit that left the root at t − x/WAVE_SPEED, which is a
  // travelling wave and cannot be expressed as a single per-instance number.
  //
  // At most MAX_DISTURBANCES of these exist, so the cost is five draw calls of
  // 28 triangles. Only the struck filament transmits; its neighbours get the
  // disturbance and no notation, because the sentence belongs to one petal.
  const TRANSMIT_VERT = `
    varying float vX;
    void main() {
      vX = position.x;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  const TRANSMIT_FRAG = `
    uniform float uBounds[${MAX_DIGITS}];
    uniform int uCount;
    uniform float uTime;
    uniform float uSpeed;
    uniform vec3 uColor;
    uniform float uGain;
    varying float vX;
    void main() {
      // Emitted at the root, arriving here later — "amplification around the
      // root, to properly sling it forward" is the whole geometry of this line.
      float tp = uTime - vX / uSpeed;
      float level = 0.0;
      if (tp >= 0.0) {
        for (int i = 0; i < ${MAX_DIGITS}; i++) {
          if (i >= uCount) break;
          if (tp < uBounds[i]) {
            // Segments alternate lit and dark by place. The boundaries are the
            // digit boundaries; there is no separator carrying no information.
            level = mod(float(i), 2.0) < 0.5 ? 1.0 : 0.0;
            break;
          }
        }
      }
      // The strand still reads as a fibre while it transmits: the geometry's
      // own base-to-tip ramp is kept, softened so the near end is not dark.
      float ramp = mix(0.4, 1.0, pow(vX, 1.6));
      gl_FragColor = vec4(uColor * level * ramp * uGain * ${TRANSMIT_GAIN.toFixed(2)}, 1.0);
    }`;

  const transmitters = [];
  for (let i = 0; i < MAX_DISTURBANCES; i++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uBounds: { value: new Float32Array(MAX_DIGITS) },
        uCount: { value: 0 },
        uTime: { value: 0 },
        uSpeed: { value: WAVE_SPEED },
        uColor: { value: new THREE.Color(0xdffff0) },
        uGain: { value: 1.0 },
      },
      vertexShader: TRANSMIT_VERT,
      fragmentShader: TRANSMIT_FRAG,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      // depthTest OFF because a transmitter sits on exactly the same geometry
      // as the petal it overlays: its fragments are coplanar with fragments
      // already in the depth buffer, and a LESS test rejects them.
      //
      // **Said plainly because it would otherwise read as a fix: this was
      // changed while chasing a bug and did not change the measurement.** The
      // train really was running the whole way; the harness watching it had an
      // invalid time axis. The line stays because coplanar additive overlay
      // should not depth-test either way, not because it repaired anything.
      depthTest: false,
      transparent: true,
    });
    const mesh = new THREE.Mesh(rayGeo, mat);
    mesh.renderOrder = 10;
    mesh.frustumCulled = false;
    mesh.visible = false;
    bloom.add(mesh);
    transmitters.push({ mesh, mat, active: false, t: 0, total: 0 });
  }

  // Build the cumulative boundary list for one ordinal and arm a transmitter on
  // the struck petal's own ray.
  const petalMatrix = new THREE.Matrix4();
  function armTransmitter(index) {
    const slot = transmitters.find(t => !t.active) || transmitters[0];
    const ordinal = FILAMENTS.orderInLimb[index] + 1;
    const { digits } = baseEDigits(ordinal);
    const bounds = slot.mat.uniforms.uBounds.value;
    let acc = 0;
    const n = Math.min(digits.length, MAX_DIGITS);
    for (let i = 0; i < n; i++) { acc += digitDuration(digits[i]); bounds[i] = acc; }
    for (let i = n; i < MAX_DIGITS; i++) bounds[i] = acc;
    slot.mat.uniforms.uCount.value = n;
    slot.mat.uniforms.uTime.value = 0;
    slot.mat.uniforms.uColor.value.copy(limbColor[FILAMENTS.limb[index]]);
    // Under reduced motion nothing travels and nothing flashes: the strand
    // simply lights for the length of the train and fades. The object is not
    // stilled — it is still struck, still lit, still its band's colour — but a
    // train of hard-edged flashes IS motion, and a visitor who asked for none
    // should not be given the one thing in the scene that strobes.
    slot.mat.uniforms.uSpeed.value = reduced ? 1e6 : WAVE_SPEED;
    slot.mat.uniforms.uCount.value = reduced ? 1 : n;
    if (reduced) bounds[0] = acc;
    slot.total = acc + (reduced ? 0 : 1 / WAVE_SPEED);
    slot.t = 0;
    slot.active = true;
    // Decomposed rather than copied into `mesh.matrix`. Assigning `.matrix`
    // directly does not set `matrixWorldNeedsUpdate`, so the object keeps
    // whatever world matrix it last had — the transmitter armed, ran its whole
    // train, and drew nothing where the struck petal was. Decomposing leaves
    // matrixAutoUpdate alone and lets the renderer compose it the normal way.
    filaments.getMatrixAt(index, petalMatrix);
    petalMatrix.decompose(slot.mesh.position, slot.mesh.quaternion, slot.mesh.scale);
    slot.mesh.visible = true;
  }

  function advanceTransmitters(dt) {
    for (const s of transmitters) {
      if (!s.active) continue;
      s.t += dt;
      if (s.t >= s.total) { s.active = false; s.mesh.visible = false; continue; }
      s.mat.uniforms.uTime.value = s.t;
      // A gentle fade over the last quarter, so the train ends rather than
      // being cut off mid-strand.
      const left = 1 - s.t / s.total;
      s.mat.uniforms.uGain.value = left > 0.25 ? 1 : left / 0.25;
    }
  }

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
    const lenF = FILAMENTS.length[index];
    // Pitch from the filapixel's own visible property, its length, the same as
    // in 4.6.0 — only the units changed with the form, so the map is rescaled
    // to the branch's own FIL_MIN..FIL_MAX rather than the blossom's fractions.
    const hz = 620 * Math.pow(2, -1.15 * Math.max(0, Math.min(1, (lenF - 0.030) / (0.125 - 0.030))));
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
    armTransmitter(index);
    strike(index);
  }

  function advance(dt) {
    for (let i = disturbances.length - 1; i >= 0; i--) {
      disturbances[i].t += dt;
      if (disturbances[i].t >= PROP_LIFE) disturbances.splice(i, 1);
    }
    activation.fill(0);
    for (const d of disturbances) {
      const decay = 1 - d.t / PROP_LIFE;
      const fade = decay * decay;
      const frontF = PROP_SPEED_FWD * d.t;
      const frontB = PROP_SPEED_BACK * d.t;
      // Every filapixel is visited, which the blossom's index window avoided —
      // and here it has to be, because tree distance is not monotonic in the
      // reading index: the filapixel next to this one in the text may be on
      // another limb entirely. 3,221 distances times at most five disturbances
      // is ~16k path computations a frame, each a handful of array reads.
      for (let i = 0; i < FILAMENT_COUNT; i++) {
        const dist = pathDistance(i, d.origin);
        // Direction is reading order, which is the index order: the front runs
        // further toward later sentences than toward earlier ones.
        const front = reduced ? 0 : (i >= d.origin ? frontF : frontB);
        // Under reduced motion nothing travels: the disturbance is the
        // amplitude envelope alone, applied at once and fading. The object is
        // not stilled — it is still struck, still lit — but a front crossing
        // the screen IS motion, and a visitor who asked for none should not get
        // the one thing here that moves across it.
        const s0 = reduced ? 0 : (dist - front) / PROP_SHELL;
        const shell = reduced ? 1 : Math.exp(-s0 * s0);
        const amp = shell * Math.exp(-dist / PROP_REACH) * fade;
        if (amp > activation[i]) activation[i] = amp;
      }
    }
  }

  // ─── Chrome ───────────────────────────────────────────────────────────────
  let titleEl = null, hintEl = null, ordinalEl = null, jumpList = null, soundToggle = null;

  const srSay = msg => { if (srLiveEl) srLiveEl.textContent = msg; };

  // The ordinal is the one legible thing, and it is the same number the strand
  // is transmitting — so the notation is checkable rather than decorative. The
  // source attribution is deliberately absent: a citation line turns the scene
  // into a database view, and the site's posture is read the writing on its
  // own. The live region keeps all of it, because a visitor who cannot see the
  // pulse must still get the content.
  function showPetal(index) {
    const limb = LIMBS[FILAMENTS.limb[index]];
    const n = FILAMENTS.orderInLimb[index] + 1;
    if (ordinalEl) {
      ordinalEl.hidden = false;
      ordinalEl.textContent = `${n} / ${limb.count}`;
    }
    srSay(`${limb.label}, sentence ${n} of ${limb.count}. ${TEXTS[index]}`);
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let touchGuard = null, orbitDrag = null, wheelZoom = null, resizeCtl = null,
    reducedWatch = null;

  function onClick(ev) {
    if (touchGuard?.consume()) return;
    if (ev.target.closest?.('.pm-jumplist, .psyshell-sound-toggle')) return;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(filaments, false);
    if (!hits.length || hits[0].instanceId === undefined) return;
    const index = hits[0].instanceId;
    disturb(index);
    showPetal(index);
  }

  if (!preview) {
    const frag = parseHTML(psyshellHtml);
    titleEl = frag.querySelector('.psyshell-title');
    hintEl = frag.querySelector('.psyshell-hint');
    ordinalEl = frag.querySelector('.psyshell-ordinal');
    soundToggleEl = frag.querySelector('.psyshell-sound-toggle');
    soundLabelEl = frag.querySelector('.psyshell-sound-label');
    srLiveEl = frag.querySelector('.psyshell-sr-live');
    document.body.append(titleEl, hintEl, ordinalEl, soundToggleEl, srLiveEl);

    soundToggle = bindPersistedSoundToggle(container, soundToggleEl, setSoundEnabled, 'psyshell');

    // The jump list is over LIMBS, not filapixels. Three thousand two hundred
    // and twenty-one buttons is not an accessible alternative to a branch, it is
    // a denial-of-service on a screen reader; nine named scenes is the same
    // structure a sighted visitor actually navigates by.
    jumpList = createJumpList(container, {
      label: 'Limbs of the branch, by scene',
      items: LIMBS,
      getLabel: l => `${l.label} — ${l.count}`,
      onSelect: limb => {
        // Turn the branch so the limb faces the camera, and strike its first
        // filapixel, so selecting a limb does what touching one does.
        camAz = -(limb.azimuth * Math.PI / 180);
        placeCamera();
        let first = 0;
        for (let i = 0; i < FILAMENT_COUNT; i++) {
          if (LIMBS[FILAMENTS.limb[i]].key === limb.key) { first = i; break; }
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
        camZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, camZoom * (1 - dy * 0.0012)));
        fitCamera();
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
  // The ordinal is the one element whose room depends on something else's size:
  // it sits under the hint on narrow viewports, where the two would otherwise
  // share a line. Measured, never assumed — the 4.4.2 lesson, which was two
  // constants taken from a desktop window and never re-derived.
  function relayout() {
    const H = container.clientHeight || window.innerHeight;
    if (preview) { usableTop = 0; usableBottom = H; fitCamera(); placeCamera(); return; }
    // Below the hint, above the title. Both are measured from what they
    // actually rendered as, so a wrapped hint or a larger type scale moves the
    // band rather than being discovered as an overlap later.
    // **In the CONTAINER's coordinates, not the viewport's.** The hint and the
    // title are fixed-position elements and their rects are viewport-relative;
    // the canvas is the container, which starts below the nav — 56px down at
    // every viewport this was measured at. Using one frame's numbers against
    // the other's height put the branch exactly that far low, which read as a
    // centring loop that would not converge. The loop had converged; it was
    // solving the wrong band.
    const rect = container.getBoundingClientRect();
    const hintBox = hintEl ? hintEl.getBoundingClientRect() : null;
    const titleBox = titleEl ? titleEl.getBoundingClientRect() : null;
    usableTop = (hintBox ? hintBox.bottom + 10 : rect.top + 64) - rect.top;
    usableBottom = (titleBox ? titleBox.top - 12 : rect.bottom - 96) - rect.top;
    usableTop = Math.max(0, usableTop);
    usableBottom = Math.min(H, usableBottom);
    if (usableBottom - usableTop < H * 0.3) { usableTop = 0; usableBottom = H; }
    fitCamera();
    placeCamera();

    if (!ordinalEl || !titleEl) return;
    const ordBox = ordinalEl.getBoundingClientRect();
    const tBox = titleEl.getBoundingClientRect();
    const overlaps = ordBox.left < tBox.right + 10 && ordBox.top < tBox.bottom;
    ordinalEl.style.bottom = overlaps ? `${Math.round(window.innerHeight - tBox.top + 10)}px` : '';
  }

  resizeCtl = bindGuardedResize(container, (cw, ch) => {
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();
    // Refit before placing: the aspect just changed, and the fit depends on it.
    fitCamera();
    placeCamera();
    renderer.setSize(cw, ch);
    relayout();
  });

  // ─── Loop ─────────────────────────────────────────────────────────────────
  let animId = null;
  let paused = false;
  // Idle turn. One autonomous motion in the whole scene, deliberately — the
  // flower is a thing on a workbench that revolves, and a second moving
  // element would be decoration. Stopped under reduced motion.
  const IDLE_TURN = 0.055; // radians per second

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
    advanceTransmitters(dt);
    if (!reduced) {
      // The glint runs base to tip and then pauses in the dark before the next
      // pass, so it is an event rather than a metronome.
      glintPos += GLINT_SPEED * dt;
      if (glintPos > pathMax + GLINT_GAP) glintPos = -GLINT_GAP;
    }
    if (disturbances.length) advance(dt);
    // Written every frame now: the idle glint means there is no longer a state
    // in which nothing about the colours changes. 3,221 instances is ~9,700
    // floats a frame, which is the same order as the propagation already was
    // and less than Harmonics' per-frame work.
    writeColors();
    renderer.render(scene, camera);
    previewCanvas?.blit();
  }

  relayout();
  // The band is measured from the title block's rendered box, and the title is
  // set in a web font — so the first measurement happens against the fallback
  // face and the band moves when Arapey arrives. Re-fit then. Without this the
  // branch was fitted to a band that no longer existed by the time anyone saw
  // it, which measured as a constant ~50px of downward drift at every viewport
  // and read as "the centring is broken."
  if (!preview && document.fonts?.ready) {
    document.fonts.ready.then(() => { if (!disposed) relayout(); }).catch(() => {});
  }
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
      titleEl?.remove(); hintEl?.remove(); ordinalEl?.remove();
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
      filMat.dispose();
      // Five ShaderMaterials, one per transmitter slot. They share rayGeo, which
      // is disposed once above rather than five more times.
      for (const t of transmitters) { t.mesh.visible = false; t.mat.dispose(); }
      transmitters.length = 0;
      stemGeo.dispose();
      stemMat.dispose();
      filaments.dispose();
      stems.dispose();
      previewCanvas?.dispose();
      // renderer.dispose() + forceContextLoss() + canvas removal in one call —
      // see manageRenderer for why a plain renderer.dispose() never frees the
      // context.
      managedRenderer.dispose();
      containerClaim?.restore();
    },
  };
}
