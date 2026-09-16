import * as THREE from 'three';
import { libraryItems, cdRackItems } from './library.text.js';
import { getOutboundLinks, getInboundLinks, isRenderedField } from '../../links.js';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, bindTapVsDrag, prefersReducedMotion, onReducedMotionChange, createPanelCloser, escapeHtml, parseHTML, wireCrossLinks, formatInboundNote, setPanelSide, clickedLeftHalf, claimContainer, disposeSceneGraph, manageRenderer, createFrameClock, trackTimers,
} from '../../utils/sceneKit.js';
import './library.css';
import libraryHtml from './library.html?raw';


const CUBBY_W = 2.4;
const CUBBY_H = 1.7;
const CUBBY_D = 1.0;
const FRAME_T = 0.09;
const COLS = Math.max(...libraryItems.map(it => it.row));
const ROWS = Math.max(...libraryItems.map(it => it.col));
const TOTAL_W = COLS * CUBBY_W + (COLS + 1) * FRAME_T;
const TOTAL_H = ROWS * CUBBY_H + (ROWS + 1) * FRAME_T;


const PALETTE = [
  '#c9c0ab', '#242226', '#7a3230', '#2f4d3a', '#28344a',
  '#8a5a3f', '#5a4a6b', '#9c8a45', '#3a3a3a', '#647568',
  '#a8433a', '#3d5a6b',
];
const BOX_PALETTE = ['#141428', '#1c1830', '#101018'];

const DISC_PALETTE = [
  '#141018', '#1a1108', '#12161e', '#1c1414', '#101820',
  '#22252b', '#2a1f2e', '#3a2418', '#171a12',
  '#e8e2d4', '#d8d2c2',
];
const CD_PALETTE = [
  '#1a1a1e', '#2b2f3a', '#3a3f47',            // the black-spined majority of any rack
  '#f2ece0', '#c4d0d6', '#a8b5bd',            // white, ice, silver
  '#8c2f2a', '#b03a52', '#d96b3a', '#c9a227', // the loud ones
  '#1f3d5c', '#2f5a44', '#6b3a5e', '#7a8b6b', // the quiet ones
  '#5c4630', '#e0c9a0',                        // and the champagne the palette used to be, entirely
];

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function hash01(str, salt) {
  return (hash(str + salt) % 10000) / 10000;
}


function renderLinkedField(itemId, field, text) {
  const html = escapeHtml(text);
  const links = getOutboundLinks('library', itemId, field).map(l => ({ ...l, phrase: escapeHtml(l.phrase) }));
  return wireCrossLinks(html, links, 'library-link');
}

function youtubeEmbedSrc(url) {
  try {
    const u = new URL(url);
    const id = u.searchParams.get('v');
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

function youtubeThumbnailSrc(url) {
  try {
    const u = new URL(url);
    const id = u.searchParams.get('v');
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}

function buildVideoFacade(it, embedSrc) {
  const thumbSrc = youtubeThumbnailSrc(it.youtube);
  const label = it.type === 'cd' ? 'video' : 'pivotal scene';
  const facade = document.createElement('button');
  facade.type = 'button';
  facade.className = 'library-panel-video-facade';
  if (thumbSrc) facade.style.backgroundImage = `url("${thumbSrc}")`;
  facade.setAttribute('aria-label', `Play ${label}: ${it.title}`);
  facade.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = `${embedSrc}?autoplay=1`;
    iframe.title = it.scene ? `${it.title} — ${it.scene}` : it.title;
    iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    facade.replaceWith(iframe);
  }, { once: true });
  return facade;
}

function wrapSpineText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function treatment(font, opts = {}) {
  return { font, weight: 400, italic: false, upper: false, tracking: 0, ...opts };
}
const BOOK_TREATMENTS = [
  treatment('Georgia, "Times New Roman", Times, serif'),
  treatment('"Times New Roman", Times, Georgia, serif', { italic: true }),
  treatment('-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif', { weight: 300 }),
  treatment('Verdana, Geneva, sans-serif', { weight: 700, upper: true, tracking: 1.5 }),
  treatment('"Trebuchet MS", Helvetica, sans-serif', { italic: true }),
  treatment('"Courier New", Courier, monospace', { upper: true, tracking: 1 }),
  treatment('Palatino, "Palatino Linotype", Georgia, serif', { italic: true }),
  treatment('"Arial Narrow", Arial, sans-serif', { weight: 700, upper: true }),
  treatment('"Arial Black", Arial, sans-serif', { weight: 900, upper: true, tracking: 0.5 }),
  treatment('Georgia, serif', { weight: 700, upper: true, tracking: 2 }),
];
const BOX_TREATMENT = treatment('Palatino, "Palatino Linotype", Georgia, serif', { italic: true, upper: true, tracking: 2 });
const DISC_TREATMENTS = [
  treatment('"Arial Narrow", Arial, sans-serif', { weight: 900, upper: true, tracking: 1 }),
  treatment('Arial, Helvetica, sans-serif', { weight: 700, upper: true, tracking: 0.5 }),
  treatment('"Trebuchet MS", Helvetica, sans-serif', { weight: 700, upper: true }),
  treatment('Georgia, "Times New Roman", Times, serif', { weight: 700, upper: true, tracking: 1.5 }),
  treatment('"Arial Black", Arial, sans-serif', { weight: 900, upper: true, tracking: 1 }),
];
const CD_TREATMENTS = [
  treatment('-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif', { weight: 300 }),
  treatment('Verdana, Geneva, sans-serif'),
  treatment('"Trebuchet MS", Helvetica, sans-serif', { weight: 700, upper: true, tracking: 1 }),
  treatment('"Arial Narrow", Arial, sans-serif', { weight: 700, upper: true }),
  treatment('Georgia, "Times New Roman", Times, serif', { italic: true }),
];
function pickTreatment(pool, seed) {
  const idx = Math.floor(hash01(seed, 'font') * pool.length);
  return pool[Math.min(idx, pool.length - 1)];
}
function setTitleFont(cx, t, size) {
  cx.font = `${t.italic ? 'italic ' : ''}${t.weight} ${size}px ${t.font}`;
  if ('letterSpacing' in cx) cx.letterSpacing = `${t.tracking}px`;
}
function titleCase(text, t) {
  return t.upper ? text.toUpperCase() : text;
}
function relLuminance(hex) {
  const n = typeof hex === 'number' ? hex : parseInt(String(hex).replace('#', ''), 16);
  const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
const contrastRatio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

function vividColor(hex) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  hsl.s = Math.min(1, hsl.s * 1.55 + 0.08);
  hsl.l = Math.min(0.68, Math.max(hsl.l, hsl.l * 1.18));
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return `#${c.getHexString()}`;
}

const SPINE_TEXTURE_SCALE = { book: 1.0, disc: 0.8, cd: 0.5 };

function makeSpineTexture(baseColor, title, creator, isBox) {
  const W = 112, H = 800, SCALE = SPINE_TEXTURE_SCALE.book;
  const c = document.createElement('canvas');
  c.width = Math.round(W * SCALE);
  c.height = Math.round(H * SCALE);
  const cx = c.getContext('2d');
  cx.scale(SCALE, SCALE);
  cx.fillStyle = baseColor;
  cx.fillRect(0, 0, W, H);

  const tr = Math.floor(hash01(title, 'tr') * 255);
  const tg = Math.floor(hash01(title, 'tg') * 255);
  const tb = Math.floor(hash01(title, 'tb') * 255);
  cx.fillStyle = `rgba(${tr},${tg},${tb},0.07)`;
  cx.fillRect(0, 0, W, H);

  const vgrad = cx.createLinearGradient(0, 0, 0, H);
  vgrad.addColorStop(0, 'rgba(255,255,255,0.18)');
  vgrad.addColorStop(0.45, 'rgba(255,255,255,0)');
  vgrad.addColorStop(1, 'rgba(0,0,0,0.24)');
  cx.fillStyle = vgrad;
  cx.fillRect(0, 0, W, H);

  const hgrad = cx.createLinearGradient(0, 0, W, 0);
  hgrad.addColorStop(0, 'rgba(0,0,0,0.3)');
  hgrad.addColorStop(0.14, 'rgba(0,0,0,0)');
  hgrad.addColorStop(0.86, 'rgba(0,0,0,0)');
  hgrad.addColorStop(1, 'rgba(0,0,0,0.3)');
  cx.fillStyle = hgrad;
  cx.fillRect(0, 0, W, H);

  if (isBox) {
    const dotCount = 22;
    const pts = [];
    for (let i = 0; i < dotCount; i++) {
      pts.push({
        x: hash01(title, `dotx${i}`) * W,
        y: hash01(title, `doty${i}`) * H,
        r: 0.6 + hash01(title, `dotr${i}`) * 1.3,
      });
    }
    cx.strokeStyle = 'rgba(255,255,255,0.16)';
    cx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
      const a = pts[Math.floor(hash01(title, `la${i}`) * pts.length)];
      const b = pts[Math.floor(hash01(title, `lb${i}`) * pts.length)];
      if (a === b) continue;
      cx.beginPath();
      cx.moveTo(a.x, a.y);
      cx.lineTo(b.x, b.y);
      cx.stroke();
    }
    cx.fillStyle = 'rgba(255,255,255,0.5)';
    pts.forEach(p => {
      cx.beginPath();
      cx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      cx.fill();
    });
  } else {
    cx.fillStyle = 'rgba(255,255,255,0.18)';
    cx.fillRect(0, 10, W, 3);
    cx.fillRect(0, H - 13, W, 3);

    const bandSpots = [0.1 + hash01(title, 'b0') * 0.12, 0.8 + hash01(title, 'b1') * 0.12];
    bandSpots.forEach((frac, i) => {
      if (i === 1 && hash01(title, 'bskip') > 0.7) return; // not every spine gets both
      const by = H * frac;
      cx.fillStyle = 'rgba(0,0,0,0.22)';
      cx.fillRect(0, by, W, 3);
      cx.fillStyle = 'rgba(255,255,255,0.12)';
      cx.fillRect(0, by + 3, W, 1);
    });
  }

  const DARK_INK = 0x201a14, CREAM_INK = 0xf0ece0;
  const spineLum = relLuminance(baseColor);
  const useDark = contrastRatio(spineLum, relLuminance(DARK_INK))
                > contrastRatio(spineLum, relLuminance(CREAM_INK));
  const inkTitle = useDark ? 'rgba(32,26,20,0.88)' : 'rgba(240,236,224,0.92)';
  const inkCreator = useDark ? 'rgba(32,26,20,0.6)' : 'rgba(240,236,224,0.62)';

  const t = isBox ? BOX_TREATMENT : pickTreatment(BOOK_TREATMENTS, title);

  cx.save();
  cx.translate(W / 2, H / 2);
  cx.rotate(Math.PI / 2);
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillStyle = inkTitle;
  setTitleFont(cx, t, 34);
  const lines = wrapSpineText(title, 26).slice(0, 3);
  const lineH = 40;
  const startY = -((lines.length - 1) * lineH) / 2 - (creator ? 14 : 0);
  lines.forEach((line, i) => cx.fillText(titleCase(line, t), 0, startY + i * lineH));
  if (creator) {
    cx.font = `italic 300 22px ${t.font}`;
    if ('letterSpacing' in cx) cx.letterSpacing = '0px';
    cx.fillStyle = inkCreator;
    cx.fillText(creator.split(' · ')[0].split(' (')[0], 0, startY + lines.length * lineH + 6);
  }
  cx.restore();

  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function cubbyLeft(col) { return -TOTAL_W / 2 + FRAME_T + (col - 1) * (CUBBY_W + FRAME_T); }
function cubbyTop(row) { return TOTAL_H / 2 - FRAME_T - (row - 1) * (CUBBY_H + FRAME_T); }

function makeDiscSpineTexture(baseColor, title) {
  const W = 80, H = 720, SCALE = SPINE_TEXTURE_SCALE.disc;
  const c = document.createElement('canvas');
  c.width = Math.round(W * SCALE);
  c.height = Math.round(H * SCALE);
  const cx = c.getContext('2d');
  cx.scale(SCALE, SCALE);
  cx.fillStyle = baseColor;
  cx.fillRect(0, 0, W, H);

  const streakX = W * (0.25 + hash01(title, 'streak') * 0.35);
  const sgrad = cx.createLinearGradient(streakX - 14, 0, streakX + 14, 0);
  sgrad.addColorStop(0, 'rgba(255,255,255,0)');
  sgrad.addColorStop(0.5, 'rgba(255,255,255,0.24)');
  sgrad.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = sgrad;
  cx.fillRect(0, 0, W, H);

  const vgrad = cx.createLinearGradient(0, 0, 0, H);
  vgrad.addColorStop(0, 'rgba(255,255,255,0.1)');
  vgrad.addColorStop(0.5, 'rgba(255,255,255,0)');
  vgrad.addColorStop(1, 'rgba(0,0,0,0.3)');
  cx.fillStyle = vgrad;
  cx.fillRect(0, 0, W, H);

  const hue = Math.floor(hash01(title, 'accent') * 360);
  cx.fillStyle = `hsla(${hue}, 45%, 48%, 0.55)`;
  cx.fillRect(0, H - 34, W, 4);

  const lum = relLuminance(baseColor);
  const ink = lum > 0.55 ? 'rgba(26,22,18,0.9)' : 'rgba(238,234,222,0.92)';
  const t = pickTreatment(DISC_TREATMENTS, title);

  cx.save();
  cx.translate(W / 2, H / 2);
  cx.rotate(Math.PI / 2);
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillStyle = ink;
  setTitleFont(cx, t, 32);
  const lines = wrapSpineText(title, 24).slice(0, 3);
  const lineH = 38;
  const startY = -((lines.length - 1) * lineH) / 2;
  lines.forEach((line, i) => cx.fillText(titleCase(line, t), 0, startY + i * lineH));
  cx.restore();

  return new THREE.CanvasTexture(c);
}

function makeCdSpineTexture(baseColor, artist, album) {
  const W = 72, H = 640, SCALE = SPINE_TEXTURE_SCALE.cd;
  const c = document.createElement('canvas');
  c.width = Math.round(W * SCALE);
  c.height = Math.round(H * SCALE);
  const cx = c.getContext('2d');
  cx.scale(SCALE, SCALE);
  cx.fillStyle = baseColor;
  cx.fillRect(0, 0, W, H);

  const vgrad = cx.createLinearGradient(0, 0, 0, H);
  vgrad.addColorStop(0, 'rgba(255,255,255,0.3)');
  vgrad.addColorStop(0.5, 'rgba(255,255,255,0)');
  vgrad.addColorStop(1, 'rgba(0,0,0,0.32)');
  cx.fillStyle = vgrad;
  cx.fillRect(0, 0, W, H);

  const prism = cx.createLinearGradient(0, 0, 0, H);
  prism.addColorStop(0, 'rgba(255,130,180,0.4)');
  prism.addColorStop(0.25, 'rgba(255,220,120,0.34)');
  prism.addColorStop(0.5, 'rgba(140,255,200,0.34)');
  prism.addColorStop(0.75, 'rgba(140,180,255,0.36)');
  prism.addColorStop(1, 'rgba(200,140,255,0.34)');
  cx.fillStyle = prism;
  cx.fillRect(5, 0, 5, H);

  const lum = relLuminance(baseColor);
  const ink = lum > 0.55 ? 'rgba(26,22,18,0.88)' : 'rgba(238,234,222,0.92)';
  const inkSub = lum > 0.55 ? 'rgba(26,22,18,0.58)' : 'rgba(238,234,222,0.62)';
  const t = pickTreatment(CD_TREATMENTS, album);

  cx.save();
  cx.translate(W / 2, H / 2);
  cx.rotate(Math.PI / 2);
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  setTitleFont(cx, t, 30);
  cx.fillStyle = ink;
  const albumLines = wrapSpineText(album, 24).slice(0, 2);
  const lineH = 34;
  const startY = -((albumLines.length - 1) * lineH) / 2 - 12;
  albumLines.forEach((line, i) => cx.fillText(titleCase(line, t), 0, startY + i * lineH));
  cx.font = `italic 300 19px ${t.font}`;
  if ('letterSpacing' in cx) cx.letterSpacing = '0px';
  cx.fillStyle = inkSub;
  cx.fillText(artist, 0, startY + albumLines.length * lineH + 10);
  cx.restore();

  return new THREE.CanvasTexture(c);
}

function dealIntoCubbies(items, cds) {
  const cubbies = [];
  for (let row = 1; row <= COLS; row++) {
    for (let col = 1; col <= ROWS; col++) cubbies.push({ row, col, items: [] });
  }
  const pools = [
    shuffled(items.filter(it => it.type === 'book')),
    shuffled(items.filter(it => isFilmType(it))),
    shuffled(items.filter(it => it.type === 'divination_box')),
    shuffled(cds).map(cd => ({
      id: `cd-${cd.id}`, type: 'cd', title: cd.album, creator: cd.artist,
      artist: cd.artist, album: cd.album, scene: cd.video, youtube: cd.youtube,
    })),
  ];
  pools.forEach((pool, k) => {
    const start = Math.floor(Math.random() * cubbies.length) + k;
    pool.forEach((it, i) => cubbies[(start + i) % cubbies.length].items.push(it));
  });
  return cubbies;
}

const RUN_MAX = { book: 4, bluray: 3, dvd: 3, divination_box: 1, cd: 2 };
function interleaveCubby(items) {
  const byType = new Map();
  for (const it of items) {
    if (!byType.has(it.type)) byType.set(it.type, []);
    byType.get(it.type).push(it);
  }
  const runs = [];
  for (const [type, list] of byType) {
    const cap = RUN_MAX[type] ?? 3;
    let i = 0;
    while (i < list.length) {
      const draw = () => 1 + Math.floor(Math.random() * cap);
      const n = Math.min(draw(), draw());
      runs.push(list.slice(i, i + n));
      i += n;
    }
  }
  return shuffled(runs).flat();
}

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const isBookType = it => it.type === 'book' || it.type === 'divination_box';
const isFilmType = it => it.type === 'dvd' || it.type === 'bluray';

function mergeBoxes(parts) {
  const merged = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const size = parts[0].getAttribute(name).itemSize;
    const total = parts.reduce((n, g) => n + g.getAttribute(name).count, 0);
    const arr = new Float32Array(total * size);
    let at = 0;
    for (const g of parts) { arr.set(g.getAttribute(name).array, at); at += g.getAttribute(name).array.length; }
    merged.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  const indices = [];
  let vertexOffset = 0;
  for (const g of parts) {
    for (const i of g.getIndex().array) indices.push(i + vertexOffset);
    vertexOffset += g.getAttribute('position').count;
    g.dispose(); // the copy above is the survivor
  }
  merged.setIndex(indices);
  return merged;
}

function buildFrame() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.85, metalness: 0.02 });
  const parts = [];

  function box(w, h, d, x, y, z) {
    const geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(x, y, z);
    parts.push(geo);
  }

  for (let i = 0; i <= COLS; i++) {
    const x = -TOTAL_W / 2 + FRAME_T / 2 + i * (CUBBY_W + FRAME_T);
    box(FRAME_T, TOTAL_H, CUBBY_D, x, 0, 0);
  }
  for (let i = 0; i <= ROWS; i++) {
    const y = TOTAL_H / 2 - FRAME_T / 2 - i * (CUBBY_H + FRAME_T);
    box(TOTAL_W, FRAME_T, CUBBY_D, 0, y, 0);
  }
  box(TOTAL_W, TOTAL_H, 0.04, 0, 0, -CUBBY_D / 2 - 0.02);

  group.add(new THREE.Mesh(mergeBoxes(parts), mat));

  return { group };
}

function hexEdgeLocalTransforms(r) {
  const apothem = r * Math.cos(Math.PI / 6);
  const out = [];
  for (let k = 0; k < 6; k++) {
    const thetaMid = Math.PI / 6 + (k + 0.5) * (Math.PI / 3);
    out.push({
      x: apothem * Math.cos(thetaMid),
      y: apothem * Math.sin(thetaMid),
      rotZ: thetaMid + Math.PI / 2,
      length: r, // regular hexagon: edge length equals circumradius
    });
  }
  return out;
}

function hexFaceGeometry() {
  const positions = [0, 0, 0];
  for (let k = 0; k <= 6; k++) {
    const theta = Math.PI / 6 + k * (Math.PI / 3);
    positions.push(Math.cos(theta), Math.sin(theta), 0);
  }
  const indices = [];
  for (let k = 1; k <= 6; k++) indices.push(0, k, k + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildBabelBackdrop() {
  const group = new THREE.Group();

  const nodes = [];
  const extent = 9.5;
  const step = 2.9;
  const keepOutX = TOTAL_W / 2 + 0.7;
  const keepOutY = TOTAL_H / 2 + 0.7;
  let ni = 0;
  for (let gx = -extent; gx <= extent; gx += step) {
    for (let gy = -extent; gy <= extent; gy += step) {
      for (let gz = -extent; gz <= extent; gz += step) {
        ni++;
        if (Math.abs(gx) < keepOutX && Math.abs(gy) < keepOutY) continue;
        if (hash01(`babel-skip-${ni}`, 'k') > 0.5) continue; // thin the field
        const jit = step * 0.75;
        nodes.push({
          pos: new THREE.Vector3(
            gx + (hash01(`babel-jx-${ni}`, 'x') - 0.5) * jit,
            gy + (hash01(`babel-jy-${ni}`, 'y') - 0.5) * jit,
            gz + (hash01(`babel-jz-${ni}`, 'z') - 0.5) * jit,
          ),
          rx: (hash01(`babel-rx-${ni}`, 'a') - 0.5) * Math.PI,
          ry: (hash01(`babel-ry-${ni}`, 'b') - 0.5) * Math.PI,
          rz: (hash01(`babel-rz-${ni}`, 'c') - 0.5) * Math.PI,
          r: 0.5 + hash01(`babel-r-${ni}`, 'd') * 0.4,
          phase: hash01(`babel-ph-${ni}`, 'p') * Math.PI * 2,
          speed: 0.25 + hash01(`babel-sp-${ni}`, 's') * 0.35,
        });
      }
    }
  }

  const edgeColor = new THREE.Color(0xc9a874);
  const edgeGeo = new THREE.BoxGeometry(1, 0.045, 0.045);
  const edgeMat = new THREE.MeshBasicMaterial({
    color: edgeColor, transparent: true, opacity: 0.38, depthWrite: false, fog: true,
  });
  const edgeMesh = new THREE.InstancedMesh(edgeGeo, edgeMat, nodes.length * 6);

  const faceGeo = hexFaceGeometry();
  const faceMat = new THREE.MeshStandardMaterial({
    color: edgeColor, transparent: true, opacity: 0.14, roughness: 0.5,
    metalness: 0, side: THREE.DoubleSide, depthWrite: false, fog: true,
  });
  const faceMesh = new THREE.InstancedMesh(faceGeo, faceMat, nodes.length);

  const dummy = new THREE.Object3D();
  const local = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  let ei = 0;
  nodes.forEach((node, ni) => {
    dummy.position.copy(node.pos);
    dummy.rotation.set(node.rx, node.ry, node.rz);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    const nodeMatrix = dummy.matrix.clone();
    node.edgeStart = ei;
    hexEdgeLocalTransforms(node.r).forEach(e => {
      local.position.set(e.x, e.y, 0);
      local.rotation.set(0, 0, e.rotZ);
      local.scale.set(e.length, 1, 1);
      local.updateMatrix();
      edgeMesh.setMatrixAt(ei, nodeMatrix.clone().multiply(local.matrix));
      edgeMesh.setColorAt(ei, edgeColor);
      ei++;
    });

    dummy.scale.set(node.r, node.r, node.r);
    dummy.updateMatrix();
    faceMesh.setMatrixAt(ni, dummy.matrix);
    faceMesh.setColorAt(ni, edgeColor);
  });
  edgeMesh.instanceMatrix.needsUpdate = true;
  edgeMesh.instanceColor.needsUpdate = true;
  faceMesh.instanceMatrix.needsUpdate = true;
  faceMesh.instanceColor.needsUpdate = true;
  group.add(faceMesh);
  group.add(edgeMesh);

  const strandPairs = [];
  const seen = new Set();
  const maxStrandLen = 6.0;
  nodes.forEach((node, i) => {
    const dists = nodes
      .map((other, j) => (i === j ? null : { j, d: node.pos.distanceTo(other.pos) }))
      .filter(Boolean)
      .sort((a, b) => a.d - b.d);
    let linked = 0;
    for (const { j, d } of dists) {
      if (linked >= 2 || d > maxStrandLen) break;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        strandPairs.push([i, j]);
      }
      linked++;
    }
  });

  let strandMesh = null;
  const strandColor = new THREE.Color(0xb89760);
  const strandPhases = [];
  if (strandPairs.length) {
    const strandGeo = new THREE.BoxGeometry(1, 0.038, 0.038);
    const strandMat = new THREE.MeshBasicMaterial({
      color: strandColor, transparent: true, opacity: 0.28, depthWrite: false, fog: true,
    });
    strandMesh = new THREE.InstancedMesh(strandGeo, strandMat, strandPairs.length);

    strandPairs.forEach(([i, j], si) => {
      const a = nodes[i].pos, b = nodes[j].pos;
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(1, 0, 0), dir.clone().normalize(),
      );
      dummy.position.copy(mid);
      dummy.quaternion.copy(quat);
      dummy.scale.set(len, 1, 1);
      dummy.updateMatrix();
      strandMesh.setMatrixAt(si, dummy.matrix);
      strandMesh.setColorAt(si, strandColor);
      strandPhases.push({
        phase: hash01(`babel-strand-ph-${si}`, 'p') * Math.PI * 2,
        speed: 0.2 + hash01(`babel-strand-sp-${si}`, 's') * 0.3,
      });
    });
    strandMesh.instanceMatrix.needsUpdate = true;
    strandMesh.instanceColor.needsUpdate = true;
    group.add(strandMesh);
  }

  function update(t) {
    nodes.forEach((node, ni) => {
      const b = 0.55 + Math.sin(t * node.speed + node.phase) * 0.45;
      tmpColor.copy(edgeColor).multiplyScalar(Math.max(0.12, b));
      for (let k = 0; k < 6; k++) edgeMesh.setColorAt(node.edgeStart + k, tmpColor);
      faceMesh.setColorAt(ni, tmpColor);
    });
    edgeMesh.instanceColor.needsUpdate = true;
    faceMesh.instanceColor.needsUpdate = true;

    if (strandMesh) {
      strandPhases.forEach((sp, si) => {
        const b = 0.55 + Math.sin(t * sp.speed + sp.phase) * 0.45;
        tmpColor.copy(strandColor).multiplyScalar(Math.max(0.12, b));
        strandMesh.setColorAt(si, tmpColor);
      });
      strandMesh.instanceColor.needsUpdate = true;
    }
  }

  return { group, update };
}

function addSpineRim(material, colorHex = 0xffe6bd, power = 2.4, glow = 0.035) {
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

function splitBoxIntoSpineAndBody(geo, sideColor, pageColor, backColor) {
  const idx = Array.from(geo.getIndex().array);
  const spine = idx.slice(24, 30); // +z
  geo.setIndex([...idx.slice(0, 24), ...idx.slice(30, 36), ...spine]);
  geo.clearGroups();
  geo.addGroup(0, 30, 0); // body: +x, -x, +y, -y, -z
  geo.addGroup(30, 6, 1); // spine face: +z

  const faceColors = [sideColor, sideColor, pageColor, pageColor, sideColor, backColor];
  const colors = new Float32Array(24 * 3);
  faceColors.forEach((col, f) => {
    for (let v = 0; v < 4; v++) {
      const o = (f * 4 + v) * 3;
      colors[o] = col.r; colors[o + 1] = col.g; colors[o + 2] = col.b;
    }
  });
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

function buildItems(preview) {
  const group = new THREE.Group();
  const meshes = [];

  const previewBox = preview ? new THREE.BoxGeometry(1, 1, 1) : null;
  const previewMats = new Map();

  const byCubby = dealIntoCubbies(libraryItems, cdRackItems);

  const padX = 0.06;
  const gap = 0.006;
  const floorGap = 0.025;

  byCubby.forEach(({ row, col, items: dealt }) => {
    const items = interleaveCubby(dealt);
    const left = cubbyLeft(row);
    const top = cubbyTop(col);
    const availW = CUBBY_W - padX * 2 - gap * (items.length - 1);

    const weights = items.map(it => {
      const isBox = it.type === 'divination_box';
      const isCd = it.type === 'cd';
      const base = isBox ? 2.2 : isCd ? 0.5 : 1.0;
      const jitter = hash01(it.title, 'w') * 0.6;
      return base + jitter;
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    let cursorX = left + padX;
    items.forEach((it, i) => {
      const isBox = it.type === 'divination_box';
      const isDisc = it.type === 'dvd' || it.type === 'bluray';
      const isCd = it.type === 'cd';
      const w = (weights[i] / totalWeight) * availW;

      const heightFactor = isBox
        ? 0.36 + hash01(it.title, 'h') * 0.1
        : isDisc
        ? 0.76 + hash01(it.title, 'h') * 0.08
        : isCd
        ? 0.5 + hash01(it.title, 'h') * 0.1
        : 0.8 + hash01(it.title, 'h') * 0.18;
      const h = CUBBY_H * heightFactor;

      const depth = isBox
        ? 0.32 + hash01(it.title, 'd') * 0.1
        : isDisc || isCd
        ? 0.12 + hash01(it.title, 'd') * 0.04
        : 0.68 + hash01(it.title, 'd') * 0.16;

      const palette = isBox ? BOX_PALETTE : isDisc ? DISC_PALETTE : isCd ? CD_PALETTE : PALETTE;
      const rawColor = palette[hash(it.title) % palette.length];
      const color = (!isBox && !isDisc && !isCd) ? vividColor(rawColor) : rawColor;

      const x = cursorX + w / 2;
      const y = top - CUBBY_H + floorGap + h / 2;
      const z = CUBBY_D / 2 - depth / 2 - 0.01;

      let mesh;
      if (preview) {
        let flat = previewMats.get(color);
        if (!flat) {
          flat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
          previewMats.set(color, flat);
        }
        mesh = new THREE.Mesh(previewBox, flat);
        mesh.scale.set(Math.max(w, 0.02), h, depth);
      } else {
        const geo = new THREE.BoxGeometry(Math.max(w, 0.02), h, depth);
        const tex = isCd
          ? makeCdSpineTexture(color, it.creator, it.title)
          : isDisc
          ? makeDiscSpineTexture(color, it.title)
          : makeSpineTexture(color, it.title, it.creator, isBox);
        const isGlossy = isDisc || isCd || hash01(it.title, 'gloss') > 0.8;
        const rough = isDisc
          ? 0.22 + hash01(it.title, 'r2') * 0.1
          : isCd
          ? 0.3 + hash01(it.title, 'r2') * 0.12
          : isGlossy
          ? 0.35 + hash01(it.title, 'r2') * 0.15
          : 0.6 + hash01(it.title, 'r2') * 0.2;
        const metal = isDisc ? 0.18 : isCd ? 0.1 : isGlossy ? 0.05 : 0;
        const sideColor = new THREE.Color(color).multiplyScalar(0.82);
        const backColor = new THREE.Color(color).multiplyScalar(0.7);
        const pageColor = new THREE.Color(it.type === 'book' ? '#e9e3d2' : color);
        splitBoxIntoSpineAndBody(geo, sideColor, pageColor, backColor);

        const front = new THREE.MeshStandardMaterial({ map: tex, roughness: rough, metalness: metal });
        const body = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough });
        if (!isDisc && !isCd && !isBox) {
          addSpineRim(front);
          addSpineRim(body);
        }
        mesh = new THREE.Mesh(geo, [body, front]);
      }

      mesh.position.set(x, y, z);
      mesh.userData.item = it;
      group.add(mesh);
      meshes.push(mesh);

      cursorX += w + gap;
    });
  });

  return { group, meshes };
}

const HOVER_GLOW_HEX = 0xe6b45f;
function setSpineHovered(mesh, isHovered) {
  mesh.scale.set(isHovered ? 1.04 : 1, isHovered ? 1.02 : 1, isHovered ? 1.15 : 1);
  const front = mesh.material[1];
  front.emissive.setHex(isHovered ? HOVER_GLOW_HEX : 0x000000);
  front.emissiveIntensity = isHovered ? 0.5 : 0;
}

function distanceToFit(camera, width, height, margin) {
  const halfFovY = THREE.MathUtils.degToRad(camera.fov) / 2;
  const distForHeight = ((height / 2) * margin) / Math.tan(halfFovY);
  const distForWidth = ((width / 2) * margin) / (Math.tan(halfFovY) * camera.aspect);
  return Math.max(distForHeight, distForWidth);
}

export function createLibrary(container, { preview = false, initialPieceId = null, onPieceChange = null } = {}) {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
  let baseDist, minDist, maxDist;
  function recomputeZoomRange() {
    baseDist = distanceToFit(camera, TOTAL_W, TOTAL_H, 1.3);
    minDist = baseDist * (preview ? 0.46 : 0.35);
    maxDist = baseDist * (preview ? 1.21 : 1.42);
  }
  recomputeZoomRange();
  camera.position.set(0, 0.15, baseDist);
  camera.lookAt(0, 0, 0);
  const VOID_COLOR = 0x120d08;
  scene.fog = new THREE.Fog(VOID_COLOR, 18, 56);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setClearColor(VOID_COLOR, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);
  const managed = manageRenderer(renderer, {
    onLost: () => { cancelAnimationFrame(animId); animId = null; },
  });

  const root = new THREE.Group();
  scene.add(root);

  scene.add(new THREE.AmbientLight(0xfff4e0, 0.55));
  const key = new THREE.DirectionalLight(0xfff0d8, 1.35);
  key.position.set(4, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fa8ff, 0.4);
  rim.position.set(-5, -2, -4);
  scene.add(rim);

  const babel = preview ? null : buildBabelBackdrop();
  if (babel) root.add(babel.group);

  const frame = buildFrame();
  root.add(frame.group);

  const items = buildItems(preview);
  root.add(items.group);

  let hint = null, panel = null, panelTitle = null, panelCreator = null, panelBodyEl = null, panelCloser = null, jumpList = null;
  let panelSlideMs = 500; // replaced from CSS once the panel is in the document — see below
  const claim = preview ? null : claimContainer(container, { tabIndex: -1 });

  const timers = trackTimers();
  if (!preview) {
    const shell = parseHTML(libraryHtml);
    hint = shell.querySelector('.library-hint');
    panel = shell.querySelector('.library-panel');
    document.body.appendChild(hint);

    container.appendChild(panel);
    panelTitle = panel.querySelector('.library-panel-title');
    panelCreator = panel.querySelector('.library-panel-creator');
    panelBodyEl = panel.querySelector('.library-panel-body');

    panelCloser = createPanelCloser(panel, container, {
      closeBtn: panel.querySelector('.library-panel-close'),
      onClose: closePanel,
    });

    const rawSlide = getComputedStyle(panel).getPropertyValue('--library-panel-slide').trim();
    const slideNum = parseFloat(rawSlide);
    panelSlideMs = !Number.isFinite(slideNum) ? 500 : (rawSlide.endsWith('ms') ? slideNum : slideNum * 1000);

    function navigateToItem(targetScene, targetId) {
      if (targetScene !== 'library') return;
      const target = libraryItems.find(i => i.id === targetId);
      if (!target) return;
      panelBodyEl.style.transition = 'opacity .18s';
      panelBodyEl.style.opacity = '0';
      timers.after(180, () => {
        populatePanel(target);
        panel.scrollTop = 0;
        panelBodyEl.style.opacity = '1';
        timers.after(50, () => panelTitle.focus());
      });
    }
    panelBodyEl.addEventListener('click', e => {
      const link = e.target.closest('.library-link');
      if (!link) return;
      e.stopPropagation();
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigateToItem(link.dataset.targetScene, Number(link.dataset.targetId));
    });
  }

  function closePanel() {
    if (!panel) return;
    panel.querySelector('.library-panel-video').innerHTML = '';
    selected = null;
  }

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovered = null, selected = null;
  let containerRect = null;
  const pointer = { x: 0, y: 0 };
  let pointerMoved = false;
  let onContainerMouseMove = null, onContainerClick = null, onContainerMouseLeave = null,
      onContainerMouseEnter = null, onWindowScroll = null;
  let touchGuard = null;

  function refreshRect() { containerRect = container.getBoundingClientRect(); }

  function pickAt(clientX, clientY) {
    if (!containerRect) refreshRect();
    mouse.x = ((clientX - containerRect.left) / containerRect.width) * 2 - 1;
    mouse.y = -((clientY - containerRect.top) / containerRect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(items.meshes);
    return hits.length ? hits[0].object : null;
  }

  const coverSeen = new Set();
  function coverUrl(it) {
    return it?.isbn13 ? `https://covers.openlibrary.org/b/isbn/${it.isbn13}-M.jpg` : null;
  }
  function prefetchCover(it) {
    const url = coverUrl(it);
    if (!url || coverSeen.has(url)) return;
    coverSeen.add(url);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
  }

  function updateHover() {
    if (!pointerMoved || panel?.classList.contains('open')) return;
    pointerMoved = false;
    const hitMesh = pickAt(pointer.x, pointer.y);
    if (hitMesh !== hovered) {
      if (hovered) setSpineHovered(hovered, false);
      hovered = hitMesh;
      if (hovered) {
        setSpineHovered(hovered, true);
        prefetchCover(hovered.userData.item);
      }
    }
    claim?.setCursor(hovered ? 'pointer' : 'default');
  }

  function populatePanel(it) {
    if (typeof it.id === 'number') onPieceChange?.(it.id);
    panel.querySelector('.library-panel-kind').textContent =
      ({ book: 'Book', dvd: 'DVD', bluray: 'Blu-ray', divination_box: 'Divination deck', cd: 'Album' })[it.type] || it.type;
    panelTitle.textContent = it.title;
    panelCreator.textContent = it.creator || '';

    const detailsEl = panel.querySelector('.library-panel-details');
    const excerptEl = panel.querySelector('.library-panel-excerpt');
    const excerptFromEl = panel.querySelector('.library-panel-excerpt-from');
    const coverEl = panel.querySelector('.library-panel-cover');
    const videoEl = panel.querySelector('.library-panel-video');
    const sceneEl = panel.querySelector('.library-panel-scene');
    const refsEl = panel.querySelector('.library-panel-refs');
    refsEl.textContent = typeof it.id === 'number'
      ? formatInboundNote(
          getInboundLinks('library', it.id).map(l => libraryItems.find(i => i.id === l.from.id)?.title)
        ) ?? ''
      : '';
    const facts = [];
    if (it.publisher) facts.push(`${it.publisher}${it.publish_year ? `, ${it.publish_year}` : ''}`);
    if (it.release_year) facts.push(String(it.release_year));
    if (it.country) facts.push(it.country);
    if (it.pages) facts.push(`${it.pages} pages`);
    if (it.runtime_min) facts.push(`${it.runtime_min} min`);
    const lines = [];
    if (facts.length) lines.push(facts.join(' · '));
    if (it.writer) lines.push(`written by ${it.writer}`);
    if (it.producer) lines.push(`produced by ${it.producer}`);
    detailsEl.innerHTML = lines.map(l => `<p>${escapeHtml(l)}</p>`).join('');

    videoEl.innerHTML = '';
    sceneEl.innerHTML = '';
    if (it.youtube) {
      const embedSrc = youtubeEmbedSrc(it.youtube);
      if (embedSrc) videoEl.appendChild(buildVideoFacade(it, embedSrc));
      const captionLabel = it.type === 'cd' ? 'video' : 'pivotal scene';
      sceneEl.innerHTML = it.scene ? `${captionLabel}: ${renderLinkedField(it.id, 'scene', it.scene)}` : '';
    }

    excerptEl.innerHTML = it.excerpt ? `“${renderLinkedField(it.id, 'excerpt', it.excerpt)}”` : '';
    excerptFromEl.innerHTML = it.excerpt_from ? `— ${renderLinkedField(it.id, 'excerpt_from', it.excerpt_from)}` : '';

    const coverSrc = coverUrl(it);
    if (coverSrc) {
      coverEl.hidden = false;
      coverEl.classList.remove('loaded');
      coverEl.onerror = () => { coverEl.hidden = true; };
      coverEl.onload = () => { coverEl.classList.add('loaded'); };
      coverEl.src = coverSrc;
      coverEl.alt = `Cover of ${it.title}`;
      if (coverEl.complete && coverEl.naturalWidth) coverEl.classList.add('loaded');
    } else {
      coverEl.hidden = true;
      coverEl.removeAttribute('src');
    }

    panel.querySelectorAll('.library-link').forEach(link => {
      const delay = (Math.random() * 12).toFixed(1);
      const duration = (9 + Math.random() * 7).toFixed(1);
      link.style.animationDelay = `-${delay}s`;
      link.style.animationDuration = `${duration}s`;
      const targetItem = link.dataset.targetScene === 'library'
        ? libraryItems.find(i => i.id === Number(link.dataset.targetId))
        : null;
      link.setAttribute('aria-label', `Go to: ${targetItem ? targetItem.title : 'related item'}`);
    });
  }

  function openItem(mesh, { fromLeft } = {}) {
    selected = mesh;
    populatePanel(mesh.userData.item);
    if (!panel.classList.contains('open') && fromLeft !== undefined
        && panel.classList.contains('from-left') !== fromLeft) {
      setPanelSide(panel, fromLeft);
    }
    panel.classList.add('open');
    timers.after(50, () => panelTitle.focus());
  }

  function buildJumpList() {
    const nav = document.createElement('nav');
    nav.className = 'library-jumplist';
    nav.setAttribute('aria-label', 'Browse the shelf');
    nav.addEventListener('click', e => e.stopPropagation());

    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'library-jumplist-skip';
    skip.textContent = 'Skip the shelf';
    skip.addEventListener('click', () => {
      nav.querySelectorAll('details[open]').forEach(d => { d.open = false; });
      container.focus();
    });
    nav.appendChild(skip);

    const GROUPS = [
      { label: 'Books & decks', match: it => isBookType(it) },
      { label: 'Films', match: it => isFilmType(it) },
      { label: 'Music', match: it => it.type === 'cd' },
    ];
    GROUPS.forEach(g => {
      const group = items.meshes
        .filter(m => g.match(m.userData.item))
        .sort((a, b) => a.userData.item.title.localeCompare(b.userData.item.title));
      if (!group.length) return;
      const details = document.createElement('details');
      details.className = 'library-jumplist-group';
      const summary = document.createElement('summary');
      summary.textContent = `${g.label} — ${group.length}`;
      details.appendChild(summary);
      const ul = document.createElement('ul');
      group.forEach(mesh => {
        const it = mesh.userData.item;
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = it.creator ? `${it.title} — ${it.creator}` : it.title;
        btn.addEventListener('click', () => { closePanel(); openItem(mesh, { fromLeft: false }); });
        li.appendChild(btn);
        ul.appendChild(li);
      });
      details.appendChild(ul);
      nav.appendChild(details);
    });

    container.appendChild(nav);
    return { dispose() { nav.remove(); } };
  }

  if (!preview) {
    touchGuard = bindTapVsDrag(container);

    onContainerMouseMove = e => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointerMoved = true; // the raycast itself happens in animate()
    };
    container.addEventListener('mousemove', onContainerMouseMove);

    onContainerMouseEnter = refreshRect;
    container.addEventListener('mouseenter', onContainerMouseEnter);

    onWindowScroll = refreshRect;
    window.addEventListener('scroll', onWindowScroll, { passive: true });

    onContainerMouseLeave = () => {
      if (hovered) { setSpineHovered(hovered, false); hovered = null; }
      pointerMoved = false;
      claim?.setCursor('default');
    };
    container.addEventListener('mouseleave', onContainerMouseLeave);

    onContainerClick = e => {
      if (touchGuard.consume()) return;
      refreshRect();
      const rect = containerRect;
      const hitMesh = pickAt(e.clientX, e.clientY);
      const it = hitMesh ? hitMesh.userData.item : null;

      if (hitMesh && hovered !== hitMesh) {
        if (hovered) setSpineHovered(hovered, false);
        hovered = hitMesh;
        setSpineHovered(hovered, true);
      }

      if (panel.classList.contains('open')) {
        if (hitMesh) {
          selected = hitMesh;

          const clickedLeft = clickedLeftHalf(e, rect);
          if (panel.classList.contains('from-left') !== clickedLeft) {
            panel.classList.remove('open');
            timers.after(panelSlideMs, () => {
              setPanelSide(panel, clickedLeft);
              populatePanel(it);
              panel.scrollTop = 0;
              panelBodyEl.style.opacity = '1'; // guard against a same-side fade-out still in flight
              panel.classList.add('open');
              timers.after(50, () => panelTitle.focus());
            });
            return;
          }

          panelBodyEl.style.transition = 'opacity .18s';
          panelBodyEl.style.opacity = '0';
          timers.after(180, () => {
            populatePanel(it);
            panel.scrollTop = 0;
            panelBodyEl.style.opacity = '1';
          });
          return;
        }
        panelCloser.close();
        return;
      }

      if (!hitMesh) return;
      openItem(hitMesh, { fromLeft: clickedLeftHalf(e, rect) });
    };
    container.addEventListener('click', onContainerClick);

    jumpList = buildJumpList();
  }

  function openPieceById(id) {
    const mesh = items.meshes.find(m => m.userData.item.id === id);
    if (mesh) openItem(mesh, { fromLeft: false });
  }
  if (!preview && initialPieceId !== null) openPieceById(initialPieceId);

  const baseCamLift = 0.15; // small permanent downward-look bias, kept from the original framing
  let camDist = camera.position.length();
  let panY = 0;
  const panLimit = TOTAL_H / 2 - CUBBY_H / 2 + 0.3;
  const vertPanScale = panLimit / 0.4; // scales drag distance to the pan range
  function updateCamera() {
    camera.position.set(0, panY + baseCamLift, camDist);
    camera.lookAt(0, panY, 0);
  }

  const orbitDrag = bindOrbitDrag(container, {
    onDrag: (dx, dy) => {
      root.rotation.y += dx;
      panY = Math.max(-panLimit, Math.min(panLimit, panY - dy * vertPanScale));
      updateCamera();
    },
  });

  const wheelZoom = bindWheelZoom(container, {
    isBlocked: () => !preview && panel?.classList.contains('open'),
    onZoom: deltaY => {
      camDist = Math.max(minDist, Math.min(maxDist, camDist + deltaY * 0.004));
      updateCamera();
    },
  });

  let reduceMotion = prefersReducedMotion();
  const motionWatch = onReducedMotionChange(m => { reduceMotion = m; });

  const clock = createFrameClock();

  let animId = null;
  let paused = false;
  let disposed = false;
  let babelT = 0;
  function animate() {
    animId = requestAnimationFrame(animate);
    const dt = clock.tick();
    if (babel && !reduceMotion) {
      babelT += dt * 60 * 0.016;
      babel.update(babelT);
    }
    updateHover();
    renderer.render(scene, camera);
  }
  animate();

  const resize = bindGuardedResize(container, (nw, nh) => {
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
    managed.applyPixelRatio();
    const zoomRatio = camDist / baseDist;
    recomputeZoomRange();
    camDist = Math.max(minDist, Math.min(maxDist, baseDist * zoomRatio));
    panY = Math.max(-panLimit, Math.min(panLimit, panY));
    updateCamera();
    refreshRect();
    if (paused) renderer.render(scene, camera);
  });

  return {
    openPieceById,
    closePiece() { panelCloser?.close(); },
    setPaused(nextPaused) {
      if (disposed) return;
      const wanted = !!nextPaused;
      if (wanted === paused) return;
      paused = wanted;
      if (paused) {
        cancelAnimationFrame(animId);
        animId = null;
      } else {
        clock.resync();
        animate();
      }
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(animId);
      timers.dispose();
      motionWatch.dispose();
      orbitDrag.dispose();
      touchGuard?.dispose();
      wheelZoom.dispose();
      resize.dispose();
      panelCloser?.dispose();
      jumpList?.dispose();
      if (onContainerMouseMove) container.removeEventListener('mousemove', onContainerMouseMove);
      if (onContainerClick) container.removeEventListener('click', onContainerClick);
      if (onContainerMouseLeave) container.removeEventListener('mouseleave', onContainerMouseLeave);
      if (onContainerMouseEnter) container.removeEventListener('mouseenter', onContainerMouseEnter);
      if (onWindowScroll) window.removeEventListener('scroll', onWindowScroll);
      disposeSceneGraph(root);
      managed.dispose();
      claim?.restore();
      if (hint) hint.remove();
      if (panel) panel.remove();
    },
  };
}
