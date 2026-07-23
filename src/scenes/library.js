import * as THREE from 'three';
import { libraryItems } from '../text/library.js';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion, bindEscapeClose,
} from '../utils/sceneKit.js';

// ─── The Library ────────────────────────────────────────────────────────────
// Scott: "for that picture of the bookshelf in the assets folder, can you
// scan that and see if you can identify all the media there?" — then, once
// the catalog existed (src/text/library.js, 107 books/films/decks read off
// a real photo of his shelf, corrected against IMG_1202.jpeg after an
// earlier pass used the wrong picture): "add a new scene to
// perceptualmechanics, library. Build out infrastructure as usual."
//
// A 4x2 Kallax-style cube shelf, same physical layout as the real one
// (row/col/pos in library.js preserve left-to-right shelf order), rebuilt
// as a floating 3D object rather than a room you walk through — closer to
// the sphere/egg model (drag to orbit, click something small to read about
// it) than the orrery's walk-around warehouse, since a shelf reads fine as
// an object held up to the light rather than a space to stand inside.
//
// No real cover art or spine photography anywhere — same rule as every
// other scene's canvas-drawn textures (the orrery's poster/audio system is
// the clearest precedent: real film/album titles, but nothing lifted from
// an actual copyrighted image). Every spine here is a plain canvas
// background color plus the title/creator drawn as text, standing in for
// the real spine design rather than reproducing it.

const CUBBY_W = 2.4;
const CUBBY_H = 1.7;
const CUBBY_D = 1.0;
const FRAME_T = 0.09;
const COLS = 4;
const ROWS = 2;
const TOTAL_W = COLS * CUBBY_W + (COLS + 1) * FRAME_T;
const TOTAL_H = ROWS * CUBBY_H + (ROWS + 1) * FRAME_T;

// Muted, curated palette — deliberately not a rainbow of random hues, so
// the shelf reads as "someone's actual bookshelf" rather than a bar chart.
const PALETTE = [
  '#c9c0ab', '#242226', '#7a3230', '#2f4d3a', '#28344a',
  '#8a5a3f', '#5a4a6b', '#9c8a45', '#3a3a3a', '#647568',
  '#a8433a', '#3d5a6b',
];
// Divination decks/boxes get their own small, darker, starrier palette —
// they read as distinct objects on the real shelf (Kim Krans' two boxes),
// not just thicker books.
const BOX_PALETTE = ['#141428', '#1c1830', '#101018'];

// Cheap deterministic string hash (djb2) — used so a given title always
// gets the same simulated thickness/color/height on every visit, rather
// than reshuffling the shelf each reload.
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function hash01(str, salt) {
  return (hash(str + salt) % 10000) / 10000;
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

// Canvas-drawn spine face — vertical (bottom-to-top) title, smaller creator
// line beneath it, on a flat color field. Deliberately plain: this is meant
// to read as "a book on a shelf" from across the room, not as a legible
// cover design up close (the click-to-read panel carries the real text).
function makeSpineTexture(baseColor, title, creator, isBox) {
  const c = document.createElement('canvas');
  c.width = 112; c.height = 800;
  const cx = c.getContext('2d');
  cx.fillStyle = baseColor;
  cx.fillRect(0, 0, c.width, c.height);

  if (isBox) {
    // A scattering of small dots standing in for the starry/celestial
    // boxes on the real shelf (Kim Krans' Tarot/Alchemy decks) — an
    // abstraction, not a reproduction of the real box art.
    cx.fillStyle = 'rgba(255,255,255,0.5)';
    const dotCount = 22;
    for (let i = 0; i < dotCount; i++) {
      const x = hash01(title, `dotx${i}`) * c.width;
      const y = hash01(title, `doty${i}`) * c.height;
      const r = 0.6 + hash01(title, `dotr${i}`) * 1.3;
      cx.beginPath();
      cx.arc(x, y, r, 0, Math.PI * 2);
      cx.fill();
    }
  } else {
    // A thin top/bottom rule, like foil-stamped spine caps.
    cx.fillStyle = 'rgba(255,255,255,0.18)';
    cx.fillRect(0, 10, c.width, 3);
    cx.fillRect(0, c.height - 13, c.width, 3);
  }

  cx.save();
  cx.translate(c.width / 2, c.height / 2);
  cx.rotate(-Math.PI / 2);
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillStyle = 'rgba(240,236,224,0.92)';
  cx.font = '600 34px "Times New Roman", serif';
  const lines = wrapSpineText(title, 26).slice(0, 3);
  const lineH = 40;
  const startY = -((lines.length - 1) * lineH) / 2 - (creator ? 14 : 0);
  lines.forEach((line, i) => cx.fillText(line, 0, startY + i * lineH));
  if (creator) {
    cx.font = 'italic 22px "Times New Roman", serif';
    cx.fillStyle = 'rgba(240,236,224,0.62)';
    cx.fillText(creator.split(' · ')[0].split(' (')[0], 0, startY + lines.length * lineH + 6);
  }
  cx.restore();

  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function cubbyLeft(col) { return -TOTAL_W / 2 + FRAME_T + (col - 1) * (CUBBY_W + FRAME_T); }
function cubbyTop(row) { return TOTAL_H / 2 - FRAME_T - (row - 1) * (CUBBY_H + FRAME_T); }

// ─── Shelf frame ────────────────────────────────────────────────────────────
function buildFrame() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.85, metalness: 0.02 });
  const geos = [];

  function box(w, h, d, x, y, z) {
    const geo = new THREE.BoxGeometry(w, h, d);
    geos.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
  }

  // Verticals (left edge, 3 dividers, right edge)
  for (let i = 0; i <= COLS; i++) {
    const x = -TOTAL_W / 2 + FRAME_T / 2 + i * (CUBBY_W + FRAME_T);
    box(FRAME_T, TOTAL_H, CUBBY_D, x, 0, 0);
  }
  // Horizontals (top edge, 1 divider, bottom edge)
  for (let i = 0; i <= ROWS; i++) {
    const y = TOTAL_H / 2 - FRAME_T / 2 - i * (CUBBY_H + FRAME_T);
    box(TOTAL_W, FRAME_T, CUBBY_D, 0, y, 0);
  }
  // Back panel, thin — closes the cubbies visually from behind.
  box(TOTAL_W, TOTAL_H, 0.04, 0, 0, -CUBBY_D / 2 - 0.02);

  return { group, mat, geos };
}

// ─── Items (books/dvds/blurays/boxes) ──────────────────────────────────────
function buildItems(preview) {
  const group = new THREE.Group();
  const meshes = [];
  const disposables = [];

  // Group items by cubby so widths can be distributed to exactly fill
  // each cubby's available width regardless of how many items landed
  // there (6 on the low end, 25 on the high end, on the real shelf).
  const byCubby = new Map();
  libraryItems.forEach(it => {
    const key = `${it.row}-${it.col}`;
    if (!byCubby.has(key)) byCubby.set(key, []);
    byCubby.get(key).push(it);
  });

  const padX = 0.06;
  const gap = 0.006;
  const floorGap = 0.025;

  byCubby.forEach(items => {
    items.sort((a, b) => a.pos - b.pos);
    const { row, col } = items[0];
    const left = cubbyLeft(col);
    const top = cubbyTop(row);
    const availW = CUBBY_W - padX * 2 - gap * (items.length - 1);

    const weights = items.map(it => {
      const isBox = it.type === 'divination_box';
      const base = isBox ? 2.2 : 1.0;
      const jitter = isBox ? hash01(it.title, 'w') * 0.6 : hash01(it.title, 'w') * 0.6;
      return base + jitter;
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    let cursorX = left + padX;
    items.forEach((it, i) => {
      const isBox = it.type === 'divination_box';
      const isDisc = it.type === 'dvd' || it.type === 'bluray';
      const w = (weights[i] / totalWeight) * availW;

      const heightFactor = isBox
        ? 0.36 + hash01(it.title, 'h') * 0.1
        : isDisc
        ? 0.76 + hash01(it.title, 'h') * 0.08
        : 0.8 + hash01(it.title, 'h') * 0.18;
      const h = CUBBY_H * heightFactor;

      const depth = isBox
        ? 0.32 + hash01(it.title, 'd') * 0.1
        : isDisc
        ? 0.12 + hash01(it.title, 'd') * 0.04
        : 0.68 + hash01(it.title, 'd') * 0.16;

      const palette = isBox ? BOX_PALETTE : PALETTE;
      const color = palette[hash(it.title) % palette.length];

      const x = cursorX + w / 2;
      const y = top - CUBBY_H + floorGap + h / 2;
      const z = CUBBY_D / 2 - depth / 2 - 0.01;

      const geo = new THREE.BoxGeometry(Math.max(w, 0.02), h, depth);
      disposables.push(geo);

      let mats;
      if (preview) {
        const flat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
        disposables.push(flat);
        mats = flat;
      } else {
        const tex = makeSpineTexture(color, it.title, it.creator, isBox);
        const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
        const side = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
        const pageColor = it.type === 'book' ? '#e9e3d2' : color;
        const pages = new THREE.MeshStandardMaterial({ color: pageColor, roughness: 0.9 });
        const back = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
        disposables.push(tex, front, side, pages, back);
        mats = [side, side, pages, pages, front, back];
      }

      const mesh = new THREE.Mesh(geo, mats);
      mesh.position.set(x, y, z);
      mesh.userData.item = it;
      mesh.userData.baseEmissive = 0;
      group.add(mesh);
      meshes.push(mesh);

      cursorX += w + gap;
    });
  });

  return { group, meshes, disposables };
}

export function createLibrary(container, { preview = false } = {}) {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
  const baseDist = preview ? 8.5 : 7.2;
  camera.position.set(0, 0.15, baseDist);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const root = new THREE.Group();
  scene.add(root);

  scene.add(new THREE.AmbientLight(0xfff4e0, 0.7));
  const key = new THREE.DirectionalLight(0xfff0d8, 1.1);
  key.position.set(4, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fa8ff, 0.4);
  rim.position.set(-5, -2, -4);
  scene.add(rim);

  const frame = buildFrame();
  root.add(frame.group);

  const items = buildItems(preview);
  root.add(items.group);

  // ─── Caption + hint + panel (full only) ─────────────────────────────────
  let caption = null, hint = null, panel = null, panelTitle = null, panelBody = null;
  if (!preview && !document.getElementById('library-styles')) {
    const style = document.createElement('style');
    style.id = 'library-styles';
    style.textContent = `
      #library-caption, #library-hint {
        position: fixed; color: rgba(255,255,255,0.35);
        pointer-events: none; text-align: center; z-index: 310;
        font-family: 'Times New Roman', serif;
      }
      #library-caption {
        bottom: 2.5rem; left: 50%; transform: translateX(-50%);
        font-size: clamp(0.7rem, 1.6vw, 0.95rem); letter-spacing: 0.06em;
        font-style: italic; white-space: nowrap;
        color: rgba(230,215,180,0.55);
      }
      #library-hint {
        top: 4.5rem; right: 1.2rem; font-size: 0.55rem; letter-spacing: 0.2em;
        text-transform: uppercase; line-height: 1.8; text-align: right;
        color: rgba(255,255,255,0.3);
      }
      @media (max-width: 600px) {
        #library-caption { white-space: normal; width: 88vw; font-size: 0.7rem; }
      }
      #library-panel {
        position: absolute; top: 0; right: 0; width: 34%; height: 100%;
        background: #0a0806; border-left: 1px solid rgba(230,215,180,0.15);
        padding: 3rem 2rem; transform: translateX(100%);
        transition: transform .5s cubic-bezier(.16,1,.3,1);
        overflow-y: auto; z-index: 10;
        scrollbar-color: rgba(230,215,180,0.3) #0a0806; scrollbar-width: thin;
        font-family: 'Times New Roman', serif;
      }
      #library-panel.open { transform: translateX(0); }
      /* Enters from whichever side of the screen was actually clicked --
         same convention as sphere.js. .from-left is toggled in JS right
         before opening; .no-transition suppresses the flip's own
         transition for one frame so it happens while the panel is still
         off-screen, not visibly. */
      #library-panel.from-left {
        left: 0; right: auto;
        border-left: none; border-right: 1px solid rgba(230,215,180,0.15);
      }
      #library-panel.no-transition { transition: none !important; }
      #library-panel-kind {
        font-size: 0.65rem; letter-spacing: 0.25em; text-transform: uppercase;
        color: rgba(230,215,180,0.5); margin-bottom: 0.6rem;
      }
      #library-panel-title {
        font-size: 1.15rem; letter-spacing: 0.03em;
        color: rgba(245,238,222,0.92); line-height: 1.4;
        border-bottom: 1px solid rgba(230,215,180,0.15);
        padding-bottom: 1.4rem; margin-bottom: 1.4rem;
      }
      #library-panel-creator { color: rgba(230,220,200,0.7); font-size: 0.95rem; font-style: italic; }
      #library-panel-details {
        margin-top: 1.4rem; padding-top: 1.2rem;
        border-top: 1px solid rgba(230,215,180,0.1);
        color: rgba(220,210,195,0.72); font-size: 0.85rem; line-height: 1.9;
      }
      #library-panel-details p { margin: 0 0 0.3rem; }
      #library-panel-note {
        color: rgba(220,190,140,0.6); font-size: 0.8rem; font-style: italic;
        line-height: 1.6; margin-top: 0.9rem;
      }
      #library-panel-excerpt {
        margin-top: 1.4rem; padding: 1.1rem 1.3rem;
        border-left: 2px solid rgba(230,215,180,0.25);
        background: rgba(230,215,180,0.04);
        color: rgba(235,228,210,0.85); font-size: 0.95rem;
        font-style: italic; line-height: 1.75;
      }
      #library-panel-excerpt:empty { display: none; }
      #library-panel-watch {
        display: inline-block; margin-top: 1.2rem;
        color: rgba(190,215,255,0.75); font-size: 0.8rem;
        letter-spacing: 0.04em; text-decoration: none;
        border-bottom: 1px solid rgba(190,215,255,0.3);
        padding-bottom: 0.15rem;
      }
      #library-panel-watch:hover { color: rgba(215,230,255,0.95); border-bottom-color: rgba(215,230,255,0.6); }
      #library-panel-watch:empty { display: none; }
      #library-panel-close {
        position: absolute; top: 1.5rem; right: 1.5rem; background: none;
        border: none; color: rgba(255,255,255,0.4); font-size: 1.2rem;
        cursor: pointer; padding: .5rem; z-index: 2;
      }
      #library-panel-close:hover { color: rgba(255,255,255,0.9); }
      @media (max-width: 700px) {
        #library-panel { width: 88%; padding: 4rem 1.3rem 2rem; }
      }
    `;
    document.head.appendChild(style);
  }
  if (!preview) {
    caption = document.createElement('p');
    caption.id = 'library-caption';
    caption.textContent = 'the library — once removed';
    caption.setAttribute('aria-hidden', 'true');
    document.body.appendChild(caption);

    hint = document.createElement('p');
    hint.id = 'library-hint';
    hint.innerHTML = 'drag to orbit &nbsp;·&nbsp; scroll to zoom &nbsp;·&nbsp; click a spine to read';
    hint.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hint);

    panel = document.createElement('aside');
    panel.id = 'library-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'library-panel-title');
    panel.innerHTML = `
      <button type="button" id="library-panel-close" aria-label="Close panel">✕</button>
      <div id="library-panel-kind"></div>
      <div id="library-panel-title" tabindex="-1"></div>
      <div id="library-panel-creator"></div>
      <div id="library-panel-details"></div>
      <p id="library-panel-note"></p>
      <blockquote id="library-panel-excerpt"></blockquote>
      <a id="library-panel-watch" href="#" target="_blank" rel="noopener noreferrer"></a>
    `;
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.appendChild(panel);
    panelTitle = panel.querySelector('#library-panel-title');
    panelBody = panel.querySelector('#library-panel-creator');

    panel.addEventListener('click', e => e.stopPropagation());
    panel.querySelector('#library-panel-close').addEventListener('click', e => {
      e.stopPropagation();
      panel.classList.remove('open');
      selected = null;
    });
  }

  // ─── Hover/click raycast, screen-space mouse (matches egg/sphere) ───────
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovered = null, selected = null;
  let onContainerMouseMove = null, onContainerClick = null;

  if (!preview) {
    onContainerMouseMove = e => {
      if (panel.classList.contains('open')) return;
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(items.meshes);
      const hitMesh = hits.length ? hits[0].object : null;
      if (hitMesh !== hovered) {
        if (hovered) hovered.scale.set(1, 1, 1);
        hovered = hitMesh;
        if (hovered) hovered.scale.set(1.04, 1.02, 1.15);
      }
      container.style.cursor = hovered ? 'pointer' : 'default';
    };
    container.addEventListener('mousemove', onContainerMouseMove);

    onContainerClick = e => {
      if (panel.classList.contains('open') && !panel.contains(e.target)) {
        panel.classList.remove('open');
        selected = null;
        return;
      }
      if (!hovered) return;
      selected = hovered;
      // openItem closes over panel/panelTitle/panelBody defined above.
      const it = selected.userData.item;
      panel.querySelector('#library-panel-kind').textContent =
        ({ book: 'Book', dvd: 'DVD', bluray: 'Blu-ray', divination_box: 'Divination deck' })[it.type] || it.type;
      panelTitle.textContent = it.title;
      panelBody.textContent = it.creator || '';

      // Bibliographic/filmographic detail lines — only the fields a given
      // item actually has (books carry isbn13/publisher/pages, films carry
      // release_year/runtime/country; not every field applies to every
      // item). See src/text/library.js's header for how these were sourced.
      const detailsEl = panel.querySelector('#library-panel-details');
      const noteEl = panel.querySelector('#library-panel-note');
      const excerptEl = panel.querySelector('#library-panel-excerpt');
      const watchEl = panel.querySelector('#library-panel-watch');
      const lines = [];
      if (it.publisher) lines.push(`${it.publisher}${it.publish_year ? `, ${it.publish_year}` : ''}`);
      if (it.pages) lines.push(`${it.pages} pages`);
      if (it.isbn13) lines.push(`ISBN ${it.isbn13}`);
      if (it.release_year) lines.push(`${it.release_year}${it.country ? ` · ${it.country}` : ''}`);
      if (it.runtime_min) lines.push(`${it.runtime_min} min`);
      if (it.writer) lines.push(`written by ${it.writer}`);
      if (it.producer) lines.push(`produced by ${it.producer}`);
      detailsEl.innerHTML = lines.map(l => `<p>${l}</p>`).join('');
      noteEl.textContent = it.note || '';

      // Book excerpt (a short, fair-use-scale quotation) or film pivotal-
      // scene link — whichever the item actually carries. See
      // src/text/library.js's header for the sourcing/copyright discipline
      // behind these fields.
      excerptEl.textContent = it.excerpt ? `“${it.excerpt}”` : '';
      if (it.youtube) {
        watchEl.href = it.youtube;
        watchEl.textContent = it.scene ? `watch: ${it.scene} ↗` : 'watch on YouTube ↗';
      } else {
        watchEl.removeAttribute('href');
        watchEl.textContent = '';
      }

      // Open from whichever side of the screen was actually clicked --
      // ported from sphere.js. Panel is guaranteed closed here (the block
      // above already returns early for an open-panel click), so flipping
      // the anchor is invisible to the user.
      const rect = container.getBoundingClientRect();
      const clickedLeft = (e.clientX - rect.left) < rect.width / 2;
      if (panel.classList.contains('from-left') !== clickedLeft) {
        panel.classList.add('no-transition');
        panel.classList.toggle('from-left', clickedLeft);
        void panel.offsetWidth; // force reflow before re-enabling the transition
        panel.classList.remove('no-transition');
      }

      panel.classList.add('open');
      setTimeout(() => panelTitle.focus(), 50);
    };
    container.addEventListener('click', onContainerClick);
  }

  // ─── Drag to orbit + wheel zoom ─────────────────────────────────────────
  // Auto-rotate stopped per Scott, 2026-07-22: "let's stop the auto-rotate
  // for the moment." Shelf now only turns under drag.
  let autoRotate = false;
  const orbitDrag = bindOrbitDrag(container, {
    onDrag: (dx, dy) => {
      root.rotation.y += dx;
      root.rotation.x = Math.max(-0.4, Math.min(0.4, root.rotation.x + dy));
    },
  });

  const minDist = preview ? 6.5 : 4.2;
  const maxDist = preview ? 11 : 11.5;
  const wheelZoom = bindWheelZoom(container, {
    isBlocked: () => !preview && panel?.classList.contains('open'),
    onZoom: deltaY => {
      const dist = camera.position.length();
      const next = Math.max(minDist, Math.min(maxDist, dist + deltaY * 0.004));
      camera.position.setLength(next);
    },
  });

  const reduceMotion = prefersReducedMotion();

  let animId;
  function animate() {
    animId = requestAnimationFrame(animate);
    if (!reduceMotion && autoRotate && !orbitDrag.isDragging) {
      root.rotation.y += preview ? 0.0018 : 0.0008;
    }
    renderer.render(scene, camera);
  }
  animate();

  const resize = bindGuardedResize(container, (nw, nh) => {
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });

  const escapeClose = !preview ? bindEscapeClose(() => {
    if (panel && panel.classList.contains('open')) {
      panel.classList.remove('open');
      selected = null;
    }
  }) : null;

  return {
    dispose() {
      cancelAnimationFrame(animId);
      orbitDrag.dispose();
      wheelZoom.dispose();
      resize.dispose();
      escapeClose?.dispose();
      if (onContainerMouseMove) container.removeEventListener('mousemove', onContainerMouseMove);
      if (onContainerClick) container.removeEventListener('click', onContainerClick);
      renderer.dispose();
      frame.geos.forEach(g => g.dispose());
      frame.mat.dispose();
      items.disposables.forEach(d => d.dispose());
      if (caption) caption.remove();
      if (hint) hint.remove();
      if (panel) panel.remove();
      renderer.domElement.remove();
    },
  };
}
