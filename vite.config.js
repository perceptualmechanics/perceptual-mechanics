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
    },
  },
});
