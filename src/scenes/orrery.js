import * as THREE from 'three';

// ─── The Orrery of Los Feliz ───────────────────────────────────────────────
// A found short-short, full and unedited, undated. Investigators track a
// mysterious 30-foot orrery — a moving model of the solar system, a working
// radio telescope at its peak — to a warehouse in Los Feliz.
//
// This used to be one small clickable object tucked inside a larger scene
// called "Nebula," which was mostly constellations recreating Scott's old
// personal sites (Spoonfed and its variants, the butterfly effect,
// Solistrato) — real content, but a different story than this one. That
// scene also carried a never-used, never-populated side tool
// (utils/nebula-curator.html) for pasting URLs and having Claude sort them
// into star constellations — abandoned before it ever produced a single
// star that made it into the site. Both are gone now. This scene is the
// orrery alone, promoted from a detail to the whole piece: bigger, built
// out with real detail (nine bodies and their moons, an asteroid belt, a
// few unidentified cosmic objects, same as the text describes), the found
// text delivered the same way — click it, read it.

const ORRERY = {
  name: 'The Orrery of Los Feliz',
  era: 'found · undated',
  note: `We were tipped off by a news item coupled with the creditors’ lawsuits against Peter Hight, our synchronicity sensitives finding a common link between the two. The news item said that the FCC was investigating a pirate radio station somewhere in the Los Feliz area. It was buried in the local section of the Times. The creditors were a foundry, a warehouse and a sculpture studio, trying to get paid for some very large pieces they had made. We tracked the warehouse down and with a little persuasion convinced the landlord to let us in.

Inside was an orrery – a moving sculpture, a representation of the solar system. It was about 30 feet high, the peak poking out of the warehouse skylights. A gargantuan thing, but it moved without a sound. All nine planets and their moons, the asteroid belt, and a few other unidentified cosmic objects were represented. Great bronze balls swirled around the center spike of steel and wood, painted a most royal purple. The pinnacle was in fact a miniature radio telescope, pointed straight up, and it was still on, receiving information from the heavens. What is most interesting about the orrery – apart from it having been built in the first place – is that the orbits of the planets are precisely and mathematically laid out with an error tolerance approaching perfection.

Our investigation into Peter Hight is pending, but from all appearances he appears to be an unlikely candidate to construct such a thing. A dropout of community college.`,
};

// Bronze/purple/steel palette, matching the text: "Great bronze balls,"
// "the center spike of steel and wood, painted a most royal purple."
const BODY_TONES = [0xddb178, 0xc99a5e, 0xe3c496, 0xb9885a, 0xceab7e, 0xa87a4e, 0xd6ae82, 0xbf9868, 0xe8caa0];
const MOON_TONE  = 0xeee0cc;
const ASTEROID_TONE = 0x7a6a55;
const UNKNOWN_TONES = [0x8855aa, 0x6a4d8a];

function buildOrrery(preview) {
  const group = new THREE.Group();

  // ─── The spike — steel and wood, painted royal purple ────────────────────
  const spikeHeight = preview ? 3.4 : 4.6;
  const spikeGeo = new THREE.CylinderGeometry(preview ? 0.05 : 0.06, preview ? 0.08 : 0.1, spikeHeight, 10);
  const spikeMat = new THREE.MeshBasicMaterial({ color: 0x5c3d7a, transparent: true, opacity: 0.85 });
  const spike = new THREE.Mesh(spikeGeo, spikeMat);
  spike.position.y = spikeHeight / 2 - (preview ? 1.0 : 1.4);
  group.add(spike);

  // A hub at the base of the spike — the actual clickable/hover target.
  const hubGeo = new THREE.SphereGeometry(preview ? 0.16 : 0.2, 16, 16);
  const hubMat = new THREE.MeshBasicMaterial({ color: 0x8855aa, transparent: true, opacity: 0.95 });
  const hub = new THREE.Mesh(hubGeo, hubMat);
  hub.position.y = spike.position.y - spikeHeight / 2;
  group.add(hub);

  // ─── The radio telescope — "still on, receiving information from the
  // heavens." A small dish at the peak, pulsing with a faint received signal.
  const dishGroup = new THREE.Group();
  dishGroup.position.y = spike.position.y + spikeHeight / 2;
  const dishGeo = new THREE.ConeGeometry(preview ? 0.18 : 0.24, preview ? 0.22 : 0.3, 16, 1, true);
  const dishMat = new THREE.MeshBasicMaterial({
    color: 0xccaadd, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
  });
  const dish = new THREE.Mesh(dishGeo, dishMat);
  dish.rotation.x = Math.PI;
  dishGroup.add(dish);
  const signalMat = new THREE.MeshBasicMaterial({ color: 0xffe8bb, transparent: true, opacity: 0.7 });
  const signal = new THREE.Mesh(new THREE.SphereGeometry(preview ? 0.04 : 0.05, 8, 8), signalMat);
  signal.position.y = preview ? 0.16 : 0.22;
  dishGroup.add(signal);
  group.add(dishGroup);

  // ─── Nine planets and their moons, real independent orbits ──────────────
  const orbits = [];
  const bodyCount = preview ? 5 : 9;
  const moonIndices = new Set(preview ? [1, 3] : [1, 3, 5, 7]);

  for (let i = 0; i < bodyCount; i++) {
    const radius = (preview ? 0.5 : 0.65) + i * (preview ? 0.32 : 0.42);
    const tilt = (i * 0.28) + (Math.random() - 0.5) * 0.18;
    const yOffset = hub.position.y + Math.sin(i * 0.7) * (preview ? 0.15 : 0.25);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xaa7733, transparent: true, opacity: 0.22, side: THREE.DoubleSide,
    });
    const ringGeo = new THREE.TorusGeometry(radius, preview ? 0.005 : 0.006, 8, 64);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2 + tilt;
    ring.position.y = yOffset;
    group.add(ring);

    const pivot = new THREE.Object3D();
    pivot.rotation.x = tilt;
    pivot.position.y = yOffset;
    group.add(pivot);

    const bodyGeo = new THREE.SphereGeometry((preview ? 0.028 : 0.038) + (i % 3) * 0.008, 12, 12);
    const bodyMat = new THREE.MeshBasicMaterial({ color: BODY_TONES[i % BODY_TONES.length] });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.x = radius;
    pivot.add(body);

    const orbit = { pivot, speed: 0.22 - i * 0.016 + Math.random() * 0.03, direction: i % 2 === 0 ? 1 : -1, moon: null };

    // A moon on a handful of bodies — its own small orbit around the planet.
    if (moonIndices.has(i)) {
      const moonPivot = new THREE.Object3D();
      body.add(moonPivot);
      const moonGeo = new THREE.SphereGeometry(preview ? 0.009 : 0.012, 8, 8);
      const moonMat = new THREE.MeshBasicMaterial({ color: MOON_TONE });
      const moon = new THREE.Mesh(moonGeo, moonMat);
      moon.position.x = preview ? 0.06 : 0.08;
      moonPivot.add(moon);
      orbit.moon = { pivot: moonPivot, speed: 0.8 + Math.random() * 0.4 };
    }

    orbits.push(orbit);
  }

  // ─── The asteroid belt — a scatter ring, not a solid line ────────────────
  const beltRadius = (preview ? 0.5 : 0.65) + bodyCount * (preview ? 0.32 : 0.42) + (preview ? 0.22 : 0.3);
  const beltPivot = new THREE.Object3D();
  beltPivot.position.y = hub.position.y;
  group.add(beltPivot);
  const beltCount = preview ? 40 : 90;
  const beltPositions = new Float32Array(beltCount * 3);
  for (let i = 0; i < beltCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = beltRadius + (Math.random() - 0.5) * (preview ? 0.1 : 0.14);
    beltPositions[i * 3]     = Math.cos(a) * r;
    beltPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.08;
    beltPositions[i * 3 + 2] = Math.sin(a) * r;
  }
  const beltGeo = new THREE.BufferGeometry();
  beltGeo.setAttribute('position', new THREE.BufferAttribute(beltPositions, 3));
  const beltMat = new THREE.PointsMaterial({
    color: ASTEROID_TONE, size: preview ? 0.02 : 0.026, transparent: true, opacity: 0.75,
  });
  const belt = new THREE.Points(beltGeo, beltMat);
  beltPivot.add(belt);

  // ─── "A few other unidentified cosmic objects" — irregular polyhedra,
  // tumbling on their own wide, oddly-tilted orbits, further out than
  // everything else.
  const unknowns = [];
  const unknownGeos = [new THREE.IcosahedronGeometry(preview ? 0.045 : 0.06, 0), new THREE.OctahedronGeometry(preview ? 0.04 : 0.055, 0)];
  const unknownCount = preview ? 1 : 2;
  for (let i = 0; i < unknownCount; i++) {
    const radius = beltRadius + (preview ? 0.35 : 0.5) + i * (preview ? 0.3 : 0.4);
    const tilt = 0.5 + i * 0.4 + (Math.random() - 0.5) * 0.3;
    const pivot = new THREE.Object3D();
    pivot.rotation.x = tilt;
    pivot.rotation.z = i * 0.5;
    pivot.position.y = hub.position.y;
    group.add(pivot);
    const mat = new THREE.MeshBasicMaterial({ color: UNKNOWN_TONES[i % UNKNOWN_TONES.length], transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(unknownGeos[i % unknownGeos.length], mat);
    mesh.position.x = radius;
    pivot.add(mesh);
    unknowns.push({ pivot, mesh, speed: 0.08 + Math.random() * 0.05, direction: i % 2 === 0 ? 1 : -1, spin: 0.3 + Math.random() * 0.4 });
  }

  return { group, hitTarget: hub, glowMat: hubMat, orbits, unknowns, signal, signalMat };
}

export function createOrrery(container, { preview = false } = {}) {
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(55, w / h, 0.1, 500);
  camera.position.set(0, preview ? 0.6 : 1.0, preview ? 9 : 11);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  // ─── Ambient deep field — the sky above the skylights the peak pokes
  // through, and what the telescope is listening to. ───────────────────────
  const starCount = preview ? 300 : 900;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * (preview ? 22 : 36);
    positions[i * 3 + 1] = (Math.random() - 0.5) * (preview ? 22 : 36);
    positions[i * 3 + 2] = (Math.random() - 0.5) * (preview ? 10 : 16) - 6;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xddeeff, size: preview ? 0.025 : 0.04, transparent: true, opacity: 0.35, sizeAttenuation: true,
  });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  // A faint warehouse-rafter suggestion, up high, just enough grounding —
  // "the peak poking out of the warehouse skylights."
  const rafterMat = new THREE.LineBasicMaterial({ color: 0x332818, transparent: true, opacity: 0.3 });
  const rafterGroup = new THREE.Group();
  [-3, 3].forEach(x => {
    const pts = [new THREE.Vector3(x, preview ? 5.5 : 7.2, -4), new THREE.Vector3(x, preview ? 5.5 : 7.2, 4)];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    rafterGroup.add(new THREE.Line(geo, rafterMat));
  });
  scene.add(rafterGroup);

  const root = new THREE.Group();
  scene.add(root);

  const orrery = buildOrrery(preview);
  root.add(orrery.group);

  function makeHaloTexture(hexColor) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const cx = c.getContext('2d');
    const col = new THREE.Color(hexColor);
    const rgb = `${Math.round(col.r*255)},${Math.round(col.g*255)},${Math.round(col.b*255)}`;
    const grad = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${rgb},0.9)`);
    grad.addColorStop(0.4, `rgba(${rgb},0.35)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    cx.fillStyle = grad;
    cx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  const haloMat = new THREE.SpriteMaterial({
    map: makeHaloTexture(0x8855aa), color: 0x8855aa, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const halo = new THREE.Sprite(haloMat);
  halo.scale.set(preview ? 1.1 : 1.6, preview ? 1.1 : 1.6, 1);
  orrery.hitTarget.add(halo);

  // ─── Panel + window-chrome styling ───────────────────────────────────────
  if (!preview && !document.getElementById('orrery-styles')) {
    const style = document.createElement('style');
    style.id = 'orrery-styles';
    style.textContent = `
      #orrery-panel {
        position: absolute; top: 0; right: 0; width: 38%; height: 100%;
        background: #07060a; border-left: 1px solid rgba(200,200,220,0.2);
        padding: 3rem 2rem; transform: translateX(100%);
        transition: transform .5s cubic-bezier(.16,1,.3,1);
        overflow-y: scroll; z-index: 10;
        scrollbar-color: rgba(200,200,220,0.3) #07060a; scrollbar-width: thin;
        font-family: 'Electrolize', sans-serif;
      }
      #orrery-panel.open { transform: translateX(0); }
      #orrery-panel-title {
        font-size: 0.65rem; letter-spacing: 0.3em; text-transform: uppercase;
        color: rgba(255,255,255,0.5); margin-bottom: 0.4rem;
      }
      #orrery-panel-era {
        font-size: 0.7rem; letter-spacing: 0.05em; color: rgba(255,255,255,0.3);
        margin-bottom: 1.6rem; font-style: italic;
      }
      #orrery-panel-note {
        font-size: 0.92rem; line-height: 1.85; color: rgba(220,225,240,0.68);
        white-space: pre-line;
      }
      #orrery-panel-close {
        position: absolute; top: 1.5rem; right: 1.5rem; background: none;
        border: none; color: rgba(255,255,255,0.4); font-size: 1.2rem;
        cursor: pointer; padding: .5rem; z-index: 2;
      }
      #orrery-panel-close:hover { color: rgba(255,255,255,0.9); }

      @media (max-width: 700px) {
        #orrery-panel { width: 88%; padding: 4rem 1.3rem 2rem; }
      }
      #orrery-hint, #orrery-caption {
        position: fixed; color: rgba(255,255,255,0.3);
        text-transform: uppercase; pointer-events: none; text-align: center;
        z-index: 202; font-family: 'Times New Roman', serif;
      }
      #orrery-hint {
        top: 4.5rem; right: 1.2rem; font-size: 0.55rem; letter-spacing: 0.2em;
        line-height: 1.8; text-align: right;
      }
      #orrery-caption {
        bottom: 2rem; left: 50%; transform: translateX(-50%);
        font-size: clamp(0.7rem, 1.6vw, 0.95rem); letter-spacing: 0.08em;
        white-space: nowrap; font-style: italic; text-transform: none;
        color: rgba(255,255,255,0.4);
      }
      @media (max-width: 600px) {
        #orrery-caption { white-space: normal; width: 88vw; font-size: 0.7rem; }
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Panel (full only) ────────────────────────────────────────────────────
  let panel = null, panelTitle = null, panelEra = null, panelNote = null;
  let hint = null, caption = null;
  if (!preview) {
    panel = document.createElement('aside');
    panel.id = 'orrery-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'orrery-panel-title');
    panel.innerHTML = `
      <button id="orrery-panel-close" aria-label="Close panel">✕</button>
      <div id="orrery-panel-title" tabindex="-1">✦ ${ORRERY.name}</div>
      <div id="orrery-panel-era">${ORRERY.era}</div>
      <div id="orrery-panel-note">${ORRERY.note}</div>
    `;
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.appendChild(panel);
    panelTitle = panel.querySelector('#orrery-panel-title');
    panelEra   = panel.querySelector('#orrery-panel-era');
    panelNote  = panel.querySelector('#orrery-panel-note');

    panel.addEventListener('click', e => e.stopPropagation());
    panel.querySelector('#orrery-panel-close').addEventListener('click', e => {
      e.stopPropagation();
      panel.classList.remove('open');
      setEmphasis(false);
    });

    hint = document.createElement('p');
    hint.id = 'orrery-hint';
    hint.innerHTML = 'drag to orbit &nbsp;·&nbsp; click the orrery';
    hint.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hint);

    caption = document.createElement('p');
    caption.id = 'orrery-caption';
    caption.textContent = 'still on, receiving information from the heavens';
    caption.setAttribute('aria-hidden', 'true');
    document.body.appendChild(caption);
  }

  // ─── Interaction ─────────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovered = false, selected = false;

  function setEmphasis(on) {
    orrery.glowMat.opacity = on ? 1.0 : 0.95;
    orrery.hitTarget.scale.setScalar(on ? 1.5 : 1.0);
  }

  function openPanel() {
    panel.classList.add('open');
    setTimeout(() => panelTitle.focus(), 50);
  }

  if (!preview) {
    container.addEventListener('mousemove', e => {
      const rect = container.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(orrery.hitTarget);
      const newHover = hits.length > 0;
      if (newHover !== hovered) {
        hovered = newHover;
        if (!selected) setEmphasis(hovered);
      }
      container.style.cursor = hovered ? 'pointer' : 'default';
    });

    let touchMoved = false;
    container.addEventListener('touchmove', () => { touchMoved = true; }, { passive: true });
    container.addEventListener('touchstart', () => { touchMoved = false; }, { passive: true });
    container.addEventListener('click', e => {
      if (touchMoved) { touchMoved = false; return; }
      if (panel.classList.contains('open') && !panel.contains(e.target)) {
        panel.classList.remove('open');
        selected = false;
        setEmphasis(hovered);
        return;
      }
      if (!hovered) return;
      selected = true;
      setEmphasis(true);
      openPanel();
    });
  }

  // ─── Drag to orbit ────────────────────────────────────────────────────────
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
    root.rotation.x = Math.max(-0.6, Math.min(0.6, root.rotation.x + (e.clientY - prevMouse.y) * 0.003));
    prevMouse = { x: e.clientX, y: e.clientY };
  });
  container.addEventListener('wheel', e => {
    if (panel && panel.contains(e.target)) return;
    camera.position.z = Math.max(6, Math.min(24, camera.position.z + e.deltaY * 0.01));
  });

  // ─── Animate ──────────────────────────────────────────────────────────────
  let animId, t = 0;
  function animate() {
    animId = requestAnimationFrame(animate);
    t += 0.001;

    starField.rotation.y = Math.sin(t * 0.3) * 0.04;

    orrery.orbits.forEach(o => {
      o.pivot.rotation.y += o.speed * o.direction * 0.01;
      if (o.moon) o.moon.pivot.rotation.y += o.moon.speed * 0.02;
    });
    orrery.unknowns.forEach(u => {
      u.pivot.rotation.y += u.speed * u.direction * 0.01;
      u.mesh.rotation.x += u.spin * 0.01;
      u.mesh.rotation.y += u.spin * 0.007;
    });

    // The radio telescope's received-signal pulse.
    orrery.signalMat.opacity = 0.35 + Math.abs(Math.sin(t * 4)) * 0.5;

    if (autoRotate && !isDragging) {
      root.rotation.y += preview ? 0.0011 : 0.0007;
    }

    if (!hovered && !selected) {
      orrery.hitTarget.scale.setScalar(0.9 + Math.sin(t * 12) * 0.06);
    }

    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
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
      starGeo.dispose();
      starMat.dispose();
      rafterGroup.children.forEach(l => l.geometry.dispose());
      rafterMat.dispose();
      haloMat.dispose();
      orrery.group.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      if (panel) panel.remove();
      if (hint) hint.remove();
      if (caption) caption.remove();
      renderer.domElement.remove();
    }
  };
}
