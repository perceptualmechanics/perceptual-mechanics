// ─── DLA: diffusion-limited aggregation ────────────────────────────────────
// The generative core of Prism. A random walker starts outside the current
// structure and takes fixed-length steps in a uniformly random direction
// until it comes within sticking distance of something already part of the
// structure, at which point it's fixed there forever. No manual placement —
// the branching shape is entirely a byproduct of the walk-and-stick rule,
// same "real algorithm, not an artist's guess" discipline as the p-orbital's
// rejection sampling (orbiter.js) and Leaf's gravity-vs-tension threshold
// (1.8.0).
//
// Pure math, no THREE.js, no DOM — runs identically in Node (for the
// verification scripts) and in the browser (prismManifest.js imports this
// directly, at module scope, so the structure exists once per page load).
//
// ─── Round 2 (2026-07-30): collision is global, on purpose ─────────────────
// The first pass gave each of the six anchors its own collision pool (that
// arm's own growth plus the six raw anchor points, but not the other five
// arms' grown branches) — a deliberate choice to protect permanence: a
// literal fully-shared pool meant appending new material to one scene could
// retroactively move an already-placed piece from a different scene, months
// later, for a reason unconnected to that piece.
//
// Scott's read after seeing it built: it produced six isolated clusters,
// not one geode — correct call, and the fix changes the architecture rather
// than just a constant. The six original scenes' 68 pieces are no longer an
// open-ended, ever-extending batch at all — they're now a permanently frozen
// "seed" generation (see prismManifest.js), grown once with fully-global
// collision so branches genuinely reach toward and bond with each other.
// Permanence for anything that keeps growing going forward (prismEntries.js,
// one new walker per new piece of writing) is preserved a different way:
// each growth call is re-run from scratch against the same frozen seed, with
// its own dedicated RNG stream advancing through the growth list in strict
// append order — piece N's simulation never reads anything about piece N+1,
// so appending a piece can't move anything that already existed. Global
// collision and permanence-under-append aren't actually in tension once the
// "what's allowed to change over time" boundary is drawn in the right place.
//
// growPoints() is the one function both phases call: seed generation passes
// six batches (one per anchor, each with its own spawnCenter so the six
// origins stay visually legible) sharing a single RNG stream and a single
// global collision pool; growth passes one batch with no fixed spawnCenter
// (new material has no single natural origin — it spawns relative to the
// crystal's own current extent instead) on top of the already-grown seed.

// ─── Seeded PRNG ────────────────────────────────────────────────────────────
// mulberry32 — small, fast, and (this is the only property that matters
// here) perfectly reproducible: the same seed produces the same sequence on
// every machine, every build, forever. Not cryptographic; doesn't need to
// be.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A stable 32-bit hash (FNV-1a) turning a salt string into a PRNG seed —
// deterministic across every machine and every run.
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// A uniformly random direction on the unit sphere. The same fix Orbiter's
// 1.3.0 needed (see NOTES.md): composing independent angles, or normalizing
// a per-axis uniform-in-[-1,1] vector, both bias toward the poles/corners.
// Three independent standard-normal components, normalized, genuinely are
// uniform over the sphere's surface — the multivariate normal distribution
// is itself rotationally symmetric, so no direction is favored.
function gaussian(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function randomUnitVector3(rng) {
  const x = gaussian(rng), y = gaussian(rng), z = gaussian(rng);
  const len = Math.sqrt(x * x + y * y + z * z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

// ─── Growth constants ───────────────────────────────────────────────────────
// Both the walker and every stuck point are modeled as spheres of the same
// radius; two "touch" — stick — when their centers are within the sum of
// their radii, i.e. twice the radius. STEP_SIZE is kept at that same radius
// (well under STICK_DISTANCE) so a walker can't tunnel past a stuck point
// between two consecutive steps.
export const PARTICLE_RADIUS = 0.045;
export const STICK_DISTANCE = PARTICLE_RADIUS * 2;
export const STEP_SIZE = PARTICLE_RADIUS;
// Spawn just outside the current reach, not arbitrarily far — keeps each
// walk short. 4 particle-radii of headroom is enough that a walker
// essentially never spawns already touching something.
export const SPAWN_MARGIN = PARTICLE_RADIUS * 4;
// A walker that wanders this many times its own spawn radius away from its
// spawn center (unbiased 3D random walks are recurrent but slow — most of a
// walk's length is spent wandering, not approaching) is discarded and
// restarted from a fresh spawn point, still drawing from the same
// deterministic stream.
export const KILL_FACTOR = 3;
export const MAX_STEPS_PER_ATTEMPT = 20000;
export const MAX_ATTEMPTS_PER_PIECE = 8000;

function dist(ax, ay, az, bx, by, bz) {
  const dx = ax - bx, dy = ay - by, dz = az - bz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function centroidAndRadius(points) {
  let cx = 0, cy = 0, cz = 0;
  points.forEach(p => { cx += p.x; cy += p.y; cz += p.z; });
  const n = points.length || 1;
  cx /= n; cy /= n; cz /= n;
  let r = 0;
  points.forEach(p => { const d = dist(p.x, p.y, p.z, cx, cy, cz); if (d > r) r = d; });
  return { x: cx, y: cy, z: cz, r };
}

// ─── Growth ─────────────────────────────────────────────────────────────────
// seedPoints: points already fixed in the structure before this call — for
//   seed generation this is just the six anchors; for growth generation this
//   is the seed generation's own full output (six anchors + 68 seed pieces).
//   Never mutated — a fresh copy is returned.
// batches: [{ key, spawnCenter: {x,y,z} | null, pieces: [{ id, sceneKey? }] }]
//   spawnCenter fixed → walkers for this batch's pieces spawn on a sphere
//     around that fixed point, sized to how far *this batch's own* pieces
//     have reached so far (tracked independently per batch, so each of the
//     six anchors stays a legible origin even though collision is global).
//   spawnCenter null → no single natural origin (freeform growth): walkers
//     spawn relative to the *entire current structure's* own centroid and
//     bounding radius, recomputed fresh before every piece, so new material
//     keeps hugging whatever the crystal's actual current extent is.
// salt: seeds one RNG stream shared across every batch and piece, in the
//   order given — the only thing that makes re-running this from scratch
//   after appending a piece reproduce identical positions for everything
//   that already existed is that the stream never depends on what comes
//   after where it currently is.
// Collision is always fully global: every step checks every point placed so
// far, from any batch — this is the actual fix for arms reading as one
// connected structure instead of six separate ones.
export function growPoints({ seedPoints, batches, salt }) {
  const points = seedPoints.map(p => ({ ...p }));
  const rng = mulberry32(hashSeed(salt));
  const localRadius = {};
  batches.forEach(b => { if (b.spawnCenter) localRadius[b.key] = 0; });

  function nearestStuck(x, y, z) {
    let best = null, bestDist = Infinity;
    for (const p of points) {
      const d = dist(p.x, p.y, p.z, x, y, z);
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return { point: best, distance: bestDist };
  }

  batches.forEach(batch => {
    batch.pieces.forEach(piece => {
      let center, spawnRadius;
      if (batch.spawnCenter) {
        center = batch.spawnCenter;
        spawnRadius = localRadius[batch.key] + SPAWN_MARGIN;
      } else {
        const c = centroidAndRadius(points);
        center = c;
        spawnRadius = c.r + SPAWN_MARGIN;
      }
      const killRadius = spawnRadius * KILL_FACTOR;

      let stuck = null, attempts = 0;
      while (!stuck) {
        attempts++;
        if (attempts > MAX_ATTEMPTS_PER_PIECE) {
          throw new Error(`prism DLA: "${piece.id}" in batch "${batch.key}" failed to stick after ${attempts} attempts`);
        }
        const dir0 = randomUnitVector3(rng);
        let x = center.x + dir0.x * spawnRadius;
        let y = center.y + dir0.y * spawnRadius;
        let z = center.z + dir0.z * spawnRadius;

        for (let step = 0; step < MAX_STEPS_PER_ATTEMPT; step++) {
          const { point: nearest, distance } = nearestStuck(x, y, z);
          if (distance <= STICK_DISTANCE) {
            stuck = { x, y, z, parentId: nearest.id };
            break;
          }
          const dir = randomUnitVector3(rng);
          x += dir.x * STEP_SIZE;
          y += dir.y * STEP_SIZE;
          z += dir.z * STEP_SIZE;
          if (dist(x, y, z, center.x, center.y, center.z) > killRadius) break; // restart, same stream
        }
      }

      const p = {
        id: piece.id, sceneKey: piece.sceneKey ?? batch.key, parentId: stuck.parentId,
        x: stuck.x, y: stuck.y, z: stuck.z, isAnchor: false,
      };
      points.push(p);
      if (batch.spawnCenter) {
        const d = dist(p.x, p.y, p.z, batch.spawnCenter.x, batch.spawnCenter.y, batch.spawnCenter.z);
        if (d > localRadius[batch.key]) localRadius[batch.key] = d;
      }
    });
  });

  return { points };
}
