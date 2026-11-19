// Inside each iPhone app, as a phone in the hand (touch, 393x760). Prints PASS/FAIL per check.
//   node phone-apps.cjs [base url] [only: contacts|notes|photos|terminal|settings|messages]
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
    return { ctx, page, sleep: (ms) => page.waitForTimeout(ms), app, top, st: () => page.evaluate(() => history.state?.shrug), title: () => top.evaluate((el) => { const h = el.querySelector('.ios-large, .photos-head__title, .ios-bar__name'); if (!h) return null; const sub = h.querySelector('.ios-bar__sub'); return (sub ? h.textContent.slice(0, h.textContent.length - sub.textContent.length) : h.textContent).trim() }).catch(() => null) }
  }
  const run = async (name, fn) => {
    if (only && only !== name) return
    try { await fn() } catch (e) { say(false, `${name}: the walk-through stopped`, e.message.split('\n')[0].slice(0, 160)) }
  }

  // ---- Contacts (the portfolio) ----
  await run('contacts', async () => {
    const { ctx, page, sleep, app, top, st, title } = await open('open=contacts')
    let s = await st()
    say(s.stacks.finder.length === 0 && (await title()) === 'Contacts', 'Contacts opens on its list', `[${s.stacks.finder.join()}] "${await title()}"`)
    const me = (await top.locator('.contacts-me').textContent()).replace(/\s+/g, ' ').trim()
    say(me === 'Shrug Capital, My Card' && (await top.locator('.contacts-me svg').count()) === 1, "at its head is Shrug's own card, as My Card is", me)
    // A section to a vertical, where Contacts has one to a letter
    const heads = await top.locator('.contacts-letter').allTextContents()
    say(heads.join(' | ') === 'AI | Climate and energy | Consumer | Creator | Deep tech | Enterprise | Fintech | Health | Marketplaces | Products | “Social is Hard” — Evan | Web3 | Other', 'there is a section to a vertical, in the order of their names as Contacts files everything, with Other last', heads.join(' | '))
    const rows = await top.locator('.contacts-section .contacts-row').evaluateAll((els) => els.map((el) => ({ name: el.querySelector('.contacts-row__name').textContent, logo: !!el.querySelector('.contact-face'), round: getComputedStyle(el.querySelector('.contact-face')).borderRadius === '50%', h: Math.round(el.getBoundingClientRect().height) })))
    say(rows.length === 81 && rows.every((r) => r.logo && r.round && r.h === 60) && (await top.locator('.contacts-count').textContent()) === '81 Companies', 'every company is a row 60 points tall with its own logo in a round face, and the list counts them at its foot', `${rows.length} rows, ${await top.locator('.contacts-count').textContent()}`)
    const deep = await top.locator('.contacts-section', { has: page.locator('.contacts-letter', { hasText: 'Deep tech' }) }).locator('.contacts-row__name').allTextContents()
    say(deep.join(', ') === 'Varda, Hadrian, Senra, Antares, Anduril, AMCA, Merlin Labs, Galvanick, Enigma', "inside a vertical the companies keep Shrug's order", deep.join(', '))
    const atoms = await top.locator('.contacts-row', { has: page.locator('.contacts-row__name', { hasText: /^Atoms$/ }) }).locator('.contacts-row__where').allTextContents()
    say(atoms.length === 2 && atoms.every((w) => /atoms\.co/.test(w)) && atoms[0] !== atoms[1], 'the two companies called Atoms each say which they are, by their address', atoms.join(' | '))
    // The index of letters down the edge is the verticals'
    const rail = await top.locator('.contacts-index__letter').evaluateAll((els) => els.map((el) => ({ letter: el.textContent, pressed: el.tagName === 'BUTTON', says: el.getAttribute('aria-label') })))
    say(rail.map((l) => l.letter).join('') === 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#' && rail.filter((l) => l.pressed).map((l) => l.letter).join('') === 'ACDEFHMPSW#', 'the index has every letter and #, and the ones a vertical is filed under are buttons', rail.filter((l) => l.pressed).map((l) => l.letter).join(''))
    say(rail.find((l) => l.letter === 'C').says === 'C: Climate and energy, Consumer, Creator' && rail.find((l) => l.letter === '#').says === 'Everything else: Other', 'a letter says which verticals are under it', `${rail.find((l) => l.letter === 'C').says} / ${rail.find((l) => l.letter === '#').says}`)
    // …and brings its vertical up under the bar
    const atTop = () => page.evaluate(() => { const sc = document.querySelector('.sb-slot[data-front] .ios-page[data-pos="top"] [data-scroller]'); const line = sc.getBoundingClientRect().top + parseFloat(getComputedStyle(sc).paddingTop); const all = [...sc.querySelectorAll('.contacts-section')]; const sec = all.find((x) => Math.abs(x.getBoundingClientRect().top - line) < 1.5); const stuck = [...sc.querySelectorAll('.contacts-letter')].find((h) => Math.abs(h.getBoundingClientRect().top - line) < 1.5); return { section: sec?.querySelector('.contacts-letter').textContent ?? null, stuck: stuck?.textContent ?? null } })
    const press = async (letter) => { const b = await top.locator(`.contacts-index__letter[data-letter="${letter}"]`).boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sleep(250) }
    await press('F')
    let at = await atTop()
    say(at.section === 'Fintech' && at.stuck === 'Fintech', "a letter pressed brings its vertical's heading to the top of the list, under the bar", JSON.stringify(at))
    await press('G')
    at = await atTop()
    say(at.section === 'Health', 'a letter with nothing under it brings up the next that has, as Contacts does', JSON.stringify(at))
    // (a browser that hands a tap to the nearest thing that can be pressed must not answer I as H, which is beside it)
    await press('I')
    at = await atTop()
    say(at.section === 'Marketplaces', 'and the letter after one that is a button is still its own', JSON.stringify(at))
    await press('C')
    await top.locator('[data-scroller]').evaluate((el) => (el.scrollTop += 120)); await sleep(250)
    at = await atTop()
    say(at.stuck === 'Climate and energy', "a vertical's heading stays under the bar while its companies pass", JSON.stringify(at))
    await page.screenshot({ path: path.join(out, 'apps-contacts.png') })
    // A company opens as a contact's card does: a screen pushed over the list
    await press('H')
    const before = await top.locator('[data-scroller]').evaluate((el) => Math.round(el.scrollTop))
    await top.locator('.contacts-row[data-company="Eight Sleep"]').tap(); await sleep(1100)
    s = await st()
    const card = await top.evaluate((el) => {
      const screen = el.querySelector('.ios-screen'); const face = el.querySelector('.contact-head .contact-face'); const act = el.querySelector('.contact-act')
      return { name: el.querySelector('.contact-head__name')?.textContent, face: !!face?.querySelector('img'), faceRound: face ? getComputedStyle(face).borderRadius === '50%' : false, faceWide: face ? Math.round(face.getBoundingClientRect().width) : 0, page: getComputedStyle(screen).backgroundColor, tone: screen.dataset.tone, ink: getComputedStyle(el.querySelector('.contact-head__name')).color,
        acts: [...el.querySelectorAll('.contact-act')].map((a) => `${a.tagName.toLowerCase()} ${a.textContent.trim()}${a.getAttribute('href') ? ' ' + a.getAttribute('href') + ' ' + a.target + ' ' + a.rel : ''}`), actRound: act ? getComputedStyle(act).borderRadius === '50%' && Math.round(act.getBoundingClientRect().width) === 64 : false,
        fields: [...el.querySelectorAll('.contact-field')].map((f) => `${f.querySelector('dt').textContent}: ${f.querySelector('dd').textContent}`), back: !!el.querySelector('button[aria-label="Back"]') }
    })
    say(s.stacks.finder.join() === 'co:Eight Sleep' && s.sheet === null && card.name === 'Eight Sleep' && card.face && card.faceRound && card.back, "a row opens the company's card: its logo in a round face and its name under it, with Back to the list", JSON.stringify({ stack: s.stacks.finder, name: card.name, face: card.faceWide }))
    // The card is a page in the colour of its picture, as a contact's is, with white words on it
    say(card.tone === 'dark' && card.ink === 'rgb(255, 255, 255)' && !/^rgb\((0, 0, 0|255, 255, 255|242, 242, 247)\)$/.test(card.page), 'the card is in a colour of its own, taken from the logo, with its words in white', `${card.page} ${card.ink}`)
    say(card.acts.length === 2 && /^a Website, opens in a new tab https?:\/\/(www\.)?eightsleep\.com\/? _blank noopener$/.test(card.acts[0]) && card.acts[1] === 'button Share' && card.actRound, 'what can be done from it, on round buttons: its website, in a tab of its own, and passing it on', card.acts.join(' | '))
    say(card.fields.length === 3 && /^website: eightsleep\.com, opens in a new tab$/.test(card.fields[0]) && card.fields[1] === 'vertical: Health' && /^about: .{10,}/.test(card.fields[2]), 'and what it knows: the site, the vertical, what the company does', card.fields.join(' | '))
    await page.screenshot({ path: path.join(out, 'apps-company.png') })
    await page.goBack(); await sleep(900)
    s = await st()
    say(s.stacks.finder.length === 0 && (await top.locator('[data-scroller]').evaluate((el) => Math.round(el.scrollTop))) === before, "the browser's back returns to the list, where it was")
    // Shrug's own card
    await top.locator('[data-scroller]').evaluate((el) => (el.scrollTop = 0)); await sleep(200)
    await top.locator('.contacts-me').tap(); await sleep(1100)
    s = await st()
    const mine = await top.evaluate((el) => ({ name: el.querySelector('.contact-head__name')?.textContent, fields: [...el.querySelectorAll('.contact-field')].map((f) => `${f.querySelector('dt').textContent}: ${f.querySelector('dd').textContent}`), acts: [...el.querySelectorAll('.contact-act')].map((a) => a.textContent.trim()) }))
    say(s.stacks.finder.join() === 'me' && mine.name === 'Shrug Capital' && mine.fields.some((f) => /^started: 2017$/.test(f)) && mine.fields.some((f) => /^partners: /.test(f)) && mine.fields.some((f) => /^portfolio: 81 companies in 13 verticals$/.test(f)) && mine.acts.join() === 'One-pager, opens in a new tab,Share', "My Card is Shrug's: who it is, as About Shrug says it on the desktop, and the one-pager", mine.fields.map((f) => f.slice(0, 26)).join(' | '))
    await top.locator('button[aria-label="Back"]').first().tap(); await sleep(900)
    // Search, at the foot of the list
    await top.locator('.ios-search__input').tap(); await sleep(300)
    await page.keyboard.type('space'); await sleep(500)
    const found = await top.locator('.contacts-row').evaluateAll((els) => els.map((el) => el.textContent.replace(/\s+/g, ' ').trim()))
    say(found.length > 0 && found.length < 81 && found.some((t) => /^Varda, Deep tech$/.test(t)) && (await top.locator('.contacts-index').count()) === 0 && (await top.locator('.contacts-me').count()) === 0, 'search finds a company by what it does, says which vertical it is in, and the index gives way', found.join(' | ').slice(0, 120))
    await top.locator('button[aria-label="Cancel"]').tap(); await sleep(500)
    say((await top.locator('.contacts-row').count()) === 81 && (await top.locator('.contacts-index').count()) === 1 && (await top.locator('.ios-search__input').inputValue()) === '', 'Cancel brings the whole list back')
    const left = await app.evaluate((el) => ({ tabs: el.querySelectorAll('.ios-tabs, [role="tablist"]').length, cards: el.querySelectorAll('.wallet-card, .wallet-slot').length }))
    say(left.tabs === 0 && left.cards === 0, 'the list is all there is: no tabs, and nothing of the Wallet', JSON.stringify(left))
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
    // Laid out as a collection is in Photos: the first picture heads the page, the name over its foot
    const head = await top.evaluate((el) => { const h = el.querySelector('.photos-head'); const r = h?.getBoundingClientRect(); const g = el.querySelector('.photos-grid')?.getBoundingClientRect(); return h ? { top: Math.round(r.top), tall: Math.round(r.height), line: h.querySelector('.photos-head__line')?.textContent, play: !!h.querySelector('button.photos-head__play'), gridUnder: !!g && g.top >= r.bottom - 0.5, sorter: !!el.querySelector('.ios-foot button[aria-label="Sort and Filter"]') } : null })
    say(!!head && head.top === 0 && head.tall > 300 && head.play && head.gridUnder && head.sorter && head.line === 'From the people who got a drop', 'the first picture heads the page from the very top of the screen, with the name and a Play button over it; the grid is under it, and Sort and Filter floats at the foot', JSON.stringify(head))
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
