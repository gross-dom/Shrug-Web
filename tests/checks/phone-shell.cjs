// Fixer S1's checks: the iPhone itself (its frame, the Lock Screen, the Home Screen, the Dock, banners, the App
// Switcher, Auto-Lock, the home bar, and the phone's place in the browser's history).
//   node phone-shell.cjs [base] [sections]     base: http://127.0.0.1:5173/ by default (or BASE in the environment)
//   sections: letters to run, e.g. "ABD"; all of them by default. Exits non-zero if anything fails.
// A frame  B lock over an app, reading  C back to the tab  D Lock Screen  E keyboard focus  F title
// G App Switcher  H one press, one move  I history  J home bar  K lingering  L reload  M small things  N fit
// O the edges (what a phone's browser paints its bars from)  P the glass (nothing see-through over a pane of it)
const A = require('./lib.cjs')
const path = require('path')
const BASE = process.argv[2] && /^https?:/.test(process.argv[2]) ? process.argv[2] : process.env.BASE || 'http://127.0.0.1:5173/'
const ONLY = (process.argv[3] || (process.argv[2] && !/^https?:/.test(process.argv[2]) ? process.argv[2] : '')).toUpperCase()
const OUT = A.OUT
require('fs').mkdirSync(OUT, { recursive: true })

let failed = 0
const say = (ok, name, detail = '') => {
  if (!ok) failed++
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + String(detail).slice(0, 300) : ''))
}

const touchOf = (t) => ({
  down: (x, y) => t.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }),
  move: (x, y) => t.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }),
  up: () => t.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
  async tap(x, y) { await this.down(x, y); await this.up() },
  async path(points, ms = 16) { await this.down(...points[0]); for (const p of points.slice(1)) { await this.move(...p); await t.sleep(ms) } await this.up() },
})

;(async () => {
  const browser = await A.launch()
  const fresh = async (device, query = 'still', opts = {}) => {
    const t = await A.open(browser, { device, base: BASE, query, ...opts })
    await t.page.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.ph'), null, { timeout: 30000 })
    await t.page.waitForTimeout(500)
    t.touch = touchOf(t)
    return t
  }
  const st = (page) => A.state(page)
  const press = async (t, x, y) => (t.device.touch ? t.touch.tap(x, y) : t.page.mouse.click(x, y))
  const mid = (page, sel) => page.evaluate((sel) => { const el = [...document.querySelectorAll(sel)].find((e) => !e.closest('[inert]') && e.getBoundingClientRect().width > 0); if (!el) return null; const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] }, sel)
  const section = async (letter, name, run) => {
    if (ONLY && !ONLY.includes(letter)) return
    console.log(`-- ${letter}. ${name}`)
    try { await run() } catch (e) { say(false, `${letter}: the check itself stopped`, e.message.split('\n')[0]) }
  }

  // ---- A. The frame is never cut off and never tiny (PH-1, DK-3, AX-2, PH-11)
  await section('A', 'the frame', async () => {
    for (const [w, h] of [[640, 360], [500, 400], [1024, 456], [1200, 470], [320, 180]]) {
      const t = await fresh({ w, h, dpr: 1 })
      const p = t.page
      const lay = await A.layout(p)
      const lock = await p.evaluate(() => { const r = document.querySelector('.sb-lock__hint').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 0.5 && r.left >= 0 && r.right <= innerWidth + 0.5 })
      await A.unlock(p)
      // everything on the Home Screen can be got to (where it scrolls, by scrolling)
      const home = await p.evaluate(() => [...document.querySelectorAll('.sb-home .sb-icon, .sb-home .sb-widget, .sb-home .sb-search')].filter((el) => getComputedStyle(el).display !== 'none').map((el) => { el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect(); return r.top >= -0.5 && r.bottom <= innerHeight + 0.5 && r.left >= -0.5 && r.right <= innerWidth + 0.5 ? null : (el.getAttribute('aria-label') || el.textContent).trim().slice(0, 14) }).filter(Boolean))
      await A.at(p, 'messages', ['c:group'])
      const chat = await p.evaluate(() => { const f = document.querySelector('.sb-slot[data-front] textarea, .sb-slot[data-front] input'); const b = document.querySelector('.sb-homebar'); const inside = (el) => { const r = el.getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight + 0.5 }; f?.focus(); return { field: !!f && inside(f), bar: inside(b), page: document.scrollingElement.scrollTop + window.scrollY } })
      say(lay === 'phone-bleed' && lock && home.length === 0 && chat.field && chat.bar && chat.page === 0, `${w}x${h}: edge to edge, nothing below the window, nothing out of reach`, JSON.stringify({ lay, lock, home, chat }))
      say(A.realErrors(t.errors).length === 0, `${w}x${h}: no errors`, A.realErrors(t.errors).slice(0, 2).join(' | '))
      await t.ctx.close()
    }
    for (const [w, h, query, want] of [[600, 900, 'still', 'phone-framed'], [1280, 620, 'phone&still', 'phone-framed'], [1280, 500, 'phone&still', 'phone-bleed'], [700, 600, 'still', 'phone-bleed']]) {
      const t = await fresh({ w, h, dpr: 1 }, query)
      const p = t.page
      const lay = await A.layout(p)
      let fits = true
      if (want === 'phone-framed') {
        await A.unlock(p)
        await A.at(p, 'messages', ['c:group'])
        fits = await p.evaluate(() => { const d = document.querySelector('.ph-device').getBoundingClientRect(); const desk = document.querySelector('.ph-desk'); document.querySelector('.sb-slot[data-front] textarea, .sb-slot[data-front] input')?.focus(); return d.top >= 0 && d.bottom <= innerHeight + 0.5 && d.left >= 0 && d.right <= innerWidth + 0.5 && d.width / 428 >= 0.57 && desk.scrollTop === 0 && getComputedStyle(desk).overflowY === 'clip' })
      }
      say(lay === want && fits, `${w}x${h}${query.includes('phone') ? ' asked for the phone' : ''}: ${want === 'phone-framed' ? 'in its frame, whole, and the frame cannot be scrolled' : 'edge to edge'}`, JSON.stringify({ lay, fits }))
      await t.ctx.close()
    }
  })

  // ---- B. Locked over an app, the app is out of sight (RS-5); reading is not left alone (AX-17)
  await section('B', 'Auto-Lock', async () => {
    const t = await fresh('iphone', 'still&idle=3')
    const p = t.page
    await A.unlock(p)
    await A.at(p, 'notes', ['f:faqs'])
    await p.waitForFunction(() => !!document.querySelector('.sb-lock:not([data-leaving])'), null, { timeout: 9000 }).catch(() => {})
    await p.waitForTimeout(500)
    const over = await p.evaluate(() => { const a = getComputedStyle(document.querySelector('.sb-apps')); return { locked: !!document.querySelector('.sb-lock:not([data-leaving])'), visibility: a.visibility, opacity: a.opacity } })
    say(over.locked && over.visibility === 'hidden' && over.opacity === '0', 'it locks over a list, and the app is out of sight behind the Lock Screen', JSON.stringify(over))
    await p.screenshot({ path: path.join(OUT, 'fix-lockover.png') })
    await p.keyboard.press('a'); await p.waitForTimeout(900)
    const back = await p.evaluate(() => ({ vis: getComputedStyle(document.querySelector('.sb-apps')).visibility, place: history.state.shrug.stacks.notes.join() }))
    say(back.vis === 'visible' && back.place === 'f:faqs', 'opened again, the app is back where it was', JSON.stringify(back))
    // a note is there to be read: the phone does not lock over it
    await A.at(p, 'notes', ['f:faqs', 'n:2'])
    await p.waitForTimeout(4600)
    say(!(await st(p)).locked, 'a note being read is not locked over')
    await A.at(p, 'messages', ['c:group'])
    await p.waitForTimeout(4600)
    say(!(await st(p)).locked, 'nor is a conversation')
    await t.ctx.close()
  })

  // ---- C. Coming back to the tab counts as being there (RS-11)
  await section('C', 'back to the tab', async () => {
    const t = await fresh('iphone', 'still&idle=4')
    const p = t.page
    await A.unlock(p)
    const hide = (on) => p.evaluate((on) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => on }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (on ? 'hidden' : 'visible') }); document.dispatchEvent(new Event('visibilitychange')) }, on)
    await hide(true)
    await p.waitForTimeout(6000)
    await hide(false)
    await p.waitForTimeout(2200)
    say(!(await st(p)).locked, 'two seconds after coming back from six away, it has not locked')
    await p.waitForTimeout(2600)
    say((await st(p)).locked, 'left alone for its four seconds after that, it does')
    await t.ctx.close()
  })

  // ---- D. The Lock Screen (UX-14, PH-3, PH-14)
  await section('D', 'the Lock Screen', async () => {
    const t = await fresh('iphone')
    const p = t.page
    const hint = await p.evaluate(() => +getComputedStyle(document.querySelector('.sb-lock__hint')).opacity)
    say(hint > 0.8, 'the hint is there at once', hint)
    // The clock is the size an iPhone 17 Pro draws its own, against the width of the screen (read off one: figures
    // 21.4% of the width tall, four of them and a colon 71% of it across, 16 points under the date's baseline). It is
    // drawn, a shape to a figure, so it is that size in any type; the time is there in words for a screen reader
    const clock = await p.evaluate(() => {
      const baseOf = (el) => { const mark = document.createElement('span'); mark.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'; el.appendChild(mark); const y = mark.getBoundingClientRect().bottom; mark.remove(); return y }
      const el = document.querySelector('.sb-lock .sb-lock__clock'); const paths = [...el.querySelectorAll('svg path')].map((x) => x.getBoundingClientRect())
      const top = Math.min(...paths.map((b) => b.top)); const bottom = Math.max(...paths.map((b) => b.bottom)); const left = Math.min(...paths.map((b) => b.left)); const right = Math.max(...paths.map((b) => b.right))
      const r = (n) => Math.round(n * 1000) / 1000
      return { says: el.textContent, figures: paths.length, hidden: el.querySelector('svg').getAttribute('aria-hidden'), tall: r((bottom - top) / innerWidth), wide: r((right - left) / innerWidth), middle: Math.round((left + right) / 2 - innerWidth / 2), underDate: Math.round(top - baseOf(document.querySelector('.sb-lock .sb-lock__date'))), dateDown: Math.round(baseOf(document.querySelector('.sb-lock .sb-lock__date'))) }
    })
    // (how wide it is goes by the time: 11:11 is half the screen across and 04:44 five sixths of it; 20:15, as on the screenshots, is 72%)
    const perFigure = clock.figures === 5 ? [0.5, 0.85] : [0.38, 0.66]
    say(/^\d{1,2}:\d\d$/.test(clock.says) && clock.figures === clock.says.length && clock.hidden === 'true' && clock.tall > 0.205 && clock.tall < 0.222 && clock.wide > perFigure[0] && clock.wide < perFigure[1] && Math.abs(clock.middle) <= 2 && clock.underDate >= 13 && clock.underDate <= 19 && clock.dateDown >= 39 && clock.dateDown <= 43, 'the clock is the size an iPhone draws its own: drawn figures a little over a fifth of the screen across tall, in the middle, 16 points under the date, which is 41 under where the status bar ends', JSON.stringify(clock))
    const box = await p.locator('.sb-lock').boundingBox()
    const at = [box.x + box.width / 2, box.y + box.height * 0.45]
    await p.waitForTimeout(600)
    await press(t, ...at); await p.waitForTimeout(110)
    const lifted = await p.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.sb-lock')).transform).m42)
    say(lifted < -2 && (await st(p)).locked, 'one tap lifts the screen and leaves it locked', lifted)
    // The Lock Screen has no torch and no camera: nothing at its foot but the hint
    const controls = await p.evaluate(() => ({ buttons: [...document.querySelectorAll('.sb-lock button, .sb-lock [role="button"]')].filter((b) => !b.closest('.sb-note')).map((b) => (b.getAttribute('aria-label') || b.textContent).trim()), old: document.querySelectorAll('.sb-lock__control, .sb-lock__beam, .sb-lock [aria-label="Flashlight"], .sb-lock [aria-label^="Camera"]').length }))
    say(controls.old === 0 && !controls.buttons.some((n) => /flashlight|torch|camera/i.test(n)), 'the Lock Screen has no torch and no camera', JSON.stringify(controls))
    await p.waitForTimeout(2100)
    await press(t, ...at); await p.waitForTimeout(500)
    say((await st(p)).locked, 'a tap long after the first only lifts it again')
    await press(t, ...at); await p.waitForTimeout(900)
    say(!(await st(p)).locked, 'a second tap soon after opens it')
    await t.ctx.close()

    // a press that is dragged about is not a tap: two drags across the screen, or down it, do not open it
    const d = await fresh('iphone')
    const q = d.page
    await q.waitForTimeout(600)
    for (const [x1, y1] of [[300, 346], [90, 352], [200, 470]]) { const path = []; for (let i = 0; i <= 6; i++) path.push([196 + ((x1 - 196) * i) / 6, 340 + ((y1 - 340) * i) / 6]); await d.touch.path(path, 12); await q.waitForTimeout(240) }
    await q.waitForTimeout(500)
    say((await st(q)).locked, 'drags across the Lock Screen, and down it, are not taps: three of them in a row do not open it')

    // each reply is shown long enough to read, however fast they land, and one takes over from the last with no gap
    await q.waitForSelector('.sb-lock .sb-note', { timeout: 20000 })
    const shown = await q.evaluate(() => new Promise((done) => {
      const count = () => +(document.querySelector('.sb-lock .sb-activity')?.textContent.match(/(\d+) of/)?.[1] ?? 0)
      const names = []; let least = 1; const t0 = performance.now(); const first = count()
      const tick = () => {
        const now = document.querySelector('.sb-lock .sb-note:not(.sb-note--was)'); const was = document.querySelector('.sb-lock .sb-note--was')
        const name = now?.querySelector('.ss-notification__title')?.textContent
        if (name && names[names.length - 1]?.[0] !== name) names.push([name, Math.round(performance.now() - t0)])
        least = Math.min(least, Math.max(now ? +getComputedStyle(now).opacity : 0, was ? +getComputedStyle(was).opacity : 0))
        if (performance.now() - t0 < 6600) requestAnimationFrame(tick)
        else done({ names, least: +least.toFixed(2), counted: count() - first, notes: document.querySelectorAll('.sb-lock .sb-note:not(.sb-note--was)').length })
      }
      requestAnimationFrame(tick)
    }))
    const stays = shown.names.slice(1).map((n, i) => n[1] - shown.names[i][1]).slice(1)
    say(shown.names.length >= 2 && shown.names.length <= 4 && stays.every((ms) => ms > 2300) && shown.notes === 1, 'the Lock Screen shows a reply for two and a half seconds or so before the next takes its place, however fast they land', JSON.stringify(shown.names))
    say(shown.least > 0.5, 'and one takes over from the last with a notification drawn throughout: it does not go to nothing and fade back in', `the least ever drawn: opacity ${shown.least}`)
    // the edges of the older notifications start at the front one's foot (it is glass: behind it they showed through)
    const edges = await q.evaluate(() => { const s = document.querySelector('.sb-stack'); return { more: s.dataset.more, cut: ['::before', '::after'].map((part) => getComputedStyle(s, part).clipPath.slice(0, 8)) } })
    say(edges.more === '2' && edges.cut.every((c) => c === 'polygon('), 'the older notifications under it are cut to start at its foot: they do not show through it', JSON.stringify(edges))
    // nothing under it counts the replies: Shrug took the bar that did off the Lock Screen
    say((await q.locator('.sb-lock .sb-activity').count()) === 0, 'the Lock Screen has no progress bar under its notification')
    await d.ctx.close()

    // with motion turned down a tap does not lift the screen: the words that say how it opens are lit instead
    const rm = await fresh('iphone', 'still', { reducedMotion: true })
    await rm.page.waitForTimeout(600)
    await rm.touch.tap(196, 340); await rm.page.waitForTimeout(160)
    const lit = await rm.page.evaluate(() => { const h = document.querySelector('.sb-lock__hint'); return { words: getComputedStyle(h).animationName, lasts: getComputedStyle(h).animationDuration, screen: getComputedStyle(document.querySelector('.sb-lock')).animationName, moved: getComputedStyle(h).transform } })
    say(lit.words === 'sb-hint-lit' && lit.lasts === '1s' && lit.screen === 'none' && lit.moved === 'none' && (await st(rm.page)).locked, 'with motion turned down one tap lights the words for a second, and moves nothing', JSON.stringify(lit))
    await rm.ctx.close()

    // at awkward sizes nothing at the foot of the Lock Screen runs into anything else
    for (const [w, h] of [[740, 360], [280, 653], [568, 320], [402, 700], [320, 568]]) {
      const z = await fresh({ w, h, touch: true, dpr: 1 })
      await z.page.waitForSelector('.sb-lock .sb-note', { timeout: 20000 })
      await z.page.waitForTimeout(4200)
      const boxes = await z.page.evaluate(() => {
        const box = (el) => { if (!el || !el.getClientRects().length) return null; const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] }
        const stack = document.querySelector('.sb-stack'); const note = box(document.querySelector('.sb-lock .sb-note:not(.sb-note--was)'))
        const reach = Math.max(0, ...['::before', '::after'].map((part) => { const cs = getComputedStyle(stack, part); return cs.content === 'none' || cs.display === 'none' ? 0 : -parseFloat(cs.bottom) || 0 }))
        return { clock: box(document.querySelector('.sb-lock__clock > svg')), notification: note && [note[0], note[1], note[2], note[3] + reach], activity: box(document.querySelector('.sb-lock .sb-activity')), words: box(document.querySelector('.sb-lock__hint')) }
      })
      const names = Object.keys(boxes).filter((k) => boxes[k]); const over = []
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) { const a = boxes[names[i]], b = boxes[names[j]]; if (a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1) over.push(`${names[i]} over ${names[j]}`) }
      say(!!boxes.notification && !!boxes.words && over.length === 0 && !boxes.activity, `${w}x${h}: the clock, the notification and its stack and the words that open it keep clear of one another, with no bar among them`, over.join(', ') || JSON.stringify(boxes))
      await z.ctx.close()
    }

    // on its side the notification takes a press all over (PH-3)
    const l = await fresh('iphone-land', '')
    await l.page.waitForSelector('.sb-lock .sb-note', { timeout: 20000 })
    await l.page.waitForTimeout(900)
    // (the notification itself: for a moment after each reply the one before is still drawn under it)
    const note = await l.page.locator('.sb-lock .sb-note:not(.sb-note--was)').boundingBox()
    await l.touch.tap(note.x + note.width / 2, note.y + note.height * 0.8); await l.page.waitForTimeout(1300)
    const ls = await st(l.page)
    say(!ls.locked && ls.place?.app === 'messages' && ls.place.stack.join() === 'c:group', 'on its side, a press low on the notification opens the conversation', JSON.stringify(ls.place))
    await l.ctx.close()

    // a bottom safe area: the hint keeps clear of the home bar (PH-14)
    const h = await fresh('iphonefull')
    let inset = true
    try { await h.cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 59, bottom: 34, left: 0, right: 0 } }) } catch { inset = false }
    await h.page.waitForTimeout(400)
    const gap = await h.page.evaluate(() => { const hint = document.querySelector('.sb-lock__hint').getBoundingClientRect(); const pill = document.querySelector('.sb-homebar__pill')?.getBoundingClientRect(); return pill ? pill.top - hint.bottom : 99 })
    say(!inset || gap >= 4, 'with a bottom safe area the hint keeps clear of the home bar', inset ? `gap ${gap}` : 'insets cannot be emulated here')
    await h.ctx.close()
  })

  // ---- E. The keyboard is never left nowhere (AX-7, AX-17)
  await section('E', 'keyboard focus', async () => {
    const t = await fresh({ w: 600, h: 900, dpr: 1 }, 'still&idle=4')
    const p = t.page
    const where = () => p.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? 'BODY' : (a.closest('.sb-slot')?.dataset.app ? 'app:' + a.closest('.sb-slot').dataset.app : a.closest('.sb-home') ? 'home:' + (a.getAttribute('aria-label') || a.textContent).trim().slice(0, 18) : a.className.toString().slice(0, 30)) })
    await A.unlock(p)
    say((await where()).startsWith('home:'), 'opened from the keyboard, the keyboard is on the Home Screen', await where())
    await p.focus('.sb-dock .sb-icon[aria-label^="Notes"]')
    await p.keyboard.press('Enter'); await p.waitForTimeout(1300)
    say((await where()) === 'app:notes', 'an app opened from its icon takes the keyboard', await where())
    await p.keyboard.press('Escape'); await p.waitForTimeout(900)
    await p.keyboard.press('Escape'); await p.waitForTimeout(1200)
    const s = await st(p)
    say(s.place?.app === null && (await where()).startsWith('home:Notes'), 'put away, the keyboard is back on its icon', JSON.stringify([s.place?.app, await where()]))
    // locked and opened again: the keyboard goes back where it was
    await p.focus('.sb-search')
    await p.waitForFunction(() => !!document.querySelector('.sb-lock:not([data-leaving])'), null, { timeout: 9000 }).catch(() => {})
    await p.waitForTimeout(500)
    await p.keyboard.press('a'); await p.waitForTimeout(900)
    say((await where()).startsWith('home:Search'), 'locked and opened again, the keyboard is back where it was', await where())
    await t.ctx.close()
  })

  // ---- F. The title names the place (AX-16)
  await section('F', 'the title', async () => {
    const t = await fresh('iphone')
    const p = t.page
    const titles = { lock: await p.title() }
    await A.unlock(p); titles.home = await p.title()
    await A.at(p, 'messages', ['c:group']); titles.chat = await p.title()
    await A.at(p, 'finder', []); titles.contacts = await p.title()
    await A.at(p, 'finder', ['co:Varda']); titles.company = await p.title()
    await A.at(p, 'finder', ['me']); titles.mine = await p.title()
    await A.at(p, 'notes', ['f:faqs', 'n:4']); titles.note = await p.title()
    await A.at(p, 'photos', []); titles.vip = await p.title()
    // No emoticon in the tab: the name alone on the Lock and Home Screens
    const want = { lock: 'Shrug', home: 'Shrug', chat: 'Testimonials · Messages · Shrug', contacts: 'Portfolio · Contacts · Shrug', company: 'Varda · Contacts · Shrug', mine: 'Shrug Capital · Contacts · Shrug', note: 'How do you do marketing? · Notes · Shrug', vip: 'VIP · Shrug' }
    say(Object.keys(want).every((k) => titles[k] === want[k]), 'the page is titled by where the phone is', JSON.stringify(titles))
    say(Object.values(titles).every((title) => !/ツ/.test(title)), 'and no title has the shrug emoticon in it')
    await t.ctx.close()
  })

  // ---- G. The App Switcher (AX-18, AX-23, MK-1, MK-16)
  await section('G', 'the App Switcher', async () => {
    const t = await fresh('iphone')
    const p = t.page
    await A.unlock(p)
    for (const [app, stack] of [['notes', ['f:faqs']], ['photos', []], ['finder', ['co:Varda']]]) await A.at(p, app, stack, null, 700)
    const key = p.locator('.sb-homebar__key', { hasText: 'App Switcher' })
    await key.focus()
    await p.keyboard.press('Shift'); await p.waitForTimeout(150)
    const shown = await key.evaluate((el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vis: el.matches(':focus-visible') } })
    say(shown.w > 60 && shown.h > 20, 'its button shows itself when it has the keyboard', JSON.stringify(shown))
    // every frame as it comes up: how wide each card is that was not in front (the app in front shrinks from the screen; the others were not on it)
    const entering = p.evaluate(() => new Promise((done) => {
      const widths = []; let n = 0
      const tick = () => {
        if (document.querySelector('.sb-apps[data-switcher]')) { n++; for (const slot of document.querySelectorAll('.sb-slot:not([data-front])')) if (getComputedStyle(slot.querySelector('.sb-zoom')).visibility !== 'hidden') widths.push(Math.round(slot.querySelector('.sb-zoom__app').getBoundingClientRect().width)) }
        if (n < 24) requestAnimationFrame(tick); else done(widths)
      }
      requestAnimationFrame(tick); setTimeout(() => done(widths), 5000)
    }))
    await p.keyboard.press('Enter'); await p.waitForTimeout(900)
    const others = await entering
    say(others.length >= 24 && Math.max(...others) < 393 * 0.8, 'the cards that were not in front come in already the size of a card: none is drawn the size of the screen first', `widest ${Math.max(...others)} of ${others.length} seen`)
    // only the card in the middle shows its name and its close button: a neighbour's are not left over the edge of the screen
    const mine = () => p.evaluate(() => ({ closes: [...document.querySelectorAll('.sb-slot__close')].filter((b) => getComputedStyle(b).visibility !== 'hidden').map((b) => b.getAttribute('aria-label')), names: [...document.querySelectorAll('.sb-slot__label')].filter((l) => +getComputedStyle(l).opacity > 0.5).map((l) => l.textContent.trim()) }))
    const inMiddle = await mine()
    say(inMiddle.closes.join() === 'Close Contacts' && inMiddle.names.join() === 'Contacts', 'only the card in the middle shows its name and its ✕', JSON.stringify(inMiddle))
    let g = await p.evaluate(() => ({ on: !!document.querySelector('.sb-apps[data-switcher]'), focus: document.activeElement?.className?.toString().slice(0, 20), first: document.activeElement?.closest('.sb-slot')?.dataset.app, homes: [...document.querySelectorAll('.ph button, .ph [role="button"]')].filter((b) => !b.closest('[inert]') && ((b.getAttribute('aria-label') || b.textContent).trim() === 'Home Screen')).length, over: history.state.shrug.over, closers: document.querySelectorAll('.sb-slot__close').length }))
    say(g.on && g.focus === 'sb-card__hit' && g.first === 'finder' && g.homes === 1 && g.over === 'switcher' && g.closers === 3, 'Enter opens it: on the card of the app last used, one "Home Screen" button, a close button on each card', JSON.stringify(g))
    // a tap on a card picks the app and presses nothing in it (MK-1)
    const card = await mid(p, '.sb-slot[data-app="finder"] .sb-card__hit')
    await t.touch.tap(...card); await p.waitForTimeout(1100)
    let s = await st(p)
    say(s.place?.app === 'finder' && s.place.stack.join() === 'co:Varda' && s.place.sheet === null && !(await p.evaluate(() => !!document.querySelector('.sb-apps[data-switcher]'))), 'a tap on a card brings the app forward and presses nothing in it', JSON.stringify(s.place))
    // the second card, then the screen turns: still on a card (MK-16)
    await key.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(900)
    await p.evaluate(() => { const hits = [...document.querySelectorAll('.sb-card__hit')]; const order = (h) => +getComputedStyle(h.closest('.sb-slot')).getPropertyValue('--i'); hits.sort((a, b) => order(a) - order(b))[1].focus({ focusVisible: true }) })
    await p.waitForTimeout(500)
    await p.setViewportSize({ width: 760, height: 393 }); await p.waitForTimeout(700)
    const pan = await p.evaluate(() => { const a = document.querySelector('.sb-apps'); return { at: a.dataset.at, pan: parseFloat(a.style.getPropertyValue('--pan')), stride: a.offsetWidth * 0.76 } })
    say(pan.at === '1' && Math.abs(pan.pan - pan.stride) < 1, 'panned to the second card and turned, it still rests on that card', JSON.stringify(pan))
    const second = await mine()
    say(second.closes.join() === 'Close VIP' && second.names.join() === 'VIP', 'and the name and the ✕ showing are that card\'s', JSON.stringify(second))
    await p.setViewportSize({ width: 393, height: 760 }); await p.waitForTimeout(600)
    // Delete closes the card that has the keyboard; the close button closes another
    const before = await p.evaluate(() => document.querySelectorAll('.sb-card__hit').length)
    await p.keyboard.press('Delete'); await p.waitForTimeout(800)
    const mid2 = await p.evaluate(() => ({ cards: document.querySelectorAll('.sb-card__hit').length, focus: document.activeElement?.className?.toString().slice(0, 20) }))
    say(before === 3 && mid2.cards === 2 && mid2.focus === 'sb-card__hit', 'Delete closes the card with the keyboard, which goes to the next', JSON.stringify({ before, mid2 }))
    await p.evaluate(() => document.querySelector('.sb-slot__close').click()); await p.waitForTimeout(800)
    await p.evaluate(() => document.querySelector('.sb-slot__close').click()); await p.waitForTimeout(1000)
    g = await p.evaluate(() => ({ on: !!document.querySelector('.sb-apps[data-switcher]'), app: history.state.shrug.app, focus: document.activeElement === document.body ? 'BODY' : 'somewhere' }))
    say(!g.on && g.app === null && g.focus !== 'BODY', 'with the last card closed it is the Home Screen, the keyboard on it', JSON.stringify(g))
    say(A.realErrors(t.errors).length === 0, 'no errors', A.realErrors(t.errors).slice(0, 2).join(' | '))
    await t.ctx.close()
  })

  // ---- H. One press, one move (MK-2)
  await section('H', 'one press, one move', async () => {
    const t = await fresh('iphone')
    const p = t.page
    await A.unlock(p); await p.waitForTimeout(700)
    // what a tap would land on, at moments after a first tap: sampled in the page, by the page's own clock
    const probe = (points, times) => p.evaluate(([points, times]) => new Promise((done) => {
      const out = []
      const on = (e) => {
        document.removeEventListener('pointerdown', on, true)
        const t0 = performance.now()
        let left = times.length
        for (const ms of times) setTimeout(() => {
          for (const [x, y] of points) { const el = document.elementFromPoint(x, y); out.push([ms, !!el?.closest('.sb-home, .sb-open, .sb-apps'), document.querySelector('.ph').hasAttribute('data-moving')]) }
          if (!--left) done(out)
        }, ms)
      }
      document.addEventListener('pointerdown', on, true)
    }), [points, times])
    const cases = [
      ['Contacts in the Dock', '.sb-dock .sb-icon[aria-label^="Contacts"]', async () => {}],
      ['the Portfolio folder', '.sb-folder', async () => {}],
      ['Back in a note', '.sb-slot[data-front] .ios-page[data-pos="top"] button[aria-label="Back"]', async () => { await A.at(p, 'notes', ['f:faqs', 'n:1']) }],
    ]
    for (const [name, sel, setup] of cases) {
      await A.at(p, null, [], null, 700)
      await setup()
      const at = await mid(p, sel)
      if (!at) { say(false, `${name}: not found`); continue }
      const points = [at, [196, 380], [196, 700], [60, 120]]
      const sampling = probe(points, [40, 90])
      await t.touch.tap(...at)
      const got = await sampling
      const live = got.filter(([, inside]) => inside)
      say(live.length === 0, `${name}: for the first moment after the tap, a second tap would land on nothing anywhere`, JSON.stringify(live.slice(0, 4)))
      await p.waitForTimeout(700)
      const after = await p.evaluate(() => document.querySelector('.ph').hasAttribute('data-moving'))
      say(!after, `${name}: and then the screen takes presses again`)
    }
    // while the move is still being drawn, a second tap where the first was is turned away...
    await A.at(p, 'notes', ['f:faqs', 'n:1'], null, 900)
    const back = await mid(p, '.sb-slot[data-front] .ios-page[data-pos="top"] button[aria-label="Back"]')
    await t.touch.tap(...back); await p.waitForTimeout(230); await t.touch.tap(...back)
    await p.waitForTimeout(900)
    let stack = (await st(p)).place?.stack
    say(JSON.stringify(stack) === '["f:faqs"]', 'two taps a quarter of a second apart on Back go back one screen, not two', JSON.stringify(stack))
    // ...and a press anywhere else is taken at once: Back, while the note is still sliding in
    const row = await mid(p, '.sb-slot[data-front] .ios-page[data-pos="top"] .notes-row, .sb-slot[data-front] .ios-page[data-pos="top"] .notes-list button')
    if (row) {
      await t.touch.tap(...row); await p.waitForTimeout(230)
      const into = (await st(p)).place?.stack
      await t.touch.tap(...back); await p.waitForTimeout(900)
      stack = (await st(p)).place?.stack
      say(into?.length === 2 && JSON.stringify(stack) === '["f:faqs"]', 'Back is taken while the screen it is on is still sliding in', `${JSON.stringify(into)} -> ${JSON.stringify(stack)}`)
    } else say(false, 'a note to press was not found')
    // and for real: two taps on the Portfolio folder open the folder, not a company in Contacts
    await A.at(p, null, [], null, 800)
    const folder = await mid(p, '.sb-folder')
    const times = p.evaluate(() => new Promise((done) => { const ts = []; const on = () => { ts.push(performance.now()); if (ts.length === 2) { document.removeEventListener('pointerdown', on, true); done(ts[1] - ts[0]) } }; document.addEventListener('pointerdown', on, true); setTimeout(() => done(-1), 3000) }))
    await t.touch.tap(...folder); await p.waitForTimeout(120); await t.touch.tap(...folder)
    const apart = await times
    await p.waitForTimeout(1200)
    const s = await st(p)
    if (apart > 0 && apart < 400) say(s.place?.app === null && s.place.sheet === 'folder:portfolio', `two taps ${Math.round(apart)}ms apart on the Portfolio folder open the folder and nothing more`, JSON.stringify(s.place))
    else console.log(`     (two real taps came ${Math.round(apart)}ms apart on this machine: too slow to say anything)`)
    await t.ctx.close()

    // the second tap of two on an app's icon is turned away whole, however late in the opening it comes: no field in
    // the app takes the keyboard from it (a press gives the keyboard before its click is sent), and nothing in it is pressed
    const two = await fresh('iphone')
    const q = two.page
    await q.addStyleTag({ content: '.sb-banner{display:none!important}' })
    await A.unlock(q); await q.waitForTimeout(700)
    // (how far apart the two presses were made is read in the page, off the presses themselves: a busy machine can be late in dealing with the second, which is no later made for that)
    const twice = async (at, gap) => {
      const apart = q.evaluate(() => new Promise((done) => { const made = []; const on = (e) => { made.push(e.timeStamp); if (made.length === 2) { document.removeEventListener('pointerdown', on, true); done(Math.round(made[1] - made[0])) } }; document.addEventListener('pointerdown', on, true); setTimeout(() => done(-1), 4000) }))
      const t0 = Date.now(); await two.touch.tap(...at); await q.waitForTimeout(Math.max(0, gap - (Date.now() - t0))); await two.touch.tap(...at)
      const took = await apart; await q.waitForTimeout(1300); return took
    }
    const landed = () => q.evaluate(() => { const a = document.activeElement; const place = history.state.shrug; return { app: place.app, depth: place.app ? place.stacks[place.app].length : -1, typing: !!a?.matches?.('input, textarea'), on: (a?.className ?? '').toString().slice(0, 24) } })
    for (const [name, sel, gap, depth] of [['Notes', '.sb-dock .sb-icon[aria-label^="Notes"]', 300, 1], ['Contacts', '.sb-dock .sb-icon[aria-label^="Contacts"]', 480, 0], ['VIP', '.sb-dock .sb-icon[aria-label^="VIP"]', 450, 0], ['Case Studies', '.sb-grid > .sb-icon[aria-label^="Case Studies"]', 300, 0]]) {
      await A.at(q, null, [], null, 800)
      const took = await twice(await mid(q, sel), gap)
      const got = await landed()
      if (took > 0 && took < 600) say(got.app !== null && !got.typing && got.depth === depth, `${name}: a second tap ${took}ms after the first opens the app and no more: no field takes the keyboard, nothing in it is pressed`, JSON.stringify(got))
      else console.log(`     (${name}: the two taps were made ${took}ms apart on this machine: too far apart to say anything)`)
    }
    // and the home indicator is never turned away: pressed while the app is still opening, it sends it home
    await A.at(q, null, [], null, 800)
    await two.touch.tap(...(await mid(q, '.sb-dock .sb-icon[aria-label^="Notes"]'))); await q.waitForTimeout(220)
    await two.touch.tap(196, 760 - 8); await q.waitForTimeout(1100)
    say((await st(q)).place?.app === null, 'the home indicator is taken at once all the same: tapped while an app is still opening, it sends it home', JSON.stringify((await st(q)).place))
    await two.ctx.close()

    // in its frame on a computer, a double-click with a mouse: the app opens, and the keyboard drawn under the screen stays down
    const f = await fresh({ w: 1280, h: 900, dpr: 1 }, 'still&phone')
    await f.page.addStyleTag({ content: '.sb-banner{display:none!important}' })
    await A.unlock(f.page); await f.page.waitForTimeout(700)
    const icon = await mid(f.page, '.sb-dock .sb-icon[aria-label^="Contacts"]')
    await f.page.mouse.move(...icon); await f.page.mouse.down(); await f.page.mouse.up(); await f.page.waitForTimeout(220)
    await f.page.mouse.down({ clickCount: 2 }); await f.page.mouse.up({ clickCount: 2 }); await f.page.waitForTimeout(1400)
    const framed = await f.page.evaluate(() => ({ lay: document.querySelector('.ph')?.className, app: history.state.shrug.app, keyboard: !!document.querySelector('.ph[data-softkb]'), typing: !!document.activeElement?.matches?.('input, textarea') }))
    say(/ph--framed/.test(framed.lay || '') && framed.app === 'finder' && !framed.keyboard && !framed.typing, 'in its frame on a computer, a double-click on an app opens it and does not bring the keyboard up', JSON.stringify(framed))
    await f.ctx.close()

    // with motion turned down too
    const r = await fresh('iphone', 'still', { reducedMotion: true })
    await A.unlock(r.page); await r.page.waitForTimeout(700)
    const at = await mid(r.page, '.sb-dock .sb-icon[aria-label^="Contacts"]')
    const watching = r.page.evaluate(() => new Promise((done) => { document.addEventListener('pointerdown', () => setTimeout(() => done(document.querySelector('.ph').hasAttribute('data-moving')), 70), { capture: true, once: true }) }))
    await r.touch.tap(...at)
    say(await watching, 'with motion turned down the same holds')
    await r.ctx.close()
  })

  // ---- I. Search and the App Switcher are steps in history (MK-4)
  await section('I', 'history', async () => {
    const t = await fresh('iphone')
    const p = t.page
    await A.unlock(p); await p.waitForTimeout(600)
    await t.touch.tap(...(await mid(p, '.sb-search'))); await p.waitForTimeout(900)
    let h = await p.evaluate(() => ({ over: history.state.shrug.over, n: history.state.n, spot: !!document.querySelector('.spot:not([data-leaving])') }))
    say(h.over === 'search' && h.n === 1 && h.spot, 'search is a step of its own', JSON.stringify(h))
    await p.goBack(); await p.waitForTimeout(900)
    h = await p.evaluate(() => ({ url: location.href, over: history.state?.shrug?.over ?? null, n: history.state?.n, spot: !!document.querySelector('.spot:not([data-leaving])') }))
    say(h.url.startsWith(BASE) && !h.spot && h.n === 0, "the browser's Back puts search away and stays on the site", JSON.stringify(h))
    // an app picked in search takes search's step: Back from it is the Home Screen, not search again
    await t.touch.tap(...(await mid(p, '.sb-search'))); await p.waitForTimeout(900)
    await p.locator('.ph input[aria-label*="Search" i]').last().fill('anduril'); await p.waitForTimeout(700)
    await p.locator('.ph .spot-row').first().tap(); await p.waitForTimeout(1300)
    h = await p.evaluate(() => ({ app: history.state.shrug.app, n: history.state.n }))
    await p.goBack(); await p.waitForTimeout(1000)
    const b = await p.evaluate(() => ({ app: history.state?.shrug?.app ?? null, over: history.state?.shrug?.over ?? null, n: history.state?.n, spot: !!document.querySelector('.spot:not([data-leaving])') }))
    say(h.app === 'finder' && h.n === 1 && b.app === null && !b.spot && b.n === 0, 'what is picked in search takes its step: Back from it is the Home Screen', JSON.stringify({ h, b }))
    // the switcher
    await A.at(p, 'notes', ['f:faqs'], null, 800)
    const n0 = await p.evaluate(() => history.state.n)
    await p.locator('.sb-homebar__key', { hasText: 'App Switcher' }).focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(900)
    await p.goBack(); await p.waitForTimeout(900)
    h = await p.evaluate(() => ({ on: !!document.querySelector('.sb-apps[data-switcher]'), app: history.state.shrug.app, n: history.state.n }))
    say(!h.on && h.app === 'notes' && h.n === n0, "Back puts the switcher away and stays in the app", JSON.stringify({ h, n0 }))
    await t.ctx.close()

    // an app opened at a place of its own (out of the widget, a search result, a folder) and sent home leaves no step
    // behind it: the phone is back on the Home Screen's own step, and the browser's Back there does not open the app again
    const u = await fresh('iphone')
    const q = u.page
    await q.addStyleTag({ content: '.sb-banner{display:none!important}' })
    await A.unlock(q); await q.waitForTimeout(600)
    const step = () => q.evaluate(() => ({ n: history.state.n, app: history.state.shrug.app, sheet: history.state.shrug.sheet, long: history.length, chat: history.state.shrug.stacks.messages.join(), card: history.state.shrug.stacks.finder.join() }))
    // (a flick long enough to be one however late the machine is in lifting the finger: over a fifth of the way up)
    const flickHome = async () => { const up = []; for (let i = 0; i <= 12; i++) up.push([196, 752 - i * 20]); await u.touch.path(up, 8); await q.waitForTimeout(1100) }
    const first = await step()
    await u.touch.tap(...(await mid(q, '.sb-widget--wide .sb-widget__face'))); await q.waitForTimeout(1300)
    const inChat = await step()
    await flickHome()
    let now = await step()
    say(inChat.app === 'messages' && inChat.n === first.n + 1 && now.app === null && now.n === first.n, 'the conversation opened out of the widget and sent home: the phone is back on the step it left, with no new one', JSON.stringify({ first: first.n, inChat: inChat.n, now: now.n }))
    say(now.chat === 'c:group', 'and that step is written again with the app as it was left: Messages is still on the conversation', now.chat)
    await u.touch.tap(...(await mid(q, '.sb-search'))); await q.waitForTimeout(900)
    await q.locator('.ph input[aria-label*="Search" i]').last().fill('anduril'); await q.waitForTimeout(700)
    await q.locator('.ph .spot-row').first().tap(); await q.waitForTimeout(1300)
    const inCard = await step()
    await flickHome()
    now = await step()
    say(inCard.app === 'finder' && /^co:/.test(inCard.card) && now.app === null && now.n === first.n, 'a company found in search and sent home: the same', JSON.stringify({ inCard: inCard.n, now: now.n }))
    await u.touch.tap(...(await mid(q, '.sb-folder__face[data-folder="faqs"]'))); await q.waitForTimeout(900)
    await u.touch.tap(...(await mid(q, '.sb-open__note'))); await q.waitForTimeout(1300)
    const inNote = await step()
    await flickHome()
    now = await step()
    say(inNote.app === 'notes' && now.app === null && now.sheet === null && now.n === first.n, 'a question picked in the FAQs folder and sent home: the Home Screen with the folder shut, on its own step', JSON.stringify({ inNote: inNote.n, now }))
    say(now.long <= first.long + 2, 'three visits to apps have left the browser nothing to step back through but the Home Screen itself', `history is ${now.long} long, from ${first.long}`)
    // gone into further and then sent home, the same: the nearest Home Screen behind, however many steps back
    await u.touch.tap(...(await mid(q, '.sb-dock .sb-icon[aria-label^="VIP"]'))); await q.waitForTimeout(1300)
    await u.touch.tap(...(await mid(q, '.sb-slot[data-front] .photos-tile'))); await q.waitForTimeout(1000)
    const deep = await step()
    await flickHome()
    now = await step()
    say(deep.n === first.n + 2 && now.app === null && now.n === first.n, 'an app gone further into and then sent home steps back to the Home Screen it was opened from', JSON.stringify({ deep: deep.n, now: now.n }))
    await u.ctx.close()
  })

  // ---- J. The home bar (MK-3, MK-10, PH-13)
  await section('J', 'the home bar', async () => {
    const t = await fresh('iphone')
    const p = t.page
    await A.unlock(p); await p.waitForTimeout(600)
    const bar = [196, 760 - 8]
    await A.at(p, null, [], 'folder:portfolio', 900)
    await t.touch.tap(...bar); await p.waitForTimeout(900)
    say((await st(p)).place?.sheet === null, 'a tap on the home bar closes an open folder', JSON.stringify((await st(p)).place))
    await t.touch.tap(...(await mid(p, '.sb-search'))); await p.waitForTimeout(900)
    await t.touch.tap(...bar); await p.waitForTimeout(900)
    say(!(await p.evaluate(() => !!document.querySelector('.spot:not([data-leaving])'))), 'and puts search away')
    await A.at(p, 'notes', ['f:faqs', 'n:0'], null, 900)
    const up = []; for (let i = 0; i <= 12; i++) up.push([196, 752 - i * 20])
    await t.touch.path([...up, ...up.slice().reverse()]); await p.waitForTimeout(900)
    say((await st(p)).place?.app === 'notes', 'a swipe up that is taken back down leaves the app where it was', JSON.stringify((await st(p)).place))
    const side = []; for (let i = 0; i <= 10; i++) side.push([110 + i * 18, 752])
    await t.touch.path(side); await p.waitForTimeout(900)
    say((await st(p)).place?.app === 'notes', 'a swipe along the bar, with no other app open to go to, does nothing')
    await t.touch.path(up.slice(0, 9), 8); await p.waitForTimeout(1000)
    say((await st(p)).place?.app === null, 'a flick up goes Home')
    await A.at(p, 'messages', ['c:group'], null, 900)
    const strip = await p.evaluate(() => { const b = document.querySelector('.sb-homebar').getBoundingClientRect(); const f = document.querySelector('.sb-slot[data-front] textarea, .sb-slot[data-front] input').closest('.msg-field, .ios-foot, form, div').getBoundingClientRect(); return { bar: Math.round(b.height), top: Math.round(b.top), fieldEnd: Math.round(document.querySelector('.sb-slot[data-front] textarea, .sb-slot[data-front] input').getBoundingClientRect().bottom) } })
    say(strip.bar <= 21 && strip.fieldEnd <= strip.top + 0.5, 'the strip is no taller than the gap under the message field', JSON.stringify(strip))
    await t.touch.tap(...bar); await p.waitForTimeout(900)
    say((await st(p)).place?.app === null, 'and a tap on it still goes Home')
    // with another app open, a swipe along the bar goes to the one that was in front before, as on an iPhone
    await t.touch.path(side); await p.waitForTimeout(900)
    say((await st(p)).place?.app === null, 'from the Home Screen a swipe along the bar does nothing')
    await A.at(p, 'notes', ['f:faqs'], null, 900)
    await t.touch.path(side); await p.waitForTimeout(200)
    const swept = await p.evaluate(() => ({ app: history.state.shrug.app, comes: document.querySelector('.sb-slot[data-front]')?.getAttribute('data-slide'), goes: document.querySelector('.sb-slot[data-app="notes"]')?.getAttribute('data-slide'), fromLeft: document.querySelector('.ph').hasAttribute('data-swept') }))
    say(swept.app === 'messages' && swept.comes === 'in' && swept.goes === 'under' && swept.fromLeft, 'a swipe to the right along the bar brings back the app that was in front before, in from the left over this one', JSON.stringify(swept))
    await p.waitForTimeout(900)
    await t.touch.path(side.slice().reverse()); await p.waitForTimeout(1000)
    const sweptBack = await p.evaluate(() => ({ app: history.state.shrug.app, mark: document.querySelector('.ph').hasAttribute('data-swept') }))
    say(sweptBack.app === 'notes' && !sweptBack.mark, 'and a swipe back the other way goes back to the one it was', JSON.stringify(sweptBack))
    await t.touch.path(up, 8); await p.waitForTimeout(1000)
    say((await st(p)).place?.app === null, 'a flick up the bar still goes Home after that')
    // pressed and held where it is, it brings up the App Switcher (AX-18): for a hand that cannot drag
    await A.at(p, 'notes', ['f:faqs'], null, 900)
    await t.touch.down(...bar); await p.waitForTimeout(800); await t.touch.up(); await p.waitForTimeout(700)
    const held = await p.evaluate(() => ({ on: !!document.querySelector('.sb-apps[data-switcher]'), app: history.state.shrug.app }))
    say(held.on && held.app === 'notes', 'a press held on the bar brings up the App Switcher, and letting go does not go Home', JSON.stringify(held))
    await t.ctx.close()
  })

  // ---- K. The mark of the switcher always comes off (MK-5)
  await section('K', 'lingering', async () => {
    const t = await fresh('iphone')
    const p = t.page
    await A.unlock(p)
    await A.at(p, 'finder', [], null, 800)
    await p.locator('.sb-homebar__key', { hasText: 'App Switcher' }).focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(900)
    await p.evaluate(() => document.querySelector('.sb-slot[data-app="finder"] .sb-card__hit').click())
    await p.waitForTimeout(180)
    await p.evaluate(() => document.querySelector('.sb-homebar .sr-only')?.click())
    await p.waitForTimeout(2400)
    const marks = await p.evaluate(() => document.querySelectorAll('.sb-slot[data-lingering]').length)
    say(marks === 0, 'an app left straight after being picked in the switcher keeps no mark', String(marks))
    await t.ctx.close()
  })

  // ---- L. A reload does not come back to a screen that is not there (MK-7)
  await section('L', 'reload', async () => {
    const t = await fresh('iphone')
    const p = t.page
    await A.unlock(p)
    await A.at(p, 'notes', ['f:notes', 'u:nothing-by-this-name'], null, 600)
    await p.reload(); await p.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.ph'), null, { timeout: 30000 }); await p.waitForTimeout(1200)
    let s = await st(p)
    say(s.place?.app === 'notes' && s.place.stack.join() === 'f:notes' && !s.locked, 'a note that is no longer there: the phone lands on the folder it was in', JSON.stringify(s.place))
    await A.at(p, 'notes', ['f:uNOSUCH', 'u:x'], null, 600)
    await p.reload(); await p.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.ph'), null, { timeout: 30000 }); await p.waitForTimeout(1200)
    s = await st(p)
    say(s.place?.app === 'notes' && s.place.stack.join() === '', 'a folder that is no longer there: Folders', JSON.stringify(s.place))
    await A.at(p, 'notes', ['f:faqs', 'n:3'], null, 600)
    await p.reload(); await p.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.ph'), null, { timeout: 30000 }); await p.waitForTimeout(1200)
    s = await st(p)
    say(s.place?.stack.join() === 'f:faqs,n:3', 'what is still there is come back to as before', JSON.stringify(s.place))
    await t.ctx.close()

    // a reload comes back to the phone as it was left: on its Lock Screen before it has been opened, open after
    const k = await fresh('iphone')
    const q = k.page
    const again = async () => { await q.reload(); await q.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.ph'), null, { timeout: 30000 }); await q.waitForTimeout(1200) }
    await q.waitForTimeout(1200)
    await again()
    say((await st(q)).locked, 'a reload on the Lock Screen, before the phone has been opened, comes back to the Lock Screen')
    await A.unlock(q)
    await again()
    s = await st(q)
    say(!s.locked && s.place?.app === null, 'and one after it has been opened comes back open, on the Home Screen', JSON.stringify(s.place))
    await k.ctx.close()
    // locked again by itself (Auto-Lock), over an app: a reload finds it locked still, and opens on that app
    const al = await fresh('iphone', 'still&idle=3')
    await A.unlock(al.page)
    await A.at(al.page, 'finder', [], null, 600)
    await al.page.waitForFunction(() => !!document.querySelector('.sb-lock:not([data-leaving])'), null, { timeout: 9000 }).catch(() => {})
    await al.page.waitForTimeout(500)
    await al.page.reload(); await al.page.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.ph'), null, { timeout: 30000 }); await al.page.waitForTimeout(1000)
    const relocked = await st(al.page)
    await al.page.keyboard.press('a'); await al.page.waitForTimeout(900)
    s = await st(al.page)
    say(relocked.locked && !s.locked && s.place?.app === 'finder', 'a phone that had locked itself over an app is locked still after a reload, and opens on that app', JSON.stringify({ locked: relocked.locked, then: s.place }))
    await al.ctx.close()
  })

  // ---- M. Small things (MK-17, UX-19, AX-15, AX-23)
  await section('M', 'small things', async () => {
    const t = await fresh('iphone', '')
    const p = t.page
    await A.unlock(p)
    const one = await p.evaluate(() => { const a = [...document.querySelectorAll('.sb-home a.sb-icon')][0]; return { drag: a.draggable, name: a.textContent.replace(/\s+/g, ' ').trim() } })
    say(one.drag === false && /One-pager, opens in a new tab/.test(one.name), 'the One-pager icon says where it goes and cannot be dragged off', JSON.stringify(one))
    const words = await p.evaluate(() => document.querySelector('.sb-chat__count .sr-only').textContent)
    say(/No one has replied yet|\d+ of 89 ha(s|ve) replied/.test(words) && !/^1 of 89 have/.test(words), 'the widget counts in a sentence', words)
    // the first banner of a visit is not held back
    const first = await p.waitForSelector('.sb-banner .sb-note', { timeout: 12000 }).then(() => true).catch(() => false)
    say(first, 'the first reply to land on the Home Screen drops in as a banner, early in the visit')
    if (first) {
      const time = await p.evaluate(() => getComputedStyle(document.querySelector('.sb-banner .ss-notification__time')).color)
      const alpha = +(time.match(/[\d.]+(?=\)$)/)?.[0] ?? 1)
      say(/rgba?\(0, 0, 0/.test(time) && alpha >= 0.6, 'and its time is dark enough to read', time)
      // left alone it slides away up the screen: where its top edge is, every frame from when it is told to go
      const tops = await p.evaluate(() => new Promise((done) => {
        const out = []; const t0 = performance.now()
        const tick = () => {
          const banner = document.querySelector('.sb-banner'); const note = banner?.querySelector('.ss-notification')
          if (banner?.hasAttribute('data-leaving') && note) out.push(Math.round(note.getBoundingClientRect().top))
          if (banner && performance.now() - t0 < 9000) requestAnimationFrame(tick); else done(out)
        }
        requestAnimationFrame(tick)
      }))
      say(new Set(tops).size >= 6 && tops.every((y, i) => i === 0 || y <= tops[i - 1]), 'left alone, the banner slides away up the screen: it is not there one frame and gone the next', JSON.stringify(tops.filter((_, i) => i % 3 === 0)))
    }
    await t.ctx.close()

    // a banner pressed from inside another app: the conversation comes in over that app from the side, as one app
    // does from another (grown out of the banner while the app under it slid away, it showed the wallpaper between them)
    const c = await fresh('iphone', '')
    await A.unlock(c.page)
    await A.at(c.page, 'finder', [], null, 500)
    const dropped = await c.page.waitForSelector('.sb-banner .sb-note', { timeout: 15000 }).then(() => true).catch(() => false)
    if (dropped) {
      await c.page.waitForTimeout(500)
      await c.touch.tap(...(await mid(c.page, '.sb-banner .sb-note'))); await c.page.waitForTimeout(170)
      const how = await c.page.evaluate(() => ({ app: history.state.shrug.app, comes: document.querySelector('.sb-slot[data-app="messages"]')?.getAttribute('data-slide'), goes: document.querySelector('.sb-slot[data-app="finder"]')?.getAttribute('data-slide') }))
      await c.page.waitForTimeout(900)
      const there = await st(c.page)
      say(how.app === 'messages' && how.comes === 'in' && how.goes === 'under' && there.place?.stack.join() === 'c:group', 'a banner pressed inside another app brings the conversation in over that app from the side', JSON.stringify(how))
    } else say(false, 'no banner dropped over Contacts to press')
    await c.ctx.close()

    // a banner pressed the instant it lands opens nothing; pressed a moment later, the conversation
    // (watched for from before the phone is opened: the first reply is in within a few seconds of arriving)
    const b = await fresh('iphone', '')
    await b.page.evaluate(() => { window.__early = null; new MutationObserver(() => { const n = document.querySelector('.sb-banner .sb-note'); if (n && window.__early === null) { window.__early = 'pressed'; n.click() } }).observe(document.querySelector('.ph'), { childList: true, subtree: true }) })
    await A.unlock(b.page)
    await b.page.waitForFunction(() => window.__early === 'pressed', null, { timeout: 15000 }).catch(() => {})
    await b.page.waitForTimeout(250)
    const early = await st(b.page)
    await b.page.waitForTimeout(250)
    await b.page.evaluate(() => document.querySelector('.sb-banner .sb-note')?.click()); await b.page.waitForTimeout(1200)
    const later = await st(b.page)
    say(early.place?.app === null && later.place?.app === 'messages', 'a banner takes no press in its first moment, and one after it', JSON.stringify([early.place?.app, later.place?.app]))
    await b.ctx.close()

    // the only open app flicked away: Back is not left a step that changes nothing
    const q = await fresh('iphone')
    await A.unlock(q.page); await q.page.waitForTimeout(600)
    await q.touch.tap(...(await mid(q.page, '.sb-dock .sb-icon[aria-label^="Contacts"]'))); await q.page.waitForTimeout(1200)
    await q.page.locator('.sb-homebar__key', { hasText: 'App Switcher' }).focus(); await q.page.keyboard.press('Enter'); await q.page.waitForTimeout(900)
    await q.page.evaluate(() => document.querySelector('.sb-slot__close').click()); await q.page.waitForTimeout(1300)
    const h = await q.page.evaluate(() => ({ n: history.state.n, app: history.state.shrug.app, over: history.state.shrug.over ?? null, on: !!document.querySelector('.sb-apps[data-switcher]') }))
    say(h.n === 0 && h.app === null && !h.over && !h.on, 'with the only app flicked away the phone is back on the step it opened it from', JSON.stringify(h))
    await q.ctx.close()

    const f = await fresh({ w: 600, h: 900, dpr: 1 })
    say(await f.page.evaluate(() => document.querySelector('.ss-phone__glyphs')?.getAttribute('aria-hidden') === 'true'), "the frame's signal, Wi-Fi and battery are hidden from a screen reader")
    await f.ctx.close()
  })

  // ---- N. Fit (PH-6, PH-7, PH-12, AX-5, AX-10)
  await section('N', 'fit', async () => {
    const t = await fresh('fold')
    const p = t.page
    const clock = await p.evaluate(() => { const b = document.querySelector('.sb-lock__clock svg').getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)] })
    say(clock[0] >= 0 && clock[1] <= 280, 'at 280 wide the clock fits', JSON.stringify(clock))
    await A.unlock(p)
    const names = await p.evaluate(() => { const els = [...document.querySelectorAll('.sb-grid > .sb-icon .sb-icon__name')].map((n) => n.getBoundingClientRect()).sort((a, b) => a.top - b.top || a.left - b.left); const bad = []; for (let i = 1; i < els.length; i++) if (Math.abs(els[i].top - els[i - 1].top) < 4 && els[i].left < els[i - 1].right - 0.5) bad.push(i); return { n: els.length, bad } })
    // (two names on the grid now that VIP is in the Dock: Case Studies and the one-pager)
    say(names.n >= 2 && names.bad.length === 0, 'and no icon name runs into the next', JSON.stringify(names))
    await t.ctx.close()

    const i = await fresh('iphone')
    await A.unlock(i.page); await i.page.waitForTimeout(700)
    const pill = await i.page.evaluate(() => { const s = document.querySelector('.sb-search'); const r = s.getBoundingClientRect(); const x = r.left + r.width / 2; const hit = (y) => document.elementFromPoint(x, y)?.closest('.sb-search') === s; return { top: hit(r.top + r.height / 2 - 21), bottom: hit(r.top + r.height / 2 + 21) } })
    say(pill.top && pill.bottom, 'the Search pill takes a press 44 points tall', JSON.stringify(pill))
    await i.ctx.close()

    // the ring over the wallpaper, and the home bar's buttons, with the keyboard
    const k = await fresh({ w: 600, h: 900, dpr: 1 })
    await A.unlock(k.page); await k.page.waitForTimeout(500)
    const ring = await k.page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { on: a.className.toString().slice(0, 12), visible: a.matches(':focus-visible'), color: cs.outlineColor, width: cs.outlineWidth, shade: cs.boxShadow !== 'none' } })
    say(ring.visible && ring.color === 'rgb(255, 255, 255)' && ring.shade, 'over the wallpaper the focus ring is white with a dark edge', JSON.stringify(ring))
    await A.at(k.page, 'notes', [], null, 800)
    await k.page.locator('.sb-homebar .sr-only').focus(); await k.page.keyboard.press('Shift'); await k.page.waitForTimeout(200)
    const home = await k.page.locator('.sb-homebar .sr-only').evaluate((el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), text: el.textContent.trim() } })
    say(home.text === 'Home Screen' && home.w > 30 && home.h > 12, 'the "Home Screen" button shows itself when it has the keyboard', JSON.stringify(home))
    await k.page.keyboard.press('Enter'); await k.page.waitForTimeout(1000)
    say((await st(k.page)).place?.app === null, 'and Enter on it goes Home')
    await k.ctx.close()

    // the ring is for a keyboard: what the site gives the keyboard to after a mouse, or before anything has been
    // pressed at all, wears none
    const mo = await fresh({ w: 600, h: 900, dpr: 1 })
    const worn = () => mo.page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { on: (a.className || a.tagName).toString().slice(0, 24), locked: !!document.querySelector('.sb-lock:not([data-leaving])'), ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0, halo: /rgba\(4, 6, 24/.test(cs.boxShadow) } })
    const wall = await mo.page.evaluate(() => { const r = document.querySelector('.sb-lock').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * 0.42] })
    await mo.page.mouse.click(...wall); await mo.page.waitForTimeout(260); await mo.page.mouse.click(...wall); await mo.page.waitForTimeout(1300)
    let w = await worn()
    say(!w.locked && /sb-widget/.test(w.on) && !w.ring && !w.halo, 'opened with two clicks of a mouse, the Home Screen has no ring round the widget', JSON.stringify(w))
    await mo.page.keyboard.press('Tab'); await mo.page.waitForTimeout(200)
    w = await worn()
    say(w.ring && w.halo, 'the first key pressed brings the ring back', JSON.stringify(w))
    await mo.page.reload(); await mo.page.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.ph'), null, { timeout: 30000 }); await mo.page.waitForTimeout(1500)
    w = await worn()
    say(!w.locked && w.on !== 'BODY' && !w.ring && !w.halo, 'and after a reload, before anything has been pressed, there is none', JSON.stringify(w))
    await mo.ctx.close()

    // a phone on its side with the island and corners taking a band at each end
    const s = await fresh({ w: 852, h: 393, touch: true, dpr: 3 })
    let inset = true
    try { await s.cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, bottom: 21, left: 59, right: 59 } }) } catch { inset = false }
    await s.page.waitForTimeout(500)
    await A.unlock(s.page); await s.page.waitForTimeout(700)
    const edge = await s.page.evaluate(() => { const out = []; for (const el of document.querySelectorAll('.sb-home .sb-icon, .sb-home .sb-widget, .sb-home .sb-search, .sb-homebar')) { if (el.closest('[inert]') || getComputedStyle(el).display === 'none') continue; const r = el.getBoundingClientRect(); if (r.width && (r.left < 58.5 || r.right > innerWidth - 58.5)) out.push((el.getAttribute('aria-label') || el.className).toString().slice(0, 16)) } const dock = document.querySelector('.sb-dock').getBoundingClientRect(); const over = [...document.querySelectorAll('.sb-grid > *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width && r.right > dock.left + 0.5 }).length; return { out, over } })
    say(!inset || (edge.out.length === 0 && edge.over === 0), 'on its side, the Home Screen keeps inside the bands at the ends and the Dock covers nothing', inset ? JSON.stringify(edge) : 'insets cannot be emulated here')
    await s.page.screenshot({ path: path.join(OUT, 'fix-safe-side.png') })
    await s.ctx.close()
  })

  // ---- O. Full bleed: the strips Safari paints its bars from, made to WebKit's measure
  // (LocalFrameView::fixedContainerEdges: it looks 4px in from the middle of each edge for something fixed, and takes
  // its background colour if it is nine tenths of the screen across, more than 10px both ways, and not see-through)
  await section('O', 'the edges', async () => {
    const t = await fresh('iphone')
    const p = t.page
    const read = () => p.evaluate(() => {
      const strips = [...document.querySelectorAll('.ph-edge')].map((e) => {
        const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); const top = e.classList.contains('ph-edge--top')
        return { side: top ? 'top' : 'foot', ofBody: e.parentElement === document.body, position: cs.position, across: r.width / innerWidth, deep: r.height, shows: top ? r.bottom : innerHeight - r.top, starts: top ? r.top : innerHeight - r.bottom, colour: cs.backgroundColor, opacity: cs.opacity, eases: cs.transitionDuration, touches: cs.pointerEvents }
      })
      const pill = document.querySelector('.sb-homebar__pill')?.getBoundingClientRect()
      return { strips, html: getComputedStyle(document.documentElement).backgroundColor, body: getComputedStyle(document.body).backgroundColor, meta: document.querySelector('meta[name="theme-color"]')?.content, pillFromFoot: pill ? innerHeight - pill.bottom : null }
    })
    const side = (e, which) => e.strips.find((x) => x.side === which)
    let e = await read()
    const made = e.strips.length === 2 && e.strips.every((x) => x.ofBody && x.position === 'fixed' && x.across >= 0.9 && x.deep > 10 && x.shows > 4.5 && x.starts <= 0 && x.opacity === '1' && /^rgb\(/.test(x.colour) && x.eases === '0s' && x.touches === 'none')
    say(made, 'a strip along the top and one along the foot: fixed, the screen across, more than 10px deep, over the point 4px in, solid, taking no touches', JSON.stringify(e.strips))
    say(e.pillFromFoot === null || e.strips.every((x) => x.shows < e.pillFromFoot), 'what shows of them stops short of the home indicator', JSON.stringify({ shows: e.strips.map((x) => x.shows), pill: e.pillFromFoot }))
    say(side(e, 'top').colour === 'rgb(15, 17, 48)' && side(e, 'foot').colour === 'rgb(130, 151, 222)' && e.html === 'rgb(15, 17, 48)' && e.body === 'rgb(130, 151, 222)' && e.meta === '#0f1130', 'over the Lock Screen they are the wallpaper\'s own top and foot, and the page and theme-color say the same', JSON.stringify([side(e, 'top').colour, side(e, 'foot').colour, e.html, e.body, e.meta]))
    // the wallpaper is that colour where the strips lie over it: nothing of them can be seen
    const wall = await p.evaluate(() => { const w = document.querySelector('.sb-wall'); const b = getComputedStyle(w, '::before'); const a = getComputedStyle(w, '::after'); return { before: b.backgroundImage, after: a.backgroundImage } })
    say(/rgb\(15, 17, 48\) 0(px)?, rgb\(15, 17, 48\) 8px/.test(wall.before) && /rgb\(130, 151, 222\) 0(px)?, rgb\(130, 151, 222\) 8px/.test(wall.after), 'the wallpaper is brought to those colours for its first and last 8px, under the strips', JSON.stringify(wall).slice(0, 220))
    await A.unlock(p)
    e = await read()
    say(side(e, 'top').colour === 'rgb(15, 17, 48)' && side(e, 'foot').colour === 'rgb(130, 151, 222)', 'the same over the Home Screen')
    await A.at(p, 'messages', ['c:group'], null, 900)
    e = await read()
    say(side(e, 'top').colour === 'rgb(255, 255, 255)' && side(e, 'foot').colour === 'rgb(255, 255, 255)' && e.html === 'rgb(255, 255, 255)' && e.meta === '#ffffff', 'in a white app both are white, at once', JSON.stringify([side(e, 'top').colour, side(e, 'foot').colour, e.html, e.meta]))
    await A.at(p, 'terminal', [], null, 900)
    e = await read()
    const dark = side(e, 'top').colour
    say(dark === side(e, 'foot').colour && !['rgb(255, 255, 255)', 'rgb(15, 17, 48)'].includes(dark) && dark.match(/\d+/g).every((c) => +c < 40), 'in the terminal both are its dark ground', dark)
    await A.at(p, 'messages', ['c:group'], 'details', 1000)
    e = await read()
    say(side(e, 'top').colour !== 'rgb(255, 255, 255)' && side(e, 'top').colour.match(/\d+/g).every((c) => +c < 255 && +c > 150), 'under a sheet the top is the app\'s ground with the sheet\'s shade over it', `${side(e, 'top').colour} / ${side(e, 'foot').colour}`)
    await t.ctx.close()

    // In its frame on a larger screen there is no browser bar to paint: no strips, and the page keeps its own colour
    const f = await fresh({ w: 600, h: 900, dpr: 1 })
    const framed = await f.page.evaluate(() => ({ strips: document.querySelectorAll('.ph-edge').length, lay: document.querySelector('.ph')?.className }))
    say(framed.strips === 0 && /ph--framed/.test(framed.lay || ''), 'drawn in its frame, the page has no strips', JSON.stringify(framed))
    await f.ctx.close()
  })

  // ---- P. The glass keeps its frost through every fade. A pane frosts what is behind it only while nothing it is
  // inside is itself see-through or out of focus (an ancestor with opacity under 1, or a filter, leaves it nothing
  // behind it to work on): so nothing over a pane is ever faded or blurred, only the panes themselves
  await section('P', 'the glass', async () => {
    const t = await fresh('iphone')
    const p = t.page
    await p.addStyleTag({ content: '.sb-banner{display:none!important}' })
    // every frame for `ms` from now: each pane of glass that has something see-through or blurred over it in the page
    const cut = (ms) => p.evaluate((ms) => new Promise((done) => {
      const bad = new Set(); const seen = new Set(); let frames = 0; const t0 = performance.now()
      const tick = () => {
        frames++
        for (const el of document.querySelectorAll('.sb-dock, .sb-search, .sb-folder__face, .sb-open__panel, .sb-lock .sb-note, .sb-lock .sb-activity')) {
          if (getComputedStyle(el).backdropFilter === 'none') continue
          const pane = el.className.toString().split(' ')[0]
          seen.add(pane)
          for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (+cs.opacity < 1 || cs.filter !== 'none') { bad.add(`${pane} inside ${n.className.toString().split(' ')[0]}`); break } }
        }
        if (performance.now() - t0 < ms) requestAnimationFrame(tick); else done({ bad: [...bad], panes: seen.size, frames })
      }
      requestAnimationFrame(tick)
    }), ms)
    await p.waitForSelector('.sb-lock .sb-note', { timeout: 20000 }); await p.waitForTimeout(600)
    let watching = cut(1700)
    await t.touch.path([[196, 600], [196, 570], [196, 530], [196, 480], [196, 420], [196, 350], [196, 270], [196, 200]], 40)
    let got = await watching
    say(!(await st(p)).locked && got.frames > 20 && got.panes >= 4 && got.bad.length === 0, 'the Lock Screen lifted under a finger and the phone opened: no pane of glass has anything see-through over it at any frame', JSON.stringify(got))
    await p.waitForTimeout(500)
    watching = cut(2400)
    await t.touch.tap(...(await mid(p, '.sb-dock .sb-icon[aria-label^="Notes"]'))); await p.waitForTimeout(1200)
    await t.touch.tap(196, 760 - 8)
    got = await watching
    say((await st(p)).place?.app === null && got.bad.length === 0, 'an app opened and put away: the same', JSON.stringify(got))
    watching = cut(2200)
    await t.touch.tap(...(await mid(p, '.sb-folder__face[data-folder="portfolio"]'))); await p.waitForTimeout(1000)
    await t.touch.tap(196, 30)
    got = await watching
    say((await st(p)).place?.sheet === null && got.panes >= 4 && got.bad.length === 0, 'a folder opened and shut: the same, for its own pane and for the Home Screen behind it', JSON.stringify(got))
    watching = cut(2000)
    await t.touch.tap(...(await mid(p, '.sb-search'))); await p.waitForTimeout(900)
    await t.touch.tap(196, 760 - 8)
    got = await watching
    say(got.bad.length === 0, 'search brought up and put away: the same', JSON.stringify(got))
    // behind an open folder the Home Screen is out of focus, each thing on it for itself
    await t.touch.tap(...(await mid(p, '.sb-folder__face[data-folder="portfolio"]'))); await p.waitForTimeout(900)
    const behind = await p.evaluate(() => Object.fromEntries(['.sb-dock', '.sb-widget__face', '.sb-grid .sb-icon__tile', '.sb-grid .sb-icon__name'].map((sel) => { const cs = getComputedStyle(document.querySelector(`.sb-home ${sel}`)); return [sel, `${(+cs.opacity).toFixed(2)} ${cs.filter.match(/blur\([^)]+\)/)?.[0] ?? 'sharp'}`] })))
    say(Object.values(behind).every((v) => v === '0.82 blur(12px)'), 'behind an open folder each thing on the Home Screen is faded and out of focus for itself', JSON.stringify(behind))
    // Back from a company to its folder: the Home Screen behind the folder is out of focus from the first frame it shows
    await t.touch.tap(...(await mid(p, '.sb-open__app'))); await p.waitForTimeout(1400)
    const coming = p.evaluate(() => new Promise((done) => {
      const out = []; let n = 0
      const on = () => { document.removeEventListener('pointerdown', on, true); const tick = () => { if (document.querySelector('.sb-home[data-folder]')) { const cs = getComputedStyle(document.querySelector('.sb-dock')); out.push([+(+cs.opacity).toFixed(2), +(cs.filter.match(/blur\(([\d.]+)px\)/)?.[1] ?? 0)]) } if (n++ < 70) requestAnimationFrame(tick); else done(out) }; requestAnimationFrame(tick) }
      document.addEventListener('pointerdown', on, true)
    }))
    await t.touch.tap(...(await mid(p, '.sb-slot[data-front] .ios-page[data-pos="top"] .ios-bar button[aria-label="Back"]')))
    const showing = (await coming).filter(([opacity]) => opacity > 0.02)
    say((await st(p)).place?.sheet === 'folder:portfolio' && showing.length > 3 && showing.every(([, blur]) => blur >= 11.9), 'Back from a company to its folder: the Home Screen behind is out of focus from the first frame it is seen', JSON.stringify(showing.slice(0, 5)))
    say(A.realErrors(t.errors).length === 0, 'no errors', A.realErrors(t.errors).slice(0, 2).join(' | '))
    await t.ctx.close()
  })

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})()
