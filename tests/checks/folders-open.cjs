// S2: an open folder. The keyboard (no ring round the folder, focus given back, arrows carry focus with the page),
// the strip of dots (two halves a finger can find), less motion, the ring's colour, and that it fits on its side.
//   node folders-open.cjs [base]
const A = require('./lib.cjs')
const BASE = process.argv[2] || process.env.BASE || 'http://127.0.0.1:5173/'
let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + detail : ''))
}
const home = async (t) => {
  await A.unlock(t.page)
  for (let i = 0; i < 3 && !(await t.page.$('.sb-home:not([data-locked])')); i++) { await t.page.waitForTimeout(1200); if (await t.page.$('.sb-lock:not([data-leaving])')) await A.unlock(t.page).catch(() => {}) }
}
const active = (page) => page.evaluate(() => { const a = document.activeElement; return a ? (a.className?.toString().split(' ')[0] || a.tagName) + (a.textContent ? ':' + a.textContent.trim().slice(0, 24) : '') : null })
const pageNow = (page) => page.evaluate(() => [...document.querySelectorAll('.sb-open__dot')].findIndex((d) => d.hasAttribute('data-current')))

;(async () => {
  const browser = await A.launch()

  // ---- keyboard, in the frame on a computer ----
  let t = await A.open(browser, { device: { w: 600, h: 900, dpr: 1 }, base: BASE, query: 'still' })
  await home(t)
  const { page } = t
  await page.locator('.sb-folder').first().focus()
  await page.keyboard.press('Enter'); await t.sleep(900)
  let ring = await page.evaluate(() => { const b = document.querySelector('.sb-open__box'); const c = getComputedStyle(b); return { focused: document.activeElement === b, visible: b.matches(':focus-visible'), style: c.outlineStyle, width: c.outlineWidth } })
  check('PH-15 opened from the keyboard: the folder has the keyboard and no ring round it', ring.focused && (ring.style === 'none' || ring.width === '0px'), JSON.stringify(ring))
  await A.shot(page, 'fix-s2-open-keyboard')
  // Tab goes to the first company; its ring is white
  await page.keyboard.press('Tab'); await t.sleep(150)
  const first = await page.evaluate(() => { const a = document.activeElement; const c = getComputedStyle(a); return { cls: a.className, name: a.textContent.trim(), color: c.outlineColor, style: c.outlineStyle } })
  check('AX-5 Tab lands on the first company, with a white ring', /sb-open__app/.test(first.cls) && first.name === 'Varda' && first.color === 'rgb(255, 255, 255)' && first.style === 'solid', JSON.stringify(first))
  await A.shot(page, 'fix-s2-open-ring')
  // the arrows turn the page and take the keyboard with them
  await page.keyboard.press('ArrowRight'); await t.sleep(900)
  let now = { page: await pageNow(page), at: await active(page) }
  const firstOf2 = await page.evaluate(() => document.querySelectorAll('.sb-open__page')[1].querySelector('.sb-open__app').textContent.trim())
  check('AX-7 ArrowRight: the next page, focus on its first company', now.page === 1 && now.at === `sb-open__app:${firstOf2}`, JSON.stringify(now) + ' want ' + firstOf2)
  await page.keyboard.press('ArrowLeft'); await t.sleep(900)
  now = { page: await pageNow(page), at: await active(page) }
  check('AX-7 ArrowLeft: back, focus on that page\'s first company', now.page === 0 && now.at === 'sb-open__app:Varda', JSON.stringify(now))
  await page.keyboard.press('ArrowLeft'); await t.sleep(400)
  check('…and at the first page the arrow leaves focus where it is', (await active(page)) === 'sb-open__app:Varda')
  // Escape: closed, and the keyboard is back on the folder it came out of
  await page.keyboard.press('Escape'); await t.sleep(900)
  let at = await page.evaluate(() => ({ cls: document.activeElement?.className, folder: document.activeElement?.querySelector?.('.sb-folder__face')?.dataset.folder, open: document.querySelectorAll('.sb-open:not([data-closing])').length }))
  check('AX-7 Escape: focus back on the Portfolio folder', at.open === 0 && /sb-folder/.test(at.cls || '') && at.folder === 'portfolio', JSON.stringify(at))
  // FAQs the same, closed by its close button's way (the browser's Back)
  await page.keyboard.press('Tab'); await t.sleep(100)
  at = await page.evaluate(() => document.activeElement?.querySelector?.('.sb-folder__face')?.dataset.folder)
  check('…and Tab from there goes on to FAQs', at === 'faqs', String(at))
  await page.keyboard.press('Enter'); await t.sleep(900)
  await page.goBack(); await t.sleep(900)
  at = await page.evaluate(() => ({ folder: document.activeElement?.querySelector?.('.sb-folder__face')?.dataset.folder, open: document.querySelectorAll('.sb-open').length }))
  check('AX-7 the browser\'s Back closes FAQs: focus back on the FAQs folder', at.folder === 'faqs', JSON.stringify(at))
  // something picked out of a folder: the keyboard is not sent back to the tile
  await page.keyboard.press('Enter'); await t.sleep(900)
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await t.sleep(1500)
  at = await page.evaluate(() => ({ app: history.state?.shrug?.app, tile: !!document.activeElement?.closest?.('.sb-folder') }))
  check('a question picked opens Notes; the keyboard is not sent back to the folder', at.app === 'notes' && !at.tile, JSON.stringify(at))
  check('no errors (keyboard)', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | ').slice(0, 200))
  await t.ctx.close()

  // ---- the strip, with a finger ----
  t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still' })
  await home(t)
  await t.page.locator('.sb-folder').first().tap(); await t.sleep(900)
  const strip = await t.page.evaluate(() => {
    const steps = [...document.querySelectorAll('.sb-open__step')].map((b) => { const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), name: b.getAttribute('aria-label'), off: b.getAttribute('aria-disabled'), x: r.left + r.width / 2, y: r.top + r.height / 2 } })
    const dots = [...document.querySelectorAll('.sb-open__dot')]
    const d0 = dots[0].getBoundingClientRect(), dN = dots[dots.length - 1].getBoundingClientRect()
    return { steps, dots: dots.length, hidden: !!dots[0].closest('[aria-hidden="true"]'), dotButtons: document.querySelectorAll('button.sb-open__dot').length, says: document.querySelector('.sb-open__turn [role="status"]')?.textContent.trim(), dotsAt: [d0.left, dN.right, d0.top], hitOnDot: document.elementFromPoint(dN.left + 3, dN.top + 3)?.className }
  })
  check('AX-19 two targets, each at least 44 by 44, named', strip.steps.length === 2 && strip.steps.every((s) => s.w >= 44 && s.h >= 44) && strip.steps[0].name === 'Previous page' && strip.steps[1].name === 'Next page', JSON.stringify(strip.steps))
  check('AX-19 the dots are a picture: nine of them, not buttons, hidden from a screen reader, taking no touches', strip.dots === 9 && strip.dotButtons === 0 && strip.hidden && /sb-open__step/.test(strip.hitOnDot || ''), JSON.stringify({ dots: strip.dots, buttons: strip.dotButtons, hidden: strip.hidden, hit: strip.hitOnDot }))
  check('…and where they are is said in words', strip.says === 'Page 1 of 9' && strip.steps[0].off === 'true', strip.says + ' / back off: ' + strip.steps[0].off)
  await t.page.touchscreen.tap(strip.steps[1].x, strip.steps[1].y); await t.sleep(900)
  check('a press on the right half goes on a page', (await pageNow(t.page)) === 1 && (await t.page.textContent('.sb-open__turn [role="status"]')).trim() === 'Page 2 of 9')
  await t.page.touchscreen.tap(strip.steps[0].x, strip.steps[0].y); await t.sleep(900)
  check('a press on the left half goes back', (await pageNow(t.page)) === 0)
  // the last row's names are not covered by the strip
  const covered = await t.page.evaluate(() => {
    const strip = document.querySelector('.sb-open__turn').getBoundingClientRect()
    return [...document.querySelectorAll('.sb-open__page')[0].querySelectorAll('.sb-open__app')].filter((a) => a.getBoundingClientRect().bottom > strip.top + 0.5).length
  })
  check('the strip does not lie over the last row of companies', covered === 0, String(covered))
  await A.shot(t.page, 'fix-s2-open-strip')
  await t.ctx.close()

  // ---- less motion: a turn does not glide ----
  for (const reduced of [true, false]) {
    t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still', reducedMotion: reduced })
    await home(t)
    await t.page.locator('.sb-folder').first().tap(); await t.sleep(900)
    const seen = await t.page.evaluate(async () => {
      const el = document.querySelector('.sb-open__pages')
      const at = new Set()
      document.querySelector('.sb-open__step[data-way="on"]').click()
      const until = performance.now() + 700
      while (performance.now() < until) { at.add(Math.round(el.scrollLeft)); await new Promise((r) => requestAnimationFrame(r)) }
      return { stops: at.size, end: Math.round(el.scrollLeft), w: el.clientWidth }
    })
    if (reduced) check('AX-13 less motion asked for: the page is turned at once', seen.stops <= 2 && seen.end === seen.w, JSON.stringify(seen))
    else check('…and with motion it glides', seen.stops > 3 && seen.end === seen.w, JSON.stringify(seen))
    await t.ctx.close()
  }

  // ---- on its side: the open folders fit ----
  for (const [w, h] of [[568, 320], [667, 375], [760, 340], [932, 430]]) {
    t = await A.open(browser, { device: { w, h, touch: true, dpr: 1 }, base: BASE, query: 'still&phone=hand' })
    await home(t)
    for (const id of ['portfolio', 'faqs']) {
      await A.at(t.page, null, [], `folder:${id}`)
      const fit = await t.page.evaluate(() => {
        const b = document.querySelector('.sb-open__box')?.getBoundingClientRect()
        const steps = [...document.querySelectorAll('.sb-open__step')].map((s) => Math.round(s.getBoundingClientRect().height))
        return b ? { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), H: innerHeight, W: innerWidth, steps } : null
      })
      check(`on its side ${w}x${h}: ${id} fits`, fit && fit.t >= 0 && fit.b <= fit.H && fit.l >= 0 && fit.r <= fit.W, JSON.stringify(fit))
      if (id === 'portfolio') {
        check(`on its side ${w}x${h}: the strip's halves are 44 tall`, fit && fit.steps.every((s) => s >= 44), JSON.stringify(fit && fit.steps))
        const under = await t.page.evaluate(() => { const strip = document.querySelector('.sb-open__turn').getBoundingClientRect(); return [...document.querySelectorAll('.sb-open__page')[0].querySelectorAll('.sb-open__app')].filter((a) => a.getBoundingClientRect().bottom > strip.top + 0.5).length })
        check(`on its side ${w}x${h}: the strip does not lie over the companies`, under === 0, String(under))
      }
      if (w === 568 || w === 760) await A.shot(t.page, `fix-s2-open-${id}-${w}x${h}`)
      await t.page.goBack(); await t.sleep(500)
    }
    await t.ctx.close()
  }

  // ---- FAQs: all ten questions in sight on a phone with its browser's bars showing; where the screen is too short
  // for them all they scroll, and the list fades out at the end there is more past, so that it reads as going on ----
  for (const [w, h, allFit] of [[402, 700, true], [393, 660, false], [375, 667, false], [320, 568, false]]) {
    t = await A.open(browser, { device: { w, h, touch: true, dpr: 1 }, base: BASE, query: 'still' })
    await home(t)
    await A.at(t.page, null, [], 'folder:faqs')
    const list = () => t.page.evaluate(() => {
      const el = document.querySelector('.sb-open__notes'); const r = el.getBoundingClientRect(); const cs = getComputedStyle(el)
      const rows = [...el.children].map((c) => { const b = c.getBoundingClientRect(); return b.bottom <= r.bottom + 0.5 && b.top >= r.top - 0.5 ? 'whole' : b.top >= r.bottom || b.bottom <= r.top ? 'hidden' : 'cut' })
      return { rows: rows.length, whole: rows.filter((x) => x === 'whole').length, scrolls: el.scrollHeight > el.clientHeight + 1, more: el.dataset.more ?? null, fades: [cs.maskImage, cs.webkitMaskImage].some((m) => /gradient/.test(m || '')) }
    })
    let l = await list()
    if (allFit) check(`${w}x${h}: all ten questions are in sight in the FAQs folder, none of them cut`, l.rows === 10 && l.whole === 10 && !l.scrolls && l.more === null && !l.fades, JSON.stringify(l))
    else if (!l.scrolls) check(`${w}x${h}: all ten questions fit`, l.whole === 10 && l.more === null, JSON.stringify(l))
    else {
      check(`${w}x${h}: the questions scroll, and the list fades out at its foot to say there are more`, l.more === 'below' && l.fades, JSON.stringify(l))
      await t.page.evaluate(() => { const el = document.querySelector('.sb-open__notes'); el.scrollTop = el.scrollHeight }); await t.sleep(250)
      l = await list()
      check(`${w}x${h}: …scrolled to its end, it fades at its head instead`, l.more === 'above' && l.fades, JSON.stringify(l))
    }
    if (w === 320) await A.shot(t.page, 'fix-s2-faqs-scrolled')
    await t.ctx.close()
  }

  // ---- raised text spacing: the FAQs face still shows whole titles only ----
  for (const [w, h] of [[393, 760], [360, 640], [760, 340]]) {
    t = await A.open(browser, { device: { w, h, touch: true, dpr: 1 }, base: BASE, query: 'still&phone=hand' })
    await home(t)
    await t.page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }' })
    await t.sleep(400)
    const face = await t.page.evaluate(() => {
      const f = document.querySelector('.sb-folder__face[data-folder="faqs"]')
      const box = f.querySelector('.sb-folder__titles').getBoundingClientRect()
      const spans = [...f.querySelectorAll('.sb-folder__titles span')].map((s) => s.getBoundingClientRect())
      // drawn at all = starts before the box's right edge; whole = ends inside it, and its foot is inside too
      const drawn = spans.filter((r) => r.width > 0 && r.left < box.right - 0.5)
      return { drawn: drawn.length, cut: drawn.filter((r) => r.right > box.right + 0.5 || r.bottom > box.bottom + 0.5).length, past: Math.round(f.getBoundingClientRect().right - box.right) }
    })
    check(`AX-26 ${w}x${h} with raised text spacing: every title drawn is whole`, face.drawn >= 1 && face.cut === 0, JSON.stringify(face))
    if (w === 393) await A.shot(t.page, 'fix-s2-spacing-home')
    await t.ctx.close()
  }

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'open: all ok')
  process.exit(failed ? 1 : 0)
})()
