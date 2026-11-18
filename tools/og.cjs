// Takes the picture a link to the site unfolds into when it is texted or posted:
// the opening of the conversation, as it is on the iPhone. Needs Playwright and
// the site running.
//   npm run dev            (in another terminal)
//   node tools/og.cjs      (writes public/og.png, 1200x630)
const { chromium } = require('playwright')
;(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:5173/'
  const browser = await chromium.launch()
  // A phone in the hand, 480 points across: 1200 pixels at this scale
  const page = await (await browser.newContext({ viewport: { width: 480, height: 800 }, deviceScaleFactor: 2.5, hasTouch: true, isMobile: true })).newPage()
  // A link that names the chat arrives in the conversation
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'open=chat')
  // Shrug's question and the first answer to it, before the second is on its way
  await page.waitForFunction(() => document.querySelectorAll('.chat__thread [data-person]:not([data-typing])').length >= 1, null, { timeout: 60000 })
  await page.waitForTimeout(600)
  await page.evaluate((room) => {
    // Only the messages, set in the middle of the picture: the bars and the date line are left out
    for (const el of document.querySelectorAll('.ios-bar, .ios-foot, .msg-edge, .sb-homebar')) el.style.visibility = 'hidden'
    for (const el of document.querySelectorAll('.msg-convo .chat-stamp, .msg-convo .chat-note')) el.style.display = 'none'
    const flow = document.querySelector('.msg-convo .chat__flow')
    flow.style.paddingTop = '0px'
    flow.style.paddingTop = `${Math.max(10, (room - document.querySelector('.msg-convo .chat__thread').offsetHeight) / 2)}px`
    document.querySelector('.msg-convo .chat__scroll').scrollTop = 0
    // Whose conversation it is: the mark and the name in a corner, so the picture says so on its own
    const mark = document.createElement('div')
    mark.textContent = 'Shrug  ¯\\_(ツ)_/¯'
    mark.style.cssText = `position:fixed;left:14px;top:${room - 22}px;z-index:99;font:600 11px/1 -apple-system,BlinkMacSystemFont,"Inter Variable",sans-serif;letter-spacing:0.01em;color:#8e8e93;white-space:pre`
    document.body.append(mark)
  }, 252)
  await page.waitForTimeout(200)
  await page.screenshot({ path: 'public/og.png', clip: { x: 0, y: 0, width: 480, height: 252 } })
  await browser.close()
  console.log('wrote public/og.png')
})().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
