import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          router: ['react-router-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 750,
  },
})
