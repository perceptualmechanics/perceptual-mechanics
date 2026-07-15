import * as THREE from 'three';

// ─── The Egg: Worldline ───────────────────────────────────────────────────────
// The glowing green egg — Earth tinted green.
// Your actual geographic worldline through spacetime:
// Boston → Los Angeles → Boca Raton → rural Michigan
// Hover locations surface Kinetic Muse fragments, memories, years.
// Powered by Google Maps Platform JS API (satellite tiles).
// Coming soon.

export function createEgg(container, { preview = false } = {}) {
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  camera.position.z = preview ? 3.5 : 4.5;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0x224422, 1.2));
  const key = new THREE.DirectionalLight(0x88ffaa, 2.0);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x44ff88, 0.6);
  rim.position.set(-4, -2, -3);
  scene.add(rim);

  // Glowing green sphere — placeholder for Earth
  const geo = new THREE.SphereGeometry(1, preview ? 32 : 64, preview ? 32 : 64);
  const mat = new THREE.MeshPhongMaterial({
    color: 0x22cc55,
    emissive: 0x0a3318,
    specular: 0x44ff88,
    shininess: 60,
    transparent: true,
    opacity: 0.92,
  });
  const egg = new THREE.Mesh(geo, mat);
  scene.add(egg);

  // Atmospheric glow shell
  const glowGeo = new THREE.SphereGeometry(1.08, 32, 32);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x22ff66,
    transparent: true,
    opacity: 0.07,
    side: THREE.BackSide,
  });
  scene.add(new THREE.Mesh(glowGeo, glowMat));

  let animId;
  let t = 0;
  function animate() {
    animId = requestAnimationFrame(animate);
    t += 0.005;
    egg.rotation.y = t * (preview ? 0.3 : 0.15);
    // Gentle pulse on glow
    glowMat.opacity = 0.05 + Math.sin(t * 1.2) * 0.025;
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
      renderer.dispose();
      geo.dispose();
      mat.dispose();
      glowGeo.dispose();
      glowMat.dispose();
    }
  };
}
