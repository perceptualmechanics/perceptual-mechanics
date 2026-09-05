import * as THREE from 'three';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, bindTapVsDrag,
  prefersReducedMotion, parseHTML, mountClippedPreviewCanvas, createJumpList,
  bindPersistedSoundToggle, manageRenderer, createFrameClock, trackTimers,
} from '../../utils/sceneKit.js';
import { POWER_SOURCES, CENTER_ORIGINS, NEWEST_ORIGINS } from './outside.text.js';
import outsideHtml from './outside.html?raw';
import './outside.css';

// ─── Outside — round 3, a floral cosmology map (2026-08-24) ────────────────
// Full pivot, not another correction on the retired build: the 7-vs-11
// OER/Apherion projection thesis (real 11D vectors, two 3x11 projection
// matrices, a drifting basis) is gone entirely — Scott's call after seeing
// it live twice, that the underlying idea belonged in a different register
// than this scene should occupy. What replaces it: a real, generated flower
// — a lotus floating in violet space — mapping the five Power Sources (each
// a petal) and their Folk Origins, with Magi and Psi (the one cross-cutting
// Origin axis that isn't anchored to any single Power Source) as the
// center, not a sixth petal. See outside.text.js's own header for exactly
// where every name comes from.
//
// ─── The geometry, in outline ───────────────────────────────────────────────
// Each petal is a real generated surface, not a flat decal: a local (u, w)
// grid — u = fraction along the petal's length (0 at the receptacle, 1 at
// the tip), w = fraction of the petal's width (-1..1) — mapped through a
// rose-curve-family width profile (halfWidth(u) = maxHalfWidth *
// sin(pi*u^0.75)^0.85, the sin(pi*u) shape being the classic single-lobe
// member of the same superformula/rose-curve family the retired build's own
// header explained) that pinches to a true point at both u=0 and u=1 — a
// real petal silhouette, not a flat ellipse or a starfish arm (an actual
// Gielis-superformula polar curve for the WHOLE five-lobed outline was
// tried first and rendered — verified with a rendered PNG, not eyeballed
// blind — as a five-pointed star with a pinched waist between each point,
// not a lotus; five separately-lofted petal lobes, each its own member of
// the same curve family, is what actually reads as a flower). Height
// arches upward from base to tip (z(u) = height * sin(pi/2 * u^0.9)),
// giving every petal real cupped dimensionality rather than sitting flat.
//
// Five simple petals (Gabriel, Michael, Raphael, Emmanuel) sit at the
// five-fold angles (72 degrees apart); Nature's petal is a compound
// cluster of THREE smaller lobes fanned within its own 72-degree sector —
// Nature is already established in the notes as a trine (three Folk
// Origins on one Power Source), and a cluster of three attached lobes
// renders that as real asymmetry in the geometry itself, not a uniform
// fifth petal with extra decoration. Verified with a rendered PNG before
// writing any Three.js code: reads immediately as "one fuller, denser
// petal-cluster" against the four simple petals.
//
// Magi and Psi sit on a small gold seedpod dome at the center — a real
// botanical fact, not a stretched metaphor: actual lotus flowers (Nelumbo
// nucifera) have a gold-green seed receptacle at the center of
// violet-pink petals. The void itself is a deep violet-black rather than
// neutral, and a soft violet nebular glow sits behind the flower, using
// the same clustered-clump-and-filament technique Harmonics' own backdrop
// uses (harmonics.js's buildGalaxy), recolored into this scene's own
// register rather than Harmonics' Hubble red/blue.
//
// ─── Ambient motion ──────────────────────────────────────────────────────
// No auto-rotation of any kind — per the brief, a rigid geometric spin is
// exactly the wrong register for this subject (that was the retired
// scene's own drift mechanism). Instead the whole flower breathes: a slow,
// smooth global scale/arch cycle (breathePhase, below) plus a slightly
// faster, independently-phased sway per petal, running unconditionally —
// the sole source of ambient motion, on its own, regardless of
// interaction. Camera orbit is real and user-driven only (drag rotates a
// standard spherical camera around the flower, clamped so it can't flip
// through the poles); nothing auto-rotates the view.
//
// ─── Sound ───────────────────────────────────────────────────────────────
// Originally a breath-synced pad (one soft sine pair through a shared
// lowpass filter) — replaced in a later pass because a held drone reads
// as a hum no matter how its volume is trimmed. Now a generative ambient
// chime layer: individual Kumoi-pentatonic tones trigger stochastically
// (never on a fixed interval), with the *rate* of triggering — not a
// continuous tone's volume — tracking breathePhase(t), so the tie to the
// same signal driving the geometry survives the redesign. See the "Sound"
// section below for the scale choice, coordination against the five petal
// chimes, and an honest caveat about Kumoi's own semitone/tritone.
//
// ─── Touch ───────────────────────────────────────────────────────────────
// Touching anywhere on the flower's real surface (raycast against the
// actual petal/seedpod meshes, not proxy points) triggers a soft pulse of
// light that travels outward from the touched point across the surface —
// the same genuine distance/time wavefront math the retired build used
// (pulseWave, below), adapted from sparse graph edges to a continuous
// mesh. No text, no panel — the entire response is light moving across a
// real surface.
//
// ─── Round 4 — translucency + per-petal chimes (2026-08-24) ────────────────
// Refinement on the shipped v3.5.0 lotus, not another correction pass.
// Two additions:
//
// Petal translucency now uses a real Fresnel term (makePetalMaterial,
// below) rather than a flat opacity value — MeshStandardMaterial's own
// compiled shader is patched via onBeforeCompile (not swapped for a
// heavier custom ShaderMaterial) so lighting/vertex-color handling stay
// exactly as-is; only the final alpha and a small edge-glow boost are
// driven by pow(1 - |view·normal|, fresnelPower). Reads as glassy/thin
// through the face of each petal, brighter and more solid right at the
// silhouette edge — the actual visual signature of translucent petals,
// not a uniform see-through wash.
//
// Each petal now plays its own chime on touch (triggerChime, in the Sound
// section below), grounded in what this session already established about
// that Power Source rather than five arbitrary notes: Michael gets a pure
// overtone-free sine (his own "polished beyond all reason" endpoint, in
// audio); Gabriel gets a real downward frequency ramp (Portable Hell's
// whole shape is descent); Raphael gets two barely-detuned tones that
// shimmer rather than separate (reusing the retired build's own beat-
// frequency technique, repurposed — Antimatter Bottle contains two things
// that would annihilate if they touched); Emmanuel gets a long reverb-
// tailed low tone through a synthesized convolution impulse (gravitational
// scale, not a pluck); Nature's compound petal drives its pitch jitter off
// a real logistic map (r=3.9, seeded fresh each trigger) rather than a
// fixed "chaotic-sounding" run, so it's genuinely different every time,
// not just metaphorically chaotic. The gold seedpod (Magi/Psi) stays
// silent on touch — confirmed explicitly via an AskUserQuestion, not
// assumed — the same "reads as the thing that isn't a petal" logic that
// put it at the center rather than as a sixth petal in round 3.

const TWO_PI = Math.PI * 2;

function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const cx = c.getContext('2d');
  const g = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = g;
  cx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

// ─── Round 6 — seam/vein texture. One canvas texture doing two jobs, per
// the brief: faint vein-line surface detail across the whole petal, and a
// warm gold glow concentrated at v=0 (the root, where flat petal geometry
// meets the spherical pod — a real geometric seam, since a sphere and a
// flat plane can only ever touch along a thin contact line). Sampled via
// emissiveMap with emissive forced to white (see makePetalMaterial) so the
// texture's own painted colors carry straight through as additive light,
// unconstrained by any base material tint — the base violet fill baked
// into this texture IS the petal's ambient emissive (replacing the old
// flat color), not a mask multiplied against it. uv.y follows u (0=root,
// 1=tip, see buildPetalTopology's uvArr below); uv.x follows w (width). ──
function makeSeamVeinTexture() {
  const w = 96, h = 320;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d');
  const baseR = 42, baseG = 18, baseB = 80; // the old flat emissive (0x2a1250), now baked in directly
  const goldR = 255, goldG = 205, goldB = 120;
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    const goldT = Math.max(0, 1 - v / 0.32); // fully faded by v~0.32 — wide enough to cover the contact line at normal viewing distance, not just a thin rim
    const ease = goldT * goldT * (3 - 2 * goldT); // smoothstep
    const r = baseR + (goldR - baseR) * ease;
    const g = baseG + (goldG - baseG) * ease;
    const b = baseB + (goldB - baseB) * ease;
    cx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
    cx.fillRect(0, y, w, 1);
  }
  // Faint veins fanning from the root toward the tip — the surface-detail
  // half of this texture's double duty.
  cx.strokeStyle = 'rgba(255,255,255,0.10)';
  cx.lineWidth = 1.5;
  const veinCount = 6;
  for (let i = 0; i < veinCount; i++) {
    const x1 = w * (0.12 + (i / (veinCount - 1)) * 0.76);
    cx.beginPath();
    cx.moveTo(w * 0.5, 0);
    cx.quadraticCurveTo(w * 0.5, h * 0.35, x1, h);
    cx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  // flipY defaults to TRUE on every three.js texture, which turned this one
  // upside down on upload: the gold seam glow painted at canvas y=0 arrived
  // at uv.y=1, so it rendered at the petal TIP, and the veins converged at
  // the tip instead of fanning from the root. Which is the opposite of the
  // whole idea — the seam is where flat petal geometry meets the spherical
  // pod, and that is at the root.
  tex.flipY = false;
  // And the canvas is painted in sRGB. Without this it uploads as though its
  // values were already linear, so every colour in it reads far brighter than
  // painted — between 3.4x and 11.7x across this texture's range, worst on
  // the darkest violets, which is most of its area. The base violet fill in
  // here IS the petal's ambient emissive, so that was not a subtle error.
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─── Compact 2D simplex noise — the standard permutation/gradient
// algorithm (Perlin's simplex method), written out directly rather than
// pulled from a dependency (none is in package.json). Used only by the
// background curtains below, driving their displacement instead of a sine
// wave: noise reads as air movement, a sine wave reads as mechanical
// waving, and that distinction is the entire point of using it. Each
// caller gets its own seeded permutation table (small xorshift PRNG) so
// multiple curtains don't all billow in lockstep. ─────────────────────────
function makeSimplex2D(seed) {
  let s = (seed >>> 0) || 1;
  function rand() {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  }
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad2 = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return function noise2D(xin, yin) {
    const sk = (xin + yin) * F2;
    const i = Math.floor(xin + sk), j = Math.floor(yin + sk);
    const t = (i + j) * G2;
    const X0 = i - t, Y0 = j - t;
    const x0 = xin - X0, y0 = yin - Y0;
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) { t0 *= t0; const g = grad2[perm[ii + perm[jj]] % 8]; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) { t1 *= t1; const g = grad2[perm[ii + i1 + perm[jj + j1]] % 8]; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) { t2 *= t2; const g = grad2[perm[ii + 1 + perm[jj + 1]] % 8]; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 70 * (n0 + n1 + n2); // roughly -1..1
  };
}

// ─── Shared petal topology — every petal (the four simple ones and
// Nature's three sub-lobes) uses the same (u, w) grid and triangle
// index buffer; only the per-instance length/width/height/angle/color
// differ, applied fresh each frame (see updatePetal, below). ────────────
const U_SEGS = 16, W_SEGS = 9;
function buildPetalTopology() {
  const count = U_SEGS * W_SEGS;
  const uArr = new Float32Array(count), wArr = new Float32Array(count);
  const uvArr = new Float32Array(count * 2); // static per (u,w) — shared across every petal instance, same as indices
  for (let iu = 0; iu < U_SEGS; iu++) {
    const u = iu / (U_SEGS - 1);
    for (let iw = 0; iw < W_SEGS; iw++) {
      const w = (iw / (W_SEGS - 1)) * 2 - 1;
      const i = iu * W_SEGS + iw;
      uArr[i] = u; wArr[i] = w;
      uvArr[i * 2] = (w + 1) * 0.5; // texture U — petal width
      uvArr[i * 2 + 1] = u;         // texture V — 0 at root (pod seam), 1 at tip
    }
  }
  const idx = [];
  for (let iu = 0; iu < U_SEGS - 1; iu++) {
    for (let iw = 0; iw < W_SEGS - 1; iw++) {
      const a = iu * W_SEGS + iw, b = (iu + 1) * W_SEGS + iw;
      const c = (iu + 1) * W_SEGS + (iw + 1), d = iu * W_SEGS + (iw + 1);
      idx.push(a, b, d, b, c, d);
    }
  }
  return { uArr, wArr, uvArr, indices: new Uint16Array(idx), count };
}

// The petal's own local shape — the width profile is the sin(pi*u) rose-
// curve member of the same superformula family the retired build used for
// its 11D basis, restricted to one lobe instead of the whole five-fold
// curve (see header comment for why the whole-curve version reads as a
// starfish, not a flower). Pinches to an exact point at u=0 and u=1.
function petalHalfWidth(u) {
  return Math.pow(Math.sin(Math.PI * Math.pow(u, 0.75)), 0.85);
}
function petalHeightProfile(u, w) {
  return Math.sin((Math.PI / 2) * Math.pow(u, 0.9)) * (1 - 0.05 * Math.abs(w));
}

export function createOutside(container, { preview = false, initialPieceId = null } = {}) {
  const w0 = container.clientWidth || window.innerWidth;
  const h0 = container.clientHeight || window.innerHeight;
  const SCALE = preview ? 90 : 150;
  const SCALE_FACTOR = SCALE / 150;

  // Set as the very first thing dispose() does; see setSoundEnabled below for
  // the bug this exists to close.
  let disposed = false;
  const timers = trackTimers();
  // Two clocks on purpose. `elapsed` (below) is the MOTION clock — it stops
  // dead under reduced motion, which is what freezes the breathing and the
  // sway. This one always advances, and the touch pulse runs off it: with the
  // pulse keyed to `elapsed`, `elapsed - pulseStart` was permanently 0 under
  // reduced motion, so it never exceeded PULSE_DURATION, pulseActive never
  // cleared, and a +0.55 bright spot plus a boosted pod emissive sat on the
  // flower forever — each new touch relocating the frozen blob rather than
  // clearing it. A pulse has to be able to end. (What the pulse LOOKS like
  // under reduced motion is a separate decision — see pulseBoostAt.)
  const clock = createFrameClock();

  const scene = new THREE.Scene();
  const BG_COLOR = 0x0d0518; // deep violet-black, not neutral — keeps the site's space-scene identity while staying this scene's own register
  scene.background = new THREE.Color(BG_COLOR);
  scene.fog = new THREE.FogExp2(BG_COLOR, 0.85 / (SCALE * 2.6));

  // ─── Camera — a real spherical orbit around a fixed flower, not a
  // basis rotation. Default sits at a 3/4-elevated angle (tested against a
  // rendered mockup at the same elevation before committing) so the
  // petals' own arch reads immediately, not a flat overhead view. ────────
  const CAM_DEFAULT = SCALE * 2.35;
  const CAM_MIN = SCALE * 1.25, CAM_MAX = SCALE * 4.2;
  const POLAR_MIN = 0.22, POLAR_MAX = 2.35; // radians from +Y — clamped short of either pole
  let azimuth = 0.35, polar = 1.08, camDist = CAM_DEFAULT; // ~28deg elevation by default
  const camera = new THREE.PerspectiveCamera(46, w0 / h0, 0.1, CAM_MAX * 3);
  function updateCameraPosition() {
    const sp = Math.sin(polar), cp = Math.cos(polar);
    camera.position.set(camDist * sp * Math.sin(azimuth), camDist * cp, camDist * sp * Math.cos(azimuth));
    camera.lookAt(0, 0, 0);
  }
  updateCameraPosition();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  // Pixel ratio through manageRenderer rather than raw window.devicePixelRatio
  // (v4.0) — this scene draws 7 double-sided Fresnel MeshStandardMaterial
  // petals, 2,400 additive nebula points and 3 very large billboarded
  // additive curtain planes, so an uncapped DPR-3 phone was shading nine
  // times the fragments the look was tuned against. manageRenderer also owns
  // the real GL-context release and the webglcontextlost handler; see its own
  // comment in sceneKit.js.
  const managedRenderer = manageRenderer(renderer);
  renderer.setSize(w0, h0);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  // Preview tiles: never append the WebGL canvas itself — see
  // mountClippedPreviewCanvas's own comment in sceneKit.js. A heavy WebGL
  // canvas gets promoted to its own GPU compositing layer in Firefox and
  // ignores the tile's clip-path/border-radius entirely, so the preview
  // renders as a square instead of the circle every other tile shows
  // (already hit and fixed this way for orrery and beamline). Full scene
  // is unaffected (no circular tile there), so it keeps the plain direct
  // append it always had.
  const clippedPreview = preview ? mountClippedPreviewCanvas(container, renderer) : null;
  if (!preview) container.appendChild(renderer.domElement);
  // No `container.tabIndex = -1` here: main.js:359 already sets tabindex="-1"
  // on #experience-container when it opens a scene, so this was a second
  // place to keep in agreement with no second effect.

  // ─── Lighting — key/rim/hemisphere, same convention Orbiter/Library/
  // Beamline use for their own lit meshes, tinted to this scene's palette
  // so the petals' real curvature (the arch, the cupping) actually reads
  // through shading gradients rather than flat color alone. ──────────────
  scene.add(new THREE.HemisphereLight(0x6a4fd8, 0x0a0510, 0.7));
  scene.add(new THREE.AmbientLight(0x2a1f45, 0.6));
  const keyLight = new THREE.DirectionalLight(0xffe6c2, 0.85);
  keyLight.position.set(SCALE * 0.8, SCALE * 1.4, SCALE * 1.2);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x8a6fff, 0.45);
  rimLight.position.set(-SCALE * 1.1, SCALE * 0.4, -SCALE * 1.3);
  scene.add(rimLight);

  const dotTex = makeDotTexture();

  // ─── Deep field — sparse stars, further out than the nebula below. ─────
  const starCount = preview ? 220 : 650;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = SCALE * (3.4 + Math.random() * 2.2);
    const th = Math.random() * TWO_PI, ph = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    starPos[i * 3 + 2] = r * Math.cos(ph);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0x9a8ccf, size: 0.75 * SCALE_FACTOR, transparent: true, opacity: 0.4, sizeAttenuation: true, fog: false });
  scene.add(new THREE.Points(starGeo, starMat));

  // ─── Soft violet nebular glow — Harmonics' own clustered-clump +
  // filament technique (harmonics.js's buildGalaxy), recolored into this
  // scene's violet-magenta register instead of Harmonics' H-alpha/O-III
  // Hubble palette. Independent clumps with their own hue bias, connected
  // by sparse wisps, genuinely 3D — same reasoning as Harmonics' own
  // header comment for why a single clean curve reads as "a diagram," not
  // real gravitational structure. ─────────────────────────────────────────
  function buildNebula(rMin, rMax) {
    const count = preview ? 900 : 2400;
    const clusterCount = preview ? 5 : 10;
    const filamentFraction = 0.3;
    const coreColor = new THREE.Color(0xd268ff); // warm magenta-violet
    const armColor = new THREE.Color(0x4a35a8);  // cool deep violet-blue
    function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }
    const clusters = [];
    for (let k = 0; k < clusterCount; k++) {
      const r = rMin + Math.random() * (rMax - rMin);
      const th = Math.random() * TWO_PI, ph = Math.acos(2 * Math.random() - 1);
      clusters.push({
        center: new THREE.Vector3(r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th) * 0.7, r * Math.cos(ph)),
        spread: (rMax - rMin) * (0.1 + Math.random() * 0.18),
        hueBias: Math.random(),
      });
    }
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      let x, y, z, blend;
      if (clusters.length >= 2 && Math.random() < filamentFraction) {
        const a = clusters[(Math.random() * clusters.length) | 0];
        let b = clusters[(Math.random() * clusters.length) | 0];
        for (let tries = 0; b === a && tries < 5; tries++) b = clusters[(Math.random() * clusters.length) | 0];
        const t = Math.random(), jitter = (rMax - rMin) * 0.04;
        x = THREE.MathUtils.lerp(a.center.x, b.center.x, t) + gauss() * jitter;
        y = THREE.MathUtils.lerp(a.center.y, b.center.y, t) + gauss() * jitter;
        z = THREE.MathUtils.lerp(a.center.z, b.center.z, t) + gauss() * jitter;
        blend = THREE.MathUtils.lerp(a.hueBias, b.hueBias, t);
      } else {
        const cl = clusters[(Math.random() * clusters.length) | 0];
        x = cl.center.x + gauss() * cl.spread;
        y = cl.center.y + gauss() * cl.spread;
        z = cl.center.z + gauss() * cl.spread;
        blend = THREE.MathUtils.clamp(cl.hueBias + gauss() * 0.15, 0, 1);
      }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      c.copy(armColor).lerp(coreColor, blend).multiplyScalar(0.55 + Math.random() * 0.3);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: (preview ? 1.6 : 2.1) * SCALE_FACTOR, vertexColors: true, transparent: true,
      opacity: 0.5, depthWrite: false, sizeAttenuation: true, fog: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.rotation.x = 0.25; points.rotation.z = 0.12;
    return { points, geo, mat };
  }
  const nebula = buildNebula(SCALE * 1.5, SCALE * 3.1);
  scene.add(nebula.points);

  // ─── Background curtains — gauzy translucent planes, folded into the
  // same layered-glow lineage as the nebula above (violet family,
  // additive, soft-edged) rather than built as a separate system. A few
  // large soft-edged planes sit at different depths/azimuths around the
  // flower, billboarded to the camera every frame so they always face the
  // viewer regardless of orbit angle — orbiting then produces real
  // parallax BETWEEN the planes themselves (not just against the flower),
  // since each sits at a genuinely different distance from the origin.
  // Displacement is 2D simplex noise sampled per-vertex over time, not a
  // sine wave — noise reads as air movement, sine reads as mechanical
  // waving, and that distinction is the entire effect (see
  // makeSimplex2D's own header for why). ──────────────────────────────────
  function makeCurtainTexture(hue) {
    const s = 128;
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const cx = c.getContext('2d');
    const col = new THREE.Color().setHSL(hue, 0.55, 0.6);
    const r = Math.round(col.r * 255), g = Math.round(col.g * 255), b = Math.round(col.b * 255);
    const grad = cx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.85)`);
    grad.addColorStop(0.55, `rgba(${r},${g},${b},0.32)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    cx.fillStyle = grad;
    cx.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
  }
  // Placed opposite the scene's own default camera azimuth (not scattered
  // at arbitrary angles) so at least some curtains sit "behind the flower"
  // as actually framed on load, per the brief — verified this by hand
  // against the camera's own FOV/position math the first time through:
  // the original arbitrary azimuths (1.05, -0.55, 2.35 rad) put every
  // curtain outside the camera's ~47deg diagonal FOV at the default view,
  // so nothing rendered until orbited nearly all the way around.
  //
  // Radii all sit well beyond CAM_MAX (SCALE*4.2) on purpose — caught live
  // on the first pass: with a curtain closer than the camera's own max
  // orbit distance, rotating toward it could put the camera nearer to the
  // plane than its own size, and a large billboarded plane that close
  // fills the entire viewport with a flat wash of color, reading as a
  // glitch rather than a backdrop. Pushing every radius past CAM_MAX means
  // the camera can never get closer to a curtain than its own size,
  // regardless of zoom or orbit angle.
  const CURTAIN_BACK_AZ = azimuth + Math.PI;
  const CURTAIN_CONFIGS = [
    { az: CURTAIN_BACK_AZ - 0.32, polar: 0.95, r: SCALE * 4.4, w: SCALE * 4.6, h: SCALE * 5.4, hue: 0.78, opacity: 0.65, seed: 11 },
    { az: CURTAIN_BACK_AZ + 0.18, polar: 1.15, r: SCALE * 4.9, w: SCALE * 4.8, h: SCALE * 5.6, hue: 0.71, opacity: 0.48, seed: 47 },
    { az: CURTAIN_BACK_AZ + 0.6, polar: 1.35, r: SCALE * 5.4, w: SCALE * 5.0, h: SCALE * 5.8, hue: 0.85, opacity: 0.38, seed: 83 },
  ];
  const curtainPlanes = CURTAIN_CONFIGS.map(cfg => {
    const geo = new THREE.PlaneGeometry(cfg.w, cfg.h, 7, 5);
    const base = geo.attributes.position.array.slice(); // undisturbed local positions — the noise displacement below is always relative to these, never cumulative
    const tex = makeCurtainTexture(cfg.hue);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: cfg.opacity, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const sp = Math.sin(cfg.polar), cp = Math.cos(cfg.polar);
    mesh.position.set(cfg.r * sp * Math.sin(cfg.az), cfg.r * cp, cfg.r * sp * Math.cos(cfg.az));
    scene.add(mesh);
    return { mesh, geo, mat, tex, base, noise: makeSimplex2D(cfg.seed), driftSpeed: 0.02 + Math.random() * 0.01 };
  });

  // ═══ THE FLOWER ═══════════════════════════════════════════════════════
  const topo = buildPetalTopology();
  const BASE_LENGTH = SCALE * 0.95, BASE_WIDTH = SCALE * 0.30, BASE_HEIGHT = SCALE * 0.38;

  // Round 5 fix — the original pivot brief asked for "related-but-distinct
  // shades within one violet-to-magenta-to-lavender family," but the first
  // pass (hue 0.74-0.88, one shared saturation of 0.6 for every petal) read
  // close to uniform: too narrow a hue band, and no saturation contrast to
  // help the eye separate them. Widened to evenly-spaced steps across the
  // full safe range of that family (roughly 240deg-345deg — cool lavender
  // through violet to deep pink, staying clear of true blue on one end and
  // true red on the other) and paired each with its own saturation, so hue
  // AND saturation both carry identity rather than hue alone doing all the
  // work in a cramped band.
  const PETAL_HUE = [0.803, 0.669, 0.869, 0.736]; // Gabriel, Michael, Raphael, Emmanuel
  const PETAL_SAT = [0.65, 0.42, 0.58, 0.78]; // Michael desaturated/cool ("glossy, tempered"); Emmanuel deepest/most saturated ("gravitational")
  const NATURE_SUB_HUE = [0.92, 0.94, 0.96]; // Nature's own three sub-lobes — its own richer plum/rose corner of the family, distinct from all four simple petals
  const NATURE_SUB_SAT = 0.6;
  const GOLD_HUE = 0.115;

  // Petal material — real MeshStandardMaterial so the arch/cup catches
  // the key/rim lights above; vertexColors carries the per-petal hue and
  // the base-to-tip gradient; a low uniform emissive keeps petals from
  // going fully black in shadow, matching the site's glowing-cosmic-
  // subject convention elsewhere (Beamline's vessel, Orbiter's cloud).
  //
  // Translucency is Fresnel-driven, not flat opacity (round 4,
  // 2026-08-24) — flat opacity reads thin/synthetic; real translucent
  // organic material (petals, leaves, skin) is most transparent straight
  // through the face and brightest/most opaque at grazing edges, because
  // that's where light reflects off the surface rather than passing
  // through it. `onBeforeCompile` patches the standard shader with a
  // real Fresnel term (view direction vs. surface normal) driving both
  // the alpha (mix faceAlpha -> edgeAlpha) and a small edge-glow color
  // boost — the same shader three.js already compiles for lighting, not
  // a heavier custom material.
  //
  // Round 5: the same rim mechanism is reused (not a second visual
  // language) for hover/proximity — whichever petal the cursor is over
  // gets its own fresnelGlow uniform boosted above BASE_FRESNEL_GLOW, a
  // "this one" cue before the petal is actually touched. See hoveredInst
  // and the pointermove listener below, and the hover-glow lerp inside
  // updatePetal.
  const BASE_FRESNEL_GLOW = 0.4, HOVER_FRESNEL_BOOST = 0.75, HOVER_LERP_RATE = 0.15;
  // Round 6 — the flat emissive color above is replaced by the seam/vein
  // texture (makeSeamVeinTexture, module scope): emissive is forced to
  // white so emissiveMap's own painted RGB carries straight through as
  // the petal's ambient glow, letting the texture bake in both the old
  // uniform violet fill AND a warm gold boost concentrated at the root —
  // the same texture doing the seam-blending job the brief asks for,
  // rather than a second element layered on top of an unresolved seam.
  const seamVeinTex = makeSeamVeinTexture();
  function makePetalMaterial() {
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.06,
      transparent: true, depthWrite: false,
      emissive: new THREE.Color(0xffffff), emissiveIntensity: 1, emissiveMap: seamVeinTex,
    });
    mat.onBeforeCompile = shader => {
      shader.uniforms.fresnelPower = { value: 2.3 };
      shader.uniforms.fresnelGlow = { value: BASE_FRESNEL_GLOW };
      shader.uniforms.faceAlpha = { value: 0.5 };
      shader.uniforms.edgeAlpha = { value: 1.0 };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `
          #include <common>
          uniform float fresnelPower;
          uniform float fresnelGlow;
          uniform float faceAlpha;
          uniform float edgeAlpha;
        `)
        .replace('#include <dithering_fragment>', `
          float pmFresnel = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), fresnelPower);
          gl_FragColor.rgb += pmFresnel * fresnelGlow;
          gl_FragColor.a = mix(faceAlpha, edgeAlpha, pmFresnel);
          #include <dithering_fragment>
        `);
      mat.userData.shader = shader;
    };
    return mat;
  }

  // One petal "instance": its own geometry/buffers (topology shared, only
  // positions/colors are per-instance), plus the parameters updatePetal
  // needs every frame (angle, base dimensions, hue, breathing phase).
  function makePetalInstance({ angle, length, halfWidth, height, hue, sat, swayIndex, psIndex }) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(topo.count * 3);
    const col = new Float32Array(topo.count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(topo.uvArr, 2)); // static, shared read-only across every instance — same reasoning as topo.indices
    geo.setIndex(new THREE.BufferAttribute(topo.indices, 1));

    // ── Per-vertex base colour, computed once here (v4.0) ────────────────
    // updatePetal used to call tmpColor.setHSL(hue, sat, lerp(0.32,0.66,u))
    // per vertex per frame — 144 setHSL calls per petal, 1,008 per frame
    // across the flower, at 60fps. Hue and saturation are constants of the
    // instance and lightness is a function of `u` alone, which takes exactly
    // U_SEGS (16) distinct values across the grid — so those 144 calls were
    // recomputing the same 16 RGB triples nine times over, every frame,
    // forever. Sixteen conversions here, expanded across the grid once.
    const uColor = new Float32Array(U_SEGS * 3);
    const seed = new THREE.Color();
    for (let iu = 0; iu < U_SEGS; iu++) {
      seed.setHSL(hue, sat, THREE.MathUtils.lerp(0.32, 0.66, iu / (U_SEGS - 1)));
      uColor[iu * 3] = seed.r; uColor[iu * 3 + 1] = seed.g; uColor[iu * 3 + 2] = seed.b;
    }
    const baseCol = new Float32Array(topo.count * 3);
    for (let i = 0; i < topo.count; i++) {
      const src = ((i / W_SEGS) | 0) * 3; // topology lays vertices out as iu * W_SEGS + iw
      baseCol[i * 3] = uColor[src]; baseCol[i * 3 + 1] = uColor[src + 1]; baseCol[i * 3 + 2] = uColor[src + 2];
    }
    col.set(baseCol);
    geo.attributes.color.needsUpdate = true;

    // ── Analytic bounding sphere (v4.0) ──────────────────────────────────
    // computeBoundingSphere() was called every frame per petal — a second
    // full 144-vertex sweep on top of computeVertexNormals' own, purely
    // because the breathing moves real vertices and a stale sphere could make
    // a touch miss near a petal's edge (the original comment's reasoning,
    // which is correct). But the bound is available in closed form: every
    // vertex has localX in [0,length], |localY| <= halfWidth and y in
    // [0,height], and the mesh sits at the origin with an identity transform,
    // so a sphere at the origin of radius hypot(length, halfWidth, height)
    // contains all of them by construction — conservative, never stale, and
    // three multiplies instead of a sweep. Raycasting still does the real
    // triangle test inside it, so a slightly generous sphere costs nothing.
    const boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), Math.hypot(length, halfWidth, height));
    geo.boundingSphere = boundingSphere;

    const mat = makePetalMaterial();
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    return {
      angle, cosA: Math.cos(angle), sinA: Math.sin(angle),
      length, halfWidth, height, hue, sat, swayIndex, psIndex, hoverGlow: 0,
      // The breathing-scaled length/height for THIS frame. Initialised here
      // (v4.0) rather than first written inside animate(): the jump list is
      // built during setup, before the first rAF, so activating a jump-list
      // button inside that window read undefined out of both, gave
      // anchorWorldPos NaN coordinates, and made pulseOrigin NaN — which then
      // turned every petal's colour NaN for the pulse's whole duration.
      // Near-unhittable, but a genuine uninitialised read. The values below
      // are the unbreathed rest pose, which is exactly what frame zero
      // computes anyway.
      _curLength: length, _curHeight: height,
      geo, pos, col, baseCol, boundingSphere, mat, mesh,
    };
  }

  const petalInstances = [];
  POWER_SOURCES.forEach((_ps, pi) => {
    const angle = (TWO_PI * pi) / 5;
    if (pi < 4) {
      petalInstances.push(makePetalInstance({
        angle, length: BASE_LENGTH, halfWidth: BASE_WIDTH, height: BASE_HEIGHT,
        hue: PETAL_HUE[pi], sat: PETAL_SAT[pi], swayIndex: pi, psIndex: pi,
      }));
    } else {
      // Nature's compound cluster — three smaller lobes fanned within its
      // own sector, real asymmetry rather than one uniform fifth petal.
      const spread = 0.255; // radians, ~14.6deg either side — comfortably inside the 72deg sector
      const subOffsets = [-spread, 0, spread];
      const subLenScale = [0.72, 0.82, 0.72];
      const subWidScale = [0.62, 0.72, 0.62];
      const subHeightScale = [0.85, 0.95, 0.85];
      subOffsets.forEach((off, si) => {
        petalInstances.push(makePetalInstance({
          angle: angle + off, length: BASE_LENGTH * subLenScale[si], halfWidth: BASE_WIDTH * subWidScale[si],
          height: BASE_HEIGHT * subHeightScale[si], hue: NATURE_SUB_HUE[si], sat: NATURE_SUB_SAT, swayIndex: 4 + si * 0.4, psIndex: 4,
        }));
      });
    }
  });
  const NATURE_CLUSTER_START = 4; // petalInstances[4..6] are Nature's three sub-lobes

  // ─── Center seedpod — Magi/Psi's dome. Real botanical fact: lotus
  // flowers have a gold-green seed receptacle at the center of
  // violet-pink petals; this isn't a stretched metaphor, it's what one
  // actually looks like, and it already matches this structure. ─────────
  const podGeo = new THREE.SphereGeometry(SCALE * 0.15, 20, 14);
  podGeo.scale(1, 0.82, 1);
  const podMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(GOLD_HUE, 0.7, 0.52), roughness: 0.42, metalness: 0.18,
    emissive: new THREE.Color().setHSL(GOLD_HUE, 0.8, 0.18), emissiveIntensity: 0.55,
  });
  const podMesh = new THREE.Mesh(podGeo, podMat);
  podMesh.position.set(0, SCALE * 0.07, 0);
  scene.add(podMesh);

  const pickTargets = [...petalInstances.map(p => p.mesh), podMesh];

  // ─── Landmark points — Power Sources (5, at petal tips), Folk Origins
  // (7, nested along their petal), Magi/Psi (2, on the seedpod). Same
  // point+halo convention every sparse landmark on this site uses (a
  // second, larger, lower-opacity additive layer sharing the same
  // buffers) — a handful of bare points read as faint specks otherwise. ──
  function makePointGroup(count, size, haloSize, haloOpacity) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: size * SCALE_FACTOR, map: dotTex, vertexColors: true, transparent: true,
      opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    const haloMat = new THREE.PointsMaterial({
      size: haloSize * SCALE_FACTOR, map: dotTex, vertexColors: true, transparent: true,
      opacity: haloOpacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false,
    });
    const halo = new THREE.Points(geo, haloMat);
    scene.add(halo);
    return { geo, pos, col, mat, points, haloMat, halo };
  }

  const psPoints = makePointGroup(5, preview ? 3.4 : 4.0, preview ? 9 : 11, 0.34);
  const originPoints = makePointGroup(7, preview ? 2.6 : 3.0, preview ? 7.5 : 9, 0.3);
  const centerPoints = makePointGroup(CENTER_ORIGINS.length, preview ? 3.0 : 3.5, preview ? 8 : 10, 0.36);

  // A faint extra glow marking Tempered and Psychopomps — the newest two
  // Origins in the whole cosmology (see outside.text.js). Optional detail:
  // its own small point group (NOT sharing originPoints' buffer — a
  // shared buffer would glow every origin, not just these two), updated
  // from the same two anchor positions each frame, below.
  const newestGlow = makePointGroup(NEWEST_ORIGINS.length, preview ? 4 : 5, preview ? 13 : 16, 0.28);

  // Anchor tables — where each landmark point sits, in (petal instance, u)
  // terms, resolved to world position fresh every frame from the SAME
  // per-petal formula the mesh itself uses, so markers stay glued to the
  // breathing surface exactly rather than drifting off it.
  const PS_ANCHORS = [
    { inst: 0, u: 1 }, { inst: 1, u: 1 }, { inst: 2, u: 1 }, { inst: 3, u: 1 },
    { inst: NATURE_CLUSTER_START + 1, u: 1 }, // Nature's own marker: center sub-lobe's tip
  ];
  const originEntries = [];
  POWER_SOURCES.forEach((ps, pi) => {
    ps.origins.forEach((name, oi) => {
      if (pi < 4) {
        originEntries.push({ name, inst: pi, u: 0.62, newest: NEWEST_ORIGINS.includes(name) });
      } else {
        // Nature's three: left/right sub-lobes get their own tip (no
        // competing Power-Source marker there); the center sub-lobe's
        // tip is taken by Chaos Engine's own marker above, so its
        // origin (the second of the three) nests instead.
        const subI = NATURE_CLUSTER_START + oi;
        const u = oi === 1 ? 0.66 : 1;
        originEntries.push({ name, inst: subI, u, newest: NEWEST_ORIGINS.includes(name) });
      }
    });
  });

  // ─── Chrome: title/hint/sound-toggle — unchanged site-wide grammar. ────
  let titleEl = null, hintEl = null, soundToggleEl = null, soundToggleLabelEl = null;
  let srLiveEl = null;
  if (!preview) {
    const frag = parseHTML(outsideHtml);
    titleEl = frag.querySelector('.outside-title-row');
    hintEl = frag.querySelector('.outside-hint');
    document.body.appendChild(titleEl);
    document.body.appendChild(hintEl);
    soundToggleEl = frag.querySelector('.outside-sound-toggle');
    soundToggleLabelEl = soundToggleEl.querySelector('.outside-sound-toggle-label');
    document.body.appendChild(soundToggleEl);
    srLiveEl = frag.querySelector('.outside-sr-live');
    container.appendChild(srLiveEl);
  }

  // ─── Drag → real camera orbit (not a basis rotation — there's no
  // abstract basis anymore, just a real 3D object). Clamped polar range
  // so it can't flip through either pole. Wheel zoom controls distance,
  // same as every other scene. ────────────────────────────────────────────
  const ORBIT_SPEED = 1.4;
  const orbitDrag = !preview ? bindOrbitDrag(container, {
    onDrag: (dx, dy) => {
      azimuth += dx * ORBIT_SPEED;
      polar = THREE.MathUtils.clamp(polar - dy * ORBIT_SPEED, POLAR_MIN, POLAR_MAX);
      updateCameraPosition();
    },
  }) : null;
  const wheelZoom = !preview ? bindWheelZoom(container, {
    onZoom: deltaY => {
      camDist = THREE.MathUtils.clamp(camDist + deltaY * 0.05 * SCALE_FACTOR, CAM_MIN, CAM_MAX);
      updateCameraPosition();
    },
  }) : null;
  // A touch-drag orbit ends in a synthetic click on mobile (touchend
  // doesn't preventDefault it) — without this guard, every orbit gesture
  // would also fire a spurious pulse at the release point.
  const touchGuard = !preview ? bindTapVsDrag(container) : null;

  // ─── Touch — a real pulse across the real surface ──────────────────────
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const PULSE_SPEED = SCALE * 2.6, PULSE_WIDTH = 0.16, PULSE_DURATION = 1.6, PULSE_BOOST = 0.55;
  let pulseActive = false, pulseStart = 0;
  const pulseOrigin = new THREE.Vector3();
  const _pv = new THREE.Vector3();
  // The wavefront's own spatial half-width, reused as the radius of the
  // reduced-motion still highlight below so the two read as the same size.
  const PULSE_STATIC_RADIUS = PULSE_SPEED * PULSE_WIDTH;
  // `clock.elapsed`, not `elapsed` — see the two-clocks note at the top of
  // create(). This is what lets the pulse expire under reduced motion.
  function triggerPulse(point) { pulseOrigin.copy(point); pulseStart = clock.elapsed; pulseActive = true; }
  function pulseWave(t, dist) {
    if (t < 0) return 0;
    const wf = t - dist / PULSE_SPEED;
    return Math.exp(-(wf * wf) / (2 * PULSE_WIDTH * PULSE_WIDTH));
  }
  function pulseBoostAt(x, y, z) {
    if (!pulseActive) return 0;
    _pv.set(x, y, z);
    const dist = pulseOrigin.distanceTo(_pv);
    if (reduceMotion) {
      // A still highlight around the touch point rather than a wavefront
      // travelling across the flower. Running the real wave off the
      // always-advancing clock would fix the never-ends half of the bug and
      // reintroduce the other half — a 1.6s luminance sweep across the whole
      // subject is precisely the kind of motion the setting asks to be spared
      // — so under reduced motion the touch gets the same acknowledgment
      // without the travel: it appears, holds, and clears on the timer in
      // animate(). Visitor-initiated feedback is kept, the animation isn't,
      // matching harmonics.js's hover-halo convention and main.css's own
      // `.nav-icon:hover { transform: none }`.
      return Math.exp(-(dist * dist) / (2 * PULSE_STATIC_RADIUS * PULSE_STATIC_RADIUS)) * PULSE_BOOST;
    }
    return pulseWave(clock.elapsed - pulseStart, dist) * PULSE_BOOST;
  }
  let onClick = null;
  if (!preview) {
    onClick = e => {
      if (touchGuard?.consume()) return;
      const rect = container.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(pickTargets, false);
      if (!hits.length) return;
      triggerPulse(hits[0].point);
      // Chime on touch — petals only. The gold center (Magi/Psi) stays
      // silent on purpose: the same "reads as the thing that isn't a
      // petal" logic that put it at the center rather than as a sixth
      // petal (confirmed explicitly, not assumed — see outside.js's own
      // round-4 header note).
      const hitInst = petalInstances.find(inst => inst.mesh === hits[0].object);
      if (hitInst) triggerChime(hitInst.psIndex);
    };
    container.addEventListener('click', onClick);
  }

  // ─── Keyboard/screen-reader equivalent for petal touch. Every other
  // click/touch-driven WebGL scene on the site (harmonics, library,
  // orbiter, sphere, orrery, beamline) has a createJumpList; Outside never
  // got one after the v3.5.0 pivot removed its old panel-based interaction
  // — the "no text, no panel" rule this scene otherwise follows is about
  // withheld CONTENT, not about withholding the touch interaction itself
  // from keyboard-only and screen-reader users, so the gap was a real
  // accessibility miss, not a design choice (2026-08-25 audit). Reuses the
  // exact same triggerPulse/triggerChime calls the mouse path uses, at the
  // same PS_ANCHORS world position a mouse hit on that petal's tip would
  // resolve to, so keyboard activation gives the identical pulse+chime
  // result rather than a lesser stand-in.
  let jumpList = null;
  const _jumpAnchor = new THREE.Vector3();
  if (!preview) {
    jumpList = createJumpList(container, {
      label: 'Touch a petal to hear its chime',
      items: POWER_SOURCES,
      getLabel: (ps, i) => `${ps.angel}'s petal — ${ps.device}`,
      onSelect: (ps, i) => {
        const a = PS_ANCHORS[i];
        anchorWorldPos(petalInstances[a.inst], a.u, _jumpAnchor);
        triggerPulse(_jumpAnchor);
        triggerChime(i);
        if (srLiveEl) srLiveEl.textContent = `${ps.angel}'s petal — ${ps.device}`;
      },
    });
  }

  // ─── Hover/proximity — a "this one" cue before the petal is actually
  // touched, reusing the Fresnel rim mechanism already built for
  // translucency rather than inventing a second visual language (round
  // 5). Petals only, not the seedpod — same reasoning as the chime gate
  // above. hoveredInst is read every frame inside updatePetal, which
  // lerps each petal's own fresnelGlow uniform toward a boosted value if
  // it's the hovered one, or back toward BASE_FRESNEL_GLOW otherwise. ────
  //
  // v4.0: the handler no longer raycasts. It used to run a full-mesh
  // intersectObjects across all 7 petals — up to 240 ray-triangle tests each,
  // 1,680 in the worst case — on every single `pointermove`, which fires at
  // the pointer's own poll rate (120Hz on a trackpad, up to 1000Hz on a
  // gaming mouse), and `pointermove` covers touch too, so it also ran
  // throughout every touch-drag orbit. The only consumer, updateHoverGlow,
  // reads `hoveredInst` once per RENDERED frame, so everything above 60Hz was
  // discarded before anything looked at it. The handler now just records
  // where the pointer is; the pick happens once at the top of animate().
  const petalMeshes = petalInstances.map(p => p.mesh);
  let hoveredInst = null;
  let pointerInside = false;
  let pointerNdcX = 0, pointerNdcY = 0;
  let onPointerMove = null, onPointerLeave = null;
  if (!preview) {
    onPointerMove = e => {
      const rect = container.getBoundingClientRect();
      pointerNdcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      pointerInside = true;
    };
    onPointerLeave = () => { pointerInside = false; hoveredInst = null; };
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerleave', onPointerLeave);
  }

  // ─── Sound — generative ambient chime layer, replacing the old
  // continuous breath-synced pad. The pad kept reading as a "hum" even
  // after round 5's floor/ceiling fix because a held drone is a hum by
  // definition, no matter how quiet its trough gets — the fix had to be
  // structural, not another volume trim. Individual pentatonic tones now
  // trigger stochastically, gated by the same breathePhase(t) that drives
  // the petal animation (denser near the swell's peak, sparser at the
  // trough) rather than one continuous tone whose volume merely rises and
  // falls. Lazy AudioContext on first gesture, same convention every other
  // scene's sound toggle uses. ─────────────────────────────────────────
  let audioCtx = null, muteGain = null;
  let reverbConvolver = null;
  let soundEnabled = false;
  let lastAmbientFreq = 0;
  // A-Kumoi {A, B, C, E, F#} — semitone offsets [0,2,3,7,9] from A. Swapped
  // in from A-Hirajoshi {A,B,C,E,F} (offsets [0,2,3,7,8]) per request — the
  // two scales share four of five degrees (A,B,C,E); only the sixth degree
  // moves from F to F#. Two octaves, kept up out of bass register entirely
  // — "move this whole layer up, don't keep it low and just retexture it."
  //
  // Honest caveat, still true after the swap: Kumoi (like Hirajoshi) is NOT
  // anhemitonic. A major-type pentatonic (0,2,4,7,9) truly has no semitone
  // or tritone between any two of its degrees; Kumoi's own C–B dyad is a
  // semitone (same as Hirajoshi's, since B and C carry over unchanged) and
  // its C–F# dyad is a tritone (Hirajoshi's tritone was B–F instead — the
  // dissonant pair moved with the swapped degree, it didn't disappear).
  // That dissonant interval is the actual source of the "wistful"
  // character, not an oversight. Proceeding with Kumoi as requested because
  // the practical clash risk is low here: long attack/release, heavy
  // reverb, and sparse stochastic triggering mean two colliding tones are
  // rarely both near full volume at once, and the scale's own mild tension
  // reads as part of its calm-but-wistful character rather than a flaw.
  const AMBIENT_FREQS = [
    440.00, 493.88, 523.25, 659.25, 739.99,    // A4 B4 C5 E5 F#5
    880.00, 987.77, 1046.50, 1318.51, 1479.98, // A5 B5 C6 E6 F#6
  ];
  // Coordination check against the five petal chimes, redone after the
  // Kumoi swap rather than assumed to still hold: since A/B/C/E carry over
  // unchanged, only chimes that touch the swapped F/F# degree needed a
  // second look. Raphael's 440/443 still lands exactly on A4; Michael's
  // 660 still sits ~2 cents from E5 (659.25); Gabriel's 520→170 ramp still
  // starts near C5 (523.25), but its old endpoint (170, close to F3's
  // 174.61 under Hirajoshi) no longer lands near anything in-scale — F is
  // gone, replaced by F#3 (185.00), a full 15Hz further away. Retuned
  // Gabriel's endpoint to 164.81 (E3, the nearest actual Kumoi tone) below
  // rather than leaving a chime that quietly stopped matching the ambient
  // bed it's meant to sit inside. Two deliberate non-matches, unaffected by
  // the swap and still defensible: Emmanuel's 390Hz partial is a harmonic-
  // series overtone of his 130Hz fundamental (itself ~exact on Kumoi's C3
  // at 130.81) and lands off-scale near G — physically motivated, not
  // arbitrary; Nature's logistic-map pitch jitter is deliberately
  // unquantized to any scale, since unquantized chaos is that petal's whole
  // point.
  const AMBIENT_GAIN = 0.075;
  const AMBIENT_RATE_MIN = 0.025, AMBIENT_RATE_MAX = 0.16; // notes/sec, breath-gated
  // A synthesized impulse response (exponentially-decaying noise) rather
  // than a loaded audio file — genuine convolution reverb, no external
  // asset. Used by Emmanuel's chime and now the ambient layer, whose own
  // ask is "generous reverb tail, large open space, never close-mic'd."
  function makeImpulseResponse(ctx, duration, decay) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return impulse;
  }
  function buildAudioGraph() {
    if (disposed || audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    muteGain = audioCtx.createGain(); muteGain.gain.value = 0;
    muteGain.connect(audioCtx.destination);
    reverbConvolver = audioCtx.createConvolver();
    reverbConvolver.buffer = makeImpulseResponse(audioCtx, 3.4, 2.1);
    reverbConvolver.connect(muteGain);
  }
  function setSoundEnabled(on) {
    // v4.0. bindPersistedSoundToggle used to leave a `pointerdown` listener on
    // the shared #experience-container — which main.js only ever empties,
    // never replaces — so one pointer-down inside ANY later scene called
    // straight into here from a scene that no longer existed. Harmonics'
    // version of that bug built whole new AudioContexts; this one was quieter
    // and arguably worse: dispose() closed audioCtx but didn't null it, so
    // buildAudioGraph() early-returned while startAmbientScheduler() went
    // ahead and armed a fresh setInterval on a dead closure that
    // stopAmbientScheduler could never reach — visible from inside another
    // scene as a burst of "Construction of OscillatorNode is not useful when
    // context is closed". The helper now returns a dispose() and this scene
    // calls it (see soundToggle below); this guard makes a stale call from any
    // other route a no-op too, and dispose() now nulls audioCtx exactly the
    // way Harmonics' does.
    if (disposed) return;
    soundEnabled = on;
    if (on) buildAudioGraph();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (muteGain) {
      const now = audioCtx.currentTime;
      muteGain.gain.cancelScheduledValues(now);
      muteGain.gain.linearRampToValueAtTime(on ? 1 : 0, now + 0.6);
    }
    if (on) startAmbientScheduler(); else stopAmbientScheduler();
    if (soundToggleEl) {
      soundToggleEl.setAttribute('aria-pressed', String(on));
      if (soundToggleLabelEl) soundToggleLabelEl.textContent = on ? 'Sound on' : 'Sound off';
    }
  }
  // Persisted under this scene's OWN localStorage key — `pm-sound-enabled:
  // outside`, not one shared with Harmonics. That is Scott's explicit call
  // and sceneKit.js records it ("don't reintroduce a shared key"), so the
  // "site-wide (shared with Harmonics)" this comment used to claim described
  // a design that was deliberately reversed. The code was always right.
  // See bindPersistedSoundToggle's own comment for why this needs a deferred
  // first-gesture activation rather than just re-reading the stored value at
  // mount (browser autoplay policy), and how it avoids fighting an explicit
  // click on the toggle itself.
  const soundToggle = bindPersistedSoundToggle(container, soundToggleEl, setSoundEnabled, 'outside');

  // ─── Ambient chime voice — one generative note from the Kumoi pool
  // above. Inharmonic on purpose: a fundamental plus two upper partials
  // detuned a few Hz off a clean 2x/3x harmonic ratio, the same beat-
  // frequency principle chimeRaphael and the old pad's drift both used,
  // aimed at a gentler target here — a soft, slow shimmer rather than a
  // sterile pure-harmonic bell. Long attack and release (both randomized
  // per note so notes don't swell in lockstep), mostly wet through the
  // shared reverb convolver so this layer sits back in a large room rather
  // than up close. ─────────────────────────────────────────────────────
  function triggerAmbientChime(now, freq) {
    const osc1 = audioCtx.createOscillator(); osc1.type = 'sine';
    osc1.frequency.value = freq;
    const osc2 = audioCtx.createOscillator(); osc2.type = 'sine';
    osc2.frequency.value = freq * 2 + (Math.random() * 1.6 - 0.8); // detuned off a clean octave
    const osc3 = audioCtx.createOscillator(); osc3.type = 'sine';
    osc3.frequency.value = freq * 3 + (Math.random() * 3 - 1.5); // detuned off a clean 12th
    const g1 = audioCtx.createGain(); g1.gain.value = 1;
    const g2 = audioCtx.createGain(); g2.gain.value = 0.34;
    const g3 = audioCtx.createGain(); g3.gain.value = 0.16;
    const attack = 1.4 + Math.random() * 1.2; // 1.4-2.6s, per the brief's "long attack (1-3+s)"
    const release = 4 + Math.random() * 2; // 4-6s
    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(AMBIENT_GAIN, now + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + attack + release);
    osc1.connect(g1); osc2.connect(g2); osc3.connect(g3);
    g1.connect(env); g2.connect(env); g3.connect(env);
    const dry = audioCtx.createGain(); dry.gain.value = 0.22;
    const wet = audioCtx.createGain(); wet.gain.value = 0.85; // mostly wet — large, open space
    env.connect(dry); dry.connect(muteGain);
    env.connect(wet); wet.connect(reverbConvolver);
    const stopAt = now + attack + release + 0.3;
    [osc1, osc2, osc3].forEach(o => { o.start(now); o.stop(stopAt); });
  }

  // ─── Ambient scheduling — decoupled from the render loop ────────────────
  // The trigger check used to live inside animate() (`Math.random() <
  // rate*dt`, once per rAF frame) — but requestAnimationFrame throttles
  // hard in a backgrounded tab (first caught during the curtain-motion
  // verification pass: this sandbox reported itself backgrounded even
  // while focused, and the render loop stalled entirely). A per-frame
  // Bernoulli check is only a good approximation of a Poisson process when
  // frames arrive often and regularly — exactly what stops being true the
  // moment it's needed most.
  //
  // Standard lookahead-scheduler pattern instead (Chris Wilson, "A Tale of
  // Two Clocks" — the canonical Web Audio reference for this exact
  // problem): a periodic tick, independent of rAF, looks a short window
  // ahead of audioCtx.currentTime (the audio hardware's own real-time
  // clock — keeps advancing in a hidden tab even when rAF and ordinary
  // timers don't) and schedules every note due inside that window via its
  // own oscillator's .start(exactTime). The tick only has to run often
  // enough to keep topping up the window; it doesn't need to land on the
  // exact instant a note should start — setInterval's own imprecision
  // never shows up in the actual audio timing, only in how far ahead
  // notes get queued. Most engines (Chrome among them) also exempt a tab
  // that's currently producing audible output from background-timer
  // throttling, which this benefits from for free most of the time — real,
  // but not load-bearing: the lookahead window plus the catch-up loop
  // below (`while`, not `if`) mean a late tick just schedules its whole
  // backlog at once rather than losing it. A note or two landing in a
  // near-simultaneous burst after a long gap is a fine outcome, not a bug.
  //
  // A real ceiling this doesn't try to defeat: an OS or browser can still
  // suspend the AudioContext outright under aggressive power-saving states
  // (mobile Safari especially) — the sound toggle is the visitor's own
  // escape hatch if that ever matters to them. This fix targets normal tab
  // backgrounding, not every possible power state.
  const SCHEDULE_AHEAD = 1.2;    // seconds — how far past "now" to schedule notes each tick
  const SCHEDULE_INTERVAL = 250; // ms — comfortably under the browser's first (1s) background-throttle tier, so ordinary (non-intensive) backgrounding never even opens a gap
  let nextAmbientTime = 0;
  let ambientSchedulerId = null;

  // Same shape as the visual breathePhase below, but driven off
  // audioCtx.currentTime rather than the scene's own `elapsed` — `elapsed`
  // is intentionally allowed to free-drift while backgrounded (nothing is
  // on screen to animate, see animate()'s own dt clamp), so reusing it
  // here would silently reintroduce the exact rAF dependency this fix
  // removes. The two clocks start at slightly different moments (elapsed
  // from scene mount, this from whenever the AudioContext is first built,
  // on first gesture) — a small, harmless phase offset between the visual
  // swell and the audio swell, not a bug worth chasing.
  function ambientBreathePhase(t) { return 0.5 + 0.5 * Math.sin(t * BREATHE_FREQ); }

  function scheduleAmbientNotes() {
    if (!audioCtx || !soundEnabled) return;
    const now = audioCtx.currentTime;
    while (nextAmbientTime < now + SCHEDULE_AHEAD) {
      const bp = ambientBreathePhase(nextAmbientTime);
      const rate = THREE.MathUtils.lerp(AMBIENT_RATE_MIN, AMBIENT_RATE_MAX, bp); // notes/sec
      let idx = Math.floor(Math.random() * AMBIENT_FREQS.length);
      if (AMBIENT_FREQS[idx] === lastAmbientFreq) idx = (idx + 1 + Math.floor(Math.random() * (AMBIENT_FREQS.length - 1))) % AMBIENT_FREQS.length;
      lastAmbientFreq = AMBIENT_FREQS[idx];
      triggerAmbientChime(nextAmbientTime, lastAmbientFreq);
      // Exponential inter-arrival time — the continuous-time equivalent of
      // the old per-frame "Math.random() < rate*dt" check, and what
      // actually makes this independent of how often the tick itself runs.
      const wait = -Math.log(1 - Math.random()) / Math.max(rate, 0.0001);
      nextAmbientTime += wait;
    }
  }

  function startAmbientScheduler() {
    // `state === 'closed'` in the guard alongside the null check (v4.0): a
    // closed context is still truthy, which is exactly how a torn-down scene
    // used to arm an interval nothing could clear. dispose() nulling audioCtx
    // already closes that path; this is the local belt.
    if (ambientSchedulerId != null || !audioCtx || audioCtx.state === 'closed' || disposed) return;
    // Reseed rather than resume from wherever nextAmbientTime was left —
    // otherwise turning sound back on after it's been off a while would
    // read a whole backlog of notes as "due" against a stale clock and
    // fire them all at once on the very first tick.
    nextAmbientTime = audioCtx.currentTime + 0.3;
    scheduleAmbientNotes();
    ambientSchedulerId = setInterval(scheduleAmbientNotes, SCHEDULE_INTERVAL);
  }
  function stopAmbientScheduler() {
    if (ambientSchedulerId != null) { clearInterval(ambientSchedulerId); ambientSchedulerId = null; }
  }
  // Some engines (mobile Safari especially) auto-suspend the AudioContext
  // on backgrounding and expect an explicit resume() once the tab is
  // visible again — belt-and-suspenders alongside setSoundEnabled's own
  // resume() call, since that one only fires on an actual toggle click,
  // never on a visibility change by itself.
  //
  // v4.0 adds the suspend half, which is a real behaviour decision, not just
  // symmetry. The lookahead scheduler above exists so note TIMING survives a
  // backgrounded tab — that was always about correctness under throttling,
  // never a commitment to keep playing while nobody is looking. And it works:
  // a hidden tab kept chiming indefinitely, from a page whose only control is
  // a button the visitor can't see, on a site where every other scene goes
  // silent the moment you leave it. An ambient art page audibly chiming out of
  // a background tab is the kind of thing people hunt through twenty tabs to
  // kill. So: suspend on hide, resume on show — the same call Harmonics now
  // makes, for the same reason. Nothing is lost by it; suspend() freezes
  // audioCtx.currentTime, and startAmbientScheduler() reseeds nextAmbientTime
  // against that clock on the way back, so there's no backlog to dump.
  const onVisibilityChange = () => {
    if (disposed || !audioCtx || audioCtx.state === 'closed') return;
    if (document.hidden) {
      if (audioCtx.state === 'running') {
        stopAmbientScheduler();
        audioCtx.suspend();
      }
      return;
    }
    // First frame back would otherwise arrive as one long dt.
    clock.resync();
    if (!soundEnabled) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    startAmbientScheduler();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  // ─── Five petal chimes — each grounded in what's already established
  // about that Power Source this session, not five arbitrary notes.
  // Every voice is built fresh per trigger (oscillator nodes are one-shot
  // in Web Audio) and routed to muteGain, so the same sound-toggle gate
  // that mutes the pad also mutes chimes — one on/off switch for the
  // whole scene, not two. Silent when sound is off (touching a petal
  // still gives the visual pulse either way). ─────────────────────────────
  const CHIME_GAIN = 0.22;
  function chimeMichael(now) {
    // Tempered — a pure, close-to-overtone-free bell. Michael's own
    // established endpoint is "glossy, featureless, polished beyond all
    // reason" (Notes.rtf) — a single sine has, by construction, zero
    // harmonics, which is that image in sound rather than a metaphor for
    // it.
    //
    // Round 5: Michael and Emmanuel were hard to tell apart in a live
    // listen — both landing as "some kind of sustained bell." Fixed on
    // envelope shape, not timbre: Michael is struck (near-instant attack),
    // short and controlled (decay tightened from 2.6s to 1.0s so it reads
    // as contained rather than ringing), dry (no reverb send at all — see
    // chimeEmmanuel's wet path for the opposite choice), and stays in its
    // own bright/high register. Opposite of Emmanuel on all four axes
    // (attack shape, decay length, reverb, register) rather than relying
    // on pitch alone to separate them.
    const osc = audioCtx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 660;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(CHIME_GAIN, now + 0.006); // struck — near-instant attack
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.0); // short, controlled decay
    osc.connect(g); g.connect(muteGain); // dry — no reverb send, precise and contained
    osc.start(now); osc.stop(now + 1.1);
  }
  function chimeGabriel(now) {
    // Quick and Infernals — real downward pitch resolution, not a static
    // tone. "The Portable Hell's whole shape is descent" — a genuine
    // exponential frequency ramp down, not a pitch-bend effect layered on
    // top. Triangle (a little richer than Michael's pure sine) keeps the
    // two texturally distinct even before the descent registers.
    //
    // Endpoint retuned from 170 to 164.81 (E3) when the ambient bed swapped
    // from Hirajoshi to Kumoi — 170 sat close to F3 (in Hirajoshi's scale)
    // but Kumoi replaces F with F#, leaving the old target off-scale. E3 is
    // the nearest actual Kumoi tone, close enough to the original that the
    // descent's shape and feel are unchanged.
    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(164.81, now + 1.1);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(CHIME_GAIN, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
    osc.connect(g); g.connect(muteGain);
    osc.start(now); osc.stop(now + 1.4);
  }
  function chimeRaphael(now) {
    // Psychopomps — two tones ~3Hz apart, close enough to shimmer rather
    // than resolve into a clear separate beat. Reuses the retired sound
    // design's own beat-frequency technique, repurposed rather than
    // reinvented: the Antimatter Bottle is specifically about containing
    // two things that would annihilate if they touched, and a gentle,
    // controlled beat is that idea in audio.
    const oscA2 = audioCtx.createOscillator(), oscB2 = audioCtx.createOscillator();
    oscA2.type = 'sine'; oscB2.type = 'sine';
    oscA2.frequency.value = 440; oscB2.frequency.value = 443;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(CHIME_GAIN * 0.85, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);
    oscA2.connect(g); oscB2.connect(g); g.connect(muteGain);
    oscA2.start(now); oscB2.start(now);
    oscA2.stop(now + 3.1); oscB2.stop(now + 3.1);
  }
  function chimeEmmanuel(now) {
    // Celestials and Divinities — long decay, real reverb tail, low and
    // wide. Gravitational scale, not a quick pluck.
    //
    // Round 5, two fixes:
    //
    // (1) Envelope — opposite of Michael on purpose (see chimeMichael's
    // own comment): a slow swelling attack, not struck — arriving rather
    // than plucked — into a long decay (~5.6s total) with a real reverb
    // tail. Pitch-matching shouldn't be required to tell them apart; the
    // attack shape and register alone should do it.
    //
    // (2) Bass — psychoacoustic harmonic reinforcement, not just a low
    // fundamental. The true fundamental stays at 130Hz (the actual low
    // register isn't raised), but most laptop/phone speaker drivers roll
    // off hard under ~150Hz, so that fundamental alone can be near-
    // inaudible on small hardware. Reinforcing the 2nd (260Hz) and 3rd
    // (390Hz) harmonics with real presence — not token amounts — lets the
    // ear reconstruct the low pitch from harmonics small speakers CAN
    // reproduce, the standard psychoacoustic-bass technique.
    const FUND = 130;
    const osc1 = audioCtx.createOscillator(); osc1.type = 'sine'; osc1.frequency.value = FUND;
    const osc2 = audioCtx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = FUND * 2;
    const osc3 = audioCtx.createOscillator(); osc3.type = 'sine'; osc3.frequency.value = FUND * 3;
    const gFund = audioCtx.createGain(); gFund.gain.value = 1;
    const g2nd = audioCtx.createGain(); g2nd.gain.value = 0.55; // real presence, not a token amount
    const g3rd = audioCtx.createGain(); g3rd.gain.value = 0.32;
    const g = audioCtx.createGain(); // shared swell/decay envelope for all three partials
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(CHIME_GAIN * 0.9, now + 1.1); // slow swell — arriving, not struck
    g.gain.exponentialRampToValueAtTime(0.0001, now + 5.6); // long decay
    osc1.connect(gFund); osc2.connect(g2nd); osc3.connect(g3rd);
    gFund.connect(g); g2nd.connect(g); g3rd.connect(g);
    const dry = audioCtx.createGain(); dry.gain.value = 0.35;
    const wet = audioCtx.createGain(); wet.gain.value = 1.0;
    g.connect(dry); dry.connect(muteGain);
    g.connect(wet); wet.connect(reverbConvolver);
    [osc1, osc2, osc3].forEach(o => { o.start(now); o.stop(now + 5.8); });
  }
  function chimeNature(now) {
    // Naturals/Fae/Elementals — genuinely generative, not hand-tuned: the
    // logistic map (x = r*x*(1-x), r = 3.9, deep in the chaotic regime)
    // drives real pitch jitter, seeded from Math.random() each trigger so
    // it's actually different every time, not a fixed "chaotic-sounding"
    // arpeggio. Elementals were already grounded in real chaos theory
    // this session (the Chaos Engine itself) — this makes the petal's
    // own chime actually chaotic rather than metaphorically so.
    const r = 3.9;
    let x = 0.15 + Math.random() * 0.7;
    const steps = 6, stepDur = 0.11, baseFreq = 300;
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    for (let i = 0; i < steps; i++) {
      x = r * x * (1 - x);
      osc.frequency.setValueAtTime(baseFreq * (0.7 + 0.9 * x), now + i * stepDur);
    }
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(CHIME_GAIN * 0.8, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + steps * stepDur + 0.6);
    osc.connect(g); g.connect(muteGain);
    osc.start(now); osc.stop(now + steps * stepDur + 0.7);
  }
  const CHIME_FNS = [chimeGabriel, chimeMichael, chimeRaphael, chimeEmmanuel, chimeNature]; // index matches POWER_SOURCES order
  function triggerChime(psIndex) {
    if (!soundEnabled || !audioCtx) return;
    CHIME_FNS[psIndex]?.(audioCtx.currentTime);
  }

  // ─── Breathing — the sole ambient motion source, unconditional. ────────
  const BREATHE_FREQ = 0.11; // ~57s full cycle
  function breathePhase(t) { return 0.5 + 0.5 * Math.sin(t * BREATHE_FREQ); }
  function petalSway(t, swayIndex) {
    return 1 + 0.03 * Math.sin(t * (0.07 + 0.011 * swayIndex) + swayIndex * 1.9);
  }

  const reduceMotion = prefersReducedMotion();
  // The MOTION clock — deliberately stopped under reduced motion, which is
  // what freezes the breath and the sway. The always-running `clock` declared
  // at the top of create() is the other half; see its note there.
  let elapsed = 0;
  let animId = null;
  let paused = false;
  let petalsBuilt = false; // false until the first frame has written real vertices
  const tmpColor = new THREE.Color();
  const _anchor = new THREE.Vector3(); // reused scratch — every anchor read/write below happens immediately, no cross-frame state

  // `sway` is passed in rather than recomputed (v4.0): petalSway(elapsed,
  // swayIndex) used to be evaluated three times per petal per frame across
  // three call sites that all had to agree about the reduced-motion branch —
  // one place to get wrong, three places to fix. Now animate() computes it
  // once and hands the same number to all three consumers.
  //
  // `writeGeometry` / `writeColor` are the reduced-motion early-out. With
  // `elapsed` frozen and sway forced to 1, every value this function computes
  // is bit-identical to the previous frame's — yet the whole thing ran 60
  // times a second to produce an unchanged image, including
  // computeVertexNormals() (which allocates 8 Vector3s per call in r185,
  // ~3,400 short-lived allocations a second across the flower) and a full
  // second geometry sweep for the bounding sphere. Under reduced motion the
  // geometry is written exactly once; only a live touch pulse brings the
  // colour half back for its 1.6 seconds.
  function updatePetal(inst, sway, globalScaleXY, globalScaleZ, writeGeometry, writeColor) {
    const length = inst.length * globalScaleXY * sway;
    const halfWidth = inst.halfWidth * globalScaleXY * sway;
    const height = inst.height * globalScaleZ * sway;
    for (let i = 0; i < topo.count; i++) {
      const u = topo.uArr[i], w = topo.wArr[i];
      const hw = halfWidth * petalHalfWidth(u);
      const localX = u * length, localY = w * hw;
      const y = height * petalHeightProfile(u, w);
      // Petals spread in the X-Z plane (world "ground" plane), arching
      // up into Y — Y is this camera's own pole axis (see the spherical
      // orbit above), so the flower's face-normal lines up with the
      // camera's natural elevation sweep. An earlier pass spread petals
      // in X-Y instead, which put the flower's face perpendicular to the
      // orbit's pole — every view looked edge-on/foreshortened no matter
      // the azimuth, confirmed live via a temporary debug hook before
      // this fix (screenshots at several forced azimuths all showed the
      // same collapsed, non-flower-reading silhouette).
      const x = localX * inst.cosA - localY * inst.sinA;
      const zPlane = localX * inst.sinA + localY * inst.cosA;
      if (writeGeometry) { inst.pos[i * 3] = x; inst.pos[i * 3 + 1] = y; inst.pos[i * 3 + 2] = zPlane; }

      if (writeColor) {
        // inst.baseCol is the hue/sat/lightness gradient, resolved once at
        // construction — see makePetalInstance. Only the pulse boost is live.
        const b = i * 3;
        const boost = pulseBoostAt(x, y, zPlane);
        inst.col[b] = Math.min(1, inst.baseCol[b] + boost);
        inst.col[b + 1] = Math.min(1, inst.baseCol[b + 1] + boost);
        inst.col[b + 2] = Math.min(1, inst.baseCol[b + 2] + boost);
      }
    }
    if (writeGeometry) {
      inst.geo.attributes.position.needsUpdate = true;
      inst.geo.computeVertexNormals();
      // The bounding sphere has to track the breathing — a stale one could
      // make a touch miss the surface near a petal's own edge — but it's the
      // closed-form bound now, not a second full sweep. See the derivation in
      // makePetalInstance.
      inst.boundingSphere.radius = Math.hypot(length, halfWidth, height);
    }
    // Colour only changes during a pulse, so this upload is gated too — it
    // used to fire unconditionally, marking a 1,008-float buffer dirty every
    // frame of a flower that spends almost all its life at rest.
    if (writeColor) inst.geo.attributes.color.needsUpdate = true;
  }

  // Hover/proximity glow — smoothly lerp toward 1 if this is the
  // currently-hovered petal, back toward 0 otherwise, then drive the
  // material's own Fresnel rim uniform with it (round 5). Split out of
  // updatePetal (v4.0) because it's a uniform write, not geometry: it still
  // has to run on the frames where the reduced-motion early-out skips the
  // vertex work, since hover is visitor-initiated.
  function updateHoverGlow(inst) {
    inst.hoverGlow = THREE.MathUtils.lerp(inst.hoverGlow, inst === hoveredInst ? 1 : 0, HOVER_LERP_RATE);
    const shader = inst.mat.userData.shader;
    if (shader) shader.uniforms.fresnelGlow.value = BASE_FRESNEL_GLOW + inst.hoverGlow * HOVER_FRESNEL_BOOST;
  }

  function anchorWorldPos(inst, u, out) {
    const hw = 0; // centerline (w=0)
    const length = inst._curLength, height = inst._curHeight;
    const localX = u * length, localY = hw;
    const y = height * petalHeightProfile(u, 0);
    const x = localX * inst.cosA - localY * inst.sinA;
    const zPlane = localX * inst.sinA + localY * inst.cosA;
    out.set(x, y, zPlane);
    return out;
  }

  function animate() {
    animId = requestAnimationFrame(animate);
    const dt = clock.tick();
    if (!reduceMotion) elapsed += dt;

    // Against clock.elapsed, which always advances — this comparison is what
    // lets the pulse end under reduced motion. `pulseWasActive` keeps the
    // frame that clears it doing one last colour write, so the highlight is
    // actually removed from the buffer rather than left in it.
    const pulseWasActive = pulseActive;
    if (pulseActive && clock.elapsed - pulseStart > PULSE_DURATION) pulseActive = false;

    // One raycast per rendered frame instead of one per pointer event — see
    // the pointermove handler's own note. Skipped mid-drag: an orbit gesture
    // is moving the camera, not choosing a petal, and this is exactly the
    // path that ran flat out through every touch-drag.
    if (pointerInside && !orbitDrag?.isDragging) {
      pointerNdc.set(pointerNdcX, pointerNdcY);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(petalMeshes, false);
      hoveredInst = hits.length ? petalInstances.find(inst => inst.mesh === hits[0].object) : null;
    }

    const bp = breathePhase(elapsed);
    const globalScaleXY = 1 + 0.035 * (bp - 0.5) * 2;
    const globalScaleZ = 1 + 0.12 * (bp - 0.5) * 2;

    // Under reduced motion nothing about the surface can change after the
    // first frame, so the whole rebuild is skipped; a touch pulse brings the
    // colour half back for as long as it lasts.
    const writeGeometry = !reduceMotion || !petalsBuilt;
    const writeColor = writeGeometry || pulseActive || pulseWasActive;

    petalInstances.forEach(inst => {
      const sway = reduceMotion ? 1 : petalSway(elapsed, inst.swayIndex);
      inst._curLength = inst.length * globalScaleXY * sway;
      inst._curHeight = inst.height * globalScaleZ * sway;
      if (writeGeometry || writeColor) updatePetal(inst, sway, globalScaleXY, globalScaleZ, writeGeometry, writeColor);
      updateHoverGlow(inst);
    });
    petalsBuilt = true;

    // The seedpod and all three landmark point groups ride the same gate as
    // the petals (v4.0): their positions come from the same breathing-scaled
    // anchors and their colours from the same pulse, so on a reduced-motion
    // frame with no live pulse every value here is identical to the last
    // one's too — measured live before this gate went in, that was 8 buffer
    // uploads a frame doing nothing (960/s on a 120Hz display).
    if (writeGeometry || writeColor) {
      podMesh.scale.setScalar(1 + 0.02 * (bp - 0.5) * 2);
      {
        const boost = pulseBoostAt(podMesh.position.x, podMesh.position.y, podMesh.position.z);
        podMat.emissiveIntensity = 0.55 + boost * 0.8;
      }

      // ─── Power Source markers, at each petal's tip ───────────────────────
      PS_ANCHORS.forEach((a, i) => {
        const inst = petalInstances[a.inst];
        anchorWorldPos(inst, a.u, _anchor);
        psPoints.pos[i * 3] = _anchor.x; psPoints.pos[i * 3 + 1] = _anchor.y; psPoints.pos[i * 3 + 2] = _anchor.z;
        tmpColor.setHSL(inst.hue, 0.55, 0.72);
        const boost = pulseBoostAt(_anchor.x, _anchor.y, _anchor.z);
        psPoints.col[i * 3] = Math.min(1, tmpColor.r + boost);
        psPoints.col[i * 3 + 1] = Math.min(1, tmpColor.g + boost);
        psPoints.col[i * 3 + 2] = Math.min(1, tmpColor.b + boost);
      });
      psPoints.geo.attributes.position.needsUpdate = true;
      psPoints.geo.attributes.color.needsUpdate = true;

      // ─── Folk Origin markers, nested along their petal ───────────────────
      let newestIdx = 0;
      originEntries.forEach((e, i) => {
        const inst = petalInstances[e.inst];
        anchorWorldPos(inst, e.u, _anchor);
        originPoints.pos[i * 3] = _anchor.x; originPoints.pos[i * 3 + 1] = _anchor.y; originPoints.pos[i * 3 + 2] = _anchor.z;
        tmpColor.setHSL(inst.hue, 0.5, 0.8);
        const boost = pulseBoostAt(_anchor.x, _anchor.y, _anchor.z);
        originPoints.col[i * 3] = Math.min(1, tmpColor.r + boost);
        originPoints.col[i * 3 + 1] = Math.min(1, tmpColor.g + boost);
        originPoints.col[i * 3 + 2] = Math.min(1, tmpColor.b + boost);
        // Tempered/Psychopomps also write into newestGlow's own small
        // buffer — a separate point group (not a shared-buffer trick), so
        // only these two ever render on that extra glow layer.
        if (e.newest) {
          const j = newestIdx++;
          newestGlow.pos[j * 3] = _anchor.x; newestGlow.pos[j * 3 + 1] = _anchor.y; newestGlow.pos[j * 3 + 2] = _anchor.z;
          newestGlow.col[j * 3] = Math.min(1, tmpColor.r + boost);
          newestGlow.col[j * 3 + 1] = Math.min(1, tmpColor.g + boost);
          newestGlow.col[j * 3 + 2] = Math.min(1, tmpColor.b + boost);
        }
      });
      originPoints.geo.attributes.position.needsUpdate = true;
      originPoints.geo.attributes.color.needsUpdate = true;
      newestGlow.geo.attributes.position.needsUpdate = true;
      newestGlow.geo.attributes.color.needsUpdate = true;

      // ─── Magi / Psi — two points near the seedpod's own surface ──────────
      const podR = SCALE * 0.15;
      const magiPos = [-podR * 0.42, SCALE * 0.07 + podR * 0.68, podR * 0.22];
      const psiPos = [podR * 0.42, SCALE * 0.07 + podR * 0.68, -podR * 0.18];
      [magiPos, psiPos].forEach((p, i) => {
        centerPoints.pos[i * 3] = p[0]; centerPoints.pos[i * 3 + 1] = p[1]; centerPoints.pos[i * 3 + 2] = p[2];
        tmpColor.setHSL(GOLD_HUE, 0.65, 0.85);
        const boost = pulseBoostAt(p[0], p[1], p[2]);
        centerPoints.col[i * 3] = Math.min(1, tmpColor.r + boost);
        centerPoints.col[i * 3 + 1] = Math.min(1, tmpColor.g + boost);
        centerPoints.col[i * 3 + 2] = Math.min(1, tmpColor.b + boost);
      });
      centerPoints.geo.attributes.position.needsUpdate = true;
      centerPoints.geo.attributes.color.needsUpdate = true;
    }

    // Ambient chime triggering moved off this per-frame check entirely —
    // see startAmbientScheduler()/scheduleAmbientNotes() in the Sound
    // section above. rAF-driven triggering went silent under tab
    // backgrounding (this scene's own render loop stalls exactly when
    // that happens); a setInterval-driven lookahead scheduler keyed to
    // audioCtx.currentTime doesn't.

    // ─── Background curtains — billboard to the camera every frame (so
    // orbiting never shows one edge-on), then displace in local X/Y via
    // simplex noise sampled at each vertex's own undisturbed base position
    // plus a slowly-advancing time offset — coherent, organic billowing
    // rather than independent per-vertex jitter. Static (billboard only,
    // no billow) under reduced motion, same convention as petal sway.
    curtainPlanes.forEach(cp => {
      cp.mesh.quaternion.copy(camera.quaternion);
      if (reduceMotion) return;
      const arr = cp.geo.attributes.position.array;
      const t = elapsed * cp.driftSpeed;
      for (let i = 0; i < arr.length; i += 3) {
        const bx = cp.base[i], by = cp.base[i + 1];
        const nx = cp.noise(bx * 0.006 + t, by * 0.006);
        const ny = cp.noise(bx * 0.006, by * 0.006 + t + 100);
        arr[i] = bx + nx * SCALE * 0.06;
        arr[i + 1] = by + ny * SCALE * 0.05;
      }
      cp.geo.attributes.position.needsUpdate = true;
    });

    renderer.render(scene, camera);
    clippedPreview?.blit();
  }
  // Called directly, not scheduled — see the matching note in harmonics.js.
  // A tile whose only frame is a queued rAF callback can be paused before
  // that callback runs and then has never drawn anything; animate() schedules
  // the next frame itself, so this draws frame 0 and starts the loop.
  animate();

  const resize = bindGuardedResize(container, () => {
    const nw = container.clientWidth || window.innerWidth;
    const nh = container.clientHeight || window.innerHeight;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
    // A window dragged between a Retina and a non-Retina display changes
    // devicePixelRatio with no other signal — see manageRenderer's own note.
    managedRenderer.applyPixelRatio();
  });

  if (initialPieceId != null) {
    // No sub-scene piece addressing yet for this scene — a deep link just
    // opens the scene itself, same as Orrery's own single-piece scenes.
  }

  return {
    // main.js pauses preview tiles while a full scene is open, and on
    // visibilitychange. A paused tile shouldn't be rebuilding 1,008 petal
    // vertices and 2,400 nebula points behind an opaque overlay. The clock is
    // resynced on the way back so the first frame home isn't one long dt —
    // which for this scene would show up as a visible jump in the breath.
    setPaused(next) {
      if (disposed || paused === next) return;
      paused = next;
      if (paused) {
        if (animId !== null) cancelAnimationFrame(animId);
        animId = null;
      } else {
        clock.resync();
        animId = requestAnimationFrame(animate);
      }
    },
    dispose() {
      // First, not last: every deferred callback below reads this before
      // touching scene state.
      disposed = true;
      if (animId !== null) cancelAnimationFrame(animId);
      timers.dispose();
      resize.dispose();
      orbitDrag?.dispose();
      wheelZoom?.dispose();
      touchGuard?.dispose();
      if (onClick) container.removeEventListener('click', onClick);
      if (onPointerMove) container.removeEventListener('pointermove', onPointerMove);
      if (onPointerLeave) container.removeEventListener('pointerleave', onPointerLeave);
      // The stale-listener leak this whole pass turns on — see
      // setSoundEnabled above and bindPersistedSoundToggle's own comment.
      soundToggle.dispose();
      managedRenderer.dispose();
      clippedPreview?.dispose();
      starGeo.dispose(); starMat.dispose();
      nebula.geo.dispose(); nebula.mat.dispose();
      curtainPlanes.forEach(cp => { cp.geo.dispose(); cp.mat.dispose(); cp.tex.dispose(); scene.remove(cp.mesh); });
      seamVeinTex.dispose();
      petalInstances.forEach(inst => { inst.geo.dispose(); inst.mat.dispose(); });
      podGeo.dispose(); podMat.dispose();
      psPoints.geo.dispose(); psPoints.mat.dispose(); psPoints.haloMat.dispose();
      originPoints.geo.dispose(); originPoints.mat.dispose(); originPoints.haloMat.dispose();
      centerPoints.geo.dispose(); centerPoints.mat.dispose(); centerPoints.haloMat.dispose();
      newestGlow.geo.dispose(); newestGlow.mat.dispose(); newestGlow.haloMat.dispose();
      dotTex.dispose();
      // Ambient chime oscillators are one-shot (built fresh per triggered
      // note, same convention as the five petal chimes) — nothing
      // persistent to stop/disconnect here beyond the shared nodes below.
      stopAmbientScheduler();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      muteGain?.disconnect();
      reverbConvolver?.disconnect();
      // Close AND null, in that order — the missing null is precisely why this
      // scene's version of the stale-listener bug presented as an unclearable
      // setInterval rather than as Harmonics' stack of orphaned contexts. Both
      // dispose paths are the same shape now, so the same input can't produce
      // two different failures again.
      if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
      muteGain = reverbConvolver = null;
      soundEnabled = false;
      titleEl?.remove(); hintEl?.remove(); soundToggleEl?.remove();
      jumpList?.dispose(); srLiveEl?.remove();
      container.innerHTML = '';
    },
  };
}
