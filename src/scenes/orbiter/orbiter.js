import * as THREE from 'three';
import { poems } from './orbiter.text.js';
import { getOutboundLinks, getInboundLinks } from '../../links.js';
import {
  bindOrbitDrag, bindGuardedResize, bindTapVsDrag, prefersReducedMotion,
  onReducedMotionChange, createPanelCloser, createJumpList, escapeHtml,
  parseHTML, wireCrossLinks, formatInboundNote, setPanelSide, clickedLeftHalf,
  claimContainer, createFrameClock, trackTimers, manageRenderer, disposeSceneGraph,
} from '../../utils/sceneKit.js';
import './orbiter.css';
import orbiterHtml from './orbiter.html?raw';



const NUCLEUS_RADIUS = 0.16;

function gaussianPair() {
  const u = 1 - Math.random(); // (0,1] rather than [0,1) — Math.log(0) is -Infinity
  const v = Math.random();
  const r = Math.sqrt(-2 * Math.log(u));
  return [r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v)];
}

function makeNucleusTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const cx = c.getContext('2d');
  const g = cx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0,    '#fff8e8');
  g.addColorStop(0.35, '#ffe9b8');
  g.addColorStop(0.7,  '#e8a860');
  g.addColorStop(1,    '#7a4520');
  cx.fillStyle = g;
  cx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const r = 14 + Math.random() * 34;
    const patch = cx.createRadialGradient(x, y, 0, x, y, r);
    const bright = Math.random() > 0.5;
    patch.addColorStop(0, bright ? 'rgba(255,250,230,0.35)' : 'rgba(120,50,20,0.3)');
    patch.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = patch;
    cx.beginPath();
    cx.arc(x, y, r, 0, Math.PI * 2);
    cx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePOrbitalDotTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const cx = c.getContext('2d');
  const g = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0,    'rgba(255,255,255,1)');
  g.addColorStop(0.4,  'rgba(255,255,255,0.5)');
  g.addColorStop(1,    'rgba(255,255,255,0)');
  cx.fillStyle = g;
  cx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

function buildOrbitalCloud(preview) {
  const count = preview ? 900 : 2800;
  const A0 = 0.175;
  const R_MAX = A0 * 9; // truncation radius: e^(-9) ≈ 0.0001, so cutting the proposal distribution off here throws away a negligible sliver of the true (infinite-tailed) distribution rather than biasing it
  const F_MAX = 4 * A0 * A0 * Math.exp(-2); // the true peak of r^2*e^(-r/A0)*cos^2(theta): the radial factor peaks at r=2*A0 (value (2A0)^2*e^-2), the angular factor cos^2(theta) peaks at 1 when theta=0 (right on the lobe's axis) — multiplying the two peak values together bounds the *whole* 2D density, which is exactly what the rejection test below needs

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const base = new Float32Array(count * 3);
  const drift = [];

  const colorPos = new THREE.Color(0x78ffb4);
  const colorNeg = new THREE.Color(0xc978ff);

  function sampleUpperLobePoint() {
    let r, u, weight;
    do {
      r = Math.random() * R_MAX;
      u = Math.random();
      weight = r * r * Math.exp(-r / A0) * u * u;
    } while (Math.random() * F_MAX >= weight);
    const phi = Math.random() * Math.PI * 2; // azimuth: uniform all the way around the lobe's axis — a p-orbital has no preferred direction to spin the dumbbell around, only along it, so this angle carries no shaping information, just spreads points evenly around the tube
    const y = r * u; // height along the lobe's axis = distance * cos(theta) — plain spherical-to-Cartesian, u already IS cos(theta) so no trig call is even needed here
    const perpR = r * Math.sqrt(Math.max(0, 1 - u * u)); // distance from the axis = distance * sin(theta), via sin^2+cos^2=1 (Math.max guards a tiny negative under sqrt from floating-point error when u rounds to exactly 1)
    return { x: perpR * Math.cos(phi), y, z: perpR * Math.sin(phi), r };
  }

  const half = count / 2;
  for (let i = 0; i < half; i++) {
    const p = sampleUpperLobePoint();
    const dens = 0.35 + 0.65 * Math.min(1, (p.r * p.r * Math.exp(-p.r / A0)) / (4 * A0 * A0 * Math.exp(-2)));

    [1, -1].forEach(lobeSign => {
      const idx = lobeSign > 0 ? i : half + i;
      const x = p.x, y = p.y * lobeSign, z = p.z;
      base[idx * 3] = x; base[idx * 3 + 1] = y; base[idx * 3 + 2] = z;
      positions[idx * 3] = x; positions[idx * 3 + 1] = y; positions[idx * 3 + 2] = z;

      const col = lobeSign > 0 ? colorPos : colorNeg;
      colors[idx * 3] = col.r * dens; colors[idx * 3 + 1] = col.g * dens; colors[idx * 3 + 2] = col.b * dens;

      let dx = Math.random() * 2 - 1, dy = Math.random() * 2 - 1, dz = Math.random() * 2 - 1;
      const dl = Math.hypot(dx, dy, dz) || 1;
      dx /= dl; dy /= dl; dz /= dl;
      drift[idx] = {
        dx, dy, dz,
        phase: Math.random() * Math.PI * 2, // TUNABLE only in the sense of range (0 to 2*PI is "no bias in starting point") — this is what keeps every particle's sine wave out of sync with every other's, so the swarm shimmers rather than pulsing in unison
        speed: 0.3 + Math.random() * 0.5, // TUNABLE: how fast each particle's own oscillation cycles — raise for a jitterier/faster-shimmering cloud
        amp: 0.015 + Math.random() * 0.02, // TUNABLE: how far each particle strays from its sampled position — raise for a looser/fuzzier-looking cloud, lower to make the underlying rejection-sampled shape read more crisply
      };
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const dotTex = makePOrbitalDotTexture();
  const mat = new THREE.PointsMaterial({
    size: preview ? 0.05 : 0.045,
    map: dotTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);

  const group = new THREE.Group();
  group.add(points);

  return {
    group, points, geo, mat, dotTex, base, drift, count,
    baseOpacity: mat.opacity, phase: Math.random() * Math.PI * 2,
  };
}

function makeNucleonDotTexture(rgb) {
  const c = document.createElement('canvas');
  c.width = 24; c.height = 24;
  const cx = c.getContext('2d');
  const g = cx.createRadialGradient(12, 12, 0, 12, 12, 12);
  g.addColorStop(0,   `rgba(${rgb},1)`);
  g.addColorStop(0.5, `rgba(${rgb},0.4)`);
  g.addColorStop(1,   `rgba(${rgb},0)`);
  cx.fillStyle = g;
  cx.fillRect(0, 0, 24, 24);
  return new THREE.CanvasTexture(c);
}

function buildNucleusDetail(preview) {
  const group = new THREE.Group();

  const NUCLEON_R = NUCLEUS_RADIUS * 0.62;
  const SPREAD = NUCLEUS_RADIUS * 0.5;
  const offsets = [
    new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, -1, -1),
    new THREE.Vector3(-1, 1, -1), new THREE.Vector3(-1, -1, 1),
  ].map(v => v.normalize().multiplyScalar(SPREAD));
  const kinds = ['proton', 'neutron', 'proton', 'neutron'];
  const PROTON_RGB = '255,140,120';
  const NEUTRON_RGB = '150,180,255';
  const particleCount = preview ? 40 : 70;

  const nucleons = [];

  offsets.forEach((offset, ni) => {
    const rgb = kinds[ni] === 'proton' ? PROTON_RGB : NEUTRON_RGB;

    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const rad = NUCLEON_R * Math.cbrt(Math.min(Math.random(), Math.random()));
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = Math.random() * Math.PI * 2;
      positions[i * 3]     = offset.x + rad * Math.sin(theta) * Math.cos(phi);
      positions[i * 3 + 1] = offset.y + rad * Math.cos(theta);
      positions[i * 3 + 2] = offset.z + rad * Math.sin(theta) * Math.sin(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dotTex = makeNucleonDotTexture(rgb);
    const mat = new THREE.PointsMaterial({
      size: preview ? 0.02 : 0.016, map: dotTex, color: new THREE.Color(`rgb(${rgb})`),
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    group.add(points);

    const quarkR = NUCLEON_R * 0.4;
    const quarkAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
    const quarks = quarkAngles.map(a => {
      const qGeo = new THREE.SphereGeometry(NUCLEON_R * 0.14, 6, 6);
      const qMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(qGeo, qMat);
      const base = new THREE.Vector3(
        offset.x + Math.cos(a) * quarkR,
        offset.y + Math.sin(a) * quarkR * 0.6,
        offset.z + Math.sin(a * 1.3) * quarkR * 0.6
      );
      mesh.position.copy(base);
      group.add(mesh);
      let jx = Math.random() * 2 - 1, jy = Math.random() * 2 - 1, jz = Math.random() * 2 - 1;
      const jl = Math.hypot(jx, jy, jz) || 1;
      jx /= jl; jy /= jl; jz /= jl;
      return {
        mesh, geo: qGeo, mat: qMat, base,
        jitterDir: new THREE.Vector3(jx, jy, jz),
        jitterAmp: NUCLEON_R * 0.22,
        jitterPhase: Math.random() * Math.PI * 2,
        jitterSpeed: 0.8 + Math.random() * 0.6,
      };
    });

    const shimmerPairs = [[0, 1], [1, 2], [2, 0]];
    const shimmerLines = shimmerPairs.map(([a, b]) => {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([quarks[a].base, quarks[b].base]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      group.add(line);
      return { line, geo: lineGeo, mat: lineMat, a, b, phase: Math.random() * Math.PI * 2, speed: 1.1 + Math.random() * 0.9 };
    });

    nucleons.push({ offset, geo, mat, dotTex, points, quarks, shimmerLines });
  });

  return { group, nucleons };
}

function addRimGlow(material, colorHex, power = 2.4, glow = 0.45) {
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

function buildSatellites(preview) {
  const group = new THREE.Group();
  const count = preview ? 6 : poems.length;
  const sats = [];
  const poemOffset = Math.floor(Math.random() * poems.length);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xffd89a, emissive: 0xffd89a, emissiveIntensity: 0.4, roughness: 0.5, metalness: 0.15,
  });
  addRimGlow(bodyMat, 0xffe08a);
  const panelMat = new THREE.MeshBasicMaterial({
    color: 0x3f6fb0, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
  });
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const coreGeo = new THREE.BoxGeometry(0.026, 0.026, 0.026);
  const panelGeo = new THREE.PlaneGeometry(0.09, 0.026);

  for (let i = 0; i < count; i++) {
    const radius = 1.35 + Math.random() * 0.85; // TUNABLE: orbit radii land between 1.35 and 2.2 units out. Raising the floor (1.35) pushes every satellite farther from the cloud; raising the range (0.85) spreads them across a wider band. 1.35 isn't arbitrary though — it's the same floor A0 above was tuned against, so the orbital cloud's tail stays mostly inside it; push it down much further and satellites start passing through the cloud itself.

    const pivot = new THREE.Object3D();
    const [gx, gy] = gaussianPair();
    const [gz] = gaussianPair();
    const normal = new THREE.Vector3(gx, gy, gz).normalize();
    pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    pivot.rotateZ(Math.random() * Math.PI * 2); // free ascending-node spin around that normal — without this, every orbit's own "reference longitude" would be correlated with how `normal` itself was constructed, instead of independently random
    group.add(pivot);

    const body = new THREE.Group();
    body.add(new THREE.Mesh(coreGeo, bodyMat));
    const p1 = new THREE.Mesh(panelGeo, panelMat); p1.position.x =  0.06;
    const p2 = new THREE.Mesh(panelGeo, panelMat); p2.position.x = -0.06;
    body.add(p1, p2);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x9fffc8 });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), beaconMat);
    body.add(beacon);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), hitMat);
    body.add(hit);
    body.position.x = radius;
    pivot.add(body);

    const ringGeo = new THREE.TorusGeometry(radius, 0.002, 6, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      depthWrite: false,
      color: 0xffe08a, transparent: true, opacity: 0.045 + Math.random() * 0.065, // TUNABLE: each ring's opacity lands between 0.045 and 0.11. Raise both numbers together to make orbit paths more visible overall; widen the gap between them for more variation ring-to-ring.
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    pivot.add(ring);

    sats.push({
      pivot, body, hit, beacon, beaconMat,
      speed: (0.09 + Math.random() * 0.14) * (Math.random() < 0.5 ? 1 : -1),
      ringMat, ringGeo,
      poemIndex: (i + poemOffset) % poems.length,
    });
  }

  return { group, sats, bodyMat, panelMat, hitMat, coreGeo, panelGeo };
}

export function createOrbiter(container, { preview = false, initialPieceId = null, onPieceChange = null } = {}) {
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  camera.position.set(0, 0.6, preview ? 4.2 : 5.2);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  let contextLost = false;
  const managedRenderer = manageRenderer(renderer, {
    onLost: () => {
      contextLost = true;
      cancelAnimationFrame(animId);
      animId = null;
    },
  });
  renderer.setSize(w, h);
  renderer.setClearColor(0x0a0714, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const claim = !preview ? claimContainer(container) : null;

  const timers = trackTimers();

  let needsRender = true;

  const root = new THREE.Group();
  scene.add(root);

  scene.add(new THREE.AmbientLight(0x224422, 1.1));
  const key = new THREE.DirectionalLight(0x88ffaa, 1.1);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x44ff88, 0.5);
  rim.position.set(-4, -2, -3);
  scene.add(rim);

  const starCount = preview ? 250 : 700; // TUNABLE: pure density, no shape effect
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 20 + Math.random() * 20; // TUNABLE shell: stars land at a random distance between 20 and 40 units out — raise either number to push the whole field farther out or thicken/thin the shell
    const theta = Math.random() * Math.PI * 2; // azimuth around the vertical axis — uniform is correct here, every azimuth is equivalent by symmetry
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

  const nucleusTex = makeNucleusTexture();
  const geo = new THREE.SphereGeometry(NUCLEUS_RADIUS, preview ? 24 : 40, preview ? 24 : 40);
  const NUCLEUS_BASE_EMISSIVE = 0.55;
  const mat = new THREE.MeshStandardMaterial({
    map: nucleusTex,
    emissive: 0xffb060,
    emissiveIntensity: NUCLEUS_BASE_EMISSIVE,
    roughness: 0.6,
    transparent: true,
  });
  const earth = new THREE.Mesh(geo, mat);
  root.add(earth);

  const nucleusHitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const nucleusHit = new THREE.Mesh(new THREE.SphereGeometry(NUCLEUS_RADIUS * 1.7, 12, 12), nucleusHitMat);
  root.add(nucleusHit);

  let nucleusDetail = null;
  let nucleusRevealed = false;
  let nucleusRevealT = 0; // 0 = fully collapsed (plain sphere), 1 = fully revealed (internal detail), eased in animate()

  const aurorae = buildOrbitalCloud(preview);
  root.add(aurorae.group);

  const satellites = buildSatellites(preview);
  root.add(satellites.group);

  let title = null, hint = null, panel = null, panelTitle = null, panelContent = null, panelRefs = null, panelCloser = null, jumpList = null;
  if (!preview) {
    const shell = parseHTML(orbiterHtml);
    title = shell.querySelector('.orbiter-title');
    hint = shell.querySelector('.orbiter-hint');
    panel = shell.querySelector('.orbiter-panel');
    document.body.appendChild(title);
    document.body.appendChild(hint);

    container.appendChild(panel);
    panelTitle   = panel.querySelector('.orbiter-panel-title');
    panelContent = panel.querySelector('.orbiter-panel-content');
    panelRefs    = panel.querySelector('.orbiter-panel-refs');

    panelCloser = createPanelCloser(panel, container, {
      closeBtn: panel.querySelector('.orbiter-panel-close'),
      onClose: () => { selectedSat = null; },
    });

    panelContent.addEventListener('click', e => {
      const link = e.target.closest('.poem-link');
      if (!link) return;
      e.stopPropagation();
      navigateToPoem(link);
    });

    const NUCLEUS_JUMP_ITEM = {};
    jumpList = createJumpList(container, {
      label: 'Read a poem from one of the satellites, or look inside the nucleus',
      items: [...satellites.sats, NUCLEUS_JUMP_ITEM],
      getLabel: item => item === NUCLEUS_JUMP_ITEM ? 'Look inside the nucleus' : poems[item.poemIndex].title,
      onSelect: item => {
        if (item === NUCLEUS_JUMP_ITEM) { toggleNucleusDetail(); return; }
        selectedSat = item; openPoem(item, { fromLeft: false });
      },
    });
  }

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredSat = null, selectedSat = null, hoveredNucleus = false;
  let onContainerMouseMove = null, onContainerPointerLeave = null, onContainerClick = null;
  const touchGuard = !preview ? bindTapVsDrag(container) : null;
  const hitTargets = preview ? null : [...satellites.sats.map(s => s.hit), nucleusHit];

  function renderStanza(poemId, index, text) {
    const html = escapeHtml(text);
    const links = getOutboundLinks('orbiter', poemId, 'stanzas', index)
      .map(l => ({ ...l, phrase: escapeHtml(l.phrase) }));
    return wireCrossLinks(html, links, 'poem-link').replace(/\n/g, '<br>');
  }
  function renderPoemInto(poem) {
    panelTitle.textContent = poem.title;
    panelContent.innerHTML = poem.stanzas
      .map((st, i) => `<p>${renderStanza(poem.id, i, st)}</p>`)
      .join('');
    panelContent.scrollTop = 0;
    if (panelRefs) {
      panelRefs.textContent = formatInboundNote(
        getInboundLinks('orbiter', poem.id).map(l => poems.find(p => p.id === l.from.id)?.title)
      ) ?? '';
    }
    panelContent.querySelectorAll('.poem-link').forEach(link => {
      const delay = (Math.random() * 12).toFixed(1);
      const duration = (9 + Math.random() * 7).toFixed(1);
      link.style.animationDelay = `-${delay}s`;
      link.style.animationDuration = `${duration}s`;
      const targetPoem = link.dataset.targetScene === 'orbiter'
        ? poems.find(p => p.id === Number(link.dataset.targetId))
        : null;
      link.setAttribute('aria-label', `Follow the echo to: ${targetPoem ? targetPoem.title : 'related poem'}`);
    });
  }
  function openPoem(sat, { fromLeft } = {}) {
    const poem = poems[sat.poemIndex];
    if (!panel || !poem) return;
    onPieceChange?.(poem.id);

    const wasOpen = panel.classList.contains('open');
    const sideMismatch = fromLeft !== undefined && panel.classList.contains('from-left') !== fromLeft;

    if (wasOpen && sideMismatch) {
      panel.classList.remove('open');
      timers.after(500, () => {
        setPanelSide(panel, fromLeft);
        renderPoemInto(poem);
        panel.classList.add('open');
        focusPanelTitle();
      });
      return;
    }

    if (!wasOpen && sideMismatch) setPanelSide(panel, fromLeft);

    renderPoemInto(poem);
    panel.classList.add('open');
    focusPanelTitle();
  }
  function focusPanelTitle() { timers.nextFrame(() => panelTitle.focus()); }
  function navigateToPoem(link) {
    if (link.dataset.targetScene !== 'orbiter') return;
    const targetIdx = poems.findIndex(p => p.id === Number(link.dataset.targetId));
    if (targetIdx === -1) return;
    onPieceChange?.(poems[targetIdx].id);
    panelContent.style.transition = 'opacity .18s';
    panelTitle.style.transition = 'opacity .18s';
    panelContent.style.opacity = '0';
    panelTitle.style.opacity = '0';
    timers.after(180, () => {
      renderPoemInto(poems[targetIdx]);
      panelContent.style.opacity = '1';
      panelTitle.style.opacity = '1';
    });
  }

  function openPoemById(id) {
    const poemIdx = poems.findIndex(p => p.id === id);
    const sat = poemIdx !== -1 && satellites.sats.find(s => s.poemIndex === poemIdx);
    if (sat) { selectedSat = sat; openPoem(sat, { fromLeft: false }); }
  }
  if (!preview && initialPieceId !== null) openPoemById(initialPieceId);

  function toggleNucleusDetail() {
    if (!nucleusDetail) {
      nucleusDetail = buildNucleusDetail(preview);
      root.add(nucleusDetail.group);
    }
    nucleusRevealed = !nucleusRevealed;
  }

  if (!preview) {
    const applyHover = (hitSat, hitNucleus) => {
      if (hitSat !== hoveredSat) {
        if (hoveredSat) hoveredSat.beaconMat.color.setHex(0x9fffc8);
        hoveredSat = hitSat;
        if (hoveredSat) hoveredSat.beaconMat.color.setHex(0xffffff);
        needsRender = true; // a beacon just changed color; under reduced motion nothing else would redraw it
      }
      if (hitNucleus !== hoveredNucleus) {
        hoveredNucleus = hitNucleus;
        mat.emissiveIntensity = hoveredNucleus ? NUCLEUS_BASE_EMISSIVE * 1.8 : NUCLEUS_BASE_EMISSIVE;
        needsRender = true;
      }
      claim.setCursor((hoveredSat || hoveredNucleus) ? 'pointer' : 'default');
    };
    const pickAt = (clientX, clientY) => {
      const rect = container.getBoundingClientRect();
      mouse.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObjects(hitTargets)[0]?.object;
      applyHover(hit ? satellites.sats.find(s => s.hit === hit) ?? null : null, hit === nucleusHit);
    };
    onContainerMouseMove = e => pickAt(e.clientX, e.clientY);
    container.addEventListener('mousemove', onContainerMouseMove);
    onContainerPointerLeave = () => applyHover(null, false);
    container.addEventListener('pointerleave', onContainerPointerLeave);
    onContainerClick = e => {
      if (touchGuard.consume()) return;
      pickAt(e.clientX, e.clientY);
      if (panel.classList.contains('open') && !hoveredSat && !hoveredNucleus) {
        panelCloser.close();
        return;
      }
      if (hoveredNucleus) { toggleNucleusDetail(); return; }
      if (!hoveredSat) return;
      selectedSat = hoveredSat;
      const rect = container.getBoundingClientRect();
      openPoem(selectedSat, { fromLeft: clickedLeftHalf(e, rect) });
    };
    container.addEventListener('click', onContainerClick);
  }

  let autoRotate = true;
  let resumeRotateTimer = null;
  const orbitDrag = bindOrbitDrag(container, {
    onDragStart: () => { autoRotate = false; },
    onDrag: (dx, dy) => {
      root.rotation.y += dx;
      root.rotation.x += dy;
      needsRender = true; // the drag is the only thing moving under reduced motion
    },
    onDragEnd: () => {
      timers.cancel(resumeRotateTimer);
      resumeRotateTimer = timers.after(2500, () => { autoRotate = true; });
    },
  });

  const clock = createFrameClock();

  let reduceMotion = prefersReducedMotion();
  const reduceMotionWatch = onReducedMotionChange(v => {
    reduceMotion = v;
    clock.resync();     // don't hand the resuming frame a dt covering the whole still stretch
    needsRender = true; // going still means one last frame has to be drawn, then none
  });

  const cloudPosAttr = aurorae.geo.attributes.position;

  let animId = null, t = 0;
  function animate() {
    animId = requestAnimationFrame(animate);
    const dt = clock.tick();
    const f = dt * 60; // one "60fps frame" of time, so a per-frame constant stays itself

    if (!reduceMotion) {
      t += 0.01 * f;
      earth.rotation.y = t * (preview ? 0.06 : 0.03);
      aurorae.group.rotation.y = t * 0.008;
      satellites.sats.forEach(s => {
        s.pivot.rotation.y += s.speed * 0.01 * f;
      });
      if (autoRotate && !orbitDrag.isDragging) {
        root.rotation.y += (preview ? 0.0015 : 0.0005) * f;
      }

      for (let i = 0; i < aurorae.count; i++) {
        const d = aurorae.drift[i];
        const s = Math.sin(t * d.speed + d.phase) * d.amp;
        const i3 = i * 3;
        cloudPosAttr.array[i3]     = aurorae.base[i3]     + d.dx * s;
        cloudPosAttr.array[i3 + 1] = aurorae.base[i3 + 1] + d.dy * s;
        cloudPosAttr.array[i3 + 2] = aurorae.base[i3 + 2] + d.dz * s;
      }
      cloudPosAttr.needsUpdate = true;

      aurorae.phase += 0.012 * f;
      aurorae.mat.opacity = aurorae.baseOpacity + Math.sin(aurorae.phase) * 0.15;
    }

    const revealTarget = nucleusRevealed ? 1 : 0;
    if (nucleusRevealT !== revealTarget) {
      const gap = revealTarget - nucleusRevealT;
      nucleusRevealT = Math.abs(gap) < 0.0005 ? revealTarget : nucleusRevealT + gap * (1 - Math.pow(1 - 0.08, f));
      mat.opacity = 1 - nucleusRevealT;
      earth.visible = nucleusRevealT < 0.995;
      needsRender = true;
    }
    if (nucleusDetail && (needsRender || !reduceMotion)) {
      nucleusDetail.group.visible = nucleusRevealT > 0.005;
      if (nucleusDetail.group.visible) {
        nucleusDetail.nucleons.forEach(n => {
          n.mat.opacity = 0.75 * nucleusRevealT;
          n.quarks.forEach(q => {
            q.mat.opacity = nucleusRevealT;
            if (!reduceMotion) {
              q.jitterPhase += 0.02 * q.jitterSpeed * f;
              const s = Math.sin(q.jitterPhase) * q.jitterAmp;
              q.mesh.position.set(
                q.base.x + q.jitterDir.x * s,
                q.base.y + q.jitterDir.y * s,
                q.base.z + q.jitterDir.z * s
              );
            }
          });
          n.shimmerLines.forEach(l => {
            if (!reduceMotion) l.phase += 0.03 * l.speed * f;
            const pulse = 0.3 + 0.55 * (0.5 + 0.5 * Math.sin(l.phase));
            l.mat.opacity = pulse * nucleusRevealT;
            const qa = n.quarks[l.a], qb = n.quarks[l.b];
            const posAttr = l.geo.attributes.position;
            posAttr.setXYZ(0, qa.mesh.position.x, qa.mesh.position.y, qa.mesh.position.z);
            posAttr.setXYZ(1, qb.mesh.position.x, qb.mesh.position.y, qb.mesh.position.z);
            posAttr.needsUpdate = true;
          });
        });
      }
    }

    if (!reduceMotion || needsRender) {
      renderer.render(scene, camera);
      needsRender = false;
    }
  }
  animate();

  let paused = false;
  function setPaused(p) {
    if (p === paused || contextLost) return;
    paused = p;
    if (paused) {
      cancelAnimationFrame(animId);
      animId = null;
    } else {
      clock.resync();
      needsRender = true;
      animate();
    }
  }

  const resize = bindGuardedResize(container, (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    managedRenderer.applyPixelRatio();
    needsRender = true; // a resized drawing buffer is blank until something draws into it
  });

  return {
    openPieceById: openPoemById,
    setPaused,
    dispose() {
      cancelAnimationFrame(animId);
      timers.dispose();
      orbitDrag.dispose();
      touchGuard?.dispose();
      resize.dispose();
      reduceMotionWatch.dispose();
      panelCloser?.dispose();
      if (onContainerMouseMove) container.removeEventListener('mousemove', onContainerMouseMove);
      if (onContainerPointerLeave) container.removeEventListener('pointerleave', onContainerPointerLeave);
      if (onContainerClick) container.removeEventListener('click', onContainerClick);
      disposeSceneGraph(scene);
      managedRenderer.dispose();
      if (title) title.remove();
      if (hint) hint.remove();
      if (panel) panel.remove();
      jumpList?.dispose();
      claim?.restore();
    }
  };
}
