import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  build: {
    // Split vendor code into separate cacheable chunks
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — almost never changes, cached aggressively
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Supabase client
          'vendor-supabase': ['@supabase/supabase-js'],
          // Date utilities
          'vendor-date': ['date-fns'],
          // Icon library
          'vendor-icons': ['lucide-react'],
        },
      },
    },
    // Raise warning threshold — 600KB is fine for a chunked app
    chunkSizeWarningLimit: 600,
    // Minify with esbuild (default, fastest)
    minify: 'esbuild',
    // Generate source maps for production debugging (optional — remove if you want)
    sourcemap: false,
  },

  // Ensure env vars are validated at build time
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
})
