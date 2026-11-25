// The icons can be dragged (src/os/layout.ts): about the desk, from the desk into the Dock, along the Dock, and
// out of the Dock onto the desk. A file or a folder stays on the desk, and the Dock's first icon stays put, as
// the Finder's does on a Mac. A press that became a drag opens nothing. Where everything is is kept for whoever
// is logged in, in their browser; a visitor's desk is as it comes each time.
//   node layout.cjs http://127.0.0.1:4273/
const A = require('./lib.cjs')
const BASE = process.argv[2] || A.BASE

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

;(async () => {
  const browser = await A.launch()
  let t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  let p = t.page
  await p.waitForTimeout(1800)
  /** Where everything is: the Dock's apps in order, the line of icons down the right, and the icons that have a place of their own. */
  const state = () =>
    p.evaluate(() => ({
      dock: [...document.querySelectorAll('.dock [data-dock-item]')].map((b) => b.dataset.dockApp).join(' '),
      line: [...document.querySelectorAll('.desk .desk__item')].map((b) => b.dataset.desk).join(' '),
      free: [...document.querySelectorAll('.desk-free .desk__item')].map((b) => { const r = b.getBoundingClientRect(); return { id: b.dataset.desk, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } }),
      open: [...document.querySelectorAll('.wf[data-open]')].map((w) => w.dataset.app).sort().join(' '),
    }))
  const center = async (sel) => { const r = await p.locator(sel).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }
  const dragTo = async (sel, x, y) => {
    const c = await center(sel)
    await p.mouse.move(c.x, c.y)
    await p.mouse.down()
    await p.mouse.move(c.x + 10, c.y + 10, { steps: 3 })
    await p.mouse.move(x, y, { steps: 12 })
    await p.mouse.up()
    await p.waitForTimeout(500)
  }
  const near = (icon, x, y) => !!icon && Math.abs(icon.x - x) <= 40 && Math.abs(icon.y - y) <= 60
  const DOCK = A.DOCK_IDS.join(' ')
  const LINE = A.DESK.map(([id]) => id).join(' ')

  // ---- as it comes
  let s = await state()
  check('as it comes: the Dock’s apps in their order, the desk’s icons in a line down the right, and none with a place of its own', s.dock === DOCK && s.line === LINE && s.free.length === 0, JSON.stringify(s))

  // ---- about the desk
  await dragTo('[data-desk="spotify"]', 600, 300)
  s = await state()
  check('an icon dragged about the desk stays where it is put, and leaves the line', near(s.free.find((i) => i.id === 'spotify'), 600, 300) && !/spotify/.test(s.line) && s.dock === DOCK, JSON.stringify(s))
  check('the drag opened nothing', s.open === '', s.open)
  await dragTo('[data-desk="updates"]', 300, 420)
  s = await state()
  check('a folder can be put anywhere on the desk too', near(s.free.find((i) => i.id === 'updates'), 300, 420), JSON.stringify(s.free))
  await p.locator('[data-desk="spotify"]').dblclick()
  await p.waitForTimeout(900)
  check('an icon that has been moved still opens on a double-click', /spotify/.test((await state()).open), (await state()).open)
  await p.locator('.wf[data-app="spotify"] button[aria-label^="Close"]').click()
  await p.waitForTimeout(500)

  // ---- from the desk into the Dock
  const mail = await center('.dock [data-dock-app="mail"]')
  await dragTo('[data-desk="youtube"]', mail.x - 30, mail.y)
  s = await state()
  check('an app’s icon dropped on the Dock goes into it, where it was dropped, and leaves the desk', /terminal youtube mail/.test(s.dock) && !/youtube/.test(s.line) && !s.free.some((i) => i.id === 'youtube'), JSON.stringify(s))
  const name = await p.evaluate(() => document.querySelector('.dock [data-dock-app="youtube"]').getAttribute('aria-label'))
  check('in the Dock it is an app as the others are, under its name', /^YouTube/.test(name ?? ''), String(name))
  const finder = await center('.dock [data-dock-app="finder"]')
  await dragTo('[data-desk="one-pager"]', finder.x + 60, finder.y)
  s = await state()
  check('a file does not go into the Dock: dropped there, it stays on the desk', !/one-pager/.test(s.dock) && (/one-pager/.test(s.line) || s.free.some((i) => i.id === 'one-pager')), JSON.stringify(s))

  // ---- along the Dock, and out of it
  const last = await center('.dock [data-dock-app="myvip"]')
  await dragTo('.dock [data-dock-app="messages"]', last.x + 40, last.y)
  s = await state()
  check('a Dock icon dragged along the Dock takes the place it is dropped at', /myvip messages$/.test(s.dock) && s.dock.split(' ').length === A.DOCK_IDS.length + 1, s.dock)
  await dragTo('.dock [data-dock-app="notes"]', 420, 520)
  s = await state()
  check('dragged up out of the Dock, an app is out on the desk where it was let go', !/notes/.test(s.dock) && near(s.free.find((i) => i.id === 'notes'), 420, 520), JSON.stringify(s))
  await dragTo('.dock [data-dock-app="finder"]', 500, 300)
  s = await state()
  check('the Dock’s first icon stays put, as the Finder’s does', /^finder /.test(s.dock) && !s.free.some((i) => i.id === 'finder'), s.dock)
  check('none of that opened a window', s.open === '', s.open)
  await p.locator('[data-desk="notes"]').dblclick()
  await p.waitForTimeout(900)
  check('an app out on the desk opens from there', /notes/.test((await state()).open), (await state()).open)
  await p.locator('.wf[data-app="notes"] button[aria-label^="Close"]').click()
  await p.waitForTimeout(400)

  // ---- a visitor's arrangement lasts as long as the page is open
  const arranged = await state()
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(1800)
  s = await state()
  check('a visitor’s desk is as it comes again after a reload: nothing is kept for nobody', s.dock === DOCK && s.line === LINE && s.free.length === 0, JSON.stringify(s))

  // ---- logged in, it is kept
  await p.locator('.menubar__login').click()
  await p.locator('.account input[type=email]').fill('riley@example.test')
  await p.keyboard.press('Enter'); await p.waitForTimeout(900)
  await p.keyboard.type('4155550134'); await p.keyboard.press('Enter'); await p.waitForTimeout(900)
  await p.keyboard.type('246810'); await p.waitForTimeout(1500)
  await p.locator('.account input[type=text]').fill('Riley Chen'); await p.locator('.account__go').click(); await p.waitForTimeout(1800)
  await dragTo('[data-desk="spotify"]', 640, 260)
  const mail2 = await center('.dock [data-dock-app="mail"]')
  await dragTo('[data-desk="photobooth"]', mail2.x - 30, mail2.y)
  await dragTo('.dock [data-dock-app="terminal"]', 380, 480)
  const mine = await state()
  check('logged in, the same drags work', /notes photobooth mail/.test(mine.dock) && !/terminal/.test(mine.dock) && near(mine.free.find((i) => i.id === 'spotify'), 640, 260) && near(mine.free.find((i) => i.id === 'terminal'), 380, 480), JSON.stringify(mine))
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(2200)
  s = await state()
  check('after a reload their desk is as they left it: the Dock, and each icon where it was put', s.dock === mine.dock && s.line === mine.line && near(s.free.find((i) => i.id === 'spotify'), 640, 260) && near(s.free.find((i) => i.id === 'terminal'), 380, 480), JSON.stringify({ before: mine, after: s }))
  // a window that opens keeps clear of the line of icons that is still down the right
  await p.locator('.dock [data-dock-app="mail"]').click()
  await p.waitForSelector('.wf[data-app="mail"][data-open]', { timeout: 15000 })
  await p.waitForTimeout(700)
  const clear = await p.evaluate(() => { const w = document.querySelector('.wf[data-app="mail"]').getBoundingClientRect(); return [...document.querySelectorAll('.desk .desk__item')].every((i) => { const r = i.getBoundingClientRect(); return r.left >= w.right - 1 || r.right <= w.left + 1 || r.top >= w.bottom - 1 || r.bottom <= w.top + 1 }) })
  check('a window that opens keeps clear of the icons still in the line down the right', clear, '')
  await p.locator('.wf[data-app="mail"] button[aria-label^="Close"]').click()
  await p.waitForTimeout(400)
  // logged out, the desk is as it comes; logged in again, theirs is back
  await p.locator('.menubar__login').click()
  await p.locator('.account__row', { hasText: 'Log Out' }).click()
  await p.waitForTimeout(1200)
  s = await state()
  check('logged out, the desk is as it comes', s.dock === DOCK && s.line === LINE && s.free.length === 0, JSON.stringify(s))
  check('nothing went wrong on the way', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  void arranged
  await t.ctx.close()

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error('FAILED', e.message.split('\n').slice(0, 10).join('\n'))
  process.exit(1)
})
