// ─── Quiz's Wheel, checked against Yeats rather than against itself ─────────
// Run with `node scripts/quiz-wheel.mjs`, and on every build via
// vite.config.js. This is a GATE, not a bench: everything it asserts is a
// statement quiz.text.js's own comments make, and a comment that states an
// invariant it does not check is exactly what the 6.0 pass spent itself on.
//
// The distinction that matters here is between self-consistency and being
// right. quiz.text.js derives each phase's Faculties from three formulas —
// Mask = will + 14, Creative Mind = 30 - will, Body of Fate = 16 - will — and
// a derivation is always self-consistent. What makes it Yeats's is that it
// reproduces the eight groups he published, which are written out below AS
// PUBLISHED and not computed. That is the second source, and without it this
// file would only be checking that arithmetic is arithmetic.
import { PHASES, PHASE_BY_N, ITEMS, CHOICES, REACHABLE, QUARTERS, CARDINAL,
         maskPhase, creativeMindPhase, bodyOfFatePhase, quarterOf, tinctureOf,
         place } from '../src/scenes/quiz/quiz.text.js';

// yeatsvision.com/Wheel.html, "These eight configurations or groups, six of
// four and the two pairs of Cardinal Phases, are set out in the table below."
// Typed from the page, not generated.
const PUBLISHED_GROUPS = [
  [1, 15], [2, 14, 16, 28], [3, 13, 17, 27], [4, 12, 18, 26],
  [5, 11, 19, 25], [6, 10, 20, 24], [7, 9, 21, 23], [8, 22],
];

export function verifyQuizWheel() {
  const log = [];
  let failures = 0;
  const fail = m => { failures++; log.push(`FAIL: ${m}`); };
  const ok = m => log.push(`ok: ${m}`);

  // ── 1. Twenty-eight phases, numbered 1..28, once each ─────────────────
  const ns = PHASES.map(p => p.n);
  if (PHASES.length !== 28) fail(`the Wheel has ${PHASES.length} phases, not 28`);
  for (let i = 1; i <= 28; i++) {
    if (ns.filter(n => n === i).length !== 1) fail(`phase ${i} appears ${ns.filter(n => n === i).length} times`);
  }
  if (!failures) ok('the Wheel carries 28 phases, each numbered once');

  // ── 2. The derived Faculties reproduce the published groups ───────────
  let groupBad = 0;
  for (const p of PHASES) {
    const derived = [...new Set([p.n, maskPhase(p.n), creativeMindPhase(p.n), bodyOfFatePhase(p.n)])].sort((a, b) => a - b);
    const published = PUBLISHED_GROUPS.find(g => g.includes(p.n));
    if (!published) { fail(`phase ${p.n} is in none of the published groups`); groupBad++; continue; }
    if (derived.join(',') !== published.join(',')) {
      fail(`phase ${p.n}: Mask/Creative Mind/Body of Fate derive the group [${derived}], the published group is [${published}]`);
      groupBad++;
    }
  }
  if (!groupBad) ok(`all 28 phases derive the group A Vision publishes for them, from three formulas and no table`);

  // Reciprocity: if this phase draws its Mask from that one, that one draws
  // its Mask from this one. Yeats states it and the arithmetic has to have it.
  let recip = 0;
  for (const p of PHASES) {
    if (maskPhase(maskPhase(p.n)) !== p.n) { fail(`Mask is not reciprocal at phase ${p.n}`); recip++; }
    if (creativeMindPhase(creativeMindPhase(p.n)) !== p.n) { fail(`Creative Mind is not reciprocal at phase ${p.n}`); recip++; }
    if (bodyOfFatePhase(bodyOfFatePhase(p.n)) !== p.n) { fail(`Body of Fate is not reciprocal at phase ${p.n}`); recip++; }
  }
  if (!recip) ok('every Faculty relation is its own inverse, as A Vision states');

  // ── 3. Quarters and Cardinal Phases partition the Wheel ───────────────
  const inQuarter = QUARTERS.flatMap(q => q.phases);
  const covered = [...inQuarter, ...CARDINAL].sort((a, b) => a - b);
  if (covered.join(',') !== Array.from({ length: 28 }, (_, i) => i + 1).join(',')) {
    fail(`the four Quarters plus the Cardinal Phases cover [${covered}] rather than 1..28 exactly once`);
  } else ok('the four Quarters hold six phases each and the four Cardinal Phases sit outside them');
  for (const n of CARDINAL) if (quarterOf(n)) fail(`Cardinal Phase ${n} is inside ${quarterOf(n).name}`);

  // The crossings and the poles, as Tinctures.html gives them.
  const tinct = { 1: 'wholly primary', 15: 'wholly antithetical', 8: 'the crossing', 22: 'the crossing' };
  for (const [n, want] of Object.entries(tinct)) {
    if (tinctureOf(Number(n)) !== want) fail(`phase ${n} is "${tinctureOf(Number(n))}", should be "${want}"`);
  }
  if (tinctureOf(9) !== 'antithetical' || tinctureOf(21) !== 'antithetical' ||
      tinctureOf(23) !== 'primary' || tinctureOf(7) !== 'primary') {
    fail('the tincture halves do not run 8→22 antithetical and 22→8 primary');
  } else ok('the tinctures cross at 8 and 22, with the poles at 1 and 15');

  // ── 4. The instrument ─────────────────────────────────────────────────
  const scales = [...new Set(ITEMS.map(i => i.scale))];
  for (const s of scales) {
    const items = ITEMS.filter(i => i.scale === s);
    const pos = items.filter(i => i.key > 0).length;
    const neg = items.filter(i => i.key < 0).length;
    if (pos !== neg) fail(`scale "${s}" is keyed ${pos} positive against ${neg} negative — an acquiescent visitor drifts`);
    if (items.length % 2) fail(`scale "${s}" has ${items.length} items, which cannot key evenly`);
  }
  const sizes = [...new Set(scales.map(s => ITEMS.filter(i => i.scale === s).length))];
  if (sizes.length !== 1) fail(`the scales have different item counts (${sizes}) — the two axes would not weigh the same`);
  else ok(`${scales.length} scales, ${sizes[0]} items each, keyed ${sizes[0] / 2} and ${sizes[0] / 2}`);
  if (new Set(ITEMS.map(i => i.id)).size !== ITEMS.length) fail('two items share an id');
  if (!CHOICES.some(c => c.value === 0)) fail('the response scale has no middle, but the sums can still reach zero');

  // ── 5. What the scoring can return ────────────────────────────────────
  // The result depends only on the two normalised sums, so sweeping every
  // reachable sum sweeps the whole 5^16 response space without visiting it.
  const n = ITEMS.filter(i => i.scale === 'tincture').length * 2;
  const hit = new Set();
  for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) hit.add(place(a / n, b / n));
  const got = [...hit].sort((x, y) => x - y);
  if (hit.has(1) || hit.has(15)) fail(`the scoring can place a visitor at ${[...hit].filter(x => x === 1 || x === 15)} — there is no human life at the full or the dark`);
  if (got.join(',') !== [...REACHABLE].sort((x, y) => x - y).join(',')) {
    fail(`the scoring reaches [${got}] but REACHABLE says [${REACHABLE}]`);
  } else ok(`the scoring reaches ${got.length} phases — every one but 1 and 15, the twenty-six cradles`);
  if (place(0, 0) !== 22) fail(`a visitor exactly in the middle lands at phase ${place(0, 0)}, not at the balance between ambition and contemplation`);
  else ok('a visitor who ties on both scales lands at Phase 22');

  // ── 6. Every phase resolves ───────────────────────────────────────────
  let unresolved = 0;
  for (const p of PHASES) {
    for (const f of [maskPhase, creativeMindPhase, bodyOfFatePhase]) {
      if (!PHASE_BY_N[f(p.n)]) { fail(`phase ${p.n} draws a Faculty from ${f(p.n)}, which is not a phase`); unresolved++; }
    }
    const habitable = p.n !== 1 && p.n !== 15;
    if (habitable && !(p.mask && p.cm && p.bf)) { fail(`phase ${p.n} is habitable but has no Faculty attributes`); unresolved++; }
    if (!habitable && (p.mask || p.cm || p.bf)) { fail(`phase ${p.n} is uninhabitable but carries Faculty attributes`); unresolved++; }
    if (!p.symbol) { fail(`phase ${p.n} has no symbol`); unresolved++; }
  }
  if (!unresolved) ok('every phase resolves its three Faculties, and only 1 and 15 are without attributes');

  log.forEach(l => console.log(l));
  console.log('');
  if (failures) console.log(`${failures} check(s) failed.`);
  else console.log('All checks passed.');
  return { ok: failures === 0, failures, log };
}

if (import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  const { ok } = verifyQuizWheel();
  process.exit(ok ? 0 : 1);
}
