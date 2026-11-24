// Writes the file a visitor gets when they download the one-pager from Preview: its two pages, as the site
// draws them (src/apps/preview/OnePager.tsx, from the lines in src/data/onepager.ts), printed at US Letter.
// Run it again whenever those lines change. Needs Playwright and the site running.
//   npm run dev              (in another terminal)
//   node tools/onepager.cjs  (writes public/One-pager.pdf)
const { chromium } = require('playwright')
;(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:5173/'
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  // An address that names the one-pager opens it in Preview
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'still&empty&open=one-pager')
  await page.waitForSelector('.pv-pages .op', { timeout: 60000 })
  const pages = await page.evaluate(async () => {
    await document.fonts.load('600 52px "Inter Variable"').catch(() => {})
    await document.fonts.ready
    // Only the pages are left on the page, each at its own size, one to a sheet
    const sheets = [...document.querySelectorAll('.pv-pages .op')].map((el) => el.cloneNode(true))
    document.body.replaceChildren(...sheets)
    const rules = document.createElement('style')
    rules.textContent = '@page { size: 816px 1056px; margin: 0 } html, body { height: auto !important; margin: 0 !important; overflow: visible !important; background: #fff !important } .op { break-after: page }'
    document.head.append(rules)
    return sheets.length
  })
  await page.pdf({ path: 'public/One-pager.pdf', width: '816px', height: '1056px', printBackground: true })
  console.log(`public/One-pager.pdf: ${pages} pages`)
  await browser.close()
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
