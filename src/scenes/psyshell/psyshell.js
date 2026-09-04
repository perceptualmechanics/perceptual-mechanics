import * as THREE from 'three';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, prefersReducedMotion,
  createJumpList, bindTapVsDrag, mountClippedPreviewCanvas, parseHTML,
  claimContainer, manageRenderer, createFrameClock, trackTimers,
  bindPersistedSoundToggle, onReducedMotionChange,
} from '../../utils/sceneKit.js';
import './psyshell.css';
import psyshellHtml from './psyshell.html?raw';
import { TEXTS, SOURCES, SOURCE_OF, FILAPIXEL_COUNT, baseEDigits } from './psyshell.text.js';
import { SEGMENTS, NUBS, BOUNDS, LENS_ID, placeFilapixels, pathToTip } from './psyshell.object.js';
import { buildWeb } from './psyshell.web.js';
// The worklet runs in another global and must reach the audio thread as a
// FILE, not as part of this chunk. `new URL(..., import.meta.url)` is the form
// the bundler understands as "emit this as an asset and give me its hashed
// URL"; `?url` also works and emits the file twice — once raw and once
// minified, with only the raw one referenced, which ships 2 kB nobody loads.
// See the worklet's own header for what runs in there.
const shiverWorkletUrl = new URL('./psyshell.shiver.worklet.js', import.meta.url).href;

// ─── Psyshell — the lens ────────────────────────────────────────────────────
//
//   …opens it to reveal a crystalline fractalanch, two inches long, shaped like
//   the antler of an imaginary animal, all branches and nubs.
//
//   "It was as we feared."  "How did it get lost during screening?"
//
//   Untgract pulls down a lightpen, activates it, reads the object. A screen
//   appears, reams of data. Then it goes in a jar on the bottom shelf, among
//   thousands more, in various shapes.
//
// ─── What the scene is about, which is the thing it did not have ────────────
// v4.6.0 was a chrysanthemum and v4.7.0 was a branch, and both were geometry
// that encoded the corpus. Neither had a subject. **A pretty object on a green
// field that makes a sound when you click it is not a scene** — Scott's own
// naming, and the correct one. The two forms' rigour (Murray's law,
// phyllotaxis, √contribution arcs) was justification supplied where a subject
// was needed.
//
// The subject is in the manuscript and was there the whole time: **a lens that
// should not have survived screening, and you are reading it.** Residue of
// taint let it slip. That makes the base-e transmission stop being an effect
// and become the point — the object gives up what it holds, in a notation not
// meant for you.
//
// It also fixes the geometry problem by making the object a sculpture rather
// than a data structure. It does not have to encode 3,221 sentences in its
// shape. It holds them. See `psyshell.object.js` — the object knows nothing
// about the corpus, and `psyshell.text.js` says why nothing should re-connect
// them.

// ─── Palette ────────────────────────────────────────────────────────────────
// The green field is gone with the flower it belonged to. This is a workshop
// bench under a lamp: a near-black warm room, a small pool of light, and a
// crystal that is cool where it catches the light and green where it does not.
//
// The green survives in exactly one place and means something there — in the
// object's interior, which is the residue of taint that let it through
// screening. It is the reason the lens is on the bench at all.
const ROOM_COLOR = 0x0a0806;
const CRYSTAL_DEEP = 0x123a2c;   // the interior: taint, seen through the body
const CRYSTAL_RIM = 0xbfe6ff;    // where an edge catches the lamp
const NUB_RIM = 0xe8f4ff;
const BENCH_WARM = 0x3a2718;
const FILAPIXEL_COLOR = 0xd8fff0;   // a strand inside the lens, and its junctions
const WEB_FAR_COLOR = 0x8fb6d8;     // a strand out in the field

// ─── Brightness ─────────────────────────────────────────────────────────────
// Re-derived by rendering and measuring peak luminance, the same way 4.7.0's
// was: an object built of overlapping additive members has to be set by what
// the pile sums to. This object is far smaller than either predecessor — 252
// segments rather than 3,221 rays — so it can afford much more per member.
const CRYSTAL_GAIN = 0.78;
const FILAPIXEL_BASE = 0.30;
const FILAPIXEL_PEAK = 3.2;
// ─── The web's brightness, and why the junctions are not drawn ──────────────
// Nothing in the field is a sprite, a disc or a marker. Every strand is drawn
// as two line segments meeting at a dark midpoint, so a node with k strands is
// k bright ends landing on the same pixels, additively. **The junction
// brightening is not a value: it is what k overlapping ends come to**, which is
// the one way to make "brightness follows strand count" true rather than
// arranged. Degrees run 1 to 17 across this web, mean 3.04.
const STRAND_END = 1.0;    // brightness at a node end of a strand
const STRAND_MID = 0.12;   // and at its dark midpoint
const NEAR_GAIN = 0.42;    // the lens's own strands
const FAR_GAIN = 0.22;     // the field's, which is far away and faint

// ─── Reading ────────────────────────────────────────────────────────────────
// Pointing the lightpen at the object excites the material locally, and the
// excitation spreads through the crystal. **Straight-line distance, and
// symmetric**, which is a change from both previous versions and the honest
// one: the Tessier curve and its forward asymmetry belonged to the flower, and
// a disturbance in a solid does not know about reading order. Nothing about the
// corpus is in this any more, which is the point.
//
// ─── Why both numbers are scaled and neither is retuned ─────────────────────
// The pair 4.3 units/s and 0.24 units came from the branch, an object whose
// paths ran five units and more. The lens is 1.7 units across, so the front
// crossed the whole object in under half a second: measured by capturing a
// strip of frames after a real click and finding the excitation already gone by
// the first one. Not a subtle failure — the scene's central gesture was
// invisible — and it was invisible because a constant survived a form change
// that changed the thing it was scaled against.
//
// Both are scaled by the same factor, which is the point. τ = SHELL / SPEED is
// invariant under it, so the transmission's digit durations, its worked example
// on the /text/ page and its by-hand verification are all untouched — the same
// 0.0558s the blossom's 24/430 gave. A front that is slower AND narrower in the
// same proportion is the same physics on a smaller object.
const PROP_SCALE = 0.42;
const PROP_SPEED = 4.3 * PROP_SCALE;    // world units per second
const PROP_SHELL = 0.24 * PROP_SCALE;   // world units — the half-width of the front
// The e-folding distance is NOT scaled with them: it is measured against the
// object's own size (radius 0.86) rather than against the front, and at 1.6 it
// fell off so little across 1.7 units that the excitation read as the whole
// object lighting at once instead of as something arriving from where you
// pointed.
const PROP_REACH = 0.9;    // world units — the e-folding distance
// Long enough to cover the sweep (1.7 units at 1.81 units/s is 0.95s) and the
// fade after it, and no longer: the old 3.0 left 1.7 seconds in which a read
// was alive with nothing left to light.
const PROP_LIFE = 2.0;     // seconds
// ─── The wake, and why the front alone was not enough ───────────────────────
// τ = SHELL / SPEED is fixed at 0.0558s by the transmission, so a slow front is
// necessarily a NARROW front — the two cannot be chosen independently. With the
// front alone, the excitation was one thin travelling band: measurable (an 18%
// lift in mean luminance over the object, one frame after the click) and, in
// practice, not seen.
//
// So the material keeps some of it after the front passes and relaxes out of
// it, which is what an excited solid does and what makes the gesture legible:
// a bright edge arriving, and a glow behind it going out. It is deliberately
// NOT part of τ and does not touch the transmission — the front is still the
// clock, and this is the material's response to it.
const PROP_WAKE = 0.55;    // share of the front's amplitude kept behind it
const PROP_RELAX = 0.8;    // world units — how far behind the front it persists
const MAX_READS = 5;

// ─── The transmission ───────────────────────────────────────────────────────
// Unchanged from 4.6.1 and 4.7.0, deliberately: it decodes, it has a by-hand
// verification, and its reasoning survives both form changes. A digit d is one
// flash lasting τ·e^(d−1); segments alternate lit and dark by place, so the
// boundaries are the digit boundaries and nothing in the train is filler.
//
// **τ is still PROP_SHELL / PROP_SPEED = 0.24 / 4.3 = 0.055814s**, the same
// number the blossom's 24/430 gave, so the digits, the durations and the worked
// example on the /text/ page have never had to be recomputed across three
// forms. See psyshell.text.js for why base e.
const DIGIT_TIME = PROP_SHELL / PROP_SPEED;
const digitDuration = d => DIGIT_TIME * Math.exp(d - 1);
const WAVE_SPEED = 0.20 / DIGIT_TIME;  // path-lengths per second
const MAX_DIGITS = 16;
// Measured, not guessed: at 3.0 with a ribbon nine tenths of the segment's own
// radius, the train rendered as a blown white bar across the tine — the digits
// were there and the light was not light. Narrower and dimmer reads as a flash
// travelling inside the crystal, which is what it is.
const TRANSMIT_GAIN = 2.0;

// The shiver's own length lives in the worklet, where the body's decay is; this
// is only how loud a reading is on the bus. STRIKE_LIFE went with the envelope
// it belonged to.
const STRIKE_GAIN = 0.16;

export function createPsyshell(container, { preview = false } = {}) {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(ROOM_COLOR);

  // A wide-ish field of view on purpose. The object is two inches, and the
  // strongest cue available without a hand in frame is perspective: a wide lens
  // close in reads as macro, a long lens far off reads as a specimen on a
  // stand. 4.7.0's branch was the second thing and looked like a herbarium
  // sheet.
  const camera = new THREE.PerspectiveCamera(52, w / h, 0.02, 60);

  const FIT_MARGIN = 1.06;
  const center = new THREE.Vector3(...BOUNDS.center);
  let lookOffsetY = 0;
  const target = new THREE.Vector3();
  let usableTop = 0, usableBottom = 1;
  let camAz = 0.7, camEl = 0.24, camZoom = 1, camDist = 4;
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

  // ─── Framing ──────────────────────────────────────────────────────────────
  // The 4.7.0 method, kept because it was hard-won: project the object's own
  // points through the actual camera and correct from what comes back, rather
  // than solving for the projection in closed form. Distance and aim point are
  // corrected in ALTERNATING passes — done together they fight, because
  // changing the distance changes what an NDC unit is worth in world height.
  //
  // **And the band is measured in the CONTAINER's coordinates.** The hint and
  // the title are fixed-position elements whose rects are viewport-relative;
  // the canvas is the container, which starts below the nav. Mixing the two put
  // 4.7.0's object exactly that far low and made a converged solver look
  // broken. That lesson is the reason this comment is here.
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
      // PLUS: the camera is placed relative to the aim point, so lowering the
      // aim lowers the camera and the object appears higher.
      lookOffsetY += ((box.maxY + box.minY) / 2 - wantMid) * camDist * Math.tan(vHalf);
      placeCamera();
    };
    for (let round = 0; round < 3; round++) { sizePass(); sizePass(); centrePass(); centrePass(); }
    camDist = camDist * FIT_MARGIN / camZoom;
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
  const timers = trackTimers();
  const clock = createFrameClock();
  let reduced = prefersReducedMotion();
  let disposed = false;

  // ─── The bench ────────────────────────────────────────────────────────────
  // The minimum that makes the object read as held and examined rather than
  // displayed: a surface under it, and a pool of lamplight on that surface
  // falling off into the dark. Not a diorama — one plane and one gradient.
  // Without it the lens floated in nothing, which is what made both previous
  // versions read as specimens.
  //
  // Cut from 14 units square to 2.6 in 4.8.1. At 14 it was a wall across the
  // bottom half of the frame and the field behind it could not be seen past its
  // own horizon — which made "filaments across the whole frame" false in the
  // half of the frame nearest the visitor. A bench with a visible far edge is
  // also more a bench than an infinite plane is.
  const benchGeo = new THREE.PlaneGeometry(2.6, 2.6);
  const benchMat = new THREE.ShaderMaterial({
    uniforms: { uWarm: { value: new THREE.Color(BENCH_WARM) }, uCentre: { value: new THREE.Vector2(0, 0) } },
    vertexShader: `
      varying vec2 vP;
      void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uWarm; varying vec2 vP;
      void main() {
        float d = length(vP - vec2(0.15, -0.2));
        // Two falloffs: a tight pool where the lamp actually lands, and a much
        // wider one so the surface does not end in a visible circle.
        // One pool and a floor, not a pool and a wide wash. The wash existed
        // so the surface would not end in a visible circle when the plane was
        // 14 units across; at 2.6 the plane IS the pool, and the wash only made
        // the far corners a dark shape occluding the field behind them — a
        // black wedge across the bottom of the frame, which is what a lit
        // surface must not be.
        float pool = exp(-d * d / 1.5) * 0.95 + 0.16;
        gl_FragColor = vec4(uWarm * pool, 1.0);
      }`,
    // Writes depth, unlike every other material in this scene. It has to: the
    // field is behind it now, and a bench you can see the sky through is not a
    // surface. Rendered first (renderOrder −1) so it is in the depth buffer
    // before a strand is tested against it.
    depthWrite: true,
  });
  const bench = new THREE.Mesh(benchGeo, benchMat);
  bench.rotation.x = -Math.PI / 2;
  bench.position.y = BOUNDS.min[1] - 0.005;
  bench.renderOrder = -1;
  scene.add(bench);

  // ─── The crystal ──────────────────────────────────────────────────────────
  // Fresnel rather than refraction. A real transmissive material would be the
  // right answer and the wrong cost — MeshPhysicalMaterial with transmission on
  // 250 instances is a screen-sized render target per frame. An edge-lit
  // fresnel over a dark interior reads as glass at this scale, and the interior
  // is where the green lives.
  const CRYSTAL_VERT = `
    varying vec3 vNormalV;
    varying vec3 vViewV;
    void main() {
      vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      vNormalV = normalize(normalMatrix * (mat3(instanceMatrix) * normal));
      vViewV = -mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`;
  const CRYSTAL_FRAG = `
    uniform vec3 uDeep; uniform vec3 uRim; uniform float uGain;
    varying vec3 vNormalV; varying vec3 vViewV;
    void main() {
      float f = 1.0 - clamp(dot(normalize(vNormalV), normalize(vViewV)), 0.0, 1.0);
      f = pow(f, 2.4);
      vec3 col = mix(uDeep, uRim, f);
      // The constant term is the interior. It is not 0.0 and should not be:
      // the green under the surface is the residue of taint, and a body that
      // only exists at its edges is a wireframe.
      gl_FragColor = vec4(col * (0.30 + 0.70 * f) * uGain, 1.0);
    }`;
  const makeCrystalMat = rim => new THREE.ShaderMaterial({
    uniforms: {
      uDeep: { value: new THREE.Color(CRYSTAL_DEEP) },
      uRim: { value: new THREE.Color(rim) },
      uGain: { value: CRYSTAL_GAIN },
    },
    vertexShader: CRYSTAL_VERT,
    fragmentShader: CRYSTAL_FRAG,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });

  const stemGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
  const nubGeo = new THREE.IcosahedronGeometry(1, 0);
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

  // ─── The web ──────────────────────────────────────────────────────────────
  // One structure at two magnifications. The 3,221 filapixels are the near
  // nodes — the sentences, where they always were, inside the crystal — and the
  // far field is generated around them; strands connect both, and fourteen
  // bridge strands run from the lens's outermost nodes out into the field, so
  // the object is OF the web rather than posed in front of a picture of one.
  //
  // Two meshes rather than one, and the split is not cosmetic: the near half's
  // brightness changes every frame while the lens is being read, and the far
  // half never changes at all. Uploading the whole buffer each frame to animate
  // the part that can move would be paying for the field's indifference.
  const placed = placeFilapixels(FILAPIXEL_COUNT);
  const web = buildWeb(placed.pos, FILAPIXEL_COUNT, { center: BOUNDS.center, radius: BOUNDS.radius });

  // The excitation, one value per sentence. It starts at zero rather than at a
  // base level, because a strand's resting brightness is now the strand's own
  // (aBright) and this array carries only what a read adds.
  const levels = new Float32Array(FILAPIXEL_COUNT);

  // Each strand becomes two segments meeting at a dark midpoint: four vertices,
  // bright at the two node ends. See psyshell.web.js for why a junction is
  // never drawn as a thing in its own right.
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
      // A bridge — one end in the lens, one in the field — is the faintest
      // thing in the frame. It is there to say the object is OF the web; three
      // bright lines leaving the object read as something drawn on top of the
      // picture, which is what the first render of this release looked like.
      const bridge = (a < FILAPIXEL_COUNT) !== (b < FILAPIXEL_COUNT);
      const end = bridge ? STRAND_END * 0.22 : STRAND_END;
      const mid = bridge ? STRAND_MID * 0.22 : STRAND_MID;
      put(ax, ay, az, end, a < FILAPIXEL_COUNT ? a : -1);
      put(mx, my, mz, mid, -1);
      put(mx, my, mz, mid, -1);
      put(bx, by, bz, end, b < FILAPIXEL_COUNT ? b : -1);
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
  const farMat = strandMat(WEB_FAR_COLOR, FAR_GAIN, 0);
  const nearLines = new THREE.LineSegments(nearWeb.geo, nearMat);
  const farLines = new THREE.LineSegments(farWeb.geo, farMat);
  nearLines.frustumCulled = false;
  farLines.frustumCulled = false;
  lens.add(nearLines);
  // The far field is not in the lens group. It is not the object's
  // surroundings — it is what the object is a fragment of, and it does not
  // belong to it.
  scene.add(farLines);

  // Which near-mesh vertices belong to which sentence, so a read can be written
  // into the strands leaving it without walking the whole buffer.
  const nearNodeOf = nearWeb.node;

  // ─── Sound ────────────────────────────────────────────────────────────────
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
    // Fetched as soon as there is a context, so the first reading is not the
    // one that waits for a network round trip.
    loadShiver();
  }

  function setSoundEnabled(on) {
    // The guard every scene with a persisted toggle carries:
    // bindPersistedSoundToggle leaves a first-gesture listener on the shared
    // #experience-container, which main.js empties but never replaces.
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

  // ─── The shiver ───────────────────────────────────────────────────────────
  // Not a strike. A strike is an impact and this is a body responding, and the
  // difference lives in the first forty milliseconds — which is why the sound
  // moved to an AudioWorklet rather than being re-enveloped. The DSP and the
  // reasoning are in `psyshell.shiver.worklet.js`; what is here is the graph,
  // the pitch, and the dispose discipline.
  //
  // **The earlier note about the click stands and is not contradicted.** Scott
  // liked the strike's click and asked for it to be left alone, and it was, for
  // two releases. This release is not a fix of that sound; it is a different
  // gesture, asked for as one.
  //
  // The pitch still comes from the filapixel's height in the object rather than
  // from the sentence: it is a property of where the lightpen is pointed.
  let shiverNode = null;
  let shiverReady = null;
  let shiverFailed = false;

  function loadShiver() {
    if (!audioCtx || shiverNode || shiverFailed) return shiverReady;
    shiverReady = audioCtx.audioWorklet.addModule(shiverWorkletUrl).then(() => {
      if (disposed || !audioCtx || audioCtx.state === 'closed') return;
      shiverNode = new AudioWorkletNode(audioCtx, 'psyshell-shiver', {
        numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1],
      });
      shiverNode.connect(busGain);
    }).catch(() => {
      // A worklet that will not load is not a reason for a silent scene to also
      // be a broken one: the scene keeps working, without the sound. Recorded
      // as a flag rather than swallowed, so the fallback is visible to anything
      // that asks.
      shiverFailed = true;
    });
    return shiverReady;
  }

  function strike(index) {
    if (!audioCtx || !soundEnabled) return;
    const y = placed.pos[index * 3 + 1];
    const t = Math.max(0, Math.min(1, (y - BOUNDS.min[1]) / Math.max(1e-6, BOUNDS.max[1] - BOUNDS.min[1])));
    const hz = 620 * Math.pow(2, -1.15 * (1 - t));
    const send = () => {
      if (disposed || !shiverNode || !soundEnabled) return;
      shiverNode.port.postMessage({ type: 'shiver', hz, gain: STRIKE_GAIN });
    };
    if (shiverNode) send();
    else loadShiver()?.then(send);
  }

  // ─── Transmitters ─────────────────────────────────────────────────────────
  // A reading runs outward from where the lightpen touched, along the branch it
  // touched, to a tip. The geometry is built per reading because the path is —
  // there are at most five of them and each is a ribbon of a few segments.
  const TRANSMIT_VERT = `
    attribute float aX;
    varying float vX;
    void main() { vX = aX; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const TRANSMIT_FRAG = `
    uniform float uBounds[${MAX_DIGITS}];
    uniform int uCount; uniform float uTime; uniform float uSpeed;
    uniform vec3 uColor; uniform float uGain;
    varying float vX;
    void main() {
      // Emitted where the pen touched, arriving further along later.
      float tp = uTime - vX / uSpeed;
      float level = 0.0;
      if (tp >= 0.0) {
        for (int i = 0; i < ${MAX_DIGITS}; i++) {
          if (i >= uCount) break;
          if (tp < uBounds[i]) { level = mod(float(i), 2.0) < 0.5 ? 1.0 : 0.0; break; }
        }
      }
      gl_FragColor = vec4(uColor * level * uGain * ${TRANSMIT_GAIN.toFixed(2)}, 1.0);
    }`;

  const transmitters = [];
  for (let i = 0; i < MAX_READS; i++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uBounds: { value: new Float32Array(MAX_DIGITS) },
        uCount: { value: 0 },
        uTime: { value: 0 },
        uSpeed: { value: WAVE_SPEED },
        uColor: { value: new THREE.Color(FILAPIXEL_COLOR) },
        uGain: { value: 1 },
      },
      vertexShader: TRANSMIT_VERT,
      fragmentShader: TRANSMIT_FRAG,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      // Coplanar with the crystal it overlays, so a LESS depth test would
      // reject it. Not the cause of any bug — said because 4.6.1's comment
      // originally claimed it was.
      depthTest: false,
      transparent: true,
    });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    mesh.renderOrder = 10;
    mesh.frustumCulled = false;
    mesh.visible = false;
    lens.add(mesh);
    transmitters.push({ mesh, mat, active: false, t: 0, total: 0 });
  }

  // A ribbon along the path, as two perpendicular strips so it reads from any
  // angle, carrying normalised arc length in `aX`.
  function buildPathGeometry(start, segIndices, width) {
    const pts = [new THREE.Vector3(...start)];
    for (const si of segIndices) pts.push(new THREE.Vector3(...SEGMENTS[si].to));
    let total = 0;
    const arc = [0];
    for (let i = 1; i < pts.length; i++) { total += pts[i].distanceTo(pts[i - 1]); arc.push(total); }
    if (total < 1e-5) return null;

    const pos = [], ax = [], idx = [];
    const dir = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3();
    const ref = new THREE.Vector3(0, 1, 0), ref2 = new THREE.Vector3(1, 0, 0);
    const push = axis => {
      const base = pos.length / 3;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        dir.subVectors(b, a).normalize();
        u.crossVectors(dir, Math.abs(dir.y) > 0.9 ? ref2 : ref).normalize();
        v.crossVectors(dir, u).normalize();
        const off = axis === 0 ? u : v;
        pos.push(pts[i].x - off.x * width, pts[i].y - off.y * width, pts[i].z - off.z * width);
        pos.push(pts[i].x + off.x * width, pts[i].y + off.y * width, pts[i].z + off.z * width);
        ax.push(arc[i] / total, arc[i] / total);
        if (i > 0) {
          const o = base + (i - 1) * 2;
          idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
        }
      }
    };
    push(0); push(1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aX', new THREE.Float32BufferAttribute(ax, 1));
    g.setIndex(idx);
    return g;
  }

  function armTransmitter(index) {
    const slot = transmitters.find(t => !t.active) || transmitters[0];
    // The ordinal is now the filapixel's place in the WHOLE corpus, not within
    // its scene. That is what tells you the object holds all of it — n of 3,221
    // rather than n of 1,350 — and it is the change the lens asks for.
    const ordinal = index + 1;
    const { digits } = baseEDigits(ordinal);
    const bounds = slot.mat.uniforms.uBounds.value;
    let acc = 0;
    const n = Math.min(digits.length, MAX_DIGITS);
    for (let i = 0; i < n; i++) { acc += digitDuration(digits[i]); bounds[i] = acc; }
    for (let i = n; i < MAX_DIGITS; i++) bounds[i] = acc;
    slot.mat.uniforms.uCount.value = reduced ? 1 : n;
    if (reduced) bounds[0] = acc;
    slot.mat.uniforms.uSpeed.value = reduced ? 1e6 : WAVE_SPEED;
    slot.mat.uniforms.uTime.value = 0;
    slot.mat.uniforms.uGain.value = 1;

    const seg = placed.seg[index];
    const geo = buildPathGeometry(
      [placed.pos[index * 3], placed.pos[index * 3 + 1], placed.pos[index * 3 + 2]],
      pathToTip(seg), Math.max(0.004, SEGMENTS[seg].radius * 0.55));
    if (!geo) return;
    slot.mesh.geometry.dispose();
    slot.mesh.geometry = geo;
    slot.total = acc + (reduced ? 0 : 1 / WAVE_SPEED);
    slot.t = 0;
    slot.active = true;
    slot.mesh.visible = true;
  }

  function advanceTransmitters(dt) {
    for (const s of transmitters) {
      if (!s.active) continue;
      s.t += dt;
      if (s.t >= s.total) { s.active = false; s.mesh.visible = false; continue; }
      s.mat.uniforms.uTime.value = s.t;
      const left = 1 - s.t / s.total;
      s.mat.uniforms.uGain.value = left > 0.25 ? 1 : left / 0.25;
    }
  }

  // ─── The excitation ───────────────────────────────────────────────────────
  const reads = [];
  function readAt(index) {
    reads.push({ origin: index, t: 0 });
    if (reads.length > MAX_READS) reads.shift();
    armTransmitter(index);
    strike(index);
  }

  function advance(dt) {
    for (let i = reads.length - 1; i >= 0; i--) {
      reads[i].t += dt;
      if (reads[i].t >= PROP_LIFE) reads.splice(i, 1);
    }
    for (let i = 0; i < FILAPIXEL_COUNT; i++) levels[i] = 0;
    for (const d of reads) {
      const decay = 1 - d.t / PROP_LIFE;
      const fade = decay * decay;
      const front = reduced ? 0 : PROP_SPEED * d.t;
      const ox = placed.pos[d.origin * 3], oy = placed.pos[d.origin * 3 + 1], oz = placed.pos[d.origin * 3 + 2];
      for (let i = 0; i < FILAPIXEL_COUNT; i++) {
        const dx = placed.pos[i * 3] - ox, dy = placed.pos[i * 3 + 1] - oy, dz = placed.pos[i * 3 + 2] - oz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        // Under reduced motion nothing travels: the envelope alone, applied at
        // once and fading. The object is not stilled — it is still read, still
        // lit — but a front crossing the screen is motion.
        const s0 = reduced ? 0 : (dist - front) / PROP_SHELL;
        const shell = reduced ? 1 : Math.exp(-s0 * s0);
        // Behind the front only: the material the front has already crossed,
        // relaxing. Ahead of it there is nothing, which is what keeps the
        // arrival readable as an arrival.
        const wake = reduced || dist > front ? 0 : PROP_WAKE * Math.exp(-(front - dist) / PROP_RELAX);
        const amp = Math.min(1, shell + wake) * Math.exp(-dist / PROP_REACH) * fade;
        if (amp > levels[i]) levels[i] = amp;
      }
    }
  }

  // ─── No idle, and that is the change ──────────────────────────────────────
  // 4.8.0's filapixels glimmered in and out. That behaviour is gone, and the
  // reason is the field rather than taste: **scintillation is caused by matter
  // in the path.** A star twinkles because the atmosphere it is seen through is
  // turbulent; nothing impedes light in a vacuum, and this field's whole claim
  // is that nothing is in the way. (Two supporting facts, both real: an
  // extended source such as a galaxy averages the distortion across its own
  // angular size and does not twinkle even through air — which is why planets
  // are steady and stars are not — and interstellar scintillation, which does
  // exist, is a radio-wavelength effect of plasma rather than anything visible.)
  //
  // The second reason is the better one for the near half, where a vacuum
  // argument does not apply: the field must be indifferent — to the camera, to
  // hover, to the lens transmitting — because that indifference is what makes
  // the lens's one response mean something. A scene where everything is alive
  // has nothing alive in it.
  //
  // So what moves is: the excitation when a filapixel is read, the transmission
  // that follows it, and the camera's own slow turn. Nothing else.

  let levelsDirty = false;
  function writeLevels() {
    const attr = nearWeb.geo.getAttribute('aLevel');
    const arr = attr.array;
    for (let v = 0; v < nearNodeOf.length; v++) {
      const n = nearNodeOf[v];
      arr[v] = n < 0 ? 0 : levels[n];
    }
    attr.needsUpdate = true;
  }
  writeLevels();

  // ─── Chrome ───────────────────────────────────────────────────────────────
  let titleEl = null, hintEl = null, ordinalEl = null, jumpList = null, soundToggle = null;
  const srSay = msg => { if (srLiveEl) srLiveEl.textContent = msg; };

  function showRead(index) {
    const src = SOURCES[SOURCE_OF[index]];
    if (ordinalEl) {
      ordinalEl.hidden = false;
      ordinalEl.textContent = `${index + 1} / ${FILAPIXEL_COUNT}`;
    }
    // The live region keeps everything, including the sentence and where it
    // came from: a visitor who cannot see the pulse must still get the content,
    // and the pulse is deliberately not readable by anyone.
    srSay(`Filapixel ${index + 1} of ${FILAPIXEL_COUNT}, from ${src.label}. ${TEXTS[index]}`);
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let touchGuard = null, orbitDrag = null, wheelZoom = null, resizeCtl = null, reducedWatch = null;

  // The lightpen: point at the object and it is read from there. The raycast
  // hits the crystal body, and the nearest filapixel to that point is the one
  // that answers — pointing at a place, not at a pixel.
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

    // Over the nine scenes the lens holds writing from, not over 3,221
    // filapixels. Selecting one reads its first — which is the only ordered
    // access the object has, and it is a fact about the corpus rather than
    // about the geometry.
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

  // ─── Layout ───────────────────────────────────────────────────────────────
  function relayout() {
    const H = Math.max(1, container.clientHeight || window.innerHeight);
    if (preview || !hintEl || !titleEl) { usableTop = 0; usableBottom = H; fitCamera(); return; }
    // In the CONTAINER's coordinates. See fitCamera's comment.
    const rect = container.getBoundingClientRect();
    const hintBox = hintEl.getBoundingClientRect();
    const titleBox = titleEl.getBoundingClientRect();
    usableTop = Math.max(0, hintBox.bottom + 10 - rect.top);
    usableBottom = Math.min(H, titleBox.top - 12 - rect.top);
    if (usableBottom - usableTop < H * 0.3) { usableTop = 0; usableBottom = H; }
    fitCamera();

    if (!ordinalEl) return;
    const ordBox = ordinalEl.getBoundingClientRect();
    const overlaps = ordBox.left < titleBox.right + 10 && ordBox.top < titleBox.bottom;
    ordinalEl.style.bottom = overlaps ? `${Math.round(window.innerHeight - titleBox.top + 10)}px` : '';
  }

  resizeCtl = bindGuardedResize(container, (cw, ch) => {
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();
    renderer.setSize(cw, ch);
    relayout();
  });

  // ─── Loop ─────────────────────────────────────────────────────────────────
  let animId = null;
  let paused = false;
  const IDLE_TURN = 0.048;

  function animate() {
    animId = requestAnimationFrame(animate);
    const dt = clock.tick();
    if (!reduced) {
      // Turned slowly, the way something small is turned in the hand to catch
      // the light on it.
      camAz += IDLE_TURN * (preview ? 1.5 : 1) * dt;
      placeCamera();
    }
    advanceTransmitters(dt);
    if (reads.length) { advance(dt); levelsDirty = true; }
    else if (levelsDirty) { levels.fill(0); }
    // Only when something changed. The near mesh's level attribute is ~17,000
    // floats and re-uploading it every frame to say "still nothing" is the
    // whole reason the field's indifference was worth splitting into its own
    // mesh; leaving the near half uploading anyway would have given that back.
    if (levelsDirty) { writeLevels(); levelsDirty = reads.length > 0; }
    renderer.render(scene, camera);
    previewCanvas?.blit();
  }

  relayout();
  // The band is measured from the title's rendered box and the title is set in
  // a web font, so the first measurement is against the fallback face.
  if (!preview && document.fonts?.ready) {
    document.fonts.ready.then(() => { if (!disposed) relayout(); }).catch(() => {});
  }
  // Directly, not scheduled. main.js runs syncPreviewPlayback() the moment
  // initPreviews() resolves and that can setPaused(true), cancelling a queued
  // first callback before it ever runs — which is how Harmonics and Outside
  // once shipped tiles that had drawn nothing at all (4.1.1).
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
      timers.dispose();
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
      // Close AND null, in that order — the missing null is why Outside's
      // version of the stale-listener bug presented as an unclearable
      // setInterval instead of a stack of orphaned contexts.
      if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
      muteGain = busGain = null;
      soundEnabled = false;
      // The worklet node keeps a live port and an audio-thread processor. A
      // disconnect alone leaves the port's message channel referencing this
      // scene, which is exactly the shape of the stranded-context defect 4.0
      // fixed — a new node type is a new place for it to come back.
      if (shiverNode) {
        try { shiverNode.port.onmessage = null; shiverNode.port.close(); } catch { /* already gone */ }
        try { shiverNode.disconnect(); } catch { /* already gone */ }
        shiverNode = null;
      }
      for (const t of transmitters) { t.mesh.visible = false; t.mesh.geometry.dispose(); t.mat.dispose(); }
      transmitters.length = 0;
      stemGeo.dispose(); nubGeo.dispose(); stemMat.dispose(); nubMat.dispose();
      stems.dispose(); nubs.dispose();
      nearWeb.geo.dispose(); farWeb.geo.dispose(); nearMat.dispose(); farMat.dispose();
      benchGeo.dispose(); benchMat.dispose();
      previewCanvas?.dispose();
      managedRenderer.dispose();
      containerClaim?.restore();
    },
  };
}
