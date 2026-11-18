// Fixer S1's checks: the iPhone itself (its frame, the Lock Screen, the Home Screen, the Dock, banners, the App
// Switcher, Auto-Lock, the home bar, and the phone's place in the browser's history).
//   node phone-shell.cjs [base] [sections]     base: http://127.0.0.1:5173/ by default (or BASE in the environment)
//   sections: letters to run, e.g. "ABD"; all of them by default. Exits non-zero if anything fails.
// A frame  B lock over an app, reading  C back to the tab  D Lock Screen  E keyboard focus  F title
// G App Switcher  H one press, one move  I history  J home bar  K lingering  L reload  M small things  N fit
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
    const box = await p.locator('.sb-lock').boundingBox()
    const at = [box.x + box.width / 2, box.y + box.height * 0.45]
    await p.waitForTimeout(600)
    await press(t, ...at); await p.waitForTimeout(110)
    const lifted = await p.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.sb-lock')).transform).m42)
    say(lifted < -2 && (await st(p)).locked, 'one tap lifts the screen and leaves it locked', lifted)
    const torch = await mid(p, '.sb-lock__control[aria-label="Flashlight"]')
    await p.waitForTimeout(600)
    await press(t, ...torch); await p.waitForTimeout(450)
    const lit = await p.evaluate(() => ({ pressed: document.querySelector('.sb-lock__control[aria-label="Flashlight"]').getAttribute('aria-pressed'), beam: +getComputedStyle(document.querySelector('.sb-lock__beam')).opacity }))
    say(lit.pressed === 'true' && lit.beam > 0.9 && (await st(p)).locked, 'the torch is a button, and lights', JSON.stringify(lit))
    await p.waitForTimeout(2100)
    await press(t, ...at); await p.waitForTimeout(500)
    say((await st(p)).locked, 'a tap long after the first only lifts it again')
    await press(t, ...at); await p.waitForTimeout(900)
    say(!(await st(p)).locked, 'a second tap soon after opens it')
    await t.ctx.close()

    const c = await fresh('iphone')
    await c.page.waitForTimeout(500)
    await press(c, ...(await mid(c.page, '.sb-lock__control[aria-label^="Camera"]'))); await c.page.waitForTimeout(1300)
    const s = await st(c.page)
    say(!s.locked && s.place?.app === 'photos', 'the camera opens VIP, unlocked', JSON.stringify(s.place))
    await c.ctx.close()

    // on its side the notification lies between the two buttons: it takes a press all over (PH-3)
    const l = await fresh('iphone-land', '')
    await l.page.waitForSelector('.sb-lock .sb-note', { timeout: 20000 })
    await l.page.waitForTimeout(900)
    const note = await l.page.locator('.sb-lock .sb-note').boundingBox()
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
    await A.at(p, 'finder', ['f:all'], 'company:Varda'); titles.company = await p.title()
    await A.at(p, 'notes', ['f:faqs', 'n:4']); titles.note = await p.title()
    await A.at(p, 'about', []); titles.settings = await p.title()
    const want = { lock: 'Shrug ¯\\_(ツ)_/¯', home: 'Shrug ¯\\_(ツ)_/¯', chat: 'Shrug Family · Messages · Shrug', company: 'Varda · Files · Shrug', note: 'What are drops? · Notes · Shrug', settings: 'Settings · Shrug' }
    say(Object.keys(want).every((k) => titles[k] === want[k]), 'the page is titled by where the phone is', JSON.stringify(titles))
    await t.ctx.close()
  })

  // ---- G. The App Switcher (AX-18, AX-23, MK-1, MK-16)
  await section('G', 'the App Switcher', async () => {
    const t = await fresh('iphone')
    const p = t.page
    await A.unlock(p)
    for (const [app, stack] of [['notes', ['f:faqs']], ['about', []], ['finder', ['f:all']]]) await A.at(p, app, stack, null, 700)
    const key = p.locator('.sb-homebar__key', { hasText: 'App Switcher' })
    await key.focus()
    await p.keyboard.press('Shift'); await p.waitForTimeout(150)
    const shown = await key.evaluate((el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vis: el.matches(':focus-visible') } })
    say(shown.w > 60 && shown.h > 20, 'its button shows itself when it has the keyboard', JSON.stringify(shown))
    await p.keyboard.press('Enter'); await p.waitForTimeout(900)
    let g = await p.evaluate(() => ({ on: !!document.querySelector('.sb-apps[data-switcher]'), focus: document.activeElement?.className?.toString().slice(0, 20), first: document.activeElement?.closest('.sb-slot')?.dataset.app, homes: [...document.querySelectorAll('.ph button, .ph [role="button"]')].filter((b) => !b.closest('[inert]') && ((b.getAttribute('aria-label') || b.textContent).trim() === 'Home Screen')).length, over: history.state.shrug.over, closers: document.querySelectorAll('.sb-slot__close').length }))
    say(g.on && g.focus === 'sb-card__hit' && g.first === 'finder' && g.homes === 1 && g.over === 'switcher' && g.closers === 3, 'Enter opens it: on the card of the app last used, one "Home Screen" button, a close button on each card', JSON.stringify(g))
    // a tap on a card picks the app and presses nothing in it (MK-1)
    const card = await mid(p, '.sb-slot[data-app="finder"] .sb-card__hit')
    await t.touch.tap(...card); await p.waitForTimeout(1100)
    let s = await st(p)
    say(s.place?.app === 'finder' && s.place.stack.join() === 'f:all' && s.place.sheet === null && !(await p.evaluate(() => !!document.querySelector('.sb-apps[data-switcher]'))), 'a tap on a card brings the app forward and presses nothing in it', JSON.stringify(s.place))
    // the second card, then the screen turns: still on a card (MK-16)
    await key.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(900)
    await p.evaluate(() => { const hits = [...document.querySelectorAll('.sb-card__hit')]; const order = (h) => +getComputedStyle(h.closest('.sb-slot')).getPropertyValue('--i'); hits.sort((a, b) => order(a) - order(b))[1].focus({ focusVisible: true }) })
    await p.waitForTimeout(500)
    await p.setViewportSize({ width: 760, height: 393 }); await p.waitForTimeout(700)
    const pan = await p.evaluate(() => { const a = document.querySelector('.sb-apps'); return { at: a.dataset.at, pan: parseFloat(a.style.getPropertyValue('--pan')), stride: a.offsetWidth * 0.76 } })
    say(pan.at === '1' && Math.abs(pan.pan - pan.stride) < 1, 'panned to the second card and turned, it still rests on that card', JSON.stringify(pan))
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
      ['Files in the Dock', '.sb-dock .sb-icon[aria-label^="Files"]', async () => {}],
      ['the Portfolio folder', '.sb-folder', async () => {}],
      ['Back in a note', '.sb-slot[data-front] .ios-page[data-pos="top"] button[aria-label="Back"]', async () => { await A.at(p, 'notes', ['f:faqs', 'n:1']) }],
    ]
    for (const [name, sel, setup] of cases) {
      await A.at(p, null, [], null, 700)
      await setup()
      const at = await mid(p, sel)
      if (!at) { say(false, `${name}: not found`); continue }
      const points = [at, [196, 380], [196, 700], [60, 120]]
      const sampling = probe(points, [90, 180, 280, 380])
      await t.touch.tap(...at)
      const got = await sampling
      const live = got.filter(([, inside]) => inside)
      say(live.length === 0, `${name}: for 380ms after the tap, a second tap would land on nothing`, JSON.stringify(live.slice(0, 4)))
      await p.waitForTimeout(700)
      const after = await p.evaluate(() => document.querySelector('.ph').hasAttribute('data-moving'))
      say(!after, `${name}: and then the screen takes presses again`)
    }
    // and for real: two taps on the Portfolio folder open the folder, not a company in Files
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

    // with motion turned down too
    const r = await fresh('iphone', 'still', { reducedMotion: true })
    await A.unlock(r.page); await r.page.waitForTimeout(700)
    const at = await mid(r.page, '.sb-dock .sb-icon[aria-label^="Files"]')
    const watching = r.page.evaluate(() => new Promise((done) => { document.addEventListener('pointerdown', () => setTimeout(() => done(document.querySelector('.ph').hasAttribute('data-moving')), 200), { capture: true, once: true }) }))
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
    say((await st(p)).place?.app === 'notes', 'a swipe along the bar does nothing')
    await t.touch.path(up.slice(0, 9), 8); await p.waitForTimeout(1000)
    say((await st(p)).place?.app === null, 'a flick up goes Home')
    await A.at(p, 'messages', ['c:group'], null, 900)
    const strip = await p.evaluate(() => { const b = document.querySelector('.sb-homebar').getBoundingClientRect(); const f = document.querySelector('.sb-slot[data-front] textarea, .sb-slot[data-front] input').closest('.msg-field, .ios-foot, form, div').getBoundingClientRect(); return { bar: Math.round(b.height), top: Math.round(b.top), fieldEnd: Math.round(document.querySelector('.sb-slot[data-front] textarea, .sb-slot[data-front] input').getBoundingClientRect().bottom) } })
    say(strip.bar <= 21 && strip.fieldEnd <= strip.top + 0.5, 'the strip is no taller than the gap under the message field', JSON.stringify(strip))
    await t.touch.tap(...bar); await p.waitForTimeout(900)
    say((await st(p)).place?.app === null, 'and a tap on it still goes Home')
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
    await A.at(p, 'finder', ['f:all'], null, 800)
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
  })

  // ---- M. Small things (MK-17, UX-19, AX-15, AX-23)
  await section('M', 'small things', async () => {
    const t = await fresh('iphone', '')
    const p = t.page
    await A.unlock(p)
    const one = await p.evaluate(() => { const a = [...document.querySelectorAll('.sb-home a.sb-icon')][0]; return { drag: a.draggable, name: a.textContent.replace(/\s+/g, ' ').trim() } })
    say(one.drag === false && /One-pager, opens in a new tab/.test(one.name), 'the One-pager icon says where it goes and cannot be dragged off', JSON.stringify(one))
    const words = await p.evaluate(() => document.querySelector('.sb-chat__count .sr-only').textContent)
    say(/No one has replied yet|\d+ of 90 ha(s|ve) replied/.test(words) && !/^1 of 90 have/.test(words), 'the widget counts in a sentence', words)
    // the first banner of a visit is not held back
    const first = await p.waitForSelector('.sb-banner .sb-note', { timeout: 12000 }).then(() => true).catch(() => false)
    say(first, 'the first reply to land on the Home Screen drops in as a banner, early in the visit')
    if (first) {
      const time = await p.evaluate(() => getComputedStyle(document.querySelector('.sb-banner .ss-notification__time')).color)
      const alpha = +(time.match(/[\d.]+(?=\)$)/)?.[0] ?? 1)
      say(/rgba?\(0, 0, 0/.test(time) && alpha >= 0.6, 'and its time is dark enough to read', time)
    }
    await t.ctx.close()

    // a banner pressed the instant it lands opens nothing; pressed a moment later, the conversation
    const b = await fresh('iphone', '')
    await A.unlock(b.page)
    await b.page.evaluate(() => { window.__early = null; new MutationObserver(() => { const n = document.querySelector('.sb-banner .sb-note'); if (n && window.__early === null) { window.__early = 'pressed'; n.click() } }).observe(document.querySelector('.ph'), { childList: true, subtree: true }) })
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
    await q.touch.tap(...(await mid(q.page, '.sb-dock .sb-icon[aria-label^="Files"]'))); await q.page.waitForTimeout(1200)
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
    const clock = await p.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('.ss-lock__clock')); const b = r.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)] })
    say(clock[0] >= 0 && clock[1] <= 280, 'at 280 wide the clock fits', JSON.stringify(clock))
    await A.unlock(p)
    const names = await p.evaluate(() => { const els = [...document.querySelectorAll('.sb-grid > .sb-icon .sb-icon__name')].map((n) => n.getBoundingClientRect()).sort((a, b) => a.top - b.top || a.left - b.left); const bad = []; for (let i = 1; i < els.length; i++) if (Math.abs(els[i].top - els[i - 1].top) < 4 && els[i].left < els[i - 1].right - 0.5) bad.push(i); return { n: els.length, bad } })
    say(names.n >= 4 && names.bad.length === 0, 'and no icon name runs into the next', JSON.stringify(names))
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
    await A.at(k.page, 'about', [], null, 800)
    await k.page.locator('.sb-homebar .sr-only').focus(); await k.page.keyboard.press('Shift'); await k.page.waitForTimeout(200)
    const home = await k.page.locator('.sb-homebar .sr-only').evaluate((el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), text: el.textContent.trim() } })
    say(home.text === 'Home Screen' && home.w > 30 && home.h > 12, 'the "Home Screen" button shows itself when it has the keyboard', JSON.stringify(home))
    await k.page.keyboard.press('Enter'); await k.page.waitForTimeout(1000)
    say((await st(k.page)).place?.app === null, 'and Enter on it goes Home')
    await k.ctx.close()

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

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})()
