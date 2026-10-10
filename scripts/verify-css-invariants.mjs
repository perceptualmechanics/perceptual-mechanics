import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { SCENES } from '../src/scenes/registry.js';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url);

function sceneStylesheets() {
  const dir = new URL('src/scenes/', ROOT);
  return readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => [`src/scenes/${e.name}/${e.name}.css`, new URL(`src/scenes/${e.name}/${e.name}.css`, ROOT)])
    .filter(([, url]) => { try { readFileSync(url); return true; } catch { return false; } });
}

const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

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

function ownDeclarations(body) {
  let flat = body, prev;
  do { prev = flat; flat = flat.replace(/\{[^{}]*\}/g, ''); } while (flat !== prev);
  flat = flat.replace(/@[a-z-]+[^;{]*/gi, '');
  return flat.split(';')
    .filter(d => d.includes(':'))
    .map(d => d.slice(0, d.indexOf(':')).trim())
    .filter(p => p && !p.startsWith('--') && !/[\s\n]/.test(p));
}


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

const relLuminance = ([r, g, b]) => {
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

export function verifyCssInvariants() {
  const log = [];
  const say = (...a) => log.push(a.join(' '));
  const problems = [];
  const sheets = sceneStylesheets();

  const TITLE_SELECTOR = /-(title|title-row|label-row)\b/;
  let titleRules = 0;
  let trackedRules = 0;
  for (const [path, url] of sheets) {
    const css = stripComments(readFileSync(url, 'utf8'));
    for (const { sel, body } of topLevelRules(css)) {
      if (!TITLE_SELECTOR.test(sel)) continue;
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

  // letter-spacing is added after the LAST character as well as between them,
  // so a tracked run is one tracking wider than its glyphs and anything that
  // centres it — or pads it evenly — sits half a tracking off. The house fix is
  // --tracking feeding both the spacing and its compensation.
  //
  // This follows the SELECTOR, not the rule, and that took three tries to get
  // right. Asking whether the compensation appeared anywhere in the rule passed
  // .apollo-ambient, whose own nested @media put the tracking straight back on
  // the right. Asking per context inside the rule still passed it, because a
  // THIRD rule — `@media (max-height: 760px) { .apollo-mode label, .apollo-ambient,
  // .apollo-copy { padding: … } }` — reaches the same pills from elsewhere in the
  // file. A browser measured both at half a tracking off while the gate was green.
  // So: every rule anywhere that sets a horizontal padding or a right margin on a
  // tracked selector has to answer for itself.
  const COMPENSATES_MARGIN = /margin-right:\s*calc\(\s*-1\s*\*\s*var\(--tracking\)\s*\)/;
  const COMPENSATES_PADDING = /calc\([^;]*(?:-\s*var\(--tracking\)|var\(--tracking\)\s*\+)[^;]*\)/;
  const SETS_PADDING = /(?:^|[\s;{])padding(?:-right|-left)?:[^;]+;/g;
  const SETS_MARGIN = /(?:^|[\s;{])margin(?:-right)?:[^;]+;/g;
  // `.a:hover`, `.a::after` and `.a` are the same box as far as padding goes.
  const bare = sel => sel.replace(/::?[a-z-]+(\([^)]*\))?/gi, '').replace(/\s+/g, ' ').trim();
  const lastOf = (body, re) => { let m, last = null; re.lastIndex = 0; while ((m = re.exec(body))) last = m[0]; return last; };

  // Every (condition, selector, declarations) in the file, at any nesting depth.
  function flatten(css, condition, selectors, out) {
    let i = 0;
    while (i < css.length) {
      const open = css.indexOf('{', i);
      if (open === -1) break;
      let depth = 1, j = open + 1;
      for (; j < css.length && depth > 0; j++) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') depth--;
      }
      const head = css.slice(i, open).trim();
      const body = css.slice(open + 1, j - 1);
      if (head.startsWith('@')) {
        // at-rule: same selectors if we are inside a rule, fresh ones if not
        if (/^@(media|supports|layer|container)\b/.test(head)) flatten(body, head, selectors, out);
      } else if (head) {
        const sels = selectors
          ? selectors                                     // nested rule: not handled, and none exist
          : head.split(',').map(x => x.trim().replace(/\s+/g, ' '));
        out.push({ condition, selectors: sels, body: body.replace(/@[^{]*\{[\s\S]*?\n\s*\}/g, '') });
        // nested at-rules inside this rule keep this rule's selectors
        const inner = /@[^{]*\{/g;
        let a;
        while ((a = inner.exec(body))) {
          let d = 1, k = inner.lastIndex;
          for (; k < body.length && d > 0; k++) {
            if (body[k] === '{') d++;
            else if (body[k] === '}') d--;
          }
          out.push({ condition: body.slice(a.index, inner.lastIndex - 1).trim(), selectors: sels, body: body.slice(inner.lastIndex, k - 1) });
          inner.lastIndex = k;
        }
      }
      i = j;
    }
    return out;
  }

  for (const [path, url] of sheets.concat([['styles/main.css', new URL('styles/main.css', ROOT)]])) {
    const css = stripComments(readFileSync(url, 'utf8'));
    const entries = flatten(css, '', null, []);
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
  // from drifting apart later. It reads text-align, so it does not see a pill
  // whose text is not centred but whose padding still has to look even; those
  // are found by measuring, and the idiom is what keeps them fixed.
  const TRACKING_EXEMPT = {
    '.tab-curtain': 'a repeating rule of box-drawing characters, wider than its own box and clipped; aria-hidden decoration with no line-end a reader can see',
  };
  const exemptSeen = new Set();
  for (const [path, url] of sheets.concat([['styles/main.css', new URL('styles/main.css', ROOT)]])) {
    const css = stripComments(readFileSync(url, 'utf8'));
    for (const { sel, body } of topLevelRules(css)) {
      const m = body.match(/(?:^|[\s;{])letter-spacing:\s*([^;]+);/);
      if (!m) continue;
      const value = m[1].trim();
      if (/var\(--tracking\)/.test(value)) continue;
      if (value === 'normal' || parseFloat(value) === 0) continue;
      if (!/text-align:\s*center/.test(body)) continue;
      const names = sel.split(',').map(x => x.trim().split('\n').pop().trim());
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
  for (const [path, url] of sheets.concat([['styles/main.css', new URL('styles/main.css', ROOT)]])) {
    const css = stripComments(readFileSync(url, 'utf8'));
    for (const { sel, body } of topLevelRules(css)) {
      for (const m of body.matchAll(/(?<![-\w])color:\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g)) {
        const [r, g, b, a] = [+m[1], +m[2], +m[3], +m[4]];
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
    for (const [path, url] of sheets.filter(([p]) => p.split('/')[2] in SCENES)) {
      const css = stripComments(readFileSync(url, 'utf8'));
      for (const { sel, body } of topLevelRules(css)) {
        if (TITLE_SELECTOR.test(sel)) continue;           // the title is the band
        if (/::(?:before|after)/.test(sel)) continue;
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
    say(`ok: all ${titleRules} bottom-anchored title rules use the shared safe zone, ${centredRules} centred bottom panel(s) clear it, all ${trackedRules} tracked rules give the trailing tracking back (${Object.keys(TRACKING_EXEMPT).length} centred rule exempt with a stated reason), no selector is declared twice over the same property, and every translucent text colour can reach AA`);
  }
  return { ok: problems.length === 0, failures: problems.length, log };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log } = verifyCssInvariants();
  log.forEach(l => console.log(l));
  if (!ok) process.exit(1);
}
