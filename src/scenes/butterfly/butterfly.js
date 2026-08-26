import * as THREE from 'three';
import { bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion, parseHTML } from '../../utils/sceneKit.js';
import butterflyHtml from './butterfly.html?raw';
import './butterfly.css';

// ─── The Lorenz attractor ───────────────────────────────────────────────────
// This is the actual, classic Lorenz system (Edward Lorenz, 1963) — a
// simplified model of atmospheric convection (warm air rising, cooling,
// sinking, in a rotating fluid layer) reduced to three coupled variables:
// x = the rate of convective overturning (how fast the fluid is rolling),
// y = the temperature difference between the rising and falling sides,
// z = how much the vertical temperature profile deviates from a straight-
// line gradient. It's not a stylized approximation of chaos, and not
// invented for this scene — it's the same three equations Lorenz derived
// and the same three constants below (10, 28, 8/3) that produce the
// famous double-lobed "butterfly" shape in the textbook case; this scene
// is a direct, literal render of that system's trajectory through 3D
// space, not an artist's impression of what chaos might look like.
//
// SIGMA (the Prandtl number: how much the fluid's viscosity resists motion
// relative to how well it conducts heat), RHO (the Rayleigh number: how
// strongly convection is being driven — think "how hard is this being
// heated from below"), and BETA (a geometric ratio tied to the shape of
// the convection cell) are STRUCTURAL, not just aesthetic dials — this
// specific trio (10, 28, 8/3) is the well-known parameter set where the
// system is chaotic AND produces the two-lobed butterfly attractor
// specifically. Changing them isn't guaranteed to just "look different" —
// push RHO below roughly 24.74 and the chaotic behavior can collapse
// entirely into a fixed point or a simple periodic loop (the trajectory
// spirals down to a single resting point or a repeating circuit instead of
// wandering forever); push the three far out of their classical ratios and
// the two lobes can merge, shrink unevenly, or the whole shape can blow up
// toward infinity. Small nudges (a few percent) are reasonably safe to
// experiment with and will visibly reshape the lobes; large ones need
// actually checking the trajectory stays bounded, not just eyeballing it.
//
// DT is TUNABLE, but is a numerical-stability knob, not a shape knob: it's
// the timestep for the Euler integration below (see lorenzStep), i.e. how
// far along the curve one step advances per call. Smaller DT traces the
// same curve more smoothly/accurately at the cost of needing more steps to
// cover the same distance; push DT too large and the simple Euler method
// used here can overshoot and destabilize instead of tracing the real
// curve (the trajectory visibly breaks up or flies apart rather than
// looking like a rougher butterfly).
const SIGMA = 10, RHO = 28, BETA = 8 / 3;
const DT = 0.005;

// Seven near-identical starting points — most pairs differ by as little as
// 0.000001 in a single coordinate — deliberately chosen to demonstrate the
// Lorenz system's own namesake property: sensitive dependence on initial
// conditions, i.e. the actual "butterfly effect" (a butterfly flapping its
// wings in Brazil could, in principle, be the difference in a tornado
// forming in Texas — Lorenz's own metaphor for this exact mathematical
// behavior, and *why* this attractor's shape looks like a butterfly is a
// separate, unrelated coincidence from the phrase). Each of these seven
// trajectories starts on essentially the same point and, run through the
// identical equations below, visibly diverges onto its own distinct path
// after enough steps — that divergence is the entire point of rendering
// seven trails instead of one, not a visual-variety choice.
const TRAJECTORIES = [
  { x:  0.1,       y: 0.0,      z: 20.0,      color: new THREE.Color(1.0,  1.0,  0.95) },
  { x:  0.100001,  y: 0.0,      z: 20.0,      color: new THREE.Color(1.0,  0.82, 0.28) },
  { x:  0.1,       y: 0.000001, z: 20.0,      color: new THREE.Color(1.0,  0.45, 0.05) },
  { x:  0.1,       y: 0.0,      z: 20.000001, color: new THREE.Color(1.0,  0.62, 0.12) },
  { x: -0.1,       y: 0.0,      z: 20.0,      color: new THREE.Color(1.0,  0.38, 0.0)  },
  { x:  0.1,       y: 0.000002, z: 20.0,      color: new THREE.Color(1.0,  0.28, 0.04) },
  { x:  0.100002,  y: 0.0,      z: 20.0,      color: new THREE.Color(1.0,  0.88, 0.45) },
];

// One Euler-integration step of the Lorenz ODEs — the simplest possible
// numerical method for "how does this point move next": compute the
// instantaneous rate of change (dx, dy, dz) from the CURRENT position,
// then nudge the position by rate * DT (a first-order approximation —
// good enough here because DT is small and this only needs to look
// physically plausible, not survive rigorous numerical-accuracy scrutiny).
// The three equations themselves, term by term:
function lorenzStep(p) {
  // dx/dt = sigma*(y - x): x chases y, at a rate set by sigma. On its own
  // this term alone would just pull x and y together and settle down —
  // it's the coupling with the other two equations below that keeps the
  // whole system perpetually unsettled instead.
  const dx = SIGMA * (p.y - p.x);
  // dy/dt = x*(rho - z) - y: the system's actual engine of instability —
  // x multiplying (rho - z) is a genuine nonlinear term (x times a
  // function of z, not a plain linear combination), and nonlinearity like
  // this is exactly what allows chaotic, never-repeating behavior; a
  // purely linear system of equations could only ever spiral into a fixed
  // point or a perfectly repeating cycle, never true chaos. The trailing
  // `- y` is a linear damping term pulling y back down on its own.
  const dy = p.x * (RHO - p.z) - p.y;
  // dz/dt = x*y - beta*z: another nonlinear product (x times y) driving z
  // upward, opposed by a linear decay (-beta*z) pulling it back down —
  // same push/pull shape as the y equation, different pair of variables.
  const dz = p.x * p.y - BETA * p.z;
  p.x += dx * DT; p.y += dy * DT; p.z += dz * DT;
}

// Not part of the Lorenz math itself — a bookkeeping helper so the whole
// shape renders centered in view instead of off to one side. A trajectory
// starting at (0.1, 0, 20) begins on a transient approach path before it
// actually settles onto the attractor proper (the repeating double-lobe
// shape) — the first 2000 steps here are thrown away for exactly that
// reason (TUNABLE in principle, but 2000 is already comfortably past the
// point any of these starting points has settled; shortening it risks
// measuring the discarded approach path instead of the actual attractor).
// The following 6000 steps then just track a running bounding box
// (min/max on each axis) of a point that's actually on the attractor,
// and the returned "center" is that box's midpoint — a numerical measurement
// of where the shape actually sits in space, not a hand-picked offset.
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
  const PPF       = preview ? 2    : 4;

  // ─── Scene ──────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, preview ? 0.012 : 0.006);

  const camera = new THREE.PerspectiveCamera(45, w/h, 0.1, 500);
  camera.position.set(preview ? 5 : 40, preview ? 15 : 35, preview ? 65 : 130);
  camera.lookAt(preview ? 0 : 0, preview ? 5 : 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.width  = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  // ─── Label + hint (full only) ────────────────────────────────────────────
  // Owned by this scene's own create()/dispose() lifecycle, same as every
  // other scene's hint/caption/title (see sphere.js for the reference
  // pattern). Markup lives in butterfly.html; both elements mount on
  // document.body rather than inside `container` — see butterfly.css's
  // header comment for why.
  let expLabel = null, hint = null;
  if (!preview) {
    const frag = parseHTML(butterflyHtml);
    expLabel = frag.querySelector('.butterfly-exp-label-row');
    hint = frag.querySelector('.butterfly-hint');
    document.body.appendChild(expLabel);
    document.body.appendChild(hint);
  }

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
  // Set by dispose() below — guards the async font-load callback further
  // down from touching a texture that's already been disposed, if the
  // scene is torn down before Arapey finishes loading.
  let symbolsDisposed = false;
  if (!preview) {
    const symbols = [
      'σ','ρ','β','λ','∂','∇','∞','π','Δ','ω','φ','ψ','θ','α',
      'dx/dt','dy/dt','dz/dt','σ(y−x)','8/3','28','10',
      'f(x)','∫','∑','lim','→','ℝ³','ẋ','ẏ','ż','βz','ρ−z',
    ];
    // Site-wide serif swap (2026-08-25/26): these symbol sprites now draw
    // in Arapey, a real webfont, rather than the system "Times New Roman"
    // they used before — but this whole array is built once, synchronously,
    // right here at scene mount, and each texture is a static canvas bitmap
    // that (unlike DOM text) never repaints itself once painted. If Arapey
    // hasn't finished loading yet at this exact moment, the first paint
    // below falls back to plain serif and would stay that way for the
    // scene's entire lifetime with no further correction. So each entry
    // keeps a `redraw()` closure over its own canvas/ctx, drawn once
    // immediately (so the scene never waits on network before rendering,
    // same as every other scene's synchronous mount) and re-run once
    // document.fonts.load() actually resolves, flagging the existing
    // CanvasTexture object (shared by reference across every sprite that
    // uses it — see textures[] below) with needsUpdate rather than
    // creating and reassigning new Texture objects to 220 sprites.
    function makeSymbolTexture(text) {
      const c = document.createElement('canvas');
      c.width=128; c.height=64;
      const cx=c.getContext('2d');
      const tex = new THREE.CanvasTexture(c);
      const paint = () => {
        cx.clearRect(0,0,c.width,c.height);
        cx.font='italic 22px "Arapey", serif';
        cx.fillStyle='rgba(200,220,255,0.7)';
        cx.textAlign='center'; cx.textBaseline='middle';
        cx.fillText(text,64,32);
      };
      paint();
      return { tex, redraw() { paint(); tex.needsUpdate = true; } };
    }
    const symbolEntries = symbols.map(makeSymbolTexture);
    const textures = symbolEntries.map(e => e.tex);
    // .catch: font-loading failure just means the fallback serif sticks
    // around, not a scene-breaking error.
    document.fonts.load('italic 22px "Arapey"').then(() => {
      if (!symbolsDisposed) symbolEntries.forEach(e => e.redraw());
    }).catch(() => {});
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
  const reduceMotion = prefersReducedMotion();
  let autoJitter = !reduceMotion;
  let autoRotate = !preview && !reduceMotion; // slow camera orbit
  const ROTATE_SPEED = 0.0008;

  // Standard spherical-to-Cartesian conversion — the camera orbits at a
  // fixed distance (radius) from the origin, and phi (angle down from the
  // +Y "up" axis) / theta (angle around that axis) are the two knobs drag-
  // to-orbit and the slow auto-rotate below actually change frame to
  // frame; this is just the formula that turns those two angles plus a
  // distance back into an x/y/z position to point the camera from.
  function updateCamera() {
    camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
    camera.position.y = spherical.radius * Math.cos(spherical.phi);
    camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
    camera.lookAt(0,0,0);
  }

  // Drag-to-orbit + wheel zoom, via sceneKit — shared with every other
  // scene's camera controls rather than a separate implementation.
  let orbitDrag = null, wheelZoom = null;
  if (!preview) {
    orbitDrag = bindOrbitDrag(container, {
      sensitivity: 0.005,
      onDragStart: () => { autoJitter = false; },
      onDrag: (dx, dy) => {
        spherical.theta -= dx;
        spherical.phi = Math.max(.1, Math.min(Math.PI - .1, spherical.phi + dy));
      },
      onDragEnd: () => { setTimeout(() => { autoJitter = true; }, 3000); },
    });
    wheelZoom = bindWheelZoom(container, {
      onZoom: deltaY => { spherical.radius = Math.max(40, Math.min(220, spherical.radius + deltaY * 0.08)); },
    });
  }

  // ─── Resize ─────────────────────────────────────────────────────────────────
  const resizeCtl = bindGuardedResize(container, (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

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
    if (autoRotate && !(orbitDrag && orbitDrag.isDragging)) {
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
        // Fade-in only, not part of the Lorenz math: brand-new trails ramp
        // from 30% brightness up to full as they fill their buffer for the
        // first time (trail.count/MAX_PTS goes 0->1), so a trail doesn't
        // pop in at full brightness the instant it starts. Once full
        // (count reaches MAX_PTS and the ring buffer starts overwriting
        // its own oldest points), b just stays at 1.0 permanently.
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
      // Not Lorenz math — a separate, simpler physical analogy: this is an
      // inverse-square attraction, the same functional shape as Newtonian
      // gravity or Coulomb's law (force/displacement falls off as 1 over
      // distance-squared), used here purely for the visual of the grid
      // sagging toward the butterfly like a mass sitting on a rubber sheet
      // ("spacetime" is a deliberate, tongue-in-cheek name — this is not a
      // real relativity simulation, just borrowing the shape of the curve).
      // displacement = PULL_STRENGTH / (dist^2 + SOFTENING)
      //
      // PULL_STRENGTH: TUNABLE — the strength of the attraction. Raise it
      // and every grid vertex gets tugged harder toward the butterfly's
      // current position (a more dramatic sag); 0 would leave the grid
      // perfectly flat/undistorted.
      const PULL_STRENGTH = 40;
      // SOFTENING: TUNABLE, but a stability knob more than a visual one —
      // added to dist^2 before dividing specifically so a vertex that ends
      // up extremely close to the butterfly (dist approaching 0) doesn't
      // divide by a near-zero number and spike toward infinity. Lowering
      // it lets nearby vertices get pulled in harder before the MAX_DISP
      // cap below takes over; it can't be zero without risking exactly
      // the division blow-up it exists to prevent.
      const SOFTENING     = 18;  // prevents division by zero and clamps max pull
      // MAX_DISP: TUNABLE hard ceiling — no vertex can ever move farther
      // than this many units from its rest position, however close the
      // butterfly gets. Without this second cap, a vertex passed directly
      // through by the butterfly would still be governed only by
      // SOFTENING, which softens but doesn't strictly bound the result.
      const MAX_DISP      = 4;  // hard cap on displacement

      let vIdx = 0; // global vertex index across all lines
      for (const { geo, posArr, vertexCount } of gridLines) {
        for (let vi = 0; vi < vertexCount; vi++) {
          const rest = gridVertexRestPositions[vIdx];
          const rx = rest.x, ry = rest.y, rz = rest.z;

          // Vector from this vertex's rest position to the butterfly's
          // current position, and its length (dist) and squared length
          // (dist2, cheaper to compute and all the inverse-square law
          // actually needs).
          const dx = butterflyPos.x - rx;
          const dy = butterflyPos.y - ry;
          const dz = butterflyPos.z - rz;
          const dist2 = dx*dx + dy*dy + dz*dz;
          const dist  = Math.sqrt(dist2);
          // `pull` is a single scalar fraction (of the full dx/dy/dz
          // vector) applied below — Math.min between the raw inverse-
          // square falloff and MAX_DISP re-expressed as its own fraction
          // (MAX_DISP / dist) means whichever constraint is stricter at
          // this exact distance wins, point by point, rather than
          // computing the inverse-square value and clamping it after —
          // mathematically equivalent here since both are being compared
          // as the same "fraction of the vector to move," just written as
          // one min() instead of a separate clamp step.
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
      symbolsDisposed = true;
      resizeCtl.dispose();
      orbitDrag?.dispose();
      wheelZoom?.dispose();
      expLabel?.remove();
      hint?.remove();
      // THREE.js resource cleanup: disposes the spacetime grid's line
      // geometries/materials, both trail sets' geometries/materials, and
      // (full scene only) the 220 math-symbol sprites' materials/textures.
      // Textures/materials are shared across many sprites, so disposing the
      // same one more than once here is harmless — THREE.js no-ops a
      // repeat dispose() call.
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
