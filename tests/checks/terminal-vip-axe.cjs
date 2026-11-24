// axe over fixer T's screens on both layouts: node terminal-vip-axe.cjs [base]
// The terminal; where VIP is (a link in the phone's Dock and in its Drops conversation; on the desktop the VIP
// Store's window, its bar and the store's own pages in its frame, and the ways to it); and the two windows laid
// out with the classes VIP's old window had, Wallpapers and Updates, with Preview, where a document opens.
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
/** The same over a page held in a frame (the store's, in its window): axe is put into the frame itself. */
const runIn = async (frame, name) => {
  await frame.addScriptTag({ path: AXE }).catch(() => {})
  const res = await frame.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] })
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ').slice(0, 90) + ' :: ' + (n.any[0]?.message || n.none[0]?.message || '').slice(0, 110)) }))
  })
  if (res.length) bad += res.length
  console.log((res.length ? 'FAIL ' : 'ok   ') + name + (res.length ? '  ' + JSON.stringify(res) : ''))
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
  await run(p, 'desktop Dock, VIP Store in it', '.dock')
  await p.locator('.wf[data-app="terminal"] .term__input').click()
  // (`open vip` is last: it opens the store's window, which takes the keyboard with it)
  for (const text of ['y', 'help', 'nonsense', 'n', 'open vip']) { await p.keyboard.type(text); await p.keyboard.press('Enter') }
  await p.waitForTimeout(300)
  await run(p, 'desktop terminal, used', '.wf[data-app="terminal"]')
  // The store's window, opened by the terminal: its bar, and the store's pages in its frame
  const shop = p.frameLocator('.wf[data-app="store"] iframe.storewin__frame')
  await shop.locator('.ui-prod').first().waitFor({ timeout: 20000 }); await p.waitForTimeout(400)
  const inside = () => p.frames().find((f) => /\/vip\//.test(f.url()))
  await run(p, 'desktop VIP Store, the window and its bar', '.wf[data-app="store"]')
  await runIn(inside(), 'desktop VIP Store, the store\'s front in its frame')
  await shop.locator('.ui-prod').first().click(); await shop.locator('.ui-col .ui-btn').first().waitFor({ timeout: 20000 }); await p.waitForTimeout(400)
  await runIn(inside(), 'desktop VIP Store, a product')
  await p.locator('.wf[data-app="store"] .storebar__seg button', { hasText: 'My VIP' }).click(); await p.waitForTimeout(700)
  await runIn(inside(), 'desktop VIP Store, My VIP for a visitor')
  await run(p, 'desktop VIP Store, the bar with My VIP picked', '.wf[data-app="store"]')
  await p.click('[data-menu-title="go"]'); await p.waitForTimeout(300)
  await run(p, 'desktop Go menu, VIP Store in it', '[data-menu="go"]')
  await p.keyboard.press('Escape'); await p.waitForTimeout(200)
  await p.click('[data-dock-app="messages"]'); await p.waitForTimeout(500)
  await p.locator('.wf[data-app="messages"] [data-conversation="drops"]').click(); await p.waitForTimeout(500)
  await run(p, 'desktop, the Drops conversation and its way to the VIP Store', '.wf[data-app="messages"]')
  await t.ctx.close()
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty&open=about', reducedMotion: true })
  p = t.page
  await arrived(p); await p.waitForTimeout(1500)
  await run(p, 'desktop About Shrug, its Drops row', '.wf[data-app="about"]')
  await t.ctx.close()
  // Mail: its inbox, a conversation, the command palette, the sheet of its keys, and Inbox Zero
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty&open=mail', reducedMotion: true })
  p = t.page
  await arrived(p); await p.waitForSelector('.wf[data-app="mail"] .ml-row', { timeout: 15000 }); await p.waitForTimeout(800)
  await run(p, 'desktop Mail, the inbox', '.wf[data-app="mail"]')
  await p.locator('.wf[data-app="mail"] .ml').focus()
  await p.keyboard.press('Enter'); await p.waitForTimeout(400)
  await run(p, 'desktop Mail, a conversation', '.wf[data-app="mail"]')
  await p.keyboard.press('Control+k'); await p.waitForTimeout(400)
  await run(p, 'desktop Mail, the command palette', '.wf[data-app="mail"]')
  await p.keyboard.press('Escape'); await p.keyboard.press('?'); await p.waitForTimeout(400)
  await run(p, 'desktop Mail, the sheet of its keys', '.wf[data-app="mail"]')
  await p.keyboard.press('Escape'); await p.keyboard.press('Control+Shift+E'); await p.waitForTimeout(500)
  await run(p, 'desktop Mail, Inbox Zero', '.wf[data-app="mail"]')
  await t.ctx.close()
  // The windows laid out with VIP's classes
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty&open=wallpapers,updates', reducedMotion: true })
  p = t.page
  await arrived(p); await p.waitForTimeout(1500)
  await run(p, 'desktop Updates, locked', '.wf[data-app="updates"]')
  await p.locator('.menubar__login').click(); await p.locator('.account input[type=email]').fill('lp@example.test'); await p.keyboard.press('Enter'); await p.waitForTimeout(900)
  await p.keyboard.type('246810'); await p.waitForTimeout(2000); await p.keyboard.press('Escape'); await p.waitForTimeout(400)
  await run(p, 'desktop Updates, its documents', '.wf[data-app="updates"]')
  // A document, opened: Preview, with a private document's pages; the same in full screen; and one that is not theirs
  await p.locator('.wf[data-app="updates"] .upd-row[data-doc="update-2"] button').click()
  await p.waitForSelector('.wf[data-app="preview"] .pv-canvas[data-drawn]', { timeout: 30000 }); await p.waitForTimeout(500)
  await run(p, 'desktop Updates, a row picked', '.wf[data-app="updates"]')
  await run(p, 'desktop Preview, a private document', '.wf[data-app="preview"]')
  await p.locator('.wf[data-app="preview"] .pvbar button[aria-label="Full Screen"]').click(); await p.waitForTimeout(600)
  await run(p, 'desktop Preview, full screen', '.pv-full')
  await p.keyboard.press('Escape'); await p.waitForTimeout(400)
  // (the row is behind Preview's window by now: it is opened as two clicks on it would open it)
  await p.evaluate(() => document.querySelector('.wf[data-app="updates"] .upd-row[data-doc="update-3"]').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))); await p.waitForTimeout(700)
  await run(p, 'desktop Preview, a document that is not theirs', '.wf[data-app="preview"]')
  await p.evaluate(() => document.querySelector('[data-desk="one-pager"]').click()); await p.waitForSelector('.wf[data-app="preview"] .pv-pages .op', { timeout: 15000 }); await p.waitForTimeout(500)
  await run(p, 'desktop Preview, the one-pager', '.wf[data-app="preview"]')
  await run(p, 'desktop Dock, Preview in it after the rule', '.dock')
  await p.locator('.wf[data-app="preview"] button[aria-label^="Close"]').click(); await p.waitForTimeout(500)
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
