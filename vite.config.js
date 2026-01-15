import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['tesseract.js'],
  },
  server: {
    port: 3000,
    host: '0.0.0.0', // Allow access from network
    open: true,
    proxy: {
      // Proxy for Expo Push API to avoid CORS issues
      '/api/expo-push': {
        target: 'https://exp.host',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/expo-push/, '/--/api/v2/push'),
        secure: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true, 
  },
})
