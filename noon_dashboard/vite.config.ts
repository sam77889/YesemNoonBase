import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        // 按第三方包拆独立 chunk，便于长缓存命中与产物体积审计（目标单 chunk ≤ 380KB）
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('recharts') ||
              id.includes('d3-') ||
              id.includes('@react-smooth') ||
              id.includes('victory')
            )
              return 'recharts';
            if (id.includes('framer-motion')) return 'framer-motion';
            if (id.includes('@tanstack')) return 'tanstack';
            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
            return 'vendor';
          }
        },
      },
    },
  },
})
