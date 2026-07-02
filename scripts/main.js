import * as THREE from 'three';
import { fragments } from './text';

// ─── Scene setup ─────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.z = 4;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("sphere").appendChild(renderer.domElement);

// ─── Lighting ────────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0x8899cc, 0.4);
scene.add(ambientLight);

const rimLight = new THREE.DirectionalLight(0x6688ff, 0.8);
rimLight.position.set(-3, 2, -2);
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
fillLight.position.set(2, -1, 3);
scene.add(fillLight);

// ─── Geodesic sphere ─────────────────────────────────────────────────────────
const detail = 2; // geodesic detail level — increase for more facets
const geoBase = new THREE.IcosahedronGeometry(1.5, detail);

// We need non-indexed geometry so each face can have its own color
const geo = geoBase.toNonIndexed();
const faceCount = geo.attributes.position.count / 3;

// Assign a fragment index to each face
const fragmentIndices = new Float32Array(geo.attributes.position.count);
for (let i = 0; i < faceCount; i++) {
  const fi = i % fragments.length;
  fragmentIndices[i * 3] = fi;
  fragmentIndices[i * 3 + 1] = fi;
  fragmentIndices[i * 3 + 2] = fi;
}
geo.setAttribute('fragmentIndex', new THREE.BufferAttribute(fragmentIndices, 1));

// Per-vertex color for hover/select state
const colors = new Float32Array(geo.attributes.position.count * 3);
const defaultColor = new THREE.Color(0x1a2540);
const hoverColor = new THREE.Color(0x3a5090);
const selectedColor = new THREE.Color(0x5a70c0);

for (let i = 0; i < geo.attributes.position.count; i++) {
  colors[i * 3] = defaultColor.r;
  colors[i * 3 + 1] = defaultColor.g;
  colors[i * 3 + 2] = defaultColor.b;
}
geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const mat = new THREE.MeshPhongMaterial({
  vertexColors: true,
  shininess: 60,
  specular: new THREE.Color(0x334488),
  wireframe: false,
});

const sphere = new THREE.Mesh(geo, mat);
scene.add(sphere);

// Wireframe overlay
const wireMat = new THREE.MeshBasicMaterial({
  color: 0x3355aa,
  wireframe: true,
  transparent: true,
  opacity: 0.15,
});
const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.502, detail), wireMat);
scene.add(wire);

// ─── Interaction ──────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredFace = -1;
let selectedFace = -1;
const panel = document.getElementById('panel');
const panelContent = document.getElementById('panel-content');
const panelTitle = document.getElementById('panel-title');
const facetIdEl = document.getElementById('facet-id');

function setFaceColor(faceIndex, color) {
  const i = faceIndex * 9;
  const c = colors;
  c[i]   = color.r; c[i+1] = color.g; c[i+2] = color.b;
  c[i+3] = color.r; c[i+4] = color.g; c[i+5] = color.b;
  c[i+6] = color.r; c[i+7] = color.g; c[i+8] = color.b;
  geo.attributes.color.needsUpdate = true;
}

function getFaceColor(faceIndex) {
  if (faceIndex === selectedFace) return selectedColor;
  return defaultColor;
}

window.addEventListener('mousemove', e => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(sphere);

  const newHover = hits.length > 0 ? hits[0].faceIndex : -1;

  if (newHover !== hoveredFace) {
    if (hoveredFace !== -1 && hoveredFace !== selectedFace) {
      setFaceColor(hoveredFace, defaultColor);
    }
    hoveredFace = newHover;
    if (hoveredFace !== -1 && hoveredFace !== selectedFace) {
      setFaceColor(hoveredFace, hoverColor);
    }
  }

  document.body.style.cursor = hoveredFace !== -1 ? 'pointer' : 'default';
});

window.addEventListener('click', e => {
  if (hoveredFace === -1) return;

  if (selectedFace !== -1 && selectedFace !== hoveredFace) {
    setFaceColor(selectedFace, defaultColor);
  }

  selectedFace = hoveredFace;
  setFaceColor(selectedFace, selectedColor);

  // Find fragment for this face
  const fi = selectedFace % fragments.length;
  const fragment = fragments[fi];

  panelTitle.textContent = fragment.title;
  panelContent.textContent = fragment.text;
  facetIdEl.textContent = `Facet ${selectedFace} · Fragment ${fi + 1} of ${fragments.length}`;
  panel.classList.add('open');
});

document.getElementById('panel-close').addEventListener('click', () => {
  panel.classList.remove('open');
  if (selectedFace !== -1) {
    setFaceColor(selectedFace, defaultColor);
    selectedFace = -1;
  }
});

// ─── Zoom ─────────────────────────────────────────────────────────────────────
window.addEventListener('wheel', e => {
  camera.position.z = Math.max(1.8, Math.min(6, camera.position.z + e.deltaY * 0.005));
});

// ─── Drag to rotate ───────────────────────────────────────────────────────────
let isDragging = false;
let prevMouse = { x: 0, y: 0 };
let autoRotate = true;
let rotVel = { x: 0, y: 0.002 };

window.addEventListener('mousedown', e => {
  isDragging = true;
  autoRotate = false;
  prevMouse = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mouseup', () => {
  isDragging = false;
  // Gradually re-enable auto rotation
  setTimeout(() => { autoRotate = true; }, 2000);
});

window.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const dx = e.clientX - prevMouse.x;
  const dy = e.clientY - prevMouse.y;
  rotVel.y = dx * 0.005;
  rotVel.x = dy * 0.005;
  sphere.rotation.y += rotVel.y;
  sphere.rotation.x += rotVel.x;
  wire.rotation.y = sphere.rotation.y;
  wire.rotation.x = sphere.rotation.x;
  prevMouse = { x: e.clientX, y: e.clientY };
});

// ─── Resize ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Animate ──────────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);

  if (autoRotate) {
    sphere.rotation.y += 0.0015;
    sphere.rotation.x += 0.0003;
    wire.rotation.y = sphere.rotation.y;
    wire.rotation.x = sphere.rotation.x;
  }

  renderer.render(scene, camera);
}

animate();
