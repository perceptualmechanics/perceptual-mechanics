// ─── The corpus, counted rather than remembered ────────────────────────────
//   node scripts/corpus-figures.mjs
//
// SITE.md carries the site's own figures about itself — sentences, words,
// pieces, and each scene's share — and until 6.0.4 they were measured once by
// hand and typed in. They were correct on the day and then Quiz added a scene
// and every one of them was wrong at the same instant, silently, in the
// document a session reads before it starts counting.
//
// This prints them. It is a BENCH and not a gate: the narrow figures are
// asserted at import inside psyshell.text.js and checked by verify-counts, so
// a gate here would be a third copy of a check that already fails the build.
// What SITE.md needs is not another assertion, it is a command to run.
//
// Note which ruler this is. It is the NARROW one: `src/utils/corpus.js`, the
// fields that reader treats as writing, which is what Psyshell is built from.
// SITE.md's wider "published words" figure counts material this reader never
// sees (the Library's bibliographic entries, scene slugs, stage directions) and
// is not computed here — see SITE.md, which states both with their rulers.
import { readCorpus, flatSentences, wordCount } from '../src/utils/corpus.js';
import { SCENES } from '../src/scenes/registry.js';
import * as scroll from '../src/scenes/scroll/scroll.text.js';
import * as theater from '../src/scenes/theater/theater.text.js';
import * as sphere from '../src/scenes/sphere/sphere.text.js';
import * as library from '../src/scenes/library/library.text.js';
import * as orbiter from '../src/scenes/orbiter/orbiter.text.js';
import * as apollo from '../src/scenes/apollo/apollo.text.js';
import * as beamline from '../src/scenes/beamline/beamline.text.js';
import * as orrery from '../src/scenes/orrery/orrery.text.js';
import * as butterfly from '../src/scenes/butterfly/butterfly.text.js';
import * as quiz from '../src/scenes/quiz/quiz.text.js';

const MODULES = { scroll, theater, sphere, library, orbiter, apollo, beamline, orrery, butterfly, quiz };
const corpus = readCorpus(MODULES);
const flat = flatSentences(corpus);

const rows = flat.map(c => ({
  key: c.key,
  sentences: c.sentences.length,
  words: c.sentences.reduce((a, s) => a + wordCount(s), 0),
  pieces: corpus.find(x => x.key === c.key)?.pieces.length ?? 0,
})).filter(r => r.sentences > 0);

const total = rows.reduce((a, r) => ({
  sentences: a.sentences + r.sentences, words: a.words + r.words, pieces: a.pieces + r.pieces,
}), { sentences: 0, words: 0, pieces: 0 });

const n = (x) => x.toLocaleString('en-US');
console.log(`\ncorpus (src/utils/corpus.js — the narrow ruler)`);
console.log(`  ${n(total.sentences)} sentences, ${n(total.words)} words, in ${n(total.pieces)} pieces across ${rows.length} scenes`);
console.log(`  of ${Object.keys(SCENES).length} scenes in the registry; the rest publish nothing of their own\n`);

console.log('  scene        pieces  sentences    words    share');
for (const r of [...rows].sort((a, b) => b.words - a.words)) {
  const share = total.words ? (r.words / total.words) * 100 : 0;
  console.log(`  ${r.key.padEnd(12)} ${String(r.pieces).padStart(6)} ${String(r.sentences).padStart(10)} ${n(r.words).padStart(8)}  ${share.toFixed(1).padStart(6)}%`);
}
const silent = Object.keys(SCENES).filter(k => !rows.some(r => r.key === k));
console.log(`\n  publishing nothing of their own: ${silent.join(', ') || '(none)'}`);
