// Arriving: what a phone fetches, and what forgiving addresses land on.
//   node addresses.cjs [base]
const A = require('./lib.cjs')
const BASE = process.argv[2] || 'http://127.0.0.1:4273/'
let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + detail : ''))
}
;(async () => {
  const browser = await A.launch()
  const visit = async (device, tail, wait = 1600) => {
    const t = await A.open(browser, { device, base: BASE, goto: false })
    const asked = []
    t.page.on('request', (r) => asked.push(r.url().replace(BASE, '/')))
    const seenLock = { v: false }
    await t.page.exposeFunction('__sawLock', () => (seenLock.v = true))
    await t.page.addInitScript(() => {
      new MutationObserver(() => {
        if (document.querySelector('.sb-lock:not([data-leaving])') && !document.getElementById('boot')) window.__sawLock()
      }).observe(document, { childList: true, subtree: true, attributes: true })
    })
    await t.page.goto(BASE + tail, { waitUntil: 'load' })
    await t.page.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.os[data-booted]'), null, { timeout: 20000 })
    await t.page.waitForTimeout(wait)
    return { t, asked, seenLock }
  }

  // what a phone fetches
  let v = await visit('iphone', '')
  check('a phone does not fetch the desktop wallpaper', !v.asked.some((u) => /\/wallpaper\.webp/.test(u)) && v.asked.some((u) => /wallpaper-phone\.webp/.test(u)), v.asked.filter((u) => /wallpaper/.test(u)).join())
  check('…and asks for Inter at once (not an Apple device here)', v.asked.findIndex((u) => /inter-latin-wght/.test(u)) >= 0 && v.asked.findIndex((u) => /inter-latin-wght/.test(u)) <= 8, String(v.asked.findIndex((u) => /inter-latin-wght/.test(u))))
  check('…and the phone half alongside the first script', v.asked.findIndex((u) => /Phone-/.test(u)) >= 0 && v.asked.findIndex((u) => /Phone-/.test(u)) <= 8, v.asked.slice(0, 9).map((u) => u.split('/').pop().slice(0, 18)).join(' '))
  check('no errors', A.realErrors(v.t.errors).length === 0, A.realErrors(v.t.errors).join(' | ').slice(0, 300))
  await v.t.ctx.close()
  v = await visit('iphone-land', '')
  check('a phone on its side: its own wallpaper only', !v.asked.some((u) => /\/wallpaper\.webp/.test(u)) && v.asked.some((u) => /wallpaper-phone\.webp/.test(u)), v.asked.filter((u) => /wallpaper/.test(u)).join())
  await v.t.ctx.close()
  v = await visit('desktop', '')
  check('the desktop: its wallpaper, not the phone\'s', v.asked.some((u) => /\/wallpaper\.webp/.test(u)) && !v.asked.some((u) => /wallpaper-phone/.test(u)), v.asked.filter((u) => /wallpaper/.test(u)).join())
  await v.t.ctx.close()
  v = await visit({ w: 600, h: 900, dpr: 1 }, '')
  check('a framed iPhone on a computer: both (one behind the frame)', v.asked.some((u) => /\/wallpaper\.webp/.test(u)) && v.asked.some((u) => /wallpaper-phone/.test(u)))
  await v.t.ctx.close()

  // the cascade: the site's own stylesheet first, each half's after it (a built page that got this the
  // other way round drew every grid as one column, and no test on the dev server could see it)
  for (const [device, half, probe] of [['iphone', /Phone-/, ['finder', [], '.contacts-row']], ['desktop', /Surface-/, null]]) {
    v = await visit(device, device === 'iphone' ? '?open=portfolio' : '')
    const order = await v.t.page.evaluate(() => [...document.styleSheets].map((sheet) => (sheet.href || 'inline').split('/').pop()))
    const main = order.findIndex((name) => /^index-/.test(name))
    const own = order.findIndex((name) => half.test ? false : false)
    const halfAt = order.findIndex((name) => /^(Phone|Surface)-/.test(name))
    if (main >= 0) check(`${device}: the site's stylesheet comes before its half's`, halfAt < 0 || main < halfAt, order.join(' '))
    if (probe) {
      const display = await v.t.page.evaluate((sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display : 'missing' }, probe[2])
      check(`${device}: a row of the portfolio sets its logo beside its name`, display === 'flex', display)
    }
    await v.t.ctx.close()
  }

  // forgiving addresses, on the phone
  for (const [tail, app, stack] of [
    ['?open=chat', 'messages', 'c:group'],
    ['?OPEN=Portfolio', 'finder', ''],
    ['?open=contacts', 'finder', ''],
    ['?open=wallet', 'finder', ''],
    ['?open=files', 'finder', ''],
    ['?open=portfolio&at=varda', 'finder', 'co:Varda'],
    ['?open=portfolio;faqs', 'notes', 'f:faqs'],
    ['?open=portfolio+vip', 'photos', ''],
    ['portfolio', 'finder', ''],
    ['#faqs', 'notes', 'f:faqs'],
    // (About Shrug is the desktop's: who Shrug is, on a phone, is on Shrug's own card in Contacts, and that is where a link to it arrives)
    ['?open=about', 'finder', 'me'],
    ['?open=settings', 'finder', 'me'],
    // (one person's reply: the conversation, which is then brought to what they said)
    ['?open=chat&at=tony-hawk', 'messages', 'c:group'],
    ['?open=nonsense', null, null],
  ]) {
    v = await visit('iphone', tail, 900)
    const s = await A.state(v.t.page)
    const ok = app === 'home' ? !s.locked && !s.place?.app : app ? !s.locked && s.place?.app === app && (s.place.stack.join() === stack) : s.locked
    check(`phone ${tail} -> ${app === 'home' ? 'the Home Screen, open' : (app ?? 'the Lock Screen')}`, ok, JSON.stringify(s.place) + ' locked ' + s.locked)
    if (app && app !== 'home') check(`…with no Lock Screen on the way`, !v.seenLock.v)
    await v.t.ctx.close()
  }
  // and on the desktop
  for (const [tail, want] of [['?open=Portfolio;FAQs', 'finder,messages,notes'], ['vip', 'messages,photos'], ['?phone=0', 'messages'], ['?PHONE', null], ['?phone=off&open=faqs', 'messages,notes']]) {
    v = await visit('desktop', tail, 1500)
    const got = await v.t.page.evaluate(() => (document.querySelector('.dock') ? [...document.querySelectorAll('.wf[data-app]')].filter((w) => !w.hasAttribute('inert') && getComputedStyle(w).visibility !== 'hidden').map((w) => w.getAttribute('data-app')).sort().join() : null))
    check(`desktop ${tail} -> ${want ?? 'the iPhone'}`, got === want, String(got))
    await v.t.ctx.close()
  }
  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})()
