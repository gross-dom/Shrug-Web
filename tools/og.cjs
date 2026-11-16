// Takes the picture a link to the site unfolds into when it is texted or posted:
// the opening of the conversation itself. Needs Playwright and the site running.
//   npm run dev            (in another terminal)
//   node tools/og.cjs      (writes public/og.png, 1200x630)
const { chromium } = require('playwright')
;(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:5173/'
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 600, height: 740 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })).newPage()
  await page.goto(url)
  // Niv's question and the first three answers, at rest
  await page.waitForFunction(() => document.querySelectorAll('.chat__thread [data-person]:not([data-typing])').length >= 3, null, { timeout: 60000 })
  await page.locator('.ph-thread-id').tap()
  await page.locator('.details__row[role="switch"]').tap()
  await page.locator('.ph-sheet__close').tap()
  await page.waitForTimeout(1600)
  await page.evaluate(() => {
    // The conversation from its first line, with the bar and the replies out of the picture
    document.querySelector('.ph-nav').style.visibility = 'hidden'
    document.querySelector('.chat__flow').style.paddingTop = '18px'
    document.querySelector('.chat__scroll').scrollTop = 0
  })
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'public/og.png', clip: { x: 0, y: 0, width: 600, height: 315 } })
  await browser.close()
  console.log('wrote public/og.png')
})().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
