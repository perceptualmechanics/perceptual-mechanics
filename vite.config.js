import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main:   resolve(__dirname, 'index.html'),
        shorts: resolve(__dirname, 'utils/shorts.html'),
        nebula: resolve(__dirname, 'utils/nebula-curator.html'),
      },
    },
  },
});
