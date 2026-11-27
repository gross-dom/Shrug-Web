// What the redesign changed, exercised on the desktop: the conversation, its list and details, the logo Finder, and the rest still working.
const { chromium } = require('playwright')
;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  // (the weather the desk's widget asks for is answered here: lib.cjs)
  const { weather, DOCK, DOCK_IDS } = require('./lib.cjs')
  await weather(ctx)
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))
  const ok = (label, pass, detail = '') => console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`)
  const BASE = process.argv[2] || 'http://127.0.0.1:5173/'
  await page.goto(BASE + '?open=portfolio,faqs,case-studies')
  // ---- what this round changed
  // (Looked at as soon as it is there: the first reply is under three seconds away)
  await page.waitForSelector('.conv', { timeout: 20000 }); await page.waitForTimeout(250)
  // The right of the bar holds two things, Log In and the clock, and Log In is the one thing there to press
  // (it lets down the account's sheet: account.cjs). What was taken out of the bar stays out: no Help menu,
  // no count of replies and no link to the one-pager, so nothing there is a link at all
  const bar = await page.evaluate(() => {
    const status = document.querySelector('.menubar__status')
    return {
      menus: [...document.querySelectorAll('.menubar__menus .menubar__title')].map((t) => t.textContent.trim()),
      status: status.textContent.trim(),
      holds: [...status.children].map((el) => el.className).join(' | '),
      pressed: [...status.querySelectorAll('button, [role="button"], [tabindex]')].map((el) => `${el.tagName.toLowerCase()} ${el.textContent.trim()}`),
      links: status.querySelectorAll('a').length,
    }
  })
  ok('the menu bar has no Help, reply count or one-pager: at its right are Log In and the clock, and no link', !bar.menus.includes('Help') && bar.links === 0 && bar.holds === 'menubar__account | menubar__clock' && bar.pressed.join() === 'button Log In' && !/replied|pager|help/i.test(bar.status), JSON.stringify(bar))
  // The address this visit came on names three windows: they open with the conversation, and no other does
  await page.waitForTimeout(900)
  const opened = await page.evaluate(() => [...document.querySelectorAll('.wf')].map((w) => w.dataset.app).sort().join())
  ok('an address that names three windows opens them with the conversation, and nothing else', opened === 'finder,messages,notes,terminal', opened)
  const list = await page.evaluate(() => ({ rows: document.querySelectorAll('.conv').length, first: document.querySelector('.conv .ss-row__title')?.textContent, replies: document.querySelectorAll('.chat__thread [data-person]').length }))
  ok('the left panel has Testimonials and the three easter-egg conversations, before anyone has replied', list.rows === 4 && list.first === 'Testimonials' && list.replies === 0, JSON.stringify(list))
  // The shrug is drawn in one place on the desktop: the corner of the menu bar. It is the emoticon there, not the logo
  const mark = await page.evaluate(() => { const el = document.querySelector('[data-menu-mark]'); const shrug = '¯\\_(ツ)_/¯'; const rest = document.body.innerText.split(shrug).length - 1; return { text: el?.textContent.trim(), drawn: !!el?.querySelector('svg'), times: rest } })
  ok('the corner of the menu bar is the shrug emoticon, and that is the only place it is', mark.text === '¯\\_(ツ)_/¯' && !mark.drawn && mark.times === 1, JSON.stringify(mark))
  // The Dock: air between its icons. The one-pager, which it kept after a rule at its end, is a file on the desk
  // (its tiles are the apps lib.cjs lists, the stores and My VIP last among them, apps as the others are)
  const dock = await page.evaluate(() => {
    const icons = [...document.querySelectorAll('.dock__item .dock__icon')].map((el) => el.getBoundingClientRect())
    const apps = icons.slice(0, 5)
    const gaps = apps.slice(1).map((r, i) => Math.round(r.left - apps[i].right))
    return { gaps, icons: icons.length, sheet: !!document.querySelector('.dock__icon--doc'), rule: !!document.querySelector('.dock__rule'), onDesk: !!document.querySelector('[data-desk="one-pager"] svg') }
  })
  ok('the Dock keeps a quarter of an icon between two, and the one-pager has left it for the desk, the rule with it', dock.gaps.every((g) => g >= 12 && g <= 18) && dock.icons === DOCK.length && !dock.sheet && !dock.rule && dock.onDesk, JSON.stringify(dock))
  // every reply is written, then sent, at one pace
  const times = await page.evaluate(() => new Promise((done) => {
    const seen = new Map(); const typed = new Set(); const t0 = performance.now()
    const tick = () => {
      for (const b of document.querySelectorAll('.chat__thread [data-person]')) {
        const id = b.getAttribute('data-person')
        if (b.hasAttribute('data-typing')) typed.add(id)
        else if (!seen.has(id)) seen.set(id, performance.now() - t0)
      }
      if (seen.size >= 5) return done({ at: [...seen.values()].map(Math.round), typed: typed.size })
      requestAnimationFrame(tick)
    }
    tick()
  }))
  const gaps = times.at.slice(1).map((t, i) => t - times.at[i])
  ok('replies land at one steady pace, each after its typing dots', Math.max(...gaps) - Math.min(...gaps) < 250 && times.typed >= 5, `gaps ${gaps.join(', ')} ms; ${times.typed} seen typing`)
  const text = await page.evaluate(() => [...document.querySelectorAll('.chat__thread [data-from="me"] .ss-bubble__text')].map((b) => b.textContent))
  ok('the opening message has no emoticon', text.length === 2 && !/ツ/.test(text.join(' ')), JSON.stringify(text))

  // ---- Messages
  await page.click('[data-dock-app="messages"]'); await page.waitForTimeout(500)
  const replied = () => page.evaluate(() => document.querySelectorAll('.chat__thread [data-person]').length)
  const before = await replied()
  ok('replies are landing', before >= 3, `${before} so far`)
  await page.click('.chat-info .tool'); await page.waitForTimeout(400)
  await page.click('.details__row[role="switch"]'); await page.waitForTimeout(2600)
  const a = await replied(); await page.waitForTimeout(2600); const b = await replied()
  ok('Pause Replies holds the conversation', a === b, `${a} then ${b}`)
  await page.click('.details__row[role="switch"]'); await page.waitForTimeout(3000)
  ok('and resuming carries on', (await replied()) > b)
  await page.keyboard.press('Escape'); await page.waitForTimeout(400)
  ok('Escape closes the details', !(await page.locator('.chat-details[data-show]').count()))

  // typing to the group
  await page.fill('.wf[data-app="messages"] .composer__input', 'hello from a visitor')
  await page.keyboard.press('Enter'); await page.waitForTimeout(1200)
  const sent = await page.evaluate(() => { const rows = [...document.querySelectorAll('.wf[data-app="messages"] .chat__thread > *')]; const at = rows.findIndex((el) => el.textContent.includes('hello from a visitor')); return { there: at >= 0, under: at >= 0 ? rows[at + 1]?.textContent.trim() : null, failed: document.querySelectorAll('.chat-failed, .chat-undelivered, .chat-why').length } })
  ok('a typed message is sent and marked Delivered, as any message is', sent.there && sent.under === 'Delivered' && sent.failed === 0, JSON.stringify(sent))

  // the list: keyboard moves between conversations
  await page.focus('.conv-list'); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(500)
  const open1 = await page.evaluate(() => ({ selected: document.querySelector('.conv[data-selected]')?.getAttribute('data-conversation'), name: document.querySelector('.chat-id__name span')?.textContent, bubbles: document.querySelectorAll('.chat__thread .ss-bubble').length }))
  ok('arrow keys open the next conversation', open1.selected === 'founder' && open1.name === 'Akash Nigam' && open1.bubbles === 3, JSON.stringify(open1))
  // away from the group, its replies are new: the row is marked and the Dock counts them
  await page.waitForTimeout(3600)
  const away = await page.evaluate(() => ({ unread: !!document.querySelector('.conv[data-conversation="group"][data-unread]'), badge: document.querySelector('.dock__badge')?.textContent ?? null }))
  ok('with another conversation open, new replies mark Testimonials and the Dock counts them', away.unread && +away.badge >= 1, JSON.stringify(away))
  // A reply that lands while its conversation is not the one in front is news: it drops in at the top right, under the
  // menu bar and beside the desk's icons, not over them: right up against them, however many lines of them the
  // desk's height has made (two here, there being ten). (Looked at once it has come to rest)
  const note = await page.waitForSelector('.notify__card', { timeout: 15000 }).then(async (el) => { await page.waitForTimeout(450); return el.evaluate((card) => { const r = card.getBoundingClientRect(); const icons = Math.min(...[...document.querySelectorAll('.desk__item')].map((icon) => icon.getBoundingClientRect().left)); return { from: card.querySelector('.notify__from')?.textContent, clear: Math.round(icons - r.right), right: Math.round(innerWidth - r.right), top: Math.round(r.top) } }) }).catch(() => null)
  ok('a reply that lands meanwhile drops in at the top right, under the menu bar and clear of the desk\'s icons', !!note && note.from === 'Testimonials' && note.clear >= 8 && note.clear <= 24 && note.right <= 240 && note.top >= 30 && note.top <= 60, JSON.stringify(note))
  // The count on the Dock is a circle, as a badge is
  const badge = await page.evaluate(() => { const r = document.querySelector('.dock__badge')?.getBoundingClientRect(); return r ? { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 } : null })
  ok('the count on the Dock is a circle', !!badge && Math.abs(badge.w - badge.h) < 0.6, JSON.stringify(badge))
  await page.click('.conv[data-conversation="group"]'); await page.waitForTimeout(500)
  const backIn = await page.evaluate(() => ({ unread: !!document.querySelector('.conv[data-conversation="group"][data-unread]'), badge: document.querySelector('.dock__badge')?.textContent ?? null }))
  ok('opening Testimonials again clears both', !backIn.unread && backIn.badge === null, JSON.stringify(backIn))
  // In the list a row is set as Messages sets its own (Dom's screenshots of it, 26 Nov): the face at the middle
  // of the row's height, and the name and the last message from the row's top, 16 down, however long the message
  const rows = await page.evaluate(() => [...document.querySelectorAll('.conv')].map((row) => {
    const box = row.getBoundingClientRect(); const face = row.querySelector('.ss-row__lead > *').getBoundingClientRect(); const head = row.querySelector('.ss-row__head').getBoundingClientRect()
    return [Math.round(Math.abs((face.top + face.bottom) / 2 - (box.top + box.bottom) / 2) * 10) / 10, Math.round((head.top - box.top) * 10) / 10]
  }))
  ok('in the list, a face is at the middle of its row, and the name and its last message are set from the row’s top', rows.length === 4 && rows.every(([mid, top]) => mid <= 1 && Math.abs(top - 16) <= 1), `face off the middle by, and name down by: ${rows.map((r) => r.join('/')).join(', ')}`)
  // details of the group: a person's card, and show in group
  await page.click('.chat-id'); await page.waitForTimeout(400)
  await page.click('.details__person'); await page.waitForTimeout(400)
  await page.click('.details__row--action'); await page.waitForTimeout(1400)
  const shown = await page.evaluate(() => {
    const s = document.querySelector('.chat__scroll'); const f = document.querySelector('.chat__thread [data-flash]')
    if (!f) return { flashed: false }
    const r = f.getBoundingClientRect(), box = s.getBoundingClientRect()
    return { flashed: true, inView: r.top >= box.top - 2 && r.bottom <= box.bottom + 2, group: document.querySelector('.conv[data-selected]')?.getAttribute('data-conversation') }
  })
  ok('Show in group chat brings the reply into view and rings it', shown.flashed && shown.inView && shown.group === 'group', JSON.stringify(shown))
  // search
  await page.fill('.chat-side .search__input', 'pentatonix'); await page.waitForTimeout(400)
  ok('searching finds people in Testimonials by role', (await page.locator('.conv-found [data-row]').count()) === 1 && /Kevin Olusola/.test(await page.locator('.conv-found').innerText()), (await page.locator('.conv-found').innerText()).replace(/\s+/g, ' ').slice(0, 80))
  await page.fill('.chat-side .search__input', ''); await page.waitForTimeout(300)
  const root = await page.evaluate(() => ({ top: document.querySelector('.os').scrollTop, left: document.querySelector('.os').scrollLeft, doc: document.scrollingElement.scrollTop }))
  ok('nothing scrolled the desktop itself', !root.top && !root.left && !root.doc, JSON.stringify(root))
  // Closed while replies are coming in and opened again later, the thread is at its newest message, with nothing under it.
  // (A reply that turned from its dots into its words while the window was shut once kept the dots' size, its words run a
  // long way out of it: the thread came back scrolled into a screen of nothing.)
  await page.waitForFunction(() => !!document.querySelector('.wf[data-app="messages"] .chat__thread [data-typing]'), null, { timeout: 8000 }).catch(() => {})
  await page.click('.wf[data-app="messages"] button[aria-label*="Close" i]'); await page.waitForTimeout(5000)
  await page.click('[data-dock-app="messages"]'); await page.waitForTimeout(1600)
  // What is left under the thread once it has settled. A reply growing out of its dots runs past its own box for a
  // moment (they land more than once a second now), so it is the least of a few looks that counts: space that stays
  const spareOf = () => page.evaluate(async () => {
    const el = document.querySelector('.wf[data-app="messages"] .chat__scroll'); const flow = el.querySelector('.chat__flow')
    let spare = Infinity
    for (let i = 0; i < 8; i++) { spare = Math.min(spare, el.scrollHeight - flow.offsetHeight); await new Promise((r) => setTimeout(r, 150)) }
    return spare
  })
  const again = { spare: await spareOf(), ...(await page.evaluate(() => {
    const el = document.querySelector('.wf[data-app="messages"] .chat__scroll'); const box = el.getBoundingClientRect()
    const said = [...el.querySelectorAll('.chat__thread [data-person]:not([data-typing])')]; const last = said[said.length - 1].getBoundingClientRect()
    const stuck = said.filter((b) => b.getBoundingClientRect().width < 70 && (b.textContent || '').length > 20).length
    return { lastInView: last.bottom > box.top + 40 && last.top < box.bottom, stuck, said: said.length }
  })) }
  ok('closed while replies come in and opened again, the conversation is at its newest message with no empty space under it', again.spare < 60 && again.lastInView && again.stuck === 0, JSON.stringify(again))
  // Only minimised, with the reader part-way up the conversation, it comes back where they were: the way to the newest
  // is offered, and nothing is moved for them
  {
    const box = await page.locator('.wf[data-app="messages"] .chat__scroll').boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, -700); await page.waitForTimeout(700)
    const left = await page.evaluate(() => Math.round(document.querySelector('.wf[data-app="messages"] .chat__scroll').scrollTop))
    await page.click('.wf[data-app="messages"] button[aria-label^="Minimize"]'); await page.waitForTimeout(4000)
    await page.click('[data-dock-app="messages"]'); await page.waitForTimeout(1600)
    const back = { ...(await page.evaluate(() => { const el = document.querySelector('.wf[data-app="messages"] .chat__scroll'); const more = document.querySelector('.wf[data-app="messages"] .chat__new'); return { top: Math.round(el.scrollTop), more: more.hasAttribute('data-show') ? more.textContent.trim() : null } })), spare: await spareOf() }
    ok('minimised part-way up and brought back, the conversation is where it was left, with the way to the newest offered', Math.abs(back.top - left) < 4 && back.spare < 60 && /new/.test(back.more || ''), JSON.stringify({ left, back }))
    // …and closed from there, it opens again at the newest message all the same
    await page.click('.wf[data-app="messages"] button[aria-label^="Close"]'); await page.waitForTimeout(2500)
    await page.click('[data-dock-app="messages"]'); await page.waitForTimeout(1600)
    const fresh = await page.evaluate(() => { const el = document.querySelector('.wf[data-app="messages"] .chat__scroll'); const box = el.getBoundingClientRect(); const said = [...el.querySelectorAll('.chat__thread [data-person]:not([data-typing])')]; const last = said[said.length - 1].getBoundingClientRect(); return { lastInView: last.bottom > box.top + 40 && last.top < box.bottom, more: document.querySelector('.wf[data-app="messages"] .chat__new').hasAttribute('data-show') } })
    fresh.spare = await spareOf()
    ok('closed from part-way up and opened again, it is at the newest message, with nothing left to be offered and no empty space under it', fresh.lastInView && !fresh.more && fresh.spare < 60, JSON.stringify(fresh))
  }
  // Every reply at once, from the head of the conversation
  const pill = page.locator('.wf[data-app="messages"] .chat__all[data-show]')
  ok('while replies are still coming, the conversation offers them all at once', (await pill.count()) === 1 && /Load all 80 replies/.test(await pill.textContent()), await pill.textContent().catch(() => 'no pill'))
  await pill.click(); await page.waitForTimeout(800)
  const all = await page.evaluate(() => ({ people: document.querySelectorAll('.wf[data-app="messages"] .chat__thread [data-person]').length, pill: !!document.querySelector('.wf[data-app="messages"] .chat__all[data-show]'), tail: [...document.querySelectorAll('.wf[data-app="messages"] .chat__thread [data-from="me"] .ss-bubble__text')].map((b) => b.textContent).slice(-2) }))
  ok('pressed, all eighty are there and the offer goes; the last reply is the end of the conversation', all.people === 80 && !all.pill && !all.tail.some((t) => /anyway|ツ|portfolio|one-pager/i.test(t)), JSON.stringify(all))

  // ---- Finder
  await page.click('[data-dock-app="finder"]'); await page.waitForTimeout(600)
  const logos = await page.evaluate(() => ({ tiles: document.querySelectorAll('.pf-file').length, images: document.querySelectorAll('.pf-file .logo img').length, initials: document.querySelectorAll('.pf-file .logo[data-empty]').length }))
  ok('every company has a logo tile or its initial', logos.tiles === 79 && logos.images + logos.initials === 79, JSON.stringify(logos))
  // A window's own capsules are light glass with dark marks on them. (What is let down from the menu bar is
  // dark glass, with tokens of its own: these must not take its color, as they once did.)
  const caps = await page.evaluate(() => [...document.querySelectorAll('.wf[data-app="finder"] .tool__cap, .wf[data-app="finder"] .tool--search .search')].map((el) => { const m = /rgba?\((\d+), (\d+), (\d+)/.exec(getComputedStyle(el).backgroundColor); return m ? Math.min(+m[1], +m[2], +m[3]) : -1 }))
  ok('the capsules in a window’s toolbar are light glass', caps.length >= 2 && caps.every((c) => c >= 235), JSON.stringify(caps))
  await page.locator('.pf__icons').evaluate((el) => (el.scrollTop = el.scrollHeight)); await page.waitForTimeout(1500)
  const broken = await page.evaluate(() => [...document.querySelectorAll('.pf-file .logo img')].filter((i) => i.complete && !i.naturalWidth).map((i) => i.src))
  ok('no logo fails to load', broken.length === 0, broken.slice(0, 3).join(','))
  await page.fill('.pf .search__input', 'liquid'); await page.waitForTimeout(400)
  const hit = await page.evaluate(() => ({ n: document.querySelectorAll('.pf-file').length, preview: document.querySelector('.pf-preview__name')?.textContent, visit: document.querySelector('.pf-preview__visit')?.getAttribute('href') }))
  ok('search narrows the portfolio and the preview follows', hit.n === 1 && /Liquid/.test(hit.preview || ''), JSON.stringify(hit))
  const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null), page.dblclick('.pf-file')])
  ok('double-click opens the company in a new tab', !!popup, popup ? popup.url() : 'no tab')
  if (popup) await popup.close()
  await page.fill('.pf .search__input', ''); await page.click('[aria-label="as List"]'); await page.waitForTimeout(400)
  ok('list view lists every company', (await page.locator('.pf-row:not(.pf-row--head)').count()) === 79)
  await page.click('[aria-label="as Icons"]')

  // ---- the rest
  await page.click('[data-dock-app="terminal"]'); await page.waitForTimeout(500)
  await page.keyboard.type('y'); await page.keyboard.press('Enter'); await page.waitForTimeout(400)
  ok('the terminal answers a yes with what can be read now, and asks for nothing', /two are public/.test(await page.locator('.term__log').innerText()) && (await page.locator('.term__link').count()) === 3 && !/email/i.test(await page.locator('.term__log').innerText()))
  // ---- ArtStore: in the Dock after Workspace, with Books and My VIP after it, and an app like the others. Where
  // VIP was a link to the points site there are the stores in windows now, the store's own pages in a frame
  // under each window's bar (store-window.cjs walks them)
  const vip = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.dock [data-dock-item]')]
    const b = document.querySelector('.dock [data-dock-app="store"]')
    return b && { tag: b.tagName, at: items.indexOf(b), of: items.length, last: items[items.length - 1].getAttribute('data-dock-app'), afterApps: b.previousElementSibling?.getAttribute('data-dock-app'), name: b.getAttribute('aria-label'), label: b.querySelector('.dock__label').textContent.trim(), tile: !!b.querySelector('.dock__icon svg.app-icon'), links: document.querySelectorAll('.dock a').length, open: b.hasAttribute('data-open') }
  })
  const AT = DOCK_IDS.indexOf('store')
  ok('ArtStore is in the Dock after Workspace, under its own tile and name, with Books after it and My VIP last', !!vip && vip.at === AT && vip.of === DOCK.length && vip.last === 'myvip' && vip.afterApps === 'workspace' && DOCK_IDS[AT + 1] === 'books' && vip.label === 'ArtStore' && vip.tile, JSON.stringify(vip))
  ok('it is an app as the others are: a button that says what it holds, and nothing in the Dock is a link', !!vip && vip.tag === 'BUTTON' && vip.name === 'ArtStore: Six pieces, fifty of each' && vip.links === 0 && !vip.open, JSON.stringify(vip))
  const front = () => page.evaluate(() => ({ front: document.querySelector('.wf[data-active]')?.dataset.app ?? null, open: [...document.querySelectorAll('.wf[data-app]')].filter((w) => !w.hasAttribute('inert') && getComputedStyle(w).visibility !== 'hidden').map((w) => w.dataset.app).sort().join(), dot: document.querySelector('.dock [data-dock-app="store"]').hasAttribute('data-open'), title: document.title }))
  const tabs = ctx.pages().length
  await page.click('.dock [data-dock-app="store"]')
  const shop = page.frameLocator('.wf[data-app="store"] iframe.storewin__frame')
  await shop.locator('.ui-prod').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(500)
  const now = await front()
  ok('clicked, it opens a window on this desk, in front, with a dot under its icon, and no tab', now.front === 'store' && /store/.test(now.open) && now.dot && /^ArtStore/.test(now.title) && ctx.pages().length === tabs, JSON.stringify(now))
  const held = await page.evaluate(() => {
    const w = document.querySelector('.wf[data-app="store"]')
    const f = w.querySelector('iframe.storewin__frame')
    const r = w.getBoundingClientRect(), fr = f.getBoundingClientRect(), bar = w.querySelector('.ss-window__bar').getBoundingClientRect()
    const name = w.querySelector('.storebar__name')
    return { w: Math.round(r.width), h: Math.round(r.height), path: f.contentWindow.location.pathname, room: f.contentWindow.location.search, same: f.contentWindow.location.origin === location.origin, name: `${name?.textContent.trim()}${name?.getAttribute('aria-current') ? '*' : ''}`, says: w.querySelector('.storebar__says')?.textContent.trim(), wallet: !!w.querySelector('.storebar__wallet'), barH: Math.round(bar.height), under: Math.round(fr.top - bar.bottom), fills: Math.abs(fr.width - r.width) <= 2 && Math.abs(fr.bottom - r.bottom) <= 2 }
  })
  ok('the window opens at the size the store was drawn for, with the store\'s own pages in it, served by this site', held.w === 1120 && held.h === 720 && held.path === '/vip/store/' && held.same && held.fills, JSON.stringify(held))
  ok('its bar is one row, sixty tall, with the frame straight under it: the store\'s name, nothing said in its middle, and no balance for a visitor', held.name === 'ArtStore*' && held.says === '' && held.room === '?k=art' && !held.wallet && held.barH === 60 && Math.abs(held.under) <= 1, JSON.stringify(held))
  const inside = await shop.locator('body').evaluate(() => ({ bar: !!document.querySelector('.ui-top'), demo: !!document.querySelector('.demo'), products: document.querySelectorAll('.ui-prod').length, priced: [...document.querySelectorAll('.ui-prod')].some((p) => /\$\d/.test(p.textContent)), points: [...document.querySelectorAll('.ui-prod')].some((p) => /\bpts\b|points/i.test(p.textContent)) }))
  // (No piece says its price on the shelf: a price is on the piece's own page, Dom 27 Nov)
  ok('the pages in it are drawn without a bar of their own, and no piece on the shelf says a price', !inside.bar && !inside.demo && inside.products === 6 && !inside.priced && !inside.points, JSON.stringify(inside))
  // A piece opened is the frame's own page; the name in the bar brings the six back, and the pages do not load again to get there
  await shop.locator('.ui-prod').first().click(); await page.waitForTimeout(600)
  const piece = await page.evaluate(() => ({ name: document.querySelector('.wf[data-app="store"] .storebar__name').getAttribute('aria-current'), search: document.querySelector('.storewin__frame').contentWindow.location.search, dollars: /\$\d/.test(document.querySelector('.storewin__frame').contentDocument.body.textContent) }))
  await page.click('.wf[data-app="store"] .storebar__name'); await page.waitForTimeout(600)
  const six = await page.evaluate(() => ({ name: document.querySelector('.wf[data-app="store"] .storebar__name').getAttribute('aria-current'), search: document.querySelector('.storewin__frame').contentWindow.location.search }))
  ok('a piece opened is its own page in the frame, priced in dollars, and the name in the bar leads back to all of them', /^\?k=art&p=/.test(piece.search) && piece.dollars && piece.name === null && six.search === '?k=art' && six.name === 'page', JSON.stringify({ piece, six }))
  // A press inside the frame is a press on the window: it comes to the front
  await page.click('.dock [data-dock-app="terminal"]'); await page.waitForTimeout(500)
  const behind = await front()
  await shop.locator('.ui-shop').click({ position: { x: 6, y: 6 } }); await page.waitForTimeout(400)
  ok('a press inside the store brings its window to the front', behind.front === 'terminal' && (await front()).front === 'store', JSON.stringify(behind))
  // From the keyboard it is a stop along the Dock like any other, and Return comes to it
  await page.click('.dock [data-dock-app="terminal"]'); await page.waitForTimeout(400)
  await page.focus(`[data-dock-app="${DOCK_IDS[DOCK_IDS.indexOf('store') - 1]}"]`); await page.keyboard.press('ArrowRight')
  const onIt = await page.evaluate(() => document.activeElement?.getAttribute('data-dock-app'))
  await page.keyboard.press('Enter'); await page.waitForTimeout(500)
  ok('the arrow keys along the Dock stop on it, and Return brings its window forward', onIt === 'store' && (await front()).front === 'store' && ctx.pages().length === tabs, JSON.stringify({ onIt }))
  // The Go menu lists it with the Dock's apps, as the app it is; the one-pager after them, which opens in Preview (preview.cjs)
  await page.click('[data-menu-title="go"]'); await page.waitForTimeout(300)
  const go = await page.evaluate(() => [...document.querySelectorAll('[data-menu="go"] [data-menu-item]')].map((el) => `${el.tagName.toLowerCase()} ${el.getAttribute('aria-label') ?? el.textContent.trim()}${el.tagName === 'A' ? ` ${el.getAttribute('href')} ${el.target}` : ''}`))
  ok('the Go menu has it after the apps, as one of them, and nothing in the menu is a link', go.join(' | ') === [...DOCK.map(([, name]) => `button ${name}`), 'button One-pager'].join(' | '), go.join(' | '))
  await page.keyboard.press('Escape'); await page.waitForTimeout(300)
  // Closed, it leaves the desk as it was: the dot goes, and the window behind it is in front
  await page.click('.wf[data-app="store"] button[aria-label^="Close"]'); await page.waitForTimeout(600)
  const shut = await front()
  ok('closed, the store leaves the desk: no dot under its icon, and another window in front', !/store/.test(shut.open) && !shut.dot && shut.front !== 'store', JSON.stringify(shut))
  // screen saver
  await page.click('[data-menu-title="mark"]'); await page.click('.menu__item:has-text("Start Screen Saver")'); await page.waitForTimeout(1200)
  ok('the screen saver starts', (await page.locator('.saver[data-on]').count()) === 1)
  await page.mouse.move(400, 400); await page.mouse.move(420, 420); await page.waitForTimeout(700)
  ok('and wakes on movement', (await page.locator('.saver[data-on]').count()) === 0)
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.slice(0, 8).join('\n') : 'no console errors')
  await browser.close()
})().catch((e) => { console.error('FAILED', e.message.split('\n').slice(0, 10).join('\n')); process.exit(1) })
