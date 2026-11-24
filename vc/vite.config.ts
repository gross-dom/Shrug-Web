import { cpSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Shrug.VC: the firm's own site. It is one of the sites kept in this repository, in a folder of its own,
// and is built by itself (`npm run build:vc`) into vc/dist. What it says is read from the same data the
// desktop site reads (src/data: the quotes, the portfolio, the FAQs, the drops), so the two never disagree,
// and the pictures that data names (faces, the drops' photographs) are copied in from public/.

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/** In development the shared pictures are served from where they are kept, the drops' under the name this site gives them. */
function sharedPicturesServed(): Plugin {
  return {
    name: 'shrug-vc:shared-pictures-served',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const found = /^\/(people|drops)\/([^?]+)/.exec(req.url ?? '')
        const file = found && resolve(root, 'public', found[1] === 'drops' ? 'vip' : found[1]!, decodeURIComponent(found[2]!))
        if (!file || !file.startsWith(resolve(root, 'public')) || !existsSync(file)) return next()
        res.setHeader('Content-Type', file.endsWith('.webp') ? 'image/webp' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.png') ? 'image/png' : file.endsWith('.avif') ? 'image/avif' : 'image/jpeg')
        res.end(readFileSync(file))
      })
    },
  }
}

/** The pictures the shared data names, taken from the repository's public folder into this site's build. */
function sharedPictures(): Plugin {
  return {
    name: 'shrug-vc:shared-pictures',
    apply: 'build',
    closeBundle() {
      // Only into the site itself: the copy of the pages that vc/prerender.mjs builds to draw them needs none
      if (this.environment.config.build.ssr) return
      // The companies' app icons (public/logos) are left behind: this site shows wordmarks, not icons
      cpSync(resolve(root, 'public/people'), resolve(here, 'dist/people'), { recursive: true })
      // The drops' photographs are kept at /vip on the desktop site. Here /vip is a page, so they go by another name (pictureOf, in src/content.ts)
      cpSync(resolve(root, 'public/vip'), resolve(here, 'dist/drops'), { recursive: true })
    },
  }
}

/** How large a WebP picture is, read from the head of its file (its three kinds each say it differently). */
function sizeOfWebp(file: string): [number, number] | null {
  const head = readFileSync(file).subarray(0, 32)
  const kind = head.toString('latin1', 12, 16)
  if (kind === 'VP8X') return [1 + head.readUIntLE(24, 3), 1 + head.readUIntLE(27, 3)]
  if (kind === 'VP8 ') return [head.readUInt16LE(26) & 0x3fff, head.readUInt16LE(28) & 0x3fff]
  if (kind === 'VP8L') {
    const bits = head.readUInt32LE(21)
    return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)]
  }
  return null
}

/** `virtual:picture-sizes`: the width and height of each of the drops' photographs, by its address, so
 * that the wall can leave each its room before it has loaded and nothing on the page jumps as they arrive. */
function pictureSizes(): Plugin {
  const name = 'virtual:picture-sizes'
  return {
    name: 'shrug-vc:picture-sizes',
    resolveId: (id) => (id === name ? '\0' + name : null),
    load(id) {
      if (id !== '\0' + name) return null
      const folder = resolve(root, 'public/vip')
      const sizes = Object.fromEntries(
        readdirSync(folder)
          .filter((file) => file.endsWith('.webp'))
          .flatMap((file) => {
            const size = sizeOfWebp(resolve(folder, file))
            return size ? [[`/vip/${file}`, size]] : []
          }),
      )
      return `export default ${JSON.stringify(sizes)}`
    },
  }
}

export default defineConfig({
  root: here,
  plugins: [react(), pictureSizes(), sharedPictures(), sharedPicturesServed()],
  resolve: { alias: { '@data': resolve(root, 'src/data') }, dedupe: ['react', 'react-dom'] },
  define: {
    // The case studies are one PDF, kept in vc/public. Until it is there the menu's link goes to the page they are on today.
    __CASE_STUDIES_PDF__: JSON.stringify(existsSync(resolve(here, 'public/shrug-case-studies.pdf'))),
    // The year in the copyright line as the pages are written: the page corrects it by the clock once it runs (src/year.ts)
    __BUILT_IN__: JSON.stringify(new Date().getFullYear()),
  },
  build: { target: 'es2022', outDir: resolve(here, 'dist'), emptyOutDir: true },
  server: { host: '127.0.0.1', fs: { allow: [root] } },
})
