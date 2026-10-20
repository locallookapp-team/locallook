import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'LocalLook',
        short_name: 'LocalLook',
        description: 'Discover and review places in Tablas Island.',
        theme_color: '#2563EB',
        background_color: '#F8FAFC',
        start_url: '/map',
        display: 'standalone', 
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' 
          }
        ]
      },
      // 🚀 ADD THIS NEW BLOCK:
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000 // Increases limit to 5 MB
      }
    })
  ]
});