import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  // Tauri's beforeDevCommand and the verify scripts both expect the dev
  // server at exactly this port; fail loudly rather than silently moving.
  server: { port: 5173, strictPort: true },
})
