// Fixer T's VIP checks, run by terminal-vip.cjs (which hands over its helpers).
// Three views of the same library: a visitor's (nothing has arrived: quiet tiles, nothing counted), the editor's
// (`?draft`: the slots and what each is waiting for), and one with pictures in three slots (dev server only: the
// data module is swapped under the page, the repo is not touched).

/** The drops module with three photos given a file (the site's own link-preview picture) and one a sender. */
const WITH_FILES = (js) => {
  const from = 'from: null, src: null'
  if (!js.includes(from)) throw new Error('src/data/drops.ts has changed shape: the swap in terminal-vip-pictures.cjs needs another look')
  return js.replace(from, 'from: drop === "Billboards" ? "A Founder" : null, src: kind === "photo" && ["Deep Tech Mat", "Billboards", "VC Sticker Pack"].includes(drop) ? "/og.png" : null')
}

/** In the page: the worst contrast between each tile's name and the two ends of the gradient under it. */
const worstInk = (tiles, nameSel, groundSel) =>
  tiles.evaluateAll(
    (els, [nameSel, groundSel]) => {
      const parts = (c) => {
        const n = c.match(/[\d.]+/g).map(Number)
        const rgb = c.startsWith('color(') ? n.slice(0, 3) : n.slice(0, 3).map((v) => v / 255)
        return { rgb, a: n[3] === undefined ? 1 : n[3] }
      }
      const lum = (rgb) => { const [r, g, b] = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
      const over = (fg, bg) => fg.rgb.map((v, i) => v * fg.a + bg[i] * (1 - fg.a))
      let worst = Infinity
      for (const el of els) {
        const name = el.querySelector(nameSel)
        if (!name) continue
        const ground = groundSel ? el.querySelector(groundSel) : el
        const ends = (getComputedStyle(ground).backgroundImage.match(/(color\([^)]+\)|rgba?\([^)]+\))/g) || []).map((c) => parts(c).rgb)
        const ink = parts(getComputedStyle(name).color)
        for (const end of ends) {
          const [hi, lo] = [lum(over(ink, end)), lum(end)].sort((x, y) => y - x)
          worst = Math.min(worst, (hi + 0.05) / (lo + 0.05))
        }
      }
      return worst
    },
    [nameSel, groundSel],
  )

exports.vipChecks = async ({ A, browser, BASE, DEV, check, shot, arrived, swap }) => {
  const SLOT = /\bslot\b|\[name\]|not supplied/i

  // ================= the iPhone, as a visitor
  let t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still&open=vip' })
  let p = t.page
  await arrived(p)
  const top = () => p.locator('.sb-slot[data-front] .ios-page[data-pos="top"]')
  await top().locator('.photos-tile').first().waitFor({ timeout: 15000 })
  await p.waitForTimeout(800)
  let text = await p.locator('.sb-slot[data-front]').innerText()
  check('phone: twelve tiles, none a wireframe (UX-5)', (await top().locator('.photos-tile').count()) === 12 && !SLOT.test(text), text.match(SLOT)?.[0])
  const names = await top().locator('.photos-pic__name').allInnerTexts()
  check('phone: each tile carries its drop', names.length === 12 && names[0] === 'Deep Tech Mat' && names[3] === 'Billboards', names.slice(0, 4).join(' | '))
  const note = (await top().locator('.photos-note').innerText()).replace(/\s+/g, ' ')
  check('phone: nothing is counted that is not there; the line says they are on their way', note === 'From the people who got a drop. The first ones are on their way.' && !/\d+ (Photo|Video)/.test(text), note)
  check('phone: a tile says what it is and that it is on its way', (await top().locator('.photos-tile').first().getAttribute('aria-label')) === 'Photo from Deep Tech Mat, on its way')
  const ink = await worstInk(top().locator('.photos-tile'), '.photos-pic__name', '.photos-pic__slot')
  check('phone: the name on every tile reads (4.5:1 or better, at the worse end of its ground)', ink >= 4.5 && ink < 22, ink.toFixed(2))
  const tabs = await top().locator('.ios-tabs__item').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)))
  check('phone: the tabs keep their 96px where there is room', tabs.length >= 2 && tabs.every((w) => w === 96), tabs.join())
  await shot(p, 'vip-phone-library')

  await top().locator('.photos-tile').first().tap()
  await p.waitForTimeout(1100)
  const big = (await top().locator('.photos-page:not([inert]) .photos-big').innerText()).replace(/\s+/g, ' ')
  check('phone: opened, the same tile large: its drop, "On its way"', /Deep Tech Mat/.test(big) && /on its way/i.test(big) && !SLOT.test(big), big)
  const tools = await top().locator('.photos-tools button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  check('phone: no Share for a tile with nothing to share', tools.join() === 'Favorite,Info', tools.join())
  check('phone: the viewer is dark, so its focus ring is white (AX-5)', (await top().locator('.photos-viewer').evaluate((el) => getComputedStyle(el).getPropertyValue('--ring').trim())) === '#fff')
  await shot(p, 'vip-phone-viewer')
  await top().locator('.photos-tools button[aria-label="Info"]').tap()
  await p.waitForTimeout(900)
  const info = (await p.locator('.sb-slot[data-front] .ios-sheet').innerText()).replace(/\s+/g, ' ')
  check('phone: Info has no "From" while that is not known, and says it has not come in', /Drop Deep Tech Mat/.test(info) && /Kind Photo/.test(info) && !/From/.test(info) && /This one hasn’t come in yet\. It shows here when it does\./.test(info), info)
  await shot(p, 'vip-phone-info')
  await p.keyboard.press('Escape')
  await p.waitForTimeout(700)
  await A.at(p, 'photos', [])
  await p.locator('.sb-slot[data-front] .ios-tabs__item:visible', { hasText: 'Collections' }).first().tap()
  await p.waitForTimeout(800)
  const cards = await top().locator('.photos-tab[data-on] .photos-album').evaluateAll((els) => els.slice(0, 4).map((e) => [e.querySelector('.photos-album__name').textContent, e.querySelector('.photos-album__count').childNodes[0].textContent.trim()]))
  check('phone: an album counts what has arrived (nothing: no nought); Favorites counts its own', cards[0][0] === 'Favorites' && cards[0][1] === '0' && cards[1][0] === 'Deep Tech Mat' && cards[1][1] === '', JSON.stringify(cards))
  const videos = (await top().locator('.photos-tab[data-on] .ios-cell', { hasText: 'Videos' }).first().innerText()).replace(/\s+/g, ' ').trim()
  check('phone: Media Types › Videos carries no count of what is not there', videos === 'Videos', videos)
  await A.at(p, 'photos', ['a:Deep Tech Mat'])
  const album = (await top().innerText()).replace(/\s+/g, ' ')
  check('phone: an album says its pictures are on their way', /Deep Tech Mat On their way/.test(album) && (await top().locator('.photos-pic__name').allInnerTexts()).every((n) => n === 'On its way') && !SLOT.test(album), album.slice(0, 120))
  await shot(p, 'vip-phone-album')
  check('phone: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ================= a favourite is kept for the tab (MK-7)
  t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still&open=vip' })
  p = t.page
  await arrived(p)
  await top().locator('.photos-tile').first().waitFor({ timeout: 15000 })
  await p.waitForTimeout(700)
  await top().locator('.photos-tile').nth(2).tap()
  await p.waitForTimeout(1100)
  await top().locator('.photos-tools button[aria-label="Favorite"]').tap()
  await p.waitForTimeout(300)
  check('a favourite is written to the tab\'s own storage', (await p.evaluate(() => sessionStorage.getItem('shrug:vip:loved'))) === '[2]')
  await p.reload()
  await arrived(p)
  await p.waitForTimeout(1500)
  const kept = await top().locator('.photos-tools button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  check('after a reload it is still a favourite (MK-7)', kept.includes('Unfavorite'), kept.join())
  await A.at(p, 'photos', ['favorites'])
  check('and Favorites holds it', (await top().locator('.photos-tile').count()) === 1)
  await t.ctx.close()
  // a frame that is refused storage: everything works, nothing is kept, nothing is thrown
  t = await A.open(browser, { device: 'iphone', base: BASE, goto: false })
  p = t.page
  await p.addInitScript(() => {
    const refuse = () => { throw new DOMException('refused', 'SecurityError') }
    Object.defineProperty(window, 'sessionStorage', { get: refuse })
  })
  await p.goto(BASE + '?still&open=vip')
  await arrived(p)
  await top().locator('.photos-tile').first().waitFor({ timeout: 15000 })
  await p.waitForTimeout(700)
  await top().locator('.photos-tile').nth(2).tap()
  await p.waitForTimeout(1100)
  await top().locator('.photos-tools button[aria-label="Favorite"]').tap()
  await p.waitForTimeout(300)
  const refused = await top().locator('.photos-tools button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  check('with storage refused: the heart still works, and nothing is thrown', refused.includes('Unfavorite') && t.errors.filter((e) => /pageerror/.test(e) && /photos|Photos|loved/i.test(e)).length === 0, refused.join() + ' ' + t.errors.filter((e) => /pageerror/.test(e)).join(' | ').slice(0, 200))
  await t.ctx.close()

  // ================= the iPhone at its narrowest (PH-7)
  t = await A.open(browser, { device: 'fold', base: BASE, query: 'still&open=vip' })
  p = t.page
  await arrived(p)
  await top().locator('.photos-tile').first().waitFor({ timeout: 15000 })
  await p.waitForTimeout(800)
  const foot = await top().locator('.ios-foot').first().evaluate((el) => [...el.querySelectorAll('.ios-tabs, .ios-tabs__item, .ios-button')].map((e) => { const r = e.getBoundingClientRect(); return [e.className.split(' ').pop(), Math.round(r.left), Math.round(r.right)] }))
  check('280px: the tab bar and the search button are wholly on the screen (PH-7)', foot.length >= 4 && foot.every(([, l, r]) => l >= 0 && r <= 280), JSON.stringify(foot))
  const inside = await top().locator('.ios-foot').first().evaluate((el) => [...el.querySelectorAll('.ios-tabs__item')].map((item) => { const a = item.getBoundingClientRect(); const b = item.querySelector('.ios-tabs__label').getBoundingClientRect(); return [Math.round(a.width), b.left >= a.left && b.right <= a.right] }))
  check('280px: each tab is wide enough for its name', inside.length === 2 && inside.every(([w, fits]) => w >= 70 && fits), JSON.stringify(inside))
  await shot(p, 'vip-fold-library')
  await t.ctx.close()

  // ================= the iPhone, as the editor (?draft)
  t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still&draft&open=vip' })
  p = t.page
  await arrived(p)
  await top().locator('.photos-tile').first().waitFor({ timeout: 15000 })
  await p.waitForTimeout(800)
  text = (await top().innerText()).replace(/\s+/g, ' ')
  check('phone, ?draft: the slots are counted as before', /8 Photos, 4 Videos From the people who got a drop\./.test(text), text.slice(-120))
  await top().locator('.photos-tile').first().tap()
  await p.waitForTimeout(1100)
  check('phone, ?draft: opened, it is the slot', /Photo slot/i.test(await top().locator('.photos-page:not([inert]) .photos-big').innerText()))
  check('phone, ?draft: Share is there', (await top().locator('.photos-tools button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).join() === 'Share,Favorite,Info')
  await top().locator('.photos-tools button[aria-label="Info"]').tap()
  await p.waitForTimeout(900)
  check('phone, ?draft: Info says what has not been supplied', /From\s*Not supplied yet/.test(await p.locator('.sb-slot[data-front] .ios-sheet').innerText()))
  await t.ctx.close()

  // ================= the desktop, as a visitor
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&open=vip' })
  p = t.page
  await arrived(p)
  const win = p.locator('.wf[data-app="photos"]')
  await win.locator('.vip-tile').first().waitFor({ timeout: 15000 })
  await p.waitForTimeout(900)
  text = await win.innerText()
  const tiles = await win.locator('.vip-tile').evaluateAll((els) => els.map((e) => [e.tagName, e.className.includes('vip-tile--quiet'), e.querySelector('.vip-tile__name')?.childNodes[0].textContent]))
  check('desktop: twelve quiet tiles with their drops, none a button, no wireframe words (UX-5)', tiles.length === 12 && tiles.every(([tag, quiet, name]) => tag === 'FIGURE' && quiet && name) && !SLOT.test(text), JSON.stringify(tiles.slice(0, 2)) + (text.match(SLOT)?.[0] ?? ''))
  const dink = await worstInk(win.locator('.vip-tile--quiet'), '.vip-tile__name', null)
  check('desktop: the name on every tile reads (4.5:1 or better)', dink >= 4.5 && dink < 22, dink.toFixed(2))
  check('desktop: the heading says they are on their way', (await win.locator('.vip__sub').innerText()) === 'From the people who got a drop. The first ones are on their way.')
  const side = await win.locator('.side-item').evaluateAll((els) => els.slice(0, 3).map((e) => [e.querySelector('.side-item__name').textContent, e.querySelector('.side-item__count')?.textContent ?? null]))
  check('desktop: "All Drops" counts the drops (11); a drop counts nothing that is not there', side[0][0] === 'All Drops' && side[0][1] === '11' && side[1][1] === null, JSON.stringify(side))
  const seg = win.locator('.seg')
  check('desktop: All / Photos / Videos carry no counts yet', (await seg.innerText()).replace(/\s+/g, ' ').trim() === 'All Photos Videos', await seg.innerText())
  await seg.focus()
  const before = await seg.getAttribute('aria-activedescendant')
  await p.keyboard.press('ArrowRight')
  await p.waitForTimeout(250)
  const after = await seg.getAttribute('aria-activedescendant')
  const checked = await p.evaluate((id) => document.getElementById(id)?.getAttribute('aria-checked'), after)
  check('desktop: the filter says which part the arrows are on (AX-11)', before === 'vip-show-all' && after === 'vip-show-photo' && checked === 'true', [before, after, checked].join())
  await p.keyboard.press('ArrowLeft')
  const body = await win.locator('.vip__body').evaluate((el) => [el.tabIndex, el.getAttribute('aria-label'), el.getAttribute('role')])
  check('desktop: the grid can be reached and scrolled from the keyboard anywhere (AX-22)', body[0] === 0 && body[1] === 'Photos and videos', body.join())
  const grey = await win.locator('.vip__sub').evaluate((el) => getComputedStyle(el).color)
  await shot(p, 'vip-desktop')
  // a drop with no videos, asked for its videos
  await win.locator('.side-item', { hasText: 'Billboards' }).click()
  await win.locator('.seg [data-target="video"]').click()
  await p.waitForTimeout(400)
  const none = (await win.locator('.vip__none').innerText()).replace(/\s+/g, ' ').trim()
  check('desktop: nothing of a kind is said in the one shape (UX-19)', none === 'No Videos Videos from this drop will show up here.', none)
  check('desktop: and in a grey that reads (AX-15)', (await win.locator('.vip__none > span').evaluate((el) => getComputedStyle(el).color)) === grey && grey === 'rgb(99, 100, 107)', grey)
  check('desktop: the window is named for the drop', (await win.locator('.ss-window__heading').first().innerText()) === 'Billboards')
  await win.locator('.side-item', { hasText: 'All Drops' }).click()
  await p.waitForTimeout(300)
  check('desktop: and "All Drops" for all of them (UX-19)', (await win.locator('.ss-window__heading').first().innerText()) === 'All Drops')
  check('desktop: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ================= the desktop, as the editor
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&draft&open=vip' })
  p = t.page
  await arrived(p)
  const dwin = p.locator('.wf[data-app="photos"]')
  await dwin.locator('.vip-tile').first().waitFor({ timeout: 15000 })
  await p.waitForTimeout(700)
  text = (await dwin.innerText()).replace(/\s+/g, ' ')
  check('desktop, ?draft: the slots, the names wanted and the counts, as before', /PHOTO SLOT/i.test(text) && /\[Name\]/.test(text) && /All 12/.test(text) && /Photos 8/.test(text) && /Videos 4/.test(text), text.slice(0, 200))
  await shot(p, 'vip-desktop-draft')
  await t.ctx.close()

  // ================= the desktop, with a finger (tb-8)
  t = await A.open(browser, { device: 'ipad-land', base: BASE, query: 'still&open=vip' })
  p = t.page
  await arrived(p)
  await p.locator('.wf[data-app="photos"] .vip-tile').first().waitFor({ timeout: 15000 })
  await p.waitForTimeout(700)
  const parts = await p.locator('.wf[data-app="photos"] .seg .ss-seg__option').evaluateAll((els) => els.map((e) => [Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)]))
  check('touch: the filter\'s parts are a finger\'s size, about 40x36 (tb-8)', parts.length === 3 && parts.every(([w, h]) => w >= 40 && h >= 36), JSON.stringify(parts))
  await p.locator('.wf[data-app="photos"] .seg [data-target="video"]').tap()
  await p.waitForTimeout(400)
  check('touch: a tap on a part switches it', (await p.locator('.wf[data-app="photos"] .vip-tile').count()) === 4)
  await t.ctx.close()

  // ================= with pictures in three slots (dev server only)
  if (!DEV) return console.log('skip the checks with pictures in the slots: they need the dev server')

  t = await A.open(browser, { device: 'desktop', base: BASE, goto: false })
  p = t.page
  await swap(p, 'src/data/drops.ts', WITH_FILES)
  await p.goto(BASE + '?still&open=vip')
  await arrived(p)
  const fwin = p.locator('.wf[data-app="photos"]')
  await fwin.locator('.vip-tile').first().waitFor({ timeout: 15000 })
  await p.waitForTimeout(900)
  const kinds = await fwin.locator('.vip-tile').evaluateAll((els) => els.map((e) => e.tagName + (e.className.includes('--open') ? ':open' : e.className.includes('--quiet') ? ':quiet' : '')))
  check('with pictures: a tile that has its file is a button, the rest are not (DK-19)', kinds.filter((k) => k === 'BUTTON:open').length === 3 && kinds.filter((k) => k === 'FIGURE:quiet').length === 9, kinds.join(' '))
  check('with pictures: the heading and the counts are of what has arrived', (await fwin.locator('.vip__sub').innerText()) === 'Photos and videos from the people who got one.' && (await fwin.locator('.seg').innerText()).replace(/\s+/g, ' ').trim() === 'All 3 Photos 3 Videos', (await fwin.locator('.seg').innerText()).replace(/\s+/g, ' '))
  const billboards = await fwin.locator('.side-item', { hasText: 'Billboards' }).locator('.side-item__count').innerText()
  check('with pictures: a drop counts its own', billboards === '1', billboards)
  const cap = await fwin.locator('.vip-tile--open').nth(1).evaluate((el) => [el.querySelector('.vip-tile__cap > b').childNodes[0].textContent, el.querySelector('.vip-tile__cap > span').childNodes[0].textContent].join(' | '))
  check('with pictures: a caption names who sent it, when that is known', cap === 'A Founder | Billboards', cap)
  const called = (await fwin.locator('.vip__grid').ariaSnapshot()).split('\n').filter((l) => /button/.test(l)).map((l) => l.replace(/^.*button "|"'?$/g, '').replace(/\s+([,:.])/g, '$1'))
  check('with pictures: and the tile is called by its caption, then what it is and what a press does', called.join(' | ') === 'Deep Tech Mat: photo. Open it. | A Founder, Billboards: photo. Open it. | VC Sticker Pack: photo. Open it.', called.join(' | '))
  // open the second with the keyboard, step, close: the keyboard is back on the tile
  await fwin.locator('.vip__body').evaluate((el) => (el.scrollTop = 60))
  await fwin.locator('.vip-tile--open').nth(1).focus()
  await p.keyboard.press('Enter')
  await p.waitForTimeout(500)
  const look = fwin.locator('.vip-look')
  check('with pictures: Enter opens it large, in the grid\'s place', (await look.count()) === 1 && (await look.getAttribute('role')) === 'dialog' && /Photo from Billboards, sent by A Founder\. 2 of 3\./.test(await look.getAttribute('aria-label')), await look.getAttribute('aria-label').catch(() => 'no panel'))
  check('with pictures: the keyboard is in it', await p.evaluate(() => !!document.activeElement?.closest('.vip-look')))
  const size = await look.locator('.vip-look__media').evaluate((el) => [el.tagName, Math.round(el.getBoundingClientRect().width), el.complete && el.naturalWidth > 0])
  check('with pictures: the picture is drawn large', size[0] === 'IMG' && size[1] > 300 && size[2], size.join())
  await shot(p, 'vip-desktop-look')
  await p.keyboard.press('ArrowRight')
  await p.waitForTimeout(300)
  check('with pictures: the arrows step', /3 of 3/.test(await look.getAttribute('aria-label')))
  await p.keyboard.press('ArrowRight')
  await p.keyboard.press('ArrowLeft')
  await p.waitForTimeout(300)
  check('with pictures: and stop at the ends', /2 of 3/.test(await look.getAttribute('aria-label')))
  await p.keyboard.press('Escape')
  await p.waitForTimeout(400)
  const back = await p.evaluate(() => ({ panel: !!document.querySelector('.vip-look'), on: document.activeElement?.getAttribute('data-tile'), top: document.querySelector('.wf[data-app="photos"] .vip__body').scrollTop, win: !!document.querySelector('.wf[data-app="photos"]:not([inert])') }))
  check('with pictures: Escape closes it; the keyboard is back on the tile, the grid where it was, the window still open', !back.panel && back.on === '3' && back.top === 60 && back.win, JSON.stringify(back))
  // by the mouse, and closed by its button
  await fwin.locator('.vip-tile--open').first().click()
  await p.waitForTimeout(400)
  await fwin.locator('.vip-look__step[data-side="on"]').click()
  await p.waitForTimeout(300)
  check('with pictures: a click opens it, the arrow at its side steps', /2 of 3/.test(await look.getAttribute('aria-label')))
  await fwin.locator('.side-item', { hasText: 'All Drops' }).click()
  await p.waitForTimeout(300)
  check('with pictures: choosing a drop goes back to the grid', (await look.count()) === 0)
  check('with pictures: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  t = await A.open(browser, { device: 'iphone', base: BASE, goto: false })
  p = t.page
  await swap(p, 'src/data/drops.ts', WITH_FILES)
  await p.goto(BASE + '?still&open=vip')
  await arrived(p)
  await top().locator('.photos-tile').first().waitFor({ timeout: 15000 })
  await p.waitForTimeout(900)
  const fnote = (await top().locator('.photos-note').innerText()).replace(/\s+/g, ' ')
  check('with pictures, phone: the library counts what has arrived', fnote === '3 Photos From the people who got a drop.', fnote)
  await top().locator('.photos-tile').nth(3).tap()
  await p.waitForTimeout(1100)
  check('with pictures, phone: Share is back on a picture that is there', (await top().locator('.photos-tools button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).join() === 'Share,Favorite,Info')
  await top().locator('.photos-tools button[aria-label="Info"]').tap()
  await p.waitForTimeout(900)
  check('with pictures, phone: Info says who sent it', /From\s*A Founder/.test(await p.locator('.sb-slot[data-front] .ios-sheet').innerText()))
  await shot(p, 'vip-phone-withfiles')
  await t.ctx.close()
}
