import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
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
        // All eight scenes render as landing-page previews at once (see
        // initPreviews() in main.js), so none of their code can be code-
        // split behind a dynamic import() the way a more conventional
        // route-per-page site would -- every scene is genuinely needed on
        // first load. What CAN split cleanly: three.js itself barely
        // changes between deploys, while the app code (all eight scenes)
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
