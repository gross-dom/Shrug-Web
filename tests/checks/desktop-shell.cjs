// The desktop shell's fixes, checked: the screen saver, windows, the menu bar, the Dock, the desk's icons.
//   node desktop-shell.cjs [base] [only: saver|windows|touch|menus|keys]
// Exits non-zero if any check fails.
const { A, mid, tap, tapAt, swipe, press, windows, win, until, pick, openMenu, menuItem } = require('./touch-kit.cjs')
const path = require('path')
const BASE = process.argv[2] || process.env.BASE || 'http://127.0.0.1:5173/'
const only = process.argv[3]
const OUT = A.OUT
require('fs').mkdirSync(OUT, { recursive: true })

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + String(detail).slice(0, 360) : ''))
}

let browser
const fresh = async (device, query = 'still', opts = {}) => {
  const t = await A.open(browser, { device, base: BASE, query, ...opts })
  await t.page.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.os[data-booted]'), null, { timeout: 30000 })
  await t.page.waitForTimeout(opts.settle ?? 900)
  return t
}
const saverOn = (page) => page.evaluate(() => !!document.querySelector('.saver')?.hasAttribute('data-on'))
const focusIs = (page) =>
  page.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body) return 'BODY'
    const w = el.closest('.wf')
    return (w ? `wf:${w.dataset.app}` : el.closest('.dock') ? `dock:${el.dataset.dockApp ?? 'link'}` : el.closest('.menubar') ? `menubar:${el.dataset.menuTitle ?? 'item'}` : el.closest('.desk') ? 'desk' : el.classList.contains('saver') ? 'saver' : el.tagName) + (el.closest('[inert]') ? ' (inert)' : '')
  })
const rects = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.wf[data-open]')].map((w) => { const r = w.getBoundingClientRect(); return [w.dataset.app, [r.x, r.y, r.width, r.height].map(Math.round).join(',')] })))
/** Chooses a menu item with the mouse. */
const choose = async (page, menu, label) => {
  await page.click(`[data-menu-title="${menu}"]`)
  await page.waitForTimeout(260)
  const item = page.locator(`[data-menu="${menu}"] [data-menu-item]`, { hasText: label }).first()
  await item.click()
  await page.waitForTimeout(350)
}
/** Chooses a menu item with the keyboard: the title focused, Enter, arrows to the item, Enter. */
const chooseByKeys = async (page, menu, label) => {
  await page.focus(`[data-menu-title="${menu}"]`)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(260)
  for (let i = 0; i < 20; i++) {
    const at = await page.evaluate(() => document.activeElement?.textContent?.trim())
    if (at === label) break
    await page.keyboard.press('ArrowDown')
  }
  await page.keyboard.press('Enter')
  await page.waitForTimeout(450)
}

const parts = {
  // ---- The screen saver ----
  async saver() {
    // Any key wakes it, and that key does nothing else
    for (const k of ['a', 'Shift', 'Enter', 'Space', 'Escape', 'Tab', 'ArrowDown']) {
      const t = await fresh('desktop', 'still&saver', { settle: 1300 })
      const before = await saverOn(t.page)
      await t.page.keyboard.press(k)
      await t.page.waitForTimeout(250)
      const typed = await t.page.evaluate(() => [...document.querySelectorAll('.wf input, .wf textarea')].map((f) => f.value).join(''))
      check(`saver: "${k}" wakes it and does nothing else`, before && !(await saverOn(t.page)) && typed === '', `before ${before}, typed "${typed}"`)
      await t.ctx.close()
    }
    let t = await fresh('desktop', 'still&saver', { settle: 1300 })
    await t.page.keyboard.press('Control+b')
    await t.page.keyboard.press('Alt+b')
    await t.page.waitForTimeout(200)
    check('saver: a key held with Ctrl or Alt is left alone (it stays on)', await saverOn(t.page))
    const state = await t.page.evaluate(() => {
      const s = document.querySelector('.saver')
      return { role: s.getAttribute('role'), name: s.getAttribute('aria-label'), desk: document.querySelector('.os__desk')?.hasAttribute('inert'), focus: document.activeElement === s, time: s.querySelector('.saver__time').textContent, said: s.querySelector('.saver__said')?.textContent ?? null, hint: s.querySelector('.saver__hint').textContent, hintOpacity: getComputedStyle(s.querySelector('.saver__hint')).opacity, title: document.title }
    })
    check('saver: a dialog with a name, holding the keyboard, the desk inert under it', state.role === 'dialog' && state.name === 'Screen saver' && state.desk === true && state.focus, JSON.stringify(state))
    check('saver: the clock has no AM or PM', /^\d{1,2}:\d{2}$/.test(state.time), state.time)
    check('saver: shows what the person said', !!state.said && state.said.length > 10, state.said)
    check('saver: hint for a mouse and keys, at 60%', state.hint === 'Move, click or press a key to wake' && state.hintOpacity === '0.6', state.hint + ' ' + state.hintOpacity)
    check('saver: the title is the site\'s own while it is on', state.title === 'Shrug', state.title)
    await t.page.screenshot({ path: path.join(OUT, 'saver-on.png') })
    await t.ctx.close()

    // Started from the menu with the keyboard, woken with a key: the keyboard is somewhere real
    t = await fresh('desktop', 'still')
    await chooseByKeys(t.page, 'mark', 'Start Screen Saver')
    await t.page.waitForTimeout(700)
    const started = await saverOn(t.page)
    await t.page.keyboard.press('a')
    await t.page.waitForTimeout(400)
    const after = await focusIs(t.page)
    check('saver: from the menu by keyboard, then a key -> awake, focus in the window in front', started && !(await saverOn(t.page)) && after === 'wf:messages', `started ${started}, focus ${after}`)
    check('…and the desk is live again', !(await t.page.evaluate(() => document.querySelector('.os__desk').hasAttribute('inert'))))
    await t.ctx.close()

    // It waits for the conversation: not on while replies arrive; on once they are paused and the desk is still
    t = await fresh('desktop', 'idle=4', { settle: 0 })
    await t.page.waitForTimeout(11000)
    const mid1 = { on: await saverOn(t.page), replies: await t.page.evaluate(() => document.querySelectorAll('.chat__thread [data-person]:not([data-typing])').length) }
    check('saver: with a 4s wait, still off 11s in while the conversation arrives', !mid1.on, JSON.stringify(mid1))
    await choose(t.page, 'mark', 'Pause Replies')
    await t.page.mouse.move(700, 500)
    await t.page.waitForTimeout(6500)
    check('…and on once the replies are paused and nothing has moved for the wait', await saverOn(t.page))
    await t.ctx.close()

    // Never, chosen from the menu, is kept; ?idle still wins
    t = await fresh('desktop', 'still')
    const radios = async () => t.page.evaluate(() => [...document.querySelectorAll('[data-menu="mark"] [role="menuitemradio"]')].map((r) => `${r.getAttribute('aria-label')}=${r.getAttribute('aria-checked')}`).join(' | '))
    const first = await radios()
    await choose(t.page, 'mark', 'Never')
    const kept = await t.page.evaluate(() => { try { return localStorage.getItem('shrug:saver') } catch { return 'no storage' } })
    await t.page.reload()
    await t.page.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.os[data-booted]'))
    await t.page.waitForTimeout(600)
    const second = await radios()
    check('saver: the mark\'s menu offers After 2½ Minutes / Never, and Never is kept', /After 2½ Minutes=true/.test(first) && /Never=false/.test(first) && kept === 'never' && /Never=true/.test(second), `${first} -> ${kept} -> ${second}`)
    await t.page.goto(BASE + '?still&idle=3')
    await t.page.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.os[data-booted]'))
    await choose(t.page, 'mark', 'Pause Replies')
    await t.page.waitForTimeout(4600)
    check('saver: ?idle= still starts it, whatever was chosen', await saverOn(t.page), await radios())
    await t.ctx.close()
  },

  // ---- Windows ----
  async windows() {
    // Shrink and grow back: windows return to where they were put
    let t = await fresh('desktop', 'still&open=portfolio,faqs')
    await t.page.waitForTimeout(700)
    const drag = async (id, dx, dy) => {
      const b = await t.page.evaluate((id) => { const r = document.querySelector(`.wf[data-app="${id}"] .ss-window__bar, .wf[data-app="${id}"] .ss-window__side-top`).getBoundingClientRect(); return { x: r.x + r.width - 30, y: r.y + 8 } }, id)
      await t.page.mouse.move(b.x, b.y)
      await t.page.mouse.down()
      await t.page.mouse.move(b.x + dx, b.y + dy, { steps: 6 })
      await t.page.mouse.up()
      await t.page.waitForTimeout(200)
    }
    await drag('notes', 240, 170)
    await drag('finder', 180, 120)
    const before = await rects(t.page)
    await t.page.setViewportSize({ width: 760, height: 480 })
    await t.page.waitForTimeout(500)
    const small = await t.page.evaluate(() => [...document.querySelectorAll('.wf[data-open]')].every((w) => { const r = w.getBoundingClientRect(); return r.left >= 0 && r.top >= 28 && r.right <= innerWidth && r.bottom <= innerHeight - 82 + 1 }))
    await t.page.setViewportSize({ width: 1440, height: 900 })
    await t.page.waitForTimeout(500)
    const back = await rects(t.page)
    check('windows: all on the desk when the browser shrinks', small, JSON.stringify(before))
    check('windows: back where they were put when it grows again', JSON.stringify(before) === JSON.stringify(back), JSON.stringify(before) + ' -> ' + JSON.stringify(back))
    await t.ctx.close()

    // Small desks: a margin all round
    for (const [w, h] of [[760, 600], [900, 480], [853, 480], [1024, 576], [1280, 500]]) {
      t = await fresh({ w, h, dpr: 1 }, 'still&open=portfolio,faqs,case-studies,vip,settings')
      await t.page.waitForTimeout(600)
      const tight = await t.page.evaluate(() => [...document.querySelectorAll('.wf[data-open]')].map((el) => { const r = el.getBoundingClientRect(); return { id: el.dataset.app, l: Math.round(r.left), t: Math.round(r.top - 28), r: Math.round(innerWidth - r.right), b: Math.round(innerHeight - 82 - r.bottom) } }).filter((m) => m.l < 8 || m.t < 8 || m.r < 8 || m.b < 8))
      check(`windows: at ${w}x${h} every window opens at least 8px from each edge`, tight.length === 0, JSON.stringify(tight))
      if (w === 760) await t.page.screenshot({ path: path.join(OUT, 'small-760x600.png') })
      await t.ctx.close()
    }

    // A big desk: a new window lands beside what is open, not on the same pile
    for (const device of ['fhd', 'ultrawide', 'uhd']) {
      t = await fresh(device, 'still')
      const open = async (id) => { await t.page.click(`[data-dock-app="${id}"]`); await t.page.waitForTimeout(650) }
      await open('finder')
      await open('photos')
      const r = await t.page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.wf[data-open]')].map((w) => { const b = w.getBoundingClientRect(); return [w.dataset.app, { x: b.x, y: b.y, w: b.width, h: b.height }] })))
      const shared = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
      const worst = Math.max(shared(r.finder, r.messages) / (r.finder.w * r.finder.h), shared(r.photos, r.messages) / (r.photos.w * r.photos.h), shared(r.photos, r.finder) / (r.photos.w * r.photos.h))
      check(`windows: on ${device} no new window opens on the same pile (at most 72% of it over another; they used to be 90% and more)`, worst <= 0.72, `worst overlap ${(worst * 100).toFixed(0)}% ` + JSON.stringify(await rects(t.page)))
      if (device === 'fhd') await t.page.screenshot({ path: path.join(OUT, 'big-fhd.png') })
      await t.ctx.close()
    }
    // A laptop keeps its nudged pile, wholly on the desk
    t = await fresh('laptop', 'still&open=portfolio,faqs,vip')
    await t.page.waitForTimeout(500)
    check('windows: on a laptop all open on the desk', await t.page.evaluate(() => [...document.querySelectorAll('.wf[data-open]')].every((w) => { const r = w.getBoundingClientRect(); return r.left >= 8 && r.top >= 36 && r.right <= innerWidth - 8 && r.bottom <= innerHeight - 90 })), JSON.stringify(await rects(t.page)))
    await t.ctx.close()

    // Alt and the arrows move the window in front; with Shift they size it
    t = await fresh('desktop', 'still')
    await t.page.evaluate(() => document.querySelector('.wf[data-app="messages"]').focus())
    const a = (await rects(t.page)).messages
    await t.page.keyboard.press('Alt+ArrowRight')
    await t.page.keyboard.press('Alt+ArrowDown')
    const b = (await rects(t.page)).messages
    await t.page.keyboard.press('Alt+Shift+ArrowLeft')
    await t.page.keyboard.press('Alt+Shift+ArrowUp')
    const c = (await rects(t.page)).messages
    const [ax, ay, aw, ah] = a.split(',').map(Number), [bx, by, bw, bh] = b.split(',').map(Number), [cx, cy, cw, ch] = c.split(',').map(Number)
    check('keys: Alt+arrows move the window, Alt+Shift+arrows size it', bx === ax + 24 && by === ay + 24 && bw === aw && cw === bw - 24 && ch === bh - 24 && cx === bx && cy === by, `${a} -> ${b} -> ${c}`)
    await t.ctx.close()
  },

  // ---- A finger ----
  async touch() {
    // The waking tap presses nothing under it
    let t = await fresh('ipad-land', 'still&idle=3', { settle: 300 })
    const light = await mid(t.page, '.wf[data-app="messages"] .wf__light[data-kind="close"]')
    await choosePause(t)
    await until(t.page, () => !!document.querySelector('.saver')?.hasAttribute('data-on'), null, 9000)
    await t.page.waitForTimeout(700)
    const wasOn = await saverOn(t.page)
    const hint = await t.page.evaluate(() => document.querySelector('.saver__hint').textContent)
    await tapAt(t.page, light.x, light.y)
    await t.page.waitForTimeout(700)
    const w1 = await win(t.page, 'messages')
    check('touch: the tap that wakes the saver does not close the window under it', wasOn && !(await saverOn(t.page)) && w1.open, `on before ${wasOn}, messages open ${w1.open}`)
    check('touch: the saver says "Tap to wake"', hint === 'Tap to wake', hint)
    await until(t.page, () => !!document.querySelector('.saver')?.hasAttribute('data-on'), null, 9000)
    await t.page.waitForTimeout(700)
    const dockIcon = await mid(t.page, '[data-dock-app="terminal"]')
    await tapAt(t.page, dockIcon.x, dockIcon.y)
    await t.page.waitForTimeout(700)
    check('touch: nor does it open the app whose icon was under it', !(await saverOn(t.page)) && !!!(await win(t.page, 'terminal'))?.open)
    // the next tap is an ordinary one
    await tapAt(t.page, dockIcon.x, dockIcon.y)
    await t.page.waitForTimeout(700)
    check('touch: the tap after that is an ordinary tap', !!(await win(t.page, 'terminal'))?.open)
    await t.ctx.close()

    // Sizes for a finger
    t = await fresh('ipad-land', 'still')
    const sizes = await t.page.evaluate(() => {
      const box = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] }
      const hit = (sel) => { const el = document.querySelector(sel); const r = el.getBoundingClientRect(); const s = getComputedStyle(el, '::after'); return [Math.round(r.width - parseFloat(s.left) - parseFloat(s.right)), Math.round(r.height - parseFloat(s.top) - parseFloat(s.bottom))] }
      return { light: box('.wf__light'), lightHit: hit('.wf__light'), e: box('.wf__grip[data-edge="e"]'), s: box('.wf__grip[data-edge="s"]'), se: box('.wf__grip[data-edge="se"]'), titleHit: hit('.menubar__title'), touchAction: getComputedStyle(document.querySelector('.os__windows')).touchAction }
    })
    check('touch: lights 18px with a 44px-tall press; grips 24px bands and 44px corners; menu titles 30px or more to press', sizes.light.join() === '18,18' && sizes.lightHit[1] >= 44 && sizes.e[0] === 24 && sizes.s[1] === 24 && sizes.se.join() === '44,44' && sizes.titleHit[1] >= 30, JSON.stringify(sizes))
    check('touch: a double tap is never a zoom (touch-action: manipulation)', sizes.touchAction === 'manipulation', sizes.touchAction)
    await openMenu(t.page, 'window')
    const row = await t.page.evaluate(() => Math.round(document.querySelector('[data-menu="window"] [data-menu-item]').getBoundingClientRect().height))
    check('touch: menu rows are 38px', row === 38, row)
    await t.page.screenshot({ path: path.join(OUT, 'touch-menu.png') })
    // a tap elsewhere puts the menu away and does nothing else
    const vip = await mid(t.page, '[data-dock-app="photos"]')
    await tapAt(t.page, vip.x, vip.y)
    await t.page.waitForTimeout(600)
    const afterTap = { menu: await t.page.evaluate(() => document.querySelector('.menubar').hasAttribute('data-open')), vip: !!(await win(t.page, 'photos'))?.open }
    check('touch: with a menu open, a tap elsewhere closes it and presses nothing', !afterTap.menu && !afterTap.vip, JSON.stringify(afterTap))
    await tapAt(t.page, vip.x, vip.y)
    await t.page.waitForTimeout(700)
    check('…and the next tap opens what it is on', !!(await win(t.page, 'photos'))?.open)

    await t.ctx.close()

    // Resizing with a finger: from just inside and just outside an edge, and from a corner
    t = await fresh('ipad-land', 'still')
    let m = await win(t.page, 'messages')
    await swipe(t, [m.x + m.w + 8, m.y + m.h / 2], [m.x + m.w + 68, m.y + m.h / 2])
    await t.page.waitForTimeout(300)
    const m2 = await win(t.page, 'messages')
    await swipe(t, [m2.x + m2.w - 5, m2.y + m2.h / 2], [m2.x + m2.w - 65, m2.y + m2.h / 2])
    await t.page.waitForTimeout(300)
    const m3 = await win(t.page, 'messages')
    await swipe(t, [m3.x + m3.w - 14, m3.y + m3.h - 14], [m3.x + m3.w - 54, m3.y + m3.h - 54])
    await t.page.waitForTimeout(300)
    const m4 = await win(t.page, 'messages')
    check('touch: a finger resizes from 8px outside an edge, 5px inside it, and 14px inside a corner', m2.w === m.w + 60 && m3.w === m2.w - 60 && m4.w === m3.w - 40 && m4.h === m3.h - 40, `${m.w}x${m.h} -> ${m2.w} -> ${m3.w} -> ${m4.w}x${m4.h}`)

    // A finger that comes down just beside the lights is given to the nearest light by the browser:
    // if it then moves, it is dragging the window, and nothing closes, hides or zooms
    const d0 = await win(t.page, 'messages')
    await swipe(t, [d0.x + 110, d0.y + 14], [d0.x + 110 - 70, d0.y + 14 + 50])
    await t.page.waitForTimeout(400)
    const d1 = await win(t.page, 'messages')
    check('touch: a finger beside the lights that moves drags the window (and presses no light)', d1.open && !d1.min && !d1.tile && d1.x === d0.x - 70 && d1.y === d0.y + 50, `${d0.x},${d0.y} -> ${d1.x},${d1.y} open ${d1.open} tile ${d1.tile}`)

    // Holding the green light shows the ways to tile; a drag to within 24px of a side tiles
    const green = await mid(t.page, '.wf[data-app="messages"] .wf__light[data-kind="zoom"]')
    await press(t, green.x, green.y, 900)
    await t.page.waitForTimeout(400)
    const held = { menu: await t.page.evaluate(() => !!document.querySelector('.wf[data-app="messages"] .tile-menu[data-show]')), tile: (await win(t.page, 'messages')).tile }
    check('touch: holding the green light shows Move & Resize and does not zoom', held.menu && !held.tile, JSON.stringify(held))
    await t.page.screenshot({ path: path.join(OUT, 'touch-tiles.png') })
    await tap(t.page, '.wf[data-app="messages"] .tile-menu__option[aria-label="Left"]')
    await t.page.waitForTimeout(600)
    check('…and a choice from it tiles the window', (await win(t.page, 'messages')).tile === 'left')
    await tap(t.page, '.wf[data-app="messages"] .wf__light[data-kind="zoom"]')
    await t.page.waitForTimeout(600)
    const untiled = await win(t.page, 'messages')
    const bar = await mid(t.page, '.wf[data-app="messages"] .ss-window__side-top')
    await swipe(t, [bar.x + 60, bar.y - 8], [14, bar.y + 60], { steps: 14, ms: 320, holdEnd: 200 })
    await t.page.waitForTimeout(700)
    check('touch: dragging a window to within 24px of a side tiles it there', (await win(t.page, 'messages')).tile === 'left', `was tile=${untiled.tile}, now ${(await win(t.page, 'messages')).tile}`)
    await t.ctx.close()

    // An upright iPad: the opening window leaves the icons clear
    for (const [w, h] of [[820, 1180], [768, 1024], [810, 1080], [834, 1194]]) {
      t = await fresh({ w, h, dpr: 1, touch: true, mouse: true }, 'still')
      const over = await t.page.evaluate(() => { const a = document.querySelector('.wf[data-app="messages"]').getBoundingClientRect(); return [...document.querySelectorAll('.desk__item')].map((el) => { const b = el.getBoundingClientRect(); return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) }) })
      check(`touch: at ${w}x${h} the opening window covers neither desktop icon`, over.every((v) => v === 0), JSON.stringify(over) + ' ' + JSON.stringify(await rects(t.page)))
      if (w === 768) await t.page.screenshot({ path: path.join(OUT, 'ipad-768.png') })
      await t.ctx.close()
    }
  },

  // ---- The menu bar, the Dock, the desk ----
  async menus() {
    let t = await fresh('desktop', 'still&open=portfolio')
    await t.page.waitForTimeout(500)
    const names = await t.page.evaluate(() => ({
      titles: [...document.querySelectorAll('.menubar__title')].map((b) => b.getAttribute('aria-label')),
      app: document.querySelector('[data-menu-title="app"]').textContent.trim(),
      mark: [...document.querySelectorAll('[data-menu="mark"] [data-menu-item], [data-menu="mark"] .menu__heading')].map((i) => i.textContent.trim()),
      window: [...document.querySelectorAll('[data-menu="window"] [data-menu-item]')].map((i) => i.textContent.trim()),
      go: [...document.querySelectorAll('[data-menu="go"] [data-menu-item]')].map((i) => i.getAttribute('aria-label') ?? i.textContent.trim()),
      dock: [...document.querySelectorAll('.dock [data-dock-item]')].map((i) => i.getAttribute('aria-label')),
      dockDrag: document.querySelector('.dock a').getAttribute('draggable'),
      desk: [...document.querySelectorAll('.desk__item')].map((i) => i.getAttribute('aria-label')),
      deskInMain: !!document.querySelector('main .desk'),
      title: document.title,
      lights: [...document.querySelectorAll('.wf[data-app="finder"] .wf__light')].map((b) => b.getAttribute('aria-label')),
    }))
    check('menus: Pause Replies is in the mark\'s menu with Portfolio in front', names.app === 'Portfolio' && names.mark.includes('Pause Replies') && names.mark.includes('Screen Saver') && names.mark.includes('Never'), JSON.stringify(names.mark))
    check('copy: "Minimize", "Group Chat", "Questions about Shrug", "One-pager, opens in a new tab"', names.window.includes('Minimize') && !names.window.includes('Minimise') && names.go.includes('Group Chat') && names.go.includes('One-pager, opens in a new tab') && names.dock.includes('FAQs: Questions about Shrug') && names.dock.includes('One-pager, opens in a new tab') && names.lights.includes('Minimize Portfolio'), JSON.stringify({ w: names.window, go: names.go, dock: names.dock, lights: names.lights }))
    check('desk: icons are named "…, desktop icon", sit inside main, and links do not drag', names.desk.join(' | ') === 'Portfolio, desktop icon | One-pager, desktop icon, opens in a new tab' && names.deskInMain && names.dockDrag === 'false', JSON.stringify(names.desk))
    check('title: names the window in front', names.title === 'Portfolio · Shrug', names.title)
    check('menus: What’s New in Shrug V is in the mark\'s menu, straight under About Shrug', names.mark[0] === 'About Shrug' && names.mark[1] === 'What’s New in Shrug V', JSON.stringify(names.mark.slice(0, 3)))
    await t.ctx.close()

    // What’s New in Shrug V opens the FAQs on the question that says what is different about it, whatever they were on
    const faqs = (page) => page.evaluate(() => {
      const w = document.querySelector('.wf[data-app="notes"]')
      return { front: document.querySelector('.wf[data-active]')?.getAttribute('data-app') ?? null, title: w?.querySelector('.faq__title')?.textContent.trim() ?? null, row: w?.querySelector('.faq-row[aria-current]')?.textContent.trim().slice(0, 31) ?? null, search: w?.querySelector('.search__input')?.value ?? null }
    })
    t = await fresh('desktop', 'still&open=faqs')
    await t.page.locator('.wf[data-app="notes"] .search__input').fill('gifts')
    await t.page.waitForTimeout(300)
    const looking = await faqs(t.page)
    await choose(t.page, 'mark', 'What’s New in Shrug V')
    await t.page.waitForTimeout(400)
    let news = await faqs(t.page)
    check('menus: What’s New in Shrug V shows the FAQ on what is different about Shrug V, and lets go of a search that left it out', looking.title !== 'What’s different about Shrug V?' && news.front === 'notes' && news.title === 'What’s different about Shrug V?' && news.row === 'What’s different about Shrug V?' && news.search === '', JSON.stringify([looking, news]))
    await t.ctx.close()
    t = await fresh('desktop', 'still&empty')
    await chooseByKeys(t.page, 'mark', 'What’s New in Shrug V')
    await t.page.waitForTimeout(500)
    news = await faqs(t.page)
    check('menus: chosen by keyboard on a bare desk, it opens the FAQs window on it and the keyboard goes into the window', news.front === 'notes' && news.title === 'What’s different about Shrug V?' && (await focusIs(t.page)) === 'wf:notes', `${JSON.stringify(news)} focus ${await focusIs(t.page)}`)
    await t.ctx.close()

    // The mark shrugs when the desk has nothing to give: its arms lift once for a command the terminal does
    // not know, and once for a search of the portfolio that comes up empty
    const mark = () =>
      t.page.evaluate(() => {
        const m = document.querySelector('[data-menu-mark]')
        const arms = [...m.querySelectorAll('.menubar__arm')]
        return { text: m.textContent, times: Number(m.getAttribute('data-shrug') ?? 0), arms: arms.length, lifting: arms.filter((a) => a.getAnimations().some((x) => x.animationName === 'mark-shrug')).length, on: document.body.innerText.split(m.textContent).length - 1 }
      })
    const typeIn = async (text) => {
      await t.page.locator('.wf[data-app="terminal"] .term__input').click()
      await t.page.keyboard.type(text)
      await t.page.keyboard.press('Enter')
      await t.page.waitForTimeout(120)
    }
    t = await fresh('desktop', 'still&open=portfolio,case-studies')
    const rest = await mark()
    await typeIn('ls')
    const known = await mark()
    await typeIn('frobnicate')
    const lost = await mark()
    await t.page.waitForTimeout(900)
    const down = await mark()
    check('mark: at rest, and after a command the terminal knows, it does not move', rest.arms === 2 && rest.times === 0 && rest.lifting === 0 && known.times === 0 && known.lifting === 0, JSON.stringify([rest, known]))
    check('mark: a command not found lifts both its arms, once, and they come back down', lost.times === 1 && lost.lifting === 2 && down.times === 1 && down.lifting === 0, JSON.stringify([lost, down]))
    check('mark: it is the same emoticon throughout, and still only in the menu bar', /ツ/.test(rest.text) && [rest, lost, down].every((m) => m.text === rest.text && m.on === 1), JSON.stringify(lost))
    await t.page.click('[data-dock-app="finder"]')
    await t.page.waitForTimeout(500)
    const search = t.page.locator('.wf[data-app="finder"] .search__input')
    await search.click()
    await search.pressSequentially('var')
    await t.page.waitForTimeout(200)
    const some = await mark()
    await search.pressSequentially('zz')
    await t.page.waitForTimeout(200)
    const empty = await mark()
    check('mark: a search of the portfolio that finds nothing lifts them again, once however much more is typed', some.times === 1 && empty.times === 2 && empty.lifting === 2 && !!(await t.page.$('.wf[data-app="finder"] .pf__none')), JSON.stringify([some, empty]))
    await t.ctx.close()
    // With less motion asked for, the arms stay down
    t = await fresh('desktop', 'still&open=case-studies', { reducedMotion: true })
    await typeIn('frobnicate')
    const still = await mark()
    const anim = await t.page.evaluate(() => [...document.querySelectorAll('.menubar__arm')].map((a) => getComputedStyle(a).animationName).join())
    check('mark: no lift with reduced motion', still.times === 1 && still.lifting === 0 && anim === 'none,none', `${JSON.stringify(still)} ${anim}`)
    await t.ctx.close()

    // One click picks a desktop icon; the next opens it, however long after
    t = await fresh('desktop', 'still&empty')
    const none = await t.page.evaluate(() => ({ labels: [...document.querySelectorAll('.menubar__title')].map((b) => b.getAttribute('aria-label')), title: document.title }))
    check('menus: with no window open the titles\' names are all different, one "Shrug menu"', new Set(none.labels).size === none.labels.length && none.labels.filter((l) => l === 'Shrug menu').length === 1, JSON.stringify(none.labels))
    check('title: the bare desk is the site\'s own', none.title === 'Shrug', none.title)
    await t.page.click('.desk__item >> nth=0')
    await t.page.waitForTimeout(1600)
    const one = !!(await win(t.page, 'finder'))?.open
    await t.page.click('.desk__item >> nth=0')
    await t.page.waitForTimeout(700)
    const two = !!(await win(t.page, 'finder'))?.open
    check('desk: one click picks the icon, a second, later click opens it', !one && two, `after one: ${one}, after two: ${two}`)
    check('desk: and the keyboard goes into the window', (await focusIs(t.page)) === 'wf:finder', await focusIs(t.page))
    await t.ctx.close()
    t = await fresh('desktop', 'still&empty')
    await t.page.dblclick('.desk__item >> nth=0')
    await t.page.waitForTimeout(700)
    check('desk: a double-click opens it once', !!(await win(t.page, 'finder'))?.open)
    await t.page.keyboard.press('Escape')
    await t.ctx.close()
    t = await fresh('desktop', 'still&empty')
    await t.page.focus('.desk__item >> nth=0')
    await t.page.keyboard.press('Enter')
    await t.page.waitForTimeout(700)
    check('desk: Enter on the icon opens it and moves the keyboard into the window', !!(await win(t.page, 'finder'))?.open && (await focusIs(t.page)) === 'wf:finder', await focusIs(t.page))
    await t.ctx.close()

    // A menu open: a click elsewhere puts it away and presses nothing
    t = await fresh('desktop', 'still')
    await t.page.click('[data-menu-title="go"]')
    await t.page.waitForTimeout(250)
    await t.page.click('[data-dock-app="photos"]', { force: true })
    await t.page.waitForTimeout(500)
    check('menus: with one open, a click on the Dock only closes it', !(await t.page.evaluate(() => document.querySelector('.menubar').hasAttribute('data-open'))) && !!!(await win(t.page, 'photos'))?.open)
    // the Dock's name shows under a resting pointer only where a pointer can rest
    const hoverRule = await t.page.evaluate(() => {
      const found = []
      const walk = (rules, media) => { for (const r of rules) { if (r.selectorText) { if (r.selectorText.includes('.dock__item:hover .dock__label')) found.push(media || 'no media') } else if (r.cssRules) walk(r.cssRules, r.media ? r.media.mediaText : media) } }
      for (const sheet of document.styleSheets) { try { walk(sheet.cssRules, '') } catch {} }
      return found
    })
    check('dock: its name on hover only under (hover: hover)', hoverRule.length > 0 && hoverRule.every((m) => /hover:\s*hover/.test(m)), JSON.stringify(hoverRule))
    await t.ctx.close()

    // With less motion asked for, the Dock does not swell
    t = await fresh('desktop', 'still', { reducedMotion: true })
    const d = await mid(t.page, '[data-dock-app="notes"]')
    await t.page.mouse.move(d.x - 40, d.y)
    await t.page.mouse.move(d.x, d.y, { steps: 5 })
    await t.page.waitForTimeout(300)
    check('dock: no swell under the pointer with reduced motion', (await mid(t.page, '[data-dock-app="notes"]')).w === d.w, `${d.w} -> ${(await mid(t.page, '[data-dock-app="notes"]')).w}`)
    await t.ctx.close()
  },

  // ---- Where the keyboard goes ----
  async keys() {
    let t = await fresh('desktop', 'still')
    for (const label of ['Left Half', 'Fill', 'Right Half']) {
      await chooseByKeys(t.page, 'window', label)
      check(`focus: after Window > ${label} by keyboard, the window in front has it`, (await focusIs(t.page)) === 'wf:messages', await focusIs(t.page))
    }
    await chooseByKeys(t.page, 'window', 'Minimize')
    await t.page.waitForTimeout(300)
    check('focus: after minimizing the only window, its Dock icon has it', (await focusIs(t.page)) === 'dock:messages', await focusIs(t.page))
    await t.page.keyboard.press('Enter')
    await t.page.waitForTimeout(700)
    check('…and Enter there brings the window back with the keyboard in it', (await win(t.page, 'messages')).open && !(await win(t.page, 'messages')).min && (await focusIs(t.page)) === 'wf:messages', await focusIs(t.page))
    await t.page.focus('.wf[data-app="messages"] .wf__light[data-kind="close"]')
    await t.page.keyboard.press('Enter')
    await t.page.waitForTimeout(600)
    check('focus: after the last window closes, its Dock icon has it', (await focusIs(t.page)) === 'dock:messages', await focusIs(t.page))
    await t.ctx.close()

    // F6 steps between the menu bar, the window in front and the Dock
    t = await fresh('desktop', 'still&open=portfolio')
    await t.page.waitForTimeout(400)
    await t.page.evaluate(() => document.querySelector('.wf[data-active]').focus())
    const seen = [await focusIs(t.page)]
    for (let i = 0; i < 3; i++) { await t.page.keyboard.press('F6'); seen.push(await focusIs(t.page)) }
    await t.page.keyboard.press('Shift+F6')
    seen.push(await focusIs(t.page))
    check('keys: F6 goes window -> Dock -> menu bar -> window; Shift+F6 back', seen[0] === 'wf:finder' && /^dock:/.test(seen[1]) && /^menubar:/.test(seen[2]) && seen[3] === 'wf:finder' && /^menubar:/.test(seen[4]), seen.join(' > '))

    // Select All keeps to the window in front
    await t.page.evaluate(() => document.querySelector('.wf[data-active]').focus())
    await t.page.keyboard.press('Control+a')
    const sel = await t.page.evaluate(() => { const s = getSelection(); const r = s.rangeCount ? s.getRangeAt(0) : null; return { inFront: !!r && !!document.querySelector('.wf[data-active] .wf__content')?.contains(r.commonAncestorContainer), chars: s.toString().length, all: document.querySelector('.os').innerText.length } })
    check('keys: Select All takes the window in front only', sel.inFront && sel.chars > 0 && sel.chars < sel.all, JSON.stringify(sel))
    await t.ctx.close()
  },
}

/** Pauses the replies with a finger, so that a short ?idle is not held off by the conversation. */
async function choosePause(t) {
  await pick(t.page, 'mark', 'Pause Replies')
}

;(async () => {
  browser = await A.launch()
  for (const [name, run] of Object.entries(parts)) {
    if (only && only !== name) continue
    try {
      await run()
    } catch (e) {
      check(`${name}: ran to the end`, false, e.stack?.split('\n').slice(0, 3).join(' | '))
    }
  }
  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'ALL PASS')
  process.exit(failed ? 1 : 0)
})()
