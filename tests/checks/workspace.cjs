// Workspace: the studio (design/v1-workspace, and Dom's notes after testing). A slab for each color; a color
// picked floods the window and is the studio's; the chair turns, and its photographs are beside it; who owns
// one is under the colors; BTS is a wall of how it is made; the price is said only to someone logged in, and
// the chair is bought here, on the store's own page for it, in this window. A color of one's own is read as
// it is typed and is always a request. The Dock's icon takes the color and keeps it.
// (The 3D is drawn where the browser can; the demo shows templated owners and film tiles.)
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
      const inside = (el) => el.getBoundingClientRect().left >= win.getBoundingClientRect().left && el.getBoundingClientRect().right <= win.getBoundingClientRect().right
      return {
        view: w.querySelector('.wx-buy:not([hidden])') ? 'buy' : w.querySelector('.fl.st') ? 'studio' : w.querySelector('.wx-first') ? 'first' : w.querySelector('.ow') ? 'owners' : w.querySelector('.bts') ? 'bts' : '?',
        ground: getComputedStyle(win).backgroundColor,
        image: getComputedStyle(win).backgroundImage.slice(0, 15),
        ink: getComputedStyle(win).color,
        word: w.querySelector('.fl-word')?.innerText.replace(/\s+/g, ' ') ?? null,
        name: w.querySelector('.fl-info h2')?.textContent ?? null,
        tags: [...w.querySelectorAll('.st-tag')].map((x) => x.textContent).join(' | '),
        buy: w.querySelector('.fl-buy')?.innerText.replace(/\s*\n\s*/g, ' / ').trim() ?? null,
        on: w.querySelector('.fl-dot.on')?.getAttribute('aria-label') ?? null,
        dots: w.querySelectorAll('.fl-dot').length,
        still: !!w.querySelector('.st-still'),
        drawn: !!w.querySelector('.st-table[data-3d]'),
        turn: w.querySelector('.st-turn')?.textContent ?? null,
        wordSize: parseFloat(getComputedStyle(w.querySelector('.fl-word') ?? w).fontSize),
        wordFits: [...w.querySelectorAll('.fl-word > span')].every(inside),
        back: w.querySelector('.wxbar__back')?.textContent.trim() ?? null,
        pills: [...w.querySelectorAll('.wxbar .pill')].map((x) => `${x.textContent.trim()}${x.getAttribute('aria-pressed') === 'true' ? '*' : ''}`).join(' | '),
        wallet: w.querySelector('.wxbar__wallet')?.textContent.trim() ?? null,
      }
    }, W)
  const inFrame = () =>
    p.evaluate((W) => {
      const f = document.querySelector(`${W} .wx-buy iframe`)
      const s = f.contentDocument.scrollingElement
      return { path: f.contentWindow.location.pathname, search: f.contentWindow.location.search, over: s.scrollHeight - f.contentWindow.innerHeight, wide: s.scrollWidth - f.contentWindow.innerWidth }
    }, W)
  const logIn = async (email, phone, name) => {
    await p.locator('.account input[type=email]').fill(email)
    await p.keyboard.press('Enter'); await p.waitForTimeout(900)
    await p.keyboard.type(phone); await p.keyboard.press('Enter'); await p.waitForTimeout(900)
    await p.keyboard.type('246810'); await p.waitForTimeout(1500)
    await p.keyboard.type(name); await p.locator('.account__go').click(); await p.waitForTimeout(1900)
  }

  // ---- in the Dock between Mail and the stores; opened, a slab for each color
  const dock = await p.evaluate(() => [...document.querySelectorAll('.dock [data-dock-item]')].map((b) => b.dataset.dockApp).join(' '))
  check('Workspace is in the Dock between Mail and ArtStore', /mail workspace store books myvip$/.test(dock), dock)
  // (its mark, W/S, is drawn and not set as type: an icon is a picture all through, data/lettering.ts)
  const iconBefore = await p.evaluate(() => { const svg = document.querySelector('.dock [data-dock-app="workspace"] svg'); return !!svg.querySelector('path[data-mark]') && !svg.querySelector('text') })
  await p.click('.dock [data-dock-app="workspace"]')
  await p.waitForSelector(`${W}[data-open] .fl-slab`, { timeout: 15000 })
  await p.waitForTimeout(600)
  const first = await p.evaluate((W) => { const w = document.querySelector(W); const r = w.getBoundingClientRect(); return { size: `${Math.round(r.width)}x${Math.round(r.height)}`, head: w.querySelector('.fl-head h1').innerText.replace(/\s*\n\s*/g, ' / '), slabs: [...w.querySelectorAll('.fl-slab')].map((s) => `${s.querySelector('b').textContent}: ${s.querySelector('small').textContent}`), mark: !!w.querySelector('.wxbar svg.mk path') && w.querySelector('.wxbar__home').innerText.trim(), money: /\$\d/.test(w.innerText) } }, W)
  check('it opens 1100 by 720, its mark drawn in its bar and on its icon, on nine slabs: Matte Black, seven paints and Your own, each saying how it is to be had', first.size === '1100x720' && first.head === 'One chair. / Eight colors.' && first.mark === 'Workspace' && iconBefore && first.slabs.join(' | ') === 'Matte Black: Available now | Scuderia Red: Made to order | Solar Orange: Available now | Alexandrite: Color-shifting | Championship Green: Made to order | Supersonic: Made to order | Pearl Lavender: Made to order | Mantis Green: Made to order | Your own: On request', JSON.stringify(first))
  check('no price is on the slabs for a visitor', !first.money, '')
  await p.locator(`${W} .fl-slab`).nth(2).hover()
  await p.waitForTimeout(600)
  const hover = await p.evaluate((W) => { const slabs = [...document.querySelectorAll(`${W} .fl-slab`)].map((s) => s.getBoundingClientRect().width); return { wider: slabs[2] > slabs[0] * 1.8, chair: !!document.querySelector(`${W} .fl-slab.big svg.ch`) } }, W)
  check('pointed at, a slab widens and shows the chair in its color', hover.wider && hover.chair, JSON.stringify(hover))

  // ---- a color picked: the studio
  await p.locator(`${W} .fl-slab`).nth(1).click()
  await p.waitForSelector(`${W} .fl.st`, { timeout: 8000 })
  await p.waitForTimeout(2600)
  let s = await studio()
  check('a color picked floods the window: the studio is that color, its name huge behind the chair, words that read on it', s.view === 'studio' && s.ground === 'rgb(216, 20, 28)' && s.ink === 'rgb(255, 255, 255)' && (s.word ?? '').toLowerCase() === 'scuderia red' && s.name === 'Scuderia Red' && s.dots === 9 && s.on === 'Scuderia Red', JSON.stringify(s))
  check('the name is set at 176, whole, inside the window', s.wordSize === 176 && s.wordFits, JSON.stringify({ size: s.wordSize, fits: s.wordFits }))
  check('a visitor is not told the price: the button is the way to it, and says why', s.tags === 'Made to order' && s.buy === 'Log in to see the price / The chair’s price is for members. Logging in is free.' && !/\$\d/.test(await p.locator(W).innerText()), s.buy)
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
  check('the Dock’s icon takes the color picked', icon === '#d8141c', String(icon))

  // ---- its photographs, beside the 3D chair
  const shots = await p.evaluate((W) => [...document.querySelectorAll(`${W} .st-shots .st-shot`)].map((b) => `${b.getAttribute('aria-label')}${b.getAttribute('aria-pressed') === 'true' ? '*' : ''}`).join(' | '), W)
  check('beside the chair are its pictures: the 3D chair, which is on show, and each photograph of it in this color', shots === 'The chair in 3D* | Photograph 1 of 3 | Photograph 2 of 3 | Photograph 3 of 3', shots)
  await p.locator(`${W} .st-shot[aria-label="Photograph 2 of 3"]`).click()
  await p.waitForTimeout(700)
  const photo = await p.evaluate((W) => { const img = document.querySelector(`${W} .st-photo`); const r = img?.getBoundingClientRect(); const win = document.querySelector(W).getBoundingClientRect(); return { alt: img?.alt, loaded: !!img && img.complete && img.naturalWidth > 0, big: !!r && r.width > 200 && r.height > 200, inside: !!r && r.left >= win.left && r.right <= win.right && r.bottom <= win.bottom, on: document.querySelector(`${W} .st-shot[aria-pressed="true"]`)?.getAttribute('aria-label') } }, W)
  check('a photograph picked is on the stage, large, in place of the 3D chair', photo.alt === 'Scuderia Red: photograph 2 of 3' && photo.loaded && photo.big && photo.inside && photo.on === 'Photograph 2 of 3', JSON.stringify(photo))
  await p.locator(`${W} .st-shot[aria-label="The chair in 3D"]`).click()
  await p.waitForTimeout(400)
  check('and the 3D chair comes back when it is picked', (await p.locator(`${W} .st-photo`).count()) === 0 && (await studio()).still)
  await p.locator(`${W} .fl-dot[aria-label="Solar Orange"]`).click()
  await p.waitForTimeout(700)
  check('a color with no photographs yet has the 3D chair alone, and no strip', (await p.locator(`${W} .st-shots`).count()) === 0 && (await studio()).name === 'Solar Orange', '')
  await p.locator(`${W} .fl-dot[aria-label="Scuderia Red"]`).click()
  await p.waitForTimeout(700)

  // ---- who owns one, under the colors; Notable Owners, and the way back to the chair
  const owned = await p.evaluate((W) => { const b = document.querySelector(`${W} .fl-owners`); const dots = document.querySelector(`${W} .fl-dock`).getBoundingClientRect(); return b ? { says: b.innerText.replace(/\s+/g, ' ').trim(), faces: b.querySelectorAll('.fl-faces i').length, under: b.getBoundingClientRect().top >= dots.bottom - 1 } : null }, W)
  check('under the colors is who owns one, on the way to buying it', !!owned && /^Owned by .+ and \d+ more$/.test(owned.says) && owned.faces >= 3 && owned.under, JSON.stringify(owned))
  await p.locator(`${W} .fl-owners`).click()
  await p.waitForTimeout(600)
  s = await studio()
  const cards = await p.locator(`${W} .ow-card`).count()
  check('it opens Notable Owners: a grid of cards, each in its owner’s color, with a way back to the color being looked at', s.view === 'owners' && cards === 6 && s.back === 'Back to Scuderia Red' && s.pills === 'BTS | Notable Owners*' && (await p.evaluate((W) => getComputedStyle(document.querySelector(`${W} .ow-grid`)).display, W)) === 'grid', JSON.stringify({ view: s.view, cards, back: s.back, pills: s.pills }))
  await p.locator(`${W} .wxbar__back`).click()
  await p.waitForTimeout(500)
  s = await studio()
  check('Back returns to the chair, in the color it was', s.view === 'studio' && s.name === 'Scuderia Red' && s.back === null, JSON.stringify({ view: s.view, name: s.name, back: s.back }))

  // ---- BTS: how it is made, as a wall
  await p.locator(`${W} .wxbar .pill`, { hasText: 'BTS' }).click()
  await p.waitForTimeout(900)
  const wall = await p.evaluate((W) => {
    const w = document.querySelector(W)
    const tiles = [...w.querySelectorAll('.bts-tile')]
    const box = w.querySelector('.bts-wall')
    const tops = new Set(tiles.map((x) => Math.round(x.getBoundingClientRect().left)))
    const heights = new Set(tiles.map((x) => Math.round(x.getBoundingClientRect().height / 20)))
    return { head: w.querySelector('.bts h1, .bts h2')?.textContent.trim(), tiles: tiles.length, photos: tiles.filter((x) => x.querySelector('img')).length, films: tiles.filter((x) => x.querySelector('.bts-play')).length, says: tiles.every((x) => x.querySelector('.bts-says')?.textContent.trim().length > 3), columns: tops.size, heights: heights.size, display: getComputedStyle(box).display, cols: getComputedStyle(box).columnCount, loaded: [...w.querySelectorAll('.bts-tile img')].every((i) => i.complete && i.naturalWidth > 0) }
  }, W)
  s = await studio()
  check('BTS is in the bar, and opens a wall of how a chair is made: photographs and films, each with a line under it', s.view === 'bts' && s.pills === 'BTS* | Notable Owners' && wall.tiles >= 6 && wall.photos === 4 && wall.films >= 1 && wall.says && wall.loaded, JSON.stringify({ s: s.pills, wall }))
  check('it is laid out as a wall, not as Notable Owners’ grid of cards: columns of pictures of different heights', wall.display !== 'grid' && wall.columns >= 3 && wall.heights >= 2, JSON.stringify(wall))
  await p.locator(`${W} .bts-tile button`, { hasText: 'A base in the paint booth.' }).click()
  await p.waitForTimeout(500)
  const look = await p.evaluate((W) => { const d = document.querySelector(`${W} .bts-look`); return { role: d?.getAttribute('role'), name: d?.getAttribute('aria-label'), pic: !!d?.querySelector('img'), held: !!d?.contains(document.activeElement) } }, W)
  check('a picture opens large, with its line, and the keyboard in it', look.role === 'dialog' && look.name === 'A base in the paint booth.' && look.pic && look.held, JSON.stringify(look))
  await p.keyboard.press('Escape')
  await p.waitForTimeout(300)
  check('Escape puts it away, and Workspace is still open on the wall', (await p.locator(`${W} .bts-look`).count()) === 0 && (await studio()).view === 'bts', '')
  check('BTS has a Back to the color too', (await studio()).back === 'Back to Scuderia Red', String((await studio()).back))
  await p.locator(`${W} .wxbar__back`).click()
  await p.waitForTimeout(500)

  // ---- the price: for someone logged in. Asked for, the desk's Log In says why and keeps the color
  await p.locator(`${W} .fl-btn`).click()
  await p.waitForTimeout(500)
  const sheet = await p.evaluate(() => ({ head: document.querySelector('.account__head')?.textContent, lead: document.querySelector('.account__lead')?.textContent }))
  check('"Log in to see the price" lets down Log In, which says what for and that the color is kept', sheet.head === 'Log in to see the price' && sheet.lead === 'Scuderia Red is kept while you log in. Start with your email.', JSON.stringify(sheet))
  await logIn('riley@example.test', '4155550134', 'Riley Chen')
  s = await studio()
  check('logged in, the chair has its price: a painted chair from $1,200, to order', s.name === 'Scuderia Red' && s.buy === 'From $1,200 / Order / Made to order. Your points bring it down.', s.buy)
  await p.locator(`${W} .fl-dot[aria-label="Matte Black"]`).click()
  await p.waitForTimeout(800)
  s = await studio()
  check('Matte Black is from $1,100, and can be bought now', s.name === 'Matte Black' && s.tags === 'Available now' && s.buy === 'From $1,100 / Buy / Available now. Your points bring it down.', JSON.stringify({ tags: s.tags, buy: s.buy }))

  // ---- buying, in this window: the store's own page for that chair
  await p.locator(`${W} .fl-btn`).click()
  const f = p.frameLocator(`${W} .wx-buy iframe`)
  await f.locator('.ui-col .ui-btn').first().waitFor({ timeout: 20000 })
  await p.waitForTimeout(700)
  s = await studio()
  let at = await inFrame()
  const sums = (await f.locator('.ui-col').first().innerText()).replace(/\s*\n\s*/g, ' | ')
  check('Buy opens the store’s page for that chair inside Workspace: no other window, a Back to the color, and their balance in the bar', s.view === 'buy' && (await p.evaluate(() => document.querySelector('.wf[data-active]')?.dataset.app)) === 'workspace' && at.path === '/vip/store/' && at.search === '?k=chairs&p=chair-matte-black' && s.back === 'Back to Matte Black' && s.wallet === '100', JSON.stringify({ view: s.view, at, back: s.back, wallet: s.wallet }))
  check('it is priced in dollars, their points bring it down, and the button says what it comes to', /Price \| \$1,100 \|.*100 points \| of your 100 \| −\$10 \|.*Shipping \| \$70 \| Total \| \$1,160 \| Buy for \$1,160( \||$)/.test(sums), sums)
  check('the chair’s page fits the window', at.over <= 0 && at.wide <= 0, JSON.stringify(at))
  const rail = await f.locator('.ui-rail a, .ui-rail button').evaluateAll((els) => els.map((el) => el.textContent.replace(/\s+/g, ' ').trim()).join(' | '))
  check('along its foot are the chair’s other colors, and nothing of another store', /Scuderia Red/.test(rail) && /Mantis Green/.test(rail) && !/Art No|Chromatic/.test(rail), rail)
  await f.locator('.ui-rail a', { hasText: 'Solar Orange' }).first().click()
  await p.waitForTimeout(900)
  at = await inFrame()
  await p.locator(`${W} .wxbar__back`).click()
  // (the cove eases to the color, and the 3D chair is drawn again meanwhile, which a machine with no GPU is slow at)
  await p.waitForFunction((W) => getComputedStyle(document.querySelector(`${W} .ss-window`)).backgroundColor === 'rgb(251, 138, 5)', W, { timeout: 15000 }).catch(() => {})
  s = await studio()
  check('another color picked there is the studio’s color too: Back comes to the chair in it', at.search === '?k=chairs&p=chair-solar-orange' && s.view === 'studio' && s.name === 'Solar Orange' && s.ground === 'rgb(251, 138, 5)', JSON.stringify({ at, view: s.view, name: s.name, ground: s.ground }))

  // ---- a color-shifting paint; a long name
  await p.locator(`${W} .fl-dot[aria-label="Alexandrite"]`).click()
  await p.waitForTimeout(700)
  s = await studio()
  check('Alexandrite is color-shifting: the cove is its colors, the words are white, and it says to turn it', s.image === 'linear-gradient' && s.ink === 'rgb(255, 255, 255)' && s.tags === 'Color-shifting | Made to order' && /Turn it to see it shift\.$/.test(await p.locator(`${W} .fl-info p`).innerText()), JSON.stringify(s))
  await p.locator(`${W} .fl-dot[aria-label="Championship Green"]`).click()
  await p.waitForTimeout(700)
  s = await studio()
  check('a long name is set smaller, so that it does not run off the window', s.name === 'Championship Green' && s.wordSize < 176 && s.wordSize > 100 && s.wordFits, JSON.stringify({ size: s.wordSize, fits: s.wordFits }))
  check('nothing went wrong on the way', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- a color of one's own: read as it is typed, always a request; asked for logged out, it is sent once they are in
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  p = t.page
  await p.waitForTimeout(1600)
  await p.click('.dock [data-dock-app="workspace"]')
  await p.waitForSelector(`${W}[data-open] .fl-slab`, { timeout: 15000 })
  await p.locator(`${W} .fl-slab.own`).click()
  await p.waitForSelector(`${W} .fl.st`, { timeout: 8000 })
  await p.waitForTimeout(1500)
  s = await studio()
  // (neither near-black nor white is read well enough on this teal: the words are black, which is)
  check('Your own starts on a teal, with words that can be read on it', s.ground === 'rgb(31, 138, 122)' && s.ink === 'rgb(0, 0, 0)', JSON.stringify({ ground: s.ground, ink: s.ink }))
  await p.locator(`${W} .st-own input`).fill('RAL 5002')
  await p.waitForTimeout(700)
  s = await studio()
  const own = await p.evaluate((W) => ({ swatch: getComputedStyle(document.querySelector(`${W} .st-own i`)).backgroundColor, help: document.querySelector(`${W} .fl-info p`).textContent }), W)
  check('Your own: a name, a hex or a RAL code, read as it is typed; the studio follows at once, and it is always a request', s.name === 'Your own' && s.ground === 'rgb(0, 56, 123)' && own.swatch === 'rgb(0, 56, 123)' && s.ink === 'rgb(255, 255, 255)' && own.help === 'Name it, or give a hex or RAL code. The studio follows.' && s.buy === 'On request / Request / Always made to order. No charge now.', JSON.stringify({ s, own }))
  await p.locator(`${W} .fl-btn`).click()
  await p.waitForTimeout(500)
  const ask = await p.evaluate(() => ({ head: document.querySelector('.account__head')?.textContent, lead: document.querySelector('.account__lead')?.textContent }))
  check('Request, logged out, lets down Log In, which says the color is kept meanwhile', ask.head === 'Log in to request' && ask.lead === 'Your color is kept while you log in. Start with your email.', JSON.stringify(ask))
  await logIn('sam@example.test', '4155550135', 'Sam Okafor')
  s = await studio()
  check('logged in, the request is sent to the store: the button is off and says Requested, with what was asked for', s.name === 'Your own' && s.buy === 'On request / Requested / Requested: RAL 5002 (#00387b). We’ll write to you about it.' && (await p.locator(`${W} .fl-btn`).getAttribute('aria-disabled')) === 'true', s.buy)
  await p.locator(`${W} .st-own input`).fill('#6fd12a')
  await p.waitForTimeout(600)
  check('a hex is read the same way', (await studio()).ground === 'rgb(111, 209, 42)')

  // ---- the color is kept for the next visit: the studio, and the Dock's icon
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(2200)
  const kept = await p.evaluate(() => document.querySelector('.dock [data-dock-app="workspace"] svg stop:last-child')?.getAttribute('stop-color'))
  check('on the next visit the Dock’s icon is still the color picked', kept === '#6fd12a', String(kept))
  // The request is the store's to keep, as an order: it is still there on the next visit, and in My VIP
  if (!(await p.locator(`${W}[data-open]`).count())) await p.click('.dock [data-dock-app="workspace"]')
  await p.waitForSelector(`${W} .fl.st, ${W} .fl-slab`, { timeout: 15000 })
  if (await p.locator(`${W} .fl-slab.own`).count()) await p.locator(`${W} .fl-slab.own`).click()
  await p.waitForSelector(`${W} .fl.st`, { timeout: 8000 })
  await p.waitForFunction((W) => /Requested/.test(document.querySelector(`${W} .fl-buy`)?.textContent ?? ''), W, { timeout: 15000 }).catch(() => {})
  s = await studio()
  check('the request is kept by the store, not by the page: it is still Requested on the next visit', /^On request \/ Requested \/ Requested: RAL 5002 \(#00387b\)\./.test(s.buy ?? ''), String(s.buy))
  await p.click('.dock [data-dock-app="myvip"]')
  const v = p.frameLocator('.wf[data-app="myvip"] iframe.storewin__frame')
  await v.locator('#ripBtn, .mc').first().waitFor({ timeout: 20000 })
  if (await v.locator('#ripBtn').count()) { await p.waitForTimeout(900); await v.locator('#ripBtn').focus(); await p.keyboard.press('Enter'); await v.locator('#stage[data-view="card"]').waitFor({ timeout: 20000 }); await p.waitForTimeout(1200); await v.locator('a.go').click() }
  await v.locator('.mc').first().waitFor({ timeout: 20000 })
  await p.waitForTimeout(600)
  const mine = (await v.locator('body').innerText()).replace(/\s*\n\s*/g, ' | ')
  check('…and it is in My VIP, with the other things they have asked for or bought', /Workspace, Your Own Color/.test(mine) && /Requested/.test(mine), mine.slice(mine.indexOf('Purchase history'), mine.indexOf('Purchase history') + 200))
  check('nothing went wrong on the way (a color of one’s own)', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error('FAILED', e.message.split('\n').slice(0, 10).join('\n'))
  process.exit(1)
})
