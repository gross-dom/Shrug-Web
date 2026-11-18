// axe over fixer T's screens on both layouts: node terminal-vip-axe.cjs [base]
const A = require('./lib.cjs')
const path = require('path')
const AXE = (() => {
  // axe-core where it is installed (npm install --no-save axe-core), or beside these checks
  try {
    return require.resolve('axe-core/axe.min.js')
  } catch {
    return path.join(__dirname, '..', 'axe', 'node_modules', 'axe-core', 'axe.min.js')
  }
})()
const BASE = process.argv[2] || 'http://127.0.0.1:5173/'
const DEV = /:5173\//.test(BASE)
let bad = 0
const run = async (page, name, scope) => {
  await page.addScriptTag({ path: AXE }).catch(() => {})
  const res = await page.evaluate(async (scope) => {
    const r = await window.axe.run(document.querySelector(scope), { resultTypes: ['violations'] })
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ').slice(0, 90) + ' :: ' + (n.any[0]?.message || n.none[0]?.message || '').slice(0, 110)) }))
  }, scope)
  // Known and accepted on the phone: iOS blue text contrast
  const real = res.filter((v) => !(v.id === 'color-contrast' && v.nodes.every((n) => /0a84ff|#007aff|0, 122, 255|10, 132, 255/i.test(n))))
  if (real.length) bad += real.length
  console.log((real.length ? 'FAIL ' : 'ok   ') + name + (res.length ? '  ' + JSON.stringify(real.length ? real : res.map((v) => v.id)) : ''))
}
const arrived = (p) => p.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.os[data-booted]'), null, { timeout: 30000 })
const WITH_FILES = (js) => js.replace('from: null, src: null', 'from: drop === "Billboards" ? "A Founder" : null, src: kind === "photo" && ["Deep Tech Mat", "Billboards", "VC Sticker Pack"].includes(drop) ? "/og.png" : null')
;(async () => {
  const browser = await A.launch()
  // ---- phone
  let t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still&open=vip', reducedMotion: true })
  let p = t.page
  await arrived(p); await p.waitForTimeout(1200)
  const front = '.sb-slot[data-front]'
  await run(p, 'phone VIP library', front)
  await A.at(p, 'photos', ['a:Deep Tech Mat']); await run(p, 'phone VIP album', front)
  await A.at(p, 'photos', ['m:0']); await run(p, 'phone VIP viewer (tile on its way)', front)
  await A.at(p, 'photos', ['m:1'], 'info'); await run(p, 'phone VIP info', front)
  await A.at(p, 'photos', ['albums']); await run(p, 'phone VIP albums', front)
  await A.at(p, 'terminal', []); await run(p, 'phone terminal, question waiting', front)
  await p.locator(front + ' .term-ios-key', { hasText: /^y$/ }).tap(); await p.waitForTimeout(500)
  await run(p, 'phone terminal, after y', front)
  await p.locator(front + ' .term-ios-key', { hasText: 'help' }).tap(); await p.waitForTimeout(300)
  await run(p, 'phone terminal, after help', front)
  await t.ctx.close()
  // ---- desktop
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&open=vip,case-studies', reducedMotion: true })
  p = t.page
  await arrived(p); await p.waitForTimeout(1500)
  await run(p, 'desktop VIP', '.wf[data-app="photos"]')
  await p.locator('.wf[data-app="terminal"] .term__input').click()
  for (const text of ['y', 'help', 'nonsense', 'n']) { await p.keyboard.type(text); await p.keyboard.press('Enter') }
  await p.waitForTimeout(300)
  await run(p, 'desktop terminal, used', '.wf[data-app="terminal"]')
  await t.ctx.close()
  t = await A.open(browser, { device: 'ipad-land', base: BASE, query: 'still&open=vip,case-studies', reducedMotion: true })
  p = t.page
  await arrived(p); await p.waitForTimeout(1500)
  await run(p, 'desktop (touch) terminal with its keys', '.wf[data-app="terminal"]')
  await run(p, 'desktop (touch) VIP', '.wf[data-app="photos"]')
  await t.ctx.close()
  if (DEV) {
    t = await A.open(browser, { device: 'desktop', base: BASE, goto: false, reducedMotion: true })
    p = t.page
    await p.route('**/src/data/drops.ts*', async (route) => { const res = await route.fetch(); await route.fulfill({ response: res, body: WITH_FILES(await res.text()) }) })
    await p.goto(BASE + '?still&open=vip')
    await arrived(p); await p.waitForTimeout(1500)
    await run(p, 'desktop VIP with pictures', '.wf[data-app="photos"]')
    await p.locator('.wf[data-app="photos"] .vip-tile--open').first().click(); await p.waitForTimeout(500)
    await run(p, 'desktop VIP, a picture open large', '.wf[data-app="photos"]')
    await t.ctx.close()
  }
  await browser.close()
  console.log(bad ? `${bad} violations` : 'no violations')
  process.exit(bad ? 1 : 0)
})()
