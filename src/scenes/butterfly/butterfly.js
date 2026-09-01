import * as THREE from 'three';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion, parseHTML,
  claimContainer, manageRenderer, trackTimers,
} from '../../utils/sceneKit.js';
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
  // The x argument was `preview ? 0 : 0` until v4.0 — a copy-paste artifact
  // from the camera.position.set line above, where all three arguments really
  // do differ. The y ternary below IS live and stays: preview never calls
  // updateCamera(), so this one lookAt is the whole of a preview tile's
  // framing, and it aims slightly above the origin on purpose.
  camera.lookAt(0, preview ? 5 : 0, 0);

  // Pixel ratio, real GL-context release and the webglcontextlost handler all
  // via manageRenderer (v4.0). Uncapped setPixelRatio meant a DPR-3 phone
  // rendered nine times the fragments this scene's look was tuned against —
  // and this is a heavy overdraw case (every trail, glow and symbol is
  // transparent and additive). See manageRenderer's own comment in
  // sceneKit.js for why renderer.dispose() alone doesn't free the context.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  const managedRenderer = manageRenderer(renderer);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.width  = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  // ─── Claiming the shared container ──────────────────────────────────────
  // #experience-container is one node main.js reuses between scenes — it
  // clears innerHTML, never replaces the element — so every inline style a
  // scene writes here outlives it. Butterfly is one of the four scenes that
  // never set `cursor` and was therefore a victim of Orrery's `cursor: none`
  // rather than a cause of anything; going through claimContainer anyway
  // means position/overflow get put back on the way out, and means there is
  // one way this is done site-wide rather than seven. Full mode only —
  // a preview tile's box is the landing page's layout, not this scene's to
  // claim.
  const containerClaim = !preview ? claimContainer(container) : null;

  // Every deferred callback this scene schedules, in one place so dispose()
  // can drop what's still pending — see the drag-end auto-jitter timer below,
  // which was the untracked one.
  const timers = trackTimers();

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
  // Spider-silk white grid whose vertices get pulled toward the butterfly.
  //
  // v4.0: three indexed THREE.LineSegments — one per material tier — where
  // there used to be 867 separate THREE.Line objects. The lattice is 17
  // Z-slices x 34 in-plane lines (578) plus a 17x17 grid of depth lines
  // (289); at SEG subdivisions each that is 4,335 vertices, which is not a
  // lot of geometry, but as 867 meshes it was 867 draw calls and 867
  // individual buffer uploads every single frame, since the distortion loop
  // below rewrites every vertex position each frame. Two orders of magnitude
  // more per-object overhead than the geometry itself warrants.
  //
  // Batching per tier is free here: the three tiers ARE the three materials,
  // and nothing else varied per line. Indexed rather than expanded into
  // segment pairs on purpose — expanding would have grown 4,335 vertices to
  // 6,936 and made the per-frame distortion loop (and the bytes it uploads)
  // proportionally bigger. With an index buffer, the position data stays
  // exactly what it was and only the indices — written once at build, never
  // touched again — know that a polyline is a run of segments.
  //
  // gridRest is likewise ONE Float32Array of home positions covering every
  // tier, replacing 4,335 separate { x, y, z } objects; each tier records
  // where its own run starts.
  let gridTiers = [];   // [{ geo, posArr, restBase, vertexCount }]
  let gridRest = null;  // one Float32Array, xyz per vertex, all tiers in order
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

    const SEG = 4; // subdivisions per grid line — this is what lets a straight line curve at all

    // Pass one: collect every line's endpoints, grouped by the tier
    // (material) it belongs to. Endpoints only, no buffers yet — the real
    // vertex total has to be known before a single Float32Array is sized,
    // which is the whole reason this is two passes instead of the old
    // allocate-as-you-go makeGridLine().
    const tiers = [
      { mat: majorMat, lines: [] },
      { mat: minorMat, lines: [] },
      { mat: depthMat, lines: [] },
    ];
    const [majorTier, minorTier, depthTier] = tiers;

    // XY planes at each Z slice — segmented so they can curve
    for (let z = -dep; z <= dep; z += step) {
      const tier = (Math.abs(z) % (step*2) === 0) ? majorTier : minorTier;
      for (let x = -ext; x <= ext; x += step) tier.lines.push([x,-ext,z, x,ext,z]);
      for (let y = -ext; y <= ext; y += step) tier.lines.push([-ext,y,z, ext,y,z]);
    }
    // Z-depth lines
    for (let x = -ext; x <= ext; x += step)
      for (let y = -ext; y <= ext; y += step)
        depthTier.lines.push([x,y,-dep, x,y,dep]);

    // Pass two: one position buffer, one index buffer and one LineSegments
    // per tier, plus that tier's slice of the shared rest-position array.
    const totalVerts = tiers.reduce((n, t) => n + t.lines.length * (SEG + 1), 0);
    gridRest = new Float32Array(totalVerts * 3);

    let restBase = 0;
    for (const tier of tiers) {
      const vertexCount = tier.lines.length * (SEG + 1);
      const posArr = new Float32Array(vertexCount * 3);
      // Two indices per segment. setIndex() picks Uint16 or Uint32 off the
      // real vertex count itself rather than this code guessing which is
      // wide enough.
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
      // The distortion loop moves vertices up to MAX_DISP off their rest
      // positions, which the build-time bounding sphere doesn't know about;
      // the lattice also surrounds the camera at all times, so per-object
      // culling had nothing to win here even before this was three objects.
      segments.frustumCulled = false;
      scene.add(segments);
      gridTiers.push({ geo, posArr, restBase, vertexCount });
      restBase += vertexCount;
    }
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
  // Per-instance drift/pulse state, one plain object per symbol — the
  // rendered state itself lives in the instanced attribute arrays below, not
  // in a THREE object per sprite.
  const spriteData = [];
  const SPRITE_COUNT = 220;
  let spriteMesh = null, spriteMat = null, spriteGeo = null, symbolAtlasTex = null;
  let spriteOffsets = null;  // Float32Array, xyz per instance — rewritten every frame
  let spriteOpacity = null;  // Float32Array, one per instance — rewritten every frame
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
    // v4.0: one texture atlas and one instanced billboard mesh, where this
    // used to be 32 separate CanvasTextures and 220 THREE.Sprite objects.
    // A Sprite cannot batch, and these in particular could never have shared
    // a material anyway — each one animates its own opacity — so 220 sprites
    // meant 220 draw calls per frame on top of the grid's own, for 220 quads.
    // The 32 symbol cells now live side by side on one canvas; per-instance
    // position, size, atlas cell and opacity become instanced attributes; and
    // the billboarding below is the same view-space offset THREE.Sprite's own
    // shader does, written out here so the whole set is a single mesh.
    //
    // Site-wide serif swap (2026-08-25/26): these symbols draw in Arapey, a
    // real webfont, rather than the system "Times New Roman" they used
    // before — but the atlas is painted once, synchronously, right here at
    // scene mount, and a canvas bitmap (unlike DOM text) never repaints
    // itself once painted. If Arapey hasn't finished loading at this exact
    // moment, that first paint falls back to plain serif and would stay that
    // way for the scene's entire lifetime with no further correction. So
    // paintAtlas() is kept as a closure, run once immediately (the scene
    // never waits on the network before rendering, same as every other
    // scene's synchronous mount) and re-run once document.fonts.load()
    // actually resolves — flagging the one existing CanvasTexture with
    // needsUpdate. One repaint now, where it used to be 32.
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
    // .catch: font-loading failure just means the fallback serif sticks
    // around, not a scene-breaking error.
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
      // Canvas rows run top-down and UV space runs bottom-up, and the
      // texture's default flipY is what reconciles them — so cell row 0 (the
      // canvas's top row) is the TOP of UV space, not the bottom.
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

    // A unit quad from -0.5 to 0.5 — exactly the geometry THREE.Sprite uses,
    // so `position.xy * iScale` below lands in the same place Sprite's own
    // alignedPosition did.
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

    // fog:true plus UniformsLib.fog is what keeps these matching what
    // SpriteMaterial did for free — Material.fog defaults to true, so the old
    // sprites WERE fogged, and this scene's FogExp2 is strong enough at the
    // camera's own working distance that dropping it would visibly brighten
    // every distant symbol. #include <colorspace_fragment> is the other half
    // of matching: the atlas texture is left at the default colour space,
    // same as the 32 textures it replaces, so the output encoding has to
    // happen in exactly the same place it did in SpriteMaterial's shader.
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
          // Billboarding, the same way THREE.Sprite does it: take the
          // instance's position into view space, then offset within the view
          // plane. The quad therefore always faces the camera and still
          // shrinks with distance, which is Sprite's default sizeAttenuation.
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
    // Assigned after the merge: UniformsUtils.merge clones every uniform
    // value it is handed, and a cloned Texture is a second, un-disposable
    // copy of the same atlas.
    spriteMat.uniforms.map.value = symbolAtlasTex;

    spriteMesh = new THREE.Mesh(spriteGeo, spriteMat);
    // Instance positions live in an attribute, not in the geometry's own
    // bounds, so three's frustum test would be reading a 1x1 quad at the
    // origin — and these deliberately surround the camera anyway.
    spriteMesh.frustumCulled = false;
    scene.add(spriteMesh);
  }

  // ─── Orbit controls (full only) ─────────────────────────────────────────────
  let spherical = {
    radius: camera.position.length(),
    phi:    Math.acos(camera.position.y / camera.position.length()),
    theta:  Math.atan2(camera.position.x, camera.position.z),
  };
  const reduceMotion = prefersReducedMotion();
  // Both of these are seeded from reduceMotion, but only autoRotate stays
  // truthful on its own: onDragEnd below sets autoJitter back to true
  // unconditionally, so before v4.0 a single drag handed a reduced-motion
  // visitor continuous random jitter for the rest of the scene's life —
  // exactly the motion they asked not to be given, three seconds after
  // touching the scene at all. The fix is the one Sphere already uses:
  // re-check reduceMotion where the flag is CONSUMED (see animate()), not
  // only where it is set, so no code path can re-enable motion by forgetting
  // about it.
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
      // Through trackTimers so dispose() drops it — a bare setTimeout here
      // kept a closure over this scene alive for three seconds after the
      // visitor had already left it.
      onDragEnd: () => { timers.after(3000, () => { autoJitter = true; }); },
    });
    wheelZoom = bindWheelZoom(container, {
      onZoom: deltaY => { spherical.radius = Math.max(40, Math.min(220, spherical.radius + deltaY * 0.08)); },
    });
  }

  // ─── Resize ─────────────────────────────────────────────────────────────────
  const resizeCtl = bindGuardedResize(container, (w, h) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Re-applied here too: a window dragged between a Retina and a
    // non-Retina display changes devicePixelRatio with no other signal.
    managedRenderer.applyPixelRatio();
    renderer.setSize(w, h);
  });

  // ─── Jitter state ────────────────────────────────────────────────────────────
  let rotVelX=0,rotVelY=0,rotVelZ=0;
  let rotX=-1.52,rotY=0.0,rotZ=0.05;
  let t=0, animId = null;
  // main.js pauses preview tiles while a full scene is open and pauses the
  // open scene on visibilitychange (see its syncPreviewPlayback comment).
  // display:none does not stop a requestAnimationFrame loop, so before this
  // every preview kept issuing its draw calls behind an opaque overlay.
  let paused = false;

  // Current butterfly world-space centroid (for grid distortion)
  const butterflyPos = new THREE.Vector3();

  function animate() {
    animId = requestAnimationFrame(animate);
    t += 0.008;

    // Butterfly jitter — reduceMotion is re-checked HERE, at the point of
    // consumption, not only where autoJitter is assigned (see its
    // declaration above for the bug that made this necessary).
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

      for (const { geo, posArr, restBase, vertexCount } of gridTiers) {
        for (let vi = 0; vi < vertexCount; vi++) {
          // Rest positions come out of the one shared Float32Array at this
          // tier's own offset — three reads out of a contiguous buffer,
          // rather than dereferencing one of 4,335 { x, y, z } objects.
          const r = (restBase + vi) * 3;
          const rx = gridRest[r], ry = gridRest[r+1], rz = gridRest[r+2];

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
        }
        geo.attributes.position.needsUpdate = true;
      }

      // Drift math sprites — straight into the instanced attribute arrays.
      //
      // The wrap test used to read `for (const ax of ['x','y','z'])`, which
      // allocated a fresh three-element array AND its iterator per sprite per
      // frame: 220 sprites at 120fps is ~53,000 throwaway objects a second to
      // save writing three comparisons out twice. Unrolled below.
      const b = 70;
      for (let i = 0; i < SPRITE_COUNT; i++) {
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
      // Two buffer uploads for the whole set, replacing 220 per-object matrix
      // updates and 220 material-uniform writes.
      spriteGeo.attributes.iOffset.needsUpdate = true;
      spriteGeo.attributes.iOpacity.needsUpdate = true;
    }

    renderer.render(scene, camera);
  }
  animate();

  return {
    // main.js calls this on every preview tile while a full scene is open,
    // on any tile scrolled off screen, and on the open scene when the tab is
    // hidden. Stopping the loop outright rather than running it to an early
    // return: a paused tile should cost nothing at all, not one no-op
    // callback per frame. This scene integrates from a fixed per-frame `t`
    // rather than a wall clock, so there is no clock to resync on the way
    // back in — the Lorenz trails simply resume where they stopped, which is
    // exactly right for a trajectory that has no notion of real time.
    setPaused(next) {
      const want = Boolean(next);
      if (want === paused) return;
      paused = want;
      if (paused) {
        cancelAnimationFrame(animId);
        animId = null;
      } else {
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
      // THREE.js resource cleanup: the spacetime grid's three batched
      // geometries and their materials, both trail sets' geometries/
      // materials, and (full scene only) the instanced symbol set — one
      // geometry, one material and one atlas texture where this used to be
      // 220 materials and 32 textures.
      gridTiers.forEach(g => g.geo.dispose());
      gridMats.forEach(m => m.dispose());
      trails.forEach(tr => { tr.geo.dispose(); tr.mat.dispose(); });
      glowTrails.forEach(tr => { tr.geo.dispose(); tr.mat.dispose(); });
      spriteGeo?.dispose();
      spriteMat?.dispose();
      symbolAtlasTex?.dispose();
      // renderer.dispose() + forceContextLoss() + canvas removal, in one
      // call — see manageRenderer in sceneKit.js for why the plain
      // renderer.dispose() this used to do never actually freed the context.
      managedRenderer.dispose();
      containerClaim?.restore();
    }
  };
}
