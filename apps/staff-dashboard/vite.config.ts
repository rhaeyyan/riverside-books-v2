import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Served under /staff/ by the gateway in production; dev keeps the
  // standalone server at localhost:5174/ for HMR.
  base: command === 'build' ? '/staff/' : '/',
  server: { port: 5174 },
  plugins: [react()],
}))
