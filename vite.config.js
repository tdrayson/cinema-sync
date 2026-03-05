import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/cinema-sync/',
  build: { outDir: 'docs', assetsInlineLimit: 0 },
  plugins: [vue(), tailwindcss()],
});
