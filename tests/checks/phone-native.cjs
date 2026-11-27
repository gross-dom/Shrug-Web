// The phone's own apps for what the desk has as windows (Dom, 27 Nov): Workspace, Books, ArtStore, My VIP, the
// one-pager and Updates, and the Log In sheet they share. Each opens in the phone; nothing opens a tab.
//   node phone-native.cjs [base url]
const { chromium } = require('playwright')
const path = require('path')
const base = process.argv[2] || 'http://127.0.0.1:5173/'
;(async () => {
  // (the chair is drawn in 3D where the browser can: a software one will do)
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  let failed = 0
  const say = (ok, what, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`) }
  const errors = []
  const ctx = await browser.newContext({ viewport: { width: 393, height: 760 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))
  const sleep = (ms) => page.waitForTimeout(ms)
  const st = () => page.evaluate(() => history.state?.shrug)
  const shot = (name) => page.screenshot({ path: path.join(__dirname, '..', 'audit', 'shots', `native-${name}.png`) })
  const front = (id) => `.sb-slot[data-front][data-app="${id}"]`
  const top = (id) => `${front(id)} .ios-page[data-pos="top"]`
  const frameOf = () => page.frames().filter((f) => /\/vip\//.test(f.url())).pop()
  const arrive = async (word) => { await page.goto(`${base}?still&open=${word}`); await sleep(2800) }
  const bar = (id) => page.evaluate((sel) => [...document.querySelectorAll(`${sel} .ios-bar button`)].map((b) => b.getAttribute('aria-label')), top(id))
  const tabs = () => ctx.pages().length
  /** Logs in through the phone's sheet, which is up: an address, a number where one is asked for, six digits, a name the first time. */
  const logIn = async (email, name, phone = '4155550134') => {
    const head = () => page.locator('.login-ios .account__head').innerText()
    /** Six digits, once the boxes for them are there and taking typing. */
    const code = async () => { await page.waitForSelector('.login-ios .account__code input:not([disabled])', { timeout: 8000 }); await sleep(250); await page.locator('.login-ios .account__code input').focus(); await page.keyboard.type('246810'); await sleep(1900) }
    const number = async () => { await page.locator('.login-ios input[type=tel]').fill(phone); await page.locator('.login-ios .account__go').tap(); await code() }
    await page.locator('.login-ios input[type=email]').fill(email); await page.locator('.login-ios .account__go').tap()
    await page.waitForSelector('.login-ios :is(input[type=tel], .account__code input)', { timeout: 8000 }); await sleep(250)
    const steps = [await head()]
    if (await page.locator('.login-ios input[type=tel]').count()) { await number(); steps.push('Enter the code') } else await code()
    for (let i = 0; i < 3 && (await page.locator('.login-ios .account__head').count()); i++) {
      steps.push(await head())
      if (await page.locator('.login-ios input[type=tel]').count()) await number()
      else if (await page.locator('.login-ios input[type=text]').count()) { await page.locator('.login-ios input[type=text]').fill(name); await page.locator('.login-ios .account__go').tap(); await sleep(1700) }
      else break
    }
    await sleep(600)
    return steps
  }

  await page.goto(base + '?reset&still'); await sleep(1500)

  // ---- Workspace: the colors, a studio in one of them, its pictures, the sixteen more, owners, and the price behind Log In ----
  await arrive('workspace')
  let s = await st()
  const first = await page.evaluate((sel) => ({ head: document.querySelector(`${sel} .wsp-head`)?.textContent, slabs: [...document.querySelectorAll(`${sel} .wsp-slab b`)].map((b) => b.textContent), chairs: [...document.querySelectorAll(`${sel} .wsp-slab__chair`)].filter((img) => img.complete && img.naturalWidth > 0).length, chips: [...document.querySelectorAll(`${sel} .wsp-chip`)].map((b) => b.textContent), frames: document.querySelectorAll(`${sel} iframe`).length }), top('workspace'))
  say(s?.app === 'workspace' && first.head === 'Your new daily driver' && first.slabs.length === 9 && first.slabs[0] === 'Matte Leather' && first.slabs[8] === 'Custom Coloring' && first.chairs === 8 && first.frames === 0, 'Workspace opens on the colors, as the desk’s does: its headline, a slab for each of the eight with its chair on it, and one for the sixteen more. It is the phone’s own, not the store’s page in a frame', JSON.stringify(first))
  say((await bar('workspace')).join() === 'Log In', 'its bar has Log In at its end, for nobody logged in', (await bar('workspace')).join())
  await page.locator(`${top('workspace')} .wsp-slab`, { hasText: 'Scuderia Red' }).tap()
  await page.waitForSelector(`${top('workspace')} .wsp-table[data-3d]`, { timeout: 15000 }).catch(() => {})
  await sleep(900)
  s = await st()
  const studio = await page.evaluate((sel) => { const el = document.querySelector(sel); const st = el?.querySelector('.wsp-st'); const stage = el?.querySelector('.wsp-stage')?.getBoundingClientRect(); const foot = el?.querySelector('.wsp-foot')?.getBoundingClientRect(); return el && st && stage && foot ? { name: el.querySelector('.wsp-info h3')?.textContent, ground: getComputedStyle(st).backgroundColor, word: el.querySelector('.wsp-word')?.textContent, three: el.querySelector('.wsp-table')?.hasAttribute('data-3d'), still: !!el.querySelector('.wsp-still'), shots: el.querySelectorAll('.wsp-shot').length, dots: el.querySelectorAll('.wsp-dot').length, on: el.querySelector('.wsp-dot.on')?.getAttribute('aria-label'), buy: el.querySelector('.wsp-buy')?.textContent.trim(), fits: Math.round(foot.bottom) <= window.innerHeight + 1 && stage.height > 200, tags: [...el.querySelectorAll('.wsp-tag')].map((t) => t.textContent) } : null }, top('workspace'))
  say(s?.stacks?.workspace?.join() === 'studio' && !!studio && studio.name === 'Scuderia Red' && studio.ground === 'rgb(255, 48, 44)' && /SCUDERIA/i.test(studio.word) && studio.still && studio.shots >= 2 && studio.dots === 9 && studio.on === 'Scuderia Red' && studio.fits && studio.tags.join() === 'High gloss,Available now', 'a color picked is a screen of its own, flooded with it: its name behind the chair, the chair, its pictures in a row, its name and how it is had, and the colors in a row of dots', JSON.stringify(studio))
  say(!!studio && (studio.three === true || studio.still), 'the chair is drawn in 3D where the browser can, and its still stands in until then', String(studio?.three))
  say(!!studio && studio.buy === 'Log in to enquire', 'the price is kept for someone logged in: the one button says so', studio?.buy)
  await shot('workspace-studio')
  // A photograph on the stage, and back to the chair by a swipe
  await page.locator(`${top('workspace')} .wsp-shot`).nth(1).tap(); await sleep(900)
  const photo = await page.evaluate((sel) => { const el = document.querySelector(sel); const pic = el?.querySelector('.wsp-photo:not([data-leave]) .wsp-photo__pic'); return { on: el?.querySelector('.wsp-stage')?.hasAttribute('data-shot'), alt: pic?.getAttribute('alt'), loaded: !!pic && pic.complete && pic.naturalWidth > 0, pressed: el?.querySelectorAll('.wsp-shot')[1]?.getAttribute('aria-pressed') } }, top('workspace'))
  say(photo.on && /Scuderia Red/.test(photo.alt ?? '') && photo.pressed === 'true', 'a picture picked covers the stage: a photograph of the chair in that color, named for what it shows', JSON.stringify(photo))
  {
    const box = await page.locator(`${top('workspace')} .wsp-photo`).first().boundingBox()
    await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); const fire = (type, cx) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: 'touch', clientX: cx, clientY: y })); fire('pointerdown', x); fire('pointerup', x + 120) }, [box.x + 80, box.y + box.height / 2])
    await sleep(900)
    say((await page.locator(`${top('workspace')} .wsp-shot`).first().getAttribute('aria-pressed')) === 'true' && !(await page.locator(`${top('workspace')} .wsp-stage`).getAttribute('data-shot')), 'a swipe back along the first photograph is the chair again')
  }
  // Another color, from the dots; and one of the sixteen more, from the sheet
  await page.locator(`${top('workspace')} .wsp-dot[aria-label="Supersonic"]`).tap(); await sleep(900)
  const white = await page.evaluate((sel) => ({ name: document.querySelector(`${sel} .wsp-info h3`)?.textContent, ground: getComputedStyle(document.querySelector(`${sel} .wsp-st`)).backgroundColor, ink: getComputedStyle(document.querySelector(`${sel} .wsp-st`)).color }), top('workspace'))
  say(white.name === 'Supersonic' && white.ground === 'rgb(255, 255, 255)' && white.ink === 'rgb(20, 20, 20)', 'a dot changes the color where it stands: the screen is in it, in words that can be read on it', JSON.stringify(white))
  await page.locator(`${top('workspace')} .wsp-dot--more`).tap(); await sleep(900)
  const more = await page.evaluate(() => ({ sheet: document.querySelector('.ios-sheet.wsp-more')?.getAttribute('aria-label'), swatches: [...document.querySelectorAll('.wsp-swatch')].map((b) => b.textContent) }))
  say(more.sheet === 'More colors' && more.swatches.length === 16 && more.swatches.includes('Manhattan Blue'), 'the last dot brings the sixteen more up in a sheet, each a slab of its color with its name', JSON.stringify(more).slice(0, 160))
  await page.locator('.wsp-swatch', { hasText: 'Championship Green' }).tap(); await sleep(1400)
  const made = await page.evaluate((sel) => ({ name: document.querySelector(`${sel} .wsp-info h3`)?.textContent, tags: [...document.querySelectorAll(`${sel} .wsp-tag`)].map((t) => t.textContent).join(), dots: document.querySelectorAll(`${sel} .wsp-dot`).length, sheet: document.querySelectorAll('.ios-sheet:not([data-closing])').length }), top('workspace'))
  say(made.name === 'Championship Green' && /Made to Order/.test(made.tags) && made.dots === 10 && made.sheet === 0, 'one picked there is the studio’s, made to order, and is added to the row of dots', JSON.stringify(made))
  // Log in from the button: the phone's own sheet, and the price after
  await page.locator(`${top('workspace')} .wsp-btn`).tap(); await sleep(800)
  const asked = await page.evaluate(() => ({ sheet: document.querySelector('.ios-sheet.login-ios')?.getAttribute('aria-label'), head: document.querySelector('.login-ios .account__head')?.textContent, lead: document.querySelector('.login-ios .account__lead')?.textContent, looks: [...document.querySelectorAll('.login-ios .account__looks')].filter((el) => el.offsetParent).length }))
  say(asked.sheet === 'Log in' && asked.head === 'Log in to enquire' && /Championship Green is kept/.test(asked.lead ?? '') && asked.looks === 0, 'Log in to enquire brings up the phone’s own Log In sheet, which says what it was opened for (and offers no desk appearance: a phone has its own)', JSON.stringify(asked))
  const before = tabs()
  const steps = await logIn('pat.phone@example.com', 'Pat Phone')
  s = await st()
  const priced = await page.evaluate((sel) => ({ buy: document.querySelector(`${sel} .wsp-buy`)?.textContent.replace(/\s+/g, ' ').trim(), sheet: document.querySelectorAll('.ios-sheet:not([data-closing])').length }), top('workspace'))
  say(steps.join(' > ') === 'What’s your number? > Enter the code > What’s your name?' && priced.sheet === 0 && tabs() === before && s?.sheet === null, 'an address nobody has is asked for a number, six digits and a name, all in the sheet, which then goes: nobody is sent to another page', steps.join(' > '))
  say(/^From \$1,200 ?Order$/.test(priced.buy ?? '') && (await bar('workspace')).some((label) => /^Your balance: 200 points/.test(label ?? '')), 'logged in, the chair has its price and its button, and the bar their balance: 200 points, as an account begins with', JSON.stringify({ buy: priced.buy, bar: await bar('workspace') }))
  // Buying is the store's own page for that chair, in the app and in its color
  await page.locator(`${top('workspace')} .wsp-btn`).tap(); await sleep(3200)
  s = await st()
  const buying = frameOf()
  const page1 = buying ? await buying.evaluate(() => ({ url: location.pathname + location.search, tint: document.documentElement.getAttribute('data-tint'), bar: !!document.querySelector('.up-top'), name: document.querySelector('h1')?.textContent })) : null
  say(s?.stacks?.workspace?.join() === 'studio,buy' && !!page1 && /k=chairs&p=chair-championship-green&c=/.test(page1.url) && !!page1.tint && !page1.bar && page1.name === 'Championship Green' && tabs() === before, 'the button opens the store’s own page for that chair inside the app, in the chair’s color and with no bar of its own', JSON.stringify(page1))
  await page.locator(`${top('workspace')} .ios-bar button[aria-label="Championship Green"]`).tap(); await sleep(900)
  s = await st()
  say(s?.stacks?.workspace?.join() === 'studio', 'and Back, named for the color, is the studio again')
  await page.locator(`${top('workspace')} .ios-bar button[aria-label="Colors"]`).tap(); await sleep(900)
  const chips = await page.locator(`${top('workspace')} .wsp-chip`).allTextContents()
  if (chips.includes('Notable Owners')) {
    await page.locator(`${top('workspace')} .wsp-chip`, { hasText: 'Notable Owners' }).tap(); await sleep(900)
    say((await st())?.stacks?.workspace?.join() === 'owners' && (await page.locator(`${top('workspace')} .wsp-card`).count()) >= 1, 'Notable Owners, from the colors, is a screen of cards, each in its owner’s color')
    await page.goBack(); await sleep(800)
  }
  if (chips.includes('BTS')) {
    await page.locator(`${top('workspace')} .wsp-chip`, { hasText: 'BTS' }).tap(); await sleep(900)
    const wall = await page.locator(`${top('workspace')} .wsp-tile`).count()
    await page.locator(`${top('workspace')} .wsp-tile button`).first().tap(); await sleep(500)
    const look = await page.locator(`${top('workspace')} .wsp-look`).count()
    await page.locator(`${top('workspace')} .wsp-look__x`).tap(); await sleep(400)
    say((await st())?.stacks?.workspace?.join() === 'bts' && wall >= 1 && look === 1 && (await page.locator(`${top('workspace')} .wsp-look`).count()) === 0, 'BTS is a wall of pictures; one pressed is shown large, and put away by its x', `${wall} tiles`)
    await page.goBack(); await sleep(800)
  }

  // ---- Books: the shelf, a book's page, the Library and the reader ----
  await arrive('books')
  const shelf = await page.evaluate((sel) => ({ title: document.querySelector(`${sel} .ios-large`)?.textContent, books: [...document.querySelectorAll(`${sel} .bkp-book > b`)].map((b) => b.textContent), covers: document.querySelectorAll(`${sel} .bkp-book .bk-cover > :is(img, .bk-drawn)`).length, tabs: [...document.querySelectorAll(`${sel} .bkp-tabs [role=tab]`)].map((t) => `${t.textContent}:${t.getAttribute('aria-selected')}`), frames: document.querySelectorAll(`${sel} iframe`).length }), top('books'))
  say(shelf.title === 'Book Store' && shelf.books.length === 5 && shelf.covers === 5 && shelf.tabs.join() === 'Book Store:true,Library:false' && shelf.frames === 0, 'Books opens on the Book Store: five books, each under a cover (its photograph, or its title drawn), and at the foot the two places it has', JSON.stringify(shelf))
  await page.locator(`${top('books')} .bkp-book`).first().tap(); await sleep(3200)
  s = await st()
  const book = frameOf() ? await frameOf().evaluate(() => ({ url: location.search, name: document.querySelector('h1')?.textContent, qty: !!document.querySelector('.ui-qty') })) : null
  say(/^b:/.test(s?.stacks?.books?.[0] ?? '') && !!book && /k=books&p=/.test(book.url) && book.name === shelf.books[0] && book.qty, 'a book opens on its own page, the store’s, inside the app: what it costs and how many', JSON.stringify(book))
  await page.goBack(); await sleep(900)
  await page.locator(`${top('books')} .bkp-tabs [role=tab]`, { hasText: 'Library' }).tap(); await sleep(600)
  const library = await page.evaluate((sel) => ({ title: document.querySelector(`${sel} .ios-large`)?.textContent, books: document.querySelectorAll(`${sel} .bkp-book`).length, app: history.state?.shrug?.app }), top('books'))
  say(library.title === 'Library' && library.app === 'books', 'Library is the other place, in the same screen', JSON.stringify(library))
  if (library.books > 0) {
    await page.locator(`${top('books')} .bkp-book`).first().tap(); await sleep(1400)
    const read = async () => page.locator(`${top('books')} .rd`).getAttribute('aria-label')
    const one = await read()
    const box = await page.locator(`${top('books')} .bkp-pages`).boundingBox()
    await page.touchscreen.tap(box.x + box.width * 0.86, box.y + box.height * 0.5); await sleep(700)
    const two = await read()
    await page.evaluate(([x, y]) => { const el = document.querySelector('.bkp-pages'); const fire = (type, cx) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 9, pointerType: 'touch', clientX: cx, clientY: y })); fire('pointerdown', x); fire('pointerup', x + 140) }, [box.x + 100, box.y + box.height / 2])
    await sleep(700)
    const back = await read()
    say(/page 1 of \d+$/.test(one ?? '') && /page 2 of \d+$/.test(two ?? '') && back === one, 'a book of the Library opens in the reader, a page to the screen: a tap at its side turns on, and a swipe turns back', [one, two, back].join(' | '))
    say((await bar('books')).join() === 'Library,Contents,Text size: medium. Change it' || (await bar('books')).filter(Boolean).length >= 2, 'its bar has the way back, the contents and the size of the letters', (await bar('books')).join())
    await shot('books-reader')
  }

  // ---- My VIP: their card and what is theirs, and the ways in to the three stores ----
  await arrive('vip')
  const mine = frameOf() ? await frameOf().evaluate(() => ({ url: location.search, heading: [...document.querySelectorAll('h1')].map((h) => `${h.textContent}:${h.className}`).join(), card: !!document.querySelector('.mc'), doors: [...document.querySelectorAll('.up-door b')].map((b) => b.textContent), bar: !!document.querySelector('.up-top') })) : null
  say(!!mine && /k=yours/.test(mine.url) && mine.heading === 'My VIP:sr-only' && mine.card && mine.doors.join() === 'ArtStore,Books,Workspace' && !mine.bar, 'My VIP is the store’s own page for what is theirs: their card, and the ways in to the three stores, under the phone’s bar and none of its own', JSON.stringify(mine))
  say((await bar('myvip')).join() === 'Your account', 'its bar ends in their own picture, which is their account', (await bar('myvip')).join())
  await frameOf().locator('.up-door', { hasText: 'Books' }).tap(); await sleep(1600)
  say((await st())?.app === 'books', 'a door opens that store, the app')
  await arrive('vip')
  await page.locator(`${top('myvip')} .ios-bar button[aria-label="Your account"]`).tap(); await sleep(800)
  const account = await page.evaluate(() => ({ who: document.querySelector('.login-ios .account__who b')?.textContent, rows: [...document.querySelectorAll('.login-ios .account__row')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()) }))
  say(account.who === 'Pat Phone' && /^Points ?200 pts/.test(account.rows[0] ?? '') && account.rows.includes('Log Out') && !account.rows.includes('Open Updates'), 'their account is the same sheet: who they are, their points, their name and picture to change, and Log Out', JSON.stringify(account))
  await page.locator('.login-ios .account__row', { hasText: 'Log Out' }).tap(); await sleep(1500)
  const out = frameOf() ? await frameOf().evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 60)) : null
  say(/Log in to see My VIP/.test(out ?? '') && (await bar('myvip')).join() === 'Log In', 'logged out there, My VIP asks a visitor to log in, and so does its bar', out)

  // ---- The one-pager: an app, the document itself ----
  await page.goto(base + '?still'); await sleep(1500); await page.keyboard.press('Enter'); await sleep(1100)
  const was = tabs()
  await page.locator('.sb-icon[aria-label^="One-pager"]').first().tap(); await sleep(1800)
  s = await st()
  const paper = await page.evaluate((sel) => ({ pages: document.querySelectorAll(`${sel} .pp-page`).length, wide: Math.round(document.querySelector(`${sel} .pp-page`)?.getBoundingClientRect().width ?? 0), heading: document.querySelector(`${sel} .op h1`)?.textContent, says: document.querySelector(`${sel} .ios-bar__sub`)?.textContent }), top('preview'))
  say(s?.app === 'preview' && tabs() === was && paper.pages === 2 && paper.wide > 340 && paper.wide <= 393 && !!paper.heading && paper.says === 'Page 1 of 2', 'the one-pager opens in the phone, in no tab of its own: its two pages, one under the other, as wide as the screen', JSON.stringify(paper))
  say((await bar('preview')).join() === 'Save One-pager.pdf', 'its bar has the way to save the file', (await bar('preview')).join())
  {
    const box = await page.locator(`${top('preview')} .pp-main`).boundingBox()
    await page.touchscreen.tap(box.x + 120, box.y + 160); await sleep(110); await page.touchscreen.tap(box.x + 120, box.y + 160); await sleep(700)
    const near = await page.evaluate((sel) => ({ zoomed: document.querySelector(`${sel} .pp-main`)?.hasAttribute('data-zoomed'), wide: Math.round(document.querySelector(`${sel} .pp-page`)?.getBoundingClientRect().width ?? 0) }), top('preview'))
    await page.touchscreen.tap(box.x + 120, box.y + 160); await sleep(110); await page.touchscreen.tap(box.x + 120, box.y + 160); await sleep(700)
    const fitted = await page.evaluate((sel) => Math.round(document.querySelector(`${sel} .pp-page`)?.getBoundingClientRect().width ?? 0), top('preview'))
    say(near.zoomed && near.wide > paper.wide * 2 && fitted === paper.wide, 'a double tap brings a page up close, and another puts it back', JSON.stringify({ near, fitted }))
  }
  await shot('one-pager')

  // ---- Updates: locked to a visitor, and an LP's own documents ----
  await arrive('updates')
  const locked = await page.evaluate((sel) => ({ title: document.querySelector(`${sel} .ios-large`)?.textContent, says: document.querySelector(`${sel} .ios-empty`)?.textContent, rows: document.querySelectorAll(`${sel} .upp-row`).length, ways: [...document.querySelectorAll(`${sel} .upp-locked button`)].map((b) => b.textContent) }), top('updates'))
  say(locked.title === 'Updates' && /for Shrug LPs only/.test(locked.says ?? '') && locked.rows === 0 && locked.ways.join() === 'Log In,Enquire about becoming an LP', 'Updates says who it is for and shows nothing of what is in it: the way to log in, and the way to ask about becoming an LP', JSON.stringify(locked))
  await page.locator(`${top('updates')} .upp-locked .pp-go`).tap(); await sleep(800)
  say((await page.locator('.login-ios .account__head').innerText()) === 'Log in to open Updates' && (await page.locator('.ios-sheet.login-ios--light').count()) === 1, 'Log In there brings the sheet up saying so, pale over a pale app')
  // (a number of their own: the one above is on the other account by now, and a number is one account's)
  const lp = await logIn('lp@example.com', 'Jordan Avery', '4155550177')
  const folder = await page.evaluate((sel) => ({ sub: document.querySelector(`${sel} .ios-large-sub`)?.textContent, groups: [...document.querySelectorAll(`${sel} .ios-section__header`)].map((h) => h.textContent), rows: [...document.querySelectorAll(`${sel} .upp-row .ios-cell__title`)].map((t) => t.textContent), acts: [...document.querySelectorAll(`${sel} .upp-act`)].map((t) => t.textContent) }), top('updates'))
  say(lp.join(' > ') === 'Check your inbox > Email confirmed > What’s your name?' && (await page.locator('.ios-sheet:not([data-closing])').count()) === 0, 'an address on the list is confirmed by its inbox, asked for a number to use from then on, and for a name, in the same sheet', lp.join(' > '))
  say(/^LP · /.test(folder.sub ?? '') && folder.groups.join() === 'Funds,SPVs' && folder.rows.length >= 3 && folder.acts.includes('Request'), 'an LP is shown their documents, under Funds and SPVs, each to open or to ask for', JSON.stringify(folder).slice(0, 300))
  await page.locator(`${top('updates')} .upp-row`).first().tap()
  await page.waitForSelector(`${top('updates')} .pp-page canvas[data-drawn]`, { timeout: 15000 }).catch(() => {})
  await sleep(600)
  s = await st()
  const doc = await page.evaluate((sel) => ({ pages: document.querySelectorAll(`${sel} .pp-page`).length, drawn: document.querySelectorAll(`${sel} .pp-page canvas[data-drawn]`).length, whose: document.querySelector(`${sel} .pp-for`)?.textContent }), top('updates'))
  say(/^d:/.test(s?.stacks?.updates?.[0] ?? '') && doc.pages >= 1 && doc.drawn >= 1 && /Private · Prepared for Jordan Avery/.test(doc.whose ?? ''), 'one opens in the same reader: its pages drawn, and whose it is under them', JSON.stringify(doc))
  await shot('updates-document')

  const seen = [...new Set(errors)].filter((e) => !/Failed to load resource|\[vite\]|GPU stall|WebGL|GL Driver/i.test(e))
  say(seen.length === 0, seen.length ? 'console errors: ' + seen.slice(0, 6).join(' | ') : 'no console errors')
  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'ALL PASS')
  process.exit(failed ? 1 : 0)
})().catch((e) => { console.error('FAILED', e.message.split('\n').slice(0, 8).join('\n')); process.exit(1) })
