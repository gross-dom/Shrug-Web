// The desk's wallpapers: the picture on the desk, the next one each visit, and the Wallpapers folder on the desk
// (a photo library of them: one opened large can be put on the desk or downloaded).
//   node wallpapers.cjs http://127.0.0.1:4273/
const fs = require('fs')
const A = require('./lib.cjs')
const BASE = process.argv[2] || A.BASE

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

;(async () => {
  const browser = await A.launch()
  const W = '.wf[data-app="wallpapers"]'
  /** The wallpaper on the desk: the layer on top, by its name, and the picture it is drawn from. */
  const onDesk = (p) => p.evaluate(() => { const top = [...document.querySelectorAll('.os__picture')].pop(); return top ? { id: top.dataset.wallpaper, picture: getComputedStyle(top).backgroundImage.replace(/^url\("[^"]*?(\/[^/"]+(?:\/[^/"]+)?)"\)$/, '$1'), layers: document.querySelectorAll('.os__picture').length } : null })

  // ---- the desk as a visit finds it, held still
  let t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  let p = t.page
  await p.waitForTimeout(1800)
  const first = await onDesk(p)
  check('a visit begins on the first wallpaper, the picture the site has always had', first?.id === 'indigo' && /\/wallpaper\.webp$/.test(first.picture) && first.layers === 1, JSON.stringify(first))
  const desk = await p.evaluate(() => [...document.querySelectorAll('.desk__item')].map((i) => i.getAttribute('aria-label')))
  check('the desk has a Wallpapers folder, the last of its files: after Updates, Investor Portal, Portfolio and the one-pager', desk.filter((name) => /^(Updates|Investor Portal|Portfolio|One-pager|Wallpapers),/.test(name)).join(' | ') === 'Updates, desktop icon, locked | Investor Portal, desktop icon | Portfolio, desktop icon | One-pager, desktop icon | Wallpapers, desktop icon', desk.join(' | '))
  check('it is not in the Dock', (await p.locator('.dock [data-dock-app="wallpapers"]').count()) === 0)

  // ---- the folder opens a photo library of them
  await p.locator('[data-desk="wallpapers"]').dblclick()
  await p.waitForTimeout(1200)
  const lib = await p.evaluate((W) => {
    const w = document.querySelector(W)
    const tiles = [...(w?.querySelectorAll('.walls-tile') ?? [])]
    return {
      front: document.querySelector('.wf[data-active]')?.dataset.app,
      title: document.title,
      heading: w?.querySelector('.vip__title')?.textContent,
      names: tiles.map((tile) => tile.querySelector('.vip-tile__cap b')?.firstChild?.textContent),
      pictures: tiles.filter((tile) => /^\/wallpapers\/[a-z]+-small\.webp$/.test(tile.querySelector('img')?.getAttribute('src') ?? '') && tile.querySelector('img').naturalWidth > 0).length,
      on: tiles.filter((tile) => tile.hasAttribute('data-on')).map((tile) => tile.textContent.replace(/\s+/g, ' ').trim()),
      auto: w?.querySelector('.walls-auto')?.getAttribute('aria-checked'),
      menus: [...document.querySelectorAll('.menubar [data-menu-title]')].map((m) => m.textContent.trim()),
    }
  }, W)
  check('a double-click on it opens the Wallpapers window, in front', lib.front === 'wallpapers' && lib.heading === 'Wallpapers' && lib.title === 'Wallpapers · Shrug', JSON.stringify({ front: lib.front, heading: lib.heading, title: lib.title }))
  check('it has the five wallpapers, each with its picture and its name', lib.names.join(' | ') === 'Indigo | Dusk | Ember | Lagoon | Graphite' && lib.pictures === 5, JSON.stringify({ names: lib.names, pictures: lib.pictures }))
  check('the one on the desk says so, and the desk is set to change each visit', lib.on.length === 1 && /^Indigo, wallpaper, on the desktop now\. Open it\. ?On the Desktop$/.test(lib.on[0]) && lib.auto === 'true', JSON.stringify({ on: lib.on, auto: lib.auto }))

  // ---- one opened large: what it is, and what can be done with it
  await p.locator(`${W} .walls-tile`).nth(3).click()
  await p.waitForTimeout(700)
  const look = await p.evaluate((W) => { const l = document.querySelector(`${W} .vip-look`); return l ? { says: l.getAttribute('aria-label'), picture: l.querySelector('img.vip-look__media')?.getAttribute('src'), acts: [...l.querySelectorAll('.walls-act')].map((a) => a.textContent.replace(/\s+/g, ' ').trim()), on: document.activeElement?.getAttribute('aria-label'), href: l.querySelector('a.walls-act')?.getAttribute('href'), as: l.querySelector('a.walls-act')?.getAttribute('download') } : null }, W)
  check('a tile opens its wallpaper large, says which it is and how big, and has the keyboard', !!look && look.says === 'Lagoon wallpaper, 3840 by 2160 pixels. 4 of 5.' && look.picture === '/wallpapers/lagoon.webp' && look.on === 'Close', JSON.stringify(look))
  check('it can be put on the desk or downloaded: the file at its full size, under its own name', !!look && look.acts[0] === 'Set as Wallpaper' && /^Download, a JPEG of 1\.\d MB$/.test(look.acts[1]) && look.href === '/wallpapers/shrug-lagoon.jpg' && look.as === 'shrug-lagoon.jpg', JSON.stringify(look?.acts))
  const [file] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }).catch(() => null), p.locator(`${W} a.walls-act`).click()])
  const got = file ? { name: file.suggestedFilename(), bytes: fs.statSync(await file.path()).size } : null
  check('Download hands over that file: a 3840 by 2160 JPEG of a megabyte or more', !!got && got.name === 'shrug-lagoon.jpg' && got.bytes > 1_000_000, JSON.stringify(got))

  // ---- put on the desk, it stays there
  await p.locator(`${W} button.walls-act`).click()
  await p.waitForTimeout(2600)
  const set = { desk: await onDesk(p), act: await p.locator(`${W} button.walls-act`).innerText(), pressed: await p.locator(`${W} button.walls-act`).getAttribute('aria-pressed'), auto: await p.locator(`${W} .walls-auto`).getAttribute('aria-checked') }
  check('Set as Wallpaper puts it on the desk (the one before it gone from under it), says so, and the desk stops changing each visit', set.desk?.id === 'lagoon' && /\/wallpapers\/lagoon\.webp$/.test(set.desk.picture) && set.desk.layers === 1 && set.act.trim() === 'On the Desktop' && set.pressed === 'true' && set.auto === 'false', JSON.stringify(set))
  await p.keyboard.press('ArrowRight')
  await p.waitForTimeout(400)
  const stepped = await p.locator(`${W} .vip-look`).getAttribute('aria-label')
  await p.keyboard.press('Escape')
  await p.waitForTimeout(500)
  const back = await p.evaluate((W) => ({ look: !!document.querySelector(`${W} .vip-look`), tile: document.activeElement?.dataset.tile, on: [...document.querySelectorAll(`${W} .walls-tile[data-on] .vip-tile__cap b`)].map((b) => b.firstChild.textContent) }), W)
  check('the arrows step through them; Escape goes back to the grid, the keyboard on the tile that was open', /^Graphite wallpaper.* 5 of 5\.$/.test(stepped || '') && !back.look && back.tile === '4' && back.on.join() === 'Lagoon', JSON.stringify({ stepped, back }))
  const view = () => p.evaluate(() => [...document.querySelectorAll('[data-menu="view"] [data-menu-item]')].map((i) => i.textContent.trim() + (i.getAttribute('aria-checked') === 'true' ? ' ✓' : '')))
  const menu = await view()
  check('the View menu has Next Wallpaper and Change Each Visit (off, now that one was chosen)', menu.join(' | ') === 'Next Wallpaper | Change Each Visit', menu.join(' | '))

  // ---- a reload comes back to it
  await p.reload()
  await p.waitForTimeout(2500)
  const again = { desk: await onDesk(p), kept: await p.evaluate(() => sessionStorage.getItem('shrug:wallpaper')) }
  check('a reload comes back to the wallpaper that was chosen', again.desk?.id === 'lagoon' && again.kept === '{"at":3,"auto":false}', JSON.stringify(again))
  check('no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- each visit shows the next one. (A visit is a page opened afresh in the same browser; `?still`, which
  // the rest of these checks are held by, keeps the wallpaper where it was)
  t = await A.open(browser, { device: 'desktop', base: BASE, goto: false })
  const visit = async (query = 'empty') => {
    const page = await t.ctx.newPage()
    const asked = []
    page.on('request', (r) => { const path = new URL(r.url()).pathname; if (/^\/wallpapers\/[a-z]+\.webp$/.test(path) || path === '/wallpaper.webp') asked.push(path) })
    page.on('pageerror', (e) => t.errors.push('pageerror: ' + String(e)))
    await page.goto(`${BASE}?${query}`, { waitUntil: 'load' })
    await page.waitForTimeout(1800)
    return { page, asked, desk: await onDesk(page) }
  }
  const one = await visit()
  const two = await visit()
  check('the first visit is on the first wallpaper; the next visit is on the next', one.desk?.id === 'indigo' && two.desk?.id === 'dusk', JSON.stringify([one.desk, two.desk]))
  check('a visit asks for its own wallpaper and no other: nothing is shown first and then changed', one.asked.join() === '/wallpaper.webp' && two.asked.join() === '/wallpapers/dusk.webp' && two.desk.layers === 1, JSON.stringify([one.asked, two.asked]))
  const early = await two.page.evaluate(() => [...document.querySelectorAll('link[rel="preload"][as="image"]')].filter((l) => !l.media || matchMedia(l.media).matches).map((l) => l.getAttribute('href')))
  check('and asks for it at once, from the head of the page', early.join() === '/wallpapers/dusk.webp', early.join())
  await two.page.reload({ waitUntil: 'load' })
  await two.page.waitForTimeout(1800)
  const reloaded = await onDesk(two.page)
  check('a reload is the same visit: the same wallpaper', reloaded?.id === 'dusk', JSON.stringify(reloaded))
  const held = await visit('still&empty')
  const three = await visit()
  check('held still, a visit keeps the wallpaper where it was; the visit after it moves on from there', held.desk?.id === 'dusk' && three.desk?.id === 'ember', JSON.stringify([held.desk, three.desk]))
  // one put there by hand stays from visit to visit; the switch sets the desk going again
  await three.page.locator('[data-desk="wallpapers"]').dblclick()
  await three.page.waitForTimeout(900)
  await three.page.locator(`${W} .walls-tile`).nth(0).click()
  await three.page.waitForTimeout(400)
  await three.page.locator(`${W} button.walls-act`).click()
  await three.page.waitForTimeout(2400)
  const four = await visit()
  const five = await visit()
  check('one put on the desk by hand stays, visit after visit', (await onDesk(three.page))?.id === 'indigo' && four.desk?.id === 'indigo' && five.desk?.id === 'indigo', JSON.stringify([four.desk, five.desk]))
  await five.page.locator('[data-desk="wallpapers"]').dblclick()
  await five.page.waitForTimeout(900)
  const sw = five.page.locator(`${W} .walls-auto`)
  const was = { says: (await sw.innerText()).trim(), on: await sw.getAttribute('aria-checked') }
  await sw.click()
  await five.page.waitForTimeout(300)
  const six = await visit()
  check('Change Each Visit, in the window\'s bar, sets the desk going again from it', was.says === 'Change Each Visit' && was.on === 'false' && (await sw.getAttribute('aria-checked')) === 'true' && (await onDesk(five.page))?.id === 'indigo' && six.desk?.id === 'dusk', JSON.stringify({ was, six: six.desk }))
  check('no errors', A.realErrors(t.errors.filter((e) => !/requestfailed/.test(e))).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- a link opens the folder; a phone has no such thing and fetches none of the pictures
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&open=wallpapers' })
  p = t.page
  await p.waitForTimeout(2500)
  const linked = await p.evaluate(() => ({ front: document.querySelector('.wf[data-active]')?.dataset.app, address: location.search }))
  check('?open=wallpapers opens the Wallpapers window', linked.front === 'wallpapers' && /open=wallpapers/.test(linked.address), JSON.stringify(linked))
  await t.ctx.close()

  t = await A.open(browser, { device: 'iphone', base: BASE, goto: false })
  p = t.page
  const fetched = []
  p.on('request', (r) => { const path = new URL(r.url()).pathname; if (/^\/wallpapers\//.test(path) || path === '/wallpaper.webp') fetched.push(path) })
  await p.goto(`${BASE}?still&open=wallpapers`)
  await p.waitForTimeout(4000)
  const phone = await p.evaluate(() => ({ home: !!document.querySelector('.sb-home:not([data-locked])'), app: document.querySelector('.sb-slot[data-front]')?.dataset.app ?? null, windows: document.querySelectorAll('.wf').length }))
  check('on a phone the link opens no app: the Home Screen, unlocked', phone.home && phone.app === null && phone.windows === 0, JSON.stringify(phone))
  check('and a phone fetches none of the desktop’s wallpapers', fetched.length === 0, fetched.join(' '))
  check('no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'ALL PASS')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
