// Fixer I: every fix in the iPhone's shared parts (screens, bars, sheets, menus), what the phone does now that it has
// no Settings app, and the desktop's About.
//   node ios-parts.cjs [base] [only]        base defaults to the dev server; exits 1 if anything fails
//   only: touch | keys | replies | about (one group of checks)
const A = require('./lib.cjs')
const BASE = process.argv[2] || process.env.BASE || 'http://127.0.0.1:5173/'
const only = process.argv[3]
let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + String(detail).slice(0, 260) : ''))
}
const TOP = '.sb-slot[data-front] .ios-page[data-pos="top"]'
const where = (page) =>
  page.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body) return 'BODY'
    return `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 36)}"`
  })

;(async () => {
  const browser = await A.launch()
  const PAUSE = '.sb-slot[data-front] .ios-sheet .ios-switch[aria-label="Pause Replies"]'
  // `quiet`: no banners (they drop over the top bar, where some of these checks press). The phone has no Settings to
  // turn them off in, so it is done the way a visitor can: Pause Replies, in the conversation's details
  const fresh = async (device, query = 'still', opts = {}) => {
    const t = await A.open(browser, { device, dpr: 1, base: BASE, query, ...opts, goto: false })
    await t.page.goto(BASE + (query ? '?' + query : ''), { waitUntil: 'load', timeout: 90000 })
    await A.unlock(t.page)
    if (opts.quiet) {
      await A.at(t.page, 'messages', ['c:group'], 'details', 900)
      // a click, which a finger makes too: one of these runs has a keyboard and no touch screen
      await t.page.locator(PAUSE).click()
      await t.sleep(300)
      if ((await t.page.locator(PAUSE).getAttribute('aria-checked')) !== 'true') throw new Error('could not pause the replies')
      await A.at(t.page, null, [], null, 700)
      // a banner that was already down goes back up by itself
      await t.page.waitForFunction(() => !document.querySelector('.sb-banner'), null, { timeout: 12000 }).catch(() => {})
    }
    return t
  }
  /** Contacts' list, with `query` typed into the search field at its foot. */
  const contactsSearch = async (t, query) => {
    await A.at(t.page, 'finder', [], null, 800)
    await t.page.locator(`${TOP} .ios-search__input`).fill(query)
    await t.sleep(400)
  }
  const swipe = async (t, x, y0, y1, steps = 12) => {
    await t.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] })
    for (let i = 1; i <= steps; i++) {
      await t.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / steps }] })
      await t.sleep(16)
    }
    await t.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await t.sleep(700)
  }

  // ------------------------------------------------------------------ touch
  if (!only || only === 'touch') {
    let t = await fresh('iphone', 'still', { quiet: true })
    let { page } = t

    // PH-8: the fade above a foot bar takes no touches (Contacts' search, with most of the portfolio listed under it)
    await contactsSearch(t, 'a')
    await page.evaluate(() => document.activeElement?.blur())
    const edge = await page.evaluate((TOP) => {
      const e = document.querySelector(`${TOP} .ios-foot__edge`).getBoundingClientRect()
      return { top: e.top, pe: getComputedStyle(document.querySelector(`${TOP} .ios-foot__edge`)).pointerEvents }
    }, TOP)
    const scrollTop = () => page.evaluate((TOP) => Math.round(document.querySelector(`${TOP} [data-scroller]`).scrollTop), TOP)
    await swipe(t, 60, edge.top + 10, edge.top - 210)
    const moved = await scrollTop()
    check('PH-8 a swipe that starts on the fade above the foot bar scrolls the list', moved > 100 && edge.pe === 'none', `moved ${moved}px, pointer-events ${edge.pe}`)
    const row = await page.evaluate((TOP) => {
      const sc = document.querySelector(`${TOP} [data-scroller]`)
      const fade = document.querySelector(`${TOP} .ios-foot__edge`).getBoundingClientRect()
      const bar = [...document.querySelectorAll(`${TOP} .ios-foot > :not(.ios-foot__edge)`)].map((k) => k.getBoundingClientRect().top)
      // a company whose middle is in the fade, above the bar's own controls
      const y = fade.top + 12
      const r = [...sc.querySelectorAll('button.contacts-row')].find((b) => { const q = b.getBoundingClientRect(); return q.top < y && q.bottom > y })
      if (!r) return null
      const b = r.getBoundingClientRect()
      return { x: b.left + Math.min(60, b.width / 2), y, label: r.textContent.trim().slice(0, 24), inFade: y > fade.top && y < Math.min(...bar) }
    }, TOP)
    if (row) await page.touchscreen.tap(row.x, row.y)
    await t.sleep(900)
    let s = await A.state(page)
    check('PH-8 a row showing through the fade can be pressed', !!row && row.inFade && s.place.stack.join().startsWith('co:'), `${JSON.stringify(row)} -> ${s.place.stack.join()}`)

    // PH-12: the clear button in a search bar takes a finger
    await contactsSearch(t, '')
    await page.locator(`${TOP} .ios-search__input`).tap()
    await page.keyboard.type('gen')
    await t.sleep(300)
    const clear = await page.evaluate((TOP) => {
      const b = document.querySelector(`${TOP} .ios-search__clear`)
      const r = b.getBoundingClientRect()
      const at = (x, y) => document.elementFromPoint(x, y) === b
      // how far out from its middle the button still takes the press
      let w = 0, h = 0
      for (let d = 0; d < 40; d++) { if (at(r.left + r.width / 2 - d, r.top + r.height / 2) && at(r.left + r.width / 2 + Math.min(d, 12), r.top + r.height / 2)) w = d; else break }
      for (let d = 0; d < 40; d++) { if (at(r.left + r.width / 2, r.top + r.height / 2 - d) && at(r.left + r.width / 2, r.top + r.height / 2 + d)) h = d; else break }
      return { drawn: [r.width, r.height], reach: [w * 2, h * 2] }
    }, TOP)
    check('PH-12 the clear button takes a press 44px across', clear.reach[0] >= 42 && clear.reach[1] >= 42, JSON.stringify(clear))
    // …and clearing keeps the caret in the field
    const cb = await page.locator(`${TOP} .ios-search__clear`).boundingBox()
    await page.touchscreen.tap(cb.x + cb.width / 2, cb.y + cb.height / 2)
    await t.sleep(300)
    const after = await page.evaluate((TOP) => ({ value: document.querySelector(`${TOP} .ios-search__input`).value, focused: document.activeElement === document.querySelector(`${TOP} .ios-search__input`) }), TOP)
    check('tb-10 clearing a search leaves the caret in the field', after.value === '' && after.focused, JSON.stringify(after))

    // MK-6: a long unbroken word does not push "No Results" off the screen
    await page.locator(`${TOP} .ios-search__input`).fill('x'.repeat(400))
    await t.sleep(400)
    const empty = await page.evaluate((TOP) => {
      const e = document.querySelector(`${TOP} .ios-empty`)
      if (!e) return null
      const kids = [...e.children].map((k) => { const r = k.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)] })
      return { kids, w: innerWidth, title: e.querySelector('.ios-empty__title').textContent.length, text: e.querySelector('.ios-empty__title').textContent.slice(0, 22) }
    }, TOP)
    check('MK-6 a 400-letter word in search: "No Results" stays on the screen, the quote cut short', empty && empty.kids.every(([l, r]) => l >= 0 && r <= empty.w) && empty.title < 70, JSON.stringify(empty))
    await page.locator(`${TOP} button[aria-label="Cancel"]`).tap()
    await t.sleep(500)
    const whole = await page.evaluate((TOP) => ({ rows: document.querySelectorAll(`${TOP} .contacts-row`).length, typed: document.querySelector(`${TOP} .ios-search__input`).value, index: !!document.querySelector(`${TOP} .contacts-index`), cancel: !!document.querySelector(`${TOP} button[aria-label="Cancel"]`) }), TOP)
    check('Contacts\' search is put away by its Cancel: the whole list again, and the index', whole.rows === 81 && whole.typed === '' && whole.index && !whole.cancel, JSON.stringify(whole))

    // MK-8: a sheet is pulled away by its contents (the details of the conversation)
    await A.at(page, 'messages', ['c:group'], 'details', 900)
    const body = await page.locator('.sb-slot[data-front] .ios-sheet__body').boundingBox()
    await swipe(t, body.x + body.width / 2, body.y + 120, body.y + 420)
    await t.sleep(500)
    s = await A.state(page)
    check('MK-8 a pull down on a sheet\'s contents carries it away', s.place.sheet === null && !(await page.$('.sb-slot[data-front] .ios-sheet:not([data-closing])')), JSON.stringify(s.place))
    // a short pull puts it back
    await A.at(page, 'messages', ['c:group'], 'details', 900)
    await swipe(t, body.x + body.width / 2, body.y + 120, body.y + 170)
    s = await A.state(page)
    const back = await page.evaluate(() => getComputedStyle(document.querySelector('.sb-slot[data-front] .ios-sheet__panel')).transform)
    check('MK-8 a short pull lets it settle back', s.place.sheet === 'details' && (back === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(back)), back)
    await A.at(page, 'messages', ['c:group'], null, 600)

    // MK-14: New Folder again straight after Done comes up fresh
    await A.at(page, 'notes', [], 'new-folder', 900)
    const nf = page.locator('.sb-slot[data-front] .ios-sheet input').first()
    await nf.fill('First')
    await page.locator('.sb-slot[data-front] .ios-sheet button[aria-label="Done"]').first().tap()
    await t.sleep(120)
    await A.at(page, 'notes', [], 'new-folder', 700)
    const again = await page.evaluate(() => {
      const i = document.querySelector('.sb-slot[data-front] .ios-sheet:not([data-closing]) input')
      return i ? { value: i.value, focused: document.activeElement === i } : null
    })
    check('MK-14 New Folder opened again straight after Done comes up fresh, its field ready', again && again.value !== 'First' && again.focused, JSON.stringify(again))
    await A.at(page, 'notes', [], null, 600)
    check('touch run: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
    await t.ctx.close()

    // PH-4: on its side, a menu fits the screen and sits over the foot bar
    t = await fresh('se1-land', 'still', { quiet: true })
    page = t.page
    for (const [name, app, stack] of [['Notes More', 'notes', ['f:faqs']], ['VIP Sort and Filter', 'photos', []]]) {
      await A.at(page, app, stack, null, 800)
      // (Notes' hangs from its bar; VIP's rises out of the button at the foot of its library)
      await page.locator(`${TOP} .ios-menu > button`).first().tap()
      await t.sleep(600)
      const menu = await page.evaluate(async (TOP) => {
        const list = document.querySelector(`${TOP} .ios-menu__list[data-show]`)
        if (!list) return null
        const sc = list.querySelector('.ios-menu__scroll')
        const lr = list.getBoundingClientRect()
        const items = [...list.querySelectorAll('.ios-menu__item')]
        const pressable = []
        for (const it of items) {
          it.scrollIntoView({ block: 'nearest' })
          await new Promise((r) => requestAnimationFrame(r))
          const r = it.getBoundingClientRect()
          const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          pressable.push(!!el && it.contains(el) && r.top >= 0 && r.bottom <= innerHeight)
        }
        return { top: Math.round(lr.top), bottom: Math.round(lr.bottom), h: innerHeight, items: items.length, pressable, scrolls: sc.scrollHeight > sc.clientHeight }
      }, TOP)
      if (!menu) console.log('     (no open menu found)', JSON.stringify(await page.evaluate((TOP) => ({ lists: [...document.querySelectorAll(`${TOP} .ios-menu__list`)].map((l) => [l.hasAttribute('data-show'), l.hasAttribute('inert')]), focus: document.activeElement?.className?.toString().slice(0, 40), scroll: [scrollX, scrollY] }), TOP)), JSON.stringify(await A.state(page)))
      check(`PH-4 on its side (568x320): every row of ${name} can be pressed, and the menu is inside the screen`, menu && menu.top >= 0 && menu.bottom <= menu.h && menu.pressable.every(Boolean), JSON.stringify(menu))
      await page.keyboard.press('Escape')
      await t.sleep(400)
    }
    await A.shot(page, 'fix-I-menu-land')
    // …and the menu that rises out of a conversation's plus starts inside the screen
    await A.at(page, 'messages', ['c:group'], null, 900)
    await page.locator(`${TOP} .msg-more__button`).tap()
    await t.sleep(600)
    const plus = await page.evaluate((TOP) => { const l = document.querySelector(`${TOP} .msg-more__list[data-show]`); const r = l?.getBoundingClientRect(); return l ? { top: Math.round(r.top), bottom: Math.round(r.bottom), rows: l.querySelectorAll('.ios-menu__item').length } : null }, TOP)
    check('PH-4 on its side (568x320): the plus menu in a conversation starts inside the screen', plus && plus.top >= 0 && plus.rows >= 4, JSON.stringify(plus))
    await page.keyboard.press('Escape')
    await t.sleep(300)

    // PH-10: on its side with the keyboard up, something of what was found shows (Contacts' search)
    await contactsSearch(t, 'a')
    await page.locator(`${TOP} .ios-search__input`).tap()
    await page.setViewportSize({ width: 568, height: 150 })
    await t.sleep(700)
    const kb = await page.evaluate((TOP) => {
      const bar = document.querySelector(`${TOP} .ios-bar`).getBoundingClientRect()
      const field = document.querySelector(`${TOP} .ios-search`).getBoundingClientRect()
      const rows = [...document.querySelectorAll(`${TOP} button.contacts-row`)].filter((r) => { const b = r.getBoundingClientRect(); const el = document.elementFromPoint(b.left + 60, b.top + b.height / 2); return el && r.contains(el) && b.top + b.height / 2 > bar.bottom - 4 && b.top + b.height / 2 < field.top })
      const large = document.querySelector(`${TOP} .ios-large`)?.getBoundingClientRect()
      return { h: innerHeight, bar: Math.round(bar.bottom), field: [Math.round(field.top), Math.round(field.bottom)], rowsShowing: rows.length, largeHeight: large ? Math.round(large.height) : null, name: getComputedStyle(document.querySelector(`${TOP} .ios-bar__name`)).opacity }
    }, TOP)
    await A.shot(page, 'fix-I-kb-land')
    check('PH-10 on its side with the keyboard up (568x150): a company that was found shows between the bars, the title is in the bar', kb.rowsShowing >= 1 && kb.field[1] <= kb.h && kb.name === '1', JSON.stringify(kb))
    await page.setViewportSize({ width: 568, height: 320 })
    check('land run: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
    await t.ctx.close()
  }

  // ------------------------------------------------------------------ keys
  if (!only || only === 'keys') {
    const t = await fresh({ w: 600, h: 900 }, 'still', { quiet: true })
    const { page } = t

    // AX-7 / AX-16: a pushed screen is named; Back returns the keyboard to what pushed it
    await A.at(page, 'notes', [], null, 900)
    await page.locator(`${TOP} button.ios-cell`, { hasText: 'FAQs' }).focus()
    await page.keyboard.press('Enter')
    await t.sleep(900)
    const pushed = await page.evaluate((TOP) => {
      const p = document.querySelector(TOP)
      const h = document.getElementById(p.getAttribute('aria-labelledby'))
      return { focusOnPage: document.activeElement === p, role: p.getAttribute('role'), named: h?.textContent ?? null, heading: h?.tagName ?? null }
    }, TOP)
    check('AX-16 a pushed screen takes the keyboard and is named by its heading', pushed.focusOnPage && pushed.role === 'group' && pushed.named === 'FAQs' && pushed.heading === 'H2', JSON.stringify(pushed))
    await page.locator(`${TOP} button[aria-label="Back"]`).focus()
    await page.keyboard.press('Enter')
    await t.sleep(900)
    check('AX-7 Back puts the keyboard on the row that pushed the screen', /"FAQs/.test(await where(page)), await where(page))

    // AX-16: every screen has a heading that names it
    const headings = []
    for (const [name, app, stack] of A.PHONE_SCREENS.filter((sc) => sc[1] && !sc[3])) {
      await A.at(page, app, stack, null, 450)
      headings.push([name, await page.evaluate((TOP) => {
        const p = document.querySelector(TOP)
        if (!p) return 'no page'
        const named = document.getElementById(p.getAttribute('aria-labelledby') || '')
        const hs = [...p.querySelectorAll('h1, h2')].filter((h) => !h.closest('[aria-hidden="true"]'))
        return named && named.textContent.trim() && hs.includes(named) ? '' : `named by ${named ? JSON.stringify(named.textContent) : 'nothing'}; headings ${hs.map((h) => h.textContent.trim().slice(0, 20)).join('|')}`
      }, TOP)])
    }
    const unnamed = headings.filter(([, why]) => why)
    check(`AX-16 all ${headings.length} iPhone screens have a heading, and the page is named by it`, unnamed.length === 0, unnamed.map(([n, w]) => `${n}: ${w}`).join(' ; '))

    // AX-12: an iPhone menu from the keyboard
    await A.at(page, 'notes', ['f:faqs'], null, 900)
    const more = page.locator(`${TOP} .ios-menu > button`).first()
    await more.focus()
    await page.keyboard.press('Enter')
    await t.sleep(450)
    const first = await where(page)
    await page.keyboard.press('ArrowDown')
    const second = await where(page)
    await page.keyboard.press('End')
    const last = await where(page)
    await page.keyboard.press('ArrowDown')
    const wrapped = await where(page)
    await page.keyboard.press('Home')
    const home = await where(page)
    check('AX-12 Enter opens a menu onto its first row; the arrows, Home and End walk it', /ios-menu__item/.test(first) && first !== second && last !== second && wrapped === first && home === first, [first, second, last].join(' → '))
    await page.keyboard.press('Escape')
    await t.sleep(450)
    check('AX-12 Escape closes it and returns to its button', /"More"/.test(await where(page)) && (await more.getAttribute('aria-expanded')) === 'false', await where(page))
    await page.keyboard.press('ArrowUp')
    await t.sleep(400)
    check('AX-12 ArrowUp on the button opens it onto its last row', (await where(page)) === last, await where(page))
    await page.keyboard.press('Enter')
    await t.sleep(600)
    check('AX-7 choosing a row that changes the screen in place returns the keyboard to the button', /"More"/.test(await where(page)), await where(page))

    // AX-9 / AX-23 / AX-7: a sheet holds the keyboard, has one Close, and gives the keyboard back (the conversation's details)
    await A.at(page, 'messages', ['c:group'], null, 900)
    const company = page.locator(`${TOP} button.msg-head`)
    await company.focus()
    const companyName = await where(page)
    await page.keyboard.press('Enter')
    await t.sleep(900)
    const inert = await page.evaluate((TOP) => document.querySelector(TOP).hasAttribute('inert'), TOP)
    const stops = []
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      stops.push(await page.evaluate(() => { const el = document.activeElement; return el.closest('.ios-page') ? 'PAGE BEHIND' : el.closest('.ios-sheet') ? 'sheet' : el === document.body ? 'body' : (el.getAttribute('aria-label') || el.className.toString()).slice(0, 20) }))
    }
    check('AX-9 with a sheet up the screen behind is shut off, and Tab never goes there', inert && !stops.includes('PAGE BEHIND') && stops.filter((x) => x === 'sheet').length >= 4, stops.join(' → '))
    const closes = await page.evaluate(() => [...document.querySelectorAll('.sb-slot[data-front] .ios-sheet [aria-label="Close"]')].filter((e) => !e.closest('[aria-hidden="true"]')).length)
    check('AX-23 a sheet has one Close for a screen reader', closes === 1, String(closes))
    await page.locator('.sb-slot[data-front] .ios-sheet__panel').focus()
    await page.keyboard.press('Escape')
    await t.sleep(900)
    check('AX-7 closing a sheet returns the keyboard to what opened it', (await where(page)) === companyName && !(await page.evaluate((TOP) => document.querySelector(TOP).hasAttribute('inert'), TOP)), `${await where(page)} (was ${companyName})`)

    // a sheet named by something the app has no sheet for shuts nothing off
    await A.at(page, 'notes', [], 'no-such-sheet', 700)
    check('a sheet that does not exist leaves the screen usable', !(await page.evaluate((TOP) => document.querySelector(TOP).hasAttribute('inert'), TOP)))

    // MK-15: Escape in a search field: clear, let go, then the phone's own
    await A.at(page, 'notes', [], null, 800)
    const field = page.locator(`${TOP} .ios-search__input`)
    await field.click()
    await page.keyboard.type('varda')
    await page.keyboard.press('Escape')
    const e1 = await page.evaluate((TOP) => ({ v: document.querySelector(`${TOP} .ios-search__input`).value, f: document.activeElement === document.querySelector(`${TOP} .ios-search__input`) }), TOP)
    await page.keyboard.press('Escape')
    const e2 = await page.evaluate((TOP) => ({ f: document.activeElement === document.querySelector(`${TOP} .ios-search__input`) }), TOP)
    const stay = (await A.state(page)).place.app
    await page.keyboard.press('Escape')
    await t.sleep(900)
    const e3 = (await A.state(page)).place.app
    check('MK-15 Escape in search: clears, then lets go of the field, then is the phone\'s own', e1.v === '' && e1.f && !e2.f && stay === 'notes' && e3 === null, JSON.stringify({ e1, e2, stay, e3 }))
    // …and the same in Contacts
    await contactsSearch(t, 'varda')
    await page.locator(`${TOP} .ios-search__input`).focus()
    await page.keyboard.press('Escape')
    const w1 = await page.evaluate((TOP) => ({ v: document.querySelector(`${TOP} .ios-search__input`).value, f: document.activeElement === document.querySelector(`${TOP} .ios-search__input`), rows: document.querySelectorAll(`${TOP} .contacts-row`).length }), TOP)
    await page.keyboard.press('Escape')
    const w2 = await page.evaluate((TOP) => ({ f: document.activeElement === document.querySelector(`${TOP} .ios-search__input`) }), TOP)
    const w3 = (await A.state(page)).place.app
    await page.keyboard.press('Escape')
    await t.sleep(900)
    const w4 = (await A.state(page)).place.app
    check('MK-15 Escape in Contacts\' search: clears (the whole list is back), lets go, then is the phone\'s own', w1.v === '' && w1.f && w1.rows === 81 && !w2.f && w3 === 'finder' && w4 === null, JSON.stringify({ w1, w2, w3, w4 }))

    // MK-17: fields and titles take the direction of what they hold
    await A.at(page, 'notes', [], null, 800)
    const dirs = await page.evaluate((TOP) => ['.ios-search__input', '.ios-large', '.ios-cell__title'].map((sel) => document.querySelector(`${TOP} ${sel}`)?.getAttribute('dir')), TOP)
    check('MK-17 fields and titles are dir="auto"', dirs.every((d) => d === 'auto'), dirs.join())
    check('keys run: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
    await t.ctx.close()

    // AX-13: with reduced motion a sheet closes without sliding
    const r = await fresh('iphone', 'still', { reducedMotion: true })
    await A.at(r.page, 'messages', ['c:group'], 'details', 700)
    await r.page.evaluate(() => {
      window.__moves = []
      const panel = document.querySelector('.sb-slot[data-front] .ios-sheet__panel')
      const tick = () => { const p = document.querySelector('.sb-slot[data-front] .ios-sheet__panel'); if (p) window.__moves.push(Math.round(p.getBoundingClientRect().top)); if (window.__moves.length < 40) requestAnimationFrame(tick) }
      requestAnimationFrame(tick)
      void panel
    })
    await r.page.locator('.sb-slot[data-front] .ios-sheet button[aria-label="Close"]').first().tap()
    await r.sleep(900)
    const moves = await r.page.evaluate(() => [...new Set(window.__moves)])
    check('AX-13 reduced motion: a sheet closes in one step, not a slide', moves.length <= 2, moves.join(','))
    await r.ctx.close()
  }

  // ------------------------------------------------------------------ replies, and a phone with no Settings
  if (!only || only === 'replies') {
    let t = await fresh('iphone')
    let { page } = t
    const replied = () => page.evaluate(() => Number(document.querySelector('.sb-dock .sb-badge')?.textContent || 0))

    // AX-20: Pause Replies, in the conversation's details, is the one switch there is for it
    await t.sleep(2500)
    await A.at(page, 'messages', ['c:group'], 'details', 900)
    const sw = page.locator(PAUSE)
    await sw.tap()
    await t.sleep(400)
    const paused = await sw.getAttribute('aria-checked')
    await A.at(page, null, [], null, 700)
    const b0 = await replied()
    await t.sleep(6500)
    const b1 = await replied()
    check('AX-20 Pause Replies in a conversation\'s details stops the replies (nothing more is counted on the badge)', paused === 'true' && b1 === b0, `paused ${paused}, badge ${b0} -> ${b1}`)
    const noBanner = await page.evaluate(() => !document.querySelector('.sb-banner'))
    check('AX-20 …and no banner comes down while they are paused', noBanner)
    await A.at(page, 'messages', ['c:group'], 'details', 900)
    await sw.tap()
    await t.sleep(300)
    await A.at(page, null, [], null, 700)
    await t.sleep(5000)
    const b2 = await replied()
    check('AX-20 switched off again, the replies carry on', b2 > b1, `badge ${b1} -> ${b2}`)

    // The phone has no Settings app: not on the Home Screen, not in the Dock, not in the App Switcher's reach
    const names = await page.evaluate(() => [...document.querySelectorAll('.sb-home .sb-icon, .sb-dock .sb-icon, .sb-home [data-app], .sb-dock [data-app]')].map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim()))
    check('the phone has no Settings app on its Home Screen or in its Dock', names.length >= 4 && !names.some((n) => /^(Settings|About)/i.test(n)), names.join(' / ').slice(0, 200))
    // A step in history that the older build left at Settings is the Home Screen now, and still a working one
    await A.at(page, 'about', ['general', 'about'], null, 900)
    let s = await A.state(page)
    const home = await page.evaluate(() => ({ home: !!document.querySelector('.sb-home'), front: document.querySelector('.sb-slot[data-front]')?.getAttribute('data-app') ?? null }))
    check('a step in history left at Settings by the older build shows the Home Screen', home.home && home.front === null && !s.locked, JSON.stringify({ ...home, place: s.place }))
    await page.locator('.sb-dock [aria-label^="Notes"], .sb-home [aria-label^="Notes"], .sb-dock [aria-label^="FAQs"], .sb-home [aria-label^="FAQs"]').first().tap().catch(() => {})
    await t.sleep(900)
    s = await A.state(page)
    check('…from which an app still opens', s.front !== null, JSON.stringify(s.place))
    check('replies run: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
    await t.ctx.close()

    // What the older build kept from its Settings is not read: with notifications kept "off" there, a banner still comes
    t = await A.open(browser, { device: 'iphone', dpr: 1, base: BASE, goto: false })
    page = t.page
    await page.addInitScript(() => { try { localStorage.setItem('shrug:settings', JSON.stringify({ notifications: false, autoLock: null, previews: false })) } catch {} })
    await page.goto(BASE + '?still', { waitUntil: 'load' })
    await A.unlock(page)
    let banner = null
    for (let i = 0; i < 80 && !banner; i++) {
      await t.sleep(250)
      banner = await page.evaluate(() => document.querySelector('.sb-banner')?.innerText || null)
    }
    check('what the older build kept from Settings is not read: a reply is still announced, with what it says', !!banner && banner.replace(/\s+/g, ' ').length > 40, String(banner).replace(/\n/g, ' | ').slice(0, 120))
    await t.ctx.close()
  }

  // ------------------------------------------------------------------ about (desktop)
  if (!only || only === 'about') {
    // What is in it is 522px tall in full; with the smaller icon, 484px; with its rows closer, 452px; shorter than that, it scrolls
    for (const [name, w, h, icon, fits] of [['1440x900', 1440, 900, 84, true], ['1366x700', 1366, 700, 84, true], ['1366x650', 1366, 650, 60, true], ['1280x620', 1280, 620, 60, true], ['1280x500', 1280, 500, 60, false], ['900x480', 900, 480, 60, false]]) {
      const t = await A.open(browser, { device: { w, h, dpr: 1 }, base: BASE, query: 'still&open=about' })
      await t.page.waitForSelector('.wf[data-app="about"] .about__body', { timeout: 20000 })
      await t.sleep(1200)
      const m = await t.page.evaluate(() => {
        const win = document.querySelector('.wf[data-app="about"]')
        const b = win.querySelector('.about__body')
        const shown = () => [...b.children].filter((c) => getComputedStyle(c).display !== 'none')
        const cut = shown().some((c) => c.getBoundingClientRect().bottom > b.getBoundingClientRect().bottom + 0.5)
        // what is left under its last row (12px is the window's own margin there)
        const foot = Math.round(b.getBoundingClientRect().bottom - shown().at(-1).getBoundingClientRect().bottom)
        const facts = [...win.querySelectorAll('.about__fact--said')].map((f) => f.querySelector('dt').textContent.trim())
        const rows = [...win.querySelectorAll('button.about__fact')].map((f) => f.textContent.trim())
        // scrolled to its foot, the last thing in it is inside the window
        b.scrollTop = b.scrollHeight
        const last = shown().at(-1).getBoundingClientRect().bottom <= b.getBoundingClientRect().bottom + 0.5
        const out = { line: win.querySelector('.about__kind').textContent, fits: b.scrollHeight <= b.clientHeight, cut, foot, last, scrolls: getComputedStyle(b).overflowY, icon: Math.round(win.querySelector('.about__icon').getBoundingClientRect().height), facts, rows, emoticon: /\(ツ\)/.test(win.textContent), links: [...win.querySelectorAll('.about__link')].map((a) => a.textContent.trim()) }
        b.scrollTop = 0
        return out
      })
      check(`About at ${name}: says who Shrug is${fits ? ', nothing cut at its foot' : ', and scrolls to its last row'}`, /early.stage venture fund/.test(m.line) && m.icon === icon && (fits ? m.fits && !m.cut : m.scrolls === 'auto' && m.last), JSON.stringify(m))
      if (w === 1440) {
        check('About at its own size is as tall as what is in it: no band of nothing at its foot', m.foot >= 11 && m.foot <= 16, `foot ${m.foot}px`)
        check('About says more about Shrug: when it started, who runs it, which fund this is, what it backs', m.facts.length >= 4 && m.facts.includes('Backs'), m.facts.join(' / '))
        check('About counts what is on the site, each row a button', m.rows.length === 4 && /89 people/.test(m.rows[0]) && /81 companies/.test(m.rows[1]), m.rows.join(' / '))
        check('About has no shrug emoticon in it', !m.emoticon && !(await t.page.$('.wf[data-app="about"] .about__mark')))
        check('About: the one-pager says it opens in a new tab', m.links.some((l) => /One-pager, opens in a new tab/.test(l)), m.links.join(' / '))
      }
      await t.ctx.close()
    }
  }

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})()
