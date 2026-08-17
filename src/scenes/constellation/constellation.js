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
// approved rows only.
//
// Round 2 (2026-08-16) reversed the original "purely atmospheric, no
// panel" design: touching a strand now opens a real read-more panel
// naming both connected pieces and showing the resonance's own reviewed
// rationale, with a jump link to either piece — see constellation.html's
// header comment for why.
//
// Round 5 (2026-08-18) removed the spider entirely, brightened the
// strands, and added a real logarithmic-spiral galactic backdrop.
//
// Round 7 (2026-08-18) — full reset: every prior round positioned nodes
// arbitrarily (a hash-seeded dome placement) and drew strands between
// whichever ones happened to resonate. That's decorative placement, not
// a layout the data actually produced — no amount of brightness or
// backdrop tuning was ever going to make arbitrary dots read as a real
// graph, because the graph's real shape never had anywhere to become
// visible. Fixed with an actual force-directed layout (Fruchterman-
// Reingold: mutual repulsion between every pair of nodes, attraction
// between nodes sharing an approved resonance, relaxed to equilibrium —
// see layoutForceDirected below), which produces genuine clusters:
// tightly-interconnected pieces pull together, unconnected or loosely-
// connected ones drift apart. The camera also lost its "underneath a
// canopy" constraint from this same round — a force-directed graph has
// no inherent up or down, so orbiting is now a conventional full-freedom
// external view, the same drag/zoom house pattern already used
// elsewhere on the site (Orbiter, Orrery's own preview-tile drag), just
// without a hemisphere bias.
//
// Known tension, flagged rather than resolved this round: the
// ground-glimpse entry point (src/utils/constellationEntry.js, wired
// into beamline/orrery) was built entirely on the premise that this
// scene lives underneath something, revealed through a floor. That
// premise no longer holds now that the destination is an external star
// map, not an underside. Left untouched pending an explicit decision —
// see NOTES.md's round-7 entry. Thread-follow (the other entry point)
// doesn't depend on the underneath framing and is unaffected.
//
// Reached two ways (both additive, per the 2026-08-16 entry-point brief):
// the ground glimpse and the thread-follow filament (same file, wired
// into every found-text scene's panel). Both dispatch `pm:navigate` on
// window; main.js's own listener is what actually calls
// expandScene('constellation', ..., resonanceId) — this file has no idea
// how it got opened, only whether `initialPieceId` (reused here to mean
// a resonance row's own `id`, not a piece id — see this scene's own
// entry in main.js's SCENES map for why that's safe) names a specific
// strand to arrive already oriented at.

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

// One node per unique piece touched by an approved row — no other piece
// in the corpus becomes a node at all, so there's nothing isolated/dim to
// contrast against; every dot on screen participates in at least one
// resonance by construction. Position is a placeholder here (the real
// work happens in layoutForceDirected below); this just establishes
// identity.
function buildNodes(rows) {
  const nodes = new Map();
  rows.forEach(r => {
    [r.a, r.b].forEach(ep => {
      const key = pieceKey(ep);
      if (nodes.has(key)) return;
      nodes.set(key, { key, scene: ep.scene, pos: new THREE.Vector3() });
    });
  });
  return nodes;
}

// ─── Real force-directed layout ─────────────────────────────────────────────
// Fruchterman-Reingold, the standard algorithm for exactly this problem —
// not a hand-tuned approximation. Two real forces, run to equilibrium:
//   - Repulsion between EVERY pair of nodes (F = k²/d), pushing everything
//     apart by default — this is what gives isolated/loosely-connected
//     pieces somewhere to drift to.
//   - Attraction between nodes sharing an approved resonance (F = d²/k),
//     pulling connected pairs together — this is what produces real
//     clusters: tightly-interconnected groups pull into a tight knot,
//     sitting apart from other clusters.
// A cooling schedule (temperature `t` shrinking linearly to 0 across the
// run) caps how far a node can move in a single step, so the system settles
// into equilibrium instead of oscillating. Extended to 3D directly (same
// two force laws, positions/deltas just carry a z-component) rather than
// laying out in 2D and lifting afterward.
//
// One addition beyond textbook FR, needed because this graph is sparse and
// far from fully connected (22 approved rows, 32 nodes — many small
// islands of 1-3 pieces with nothing pulling them toward the rest): a mild
// gravity term pulls every node back toward the centroid each step,
// proportional to its own distance from it. Without this, disconnected
// components have no attractive force acting on them at all and drift
// apart under pure repulsion without bound (confirmed empirically — see
// NOTES.md's round-7 entry for the actual numbers). With it, isolated
// pieces still land clearly OUTSIDE the interconnected clusters — that's
// the desired "periphery" read — just not at unbounded distance.
//
// Deterministic by construction: initial positions are seeded from
// hashStr01 (not Math.random()), and the relaxation itself has no
// randomness, so the same approved-rows set always settles into the same
// shape on every load/build, matching this file's existing "deterministic
// layout, no persisted coordinates" convention.
function layoutForceDirected(nodeList, rows, scale) {
  const n = nodeList.length;
  if (n === 0) return;

  nodeList.forEach(nd => {
    const ax = hashStr01(nd.key + ':x') * 2 - 1;
    const ay = hashStr01(nd.key + ':y') * 2 - 1;
    const az = hashStr01(nd.key + ':z') * 2 - 1;
    nd.pos.set(ax, ay, az).multiplyScalar(scale * 0.5);
  });

  const idx = new Map(nodeList.map((nd, i) => [nd.key, i]));
  const edges = [];
  rows.forEach(row => {
    const a = idx.get(pieceKey(row.a));
    const b = idx.get(pieceKey(row.b));
    if (a !== undefined && b !== undefined && a !== b) edges.push([a, b]);
  });

  const k = scale / Math.cbrt(n); // ideal edge length — the standard FR sizing for n nodes in a volume ~scale³
  const GRAVITY = 1.0; // calibrated live (see NOTES.md) so disconnected islands settle at a bounded, still-clearly-separate distance rather than flying apart under unbounded repulsion
  const ITERATIONS = 400;
  const t0 = scale * 0.06;

  const disp = nodeList.map(() => new THREE.Vector3());
  const delta = new THREE.Vector3();

  for (let iter = 0; iter < ITERATIONS; iter++) {
    disp.forEach(v => v.set(0, 0, 0));

    // Repulsion — every pair, every iteration. O(n²) but n is small (a
    // few dozen nodes), so this is trivial even at 400 iterations.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        delta.subVectors(nodeList[i].pos, nodeList[j].pos);
        let dist = delta.length();
        if (dist < 0.05) dist = 0.05; // guard against a singularity if two nodes ever land exactly on each other
        const force = (k * k) / dist;
        delta.multiplyScalar(force / dist);
        disp[i].add(delta);
        disp[j].sub(delta);
      }
    }

    // Attraction — only between nodes sharing an approved resonance.
    edges.forEach(([a, b]) => {
      delta.subVectors(nodeList[a].pos, nodeList[b].pos);
      let dist = delta.length();
      if (dist < 0.05) dist = 0.05;
      const force = (dist * dist) / k;
      delta.multiplyScalar(force / dist);
      disp[a].sub(delta);
      disp[b].add(delta);
    });

    // Gravity — see the function's own header comment for why a sparse,
    // largely-disconnected graph needs this beyond textbook FR.
    for (let i = 0; i < n; i++) {
      disp[i].addScaledVector(nodeList[i].pos, -GRAVITY);
    }

    // Cooling: cap this step's displacement to the current temperature.
    const t = t0 * (1 - iter / ITERATIONS);
    for (let i = 0; i < n; i++) {
      const len = disp[i].length();
      if (len > 0.0001) {
        const capped = Math.min(len, Math.max(t, 0.02));
        nodeList[i].pos.addScaledVector(disp[i], capped / len);
      }
    }
  }

  // Recenter on the actual centroid so the camera's pivot (world origin)
  // is the layout's own center of mass, not an arbitrary point.
  const centroid = new THREE.Vector3();
  nodeList.forEach(nd => centroid.add(nd.pos));
  centroid.multiplyScalar(1 / n);
  nodeList.forEach(nd => nd.pos.sub(centroid));
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

  // ─── Graph first — everything else (camera bounds, fog density, where
  // the star field/galaxy backdrop sit) derives from the layout's own
  // actual resulting scale, computed here before any of that downstream
  // setup runs. A bigger or smaller approved set changes boundRadius, and
  // the whole scene adjusts to match rather than assuming a fixed size.
  const rows = getApprovedResonances();
  const nodeMap = buildNodes(rows);
  const nodeList = Array.from(nodeMap.values());
  const GRAPH_SCALE = preview ? 90 : 150;
  layoutForceDirected(nodeList, rows, GRAPH_SCALE);
  let boundRadius = 1;
  nodeList.forEach(n => { boundRadius = Math.max(boundRadius, n.pos.length()); });

  const CAM_MIN = Math.max(20, boundRadius * 0.45);
  const CAM_MAX = boundRadius * 3.0;
  const CAM_DEFAULT = boundRadius * 1.9;
  const FOG_DENSITY = 1.55 / CAM_MAX; // same dimensionless product the pre-reset camera/fog pairing used, just re-derived for the new scale
  const STAR_R_MIN = CAM_MAX * 1.25;
  const STAR_R_MAX = CAM_MAX * 1.75;
  const GALAXY_R_MIN = STAR_R_MAX * 1.3;
  const GALAXY_R_MAX = GALAXY_R_MIN * 3.5;
  const CAM_FAR = Math.max(2000, GALAXY_R_MAX * 1.3);
  // Visual-size constants (round 5/6) were tuned against the old, smaller
  // camera range (CAM_MAX 260 full / 140 preview). The graph's real scale
  // pushed CAM_MAX out substantially, so point/rod sizes scale up by the
  // same ratio to keep the same apparent on-screen size rather than
  // shrinking into the larger distances.
  const SCALE_FACTOR = CAM_MAX / (preview ? 140 : 260);

  const scene = new THREE.Scene();
  const BG_COLOR = 0x00010a;
  scene.background = new THREE.Color(BG_COLOR);
  // Distance-based legibility (round 2, 2026-08-16) — real THREE.FogExp2,
  // the same exponential Beer-Lambert falloff already trusted for
  // Beamline's own atmospheric perspective. Scoped to strands only —
  // `.fog = false` is set explicitly below on every material that should
  // stay legible regardless of distance (stars, nodes, the galactic backdrop).
  scene.fog = new THREE.FogExp2(BG_COLOR, FOG_DENSITY);

  const camera = new THREE.PerspectiveCamera(46, w / h, 0.1, CAM_FAR);
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
  // random direction via acos(2u-1), not a naive polar-biased sample),
  // sized to sit clearly beyond the graph and the camera's own max zoom-
  // out, whatever the graph's actual scale turns out to be. ─────────────
  const starCount = preview ? 300 : 900;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = STAR_R_MIN + Math.random() * (STAR_R_MAX - STAR_R_MIN);
    const theta = Math.random() * Math.PI * 2;
    const phiA = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(phiA) * Math.cos(theta);
    starPos[i * 3 + 1] = Math.abs(r * Math.sin(phiA) * Math.sin(theta));
    starPos[i * 3 + 2] = r * Math.cos(phiA);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xbbccff, size: 0.9 * SCALE_FACTOR, transparent: true, opacity: 0.5, sizeAttenuation: true, fog: false });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  // ─── Galactic backdrop ───────────────────────────────────────────────────
  // Round 5: a genuine 3D galactic disc, not a flat skybox image. Two real
  // formulas, not a hand-placed swirl — arm shape from the logarithmic
  // spiral r = a·e^(bθ), density from a true exponential radial falloff
  // via inverse-CDF sampling of r. Round 5 correction: genuinely thin,
  // not thickened to fake angle-independence (a thin plane SHOULDN'T look
  // the same from every angle — edge-on is a band, face-on opens into
  // arms). Round 7: R_MIN/R_MAX now derive from the graph's own actual
  // scale (GALAXY_R_MIN/GALAXY_R_MAX above) instead of fixed constants,
  // same reasoning as the star field.
  function buildGalaxy(R_MIN, R_MAX) {
    const ARMS = 3;
    const PITCH = 0.3; // b in r = a·e^(bθ) — real spiral galaxies run roughly 0.2–0.4
    const ARM_SCALE = R_MIN * 0.125; // a — sets how much winding happens across the visible radial range
    const DECAY_SCALE = (R_MAX - R_MIN) * 0.3; // 1/λ — most mass within a few of these past R_MIN
    const COUNT = preview ? 1700 : 5000;
    const FIELD_FRACTION = 0.14; // particles that skip the arm lock — sparse enough that arms read as denser bands, not a uniform haze with a pattern painted on top
    const THICK_BASE = R_MIN * 0.006;
    const THICK_CORE = R_MIN * 0.024;

    function sampleD() {
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
        const scatter = (Math.random() - 0.5) * (0.05 + (d / (R_MAX - R_MIN)) * 0.22);
        theta = idealTheta + armIdx * (Math.PI * 2 / ARMS) + scatter;
      }
      const rj = r * (1 + (Math.random() - 0.5) * 0.05);
      const x = rj * Math.cos(theta);
      const z = rj * Math.sin(theta);
      const thickness = THICK_BASE + THICK_CORE * Math.exp(-d / (DECAY_SCALE * 0.5));
      const y = (Math.random() - 0.5) * thickness;

      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;

      const coreBlend = Math.exp(-d / (DECAY_SCALE * 0.18));
      const coreBoost = 1 + coreBlend * 2.2;
      const armFieldMult = isArm ? 1.5 : 0.4;
      c.copy(armColor).lerp(coreColor, coreBlend).multiplyScalar(0.62 * coreBoost * armFieldMult);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: (preview ? 1.5 : 2.0) * SCALE_FACTOR, vertexColors: true, transparent: true,
      opacity: 0.7, depthWrite: false, sizeAttenuation: true, fog: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    // A deliberate tilt so the disc's silhouette actually varies as a
    // visitor orbits (edge-on band at some angles, more face-on
    // arms-and-core at others) rather than presenting the same mix at
    // every theta.
    points.rotation.x = 0.3;
    points.rotation.z = 0.15;
    return { points, geo, mat };
  }
  const galaxy = buildGalaxy(GALAXY_R_MIN, GALAXY_R_MAX);
  scene.add(galaxy.points);

  // ─── Node + strand rendering, built from the layout computed above ──────
  const dotTex = makeDotTexture();
  const nodeGeo = new THREE.BufferGeometry();
  const nodePos = new Float32Array(nodeList.length * 3);
  const nodeColor = new Float32Array(nodeList.length * 3);
  const tmpColor = new THREE.Color();
  nodeList.forEach((n, i) => {
    nodePos[i * 3] = n.pos.x; nodePos[i * 3 + 1] = n.pos.y; nodePos[i * 3 + 2] = n.pos.z;
    tmpColor.setHex(SCENE_ACCENT[n.scene] ?? 0xffffff);
    nodeColor[i * 3] = tmpColor.r; nodeColor[i * 3 + 1] = tmpColor.g; nodeColor[i * 3 + 2] = tmpColor.b;
  });
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
  nodeGeo.setAttribute('color', new THREE.BufferAttribute(nodeColor, 3));
  const nodeMat = new THREE.PointsMaterial({
    size: (preview ? 2.2 : 2.6) * SCALE_FACTOR, map: dotTex, vertexColors: true,
    transparent: true, opacity: 0.9, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false,
  });
  const nodePoints = new THREE.Points(nodeGeo, nodeMat);
  scene.add(nodePoints);

  // Strand rods — thin InstancedMesh boxes, same house technique as
  // library.js's hexagon edges/strands.
  //
  // Round 7: cross-section widened substantially (real visual weight for
  // connections that exist, not a thin faint line) and scaled by
  // SCALE_FACTOR along with everything else now that the graph's real
  // extent pushed the camera range out.
  const SEGMENTS_PER_STRAND = 6;
  const STRAND_WIDTH = 0.16 * SCALE_FACTOR;
  const strandGeo = new THREE.BoxGeometry(1, STRAND_WIDTH, STRAND_WIDTH);
  const strandMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const strandMesh = rows.length
    ? new THREE.InstancedMesh(strandGeo, strandMat, rows.length * SEGMENTS_PER_STRAND)
    : null;
  const HIT_WIDTH = 10 * SCALE_FACTOR;
  const hitGeo = new THREE.BoxGeometry(1, HIT_WIDTH, HIT_WIDTH);
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

  // ─── Camera: full external orbit ─────────────────────────────────────────
  // Round 7: no floor, no looking-up vantage, no constrained elevation
  // range — a real force-directed graph has no inherent up or down, so a
  // star map of it gets a conventional external view instead. Same
  // bindOrbitDrag/bindWheelZoom house pattern already proven elsewhere on
  // the site (Orbiter's drag-to-rotate, Orrery's own preview-tile drag),
  // just applied here as a genuine spherical camera orbit with a normal
  // pole clamp rather than a hemisphere restriction.
  const PIVOT = new THREE.Vector3(0, 0, 0);
  let camDist = CAM_DEFAULT;
  let theta = Math.random() * Math.PI * 2;
  // Clamped a small margin short of the poles (not 0/PI exactly) so
  // azimuth never flips through a gimbal singularity — otherwise the
  // full range, not the old lower-hemisphere-only band.
  const PHI_MIN = 0.15;
  const PHI_MAX = Math.PI - 0.15;
  let phi = Math.PI / 2 - 0.25; // a modest downward tilt off dead-level — reads as looking AT the map, not up or down through it
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
  // arrive already oriented at.
  let followedStrand = null;
  if (!preview && initialPieceId !== null) {
    const info = strandInfo.find(s => s.row.id === initialPieceId);
    if (info) {
      followedStrand = info;
      const dir = info.mid.clone().sub(PIVOT);
      const r = dir.length() || 1;
      theta = Math.atan2(dir.x, dir.z);
      phi = THREE.MathUtils.clamp(Math.acos(THREE.MathUtils.clamp(dir.y / r, -1, 1)), PHI_MIN, PHI_MAX);
      camDist = THREE.MathUtils.clamp(r * 1.6, CAM_MIN, CAM_MAX);
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
  // the resonance's own reviewed rationale, and a jump straight to either
  // one.
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
      camDist = THREE.MathUtils.clamp(camDist + deltaY * 0.05 * SCALE_FACTOR, CAM_MIN, CAM_MAX);
      updateCamera();
    },
  }) : null;

  // ─── Touch a strand ───────────────────────────────────────────────────────
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

  // Keyboard equivalent — strands are otherwise raycast-only.
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

    // Strand shimmer + touch excitement decay.
    if (strandMesh) {
      strandInfo.forEach(s => {
        s.phase += dt * s.speed;
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

    // Node shimmer, cheap per-vertex-color reuse of the same technique.
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
