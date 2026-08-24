import * as THREE from 'three';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, bindTapVsDrag,
  prefersReducedMotion, parseHTML,
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
// A fresh pass, not a reuse of the retired beat-frequency/account-filter
// design (that was built specifically for the projection mechanism this
// pivot removes). Scott's own pick, offered as an explicit choice: a
// breath-synced pad — one soft sine pair through a shared lowpass filter,
// both the pad's volume and the filter's cutoff tracking the exact same
// breathePhase(t) driving the geometry, so the sound and the visual
// "inhale" are the same signal, not two coincidentally-similar cycles.
//
// ─── Touch ───────────────────────────────────────────────────────────────
// Touching anywhere on the flower's real surface (raycast against the
// actual petal/seedpod meshes, not proxy points) triggers a soft pulse of
// light that travels outward from the touched point across the surface —
// the same genuine distance/time wavefront math the retired build used
// (pulseWave, below), adapted from sparse graph edges to a continuous
// mesh. No text, no panel — the entire response is light moving across a
// real surface.

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

// ─── Shared petal topology — every petal (the four simple ones and
// Nature's three sub-lobes) uses the same (u, w) grid and triangle
// index buffer; only the per-instance length/width/height/angle/color
// differ, applied fresh each frame (see updatePetal, below). ────────────
const U_SEGS = 16, W_SEGS = 9;
function buildPetalTopology() {
  const count = U_SEGS * W_SEGS;
  const uArr = new Float32Array(count), wArr = new Float32Array(count);
  for (let iu = 0; iu < U_SEGS; iu++) {
    const u = iu / (U_SEGS - 1);
    for (let iw = 0; iw < W_SEGS; iw++) {
      const w = (iw / (W_SEGS - 1)) * 2 - 1;
      const i = iu * W_SEGS + iw;
      uArr[i] = u; wArr[i] = w;
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
  return { uArr, wArr, indices: new Uint16Array(idx), count };
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
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w0, h0);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);
  if (!preview) container.tabIndex = -1;

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

  // ═══ THE FLOWER ═══════════════════════════════════════════════════════
  const topo = buildPetalTopology();
  const BASE_LENGTH = SCALE * 0.95, BASE_WIDTH = SCALE * 0.30, BASE_HEIGHT = SCALE * 0.38;

  const PETAL_HUE = [0.74, 0.79, 0.83, 0.88]; // Gabriel, Michael, Raphael, Emmanuel
  const NATURE_SUB_HUE = [0.705, 0.72, 0.735]; // Nature's own three sub-lobes — coolest of the violet family, but still violet, not blue
  const GOLD_HUE = 0.115;

  // Petal material — real MeshStandardMaterial so the arch/cup catches
  // the key/rim lights above; vertexColors carries the per-petal hue and
  // the base-to-tip gradient; a low uniform emissive keeps petals from
  // going fully black in shadow, matching the site's glowing-cosmic-
  // subject convention elsewhere (Beamline's vessel, Orbiter's cloud).
  function makePetalMaterial() {
    return new THREE.MeshStandardMaterial({
      vertexColors: true, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.06,
      transparent: true, opacity: 0.95, emissive: new THREE.Color(0x2a1250), emissiveIntensity: 0.55,
    });
  }

  // One petal "instance": its own geometry/buffers (topology shared, only
  // positions/colors are per-instance), plus the parameters updatePetal
  // needs every frame (angle, base dimensions, hue, breathing phase).
  function makePetalInstance({ angle, length, halfWidth, height, hue, swayIndex }) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(topo.count * 3);
    const col = new Float32Array(topo.count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(topo.indices, 1));
    const mat = makePetalMaterial();
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    return {
      angle, cosA: Math.cos(angle), sinA: Math.sin(angle),
      length, halfWidth, height, hue, swayIndex,
      geo, pos, col, mat, mesh,
    };
  }

  const petalInstances = [];
  POWER_SOURCES.forEach((_ps, pi) => {
    const angle = (TWO_PI * pi) / 5;
    if (pi < 4) {
      petalInstances.push(makePetalInstance({
        angle, length: BASE_LENGTH, halfWidth: BASE_WIDTH, height: BASE_HEIGHT,
        hue: PETAL_HUE[pi], swayIndex: pi,
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
          height: BASE_HEIGHT * subHeightScale[si], hue: NATURE_SUB_HUE[si], swayIndex: 4 + si * 0.4,
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
  if (!preview) {
    const frag = parseHTML(outsideHtml);
    titleEl = frag.querySelector('.outside-title');
    hintEl = frag.querySelector('.outside-hint');
    document.body.appendChild(titleEl);
    document.body.appendChild(hintEl);
    soundToggleEl = frag.querySelector('.outside-sound-toggle');
    soundToggleLabelEl = soundToggleEl.querySelector('.outside-sound-toggle-label');
    document.body.appendChild(soundToggleEl);
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
  function triggerPulse(point) { pulseOrigin.copy(point); pulseStart = elapsed; pulseActive = true; }
  function pulseWave(t, dist) {
    if (t < 0) return 0;
    const wf = t - dist / PULSE_SPEED;
    return Math.exp(-(wf * wf) / (2 * PULSE_WIDTH * PULSE_WIDTH));
  }
  function pulseBoostAt(x, y, z) {
    if (!pulseActive) return 0;
    _pv.set(x, y, z);
    return pulseWave(elapsed - pulseStart, pulseOrigin.distanceTo(_pv)) * PULSE_BOOST;
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
      if (hits.length) triggerPulse(hits[0].point);
    };
    container.addEventListener('click', onClick);
  }

  // ─── Sound — breath-synced pad. Root + fifth sine pair through one
  // shared lowpass filter; both the pad's own volume and the filter's
  // cutoff track breathePhase(t) directly, so the sound "inhales" on
  // exactly the same signal driving the geometry, not a separate cycle
  // that merely happens to feel similar. Lazy AudioContext on first
  // gesture, same convention every other scene's sound toggle uses. ──────
  let audioCtx = null, oscA = null, oscB = null, filter = null, padGain = null, muteGain = null;
  let soundEnabled = false;
  const PAD_ROOT_HZ = 110, PAD_FIFTH_HZ = 164.81;
  const FILTER_MIN_HZ = 260, FILTER_MAX_HZ = 1300;
  const PAD_GAIN_MIN = 0.035, PAD_GAIN_MAX = 0.1;
  function buildAudioGraph() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    muteGain = audioCtx.createGain(); muteGain.gain.value = 0;
    padGain = audioCtx.createGain(); padGain.gain.value = PAD_GAIN_MIN;
    filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass'; filter.Q.value = 0.8; filter.frequency.value = FILTER_MIN_HZ;
    oscA = audioCtx.createOscillator(); oscB = audioCtx.createOscillator();
    oscA.type = 'sine'; oscB.type = 'sine';
    oscA.frequency.value = PAD_ROOT_HZ; oscB.frequency.value = PAD_FIFTH_HZ;
    oscA.connect(filter); oscB.connect(filter);
    filter.connect(padGain); padGain.connect(muteGain); muteGain.connect(audioCtx.destination);
    oscA.start(); oscB.start();
  }
  function setSoundEnabled(on) {
    soundEnabled = on;
    if (on) buildAudioGraph();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (muteGain) {
      const now = audioCtx.currentTime;
      muteGain.gain.cancelScheduledValues(now);
      muteGain.gain.linearRampToValueAtTime(on ? 1 : 0, now + 0.6);
    }
    if (soundToggleEl) {
      soundToggleEl.setAttribute('aria-pressed', String(on));
      if (soundToggleLabelEl) soundToggleLabelEl.textContent = on ? 'Sound on' : 'Sound off';
    }
  }
  if (soundToggleEl) soundToggleEl.addEventListener('click', () => setSoundEnabled(!soundEnabled));

  // ─── Breathing — the sole ambient motion source, unconditional. ────────
  const BREATHE_FREQ = 0.11; // ~57s full cycle
  function breathePhase(t) { return 0.5 + 0.5 * Math.sin(t * BREATHE_FREQ); }
  function petalSway(t, swayIndex) {
    return 1 + 0.03 * Math.sin(t * (0.07 + 0.011 * swayIndex) + swayIndex * 1.9);
  }

  const reduceMotion = prefersReducedMotion();
  let elapsed = 0;
  let animId, lastT = performance.now();
  const tmpColor = new THREE.Color();
  const _anchor = new THREE.Vector3(); // reused scratch — every anchor read/write below happens immediately, no cross-frame state

  function updatePetal(inst, t, globalScaleXY, globalScaleZ) {
    const sway = reduceMotion ? 1 : petalSway(t, inst.swayIndex);
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
      inst.pos[i * 3] = x; inst.pos[i * 3 + 1] = y; inst.pos[i * 3 + 2] = zPlane;

      const lightness = THREE.MathUtils.lerp(0.32, 0.66, u);
      tmpColor.setHSL(inst.hue, 0.6, lightness);
      const boost = pulseBoostAt(x, y, zPlane);
      inst.col[i * 3] = Math.min(1, tmpColor.r + boost);
      inst.col[i * 3 + 1] = Math.min(1, tmpColor.g + boost);
      inst.col[i * 3 + 2] = Math.min(1, tmpColor.b + boost);
    }
    inst.geo.attributes.position.needsUpdate = true;
    inst.geo.attributes.color.needsUpdate = true;
    inst.geo.computeVertexNormals();
    // Bounding sphere is normally computed once, lazily, on first
    // raycast — recomputed explicitly every frame instead, since the
    // breathing motion above moves real vertices and a stale cached
    // sphere from an earlier frame could make touch miss the surface
    // near a petal's own edge.
    inst.geo.computeBoundingSphere();
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

  function animate(now) {
    animId = requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!reduceMotion) elapsed += dt;

    if (pulseActive && elapsed - pulseStart > PULSE_DURATION) pulseActive = false;

    const bp = breathePhase(elapsed);
    const globalScaleXY = 1 + 0.035 * (bp - 0.5) * 2;
    const globalScaleZ = 1 + 0.12 * (bp - 0.5) * 2;

    petalInstances.forEach(inst => {
      inst._curLength = inst.length * globalScaleXY * (reduceMotion ? 1 : petalSway(elapsed, inst.swayIndex));
      inst._curHeight = inst.height * globalScaleZ * (reduceMotion ? 1 : petalSway(elapsed, inst.swayIndex));
      updatePetal(inst, elapsed, globalScaleXY, globalScaleZ);
    });

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

    if (audioCtx && soundEnabled) {
      const nowT = audioCtx.currentTime;
      padGain.gain.setTargetAtTime(THREE.MathUtils.lerp(PAD_GAIN_MIN, PAD_GAIN_MAX, bp), nowT, 0.6);
      filter.frequency.setTargetAtTime(THREE.MathUtils.lerp(FILTER_MIN_HZ, FILTER_MAX_HZ, bp), nowT, 0.6);
    }

    renderer.render(scene, camera);
  }
  animId = requestAnimationFrame(animate);

  const resize = bindGuardedResize(container, () => {
    const nw = container.clientWidth || window.innerWidth;
    const nh = container.clientHeight || window.innerHeight;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });

  if (initialPieceId != null) {
    // No sub-scene piece addressing yet for this scene — a deep link just
    // opens the scene itself, same as Orrery's own single-piece scenes.
  }

  return {
    dispose() {
      cancelAnimationFrame(animId);
      resize.dispose();
      orbitDrag?.dispose();
      wheelZoom?.dispose();
      touchGuard?.dispose();
      if (onClick) container.removeEventListener('click', onClick);
      renderer.dispose();
      starGeo.dispose(); starMat.dispose();
      nebula.geo.dispose(); nebula.mat.dispose();
      petalInstances.forEach(inst => { inst.geo.dispose(); inst.mat.dispose(); });
      podGeo.dispose(); podMat.dispose();
      psPoints.geo.dispose(); psPoints.mat.dispose(); psPoints.haloMat.dispose();
      originPoints.geo.dispose(); originPoints.mat.dispose(); originPoints.haloMat.dispose();
      centerPoints.geo.dispose(); centerPoints.mat.dispose(); centerPoints.haloMat.dispose();
      newestGlow.geo.dispose(); newestGlow.mat.dispose(); newestGlow.haloMat.dispose();
      dotTex.dispose();
      if (oscA) { try { oscA.stop(); } catch { /* already stopped */ } oscA.disconnect(); }
      if (oscB) { try { oscB.stop(); } catch { /* already stopped */ } oscB.disconnect(); }
      filter?.disconnect(); padGain?.disconnect(); muteGain?.disconnect();
      if (audioCtx) audioCtx.close().catch(() => {});
      titleEl?.remove(); hintEl?.remove(); soundToggleEl?.remove();
      container.innerHTML = '';
    },
  };
}
