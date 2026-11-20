// What happens between apps on the iPhone, and what came with it: how an app opens and is put away, what is seen
// while it loads, the ways out of Messages, Notes, Contacts and VIP, a message to Shrug with files (and what a
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
    await t.touch.tap(...icon)
    let frames = await watching
    let seen = frames.filter((f) => f[3])
    say(seen.length > 6 && seen[0][0] < 150 && seen[0][1] < tile * 1.8, 'the first frames after the tap show the app at about the size of its icon', JSON.stringify(seen.slice(0, 3)))
    const widths = seen.map((f) => f[1])
    say(widths.every((w, i) => i === 0 || w >= widths[i - 1] - 1) && widths[widths.length - 1] === W, 'and it grows from there to the whole screen, never back', JSON.stringify(widths.filter((_, i) => i % 4 === 0)))
    // half-way there in well under the first third of the time, as a spring is
    const half = seen.find((f) => f[1] >= W / 2)
    say(!!half && half[0] - seen[0][0] < 190, 'most of the way in the first part of the move', half ? `half-way ${half[0] - seen[0][0]}ms after it was first seen` : 'never half-way')
    say(seen.some((f) => !f[4]) && seen[seen.length - 1][4], 'it opens on its launch screen, and its own screens are in it by the time it has opened', JSON.stringify(seen.filter((f) => f[4])[0]))
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
    await u.touch.tap(...company)
    const got = await colours
    const s = await A.state(q)
    say(s.place?.app === 'finder' && /^co:/.test(s.place.stack?.[0] ?? ''), 'a company in the Portfolio folder opens its card in Contacts', JSON.stringify(s.place))
    say(got.length > 0 && got.some(([, live]) => !live) && got.every(([c]) => c !== 'rgb(255, 255, 255)'), 'whose launch screen is the card\'s own colour from the first frame, not white', JSON.stringify([...new Set(got.map(([c, live]) => `${c} ${live ? 'drawn' : 'launch'}`))]))
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
    say(A.realErrors(t.errors).length === 0, 'no errors', A.realErrors(t.errors).slice(0, 2).join(' | '))
    await t.ctx.close()
  })

  // ---- C. The ways out, and the Dock
  await section('C', 'the ways out', async () => {
    const t = await fresh('iphone')
    const p = t.page
    await A.unlock(p); await p.waitForTimeout(700)
    const dock = await p.evaluate(() => [...document.querySelectorAll('.sb-dock .sb-icon')].map((el) => el.getAttribute('aria-label').replace(/,.*/, '')))
    say(JSON.stringify(dock) === '["Messages","Contacts","Notes","VIP"]', 'the Dock holds Messages, Contacts, Notes and VIP', JSON.stringify(dock))
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
    // Contacts and VIP have the round Back that those apps have in that corner on an iPhone, named for where it leads
    await A.at(p, 'finder', [], null, 900)
    let back = p.locator(`${TOP} .ios-bar__side:not(.ios-bar__side--end) button`)
    say((await back.count()) === 1 && (await back.getAttribute('aria-label')) === 'Home Screen' && (await back.locator('svg').count()) === 1, 'Contacts\' list has Back in its corner, which says Home Screen')
    await back.tap(); await p.waitForTimeout(900)
    say((await A.state(p)).place?.app === null, 'and goes there')
    await A.at(p, 'photos', [], null, 900)
    back = p.locator(`${TOP} .ios-bar__side:not(.ios-bar__side--end) button`)
    const glass = await back.evaluate((b) => { const cs = getComputedStyle(b); const head = document.querySelector('.sb-slot[data-front] .ios-page[data-pos="top"] .photos-head').getBoundingClientRect(); const r = b.getBoundingClientRect(); return { ground: cs.backgroundColor, ink: cs.color, overHead: r.bottom < head.bottom && r.top >= head.top } }).catch(() => null)
    say((await back.count()) === 1 && (await back.getAttribute('aria-label')) === 'Home Screen' && !!glass && glass.overHead && /^rgba\(255, 255, 255, 0\.[6-9]/.test(glass.ground) && glass.ink === 'rgb(28, 28, 30)', 'VIP\'s library has it too, on pale glass over the picture at its head', JSON.stringify(glass))
    await back.tap(); await p.waitForTimeout(900)
    say((await A.state(p)).place?.app === null, 'and it goes there too')
    await A.at(p, 'photos', [], null, 900)
    // (the head's picture is itself pressed, as its square in the grid is: that is the one button in it)
    say((await p.locator(`${TOP} .photos-head`).count()) === 1 && (await p.locator(`${TOP} .photos-head button:not(.photos-head__open)`).count()) === 0 && (await p.locator(`${TOP} .photos-head button.photos-head__open`).count()) === 1, 'VIP\'s library has no Play button: the picture at its head is the one thing there to press')
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
    await p.locator('.msg-alert__act').last().tap(); await p.waitForTimeout(600)
    // the list has it at its head now
    await p.locator(`${TOP} .ios-bar button[aria-label^="Back"]`).tap(); await p.waitForTimeout(900)
    const row = await p.evaluate((TOP) => document.querySelector(`${TOP} .msg-rows > :first-child`)?.textContent ?? '', TOP)
    say(/^Shrug/.test(row) && /Not Delivered/.test(row), 'the list of conversations has it at its head, and says it did not go', row.slice(0, 80))
    // looked for, it is found: by its name, by what was written in it, by the name of a file sent
    const finds = []
    for (const q of ['shrug', 'seed deck', 'deck.pdf', 'zzzz']) {
      await p.locator(`${TOP} .ios-search__input`).fill(q); await p.waitForTimeout(350)
      finds.push(await p.evaluate((TOP) => document.querySelector(`${TOP} .msg-row[data-row="shrug"] .ss-row__preview`)?.textContent ?? null, TOP))
    }
    say(/Our seed deck$/.test(finds[0] || '') && /Our seed deck$/.test(finds[1] || '') && /Seed Deck\.pdf$/.test(finds[2] || '') && finds[3] === null, 'a search of the list finds it by its name, by its words and by its file\'s name, showing which', JSON.stringify(finds))
    await p.locator(`${TOP} .ios-foot button[aria-label="Cancel"]`).tap(); await p.waitForTimeout(400)
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
    say(!!w && /Today/.test(w.apart || '') && /3 hours behind/.test(w.apart || ''), 'how far that is from the visitor\'s own (New York: three hours behind)', w?.apart)
    say(!!w && /^58°/.test(w.weather || '') && /Mostly Cloudy/.test(w.weather || '') && w.sky === 'gray', 'and the weather it was told, in Fahrenheit for an American', `${w?.weather} (${w?.sky})`)
    say(A.realErrors(t.errors).length === 0, 'no errors', A.realErrors(t.errors).slice(0, 2).join(' | '))
    await t.ctx.close()
    t = await fresh('desktop', 'still&empty', { locale: 'en-GB', timezoneId: 'Europe/London', weather: { shortForecast: 'Sunny', temperature: 68 } })
    await t.page.waitForTimeout(1200)
    w = await read(t.page)
    say(!!w && /^20°/.test(w.weather || '') && /Sunny/.test(w.weather || '') && w.sky === 'day' && /^\d{2}:\d{2}$/.test(w.time || '') && /8 hours behind/.test(w.apart || ''), 'in Celsius and on a 24-hour clock for a visitor in London', JSON.stringify(w))
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
  })

  // ---- F. The desktop's icons, after the designs
  await section('F', 'the desktop\'s icons', async () => {
    const t = await fresh('desktop', 'still&empty')
    await t.page.waitForTimeout(900)
    const icons = await t.page.evaluate(() => {
      const fills = (el) => [...el.querySelectorAll('stop')].map((s) => s.getAttribute('stop-color').toLowerCase())
      const of = (id) => document.querySelector(`.dock [data-dock-item="${id}"] svg, .dock [data-app="${id}"] svg`) ?? [...document.querySelectorAll('.dock svg.app-icon')][['finder', 'messages', 'notes', 'terminal', 'photos'].indexOf(id)]
      const out = {}
      for (const id of ['finder', 'messages', 'notes', 'terminal']) { const svg = of(id); out[id] = svg ? { stops: fills(svg).slice(0, 2), ellipse: !!svg.querySelector('ellipse'), dots: svg.querySelectorAll('circle').length, rect: svg.querySelectorAll('rect').length } : null }
      const folder = document.querySelector('.desk .folder-icon')
      out.folder = folder ? { back: folder.querySelector('path')?.getAttribute('fill'), sheet: [...folder.querySelectorAll('rect')].some((r) => r.getAttribute('fill') === '#fff' && !r.getAttribute('opacity')) } : null
      return out
    })
    say(icons.messages?.ellipse && icons.messages.stops[0] === '#8eee8b', 'Messages: a pale bubble on a soft green', JSON.stringify(icons.messages))
    say(icons.notes?.dots === 21 && icons.notes.stops[0] === '#fdfdfd', 'Notes: a white pad with its perforation under a yellow binding', JSON.stringify(icons.notes))
    say(icons.finder?.stops[0] === '#1fbcfc', 'the Finder: its face on a brighter blue', JSON.stringify(icons.finder))
    say(icons.terminal?.stops[0] === '#262628' && icons.terminal.rect >= 1, 'a terminal: its prompt and cursor on black', JSON.stringify(icons.terminal))
    say(icons.folder?.back === '#5faeea' && icons.folder.sheet, 'the folder on the desk: a Mac\'s light blue, with a sheet showing over its front', JSON.stringify(icons.folder))
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
    await t.touch.tap(...(await mid(p, `${TOP} .contacts-row`))); await p.waitForTimeout(1000)
    await t.touch.tap(...(await mid(p, `${TOP} .ios-bar button[aria-label="Back"]`))); await p.waitForTimeout(900)
    s = await A.state(p)
    say(s.place?.app === 'finder' && s.place.stack.length === 0, 'a card opened from the list in Contacts goes back to the list, as before', JSON.stringify(s.place))
    // and a question picked in the FAQs folder
    await A.at(p, null, [], null, 700)
    await t.touch.tap(...(await mid(p, '.sb-folder__face[data-folder="faqs"]'))); await p.waitForTimeout(900)
    await t.touch.tap(...(await mid(p, '.sb-open__note'))); await p.waitForTimeout(1300)
    s = await A.state(p)
    const inNote = s.place?.app === 'notes' && s.place.stack.length === 2
    await t.touch.tap(...(await mid(p, `${TOP} .ios-bar button[aria-label="Back"]`))); await p.waitForTimeout(1100)
    s = await A.state(p)
    say(inNote && s.place?.app === null && s.place.sheet === 'folder:faqs', 'a question picked in the FAQs folder goes back to that folder too', JSON.stringify(s.place))
    say(A.realErrors(t.errors).length === 0, 'no errors', A.realErrors(t.errors).slice(0, 2).join(' | '))
    await t.ctx.close()
  })

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'between apps: all ok')
  process.exit(failed ? 1 : 0)
})()
