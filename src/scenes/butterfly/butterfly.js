import * as THREE from 'three';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion, parseHTML,
  claimContainer, manageRenderer, trackTimers, createFrameClock,
} from '../../utils/sceneKit.js';
import butterflyHtml from './butterfly.html?raw';
import './butterfly.css';

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

export function createButterfly(container, { preview = false } = {}) {
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  const SCALE     = preview ? 0.7 : 1.6;
  const MAX_PTS   = preview ? 3000 : 10000;
  const GLOW_PTS  = preview ? 0    : 300;   // trailing glow tail length

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, preview ? 0.012 : 0.006);

  const camera = new THREE.PerspectiveCamera(45, w/h, 0.1, 500);
  camera.position.set(preview ? 5 : 40, preview ? 15 : 35, preview ? 65 : 130);
  camera.lookAt(0, preview ? 5 : 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  const managedRenderer = manageRenderer(renderer);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.width  = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const containerClaim = !preview ? claimContainer(container) : null;

  const timers = trackTimers();

  let expLabel = null, hint = null;
  if (!preview) {
    const frag = parseHTML(butterflyHtml);
    expLabel = frag.querySelector('.butterfly-exp-label-row');
    hint = frag.querySelector('.butterfly-hint');
    document.body.appendChild(expLabel);
    document.body.appendChild(hint);
  }

  const center = findCenter(SCALE);

  let gridTiers = [];   // [{ geo, posArr, restBase, vertexCount }]
  let gridRest = null;  // one Float32Array, xyz per vertex, all tiers in order
  const gridMats = []; // so dispose() can free these — see dispose() below

  if (!preview) {
    const ext = 80, dep = 80, step = 10;

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

    const SEG = 4; // subdivisions per grid line — this is what lets a straight line curve at all

    const tiers = [
      { mat: majorMat, lines: [] },
      { mat: minorMat, lines: [] },
      { mat: depthMat, lines: [] },
    ];
    const [majorTier, minorTier, depthTier] = tiers;

    for (let z = -dep; z <= dep; z += step) {
      const tier = (Math.abs(z) % (step*2) === 0) ? majorTier : minorTier;
      for (let x = -ext; x <= ext; x += step) tier.lines.push([x,-ext,z, x,ext,z]);
      for (let y = -ext; y <= ext; y += step) tier.lines.push([-ext,y,z, ext,y,z]);
    }
    for (let x = -ext; x <= ext; x += step)
      for (let y = -ext; y <= ext; y += step)
        depthTier.lines.push([x,y,-dep, x,y,dep]);

    const totalVerts = tiers.reduce((n, t) => n + t.lines.length * (SEG + 1), 0);
    gridRest = new Float32Array(totalVerts * 3);

    let restBase = 0;
    for (const tier of tiers) {
      const vertexCount = tier.lines.length * (SEG + 1);
      const posArr = new Float32Array(vertexCount * 3);
      const index = new Array(tier.lines.length * SEG * 2);
      let v = 0, ii = 0;
      for (const [x1,y1,z1, x2,y2,z2] of tier.lines) {
        const first = v;
        for (let sIdx = 0; sIdx <= SEG; sIdx++) {
          const t = sIdx / SEG;
          const px = x1 + (x2-x1)*t;
          const py = y1 + (y2-y1)*t;
          const pz = z1 + (z2-z1)*t;
          posArr[v*3] = px; posArr[v*3+1] = py; posArr[v*3+2] = pz;
          const r = (restBase + v) * 3;
          gridRest[r] = px; gridRest[r+1] = py; gridRest[r+2] = pz;
          v++;
        }
        for (let sIdx = 0; sIdx < SEG; sIdx++) {
          index[ii++] = first + sIdx;
          index[ii++] = first + sIdx + 1;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      geo.setIndex(index);
      const segments = new THREE.LineSegments(geo, tier.mat);
      segments.frustumCulled = false;
      scene.add(segments);
      gridTiers.push({ geo, posArr, restBase, vertexCount });
      restBase += vertexCount;
    }
  }

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

  const spriteData = [];
  const SPRITE_COUNT = 220;
  let spriteMesh = null, spriteMat = null, spriteGeo = null, symbolAtlasTex = null;
  let spriteOffsets = null;  // Float32Array, xyz per instance — rewritten every frame
  let spriteOpacity = null;  // Float32Array, one per instance — rewritten every frame
  let symbolsDisposed = false;
  if (!preview) {
    const symbols = [
      'σ','ρ','β','λ','∂','∇','∞','π','Δ','ω','φ','ψ','θ','α',
      'dx/dt','dy/dt','dz/dt','σ(y−x)','8/3','28','10',
      'f(x)','∫','∑','lim','→','ℝ³','ẋ','ẏ','ż','βz','ρ−z',
    ];
    const CELL_W = 128, CELL_H = 64;
    const ATLAS_COLS = 8;
    const atlasRows = Math.ceil(symbols.length / ATLAS_COLS);
    const atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = ATLAS_COLS * CELL_W;
    atlasCanvas.height = atlasRows * CELL_H;
    const acx = atlasCanvas.getContext('2d');
    const paintAtlas = () => {
      acx.clearRect(0, 0, atlasCanvas.width, atlasCanvas.height);
      acx.font = 'italic 22px "Arapey", serif';
      acx.fillStyle = 'rgba(200,220,255,0.7)';
      acx.textAlign = 'center'; acx.textBaseline = 'middle';
      symbols.forEach((text, i) => {
        const col = i % ATLAS_COLS, row = (i / ATLAS_COLS) | 0;
        acx.fillText(text, col * CELL_W + CELL_W / 2, row * CELL_H + CELL_H / 2);
      });
    };
    paintAtlas();
    symbolAtlasTex = new THREE.CanvasTexture(atlasCanvas);
    document.fonts.load('italic 22px "Arapey"').then(() => {
      if (symbolsDisposed) return;
      paintAtlas();
      symbolAtlasTex.needsUpdate = true;
    }).catch(() => {});

    spriteOffsets = new Float32Array(SPRITE_COUNT * 3);
    spriteOpacity = new Float32Array(SPRITE_COUNT);
    const spriteScale = new Float32Array(SPRITE_COUNT * 2);   // world width/height, never changes
    const spriteCellUv = new Float32Array(SPRITE_COUNT * 2);  // atlas cell origin, never changes
    for (let i = 0; i < SPRITE_COUNT; i++) {
      spriteOffsets[i*3]   = (Math.random()-.5)*140;
      spriteOffsets[i*3+1] = (Math.random()-.5)*140;
      spriteOffsets[i*3+2] = (Math.random()-.5)*140;
      const sz = 2.5 + Math.random()*4.5;
      spriteScale[i*2] = sz*2; spriteScale[i*2+1] = sz;  // same 2:1 box THREE.Sprite got from scale.set(s*2, s, 1)
      const cell = Math.floor(Math.random()*symbols.length);
      const col = cell % ATLAS_COLS, row = (cell / ATLAS_COLS) | 0;
      spriteCellUv[i*2] = col / ATLAS_COLS;
      spriteCellUv[i*2+1] = 1 - (row + 1) / atlasRows;
      const baseOpacity = .06 + Math.random()*.14;
      spriteOpacity[i] = baseOpacity;
      spriteData.push({
        vx:(Math.random()-.5)*.008, vy:(Math.random()-.5)*.006, vz:(Math.random()-.5)*.005,
        phase:Math.random()*Math.PI*2,
        speed:.003+Math.random()*.005,
        baseOpacity,
      });
    }

    spriteGeo = new THREE.InstancedBufferGeometry();
    spriteGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -0.5,-0.5,0,  0.5,-0.5,0,  0.5,0.5,0,  -0.5,0.5,0,
    ]), 3));
    spriteGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
      0,0,  1,0,  1,1,  0,1,
    ]), 2));
    spriteGeo.setIndex([0,1,2, 0,2,3]);
    spriteGeo.instanceCount = SPRITE_COUNT;
    spriteGeo.setAttribute('iOffset',  new THREE.InstancedBufferAttribute(spriteOffsets, 3));
    spriteGeo.setAttribute('iScale',   new THREE.InstancedBufferAttribute(spriteScale, 2));
    spriteGeo.setAttribute('iCellUv',  new THREE.InstancedBufferAttribute(spriteCellUv, 2));
    spriteGeo.setAttribute('iOpacity', new THREE.InstancedBufferAttribute(spriteOpacity, 1));

    spriteMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { map: { value: null }, cellSize: { value: new THREE.Vector2(1/ATLAS_COLS, 1/atlasRows) } },
      ]),
      vertexShader: `
        attribute vec3 iOffset;
        attribute vec2 iScale;
        attribute vec2 iCellUv;
        attribute float iOpacity;
        uniform vec2 cellSize;
        varying vec2 vAtlasUv;
        varying float vOpacity;
        #include <fog_pars_vertex>
        void main() {
          vAtlasUv = iCellUv + uv * cellSize;
          vOpacity = iOpacity;
          vec4 mvPosition = modelViewMatrix * vec4(iOffset, 1.0);
          mvPosition.xy += position.xy * iScale;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        varying vec2 vAtlasUv;
        varying float vOpacity;
        #include <fog_pars_fragment>
        void main() {
          vec4 texel = texture2D(map, vAtlasUv);
          float a = texel.a * vOpacity;
          if (a < 0.004) discard;
          gl_FragColor = vec4(texel.rgb, a);
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    spriteMat.uniforms.map.value = symbolAtlasTex;

    spriteMesh = new THREE.Mesh(spriteGeo, spriteMat);
    spriteMesh.frustumCulled = false;
    scene.add(spriteMesh);
  }

  let spherical = {
    radius: camera.position.length(),
    phi:    Math.acos(camera.position.y / camera.position.length()),
    theta:  Math.atan2(camera.position.x, camera.position.z),
  };
  const reduceMotion = prefersReducedMotion();
  let autoJitter = !reduceMotion;
  let autoRotate = !preview && !reduceMotion; // slow camera orbit
  const ROTATE_SPEED = 0.0008;

  function updateCamera() {
    camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
    camera.position.y = spherical.radius * Math.cos(spherical.phi);
    camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
    camera.lookAt(0,0,0);
  }

  let orbitDrag = null, wheelZoom = null;
  if (!preview) {
    orbitDrag = bindOrbitDrag(container, {
      sensitivity: 0.005,
      onDragStart: () => { autoJitter = false; },
      onDrag: (dx, dy) => {
        spherical.theta -= dx;
        spherical.phi = Math.max(.1, Math.min(Math.PI - .1, spherical.phi + dy));
      },
      onDragEnd: () => { timers.after(3000, () => { autoJitter = true; }); },
    });
    wheelZoom = bindWheelZoom(container, {
      onZoom: deltaY => { spherical.radius = Math.max(40, Math.min(220, spherical.radius + deltaY * 0.08)); },
    });
  }

  const resizeCtl = bindGuardedResize(container, (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    managedRenderer.applyPixelRatio();
    renderer.setSize(w, h);
  });

  let rotVelX=0,rotVelY=0,rotVelZ=0;
  let rotX=-1.52,rotY=0.0,rotZ=0.05;
  let t=0, animId = null;
  const clock = createFrameClock();
  const PPS = preview ? 400 : 240;
  let stepCarry = 0;
  let paused = false;

  const butterflyPos = new THREE.Vector3();

  function animate() {
    animId = requestAnimationFrame(animate);
    const dt = clock.tick();
    t += 0.008 * dt * 60;

    stepCarry += PPS * dt;
    const steps = Math.floor(stepCarry);
    stepCarry -= steps;

    if (autoJitter && !reduceMotion) {
      rotVelX=rotVelX*.96+(Math.random()-.5)*.0008;
      rotVelY=rotVelY*.96+(Math.random()-.5)*.0012;
      rotVelZ=rotVelZ*.96+(Math.random()-.5)*.0004;
      rotVelX+=(-1.52-rotX)*.003;
      rotVelY+=(0.0-rotY)*.002;
      rotVelZ+=(.05-rotZ)*.002;
      rotX+=rotVelX;rotY+=rotVelY;rotZ+=rotVelZ;
      root.rotation.x=rotX;root.rotation.y=rotY;root.rotation.z=rotZ;
    }

    if (autoRotate && !(orbitDrag && orbitDrag.isDragging)) {
      spherical.theta += ROTATE_SPEED;
      updateCamera();
    } else if (!preview) {
      updateCamera();
    }

    if (steps > 0) for (const trail of trails) {
      for (let s=0;s<steps;s++) {
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

    if (!preview && steps > 0) {
      for (let ti=0;ti<TRAJECTORIES.length;ti++) {
        const main=trails[ti], glow=glowTrails[ti];
        for (let s=0;s<steps;s++) {
          const srcIdx=((main.head-steps+s+MAX_PTS)%MAX_PTS)*3;
          const dstIdx=(glow.head%GLOW_PTS)*3;
          glow.posArray[dstIdx]  =main.posArray[srcIdx];
          glow.posArray[dstIdx+1]=main.posArray[srcIdx+1];
          glow.posArray[dstIdx+2]=main.posArray[srcIdx+2];
          glow.colArray[dstIdx]  =Math.min(1,main.color.r*1.4);
          glow.colArray[dstIdx+1]=Math.min(1,main.color.g*1.4);
          glow.colArray[dstIdx+2]=Math.min(1,main.color.b*1.4);
          glow.head++;glow.count=Math.min(glow.count+1,GLOW_PTS);
        }
        glow.geo.attributes.position.needsUpdate=true;
        glow.geo.attributes.color.needsUpdate=true;
        glow.geo.setDrawRange(0,glow.count);
      }

      const mainTrail = trails[0];
      const hi = ((mainTrail.head-1+MAX_PTS)%MAX_PTS)*3;
      const localX = mainTrail.posArray[hi]   - center.x;
      const localY = mainTrail.posArray[hi+1] - center.y;
      const localZ = mainTrail.posArray[hi+2] - center.z;
      butterflyPos.set(localX, localY, localZ).applyEuler(root.rotation);

      const PULL_STRENGTH = 40;
      const SOFTENING     = 18;  // prevents division by zero and clamps max pull
      const MAX_DISP      = 4;  // hard cap on displacement

      if (!reduceMotion) for (const { geo, posArr, restBase, vertexCount } of gridTiers) {
        for (let vi = 0; vi < vertexCount; vi++) {
          const r = (restBase + vi) * 3;
          const rx = gridRest[r], ry = gridRest[r+1], rz = gridRest[r+2];

          const dx = butterflyPos.x - rx;
          const dy = butterflyPos.y - ry;
          const dz = butterflyPos.z - rz;
          const dist2 = dx*dx + dy*dy + dz*dz;
          const dist  = Math.sqrt(dist2);
          const pull  = Math.min(PULL_STRENGTH / (dist2 + SOFTENING), MAX_DISP / Math.max(dist, 0.001));

          posArr[vi*3]   = rx + dx * pull;
          posArr[vi*3+1] = ry + dy * pull;
          posArr[vi*3+2] = rz + dz * pull;
        }
        geo.attributes.position.needsUpdate = true;
      }

      const b = 70;
      if (!reduceMotion) for (let i = 0; i < SPRITE_COUNT; i++) {
        const d = spriteData[i];
        d.vx+=(Math.random()-.5)*.001;d.vx*=.99;
        d.vy+=(Math.random()-.5)*.001;d.vy*=.99;
        d.vz+=(Math.random()-.5)*.0005;d.vz*=.99;
        const o = i*3;
        let ox = spriteOffsets[o]+d.vx, oy = spriteOffsets[o+1]+d.vy, oz = spriteOffsets[o+2]+d.vz;
        if (ox > b) ox = -b; else if (ox < -b) ox = b;
        if (oy > b) oy = -b; else if (oy < -b) oy = b;
        if (oz > b) oz = -b; else if (oz < -b) oz = b;
        spriteOffsets[o] = ox; spriteOffsets[o+1] = oy; spriteOffsets[o+2] = oz;
        spriteOpacity[i] = d.baseOpacity+Math.sin(t*d.speed*10+d.phase)*d.baseOpacity*.4;
      }
      spriteGeo.attributes.iOffset.needsUpdate = true;
      spriteGeo.attributes.iOpacity.needsUpdate = true;
    }

    renderer.render(scene, camera);
  }
  animate();

  return {
    setPaused(next) {
      const want = Boolean(next);
      if (want === paused) return;
      paused = want;
      if (paused) {
        cancelAnimationFrame(animId);
        animId = null;
      } else {
        clock.resync();
        animate();
      }
    },
    dispose() {
      cancelAnimationFrame(animId);
      symbolsDisposed = true;
      resizeCtl.dispose();
      orbitDrag?.dispose();
      wheelZoom?.dispose();
      timers.dispose();
      expLabel?.remove();
      hint?.remove();
      gridTiers.forEach(g => g.geo.dispose());
      gridMats.forEach(m => m.dispose());
      trails.forEach(tr => { tr.geo.dispose(); tr.mat.dispose(); });
      glowTrails.forEach(tr => { tr.geo.dispose(); tr.mat.dispose(); });
      spriteGeo?.dispose();
      spriteMat?.dispose();
      symbolAtlasTex?.dispose();
      managedRenderer.dispose();
      containerClaim?.restore();
    }
  };
}
