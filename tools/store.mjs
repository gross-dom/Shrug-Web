// Puts the store's pages inside the desktop's build, at /vip/: the card (the pack) at /vip/ and the store at
// /vip/store/. They are what the VIP Store window shows (src/apps/Store.tsx), and being served by the same
// site is what lets one login do for both. Run after `vite build`, by `npm run build`.
//
// The store is built by its own folder (store/), as the click-through demo unless the desktop is built
// live (VITE_ACCOUNT=live), in which case its pages talk to the server at /api.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const store = resolve(root, 'store')
const live = process.env.VITE_ACCOUNT === 'live'
const run = (args) => execFileSync('npm', args, { cwd: store, stdio: 'inherit', env: { ...process.env, SHRUG_BASE: '/vip/', ...(live ? {} : { SHRUG_DEMO: '1' }) } })

if (!existsSync(resolve(store, 'node_modules'))) run(['ci', '--no-audit', '--no-fund'])
run(['run', live ? 'build' : 'build:demo'])
// (dist/vip is already there: the site keeps the drops' photographs under that name. The store's pages go in beside them)
cpSync(resolve(store, 'dist'), resolve(root, 'dist/vip'), { recursive: true })
console.log(`the store is in dist/vip (${live ? 'live' : 'demo'})`)
