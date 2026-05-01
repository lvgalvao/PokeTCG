import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  publicDir: '../assets',
  base: './',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
  },
  server: {
    port: 5173,
    open: false,
  },
});
