// The badge on Messages: nothing at first, then a count that ticks up with each reply; reading the conversation clears it.
const { chromium } = require('playwright')
const path = require('path')
const base = process.argv[2] || 'http://127.0.0.1:5173/'
;(async () => {
  const browser = await chromium.launch()
  let failed = 0
  const say = (ok, what, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
  const ctx = await browser.newContext({ viewport: { width: 393, height: 760 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))
  const sleep = (ms) => page.waitForTimeout(ms)
  const state = () => page.evaluate(() => ({ badge: document.querySelector('.sb-dock .sb-badge')?.textContent ?? null, widget: +(document.querySelector('.sb-chat__count')?.textContent?.match(/^(\d+)/)?.[1] ?? -1), label: document.querySelector('.sb-dock .sb-icon')?.getAttribute('aria-label') }))
  const home = async () => { await page.locator('.sb-homebar .sr-only').evaluate((el) => el.click()); await sleep(1100) }
  const front = '.sb-slot[data-front] .ios-page[data-pos="top"]'
  await page.goto(base)
  await page.waitForSelector('.sb-lock', { timeout: 15000 })
  await sleep(700)
  await page.locator('.sb-lock__hint').tap(); await sleep(900)
  let s = await state()
  say(s.badge === null && s.widget === 0, 'before anyone has replied, Messages has no badge', JSON.stringify(s))
  await page.screenshot({ path: path.join(__dirname, '..', 'audit', 'shots', 'badge-0.png') })
  // Watch it tick: sample the badge beside the widget's count for a while
  const samples = []
  for (let i = 0; i < 70; i++) { samples.push(await state()); await sleep(150) }
  const pairs = [...new Map(samples.filter((x) => x.widget > 0).map((x) => [x.widget, x.badge])).entries()]
  say(pairs.length >= 4 && pairs.every(([w, b]) => String(w) === b), 'then it counts each reply as it comes in, in step with the widget', pairs.map(([w, b]) => `${w}:${b}`).join(' '))
  s = await state()
  say(/^Messages, \d+ unread$/.test(s.label || ''), 'and says so to a screen reader', s.label)
  await page.screenshot({ path: path.join(__dirname, '..', 'audit', 'shots', 'badge-n.png') })
  // The list marks the people whose replies are in, and nobody else
  await page.locator('.sb-icon[aria-label^="Messages"]').first().tap(); await sleep(1300)
  const list = await page.evaluate(() => { const rows = [...document.querySelectorAll('.sb-slot[data-front] [data-conversation]')]; return { rows: rows.length, unread: rows.filter((r) => r.querySelector('[class*="unread"], .msg-row__dot, [data-unread]') || r.hasAttribute('data-unread')).length, widget: +(document.querySelector('.sb-chat__count')?.textContent?.match(/^(\d+)/)?.[1] ?? -1) } })
  console.log('      list:', JSON.stringify(list))
  await page.screenshot({ path: path.join(__dirname, '..', 'audit', 'shots', 'badge-list.png') })
  // Reading the conversation clears it
  await page.locator('.sb-slot[data-front] [data-conversation="group"]').tap(); await sleep(1500)
  await home()
  s = await state()
  say(s.badge === null || +s.badge <= 1, 'reading Shrug Family clears the badge', JSON.stringify(s))
  await sleep(4500)
  const later = await state()
  say(later.badge !== null && +later.badge >= 1 && +later.badge < later.widget, 'and replies that come in afterwards tick it up again from there', JSON.stringify(later))
  // Inside an easter egg the group goes on being counted, beside Back
  await page.locator('.sb-icon[aria-label^="Messages"]').first().tap(); await sleep(1200)
  // (Messages comes back on the conversation it was left in: step back to the list)
  if (await page.locator(`${front} button[aria-label^="Back"]`).count()) { await page.locator(`${front} button[aria-label^="Back"]`).first().tap(); await sleep(900) }
  await page.locator('.sb-slot[data-front] [data-conversation="mom"]').tap(); await sleep(4200)
  const back = await page.locator(`${front} button[aria-label^="Back"]`).first().getAttribute('aria-label')
  say(/^Back\. \d+ unread$/.test(back || ''), 'inside an easter egg, Back counts the replies that have come in to the group', back)
  const seen = [...new Set(errors)].filter((e) => !/Failed to load resource|\[vite\]/.test(e))
  say(seen.length === 0, seen.length ? 'console errors: ' + seen.slice(0, 5).join(' | ') : 'no console errors')
  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'ALL PASS')
})().catch((e) => { console.error('FAILED', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1) })
