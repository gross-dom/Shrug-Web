// What search on the Home Screen opens, and where the keyboard goes when a screen is pushed.
const { chromium } = require('playwright')
const path = require('path')
const base = process.argv[2] || 'http://127.0.0.1:5173/'
;(async () => {
  const browser = await chromium.launch()
  let failed = 0
  const say = (ok, what, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
  const errors = []
  const ctx = await browser.newContext({ viewport: { width: 393, height: 760 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))
  const sleep = (ms) => page.waitForTimeout(ms)
  const st = () => page.evaluate(() => history.state?.shrug)
  const search = async (q, pick) => {
    await page.locator('.sb-search').tap(); await sleep(800)
    await page.locator('.ph input[aria-label*="Search" i]').last().fill(q); await sleep(700)
    // The row whose own title is what was looked for
    await page.locator('.ph .spot-row').filter({ has: page.locator('.spot-row__title', { hasText: new RegExp('^' + pick.replace(/[?.]/g, '\\$&') + '$') }) }).first().tap(); await sleep(1400)
  }
  const home = async () => { await page.locator('.sb-homebar .sr-only').evaluate((el) => el.click()); await sleep(1100) }
  await page.goto(base + '?still'); await sleep(1500)
  await page.keyboard.press('Enter'); await sleep(1100)

  await search('anduril', 'Anduril')
  let s = await st()
  say(s.app === 'finder' && s.stacks.finder.join() === 'co:Anduril' && s.sheet === null, 'search opens a company in Contacts, at its card', JSON.stringify({ app: s.app, stack: s.stacks.finder, sheet: s.sheet }))
  await page.screenshot({ path: path.join(__dirname, '..', 'audit', 'shots', 'links-company.png') })
  await page.locator('.sb-slot[data-front] .ios-page[data-pos="top"] button[aria-label="Back"]').tap(); await sleep(900)
  s = await st()
  const among = await page.evaluate(() => { const sc = document.querySelector('.sb-slot[data-front] .ios-page[data-pos="top"] [data-scroller]'); const row = [...sc.querySelectorAll('[data-company]')].find((r) => r.dataset.company === 'Anduril'); const b = sc.getBoundingClientRect(), r = row.getBoundingClientRect(); const head = row.closest('.contacts-section').querySelector('.contacts-letter').textContent; return { seen: r.top > b.top + 52 && r.bottom < b.bottom - 80, head } })
  say(s.app === 'finder' && s.stacks.finder.length === 0 && among.seen && among.head === 'Deep tech', 'Back from it leaves the list at the company, among its own vertical', JSON.stringify({ stack: s.stacks.finder, ...among }))
  await home()

  await search('board seats', 'Do you lead rounds or take board seats?')
  s = await st()
  say(s.app === 'notes' && s.stacks.notes.join() === 'f:faqs,n:9', 'search opens a question as a note inside FAQs', s.stacks.notes.join())
  await page.locator('.sb-slot[data-front] .ios-page[data-pos="top"] button[aria-label="Back"]').first().tap(); await sleep(900)
  say((await st()).stacks.notes.join() === 'f:faqs', 'and Back from it is the FAQs list')
  await home()

  await search('billboards', 'Billboards')
  s = await st()
  say(s.app === 'photos' && s.stacks.photos.join() === 'm:3', 'search opens a drop in VIP: the first of its photos and videos, in the viewer', s.stacks.photos.join())
  await home()

  await search('pentatonix', 'Kevin Olusola')
  s = await st()
  say(s.app === 'messages' && s.stacks.messages.join() === 'c:group', 'search opens a person at their reply in Testimonials', JSON.stringify({ app: s.app, stack: s.stacks.messages }))
  await home()
  await search('drops', 'Drops')
  s = await st()
  say(s.app === 'messages' && s.stacks.messages.join() === 'c:drops', 'and finds an easter-egg conversation by name', s.stacks.messages.join())
  await home()

  // The keyboard follows the screens
  await page.locator('.sb-icon[aria-label^="Notes"]').first().tap(); await sleep(1200)
  // (Notes comes back where search left it, on a question: back out to the list of them first)
  if (((await st()).stacks.notes || []).length > 1) { await page.locator('.sb-slot[data-front] .ios-page[data-pos="top"] button[aria-label="Back"]').first().tap(); await sleep(900) }
  await page.locator('.sb-slot[data-front] .ios-page[data-pos="top"]').getByText('What are you investing in?').first().tap(); await sleep(900)
  const where = await page.evaluate(() => { const a = document.activeElement; const top = document.querySelector('.sb-slot[data-front] .ios-page[data-pos="top"]'); return { inTop: !!top && top.contains(a), tag: a?.tagName, cls: a?.className } })
  say(where.inTop, 'a screen that is pushed takes the keyboard', JSON.stringify(where))
  await page.keyboard.press('Tab'); await sleep(200)
  const tabbed = await page.evaluate(() => { const a = document.activeElement; const top = document.querySelector('.sb-slot[data-front] .ios-page[data-pos="top"]'); return !!top && top.contains(a) && a !== top })
  say(tabbed, 'and Tab goes on to that screen’s own controls')

  const seen = [...new Set(errors)].filter((e) => !/Failed to load resource|\[vite\]/.test(e))
  say(seen.length === 0, seen.length ? 'console errors: ' + seen.slice(0, 6).join(' | ') : 'no console errors')
  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'ALL PASS')
  process.exit(failed ? 1 : 0)
})().catch((e) => { console.error('FAILED', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1) })
