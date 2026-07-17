import * as THREE from 'three';

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

function makeEarthTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const cx = c.getContext('2d');

  // Ocean base — a vertical gradient, darker at the poles.
  const grad = cx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0,    '#0a2a3a');
  grad.addColorStop(0.15, '#0e3f52');
  grad.addColorStop(0.5,  '#12536a');
  grad.addColorStop(0.85, '#0e3f52');
  grad.addColorStop(1,    '#0a2a3a');
  cx.fillStyle = grad;
  cx.fillRect(0, 0, 512, 256);

  // Landmasses — hand-placed soft blobs, not a real map, just enough
  // silhouette variation to read as a planet rather than a marble.
  cx.fillStyle = 'rgba(60, 92, 58, 0.85)';
  const blobs = [
    [80, 90, 46, 30], [120, 130, 30, 22], [230, 70, 60, 26],
    [260, 140, 38, 34], [340, 60, 50, 24], [370, 120, 34, 40],
    [420, 180, 44, 22], [40, 170, 36, 20], [180, 190, 50, 18],
  ];
  blobs.forEach(([bx, by, bw, bh]) => {
    cx.beginPath();
    cx.ellipse(bx, by, bw, bh, 0, 0, Math.PI * 2);
    cx.fill();
  });

  // Ice caps.
  cx.fillStyle = 'rgba(220, 235, 240, 0.55)';
  cx.fillRect(0, 0, 512, 14);
  cx.fillRect(0, 242, 512, 14);

  // Faint cloud streaks.
  cx.strokeStyle = 'rgba(255,255,255,0.12)';
  cx.lineWidth = 3;
  for (let i = 0; i < 14; i++) {
    const y = 20 + Math.random() * 216;
    cx.beginPath();
    cx.moveTo(Math.random() * 512, y);
    cx.bezierCurveTo(
      Math.random() * 512, y + (Math.random() - 0.5) * 20,
      Math.random() * 512, y + (Math.random() - 0.5) * 20,
      Math.random() * 512, y
    );
    cx.stroke();
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
// A ring of tall, thin gradient sprites arranged just outside the polar
// circle at each pole — green fading to violet at the top, the classic
// aurora palette, swaying gently and flickering in opacity.
function makeAuroraTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 128;
  const cx = c.getContext('2d');
  const grad = cx.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0,    'rgba(60,255,150,0)');
  grad.addColorStop(0.15, 'rgba(60,255,150,0.55)');
  grad.addColorStop(0.55, 'rgba(110,255,180,0.35)');
  grad.addColorStop(0.85, 'rgba(150,120,255,0.28)');
  grad.addColorStop(1,    'rgba(150,120,255,0)');
  cx.fillStyle = grad;
  cx.fillRect(0, 0, 32, 128);
  return new THREE.CanvasTexture(c);
}

function buildAurorae(preview) {
  const group = new THREE.Group();
  const tex = makeAuroraTexture();
  const ribbons = [];
  const perPole = preview ? 8 : 14;

  [1, -1].forEach(hemisphere => {
    for (let i = 0; i < perPole; i++) {
      const lon = (i / perPole) * Math.PI * 2 + Math.random() * 0.2;
      const polarAngle = 0.32 + Math.random() * 0.1; // how far from the pole, radians
      const y = hemisphere * Math.cos(polarAngle) * (EARTH_RADIUS * 1.02);
      const ringR = Math.sin(polarAngle) * (EARTH_RADIUS * 1.02);

      const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0.5 + Math.random() * 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false,
        rotation: 0,
      });
      const sprite = new THREE.Sprite(mat);
      const h = 0.5 + Math.random() * 0.35;
      sprite.scale.set(0.16, hemisphere > 0 ? h : h, 1);
      sprite.position.set(ringR * Math.cos(lon), y + (hemisphere > 0 ? h * 0.4 : -h * 0.4), ringR * Math.sin(lon));
      // Face outward-ish rather than purely camera-facing so the curtain reads
      // as standing on the surface, not as a flat billboard array.
      group.add(sprite);
      ribbons.push({ sprite, mat, phase: Math.random() * Math.PI * 2, baseOpacity: mat.opacity });
    }
  });

  return { group, ribbons, tex };
}

// ─── Satellites ─────────────────────────────────────────────────────────────
// Same tilted-pivot orbit trick as the orrery in orrery.js: rotate the pivot,
// the body (attached at a fixed radius on the pivot) sweeps a real orbit.
function buildSatellites(preview) {
  const group = new THREE.Group();
  const count = preview ? 4 : 8;
  const sats = [];
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0xe8e4d8 });
  const panelMat = new THREE.MeshBasicMaterial({
    color: 0x3f6fb0, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
  });
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
      pivot, body,
      speed: (0.25 + Math.random() * 0.35) * (Math.random() < 0.5 ? 1 : -1),
      ringMat,
    });
  }

  return { group, sats, bodyMat, panelMat, trailMat };
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

  // ─── Caption + hint (full only) ─────────────────────────────────────────
  let caption = null, hint = null;
  if (!preview && !document.getElementById('egg-styles')) {
    const style = document.createElement('style');
    style.id = 'egg-styles';
    style.textContent = `
      #egg-caption, #egg-hint {
        position: fixed; color: rgba(255,255,255,0.35);
        pointer-events: none; text-align: center; z-index: 202;
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
    hint.innerHTML = 'drag to orbit';
    hint.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hint);
  }

  // ─── Drag to orbit (same manual pattern as orrery.js) ───────────────────
  let isDragging = false, prevMouse = { x: 0, y: 0 }, autoRotate = true;
  container.addEventListener('mousedown', e => {
    isDragging = true; autoRotate = false;
    prevMouse = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('mouseup', () => {
    isDragging = false;
    setTimeout(() => { autoRotate = true; }, 2500);
  });
  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    root.rotation.y += (e.clientX - prevMouse.x) * 0.004;
    root.rotation.x += (e.clientY - prevMouse.y) * 0.004;
    prevMouse = { x: e.clientX, y: e.clientY };
  });
  container.addEventListener(
    'touchmove',
    e => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (prevMouse.touching) {
        root.rotation.y += (t.clientX - prevMouse.x) * 0.004;
        root.rotation.x += (t.clientY - prevMouse.y) * 0.004;
      }
      prevMouse = { x: t.clientX, y: t.clientY, touching: true };
    },
    { passive: true }
  );
  container.addEventListener('touchend', () => { prevMouse.touching = false; }, { passive: true });

  // ─── Animate ──────────────────────────────────────────────────────────────
  let animId, t = 0;
  function animate() {
    animId = requestAnimationFrame(animate);
    t += 0.01;

    earth.rotation.y = t * (preview ? 0.06 : 0.03);
    glowMat.opacity = 0.05 + Math.sin(t * 1.2) * 0.025;

    field.lines.forEach((l, i) => {
      field.mat.opacity = (preview ? 0.3 : 0.38) + Math.sin(t * 0.6 + i) * 0.05;
    });
    field.group.rotation.y = t * 0.015;

    aurorae.ribbons.forEach(r => {
      r.phase += 0.02;
      r.mat.opacity = Math.max(0, r.baseOpacity + Math.sin(r.phase) * 0.18);
    });

    satellites.sats.forEach(s => {
      s.pivot.rotation.y += s.speed * 0.01;
    });

    if (autoRotate && !isDragging) {
      root.rotation.y += preview ? 0.0015 : 0.0009;
    }

    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    // A hidden ancestor (e.g. the landing grid behind an active full-screen
    // scene) makes clientWidth/Height read 0 — don't fall through to
    // window.innerWidth/Height in that case, or a small preview container
    // would get resized to fill the whole viewport once it's shown again.
    if (!container.clientWidth || !container.clientHeight) return;
    const nw = container.clientWidth || window.innerWidth;
    const nh = container.clientHeight || window.innerHeight;
    camera.aspect = nw / nh;
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
      geo.dispose(); mat.dispose(); earthTex.dispose();
      glowGeo.dispose(); glowMat.dispose();
      starGeo.dispose(); starMat.dispose();
      field.lines.forEach(l => l.geo.dispose());
      field.mat.dispose();
      aurorae.ribbons.forEach(r => r.mat.dispose());
      aurorae.tex.dispose();
      satellites.sats.forEach(s => s.ringMat.dispose());
      satellites.bodyMat.dispose();
      satellites.panelMat.dispose();
      satellites.trailMat.dispose();
      if (caption) caption.remove();
      if (hint) hint.remove();
      renderer.domElement.remove();
    }
  };
}
