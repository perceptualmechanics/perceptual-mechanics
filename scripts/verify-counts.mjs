import { readFileSync, readdirSync, statSync } from 'node:fs';
import { SCENES, TEXT_EXEMPT } from '../src/scenes/registry.js';
import { RESONANCES } from '../src/resonances.js';
import { LINKS } from '../src/links.js';
import { BEATS as theaterBeats } from '../src/scenes/theater/theater.text.js';
import { BOUNCES } from '../src/scenes/beamline/beamline.text.js';
import { FIELD } from '../src/utils/sceneField.js';
import { FILAPIXEL_COUNT } from '../src/scenes/psyshell/psyshell.text.js';
import { libraryItems, cdRackItems } from '../src/scenes/library/library.text.js';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url);

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

const CLAIMS = [
  {
    name: 'scenes',
    value: Object.keys(SCENES).length,
    phrases: [
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
    phrases: [/Its (\S+)[\s\S]{0,40}node --test tests\b/],
    multiline: true,
  },
  {
    name: 'library CDs',
    value: cdRackItems.length,
    phrases: [/(\S+) CDs\b(?! (?:in the rack|it))/],
  },
  {
    name: "sceneField's measured scenes",
    value: FIELD.length,
    phrases: [/all (\S+) measured scenes\b/, /(\S+) of the (?<n>\S+) measured scenes\b/],
  },
  {
    name: "the Beamline's fragments",
    value: BOUNCES.length,
    phrases: [/(\S+) fragments total\b/, /all (\S+) bounces\b/, /(\S+) station waypoints\b/],
  },
  {
    name: "the Beamline's found passages",
    value: new Set(BOUNCES.map(b => b.passage)).size,
    phrases: [/(\S+) found passages\b/],
  },
  {
    name: 'library films',
    value: libraryItems.filter(i => i.type === 'bluray').length,
    phrases: [/(\S+) books,? (?<n>\S+) films\b/, /all (\S+) films\b/],
  },
  {
    name: 'library divination decks',
    value: libraryItems.filter(i => i.type === 'divination_box').length,
    phrases: [/(\S+) divination decks\b/],
  },
  {
    name: 'library CD artists',
    value: new Set(cdRackItems.map(c => c.artist)).size,
    phrases: [/(\S+) albums,? (?<n>\S+) artists\b/, /all (\S+) artists\b/],
  },
  {
    name: 'library books',
    value: libraryItems.filter(i => i.type === 'book').length,
    phrases: [/(\S+) books on the shelf\b/, /shelf's (\S+) books\b/, /all (\S+) books\b/, /(\S+) books,? (\S+) films\b/],
  },
];


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

const quotedSpans = (text) => {
  const spans = [];
  for (const m of text.matchAll(/"[^"\n]*"|“[^”\n]*”|`[^`\n]*`/g)) spans.push([m.index, m.index + m[0].length]);
  return spans;
};

function commentBlocks(lines) {
  const out = [];
  let buf = null;
  const isComment = (l) => /^\s*(\/\/|#|\*)/.test(l);
  lines.forEach((l, i) => {
    if (isComment(l)) {
      const body = l.replace(/^\s*(\/\/+|#+|\*)\s?/, '');
      if (buf) { buf.text += ' ' + body; buf.lines++; } else { buf = { start: i, text: body, lines: 1 }; }
    } else if (buf) { out.push(buf); buf = null; }
  });
  if (buf) out.push(buf);
  return out.filter(b => b.lines > 1);
}

export function verifyCounts() {
  const log = [];
  const say = (...a) => log.push(a.join(' '));
  const problems = [];
  const files = [...ROOTS.flatMap(r => walk(r)), ...FILES.filter(f => !SKIP_FILE.test(f))];

  let checked = 0;
  const seen = new Set();
  for (const rel of files) {
    let text;
    try { text = readFileSync(new URL(rel, ROOT), 'utf8'); } catch { continue; }
    const lines = text.split('\n');
    for (const claim of CLAIMS) {
      for (const phrase of claim.phrases) {
        const re = new RegExp(phrase.source, 'gi');
        const units = [
          ...lines.map((text, i) => ({ text, line: i + 1 })),
          ...commentBlocks(lines).map(b => ({ text: b.text, line: b.start + 1 })),
        ];
        for (const unit of units) {
          const quotes = quotedSpans(unit.text);
          for (const m of unit.text.matchAll(re)) {
            if (quotes.some(([a, b]) => m.index >= a && m.index < b)) continue;
            const raw = String(m.groups?.n ?? m[1]).toLowerCase().replace(/[.,;:]+$/, '');
            const n = /^\d[\d,]*$/.test(raw) ? Number(raw.replace(/,/g, '')) : NUMBER_WORDS[raw];
            if (!Number.isFinite(n)) continue;
            checked++;
            if (n !== claim.value) {
              const key = `${rel}:${unit.line}:${claim.name}:${n}`;
              if (seen.has(key)) continue;
              seen.add(key);
              problems.push(`${rel}:${unit.line} says "${m[0].trim().replace(/\s+/g, ' ')}" — ${claim.name} is ${claim.value}`);
            }
          }
        }
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log } = verifyCounts();
  log.forEach(l => console.log(l));
  if (!ok) process.exit(1);
}
