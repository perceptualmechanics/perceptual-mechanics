import { readFileSync, existsSync } from 'node:fs';
import { SCENES, tileAria } from '../src/scenes/registry.js';
import { pathToFileURL } from 'node:url';

const GESTURES = ['drag', 'scroll', 'click', 'touch', 'press', 'point', 'walk', 'move', 'tap'];

const gesturesIn = (text) => new Set(
  GESTURES.filter(v => new RegExp(`\\b${v}(s|ing|ed)?\\b`, 'i').test(text))
);

export function verifyAria() {
  const log = [];
  const say = (...a) => log.push(a.join(' '));
  const problems = [];

  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const unescape = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

  for (const [key, spec] of Object.entries(SCENES)) {
    const m = html.match(new RegExp(`id="preview-${key}"[\\s\\S]{0,400}?aria-label="(.*?)"`));
    if (!m) {
      problems.push(`#preview-${key} has no aria-label in index.html`);
    } else {
      const got = unescape(m[1]);
      const want = tileAria(spec);
      if (got !== want) {
        problems.push(
          `#preview-${key}'s aria-label is not the one registry.js derives.\n` +
          `      in index.html: ${got}\n` +
          `      tileAria():    ${want}`
        );
      }
    }

    const tplUrl = new URL(`../src/scenes/${key}/${key}.html`, import.meta.url);
    if (!existsSync(tplUrl)) continue;
    const tpl = readFileSync(tplUrl, 'utf8');
    const hint = tpl.match(new RegExp(`class="${key}-hint"[^>]*>([^<]*)`));
    if (!hint) continue;
    const hintText = hint[1].replace(/&nbsp;|&middot;|&[a-z]+;/g, ' ');
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
