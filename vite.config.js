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
import { verifyQuizWheel } from './scripts/quiz-wheel.mjs';

const HERE = import.meta.dirname;

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
    },
  };
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
  plugins: [verifyLinksPlugin(), verifyResonancesPlugin(), verifyScrollMarksPlugin(), verifyLandingPlugin(), verifyAriaPlugin(), verifyCssInvariantsPlugin(), verifyCountsPlugin(), verifyQuizWheelPlugin(), prerenderTextPages()],
  build: {
    cssMinify: 'esbuild',
    cssTarget: ['chrome87', 'edge88', 'firefox78', 'safari14'],
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        main:     resolve(HERE, 'index.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
        },
      },
    },
  },
});
