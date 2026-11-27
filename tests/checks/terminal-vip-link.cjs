// VIP's checks, run by terminal-vip.cjs (which hands over its helpers). On the desktop VIP is the store, in a
// window (design/v1): these hold to it opening that window by every route there is besides the Dock's own icon
// (which desktop-flow.cjs presses) and an address (addresses.cjs), and to nothing there being a link away. On
// a phone VIP is nowhere an app, and no longer a link to the old points site: where it was are the three stores
// (`SITE.stores` in src/data/site.ts), each a link to the store's own page, in a tab of its own. And they hold to the two windows that are laid out with the classes VIP's window
// once had, Wallpapers and Updates.

exports.vipChecks = async ({ A, browser, BASE, check, shot, arrived }) => {
  /** Where the Drops conversation's link leads on a phone: ArtStore, as the store's own page. */
  const POINTS = A.storeAt(BASE, 'store')
  /** A link as these checks ask of one: where it goes, that it opens a tab that cannot reach back, and what it says. */
  const linkOf = (a) => ({ tag: a.tagName, href: a.getAttribute('href'), target: a.target, rel: a.rel, says: (a.getAttribute('aria-label') ?? a.textContent).replace(/\s+/g, ' ').trim() })
  const leaves = (l) => !!l && l.tag === 'A' && l.href === POINTS && l.target === '_blank' && /\bnoreferrer\b/.test(l.rel)
  const noVip = (p) => p.evaluate(() => document.querySelectorAll('.wf[data-app="photos"], .wf[data-app="vip"], .sb-slot[data-app="photos"], .sb-slot[data-app="vip"], [data-dock-app="photos"]').length === 0)

  // ================= the desktop: where VIP was a link there are windows now. The drops lead to ArtStore; VIP by name is My VIP
  let t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still' })
  let p = t.page
  await arrived(p)
  await p.waitForSelector('.wf[data-app="messages"] .conv', { timeout: 15000 })
  await p.waitForTimeout(1200)
  const S = '.wf[data-app="store"]'
  /** The store's window: whether it is open and in front, and where its frame is. */
  const store = (p) => p.evaluate((S) => { const w = document.querySelector(S); const f = w?.querySelector('iframe'); let path = null; try { path = f?.contentWindow?.location?.pathname ?? null } catch {} return { open: !!w?.hasAttribute('data-open'), front: document.querySelector('.wf[data-active]')?.dataset.app ?? null, path } }, S)
  const shut = async (p) => { await p.locator(`${S} .wf__light[data-kind="close"]`).click(); await p.waitForTimeout(500) }
  const tabs = () => t.ctx.pages().length

  // What the page says it holds, to someone who is told it and not shown it
  const heading = await p.locator('header.sr-only h1').innerText()
  check('desktop: the page’s own heading names what is on it, and the drops are not', heading === 'Shrug: what people say, the portfolio and FAQs', heading)

  // The conversation that pointed at VIP still does, in the same words, and opens the store's window
  await p.locator('.wf[data-app="messages"] [data-conversation="drops"]').click()
  await p.waitForTimeout(600)
  const egg = await p.evaluate(() => { const said = [...document.querySelectorAll('.wf[data-app="messages"] .chat__thread .ss-bubble')].map((b) => b.textContent.trim()); const a = document.querySelector('.wf[data-app="messages"] .chat__thread .chat-link'); return { said, link: a && { tag: a.tagName, says: a.textContent.trim(), href: a.getAttribute('href') } } })
  check('desktop: the Drops conversation says what it said, word for word', egg.said.length === 2 && egg.said[0] === 'Your drop is out for delivery.' && /^See who got one in VIP/.test(egg.said[1]), JSON.stringify(egg.said))
  check('desktop: and its “See who got one in VIP” is a button, not a link away', !!egg.link && egg.link.tag === 'BUTTON' && egg.link.says === 'See who got one in VIP' && egg.link.href === null, JSON.stringify(egg.link))
  const before = tabs()
  await p.locator('.wf[data-app="messages"] .chat__thread .chat-link').click()
  await p.waitForTimeout(1500)
  let now = await store(p)
  check('desktop: pressed, it opens ArtStore’s window, in front, on the store, and no tab', now.open && now.front === 'store' && now.path === '/vip/store/' && tabs() === before && (await noVip(p)), JSON.stringify(now))
  await shut(p)

  // About Shrug has two rows that open windows, Portfolio and Testimonials (Dom's third round took Backs,
  // Group Chat, Verticals and Drops out of it); neither is a link
  await p.click('[data-menu-title="mark"]')
  await p.locator('[data-menu="mark"] .menu__item', { hasText: 'About Shrug' }).click()
  await p.waitForSelector('.wf[data-app="about"] .about__fact', { timeout: 8000 })
  await p.waitForTimeout(700)
  const about = await p.evaluate(() => [...document.querySelectorAll('.wf[data-app="about"] button.about__fact, .wf[data-app="about"] a.about__fact')].map((el) => ({ tag: el.tagName, label: el.firstElementChild.textContent.trim(), says: el.lastElementChild.textContent.trim(), tall: Math.round(el.getBoundingClientRect().height), ink: getComputedStyle(el).color, line: getComputedStyle(el).textDecorationLine })))
  const facts = await p.evaluate(() => document.querySelector('.wf[data-app="about"]').innerText.replace(/\s*\n\s*/g, ' | '))
  check('desktop: About Shrug has two rows that open windows, Portfolio (100+ Companies) and Testimonials (how many), and nothing of Backs, Group Chat, Verticals or Drops', about.map((row) => `${row.tag} ${row.label} ${row.says}`).join(' | ') === `BUTTON Portfolio 100+ Companies | BUTTON Testimonials 80` && !/Backs|Group Chat|Verticals|Drops/.test(facts) && /Fund \| V( \||$)/.test(facts), JSON.stringify({ about: about.map((row) => `${row.tag} ${row.label} ${row.says}`), facts }))
  check('desktop: the two rows are drawn alike: the same ink, no underline', about.length === 2 && about[0].ink === about[1].ink && about.every((row) => row.line === 'none'), JSON.stringify(about.map((row) => [row.label, row.tall, row.ink, row.line])))
  await p.locator('.wf[data-app="about"] button.about__fact', { hasText: 'Testimonials' }).click()
  await p.waitForTimeout(1200)
  check('desktop: Testimonials opens the group chat, and no tab', (await p.evaluate(() => document.querySelector('.wf[data-active]')?.dataset.app)) === 'messages' && tabs() === before, '')
  await p.locator('.wf[data-app="messages"] button[aria-label^="Close"]').click().catch(() => {})
  await p.waitForTimeout(400)
  // (ArtStore is opened from the Dock for what follows: the menus list its window while it is open)
  await p.locator('.dock [data-dock-app="store"]').click()
  await p.waitForTimeout(1500)
  now = await store(p)
  check('desktop: ArtStore opens from the Dock, and no tab', now.open && now.front === 'store' && tabs() === before, JSON.stringify(now))

  // The menus: the Go menu has it with the Dock's apps, the Window menu lists its window while it is open
  const menus = {}
  for (const id of ['app', 'go', 'view', 'window']) {
    const title = p.locator(`[data-menu-title="${id}"]`)
    if (!(await title.count())) { menus[id] = null; continue }
    await title.click(); await p.waitForTimeout(250)
    menus[id] = await p.evaluate((id) => [...document.querySelectorAll(`[data-menu="${id}"] [data-menu-item]`)].map((el) => `${el.tagName === 'A' ? 'link' : 'item'} ${el.querySelector('.menu__label').textContent.trim()}`), id)
    await p.keyboard.press('Escape'); await p.waitForTimeout(200)
  }
  const links = Object.values(menus).flat().filter((item) => item && /^link .*VIP|Photos|Videos/.test(item))
  check('desktop: in the menus the stores are apps like the others: ArtStore, Books and My VIP in the Go menu, ArtStore in the Window menu while open, and nowhere a link', ['item ArtStore', 'item Books', 'item My VIP'].every((item) => menus.go.includes(item)) && menus.window.includes('item ArtStore') && menus.app.includes('item Quit ArtStore') && links.length === 0, JSON.stringify(menus))
  await shut(p)
  await p.click('[data-menu-title="go"]'); await p.waitForTimeout(250)
  await p.locator('[data-menu="go"] [data-menu-item]', { hasText: 'ArtStore' }).click()
  await p.waitForTimeout(1500)
  now = await store(p)
  check('desktop: the Go menu’s ArtStore opens the window', now.open && now.front === 'store', JSON.stringify(now))
  await p.click('[data-menu-title="go"]'); await p.waitForTimeout(250)
  await p.locator('[data-menu="go"] [data-menu-item]', { hasText: 'My VIP' }).click()
  await p.waitForTimeout(1500)
  const mine = await p.evaluate(() => ({ front: document.querySelector('.wf[data-active]')?.dataset.app ?? null, doors: document.querySelectorAll('.wf[data-app="myvip"] .myvip__door').length }))
  check('desktop: the Go menu’s My VIP opens its window, with the doors to the stores', mine.front === 'myvip' && mine.doors === 3, JSON.stringify(mine))
  await p.locator('.wf[data-app="myvip"] .wf__light[data-kind="close"]').click(); await p.waitForTimeout(500)

  // A desk kept by the site as it was long ago, with a window it no longer has (a tab left open over a change,
  // then reloaded): the windows the site has come back, the store among them, and nothing comes back for the other
  await p.evaluate(() => {
    const kept = JSON.parse(sessionStorage.getItem('shrug:desk'))
    const like = Object.values(kept.windows.wins)[0]
    kept.windows.wins.photos = { ...like, minimized: false }
    kept.windows.order = [...kept.windows.order, 'photos']
    kept.photos = { filter: 'video' }
    sessionStorage.setItem('shrug:desk', JSON.stringify(kept))
    // (so that leaving the page does not write the desk over what was just put there)
    window.addEventListener('pagehide', (e) => e.stopImmediatePropagation(), true)
  })
  await p.reload({ waitUntil: 'load' })
  await arrived(p)
  await p.waitForTimeout(1800)
  const back = await p.evaluate(() => ({ open: [...document.querySelectorAll('.wf[data-app][data-open]')].map((w) => w.dataset.app).sort().join(), front: document.querySelector('.wf[data-active]')?.dataset.app ?? null }))
  check('desktop: a reload of a desk kept with a window the site no longer has brings back the others, the store among them', back.open === 'about,store' && (await noVip(p)) && !!back.front, JSON.stringify(back))
  check('desktop: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ================= the two windows laid out with the classes VIP's window had
  // (What each does is in wallpapers.cjs and account.cjs. This is how they are drawn: the head, the tiles and the
  // dark room for one picture, by the rules those classes have always had.)
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty&open=wallpapers' })
  p = t.page
  await arrived(p)
  const W = '.wf[data-app="wallpapers"]'
  await p.waitForSelector(`${W} .walls-tile`, { timeout: 15000 })
  await p.waitForTimeout(1500)
  const walls = await p.evaluate((W) => {
    const w = document.querySelector(W)
    const cs = (sel) => getComputedStyle(w.querySelector(sel))
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) } }
    const body = w.querySelector('.vip__body')
    // (the colorways: the window's second section, Photographs, is held to in desk-apps.cjs)
    const tiles = [...w.querySelectorAll('.walls-tile')]
    const first = tiles[0]
    const cap = first.querySelector('.vip-tile__cap')
    const media = first.querySelector('.vip-tile__media')
    return {
      body: { display: cs('.vip__body').display, way: cs('.vip__body').flexDirection, wide: body.scrollWidth <= body.clientWidth },
      head: { pad: cs('.vip__head').padding, title: `${cs('.vip__title').fontSize} ${cs('.vip__title').fontWeight}`, sub: `${cs('.vip__sub').fontSize} ${cs('.vip__sub').marginTop}`, titleAt: box(w.querySelector('.vip__title')), subAt: box(w.querySelector('.vip__sub')), gridAt: box(w.querySelector('.walls__grid')) },
      tiles: tiles.map((tile) => { const b = box(tile); return { ...b, shape: +(b.w / b.h).toFixed(2), radius: getComputedStyle(tile).borderRadius, clip: getComputedStyle(tile).overflow, how: getComputedStyle(tile).display } }),
      media: { ...box(media), fit: getComputedStyle(media).objectFit, loaded: media.complete && media.naturalWidth > 0, tile: box(first) },
      cap: { ...box(cap), ground: getComputedStyle(cap).backgroundColor, radius: getComputedStyle(cap).borderRadius, weight: getComputedStyle(cap.querySelector('b')).fontWeight, tile: box(first) },
    }
  }, W)
  check('Wallpapers: the window’s body is a column that does not scroll sideways', walls.body.display === 'flex' && walls.body.way === 'column' && walls.body.wide, JSON.stringify(walls.body))
  check('Wallpapers: its head is set as the library’s is: a 30px title in the heaviest weight, the line under it at 14px, and room round them', walls.head.pad === '4px 22px 18px' && walls.head.title === '30px 800' && walls.head.sub === '14px 6px' && walls.head.subAt.y >= walls.head.titleAt.b && walls.head.gridAt.y >= walls.head.subAt.b + 18, JSON.stringify(walls.head))
  const row = walls.tiles.filter((tile) => tile.y === walls.tiles[0].y)
  check('Wallpapers: the five tiles are rounded pictures the shape of a screen, side by side with air between, none over another', walls.tiles.length === 5 && walls.tiles.every((tile) => tile.radius === '16px' && tile.clip === 'hidden' && tile.how === 'block' && Math.abs(tile.shape - 1.78) <= 0.02 && tile.w >= 220) && row.length >= 2 && row.slice(1).every((tile, i) => tile.x - row[i].r === 12), JSON.stringify(walls.tiles))
  check('Wallpapers: a tile’s picture fills it, cut to cover', walls.media.loaded && walls.media.fit === 'cover' && walls.media.x === walls.media.tile.x && walls.media.y === walls.media.tile.y && walls.media.w === walls.media.tile.w && walls.media.h === walls.media.tile.h, JSON.stringify(walls.media))
  check('Wallpapers: its name is on a pale plate in the tile’s lower left corner', walls.cap.ground === 'rgba(255, 255, 255, 0.92)' && walls.cap.radius === '10px' && walls.cap.weight === '600' && walls.cap.x - walls.cap.tile.x === 8 && walls.cap.tile.b - walls.cap.b === 8, JSON.stringify(walls.cap))
  await shot(p, 'vip-classes-wallpapers')
  await p.locator(`${W} .walls-tile`).nth(1).click()
  await p.waitForSelector(`${W} .vip-look__media`, { timeout: 8000 })
  await p.waitForFunction((W) => { const i = document.querySelector(`${W} .vip-look__media`); return i.complete && i.naturalWidth > 0 }, W, { timeout: 15000 }).catch(() => {})
  await p.waitForTimeout(600)
  const room = await p.evaluate((W) => {
    const w = document.querySelector(W)
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) } }
    const look = w.querySelector('.vip-look')
    const body = w.querySelector('.vip__body')
    const img = w.querySelector('.vip-look__media')
    const stage = w.querySelector('.vip-look__stage')
    const buttons = [...w.querySelectorAll('.vip-look__button')].map((b) => ({ ...box(b), radius: getComputedStyle(b).borderRadius, ink: getComputedStyle(b).color, step: b.dataset.side ?? null }))
    return { ground: getComputedStyle(look).backgroundColor, ink: getComputedStyle(look).color, look: box(look), body: box(body), clipped: getComputedStyle(body).overflow, browse: getComputedStyle(w.querySelector('.vip__browse')).display, img: { ...box(img), fit: getComputedStyle(img).objectFit, radius: getComputedStyle(img).borderRadius, shape: +(img.getBoundingClientRect().width / img.getBoundingClientRect().height).toFixed(2), loaded: img.complete && img.naturalWidth > 0 }, stage: box(stage), bar: box(w.querySelector('.vip-look__bar')), title: getComputedStyle(w.querySelector('.vip-look__title > b')).fontWeight, buttons }
  }, W)
  check('Wallpapers: one opened large has the grid’s place: a dark room that fills the window’s body, the grid put away', room.ground === 'rgb(18, 18, 21)' && room.ink === 'rgb(255, 255, 255)' && room.browse === 'none' && room.clipped === 'hidden' && room.look.x === room.body.x && room.look.w === room.body.w && room.look.b === room.body.b, JSON.stringify({ ground: room.ground, look: room.look, body: room.body, browse: room.browse }))
  check('Wallpapers: the picture is whole in the room under its bar: inside the stage, its own shape, its corners rounded', room.img.loaded && room.img.fit === 'contain' && room.img.radius === '8px' && Math.abs(room.img.shape - 1.78) <= 0.02 && room.img.x >= room.stage.x && room.img.r <= room.stage.r && room.img.y >= room.bar.b - 1 && room.img.b <= room.stage.b && room.title === '600', JSON.stringify({ img: room.img, stage: room.stage, bar: room.bar }))
  const close = room.buttons.find((b) => !b.step)
  const steps = room.buttons.filter((b) => b.step)
  check('Wallpapers: Close is a round button in the bar, and the two arrows are round buttons at the picture’s sides, half way down', !!close && close.w === 30 && close.h === 30 && close.radius === '15px' && close.ink === 'rgb(255, 255, 255)' && steps.length === 2 && steps.every((b) => b.w === 36 && b.h === 36 && b.radius === '18px' && Math.abs(b.y + b.h / 2 - (room.stage.y + room.stage.h / 2)) <= 12) && steps.find((b) => b.step === 'back').x - room.stage.x === 20 && room.stage.r - steps.find((b) => b.step === 'on').r === 20, JSON.stringify(room.buttons))
  await shot(p, 'vip-classes-wallpapers-large')
  check('Wallpapers: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // A narrow window: the head draws in, as the library's did
  t = await A.open(browser, { device: 'narrow', base: BASE, query: 'still&empty&open=wallpapers' })
  p = t.page
  await arrived(p)
  await p.waitForSelector(`${W} .walls-tile`, { timeout: 15000 })
  await p.waitForTimeout(1500)
  const slim = await p.evaluate((W) => { const w = document.querySelector(W); const body = w.querySelector('.vip__body'); return { wide: Math.round(w.getBoundingClientRect().width), pad: getComputedStyle(w.querySelector('.vip__head')).paddingLeft, fits: body.scrollWidth <= body.clientWidth, tiles: [...w.querySelectorAll('.vip-tile')].every((tile) => { const r = tile.getBoundingClientRect(); const b = body.getBoundingClientRect(); return r.left >= b.left && r.right <= b.right }) } }, W)
  check('Wallpapers, on a small screen: nothing runs off the side of the window', slim.fits && slim.tiles, JSON.stringify(slim))
  await t.ctx.close()

  // Updates (the folder for Shrug's LPs) was laid out with the library's classes too. It is a Finder's list now
  // (design/v1, "Updates"): a bar with its name and whose it is, the documents under Funds and SPVs, and a foot
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty&open=updates' })
  p = t.page
  await arrived(p)
  const U = '.wf[data-app="updates"]'
  await p.waitForSelector(`${U} .updbar`, { timeout: 15000 })
  await p.waitForTimeout(1200)
  const laid = (p) => p.evaluate((U) => {
    const w = document.querySelector(U)
    const cs = (sel) => getComputedStyle(w.querySelector(sel))
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) } }
    const win = box(w)
    const bar = box(w.querySelector('.ss-window__bar'))
    const inside = [...w.querySelectorAll('.updbar > *, .v-empty > *, .upd-row, .upd-foot')].every((el) => { const b = box(el); return b.x >= win.x && b.r <= win.r && b.b <= win.b })
    const list = w.querySelector('.upd-list')
    return { size: `${win.w}x${win.h}`, bar: bar.h, title: `${w.querySelector('.updbar__title').textContent} ${cs('.updbar__title').fontSize} ${cs('.updbar__title').fontWeight}`, chip: w.querySelector('.updbar .v-chip').textContent.trim(), chipAt: win.r - box(w.querySelector('.updbar .v-chip')).r, old: w.querySelectorAll('.vip__title, .vip__body, .updates__list').length, said: w.querySelector('.v-empty h3')?.textContent ?? null, tells: w.querySelector('.v-empty p')?.textContent ?? null, rows: w.querySelectorAll('.upd-row').length, heads: [...w.querySelectorAll('.upd h2')].map((h) => h.textContent).join(), row: w.querySelector('.upd-row') ? box(w.querySelector('.upd-row')).h : null, foot: w.querySelector('.upd-foot') ? win.b - box(w.querySelector('.upd-foot')).b : null, scrolls: list ? list.scrollHeight > list.clientHeight : null, inside }
  }, U)
  const locked = await laid(p)
  check('Updates, locked: 760 by 540 under a bar 52 tall, with its name at the left of it and Locked at the right, and in the middle of the window the one line that says who it is for, with no heading over it', locked.size === '760x540' && locked.bar === 52 && locked.title === 'Updates 13px 700' && locked.chip === 'Locked' && locked.chipAt === 14 && locked.said === null && locked.tells === 'This folder is for Shrug LPs only. Please log in with your LP email to access its contents.' && locked.rows === 0 && locked.old === 0 && locked.inside, JSON.stringify(locked))
  await shot(p, 'updates-locked')
  await p.locator('.menubar__login').click()
  await p.locator('.account input[type=email]').fill('lp@example.test')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(900)
  // (an address on the list: the six digits are the ones to its inbox, and the sheet then asks for a number, which is left for later)
  await p.keyboard.type('246810')
  await p.waitForSelector(`${U} .upd-row`, { timeout: 8000 })
  await p.keyboard.press('Escape')
  await p.waitForTimeout(1200)
  const opened = await laid(p)
  check('Updates, logged in as an LP: the same bar, saying whose it is; the documents under Funds and SPVs in rows 50 tall; and its foot along the bottom of the window, nothing scrolling', opened.bar === 52 && opened.chip === 'LP · Shrug 2, 4' && opened.heads === 'Funds,SPVs' && opened.rows === 6 && opened.row === 50 && opened.foot === 0 && opened.scrolls === false && opened.said === null && opened.inside, JSON.stringify(opened))
  await shot(p, 'updates-lp')
  check('Updates: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ================= the iPhone
  t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still&open=chat&at=drops' })
  p = t.page
  await arrived(p)
  const front = '.sb-slot[data-front]'
  await p.waitForSelector(`${front} .chat-link`, { timeout: 15000 })
  await p.waitForTimeout(1000)
  const said = await p.evaluate((front) => { const a = document.querySelector(`${front} .chat__thread .chat-link`); return { bubbles: [...document.querySelectorAll(`${front} .chat__thread .ss-bubble`)].map((b) => b.textContent.trim()), link: { tag: a.tagName, words: a.childNodes[0].textContent, href: a.getAttribute('href'), target: a.target, rel: a.rel, says: a.textContent } } }, front)
  // (ArtStore is an app of the phone's own since 27 Nov: the link to it is a button, as it is on the desk)
  check('phone: the Drops conversation says what it said, and its link to VIP opens ArtStore, the app: a button that says nothing of a new tab', said.bubbles[0] === 'Your drop is out for delivery.' && said.link.tag === 'BUTTON' && said.link.href === null && said.link.says === 'See who got one in VIP', JSON.stringify(said))
  const tabsWere = t.ctx.pages().length
  await p.locator(`${front} .chat__thread .chat-link`).tap()
  await p.waitForTimeout(1600)
  const after = await A.state(p)
  check('phone: tapped, it opens ArtStore on the phone, in no tab of its own: its shelf, a screen of the phone’s own (no frame); and no app opens by VIP’s old name', t.ctx.pages().length === tabsWere && after.place?.app === 'store' && (await p.locator('.sb-slot[data-front][data-app="store"] .st-grid').count()) === 1 && (await p.locator('.sb-slot[data-front][data-app="store"] iframe').count()) === 0 && (await noVip(p)), JSON.stringify({ tabs: t.ctx.pages().length - tabsWere, place: after.place }))
  // The Home Screen: Workspace where VIP was, an app as the others are
  await A.at(p, null, [])
  const dock = await p.evaluate(() => { const items = [...document.querySelectorAll('.sb-dock > .sb-icon')]; const tile = (el) => { const r = el.querySelector('.sb-icon__tile').getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } }; return { names: items.map((el) => `${el.tagName === 'A' ? 'link' : 'app'} ${el.getAttribute('aria-label').replace(/, \d+ unread$/, '')}`), tiles: items.map(tile), full: document.querySelector('.sb-dock').hasAttribute('data-full'), named: getComputedStyle(items.at(-1).querySelector('.sb-icon__name')).display } })
  const gaps = dock.tiles.slice(1).map((tile, i) => tile.x - dock.tiles[i].x)
  check('phone: the Dock is Messages, Contacts and Notes, then Workspace, each an app (VIP’s link is gone from it)', dock.names.join(' | ') === 'app Messages | app Contacts | app Notes | app Workspace', dock.names.join(' | '))
  check('phone: its tile is the size of theirs, on their line and as far from the last of them as they are from each other, the four from end to end of the Dock', dock.full && dock.tiles.every((tile) => tile.w === dock.tiles[0].w && tile.h === dock.tiles[0].h && tile.y === dock.tiles[0].y) && Math.max(...gaps) - Math.min(...gaps) <= 1 && dock.named === 'none', JSON.stringify(dock.tiles))
  await shot(p, 'vip-phone-home')
  check('phone: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()
}
