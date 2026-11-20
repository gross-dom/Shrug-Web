// The address follows the visitor, and a reload brings the desktop back.
//   node place.cjs [base]
// On both layouts the address names where the visitor is (`?open=portfolio&at=varda`), a link copied from
// it opens there, Share passes that link on, and whatever else the address carries is left alone. On the
// desktop a reload brings back the windows as they were left; a visit beginning does not.
const A = require('./lib.cjs')
const BASE = process.argv[2] || process.env.BASE || 'http://127.0.0.1:5173/'

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + detail : ''))
}
const tail = (page) => page.url().slice(BASE.length - 1)
const settle = (page, ms = 700) => page.waitForTimeout(ms)
const arrived = (page) => page.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.os[data-booted]'), null, { timeout: 20000 })
const windows = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('.wf')]
        .filter((w) => w.hasAttribute('data-open'))
        .map((w) => {
          const r = w.getBoundingClientRect()
          return [w.getAttribute('data-app'), { min: w.hasAttribute('data-min'), active: w.hasAttribute('data-active'), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }]
        }),
    ),
  )

;(async () => {
  const browser = await A.launch()

  // ---- The iPhone ----
  let t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still' })
  await arrived(t.page)
  await A.unlock(t.page)
  check('phone, Home Screen: the address names no app', tail(t.page) === '/?still', tail(t.page))
  await t.page.locator('.sb-dock [data-app="finder"], .sb-dock .sb-icon >> nth=1').first().tap()
  await settle(t.page, 1100)
  check('phone, Contacts: ?open=portfolio, the other switch kept', tail(t.page) === '/?still&open=portfolio', tail(t.page))
  // The index brings up a vertical without leaving the list: the address names a company, when one is open
  await t.page.locator('.sb-slot[data-front] .contacts-index__letter[data-letter="H"]').tap(); await settle(t.page, 500)
  let s = await A.state(t.page)
  check('phone, a vertical brought up by its letter: the address is the portfolio still', s.place?.stack.length === 0 && tail(t.page) === '/?still&open=portfolio', `${tail(t.page)} ${JSON.stringify(s.place)}`)
  await t.page.locator('.sb-slot[data-front] .contacts-row[data-company="Eight Sleep"]').tap(); await settle(t.page, 1000)
  s = await A.state(t.page)
  check('phone, a company open: &at=eight-sleep', s.place?.stack.join() === 'co:Eight Sleep' && s.place?.sheet === null && tail(t.page) === '/?still&open=portfolio&at=eight-sleep', `${tail(t.page)} ${JSON.stringify(s.place)}`)
  await t.page.goBack(); await settle(t.page, 900)
  s = await A.state(t.page)
  check('phone, Back: the address goes back with it, to the list', tail(t.page) === '/?still&open=portfolio' && s.place?.app === 'finder' && s.place.stack.length === 0, `${tail(t.page)} ${JSON.stringify(s.place)}`)
  // Shrug's own card is a place in the app, and not a company: the address is the portfolio's
  await t.page.locator('.sb-slot[data-front] .ios-page[data-pos="top"] [data-scroller]').evaluate((el) => (el.scrollTop = 0)); await settle(t.page, 200)
  await t.page.locator('.sb-slot[data-front] .contacts-me').tap(); await settle(t.page, 1000)
  s = await A.state(t.page)
  check('phone, My Card: the address is the portfolio still', s.place?.stack.join() === 'me' && tail(t.page) === '/?still&open=portfolio', `${tail(t.page)} ${JSON.stringify(s.place)}`)
  await t.page.goBack(); await settle(t.page, 900)
  await t.page.goBack(); await settle(t.page, 900)
  check('phone, Back to the Home Screen: no app named', tail(t.page) === '/?still', tail(t.page))
  await t.page.goForward(); await settle(t.page, 900)
  check('phone, Forward: the app named again', tail(t.page) === '/?still&open=portfolio', tail(t.page))
  // An app opened at a place of its own (the conversation, out of the widget) and sent home leaves no step behind it:
  // the phone is back on the Home Screen's own step, at the Home Screen's address
  await t.page.goBack(); await settle(t.page, 900)
  const homeStep = (await A.state(t.page)).n
  await t.page.locator('.sb-widget--wide').tap(); await settle(t.page, 1300)
  s = await A.state(t.page)
  check('phone, the conversation out of the widget: ?open=chat, a step on', tail(t.page) === '/?still&open=chat' && s.place?.stack.join() === 'c:group' && s.n === homeStep + 1, `${tail(t.page)} step ${s.n}`)
  await t.page.evaluate(() => document.querySelector('.sb-homebar .sr-only')?.click()); await settle(t.page, 1100)
  s = await A.state(t.page)
  check('phone, sent home from there: the plain address, on the step the Home Screen was on', tail(t.page) === '/?still' && s.place?.app === null && s.n === homeStep, `${tail(t.page)} step ${s.n} (the Home Screen was on ${homeStep})`)
  check('phone: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | ').slice(0, 300))
  await t.ctx.close()

  // A link opens where it says
  for (const [link, app, stack, sheet] of [
    ['?open=portfolio&at=eight-sleep', 'finder', 'co:Eight Sleep', null],
    ['?open=portfolio&at=atoms-atoms-co', 'finder', 'co:Atoms (atoms.co)', null],
    ['?open=faqs&at=4', 'notes', 'f:faqs,n:3', null],
    ['?open=chat&at=founder', 'messages', 'c:founder', null],
    ['?open=chat', 'messages', 'c:group', null],
    // (VIP is one grid: what a link names inside it is not a place there, and the grid is what opens)
    ['?open=vip&at=billboards', 'photos', '', null],
    ['?open=faqs&at=99', 'notes', 'f:faqs', null],
    ['?open=portfolio&at=nobody', 'finder', '', null],
  ]) {
    t = await A.open(browser, { device: 'iphone', base: BASE, query: link.slice(1) })
    await arrived(t.page)
    await settle(t.page, 900)
    s = await A.state(t.page)
    check(`phone link ${link} opens there, unlocked`, !s.locked && s.place?.app === app && s.place.stack.join() === stack && (s.place.sheet ?? null) === sheet, JSON.stringify(s.place))
    await t.ctx.close()
  }

  // The other switches stay; a path that names an app becomes the query; Share passes on the place alone
  t = await A.open(browser, { device: 'iphone', base: BASE, query: 'phone=hand&draft&open=faqs&at=2' })
  await arrived(t.page)
  await settle(t.page, 900)
  check('phone: other switches are left as they were', tail(t.page) === '/?phone=hand&draft&open=faqs&at=2', tail(t.page))
  const link = await t.page.evaluate(async () => {
    const button = [...document.querySelectorAll('.ios-page[data-pos="top"] button')].find((b) => /share/i.test(b.getAttribute('aria-label') || ''))
    if (!button) return 'no share button'
    button.click()
    await new Promise((r) => setTimeout(r, 500))
    return navigator.clipboard.readText().catch((e) => 'clipboard: ' + e.message)
  })
  check('phone, Share on a question: a link to that question and nothing else of this page', /\/\?open=faqs&at=2$/.test(link) && !/draft|phone/.test(link), link)
  await t.ctx.close()
  t = await A.open(browser, { device: 'iphone', base: BASE, goto: false })
  await t.page.goto(BASE + 'portfolio')
  await arrived(t.page)
  await settle(t.page, 900)
  check('phone, /portfolio: the address becomes /?open=portfolio', tail(t.page) === '/?open=portfolio', tail(t.page))
  await t.ctx.close()

  // ---- The desktop ----
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still' })
  await arrived(t.page)
  await settle(t.page, 1500)
  check('desktop as a visit finds it: the plain address', tail(t.page) === '/?still', tail(t.page))
  await t.page.click('[data-dock-app="finder"]'); await settle(t.page, 900)
  check('desktop, Portfolio in front: ?open=portfolio', tail(t.page) === '/?still&open=portfolio', tail(t.page))
  await t.page.click('.wf[data-app="finder"] [data-company="Eight Sleep"]'); await settle(t.page, 500)
  check('desktop, a company picked: &at=eight-sleep', tail(t.page) === '/?still&open=portfolio&at=eight-sleep', tail(t.page))
  await t.page.click('[data-dock-app="notes"]'); await settle(t.page, 900)
  await t.page.locator('.wf[data-app="notes"] .faq-row').nth(2).click(); await settle(t.page, 500)
  check('desktop, the third question: ?open=faqs&at=3', tail(t.page) === '/?still&open=faqs&at=3', tail(t.page))
  // Put FAQs in the Dock, move the Portfolio window, then reload. (FAQs first, while it is in front and its lights
  // can be pressed: it opens under the desk's icons now, and the Portfolio window, once moved, lies over them)
  await t.page.click('.wf[data-app="notes"] .wf__light[data-kind="min"]'); await settle(t.page, 900)
  await t.page.click('[data-dock-app="finder"]'); await settle(t.page, 600)
  const bar = await t.page.locator('.wf[data-app="finder"]').boundingBox()
  await t.page.mouse.move(bar.x + bar.width / 2, bar.y + 14)
  await t.page.mouse.down()
  await t.page.mouse.move(bar.x + bar.width / 2 - 180, bar.y + 14 + 90, { steps: 8 })
  await t.page.mouse.up()
  await settle(t.page, 500)
  const before = await windows(t.page)
  const addressBefore = tail(t.page)
  await settle(t.page, 600)
  await t.page.reload()
  await arrived(t.page)
  await settle(t.page, 1600)
  const after = await windows(t.page)
  const near = (a, b) => !!a && !!b && Math.abs(a.x - b.x) <= 2 && Math.abs(a.y - b.y) <= 2 && Math.abs(a.w - b.w) <= 2 && Math.abs(a.h - b.h) <= 2
  check('desktop, reload: the same windows are open', Object.keys(after).sort().join() === Object.keys(before).sort().join() && Object.keys(before).length === 3, `${Object.keys(before).sort()} -> ${Object.keys(after).sort()}`)
  check('desktop, reload: Portfolio is where it was put', near(before.finder, after.finder), `${JSON.stringify(before.finder)} -> ${JSON.stringify(after.finder)}`)
  check('desktop, reload: FAQs is still in the Dock, Portfolio still in front', after.notes?.min === true && after.finder?.active === true, JSON.stringify(after))
  const showing = await t.page.evaluate(() => ({ picked: document.querySelector('.wf[data-app="finder"] [data-company][aria-selected="true"]')?.getAttribute('data-company') ?? null, question: document.querySelector('.wf[data-app="notes"] .faq__title')?.textContent ?? null }))
  check('desktop, reload: the company picked and the question shown are the same', showing.picked === 'Eight Sleep' && /What are you investing in/i.test(showing.question || ''), JSON.stringify(showing))
  check('desktop, reload: the address is the same', tail(t.page) === addressBefore, `${addressBefore} -> ${tail(t.page)}`)
  // A visit beginning (the address gone to afresh) does not bring that desk back
  await t.page.goto(BASE + '?still')
  await arrived(t.page)
  await settle(t.page, 1500)
  const fresh = await windows(t.page)
  check('desktop, a visit beginning: the conversation alone, as ever', Object.keys(fresh).join() === 'messages', Object.keys(fresh).join())
  // Every window closed, then a reload: an empty desk, not the conversation opened again
  await t.page.click('.wf[data-app="messages"] .wf__light[data-kind="close"]', { force: true })
  await settle(t.page, 1000)
  await t.page.reload()
  await arrived(t.page)
  await settle(t.page, 1600)
  check('desktop, everything closed, reload: an empty desk', Object.keys(await windows(t.page)).length === 0, Object.keys(await windows(t.page)).join())
  check('desktop: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | ').slice(0, 300))
  await t.ctx.close()

  // A link opens where it says on the desktop too
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&open=portfolio&at=eight-sleep' })
  await arrived(t.page)
  await settle(t.page, 1500)
  const linked = await t.page.evaluate(() => ({ front: document.querySelector('.wf[data-active]')?.getAttribute('data-app') ?? null, picked: document.querySelector('.wf[data-app="finder"] [data-company][aria-selected="true"]')?.getAttribute('data-company') ?? null }))
  check('desktop link ?open=portfolio&at=eight-sleep: Portfolio in front with Eight Sleep picked', linked.front === 'finder' && linked.picked === 'Eight Sleep', JSON.stringify(linked))
  await t.ctx.close()

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'place: all ok')
  process.exit(failed ? 1 : 0)
})().catch((e) => { console.error('FAILED', e.message.split('\n').slice(0, 4).join('\n')); process.exit(1) })
