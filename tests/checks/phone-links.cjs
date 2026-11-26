// What search on the Home Screen opens, and where the keyboard goes when a screen is pushed.
const { chromium } = require('playwright')
const path = require('path')
const { storeAt, tabFrom } = require('./lib.cjs')
const base = process.argv[2] || 'http://127.0.0.1:5173/'
;(async () => {
  const browser = await chromium.launch()
  let failed = 0
  const say = (ok, what, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
  const errors = []
  const ctx = await browser.newContext({ viewport: { width: 393, height: 760 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  // (VIP leads off the site, to the points site: this answers in its place)
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

  // The stores are found among the apps, and are the links they are on the Home Screen: "vip" finds ArtStore,
  // which is what VIP was, as the store's own page in a tab of its own, and no app
  await page.locator('.sb-search').tap(); await sleep(800)
  await page.locator('.ph input[aria-label*="Search" i]').last().fill('vip'); await sleep(700)
  const vip = await page.locator('.ph .spot-row[data-top]').evaluate((a) => ({ tag: a.tagName, title: a.querySelector('.spot-row__title').textContent, href: a.href, target: a.target, rel: a.rel, says: a.textContent.replace(/\s+/g, ' ').trim(), tile: !!a.querySelector('.spot-tile svg') })).catch(() => null)
  say(!!vip && vip.tag === 'A' && vip.title === 'ArtStore' && vip.href === storeAt(base, 'store') && vip.target === '_blank' && /\bnoopener\b/.test(vip.rel) && /\bnoreferrer\b/.test(vip.rel) && /, opens in a new tab$/.test(vip.says) && vip.tile, 'search for "vip" finds ArtStore first, under its tile: a link to the store’s own page that says it opens in a new tab', JSON.stringify(vip))
  const went = await tabFrom(ctx, () => page.locator('.ph a.spot-row[data-top]').tap())
  await sleep(1200)
  s = await st()
  say(!!went && went.url === storeAt(base, 'store') && went.alone === true && (s?.app ?? null) === null && (await page.locator('.sb-slot[data-front], .sb-slot[data-app="photos"]').count()) === 0 && (await page.locator('.ph .spot-row').count()) === 0, 'pressed, it opens there in a tab of its own; search closes, and no app has opened', JSON.stringify({ went, app: s?.app ?? null, rows: await page.locator('.ph .spot-row').count() }))
  // The drops were what the VIP app held: search no longer lists them, since there is nowhere on the phone to open one
  await page.locator('.sb-search').tap(); await sleep(800)
  await page.locator('.ph input[aria-label*="Search" i]').last().fill('billboards'); await sleep(700)
  const drops = await page.evaluate(() => ({ rows: [...document.querySelectorAll('.ph .spot-row .spot-row__title')].map((t) => t.textContent), none: document.querySelector('.ph .spot-none')?.textContent ?? null }))
  say(!drops.rows.includes('Billboards'), 'and a drop is not something search finds any more', JSON.stringify(drops))
  await page.keyboard.press('Escape'); await sleep(900)
  if ((await page.locator('.ph .spot-row, .ph .spot-none').count()) > 0) await home()

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

  // ---- A company and its founder's words lead to each other
  await home()
  await search('living carbon', 'Living Carbon')
  const top = '.sb-slot[data-front] .ios-page[data-pos="top"]'
  let card = await page.evaluate((top) => ({ acts: [...document.querySelectorAll(`${top} .contact-act`)].map((a) => a.textContent.trim()), fields: [...document.querySelectorAll(`${top} .contact-field`)].map((f) => `${f.querySelector('dt').textContent}: ${f.querySelector('dd').textContent}`) }), top)
  say(card.acts.join(' | ') === 'Website, opens in a new tab | Maddie Hall in Testimonials | Share' && card.fields.slice(-1)[0] === 'in testimonials: Maddie Hall', 'a company whose founder is in the conversation has the way to what they said: a round button, and a row', JSON.stringify(card))
  await page.locator(`${top} .contact-field[data-link] button`).tap(); await sleep(2800)
  s = await st()
  const reply = await page.evaluate(() => { const sc = document.querySelector('.sb-slot[data-front] .ios-page[data-pos="top"] .chat__scroll'); const b = sc?.querySelector('[data-person="5"]'); if (!b) return null; const r = sc.getBoundingClientRect(), q = b.getBoundingClientRect(); return q.top > r.top + 40 && q.top < r.bottom - 100 })
  say(s.app === 'messages' && s.stacks.messages.join() === 'c:group' && reply === true, 'the row opens the conversation at their reply', JSON.stringify({ app: s.app, stack: s.stacks.messages, reply }))
  await page.locator(`${top} .msg-head`).tap(); await sleep(900)
  await page.locator('.msg-person').nth(5).scrollIntoViewIfNeeded(); await page.locator('.msg-person').nth(5).tap(); await sleep(700)
  const rows = await page.locator('.ios-sheet .ios-cell, .ios-sheet [class*="cell"] button, .ios-sheet button').allInnerTexts()
  say(rows.some((r) => /^Show in Testimonials$/.test(r.trim())) && rows.some((r) => /^Share Reply…$/.test(r.trim())) && rows.some((r) => /^Show Living Carbon in Contacts$/.test(r.trim())), 'their card has the way to the reply, a link to it to pass on, and the way to their company', rows.map((r) => r.trim()).filter(Boolean).join(' | '))
  await page.locator('.ios-sheet button', { hasText: 'Show Living Carbon in Contacts' }).tap(); await sleep(1400)
  s = await st()
  say(s.app === 'finder' && s.stacks.finder.join() === 'co:Living Carbon' && s.sheet === null, 'and that row opens the company’s card in Contacts', JSON.stringify({ app: s.app, stack: s.stacks.finder, sheet: s.sheet }))
  // A company nobody in the conversation speaks for has neither
  await home()
  await search('hadrian', 'Hadrian')
  card = await page.evaluate((top) => ({ acts: document.querySelectorAll(`${top} .contact-act`).length, fields: [...document.querySelectorAll(`${top} .contact-field dt`)].map((f) => f.textContent) }), top)
  say(card.acts === 2 && !card.fields.includes('in testimonials'), 'a company nobody there speaks for has neither', JSON.stringify(card))

  // ---- A banner drops over the bar: what it has dropped over still works
  // (Replies are landing all the while; one that lands while Contacts is showing drops a banner, no more often than every twenty seconds)
  const dropped = await page.waitForSelector('.sb-banner:not([data-leaving])', { timeout: 45000 }).then(() => true, () => false)
  if (!dropped) say(true, '(no banner dropped in this run: everyone had replied; its presses are not tried)')
  else {
    await sleep(700)
    const spot = await page.evaluate((top) => { const b = document.querySelector(`${top} .ios-bar button[aria-label="Back"]`).getBoundingClientRect(); const n = document.querySelector('.sb-banner .ss-notification').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, under: b.y + b.height / 2 > n.top && b.y + b.height / 2 < n.bottom } }, top)
    await page.touchscreen.tap(spot.x, spot.y); await sleep(1300)
    s = await st()
    say(spot.under && s.app === 'finder' && s.stacks.finder.length === 0, 'a press on a banner where Back lies under it goes Back, and not to the conversation', JSON.stringify({ under: spot.under, app: s.app, stack: s.stacks.finder }))
  }

  const seen = [...new Set(errors)].filter((e) => !/Failed to load resource|\[vite\]/.test(e))
  say(seen.length === 0, seen.length ? 'console errors: ' + seen.slice(0, 6).join(' | ') : 'no console errors')
  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'ALL PASS')
  process.exit(failed ? 1 : 0)
})().catch((e) => { console.error('FAILED', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1) })
