// Workspace: the studio (design/v1-workspace). Eight slabs; a color picked floods the window and is the
// studio's; the chair turns; a color in stock is bought in the VIP Store and one made to order is asked for;
// a color of one's own is read as it is typed; the Dock's icon takes the color and keeps it.
// (The chair is a placeholder for the licensed model, and the 3D is drawn where the browser can.)
//   node workspace.cjs http://127.0.0.1:4273/
const A = require('./lib.cjs')
const BASE = process.argv[2] || A.BASE

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

;(async () => {
  const browser = await A.launch()
  const W = '.wf[data-app="workspace"]'
  let t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  let p = t.page
  await p.waitForTimeout(1600)
  const studio = () =>
    p.evaluate((W) => {
      const w = document.querySelector(W)
      const win = w.querySelector('.ss-window')
      return { view: w.querySelector('.fl.st') ? 'studio' : w.querySelector('.wx-first') ? 'first' : w.querySelector('.ow') ? 'owners' : '?', ground: getComputedStyle(win).backgroundColor, image: getComputedStyle(win).backgroundImage.slice(0, 15), ink: getComputedStyle(win).color, word: w.querySelector('.fl-word')?.innerText.replace(/\s+/g, ' ') ?? null, name: w.querySelector('.fl-info h2')?.textContent ?? null, tags: [...w.querySelectorAll('.st-tag')].map((x) => x.textContent).join(' | '), buy: w.querySelector('.fl-buy')?.innerText.replace(/\s*\n\s*/g, ' / ') ?? null, on: w.querySelector('.fl-dot.on')?.getAttribute('aria-label') ?? null, dots: w.querySelectorAll('.fl-dot').length, still: !!w.querySelector('.st-still'), drawn: !!w.querySelector('.st-table[data-3d]'), turn: w.querySelector('.st-turn')?.textContent ?? null, wordSize: parseFloat(getComputedStyle(w.querySelector('.fl-word') ?? w).fontSize), wordFits: [...w.querySelectorAll('.fl-word > span')].every((line) => line.getBoundingClientRect().left >= win.getBoundingClientRect().left && line.getBoundingClientRect().right <= win.getBoundingClientRect().right), note: (() => { const n = w.querySelector('.st-stand'); const bar = w.querySelector('.ss-window__bar'); return n ? n.getBoundingClientRect().top >= bar.getBoundingClientRect().bottom : null })() }
    }, W)

  // ---- in the Dock between Mail and VIP Store; opened, eight slabs
  const dock = await p.evaluate(() => [...document.querySelectorAll('.dock [data-dock-item]')].map((b) => b.dataset.dockApp).join(' '))
  check('Workspace is in the Dock between Mail and VIP Store', /mail workspace store$/.test(dock), dock)
  // (its mark, W/S, is drawn and not set as type: an icon is a picture all through, data/lettering.ts)
  const iconBefore = await p.evaluate(() => { const svg = document.querySelector('.dock [data-dock-app="workspace"] svg'); return !!svg.querySelector('path[data-mark]') && !svg.querySelector('text') })
  await p.click('.dock [data-dock-app="workspace"]')
  await p.waitForSelector(`${W}[data-open] .fl-slab`, { timeout: 15000 })
  await p.waitForTimeout(600)
  const first = await p.evaluate((W) => { const w = document.querySelector(W); const r = w.getBoundingClientRect(); return { size: `${Math.round(r.width)}x${Math.round(r.height)}`, head: w.querySelector('.fl-head h1').innerText.replace(/\s*\n\s*/g, ' / '), slabs: [...w.querySelectorAll('.fl-slab')].map((s) => `${s.querySelector('b').textContent}: ${s.querySelector('small').textContent}`), mark: !!w.querySelector('.wxbar svg.mk path') && w.querySelector('.wxbar__home').innerText.trim() } }, W)
  check('it opens 1100 by 720, its mark drawn in its bar and on its icon, on eight slabs, seven colors and Your own, each saying how it is to be had', first.size === '1100x720' && first.head === 'One chair. / Seven colors.' && first.mark === 'Workspace' && iconBefore && first.slabs.join(' | ') === 'Scuderia Red: Made to order | Solar Orange: Available now | Alexandrite: Color-shifting | Championship Green: Made to order | Supersonic: Made to order | Pearl Lavender: Made to order | Mantis Green: Made to order | Your own: On request', first.slabs.join(' | '))
  await p.locator(`${W} .fl-slab`).nth(1).hover()
  await p.waitForTimeout(600)
  const hover = await p.evaluate((W) => { const slabs = [...document.querySelectorAll(`${W} .fl-slab`)].map((s) => s.getBoundingClientRect().width); return { wider: slabs[1] > slabs[0] * 1.8, chair: !!document.querySelector(`${W} .fl-slab.big svg.ch`) } }, W)
  check('pointed at, a slab widens and shows the chair in its color', hover.wider && hover.chair, JSON.stringify(hover))

  // ---- a color in stock: the studio, and Buy in VIP Store
  await p.locator(`${W} .fl-slab`).nth(1).click()
  await p.waitForSelector(`${W} .fl.st`, { timeout: 8000 })
  await p.waitForTimeout(2600)
  let s = await studio()
  check('a color picked floods the window: the studio is that color, its name huge behind the chair, words in near-black on it', s.view === 'studio' && s.ground === 'rgb(251, 138, 5)' && s.ink === 'rgb(20, 20, 20)' && (s.word ?? '').toLowerCase() === 'solar orange' && s.name === 'Solar Orange' && s.dots === 8 && s.on === 'Solar Orange', JSON.stringify(s))
  check('the name is set at 176, whole, under the window’s bar; and the note that the chair is a placeholder is whole there too', s.wordSize === 176 && s.wordFits && s.note === true, JSON.stringify({ size: s.wordSize, fits: s.wordFits, note: s.note }))
  check('in stock: its price, Buy in VIP Store, and where it is paid for', s.tags === 'Available now' && s.buy === '$1,450 / Buy in VIP Store / Available now. Paid for in the VIP Store.', s.buy)
  check('the chair is there: a drawing of it at once, and the 3D chair over it where the browser can draw one', s.still && (s.drawn ? s.turn === 'Drag to turn · 0°' : true), JSON.stringify({ still: s.still, drawn: s.drawn, turn: s.turn }))
  if (s.drawn) {
    const at = await p.evaluate((W) => { const r = document.querySelector(`${W} .st-table`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }, W)
    await p.mouse.move(at.x, at.y)
    await p.mouse.down()
    await p.mouse.move(at.x + 120, at.y, { steps: 6 })
    await p.mouse.up()
    await p.waitForTimeout(300)
    const turned = (await studio()).turn
    check('a drag turns it, and the studio says how far', /^Drag to turn · (?!0°)\d+°$/.test(turned ?? ''), String(turned))
    await p.locator(`${W} .st-table`).focus()
    await p.keyboard.press('ArrowLeft')
    await p.waitForTimeout(200)
    check('so do the arrow keys', (await studio()).turn !== turned)
  }
  const icon = await p.evaluate(() => document.querySelector('.dock [data-dock-app="workspace"] svg stop:last-child')?.getAttribute('stop-color'))
  check('the Dock’s icon takes the color picked', icon === '#fb8a05', String(icon))
  await p.locator(`${W} .fl-btn`).click()
  await p.waitForSelector('.wf[data-app="store"][data-open] iframe.storewin__frame', { timeout: 15000 })
  await p.waitForTimeout(1500)
  const there = await p.evaluate(() => ({ front: document.querySelector('.wf[data-active]')?.dataset.app, search: document.querySelector('.storewin__frame').contentWindow.location.search }))
  check('Buy in VIP Store opens the store’s window on that chair', there.front === 'store' && there.search === '?p=chair', JSON.stringify(there))
  await p.locator('.wf[data-app="store"] button[aria-label^="Close"]').click()
  await p.waitForTimeout(500)

  // ---- a color-shifting paint; one made to order, asked for while logged out
  await p.click('.dock [data-dock-app="workspace"]')
  await p.waitForTimeout(500)
  await p.locator(`${W} .fl-dot[aria-label="Alexandrite"]`).click()
  await p.waitForTimeout(700)
  s = await studio()
  check('Alexandrite is color-shifting: the cove is its colors, the words are white, and it says to turn it', s.image === 'linear-gradient' && s.ink === 'rgb(255, 255, 255)' && s.tags === 'Color-shifting | Made to order' && /Turn it to see it shift\.$/.test(await p.locator(`${W} .fl-info p`).innerText()), JSON.stringify(s))
  await p.locator(`${W} .fl-dot[aria-label="Championship Green"]`).click()
  await p.waitForTimeout(700)
  s = await studio()
  check('a long name is set smaller, so that it does not run off the window', s.name === 'Championship Green' && s.wordSize < 176 && s.wordSize > 100 && s.wordFits, JSON.stringify({ size: s.wordSize, fits: s.wordFits }))
  await p.locator(`${W} .fl-dot[aria-label="Mantis Green"]`).click()
  await p.waitForTimeout(700)
  s = await studio()
  check('made to order: its price, Request, and that nothing is charged now', s.name === 'Mantis Green' && s.buy === '$1,500 / Request / Made to order. No charge now.', s.buy)
  await p.locator(`${W} .fl-btn`).click()
  await p.waitForTimeout(500)
  const sheet = await p.evaluate(() => ({ head: document.querySelector('.account__head')?.textContent, lead: document.querySelector('.account__lead')?.textContent }))
  check('Request, logged out, lets down Log In, which says the color is kept meanwhile', sheet.head === 'Log in to request' && sheet.lead === 'Mantis Green is kept while you log in. Start with your email.', JSON.stringify(sheet))
  await p.locator('.account input[type=email]').fill('riley@example.test')
  await p.keyboard.press('Enter'); await p.waitForTimeout(900)
  await p.keyboard.type('4155550134'); await p.keyboard.press('Enter'); await p.waitForTimeout(900)
  await p.keyboard.type('246810'); await p.waitForTimeout(1500)
  await p.keyboard.type('Riley Chen'); await p.locator('.account__go').click(); await p.waitForTimeout(1900)
  s = await studio()
  check('logged in, the request is sent: the button is off and says Requested', s.name === 'Mantis Green' && s.buy === '$1,500 / Requested / Requested today. We’ll email you.' && (await p.locator(`${W} .fl-btn`).getAttribute('aria-disabled')) === 'true', s.buy)

  // ---- a color of one's own
  await p.locator(`${W} .fl-dot.own`).click()
  await p.waitForTimeout(900)
  s = await studio()
  // (neither near-black nor white is read well enough on this teal: the words are black, which is)
  check('Your own starts on a teal, with words that can be read on it', s.ground === 'rgb(31, 138, 122)' && s.ink === 'rgb(0, 0, 0)', JSON.stringify({ ground: s.ground, ink: s.ink }))
  await p.locator(`${W} .st-own input`).fill('RAL 5002')
  await p.waitForTimeout(700)
  s = await studio()
  const own = await p.evaluate((W) => ({ swatch: getComputedStyle(document.querySelector(`${W} .st-own i`)).backgroundColor, help: document.querySelector(`${W} .fl-info p`).textContent }), W)
  check('Your own: a name, a hex or a RAL code, read as it is typed; the studio follows at once, and it is always a request', s.name === 'Your own' && s.ground === 'rgb(0, 56, 123)' && own.swatch === 'rgb(0, 56, 123)' && s.ink === 'rgb(255, 255, 255)' && own.help === 'Name it, or give a hex or RAL code. The studio follows.' && s.buy === 'On request / Request / Always made to order. No charge now.', JSON.stringify({ s, own }))
  await p.locator(`${W} .st-own input`).fill('#6fd12a')
  await p.waitForTimeout(600)
  check('a hex is read the same way', (await studio()).ground === 'rgb(111, 209, 42)')

  // ---- the color is kept for the next visit: the studio, and the Dock's icon
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(2200)
  const kept = await p.evaluate(() => document.querySelector('.dock [data-dock-app="workspace"] svg stop:last-child')?.getAttribute('stop-color'))
  check('on the next visit the Dock’s icon is still the color picked', kept === '#6fd12a', String(kept))
  check('nothing went wrong on the way', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error('FAILED', e.message.split('\n').slice(0, 10).join('\n'))
  process.exit(1)
})
