import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { arrival, page } from './tools/page'

export default defineConfig({
  plugins: [react(), page(), arrival()],
  build: { target: 'es2022' },
  server: { host: '127.0.0.1' },
  resolve: { dedupe: ['react', 'react-dom'] },
})
