// Log In, at the right of the menu bar, and the LP Updates folder it unlocks. (The site is built as a demo
// until the points site's server is live: a stand-in in the browser answers, any six digits but 000000 are
// right, and the one sample member is an LP in Shrug 1. See src/os/account.ts.)
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
  const bar = (p) => p.locator('.menubar__login').innerText()

  // ---- a visitor: Log In is in the bar, and there is no folder
  let t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  let p = t.page
  await p.waitForTimeout(1600)
  check('a visitor: the bar says Log In, after the menus and before the clock', (await bar(p)) === 'Log In' && (await p.evaluate(() => { const s = document.querySelector('.menubar__status'); return s.firstElementChild.classList.contains('menubar__account') && s.lastElementChild.classList.contains('menubar__clock') })))
  check('a visitor: the desk has no LP Updates folder', (await desk(p)) === 'portfolio wallpapers one-pager', await desk(p))

  // ---- the sheet: an address, then six digits
  await p.locator('.menubar__login').click()
  await p.waitForTimeout(300)
  const sheet = await p.evaluate(() => { const a = document.querySelector('.account'); const r = a.getBoundingClientRect(); return { role: a.getAttribute('role'), name: a.getAttribute('aria-label'), focus: document.activeElement?.type, inside: r.right <= innerWidth && r.left >= 0, wide: a.scrollWidth <= a.clientWidth, expanded: document.querySelector('.menubar__login').getAttribute('aria-expanded') } })
  check('Log In lets down a sheet: a dialog with a name, the keyboard in its field, all of it on the screen', sheet.role === 'dialog' && sheet.name === 'Log in' && sheet.focus === 'email' && sheet.inside && sheet.wide && sheet.expanded === 'true', JSON.stringify(sheet))
  await p.keyboard.press('Escape')
  await p.waitForTimeout(200)
  check('Escape puts it away and the keyboard goes back to Log In', (await p.locator('.account').count()) === 0 && (await p.evaluate(() => document.activeElement?.classList.contains('menubar__login'))))
  await p.locator('.menubar__login').click()
  await p.locator('.account input[type=email]').fill('not an address')
  check('something that is not an address cannot be sent', await p.evaluate(() => !document.querySelector('.account form').checkValidity()))
  await p.locator('.account input[type=email]').fill('lp@example.test')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(900)
  const code = await p.evaluate(() => ({ focus: document.activeElement?.classList.contains('account__code'), mode: document.querySelector('.account__code')?.getAttribute('autocomplete'), lead: document.querySelector('.account__lead')?.textContent, go: document.querySelector('.account__go').disabled }))
  check('then six digits: the field has the keyboard, takes a code from the phone, and Log In waits for all six', code.focus && code.mode === 'one-time-code' && /lp@example\.test/.test(code.lead) && code.go, JSON.stringify(code))
  await p.keyboard.type('00a0 000')
  check('only digits are taken', (await p.locator('.account__code').inputValue()) === '000000')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(900)
  check('a wrong code says so, is cleared, and nothing is unlocked', /Not that one/.test(await p.locator('.account__said').innerText()) && (await p.locator('.account__code').inputValue()) === '' && (await desk(p)) === 'portfolio wallpapers one-pager')

  // ---- logged in: the name in the bar, the folder on the desk, and it opens
  await p.keyboard.type('246810')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(2400)
  check('a right code: the bar has their name and the sheet is away', (await bar(p)) === 'Sample' && (await p.locator('.account').count()) === 0)
  check('the LP Updates folder is on the desk, above the one-pager', (await desk(p)) === 'portfolio wallpapers updates one-pager', await desk(p))
  const win = await p.evaluate((W) => { const w = document.querySelector(W); return { front: document.querySelector('.wf[data-active]')?.dataset.app, title: document.title, rows: [...w.querySelectorAll('.updates__row')].map((r) => r.querySelector('.updates__what').innerText.replace(/\s*\n\s*/g, ' / ')), menu: document.querySelector('.menubar__menu[data-strong] .menubar__title')?.textContent } }, W)
  check('and it opens, in front, named in the bar and in the tab', win.front === 'updates' && /^LP Updates/.test(win.title) && win.menu === 'LP Updates', JSON.stringify(win))
  check('it holds what this member may read, with what is kept to their fund marked so', win.rows.join(' | ') === 'Shrug 4 LP Update / PDF | Shrug 1 LP Update / PDF · Shrug 1 LPs only', win.rows.join(' | '))
  const [file] = await Promise.all([p.waitForEvent('download'), p.locator(`${W} .updates__row`).nth(1).locator('.updates__get').click()])
  check('a document downloads as a PDF by its name', file.suggestedFilename() === 'Shrug 1 LP Update.pdf')
  const dock = await p.evaluate(() => document.querySelectorAll('.dock [data-dock-app="updates"]').length)
  check('the folder is not in the Dock', dock === 0)

  // ---- the account sheet
  await p.locator('.menubar__login').click()
  await p.waitForTimeout(300)
  const acct = await p.evaluate(() => ({ name: document.querySelector('.account').getAttribute('aria-label'), head: document.querySelector('.account__head').textContent, rows: [...document.querySelectorAll('.account__row')].map((r) => r.firstChild.textContent.trim()), store: document.querySelector('a.account__row')?.href }))
  check('logged in, the sheet has their points, the folder, the store and Log Out', acct.name === 'Your account' && acct.rows.join(' | ') === 'Open LP Updates | Spend your points in the store | Log Out' && /\/store\/$/.test(acct.store), JSON.stringify(acct))
  await p.keyboard.press('Escape')

  // ---- a reload keeps them in; logging out takes the folder and its window away
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(2200)
  check('a reload: still logged in, the folder still there', (await bar(p)) === 'Sample' && (await desk(p)).includes('updates'))
  await p.locator('.menubar__login').click()
  await p.locator('.account__row', { hasText: 'Log Out' }).click()
  await p.waitForTimeout(900)
  check('Log Out: the bar says Log In, the folder is gone and so is its window', (await bar(p)) === 'Log In' && (await desk(p)) === 'portfolio wallpapers one-pager' && (await p.evaluate((W) => !document.querySelector(`${W}[data-open]`), W)))
  check('nothing went wrong on the way', t.errors.length === 0, t.errors.join(' | '))
  await t.ctx.close()

  // ---- asked for by its address without logging in: it says how to get in, and shows nothing
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&open=updates' })
  await t.page.waitForTimeout(2000)
  const locked = await t.page.evaluate((W) => ({ text: document.querySelector(`${W} .updates__locked`)?.innerText ?? '', rows: document.querySelectorAll(`${W} .updates__row`).length }), W)
  check('opened by its address by a visitor, the folder is locked and empty', /Locked/.test(locked.text) && /Log In/.test(locked.text) && locked.rows === 0, JSON.stringify(locked))
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
