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
         triadOf, place, report } from '../src/scenes/quiz/quiz.text.js';

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
  const want = ['will_mask', 'mind_fate'];
  if (scales.slice().sort().join(',') !== want.slice().sort().join(',')) {
    fail(`the instrument measures [${scales}] — A Vision states the Faculties as Will:Mask and Creative Mind:Body of Fate, and those are the two scales`);
  } else ok('the two scales are Yeats\'s own Faculty pairs, not axes invented here');
  const sizes = [...new Set(scales.map(s => ITEMS.filter(i => i.scale === s).length))];
  if (sizes.length !== 1) fail(`the scales have different item counts (${sizes}) — the two axes would not weigh the same`);
  else ok(`${scales.length} scales, ${sizes[0]} items each, keyed ${sizes[0] / 2} and ${sizes[0] / 2}`);
  if (new Set(ITEMS.map(i => i.id)).size !== ITEMS.length) fail('two items share an id');
  if (!CHOICES.some(c => c.value === 0)) fail('the response scale has no middle, but the sums can still reach zero');

  // ── 5. What the scoring can return ────────────────────────────────────
  // The result depends only on the two normalised sums, so sweeping every
  // reachable sum sweeps the whole 5^16 response space without visiting it.
  const n = ITEMS.filter(i => i.scale === 'will_mask').length * 2;
  const hit = new Set(), rawHit = new Set(), quarters = new Set();
  for (let a = -n; a <= n; a++) {
    for (let b = -n; b <= n; b++) {
      const r = place(a / n, b / n);
      hit.add(r.n); rawHit.add(r.raw);
      if (r.quarter) quarters.add(r.quarter);
    }
  }
  const got = [...hit].sort((x, y) => x - y);
  if (hit.has(1) || hit.has(15)) fail(`the scoring returns ${[...hit].filter(x => x === 1 || x === 15)} — there is no human life at the full or the dark`);
  if (got.join(',') !== [...REACHABLE].sort((x, y) => x - y).join(',')) {
    fail(`the scoring reaches [${got}] but REACHABLE says [${[...REACHABLE].sort((x, y) => x - y)}]`);
  } else ok(`the scoring reaches ${got.length} phases — every one but 1 and 15, the twenty-six cradles`);
  // The poles have to be REACHABLE as raw placements, or the report's line
  // about being set down at the first phase that can hold a life is a branch
  // nothing ever takes.
  if (!rawHit.has(1) || !rawHit.has(15)) fail('the placement can never land on Phase 1 or Phase 15, so the displacement the report announces cannot happen');
  else ok('the placement can land on both uninhabitable phases, and the report says so when it does');
  if (quarters.size !== 4) fail(`the scoring only ever reaches quarters [${[...quarters]}] — a Faculty that can never dominate is a scale that does nothing`);
  else ok('all four quarters are reachable, so each Faculty can dominate');
  if (place(0, 0).n !== 22 || place(0, 0).dominant !== null) {
    fail(`a visitor exactly in the middle gets phase ${place(0, 0).n} with dominant ${place(0, 0).dominant} — at dead centre no Faculty dominates`);
  } else ok('a visitor who ties on both pairs lands at Phase 22 with no dominant Faculty');

  // ── 5b. The Triads ────────────────────────────────────────────────────
  // AV B 92-93: excluding the four phases of crisis, each quarter is six
  // phases, or two sets of three, running power, code, belief. Derived from
  // position here, so what is checked is that the derivation covers every
  // habitable phase exactly once and leaves the Cardinal Phases out.
  {
    let bad = 0;
    const seen = new Map();
    for (const p of PHASES) {
      const t = triadOf(p.n);
      if (CARDINAL.includes(p.n)) { if (t) { fail(`Cardinal Phase ${p.n} has a triad`); bad++; } continue; }
      if (!t) { fail(`phase ${p.n} is in a quarter but has no triad`); bad++; continue; }
      if (!['power', 'code', 'belief'].includes(t.role)) { fail(`phase ${p.n} has triad role "${t.role}"`); bad++; }
      if (t.phases.length !== 3) { fail(`phase ${p.n}'s triad has ${t.phases.length} phases`); bad++; }
      const k = `${t.phases.join('-')}:${t.role}`;
      if (seen.has(k)) { fail(`phases ${seen.get(k)} and ${p.n} are both the ${t.role} of triad ${t.phases.join('-')}`); bad++; }
      seen.set(k, p.n);
    }
    if (!bad) ok('the twenty-four habitable phases fall into eight triads of power, code and belief, and the four Cardinal Phases into none');
  }

  // ── 5c. Every report, for every phase, on every build ─────────────────
  // The reason this check exists, stated plainly: the Cardinal Phases shipped
  // for four releases with the Faculty rectangle collapsed and the report
  // saying nothing about it, and it was found because Scott took the quiz and
  // drew Phase 22. Twenty-six outcomes and one pair of eyes is not coverage.
  //
  // `report()` has no DOM, so all twenty-eight can be built here in a
  // millisecond and inspected — which is the whole reason the assembly was
  // moved out of the renderer.
  {
    const want = ['Number', 'Quarter', 'Triad', 'Tincture', 'Will', 'Mask', 'Creative Mind', 'Body of Fate', 'Symbol'];
    let bad = 0;
    for (const p of PHASES) {
      const habitable = !(p.n === 1 || p.n === 15);
      const r = report({ n: p.n, raw: p.n, displaced: false });
      const labels = r.rows.map(x => x.label);
      for (const w of want) if (!labels.includes(w)) { fail(`phase ${p.n}'s report has no "${w}" row`); bad++; }
      if (new Set(labels).size !== labels.length) { fail(`phase ${p.n}'s report repeats a row label`); bad++; }
      for (const row of r.rows) {
        const text = row.segs.map(x => x.s).join('').trim();
        if (!text) { fail(`phase ${p.n}: the "${row.label}" row is empty`); bad++; }
        if (/undefined|null|NaN|\[object/.test(text)) { fail(`phase ${p.n}: the "${row.label}" row reads "${text}"`); bad++; }
      }
      // The collapse row appears at exactly the four Cardinal Phases, because
      // that is exactly where the rectangle degenerates.
      const collapsed = labels.includes('The rectangle');
      if (collapsed !== CARDINAL.includes(p.n)) {
        fail(`phase ${p.n} ${collapsed ? 'reports' : 'does not report'} a collapsed rectangle, and it is ${CARDINAL.includes(p.n) ? '' : 'not '}a Cardinal Phase`);
        bad++;
      }
      if (habitable !== labels.includes('The failure')) { fail(`phase ${p.n}: characteristic failure ${habitable ? 'missing' : 'present at an uninhabitable phase'}`); bad++; }
      if (!r.name) { fail(`phase ${p.n}'s report has no name`); bad++; }
      if (!r.citeUrl.endsWith(`Ph${p.n}.html`)) { fail(`phase ${p.n} cites ${r.citeUrl}`); bad++; }
      if (!r.announcement.startsWith(`You are Phase ${p.n} of 28.`)) { fail(`phase ${p.n}'s screen-reader line opens "${r.announcement.slice(0, 40)}"`); bad++; }
      if (!r.closers.length || r.closers.some(c => c.some(l => !l.trim()))) { fail(`phase ${p.n} has an empty closing line`); bad++; }
    }
    // And the displacement branch, which only two phases can reach.
    for (const raw of [1, 15]) {
      const r = report({ n: raw === 1 ? 2 : 16, raw, displaced: true });
      if (!r.closers.some(c => c.join(' ').includes(`Phase ${raw}, where there is no human life`))) {
        fail(`a visitor displaced from Phase ${raw} is not told so`);
        bad++;
      }
    }
    if (!bad) ok(`all 28 reports build complete, with the rectangle named at exactly the four Cardinal Phases and both displacement branches reachable`);
  }

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
