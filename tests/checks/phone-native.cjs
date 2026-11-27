// The phone's own apps for what the desk has as windows (Dom, 27 Nov): Workspace, Books, ArtStore, My VIP, the
// one-pager and Updates, and the Log In tray, checkout and My VIP's sheet they share. Each is a screen of the
// phone's own (no frame); nothing opens a tab.
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
  /** Logs in through the phone's tray, which is up, typing as a person would: into whatever has the keyboard.
   * An address, a number where one is asked for, six digits, a name and a picture the first time. Gives back
   * what each step was headed, and whether one field kept the keyboard through every step that is typed. */
  const logIn = async (email, name, phone = '4155550134') => {
    const head = () => page.locator('.ios-tray .lt-head').innerText().catch(() => '')
    const next = async (was) => { for (let i = 0; i < 50; i++) { await sleep(150); const now = await head(); if (now !== was) { await sleep(350); return head() } } return was }
    const typing = () => page.evaluate(() => { const el = document.activeElement; window.__field ??= el; return el?.tagName === 'INPUT' && !!el.closest('.lt-field') && el === window.__field })
    await page.evaluate(() => delete window.__field)
    const steps = [await head()]
    let kept = await typing()
    await page.keyboard.type(email); await page.locator('.ios-tray .lt-go').tap()
    let at = await next(steps[0])
    for (let i = 0; i < 8 && at; i++) {
      steps.push(at)
      if (at === 'Pick a picture') { await page.locator('.ios-tray .lt-go').tap(); at = await next(at); continue }
      kept = kept && (await typing())
      if (/^(Enter the code|Check your inbox)$/.test(at)) await page.keyboard.type('246810')
      else if (/name/i.test(at)) { await page.locator('.ios-tray .lt-field input').fill(name); await page.locator('.ios-tray .lt-go').tap() }
      else { await page.keyboard.type(phone); await page.locator('.ios-tray .lt-go').tap() }
      at = await next(at)
    }
    await sleep(700)
    return Object.assign(steps.slice(1), { kept, first: steps[0] })
  }

  await page.goto(base + '?reset&still'); await sleep(1500)

  // ---- Workspace: the colors, a studio in one of them, its pictures, the sixteen more, owners, and the price behind Log In ----
  await arrive('workspace')
  let s = await st()
  const first = await page.evaluate((sel) => ({ head: document.querySelector(`${sel} .wsp-head`)?.textContent, slabs: [...document.querySelectorAll(`${sel} .wsp-slab b`)].map((b) => b.textContent), chairs: [...document.querySelectorAll(`${sel} .wsp-slab__chair`)].filter((img) => img.complete && img.naturalWidth > 0).length, chips: [...document.querySelectorAll(`${sel} .wsp-chip`)].map((b) => b.textContent), frames: document.querySelectorAll(`${sel} iframe`).length }), top('workspace'))
  say(s?.app === 'workspace' && first.head === 'Your new daily driver' && first.slabs.length === 9 && first.slabs[0] === 'Matte Leather' && first.slabs[8] === 'Custom Coloring' && first.chairs === 8 && first.frames === 0, 'Workspace opens on the colors, as the desk’s does: its headline, a slab for each of the eight with its chair on it, and one for the sixteen more. It is the phone’s own, not the store’s page in a frame', JSON.stringify(first))
  say((await bar('workspace')).join() === 'Home Screen,Log In', 'its bar has the way back to the Home Screen at its start, and Log In at its end for nobody logged in', (await bar('workspace')).join())
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
  // Log in from the button: the phone's own tray, and the price after
  await page.locator(`${top('workspace')} .wsp-btn`).tap(); await sleep(900)
  const asked = await page.evaluate(() => { const tray = document.querySelector('.ios-sheet.ios-tray'); const panel = tray?.querySelector('.ios-sheet__panel')?.getBoundingClientRect(); const stage = document.querySelector('.ph')?.getBoundingClientRect(); return { sheet: tray?.getAttribute('aria-label'), detent: tray?.getAttribute('data-detent'), head: tray?.querySelector('.lt-head')?.textContent, lead: tray?.querySelector('.lt-lead')?.textContent, ready: document.activeElement?.tagName === 'INPUT' && !!document.activeElement.closest('.lt-field'), asks: document.activeElement?.getAttribute('inputmode'), floats: !!panel && !!stage && panel.left - stage.left >= 6 && stage.right - panel.right >= 6 && stage.bottom - panel.bottom >= 6 && panel.height < stage.height * 0.7 } })
  say(asked.sheet === 'Log in' && asked.detent === 'tray' && asked.head === 'Log in to enquire' && /Championship Green is kept/.test(asked.lead ?? '') && asked.ready && asked.asks === 'email' && asked.floats, 'Log in to enquire brings up the phone’s own Log In: a tray floating at the foot of the screen, no taller than what it holds, which says what it was opened for and has its field ready to type in', JSON.stringify(asked))
  const before = tabs()
  const steps = await logIn('pat.phone@example.com', 'Pat Phone')
  s = await st()
  const priced = await page.evaluate((sel) => ({ buy: document.querySelector(`${sel} .wsp-buy`)?.textContent.replace(/\s+/g, ' ').trim(), sheet: document.querySelectorAll('.ios-sheet:not([data-closing])').length }), top('workspace'))
  say(steps.join(' > ') === 'What’s your number? > Enter the code > What’s your name? > Pick a picture' && priced.sheet === 0 && tabs() === before && s?.sheet === null, 'an address nobody has is asked for a number, six digits, a name and then a picture, all in the tray, which then goes: nobody is sent to another page', steps.join(' > '))
  say(steps.kept, 'one field has the keyboard from the address to the name: it is never put away between steps, so the keyboard never drops')
  say(/^From \$1,200 ?Order$/.test(priced.buy ?? '') && (await bar('workspace')).some((label) => /^Your balance: 200 points/.test(label ?? '')), 'logged in, the chair has its price and its button, and the bar their balance: 200 points, as an account begins with', JSON.stringify({ buy: priced.buy, bar: await bar('workspace') }))
  // Buying is checkout's tray, up over the studio: nobody leaves the chair to buy it
  await page.locator(`${top('workspace')} .wsp-btn`).tap(); await sleep(1100)
  s = await st()
  const buying = await page.evaluate(() => { const tray = document.querySelector('.ios-sheet.ios-tray'); return { label: tray?.getAttribute('aria-label'), item: tray?.querySelector('.co-what b')?.textContent, points: tray?.querySelector('.co-points__said b')?.textContent.replace(/\s+/g, ' ').trim(), total: tray?.querySelector('.co-total dd')?.textContent, ways: [...(tray?.querySelectorAll('.co-pay .ui-btn') ?? [])].map((b) => b.textContent), frames: document.querySelectorAll('.sb-slot[data-front] iframe').length } })
  say(s?.stacks?.workspace?.join() === 'studio' && s?.sheet === 'checkout' && buying.label === 'Checkout' && buying.item === 'Workspace, Championship Green' && /^200 of your 200 points/.test(buying.points ?? '') && /^\$1,2\d\d$/.test(buying.total ?? '') && buying.ways.join() === 'Pay with Apple Pay,Pay with card' && buying.frames === 0 && tabs() === before, 'the button brings checkout up over the studio, a tray of the phone’s own: the chair, the points they would use, the total and the ways to pay', JSON.stringify(buying))
  await page.locator('.ios-sheet.ios-tray button[aria-label="Close"]').tap(); await sleep(900)
  s = await st()
  say(s?.stacks?.workspace?.join() === 'studio' && s?.sheet === null && (await page.locator('.ios-sheet:not([data-closing])').count()) === 0, 'put away by its x, they are on the chair they were on')
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

  // (loaded again, the studio's row of dots is the eight and the way to the rest: what was added to it on the
  // last visit is not in it. Dom, 27 Nov: kept from visit to visit, the row opened with too many)
  await arrive('workspace')
  await page.locator(`${top('workspace')} .wsp-slab`, { hasText: 'Solar Orange' }).tap(); await sleep(1400)
  const again = await page.evaluate((sel) => [...document.querySelectorAll(`${sel} .wsp-dot`)].map((d) => d.getAttribute('aria-label')), top('workspace'))
  say(again.length === 9 && again[8] === 'More colors' && !again.includes('Championship Green'), 'loaded again, a color picked from the eight opens the studio on the eight: what was added last visit is not in the row', again.join())

  // ---- Books: the shelf, a book's page, the Library and the reader ----
  await arrive('books')
  const shelf = await page.evaluate((sel) => { const cards = [...document.querySelectorAll(`${sel} .st-card`)].map((c) => c.getBoundingClientRect()); const screen = document.querySelector(sel).getBoundingClientRect(); return { title: document.querySelector(`${sel} .ios-large`)?.textContent, books: [...document.querySelectorAll(`${sel} .st-card__name`)].map((b) => b.textContent), covers: document.querySelectorAll(`${sel} .st-card__pic > :is(img, .st-cover)`).length, buttons: [...document.querySelectorAll(`${sel} .st-card__go`)].map((b) => b.textContent), two: cards.length >= 2 && Math.abs(cards[0].top - cards[1].top) < 1 && cards[1].left > cards[0].right && cards[0].width < screen.width / 2, tabs: [...document.querySelectorAll(`${sel} .bkp-tabs [role=tab]`)].map((t) => `${t.textContent}:${t.getAttribute('aria-selected')}`), ground: getComputedStyle(document.querySelector(sel).querySelector('.ios-screen')).backgroundColor, frames: document.querySelectorAll('.sb-slot[data-front] iframe').length } }, top('books'))
  say(shelf.title === 'Book Store' && shelf.books.length === 5 && shelf.covers === 5 && shelf.two && shelf.buttons.every((b) => /^(Buy|Pre-order)$/.test(b)) && shelf.tabs.join() === 'Book Store:true,Library:false' && shelf.ground === 'rgb(242, 242, 247)' && shelf.frames === 0, 'Books opens on the Book Store, set out as Apple’s store sets a shelf out: on pale gray, five books two to a row, each a white card with its cover (its photograph, or its title drawn), its name, what it costs and a small button; and at the foot the two places it has', JSON.stringify(shelf))
  await page.locator(`${top('books')} .st-card`).first().tap(); await sleep(1400)
  s = await st()
  const book = await page.evaluate((sel) => { const card = document.querySelector(`${sel} .pd-slide`); const g = card?.getBoundingClientRect(); const screen = document.querySelector(sel)?.getBoundingClientRect(); return { name: document.querySelector(`${sel} .ios-large`)?.textContent, says: document.querySelector(`${sel} .ios-large-sub`)?.textContent, qty: !!document.querySelector(`${sel} .pd-stepper`), price: document.querySelector(`${sel} .pd-buy__price b`)?.textContent, go: document.querySelector(`${sel} .pd-buy__go`)?.textContent, card: !!g && !!screen && g.left - screen.left >= 12 && g.width < screen.width - 24 && g.width > g.height * 1.2 && parseFloat(getComputedStyle(card).borderTopLeftRadius) >= 16, frames: document.querySelectorAll('.sb-slot[data-front] iframe').length } }, top('books'))
  say(/^b:/.test(s?.stacks?.books?.[0] ?? '') && book.name === shelf.books[0] && /^\$\d+/.test(book.says ?? '') && book.qty && /^\$\d+/.test(book.price ?? '') && !!book.go && book.card && book.frames === 0, 'a book opens on its own page, a screen of the phone’s: its name and what it costs at the head, its pictures in a card with rounded corners set in from the edges and wider than it is tall, how many, and the one button at the foot', JSON.stringify(book))
  await page.locator(`${top('books')} .pd-stepper button[aria-label="One more"]`).tap(); await sleep(300)
  const two = await page.evaluate((sel) => ({ n: document.querySelector(`${sel} .pd-qty output`)?.textContent, price: document.querySelector(`${sel} .pd-buy__price b`)?.textContent }), top('books'))
  say(two.n === '2' && two.price !== book.price, 'one more of it is said at the foot: the price is the lot’s', JSON.stringify(two))
  await page.goBack(); await sleep(900)
  await page.locator(`${top('books')} .bkp-tabs [role=tab]`, { hasText: 'Library' }).tap(); await sleep(600)
  const library = await page.evaluate((sel) => ({ title: document.querySelector(`${sel} .ios-large`)?.textContent, books: document.querySelectorAll(`${sel} .st-card`).length, app: history.state?.shrug?.app }), top('books'))
  say(library.title === 'Library' && library.app === 'books', 'Library is the other place, in the same screen', JSON.stringify(library))
  if (library.books > 0) {
    await page.locator(`${top('books')} .st-card`).first().tap(); await sleep(1400)
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

  // ---- ArtStore: the shelf, a piece's page, and buying it without leaving the page ----
  await arrive('artstore')
  await page.waitForSelector(`${top('store')} .st-card img[data-in]`, { timeout: 10000 }).catch(() => {})
  const art = await page.evaluate((sel) => { const scroll = document.querySelector(`${sel} .ios-screen__scroll`); scroll?.scrollTo(0, 240); const moved = scroll?.scrollTop; scroll?.scrollTo(0, 0); const cards = [...document.querySelectorAll(`${sel} .st-card`)].map((c) => c.getBoundingClientRect()); const screen = document.querySelector(sel).getBoundingClientRect(); return { title: document.querySelector(`${sel} .ios-large`)?.textContent, pieces: [...document.querySelectorAll(`${sel} .st-card__name`)].map((b) => b.textContent), prices: [...document.querySelectorAll(`${sel} .st-card__price`)].map((b) => b.textContent), buttons: [...document.querySelectorAll(`${sel} .st-card__go`)].map((b) => b.textContent), single: cards.length >= 2 && cards[1].top >= cards[0].bottom && cards.every((c) => Math.abs(c.left - cards[0].left) < 1 && c.width > screen.width - 40), white: getComputedStyle(document.querySelector(`${sel} .st-card`)).backgroundColor, scrolls: !!scroll && scroll.scrollHeight > scroll.clientHeight && moved === 240, frames: document.querySelectorAll('.sb-slot[data-front] iframe').length, ground: getComputedStyle(document.querySelector(sel).querySelector('.ios-screen')).backgroundColor } }, top('store'))
  say(art.title === 'ArtStore' && art.pieces.length === 6 && art.pieces[0] === 'America Must Win' && art.prices.every((p) => /^\$\d/.test(p)) && art.buttons.every((b) => b === 'Buy') && art.single && art.white === 'rgb(255, 255, 255)' && art.scrolls && art.frames === 0 && art.ground === 'rgb(242, 242, 247)', 'ArtStore is a shelf of the phone’s own, set out as Apple’s store sets one out: on pale gray, six pieces in single file, each a white card with its picture, its name, its price and a small button; and it scrolls', JSON.stringify(art))
  say((await bar('store')).join().startsWith('Home Screen,Your balance:'), 'its bar has the way back to the Home Screen, and their balance at its end', (await bar('store')).join())
  await page.locator(`${top('store')} .st-card`).first().tap(); await sleep(1300)
  s = await st()
  const piece = await page.evaluate((sel) => { const el = document.querySelector(sel); const card = el?.querySelector('.pd-slide'); const g = card?.getBoundingClientRect(); const next = el?.querySelectorAll('.pd-slide')[1]?.getBoundingClientRect(); const screen = el?.getBoundingClientRect(); const dots = el?.querySelector('.pd-dots')?.getBoundingClientRect(); const buy = el?.querySelector('.pd-buy')?.getBoundingClientRect(); return { name: el?.querySelector('.ios-large')?.textContent, says: el?.querySelector('.ios-large-sub')?.textContent, slides: el?.querySelectorAll('.pd-slide').length, card: !!g && !!screen && g.left - screen.left >= 12 && g.width < screen.width - 24 && g.width > g.height * 1.2 && g.height < screen.height * 0.45 && parseFloat(getComputedStyle(card).borderTopLeftRadius) >= 16, peeks: !!next && !!screen && next.left < screen.right && next.left > g.right, under: !!dots && !!g && dots.top >= g.bottom, arrows: el?.querySelectorAll('.pd-gallery :is(.ui-round, [aria-label*="Next"], [aria-label*="Previous"])').length, price: el?.querySelector('.pd-buy__price b')?.textContent, go: el?.querySelector('.pd-buy__go')?.textContent, foot: !!buy && !!screen && buy.bottom <= screen.bottom && buy.top > screen.bottom - 130 } }, top('store'))
  say(/^p:/.test(s?.stacks?.store?.[0] ?? '') && piece.name === 'America Must Win' && piece.says === '$150' && piece.slides === 3 && piece.card && piece.peeks && piece.under && piece.arrows === 0 && piece.price === '$150' && piece.go === 'Buy' && piece.foot, 'a piece opens on its own page: its name and price at the head; its photographs in a card with rounded corners, set in from the edges, wider than it is tall and under half the screen, the next one showing at its side; the dots that say which beneath the card, and no arrows over it; its price and the one button floating at the foot', JSON.stringify(piece))
  await page.locator(`${top('store')} .pd-slide`).first().tap(); await sleep(600)
  const whole = await page.evaluate((sel) => { const el = document.querySelector(`${sel} .pd-whole`); const r = el?.getBoundingClientRect(); const screen = document.querySelector(sel)?.getBoundingClientRect(); return { up: !!el, covers: !!r && !!screen && Math.abs(r.height - screen.height) < 1 && Math.abs(r.width - screen.width) < 1, label: el?.getAttribute('aria-label') } }, top('store'))
  await page.locator(`${top('store')} .pd-whole__close`).tap(); await sleep(500)
  say(whole.up && whole.covers && /whole/.test(whole.label ?? '') && (await page.locator(`${top('store')} .pd-whole`).count()) === 0, 'a press on a photograph shows it whole, on black, over the whole screen; its x puts it away', JSON.stringify(whole))
  await page.locator(`${top('store')} .pd-buy__go`).tap(); await sleep(1100)
  s = await st()
  const tray = await page.evaluate(() => { const el = document.querySelector('.ios-sheet.ios-tray'); return { label: el?.getAttribute('aria-label'), item: el?.querySelector('.co-what b')?.textContent, edition: el?.querySelector('.co-what small')?.textContent, points: el?.querySelector('.co-points__said b')?.textContent.replace(/\s+/g, ' ').trim(), slider: !!el?.querySelector('.co-range'), total: el?.querySelector('.co-total dd')?.textContent, ways: [...(el?.querySelectorAll('.co-pay .ui-btn') ?? [])].map((b) => b.textContent) } })
  say(s?.sheet === 'checkout' && /^p:/.test(s?.stacks?.store?.[0] ?? '') && tray.label === 'Checkout' && tray.item === 'America Must Win' && /^No\. \d+ of 50$/.test(tray.edition ?? '') && /^200 of your 200 points/.test(tray.points ?? '') && tray.slider && tray.total === '$135' && tray.ways.join() === 'Pay with Apple Pay,Pay with card', 'Buy brings checkout up over the page, a tray: the piece and which of the edition, the points they would use (theirs to ease off), the total and the ways to pay', JSON.stringify(tray))
  await page.locator('.ios-tray .co-range').evaluate((el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '0'); el.dispatchEvent(new Event('input', { bubbles: true })) }); await sleep(700)
  const eased = await page.evaluate(() => document.querySelector('.ios-tray .co-total dd')?.textContent)
  await page.locator('.ios-tray .co-range').evaluate((el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '200'); el.dispatchEvent(new Event('input', { bubbles: true })) }); await sleep(700)
  say(eased === '$155' && (await page.evaluate(() => document.querySelector('.ios-tray .co-total dd')?.textContent)) === '$135', 'the points eased off, the total is the whole price and the shipping; put back, it is what it was', eased)
  await page.locator('.ios-tray .co-pay .ui-btn').first().tap()
  await page.waitForSelector('.ios-tray .co[data-at="done"]', { timeout: 8000 }).catch(() => {}); await sleep(600)
  s = await st()
  const receipt = await page.evaluate(() => { const el = document.querySelector('.ios-sheet.ios-tray'); return { head: el?.querySelector('.co-head')?.textContent, rows: [...(el?.querySelectorAll('.co-row') ?? [])].map((r) => `${r.querySelector('dt')?.textContent}: ${r.querySelector('dd')?.textContent}`), next: [...(el?.querySelectorAll('.co > .ui-btn') ?? [])].map((b) => b.textContent) } })
  say(s?.sheet === 'checkout' && receipt.head === 'It’s yours.' && receipt.rows.some((r) => /^Reference: SV-/.test(r)) && receipt.rows.includes('Item: America Must Win') && receipt.rows.includes('Paid: $135 + 200 points') && receipt.rows.some((r) => /^Ship to: Pat Phone/.test(r)) && receipt.next.join() === 'Done,View in My VIP' && tabs() === before, 'paid, the same tray is the receipt: its reference, what was paid in dollars and in points, where it is going, and the two ways on', JSON.stringify(receipt))
  await page.locator('.ios-tray .ui-btn', { hasText: 'View in My VIP' }).tap(); await sleep(1300)
  s = await st()
  const sheet = await page.evaluate(() => { const el = document.querySelector('.ios-sheet.vp-sheet'); return { label: el?.getAttribute('aria-label'), detent: el?.getAttribute('data-detent'), card: !!el?.querySelector('.mc.m-standard'), name: el?.querySelector('.mc-win b')?.textContent, bought: [...(el?.querySelectorAll('.vp-group .vp-row .vp-who b') ?? [])].map((b) => b.textContent), doors: el?.querySelectorAll('nav[aria-label="Our Shops"]').length } })
  say(s?.app === 'store' && s?.sheet === 'vip' && sheet.label === 'My VIP' && sheet.detent === 'large' && sheet.card && sheet.name === 'Pat Phone' && sheet.bought.includes('America Must Win') && sheet.doors === 0, 'My VIP comes up over the store as a sheet: their card with their name on it, and the piece they have just bought in their purchases. They are still in ArtStore', JSON.stringify(sheet))
  await page.locator('.vp-sheet .vp-done').tap(); await sleep(900)
  s = await st()
  const after = await page.evaluate((sel) => ({ owned: document.querySelector(`${sel} .ios-large-sub`)?.textContent, name: document.querySelector(`${sel} .ios-large`)?.textContent }), top('store'))
  say(s?.sheet === null && /^p:/.test(s?.stacks?.store?.[0] ?? '') && after.name === 'America Must Win' && /You own this/.test(after.owned ?? '') && (await bar('store')).some((label) => /^Your balance: 0 points/.test(label ?? '')), 'Done puts it away, and they are on the piece they were on, which says it is theirs; the bar has what is left of their points', JSON.stringify({ after, bar: await bar('store') }))
  await shot('artstore-piece')

  // ---- My VIP: their card and what is theirs, and the ways in to the three stores ----
  await arrive('vip')
  const mine = await page.evaluate((sel) => ({ title: document.querySelector(`${sel} .ios-large`)?.textContent, card: !!document.querySelector(`${sel} .vp .mc`), stats: [...document.querySelectorAll(`${sel} .vp-stats dt`)].map((d) => d.textContent), doors: [...document.querySelectorAll(`${sel} nav[aria-label="Our Shops"] .vp-row`)].map((r) => `${r.querySelector('b')?.textContent}: ${r.querySelector('small')?.textContent}`), heads: [...document.querySelectorAll(`${sel} .vp-sect`)].map((h) => h.firstChild?.textContent), bought: [...document.querySelectorAll(`${sel} ol.vp-group .vp-row .vp-who b`)].map((b) => b.textContent), frames: document.querySelectorAll('.sb-slot[data-front] iframe').length }), top('myvip'))
  say(mine.title === 'My VIP' && mine.card && mine.stats.join() === 'Account,Card,Balance,Member since,Purchases,Investments' && mine.heads[0] === 'Our Shops' && mine.doors.join(' | ') === 'ArtStore: Tech Culture art for your walls | Books: Beautifully designed reading material | Workspace: Your new daily driver' && mine.bought.includes('America Must Win') && mine.frames === 0, 'My VIP, as an app, is the same thing as a screen: their card, their account at a glance, Our Shops (the ways in to the three stores, each in its own line), and what they have bought', JSON.stringify(mine))
  say((await bar('myvip')).join() === 'Home Screen,Your account', 'its bar has the way back to the Home Screen, and ends in their own picture, which is their account', (await bar('myvip')).join())
  await page.locator(`${top('myvip')} nav[aria-label="Our Shops"] .vp-row`, { hasText: 'Books' }).tap(); await sleep(1600)
  say((await st())?.app === 'books', 'a door opens that store, the app')
  await arrive('vip')
  await page.locator(`${top('myvip')} .ios-bar button[aria-label="Your account"]`).tap(); await sleep(900)
  const account = await page.evaluate(() => { const el = document.querySelector('.ios-sheet.ios-tray'); return { label: el?.getAttribute('aria-label'), who: el?.querySelector('.lt-who b')?.textContent, rows: [...(el?.querySelectorAll('.lt-row') ?? [])].map((r) => r.textContent.replace(/\s+/g, ' ').trim()), out: el?.querySelector('.lt-out')?.textContent } })
  say(account.label === 'Your account' && account.who === 'Pat Phone' && /^Points ?0 pts/.test(account.rows[0] ?? '') && account.rows.includes('Name and Picture') && !account.rows.includes('Updates') && account.out === 'Log Out', 'their account is a tray too: who they are, their points, their name and picture to change, and Log Out', JSON.stringify(account))
  await page.locator('.ios-tray .lt-out').tap(); await sleep(1500)
  const out = await page.evaluate((sel) => document.querySelector(`${sel} .vp-door`)?.textContent.replace(/\s+/g, ' ').trim().slice(0, 60), top('myvip'))
  say(/Log in to see My VIP/.test(out ?? '') && (await bar('myvip')).join() === 'Home Screen,Log In', 'logged out there, My VIP asks a visitor to log in, and so does its bar', out)

  // ---- A visitor buys: the payment makes their account, and they are asked for a number ----
  await arrive('artstore')
  await page.locator(`${top('store')} .st-card`).nth(2).tap(); await sleep(1300)
  await page.locator(`${top('store')} .pd-buy__go`).tap(); await sleep(1100)
  const guest = await page.evaluate(() => { const el = document.querySelector('.ios-sheet.ios-tray'); return { fields: [...(el?.querySelectorAll('.co-fields input') ?? [])].map((i) => i.placeholder), points: !!el?.querySelector('.co-points'), total: el?.querySelector('.co-total dd')?.textContent } })
  say(guest.fields.join() === 'Your name,Email for the receipt' && !guest.points && guest.total === '$155', 'nobody logged in can buy what is paid for with money: checkout asks their name and where the receipt goes', JSON.stringify(guest))
  await page.locator('.ios-tray .co-fields input').first().tap(); await page.keyboard.type('Kit Guest'); await page.locator('.ios-tray .co-fields input').nth(1).tap(); await page.keyboard.type('kit.guest@example.com')
  await page.locator('.ios-tray .co-pay .ui-btn').first().tap()
  await page.waitForSelector('.ios-tray .co[data-at="done"]', { timeout: 8000 }).catch(() => {}); await sleep(700)
  const made1 = await page.evaluate(() => { const el = document.querySelector('.ios-sheet.ios-tray'); return { head: el?.querySelector('.co-head')?.textContent, says: [...(el?.querySelectorAll('.co-words') ?? [])].map((w) => w.textContent).join(' | '), next: [...(el?.querySelectorAll('.co > :is(.ui-btn, .ui-link)') ?? [])].map((b) => b.textContent) } })
  say(made1.head === 'It’s yours.' && /You have an account now/.test(made1.says) && made1.next.join() === 'Add Phone Number,Not now' && (await bar('store')).some((label) => /^Your balance:/.test(label ?? '')), 'paid, they are told they have an account, under the email they checked out with, and asked for a phone number; the bar has their balance', JSON.stringify(made1))
  await page.locator('.ios-tray .ui-btn', { hasText: 'Add Phone Number' }).tap(); await sleep(1100)
  const number = await page.evaluate(() => { const el = document.querySelector('.ios-sheet.ios-tray'); return { head: el?.querySelector('.lt-head')?.textContent, asks: document.activeElement?.getAttribute('inputmode') } })
  say(number.head === 'Add your number' && number.asks === 'tel', 'the way on is Log In’s tray, at the number: its field ready, asking for figures', JSON.stringify(number))
  await page.locator('.ios-sheet.ios-tray button[aria-label="Close"]').tap(); await sleep(800)
  // (logged out again, for what follows)
  await arrive('vip')
  await page.locator(`${top('myvip')} .ios-bar button[aria-label="Your account"]`).tap(); await sleep(900)
  await page.locator('.ios-tray .lt-out').tap(); await sleep(1500)

  // ---- The one-pager: an app, the document itself ----
  await page.goto(base + '?still'); await sleep(1500); await page.keyboard.press('Enter'); await sleep(1100)
  const was = tabs()
  await page.locator('.sb-icon[aria-label^="One-pager"]').first().tap(); await sleep(1800)
  s = await st()
  const paper = await page.evaluate((sel) => ({ pages: document.querySelectorAll(`${sel} .pp-page`).length, wide: Math.round(document.querySelector(`${sel} .pp-page`)?.getBoundingClientRect().width ?? 0), heading: document.querySelector(`${sel} .op h1`)?.textContent, says: document.querySelector(`${sel} .ios-bar__sub`)?.textContent }), top('preview'))
  say(s?.app === 'preview' && tabs() === was && paper.pages === 2 && paper.wide > 340 && paper.wide <= 393 && !!paper.heading && paper.says === 'Page 1 of 2', 'the one-pager opens in the phone, in no tab of its own: its two pages, one under the other, as wide as the screen', JSON.stringify(paper))
  say((await bar('preview')).join() === 'Home Screen,Save One-pager.pdf', 'its bar has the way back to the Home Screen, and the way to save the file', (await bar('preview')).join())
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
  say((await page.locator('.ios-tray .lt-head').innerText()) === 'Log in to open Updates' && (await page.locator('.ios-sheet.ios-tray:not(.ios-tray--dark)').count()) === 1, 'Log In there brings the tray up saying so, pale over a pale app')
  // (a number of their own: the one above is on the other account by now, and a number is one account's)
  const lp = await logIn('lp@example.com', 'Jordan Avery', '4155550177')
  const folder = await page.evaluate((sel) => ({ sub: document.querySelector(`${sel} .ios-large-sub`)?.textContent, groups: [...document.querySelectorAll(`${sel} .ios-section__header`)].map((h) => h.textContent), rows: [...document.querySelectorAll(`${sel} .upp-row .ios-cell__title`)].map((t) => t.textContent), acts: [...document.querySelectorAll(`${sel} .upp-act`)].map((t) => t.textContent) }), top('updates'))
  say(lp.join(' > ') === 'Check your inbox > Email confirmed > Enter the code > What’s your name? > Pick a picture' && lp.kept && (await page.locator('.ios-sheet:not([data-closing])').count()) === 0, 'an address on the list is confirmed by its inbox, asked for a number to use from then on (and the six digits texted to it), a name and a picture, in the same tray and the same field', lp.join(' > '))
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
