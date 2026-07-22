import * as THREE from 'three';
import { prefersReducedMotion } from '../utils/sceneKit.js';

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

// ─── Backdrop layers: a Boca Raton balcony, daytime ────────────────────────
// Split into three independent draw functions (sky, far, near) rather than
// one flat canvas — 1.0.33, Scott: "create a 3d space with different planes
// and parallax." Each becomes its own CanvasTexture on its own plane at a
// different depth inside createLeaf(); these functions only draw pixels,
// they don't know about THREE or depth at all.
function drawSky(cx, cw, ch) {
  // Daytime sky — soft pale blue up top, through a hazy gray-green, to a
  // warm neutral cream at the horizon, matching the reference photos'
  // bright-but-muted Florida daylight rather than a postcard-blue sky.
  const sky = cx.createLinearGradient(0, 0, 0, ch);
  sky.addColorStop(0,    '#9fb7c8');
  sky.addColorStop(0.45, '#c3cdc4');
  sky.addColorStop(0.78, '#e2d8c4');
  sky.addColorStop(1,    '#d9c8ab');
  cx.fillStyle = sky;
  cx.fillRect(0, 0, cw, ch);

  // A few soft, low-contrast clouds — daytime haze, not night stars.
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * cw, y = ch * (0.06 + Math.random() * 0.28);
    const r = 40 + Math.random() * 70;
    const grad = cx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.28)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = grad;
    cx.beginPath();
    cx.ellipse(x, y, r, r * 0.4, 0, 0, Math.PI * 2);
    cx.fill();
  }

  // A single soft glow — daytime sun haze in one upper corner, standing in
  // for the old porch-light accent — kept, since it's what keeps the sky
  // from reading flat.
  const glow = cx.createRadialGradient(cw * 0.82, ch * 0.14, 4, cw * 0.82, ch * 0.14, cw * 0.3);
  glow.addColorStop(0, 'rgba(255,250,230,0.22)');
  glow.addColorStop(1, 'rgba(255,250,230,0)');
  cx.fillStyle = glow;
  cx.fillRect(0, 0, cw, ch);
}

// Distant condo silhouettes + two palms — transparent canvas (only these
// shapes are opaque), so the sky layer behind shows through everywhere
// else. Full scene only — preview tiles skip this whole layer (see
// createLeaf): at 320px thumbnail scale this hard, full-width geometric
// detail was competing with the leaf's own round silhouette hard enough
// that the leaf itself started reading as square rather than round.
function drawFar(cx, cw, ch, horizonY) {
  cx.fillStyle = 'rgba(120,120,118,0.4)';
  [[0.08, 0.16, 0.42], [0.22, 0.1, 0.3], [0.72, 0.2, 0.5], [0.86, 0.13, 0.36]].forEach(([fx, fh, fw]) => {
    const bw = cw * fw * 0.14;
    const bh = ch * fh;
    cx.fillRect(cw * fx, horizonY - bh, bw, bh);
  });

  const palm = (px, py, scale) => {
    cx.strokeStyle = 'rgba(70,82,58,0.6)';
    cx.lineWidth = 3 * scale;
    cx.beginPath();
    cx.moveTo(px, py);
    cx.quadraticCurveTo(px - 6 * scale, py - 30 * scale, px - 2 * scale, py - 58 * scale);
    cx.stroke();
    const crownX = px - 2 * scale, crownY = py - 58 * scale;
    for (let i = 0; i < 5; i++) {
      const a = (-0.9 + i * 0.45) * Math.PI;
      cx.beginPath();
      cx.moveTo(crownX, crownY);
      cx.quadraticCurveTo(
        crownX + Math.cos(a) * 16 * scale, crownY + Math.sin(a) * 10 * scale,
        crownX + Math.cos(a) * 30 * scale, crownY + Math.sin(a) * 16 * scale + 8 * scale
      );
      cx.stroke();
    }
  };
  palm(cw * 0.12, horizonY + 4, cw / 900);
  palm(cw * 0.9, horizonY + 8, cw / 900 * 0.85);
}

// Black metal balcony rail + one corner plant silhouette — transparent
// canvas, same reasoning as drawFar. Full scene only.
function drawNear(cx, cw, ch, railTop, railBottom) {
  cx.fillStyle = 'rgba(22,22,24,0.88)';
  cx.fillRect(0, railTop, cw, 3);
  cx.fillRect(0, railBottom - 2, cw, 2.5);
  const baluster = cw / 34;
  for (let x = baluster / 2; x < cw; x += baluster) {
    cx.fillRect(x - 1, railTop, 2, railBottom - railTop);
  }

  // A single plant silhouette in one corner — the Japandi habit of one
  // sculptural, unfussy plant rather than clutter — standing in for the
  // one this leaf and drop actually belong to. Kept dark against the
  // bright sky (a backlit plant reads as a silhouette even in daylight).
  cx.fillStyle = 'rgba(35,32,28,0.7)';
  const potX = cw * 0.16, potY = railBottom;
  cx.fillRect(potX - 22, potY - 26, 44, 26);
  for (let i = 0; i < 6; i++) {
    const a = (-1.35 + i * 0.22) * Math.PI * 0.5 - 0.4;
    cx.beginPath();
    cx.moveTo(potX, potY - 24);
    cx.quadraticCurveTo(
      potX + Math.cos(a) * 30, potY - 24 + Math.sin(a) * 50,
      potX + Math.cos(a) * 40, potY - 24 + Math.sin(a) * 70
    );
    cx.stroke();
  }
}

function makeLayerTexture(cw, ch, drawFn) {
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  drawFn(c.getContext('2d'));
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
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
  container.appendChild(renderer.domElement);

  const root = new THREE.Group();
  scene.add(root);
  const reduceMotion = prefersReducedMotion();

  // ─── Backdrop ───────────────────────────────────────────────────────────
  // Preview tiles: one plane, sky/clouds/glow only (see drawFar/drawNear's
  // own comments for why the rest is skipped there). Full scene: three
  // planes at increasing depth — sky furthest, skyline+palms mid, rail+
  // plant nearest — each on its own CanvasTexture so they can move
  // independently. Built at the plane's own aspect ratio (not a repeated
  // square tile) so nothing stretches at portrait viewport ratios.
  const cw = Math.round(Math.max(600, Math.min(1400, 900 * Math.max(aspect, 0.5))));
  const ch = Math.round(cw / Math.max(aspect, 0.5));
  const horizonY = ch * 0.62;
  const railTop = ch * 0.78, railBottom = ch * 0.98;
  const PLANE_W = viewH * aspect * 2.4 * 1.8; // oversized so the scroll-parallax
  const PLANE_H = viewH * 2.4 * 1.3;          // shift below never reveals a bare edge.

  const backdrop = new THREE.Group();
  scene.add(backdrop);
  const backdropParts = []; // { geo, mat, tex } — for dispose()

  function addLayer(drawFn, z, opaque) {
    const tex = makeLayerTexture(cw, ch, drawFn);
    const geo = new THREE.PlaneGeometry(PLANE_W, PLANE_H);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: !opaque, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = z;
    backdrop.add(mesh);
    backdropParts.push({ geo, mat, tex });
    return mesh;
  }

  let farLayer = null, nearLayer = null;
  const skyLayer = preview
    ? addLayer(cx => drawSky(cx, cw, ch), -2, true)
    : addLayer(cx => drawSky(cx, cw, ch), -6, true);
  if (!preview) {
    farLayer = addLayer(cx => drawFar(cx, cw, ch, horizonY), -4, false);
    nearLayer = addLayer(cx => drawNear(cx, cw, ch, railTop, railBottom), -1.5, false);
  }

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
  // Recomputed on resize (see onResize below), since "the right third" is
  // relative to whatever the viewport's aspect ratio happens to be right now.
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
        left: 4vw; top: 4.5rem;
        width: min(62vw, 60rem); height: min(74vh, 44rem);
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
        font-family: 'Zen Maru Gothic', 'Hiragino Maru Gothic ProN', sans-serif;
        font-weight: 400;
        /* Enlarged well past the old corner-box version — the text IS
           most of the composition now, not a small accent beside it. */
        font-size: clamp(1.6rem, 3.2vw, 2.6rem);
        letter-spacing: 0.005em;
        line-height: 1.5;
        /* A soft light halo in place of the old dark drop-shadow — keeps
           the text legible on the rare paragraph that sits over the
           skyline/palm layer, without reintroducing a boxed background
           behind it (Scott asked specifically to lose that). */
        text-shadow: 0 1px 18px rgba(255,255,255,0.65), 0 1px 2px rgba(255,255,255,0.4);
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
        font-family: 'Zen Maru Gothic', sans-serif;
      }
      @media (max-width: 800px) {
        /* Not enough width for a right-third leaf column and a left-two-
           thirds text column both — same conflict as before 1.0.30, same
           fix: drop to a small centered box at the bottom below this
           breakpoint rather than overlapping the two. */
        #leaf-caption { left: 50%; top: auto; bottom: 1.6rem; transform: translateX(-50%); width: 88vw; height: 34vh; }
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

    // Parallax: the same scroll-driven frac already moving the drop also
    // nudges the backdrop layers sideways at different rates — nearest
    // (rail/plant) shifts the most, sky barely at all. The classic depth
    // cue, driven by reading progress rather than a mouse/tilt input —
    // Scott specifically asked to tie it to scroll, since that works
    // identically on mobile and desktop, unlike a mouse-parallax effect.
    if (!preview && farLayer) {
      skyLayer.position.x = frac * 0.15;
      farLayer.position.x = frac * 0.55;
      nearLayer.position.x = frac * 1.05;
    }

    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    if (!container.clientWidth || !container.clientHeight) return;
    const nw = container.clientWidth || window.innerWidth;
    const nh = container.clientHeight || window.innerHeight;
    const na = nw / nh;
    camera.left = -viewH * na;
    camera.right = viewH * na;
    camera.top = viewH;
    camera.bottom = -viewH;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
    layoutLeaf();
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 100));

  return {
    dispose() {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      renderer.dispose();
      backdropParts.forEach(p => { p.geo.dispose(); p.mat.dispose(); p.tex.dispose(); });
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
