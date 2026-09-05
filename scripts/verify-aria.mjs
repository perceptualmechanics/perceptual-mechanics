// ─── The three accounts of a scene, checked against each other ──────────────
// Run with `node scripts/verify-aria.mjs`, and on every build via
// vite.config.js.
//
// Every scene describes itself three times: the landing tile's `aria-label` in
// index.html, the scene overlay's, and the visible hint line inside the
// scene's own template. Only a screen-reader visitor hears the first two, and
// nobody at all is shown a diff between them, so drift here is silent by
// construction — which is how eleven of the thirteen pairs came to disagree
// by 5.0, on the scroll's date range, on whether Orbiter's orbits are
// elliptical, on where Outside's flower breathes.
//
// registry.js now holds one description per scene, split into `blurb` and
// `controls`, and derives both aria-labels from it. This checks the two things
// that derivation cannot enforce on its own:
//
//   1. index.html's tile labels really are tileAria(). They are hand-written
//      markup — the file is static and the CSP style hash is computed over it —
//      so nothing but a check keeps them honest.
//   2. Every gesture a scene's visible hint names also appears in `controls`.
//      Not a wording comparison, which would fail on the first rephrase: a set
//      comparison over the gesture verbs, which catches the failure that
//      matters — the sighted visitor being told about an interaction the
//      screen-reader visitor is not.
import { readFileSync, existsSync } from 'node:fs';
import { SCENES, tileAria } from '../src/scenes/registry.js';

// The gestures this site actually has. Anything not on this list is prose.
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
    // ── 1. The landing tile ──
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

    // ── 2. The scene's own visible hint ──
    // Not every scene has one: Scroll and Theater are read and watched rather
    // than manipulated. A missing hint is not a failure; a hint naming a
    // gesture `controls` does not is.
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

  // ── 3. The split itself ──
  // A `blurb` that has drifted into giving instructions is the split coming
  // undone: the landing tile would start telling people to drag something
  // that, as a tile, cannot be dragged.
  //
  // Imperative position only — a gesture word opening a sentence or a clause.
  // The same words appear innocently as nouns and relative clauses all over
  // these descriptions ("a SCROLL of found writing", "a warehouse you can WALK
  // around", "as a POINT of light"), and flagging those would make the check
  // something to route around rather than obey.
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const { ok, log } = verifyAria();
  log.forEach(l => console.log(l));
  if (!ok) process.exit(1);
}
