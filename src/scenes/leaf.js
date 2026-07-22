import * as THREE from 'three';
import { prefersReducedMotion, mountClippedPreviewCanvas, bindGuardedResize } from '../utils/sceneKit.js';

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

const TEXT_STAGES = [
  {
    // Gathering, surface tension holding — matches the leaf-tip pause.
    w: 0.14,
    text: "As the droplets descend down the texture of the leaf, coalescing at the downward point, anticipating the end of their stable lives, joining a hundred million molecules for the freefall drop, poised on the brink before the gravity of the situation overwhelms the surface tension, for that brief instant every Mickey Mouse molecule knowing what is to come, feeling the onward surge as the weight increases, ever steadier, until there's no more time and —",
  },
  {
    // The drop releases, leaf recoils.
    w: 0.12,
    text: "the pull downward begins, the drop falls from the leaf, which recoils upwards in release, and it is angels in a ball as they're pulled ever downward, freefall, guts flying, screaming, and everyone wants to fly apart but that surface tension pulls them in, forcing them to stick together, and together they fall, bound by forces outside their control —",
  },
  {
    // Friction — a few molecules escape (the drifting particles).
    w: 0.12,
    text: "the friction as water flies by air frees a few of them, free oxygen and nitrogen creating heat simply by virtue of being there, a wrecking ball knocking aside everything in its path, forcing aside the free and creating more havoc than before —",
  },
  {
    w: 0.12,
    text: "the drop surges like a lava lamp, suspended in aether, the invisible currents of reaction and action dancing intertwined as forces push and pull and shake and steady and everything prepares for the inevitable end —",
  },
  {
    // Ground rushing up.
    w: 0.12,
    text: "it looms ahead of them, the only assurance they have, the ground rushing up, the knowledge of disaster, the circumstance of knowing the end ahead, every movement useless against the surface tension —",
  },
  {
    // The escaped few, watching.
    w: 0.1,
    text: "and yet those few pulled away from the burning rim of the sphere, those few whose weight is that of the air, those few who lucked into friction, they hang there, suspended, and gaze at the others still in the grasp of the greedy giant as they fall until —",
  },
  {
    // Impact / splash.
    w: 0.14,
    text: "the drop explodes on the ground, shattering the form, everything gone everywhere, vaporized, splashing its life away, a mushroom cloud of water, the sad remains absorbed by root or burnt by sun to climb upwards and start the whole sorry process downward —",
  },
  {
    // The free ones, adjusting to new forces — the loop's quiet close.
    w: 0.14,
    text: "and those few floating adjust themselves to wind and water and follow forces other than the ones they've known.",
  },
];

const CYCLE_SECONDS = 34; // preview tiles only now — see createLeaf's preview branch

// Eased fall position, 0 (leaf tip) to 1 (ground), across the fall window
// (roughly frac 0.14 to 0.9 — see PHASE constants in the animate loop).
function easeInQuad(x) { return x * x; }

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
  const grad = cx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0,   '#3c5a3a');
  grad.addColorStop(0.5, '#2f4a30');
  grad.addColorStop(1,   '#243d26');
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
function drawSky(cx, cw, ch) {
  // Real Florida midday blue, matching Scott's actual photo, not the
  // hazier gray-cream gradient the pre-1.0.30 dusk/wall versions used.
  const sky = cx.createLinearGradient(0, 0, 0, ch);
  sky.addColorStop(0,    '#5f9bd6');
  sky.addColorStop(0.55, '#9cc4e2');
  sky.addColorStop(1,    '#d8e8ee');
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
      grad.addColorStop(0, 'rgba(255,255,255,0.85)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
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
    const layer = { z, sharpMat, blurMat, sharpTex, blurTex };
    depthLayers.push(layer);
    return layer;
  }

  // Preview tiles: sky only, same simplification instinct as every prior
  // version of this backdrop — full depth/window/rail detail competes
  // with the leaf's own round silhouette at 320px thumbnail scale (1.0.32:
  // "the leaf is square now, not round"), and a static thumbnail has no
  // scroll progress to rack focus against anyway.
  if (!preview) {
    addDepthLayer(cx => drawGarage(cx, cw, ch, horizonY), -6.8, cw * 0.02);
    addDepthLayer(cx => drawBuildings(cx, cw, ch, horizonY), -6, cw * 0.012);
    addDepthLayer(cx => drawPalmsLot(cx, cw, ch, horizonY, lotBottom), -4.2, cw * 0.014);
    addDepthLayer(cx => drawForegroundFoliage(cx, cw, ch, foliageTop), -2.8, cw * 0.016);
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
         same fix already applied in orrery.js/egg.js. */
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
    TEXT_STAGES.forEach(stage => {
      const p = document.createElement('p');
      p.textContent = stage.text;
      caption.appendChild(p);
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
  }

  // ─── Fall phases (fractions of the loop, 0..1) ─────────────────────────
  const PHASE = { holdEnd: 0.14, fallStart: 0.14, fallEnd: 0.86, splashEnd: 0.94 };

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

    if (frac < PHASE.holdEnd - 0.001 && frac < REARM_MARGIN) {
      resetMotes();
    }
    if (frac < ESCAPE_FIRE - REARM_MARGIN) escapeTriggered = false;
    if (frac < PHASE.fallEnd - REARM_MARGIN) splashTriggered = false;

    // Surface-tension hold: the drop sits at the leaf tip, trembling.
    if (frac < PHASE.holdEnd) {
      const tremble = Math.sin(tSec * 14) * 0.01 * (frac / PHASE.holdEnd);
      drop.position.set(tipX + tremble, tipY - 0.06, 0.05);
      drop.scale.set(0.16 + frac * 0.35, 0.2 + frac * 0.4, 1);
      dropMat.opacity = 1;
      leaf.group.rotation.z = -0.045;
    } else if (frac < PHASE.fallEnd) {
      // Freefall, easing in (accelerating).
      const fallFrac = (frac - PHASE.fallStart) / (PHASE.fallEnd - PHASE.fallStart);
      const eased = easeInQuad(fallFrac);
      const y = tipY - 0.06 - eased * (tipY - 0.06 - groundY);
      drop.position.set(tipX + Math.sin(fallFrac * 6) * 0.015, y, 0.05);
      drop.scale.set(0.22, 0.28 + eased * 0.06, 1);
      dropMat.opacity = 1;
      // Leaf recoils upward right as the drop releases.
      leaf.group.rotation.z = -0.045 + Math.sin(Math.min(1, fallFrac * 6)) * 0.06;

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
      if (caption) caption.remove();
      if (hint) hint.remove();
      if (grain) grain.remove();
      renderer.domElement.remove();
    }
  };
}
