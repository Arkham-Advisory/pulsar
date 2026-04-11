import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// Set base to './' for GitHub Pages or any static hosting deployment
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      injectRegister: false,
      registerType: 'prompt',
      manifest: false,
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'favicon-96x96.png',
        'apple-touch-icon.png',
        'site.webmanifest',
      ],
      workbox: {
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
      },
    }),
  ],
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
