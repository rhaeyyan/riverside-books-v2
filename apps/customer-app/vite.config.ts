import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Served under /shop/ by the gateway in production; dev keeps the
  // standalone server at localhost:5173/ for HMR.
  base: command === 'build' ? '/shop/' : '/',
  server: { port: 5173 },
  plugins: [react()],
}))
