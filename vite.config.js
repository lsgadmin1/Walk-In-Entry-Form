import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.CUSTOM_DOMAIN ? '/' : '/Walk-In-Entry-Form/',
  server: {
    host: true, 
    port: 5173,
    strictPort: true
  },
})