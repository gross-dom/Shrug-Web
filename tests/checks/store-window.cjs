// VIP Store, as a window of the desktop (design/v1, "VIP Store"): the store's own pages in a frame under the
// window's bar, which has the store's name, Store and My VIP as a switch, and the balance. One login does for
// the desk and the store. (The site is built as a demo until the store's server is live: nothing is sent or
// charged, any six digits but 000000 are right, and an address beginning "lp" is on the list.)
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
  const W = '.wf[data-app="store"]'
  const frameOf = (p) => p.frameLocator(`${W} iframe.storewin__frame`)
  /** What the window's bar says: which of its two is picked, and the balance if there is one. */
  const bar = (p) =>
    p.evaluate((W) => {
      const w = document.querySelector(W)
      return {
        seg: [...w.querySelectorAll('.storebar__seg button')].map((b) => `${b.textContent.trim()}${b.getAttribute('aria-current') ? '*' : ''}`).join(' '),
        wallet: w.querySelector('.storebar__wallet')?.textContent.trim() ?? null,
        says: w.querySelector('.storebar__wallet')?.getAttribute('aria-label') ?? null,
      }
    }, W)
  /** Where the frame is, and whether what it shows is taller than the window gives it. */
  const inFrame = (p) =>
    p.evaluate((W) => {
      const f = document.querySelector(`${W} iframe.storewin__frame`)
      const d = f.contentDocument
      const s = d.scrollingElement
      return { path: f.contentWindow.location.pathname, search: f.contentWindow.location.search, over: s.scrollHeight - f.contentWindow.innerHeight, wide: s.scrollWidth - f.contentWindow.innerWidth }
    }, W)
  const openStore = async (p) => {
    await p.locator('.dock [data-dock-app="store"]').click()
    await p.waitForSelector(`${W}[data-open] iframe.storewin__frame`, { timeout: 20000 })
  }
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
    await p.waitForTimeout(1100)
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
    await p.waitForTimeout(1100)
  }
  /** The pack, in the frame: its strip is loose, and Return on it tears it. Then the card, and the way on. */
  const tear = async (p) => {
    const f = frameOf(p)
    await f.locator('#ripBtn').waitFor({ timeout: 20000 })
    await p.waitForTimeout(900)
    await f.locator('#ripBtn').focus()
    await p.keyboard.press('Enter')
    await f.locator('#stage[data-view="card"]').waitFor({ timeout: 20000 })
  }

  // ---- a visitor: the store, with prices in dollars and nothing of anyone's
  let t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  let p = t.page
  await p.waitForTimeout(1600)
  await openStore(p)
  let f = frameOf(p)
  await f.locator('.ui-prod').first().waitFor({ timeout: 20000 })
  await p.waitForTimeout(400)
  const size = await p.evaluate((W) => { const r = document.querySelector(W).getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}` }, W)
  let b = await bar(p)
  let at = await inFrame(p)
  check('a visitor: the window opens 1120 by 720 on the store, Store picked in its bar and no balance there', size === '1120x720' && b.seg === 'Store* My VIP' && b.wallet === null && at.path === '/vip/store/' && at.search === '', JSON.stringify({ size, b, at }))
  const front = await f.locator('body').evaluate(() => ({ own: !!document.querySelector('.ui-top'), demo: !!document.querySelector('.demo'), names: [...document.querySelectorAll('.ui-prod')].map((el) => el.textContent.replace(/\s+/g, ' ').trim()) }))
  check('the pages in it have no bar of their own, and every price is in dollars', !front.own && !front.demo && front.names.length >= 4 && front.names.every((n) => /\$\d/.test(n) && !/points/i.test(n)), JSON.stringify(front))
  check('the store\'s front is not wider than its window', at.wide <= 0, JSON.stringify(at))

  // each product, at the window's own size: none scrolls
  const products = front.names.length
  const visitorFits = []
  const asks = []
  for (let i = 0; i < products; i++) {
    await f.locator('.ui-prod').nth(i).click()
    await f.locator('.ui-col .ui-btn').first().waitFor({ timeout: 20000 })
    await p.waitForTimeout(500)
    const here = await inFrame(p)
    const says = (await f.locator('.ui-col .ui-btn').first().innerText()).replace(/\s+/g, ' ').trim()
    visitorFits.push({ p: here.search, over: here.over, wide: here.wide, says })
    asks.push(says)
    await p.locator(`${W} .storebar__seg button`, { hasText: 'Store' }).click()
    await f.locator('.ui-prod').first().waitFor({ timeout: 20000 })
    await p.waitForTimeout(250)
  }
  check('a visitor: no product scrolls at the window\'s size, and each has an address of its own in the frame', visitorFits.every((v) => v.over <= 0 && v.wide <= 0 && /^\?p=/.test(v.p)), JSON.stringify(visitorFits))
  check('what can be bought is priced on its button; what is only for someone logged in says to log in', asks.every((a) => /^(Buy|Pre-order) for \$\d/.test(a) || /^Log in to /.test(a)) && asks.some((a) => /^Buy for \$/.test(a)), JSON.stringify(asks))
  const gated = asks.findIndex((a) => /^Log in to /.test(a))
  if (gated >= 0) {
    await f.locator('.ui-prod').nth(gated).click()
    await f.locator('.ui-col .ui-btn').first().click()
    await p.waitForTimeout(500)
    const sheet = await p.evaluate(() => ({ n: document.querySelectorAll('.account').length, head: document.querySelector('.account__head')?.textContent ?? '', focus: document.activeElement?.type }))
    check('"Log in to …" on a product lets down the desk\'s own Log In, which says what for, with the keyboard in it', sheet.n === 1 && /^Log in to /.test(sheet.head) && sheet.focus === 'email', JSON.stringify(sheet))
    const kept = await inFrame(p)
    // ---- logging in from there: the product is still where they were, and it is theirs to ask for now
    await logInNew(p, 'riley@example.test', '4155550134', 'Riley Chen')
    await p.waitForTimeout(900)
    const after = await inFrame(p)
    b = await bar(p)
    const now = (await f.locator('.ui-col .ui-btn').first().innerText()).replace(/\s+/g, ' ').trim()
    check('logged in from a product, they are still on it: no pack over what they were doing, their balance in the bar, and the button theirs', after.path === '/vip/store/' && after.search === kept.search && b.wallet === '100' && !/^Log in/.test(now), JSON.stringify({ kept, after, b, now }))
    check('the balance says what it is and where it leads', /^Your balance: 100 points\. My VIP$/.test(b.says ?? ''), String(b.says))
    // The pack was not played, so it is still to come: at the store's front it is what they are shown
    await p.locator('.menubar__login').click()
    await p.locator('.account__row', { hasText: 'Log Out' }).click()
    await p.waitForTimeout(1200)
    b = await bar(p)
    check('logged out from the desk: the bar loses the balance and the store is a visitor\'s again', b.wallet === null && /^((Buy|Pre-order) for \$|Log in to )/.test((await f.locator('.ui-col .ui-btn').first().innerText()).trim()), JSON.stringify(b))
  } else check('"Log in to …" on a product lets down the desk\'s own Log In', false, 'no product asks a visitor to log in')
  await t.ctx.close()

  // ---- someone new logs in with the store's front showing: their pack, with no code to type; then their card
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  p = t.page
  await p.waitForTimeout(1600)
  await openStore(p)
  f = frameOf(p)
  await f.locator('.ui-prod').first().waitFor({ timeout: 20000 })
  await logInNew(p, 'sam@example.test', '4155550135', 'Sam Okafor')
  await f.locator('#stage').waitFor({ timeout: 20000 })
  await f.locator('#ripBtn').waitFor({ timeout: 20000 })
  at = await inFrame(p)
  b = await bar(p)
  const pack = await f.locator('body').evaluate(() => ({ view: document.querySelector('#stage').dataset.view, strip: document.querySelector('#ripBtn')?.textContent.trim(), fields: document.querySelectorAll('#email, #code').length, demo: !!document.querySelector('.demobar:not([hidden])') }))
  check('logged in at the store\'s front, the frame shows their pack: the strip is loose, and no email or code is asked for again', at.path === '/vip/' && pack.view === 'pack' && /Tear here/.test(pack.strip ?? '') && pack.fields === 0, JSON.stringify({ at, pack }))
  check('while the pack is up, neither of the bar\'s two is picked, and the balance is already there', b.seg === 'Store My VIP' && b.wallet === '100', JSON.stringify(b))
  check('the pack fits its window', at.over <= 0 && at.wide <= 0, JSON.stringify(at))
  await tear(p)
  await p.waitForTimeout(1200)
  const card = await f.locator('body').evaluate(() => ({ view: document.querySelector('#stage').dataset.view, go: document.querySelector('a.go')?.textContent.trim(), text: document.querySelector('#stage').innerText.replace(/\s+/g, ' ') }))
  check('torn, their card: the black one with a place for a name, and the way on to the store', card.view === 'card' && card.go === 'Go to the store', JSON.stringify({ view: card.view, go: card.go }))
  await f.locator('a.go').click()
  await f.locator('.ui-prod').first().waitFor({ timeout: 20000 })
  await p.waitForTimeout(500)
  at = await inFrame(p)
  b = await bar(p)
  const theirs = await f.locator('body').evaluate(() => [...document.querySelectorAll('.ui-prod')].map((el) => el.textContent.replace(/\s+/g, ' ').trim()))
  check('"Go to the store" leads on, in the same frame: Store is picked, and prices are in points now', at.path === '/vip/store/' && b.seg === 'Store* My VIP' && theirs.every((n) => /\d points$/.test(n) && !/\$/.test(n)), JSON.stringify({ at, b, theirs }))

  // My VIP, by the bar and by the balance; and the window keeps its place when it is closed
  await p.locator(`${W} .storebar__wallet`).click()
  await p.waitForTimeout(700)
  at = await inFrame(p)
  b = await bar(p)
  const yours = await f.locator('body').evaluate(() => ({ card: !!document.querySelector('.mc.m-standard'), text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 400) }))
  check('the balance leads to My VIP: their card is there, and the bar says where they are', /s=yours/.test(at.search) && b.seg === 'Store My VIP*' && yours.card, JSON.stringify({ at, b, card: yours.card }))
  check('My VIP is not wider than its window', at.wide <= 0, JSON.stringify(at))
  await p.locator(`${W} button[aria-label^="Close"]`).click()
  await p.waitForTimeout(600)
  await p.locator('.menubar__login').click()
  await p.locator('.account__row', { hasText: 'Open VIP Store' }).click()
  await p.waitForTimeout(900)
  at = await inFrame(p)
  const again = await p.evaluate((W) => ({ open: document.querySelector(W).hasAttribute('data-open'), front: document.querySelector('.wf[data-active]')?.dataset.app, sheet: document.querySelectorAll('.account').length }), W)
  check('closed and opened again from the account\'s sheet: the window is where it was left, and the pack is not played twice', again.open && again.front === 'store' && again.sheet === 0 && at.path === '/vip/store/' && /s=yours/.test(at.search), JSON.stringify({ again, at }))
  check('nothing went wrong on the way', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- an LP: every product at the window's size, with what an LP is offered, and none scrolls
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  p = t.page
  await p.waitForTimeout(1600)
  await logInLP(p, 'lp@example.test', '4155550177')
  await openStore(p)
  f = frameOf(p)
  await tear(p)
  await f.locator('a.go').click()
  await f.locator('.ui-prod').first().waitFor({ timeout: 20000 })
  await p.waitForTimeout(500)
  b = await bar(p)
  check('an LP: their balance is in the bar, set out with its comma', b.wallet === '8,400' && b.seg === 'Store* My VIP', JSON.stringify(b))
  const count = await f.locator('.ui-prod').count()
  const lpFits = []
  for (let i = 0; i < count; i++) {
    await f.locator('.ui-prod').nth(i).click()
    await f.locator('.ui-col .ui-btn').first().waitFor({ timeout: 20000 })
    await p.waitForTimeout(500)
    const here = await inFrame(p)
    lpFits.push({ p: here.search, over: here.over, wide: here.wide })
    await p.locator(`${W} .storebar__seg button`, { hasText: 'Store' }).click()
    await f.locator('.ui-prod').first().waitFor({ timeout: 20000 })
    await p.waitForTimeout(250)
  }
  check('an LP: no product scrolls at the window\'s size', count >= 4 && lpFits.every((v) => v.over <= 0 && v.wide <= 0), JSON.stringify(lpFits))
  // The window holds its minimum: made as small as it goes, it is 960 by 640 and the store is still not wider than it
  const grip = await p.evaluate((W) => { const g = document.querySelector(`${W} .wf__grip[data-edge="se"]`)?.getBoundingClientRect(); return g ? { x: g.left + g.width / 2, y: g.top + g.height / 2 } : null }, W)
  if (grip) {
    await p.mouse.move(grip.x, grip.y)
    await p.mouse.down()
    await p.mouse.move(grip.x - 500, grip.y - 400, { steps: 8 })
    await p.mouse.up()
    await p.waitForTimeout(500)
    const small = await p.evaluate((W) => { const q = document.querySelector(W).getBoundingClientRect(); return `${Math.round(q.width)}x${Math.round(q.height)}` }, W)
    at = await inFrame(p)
    check('made as small as it goes, the window is 960 by 640, and the store is not wider than it', small === '960x640' && at.wide <= 0, JSON.stringify({ small, at }))
  } else check('made as small as it goes, the window is 960 by 640', false, 'no corner to drag was found')
  check('nothing went wrong on the way (an LP)', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- a visitor buys: an email at the checkout, and the payment makes their account
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  p = t.page
  await p.waitForTimeout(1600)
  await openStore(p)
  f = frameOf(p)
  await f.locator('.ui-prod').first().waitFor({ timeout: 20000 })
  const names = await f.locator('.ui-prod').evaluateAll((els) => els.map((el) => el.textContent))
  const buyable = []
  for (let i = 0; i < names.length && !buyable.length; i++) {
    await f.locator('.ui-prod').nth(i).click()
    await f.locator('.ui-col .ui-btn').first().waitFor({ timeout: 20000 })
    if (/^Buy for \$/.test((await f.locator('.ui-col .ui-btn').first().innerText()).trim())) buyable.push(i)
    else {
      await p.locator(`${W} .storebar__seg button`, { hasText: 'Store' }).click()
      await f.locator('.ui-prod').first().waitFor({ timeout: 20000 })
    }
  }
  await f.locator('.ui-col .ui-btn').first().click()
  await f.locator('input.ui-in[type=email]').waitFor({ timeout: 20000 })
  await p.waitForTimeout(400)
  at = await inFrame(p)
  check('a visitor\'s checkout asks for their email, and fits the window', at.over <= 0 && at.wide <= 0, JSON.stringify(at))
  await f.locator('input.ui-in[type=email]').fill('casey@example.test')
  await f.locator('.ui-btn', { hasText: 'Apple Pay' }).click()
  await p.waitForTimeout(2600)
  const paid = (await f.locator('.ui-col').innerText()).replace(/\s*\n\s*/g, ' | ')
  const deskBar = (await p.locator('.menubar__login').innerText()).trim()
  b = await bar(p)
  check('paid, they have an account: the store says so and asks for a number, with the receipt on its way either way', /You have an account now/.test(paid) && /casey@example\.test/.test(paid) && /Not now/.test(paid), paid.slice(0, 400))
  check('…and the desk knows them at once: the menu bar is theirs, and the window\'s bar has their balance', deskBar !== 'Log In' && b.wallet !== null, JSON.stringify({ deskBar, b }))
  await f.locator('input.ui-in[type=tel]').fill('+1 415 555 0166')
  await f.locator('.ui-btn', { hasText: 'Text Me a Code' }).click()
  await p.waitForTimeout(900)
  await f.locator('input.ui-in').fill('246810')
  await f.locator('.ui-btn', { hasText: 'Confirm' }).click()
  await p.waitForTimeout(1500)
  await p.locator('.menubar__login').click()
  await p.waitForTimeout(400)
  const acct = await p.evaluate(() => [...document.querySelectorAll('.account__row')].map((r) => r.firstChild.textContent.trim()).join(' | '))
  check('with a number given in the store, the desk\'s sheet no longer asks for one', /Points \| Open VIP Store/.test(acct) && !/Add a Phone Number/i.test(acct), acct)
  check('nothing went wrong on the way (a visitor buys)', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error('FAILED', e.message.split('\n').slice(0, 10).join('\n'))
  process.exit(1)
})
