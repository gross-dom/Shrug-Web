// Inside each iPhone app, as a phone in the hand (touch, 393x760). Prints PASS/FAIL per check.
//   node phone-apps.cjs [base url] [only: wallet|notes|photos|terminal|settings|messages]
const { chromium } = require('playwright')
const path = require('path')
const base = process.argv[2] || 'http://127.0.0.1:5173/'
const only = process.argv[3]
const out = path.join(__dirname, '..', 'audit', 'shots')
;(async () => {
  const browser = await chromium.launch()
  const W = 393, H = 760
  let failed = 0
  const say = (ok, what, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
  const errors = []
  const open = async (query) => {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: true })
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'])
    const page = await ctx.newPage()
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(base + '?' + query)
    await page.waitForSelector('.sb-slot[data-front] .ios-page[data-pos="top"] .ios-screen, .sb-slot[data-front] .ios-screen:not(.ios-page .ios-screen)', { timeout: 15000 })
    await page.waitForTimeout(900)
    const app = page.locator('.sb-slot[data-front]')
    // The screen on top of the app in front
    const top = app.locator('.ios-page[data-pos="top"]')
    return { ctx, page, sleep: (ms) => page.waitForTimeout(ms), app, top, st: () => page.evaluate(() => history.state?.shrug), title: () => top.locator('.ios-large').first().textContent().catch(() => null) }
  }
  const run = async (name, fn) => {
    if (only && only !== name) return
    try { await fn() } catch (e) { say(false, `${name}: the walk-through stopped`, e.message.split('\n')[0].slice(0, 160)) }
  }

  // ---- Wallet (the portfolio) ----
  await run('wallet', async () => {
    const { ctx, page, sleep, app, top, st, title } = await open('open=wallet')
    let s = await st()
    say(s.stacks.finder.length === 0 && (await title()) === 'Portfolio', 'Wallet opens on its cards, under the name of what they hold', `[${s.stacks.finder.join()}] "${await title()}"`)
    const lying = () => page.evaluate(() => { const n = {}; for (const el of document.querySelectorAll('.sb-slot[data-front] .wallet-slot')) n[el.dataset.lying] = (n[el.dataset.lying] ?? 0) + 1; return n })
    let l = await lying()
    say(l.stacked === 13 && Object.keys(l).length === 1, 'there is a card for every vertical, all of them in the stack', JSON.stringify(l))
    say((await top.locator('.ios-large-sub').textContent()) === '81 companies in 13 verticals', 'and the page counts what they hold')
    say((await top.locator('.wallet-co').count()) === 81 && (await top.locator('.wallet-card__in:not([inert])').count()) === 0, 'every company is on its card, and none of them is pressed while the cards are stacked: a card is one button')
    // A card that is pressed comes out of the stack
    await top.locator('.wallet-card__toggle', { hasText: 'Deep tech' }).tap(); await sleep(1000)
    s = await st(); l = await lying()
    const where = await page.evaluate(() => {
      const r = (sel) => document.querySelector('.sb-slot[data-front] ' + sel).getBoundingClientRect()
      const card = r('.wallet-slot[data-lying="out"] .wallet-card'), bar = r('.wallet-screen .ios-bar'), piled = [...document.querySelectorAll('.sb-slot[data-front] .wallet-slot[data-lying="piled"]')].map((el) => el.getBoundingClientRect().top), away = [...document.querySelectorAll('.sb-slot[data-front] .wallet-slot[data-lying="away"]')].map((el) => el.getBoundingClientRect().top)
      return { card: [Math.round(card.top), Math.round(card.bottom)], bar: Math.round(bar.bottom), piled: piled.map(Math.round), away: Math.min(...away), h: innerHeight }
    })
    say(s.stacks.finder.join() === 'v:0' && l.out === 1 && where.card[0] >= where.bar && where.card[0] < where.bar + 24, 'a card that is pressed comes out, to the top of the screen under the bar', JSON.stringify({ stack: s.stacks.finder, ...where }))
    say(l.piled === 3 && l.away === 9 && where.piled.every((y) => y > where.card[1] && y < where.h && y > where.h - 120) && where.away >= where.h, 'the others are put by: three in a pile at the foot of the screen, the rest below it', JSON.stringify({ l, piled: where.piled, away: where.away }))
    say((await top.locator('.wallet-slot[data-lying="out"] .wallet-co').count()) === 9 && (await top.locator('.wallet-card__in:not([inert])').count()) === 1, 'out of the stack, its companies are there to press, each under its name')
    say((await top.locator('.ios-large').first().evaluate((el) => getComputedStyle(el).opacity)) === '0' && (await top.locator('button[aria-label="Search"]').count()) === 0, "the page's own name and search give way to the card")
    await top.locator('.wallet-slot[data-lying="out"] .wallet-co', { hasText: 'Anduril' }).first().tap(); await sleep(1000)
    const card = { sheet: (await st()).sheet, links: await app.locator('.ios-sheet a[href*="anduril"], .ios-sheet button:has-text("anduril.com")').count(), name: await app.locator('.ios-sheet').getByText('Anduril').count() }
    say(card.sheet === 'company:Anduril' && card.name > 0 && card.links > 0, 'a company opens as a sheet over its card, with its link', JSON.stringify(card))
    await page.screenshot({ path: path.join(out, 'apps-company.png') })
    await page.goBack(); await sleep(700)
    s = await st()
    say(s.sheet === null && s.stacks.finder.join() === 'v:0', "the browser's back closes the sheet, and the card is still out")
    await top.locator('button[aria-label="Back"]').first().tap(); await sleep(1000)
    s = await st(); l = await lying()
    say(s.stacks.finder.length === 0 && l.stacked === 13 && (await top.locator('.ios-large').first().evaluate((el) => getComputedStyle(el).opacity)) === '1', 'Back puts the card back in the stack', JSON.stringify(l))
    await page.screenshot({ path: path.join(out, 'apps-wallet.png') })
    // The pile is the way back too, and so is the card's own heading
    await top.locator('.wallet-card__toggle', { hasText: 'Climate and energy' }).tap(); await sleep(1000)
    say((await st()).stacks.finder.join() === 'v:1' && (await top.locator('.wallet-card__toggle', { hasText: 'Climate and energy' }).getAttribute('aria-expanded')) === 'true', 'another card comes out, and says it is open')
    await page.screenshot({ path: path.join(out, 'apps-wallet-out.png') })
    await top.locator('.wallet-pile').tap(); await sleep(1000)
    say((await st()).stacks.finder.length === 0 && (await lying()).stacked === 13, 'the pile at the foot of the screen puts it back')
    await top.locator('.wallet-card__toggle', { hasText: 'Climate and energy' }).tap(); await sleep(1000)
    await top.locator('.wallet-slot[data-lying="out"] .wallet-card__toggle').tap(); await sleep(1000)
    say((await st()).stacks.finder.length === 0 && (await lying()).stacked === 13, "and so does the card's own heading")
    // Search looks through every card at once
    await top.locator('button[aria-label="Search"]').tap(); await sleep(600)
    say((await title()) === 'Search' && (await page.evaluate(() => document.activeElement?.classList.contains('ios-search__input'))), 'search takes the place of the cards, with the keyboard in its field')
    await page.keyboard.type('space'); await sleep(500)
    const found = await top.locator('.wallet-row').allTextContents()
    say(found.length > 0 && found.some((t) => t.includes('Varda')), 'it finds a company by what it does', found.join(' | ').slice(0, 120))
    await top.locator('button[aria-label="Close search"]').tap(); await sleep(600)
    say((await title()) === 'Portfolio' && (await lying()).stacked === 13, 'closing it brings the cards back')
    await ctx.close()
  })

  // ---- Notes (the FAQs) ----
  await run('notes', async () => {
    const { ctx, page, sleep, app, top, st, title } = await open('open=faqs')
    let s = await st()
    say(s.stacks.notes.join() === 'f:faqs' && (await title()) === 'FAQs', 'Notes opens inside the FAQs folder', `${s.stacks.notes.join()} "${await title()}"`)
    const text = await top.innerText()
    const questions = ['Why is it called Shrug V?', 'Why do founders like working with Shrug?', 'What are you investing in?', 'Where do you find opportunities?', 'How do you do marketing?', 'What does it mean to come with gifts?', 'What areas are you excited to be investing in?', 'What’s different about Shrug V?', 'Why should a founder make room for a small fund?', 'Do you lead rounds or take board seats?']
    say(questions.every((q) => text.includes(q)) && /10 Notes/.test(text), 'the ten questions are listed, and counted under the title', questions.filter((q) => !text.includes(q)).join(' | '))
    say(/Today/.test(text) && /Previous 7 Days/.test(text), 'grouped by when they were edited, as Notes groups them')
    await page.screenshot({ path: path.join(out, 'apps-notes.png') })
    await top.getByText('How do you do marketing?').first().tap(); await sleep(1000)
    s = await st()
    say(s.stacks.notes.join() === 'f:faqs,n:4', 'a question opens as a note', s.stacks.notes.join())
    say((await top.getByText(/ at \d+:\d\d/).count()) > 0, 'with the date it was edited over its title')
    await page.screenshot({ path: path.join(out, 'apps-note.png') })
    await top.locator('button[aria-label="Back"]').first().tap(); await sleep(900)
    say((await st()).stacks.notes.join() === 'f:faqs', 'Back returns to the list')
    await top.locator('input[aria-label*="Search" i]').fill('board seats'); await sleep(600)
    const found = await top.innerText()
    say(found.includes('Do you lead rounds or take board seats?') && !found.includes('Why is it called Shrug V?'), 'search narrows the list')
    await top.locator('input[aria-label*="Search" i]').fill(''); await sleep(400)
    await top.locator('button[aria-label="Back"]').first().tap(); await sleep(900)
    s = await st()
    say(s.stacks.notes.length === 0 && (await title()) === 'Folders', 'Back again leads out to Folders', `"${await title()}"`)
    await page.screenshot({ path: path.join(out, 'apps-folders.png') })
    // A note of the visitor's own
    await top.locator('button[aria-label="New Note"]').first().tap(); await sleep(1100)
    s = await st()
    say(s.stacks.notes.length === 2 && s.stacks.notes[0] === 'f:notes' && s.stacks.notes[1].startsWith('u:'), 'New Note starts a note in the Notes folder', s.stacks.notes.join())
    await page.keyboard.type('A note of my own'); await sleep(300)
    await page.screenshot({ path: path.join(out, 'apps-own-note.png') })
    await page.locator('.sb-slot[data-front] .ios-page[data-pos="top"] button[aria-label="Done"]').first().tap().catch(() => {}); await sleep(500)
    await page.locator('.sb-slot[data-front] .ios-page[data-pos="top"] button[aria-label="Back"]').first().tap(); await sleep(900)
    const mine = await page.locator('.sb-slot[data-front] .ios-page[data-pos="top"]').innerText()
    say(mine.includes('A note of my own') && /1 Note\b/.test(mine), 'and it is kept in that folder', mine.replace(/\s+/g, ' ').slice(0, 80))
    await ctx.close()
  })

  // ---- Photos (VIP) ----
  await run('photos', async () => {
    const { ctx, page, sleep, app, top, st, title } = await open('open=vip')
    const tiles = await top.locator('.photos-tile').count()
    say(tiles === 12 && (await title()) === 'VIP', 'VIP is one grid of the twelve photos and videos', `${tiles} tiles, "${await title()}"`)
    say((await app.locator('.ios-tabs, .ios-tabs__item').count()) === 0 && (await app.locator('button[aria-label="Search"]').count()) === 0 && (await app.getByText(/Collections|Albums|Media Types/).count()) === 0, 'with nothing to find one’s way round: no tabs, no collections, no search')
    say((await top.getByText('The first ones are on their way.', { exact: false }).count()) === 1 && (await top.getByText('8 Photos, 4 Videos').count()) === 0, 'and counts nothing that has not arrived: the line under the grid says they are on their way')
    await page.screenshot({ path: path.join(out, 'apps-photos.png') })
    await top.locator('button[aria-haspopup="menu"]').first().tap(); await sleep(450)
    await top.locator('[role^="menuitem"]', { hasText: 'Videos' }).first().tap(); await sleep(700)
    const videos = await top.locator('.photos-tile').count()
    say(videos === 4, 'the filter narrows it to videos', `${videos} tiles`)
    await top.locator('button[aria-haspopup="menu"]').first().tap(); await sleep(450)
    await top.locator('[role^="menuitem"]', { hasText: 'All Items' }).first().tap(); await sleep(700)
    await top.locator('.photos-tile').first().tap(); await sleep(1000)
    say((await st()).stacks.photos.join() === 'm:0', 'a tile opens the viewer', (await st()).stacks.photos.join())
    await page.screenshot({ path: path.join(out, 'apps-viewer.png') })
    await page.keyboard.press('ArrowRight'); await sleep(900)
    say((await st()).stacks.photos.join() === 'm:1', 'the next one is a step away', (await st()).stacks.photos.join())
    const tools = await page.locator('.sb-slot[data-front] .ios-page[data-pos="top"] button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))
    say(!tools.some((t) => /Album|Library|More/.test(t || '')), 'the viewer leads nowhere else: Back, Favorite and Info', tools.join(', '))
    await page.locator('.sb-slot[data-front] .ios-page[data-pos="top"] button[aria-label*="Favorite" i]').first().tap(); await sleep(400)
    await page.locator('.sb-slot[data-front] .ios-page[data-pos="top"] button[aria-label="Back"]').first().tap(); await sleep(900)
    say((await st()).stacks.photos.length === 0 && (await title()) === 'VIP', 'Back is the grid again')
    await top.locator('button[aria-haspopup="menu"]').first().tap(); await sleep(450)
    await top.locator('[role^="menuitem"]', { hasText: 'Favorites' }).first().tap(); await sleep(700)
    say((await top.locator('.photos-tile').count()) === 1, 'and the one that was favorited is what the Favorites filter shows')
    await ctx.close()
  })

  // ---- Case Studies (the terminal) ----
  await run('terminal', async () => {
    const { ctx, page, sleep, app } = await open('open=case-studies')
    say((await app.getByText('permission denied', { exact: false }).count()) >= 1, 'the terminal lists the case studies and refuses')
    await app.getByRole('button', { name: /^y/i }).first().tap(); await sleep(700)
    say((await app.getByText('two are public', { exact: false }).count()) >= 1 && (await app.locator('.term__link').count()) === 3, 'the y key answers the question: what can be read now, and the one-pager')
    await app.locator('input').first().fill('someone@example.com'); await sleep(300)
    await app.locator('input').first().press('Enter'); await sleep(800)
    const text = await app.locator('.ios-screen').innerText()
    say(/nothing is sent from here/.test(text) && !/request noted/.test(text), 'an email typed anyway is not taken: it says nothing is sent from here', text.split('\n').slice(-3).join(' / ').slice(0, 90))
    await ctx.close()
  })

  // ---- Settings: the phone has no such app ----
  await run('settings', async () => {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: true })
    const page = await ctx.newPage()
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(String(e)))
    const sleep = (ms) => page.waitForTimeout(ms)
    // An address that names it (a link made on the desktop, an old one) arrives on the Home Screen, open
    await page.goto(base + '?open=settings'); await sleep(2200)
    const at = await page.evaluate(() => ({ locked: !!document.querySelector('.sb-lock:not([data-leaving])'), app: history.state?.shrug?.app ?? null, front: document.querySelector('.sb-slot[data-front]')?.getAttribute('data-app') ?? null, icons: [...document.querySelectorAll('.sb-home .sb-icon__name')].map((el) => el.textContent.trim()) }))
    say(!at.locked && at.app === null && at.front === null, 'an address that asks for Settings opens the phone on its Home Screen: there is no such app', JSON.stringify({ locked: at.locked, app: at.app }))
    say(!at.icons.some((name) => /Settings/.test(name)) && at.icons.some((name) => /^VIP/.test(name)) && at.icons.some((name) => /^Case Studies/.test(name)), 'and the Home Screen has no Settings icon among its apps', at.icons.join(' | '))
    await page.locator('.sb-search').tap(); await sleep(800)
    await page.locator('.ph input[aria-label*="Search" i]').last().fill('settings'); await sleep(700)
    const hits = await page.locator('.ph .spot-row').allTextContents()
    say(!hits.some((t) => /Settings|Notifications|Auto-Lock/.test(t)), 'nor does search find one', hits.join(' | ').slice(0, 120))
    await ctx.close()
  })

  // ---- Messages: details ----
  await run('messages', async () => {
    // a link that names the chat arrives in the conversation itself
    const { ctx, page, sleep, app, st } = await open('open=chat')
    await sleep(900)
    await app.locator('button[aria-haspopup="dialog"]').first().tap(); await sleep(900)
    say((await st()).sheet === 'details', 'the conversation’s name opens its details')
    await app.getByRole('switch', { name: /Pause Replies/i }).tap(); await sleep(300)
    const before = await app.locator('.chat__thread [data-person]').count()
    await sleep(4200)
    const after = await app.locator('.chat__thread [data-person]').count()
    say(before === after, 'Pause Replies holds the conversation', `${before} then ${after}`)
    await app.getByText('Show Every Reply').first().tap(); await sleep(900)
    const all = await page.locator('.sb-slot[data-front] .chat__thread [data-person]').count()
    say(all === 89, 'Show Every Reply brings in all eighty-nine', `${all}`)
    await ctx.close()
    // The same from the conversation itself: the pill at its head, while replies are still coming
    {
      const { ctx, page, sleep, app } = await open('open=chat')
      await page.waitForFunction(() => document.querySelectorAll('.sb-slot[data-front] .chat__thread [data-person]:not([data-typing])').length >= 2, null, { timeout: 20000 })
      const pill = app.locator('.chat__all[data-show]')
      say((await pill.count()) === 1 && /Load all 89 replies/.test(await pill.textContent()), 'while replies are still coming the conversation offers them all at once', await pill.textContent().catch(() => 'no pill'))
      const before = await app.locator('.chat__scroll').evaluate((el) => Math.round(el.scrollTop))
      await pill.tap(); await sleep(900)
      const after = await page.evaluate(() => { const el = document.querySelector('.sb-slot[data-front] .chat__scroll'); return { people: document.querySelectorAll('.sb-slot[data-front] .chat__thread [data-person]').length, top: Math.round(el.scrollTop), room: el.scrollHeight - el.clientHeight, pill: !!document.querySelector('.sb-slot[data-front] .chat__all[data-show]'), latest: document.querySelector('.sb-slot[data-front] .chat__new[data-show]')?.textContent.trim() ?? null } })
      say(after.people === 89 && !after.pill, 'pressed, everyone has replied and the offer goes', JSON.stringify(after))
      say(Math.abs(after.top - before) < 40 && after.room - after.top > 400 && /^\d+ new$/.test(after.latest || ''), 'the reader is left where they were, to read on down, with the way to the newest offered', JSON.stringify({ before, ...after }))
      // A message of the visitor's own goes, and says so
      await app.locator('input[aria-label="iMessage"]').fill('thanks all')
      await app.locator('button[aria-label="Send"]').tap(); await sleep(1300)
      const sent = await page.evaluate(() => { const rows = [...document.querySelectorAll('.sb-slot[data-front] .chat__thread > *')]; const at = rows.findIndex((el) => el.textContent.includes('thanks all')); return { under: at >= 0 ? rows[at + 1]?.textContent.trim() : null, last: at === rows.length - 2, failed: document.querySelectorAll('.sb-slot[data-front] .chat-undelivered').length } })
      say(sent.under === 'Delivered' && sent.last && sent.failed === 0, 'a message typed into it is sent to the end of the conversation and marked Delivered', JSON.stringify(sent))
      await ctx.close()
    }
  })

  const seen = [...new Set(errors)].filter((e) => !/Failed to load resource|\[vite\]/.test(e))
  say(seen.length === 0, seen.length ? 'console errors: ' + seen.slice(0, 6).join(' | ') : 'no console errors')
  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'ALL PASS')
  process.exit(failed ? 1 : 0)
})().catch((e) => { console.error('FAILED', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1) })
