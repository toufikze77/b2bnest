// vite.config.js
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,                  // so Vite listens on all interfaces
    allowedHosts: ['.replit.dev'] // allow Replit preview domains
  }
})
