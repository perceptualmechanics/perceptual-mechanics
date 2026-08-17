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
// strands, looking up — the same "underside of the web" framing the
// spider's own premise depends on (constellation-brief.md), just the
// visitor's version of it rather than the spider's.
//
// Round 2 (2026-08-16) reversed the original "purely atmospheric, no
// panel" design: touching a strand now opens a real read-more panel
// naming both connected pieces and showing the resonance's own reviewed
// rationale, with a jump link to either piece — see constellation.html's
// header comment for why. The spider reaction stays as a secondary,
// atmospheric response layered alongside the panel, not instead of it.
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
const LEG_COUNT = 8;
const GOLD_ACCENT = 0xffdc78; // same accent beamline/sphere already use — see NOTES.md's "gold presence" entry

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
  // stay legible regardless of distance (stars, nodes, the spider).
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
  const strandMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false,
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

  // Adjacency graph for the spider's own locomotion (below) — every node
  // key maps to the OTHER node key(s) it shares an approved strand with,
  // symmetric (resonance rows have no directionality), built once here
  // since it only ever depends on rows/nodeMap, not on anything the
  // spider itself does.
  const adjacency = new Map(); // key -> [{ toKey, toPos }]
  function addEdge(fromKey, toKey, toPos) {
    if (!adjacency.has(fromKey)) adjacency.set(fromKey, []);
    adjacency.get(fromKey).push({ toKey, toPos });
  }

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
      addEdge(aKey, bKey, b);
      addEdge(bKey, aKey, a);
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

  // ─── "Elsewhere" priming ─────────────────────────────────────────────────
  // main.js stashes the last piece opened in ANY scene into sessionStorage
  // (see its own comment there) whenever a visitor opens something — this
  // is the only cross-scene "what are you currently interacting with"
  // signal the site has (no scene reads another scene's live state; see
  // the Phase 3 architecture survey). A strand touching that piece gets a
  // bigger reaction than an unrelated one — constellation-brief.md's
  // "rests until a strand tied to whatever the visitor's currently
  // interacting with elsewhere gets touched, then reacts."
  let elsewhereKey = null;
  try {
    const raw = sessionStorage.getItem('pm_elsewhere');
    if (raw) {
      const e = JSON.parse(raw);
      if (e && e.scene) elsewhereKey = `${e.scene}:${e.id}`;
    }
  } catch { /* sessionStorage unavailable (private mode etc.) — elsewhere stays null, every touch reads as an equal, un-primed strand */ }
  function isPrimed(row) {
    if (!elsewhereKey) return false;
    return pieceKey(row.a) === elsewhereKey || pieceKey(row.b) === elsewhereKey;
  }

  // ─── The spider ─────────────────────────────────────────────────────────
  // Round 4 (2026-08-18): Scott inspected the round-2 shape directly (not
  // a description of it), found it read as a placeholder — eight straight
  // lines from one point, one bend each, even 45-degree radial symmetry,
  // "the Atari 1982 read" — then, after a first structural pass, gave a
  // second, more precise spec building on real daddy-longlegs anatomy,
  // "as checkable as the fog falloff formula." This is that spec, built
  // literally:
  //   - Hub: a small, closed, elongated OVAL outline (a LineLoop, not a
  //     filled mass, not the spherical wireframe the first pass used) —
  //     real width along its own long axis, legs attaching along its two
  //     long sides rather than around one vertex.
  //   - Attachment: four points per long side (eight total), positioned
  //     BY the hub's own long axis (LEG_ROWS' xFrac below), not spread
  //     evenly around a circle — real front-to-back unevenness in both
  //     spacing and angle, the way an actual daddy-longlegs attaches.
  //   - Per leg: three joints, four segments (coxa→femur→knee→ankle),
  //     each segment narrower than the last from hub to tip. The
  //     signature silhouette — coxa and femur angling UP and outward from
  //     the hub, past the body's own height, before the knee joint
  //     reverses sharply and the tibia angles back DOWN toward the
  //     surface, with the ankle giving the tarsus tip a faint curl on the
  //     way down — is what actually reads as "daddy-longlegs" rather
  //     than "generic spider"; a single V-bend never gets there no matter
  //     how thin the lines are.
  //   - Asymmetry: every leg gets its own small random jitter on top of
  //     its row's base angles/length, so no two legs — including
  //     mirrored left/right pairs — are identical copies.
  //   - Idle motion: each of the four joints drifts independently (own
  //     phase, own speed), all the time, not just at rest — there's
  //     finally real per-joint structure for "small continuous
  //     adjustments" (round 2's own phrase) to actually happen within,
  //     which is also what stops the creature from reading as "only
  //     moving because the camera orbits around it."
  const LEG_ROWS = [
    // { xFrac, lenScale, coxaBase, femurBase, kneeBase, ankleBase } —
    // front-to-back position along the hub's long axis (xFrac, as a
    // fraction of HUB_LEN) and base joint angles, deliberately uneven
    // rather than four identical rows. coxaBase/femurBase are RELATIVE
    // rotations that both add to the upward-outward reach; kneeBase is
    // the big relative reversal back down; ankleBase is the small
    // relative curl back up at the very tip.
    { xFrac: -0.85, lenScale: 0.80, coxaBase: 0.40, femurBase: 0.28, kneeBase: -2.00, ankleBase: 0.50 },
    { xFrac: -0.28, lenScale: 1.00, coxaBase: 0.48, femurBase: 0.36, kneeBase: -2.15, ankleBase: 0.58 },
    { xFrac: 0.32, lenScale: 0.96, coxaBase: 0.50, femurBase: 0.33, kneeBase: -2.20, ankleBase: 0.62 },
    { xFrac: 0.80, lenScale: 0.76, coxaBase: 0.42, femurBase: 0.26, kneeBase: -1.95, ankleBase: 0.48 },
  ];
  function buildSpider() {
    const group = new THREE.Group();

    // Closed oval hub — a LineLoop (auto-closes last point to first, no
    // duplicate needed), flat in local XZ (the body's own long/front-back
    // axis is local X, matching LEG_ROWS' xFrac), so a camera looking up
    // from below sees the oval roughly face-on, the way you'd see a real
    // bug's body outline looking up at its belly.
    const HUB_LEN = preview ? 2.0 : 2.8; // semi-major, along the body axis
    const HUB_WID = preview ? 0.85 : 1.15; // semi-minor, across
    const HUB_SEGS = 14;
    const hubPts = [];
    for (let s = 0; s < HUB_SEGS; s++) {
      const a = (s / HUB_SEGS) * Math.PI * 2;
      hubPts.push(new THREE.Vector3(Math.cos(a) * HUB_LEN, 0, Math.sin(a) * HUB_WID));
    }
    const hubGeo = new THREE.BufferGeometry().setFromPoints(hubPts);
    const hubMat = new THREE.LineBasicMaterial({ color: GOLD_ACCENT, transparent: true, opacity: 0.55, fog: false });
    const hub = new THREE.LineLoop(hubGeo, hubMat);
    group.add(hub);

    const legMat = new THREE.MeshBasicMaterial({ color: GOLD_ACCENT, transparent: true, opacity: 0.6, fog: false });
    const scale = preview ? 0.72 : 1;
    const coxaBaseLen = 1.3 * scale, femurBaseLen = 3.6 * scale, tibiaBaseLen = 5.8 * scale, tarsusBaseLen = 1.7 * scale;
    const geosToDispose = [hubGeo];
    const jitter = amp => (Math.random() - 0.5) * 2 * amp; // small per-leg-per-attribute noise, no two legs identical
    const mkIdle = () => ({ phase: Math.random() * Math.PI * 2, speed: 0.4 + Math.random() * 0.35 });
    const legs = [];
    for (let i = 0; i < LEG_COUNT; i++) {
      const row = LEG_ROWS[i % 4];
      const side = i < 4 ? 1 : -1; // one long side of the hub vs. the other — bilateral, not radial
      const lenScale = row.lenScale + jitter(0.05);

      // Attachment point: on the hub's own edge, at this row's position
      // along the long axis — NOT spread evenly around a circle.
      const hipX = row.xFrac * HUB_LEN;
      const hipZ = side * HUB_WID * 0.94;
      const hip = new THREE.Group();
      hip.position.set(hipX, 0, hipZ);
      // Local +X should point outward, sideways off the body axis, with a
      // small fore/aft lean that varies by row (front rows sweep slightly
      // forward, back rows slightly backward) — mirrored, not duplicated,
      // across the two sides.
      const leanRad = row.xFrac * 0.32 + jitter(0.05);
      const azRight = -Math.PI / 2 + leanRad;
      hip.rotation.y = side === 1 ? azRight : (Math.PI - azRight);
      group.add(hip);

      // Coxa: short first segment, angles UP and outward from the hub.
      const coxaLen = coxaBaseLen * lenScale;
      const coxaBase = row.coxaBase + jitter(0.06);
      const coxaPivot = new THREE.Group();
      coxaPivot.rotation.z = coxaBase;
      hip.add(coxaPivot);
      const coxaGeo = new THREE.BoxGeometry(coxaLen, 0.11, 0.11);
      const coxa = new THREE.Mesh(coxaGeo, legMat);
      coxa.position.x = coxaLen / 2;
      coxaPivot.add(coxa);
      geosToDispose.push(coxaGeo);

      // Femur: continues the upward-outward reach to the peak — the
      // "knee higher than the body" the whole silhouette depends on.
      const femurLen = femurBaseLen * lenScale;
      const femurBase = row.femurBase + jitter(0.06);
      const femurJoint = new THREE.Group();
      femurJoint.position.x = coxaLen;
      coxaPivot.add(femurJoint);
      const femurPivot = new THREE.Group();
      femurPivot.rotation.z = femurBase;
      femurJoint.add(femurPivot);
      const femurGeo = new THREE.BoxGeometry(femurLen, 0.085, 0.085);
      const femur = new THREE.Mesh(femurGeo, legMat);
      femur.position.x = femurLen / 2;
      femurPivot.add(femur);
      geosToDispose.push(femurGeo);

      // Knee: the reversal — a big relative bend that sends the tibia
      // back down toward the surface instead of continuing to climb.
      const tibiaLen = tibiaBaseLen * lenScale;
      const kneeBase = row.kneeBase + jitter(0.08);
      const kneeJoint = new THREE.Group();
      kneeJoint.position.x = femurLen;
      femurPivot.add(kneeJoint);
      const kneePivot = new THREE.Group();
      kneePivot.rotation.z = kneeBase;
      kneeJoint.add(kneePivot);
      const tibiaGeo = new THREE.BoxGeometry(tibiaLen, 0.05, 0.05);
      const tibia = new THREE.Mesh(tibiaGeo, legMat);
      tibia.position.x = tibiaLen / 2;
      kneePivot.add(tibia);
      geosToDispose.push(tibiaGeo);

      // Ankle: short, thin terminal segment with a faint curl back up —
      // a foot touching down, not a stick ending in a point.
      const tarsusLen = tarsusBaseLen * lenScale;
      const ankleBase = row.ankleBase + jitter(0.05);
      const ankleJoint = new THREE.Group();
      ankleJoint.position.x = tibiaLen;
      kneePivot.add(ankleJoint);
      const anklePivot = new THREE.Group();
      anklePivot.rotation.z = ankleBase;
      ankleJoint.add(anklePivot);
      const tarsusGeo = new THREE.BoxGeometry(tarsusLen, 0.03, 0.03);
      const tarsus = new THREE.Mesh(tarsusGeo, legMat);
      tarsus.position.x = tarsusLen / 2;
      anklePivot.add(tarsus);
      geosToDispose.push(tarsusGeo);

      legs.push({
        coxaPivot, femurPivot, kneePivot, anklePivot,
        baseCoxa: coxaBase, baseFemur: femurBase, baseKnee: kneeBase, baseAnkle: ankleBase,
        // Four independent idle drifts, one per joint — round 2's "small,
        // continuous adjustments, not a rigid shape" finally has real
        // per-joint structure to happen in, instead of being folded into
        // just two shared sine terms.
        idle: { coxa: mkIdle(), femur: mkIdle(), knee: mkIdle(), ankle: mkIdle() },
        reactionT: null, // null = not reacting; else seconds since triggered
        reactionAmp: 0,
      });
    }
    return { group, legMat, hubMat, geosToDispose, legs };
  }
  const spider = buildSpider();
  scene.add(spider.group);

  // ─── Locomotion: rest at a node, travel to an adjacent one ──────────────
  // Round 2 replaces the original independent orbiting drift (a fixed
  // circular path with no relationship to the actual strand geometry)
  // with real locomotion along the graph the strands themselves define —
  // "the spider actually travels between strands over time," genuinely
  // walking node to node along a strand's own line, not idling at a fixed
  // point while the camera does all the apparent work. Falls back to a
  // fixed point straight overhead if there are no approved rows at all
  // (nodeList empty — no graph to walk).
  const FALLBACK_POS = new THREE.Vector3(0, DOME_RADIUS * 0.7, 0);
  let spiderNodeKey = nodeList.length ? nodeList[Math.floor(Math.random() * nodeList.length)].key : null;
  const spiderPos = (spiderNodeKey ? nodeMap.get(spiderNodeKey).pos : FALLBACK_POS).clone();
  let spiderState = 'rest'; // 'rest' | 'travel'
  let spiderRestT = 0;
  let spiderRestDuration = 3 + Math.random() * 5;
  let spiderTravel = null; // { toKey, fromPos, toPos, t, duration }
  let spiderBreathePhase = Math.random() * Math.PI * 2;
  let spiderOutward = spiderPos.clone().normalize(); // recomputed every updateSpiderTransform call, cached for the idle-breathe offset

  function pickNextEdge(fromKey) {
    const edges = adjacency.get(fromKey);
    return edges && edges.length ? edges[Math.floor(Math.random() * edges.length)] : null;
  }
  const WALK_SPEED = preview ? 5 : 7; // world units/sec
  function startTravel() {
    const edge = spiderNodeKey ? pickNextEdge(spiderNodeKey) : null;
    if (!edge) { spiderRestT = 0; return; } // isolated node (shouldn't happen — every node here has >=1 approved strand) or empty graph; just keep resting
    const fromPos = spiderPos.clone();
    const dist = fromPos.distanceTo(edge.toPos);
    spiderTravel = { toKey: edge.toKey, fromPos, toPos: edge.toPos.clone(), t: 0, duration: Math.max(0.7, dist / WALK_SPEED) };
    spiderState = 'travel';
  }
  function finishTravel() {
    spiderNodeKey = spiderTravel.toKey;
    spiderPos.copy(spiderTravel.toPos);
    spiderTravel = null;
    spiderState = 'rest';
    spiderRestT = 0;
    spiderRestDuration = 3 + Math.random() * 5;
  }
  // Smoothstep-style ease so travel accelerates out of rest and decelerates
  // into the next node rather than gliding at a robotic constant velocity.
  function easeInOutQuad(u) { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }

  function updateSpiderTransform() {
    spider.group.position.copy(spiderPos);
    // Body's local +Y (the plane the legs radiate around) faces AWAY from
    // the world origin — outward into the canopy, belly toward the
    // camera below — "walking its underside" made literal, and correct
    // at any position along the dome's surface, resting or mid-travel.
    spiderOutward = spiderPos.clone().normalize();
    spider.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), spiderOutward);
  }
  updateSpiderTransform();

  // Triggers a reaction: `bigReaction` (a primed strand, or the strand a
  // thread-follow deep link arrived on) flicks every leg at once; an
  // ordinary touch flicks only the leg nearest the strand's own direction
  // from the spider, so a visitor idly touching several strands sees the
  // reaction move around the spider rather than the same leg every time.
  function triggerReaction(strandMidWorld, bigReaction) {
    if (bigReaction) {
      spider.legs.forEach(l => { l.reactionT = 0; l.reactionAmp = 1; });
      return;
    }
    const spiderPos = spider.group.position;
    const toStrand = new THREE.Vector3().subVectors(strandMidWorld, spiderPos);
    const localDir = toStrand.applyQuaternion(spider.group.quaternion.clone().invert());
    const angle = Math.atan2(localDir.z, localDir.x);
    const norm = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const nearest = Math.round(norm / (Math.PI * 2 / LEG_COUNT)) % LEG_COUNT;
    spider.legs[nearest].reactionT = 0;
    spider.legs[nearest].reactionAmp = 1;
    // A faint sympathetic twitch on its two neighbors reads as a real
    // body responding, not one limb operating in isolation.
    [(nearest + 1) % LEG_COUNT, (nearest - 1 + LEG_COUNT) % LEG_COUNT].forEach(ni => {
      if (spider.legs[ni].reactionT === null) { spider.legs[ni].reactionT = 0; spider.legs[ni].reactionAmp = 0.35; }
    });
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
      triggerReaction(info.mid, isPrimed(info.row));
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
      onSelect: info => { info.excite = 1; triggerReaction(info.mid, isPrimed(info.row)); openResonancePanel(info.row); },
    });
  }

  if (followedStrand) {
    followedStrand.excite = 1;
    triggerReaction(followedStrand.mid, true);
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
      // Locomotion state machine — see the "Locomotion" comment above for
      // why this replaced the original independent orbital drift. Gated
      // entirely under reduceMotion, same as the old drift was: a visitor
      // who's asked for reduced motion gets a spider that holds its
      // resting node the whole time rather than ever walking.
      if (spiderState === 'rest') {
        spiderRestT += dt;
        if (spiderRestT >= spiderRestDuration) startTravel();
      } else if (spiderTravel) {
        spiderTravel.t += dt;
        const u = Math.min(1, spiderTravel.t / spiderTravel.duration);
        spiderPos.lerpVectors(spiderTravel.fromPos, spiderTravel.toPos, easeInOutQuad(u));
        if (u >= 1) finishTravel();
      }
      updateSpiderTransform();
      // Idle breathing — a small in/out offset along the spider's own
      // outward-facing axis while resting, on top of (not instead of)
      // the per-leg idle sway below, so "resting" still reads as a body
      // breathing rather than a rigid shape parked at a point. Travel
      // itself is real translation, which already sells "alive" on its
      // own, so this only runs at rest.
      if (spiderState === 'rest') {
        const breathe = Math.sin(now * 0.0009 + spiderBreathePhase) * 0.14;
        spider.group.position.addScaledVector(spiderOutward, breathe);
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
        const shimmer = reduceMotion ? 0.7 : 0.55 + Math.sin(s.phase) * 0.35;
        s.excite = Math.max(0, s.excite - dt * 1.6);
        const brightness = Math.min(1.6, shimmer + s.excite * 1.3);
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

    // Spider legs: four independently-phased idle drifts (one per joint,
    // running continuously — not gated to rest-only anymore, per Scott's
    // own follow-up: "idle motion should be per-joint and out of phase
    // across legs... this should also resolve the 'not moving, just
    // rotating with the camera' complaint"), a walking gait layered on
    // top during travel (phase-delayed joint to joint — femur leads,
    // knee follows, ankle follows that, a wave running down the leg
    // rather than the whole leg swinging as one rigid unit), and a
    // reaction burst on top of whichever of those is running.
    spider.legs.forEach((l, li) => {
      let idleC = 0, idleF = 0, idleK = 0, idleA = 0;
      if (!reduceMotion) {
        idleC = Math.sin(now * 0.0009 * l.idle.coxa.speed + l.idle.coxa.phase) * 0.05;
        idleF = Math.sin(now * 0.0010 * l.idle.femur.speed + l.idle.femur.phase) * 0.06;
        idleK = Math.sin(now * 0.0007 * l.idle.knee.speed + l.idle.knee.phase) * 0.08;
        idleA = Math.sin(now * 0.0012 * l.idle.ankle.speed + l.idle.ankle.phase) * 0.05;
      }
      let gaitF = 0, gaitK = 0, gaitA = 0;
      if (!reduceMotion && spiderState === 'travel') {
        // Walking gait: legs alternate in two groups of four (a
        // simplified tripod-style gait), synced to elapsed time rather
        // than travel progress so the cadence stays consistent regardless
        // of how far a given hop happens to be. Each joint picks the wave
        // up a little later than the one before it (phase delay), which
        // is what makes it read as a leg pushing off and following
        // through rather than a single arm swinging as a rigid unit.
        const group = li % 2;
        const gaitPhase = now * 0.0044 + group * Math.PI;
        gaitF = Math.sin(gaitPhase) * 0.22;
        gaitK = Math.sin(gaitPhase - 0.4) * 0.16;
        gaitA = Math.sin(gaitPhase - 0.8) * 0.10;
      }
      let burst = 0;
      if (l.reactionT !== null) {
        l.reactionT += dt;
        const decay = Math.exp(-l.reactionT * 5.5);
        burst = Math.sin(l.reactionT * 26) * 0.5 * decay * l.reactionAmp;
        if (l.reactionT > 1.2) l.reactionT = null;
      }
      l.coxaPivot.rotation.z = l.baseCoxa + idleC + burst * 0.3;
      l.femurPivot.rotation.z = l.baseFemur + idleF + gaitF + burst;
      l.kneePivot.rotation.z = l.baseKnee + idleK + gaitK - burst * 0.8;
      l.anklePivot.rotation.z = l.baseAnkle + idleA + gaitA - burst * 0.4;
    });

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
      nodeGeo.dispose(); nodeMat.dispose(); dotTex.dispose();
      strandGeo.dispose(); strandMat.dispose();
      hitGeo.dispose(); hitMat.dispose();
      spider.legMat.dispose(); spider.hubMat.dispose();
      spider.geosToDispose.forEach(g => g.dispose());

      titleEl?.remove();
      hintEl?.remove();
      panel?.remove();
      renderer.domElement.remove();
    },
  };
}
