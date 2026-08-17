import * as THREE from 'three';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, bindTapVsDrag,
  prefersReducedMotion, parseHTML, createJumpList, createPanelCloser, escapeHtml,
} from '../../utils/sceneKit.js';
import { getApprovedResonances } from '../../resonances.js';
import { navigateToPiece } from '../../utils/constellationEntry.js';
import { resolveEndpointTitle } from './constellationPieces.js';
import constellationHtml from './constellation.html?raw';
import './constellation.css';

// ─── The Constellation ──────────────────────────────────────────────────────
// The ninth scene, and the only one with no found text of its own — it
// visualizes src/resonances.js's Layer 2 (cross-scene, connotative links),
// approved rows only. Camera orbits BELOW a canopy of thin glowing
// strands, looking up.
//
// Round 2 (2026-08-16) reversed the original "purely atmospheric, no
// panel" design: touching a strand now opens a real read-more panel
// naming both connected pieces and showing the resonance's own reviewed
// rationale, with a jump link to either piece — see constellation.html's
// header comment for why.
//
// Round 5 (2026-08-18) removed the spider entirely (creature, locomotion,
// reaction-trigger, dispose) — it was atmosphere layered on top of the
// panel, never the mechanism; the panel is what stays. Replaced with a
// brighter strand baseline and a real logarithmic-spiral galactic disc
// backdrop (see the ─── Galactic backdrop ─── block below), both purely
// visual — no connection to resonance data.
//
// Reached two ways (both additive, per the 2026-08-16 entry-point brief):
// the ground glimpse (src/utils/constellationEntry.js, wired into beamline
// and orrery, the only two scenes with a literal floor) and the
// thread-follow filament (same file, wired into every found-text scene's
// panel). Both dispatch `pm:navigate` on window; main.js's own listener
// is what actually calls expandScene('constellation', ..., resonanceId) —
// this file has no idea how it got opened, only whether `initialPieceId`
// (reused here to mean a resonance row's own `id`, not a piece id — see
// this scene's own entry in main.js's SCENES map for why that's safe)
// names a specific strand to arrive already oriented at.

const SCENE_ORDER = ['sphere', 'orbiter', 'library', 'scroll', 'theater', 'orrery', 'beamline', 'butterfly'];

// ─── Per-scene accent colors ────────────────────────────────────────────────
// Round 2's legibility fix: each scene's own already-established signature
// color (not invented here — pulled from each scene's own dominant
// material/light/glow color), used for both a node's own dot color and a
// strand's color gradient between its two endpoints. A Beamline↔Orrery
// strand reads green fading to gold — the two scenes' own real accents —
// rather than a flat uniform gray tangle where no connection is legible
// at a glance.
const SCENE_ACCENT = {
  sphere:    0xffdc78, // sphere.css .fragment-link hover/focus gold
  orbiter:   0x78ffb4, // orbiter.js's "+phase" particle-cloud green — "the italic/green identity that's orbiter's own"
  library:   0xe6b45f, // library.js HOVER_GLOW_HEX, the panel's own named gold accent
  scroll:    0xc17a3d, // scroll.css's drop-cap/rubric ink, "an inscriptional accent"
  theater:   0xe8b84b, // theater.css's marquee-bulb/bumper gold
  orrery:    0xffaa55, // orrery.js's workLight, "a plain accent near the machine"
  beamline:  0x50c878, // beamline.js's own named canonical accent
  butterfly: 0xff9e1f, // median of butterfly.js's warm gold-to-red-orange trajectory palette
};

// ─── Deterministic layout ───────────────────────────────────────────────────
// A small string hash (xmur3-family, not cryptographic — just needs to be
// stable and evenly spread) so every piece's node position is the same
// every load/build, without persisting coordinates anywhere. Two different
// resonance rows that share an endpoint (several pieces sit in more than
// one approved row) must resolve to the exact same node, which is why this
// is keyed by piece identity, not by row.
function hashStr01(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function pieceKey(ep) {
  return ep.scene === 'theater' && ep.beatId !== undefined
    ? `theater:beat${ep.beatId}`
    : `${ep.scene}:${ep.id}`;
}

// One node per unique piece touched by an approved row, positioned on the
// upper part of a sphere centered at the world origin (the camera orbits
// BELOW the origin — see updateCamera below — so every node ends up with
// y > 0, "overhead," without the camera and the canopy needing separate
// pivots). Each scene gets its own 45-degree azimuth wedge (SCENE_ORDER),
// so a scene's pieces cluster together rather than scattering randomly —
// legible as "the sphere's corner of the sky," not just noise.
function buildNodes(rows, domeRadius) {
  const nodes = new Map();
  const SECTOR = (Math.PI * 2) / SCENE_ORDER.length;
  rows.forEach(r => {
    [r.a, r.b].forEach(ep => {
      const key = pieceKey(ep);
      if (nodes.has(key)) return;
      const sceneIdx = Math.max(0, SCENE_ORDER.indexOf(ep.scene));
      const az = hashStr01(key + ':az');
      const po = hashStr01(key + ':po');
      const ra = hashStr01(key + ':ra');
      const azimuth = sceneIdx * SECTOR + (az - 0.5) * SECTOR * 0.86;
      // Polar angle off zenith (+Y): kept within a band well short of the
      // equator so the whole canopy reads as a dome overhead rather than
      // wrapping down to camera height, where it would compete with the
      // strands for a visitor's attention right in front of the lens.
      const polar = 0.14 + po * 0.60;
      const radius = domeRadius * (0.9 + ra * 0.16);
      const x = radius * Math.sin(polar) * Math.cos(azimuth);
      const z = radius * Math.sin(polar) * Math.sin(azimuth);
      const y = radius * Math.cos(polar);
      nodes.set(key, {
        key, scene: ep.scene, sceneIdx,
        pos: new THREE.Vector3(x, y, z),
      });
    });
  });
  return nodes;
}

// A soft round dot, reused for every node marker — same "canvas gradient,
// no image asset" convention as every other scene's own glow textures.
function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const cx = c.getContext('2d');
  const g = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = g;
  cx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export function createConstellation(container, { preview = false, initialPieceId = null } = {}) {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  const BG_COLOR = 0x00010a;
  scene.background = new THREE.Color(BG_COLOR);
  // Distance-based legibility (round 2, 2026-08-16) — real THREE.FogExp2,
  // the same exponential Beer-Lambert falloff already trusted for
  // Beamline's own atmospheric perspective (see that file's own header on
  // why FogExp2 over the old flat-plateau Fog), fogged to exactly the
  // background color so a faded strand reads as "receding into the void"
  // rather than toward a mismatched color. Scoped to strands only —
  // `.fog = false` is set explicitly below on every material that should
  // stay legible regardless of distance (stars, nodes, the galactic backdrop).
  const FOG_DENSITY = preview ? 0.011 : 0.006;
  scene.fog = new THREE.FogExp2(BG_COLOR, FOG_DENSITY);

  const camera = new THREE.PerspectiveCamera(46, w / h, 0.1, 2000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);
  if (!preview) container.tabIndex = -1;

  scene.add(new THREE.AmbientLight(0x223355, 1.0));
  const key = new THREE.DirectionalLight(0xaad4ff, 0.9);
  key.position.set(4, 8, 3);
  scene.add(key);

  // ─── Deep-field stars, same construction as orbiter.js's own (a uniform
  // random direction via acos(2u-1), not a naive polar-biased sample). ───
  const starCount = preview ? 300 : 900;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 300 + Math.random() * 300;
    const theta = Math.random() * Math.PI * 2;
    const phiA = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(phiA) * Math.cos(theta);
    starPos[i * 3 + 1] = Math.abs(r * Math.sin(phiA) * Math.sin(theta));
    starPos[i * 3 + 2] = r * Math.cos(phiA);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xbbccff, size: 0.9, transparent: true, opacity: 0.5, sizeAttenuation: true, fog: false });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  // ─── Galactic backdrop ───────────────────────────────────────────────────
  // Round 5 (2026-08-18): a genuine 3D galactic disc, not a flat skybox
  // image — the same standing preference for real-computed backdrops as
  // Beamline's actual terrain mesh or Orrery's actual orbital mechanics,
  // applied here to a spiral galaxy. Two real formulas, not a hand-placed
  // swirl:
  //   - Arm shape: the logarithmic spiral r = a·e^(b·θ) (the textbook
  //     equation real spiral-arm pitch fits closely), inverted per
  //     particle to find the θ a given radius sits at on a given arm,
  //     then offset by that arm's own share of the full turn.
  //   - Density: true exponential radial falloff via inverse-CDF sampling
  //     of r (a galactic disc's real surface-brightness profile) —
  //     brightest/densest near the structure's own core, smoothly
  //     thinning outward — not a uniform scatter thinned by eye.
  // A minority of particles skip the arm-locked θ (a soft field around the
  // arms — not every star sits exactly on-rail) so the shape doesn't read
  // as too clean/mechanical up close.
  //
  // Round 5 correction (2026-08-18): the first pass thickened the disc
  // substantially to chase "legible from every orbit angle" — but a real
  // disc galaxy is extremely flat (the Milky Way is on the order of a
  // thousand times wider than it is thick), and that thinness is WHY a
  // galaxy reads as a galaxy: edge-on it's a thin bright band, only
  // closer to face-on does the spiral actually open up. Thickening it to
  // fake angle-independence washed the real structure into a uniform
  // scatter — structurally indistinguishable from the plain ambient star
  // field already used elsewhere on the site. Corrected: genuinely thin
  // again, tighter arm scatter and a much sparser interarm field so
  // density contrast (not just point count) reads as actual bands
  // against dark gaps, and a sharply brighter/warmer core cluster near
  // R_MIN. This is NOT expected to look the same from every camera
  // angle — a thin plane SHOULDN'T; edge-on gives a band, more face-on
  // gives arms-and-core, and that variation is the correct behavior for
  // the geometry, not a bug.
  //
  // The whole structure's radial sampling starts at GALAXY_R_MIN, well
  // beyond CAM_MAX and DOME_RADIUS, rather than at the world origin the
  // strands/camera share — a real exponential falloff, just for a distant
  // galaxy the visitor is nowhere near the center of, which is also what
  // keeps it honestly behind the strands in depth at every camera
  // distance. Dimmed and cooled well below the strands' own brightness,
  // `fog: false` (fog stays scoped to strands only, same as the star
  // field). Purely atmosphere — no relationship to resonance data.
  function buildGalaxy() {
    const ARMS = 3;
    const PITCH = 0.3; // b in r = a·e^(bθ) — real spiral galaxies run roughly 0.2–0.4
    const ARM_SCALE = preview ? 34 : 60; // a — sets how much winding happens across the visible radial range
    const R_MIN = preview ? 260 : 480; // inner edge — safely beyond CAM_MAX/DOME_RADIUS
    const R_MAX = preview ? 900 : 1800; // stays inside the camera's far plane (2000) with margin
    const DECAY_SCALE = preview ? 220 : 380; // 1/λ — most mass within a few of these past R_MIN
    const COUNT = preview ? 1700 : 5000;
    const FIELD_FRACTION = 0.14; // particles that skip the arm lock — sparse enough that arms read as denser bands, not a uniform haze with a pattern painted on top

    function sampleD() {
      // Inverse-CDF sample of an exponential distribution, resampled if it
      // overshoots the visible range — d is distance PAST R_MIN, so r =
      // R_MIN + d is where density is highest (d=0) and falls off
      // exponentially as d grows.
      let d;
      do { d = -Math.log(1 - Math.random()) * DECAY_SCALE; } while (d > R_MAX - R_MIN);
      return d;
    }

    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const coreColor = new THREE.Color(0xfff1d6);
    const armColor = new THREE.Color(0x5f7fd0);
    const c = new THREE.Color();

    for (let i = 0; i < COUNT; i++) {
      const d = sampleD();
      const r = R_MIN + d;
      const isArm = Math.random() >= FIELD_FRACTION;
      let theta;
      if (!isArm) {
        theta = Math.random() * Math.PI * 2;
      } else {
        const armIdx = Math.floor(Math.random() * ARMS);
        const idealTheta = Math.log(r / ARM_SCALE) / PITCH;
        // Real arms broaden with radius, but only modestly — tight enough
        // that an arm still reads as a distinct denser band against the
        // sparse field between arms, not a broad smear that overlaps its
        // neighbors.
        const scatter = (Math.random() - 0.5) * (0.05 + (d / (R_MAX - R_MIN)) * 0.22);
        theta = idealTheta + armIdx * (Math.PI * 2 / ARMS) + scatter;
      }
      const rj = r * (1 + (Math.random() - 0.5) * 0.05);
      const x = rj * Math.cos(theta);
      const z = rj * Math.sin(theta);
      // Genuinely thin — real disc-galaxy proportions, not a compromise
      // for visibility. This is what makes an edge-on view read as a
      // thin band rather than a puffball.
      const thickness = 4 + 16 * Math.exp(-d / (DECAY_SCALE * 0.5));
      const y = (Math.random() - 0.5) * thickness;

      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;

      // Sharp core falloff (0.18× the decay scale, not 0.5×) so only
      // particles genuinely near R_MIN read warm/bright — a real compact
      // core, not a gentle gradient smeared across the whole disc — plus
      // a real brightness boost on top of the color shift, and a
      // separate arm-vs-field brightness split so arm particles visibly
      // outshine the sparse interarm background rather than density
      // alone (thinned out by additive blending at low opacity) having
      // to carry the whole contrast.
      const coreBlend = Math.exp(-d / (DECAY_SCALE * 0.18));
      const coreBoost = 1 + coreBlend * 2.2;
      const armFieldMult = isArm ? 1.5 : 0.4;
      c.copy(armColor).lerp(coreColor, coreBlend).multiplyScalar(0.62 * coreBoost * armFieldMult);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    // Additive blending (same technique nodeMat already uses) rather than
    // normal — at a dim, cool color and low-ish opacity, normal blending's
    // straight src*alpha dilution made the whole structure read as
    // essentially invisible against the near-black background even though
    // the geometry itself was correct. Additive keeps it reading as dim,
    // distant light rather than a flat translucent shape, while staying
    // well below the strands' own brightness (which runs uncapped past
    // 1.0 at full opacity, vs. this material's fixed sub-1.0 opacity).
    const mat = new THREE.PointsMaterial({
      size: preview ? 1.5 : 2.0, vertexColors: true, transparent: true,
      opacity: 0.7, depthWrite: false, sizeAttenuation: true, fog: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    // A deliberate tilt — the camera's own orbit is rotationally
    // symmetric around Y (theta spins around it freely), so without a
    // break from that symmetry the disc would always present the same
    // edge-on/face-on mix regardless of theta. This tilt is what makes
    // an orbit actually sweep through a range of real views of a flat
    // structure: closer to edge-on (a thin band) at some angles, closer
    // to face-on (arms and core visible) at others — genuinely different
    // depending on where the visitor drags to, which is correct for a
    // thin 3D plane and not something to flatten out for consistency.
    points.rotation.x = 0.3;
    points.rotation.z = 0.15;
    return { points, geo, mat };
  }
  const galaxy = buildGalaxy();
  scene.add(galaxy.points);

  // ─── Nodes + strands, built from the approved Layer 2 set only ─────────
  const rows = getApprovedResonances();
  const DOME_RADIUS = preview ? 78 : 130;
  const nodeMap = buildNodes(rows, DOME_RADIUS);
  const nodeList = Array.from(nodeMap.values());

  const dotTex = makeDotTexture();
  const nodeGeo = new THREE.BufferGeometry();
  const nodePos = new Float32Array(nodeList.length * 3);
  const nodeColor = new Float32Array(nodeList.length * 3);
  const tmpColor = new THREE.Color();
  // Round 2: a node's dot color is its own scene's real established
  // accent (SCENE_ACCENT above), not an arbitrary rainbow hue — so a
  // node visibly belongs to the same color a strand touching it fades
  // toward, instead of the two systems using unrelated palettes.
  nodeList.forEach((n, i) => {
    nodePos[i * 3] = n.pos.x; nodePos[i * 3 + 1] = n.pos.y; nodePos[i * 3 + 2] = n.pos.z;
    tmpColor.setHex(SCENE_ACCENT[n.scene] ?? 0xffffff);
    nodeColor[i * 3] = tmpColor.r; nodeColor[i * 3 + 1] = tmpColor.g; nodeColor[i * 3 + 2] = tmpColor.b;
  });
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
  nodeGeo.setAttribute('color', new THREE.BufferAttribute(nodeColor, 3));
  const nodeMat = new THREE.PointsMaterial({
    size: preview ? 2.2 : 2.6, map: dotTex, vertexColors: true,
    transparent: true, opacity: 0.9, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false,
  });
  const nodePoints = new THREE.Points(nodeGeo, nodeMat);
  scene.add(nodePoints);

  // Strand rods — thin InstancedMesh boxes, same house technique as
  // library.js's hexagon edges/strands (see the Phase 3 architecture
  // survey: this codebase avoids THREE.Line for anything but a single
  // simple wireframe, for known cross-browser line-width limitations).
  //
  // Round 2 splits the VISIBLE geometry from the CLICKABLE geometry, which
  // didn't need splitting before: `strandHit` stays exactly what it was
  // (one thick invisible box per row, unchanged since the round-1 click
  // fix — deliberately not touched again here) but `strandMesh` is now
  // SEGMENTS_PER_STRAND short sub-boxes per row instead of one, each given
  // its own solid color lerped between the two endpoint scenes' own
  // SCENE_ACCENT — a quantized gradient along the strand's own length
  // (source color at one end fading toward target color at the other),
  // using the same InstancedMesh/instanceColor idiom already established
  // rather than a custom shader (no ShaderMaterial exists anywhere else on
  // this site). 6 segments reads as continuous from normal viewing
  // distance without meaningfully increasing draw cost (22 rows × 6 = 132
  // instances, still trivial).
  const SEGMENTS_PER_STRAND = 6;
  const strandGeo = new THREE.BoxGeometry(1, 0.07, 0.07);
  // Round 5 (2026-08-18): brightened significantly — legible up close but
  // too dim at the default zoomed-out viewing distance most visitors
  // actually use. Opacity raised and additive blending added (the same
  // technique nodeMat already uses) so strands read as genuinely glowing
  // lines against the dark background rather than flat translucent rods.
  // Fog fade and the SCENE_ACCENT gradient blend below are unchanged.
  const strandMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const strandMesh = rows.length
    ? new THREE.InstancedMesh(strandGeo, strandMat, rows.length * SEGMENTS_PER_STRAND)
    : null;
  // Cross-section padding around each strand's true 0.07-unit rendered
  // width. 1.4 (the original figure) measured out to only ~5px wide on
  // screen at this scene's own default/zoomed-out camera distances (46°
  // FOV, CAM_MAX 260) — nowhere near a real click target. 4.4 keeps a
  // ~12px-wide target even at full zoom-out, without the strands (sparse,
  // 22 of them across a wide dome) starting to overlap each other's hit
  // regions at normal viewing distance.
  const hitGeo = new THREE.BoxGeometry(1, 4.4, 4.4);
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, fog: false });
  const strandHit = rows.length ? new THREE.InstancedMesh(hitGeo, hitMat, rows.length) : null;

  const strandInfo = []; // { row, aKey, bKey, aPos, bPos, mid, len, segStart, phase, speed, excite }
  if (strandMesh) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const AXIS_X = new THREE.Vector3(1, 0, 0);
    const segColor = new THREE.Color();
    const colorA = new THREE.Color(), colorB = new THREE.Color();
    rows.forEach((row, i) => {
      const aKey = pieceKey(row.a), bKey = pieceKey(row.b);
      const a = nodeMap.get(aKey).pos, b = nodeMap.get(bKey).pos;
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = Math.max(0.001, dir.length());
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      const unit = dir.clone().normalize();
      q.setFromUnitVectors(AXIS_X, unit);
      m.compose(mid, q, new THREE.Vector3(len, 1, 1));
      strandHit.setMatrixAt(i, m);

      colorA.setHex(SCENE_ACCENT[row.a.scene] ?? 0xffffff);
      colorB.setHex(SCENE_ACCENT[row.b.scene] ?? 0xffffff);
      const segLen = len / SEGMENTS_PER_STRAND;
      const segStart = i * SEGMENTS_PER_STRAND;
      for (let s = 0; s < SEGMENTS_PER_STRAND; s++) {
        const t = (s + 0.5) / SEGMENTS_PER_STRAND;
        const segMid = a.clone().addScaledVector(unit, len * t);
        m.compose(segMid, q, new THREE.Vector3(segLen * 1.04, 1, 1)); // tiny overlap so segment seams don't gap
        strandMesh.setMatrixAt(segStart + s, m);
        segColor.lerpColors(colorA, colorB, t);
        strandMesh.setColorAt(segStart + s, segColor);
      }

      strandInfo.push({
        row, aKey, bKey, aPos: a, bPos: b, mid, len, segStart,
        colorA: colorA.clone(), colorB: colorB.clone(),
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.6,
        excite: 0, // 0..1, decays after a touch — brightens the strand briefly
      });
    });
    strandMesh.instanceMatrix.needsUpdate = true;
    strandMesh.instanceColor.needsUpdate = true;
    strandHit.instanceMatrix.needsUpdate = true;
    scene.add(strandMesh, strandHit);
  }

  // ─── Camera: real spherical orbit, pivot at the world origin, clamped to
  // the LOWER hemisphere so it always stays under the node canopy above —
  // "orbit underneath," not a generic look-at-center orbit. ────────────────
  const PIVOT = new THREE.Vector3(0, 0, 0);
  const CAM_MIN = preview ? 30 : 45;
  const CAM_MAX = preview ? 140 : 260;
  let camDist = (CAM_MIN + CAM_MAX) * 0.42;
  let theta = Math.random() * Math.PI * 2;
  // phi measured from +Y: Math.PI/2 is eye-level with the pivot, Math.PI is
  // straight down from above the pivot looking... no — cos(phi) negative
  // for phi>PI/2 puts the camera BELOW the pivot's own height, which is
  // what "underneath" needs. Clamped well short of straight-up (PHI_MAX)
  // so the view never flips through the zenith into looking straight down
  // the strands' own long axis, where the canopy reads as a flat smear.
  const PHI_MIN = Math.PI / 2 + 0.12;
  const PHI_MAX = Math.PI - 0.08;
  let phi = Math.PI - 0.55;
  function updateCamera() {
    const sinPhi = Math.sin(phi);
    camera.position.set(
      PIVOT.x + camDist * sinPhi * Math.sin(theta),
      PIVOT.y + camDist * Math.cos(phi),
      PIVOT.z + camDist * sinPhi * Math.cos(theta),
    );
    camera.lookAt(PIVOT);
  }
  updateCamera();

  // Thread-follow deep link: `initialPieceId` (main.js's generic piece-id
  // hash slot, reused here as a resonance row's own `id` — see this
  // file's header comment) names the exact strand this scene should
  // arrive already oriented at. Orients theta/phi toward that strand's
  // midpoint and fires the same big reaction a primed strand touch would
  // — arriving via a followed thread IS the "elsewhere interaction" this
  // scene reacts to, whether or not sessionStorage's own elsewhere match
  // happens to agree.
  let followedStrand = null;
  if (!preview && initialPieceId !== null) {
    const info = strandInfo.find(s => s.row.id === initialPieceId);
    if (info) {
      followedStrand = info;
      const dir = info.mid.clone().sub(PIVOT);
      const r = dir.length() || 1;
      theta = Math.atan2(dir.x, dir.z);
      phi = THREE.MathUtils.clamp(Math.acos(THREE.MathUtils.clamp(dir.y / r, -1, 1)), PHI_MIN, PHI_MAX);
      // If the strand's own polar angle is above PHI_MIN's ceiling (steep,
      // near-overhead strands are common given the node dome sits mostly
      // near zenith), phi still clamps into range above — theta alone
      // (which direction to face) carries most of "oriented at the strand
      // that brought you" in that case, same as any other steep strand.
      camDist = THREE.MathUtils.clamp(r * 1.35, CAM_MIN, CAM_MAX);
      updateCamera();
    }
  }

  // ─── Title/hint chrome + resonance panel (full only) ─────────────────────
  let titleEl = null, hintEl = null, panel = null, panelCloser = null;
  let panelTitleEl = null, panelRationaleEl = null, panelEndpointsEl = null;
  if (!preview) {
    const frag = parseHTML(constellationHtml);
    titleEl = frag.querySelector('.constellation-title');
    hintEl = frag.querySelector('.constellation-hint');
    document.body.appendChild(titleEl);
    document.body.appendChild(hintEl);

    panel = frag.querySelector('.constellation-panel');
    container.appendChild(panel);
    panelTitleEl = panel.querySelector('.constellation-panel-title');
    panelRationaleEl = panel.querySelector('.constellation-panel-rationale');
    panelEndpointsEl = panel.querySelector('.constellation-panel-endpoints');
    panelCloser = createPanelCloser(panel, container, {
      closeBtn: panel.querySelector('.constellation-panel-close'),
    });
  }

  // Round 2's real click payoff: which two pieces this strand connects,
  // the resonance's own reviewed rationale (its "epistemic backbone" —
  // Scott's own framing), and a jump straight to either one. Reuses
  // constellationPieces.js's resolveEndpointTitle for the title format
  // (matching docs/constellation_resonances.md) and constellationEntry's
  // navigateToPiece for the jump — the same generic pm:navigate dispatch
  // every cross-scene navigation on this site already goes through.
  function openResonancePanel(row) {
    if (!panel) return;
    const endpointA = resolveEndpointTitle(row.a);
    const endpointB = resolveEndpointTitle(row.b);
    panelTitleEl.textContent = row.basis === 'verbatim' ? 'A shared passage' : 'A resonance';
    panelRationaleEl.textContent = row.rationale;
    panelEndpointsEl.innerHTML = '';
    [{ ep: row.a, resolved: endpointA }, { ep: row.b, resolved: endpointB }].forEach(({ ep, resolved }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'constellation-endpoint-link';
      btn.innerHTML = `${escapeHtml(resolved.title)}<span class="constellation-endpoint-go">Open this piece</span>`;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        navigateToPiece(ep.scene, resolved.pieceId);
      });
      panelEndpointsEl.appendChild(btn);
    });
    panel.classList.add('open');
  }

  // ─── Drag to orbit + wheel zoom ──────────────────────────────────────────
  let autoRotate = true;
  const touchGuard = !preview ? bindTapVsDrag(container) : null;
  const orbitDrag = !preview ? bindOrbitDrag(container, {
    onDragStart: () => { autoRotate = false; },
    onDrag: (dx, dy) => {
      theta -= dx;
      phi = THREE.MathUtils.clamp(phi - dy, PHI_MIN, PHI_MAX);
      updateCamera();
    },
    onDragEnd: () => { setTimeout(() => { autoRotate = true; }, 3000); },
  }) : null;
  const wheelZoom = !preview ? bindWheelZoom(container, {
    onZoom: deltaY => {
      camDist = THREE.MathUtils.clamp(camDist + deltaY * 0.05, CAM_MIN, CAM_MAX);
      updateCamera();
    },
  }) : null;

  // ─── Touch a strand ───────────────────────────────────────────────────────
  // `pickStrandAt` is the one raycast both hover and click funnel through.
  // The original version only had this logic inline inside `onMove`, and
  // `onClick` trusted whatever `hoveredIdx` that had last left behind —
  // fine on a desktop where mousemove reliably precedes click at the same
  // coordinates, but a real click/tap has no such guarantee (a touch tap's
  // compatibility mousemove doesn't fire on every browser, and the canopy's
  // own slow autoRotate means even a desktop hover can go stale by a few
  // pixels between "aim" and "click"). Click now always re-checks the ray
  // at its own event coordinates rather than trusting stale hover state.
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let hoveredIdx = -1;
  let onMove = null, onClick = null;
  function pickStrandAt(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObject(strandHit);
    return hits.length ? hits[0].instanceId : -1;
  }
  if (!preview && strandHit) {
    onMove = e => {
      const newHover = pickStrandAt(e.clientX, e.clientY);
      if (newHover !== hoveredIdx) {
        hoveredIdx = newHover;
        container.style.cursor = hoveredIdx !== -1 ? 'pointer' : 'default';
      }
    };
    container.addEventListener('mousemove', onMove);
    onClick = e => {
      if (touchGuard?.consume()) return;
      const idx = pickStrandAt(e.clientX, e.clientY);
      if (idx === -1) return;
      hoveredIdx = idx;
      const info = strandInfo[idx];
      info.excite = 1;
      openResonancePanel(info.row);
    };
    container.addEventListener('click', onClick);
  }

  // Keyboard equivalent — strands are otherwise raycast-only. Labels stay
  // generic ("Strand N") — the panel itself is what discloses which two
  // pieces a strand connects once it's open; the jump-list label doesn't
  // need to spoil that in advance.
  let jumpList = null;
  if (!preview && strandInfo.length) {
    jumpList = createJumpList(container, {
      label: 'Touch a strand',
      items: strandInfo,
      getLabel: (_info, i) => `Strand ${i + 1}`,
      onSelect: info => { info.excite = 1; openResonancePanel(info.row); },
    });
  }

  if (followedStrand) {
    followedStrand.excite = 1;
    openResonancePanel(followedStrand.row);
  }

  const reduceMotion = prefersReducedMotion();

  // ─── Animate ──────────────────────────────────────────────────────────────
  let animId, lastT = performance.now();
  function animate(now) {
    animId = requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    if (!reduceMotion) {
      if (autoRotate && !(orbitDrag && orbitDrag.isDragging)) {
        theta += preview ? 0.0018 : 0.0006;
        updateCamera();
      }
    }

    // Strand shimmer + touch excitement decay. Re-lerps each segment's own
    // colorA→colorB gradient every frame rather than overwriting with a
    // flat color — shimmer/excite modulate BRIGHTNESS of the real
    // source→target gradient, they don't replace it. Distance fade itself
    // needs no JS here at all — scene.fog handles that per-fragment.
    if (strandMesh) {
      strandInfo.forEach(s => {
        s.phase += dt * s.speed;
        // Round 5: baseline raised (0.55→0.85) so strands read bright at
        // rest, not just when excited — the excite pulse is still a
        // distinct boost on top of this, not the only source of brightness.
        const shimmer = reduceMotion ? 0.95 : 0.85 + Math.sin(s.phase) * 0.35;
        s.excite = Math.max(0, s.excite - dt * 1.6);
        const brightness = Math.min(1.9, shimmer + s.excite * 1.3);
        for (let seg = 0; seg < SEGMENTS_PER_STRAND; seg++) {
          const t = (seg + 0.5) / SEGMENTS_PER_STRAND;
          tmpColor.lerpColors(s.colorA, s.colorB, t).multiplyScalar(brightness);
          strandMesh.setColorAt(s.segStart + seg, tmpColor);
        }
      });
      strandMesh.instanceColor.needsUpdate = true;
    }

    // Node shimmer, cheap per-vertex-color reuse of the same technique —
    // modulates brightness of the node's own SCENE_ACCENT rather than an
    // arbitrary HSL rainbow (see the node-color setup above).
    if (!reduceMotion) {
      const colAttr = nodeGeo.attributes.color;
      nodeList.forEach((n, i) => {
        const b = 0.75 + Math.sin(now * 0.0012 + i * 0.7) * 0.25;
        tmpColor.setHex(SCENE_ACCENT[n.scene] ?? 0xffffff).multiplyScalar(b);
        colAttr.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
      });
      colAttr.needsUpdate = true;
    }

    renderer.render(scene, camera);
  }
  animId = requestAnimationFrame(animate);

  const resize = bindGuardedResize(container, (nw, nh) => {
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });

  return {
    dispose() {
      cancelAnimationFrame(animId);
      resize.dispose();
      orbitDrag?.dispose();
      wheelZoom?.dispose();
      touchGuard?.dispose();
      jumpList?.dispose();
      panelCloser?.dispose();
      if (onMove) container.removeEventListener('mousemove', onMove);
      if (onClick) container.removeEventListener('click', onClick);
      renderer.dispose();

      starGeo.dispose(); starMat.dispose();
      galaxy.geo.dispose(); galaxy.mat.dispose();
      nodeGeo.dispose(); nodeMat.dispose(); dotTex.dispose();
      strandGeo.dispose(); strandMat.dispose();
      hitGeo.dispose(); hitMat.dispose();

      titleEl?.remove();
      hintEl?.remove();
      panel?.remove();
      renderer.domElement.remove();
    },
  };
}
