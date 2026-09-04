import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // tauri.conf.json hardcodes devUrl http://localhost:5173. Vite's default is
    // to drift to the next free port when this one is taken, which makes the
    // Tauri window load whichever older server still holds 5173 — a stale build
    // shown as the current one. strictPort turns that silent substitution into
    // a hard failure; `npm run predev` reclaims the port first so the failure
    // only fires for a cause worth stopping on.
    port: 5173,
    strictPort: true,
  },
  assetsInclude: ['**/*.clank'],
})
