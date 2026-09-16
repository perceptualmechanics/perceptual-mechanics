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
    say(`ok: all ${titleRules} bottom-anchored title rules use the shared safe zone, ${centredRules} centred bottom panel(s) clear it, no selector is declared twice over the same property, and every translucent text colour can reach AA`);
  }
  return { ok: problems.length === 0, failures: problems.length, log };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, log } = verifyCssInvariants();
  log.forEach(l => console.log(l));
  if (!ok) process.exit(1);
}
