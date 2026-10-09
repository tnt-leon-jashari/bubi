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
  build: {
    outDir: '../dist-renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./renderer/index.html', import.meta.url)),
        lab: fileURLToPath(new URL('./renderer/lab.html', import.meta.url)),
      },
    },
  },
  test: {
    root: '.',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
