// What the redesign changed, exercised on the desktop: the conversation, its list and details, the logo Finder, and the rest still working.
const { chromium } = require('playwright')
;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))
  const ok = (label, pass, detail = '') => console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`)
  await page.goto((process.argv[2] || 'http://127.0.0.1:5173/') + '?open=portfolio,faqs,case-studies,vip')
  // ---- what this round changed
  await page.waitForTimeout(2500)
  const bar = await page.evaluate(() => ({ menus: [...document.querySelectorAll('.menubar__title')].map((t) => t.textContent.trim()), status: document.querySelector('.menubar__status').textContent.trim(), links: document.querySelectorAll('.menubar__status a, .menubar__status button').length }))
  ok('the menu bar has no Help, reply count or one-pager', !bar.menus.includes('Help') && bar.links === 0 && !/replied|pager/i.test(bar.status), JSON.stringify(bar))
  const list = await page.evaluate(() => ({ rows: document.querySelectorAll('.conv').length, first: document.querySelector('.conv .ss-row__title')?.textContent, replies: document.querySelectorAll('.chat__thread [data-person]').length }))
  ok('the left panel has Shrug Family and the five easter-egg conversations, before anyone has replied', list.rows === 6 && list.first === 'Shrug Family' && list.replies === 0, JSON.stringify(list))
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
  const failed = await page.evaluate(() => ({ bubble: document.querySelector('.chat-failed .ss-bubble__text')?.textContent, note: document.querySelector('.chat-undelivered')?.textContent }))
  ok('a typed message is shown as not delivered', failed.bubble === 'hello from a visitor' && failed.note === 'Not Delivered', JSON.stringify(failed))

  // the list: keyboard moves between conversations
  await page.focus('.conv-list'); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(500)
  const open1 = await page.evaluate(() => ({ selected: document.querySelector('.conv[data-selected]')?.getAttribute('data-conversation'), name: document.querySelector('.chat-id__name span')?.textContent, bubbles: document.querySelectorAll('.chat__thread .ss-bubble').length }))
  ok('arrow keys open the next conversation', open1.selected === 'founder' && open1.bubbles === 4, JSON.stringify(open1))
  // away from the group, its replies are new: the row is marked and the Dock counts them
  await page.waitForTimeout(3600)
  const away = await page.evaluate(() => ({ unread: !!document.querySelector('.conv[data-conversation="group"][data-unread]'), badge: document.querySelector('.dock__badge')?.textContent ?? null }))
  ok('with another conversation open, new replies mark Shrug Family and the Dock counts them', away.unread && +away.badge >= 1, JSON.stringify(away))
  await page.click('.conv[data-conversation="group"]'); await page.waitForTimeout(500)
  const backIn = await page.evaluate(() => ({ unread: !!document.querySelector('.conv[data-conversation="group"][data-unread]'), badge: document.querySelector('.dock__badge')?.textContent ?? null }))
  ok('opening Shrug Family again clears both', !backIn.unread && backIn.badge === null, JSON.stringify(backIn))
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
  ok('searching finds people in Shrug Family by role', (await page.locator('.conv-found [data-row]').count()) === 1 && /Kevin Olusola/.test(await page.locator('.conv-found').innerText()), (await page.locator('.conv-found').innerText()).replace(/\s+/g, ' ').slice(0, 80))
  await page.fill('.chat-side .search__input', ''); await page.waitForTimeout(300)
  const root = await page.evaluate(() => ({ top: document.querySelector('.os').scrollTop, left: document.querySelector('.os').scrollLeft, doc: document.scrollingElement.scrollTop }))
  ok('nothing scrolled the desktop itself', !root.top && !root.left && !root.doc, JSON.stringify(root))

  // ---- Finder
  await page.click('[data-dock-app="finder"]'); await page.waitForTimeout(600)
  const logos = await page.evaluate(() => ({ tiles: document.querySelectorAll('.pf-file').length, images: document.querySelectorAll('.pf-file .logo img').length, initials: document.querySelectorAll('.pf-file .logo[data-empty]').length }))
  ok('every company has a logo tile or its initial', logos.tiles === 81 && logos.images + logos.initials === 81, JSON.stringify(logos))
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
  ok('list view lists every company', (await page.locator('.pf-row:not(.pf-row--head)').count()) === 81)
  await page.click('[aria-label="as Icons"]')

  // ---- the rest
  await page.click('[data-dock-app="terminal"]'); await page.waitForTimeout(500)
  await page.keyboard.type('y'); await page.keyboard.press('Enter'); await page.waitForTimeout(400)
  ok('the terminal answers a yes with what can be read now, and asks for nothing', /two are public/.test(await page.locator('.term__log').innerText()) && (await page.locator('.term__link').count()) === 3 && !/email/i.test(await page.locator('.term__log').innerText()))
  await page.click('[data-dock-app="photos"]'); await page.waitForTimeout(500)
  await page.click('.seg [data-target="video"]'); await page.waitForTimeout(400)
  ok('VIP filters to videos', (await page.locator('.vip-tile').count()) === (await page.locator('.vip-tile[data-kind="video"]').count()))
  // screen saver
  await page.click('[data-menu-title="mark"]'); await page.click('.menu__item:has-text("Start Screen Saver")'); await page.waitForTimeout(1200)
  ok('the screen saver starts', (await page.locator('.saver[data-on]').count()) === 1)
  await page.mouse.move(400, 400); await page.mouse.move(420, 420); await page.waitForTimeout(700)
  ok('and wakes on movement', (await page.locator('.saver[data-on]').count()) === 0)
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.slice(0, 8).join('\n') : 'no console errors')
  await browser.close()
})().catch((e) => { console.error('FAILED', e.message.split('\n').slice(0, 10).join('\n')); process.exit(1) })
