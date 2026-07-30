import * as THREE from 'three';
import { prefersReducedMotion, mountClippedPreviewCanvas, bindGuardedResize } from '../utils/sceneKit.js';
// The text lives in src/text/ now (2026-07-29) — the prerender step that
// builds /text/leaf/ imports the same module, so the published piece and the
// staged one are guaranteed to be the same words.
import { TEXT_STAGES } from '../text/leafText.js';

// ─── Leaf: In The End It Falls Slowly Through The Aether ──────────────────────
// A found piece (Cartography.doc, archive/Writing archive, author: Scott
// Cohen) — a single raindrop's entire life, told through real physics:
// surface tension holding it to a leaf, freefall, friction peeling a few
// molecules away as escaped vapor, impact, and the ones that got free
// drifting off on the wind while the rest are "absorbed by root or burnt by
// sun to climb upwards and start the whole sorry process downward." One
// continuous piece touching water, air, earth, and wood — see NOTES.md.
// The scene stages that literally: a small quiet vignette, not an
// explorable space — a leaf, a drop, a slow loop, the text arriving in the
// same order it was written, timed to the phase of the fall it describes.

// Each stage's real on-screen scroll extent (and so the fall-phase
// boundaries derived from it in computePhaseFractions, further down) comes
// from its own rendered paragraph height at runtime, not a hand-tuned
// weight here — a `w` field used to sit on each of these, presumably meant
// to drive that boundary math at some earlier point in this scene's
// history, but nothing ever actually read it once the fall switched over
// to being driven by real native scroll position; removed as dead weight,
// literally.

const CYCLE_SECONDS = 34; // preview tiles only now — see createLeaf's preview branch

// ─── Release physics: a real threshold, not a scroll cutoff ────────────────
// 1.8.0 — the piece is about gravity's inevitability, and nothing in the
// mechanism said so: the drop used to switch from "held" to "falling" the
// instant scroll crossed a fraction read off a paragraph's real position —
// an animator's endpoint with a physics-flavored comment attached, not an
// actual force anywhere. Two real forces now compete for the drop, in the
// exact two shapes the brief specifies: gravity's pull scales with how much
// water has coalesced (volume, ~r^3), while surface tension's grip at the
// leaf-tip neck scales with the neck's circumference (~r) — a wider neck
// isn't proportionally stronger the way a bigger drop is proportionally
// heavier. Given F_gravity(r) = K_GRAVITY*r^3 and F_tension(r) = K_TENSION*r,
// solving F_gravity(r) = F_tension(r) for r gives the radius where the two
// exactly balance:
//   K_GRAVITY*r^3 = K_TENSION*r  =>  K_GRAVITY*r^2 = K_TENSION
//   r = sqrt(K_TENSION / K_GRAVITY)
// The brief's own note states this inverted (sqrt(K_GRAVITY/K_TENSION)) —
// algebraically inconsistent with the r^3-vs-r scaling it itself specifies.
// Implemented the consistent form rather than silently matching the stated
// formula; flagging the correction here rather than making it quietly.
//
// K_GRAVITY and K_TENSION are equal (1 and 1) on purpose, not as a
// placeholder: with equal intrinsic strength, tension still wins for every
// r<1 (r^3<r there) purely because volume's cubic growth trails the neck's
// linear growth at small radii — gravity isn't winning because it's
// stronger, it's winning because cubic must eventually overtake linear,
// unconditionally. That's the real content of "we don't even notice":
// nothing tips the balance at the last second, the outcome was decided by
// the shape of the two curves from the start. Same "real formula, tuned
// free constant" precedent as Orbiter's a0.
const K_GRAVITY = 1;
const K_TENSION = 1;
const R_CRITICAL = Math.sqrt(K_TENSION / K_GRAVITY); // = 1, by the algebra above

// GROWTH_CEILING sits above R_CRITICAL (1.15, not 1.0) so the threshold
// genuinely interrupts the growth curve partway through, rather than
// coinciding exactly with its own endpoint — otherwise "the physics decides"
// and "the curve just ends" would be indistinguishable. GROWTH_EXP=3 biases
// growth toward the LATE part of the hold phase: r^3 stays small for most of
// holdT's range, so the drop reads as genuinely still for most of the hold
// phase (point 2's ask), with the one visible swell concentrated in the
// final stretch — matching the text's own "for that brief instant ...
// feeling the onward surge ... until there's no more time," which describes
// a late, brief thing, not a gradual one.
const GROWTH_CEILING = 1.15;
const GROWTH_EXP = 3;
// Where release actually falls within the nominal hold window: solving
// GROWTH_CEILING * holdT^GROWTH_EXP = R_CRITICAL for holdT. ~0.954 — release
// arrives in the last ~5% of the hold window, not at its exact edge.
const RELEASE_HOLD_T = Math.pow(R_CRITICAL / GROWTH_CEILING, 1 / GROWTH_EXP);

function dropRadius(holdT) { return GROWTH_CEILING * Math.pow(Math.max(0, holdT), GROWTH_EXP); }
function gravityForce(r) { return K_GRAVITY * r * r * r; }
function tensionForce(r) { return K_TENSION * r; }

// ─── Fall pacing: a hard cut, not an eased ramp ─────────────────────────────
// The old freefall used easeInQuad (x*x) — derivative exactly zero at x=0,
// meaning the drop's first instants of motion were nearly imperceptible
// before speeding up. That's the opposite of "abrupt... without warning."
// FALL_KICK is the fraction of the fall's total distance covered at constant
// velocity from the very first instant, so the drop is already moving at a
// real pace the frame release fires; the remaining (1-FALL_KICK) still
// accelerates quadratically underneath it, so the fall keeps visibly
// speeding up toward impact (real gravity, and the text's own mid-fall
// intensity) — it just doesn't ALSO ease in at the start.
const FALL_KICK = 0.4;
function fallCurve(t) { return FALL_KICK * t + (1 - FALL_KICK) * t * t; }

// ─── Leaf recoil: a snap, then a real ring-down ─────────────────────────────
// cos(), not sin() — the deflection is at its full amplitude in the very
// first instant after release (cos(0)=1), not ramping up to it the way the
// old Math.sin(fallFrac*6) shape did (sin(0)=0, same "eases in" problem as
// the fall itself had). Decays like a real branch settling, tracked on its
// own elapsed-real-seconds clock rather than scroll fraction — a branch's
// springiness doesn't care how fast or slow someone is reading.
const RECOIL_AMPLITUDE = 0.07;
const RECOIL_FREQ = 18;  // rad/sec
const RECOIL_DECAY = 5;  // 1/sec
function recoilAngle(elapsedSec) {
  return RECOIL_AMPLITUDE * Math.exp(-RECOIL_DECAY * elapsedSec) * Math.cos(RECOIL_FREQ * elapsedSec);
}

// ─── Sympathetic ambient motion ─────────────────────────────────────────────
// Gravity's pull as a standing condition of the whole scene, not just the
// one moment the drop falls. Applied to the two "living, wind-responsive"
// backdrop layers only (palms/lot, foreground foliage) — the rail, buildings
// and garage are rigid/architectural and stay perfectly still on purpose,
// the same distinction a real gust of wind would make. Each layer's own
// frequency/phase pair is picked to sit clear of the others already moving
// in this scene (the root group's own pre-existing 0.05Hz drift, and each
// other) — never a shared clock, so nothing ever reads as reacting to
// anything else. Driven by tSec alone, never by fall/release state:
// reacting to the drop's own release would turn atmosphere into a sound
// effect, which is exactly what the brief warns against. Amplitudes are a
// few thousandths of a world unit against a ~6.4-unit-tall visible frame —
// if in doubt, this rounds down rather than up, per the brief's own
// guardrail: isolate one layer and watch it for several seconds to see it
// at all; a normal, unfocused glance shouldn't register it.
function ambientSway(tSec, freqX, freqY, phase, amp) {
  return {
    x: Math.sin(tSec * freqX + phase) * amp,
    y: Math.cos(tSec * freqY + phase * 1.3) * amp * 0.6,
  };
}

function makeDropletTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const cx = c.getContext('2d');
  const grad = cx.createRadialGradient(24, 20, 1, 32, 32, 30);
  grad.addColorStop(0,    'rgba(230,248,255,0.95)');
  grad.addColorStop(0.4,  'rgba(140,210,240,0.85)');
  grad.addColorStop(1,    'rgba(60,120,160,0)');
  cx.fillStyle = grad;
  cx.beginPath();
  cx.arc(32, 32, 30, 0, Math.PI * 2);
  cx.fill();
  return new THREE.CanvasTexture(c);
}

function makeMoteTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const cx = c.getContext('2d');
  const grad = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(210,240,255,0.9)');
  grad.addColorStop(1, 'rgba(210,240,255,0)');
  cx.fillStyle = grad;
  cx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

// A canvas texture standing in for the leaf's surface — mottled, uneven
// color rather than a flat fill, a browned/spotted patch near one edge,
// and an overall soft grain, in service of a deliberately wabi-sabi
// object: nothing about a real leaf is a clean, uniform, symmetric shape,
// and it shouldn't read as one here either.
function makeLeafTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const cx = c.getContext('2d');
  // Design pass, 2026-07-29 — Scott: leaf color read cooler/flatter than
  // Sphere/Butterfly. Doesn't need to match them, just needs to feel
  // intentional — richer, slightly more saturated green at each of the
  // same three tonal stops, not a hue change or a brighter overall value
  // (still a real, weathered leaf, not a cartoon one).
  const grad = cx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0,   '#4a7248');
  grad.addColorStop(0.5, '#3a5c38');
  grad.addColorStop(1,   '#2c4a2a');
  cx.fillStyle = grad;
  cx.fillRect(0, 0, 256, 256);

  // Mottling — uneven patches of lighter/darker green, not a flat color.
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const r = 10 + Math.random() * 26;
    const light = Math.random() > 0.5;
    cx.fillStyle = light ? 'rgba(150,170,110,0.1)' : 'rgba(20,34,20,0.14)';
    cx.beginPath();
    cx.ellipse(x, y, r, r * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
    cx.fill();
  }

  // A patch of autumnal browning near one edge — imperfection, not disease.
  const bx = 190, by = 70;
  const brownGrad = cx.createRadialGradient(bx, by, 2, bx, by, 60);
  brownGrad.addColorStop(0, 'rgba(150,96,40,0.55)');
  brownGrad.addColorStop(0.6, 'rgba(130,84,36,0.3)');
  brownGrad.addColorStop(1, 'rgba(130,84,36,0)');
  cx.fillStyle = brownGrad;
  cx.beginPath();
  cx.ellipse(bx, by, 60, 44, 0.4, 0, Math.PI * 2);
  cx.fill();

  // A couple of small dark spots — insect marks, weathering.
  [[70, 150, 5], [95, 175, 3.5], [40, 190, 4]].forEach(([sx, sy, sr]) => {
    cx.fillStyle = 'rgba(30,26,14,0.45)';
    cx.beginPath();
    cx.ellipse(sx, sy, sr, sr * 0.8, 0, 0, Math.PI * 2);
    cx.fill();
  });

  // Fine overall grain.
  cx.globalAlpha = 0.5;
  for (let i = 0; i < 900; i++) {
    cx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
    cx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  cx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function buildLeaf() {
  // A single leaf silhouette, tip aimed down — where the drop gathers —
  // deliberately asymmetric (real leaf lobes never match side to side)
  // with one small edge tear, rather than the mirror-symmetric shape this
  // had before.
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.15);
  shape.bezierCurveTo(0.58, 0.98, 0.8, 0.3, 0.56, -0.4);
  // A small torn notch on the right edge, not a smooth curve straight through.
  shape.bezierCurveTo(0.5, -0.46, 0.58, -0.52, 0.46, -0.56);
  shape.bezierCurveTo(0.4, -0.58, 0.34, -0.5, 0.4, -0.62);
  shape.bezierCurveTo(0.34, -0.92, 0.17, -1.18, 0, -1.4);
  shape.bezierCurveTo(-0.15, -1.16, -0.4, -0.9, -0.53, -0.5);
  shape.bezierCurveTo(-0.82, 0.32, -0.64, 1.0, 0, 1.15);

  const tex = makeLeafTexture();
  const geo = new THREE.ShapeGeometry(shape, 24);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0.92,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  // ShapeGeometry's default UVs come from its own bounding box, which is
  // asymmetric now — fine as-is, just means the texture isn't perfectly
  // centered, which reads as more found-object, less manufactured.

  // Center vein + a few side veins, slightly brighter, gently asymmetric.
  const veinMat = new THREE.LineBasicMaterial({ color: 0x5a8a55, transparent: true, opacity: 0.45 });
  const veinPts = [new THREE.Vector3(0.02, 1.1, 0.01), new THREE.Vector3(0, -1.35, 0.01)];
  const veinGeo = new THREE.BufferGeometry().setFromPoints(veinPts);
  const vein = new THREE.Line(veinGeo, veinMat);
  const sideVeins = [];
  for (let i = 0; i < 5; i++) {
    const y = 0.8 - i * 0.42;
    const spread = 0.5 - i * 0.06;
    const asym = (Math.random() - 0.5) * 0.08;
    const pts = [
      new THREE.Vector3(-spread + asym, y - 0.25 - Math.random() * 0.05, 0.01),
      new THREE.Vector3(0, y, 0.01),
      new THREE.Vector3(spread + asym, y - 0.25 + Math.random() * 0.05, 0.01),
    ];
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const l = new THREE.Line(g, veinMat);
    sideVeins.push(l);
  }

  const group = new THREE.Group();
  group.add(mesh, vein, ...sideVeins);
  return { group, geo, mat, tex, veinGeo, veinMat, sideVeins };
}

// ─── Backdrop: procedural depth planes, real rack focus ────────────────────
// 1.0.37 shipped a single real-photo plane blurred by screen-space vertical
// position. Scott's reaction: "Don't use the photo. What I want you to do
// is use the photo as a visual reference for the depth of field I want you
// to create. So create several planes, from the sky to the parking carage
// to the trees and so forth, and do the blurring that way, rather than
// with the actual photo." So: back to procedurally-drawn canvas layers
// (the same instinct as the pre-1.0.33 sky/far/near system), now split
// into six distinct depth planes modeled on assets/IMG_1198.jpeg's actual
// composition — sky, a distant parking garage, the twin white apartment
// blocks flanking the courtyard, the palm-lined parking lot, the near
// foreground shrub, and the black balcony rail closest to camera — each
// independently blurred based on its own fixed z-distance from a "focus
// depth" that sweeps through all of them over the course of the fall.
//
// Real depth of field, not a shader: every layer but sky (which barely
// changes under blur anyway — it's just a gradient) gets baked TWICE at
// scene-build time, once sharp and once through a canvas 2D `filter:
// blur()` pass, and animate() cross-fades each pair's opacity every frame
// by how close that layer's z currently is to the moving focus depth. No
// custom GLSL anywhere in this version: canvas 2D's blur filter is a
// plain, broadly-supported browser API, and an opacity crossfade between
// two known-good baked textures is something verifiable blind (see
// leaf-dof-check.mjs) — unlike the hand-rolled ring-blur shader this
// replaces, which had visible artifacts in Scott's screenshot and which
// GLSL-syntax correctness could never actually be confirmed for in this
// sandbox anyway.
// Design pass, 2026-07-29 — Scott: the background elements read "too
// uniform in opacity and size," everything sitting at roughly the same
// faint level rather than nearer things being distinct and farther things
// softer. The scene already has a real, moving rack-focus system (the
// sharp/blur crossfade in animate() below), but that only ever affects ONE
// layer at a time — the layer currently in focus. It says nothing about a
// baseline difference between, say, the garage (always the single
// farthest thing in the scene) and the rail (always the nearest): both
// were baked at full contrast/color regardless of focus. This bakes a
// permanent, distance-proportional haze into each layer's own texture
// (both the sharp AND blurred bake, since it's applied before the blur
// pass copies the canvas) — real atmospheric perspective, the same cheap
// depth cue actual air-and-dust haze gives distant objects in a real
// photo. Cheap because it's just a flat wash, and it stacks with the
// existing rack-focus crossfade rather than fighting it: a far layer even
// at its OWN moment of "in focus" still reads hazier than the rail ever
// does out of focus, which is exactly the near-distinct/far-soft cue that
// was missing.
function applyHaze(cx, cw, ch, amount) {
  if (amount <= 0) return;
  cx.fillStyle = `rgba(200,220,235,${(0.4 * amount).toFixed(3)})`;
  cx.fillRect(0, 0, cw, ch);
}

function drawSky(cx, cw, ch) {
  // Real Florida midday blue, matching Scott's actual photo, not the
  // hazier gray-cream gradient the pre-1.0.30 dusk/wall versions used.
  // Design pass, 2026-07-29 — Scott: warmer light in the gradient. Kept
  // the zenith blue (still "real Florida midday blue," per the note
  // above) and warmed only the horizon stop, from a cool pale blue-white
  // toward a warm sun-haze gold-white — more atmosphere scattering warm
  // light near the horizon is itself realistic, not a departure from the
  // reference photo's midday framing, just a truer read of it.
  const sky = cx.createLinearGradient(0, 0, 0, ch);
  sky.addColorStop(0,    '#5f9bd6');
  sky.addColorStop(0.55, '#a0c6da');
  sky.addColorStop(1,    '#ecdfbd');
  cx.fillStyle = sky;
  cx.fillRect(0, 0, cw, ch);

  // A few soft-edged puffy clouds, upper third — closer to the single
  // bright cumulus dead center in the reference photo than the old thin
  // haze streaks were.
  [[0.5, 0.14, 1], [0.16, 0.22, 0.6], [0.82, 0.1, 0.7]].forEach(([fx, fy, scale]) => {
    const x = cw * fx, y = ch * fy, r = cw * 0.09 * scale;
    for (let i = 0; i < 4; i++) {
      const ox = (i - 1.5) * r * 0.55, oy = Math.sin(i) * r * 0.15;
      const grad = cx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r * 0.7);
      // A touch of warmth (was pure white) — sunlit rather than sterile,
      // matching the horizon's own warmer stop above.
      grad.addColorStop(0, 'rgba(255,250,235,0.85)');
      grad.addColorStop(1, 'rgba(255,250,235,0)');
      cx.fillStyle = grad;
      cx.beginPath();
      cx.ellipse(x + ox, y + oy, r * 0.7, r * 0.42, 0, 0, Math.PI * 2);
      cx.fill();
    }
  });
}

// A small, low-contrast, distant structure peeking up between the two
// apartment blocks — Scott's own word for it describing his photo: "the
// parking carage." Narrow, hazy, centered — the farthest man-made thing
// in the frame, just past the buildings.
function drawGarage(cx, cw, ch, horizonY) {
  const gw = cw * 0.16, gh = ch * 0.1;
  const gx = cw * 0.5 - gw / 2, gy = horizonY - gh;
  cx.fillStyle = 'rgba(176,168,146,0.65)';
  cx.fillRect(gx, gy, gw, gh);
  cx.strokeStyle = 'rgba(120,112,94,0.4)';
  cx.lineWidth = 2;
  for (let i = 1; i < 6; i++) {
    const x = gx + (gw / 6) * i;
    cx.beginPath();
    cx.moveTo(x, gy);
    cx.lineTo(x, gy + gh);
    cx.stroke();
  }
}

// The twin white apartment blocks flanking the courtyard — the dominant
// shapes in Scott's photo. Two trapezoids tapering toward the center
// (reads as receding toward a vanishing point) with a loose grid of small
// dark window rectangles and a couple of thin balcony-rail accents — not
// a literal floor-by-floor reproduction.
function drawBuildings(cx, cw, ch, horizonY) {
  const buildOne = (baseX, dir) => {
    const nearW = cw * 0.34, farW = cw * 0.16, bh = ch * 0.46;
    const topY = horizonY - bh;
    cx.fillStyle = '#e7e2d5';
    cx.beginPath();
    cx.moveTo(baseX, horizonY);
    cx.lineTo(baseX + dir * nearW, horizonY);
    cx.lineTo(baseX + dir * farW, topY);
    cx.lineTo(baseX, topY);
    cx.closePath();
    cx.fill();

    // Window grid — sparse and irregular enough to avoid a printed-grid look.
    const rows = 6, cols = 5;
    for (let r = 0; r < rows; r++) {
      const rowY = topY + (bh / rows) * (r + 0.35);
      const rowW = nearW + (farW - nearW) * (r / rows);
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.12) continue; // an occasional dark/curtained gap
        const wx = baseX + dir * (rowW / cols) * (c + 0.5);
        cx.fillStyle = 'rgba(46,58,58,0.55)';
        cx.fillRect(wx - dir * 6, rowY - 8, 11, 14);
      }
      // A thin balcony-rail accent every other row.
      if (r % 2 === 0) {
        cx.strokeStyle = 'rgba(60,58,50,0.3)';
        cx.lineWidth = 1.5;
        cx.beginPath();
        cx.moveTo(baseX, rowY + 10);
        cx.lineTo(baseX + dir * rowW, rowY + 10);
        cx.stroke();
      }
    }
  };
  buildOne(cw * 0.02, 1);
  buildOne(cw * 0.98, -1);
}

// Parking-lot pavement + a loose row of palms and a couple of small round
// ornamental shrubs — the mid-ground band between the buildings and the
// foreground shrub.
function drawPalmsLot(cx, cw, ch, horizonY, lotBottom) {
  const lot = cx.createLinearGradient(0, horizonY, 0, lotBottom);
  lot.addColorStop(0, 'rgba(168,164,150,0.5)');
  lot.addColorStop(1, 'rgba(148,144,132,0.35)');
  cx.fillStyle = lot;
  cx.fillRect(0, horizonY, cw, lotBottom - horizonY);

  // A soft tree-canopy hedge along the horizon, behind the palms/shrubs —
  // Scott: "fill in the background greenery more." The real photo has a
  // near-continuous line of trees backing the whole courtyard, not just a
  // few isolated palms against bare pavement; this reads as that canopy
  // without drawing every individual tree.
  const canopyY = horizonY + (lotBottom - horizonY) * 0.12;
  for (let i = 0; i < 22; i++) {
    const x = (cw / 22) * (i + 0.5) + (Math.random() - 0.5) * (cw / 22);
    const r = cw * (0.02 + Math.random() * 0.014);
    const grad = cx.createRadialGradient(x, canopyY, 0, x, canopyY, r);
    grad.addColorStop(0, 'rgba(52,74,44,0.55)');
    grad.addColorStop(1, 'rgba(52,74,44,0)');
    cx.fillStyle = grad;
    cx.beginPath();
    cx.ellipse(x, canopyY, r, r * 0.8, 0, 0, Math.PI * 2);
    cx.fill();
  }

  const palm = (px, py, scale) => {
    cx.strokeStyle = 'rgba(58,72,48,0.75)';
    cx.lineWidth = 3 * scale;
    cx.beginPath();
    cx.moveTo(px, py);
    cx.quadraticCurveTo(px - 6 * scale, py - 30 * scale, px - 2 * scale, py - 58 * scale);
    cx.stroke();
    const crownX = px - 2 * scale, crownY = py - 58 * scale;
    for (let i = 0; i < 6; i++) {
      const a = (-0.95 + i * 0.38) * Math.PI;
      cx.beginPath();
      cx.moveTo(crownX, crownY);
      cx.quadraticCurveTo(
        crownX + Math.cos(a) * 18 * scale, crownY + Math.sin(a) * 11 * scale,
        crownX + Math.cos(a) * 32 * scale, crownY + Math.sin(a) * 17 * scale + 8 * scale
      );
      cx.stroke();
    }
  };
  // More palms, closer together, varied scale — the real photo's row runs
  // almost the full width of the courtyard, not five isolated trees.
  [
    [0.05, 1], [0.14, 0.75], [0.24, 0.85], [0.34, 0.6],
    [0.5, 0.55], [0.63, 0.65], [0.72, 0.8], [0.78, 0.9],
    [0.86, 0.7], [0.93, 0.95], [0.98, 0.65],
  ].forEach(([fx, scale]) => {
    palm(cw * fx, horizonY + (lotBottom - horizonY) * 0.3, (cw / 900) * scale);
  });

  // More round ornamental shrubs along the pavement edge, not just two.
  [[0.15, 0.5], [0.3, 0.6], [0.42, 0.55], [0.55, 0.4], [0.68, 0.5], [0.88, 0.45]]
    .forEach(([fx, scale]) => {
      const x = cw * fx, y = lotBottom - 4, r = cw * 0.022 * scale;
      cx.fillStyle = 'rgba(64,86,52,0.6)';
      cx.beginPath();
      cx.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2);
      cx.fill();
    });
}

// The near foreground shrub — soft, rounded, silhouette-style leaf
// clusters like the magnolia growing up through Scott's own rail. Scott:
// "fill in the background greenery more" — denser and taller than the
// first pass, still concentrated toward the corners/lower edge (the drop
// itself falls in the right-third column, not dead center, so this isn't
// trying to stay clear of a center line — just keeping a believable gap
// near the top-middle where the sky/buildings should still read through).
function drawForegroundFoliage(cx, cw, ch, foliageTop) {
  const blob = (x, y, r) => {
    const grad = cx.createRadialGradient(x, y, r * 0.1, x, y, r);
    grad.addColorStop(0, 'rgba(40,58,34,0.85)');
    grad.addColorStop(1, 'rgba(40,58,34,0)');
    cx.fillStyle = grad;
    cx.beginPath();
    cx.ellipse(x, y, r, r * 0.85, 0, 0, Math.PI * 2);
    cx.fill();
  };
  // Big base clusters, corner-anchored but reaching higher and wider than
  // before.
  const clusters = [
    [0.06, 1.0, 0.2], [0.16, 0.9, 0.16], [0.26, 0.82, 0.12], [0.02, 0.78, 0.11],
    [0.94, 1.0, 0.2], [0.84, 0.9, 0.16], [0.74, 0.84, 0.12], [0.98, 0.76, 0.11],
    [0.4, 0.98, 0.1], [0.6, 0.98, 0.1],
  ];
  clusters.forEach(([fx, fy, fr]) => {
    blob(cw * fx, foliageTop + (ch - foliageTop) * fy, cw * fr);
  });

  // A second pass of smaller blobs breaks up the big clusters' smooth
  // outer edges into something leafier/more textured, rather than reading
  // as a few flat green circles.
  for (let i = 0; i < 26; i++) {
    const side = i % 2 === 0 ? 0.14 : 0.86;
    const fx = side + (Math.random() - 0.5) * 0.3;
    const fy = 0.78 + Math.random() * 0.24;
    const fr = 0.03 + Math.random() * 0.05;
    blob(cw * Math.min(1, Math.max(0, fx)), foliageTop + (ch - foliageTop) * Math.min(1, fy), cw * fr);
  }
}

// Black metal balcony rail, closest layer to camera — same bar pattern
// the pre-1.0.37 versions used, just its own standalone plane now rather
// than sharing a canvas with a potted plant (drawForegroundFoliage's job
// instead).
function drawRail(cx, cw, ch, railTop, railBottom) {
  cx.fillStyle = 'rgba(22,22,24,0.92)';
  cx.fillRect(0, railTop, cw, 4);
  cx.fillRect(0, railBottom - 3, cw, 3.5);
  const baluster = cw / 30;
  for (let x = baluster / 2; x < cw; x += baluster) {
    cx.fillRect(x - 1.5, railTop, 3, railBottom - railTop);
  }
}

// Bakes a layer twice — once as drawn, once blurred via canvas 2D's own
// `filter` property applied to a drawImage pass over the first canvas
// (blurring the finished composition, not each individual fill — avoids
// the edge artifacts a live filter during drawing would leave). This is
// the whole reason no shader is needed anywhere in this version: the
// "focus" effect is just an opacity crossfade between two known-good
// textures, done in animate() below.
function makeLayerTexturePair(cw, ch, drawFn, blurPx) {
  const sharpCanvas = document.createElement('canvas');
  sharpCanvas.width = cw; sharpCanvas.height = ch;
  drawFn(sharpCanvas.getContext('2d'));

  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = cw; blurCanvas.height = ch;
  const bctx = blurCanvas.getContext('2d');
  bctx.filter = `blur(${blurPx}px)`;
  bctx.drawImage(sharpCanvas, 0, 0);

  const sharpTex = new THREE.CanvasTexture(sharpCanvas);
  const blurTex = new THREE.CanvasTexture(blurCanvas);
  sharpTex.wrapS = sharpTex.wrapT = THREE.ClampToEdgeWrapping;
  blurTex.wrapS = blurTex.wrapT = THREE.ClampToEdgeWrapping;
  return { sharpTex, blurTex };
}

export function createLeaf(container, { preview = false } = {}) {
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  const aspect = w / h;

  const scene  = new THREE.Scene();
  const viewH  = 3.2;
  const camera = new THREE.OrthographicCamera(
    -viewH * aspect, viewH * aspect, viewH, -viewH, 0.1, 20
  );
  camera.position.z = 5;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  // Preview tiles: never append the WebGL canvas itself — see
  // mountClippedPreviewCanvas's own comment in sceneKit.js. Full scene
  // (right-third layout, no circular tile) is unaffected, so it keeps the
  // plain direct append it always had.
  const clippedPreview = preview ? mountClippedPreviewCanvas(container, renderer) : null;
  if (!preview) container.appendChild(renderer.domElement);

  const root = new THREE.Group();
  scene.add(root);
  const reduceMotion = prefersReducedMotion();

  // ─── Backdrop: sky + five depth-of-field layers ─────────────────────────
  // Canvas resolution scales with aspect, same approach every version of
  // this backdrop has used. horizonY/lotBottom/foliageTop/railTop/
  // railBottom carve the canvas height into sky → garage/buildings →
  // parking lot/palms → foreground shrub → rail, top to bottom, matching
  // IMG_1198.jpeg's own composition.
  const cw = Math.round(Math.max(600, Math.min(1400, 900 * Math.max(aspect, 0.5))));
  const ch = Math.round(cw / Math.max(aspect, 0.5));
  const horizonY = ch * 0.42;
  const lotBottom = ch * 0.66;
  const foliageTop = ch * 0.58;
  const railTop = ch * 0.8, railBottom = ch * 0.98;

  // Same 2.4x plane size every backdrop version of this scene has used —
  // an orthographic camera means a plane this size covers the same screen
  // fraction regardless of z, so every layer shares one PlaneGeometry.
  const PLANE_W = viewH * aspect * 2.4;
  const PLANE_H = viewH * 2.4;
  const backdropGeo = new THREE.PlaneGeometry(PLANE_W, PLANE_H);

  const backdrop = new THREE.Group();
  scene.add(backdrop);
  const depthLayers = []; // { z, sharpMat, blurMat, sharpTex, blurTex } — DOF-driven layers only

  // Sky: always fully sharp — blurring a smooth gradient barely changes
  // it, so it's the one layer not worth baking twice.
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = cw; skyCanvas.height = ch;
  drawSky(skyCanvas.getContext('2d'), cw, ch);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, depthWrite: false });
  const skyMesh = new THREE.Mesh(backdropGeo, skyMat);
  skyMesh.position.z = -8;
  backdrop.add(skyMesh);

  // Real depth-of-field layers, nearest to farthest. Each z also doubles
  // as that layer's own "in-focus" depth — see FOCUS_NEAR/FOCUS_FAR below.
  function addDepthLayer(drawFn, z, blurPx) {
    const { sharpTex, blurTex } = makeLayerTexturePair(cw, ch, drawFn, blurPx);
    const sharpMat = new THREE.MeshBasicMaterial({ map: sharpTex, transparent: true, depthWrite: false, opacity: 1 });
    const blurMat  = new THREE.MeshBasicMaterial({ map: blurTex,  transparent: true, depthWrite: false, opacity: 0 });
    const sharpMesh = new THREE.Mesh(backdropGeo, sharpMat);
    const blurMesh  = new THREE.Mesh(backdropGeo, blurMat);
    sharpMesh.position.z = z;
    blurMesh.position.z = z - 0.002; // negligible offset, keeps the pair a stable stack
    backdrop.add(sharpMesh, blurMesh);
    // sharpMesh/blurMesh exposed (not just the materials) so the two
    // "living" layers can carry a tiny independent sway on their shared x/y
    // — see ambientSway above and its application in animate(). Moving both
    // meshes of a pair identically keeps the sharp/blur crossfade visually
    // locked together as they drift.
    const layer = { z, sharpMat, blurMat, sharpTex, blurTex, sharpMesh, blurMesh };
    depthLayers.push(layer);
    return layer;
  }

  // Preview tiles: sky only, same simplification instinct as every prior
  // version of this backdrop — full depth/window/rail detail competes
  // with the leaf's own round silhouette at 320px thumbnail scale (1.0.32:
  // "the leaf is square now, not round"), and a static thumbnail has no
  // scroll progress to rack focus against anyway.
  // palmsLotLayer/foliageLayer: the two backdrop layers that get the
  // sympathetic ambient sway (see ambientSway's own comment) — captured by
  // name specifically because they're the "living" things already drawn in
  // this scene (palms, the foreground shrub clusters), unlike the rail or
  // buildings. null in preview mode, where no backdrop layers exist at all;
  // every read of these below is guarded accordingly.
  let palmsLotLayer = null, foliageLayer = null;
  if (!preview) {
    // Haze amount climbs with actual distance (garage farthest -> rail
    // nearest, 0 = no haze at all) — a permanent depth cue independent of
    // whichever layer the moving rack focus currently favors.
    addDepthLayer(cx => { drawGarage(cx, cw, ch, horizonY); applyHaze(cx, cw, ch, 0.6); }, -6.8, cw * 0.02);
    addDepthLayer(cx => { drawBuildings(cx, cw, ch, horizonY); applyHaze(cx, cw, ch, 0.42); }, -6, cw * 0.012);
    palmsLotLayer = addDepthLayer(cx => { drawPalmsLot(cx, cw, ch, horizonY, lotBottom); applyHaze(cx, cw, ch, 0.22); }, -4.2, cw * 0.014);
    foliageLayer = addDepthLayer(cx => { drawForegroundFoliage(cx, cw, ch, foliageTop); applyHaze(cx, cw, ch, 0.06); }, -2.8, cw * 0.016);
    addDepthLayer(cx => drawRail(cx, cw, ch, railTop, railBottom), -2, cw * 0.009);
  }

  // Rack focus sweeps linearly from the rail (nearest DOF layer, z=-2) to
  // the garage (farthest DOF layer, z=-6.8) over the full fall — see
  // animate() below, which drives this off the same `frac` already
  // driving the drop.
  const FOCUS_NEAR = -2, FOCUS_FAR = -6.8;
  const FOCUS_BAND = 0.5; // world units either side of focus depth that stay fully sharp

  // ─── Ground: a faint horizontal glow near the bottom ──────────────────────
  // Warm neutral taupe (was a mossy forest-floor green, then a deeper
  // terracotta) — matches the daytime rework and the warm wood-floor tone
  // in Scott's reference photos rather than a saturated clay color. The
  // drop lands in a planter on the balcony, not on a forest floor. Part of
  // `root`, not `backdrop` — it stays locked to the leaf/drop rather than
  // parallax-shifting with the environment behind it.
  const groundY = -2.3;
  const groundGeo = new THREE.PlaneGeometry(viewH * aspect * 2.2, 0.5);
  const groundMat = new THREE.MeshBasicMaterial({
    color: 0x8a7059, transparent: true, opacity: 0.35, depthWrite: false,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set(0, groundY - 0.15, -1);
  root.add(ground);

  // ─── Leaf ───────────────────────────────────────────────────────────────
  const leaf = buildLeaf();
  root.add(leaf.group);
  let tipX, tipY;

  // Full scene: the leaf fills the right third of the window, sized to its
  // column so it holds up across very different aspect ratios (ultrawide
  // desktop vs. a portrait phone) — Scott, 1.0.33: "the leaf fills the
  // right 1/3 of the window, and the text fills the other 2/3." Preview
  // tiles are untouched — small, off-center, unrelated to this request.
  // Recomputed on resize (see the bindGuardedResize call below), since
  // "the right third" is relative to whatever the viewport's aspect ratio
  // happens to be right now.
  // Vertical anchor stays fixed regardless of aspect ratio (matches the
  // pre-1.0.33 default) — only x (column center) and scale vary with the
  // viewport. Scale is capped at 1.7: letting it grow further on very
  // wide/ultrawide windows was verified (see leaf-layout-check3.mjs,
  // outputs scratch dir) to shrink the fall distance toward zero, since a
  // bigger leaf at a fixed vertical position pushes its tip down toward
  // groundY. 1.7 keeps a real, visible fall across every aspect ratio
  // tested from portrait phones to ultrawide desktop.
  const LEAF_Y = 0.9;
  function layoutLeaf() {
    if (preview) {
      leaf.group.scale.setScalar(0.85);
      leaf.group.position.set(0.18, 0.9, 0);
    } else {
      const na = camera.right / viewH; // current aspect, camera already up to date
      const colW = (2 * viewH * na) / 3; // width of the right third, in world units
      // Fit the leaf to about half its column's width, not edge-to-edge —
      // reads as placed, not crammed. 1.33 is the leaf shape's own
      // unscaled width (see buildLeaf's bezier path).
      const scale = Math.max(0.4, Math.min(1.7, (colW * 0.5) / 1.33));
      const colCenter = viewH * na - colW / 2;
      leaf.group.scale.setScalar(scale);
      leaf.group.position.set(colCenter, LEAF_Y, 0);
    }
    tipY = leaf.group.position.y + (-1.4) * leaf.group.scale.x;
    tipX = leaf.group.position.x;
  }
  layoutLeaf();
  leaf.group.rotation.z = -0.045;

  // ─── Droplet ────────────────────────────────────────────────────────────
  const dropTex = makeDropletTexture();
  const dropMat = new THREE.SpriteMaterial({
    map: dropTex, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const drop = new THREE.Sprite(dropMat);
  drop.scale.set(0.22, 0.28, 1);
  root.add(drop);

  // ─── Motes: a handful of escaped-molecule particles + splash burst ────────
  const moteTex = makeMoteTexture();
  const moteCount = preview ? 6 : 12;
  const motes = [];
  for (let i = 0; i < moteCount; i++) {
    const mat = new THREE.SpriteMaterial({
      map: moteTex, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.06, 0.06, 1);
    root.add(sprite);
    motes.push({ sprite, mat, active: false, kind: 'escape' });
  }

  // ─── Caption (full only) ───────────────────────────────────────────────
  let caption = null, hint = null;
  if (!preview && !document.getElementById('leaf-styles')) {
    const style = document.createElement('style');
    style.id = 'leaf-styles';
    style.textContent = `
      /* z-index must clear #experience-overlay (styles/main.css: fixed,
         z-index:300) — appended to document.body, outside that overlay,
         same fix already applied in orrery.js/orbiter.js. */
      /* Scott, 1.0.33: "the leaf fills the right 1/3 of the window, and
         the text fills the other 2/3 ... lose caption background, change
         caption text color to black and enlarge to fill its space, as if
         its plane was within the perspective layout of the 3d space."
         Still the same real, user-scrollable element driving the fall
         (see updateTargetFromScroll below) — just restyled: no box,
         border, or background chip, large black text, most of the left
         two-thirds of the screen instead of a small bottom-left corner.
         Positioned to clear #pm-nav (3.5rem, z-index 500) at top. */
      #leaf-caption {
        position: fixed;
        left: 4vw;
        /* Scott: "have the text extend the full height of the window."
           Was top: 4.5rem + height: min(74vh, 44rem) — height now comes
           from top+bottom instead of an explicit value, so the box
           stretches to fill everything between the nav (top: 4.5rem
           clears it) and the bottom-fixed chrome (bottom: 4.5rem clears
           #site-title + #colophon-mark, the same clearance value
           #landing and leaf's own mobile caption already use for that
           exact footprint). */
        top: 4.5rem; bottom: 4.5rem;
        width: min(62vw, 60rem);
        overflow-y: auto; -webkit-overflow-scrolling: touch;
        pointer-events: all; z-index: 310;
        scrollbar-color: rgba(20,20,16,0.35) transparent;
        scrollbar-width: thin;
        -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 6%, black 94%, transparent 100%);
                mask-image: linear-gradient(to bottom, transparent 0%, black 6%, black 94%, transparent 100%);
      }
      #leaf-caption p {
        text-align: left;
        /* Black now (was a pale translucent green) — only legible against
           the new bright daytime backdrop because of it; would've
           vanished against the old dark dusk/wall versions. */
        color: rgba(18, 16, 12, 0.92);
        /* Scott: swap to Coda. Worth flagging — Coda is a heavy display
           face (Google's own description: "impact heavy display font"),
           built for headlines, not long paragraphs — different job than
           Zen Maru Gothic was doing here. Using its Regular (400) weight
           rather than Heavy (800) to keep it as readable as a fairly
           blocky face gets across 8 full paragraphs; his call if this
           reads as too heavy once he sees it move. */
        font-family: 'Coda', sans-serif;
        font-weight: 400;
        /* Enlarged well past the old corner-box version — the text IS
           most of the composition now, not a small accent beside it. */
        font-size: clamp(1.6rem, 3.2vw, 2.6rem);
        letter-spacing: 0.005em;
        line-height: 1.5;
        /* A soft light halo, plus (1.0.44) a soft DARK halo underneath it
           too. The light halo alone worked fine while the caption box
           mostly sat over the bright sky/buildings, but 1.0.43 stretched
           it the full window height, so paragraphs now scroll across
           every part of the backdrop — including the dark rail/foliage
           band near the bottom, where black text + a white halo both
           read as the same dark smear. A dark halo underneath does for
           light backgrounds what the white one does for dark ones — same
           "no boxed background" approach Scott asked for, just covering
           both directions of contrast instead of one. */
        text-shadow:
          0 1px 18px rgba(255,255,255,0.65),
          0 1px 2px rgba(255,255,255,0.4),
          0 0 10px rgba(0,0,0,0.4),
          0 0 3px rgba(0,0,0,0.5);
        margin: 0 0 2.2rem;
      }
      #leaf-caption p:last-child { margin-bottom: 0; }
      #leaf-hint {
        position: fixed; top: 4.5rem; right: 1.2rem;
        /* Dark now, not white — same backdrop-brightness flip as the
           caption text above. */
        color: rgba(40,36,30,0.4);
        font-size: 0.55rem; letter-spacing: 0.2em;
        text-transform: uppercase; pointer-events: none;
        text-align: right; z-index: 310; line-height: 1.8;
        font-family: 'Coda', sans-serif;
      }
      @media (max-width: 800px) {
        /* Not enough width for a right-third leaf column and a left-two-
           thirds text column both — same conflict as before 1.0.30, same
           fix: drop to a small centered box at the bottom below this
           breakpoint rather than overlapping the two. */
        /* bottom was 1.6rem — nowhere near enough to clear the fixed
           #site-title (bottom:1.2rem, plus its own ~2rem-tall pill), so
           the caption's last line and the title ran right into each other
           on a phone-width viewport (visible in Scott's mobile screenshot:
           "PERCEPTUAL MECHANICS" sitting on top of the final paragraph).
           main.css's #landing rule already documents the fix for this
           exact fixed-footprint problem — 4.5rem clears title AND
           #colophon-mark with room to spare — so reusing that same value
           here rather than a new one-off guess. */
        #leaf-caption { left: 50%; top: auto; bottom: 4.5rem; transform: translateX(-50%); width: 88vw; height: 30vh; }
        #leaf-caption p { text-align: center; font-size: 1rem; }
      }
      /* A little grain over the whole render — a handled, weathered
         object rather than a clean digital gradient, same wabi-sabi
         reasoning as the leaf's own mottled texture. */
      #leaf-grain {
        position: absolute; inset: 0; pointer-events: none; z-index: 5;
        opacity: 0.1; mix-blend-mode: overlay;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/></svg>");
        background-size: 160px 160px;
      }
    `;
    document.head.appendChild(style);
  }
  // Scroll-driven frac: the box below IS the control now, not a readout —
  // scrolling through the text sets targetScrollFrac (0 at the top, 1 at
  // the bottom), which the animate loop eases toward each frame and uses
  // as the drop's own `frac`. Reading the piece top to bottom is what
  // makes the drop fall; scrolling back up rewinds it. Preview tiles have
  // no box (no room, no interaction), so they keep the old self-playing
  // loop further down.
  let targetScrollFrac = 0;
  let grain = null;

  // ─── Fall phases (fractions of the loop, 0..1) ──────────────────────────
  // Declared before the caption/updatePhaseFractions setup below, which
  // closes over and mutates this object once real per-paragraph scroll
  // positions are measurable. Defaults here only matter for preview tiles
  // (no real caption box to measure against) — full-scene values get
  // overwritten with the actual measurement immediately once the caption
  // exists.
  const PHASE = { holdEnd: 0.14, fallStart: 0.14, fallEnd: 0.86, splashEnd: 0.94 };

  if (!preview) {
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    grain = document.createElement('div');
    grain.id = 'leaf-grain';
    grain.setAttribute('aria-hidden', 'true');
    container.appendChild(grain);

    caption = document.createElement('div');
    caption.id = 'leaf-caption';
    caption.setAttribute('role', 'region');
    caption.setAttribute('aria-label', "In The End It Falls Slowly Through The Aether — scroll to read");
    // The whole piece, stacked in reading order, in normal document flow —
    // real layout, real native scrolling. No JS-driven transform anymore;
    // the browser's own scroll position is the single source of truth for
    // both "what's readable right now" and "how far the drop has fallen."
    const stageEls = TEXT_STAGES.map(stage => {
      const p = document.createElement('p');
      p.textContent = stage.text;
      caption.appendChild(p);
      return p;
    });
    document.body.appendChild(caption);

    hint = document.createElement('p');
    hint.id = 'leaf-hint';
    hint.innerHTML = 'scroll to read &nbsp;·&nbsp; the drop follows';
    hint.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hint);

    const updateTargetFromScroll = () => {
      const range = caption.scrollHeight - caption.clientHeight;
      targetScrollFrac = range > 0 ? Math.min(1, Math.max(0, caption.scrollTop / range)) : 0;
    };
    caption.addEventListener('scroll', updateTargetFromScroll, { passive: true });
    // Re-measure on resize too — scrollHeight changes when the text rewraps.
    window.addEventListener('resize', updateTargetFromScroll);
    caption._updateTargetFromScroll = updateTargetFromScroll;

    // Measures each stage boundary's real scroll fraction (same formula as
    // updateTargetFromScroll above — a paragraph's offsetTop stands in for
    // the scrollTop at which it reaches the top of the box) and writes
    // them into PHASE below, so "the drop grows toward release" and
    // "falls at the moment the text says it does" are synced to the
    // actual rendered text instead of hand-guessed fractions that drift
    // out of step whenever a paragraph's real height doesn't match its
    // old assumed share of the whole. Re-run on resize alongside
    // updateTargetFromScroll, for the same rewrap reason.
    const updatePhaseFractions = () => {
      const range = caption.scrollHeight - caption.clientHeight;
      if (range <= 0) return; // degenerate (huge viewport, short text) — keep PHASE's defaults
      const fracAt = el => Math.min(1, Math.max(0, el.offsetTop / range));
      // Minimum gaps enforced between each boundary — on a very short/wide
      // viewport, `range` can be small enough that later stages' offsets
      // clamp together near 1 (the box shows most of the text at once,
      // little scrolling needed to reach the bottom), which would collapse
      // the splash phase to zero width and pop straight from freefall to
      // reform with no impact frame. The real measurement still drives
      // this in the normal case; the gaps just keep each phase from
      // vanishing entirely in that edge case.
      const holdEnd = Math.min(0.4, Math.max(0.05, fracAt(stageEls[1])));
      const fallEnd = Math.max(holdEnd + 0.25, Math.min(0.96, fracAt(stageEls[6])));
      const splashEnd = Math.max(fallEnd + 0.03, Math.min(0.99, fracAt(stageEls[7])));
      PHASE.holdEnd = holdEnd;
      PHASE.fallStart = holdEnd; // stage 0 (coalescing) ends, stage 1 (release) begins
      PHASE.fallEnd = fallEnd;   // stage 6 (impact) begins
      PHASE.splashEnd = splashEnd; // stage 7 (reform) begins
    };
    updatePhaseFractions();
    window.addEventListener('resize', updatePhaseFractions);
    caption._updatePhaseFractions = updatePhaseFractions;
  }

  function resetMotes() {
    motes.forEach(m => { m.active = false; m.mat.opacity = 0; });
  }
  resetMotes();

  // Escape/splash used to be one-shot flags that only ever reset at the
  // very start of an autonomous, always-forward loop. Scroll can go
  // backward too now, so both re-arm with a small hysteresis margin
  // instead: fire once when frac crosses up past the threshold, re-arm
  // once it drops back below (threshold - margin), so scrolling back up
  // and then down again re-triggers the burst rather than firing once
  // per scene and never again.
  const ESCAPE_FIRE = PHASE.fallStart + 0.28 * (PHASE.fallEnd - PHASE.fallStart);
  const REARM_MARGIN = 0.012;

  // ─── Animate ─────────────────────────────────────────────────────────
  // Real elapsed time now, not an assumed fixed 1/60s step — a fixed-step
  // assumption is silently wrong on a 120Hz ProMotion phone, a throttled
  // background tab, or just an inconsistent frame, and "particularly on
  // mobile" was Scott's own stated concern.
  let animId, tSec = 0, currentFrac = 0, fallVelocity = 0;
  let escapeTriggered = false, splashTriggered = false;
  // released/releasedAtFrac/releaseElapsed: the physics latch. `released`
  // flips true the frame gravityForce(r) first exceeds tensionForce(r) (see
  // the release check in animate(), below) and stays latched — re-checking
  // the force comparison every frame once already released would let a
  // spring overshoot flicker the drop between held and falling.
  // releasedAtFrac captures the exact frac at that instant, becoming the
  // real fallStart for the fall's own progress interpolation.
  // releaseElapsed is real elapsed seconds since release, used only for the
  // leaf's recoil ring-down (see recoilAngle) — deliberately not scroll
  // fraction, since a branch settling is a mechanical process on its own
  // clock, not something the reader's scroll speed should govern.
  let released = false, releasedAtFrac = null, releaseElapsed = 0;
  let lastFrameTime = performance.now();
  // Critically-damped-ish spring in place of the old fixed-rate exponential
  // follow (currentFrac += (target - currentFrac) * 0.18, every frame,
  // regardless of how far off target actually was). A spring's restoring
  // acceleration is proportional to displacement — a fast flick jumps
  // targetScrollFrac far ahead in one tick, which the spring resolves with
  // real velocity and a touch of overshoot, while a slow scroll barely
  // displaces it at all. That's the organic scroll-to-acceleration
  // coupling Scott asked for, without needing to hand-track scroll
  // velocity separately: the spring already responds to how big the jump
  // was, which is exactly a function of how fast the input was.
  const SPRING_STIFFNESS = 130;
  const SPRING_DAMPING = 2 * Math.sqrt(SPRING_STIFFNESS) * 0.92; // just under critical — a little organic settle, not a bounce
  function animate() {
    animId = requestAnimationFrame(animate);
    const now = performance.now();
    // Clamp the step so a backgrounded/throttled tab doesn't return with
    // one huge dt and fling the drop across the whole fall in one frame.
    const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
    lastFrameTime = now;
    tSec += dt;

    let frac;
    if (preview) {
      frac = (tSec % CYCLE_SECONDS) / CYCLE_SECONDS;
    } else {
      const accel = (targetScrollFrac - currentFrac) * SPRING_STIFFNESS - fallVelocity * SPRING_DAMPING;
      fallVelocity += accel * dt;
      currentFrac += fallVelocity * dt;
      // Stop dead at the ends rather than vibrating against a hard clamp.
      if (currentFrac < 0 && fallVelocity < 0) { currentFrac = 0; fallVelocity = 0; }
      if (currentFrac > 1 && fallVelocity > 0) { currentFrac = 1; fallVelocity = 0; }
      frac = currentFrac;
    }

    if (frac < REARM_MARGIN) {
      resetMotes();
    }
    if (frac < ESCAPE_FIRE - REARM_MARGIN) escapeTriggered = false;
    if (frac < PHASE.fallEnd - REARM_MARGIN) splashTriggered = false;

    // ─── Release: a real force comparison, not a scroll cutoff ────────────
    // holdT is still driven by scroll position — reading further genuinely
    // grows the drop, same interaction model as everything else in this
    // piece. What's different is that the fall's start is whichever frame
    // gravityForce(r) first exceeds tensionForce(r), not a fixed fraction
    // read off the text. Re-armed with the same hysteresis-margin idiom
    // already used for escapeTriggered/splashTriggered below, keyed to the
    // actual latched release point rather than a stored constant.
    if (!released) {
      const holdT = frac / PHASE.holdEnd;
      const r = dropRadius(holdT);
      if (gravityForce(r) > tensionForce(r)) {
        released = true;
        releasedAtFrac = frac;
        releaseElapsed = 0;
      }
    } else if (frac < releasedAtFrac - REARM_MARGIN) {
      released = false;
      releasedAtFrac = null;
    }

    // Leaf rotation: still while held, snap-and-ring-down once released —
    // handled once here (not per fall/splash/reform branch below) so the
    // decay plays out continuously across all three without resetting or
    // jumping between them.
    if (released) {
      releaseElapsed += dt;
      leaf.group.rotation.z = -0.045 + recoilAngle(releaseElapsed);
    } else {
      leaf.group.rotation.z = -0.045;
    }

    if (!released) {
      // Surface-tension hold: the drop sits at the leaf tip. Genuinely
      // still, not gently trembling — GROWTH_EXP's cubic bias already
      // keeps r (and so growVis) tiny for most of this window, so the drop
      // reads as motionless until the last stretch, where the real surge
      // the text describes ("feeling the onward surge... until there's no
      // more time") becomes the one visible thing happening here. growVis's
      // end value (1, at r=R_CRITICAL) still matches freefall's own
      // starting scale exactly, so there's no pop at the hold-to-fall
      // handoff, same continuity the old growS was built to guarantee.
      const holdT = frac / PHASE.holdEnd;
      const r = dropRadius(holdT);
      const growVis = Math.min(1, r / R_CRITICAL);
      const tremble = Math.sin(tSec * 9) * 0.0025 * growVis;
      drop.position.set(tipX + tremble, tipY - 0.06, 0.05);
      drop.scale.set(0.04 + growVis * 0.18, 0.05 + growVis * 0.23, 1);
      dropMat.opacity = 0.35 + growVis * 0.65;
    } else if (frac < PHASE.fallEnd) {
      // Freefall. fallCurve gives an immediate, nonzero velocity right at
      // release (a hard cut, not an eased ramp from rest) and keeps
      // accelerating through the rest of the drop — see fallCurve's comment.
      const fallFrac = Math.max(0, Math.min(1, (frac - releasedAtFrac) / (PHASE.fallEnd - releasedAtFrac)));
      const eased = fallCurve(fallFrac);
      const y = tipY - 0.06 - eased * (tipY - 0.06 - groundY);
      drop.position.set(tipX + Math.sin(fallFrac * 6) * 0.015, y, 0.05);
      drop.scale.set(0.22, 0.28 + eased * 0.06, 1);
      dropMat.opacity = 1;

      // Friction: release a few escaping motes early-mid fall.
      if (!escapeTriggered && fallFrac > 0.28) {
        escapeTriggered = true;
        motes.filter(m => m.kind === 'escape').slice(0, Math.ceil(motes.length * 0.4)).forEach((m, i) => {
          m.active = true;
          m.mat.opacity = 0.8;
          m.sprite.position.copy(drop.position);
          m.vx = (Math.random() - 0.5) * 1.4;
          m.vy = 0.15 + Math.random() * 0.35;
          m.life = 0;
        });
      }
    } else if (frac < PHASE.splashEnd) {
      // Impact / splash burst.
      const splashFrac = (frac - PHASE.fallEnd) / (PHASE.splashEnd - PHASE.fallEnd);
      drop.scale.set(0.3 * (1 - splashFrac * 0.6), 0.1 * (1 - splashFrac), 1);
      dropMat.opacity = Math.max(0, 1 - splashFrac * 1.4);
      drop.position.set(tipX, groundY, 0.05);

      if (!splashTriggered) {
        splashTriggered = true;
        motes.filter(m => !m.active).forEach(m => {
          m.active = true;
          m.kind = 'splash';
          m.mat.opacity = 0.9;
          m.sprite.position.set(tipX, groundY, 0.05);
          const a = Math.random() * Math.PI;
          const speed = 0.6 + Math.random() * 0.8;
          m.vx = Math.cos(a) * speed;
          m.vy = Math.abs(Math.sin(a)) * speed;
          m.life = 0;
        });
      }
    } else {
      // Reform: fade back in at the leaf tip for the next cycle.
      const reformFrac = (frac - PHASE.splashEnd) / (1 - PHASE.splashEnd);
      dropMat.opacity = reformFrac;
      drop.position.set(tipX, tipY - 0.06, 0.05);
      drop.scale.set(0.1 + reformFrac * 0.1, 0.12 + reformFrac * 0.12, 1);
    }

    // Advance active motes.
    motes.forEach(m => {
      if (!m.active) return;
      m.life += dt;
      m.sprite.position.x += m.vx * dt;
      m.sprite.position.y += m.vy * dt - (m.kind === 'splash' ? 1.6 : 0.05) * dt * m.life;
      const maxLife = m.kind === 'splash' ? 1.1 : 3.5;
      m.mat.opacity = Math.max(0, (m.kind === 'splash' ? 0.9 : 0.6) * (1 - m.life / maxLife));
      if (m.life > maxLife) { m.active = false; m.mat.opacity = 0; }
    });

    // A very slow ambient drift on the foreground (leaf/drop/ground) —
    // alive, not static. This part IS autonomous decorative motion
    // (unlike the drop's fall, which is scroll-driven i.e. visitor-
    // initiated), so it respects prefers-reduced-motion.
    if (!reduceMotion) root.position.x = Math.sin(tSec * 0.05) * 0.02;

    // Sympathetic ambient motion on the two "living" backdrop layers — see
    // ambientSway's own comment for why these two specifically, and why the
    // frequencies below (0.083/0.061 and 0.037/0.071) were picked clear of
    // the root drift's own 0.05Hz and of each other. Ongoing regardless of
    // fall/release state, on purpose.
    if (!reduceMotion && palmsLotLayer) {
      const s = ambientSway(tSec, 0.083, 0.061, 0.7, 0.006);
      palmsLotLayer.sharpMesh.position.x = palmsLotLayer.blurMesh.position.x = s.x;
      palmsLotLayer.sharpMesh.position.y = palmsLotLayer.blurMesh.position.y = s.y;
    }
    if (!reduceMotion && foliageLayer) {
      const s = ambientSway(tSec, 0.037, 0.071, 3.4, 0.004);
      foliageLayer.sharpMesh.position.x = foliageLayer.blurMesh.position.x = s.x;
      foliageLayer.sharpMesh.position.y = foliageLayer.blurMesh.position.y = s.y;
    }

    // Rack focus: sweep the in-focus depth from the rail toward the
    // garage over the course of the fall — Scott: "as they scroll,
    // different parts of the background will be in focus while the
    // drop's falling." Tied to `frac`, the same scroll-driven progress
    // already moving the drop (set just above, every branch of the phase
    // if/else), rather than the drop's own screen position — a straight
    // read of "as they scroll," and it sweeps through every layer in a
    // single predictable pass rather than following the drop's own small
    // vertical wobble. Each layer just crossfades its sharp/blurred bake
    // by how far its own fixed z sits from that moving focus depth.
    if (depthLayers.length) {
      const focusZ = FOCUS_NEAR + (FOCUS_FAR - FOCUS_NEAR) * frac;
      const range = Math.abs(FOCUS_FAR - FOCUS_NEAR);
      depthLayers.forEach(layer => {
        const dist = Math.abs(layer.z - focusZ);
        const blurAmt = Math.min(1, Math.max(0, (dist - FOCUS_BAND) / (range - FOCUS_BAND)));
        layer.sharpMat.opacity = 1 - blurAmt;
        layer.blurMat.opacity = blurAmt;
      });
    }

    renderer.render(scene, camera);
    clippedPreview?.blit();
  }
  animate();

  // Was two raw window.addEventListener('resize'/'orientationchange', ...)
  // calls, with the same 0-size-container guard bindGuardedResize already
  // centralizes — and a real bug: the orientationchange listener was an
  // inline arrow function, so dispose()'s
  // `removeEventListener('orientationchange', onResize)` was removing a
  // DIFFERENT function reference than the one actually added, silently
  // leaking a stale listener (holding this whole scene's closure — camera,
  // renderer, container) every single time this scene was opened and
  // closed. bindGuardedResize's own dispose() keeps the real references,
  // so this can't happen.
  const resize = bindGuardedResize(container, (nw, nh) => {
    const na = nw / nh;
    camera.left = -viewH * na;
    camera.right = viewH * na;
    camera.top = viewH;
    camera.bottom = -viewH;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
    layoutLeaf();
  });

  return {
    dispose() {
      cancelAnimationFrame(animId);
      resize.dispose();
      renderer.dispose();
      clippedPreview?.dispose();
      backdropGeo.dispose();
      skyMat.dispose(); skyTex.dispose();
      depthLayers.forEach(l => {
        l.sharpMat.dispose(); l.blurMat.dispose();
        l.sharpTex.dispose(); l.blurTex.dispose();
      });
      groundGeo.dispose(); groundMat.dispose();
      leaf.geo.dispose(); leaf.mat.dispose(); leaf.tex.dispose();
      leaf.veinGeo.dispose(); leaf.veinMat.dispose();
      leaf.sideVeins.forEach(l => l.geometry.dispose());
      dropTex.dispose(); dropMat.dispose();
      moteTex.dispose();
      motes.forEach(m => m.mat.dispose());
      if (caption && caption._updateTargetFromScroll) {
        window.removeEventListener('resize', caption._updateTargetFromScroll);
      }
      if (caption && caption._updatePhaseFractions) {
        window.removeEventListener('resize', caption._updatePhaseFractions);
      }
      if (caption) caption.remove();
      if (hint) hint.remove();
      if (grain) grain.remove();
      renderer.domElement.remove();
    }
  };
}
