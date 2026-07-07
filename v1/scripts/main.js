import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { fragments } from './text.js';

// ─── Scene setup ─────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 3.8;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("sphere").appendChild(renderer.domElement);

// ─── CSS2D renderer ───────────────────────────────────────────────────────────
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.left = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
document.getElementById("sphere").appendChild(labelRenderer.domElement);

// ─── Lighting ────────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xc8d8ff, 1.1);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
keyLight.position.set(4, 3, 4);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x88aaff, 0.8);
rimLight.position.set(-4, 1, -3);
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0xffd8aa, 0.4);
fillLight.position.set(1, -3, 2);
scene.add(fillLight);

// ─── Geodesic geometry ───────────────────────────────────────────────────────
const detail = 2;
const geoBase = new THREE.IcosahedronGeometry(1.4, detail);
const geo = geoBase.toNonIndexed();
const faceCount = geo.attributes.position.count / 3;

// ─── Fragment index attribute ─────────────────────────────────────────────────
const fragmentIndices = new Float32Array(geo.attributes.position.count);
for (let i = 0; i < faceCount; i++) {
  const fi = i % fragments.length;
  fragmentIndices[i * 3]     = fi;
  fragmentIndices[i * 3 + 1] = fi;
  fragmentIndices[i * 3 + 2] = fi;
}
geo.setAttribute('fragmentIndex', new THREE.BufferAttribute(fragmentIndices, 1));

// ─── Facet palette ────────────────────────────────────────────────────────────
const palette = [
  new THREE.Color(0x4a7fb5),
  new THREE.Color(0x5d9bc7),
  new THREE.Color(0x3a6a9a),
  new THREE.Color(0x6aadd4),
  new THREE.Color(0x4e8ab8),
  new THREE.Color(0x7ab8d8),
];

const colors = new Float32Array(geo.attributes.position.count * 3);
for (let i = 0; i < faceCount; i++) {
  const base  = palette[i % palette.length].clone();
  const nudge = ((i * 13) % 7) / 40;
  base.r = Math.min(1, base.r + nudge);
  base.g = Math.min(1, base.g + nudge * 0.5);
  base.b = Math.min(1, base.b - nudge * 0.2);
  for (let v = 0; v < 3; v++) {
    const vi = (i * 3 + v) * 3;
    colors[vi]     = base.r;
    colors[vi + 1] = base.g;
    colors[vi + 2] = base.b;
  }
}
const baseColors = colors.slice();
geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

// ─── Main sphere ──────────────────────────────────────────────────────────────
const mat = new THREE.MeshPhongMaterial({
  vertexColors: true,
  shininess: 40,
  specular: new THREE.Color(0x334466),
});
const sphere = new THREE.Mesh(geo, mat);
scene.add(sphere);

// ─── Wireframe overlay ────────────────────────────────────────────────────────
const wireMat = new THREE.MeshBasicMaterial({
  color: 0x4466aa,
  wireframe: true,
  transparent: true,
  opacity: 0.5,
});
const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.403, detail), wireMat);
scene.add(wire);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
}

function randomExcerpt(fi) {
  const plain = stripHtml(fragments[fi].text);
  if (plain.length <= 40) return plain;
  const maxStart = Math.max(0, plain.length - 60);
  const start = Math.floor(Math.random() * maxStart);
  const wordStart = plain.indexOf(' ', start);
  const from = wordStart === -1 ? start : wordStart + 1;
  return plain.slice(from, from + 55);
}

// ─── Label styles ─────────────────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
  @keyframes wisp {
    0%   { opacity: var(--base-opacity, 0); }
    30%  { opacity: calc(var(--base-opacity, 0.12) * 0.3); }
    60%  { opacity: calc(var(--base-opacity, 0.12)); }
    80%  { opacity: calc(var(--base-opacity, 0.12) * 0.6); }
    100% { opacity: var(--base-opacity, 0); }
  }

  .face-label {
    color: rgba(255, 255, 255, 1.0);
    font-family: 'Electrolize', serif;
    font-size: 7px;
    line-height: 1.4;
    width: 60px;
    height: 52px;
    text-align: center;
    pointer-events: none;
    user-select: none;
    word-wrap: break-word;
    overflow: hidden;
    white-space: normal;
    animation: wisp var(--duration, 30s) ease-in-out infinite;
    animation-delay: var(--delay, 0s);
    transform-origin: center center;
    filter: blur(5%);
  }
`;
document.head.appendChild(style);

// ─── CSS2D labels ─────────────────────────────────────────────────────────────
const pos = geo.attributes.position;
const labelData = []; // { label, normal, upVec, div }

for (let i = 0; i < faceCount; i++) {
  const fi = i % fragments.length;

  const a = new THREE.Vector3().fromBufferAttribute(pos, i * 3);
  const b = new THREE.Vector3().fromBufferAttribute(pos, i * 3 + 1);
  const c = new THREE.Vector3().fromBufferAttribute(pos, i * 3 + 2);
  const center = new THREE.Vector3().addVectors(a, b).add(c).divideScalar(3);

  // Face normal (outward)
  const edge1 = new THREE.Vector3().subVectors(b, a);
  const edge2 = new THREE.Vector3().subVectors(c, a);
  const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

  // "Up" direction for this face — from center toward vertex A, projected
  // onto the face plane (perpendicular to normal)
  const toA = new THREE.Vector3().subVectors(a, center).normalize();
  const upVec = toA.clone().addScaledVector(normal, -toA.dot(normal)).normalize();

  const div = document.createElement('div');
  div.className = 'face-label';
  div.textContent = randomExcerpt(fi);
  div.style.setProperty('--duration', `${4 + Math.random() * 16}s`);
  div.style.setProperty('--delay',    `${-Math.random() * 16}s`);

  const label = new CSS2DObject(div);
  label.position.copy(center.clone().multiplyScalar(1.01));
  sphere.add(label);

  labelData.push({ label, normal, upVec, div });
}

// ─── Interaction colors ───────────────────────────────────────────────────────
const hoverColor    = new THREE.Color(0xf0c060);
const selectedColor = new THREE.Color(0xf5a020);

function setFaceColor(faceIndex, color) {
  for (let v = 0; v < 3; v++) {
    const vi = (faceIndex * 3 + v) * 3;
    colors[vi]     = color.r;
    colors[vi + 1] = color.g;
    colors[vi + 2] = color.b;
  }
  geo.attributes.color.needsUpdate = true;
}

function restoreFaceColor(faceIndex) {
  for (let v = 0; v < 3; v++) {
    const vi = (faceIndex * 3 + v) * 3;
    colors[vi]     = baseColors[vi];
    colors[vi + 1] = baseColors[vi + 1];
    colors[vi + 2] = baseColors[vi + 2];
  }
  geo.attributes.color.needsUpdate = true;
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const raycaster    = new THREE.Raycaster();
const mouse        = new THREE.Vector2();
let hoveredFace    = -1;
let selectedFace   = -1;
const panel        = document.getElementById('panel');
const panelContent = document.getElementById('panel-content');
const panelTitle   = document.getElementById('panel-title');
const facetIdEl    = document.getElementById('facet-id');

window.addEventListener('mousemove', e => {
  mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits     = raycaster.intersectObject(sphere);
  const newHover = hits.length > 0 ? hits[0].faceIndex : -1;

  if (newHover !== hoveredFace) {
    if (hoveredFace !== -1 && hoveredFace !== selectedFace) restoreFaceColor(hoveredFace);
    hoveredFace = newHover;
    if (hoveredFace !== -1 && hoveredFace !== selectedFace) setFaceColor(hoveredFace, hoverColor);
  }

  document.body.style.cursor = hoveredFace !== -1 ? 'pointer' : 'default';
});

// ─── Touch to rotate ──────────────────────────────────────────────────────────
window.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    isDragging = true;
    autoRotate = false;
    prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
}, { passive: true });

window.addEventListener('touchend', () => {
  isDragging = false;
  setTimeout(() => { autoRotate = true; }, 2000);
});

window.addEventListener('touchmove', e => {
  if (!isDragging || e.touches.length !== 1) return;
  sphere.rotation.y += (e.touches[0].clientX - prevMouse.x) * 0.005;
  sphere.rotation.x += (e.touches[0].clientY - prevMouse.y) * 0.005;
  wire.rotation.copy(sphere.rotation);
  prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });

// ─── Touch to click a facet ───────────────────────────────────────────────────
window.addEventListener('touchend', e => {
  if (e.changedTouches.length !== 1) return;
  const touch = e.changedTouches[0];
  mouse.x =  (touch.clientX / window.innerWidth)  * 2 - 1;
  mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(sphere);
  if (hits.length === 0) return;

  const fi = hits[0].faceIndex;
  if (selectedFace !== -1 && selectedFace !== fi) restoreFaceColor(selectedFace);
  selectedFace = fi;
  setFaceColor(selectedFace, selectedColor);

  const fragIndex = selectedFace % fragments.length;
  const fragment  = fragments[fragIndex];
  panelTitle.textContent = fragment.title;
  panelContent.innerHTML = fragment.text;
  facetIdEl.textContent  = `Facet ${selectedFace} · Fragment ${fragIndex + 1} of ${fragments.length}`;
  panel.classList.add('open');
});

window.addEventListener('click', e => {
  // Close panel if clicking outside it
  if (panel.classList.contains('open') && !panel.contains(e.target)) {
    panel.classList.remove('open');
    if (selectedFace !== -1) {
      restoreFaceColor(selectedFace);
      selectedFace = -1;
    }
    return;
  }

  if (hoveredFace === -1) return;
  if (selectedFace !== -1 && selectedFace !== hoveredFace) restoreFaceColor(selectedFace);

  selectedFace = hoveredFace;
  setFaceColor(selectedFace, selectedColor);

  const fi       = selectedFace % fragments.length;
  const fragment = fragments[fi];

  panelTitle.textContent = fragment.title;
  panelContent.innerHTML = fragment.text;
  facetIdEl.textContent  = `Facet ${selectedFace} · Fragment ${fi + 1} of ${fragments.length}`;
  panel.classList.add('open');
});

panel.addEventListener('click', e => { e.stopPropagation(); });

document.getElementById('panel-close').addEventListener('click', e => {
  e.stopPropagation();
  panel.classList.remove('open');
  if (selectedFace !== -1) {
    restoreFaceColor(selectedFace);
    selectedFace = -1;
  }
});

window.addEventListener('wheel', e => {
  if (panel.contains(e.target)) return;
  camera.position.z = Math.max(1.8, Math.min(6, camera.position.z + e.deltaY * 0.005));
});

let isDragging = false;
let prevMouse  = { x: 0, y: 0 };
let autoRotate = true;

window.addEventListener('mousedown', e => {
  isDragging = true;
  autoRotate = false;
  prevMouse  = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mouseup', () => {
  isDragging = false;
  setTimeout(() => { autoRotate = true; }, 2000);
});

window.addEventListener('mousemove', e => {
  if (!isDragging) return;
  sphere.rotation.y += (e.clientX - prevMouse.x) * 0.005;
  sphere.rotation.x += (e.clientY - prevMouse.y) * 0.005;
  wire.rotation.copy(sphere.rotation);
  prevMouse = { x: e.clientX, y: e.clientY };
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Reusable vectors for frame loop ─────────────────────────────────────────
const cameraDir  = new THREE.Vector3();
const worldNormal = new THREE.Vector3();
const worldUp    = new THREE.Vector3();
const normalMatrix = new THREE.Matrix3();

// Project a 3D world point to 2D screen coords
function projectToScreen(vec3) {
  const v = vec3.clone().project(camera);
  return {
    x: ( v.x * 0.5 + 0.5) * window.innerWidth,
    y: (-v.y * 0.5 + 0.5) * window.innerHeight,
  };
}

// ─── Animate ──────────────────────────────────────────────────────────────────
let lightAngle = 0;

function animate() {
  requestAnimationFrame(animate);

  if (autoRotate) {
    sphere.rotation.y += 0.0015;
    sphere.rotation.x += 0.0003;
    wire.rotation.copy(sphere.rotation);
  }

  lightAngle += 0.003;
  keyLight.position.set(Math.cos(lightAngle) * 5, 3, Math.sin(lightAngle) * 5);
  rimLight.position.set(
    Math.cos(lightAngle + Math.PI) * 4,
    Math.sin(lightAngle * 0.7) * 2,
    Math.sin(lightAngle + Math.PI) * 4
  );
  fillLight.position.set(Math.sin(lightAngle * 0.5) * 3, -3, Math.cos(lightAngle * 0.5) * 3);

  // Update labels: cull back-faces, compute screen-space rotation
  camera.getWorldDirection(cameraDir);
  normalMatrix.getNormalMatrix(sphere.matrixWorld);

  for (const { label, normal, upVec, div } of labelData) {
    // Transform normal to world space
    worldNormal.copy(normal).applyMatrix3(normalMatrix).normalize();
    const dot = worldNormal.dot(cameraDir);
    // Scale text with camera distance
    const camDist = camera.position.z;
    const scale = Math.max(0.5, Math.min(3.0, 3.8 / camDist));
    div.style.fontSize = `${(7 * scale).toFixed(1)}px`;
    div.style.width    = `${(60 * scale).toFixed(0)}px`;
    div.style.height   = `${(52 * scale).toFixed(0)}px`;

    if (dot < -0.1) {
      // Face is visible — compute opacity
      const opacity = Math.min(0.25, (-dot - 0.1) * 0.35);
      div.style.setProperty('--base-opacity', opacity.toFixed(3));
      div.style.visibility = 'visible';
      label.visible = true;

      // Compute screen-space rotation from face "up" vector
      // Transform face center and face center + upVec to world space, then screen space
      const centerWorld = label.position.clone().applyMatrix4(sphere.matrixWorld);
      worldUp.copy(upVec).applyMatrix3(normalMatrix).normalize();
      const tipWorld = centerWorld.clone().addScaledVector(worldUp, 0.15);

      const centerScreen = projectToScreen(centerWorld);
      const tipScreen    = projectToScreen(tipWorld);

      const dx = tipScreen.x - centerScreen.x;
      const dy = tipScreen.y - centerScreen.y;
      const angle = Math.atan2(dx, -dy) * (180 / Math.PI);

      div.style.transform = `rotate(${angle.toFixed(1)}deg)`;
    } else {
      div.style.visibility = 'hidden';
      label.visible = false;
    }
  }

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

animate();