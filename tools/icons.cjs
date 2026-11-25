// Draws the icons a phone uses for the site when it is added to a Home Screen:
// Shrug's wordmark, white across a black tile, square and full to the edges
// (the phone rounds the corners itself). Needs Playwright.
// And the tab's icon: public/favicon.svg, the same tile with its corners
// rounded, and the pictures of it a browser asks for by name when it will not
// take the SVG one, at three sizes in one favicon.ico.
//   node tools/icons.cjs      (writes public/apple-touch-icon.png, icon-192.png, icon-512.png, favicon.svg, favicon.ico)
const fs = require('fs')
const { chromium } = require('playwright')
// The one drawing of the wordmark (store/shared/wordmark.ts), set across the tile's middle
const drawing = fs.readFileSync('store/shared/wordmark.ts', 'utf8')
const SHRUG = /export const SHRUG = '([^']+)'/.exec(drawing)[1]
const WIDE = 4379
const TALL = 782
const across = (share) => {
  const scale = (180 * share) / WIDE
  return `translate(${(90 - (WIDE * scale) / 2).toFixed(2)} ${(90 - (TALL * scale) / 2).toFixed(2)}) scale(${scale.toFixed(5)})`
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><rect width="180" height="180" fill="#000"/><path fill="#fff" transform="${across(0.78)}" d="${SHRUG}"/></svg>`
fs.writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">
  <clipPath id="tile"><rect width="180" height="180" rx="40"/></clipPath>
  <g clip-path="url(#tile)">
    <rect width="180" height="180" fill="#000"/>
    <path fill="#fff" transform="${across(0.84)}" d="${SHRUG}"/>
  </g>
</svg>
`,
)
console.log('wrote public/favicon.svg')
;(async () => {
  const browser = await chromium.launch()
  for (const [file, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
    const page = await (await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })).newPage()
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`)
    await page.screenshot({ path: `public/${file}` })
    console.log('wrote public/' + file)
  }
  // favicon.ico: the tab's icon (public/favicon.svg) as pictures, for whatever asks for /favicon.ico
  const tile = fs.readFileSync('public/favicon.svg', 'utf8')
  const pictures = []
  for (const size of [16, 32, 48]) {
    const page = await (await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })).newPage()
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${tile}`)
    pictures.push({ size, png: await page.screenshot({ omitBackground: true }) })
  }
  // An .ico is a short directory and then the pictures themselves, which may be PNGs as they are
  const head = Buffer.alloc(6 + 16 * pictures.length)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(pictures.length, 4)
  let at = head.length
  pictures.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i
    head.writeUInt8(size, entry)
    head.writeUInt8(size, entry + 1)
    head.writeUInt16LE(1, entry + 4)
    head.writeUInt16LE(32, entry + 6)
    head.writeUInt32LE(png.length, entry + 8)
    head.writeUInt32LE(at, entry + 12)
    at += png.length
  })
  fs.writeFileSync('public/favicon.ico', Buffer.concat([head, ...pictures.map((p) => p.png)]))
  console.log('wrote public/favicon.ico')
  await browser.close()
})().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
