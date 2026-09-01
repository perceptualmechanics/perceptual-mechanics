import * as THREE from 'three';
import {
  bindOrbitDrag, bindWheelZoom, bindGuardedResize, bindTapVsDrag,
  prefersReducedMotion, parseHTML, createJumpList, createPanelCloser, escapeHtml,
  mountClippedPreviewCanvas, bindPersistedSoundToggle, setPanelSide, clickedLeftHalf,
  manageRenderer, createFrameClock, trackTimers,
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

// ─── Layout memoization (v4.0) ──────────────────────────────────────────────
// The relaxation above is 400 iterations of an O(n²) repulsion pass. Counted
// live 2026-09-01 against the real corpus — 64 approved rows, 76 unique nodes
// (the audit that flagged this said ~61; it has grown since, which is the
// point) — that is 400 × 2,850 pairs = ~1,140,000 vector subtract/length/scale
// sequences plus 25,600 edge passes, synchronously on the main thread, with
// nothing yielding — and main.js's initPreviews() instantiates every scene
// with {preview:true} on first page load, so the landing page paid the whole
// relaxation before it could paint, concurrently with nine other scenes'
// setup. The full scene then paid it again on every open, at the same
// ITERATIONS and the same n (only GRAPH_SCALE differs, 120 vs 200).
//
// It is fully deterministic — initial positions seed from hashStr01 and the
// relaxation itself has no randomness, which the header above already states
// as a design property — so identical inputs always settle into an identical
// shape and the result is trivially cacheable. Keyed by everything that can
// change it: the scale, and the node/edge sets themselves (approving a row
// has to invalidate this, and 42 rows were approved in one go once already —
// see GRAPH_SCALE's own note below). The cost grows quadratically with the
// corpus, so this gets more valuable over time, not less.
const layoutCache = new Map();

function layoutSignature(nodeList, edges, scale) {
  // Hashed rather than stored raw: the graph identity has to be in the key,
  // but the joined key/wiring strings are multi-kilobyte and the Map is
  // module-level (it outlives every mount).
  const keys = nodeList.map(nd => nd.key).join(',');
  const wiring = edges.map(([a, b]) => a + '-' + b).join(',');
  return `${scale}|${nodeList.length}|${edges.length}|${hashStr01(keys)}|${hashStr01(wiring)}`;
}

function layoutForceDirectedCached(nodeList, edges, scale) {
  const sig = layoutSignature(nodeList, edges, scale);
  const cached = layoutCache.get(sig);
  if (cached) {
    nodeList.forEach((nd, i) => nd.pos.set(cached[i * 3], cached[i * 3 + 1], cached[i * 3 + 2]));
    return;
  }
  layoutForceDirected(nodeList, edges, scale);
  const settled = new Float64Array(nodeList.length * 3);
  nodeList.forEach((nd, i) => {
    settled[i * 3] = nd.pos.x; settled[i * 3 + 1] = nd.pos.y; settled[i * 3 + 2] = nd.pos.z;
  });
  layoutCache.set(sig, settled);
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

  // Set as the very first thing dispose() does. Every async continuation and
  // every deferred callback below checks it before touching scene state —
  // the headline v4.0 bug was exactly a torn-down scene still being driven
  // from outside itself (see setSoundEnabled and dispose() below, and
  // bindPersistedSoundToggle's own comment in sceneKit.js).
  let disposed = false;
  // Every setTimeout in this file goes through here so dispose() can drop
  // whatever is still pending in one call — see trackTimers' own comment for
  // the Library incident that motivated it.
  const timers = trackTimers();

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
  layoutForceDirectedCached(nodeList, edges, GRAPH_SCALE);
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
  //
  // v4.0: these four are typed arrays rather than plain ones, and the
  // adjacency is flattened into CSR (compressed sparse row) alongside them.
  // The integration loop in animate() used to run `theta.slice()` — a fresh
  // n-element array allocated every frame — and `adj[i].forEach(j => ...)`,
  // which builds a fresh closure over coupling/theta/i per node per frame:
  // ~4,560 a second at the corpus's current 76 nodes. The graph never changes
  // after mount, so
  // flattening it once here makes the hot loop two indexed `for`s over
  // contiguous memory with no allocation at all.
  const N = nodeList.length;
  const omega = new Float64Array(N);
  const theta = new Float64Array(N);
  const boost = new Float64Array(N); // 0..~1, decays after a click — briefly emphasizes the clicked node and its synced neighbors rather than drawing new geometry
  const effHz = new Float64Array(N).fill(KURAMOTO_BASE_HZ); // dθ/dt of the last integration step, in Hz — round 10's sonification pitch input, see below
  nodeList.forEach((n, i) => {
    omega[i] = 2 * Math.PI * (KURAMOTO_BASE_HZ + (hashStr01(n.key + ':freq') * 2 - 1) * KURAMOTO_SPREAD_HZ);
    theta[i] = hashStr01(n.key + ':phase0') * Math.PI * 2;
  });
  // adjStart[i]..adjStart[i+1] indexes this node's neighbours inside adjIdx —
  // the exact same graph `adj` holds, just laid out for the hot loop. `adj`
  // itself stays: triggerBoost below walks it once per click, where a plain
  // array reads better and costs nothing.
  const adjStart = new Int32Array(N + 1);
  for (let i = 0; i < N; i++) adjStart[i + 1] = adjStart[i] + adj[i].length;
  const adjIdx = new Int32Array(adjStart[N]);
  for (let i = 0, k = 0; i < N; i++) for (let j = 0; j < adj[i].length; j++) adjIdx[k++] = adj[i][j];
  const thetaNext = new Float64Array(N); // reused every frame, never reallocated
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
  // Pixel ratio through manageRenderer rather than raw window.devicePixelRatio
  // (v4.0). This scene is the site's heaviest overdraw case by some distance —
  // 1,600 stars, 5,000 additive galaxy points, 2,200 deliberately large soft
  // dust sprites, 61 nodes and 61 haloes, every one of them transparent with
  // depthWrite:false — so on a DPR-3 phone uncapped meant nine times the
  // fragments of the DPR-1 case the look was tuned against. manageRenderer
  // also owns the real GL-context release and the webglcontextlost handler;
  // see its own comment in sceneKit.js for why renderer.dispose() alone
  // isn't enough.
  const managedRenderer = manageRenderer(renderer);
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
  // No `container.tabIndex = -1` here: main.js:359 already sets tabindex="-1"
  // on #experience-container when it opens a scene, so this was a second
  // place to keep in agreement with no second effect.

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
  // one real hub, currently carries 6 — see resonances.js).
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
  // `{ fromLeft }` follows the same side-adaptable-panel convention as
  // Sphere/Library/Orbiter (see sceneKit.js's setPanelSide/clickedLeftHalf
  // header comment) — the panel docks on whichever side WASN'T clicked, so
  // it doesn't open underneath the reader's own hand. Content is resolved
  // (async — loadResolveEndpoint/resolveEndpoint) before the open/side
  // decision runs, since none of that touches panel DOM classes; `populate`
  // is a plain closure so it can be called either immediately or after the
  // close/wait/reopen dance below, without resolving twice.
  //
  // v4.0 — focus on open. Opening a role="dialog" without moving focus into
  // it leaves a keyboard or screen-reader visitor standing on the (now
  // invisible) jump-list button behind the panel: no announcement that
  // anything happened, and nothing to do but blind-Tab until they find it.
  // harmonics.html:41 has carried `tabindex="-1"` on
  // .harmonics-panel-title since it was written, specifically so focus could
  // land there — nothing ever called focus() on it, so the attribute was
  // dead. Orbiter has the identical panel skeleton and does this correctly in
  // both branches (orbiter.js:920, :929); this is that, same 50ms beat, which
  // lets the slide-in start before focus lands rather than announcing a panel
  // that's still off-screen. createPanelCloser already returns focus to
  // `container` on close — only the entry half was missing.
  function focusPanelTitle() {
    if (disposed || !panelTitleEl) return;
    panelTitleEl.focus();
  }

  async function openNodePanel(nodeIndex, { fromLeft } = {}) {
    if (!panel) return;
    const node = nodeList[nodeIndex];
    const resolveEndpoint = await loadResolveEndpoint();
    // The import can settle after the visitor has already left this scene —
    // populate() would then write into a detached panel (and, before the
    // focus move above existed, do nothing visible at all).
    if (disposed) return;
    const self = resolveEndpoint(node.endpoint);
    const selfHex = `#${(SCENE_ACCENT[node.scene] ?? 0xffffff).toString(16).padStart(6, '0')}`;
    const conns = nodeResonances(nodeIndex);

    const populate = () => {
      panelTitleEl.textContent = self.title;
      panelSubtitleEl.textContent = conns.length === 1 ? 'Resonates with 1 piece' : `Resonates with ${conns.length} pieces`;
      panelResonancesEl.innerHTML = '';
      conns.forEach(({ row, other }, i) => {
        const resolved = resolveEndpoint(other);
        const otherHex = `#${(SCENE_ACCENT[other.scene] ?? 0xffffff).toString(16).padStart(6, '0')}`;
        const quotes = extractQuotes(row.rationale);
        const selfSnippet = snippetFor(self.rawText, quotes);
        const otherSnippet = snippetFor(resolved.rawText, quotes);

        const entry = document.createElement('div');
        entry.className = 'harmonics-resonance-entry';
        // Card background/glow accent (see harmonics.css's own comment) —
        // the connection's OTHER scene color, same hex already resolved
        // for the excerpt border just below, not a separate palette.
        entry.style.setProperty('--entry-accent', otherHex);

        // "2 OF 6" — only worth printing once there's more than one card
        // to locate within; a single-connection node has nothing to
        // number against (design-notes pass follow-up, 2026-09-01).
        if (conns.length > 1) {
          const indexEl = document.createElement('span');
          indexEl.className = 'harmonics-entry-index';
          indexEl.textContent = `${i + 1} of ${conns.length}`;
          entry.appendChild(indexEl);
        }

        const pair = document.createElement('div');
        pair.className = 'harmonics-excerpt-pair';
        const selfQ = document.createElement('blockquote');
        selfQ.className = 'harmonics-excerpt';
        selfQ.style.borderLeftColor = selfHex;
        selfQ.style.setProperty('--q-accent', selfHex);
        selfQ.innerHTML = `<span class="harmonics-excerpt-label">${escapeHtml(self.title)}</span>${escapeHtml(selfSnippet)}`;
        // Decorative glyph binding the pair as one resonance, not two
        // unrelated quotes (see harmonics.css's own comment) — hidden
        // from assistive tech, which already gets the relationship from
        // the panel subtitle and each excerpt's own title label.
        const glyph = document.createElement('div');
        glyph.className = 'harmonics-resonance-glyph';
        glyph.setAttribute('aria-hidden', 'true');
        glyph.textContent = '⟡';
        const otherQ = document.createElement('blockquote');
        otherQ.className = 'harmonics-excerpt';
        otherQ.style.borderLeftColor = otherHex;
        otherQ.style.setProperty('--q-accent', otherHex);
        otherQ.innerHTML = `<span class="harmonics-excerpt-label">${escapeHtml(resolved.title)}</span>${escapeHtml(otherSnippet)}`;
        pair.appendChild(selfQ);
        pair.appendChild(glyph);
        pair.appendChild(otherQ);
        entry.appendChild(pair);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'harmonics-endpoint-link';
        // Visible text now names the actual target (matches the aria-label
        // below) rather than the generic "Open this piece →" every button
        // used to share — with several resonance pairs stacked in one panel,
        // identical labels gave a sighted reader no way to tell which button
        // opened which piece without tracing back to that pair's own card
        // header. Design-notes pass, 2026-09-01.
        btn.textContent = `Open ${resolved.title} →`;
        btn.setAttribute('aria-label', `Open ${resolved.title}`);
        btn.addEventListener('click', e => {
          e.stopPropagation();
          navigateToPiece(other.scene, resolved.pieceId);
        });
        entry.appendChild(btn);

        panelResonancesEl.appendChild(entry);
      });
    };

    const wasOpen = panel.classList.contains('open');
    const sideMismatch = fromLeft !== undefined && panel.classList.contains('from-left') !== fromLeft;
    if (wasOpen && sideMismatch) {
      // Crossing to the other side of an already-open panel: close first,
      // then reopen anchored to the new side once the close transition
      // finishes — same pattern as sphere.js/orbiter.js's own panels.
      panel.classList.remove('open');
      timers.after(500, () => {
        setPanelSide(panel, fromLeft);
        populate();
        panel.classList.add('open');
        timers.after(50, focusPanelTitle);
      });
      return;
    }
    if (!wasOpen && sideMismatch) setPanelSide(panel, fromLeft);
    populate();
    panel.classList.add('open');
    timers.after(50, focusPanelTitle);
  }

  // Round 10's living atmosphere: touching a pending point gets, at most,
  // a small honest acknowledgment — not the full payoff treatment, since
  // this connection hasn't been reviewed/approved yet. Same fromLeft
  // side-adaptation as openNodePanel above.
  async function openPendingPanel(pendingIndex, { fromLeft } = {}) {
    if (!panel) return;
    const p = pendingList[pendingIndex];
    const resolveEndpoint = await loadResolveEndpoint();
    if (disposed) return; // same late-resolution guard as openNodePanel above
    const info = resolveEndpoint(p.endpoint);

    const populate = () => {
      panelTitleEl.textContent = info.title;
      panelSubtitleEl.textContent = 'Pending review';
      panelResonancesEl.innerHTML = '';
    };

    const wasOpen = panel.classList.contains('open');
    const sideMismatch = fromLeft !== undefined && panel.classList.contains('from-left') !== fromLeft;
    if (wasOpen && sideMismatch) {
      panel.classList.remove('open');
      timers.after(500, () => {
        setPanelSide(panel, fromLeft);
        populate();
        panel.classList.add('open');
        timers.after(50, focusPanelTitle);
      });
      return;
    }
    if (!wasOpen && sideMismatch) setPanelSide(panel, fromLeft);
    populate();
    panel.classList.add('open');
    timers.after(50, focusPanelTitle);
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
  // Tracked and single-shot (v4.0): two quick drags used to leave two pending
  // untracked timers, and the first to fire re-enabled auto-rotate three
  // seconds after the FIRST drag ended rather than the last — the camera
  // started drifting under a hand that was still working.
  let autoRotateTimer = null;
  const touchGuard = !preview ? bindTapVsDrag(container) : null;
  const orbitDrag = !preview ? bindOrbitDrag(container, {
    onDragStart: () => { autoRotate = false; },
    onDrag: (dx, dy) => {
      theta0 -= dx;
      phi = THREE.MathUtils.clamp(phi - dy, PHI_MIN, PHI_MAX);
      updateCamera();
    },
    onDragEnd: () => {
      if (autoRotateTimer !== null) timers.cancel(autoRotateTimer);
      autoRotateTimer = timers.after(3000, () => { autoRotateTimer = null; autoRotate = true; });
    },
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
  // No threshold assignment here (removed v4.0): pickNodeAt and pickPendingAt
  // each set their own — deliberately different radii, see pickPendingAt's own
  // comment — immediately before every use, so a constructor-time value was
  // overwritten before it could ever apply to anything.
  const pointerNdc = new THREE.Vector2();
  let hoveredIdx = -1;
  let onMove = null, onClick = null, onLeave = null;
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
    // v4.0: moving the cursor off the canvas entirely — onto the nav, onto
    // the sound toggle, out of the window — never cleared the hover, so the
    // node stayed brightened with its halo drawn and container.style.cursor
    // stuck at 'pointer' with nothing under the pointer to justify it.
    // Outside already handles this correctly (outside.js's onPointerLeave);
    // same fix, same event.
    onLeave = () => {
      if (hoveredIdx === -1) return;
      hoveredIdx = -1;
      container.style.cursor = 'default';
    };
    container.addEventListener('pointerleave', onLeave);
    onClick = e => {
      if (touchGuard?.consume()) return;
      const idx = pickNodeAt(e.clientX, e.clientY);
      if (idx !== -1) {
        hoveredIdx = idx;
        triggerBoost(idx);
        const rect = container.getBoundingClientRect();
        openNodePanel(idx, { fromLeft: clickedLeftHalf(e, rect) });
        return;
      }
      const pIdx = pickPendingAt(e.clientX, e.clientY);
      if (pIdx !== -1) {
        const rect = container.getBoundingClientRect();
        openPendingPanel(pIdx, { fromLeft: clickedLeftHalf(e, rect) });
      }
    };
    container.addEventListener('click', onClick);
  }

  // Keyboard equivalent — nodes are otherwise raycast-only.
  //
  // v4.0 fixes two things here.
  //
  // (1) Labels used to read "Piece 1" … "Piece 61", defended in this comment
  // as "the panel discloses identity once open." Sixty-one buttons that all
  // read the same is not a list anyone can navigate, and the defence stopped
  // being necessary the moment the scene started warming loadResolveEndpoint()
  // at mount (see the fire-and-forget call in the chrome block above) — the
  // real titles land a moment later at zero extra cost, and
  // resolveEndpoint(node.endpoint).title is literally the same string the
  // panel prints. So the numbered labels stay only as the pre-resolution
  // fallback, and get replaced in place once the promise settles.
  //
  // (2) Pending points had no non-mouse trigger AT ALL: pickPendingAt is a
  // mouse path only and this list covered `nodeList` alone, so
  // openPendingPanel was unreachable from a keyboard. They're folded into
  // this same list rather than given a second one — one list, one Tab stop,
  // and the "— pending review" suffix carries exactly the distinction the
  // panel's own subtitle makes. The corpus happens to have zero pending rows
  // right now (all 42 were approved in one go, see GRAPH_SCALE's note above),
  // so today this adds nothing to the rendered list; writing it data-driven
  // means the next pending row is reachable without another pass.
  let jumpList = null;
  const jumpItems = [
    ...nodeList.map((node, i) => ({ node, index: i, pending: false })),
    ...pendingList.map((node, i) => ({ node, index: i, pending: true })),
  ];
  if (!preview && jumpItems.length) {
    jumpList = createJumpList(container, {
      label: 'Touch a node',
      items: jumpItems,
      getLabel: item => (item.pending ? `Pending resonance ${item.index + 1}` : `Piece ${item.index + 1}`),
      onSelect: item => {
        if (item.pending) { openPendingPanel(item.index, { fromLeft: false }); return; }
        triggerBoost(item.index);
        openNodePanel(item.index, { fromLeft: false });
      },
    });
    loadResolveEndpoint().then(resolveEndpoint => {
      if (disposed || !jumpList) return;
      // createJumpList owns the markup, so relabelling reads its buttons back
      // out of the DOM in the order it appended them (one per item, same
      // order as `jumpItems`) rather than duplicating list construction here.
      const btns = container.querySelectorAll('.pm-jumplist button');
      jumpItems.forEach((item, i) => {
        const btn = btns[i];
        if (!btn) return;
        const { title } = resolveEndpoint(item.node.endpoint);
        btn.textContent = item.pending ? `${title} — pending review` : title;
      });
    }).catch(() => { /* resolver failed to load — the numbered fallback labels above stand */ });
  }

  if (followedNodeIndex !== -1) {
    triggerBoost(followedNodeIndex);
    openNodePanel(followedNodeIndex, { fromLeft: false });
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
    // v4.0, the second belt on the headline bug. bindPersistedSoundToggle
    // used to leave a `pointerdown` listener on the shared
    // #experience-container — which main.js only ever empties, never
    // replaces — so one pointer-down inside ANY later scene called straight
    // into here from a scene that no longer existed, built a brand-new
    // AudioContext (dispose() nulls audioCtx, so buildAudioGraph's own
    // `if (audioCtx) return` guard couldn't stop it) and started 152
    // oscillators (two per node, at the corpus's current 76) plus a convolver
    // that nothing could ever close. Four
    // orphaned running contexts were reproduced against Chrome's ~6-per-page
    // cap. The helper now returns a dispose() and this scene calls it (see
    // soundToggle below), which is the real fix; this guard makes a stale
    // call from any other route a no-op too.
    if (disposed) return;
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
  const soundToggle = bindPersistedSoundToggle(container, soundToggleEl, setSoundEnabled, 'harmonics');

  // ─── Tab visibility (v4.0) ───────────────────────────────────────────────
  // This scene's entire sonification is driven from animate(), and animate()
  // is requestAnimationFrame — which stalls when the tab backgrounds. Through
  // v3.16.2 that meant every setTargetAtTime simply stopped being issued
  // while all 152 oscillators held their last target: a static chord droning
  // out of a hidden tab, with the toggle that would stop it unreachable.
  //
  // Outside hit the same hazard from the other side and solved it with a
  // setInterval lookahead scheduler keyed to audioCtx.currentTime (see
  // outside.js:944-976 for the full writeup). That is the right fix for
  // discrete scheduled events; this scene is one continuous drone with no
  // events to schedule ahead, so the cheap correct answer is the opposite —
  // stop the audio clock rather than try to keep feeding it. Suspending also
  // fixes the desync the dt clamp caused: with both the simulation and the
  // audio stopped, they resume in agreement instead of the audible pitch
  // relationships quietly drifting away from the visible ones.
  //
  // The resume half doubles as the mobile-Safari fix Outside already carries:
  // some engines auto-suspend an AudioContext on backgrounding and expect an
  // explicit resume() once visible again, which setSoundEnabled's own resume
  // never covers because it only runs on an actual toggle click.
  const onVisibilityChange = () => {
    if (disposed) return;
    if (document.hidden) {
      if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
      return;
    }
    // First frame back would otherwise arrive as one long dt — clamped to
    // 0.05s, but still a visible jump in every node's phase.
    clock.resync();
    if (soundEnabled && audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  const reduceMotion = prefersReducedMotion();

  // ─── Reduced motion: settle the oscillators once, then hold ──────────────
  // v4.0. The `if (!reduceMotion)` block in animate() gates camera
  // auto-rotate, both backdrop rotations, the twinkle and the pending drift —
  // but it closed before the Kuramoto integration and before the node
  // brightness loop, so all 76 nodes kept their 0.2Hz pulse regardless. That
  // pulse is not decoration to leave running: this file's own header calls it
  // "visibly breathing together" and describes it as THE carrier of the
  // scene's meaning, which is exactly why a continuous full-screen luminance
  // oscillation is the wrong thing to hand a visitor who asked for none.
  //
  // Freezing theta at its seeded initial phases would stop the motion but
  // would also throw away the one thing the model exists to show. So the
  // simulation is run to settlement here instead — once, at mount, ~15
  // simulated seconds against the round-8 tuning note's own measurement that
  // every multi-node cluster reaches ~0.97-1.00 coherence within ~5 — and
  // then held. A reduced-motion visitor gets the locked state as a still
  // image: each cluster at its own shared brightness, exactly the structure
  // the animation is there to reveal, just not moving. animate() then skips
  // both the per-frame integration and the per-frame colour upload entirely
  // (see its own note), so this is cheaper as well as calmer.
  //
  // `boost` and `hoverMult` still apply on top: those are visitor-initiated,
  // and the hover-halo block below already establishes that convention for
  // this scene (round 10's brighten-on-hover stays under reduced motion, only
  // the ease is skipped).
  if (reduceMotion && N) {
    const SETTLE_DT = 0.05;
    const SETTLE_STEPS = Math.round(15 / SETTLE_DT);
    for (let step = 0; step < SETTLE_STEPS; step++) {
      for (let i = 0; i < N; i++) {
        let coupling = 0;
        for (let k = adjStart[i]; k < adjStart[i + 1]; k++) coupling += Math.sin(theta[adjIdx[k]] - theta[i]);
        const dtheta = omega[i] + KURAMOTO_K * coupling;
        effHz[i] = Math.abs(dtheta) / (2 * Math.PI);
        thetaNext[i] = theta[i] + SETTLE_DT * dtheta;
      }
      theta.set(thetaNext);
    }
  }

  // ─── Animate ──────────────────────────────────────────────────────────────
  const clock = createFrameClock();
  let animId = null;
  let paused = false;

  // Under reduced motion `theta` is held still (settled once at mount above),
  // so the only things that can change a node's colour between frames are the
  // two visitor-initiated multipliers — `boost`, decaying after a click, and
  // `hoverMult`. These track whether either is still in flight, so the
  // whole-corpus colour loop and its attribute upload can both be skipped once
  // they've come to rest rather than rewriting a bit-identical buffer 60×/s.
  let paintedHoverIdx = -2; // -2 = nothing painted yet; -1 is a real "no hover"
  let painted = false;

  // Sonification bookkeeping — see the audio block at the bottom of animate()
  // for why each of these exists.
  const lastFreq = new Float64Array(N).fill(-1);
  const GAIN_UPDATE_INTERVAL = 0.05; // seconds — ~20Hz
  let gainAccum = GAIN_UPDATE_INTERVAL;

  function animate(now) {
    animId = requestAnimationFrame(animate);
    const dt = clock.tick();

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
    // v4.0: allocation-free — CSR adjacency (adjStart/adjIdx) and a reused
    // thetaNext, replacing a per-frame theta.slice() and a per-node closure.
    // Skipped entirely under reduced motion: theta was settled once at mount
    // and deliberately holds there (see the settle loop above).
    if (!reduceMotion) {
      for (let i = 0; i < N; i++) {
        let coupling = 0;
        for (let k = adjStart[i]; k < adjStart[i + 1]; k++) coupling += Math.sin(theta[adjIdx[k]] - theta[i]);
        const dtheta = omega[i] + KURAMOTO_K * coupling;
        effHz[i] = Math.abs(dtheta) / (2 * Math.PI);
        thetaNext[i] = theta[i] + dt * dtheta;
      }
      theta.set(thetaNext);
    }

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
    //
    // v4.0: under reduced motion the phase term is constant, so this whole
    // loop plus the colour-attribute upload runs only while a click boost is
    // still decaying or the hover has just moved — otherwise it would be
    // recomputing an identical buffer every frame to produce an identical
    // image. (Under normal motion nothing changes: the phase moves every
    // frame, so every frame genuinely needs the write.)
    let boostActive = false;
    for (let i = 0; i < N; i++) { if (boost[i] > 0) { boostActive = true; break; } }
    if (!reduceMotion || !painted || boostActive || hoveredIdx !== paintedHoverIdx) {
      const colAttr = nodeGeo.attributes.color;
      for (let i = 0; i < N; i++) {
        boost[i] = Math.max(0, boost[i] - dt * 1.2);
        const pulse = 0.5 + 0.5 * Math.sin(theta[i]);
        const hoverMult = i === hoveredIdx ? 1 + 0.9 * hoverScale : 1;
        const brightness = Math.min(2.6, (0.35 + 1.0 * pulse) * (1 + boost[i]) * hoverMult);
        tmpColor.setHex(SCENE_ACCENT[nodeList[i].scene] ?? 0xffffff).multiplyScalar(brightness);
        colAttr.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
      }
      colAttr.needsUpdate = true;
      paintedHoverIdx = hoveredIdx;
      painted = true;
    }

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
    //
    // v4.0, three gates on a block that was scheduling 3 AudioParam events per
    // node per frame — 228 at the corpus's current 76 nodes, ~13,700 a second:
    //
    // (1) `soundEnabled`. This variable was assigned in two places and read in
    // nowhere at all — the guard here was `if (audioCtx && voices)`. Muting
    // only ramps masterGain to 0; the context, the 122 oscillators and the
    // convolver all stay alive, so once a visitor had EVER enabled sound this
    // loop ran forever at full cost with the toggle reading "Sound off."
    //
    // (2) `!document.hidden`. The context is suspended while the tab is
    // hidden (see onVisibilityChange above), so currentTime isn't advancing
    // and every event would pile onto the same instant.
    //
    // (3) Rate. pitchForEffHz snaps to one of 7 integer harmonics, so
    // targetFreq genuinely changes only every few seconds — `lastFreq` skips
    // both frequency ramps until it actually moves. And the gain ramps run at
    // ~20Hz rather than per-frame: a 0.35s time constant cannot resolve
    // 120Hz updates, so the ~100 extra events/s per voice were inaudible by
    // construction.
    if (soundEnabled && audioCtx && voices && !document.hidden) {
      const now2 = audioCtx.currentTime;
      const DIST_FLOOR = 0.12;
      gainAccum += dt;
      const writeGain = gainAccum >= GAIN_UPDATE_INTERVAL;
      if (writeGain) gainAccum = 0;
      for (let i = 0; i < N; i++) {
        // Slower time constants than earlier passes — a singing bowl
        // swells and settles, it doesn't step. Both detuned oscillators
        // glide to the same target frequency so the pair keeps beating
        // at a consistent, gentle rate through a harmonic change rather
        // than snapping in and out of sync.
        const targetFreq = pitchForEffHz(effHz[i]);
        if (targetFreq !== lastFreq[i]) {
          lastFreq[i] = targetFreq;
          voices[i].osc.frequency.setTargetAtTime(targetFreq, now2, 0.4);
          voices[i].osc2.frequency.setTargetAtTime(targetFreq, now2, 0.4);
        }
        if (!writeGain) continue;
        const pulse = 0.5 + 0.5 * Math.sin(theta[i]);
        const dist = camera.position.distanceTo(nodeList[i].pos);
        const distFactor = THREE.MathUtils.clamp(1 - (dist - CAM_MIN) / (CAM_MAX - CAM_MIN), DIST_FLOOR, 1);
        const targetGain = Math.min(1, (0.03 + 0.22 * pulse) * (1 + boost[i] * 0.2)) * VOICE_SCALE * distFactor;
        voices[i].gain.gain.setTargetAtTime(targetGain, now2, 0.35);
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
    // A window dragged between a Retina and a non-Retina display changes
    // devicePixelRatio with no other signal — see manageRenderer's own note.
    managedRenderer.applyPixelRatio();
  });

  return {
    // main.js pauses preview tiles while a full scene is open, and on
    // visibilitychange. Stopping the rAF loop is the whole point — a paused
    // tile shouldn't be integrating 76 coupled oscillators and rendering
    // ~9,000 transparent points behind an opaque overlay — so the clock has to be
    // resynced on the way back in, or the first frame home arrives as one
    // clamped-but-still-visible 50ms jump.
    setPaused(next) {
      if (disposed || paused === next) return;
      paused = next;
      if (paused) {
        if (animId !== null) cancelAnimationFrame(animId);
        animId = null;
      } else {
        clock.resync();
        animId = requestAnimationFrame(animate);
      }
    },
    dispose() {
      // First, not last: every deferred callback below (panel population
      // after an await, the jump-list relabel, a tracked timer that already
      // fired) reads this before touching scene state.
      disposed = true;
      if (animId !== null) cancelAnimationFrame(animId);
      timers.dispose();
      resize.dispose();
      orbitDrag?.dispose();
      wheelZoom?.dispose();
      touchGuard?.dispose();
      jumpList?.dispose();
      panelCloser?.dispose();
      // The headline v4.0 leak: this listener used to have no way off the
      // shared #experience-container at all. See setSoundEnabled above.
      soundToggle.dispose();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (onMove) container.removeEventListener('mousemove', onMove);
      if (onLeave) container.removeEventListener('pointerleave', onLeave);
      if (onClick) container.removeEventListener('click', onClick);
      managedRenderer.dispose();
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
      // Close AND null, in that order, and null every node hanging off it.
      // Outside's dispose() does exactly the same thing for exactly this
      // reason: the two scenes carried the same stale-listener bug and
      // produced two completely different symptoms purely because one nulled
      // its context and the other didn't (Harmonics rebuilt a fresh graph;
      // Outside re-armed an unclearable setInterval against a closed one).
      // Symmetric teardown is what stops that class of divergence.
      if (audioCtx) { audioCtx.close(); audioCtx = null; }
      masterGain = compressor = reverb = reverbGain = voices = null;
      soundEnabled = false;

      titleEl?.remove();
      hintEl?.remove();
      soundToggleEl?.remove();
      panel?.remove();
    },
  };
}
