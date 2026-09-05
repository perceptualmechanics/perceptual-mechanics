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
// The worklet runs in another global and must reach the audio thread as a
// FILE, not as part of this chunk. `new URL(..., import.meta.url)` is the form
// the bundler understands as "emit this as an asset and give me its hashed
// URL"; `?url` also works and emits the file twice — once raw and once
// minified, with only the raw one referenced, which ships 2 kB nobody loads.
// See the worklet's own header for what runs in there.
const rushWorkletUrl = new URL('./psyshell.rush.worklet.js', import.meta.url).href;

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
// The green field is gone with the flower it belonged to, and as of 4.8.2 so is
// the warm room: there is no bench, no floor and no lamp, because the lens is
// not on a table. What is left is the web, and a crystal that is cool where it
// catches light and green where it does not.
//
// The green survives in exactly one place and means something there — in the
// object's interior, which is the residue of taint that let it through
// screening. It is the reason the lens was pulled out and read at all.
//
// ROOM_COLOR is now just the ground the web is drawn on: near-black, very
// slightly warm, so the field's cool strands have something to be cool against.
const ROOM_COLOR = 0x07070a;
const CRYSTAL_DEEP = 0x123a2c;   // the interior: taint, seen through the body
const CRYSTAL_RIM = 0xbfe6ff;    // where an edge catches the light
const NUB_RIM = 0xe8f4ff;
const FILAPIXEL_COLOR = 0xd8fff0;   // a strand inside the lens, and its junctions
const WEB_FAR_COLOR = 0x8fb6d8;     // a strand out in the field

// ─── Brightness ─────────────────────────────────────────────────────────────
// (FILAPIXEL_BASE lived here until 4.8.9 and had not been read since 4.8.1,
// when a strand's resting brightness became the strand's own `aBright`. A
// constant nothing reads is a value the next person will try to tune.)
// Re-derived by rendering and measuring peak luminance, the same way 4.7.0's
// was: an object built of overlapping additive members has to be set by what
// the pile sums to. This object is far smaller than either predecessor — 252
// segments rather than 3,221 rays — so it can afford much more per member.
const CRYSTAL_GAIN = 0.78;
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
const FAR_GAIN = 0.34;     // the field's — raised in 4.8.2; it was wallpaper

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

// ─── What leaves the object ────────────────────────────────────────────────
// The excitation above is Euclidean and stays inside the crystal, which is
// right for a disturbance in a solid. Out in the field there is no solid: there
// are strands, and a strand is the only way anything gets from one knot to
// another. So what travels out of the lens travels **along the graph**, in
// hops, and the two are not a contradiction — each is the correct medium for
// where it is.
//
// The field still does not respond to the visitor. It responds to nothing at
// all. It CARRIES what the lens gives it, which is what being one structure
// means, and it is the reason 4.8.2's connectivity gate was worth having.
const HOP_SPEED = 26;      // strands per second the front crosses
const HOP_REACH = 22;      // e-folding distance, in strands
const HOP_MAX = 130;       // where a pulse is dropped rather than tracked further
const HOP_SHELL = 2.6;     // half-width of the front, in strands
const HOP_LIFE = 6.0;      // seconds — long, because 130 strands is a long way
// **One reading in a hundred gets out.** The rest stay in the crystal, and that
// is what makes the hundredth mean anything: a scene where every touch floods
// the sky has no event in it. The site already keeps a one-in-a-hundred at this
// exact odds — main.js's `pmGlimpse`, where a hover flickers the tab title to a
// one-word association — so this is the house rate rather than a new invention.
const ESCAPE_ODDS = 100;

// ─── Traffic ───────────────────────────────────────────────────────────────
// The web is a substrate, and things travel on it whether or not anybody is
// reading the lens. Pulses cross the field on their own: not often, not
// brightly, and never starting inside the object.
//
// **This does not contradict the field's indifference, and the distinction is
// worth being exact about.** The field does not respond to the visitor — not to
// the camera, not to hover, not to being looked at — and it does not
// scintillate, because twinkling is caused by matter in the path and nothing is
// in the way. Traffic is neither of those. It is the substrate carrying
// something that has nothing to do with you, which is a colder fact than a
// still field, not a warmer one.
//
// A pulse takes the same path a read's does — hop by hop along the strands —
// because there is only one structure here and it conducts the same way at
// every scale. Occasionally one crosses the lens, and it should: a branch of a
// filament exists on both scales at once, and everything is connected even if
// only by gravity.
// **Traffic crosses space, not hops**, and that is a correction rather than a
// preference. The first version sent an ambient pulse out along the strands the
// way a read goes, and it did not read as anything: hop distance and screen
// distance have nothing to do with each other out here, because a single hop
// between two knots can be twenty units and a hop inside a knot can be a
// tenth of one. A front measured in strands therefore arrives everywhere in a
// cluster at once and nowhere in order. Measured: the field brightened as a
// whole and no front was visible at any gain.
//
// So a pulse is a PLANE crossing the volume — a front sweeping through, lighting
// whatever it passes, in a direction of its own. That is what something moving
// across a field at this scale looks like, and it costs one dot product per
// node rather than a graph walk.
//
// It crosses the lens too, when its direction takes it there. It should: a
// branch of a filament exists on the informational and the galactic scale at
// once, and everything is connected even if only by gravity.
const AMBIENT_GAP = [3.0, 7.5];   // seconds between pulses, drawn each time
const AMBIENT_MAX = 2;            // alive at once
const AMBIENT_GAIN = 0.6;         // against a read's 1.0
const AMBIENT_WIDTH = 3.2;        // world units — the front's half-width
const AMBIENT_LIFE = 9.0;         // seconds to cross the whole field

// ─── The other kind of traffic ─────────────────────────────────────────────
// Every so often a pulse does not cross the field: it **cascades through the
// fibres**, running out from a node along the strands and branching wherever
// they branch.
//
// This is the mechanism that failed as a sweep, used for the thing it is
// actually right for. A front measured in strands arrives everywhere in a knot
// at once and reaches distant knots in the order the wiring says rather than
// the order the eye expects — which is wrong for something crossing space and
// exactly right for something running through a network. Same code, correct
// question this time.
//
// It starts anywhere, the lens included: a cascade that begins inside the
// crystal and runs out into the field is the same event as a read escaping,
// minus anybody having asked.
const CASCADE_ODDS = 0.35;     // share of traffic that cascades rather than sweeps
const CASCADE_HOPS = 62;       // how far it is tracked
const CASCADE_SPEED = 13;      // strands per second — slower than a read's 26
const CASCADE_SHELL = 2.2;     // half-width of the front, in strands
const CASCADE_GAIN = 0.55;
const CASCADE_LIFE = 7.0;

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
// Headroom on the transmission's length, not a limit that bites: at the
// corpus's 3,244 filapixels the longest base-e digit string is 12, so this
// never clamps today. It is here so a much larger corpus cannot hand the
// transmitter an unbounded array to allocate per pulse.
const MAX_DIGITS = 16;
// How hard a lit digit drives the crystal's own body. The ribbon this replaced
// needed 2.0 to read at all through its own flat shading; light in the body
// needs far less, because it is added to a material that is already responding
// to the eye — at 2.0 the struck tine went white-hot and read as a rod rather
// than as light inside glass.
const TRANSMIT_GAIN = 0.85;

// How loud a reading is on the bus, and nothing else. The sound's own length is
// no longer a constant at all: a pass lasts exactly as long as the transmission
// it belongs to, which the scene hands the worklet per reading. STRIKE_LIFE
// went with the envelope it belonged to, three gestures ago.
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

  // The fit puts the object inside the band the chrome leaves; this is the
  // breathing room it gets inside that band. Left where it was — the framing
  // change belongs in START_ZOOM, where it can be read as a decision about
  // where a visit begins rather than as the fit being loosened.
  const FIT_MARGIN = 1.06;
  const START_DROP = 0.13;   // fraction of a half-height the object sits low by
  const center = new THREE.Vector3(...BOUNDS.center);
  let lookOffsetY = 0;
  const target = new THREE.Vector3();
  let usableTop = 0, usableBottom = 1;
  let camAz = 0.7, camEl = 0.24, camZoom = 1, camDist = 4;
  // Where a visit begins, before anyone scrolls. The scene used to open with the
  // object fitted politely inside the chrome band and reading as a specimen
  // across a room; the lens is two inches of crystal and a wide lens close in
  // only reads as close if the thing is actually close. Chosen by rendering, four times over:
  // 1.15 still read as a specimen, 1.25 grazed the nav, 1.75 put the whole
  // crown out of shot, and 1.55 is where the object **bleeds off the frame**
  // without leaving it — the tines run out of the top, the body does not.
  //
  // The trade is deliberate and worth naming: past about 1.4 the antler
  // silhouette stops being the thing you read the object by, and the material
  // becomes it. That is the right trade for a thing you are holding close, and
  // the wrong one for a thing you are identifying, which is why the 200px tile
  // does not take this constant.
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
    // The tile gets the fit and nothing else. A 200px thumbnail is read by
    // silhouette — it is how a visitor picks this scene out of twelve — and the
    // close framing deliberately gives the silhouette up. Written as a
    // condition rather than as a comment claiming it, because the comment
    // claiming it was here first and was false.
    camDist = camDist * FIT_MARGIN / (camZoom * (preview ? 1 : START_ZOOM));
    // Sits a little low in the frame rather than centred in the band, so the
    // crown has somewhere to go when the zoom takes it off the top.
    //
    // The sign is the trap this file has already been caught by once: the
    // camera is placed relative to the aim, so RAISING the aim lowers the
    // object. START_DROP is written as what it does to the object, not as what
    // it does to the aim, because the next person to change it will be looking
    // at the object.
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

  // ─── No bench, and no room ────────────────────────────────────────────────
  // There was a lit plate under the object and, before that, a plane fourteen
  // units across. Both are gone. **The lens is not on a table**: it is in the
  // deepest sanctum of the Surround, or in Untgract's workshop, and neither is
  // a room with furniture in it.
  //
  // The bench came from wanting the object to read as held and examined rather
  // than displayed, which is a real thing to want and was the wrong way to get
  // it. **What makes an object read as held is scale and framing** — a wide
  // lens close in, the object filling the frame, no horizon to measure it
  // against — not a surface underneath it. And a floor is opaque: it cut the
  // field off across the bottom of the frame, in a release whose whole claim is
  // that the field is everywhere.
  //
  // The web is the ground now. Nothing else is.

  // ─── The crystal ──────────────────────────────────────────────────────────
  // Fresnel rather than refraction. A real transmissive material would be the
  // right answer and the wrong cost — MeshPhysicalMaterial with transmission on
  // 250 instances is a screen-sized render target per frame. An edge-lit
  // fresnel over a dark interior reads as glass at this scale, and the interior
  // is where the green lives.
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
      // The constant term is the interior. It is not 0.0 and should not be:
      // the green under the surface is the residue of taint, and a body that
      // only exists at its edges is a wireframe.
      vec3 lit = col * (0.30 + 0.70 * f) * uGain;
      // The transmission: the segment's own body carrying light, brightest
      // where it is edge-on to the eye the way the rest of the crystal is, so
      // it reads as the material glowing rather than as a surface laid over it.
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
  // The nubs never transmit, but they share the crystal shader, and a shader
  // that reads an attribute the geometry does not have gets zero on some
  // drivers and garbage on others. One constant instanced attribute is cheaper
  // than a second shader.
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

  // The excitation, one value per NODE — the whole web, not just the corpus.
  // It starts at zero rather than at a base level, because a strand's resting
  // brightness is its own (aBright) and this array carries only what a read
  // adds.
  const levels = new Float32Array(web.total);

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
      // Every vertex knows which node it belongs to, near or far. Until 4.8.7
      // the far half's vertices carried −1, because the field could not light:
      // it can now, when the lens gives it something to carry.
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
  // Fainter in the 200px tile, and that is a scale decision rather than a
  // second opinion about the field: at tile size a far strand is thinner than a
  // pixel, so the whole field aliases into a haze that competes with the object
  // it is meant to be the background half of. The full scene keeps FAR_GAIN.
  // The far half lights too — at a third of the near half's response, because
  // what reaches it is a long way from the lens and should read as something
  // arriving rather than as the field answering.
  //
  // This third argument was ZERO for one release, and not on purpose: the edit
  // that dimmed the field in the 200px tile rewrote this line and dropped the
  // lit term with it. The field was receiving every pulse and rendering all of
  // them at zero gain, which looks exactly like a feature that does not work.
  // Same shape as the `rushNode` declarations a scripted rename ate — **a later
  // edit silently undoing an earlier one is this file's recurring defect**, and
  // both times what caught it was a probe that asked whether the value had
  // arrived rather than whether the code looked right.
  const farMat = strandMat(WEB_FAR_COLOR, preview ? FAR_GAIN * 0.45 : FAR_GAIN, FILAPIXEL_PEAK * 0.12);
  const nearLines = new THREE.LineSegments(nearWeb.geo, nearMat);
  const farLines = new THREE.LineSegments(farWeb.geo, farMat);
  nearLines.frustumCulled = false;
  farLines.frustumCulled = false;
  lens.add(nearLines);
  // The far field is not in the lens group. It is not the object's
  // surroundings — it is what the object is a fragment of, and it does not
  // belong to it.
  scene.add(farLines);

  // Which vertices belong to which node, so a read can be written into the
  // strands around it.
  const nearNodeOf = nearWeb.node;
  const farNodeOf = farWeb.node;

  // ─── The web as a medium ──────────────────────────────────────────────────
  // Adjacency, built once. A read runs out of the lens along the strands, and
  // it can only do that because 4.8.2 made the web one connected graph — the
  // payoff for that work is here.
  //
  // **The field still does not react to the visitor.** Not to the camera, not
  // to hover, not to being looked at; that indifference is what makes the
  // lens's answer mean anything, and it is unchanged. What is new is that the
  // field CARRIES what the lens gives it. A structure that is one structure
  // does not stop at the object's edge.
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
    loadRush();
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

  // ─── The rush ─────────────────────────────────────────────────────────────
  // Wind going past you, made of metal. The DSP and the reasoning are in
  // `psyshell.rush.worklet.js`; what lives here is the graph, the pitch, and
  // the two numbers that tie the sound to the light.
  //
  // **The tie is the point of this half.** The pass lasts exactly as long as
  // the transmission it belongs to, and it sweeps across the stereo image in
  // the direction the front travels on screen — so hearing it and seeing it are
  // one event rather than two things that happen at the same time.
  //
  // The pitch still comes from the filapixel's height in the object rather than
  // from the sentence: it is a property of where the lightpen is pointed.
  //
  // (The old note about the strike's click is retired with the strike. Scott
  // liked that click and it was left alone for two releases; three gestures
  // later there is no envelope for it to be a defect in.)
  let rushNode = null;
  let rushReady = null;
  let rushFailed = false;

  function loadRush() {
    if (!audioCtx || rushNode || rushFailed) return rushReady;
    rushReady = audioCtx.audioWorklet.addModule(rushWorkletUrl).then(() => {
      if (disposed || !audioCtx || audioCtx.state === 'closed') return;
      rushNode = new AudioWorkletNode(audioCtx, 'psyshell-rush', {
        // Stereo, because the sound has to cross: a mono node cannot pass
        // anybody. This is the one place the rush needed the graph to change.
        numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
      });
      rushNode.connect(busGain);
    }).catch(() => {
      // A worklet that will not load is not a reason for a silent scene to also
      // be a broken one: the scene keeps working, without the sound. Recorded
      // as a flag rather than swallowed, so the fallback is visible to anything
      // that asks.
      rushFailed = true;
    });
    return rushReady;
  }

  // Where the transmission runs, in screen terms: the pass sweeps the way the
  // light does. Projected through the real camera rather than guessed from the
  // object's own axes, because what has to match is what the visitor sees, and
  // the camera turns.
  const projA = new THREE.Vector3(), projB = new THREE.Vector3();
  function panForPath(index, path) {
    if (!path || !path.length) return [-0.7, 0.7];
    const tip = SEGMENTS[path[path.length - 1]].to;
    projA.set(placed.pos[index * 3], placed.pos[index * 3 + 1], placed.pos[index * 3 + 2]);
    projB.set(tip[0], tip[1], tip[2]);
    lens.updateMatrixWorld();
    projA.applyMatrix4(lens.matrixWorld).project(camera);
    projB.applyMatrix4(lens.matrixWorld).project(camera);
    // Widened to the edges: the strand is a couple of centimetres of screen and
    // a pass that only moves that far does not read as passing at all. The
    // DIRECTION is what carries the tie; the extent is what makes it audible.
    const dir = projB.x >= projA.x ? 1 : -1;
    return [-0.85 * dir, 0.85 * dir];
  }

  function strike(index, tr) {
    if (!audioCtx || !soundEnabled) return;
    const y = placed.pos[index * 3 + 1];
    const t = Math.max(0, Math.min(1, (y - BOUNDS.min[1]) / Math.max(1e-6, BOUNDS.max[1] - BOUNDS.min[1])));
    const hz = 620 * Math.pow(2, -1.15 * (1 - t));
    // The transmission's own life, so the sound is over when the light is.
    const dur = tr ? tr.life : 0.9;
    const [panFrom, panTo] = panForPath(index, tr?.path);
    const send = () => {
      if (disposed || !rushNode || !soundEnabled) return;
      rushNode.port.postMessage({ type: 'rush', hz, gain: STRIKE_GAIN, dur, panFrom, panTo });
    };
    if (rushNode) send();
    else loadRush()?.then(send);
  }

  // ─── The transmission, as light in the body ───────────────────────────────
  // Until 4.8.2 this was a RIBBON: a flat strip of geometry built along the
  // struck filament, painted `colour × level × 2.0` with no falloff across its
  // width. Scott's description of what that looked like on screen — "a flat
  // untextured polygon flashing, reads like a missing material" — is exactly
  // right, and the diagnosis is that it was not a missing material at all. It
  // was the transmission, correct in its timing and its digits, drawn as a
  // painted card standing in the object.
  //
  // The transmission is light moving INSIDE the crystal, so that is what it is
  // now, and it needs no geometry of its own: the object already has two things
  // that can be lit — the crystal's own segments, and the web's strands
  // threading through them. A digit lights both, at the place the front has
  // reached, and nothing flat is ever drawn.
  //
  // Everything about the notation is unchanged: same base-e expansion, same
  // digit durations, same τ, same worked example on /text/.

  // Which filapixels sit on which segment of the object, so a transmission only
  // touches the nodes on the path it runs along.
  const nodesOfSegment = new Map();
  for (let i = 0; i < FILAPIXEL_COUNT; i++) {
    const seg = placed.seg[i];
    if (!nodesOfSegment.has(seg)) nodesOfSegment.set(seg, []);
    nodesOfSegment.get(seg).push(i);
  }

  // The crystal's segments carry their own lit level, one float per instance,
  // so the body glows where the light is rather than a surface being added over
  // it. Only the handful of instances on an active path are ever written.
  const stemLit = new Float32Array(SEGMENTS.length);
  stemGeo.setAttribute('aLit', new THREE.InstancedBufferAttribute(stemLit, 1));

  const transmits = [];
  function armTransmitter(index) {
    // The ordinal is the filapixel's place in the WHOLE corpus — n of 3,221 —
    // which is what says how much the lens is holding.
    const { digits } = baseEDigits(index + 1);
    const n = Math.min(digits.length, MAX_DIGITS);
    const bounds = new Float32Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) { acc += digitDuration(digits[i]); bounds[i] = acc; }

    // The path, and where every node on it sits along that path. Arc length in
    // the object's own units, then normalised, so the front's speed is in
    // path-lengths per second exactly as the ribbon's was.
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

  // Which digit is sounding at time `tp`, and whether that digit is a lit one.
  // Segments alternate lit and dark by place, most significant first, so the
  // boundaries are the digit boundaries and nothing in the train is filler.
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
      // Clear what this transmission lit last frame before it moves, so a
      // finished one leaves nothing behind.
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

  // ─── The excitation ───────────────────────────────────────────────────────
  const reads = [];
  // Hop distance from the struck node outward, computed once per reading. A
  // breadth-first walk over ~7,800 nodes costs well under a millisecond, and it
  // is the only thing that has to know the web's shape at read time.
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

  // ─── The field's own traffic ──────────────────────────────────────────────
  // Seeded from the lens's own catalogue number, so the sky is this lens's sky:
  // the same pulses in the same order on every visit, which is what makes it a
  // place rather than a screensaver.
  const ambient = [];
  const ambientRnd = mulberry32(hashSeed(LENS_ID + ':traffic'));
  let ambientIn = 1.2;

  function newAmbient() {
    // A direction, and the span of the field along it, so the front can start
    // just outside and finish just past the far side.
    const u = ambientRnd() * 2 - 1;
    const th = ambientRnd() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - u * u));
    const dir = [r * Math.cos(th), u * 0.45, r * Math.sin(th)];
    const m = Math.hypot(...dir) || 1;
    dir[0] /= m; dir[1] /= m; dir[2] /= m;
    // Every node's distance along that direction, sorted once. The front then
    // only ever touches a slice of the field, found by binary search — a pulse
    // costs a few hundred nodes a frame instead of all 7,848, and the sort is
    // paid once per pulse rather than sixty times a second.
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

  // A cascade: hop distances from a random node, sorted so a frame only walks
  // the band the front is in — the same slice trick the sweep uses, because the
  // whole point of both is that a pulse touches a little of the web at a time.
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
      // In and out at the ends, so a pulse arrives and leaves rather than
      // switching on at the edge of the frame.
      const fade = Math.sin(Math.PI * u);
      const gain = AMBIENT_GAIN * fade * fade;
      // The band the front can reach: 2.5 widths ahead of it, 7 behind.
      const near = front - AMBIENT_WIDTH * 7;
      const farEdge = front + AMBIENT_WIDTH * 2.5;
      const { keys, sorted } = a;
      let lo2 = 0, hi2 = keys.length;
      while (lo2 < hi2) { const m = (lo2 + hi2) >> 1; if (keys[m] < near) lo2 = m + 1; else hi2 = m; }
      for (let i = lo2; i < keys.length && keys[i] <= farEdge; i++) {
        const n = sorted[i];
        const s0 = (keys[i] - front) / AMBIENT_WIDTH;
        // A soft front with a longer tail behind it: something passing, not a
        // band sliding across.
        const amp = (s0 > 0 ? Math.exp(-s0 * s0) : Math.exp(s0 * 0.55)) * gain;
        if (amp > levels[n]) levels[n] = amp;
        if (n >= FILAPIXEL_COUNT) farLit = true; else nearLit = true;
      }
    }
  }

  function readAt(index) {
    // Rolled per reading, not seeded: two visitors reading the same filapixel
    // should not both get the rare one, and the same visitor reading it twice
    // should not be told the answer is fixed.
    const escapes = Math.floor(Math.random() * ESCAPE_ODDS) === 0;
    reads.push({ origin: index, t: 0, hop: escapes ? hopsFrom(index) : null });
    if (reads.length > MAX_READS) reads.shift();
    // The transmitter first: the rush takes its length and its direction from
    // the transmission, so there has to be one before there is a sound.
    strike(index, armTransmitter(index));
  }

  function advance(dt) {
    for (let i = reads.length - 1; i >= 0; i--) {
      reads[i].t += dt;
      // A reading that got out outlives its own excitation: the front inside
      // the crystal is finished in two seconds and what left along the strands
      // is still going. One that did not is done when the crystal is.
      if (reads[i].t >= (reads[i].hop ? HOP_LIFE : PROP_LIFE)) reads.splice(i, 1);
    }
    // The clearing is the caller's now, not this function's: the excitation and
    // the transmission both write into `levels`, and whichever ran second used
    // to wipe the other. Order in the tick: clear, excite, transmit, upload.
    for (const d of reads) {
      // ── Out along the strands, into the field ──────────────────────────────
      // Same shape as the excitation — a travelling front with a relaxing wake
      // behind it — measured in strands rather than in world units, because out
      // here the strands are the distance.
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

      // ── And the Euclidean one, inside the crystal ─────────────────────────
      if (d.t >= PROP_LIFE) continue;
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
        if (amp > levels[i]) { levels[i] = amp; nearLit = true; }
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
  // argument does not apply: the field must be indifferent **to the visitor** —
  // to the camera, to hover, to being looked at — because that indifference is
  // what makes the lens's one response mean something. A scene where everything
  // is alive has nothing alive in it.
  //
  // 4.8.7 draws the line more exactly than "the field reacts to nothing" did.
  // The field does not RESPOND; it CARRIES. A reading runs out of the crystal
  // and along the strands into it. That is not the field noticing anybody — it
  // is one structure conducting, which is the thing the connectivity gate
  // exists to guarantee.
  //
  // So what moves is: the excitation when a filapixel is read, the transmission
  // that follows it, the camera's own slow turn — and, from 4.8.7, the
  // substrate's own traffic crossing the field. **Traffic is not scintillation
  // and not a response.** A pulse crossing the web has nothing to do with the
  // visitor, which is colder than a still field rather than warmer: things go
  // past whether or not anyone is here.

  let levelsDirty = false;
  // Which half of the web has anything to say this frame. The far half is 20,868
  // floats and is untouched most of the time — a read only reaches it one time
  // in a hundred, and traffic only while a pulse is crossing — so uploading it
  // unconditionally was paying for silence sixty times a second. The flags are
  // sticky for one extra frame so the last write that clears a half still
  // reaches the GPU.
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

  // ─── Chrome ───────────────────────────────────────────────────────────────
  let titleEl = null, hintEl = null, ordinalEl = null, jumpList = null, soundToggle = null;
  const srSay = msg => { if (srLiveEl) srLiveEl.textContent = msg; };

  function showRead(index) {
    const src = SOURCES[SOURCE_OF[index]];
    if (ordinalEl) {
      ordinalEl.hidden = false;
      ordinalEl.textContent = `${index + 1} / ${FILAPIXEL_COUNT}`;
      // Now that it is on screen and has a real box, check it against the
      // title — the first time this runs is the first time that question has
      // a meaningful answer.
      placeOrdinal();
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

    placeOrdinal(titleBox);
  }

  // The ordinal ("3 / 108") sits bottom-right and is lifted only if it would
  // run into the title block. The measurement is only meaningful while it is
  // on screen: it starts `hidden`, and getBoundingClientRect on a
  // display:none element is all zeros — so left(0) < titleBox.right + 10 and
  // top(0) < titleBox.bottom were both trivially true, `overlaps` was always
  // true, and an inline `bottom` was written before the element had ever been
  // laid out. Its authored bottom-right position had therefore never
  // rendered: by the time it was shown it already carried the override.
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
    // A window dragged between a Retina and a non-Retina display changes
    // devicePixelRatio with no other signal, so the cap is re-applied here.
    // Nine other WebGL scenes do this; this one did not, so a scene opened on
    // one display and moved to the other kept the first display's ratio and
    // rendered soft or over-sampled until it was reopened.
    managedRenderer.applyPixelRatio();
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
    // Clear, excite, transmit, upload — in that order, because the excitation
    // and the transmission both write the same array and the second one to run
    // was wiping the first.
    const active = reads.length > 0 || transmits.length > 0 || ambient.length > 0 || !reduced;
    if (active || levelsDirty) levels.fill(0);
    if (reads.length) advance(dt);
    stepAmbient(dt);
    const transmitting = advanceTransmitters(dt);
    // Only when something changed. The near mesh's level attribute is ~17,000
    // floats and re-uploading it every frame to say "still nothing" is the
    // whole reason the field's indifference was worth splitting into its own
    // mesh; leaving the near half uploading anyway would have given that back.
    if (active || levelsDirty) {
      writeLevels();
      levelsDirty = reads.length > 0 || transmitting || ambient.length > 0;
    }
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
      if (rushNode) {
        try { rushNode.port.onmessage = null; rushNode.port.close(); } catch { /* already gone */ }
        try { rushNode.disconnect(); } catch { /* already gone */ }
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
