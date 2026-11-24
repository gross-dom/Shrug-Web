import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { arrival, page } from './tools/page'
import { pdfData } from './tools/pdfjs.mjs'

export default defineConfig({
  plugins: [react(), page(), arrival(), pdfData()],
  build: { target: 'es2022' },
  server: { host: '127.0.0.1' },
  resolve: { dedupe: ['react', 'react-dom'] },
})
