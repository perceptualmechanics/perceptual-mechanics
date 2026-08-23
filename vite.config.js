import { resolve } from 'path';
import { defineConfig } from 'vite';
import { prerender } from './scripts/prerender.js';
import { verifyLinks } from './scripts/verify-links.mjs';
import { verifyResonances } from './scripts/verify-resonances.mjs';

// ─── Link store verification ────────────────────────────────────────────────
// Same reasoning as prerenderTextPages() below, same fix: a plain npm
// "prebuild" script would silently never run against the bare
// `npx vite build` this repo actually gets verified with (NOTES.md).
// buildStart, not closeBundle — this should fail loud and fail first,
// before spending time on the rest of the build, not after dist/ already
// has output in it.
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

// ─── Resonance store verification ───────────────────────────────────────────
// Same reasoning and same fix as verifyLinksPlugin() above, for
// src/resonances.js instead of src/links.js — added Phase 3 (2026-08-16),
// now that the harmonics scene actually reads RESONANCES at runtime.
// Previously `npm run verify-resonances` only ran when someone remembered
// to type it by hand; a broken or unresolvable row could reach a build
// silently. buildStart, same as verify-links, so both fail before either
// wastes time on the rest of the build.
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

// ─── Static text pages ──────────────────────────────────────────────────────
// Runs as a build plugin rather than as a second `npm run build` step on
// purpose: verification around here is almost always a bare `npx vite build`
// (see NOTES.md, most entries), and a script-chain would quietly skip the
// prerender exactly when it's being checked. closeBundle fires after the
// public/ passthrough copy, so the generated sitemap.xml lands last and wins.
function prerenderTextPages() {
  let outDir = resolve(__dirname, 'dist');
  return {
    name: 'pm-prerender-text',
    apply: 'build',
    // Take the real, resolved outDir rather than assuming 'dist' — a build
    // run with --outDir elsewhere should still get its text pages, and
    // hardcoding the default would silently write them into the wrong place.
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const n = prerender(outDir);
      console.log(`\n  ✓ prerendered ${n} text pages + sitemap.xml`);
    },
  };
}

export default defineConfig({
  plugins: [verifyLinksPlugin(), verifyResonancesPlugin(), prerenderTextPages()],
  build: {
    rollupOptions: {
      input: {
        main:     resolve(__dirname, 'index.html'),
        // utils/shorts.html removed 2026-07-23 (Scott deleted the file
        // directly) -- had to drop this entry too, or every build fails
        // outright with "Could not resolve entry module".
        bardDemo: resolve(__dirname, 'packages/bardjs/demo/index.html'),
      },
      output: {
        // All nine scenes render as landing-page previews at once (see
        // initPreviews() in main.js), so none of their code can be code-
        // split behind a dynamic import() the way a more conventional
        // route-per-page site would -- every scene is genuinely needed on
        // first load. What CAN split cleanly: three.js itself barely
        // changes between deploys, while the app code (all nine scenes)
        // changes on nearly every one this week alone. Bundled together,
        // every deploy invalidates the visitor's cached copy of three.js
        // too, forcing a full ~1MB re-download for a one-line CSS tweak.
        // Splitting it into its own chunk means a returning visitor (or
        // Scott re-checking a deploy) only re-fetches the smaller app
        // chunk after most changes -- three.js's own chunk keeps its
        // cache hit. Doesn't reduce first-visit bytes at all, only
        // improves repeat-visit/repeat-deploy caching.
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
