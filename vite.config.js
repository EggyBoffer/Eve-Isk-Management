import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',             // ✅ ensures relative asset paths
  build: {
    outDir: 'dist',       // optional, but matches what you're using
    emptyOutDir: true,    // clean up old builds
  }
})
