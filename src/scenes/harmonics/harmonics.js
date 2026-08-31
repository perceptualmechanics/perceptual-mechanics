import * as THREE from 'three';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, bindTapVsDrag,
  prefersReducedMotion, parseHTML, createJumpList, createPanelCloser, escapeHtml,
  mountClippedPreviewCanvas, bindPersistedSoundToggle,
} from '../../utils/sceneKit.js';
import { getApprovedResonances, getPendingResonances } from '../../resonances.js';
import { navigateToPiece } from '../../utils/harmonicsEntry.js';
import { extractQuotes, snippetFor } from '../../utils/resonanceExcerpts.js';
import harmonicsHtml from './harmonics.html?raw';
import './harmonics.css';

// ─── The harmonics ──────────────────────────────────────────────────────
// The ninth scene, and the only one with no found text of its own — it
// visualizes src/resonances.js's Layer 2 (cross-scene, connotative links),
// approved rows only.
//
// Round 2 (2026-08-16) reversed the original "purely atmospheric, no
// panel" design: touching a piece opens a real read-more panel naming
// what it resonates with and showing the resonance's own reviewed
// rationale, with a jump link to jump straight there.
//
// Round 5 (2026-08-18) removed the spider entirely, brightened the
// visuals, and added a real logarithmic-spiral galactic backdrop.
//
// Round 7 (2026-08-18) replaced arbitrary node placement with a real
// Fruchterman-Reingold force-directed layout (see layoutForceDirected
// below) and gave the camera a full external orbit instead of an
// "underneath a canopy" constraint.
//
// Round 8 (2026-08-18) — dropped drawn connection lines entirely. A
// harmonics shape drawn with lines only reads correctly from one
// vantage; once the camera could orbit freely (round 7), that's exactly
// why this kept looking like ball-and-stick molecules rather than a
// harmonics. Fixed by making resonance a TEMPORAL signal instead of
// a spatial one: every node is a Kuramoto oscillator (see the Kuramoto
// section below) — the same coupled-oscillator physics behind the
// Orrery's resonator chime, extended here from one struck object ringing
// to many objects influencing each other's rhythm over time. Nodes that
// share an approved resonance pull each other's phase together; run
// forward, connected clusters spontaneously lock into a shared pulse,
// visibly breathing together from ANY angle — no single "correct"
// vantage required, which is the actual fix, not a stylistic swap. The
// force-directed layout stays (connected pieces already sitting closer
// together is a good complementary signal), just without lines drawn on
// top of it. Clicking a node now shows everything IT currently
// resonates with (possibly more than one piece), since there's no
// longer a single line to click.
//
// Round 9 (2026-08-18) renamed this scene "Harmonics" everywhere
// user-facing (title, nav tooltip, colophon) — this module, its folder,
// and every internal identifier (class prefixes, `harmonics.js`
// itself, `createharmonics`) deliberately kept the old name; a full
// internal rename was flagged as optional/lower-priority and skipped as
// out of scope for this round. Same round resolved round 7's "flagged,
// not decided" ground-glimpse tension below by retiring both in-scene
// entry points entirely (ground-glimpse and thread-follow) now that a
// normal nav icon + landing preview tile cover discovery — see
// src/utils/harmonicsEntry.js's own removal and main.js/beamline.js/
// orrery.js's dispose cleanup for what that took.
//
// Round 10 (2026-08-18) — four real additions, all keyed off data already
// in the system rather than decoration: (1) a hover halo/brighten on
// nodes (previously only the cursor changed); (2) the payoff panel now
// shows real side-by-side excerpts from both pieces' own text (via
// harmonicsPieces.js's resolveEndpoint + resonanceExcerpts.js's
// snippetFor) — the reviewed rationale still picks which quoted span
// each excerpt centers on, but isn't printed in the panel itself;
// (3) sonification — every
// node's live Kuramoto phase/frequency, already computed each frame for
// the visual pulse, is now ALSO the input to a real Web Audio voice per
// node (harmonic-series pitch mapping, phase-driven gain), gated behind
// an explicit sound toggle since autoplay needs a real gesture; (4) a
// second, unlit Points cloud rendering the corpus's PENDING (not yet
// approved) resonances as faint independent drift, never Kuramoto-
// coupled — an honest picture of the system's actual review state, not
// invented atmosphere. The nebula backdrop's two named colors also
// shifted toward a real two-channel Hubble palette (H-alpha core, O-III
// arms) — see buildGalaxy below.

// ─── Per-scene accent colors ────────────────────────────────────────────────
// Each scene's own already-established signature color, used for a
// node's own dot color — pulled from each scene's own dominant
// material/light/glow color, not invented here.
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
// stable and evenly spread) so every piece's node position AND Kuramoto
// natural frequency/initial phase are the same every load/build, without
// persisting anything. Two different resonance rows that share an
// endpoint must resolve to the exact same node, which is why this is
// keyed by piece identity, not by row.
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
// resonance by construction. `endpoint` keeps the raw {scene,id[,beatId]}
// shape so resolveEndpointTitle can resolve this node's OWN title later
// (the panel now needs that — round 7 only ever needed the other side's
// title). Position is a placeholder here; the real work happens in
// layoutForceDirected below.
function buildNodes(rows) {
  const nodes = new Map();
  rows.forEach(r => {
    [r.a, r.b].forEach(ep => {
      const key = pieceKey(ep);
      if (nodes.has(key)) return;
      nodes.set(key, { key, scene: ep.scene, endpoint: ep, pos: new THREE.Vector3() });
    });
  });
  return nodes;
}

// Adjacency list (node index -> [neighbor indices]) built once from the
// approved rows — shared by both the force-directed layout's attraction
// step and the Kuramoto coupling below, since both need to walk the same
// real resonance graph, not a different derived structure each.
function buildAdjacency(nodeList, rows) {
  const idx = new Map(nodeList.map((nd, i) => [nd.key, i]));
  const adj = nodeList.map(() => []);
  const edges = [];
  rows.forEach(row => {
    const a = idx.get(pieceKey(row.a));
    const b = idx.get(pieceKey(row.b));
    if (a === undefined || b === undefined || a === b) return;
    adj[a].push(b);
    adj[b].push(a);
    edges.push([a, b]);
  });
  return { adj, edges };
}

// ─── Real force-directed layout ─────────────────────────────────────────────
// Fruchterman-Reingold — repulsion between every pair of nodes (F=k²/d),
// attraction between nodes sharing an approved resonance (F=d²/k), run to
// equilibrium under a linear cooling schedule. Extended to 3D directly.
// A mild gravity term (nodes pulled toward the centroid each step,
// proportional to their own distance from it) is the one addition beyond
// textbook FR — this graph is sparse and far from fully connected (64
// approved rows, ~61 nodes as of 3.1.0's full pending-approval, many small
// islands), and without it,
// disconnected components have no attractive force acting on them at all
// and drift apart under pure repulsion without bound (confirmed
// empirically in a throwaway test script — see NOTES.md's round-7 entry
// for the actual numbers). With it, loosely-connected clusters still land
// clearly apart from the rest — the desired "periphery" read — just not
// at unbounded distance.
//
// Deterministic: initial positions seed from hashStr01, and the
// relaxation itself has no randomness, so the same approved-rows set
// always settles into the same shape on every load/build.
function layoutForceDirected(nodeList, edges, scale) {
  const n = nodeList.length;
  if (n === 0) return;

  nodeList.forEach(nd => {
    const ax = hashStr01(nd.key + ':x') * 2 - 1;
    const ay = hashStr01(nd.key + ':y') * 2 - 1;
    const az = hashStr01(nd.key + ':z') * 2 - 1;
    nd.pos.set(ax, ay, az).multiplyScalar(scale * 0.5);
  });

  const k = scale / Math.cbrt(n); // ideal edge length — standard FR sizing for n nodes in a volume ~scale³
  const GRAVITY = 1.0; // calibrated live so disconnected islands settle at a bounded, still-clearly-separate distance
  const ITERATIONS = 400;
  const t0 = scale * 0.06;

  const disp = nodeList.map(() => new THREE.Vector3());
  const delta = new THREE.Vector3();

  for (let iter = 0; iter < ITERATIONS; iter++) {
    disp.forEach(v => v.set(0, 0, 0));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        delta.subVectors(nodeList[i].pos, nodeList[j].pos);
        let dist = delta.length();
        if (dist < 0.05) dist = 0.05;
        const force = (k * k) / dist;
        delta.multiplyScalar(force / dist);
        disp[i].add(delta);
        disp[j].sub(delta);
      }
    }

    edges.forEach(([a, b]) => {
      delta.subVectors(nodeList[a].pos, nodeList[b].pos);
      let dist = delta.length();
      if (dist < 0.05) dist = 0.05;
      const force = (dist * dist) / k;
      delta.multiplyScalar(force / dist);
      disp[a].sub(delta);
      disp[b].add(delta);
    });

    for (let i = 0; i < n; i++) {
      disp[i].addScaledVector(nodeList[i].pos, -GRAVITY);
    }

    const t = t0 * (1 - iter / ITERATIONS);
    for (let i = 0; i < n; i++) {
      const len = disp[i].length();
      if (len > 0.0001) {
        const capped = Math.min(len, Math.max(t, 0.02));
        nodeList[i].pos.addScaledVector(disp[i], capped / len);
      }
    }
  }

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

export function createharmonics(container, { preview = false, initialPieceId = null } = {}) {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;

  // ─── Graph first — everything else (camera bounds, fog density, where
  // the star field/galaxy backdrop sit) derives from the layout's own
  // actual resulting scale, computed here before any of that downstream
  // setup runs.
  const rows = getApprovedResonances();
  const nodeMap = buildNodes(rows);
  const nodeList = Array.from(nodeMap.values());
  const { adj, edges } = buildAdjacency(nodeList, rows);
  // Bumped 90/150 → 120/200 (3.1.1, 2026-08-23): approving all 42 pending
  // resonances took node count from ~32 to ~61 at the old scale — k (ideal
  // edge length) shrinks as cbrt(n) with node count held fixed, so the old
  // scale alone would already read visibly tighter even before "spread
  // them apart more" per Scott's own direct feedback live. ~33% up covers
  // both the node-count growth and gives real added breathing room.
  const GRAPH_SCALE = preview ? 120 : 200;
  layoutForceDirected(nodeList, edges, GRAPH_SCALE);
  let boundRadius = 1;
  nodeList.forEach(n => { boundRadius = Math.max(boundRadius, n.pos.length()); });

  const CAM_MIN = Math.max(20, boundRadius * 0.45);
  const CAM_MAX = boundRadius * 3.0;
  const CAM_DEFAULT = boundRadius * 1.9;
  const FOG_DENSITY = 1.55 / CAM_MAX;
  const STAR_R_MIN = CAM_MAX * 1.25;
  const STAR_R_MAX = CAM_MAX * 1.75;
  const GALAXY_R_MIN = STAR_R_MAX * 1.3;
  const GALAXY_R_MAX = GALAXY_R_MIN * 3.5;
  const CAM_FAR = Math.max(2000, GALAXY_R_MAX * 1.3);
  const SCALE_FACTOR = CAM_MAX / (preview ? 140 : 260);

  // ─── Kuramoto phase coupling ──────────────────────────────────────────────
  // Round 8: resonance as synchronization, not lines. Every node is a
  // coupled oscillator — phase θᵢ(t), natural frequency ωᵢ — with:
  //   dθᵢ/dt = ωᵢ + K · Σⱼ sin(θⱼ − θᵢ)
  // summed over j = this node's ACTUAL approved-resonance neighbors
  // (the same `adj` adjacency the layout above uses), not a mean-field
  // model where every node influences every other node — structurally
  // faithful to the real graph, same principle as the layout itself.
  // Node brightness is a function of its own current phase; visually,
  // nodes sharing enough coupled structure spontaneously lock into a
  // shared pulse (frequency AND roughly-shared phase), while nodes in a
  // different, uncoupled part of the graph settle into their OWN shared
  // rhythm at a different rate — real emergence, not a scripted cue.
  //
  // Frequencies/initial phases are seeded by hashStr01 (not live
  // randomness) for the same reason node position is: reproducible
  // behavior, not a different show every load. The frequency spread is
  // real (±0.06 Hz around a 0.2 Hz base) — non-uniform enough that any
  // observed lock is a genuine consequence of coupling overcoming a real
  // mismatch, not two nodes coincidentally starting at the same rate.
  // K was tuned by simulating the actual approved-rows graph in a
  // throwaway script before writing this (see NOTES.md's round-8 entry
  // for the numbers): at K=2π·0.15 rad/s, every multi-node cluster in
  // the current data reaches ~0.97–1.00 phase coherence within ~5
  // simulated seconds and holds it indefinitely, while separate
  // clusters — never coupled to each other at all, since Kuramoto
  // coupling only sums over real graph neighbors — settle at distinct
  // collective rates. The 22-row corpus happens to have no fully
  // isolated (zero-edge) node right now (every node exists only because
  // it's in ≥1 approved row), so the visible contrast today is
  // cluster-vs-cluster rather than synced-vs-totally-isolated; a future
  // approved row that leaves some piece with only a not-yet-approved
  // connection would introduce a genuinely drifting node without any
  // change to this code.
  const KURAMOTO_BASE_HZ = 0.2;
  const KURAMOTO_SPREAD_HZ = 0.06;
  const KURAMOTO_K = 2 * Math.PI * 0.15;
  const omega = nodeList.map(n => 2 * Math.PI * (KURAMOTO_BASE_HZ + (hashStr01(n.key + ':freq') * 2 - 1) * KURAMOTO_SPREAD_HZ));
  const theta = nodeList.map(n => hashStr01(n.key + ':phase0') * Math.PI * 2);
  const boost = nodeList.map(() => 0); // 0..~1, decays after a click — briefly emphasizes the clicked node and its synced neighbors rather than drawing new geometry
  const effHz = nodeList.map(() => KURAMOTO_BASE_HZ); // dθ/dt of the last integration step, in Hz — round 10's sonification pitch input, see below
  function triggerBoost(i) {
    boost[i] = 1;
    adj[i].forEach(j => { boost[j] = Math.max(boost[j], 0.7); });
  }

  const scene = new THREE.Scene();
  const BG_COLOR = 0x00010a;
  scene.background = new THREE.Color(BG_COLOR);
  scene.fog = new THREE.FogExp2(BG_COLOR, FOG_DENSITY);

  const camera = new THREE.PerspectiveCamera(46, w / h, 0.1, CAM_FAR);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  // Preview tiles: never append the WebGL canvas itself — see
  // mountClippedPreviewCanvas's own comment in sceneKit.js. A heavy WebGL
  // canvas gets promoted to its own GPU compositing layer in Firefox and
  // ignores the tile's clip-path/border-radius entirely, so the preview
  // renders as a square instead of the circle every other tile shows
  // (already hit and fixed this way for orrery and beamline). Full scene
  // is unaffected (no circular tile there), so it keeps the plain direct
  // append it always had.
  const clippedPreview = preview ? mountClippedPreviewCanvas(container, renderer) : null;
  if (!preview) container.appendChild(renderer.domElement);
  if (!preview) container.tabIndex = -1;

  scene.add(new THREE.AmbientLight(0x223355, 1.0));
  const key = new THREE.DirectionalLight(0xaad4ff, 0.9);
  key.position.set(4, 8, 3);
  scene.add(key);

  // ─── Deep-field stars (punched up 3.1.2, second pass 3.2.0) ────────────────
  // 3.1.2 added per-star color variation via vertex colors instead of one
  // flat tint applied to every point — weighted toward cool blue-white
  // (majority of real naked-eye stars), white, and an occasional warm gold
  // outlier, each further scaled by its own random brightness. This pass
  // (3.2.0, alongside the dust-lane layer above) is purely density/
  // brightness: count and opacity nudged up again so this layer still
  // holds up as a backdrop behind ~61 nodes, the field it was actually
  // balanced against when 3.1.2 shipped having been ~32.
  const starCount = preview ? 550 : 1600;
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  const STAR_PALETTE = [
    new THREE.Color(0xdbe6ff), // cool blue-white — majority
    new THREE.Color(0xffffff), // white
    new THREE.Color(0xfff3d6), // warm pale gold — occasional outlier
  ];
  for (let i = 0; i < starCount; i++) {
    const r = STAR_R_MIN + Math.random() * (STAR_R_MAX - STAR_R_MIN);
    const theta2 = Math.random() * Math.PI * 2;
    const phiA = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(phiA) * Math.cos(theta2);
    starPos[i * 3 + 1] = Math.abs(r * Math.sin(phiA) * Math.sin(theta2));
    starPos[i * 3 + 2] = r * Math.cos(phiA);
    const pick = Math.random();
    const c = pick < 0.62 ? STAR_PALETTE[0] : pick < 0.92 ? STAR_PALETTE[1] : STAR_PALETTE[2];
    const b = 0.75 + Math.random() * 0.5; // per-star brightness variance
    starCol[i * 3] = c.r * b;
    starCol[i * 3 + 1] = c.g * b;
    starCol[i * 3 + 2] = c.b * b;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  const starMat = new THREE.PointsMaterial({ vertexColors: true, size: 1.15 * SCALE_FACTOR, transparent: true, opacity: 0.72, sizeAttenuation: true, fog: false });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  // ─── Nebular backdrop (round 5, corrected round 6, rescaled round 7,
  // recolored round 10, restructured round 10.1) ───────────────────────────
  // Rounds 5-10 used a clean logarithmic-spiral disc — mathematically
  // tidy, but that's exactly what read wrong live: "a constrained
  // geometric band," not the chaotic pull of real gravitational
  // structure. Round 10.1 replaces the single spiral-arm equation with a
  // scatter of independent clumps (real nebulae/star-forming regions
  // don't share one clean curve) connected by sparse, wispy filaments —
  // the "cosmic web" read of matter pulled between mass concentrations
  // rather than orbiting one center. Each clump gets its OWN random
  // H-alpha/O-III bias, so some read warmer and some cooler, the way
  // real Hubble composites show different emission lines dominating
  // different regions of the same nebula, not one uniform core-to-edge
  // gradient. Volume is genuinely 3D (not flattened to a thin disc)
  // specifically so it can never again present as a flat ring/band from
  // some angle.
  function buildGalaxy(R_MIN, R_MAX) {
    const COUNT = preview ? 1700 : 5000;
    const CLUSTER_COUNT = preview ? 6 : 14;
    const FILAMENT_FRACTION = 0.3; // fraction of points strung between two clusters rather than clumped inside one
    const coreColor = new THREE.Color(0xff3d5c); // H-alpha — warm hydrogen emission
    const armColor = new THREE.Color(0x3fb8ff); // O-III — cool oxygen emission

    // Cheap approximate-Gaussian via a sum of uniforms (central limit
    // theorem) — real clumps taper toward their edges rather than
    // having the hard-edged look a uniform sphere/cube fill would give.
    function gauss() {
      return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    }

    // Real gravitational clumps, scattered through a genuine 3D volume
    // between R_MIN and R_MAX — no shared curve/equation ties them
    // together, which is precisely what makes this read as chaotic
    // structure rather than a diagram of one.
    const clusters = [];
    for (let k = 0; k < CLUSTER_COUNT; k++) {
      const r = R_MIN + Math.random() * (R_MAX - R_MIN);
      const theta2 = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      clusters.push({
        center: new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta2),
          r * Math.sin(phi) * Math.sin(theta2) * 0.75,
          r * Math.cos(phi),
        ),
        spread: (R_MAX - R_MIN) * (0.08 + Math.random() * 0.16), // each clump's own size — irregular, not uniform
        hueBias: Math.random(), // 0 = this clump leans O-III blue, 1 = leans H-alpha red
      });
    }

    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const c = new THREE.Color();

    for (let i = 0; i < COUNT; i++) {
      let x, y, z, blend;
      if (clusters.length >= 2 && Math.random() < FILAMENT_FRACTION) {
        // A wisp strung between two DIFFERENT clumps, with real jitter
        // off the straight line between them — mutual pull, not orbit.
        const a = clusters[(Math.random() * clusters.length) | 0];
        let b = clusters[(Math.random() * clusters.length) | 0];
        for (let tries = 0; b === a && tries < 5; tries++) b = clusters[(Math.random() * clusters.length) | 0];
        const t = Math.random();
        const jitter = (R_MAX - R_MIN) * 0.035;
        x = THREE.MathUtils.lerp(a.center.x, b.center.x, t) + gauss() * jitter;
        y = THREE.MathUtils.lerp(a.center.y, b.center.y, t) + gauss() * jitter;
        z = THREE.MathUtils.lerp(a.center.z, b.center.z, t) + gauss() * jitter;
        blend = THREE.MathUtils.lerp(a.hueBias, b.hueBias, t);
      } else {
        const cl = clusters[(Math.random() * clusters.length) | 0];
        x = cl.center.x + gauss() * cl.spread;
        y = cl.center.y + gauss() * cl.spread;
        z = cl.center.z + gauss() * cl.spread;
        blend = THREE.MathUtils.clamp(cl.hueBias + gauss() * 0.15, 0, 1);
      }

      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;

      c.copy(armColor).lerp(coreColor, blend).multiplyScalar(0.6 + Math.random() * 0.35);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      // Opacity trimmed from 0.7 — with the halo added to the real
      // resonance nodes above, the backdrop reads better a little
      // further back, so foreground/background stay clearly distinct.
      size: (preview ? 1.5 : 2.0) * SCALE_FACTOR, vertexColors: true, transparent: true,
      opacity: 0.55, depthWrite: false, sizeAttenuation: true, fog: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.rotation.x = 0.3;
    points.rotation.z = 0.15;
    // A snapshot of the tuned base colors, kept separate from `col` (the
    // live buffer) — round 10.1's twinkle below writes brightened values
    // into `col` and needs the original to fade back to.
    const baseColor = col.slice();
    return { points, geo, mat, count: COUNT, baseColor };
  }
  const galaxy = buildGalaxy(GALAXY_R_MIN, GALAXY_R_MAX);
  galaxy.points.renderOrder = 0;
  scene.add(galaxy.points);

  // ─── Dust-lane occlusion layer (3.2.0, 2026-08-23) ─────────────────────────
  // The glow clusters above are pure emission — every point in that layer
  // is the same kind of soft additive light, which tops out at "pretty
  // haze": nothing in it can read as solid or foregrounded, because
  // nothing in it is doing anything but adding brightness. Real deep-field
  // images (Orion, the Pillars, Carina) get most of their sense of depth
  // from dust LANES blocking light behind them, not from the gas that
  // glows — extinction, not emission. Flagged after 3.1.0/3.1.1 nearly
  // doubled node count and gave the field more room: the backdrop hadn't
  // grown to match, and a denser node field made the flat, uniformly-lit
  // haze read as even flatter by comparison.
  //
  // Same sprite/Points approach as buildGalaxy, just inverted intent: dark,
  // low-alpha, ordinary (not additive) blending, so each point DIMS
  // whatever it overlaps rather than adding to it. Every point is
  // filament-only (unlike the glow layer's mix of clumps + filaments) —
  // dust wants to read as LANES, not blobs. `renderOrder` after the glow
  // layer's own 0 makes this consistently sit "in front" for blending
  // purposes; its own independent rotation (different axis/speed than the
  // glow layer's) is what actually sells depth as the camera orbits — two
  // layers turning at different rates is real parallax, not a static
  // camera-angle accident that only reads from one vantage point.
  function buildDustLanes(R_MIN, R_MAX) {
    const COUNT = preview ? 700 : 2200;
    const LANE_COUNT = preview ? 6 : 14;
    const dustColor = new THREE.Color(0x140b1e); // near-black, faint cool-violet cast — never pure 0x000 (would just vanish against the bg)

    function gauss() {
      return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    }

    // Anchor points a lane threads between. Reused pairwise (like the glow
    // layer's filament fraction) but ALL of it, not a fraction — this
    // layer has no round-clump mode at all.
    const anchors = [];
    for (let k = 0; k < LANE_COUNT; k++) {
      const r = R_MIN + Math.random() * (R_MAX - R_MIN);
      const theta2 = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      anchors.push(new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta2),
        r * Math.sin(phi) * Math.sin(theta2) * 0.75,
        r * Math.cos(phi),
      ));
    }

    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const c = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      const a = anchors[(Math.random() * anchors.length) | 0];
      let b = anchors[(Math.random() * anchors.length) | 0];
      for (let tries = 0; b === a && tries < 5; tries++) b = anchors[(Math.random() * anchors.length) | 0];
      const t = Math.random();
      const jitter = (R_MAX - R_MIN) * 0.05;
      pos[i * 3] = THREE.MathUtils.lerp(a.x, b.x, t) + gauss() * jitter;
      pos[i * 3 + 1] = THREE.MathUtils.lerp(a.y, b.y, t) + gauss() * jitter;
      pos[i * 3 + 2] = THREE.MathUtils.lerp(a.z, b.z, t) + gauss() * jitter;
      c.copy(dustColor).multiplyScalar(0.7 + Math.random() * 0.6);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    // The glow layer above has no `map` either — bare PointsMaterial
    // renders hard-edged squares, which thousands of dense, additively-
    // blended points smooth into a haze without anyone noticing. This
    // layer is sparser AND non-additive, so a hard square edge would
    // actually show — needs its own soft radial-gradient sprite (same
    // technique as makeDotTexture(), used for node dots) so each point
    // reads as a soft smudge fading at the edges, not a tiny dark tile.
    const dustTex = makeDotTexture();
    const mat = new THREE.PointsMaterial({
      // MUCH bigger than the glow points, and not a small bump — live-
      // tuned after an initial guess (5.6×SCALE_FACTOR, matching roughly
      // 2.8× a glow point) turned out completely invisible in a frozen
      // dust-on/dust-off A/B at default camera distance: the glow layer's
      // apparent size comes almost entirely from 5000 densely-overlapping
      // ADDITIVE points compounding, not from any single point being
      // large, so a sparse non-additive layer needs real per-point size to
      // read as anything at all. ~28× SCALE_FACTOR is what actually shows
      // up as soft dark smudges rather than nothing. No `blending`
      // override: PointsMaterial defaults to THREE.NormalBlending, which
      // is the entire point here — AdditiveBlending (the glow layer's
      // choice) can only ever brighten, never darken, so it was never an
      // option for this layer.
      size: (preview ? 21 : 28) * SCALE_FACTOR, map: dustTex, vertexColors: true,
      transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true, fog: false,
    });
    const points = new THREE.Points(geo, mat);
    points.renderOrder = 1;
    points.rotation.x = -0.22;
    points.rotation.z = 0.4; // deliberately different tilt than galaxy.points' own — independent rotation axes read as real parallax, not two layers moving in lockstep
    return { points, geo, mat, tex: dustTex, count: COUNT };
  }
  const dustLanes = buildDustLanes(GALAXY_R_MIN, GALAXY_R_MAX);
  scene.add(dustLanes.points);

  // ─── Galaxy twinkle (round 10.1) ─────────────────────────────────────────
  // The backdrop was flagged as reading like a frozen diagram — a static
  // ring of dots — rather than something alive. Two cheap, real fixes,
  // neither touching the tuned spiral structure/palette: a slow constant
  // rotation (so it visibly turns rather than sitting frozen), and a
  // genuinely stochastic twinkle — a handful of random points per frame
  // get a brief, randomly-sized brightness kick that decays back to their
  // tuned base color. Only the currently-decaying points are touched each
  // frame (tracked in `galaxyActive`), not the full 5000-point buffer, so
  // this stays cheap regardless of corpus size.
  const galaxyColAttr = galaxy.geo.attributes.color;
  const galaxyActive = new Map(); // index -> current boost, decaying toward 0
  const GALAXY_TWINKLE_KICKS = preview ? 2 : 10; // candidates offered per frame — not all land, see below
  const GALAXY_TWINKLE_DECAY = 2.0; // roughly half a second to fade back to base

  // ─── Nodes — the sole on-screen carrier of resonance now that lines are
  // gone. Color is each node's own scene accent; brightness is driven
  // every frame by its live Kuramoto phase (see the animate loop below),
  // not a decorative shimmer. ────────────────────────────────────────────
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
    size: (preview ? 3.1 : 3.6) * SCALE_FACTOR, map: dotTex, vertexColors: true,
    transparent: true, opacity: 0.95, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false,
  });
  const nodePoints = new THREE.Points(nodeGeo, nodeMat);

  // Round 10.1: a soft corona layer, sharing the SAME position/color
  // buffers as the main dot above (a second Points object reading the
  // same nodeGeo — no extra per-frame work, it just rides along on
  // whatever the Kuramoto brightness loop already writes into that
  // color attribute) — bigger, dimmer, additive. This is what separates
  // a node from the now much livelier nebula backdrop: nodes read as
  // small glowing bodies with real presence, not just another colored
  // point in the field.
  const nodeHaloMat = new THREE.PointsMaterial({
    size: (preview ? 8 : 10) * SCALE_FACTOR, map: dotTex, vertexColors: true,
    transparent: true, opacity: 0.32, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false,
  });
  const nodeHalo = new THREE.Points(nodeGeo, nodeHaloMat);
  scene.add(nodeHalo);
  scene.add(nodePoints);

  // ─── Hover halo (round 10) ─────────────────────────────────────────────
  // A single reusable sprite, repositioned onto whichever node is
  // currently hovered and eased in/out — gives a real "grows and
  // brightens" response beyond the cursor-style change that was the only
  // hover feedback through round 9. Per-node point SIZE isn't
  // individually controllable on a shared PointsMaterial without a custom
  // shader, so the "scale" half of the brief is this halo; the
  // "brighten" half rides on the existing per-node color buffer in
  // animate() below.
  const hoverSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dotTex, color: 0xffffff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  hoverSprite.visible = false;
  if (!preview) scene.add(hoverSprite);
  let hoverScale = 0;

  // ─── Living atmosphere: pending (unreviewed) resonances (round 10) ──────
  // An honest picture of the corpus's actual review state, not invented
  // decoration: the 42 rows still sitting at status:'pending' name real
  // pieces that MIGHT resonate but haven't been confirmed — rendered as
  // faint, unlit, independently drifting points that pass through the
  // volume rather than settling into the layout or joining the Kuramoto
  // graph (adj/theta/omega above never see these; coupling them in would
  // visually claim a synchronization that hasn't been reviewed/approved).
  // Pieces already shown as a confirmed node are skipped here — that
  // piece already has a solid dot, a second faint one at a different
  // position would just read as a rendering glitch.
  let pendingList = [];
  let pendingPoints = null, pendingGeo = null, pendingMat = null;
  let pendingVel = [];
  const DRIFT_R = boundRadius * 1.35;
  if (!preview) {
    const pendingRows = getPendingResonances();
    const pendingMap = new Map();
    pendingRows.forEach(r => {
      [r.a, r.b].forEach(ep => {
        const key = pieceKey(ep);
        if (nodeMap.has(key) || pendingMap.has(key)) return;
        pendingMap.set(key, { key, scene: ep.scene, endpoint: ep });
      });
    });
    pendingList = Array.from(pendingMap.values());
    if (pendingList.length) {
      const pPos = new Float32Array(pendingList.length * 3);
      const pCol = new Float32Array(pendingList.length * 3);
      const pc = new THREE.Color();
      pendingList.forEach((p, i) => {
        const v = new THREE.Vector3(
          hashStr01(p.key + ':dx') * 2 - 1,
          hashStr01(p.key + ':dy') * 2 - 1,
          hashStr01(p.key + ':dz') * 2 - 1,
        ).multiplyScalar(DRIFT_R * (0.2 + hashStr01(p.key + ':r') * 0.8));
        pPos[i * 3] = v.x; pPos[i * 3 + 1] = v.y; pPos[i * 3 + 2] = v.z;
        // Desaturated toward gray and dimmed — "unlit," clearly secondary
        // to the confirmed nodes' own saturated, brightness-pulsing color.
        pc.setHex(SCENE_ACCENT[p.scene] ?? 0xffffff).lerp(new THREE.Color(0x888899), 0.55).multiplyScalar(0.4);
        pCol[i * 3] = pc.r; pCol[i * 3 + 1] = pc.g; pCol[i * 3 + 2] = pc.b;
        const speed = DRIFT_R * (0.006 + hashStr01(p.key + ':speed') * 0.01);
        const dir = new THREE.Vector3(
          hashStr01(p.key + ':vx') * 2 - 1,
          hashStr01(p.key + ':vy') * 2 - 1,
          hashStr01(p.key + ':vz') * 2 - 1,
        ).normalize();
        pendingVel.push(dir.multiplyScalar(speed));
      });
      pendingGeo = new THREE.BufferGeometry();
      pendingGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
      pendingGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
      pendingMat = new THREE.PointsMaterial({
        size: 2.0 * SCALE_FACTOR, map: dotTex, vertexColors: true,
        transparent: true, opacity: 0.4, depthWrite: false,
        sizeAttenuation: true, fog: false,
      });
      pendingPoints = new THREE.Points(pendingGeo, pendingMat);
      scene.add(pendingPoints);
    }
  }

  // ─── Camera: full external orbit ─────────────────────────────────────────
  const PIVOT = new THREE.Vector3(0, 0, 0);
  let camDist = CAM_DEFAULT;
  let theta0 = Math.random() * Math.PI * 2;
  const PHI_MIN = 0.15;
  const PHI_MAX = Math.PI - 0.15;
  let phi = Math.PI / 2 - 0.25;
  function updateCamera() {
    const sinPhi = Math.sin(phi);
    camera.position.set(
      PIVOT.x + camDist * sinPhi * Math.sin(theta0),
      PIVOT.y + camDist * Math.cos(phi),
      PIVOT.z + camDist * sinPhi * Math.cos(theta0),
    );
    camera.lookAt(PIVOT);
  }
  updateCamera();

  // ─── Cross-scene piece resolution (full only, dynamic import) ────────────
  // harmonicsPieces.js's resolveEndpoint() statically imports every OTHER
  // scene's full .text.js content (~280kB combined, confirmed via
  // v3.10.0's build output: that's exactly why sphere.text/scroll.text/
  // library.text/theater.text each got split into their own shared chunk
  // — they're reachable from both their own scene's chunk and this one).
  // That's real, correct weight for the one scene whose whole premise is
  // synthesizing across every other scene — but only once a visitor
  // actually opens a piece's panel, not just to draw the landing-tile
  // graph shape. buildNodes()/buildAdjacency()/layoutForceDirected()
  // above never call resolveEndpoint — they only need resonances.js's own
  // {scene,id} pairs, which carry no cross-scene text at all — so the
  // preview's graph positions are already exactly right without this.
  // Dynamic import() here (not a static one at the top of the file, which
  // is what this scene had through v3.10.0) means harmonicsPieces.js
  // never loads for preview mode at all, and only loads in full mode once
  // openNodePanel/openPendingPanel actually need it, not merely because
  // the scene mounted. Started here (full-mode setup) rather than
  // deferred all the way to the click itself, so the common case — open
  // the scene, then click a node a moment later — usually has it already
  // resolved by the time a click needs it.
  let resolveEndpointPromise = null;
  function loadResolveEndpoint() {
    return (resolveEndpointPromise ??= import('./harmonicsPieces.js')).then(m => m.resolveEndpoint);
  }

  // ─── Title/hint chrome + resonance panel (full only) ─────────────────────
  let titleEl = null, hintEl = null, panel = null, panelCloser = null;
  let panelTitleEl = null, panelSubtitleEl = null, panelResonancesEl = null;
  let soundToggleEl = null, soundToggleLabelEl = null;
  if (!preview) {
    // Fire-and-forget: warms resolveEndpointPromise's cache now so the
    // common case (click a node a moment after the scene opens) usually
    // finds it already resolved. Discard the return value here rather
    // than assigning it to resolveEndpointPromise directly — that promise
    // already resolves to the extracted resolveEndpoint FUNCTION (via the
    // `.then(m => m.resolveEndpoint)` inside loadResolveEndpoint()), not
    // to the raw module namespace loadResolveEndpoint()'s own caching
    // expects to store — assigning it here would make every later call
    // try to read `.resolveEndpoint` off the function itself instead of
    // off the module.
    loadResolveEndpoint();
    const frag = parseHTML(harmonicsHtml);
    titleEl = frag.querySelector('.harmonics-title-row');
    hintEl = frag.querySelector('.harmonics-hint');
    document.body.appendChild(titleEl);
    document.body.appendChild(hintEl);

    soundToggleEl = frag.querySelector('.harmonics-sound-toggle');
    soundToggleLabelEl = soundToggleEl.querySelector('.harmonics-sound-toggle-label');
    document.body.appendChild(soundToggleEl);

    panel = frag.querySelector('.harmonics-panel');
    container.appendChild(panel);
    panelTitleEl = panel.querySelector('.harmonics-panel-title');
    panelSubtitleEl = panel.querySelector('.harmonics-panel-subtitle');
    panelResonancesEl = panel.querySelector('.harmonics-panel-resonances');
    panelCloser = createPanelCloser(panel, container, {
      closeBtn: panel.querySelector('.harmonics-panel-close'),
    });
  }

  // Every approved row this node participates in, paired with the OTHER
  // endpoint — a node can carry more than one (sphere:14, the corpus's
  // one real hub, currently carries five).
  function nodeResonances(nodeIndex) {
    const node = nodeList[nodeIndex];
    return rows
      .filter(row => pieceKey(row.a) === node.key || pieceKey(row.b) === node.key)
      .map(row => ({ row, other: pieceKey(row.a) === node.key ? row.b : row.a }));
  }

  // Round 8's real click payoff, reworked round 10: since there's no
  // single line to touch anymore, clicking a node shows everything IT
  // currently resonates with — one entry per approved row. Through round
  // 9 that entry was just the reviewed rationale; round 10 makes the
  // ECHO itself visible — real side-by-side excerpts from both pieces'
  // own text (same windowing logic build-resonances-doc.mjs uses, via
  // resonanceExcerpts.js, so the live scene never shows a different
  // window than the reviewed doc did) — the rationale text itself isn't
  // printed (round 10.1 removed the caption paragraph that used to carry
  // it), but still drives which quoted span each excerpt centers on.
  // `self`'s excerpt is recomputed per-connection (not cached) because
  // different rationales can quote different spans of the SAME piece.
  async function openNodePanel(nodeIndex) {
    if (!panel) return;
    const node = nodeList[nodeIndex];
    const resolveEndpoint = await loadResolveEndpoint();
    const self = resolveEndpoint(node.endpoint);
    const selfHex = `#${(SCENE_ACCENT[node.scene] ?? 0xffffff).toString(16).padStart(6, '0')}`;
    const conns = nodeResonances(nodeIndex);
    panelTitleEl.textContent = self.title;
    panelSubtitleEl.textContent = conns.length === 1 ? 'Resonates with 1 piece' : `Resonates with ${conns.length} pieces`;
    panelResonancesEl.innerHTML = '';
    conns.forEach(({ row, other }) => {
      const resolved = resolveEndpoint(other);
      const otherHex = `#${(SCENE_ACCENT[other.scene] ?? 0xffffff).toString(16).padStart(6, '0')}`;
      const quotes = extractQuotes(row.rationale);
      const selfSnippet = snippetFor(self.rawText, quotes);
      const otherSnippet = snippetFor(resolved.rawText, quotes);

      const entry = document.createElement('div');
      entry.className = 'harmonics-resonance-entry';

      const pair = document.createElement('div');
      pair.className = 'harmonics-excerpt-pair';
      const selfQ = document.createElement('blockquote');
      selfQ.className = 'harmonics-excerpt';
      selfQ.style.borderLeftColor = selfHex;
      selfQ.innerHTML = `<span class="harmonics-excerpt-label">${escapeHtml(self.title)}</span>${escapeHtml(selfSnippet)}`;
      const otherQ = document.createElement('blockquote');
      otherQ.className = 'harmonics-excerpt';
      otherQ.style.borderLeftColor = otherHex;
      otherQ.innerHTML = `<span class="harmonics-excerpt-label">${escapeHtml(resolved.title)}</span>${escapeHtml(otherSnippet)}`;
      pair.appendChild(selfQ);
      pair.appendChild(otherQ);
      entry.appendChild(pair);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'harmonics-endpoint-link';
      btn.textContent = 'Open this piece →';
      btn.setAttribute('aria-label', `Open ${resolved.title}`);
      btn.addEventListener('click', e => {
        e.stopPropagation();
        navigateToPiece(other.scene, resolved.pieceId);
      });
      entry.appendChild(btn);

      panelResonancesEl.appendChild(entry);
    });
    panel.classList.add('open');
  }

  // Round 10's living atmosphere: touching a pending point gets, at most,
  // a small honest acknowledgment — not the full payoff treatment, since
  // this connection hasn't been reviewed/approved yet.
  async function openPendingPanel(pendingIndex) {
    if (!panel) return;
    const p = pendingList[pendingIndex];
    const resolveEndpoint = await loadResolveEndpoint();
    const info = resolveEndpoint(p.endpoint);
    panelTitleEl.textContent = info.title;
    panelSubtitleEl.textContent = 'Pending review';
    panelResonancesEl.innerHTML = '';
    panel.classList.add('open');
  }

  // Thread-follow deep link: `initialPieceId` (main.js's generic piece-id
  // hash slot, reused here as a resonance row's own `id`) names the
  // resonance this scene should arrive already oriented at. Orients the
  // camera at the midpoint between its two nodes (no strand to target
  // anymore, just the two positions) and opens the panel for one side of
  // it — main.js has no notion of which endpoint the visitor was
  // reading, so this deterministically picks row.a's node.
  let followedNodeIndex = -1;
  if (!preview && initialPieceId !== null) {
    const row = rows.find(r => r.id === initialPieceId);
    if (row) {
      const aKey = pieceKey(row.a), bKey = pieceKey(row.b);
      const aPos = nodeMap.get(aKey).pos, bPos = nodeMap.get(bKey).pos;
      const mid = aPos.clone().add(bPos).multiplyScalar(0.5);
      const dir = mid.clone().sub(PIVOT);
      const r = dir.length() || 1;
      theta0 = Math.atan2(dir.x, dir.z);
      phi = THREE.MathUtils.clamp(Math.acos(THREE.MathUtils.clamp(dir.y / r, -1, 1)), PHI_MIN, PHI_MAX);
      camDist = THREE.MathUtils.clamp(r * 1.6, CAM_MIN, CAM_MAX);
      updateCamera();
      followedNodeIndex = nodeList.findIndex(n => n.key === aKey);
    }
  }

  // ─── Drag to orbit + wheel zoom ──────────────────────────────────────────
  let autoRotate = true;
  const touchGuard = !preview ? bindTapVsDrag(container) : null;
  const orbitDrag = !preview ? bindOrbitDrag(container, {
    onDragStart: () => { autoRotate = false; },
    onDrag: (dx, dy) => {
      theta0 -= dx;
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

  // ─── Touch a node ─────────────────────────────────────────────────────────
  // `pickNodeAt` raycasts against the node Points object directly — a
  // generous world-unit threshold (Raycaster.params.Points.threshold)
  // stands in for the old dedicated hit-mesh now that there's nothing
  // else to click.
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 8 * SCALE_FACTOR;
  const pointerNdc = new THREE.Vector2();
  let hoveredIdx = -1;
  let onMove = null, onClick = null;
  function pickNodeAt(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    raycaster.params.Points.threshold = 8 * SCALE_FACTOR;
    const hits = raycaster.intersectObject(nodePoints);
    return hits.length ? hits[0].index : -1;
  }
  // Pending-atmosphere points get their own, slightly smaller pick radius
  // — they're meant to be secondary, not equally easy to hit as a real
  // confirmed node. Reuses the same Raycaster/pointerNdc since picks
  // never happen mid-frame against both objects at once.
  function pickPendingAt(clientX, clientY) {
    if (!pendingPoints) return -1;
    const rect = container.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    raycaster.params.Points.threshold = 6 * SCALE_FACTOR;
    const hits = raycaster.intersectObject(pendingPoints);
    return hits.length ? hits[0].index : -1;
  }
  if (!preview && nodeList.length) {
    onMove = e => {
      const newHover = pickNodeAt(e.clientX, e.clientY);
      if (newHover !== hoveredIdx) {
        hoveredIdx = newHover;
        container.style.cursor = hoveredIdx !== -1 ? 'pointer' : 'default';
      }
    };
    container.addEventListener('mousemove', onMove);
    onClick = e => {
      if (touchGuard?.consume()) return;
      const idx = pickNodeAt(e.clientX, e.clientY);
      if (idx !== -1) {
        hoveredIdx = idx;
        triggerBoost(idx);
        openNodePanel(idx);
        return;
      }
      const pIdx = pickPendingAt(e.clientX, e.clientY);
      if (pIdx !== -1) openPendingPanel(pIdx);
    };
    container.addEventListener('click', onClick);
  }

  // Keyboard equivalent — nodes are otherwise raycast-only. Labels stay
  // generic ("Piece N") — the panel itself is what discloses identity
  // once open.
  let jumpList = null;
  if (!preview && nodeList.length) {
    jumpList = createJumpList(container, {
      label: 'Touch a node',
      items: nodeList,
      getLabel: (_node, i) => `Piece ${i + 1}`,
      onSelect: (_node, i) => { triggerBoost(i); openNodePanel(i); },
    });
  }

  if (followedNodeIndex !== -1) {
    triggerBoost(followedNodeIndex);
    openNodePanel(followedNodeIndex);
  }

  // ─── Sonification (round 10) ─────────────────────────────────────────────
  // Maps the Kuramoto model's own already-running data to sound, rather
  // than building a second parallel system: pitch comes from each node's
  // live EFFECTIVE frequency (dθ/dt — omega plus its current coupling
  // term, i.e. what its phase is actually doing right now, not its
  // static natural rate), and volume comes from the exact same
  // pulse=0.5+0.5·sin(θ) formula already driving its visual brightness,
  // further attenuated by the node's own real distance from the camera
  // (see the distFactor in the animate() loop below) — nodes farther
  // from wherever the visitor is currently looking read as quieter.
  // Pitch snaps to the nearest step of a real harmonic series
  // (FUNDAMENTAL_HZ × integer) rather than an arbitrary scale — nodes
  // whose effective frequency has actually converged (Kuramoto lock) land
  // on the exact same harmonic, i.e. true unison, while nodes in a
  // different, un-locked part of the graph land on a different harmonic
  // of the SAME fundamental — still acoustically related (real overtone
  // physics), but audibly less resolved than unison. This is why pitch
  // uses the LIVE effective frequency and not the static omega array:
  // omega values differ by construction (that's the whole point of the
  // frequency spread), but dθ/dt genuinely converges under coupling, so
  // only the live value reflects a real lock.
  //
  // Gated entirely behind an explicit user gesture (the sound toggle
  // below) — browsers block autoplay, and dozens of oscillators
  // constantly running would be an odd thing to start on load anyway.
  // The audio graph itself (AudioContext, one Oscillator+Gain per node,
  // into a shared master Gain) is built lazily on first enable, following
  // orrery.js's own getAudioCtx() convention. Per-voice gain is
  // pre-scaled by 1/sqrt(n) — the simpler of the two gain-management
  // options the brief allowed — so adding more nodes to the corpus over
  // time doesn't make the chord louder overall, just denser.
  const FUNDAMENTAL_HZ = 55; // A1 — low enough that the 3rd–9th harmonics used below land in a comfortable mid-range
  const HARMONIC_MIN = 3, HARMONIC_MAX = 9;
  const EFF_HZ_MIN = KURAMOTO_BASE_HZ - KURAMOTO_SPREAD_HZ * 1.5;
  const EFF_HZ_MAX = KURAMOTO_BASE_HZ + KURAMOTO_SPREAD_HZ * 1.5;
  const VOICE_SCALE = nodeList.length ? 1 / Math.sqrt(nodeList.length) : 0;
  // Live-tuned by ear across several passes: the original 0.5 master
  // gain read far louder/harsher than the per-voice math suggested (~32
  // continuous sine voices summing additively); 0.05 was too quiet;
  // 0.375 and then 0.3 were closer but still asked to come down again.
  // The per-voice gain curve just below was narrowed alongside it each
  // time too — texture, not just level — and its gain glide (the last
  // argument to setTargetAtTime) was slowed slightly for a softer
  // attack on every harmonic change.
  const MASTER_TARGET_GAIN = 0.16;
  let audioCtx = null, masterGain = null, compressor = null, reverb = null, reverbGain = null, voices = null; // voices: [{osc, osc2, gain}] parallel to nodeList
  let soundEnabled = false;

  function pitchForEffHz(hz) {
    const t = THREE.MathUtils.clamp((hz - EFF_HZ_MIN) / (EFF_HZ_MAX - EFF_HZ_MIN), 0, 1);
    const harmonic = Math.round(THREE.MathUtils.lerp(HARMONIC_MIN, HARMONIC_MAX, t));
    return FUNDAMENTAL_HZ * harmonic;
  }

  // A short burst of white noise shaped by an exponential decay — a
  // standard way to synthesize a convolution-reverb impulse response
  // without loading an audio asset. This is what turns the voices from
  // "oscillators in a browser tab" into something with real room/space
  // around it — asked for explicitly as a "spa/singing bells" ambience,
  // and a sine tone with nowhere to decay into doesn't read that way no
  // matter how quiet it is.
  function makeReverbImpulse(ctx, duration = 3.2, decay = 2.6) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  function buildAudioGraph() {
    if (audioCtx || !nodeList.length) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0;
    // A soft limiter on the summed signal — insurance against the moment
    // several voices happen to peak together, on top of (not instead of)
    // the lower MASTER_TARGET_GAIN/per-voice gain above.
    compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -28;
    compressor.knee.value = 18;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.02;
    compressor.release.value = 0.3;
    // Dry path straight to the limiter/destination...
    masterGain.connect(compressor);
    // ...and a parallel wet path through the synthesized reverb, mixed
    // back in at a fixed level. Both sum into the same compressor.
    reverb = audioCtx.createConvolver();
    reverb.buffer = makeReverbImpulse(audioCtx);
    reverbGain = audioCtx.createGain();
    reverbGain.gain.value = 0.4;
    masterGain.connect(reverb);
    reverb.connect(reverbGain);
    reverbGain.connect(compressor);
    compressor.connect(audioCtx.destination);
    voices = nodeList.map((n, i) => {
      const baseFreq = pitchForEffHz(omega[i] / (2 * Math.PI));
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = baseFreq;
      // A second voice, detuned a handful of cents sharp (random per
      // node, so the shimmer isn't identical across every voice) and
      // summed into the SAME gain — two sines a few cents apart beat
      // slowly against each other, which is most of what makes a
      // singing bowl sound like a singing bowl rather than a plain tone.
      const osc2 = audioCtx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = baseFreq;
      osc2.detune.value = 5 + Math.random() * 7;
      const gain = audioCtx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(masterGain);
      osc.start();
      osc2.start();
      return { osc, osc2, gain };
    });
  }

  function setSoundEnabled(on) {
    soundEnabled = on;
    if (on) buildAudioGraph();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (masterGain) {
      const now = audioCtx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.linearRampToValueAtTime(on ? MASTER_TARGET_GAIN : 0, now + 0.25);
    }
    if (soundToggleEl) {
      soundToggleEl.setAttribute('aria-pressed', String(on));
      if (soundToggleLabelEl) soundToggleLabelEl.textContent = on ? 'Sound on' : 'Sound off';
    }
  }

  // Persisted, site-wide (shared with Outside) via one localStorage key —
  // see bindPersistedSoundToggle's own comment in sceneKit.js for why this
  // needs a deferred first-gesture activation rather than just re-reading
  // the stored value at mount (browser autoplay policy) and how it avoids
  // fighting an explicit click on the toggle itself.
  bindPersistedSoundToggle(container, soundToggleEl, setSoundEnabled, 'harmonics');

  const reduceMotion = prefersReducedMotion();

  // ─── Animate ──────────────────────────────────────────────────────────────
  let animId, lastT = performance.now();
  function animate(now) {
    animId = requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    if (!reduceMotion) {
      if (autoRotate && !(orbitDrag && orbitDrag.isDragging)) {
        theta0 += preview ? 0.0018 : 0.0006;
        updateCamera();
      }
      // Galaxy: a slow constant turn — cheap (no attribute writes, just
      // the Points object's own rotation) but it's what actually reads
      // as "alive" rather than a frozen diagram, at any zoom/angle.
      galaxy.points.rotation.y += dt * 0.012;
      // Dust lanes turn at a genuinely different rate than the glow layer
      // (not just a different starting tilt) — that's what makes the
      // depth read as the camera orbits over time, not just from a lucky
      // single angle. Slightly slower and reversed, so the two layers
      // visibly drift apart rather than appearing to co-rotate.
      dustLanes.points.rotation.y -= dt * 0.008;

      // Stochastic twinkle: offer a few random candidates each frame,
      // let roughly half actually land (keeps it sparse/irregular rather
      // than a metronomic per-frame sparkle), then decay every currently
      // -active point back toward its tuned base color.
      for (let k = 0; k < GALAXY_TWINKLE_KICKS; k++) {
        if (Math.random() < 0.5) continue;
        const idx = (Math.random() * galaxy.count) | 0;
        galaxyActive.set(idx, 0.5 + Math.random() * 1.6);
      }
      if (galaxyActive.size) {
        galaxyActive.forEach((boost, idx) => {
          const decayed = boost - dt * GALAXY_TWINKLE_DECAY;
          const bi = idx * 3;
          if (decayed <= 0.02) {
            galaxyColAttr.setXYZ(idx, galaxy.baseColor[bi], galaxy.baseColor[bi + 1], galaxy.baseColor[bi + 2]);
            galaxyActive.delete(idx);
          } else {
            galaxyActive.set(idx, decayed);
            const mult = 1 + decayed;
            galaxyColAttr.setXYZ(idx, galaxy.baseColor[bi] * mult, galaxy.baseColor[bi + 1] * mult, galaxy.baseColor[bi + 2] * mult);
          }
        });
        galaxyColAttr.needsUpdate = true;
      }
    }

    // Kuramoto integration — explicit Euler, stable at this K/dt scale
    // (K·dt stays well under 1 even at the 0.05s frame cap). Coupling
    // sums only over each node's real adjacency, not every other node.
    // `effHz` captures dθ/dt itself (before it's folded into theta) —
    // sonification's pitch input, see the audio section above.
    const newTheta = theta.slice();
    for (let i = 0; i < nodeList.length; i++) {
      let coupling = 0;
      adj[i].forEach(j => { coupling += Math.sin(theta[j] - theta[i]); });
      const dtheta = omega[i] + KURAMOTO_K * coupling;
      effHz[i] = Math.abs(dtheta) / (2 * Math.PI);
      newTheta[i] = theta[i] + dt * dtheta;
    }
    for (let i = 0; i < nodeList.length; i++) theta[i] = newTheta[i];

    // Hover halo: eases toward/away from the hovered node's own position
    // and accent color; visible: false when fully faded avoids drawing an
    // invisible sprite every frame for nothing. Under reduced motion, the
    // brighten-on-hover feedback (round 10's actual accessibility-relevant
    // request) stays — only the growing/fading EASE is skipped, jumping
    // straight to its target instead, matching main.css's own
    // `.nav-icon:hover { transform: none }` convention of disabling the
    // animated transition, not the state change itself.
    const targetHoverScale = hoveredIdx !== -1 ? 1 : 0;
    hoverScale = reduceMotion ? targetHoverScale : hoverScale + (targetHoverScale - hoverScale) * Math.min(1, dt * 10);
    if (hoveredIdx !== -1 && hoverScale > 0.01) {
      const hn = nodeList[hoveredIdx];
      hoverSprite.visible = true;
      hoverSprite.position.set(hn.pos.x, hn.pos.y, hn.pos.z);
      hoverSprite.material.color.setHex(SCENE_ACCENT[hn.scene] ?? 0xffffff);
      hoverSprite.material.opacity = 0.55 * hoverScale;
      hoverSprite.scale.setScalar((preview ? 2.8 : 3.2) * SCALE_FACTOR * (1.4 + 2.4 * hoverScale));
    } else {
      hoverSprite.visible = false;
    }

    // Brightness: a genuine function of each node's own current phase,
    // not a decorative shimmer — this IS the resonance signal now.
    // `boost` (click emphasis) and a hover brighten both ride on top,
    // multiplicatively, and neither adds new geometry.
    const colAttr = nodeGeo.attributes.color;
    for (let i = 0; i < nodeList.length; i++) {
      boost[i] = Math.max(0, boost[i] - dt * 1.2);
      const pulse = 0.5 + 0.5 * Math.sin(theta[i]);
      const hoverMult = i === hoveredIdx ? 1 + 0.9 * hoverScale : 1;
      const brightness = Math.min(2.6, (0.35 + 1.0 * pulse) * (1 + boost[i]) * hoverMult);
      tmpColor.setHex(SCENE_ACCENT[nodeList[i].scene] ?? 0xffffff).multiplyScalar(brightness);
      colAttr.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
    }
    colAttr.needsUpdate = true;

    // Living atmosphere: independent linear drift, wrapped back into the
    // volume from a fresh random point/velocity on exit — "appearing and
    // passing" rather than a bounce or a settle. Skipped entirely under
    // reduced motion — continuous, unprompted background drift is one of
    // the canonical cases prefers-reduced-motion exists for; the points
    // themselves stay visible and clickable, just static.
    if (pendingPoints && !reduceMotion) {
      const pPosAttr = pendingGeo.attributes.position;
      for (let i = 0; i < pendingList.length; i++) {
        const ix = i * 3;
        let x = pPosAttr.array[ix] + pendingVel[i].x * dt;
        let y = pPosAttr.array[ix + 1] + pendingVel[i].y * dt;
        let z = pPosAttr.array[ix + 2] + pendingVel[i].z * dt;
        if (Math.hypot(x, y, z) > DRIFT_R) {
          const key = pendingList[i].key + ':respawn:' + Math.floor(now / 20000);
          const rx = (hashStr01(key + 'x') * 2 - 1);
          const ry = (hashStr01(key + 'y') * 2 - 1);
          const rz = (hashStr01(key + 'z') * 2 - 1);
          const rlen = Math.hypot(rx, ry, rz) || 1;
          const r = DRIFT_R * 0.9;
          x = (rx / rlen) * r; y = (ry / rlen) * r; z = (rz / rlen) * r;
        }
        pPosAttr.array[ix] = x; pPosAttr.array[ix + 1] = y; pPosAttr.array[ix + 2] = z;
      }
      pPosAttr.needsUpdate = true;
    }

    // Sonification: only touches the audio graph once it actually exists
    // (built lazily on the first real user gesture — see setSoundEnabled
    // above). setTargetAtTime glides both pitch and gain rather than
    // stepping instantly, avoiding zipper noise on every harmonic jump.
    // Round 10.1: added a distance falloff — a node's own real distance
    // from the camera, not a stand-in like graph position, since the
    // camera is what's actually "listening" and free-orbits independent
    // of the layout. Normalized against CAM_MIN/CAM_MAX (the scene's own
    // zoom bounds), so it responds to both zoom AND orbit position, with
    // a floor rather than a hard cutoff — a far node goes quiet, not
    // silent, since it's still part of the chord.
    if (audioCtx && voices) {
      const now2 = audioCtx.currentTime;
      const DIST_FLOOR = 0.12;
      for (let i = 0; i < nodeList.length; i++) {
        const pulse = 0.5 + 0.5 * Math.sin(theta[i]);
        const dist = camera.position.distanceTo(nodeList[i].pos);
        const distFactor = THREE.MathUtils.clamp(1 - (dist - CAM_MIN) / (CAM_MAX - CAM_MIN), DIST_FLOOR, 1);
        const targetGain = Math.min(1, (0.03 + 0.22 * pulse) * (1 + boost[i] * 0.2)) * VOICE_SCALE * distFactor;
        const targetFreq = pitchForEffHz(effHz[i]);
        // Slower time constants than earlier passes — a singing bowl
        // swells and settles, it doesn't step. Both detuned oscillators
        // glide to the same target frequency so the pair keeps beating
        // at a consistent, gentle rate through a harmonic change rather
        // than snapping in and out of sync.
        voices[i].gain.gain.setTargetAtTime(targetGain, now2, 0.35);
        voices[i].osc.frequency.setTargetAtTime(targetFreq, now2, 0.4);
        voices[i].osc2.frequency.setTargetAtTime(targetFreq, now2, 0.4);
      }
    }

    renderer.render(scene, camera);
    clippedPreview?.blit();
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
      clippedPreview?.dispose();

      starGeo.dispose(); starMat.dispose();
      galaxy.geo.dispose(); galaxy.mat.dispose();
      dustLanes.geo.dispose(); dustLanes.mat.dispose(); dustLanes.tex.dispose();
      nodeGeo.dispose(); nodeMat.dispose(); nodeHaloMat.dispose(); dotTex.dispose();
      hoverSprite.material.dispose();
      pendingGeo?.dispose(); pendingMat?.dispose();

      if (voices) {
        voices.forEach(v => {
          try { v.osc.stop(); } catch { /* already stopped */ }
          try { v.osc2.stop(); } catch { /* already stopped */ }
          v.osc.disconnect(); v.osc2.disconnect(); v.gain.disconnect();
        });
      }
      masterGain?.disconnect();
      compressor?.disconnect();
      reverb?.disconnect();
      reverbGain?.disconnect();
      if (audioCtx) { audioCtx.close(); audioCtx = null; }

      titleEl?.remove();
      hintEl?.remove();
      soundToggleEl?.remove();
      panel?.remove();
      renderer.domElement.remove();
    },
  };
}
