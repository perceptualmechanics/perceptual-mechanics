// ─── Seeded PRNG ────────────────────────────────────────────────────────────
// Small, deterministic random-number helpers shared by every scene that
// needs "the same random sequence every load" rather than genuine
// randomness — grid-bug wander paths and sky motes in beamline.js, for
// instance. Pure math, no THREE.js, no DOM — runs identically in Node and
// in the browser.
//
// Originally lived in dla.js alongside the diffusion-limited-aggregation
// growth code that used to power the Prism scene (a random walker takes
// fixed-length steps in a random direction until it sticks to existing
// structure — real algorithm, not hand-placed geometry). Prism never landed
// after two full attempts and was retired for good 2026-08-07; the growth
// machinery (growPoints, randomUnitVector3, and the DLA-specific constants)
// left with it, since nothing else in the codebase ever called them. These
// two functions are the part that outlived it.

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
