// ─── The web ────────────────────────────────────────────────────────────────
// The field the lens sits in, and the lens's own interior, are one structure.
//
// NO THREE.JS AND NO DOM. Plain arrays, so the build can describe the web as
// well as the scene can draw it.
//
// ─── Why a web and not a starfield ──────────────────────────────────────────
// Until 4.8.1 the field was a dark ground with round glints on it, and the
// glints were the affordance. Two things were wrong with that and they have the
// same cause.
//
// **A node is not a point on black.** In the cosmic web a cluster sits where
// filaments meet, and the strands are as visible as the node; the same is true
// of a synapse. The two converge in form for a reason that is not a metaphor —
// both are networks built by matter falling along gradients toward nodes — and
// the resemblance has been measured rather than merely noticed. Drawing the
// nodes and not the strands draws the one part of that structure that is not
// the structure.
//
// **A dot has nowhere for a response to go.** A junction does: the filaments
// leaving it are the path. Since the whole scene is about a thing being read
// and answering, the affordance had to be something a response could leave.
//
// So the field is not a backdrop the lens stands in front of. It is the same
// kind of object at a different magnification, and the fractalanch is a
// fragment of it. That is the site's own title doing work rather than being
// invoked.
//
// ─── What is real in here ───────────────────────────────────────────────────
// **Junction brightness is strand count and nothing else.** Every edge is drawn
// as two segments meeting at a dark midpoint, bright at each end; a node with
// k strands therefore sums k bright ends in the same place, additively. The
// brightening is not a value anyone chose — it is what k overlapping line ends
// come to. Degree is computed below from the edge list that ships.
//
// **The near nodes are the corpus.** They are the filapixel positions, passed
// in rather than generated here, so the web's dense region IS the 3,221
// sentences and not a decorative approximation of them. The far nodes carry
// nothing and respond to nothing.
import { mulberry32, hashSeed } from '../../utils/prng.js';

// ─── Far field ──────────────────────────────────────────────────────────────
// Clustered rather than uniform, because uniform random points connected by
// nearest neighbours give an even mesh — the one thing the cosmic web is not.
// Voids are most of the volume; the nodes are in knots, and the long filaments
// between knots are what the eye reads as structure.
//
// Many small knots rather than few large ones, and the inner radius is well
// clear of the object: the first version put 62 fat clusters between 6.5 and 34
// units and the nearest of them read as big polygons across the frame rather
// than as a fine mesh a long way off. Everything is far enough that nothing in
// the field has a size on screen.
export const FAR_CLUSTERS = 240;
export const FAR_INNER = 9.0;    // world units — clear of the lens and the bench
export const FAR_OUTER = 33.0;
const FAR_PER_CLUSTER = [6, 18];  // range
const FAR_SIGMA = [0.35, 1.5];
const FAR_LINK_MAX = 15.0;   // world units — beyond this, two knots are not neighbours

// Strand counts. Deliberately low: k is the number of neighbours each node
// reaches for, and the graph is the union of those reaches, so the mean degree
// comes out near 2k − something rather than k.
const NEAR_K = 2;
const FAR_K = 3;
const BRIDGES = 3;    // strands from the lens's outer nodes into the far field

// A uniform hash grid, which is what makes this O(n) rather than O(n²). The
// near set is 3,221 nodes packed into a 1.7-unit object and the far set is ~900
// spread across 34 units, so they get their own grids at their own cell sizes
// rather than sharing one.
function knn(pos, from, count, k, cell) {
  const grid = new Map();
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < count; i++) {
    const n = from + i;
    const kk = key(pos[n * 3], pos[n * 3 + 1], pos[n * 3 + 2]);
    if (!grid.has(kk)) grid.set(kk, []);
    grid.get(kk).push(n);
  }
  const edges = [];
  const seen = new Set();
  const best = new Array(k);
  for (let i = 0; i < count; i++) {
    const n = from + i;
    const x = pos[n * 3], y = pos[n * 3 + 1], z = pos[n * 3 + 2];
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    for (let b = 0; b < k; b++) best[b] = { d: Infinity, j: -1 };
    // Widen the search until something is found: a node alone in its cell and
    // its 26 neighbours would otherwise get no strands at all, which is how an
    // isolated dot survives a change made to remove isolated dots.
    for (let ring = 1; ring <= 4; ring++) {
      for (let gx = cx - ring; gx <= cx + ring; gx++)
        for (let gy = cy - ring; gy <= cy + ring; gy++)
          for (let gz = cz - ring; gz <= cz + ring; gz++) {
            const bucket = grid.get(`${gx},${gy},${gz}`);
            if (!bucket) continue;
            for (const j of bucket) {
              if (j === n) continue;
              const dx = pos[j * 3] - x, dy = pos[j * 3 + 1] - y, dz = pos[j * 3 + 2] - z;
              const d = dx * dx + dy * dy + dz * dz;
              if (d >= best[k - 1].d) continue;
              let s = k - 1;
              while (s > 0 && best[s - 1].d > d) { best[s] = best[s - 1]; s--; }
              best[s] = { d, j };
            }
          }
      if (best[0].j >= 0) break;
    }
    for (let b = 0; b < k; b++) {
      const j = best[b].j;
      if (j < 0) continue;
      const a = Math.min(n, j), c = Math.max(n, j);
      const id = a * 1e7 + c;
      if (seen.has(id)) continue;
      seen.add(id);
      edges.push(a, c);
    }
  }
  return edges;
}

// The whole web, built from the lens's own filapixel positions plus a far
// field generated here. Pure and deterministic: the same lens, the same sky.
export function buildWeb(nearPos, nearCount, { center = [0, 0, 0], radius = 1 } = {}) {
  const rnd = mulberry32(hashSeed('RE73415:web'));
  const rand = (a, b) => a + (b - a) * rnd();
  const gauss = () => {
    // Box–Muller. A blob wants a normal radius, not a uniform one, or every
    // cluster reads as a ball with an edge.
    const u = Math.max(1e-9, rnd()), v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const far = [];
  const centres = [];
  for (let c = 0; c < FAR_CLUSTERS; c++) {
    // Cluster centres through the volume, biased outward by r³ so the volume
    // fills evenly rather than crowding the inner radius.
    const t = rnd();
    const r = Math.cbrt(FAR_INNER ** 3 + t * (FAR_OUTER ** 3 - FAR_INNER ** 3));
    const ct = Math.acos(1 - 2 * rnd());
    const cp = rnd() * Math.PI * 2;
    centres.push([
      center[0] + r * Math.sin(ct) * Math.cos(cp),
      center[1] + r * Math.cos(ct),
      center[2] + r * Math.sin(ct) * Math.sin(cp),
    ]);
  }
  for (const [cx, cy, cz] of centres) {
    const n = Math.round(rand(FAR_PER_CLUSTER[0], FAR_PER_CLUSTER[1]));
    const sigma = rand(FAR_SIGMA[0], FAR_SIGMA[1]);
    // Anisotropic: a knot is stretched along its own axis, which is what gives
    // the field short filaments inside knots as well as long ones between.
    const ax = [gauss(), gauss(), gauss()];
    const am = Math.hypot(...ax) || 1;
    const stretch = rand(1.4, 3.2);
    for (let i = 0; i < n; i++) {
      const g = [gauss(), gauss(), gauss()];
      const along = (g[0] * ax[0] + g[1] * ax[1] + g[2] * ax[2]) / am;
      far.push(
        cx + sigma * (g[0] + (stretch - 1) * along * ax[0] / am),
        cy + sigma * (g[1] + (stretch - 1) * along * ax[1] / am),
        cz + sigma * (g[2] + (stretch - 1) * along * ax[2] / am));
    }
  }

  // ─── The filaments between knots ──────────────────────────────────────────
  // NOT drawn as a long edge from one knot to another. The first version did
  // that and the result was a straight line ruled across the frame: legible as
  // a connection, and unmistakably drawn. **Matter is strung ALONG a filament**,
  // so what goes between two knots is a chain of nodes with a wander on it, and
  // the strands then come out of the same nearest-neighbour pass as everything
  // else. The structure is found rather than annotated.
  const linked = new Set();
  for (let a = 0; a < centres.length; a++) {
    const dists = [];
    for (let b = 0; b < centres.length; b++) {
      if (a === b) continue;
      const dx = centres[a][0] - centres[b][0];
      const dy = centres[a][1] - centres[b][1];
      const dz = centres[a][2] - centres[b][2];
      dists.push([dx * dx + dy * dy + dz * dz, b]);
    }
    dists.sort((p, q) => p[0] - q[0]);
    const links = rnd() < 0.55 ? 2 : 1;
    for (let l = 0; l < links && l < dists.length; l++) {
      const b = dists[l][1];
      const key = Math.min(a, b) * 10000 + Math.max(a, b);
      if (linked.has(key)) continue;
      linked.add(key);
      const d = Math.sqrt(dists[l][0]);
      if (d > FAR_LINK_MAX) continue;
      const steps = Math.max(2, Math.min(11, Math.round(d / 1.5)));
      const jitter = Math.min(1.1, d * 0.09);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        far.push(
          centres[a][0] + (centres[b][0] - centres[a][0]) * t + gauss() * jitter,
          centres[a][1] + (centres[b][1] - centres[a][1]) * t + gauss() * jitter,
          centres[a][2] + (centres[b][2] - centres[a][2]) * t + gauss() * jitter);
      }
    }
  }

  const farCount = far.length / 3;

  const total = nearCount + farCount;
  const pos = new Float32Array(total * 3);
  pos.set(nearPos.subarray(0, nearCount * 3), 0);
  pos.set(far, nearCount * 3);

  // Cell sizes: about the mean spacing of each set, which is what makes the
  // 27-cell scan find neighbours on the first ring in the common case.
  const nearCell = Math.max(1e-4, radius * 2 / Math.cbrt(nearCount) * 1.6);
  const farCell = (FAR_OUTER * 2) / Math.cbrt(farCount) * 0.9;

  const nearEdges = knn(pos, 0, nearCount, NEAR_K, nearCell);
  const farEdges = knn(pos, nearCount, farCount, FAR_K, farCell);

  // The lens is OF the web, not in it: a few strands leave its outermost nodes
  // and run out to the field. Without them the object floats in a picture of a
  // web, which is the composition this release exists to stop.
  const bridges = [];
  {
    const order = [];
    for (let i = 0; i < nearCount; i++) {
      const dx = pos[i * 3] - center[0], dy = pos[i * 3 + 1] - center[1], dz = pos[i * 3 + 2] - center[2];
      order.push([dx * dx + dy * dy + dz * dz, i]);
    }
    order.sort((a, b) => b[0] - a[0]);
    // Spread across the outermost 400 nodes rather than taking the first few,
    // which are all in the same place and gave a fan of parallel lines leaving
    // one corner of the object — the one thing in the first render that read as
    // drawn rather than found.
    const spread = Math.min(order.length, 400);
    for (let k = 0; k < BRIDGES && k < order.length; k++) {
      const n = order[Math.floor(k * spread / BRIDGES)][1];
      let bestD = Infinity, bestJ = -1;
      for (let j = 0; j < farCount; j++) {
        const m = nearCount + j;
        const dx = pos[m * 3] - pos[n * 3], dy = pos[m * 3 + 1] - pos[n * 3 + 1], dz = pos[m * 3 + 2] - pos[n * 3 + 2];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestD) { bestD = d; bestJ = m; }
      }
      if (bestJ >= 0) bridges.push(n, bestJ);
    }
  }

  const edges = Uint32Array.from([...nearEdges, ...farEdges, ...bridges]);
  const degree = new Uint16Array(total);
  for (let e = 0; e < edges.length; e += 2) { degree[edges[e]]++; degree[edges[e + 1]]++; }

  // Reported rather than asserted, because the /text/ page prints them and the
  // claim "brightness is strand count" is only checkable if the strand counts
  // are visible somewhere.
  let maxDeg = 0, sumDeg = 0, isolated = 0;
  for (let i = 0; i < total; i++) {
    if (degree[i] > maxDeg) maxDeg = degree[i];
    sumDeg += degree[i];
    if (degree[i] === 0) isolated++;
  }

  return {
    pos, degree, edges,
    nearCount, farCount, total,
    edgeCount: edges.length / 2,
    nearEdgeCount: nearEdges.length / 2,
    farEdgeCount: farEdges.length / 2,
    bridgeCount: bridges.length / 2,
    maxDegree: maxDeg,
    meanDegree: sumDeg / total,
    isolated,
    clusters: FAR_CLUSTERS,
  };
}
