import * as THREE from 'three';

const SIGMA = 10, RHO = 28, BETA = 8 / 3;
const DT = 0.005;

const TRAJECTORIES = [
  { x:  0.1,       y: 0.0,      z: 20.0,      color: new THREE.Color(1.0,  1.0,  0.95) },
  { x:  0.100001,  y: 0.0,      z: 20.0,      color: new THREE.Color(1.0,  0.82, 0.28) },
  { x:  0.1,       y: 0.000001, z: 20.0,      color: new THREE.Color(1.0,  0.45, 0.05) },
  { x:  0.1,       y: 0.0,      z: 20.000001, color: new THREE.Color(1.0,  0.62, 0.12) },
  { x: -0.1,       y: 0.0,      z: 20.0,      color: new THREE.Color(1.0,  0.38, 0.0)  },
  { x:  0.1,       y: 0.000002, z: 20.0,      color: new THREE.Color(1.0,  0.28, 0.04) },
  { x:  0.100002,  y: 0.0,      z: 20.0,      color: new THREE.Color(1.0,  0.88, 0.45) },
];

function lorenzStep(p) {
  const dx = SIGMA * (p.y - p.x);
  const dy = p.x * (RHO - p.z) - p.y;
  const dz = p.x * p.y - BETA * p.z;
  p.x += dx * DT; p.y += dy * DT; p.z += dz * DT;
}

function findCenter(scale) {
  const probe = { x: 0.1, y: 0.0, z: 20.0 };
  for (let i = 0; i < 2000; i++) lorenzStep(probe);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
  const pc = { ...probe };
  for (let i = 0; i < 6000; i++) {
    lorenzStep(pc);
    minX=Math.min(minX,pc.x);maxX=Math.max(maxX,pc.x);
    minY=Math.min(minY,pc.y);maxY=Math.max(maxY,pc.y);
    minZ=Math.min(minZ,pc.z);maxZ=Math.max(maxZ,pc.z);
  }
  return {
    x: ((minX+maxX)/2)*scale,
    y: ((minY+maxY)/2)*scale,
    z: ((minZ+maxZ)/2)*scale,
  };
}

export function createButterfly(container, { preview = false, shorts = false, rotSpeed = 1 } = {}) {
  // Shorts mode: 9:16 vertical crop for YouTube Shorts
  const isShorts = shorts || (!preview && new URLSearchParams(window.location.search).has('shorts'));
  const w = isShorts ? Math.min(container.clientWidth || window.innerWidth, 450)
                     : container.clientWidth  || window.innerWidth;
  const h = isShorts ? Math.round(w * (16/9))
                     : container.clientHeight || window.innerHeight;
  const SCALE     = preview ? 0.7 : 1.6;
  const MAX_PTS   = preview ? 3000 : 10000;
  const GLOW_PTS  = preview ? 0    : 300;   // trailing glow tail length
  const PPF       = preview ? 2    : 4;

  // ─── Scene ──────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, preview ? 0.012 : 0.006);

  const camera = new THREE.PerspectiveCamera(45, w/h, 0.1, 500);
  camera.position.set(preview ? 5 : 40, preview ? 15 : (isShorts ? 30 : 35), preview ? 65 : (isShorts ? 100 : 130));
  camera.lookAt(preview ? 0 : 0, preview ? 5 : 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  if (isShorts) {
    renderer.domElement.style.width  = w + 'px';
    renderer.domElement.style.height = h + 'px';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.margin = '0 auto';
  } else {
    renderer.domElement.style.width  = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
  }
  container.appendChild(renderer.domElement);

  const center = findCenter(SCALE);

  // ─── 3D spacetime grid ──────────────────────────────────────────────────────
  // Spider-silk white grid whose vertices get pulled toward the butterfly
  let gridLines = [];
  let gridVertexRestPositions = []; // [{ x,y,z }] — home positions
  let gridVertexBuffers = [];       // Float32Array refs for live update
  const gridMats = []; // so dispose() can free these — see dispose() below

  if (!preview) {
    const ext = 80, dep = 80, step = 10;

    // Spider-silk: warm off-white with blue-silver shimmer
    const majorMat = new THREE.LineBasicMaterial({
      color: 0xdce8f5, transparent: true, opacity: 0.28, depthWrite: false,
    });
    const minorMat = new THREE.LineBasicMaterial({
      color: 0xc8d8ee, transparent: true, opacity: 0.13, depthWrite: false,
    });
    const depthMat = new THREE.LineBasicMaterial({
      color: 0xb8cce0, transparent: true, opacity: 0.09, depthWrite: false,
    });
    gridMats.push(majorMat, minorMat, depthMat);

    function makeGridLine(x1,y1,z1, x2,y2,z2, mat, segments=1) {
      const pts = [];
      const rest = [];
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const px = x1 + (x2-x1)*t;
        const py = y1 + (y2-y1)*t;
        const pz = z1 + (z2-z1)*t;
        pts.push(px, py, pz);
        rest.push({ x: px, y: py, z: pz });
      }
      const posArr = new Float32Array(pts);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      const line = new THREE.Line(geo, mat);
      scene.add(line);
      gridLines.push({ geo, posArr, vertexCount: segments + 1 });
      gridVertexBuffers.push(posArr);
      gridVertexRestPositions.push(...rest);
      return { startIdx: gridVertexRestPositions.length - rest.length, count: rest.length };
    }

    // XY planes at each Z slice — segmented so they can curve
    const SEG = 4; // subdivisions per grid line for curvature
    for (let z = -dep; z <= dep; z += step) {
      const mat = (Math.abs(z) % (step*2) === 0) ? majorMat : minorMat;
      for (let x = -ext; x <= ext; x += step) makeGridLine(x,-ext,z,x,ext,z,mat,SEG);
      for (let y = -ext; y <= ext; y += step) makeGridLine(-ext,y,z,ext,y,z,mat,SEG);
    }
    // Z-depth lines
    for (let x = -ext; x <= ext; x += step)
      for (let y = -ext; y <= ext; y += step)
        makeGridLine(x,y,-dep,x,y,dep,depthMat,SEG);
  }

  // ─── Butterfly trails ────────────────────────────────────────────────────────
  const root = new THREE.Group();
  scene.add(root);

  const trails = TRAJECTORIES.map(traj => {
    const posArray = new Float32Array(MAX_PTS * 3);
    const colArray = new Float32Array(MAX_PTS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colArray, 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: false,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.position.set(-center.x, -center.y, -center.z);
    root.add(line);
    return { state: { ...traj }, color: traj.color, posArray, colArray, geo, mat, count: 0, head: 0 };
  });

  // ─── Glow trails (additive, short) ──────────────────────────────────────────
  const glowTrails = !preview ? TRAJECTORIES.map(traj => {
    const posArray = new Float32Array(GLOW_PTS * 3);
    const colArray = new Float32Array(GLOW_PTS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colArray, 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.position.set(-center.x, -center.y, -center.z);
    root.add(line);
    return { color: traj.color, posArray, colArray, geo, mat, count: 0, head: 0 };
  }) : [];

  // ─── Math sprites ─────────────────────────────────────────────────────────
  const spriteData = [];
  if (!preview) {
    const symbols = [
      'σ','ρ','β','λ','∂','∇','∞','π','Δ','ω','φ','ψ','θ','α',
      'dx/dt','dy/dt','dz/dt','σ(y−x)','8/3','28','10',
      'f(x)','∫','∑','lim','→','ℝ³','ẋ','ẏ','ż','βz','ρ−z',
    ];
    function makeSymbolTexture(text) {
      const c = document.createElement('canvas');
      c.width=128; c.height=64;
      const cx=c.getContext('2d');
      cx.font='italic 22px Times New Roman,serif';
      cx.fillStyle='rgba(200,220,255,0.7)';
      cx.textAlign='center'; cx.textBaseline='middle';
      cx.fillText(text,64,32);
      return new THREE.CanvasTexture(c);
    }
    const textures = symbols.map(makeSymbolTexture);
    for (let i=0;i<220;i++) {
      const mat = new THREE.SpriteMaterial({
        map: textures[Math.floor(Math.random()*textures.length)],
        transparent:true, opacity:0.2+Math.random()*0.3, depthWrite:false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set((Math.random()-.5)*140,(Math.random()-.5)*140,(Math.random()-.5)*140);
      const s=2.5+Math.random()*4.5;
      sprite.scale.set(s*2,s,1);
      scene.add(sprite);
      spriteData.push({
        sprite,
        vel:{x:(Math.random()-.5)*.008,y:(Math.random()-.5)*.006,z:(Math.random()-.5)*.005},
        phase:Math.random()*Math.PI*2,
        speed:.003+Math.random()*.005,
        baseOpacity:.06+Math.random()*.14,
      });
    }
  }

  // ─── Orbit controls (full only) ─────────────────────────────────────────────
  let spherical = {
    radius: camera.position.length(),
    phi:    Math.acos(camera.position.y / camera.position.length()),
    theta:  Math.atan2(camera.position.x, camera.position.z),
  };
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let isDragging=false, prevMouse={x:0,y:0}, autoJitter=!prefersReducedMotion;
  let autoRotate = !preview && !prefersReducedMotion; // slow camera orbit
  const ROTATE_SPEED = (isShorts ? 0.0015 : 0.0008) * rotSpeed; // shorts rotates faster for drama

  function updateCamera() {
    camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
    camera.position.y = spherical.radius * Math.cos(spherical.phi);
    camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
    camera.lookAt(0,0,0);
  }

  // Named so dispose() can remove them. Several of these are bound to
  // `window`, not `container` — meaning they never had any per-scene scope
  // to begin with, and previously ran forever after leaving butterfly,
  // stacking a fresh duplicate set each time the scene was revisited. The
  // container-bound ones are just as stale afterward: container is the
  // shared #experience-container element every scene reuses (main.js only
  // clears its innerHTML between scenes, never replaces the node itself).
  let onMouseDown = null, onMouseUp = null, onMouseMove = null, onWheel = null,
      onTouchStart = null, onTouchEnd = null, onTouchMove = null;

  if (!preview) {
    onMouseDown = e=>{isDragging=true;autoJitter=false;prevMouse={x:e.clientX,y:e.clientY};};
    container.addEventListener('mousedown', onMouseDown);
    onMouseUp = ()=>{isDragging=false;setTimeout(()=>{autoJitter=true;},3000);};
    window.addEventListener('mouseup', onMouseUp);
    onMouseMove = e=>{
      if(!isDragging)return;
      spherical.theta-=(e.clientX-prevMouse.x)*0.005;
      spherical.phi=Math.max(.1,Math.min(Math.PI-.1,spherical.phi+(e.clientY-prevMouse.y)*0.005));
      prevMouse={x:e.clientX,y:e.clientY};
    };
    window.addEventListener('mousemove', onMouseMove);
    onWheel = e=>{spherical.radius=Math.max(40,Math.min(220,spherical.radius+e.deltaY*0.08));};
    container.addEventListener('wheel', onWheel);
    onTouchStart = e=>{isDragging=true;autoJitter=false;prevMouse={x:e.touches[0].clientX,y:e.touches[0].clientY};};
    container.addEventListener('touchstart', onTouchStart, {passive:true});
    onTouchEnd = ()=>{isDragging=false;setTimeout(()=>{autoJitter=true;},3000);};
    window.addEventListener('touchend', onTouchEnd);
    onTouchMove = e=>{
      if(!isDragging)return;
      spherical.theta-=(e.touches[0].clientX-prevMouse.x)*0.005;
      spherical.phi=Math.max(.1,Math.min(Math.PI-.1,spherical.phi+(e.touches[0].clientY-prevMouse.y)*0.005));
      prevMouse={x:e.touches[0].clientX,y:e.touches[0].clientY};
    };
    window.addEventListener('touchmove', onTouchMove, {passive:true});
  }

  // ─── Resize ─────────────────────────────────────────────────────────────────
  function resize() {
    const w=container.clientWidth,h=container.clientHeight;
    // Container is hidden (e.g. the landing grid sits behind an active
    // full-screen scene) — clientWidth/Height report 0 in that state.
    // Bail out rather than zeroing the renderer; a real resize event will
    // fire again once the container is visible and correctly sized.
    if (!w || !h) return;
    camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);
  }
  window.addEventListener('resize',resize);

  // ─── Jitter state ────────────────────────────────────────────────────────────
  let rotVelX=0,rotVelY=0,rotVelZ=0;
  let rotX=-1.52,rotY=0.0,rotZ=0.05;
  let t=0, animId;

  // Current butterfly world-space centroid (for grid distortion)
  const butterflyPos = new THREE.Vector3();

  function animate() {
    animId = requestAnimationFrame(animate);
    t += 0.008;

    // Butterfly jitter
    if (autoJitter) {
      rotVelX=rotVelX*.96+(Math.random()-.5)*.0008;
      rotVelY=rotVelY*.96+(Math.random()-.5)*.0012;
      rotVelZ=rotVelZ*.96+(Math.random()-.5)*.0004;
      rotVelX+=(-1.52-rotX)*.003;
      rotVelY+=(0.0-rotY)*.002;
      rotVelZ+=(.05-rotZ)*.002;
      rotX+=rotVelX;rotY+=rotVelY;rotZ+=rotVelZ;
      root.rotation.x=rotX;root.rotation.y=rotY;root.rotation.z=rotZ;
    }

    // Slow camera orbit — sweep theta when not dragging
    if (autoRotate && !isDragging) {
      spherical.theta += ROTATE_SPEED;
      updateCamera();
    } else if (!preview) {
      updateCamera();
    }

    // Advance Lorenz trails
    for (const trail of trails) {
      for (let s=0;s<PPF;s++) {
        lorenzStep(trail.state);
        const idx=(trail.head%MAX_PTS)*3;
        trail.posArray[idx]  =trail.state.x*SCALE;
        trail.posArray[idx+1]=trail.state.y*SCALE;
        trail.posArray[idx+2]=trail.state.z*SCALE;
        const b=trail.count<MAX_PTS?0.3+(trail.count/MAX_PTS)*0.7:1.0;
        trail.colArray[idx]  =trail.color.r*b;
        trail.colArray[idx+1]=trail.color.g*b;
        trail.colArray[idx+2]=trail.color.b*b;
        trail.head++;trail.count=Math.min(trail.count+1,MAX_PTS);
      }
      trail.geo.attributes.position.needsUpdate=true;
      trail.geo.attributes.color.needsUpdate=true;
      trail.geo.setDrawRange(0,trail.count);
    }

    // Advance glow trails (copy from main trail head)
    if (!preview) {
      for (let ti=0;ti<TRAJECTORIES.length;ti++) {
        const main=trails[ti], glow=glowTrails[ti];
        // Copy last PPF points from main into glow ring buffer
        for (let s=0;s<PPF;s++) {
          const srcIdx=((main.head-PPF+s+MAX_PTS)%MAX_PTS)*3;
          const dstIdx=(glow.head%GLOW_PTS)*3;
          glow.posArray[dstIdx]  =main.posArray[srcIdx];
          glow.posArray[dstIdx+1]=main.posArray[srcIdx+1];
          glow.posArray[dstIdx+2]=main.posArray[srcIdx+2];
          // Brighter, more saturated version of the color
          glow.colArray[dstIdx]  =Math.min(1,main.color.r*1.4);
          glow.colArray[dstIdx+1]=Math.min(1,main.color.g*1.4);
          glow.colArray[dstIdx+2]=Math.min(1,main.color.b*1.4);
          glow.head++;glow.count=Math.min(glow.count+1,GLOW_PTS);
        }
        glow.geo.attributes.position.needsUpdate=true;
        glow.geo.attributes.color.needsUpdate=true;
        glow.geo.setDrawRange(0,glow.count);
      }

      // Compute butterfly world-space centroid from first trail's current head
      const mainTrail = trails[0];
      const hi = ((mainTrail.head-1+MAX_PTS)%MAX_PTS)*3;
      const localX = mainTrail.posArray[hi]   - center.x;
      const localY = mainTrail.posArray[hi+1] - center.y;
      const localZ = mainTrail.posArray[hi+2] - center.z;
      // Apply root rotation to get world position
      butterflyPos.set(localX, localY, localZ).applyEuler(root.rotation);

      // ─── Spacetime grid distortion ────────────────────────────────────────
      // Each grid vertex gets pulled toward butterflyPos
      // displacement = PULL_STRENGTH / (dist^2 + SOFTENING)
      const PULL_STRENGTH = 40;
      const SOFTENING     = 18;  // prevents division by zero and clamps max pull
      const MAX_DISP      = 4;  // hard cap on displacement

      let vIdx = 0; // global vertex index across all lines
      for (const { geo, posArr, vertexCount } of gridLines) {
        for (let vi = 0; vi < vertexCount; vi++) {
          const rest = gridVertexRestPositions[vIdx];
          const rx = rest.x, ry = rest.y, rz = rest.z;

          const dx = butterflyPos.x - rx;
          const dy = butterflyPos.y - ry;
          const dz = butterflyPos.z - rz;
          const dist2 = dx*dx + dy*dy + dz*dz;
          const dist  = Math.sqrt(dist2);
          const pull  = Math.min(PULL_STRENGTH / (dist2 + SOFTENING), MAX_DISP / Math.max(dist, 0.001));

          posArr[vi*3]   = rx + dx * pull;
          posArr[vi*3+1] = ry + dy * pull;
          posArr[vi*3+2] = rz + dz * pull;
          vIdx++;
        }
        geo.attributes.position.needsUpdate = true;
      }

      // Drift math sprites
      const b = 70;
      for (const d of spriteData) {
        d.vel.x+=(Math.random()-.5)*.001;d.vel.x*=.99;
        d.vel.y+=(Math.random()-.5)*.001;d.vel.y*=.99;
        d.vel.z+=(Math.random()-.5)*.0005;d.vel.z*=.99;
        d.sprite.position.x+=d.vel.x;d.sprite.position.y+=d.vel.y;d.sprite.position.z+=d.vel.z;
        for(const ax of['x','y','z']){if(d.sprite.position[ax]>b)d.sprite.position[ax]=-b;if(d.sprite.position[ax]<-b)d.sprite.position[ax]=b;}
        d.sprite.material.opacity=d.baseOpacity+Math.sin(t*d.speed*10+d.phase)*d.baseOpacity*.4;
      }
    }

    renderer.render(scene, camera);
  }
  animate();

  return {
    dispose() {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      if (onMouseDown) container.removeEventListener('mousedown', onMouseDown);
      if (onMouseUp) window.removeEventListener('mouseup', onMouseUp);
      if (onMouseMove) window.removeEventListener('mousemove', onMouseMove);
      if (onWheel) container.removeEventListener('wheel', onWheel);
      if (onTouchStart) container.removeEventListener('touchstart', onTouchStart);
      if (onTouchEnd) window.removeEventListener('touchend', onTouchEnd);
      if (onTouchMove) window.removeEventListener('touchmove', onTouchMove);
      // THREE.js resource cleanup — previously missing entirely (only the
      // renderer itself was disposed), leaking the spacetime grid's line
      // geometries/materials, both trail sets' geometries/materials, and
      // (full scene only) 220 math-symbol sprites' materials/textures on
      // every visit to this scene. Textures/materials are shared across
      // many sprites, so disposing the same one more than once here is
      // harmless — THREE.js no-ops a repeat dispose() call.
      gridLines.forEach(g => g.geo.dispose());
      gridMats.forEach(m => m.dispose());
      trails.forEach(tr => { tr.geo.dispose(); tr.mat.dispose(); });
      glowTrails.forEach(tr => { tr.geo.dispose(); tr.mat.dispose(); });
      spriteData.forEach(d => {
        d.sprite.material.map?.dispose();
        d.sprite.material.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
