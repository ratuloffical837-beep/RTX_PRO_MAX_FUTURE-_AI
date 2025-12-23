import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // Render Env Variables সাপোর্ট করার জন্য
    'process.env': process.env
  },
  server: { host: true, port: 3000 }
})
