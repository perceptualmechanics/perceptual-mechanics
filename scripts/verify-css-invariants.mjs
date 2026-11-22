import { readFileSync, readdirSync } from 'node:fs';
import { SCENES } from '../src/scenes/registry.js';
import { luminance } from '../src/utils/contrast.js';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url);

// Every stylesheet the site ships: the scenes', the shared ones under styles/
// and any component's. Found by walking rather than listed, so a new sheet is
// checked the day it is added.
function stylesheets() {
  const out = [];
  for (const top of ['styles', 'src']) {
    for (const rel of readdirSync(new URL(`${top}/`, ROOT), { recursive: true })) {
      if (rel.endsWith('.css')) out.push([`${top}/${rel}`, new URL(`${top}/${rel}`, ROOT)]);
    }
  }
  return out.sort(([a], [b]) => a.localeCompare(b));
}
const isSceneSheet = path => /^src\/scenes\/[^/]+\/[^/]+\.css$/.test(path);

const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

// Split on commas outside parentheses, so `:is(.a, .b)` stays one selector.
function splitSelectors(head) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < head.length; i++) {
    if (head[i] === '(') depth++;
    else if (head[i] === ')') depth--;
    else if (head[i] === ',' && depth === 0) { out.push(head.slice(start, i)); start = i + 1; }
  }
  out.push(head.slice(start));
  return out.map(x => x.trim().replace(/\s+/g, ' ')).filter(Boolean);
}

// A nested selector stands for itself with `&` replaced by its parent, or
// sits under the parent as a descendant when it has no `&`. A parent list
// multiplies out, one selector per pairing.
function resolveSelectors(head, parents) {
  const own = splitSelectors(head);
  if (!parents) return own;
  return parents.flatMap(p => own.map(s => s.includes('&') ? s.replaceAll('&', p) : `${p} ${s}`));
}

const GROUPING = /^@(media|supports|layer|container|starting-style)\b/;

// Every style rule in a sheet, at any depth of nesting, as the selectors it
// really reaches, the chain of conditional at-rules it sits in, and its own
// declarations (not its children's). Other at-rules (@font-face, @keyframes)
// carry no selectors and are passed over.
function flatten(css) {
  const out = [];
  (function walk(text, selectors, conditions) {
    let own = '', buf = '', quote = null, parens = 0;
    const children = [];
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quote) { buf += c; if (c === quote && text[i - 1] !== '\\') quote = null; continue; }
      if (c === '"' || c === "'") { quote = c; buf += c; continue; }
      if (c === '(') parens++;
      else if (c === ')') parens--;
      if (c === ';' && parens === 0) { own += buf + ';'; buf = ''; continue; }
      if (c !== '{') { buf += c; continue; }
      let depth = 1, j = i + 1;
      for (; j < text.length && depth > 0; j++) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
      }
      const head = buf.trim(), body = text.slice(i + 1, j - 1);
      buf = '';
      i = j - 1;
      if (head.startsWith('@')) {
        if (GROUPING.test(head)) children.push([body, selectors, [...conditions, head.replace(/\s+/g, ' ')]]);
      } else if (head) {
        children.push([body, resolveSelectors(head, selectors), conditions]);
      }
    }
    own += buf;
    if (selectors) out.push({ selectors, condition: conditions.join(' '), body: own });
    for (const child of children) walk(...child);
  })(css, null, []);
  return out;
}

function declaredProperties(body) {
  return body.split(';')
    .filter(d => d.includes(':'))
    .map(d => d.slice(0, d.indexOf(':')).trim())
    .filter(p => p && !p.startsWith('--') && !/\s/.test(p));
}

const relLuminance = rgb => luminance(rgb.map(c => c / 255));

export function verifyCssInvariants() {
  const log = [];
  const say = (...a) => log.push(a.join(' '));
  const problems = [];
  const sheets = stylesheets().map(([path, url]) => ({ path, entries: flatten(stripComments(readFileSync(url, 'utf8'))) }));
  const sceneSheets = sheets.filter(({ path }) => isSceneSheet(path));
  const named = e => e.selectors.join(', ').slice(0, 60);

  const TITLE_SELECTOR = /-(title|title-row|label-row)\b/;
  let titleRules = 0;
  let trackedRules = 0;
  for (const { path, entries } of sceneSheets) {
    for (const e of entries) {
      if (!e.selectors.some(sel => TITLE_SELECTOR.test(sel))) continue;
      const bottoms = [...e.body.matchAll(/(?:^|[\s;{])bottom:\s*([^;}\n]+)/g)].map(m => m[1].trim());
      if (!bottoms.length) continue;
      titleRules++;
      for (const v of bottoms) {
        if (v === 'auto' || v === '0' || v === '0px' || v.startsWith('var(--title-block-bottom')) continue;
        problems.push(
          `${path}: ${named(e)} sets bottom: ${v}. A bottom-anchored title has to use ` +
          `var(--title-block-bottom) / var(--title-block-bottom-mobile) — that is what ` +
          `keeps it clear of #site-title's footer pill, and styles/main.css claims every ` +
          `scene does it.`
        );
      }
    }
  }

  for (const { path, entries } of sheets) {
    const byRule = new Map();
    for (const e of entries) {
      const key = `${e.condition} ${e.selectors.join(', ')}`;
      const props = declaredProperties(e.body);
      const seen = byRule.get(key);
      if (seen) {
        const clash = props.filter(p => seen.has(p));
        if (clash.length) {
          problems.push(
            `${path}: "${e.selectors.join(', ')}"${e.condition ? ` inside ${e.condition}` : ''} appears in more than one rule, ` +
            `and both set ${[...new Set(clash)].join(', ')}. ` +
            `The later one silently wins; merge them so the value is where a reader looks for it.`
          );
        }
        props.forEach(p => seen.add(p));
      } else {
        byRule.set(key, new Set(props));
      }
    }
  }

  // letter-spacing is added after the LAST character as well as between them,
  // so a tracked run is one tracking wider than its glyphs and anything that
  // centres it — or pads it evenly — sits half a tracking off. The house fix is
  // --tracking feeding both the spacing and its compensation.
  //
  // This follows the SELECTOR, not the rule. Asking whether the compensation
  // appeared anywhere in the rule passed .apollo-ambient, whose own nested
  // @media put the tracking straight back on the right; asking per context
  // inside the rule still passed it, because a third rule —
  // `@media (max-height: 760px) { .apollo-mode label, .apollo-ambient,
  // .apollo-copy { padding: … } }` — reaches the same pills from elsewhere in
  // the file. So every rule anywhere that sets a horizontal padding or a right
  // margin on a tracked selector has to answer for itself.
  const COMPENSATES_MARGIN = /margin-right:\s*calc\(\s*-1\s*\*\s*var\(--tracking\)\s*\)/;
  const COMPENSATES_PADDING = /calc\([^;]*(?:-\s*var\(--tracking\)|var\(--tracking\)\s*\+)[^;]*\)/;
  const SETS_PADDING = /(?:^|[\s;{])padding(?:-right|-left)?:[^;]+;/g;
  const SETS_MARGIN = /(?:^|[\s;{])margin(?:-right)?:[^;]+;/g;
  // `.a:hover`, `.a::after` and `.a` are the same box as far as padding goes.
  const bare = sel => sel.replace(/::?[a-z-]+(\([^)]*\))?/gi, '').replace(/\s+/g, ' ').trim();
  const lastOf = (body, re) => { let m, last = null; re.lastIndex = 0; while ((m = re.exec(body))) last = m[0]; return last; };

  for (const { path, entries } of sheets) {
    const tracked = new Set();
    for (const e of entries) {
      if (!/letter-spacing:\s*var\(--tracking\)/.test(e.body)) continue;
      for (const sel of e.selectors) tracked.add(bare(sel));
    }
    trackedRules += tracked.size;
    const compensatedSomewhere = new Set();
    for (const e of entries) {
      const hits = e.selectors.filter(sel => tracked.has(bare(sel)));
      if (!hits.length) continue;
      const pad = lastOf(e.body, SETS_PADDING), mar = lastOf(e.body, SETS_MARGIN);
      if (!pad && !mar) continue;
      const ok = (mar && COMPENSATES_MARGIN.test(mar)) || (pad && COMPENSATES_PADDING.test(pad));
      const where = e.condition ? ` — inside ${e.condition}` : '';
      if (ok) { for (const sel of hits) compensatedSomewhere.add(bare(sel)); continue; }
      problems.push(
        `${path}: ${hits[0].slice(0, 48)}${where} sets its horizontal padding or right margin on text tracked ` +
        `with var(--tracking), and puts the tracking straight back. It is added after the last character too, ` +
        `so the text sits half a tracking left of where it looks like it should. ` +
        `Use margin-right: calc(-1 * var(--tracking)), or take the tracking off the right padding.`
      );
    }
    for (const sel of tracked) {
      if (!compensatedSomewhere.has(sel)) {
        problems.push(
          `${path}: ${sel.slice(0, 48)} tracks its text with var(--tracking) but never gives the tracking back. ` +
          `Add margin-right: calc(-1 * var(--tracking)), or take the tracking off the right padding.`
        );
      }
    }
  }

  // The check above only sees rules that already reach for --tracking. A rule
  // that centres tracked text WITHOUT the idiom is half a tracking off and
  // nothing names it, so it is caught here and sent to the idiom rather than
  // patched in place — that is what keeps the spacing and its compensation
  // from drifting apart later. A rule and the conditional blocks nested in it
  // are read together, since a centred line that is tracked only at one width
  // is still off at that width. It reads text-align, so it does not see a pill
  // whose text is not centred but whose padding still has to look even; those
  // are found by measuring, and the idiom is what keeps them fixed.
  const TRACKING_EXEMPT = {
    '.tab-curtain': 'a repeating rule of box-drawing characters, wider than its own box and clipped; aria-hidden decoration with no line-end a reader can see',
  };
  const exemptSeen = new Set();
  for (const { path, entries } of sheets) {
    const bySelectors = new Map();
    for (const e of entries) {
      const key = e.selectors.join(', ');
      bySelectors.set(key, (bySelectors.get(key) ?? '') + e.body + ';');
    }
    for (const [key, body] of bySelectors) {
      const m = body.match(/(?:^|[\s;{])letter-spacing:\s*([^;]+);/);
      if (!m) continue;
      const value = m[1].trim();
      if (/var\(--tracking\)/.test(value)) continue;
      if (value === 'normal' || parseFloat(value) === 0) continue;
      if (!/text-align:\s*center/.test(body)) continue;
      const names = splitSelectors(key);
      const exempt = names.find(n => n in TRACKING_EXEMPT);
      if (exempt) { exemptSeen.add(exempt); continue; }
      problems.push(
        `${path}: ${names[0].slice(0, 54)} centres its text and tracks it at ${value}, ` +
        `but the tracking is added after the last character too, so the line sits half of it ` +
        `to the left. Give it a --tracking and hand the tracking back — negative right margin, ` +
        `or off the right padding.`
      );
    }
  }
  for (const name of Object.keys(TRACKING_EXEMPT)) {
    if (!exemptSeen.has(name)) {
      problems.push(`TRACKING_EXEMPT names ${name}, which no longer centres tracked text — drop the exemption with the rule.`);
    }
  }

  const AA_SMALL = 4.5;
  for (const { path, entries } of sheets) {
    for (const e of entries) {
      for (const m of e.body.matchAll(/(?<![-\w])color:\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g)) {
        const [r, g, b, a] = [+m[1], +m[2], +m[3], +m[4]];
        const best = (relLuminance([r * a, g * a, b * a]) + 0.05) / 0.05;
        if (best < AA_SMALL) {
          problems.push(
            `${path}: ${named(e)} sets color: rgba(${r},${g},${b},${a}), ` +
            `which reaches at most ${best.toFixed(2)}:1 — against pure black, the most favourable ground there is. ` +
            `AA wants ${AA_SMALL}:1 for text under 24px.`
          );
        }
      }
    }
  }

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

  const isCentred = (decls) =>
    (/(?:^|[\s;{])left:\s*0\b/.test(decls) && /(?:^|[\s;{])right:\s*0\b/.test(decls)) ||
    (/(?:^|[\s;{])left:\s*50%/.test(decls) && /translateX\(\s*-50%/.test(decls));

  let centredRules = 0;
  if (clearRem !== null) {
    for (const { path, entries } of sceneSheets.filter(({ path }) => path.split('/')[2] in SCENES)) {
      for (const e of entries) {
        if (e.selectors.some(sel => TITLE_SELECTOR.test(sel))) continue;   // the title is the band
        if (e.selectors.some(sel => /::(?:before|after)/.test(sel))) continue;
        if (!isCentred(e.body)) continue;
        const m = /(?:^|[\s;{])bottom:\s*([^;}\n]+)/.exec(e.body);
        if (!m) continue;
        const v = m[1].trim();
        if (v.startsWith('var(--title-block-clear')) { centredRules++; continue; }
        const rem = asRem(v);
        if (rem === null || rem >= clearRem) continue;   // a bigger literal is not a bug, just unnamed
        problems.push(
          `${path}: ${named(e)} is centred and bottom-anchored at ` +
          `bottom: ${v} (${rem}rem), inside the title band that starts at ${clearRem}rem. ` +
          `The scene title renders across it. Anchor to var(--title-block-clear) / ` +
          `var(--title-block-clear-mobile) — see styles/main.css.`
        );
      }
    }
  }

  if (problems.length) {
    say(`\ncss-invariants: ${problems.length} problem(s):`);
    for (const p of problems) say(`  ${p}`);
  } else {
    const rules = sheets.reduce((n, { entries }) => n + entries.length, 0);
    say(`ok: ${sheets.length} stylesheets (${sceneSheets.length} scenes', and ${sheets.filter(s => !isSceneSheet(s.path)).map(s => s.path).join(', ')}), ${rules} style rules counting nested ones: all ${titleRules} bottom-anchored scene title rules use the shared safe zone, ${centredRules} centred bottom panel(s) clear it, all ${trackedRules} tracked rules give the trailing tracking back (${Object.keys(TRACKING_EXEMPT).length} centred rule exempt with a stated reason), no selector is declared twice over the same property, and every translucent text colour can reach AA`);
  }
  return { ok: problems.length === 0, failures: problems.length, log };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log } = verifyCssInvariants();
  log.forEach(l => console.log(l));
  if (!ok) process.exit(1);
}
