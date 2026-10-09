import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'renderer',
  base: './',
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '~': fileURLToPath(new URL('./renderer/src', import.meta.url)) },
  },
  server: { port: 5174, strictPort: true },
  build: { outDir: '../dist-renderer', emptyOutDir: true },
  test: {
    root: '.',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
