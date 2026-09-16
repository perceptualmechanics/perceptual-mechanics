import * as THREE from 'three';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion,
  createJumpList, bindTapVsDrag, mountClippedPreviewCanvas, parseHTML,
  bindEscapeClose, claimContainer, manageRenderer, createFrameClock, trackTimers,
  registerTransientOverlay,
} from '../../utils/sceneKit.js';
import './beamline.css';
import beamlineHtml from './beamline.html?raw';
import { EPIGRAPH_PRIMARY, EPIGRAPH_SECONDARY, BOUNCES } from './beamline.text.js';
import { mulberry32, hashSeed } from '../../utils/prng.js';

const ACCENT = 0x50C878;        // canonical — rail core, station glow, vessel light, terrain grid
const ACCENT_HALO = 0x8ADAA4;   // lighter tint, same hue — rail halo, dust, shimmer
const ACCENT_DEEP = 0x309A54;   // darker tint, same hue — vessel/station chassis fill
const ACCENT_SHADOW = 0x1E6034; // darkest tint, same hue — the bottom stop of the terrain colour ramp (see buildTerrain), i.e. the valleys

function accentCss(hex) {
  return `rgba(${(hex >> 16) & 0xff},${(hex >> 8) & 0xff},${hex & 0xff},`;
}
const ACCENT_CSS = accentCss(ACCENT);
const ACCENT_HALO_CSS = accentCss(ACCENT_HALO);

const GOLD_ACCENT_CSS = 'rgba(255,220,120,'; // canvas fillStyle prefix, same shape as makeGlowTexture's hue param
const GOLD_ACCENT = 0xffdc78; // numeric form of the same rgb(255,220,120) — Three.js materials want a hex, canvas 2D wants the rgba() string above; both derived from the same Sphere-sourced value, just for different APIs
const STATION_CORE_WARM = 0x7ccd78;

const HORIZON_COLOR = 0x1E6034;
const HORIZON_CSS = '#' + HORIZON_COLOR.toString(16).padStart(6, '0');



function organicWave(t, seed = 0) {
  const a = Math.sin(t * 0.9 + seed * 2.1);
  const b = Math.sin(t * 1.37 + seed * 4.7 + 1.3);
  const c = Math.sin(t * 0.53 + seed * 0.8 + 2.6);
  return (a * 0.5 + b * 0.3 + c * 0.2) * 0.5 + 0.5;
}

export const FLOOR_Y = -4;
const MOUNTAINS = [
  { cx: 90, cz: 35, radius: 48, height: 40, seed: 11 },
  { cx: 246, cz: -82, radius: 55, height: 55, seed: 47 },
  { cx: 372, cz: 90, radius: 42, height: 32, seed: 83 },
];
function smoothstep01(t) { return t * t * (3 - 2 * t); }

const FAR_PEAKS = [
  { cx: -649, cz: 356, radius: 180, height: 130, seed: 5 },
  { cx: -352, cz: -698, radius: 150, height: 95, seed: 19 },
  { cx: 90, cz: 954, radius: 220, height: 150, seed: 31 },
  { cx: 763, cz: -740, radius: 190, height: 110, seed: 44 },
  { cx: 1089, cz: 459, radius: 260, height: 175, seed: 58 },
  { cx: 1081, cz: -227, radius: 170, height: 90, seed: 67 },
  { cx: -119, cz: 885, radius: 200, height: 120, seed: 79 },
  { cx: 704, cz: 734, radius: 150, height: 85, seed: 91 },
  { cx: -744, cz: -105, radius: 210, height: 140, seed: 103 },
  { cx: 1168, cz: 68, radius: 230, height: 160, seed: 121 },
];
const VALLEYS = [
  { cx: -758, cz: 59, radius: 220, depth: 22, seed: 137 },
  { cx: 1236, cz: -89, radius: 300, depth: 18, seed: 149 },
];

const CAM_TARGET_POS = { x: 199.944150, y: 25.345350, z: 0.531666 };
const SAFE_RADIUS = 700; // CAM_MAX (620) + 80 margin — STRUCTURAL, tied to the camera's own max distance elsewhere in this file; shrinking it risks wilderness terrain poking up inside the camera's actual safe zone
const SAFE_FADE = 260; // TUNABLE — how many world units the wilderness layer takes to fade from 0 to full strength, moving outward past SAFE_RADIUS. Shorter = wilderness appears more abruptly right at the boundary; longer = a more gradual, harder-to-notice transition.
function corridorFactor(x, z) {
  const dx = x - CAM_TARGET_POS.x, dz = z - CAM_TARGET_POS.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d <= SAFE_RADIUS) return 0;
  return smoothstep01(Math.min(1, (d - SAFE_RADIUS) / SAFE_FADE));
}

const TERRAIN_CENTER = { x: 200, z: 0 };
const PLANE_W = 8000, PLANE_H = 6400;
const PLANE_HALF_X = PLANE_W / 2, PLANE_HALF_Z = PLANE_H / 2;
const PREVIEW_PLANE_SCALE = 0.2;
const EDGE_FALLOFF_START = 0.55; // fraction of half-extent where the taper begins — FAR_PEAKS/VALLEYS all sit well inside this (rNorm ≤ ~0.4), so the hand-placed skyline is untouched; only the noise layer actually reaches this far out
function edgeFalloff(x, z) {
  const nx = (x - TERRAIN_CENTER.x) / PLANE_HALF_X;
  const nz = (z - TERRAIN_CENTER.z) / PLANE_HALF_Z;
  const rNorm = Math.sqrt(nx * nx + nz * nz);
  if (rNorm <= EDGE_FALLOFF_START) return 1;
  if (rNorm >= 1) return 0;
  return 1 - smoothstep01((rNorm - EDGE_FALLOFF_START) / (1 - EDGE_FALLOFF_START));
}

function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 2246822519) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}
function valueNoise2D(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = smoothstep01(fx), sz = smoothstep01(fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  const ab = a + (b - a) * sx;
  const cd = c + (d - c) * sx;
  return ab + (cd - ab) * sz;
}
function fbm(x, z, seed, octaves = 4) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise2D(x * freq, z * freq, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2.15;
  }
  return sum / norm; // 0..1
}
function ridged(x, z, seed, octaves = 4) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(valueNoise2D(x * freq, z * freq, seed + o * 101) * 2 - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2.15;
  }
  return sum / norm; // 0..1
}
const WILDERNESS_SCALE = 1 / 340; // broad, slow features — which areas are highlands vs lowlands
const RIDGE_SCALE = 1 / 130;      // finer ridged layer on top, for actual ridgelines
function wildernessHeight(x, z) {
  const base = (fbm(x * WILDERNESS_SCALE, z * WILDERNESS_SCALE, 5000) - 0.5) * 2 * 34; // ±34 broad relief
  const ridge = ridged(x * RIDGE_SCALE, z * RIDGE_SCALE, 9000) * 26; // 0..26 ridge detail on top
  return base + ridge;
}

export function terrainHeight(x, z) {
  let h = 0;
  for (const m of MOUNTAINS) {
    const dx = x - m.cx, dz = z - m.cz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= m.radius) continue;
    const t = 1 - d / m.radius;
    const s = smoothstep01(t);
    const angle = Math.atan2(dz, dx);
    const jag = 1 + 0.15 * Math.sin(angle * 7 + m.seed) + 0.08 * Math.sin(angle * 13 + m.seed * 2);
    h += m.height * s * jag;
  }

  let wild = 0;
  for (const p of FAR_PEAKS) {
    const dx = x - p.cx, dz = z - p.cz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= p.radius) continue;
    const t = 1 - d / p.radius;
    const s = smoothstep01(t);
    const angle = Math.atan2(dz, dx);
    const jag = 1 + 0.18 * Math.sin(angle * 5 + p.seed) + 0.10 * Math.sin(angle * 11 + p.seed * 2);
    wild += p.height * s * jag;
  }
  for (const v of VALLEYS) {
    const dx = x - v.cx, dz = z - v.cz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= v.radius) continue;
    const t = 1 - d / v.radius;
    wild -= v.depth * smoothstep01(t);
  }
  const cf = corridorFactor(x, z);
  if (cf > 0) wild += wildernessHeight(x, z) * cf;
  h += wild * edgeFalloff(x, z);

  return FLOOR_Y + h;
}

const TERRAIN_COLOR_RANGE = 70; // TUNABLE — height (in world units above FLOOR_Y) the ramp spans before clamping to ACCENT_HALO. Set from MOUNTAINS' own tallest peak (55) plus headroom, not guessed: the three hand-placed near mountains — the ones actually confirmed flat during live testing — span nearly the full ramp this way. FAR_PEAKS (up to 175) simply clip to the top stop past this, same practical-range clipping real hypsometric maps use; they're deep enough in fog by then that the clip is never visible as a hard line.
const TERRAIN_COLOR_STOPS = [ACCENT_SHADOW, ACCENT_DEEP, ACCENT, ACCENT_HALO].map(hex => ({
  r: ((hex >> 16) & 255) / 255, g: ((hex >> 8) & 255) / 255, b: (hex & 255) / 255,
}));
function hypsometricColor(h) {
  const t = Math.max(0, Math.min(1, (h - FLOOR_Y) / TERRAIN_COLOR_RANGE));
  const seg = t * (TERRAIN_COLOR_STOPS.length - 1); // 0..3 across 4 stops
  const i = Math.min(TERRAIN_COLOR_STOPS.length - 2, Math.floor(seg));
  const localT = seg - i;
  const a = TERRAIN_COLOR_STOPS[i], b = TERRAIN_COLOR_STOPS[i + 1];
  return { r: a.r + (b.r - a.r) * localT, g: a.g + (b.g - a.g) * localT, b: a.b + (b.b - a.b) * localT };
}
const TERRAIN_NOISE_SCALE = 1 / 22; // TUNABLE — spatial frequency of the surface texture noise; smaller denominator = finer/busier mottling
const TERRAIN_NOISE_STRENGTH = 0.22; // TUNABLE — ±22% brightness variation; enough to visibly break up hypsometric banding without reading as static/noisy
const TERRAIN_NOISE_SEED = 13500; // distinct from terrainHeight's own noise seeds (5000, 9000) so this texture doesn't correlate 1:1 with the height field's own broad shape
function terrainVertexColor(wx, wz, h) {
  const base = hypsometricColor(h);
  const n = fbm(wx * TERRAIN_NOISE_SCALE, wz * TERRAIN_NOISE_SCALE, TERRAIN_NOISE_SEED, 3);
  const shade = 1 + (n - 0.5) * 2 * TERRAIN_NOISE_STRENGTH;
  return { r: base.r * shade, g: base.g * shade, b: base.b * shade };
}

function makeGlowTexture(hue = 'rgba(200,225,255,') {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const cx = c.getContext('2d');
  const grad = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, hue + '1)');
  grad.addColorStop(0.35, hue + '0.55)');
  grad.addColorStop(1, hue + '0)');
  cx.fillStyle = grad;
  cx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function makeGridTexture(repeat = 20) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const cx = c.getContext('2d');
  cx.fillStyle = '#02040a';
  cx.fillRect(0, 0, 512, 512);
  cx.strokeStyle = ACCENT_CSS + '0.85)'; // canonical ACCENT, derived — this line used to read rgba(0,102,255,0.85) with a comment calling it "canonical ACCENT (0x0066ff)", a constant this file deleted in the emerald pass
  cx.lineWidth = 1;
  for (let i = 0; i <= 16; i++) {
    const p = (512 / 16) * i;
    cx.beginPath(); cx.moveTo(p, 0); cx.lineTo(p, 512); cx.stroke();
    cx.beginPath(); cx.moveTo(0, p); cx.lineTo(512, p); cx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
}

function makeShimmerTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const cx = c.getContext('2d');
  let seed = 4471;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 3; i++) {
    const x = rand() * 256, y = rand() * 256, r = 26 + rand() * 30;
    const grad = cx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, ACCENT_HALO_CSS + '0.22)');
    grad.addColorStop(1, ACCENT_HALO_CSS + '0)');
    cx.fillStyle = grad;
    cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeRingPulseTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 16;
  const cx = c.getContext('2d');
  cx.fillStyle = '#1c1c1c';
  cx.fillRect(0, 0, 256, 16);
  const grad = cx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,1)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  cx.fillStyle = grad;
  cx.fillRect(0, 0, 256, 16);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeSkyboxTexture() {
  const w = 2048, h = 1024;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d');

  const horizonY = h * 0.58;
  const sky = cx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, '#00030c');
  sky.addColorStop(0.5, '#020d22');
  sky.addColorStop(0.82, '#042140');
  sky.addColorStop(0.95, '#0a6978');
  sky.addColorStop(1, HORIZON_CSS); // = scene.fog's color, see HORIZON_COLOR above
  cx.fillStyle = sky;
  cx.fillRect(0, 0, w, horizonY);

  const glow = cx.createLinearGradient(0, horizonY - 55, 0, horizonY + 8);
  glow.addColorStop(0, ACCENT_CSS + '0)');
  glow.addColorStop(0.72, ACCENT_CSS + '0.4)');
  glow.addColorStop(1, 'rgba(205,245,220,0.65)');
  cx.fillStyle = glow;
  cx.fillRect(0, horizonY - 55, w, 63);

  cx.fillStyle = '#010103';
  cx.fillRect(0, horizonY, w, h - horizonY);

  let seed = 771;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 260; i++) {
    const x = rand() * w, y = rand() * horizonY * 0.75;
    const b = rand();
    cx.fillStyle = `rgba(210,235,255,${(0.15 + b * 0.5).toFixed(2)})`;
    cx.fillRect(x, y, 1.4, 1.4);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLiquidLightTexture() {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 256;
  const cx = c.getContext('2d');
  cx.clearRect(0, 0, 8, 256);
  const grad = cx.createLinearGradient(0, 0, 0, 256);
  const stops = [
    [0.00, 0.35], [0.06, 0.95], [0.10, 0.55], [0.18, 0.20], [0.24, 0.85],
    [0.30, 0.30], [0.38, 0.70], [0.46, 0.15], [0.52, 1.00], [0.58, 0.40],
    [0.66, 0.75], [0.72, 0.25], [0.80, 0.90], [0.87, 0.35], [0.93, 0.65],
    [1.00, 0.30],
  ];
  stops.forEach(([pos, a]) => grad.addColorStop(pos, `rgba(255,255,255,${a})`));
  cx.fillStyle = grad;
  cx.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function wrapLines(cx, text, maxWidth) {
  const words = text.split(' ');
  let line = '', lines = [];
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (cx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}
function drawOutlinedText(cx, str, x, y, { fill, stroke, strokeWidth, glow, glowBlur }) {
  cx.save();
  cx.lineJoin = 'round';
  cx.miterLimit = 2;
  cx.shadowColor = glow;
  cx.shadowBlur = glowBlur;
  cx.strokeStyle = stroke;
  cx.lineWidth = strokeWidth;
  cx.strokeText(str, x, y);
  cx.shadowBlur = 0;
  cx.fillStyle = fill;
  cx.fillText(str, x, y);
  cx.restore();
}
const BOUNCE_FONT_PX = 24;
const SMALLCAPS_FONT_PX = 17; // ~0.71x BOUNCE_FONT_PX — the "small capitals" size
const BODY_FONT_PX = 34;
const BOUNCE_LINE_H = 30;
const BODY_LINE_H = 42;

function layoutSmallCaps(cx, str, { bigPx, smallPx, weight = 700, letterGap = 1, wordGap = 7, draw = false, x = 0, y = 0, style }) {
  let cursorX = x;
  const words = str.split(' ').filter(Boolean);
  words.forEach((word, wi) => {
    const firstIsAlpha = /[A-Za-z]/.test(word[0]);
    for (let i = 0; i < word.length; i++) {
      const ch = word[i].toUpperCase();
      const big = firstIsAlpha && i === 0;
      const size = big ? bigPx : smallPx;
      cx.font = `${weight} ${size}px "Orbitron", sans-serif`;
      const glyphW = cx.measureText(ch).width;
      if (draw) drawOutlinedText(cx, ch, cursorX, y + (bigPx - size), style);
      cursorX += glyphW + letterGap;
    }
    if (wi < words.length - 1) cursorX += wordGap;
  });
  return cursorX - x;
}

function makeLabelTexture(bounceLabel, text, maxTextWidth) {
  const gap = 14;
  const pad = 20; // margin so the stroke/glow isn't clipped at the canvas edge

  const measure = document.createElement('canvas').getContext('2d');
  measure.textBaseline = 'top';
  const bounceStyle = {
    fill: 'rgba(238,247,255,0.98)', stroke: 'rgba(2,5,12,0.92)', strokeWidth: 4,
    glow: 'rgba(1,3,9,0.95)', glowBlur: 7,
  };
  const bounceWidth = layoutSmallCaps(measure, bounceLabel, { bigPx: BOUNCE_FONT_PX, smallPx: SMALLCAPS_FONT_PX, draw: false });

  measure.font = `italic ${BODY_FONT_PX}px "Arapey", serif`;
  measure.letterSpacing = '0px';
  const bodyLines = wrapLines(measure, text, maxTextWidth);
  const bodyWidth = Math.max(...bodyLines.map(l => measure.measureText(l).width));

  const contentW = Math.max(bounceWidth, bodyWidth);
  const contentH = BOUNCE_LINE_H + gap + bodyLines.length * BODY_LINE_H;
  const w = Math.ceil(contentW + pad * 2);
  const h = Math.ceil(contentH + pad * 2);

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d');
  cx.textBaseline = 'top';

  cx.save();
  cx.translate(w / 2, h / 2);
  cx.scale(w / 2, h / 2);
  const scrim = cx.createRadialGradient(0, 0, 0, 0, 0, 1);
  scrim.addColorStop(0, 'rgba(2,6,14,0.86)');
  scrim.addColorStop(0.45, 'rgba(2,6,14,0.78)');
  scrim.addColorStop(0.8, 'rgba(2,6,14,0.34)');
  scrim.addColorStop(1, 'rgba(2,6,14,0)');
  cx.fillStyle = scrim;
  cx.fillRect(-1, -1, 2, 2);
  cx.restore();

  layoutSmallCaps(cx, bounceLabel, {
    bigPx: BOUNCE_FONT_PX, smallPx: SMALLCAPS_FONT_PX, draw: true, x: pad, y: pad, style: bounceStyle,
  });

  cx.font = `italic ${BODY_FONT_PX}px "Arapey", serif`;
  cx.letterSpacing = '0px';
  bodyLines.forEach((line, i) => {
    drawOutlinedText(cx, line, pad, pad + BOUNCE_LINE_H + gap + i * BODY_LINE_H, {
      fill: GOLD_ACCENT_CSS + '0.95)', stroke: 'rgba(2,5,12,0.94)', strokeWidth: 5,
      glow: GOLD_ACCENT_CSS + '0.35)', glowBlur: 9,
    });
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, aspect: w / h, canvasH: h };
}

function buildStation(point, tangent) {
  const coreGeo = new THREE.IcosahedronGeometry(3.2, 0);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x0a0d18, metalness: 0.75, roughness: 0.22,
    emissive: STATION_CORE_WARM, emissiveIntensity: 1.0,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.copy(point);

  const ringGeo = new THREE.TorusGeometry(6.4, 0.24, 8, 40);
  const ringMat = new THREE.MeshStandardMaterial({
    color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.3,
    metalness: 0.3, roughness: 0.3,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(point);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
  ring.quaternion.copy(q);

  return { core, coreGeo, coreMat, ring, ringGeo, ringMat };
}

function buildTerminus(point, tangent) {
  const group = new THREE.Group();
  group.position.copy(point);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

  const gateGeo = new THREE.TorusGeometry(11, 0.7, 10, 48);
  const gateMat = new THREE.MeshStandardMaterial({
    color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.4, metalness: 0.35, roughness: 0.28,
  });
  const gate = new THREE.Mesh(gateGeo, gateMat);
  gate.quaternion.copy(q);

  const gate2Geo = new THREE.TorusGeometry(7.6, 0.42, 8, 40);
  const gate2Mat = new THREE.MeshStandardMaterial({
    color: ACCENT_HALO, emissive: ACCENT_HALO, emissiveIntensity: 1.1, metalness: 0.3, roughness: 0.3,
  });
  const gate2 = new THREE.Mesh(gate2Geo, gate2Mat);
  const tiltQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.5);
  gate2.quaternion.copy(q).multiply(tiltQ);

  const coreGeo = new THREE.IcosahedronGeometry(2.6, 0);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x0a0d18, metalness: 0.7, roughness: 0.2, emissive: ACCENT, emissiveIntensity: 1.2,
  });
  const cores = [];
  [[0, 0, 0], [1.7, 1.1, 0.3], [-1.5, -1.2, -0.2]].forEach(([ox, oy, oz]) => {
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.copy(new THREE.Vector3(ox, oy, oz).applyQuaternion(q));
    cores.push(core);
  });

  const glowTex = makeGlowTexture(ACCENT_HALO_CSS);
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.75,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(9);

  const light = new THREE.PointLight(ACCENT, 2.4, 44, 2);

  group.add(gate, gate2, ...cores, glow, light);

  return { group, gate, gateGeo, gateMat, gate2, gate2Geo, gate2Mat, coreGeo, coreMat, cores, glow, glowMat, glowTex, light };
}

function buildRailTube(curve, radius, opacity, liquid = false) {
  const geo = new THREE.TubeGeometry(curve, 400, radius, 8, false);
  let map = null;
  if (liquid) {
    map = makeLiquidLightTexture();
    const len = curve.getLength();
    map.repeat.set(1, Math.max(1, len / 2.4));
  }
  const mat = new THREE.MeshBasicMaterial({
    color: liquid ? ACCENT : ACCENT_HALO, map, transparent: true, opacity, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, geo, mat, map };
}

function buildVessel(ringPulseTex) {
  const hullGeo = new THREE.ConeGeometry(1.7, 4.6, 6);
  hullGeo.rotateX(Math.PI / 2); // apex now points local +Z (forward), not +Y
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x0a0d18, metalness: 0.85, roughness: 0.2,
    emissive: ACCENT_DEEP, emissiveIntensity: 0.8,
  });
  const hull = new THREE.Mesh(hullGeo, hullMat);

  const rimMat = new THREE.MeshBasicMaterial({
    color: GOLD_ACCENT, transparent: true, opacity: 0.3, side: THREE.BackSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const rim = new THREE.Mesh(hullGeo, rimMat);
  rim.scale.setScalar(1.14);

  const pulseMap = ringPulseTex.clone();
  pulseMap.needsUpdate = true;
  const ringGeo = new THREE.TorusGeometry(1.5, 0.22, 8, 32);
  const ringMat = new THREE.MeshStandardMaterial({
    color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.8, emissiveMap: pulseMap,
    metalness: 0.3, roughness: 0.25,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(0, 0, -1.9); // mounted at the hull's rear, facing back along the direction of travel

  const glowTex = makeGlowTexture(ACCENT_HALO_CSS);
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(3.2);
  glow.position.set(0, 0, -2.2);

  const group = new THREE.Group();
  group.add(hull, rim, ring, glow);

  return { group, hull, hullGeo, hullMat, rim, rimMat, ring, ringGeo, ringMat, pulseMap, glow, glowMat, glowTex };
}

export function createBeamline(container, { preview = false, initialPieceId = null, onPieceChange = null } = {}) {
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  const FOG_DENSITY = preview ? 0.0035 : 0.0025;
  scene.fog = new THREE.FogExp2(HORIZON_COLOR, FOG_DENSITY);
  scene.background = new THREE.Color(0x00020a);

  const camera = new THREE.PerspectiveCamera(46, w / h, 0.1, 2500);

  const WAYPOINTS = [
    { name: 'P_START', x: -40, y: 6,  z: 10 },
    { name: 'S1',      x: 0,   y: 4,  z: -15 },
    { name: 'S2',      x: 42,  y: 22, z: -35 },
    { name: 'S3',      x: 85,  y: 46, z: 45 },
    { name: 'S4',      x: 128, y: 16, z: 65 },
    { name: 'S5',      x: 168, y: 5,  z: 20 },
    { name: 'S6',      x: 208, y: 30, z: -50 },
    { name: 'S7',      x: 250, y: 68, z: -95 },
    { name: 'S8',      x: 292, y: 18, z: -50 },
    { name: 'S9',      x: 330, y: 6,  z: 10 },
    { name: 'S10',     x: 372, y: 42, z: 92 },
    { name: 'P_END',   x: 410, y: 14, z: 60 },
  ];
  const curve = new THREE.CatmullRomCurve3(
    WAYPOINTS.map(p => new THREE.Vector3(p.x, p.y, p.z)),
    false, 'centripetal',
  );
  const STATION_ARC_T = [0.0600, 0.1255, 0.2470, 0.3210, 0.4005, 0.5085, 0.6025, 0.7055, 0.7980, 0.9255];

  const CAM_TARGET = new THREE.Vector3(CAM_TARGET_POS.x, CAM_TARGET_POS.y, CAM_TARGET_POS.z);
  const CAM_MIN = 28, CAM_MAX = 620;

  const P_START = WAYPOINTS[0];
  const THETA = Math.atan2(P_START.x - CAM_TARGET.x, P_START.z - CAM_TARGET.z);
  const GROUND_PHI_Y = -0.05;
  function fitRouteAtTheta(aspect) {
    const margin = 0.85; // NDC target — 15% padding on every side, so the route's own bookends aren't jammed against the frame edge
    const N = 120; // runtime curve-sample count — dense enough to catch the real shape; this samples for framing, not for terrain clearance
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const phi0 = Math.acos(THREE.MathUtils.clamp(GROUND_PHI_Y, -1, 1));
    const sinPhi = Math.sin(phi0), cosPhi = Math.cos(phi0);
    function fitsAt(dist) {
      camera.position.set(
        CAM_TARGET.x + dist * sinPhi * Math.sin(THETA),
        CAM_TARGET.y + dist * cosPhi,
        CAM_TARGET.z + dist * sinPhi * Math.cos(THETA),
      );
      camera.lookAt(CAM_TARGET);
      camera.updateMatrixWorld(true);
      const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      for (let i = 0; i <= N; i++) {
        const p = curve.getPointAt(i / N);
        const v4 = new THREE.Vector4(p.x, p.y, p.z, 1).applyMatrix4(vp);
        if (v4.w <= 0) return false;
        const ndcX = v4.x / v4.w, ndcY = v4.y / v4.w;
        if (Math.abs(ndcX) > margin || Math.abs(ndcY) > margin) return false;
      }
      return true;
    }
    let lo = CAM_MIN, hi = 3000;
    for (let iter = 0; iter < 40; iter++) {
      const mid = (lo + hi) / 2;
      if (fitsAt(mid)) hi = mid; else lo = mid;
    }
    return hi;
  }
  let camDist = preview ? 95 : Math.min(fitRouteAtTheta(w / h), CAM_MAX);
  let theta = THETA;
  let phi = Math.acos(THREE.MathUtils.clamp(GROUND_PHI_Y, -1, 1));
  const PHI_EPS = 0.06;
  const CAMERA_GROUND_CLEARANCE = 8;
  function updateCamera() {
    const sinPhi = Math.sin(phi);
    const x = CAM_TARGET.x + camDist * sinPhi * Math.sin(theta);
    const z = CAM_TARGET.z + camDist * sinPhi * Math.cos(theta);
    let y = CAM_TARGET.y + camDist * Math.cos(phi);
    const minY = terrainHeight(x, z) + CAMERA_GROUND_CLEARANCE;
    if (y < minY) y = minY;
    camera.position.set(x, y, z);
    camera.lookAt(CAM_TARGET);
  }
  updateCamera();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  const managedRenderer = manageRenderer(renderer);
  renderer.setSize(w, h);
  renderer.setClearColor(0x00020a, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  if (!preview) container.appendChild(renderer.domElement);
  const clippedPreview = preview ? mountClippedPreviewCanvas(container, renderer) : null;

  const containerClaim = !preview ? claimContainer(container) : null;

  const timers = trackTimers();

  const root = new THREE.Group();
  scene.add(root);
  const reduceMotion = prefersReducedMotion();

  const skyTex = makeSkyboxTexture();
  const skyGeo = new THREE.SphereGeometry(1400, 32, 20);
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(0x14468f, 0x020304, 0.4));
  const key = new THREE.DirectionalLight(0x6f9de8, 0.42);
  key.position.set(4, 6, 5);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0x071230, 0.28));
  const vesselLight = new THREE.PointLight(ACCENT, preview ? 1.8 : 2.9, 11, 2);
  scene.add(vesselLight);

  let terrain = null, terrainGeo = null, terrainMat = null, terrainTex = null;
  {
    const W = preview ? PLANE_W * PREVIEW_PLANE_SCALE : PLANE_W;
    const H = preview ? PLANE_H * PREVIEW_PLANE_SCALE : PLANE_H;
    const SEGX = preview ? 60 : 640, SEGY = preview ? 48 : 512;
    terrainGeo = new THREE.PlaneGeometry(W, H, SEGX, SEGY);
    terrainGeo.rotateX(-Math.PI / 2);
    const pos = terrainGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i) + TERRAIN_CENTER.x;
      const wz = pos.getZ(i) + TERRAIN_CENTER.z;
      const y = terrainHeight(wx, wz);
      pos.setY(i, y);
      const c = terrainVertexColor(wx, wz, y);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    pos.needsUpdate = true;
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    terrainTex = makeGridTexture(); // repeat arg irrelevant — both axes overridden next line for whichever extent above
    terrainTex.repeat.x = preview ? 145 : 727; // plane isn't square — keeps grid cells ~11 units on both axes (1600/145≈11.0, 8000/727≈11.0)
    terrainTex.repeat.y = preview ? 116 : 582; // 1280/116≈11.0, 6400/582≈11.0
    terrainMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: true, emissive: 0xffffff, emissiveMap: terrainTex,
      emissiveIntensity: 0.5, roughness: 0.85, metalness: 0.05, fog: true,
      side: THREE.DoubleSide,
    });
    terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.position.set(TERRAIN_CENTER.x, 0, TERRAIN_CENTER.z);
    root.add(terrain);
  }

  const railCore = buildRailTube(curve, 0.5, 0.95, true);
  const railMid = buildRailTube(curve, 1.6, 0.35);
  const railOuter = buildRailTube(curve, 3.2, 0.12);
  root.add(railOuter.mesh, railMid.mesh, railCore.mesh);
  const totalLength = curve.getLength();

  const stations = [];
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < STATION_ARC_T.length; i++) {
    const t = STATION_ARC_T[i];
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    let lateral = tangent.clone().cross(WORLD_UP);
    if (lateral.lengthSq() < 1e-6) lateral.set(1, 0, 0); else lateral.normalize();
    const st = buildStation(point, tangent);
    root.add(st.core, st.ring);
    stations.push({
      ...st, point, tangent, lateral, arcT: t, baseEmissive: 1.0, stationIndex: i,
      pulseSeed: i * 1.732 + 0.6, pulseRate: 0.5 + ((i * 37) % 11) * 0.03, idleGlow: 0,
    });
  }

  const startTex = makeGlowTexture('rgba(235,250,255,');
  const startMat = new THREE.SpriteMaterial({ map: startTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const startSprite = new THREE.Sprite(startMat);
  startSprite.scale.setScalar(2.2);
  startSprite.position.copy(curve.getPointAt(0));
  root.add(startSprite);

  const terminus = buildTerminus(curve.getPointAt(1), curve.getTangentAt(1).normalize());
  root.add(terminus.group);

  const ringPulseTex = makeRingPulseTexture();
  const vessel = buildVessel(ringPulseTex);
  root.add(vessel.group);
  const STATION_GLOW_ARC = 20; // world units of arc-length either side of the vessel's real position that a station counts as "lit"
  const FORWARD_AXIS = new THREE.Vector3(0, 0, 1);
  const vesselPos = new THREE.Vector3();
  const vesselTangent = new THREE.Vector3();
  const vesselQuat = new THREE.Quaternion();

  const LEVY_MU = 2.0;
  const LEVY_L_MIN = totalLength * 0.006;
  const LEVY_L_MAX = totalLength * 0.4;
  const LEVY_FORWARD_BIAS = 0.85; // most steps net-progress forward along the rail; a minority double back, real "local drift" rather than a one-way conveyor
  const levyRng = mulberry32(hashSeed('beamline-vessel-levy'));
  function sampleLevyStep() {
    const u = Math.max(levyRng(), 1e-9); // clamped away from exactly 0 — u=0 would make the exponentiation below divide by zero / return Infinity
    const L = LEVY_L_MIN * Math.pow(u, -1 / (LEVY_MU - 1));
    return Math.min(L, LEVY_L_MAX); // the safety clamp described above — without it, an extremely small u (rare but possible) could sample a step far larger than the whole rail
  }
  let vesselArc = 0, stepFromArc = 0, stepDelta = 0, stepStartT = 0, stepDuration = 1;
  function beginLevyStep(fromArc, atTime) {
    const L = sampleLevyStep();
    const sign = levyRng() < LEVY_FORWARD_BIAS ? 1 : -1;
    stepFromArc = fromArc;
    stepDelta = sign * L; // signed, NOT wrapped — wrapping happens only when computing the actual on-curve position each frame, so the glide always travels the intended direction even across the loop point
    stepStartT = atTime;
    stepDuration = Math.min(3.2, 0.35 + L / (totalLength * 0.05));
  }
  beginLevyStep(0, 0);

  let title = null, hint = null;
  let jumpList = null, srLive = null;
  let touchGuard = null;


  if (!preview) {
    const shell = parseHTML(beamlineHtml);
    title = shell.querySelector('.beamline-title');
    title.querySelector('.beamline-title-main').textContent = EPIGRAPH_PRIMARY;
    title.querySelector('.beamline-title-sub').textContent = EPIGRAPH_SECONDARY;
    document.body.appendChild(title);

    hint = shell.querySelector('.beamline-hint');
    document.body.appendChild(hint);

    srLive = shell.querySelector('.beamline-sr-live');
    container.appendChild(srLive);

    jumpList = createJumpList(container, {
      label: 'Read the found text staged at each station along the rail',
      items: stations,
      getLabel: (s, i) => `Station ${i + 1} of ${stations.length}`,
      onSelect: s => showLabel(s),
    });

    touchGuard = bindTapVsDrag(container);
  }

  const labelFontsReady = document.fonts.load(`italic ${BODY_FONT_PX}px "Arapey"`).catch(() => {});
  const LABEL_OFFSET = 7;     // world units off the station's own point, along its lateral direction
  const LABEL_LIFT = 3;       // small +Y nudge so the label reads as beside-and-above, not level with the station
  const WORDS_PER_SECOND = 2.3;
  const LABEL_SUSTAIN_MIN = 3.0; // floor so even the shortest fragment (3 words) doesn't blink past
  const LABEL_FADE = 2.4;        // seconds to fade out, unhurried enough to read comfortably
  function computeSustain(text) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(LABEL_SUSTAIN_MIN, words / WORDS_PER_SECOND);
  }
  let labelSustain = LABEL_SUSTAIN_MIN;
  const TEXT_TARGET_PX = 27;
  const TEXT_SCALE_RATIO = TEXT_TARGET_PX / BODY_FONT_PX;
  let labelTex = null, labelAspect = 620 / 120, labelCanvasH = 120;
  const labelMat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, fog: false });
  const labelSprite = new THREE.Sprite(labelMat);
  labelSprite.visible = false;
  labelSprite.renderOrder = 10;
  root.add(labelSprite);
  let labelShownAt = -Infinity;
  let viewportH = h, viewportW = w; // kept in sync by the resize handler below
  const LABEL_MAX_VIEWPORT_W = 0.88;
  const LABEL_MAX_VIEWPORT_H = 0.72;
  const LABEL_WRAP_MAX = 620; // the width the card was designed at
  const LABEL_WRAP_MIN = 260; // below this the wrap breaks short phrases badly
  function labelWrapWidth() {
    const fits = (viewportW * LABEL_MAX_VIEWPORT_W) / TEXT_SCALE_RATIO - 40;
    return Math.round(Math.max(LABEL_WRAP_MIN, Math.min(LABEL_WRAP_MAX, fits)));
  }
  const LABEL_EDGE_PAD = 10;
  const LABEL_TOP_INSET = 64;    // #pm-nav is 3.5rem tall
  const LABEL_BOTTOM_INSET = 76; // #site-title's pill, plus its own bottom offset
  const labelAnchor = new THREE.Vector3();
  let disposed = false;

  const _labelNdc = new THREE.Vector3();
  const _camRight = new THREE.Vector3();
  const _camUp = new THREE.Vector3();

  function updateLabelScale() {
    const dist = camera.position.distanceTo(labelAnchor);
    const fovRad = camera.fov * Math.PI / 180;
    let targetPx = labelCanvasH * TEXT_SCALE_RATIO;
    const fit = Math.min(
      1,
      (viewportW * LABEL_MAX_VIEWPORT_W) / (targetPx * labelAspect),
      (viewportH * LABEL_MAX_VIEWPORT_H) / targetPx,
    );
    targetPx *= fit;
    const worldPerPx = 2 * Math.tan(fovRad / 2) * dist / viewportH;
    const worldH = targetPx * worldPerPx;
    labelSprite.scale.set(worldH * labelAspect, worldH, 1);

    _labelNdc.copy(labelAnchor).project(camera);
    const screenX = (_labelNdc.x * 0.5 + 0.5) * viewportW;
    const screenY = (-_labelNdc.y * 0.5 + 0.5) * viewportH;
    const halfW = targetPx * labelAspect / 2;
    const halfH = targetPx / 2;
    const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
    const dxPx = clamp(screenX, halfW + LABEL_EDGE_PAD, viewportW - halfW - LABEL_EDGE_PAD) - screenX;
    const dyPx = clamp(screenY, halfH + LABEL_TOP_INSET, viewportH - halfH - LABEL_BOTTOM_INSET) - screenY;

    camera.matrixWorld.extractBasis(_camRight, _camUp, _labelNdc);
    labelSprite.position.copy(labelAnchor)
      .addScaledVector(_camRight, dxPx * worldPerPx)
      .addScaledVector(_camUp, -dyPx * worldPerPx);
  }

  async function showLabel(s) {
    selectedStation = s;
    onPieceChange?.(BOUNCES[s.stationIndex]?.id);
    await labelFontsReady;
    if (disposed) return;
    labelTex?.dispose();
    const stationLabel = `Station ${s.stationIndex + 1} of ${stations.length}`;
    const text = BOUNCES[s.stationIndex]?.text ?? '';
    const { tex, aspect, canvasH } = makeLabelTexture(stationLabel, text, labelWrapWidth());
    labelTex = tex;
    labelAspect = aspect;
    labelCanvasH = canvasH;
    labelMat.map = labelTex;
    labelMat.opacity = 1;
    labelMat.needsUpdate = true;
    labelAnchor.copy(s.point)
      .addScaledVector(s.lateral, LABEL_OFFSET)
      .add(new THREE.Vector3(0, LABEL_LIFT, 0));
    updateLabelScale();
    labelSprite.visible = true;
    labelShownAt = tSec;
    labelSustain = computeSustain(text);
    if (srLive) srLive.textContent = `${stationLabel}: ${text}`;
  }
  function dismissLabel() {
    if (labelSprite.visible) labelShownAt = tSec - labelSustain;
  }

  const escapeClose = !preview ? bindEscapeClose(dismissLabel) : null;
  const transientOverlay = !preview
    ? registerTransientOverlay(() => labelSprite.visible)
    : null;

  function openPieceById(id) {
    const station = stations.find(s => BOUNCES[s.stationIndex]?.id === id);
    if (station) showLabel(station);
  }

  let autoRotate = true;
  const orbitDrag = !preview ? bindOrbitDrag(container, {
    onDragStart: () => { autoRotate = false; },
    onDrag: (dx, dy) => {
      theta -= dx;
      phi = Math.max(PHI_EPS, Math.min(Math.PI - PHI_EPS, phi - dy));
      updateCamera();
    },
    onDragEnd: () => { timers.after(2500, () => { autoRotate = true; }); },
  }) : null;
  const wheelZoom = !preview ? bindWheelZoom(container, {
    onZoom: deltaY => {
      camDist = Math.max(CAM_MIN, Math.min(CAM_MAX, camDist + deltaY * 0.02));
      updateCamera();
    },
  }) : null;

  let hoveredStation = null, selectedStation = null;
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let disposeHoverClick = null;

  if (!preview) {
    const stationCores = stations.map(s => s.core);

    function stationAt(clientX, clientY) {
      const rect = container.getBoundingClientRect();
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(stationCores);
      return hits.length ? stations.find(s => s.core === hits[0].object) : null;
    }

    const onMove = e => {
      const newHover = stationAt(e.clientX, e.clientY);
      if (newHover !== hoveredStation) {
        hoveredStation = newHover;
        containerClaim.setCursor(hoveredStation ? 'pointer' : 'default');
      }
    };
    container.addEventListener('mousemove', onMove);

    const onClick = e => {
      if (touchGuard.consume()) return;
      const station = stationAt(e.clientX, e.clientY);
      if (!station) { dismissLabel(); return; }
      showLabel(station);
    };
    container.addEventListener('click', onClick);

    disposeHoverClick = () => {
      container.removeEventListener('mousemove', onMove);
      container.removeEventListener('click', onClick);
    };
  }

  let dust = null, dustGeo = null, dustMat = null, dustTex = null;
  if (!preview) {
    dustTex = makeGlowTexture(ACCENT_HALO_CSS);
    const n = 160;
    const positions = new Float32Array(n * 3);
    const dustCenter = CAM_TARGET;
    for (let i = 0; i < n; i++) {
      positions[i * 3]     = dustCenter.x + (Math.random() - 0.5) * 500;
      positions[i * 3 + 1] = dustCenter.y + (Math.random() - 0.5) * 90;
      positions[i * 3 + 2] = dustCenter.z + (Math.random() - 0.5) * 220;
    }
    dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    dustMat = new THREE.PointsMaterial({
      size: 0.46, map: dustTex, color: ACCENT_HALO, transparent: true, opacity: 0.4,
      depthWrite: false, sizeAttenuation: true,
    });
    dust = new THREE.Points(dustGeo, dustMat);
    root.add(dust);
  }


  let shimmer = null, shimmerGeo = null, shimmerMat = null, shimmerTex = null;
  if (!preview && terrainGeo) {
    shimmerTex = makeShimmerTexture();
    shimmerTex.repeat.set(46, 35);
    shimmerGeo = terrainGeo.clone();
    shimmerGeo.translate(0, 0.4, 0);
    shimmerMat = new THREE.MeshBasicMaterial({
      map: shimmerTex, transparent: true, opacity: 0.16, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: true, side: THREE.DoubleSide,
    });
    shimmer = new THREE.Mesh(shimmerGeo, shimmerMat);
    shimmer.position.set(TERRAIN_CENTER.x, 0, TERRAIN_CENTER.z);
    root.add(shimmer);
  }

  let gridBugs = null, gridBugsGeo = null, gridBugsMat = null, gridBugsTex = null;
  const gridBugState = [];
  if (!preview) {
    gridBugsTex = makeGlowTexture(ACCENT_HALO_CSS);
    const N_BUGS = 14;
    const bugRng = mulberry32(hashSeed('beamline-grid-bugs'));
    const positions = new Float32Array(N_BUGS * 3);
    for (let i = 0; i < N_BUGS; i++) {
      const x = CAM_TARGET.x + (bugRng() - 0.5) * 420;
      const z = CAM_TARGET.z + (bugRng() - 0.5) * 220;
      gridBugState.push({
        x, z, heading: bugRng() * Math.PI * 2,
        speed: 1.4 + bugRng() * 1.8,
        seed: bugRng() * 1000,
        bob: bugRng() * Math.PI * 2,
      });
      positions[i * 3] = x;
      positions[i * 3 + 1] = terrainHeight(x, z) + 0.5;
      positions[i * 3 + 2] = z;
    }
    gridBugsGeo = new THREE.BufferGeometry();
    gridBugsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    gridBugsMat = new THREE.PointsMaterial({
      size: 0.9, map: gridBugsTex, color: ACCENT_HALO, transparent: true, opacity: 0.8,
      depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending,
    });
    gridBugs = new THREE.Points(gridBugsGeo, gridBugsMat);
    root.add(gridBugs);
  }

  const SKY_MOTE_HALF_X = 700, SKY_MOTE_HALF_Z = 500; // wrap bounds — well past the grid bugs' own ~420×220 footprint
  const SKY_MOTE_Y_MIN = 130, SKY_MOTE_Y_MAX = 340;   // comfortably above the terrain's tallest mound (~68) and the grid bugs' near-ground band
  let skyMotes = null, skyMotesGeo = null, skyMotesMat = null, skyMotesTex = null;
  const skyMoteState = [];
  if (!preview) {
    skyMotesTex = makeGlowTexture('rgba(200,220,255,');
    const N_MOTES = 10;
    const moteRng = mulberry32(hashSeed('beamline-sky-motes'));
    const positions = new Float32Array(N_MOTES * 3);
    for (let i = 0; i < N_MOTES; i++) {
      const x = CAM_TARGET.x + (moteRng() - 0.5) * 2 * SKY_MOTE_HALF_X;
      const y = CAM_TARGET.y + SKY_MOTE_Y_MIN + moteRng() * (SKY_MOTE_Y_MAX - SKY_MOTE_Y_MIN);
      const z = CAM_TARGET.z + (moteRng() - 0.5) * 2 * SKY_MOTE_HALF_Z;
      skyMoteState.push({
        x, y, z,
        heading: moteRng() * Math.PI * 2,
        speed: 0.35 + moteRng() * 0.5, // well under gridBugs' own 1.4-3.2 — slow enough to read as distant, not local
        bob: moteRng() * Math.PI * 2,
        bobRate: 0.05 + moteRng() * 0.05,
      });
      positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    }
    skyMotesGeo = new THREE.BufferGeometry();
    skyMotesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    skyMotesMat = new THREE.PointsMaterial({
      size: 5.5, map: skyMotesTex, color: 0xffffff, transparent: true, opacity: 0.5,
      depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending,
    });
    skyMotes = new THREE.Points(skyMotesGeo, skyMotesMat);
    root.add(skyMotes);
  }

  const GRID_CELL = 2600 / 236; // ≈11.02 — the real on-screen cell spacing the terrain's own grid texture produces — STRUCTURAL: this is measured to match the terrain grid texture, not a free spacing choice; changing it desyncs either tier from the ground pattern it's meant to sit on. FAR uses a clean multiple of this (3x), not an unrelated spacing, so its points still land on real terrain grid intersections, just every third one.
  const CA_EDGE_START = 0.8; // fraction of a tier's own half-extent where its perimeter falloff begins — matches EDGE_FALLOFF_START's role for the terrain — TUNABLE, same effect as that constant: smaller = falloff band starts closer to center (more of the lattice looks "eroded"), closer to 1 = only the very outer rim fades. FAR ONLY, as of 4.11.17 — see `perimeter` in the header comment above for why NEAR no longer has an edge to dissolve.
  const CA_SCATTER = 0.36;
  const CA_SEED_DENSITY = 0.28; // classic "random soup" density for interesting Life activity — TUNABLE, but not freely: Life is known to behave interestingly (a mix of die-off, stabilization, and sustained activity) around densities roughly in the 0.2-0.4 range; push it much lower and almost everything dies in a few generations, push it much higher and the grid tends to collapse into a static, over-crowded mess faster
  function stepGameOfLife(grid, next, cols, rows) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) n += grid[ny * cols + nx];
        }
        const alive = grid[y * cols + x] === 1;
        next[y * cols + x] = alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
      }
    }
  }
  function createGrowthTier({ name, cols, rows, cellSize, stepInterval, ease, tex, colorRgb, perimeter }) {
    const rng = mulberry32(hashSeed(`beamline-growth-ca-${name}`));
    const seedGrid = g => {
      for (let i = 0; i < g.length; i++) g[i] = rng() < CA_SEED_DENSITY ? 1 : 0;
      return g;
    };
    let grid = seedGrid(new Uint8Array(cols * rows));
    let gridNext = new Uint8Array(cols * rows);
    const positions = new Float32Array(cols * rows * 3);
    const colors = new Float32Array(cols * rows * 3);
    const edgeFactor = new Float32Array(cols * rows);
    const eligible = new Uint8Array(cols * rows);
    const brightness = new Float32Array(cols * rows);
    const baseX = CAM_TARGET.x - (cols / 2) * cellSize;
    const baseZ = CAM_TARGET.z - (rows / 2) * cellSize;
    const halfW = (cols / 2) * cellSize, halfH = (rows / 2) * cellSize;
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const i = cy * cols + cx;
        const gx = baseX + cx * cellSize, gz = baseZ + cy * cellSize;
        const nx = (gx - CAM_TARGET.x) / halfW, nz = (gz - CAM_TARGET.z) / halfH;
        const rNorm = Math.sqrt(nx * nx + nz * nz);
        const edge = !perimeter ? 1
          : rNorm <= CA_EDGE_START ? 1
          : rNorm >= 1 ? 0
          : 1 - smoothstep01((rNorm - CA_EDGE_START) / (1 - CA_EDGE_START));
        edgeFactor[i] = edge;
        const rElig = rng(), rjx = rng(), rjz = rng();
        eligible[i] = rElig < edge ? 1 : 0;
        const wx = gx + (rjx - 0.5) * cellSize * 2.2 * CA_SCATTER;
        const wz = gz + (rjz - 0.5) * cellSize * 2.2 * CA_SCATTER;
        positions[i * 3] = wx;
        positions[i * 3 + 1] = terrainHeight(wx, wz) + 0.35;
        positions[i * 3 + 2] = wz;
        brightness[i] = grid[i]; // start already at the seed's own state, no fade-in from black on load
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 4.4, map: tex, vertexColors: true, transparent: true,
      depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    const [cr, cg, cb] = colorRgb.map(v => v / 255);
    function writeColors() {
      const colorAttr = geo.attributes.color;
      for (let i = 0; i < grid.length; i++) {
        const b = brightness[i] * edgeFactor[i];
        colorAttr.setXYZ(i, cr * b, cg * b, cb * b);
      }
      colorAttr.needsUpdate = true;
    }
    writeColors(); // paint the seeded state immediately, don't wait for the first step
    let timer = 0;
    let easeSettled = false;
    const EASE_EPSILON = 1 / 255; // one step of an 8-bit colour channel — below this the upload cannot change a pixel
    function tick(dt, reduceMotion) {
      timer += dt;
      let stepped = false;
      if (timer >= stepInterval) {
        timer -= stepInterval;
        stepGameOfLife(grid, gridNext, cols, rows);
        const swap = grid; grid = gridNext; gridNext = swap;
        let alive = 0;
        for (let i = 0; i < grid.length; i++) alive += grid[i];
        if (alive === 0) seedGrid(grid);
        stepped = true;
      }
      if (ease) {
        if (stepped) easeSettled = false;
        if (easeSettled) return;
        const rate = reduceMotion ? 1 : Math.min(1, 0.1 * dt * 60);
        let maxGap = 0;
        for (let i = 0; i < grid.length; i++) {
          const target = eligible[i] ? grid[i] : 0;
          const gap = target - brightness[i];
          const mag = gap < 0 ? -gap : gap;
          if (mag > maxGap) maxGap = mag;
          if (mag <= EASE_EPSILON) brightness[i] = target;
          else brightness[i] += gap * rate;
        }
        writeColors();
        if (maxGap <= EASE_EPSILON) easeSettled = true;
      } else if (stepped) {
        for (let i = 0; i < grid.length; i++) brightness[i] = eligible[i] ? grid[i] : 0;
        writeColors();
      }
    }
    return { points, geo, mat, tick };
  }
  let caNear = null, caFar = null, caGlowTex = null;
  if (!preview) {
    caGlowTex = makeGlowTexture('rgba(120,220,190,'); // slightly green-shifted from ACCENT — reads as young growth, not more current. Shared by both tiers — one texture, not two.
    caNear = createGrowthTier({
      name: 'near', cols: 64, rows: 34, cellSize: GRID_CELL, stepInterval: 1.7,
      ease: true, tex: caGlowTex, colorRgb: [120, 220, 190], perimeter: false,
    });
    caFar = createGrowthTier({
      name: 'far', cols: 46, rows: 24, cellSize: GRID_CELL * 3, stepInterval: 1.7 * 4,
      ease: false, tex: caGlowTex, colorRgb: [120, 220, 190], perimeter: true,
    });
    root.add(caNear.points, caFar.points);
  }

  let animId = null, tSec = 0;
  const clock = createFrameClock();
  function animate() {
    animId = requestAnimationFrame(animate);
    const dt = clock.tick();
    const frames = dt * 60; // 1.0 at 60fps, 0.5 at 120fps — the conversion factor for every hand-tuned per-frame rate below
    tSec += dt;

    if (!reduceMotion) {
      if (autoRotate && !(orbitDrag && orbitDrag.isDragging)) {
        theta += (preview ? 0.003 : 0.0009) * frames;
        updateCamera();
      }
      if (dust) dust.rotation.y += 0.0006 * frames;
      if (railCore.map) {
        railCore.map.offset.y -= dt * (preview ? 0.5 : 0.85);
      }
      const engineRate = 0.35 + organicWave(tSec * 0.04, 2.4) * 0.45;
      vessel.pulseMap.offset.x -= engineRate * dt;
      vessel.ringMat.emissiveIntensity = 1.4 + organicWave(tSec * 0.6, 7.1) * 1.2;

      if (shimmerTex) {
        shimmerTex.offset.x = organicWave(tSec * 0.05, 0.3) * 1.4 - 0.7;
        shimmerTex.offset.y = organicWave(tSec * 0.037, 1.9) * 1.4 - 0.7;
      }
      if (gridBugs) {
        const posAttr = gridBugsGeo.attributes.position;
        gridBugState.forEach((b, i) => {
          b.heading += (organicWave(tSec * 0.15, b.seed) - 0.5) * 0.05 * frames;
          b.x += Math.cos(b.heading) * b.speed * dt;
          b.z += Math.sin(b.heading) * b.speed * dt;
          const dx = b.x - CAM_TARGET.x, dz = b.z - CAM_TARGET.z;
          if (Math.abs(dx) > 210 || Math.abs(dz) > 110) {
            const home = Math.atan2(-dz, -dx);
            b.heading += (home - b.heading) * 0.03 * frames;
          }
          const y = terrainHeight(b.x, b.z) + 0.5 + Math.sin(tSec * 0.4 + b.bob) * 0.15;
          posAttr.setXYZ(i, b.x, y, b.z);
        });
        posAttr.needsUpdate = true;
        gridBugsMat.opacity = 0.55 + organicWave(tSec * 0.6, 3.3) * 0.3;
      }
      if (skyMotes) {
        const posAttr = skyMotesGeo.attributes.position;
        skyMoteState.forEach((m, i) => {
          m.x += Math.cos(m.heading) * m.speed * dt;
          m.z += Math.sin(m.heading) * m.speed * dt;
          const dx = m.x - CAM_TARGET.x, dz = m.z - CAM_TARGET.z;
          if (dx > SKY_MOTE_HALF_X) m.x -= 2 * SKY_MOTE_HALF_X;
          else if (dx < -SKY_MOTE_HALF_X) m.x += 2 * SKY_MOTE_HALF_X;
          if (dz > SKY_MOTE_HALF_Z) m.z -= 2 * SKY_MOTE_HALF_Z;
          else if (dz < -SKY_MOTE_HALF_Z) m.z += 2 * SKY_MOTE_HALF_Z;
          const y = m.y + Math.sin(tSec * m.bobRate + m.bob) * 4;
          posAttr.setXYZ(i, m.x, y, m.z);
        });
        posAttr.needsUpdate = true;
      }
      stations.forEach(st => {
        st.idleGlow = organicWave(tSec * (0.3 + st.pulseRate * 0.3), st.pulseSeed + 5) * 0.6;
      });
      terminus.coreMat.emissiveIntensity = 1.0 + organicWave(tSec * 0.35, 12.3) * 0.7;
      terminus.glowMat.opacity = 0.55 + organicWave(tSec * 0.3, 8.8) * 0.35;
    }

    caNear?.tick(dt, reduceMotion);
    caFar?.tick(dt, reduceMotion);

    const rawT = (tSec - stepStartT) / stepDuration;
    if (rawT >= 1) {
      vesselArc = ((stepFromArc + stepDelta) % totalLength + totalLength) % totalLength;
      beginLevyStep(vesselArc, tSec);
    } else {
      const eased = smoothstep01(Math.max(0, rawT));
      const pos = stepFromArc + stepDelta * eased;
      vesselArc = ((pos % totalLength) + totalLength) % totalLength;
    }
    const vesselU = vesselArc / totalLength;
    curve.getPointAt(vesselU, vesselPos);
    curve.getTangentAt(vesselU, vesselTangent).normalize();
    vessel.group.position.copy(vesselPos);
    vessel.group.quaternion.copy(vesselQuat.setFromUnitVectors(FORWARD_AXIS, vesselTangent));
    vesselLight.position.copy(vesselPos);
    const flicker = reduceMotion ? 0.9 : 0.9 + Math.sin(tSec * 17) * 0.1;
    vessel.glowMat.opacity = flicker * 0.85;

    stations.forEach(st => {
      let dArc = Math.abs(vesselArc - st.arcT * totalLength);
      dArc = Math.min(dArc, totalLength - dArc); // wrap-around distance, shortest way round the loop
      const near = Math.max(0, 1 - dArc / STATION_GLOW_ARC);
      const hoverBoost = (st === hoveredStation || st === selectedStation) ? 0.5 : 0;
      st.coreMat.emissiveIntensity = st.baseEmissive + st.idleGlow + near * 1.3 + hoverBoost;
      st.ringMat.emissiveIntensity = 1.3 + st.idleGlow * 0.5 + near * 1.0 + hoverBoost * 0.5;
    });

    if (labelSprite.visible) {
      updateLabelScale();
      const age = tSec - labelShownAt;
      if (age < labelSustain) {
        labelMat.opacity = 1;
      } else if (age < labelSustain + LABEL_FADE) {
        labelMat.opacity = 1 - (age - labelSustain) / LABEL_FADE;
      } else {
        labelSprite.visible = false;
        selectedStation = null;
        onPieceChange?.(null);
      }
    }

    renderer.render(scene, camera);
    clippedPreview?.blit();
  }

  if (!preview && initialPieceId !== null) openPieceById(initialPieceId);

  animate();

  const resize = bindGuardedResize(container, (nw, nh) => {
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    managedRenderer.applyPixelRatio();
    renderer.setSize(nw, nh);
    viewportH = nh; viewportW = nw;
    if (labelSprite.visible && selectedStation) showLabel(selectedStation);
  });

  let paused = false;
  function setPaused(next) {
    const want = Boolean(next);
    if (want === paused) return;
    paused = want;
    if (paused) {
      cancelAnimationFrame(animId);
      animId = null;
    } else {
      clock.resync();
      animate();
    }
  }

  return {
    openPieceById,
    setPaused,
    dispose() {
      disposed = true;
      cancelAnimationFrame(animId);
      resize.dispose();
      orbitDrag?.dispose();
      wheelZoom?.dispose();
      escapeClose?.dispose();
    transientOverlay?.dispose();
      timers.dispose();
      disposeHoverClick?.();
      touchGuard?.dispose();
      clippedPreview?.dispose();

      skyGeo.dispose(); skyMat.dispose(); skyTex.dispose();
      railCore.geo.dispose(); railCore.mat.dispose(); railCore.map?.dispose();
      railMid.geo.dispose(); railMid.mat.dispose();
      railOuter.geo.dispose(); railOuter.mat.dispose();
      stations.forEach(st => { st.coreGeo.dispose(); st.coreMat.dispose(); st.ringGeo.dispose(); st.ringMat.dispose(); });
      startTex.dispose(); startMat.dispose();
      terminus.gateGeo.dispose(); terminus.gateMat.dispose();
      terminus.gate2Geo.dispose(); terminus.gate2Mat.dispose();
      terminus.coreGeo.dispose(); terminus.coreMat.dispose();
      terminus.glowTex.dispose(); terminus.glowMat.dispose();
      vessel.hullGeo.dispose(); vessel.hullMat.dispose(); vessel.rimMat.dispose(); // rim shares hullGeo, disposed once above
      vessel.ringGeo.dispose(); vessel.ringMat.dispose(); vessel.pulseMap.dispose();
      vessel.glowTex.dispose(); vessel.glowMat.dispose();
      ringPulseTex.dispose();
      terrainGeo?.dispose(); terrainMat?.dispose(); terrainTex?.dispose();
      dustGeo?.dispose(); dustMat?.dispose(); dustTex?.dispose();
      shimmerGeo?.dispose(); shimmerMat?.dispose(); shimmerTex?.dispose();
      gridBugsGeo?.dispose(); gridBugsMat?.dispose(); gridBugsTex?.dispose();
      skyMotesGeo?.dispose(); skyMotesMat?.dispose(); skyMotesTex?.dispose();
      caNear?.geo.dispose(); caNear?.mat.dispose();
      caFar?.geo.dispose(); caFar?.mat.dispose();
      caGlowTex?.dispose(); // shared by both tiers, disposed once
      labelTex?.dispose(); labelMat.dispose();

      jumpList?.dispose();
      title?.remove();
      hint?.remove();
      srLive?.remove();
      managedRenderer.dispose();
      containerClaim?.restore();
    },
  };
}
