// Workspace: the studio (design/v1-workspace, the 25 Nov redraw of its colors, and Dom's notes after testing).
// It opens on the color selector: a slab for each of the eight colors, and one for the sixteen more, which
// are a grid of four by four. A color picked floods the window and is the studio's; the chair turns, and a
// photograph of it fills the window; who owns one is under the colors; BTS is a wall of how it is made, with a
// viewer over the whole window; the price is said only to someone logged in, and the chair is bought here, on
// the store's own page for it, dark as ArtStore's is, through to the receipt, which says what was earned. The
// Dock's icon takes the color and keeps it.
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
        still: /\/workspace\/chairs\/[a-z-]+\.webp$/.test(w.querySelector('img.st-still')?.getAttribute('src') ?? ''),
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
  const first = await p.evaluate((W) => { const w = document.querySelector(W); const r = w.getBoundingClientRect(); return { size: `${Math.round(r.width)}x${Math.round(r.height)}`, head: w.querySelector('.fl-head h1').innerText.replace(/\s*\n\s*/g, ' / '), lines: Math.round(w.querySelector('.fl-head h1').getBoundingClientRect().height / parseFloat(getComputedStyle(w.querySelector('.fl-head h1')).lineHeight)), sub: !!w.querySelector('.fl-head p'), slabs: [...w.querySelectorAll('.fl-slab')].map((s) => `${s.querySelector('b').textContent}: ${s.querySelector('small').textContent}`), mark: !!w.querySelector('.wxbar svg.mk path') && w.querySelector('.wxbar__home').innerText.trim(), money: /\$\d/.test(w.innerText), own: /your own/i.test(w.innerText) } }, W)
  check('it opens 1100 by 720, its mark drawn in its bar and on its icon, on the color selector, under "Your new daily driver" on two lines with nothing under it: a slab for each of the eight colors, each available now, and one for the sixteen more ("Custom Coloring", made to order); there is no "Your own"', first.size === '1100x720' && first.head === 'Your new daily driver' && first.lines === 2 && !first.sub && first.mark === 'Workspace' && iconBefore && first.slabs.join(' | ') === 'Matte Leather: Available now | Scuderia Red: Available now | Solar Orange: Available now | Alexandrite: Available now | Illusion Blue: Available now | Supersonic: Available now | Pearl Lavender: Available now | Mantis Green: Available now | Custom Coloring: Made to Order' && !first.own, JSON.stringify(first))
  check('no price is on the slabs for a visitor', !first.money, '')
  // (each slab holds its chair before it is pointed at, so that nothing is fetched, and nothing waited for, when it is)
  await p.waitForFunction((W) => [...document.querySelectorAll(`${W} .fl-slab img.ch`)].every((img) => img.complete), W, { timeout: 8000 }).catch(() => {})
  const held = await p.evaluate((W) => [...document.querySelectorAll(`${W} .fl-slab:not(.more)`)].map((s) => { const img = s.querySelector('img.ch'); return !!img && img.complete && img.naturalWidth > 0 && getComputedStyle(img).opacity === '0' }), W)
  check('each of the eight slabs holds its chair, loaded and unseen, before it is pointed at', held.length === 8 && held.every(Boolean), JSON.stringify(held))
  const asked = []
  const chairAsked = (r) => /\/workspace\/chairs\//.test(r.url()) && asked.push(r.url())
  p.on('request', chairAsked)
  await p.locator(`${W} .fl-slab`).nth(2).hover()
  const atOnce = await p.evaluate((W) => { const img = document.querySelector(`${W} .fl-slab.big img.ch`); return { there: !!img, seen: !!img && getComputedStyle(img).opacity, moving: !!img && img.getAnimations().length } }, W)
  check('pointed at, the chair is there at once: whole, with nothing fading it in and nothing fetched', atOnce.there && atOnce.seen === '1' && atOnce.moving === 0 && !asked.length, JSON.stringify({ atOnce, asked }))
  p.off('request', chairAsked)
  await p.waitForTimeout(600)
  const hover = await p.evaluate((W) => { const slabs = [...document.querySelectorAll(`${W} .fl-slab`)].map((s) => s.getBoundingClientRect().width); return { wider: slabs[2] > slabs[0] * 1.8, chair: (() => { const img = document.querySelector(`${W} .fl-slab.big img.ch`); return !!img && img.complete && img.naturalWidth > 0 && /\/workspace\/chairs\/solar-orange\.webp$/.test(img.currentSrc) })(), others: [...document.querySelectorAll(`${W} .fl-slab:not(.big) img.ch`)].every((img) => getComputedStyle(img).opacity === '0') } }, W)
  check('pointed at, a slab widens and shows the chair in its color, and no other slab shows one', hover.wider && hover.chair && hover.others, JSON.stringify(hover))

  // ---- a color picked: the studio
  await p.locator(`${W} .fl-slab`).nth(1).click()
  await p.waitForSelector(`${W} .fl.st`, { timeout: 8000 })
  await p.waitForTimeout(2600)
  let s = await studio()
  check('a color picked floods the window: the studio is that color, its name huge behind the chair, words that read on it', s.view === 'studio' && s.ground === 'rgb(255, 48, 44)' && s.ink === 'rgb(20, 20, 20)' && (s.word ?? '').toLowerCase() === 'scuderia red' && s.name === 'Scuderia Red' && s.dots === 9 && s.on === 'Scuderia Red', JSON.stringify(s))
  check('the name is set at 176, whole, inside the window', s.wordSize === 176 && s.wordFits, JSON.stringify({ size: s.wordSize, fits: s.wordFits }))
  const words = await p.evaluate((W) => document.querySelector(`${W} .fl.st`).innerText.replace(/\s*\n\s*/g, ' | '), W)
  check('a visitor is not told the price: the button is "Log in to enquire", with nothing written under it; its finish and how it is had are said in two tags', s.tags === 'High gloss | Available now' && s.buy === 'Log in to enquire' && !/\$\d/.test(words), JSON.stringify({ tags: s.tags, buy: s.buy }))
  check('nothing in the studio says the chair is a drawing, or that points bring a price down', !/drawn model|drawing, not a photograph|points bring it down|Points can take/i.test(words), words)
  check('the chair is there: a still of it at once (the 3D chair’s own picture, in this color), and the 3D chair over it where the browser can draw one', s.still && (s.drawn ? s.turn === 'Drag to turn · 0°' : true), JSON.stringify({ still: s.still, drawn: s.drawn, turn: s.turn }))
  if (s.drawn) {
    const table = await p.evaluate((W) => { const r = document.querySelector(`${W} .st-table`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }, W)
    await p.mouse.move(table.x, table.y)
    await p.mouse.down()
    await p.mouse.move(table.x + 90, table.y, { steps: 6 })
    await p.mouse.up()
    await p.waitForTimeout(500)
    const turned = (await studio()).turn
    check('a drag turns it, and the studio says how far', /^Drag to turn · (?!0°)\d+°$/.test(turned ?? ''), String(turned))
  }
  const icon = await p.evaluate(() => document.querySelector('.dock [data-dock-app="workspace"] svg stop:last-child')?.getAttribute('stop-color'))
  check('the Dock’s icon takes the color picked', icon === '#ff302c', String(icon))
  const tray = await p.evaluate((W) => { const d = document.querySelector(`${W} .fl-dock`).getBoundingClientRect(); const b = document.querySelector(`${W} .fl-btn`); return { tall: Math.round(d.height), dots: [...document.querySelectorAll(`${W} .fl-dot`)].map((x) => x.getAttribute('aria-label')).join(' | '), hand: getComputedStyle(b).cursor } }, W)
  check('the tray of colors is 70 tall: the eight, and the way to the sixteen more', tray.tall === 70 && tray.dots === 'Matte Leather | Scuderia Red | Solar Orange | Alexandrite | Illusion Blue | Supersonic | Pearl Lavender | Mantis Green | More colors', JSON.stringify(tray))
  check('the button shows the pointing hand', tray.hand === 'pointer', tray.hand)

  // ---- its gallery: Shrug's photographs of the chair in this color, a slide each beside the 3D chair. A slide
  // is a landscape photograph (it fills the window), two upright ones side by side (they fill it between
  // them) or one upright one (whole, inside it). Every color with one opens on its landscape render on a
  // backdrop of its color (Dom, 27 Nov: the upright render is not in the gallery); Scuderia Red's three
  // landscape photographs come after it
  const shots = await p.evaluate((W) => [...document.querySelectorAll(`${W} .st-shots .st-shot`)].map((b) => `${b.getAttribute('aria-label')}${b.getAttribute('aria-pressed') === 'true' ? '*' : ''}`).join(' | '), W)
  check('beside the chair are its pictures: the 3D chair, which is on show, and the slides of its gallery in this color', shots === 'The chair in 3D* | Photograph 1 of 4 | Photograph 2 of 4 | Photograph 3 of 4 | Photograph 4 of 4', shots)
  /** The photograph on show: how it is laid out, and each picture in it, measured against the window. */
  const photoAt = () => p.evaluate((W) => { const ph = document.querySelector(`${W} .st-photo`); const win = document.querySelector(`${W} .ss-window`).getBoundingClientRect(); const r = ph?.getBoundingClientRect(); const pics = [...(ph?.querySelectorAll('.st-photo__pic') ?? [])]; const back = ph?.querySelector('.st-photo__back'); const shade = ph?.querySelector('.st-photo__shade')?.getBoundingClientRect(); const foot = document.querySelector(`${W} .st-foot`)?.getBoundingClientRect(); return { fit: ph?.dataset.fit, fills: !!r && Math.abs(r.left - win.left) <= 1 && Math.abs(r.right - win.right) <= 1 && Math.abs(r.top - win.top) <= 1 && Math.abs(r.bottom - win.bottom) <= 1, pics: pics.map((x) => { const b = x.getBoundingClientRect(); return { left: Math.round(b.left - win.left), right: Math.round(win.right - b.right), top: Math.round(b.top - win.top), tall: Math.round(b.height), fit: getComputedStyle(x).objectFit, file: x.currentSrc.split('/').slice(-2).join('/') } }), winTall: Math.round(win.height), gap: pics.length === 2 ? Math.round(pics[1].getBoundingClientRect().left - pics[0].getBoundingClientRect().right) : null, behind: !!back && getComputedStyle(back).display !== 'none', loaded: pics.length > 0 && pics.every((x) => x.complete && x.naturalWidth > 0), alt: pics.map((x) => x.alt).join(' | '), shade: !!shade && shade.bottom >= win.bottom - 1 && shade.height > 60, on: document.querySelector(`${W} .st-shot[aria-pressed="true"]`)?.getAttribute('aria-label'), ink: getComputedStyle(document.querySelector(`${W} .ss-window`)).color } }, W)
  await p.locator(`${W} .st-shot[aria-label="Photograph 3 of 4"]`).click()
  // (it pushes in over the chair, and the words turn white once it has covered the window)
  await p.waitForTimeout(1500)
  let photo = await photoAt()
  check('a landscape photograph fills the window, edge to edge, with nothing dim round it and a shade at the foot for the words, which are white on it; it is Shrug’s own file, and says what it shows', photo.fills && photo.fit === 'fill' && photo.pics.length === 1 && photo.pics[0].left === 0 && photo.pics[0].right === 0 && photo.pics[0].tall === photo.winTall && photo.pics[0].fit === 'cover' && !photo.behind && photo.loaded && /^gallery\/02__5F4A0487-copy(-[sm]\.webp|\.jpg)$/.test(photo.pics[0].file) && photo.alt === 'Scuderia Red Workspace chair, base being spray-painted' && photo.shade && photo.on === 'Photograph 3 of 4' && photo.ink === 'rgb(255, 255, 255)', JSON.stringify(photo))
  await p.locator(`${W} .st-shot[aria-label="Photograph 1 of 4"]`).click()
  await p.waitForTimeout(1500)
  photo = await photoAt()
  check('the first is the render of the chair on a backdrop of its color: a landscape that fills the window, edge to edge, and says what it shows', photo.fills && photo.fit === 'fill' && photo.pics.length === 1 && photo.pics[0].left === 0 && photo.pics[0].right === 0 && photo.pics[0].fit === 'cover' && !photo.behind && photo.loaded && /^lead\/landscape(-[sm]\.webp|\.jpg)$/.test(photo.pics[0].file) && photo.alt === 'Scuderia Red Workspace chair, three-quarter view from behind, on a matching backdrop' && photo.on === 'Photograph 1 of 4', JSON.stringify(photo))
  await p.locator(`${W} .st-shot[aria-label="The chair in 3D"]`).click()
  await p.waitForTimeout(1200)
  check('and the 3D chair comes back when it is picked', (await p.locator(`${W} .st-photo`).count()) === 0 && (await studio()).still)
  await p.locator(`${W} .fl-dot[aria-label="Solar Orange"]`).click()
  await p.waitForTimeout(700)
  check('every color has a gallery of its own: Solar Orange’s landscape render and three photographs are beside its chair, and no upright render', (await p.locator(`${W} .st-shots .st-shot`).count()) === 5 && (await studio()).name === 'Solar Orange', '')
  await p.locator(`${W} .fl-dot[aria-label="Scuderia Red"]`).click()
  await p.waitForTimeout(700)

  // ---- who owns one, under the colors
  const owned = await p.evaluate((W) => { const o = document.querySelector(`${W} .fl-owners`); if (!o) return null; const d = document.querySelector(`${W} .fl-dock`).getBoundingClientRect(); return { says: o.innerText.replace(/\s+/g, ' ').trim(), faces: o.querySelectorAll('i, img, .face, span[aria-hidden]').length, under: o.getBoundingClientRect().top >= d.bottom - 2 } }, W)
  check('under the colors is who owns one, on the way to buying it: in words alone, with no dots of color before them', !!owned && /^Owned by .+ and \d+ more$/.test(owned.says) && owned.under && owned.faces === 0, JSON.stringify(owned))
  await p.locator(`${W} .fl-owners`).click()
  await p.waitForTimeout(700)
  s = await studio()
  const ow = await p.evaluate((W) => { const o = document.querySelector(`${W} .ow`); return { cards: o.querySelectorAll('.ow-card').length, seen: [...o.querySelectorAll('h1, h2, p')].filter((e) => !e.closest('.ow-card') && !e.classList.contains('sr-only') && e.getClientRects().length && getComputedStyle(e).position !== 'absolute').map((e) => e.textContent.trim()), text: o.innerText } }, W)
  check('it opens Notable Owners: a grid of cards, each in its owner’s color, with a way back to the color being looked at, and no heading or note over the cards', s.view === 'owners' && ow.cards === 6 && s.back === 'Back to Scuderia Red' && s.pills === 'BTS | Notable Owners*' && ow.seen.length === 0 && !/People who own one|Only owners who have agreed/i.test(ow.text), JSON.stringify({ s: s.pills, ow: { cards: ow.cards, seen: ow.seen } }))
  check('an owner’s card is their words, their name and their color: no picture of the chair on it', (await p.locator(`${W} .ow-card`).count()) === 6 && (await p.locator(`${W} .ow-card img, ${W} .ow-card canvas`).count()) === 0)
  await p.locator(`${W} .wxbar__back`).click()
  await p.waitForTimeout(600)
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
    return { seen: [...w.querySelectorAll('.bts h1, .bts h2, .bts > p, .bts header p')].filter((e) => !e.classList.contains('sr-only') && getComputedStyle(e).position !== 'absolute').map((e) => e.textContent.trim()), tiles: tiles.length, photos: tiles.filter((x) => x.querySelector('img')).length, films: tiles.filter((x) => x.querySelector('.bts-play')).length, columns: tops.size, heights: heights.size, display: getComputedStyle(box).display, loaded: [...w.querySelectorAll('.bts-tile img')].every((i) => i.complete && i.naturalWidth > 0) }
  }, W)
  s = await studio()
  check('BTS is in the bar, and opens a wall of how a chair is made, photographs and films, with no title or line over it', s.view === 'bts' && s.pills === 'BTS* | Notable Owners' && wall.tiles >= 6 && wall.photos === 4 && wall.films >= 1 && wall.loaded && wall.seen.length === 0, JSON.stringify({ s: s.pills, wall }))
  check('it is laid out as a wall, not as Notable Owners’ grid of cards: columns of pictures of different heights', wall.display !== 'grid' && wall.columns >= 3 && wall.heights >= 2, JSON.stringify(wall))
  // (scrolled down first: the viewer is the window's, wherever the wall has been scrolled to)
  await p.evaluate((W) => { document.querySelector(`${W} .bts`).scrollTop = 300 }, W)
  await p.waitForTimeout(300)
  await p.locator(`${W} .bts-tile button:has(img)`).nth(2).click()
  await p.waitForTimeout(600)
  const look = await p.evaluate((W) => { const d = document.querySelector(`${W} .bts-look`); const win = document.querySelector(`${W} .ss-window`).getBoundingClientRect(); const r = d?.getBoundingClientRect(); const img = d?.querySelector('img')?.getBoundingClientRect(); const x = d?.querySelector('.wx-x')?.getBoundingClientRect(); return { role: d?.getAttribute('role'), named: !!d?.getAttribute('aria-label'), covers: !!r && Math.abs(r.left - win.left) <= 1 && Math.abs(r.top - win.top) <= 1 && Math.abs(r.right - win.right) <= 1 && Math.abs(r.bottom - win.bottom) <= 1, whole: !!img && img.top >= win.top && img.bottom <= win.bottom && img.left >= win.left && img.right <= win.right && img.height > 200, words: d?.innerText.trim() ?? null, buttons: [...(d?.querySelectorAll('button') ?? [])].map((b) => b.getAttribute('aria-label')).join(' | '), xTopRight: !!x && win.right - x.right <= 24 && x.top - win.top <= 24, held: !!d?.contains(document.activeElement), outside: r ? { x: r.left + 14, y: r.top + r.height / 2 } : null } }, W)
  check('a picture opens large over the whole window, wherever the wall was scrolled to, and is shown whole', look.role === 'dialog' && look.named && look.covers && look.whole && look.held, JSON.stringify(look))
  check('the viewer has no words and no Done: only a small x at its top right', look.words === '' && look.buttons === 'Close' && look.xTopRight, JSON.stringify({ words: look.words, buttons: look.buttons, x: look.xTopRight }))
  await p.mouse.click(look.outside.x, look.outside.y)
  await p.waitForTimeout(300)
  check('a press beside the picture puts it away, and Workspace is still open on the wall', (await p.locator(`${W} .bts-look`).count()) === 0 && (await studio()).view === 'bts', '')
  await p.locator(`${W} .bts-tile button:has(img)`).first().click()
  await p.waitForTimeout(400)
  await p.keyboard.press('Escape')
  await p.waitForTimeout(300)
  check('so does Escape', (await p.locator(`${W} .bts-look`).count()) === 0, '')
  check('BTS has a Back to the color too', (await studio()).back === 'Back to Scuderia Red', String((await studio()).back))
  await p.locator(`${W} .wxbar__back`).click()
  await p.waitForTimeout(500)

  // ---- the price: for someone logged in. Asked for, the desk's Log In says why and keeps the color
  await p.locator(`${W} .fl-btn`).click()
  await p.waitForTimeout(500)
  const sheet = await p.evaluate(() => ({ head: document.querySelector('.account__head')?.textContent, lead: document.querySelector('.account__lead')?.textContent }))
  check('"Log in to enquire" lets down Log In, which says what for and that the color is kept', sheet.head === 'Log in to enquire' && sheet.lead === 'Scuderia Red is kept while you log in.', JSON.stringify(sheet))
  await logIn('riley@example.test', '4155550134', 'Riley Chen')
  s = await studio()
  check('logged in, the chair has its price and a button, and nothing written beside them: a painted chair from $1,200, to buy (the eight are in stock)', s.name === 'Scuderia Red' && s.buy === 'From $1,200 / Buy', s.buy)
  await p.locator(`${W} .fl-dot[aria-label="Matte Leather"]`).click()
  await p.waitForTimeout(700)
  s = await studio()
  check('Matte Leather is from $1,100, and can be bought now', s.name === 'Matte Leather' && s.tags === 'Matte | Available now' && s.buy === 'From $1,100 / Buy', JSON.stringify({ tags: s.tags, buy: s.buy }))

  // ---- the sixteen more: a grid of four by four over the window
  await p.locator(`${W} .fl-dot.more`).click()
  await p.waitForSelector(`${W} .mc-sheet`, { timeout: 8000 })
  await p.waitForTimeout(400)
  const more = await p.evaluate((W) => { const w = document.querySelector(W); const sheet = w.querySelector('.wx-more .mc-sheet'); const sw = [...w.querySelectorAll('.mc-swatch')]; const rows = new Set(sw.map((x) => Math.round(x.getBoundingClientRect().top))); const cols = new Set(sw.map((x) => Math.round(x.getBoundingClientRect().left))); const box = sheet.getBoundingClientRect(); const tops = sw.map((x) => x.getBoundingClientRect().top); const feet = sw.map((x) => x.getBoundingClientRect().bottom); return { role: sheet.getAttribute('role'), names: sw.map((x) => x.textContent.trim()), rows: rows.size, cols: cols.size, text: sheet.innerText, x: !!sheet.querySelector('.wx-x'), fills: Math.min(...tops) - box.top <= 16 && box.bottom - Math.max(...feet) <= 16, colored: sw.every((x) => getComputedStyle(x).backgroundImage !== 'none' || getComputedStyle(x).backgroundColor !== 'rgba(0, 0, 0, 0)') } }, W)
  check('the last dot lets down a sheet over the window: sixteen more colors, four by four, each a slab of its color with its own name on it', more.role === 'dialog' && more.names.length === 16 && more.rows === 4 && more.cols === 4 && more.x && more.colored && more.names.join(' | ') === 'Neutron Star | Gummi Berry | Luxury Bronze | Smurf | Nuclear Pink | Championship Green | Interstellar Black | Proton Sparkle | Reserve Green | Nuclear Green | Nuclear Violet | Dazzling Pink | Palleon Panther | Giallo Yellow | Manhattan Blue | Fractured Love', JSON.stringify(more.names))
  check('the colors fill the sheet, from its top to its foot, and nothing is written over them ("More colors", "16 more, each made to order")', more.fills && !/More colors|each made to order/i.test(more.text), JSON.stringify({ fills: more.fills, text: more.text.slice(0, 80) }))
  check('the sheet has no "Owned by" and no "Your own" in it', !/Owned by|Your own/i.test(more.text), more.text.slice(0, 200))
  await p.locator(`${W} .mc-swatch`, { hasText: 'Championship Green' }).click()
  await p.waitForFunction((W) => getComputedStyle(document.querySelector(`${W} .ss-window`)).backgroundColor === 'rgb(35, 134, 247)', W, { timeout: 15000 }).catch(() => {})
  await p.waitForTimeout(500)
  s = await studio()
  const moreIn = await p.evaluate((W) => { const w = document.querySelector(W); const o = w.querySelector('button.fl-owners'); const tags = w.querySelector('.st-tags').getBoundingClientRect(); const win = w.querySelector('.ss-window').getBoundingClientRect(); return { owners: !!o && o.getClientRects().length > 0 && getComputedStyle(o).visibility !== 'hidden', tagsLeft: Math.round(tags.left - win.left), tagsFoot: Math.round(win.bottom - tags.bottom), own: /your own/i.test(w.innerText), dots: [...w.querySelectorAll('.fl-dot')].map((d) => d.getAttribute('aria-label') + (d.classList.contains('on') ? '*' : '')).join(' | ') } }, W)
  check('one picked, the studio is in it: its name, its finish and "Made to Order · 2–3 weeks" at the bottom left, and no "Owned by" (nor "Your own")', s.view === 'studio' && s.name === 'Championship Green' && s.ground === 'rgb(11, 157, 110)' && s.tags === 'Metallic | Made to Order · 2–3 weeks' && !moreIn.owners && !moreIn.own && moreIn.tagsLeft < 80 && moreIn.tagsFoot < 90 && s.buy === 'From $1,200 / Order', JSON.stringify({ s: { name: s.name, ground: s.ground, tags: s.tags, buy: s.buy }, moreIn }))
  check('and it is added to the tray, where it stays for the visit, with the way to the sixteen still at the tray’s end', moreIn.dots === 'Matte Leather | Scuderia Red | Solar Orange | Alexandrite | Illusion Blue | Supersonic | Pearl Lavender | Mantis Green | Championship Green* | More colors', moreIn.dots)

  // ---- buying, in this window: the store's own page for that chair, dark as ArtStore's is (Dom, 27 Nov), through to the receipt
  await p.locator(`${W} .fl-dot[aria-label="Championship Green"]`).click()
  await p.waitForFunction((W) => getComputedStyle(document.querySelector(`${W} .ss-window`)).backgroundColor === 'rgb(11, 157, 110)', W, { timeout: 15000 }).catch(() => {})
  await p.waitForTimeout(500)
  s = await studio()
  check('a long name is set smaller, so that it does not run off the window', s.name === 'Championship Green' && s.wordSize < 176 && s.wordSize > 100 && s.wordFits && s.tags === 'Metallic | Made to Order · 2–3 weeks', JSON.stringify({ size: s.wordSize, fits: s.wordFits, tags: s.tags }))
  await p.locator(`${W} .fl-btn`).click()
  const f = p.frameLocator(`${W} .wx-buy iframe`)
  await f.locator('.ui-col .ui-btn').first().waitFor({ timeout: 20000 })
  await p.waitForTimeout(900)
  s = await studio()
  let at = await inFrame()
  const page = () => p.evaluate((W) => { const fr = document.querySelector(`${W} .wx-buy iframe`); const d = fr.contentDocument; const avg = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c); return m ? `${m[1]},${m[2]},${m[3]}` : c }; return { tint: d.documentElement.dataset.tint ?? null, ground: avg(getComputedStyle(d.body).backgroundColor), col: d.querySelector('.ui-col').innerText.replace(/\s*\n\s*/g, ' | '), title: d.querySelector('.ui-col h1, .ui-col .t-title')?.textContent.trim() } }, W)
  let pg = await page()
  check('Order opens the store’s page for that chair inside Workspace: no other window, a Back to the color, and their balance in the bar', s.view === 'buy' && (await p.evaluate(() => document.querySelector('.wf[data-active]')?.dataset.app)) === 'workspace' && at.path === '/vip/store/' && at.search === '?k=chairs&p=chair-championship-green' && s.back === 'Back to Championship Green' && s.wallet === '200', JSON.stringify({ view: s.view, at, back: s.back, wallet: s.wallet }))
  check('the page is dark, as ArtStore’s is: not drawn in the chair’s color but on the store’s own ground, and so is the window round it; and the chair is called by its color: "Championship Green", not "Workspace, …", with no "Chair" over it', pg.tint === null && pg.ground === '12,12,13' && s.ground === 'rgb(12, 12, 13)' && pg.title === 'Championship Green' && !/^Chair \|/.test(pg.col) && !/Workspace,/.test(pg.col), JSON.stringify(pg))
  check('it is priced in dollars, their points bring it down, and nothing says how much points can take off', /Price \| \$1,200 \|.*200 points \| of your 200 \| −\$20 \|.*Shipping \| \$70 \| Total \| \$1,250 \| Buy for \$1,250( \||$)/.test(pg.col) && !/Points can take up to/i.test(pg.col), pg.col)
  check('the chair’s page fits the window', at.over <= 0 && at.wide <= 0, JSON.stringify(at))
  // Its pictures are the renders of the chair on a backdrop of its color, and nothing else (Dom, 27 Nov): the
  // landscape first, which fills the panel and is cut to its middle where the panel is another shape, as
  // ArtStore's pictures made to fill are. (Championship Green has a landscape render and no upright one)
  await f.locator('.ui-media-pic').evaluate((img) => img.complete || new Promise((done) => { img.addEventListener('load', done, { once: true }); setTimeout(done, 8000) }))
  const media = await f.locator('.ui-media').evaluate((fig) => { const img = fig.querySelector('.ui-media-pic'); const a = fig.getBoundingClientRect(); const b = img.getBoundingClientRect(); const ground = fig.querySelector('.ui-media-ground'); return { src: img.currentSrc.split('/').slice(-2).join('/'), loaded: img.complete && img.naturalWidth >= 200, within: b.left >= a.left - 1 && b.right <= a.right + 1 && b.top >= a.top - 1 && b.bottom <= a.bottom + 1, tall: Math.abs(a.height - b.height) < 2, fit: getComputedStyle(img).objectFit, behind: !!fig.querySelector('.ui-media-bg'), ground: !!ground && /linear-gradient/.test(getComputedStyle(ground).backgroundImage) && Math.abs(ground.getBoundingClientRect().width - a.width) < 1, dots: fig.querySelectorAll('.ui-dots button').length, alt: img.alt, cover: Math.abs(a.left - b.left) < 2 && Math.abs(a.right - b.right) < 2 && Math.abs(a.top - b.top) < 2 && Math.abs(a.bottom - b.bottom) < 2, middle: getComputedStyle(img).objectPosition } })
  check('the chair’s picture is its landscape render, filling its panel edge to edge and cut to its middle, with nothing dim round it; it is the only one, and says what it shows', /^lead\/landscape(-[sm]\.webp|\.jpg)$/.test(media.src) && media.loaded && media.cover && media.fit === 'cover' && media.middle === '50% 50%' && !media.behind && !media.ground && media.dots === 0 && media.alt === 'Championship Green Workspace chair, three-quarter view from behind, on a matching backdrop', JSON.stringify(media))
  const rail = await f.locator('.ui-rail a, .ui-rail button').evaluateAll((els) => els.map((el) => el.textContent.replace(/\s+/g, ' ').trim()).join(' | '))
  const gaps = await f.locator('.ui-rail li').evaluateAll((els) => els.slice(0, 6).map((el, i, all) => (i ? Math.round(el.getBoundingClientRect().left - all[i - 1].getBoundingClientRect().right) : 99)))
  check('along its foot are the chair’s other colors, with room between them, and nothing of another store', /Scuderia Red/.test(rail) && /Mantis Green/.test(rail) && !/Art No|America Must Win|Chromatic/.test(rail) && gaps.every((g) => g >= 6), JSON.stringify({ rail: rail.slice(0, 160), gaps }))
  await f.locator('.ui-col .ui-btn').first().click()
  await f.locator('.ui-btn', { hasText: 'Pay with card' }).waitFor({ timeout: 20000 })
  await p.waitForTimeout(500)
  pg = await page()
  check('checkout is dark too, and names the chair by its color', pg.ground === '12,12,13' && /Checkout \| Championship Green/.test(pg.col) && !/Workspace,/.test(pg.col), JSON.stringify(pg))
  await f.locator('.ui-btn', { hasText: 'Pay with card' }).click()
  await f.locator('textarea.ui-area').waitFor({ timeout: 20000 })
  await f.locator('textarea.ui-area').fill('Riley Chen\n1 Example St\nSan Francisco, CA 94110')
  await p.waitForTimeout(900)
  await f.locator('.ui-col .ui-btn').last().click()
  await f.locator('.ui-check, .ui-earned').first().waitFor({ timeout: 20000 })
  await p.waitForTimeout(1200)
  pg = await page()
  s = await studio()
  check('bought: the receipt is dark too, and says what was earned: "You earned 200 points for this purchase."', pg.ground === '12,12,13' && /You earned 200 points for this purchase\./.test(pg.col), pg.col.slice(0, 500))
  check('the balance in the bar is theirs after it: the 100 spent, and 200 earned', s.wallet === '200', String(s.wallet))
  const after = await p.evaluate((W) => { const d = document.querySelector(`${W} .wx-buy iframe`).contentDocument; return { yours: [...d.querySelectorAll('.ui-media *, .ui-shot *, figure *')].filter((e) => /^Yours$/.test(e.textContent.trim())).length, drawing: /A drawing, not a photograph/i.test(d.body.innerText) } }, W)
  check('nothing over the picture says "Yours", or that it is a drawing', after.yours === 0 && !after.drawing, JSON.stringify(after))
  // another color picked along the foot is the studio's color too; the page stays dark
  await f.locator('.ui-rail a', { hasText: 'Solar Orange' }).first().click()
  await p.waitForTimeout(1200)
  at = await inFrame()
  pg = await page()
  check('another color picked along the foot: the page is that chair’s, and still dark', /p=chair-solar-orange/.test(at.search) && !/[?&]c=/.test(at.search) && pg.ground === '12,12,13' && pg.title === 'Solar Orange', JSON.stringify({ at, pg: { ground: pg.ground, title: pg.title } }))
  await p.locator(`${W} .wxbar__back`).click()
  // (the cove eases to the color, and the 3D chair is drawn again meanwhile, which a machine with no GPU is slow at)
  await p.waitForFunction((W) => getComputedStyle(document.querySelector(`${W} .ss-window`)).backgroundColor === 'rgb(255, 121, 0)', W, { timeout: 15000 }).catch(() => {})
  s = await studio()
  check('Back comes to the chair in it', s.view === 'studio' && s.name === 'Solar Orange' && s.ground === 'rgb(255, 121, 0)', JSON.stringify({ view: s.view, name: s.name, ground: s.ground }))

  // ---- a color-shifting paint
  await p.locator(`${W} .fl-dot[aria-label="Alexandrite"]`).click()
  await p.waitForTimeout(900)
  s = await studio()
  check('Alexandrite is color-shifting: the cove is its colors, and it says to turn it', s.image === 'linear-gradient' && s.tags === 'Color-shifting | Available now' && /Turn it to see it shift\.$/.test(await p.locator(`${W} .fl-info p`).innerText()), JSON.stringify(s))
  check('nothing went wrong on the way', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))

  // ---- a gallery with upright photographs in it: two side by side are one slide
  // (one upright photograph by itself is shown whole inside the window, on a blur of itself: none of the
  // twenty-four has one since Dazzling Pink's photographs became the Luxury Pink set, all landscapes, on 27 Nov)
  const fromSheet = async (name) => {
    await p.locator(`${W} .fl-dot.more`).click()
    await p.waitForSelector(`${W} .mc-sheet`, { timeout: 8000 })
    await p.waitForTimeout(400)
    await p.locator(`${W} .mc-swatch`, { hasText: name }).click()
    await p.waitForTimeout(1500)
  }
  const strip = () => p.evaluate((W) => [...document.querySelectorAll(`${W} .st-shots .st-shot`)].map((b) => b.getAttribute('aria-label')).join(' | '), W)
  await fromSheet('Giallo Yellow')
  check('Giallo Yellow has its landscape render, two landscape photographs and a pair of upright ones: its gallery is four slides', (await strip()) === 'The chair in 3D | Photograph 1 of 5 | Photograph 2 of 5 | Photograph 3 of 5 | Photographs 4 and 5 of 5', await strip())
  await p.locator(`${W} .st-shot[aria-label="Photographs 4 and 5 of 5"]`).click()
  await p.waitForTimeout(1500)
  photo = await photoAt()
  check('two upright photographs are one slide: side by side and a hair apart, they fill the window between them, with nothing dim round them', photo.fills && photo.fit === 'pair' && photo.pics.length === 2 && photo.pics[0].left === 0 && photo.pics[1].right === 0 && photo.winTall > 0 && photo.pics.every((x) => x.tall === photo.winTall && x.fit === 'cover') && photo.gap >= 1 && photo.gap <= 5 && !photo.behind && photo.loaded && /pair-left/.test(photo.pics[0].file) && /pair-right/.test(photo.pics[1].file) && photo.alt === 'Giallo Yellow Workspace chair, outdoors | Giallo Yellow Workspace chair, outdoors', JSON.stringify(photo))
  await p.locator(`${W} .st-shot[aria-label="The chair in 3D"]`).click()
  await p.waitForTimeout(1100)
  await fromSheet('Interstellar Black')
  check('Interstellar Black’s gallery is its landscape render and one pair, and that is all there is beside its chair', (await strip()) === 'The chair in 3D | Photograph 1 of 3 | Photographs 2 and 3 of 3', await strip())
  // (and back to Alexandrite, which is the color the visit is left in)
  await p.locator(`${W} .fl-dot[aria-label="Alexandrite"]`).click()
  await p.waitForTimeout(900)
  check('nothing went wrong among the photographs', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))

  // ---- a window of another size: the type, the tray and the chair are as large for it as they are when it opens
  const sized = () => p.evaluate((W) => { const w = document.querySelector(W); const px = (sel, prop = 'fontSize') => parseFloat(getComputedStyle(w.querySelector(sel))[prop]); const win = w.querySelector('.ss-window').getBoundingClientRect(); return { win: `${Math.round(win.width)}x${Math.round(win.height)}`, name: px('.fl-info h2'), dot: Math.round(w.querySelector('.fl-dot:not(.on)').getBoundingClientRect().width), tray: Math.round(w.querySelector('.fl-dock').getBoundingClientRect().height), chair: Math.round(w.querySelector('.st-table').getBoundingClientRect().height), btn: Math.round(w.querySelector('.fl-btn').getBoundingClientRect().height) } }, W)
  const asOpened = await sized()
  const drag = async (dx, dy) => { const g = await p.locator(`${W} .wf__grip[data-edge="se"]`).boundingBox(); const x = g.x + g.width / 2; const y = g.y + g.height / 2; await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + dx / 2, y + dy / 2, { steps: 3 }); await p.mouse.move(x + dx, y + dy, { steps: 3 }); await p.mouse.up(); await p.waitForTimeout(700) }
  await drag(-200, -100)
  const smaller = await sized()
  check('the window opens with the color’s name at 34, dots of 36 in a tray 70 tall, and the chair 470 tall', asOpened.win === '1100x720' && asOpened.name === 34 && asOpened.dot === 36 && asOpened.tray === 70 && asOpened.chair === 470 && asOpened.btn === 50, JSON.stringify(asOpened))
  check('dragged smaller, its type and its tray are smaller with it (the chair keeps the height it has room for)', smaller.win === '900x620' && smaller.name < 29 && smaller.name > 26 && smaller.dot === 30 && smaller.tray < 60 && smaller.btn < 44 && smaller.chair >= 440, JSON.stringify(smaller))
  await drag(200, 100)
  check('and dragged back, they are as they were', JSON.stringify(await sized()) === JSON.stringify(asOpened), JSON.stringify(await sized()))

  // ---- closed and opened again, it is on the color selector; and the next visit keeps the color for the Dock
  await p.locator(`${W} button[aria-label^="Close"]`).click()
  await p.waitForTimeout(600)
  await p.click('.dock [data-dock-app="workspace"]')
  await p.waitForSelector(`${W}[data-open] .fl-slab`, { timeout: 15000 })
  await p.waitForTimeout(500)
  check('opened again, it is on the color selector, not where it was left', (await studio()).view === 'first', (await studio()).view)
  await p.reload({ waitUntil: 'load' })
  await p.waitForTimeout(1800)
  const kept = await p.evaluate(() => document.querySelector('.dock [data-dock-app="workspace"] svg stop:last-child')?.getAttribute('stop-color'))
  check('on the next visit the Dock’s icon is still in the color picked (Alexandrite: its shifting colors, the last of them here)', kept === '#b47e62', String(kept))
  await p.click('.dock [data-dock-app="myvip"]')
  await p.waitForSelector('.wf[data-app="myvip"][data-open] iframe.storewin__frame', { timeout: 20000 })
  const v = p.frameLocator('.wf[data-app="myvip"] iframe.storewin__frame')
  await v.locator('.mc').first().waitFor({ timeout: 20000 })
  await p.waitForTimeout(600)
  const mine = (await v.locator('body').innerText()).replace(/\s*\n\s*/g, ' | ')
  check('the chair is in My VIP, with what it earned: 200 points awarded for it', /Championship Green/.test(mine) && /Awarded for .*Championship Green[^|]*\| [^|]*\| ?\+200|\+200/.test(mine) && /Balance \| 200/.test(mine), mine.slice(mine.indexOf('Purchase history'), mine.indexOf('Purchase history') + 420))
  // ---- loaded again, the studio's tray is the eight: what was added to it on the last visit is not on it (Dom, 27 Nov)
  await p.click('.dock [data-dock-app="workspace"]')
  await p.waitForSelector(`${W}[data-open] .fl-slab`, { timeout: 15000 })
  await p.waitForTimeout(500)
  await p.locator(`${W} .fl-slab`).nth(1).click()
  await p.waitForSelector(`${W} .fl-dock .fl-dot`, { timeout: 15000 })
  await p.waitForTimeout(900)
  const again = await p.evaluate((W) => [...document.querySelectorAll(`${W} .fl-dot`)].map((x) => x.getAttribute('aria-label')).join(' | '), W)
  check('loaded again, a color picked from the eight opens the studio on the eight: the colors added last visit are in the grid, not on the tray', again === 'Matte Leather | Scuderia Red | Solar Orange | Alexandrite | Illusion Blue | Supersonic | Pearl Lavender | Mantis Green | More colors' && (await p.evaluate(() => window.localStorage.getItem('shrug:workspace.bar.v1'))) === null, again)
  await p.locator(`${W} button[aria-label^="Close"]`).click()
  await p.waitForTimeout(600)
  check('nothing went wrong on the way (after the reload)', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- the push (Niv, 27 Nov): on a desk that is not asked to keep still, the chair's photographs come in by
  // themselves after it has been looked at a while, each pushing the last off, until a picture is picked
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'empty' })
  p = t.page
  await p.waitForSelector('.dock [data-dock-app="workspace"]', { timeout: 20000 })
  await p.click('.dock [data-dock-app="workspace"]')
  await p.waitForSelector(`${W}[data-open] .fl-slab`, { timeout: 15000 })
  await p.waitForTimeout(600)
  await p.locator(`${W} .fl-slab`).nth(2).click()
  await p.waitForSelector(`${W} .fl.st`, { timeout: 8000 })
  const onStage = () => p.evaluate((W) => ({ on: document.querySelector(`${W} .st-shot[aria-pressed="true"]`)?.getAttribute('aria-label') ?? null, photo: document.querySelector(`${W} .fl`).hasAttribute('data-photo'), next: document.querySelector(`${W} .st-shot[data-next]`)?.getAttribute('aria-label') ?? null, ready: [...document.querySelectorAll(`${W} .st-photo[data-ahead] .st-photo__pic`)].every((i) => i.complete && i.naturalWidth > 0), layers: [...document.querySelectorAll(`${W} .st-photo`)].map((l) => (l.dataset.enter ? `in ${l.dataset.enter}` : l.dataset.leave ? `out ${l.dataset.leave}` : l.hasAttribute('data-ahead') ? 'ahead' : 'on')).join(' | ') }), W)
  await p.waitForTimeout(3000)
  let stageNow = await onStage()
  check('to begin with it is the chair in 3D, with its first photograph marked as the one that comes next and held ready, out of sight', stageNow.on === 'The chair in 3D' && !stageNow.photo && stageNow.next === 'Photograph 1 of 4' && stageNow.layers === 'ahead' && stageNow.ready, JSON.stringify(stageNow))
  await p.waitForSelector(`${W} .st-photo[data-enter]`, { timeout: 12000 })
  stageNow = await onStage()
  const moving = await p.evaluate((W) => { const l = document.querySelector(`${W} .st-photo[data-enter]`); const win = document.querySelector(`${W} .ss-window`).getBoundingClientRect(); return { left: Math.round(l.getBoundingClientRect().left - win.left), chair: getComputedStyle(document.querySelector(`${W} .st-table`)).visibility } }, W)
  check('after a while its first photograph pushes in from the right, over the chair, which is still there under it as it comes', stageNow.on === 'Photograph 1 of 4' && /^in 1/.test(stageNow.layers) && !stageNow.photo && moving.left > 0 && moving.chair === 'visible', JSON.stringify({ stageNow, moving }))
  await p.waitForTimeout(1100)
  stageNow = await onStage()
  check('it fills the window, and the next is marked in its turn', stageNow.on === 'Photograph 1 of 4' && stageNow.photo && stageNow.next === 'Photograph 2 of 4' && /^on/.test(stageNow.layers), JSON.stringify(stageNow))
  await p.waitForFunction((W) => document.querySelector(`${W} .st-shot[aria-pressed="true"]`)?.getAttribute('aria-label') === 'Photograph 2 of 4', W, { timeout: 9000 }).catch(() => {})
  stageNow = await onStage()
  check('and the next pushes that one off, the two going as one', stageNow.on === 'Photograph 2 of 4' && /out 1/.test(stageNow.layers) && /in 1/.test(stageNow.layers), JSON.stringify(stageNow))
  await p.waitForTimeout(900)
  await p.locator(`${W} .st-shot[aria-label="The chair in 3D"]`).click()
  await p.waitForTimeout(11000)
  stageNow = await onStage()
  check('a picture picked, nothing comes in by itself again: the chair, asked for, is still there a long while after', stageNow.on === 'The chair in 3D' && !stageNow.photo && stageNow.next === null && stageNow.layers === '', JSON.stringify(stageNow))
  check('nothing went wrong on the way (the push)', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error('FAILED', e.message.split('\n').slice(0, 10).join('\n'))
  process.exit(1)
})
