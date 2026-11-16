// Draws the icons a phone uses for the site when it is added to a Home Screen:
// Shrug's face on its dark tile, square and full to the edges (the phone rounds
// the corners itself). Needs Playwright.
//   node tools/icons.cjs      (writes public/apple-touch-icon.png, icon-192.png, icon-512.png)
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
  await browser.close()
})().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
