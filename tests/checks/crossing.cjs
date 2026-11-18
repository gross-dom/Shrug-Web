// A visit under way when the layout changes: the visitor stays where they were.
//   node crossing.cjs [base]
const A = require('./lib.cjs')
const path = require('path')
const BASE = process.argv[2] || 'http://127.0.0.1:4273/'
const OUT = path.join(__dirname, '..', 'audit', 'shots', 'cross')
require('fs').mkdirSync(OUT, { recursive: true })

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + detail : ''))
}

const desk = (page) =>
  page.evaluate(() => {
    const wins = [...document.querySelectorAll('.wf[data-app]')].filter((w) => !w.hasAttribute('inert') && getComputedStyle(w).visibility !== 'hidden')
    const front = wins.sort((a, b) => Number(getComputedStyle(b).zIndex || 0) - Number(getComputedStyle(a).zIndex || 0))[0]
    return { front: front?.getAttribute('data-app') ?? null, open: wins.map((w) => w.getAttribute('data-app')).sort() }
  })
const size = (page, w, h) => page.setViewportSize({ width: w, height: h }).then(() => page.waitForTimeout(900))

;(async () => {
  const browser = await A.launch()
  const fresh = async (device, query = 'still') => {
    const t = await A.open(browser, { device, base: BASE, query })
    await t.page.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.os[data-booted]'), null, { timeout: 20000 })
    await t.page.waitForTimeout(700)
    return t
  }

  // 1. The desktop, untouched (the conversation is in front) -> the iPhone: in the conversation, not locked
  let t = await fresh('ipad-land')
  check('ipad on its side is the desktop', (await A.layout(t.page)) === 'desktop')
  await size(t.page, 600, 900)
  let s = await A.state(t.page)
  check('desktop -> iPhone: in the group conversation, unlocked', (await A.layout(t.page)) === 'phone-framed' && !s.locked && s.place?.app === 'messages' && s.place.stack.join() === 'c:group', JSON.stringify(s))
  await t.page.screenshot({ path: path.join(OUT, '1-desk-to-phone.png') })
  await t.ctx.close()

  // 2. Portfolio in front with a company picked -> the iPhone: Files, that company's sheet
  t = await fresh('ipad-land')
  await t.page.click('.dock [data-dock-item][data-app="finder"], .dock__item[data-app="finder"]').catch(async () => {
    await t.page.click('.dock__item >> nth=0')
  })
  await t.page.waitForSelector('.wf[data-app="finder"]', { timeout: 5000 })
  await t.page.waitForTimeout(600)
  const tile = await t.page.$$('.wf[data-app="finder"] [data-company], .wf[data-app="finder"] .tile, .wf[data-app="finder"] [role="option"]')
  if (tile[2]) await tile[2].click()
  await t.page.waitForTimeout(300)
  const picked = await t.page.evaluate(() => document.querySelector('.wf[data-app="finder"] [aria-selected="true"]')?.textContent?.trim().slice(0, 40) ?? null)
  await size(t.page, 600, 900)
  s = await A.state(t.page)
  check('Portfolio in front -> iPhone: Files, unlocked', !s.locked && s.place?.app === 'finder', JSON.stringify({ s, picked }))
  check('…with the company that was picked', !picked || (s.place?.sheet ?? '').startsWith('company:'), JSON.stringify({ sheet: s.place?.sheet, picked }))
  await t.page.screenshot({ path: path.join(OUT, '2-finder-to-phone.png') })
  // and back: the Portfolio window is in front
  await size(t.page, 1180, 820)
  let d = await desk(t.page)
  check('…and back: Portfolio in front on the desktop', (await A.layout(t.page)) === 'desktop' && d.front === 'finder', JSON.stringify(d))
  await t.ctx.close()

  // 3. The iPhone on a question -> the desktop: the FAQs window, on that question
  t = await fresh({ w: 600, h: 900, dpr: 1 })
  await A.unlock(t.page)
  await A.at(t.page, 'notes', ['f:faqs', 'n:4'])
  await size(t.page, 1280, 800)
  d = await desk(t.page)
  const question = await t.page.evaluate(() => document.querySelector('.wf[data-app="notes"] .faq__title')?.textContent ?? null)
  check('iPhone on a question -> desktop: FAQs in front', d.front === 'notes', JSON.stringify(d))
  check('…on the same question', /What are drops/.test(question || ''), String(question))
  await t.page.screenshot({ path: path.join(OUT, '3-note-to-desk.png') })
  // back: still on the question, unlocked
  await size(t.page, 600, 900)
  s = await A.state(t.page)
  check('…and back: the question, unlocked', !s.locked && s.place?.app === 'notes' && s.place.stack.join() === 'f:faqs,n:4', JSON.stringify(s))
  await t.ctx.close()

  // 4. The iPhone still locked (nobody has been in) -> the desktop opens as an arrival does; back: locked as it was
  t = await fresh({ w: 600, h: 900, dpr: 1 })
  await size(t.page, 1280, 800)
  d = await desk(t.page)
  check('locked iPhone -> desktop: the conversation opens', d.front === 'messages', JSON.stringify(d))
  await t.ctx.close()

  // 5. The iPhone on its Home Screen with a conversation typed into on the desktop before: nothing lost on the desk
  t = await fresh('ipad-land')
  await size(t.page, 600, 900)
  await t.page.keyboard.press('Escape').catch(() => {})
  await size(t.page, 1180, 820)
  d = await desk(t.page)
  check('desktop -> iPhone -> desktop: the desktop as it was', d.front === 'messages' && d.open.join() === 'messages', JSON.stringify(d))
  await t.ctx.close()

  // 6. An iPad mini upright is a desktop now, and holds together
  t = await fresh('ipadmini')
  const mini = await t.page.evaluate(() => {
    const out = (el) => {
      const r = el.getBoundingClientRect()
      return r.left < -0.5 || r.right > innerWidth + 0.5
    }
    return {
      dock: !!document.querySelector('.dock'),
      spill: [...document.querySelectorAll('.dock, .menubar, .wf[data-app], .desk__icon, .desk-icon')].filter(out).map((el) => el.className.toString().slice(0, 30)),
      win: (() => { const r = document.querySelector('.wf[data-app="messages"]')?.getBoundingClientRect(); return r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null })(),
    }
  })
  check('iPad mini upright: the desktop, nothing off the sides', mini.dock && mini.spill.length === 0, JSON.stringify(mini))
  await t.page.screenshot({ path: path.join(OUT, '6-ipadmini.png') })
  await t.ctx.close()
  t = await fresh({ w: 740, h: 480, dpr: 1 })
  check('740x480 is the desktop, 739 the iPhone', (await A.layout(t.page)) === 'desktop')
  await t.page.screenshot({ path: path.join(OUT, '6-740x480.png') })
  await size(t.page, 739, 480)
  check('…739 the iPhone', /^phone-/.test(await A.layout(t.page)))
  await t.ctx.close()

  // 7. A keyboard takes the foot of the page while typing: the desktop stays, the words and the caret too
  t = await fresh('ipad-land')
  const field = t.page.locator('.wf[data-app="messages"] textarea, .wf[data-app="messages"] input[type="text"], .wf[data-app="messages"] .composer__input').last()
  await field.click()
  await t.page.keyboard.type('half a thought')
  await size(t.page, 1180, 420)
  const up = await t.page.evaluate(() => ({ dock: !!document.querySelector('.dock'), phone: !!document.querySelector('.ph'), focus: document.activeElement?.className?.toString().slice(0, 40), value: document.activeElement?.value ?? null }))
  check('keyboard up (height 820 -> 420 while typing): still the desktop, caret and words kept', up.dock && !up.phone && up.value === 'half a thought', JSON.stringify(up))
  await t.page.screenshot({ path: path.join(OUT, '7-keyboard-up.png') })
  await size(t.page, 1180, 820)
  const down = await t.page.evaluate(() => ({ dock: !!document.querySelector('.dock'), value: document.activeElement?.value ?? null }))
  check('keyboard down: the desktop, words kept', down.dock && down.value === 'half a thought', JSON.stringify(down))
  // not typing: a short window is the iPhone, as before
  await t.page.evaluate(() => document.activeElement?.blur())
  await size(t.page, 1180, 420)
  check('nobody typing, 420 tall: the iPhone', (await A.layout(t.page)) !== 'desktop')
  check('no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | ').slice(0, 300))
  await t.ctx.close()

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})()
