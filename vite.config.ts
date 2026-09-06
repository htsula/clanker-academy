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
    // a hard failure; `npm run predev` gets there first and names the process
    // responsible, and `npm run dev:force` is the opt-in that reclaims the port.
    port: 5173,
    strictPort: true,
  },
  assetsInclude: ['**/*.clank'],
})
