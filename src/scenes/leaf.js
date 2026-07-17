import * as THREE from 'three';

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

const CYCLE_SECONDS = 34; // one full fall-to-reform loop

function stageAt(frac) {
  let acc = 0;
  for (let i = 0; i < TEXT_STAGES.length; i++) {
    acc += TEXT_STAGES[i].w;
    if (frac <= acc) return { index: i, stage: TEXT_STAGES[i], acc };
  }
  return { index: TEXT_STAGES.length - 1, stage: TEXT_STAGES[TEXT_STAGES.length - 1], acc };
}

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

  // ─── Backdrop: soft vertical gradient, dark teal to black ─────────────────
  function makeSkyTexture() {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 256;
    const cx = c.getContext('2d');
    const grad = cx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0,   '#040d0a');
    grad.addColorStop(0.6, '#020604');
    grad.addColorStop(1,   '#000000');
    cx.fillStyle = grad;
    cx.fillRect(0, 0, 4, 256);
    return new THREE.CanvasTexture(c);
  }
  const skyTex = makeSkyTexture();
  const skyGeo = new THREE.PlaneGeometry(viewH * aspect * 2.4, viewH * 2.4);
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, depthWrite: false });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.position.z = -2;
  root.add(sky);

  // ─── Ground: a faint horizontal glow near the bottom ──────────────────────
  const groundY = -2.3;
  const groundGeo = new THREE.PlaneGeometry(viewH * aspect * 2.2, 0.5);
  const groundMat = new THREE.MeshBasicMaterial({
    color: 0x1a3a2a, transparent: true, opacity: 0.35, depthWrite: false,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set(0, groundY - 0.15, -1);
  root.add(ground);

  // ─── Leaf ───────────────────────────────────────────────────────────────
  // Off-center and very slightly tilted at rest — wabi-sabi composition,
  // nothing perfectly centered or perfectly upright.
  const leafScale = preview ? 0.85 : 1.15;
  const leaf = buildLeaf();
  leaf.group.scale.setScalar(leafScale);
  leaf.group.position.set(-0.22, 0.9, 0);
  leaf.group.rotation.z = -0.045;
  root.add(leaf.group);
  const tipY = leaf.group.position.y + (-1.4) * leafScale;
  const tipX = leaf.group.position.x;

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
      #leaf-caption {
        position: fixed;
        bottom: 3rem; left: 50%; transform: translateX(-50%);
        width: min(78vw, 42rem); height: 6.6rem;
        overflow: hidden; pointer-events: none; z-index: 310;
        -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%);
                mask-image: linear-gradient(to bottom, transparent 0%, black 22%, black 78%, transparent 100%);
      }
      #leaf-caption-track {
        position: absolute; top: 0; left: 0; width: 100%;
        transition: transform 0.4s linear;
      }
      #leaf-caption-track p {
        text-align: center;
        color: rgba(196, 214, 196, 0.7);
        font-family: 'Times New Roman', serif;
        font-style: italic;
        font-size: clamp(0.78rem, 1.6vw, 0.98rem);
        letter-spacing: 0.01em;
        line-height: 1.7;
        text-shadow: 0 1px 3px rgba(0,0,0,0.6);
        margin: 0 0 2.2rem;
        padding: 0 0.5rem;
      }
      #leaf-hint {
        position: fixed; top: 4.5rem; right: 1.2rem;
        color: rgba(255,255,255,0.3);
        font-size: 0.55rem; letter-spacing: 0.2em;
        text-transform: uppercase; pointer-events: none;
        text-align: right; z-index: 310; line-height: 1.8;
        font-family: 'Times New Roman', serif;
      }
      @media (max-width: 600px) {
        #leaf-caption { width: 88vw; height: 7.6rem; }
        #leaf-caption-track p { font-size: 0.78rem; }
      }
      @media (prefers-reduced-motion: reduce) {
        #leaf-caption-track { transition: none; }
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
  let captionTrack = null, stageEls = [], stageCenters = [];
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
    caption.setAttribute('aria-hidden', 'true');
    captionTrack = document.createElement('div');
    captionTrack.id = 'leaf-caption-track';
    // The whole piece, stacked in reading order, in normal document flow —
    // real layout heights, so nothing clips regardless of how a stage's
    // text happens to wrap at a given screen width. It scrolls down
    // through this continuously, in step with the drop's own fall (both
    // driven by the same `frac`), rather than fading between discrete
    // blocks — the text falls with it.
    TEXT_STAGES.forEach(stage => {
      const p = document.createElement('p');
      p.textContent = stage.text;
      captionTrack.appendChild(p);
      stageEls.push(p);
    });
    caption.appendChild(captionTrack);
    document.body.appendChild(caption);

    hint = document.createElement('p');
    hint.id = 'leaf-hint';
    hint.innerHTML = 'in the end it falls slowly through the aether';
    hint.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hint);

    // Measure each stage paragraph's vertical center once laid out, and
    // whenever the window resizes (text reflows at a new width).
    const measure = () => {
      stageCenters = stageEls.map(p => p.offsetTop + p.offsetHeight / 2);
    };
    requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    caption._measure = measure;
  }

  // Cumulative weight boundaries (0..1), same split TEXT_STAGES.w already
  // drives for stageAt() — the scroll position at a given `frac` is a
  // straight interpolation between the current and next stage's measured
  // center, weighted by how far through the current stage frac has gotten.
  const stageStarts = [];
  { let acc = 0; TEXT_STAGES.forEach(s => { stageStarts.push(acc); acc += s.w; }); }

  const SCROLL_HOLD = 0.6; // hold each stage centered for its first 60%, then ease down to the next
  function updateCaption(frac) {
    if (!caption || !captionTrack || !stageCenters.length) return;
    const { index } = stageAt(frac);
    const start = stageStarts[index];
    const w = TEXT_STAGES[index].w;
    const localT = Math.min(1, Math.max(0, (frac - start) / w));
    const scrollT = localT < SCROLL_HOLD ? 0 : (localT - SCROLL_HOLD) / (1 - SCROLL_HOLD);
    const centerNow = stageCenters[index];
    const centerNext = stageCenters[Math.min(index + 1, stageCenters.length - 1)];
    const center = centerNow + (centerNext - centerNow) * easeInQuad(scrollT);
    const viewportHalf = caption.clientHeight / 2;
    captionTrack.style.transform = `translateY(${viewportHalf - center}px)`;
  }

  // ─── Fall phases (fractions of the loop, 0..1) ─────────────────────────
  const PHASE = { holdEnd: 0.14, fallStart: 0.14, fallEnd: 0.86, splashEnd: 0.94 };

  function resetMotes() {
    motes.forEach(m => { m.active = false; m.mat.opacity = 0; });
  }
  resetMotes();

  // ─── Animate ─────────────────────────────────────────────────────────
  let animId, tSec = 0;
  let escapeTriggered = false, splashTriggered = false;
  function animate() {
    animId = requestAnimationFrame(animate);
    const dt = 1 / 60;
    tSec += dt;
    const frac = (tSec % CYCLE_SECONDS) / CYCLE_SECONDS;

    if (frac < PHASE.holdEnd - 0.001) {
      escapeTriggered = false;
      splashTriggered = false;
      resetMotes();
    }

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

    updateCaption(frac);

    // A very slow ambient drift on the whole scene — alive, not static.
    root.position.x = Math.sin(tSec * 0.05) * 0.02;

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
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 100));

  return {
    dispose() {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      renderer.dispose();
      skyGeo.dispose(); skyMat.dispose(); skyTex.dispose();
      groundGeo.dispose(); groundMat.dispose();
      leaf.geo.dispose(); leaf.mat.dispose(); leaf.tex.dispose();
      leaf.veinGeo.dispose(); leaf.veinMat.dispose();
      leaf.sideVeins.forEach(l => l.geometry.dispose());
      dropTex.dispose(); dropMat.dispose();
      moteTex.dispose();
      motes.forEach(m => m.mat.dispose());
      if (caption && caption._measure) window.removeEventListener('resize', caption._measure);
      if (caption) caption.remove();
      if (hint) hint.remove();
      if (grain) grain.remove();
      renderer.domElement.remove();
    }
  };
}
