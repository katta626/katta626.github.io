import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Relative base so the build works from GitHub Pages project paths and Netlify alike.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        ml: resolve(__dirname, 'ml.html'),
        gallery: resolve(__dirname, 'gallery.html'),
      },
    },
  },
});
