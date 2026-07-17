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

function buildLeaf() {
  // A single stylized leaf silhouette, pointed at both ends, tip aimed down
  // — where the drop gathers — with a center vein.
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.15);
  shape.bezierCurveTo(0.62, 0.95, 0.78, 0.25, 0.5, -0.55);
  shape.bezierCurveTo(0.38, -0.95, 0.16, -1.2, 0, -1.4);
  shape.bezierCurveTo(-0.16, -1.2, -0.38, -0.95, -0.5, -0.55);
  shape.bezierCurveTo(-0.78, 0.25, -0.62, 0.95, 0, 1.15);

  const geo = new THREE.ShapeGeometry(shape, 24);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x1f4d2e, transparent: true, opacity: 0.88,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);

  // Center vein + a few side veins, slightly brighter.
  const veinMat = new THREE.LineBasicMaterial({ color: 0x3f8a55, transparent: true, opacity: 0.55 });
  const veinPts = [new THREE.Vector3(0, 1.1, 0.01), new THREE.Vector3(0, -1.35, 0.01)];
  const veinGeo = new THREE.BufferGeometry().setFromPoints(veinPts);
  const vein = new THREE.Line(veinGeo, veinMat);
  const sideVeins = [];
  for (let i = 0; i < 5; i++) {
    const y = 0.8 - i * 0.42;
    const spread = 0.5 - i * 0.06;
    const pts = [
      new THREE.Vector3(-spread, y - 0.25, 0.01),
      new THREE.Vector3(0, y, 0.01),
      new THREE.Vector3(spread, y - 0.25, 0.01),
    ];
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const l = new THREE.Line(g, veinMat);
    sideVeins.push(l);
  }

  const group = new THREE.Group();
  group.add(mesh, vein, ...sideVeins);
  return { group, geo, mat, veinGeo, veinMat, sideVeins };
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
  const leafScale = preview ? 0.85 : 1.15;
  const leaf = buildLeaf();
  leaf.group.scale.setScalar(leafScale);
  leaf.group.position.set(0, 0.9, 0);
  root.add(leaf.group);
  const tipY = leaf.group.position.y + (-1.4) * leafScale;

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
      #leaf-caption {
        position: fixed;
        bottom: 3rem; left: 50%; transform: translateX(-50%);
        max-width: min(78vw, 42rem);
        text-align: center;
        color: rgba(200, 230, 210, 0.75);
        font-family: 'Times New Roman', serif;
        font-style: italic;
        font-size: clamp(0.8rem, 1.7vw, 1.02rem);
        letter-spacing: 0.01em;
        line-height: 1.7;
        pointer-events: none;
        z-index: 202;
        opacity: 0;
        transition: opacity 1.4s ease;
      }
      #leaf-caption.visible { opacity: 1; }
      #leaf-hint {
        position: fixed; top: 4.5rem; right: 1.2rem;
        color: rgba(255,255,255,0.3);
        font-size: 0.55rem; letter-spacing: 0.2em;
        text-transform: uppercase; pointer-events: none;
        text-align: right; z-index: 202; line-height: 1.8;
        font-family: 'Times New Roman', serif;
      }
      @media (max-width: 600px) {
        #leaf-caption { width: 88vw; max-width: 88vw; font-size: 0.78rem; }
      }
      @media (prefers-reduced-motion: reduce) {
        #leaf-caption { transition: none; }
      }
    `;
    document.head.appendChild(style);
  }
  if (!preview) {
    caption = document.createElement('p');
    caption.id = 'leaf-caption';
    caption.setAttribute('aria-hidden', 'true');
    document.body.appendChild(caption);

    hint = document.createElement('p');
    hint.id = 'leaf-hint';
    hint.innerHTML = 'in the end it falls slowly through the aether';
    hint.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hint);
  }

  let currentStageIndex = -1;
  function updateCaption(frac) {
    if (!caption) return;
    const { index, stage } = stageAt(frac);
    if (index !== currentStageIndex) {
      currentStageIndex = index;
      caption.classList.remove('visible');
      setTimeout(() => {
        caption.textContent = stage.text;
        requestAnimationFrame(() => caption.classList.add('visible'));
      }, 350);
    }
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
      drop.position.set(tremble, tipY - 0.06, 0.05);
      drop.scale.set(0.16 + frac * 0.35, 0.2 + frac * 0.4, 1);
      dropMat.opacity = 1;
      leaf.group.rotation.z = 0;
    } else if (frac < PHASE.fallEnd) {
      // Freefall, easing in (accelerating).
      const fallFrac = (frac - PHASE.fallStart) / (PHASE.fallEnd - PHASE.fallStart);
      const eased = easeInQuad(fallFrac);
      const y = tipY - 0.06 - eased * (tipY - 0.06 - groundY);
      drop.position.set(Math.sin(fallFrac * 6) * 0.015, y, 0.05);
      drop.scale.set(0.22, 0.28 + eased * 0.06, 1);
      dropMat.opacity = 1;
      // Leaf recoils upward right as the drop releases.
      leaf.group.rotation.z = Math.sin(Math.min(1, fallFrac * 6)) * 0.06;

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
      drop.position.set(0, groundY, 0.05);

      if (!splashTriggered) {
        splashTriggered = true;
        motes.filter(m => !m.active).forEach(m => {
          m.active = true;
          m.kind = 'splash';
          m.mat.opacity = 0.9;
          m.sprite.position.set(0, groundY, 0.05);
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
      drop.position.set(0, tipY - 0.06, 0.05);
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
      leaf.geo.dispose(); leaf.mat.dispose(); leaf.veinGeo.dispose(); leaf.veinMat.dispose();
      leaf.sideVeins.forEach(l => l.geometry.dispose());
      dropTex.dispose(); dropMat.dispose();
      moteTex.dispose();
      motes.forEach(m => m.mat.dispose());
      if (caption) caption.remove();
      if (hint) hint.remove();
      renderer.domElement.remove();
    }
  };
}
