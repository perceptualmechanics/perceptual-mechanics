import * as THREE from 'three';
import { bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion, onReducedMotionChange, createPanelCloser, createJumpList, mountClippedPreviewCanvas, bindTapVsDrag, parseHTML, claimContainer, disposeSceneGraph, manageRenderer, createFrameClock, trackTimers } from '../../utils/sceneKit.js';
import './orrery.css';
import orreryHtml from './orrery.html?raw';
import { ORRERY } from './orrery.text.js';

const POSTER_EMISSIVE = 0x0c0a08;
const POSTER_HOVER_EMISSIVE = 0x6b5230;



const PLANET_DATA = [
  { name: 'Mercury', color: 0xe0447a, au: 0.39, relDiameter: 0.38, moons: [], e: 0.2056, m0Deg: 174.79 },
  { name: 'Venus',   color: 0x9974c9, au: 0.72, relDiameter: 0.95, moons: [], e: 0.0068, m0Deg: 50.45 },
  { name: 'Earth',   color: 0x35c4d4, au: 1.00, relDiameter: 1.00, moons: [{ relSize: 0.27 }], e: 0.0167, m0Deg: 357.52 },
  { name: 'Mars',    color: 0xe35440, au: 1.52, relDiameter: 0.53, moons: [{ relSize: 0.06 }, { relSize: 0.04 }], e: 0.0934, m0Deg: 19.41 },
  { name: 'Jupiter', color: 0xf0821f, au: 5.20, relDiameter: 11.2, moons: [{ relSize: 0.09 }, { relSize: 0.08 }, { relSize: 0.13 }, { relSize: 0.12 }], e: 0.0484, m0Deg: 19.65 },
  { name: 'Saturn',  color: 0xf0c020, au: 9.54, relDiameter: 9.45, moons: [{ relSize: 0.12 }], ring: true, e: 0.0542, m0Deg: 317.51 },
  { name: 'Uranus',  color: 0xa8cc32, au: 19.2, relDiameter: 4.0,  moons: [{ relSize: 0.03 }], e: 0.0472, m0Deg: 142.27 },
  { name: 'Neptune', color: 0xa8a284, au: 30.1, relDiameter: 3.88, moons: [{ relSize: 0.03 }], e: 0.0086, m0Deg: 259.91 },
  { name: 'Pluto',   color: 0xd9d0ba, au: 39.5, relDiameter: 0.18, moons: [{ relSize: 0.5 }], e: 0.2488, m0Deg: 14.86 },
];

function makeMetalTexture({ base, rust, highlight, paint }) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const cx = c.getContext('2d');
  cx.fillStyle = base;
  cx.fillRect(0, 0, 128, 128);

  cx.globalAlpha = 0.18;
  cx.strokeStyle = highlight;
  for (let i = 0; i < 14; i++) {
    cx.lineWidth = 0.6 + Math.random() * 1.6;
    const x = Math.random() * 128;
    cx.beginPath();
    cx.moveTo(x, 0);
    cx.lineTo(x + (Math.random() - 0.5) * 18, 128);
    cx.stroke();
  }

  cx.globalAlpha = 0.4;
  cx.fillStyle = rust;
  for (let i = 0; i < 16; i++) {
    const bx = Math.random() * 128, by = Math.random() * 128, br = 3 + Math.random() * 9;
    cx.beginPath();
    cx.arc(bx, by, br, 0, Math.PI * 2);
    cx.fill();
  }

  if (paint) {
    cx.globalAlpha = 0.75;
    cx.fillStyle = paint;
    for (let i = 0; i < 9; i++) {
      const bx = Math.random() * 128, by = Math.random() * 128;
      const bw = 6 + Math.random() * 22, bh = 4 + Math.random() * 12;
      cx.beginPath();
      cx.ellipse(bx, by, bw, bh, Math.random() * Math.PI, 0, Math.PI * 2);
      cx.fill();
    }
  }

  cx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function paintedMastMaterial(preview) {
  const tex = preview ? null : makeMetalTexture({ base: '#39322b', rust: '#241e18', highlight: '#6d5c48', paint: '#5b3a72' });
  tex?.repeat.set(1, 3);
  return new THREE.MeshStandardMaterial({ map: tex, color: preview ? 0x4d3a5c : 0xffffff, roughness: 0.7, metalness: 0.5 });
}
function bronzeMaterial() {
  const tex = makeMetalTexture({ base: '#8a6438', rust: '#5a4022', highlight: '#d9ab6c' });
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.85 });
}

function addMetalRim(material, colorHex, power = 2.3, glow = 0.07) {
  material.onBeforeCompile = shader => {
    shader.uniforms.pmRimColor = { value: new THREE.Color(colorHex) };
    shader.uniforms.pmRimPower = { value: power };
    shader.uniforms.pmRimGlow  = { value: glow };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `
        #include <common>
        uniform vec3 pmRimColor;
        uniform float pmRimPower;
        uniform float pmRimGlow;
      `)
      .replace('#include <dithering_fragment>', `
        float pmRim = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), pmRimPower);
        gl_FragColor.rgb += pmRim * pmRimGlow * pmRimColor;
        #include <dithering_fragment>
      `);
  };
}
function brassMaterial(preview, repeat = 2) {
  const tex = preview ? null : makeMetalTexture({ base: '#8a6a2e', rust: '#3a2c14', highlight: '#d9b866' });
  tex?.repeat.set(repeat, repeat);
  const mat = new THREE.MeshStandardMaterial({ map: tex, color: preview ? 0x8a6a2e : 0xffffff, roughness: 0.5, metalness: 0.85 });
  addMetalRim(mat, 0xffdca0);
  return mat;
}
function copperMaterial(preview, repeat = 2) {
  const tex = preview ? null : makeMetalTexture({ base: '#9a5230', rust: '#4c8c74', highlight: '#dd8a56' });
  tex?.repeat.set(repeat, repeat);
  const mat = new THREE.MeshStandardMaterial({ map: tex, color: preview ? 0x9a5230 : 0xffffff, roughness: 0.48, metalness: 0.8 });
  addMetalRim(mat, 0xffb37a);
  return mat;
}

function drawSprayPaint(hex) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const cx = c.getContext('2d');
  const col = new THREE.Color(hex);
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  const light = `${Math.min(255, Math.round(col.r * 255 + 60))},${Math.min(255, Math.round(col.g * 255 + 60))},${Math.min(255, Math.round(col.b * 255 + 60))}`;

  cx.fillStyle = '#332a22';
  cx.fillRect(0, 0, 128, 128);

  cx.fillStyle = `rgba(${rgb},0.92)`;
  cx.fillRect(0, 0, 128, 128);

  const passes = 6;
  for (let p = 0; p < passes; p++) {
    const cx0 = 20 + Math.random() * 88, cy0 = 20 + Math.random() * 88;
    const passRadius = 40 + Math.random() * 45;
    const lighten = Math.random() > 0.45;
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 1.4) * passRadius;
      const x = cx0 + Math.cos(a) * r, y = cy0 + Math.sin(a) * r;
      const alpha = (1 - r / passRadius) * (0.22 + Math.random() * 0.3);
      cx.fillStyle = lighten
        ? `rgba(${light},${Math.max(0, alpha) * 0.8})`
        : `rgba(${rgb},${Math.max(0, alpha)})`;
      cx.beginPath();
      cx.arc(x, y, 0.8 + Math.random() * 2.2, 0, Math.PI * 2);
      cx.fill();
    }
  }

  cx.strokeStyle = `rgba(${rgb},0.6)`;
  for (let i = 0; i < 3; i++) {
    const x = 20 + Math.random() * 88;
    const y0 = 20 + Math.random() * 50;
    const len = 15 + Math.random() * 35;
    cx.lineWidth = 0.8 + Math.random() * 1.2;
    cx.beginPath();
    cx.moveTo(x, y0);
    cx.lineTo(x + (Math.random() - 0.5) * 4, y0 + len);
    cx.stroke();
  }

  cx.globalAlpha = 0.18;
  for (let i = 0; i < 70; i++) {
    cx.fillStyle = Math.random() > 0.5 ? '#000000' : '#1a1a1a';
    cx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
  }
  cx.globalAlpha = 1;

  return { canvas: c, ctx: cx };
}
function makeSprayPaintTexture(hex) {
  return new THREE.CanvasTexture(drawSprayPaint(hex).canvas);
}

function hash3(ix, iy, iz, seed) {
  let h = (ix * 374761393 + iy * 668265263 + iz * 2147483647 + seed * 2246822519) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}
function smoothstep01(t) { return t * t * (3 - 2 * t); }
function valueNoise3D(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = smoothstep01(x - ix), fy = smoothstep01(y - iy), fz = smoothstep01(z - iz);
  const c000 = hash3(ix, iy, iz, seed),         c100 = hash3(ix + 1, iy, iz, seed);
  const c010 = hash3(ix, iy + 1, iz, seed),     c110 = hash3(ix + 1, iy + 1, iz, seed);
  const c001 = hash3(ix, iy, iz + 1, seed),     c101 = hash3(ix + 1, iy, iz + 1, seed);
  const c011 = hash3(ix, iy + 1, iz + 1, seed), c111 = hash3(ix + 1, iy + 1, iz + 1, seed);
  const x00 = c000 + (c100 - c000) * fx, x10 = c010 + (c110 - c010) * fx;
  const x01 = c001 + (c101 - c001) * fx, x11 = c011 + (c111 - c011) * fx;
  const y0 = x00 + (x10 - x00) * fy, y1 = x01 + (x11 - x01) * fy;
  return y0 + (y1 - y0) * fz;
}
function fbm3(x, y, z, seed, octaves = 4) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise3D(x * freq, y * freq, z * freq, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2.15;
  }
  return sum / norm; // 0..1
}
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function remap01(x, lo, hi) { return clamp01((x - lo) / (hi - lo)); }


function orreryNowMs() {
  return (typeof window !== 'undefined' && typeof window.__orreryTimeOverrideMs === 'number')
    ? window.__orreryTimeOverrideMs
    : Date.now();
}

const J2000_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0); // J2000.0 — the standard epoch PLANET_DATA's m0Deg values are anchored to
const SECONDS_PER_VISUAL_YEAR = 250;

function normalizeAngle(a) {
  const twoPi = Math.PI * 2;
  return ((a % twoPi) + twoPi) % twoPi;
}

function secondsSinceEpoch(nowMs) { return (nowMs - J2000_EPOCH_MS) / 1000; }

function solveEccentricAnomaly(M, e) {
  let E = M;
  for (let i = 0; i < 6; i++) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

function keplerOrbitPosition(orbit, nowMs) {
  const visualYears = (nowMs - J2000_EPOCH_MS) / 1000 / SECONDS_PER_VISUAL_YEAR;
  const M = normalizeAngle(orbit.m0 + (2 * Math.PI * visualYears) / orbit.periodYears);
  const E = solveEccentricAnomaly(M, orbit.e);
  const rReal = orbit.a * (1 - orbit.e * Math.cos(E));
  const angle = Math.atan2(Math.sqrt(1 - orbit.e * orbit.e) * Math.sin(E), Math.cos(E) - orbit.e);
  return { rScreen: orbit.screenRadius * (rReal / orbit.a), angle };
}

function applyKeplerPosition(mesh, orbit, nowMs) {
  const { rScreen, angle } = keplerOrbitPosition(orbit, nowMs);
  mesh.position.set(rScreen * Math.cos(angle), 0, -rScreen * Math.sin(angle));
  mesh.rotation.y = angle;
}

const MOON_E = 0.06;
const MOON_PERIOD_BASE_SECONDS = 6;
const MOON_GOLDEN_ANGLE = 2.399963229; // radians, ~137.5°

function sphericalDir(u, v, out) {
  const theta = u * Math.PI * 2, phi = v * Math.PI;
  const s = Math.sin(phi);
  out.x = s * Math.cos(theta);
  out.y = Math.cos(phi);
  out.z = s * Math.sin(theta);
  return out;
}

const AGE_FREQ_H = 2.4;       // TUNABLE: roughly how many broad wear/patina blotches wrap the sphere
const AGE_FREQ_EDGE = 8;      // TUNABLE: finer noise that roughens the wear/grime boundary into an organic chip/tarnish edge instead of a smooth gradient ring
const AGE_EDGE_JITTER = 0.08; // TUNABLE: how far AGE_FREQ_EDGE can locally shift the wear/grime threshold
const WEAR_LO = 0.58, WEAR_HI = 0.74;   // TUNABLE: band of the height field that transitions from intact paint to bare, burnished bronze
const GRIME_LO = 0.58, GRIME_HI = 0.74; // TUNABLE: band of (1 - height) that transitions from clean to patinated/grimy — same band as WEAR_LO/HI by design: fbm3's own spread is close to symmetric around 0.5
const AGE_DISPLACE_AMT = 0.07;          // TUNABLE: fraction of radius the surface bulges/dimples by — kept modest, "aged, not decayed"
const SEAM_DIR = new THREE.Vector3(-1, 0, 0); // every planet's mounting arm attaches along local -X (see arm.position.x below) — one fixed direction, true for all nine bodies, not derived per-planet
const SEAM_DOT_LO = 0.55;               // TUNABLE: angular reach (as a dot-product threshold) of the grime smudge around SEAM_DIR
const AGE_SEGMENTS_W = 28, AGE_SEGMENTS_H = 20; // resolution for the hand-built planet geometry below — enough to carry the displacement as real bumps rather than a faceted lump, still trivial at nine bodies

function buildAgedPlanetGeometry(radius, seedH) {
  const positions = [], uvs = [];
  const dir = new THREE.Vector3();
  for (let iy = 0; iy <= AGE_SEGMENTS_H; iy++) {
    const v = iy / AGE_SEGMENTS_H;
    for (let ix = 0; ix <= AGE_SEGMENTS_W; ix++) {
      const u = ix / AGE_SEGMENTS_W;
      sphericalDir(u, v, dir);
      const h = fbm3(dir.x * AGE_FREQ_H, dir.y * AGE_FREQ_H, dir.z * AGE_FREQ_H, seedH, 4);
      const r = radius * (1 + (h - 0.5) * 2 * AGE_DISPLACE_AMT);
      positions.push(dir.x * r, dir.y * r, dir.z * r);
      uvs.push(u, v);
    }
  }
  const indices = [];
  const rowLen = AGE_SEGMENTS_W + 1;
  for (let iy = 0; iy < AGE_SEGMENTS_H; iy++) {
    for (let ix = 0; ix < AGE_SEGMENTS_W; ix++) {
      const a = iy * rowLen + ix, b = a + 1, c = a + rowLen, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function makeAgedPlanetTextures(hex, seedH) {
  const W = 128, H = 128;
  const paintData = drawSprayPaint(hex).ctx.getImageData(0, 0, W, H).data;

  const colorC = document.createElement('canvas'); colorC.width = W; colorC.height = H;
  const roughC = document.createElement('canvas'); roughC.width = W; roughC.height = H;
  const metalC = document.createElement('canvas'); metalC.width = W; metalC.height = H;
  const emisC = document.createElement('canvas'); emisC.width = W; emisC.height = H;
  const colorCx = colorC.getContext('2d'), roughCx = roughC.getContext('2d');
  const metalCx = metalC.getContext('2d'), emisCx = emisC.getContext('2d');
  const colorImg = colorCx.createImageData(W, H), roughImg = roughCx.createImageData(W, H);
  const metalImg = metalCx.createImageData(W, H), emisImg = emisCx.createImageData(W, H);

  const col = new THREE.Color(hex);
  const bronze = { r: 138, g: 100, b: 56 };
  const burnish = { r: 214, g: 178, b: 122 }; // the shine a handled/rubbed high point picks up
  const tarnish = { r: 27, g: 21, b: 15 };

  const dir = new THREE.Vector3();
  for (let py = 0; py < H; py++) {
    const v = (py + 0.5) / H;
    for (let px = 0; px < W; px++) {
      const u = (px + 0.5) / W;
      sphericalDir(u, v, dir);
      const h = fbm3(dir.x * AGE_FREQ_H, dir.y * AGE_FREQ_H, dir.z * AGE_FREQ_H, seedH, 4);
      const edge = fbm3(dir.x * AGE_FREQ_EDGE, dir.y * AGE_FREQ_EDGE, dir.z * AGE_FREQ_EDGE, seedH + 7919, 2);
      const jitter = (edge - 0.5) * AGE_EDGE_JITTER;
      const wearAmt = remap01(h, WEAR_LO + jitter, WEAR_HI + jitter);
      const grimeAmt = remap01(1 - h, GRIME_LO + jitter, GRIME_HI + jitter);
      const seamAmt = remap01(SEAM_DIR.dot(dir), SEAM_DOT_LO, 1) * 0.85;

      const i = (py * W + px) * 4;
      const bronzeR = bronze.r + (burnish.r - bronze.r) * wearAmt;
      const bronzeG = bronze.g + (burnish.g - bronze.g) * wearAmt;
      const bronzeB = bronze.b + (burnish.b - bronze.b) * wearAmt;
      let r = paintData[i] + (bronzeR - paintData[i]) * wearAmt;
      let g = paintData[i + 1] + (bronzeG - paintData[i + 1]) * wearAmt;
      let b = paintData[i + 2] + (bronzeB - paintData[i + 2]) * wearAmt;
      r += (tarnish.r - r) * grimeAmt * 0.8;
      g += (tarnish.g - g) * grimeAmt * 0.8;
      b += (tarnish.b - b) * grimeAmt * 0.8;
      const seamShadow = 1 - seamAmt * 0.55;
      colorImg.data[i] = r * seamShadow; colorImg.data[i + 1] = g * seamShadow; colorImg.data[i + 2] = b * seamShadow; colorImg.data[i + 3] = 255;

      let rough = lerp(0.78, 0.3, wearAmt);
      rough = lerp(rough, 0.92, grimeAmt);
      rough = lerp(rough, Math.min(0.97, rough + 0.15), seamAmt);
      const roughByte = Math.round(clamp01(rough) * 255);
      roughImg.data[i] = roughImg.data[i + 1] = roughImg.data[i + 2] = roughByte; roughImg.data[i + 3] = 255;

      let metal = lerp(0.08, 0.82, wearAmt);
      metal = lerp(metal, metal * 0.5, grimeAmt);
      const metalByte = Math.round(clamp01(metal) * 255);
      metalImg.data[i] = metalImg.data[i + 1] = metalImg.data[i + 2] = metalByte; metalImg.data[i + 3] = 255;

      const emisAmt = clamp01(1 - wearAmt - grimeAmt * 0.6);
      emisImg.data[i] = col.r * 255 * emisAmt;
      emisImg.data[i + 1] = col.g * 255 * emisAmt;
      emisImg.data[i + 2] = col.b * 255 * emisAmt;
      emisImg.data[i + 3] = 255;
    }
  }
  colorCx.putImageData(colorImg, 0, 0);
  roughCx.putImageData(roughImg, 0, 0);
  metalCx.putImageData(metalImg, 0, 0);
  emisCx.putImageData(emisImg, 0, 0);

  const asTexture = c => { const t = new THREE.CanvasTexture(c); t.flipY = false; return t; };
  return { map: asTexture(colorC), roughnessMap: asTexture(roughC), metalnessMap: asTexture(metalC), emissiveMap: asTexture(emisC) };
}

const BOLT_TONE = 0xe6c878;

const PLAYER_RADIUS = 0.3;
const EYE_HEIGHT = 1.7;          // above floorY — happens to land almost
const WALK_SPEED = 2.6;         // units/sec, full speed
const MOVE_ACCEL = 14;          // how briskly velocity eases to target
const LOOK_SENS_MOUSE = 0.0022; // pointer-lock's raw, unscaled movementX/Y
const PITCH_LIMIT = 1.3;        // ~74°, keeps the view from flipping over

const _boltMatrix = new THREE.Matrix4();
function addBolts(parent, geo, mat, count, ringGeoRadius) {
  const bolts = new THREE.InstancedMesh(geo, mat, count);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    _boltMatrix.makeTranslation(Math.cos(a) * ringGeoRadius, Math.sin(a) * ringGeoRadius, 0);
    bolts.setMatrixAt(i, _boltMatrix);
  }
  bolts.instanceMatrix.needsUpdate = true;
  parent.add(bolts);
  return bolts;
}

function addStrut(parent, from, to, thickness, mat, heightSegments = 1, sharedGeo = null) {
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const dist = from.distanceTo(to);
  const geo = sharedGeo || new THREE.CylinderGeometry(thickness, thickness, dist, 6, heightSegments);
  const strut = new THREE.Mesh(geo, mat);
  strut.position.copy(mid);
  strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  parent.add(strut);
  return strut;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function jacobiEigenSymmetric(matrix, n, maxSweeps = 100) {
  const A = matrix.map(row => row.slice());
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let offDiagSum = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) offDiagSum += A[p][q] * A[p][q];
    if (offDiagSum < 1e-24) break; // converged
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-18) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        const app = A[p][p], aqq = A[q][q], apq = A[p][q];
        A[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
        A[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
        A[p][q] = 0; A[q][p] = 0;
        for (let i = 0; i < n; i++) {
          if (i === p || i === q) continue;
          const aip = A[i][p], aiq = A[i][q];
          A[i][p] = c * aip - s * aiq; A[p][i] = A[i][p];
          A[i][q] = s * aip + c * aiq; A[q][i] = A[i][q];
        }
        for (let i = 0; i < n; i++) {
          const vip = V[i][p], viq = V[i][q];
          V[i][p] = c * vip - s * viq;
          V[i][q] = s * vip + c * viq;
        }
      }
    }
  }
  const eigenvalues = Array.from({ length: n }, (_, i) => A[i][i]);
  const order = eigenvalues.map((v, i) => i).sort((a, b) => eigenvalues[a] - eigenvalues[b]);
  return {
    values: order.map(i => eigenvalues[i]),
    vectors: order.map(i => V.map(row => row[i])), // vectors[n] is mode n's own 27-component shape
  };
}

function buildOrrery(preview, suspendTopY, rafterY) {
  const group = new THREE.Group();
  const brassMat = brassMaterial(preview);
  const copperMat = copperMaterial(preview);
  const mastMat = paintedMastMaterial(preview);
  const bronzeMat = bronzeMaterial();

  const HW = 1.4, SR = 1.45, SS = 2.2;

  const boltRadius = (preview ? 0.012 : 0.015) * HW;
  const boltGeo = new THREE.SphereGeometry(boltRadius, 6, 6);
  const boltMat = new THREE.MeshStandardMaterial({ color: BOLT_TONE, roughness: 0.3, metalness: 0.9 });
  addMetalRim(boltMat, 0xfff0c0, 2.0, 0.09);

  const mastHeight = preview ? 3.2 : 4.4;
  const baseY = suspendTopY - mastHeight;
  const coreGeo = new THREE.CylinderGeometry((preview ? 0.05 : 0.06) * HW, (preview ? 0.09 : 0.11) * HW, mastHeight, 8);
  const core = new THREE.Mesh(coreGeo, mastMat);
  core.position.y = baseY + mastHeight / 2;
  group.add(core);

  const collarCount = preview ? 3 : 5;
  const collarGeo = new THREE.TorusGeometry((preview ? 0.1 : 0.13) * HW, 0.012 * HW, 5, 6);
  let prevCollarY = null;
  for (let i = 0; i < collarCount; i++) {
    const y = baseY + (i / (collarCount - 1)) * mastHeight;
    const collar = new THREE.Mesh(collarGeo, brassMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = y;
    group.add(collar);
    if (!preview && prevCollarY !== null) {
      const braceGeo = new THREE.CylinderGeometry(0.008 * HW, 0.008 * HW, Math.hypot(mastHeight / (collarCount - 1), 0.1) * 1.3, 5);
      [0, Math.PI].forEach(rot => {
        const brace = new THREE.Mesh(braceGeo, brassMat);
        brace.position.y = (y + prevCollarY) / 2;
        brace.rotation.z = 0.55;
        brace.rotation.y = rot;
        group.add(brace);
      });
    }
    prevCollarY = y;
  }

  const anchorSpread = preview ? 0.75 : 1.0;
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => {
    const from = new THREE.Vector3(dx * (preview ? 0.11 : 0.14) * HW, suspendTopY, dz * (preview ? 0.11 : 0.14) * HW);
    const to = new THREE.Vector3(dx * anchorSpread, rafterY, dz * anchorSpread);
    addStrut(group, from, to, (preview ? 0.012 : 0.015) * HW, brassMat);
  });

  const hubHalf = (preview ? 0.16 : 0.2) * HW;
  const hubGeo = new THREE.BoxGeometry((preview ? 0.22 : 0.28) * HW, (preview ? 0.16 : 0.2) * HW, (preview ? 0.16 : 0.2) * HW);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.7, metalness: 0.4 });
  const hub = new THREE.Mesh(hubGeo, hubMat);
  hub.position.set(hubHalf, baseY + 0.3, 0);
  group.add(hub);
  const lampGeo = new THREE.SphereGeometry((preview ? 0.035 : 0.045) * HW, 8, 8);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffaa33, emissive: 0xffaa33, emissiveIntensity: 1, roughness: 0.4 });
  const lamp = new THREE.Mesh(lampGeo, lampMat);
  lamp.position.set(0, hubHalf * 0.6, hubHalf * 0.6);
  hub.add(lamp);

  const riserTopY = suspendTopY + (preview ? 1.0 : 1.35);
  addStrut(group, new THREE.Vector3(0, suspendTopY, 0), new THREE.Vector3(0, riserTopY, 0), (preview ? 0.03 : 0.04) * HW, mastMat);
  const dishGroup = new THREE.Group();
  dishGroup.position.y = riserTopY;
  const dishR = (preview ? 0.34 : 0.44) * HW, dishH = (preview ? 0.24 : 0.32) * HW;
  const apexY = -dishH / 2, rimY = dishH / 2;
  const webMat = new THREE.MeshStandardMaterial({
    color: 0xd9a862, emissive: 0xffb35c, emissiveIntensity: 0.38, roughness: 0.28, metalness: 0.9,
  });
  const WEB_SPOKES = 9; // TUNABLE: radial threads, apex to rim
  const WEB_RINGS = 3;  // TUNABLE: cross-bracing circles between apex and rim (rim itself counts as the outermost)
  const spokeDirs = Array.from({ length: WEB_SPOKES }, (_, i) => {
    const a = (i / WEB_SPOKES) * Math.PI * 2;
    return { x: Math.cos(a), z: Math.sin(a) };
  });

  const N_RING = WEB_SPOKES, N_LEVELS = WEB_RINGS, N_JOINTS = N_RING * N_LEVELS; // 27 free joints
  const jointIdx = (level, i) => level * N_RING + i; // level 0..2 = ring 1..3 (rim), i = spoke index
  const jointBasePos = [];
  for (let level = 0; level < N_LEVELS; level++) {
    const rt = (level + 1) / N_LEVELS, y = apexY + (rimY - apexY) * rt, r = dishR * rt;
    for (let i = 0; i < N_RING; i++) {
      const d = spokeDirs[i];
      jointBasePos.push(new THREE.Vector3(d.x * r, y, d.z * r));
    }
  }
  const apexBasePos = new THREE.Vector3(0, apexY, 0);
  const K_RADIAL = 1;
  const K_CIRCUM = (preview ? 0.006 : 0.008) / (preview ? 0.009 : 0.012);
  const K = Array.from({ length: N_JOINTS }, () => new Array(N_JOINTS).fill(0));
  function addSpring(a, b, k) {
    if (a >= 0) K[a][a] += k;
    if (b >= 0) K[b][b] += k;
    if (a >= 0 && b >= 0) { K[a][b] -= k; K[b][a] -= k; }
  }
  for (let i = 0; i < N_RING; i++) {
    addSpring(-1, jointIdx(0, i), K_RADIAL);              // apex - ring1 (this spoke's innermost segment)
    addSpring(jointIdx(0, i), jointIdx(1, i), K_RADIAL);  // ring1 - ring2
    addSpring(jointIdx(1, i), jointIdx(2, i), K_RADIAL);  // ring2 - ring3 (rim)
  }
  for (let level = 0; level < N_LEVELS; level++) {
    for (let i = 0; i < N_RING; i++) {
      addSpring(jointIdx(level, i), jointIdx(level, (i + 1) % N_RING), K_CIRCUM);
    }
  }
  const modes = jacobiEigenSymmetric(K, N_JOINTS);

  const ringStruts = []; // { mesh, jointA, jointB, baseFrom, baseTo, builtLen }
  const strutGeoCache = new Map();
  function addRingStrut(fromPos, toPos, jointA, jointB, thickness) {
    const len = fromPos.distanceTo(toPos);
    const key = `${thickness}|${len.toFixed(5)}`;
    let geo = strutGeoCache.get(key);
    if (!geo) {
      geo = new THREE.CylinderGeometry(thickness, thickness, len, 6, 1);
      strutGeoCache.set(key, geo);
    }
    const mesh = addStrut(dishGroup, fromPos, toPos, thickness, webMat, 1, geo);
    ringStruts.push({ mesh, jointA, jointB, baseFrom: fromPos.clone(), baseTo: toPos.clone(), builtLen: fromPos.distanceTo(toPos) || 1 });
  }
  for (let i = 0; i < N_RING; i++) {
    const thickness = (preview ? 0.009 : 0.012) * HW;
    addRingStrut(apexBasePos, jointBasePos[jointIdx(0, i)], -1, jointIdx(0, i), thickness);
    addRingStrut(jointBasePos[jointIdx(0, i)], jointBasePos[jointIdx(1, i)], jointIdx(0, i), jointIdx(1, i), thickness);
    addRingStrut(jointBasePos[jointIdx(1, i)], jointBasePos[jointIdx(2, i)], jointIdx(1, i), jointIdx(2, i), thickness);
  }
  for (let level = 0; level < N_LEVELS; level++) {
    const thickness = (preview ? 0.006 : 0.008) * HW;
    for (let i = 0; i < N_RING; i++) {
      addRingStrut(jointBasePos[jointIdx(level, i)], jointBasePos[jointIdx(level, (i + 1) % N_RING)], jointIdx(level, i), jointIdx(level, (i + 1) % N_RING), thickness);
    }
  }
  const webHub = new THREE.Mesh(new THREE.SphereGeometry((preview ? 0.028 : 0.036) * HW, 10, 10), webMat);
  webHub.position.y = apexY;
  dishGroup.add(webHub);

  const BASELINE_MODE_COUNT = 2; // TUNABLE: how many of the lowest modes hum continuously
  const basePhase = Array.from({ length: BASELINE_MODE_COUNT }, () => [Math.random(), Math.random(), Math.random()].map(r => r * Math.PI * 2));
  const dishPhysics = { dishGroup, jointBasePos, modes, ringStruts, nJoints: N_JOINTS, basePhase };
  group.add(dishGroup);

  const planets = preview ? PLANET_DATA.slice(0, 5) : PLANET_DATA;
  const sqrtAU = planets.map(p => Math.sqrt(p.au));
  const auMin = Math.min(...sqrtAU), auMax = Math.max(...sqrtAU);
  const sqrtDia = planets.map(p => Math.sqrt(p.relDiameter));
  const diaMin = Math.min(...sqrtDia), diaMax = Math.max(...sqrtDia);
  const innerR = (preview ? 0.55 : 0.6) * SR, outerR = (preview ? 2.1 : 3.7) * SR; // TUNABLE screen-space band the compressed orbits get mapped into — widen the gap for more visual separation between rings
  const minSize = (preview ? 0.018 : 0.024) * SS, maxSize = (preview ? 0.065 : 0.09) * SS; // TUNABLE screen-space band for compressed planet sizes, same idea
  const buildNowMs = orreryNowMs();

  const orbits = [];
  const TILT_BASE = 0.52;
  const TILT_JITTER = 0.03;
  const ringYBase = baseY + mastHeight * 0.3;
  const radii = [];
  const ringInfo = [];

  planets.forEach((planet, i) => {
    const radius = lerp(innerR, outerR, (sqrtAU[i] - auMin) / (auMax - auMin));
    radii.push(radius);
    const size = lerp(minSize, maxSize, (sqrtDia[i] - diaMin) / (diaMax - diaMin));
    const tilt = TILT_BASE + (Math.random() - 0.5) * TILT_JITTER;
    const yOffset = ringYBase + i * (preview ? 0.06 : 0.05);
    ringInfo.push({ radius, yOffset, tilt });

    const ringGeo = new THREE.TorusGeometry(radius, (preview ? 0.011 : 0.014) * HW, 6, 20);
    const ring = new THREE.Mesh(ringGeo, brassMat);
    ring.rotation.x = Math.PI / 2 + tilt;
    ring.position.y = yOffset;
    group.add(ring);
    addBolts(ring, boltGeo, boltMat, 16, radius);

    [0, Math.PI].forEach(angle => {
      const from = new THREE.Vector3(0, yOffset, 0);
      const to = new THREE.Vector3(Math.cos(angle) * radius * 0.94, yOffset, Math.sin(angle) * radius * 0.94);
      addStrut(group, from, to, (preview ? 0.007 : 0.009) * HW, brassMat);
    });

    const pivot = new THREE.Object3D();
    pivot.rotation.x = tilt;
    pivot.position.y = yOffset;
    group.add(pivot);

    const bodyGroup = new THREE.Group();
    pivot.add(bodyGroup);
    const seedH = Math.floor(Math.random() * 1e6);
    let bodyGeo, bodyMat;
    if (preview) {
      bodyGeo = new THREE.SphereGeometry(size, 16, 12);
      bodyMat = new THREE.MeshStandardMaterial({
        map: makeSprayPaintTexture(planet.color), roughness: 0.78, metalness: 0.08,
        emissive: planet.color, emissiveIntensity: 0.17,
      });
    } else {
      bodyGeo = buildAgedPlanetGeometry(size, seedH);
      const agedMaps = makeAgedPlanetTextures(planet.color, seedH);
      bodyMat = new THREE.MeshStandardMaterial({
        map: agedMaps.map,
        roughnessMap: agedMaps.roughnessMap, roughness: 1,
        metalnessMap: agedMaps.metalnessMap, metalness: 1,
        emissiveMap: agedMaps.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.17,
      });
    }
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    bodyGroup.add(body);

    const armGeo = new THREE.CylinderGeometry(0.006 * HW, 0.006 * HW, (preview ? 0.03 : 0.04) * HW, 5);
    const arm = new THREE.Mesh(armGeo, copperMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.x = -(preview ? 0.015 : 0.02) * HW;
    bodyGroup.add(arm);

    if (planet.ring) {
      const satRingGeo = new THREE.RingGeometry(size * 1.4, size * 2.2, 24);
      const satRingMat = new THREE.MeshStandardMaterial({
        color: 0xd8c48a, roughness: 0.6, metalness: 0.4, transparent: true, opacity: 0.75, side: THREE.DoubleSide,
      });
      const satRing = new THREE.Mesh(satRingGeo, satRingMat);
      satRing.rotation.x = Math.PI / 2 - 0.45;
      bodyGroup.add(satRing);
    }

    const moons = planet.moons.map((moon, mi) => {
      const moonPivot = new THREE.Object3D();
      bodyGroup.add(moonPivot);
      const moonSize = Math.max(0.006 * HW, size * moon.relSize * (preview ? 0.8 : 1));
      const moonGeo = new THREE.SphereGeometry(moonSize, 8, 8);
      const moonMesh = new THREE.Mesh(moonGeo, bronzeMat);
      moonPivot.add(moonMesh);
      const moonRadius = size * 1.8 + mi * (size * 0.9 + 0.012 * HW);
      const baseMoonRadius = size * 1.8; // mi === 0 case, defines the base period
      const moonPeriodYears =
        (MOON_PERIOD_BASE_SECONDS * Math.pow(moonRadius / baseMoonRadius, 1.5)) /
        SECONDS_PER_VISUAL_YEAR;
      const moonOrbit = {
        a: moonRadius,
        e: MOON_E,
        m0: mi * MOON_GOLDEN_ANGLE,
        periodYears: moonPeriodYears,
        screenRadius: moonRadius,
      };
      applyKeplerPosition(moonPivot, moonOrbit, buildNowMs);
      return { pivot: moonPivot, orbit: moonOrbit };
    });

    const periodYears = Math.pow(planet.au, 1.5);
    const meanAngularVelocity = (2 * Math.PI) / (periodYears * SECONDS_PER_VISUAL_YEAR);
    const orbitRecord = {
      pivot,
      bodyGroup,
      moons,
      a: planet.au,
      e: planet.e,
      m0: THREE.MathUtils.degToRad(planet.m0Deg),
      periodYears,
      screenRadius: radius,
      speed: meanAngularVelocity / 0.6,
    };
    applyKeplerPosition(bodyGroup, orbitRecord, buildNowMs);
    orbits.push(orbitRecord);
  });

  const marsIdx = planets.findIndex(p => p.name === 'Mars');
  const jupiterIdx = planets.findIndex(p => p.name === 'Jupiter');
  let belt = null;
  if (marsIdx !== -1 && jupiterIdx !== -1) {
    const beltRadius = (radii[marsIdx] + radii[jupiterIdx]) / 2;
    const beltY = ringYBase + ((marsIdx + jupiterIdx) / 2) * (preview ? 0.06 : 0.05);
    const beltGroup = new THREE.Group();
    beltGroup.position.y = beltY;
    beltGroup.rotation.x = (ringInfo[marsIdx].tilt + ringInfo[jupiterIdx].tilt) / 2;
    group.add(beltGroup);
    const debrisMat = new THREE.MeshStandardMaterial({ color: 0x554433, emissive: 0x3a2c1c, emissiveIntensity: 0.35, roughness: 0.85, metalness: 0.3 });
    const debrisGeo = new THREE.IcosahedronGeometry(1, 0);
    const beltCount = preview ? 14 : 34;
    const beltSpread = (radii[jupiterIdx] - radii[marsIdx]) * 0.35;
    for (let i = 0; i < beltCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = beltRadius + (Math.random() - 0.5) * beltSpread;
      const chunk = new THREE.Mesh(debrisGeo, debrisMat);
      const s = ((preview ? 0.014 : 0.019) + Math.random() * (preview ? 0.012 : 0.015)) * HW;
      chunk.scale.setScalar(s);
      chunk.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 0.06, Math.sin(a) * r);
      chunk.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      beltGroup.add(chunk);
    }
    [0, Math.PI / 2].forEach(angle => {
      const from = new THREE.Vector3(0, 0, 0);
      const to = new THREE.Vector3(Math.cos(angle) * beltRadius * 0.96, 0, Math.sin(angle) * beltRadius * 0.96);
      addStrut(beltGroup, from, to, (preview ? 0.006 : 0.008) * HW, brassMat);
    });
    const beltSpeed = (orbits[marsIdx].speed + orbits[jupiterIdx].speed) / 2;
    belt = { group: beltGroup, omega: beltSpeed * 0.6 };
    beltGroup.rotation.y = normalizeAngle(belt.omega * secondsSinceEpoch(buildNowMs));
  }

  const unknowns = [];
  const lastRadius = radii[radii.length - 1];
  const lastY = ringYBase + (planets.length - 1) * (preview ? 0.06 : 0.05);
  const unknownMat = new THREE.MeshStandardMaterial({ color: 0x5a4d3a, roughness: 0.7, metalness: 0.5 });
  const unknownCount = preview ? 1 : 2;
  const unknownGeos = [new THREE.IcosahedronGeometry((preview ? 0.05 : 0.07) * HW, 0)];
  if (unknownCount > 1) unknownGeos.push(new THREE.OctahedronGeometry((preview ? 0.045 : 0.06) * HW, 0));
  for (let i = 0; i < unknownCount; i++) {
    const radius = lastRadius + ((preview ? 0.25 : 0.34) + i * (preview ? 0.18 : 0.24)) * SR;
    const y = lastY + (i + 1) * (preview ? 0.05 : 0.06);
    const angle = i * (Math.PI * 0.7);
    const pivot = new THREE.Object3D();
    pivot.position.y = y;
    group.add(pivot);
    const mesh = new THREE.Mesh(unknownGeos[i % unknownGeos.length], unknownMat);
    mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    pivot.add(mesh);
    const from = new THREE.Vector3(0, y, 0);
    const to = new THREE.Vector3(Math.cos(angle) * radius * 0.9, y, Math.sin(angle) * radius * 0.9);
    addStrut(group, from, to, (preview ? 0.006 : 0.008) * HW, brassMat);
    const u = {
      pivot, mesh,
      direction: 1,
      omegaOrbit: (0.05 + Math.random() * 0.03) * 0.6,
      omegaSpinX: 0, omegaSpinY: 0,
    };
    const spin = 0.3 + Math.random() * 0.4; // TUNABLE: how "tumbly" vs. simply-spinning this object looks
    u.omegaSpinX = spin * 0.6;
    u.omegaSpinY = spin * 0.42;
    const uSec = secondsSinceEpoch(buildNowMs);
    u.pivot.rotation.y = normalizeAngle(u.omegaOrbit * u.direction * uSec);
    u.mesh.rotation.x = normalizeAngle(u.omegaSpinX * uSec);
    u.mesh.rotation.y = normalizeAngle(u.omegaSpinY * uSec);
    unknowns.push(u);
  }

  const colliders = [{ x: 0, z: 0, r: 0.6 }];

  return {
    group, hitTarget: hub, lampMat, orbits, unknowns, dishPhysics, belt, baseY, mastHeight, colliders, ringInfo,
    riserTopY, dishR, dishH,
  };
}

function makeConcreteTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const cx = c.getContext('2d');
  cx.fillStyle = '#232321';
  cx.fillRect(0, 0, 128, 128);
  cx.globalAlpha = 0.3;
  for (let i = 0; i < 20; i++) {
    cx.fillStyle = Math.random() > 0.5 ? '#1a1a18' : '#2c2c29';
    const bx = Math.random() * 128, by = Math.random() * 128, br = 6 + Math.random() * 20;
    cx.beginPath();
    cx.arc(bx, by, br, 0, Math.PI * 2);
    cx.fill();
  }
  cx.globalAlpha = 1;

  [[34, 96, 22], [88, 40, 15]].forEach(([sx, sy, sr]) => {
    const stain = cx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    stain.addColorStop(0, 'rgba(10,9,8,0.55)');
    stain.addColorStop(0.6, 'rgba(10,9,8,0.22)');
    stain.addColorStop(1, 'rgba(10,9,8,0)');
    cx.fillStyle = stain;
    cx.beginPath();
    cx.arc(sx, sy, sr, 0, Math.PI * 2);
    cx.fill();
  });
  cx.globalAlpha = 0.14;
  cx.strokeStyle = '#3a3733';
  cx.lineWidth = 18;
  cx.beginPath();
  cx.moveTo(-10, 70);
  cx.bezierCurveTo(40, 60, 90, 80, 138, 66);
  cx.stroke();
  cx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

const BRICK_UNIT_W = 0.215, BRICK_UNIT_H = 0.065, BRICK_UNIT_MORTAR = 0.010; // metres — a standard modular brick and a 10mm joint
function makeBrickTexture(wallW, wallH, pxPerUnit) {
  const W = Math.round(wallW * pxPerUnit), H = Math.round(wallH * pxPerUnit);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const cx = c.getContext('2d');

  cx.fillStyle = '#8c8474';
  cx.fillRect(0, 0, W, H);

  const brickW = Math.max(4, Math.round(BRICK_UNIT_W * pxPerUnit));
  const brickH = Math.max(2, Math.round(BRICK_UNIT_H * pxPerUnit));
  const mortar = Math.max(1, Math.round(BRICK_UNIT_MORTAR * pxPerUnit));
  const brickBases = ['#8a3f28', '#7a3620', '#98492e', '#6e2f1c', '#8f4530'];
  let row = 0;
  for (let y = -brickH; y < H + brickH; y += brickH + mortar) {
    const offset = (row % 2 === 0) ? 0 : -brickW / 2;
    for (let x = -brickW + offset; x < W + brickW; x += brickW + mortar) {
      const base = brickBases[Math.floor(Math.random() * brickBases.length)];
      cx.fillStyle = base;
      cx.fillRect(x, y, brickW, brickH);
      cx.globalAlpha = 0.14 + Math.random() * 0.22;
      cx.fillStyle = Math.random() > 0.5 ? '#b5502e' : '#5c3018';
      cx.fillRect(x, y, brickW, brickH);
      cx.globalAlpha = 1;
      if (Math.random() < 0.05) {
        cx.globalAlpha = 0.55 + Math.random() * 0.25;
        cx.fillStyle = '#241209';
        cx.fillRect(x, y, brickW, brickH);
        cx.globalAlpha = 1;
      }
      cx.globalAlpha = 0.22 + Math.random() * 0.2;
      cx.fillStyle = Math.random() > 0.5 ? '#3a2418' : '#40382a';
      const bw = brickW * (0.2 + Math.random() * 0.47), bh = brickH * (0.29 + Math.random() * 0.57);
      cx.beginPath();
      cx.ellipse(x + Math.random() * brickW, y + Math.random() * brickH, bw, bh, Math.random() * Math.PI, 0, Math.PI * 2);
      cx.fill();
      cx.globalAlpha = 1;
    }
    row++;
  }

  const streakCount = 3 + Math.floor(Math.random() * 3);
  for (let s = 0; s < streakCount; s++) {
    let sx = Math.random() * W;
    const startY = Math.random() * H * 0.08;
    const runLength = H * (0.35 + Math.random() * 0.4);
    const steps = 70;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const y = startY + t * runLength;
      sx += (Math.random() - 0.5) * 0.033 * pxPerUnit;
      const width = Math.max(1, (0.078 + Math.random() * 0.055 - t * 0.044) * pxPerUnit);
      const alpha = (0.14 + Math.random() * 0.08) * (1 - t * 0.75);
      cx.globalAlpha = Math.max(0, alpha);
      cx.fillStyle = '#241a12';
      cx.beginPath();
      cx.ellipse(sx, y, width, (0.067 + Math.random() * 0.033) * pxPerUnit, 0, 0, Math.PI * 2);
      cx.fill();
    }
  }
  cx.globalAlpha = 1;

  const effloY0 = H * 0.88;
  const effloBlobs = 14 + Math.floor(Math.random() * 10);
  for (let i = 0; i < effloBlobs; i++) {
    const ex = Math.random() * W;
    const ey = effloY0 + Math.random() * (H - effloY0);
    const er = (0.1 + Math.random() * 0.22) * pxPerUnit;
    cx.globalAlpha = 0.09 + Math.random() * 0.13;
    cx.fillStyle = '#d9d7c9';
    cx.beginPath();
    cx.ellipse(ex, ey, er, er * (0.4 + Math.random() * 0.3), Math.random() * Math.PI, 0, Math.PI * 2);
    cx.fill();
  }
  cx.globalAlpha = 1;

  function tornPatch(x, y, r) {
    cx.beginPath();
    const spikes = 22;
    for (let i = 0; i <= spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const lobe = 0.55 + Math.random() * 0.75;
      const jag = 1 + (Math.random() - 0.5) * 0.3;
      const rr = r * lobe * jag;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) cx.moveTo(px, py); else cx.lineTo(px, py);
    }
    cx.closePath();
  }

  const clusters = [
    { cx: W * 0.08, cy: H * 0.85, r: 0.95 * pxPerUnit },  // bottom-left corner, damp/floor-level
    { cx: W * 0.06, cy: H * 0.12, r: 0.58 * pxPerUnit },  // top-left corner, roof-leak adjacent
    { cx: W * 0.62, cy: H * 0.92, r: 0.42 * pxPerUnit },  // a smaller isolated patch, off-corner
  ];
  clusters.forEach(({ cx: ccx, cy: ccy, r }) => {
    const patches = [{ x: ccx, y: ccy, r }];
    const satellites = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < satellites; i++) {
      patches.push({
        x: ccx + (Math.random() - 0.5) * r * 2.2,
        y: ccy + (Math.random() - 0.5) * r * 2.2,
        r: r * (0.25 + Math.random() * 0.3),
      });
    }
    patches.forEach(({ x, y, r: pr }) => {
      cx.globalAlpha = 0.7 + Math.random() * 0.15;
      cx.fillStyle = '#c7bfa4';
      tornPatch(x, y, pr);
      cx.fill();
      cx.globalAlpha = 1;

      const flakes = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < flakes; i++) {
        const fx = x + (Math.random() - 0.5) * pr * 1.3;
        const fy = y + (Math.random() - 0.5) * pr * 1.3;
        cx.globalAlpha = 0.6 + Math.random() * 0.25;
        cx.fillStyle = '#7f3a26';
        cx.beginPath();
        cx.ellipse(fx, fy, 0.02 * pxPerUnit + Math.random() * pr * 0.14, 0.02 * pxPerUnit + Math.random() * pr * 0.1, Math.random() * Math.PI, 0, Math.PI * 2);
        cx.fill();
      }
      cx.globalAlpha = 1;
    });
  });

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  return tex;
}

function makeCardboardTexture() {
  const c = document.createElement('canvas');
  c.width = 96; c.height = 96;
  const cx = c.getContext('2d');
  cx.fillStyle = '#a9884f';
  cx.fillRect(0, 0, 96, 96);
  cx.globalAlpha = 0.25;
  for (let i = 0; i < 10; i++) {
    cx.fillStyle = Math.random() > 0.5 ? '#8a6f3f' : '#c2a366';
    cx.fillRect(Math.random() * 96, Math.random() * 96, 20 + Math.random() * 30, 3 + Math.random() * 6);
  }
  cx.globalAlpha = 0.5;
  cx.fillStyle = '#d9c99a';
  cx.fillRect(0, 40, 96, 10);
  cx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function makeRollupDoorTexture(w, h, pxPerUnit = 96) {
  const W = Math.max(64, Math.round(w * pxPerUnit));
  const H = Math.max(64, Math.round(h * pxPerUnit));
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const cx = c.getContext('2d');

  const slatPx = Math.max(6, Math.round(0.055 * pxPerUnit * 3.2));
  cx.fillStyle = '#4a4640';
  cx.fillRect(0, 0, W, H);

  for (let y = 0; y < H; y += slatPx) {
    const g = cx.createLinearGradient(0, y, 0, y + slatPx);
    g.addColorStop(0.00, '#39352f');
    g.addColorStop(0.18, '#6d675c');
    g.addColorStop(0.55, '#57524a');
    g.addColorStop(0.88, '#3d3933');
    g.addColorStop(1.00, '#2a2723');
    cx.fillStyle = g;
    cx.fillRect(0, y, W, slatPx);
    cx.fillStyle = 'rgba(0,0,0,0.55)';
    cx.fillRect(0, y + slatPx - 1, W, 1);
  }

  cx.globalAlpha = 0.5;
  for (let i = 0; i < 90; i++) {
    const rx = Math.random() * W;
    const bias = Math.random() ** 2.2;               // crowded near the sill
    const ry = H - bias * H * 0.42;
    cx.fillStyle = Math.random() > 0.5 ? '#6b3f22' : '#7d4a25';
    cx.beginPath();
    cx.ellipse(rx, ry, 3 + Math.random() * 16, 2 + Math.random() * 7, 0, 0, Math.PI * 2);
    cx.fill();
  }
  cx.globalAlpha = 0.28;
  for (const sx of [W * 0.44, W * 0.52]) {
    cx.fillStyle = '#6b4526';
    cx.fillRect(sx, H * 0.52, 2 + Math.random() * 3, H * 0.46);
  }
  cx.globalAlpha = 1;

  cx.globalAlpha = 0.22;
  cx.fillStyle = '#c9c2b0';
  cx.font = `bold ${Math.round(H * 0.3)}px Helvetica, Arial, sans-serif`;
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText('4', W * 0.5, H * 0.42);
  cx.globalAlpha = 1;

  for (const [dx, dy, dr] of [[W * 0.22, H * 0.66, W * 0.06], [W * 0.74, H * 0.78, W * 0.045]]) {
    const g = cx.createRadialGradient(dx, dy, 0, dx, dy, dr);
    g.addColorStop(0, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = g;
    cx.beginPath(); cx.arc(dx, dy, dr, 0, Math.PI * 2); cx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePegboardTexture() {
  const c = document.createElement('canvas');
  c.width = 200; c.height = 260;
  const cx = c.getContext('2d');
  cx.fillStyle = '#8a7856';
  cx.fillRect(0, 0, 200, 260);
  cx.fillStyle = '#5f5138';
  for (let y = 12; y < 260; y += 16) {
    for (let x = 12; x < 200; x += 16) {
      cx.beginPath();
      cx.arc(x, y, 1.6, 0, Math.PI * 2);
      cx.fill();
    }
  }
  cx.strokeStyle = '#1c1a16';
  cx.fillStyle = '#232019';

  cx.save();
  cx.translate(50, 70);
  cx.rotate(-0.4);
  cx.lineWidth = 6;
  cx.beginPath(); cx.moveTo(-30, 0); cx.lineTo(30, 0); cx.stroke();
  cx.beginPath(); cx.arc(-32, 0, 9, 0.6, Math.PI * 2 - 0.6); cx.stroke();
  cx.beginPath(); cx.arc(32, 0, 7, 0, Math.PI * 2); cx.fill();
  cx.restore();

  cx.save();
  cx.translate(140, 90);
  cx.rotate(0.3);
  cx.fillRect(-4, -10, 8, 55);
  cx.fillRect(-20, -22, 40, 16);
  cx.restore();

  cx.save();
  cx.translate(90, 175);
  cx.rotate(-0.15);
  cx.beginPath();
  cx.moveTo(-45, 10); cx.lineTo(35, -20); cx.lineTo(35, 4); cx.lineTo(-45, 22); cx.closePath();
  cx.fill();
  cx.fillRect(30, -24, 22, 30);
  cx.restore();

  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function makePosterTexture(band, sub) {
  const c = document.createElement('canvas');
  c.width = 260; c.height = 364;
  const cx = c.getContext('2d');
  cx.fillStyle = '#d8d2ba';
  cx.fillRect(0, 0, 260, 364);

  cx.globalAlpha = 0.5;
  for (let i = 0; i < 340; i++) {
    cx.fillStyle = Math.random() > 0.5 ? '#00000022' : '#ffffff22';
    cx.fillRect(Math.random() * 260, Math.random() * 364, 1, 1);
  }
  cx.globalAlpha = 1;

  cx.strokeStyle = '#0e0c0a';
  cx.lineWidth = 8;
  cx.strokeRect(13, 13, 234, 338);

  cx.fillStyle = '#0a0908';
  cx.textAlign = 'center';
  cx.font = `bold ${band.length > 8 ? 34 : 44}px Impact, "Arial Narrow", sans-serif`;
  cx.save();
  cx.translate(130, 169);
  cx.rotate(-0.03);
  cx.fillText(band.toUpperCase(), 0, 0);
  cx.restore();

  cx.beginPath();
  cx.moveTo(39, 202); cx.lineTo(221, 202);
  cx.lineWidth = 4;
  cx.stroke();

  cx.font = 'bold 19px Georgia, serif';
  cx.fillText(sub, 130, 241);
  cx.font = '15px Georgia, serif';
  cx.fillText('$5 AT THE DOOR', 130, 273);

  const grad = cx.createRadialGradient(208, 299, 5, 208, 299, 65);
  grad.addColorStop(0, 'rgba(90,70,40,0.28)');
  grad.addColorStop(1, 'rgba(90,70,40,0)');
  cx.fillStyle = grad;
  cx.beginPath();
  cx.arc(208, 299, 65, 0, Math.PI * 2);
  cx.fill();

  cx.fillStyle = 'rgba(220,215,200,0.55)';
  cx.fillRect(8, 3, 44, 18);
  cx.fillRect(208, 3, 44, 18);

  const yellow = cx.createRadialGradient(130, 182, 40, 130, 182, 230);
  yellow.addColorStop(0, 'rgba(150,110,50,0.08)');
  yellow.addColorStop(1, 'rgba(120,85,35,0.32)');
  cx.fillStyle = yellow;
  cx.fillRect(0, 0, 260, 364);

  const curl = cx.createLinearGradient(260, 0, 205, 0);
  curl.addColorStop(0, 'rgba(20,15,8,0.35)');
  curl.addColorStop(1, 'rgba(20,15,8,0)');
  cx.fillStyle = curl;
  cx.fillRect(205, 0, 55, 364);

  const tex = new THREE.CanvasTexture(c);
  return tex;
}


function makeDustMoteTexture() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const cx = c.getContext('2d');
  const g = cx.createRadialGradient(8, 8, 0, 8, 8, 8);
  g.addColorStop(0,   'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  g.addColorStop(1,   'rgba(255,255,255,0)');
  cx.fillStyle = g;
  cx.fillRect(0, 0, 16, 16);
  return new THREE.CanvasTexture(c);
}

function makeWoodTexture(base, dark) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const cx = c.getContext('2d');
  cx.fillStyle = base;
  cx.fillRect(0, 0, 64, 64);
  cx.globalAlpha = 0.28;
  cx.strokeStyle = dark;
  for (let i = 0; i < 9; i++) {
    cx.lineWidth = 0.5 + Math.random() * 1.4;
    const y = Math.random() * 64;
    cx.beginPath();
    cx.moveTo(0, y);
    cx.bezierCurveTo(20, y + (Math.random() - 0.5) * 6, 44, y + (Math.random() - 0.5) * 6, 64, y + (Math.random() - 0.5) * 4);
    cx.stroke();
  }
  cx.globalAlpha = 0.3;
  for (let i = 0; i < 3; i++) {
    cx.fillStyle = dark;
    const bx = Math.random() * 64, by = Math.random() * 64, br = 2 + Math.random() * 2.5;
    cx.beginPath();
    cx.ellipse(bx, by, br, br * 1.7, 0, 0, Math.PI * 2);
    cx.fill();
  }
  cx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function buildWarehouse(preview, floorY, ceilingY, rafterY, holeW, moonPos, moonTargetPos, moonAngle) {
  const group = new THREE.Group();
  const span = preview ? 14 : 20;
  const wallDist = preview ? 5 : 12.5;

  const floorMat = new THREE.MeshStandardMaterial({ map: makeConcreteTexture(), roughness: 0.95, metalness: 0.05 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(span * 2, span * 2), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  group.add(floor);

  const holeH = holeW;
  const hole2W = holeW * 0.55, hole2H = holeH * 0.55;
  const hole2X = span * 0.22, hole2Z = -span * 0.16;
  const shape = new THREE.Shape();
  shape.moveTo(-span, -span);
  shape.lineTo(span, -span);
  shape.lineTo(span, span);
  shape.lineTo(-span, span);
  shape.lineTo(-span, -span);
  const hole = new THREE.Path();
  hole.moveTo(-holeW, -holeH);
  hole.lineTo(holeW, -holeH);
  hole.lineTo(holeW, holeH);
  hole.lineTo(-holeW, holeH);
  hole.lineTo(-holeW, -holeH);
  shape.holes.push(hole);
  const hole2 = new THREE.Path();
  hole2.moveTo(hole2X - hole2W, hole2Z - hole2H);
  hole2.lineTo(hole2X + hole2W, hole2Z - hole2H);
  hole2.lineTo(hole2X + hole2W, hole2Z + hole2H);
  hole2.lineTo(hole2X - hole2W, hole2Z + hole2H);
  hole2.lineTo(hole2X - hole2W, hole2Z - hole2H);
  shape.holes.push(hole2);
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x121110, roughness: 0.9, metalness: 0.1, side: THREE.DoubleSide });
  const ceiling = new THREE.Mesh(new THREE.ShapeGeometry(shape), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ceilingY;
  group.add(ceiling);

  const trussMat = new THREE.MeshStandardMaterial({ map: makeMetalTexture({ base: '#2a2620', rust: '#191510', highlight: '#544838' }), roughness: 0.85, metalness: 0.5 });
  const trussLen = preview ? 6 : 8;
  const trussA = new THREE.Mesh(new THREE.BoxGeometry(trussLen, preview ? 0.07 : 0.09, preview ? 0.07 : 0.09), trussMat);
  trussA.position.set(0, rafterY, 0);
  group.add(trussA);
  const trussB = new THREE.Mesh(new THREE.BoxGeometry(preview ? 0.07 : 0.09, preview ? 0.07 : 0.09, trussLen), trussMat);
  trussB.position.set(0, rafterY, 0);
  group.add(trussB);
  [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dz]) => {
    const from = new THREE.Vector3(dx * trussLen / 2, rafterY, dz * trussLen / 2);
    const to = new THREE.Vector3(dx * trussLen / 2, ceilingY - (preview ? 0.5 : 0.7), dz * trussLen / 2);
    addStrut(group, from, to, preview ? 0.02 : 0.026, trussMat);
  });


  const axis = new THREE.Vector3().subVectors(moonTargetPos, moonPos).normalize();
  const arbitrary = Math.abs(axis.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const perpA = new THREE.Vector3().crossVectors(axis, arbitrary).normalize();
  const perpB = new THREE.Vector3().crossVectors(axis, perpA).normalize();
  const tAt = y => (y - moonPos.y) / axis.y; // distance along the axis where the ray's height equals y
  const moteCount = preview ? 105 : 240;
  const motePos = new Float32Array(moteCount * 3);
  const moteBase = new Float32Array(moteCount * 3);
  const moteDrift = [];
  const moteWrapTopY = ceilingY + (moonPos.y - ceilingY) * 0.4;
  const nearT = tAt(moteWrapTopY);
  const farT = tAt(floorY);
  const moteSpan = moteWrapTopY - floorY;
  const moteTanAngle = Math.tan(moonAngle);
  for (let k = 0; k < moteCount; k++) {
    const tt = nearT + Math.random() * (farT - nearT);
    const center = new THREE.Vector3().copy(moonPos).addScaledVector(axis, tt);
    const coneR = Math.max(0.02, tt * moteTanAngle);
    const ang = Math.random() * Math.PI * 2;
    const radFrac = Math.pow(Math.random(), 1.8); // biased toward the axis — see comment above
    const rr = coneR * radFrac;
    const p = center
      .addScaledVector(perpA, Math.cos(ang) * rr)
      .addScaledVector(perpB, Math.sin(ang) * rr);
    moteBase[k * 3] = p.x; moteBase[k * 3 + 1] = p.y; moteBase[k * 3 + 2] = p.z;
    motePos[k * 3] = p.x; motePos[k * 3 + 1] = p.y; motePos[k * 3 + 2] = p.z;
    moteDrift.push({
      riseSpeed: 0.02 + Math.random() * 0.035,
      wobbleAmp: 0.02 + Math.random() * 0.03,
      wobbleSpeed: 0.2 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2,
      span: moteSpan,
      ang,
      radFrac,
    });
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteTex = makeDustMoteTexture();
  const moteMat = new THREE.PointsMaterial({
    color: 0xe8ecff, size: preview ? 0.018 : 0.014, map: moteTex,
    transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending,
    depthWrite: false, sizeAttenuation: true,
  });
  const dustMotes = new THREE.Points(moteGeo, moteMat);
  group.add(dustMotes);

  const wallHeight = ceilingY - floorY;
  const wallW = wallDist * 2 + 0.3;
  const wallMat = new THREE.MeshStandardMaterial({
    map: makeBrickTexture(wallW, wallHeight, preview ? 48 : 96),
    roughness: 0.92, metalness: 0.02,
  });
  const wallGeo = new THREE.PlaneGeometry(wallW, wallHeight);
  const backWall = new THREE.Mesh(wallGeo, wallMat);
  backWall.position.set(0, (ceilingY + floorY) / 2, -wallDist);
  group.add(backWall);
  const sideWall = new THREE.Mesh(wallGeo, wallMat);
  sideWall.rotation.y = Math.PI / 2;
  sideWall.position.set(-wallDist, (ceilingY + floorY) / 2, 0);
  group.add(sideWall);

  const frontWall = new THREE.Mesh(wallGeo, wallMat);
  frontWall.rotation.y = Math.PI;
  frontWall.position.set(0, (ceilingY + floorY) / 2, wallDist);
  group.add(frontWall);
  const farSideWall = new THREE.Mesh(wallGeo, wallMat);
  farSideWall.rotation.y = -Math.PI / 2;
  farSideWall.position.set(wallDist, (ceilingY + floorY) / 2, 0);
  group.add(farSideWall);

  const colliders = [];

  if (!preview) {
    const doorGroup = new THREE.Group();
    const z = wallDist;

    const bayW = 3.6, bayH = Math.min(3.0, wallHeight * 0.84);
    const bayX = -1.9;
    const manW = 0.9, manH = Math.min(2.05, wallHeight * 0.62);
    const manX = 2.4;

    const bayTex = makeRollupDoorTexture(bayW, bayH, 96);
    const bay = new THREE.Mesh(
      new THREE.PlaneGeometry(bayW, bayH),
      new THREE.MeshStandardMaterial({ map: bayTex, roughness: 0.72, metalness: 0.35 })
    );
    bay.rotation.y = Math.PI;
    bay.position.set(bayX, floorY + bayH / 2, z - 0.05);
    doorGroup.add(bay);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x2e2c28, roughness: 0.62, metalness: 0.5 });

    for (const dx of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, bayH + 0.1, 0.16), steelMat);
      rail.position.set(bayX + dx * (bayW / 2 + 0.06), floorY + bayH / 2, z - 0.09);
      doorGroup.add(rail);
    }
    const housing = new THREE.Mesh(new THREE.BoxGeometry(bayW + 0.34, 0.34, 0.3), steelMat);
    housing.position.set(bayX, floorY + bayH + 0.16, z - 0.16);
    doorGroup.add(housing);

    const sill = new THREE.Mesh(
      new THREE.PlaneGeometry(bayW + 0.5, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x3a3936, roughness: 0.97, metalness: 0.02 })
    );
    sill.rotation.x = -Math.PI / 2;
    sill.position.set(bayX, floorY + 0.004, z - 0.38);
    doorGroup.add(sill);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x252320, roughness: 0.8, metalness: 0.25 });
    const jambW = 0.08, headH = 0.09;
    for (const dx of [-1, 1]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(jambW, manH + headH, 0.12), frameMat);
      jamb.position.set(manX + dx * (manW / 2 + jambW / 2), floorY + (manH + headH) / 2, z - 0.06);
      doorGroup.add(jamb);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(manW + jambW * 2, headH, 0.12), frameMat);
    head.position.set(manX, floorY + manH + headH / 2, z - 0.06);
    doorGroup.add(head);

    const outside = new THREE.Mesh(
      new THREE.PlaneGeometry(manW, manH),
      new THREE.MeshBasicMaterial({ color: 0x8a5a22 })
    );
    outside.rotation.y = Math.PI;
    outside.position.set(manX, floorY + manH / 2, z - 0.02);
    doorGroup.add(outside);

    const hinge = new THREE.Group();
    hinge.position.set(manX + manW / 2, floorY + manH / 2, z - 0.14);
    hinge.rotation.y = -0.62;                       // 35.5 degrees into the room
    const leaf = new THREE.Mesh(
      new THREE.BoxGeometry(manW, manH, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x2b2822, roughness: 0.7, metalness: 0.3 })
    );
    leaf.position.x = -manW / 2;
    hinge.add(leaf);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.045, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x6a6256, roughness: 0.5, metalness: 0.7 })
    );
    bar.position.set(-manW + 0.14, 0, -0.09);       // push bar, on the inside face
    hinge.add(bar);
    doorGroup.add(hinge);

    const street = new THREE.SpotLight(0xffa04a, 3.4, 9.0, 0.62, 0.75, 1.4);
    street.position.set(manX, floorY + manH * 0.78, z - 0.16);
    street.target.position.set(manX - 1.5, floorY, z - 5.2);
    street.castShadow = false;
    doorGroup.add(street);
    doorGroup.add(street.target);

    group.add(doorGroup);

    colliders.push({ x: manX + manW / 2 - Math.cos(0.62) * manW * 0.5, z: z - 0.14 - Math.sin(0.62) * manW * 0.5, r: 0.35 });
  }

  let bulbPosition = null;

  const posterMeshes = [];
  if (!preview) {
    const baseY = floorY + wallHeight * 0.34;
    const posters = [
      { band: 'Nirvana', sub: 'Live — All Ages', x: -2.75, y: baseY + 0.2, rot: -0.09, scale: 1.08, z: -wallDist + 0.03 },
      { band: 'R.E.M.', sub: 'Live — Doors 8pm', x: -0.75, y: baseY - 0.34, rot: 0.05, scale: 0.86, z: -wallDist + 0.025 },
      { band: 'Beastie Boys', sub: 'Live — 18+', x: 0.55, y: baseY + 0.44, rot: -0.05, scale: 1.0, z: -wallDist + 0.035 },
      { band: 'For Squirrels', sub: 'Live — This Fri.', x: 2.45, y: baseY - 0.1, rot: 0.09, scale: 0.78, z: -wallDist + 0.02 },
    ];
    posters.forEach(p => {
      const posterMat = new THREE.MeshStandardMaterial({
        map: makePosterTexture(p.band, p.sub), roughness: 0.85, metalness: 0,
        emissive: POSTER_EMISSIVE, emissiveIntensity: 0.78,
      });
      const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.3 * p.scale, 1.82 * p.scale), posterMat);
      poster.position.set(p.x, p.y, p.z);
      poster.rotation.z = p.rot;
      group.add(poster);
      posterMeshes.push({ mesh: poster, band: p.band });
    });

    const pegboardMat = new THREE.MeshStandardMaterial({ map: makePegboardTexture(), roughness: 0.9, metalness: 0 });
    const pegboard = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.9), pegboardMat);
    pegboard.rotation.y = Math.PI / 2;
    pegboard.position.set(-wallDist + 0.03, floorY + wallHeight * 0.5, 2.6);
    group.add(pegboard);

    const cardboardMat = new THREE.MeshStandardMaterial({ map: makeCardboardTexture(), roughness: 0.95, metalness: 0 });
    const boxSizes = [[0.55, 0.4, 0.45], [0.42, 0.35, 0.4], [0.48, 0.3, 0.3]];
    let stackY = floorY;
    boxSizes.forEach((size, i) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(...size), cardboardMat);
      stackY += size[1] / 2;
      box.position.set(-wallDist + 1.2 + i * 0.05, stackY, -wallDist + 0.9 - i * 0.08);
      box.rotation.y = (Math.random() - 0.5) * 0.5;
      stackY += size[1] / 2;
      group.add(box);
    });
    colliders.push({ x: -wallDist + 1.22, z: -wallDist + 0.85, r: 0.45 });

    const tireMat = new THREE.MeshStandardMaterial({ color: 0x18161a, roughness: 0.85, metalness: 0.1 });
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.11, 10, 20), tireMat);
    tire.rotation.x = Math.PI / 2 + 0.28;
    tire.position.set(2.9, floorY + 0.34, -wallDist + 0.35);
    group.add(tire);
    colliders.push({ x: 2.9, z: -wallDist + 0.35, r: 0.42 });

    const woodMat = new THREE.MeshStandardMaterial({ map: makeWoodTexture('#5a4530', '#2c2013'), roughness: 0.85, metalness: 0 });
    const benchHeight = floorY + 0.55;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 1.6), woodMat);
    bench.position.set(-wallDist + 0.4, benchHeight, -1.5);
    group.add(bench);
    [[-0.6, -2.1], [-0.6, -0.9], [0.6, -2.1], [0.6, -0.9]].forEach(([dx, dz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, benchHeight - floorY, 6), woodMat);
      leg.position.set(-wallDist + 0.4 + dx * 0.15, floorY + (benchHeight - floorY) / 2, dz + 0.6);
      group.add(leg);
    });
    colliders.push({ x: -wallDist + 0.4, z: -1.5, r: 0.9 });
    const clutterMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7, metalness: 0.3 });
    [[-0.05, -1.7, 0.12], [0.08, -1.3, 0.09]].forEach(([dx, dz, s]) => {
      const clutter = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s), clutterMat);
      clutter.position.set(-wallDist + 0.4 + dx, benchHeight + 0.025 + s * 0.4, dz);
      clutter.rotation.y = Math.random();
      group.add(clutter);
    });

    const detailMat = new THREE.MeshStandardMaterial({ color: 0x2e2a24, roughness: 0.65, metalness: 0.55 });
    const detailAccentMat = new THREE.MeshStandardMaterial({ color: 0x8a2a1f, roughness: 0.45, metalness: 0.3 });

    const gaugeFaceMat = new THREE.MeshStandardMaterial({ color: 0xc9bfa0, roughness: 0.6, metalness: 0.1 });
    const gaugeGroup = new THREE.Group();
    const gaugeHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 16), detailMat);
    gaugeHousing.rotation.z = Math.PI / 2;
    gaugeGroup.add(gaugeHousing);
    const gaugeFace = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.008, 16), gaugeFaceMat);
    gaugeFace.rotation.z = Math.PI / 2;
    gaugeFace.position.x = 0.015;
    gaugeGroup.add(gaugeFace);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.058, 0.004), detailAccentMat);
    needle.position.set(0.02, 0.02, 0);
    needle.rotation.z = 0.6 + Math.random() * 1.4;
    gaugeGroup.add(needle);
    gaugeGroup.position.set(-wallDist + 0.045, floorY + wallHeight * 0.5 + 0.75, 2.2);
    group.add(gaugeGroup);

    const leverBase = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.05), detailMat);
    leverBase.position.set(-wallDist + 0.4 + 0.14, benchHeight + 0.04, -2.0);
    group.add(leverBase);
    const leverArm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), detailMat);
    leverArm.position.set(0, 0.06, 0);
    leverArm.rotation.z = -0.35;
    leverBase.add(leverArm);
    const leverKnob = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), detailAccentMat);
    leverKnob.position.y = 0.12;
    leverArm.add(leverKnob);

    const pipeStub = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), detailMat);
    pipeStub.rotation.z = Math.PI / 2;
    pipeStub.position.set(-wallDist + 0.08, floorY + 0.5, 0.6);
    group.add(pipeStub);
    const wheelGroup = new THREE.Group();
    const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.009, 6, 16), detailMat);
    wheelGroup.add(wheelRim);
    for (let i = 0; i < 4; i++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 5), detailMat);
      spoke.rotation.z = (i / 4) * Math.PI;
      wheelGroup.add(spoke);
    }
    wheelGroup.rotation.y = Math.PI / 2;
    wheelGroup.rotation.z = Math.random() * Math.PI * 2;
    wheelGroup.position.set(-wallDist + 0.16, floorY + 0.5, 0.6);
    group.add(wheelGroup);


    const boxSizes2 = [[0.5, 0.45, 0.5], [0.38, 0.3, 0.42], [0.3, 0.28, 0.3], [0.44, 0.22, 0.36]];
    let stackY2 = floorY;
    boxSizes2.forEach((size, i) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(...size), cardboardMat);
      stackY2 += size[1] / 2;
      box.position.set(wallDist - 1.4 - i * 0.08, stackY2, -wallDist + 1.1 + i * 0.1);
      box.rotation.y = (Math.random() - 0.5) * 0.7;
      stackY2 += size[1] / 2;
      group.add(box);
    });
    colliders.push({ x: wallDist - 1.4, z: -wallDist + 1.1, r: 0.5 });

    const drumMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.75, metalness: 0.4 });
    [[1.6, -wallDist + 0.45, 0.2], [2.05, -wallDist + 0.4, 0.6]].forEach(([x, z, rotOffset]) => {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.72, 14), drumMat);
      drum.position.set(x, floorY + 0.36, z);
      drum.rotation.y = rotOffset;
      group.add(drum);
      colliders.push({ x, z, r: 0.35 });
    });

    const ladderMat = new THREE.MeshStandardMaterial({ map: makeWoodTexture('#6b5a3c', '#332818'), roughness: 0.8, metalness: 0.1 });
    const ladderGroup = new THREE.Group();
    const railLen = 2.2;
    [-0.18, 0.18].forEach(dx => {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, railLen, 6), ladderMat);
      rail.position.set(dx, 0, 0);
      ladderGroup.add(rail);
    });
    for (let i = 0; i < 6; i++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 6), ladderMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, -railLen / 2 + 0.2 + i * 0.34, 0);
      ladderGroup.add(rung);
    }
    ladderGroup.rotation.x = -0.22;
    ladderGroup.position.set(-3.4, floorY + railLen * 0.46, -wallDist + 0.5);
    group.add(ladderGroup);
    colliders.push({ x: -3.4, z: -wallDist + 0.5, r: 0.3 });

    const plankMat = new THREE.MeshStandardMaterial({ map: makeWoodTexture('#4a3c28', '#241a0e'), roughness: 0.9, metalness: 0 });
    for (let i = 0; i < 4; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.14), plankMat);
      plank.position.set(wallDist - 0.5, floorY + 0.08 + i * 0.05, -wallDist + 2.6);
      plank.rotation.z = 0.05 + i * 0.01;
      plank.rotation.y = 0.15;
      group.add(plank);
    }

    const cableMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.7, metalness: 0.1 });
    for (let i = 0; i < 3; i++) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.22 - i * 0.03, 0.018, 6, 16), cableMat);
      loop.rotation.x = Math.PI / 2;
      loop.position.set(-wallDist + 1.0, floorY + 0.02 + i * 0.015, -0.4);
      group.add(loop);
    }

    const stoolMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.7, metalness: 0.3 });
    const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12), stoolMat);
    stoolSeat.position.set(-wallDist + 0.9, floorY + 0.42, -1.3);
    group.add(stoolSeat);
    colliders.push({ x: -wallDist + 0.9, z: -1.3, r: 0.3 });
    for (let i = 0; i < 3; i++) {
      const legAngle = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6), stoolMat);
      leg.position.set(
        -wallDist + 0.9 + Math.cos(legAngle) * 0.13,
        floorY + 0.21,
        -1.3 + Math.sin(legAngle) * 0.13
      );
      leg.rotation.x = Math.sin(legAngle) * 0.08;
      leg.rotation.z = Math.cos(legAngle) * 0.08;
      group.add(leg);
    }

    [[1.1, -wallDist + 0.9, 0.3, 'Fugazi'], [1.6, -wallDist + 1.4, -0.2, 'Pavement']].forEach(([x, z, rot, band]) => {
      const fallenMat = new THREE.MeshStandardMaterial({
        map: makePosterTexture(band, 'Live — Doors 9pm'),
        roughness: 0.9, metalness: 0, side: THREE.DoubleSide,
      });
      const fallen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), fallenMat);
      fallen.rotation.x = -Math.PI / 2;
      fallen.rotation.z = rot;
      fallen.position.set(x, floorY + 0.01, z);
      group.add(fallen);
    });

    const chainMat = new THREE.MeshStandardMaterial({ color: 0x201d18, roughness: 0.6, metalness: 0.7 });
    [[-2.6, 0.6], [2.4, -0.4]].forEach(([x, z]) => {
      addStrut(group, new THREE.Vector3(x, rafterY - 0.03, z), new THREE.Vector3(x, floorY + 1.4, z), 0.008, chainMat);
    });

    bulbPosition = new THREE.Vector3(-wallDist + 0.6, benchHeight + 0.9, -1.5);
    const cordMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    addStrut(group, new THREE.Vector3(bulbPosition.x, rafterY - 0.05, bulbPosition.z), bulbPosition, 0.006, cordMat);
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe8b0, emissive: 0xffcc77, emissiveIntensity: 1.6, roughness: 0.4 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), bulbMat);
    bulb.position.copy(bulbPosition);
    group.add(bulb);
  }

  return {
    group, bulbPosition, posters: posterMeshes, colliders, wallDist,
    dust: {
      geo: moteGeo, mat: moteMat, tex: moteTex, base: moteBase, drift: moteDrift, count: moteCount,
      origin: moonPos.clone(), axis, perpA, perpB, tanAngle: moteTanAngle,
    },
  };
}

function createFirstPersonRig({ container, camera, renderer, colliders, wallLimit, eyeY, startPos, startYaw, isBlocked, isPanelOpen, crosshair, prompt, padEl }) {
  let yaw = startYaw, pitch = 0;
  camera.rotation.order = 'YXZ';
  camera.position.set(startPos.x, eyeY, startPos.z);
  camera.rotation.set(pitch, yaw, 0);

  const pos = new THREE.Vector2(startPos.x, startPos.z);
  const velocity = new THREE.Vector2();
  const forward3 = new THREE.Vector3();
  const moveDir = new THREE.Vector2();
  const canvasEl = renderer.domElement;

  const move = { forward: false, back: false, left: false, right: false };

  let locked = false;
  const canLock = typeof canvasEl.requestPointerLock === 'function';

  container.appendChild(crosshair);

  prompt.textContent = canLock ? 'click to look around' : 'drag to look around';
  container.appendChild(prompt);
  let promptFadeTimer = null;
  if (!canLock) {
    prompt.style.pointerEvents = 'none';
    promptFadeTimer = setTimeout(() => prompt.classList.add('hidden'), 2400);
  }

  const isCoarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  if (isCoarse) {
    container.appendChild(padEl);
    const bind = (cls, key) => {
      const el = padEl.querySelector(cls);
      const on = e => { e.preventDefault(); if (isPanelOpen?.()) return; move[key] = true; };
      const off = () => { move[key] = false; };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointerleave', off);
      el.addEventListener('pointercancel', off);
      const keyOn = e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault(); // Space would otherwise scroll the page under the scene
        if (isPanelOpen?.()) return;
        move[key] = true;
      };
      const keyOff = e => { if (e.key === 'Enter' || e.key === ' ') move[key] = false; };
      el.addEventListener('keydown', keyOn);
      el.addEventListener('keyup', keyOff);
      el.addEventListener('blur', off);
    };
    bind('.wp-fwd', 'forward');
    bind('.wp-back', 'back');
    bind('.wp-left', 'left');
    bind('.wp-right', 'right');
  }

  const KEY_MAP = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back',    ArrowDown: 'back',
    KeyA: 'left',    ArrowLeft: 'left',
    KeyD: 'right',   ArrowRight: 'right',
  };
  function clearMovement() { move.forward = move.back = move.left = move.right = false; }
  const onKeyDown = e => {
    const flag = KEY_MAP[e.code];
    if (!flag) return;
    if (isPanelOpen?.()) { clearMovement(); return; }
    move[flag] = true;
    e.preventDefault(); // arrows shouldn't also scroll the page underneath
  };
  const onKeyUp = e => {
    const flag = KEY_MAP[e.code];
    if (!flag) return;
    if (isPanelOpen?.()) { clearMovement(); return; }
    move[flag] = false;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  const onBlur = () => { clearMovement(); };
  window.addEventListener('blur', onBlur);

  const onPointerLockChange = () => {
    locked = document.pointerLockElement === canvasEl;
    prompt.classList.toggle('hidden', locked);
  };
  document.addEventListener('pointerlockchange', onPointerLockChange);

  const onMouseMoveLocked = e => {
    if (!locked) return;
    yaw   -= e.movementX * LOOK_SENS_MOUSE;
    pitch -= e.movementY * LOOK_SENS_MOUSE;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
  };
  document.addEventListener('mousemove', onMouseMoveLocked);

  const orbitDrag = bindOrbitDrag(container, {
    onDrag: (dx, dy) => {
      if (locked) return; // pointer-lock's own mousemove above already owns this
      yaw -= dx;
      pitch -= dy;
      pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
    },
  });

  function tryEngage(e) {
    if (isBlocked?.(e)) return false;
    if (!canLock || locked) return false;
    prompt.classList.add('hidden');
    canvasEl.requestPointerLock()?.catch?.(() => {});
    return true;
  }
  const onPromptClick = e => { tryEngage(e); };
  prompt.addEventListener('click', onPromptClick);

  function releaseLock() {
    if (document.pointerLockElement === canvasEl) document.exitPointerLock();
  }

  const _pushN = new THREE.Vector2();
  function resolveCollisions(x, z) {
    _pushN.set(0, 0);
    for (let pass = 0; pass < 2; pass++) {
      for (const c of colliders) {
        const dx = x - c.x, dz = z - c.z;
        const dist = Math.hypot(dx, dz);
        const minDist = c.r + PLAYER_RADIUS;
        if (dist > 0 && dist < minDist) {
          const push = (minDist - dist) / dist;
          x += dx * push;
          z += dz * push;
          _pushN.x += dx * push;
          _pushN.y += dz * push;
        }
      }
    }
    const cx = Math.max(-wallLimit, Math.min(wallLimit, x));
    const cz = Math.max(-wallLimit, Math.min(wallLimit, z));
    if (cx !== x) _pushN.x += cx - x;
    if (cz !== z) _pushN.y += cz - z;
    return { x: cx, z: cz };
  }
  function projectVelocityOntoTangent() {
    if (_pushN.lengthSq() < 1e-12) return;
    _pushN.normalize();
    const into = velocity.x * _pushN.x + velocity.y * _pushN.y;
    if (into < 0) {
      velocity.x -= into * _pushN.x;
      velocity.y -= into * _pushN.y;
    }
  }

  function update(dt) {
    camera.rotation.set(pitch, yaw, 0);

    camera.getWorldDirection(forward3);
    forward3.y = 0;
    if (forward3.lengthSq() < 1e-6) forward3.set(0, 0, -1); else forward3.normalize();
    const rightX = -forward3.z, rightZ = forward3.x;

    moveDir.set(0, 0);
    if (move.forward) { moveDir.x += forward3.x; moveDir.y += forward3.z; }
    if (move.back)    { moveDir.x -= forward3.x; moveDir.y -= forward3.z; }
    if (move.right)   { moveDir.x += rightX;      moveDir.y += rightZ; }
    if (move.left)    { moveDir.x -= rightX;      moveDir.y -= rightZ; }
    if (moveDir.lengthSq() > 1e-6) moveDir.normalize();

    const targetVel = moveDir.multiplyScalar(WALK_SPEED);
    const ease = 1 - Math.exp(-MOVE_ACCEL * dt);
    velocity.lerp(targetVel, ease);

    const next = resolveCollisions(pos.x + velocity.x * dt, pos.y + velocity.y * dt);
    projectVelocityOntoTangent();
    pos.set(next.x, next.z);
    camera.position.set(pos.x, eyeY, pos.y);
  }

  return {
    update,
    tryEngage,
    releaseLock,
    clearMovement,
    crosshairEl: crosshair,
    get locked() { return locked; },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMoveLocked);
      orbitDrag.dispose();
      prompt.removeEventListener('click', onPromptClick);
      if (promptFadeTimer) clearTimeout(promptFadeTimer);
      if (document.pointerLockElement === canvasEl) document.exitPointerLock();
      crosshair.remove();
      prompt.remove();
      padEl?.remove();
    },
  };
}

export function createOrrery(container, { preview = false } = {}) {
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const timers = trackTimers();

  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(54, w / h, 0.1, 500);
  if (preview) {
    camera.position.set(1.1, 0.3, 13.3);
    camera.lookAt(0, -0.15, 0);
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  let animId = null;
  const managedRenderer = manageRenderer(renderer, {
    onLost: () => { cancelAnimationFrame(animId); animId = null; },
  });
  renderer.setSize(w, h);
  renderer.setClearColor(0x0a0704, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const clippedPreview = preview ? mountClippedPreviewCanvas(container, renderer) : null;
  if (!preview) container.appendChild(renderer.domElement);

  const claim = preview ? null : claimContainer(container, {
    position: 'relative', overflow: 'hidden', cursor: 'none', tabIndex: -1,
  });

  scene.fog = new THREE.Fog(0x0a0704, preview ? 9 : 12, preview ? 30 : 42);

  const hemiLight = new THREE.HemisphereLight(0x64778a, 0x14100c, 1.3);
  scene.add(hemiLight);
  const ambientLight = new THREE.AmbientLight(0x3f4d47, 0.55);
  scene.add(ambientLight);

  const fixed = new THREE.Group();
  scene.add(fixed);

  const ceilingY  = preview ? 2.5 : 3.3;
  const rafterY   = ceilingY - (preview ? 0.35 : 0.45);
  const suspendTopY = rafterY - (preview ? 0.3 : 0.4);
  const orrery = buildOrrery(preview, suspendTopY, rafterY);

  const floorY = orrery.baseY - (preview ? 0.9 : 1.3);

  const holeW = preview ? 0.7 : 0.9; // the ceiling's actual skylight-hole half-width, square
  const moonGap = orrery.dishR * 3.25; // clearance above the dish rim — see reasoning above
  const moonPos = new THREE.Vector3(
    holeW * 0.28, orrery.riserTopY + orrery.dishH / 2 + moonGap, holeW * 0.11
  );
  const moonTargetPos = new THREE.Vector3(0, orrery.baseY + orrery.mastHeight * 0.32, 0);
  const moonAngle = 0.35, moonPenumbra = 0.45, moonDecay = 1.0;
  const moonThrow = moonPos.y - floorY;
  const moonSpotIntensity = preview ? 4.2 : 6.0;
  const moonSpotDistance = moonThrow * 1.6;

  const warehouse = buildWarehouse(preview, floorY, ceilingY, rafterY, holeW, moonPos, moonTargetPos, moonAngle);

  const moonTarget = new THREE.Object3D();
  moonTarget.position.copy(moonTargetPos);
  scene.add(moonTarget);
  const moonSpot = new THREE.SpotLight(
    0xbfd6ff, moonSpotIntensity, moonSpotDistance,
    moonAngle, moonPenumbra, moonDecay
  );
  moonSpot.position.copy(moonPos);
  moonSpot.target = moonTarget;
  scene.add(moonSpot);

  const shaftOrigin = moonSpot.position.clone();
  const shaftAxis = new THREE.Vector3().subVectors(moonSpot.target.position, shaftOrigin).normalize();
  const shaftLen = moonThrow * 0.6; // stays well short of the floor — an accent, not a room-filling wedge
  const shaftGlowTex = makeDustMoteTexture();
  const shaftSpriteCount = 6;
  for (let i = 0; i < shaftSpriteCount; i++) {
    const t = (i + 0.5) / shaftSpriteCount;
    const dist = shaftLen * t;
    const coneR = Math.max(0.05, dist * Math.tan(moonAngle));
    const edgeFade = 1 - Math.pow(Math.abs(t - 0.5) * 2, 2); // soft peak mid-shaft, fades toward both ends
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: shaftGlowTex, color: 0xbfd6ff, transparent: true,
      opacity: 0.045 * edgeFade, blending: THREE.AdditiveBlending,
      depthWrite: false, fog: false,
    }));
    sprite.position.copy(shaftOrigin).addScaledVector(shaftAxis, dist);
    sprite.scale.setScalar(coneR * 2.4);
    fixed.add(sprite);
  }

  const FLUORESCENT_COLOR = 0xdcefe2;
  const fixtureHousingMat = new THREE.MeshStandardMaterial({ color: 0x232420, roughness: 0.6, metalness: 0.5 });
  const fixtureTubeMat = new THREE.MeshStandardMaterial({
    color: 0xcbd6cf, emissive: FLUORESCENT_COLOR, emissiveIntensity: 0.35, roughness: 0.4,
  });
  const wd = warehouse.wallDist;
  const fixtureSpots = [
    { x: -wd * 0.5, z: wd * 0.4 },
    { x: wd * 0.55, z: -wd * 0.25 },
    { x: -wd * 0.15, z: -wd * 0.55 },
  ];
  const housingW = 1.3, housingD = 0.22, housingWallH = 0.11, plateT = 0.03;
  const fy = rafterY - (preview ? 0.08 : 0.12);
  const topPlateGeo = new THREE.BoxGeometry(housingW, plateT, housingD);
  const sideWallGeo = new THREE.BoxGeometry(housingW, housingWallH, 0.02);
  const endCapGeo = new THREE.BoxGeometry(0.02, housingWallH, housingD);
  const hangerTop = fy + housingWallH / 2 + plateT;
  const hangerH = rafterY - hangerTop;
  const hangerGeo = hangerH > 0.001 ? new THREE.CylinderGeometry(0.012, 0.012, hangerH, 6) : null;
  const flangeGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 10);
  const tubeGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.15, 8);
  fixtureSpots.forEach(({ x, z }) => {
    const topPlate = new THREE.Mesh(topPlateGeo, fixtureHousingMat);
    topPlate.position.set(x, fy + housingWallH / 2, z);
    fixed.add(topPlate);
    const wallFront = new THREE.Mesh(sideWallGeo, fixtureHousingMat);
    wallFront.position.set(x, fy, z - housingD / 2);
    fixed.add(wallFront);
    const wallBack = new THREE.Mesh(sideWallGeo, fixtureHousingMat);
    wallBack.position.set(x, fy, z + housingD / 2);
    fixed.add(wallBack);
    const endL = new THREE.Mesh(endCapGeo, fixtureHousingMat);
    endL.position.set(x - housingW / 2, fy, z);
    fixed.add(endL);
    const endR = new THREE.Mesh(endCapGeo, fixtureHousingMat);
    endR.position.set(x + housingW / 2, fy, z);
    fixed.add(endR);

    if (hangerGeo) {
      const hanger = new THREE.Mesh(hangerGeo, fixtureHousingMat);
      hanger.position.set(x, hangerTop + hangerH / 2, z);
      fixed.add(hanger);
    }
    const flange = new THREE.Mesh(flangeGeo, fixtureHousingMat);
    flange.rotation.x = Math.PI / 2;
    flange.position.set(x, rafterY - 0.01, z);
    fixed.add(flange);

    const tube = new THREE.Mesh(tubeGeo, fixtureTubeMat);
    tube.rotation.z = Math.PI / 2;
    tube.position.set(x, fy - housingWallH / 2 + 0.015, z);
    fixed.add(tube);
    const fLight = new THREE.PointLight(FLUORESCENT_COLOR, preview ? 0.25 : 0.32, preview ? 8 : 12, 2);
    fLight.position.set(x, fy - 0.15, z);
    fixed.add(fLight);
  });

  const workLight = new THREE.PointLight(0xffaa55, 0.9, preview ? 9 : 13);
  if (warehouse.bulbPosition) workLight.position.copy(warehouse.bulbPosition);
  else workLight.position.set(1.2, -0.6, 1.4);
  scene.add(workLight);

  const starCount = (preview ? 140 : 320) * 6;
  const starSpreadXZ = (preview ? 18 : 28) * 4;
  const starSpreadY = (preview ? 4 : 6) * 4;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * starSpreadXZ;
    positions[i * 3 + 1] = ceilingY + Math.random() * starSpreadY;
    positions[i * 3 + 2] = (Math.random() - 0.5) * starSpreadXZ;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xddeeff, size: preview ? 1.3 : 1.6, transparent: true, opacity: 0.55, sizeAttenuation: false,
    fog: false,
  });
  const starField = new THREE.Points(starGeo, starMat);
  fixed.add(starField);

  const root = new THREE.Group();
  scene.add(root);
  root.add(orrery.group);
  root.add(warehouse.group);


  let panel = null, panelTitle = null, panelEra = null, panelNote = null, panelCloser = null, jumpList = null;
  let hint = null, vignette = null, grain = null, title = null;
  let shell = null, crosshairEl = null, lockPromptEl = null, walkpadEl = null;
  if (!preview) {
    shell = parseHTML(orreryHtml);
    vignette = shell.querySelector('.orrery-vignette');
    grain = shell.querySelector('.orrery-grain');
    title = shell.querySelector('.orrery-title');
    panel = shell.querySelector('.orrery-panel');
    hint = shell.querySelector('.orrery-hint');
    crosshairEl = shell.querySelector('.orrery-crosshair');
    lockPromptEl = shell.querySelector('.orrery-lock-prompt');
    walkpadEl = shell.querySelector('.orrery-walkpad');

    container.appendChild(vignette);
    container.appendChild(grain);
    document.body.appendChild(title);

    title.querySelector('.orrery-title-main').textContent = ORRERY.name;

    panelTitle = panel.querySelector('.orrery-panel-title');
    panelEra   = panel.querySelector('.orrery-panel-era');
    panelNote  = panel.querySelector('.orrery-panel-note');
    panelTitle.textContent = `✦ ${ORRERY.name}`;
    panelEra.textContent = ORRERY.era;
    panelNote.textContent = ORRERY.note;
    container.appendChild(panel);

    panelCloser = createPanelCloser(panel, container, {
      closeBtn: panel.querySelector('.orrery-panel-close'),
      onClose: () => {
        hideAmbient(false);
        selected = false;
        setEmphasis(hovered);
        claim.setCursor('none');
      },
    });

    jumpList = createJumpList(container, {
      label: 'Read the found story, or tune in a flyer on the wall',
      items: [{ kind: 'panel' }, ...warehouse.posters.map(p => ({ kind: 'poster', band: p.band }))],
      getLabel: item => item.kind === 'panel' ? 'Read the found story (control box)' : `Tune in: ${item.band} flyer`,
      onSelect: item => {
        if (item.kind === 'panel') { selected = true; setEmphasis(true); openPanel(); }
        else playPosterRiff(item.band);
      },
    });

    document.body.appendChild(hint);

  }

  const raycaster = new THREE.Raycaster();
  let hovered = false, selected = false;
  let fp = null;

  function setEmphasis(on) {
    orrery.lampMat.emissiveIntensity = on ? 2.2 : 1;
    orrery.hitTarget.scale.setScalar(on ? 1.4 : 1.0);
  }

  function hideAmbient(hidden) {
    title.classList.toggle('panel-open', hidden);
    hint.classList.toggle('panel-open', hidden);
  }

  function openPanel() {
    panel.classList.add('open');
    hideAmbient(true);
    fp?.releaseLock();
    claim.setCursor('');
    fp?.clearMovement();
    timers.nextFrame(() => panelTitle.focus());
  }

  let posterAudioPromise = null;
  function loadPosterAudio() {
    return (posterAudioPromise ??= import('./orreryAudio.js').then(m => m.createPosterAudio()));
  }
  if (!preview) loadPosterAudio();

  async function playPosterRiff(band) {
    const posterAudio = await loadPosterAudio();
    posterAudio.play(band);
  }

  let hoveredPoster = null;

  let onContainerClick;
  let touchGuard;

  if (!preview) {
    touchGuard = bindTapVsDrag(container);
    onContainerClick = e => {
      if (touchGuard.consume()) return;
      if (fp.tryEngage(e)) return;
      if (panel.classList.contains('open')) {
        if (hoveredPoster) { playPosterRiff(hoveredPoster.band); return; }
        if (!panel.contains(e.target)) panelCloser.close();
        return;
      }
      if (hoveredPoster) { playPosterRiff(hoveredPoster.band); return; }
      if (!hovered) return;
      selected = true;
      setEmphasis(true);
      openPanel();
    };
    container.addEventListener('click', onContainerClick);
  }

  let reduceMotion = prefersReducedMotion();
  const reduceMotionSub = onReducedMotionChange(v => { reduceMotion = v; });

  let orbitDrag = null, wheelZoom = null, targetRotationY = root.rotation.y;

  if (preview) {
    orbitDrag = bindOrbitDrag(container, {
      onDrag: dx => { targetRotationY += dx; },
    });
    wheelZoom = bindWheelZoom(container, {
      onZoom: deltaY => {
        camera.position.z = Math.max(1.4, Math.min(38, camera.position.z + deltaY * 0.01));
      },
    });
  } else {
    const eyeYAbs = floorY + EYE_HEIGHT;
    const RING_COLLIDER_R = 0.15;
    const RING_SAMPLE_SPACING = 0.55;
    const ringDipColliders = [];
    orrery.ringInfo.forEach(({ radius, yOffset, tilt }) => {
      const sinTilt = Math.sin(tilt);
      if (Math.abs(sinTilt) < 1e-6) return;
      const s0 = (yOffset - eyeYAbs) / (radius * sinTilt);
      if (s0 > 1) return; // this ring never reaches eye height
      const theta0 = s0 < -1 ? 0 : Math.asin(s0);
      const theta1 = s0 < -1 ? Math.PI * 2 : Math.PI - theta0;
      const arcLen = radius * (theta1 - theta0);
      const steps = Math.max(2, Math.ceil(arcLen / RING_SAMPLE_SPACING));
      const cosTilt = Math.cos(tilt);
      for (let i = 0; i <= steps; i++) {
        const theta = theta0 + ((theta1 - theta0) * i) / steps;
        ringDipColliders.push({
          x: radius * Math.cos(theta),
          z: radius * Math.sin(theta) * cosTilt,
          r: RING_COLLIDER_R,
        });
      }
    });

    const allColliders = [...warehouse.colliders, ...orrery.colliders, ...ringDipColliders];
    fp = createFirstPersonRig({
      container, camera, renderer,
      colliders: allColliders,
      wallLimit: warehouse.wallDist - PLAYER_RADIUS,
      eyeY: floorY + EYE_HEIGHT,
      startPos: new THREE.Vector3(0.3, 0, warehouse.wallDist - 4.5),
      startYaw: 0,
      isBlocked: e => panel && panel.contains(e.target),
      isPanelOpen: () => !!panel && panel.classList.contains('open'),
      crosshair: crosshairEl, prompt: lockPromptEl, padEl: walkpadEl,
    });
  }

  const _jointDisp = Array.from({ length: orrery.dishPhysics.nJoints }, () => new THREE.Vector3());
  const _qRing = [[], [], []]; // [axis][mode] scratch — this frame's modal amplitude, baseline + ring combined
  const _scratchFrom = new THREE.Vector3(), _scratchTo = new THREE.Vector3(), _scratchMid = new THREE.Vector3(), _scratchDir = new THREE.Vector3();
  const _UP = new THREE.Vector3(0, 1, 0);
  const _screenCentre = { x: 0, y: 0 };
  const _posterMeshes = preview ? [] : warehouse.posters.map(p => p.mesh);

  const clock = createFrameClock();
  const T_PER_SECOND = 0.06;
  let paused = false;
  function animate() {
    animId = requestAnimationFrame(animate);
    const dt = clock.tick();
    const t = clock.elapsed * T_PER_SECOND;

    if (preview) {
      const previewEase = 1 - Math.exp(-4.35 * dt);
      root.rotation.y = reduceMotion ? targetRotationY : root.rotation.y + (targetRotationY - root.rotation.y) * previewEase;
    } else {
      fp.update(dt);

      raycaster.setFromCamera(_screenCentre, camera);
      const hits = raycaster.intersectObject(orrery.hitTarget);
      const newHover = hits.length > 0;
      if (newHover !== hovered) {
        hovered = newHover;
        if (!selected) setEmphasis(hovered);
      }
      if (warehouse.posters.length) {
        const posterHits = raycaster.intersectObjects(_posterMeshes);
        const newPosterHover = posterHits.length
          ? warehouse.posters.find(p => p.mesh === posterHits[0].object)
          : null;
        if (newPosterHover !== hoveredPoster) {
          if (hoveredPoster) hoveredPoster.mesh.material.emissive.setHex(POSTER_EMISSIVE);
          hoveredPoster = newPosterHover;
          if (hoveredPoster) hoveredPoster.mesh.material.emissive.setHex(POSTER_HOVER_EMISSIVE);
        }
      }
      fp.crosshairEl.classList.toggle('active', hovered || !!hoveredPoster);
    }

    if (!reduceMotion) {
      const nowMs = orreryNowMs();
      orrery.orbits.forEach(o => {
        applyKeplerPosition(o.bodyGroup, o, nowMs);
        o.moons.forEach(m => { applyKeplerPosition(m.pivot, m.orbit, nowMs); });
      });
      const epochSec = secondsSinceEpoch(nowMs);
      if (orrery.belt) orrery.belt.group.rotation.y = normalizeAngle(orrery.belt.omega * epochSec);
      orrery.unknowns.forEach(u => {
        u.pivot.rotation.y = normalizeAngle(u.omegaOrbit * u.direction * epochSec);
        u.mesh.rotation.x = normalizeAngle(u.omegaSpinX * epochSec);
        u.mesh.rotation.y = normalizeAngle(u.omegaSpinY * epochSec);
      });

      const dust = warehouse.dust;
      const dustAttr = dust.geo.attributes.position;
      const dustClock = t * 60;
      const { origin: dOrigin, axis: dAxis, perpA: dPerpA, perpB: dPerpB, tanAngle: dTan } = dust;
      for (let i = 0; i < dust.count; i++) {
        const d = dust.drift[i];
        const i3 = i * 3;
        const startFrac = dust.base[i3 + 1] - floorY; // 0..span, this mote's own start height
        const risenFrac = (startFrac + dustClock * d.riseSpeed) % d.span;
        const y = floorY + risenFrac;
        const along = (y - dOrigin.y) / dAxis.y;
        const rr = d.radFrac * Math.max(0.02, along * dTan);
        const ox = Math.cos(d.ang) * rr, oz = Math.sin(d.ang) * rr;
        const wobPhase = dustClock * d.wobbleSpeed + d.phase;
        dustAttr.array[i3]     = dOrigin.x + dAxis.x * along + dPerpA.x * ox + dPerpB.x * oz + Math.sin(wobPhase) * d.wobbleAmp;
        dustAttr.array[i3 + 1] = y;
        dustAttr.array[i3 + 2] = dOrigin.z + dAxis.z * along + dPerpA.z * ox + dPerpB.z * oz + Math.cos(wobPhase) * d.wobbleAmp;
      }
      dustAttr.needsUpdate = true;

      const realSeconds = performance.now() / 1000;
      const RING_PERIOD = 34;   // TUNABLE: real seconds between struck events
      const RING_WINDOW = 6;    // TUNABLE: wide enough for every mode's own decay to die out (shorter than earlier rounds' 9s — see NOTES.md 2.2.20, the real modal decay settles faster)
      const FREQ_SCALE = 14;    // TUNABLE: converts the graph's raw sqrt(eigenvalue) units into real angular frequency (rad/s) — chosen so the lowest modes land around ~1Hz, the highest around ~5Hz, a similar range to the single hand-picked RING_FREQ earlier rounds used
      const DAMP_BASE = 0.5;    // TUNABLE: every mode's own minimum damping (per second)
      const DAMP_FREQ_SCALE = 0.05; // TUNABLE: additional damping proportional to a mode's own frequency — "real materials damp higher frequencies faster" (the brief's optional refinement), cheap to include since it's just one more multiply per mode
      const IMPULSE_STRENGTH = 0.55; // TUNABLE: overall strike strength — calibrated (see NOTES.md 2.2.20/2.2.21) against this specific graph's own eigenvector magnitudes, not a generic constant
      const BASELINE_AMP = 0.006;    // TUNABLE: continuous per-mode hum amplitude, well below the strike's own peak

      const { values, vectors } = orrery.dishPhysics.modes;
      const nJoints = orrery.dishPhysics.nJoints;
      const eventIndex = Math.floor(realSeconds / RING_PERIOD);
      const strikeSeed = 91711; // arbitrary fixed seed, just needs to differ from other hash3 callers in this file
      const strikeJoint = Math.floor(hash3(eventIndex, 0, 0, strikeSeed) * nJoints);
      const strikeTheta = hash3(eventIndex, 1, 0, strikeSeed) * Math.PI * 2;
      const strikeVertical = (hash3(eventIndex, 2, 0, strikeSeed) - 0.5) * 0.5;
      const impulseDir = [Math.cos(strikeTheta), strikeVertical, Math.sin(strikeTheta)];
      const tSinceStrike = realSeconds - eventIndex * RING_PERIOD;
      const ringActive = tSinceStrike >= 0 && tSinceStrike < RING_WINDOW;

      const activeModes = ringActive ? nJoints : orrery.dishPhysics.basePhase.length;
      for (let axis = 0; axis < 3; axis++) {
        for (let n = 0; n < activeModes; n++) {
          let q = 0;
          if (n < orrery.dishPhysics.basePhase.length) {
            const omega = Math.sqrt(Math.max(values[n], 0)) * FREQ_SCALE;
            q += BASELINE_AMP * Math.sin(omega * realSeconds + orrery.dishPhysics.basePhase[n][axis]);
          }
          if (ringActive) {
            const omega = Math.sqrt(Math.max(values[n], 0)) * FREQ_SCALE;
            if (omega > 1e-6) {
              const gamma = DAMP_BASE + DAMP_FREQ_SCALE * omega;
              const omegaD2 = omega * omega - gamma * gamma;
              if (omegaD2 > 1e-6) {
                const omegaD = Math.sqrt(omegaD2);
                const v0 = impulseDir[axis] * IMPULSE_STRENGTH * vectors[n][strikeJoint];
                q += (v0 / omegaD) * Math.exp(-gamma * tSinceStrike) * Math.sin(omegaD * tSinceStrike);
              }
            }
          }
          _qRing[axis][n] = q;
        }
      }
      for (let j = 0; j < nJoints; j++) {
        let dx = 0, dy = 0, dz = 0;
        for (let n = 0; n < activeModes; n++) {
          const vn = vectors[n][j];
          dx += vn * _qRing[0][n];
          dy += vn * _qRing[1][n];
          dz += vn * _qRing[2][n];
        }
        _jointDisp[j].set(dx, dy, dz);
      }
      orrery.dishPhysics.ringStruts.forEach(rs => {
        _scratchFrom.copy(rs.baseFrom);
        if (rs.jointA >= 0) _scratchFrom.add(_jointDisp[rs.jointA]);
        _scratchTo.copy(rs.baseTo);
        if (rs.jointB >= 0) _scratchTo.add(_jointDisp[rs.jointB]);
        _scratchMid.copy(_scratchFrom).add(_scratchTo).multiplyScalar(0.5);
        _scratchDir.copy(_scratchTo).sub(_scratchFrom);
        const dist = _scratchDir.length();
        if (dist < 1e-6) return; // degenerate (shouldn't happen at these displacement scales), skip rather than divide by zero
        _scratchDir.divideScalar(dist);
        rs.mesh.position.copy(_scratchMid);
        rs.mesh.quaternion.setFromUnitVectors(_UP, _scratchDir);
        rs.mesh.scale.y = dist / rs.builtLen;
      });

      if (!hovered && !selected) {
        orrery.hitTarget.scale.setScalar(1.0 + Math.sin(t * 8) * 0.03);
      }
    }

    renderer.render(scene, camera);
    clippedPreview?.blit();
  }
  if (reduceMotion) orrery.hitTarget.scale.setScalar(1.0);
  animate();

  const resize = bindGuardedResize(container, (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    managedRenderer.applyPixelRatio();
  });

  return {
    setPaused(next) {
      const want = !!next;
      if (want === paused) return;
      paused = want;
      if (paused) {
        cancelAnimationFrame(animId);
        animId = null;
      } else {
        clock.resync();
        animId = requestAnimationFrame(animate);
      }
    },
    dispose() {
      cancelAnimationFrame(animId);
      animId = null;
      orbitDrag?.dispose();
      wheelZoom?.dispose();
      fp?.dispose();
      resize.dispose();
      panelCloser?.dispose();
      jumpList?.dispose();
      timers.dispose();
      reduceMotionSub.dispose();
      if (!preview) {
        touchGuard?.dispose();
        container.removeEventListener('click', onContainerClick);
      }
      if (posterAudioPromise) posterAudioPromise.then(pa => pa.dispose());
      clippedPreview?.dispose();
      disposeSceneGraph(scene);
      managedRenderer.dispose();
      if (panel) panel.remove();
      if (hint) hint.remove();
      if (vignette) vignette.remove();
      if (grain) grain.remove();
      if (title) title.remove();
      claim?.restore();
    }
  };
}
