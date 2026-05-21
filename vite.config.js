import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://79pgwtvr-3000.inc1.devtunnels.ms',
        changeOrigin: true,
        secure: false,
      },
      '/auth': {
        target: 'https://79pgwtvr-3000.inc1.devtunnels.ms',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
