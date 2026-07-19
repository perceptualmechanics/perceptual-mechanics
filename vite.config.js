import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main:     resolve(__dirname, 'index.html'),
        shorts:   resolve(__dirname, 'utils/shorts.html'),
        bardDemo: resolve(__dirname, 'packages/bardjs/demo/index.html'),
      },
    },
  },
});
