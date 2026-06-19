import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Normal multi-file production build: a hashed JS/CSS bundle under /assets plus a
// small index.html, just like any standard React app. The earlier blank-screen
// problem on shared hosts was caused by deploying only index.html (the /assets
// folder was missing) — NOT by multi-file output. We fix it the right way:
//   - base: '/'           -> assets resolve from the domain root on any route
//   - the whole dist/ dir (index.html + assets/ + .htaccess) is deployed together
//   - public/.htaccess     -> SPA deep-link fallback for React Router
// Dev (npm run dev) is unaffected and still uses the proxy below.
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split big third-party libs into their own long-cached chunks instead
        // of one monolithic bundle.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts-vendor': ['recharts'],
          'query-vendor': ['@tanstack/react-query', 'axios'],
        },
      },
    },
  },
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
