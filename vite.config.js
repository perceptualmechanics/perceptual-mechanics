import { createHash } from 'crypto';
import fs from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import { prerender, PAGE_STYLE_SHA256 } from './scripts/prerender.js';
import { verifyLinks } from './scripts/verify-links.mjs';
import { verifyResonances } from './scripts/verify-resonances.mjs';
import { verifyScrollMarks } from './scripts/verify-scroll-marks.mjs';
import { verifyLanding } from './scripts/verify-landing.mjs';
import { verifyAria } from './scripts/verify-aria.mjs';
import { verifyCssInvariants } from './scripts/verify-css-invariants.mjs';
import { verifyCounts } from './scripts/verify-counts.mjs';
import { injectLanding } from './scripts/landing.js';
import { verifyQuizWheel } from './scripts/quiz-wheel.mjs';
import { verifyBench } from './scripts/verify-bench.mjs';
import { euphoniaFiles, verifyEuphonia, verifyEuphoniaPages } from './scripts/verify-euphonia.mjs';
import { wheelOf } from './src/euphonia/euphonia.wheel.js';
import { themeCss } from './src/euphonia/euphonia.themes.js';
import { verifyEuphoniaThemes } from './scripts/verify-euphonia-themes.mjs';
import { verifyEuphoniaMap, placesData } from './scripts/verify-euphonia-map.mjs';
import { verifyEuphoniaSrd } from './scripts/verify-euphonia-srd.mjs';
import { verifyEuphoniaBuilder } from './scripts/verify-euphonia-builder.mjs';
import { verifyEuphoniaReading } from './scripts/verify-euphonia-reading.mjs';
import { readingMap } from './scripts/euphonia-reading-map.mjs';
import { verifyEuphoniaTongues, verifyTongueRibbons } from './scripts/verify-euphonia-tongues.mjs';
import { injectEuphonia, euphoniaFooter } from './scripts/euphonia-page.js';

const HERE = import.meta.dirname;

// Fills index.html's two markers from the registry, in dev and in build alike,
// so the shipped HTML is complete for a crawler and for a reader with
// scripting off. Doing it in main.js would leave both empty.
function landingMarkupPlugin() {
  return {
    name: 'pm-landing-markup',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, { filename }) => filename === resolve(HERE, 'index.html') ? injectLanding(html) : html,
    },
  };
}

function verifyLinksPlugin() {
  return {
    name: 'pm-verify-links',
    apply: 'build',
    buildStart() {
      const { ok, failures, log } = verifyLinks();
      log.forEach(line => console.log(line));
      if (!ok) {
        this.error(`verify-links: ${failures} check(s) failed — see above. Fix src/links.js or the scene .text.js file(s) it points at before building.`);
      } else {
        console.log(`  ✓ verify-links: all checks passed`);
      }
    },
  };
}

function verifyLandingPlugin() {
  return {
    name: 'pm-verify-landing',
    apply: 'build',
    buildStart() {
      const { ok, failures, log } = verifyLanding();
      log.forEach(line => console.log(line));
      if (!ok) {
        this.error(`verify-landing: ${failures} check(s) failed — see above. The landing page would not fit every scene above the fold at one or more viewports.`);
      } else {
        console.log(`  ✓ verify-landing: the landing requirement holds across the viewport matrix`);
      }
    },
  };
}


function verifyAriaPlugin() {
  return {
    name: 'pm-verify-aria',
    apply: 'build',
    buildStart() {
      const { ok, failures, log } = verifyAria();
      log.forEach(line => console.log(line));
      if (!ok) {
        this.error(`verify-aria: ${failures} check(s) failed — see above. A scene is described differently to a screen-reader visitor than to a sighted one.`);
      } else {
        console.log(`  ✓ verify-aria: every scene describes itself the same way three times`);
      }
    },
  };
}


function verifyCssInvariantsPlugin() {
  return {
    name: 'pm-verify-css-invariants',
    apply: 'build',
    buildStart() {
      const { ok, failures, log } = verifyCssInvariants();
      log.forEach(line => console.log(line));
      if (!ok) {
        this.error(`verify-css-invariants: ${failures} problem(s) — see above.`);
      } else {
        console.log(`  ✓ verify-css-invariants: the safe zone holds and nothing is declared twice`);
      }
    },
  };
}


function verifyQuizWheelPlugin() {
  return {
    name: 'pm-verify-quiz-wheel',
    apply: 'build',
    buildStart() {
      const { ok, failures, log } = verifyQuizWheel();
      if (!ok) {
        log.forEach(line => console.log(line));
        this.error(`quiz-wheel: ${failures} check(s) failed — see above. The Wheel, the instrument or the scoring disagrees with A Vision.`);
      } else {
        console.log(`  \u2713 verify-quiz-wheel: the Wheel derives A Vision's own groups, and the scoring reaches the twenty-six cradles`);
      }
    },
  };
}

function verifyCountsPlugin() {
  return {
    name: 'pm-verify-counts',
    apply: 'build',
    buildStart() {
      const { ok, failures, log } = verifyCounts();
      log.forEach(line => console.log(line));
      if (!ok) {
        this.error(`verify-counts: ${failures} stated count(s) the data disagrees with — see above.`);
      } else {
        console.log(`  ✓ verify-counts: every stated count matches the data`);
      }
    },
  };
}

function verifyBenchPlugin() {
  return {
    name: 'pm-verify-bench',
    apply: 'build',
    buildStart() {
      const { ok, failures, log } = verifyBench();
      log.forEach(line => console.log(line));
      if (!ok) {
        this.error(`verify-bench: ${failures} problem(s) — see above. The workbench says something its sources do not.`);
      } else {
        console.log('  ✓ verify-bench: the hours and the sigils hold to their sources');
      }
    },
  };
}

// Fills euphonia/index.html from the vendored export, as landingMarkupPlugin
// fills the landing.
function euphoniaMarkupPlugin() {
  return {
    name: 'pm-euphonia-markup',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, { filename }) => filename === resolve(HERE, 'euphonia/index.html') ? injectEuphonia(html) : html,
    },
  };
}

// The People page's character sheets are the book's pages, copied in as the
// sheet generator wrote them (public/euphonia/sheets). Each carries SRD rules,
// so each owes the footer every Euphonia page carries: the built copy gets the
// same one, from the same export, before verify-euphonia reads the pages.
function euphoniaSheetsPlugin() {
  let outDir = resolve(HERE, 'dist');
  return {
    name: 'pm-euphonia-sheets',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    writeBundle() {
      const dir = resolve(outDir, 'euphonia', 'sheets');
      if (!fs.existsSync(dir)) return;
      const footer = euphoniaFooter(euphoniaFiles().legal.data);
      for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.html'))) {
        const html = fs.readFileSync(resolve(dir, f), 'utf8');
        if (!html.includes('</body>')) this.error(`euphonia/sheets/${f}: no </body> to set the footer before`);
        fs.writeFileSync(resolve(dir, f), html.replace('</body>', `${footer}\n</body>`));
      }
    },
  };
}

function verifyEuphoniaPlugin() {
  let outDir = resolve(HERE, 'dist');
  let failed = false;
  return {
    name: 'pm-verify-euphonia',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    // Rolldown closes a failed build too, with nothing written; its own error
    // is the one to see.
    buildEnd(error) {
      failed = Boolean(error);
    },
    // A build can also fail later, while its chunks are rendered (an import
    // that names an export no module has); that error is the one to see too.
    renderError() {
      failed = true;
    },
    closeBundle() {
      if (failed) return;
      const { ok, failures, log } = verifyEuphoniaPages(outDir);
      log.forEach(line => console.log(line));
      if (!ok) this.error(`verify-euphonia: ${failures} page problem(s) — see above. Every Euphonia page owes its footer the copyright line, the ORC Notice and the SRD 5.2.1 attribution.`);
    },
    buildStart() {
      const { ok, failures, log, warnings } = verifyEuphonia();
      log.forEach(line => console.log(line));
      warnings.forEach(w => this.warn(w));
      if (!ok) {
        this.error(`verify-euphonia: ${failures} problem(s) — see above. Euphonia's vendored text carries something that must not be published; re-export from the master with npm run euphonia:refresh.`);
      } else {
        console.log('  ✓ verify-euphonia: one clean export of the master, under the site\'s rules');
      }
    },
  };
}

// The ribbons' words: each from a dictionary named, its culture one the book
// names, every character in a face the page ships, and all of them set.
function verifyEuphoniaTonguesPlugin() {
  let outDir = resolve(HERE, 'dist');
  let failed = false;
  return {
    name: 'pm-verify-euphonia-tongues',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    buildEnd(error) {
      failed = Boolean(error);
    },
    renderError() {
      failed = true;
    },
    buildStart() {
      const { failures, words, unexported, master } = verifyEuphoniaTongues();
      if (failures) this.error(`verify-euphonia-tongues: ${failures} problem(s) — see above. A word on the ribbons isn't held to its dictionary, the book or a face the page ships.`);
      if (!master && unexported) this.warn(`verify-euphonia-tongues: ${unexported} culture(s) are named only in chapters the site doesn't carry; the master isn't here to check them.`);
      console.log(`  ✓ verify-euphonia-tongues: ${words} words, each from its dictionary, every culture in the book, every character in a face`);
    },
    closeBundle() {
      if (failed) return;
      const { failures, apart } = verifyTongueRibbons(fs.readFileSync(resolve(outDir, 'euphonia/index.html'), 'utf8'));
      if (failures) this.error(`verify-euphonia-tongues: ${failures} problem(s) with the built ribbons — see above. A word is missing, or look-alikes are bunched.`);
      console.log(`  ✓ verify-euphonia-tongues: every word on the built ribbons, ${apart === null ? 'no two alike' : `look-alikes at least ${apart} apart`}`);
    },
  };
}

// The map's places, looked up in the vendored gazetteer at build time, so the
// page carries coordinates for its seats, regions and people, and never the
// gazetteer.
const PLACES_ID = 'virtual:euphonia-places';
function euphoniaPlacesPlugin() {
  return {
    name: 'pm-euphonia-places',
    resolveId: id => (id === PLACES_ID ? `\0${PLACES_ID}` : null),
    load(id) {
      if (id !== `\0${PLACES_ID}`) return null;
      const { seats, regions, people, errors } = placesData();
      if (errors.length) this.error(`euphonia places: ${errors.join('; ')}`);
      return `export default ${JSON.stringify({ seats, regions, people })};`;
    },
  };
}

// The themes' tokens, as custom properties the stylesheet imports: one source
// for the page's colours and type (euphonia.themes.json).
const THEMES_ID = 'virtual:euphonia-themes.css';
function euphoniaThemesPlugin() {
  return {
    name: 'pm-euphonia-themes',
    resolveId: id => (id === THEMES_ID ? `\0${THEMES_ID}` : null),
    load: id => (id === `\0${THEMES_ID}` ? themeCss() : null),
  };
}

// The themes hold: colours only in their data, every text and mark readable
// in every theme, and every theme's sources named.
function verifyEuphoniaThemesPlugin() {
  return {
    name: 'pm-verify-euphonia-themes',
    buildStart() {
      const { failures, themes, pairs } = verifyEuphoniaThemes();
      if (failures) this.error(`verify-euphonia-themes: ${failures} problem(s) — see above.`);
      console.log(`  ✓ verify-euphonia-themes: ${themes} theme(s), colours only in their data, ${pairs} pairs readable in each, every source named, the khipu clear for every score`);
    },
  };
}

// The Wheel behind the globe, worked out here from the export (its realms'
// places and the Revelator's roads) so the page needn't load the classes.
const WHEEL_ID = 'virtual:euphonia-wheel';
function euphoniaWheelPlugin() {
  return {
    name: 'pm-euphonia-wheel',
    resolveId: id => (id === WHEEL_ID ? `\0${WHEEL_ID}` : null),
    load(id) {
      if (id !== `\0${WHEEL_ID}`) return null;
      const d = euphoniaFiles();
      return `export default ${JSON.stringify(wheelOf(d.wheel.data, d.classes.data))};`;
    },
  };
}

function verifyEuphoniaMapPlugin() {
  return {
    name: 'pm-verify-euphonia-map',
    apply: 'build',
    buildStart() {
      const { ok, failures, log } = verifyEuphoniaMap();
      log.forEach(line => console.log(line));
      if (!ok) {
        this.error(`verify-euphonia-map: ${failures} problem(s) — see above. The map of 1668 draws something its sources don't hold.`);
      } else {
        console.log('  ✓ verify-euphonia-map: the coasts hold to Natural Earth, the globe to the sphere');
      }
    },
  };
}

function verifyEuphoniaSrdPlugin() {
  return {
    name: 'pm-verify-euphonia-srd',
    apply: 'build',
    buildStart() {
      const { ok, failures, log } = verifyEuphoniaSrd();
      log.forEach(line => console.log(line));
      if (!ok) {
        this.error(`verify-euphonia-srd: ${failures} problem(s) — see above. The builder's SRD export breaks its licence, the site's rules or its own tables; re-export with scripts/euphonia-srd.mjs.`);
      } else {
        console.log('  ✓ verify-euphonia-srd: the SRD export attributed, clean, and agreeing with itself');
      }
    },
  };
}

const READING_MAP_ID = 'virtual:euphonia-reading-map';
function euphoniaReadingMapPlugin() {
  return {
    name: 'pm-euphonia-reading-map',
    resolveId: id => (id === READING_MAP_ID ? `\0${READING_MAP_ID}` : null),
    load(id) { return id === `\0${READING_MAP_ID}` ? `export default ${JSON.stringify(readingMap(placesData().regions))};` : null; },
  };
}
function verifyEuphoniaReadingPlugin() {
  return {
    name: 'pm-verify-euphonia-reading',
    apply: 'build',
    buildStart() {
      const { ok, failures, log } = verifyEuphoniaReading();
      log.forEach(line => console.log(line));
      if (!ok) this.error(`verify-euphonia-reading: ${failures} problem(s) — see above.`);
    },
  };
}

function verifyEuphoniaBuilderPlugin() {
  return {
    name: 'pm-verify-euphonia-builder',
    apply: 'build',
    buildStart() {
      const { ok, failures, log } = verifyEuphoniaBuilder();
      log.forEach(line => console.log(line));
      if (!ok) {
        this.error(`verify-euphonia-builder: ${failures} problem(s) — see above. The character builder's engine breaks a rule the SRD states, or can't read a class, species or feat.`);
      } else {
        console.log('  ✓ verify-euphonia-builder: the engine holds to the SRD\'s worked examples and reads every class');
      }
    },
  };
}

function verifyScrollMarksPlugin() {
  return {
    name: 'pm-verify-scroll-marks',
    apply: 'build',
    buildStart() {
      const { ok, failures, log } = verifyScrollMarks();
      log.forEach(line => console.log(line));
      if (!ok) {
        this.error(`verify-scroll-marks: ${failures} check(s) failed — see above. Fix src/scenes/scroll/scroll.marks.js or scroll.text.js before building.`);
      } else {
        console.log('  ✓ verify-scroll-marks: all checks passed');
      }
    },
  };
}

function verifyResonancesPlugin() {
  return {
    name: 'pm-verify-resonances',
    apply: 'build',
    buildStart() {
      const { ok, failures, log } = verifyResonances();
      log.forEach(line => console.log(line));
      if (!ok) {
        this.error(`verify-resonances: ${failures} check(s) failed — see above. Fix src/resonances.js or the scene .text.js file(s) it points at before building.`);
      } else {
        console.log(`  ✓ verify-resonances: all checks passed`);
      }
    },
  };
}

function prerenderTextPages() {
  let outDir = resolve(HERE, 'dist');
  let root = HERE;
  return {
    name: 'pm-prerender-text',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const n = prerender(outDir);
      console.log(`\n  ✓ prerendered ${n} text pages + sitemap.xml`);
      verifyStyleHash.call(this, outDir, root);
      verifyInlined.call(this, outDir);
    },
  };
}

// The site's Content-Security-Policy as public/.htaccess sends it: the one
// source for what the build may inline as a data: URL and for the gate that
// holds what ships to it. A data: URL is loaded under the directive of
// whatever loads it: an image's img-src, a font's font-src, and anything
// fetched (a JSON's ?url) connect-src, where 'self' alone blocks it.
const contentPolicy = () => Object.fromEntries(
  /Content-Security-Policy "([^"]+)"/.exec(fs.readFileSync(resolve(HERE, 'public/.htaccess'), 'utf8'))[1]
    .split(';').map(d => d.trim().split(/\s+/)).filter(([k]) => k).map(([k, ...v]) => [k, v]));
const directiveFor = mime => (mime.startsWith('image/') ? 'img-src' : mime.startsWith('font/') ? 'font-src' : 'connect-src');
const allowsData = (policy, mime) => (policy[directiveFor(mime)] ?? policy['default-src'] ?? []).includes('data:');
// The type an asset would be inlined as, by its name, as Vite types it.
const MIME_BY_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf' };
function inlineUnderPolicy(file) {
  const mime = MIME_BY_EXT[/\.([a-z0-9]+)(?:\?.*)?$/i.exec(file)?.[1]?.toLowerCase()] ?? 'application/octet-stream';
  // undefined keeps Vite's own size limit; false keeps the file a file.
  return allowsData(contentPolicy(), mime) ? undefined : false;
}

// Every data: URL the build ships, held to the policy that will load it.
function verifyInlined(outDir) {
  const policy = contentPolicy(), dir = resolve(outDir, 'assets'), found = [];
  for (const name of fs.readdirSync(dir).filter(n => /\.(js|css)$/.test(n))) {
    for (const [, mime] of fs.readFileSync(resolve(dir, name), 'utf8').matchAll(/data:([a-z]+\/[a-z0-9.+-]+)[;,]/gi)) found.push({ name, mime: mime.toLowerCase() });
  }
  const blocked = found.filter(f => !allowsData(policy, f.mime));
  if (blocked.length) this.error(`csp-inline: ${blocked.map(b => `${b.name} inlines ${b.mime} as a data: URL, which ${directiveFor(b.mime)} in public/.htaccess blocks`).join('; ')}`);
  console.log(`  ✓ csp-inline: ${found.length} data: URLs shipped, each a type the policy loads from data: (${[...new Set(found.map(f => f.mime))].join(', ')})`);
}

function verifyStyleHash(outDir, root) {
  const pagePath = resolve(outDir, 'text/index.html');
  const html = fs.readFileSync(pagePath, 'utf8');
  const m = html.match(/<style>([\s\S]*?)<\/style>/);
  if (!m) {
    this.error(`csp-style-hash: no inline <style> block found in ${pagePath}. If page() deliberately stopped emitting one, drop PAGE_STYLE_SHA256 and the 'sha256-...' from style-src in public/.htaccess in the same change.`);
  }
  const emitted = `sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}`;

  if (emitted !== PAGE_STYLE_SHA256) {
    this.error(
      `csp-style-hash: page()'s emitted <style> block no longer matches PAGE_STYLE_SHA256.\n` +
      `    emitted:  ${emitted}\n` +
      `    declared: ${PAGE_STYLE_SHA256}\n` +
      `    Fix: put the emitted value in PAGE_STYLE_SHA256 (scripts/prerender.js, right under PAGE_STYLE) ` +
      `and in style-src in public/.htaccess. Both, or the /text/ pages ship unstyled.`
    );
  }

  const htaccessPath = resolve(root, 'public/.htaccess');
  const htaccess = fs.readFileSync(htaccessPath, 'utf8');
  if (!htaccess.includes(`'${emitted}'`)) {
    this.error(
      `csp-style-hash: style-src in public/.htaccess does not allowlist the style block these pages actually emit.\n` +
      `    expected to find: '${emitted}'\n` +
      `    Without it the browser drops the only stylesheet these pages have, and every one of them renders unstyled.`
    );
  }

  console.log(`  ✓ csp-style-hash: ${emitted} matches the emitted page, PAGE_STYLE_SHA256 and .htaccess's style-src`);
}

export default defineConfig({
  plugins: [landingMarkupPlugin(), euphoniaMarkupPlugin(), euphoniaPlacesPlugin(), euphoniaReadingMapPlugin(), verifyEuphoniaReadingPlugin(), euphoniaWheelPlugin(), euphoniaThemesPlugin(), verifyLinksPlugin(), verifyResonancesPlugin(), verifyScrollMarksPlugin(), verifyLandingPlugin(), verifyAriaPlugin(), verifyCssInvariantsPlugin(), verifyCountsPlugin(), verifyQuizWheelPlugin(), verifyBenchPlugin(), euphoniaSheetsPlugin(), verifyEuphoniaPlugin(), verifyEuphoniaMapPlugin(), verifyEuphoniaSrdPlugin(), verifyEuphoniaBuilderPlugin(), verifyEuphoniaTonguesPlugin(), verifyEuphoniaThemesPlugin(), prerenderTextPages()],
  build: {
    assetsInlineLimit: inlineUnderPolicy,
    cssMinify: 'esbuild',
    cssTarget: ['chrome87', 'edge88', 'firefox78', 'safari14'],
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        main:     resolve(HERE, 'index.html'),
        euphonia: resolve(HERE, 'euphonia/index.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
        },
      },
    },
  },
});
