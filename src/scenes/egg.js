import * as THREE from 'three';
import { poems } from '../text/poems.js';
import { bindOrbitDrag, bindGuardedResize, prefersReducedMotion, bindEscapeClose } from '../utils/sceneKit.js';

// ─── The Egg: Aurorae, Magnetic Field, Satellites ─────────────────────────────
// The glowing green egg — Earth tinted green, always was. Retired the old
// "worldline" concept (Google Maps satellite tiles + a personal geographic
// path — Boston/LA/Boca/Michigan) in favor of something that actually holds
// together as a self-contained WebGL scene, same as every other experience
// on the site: Earth itself, seen the way you don't normally get to —
// its magnetic field traced in glowing lines, the aurora it produces where
// that field lets solar particles in at the poles, and a scatter of small
// satellites actually orbiting it, each on its own tilted, independent path.
//
// No textures fetched over the network — the "planet" surface, like every
// other texture on this site, is a canvas gradient drawn at load time, not
// an image asset.

const EARTH_RADIUS = 1;

// Rebuilt 2026-07-17 for more photorealism — Scott: keep the green glow
// (the emissive tint and atmosphere shell in createEgg do that job), but
// the surface itself should read as an actual planet, not hand-placed
// blobs. Higher resolution, ragged/noisy coastlines instead of clean
// ellipses (built by jittering a polygon's radius per point, then
// scattering smaller satellite islands off the largest ones), subtler
// depth-graded ocean with current-like banding, and terrain shading
// inside the landmasses (lighter highland patches, darker lowland ones)
// instead of a single flat green.
function raggedBlobPath(cx, cxCenter, cyCenter, rx, ry, points = 14) {
  cx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const jitter = 0.72 + Math.random() * 0.56;
    const x = cxCenter + Math.cos(a) * rx * jitter;
    const y = cyCenter + Math.sin(a) * ry * jitter;
    if (i === 0) cx.moveTo(x, y); else cx.lineTo(x, y);
  }
  cx.closePath();
}

function makeEarthTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const cx = c.getContext('2d');
  const W = 1024, H = 512;

  // Ocean base — vertical gradient, darker at the poles, plus a few
  // broad current-like bands for depth variation instead of one flat tone.
  const grad = cx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0,    '#081f2c');
  grad.addColorStop(0.15, '#0d3548');
  grad.addColorStop(0.5,  '#125264');
  grad.addColorStop(0.85, '#0d3548');
  grad.addColorStop(1,    '#081f2c');
  cx.fillStyle = grad;
  cx.fillRect(0, 0, W, H);

  cx.globalAlpha = 0.5;
  for (let i = 0; i < 10; i++) {
    const y = Math.random() * H;
    const bandGrad = cx.createLinearGradient(0, y - 18, 0, y + 18);
    bandGrad.addColorStop(0, 'rgba(30,90,110,0)');
    bandGrad.addColorStop(0.5, 'rgba(40,110,130,0.5)');
    bandGrad.addColorStop(1, 'rgba(30,90,110,0)');
    cx.fillStyle = bandGrad;
    cx.fillRect(0, y - 18, W, 36);
  }
  cx.globalAlpha = 1;

  // Landmasses — ragged silhouettes (not clean ellipses), each with a
  // couple of smaller satellite islands trailing off it, and simple
  // terrain shading inside (a highland pass, a lowland pass) so they
  // don't read as a single flat green shape.
  const continents = [
    [160, 190, 92, 58], [240, 260, 58, 42], [460, 140, 130, 56],
    [520, 280, 78, 68], [680, 120, 110, 48], [740, 240, 68, 78],
    [840, 360, 92, 44], [80, 340, 72, 40], [360, 380, 100, 36],
    [900, 150, 44, 60],
  ];
  continents.forEach(([bx, by, bw, bh]) => {
    raggedBlobPath(cx, bx, by, bw, bh, 16);
    const g = cx.createRadialGradient(bx - bw * 0.2, by - bh * 0.25, bw * 0.1, bx, by, bw * 1.1);
    g.addColorStop(0,   'rgba(96,122,66,0.92)');
    g.addColorStop(0.6, 'rgba(70,98,54,0.9)');
    g.addColorStop(1,   'rgba(52,78,46,0.88)');
    cx.fillStyle = g;
    cx.fill();

    // A couple of small satellite islands off the coast.
    const islandCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < islandCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = (bw + bh) * 0.42;
      const ix = bx + Math.cos(a) * dist;
      const iy = by + Math.sin(a) * dist * 0.6;
      raggedBlobPath(cx, ix, iy, 6 + Math.random() * 10, 4 + Math.random() * 7, 8);
      cx.fillStyle = 'rgba(66, 92, 52, 0.8)';
      cx.fill();
    }

    // Terrain shading patches within the landmass — lighter (highland/
    // arid) and darker (forested/lowland) blotches, clipped to the shape.
    cx.save();
    raggedBlobPath(cx, bx, by, bw, bh, 16);
    cx.clip();
    for (let i = 0; i < 5; i++) {
      const px = bx + (Math.random() - 0.5) * bw * 1.6;
      const py = by + (Math.random() - 0.5) * bh * 1.6;
      const pr = 12 + Math.random() * 22;
      const light = Math.random() > 0.5;
      cx.fillStyle = light ? 'rgba(150,140,90,0.18)' : 'rgba(30,50,26,0.22)';
      cx.beginPath();
      cx.ellipse(px, py, pr, pr * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
      cx.fill();
    }
    cx.restore();
  });

  // Ice caps, softened at the edge rather than a hard band.
  const iceN = cx.createLinearGradient(0, 0, 0, 30);
  iceN.addColorStop(0, 'rgba(225,238,242,0.75)');
  iceN.addColorStop(1, 'rgba(225,238,242,0)');
  cx.fillStyle = iceN;
  cx.fillRect(0, 0, W, 30);
  const iceS = cx.createLinearGradient(0, H - 30, 0, H);
  iceS.addColorStop(0, 'rgba(225,238,242,0)');
  iceS.addColorStop(1, 'rgba(225,238,242,0.75)');
  cx.fillStyle = iceS;
  cx.fillRect(0, H - 30, W, 30);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// A separate, mostly-transparent cloud layer sphere sitting just outside
// the surface — real Earth renders always separate clouds from terrain;
// having them as their own slightly-larger, independently-rotating shell
// (rather than baked into the surface texture) is most of what actually
// reads as "photorealistic" rather than "textured ball."
function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const cx = c.getContext('2d');
  cx.clearRect(0, 0, 1024, 512);
  const puffCount = 260;
  for (let i = 0; i < puffCount; i++) {
    const x = Math.random() * 1024;
    // Weight toward mid-latitudes/bands, thinner at the poles, like real
    // cloud cover, with a bit of clustering into loose streaks.
    const bandY = 90 + Math.random() * 332;
    const y = bandY + (Math.random() - 0.5) * 40;
    const r = 8 + Math.random() * 26;
    const alpha = 0.06 + Math.random() * 0.16;
    const g = cx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = g;
    cx.beginPath();
    cx.ellipse(x, y, r, r * 0.55, Math.random() * Math.PI, 0, Math.PI * 2);
    cx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// ─── Magnetic field lines ──────────────────────────────────────────────────
// A dipole field: lines leave one pole, arc out and around, return at the
// other. Approximated with the standard dipole field-line shape
// r = L * sin^2(theta), swept around the polar axis at a handful of
// longitudes, same idea as real field-line diagrams.
function buildFieldLines(preview) {
  const group = new THREE.Group();
  const lineCount = preview ? 5 : 9;
  const mat = new THREE.LineBasicMaterial({
    color: 0x66ccff, transparent: true, opacity: preview ? 0.3 : 0.38,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const lines = [];

  for (let i = 0; i < lineCount; i++) {
    const L = 1.5 + (i / lineCount) * 1.6; // shell size — bigger loops further out
    const lon = (i / lineCount) * Math.PI * 2 * 0.6; // spread around, not full ring (reads as field lines, not a cage)
    const pts = [];
    const steps = 48;
    for (let s = 0; s <= steps; s++) {
      const theta = (s / steps) * Math.PI; // 0..pi, pole to pole
      const sinT = Math.sin(theta);
      const r = L * sinT * sinT;
      if (r < EARTH_RADIUS * 0.98) continue; // stay outside the planet
      const y = r * Math.cos(theta);
      const xz = r * Math.sin(theta);
      pts.push(new THREE.Vector3(xz * Math.cos(lon), y, xz * Math.sin(lon)));
    }
    if (pts.length < 2) continue;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, mat);
    group.add(line);
    lines.push({ line, geo, lon });
  }
  return { group, mat, lines };
}

// ─── Aurora curtains ────────────────────────────────────────────────────────
// Rebuilt 2026-07-17 — Scott, seeing it running, questioned the original
// design: sprites standing straight up off the pole like a crown of spikes.
// That's not what the aurora actually looks like from this vantage. Seen
// from orbit (which is where this camera sits), it's the "auroral oval" —
// a ragged glowing BAND hugging the curve of the planet at high latitude,
// not rays radiating outward. Rebuilt as a distorted, ragged ring (a
// perturbed torus, jittered so it reads as irregular rather than a clean
// donut) sitting close to the surface at each pole, with a green-to-violet
// gradient across its width standing in for the curtain's own vertical
// structure. A handful of short shimmer sprites are layered on top for
// texture/rays, but they're subordinate now — accents on the band, not
// the shape itself.
function makeAuroraBandTexture() {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 128;
  const cx = c.getContext('2d');
  const grad = cx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0,    'rgba(60,255,150,0)');
  grad.addColorStop(0.22, 'rgba(60,255,150,0.55)');
  grad.addColorStop(0.5,  'rgba(110,255,190,0.42)');
  grad.addColorStop(0.78, 'rgba(150,120,255,0.32)');
  grad.addColorStop(1,    'rgba(150,120,255,0)');
  cx.fillStyle = grad;
  cx.fillRect(0, 0, 8, 128);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function makeShimmerTexture() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 64;
  const cx = c.getContext('2d');
  const grad = cx.createLinearGradient(0, 64, 0, 0);
  grad.addColorStop(0,    'rgba(90,255,170,0)');
  grad.addColorStop(0.3,  'rgba(90,255,170,0.4)');
  grad.addColorStop(1,    'rgba(150,255,190,0)');
  cx.fillStyle = grad;
  cx.fillRect(0, 0, 16, 64);
  return new THREE.CanvasTexture(c);
}

function buildAurorae(preview) {
  const group = new THREE.Group();
  const bandTex = makeAuroraBandTexture();
  const shimmerTex = makeShimmerTexture();
  const bands = [];
  const shimmers = [];

  [1, -1].forEach(hemisphere => {
    const polarAngle = 0.34 + Math.random() * 0.05; // how far from the pole, radians
    const ringR = Math.sin(polarAngle) * (EARTH_RADIUS * 1.015);
    const y = hemisphere * Math.cos(polarAngle) * (EARTH_RADIUS * 1.015);

    // The band itself — a torus standing in for the curtain, jittered
    // around its main ring so the oval reads as ragged/irregular rather
    // than a machined donut, the way the real auroral oval is never a
    // clean circle.
    const radialSegs = preview ? 48 : 72;
    const tubeSegs = 10;
    const tubeR = EARTH_RADIUS * (preview ? 0.1 : 0.12);
    const bandGeo = new THREE.TorusGeometry(ringR, tubeR, tubeSegs, radialSegs);
    const posAttr = bandGeo.attributes.position;
    // Perturb per main-ring vertex (grouped by radial step) so the whole
    // tube cross-section at that step shifts together, keeping the tube's
    // own shape intact while the ring's path gets ragged.
    const jitter = [];
    for (let i = 0; i <= radialSegs; i++) jitter.push((Math.random() - 0.5) * ringR * 0.22);
    for (let i = 0; i < posAttr.count; i++) {
      const ringStep = Math.floor((i / posAttr.count) * (radialSegs + 1)) % (radialSegs + 1);
      const j = jitter[ringStep] || 0;
      const x = posAttr.getX(i), z = posAttr.getZ(i);
      const len = Math.hypot(x, z) || 1;
      posAttr.setX(i, x + (x / len) * j);
      posAttr.setZ(i, z + (z / len) * j);
    }
    posAttr.needsUpdate = true;
    bandGeo.computeVertexNormals();

    const bandMat = new THREE.MeshBasicMaterial({
      map: bandTex, transparent: true, opacity: 0.6 + Math.random() * 0.15,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    group.add(band);
    bands.push({ mesh: band, mat: bandMat, baseOpacity: bandMat.opacity, phase: Math.random() * Math.PI * 2 });

    // A few short shimmer rays along the band for texture — much shorter
    // and sparser than the old design, an accent rather than the shape.
    const shimmerCount = preview ? 5 : 9;
    for (let i = 0; i < shimmerCount; i++) {
      const lon = (i / shimmerCount) * Math.PI * 2 + Math.random() * 0.3;
      const mat = new THREE.SpriteMaterial({
        map: shimmerTex, transparent: true, opacity: 0.35 + Math.random() * 0.25,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      const h = 0.1 + Math.random() * 0.12;
      sprite.scale.set(0.1, h, 1);
      sprite.position.set(
        ringR * Math.cos(lon), y + hemisphere * h * 0.35, ringR * Math.sin(lon)
      );
      group.add(sprite);
      shimmers.push({ sprite, mat, phase: Math.random() * Math.PI * 2, baseOpacity: mat.opacity });
    }
  });

  return { group, bands, shimmers, bandTex, shimmerTex };
}

// ─── Satellites ─────────────────────────────────────────────────────────────
// Same tilted-pivot orbit trick as the orrery in orrery.js: rotate the pivot,
// the body (attached at a fixed radius on the pivot) sweeps a real orbit.
// 2026-07-17: each satellite now carries one of Scott's poems (src/text/
// poems.js) and is clickable, same mechanism as the geodesic sphere's
// facet-to-fragment links in sphere.js — a raycast hit opens a text panel.
// A small emissive beacon and a generous invisible hit-sphere (the visible
// body is tiny) make them findable/clickable at this scale.
function buildSatellites(preview) {
  const group = new THREE.Group();
  const count = preview ? 4 : 8;
  const sats = [];
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0xe8e4d8 });
  const panelMat = new THREE.MeshBasicMaterial({
    color: 0x3f6fb0, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
  });
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const trailMat = new THREE.LineBasicMaterial({
    color: 0xffe08a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false,
  });

  for (let i = 0; i < count; i++) {
    const radius = 1.35 + Math.random() * 0.85;
    const incl = Math.random() * Math.PI;      // orbital inclination
    const spin = (Math.random() - 0.5) * 0.4;  // ascending-node-ish extra tilt

    const pivot = new THREE.Object3D();
    pivot.rotation.x = incl;
    pivot.rotation.z = spin;
    pivot.rotation.y = Math.random() * Math.PI * 2;
    group.add(pivot);

    const body = new THREE.Group();
    const coreGeo = new THREE.BoxGeometry(0.026, 0.026, 0.026);
    body.add(new THREE.Mesh(coreGeo, bodyMat));
    const panelGeo = new THREE.PlaneGeometry(0.09, 0.026);
    const p1 = new THREE.Mesh(panelGeo, panelMat); p1.position.x =  0.06;
    const p2 = new THREE.Mesh(panelGeo, panelMat); p2.position.x = -0.06;
    body.add(p1, p2);
    // A small glowing beacon — reads as "this one's alive/clickable"
    // against the tiny grey box. Its own material instance (not shared)
    // so hovering one satellite doesn't light up every satellite's beacon.
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x9fffc8 });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), beaconMat);
    body.add(beacon);
    // Invisible, generous hit target — the visible parts are too small to
    // reliably click/hover on their own.
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), hitMat);
    body.add(hit);
    body.position.x = radius;
    pivot.add(body);

    // Faint orbit ring, so the path is visible even when the satellite itself
    // is a single small point.
    const ringGeo = new THREE.TorusGeometry(radius, 0.002, 6, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffe08a, transparent: true, opacity: 0.12,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    pivot.add(ring);

    sats.push({
      pivot, body, hit, beacon, beaconMat,
      speed: (0.25 + Math.random() * 0.35) * (Math.random() < 0.5 ? 1 : -1),
      ringMat,
      poemIndex: i % poems.length,
    });
  }

  return { group, sats, bodyMat, panelMat, hitMat, trailMat };
}

export function createEgg(container, { preview = false } = {}) {
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  camera.position.set(0, 0.6, preview ? 4.2 : 5.2);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const root = new THREE.Group();
  scene.add(root);

  scene.add(new THREE.AmbientLight(0x224422, 1.1));
  const key = new THREE.DirectionalLight(0x88ffaa, 1.8);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x44ff88, 0.5);
  rim.position.set(-4, -2, -3);
  scene.add(rim);

  // ─── Deep-field stars ───────────────────────────────────────────────────
  const starCount = preview ? 250 : 700;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 20 + Math.random() * 20;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xddeeff, size: 0.045, transparent: true, opacity: 0.5 });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  // ─── Earth ────────────────────────────────────────────────────────────────
  const earthTex = makeEarthTexture();
  const geo = new THREE.SphereGeometry(EARTH_RADIUS, preview ? 32 : 64, preview ? 32 : 64);
  const mat = new THREE.MeshPhongMaterial({
    map: earthTex,
    emissive: 0x0a3318,
    emissiveIntensity: 0.35,
    specular: 0x44ff88,
    shininess: 40,
  });
  const earth = new THREE.Mesh(geo, mat);
  root.add(earth);

  // A separate, mostly-transparent cloud shell, rotating a little faster
  // than the surface for parallax — the single biggest lever for reading
  // as an actual rendered planet rather than a textured ball.
  const cloudTex = makeCloudTexture();
  const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.012, preview ? 32 : 48, preview ? 32 : 48);
  const cloudMat = new THREE.MeshBasicMaterial({
    map: cloudTex, transparent: true, opacity: 0.55, depthWrite: false,
  });
  const clouds = new THREE.Mesh(cloudGeo, cloudMat);
  root.add(clouds);

  // Atmospheric glow shell
  const glowGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.05, 32, 32);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x22ff66, transparent: true, opacity: 0.07, side: THREE.BackSide,
  });
  root.add(new THREE.Mesh(glowGeo, glowMat));

  // ─── Magnetic field + aurorae + satellites ─────────────────────────────────
  const field = buildFieldLines(preview);
  root.add(field.group);

  const aurorae = buildAurorae(preview);
  root.add(aurorae.group);

  const satellites = buildSatellites(preview);
  root.add(satellites.group);

  // ─── Caption + hint + poem panel (full only) ────────────────────────────
  let caption = null, hint = null, panel = null, panelTitle = null, panelContent = null;
  if (!preview && !document.getElementById('egg-styles')) {
    const style = document.createElement('style');
    style.id = 'egg-styles';
    style.textContent = `
      /* z-index must clear #experience-overlay (styles/main.css: fixed,
         z-index:300) — appended to document.body, outside that overlay,
         same reasoning as orrery.js's hint/caption/title fix. */
      #egg-caption, #egg-hint {
        position: fixed; color: rgba(255,255,255,0.35);
        pointer-events: none; text-align: center; z-index: 310;
        font-family: 'Times New Roman', serif;
      }
      #egg-caption {
        bottom: 2rem; left: 50%; transform: translateX(-50%);
        font-size: clamp(0.7rem, 1.6vw, 0.95rem); letter-spacing: 0.06em;
        font-style: italic; white-space: nowrap;
        color: rgba(150,255,190,0.55);
      }
      #egg-hint {
        top: 4.5rem; right: 1.2rem; font-size: 0.55rem; letter-spacing: 0.2em;
        text-transform: uppercase; line-height: 1.8; text-align: right;
        color: rgba(255,255,255,0.3);
      }
      @media (max-width: 600px) {
        #egg-caption { white-space: normal; width: 88vw; font-size: 0.7rem; }
      }
      #egg-panel {
        position: absolute; top: 0; right: 0; width: 38%; height: 100%;
        background: #060a07; border-left: 1px solid rgba(160,255,200,0.15);
        padding: 3rem 2rem; transform: translateX(100%);
        transition: transform .5s cubic-bezier(.16,1,.3,1);
        overflow-y: scroll; z-index: 10;
        scrollbar-color: rgba(160,255,200,0.3) #060a07; scrollbar-width: thin;
        font-family: 'Times New Roman', serif;
      }
      #egg-panel.open { transform: translateX(0); }
      #egg-panel-title {
        font-size: 0.95rem; letter-spacing: 0.2em; text-transform: uppercase;
        color: rgba(190,255,210,0.8); margin-bottom: 0.4rem;
      }
      #egg-panel-source {
        font-size: 0.72rem; letter-spacing: 0.05em; color: rgba(190,255,210,0.32);
        margin-bottom: 1.6rem; font-style: italic;
        border-bottom: 1px solid rgba(160,255,200,0.15); padding-bottom: 1.4rem;
      }
      #egg-panel-content { color: rgba(210,235,220,0.75); font-size: 0.98rem; line-height: 1.85; }
      #egg-panel-content p { margin: 0 0 1.4rem; }
      #egg-panel-close {
        position: absolute; top: 1.5rem; right: 1.5rem; background: none;
        border: none; color: rgba(255,255,255,0.4); font-size: 1.2rem;
        cursor: pointer; padding: .5rem; z-index: 2;
      }
      #egg-panel-close:hover { color: rgba(255,255,255,0.9); }
      @media (max-width: 700px) {
        #egg-panel { width: 88%; padding: 4rem 1.3rem 2rem; }
      }
    `;
    document.head.appendChild(style);
  }
  if (!preview) {
    caption = document.createElement('p');
    caption.id = 'egg-caption';
    caption.textContent = 'the field bends, the sky burns green, small metal things keep their orbits';
    caption.setAttribute('aria-hidden', 'true');
    document.body.appendChild(caption);

    hint = document.createElement('p');
    hint.id = 'egg-hint';
    hint.innerHTML = 'drag to orbit &nbsp;·&nbsp; click a satellite';
    hint.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hint);

    panel = document.createElement('aside');
    panel.id = 'egg-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'egg-panel-title');
    panel.innerHTML = `
      <button id="egg-panel-close" aria-label="Close panel">✕</button>
      <div id="egg-panel-title" tabindex="-1"></div>
      <div id="egg-panel-source"></div>
      <div id="egg-panel-content"></div>
    `;
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.appendChild(panel);
    panelTitle   = panel.querySelector('#egg-panel-title');
    panelContent = panel.querySelector('#egg-panel-content');
    const panelSource = panel.querySelector('#egg-panel-source');

    panel.addEventListener('click', e => e.stopPropagation());
    panel.querySelector('#egg-panel-close').addEventListener('click', e => {
      e.stopPropagation();
      panel.classList.remove('open');
      selectedSat = null;
    });

    panel._setSource = panelSource;
  }

  // ─── Satellite hover/click → poem panel, same raycast pattern as the
  // orrery's control box and sphere's facets. ───────────────────────────
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredSat = null, selectedSat = null;

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function openPoem(sat) {
    const poem = poems[sat.poemIndex];
    if (!panel || !poem) return;
    panelTitle.textContent = poem.title;
    panel._setSource.textContent = poem.source || '';
    panelContent.innerHTML = poem.stanzas
      .map(st => `<p>${escapeHtml(st).replace(/\n/g, '<br>')}</p>`)
      .join('');
    panelContent.scrollTop = 0;
    panel.classList.add('open');
    setTimeout(() => panelTitle.focus(), 50);
  }

  if (!preview) {
    container.addEventListener('mousemove', e => {
      const rect = container.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(satellites.sats.map(s => s.hit));
      const hitSat = hits.length ? satellites.sats.find(s => s.hit === hits[0].object) : null;
      if (hitSat !== hoveredSat) {
        if (hoveredSat) hoveredSat.beaconMat.color.setHex(0x9fffc8);
        hoveredSat = hitSat;
        if (hoveredSat) hoveredSat.beaconMat.color.setHex(0xffffff);
      }
      container.style.cursor = hoveredSat ? 'pointer' : 'default';
    });
    container.addEventListener('click', e => {
      if (panel.classList.contains('open') && !panel.contains(e.target)) {
        panel.classList.remove('open');
        selectedSat = null;
        return;
      }
      if (!hoveredSat) return;
      selectedSat = hoveredSat;
      openPoem(selectedSat);
    });
  }

  // ─── Drag to orbit (mouse + touch, via sceneKit) ────────────────────────
  let autoRotate = true;
  const orbitDrag = bindOrbitDrag(container, {
    onDragStart: () => { autoRotate = false; },
    onDrag: (dx, dy) => {
      root.rotation.y += dx;
      root.rotation.x += dy;
    },
    onDragEnd: () => { setTimeout(() => { autoRotate = true; }, 2500); },
  });

  // Reduced motion: gates the autonomous rotation below (Earth spin, cloud
  // drift, field-line precession, satellite orbits, egg auto-rotate).
  // Drag-to-orbit stays available regardless — that's motion the visitor
  // asks for, not motion imposed on them.
  const reduceMotion = prefersReducedMotion();

  // ─── Animate ──────────────────────────────────────────────────────────────
  let animId, t = 0;
  function animate() {
    animId = requestAnimationFrame(animate);
    t += 0.01;

    if (!reduceMotion) {
      earth.rotation.y = t * (preview ? 0.06 : 0.03);
      clouds.rotation.y = t * (preview ? 0.06 : 0.03) * 1.35;
      field.group.rotation.y = t * 0.015;
      satellites.sats.forEach(s => {
        s.pivot.rotation.y += s.speed * 0.01;
      });
      if (autoRotate && !orbitDrag.isDragging) {
        root.rotation.y += preview ? 0.0015 : 0.0009;
      }
    }

    glowMat.opacity = 0.05 + Math.sin(t * 1.2) * 0.025;

    field.lines.forEach((l, i) => {
      field.mat.opacity = (preview ? 0.3 : 0.38) + Math.sin(t * 0.6 + i) * 0.05;
    });

    aurorae.bands.forEach(b => {
      b.phase += 0.012;
      b.mat.opacity = Math.max(0, b.baseOpacity + Math.sin(b.phase) * 0.12);
    });
    aurorae.shimmers.forEach(s => {
      s.phase += 0.025;
      s.mat.opacity = Math.max(0, s.baseOpacity + Math.sin(s.phase) * 0.2);
    });

    renderer.render(scene, camera);
  }
  animate();

  const resize = bindGuardedResize(container, (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // Escape closes the poem panel from anywhere, matching standard
  // modal-dialog expectation (previously only the close button or a
  // click outside the panel would do it).
  const escapeClose = !preview ? bindEscapeClose(() => {
    if (panel && panel.classList.contains('open')) {
      panel.classList.remove('open');
      selectedSat = null;
    }
  }) : null;

  return {
    dispose() {
      cancelAnimationFrame(animId);
      orbitDrag.dispose();
      resize.dispose();
      escapeClose?.dispose();
      renderer.dispose();
      geo.dispose(); mat.dispose(); earthTex.dispose();
      cloudGeo.dispose(); cloudMat.dispose(); cloudTex.dispose();
      glowGeo.dispose(); glowMat.dispose();
      starGeo.dispose(); starMat.dispose();
      field.lines.forEach(l => l.geo.dispose());
      field.mat.dispose();
      aurorae.bands.forEach(b => { b.mesh.geometry.dispose(); b.mat.dispose(); });
      aurorae.shimmers.forEach(s => s.mat.dispose());
      aurorae.bandTex.dispose();
      aurorae.shimmerTex.dispose();
      satellites.sats.forEach(s => {
        s.ringMat.dispose();
        s.hit.geometry.dispose();
        s.beacon.geometry.dispose();
        s.beaconMat.dispose();
      });
      satellites.bodyMat.dispose();
      satellites.panelMat.dispose();
      satellites.hitMat.dispose();
      satellites.trailMat.dispose();
      if (caption) caption.remove();
      if (hint) hint.remove();
      if (panel) panel.remove();
      renderer.domElement.remove();
    }
  };
}
