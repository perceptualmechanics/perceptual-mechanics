import { SCENES, tileAria } from '../src/scenes/registry.js';
import { previewTilesHtml } from './landing.js';
import { pathToFileURL } from 'node:url';

const GESTURES = ['drag', 'scroll', 'click', 'touch', 'press', 'point', 'walk', 'move', 'tap'];

const gesturesIn = (text) => new Set(
  GESTURES.filter(v => new RegExp(`\\b${v}(s|ing|ed)?\\b`, 'i').test(text))
);

export function verifyAria() {
  const log = [];
  const say = (...a) => log.push(a.join(' '));
  const problems = [];

  // Reads what the build emits, not index.html, which no longer holds the
  // tiles. Not a tautology: it exercises the escaping, and an aria string
  // carrying a quote would break the attribute rather than the build.
  const html = previewTilesHtml();
  const unescape = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

  for (const [key, spec] of Object.entries(SCENES)) {
    const m = html.match(new RegExp(`id="preview-${key}"[\\s\\S]{0,400}?aria-label="(.*?)"`));
    if (!m) {
      problems.push(`#preview-${key} has no aria-label in the generated tiles`);
    } else {
      const got = unescape(m[1]);
      const want = tileAria(spec);
      if (got !== want) {
        problems.push(
          `#preview-${key}'s aria-label is not the one registry.js derives.\n` +
          `      generated: ${got}\n` +
          `      tileAria():    ${want}`
        );
      }
    }

    // The hint is a registry field now. This used to scrape the template and
    // `continue` on finding nothing — which, once the templates stopped
    // carrying hints, skipped every scene and passed on an empty loop.
    if (!spec.hint) continue;
    const hintText = spec.hint.replace(/&nbsp;|&middot;|&[a-z]+;/g, ' ');
    const missing = [...gesturesIn(hintText)].filter(v => !gesturesIn(spec.controls).has(v));
    if (missing.length) {
      problems.push(
        `${key}: the visible hint offers ${missing.map(v => `"${v}"`).join(', ')}, ` +
        `which the screen-reader account does not mention.\n` +
        `      hint:     ${hintText.trim()}\n` +
        `      controls: ${spec.controls}`
      );
    }
  }

  const imperative = new RegExp(`(?:^|[.;,]\\s+)(${GESTURES.join('|')})\\b`, 'gi');
  for (const [key, spec] of Object.entries(SCENES)) {
    const stray = [...spec.blurb.matchAll(imperative)].map(m => m[1].toLowerCase());
    if (stray.length) {
      problems.push(`${key}: blurb gives the instruction(s) ${stray.map(v => `"${v}"`).join(', ')} — those belong in controls, since the landing tile uses the blurb alone.`);
    }
  }

  const scenes = Object.keys(SCENES).length;
  if (problems.length) {
    say(`\naria: the accounts of a scene disagree, in ${problems.length} place(s):`);
    for (const p of problems) say(`  ${p}`);
  } else {
    say(`ok: all ${scenes} tiles carry the derived aria-label, and every visible hint's gestures are in the screen-reader account`);
  }
  return { ok: problems.length === 0, failures: problems.length, log };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log } = verifyAria();
  log.forEach(l => console.log(l));
  if (!ok) process.exit(1);
}
