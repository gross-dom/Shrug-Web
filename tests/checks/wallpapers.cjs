// The desk's wallpapers: the picture on the desk, how it moves on, and the Wallpapers folder on the desk
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
  check('the desk has a Wallpapers folder, between Portfolio and the one-pager', desk.join(' | ') === 'Portfolio, desktop icon | Wallpapers, desktop icon | One-pager, desktop icon, opens in a new tab', desk.join(' | '))
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
  check('the one on the desk says so, and the desk is set to change by itself', lib.on.length === 1 && /^Indigo, wallpaper, on the desktop now\. Open it\. ?On the Desktop$/.test(lib.on[0]) && lib.auto === 'true', JSON.stringify({ on: lib.on, auto: lib.auto }))

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
  check('Set as Wallpaper puts it on the desk (the one before it gone from under it), says so, and the desk stops changing by itself', set.desk?.id === 'lagoon' && /\/wallpapers\/lagoon\.webp$/.test(set.desk.picture) && set.desk.layers === 1 && set.act.trim() === 'On the Desktop' && set.pressed === 'true' && set.auto === 'false', JSON.stringify(set))
  await p.keyboard.press('ArrowRight')
  await p.waitForTimeout(400)
  const stepped = await p.locator(`${W} .vip-look`).getAttribute('aria-label')
  await p.keyboard.press('Escape')
  await p.waitForTimeout(500)
  const back = await p.evaluate((W) => ({ look: !!document.querySelector(`${W} .vip-look`), tile: document.activeElement?.dataset.tile, on: [...document.querySelectorAll(`${W} .walls-tile[data-on] .vip-tile__cap b`)].map((b) => b.firstChild.textContent) }), W)
  check('the arrows step through them; Escape goes back to the grid, the keyboard on the tile that was open', /^Graphite wallpaper.* 5 of 5\.$/.test(stepped || '') && !back.look && back.tile === '4' && back.on.join() === 'Lagoon', JSON.stringify({ stepped, back }))
  const view = () => p.evaluate(() => [...document.querySelectorAll('[data-menu="view"] [data-menu-item]')].map((i) => i.textContent.trim() + (i.getAttribute('aria-checked') === 'true' ? ' ✓' : '')))
  const menu = await view()
  check('the View menu has Next Wallpaper and Change Automatically (off, now that one was chosen)', menu.join(' | ') === 'Next Wallpaper | Change Automatically', menu.join(' | '))

  // ---- a reload comes back to it
  await p.reload()
  await p.waitForTimeout(2500)
  const again = { desk: await onDesk(p), kept: await p.evaluate(() => sessionStorage.getItem('shrug:wallpaper')) }
  check('a reload comes back to the wallpaper that was chosen', again.desk?.id === 'lagoon' && again.kept === '{"at":3,"auto":false}', JSON.stringify(again))
  check('no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- left to itself the desk moves on (asked to do it every three seconds, to be watched)
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty&wallpapers=3' })
  p = t.page
  await p.waitForTimeout(1500)
  const seen = [(await onDesk(p))?.id]
  for (let i = 0; i < 16 && seen.length < 3; i++) { await p.waitForTimeout(500); const now = (await onDesk(p))?.id; if (now !== seen[seen.length - 1]) seen.push(now) }
  check('left to itself the desk moves on to the next wallpaper, and the next', seen.join(' > ') === 'indigo > dusk > ember', seen.join(' > '))
  // one chosen by hand stops it; the switch sets it going again
  await p.locator('[data-desk="wallpapers"]').dblclick()
  await p.waitForTimeout(900)
  await p.locator(`${W} .walls-tile`).nth(0).click()
  await p.waitForTimeout(400)
  await p.locator(`${W} button.walls-act`).click()
  await p.keyboard.press('Escape')
  await p.waitForTimeout(5200)
  const held = (await onDesk(p))?.id
  await p.locator(`${W} .walls-auto`).click()
  await p.waitForTimeout(4600)
  const moved = { id: (await onDesk(p))?.id, auto: await p.locator(`${W} .walls-auto`).getAttribute('aria-checked') }
  check('one put there by hand stays; Change Automatically sets the desk going again from it', held === 'indigo' && moved.auto === 'true' && moved.id !== 'indigo', JSON.stringify({ held, moved }))
  check('no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- a link opens the folder; a phone has no such thing and fetches none of the pictures
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&open=wallpapers' })
  p = t.page
  await p.waitForTimeout(2500)
  const linked = await p.evaluate(() => ({ front: document.querySelector('.wf[data-active]')?.dataset.app, address: location.search }))
  check('?open=wallpapers opens the Wallpapers window', linked.front === 'wallpapers' && /open=wallpapers/.test(linked.address), JSON.stringify(linked))
  await t.ctx.close()

  t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still&open=wallpapers&wallpapers=3', goto: false })
  p = t.page
  const fetched = []
  p.on('request', (r) => { const path = new URL(r.url()).pathname; if (/^\/wallpapers\//.test(path) || path === '/wallpaper.webp') fetched.push(path) })
  await p.goto(`${BASE}?still&open=wallpapers&wallpapers=3`)
  await p.waitForTimeout(7000)
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
