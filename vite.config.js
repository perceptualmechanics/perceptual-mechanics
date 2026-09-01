import { createHash } from 'crypto';
import fs from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import { prerender, PAGE_STYLE_SHA256 } from './scripts/prerender.js';
import { verifyLinks } from './scripts/verify-links.mjs';
import { verifyResonances } from './scripts/verify-resonances.mjs';
import { verifyScrollMarks } from './scripts/verify-scroll-marks.mjs';

// Vite 8 warns that `configLoader: 'native'` is planned to become the default.
// Under that loader this config is handed to Node as real ESM instead of being
// pre-bundled, and the CJS `__dirname` Vite injects today stops existing.
// `import.meta.dirname` is the ESM equivalent; it needs Node 20.11+, and this
// repo requires 22 (package.json engines) with CI on 24, so there is no floor
// to worry about. Named rather than inlined so the reason lives in one place.
const HERE = import.meta.dirname;

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
// ─── Scroll presentation-table verification ─────────────────────────────────
// Same reasoning and same fix as the two plugins above, for
// src/scenes/scroll/scroll.marks.js. RUBRICS and INTENSITIES carry verbatim
// copies of phrases from scroll.text.js plus hard-coded paragraph indices, and
// every way of getting one wrong renders perfectly and silently: a phrase that
// drifts by one character, or a paragraph inserted above the recorded index,
// just stops styling that passage with nothing logged anywhere. LINKS has had a
// verifier since 2.3.0; these five tables never did. buildStart, like the other
// two, so all three fail before the build spends time on anything else.
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

// ─── Static text pages ──────────────────────────────────────────────────────
// Runs as a build plugin rather than as a second `npm run build` step on
// purpose: verification around here is almost always a bare `npx vite build`
// (see NOTES.md, most entries), and a script-chain would quietly skip the
// prerender exactly when it's being checked. closeBundle fires after the
// public/ passthrough copy, so the generated sitemap.xml lands last and wins.
function prerenderTextPages() {
  let outDir = resolve(HERE, 'dist');
  let root = HERE;
  return {
    name: 'pm-prerender-text',
    apply: 'build',
    // Take the real, resolved outDir rather than assuming 'dist' — a build
    // run with --outDir elsewhere should still get its text pages, and
    // hardcoding the default would silently write them into the wrong place.
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

// ─── Inline-style CSP hash: the drift guard ─────────────────────────────────
// The prerendered pages carry one inline <style> and link no stylesheet, so
// the CSP in public/.htaccess has to allowlist that block by SHA-256 hash.
// A hash is a derived artifact, and a hand-maintained one is exactly the
// thing this project's standing rules say not to keep. It was already
// wrong once, in the worst possible way: style-src shipped as plain 'self'
// with no hash at all, so from v3.12.1 to v4.0 every /text/ page was
// unstyled in production (document.styleSheets.length === 0) with nothing
// failing anywhere to say so.
//
// So don't trust any single copy of it. This re-derives the hash from the
// bytes actually written to disk a moment ago and checks all three places
// that have to agree:
//
//   1. the <style> block in the emitted text/index.html — the real artifact
//      the browser will hash, not the template it came from;
//   2. PAGE_STYLE_SHA256, the constant declared next to the style text in
//      scripts/prerender.js;
//   3. the style-src directive in public/.htaccess, the policy that
//      actually ships.
//
// Any disagreement is a build failure with the correct value printed, so
// the next CSS tweak in page()'s style block breaks the build — loudly,
// locally, before deploy — instead of silently unstyling the archive again.
// Checked here in closeBundle rather than buildStart because the point is
// to hash the emitted page, not the source constant; verify-links and
// verify-resonances still guard the front of the build.
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

  // The policy file itself, not a copy of it — .htaccess is hand-edited and
  // is the half that was wrong last time.
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
  plugins: [verifyLinksPlugin(), verifyResonancesPlugin(), verifyScrollMarksPlugin(), prerenderTextPages()],
  build: {
    // ─── CSS target: pinned, because Vite 8 quietly moved it ─────────────
    // Vite 8 (Rolldown) defaults to a newer browser baseline than Vite 6
    // did, and the visible consequence is that its CSS minifier rewrites
    // `(min-width: 601px)` into Media Queries Level 4 range syntax,
    // `(width>=601px)`. Measured across the upgrade: Vite 6 emitted ZERO
    // range-syntax queries, Vite 8 emitted 64 — every responsive rule the
    // site has.
    //
    // Range syntax needs Chrome 104 / Firefox 102 / Safari 16.4. This
    // project deliberately supports older Safari than that and says so in
    // STANDARDS.md, twice with reasoning attached: `-webkit-mask` is kept
    // paired for Safari below 15.4, and `-webkit-backdrop-filter` for
    // Safari 9–17. A browser old enough to need those prefixes cannot parse
    // a single one of these 64 queries — and because the CSS here is
    // mobile-first, failing to parse a `min-width` query doesn't break the
    // page, it silently serves the small-viewport layout to a desktop.
    // Wide, silent, and visual: the exact shape this upgrade was slowed
    // down to look for, just arriving through the minifier rather than
    // through the nesting flattener that was predicted.
    //
    // Pinned to Vite 6's own default target ('modules') so the emitted CSS
    // is unchanged by the bundler swap. Raise it deliberately, with a
    // support decision written down, never as a side effect of an upgrade.
    // ─── CSS minifier: pinned to esbuild ────────────────────────────────
    // Vite 8 replaced Rollup with Rolldown and brought a new, more
    // aggressive CSS minifier with it. Three things it did to this
    // stylesheet, all silent, all found by diffing declaration counts
    // between a Vite 6 build and a Vite 8 one rather than by anything
    // failing:
    //
    //   1. Deleted the `align-items: center` fallback sitting in front of
    //      `align-items: safe center`, shipping only the safe form — which
    //      Safari below 16.4 cannot parse, so the landing grid lost its
    //      centering entirely there. (Also fixed at the source, in
    //      styles/main.css, by stating it as @supports; see that comment.)
    //   2. Deleted the unprefixed `backdrop-filter`, keeping only
    //      `-webkit-backdrop-filter`. Exactly backwards: Firefox supports
    //      the unprefixed property and does not support the -webkit- alias,
    //      so modern Firefox lost the blur on the nav bar entirely.
    //   3. Deleted `-webkit-transform: translateZ(0)` from scroll.css —
    //      which STANDARDS.md keeps deliberately, not for support but as a
    //      targeted workaround for a Safari filter+animation compositing
    //      bug, with a note saying to re-verify that bug before removing
    //      it. A minifier cannot know the difference between a prefix kept
    //      for support and one kept for a bug.
    //
    // Points 2 and 3 cannot be fixed by tuning cssTarget: the target that
    // keeps `min-width` syntax (Firefox below 102) is the same target that
    // convinces the minifier unprefixed `backdrop-filter` is dead code
    // (Firefox below 103). The two requirements are one version apart and
    // point opposite ways, so the target is the wrong lever.
    //
    // esbuild is the minifier every shipped build of this site has used.
    // Pinning to it makes the CSS output of this upgrade byte-identical to
    // Vite 6's for 11 of 12 stylesheets — the twelfth differs only by the
    // @supports change above — and a full declaration-count audit across
    // both builds shows zero properties lost. Vite 8 no longer bundles
    // esbuild, hence the explicit devDependency.
    cssMinify: 'esbuild',
    cssTarget: ['chrome87', 'edge88', 'firefox78', 'safari14'],
    // Superseded 2026-08-31 (v3.10.0): all ten scenes are now behind
    // dynamic import() in main.js's SCENES registry (see its own header
    // comment there), each landing in its own sub-500kB chunk. The one
    // chunk left that legitimately exceeds the default 500kB warning is
    // three.js's own vendor chunk below (~565kB) — a real, understood,
    // irreducible cost (it's one third-party library, not our code, and
    // splitting scenes further can't shrink it), not the "every scene's
    // code bundled together" problem this warning used to be flagging.
    // Raised rather than left to fire on every build now that it's
    // pointing at something already accounted for; if a future change
    // ever pushes a scene chunk (not three.js) past this, the warning
    // should come back — don't raise it further without checking why
    // first.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        main:     resolve(HERE, 'index.html'),
        // utils/shorts.html removed 2026-07-23 (Scott deleted the file
        // directly) -- had to drop this entry too, or every build fails
        // outright with "Could not resolve entry module".
        // packages/bardjs/demo/index.html is deliberately NOT a build
        // input (removed 2026-09-01, v4.0) -- don't add it back. As an
        // input it shipped to dist/packages/bardjs/demo/ on every deploy,
        // where it was broken on arrival and reachable by anyone who
        // guessed the path: the enforcing CSP in public/.htaccess blocks
        // its 7,599-byte inline <style> (so it renders completely
        // unstyled) and blocks its <script type="importmap"> too -- and
        // that importmap was already dead weight in a built copy, since
        // Vite rewrites the demo's entry to a bundled chunk and the bare
        // specifiers the map exists to resolve never appear. Nothing on
        // the site links to it and robots.txt already Disallows the path,
        // so it was pure broken surface area.
        //
        // The demo source stays exactly where it is -- it's still the
        // right way to exercise bardjs standalone locally (serve
        // packages/bardjs/demo/ directly, where the inline style and the
        // importmap both work because no CSP and no bundler are in play).
        // This only stops it being built and deployed.
      },
      output: {
        // three.js barely changes between deploys, while the app code
        // (all ten scenes, main.js) changes on nearly every deploy.
        // Without this, every scene chunk that imports 'three' would get
        // its own copy of it inlined (confirmed via build output -- no
        // per-scene chunk approaches three.js's size, so Rollup is
        // correctly deduplicating it here rather than duplicating it
        // per dynamic-import chunk), and every deploy would invalidate a
        // returning visitor's cached copy of three.js too, forcing a
        // full ~565kB re-download for a one-line CSS tweak. This chunk
        // keeps its own cache hit across deploys that don't touch
        // three.js itself.
        // Vite 8 swapped Rollup for Rolldown, which takes manualChunks only
        // as a function — the object form silently was never supported and
        // fails loudly with "manualChunks is not a function". Same intent,
        // same single three.js chunk; expressed as the id predicate the new
        // bundler wants. Verified after the upgrade by confirming the chunk
        // still exists and still holds three.js alone.
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
        },
      },
    },
  },
});
