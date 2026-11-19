// Fixer F's checks: forced colours on both layouts (AX-3, AX-4, AX-21) and the kit's parts under reduced
// motion (AX-13). Exits non-zero if any fails.
//   node forced-colours.cjs [base]          (default http://127.0.0.1:5173/, or BASE in the environment)
// What is checked is what the browser computes: that an edge is drawn, that what is chosen fills with the
// system's Highlight, that a switch and a bubble have shapes, that the focus ring still takes over. What it
// looks like is in the pictures (fix-F-shots.cjs, fix-F-extra.cjs).
const A = require('./lib.cjs')
const BASE = process.argv[2] || process.env.BASE || 'http://127.0.0.1:5173/'

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + detail : ''))
}

/** In the page: what the system's colours compute to here, and a reader of an element's own paint. */
const kit = () => {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;left:-99px;top:-99px;width:1px;height:1px;forced-color-adjust:none'
  document.body.append(probe)
  const sys = {}
  for (const name of ['Canvas', 'CanvasText', 'ButtonText', 'Highlight', 'HighlightText', 'GrayText', 'LinkText']) {
    probe.style.backgroundColor = name
    sys[name] = getComputedStyle(probe).backgroundColor
  }
  probe.remove()
  window.__sys = sys
  window.__paint = (sel, pseudo) => {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel
    if (!el) return null
    const c = getComputedStyle(el, pseudo || undefined)
    return {
      bg: c.backgroundColor,
      color: c.color,
      outline: c.outlineStyle === 'none' ? null : `${parseFloat(c.outlineWidth)}px ${c.outlineColor}`,
      outlineW: c.outlineStyle === 'none' ? 0 : parseFloat(c.outlineWidth),
      outlineC: c.outlineColor,
      border: c.borderTopStyle === 'none' ? null : `${parseFloat(c.borderTopWidth)}px ${c.borderTopColor}`,
      borderW: c.borderTopStyle === 'none' ? 0 : parseFloat(c.borderTopWidth),
      borderC: c.borderTopColor,
      borderBottomW: c.borderBottomStyle === 'none' ? 0 : parseFloat(c.borderBottomWidth),
      display: c.display,
      opacity: c.opacity,
      transform: c.transform,
      animation: c.animationName,
      transitionMs: Math.max(...c.transitionDuration.split(',').map((s) => parseFloat(s) * (s.includes('ms') ? 1 : 1000))),
    }
  }
}

const booted = (page) => page.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.os[data-booted]'), null, { timeout: 30000 })

;(async () => {
  const browser = await A.launch()
  const paint = (page, sel, pseudo) => page.evaluate(([s, p]) => window.__paint(s, p), [sel, pseudo ?? null])
  const sys = (page) => page.evaluate(() => window.__sys)

  for (const scheme of ['dark', 'light']) {
    // ---- the desktop, in forced colours
    {
      const t = await A.open(browser, { device: 'laptop', base: BASE, query: 'still', forcedColors: true, colorScheme: scheme })
      const { page, sleep } = t
      await booted(page)
      await page.waitForSelector('.chat__thread .ss-bubble-row[data-from="them"] .ss-bubble:not([data-typing])', { timeout: 30000 })
      await page.evaluate(kit)
      const S = await sys(page)
      const is = (got, name) => got === S[name]
      check(`[${scheme}] forced colours are on, and the system's colours differ`, (await page.evaluate(() => matchMedia('(forced-colors: active)').matches)) && S.Canvas !== S.CanvasText && S.Highlight !== S.Canvas)

      await page.click('[data-dock-app="finder"]')
      await page.waitForSelector('.wf[data-app="finder"][data-active]', { timeout: 8000 })
      await sleep(700)
      const front = await paint(page, '.wf[data-app="finder"] .wf__content > .ss-window')
      const back = await paint(page, '.wf[data-app="messages"] .wf__content > .ss-window')
      check(`[${scheme}] AX-3 a window has an edge; the one in front has the heavier one, in Highlight`, front && back && front.outlineW >= 2 && is(front.outlineC, 'Highlight') && back.outlineW >= 1 && is(back.outlineC, 'CanvasText') && is(front.bg, 'Canvas'), JSON.stringify({ front: front?.outline, back: back?.outline }))
      const light = await paint(page, '.wf[data-app="finder"] .wf__light[data-kind="close"]')
      const mark = await paint(page, '.wf[data-app="finder"] .wf__light[data-kind="close"] svg')
      check(`[${scheme}] AX-3 the lights are rings with their marks showing`, light && light.outlineW >= 1 && is(light.outlineC, 'ButtonText') && mark && mark.opacity === '1', JSON.stringify({ light: light?.outline, mark: mark?.opacity }))
      check(`[${scheme}] AX-3 the menu bar and the Dock's shelf have edges`, ((await paint(page, '.menubar'))?.outlineW ?? 0) >= 1 && ((await paint(page, '.dock__shelf'))?.outlineW ?? 0) >= 1)

      const side = await paint(page, '.wf[data-app="finder"] .side-item[aria-current]')
      check(`[${scheme}] AX-4 the sidebar's current row fills with Highlight`, side && is(side.bg, 'Highlight') && is(side.color, 'HighlightText'), JSON.stringify(side && { bg: side.bg, color: side.color }))
      await page.locator('.wf[data-app="finder"] .pf-file').nth(2).click()
      await sleep(300)
      const name = await paint(page, '.wf[data-app="finder"] .pf-file[aria-selected="true"] .pf-file__name')
      const icon = await paint(page, '.wf[data-app="finder"] .pf-file[aria-selected="true"] .pf-file__icon')
      check(`[${scheme}] AX-4 the chosen company is marked (its name in Highlight, a ring round its icon)`, name && is(name.bg, 'Highlight') && icon && icon.outlineW >= 2, JSON.stringify({ name: name?.bg, icon: icon?.outline }))
      const pressed = await paint(page, '.wf[data-app="finder"] .tool__part[aria-pressed="true"]')
      check(`[${scheme}] AX-4 the view that is on (icons / list) fills with Highlight`, pressed && is(pressed.bg, 'Highlight'))
      const field = await paint(page, '.wf[data-app="finder"] .search')
      check(`[${scheme}] AX-21 a search field has an edge`, field && field.outlineW >= 1, field?.outline)

      // a menu, and the item the arrows are on
      await page.click('[data-menu-title="window"]')
      await sleep(400)
      await page.keyboard.press('ArrowDown')
      await sleep(200)
      const menu = await paint(page, '[data-menu="window"] .menu')
      const item = await page.evaluate(() => window.__paint(document.activeElement))
      check(`[${scheme}] AX-3 an open menu has an edge`, menu && menu.outlineW >= 1, menu?.outline)
      check(`[${scheme}] AX-4 the menu item the arrows are on fills with Highlight`, item && is(item.bg, 'Highlight') && is(item.color, 'HighlightText'), JSON.stringify(item && { bg: item.bg, color: item.color }))
      await page.keyboard.press('Escape')
      await sleep(300)

      // Messages: the open conversation, the bubbles, the switch in the details
      await page.click('[data-dock-app="messages"]')
      await sleep(700)
      const conv = await paint(page, '.wf[data-app="messages"] .conv[data-selected]')
      const convWords = await page.evaluate(() => {
        const row = document.querySelector('.wf[data-app="messages"] .conv[data-selected]')
        return row ? [...row.querySelectorAll('.ss-row__title, .ss-row__meta, .ss-row__subtitle, .ss-row__preview')].map((el) => getComputedStyle(el).color) : []
      })
      check(`[${scheme}] AX-4 the open conversation fills with Highlight, every word on it HighlightText`, conv && is(conv.bg, 'Highlight') && convWords.length > 0 && convWords.every((c) => c === S.HighlightText), JSON.stringify({ bg: conv?.bg, words: [...new Set(convWords)] }))
      const mine = await paint(page, '.wf[data-app="messages"] .ss-bubble-row[data-from="me"] > .ss-bubble', '::before')
      const theirs = await paint(page, '.wf[data-app="messages"] .ss-bubble-row[data-from="them"] > .ss-bubble', '::before')
      check(`[${scheme}] AX-21 a bubble has an edge: Highlight and heavier for Shrug's side, CanvasText for the others`, mine && theirs && mine.borderW >= 2 && is(mine.borderC, 'Highlight') && theirs.borderW >= 1 && is(theirs.borderC, 'CanvasText'), JSON.stringify({ mine: mine?.border, theirs: theirs?.border }))
      const tail = await paint(page, '.wf[data-app="messages"] .ss-bubble__tail')
      check(`[${scheme}] AX-21 no stray tail`, !tail || tail.display === 'none', tail?.display)
      const composer = await paint(page, '.wf[data-app="messages"] .composer__field')
      check(`[${scheme}] AX-21 the message field has an edge`, composer && composer.outlineW >= 1)
      const opened = await page.locator('.wf[data-app="messages"] .chat-info .tool').click({ timeout: 4000 }).then(() => true, () => false)
      await sleep(600)
      const toggle = await paint(page, '.chat-details .ss-toggle')
      if (opened && toggle) {
        const wasOn = await page.evaluate(() => document.querySelector('.chat-details .ss-toggle').hasAttribute('data-on'))
        if (!wasOn) await page.click('.chat-details .details__row[role="switch"]')
        await sleep(300)
        const on = await paint(page, '.chat-details .ss-toggle')
        const knob = await paint(page, '.chat-details .ss-toggle__knob')
        check(`[${scheme}] AX-4 the details' switch is drawn, and fills with Highlight when on`, toggle.outlineW >= 1 && on && is(on.bg, 'Highlight') && knob && is(knob.bg, 'HighlightText'), JSON.stringify({ edge: toggle.outline, on: on?.bg, knob: knob?.bg }))
        if (!wasOn) await page.click('.chat-details .details__row[role="switch"]')
      } else check(`[${scheme}] AX-4 the details' switch is drawn`, false, 'the details did not open or have no switch')
      await page.keyboard.press('Escape')
      await sleep(300)

      // the focus ring still takes over from an edge
      await page.locator('.wf[data-app="messages"] .wf__light[data-kind="close"]').focus()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
      const ringed = await page.evaluate(() => window.__paint(document.activeElement))
      check(`[${scheme}] a control with the keyboard still gets its ring over its edge`, ringed && ringed.outlineW >= 2, JSON.stringify(ringed && { el: await page.evaluate(() => document.activeElement.className), outline: ringed.outline }))
      check(`[${scheme}] desktop: no errors`, A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | ').slice(0, 200))
      await t.ctx.close()
    }

    // ---- the iPhone, in forced colours
    {
      const t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still', forcedColors: true, colorScheme: scheme, dpr: 2 })
      const { page, sleep } = t
      await page.waitForSelector('.sb-lock')
      await page.waitForSelector('.sb-lock .ss-notification', { timeout: 30000 })
      await page.evaluate(kit)
      const S = await sys(page)
      const is = (got, name) => got === S[name]
      const note = await paint(page, '.sb-lock .ss-notification')
      check(`[${scheme}] iPhone: a notification on the Lock Screen is a solid sheet with an edge`, note && note.outlineW >= 1 && is(note.bg, 'Canvas'), JSON.stringify(note && { bg: note.bg, outline: note.outline }))
      await page.keyboard.press('Enter')
      await sleep(1400)
      const dock = await paint(page, '.sb-dock')
      const widget = await paint(page, '.sb-widget__face')
      check(`[${scheme}] iPhone: the Dock and the widget are solid, with edges`, dock && is(dock.bg, 'Canvas') && dock.outlineW >= 1 && widget && is(widget.bg, 'Canvas') && widget.outlineW >= 1, JSON.stringify({ dock: dock?.outline, widget: widget?.outline }))
      const face = await paint(page, '.sb-folder__face')
      if (face) check(`[${scheme}] iPhone: a folder has an edge`, face.outlineW >= 1 && is(face.bg, 'Canvas'), face.outline)
      const badge = await paint(page, '.sb-dock .sb-badge')
      if (badge) check(`[${scheme}] iPhone: the badge counts in Highlight`, is(badge.bg, 'Highlight') && is(badge.color, 'HighlightText'))

      await A.at(page, 'messages', [])
      const dot = await paint(page, '.sb-slot[data-front] .msg-row .ss-row__dot')
      check(`[${scheme}] AX-4 iPhone: the unread dot is Highlight`, dot && is(dot.bg, 'Highlight'), dot?.bg)
      await A.at(page, 'messages', ['c:group'])
      const bar = await paint(page, '.sb-slot[data-front] .ios-page[data-pos="top"] .ios-bar')
      check(`[${scheme}] iPhone: a bar is solid, with a line under it`, bar && is(bar.bg, 'Canvas') && bar.borderBottomW >= 1, JSON.stringify(bar && { bg: bar.bg, line: bar.borderBottomW }))
      const glass = await paint(page, '.sb-slot[data-front] .ios-page[data-pos="top"] .ios-glass.ios-button')
      check(`[${scheme}] AX-21 iPhone: a glass button has an edge`, glass && glass.outlineW >= 1 && is(glass.outlineC, 'ButtonText'), glass?.outline)
      const mine = await paint(page, '.sb-slot[data-front] .ss-bubble-row[data-from="me"] > .ss-bubble', '::before')
      const theirs = await paint(page, '.sb-slot[data-front] .ss-bubble-row[data-from="them"] > .ss-bubble', '::before')
      check(`[${scheme}] AX-21 iPhone: bubbles have edges, Shrug's in Highlight`, mine && theirs && is(mine.borderC, 'Highlight') && is(theirs.borderC, 'CanvasText') && mine.borderW > theirs.borderW, JSON.stringify({ mine: mine?.border, theirs: theirs?.border }))

      // Contacts: a vertical's heading is a band of the page with a line under it, the index's letters are links,
      // and what a card offers to do is a button with an edge
      await A.at(page, 'finder', [])
      const head = await paint(page, '.sb-slot[data-front] .contacts-letter')
      check(`[${scheme}] iPhone: a vertical's heading in Contacts is the page's own ground, with a line under it, in the page's ink`, head && is(head.bg, 'Canvas') && head.borderBottomW >= 1 && head.color === S.CanvasText, JSON.stringify(head && { bg: head.bg, line: head.borderBottomW, ink: head.color }))
      const letter = await paint(page, '.sb-slot[data-front] button.contacts-index__letter')
      check(`[${scheme}] iPhone: the letters of its index are the system's link colour`, letter && is(letter.color, 'LinkText'), letter?.color)
      await A.at(page, 'finder', ['co:Varda'])
      const act = await paint(page, '.sb-slot[data-front] .ios-page[data-pos="top"] a.contact-act')
      check(`[${scheme}] iPhone: what a company's card offers to do has an edge`, act && act.outlineW >= 1 && is(act.outlineC, 'ButtonText') && is(act.color, 'LinkText'), JSON.stringify(act && { outline: act.outline, ink: act.color }))

      // A grouped list and a switch: the conversation's details
      await A.at(page, 'messages', ['c:group'], 'details')
      const rows = await paint(page, '.sb-slot[data-front] .ios-sheet .ios-section__rows')
      check(`[${scheme}] AX-21 iPhone: a grouped list is a card with an edge`, rows && rows.outlineW >= 1, rows?.outline)
      const read = () => page.evaluate(() =>
        [...document.querySelectorAll('.sb-slot[data-front] .ios-sheet .ios-switch')].map((el) => ({ on: el.getAttribute('aria-checked') === 'true', ...window.__paint(el), knob: window.__paint(el.querySelector('.ios-switch__knob')).bg })),
      )
      let states = await read()
      check(`[${scheme}] AX-4 iPhone: a switch is drawn (a ring and a knob)`, states.length > 0 && states.every((s) => s.outlineW >= 1), JSON.stringify(states.map((s) => s.outline)))
      const off = states.find((s) => !s.on)
      if (off) check(`[${scheme}] AX-4 iPhone: off, it is Canvas with a ButtonText knob`, is(off.bg, 'Canvas') && is(off.knob, 'ButtonText'), JSON.stringify({ bg: off.bg, knob: off.knob }))
      await page.locator('.sb-slot[data-front] .ios-sheet .ios-switch').first().focus()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
      const ringed = await page.evaluate(() => window.__paint(document.activeElement))
      check(`[${scheme}] iPhone: a switch with the keyboard still gets its ring`, ringed && ringed.outlineW >= 2, JSON.stringify(ringed && ringed.outline))
      // Switched on (Pause Replies), it fills with Highlight; then off again, so the conversation goes on
      await page.keyboard.press('Space')
      await page.waitForTimeout(300)
      states = await read()
      const on = states.find((s) => s.on)
      check(`[${scheme}] AX-4 iPhone: on, it fills with Highlight`, !!on && is(on.bg, 'Highlight') && is(on.knob, 'HighlightText'), JSON.stringify(on && { bg: on.bg, knob: on.knob }))
      await page.keyboard.press('Space')
      await page.waitForTimeout(200)

      await A.at(page, null, [])
      const searched = await page
        .locator('.sb-search')
        .click({ timeout: 4000 })
        .then(async () => {
          await sleep(800)
          await page.locator('.ph input[aria-label*="Search" i]').last().fill('var')
          await sleep(700)
          await page.keyboard.press('ArrowDown')
          await sleep(250)
          return true
        })
        .catch(() => false)
      const active = await paint(page, '.spot [data-spot-item][data-active]')
      check(`[${scheme}] AX-4 iPhone: the search result the arrows are on fills with Highlight`, searched && active && is(active.bg, 'Highlight'), JSON.stringify(active && { bg: active.bg }))
      check(`[${scheme}] iPhone: no errors`, A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | ').slice(0, 200))
      await t.ctx.close()
    }
  }

  // ---- less motion: the kit's popovers and a message that arrives
  for (const reduced of [true, false]) {
    const t = await A.open(browser, { device: 'laptop', base: BASE, query: 'still', reducedMotion: reduced })
    const { page, sleep } = t
    await booted(page)
    await page.evaluate(kit)
    await sleep(600)
    // at rest (closed): the surface a popover grows from
    const rest = await paint(page, '[data-menu="window"] .menu', '::before')
    await page.click('[data-menu-title="window"]')
    await sleep(60)
    const opening = await paint(page, '[data-menu="window"] .menu', '::before')
    await sleep(500)
    const shown = await paint(page, '[data-menu="window"] .menu')
    await page.keyboard.press('Escape')
    await sleep(40)
    const closing = await paint(page, '[data-menu="window"] .menu')
    await sleep(500)
    if (reduced) {
      check('AX-13 less motion: a menu does not grow out of its corner (no scale at rest or on the way)', rest && rest.transform === 'none' && opening && opening.transform === 'none' && opening.transitionMs === 0, JSON.stringify({ rest: rest?.transform, opening: opening?.transform, ms: opening?.transitionMs }))
      check('AX-13 less motion: it is there when open, and does not shrink away when closed', shown && shown.opacity === '1' && closing && closing.transform === 'none', JSON.stringify({ shown: shown?.opacity, closing: closing?.transform }))
    } else {
      check('with motion allowed the kit still scales its popover (nothing changed for everyone else)', rest && rest.transform !== 'none', rest?.transform)
    }
    // a message sent: the bubble that arrives
    await page.fill('.wf[data-app="messages"] .composer__input', 'hello')
    await page.keyboard.press('Enter')
    await page.waitForSelector('.wf[data-app="messages"] .ss-bubble-row[data-from="me"] .ss-bubble[data-arrived]', { timeout: 5000 }).catch(() => {})
    const arrived = await page.evaluate(() => {
      const el = [...document.querySelectorAll('.wf[data-app="messages"] .ss-bubble[data-arrived]')].pop()
      if (!el) return null
      const tail = el.querySelector('.ss-bubble__tail')
      return { bubble: getComputedStyle(el).animationName, fill: getComputedStyle(el, '::before').animationName, tail: tail ? getComputedStyle(tail).animationName : 'none', seen: getComputedStyle(el).opacity }
    })
    if (reduced) check('AX-13 less motion: a message that arrives does not pop (no animation on the bubble, its fill or its tail)', arrived && arrived.bubble === 'none' && arrived.fill === 'none' && arrived.tail === 'none' && arrived.seen === '1', JSON.stringify(arrived))
    check(`${reduced ? 'less motion' : 'motion'}: no errors`, A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | ').slice(0, 200))
    await t.ctx.close()
  }

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error('FAILED', e.message.split('\n').slice(0, 8).join('\n'))
  process.exit(1)
})
