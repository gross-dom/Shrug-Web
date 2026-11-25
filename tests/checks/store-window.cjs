// The stores, as windows of the desktop: ArtStore (the art), Books (the books) and My VIP (what is a member's:
// their pack, card, points, orders and address). Each shows the store's own pages in a frame, for its own
// room; one login, one balance and one address do for all of them. Workspace, which sells the chair, has its
// own check (workspace.cjs). (The site is built as a demo until the store's server is live: nothing is sent
// or charged, any six digits but 000000 are right, and an address beginning "lp" is on the list.)
//   node store-window.cjs http://127.0.0.1:4273/
const A = require('./lib.cjs')
const BASE = process.argv[2] || A.BASE

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

;(async () => {
  const browser = await A.launch()
  const WIN = (app) => `.wf[data-app="${app}"]`
  const frameOf = (p, app) => p.frameLocator(`${WIN(app)} iframe.storewin__frame`)
  /** What a store's bar says: its name (starred when it is on its front), its line, and the balance if there is one. */
  const bar = (p, app) =>
    p.evaluate((W) => {
      const w = document.querySelector(W)
      const name = w.querySelector('.storebar__name')
      return {
        name: name ? `${name.textContent.trim()}${name.getAttribute('aria-current') ? '*' : ''}` : null,
        says: w.querySelector('.storebar__says')?.textContent.trim() ?? null,
        wallet: w.querySelector('.storebar__wallet')?.textContent.trim() ?? null,
        label: w.querySelector('.storebar__wallet')?.getAttribute('aria-label') ?? null,
      }
    }, WIN(app))
  /** Where the frame is, and whether what it shows is taller or wider than the window gives it. */
  const inFrame = (p, app) =>
    p.evaluate((W) => {
      const f = document.querySelector(`${W} iframe.storewin__frame`)
      const s = f.contentDocument.scrollingElement
      return { path: f.contentWindow.location.pathname, search: f.contentWindow.location.search, over: s.scrollHeight - f.contentWindow.innerHeight, wide: s.scrollWidth - f.contentWindow.innerWidth }
    }, WIN(app))
  const sizeOf = (p, app) => p.evaluate((W) => { const r = document.querySelector(W).getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}` }, WIN(app))
  const front = (p) => p.evaluate(() => document.querySelector('.wf[data-active]')?.dataset.app ?? null)
  const openApp = async (p, app) => {
    await p.locator(`.dock [data-dock-app="${app}"]`).click()
    await p.waitForSelector(`${WIN(app)}[data-open]`, { timeout: 20000 })
    await p.waitForTimeout(500)
  }
  const words = async (f, sel = '.ui-col') => (await f.locator(sel).first().innerText()).replace(/\s*\n\s*/g, ' | ')
  /** Log In, from the desk's menu bar, as someone new: an email, a number, six digits, a name. */
  const logInNew = async (p, email, phone, name) => {
    if (!(await p.locator('.account').count())) await p.locator('.menubar__login').click()
    await p.locator('.account input[type=email]').fill(email)
    await p.keyboard.press('Enter')
    await p.waitForTimeout(900)
    await p.keyboard.type(phone)
    await p.keyboard.press('Enter')
    await p.waitForTimeout(900)
    await p.keyboard.type('246810')
    await p.waitForTimeout(1500)
    await p.keyboard.type(name)
    await p.locator('.account__go').click()
    await p.waitForTimeout(1500)
  }
  /** …and as someone on the list: their inbox, then a number, then the name Shrug has for them. */
  const logInLP = async (p, email, phone) => {
    await p.locator('.menubar__login').click()
    await p.locator('.account input[type=email]').fill(email)
    await p.keyboard.press('Enter')
    await p.waitForTimeout(900)
    await p.keyboard.type('246810')
    await p.waitForTimeout(1500)
    await p.keyboard.type(phone)
    await p.keyboard.press('Enter')
    await p.waitForTimeout(900)
    await p.keyboard.type('246810')
    await p.waitForTimeout(1500)
    await p.locator('.account__go').click()
    await p.waitForTimeout(1500)
  }
  /** What the desk's own sheet says of whoever is logged in, row by row. */
  const sheet = async (p) => {
    if (!(await p.locator('.account').count())) await p.locator('.menubar__login').click()
    await p.waitForTimeout(400)
    const rows = await p.evaluate(() => [...document.querySelectorAll('.account__row')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()).join(' | '))
    await p.keyboard.press('Escape')
    await p.waitForTimeout(300)
    return rows
  }
  /** The pack, in My VIP's frame: its strip is loose, and Return on it tears it. Then the card, and the way on. */
  const tear = async (p) => {
    const f = frameOf(p, 'myvip')
    await f.locator('#ripBtn').waitFor({ timeout: 20000 })
    await p.waitForTimeout(900)
    await f.locator('#ripBtn').focus()
    await p.keyboard.press('Enter')
    await f.locator('#stage[data-view="card"]').waitFor({ timeout: 20000 })
    await p.waitForTimeout(1200)
  }
  const ADDRESS = 'Riley Chen\n1 Example St\nSan Francisco, CA 94110'
  /** Whether every way to pay is in sight in the column they are in: none of them under its foot, to be scrolled to. */
  const paysInSight = (f) =>
    f.locator('.ui-col').first().evaluate((col) => {
      const c = col.getBoundingClientRect()
      const buttons = [...col.querySelectorAll('.ui-btn')]
      return buttons.length > 0 && buttons.every((b) => { const r = b.getBoundingClientRect(); return r.top >= c.top - 1 && r.bottom <= c.bottom + 1 })
    })

  // ================= ArtStore, to a visitor: six pieces, in dollars, and nothing else of the store's
  let t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  let p = t.page
  await p.waitForTimeout(1600)
  await openApp(p, 'store')
  let f = frameOf(p, 'store')
  await f.locator('.ui-prod').first().waitFor({ timeout: 20000 })
  await p.waitForTimeout(400)
  let b = await bar(p, 'store')
  let at = await inFrame(p, 'store')
  check('ArtStore opens 1120 by 720 on its own room of the store: its name in the bar, what it sells, and no balance for a visitor', (await sizeOf(p, 'store')) === '1120x720' && b.name === 'ArtStore*' && b.says === 'Six pieces. Fifty of each.' && b.wallet === null && at.path === '/vip/store/' && at.search === '?k=art', JSON.stringify({ b, at }))
  const art = await f.locator('body').evaluate(() => ({ own: !!document.querySelector('.ui-top'), demo: !!document.querySelector('.demo'), pack: !!document.querySelector('#stage'), names: [...document.querySelectorAll('.ui-prod')].map((el) => el.textContent.replace(/\s+/g, ' ').trim()) }))
  check('it opens straight on the six pieces, with no pack before them: each $150, in an edition of 50', !art.pack && art.names.length === 6 && art.names.every((n) => /Art No\. \d/.test(n) && /\$150$/.test(n) && /of 50 left/.test(n)), JSON.stringify(art.names))
  check('nothing in it is a book or a chair, nothing is priced in points, and the pages have no bar of their own', !art.own && !art.demo && art.names.every((n) => !/points|chair|workspace|chromatic|catalog/i.test(n)), JSON.stringify(art))
  check('its front is not wider than its window', at.wide <= 0, JSON.stringify(at))

  const fits = []
  for (let i = 0; i < art.names.length; i++) {
    await f.locator('.ui-prod').nth(i).click()
    await f.locator('.ui-col .ui-btn').first().waitFor({ timeout: 20000 })
    await p.waitForTimeout(450)
    const here = await inFrame(p, 'store')
    fits.push({ p: here.search, over: here.over, wide: here.wide, says: (await f.locator('.ui-col .ui-btn').first().innerText()).replace(/\s+/g, ' ').trim(), front: (await bar(p, 'store')).name })
    await p.locator(`${WIN('store')} .storebar__name`).click()
    await f.locator('.ui-prod').first().waitFor({ timeout: 20000 })
    await p.waitForTimeout(250)
  }
  check('no piece scrolls at the window\'s size; each has an address of its own in the frame, and the name in the bar leads back to all six', fits.every((v) => v.over <= 0 && v.wide <= 0 && /^\?k=art&p=art-\d$/.test(v.p) && v.front === 'ArtStore'), JSON.stringify(fits))
  check('a visitor can buy any of them: the button says what it comes to with shipping', fits.every((v) => v.says === 'Buy for $155'), JSON.stringify(fits.map((v) => v.says)))

  // ---- logging in while a piece is being looked at: still on it, no pack over it, and the price is theirs
  await f.locator('.ui-prod').first().click()
  await f.locator('.ui-col .ui-btn').first().waitFor({ timeout: 20000 })
  const kept = await inFrame(p, 'store')
  await logInNew(p, 'riley@example.test', '4155550134', 'Riley Chen')
  let after = await inFrame(p, 'store')
  b = await bar(p, 'store')
  let sums = await words(f)
  check('logged in from a piece, they are still on it, with no pack over what they were doing and their balance in the bar', after.path === '/vip/store/' && after.search === kept.search && b.wallet === '100', JSON.stringify({ kept, after, b }))
  check('the balance says what it is and where it leads', /^Your balance: 100 points\. My VIP$/.test(b.label ?? ''), String(b.label))
  check('…and their points come off the price, in dollars: $150, less $10 for 100 points, $5 shipping, $145', /Price \| \$150 \|.*100 points \| of your 100 \| −\$10 \|.*Shipping \| \$5 \| Total \| \$145 \| Buy for \$145$/.test(sums), sums)
  check('their points are in the desk\'s sheet before any pack is opened, with the way to My VIP', /Points ?100/.test(await sheet(p)) && /Open My VIP/.test(await sheet(p)), await sheet(p))

  // ---- they buy it: an address the first time, and it is theirs
  await f.locator('.ui-col .ui-btn').first().click()
  await f.locator('.ui-btn', { hasText: 'Pay with card' }).waitFor({ timeout: 20000 })
  at = await inFrame(p, 'store')
  check('checkout fits the window', at.over <= 0 && at.wide <= 0, JSON.stringify(at))
  await f.locator('.ui-btn', { hasText: 'Pay with card' }).click()
  await f.locator('textarea.ui-area').waitFor({ timeout: 20000 })
  await f.locator('textarea.ui-area').fill(ADDRESS)
  await p.waitForTimeout(900)
  const pay = (await f.locator('.ui-col .ui-btn').last().innerText()).trim()
  check('with the address asked for under the sums, the button that pays is still in sight, not under the window’s foot', await paysInSight(f), '')
  await f.locator('.ui-col .ui-btn').last().click()
  await f.locator('.ui-check').waitFor({ timeout: 20000 })
  await p.waitForTimeout(1200)
  const receipt = await words(f)
  b = await bar(p, 'store')
  check('with nowhere on file to send it, the address is asked for once, and the button says what will be paid', pay === 'Pay $145', pay)
  check('bought: the receipt says it is theirs, which of the fifty, and what was paid; the balance in the bar has come down', /It’s yours\./.test(receipt) && /No\. \d+ of 50/.test(receipt) && /\$145/.test(receipt) && b.wallet === '0', JSON.stringify({ receipt: receipt.slice(0, 300), b }))

  // ---- "View in My VIP" opens the other window, where their pack is waiting; then the card, and home
  await f.locator('a.ui-btn.sec', { hasText: 'My VIP' }).click()
  await p.waitForSelector(`${WIN('myvip')}[data-open] iframe.storewin__frame`, { timeout: 20000 })
  let v = frameOf(p, 'myvip')
  await v.locator('#ripBtn').waitFor({ timeout: 20000 })
  at = await inFrame(p, 'myvip')
  b = await bar(p, 'myvip')
  const pack = await v.locator('body').evaluate(() => ({ view: document.querySelector('#stage').dataset.view, strip: document.querySelector('#ripBtn')?.textContent.trim(), fields: document.querySelectorAll('#email, #code').length }))
  const doorsNow = await p.locator(`${WIN('myvip')} .myvip__door`).count()
  check('My VIP comes to the front with their pack: the strip is loose, no email or code is asked for, and the bar says so', (await front(p)) === 'myvip' && at.path === '/vip/' && pack.view === 'pack' && /Tear here/.test(pack.strip ?? '') && pack.fields === 0 && b.says === 'Your pack' && doorsNow === 0, JSON.stringify({ at, pack, b, doorsNow }))
  check('the pack fits its window', at.over <= 0 && at.wide <= 0, JSON.stringify(at))
  await tear(p)
  const go = (await v.locator('a.go').innerText()).trim()
  check('torn, their card, and the way on is into My VIP (not a store)', go === 'Continue to My VIP', go)
  await v.locator('a.go').click()
  await v.locator('.mc').first().waitFor({ timeout: 20000 })
  await p.waitForTimeout(600)
  at = await inFrame(p, 'myvip')
  b = await bar(p, 'myvip')
  let home = await words(v, 'body')
  const doors = (await p.locator(`${WIN('myvip')} .myvip__door b`).allInnerTexts()).join(' | ')
  check('My VIP: their card, what they have, the order from ArtStore and the address they typed there', at.path === '/vip/store/' && at.search === '?k=yours' && b.says === 'My VIP' && (await v.locator('.mc.m-standard').count()) === 1 && /Art No\. 1/.test(home) && /1 Example St/.test(home) && /Balance \| 0/.test(home), JSON.stringify({ at, b, home: home.slice(0, 500) }))
  check('…and how their points came: given, and when', /Points given \| Member since \d{4} \| \+100/.test(home), home.slice(home.indexOf('Points given') - 40, home.indexOf('Points given') + 80))
  check('three doors along its head lead into the stores', doors === 'ArtStore | Books | Workspace', doors)
  check('My VIP is not wider than its window', at.wide <= 0, JSON.stringify(at))

  // ---- the door to Books: five books, and the address is not asked for again
  await p.locator(`${WIN('myvip')} .myvip__door`, { hasText: 'Books' }).click()
  await p.waitForSelector(`${WIN('books')}[data-open] .bk-open`, { timeout: 20000 })
  await p.waitForTimeout(500)
  const shelf = async () => (await p.locator(`${WIN('books')} .bk-open`).evaluateAll((els) => els.map((el) => `${el.querySelector(':scope > b').textContent}: ${el.querySelector('.bk-pill').textContent.trim()}`))).join(' | ')
  check('a door opens that store\'s window in front: Books, at 1120 by 720, on its shelf', (await front(p)) === 'books' && (await sizeOf(p, 'books')) === '1120x720', JSON.stringify({ front: await front(p), size: await sizeOf(p, 'books') }))
  check('the five books, each with its price on it, the two to come as pre-orders', (await shelf()) === 'Chromatic: $40 | Build the Future: Pre-order $45 | What is Shrug?: $25 | In Plain Sight: Pre-order $55 | WS Catalog: $100', await shelf())
  const side = await p.evaluate((W) => [...document.querySelectorAll(`${W} .bk-side button`)].map((x) => `${x.textContent.trim()}${x.getAttribute('aria-current') ? '*' : ''}`).join(' | '), WIN('books'))
  check('its sidebar is the Book Store and the Library, as the Mac\'s Books has them', side === 'Book Store* | Library', side)
  await p.locator(`${WIN('books')} .bk-open`, { hasText: 'What is Shrug?' }).click()
  let k = frameOf(p, 'books')
  await k.locator('.ui-col .ui-btn').first().waitFor({ timeout: 20000 })
  await p.waitForTimeout(500)
  at = await inFrame(p, 'books')
  const head = await p.evaluate((W) => ({ title: document.querySelector(`${W} .bkbar__title`).textContent, back: document.querySelector(`${W} button.bkbar__back`)?.textContent.trim() ?? null, shelf: document.querySelector(`${W} .bk`).hidden }), WIN('books'))
  check('a book opens on the store\'s own page for it, in the same window, under its name, with a way back', at.path === '/vip/store/' && at.search === '?k=books&p=what-is-shrug' && head.title === 'What is Shrug?' && head.back === 'Book Store' && head.shelf, JSON.stringify({ at, head }))
  check('a book\'s page fits the window', at.over <= 0 && at.wide <= 0, JSON.stringify(at))
  const others = await k.locator('.ui-rail a, .ui-rail button').evaluateAll((els) => els.map((el) => el.textContent.replace(/\s+/g, ' ').trim()).join(' | '))
  check('what is along its foot is the other books, and nothing of another store', /Chromatic/.test(others) && !/Art No|Workspace/.test(others), others)
  await k.locator('.ui-col .ui-btn').first().click()
  await k.locator('.ui-btn', { hasText: 'Pay with card' }).waitFor({ timeout: 20000 })
  const bookOut = await words(k)
  await p.waitForTimeout(700)
  check('both ways to pay are in sight at Books’ checkout', await paysInSight(k), '')
  check('at Books\' checkout the address from ArtStore is already there, and is not asked for', /Ship to \| Riley Chen \| 1 Example St \| San Francisco, CA 94110 \| Change/.test(bookOut) && (await k.locator('textarea.ui-area').count()) === 0, bookOut)
  await k.locator('.ui-btn', { hasText: 'Pay with card' }).click()
  await p.waitForTimeout(600)
  if (await k.locator('.ui-col .ui-btn', { hasText: /^Pay \$/ }).count()) await k.locator('.ui-col .ui-btn', { hasText: /^Pay \$/ }).click()
  await k.locator('.ui-check').waitFor({ timeout: 20000 })
  await p.waitForTimeout(900)
  await p.locator(`${WIN('books')} button.bkbar__back`).click()
  await p.waitForTimeout(700)
  const mine = await p.evaluate((W) => ({ shelf: !document.querySelector(`${W} .bk`).hidden, library: document.querySelector(`${W} .bk-side button:nth-of-type(2)`).textContent.replace(/\s+/g, ' ').trim() }), WIN('books'))
  check('bought, and back at the shelf: the book says it is theirs, and the Library counts it', mine.shelf && /What is Shrug\?: Yours/.test(await shelf()) && mine.library === 'Library1', JSON.stringify({ mine, shelf: await shelf() }))
  await p.locator(`${WIN('books')} .bk-side button`, { hasText: 'Library' }).click()
  await p.waitForTimeout(400)
  check('the Library holds what they have bought, and only that', (await shelf()) === 'What is Shrug?: Yours', await shelf())
  // My VIP was asked again by the desk when the book was bought: the order is there without a reload
  home = await words(v, 'body')
  check('the book is in My VIP\'s orders at once, beside the piece from ArtStore', /What is Shrug\?/.test(home) && /Art No\. 1/.test(home), home.slice(home.indexOf('Purchase history'), home.indexOf('Purchase history') + 260))

  // ---- closed and opened again, and after a reload: the pack is not played twice
  await p.locator('.dock [data-dock-app="myvip"]').click()
  await p.waitForTimeout(500)
  await p.locator(`${WIN('myvip')} button[aria-label^="Close"]`).click()
  await p.waitForTimeout(600)
  await p.locator('.menubar__login').click()
  await p.locator('.account__row', { hasText: 'Open My VIP' }).click()
  await p.waitForTimeout(900)
  at = await inFrame(p, 'myvip')
  check('closed and opened again from the desk\'s sheet: My VIP is in front, where it was left, and the sheet is put away', (await front(p)) === 'myvip' && (await p.locator('.account').count()) === 0 && at.path === '/vip/store/' && at.search === '?k=yours', JSON.stringify({ front: await front(p), at }))
  check('nothing went wrong on the way', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(1800)
  if (!(await p.locator(`${WIN('myvip')}[data-open]`).count())) await openApp(p, 'myvip')
  v = frameOf(p, 'myvip')
  await v.locator('.mc').first().waitFor({ timeout: 20000 })
  at = await inFrame(p, 'myvip')
  check('after a reload they are still logged in, and My VIP opens on what is theirs, not on the pack again', at.path === '/vip/store/' && (await p.locator('.menubar__login').innerText()).trim() !== 'Log In', JSON.stringify(at))
  await t.ctx.close()

  // ================= My VIP, to a visitor, and to someone who logs in there
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  p = t.page
  await p.waitForTimeout(1600)
  await openApp(p, 'myvip')
  v = frameOf(p, 'myvip')
  await v.locator('.ui-door').waitFor({ timeout: 20000 })
  const door = await words(v, '.ui-door')
  check('a visitor to My VIP is shown the doors to the stores, and asked to log in for the rest', (await sizeOf(p, 'myvip')) === '1120x720' && /Log in to see My VIP/.test(door) && (await p.locator(`${WIN('myvip')} .myvip__door`).count()) === 3 && (await bar(p, 'myvip')).wallet === null, door)
  await v.locator('.ui-door .ui-btn').click()
  await p.waitForTimeout(500)
  check('its Log In lets down the desk\'s own sheet, with the keyboard in it', (await p.locator('.account').count()) === 1 && (await p.evaluate(() => document.activeElement?.type)) === 'email', '')
  await logInNew(p, 'sam@example.test', '4155550135', 'Sam Okafor')
  await v.locator('#ripBtn').waitFor({ timeout: 20000 })
  at = await inFrame(p, 'myvip')
  b = await bar(p, 'myvip')
  check('logged in there, the frame shows their pack, and their balance is in the bar before it is opened', at.path === '/vip/' && b.says === 'Your pack' && b.wallet === '100', JSON.stringify({ at, b }))
  // the stores are clean of it: opened now, before the pack is torn, ArtStore is the six pieces
  await openApp(p, 'store')
  f = frameOf(p, 'store')
  await f.locator('.ui-prod').first().waitFor({ timeout: 20000 })
  at = await inFrame(p, 'store')
  check('a store opened before the pack is torn is the store, with their balance: the pack is My VIP\'s alone', at.path === '/vip/store/' && at.search === '?k=art' && (await bar(p, 'store')).wallet === '100' && (await f.locator('#stage').count()) === 0, JSON.stringify(at))
  await p.locator(`.dock [data-dock-app="myvip"]`).click()
  await p.waitForTimeout(500)
  await tear(p)
  await v.locator('a.go').click()
  await v.locator('.mc').first().waitFor({ timeout: 20000 })
  await p.waitForTimeout(500)
  home = await words(v, 'body')
  check('torn and on: My VIP with nothing bought yet', /Balance \| 100/.test(home) && /SAM OKAFOR/i.test(home), home.slice(0, 300))
  await p.locator(`${WIN('myvip')} .myvip__door`, { hasText: 'ArtStore' }).click()
  await p.waitForTimeout(600)
  check('the door to ArtStore brings its window to the front', (await front(p)) === 'store', String(await front(p)))
  // logging out from the desk: every window is a visitor's again
  await p.locator('.menubar__login').click()
  await p.locator('.account__row', { hasText: 'Log Out' }).click()
  await p.waitForTimeout(1500)
  check('logged out from the desk: the stores lose the balance, and My VIP is the door again', (await bar(p, 'store')).wallet === null && (await bar(p, 'myvip')).wallet === null && (await v.locator('.ui-door').count()) === 1, JSON.stringify({ store: await bar(p, 'store'), myvip: await bar(p, 'myvip') }))
  check('nothing went wrong on the way (My VIP)', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ================= Books, to a visitor
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  p = t.page
  await p.waitForTimeout(1600)
  await openApp(p, 'books')
  await p.waitForSelector(`${WIN('books')} .bk-open`, { timeout: 20000 })
  check('a visitor to Books sees the five books and their prices', (await p.locator(`${WIN('books')} .bk-open`).count()) === 5 && /Chromatic: \$40/.test(await p.locator(`${WIN('books')} .bk-open`).evaluateAll((els) => els.map((el) => `${el.querySelector(':scope > b').textContent}: ${el.querySelector('.bk-pill').textContent.trim()}`).join(' | '))), '')
  await p.locator(`${WIN('books')} .bk-side button`, { hasText: 'Library' }).click()
  await p.waitForTimeout(300)
  const lib = (await p.locator(`${WIN('books')} .bk-none`).innerText()).replace(/\s+/g, ' ').trim()
  check('the Library asks a visitor to log in', /^Log in to see your library\. Log In$/.test(lib), lib)
  await p.locator(`${WIN('books')} .bk-side button`, { hasText: 'Book Store' }).click()
  await p.locator(`${WIN('books')} .bk-open`, { hasText: 'Build the Future' }).click()
  k = frameOf(p, 'books')
  await k.locator('.ui-col .ui-btn').first().waitFor({ timeout: 20000 })
  await p.waitForTimeout(400)
  const pre = await words(k)
  check('a book to come is a pre-order, priced in dollars, which a visitor can place', /\| Price \| \$45 \| Total \| \$45 \| Pre-order for \$45$/.test(pre), pre)
  await k.locator('.ui-link', { hasText: /View all|All/ }).first().click().catch(() => {})
  await p.waitForTimeout(600)
  const back = await p.evaluate((W) => !document.querySelector(`${W} .bk`).hidden, WIN('books'))
  check('"View all" on a book\'s page comes back to the shelf', back, '')
  check('nothing went wrong on the way (Books)', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ================= an LP: the balance with its comma, every piece and book at the window's size, and the window's least
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  p = t.page
  await p.waitForTimeout(1600)
  await logInLP(p, 'lp@example.test', '4155550177')
  await openApp(p, 'store')
  f = frameOf(p, 'store')
  await f.locator('.ui-prod').first().waitFor({ timeout: 20000 })
  await p.waitForTimeout(500)
  b = await bar(p, 'store')
  at = await inFrame(p, 'store')
  check('an LP: ArtStore opens on the pieces (no pack first), with their balance in the bar, set out with its comma', at.path === '/vip/store/' && b.wallet === '8,400' && b.name === 'ArtStore*', JSON.stringify({ at, b }))
  const count = await f.locator('.ui-prod').count()
  const lpFits = []
  for (let i = 0; i < count; i++) {
    await f.locator('.ui-prod').nth(i).click()
    await f.locator('.ui-col .ui-btn').first().waitFor({ timeout: 20000 })
    await p.waitForTimeout(450)
    const here = await inFrame(p, 'store')
    lpFits.push({ p: here.search, over: here.over, wide: here.wide, says: (await f.locator('.ui-col .ui-btn').first().innerText()).replace(/\s+/g, ' ').trim() })
    await p.locator(`${WIN('store')} .storebar__name`).click()
    await f.locator('.ui-prod').first().waitFor({ timeout: 20000 })
    await p.waitForTimeout(250)
  }
  check('an LP: no piece scrolls at the window\'s size, and enough points make it free of everything but shipping', count === 6 && lpFits.every((x) => x.over <= 0 && x.wide <= 0) && lpFits.every((x) => /^Buy (for \$\d|with [\d,]+ points)/.test(x.says)), JSON.stringify(lpFits))
  // an LP at checkout, with points to choose: the ways to pay are in sight
  await f.locator('.ui-prod').nth(3).click()
  await f.locator('.ui-col .ui-btn').first().waitFor({ timeout: 20000 })
  await f.locator('.ui-range').focus()
  for (let i = 0; i < 40; i++) await p.keyboard.press('ArrowLeft')
  await p.waitForTimeout(500)
  const eased = await words(f)
  check('an LP can ease the points off and pay more by card: the sums follow', /Total \| \$\d{2,3} \| Buy for \$\d{2,3}/.test(eased) && !/Total \| \$5 \|/.test(eased), eased)
  await f.locator('.ui-col .ui-btn').first().click()
  await f.locator('.ui-btn', { hasText: 'Pay with card' }).waitFor({ timeout: 20000 })
  await p.waitForTimeout(900)
  check('at an LP’s checkout, with points to choose, both ways to pay are in sight', await paysInSight(f), '')
  await p.locator(`${WIN('store')} .storebar__name`).click()
  await f.locator('.ui-prod').first().waitFor({ timeout: 20000 })
  const grip = await p.evaluate((W) => { const g = document.querySelector(`${W} .wf__grip[data-edge="se"]`)?.getBoundingClientRect(); return g ? { x: g.left + g.width / 2, y: g.top + g.height / 2 } : null }, WIN('store'))
  if (grip) {
    await p.mouse.move(grip.x, grip.y)
    await p.mouse.down()
    await p.mouse.move(grip.x - 500, grip.y - 400, { steps: 8 })
    await p.mouse.up()
    await p.waitForTimeout(500)
    at = await inFrame(p, 'store')
    check('made as small as it goes, ArtStore is 960 by 640, and the store is not wider than it', (await sizeOf(p, 'store')) === '960x640' && at.wide <= 0, JSON.stringify({ size: await sizeOf(p, 'store'), at }))
  } else check('made as small as it goes, ArtStore is 960 by 640', false, 'no corner to drag was found')
  check('nothing went wrong on the way (an LP)', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ================= a visitor buys in ArtStore: an email at the checkout, and the payment makes their account
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  p = t.page
  await p.waitForTimeout(1600)
  await openApp(p, 'store')
  f = frameOf(p, 'store')
  await f.locator('.ui-prod').first().waitFor({ timeout: 20000 })
  await f.locator('.ui-prod').nth(1).click()
  await f.locator('.ui-col .ui-btn').first().waitFor({ timeout: 20000 })
  await f.locator('.ui-col .ui-btn').first().click()
  await f.locator('input.ui-in[type=email]').waitFor({ timeout: 20000 })
  await p.waitForTimeout(400)
  at = await inFrame(p, 'store')
  await p.waitForTimeout(700)
  check('a visitor\'s checkout asks for their email, fits the window, and has both ways to pay in sight', at.over <= 0 && at.wide <= 0 && (await paysInSight(f)), JSON.stringify(at))
  await f.locator('input.ui-in[type=email]').fill('casey@example.test')
  await f.locator('.ui-btn', { hasText: 'Apple Pay' }).click()
  await p.waitForTimeout(2600)
  const paid = (await f.locator('.ui-col').innerText()).replace(/\s*\n\s*/g, ' | ')
  const deskBar = (await p.locator('.menubar__login').innerText()).trim()
  b = await bar(p, 'store')
  check('paid, they have an account: the store says so and asks for a number, with the receipt on its way either way', /You have an account now/.test(paid) && /casey@example\.test/.test(paid) && /Not now/.test(paid), paid.slice(0, 400))
  check('…and the desk knows them at once: the menu bar is theirs, and the window\'s bar has their balance', deskBar !== 'Log In' && b.wallet !== null, JSON.stringify({ deskBar, b }))
  await f.locator('input.ui-in[type=tel]').fill('+1 415 555 0166')
  await f.locator('.ui-btn', { hasText: 'Text Me a Code' }).click()
  await p.waitForTimeout(900)
  await f.locator('input.ui-in').fill('246810')
  await f.locator('.ui-btn', { hasText: 'Confirm' }).click()
  await p.waitForTimeout(1500)
  const acct = await sheet(p)
  check('with a number given in the store, the desk\'s sheet no longer asks for one', /Points ?[\d,]+ pts[^|]*\| Open My VIP/.test(acct) && !/Add a Phone Number/i.test(acct), acct)
  check('nothing went wrong on the way (a visitor buys)', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error('FAILED', e.message.split('\n').slice(0, 10).join('\n'))
  process.exit(1)
})
