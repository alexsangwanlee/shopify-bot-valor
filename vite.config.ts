import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src/renderer/src'),
      '@core': resolve(__dirname, './core'),
      '@utils': resolve(__dirname, './utils'),
      '@config': resolve(__dirname, './config'),
    },
  },
  base: './',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
})
