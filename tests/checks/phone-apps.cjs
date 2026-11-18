// Inside each iPhone app, as a phone in the hand (touch, 393x760). Prints PASS/FAIL per check.
//   node phone-apps.cjs [base url] [only: files|notes|photos|terminal|settings|messages]
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

  // ---- Files (the portfolio) ----
  await run('files', async () => {
    const { ctx, page, sleep, app, top, st, title } = await open('open=files')
    let s = await st()
    say(s.stacks.finder.join() === 'f:all' && (await title()) === 'Portfolio', 'Files opens inside the Portfolio folder', `${s.stacks.finder.join()} "${await title()}"`)
    const items = await top.locator('[class~="files-item"]').count()
    say(items === 81, 'Portfolio shows every company under its logo', `${items} items`)
    say((await top.getByText('81 items').count()) === 1, 'and counts them at the foot, as Files does')
    await top.locator('button[aria-haspopup="menu"]').first().tap(); await sleep(450)
    await top.locator('[role^="menuitem"]', { hasText: 'List' }).first().tap(); await sleep(600)
    say((await top.locator('[class~="files-row"]').count()) === 81, 'the menu switches it to a list')
    await top.locator('[class~="files-row"]', { hasText: 'Anduril' }).first().tap(); await sleep(1000)
    const card = { sheet: (await st()).sheet, links: await app.locator('.ios-sheet a[href*="anduril"], .ios-sheet button:has-text("anduril.com")').count(), name: await app.locator('.ios-sheet').getByText('Anduril').count() }
    say(card.sheet === 'company:Anduril' && card.name > 0, 'a company opens as a sheet over the folder, with its link', JSON.stringify(card))
    await page.screenshot({ path: path.join(out, 'apps-company.png') })
    await page.goBack(); await sleep(700)
    say((await st()).sheet === null, "the browser's back closes the sheet")
    await top.locator('button[aria-label="Back"]').first().tap(); await sleep(900)
    s = await st()
    say(s.stacks.finder.length === 0 && (await title()) === 'Browse', 'Back leads out to Browse', `"${await title()}"`)
    const browse = { locations: await top.getByText('Locations').count(), tags: await top.getByText('Tags').count(), deep: await top.getByText('Deep tech').count() }
    say(browse.locations > 0 && browse.tags > 0 && browse.deep > 0, 'Browse lists Locations and the verticals as Tags', JSON.stringify(browse))
    await page.screenshot({ path: path.join(out, 'apps-browse.png') })
    await top.getByText('Consumer', { exact: true }).first().tap(); await sleep(900)
    s = await st()
    say(s.stacks.finder.join() === 'f:4' && (await title()) === 'Consumer', 'a tag opens what is tagged with it', `${s.stacks.finder.join()} "${await title()}"`)
    await app.locator('.ios-tabs__item:visible', { hasText: 'Recents' }).first().tap(); await sleep(900)
    say((await st()).stacks.finder.length === 0 && (await top.getByText('Anduril').count()) > 0, 'Recents holds the company that was opened')
    await app.locator('.ios-tabs__item:visible', { hasText: 'Shared' }).first().tap(); await sleep(900)
    say((await top.locator('a[href*="docsend"]').count()) === 1, 'Shared holds the one-pager, as a link')
    await page.screenshot({ path: path.join(out, 'apps-shared.png') })
    await ctx.close()
  })

  // ---- Notes (the FAQs) ----
  await run('notes', async () => {
    const { ctx, page, sleep, app, top, st, title } = await open('open=faqs')
    let s = await st()
    say(s.stacks.notes.join() === 'f:faqs' && (await title()) === 'FAQs', 'Notes opens inside the FAQs folder', `${s.stacks.notes.join()} "${await title()}"`)
    const text = await top.innerText()
    const questions = ['What does Shrug invest in?', 'How early, and how much?', 'What happens after the check?', 'How do I get in front of you?', 'What are drops?', 'What is VIP?', 'Why is it called Shrug?']
    say(questions.every((q) => text.includes(q)) && /7 Notes/.test(text), 'the seven questions are listed, and counted under the title')
    say(/Today/.test(text) && /Previous 7 Days/.test(text), 'grouped by when they were edited, as Notes groups them')
    await page.screenshot({ path: path.join(out, 'apps-notes.png') })
    await top.getByText('What are drops?').first().tap(); await sleep(1000)
    s = await st()
    say(s.stacks.notes.join() === 'f:faqs,n:4', 'a question opens as a note', s.stacks.notes.join())
    say((await top.getByText(/ at \d+:\d\d/).count()) > 0, 'with the date it was edited over its title')
    await page.screenshot({ path: path.join(out, 'apps-note.png') })
    await top.locator('button[aria-label="Back"]').first().tap(); await sleep(900)
    say((await st()).stacks.notes.join() === 'f:faqs', 'Back returns to the list')
    await top.locator('input[aria-label*="Search" i]').fill('drop'); await sleep(600)
    const found = await top.innerText()
    say(found.includes('What are drops?') && !found.includes('Why is it called Shrug?'), 'search narrows the list')
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
    say(tiles === 12 && (await title()) === 'Library', 'the Library shows the twelve photos and videos as a grid', `${tiles} tiles`)
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
    await page.locator('.sb-slot[data-front] .ios-page[data-pos="top"] button[aria-label*="Favorite" i]').first().tap(); await sleep(400)
    await page.locator('.sb-slot[data-front] .ios-page[data-pos="top"] button[aria-label="Back"]').first().tap(); await sleep(900)
    await app.locator('.ios-tabs__item:visible', { hasText: 'Collections' }).first().tap(); await sleep(800)
    const col = await page.locator('.sb-slot[data-front] .ios-page[data-pos="top"] .photos-tab[data-on]').innerText()
    say(/Albums/.test(col) && /Media Types/.test(col) && /Favorites/.test(col), 'Collections has Albums, with Favorites first, and Media Types')
    await page.screenshot({ path: path.join(out, 'apps-collections.png') })
    await page.locator('.sb-slot[data-front] .ios-page[data-pos="top"] .photos-tab[data-on]').getByText('Billboards').first().tap(); await sleep(1000)
    say(((await st()).stacks.photos[0] || '') === 'a:Billboards', 'a drop opens as an album', (await st()).stacks.photos.join())
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

  // ---- Settings ----
  await run('settings', async () => {
    const { ctx, page, sleep, app, top, st, title } = await open('open=settings&idle=5')
    const cur = () => page.locator('.sb-slot[data-front] .ios-page[data-pos="top"]')
    say((await title()) === 'Settings' && (await top.getByText('Shrug Capital').count()) >= 1, 'Settings opens with Shrug where the account is')
    await page.screenshot({ path: path.join(out, 'apps-settings.png') })
    // Auto-Lock first: the phone is set to lock after five seconds of stillness for this run
    await cur().getByText('Display & Brightness').first().tap(); await sleep(900)
    await cur().getByText('Auto-Lock').first().tap(); await sleep(900)
    await cur().getByText('Never', { exact: true }).first().tap(); await sleep(500)
    await sleep(7000)
    say(!(await page.locator('.sb-lock:not([data-leaving])').count()), 'Auto-Lock set to Never keeps the phone open')
    await page.goBack(); await sleep(700); await page.goBack(); await sleep(900)
    await cur().getByText('General').first().tap(); await sleep(900)
    await cur().getByText('About').first().tap(); await sleep(900)
    const about = await cur().innerText()
    say((await st()).stacks.about.join() === 'general,about' && /Companies\s*81/.test(about.replace(/\n/g, ' ')) && /Replies\s*90/.test(about.replace(/\n/g, ' ')), 'General › About counts what is on the phone', about.replace(/\s+/g, ' ').slice(0, 110))
    await page.screenshot({ path: path.join(out, 'apps-about.png') })
    await page.goBack(); await sleep(700); await page.goBack(); await sleep(900)
    await cur().getByText('Notifications').first().tap(); await sleep(900)
    const sw = cur().getByRole('switch', { name: /Allow Notifications/i })
    await sw.tap(); await sleep(400)
    say((await sw.getAttribute('aria-checked')) === 'false', 'Allow Notifications can be switched off')
    // Home, and wait: with notifications off no banner comes
    await page.locator('.sb-homebar .sr-only').evaluate((el) => el.click()); await sleep(1200)
    const came = await page.waitForSelector('.sb-banner .sb-note', { timeout: 26000 }).then(() => true).catch(() => false)
    say(!came, 'and then no banner drops in')
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
    say(all === 90, 'Show Every Reply brings in all ninety', `${all}`)
    await ctx.close()
  })

  const seen = [...new Set(errors)].filter((e) => !/Failed to load resource|\[vite\]/.test(e))
  say(seen.length === 0, seen.length ? 'console errors: ' + seen.slice(0, 6).join(' | ') : 'no console errors')
  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'ALL PASS')
  process.exit(failed ? 1 : 0)
})().catch((e) => { console.error('FAILED', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1) })
