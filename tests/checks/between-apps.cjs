// What happens between apps on the iPhone, and what came with it: how an app opens and is put away, what is seen
// while it loads, the ways out of Messages, Notes and Contacts, a message to Shrug with files (and what a
// reload keeps of it), and the widget on the desk.
//   node between-apps.cjs [base] [sections]     sections: letters to run (all by default). Exits non-zero if anything fails.
// A opening  B put away by hand  C the ways out  D a message to Shrug  E the desk's widget  F the desktop's icons
// G back out to the folder
const A = require('./lib.cjs')
const BASE = process.argv[2] && /^https?:/.test(process.argv[2]) ? process.argv[2] : process.env.BASE || 'http://127.0.0.1:5173/'
const ONLY = (process.argv[3] || (process.argv[2] && !/^https?:/.test(process.argv[2]) ? process.argv[2] : '')).toUpperCase()

let failed = 0
const say = (ok, name, detail = '') => {
  if (!ok) failed++
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + String(detail).slice(0, 320) : ''))
}

const touchOf = (t) => ({
  down: (x, y) => t.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }),
  move: (x, y) => t.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }),
  up: () => t.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
  async tap(x, y) { await this.down(x, y); await this.up() },
})

;(async () => {
  const browser = await A.launch()
  const fresh = async (device, query = 'still', opts = {}) => {
    const t = await A.open(browser, { device, base: BASE, query, ...opts })
    await t.page.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.ph, .dock'), null, { timeout: 30000 })
    await t.page.waitForTimeout(500)
    // (A reply landing drops a banner over the top of the screen, where Back is: these checks are not about banners)
    await t.page.addStyleTag({ content: '.sb-banner{display:none!important}' })
    t.touch = touchOf(t)
    return t
  }
  const mid = (page, sel) => page.evaluate((sel) => { const el = [...document.querySelectorAll(sel)].find((e) => !e.closest('[inert]') && e.getBoundingClientRect().width > 0); if (!el) return null; const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] }, sel)
  const section = async (letter, name, run) => {
    if (ONLY && !ONLY.includes(letter)) return
    console.log(`--- ${letter}. ${name}`)
    try { await run() } catch (e) { say(false, `${name}: the check itself fell over`, String(e).slice(0, 240)) }
  }
  // The app in front and its icon's picture over it, frame by frame from the next press, for as long as the picture shows:
  // [the picture's width, its height, the window's width, how far the picture's middle is under the window's, the finger is up]
  const picture = (page, frames = 60) => page.evaluate((frames) => new Promise((done) => {
    const out = []
    let up = false
    const lifted = () => (up = true)
    const on = () => {
      document.removeEventListener('pointerdown', on, true)
      document.addEventListener('pointerup', lifted, true)
      let n = 0
      const tick = () => {
        const slot = document.querySelector('.sb-slot[data-front]') ?? document.querySelector('.sb-slot[data-pictured]')
        const app = slot?.querySelector('.sb-zoom__app'); const face = slot?.querySelector('.sb-zoom__face')
        if (app && face) {
          slot.setAttribute('data-pictured', '')
          const zoom = getComputedStyle(app.closest('.sb-zoom'))
          if (+getComputedStyle(face).opacity > 0.1 && zoom.visibility !== 'hidden' && +zoom.opacity > 0.1) { const w = app.getBoundingClientRect(), f = face.getBoundingClientRect(); out.push([Math.round(f.width), Math.round(f.height), Math.round(w.width), Math.round(f.top + f.height / 2 - (w.top + w.height / 2)), up]) }
        }
        if (n++ < frames) requestAnimationFrame(tick)
        else { document.removeEventListener('pointerup', lifted, true); document.querySelectorAll('[data-pictured]').forEach((el) => el.removeAttribute('data-pictured')); done(out) }
      }
      requestAnimationFrame(tick)
    }
    document.addEventListener('pointerdown', on, true)
  }), frames)
  // The app in front, frame by frame from the next press: [ms, width, height, drawn, its own screens are in it, the finger is up]
  const watch = (page, ms) => page.evaluate((ms) => new Promise((done) => {
    const out = []
    let up = false
    const lifted = () => (up = true)
    const on = () => {
      document.removeEventListener('pointerdown', on, true)
      document.addEventListener('pointerup', lifted, true)
      const t0 = performance.now()
      const tick = () => {
        const now = performance.now() - t0
        const app = document.querySelector('.sb-slot[data-front] .sb-zoom__app') ?? document.querySelector('.sb-slot[data-watched] .sb-zoom__app')
        if (app) {
          app.closest('.sb-slot').setAttribute('data-watched', '')
          const r = app.getBoundingClientRect()
          out.push([Math.round(now), Math.round(r.width), Math.round(r.height), getComputedStyle(app.closest('.sb-zoom')).visibility !== 'hidden', !!app.querySelector('.ios-screen'), up])
        }
        if (now < ms) requestAnimationFrame(tick)
        else { document.removeEventListener('pointerup', lifted, true); document.querySelectorAll('[data-watched]').forEach((el) => el.removeAttribute('data-watched')); done(out) }
      }
      requestAnimationFrame(tick)
    }
    document.addEventListener('pointerdown', on, true)
  }), ms)

  // ---- A. An app opens out of its icon, at once, on a launch screen the first time
  await section('A', 'opening', async () => {
    const t = await fresh('iphone')
    const p = t.page
    await A.unlock(p); await p.waitForTimeout(800)
    const W = 393
    const icon = await mid(p, '.sb-dock .sb-icon[aria-label^="Contacts"]')
    const tile = await p.evaluate(() => document.querySelector('.sb-dock .sb-icon[aria-label^="Contacts"] .sb-icon__tile').getBoundingClientRect().width)
    let watching = watch(p, 900)
    // Whether its own screens were in it at the moment it was let go from its icon. Read as the page changes, not
    // frame by frame: its screens are put together within a frame or two of that, and on a machine that is late
    // with a frame the first one seen can already have them (it did one time in twelve, before any of this was changed)
    const launching = p.evaluate(() => new Promise((done) => {
      const seen = new MutationObserver(() => { const zoom = document.querySelector('.sb-slot[data-app="finder"] .sb-zoom'); if (zoom && !zoom.hasAttribute('data-shut')) { seen.disconnect(); done(!zoom.querySelector('.ios-screen')) } })
      seen.observe(document.querySelector('.ph'), { subtree: true, childList: true, attributes: true, attributeFilter: ['data-shut'] })
      setTimeout(() => done(null), 5000)
    }))
    await t.touch.tap(...icon)
    let frames = await watching
    const onLaunchScreen = await launching
    let seen = frames.filter((f) => f[3])
    say(seen.length > 6 && seen[0][0] < 150 && seen[0][1] < tile * 1.8, 'the first frames after the tap show the app at about the size of its icon', JSON.stringify(seen.slice(0, 3)))
    const widths = seen.map((f) => f[1])
    say(widths.every((w, i) => i === 0 || w >= widths[i - 1] - 1) && widths[widths.length - 1] === W, 'and it grows from there to the whole screen, never back', JSON.stringify(widths.filter((_, i) => i % 4 === 0)))
    // half-way there in well under the first third of the time, as a spring is
    const half = seen.find((f) => f[1] >= W / 2)
    say(!!half && half[0] - seen[0][0] < 190, 'most of the way in the first part of the move', half ? `half-way ${half[0] - seen[0][0]}ms after it was first seen` : 'never half-way')
    say(onLaunchScreen === true && seen[seen.length - 1][4], 'it opens on its launch screen, and its own screens are in it by the time it has opened', `let go from its icon ${onLaunchScreen ? 'with only its launch screen' : 'with its screens already in it'}; first frame with them: ${JSON.stringify(seen.filter((f) => f[4])[0])}`)
    const style = await p.evaluate(() => { const app = document.querySelector('.sb-slot[data-front] .sb-zoom__app'); const zoom = app.closest('.sb-zoom'); return { clip: getComputedStyle(zoom).clipPath, moved: getComputedStyle(app).transitionProperty, busy: document.querySelector('.sb-slot[data-front] .sb-drag').getAttribute('aria-busy') } })
    say(style.clip === 'none' && /transform/.test(style.moved) && !/clip-path/.test(style.moved), 'it is moved by a transform, with no clip to redraw', JSON.stringify(style))
    say(style.busy === null, 'and is no longer marked as loading')
    // the second time it is as it was left, from the first frame
    await A.at(p, null, [], null, 900)
    watching = watch(p, 700)
    await t.touch.tap(...icon)
    frames = await watching
    seen = frames.filter((f) => f[3])
    say(seen.length > 4 && seen.every((f) => f[4]), 'opened again, it is drawn whole from the first frame', JSON.stringify(seen.slice(0, 2)))
    // the icon's picture keeps its own shape over the window as it grows: a terminal's prompt is not drawn tall and thin
    // (Case Studies: its icon is Shrug's own drawing, as VIP's letters are, and VIP, which this was tried on, opens no app now)
    await A.at(p, null, [], null, 900)
    let pictured = picture(p, 40)
    await t.touch.tap(...(await mid(p, '.sb-grid > .sb-icon[aria-label^="Case Studies"]')))
    let shape = await pictured
    say(shape.length > 3 && shape.every(([w, h, across, off]) => Math.abs(w - h) <= 2 && Math.abs(w - across) <= 2 && Math.abs(off) <= 2), 'the icon\'s picture keeps its shape as the app opens: square, as wide as the window, in the middle of its height', JSON.stringify(shape.filter((_, i) => i % 3 === 0).map((f) => f.slice(0, 4))))
    await p.waitForTimeout(900)
    // out of the widget and back into the widget: the conversation is put away where it was opened from (and
    // opened from its icon, into its icon)
    const landing = (page, ms = 900) => page.evaluate((ms) => new Promise((done) => {
      const out = []
      const on = () => {
        document.removeEventListener('pointerdown', on, true)
        const t0 = performance.now()
        const tick = () => {
          const app = document.querySelector('.sb-slot[data-app="messages"] .sb-zoom__app')
          if (app) { const r = app.getBoundingClientRect(); out.push([Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]) }
          if (performance.now() - t0 < ms) requestAnimationFrame(tick); else done(out)
        }
        requestAnimationFrame(tick)
      }
      document.addEventListener('pointerdown', on, true)
    }), ms)
    const boxOf = (page, sel) => page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] }, sel)
    const near = (a, b) => !!a && !!b && a.every((v, i) => Math.abs(v - b[i]) <= 3)
    await A.at(p, null, [], null, 900)
    const widgetAt = await boxOf(p, '.sb-widget--wide .sb-widget__face')
    const iconAt = await boxOf(p, '.sb-dock .sb-icon[aria-label^="Messages"] .sb-icon__tile')
    await t.touch.tap(...(await mid(p, '.sb-widget--wide .sb-widget__face'))); await p.waitForTimeout(1400)
    let landed = landing(p)
    await t.touch.tap(W / 2, 760 - 8)
    let rects = await landed
    await p.waitForTimeout(400)
    say((await A.state(p)).place?.app === null && rects.length > 5 && near(rects[rects.length - 1], widgetAt), 'opened out of the widget and sent home, the conversation goes back into the widget', JSON.stringify({ widgetAt, last: rects.slice(-2) }))
    await t.touch.tap(...(await mid(p, '.sb-dock .sb-icon[aria-label^="Messages"]'))); await p.waitForTimeout(1400)
    landed = landing(p)
    await t.touch.tap(W / 2, 760 - 8)
    rects = await landed
    await p.waitForTimeout(400)
    say((await A.state(p)).place?.app === null && rects.length > 5 && near(rects[rects.length - 1], iconAt), 'and opened from its icon the next time, it goes into its icon', JSON.stringify({ iconAt, last: rects.slice(-2) }))
    say(A.realErrors(t.errors).length === 0, 'no errors', A.realErrors(t.errors).slice(0, 2).join(' | '))
    await t.ctx.close()
    // a card's launch screen is the card's own colour, not white: Contacts opened for the first time, on a company, out of the folder
    const u = await fresh('iphone')
    const q = u.page
    await A.unlock(q); await q.waitForTimeout(700)
    await A.at(q, null, [], 'folder:portfolio', 900)
    const company = await mid(q, '.sb-open__app')
    const colours = q.evaluate(() => new Promise((done) => {
      const out = []
      const on = () => { document.removeEventListener('pointerdown', on, true); let n = 0; const tick = () => { const app = document.querySelector('.sb-slot[data-front] .sb-zoom__app'); if (app) out.push([getComputedStyle(app).backgroundColor, !!app.querySelector('.ios-screen')]); if (n++ < 40) requestAnimationFrame(tick); else done(out) }; requestAnimationFrame(tick) }
      document.addEventListener('pointerdown', on, true)
    }))
    // (and what it was let go from its icon as, read as the page changes: see above)
    const letGo = q.evaluate(() => new Promise((done) => {
      const seen = new MutationObserver(() => { const zoom = document.querySelector('.sb-slot[data-app="finder"] .sb-zoom'); if (zoom && !zoom.hasAttribute('data-shut')) { seen.disconnect(); done([getComputedStyle(zoom.querySelector('.sb-zoom__app')).backgroundColor, !!zoom.querySelector('.ios-screen')]) } })
      seen.observe(document.querySelector('.ph'), { subtree: true, childList: true, attributes: true, attributeFilter: ['data-shut'] })
      setTimeout(() => done(null), 5000)
    }))
    await u.touch.tap(...company)
    const got = await colours
    const first = await letGo
    const s = await A.state(q)
    say(s.place?.app === 'finder' && /^co:/.test(s.place.stack?.[0] ?? ''), 'a company in the Portfolio folder opens its card in Contacts', JSON.stringify(s.place))
    say(got.length > 0 && !!first && !first[1] && first[0] !== 'rgb(255, 255, 255)' && got.every(([c]) => c !== 'rgb(255, 255, 255)'), 'whose launch screen is the card\'s own colour from the first frame, not white', JSON.stringify([`${first?.[0]} ${first?.[1] ? 'drawn' : 'launch'} as it was let go`, ...new Set(got.map(([c, live]) => `${c} ${live ? 'drawn' : 'launch'}`))]))
    say(A.realErrors(u.errors).length === 0, 'no errors', A.realErrors(u.errors).slice(0, 2).join(' | '))
    await u.ctx.close()
  })

  // ---- B. Carried up by the home indicator and let go: into its icon in one move
  await section('B', 'put away by hand', async () => {
    const t = await fresh('iphone')
    const p = t.page
    await A.unlock(p); await p.waitForTimeout(700)
    await t.touch.tap(...(await mid(p, '.sb-dock .sb-icon[aria-label^="Notes"]'))); await p.waitForTimeout(1300)
    const [W, H] = [393, 760]
    const watching = watch(p, 1300)
    await t.touch.down(W / 2, H - 6)
    for (let i = 1; i <= 9; i++) { await t.touch.move(W / 2, H - 6 - i * 28); await p.waitForTimeout(16) }
    await t.touch.up()
    const frames = await watching
    const carried = frames.filter((f) => !f[5])
    const after = frames.filter((f) => f[5] && f[3])
    say(carried.length > 3 && carried[carried.length - 1][1] < W * 0.82, 'the app follows the finger up the screen, growing smaller', JSON.stringify(carried.map((f) => f[1])))
    const least = carried.length ? carried[carried.length - 1][1] : W
    const widths = after.map((f) => f[1])
    say(widths.length > 3 && widths.every((w) => w <= least + 2) && widths.every((w, i) => i === 0 || w <= widths[i - 1] + 1), 'let go, it only ever gets smaller: it does not spring back to the whole screen first', `let go at ${least}: ${JSON.stringify(widths.filter((_, i) => i % 3 === 0))}`)
    await p.waitForTimeout(300)
    const s = await A.state(p)
    const marks = await p.evaluate(() => ({ dragging: document.querySelector('.ph').hasAttribute('data-dragging'), covered: document.querySelector('.sb-home').hasAttribute('data-covered'), shown: [...document.querySelectorAll('.sb-app')].filter((el) => getComputedStyle(el).visibility !== 'hidden').length }))
    say(s.place?.app === null && !marks.dragging && !marks.covered && marks.shown === 0, 'and it is the Home Screen, with nothing left over it', JSON.stringify({ ...s.place, ...marks }))
    // taken back down, it settles back where it was
    await t.touch.tap(...(await mid(p, '.sb-dock .sb-icon[aria-label^="Notes"]'))); await p.waitForTimeout(1100)
    await t.touch.down(W / 2, H - 6)
    for (const y of [40, 90, 130, 110, 60, 20, 4]) { await t.touch.move(W / 2, H - 6 - y); await p.waitForTimeout(40) }
    await p.waitForTimeout(150)
    await t.touch.up(); await p.waitForTimeout(700)
    const back = await p.evaluate(() => { const app = document.querySelector('.sb-slot[data-front] .sb-zoom__app'); const r = app?.getBoundingClientRect(); return app ? { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), top: Math.round(r.top), dragging: document.querySelector('.ph').hasAttribute('data-dragging') } : null })
    say(!!back && back.w === W && back.h === H && back.left === 0 && back.top === 0 && !back.dragging && (await A.state(p)).place?.app === 'notes', 'taken back down and let go, it settles back to the whole screen and stays open', JSON.stringify(back))
    // carried a long way up and let go: its icon's picture comes up over the window where the window is, at the
    // window's size (it is the window alone that the finger carries)
    const pictured = picture(p, 90)
    await t.touch.down(W / 2, H - 6)
    for (let i = 1; i <= 14; i++) { await t.touch.move(W / 2, H - 6 - i * 29); await p.waitForTimeout(16) }
    await t.touch.up()
    const shape = (await pictured).filter((f) => f[4])
    await p.waitForTimeout(500)
    say((await A.state(p)).place?.app === null && shape.length > 3 && shape.every(([w, , across, off]) => Math.abs(w - across) <= 2 && Math.abs(off) <= 2), 'carried far up the screen and let go, its icon\'s picture comes up at the size of the window, not around it', JSON.stringify(shape.filter((_, i) => i % 3 === 0).map((f) => f.slice(0, 4))))
    say(A.realErrors(t.errors).length === 0, 'no errors', A.realErrors(t.errors).slice(0, 2).join(' | '))
    await t.ctx.close()
  })

  // ---- C. The ways out, and the Dock
  await section('C', 'the ways out', async () => {
    const t = await fresh('iphone')
    const p = t.page
    await A.unlock(p); await p.waitForTimeout(700)
    const dock = await p.evaluate(() => [...document.querySelectorAll('.sb-dock .sb-icon')].map((el) => `${el.tagName === 'A' ? 'link' : 'app'} ${el.getAttribute('aria-label').replace(/,.*/, '')}`))
    say(JSON.stringify(dock) === '["app Messages","app Contacts","app Notes","link VIP"]', 'the Dock holds Messages, Contacts and Notes, and VIP, which is a link and no app', JSON.stringify(dock))
    const TOP = '.sb-slot[data-front] .ios-page[data-pos="top"]'
    await A.at(p, 'messages', [], null, 900)
    let exit = p.locator(`${TOP} .ios-bar button`, { hasText: 'Exit' })
    say((await exit.count()) === 1 && (await p.locator(`${TOP} .ios-bar .ios-menu`).count()) === 0, 'Messages\' list has Exit where its filter was')
    await exit.tap(); await p.waitForTimeout(900)
    say((await A.state(p)).place?.app === null, 'which goes to the Home Screen')
    await A.at(p, 'notes', [], null, 900)
    exit = p.locator(`${TOP} .ios-bar button`, { hasText: 'Exit' })
    say((await exit.count()) === 1 && (await p.locator(`${TOP} .ios-bar button`, { hasText: 'Edit' }).count()) === 0, 'Notes\' folders have Exit where Edit was')
    await exit.tap(); await p.waitForTimeout(900)
    say((await A.state(p)).place?.app === null, 'which goes to the Home Screen too')
    // Contacts has the round Back that it has in that corner on an iPhone, named for where it leads
    await A.at(p, 'finder', [], null, 900)
    let back = p.locator(`${TOP} .ios-bar__side:not(.ios-bar__side--end) button`)
    say((await back.count()) === 1 && (await back.getAttribute('aria-label')) === 'Home Screen' && (await back.locator('svg').count()) === 1, 'Contacts\' list has Back in its corner, which says Home Screen')
    await back.tap(); await p.waitForTimeout(900)
    say((await A.state(p)).place?.app === null, 'and goes there')
    // a card's buttons are clear of the strip along the top of a real phone's page
    await A.at(p, 'finder', ['me'], null, 900)
    const card = await p.evaluate((TOP) => { const b = document.querySelector(`${TOP} .ios-bar button`).getBoundingClientRect(); const strip = document.querySelector('.ph-edge--top').getBoundingClientRect(); const screen = document.querySelector(`${TOP} .ios-screen`); return { button: Math.round(b.top), strip: Math.round(strip.bottom), page: getComputedStyle(screen).backgroundColor } }, TOP)
    say(card.button > card.strip, 'a card\'s buttons start under the strip along the top edge, not behind it', JSON.stringify(card))
    say(card.page === 'rgb(0, 0, 0)', 'and Shrug\'s own card is black', card.page)
    say(A.realErrors(t.errors).length === 0, 'no errors', A.realErrors(t.errors).slice(0, 2).join(' | '))
    await t.ctx.close()
  })

  // ---- D. A message to Shrug
  await section('D', 'a message to Shrug', async () => {
    const t = await fresh('iphone')
    const p = t.page
    await A.unlock(p); await p.waitForTimeout(700)
    await A.at(p, 'messages', [], null, 900)
    const TOP = '.sb-slot[data-front] .ios-page[data-pos="top"]'
    await p.locator(`${TOP} .ios-foot button[aria-label="New message"]`).tap(); await p.waitForTimeout(900)
    let s = await A.state(p)
    const to = await p.locator(`${TOP} .msgn-to`).innerText().catch(() => '')
    say(JSON.stringify(s.place?.stack) === '["new"]' && /To:\s*Shrug/.test(to.replace(/\n/g, ' ')), 'the compose button starts a new message, to Shrug', `${JSON.stringify(s.place?.stack)} "${to}"`)
    say((await p.locator(`${TOP} .msgn-to input, ${TOP} .msgn-to button`).count()) === 0, 'and there is nobody else to send it to')
    const picker = p.locator(`${TOP} input[type="file"]`)
    say((await picker.count()) === 1 && (await picker.getAttribute('multiple')) !== null, 'files are picked with the browser\'s own picker, more than one at a time')
    const chosen = p.waitForEvent('filechooser', { timeout: 4000 }).then(() => true, () => false)
    await p.locator(`${TOP} button[aria-label="Add files"]`).tap()
    say(await chosen, 'the plus opens it')
    await picker.setInputFiles([
      { name: 'Seed Deck.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(2_300_000) },
      { name: 'too-large.mov', mimeType: 'video/quicktime', buffer: Buffer.alloc(26 * 1024 * 1024) },
    ])
    await p.waitForTimeout(300)
    const picked = await p.evaluate((TOP) => ({ names: [...document.querySelectorAll(`${TOP} .msgn-pick b`)].map((b) => b.textContent), said: document.querySelector(`${TOP} [role="status"]`)?.textContent }), TOP)
    say(JSON.stringify(picked.names) === '["Seed Deck.pdf"]' && /25 MB/.test(picked.said || ''), 'a file is shown waiting in the field; one over 25 MB is left out, and that is said', JSON.stringify(picked))
    // What was turned away is news, not a state the message is left in: it is taken back a few seconds on
    await p.waitForTimeout(4400)
    const later = await p.evaluate((TOP) => ({ waiting: document.querySelectorAll(`${TOP} .msgn-pick`).length, said: document.querySelector(`${TOP} [role="status"]`)?.textContent, shown: !!document.querySelector(`${TOP} .msgn-refused`) }), TOP)
    say(later.waiting === 1 && later.said === '' && !later.shown, 'and is no longer said four seconds on, with the file that fitted still waiting', JSON.stringify(later))
    await p.locator(`${TOP} .msg-field__input`).fill('Our seed deck')
    await p.locator(`${TOP} .msg-field__send`).tap()
    await p.waitForTimeout(250)
    const sending = await p.evaluate((TOP) => document.querySelector(`${TOP} .msgn-receipt`)?.textContent, TOP)
    await p.waitForTimeout(1300)
    const sent = await p.evaluate((TOP) => ({ receipt: document.querySelector(`${TOP} .msgn-receipt`)?.textContent, file: document.querySelector(`${TOP} .msgn-file b`)?.textContent, words: document.querySelector(`${TOP} .msgn-bubble`)?.textContent, field: document.querySelector(`${TOP} .msg-field__input`).value, waiting: document.querySelectorAll(`${TOP} .msgn-pick`).length, head: document.querySelector(`${TOP} .msg-head__name`)?.textContent }), TOP)
    say(/^Sending/.test(sending || '') && sent.file === 'Seed Deck.pdf' && sent.words === 'Our seed deck' && sent.field === '' && sent.waiting === 0 && sent.head === 'Shrug', 'sent, it is in the conversation with its file, and the field is empty', JSON.stringify({ sending, ...sent }))
    say(sent.receipt === 'Not Delivered', 'with nowhere to send it yet it says Not Delivered: never Delivered', sent.receipt)
    const laid = await p.evaluate((TOP) => {
      const mid = (el) => { const r = el.getBoundingClientRect(); return (r.top + r.bottom) / 2 }
      const [words, file, mark] = ['.msgn-bubble', '.msgn-file', '.msgn-alert'].map((sel) => document.querySelector(`${TOP} ${sel}`))
      return { level: Math.round(mid(mark) - mid(words)), underFile: Math.round(mid(mark) - mid(file)), beside: Math.round(mark.getBoundingClientRect().left - words.getBoundingClientRect().right), stamp: document.querySelector(`${TOP} .msgn-stamp`).innerText.replace(/\s*\n\s*/g, ' / ') }
    }, TOP)
    say(laid.level === 0 && laid.beside === 6 && laid.underFile > 20, 'the mark that says so is beside the last part of the message (its words), not half-way up the file over them', JSON.stringify(laid))
    say(/^iMessage \/ Today \d{1,2}:\d\d/.test(laid.stamp), 'and the conversation is stamped with the time it began, as every conversation is', laid.stamp)
    await p.locator(`${TOP} .msgn-alert`).tap(); await p.waitForTimeout(700)
    const why = await p.locator('.msg-alert__box').innerText().catch(() => '')
    say(/Not Delivered/.test(why) && /Nothing has left your phone/.test(why), 'and its mark says why', why.replace(/\n/g, ' | '))
    const acts = await p.locator('.msg-alert__act').evaluateAll((els) => els.map((el) => ({ tag: el.tagName, says: el.textContent, href: el.getAttribute('href'), target: el.getAttribute('target') })))
    const held = await p.evaluate(() => document.activeElement?.textContent)
    say(acts.length === 2 && acts[0].tag === 'A' && acts[0].says === 'Read the One-pager, opens in a new tab' && /docsend\.com/.test(acts[0].href || '') && acts[0].target === '_blank' && acts[1].says === 'OK' && held === 'OK', 'with something to do about it: the one-pager, in a tab of its own, over the OK that has the keyboard', JSON.stringify({ acts, held }))
    await p.locator('.msg-alert__act').last().tap(); await p.waitForTimeout(600)
    // the list has it at its head now
    await p.locator(`${TOP} .ios-bar button[aria-label^="Back"]`).tap(); await p.waitForTimeout(900)
    const row = await p.evaluate((TOP) => document.querySelector(`${TOP} .msg-rows > :first-child`)?.textContent ?? '', TOP)
    say(/^Shrug/.test(row) && /Not Delivered/.test(row), 'the list of conversations has it at its head, and says it did not go', row.slice(0, 80))
    // (the list has no search of its own for now: Shrug took it off)
    say((await p.locator(`${TOP} .ios-search__input`).count()) === 0, 'the list of conversations has no search field')
    // a reload brings it back with what was being written; a file that was only picked is not kept
    await p.locator(`${TOP} .msg-row[data-row="shrug"]`).tap(); await p.waitForTimeout(900)
    await p.locator(`${TOP} .msg-field__input`).fill('And one more thing')
    await picker.setInputFiles([{ name: 'only picked.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(4000) }])
    await p.waitForTimeout(300)
    await p.reload({ waitUntil: 'load' })
    await p.waitForSelector(`${TOP} .msgn-thread`, { timeout: 20000 }); await p.waitForTimeout(900)
    const kept = await p.evaluate((TOP) => ({ draft: document.querySelector(`${TOP} .msg-field__input`).value, waiting: document.querySelectorAll(`${TOP} .msgn-pick`).length, words: document.querySelector(`${TOP} .msgn-bubble`)?.textContent, file: [...document.querySelectorAll(`${TOP} .msgn-file__words`)].map((f) => f.innerText.replace(/\s*\n\s*/g, ', ')).join(), receipt: document.querySelector(`${TOP} .msgn-receipt`)?.textContent, stamped: /Today \d/.test(document.querySelector(`${TOP} .msgn-stamp`)?.innerText ?? '') }), TOP)
    say(kept.draft === 'And one more thing' && kept.words === 'Our seed deck' && kept.file === 'Seed Deck.pdf, 2.2 MB' && kept.receipt === 'Not Delivered' && kept.stamped, 'a reload brings the conversation back: what was sent, its file by name and size, and what was being written', JSON.stringify(kept))
    say(kept.waiting === 0, 'a file that was only picked is not kept', String(kept.waiting))
    // nothing was asked of anywhere
    say(A.realErrors(t.errors).length === 0, 'no errors, and nothing was sent anywhere', A.realErrors(t.errors).slice(0, 2).join(' | '))
    await t.ctx.close()
  })

  // ---- E. The widget on the desk
  await section('E', 'the desk\'s widget', async () => {
    const read = (page) => page.evaluate(() => { const el = document.querySelector('.sf'); if (!el || !el.getClientRects().length) return null; const r = el.getBoundingClientRect(); return { box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], city: el.querySelector('.sf__city')?.textContent, apart: el.querySelector('.sf__apart')?.textContent, time: el.querySelector('time')?.textContent, weather: el.querySelector('.sf__weather')?.textContent, sky: el.dataset.sky, label: el.getAttribute('aria-label') } })
    const there = (zone, h12) => new Intl.DateTimeFormat(h12 ? 'en-US' : 'en-GB', { hour: h12 ? 'numeric' : '2-digit', minute: '2-digit', timeZone: zone, hourCycle: h12 ? 'h12' : 'h23' }).format(new Date())
    let t = await fresh('desktop', 'still&empty', { locale: 'en-US', timezoneId: 'America/New_York' })
    await t.page.waitForTimeout(1200)
    let w = await read(t.page)
    const now = [there('America/Los_Angeles', true)]
    say(!!w && w.city === 'San Francisco' && w.box[2] === 164 && w.box[0] < 40 && w.box[1] > 28, 'a widget on the desk, top left under the menu bar: San Francisco', JSON.stringify(w))
    say(!!w && (now.includes(w.time) || /^\d{1,2}:\d{2}\s?[AP]M$/.test(w.time || '')), 'with the time there, on the visitor\'s own kind of clock', `${w?.time} (there it is ${now[0]})`)
    // (Which day it is there depends on the hour: in the small hours of New York's morning it is still yesterday in San Francisco)
    const dayOf = (zone) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const dayThere = dayOf('America/Los_Angeles') < dayOf('America/New_York') ? 'Yesterday' : 'Today'
    say(!!w && (w.apart || '').startsWith(dayThere) && /3 hours behind/.test(w.apart || ''), `how far that is from the visitor's own (New York: three hours behind, and ${dayThere.toLowerCase()} there)`, w?.apart)
    say(!!w && /^58°/.test(w.weather || '') && /Mostly Cloudy/.test(w.weather || '') && w.sky === 'gray', 'and the weather it was told, in Fahrenheit for an American', `${w?.weather} (${w?.sky})`)
    say(A.realErrors(t.errors).length === 0, 'no errors', A.realErrors(t.errors).slice(0, 2).join(' | '))
    await t.ctx.close()
    t = await fresh('desktop', 'still&empty', { locale: 'en-GB', timezoneId: 'Europe/London', weather: { shortForecast: 'Sunny', temperature: 68 } })
    await t.page.waitForTimeout(1200)
    w = await read(t.page)
    say(!!w && /^20°/.test(w.weather || '') && /Sunny/.test(w.weather || '') && w.sky === 'day' && /^\d{2}:\d{2}$/.test(w.time || '') && /8 hours behind/.test(w.apart || ''), 'in Celsius and on a 24-hour clock for a visitor in London', JSON.stringify(w))
    await t.ctx.close()
    // what the service says at length: how likely it thinks the weather is left out, and what is still long takes a second line
    const told = (page) => page.evaluate(() => { const el = document.querySelector('.sf__weather'); const r = el.getBoundingClientRect(); const box = document.querySelector('.sf').getBoundingClientRect(); return { lines: Math.round(r.height / parseFloat(getComputedStyle(el).lineHeight)), cut: el.scrollHeight > el.clientHeight + 1, inside: r.bottom <= box.bottom - 8 && r.right <= box.right - 8, time: document.querySelector('.sf__time').getBoundingClientRect().bottom <= r.top + 1 } })
    t = await fresh('desktop', 'still&empty', { locale: 'en-US', timezoneId: 'America/New_York', weather: { shortForecast: 'Slight Chance Rain Showers then Mostly Cloudy' } })
    await t.page.waitForTimeout(1200)
    w = await read(t.page)
    let said = await told(t.page)
    say(!!w && w.weather === '58° Fahrenheit Rain Showers' && said.lines === 1, 'a slight chance of rain showers is said as rain showers, on one line', `${w?.weather} ${JSON.stringify(said)}`)
    await t.ctx.close()
    t = await fresh('desktop', 'still&empty', { locale: 'en-US', timezoneId: 'America/New_York', weather: { shortForecast: 'Showers And Thunderstorms Likely' } })
    await t.page.waitForTimeout(1200)
    w = await read(t.page)
    said = await told(t.page)
    say(!!w && w.weather === '58° Fahrenheit Showers And Thunderstorms' && said.lines === 2 && !said.cut && said.inside && said.time && w.box[2] === 164 && w.box[3] === 164, 'words too long for one line take a second, whole, under the time, and the widget stays its size', `${w?.weather} ${JSON.stringify(said)} ${JSON.stringify(w?.box)}`)
    await t.ctx.close()
    // the service is down: the time alone, and no weather that was not told
    t = await fresh('desktop', 'still&empty', { weather: 'down' })
    await t.page.waitForTimeout(1500)
    w = await read(t.page)
    say(!!w && /^\d{1,2}:\d{2}/.test(w.time || '') && !/°/.test(w.weather || '') && w.weather === 'Pacific Time', 'with no answer from the weather service it shows the time alone', JSON.stringify(w))
    await t.ctx.close()
    // a small desk keeps the room for its windows
    t = await fresh('narrow', 'still&empty')
    await t.page.waitForTimeout(900)
    say((await A.layout(t.page)) === 'desktop' && (await read(t.page)) === null, 'a desk too small to spare the room does not show it')
    await t.ctx.close()
    // it is there only where the conversation, opening in the middle, leaves it clear: from 1240 across
    for (const [wide, shown] of [[1239, false], [1240, true]]) {
      t = await fresh({ w: wide, h: 720 }, 'still')
      await t.page.waitForTimeout(1200)
      const at = await t.page.evaluate(() => { const box = (el) => { if (!el || !el.getClientRects().length) return null; const r = el.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom] }; return { widget: box(document.querySelector('.sf')), chat: box(document.querySelector('.wf[data-app="messages"]')) } })
      say(!!at.widget === shown && !!at.chat && (!at.widget || at.chat[0] >= at.widget[2]), shown ? `at ${wide} across it is shown, and the conversation opens clear of it` : `at ${wide} across it is not`, JSON.stringify(at))
      await t.ctx.close()
    }
  })

  // ---- F. The desktop's icons, after the designs
  await section('F', 'the desktop\'s icons', async () => {
    const t = await fresh('desktop', 'still&empty')
    await t.page.waitForTimeout(900)
    const icons = await t.page.evaluate(() => {
      const fills = (el) => [...el.querySelectorAll('stop')].map((s) => s.getAttribute('stop-color').toLowerCase())
      const of = (id) => document.querySelector(`.dock [data-dock-app="${id}"] svg.app-icon`)
      const out = {}
      // (rim: an outline stroked round the tile itself, over what is drawn on it: the lit edge the tiles used to wear)
      // (the Dock's five tiles in their order: the four apps, and VIP Store, the fifth)
      for (const id of ['finder', 'messages', 'notes', 'terminal', 'store']) { const svg = of(id); out[id] = svg ? { stops: fills(svg).slice(0, 2), ellipse: !!svg.querySelector('ellipse'), dots: svg.querySelectorAll('circle').length, rect: svg.querySelectorAll('rect').length, rim: svg.querySelectorAll(':scope > path[stroke]').length } : null }
      const box = (el) => { const b = el.getBBox(); return [b.x, b.y, b.width, b.height] }
      const chat = of('messages')
      // the bubble and its tail: drawn as two shapes under one shadow
      const [bubble, tail] = chat ? [...chat.querySelectorAll('g[filter] > path')].map(box) : []
      out.bubble = bubble && tail ? { wide: Math.round(bubble[2] * 10) / 10, tall: Math.round(bubble[3] * 10) / 10, foot: Math.round((bubble[1] + bubble[3]) * 10) / 10, tailFoot: Math.round((tail[1] + tail[3]) * 10) / 10 } : null
      // (a plain folder: the first on the desk is Updates, which wears a padlock)
      const folder = document.querySelector('.desk [data-desk="wallpapers"] .folder-icon')
      const front = folder && [...folder.querySelectorAll(':scope > rect')].find((r) => /^url/.test(r.getAttribute('fill')) && !r.getAttribute('clip-path'))
      const all = folder && [...folder.querySelectorAll(':scope > path, :scope > rect')].map(box)
      out.folder = folder ? {
        back: fills(folder)[0], sheet: [...folder.querySelectorAll('rect')].some((r) => r.getAttribute('fill') === '#fff' && !r.getAttribute('opacity')),
        // how wide it is for its height, and how round the corners of its front are for its width
        shape: Math.round(((Math.max(...all.map((b) => b[0] + b[2])) - Math.min(...all.map((b) => b[0]))) / (Math.max(...all.map((b) => b[1] + b[3])) - Math.min(...all.map((b) => b[1])))) * 100) / 100,
        corner: front ? Math.round((+front.getAttribute('rx') / +front.getAttribute('width')) * 1000) / 1000 : null,
        // the light along the front's top edge is cut to the front's own shape
        litClipped: [...folder.querySelectorAll(':scope > rect')].filter((r) => r.getAttribute('clip-path')).length,
      } : null
      const dot = document.querySelector('.dock__dot')
      out.dot = getComputedStyle(dot).backgroundColor
      return out
    })
    const tiles = ['finder', 'messages', 'notes', 'terminal', 'store']
    say(tiles.every((id) => icons[id]?.rim === 0), 'no tile wears a lit rim round its edge', tiles.map((id) => `${id} ${icons[id]?.rim}`).join(', '))
    say(!icons.messages?.ellipse && icons.messages?.stops.join() === '#84ed7d,#63ce54', 'Messages: a pale bubble on the design\'s green', JSON.stringify(icons.messages))
    say(!!icons.bubble && Math.abs(icons.bubble.wide - 72.6) < 1 && Math.abs(icons.bubble.tall - 60.4) < 1 && Math.abs(icons.bubble.tailFoot - icons.bubble.foot) < 0.6, 'its bubble about 72 by 60 of the tile\'s hundred, its tail a nub that ends level with the bubble\'s foot', JSON.stringify(icons.bubble))
    say(icons.notes?.dots === 15 && icons.notes.stops[0] === '#fefefe', 'Notes: a white pad with fifteen holes under a yellow binding', JSON.stringify(icons.notes))
    say(icons.finder?.stops.join() === '#0ec4ff,#39a5ff', 'the Finder: its face on the design\'s blue', JSON.stringify(icons.finder))
    say(icons.terminal?.stops[0] === '#202020' && icons.terminal.rect >= 1, 'a terminal: its prompt and cursor on black', JSON.stringify(icons.terminal))
    say(icons.folder?.back === '#75bce7' && icons.folder.sheet, 'the folder on the desk: a Mac\'s light blue, with a sheet showing over its front', JSON.stringify(icons.folder))
    say(!!icons.folder && icons.folder.shape >= 1.22 && icons.folder.shape <= 1.27 && icons.folder.corner >= 0.05 && icons.folder.corner <= 0.07 && icons.folder.litClipped === 1, 'it is a quarter wider than it is tall, its corners small, and the light on its front\'s top edge is cut to the front', JSON.stringify(icons.folder))
    say(/^rgba?\(255, 255, 255/.test(icons.dot || ''), 'the dot under an open app is pale', icons.dot)
    say(A.realErrors(t.errors).length === 0, 'no errors', A.realErrors(t.errors).slice(0, 2).join(' | '))
    await t.ctx.close()
  })

  // ---- G. Back from what was opened out of a folder leads back to the folder
  await section('G', 'back out to the folder', async () => {
    const t = await fresh('iphone')
    const p = t.page
    await A.unlock(p); await p.waitForTimeout(700)
    const TOP = '.sb-slot[data-front] .ios-page[data-pos="top"]'
    await t.touch.tap(...(await mid(p, '.sb-folder__face[data-folder="portfolio"]'))); await p.waitForTimeout(900)
    // to its second page, and a company there
    await p.evaluate(() => { const el = document.querySelector('.sb-open__pages'); el.scrollTo({ left: el.clientWidth, behavior: 'instant' }) }); await p.waitForTimeout(500)
    const name = await p.evaluate(() => document.querySelectorAll('.sb-open__page')[1].querySelectorAll('.sb-open__app')[4].querySelector('.sb-icon__name').textContent)
    const tile = await p.evaluate(() => { const r = document.querySelectorAll('.sb-open__page')[1].querySelectorAll('.sb-open__app')[4].querySelector('.sb-open__icon').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width] })
    await t.touch.tap(tile[0], tile[1]); await p.waitForTimeout(1300)
    let s = await A.state(p)
    const heading = await p.locator(`${TOP} .contact-head`).innerText().catch(() => '')
    say(s.place?.app === 'finder' && heading.split('\n').some((line) => line.trim() === name), 'a company picked in the Portfolio folder opens its card', `${name}: ${JSON.stringify(s.place)}`)
    // Back: the folder again, on that page, the app gone into the company's own tile
    const watching = watch(p, 800)
    await t.touch.tap(...(await mid(p, `${TOP} .ios-bar button[aria-label="Back"]`)))
    const frames = await watching
    await p.waitForTimeout(500)
    s = await A.state(p)
    const folder = await p.evaluate(() => { const el = document.querySelector('.sb-open__pages'); return el ? { page: Math.round(el.scrollLeft / el.clientWidth), focus: document.activeElement?.closest('.sb-open__app')?.querySelector('.sb-icon__name')?.textContent ?? null, open: !document.querySelector('.sb-open[data-closing]') } : null })
    say(s.place?.app === null && s.place.sheet === 'folder:portfolio' && !!folder?.open, 'Back on the card leads back to the folder, open, not to the list in Contacts', JSON.stringify(s.place))
    say(folder?.page === 1 && folder.focus === name, 'on the page the company is on, with the keyboard on the company', JSON.stringify(folder))
    const last = frames.filter((f) => f[3]).pop()
    say(!!last && Math.abs(last[1] - tile[2]) < 6, 'the card goes back into the company\'s own tile there', JSON.stringify(last))
    say((await p.evaluate(() => history.state.shrug.stacks.finder.length)) === 0, 'and Contacts is on its list again for the next time')
    // the same company come to from the list in Contacts goes back to the list
    await A.at(p, 'finder', [], null, 900)
    // (the list is where the company is, as it is left: a row that is in sight)
    const inSight = await p.evaluate((TOP) => { const row = [...document.querySelectorAll(`${TOP} .contacts-row`)].find((el) => { const r = el.getBoundingClientRect(); return r.top > 120 && r.bottom < innerHeight - 140 }); if (!row) return null; const r = row.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] }, TOP)
    if (inSight) {
      await t.touch.tap(...inSight); await p.waitForTimeout(1000)
      const onCard = (await A.state(p)).place?.stack.length === 1
      const backAgain = await mid(p, `${TOP} .ios-bar button[aria-label="Back"]`)
      if (backAgain) { await t.touch.tap(...backAgain); await p.waitForTimeout(900) }
      s = await A.state(p)
      say(onCard && !!backAgain && s.place?.app === 'finder' && s.place.stack.length === 0, 'a card opened from the list in Contacts goes back to the list, as before', JSON.stringify(s.place))
    } else say(false, 'no company in sight in the list of Contacts')
    // and a question picked in the FAQs folder
    await A.at(p, null, [], null, 700)
    await t.touch.tap(...(await mid(p, '.sb-folder__face[data-folder="faqs"]'))); await p.waitForTimeout(900)
    await t.touch.tap(...(await mid(p, '.sb-open__note'))); await p.waitForTimeout(1300)
    s = await A.state(p)
    const inNote = s.place?.app === 'notes' && s.place.stack.length === 2
    // Back: every frame of the note going back into its row, as [how much of it is drawn, how much of a picture over it]
    const going = p.evaluate(() => new Promise((done) => {
      const out = []
      const on = () => {
        document.removeEventListener('pointerdown', on, true)
        let n = 0
        const tick = () => {
          const zoom = document.querySelector('.sb-slot[data-app="notes"] .sb-zoom')
          if (zoom) { const cs = getComputedStyle(zoom); out.push([cs.visibility === 'hidden' ? 0 : +(+cs.opacity).toFixed(2), +(+getComputedStyle(zoom.querySelector('.sb-zoom__face')).opacity).toFixed(2), Math.round(zoom.querySelector('.sb-zoom__app').getBoundingClientRect().height)]) }
          if (n++ < 60) requestAnimationFrame(tick); else done(out)
        }
        requestAnimationFrame(tick)
      }
      document.addEventListener('pointerdown', on, true)
    }))
    await t.touch.tap(...(await mid(p, `${TOP} .ios-bar button[aria-label="Back"]`))); await p.waitForTimeout(1100)
    s = await A.state(p)
    say(inNote && s.place?.app === null && s.place.sheet === 'folder:faqs', 'a question picked in the FAQs folder goes back to that folder too', JSON.stringify(s.place))
    // it fades away as it reaches the row: no white card is landed on the row and left there
    const fading = await going
    const small = fading.filter(([drawn, , tall]) => drawn > 0 && tall < 60)
    const lastSeen = fading.filter(([drawn]) => drawn > 0).pop()
    say(fading.some(([drawn, , tall]) => drawn === 1 && tall > 400) && fading.every(([, face]) => face < 0.05) && !!lastSeen && lastSeen[0] < 0.25 && small.filter(([drawn]) => drawn > 0.9).length <= 3, 'the note fades away as it reaches its row: no white card is landed on the row and left there', JSON.stringify(fading.filter((_, i) => i % 4 === 0)))
    say(A.realErrors(t.errors).length === 0, 'no errors', A.realErrors(t.errors).slice(0, 2).join(' | '))
    await t.ctx.close()
  })

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'between apps: all ok')
  process.exit(failed ? 1 : 0)
})()
