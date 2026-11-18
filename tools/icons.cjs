// Draws the icons a phone uses for the site when it is added to a Home Screen:
// Shrug's face on its dark tile, square and full to the edges (the phone rounds
// the corners itself). Needs Playwright.
// And the icon a browser asks for by name when it will not take the SVG one: the
// same face on its rounded tile, at three sizes in one favicon.ico.
//   node tools/icons.cjs      (writes public/apple-touch-icon.png, icon-192.png, icon-512.png, favicon.ico)
const fs = require('fs')
const { chromium } = require('playwright')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a40"/><stop offset="1" stop-color="#0c0c0e"/></linearGradient></defs>
  <rect width="100" height="100" fill="url(#bg)"/>
  <g fill="none" stroke="#fff" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M28 36.500l5.600 11"/><path d="M42.500 32.500l5.500 11"/><path d="M70.500 32.500c-1.200 15.600-11.200 25.600-28.700 28.800"/>
  </g>
</svg>`
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
