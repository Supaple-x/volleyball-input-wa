import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'VolleyStats',
        short_name: 'VolleyStats',
        description: 'Волейбольная статистика в реальном времени',
        theme_color: '#0F1923',
        background_color: '#0F1923',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\/api\//i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router'],
          'vendor-dexie': ['dexie', 'dexie-react-hooks'],
          'vendor-recharts': ['recharts'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': __dirname + 'src',
    },
  },
  preview: {
    port: 4100,
    host: '0.0.0.0',
    strictPort: true,
  },
  server: {
    port: 4100,
    host: '0.0.0.0',
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3002',
    },
  },
})
