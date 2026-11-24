import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// What pdf.js fetches when a document needs it, served by the site itself at /pdfjs/: the fourteen standard
// fonts a PDF may name without carrying (a document typed in Helvetica), and the decoders for the kinds of
// picture a browser cannot read (JPEG 2000, JBIG2) with the color profiles' own. Preview is what asks
// (src/apps/preview/pdf.ts), and only for a document that has such a thing in it.

const here = dirname(fileURLToPath(import.meta.url))
const from = resolve(here, '../node_modules/pdfjs-dist')
const FOLDERS = ['standard_fonts', 'wasm', 'iccs']
const TYPES = { '.wasm': 'application/wasm', '.js': 'text/javascript', '.ttf': 'font/ttf', '.pfb': 'application/octet-stream', '.icc': 'application/vnd.iccprofile' }
const kept = (name) => !/^LICENSE/.test(name)

/** A plugin for vite.config.ts. */
export function pdfData() {
  return {
    name: 'shrug:pdf-data',
    // The build has them as files of its own
    generateBundle() {
      for (const folder of FOLDERS) {
        const dir = join(from, folder)
        if (!existsSync(dir)) continue
        for (const name of readdirSync(dir).filter(kept)) this.emitFile({ type: 'asset', fileName: `pdfjs/${folder}/${name}`, source: readFileSync(join(dir, name)) })
      }
    },
    // The dev server hands them over from where they are installed
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const asked = /^\/pdfjs\/([a-z_]+)\/([\w.-]+)$/.exec((req.url ?? '').split('?')[0] ?? '')
        const file = asked && FOLDERS.includes(asked[1]) && kept(asked[2]) ? join(from, asked[1], asked[2]) : null
        if (!file || !existsSync(file)) return next()
        res.setHeader('Content-Type', TYPES[/\.[a-z0-9]+$/.exec(file)?.[0] ?? ''] ?? 'application/octet-stream')
        res.end(readFileSync(file))
      })
    },
  }
}
