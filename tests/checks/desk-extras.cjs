// What Niv's notes of 27 Nov put on the desk: the art's widget, which is the way into ArtStore; Portfolio as
// a folder there as well as in the Dock; an icon let go of over the line of icons going into the line; the
// way to ask about becoming an LP, in the locked folder; and a card that is not preceded by the way to sign in.
//   node desk-extras.cjs http://127.0.0.1:4273/
const A = require('./lib.cjs')
const BASE = process.argv[2] || A.BASE

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

;(async () => {
  const browser = await A.launch()
  const box = (p, sel) => p.evaluate((sel) => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r ? { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) } : null }, sel)
  const line = (p) => p.evaluate(() => ({ line: [...document.querySelectorAll('.desk .desk__item')].map((i) => i.dataset.desk).join(' '), free: [...document.querySelectorAll('.desk-free .desk__item')].map((i) => i.dataset.desk).join(' '), dock: [...document.querySelectorAll('.dock__shelf [data-dock-app]')].map((i) => i.dataset.dockApp).join(' '), over: (() => { const rs = [...document.querySelectorAll('.desk__item')].map((i) => i.getBoundingClientRect()); let n = 0; for (let a = 0; a < rs.length; a++) for (let b = a + 1; b < rs.length; b++) if (rs[a].left < rs[b].right - 1 && rs[b].left < rs[a].right - 1 && rs[a].top < rs[b].bottom - 1 && rs[b].top < rs[a].bottom - 1) n++; return n })() }))

  // ---- the art's widget (a desk that is not asked to keep still: it turns)
  let t = await A.open(browser, { device: 'desktop', base: BASE, query: 'empty' })
  let p = t.page
  await p.waitForSelector('.aw', { timeout: 20000 })
  await p.waitForFunction(() => [...document.querySelectorAll('.aw__pic')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {})
  const sf = await box(p, '.sf')
  const aw = await box(p, '.aw')
  const first = await p.evaluate(() => { const w = document.querySelector('.aw'); const pics = [...w.querySelectorAll('.aw__pic')]; return { label: w.getAttribute('aria-label'), name: w.querySelector('.aw__says b').textContent, sub: w.querySelector('.aw__says small').textContent, order: [...w.querySelector('.aw__says').children].map((c) => c.tagName).join(' '), fills: pics.every((i) => getComputedStyle(i).objectFit === 'cover' && Math.round(i.getBoundingClientRect().width) === Math.round(w.getBoundingClientRect().width) && Math.round(i.getBoundingClientRect().height) === Math.round(w.getBoundingClientRect().height)), ink: getComputedStyle(w.querySelector('.aw__says b')).color, size: parseFloat(getComputedStyle(w.querySelector('.aw__says b')).fontSize), pics: pics.length, on: pics.filter((i) => getComputedStyle(i).opacity === '1').length, loaded: pics.every((i) => i.complete && i.naturalWidth > 0), files: pics.map((i) => i.getAttribute('src').split('/').pop()).join(' ') } })
  check('under San Francisco on the desk is a second widget, the same size: the art, one piece at a time, drawn as a News widget is: the artwork fills it, and over its foot in white is ArtStore with the piece’s name under it, larger', !!sf && !!aw && aw.x === sf.x && aw.w === sf.w && aw.h === sf.h && aw.y - sf.b >= 8 && aw.y - sf.b <= 16 && first.pics === 5 && first.on === 1 && first.loaded && first.fills && first.order === 'SMALL B' && first.ink === 'rgb(255, 255, 255)' && first.size >= 15 && first.name === 'America Must Win' && first.sub === 'ArtStore' && /^ArtStore: America Must Win, one of 5 pieces\. Opens ArtStore$/.test(first.label) && /^art-america-must-win-3-s\.webp /.test(first.files), JSON.stringify({ sf, aw, first }))
  await p.waitForFunction(() => document.querySelector('.aw__says b')?.textContent !== 'America Must Win', null, { timeout: 12000 }).catch(() => {})
  await p.waitForTimeout(1400)
  const turned = await p.evaluate(() => ({ name: document.querySelector('.aw__says b').textContent, on: [...document.querySelectorAll('.aw__pic')].map((i) => getComputedStyle(i).opacity).join(' ') }))
  check('it turns to the next piece by itself, the one before going as it comes', turned.name === 'Becoming Steve Jobs' && turned.on === '0 1 0 0 0', JSON.stringify(turned))
  await p.locator('.aw').click()
  await p.waitForSelector('.wf[data-app="store"][data-open] iframe', { timeout: 20000 })
  await p.waitForFunction(() => /[?&]p=/.test(document.querySelector('.wf[data-app="store"] iframe')?.contentWindow?.location.search ?? ''), null, { timeout: 15000 }).catch(() => {})
  await p.waitForTimeout(900)
  const opened = await p.evaluate(() => { const f = document.querySelector('.wf[data-app="store"] iframe'); return { search: f.contentWindow.location.search, title: f.contentDocument.querySelector('.ui-col h1, .ui-col .t-title')?.textContent ?? '', front: document.querySelector('.wf[data-active]')?.dataset.app } })
  check('pressed, it opens ArtStore on the piece that was showing', opened.front === 'store' && /^\?k=art&p=art-2$/.test(opened.search) && opened.title === 'Becoming Steve Jobs', JSON.stringify(opened))
  // (ArtStore's window is drawn 1120 across. With the desk's icons in two lines, a desk 1440 across has 1030
  // between the widgets and the icons, so the window lies on the edge of each: a sliver of the widget, not it)
  const clear = await p.evaluate(() => { const w = document.querySelector('.wf[data-app="store"]').getBoundingClientRect(); const a = document.querySelector('.aw').getBoundingClientRect(); const over = Math.max(0, Math.min(w.right, a.right) - Math.max(w.left, a.left)) * Math.max(0, Math.min(w.bottom, a.bottom) - Math.max(w.top, a.top)); return { share: Math.round((over / (a.width * a.height)) * 100), wide: Math.round(w.width) } })
  check('the window opens beside it: on no more than its edge (a fifth of it at most)', clear.share <= 20 && clear.wide === 1120, JSON.stringify(clear))
  check('nothing went wrong on the way', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- Portfolio, a folder on the desk; and an icon let go of over the line
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  p = t.page
  await p.waitForSelector('[data-desk="portfolio"]', { timeout: 20000 })
  await p.waitForTimeout(800)
  let now = await line(p)
  check('Portfolio is a folder on the desk, after Updates, as well as an icon in the Dock', now.line === A.DESK.map(([id]) => id).join(' ') && /^finder /.test(now.dock) && (await p.locator('[data-desk="portfolio"]').getAttribute('aria-label')) === 'Portfolio, desktop icon', JSON.stringify(now))
  await p.locator('[data-desk="portfolio"]').dblclick()
  await p.waitForSelector('.wf[data-app="finder"][data-open]', { timeout: 15000 })
  await p.waitForTimeout(700)
  check('opened, it is the portfolio’s own window', (await p.evaluate(() => document.querySelector('.wf[data-active]')?.dataset.app)) === 'finder')
  await p.locator('.wf[data-app="finder"] button[aria-label^="Close"]').click()
  await p.waitForTimeout(500)
  // (Notes, out of the Dock and let go of over Spotify in the line)
  const from = await box(p, '.dock__shelf [data-dock-app="notes"]')
  const onto = await box(p, '[data-desk="spotify"]')
  await p.mouse.move(from.x + from.w / 2, from.y + from.h / 2)
  await p.mouse.down()
  await p.mouse.move(from.x + from.w / 2, from.y - 60, { steps: 4 })
  await p.mouse.move(onto.x + onto.w / 2, onto.y + onto.h / 2 + 12, { steps: 8 })
  await p.mouse.up()
  await p.waitForTimeout(700)
  now = await line(p)
  check('an app let go of over the line of icons goes into the line there, beside the one it was let go of over: nothing lies on anything', /spotify notes|notes spotify/.test(now.line) && now.free === '' && now.over === 0 && !/notes/.test(now.dock), JSON.stringify(now))
  // (and out of the line, to the middle of the desk: where it was put)
  const notes = await box(p, '[data-desk="notes"]')
  await p.mouse.move(notes.x + notes.w / 2, notes.y + notes.h / 2)
  await p.mouse.down()
  await p.mouse.move(700, 400, { steps: 8 })
  await p.mouse.up()
  await p.waitForTimeout(600)
  now = await line(p)
  check('let go of anywhere else, it is where it was put', now.free === 'notes' && !/notes/.test(now.line) && now.over === 0, JSON.stringify(now))
  // (and back onto the line, above Updates: the head of it)
  const head = await box(p, '[data-desk="updates"]')
  const put = await box(p, '[data-desk="notes"]')
  await p.mouse.move(put.x + put.w / 2, put.y + put.h / 2)
  await p.mouse.down()
  await p.mouse.move(put.x + 120, put.y, { steps: 4 })
  await p.mouse.move(head.x + head.w / 2, head.y + 6, { steps: 8 })
  await p.mouse.up()
  await p.waitForTimeout(600)
  now = await line(p)
  check('and back over the head of the line, it is the first in it', /^notes updates /.test(now.line) && now.free === '' && now.over === 0, JSON.stringify(now))

  // ---- the Updates folder, to someone who is not an LP: the way to ask about becoming one. It opens
  // Accredited Investors Only (Dom, 27 Nov: it opened a message to Shrug in Messages)
  await p.goto(new URL('?still&empty&open=updates', BASE).href)
  await p.waitForSelector('.wf[data-app="updates"][data-open] .upd-note', { timeout: 20000 })
  await p.waitForTimeout(600)
  const locked = await p.evaluate(() => [...document.querySelectorAll('.wf[data-app="updates"] .upd-note button')].map((b) => b.textContent.trim()).join(' | '))
  check('under its list the folder has, beside Log In, the way to ask about becoming an LP', locked === 'Log In | Enquire about becoming an LP', locked)
  await p.locator('.updates__enquire').click()
  await p.waitForSelector('.wf[data-app="investors"][data-open] .inv-page', { timeout: 15000 })
  await p.waitForTimeout(900)
  const asking = await p.evaluate(() => ({ front: document.querySelector('.wf[data-active]')?.dataset.app, head: document.querySelector('.wf[data-app="investors"] .inv-page h1')?.textContent ?? '', messages: !!document.querySelector('.wf[data-app="messages"] .im-to') }))
  check('pressed, it opens Accredited Investors Only, in front, on its first page; no message to Shrug is begun', asking.front === 'investors' && asking.head === 'Accredited Investors Only' && !asking.messages, JSON.stringify(asking))
  check('nothing went wrong on the way', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- someone logged in opens their card for the first time: the card, with no way to sign in before it
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  p = t.page
  await p.waitForSelector('.menubar__login', { timeout: 20000 })
  await p.locator('.menubar__login').click()
  await p.locator('.account input[type=email]').fill('quinn.card@example.com')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(900)
  await p.keyboard.type('4155550137')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(900)
  await p.keyboard.type('246810')
  await p.waitForTimeout(1500)
  await p.keyboard.type('Quinn Card')
  await p.locator('.account__go').click()
  await p.waitForTimeout(1500)
  // (the card's own page, as this browser has never had it: every frame of it is looked at as it is drawn)
  const card = await t.ctx.newPage()
  await card.addInitScript(() => {
    window.__seen = { strip: 0, card: 0, frames: 0 }
    const look = () => {
      const rig = document.getElementById('rig') || document.querySelector('.rig')
      const slot = document.getElementById('cardslot') || document.querySelector('.cardslot')
      const shown = (el) => !!el && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'
      if (document.body) {
        window.__seen.frames++
        if (shown(rig) && document.getElementById('page')?.dataset.ready === 'on') window.__seen.strip++
        if (shown(slot)) window.__seen.card++
      }
      requestAnimationFrame(look)
    }
    requestAnimationFrame(look)
  })
  await card.goto(new URL('vip/', BASE).href)
  await card.waitForFunction(() => window.__seen && window.__seen.card > 5, null, { timeout: 20000 }).catch(() => {})
  await card.waitForTimeout(600)
  const seen = await card.evaluate(() => ({ ...window.__seen, view: document.getElementById('page')?.dataset.view }))
  check('their card is what the card’s page shows them, the first time too: the way to sign in is never drawn before it', seen.view === 'card' && seen.card > 5 && seen.strip === 0, JSON.stringify(seen))
  // (and nobody logged in is still shown the way to sign in)
  const anon = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const visitor = await anon.newPage()
  await visitor.goto(new URL('vip/', BASE).href)
  await visitor.waitForTimeout(2500)
  const strip = await visitor.evaluate(() => ({ view: document.getElementById('page')?.dataset.view, rig: !(document.getElementById('rig') || document.querySelector('.rig'))?.hidden, says: document.getElementById('tearBtn')?.innerText.replace(/\s+/g, ' ').trim() ?? '' }))
  check('nobody logged in is shown the way to sign in, as before', strip.view === 'pack' && strip.rig && /sign in/i.test(strip.says), JSON.stringify(strip))
  await anon.close()
  await t.ctx.close()

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error('FAILED', e.message.split('\n').slice(0, 10).join('\n'))
  process.exit(1)
})
