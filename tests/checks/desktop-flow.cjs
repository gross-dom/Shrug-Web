// What the redesign changed, exercised on the desktop: the conversation, its list and details, the logo Finder, and the rest still working.
const { chromium } = require('playwright')
;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  // (the weather the desk's widget asks for is answered here: lib.cjs)
  await require('./lib.cjs').weather(ctx)
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))
  const ok = (label, pass, detail = '') => console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`)
  await page.goto((process.argv[2] || 'http://127.0.0.1:5173/') + '?open=portfolio,faqs,case-studies,vip')
  // ---- what this round changed
  // (Looked at as soon as it is there: the first reply is under three seconds away)
  await page.waitForSelector('.conv', { timeout: 20000 }); await page.waitForTimeout(250)
  const bar = await page.evaluate(() => ({ menus: [...document.querySelectorAll('.menubar__title')].map((t) => t.textContent.trim()), status: document.querySelector('.menubar__status').textContent.trim(), links: document.querySelectorAll('.menubar__status a, .menubar__status button').length }))
  ok('the menu bar has no Help, reply count or one-pager', !bar.menus.includes('Help') && bar.links === 0 && !/replied|pager/i.test(bar.status), JSON.stringify(bar))
  const list = await page.evaluate(() => ({ rows: document.querySelectorAll('.conv').length, first: document.querySelector('.conv .ss-row__title')?.textContent, replies: document.querySelectorAll('.chat__thread [data-person]').length }))
  ok('the left panel has Testimonials and the three easter-egg conversations, before anyone has replied', list.rows === 4 && list.first === 'Testimonials' && list.replies === 0, JSON.stringify(list))
  // The shrug is drawn in one place on the desktop: the corner of the menu bar. It is the emoticon there, not the logo
  const mark = await page.evaluate(() => { const el = document.querySelector('[data-menu-mark]'); const shrug = '¯\\_(ツ)_/¯'; const rest = document.body.innerText.split(shrug).length - 1; return { text: el?.textContent.trim(), drawn: !!el?.querySelector('svg'), times: rest } })
  ok('the corner of the menu bar is the shrug emoticon, and that is the only place it is', mark.text === '¯\\_(ツ)_/¯' && !mark.drawn && mark.times === 1, JSON.stringify(mark))
  // The Dock: air between its icons, and the one-pager as a sheet of paper as tall as they are
  const dock = await page.evaluate(() => {
    const icons = [...document.querySelectorAll('.dock__item .dock__icon')].map((el) => el.getBoundingClientRect())
    const apps = icons.slice(0, 5)
    const gaps = apps.slice(1).map((r, i) => Math.round(r.left - apps[i].right))
    const paper = document.querySelector('.dock__icon--doc svg')?.getBoundingClientRect()
    return { gaps, app: Math.round(apps[0].height), paper: paper ? Math.round(paper.height) : 0, sheet: !!document.querySelector('.dock__icon--doc') }
  })
  ok('the Dock keeps a quarter of an icon between two, and the one-pager is its sheet of paper, as tall as they are', dock.gaps.every((g) => g >= 12 && g <= 18) && dock.sheet && Math.abs(dock.paper - dock.app) <= 4, JSON.stringify(dock))
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
  // menu bar and beside the desk's icons, not over them. (Looked at once it has come to rest)
  const note = await page.waitForSelector('.notify__card', { timeout: 15000 }).then(async (el) => { await page.waitForTimeout(450); return el.evaluate((card) => { const r = card.getBoundingClientRect(); const icons = Math.min(...[...document.querySelectorAll('.desk__item')].map((icon) => icon.getBoundingClientRect().left)); return { from: card.querySelector('.notify__from')?.textContent, clear: Math.round(icons - r.right), right: Math.round(innerWidth - r.right), top: Math.round(r.top) } }) }).catch(() => null)
  ok('a reply that lands meanwhile drops in at the top right, under the menu bar and clear of the desk\'s icons', !!note && note.from === 'Testimonials' && note.clear >= 8 && note.right <= 140 && note.top >= 30 && note.top <= 60, JSON.stringify(note))
  // The count on the Dock is a circle, as a badge is
  const badge = await page.evaluate(() => { const r = document.querySelector('.dock__badge')?.getBoundingClientRect(); return r ? { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 } : null })
  ok('the count on the Dock is a circle', !!badge && Math.abs(badge.w - badge.h) < 0.6, JSON.stringify(badge))
  await page.click('.conv[data-conversation="group"]'); await page.waitForTimeout(500)
  const backIn = await page.evaluate(() => ({ unread: !!document.querySelector('.conv[data-conversation="group"][data-unread]'), badge: document.querySelector('.dock__badge')?.textContent ?? null }))
  ok('opening Testimonials again clears both', !backIn.unread && backIn.badge === null, JSON.stringify(backIn))
  // In the list, the name and the last message are set against the middle of the face beside them
  const rows = await page.evaluate(() => [...document.querySelectorAll('.conv')].map((row) => {
    const face = row.querySelector('.ss-row__lead > *').getBoundingClientRect(); const head = row.querySelector('.ss-row__head').getBoundingClientRect(); const said = row.querySelector('.ss-row__preview').getBoundingClientRect()
    return Math.round(Math.abs((face.top + face.bottom) / 2 - (head.top + said.bottom) / 2) * 10) / 10
  }))
  ok('in the list, a name and its last message are level with the middle of the face', rows.length === 4 && rows.every((off) => off <= 1), `off by ${rows.join(', ')}`)
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
  ok('while replies are still coming, the conversation offers them all at once', (await pill.count()) === 1 && /Load all 89 replies/.test(await pill.textContent()), await pill.textContent().catch(() => 'no pill'))
  await pill.click(); await page.waitForTimeout(800)
  const all = await page.evaluate(() => ({ people: document.querySelectorAll('.wf[data-app="messages"] .chat__thread [data-person]').length, pill: !!document.querySelector('.wf[data-app="messages"] .chat__all[data-show]'), tail: [...document.querySelectorAll('.wf[data-app="messages"] .chat__thread [data-from="me"] .ss-bubble__text')].map((b) => b.textContent).slice(-2) }))
  ok('pressed, all eighty-nine are there and the offer goes; the last reply is the end of the conversation', all.people === 89 && !all.pill && !all.tail.some((t) => /anyway|ツ|portfolio|one-pager/i.test(t)), JSON.stringify(all))

  // ---- Finder
  await page.click('[data-dock-app="finder"]'); await page.waitForTimeout(600)
  const logos = await page.evaluate(() => ({ tiles: document.querySelectorAll('.pf-file').length, images: document.querySelectorAll('.pf-file .logo img').length, initials: document.querySelectorAll('.pf-file .logo[data-empty]').length }))
  ok('every company has a logo tile or its initial', logos.tiles === 79 && logos.images + logos.initials === 79, JSON.stringify(logos))
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
  await page.click('[data-dock-app="photos"]'); await page.waitForTimeout(500)
  await page.click('.seg [data-target="video"]'); await page.waitForTimeout(400)
  ok('VIP filters to videos', (await page.locator('.vip-tile').count()) === (await page.locator('.vip-tile[data-kind="video"]').count()))
  ok('VIP is one grid: no sidebar of drops, no row of them along the top', (await page.locator('.wf[data-app="photos"] .side, .wf[data-app="photos"] .vip__chips, .wf[data-app="photos"] .chip').count()) === 0)
  // screen saver
  await page.click('[data-menu-title="mark"]'); await page.click('.menu__item:has-text("Start Screen Saver")'); await page.waitForTimeout(1200)
  ok('the screen saver starts', (await page.locator('.saver[data-on]').count()) === 1)
  await page.mouse.move(400, 400); await page.mouse.move(420, 420); await page.waitForTimeout(700)
  ok('and wakes on movement', (await page.locator('.saver[data-on]').count()) === 0)
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.slice(0, 8).join('\n') : 'no console errors')
  await browser.close()
})().catch((e) => { console.error('FAILED', e.message.split('\n').slice(0, 10).join('\n')); process.exit(1) })
