import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../public/dist'),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/v1': 'http://localhost:5454',
      '/uploads': 'http://localhost:5454',
      '/socket.io': {
        target: 'http://localhost:5454',
        ws: true,
      },
    },
  },
})
