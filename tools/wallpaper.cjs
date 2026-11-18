// Makes the site's wallpaper from its drawing: tools/wallpaper.svg for the desktop and
// tools/wallpaper-phone.svg for the iPhone (the s of the logo, very large, as ribbons of glass
// over a sky that runs from near-black to blue). Each is drawn at the size it is shown, then
// given the grain and the compression the wallpapers have always had (tools/wallpaper.py does
// that part: without the grain the long gradients band once they are compressed). Needs
// Playwright, and Python with numpy and Pillow.
//   node tools/wallpaper.cjs      (writes public/wallpaper.webp, 2880x1620, and public/wallpaper-phone.webp, 780x1688)
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { chromium } = require('playwright')

// How wide each picture is made. A phone stretches this one less than it did the picture before
// it, a desktop about as much, and neither file is heavier than the one it replaces.
const PICTURES = [
  { from: 'wallpaper.svg', to: 'wallpaper.webp', width: 2880 },
  { from: 'wallpaper-phone.svg', to: 'wallpaper-phone.webp', width: 780 },
]
const QUALITY = 86

;(async () => {
  const browser = await chromium.launch()
  for (const { from, to, width } of PICTURES) {
    const svg = fs.readFileSync(path.join(__dirname, from), 'utf8')
    // The drawing's own shape: the picture keeps it
    const box = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)
    if (!box) throw new Error(`${from} has no viewBox to take its shape from`)
    const height = Math.round((width * box[2]) / box[1])
    const page = await (await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })).newPage()
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${width}px;height:${height}px}</style>${svg}`)
    const drawn = path.join(os.tmpdir(), `${to}.png`)
    await page.screenshot({ path: drawn })
    await page.close()
    execFileSync('python3', [path.join(__dirname, 'wallpaper.py'), 'grain', drawn, path.join(__dirname, '..', 'public', to), String(QUALITY)], { stdio: 'inherit' })
    fs.unlinkSync(drawn)
  }
  await browser.close()
})().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
