import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vitejs.dev/config/
// viteSingleFile inlines all JS/CSS into a single index.html, so the production
// build is ONE self-contained file. This avoids broken /assets paths and missing
// asset-folder uploads on static/shared hosts (e.g. Hostinger) — the cause of
// blank white screens. Dev (npm run dev) is unaffected and still uses the proxy.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
