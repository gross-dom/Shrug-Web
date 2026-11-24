// axe over fixer T's screens on both layouts: node terminal-vip-axe.cjs [base]
// The terminal; where VIP is (a link in each layout's Dock, in About Shrug and in the Drops conversation); and the
// two windows laid out with the classes VIP's window had, Wallpapers and Updates.
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
;(async () => {
  const browser = await A.launch()
  // ---- phone
  let t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still&open=case-studies', reducedMotion: true })
  let p = t.page
  await arrived(p); await p.waitForTimeout(1200)
  const front = '.sb-slot[data-front]'
  await run(p, 'phone terminal, question waiting', front)
  await p.locator(front + ' .term-ios-key', { hasText: /^y$/ }).tap(); await p.waitForTimeout(500)
  await run(p, 'phone terminal, after y', front)
  await p.locator(front + ' .term-ios-key', { hasText: 'help' }).tap(); await p.waitForTimeout(300)
  await run(p, 'phone terminal, after help', front)
  await p.locator(front + ' .term__input').fill('open vip'); await p.locator(front + ' .term__input').press('Enter'); await p.waitForTimeout(500)
  await run(p, 'phone terminal, the link to VIP handed over', front)
  await A.at(p, 'messages', ['c:drops']); await run(p, 'phone, the Drops conversation and its link to VIP', front)
  await A.at(p, null, []); await run(p, 'phone Home Screen, VIP in its Dock', '.sb-home')
  await t.ctx.close()
  // ---- desktop
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&open=case-studies', reducedMotion: true })
  p = t.page
  await arrived(p); await p.waitForTimeout(1500)
  await run(p, 'desktop Dock, VIP a link in it', '.dock')
  await p.locator('.wf[data-app="terminal"] .term__input').click()
  for (const text of ['y', 'help', 'nonsense', 'open vip', 'n']) { await p.keyboard.type(text); await p.keyboard.press('Enter') }
  await p.waitForTimeout(300)
  await run(p, 'desktop terminal, used', '.wf[data-app="terminal"]')
  await p.click('[data-menu-title="go"]'); await p.waitForTimeout(300)
  await run(p, 'desktop Go menu, VIP a link in it', '[data-menu="go"]')
  await p.keyboard.press('Escape'); await p.waitForTimeout(200)
  await p.click('[data-dock-app="messages"]'); await p.waitForTimeout(500)
  await p.locator('.wf[data-app="messages"] [data-conversation="drops"]').click(); await p.waitForTimeout(500)
  await run(p, 'desktop, the Drops conversation and its link to VIP', '.wf[data-app="messages"]')
  await t.ctx.close()
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty&open=about', reducedMotion: true })
  p = t.page
  await arrived(p); await p.waitForTimeout(1500)
  await run(p, 'desktop About Shrug, its Drops row a link', '.wf[data-app="about"]')
  await t.ctx.close()
  // The windows laid out with VIP's classes
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty&open=wallpapers,updates', reducedMotion: true })
  p = t.page
  await arrived(p); await p.waitForTimeout(1500)
  await run(p, 'desktop Updates, locked', '.wf[data-app="updates"]')
  await p.locator('.menubar__login').click(); await p.locator('.account input[type=email]').fill('lp@example.test'); await p.keyboard.press('Enter'); await p.waitForTimeout(900)
  await p.keyboard.type('246810'); await p.waitForTimeout(2000); await p.keyboard.press('Escape'); await p.waitForTimeout(400)
  await run(p, 'desktop Updates, its documents', '.wf[data-app="updates"]')
  await p.locator('.wf[data-app="wallpapers"] .ss-window__bar').click({ position: { x: 200, y: 12 } }).catch(() => {}); await p.waitForTimeout(400)
  await run(p, 'desktop Wallpapers', '.wf[data-app="wallpapers"]')
  await p.locator('.wf[data-app="wallpapers"] .walls-tile').first().click(); await p.waitForTimeout(700)
  await run(p, 'desktop Wallpapers, one open large', '.wf[data-app="wallpapers"]')
  await t.ctx.close()
  t = await A.open(browser, { device: 'ipad-land', base: BASE, query: 'still&open=wallpapers,case-studies', reducedMotion: true })
  p = t.page
  await arrived(p); await p.waitForTimeout(1500)
  await run(p, 'desktop (touch) terminal with its keys', '.wf[data-app="terminal"]')
  await run(p, 'desktop (touch) Wallpapers', '.wf[data-app="wallpapers"]')
  await run(p, 'desktop (touch) Dock, VIP a link in it', '.dock')
  await t.ctx.close()
  await browser.close()
  console.log(bad ? `${bad} violations` : 'no violations')
  process.exit(bad ? 1 : 0)
})()
