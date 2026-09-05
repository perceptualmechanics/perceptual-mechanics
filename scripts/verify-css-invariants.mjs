// ─── CSS rules the stylesheets state about themselves, checked ─────────────
// Run with `node scripts/verify-css-invariants.mjs`, and on every build via
// vite.config.js.
//
// All three checks here exist because a stylesheet asserted something in a
// comment and nothing made it true. That is the failure mode this project
// keeps hitting: prose that was accurate when written, relied on afterwards,
// and wrong by then.
//
//   1. Every bottom-anchored scene title uses the shared safe zone.
//   2. No selector is declared twice over the same property.
//   3. No translucent text colour is too faint to reach AA on any ground.
//   4. No centred bottom chrome is anchored inside the title's own band.
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { SCENES } from '../src/scenes/registry.js';

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


// The rule's own declarations as text, with every nested block cut out, and
// (separately) each nested block's text. Check 4 has to look at these apart
// from each other: a rule can pin itself to a corner at base width and centre
// itself at a breakpoint, and only the second of those is in the title's way.
function ownLevelText(body) {
  let flat = body, prev;
  do { prev = flat; flat = flat.replace(/\{[^{}]*\}/g, ''); } while (flat !== prev);
  return flat;
}

function nestedBlocks(body) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '{') { if (depth === 0) start = i + 1; depth++; }
    else if (body[i] === '}') { depth--; if (depth === 0) out.push(body.slice(start, i)); }
  }
  return out;
}

// sRGB relative luminance, per WCAG.
const relLuminance = ([r, g, b]) => {
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

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

  // ── 3. Text colours that cannot reach AA whatever is behind them ──
  // Every scene here paints on a dark ground, and a translucent text colour
  // over a dark ground is at its brightest when the ground is pure black. So
  // compositing the declared colour over black gives the BEST case, and if
  // that is under 4.5:1 the real rendering is under it too — no knowledge of
  // any particular panel's background needed, and no false alarms.
  //
  // Deliberately an upper bound rather than a real measurement: it will miss
  // a 0.9-alpha colour that happens to sit on a light panel, and it will
  // never wrongly accuse one. Seven declarations failed it when it was
  // written, across harmonics, library and orbiter, three of which carried
  // their own comment claiming a measurement.
  const AA_SMALL = 4.5;
  for (const [path, url] of sheets) {
    const css = stripComments(readFileSync(url, 'utf8'));
    for (const { sel, body } of topLevelRules(css)) {
      for (const m of body.matchAll(/(?<![-\w])color:\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g)) {
        const [r, g, b, a] = [+m[1], +m[2], +m[3], +m[4]];
        // Over pure black, the composite is simply the colour times its alpha.
        const best = (relLuminance([r * a, g * a, b * a]) + 0.05) / 0.05;
        if (best < AA_SMALL) {
          problems.push(
            `${path}: ${sel.split('\n')[0].trim().slice(0, 60)} sets color: rgba(${r},${g},${b},${a}), ` +
            `which reaches at most ${best.toFixed(2)}:1 — against pure black, the most favourable ground there is. ` +
            `AA wants ${AA_SMALL}:1 for text under 24px.`
          );
        }
      }
    }
  }

  // ── 4. Centred bottom chrome clears the title band ──
  // --title-block-bottom says where the title BLOCK starts; the title itself
  // is another ~28px on top of that, and a scene's own panel can clear the
  // footer pill perfectly while running straight through the title text.
  // Apollo's fader rail did, at bottom: 5.5rem against a title block at
  // 4.5rem + 28px, and it looked exactly like a title that had been placed
  // there on purpose. --title-block-clear (styles/main.css) is the top of
  // that band, and anything both bottom-anchored and horizontally CENTRED
  // has to sit above it.
  //
  // Centred is the whole qualifier, and it is what keeps this from crying
  // wolf: the title is centred text, so only chrome that shares its
  // horizontal middle can collide with it. A sound toggle pinned to
  // bottom-left at 5.5rem sits BESIDE the title, not under it, and is
  // correct — this check leaves it alone rather than making everyone
  // near the bottom edge justify themselves.
  const REM = 16;
  const asRem = (v) => {
    const m = /^(-?[\d.]+)(rem|px)$/.exec(v.trim());
    if (!m) return null;
    return m[2] === 'rem' ? Number(m[1]) : Number(m[1]) / REM;
  };
  const clearRem = (() => {
    const main = readFileSync(new URL('styles/main.css', ROOT), 'utf8');
    const m = /--title-block-clear:\s*([^;]+);/.exec(main);
    return m ? asRem(m[1]) : null;
  })();

  // A block is centred if it pins both edges, or pins its middle and pulls
  // itself back by half — the two ways this tree actually does it.
  const isCentred = (decls) =>
    (/(?:^|[\s;{])left:\s*0\b/.test(decls) && /(?:^|[\s;{])right:\s*0\b/.test(decls)) ||
    (/(?:^|[\s;{])left:\s*50%/.test(decls) && /translateX\(\s*-50%/.test(decls));

  // Registered scenes only. An unregistered scene (Spectra, shelved — see
  // src/scenes/spectra/SHELVED.md) renders no title, because nothing loads
  // it; its own restore checklist is where that obligation belongs, not here.
  // Checks 1-3 above stay tree-wide on purpose: they are about a stylesheet
  // being internally consistent, which is true whether or not it is loaded.
  // This one is about two elements being on screen together.
  let centredRules = 0;
  if (clearRem !== null) {
    for (const [path, url] of sheets.filter(([p]) => p.split('/')[2] in SCENES)) {
      const css = stripComments(readFileSync(url, 'utf8'));
      for (const { sel, body } of topLevelRules(css)) {
        if (TITLE_SELECTOR.test(sel)) continue;           // the title is the band
        // A pseudo-element is positioned against its ORIGINATING element, not
        // against the scene root, so its `bottom` is not a viewport offset and
        // comparing it to a viewport band is meaningless. Theater's
        // `.tab-seat.occupied::after { bottom: -2px }` is a dot under a seat.
        if (/::(?:before|after)/.test(sel)) continue;
        // Each nested @media block is its own condition, and so is the rule's
        // own level: a rule can be corner-pinned at base and centred at a
        // breakpoint, which is exactly Apollo's rail.
        const blocks = [ownLevelText(body), ...nestedBlocks(body)];
        for (const block of blocks) {
          if (!isCentred(block)) continue;
          const m = /(?:^|[\s;{])bottom:\s*([^;}\n]+)/.exec(block);
          if (!m) continue;
          const v = m[1].trim();
          if (v.startsWith('var(--title-block-clear')) { centredRules++; continue; }
          const rem = asRem(v);
          if (rem === null || rem >= clearRem) continue;   // a bigger literal is not a bug, just unnamed
          problems.push(
            `${path}: ${sel.split('\n')[0].trim().slice(0, 60)} is centred and bottom-anchored at ` +
            `bottom: ${v} (${rem}rem), inside the title band that starts at ${clearRem}rem. ` +
            `The scene title renders across it. Anchor to var(--title-block-clear) / ` +
            `var(--title-block-clear-mobile) — see styles/main.css.`
          );
        }
      }
    }
  }

  if (problems.length) {
    say(`\ncss-invariants: ${problems.length} problem(s):`);
    for (const p of problems) say(`  ${p}`);
  } else {
    say(`ok: all ${titleRules} bottom-anchored title rules use the shared safe zone, ${centredRules} centred bottom panel(s) clear it, no selector is declared twice over the same property, and every translucent text colour can reach AA`);
  }
  return { ok: problems.length === 0, failures: problems.length, log };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { ok, log } = verifyCssInvariants();
  log.forEach(l => console.log(l));
  if (!ok) process.exit(1);
}
