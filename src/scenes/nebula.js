import * as THREE from 'three';

// ─── Nebula: The Gaze ─────────────────────────────────────────────────────────
// Stars as links, constellations as relationships.
// Each star is a URL — mostly YouTube videos.
// Drawn constellations, not algorithmic.
// Webb/Hubble imagery as background.
// Coming soon.

export function createNebula(container, { preview = false } = {}) {
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(60, w / h, 0.1, 500);
  camera.position.z = preview ? 3 : 5;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  // Placeholder: deep field of drifting points
  const starCount = preview ? 400 : 1200;
  const positions = new Float32Array(starCount * 3);
  const sizes     = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * (preview ? 6 : 20);
    positions[i * 3 + 1] = (Math.random() - 0.5) * (preview ? 6 : 20);
    positions[i * 3 + 2] = (Math.random() - 0.5) * (preview ? 2 : 8);
    sizes[i] = Math.random() * (preview ? 1.5 : 2.5) + 0.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    color: 0xddeeff,
    size: preview ? 0.04 : 0.08,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
  });

  scene.add(new THREE.Points(geo, mat));

  let animId;
  let t = 0;
  function animate() {
    animId = requestAnimationFrame(animate);
    t += 0.001;
    // Slow drift
    scene.rotation.y = Math.sin(t * 0.3) * 0.05;
    scene.rotation.x = Math.sin(t * 0.2) * 0.02;
    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
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
      renderer.dispose();
      geo.dispose();
      mat.dispose();
    }
  };
}
