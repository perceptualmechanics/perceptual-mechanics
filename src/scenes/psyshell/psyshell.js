import * as THREE from 'three';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion,
  createJumpList, bindTapVsDrag, mountClippedPreviewCanvas, parseHTML,
  claimContainer, manageRenderer, createFrameClock,
  bindPersistedSoundToggle, onReducedMotionChange,
} from '../../utils/sceneKit.js';
import './psyshell.css';
import psyshellHtml from './psyshell.html?raw';
import { TEXTS, SOURCES, SOURCE_OF, FILAPIXEL_COUNT, baseEDigits } from './psyshell.text.js';
import { SEGMENTS, NUBS, BOUNDS, LENS_ID, placeFilapixels, pathToTip } from './psyshell.object.js';
import { buildWeb } from './psyshell.web.js';
import { mulberry32, hashSeed } from '../../utils/prng.js';
const rushWorkletUrl = new URL('./psyshell.rush.worklet.js', import.meta.url).href;


const ROOM_COLOR = 0x07070a;
const CRYSTAL_DEEP = 0x123a2c;   // the interior: taint, seen through the body
const CRYSTAL_RIM = 0xbfe6ff;    // where an edge catches the light
const NUB_RIM = 0xe8f4ff;
const FILAPIXEL_COLOR = 0xd8fff0;   // a strand inside the lens, and its junctions
const WEB_FAR_COLOR = 0x8fb6d8;     // a strand out in the field

const CRYSTAL_GAIN = 0.78;
const FILAPIXEL_PEAK = 3.2;
const STRAND_END = 1.0;    // brightness at a node end of a strand
const STRAND_MID = 0.12;   // and at its dark midpoint
const NEAR_GAIN = 0.42;    // the lens's own strands
const FAR_GAIN = 0.34;     // the field's — raised in 4.8.2; it was wallpaper

const PROP_SCALE = 0.42;
const PROP_SPEED = 4.3 * PROP_SCALE;    // world units per second
const PROP_SHELL = 0.24 * PROP_SCALE;   // world units — the half-width of the front
const PROP_REACH = 0.9;    // world units — the e-folding distance
const PROP_LIFE = 2.0;     // seconds
const PROP_WAKE = 0.55;    // share of the front's amplitude kept behind it
const PROP_RELAX = 0.8;    // world units — how far behind the front it persists
const MAX_READS = 5;

const HOP_SPEED = 26;      // strands per second the front crosses
const HOP_REACH = 22;      // e-folding distance, in strands
const HOP_MAX = 130;       // where a pulse is dropped rather than tracked further
const HOP_SHELL = 2.6;     // half-width of the front, in strands
const HOP_LIFE = 6.0;      // seconds — long, because 130 strands is a long way
const ESCAPE_ODDS = 100;

const AMBIENT_GAP = [3.0, 7.5];   // seconds between pulses, drawn each time
const AMBIENT_MAX = 2;            // alive at once
const AMBIENT_GAIN = 0.6;         // against a read's 1.0
const AMBIENT_WIDTH = 3.2;        // world units — the front's half-width
const AMBIENT_LIFE = 9.0;         // seconds to cross the whole field

const CASCADE_ODDS = 0.35;     // share of traffic that cascades rather than sweeps
const CASCADE_HOPS = 62;       // how far it is tracked
const CASCADE_SPEED = 13;      // strands per second — slower than a read's 26
const CASCADE_SHELL = 2.2;     // half-width of the front, in strands
const CASCADE_GAIN = 0.55;
const CASCADE_LIFE = 7.0;

const DIGIT_TIME = PROP_SHELL / PROP_SPEED;
const digitDuration = d => DIGIT_TIME * Math.exp(d - 1);
const WAVE_SPEED = 0.20 / DIGIT_TIME;  // path-lengths per second
const MAX_DIGITS = 16;
const TRANSMIT_GAIN = 0.85;

const STRIKE_GAIN = 0.16;

export function createPsyshell(container, { preview = false } = {}) {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(ROOM_COLOR);

  const camera = new THREE.PerspectiveCamera(52, w / h, 0.02, 60);

  const FIT_MARGIN = 1.06;
  const START_DROP = 0.13;   // fraction of a half-height the object sits low by
  const center = new THREE.Vector3(...BOUNDS.center);
  let lookOffsetY = 0;
  const target = new THREE.Vector3();
  let usableTop = 0, usableBottom = 1;
  let camAz = 0.7, camEl = 0.24, camZoom = 1, camDist = 4;
  const START_ZOOM = 1.55;
  const CAM_EL_MIN = -0.25, CAM_EL_MAX = 1.15;
  const ZOOM_MIN = 0.6, ZOOM_MAX = 2.6;

  function placeCamera() {
    target.set(center.x, center.y + lookOffsetY, center.z);
    camera.position.set(
      target.x + camDist * Math.cos(camEl) * Math.sin(camAz),
      target.y + camDist * Math.sin(camEl),
      target.z + camDist * Math.cos(camEl) * Math.cos(camAz));
    camera.lookAt(target);
  }

  const probes = [];
  for (const s of SEGMENTS) { probes.push(s.from, s.to); }
  for (const n of NUBS) probes.push(n.pos);
  const projV = new THREE.Vector3();
  function projectedBox() {
    const saveAz = camAz;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (let k = 0; k < 8; k++) {
      camAz = saveAz + k * Math.PI / 4;
      placeCamera();
      camera.updateMatrixWorld();
      for (const p of probes) {
        projV.set(p[0], p[1], p[2]).project(camera);
        if (projV.x < minX) minX = projV.x; if (projV.x > maxX) maxX = projV.x;
        if (projV.y < minY) minY = projV.y; if (projV.y > maxY) maxY = projV.y;
      }
    }
    camAz = saveAz;
    placeCamera();
    return { minX, maxX, minY, maxY };
  }

  function fitCamera() {
    const H = Math.max(1, container.clientHeight || window.innerHeight);
    const bandTop = 1 - 2 * usableTop / H;
    const bandBot = 1 - 2 * usableBottom / H;
    const wantH = Math.max(0.2, bandTop - bandBot);
    const wantMid = (bandTop + bandBot) / 2;
    const vHalf = (camera.fov * Math.PI / 180) / 2;

    camDist = BOUNDS.radius * 3;
    lookOffsetY = 0;
    camera.updateProjectionMatrix();
    placeCamera();

    const sizePass = () => {
      const box = projectedBox();
      if (!isFinite(box.maxY) || box.maxY <= box.minY) return;
      camDist *= Math.max((box.maxY - box.minY) / wantH, (box.maxX - box.minX) / 2.0);
      placeCamera();
    };
    const centrePass = () => {
      const box = projectedBox();
      if (!isFinite(box.maxY) || box.maxY <= box.minY) return;
      lookOffsetY += ((box.maxY + box.minY) / 2 - wantMid) * camDist * Math.tan(vHalf);
      placeCamera();
    };
    for (let round = 0; round < 3; round++) { sizePass(); sizePass(); centrePass(); centrePass(); }
    camDist = camDist * FIT_MARGIN / (camZoom * (preview ? 1 : START_ZOOM));
    if (!preview) lookOffsetY += START_DROP * camDist * Math.tan(vHalf);
    placeCamera();
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  const managedRenderer = manageRenderer(renderer);
  renderer.setSize(w, h);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';

  const previewCanvas = preview ? mountClippedPreviewCanvas(container, renderer) : null;
  if (!preview) container.appendChild(renderer.domElement);

  const containerClaim = !preview ? claimContainer(container, { cursor: 'crosshair' }) : null;
  const clock = createFrameClock();
  let reduced = prefersReducedMotion();
  let disposed = false;


  const CRYSTAL_VERT = `
    attribute float aLit;
    varying vec3 vNormalV;
    varying vec3 vViewV;
    varying float vLit;
    void main() {
      vLit = aLit;
      vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      vNormalV = normalize(normalMatrix * (mat3(instanceMatrix) * normal));
      vViewV = -mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`;
  const CRYSTAL_FRAG = `
    uniform vec3 uDeep; uniform vec3 uRim; uniform float uGain; uniform float uLitGain;
    varying vec3 vNormalV; varying vec3 vViewV; varying float vLit;
    void main() {
      float f = 1.0 - clamp(dot(normalize(vNormalV), normalize(vViewV)), 0.0, 1.0);
      f = pow(f, 2.4);
      vec3 col = mix(uDeep, uRim, f);
      vec3 lit = col * (0.30 + 0.70 * f) * uGain;
      lit += uRim * vLit * uLitGain * (0.35 + 0.65 * f);
      gl_FragColor = vec4(lit, 1.0);
    }`;
  const makeCrystalMat = rim => new THREE.ShaderMaterial({
    uniforms: {
      uDeep: { value: new THREE.Color(CRYSTAL_DEEP) },
      uRim: { value: new THREE.Color(rim) },
      uGain: { value: CRYSTAL_GAIN },
      uLitGain: { value: TRANSMIT_GAIN },
    },
    vertexShader: CRYSTAL_VERT,
    fragmentShader: CRYSTAL_FRAG,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });

  const stemGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
  const nubGeo = new THREE.IcosahedronGeometry(1, 0);
  nubGeo.setAttribute('aLit', new THREE.InstancedBufferAttribute(new Float32Array(NUBS.length), 1));
  const stemMat = makeCrystalMat(CRYSTAL_RIM);
  const nubMat = makeCrystalMat(NUB_RIM);
  const stems = new THREE.InstancedMesh(stemGeo, stemMat, SEGMENTS.length);
  const nubs = new THREE.InstancedMesh(nubGeo, nubMat, NUBS.length);
  stems.frustumCulled = false;
  nubs.frustumCulled = false;

  const lens = new THREE.Group();
  scene.add(lens);
  lens.add(stems);
  lens.add(nubs);

  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const from = new THREE.Vector3(), to = new THREE.Vector3(), dir = new THREE.Vector3();
    const mid = new THREE.Vector3(), scl = new THREE.Vector3();
    const Y = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < SEGMENTS.length; i++) {
      const s = SEGMENTS[i];
      from.set(...s.from); to.set(...s.to);
      dir.subVectors(to, from);
      const len = dir.length() || 1e-6;
      dir.divideScalar(len);
      q.setFromUnitVectors(Y, dir);
      mid.addVectors(from, to).multiplyScalar(0.5);
      scl.set(s.radius, len, s.radius);
      m.compose(mid, q, scl);
      stems.setMatrixAt(i, m);
    }
    stems.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < NUBS.length; i++) {
      const n = NUBS[i];
      m.compose(new THREE.Vector3(...n.pos), new THREE.Quaternion(), new THREE.Vector3(n.radius, n.radius, n.radius));
      nubs.setMatrixAt(i, m);
    }
    nubs.instanceMatrix.needsUpdate = true;
  }

  const placed = placeFilapixels(FILAPIXEL_COUNT);
  const web = buildWeb(placed.pos, FILAPIXEL_COUNT, { center: BOUNDS.center, radius: BOUNDS.radius });

  const levels = new Float32Array(web.total);

  function strandGeometry(pick) {
    let n = 0;
    for (let e = 0; e < web.edges.length; e += 2) if (pick(web.edges[e], web.edges[e + 1])) n++;
    const pos = new Float32Array(n * 4 * 3);
    const bright = new Float32Array(n * 4);
    const node = new Int32Array(n * 4).fill(-1);
    let v = 0;
    for (let e = 0; e < web.edges.length; e += 2) {
      const a = web.edges[e], b = web.edges[e + 1];
      if (!pick(a, b)) continue;
      const ax = web.pos[a * 3], ay = web.pos[a * 3 + 1], az = web.pos[a * 3 + 2];
      const bx = web.pos[b * 3], by = web.pos[b * 3 + 1], bz = web.pos[b * 3 + 2];
      const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
      const put = (x, y, z, br, nd) => {
        pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
        bright[v] = br; node[v] = nd; v++;
      };
      const bridge = (a < FILAPIXEL_COUNT) !== (b < FILAPIXEL_COUNT);
      const end = bridge ? STRAND_END * 0.22 : STRAND_END;
      const mid = bridge ? STRAND_MID * 0.22 : STRAND_MID;
      put(ax, ay, az, end, a);
      put(mx, my, mz, mid, -1);
      put(mx, my, mz, mid, -1);
      put(bx, by, bz, end, b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
    geo.setAttribute('aLevel', new THREE.BufferAttribute(new Float32Array(n * 4), 1));
    return { geo, node, vertexCount: n * 4, segments: n * 2 };
  }

  const strandMat = (color, gain, lit) => new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uGain: { value: gain }, uLit: { value: lit } },
    vertexShader: `
      attribute float aBright; attribute float aLevel;
      varying float vB; varying float vL;
      void main() {
        vB = aBright; vL = aLevel;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uGain; uniform float uLit;
      varying float vB; varying float vL;
      void main() {
        gl_FragColor = vec4(uColor * (vB * uGain + vL * uLit), 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });

  const nearWeb = strandGeometry((a, b) => a < FILAPIXEL_COUNT || b < FILAPIXEL_COUNT);
  const farWeb = strandGeometry((a, b) => a >= FILAPIXEL_COUNT && b >= FILAPIXEL_COUNT);
  const nearMat = strandMat(FILAPIXEL_COLOR, NEAR_GAIN, FILAPIXEL_PEAK * 0.35);
  const farMat = strandMat(WEB_FAR_COLOR, preview ? FAR_GAIN * 0.45 : FAR_GAIN, FILAPIXEL_PEAK * 0.12);
  const nearLines = new THREE.LineSegments(nearWeb.geo, nearMat);
  const farLines = new THREE.LineSegments(farWeb.geo, farMat);
  nearLines.frustumCulled = false;
  farLines.frustumCulled = false;
  lens.add(nearLines);
  scene.add(farLines);

  const nearNodeOf = nearWeb.node;
  const farNodeOf = farWeb.node;

  const adjacency = (() => {
    const count = new Uint16Array(web.total);
    for (let e = 0; e < web.edges.length; e++) count[web.edges[e]]++;
    const start = new Uint32Array(web.total + 1);
    for (let i = 0; i < web.total; i++) start[i + 1] = start[i] + count[i];
    const list = new Uint32Array(web.edges.length);
    const fill = start.slice(0, web.total);
    for (let e = 0; e < web.edges.length; e += 2) {
      const a = web.edges[e], b = web.edges[e + 1];
      list[fill[a]++] = b;
      list[fill[b]++] = a;
    }
    return { start, list };
  })();

  let audioCtx = null, muteGain = null, busGain = null;
  let soundEnabled = false;
  let soundToggleEl = null, soundLabelEl = null, srLiveEl = null;

  function buildAudioGraph() {
    if (disposed || audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    muteGain = audioCtx.createGain();
    muteGain.gain.value = 0;
    muteGain.connect(audioCtx.destination);
    busGain = audioCtx.createGain();
    busGain.gain.value = 1;
    busGain.connect(muteGain);
    loadRush();
  }

  function setSoundEnabled(on) {
    if (disposed) return;
    soundEnabled = on;
    if (on) buildAudioGraph();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (muteGain) {
      const now = audioCtx.currentTime;
      muteGain.gain.cancelScheduledValues(now);
      muteGain.gain.linearRampToValueAtTime(on ? 1 : 0, now + 0.25);
    }
    if (soundToggleEl) {
      soundToggleEl.setAttribute('aria-pressed', String(on));
      if (soundLabelEl) soundLabelEl.textContent = on ? 'Sound on' : 'Sound off';
    }
  }

  let rushNode = null;
  let rushReady = null;
  let rushFailed = false;

  function loadRush() {
    if (!audioCtx || rushNode || rushFailed) return rushReady;
    rushReady = audioCtx.audioWorklet.addModule(rushWorkletUrl).then(() => {
      if (disposed || !audioCtx || audioCtx.state === 'closed') return;
      rushNode = new AudioWorkletNode(audioCtx, 'psyshell-rush', {
        numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
      });
      rushNode.connect(busGain);
    }).catch(() => {
      rushFailed = true;
    });
    return rushReady;
  }

  const projA = new THREE.Vector3(), projB = new THREE.Vector3();
  function panForPath(index, path) {
    if (!path || !path.length) return [-0.7, 0.7];
    const tip = SEGMENTS[path[path.length - 1]].to;
    projA.set(placed.pos[index * 3], placed.pos[index * 3 + 1], placed.pos[index * 3 + 2]);
    projB.set(tip[0], tip[1], tip[2]);
    lens.updateMatrixWorld();
    projA.applyMatrix4(lens.matrixWorld).project(camera);
    projB.applyMatrix4(lens.matrixWorld).project(camera);
    const dir = projB.x >= projA.x ? 1 : -1;
    return [-0.85 * dir, 0.85 * dir];
  }

  function strike(index, tr) {
    if (!audioCtx || !soundEnabled) return;
    const y = placed.pos[index * 3 + 1];
    const t = Math.max(0, Math.min(1, (y - BOUNDS.min[1]) / Math.max(1e-6, BOUNDS.max[1] - BOUNDS.min[1])));
    const hz = 620 * Math.pow(2, -1.15 * (1 - t));
    const dur = tr ? tr.life : 0.9;
    const [panFrom, panTo] = panForPath(index, tr?.path);
    const send = () => {
      if (disposed || !rushNode || !soundEnabled) return;
      rushNode.port.postMessage({ type: 'rush', hz, gain: STRIKE_GAIN, dur, panFrom, panTo });
    };
    if (rushNode) send();
    else loadRush()?.then(send);
  }


  const nodesOfSegment = new Map();
  for (let i = 0; i < FILAPIXEL_COUNT; i++) {
    const seg = placed.seg[i];
    if (!nodesOfSegment.has(seg)) nodesOfSegment.set(seg, []);
    nodesOfSegment.get(seg).push(i);
  }

  const stemLit = new Float32Array(SEGMENTS.length);
  stemGeo.setAttribute('aLit', new THREE.InstancedBufferAttribute(stemLit, 1));

  const transmits = [];
  function armTransmitter(index) {
    const { digits } = baseEDigits(index + 1);
    const n = Math.min(digits.length, MAX_DIGITS);
    const bounds = new Float32Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) { acc += digitDuration(digits[i]); bounds[i] = acc; }

    const path = pathToTip(placed.seg[index]);
    const lengths = path.map(si => {
      const sg = SEGMENTS[si];
      return Math.hypot(sg.to[0] - sg.from[0], sg.to[1] - sg.from[1], sg.to[2] - sg.from[2]);
    });
    let totalLen = 0;
    const startAt = [];
    for (let i = 0; i < path.length; i++) { startAt.push(totalLen); totalLen += lengths[i]; }
    if (totalLen <= 0) return;

    const nodes = [];
    const nodeX = [];
    for (let i = 0; i < path.length; i++) {
      for (const nd of nodesOfSegment.get(path[i]) || []) {
        nodes.push(nd);
        nodeX.push((startAt[i] + placed.at[nd] * lengths[i]) / totalLen);
      }
    }
    const segX = path.map((_, i) => (startAt[i] + lengths[i] * 0.5) / totalLen);

    if (transmits.length >= MAX_READS) transmits.shift();
    const tr = {
      bounds, count: n, span: acc, path, segX,
      nodes: Uint16Array.from(nodes), nodeX: Float32Array.from(nodeX),
      t: 0, life: acc + (reduced ? 0 : 1 / WAVE_SPEED),
    };
    transmits.push(tr);
    return tr;
  }

  function digitLevel(tr, tp) {
    if (tp < 0) return 0;
    for (let i = 0; i < tr.count; i++) {
      if (tp < tr.bounds[i]) return (i % 2 === 0) ? 1 : 0;
    }
    return 0;
  }

  function advanceTransmitters(dt) {
    let touched = false;
    for (let i = transmits.length - 1; i >= 0; i--) {
      const tr = transmits[i];
      for (const si of tr.path) stemLit[si] = 0;
      tr.t += dt;
      if (tr.t >= tr.life) { transmits.splice(i, 1); touched = true; continue; }
    }
    for (const tr of transmits) {
      const left = 1 - tr.t / tr.life;
      const fade = left > 0.25 ? 1 : Math.max(0, left / 0.25);
      const speed = reduced ? 1e6 : WAVE_SPEED;
      for (let k = 0; k < tr.path.length; k++) {
        const lvl = digitLevel(tr, tr.t - tr.segX[k] / speed) * fade;
        if (lvl > stemLit[tr.path[k]]) stemLit[tr.path[k]] = lvl;
      }
      for (let k = 0; k < tr.nodes.length; k++) {
        const lvl = digitLevel(tr, tr.t - tr.nodeX[k] / speed) * fade;
        const nd = tr.nodes[k];
        if (lvl > levels[nd]) { levels[nd] = lvl; nearLit = true; }
      }
      touched = true;
    }
    if (touched) {
      stemGeo.getAttribute('aLit').needsUpdate = true;
      levelsDirty = true;
    }
    return touched;
  }

  const reads = [];
  const hopQueue = new Uint32Array(web.total);
  function hopsFrom(origin, cap = HOP_MAX) {
    const dist = new Int16Array(web.total).fill(-1);
    const touched = [];
    dist[origin] = 0;
    hopQueue[0] = origin;
    let head = 0, tail = 1;
    while (head < tail) {
      const u = hopQueue[head++];
      const d = dist[u];
      touched.push(u);
      if (d >= cap) continue;
      for (let k = adjacency.start[u]; k < adjacency.start[u + 1]; k++) {
        const v = adjacency.list[k];
        if (dist[v] >= 0) continue;
        dist[v] = d + 1;
        hopQueue[tail++] = v;
      }
    }
    return { dist, nodes: Uint32Array.from(touched) };
  }

  const ambient = [];
  const ambientRnd = mulberry32(hashSeed(LENS_ID + ':traffic'));
  let ambientIn = 1.2;

  function newAmbient() {
    const u = ambientRnd() * 2 - 1;
    const th = ambientRnd() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - u * u));
    const dir = [r * Math.cos(th), u * 0.45, r * Math.sin(th)];
    const m = Math.hypot(...dir) || 1;
    dir[0] /= m; dir[1] /= m; dir[2] /= m;
    const proj = new Float32Array(web.total);
    const order = new Uint32Array(web.total);
    for (let n = 0; n < web.total; n++) {
      proj[n] = web.pos[n * 3] * dir[0] + web.pos[n * 3 + 1] * dir[1] + web.pos[n * 3 + 2] * dir[2];
      order[n] = n;
    }
    const idx = Array.from(order).sort((a, b) => proj[a] - proj[b]);
    const sorted = Uint32Array.from(idx);
    const keys = new Float32Array(web.total);
    for (let i = 0; i < web.total; i++) keys[i] = proj[sorted[i]];
    const lo = keys[0], hi = keys[web.total - 1];
    return { dir, sorted, keys, from: lo - AMBIENT_WIDTH * 2, span: (hi - lo) + AMBIENT_WIDTH * 4, t: 0 };
  }

  function newCascade() {
    const origin = Math.floor(ambientRnd() * web.total);
    const { dist, nodes } = hopsFrom(origin, CASCADE_HOPS);
    const sorted = Uint32Array.from(Array.from(nodes).sort((a, b) => dist[a] - dist[b]));
    const keys = new Float32Array(sorted.length);
    for (let i = 0; i < sorted.length; i++) keys[i] = dist[sorted[i]];
    return { cascade: true, sorted, keys, t: 0 };
  }

  function stepAmbient(dt) {
    if (reduced) return;
    ambientIn -= dt;
    if (ambientIn <= 0) {
      ambientIn = AMBIENT_GAP[0] + (AMBIENT_GAP[1] - AMBIENT_GAP[0]) * ambientRnd();
      if (ambient.length >= AMBIENT_MAX) ambient.shift();
      ambient.push(ambientRnd() < CASCADE_ODDS ? newCascade() : newAmbient());
    }
    for (let i = ambient.length - 1; i >= 0; i--) {
      ambient[i].t += dt;
      if (ambient[i].t >= (ambient[i].cascade ? CASCADE_LIFE : AMBIENT_LIFE)) ambient.splice(i, 1);
    }
    for (const a of ambient) {
      if (a.cascade) {
        const front = CASCADE_SPEED * a.t;
        const fade = Math.max(0, 1 - a.t / CASCADE_LIFE);
        const gain = CASCADE_GAIN * fade * fade;
        const { keys, sorted } = a;
        const near = front - CASCADE_SHELL * 5;
        const farEdge = front + CASCADE_SHELL * 2.5;
        let lo3 = 0, hi3 = keys.length;
        while (lo3 < hi3) { const m = (lo3 + hi3) >> 1; if (keys[m] < near) lo3 = m + 1; else hi3 = m; }
        for (let i = lo3; i < keys.length && keys[i] <= farEdge; i++) {
          const n = sorted[i];
          const s0 = (keys[i] - front) / CASCADE_SHELL;
          const amp = (s0 > 0 ? Math.exp(-s0 * s0) : Math.exp(s0 * 0.7)) * gain;
          if (amp > levels[n]) {
            levels[n] = amp;
            if (n >= FILAPIXEL_COUNT) farLit = true; else nearLit = true;
          }
        }
        continue;
      }
      const u = a.t / AMBIENT_LIFE;
      const front = a.from + a.span * u;
      const fade = Math.sin(Math.PI * u);
      const gain = AMBIENT_GAIN * fade * fade;
      const near = front - AMBIENT_WIDTH * 7;
      const farEdge = front + AMBIENT_WIDTH * 2.5;
      const { keys, sorted } = a;
      let lo2 = 0, hi2 = keys.length;
      while (lo2 < hi2) { const m = (lo2 + hi2) >> 1; if (keys[m] < near) lo2 = m + 1; else hi2 = m; }
      for (let i = lo2; i < keys.length && keys[i] <= farEdge; i++) {
        const n = sorted[i];
        const s0 = (keys[i] - front) / AMBIENT_WIDTH;
        const amp = (s0 > 0 ? Math.exp(-s0 * s0) : Math.exp(s0 * 0.55)) * gain;
        if (amp > levels[n]) levels[n] = amp;
        if (n >= FILAPIXEL_COUNT) farLit = true; else nearLit = true;
      }
    }
  }

  function readAt(index) {
    const escapes = Math.floor(Math.random() * ESCAPE_ODDS) === 0;
    reads.push({ origin: index, t: 0, hop: escapes ? hopsFrom(index) : null });
    if (reads.length > MAX_READS) reads.shift();
    strike(index, armTransmitter(index));
  }

  function advance(dt) {
    for (let i = reads.length - 1; i >= 0; i--) {
      reads[i].t += dt;
      if (reads[i].t >= (reads[i].hop ? HOP_LIFE : PROP_LIFE)) reads.splice(i, 1);
    }
    for (const d of reads) {
      if (!reduced && d.hop) {
        const hopFront = HOP_SPEED * d.t;
        const hopFade = Math.max(0, 1 - d.t / HOP_LIFE);
        const { dist, nodes } = d.hop;
        for (let k = 0; k < nodes.length; k++) {
          const n = nodes[k];
          const h = dist[n];
          const s0 = (h - hopFront) / HOP_SHELL;
          const shell = Math.exp(-s0 * s0);
          const wake = h > hopFront ? 0 : 0.35 * Math.exp(-(hopFront - h) / (HOP_SHELL * 6));
          const amp = Math.min(1, shell + wake) * Math.exp(-h / HOP_REACH) * hopFade * hopFade;
          if (amp > levels[n]) {
            levels[n] = amp;
            if (n >= FILAPIXEL_COUNT) farLit = true; else nearLit = true;
          }
        }
      }

      if (d.t >= PROP_LIFE) continue;
      const decay = 1 - d.t / PROP_LIFE;
      const fade = decay * decay;
      const front = reduced ? 0 : PROP_SPEED * d.t;
      const ox = placed.pos[d.origin * 3], oy = placed.pos[d.origin * 3 + 1], oz = placed.pos[d.origin * 3 + 2];
      for (let i = 0; i < FILAPIXEL_COUNT; i++) {
        const dx = placed.pos[i * 3] - ox, dy = placed.pos[i * 3 + 1] - oy, dz = placed.pos[i * 3 + 2] - oz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const s0 = reduced ? 0 : (dist - front) / PROP_SHELL;
        const shell = reduced ? 1 : Math.exp(-s0 * s0);
        const wake = reduced || dist > front ? 0 : PROP_WAKE * Math.exp(-(front - dist) / PROP_RELAX);
        const amp = Math.min(1, shell + wake) * Math.exp(-dist / PROP_REACH) * fade;
        if (amp > levels[i]) { levels[i] = amp; nearLit = true; }
      }
    }
  }


  let levelsDirty = false;
  let nearLit = false, farLit = false;
  let nearWasLit = false, farWasLit = false;
  function writeLevels() {
    const halves = [];
    if (nearLit || nearWasLit) halves.push([nearWeb, nearNodeOf]);
    if (farLit || farWasLit) halves.push([farWeb, farNodeOf]);
    for (const [mesh, nodeOf] of halves) {
      const attr = mesh.geo.getAttribute('aLevel');
      const arr = attr.array;
      for (let v = 0; v < nodeOf.length; v++) {
        const n = nodeOf[v];
        arr[v] = n < 0 ? 0 : levels[n];
      }
      attr.needsUpdate = true;
    }
    nearWasLit = nearLit; farWasLit = farLit;
    nearLit = false; farLit = false;
  }
  writeLevels();

  let titleEl = null, hintEl = null, ordinalEl = null, jumpList = null, soundToggle = null;
  const srSay = msg => { if (srLiveEl) srLiveEl.textContent = msg; };

  function showRead(index) {
    const src = SOURCES[SOURCE_OF[index]];
    if (ordinalEl) {
      ordinalEl.hidden = false;
      ordinalEl.textContent = `${index + 1} / ${FILAPIXEL_COUNT}`;
      placeOrdinal();
    }
    srSay(`Filapixel ${index + 1} of ${FILAPIXEL_COUNT}, from ${src.label}. ${TEXTS[index]}`);
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let touchGuard = null, orbitDrag = null, wheelZoom = null, resizeCtl = null, reducedWatch = null;

  function nearestFilapixel(point) {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < FILAPIXEL_COUNT; i++) {
      const dx = placed.pos[i * 3] - point.x, dy = placed.pos[i * 3 + 1] - point.y, dz = placed.pos[i * 3 + 2] - point.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function onClick(ev) {
    if (touchGuard?.consume()) return;
    if (ev.target.closest?.('.pm-jumplist, .psyshell-sound-toggle')) return;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects([stems, nubs], false);
    if (!hits.length) return;
    const index = nearestFilapixel(hits[0].point);
    if (index < 0) return;
    readAt(index);
    showRead(index);
  }

  if (!preview) {
    const frag = parseHTML(psyshellHtml);
    titleEl = frag.querySelector('.psyshell-title');
    hintEl = frag.querySelector('.psyshell-hint');
    ordinalEl = frag.querySelector('.psyshell-ordinal');
    soundToggleEl = frag.querySelector('.psyshell-sound-toggle');
    soundLabelEl = frag.querySelector('.psyshell-sound-label');
    srLiveEl = frag.querySelector('.psyshell-sr-live');
    document.body.append(titleEl, hintEl, ordinalEl, soundToggleEl, srLiveEl);

    soundToggle = bindPersistedSoundToggle(container, soundToggleEl, setSoundEnabled, 'psyshell');

    jumpList = createJumpList(container, {
      label: 'What the lens holds, by scene',
      items: SOURCES,
      getLabel: s => `${s.label} — ${s.count}`,
      onSelect: src => { readAt(src.first); showRead(src.first); },
    });

    touchGuard = bindTapVsDrag(container);
    orbitDrag = bindOrbitDrag(container, {
      onDrag: (dx, dy) => {
        camAz -= dx;
        camEl = Math.max(CAM_EL_MIN, Math.min(CAM_EL_MAX, camEl + dy));
        placeCamera();
      },
    });
    wheelZoom = bindWheelZoom(container, {
      onZoom: dy => {
        camZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, camZoom * (1 - dy * 0.0012)));
        fitCamera();
      },
    });
    container.addEventListener('click', onClick);
    reducedWatch = onReducedMotionChange(next => { reduced = next; clock.resync(); });
  }

  function relayout() {
    const H = Math.max(1, container.clientHeight || window.innerHeight);
    if (preview || !hintEl || !titleEl) { usableTop = 0; usableBottom = H; fitCamera(); return; }
    const rect = container.getBoundingClientRect();
    const hintBox = hintEl.getBoundingClientRect();
    const titleBox = titleEl.getBoundingClientRect();
    usableTop = Math.max(0, hintBox.bottom + 10 - rect.top);
    usableBottom = Math.min(H, titleBox.top - 12 - rect.top);
    if (usableBottom - usableTop < H * 0.3) { usableTop = 0; usableBottom = H; }
    fitCamera();

    placeOrdinal(titleBox);
  }

  function placeOrdinal(titleBox) {
    if (!ordinalEl || ordinalEl.hidden) return;
    const box = titleBox ?? titleEl?.getBoundingClientRect();
    if (!box) return;
    const ordBox = ordinalEl.getBoundingClientRect();
    if (!ordBox.width && !ordBox.height) return;
    const overlaps = ordBox.left < box.right + 10 && ordBox.top < box.bottom;
    ordinalEl.style.bottom = overlaps ? `${Math.round(window.innerHeight - box.top + 10)}px` : '';
  }

  resizeCtl = bindGuardedResize(container, (cw, ch) => {
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();
    managedRenderer.applyPixelRatio();
    renderer.setSize(cw, ch);
    relayout();
  });

  let animId = null;
  let paused = false;
  const IDLE_TURN = 0.048;

  function animate() {
    animId = requestAnimationFrame(animate);
    const dt = clock.tick();
    if (!reduced) {
      camAz += IDLE_TURN * (preview ? 1.5 : 1) * dt;
      placeCamera();
    }
    const active = reads.length > 0 || transmits.length > 0 || ambient.length > 0 || !reduced;
    if (active || levelsDirty) levels.fill(0);
    if (reads.length) advance(dt);
    stepAmbient(dt);
    const transmitting = advanceTransmitters(dt);
    if (active || levelsDirty) {
      writeLevels();
      levelsDirty = reads.length > 0 || transmitting || ambient.length > 0;
    }
    renderer.render(scene, camera);
    previewCanvas?.blit();
  }

  relayout();
  if (!preview && document.fonts?.ready) {
    document.fonts.ready.then(() => { if (!disposed) relayout(); }).catch(() => {});
  }
  animate();

  return {
    setPaused(next) {
      const want = Boolean(next);
      if (want === paused) return;
      paused = want;
      if (paused) {
        if (animId !== null) { cancelAnimationFrame(animId); animId = null; }
      } else {
        clock.resync();
        if (animId === null) animate();
      }
    },
    dispose() {
      disposed = true;
      if (animId !== null) cancelAnimationFrame(animId);
      reads.length = 0;
      resizeCtl?.dispose();
      orbitDrag?.dispose();
      wheelZoom?.dispose();
      touchGuard?.dispose();
      reducedWatch?.dispose();
      soundToggle?.dispose();
      jumpList?.dispose();
      if (!preview) container.removeEventListener('click', onClick);
      titleEl?.remove(); hintEl?.remove(); ordinalEl?.remove();
      soundToggleEl?.remove(); srLiveEl?.remove();
      if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
      muteGain = busGain = null;
      soundEnabled = false;
      if (rushNode) {
        try { rushNode.port.onmessage = null; rushNode.port.close(); } catch {  }
        try { rushNode.disconnect(); } catch {  }
        rushNode = null;
      }
      transmits.length = 0;
      stemGeo.dispose(); nubGeo.dispose(); stemMat.dispose(); nubMat.dispose();
      stems.dispose(); nubs.dispose();
      nearWeb.geo.dispose(); farWeb.geo.dispose(); nearMat.dispose(); farMat.dispose();
      previewCanvas?.dispose();
      managedRenderer.dispose();
      containerClaim?.restore();
    },
  };
}
