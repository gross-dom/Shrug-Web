// A picture of the chair in each color that has no photograph yet, for the store's page for it: the chair as
// Workspace draws it (the 3D chair, on that color's ground), taken from the studio itself. A color whose
// photographs arrive drops its drawing (store/src/pictures.ts: DRAWN).
//   npm run build && node tests/checks/serve.cjs dist 4273 &
//   node tools/chair-shots.cjs http://127.0.0.1:4273/     (needs Playwright, and python3 with Pillow)
// It writes store/public/pictures/workspace-<color>-drawn.webp and -drawn-s.webp. Run it again when the
// chair's drawing or a color changes.
const { chromium } = require('playwright')
const { execFileSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')

const BASE = process.argv[2] || 'http://127.0.0.1:4273/'
const OUT = path.join(__dirname, '..', 'store', 'public', 'pictures')
/** The colors with no photographs: the name its dot in the studio has, and the name its files go by. */
const COLORS = [
  ['Solar Orange', 'solar-orange'],
  ['Alexandrite', 'alexandrite'],
  ['Championship Green', 'championship-green'],
  ['Supersonic', 'supersonic'],
  ['Pearl Lavender', 'pearl-lavender'],
  ['Mantis Green', 'mantis-green'],
]
// Nothing but the chair on its ground: the name behind it, the note, the strip and the words are left out
const BARE = '.fl-word, .st-turn, .st-shots, .st-stand, .fl-info, .fl-pick, .fl-buy, .wxbar > *, .st-ring { visibility: hidden !important } .notify, .desk-note { display: none !important }'

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 })
  const page = await ctx.newPage()
  await page.goto(`${BASE}?still&empty&open=workspace`, { waitUntil: 'load' })
  const W = '.wf[data-app="workspace"]'
  await page.waitForSelector(`${W}[data-open] .fl-slab`, { timeout: 30000 })
  await page.locator(`${W} .fl-slab`).nth(2).click()
  await page.waitForSelector(`${W} .st-table[data-3d]`, { timeout: 30000 })
  await page.addStyleTag({ content: BARE })
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chair-'))
  for (const [name, slug] of COLORS) {
    // (the dots are out of sight by now: each is pressed as the page would press it)
    await page.evaluate(([W, name]) => document.querySelector(`${W} .fl-dot[aria-label="${name}"]`).click(), [W, name])
    await page.waitForTimeout(2600)
    // A square about the chair, within the window
    const clip = await page.evaluate((W) => {
      const t = document.querySelector(`${W} .st-table`).getBoundingClientRect()
      const w = document.querySelector(`${W} .ss-window`).getBoundingClientRect()
      const side = 470
      const x = Math.max(w.left, Math.min(w.right - side, t.left + t.width / 2 - side / 2))
      return { x, y: w.bottom - 606, width: side, height: side }
    }, W)
    const png = path.join(tmp, `${slug}.png`)
    await page.screenshot({ path: png, clip })
    execFileSync('python3', ['-c', `
from PIL import Image
im = Image.open(${JSON.stringify(png)}).convert('RGB')
im.resize((1800, 1800), Image.LANCZOS).save(${JSON.stringify(path.join(OUT, `workspace-${slug}-drawn.webp`))}, 'WEBP', quality=86, method=6)
im.resize((760, 760), Image.LANCZOS).save(${JSON.stringify(path.join(OUT, `workspace-${slug}-drawn-s.webp`))}, 'WEBP', quality=82, method=6)
`])
    console.log(`drew ${name}`)
  }
  await browser.close()
})().catch((e) => {
  console.error('FAILED', e.message.split('\n').slice(0, 6).join('\n'))
  process.exit(1)
})
