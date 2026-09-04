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
export const FAR_INNER = 5.0;    // world units — where the knots start
export const FAR_OUTER = 33.0;
const FAR_PER_CLUSTER = [6, 18];  // range
const FAR_SIGMA = [0.35, 1.5];
const FAR_LINK_MAX = 15.0;   // world units — beyond this, two knots are not neighbours

// Strand counts. Deliberately low: k is the number of neighbours each node
// reaches for, and the graph is the union of those reaches, so the mean degree
// comes out near 2k − something rather than k.
const NEAR_K = 2;
const FAR_K = 3;
const APPROACHES = 22;   // filaments run out from the object into the field

// ─── Nearest neighbours, over one point set of wildly varying density ───────
// A kd-tree rather than the hash grid this started with, and the reason is the
// continuity requirement rather than speed. A grid needs a cell size, and this
// set has none to choose: the corpus nodes sit 0.03 units apart inside a
// 1.7-unit object and the far knots are tens of units across. With one grid the
// dense end scans thousands of points per query and the sparse end finds an
// empty cell; with two grids the two halves cannot see each other, which is
// exactly the seam that made the field read as wallpaper behind a lit object.
//
// One tree over every node, so a strand can be found between any two things
// that are actually near each other, whatever scale they belong to.
function buildTree(pos, count) {
  const idx = new Int32Array(count);
  for (let i = 0; i < count; i++) idx[i] = i;
  const nodes = [];
  (function build(lo, hi, depth) {
    if (lo >= hi) return -1;
    const axis = depth % 3;
    const mid = (lo + hi) >> 1;
    // Quickselect on the axis, which is what makes this O(n log n) overall.
    let l = lo, r = hi - 1;
    while (l < r) {
      const pivot = pos[idx[(l + r) >> 1] * 3 + axis];
      let a = l, b = r;
      while (a <= b) {
        while (pos[idx[a] * 3 + axis] < pivot) a++;
        while (pos[idx[b] * 3 + axis] > pivot) b--;
        if (a <= b) { const t = idx[a]; idx[a] = idx[b]; idx[b] = t; a++; b--; }
      }
      if (mid <= b) r = b; else if (mid >= a) l = a; else break;
    }
    const self = nodes.length;
    nodes.push({ point: idx[mid], axis, left: -1, right: -1 });
    nodes[self].left = build(lo, mid, depth + 1);
    nodes[self].right = build(mid + 1, hi, depth + 1);
    return self;
  })(0, count, 0);
  return nodes;
}

function knnTree(pos, tree, root, self, k, best) {
  for (let b = 0; b < k; b++) { best[b].d = Infinity; best[b].j = -1; }
  const x = pos[self * 3], y = pos[self * 3 + 1], z = pos[self * 3 + 2];
  (function visit(n) {
    if (n < 0) return;
    const node = tree[n];
    const p = node.point;
    if (p !== self) {
      const dx = pos[p * 3] - x, dy = pos[p * 3 + 1] - y, dz = pos[p * 3 + 2] - z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < best[k - 1].d) {
        let sIdx = k - 1;
        while (sIdx > 0 && best[sIdx - 1].d > d) { best[sIdx].d = best[sIdx - 1].d; best[sIdx].j = best[sIdx - 1].j; sIdx--; }
        best[sIdx].d = d; best[sIdx].j = p;
      }
    }
    const a = node.axis;
    const delta = (a === 0 ? x : a === 1 ? y : z) - pos[p * 3 + a];
    const near = delta < 0 ? node.left : node.right;
    const far = delta < 0 ? node.right : node.left;
    visit(near);
    if (delta * delta < best[k - 1].d) visit(far);
  })(root);
}

// Symmetric k-nearest-neighbour edges over a slice of the point set.
function knn(pos, tree, from, count, k, total) {
  const best = [];
  for (let b = 0; b < k; b++) best.push({ d: Infinity, j: -1 });
  const edges = [];
  const seen = new Set();
  for (let i = 0; i < count; i++) {
    const n = from + i;
    knnTree(pos, tree, 0, n, k, best);
    for (let b = 0; b < k; b++) {
      const j = best[b].j;
      if (j < 0) continue;
      const a = Math.min(n, j), c = Math.max(n, j);
      const id = a * total + c;
      if (seen.has(id)) continue;
      seen.add(id);
      edges.push(a, c);
    }
  }
  return edges;
}

// ─── Making it one web, which is the whole claim ────────────────────────────
// A symmetric k-nearest-neighbour graph is NOT connected, and at k = 2 or 3 it
// is nowhere near it: measured on this point set, plain kNN left 223 pieces,
// the largest holding 19.8% of the nodes. A field in 223 pieces cannot be
// traced from the crystal to a far knot, so "one structure at two
// magnifications" would have been a sentence rather than something on screen.
//
// So the pieces are joined, Borůvka's way: every round, each remaining piece
// finds the shortest strand from itself to any other piece and takes it. The
// edges added are the shortest ones available, so they are indistinguishable
// from the strands the neighbour pass found — this closes the graph rather than
// decorating it.
function connectComponents(pos, tree, edges, total) {
  const parent = new Int32Array(total);
  for (let i = 0; i < total; i++) parent[i] = i;
  const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra === rb) return false; parent[ra] = rb; return true; };
  for (let e = 0; e < edges.length; e += 2) union(edges[e], edges[e + 1]);

  const K = 12;
  const best = [];
  for (let b = 0; b < K; b++) best.push({ d: Infinity, j: -1 });
  const added = [];
  for (let round = 0; round < 24; round++) {
    const cheapest = new Map();   // component root → [d, a, b]
    for (let n = 0; n < total; n++) {
      const rn = find(n);
      knnTree(pos, tree, 0, n, K, best);
      for (let b = 0; b < K; b++) {
        const j = best[b].j;
        if (j < 0 || find(j) === rn) continue;
        const cur = cheapest.get(rn);
        if (!cur || best[b].d < cur[0]) cheapest.set(rn, [best[b].d, n, j]);
        break;
      }
    }
    if (!cheapest.size) break;
    let joined = 0;
    for (const [, [, a, b]] of cheapest) if (union(a, b)) { added.push(a, b); joined++; }
    if (!joined) break;
    // One component left: every node's root is the same.
    const root = find(0);
    let done = true;
    for (let n = 1; n < total; n++) if (find(n) !== root) { done = false; break; }
    if (done) break;
  }
  return added;
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

  // ─── The approach ─────────────────────────────────────────────────────────
  // The seam this release exists to remove. Until 4.8.2 the field started at a
  // fixed inner radius with nothing between it and the object, so the lens sat
  // in a hole in the web and read as a lit thing in front of wallpaper. Three
  // long bridge strands crossed the gap and that is not the same as being
  // connected — a jump across a void reads as a drawn line, which is what it
  // was.
  //
  // What crosses it now is **filament, on the same terms as every other
  // filament**: chains of nodes running out from the object's own outermost
  // nodes to the nearest knots, spaced closely at the object and opening out
  // with distance, so the density falls off continuously instead of stepping.
  // The strands then come out of the same nearest-neighbour pass as everything
  // else, and a strand can be traced from inside the crystal to a far knot
  // without a break, which is the claim the whole release makes.
  {
    const outer = [];
    for (let i = 0; i < nearCount; i++) {
      const dx = nearPos[i * 3] - center[0], dy = nearPos[i * 3 + 1] - center[1], dz = nearPos[i * 3 + 2] - center[2];
      outer.push([dx * dx + dy * dy + dz * dz, i]);
    }
    outer.sort((a, b) => b[0] - a[0]);
    const spread = Math.min(outer.length, 600);
    for (let k = 0; k < APPROACHES; k++) {
      const src = outer[Math.floor(k * spread / APPROACHES)][1];
      const from = [nearPos[src * 3], nearPos[src * 3 + 1], nearPos[src * 3 + 2]];
      // The nearest knot centre in roughly the direction the node already
      // points away from the object's middle, so an approach leaves the lens
      // rather than doubling back across it.
      const away = [from[0] - center[0], from[1] - center[1], from[2] - center[2]];
      const am = Math.hypot(...away) || 1;
      let best = null, bestScore = -Infinity;
      for (const c of centres) {
        const v = [c[0] - from[0], c[1] - from[1], c[2] - from[2]];
        const vm = Math.hypot(...v) || 1;
        const align = (v[0] * away[0] + v[1] * away[1] + v[2] * away[2]) / (vm * am);
        const score = align - vm / FAR_OUTER;
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (!best) continue;
      // A WALK toward the knot, not a line to it with noise on top. The first
      // version was a straight segment plus jitter and twenty-two of those read
      // as a starburst leaving the object — radial, evenly spread, drawn. A
      // filament wanders: each step turns a little and then leans back toward
      // where it is going, so the path arrives without ever having been aimed.
      const total = Math.hypot(best[0] - from[0], best[1] - from[1], best[2] - from[2]);
      let p = from.slice();
      let dir = [(best[0] - p[0]) / total, (best[1] - p[1]) / total, (best[2] - p[2]) / total];
      // Spacing opens out with distance: dense where it leaves the crystal,
      // loose where it meets the field, so neither end has a visible join.
      let step = 0.05;
      for (let guard = 0; guard < 400; guard++) {
        const rem = Math.hypot(best[0] - p[0], best[1] - p[1], best[2] - p[2]);
        if (rem < step * 1.5) break;
        const to = [(best[0] - p[0]) / rem, (best[1] - p[1]) / rem, (best[2] - p[2]) / rem];
        // Wander grows with distance from the object: tight where it leaves,
        // loose out in the field where a filament has room to be crooked.
        const wander = 0.5 * Math.min(1, rem / total) + 0.12;
        dir = [
          dir[0] * 0.62 + to[0] * 0.38 + gauss() * wander * 0.35,
          dir[1] * 0.62 + to[1] * 0.38 + gauss() * wander * 0.35,
          dir[2] * 0.62 + to[2] * 0.38 + gauss() * wander * 0.35,
        ];
        const dm = Math.hypot(...dir) || 1;
        dir = [dir[0] / dm, dir[1] / dm, dir[2] / dm];
        p = [p[0] + dir[0] * step, p[1] + dir[1] * step, p[2] + dir[2] * step];
        far.push(p[0], p[1], p[2]);
        step *= 1.075;
      }
    }
  }

  const farCount = far.length / 3;

  const total = nearCount + farCount;
  const pos = new Float32Array(total * 3);
  pos.set(nearPos.subarray(0, nearCount * 3), 0);
  pos.set(far, nearCount * 3);

  // ONE tree over every node, near and far together. Two separate searches is
  // what made the seam possible in the first place: a corpus node could not see
  // a field node however close it was, because they were in different indexes.
  const tree = buildTree(pos, total);
  const nearEdges = knn(pos, tree, 0, nearCount, NEAR_K, total);
  const farEdges = knn(pos, tree, nearCount, farCount, FAR_K, total);
  // What makes it ONE web rather than a few hundred of them.
  const bridges = connectComponents(pos, tree, [...nearEdges, ...farEdges], total);

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
