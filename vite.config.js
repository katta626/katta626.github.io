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
        observations: resolve(__dirname, 'observations.html'),
        quark: resolve(__dirname, 'quark-matter.html'),
        instruments: resolve(__dirname, 'instruments.html'),
        ml: resolve(__dirname, 'ml.html'),
        gallery: resolve(__dirname, 'gallery.html'),
      },
    },
  },
});
