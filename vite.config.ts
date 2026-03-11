import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Set base to './' for GitHub Pages or any static hosting deployment
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          github: ['@octokit/rest'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
})
