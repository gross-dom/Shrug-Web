// Whatever goes wrong while the site arrives, is there something on screen and a way on?
//   node arriving.cjs [base]
const A = require('./lib.cjs')
const path = require('path')
const BASE = process.argv[2] || 'http://127.0.0.1:4273/'
const OUT = path.join(__dirname, '..', 'audit', 'shots', 'land')
require('fs').mkdirSync(OUT, { recursive: true })

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + detail : ''))
}

const boot = (page) =>
  page.evaluate(() => {
    const b = document.getElementById('boot')
    const seen = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0
    return b
      ? { state: b.getAttribute('data-state') || '', title: document.getElementById('boot-title').textContent, again: seen(document.getElementById('boot-again')), doc: seen(document.getElementById('boot-doc')), on: seen(document.getElementById('boot-on')), plain: seen(document.getElementById('boot-plain')) }
      : null
  })
const stalled = (page) =>
  page.evaluate(() => {
    const s = document.querySelector('.stalled')
    return s ? { title: s.querySelector('.stalled__title').textContent, say: s.querySelector('.stalled__say').textContent, buttons: [...s.querySelectorAll('.stalled__button')].map((b) => b.textContent.trim()) } : null
  })
const drawn = (page) => page.evaluate(() => !!document.querySelector('.ph, .dock') && !!document.querySelector('.os[data-booted]'))
/** Does `go`, and waits for the page it loads afresh: a new document, not a step in this one's history. (The
 * desktop writes its address half a second after it arrives, which is a navigation too, and not the one meant.) */
const afresh = async (page, go) => {
  await page.evaluate(() => { window.__before = true }).catch(() => {})
  await go()
  await page.waitForFunction(() => !window.__before && document.readyState === 'complete', null, { timeout: 15000 }).catch(() => {})
}

;(async () => {
  const browser = await A.launch()
  const start = async (device, routes, opts = {}) => {
    const t = await A.open(browser, { device, base: BASE, goto: false, ...opts })
    for (const [pattern, how] of routes) await t.page.route(pattern, (route) => (how === 'abort' ? route.abort() : how === 'hang' ? undefined : route.continue()))
    await t.page.goto(BASE + (opts.query ? '?' + opts.query : ''), { waitUntil: 'commit' })
    return t
  }

  for (const device of ['iphone', 'desktop']) {
    const half = device === 'iphone' ? '**/assets/Phone-*.js' : '**/assets/Surface-*.js'

    // 1. Everything arrives: the loading screen goes, the site is there
    let t = await start(device, [])
    await t.page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 15000 })
    check(`${device}: arrives, loading screen gone`, await drawn(t.page))
    check(`${device}: no errors`, A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
    await t.ctx.close()

    // 2. The half this screen shows does not arrive: a card, and another go works once it can
    t = await start(device, [[half, 'abort']])
    await t.page.waitForSelector('.stalled', { timeout: 15000 })
    await t.page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 5000 })
    let s = await stalled(t.page)
    check(`${device}: half missing -> card`, s && s.title === 'This didn’t load' && s.buttons.join() === 'Try Again,Read the one-pager', JSON.stringify(s))
    await t.page.screenshot({ path: path.join(OUT, `${device}-half-missing.png`) })
    // another go is the page afresh (once the site answers): still blocked, so the card again
    await afresh(t.page, () => t.page.click('.stalled__button--lead'))
    await t.page.waitForSelector('.stalled', { timeout: 15000 }).catch(() => {})
    check(`${device}: another go, still blocked -> card again`, !!(await stalled(t.page)))
    await t.page.unroute(half)
    await afresh(t.page, () => t.page.click('.stalled__button--lead'))
    await t.page.waitForFunction(() => !!document.querySelector('.ph, .dock') && !!document.querySelector('.os[data-booted]'), null, { timeout: 15000 }).catch(() => {})
    check(`${device}: another go, unblocked -> the site`, (await drawn(t.page)) && !(await stalled(t.page)))
    await t.ctx.close()

    // 3. Its stylesheet does not arrive
    t = await start(device, [[device === 'iphone' ? '**/assets/Phone-*.css' : '**/assets/Surface-*.css', 'abort']])
    await t.page.waitForTimeout(2500)
    let b = await boot(t.page)
    s = await stalled(t.page)
    check(`${device}: half's stylesheet missing -> a card of one kind or the other`, (b && b.state === 'failed') || !!s, JSON.stringify({ b, s }))
    await t.ctx.close()

    // 4. The first script does not arrive
    t = await start(device, [['**/assets/index-*.js', 'abort']])
    await t.page.waitForTimeout(1200)
    b = await boot(t.page)
    check(`${device}: first script missing -> "didn't load", plain version offered`, b && b.state === 'failed' && b.again && b.doc && b.plain, JSON.stringify(b))
    await t.page.screenshot({ path: path.join(OUT, `${device}-script-missing.png`) })
    await t.page.click('#boot-plain')
    await t.page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 3000 }).catch(() => {})
    const read = await t.page.evaluate(() => {
      const m = document.querySelector('#root > .plain')
      if (!m) return null
      const r = m.getBoundingClientRect()
      // The companies are the list under the line that counts them; an answer in the FAQs may hold a list of its own
      return { h1: m.querySelector('h1')?.textContent, quotes: m.querySelectorAll('blockquote').length, companies: m.querySelectorAll('.plain-more + ul > li').length, answers: m.querySelectorAll('h3').length, scrolls: m.scrollHeight > m.clientHeight, fills: r.width === innerWidth && r.height === innerHeight, note: !!m.querySelector('.plain-note') && getComputedStyle(m.querySelector('.plain-note')).display !== 'none' }
    })
    check(`${device}: the plain version reads`, read && read.h1 === 'Shrug' && read.quotes === 12 && read.companies === 79 && read.scrolls && read.fills, JSON.stringify(read))
    await t.page.screenshot({ path: path.join(OUT, `${device}-plain.png`) })
    await t.ctx.close()

    // 5. The first stylesheet does not arrive
    t = await start(device, [['**/assets/index-*.css', 'abort']])
    await t.page.waitForTimeout(2500)
    b = await boot(t.page)
    check(`${device}: first stylesheet missing -> "didn't load"`, b && b.state === 'failed' && b.again, JSON.stringify(b))
    await t.ctx.close()

    // 6. A browser too old to draw it: says so; once the site is up underneath, it can be carried on to
    t = await A.open(browser, { device, base: BASE, goto: false })
    await t.page.addInitScript(() => { CSS.supports = () => false })
    await t.page.goto(BASE, { waitUntil: 'commit' })
    await t.page.waitForFunction(() => document.getElementById('boot')?.hasAttribute('data-can'), null, { timeout: 15000 }).catch(() => {})
    b = await boot(t.page)
    check(`${device}: old browser -> says so, with a way on`, b && b.state === 'old' && b.doc && b.on && !b.again && !b.plain, JSON.stringify(b))
    await t.page.screenshot({ path: path.join(OUT, `${device}-old.png`) })
    await t.page.click('#boot-on')
    await t.page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 3000 }).catch(() => {})
    check(`${device}: old browser, carried on -> the site`, (await boot(t.page)) === null && (await drawn(t.page)))
    await t.ctx.close()

    // 7. The half hangs: still loading, with something to read after ten seconds
    t = await start(device, [[half, 'hang']])
    await t.page.waitForTimeout(10600)
    b = await boot(t.page)
    check(`${device}: half hangs -> "still loading" at 10s`, b && b.state === 'late' && b.doc && !b.again, JSON.stringify(b))
    await t.page.screenshot({ path: path.join(OUT, `${device}-late.png`) })
    await t.ctx.close()
  }

  // 8. The other half is asked for after the connection has gone (a window dragged narrow, a phone turned)
  let t = await start('desktop', [])
  await t.page.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.dock'), null, { timeout: 15000 })
  await t.ctx.setOffline(true)
  await t.page.setViewportSize({ width: 500, height: 800 })
  await t.page.waitForSelector('.stalled', { timeout: 15000 }).catch(() => {})
  let s = await stalled(t.page)
  check('desktop -> phone while offline: card', !!s, JSON.stringify(s))
  await t.page.screenshot({ path: path.join(OUT, 'offline-switch.png') })
  // back to the size that was already there: the desktop returns
  await t.page.setViewportSize({ width: 1440, height: 900 })
  await t.page.waitForTimeout(500)
  check('back to the desktop while offline: the desktop', !!(await t.page.$('.dock')) && !(await stalled(t.page)), 'dock ' + !!(await t.page.$('.dock')) + ' stalled ' + !!(await stalled(t.page)))
  await t.page.setViewportSize({ width: 500, height: 800 })
  await t.page.waitForSelector('.stalled', { timeout: 15000 }).catch(() => {})
  // a go while still offline: stays on the card, never the browser's own error page
  await t.page.click('.stalled__button--lead')
  await t.page.waitForTimeout(800)
  s = await stalled(t.page)
  check('another go while offline: still the card', !!s && t.page.url().startsWith(BASE), JSON.stringify(s))
  await t.ctx.setOffline(false)
  await afresh(t.page, () => t.page.evaluate(() => window.dispatchEvent(new Event('online'))).catch(() => {}))
  await t.page.waitForSelector('.ph', { timeout: 15000 }).catch(() => {})
  check('back online: the phone arrives without being asked', !!(await t.page.$('.ph')) && !(await stalled(t.page)))
  check('no page errors beyond the fetch that failed', A.realErrors(t.errors).filter((e) => !/requestfailed|Failed to (fetch|load)|ERR_INTERNET_DISCONNECTED|dynamically imported|Unable to preload/i.test(e)).length === 0, A.realErrors(t.errors).join(' | ').slice(0, 400))
  await t.ctx.close()

  // 8b. Left open a while first: the other half is already to hand, connection or none
  for (const [from, to, want] of [['desktop', { width: 500, height: 800 }, '.ph'], ['ipadmini', { width: 1133, height: 744 }, '.dock']]) {
    t = await start(from, [])
    await t.page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 15000 })
    await t.page.waitForTimeout(7500)
    await t.ctx.setOffline(true)
    await t.page.setViewportSize(to)
    await t.page.waitForSelector(want, { timeout: 8000 }).catch(() => {})
    check(`${from}, a while later and offline -> the other half is there`, !!(await t.page.$(want)) && !(await stalled(t.page)))
    await t.ctx.close()
  }
  // a phone never fetches the desktop
  t = await start('iphone', [])
  const asked = []
  t.page.on('request', (r) => asked.push(r.url()))
  await t.page.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 15000 })
  await t.page.waitForTimeout(7500)
  check('a phone never fetches the desktop', !asked.some((u) => /Surface-/.test(u)), asked.filter((u) => /Surface-/.test(u)).join())
  await t.ctx.close()

  // 8c. A browser too old to run the script at all: the plain version is what there is
  t = await A.open(browser, { device: 'iphone', base: BASE, goto: false })
  await t.page.addInitScript(() => { CSS.supports = () => false })
  await t.page.route('**/assets/index-*.js', (route) => route.fulfill({ contentType: 'text/javascript', body: 'this is ) not javascript {' }))
  await t.page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await t.page.waitForTimeout(800)
  let ob = await boot(t.page)
  check('old browser, script cannot run -> says so, plain version offered', ob && ob.state === 'old' && ob.doc && ob.plain && !ob.on, JSON.stringify(ob))
  await t.page.screenshot({ path: path.join(OUT, 'old-dead.png') })
  await t.ctx.close()

  // 8d. An address the site does not have
  for (const [asked, lands] of [['portfolio', '?open=portfolio'], ['FAQs/', '?open=faqs'], ['nothing/here', '']]) {
    t = await A.open(browser, { device: 'iphone', base: BASE, goto: false })
    const res = await t.page.goto(BASE + '404.html').catch(() => null)
    // as a host would serve it: the wrong address, answered with 404.html
    await t.page.route('**/' + asked, async (route) => route.fulfill({ status: 404, contentType: 'text/html', body: require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'dist', '404.html'), 'utf8') }))
    await t.page.goto(BASE + asked).catch(() => {})
    await t.page.waitForFunction(() => !!document.querySelector('.os[data-booted]'), null, { timeout: 15000 }).catch(() => {})
    const url = t.page.url().replace(BASE, '')
    check(`/${asked} -> /${lands}`, url === lands, url)
    await t.ctx.close()
  }

  // 9. No scripts at all
  t = await A.open(browser, { device: 'iphone', base: BASE, js: false })
  const plain = await t.page.evaluate(() => {
    const n = document.querySelector('noscript')
    return { boot: !!document.querySelector('#boot:not([hidden])'), text: document.body.innerText.trim().slice(0, 400) }
  })
  check('no scripts: the plain version, saying why', !plain.boot && /JavaScript/.test(plain.text) && /one-pager/.test(plain.text) && /venture fund/.test(plain.text), JSON.stringify(plain))
  await t.page.screenshot({ path: path.join(OUT, 'no-js.png') })
  await t.ctx.close()

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})()
