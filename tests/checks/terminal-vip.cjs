// Fixer T's checks: Case Studies (the terminal) and VIP, on both layouts.
//   node terminal-vip.cjs [base] [only: term|vip|axe]
// (term: terminal-vip.cjs itself; vip: terminal-vip-pictures.cjs; axe: terminal-vip-axe.cjs, axe-core over the same screens on both layouts.)
// The base is the dev server unless given (the built site: http://127.0.0.1:4173/). Two groups of checks need a
// module swapped under the page (a contact address, a picture in a slot): those run on the dev server only.
const A = require('./lib.cjs')
const path = require('path')
const BASE = process.argv[2] || 'http://127.0.0.1:5173/'
const ONLY = process.argv[3]
const DEV = /:5173\//.test(BASE)
const OUT = A.OUT
require('fs').mkdirSync(OUT, { recursive: true })

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail && (!ok || process.env.VERBOSE) ? '  ' + String(detail).slice(0, 400) : ''))
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') })
const arrived = (page) => page.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.os[data-booted]'), null, { timeout: 30000 })

/** Swaps a module of the site's for an edited copy, for this page only (dev server). */
const swap = (page, file, edit) =>
  page.route('**/' + file + '*', async (route) => {
    const res = await route.fetch()
    const body = edit(await res.text())
    await route.fulfill({ response: res, body })
  })

// ---------------------------------------------------------------- the terminal

async function terminal(browser) {
  // ---- desktop, mouse and keyboard
  let t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&open=case-studies' })
  let p = t.page
  await arrived(p)
  await p.waitForSelector('.wf[data-app="terminal"] .term__input', { timeout: 15000 })
  await p.waitForTimeout(900)
  const log = () => p.locator('.wf[data-app="terminal"] .term__log').innerText()
  const lines = () => p.$$eval('.wf[data-app="terminal"] .term__log > *', (els) => els.map((e) => e.textContent))
  const type = async (text) => {
    await p.locator('.wf[data-app="terminal"] .term__input').click()
    if (text) await p.keyboard.type(text)
    await p.keyboard.press('Enter')
    await p.waitForTimeout(120)
  }
  check('desktop: opens on the listing, the refusal and the question', /permission denied/.test(await log()) && /request access\? \(y\/n\)/.test(await log()))
  check('desktop: no keys with a mouse', (await p.locator('.term__keys').evaluate((el) => getComputedStyle(el).display)) === 'none')
  const title = await p.locator('.wf[data-app="terminal"] .ss-term__title').evaluate((el) => getComputedStyle(el).color)
  check('desktop: the title is a grey that reads (AX-15)', title === 'rgb(142, 142, 147)', title)

  await type('y')
  let text = await log()
  check('y: asks for nothing; says how case studies go out (UX-3)', /go out by hand/.test(text) && !/email\?/i.test(text) && !/prototype/.test(text), text.slice(-260))
  const links = await p.$$eval('.wf[data-app="terminal"] .term__link', (as) => as.map((a) => [a.childNodes[0].textContent, a.getAttribute('href'), a.target, a.rel]))
  check('y: the two public case studies are links to their pages', links.some(([t, h]) => t === 'alt/' && /shrug\.notion\.site\/Alt-/.test(h)) && links.some(([t, h]) => t === 'lula/' && /shrug\.notion\.site\/Lula-/.test(h)), JSON.stringify(links))
  check('y: then the way on: the one-pager, in a new tab', links.some(([t, h, target, rel]) => t === 'read the one-pager' && /docsend\.com/.test(h) && target === '_blank' && rel === 'noreferrer'), JSON.stringify(links))
  check('y: the line is still a plain text field', (await p.locator('.wf[data-app="terminal"] .term__input').getAttribute('type')) === 'text')
  await shot(p, 'term-desktop-y')

  // every way back comes back to the question (DK-2)
  for (const word of ['n', 'no', 'cancel', 'back', 'exit', 'q']) {
    await type(word)
    const last = (await lines()).slice(-2)
    check(`"${word}": back to the question`, /they’ll be here/.test(last[0]) && /\(y\/n\)/.test(last[1]), JSON.stringify(last))
  }
  // in character (UX-22, DK-12)
  await type('help')
  check('help: says what can be typed', /cat <name>/.test(await log()) && /open <app>/.test(await log()) && /clear/.test(await log()))
  await type('ls')
  check('ls: lists the case studies again', (await lines()).slice(-1)[0].includes('varda/') && (await lines()).slice(-1)[0].includes('superhuman/'))
  await type('cat feastables/README')
  check('cat <a private one>: refused, and the question', /permission denied/.test((await lines()).slice(-2)[0]) && /\(y\/n\)/.test((await lines()).slice(-1)[0]))
  await type('cat alt/README')
  check('cat alt: it is public, here it is', /alt\/ is public/.test((await lines()).slice(-2)[0]) && (await lines()).slice(-1)[0].startsWith('alt/'))
  await type('whoami')
  check('whoami', /a founder, probably/.test((await lines()).slice(-1)[0]))
  await type('sudo make me a sandwich')
  check('sudo', /nice try/.test((await lines()).slice(-1)[0]))
  await type('cd ..')
  check('cd', /nowhere else to go/.test((await lines()).slice(-1)[0]))
  await type('')
  check('an empty line is an empty line: no scolding', (await lines()).slice(-1)[0] === '>' && !/y or n\.$/.test(await log()), JSON.stringify((await lines()).slice(-2)))
  await type('frobnicate now')
  check('anything else: command not found, and where to look', /command not found: frobnicate/.test((await lines()).slice(-2)[0]) && /help/.test((await lines()).slice(-1)[0]))
  await type('someone@example.com')
  text = (await lines()).slice(-3).join(' | ')
  check('an email typed anyway: not "noted", told it went nowhere and where to go', /nothing is sent from here/.test(text) && /one-pager/.test(text) && !/noted/.test(await log()), text)

  // Up and Down walk what was typed
  const field = p.locator('.wf[data-app="terminal"] .term__input')
  await field.click()
  await p.keyboard.type('half')
  await p.keyboard.press('ArrowUp')
  const up1 = await field.inputValue()
  await p.keyboard.press('ArrowUp')
  const up2 = await field.inputValue()
  await p.keyboard.press('ArrowDown')
  await p.keyboard.press('ArrowDown')
  const down = await field.inputValue()
  check('ArrowUp recalls what was typed, ArrowDown comes back to the line', up1 === 'someone@example.com' && up2 === 'frobnicate now' && down === 'half', JSON.stringify([up1, up2, down]))
  // Escape: the line first, then the question
  await p.keyboard.press('Escape')
  check('Escape empties the line', (await field.inputValue()) === '')
  await type('y')
  await field.click()
  await p.keyboard.press('Escape')
  await p.waitForTimeout(100)
  check('Escape on an empty line: back to the question', /request access\? \(y\/n\)/.test((await lines()).slice(-1)[0]))

  // a line has a sensible length (MK-17)
  await p.locator('.wf[data-app="terminal"] .term__input').click()
  await p.keyboard.insertText('a'.repeat(5000) + '@example.com')
  const held = (await p.locator('.wf[data-app="terminal"] .term__input').inputValue()).length
  await p.keyboard.press('Enter')
  await p.waitForTimeout(150)
  const echoed = (await lines()).slice(-3)[0]
  check('a line is no longer than 120 characters, typed or pasted (MK-17)', held === 120 && echoed.length === 122 && /command not found/.test((await lines()).slice(-2)[0]), `${held} held, ${echoed.length} echoed, then: ${(await lines()).slice(-2)[0].slice(0, 40)}`)

  // open <app>
  await type('open portfolio')
  await p.waitForTimeout(700)
  const front = () => p.evaluate(() => [...document.querySelectorAll('.wf[data-app]')].filter((w) => !w.hasAttribute('inert') && getComputedStyle(w).visibility !== 'hidden').sort((a, b) => Number(getComputedStyle(b).zIndex || 0) - Number(getComputedStyle(a).zIndex || 0))[0]?.getAttribute('data-app'))
  check('open portfolio: the Portfolio window comes to the front', (await front()) === 'finder', await front())
  await p.click('[data-dock-app="terminal"]')
  await p.waitForTimeout(500)
  await type('open nothing-like-this')
  check('open <unknown>: says so, with what there is', /nothing called nothing-like-this/.test((await lines()).slice(-1)[0]))
  await type('open case studies')
  check('open case studies: you are in it', /you’re in it/.test((await lines()).slice(-1)[0]))

  // clear, and closing the window never leaves anyone stuck
  await type('clear')
  check('clear: back to how it opened', (await lines()).length === 5 && /request access\? \(y\/n\)/.test((await lines())[4]), String((await lines()).length))
  await type('y')
  await p.locator('.wf[data-app="terminal"] [aria-label^="Close"]').first().click()
  await p.waitForTimeout(600)
  await p.click('[data-dock-app="terminal"]')
  await p.waitForTimeout(700)
  await type('n')
  check('closed and opened again: still answers (DK-2)', /they’ll be here/.test((await lines()).slice(-2)[0]))
  check('desktop: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- desktop, a finger (tb-3, tb-17, tb-8)
  t = await A.open(browser, { device: 'ipad-land', base: BASE, query: 'still&open=case-studies' })
  p = t.page
  await arrived(p)
  await p.waitForSelector('.wf[data-app="terminal"] .term__input', { timeout: 15000 })
  await p.waitForTimeout(900)
  check('touch: the page reports a touch screen', await p.evaluate(() => matchMedia('(any-pointer: coarse)').matches))
  await p.touchscreen.tap(40, 300) // the wallpaper: the caret is nowhere
  await p.waitForTimeout(200)
  const box = await p.locator('.wf[data-app="terminal"] .term__screen').boundingBox()
  await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.82) // the empty part, well under the line
  await p.waitForTimeout(350)
  check('touch: a tap anywhere in the terminal puts the caret in the line (tb-3)', await p.evaluate(() => document.activeElement?.classList.contains('term__input')), await p.evaluate(() => document.activeElement?.className))
  const keys = await p.$$eval('.wf[data-app="terminal"] .term__key', (els) => els.map((e) => ({ text: e.textContent, h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) })))
  check('touch: y and n to tap, 44px tall (tb-17, tb-8)', keys.length === 2 && keys[0].text === 'y' && keys[1].text === 'n' && keys.every((k) => k.h >= 44 && k.w >= 44), JSON.stringify(keys))
  await p.locator('.wf[data-app="terminal"] .term__key', { hasText: 'y' }).tap()
  await p.waitForTimeout(300)
  check('touch: the y key answers', /go out by hand/.test(await p.locator('.wf[data-app="terminal"] .term__log').innerText()))
  check('touch: tapping a key leaves the caret in the line', await p.evaluate(() => document.activeElement?.classList.contains('term__input')))
  const after = await p.$$eval('.wf[data-app="terminal"] .term__key', (els) => els.map((e) => e.textContent))
  check('touch: then help and clear to tap', after.join() === 'help,clear', after.join())
  const linkH = await p.$$eval('.wf[data-app="terminal"] .term__link', (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
  check('touch: a link is tall enough to press', linkH.length === 3 && linkH.every((h) => h >= 36), linkH.join())
  await shot(p, 'term-touch-y')
  await p.locator('.wf[data-app="terminal"] .term__key', { hasText: 'clear' }).tap()
  await p.waitForTimeout(300)
  check('touch: clear starts over', (await p.$$eval('.wf[data-app="terminal"] .term__log > *', (els) => els.length)) === 5)
  check('touch: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- the iPhone
  t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still&open=case-studies' })
  p = t.page
  await arrived(p)
  const app = p.locator('.sb-slot[data-front]')
  await app.locator('.term-ios-screen').waitFor({ timeout: 15000 })
  await p.waitForTimeout(900)
  const names = () => app.locator('.term-ios-key').evaluateAll((els) => els.map((e) => e.textContent.trim()))
  check('phone: y and n at the foot', (await names()).join() === 'y,n', (await names()).join())
  await app.locator('.term-ios-key', { hasText: /^y$/ }).tap()
  await p.waitForTimeout(700)
  text = await app.locator('.term__log').innerText()
  check('phone: y asks for nothing and gives the public ones and the one-pager', /go out by hand/.test(text) && /alt\//.test(text) && /lula\//.test(text) && /one-pager/.test(text) && !/email/i.test(text), text.slice(-200))
  check('phone: no email keyboard, no keys for one', (await app.locator('.term__input').getAttribute('inputmode')) === null && !(await names()).includes('@'), (await names()).join())
  check('phone: then help, ls and clear at the foot', (await names()).join() === 'help,ls,clear', (await names()).join())
  const tall = await app.locator('.term__link').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
  check('phone: links tall enough for a finger', tall.length === 3 && tall.every((h) => h >= 40), tall.join())
  await shot(p, 'term-phone-y')
  await app.locator('.term-ios-key', { hasText: 'help' }).tap()
  await p.waitForTimeout(400)
  check('phone: the help key', /cat <name>/.test(await app.locator('.term__log').innerText()))
  const fits = await app.locator('.term__log').evaluate((el) => [...el.children].every((c) => c.scrollWidth <= c.clientWidth + 1))
  check('phone: nothing in the log runs off the side', fits)
  await app.locator('.term-ios-key', { hasText: 'clear' }).tap()
  await p.waitForTimeout(500)
  check('phone: clear starts over', (await app.locator('.term__log > *').count()) === 5 && (await names()).join() === 'y,n')
  await app.locator('button[aria-haspopup="menu"]').first().tap()
  await p.waitForTimeout(450)
  await app.locator('[role^="menuitem"]', { hasText: 'Request Access' }).first().tap()
  await p.waitForTimeout(700)
  check('phone: More › Request Access is a yes', /go out by hand/.test(await app.locator('.term__log').innerText()))
  // typed, with Escape: the line first (the phone's own Escape leaves the app only once it is empty)
  await app.locator('.term__input').fill('half a thought')
  await app.locator('.term__input').press('Escape')
  await p.waitForTimeout(300)
  const still = await A.state(p)
  check('phone: Escape empties the line and stays in the app', (await app.locator('.term__input').inputValue()) === '' && still.place?.app === 'terminal', JSON.stringify(still.place))
  await app.locator('.term__input').fill('open vip')
  await app.locator('.term__input').press('Enter')
  await p.waitForTimeout(1200)
  check('phone: open vip launches VIP', (await A.state(p)).place?.app === 'photos', JSON.stringify((await A.state(p)).place))
  await A.at(p, 'terminal', [])
  check('phone: a line is capped at 120 too (MK-17)', (await p.locator('.sb-slot[data-app="terminal"] .term__input').getAttribute('maxlength')) === '120')
  check('phone: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- typed the instant the app is opened from the Home Screen: the first letter lands too (MK-17)
  for (const device of ['iphone', { w: 600, h: 900, dpr: 1 }]) {
    const got = []
    for (let i = 0; i < 3; i++) {
      t = await A.open(browser, { device, base: BASE, query: '' })
      p = t.page
      await arrived(p)
      await A.unlock(p)
      const box = await p.locator('.sb-icon[aria-label^="Case Studies"]').boundingBox()
      const [x, y] = [box.x + box.width / 2, box.y + box.height / 2]
      if (t.device.touch) {
        await t.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
        await t.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      } else await p.mouse.click(x, y)
      await p.keyboard.type('hello world', { delay: 12 })
      await p.waitForTimeout(1100)
      got.push(await p.evaluate(() => document.querySelector('.term-ios-input')?.value ?? '(no field)'))
      await t.ctx.close()
    }
    check(`typed the instant Case Studies opens (${typeof device === 'string' ? 'in the hand' : 'in its frame'}, three goes): nothing dropped`, got.every((v) => v === 'hello world'), JSON.stringify(got))
  }

  // ---- with an address to write to (dev server only: the address is swapped in under the page)
  if (!DEV) return console.log('skip the checks with a contact address: they need the dev server')
  t = await A.open(browser, { device: 'desktop', base: BASE, goto: false })
  p = t.page
  await swap(p, 'src/data/site.ts', (js) => js.replace('email: null', 'email: "hello@example.com"'))
  let went = null
  await p.addInitScript(() => {
    // a mail app cannot open here: note where the page tried to go
    window.addEventListener('beforeunload', () => {})
  })
  p.on('request', (r) => { if (/^mailto:/.test(r.url())) went = r.url() })
  p.on('framenavigated', (f) => { if (/^mailto:/.test(f.url())) went = f.url() })
  await p.goto(BASE + '?still&open=case-studies')
  await arrived(p)
  await p.waitForSelector('.wf[data-app="terminal"] .term__input', { timeout: 15000 })
  await p.waitForTimeout(900)
  await p.locator('.wf[data-app="terminal"] .term__input').click()
  await p.keyboard.type('y')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(500)
  text = await p.locator('.wf[data-app="terminal"] .term__log').innerText()
  const mail = await p.$$eval('.wf[data-app="terminal"] .term__link', (as) => as.map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('target')]))
  check('with an address: y hands over to the mail app and says so', /over to your mail app/.test(text) && mail.some(([t, h, target]) => t === 'email shrug' && /^mailto:hello@example\.com\?subject=Case%20study%20access$/.test(h) && !target), JSON.stringify(mail))
  check('with an address: the public ones are still offered, and no email is asked for', /meanwhile, two are public/.test(text) && !/email\?/.test(text))
  await shot(p, 'term-desktop-reachable')
  await t.ctx.close()
}

// ---------------------------------------------------------------- VIP (filled in below)

async function vip(browser) {
  const { vipChecks } = require('./terminal-vip-pictures.cjs')
  await vipChecks({ A, browser, BASE, DEV, check, shot, arrived, swap })
}

;(async () => {
  const browser = await A.launch()
  try {
    if (!ONLY || ONLY === 'term') await terminal(browser)
    if (!ONLY || ONLY === 'vip') await vip(browser)
    if (!ONLY || ONLY === 'axe') {
      const res = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'terminal-vip-axe.cjs'), BASE], { encoding: 'utf8', env: process.env, timeout: 400000 })
      const lines = (res.stdout || '').trim().split('\n')
      for (const line of lines.filter((l) => /^FAIL/.test(l))) console.log(line.slice(0, 500))
      check('axe: no violations on the terminal and VIP screens, either layout', res.status === 0, lines.slice(-1)[0] + (res.stderr || '').slice(0, 300))
    }
  } catch (e) {
    failed++
    console.log('FAIL the run stopped: ' + (e.stack || e).toString().split('\n').slice(0, 4).join(' / '))
  }
  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'ALL PASS')
  process.exit(failed ? 1 : 0)
})()
