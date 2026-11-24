import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The store's pages. They are served under /store/ (the card is the site's front page: see build.mjs), and
// are built in one of two ways: for real, where they talk to the server in api/; or as the click-through
// demo (SHRUG_DEMO=1), where a stand-in that lives in the browser answers instead and nothing is sent anywhere.
//
// SHRUG_BASE moves the whole site under a path of another: with /vip/ the card is at /vip/ and the store
// at /vip/store/, which is how the desktop site carries it (its build puts this one in its own dist/vip).
// The server's address does not move: it is /api on whatever site the pages are served from.
const BASE = `/${(process.env.SHRUG_BASE ?? '').replace(/^\/+|\/+$/g, '')}/`.replace('//', '/')

export default defineConfig({
  base: `${BASE}store/`,
  plugins: [react()],
  define: { __DEMO__: JSON.stringify(process.env.SHRUG_DEMO === '1') },
  build: { target: 'es2022', outDir: 'dist/store', emptyOutDir: true },
  server: { host: '127.0.0.1' },
})
