// ─── SHELVED, 4.10.1 — nothing imports this file ───────────────────────────
// Same status as `src/scenes/spectra/` and for the same kind of reason: this
// is real, correct, measured work that is deliberately out of the build. It is
// not imported by `src/main.js`, not imported by `scripts/prerender.js`, and
// therefore not in any bundle — Vite never sees it.
//
// WHAT IT WAS. 4.10.0 replaced the landing grid with a field: twelve scenes on
// one plane, each at a position measured from its own rendered frames, settling
// out of a sorted block the way a two-gas box mixes. It shipped, it worked, and
// it was reverted one release later — not because it failed but because the
// problem it solved is not here yet. Twelve tiles in two rows is fine. Twenty
// would be a problem, and the last two days established that the ceiling on
// scene count is the quality bar, not the layout.
//
// WHEN TO UNSHELVE. When the tiles get too small to read — that is the
// condition, and it is a thing you can look at rather than a judgement call.
// The revert was cheap in the first place because the field was a layout over
// the existing list rather than a replacement for it (the markup never
// changed), so bringing it back is `git show v4.10.0` for main.js's field
// block and main.css's `.is-field` rules, plus re-importing this file.
//
// WHAT IS STILL TRUE HERE. The measurements below and the reasoning in the
// header that follows. Re-measuring costs about 54 minutes of harness time, so
// the numbers are kept rather than re-derived. They describe the scenes as of
// v4.9.0 — **a scene reworked hard enough to change how busy it looks needs
// re-measuring**, and no gate can detect that, because these are measurements
// of frames rather than derivations from the code.
//
// The two findings that outlived the feature are in the knowledge base, not
// here: the word-count correlation is in SITE.md, and the entropy negative
// result is in SITE.md and CORRECTED-FACTS.md.

// ─── The field: where each scene sits, and why ──────────────────────────────
// The landing page stops being a grid at 4.10.0. A grid asserts that all
// twelve scenes are the same kind of thing, equally weighted and equally
// sized; that was true at five and is already slightly false at twelve. This
// file holds what replaces the assertion: two measured properties per scene,
// and the arithmetic that turns them into a position.
//
// NO DOM AND NO THREE.JS IN THIS FILE. While it shipped, `scripts/prerender.js`
// imported it to gate the measurements against the registry at build time,
// exactly as it does for the corpus — a scene added without a position failed
// the build rather than quietly landing at the origin. That gate came out with
// the feature: a build gate enforcing completeness for something nothing
// renders is dead weight that looks load-bearing. It goes back in with the
// import if this is ever unshelved.
//
// ─── What was measured, and with what ruler ─────────────────────────────────
// Both axes come from rendered frames, sampled 2026-09-04 at v4.9.0. Every
// scene: same viewport (560 x 344 below the nav), same seeded Math.random,
// same scene-time — 30 boot frames, 2.0s discarded, then twelve frames at 0.1s
// and five at 1.0s, every scene finishing at exactly 8.60s of its own time.
// The clock was driven, not waited on: under software rasterization a frame of
// Sphere costs about 570ms, so a harness sampling on wall-clock measures its
// own latency (see STANDARDS.md, "Sampling a scene").
//
//   hf   The share of a frame's spectral power above a quarter of Nyquist,
//        Hann-windowed, mean of twelve frames. Percent. Spatial complexity:
//        how much fine structure is in the picture.
//   mad  Mean absolute grayscale difference between frames 0.1 SCENE-seconds
//        apart, mean of eleven pairs. 0..1. Motion: how much the picture
//        changes.
//
// ─── Why these two, and not the two the brief proposed ──────────────────────
// The first axis proposed was Shannon entropy of each scene's published
// writing. It was measured three ways and dropped, and the reasons are worth
// keeping because they are the kind that get re-proposed:
//
//   - Character-level entropy spans 0.109 bits across the nine publishing
//     scenes (4.161 to 4.270). The stated threshold for "this ruler is noise"
//     was 0.1 bits.
//   - Every whole-scene ruler turned out to be word count. Correlation with
//     log(word count): word-level +0.965, conditional H2 +0.959, conditional
//     H3 +0.979, gzip -0.857.
//   - Corrected by rarefaction to a common 250-word sample it survives, and
//     then places EIGHT OF TWELVE scenes. Harmonics, Outside and Psyshell
//     publish no sentences; Butterfly publishes six words, which no correction
//     can turn into an entropy estimate. An axis that cannot place a third of
//     the set is not an axis.
//
// The failure produced a better fact than the axis would have. Word COUNT
// predicts visual disorder strongly and negatively — hf r = -0.862, mad
// r = -0.798 across the nine publishing scenes. The scenes with more writing
// are the stiller, smoother ones: a scene you read holds still. That is
// recorded in SITE.md as a fact about the site, true whether or not anything
// is built on it. It is also why the length correction was load-bearing rather
// than fastidious: an entropy axis still carrying length would have collapsed
// this field onto a diagonal, and the diagonal would have looked like a
// finding.
//
// ─── Why the two axes are allowed to share a plane ──────────────────────────
// They are independent, which was the gate the whole idea had to clear:
// Spearman +0.38 at p = 0.23 between hf and mad across all twelve. Complexity
// and motion are separate properties and the scenes prove it — Scroll is
// structurally busy and almost perfectly still, Sphere is the smoothest frame
// on the site and one of the most active. Within each property the candidate
// rulers agree and collapse to one (hf against the spectral slope is -0.87;
// the three motion measures agree at about +0.90), so there are two rulers
// here and not six.
export const FIELD = [
  { key: 'sphere',    hf:  1.0293, mad: 0.007629 },
  { key: 'butterfly', hf: 60.5166, mad: 0.043210 },
  { key: 'scroll',    hf:  9.3880, mad: 0.000379 },
  { key: 'theater',   hf:  3.6037, mad: 0.002139 },
  { key: 'orbiter',   hf: 16.2655, mad: 0.001850 },
  { key: 'orrery',    hf: 40.0450, mad: 0.000347 },
  { key: 'library',   hf:  4.8922, mad: 0.000164 },
  { key: 'beamline',  hf: 10.7243, mad: 0.008940 },
  { key: 'apollo',    hf: 23.2025, mad: 0.001661 },
  { key: 'harmonics', hf: 57.1032, mad: 0.004003 },
  { key: 'outside',   hf:  2.8572, mad: 0.000224 },
  { key: 'psyshell',  hf: 38.8747, mad: 0.013034 },
];

// Both rulers span more than two orders of magnitude (hf 1.03 to 60.5, mad
// 0.00016 to 0.0432), so both are placed on a log scale. On a linear scale
// nine of the twelve would pile into the bottom-left tenth of the plane and
// the arrangement would say nothing — which is a property of the measurements,
// not a presentational preference, and is why the transform is named here
// rather than applied silently at draw time.
const MAD_FLOOR = 1e-5;   // below any measured value; keeps log() finite
const lx = v => Math.log10(v);
const ly = v => Math.log10(Math.max(v, MAD_FLOOR));

function normalize(values) {
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  return values.map(v => (v - lo) / span);
}

// [{ key, x, y }] with x and y in 0..1. x is spatial complexity, y is motion,
// both increasing. Nothing here knows about screens.
export const COORDS = (() => {
  const xs = normalize(FIELD.map(f => lx(f.hf)));
  const ys = normalize(FIELD.map(f => ly(f.mad)));
  return FIELD.map((f, i) => ({ key: f.key, x: xs[i], y: ys[i] }));
})();

// ─── Collision, and the size of the lie ─────────────────────────────────────
// Real scenes land near each other. On this plane one pair genuinely collides
// — Orbiter and Apollo at 0.063 of the diagonal — with Library/Outside next at
// 0.101 and the remaining sixty-four pairs clear; the median pair distance is
// 0.403. Repulsion separates them, and **a repelled tile is not where its
// measurements put it**. That is a departure from true position and it is
// named, the same way Psyshell's Murray exponent is named rather than left to
// look like a derivation.
//
// The relaxation is deliberately weak and deliberately anchored: each pass
// pushes overlapping pairs apart by half their overlap and then pulls every
// tile a fraction of the way back toward its true position, so the result is
// the nearest non-overlapping arrangement rather than an arbitrary packing.
// `maxShift` comes back with the answer so the caller can report — or a build
// gate can assert — how far the worst tile actually moved.
export function relax(points, { minDist, width, height, pad, passes = 60, anchor = 0.06 }) {
  const p = points.map(q => ({ ...q, px: q.px, py: q.py }));
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        let dx = p[j].px - p[i].px, dy = p[j].py - p[i].py;
        let d = Math.hypot(dx, dy);
        if (d >= minDist) continue;
        // Exactly coincident points have no direction to separate along.
        // Deterministic tie-break by index, so the same pair always parts the
        // same way and the field is the same field on every visit.
        if (d < 1e-6) { dx = (j - i); dy = 0; d = Math.abs(dx); }
        const push = (minDist - d) / 2 / d;
        p[i].px -= dx * push; p[i].py -= dy * push;
        p[j].px += dx * push; p[j].py += dy * push;
      }
    }
    for (const q of p) {
      q.px += (q.tx - q.px) * anchor;
      q.py += (q.ty - q.py) * anchor;
      q.px = Math.min(width - pad, Math.max(pad, q.px));
      q.py = Math.min(height - pad, Math.max(pad, q.py));
    }
  }
  // The anchor and the push reach a standoff, so the loop above settles a few
  // pixels SHORT of actually separating the closest pair — measured at 0 to 3px
  // of clearance where minDist asks for 8. A short separation-only tail
  // satisfies the constraint exactly. It runs last, so it also gets the final
  // word over the clamp, and it is a handful of passes rather than a stronger
  // push so that it does not undo the anchoring it follows.
  for (let pass = 0; pass < 8; pass++) {
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        let dx = p[j].px - p[i].px, dy = p[j].py - p[i].py;
        let d = Math.hypot(dx, dy);
        if (d >= minDist) continue;
        if (d < 1e-6) { dx = (j - i); dy = 0; d = Math.abs(dx); }
        const push = (minDist - d) / 2 / d;
        p[i].px -= dx * push; p[i].py -= dy * push;
        p[j].px += dx * push; p[j].py += dy * push;
      }
    }
    for (const q of p) {
      q.px = Math.min(width - pad, Math.max(pad, q.px));
      q.py = Math.min(height - pad, Math.max(pad, q.py));
    }
  }
  let maxShift = 0;
  for (const q of p) maxShift = Math.max(maxShift, Math.hypot(q.px - q.tx, q.py - q.ty));
  return { points: p, maxShift };
}

// ─── Placing the field in a box ─────────────────────────────────────────────
// The plane is stretched to the container rather than letterboxed square, and
// that is a real departure worth stating: on a phone the box is much taller
// than it is wide, so a step along x is worth fewer pixels than the same step
// along y. Euclidean distance on screen is therefore not proportional to
// distance in the measurements.
//
// The cost is smaller than it first looks, because the two axes were never
// commensurable anyway — one is a share of spectral power, the other a
// grayscale difference per unit time, and no rate of exchange between them
// exists to preserve. What survives at every aspect is the thing the
// arrangement is actually for: ordering along each axis, and which scenes are
// near which. Letterboxing to a square was tried first and rejected: it threw
// away a third of the room on a laptop and made every tile smaller for a
// distance metric that was never metric.
export function placeField({ width, height, tile, gap = 8 }) {
  const pad = tile / 2 + 4;
  const w = Math.max(1, width - 2 * pad), h = Math.max(1, height - 2 * pad);
  const seeded = COORDS.map(c => {
    const tx = pad + c.x * w;
    // y inverted: more motion is higher on screen, which is the direction
    // every reader expects and the direction the axis label has to claim.
    const ty = pad + (1 - c.y) * h;
    return { key: c.key, tx, ty, px: tx, py: ty };
  });
  return relax(seeded, { minDist: tile + gap, width, height, pad });
}
