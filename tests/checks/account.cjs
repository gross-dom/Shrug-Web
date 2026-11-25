// Log In, at the right of the menu bar: the one sheet (design/v1, SignIn-*), and the Updates folder, which is
// always on the desk and locked to everyone but Shrug's LPs. (The site is built as a demo until the store's
// server is live: a stand-in in the browser answers by the server's own rules. Nothing is sent, any six
// digits but 000000 are right, and an address beginning "lp" is on the list. See src/os/account.ts.)
//   node account.cjs http://127.0.0.1:4273/
const A = require('./lib.cjs')
const BASE = process.argv[2] || A.BASE

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

;(async () => {
  const browser = await A.launch()
  const W = '.wf[data-app="updates"]'
  const desk = (p) => p.evaluate(() => [...document.querySelectorAll('.desk__item')].map((i) => i.dataset.desk).join(' '))
  /** What Log In says in the bar: its words, without the picture beside them (an emoji or an initial, which is not read out). */
  const bar = (p) => p.evaluate(() => [...document.querySelector('.menubar__login').childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim())
  const head = (p) => p.locator('.account__head').innerText()
  const lead = (p) => p.locator('.account__lead').first().innerText()
  const locked = (p) => p.evaluate(() => ({ lock: !!document.querySelector('[data-desk="updates"] [data-lock]'), says: document.querySelector('[data-desk="updates"]').getAttribute('aria-label') }))
  const boxes = (p) => p.evaluate(() => [...document.querySelectorAll('.account__boxes span')].map((s) => s.textContent).join(''))

  // ---- a visitor: Log In is in the bar, and the folder is on the desk, locked
  let t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  let p = t.page
  await p.waitForTimeout(1600)
  check('a visitor: the bar says Log In, after the menus and before the clock', (await bar(p)) === 'Log In' && (await p.evaluate(() => { const s = document.querySelector('.menubar__status'); return s.firstElementChild.classList.contains('menubar__account') && s.lastElementChild.classList.contains('menubar__clock') })))
  check('the desk has Updates first, then the one-pager, Wallpapers and the rest, in their order', (await desk(p)) === A.DESK.map(([id]) => id).join(' '), await desk(p))
  let folder = await locked(p)
  check('the Updates folder is locked, and says so', folder.lock && folder.says === 'Updates, desktop icon, locked', JSON.stringify(folder))
  await p.locator('[data-desk="updates"]').click()
  await p.waitForTimeout(250)
  const tip = await p.evaluate(() => { const el = document.querySelector('[data-desk="updates"] + .desk__tip'); const r = el.getBoundingClientRect(); const next = document.querySelector('[data-desk="one-pager"]').getBoundingClientRect(); return { text: el.textContent, shown: getComputedStyle(el).opacity, clear: r.bottom <= next.top || r.right <= next.left, on: r.left >= 0 } })
  check('picked, it says who it is for, clear of the icon under it', tip.text === 'For Shrug’s LPs. Log in to open.' && tip.shown === '1' && tip.clear && tip.on, JSON.stringify(tip))

  // ---- opened by a visitor, the folder lets down Log In, which says what for; no window opens
  await p.locator('[data-desk="updates"]').dblclick()
  await p.waitForTimeout(400)
  check('opened by a visitor, it lets down Log In, which says what it was opened for', (await head(p)) === 'Log in to open Updates' && /for Shrug’s LPs/.test(await lead(p)) && (await p.evaluate((W) => !document.querySelector(`${W}[data-open]`), W)))
  await p.keyboard.press('Escape')
  await p.waitForTimeout(200)

  // ---- the sheet: an email first
  await p.locator('.menubar__login').click()
  await p.waitForTimeout(300)
  const sheet = await p.evaluate(() => { const a = document.querySelector('.account'); const r = a.getBoundingClientRect(); return { role: a.getAttribute('role'), name: a.getAttribute('aria-label'), head: a.querySelector('.account__head').textContent, focus: document.activeElement?.type, inside: r.right <= innerWidth && r.left >= 0, wide: a.scrollWidth <= a.clientWidth, width: Math.round(r.width), expanded: document.querySelector('.menubar__login').getAttribute('aria-expanded'), go: a.querySelector('.account__go').disabled } })
  check('Log In lets down a sheet: a dialog with a name, 300 across, the keyboard in its field, all of it on the screen', sheet.role === 'dialog' && sheet.name === 'Log in' && sheet.head === 'Log in to Shrug VIP' && sheet.focus === 'email' && sheet.inside && sheet.wide && sheet.width === 300 && sheet.expanded === 'true' && sheet.go, JSON.stringify(sheet))
  await p.keyboard.press('Escape')
  await p.waitForTimeout(200)
  check('Escape puts it away and the keyboard goes back to Log In', (await p.locator('.account').count()) === 0 && (await p.evaluate(() => document.activeElement?.classList.contains('menubar__login'))))
  await p.locator('.menubar__login').click()
  await p.locator('.account input[type=email]').fill('not an address')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(800)
  check('something that is not an address is not taken', /doesn’t look like an email/.test(await p.locator('.account__said').innerText()) && (await head(p)) === 'Log in to Shrug VIP')

  // ---- someone new: straight to a phone number, and six digits by text
  await p.locator('.account input[type=email]').fill('riley@example.test')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(900)
  const number = await p.evaluate(() => ({ head: document.querySelector('.account__head').textContent, focus: document.activeElement?.type, go: document.querySelector('.account__go').textContent.trim(), off: document.querySelector('.account__go').disabled, back: [...document.querySelectorAll('.account__link')].map((l) => l.textContent.trim()).join('|') }))
  check('an address nobody has goes straight to a phone number', number.head === 'What’s your number?' && number.focus === 'tel' && number.go === 'Text Me a Code' && number.off && number.back === 'Use a different email', JSON.stringify(number))
  await p.keyboard.type('4155550134')
  check('a number is set out as it is typed', (await p.locator('.account input[type=tel]').inputValue()) === '+1 (415) 555 0134')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(900)
  const code = await p.evaluate(() => { const f = document.querySelector('.account__code input'); return { head: document.querySelector('.account__head').textContent, lead: document.querySelector('.account__lead').textContent, focus: document.activeElement === f, mode: f.getAttribute('autocomplete'), boxes: document.querySelectorAll('.account__boxes span').length, wait: document.querySelector('.account__wait')?.textContent ?? '' } })
  check('then six digits: texted to the number, six boxes, the keyboard in them, a code from the phone is taken, and when another can be sent', code.head === 'Enter the code' && code.lead === 'Texted to +1 (415) 555 0134.' && code.focus && code.mode === 'one-time-code' && code.boxes === 6 && /^Send it again in 0:\d\d$/.test(code.wait), JSON.stringify(code))
  await p.keyboard.type('00a0 00')
  check('only digits are taken', (await boxes(p)) === '00000')
  await p.keyboard.type('0')
  await p.waitForTimeout(1100)
  const wrong = await p.evaluate(() => ({ said: document.querySelector('.account__said')?.textContent ?? '', bad: document.querySelector('.account__code').hasAttribute('data-bad'), links: [...document.querySelectorAll('.account__link')].map((l) => l.textContent.trim()).join('|') }))
  check('a wrong code says so and how many tries are left, stays in its boxes, and a new one can be sent', wrong.said === 'That code isn’t right. Four tries left.' && wrong.bad && (await boxes(p)) === '000000' && wrong.links === 'Send a new code' && (await bar(p)) === 'Log In', JSON.stringify(wrong))

  // ---- the right code, and then a name and a picture
  await p.keyboard.type('246810')
  await p.waitForTimeout(1500)
  const mine = await p.evaluate(() => ({ head: document.querySelector('.account__head').textContent, name: document.querySelector('.account input[type=text]').value, done: document.querySelector('.account__go').disabled, faces: document.querySelectorAll('.account__faces [role=radio]').length, picked: document.querySelectorAll('.account__faces [aria-checked=true]').length, upload: document.querySelector('.account__faces [data-upload]')?.getAttribute('aria-label') }))
  check('the right code, typed over the wrong one: then Make it yours, with a face offered and a photo of their own to upload', mine.head === 'Make it yours' && mine.name === '' && mine.done && mine.faces === 12 && mine.picked === 1 && mine.upload === 'Upload a photo', JSON.stringify(mine))
  await p.keyboard.type('Riley Chen')
  await p.locator('.account__faces [role=radio]').nth(2).click()
  await p.locator('.account__go').click()
  await p.waitForTimeout(1100)
  const inBar = { text: await bar(p), ...(await p.evaluate(() => ({ face: !!document.querySelector('.menubar__login .face--emoji[aria-hidden]'), sheet: document.querySelectorAll('.account').length }))) }
  check('Done: the bar has their picture and first name, and the sheet is away', inBar.text === 'Riley' && inBar.face && inBar.sheet === 0, JSON.stringify(inBar))

  // ---- logged in and not an LP: the folder is still locked, and says who it is for
  folder = await locked(p)
  check('logged in and not an LP, the folder is still locked', folder.lock, JSON.stringify(folder))
  await p.locator('[data-desk="updates"]').dblclick()
  await p.waitForTimeout(900)
  const standard = await p.evaluate((W) => { const w = document.querySelector(W); return { open: w.hasAttribute('data-open'), text: w.querySelector('.updates__locked')?.innerText ?? '', rows: w.querySelectorAll('.upd-row').length, chip: w.querySelector('.updbar .v-chip')?.textContent.trim(), title: document.title } }, W)
  check('opened, it tells them who it is for and shows nothing in it: its bar still says Locked', standard.open && /For Shrug’s LPs/.test(standard.text) && /logged in as Riley Chen/.test(standard.text) && /Message Shrug/.test(standard.text) && standard.rows === 0 && standard.chip === 'Locked' && /^Updates/.test(standard.title), JSON.stringify(standard))

  // ---- the account sheet
  await p.locator('.menubar__login').click()
  await p.waitForTimeout(300)
  let acct = await p.evaluate(() => ({ name: document.querySelector('.account').getAttribute('aria-label'), who: [...document.querySelectorAll('.account__who b, .account__who small')].map((el) => el.textContent).join(' / '), rows: [...document.querySelectorAll('.account__row')].map((r) => r.firstChild.textContent.trim()), points: document.querySelector('.account__row small').textContent, links: document.querySelectorAll('.account a').length }))
  check('logged in, the sheet has who they are, their points, My VIP (a row that opens its window: nothing here is a link), their name and picture, and Log Out', acct.name === 'Your account' && acct.who === 'Riley Chen / Member' && acct.rows.join(' | ') === 'Points | Open My VIP | Edit Name and Picture… | Log Out' && /^100 pts · \$10/.test(acct.points) && acct.links === 0, JSON.stringify(acct))
  await p.keyboard.press('Escape')

  // ---- a reload keeps them in; Log Out; and the next time they are texted at the number they gave
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(2200)
  check('a reload: still logged in', (await bar(p)).trim() === 'Riley')
  await p.locator('.menubar__login').click()
  await p.locator('.account__row', { hasText: 'Log Out' }).click()
  await p.waitForTimeout(900)
  check('Log Out: the bar says Log In, and the folder’s window is gone', (await bar(p)) === 'Log In' && (await p.evaluate((W) => !document.querySelector(`${W}[data-open]`), W)))
  await p.locator('.menubar__login').click()
  await p.locator('.account input[type=email]').fill('riley@example.test')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(900)
  check('the next time, they are texted at their number, and told only where it ends', (await head(p)) === 'Enter the code' && (await lead(p)) === 'Texted to your number ending in 34.')
  await p.keyboard.type('135790')
  await p.waitForTimeout(1500)
  check('and the code alone lets them in: nothing more is asked', (await bar(p)).trim() === 'Riley' && (await p.locator('.account').count()) === 0)
  check('nothing went wrong on the way', t.errors.length === 0, t.errors.join(' | '))
  await t.ctx.close()

  // ---- someone on the list: their inbox first, then a number, then their folder
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  p = t.page
  await p.waitForTimeout(1600)
  await p.locator('.menubar__login').click()
  await p.locator('.account input[type=email]').fill('lp@example.test')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(900)
  check('an address on the list is confirmed by its inbox first, most of it hidden', (await head(p)) === 'Check your inbox' && (await lead(p)) === 'We emailed six digits to l•••••@example.test to confirm it’s you.')
  await p.keyboard.type('246810')
  await p.waitForTimeout(1500)
  check('then a phone number, for next time', (await head(p)) === 'Email confirmed' && /how you’ll log in next time/.test(await lead(p)) && (await p.evaluate(() => document.activeElement?.type)) === 'tel')
  await p.keyboard.type('4155550177')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(900)
  await p.keyboard.type('246810')
  await p.waitForTimeout(1500)
  check('then Make it yours, with the name Shrug has for them', (await head(p)) === 'Make it yours' && (await p.locator('.account input[type=text]').inputValue()) === 'Jordan Avery')
  await p.locator('.account__go').click()
  await p.waitForTimeout(1100)
  const lp = await p.evaluate(() => ({ bar: [...document.querySelector('.menubar__login').childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim(), note: document.querySelector('.desk-note')?.innerText.replace(/\s*\n\s*/g, ' / ') ?? '', lock: !!document.querySelector('[data-desk="updates"] [data-lock]'), picked: document.querySelector('[data-desk="updates"]').hasAttribute('data-picked'), win: !!document.querySelector('.wf[data-app="updates"][data-open]') }))
  check('an LP is in: the desk says Updates is unlocked, the folder has lost its lock and is picked, and nothing opens by itself', lp.bar === 'Jordan' && lp.note === 'Updates is unlocked / Three documents written for your funds.' && !lp.lock && lp.picked && !lp.win, JSON.stringify(lp))
  await p.locator('.desk-note').click()
  await p.waitForTimeout(900)
  const win = await p.evaluate((W) => { const w = document.querySelector(W); return { front: document.querySelector('.wf[data-active]')?.dataset.app, title: document.title, rows: [...w.querySelectorAll('.upd-row')].map((r) => `${r.querySelector('b').textContent} / ${r.querySelector('.s').textContent.trim()}`), chip: w.querySelector('.updbar .v-chip')?.textContent.trim(), foot: w.querySelector('.upd-foot')?.innerText.replace(/\s*\n\s*/g, ' / '), menu: document.querySelector('.menubar__menu[data-strong] .menubar__title')?.textContent, note: document.querySelectorAll('.desk-note').length } }, W)
  check('pressed, the note opens the folder, in front, named in the bar and in the tab', win.front === 'updates' && /^Updates/.test(win.title) && win.menu === 'Updates' && win.note === 0, JSON.stringify(win))
  // (what is in the folder, and what a document does when it is opened, is preview.cjs's)
  check('it holds what this LP is shown: what is theirs to open, and what may be asked for or is still to come', win.rows.join(' | ') === 'Shrug 4 update, Q3 2026 / Open | Shrug 2 update, Q3 2026 / Open | Shrug Capital update, 2026 / Open | Shrug 3 update, Q3 2026 / Request | Shrug 2 annual letter / Coming soon | SPV update / Request', win.rows.join(' | '))
  check('its bar says whose it is, and its foot who it was prepared for and where a document opens', win.chip === 'LP · Shrug 2, 4' && win.foot === '6 documents · Prepared for Jordan Avery / Opens in Preview', JSON.stringify({ chip: win.chip, foot: win.foot }))
  check('the folder is not in the Dock', (await p.evaluate(() => document.querySelectorAll('.dock [data-dock-app="updates"]').length)) === 0)
  await p.locator('.menubar__login').click()
  await p.waitForTimeout(300)
  acct = await p.evaluate(() => ({ who: [...document.querySelectorAll('.account__who b, .account__who small')].map((el) => el.textContent).join(' / '), rows: [...document.querySelectorAll('.account__row')].map((r) => r.firstChild.textContent.trim()), points: document.querySelector('.account__row small').textContent }))
  check('an LP’s sheet says which funds, and has the way to Updates', acct.who === 'Jordan Avery / LP · Shrug 2, Shrug 4' && acct.rows.join(' | ') === 'Points | Open My VIP | Open Updates | Edit Name and Picture… | Log Out' && /^8,400 pts · \$840/.test(acct.points), JSON.stringify(acct))
  check('nothing went wrong on the way', t.errors.length === 0, t.errors.join(' | '))
  await t.ctx.close()

  // ---- too many tries
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  p = t.page
  await p.waitForTimeout(1600)
  await p.locator('.menubar__login').click()
  await p.locator('.account input[type=email]').fill('sam@example.test')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(900)
  await p.keyboard.type('4155550155')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(900)
  for (let i = 0; i < 5; i++) {
    await p.keyboard.type('000000')
    await p.waitForTimeout(1000)
  }
  const paused = await p.evaluate(() => ({ head: document.querySelector('.account__head').textContent, lead: document.querySelector('.account__lead').textContent, go: document.querySelector('.account__go').textContent.trim(), off: document.querySelector('.account__go').disabled, help: document.querySelector('.account__link')?.textContent.trim() }))
  check('five wrong codes: too many tries, with how long until another, and a way to ask Shrug', paused.head === 'Too many tries' && /new codes are paused for this number/.test(paused.lead) && /^Try again in 0:\d\d$/.test(paused.go) && paused.off && paused.help === 'Message Shrug for help', JSON.stringify(paused))
  await t.ctx.close()

  // ---- arriving by a personal link: the email is already confirmed, and only a number is asked for
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty&login=link' })
  p = t.page
  await p.waitForTimeout(2000)
  const linked = await p.evaluate(() => ({ head: document.querySelector('.account__head')?.textContent ?? '', lead: document.querySelector('.account__lead')?.textContent ?? '', focus: document.activeElement?.type, address: location.search, bar: [...document.querySelector('.menubar__login').childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() }))
  check('a personal link: the sheet is down, welcomes them by name and asks only for a number; the address no longer says so', linked.head === 'Welcome, Jordan' && /^Your link confirmed lp@example\.com\. Add a phone number to finish\./.test(linked.lead) && linked.focus === 'tel' && !/login/i.test(linked.address) && linked.bar === 'Jordan', JSON.stringify(linked))
  await t.ctx.close()

  // ---- asked for by its address without logging in: it is locked, shows nothing, and has the way in
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&open=updates' })
  await t.page.waitForTimeout(2000)
  const byAddress = await t.page.evaluate((W) => ({ text: document.querySelector(`${W} .updates__locked`)?.innerText ?? '', rows: document.querySelectorAll(`${W} .upd-row`).length, chip: document.querySelector(`${W} .updbar .v-chip`)?.textContent.trim() }), W)
  check('opened by its address by a visitor, the folder is locked and empty, with Log In under it', byAddress.chip === 'Locked' && /For Shrug’s LPs/.test(byAddress.text) && /Log In/.test(byAddress.text) && byAddress.rows === 0, JSON.stringify(byAddress))
  await t.page.locator(`${W} .updates__locked .v-btn`).click()
  await t.page.waitForTimeout(400)
  check('which lets down the sheet, for Updates', (await head(t.page)) === 'Log in to open Updates')
  await t.ctx.close()

  // ---- a phone has neither
  t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still' })
  await t.page.waitForTimeout(1500)
  check('a phone has no Log In and no folder', (await t.page.locator('.menubar__login, [data-desk="updates"]').count()) === 0)
  await t.ctx.close()

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'all passed')
  process.exit(failed ? 1 : 0)
})()
