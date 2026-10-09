import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  // .env.local fica na raiz do repositório, não em src/.
  envDir: __dirname,
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
