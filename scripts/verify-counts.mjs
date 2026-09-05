// ─── Numbers the tree states about itself, against the data ────────────────
// Run with `node scripts/verify-counts.mjs`, and on every build via
// vite.config.js.
//
// The 5.0 punch list's third tier was eighteen findings and one disease: a
// count written into a comment, a header, a doc or a config, correct on the
// day, and then quietly wrong — Sphere saying 320 labels when there are 180
// (in five places, with a sixth right beside them explaining why it is 180),
// Theater saying "all 404 bubbles" from before its third play, "ten scenes"
// surviving in eleven files. Several of them were the stated JUSTIFICATION for
// a decision, which is the part that makes this worth a build step: a number
// nobody can check is a number that gets cited.
//
// So: a small table of things whose real value can be COMPUTED, and a sweep
// for any place the tree writes a different one next to the same noun.
//
// What it deliberately does not do:
//   * Read NOTES.md, or any *.archive.md. Those are history, and history is
//     supposed to say what was true then.
//   * Flag a number inside quotation marks. Quoting a past mistake in order
//     to correct it — which several comments here do — is not a claim.
//   * Guess. Every row below is derived from the data at build time; if a
//     count cannot be computed it does not belong in this file.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { SCENES, TEXT_EXEMPT } from '../src/scenes/registry.js';
import { RESONANCES } from '../src/resonances.js';
import { LINKS } from '../src/links.js';
import { BEATS as theaterBeats } from '../src/scenes/theater/theater.text.js';
import { FILAPIXEL_COUNT } from '../src/scenes/psyshell/psyshell.text.js';
import { libraryItems, cdRackItems } from '../src/scenes/library/library.text.js';

const ROOT = new URL('../', import.meta.url);

// Sphere's face count is not exported — `detail` is a local const inside
// createSphere — so it is read out of the source and the count derived from
// it. PolyhedronGeometry splits each of the icosahedron's 20 base faces into
// (detail+1)^2 triangles; the file itself records the day that was found to be
// (detail+1)^2 and not 4^detail, and five other comments in the same file went
// on saying 320 for another release.
// bardjs's test count, for the one place CI describes its own suite.
function bardTestCount() {
  const src = readFileSync(new URL('packages/bardjs/test/fountain.test.js', ROOT), 'utf8');
  return (src.match(/^\s*test\(/gm) || []).length;
}

function sphereFaceCount() {
  const src = readFileSync(new URL('src/scenes/sphere/sphere.js', ROOT), 'utf8');
  const m = src.match(/^\s*const detail = (\d+);/m);
  return m ? 20 * (Number(m[1]) + 1) ** 2 : null;
}

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20,
};

// Each row: the value, computed; the PHRASES that state it as a whole, exactly
// as this tree writes them; and a short name for the message.
//
// Phrases, not bare nouns, and that is the whole design. A first version
// matched "<number> scenes" and produced 95 hits, nearly all of them correct
// English about a subset — "two scenes use this helper", "seven scenes set
// position/overflow", "nine other WebGL scenes do this". A check that cries
// wolf is a check that gets routed around, which is the failure this file
// exists to prevent rather than commit. So each row lists the ways the tree
// actually claims a TOTAL, and anything else is left alone.
const CLAIMS = [
  {
    name: 'scenes',
    value: Object.keys(SCENES).length,
    phrases: [
      // Deliberately NOT /the (\S+) scenes/: "the four scenes that ...", "the
      // two scenes with sound" are correct English about a subset, and this
      // tree is full of them.
      /all (\S+) scenes\b/, /(\S+) scenes on (?:this|the) site\b/,
      /(\S+) scenes total\b/, /(\S+) scenes in the registry\b/, /every one of the (\S+) scenes\b/,
      /site's (\S+) scenes\b/, /(\S+) scenes now\b/, /now (\S+) scenes\b/,
    ],
  },
  {
    name: 'prerendered /text/ pages',
    value: Object.keys(SCENES).length - Object.keys(TEXT_EXEMPT).length + 1, // +1: the /text/ index
    phrases: [/(\S+) prerendered pages?\b/, /prerenders? (\S+) pages?\b/, /all (\S+) (?:published |text )?pages\b/],
  },
  {
    name: 'text-exempt scenes',
    value: Object.keys(TEXT_EXEMPT).length,
    phrases: [/(\S+) exempt with a stated reason\b/],
  },
  {
    name: 'resonance rows',
    value: RESONANCES.length,
    phrases: [/all (\S+) rows\b/, /(\S+) approved rows\b/, /a (\S+)-row corpus\b/, /(\S+) rows in resonances\.js\b/],
  },
  {
    name: 'cross-links',
    value: LINKS.length,
    phrases: [/Links \((\S+) rows\)/, /(\S+) link rows\b/, /all (\S+) links\b/],
  },
  {
    name: "the Theater's beats",
    value: theaterBeats.length,
    phrases: [/all (\S+) bubbles\b/, /(\S+) beats in the reel\b/, /the reel's (\S+) beats\b/, /of the (\S+) beats\b/],
  },
  {
    name: 'filapixels',
    value: FILAPIXEL_COUNT,
    phrases: [/(\S+) filapixels\b/, /(\S+) sentences on this site\b/, /encode (\S+) sentences\b/, /(\S+) rays\b/],
  },
  {
    name: "Sphere's faces (and so its labels)",
    value: sphereFaceCount(),
    phrases: [
      /(\S+) real text nodes\b/, /(\S+) truncated sentence fragments\b/,
      /(\S+) CSS2DObject labels\b/, /(\S+) labels\)/, /(\S+) children of a mesh\b/,
      /(\S+) of these run\b/, /(\S+) hard white excerpts\b/, /= (\S+) faces\b/,
    ],
  },
  {
    name: "bardjs's tests",
    value: bardTestCount(),
    // The claim spans a line break in deploy.yml ("Its 16\n # node --test
    // tests"), so this one is matched against the whole file rather than a
    // line at a time — see the `multiline` flag below.
    phrases: [/Its (\S+)[\s\S]{0,40}node --test tests\b/],
    multiline: true,
  },
  {
    name: 'library CDs',
    value: cdRackItems.length,
    phrases: [/(\S+) CDs\b(?! (?:in the rack|it))/],
  },
  {
    name: 'library books',
    value: libraryItems.filter(i => i.type === 'book').length,
    // Same subset caveat as `scenes`: "two books sharing one palette colour"
    // is about a pair, not about the shelf. Only the shelf-total phrasings.
    phrases: [/(\S+) books on the shelf\b/, /shelf's (\S+) books\b/, /all (\S+) books\b/, /(\S+) books,? (\S+) films\b/],
  },
];


// Where a stale number is a live claim. NOTES.md and anything *.archive.md are
// excluded on purpose — see the header.
const ROOTS = ['src', 'scripts', 'styles', 'packages', 'docs', '.github'];
const FILES = ['index.html', 'vite.config.js', 'public/.htaccess', 'STANDARDS.md', 'SITE.md', 'WORKING-PROTOCOL.md', 'README.md'];
const EXT = /\.(js|mjs|css|html|md|yml|yaml|txt|htaccess)$|(^|\/)\.htaccess$/;
const SKIP_FILE = /(^|\/)(NOTES|CHANGELOG|CORRECTED-FACTS|WORKING-COPY)[\w.-]*\.md$|\.archive\.md$|(^|\/)node_modules(\/|$)|(^|\/)dist(\/|$)|(^|\/)PUNCH-LIST-5\.0\.md$|(^|\/)NOTES-/;

function walk(rel, out = []) {
  let st;
  try { st = statSync(new URL(rel, ROOT)); } catch { return out; }
  if (st.isFile()) { if (!SKIP_FILE.test(rel) && EXT.test(rel)) out.push(rel); return out; }
  for (const e of readdirSync(new URL(rel + '/', ROOT))) walk(`${rel}/${e}`, out);
  return out;
}

// A number written inside quotes is being QUOTED, not claimed — several
// comments here quote a past mistake in order to correct it, and correcting a
// mistake should not trip a check.
//
// Double quotes, smart quotes and backticks only. NOT apostrophes: this tree's
// prose is full of possessives ("the Theater scene's whole timing engine"), and
// treating ' as an opening quote makes every sentence between two possessives
// look quoted — which silently swallowed the one claim that spans a line break.
const quotedSpans = (text) => {
  const spans = [];
  for (const m of text.matchAll(/"[^"\n]*"|“[^”\n]*”|`[^`\n]*`/g)) spans.push([m.index, m.index + m[0].length]);
  return spans;
};

export function verifyCounts() {
  const log = [];
  const say = (...a) => log.push(a.join(' '));
  const problems = [];
  const files = [...ROOTS.flatMap(r => walk(r)), ...FILES.filter(f => !SKIP_FILE.test(f))];

  let checked = 0;
  for (const rel of files) {
    let text;
    try { text = readFileSync(new URL(rel, ROOT), 'utf8'); } catch { continue; }
    const lines = text.split('\n');
    for (const claim of CLAIMS) {
      for (const phrase of claim.phrases) {
        const re = new RegExp(phrase.source, 'gi');
        // Most claims sit on one line. A few (a wrapped YAML comment) do not,
        // and those say so; for them the whole file is one "line".
        const units = claim.multiline
          ? [text]
          : lines;
        units.forEach((line, i) => {
          const quotes = quotedSpans(line);
          for (const m of line.matchAll(re)) {
            if (quotes.some(([a, b]) => m.index >= a && m.index < b)) continue;
            // The slot has to hold a number and nothing else. A phrase whose
            // slot caught a word ("all other scenes") or a comment marker
            // ("// CDs") is prose, not a claim — and `Number('')` is 0, so
            // this has to be checked before any coercion rather than after.
            const raw = String(m[1]).toLowerCase().replace(/[.,;:]+$/, '');
            const n = /^\d[\d,]*$/.test(raw) ? Number(raw.replace(/,/g, '')) : NUMBER_WORDS[raw];
            if (!Number.isFinite(n)) continue;
            checked++;
            if (n !== claim.value) {
              const where = claim.multiline ? rel : `${rel}:${i + 1}`;
              problems.push(`${where} says "${m[0].trim().replace(/\s+/g, ' ')}" — ${claim.name} is ${claim.value}`);
            }
          }
        });
      }
    }
  }

  if (problems.length) {
    say(`\ncounts: ${problems.length} claim(s) the data disagrees with:`);
    for (const p of problems) say(`  ${p}`);
  } else {
    say(`ok: all ${checked} stated counts across ${files.length} files match the data`);
  }
  return { ok: problems.length === 0, failures: problems.length, log };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { ok, log } = verifyCounts();
  log.forEach(l => console.log(l));
  if (!ok) process.exit(1);
}
