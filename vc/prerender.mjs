// Writes each page of Shrug.VC as HTML of its own. `vite build` has already made the site (vc/dist) with
// one page, empty until its script runs; this draws every page ahead of time and writes it into a file at
// its address (/portfolio is dist/portfolio.html), with the title and description that page has. A visitor,
// a link preview or a search engine is then given the page itself, and the script takes it over as it stands.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))
const dist = resolve(here, 'dist')
const drawn = resolve(here, '.ssr')

// The same pages, built to run here and not in a browser
await build({ configFile: resolve(here, 'vite.config.ts'), logLevel: 'warn', build: { ssr: resolve(here, 'src/entry-server.tsx'), outDir: drawn, emptyOutDir: true } })
const { render, ROUTES, SITE } = await import(pathToFileURL(resolve(drawn, 'entry-server.js')).href)

const said = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const page = readFileSync(resolve(dist, 'index.html'), 'utf8')

for (const route of ROUTES) {
  const address = new URL(route.path, SITE.url).href
  const head = [
    `<title>${said(route.title)}</title>`,
    `<meta name="description" content="${said(route.description)}" />`,
    `<link rel="canonical" href="${address}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${said(SITE.legalName)}" />`,
    `<meta property="og:title" content="${said(route.title)}" />`,
    `<meta property="og:description" content="${said(route.description)}" />`,
    `<meta property="og:url" content="${address}" />`,
    // The wordmark, white on black (vc/public/social.png)
    `<meta property="og:image" content="${new URL('/social.png', SITE.url).href}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${said(SITE.legalName)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join('\n    ')
  const html = page.replace('<!--head-->', head).replace('<!--app-->', render(route.path))
  const file = resolve(dist, route.path === '/' ? 'index.html' : `${route.path.slice(1)}.html`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html)
  console.log(`${route.path.padEnd(12)} ${(html.length / 1024).toFixed(0)} KB`)
}

rmSync(drawn, { recursive: true, force: true })
