// ─── CSS rules the stylesheets state about themselves, checked ─────────────
// Run with `node scripts/verify-css-invariants.mjs`, and on every build via
// vite.config.js.
//
// Both checks here exist because a stylesheet asserted something in a comment
// and nothing made it true. That is the failure mode this project keeps
// hitting: prose that was accurate when written, relied on afterwards, and
// wrong by then.
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);

function sceneStylesheets() {
  const dir = new URL('src/scenes/', ROOT);
  return readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => [`src/scenes/${e.name}/${e.name}.css`, new URL(`src/scenes/${e.name}/${e.name}.css`, ROOT)])
    .filter(([, url]) => { try { readFileSync(url); return true; } catch { return false; } });
}

const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

// Split a stylesheet into top-level rules. Nesting is left inside each body,
// which is what both checks want: a declaration inside a @media or a `&`
// block is a different condition, not a duplicate.
function topLevelRules(css) {
  const rules = [];
  let depth = 0, start = 0, sel = '', bodyStart = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '{') {
      if (depth === 0) { sel = css.slice(start, i).trim(); bodyStart = i + 1; }
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) { rules.push({ sel, body: css.slice(bodyStart, i) }); start = i + 1; }
    }
  }
  return rules;
}

// Declarations at this rule's own level, with every nested block removed.
function ownDeclarations(body) {
  let flat = body, prev;
  do { prev = flat; flat = flat.replace(/\{[^{}]*\}/g, ''); } while (flat !== prev);
  flat = flat.replace(/@[a-z-]+[^;{]*/gi, '');
  return flat.split(';')
    .filter(d => d.includes(':'))
    .map(d => d.slice(0, d.indexOf(':')).trim())
    .filter(p => p && !p.startsWith('--') && !/[\s\n]/.test(p));
}

export function verifyCssInvariants() {
  const log = [];
  const say = (...a) => log.push(a.join(' '));
  const problems = [];
  const sheets = sceneStylesheets();

  // ── 1. The title-block safe zone ──
  // styles/main.css says --title-block-bottom is "the single source of truth"
  // and that "every scene that positions a title there anchors to this value
  // instead of a separately-eyeballed bottom offset, so a new subtitle line
  // added to any scene is safe by construction". Four of the eight scenes
  // with a bottom-centre title were not: Apollo, Butterfly, Harmonics and
  // Medium each carried 5.5rem/3rem, and 3rem is the exact value that
  // comment records measuring and rejecting. Measured at 1440x900 the four
  // of them cleared the footer pill by 2px, against 26px for the four that
  // used the var. Nothing announced it, because a title that overlaps a pill
  // by a hair still looks like a title.
  const TITLE_SELECTOR = /-(title|title-row|label-row)\b/;
  let titleRules = 0;
  for (const [path, url] of sheets) {
    const css = stripComments(readFileSync(url, 'utf8'));
    for (const { sel, body } of topLevelRules(css)) {
      if (!TITLE_SELECTOR.test(sel)) continue;
      // Only rules that actually place something against the bottom edge.
      const bottoms = [...body.matchAll(/(?:^|[\s;{])bottom:\s*([^;}\n]+)/g)].map(m => m[1].trim());
      if (!bottoms.length) continue;
      titleRules++;
      for (const v of bottoms) {
        if (v === 'auto' || v === '0' || v === '0px' || v.startsWith('var(--title-block-bottom')) continue;
        problems.push(
          `${path}: ${sel} sets bottom: ${v}. A bottom-anchored title has to use ` +
          `var(--title-block-bottom) / var(--title-block-bottom-mobile) — that is what ` +
          `keeps it clear of #site-title's footer pill, and styles/main.css claims every ` +
          `scene does it.`
        );
      }
    }
  }

  // ── 2. One selector, one place ──
  // Two top-level rules with the identical selector, both setting the same
  // property, means one of them does nothing — and which one is decided by
  // source order rather than by anything a reader can see at the site of
  // either. .orrery-hint had two, and its `text-align: center` had never
  // taken effect.
  for (const [path, url] of sheets.concat([['styles/main.css', new URL('styles/main.css', ROOT)]])) {
    const css = stripComments(readFileSync(url, 'utf8'));
    const bySelector = new Map();
    for (const { sel, body } of topLevelRules(css)) {
      if (sel.startsWith('@') || !sel) continue;
      const key = sel.replace(/\s+/g, ' ');
      const props = ownDeclarations(body);
      const seen = bySelector.get(key);
      if (seen) {
        const clash = props.filter(p => seen.has(p));
        if (clash.length) {
          problems.push(
            `${path}: "${key}" appears in more than one rule, and both set ${[...new Set(clash)].join(', ')}. ` +
            `The later one silently wins; merge them so the value is where a reader looks for it.`
          );
        }
        props.forEach(p => seen.add(p));
      } else {
        bySelector.set(key, new Set(props));
      }
    }
  }

  if (problems.length) {
    say(`\ncss-invariants: ${problems.length} problem(s):`);
    for (const p of problems) say(`  ${p}`);
  } else {
    say(`ok: all ${titleRules} bottom-anchored title rules use the shared safe zone, and no selector is declared twice over the same property`);
  }
  return { ok: problems.length === 0, failures: problems.length, log };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { ok, log } = verifyCssInvariants();
  log.forEach(l => console.log(l));
  if (!ok) process.exit(1);
}
