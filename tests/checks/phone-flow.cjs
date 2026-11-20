// The iPhone version, end to end, as a phone in the hand (touch, 393x760). Prints PASS/FAIL per check.
//   node phone-flow.cjs [base url]
const { chromium } = require('playwright')
const path = require('path')
const base = process.argv[2] || 'http://127.0.0.1:5173/'
const out = path.join(__dirname, '..', 'audit', 'shots')
;(async () => {
  const browser = await chromium.launch()
  const W = 393, H = 760
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: true })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'])
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))
  let failed = 0
  const say = (ok, what, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
  const sleep = (ms) => page.waitForTimeout(ms)
  const touch = {
    down: (x, y) => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }),
    move: (x, y) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }),
    up: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
    async swipe([x0, y0], [x1, y1], ms = 160, hold = 0) {
      await this.down(x0, y0)
      const n = Math.max(4, Math.round(ms / 16))
      for (let i = 1; i <= n; i++) { await this.move(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n); await sleep(16) }
      if (hold) await sleep(hold)
      await this.up()
    },
  }
  const at = () => page.evaluate(() => ({
    locked: !!document.querySelector('.sb-lock:not([data-leaving])'),
    app: document.querySelector('.sb-slot[data-front]')?.getAttribute('data-app') ?? null,
    switcher: !!document.querySelector('.sb-apps[data-switcher]'),
    cards: document.querySelectorAll('.sb-slot').length,
    stack: history.state?.shrug?.stacks ?? null,
    sheet: history.state?.shrug?.sheet ?? null,
    n: history.state?.n,
    badge: document.querySelector('.sb-dock .sb-badge')?.textContent ?? null,
    replies: +(document.querySelector('.sb-chat__count')?.textContent?.match(/^(\d+)/)?.[1] ?? -1),
  }))
  const flickHome = async () => { await touch.swipe([W / 2, H - 6], [W / 2 + 10, H - 240], 110); await sleep(1000) }
  const front = (id) => `.sb-slot[data-front][data-app="${id}"]`

  await page.goto(base)
  // ---- The Lock Screen ----
  await page.waitForSelector('.sb-lock', { timeout: 15000 })
  // (the time is read out as words; what is seen of it is drawn, a shape to a figure)
  const lock = await page.evaluate(() => ({ date: document.querySelector('.sb-lock__date')?.textContent, time: document.querySelector('.sb-lock__clock')?.textContent, drawn: document.querySelectorAll('.sb-lock__clock svg path').length, bleed: !!document.querySelector('.ph--bleed') }))
  say(lock.bleed && /^\d{1,2}:\d\d$/.test(lock.time || '') && lock.drawn === (lock.time || '').length && /^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2,3}$/.test(lock.date || ''), 'it starts on the Lock Screen, edge to edge, with the day (short: Wed 18 Nov) and the time, a drawn figure to each of its characters', `${lock.date} ${lock.time} (${lock.drawn} drawn)`)
  await page.waitForSelector('.sb-stack .sb-note', { timeout: 25000 })
  // (the notification itself: for a moment after each reply the one before is still drawn under it)
  const first = await page.locator('.sb-stack .sb-note:not(.sb-note--was) .ss-notification__title').textContent()
  say(!!first, 'a reply arrives as a notification', first)
  await touch.swipe([W / 2, H * 0.4], [W / 2, H * 0.34], 380, 220); await sleep(600)
  say((await at()).locked, 'a short, slow drag leaves it locked')
  // The swipe starts on the notification itself: it still opens the phone, and doesn't open the conversation
  const note = await page.locator('.sb-stack .sb-note:not(.sb-note--was)').boundingBox()
  await touch.swipe([note.x + note.width / 2, note.y + note.height / 2], [note.x + note.width / 2, note.y - 260], 150); await sleep(900)
  let s = await at()
  say(!s.locked && s.app === null, 'a swipe up opens it onto the Home Screen, even one that starts on a notification')
  say((await page.locator('.sb-dock .sb-icon').count()) === 4 && s.replies >= 1 && s.badge === String(s.replies), 'the Dock holds four apps, and the badge on Messages counts the replies that have come in', `badge ${s.badge}, ${s.replies} replies`)
  say((await page.locator('.sb-widget--wide').count()) === 1 && (await page.locator('.sb-folder').count()) === 2, 'the newest reply as a widget, and the Portfolio and FAQs folders')

  // ---- Every app opens out of its icon and goes home on a flick ----
  for (const [label, id] of [['Messages', 'messages'], ['Contacts', 'finder'], ['Notes', 'notes'], ['VIP', 'photos'], ['Case Studies', 'terminal']]) {
    await page.locator(`.sb-icon[aria-label^="${label}"]`).first().tap()
    await page.waitForSelector(`${front(id)} .ios-page[data-pos="top"] .ios-screen, ${front(id)} .ios-screen`, { timeout: 8000, state: 'attached' }).catch(() => {})
    await sleep(900)
    const open = (await at()).app === id
    await flickHome()
    say(open && (await at()).app === null, `${label} opens out of its icon, and a flick of the home bar sends it back`)
  }

  // ---- The App Switcher ----
  await page.locator('.sb-icon[aria-label^="Notes"]').first().tap(); await sleep(1000)
  await touch.down(W / 2, H - 6)
  for (let i = 1; i <= 8; i++) { await touch.move(W / 2, H - 6 - i * 18); await sleep(16) }
  await sleep(420)
  await touch.up(); await sleep(900)
  s = await at()
  say(s.switcher && s.cards === 5, 'a swipe up and a pause opens the App Switcher with every app that has been opened', `${s.cards} cards`)
  await page.screenshot({ path: path.join(out, 'flow-switcher.png') })
  await touch.swipe([W * 0.5, H * 0.55], [W * 0.5, H * 0.08], 130); await sleep(900)
  s = await at()
  say(s.switcher && s.cards === 4, 'flicking a card up closes that app', `${s.cards} cards left`)
  await page.touchscreen.tap(W / 2, H / 2); await sleep(900)
  s = await at()
  say(!s.switcher && !!s.app, 'tapping a card goes to that app', s.app)
  await flickHome()

  // ---- Messages ----
  await page.locator('.sb-icon[aria-label^="Messages"]').first().tap(); await sleep(1100)
  const rows = await page.locator(`${front('messages')} [data-conversation]`).count()
  say(rows === 4, 'Messages lists Testimonials and the three easter-egg conversations', `${rows} rows`)
  await page.locator(`${front('messages')} [data-conversation="group"]`).tap(); await sleep(1000)
  s = await at()
  const bubbles = await page.locator(`${front('messages')} .ss-bubble`).count()
  say(s.stack?.messages?.[0] === 'c:group' && bubbles >= 2, 'tapping Testimonials opens the conversation', `${bubbles} bubbles`)
  await page.locator(`${front('messages')} input[aria-label="iMessage"]`).fill('hello from a phone')
  await page.locator(`${front('messages')} button[aria-label="Send"]`).tap(); await sleep(900)
  const sent = await page.evaluate((sel) => { const rows = [...document.querySelectorAll(`${sel} .chat__thread > *`)]; const at = rows.findIndex((el) => el.textContent.includes('hello from a phone')); return { there: at >= 0, under: at >= 0 ? rows[at + 1]?.textContent.trim() : null, failed: document.querySelectorAll(`${sel} .chat-undelivered, ${sel} .chat-failed`).length } }, front('messages'))
  say(sent.there && sent.under === 'Delivered' && sent.failed === 0, 'a typed message is sent and marked Delivered, as any message is', JSON.stringify(sent))
  await page.screenshot({ path: path.join(out, 'flow-conversation.png') })
  await page.goBack(); await sleep(600)
  s = await at()
  say(s.app === 'messages' && s.stack.messages.length === 0, "the browser's back is the phone's Back: it returns to the list")
  await page.locator(`${front('messages')} [data-conversation="founder"]`).tap(); await sleep(900)
  await page.locator(`${front('messages')} button[aria-label^="Back"]`).first().tap(); await sleep(900)
  await flickHome()
  s = await at()
  say(s.badge === null || +s.badge < s.replies, 'reading the conversation clears the badge: it counts only what has come in since', `badge ${s.badge}, ${s.replies} replies`)

  // ---- A banner, outside the conversation ----
  await page.waitForSelector('.sb-banner .sb-note', { timeout: 30000 }).catch(() => {})
  const banner = await page.locator('.sb-banner .sb-note').count()
  say(banner === 1, 'a reply landing while the Home Screen is showing drops in as a banner')
  if (banner) { await page.screenshot({ path: path.join(out, 'flow-banner.png') }); await page.locator('.sb-banner .sb-note').tap(); await sleep(1300) }
  s = await at()
  say(s.app === 'messages' && s.stack.messages[0] === 'c:group', 'tapping the banner opens the conversation')

  // ---- A reload comes back to the same place, unlocked ----
  await page.reload(); await sleep(1500)
  s = await at()
  say(!s.locked && s.app === 'messages' && s.stack.messages[0] === 'c:group', 'a reload comes back to where it was, unlocked')
  await flickHome()

  // ---- Search ----
  await page.locator('.sb-search').tap(); await sleep(800)
  const field = page.locator('.ph input[aria-label*="Search" i]').last()
  await field.fill('anduril'); await sleep(700)
  const hits = await page.locator('.ph [class*="spot-row"]').count()
  say(hits > 0, 'Search finds a company', `${hits} rows`)
  await page.screenshot({ path: path.join(out, 'flow-search.png') })

  const seen = [...new Set(errors)].filter((e) => !/Failed to load resource|\[vite\]/.test(e))
  say(seen.length === 0, seen.length ? 'console errors: ' + seen.slice(0, 6).join(' | ') : 'no console errors')
  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'ALL PASS')
  process.exit(failed ? 1 : 0)
})().catch((e) => { console.error('FAILED', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1) })
