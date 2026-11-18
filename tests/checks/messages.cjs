// Fixer M: every Messages fix, on both layouts. Exits non-zero if one fails.
//   node messages.cjs [base]        (default http://127.0.0.1:5173/; the production build is :4173)
//   node messages.cjs [base] desk|phone|keep    (one part only)
const A = require('./lib.cjs')
const path = require('path')
const fs = require('fs')
const BASE = process.argv[2] && /^https?:/.test(process.argv[2]) ? process.argv[2] : process.env.BASE || 'http://127.0.0.1:5173/'
const ONLY = process.argv.slice(2).find((a) => !/^https?:/.test(a))
const OUT = path.join(A.S, 'fixm')
fs.mkdirSync(OUT, { recursive: true })

let failed = 0
const say = (ok, name, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail && !ok ? `  (${detail})` : ''}`)
}
const W = '.wf[data-app="messages"]'
const F = '.sb-slot[data-front]'
const pick = async (page, id, label) => {
  await page.locator(`[data-menu-title="${id}"]`).click()
  await page.waitForTimeout(200)
  await page.locator(`[data-menu="${id}"] [data-menu-item]`, { hasText: label }).first().click()
  await page.waitForTimeout(650)
}
const active = (page) => page.evaluate(() => `${document.activeElement?.tagName.toLowerCase()}.${String(document.activeElement?.className || '').split(' ')[0]}`)
const replies = (page, root) => page.evaluate((root) => document.querySelectorAll(`${root} .chat__thread [data-person]:not([data-typing])`).length, root)

async function desk(browser) {
  // ---- a message of the visitor's own: says why it did not go, and the keyboard is where it should be
  let t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still' })
  let p = t.page
  await p.waitForSelector(`${W} .composer__input`, { timeout: 20000 })
  await p.waitForFunction((W) => document.querySelectorAll(`${W} .chat__thread [data-person]`).length >= 1, W, { timeout: 30000 })

  // AX-8 / AX-22: whose bubble is whose; the dots are a picture with a name; the log is silent with a status line beside it
  const dots = await p.evaluate((W) => { const d = document.querySelector(`${W} .ss-bubble__dots`); return d ? { role: d.getAttribute('role'), label: d.getAttribute('aria-label') } : null }, W)
  say(!dots || (dots.role === 'img' && /is typing$/.test(dots.label)), 'AX-8/22 typing dots are a picture named "… is typing"', JSON.stringify(dots))
  await p.waitForFunction((W) => document.querySelectorAll(`${W} .chat__thread [data-person]:not([data-typing])`).length >= 2, W, { timeout: 30000 })
  const tree = await p.evaluate((W) => {
    const bubbles = [...document.querySelectorAll(`${W} .chat__thread .ss-bubble`)]
    return {
      mine: bubbles.filter((b) => b.parentElement.dataset.from === 'me').map((b) => `${b.getAttribute('role')}:${b.getAttribute('aria-label')}`),
      theirs: bubbles.filter((b) => b.dataset.person !== undefined).map((b) => `${b.getAttribute('role')}:${b.getAttribute('aria-label')}`),
      who: [...document.querySelectorAll(`${W} .chat-who`)].every((w) => w.getAttribute('aria-hidden') === 'true'),
      log: document.querySelector(`${W} .chat__scroll`).getAttribute('aria-live'),
      status: !!document.querySelector(`${W} .chat__pane > [role="status"]`),
      dir: [...document.querySelectorAll(`${W} .ss-bubble__text`)].every((x) => x.getAttribute('dir') === 'auto'),
      strays: document.querySelectorAll(`${W} .ss-bubble__text[role], ${W} .ss-bubble__text[aria-label]`).length,
      initials: [...document.querySelectorAll(`${W} .ss-avatar`)].every((a) => a.getAttribute('aria-hidden') === 'true' || a.closest('[aria-hidden="true"]')),
    }
  }, W)
  say(tree.mine.every((m) => m === 'group:Shrug') && tree.theirs[0] === 'group:Kevin Olusola, 1/5 of Pentatonix' && tree.who, 'AX-8 each bubble is a group named for who is speaking; the line over it is for the eye only', JSON.stringify(tree))
  say(tree.log === 'off' && tree.status, 'AX-8 the log stays silent, with a status line beside it')
  say(tree.strays === 0, 'AX-22 words that grew out of the dots are words, not a picture', String(tree.strays))
  const firstTold = await p.evaluate((W) => document.querySelector(`${W} .chat__pane > [role="status"]`).textContent.trim(), W)
  say(firstTold === 'Kevin Olusola replied.', 'AX-8 the first reply is said, and not each one after it', firstTold)
  say(tree.dir, 'MK-17 every bubble finds its own text direction')
  say(tree.initials, 'AX-23 initials are never read out before a name')
  say((await p.getAttribute(`${W} .composer__input`, 'dir')) === 'auto', 'MK-17 the message field finds its own direction')
  // nothing moves under the checks that follow
  await pick(p, 'view', 'Pause Replies')

  // tb-10 / AX-7: sending leaves the caret in the field, by Return and by the button
  await p.fill(`${W} .composer__input`, 'hello from a visitor')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(900)
  say((await active(p)) === 'input.composer__input', 'AX-7 after Return the caret is in the field', await active(p))
  await p.fill(`${W} .composer__input`, 'and again')
  await p.click(`${W} .composer__send`)
  await p.waitForTimeout(900)
  say((await active(p)) === 'input.composer__input', 'tb-10 the send button does not take the caret', await active(p))
  const told = await p.evaluate((W) => document.querySelector(`${W} .chat__pane > [role="status"]`).textContent.trim(), W)
  say(/^Not Delivered/.test(told), 'AX-s a message that did not go is said in the status line', told)

  // UX-2: the line is a button; it and the red mark open the same thing
  const line = await p.evaluate((W) => { const b = document.querySelector(`${W} .chat-undelivered`); return { tag: b?.tagName, text: b?.textContent, popup: b?.getAttribute('aria-haspopup'), color: b && getComputedStyle(b).color } }, W)
  say(line.tag === 'BUTTON' && line.text === 'Not Delivered' && line.popup === 'dialog', 'UX-2 "Not Delivered" is a button', JSON.stringify(line))
  say(line.color === 'rgb(215, 0, 21)', 'AX-15 its red passes on white (#d70015)', line.color)
  await p.locator(`${W} .chat-undelivered`).first().click()
  await p.waitForTimeout(500)
  const why = await p.evaluate((W) => {
    const w = document.querySelector(`${W} .chat-why`)
    const acts = [...w.querySelectorAll('.chat-why__act')]
    return { show: w.hasAttribute('data-show'), role: w.getAttribute('role'), label: w.getAttribute('aria-label'), title: w.querySelector('.chat-why__title')?.textContent, say: w.querySelector('.chat-why__say')?.textContent, acts: acts.map((a) => a.textContent.replace(/, opens in a new tab/, '').trim()), doc: acts.find((a) => /One-pager/.test(a.textContent))?.getAttribute('href'), tab: acts.find((a) => /One-pager/.test(a.textContent))?.getAttribute('target'), focusIn: w.contains(document.activeElement) }
  }, W)
  say(why.show && why.role === 'dialog' && why.title === 'Not Delivered' && /recording of what people said about Shrug/.test(why.say) && why.acts.join('|') === 'Read the One-pager|Delete Message' && /docsend/.test(why.doc) && why.tab === '_blank', 'UX-2 desktop: a popover that says why, with the one-pager and Delete Message', JSON.stringify(why))
  say(why.focusIn, 'UX-2 the keyboard goes into it')
  await p.screenshot({ path: path.join(OUT, 'desk-why.png') })
  await p.keyboard.press('Escape')
  await p.waitForTimeout(450)
  say(!(await p.locator(`${W} .chat-why[data-show]`).count()) && (await active(p)) === 'button.chat-undelivered', 'UX-2 Escape closes it and the keyboard goes back to the line', await active(p))
  // the red mark beside the bubble
  const mark = await p.evaluate((W) => { const row = [...document.querySelectorAll(`${W} .chat-failed`)].pop(); const b = row.querySelector('.ss-bubble').getBoundingClientRect(); return { x: b.right + 16, y: b.top + b.height / 2 } }, W)
  await p.mouse.click(mark.x, mark.y)
  await p.waitForTimeout(450)
  say((await p.locator(`${W} .chat-why[data-show]`).count()) === 1, 'UX-2 the red mark opens the same thing')
  const before = await p.locator(`${W} .chat-failed`).count()
  await p.locator(`${W} .chat-why__act`, { hasText: 'Delete Message' }).click()
  await p.waitForTimeout(600)
  say((await p.locator(`${W} .chat-failed`).count()) === before - 1 && !(await p.locator(`${W} .chat-why[data-show]`).count()), 'UX-2 Delete Message takes the bubble away', `${before} -> ${await p.locator(`${W} .chat-failed`).count()}`)

  // tb-6: what is typed and not sent is kept with its conversation
  await p.fill(`${W} .composer__input`, 'half a thought')
  await p.click(`${W} [data-conversation="mom"]`)
  await p.waitForTimeout(500)
  const inMom = await p.inputValue(`${W} .composer__input`)
  await p.click(`${W} [data-conversation="group"]`)
  await p.waitForTimeout(500)
  say(inMom === '' && (await p.inputValue(`${W} .composer__input`)) === 'half a thought', 'tb-6 a draft stays with its conversation', `${inMom} / ${await p.inputValue(`${W} .composer__input`)}`)
  await p.fill(`${W} .composer__input`, '')

  // AX-11 / AX-5: the list says which row is active, and shows it
  await p.focus(`${W} .conv-list`)
  await p.keyboard.press('ArrowDown')
  await p.waitForTimeout(400)
  const list = await p.evaluate((W) => { const l = document.querySelector(`${W} .conv-list`); const sel = l.querySelector('.conv[data-selected]'); return { ad: l.getAttribute('aria-activedescendant'), id: sel?.id, role: sel?.getAttribute('role'), ring: sel && getComputedStyle(sel).boxShadow } }, W)
  say(!!list.ad && list.ad === list.id && list.role === 'option', 'AX-11 the list points at its active row', JSON.stringify(list))
  say(/inset/.test(list.ring) && /255, 255, 255/.test(list.ring), 'AX-5 the active row is ringed in white inside its blue', list.ring)
  await p.keyboard.press('ArrowUp')
  await p.waitForTimeout(300)

  // DK-5 / AX-22: search is of what has been said; nothing found is said outside the list
  await p.fill(`${W} .search__input`, 'janky')
  await p.waitForTimeout(400)
  const none = await p.evaluate((W) => { const l = document.querySelector(`${W} .conv-list`); const n = document.querySelector(`${W} .conv-none`); return { rows: l.querySelectorAll('[data-row]').length, strays: [...l.children].filter((c) => !c.matches('[role="option"], [role="group"]')).length, none: n?.textContent.trim(), role: n?.getAttribute('role'), inList: !!l.querySelector('.conv-none, .side-empty') } }, W)
  say(none.rows === 0 && none.none === 'No Results', 'DK-5 someone who has not replied yet is not found', JSON.stringify(none))
  say(none.role === 'status' && !none.inList && none.strays === 0, 'AX-22 "No Results" is a status outside the listbox', JSON.stringify(none))
  await p.fill(`${W} .search__input`, 'pentatonix')
  await p.waitForTimeout(400)
  say((await p.locator(`${W} [data-row="p:0"]`).count()) === 1, 'DK-5 someone who has replied is found')
  // DK-10: Return opens the first thing found; the down arrow goes into the list
  await p.fill(`${W} .search__input`, 'mom')
  await p.waitForTimeout(300)
  await p.keyboard.press('Enter')
  await p.waitForTimeout(500)
  say((await p.textContent(`${W} .chat-id__name span`)) === 'Mom', 'DK-10 Return in the search opens the first conversation found', await p.textContent(`${W} .chat-id__name span`))
  await p.keyboard.press('ArrowDown')
  await p.waitForTimeout(300)
  say((await active(p)) === 'div.conv-list', 'DK-10 the down arrow goes into the list', await active(p))
  // UX-19: one wording for a link that leaves
  await p.fill(`${W} .search__input`, '')
  await p.click(`${W} [data-conversation="unknown"]`)
  await p.waitForTimeout(500)
  say((await p.textContent(`${W} a.chat-link .sr-only`)) === ', opens in a new tab', 'UX-19 a link bubble says ", opens in a new tab"')
  // UX-25: the verification joke
  const eggs = await p.evaluate((W) => [...document.querySelectorAll(`${W} .conv .ss-row__title`)].map((x) => x.textContent))
  await p.click(`${W} [data-conversation="code"]`)
  await p.waitForTimeout(500)
  const code = await p.evaluate((W) => document.querySelector(`${W} .chat__thread`).innerText, W)
  say(!eggs.some((n) => /72975/.test(n)) && /nothing to verify/.test(code) && !/000000/.test(code), 'UX-25 no real-looking short code or one-time code', JSON.stringify(eggs))
  await p.click(`${W} [data-conversation="group"]`)
  await p.waitForTimeout(500)

  // AX-12 / AX-7: the + menu from the keyboard
  await p.focus(`${W} .composer__plus`)
  await p.keyboard.press('Enter')
  await p.waitForTimeout(350)
  const first = await p.evaluate(() => document.activeElement?.textContent.trim())
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown')
  const third = await p.evaluate(() => document.activeElement?.textContent.trim())
  await p.keyboard.press('End')
  const last = await p.evaluate(() => document.activeElement?.textContent.trim())
  await p.keyboard.press('Home')
  const home = await p.evaluate(() => document.activeElement?.textContent.trim())
  await p.keyboard.press('Escape')
  await p.waitForTimeout(350)
  say(first === 'Portfolio' && third === 'Case Studies' && /^One-pager/.test(last) && home === 'Portfolio', 'AX-12 the + menu answers Enter, the arrows, Home and End', [first, third, last, home].join(' | '))
  say((await active(p)) === 'button.composer__plus' && (await p.getAttribute(`${W} .composer__plus`, 'aria-expanded')) === 'false', 'AX-7 Escape puts it away and gives the keyboard back to the +', await active(p))
  say(/, opens in a new tab$/.test(last), 'UX-19 the + menu’s One-pager says ", opens in a new tab"', last)

  // AX-7 / AX-23: details take the keyboard in and give it back; ninety people are one stop
  await p.click(`${W} .chat-id`)
  await p.waitForTimeout(500)
  const det = await p.evaluate((W) => { const d = document.querySelector(`${W} .chat-details`); return { in: d.contains(document.activeElement), on: document.activeElement?.textContent.trim(), stops: d.querySelectorAll('.details__person[tabindex="0"]').length, people: d.querySelectorAll('.details__person').length, name: document.querySelector(`${W} .chat-id`).getAttribute('aria-label'), dialog: d.getAttribute('aria-label') } }, W)
  say(det.in && det.on === 'Pause Replies', 'AX-7 details take the keyboard in, on their first control', JSON.stringify(det))
  say(det.stops === 1 && det.people === 90, 'AX-7 ninety people are one Tab stop', `${det.stops} of ${det.people}`)
  say(det.name === 'Shrug Family. Details' && det.dialog === 'Shrug Family details', 'AX-23 one name for Details', `${det.name} / ${det.dialog}`)
  await p.focus(`${W} .details__person[tabindex="0"]`)
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown')
  say((await p.evaluate(() => document.activeElement?.getAttribute('data-person-row'))) === '2', 'AX-7 the arrows walk the people')
  await p.keyboard.press('Escape')
  await p.waitForTimeout(450)
  say((await active(p)) === 'button.chat-id', 'AX-7 Escape closes details and the keyboard goes back to the name', await active(p))

  // AX-10: the thread shows where the keyboard is; the pill hands the keyboard to the thread
  await p.focus(`${W} .composer__plus`)
  // back through whatever can be pressed inside the thread, to the thread itself
  for (let i = 0; i < 8 && (await active(p)) !== 'div.chat__scroll'; i++) await p.keyboard.press('Shift+Tab')
  await p.waitForTimeout(200)
  const ring = await p.evaluate((W) => ({ on: document.activeElement?.className, shadow: getComputedStyle(document.querySelector(`${W} .chat__pane`), '::after').boxShadow }), W)
  say(ring.on === 'chat__scroll' && /inset/.test(ring.shadow), 'AX-10 the thread is ringed when it has the keyboard', JSON.stringify(ring))

  // DK-4: a message sent after scrolling back comes into view
  await pick(p, 'view', 'Show Every Reply')
  await p.waitForTimeout(1200)
  const allTold = await p.evaluate((W) => document.querySelector(`${W} .chat__pane > [role="status"]`).textContent.trim(), W)
  say(allTold === 'All 90 have replied.', 'AX-8 …and that everyone has', allTold)
  await p.evaluate((W) => { const s = document.querySelector(`${W} .chat__scroll`); s.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -900 })); s.scrollTop = 600 }, W)
  await p.waitForTimeout(500)
  say((await p.locator(`${W} .chat__new[data-show]`).count()) === 1, 'DK-4 (setup) scrolled back: the pill shows')
  await p.fill(`${W} .composer__input`, 'sent from far up')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(1400)
  const seen = await p.evaluate((W) => { const s = document.querySelector(`${W} .chat__scroll`); const b = [...document.querySelectorAll(`${W} .chat-failed`)].pop().getBoundingClientRect(); const r = s.getBoundingClientRect(); return { inView: b.top >= r.top && b.bottom <= r.bottom + 1, fromEnd: Math.round(s.scrollHeight - s.scrollTop - s.clientHeight), pill: !!document.querySelector(`${W} .chat__new[data-show]`) } }, W)
  say(seen.inView && !seen.pill, 'DK-4 a message sent after scrolling back comes into view', JSON.stringify(seen))
  // AX-10: pressing the pill puts the keyboard on the thread
  await p.evaluate((W) => { const s = document.querySelector(`${W} .chat__scroll`); s.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -900 })); s.scrollTop = 600 }, W)
  await p.waitForTimeout(500)
  await p.focus(`${W} .chat__new`)
  await p.keyboard.press('Enter')
  await p.waitForTimeout(900)
  say((await active(p)) === 'div.chat__scroll', 'AX-10 the pill hands the keyboard to the thread', await active(p))

  // UX-23: where to go once everyone has replied
  const end = await p.evaluate((W) => {
    const rows = [...document.querySelectorAll(`${W} .chat__thread > *`)]
    const at = rows.findIndex((r) => r.textContent.trim() === 'anyway.')
    const after = rows.slice(at, at + 4)
    return { at, said: after.map((r) => (r.classList.contains('ss-receipt') ? 'receipt' : r.querySelector('.chat-link') ? `${r.querySelector('.chat-link').tagName}:${r.querySelector('.chat-link').textContent.replace(/, opens in a new tab/, '')}` : r.textContent.trim())), shrugBefore: rows[at - 1]?.textContent.trim(), people: document.querySelectorAll(`${W} .chat__thread [data-person]`).length }
  }, W)
  say(end.at > 0 && end.shrugBefore === '¯\\_(ツ)_/¯' && end.said.join(' | ') === 'anyway. | BUTTON:See the portfolio | A:Read the one-pager | receipt' && end.people === 90, 'UX-23 after the shrug: "anyway." and the two ways on, under them "Delivered"', JSON.stringify(end))
  await p.evaluate((W) => document.querySelector(`${W} .chat__scroll`).scrollTo(0, 1e7), W)
  await p.locator(`${W} button.chat-link`, { hasText: 'See the portfolio' }).click()
  await p.waitForTimeout(900)
  say((await p.locator('.wf[data-app="finder"]').count()) === 1, 'UX-23 "See the portfolio" opens Portfolio')
  say(A.realErrors(t.errors).length === 0, 'desktop: no console errors', A.realErrors(t.errors).join(' | ').slice(0, 300))
  await t.ctx.close()

  // ---- DK-16: replies that land where nobody can see them are new
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still' })
  p = t.page
  await p.waitForSelector(`${W} .composer__input`, { timeout: 20000 })
  await p.waitForFunction((W) => document.querySelectorAll(`${W} .chat__thread [data-person]:not([data-typing])`).length >= 1, W, { timeout: 30000 })
  await p.locator('.dock__item[data-dock-app="finder"]').click()
  await p.waitForTimeout(700)
  const beside = await replies(p, W)
  await p.waitForFunction(([W, n]) => document.querySelectorAll(`${W} .chat__thread [data-person]:not([data-typing])`).length >= n + 2, [W, beside], { timeout: 30000 })
  say(!(await p.locator('.dock__badge').count()), 'DK-16 a window in front that leaves the chat in sight: nothing is new', await p.locator('.dock__badge').count() ? await p.textContent('.dock__badge') : '')
  await pick(p, 'window', 'Fill')
  const covered = await replies(p, W)
  await p.waitForFunction(([W, n]) => document.querySelectorAll(`${W} .chat__thread [data-person]:not([data-typing])`).length >= n + 2, [W, covered], { timeout: 30000 })
  const badge = (await p.locator('.dock__badge').count()) ? Number(await p.textContent('.dock__badge')) : 0
  say(badge >= 2, 'DK-16 wholly covered by another window: the Dock counts what comes in', String(badge))
  await t.ctx.close()

  // ---- DK-8: half a small screen keeps the list; narrower, the list is a pane of its own
  t = await A.open(browser, { device: 'laptop', base: BASE, query: 'still' })
  p = t.page
  await p.waitForSelector(`${W} .composer__input`, { timeout: 20000 })
  await pick(p, 'window', 'Left Half')
  const half = await p.evaluate((W) => { const w = document.querySelector(W).getBoundingClientRect(); const s = document.querySelector(`${W} .chat-side`); const r = s.getBoundingClientRect(); return { width: Math.round(w.width), side: Math.round(r.width), rows: s.querySelectorAll('.conv').length, search: !!s.querySelector('.search__input'), back: getComputedStyle(document.querySelector(`${W} .chat-back`)).display, pane: Math.round(document.querySelector(`${W} .chat__pane`).getBoundingClientRect().width) } }, W)
  say(half.width < 640 && half.side > 150 && half.rows === 6 && half.search && half.back === 'none' && half.pane > 300, 'DK-8 tiled to half of 1280 the chat keeps its list and search', JSON.stringify(half))
  await p.screenshot({ path: path.join(OUT, 'desk-half.png') })
  await t.ctx.close()
  t = await A.open(browser, { device: { w: 900, h: 700, dpr: 1 }, base: BASE, query: 'still' })
  p = t.page
  await p.waitForSelector(`${W} .composer__input`, { timeout: 20000 })
  await pick(p, 'window', 'Left Half')
  const folded = await p.evaluate((W) => ({ width: Math.round(document.querySelector(W).getBoundingClientRect().width), side: getComputedStyle(document.querySelector(`${W} .ss-window__side`)).display, back: getComputedStyle(document.querySelector(`${W} .chat-back`)).display, label: document.querySelector(`${W} .chat-back`).getAttribute('aria-label') }), W)
  say(folded.width < 560 && folded.side === 'none' && folded.back !== 'none' && folded.label === 'Conversations', 'DK-8 folded (under 560): the conversation, with the way to the list in its bar', JSON.stringify(folded))
  await p.click(`${W} .chat-back`)
  await p.waitForTimeout(400)
  const listing = await p.evaluate((W) => ({ side: getComputedStyle(document.querySelector(`${W} .ss-window__side`)).display, main: getComputedStyle(document.querySelector(`${W} .ss-window__main`)).display, rows: document.querySelectorAll(`${W} .conv`).length, wide: Math.round(document.querySelector(`${W} .chat-side`).getBoundingClientRect().width) }), W)
  say(listing.side !== 'none' && listing.main === 'none' && listing.rows === 6 && listing.wide > 350, 'DK-8 the list is a pane of its own', JSON.stringify(listing))
  await p.screenshot({ path: path.join(OUT, 'desk-folded-list.png') })
  await p.click(`${W} [data-conversation="mom"]`)
  await p.waitForTimeout(400)
  const back = await p.evaluate((W) => ({ main: getComputedStyle(document.querySelector(`${W} .ss-window__main`)).display, name: document.querySelector(`${W} .chat-id__name span`).textContent }), W)
  say(back.main !== 'none' && back.name === 'Mom', 'DK-8 picking a conversation goes to it', JSON.stringify(back))
  say(A.realErrors(t.errors).length === 0, 'narrow desktop: no console errors', A.realErrors(t.errors).join(' | ').slice(0, 300))
  await t.ctx.close()

  // ---- tb-8 / tb-9: finger sizes where there is a touch screen
  t = await A.open(browser, { device: 'ipad-land', base: BASE, query: 'still' })
  p = t.page
  await p.waitForSelector(`${W} .composer__input`, { timeout: 20000 })
  await p.fill(`${W} .composer__input`, 'x')
  await p.waitForTimeout(500)
  const sizes = await p.evaluate((W) => {
    const box = (sel) => { const r = document.querySelector(`${W} ${sel}`).getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] }
    const hit = (sel) => { const el = document.querySelector(`${W} ${sel}`); const r = el.getBoundingClientRect(); const a = getComputedStyle(el, '::after'); const grow = a.content !== 'none' ? -parseFloat(a.top) - parseFloat(a.bottom) : 0; return Math.round(r.height + grow) }
    return { coarse: matchMedia('(any-pointer: coarse)').matches, plus: box('.composer__plus'), send: hit('.composer__send'), pill: Math.round(parseFloat(getComputedStyle(document.querySelector(`${W} .chat__new`)).height)) }
  }, W)
  say(sizes.coarse && sizes.plus[0] >= 36 && sizes.plus[1] >= 36 && sizes.send >= 36 && sizes.pill >= 36, 'tb-8/9 on a touch screen the +, send and the pill are 36px or more', JSON.stringify(sizes))
  await t.ctx.close()

  // ---- tb-6: what is typed and not sent goes with the visitor across a change of layout
  t = await A.open(browser, { device: 'ipad-land', base: BASE, query: 'still' })
  p = t.page
  await p.waitForSelector(`${W} .composer__input`, { timeout: 20000 })
  await p.fill(`${W} .composer__input`, 'half a thought')
  await p.evaluate(() => document.activeElement?.blur())
  await p.setViewportSize({ width: 600, height: 900 })
  await p.waitForSelector(`${F} .msg-field__input`, { timeout: 20000 })
  await p.waitForTimeout(900)
  const onPhone = await p.inputValue(`${F} .ios-page[data-pos="top"] .msg-field__input`)
  await p.setViewportSize({ width: 1180, height: 820 })
  await p.waitForSelector(`${W} .composer__input`, { timeout: 20000 })
  await p.waitForTimeout(700)
  say(onPhone === 'half a thought' && (await p.inputValue(`${W} .composer__input`)) === 'half a thought', 'tb-6 a draft goes with the visitor to the iPhone and back', `${onPhone} / ${await p.inputValue(`${W} .composer__input`)}`)
  await t.ctx.close()

  // ---- AX-14: under reduced motion the conversation is whole, read from its top, and none of it is new
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still', reducedMotion: true })
  p = t.page
  await p.waitForSelector(`${W} .composer__input`, { timeout: 20000 })
  await p.waitForTimeout(1200)
  const whole = await p.evaluate((W) => { const s = document.querySelector(`${W} .chat__scroll`); return { replies: document.querySelectorAll(`${W} .chat__thread [data-person]`).length, top: s.scrollTop, pill: document.querySelector(`${W} .chat__new[data-show]`)?.textContent.trim(), badge: document.querySelector('.dock__badge')?.textContent ?? null, next: !!document.querySelector(`${W} button.chat-link`) } }, W)
  say(whole.replies === 90 && whole.top === 0 && whole.pill === 'Latest' && whole.badge === null && whole.next, 'AX-14 reduced motion: all ninety, from the top, "Latest" offered, nothing unread', JSON.stringify(whole))
  await t.ctx.close()
  t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still', reducedMotion: true })
  p = t.page
  await A.unlock(p)
  await p.waitForTimeout(600)
  const homeBadge = await p.evaluate(() => document.querySelector('.sb-dock .sb-badge')?.textContent ?? null)
  await A.at(p, 'messages', ['c:group'])
  await p.waitForTimeout(600)
  const there = await p.evaluate((F) => { const s = document.querySelector(`${F} .chat__scroll`); return { top: s.scrollTop, pill: document.querySelector(`${F} .chat__new[data-show]`)?.textContent.trim(), replies: document.querySelectorAll(`${F} .chat__thread [data-person]`).length } }, F)
  say(homeBadge === null && there.top === 0 && there.pill === 'Latest' && there.replies === 90, 'AX-14 on the iPhone too: no badge of ninety, and the conversation from its top', JSON.stringify({ homeBadge, ...there }))
  await t.ctx.close()
}

async function phone(browser) {
  let t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still' })
  let p = t.page
  await A.unlock(p)
  // UX-19: counted in words that agree (before anyone has replied, and after one)
  await A.at(p, 'messages', ['c:group'], 'details')
  const foot = () => p.evaluate((F) => [...document.querySelectorAll(`${F} .ios-sheet .ios-section__footer, ${F} .ios-sheet [class*="footer"]`)].map((x) => x.textContent.trim()).find((x) => /replied/.test(x)) ?? null, F)
  const f0 = await foot()
  await p.waitForFunction(() => /^1 of 90/.test([...document.querySelectorAll('.ios-sheet *')].map((x) => (x.children.length ? '' : x.textContent)).find((x) => /of 90/.test(x)) || ''), null, { timeout: 30000 }).catch(() => {})
  const f1 = await foot()
  say(/^(No one has replied yet\.|1 of 90 has replied so far\.)$/.test(f0 || '') && (f1 === null || /^\d+ of 90 ha(s|ve) replied so far\.$/.test(f1)) && !/^1 of 90 have/.test(f1 || ''), 'UX-19 "No one has replied yet." / "1 of 90 has replied so far."', `${f0} -> ${f1}`)
  await A.at(p, 'messages', ['c:group'])

  // AX-23: one control for Details; the camera is FaceTime
  const head = await p.evaluate((F) => ({ name: document.querySelector(`${F} .msg-head`)?.textContent.replace(/\s+/g, ' ').trim(), cam: document.querySelector(`${F} .ios-bar [aria-label="FaceTime"]`) ? 'FaceTime' : null, twins: document.querySelectorAll(`${F} [aria-label$="details"]`).length }), F)
  say(head.name === 'Shrug Family. Details' && head.cam === 'FaceTime' && head.twins === 0, 'AX-23 the name opens Details; the camera is named for what it is', JSON.stringify(head))

  // UX-17: FaceTime answers in character
  await p.locator(`${F} [aria-label="FaceTime"]`).tap()
  await p.waitForTimeout(700)
  const ft = await p.evaluate(() => { const a = document.querySelector('.msg-alert__box'); return { sheet: history.state?.shrug?.sheet, role: a?.getAttribute('role'), title: a?.querySelector('.msg-alert__title')?.textContent, say: a?.querySelector('.msg-alert__say')?.textContent, acts: [...(a?.querySelectorAll('.msg-alert__act') ?? [])].map((x) => x.textContent), focus: document.activeElement?.textContent } })
  say(ft.sheet === 'facetime' && ft.role === 'alertdialog' && ft.title === 'FaceTime Unavailable' && ft.say === 'Shrug Family is not available for FaceTime.' && ft.acts.join() === 'OK' && ft.focus === 'OK', 'UX-17 the camera: "FaceTime Unavailable"', JSON.stringify(ft))
  await p.screenshot({ path: path.join(OUT, 'phone-facetime.png') })
  await p.locator('.msg-alert__act').tap()
  await p.waitForTimeout(700)
  say((await A.state(p)).place.sheet === null && !(await p.locator('.msg-alert').count()), 'UX-17 OK closes it')
  await A.at(p, 'messages', ['c:mom'])
  await p.locator(`${F} [aria-label="FaceTime"]`).tap()
  await p.waitForTimeout(700)
  say((await p.textContent('.msg-alert__say')) === 'Mom is not available for FaceTime.', 'UX-17 in another conversation it is that person', await p.textContent('.msg-alert__say'))
  await p.goBack(); await p.waitForTimeout(700)
  say(!(await p.locator('.msg-alert:not([data-closing])').count()), 'UX-17 the browser’s Back closes it')

  // UX-2: a message that did not go, in another conversation too
  await p.fill(`${F} .msg-field__input`, 'hi mom')
  await p.locator(`${F} .msg-field__send`).tap()
  await p.waitForTimeout(900)
  say((await active(p)) === 'input.msg-field__input', 'tb-10 the phone’s send button does not take the caret', await active(p))
  await p.locator(`${F} .chat-undelivered`).tap()
  await p.waitForTimeout(700)
  const why = await p.evaluate(() => { const a = document.querySelector('.msg-alert__box'); return { sheet: history.state?.shrug?.sheet, title: a?.querySelector('.msg-alert__title')?.textContent, say: a?.querySelector('.msg-alert__say')?.textContent, acts: [...(a?.querySelectorAll('.msg-alert__act') ?? [])].map((x) => x.textContent.replace(/, opens in a new tab/, '')), doc: a?.querySelector('a.msg-alert__act')?.getAttribute('href'), focus: document.activeElement?.textContent } })
  say(/^undelivered:me-/.test(why.sheet) && why.title === 'Not Delivered' && /recording of what people said about Shrug/.test(why.say) && why.acts.join('|') === 'Read the One-pager|Delete Message|Cancel' && /docsend/.test(why.doc) && why.focus === 'Cancel', 'UX-2 phone: an alert that says why, with the one-pager, Delete Message and Cancel', JSON.stringify(why))
  await p.screenshot({ path: path.join(OUT, 'phone-why.png') })
  await p.locator('.msg-alert__act', { hasText: 'Cancel' }).tap()
  await p.waitForTimeout(700)
  say((await A.state(p)).place.sheet === null && (await p.locator(`${F} .chat-failed`).count()) === 1, 'UX-2 Cancel closes it; the message stays')
  // the red mark
  const mark = await p.evaluate((F) => { const b = document.querySelector(`${F} .chat-failed .ss-bubble`).getBoundingClientRect(); return [b.right + 18, b.top + b.height / 2] }, F)
  await p.touchscreen.tap(mark[0], mark[1])
  await p.waitForTimeout(700)
  say(/^undelivered:/.test((await A.state(p)).place.sheet || ''), 'UX-2 the red mark opens it too')
  await p.locator('.msg-alert__act', { hasText: 'Delete Message' }).tap()
  await p.waitForTimeout(900)
  say((await p.locator(`${F} .chat-failed`).count()) === 0 && (await A.state(p)).place.sheet === null, 'UX-2 Delete Message takes the bubble away')

  // MK-12 / tb-6: half a message survives Back and coming in again, and a look at another conversation
  await A.at(p, 'messages', ['c:group'])
  await p.fill(`${F} .msg-field__input`, 'half a mess')
  await p.locator(`${F} .msg-back`).tap()
  await p.waitForTimeout(900)
  await p.locator(`${F} [data-conversation="group"]`).tap()
  await p.waitForTimeout(1000)
  say((await p.inputValue(`${F} .ios-page[data-pos="top"] .msg-field__input`)) === 'half a mess', 'MK-12 half a message is still there after Back and in again', await p.inputValue(`${F} .ios-page[data-pos="top"] .msg-field__input`))
  say((await p.getAttribute(`${F} .ios-page[data-pos="top"] .msg-field__input`, 'dir')) === 'auto', 'MK-17 the phone’s field finds its own direction')
  await p.fill(`${F} .ios-page[data-pos="top"] .msg-field__input`, 'مرحبا')
  await p.locator(`${F} .ios-page[data-pos="top"] .msg-field__send`).tap()
  await p.waitForTimeout(900)
  const rtl = await p.evaluate((F) => { const x = [...document.querySelectorAll(`${F} .chat-failed .ss-bubble__text`)].pop(); return x ? getComputedStyle(x).direction : null }, F)
  say(rtl === 'rtl', 'MK-17 right-to-left words are laid out right to left', String(rtl))

  // DK-5 on the phone: search does not find people who have not replied
  await p.locator(`${F} .msg-back`).tap()
  await p.waitForTimeout(900)
  await p.fill(`${F} .ios-search__input`, 'janky')
  await p.waitForTimeout(500)
  say((await p.locator(`${F} .msg-row`).count()) === 0, 'DK-5 the phone’s search does not find someone who has not replied')
  await p.fill(`${F} .ios-search__input`, '')

  // MK-13: flicked out of the App Switcher, Messages starts over: nothing is still being looked for
  await p.fill(`${F} .ios-search__input`, 'mom')
  await p.waitForTimeout(400)
  const cdp = t.cdp
  const swipe = async ([x0, y0], [x1, y1], ms = 160, hold = 0) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] })
    const steps = Math.max(4, Math.round(ms / 16))
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps }] })
      await p.waitForTimeout(ms / steps)
    }
    if (hold) await p.waitForTimeout(hold)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  const b = [t.device.w / 2, t.device.h - 6]
  await p.evaluate(() => document.activeElement?.blur())
  await swipe(b, [b[0], b[1] - 150], 240, 450)
  await p.waitForTimeout(900)
  const card = await p.evaluate(() => { const c = document.querySelector('.sb-slot[data-app="messages"] .sb-card__hit'); if (!c) return null; const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })
  if (card) await swipe(card, [card[0] + 4, card[1] - 330], 80)
  await p.waitForTimeout(1300)
  const quit = await p.evaluate(() => !document.querySelector('.sb-slot[data-app="messages"]'))
  await p.locator('.sb-dock .sb-icon[aria-label^="Messages"]').tap()
  await p.waitForTimeout(1100)
  const after = await p.evaluate((F) => ({ q: document.querySelector(`${F} .ios-search__input`)?.value, rows: document.querySelectorAll(`${F} .msg-row`).length }), F)
  say(quit && after.q === '' && after.rows === 6, 'MK-13 flicked out of the switcher, Messages comes back with no search', JSON.stringify({ quit, ...after }))
  // UX-23 on the phone: the ways on, and the first of them opens Files
  await A.at(p, 'messages', ['c:group'], 'details')
  await p.locator(`${F} .ios-sheet .ios-cell`, { hasText: 'Show Every Reply' }).tap()
  await p.waitForTimeout(1500)
  const ways = await p.evaluate((F) => [...document.querySelectorAll(`${F} .ios-page[data-pos="top"] .chat-link`)].map((x) => `${x.tagName}:${x.textContent.replace(/, opens in a new tab/, '')}`), F)
  say(ways.join(' | ') === 'BUTTON:See the portfolio | A:Read the one-pager', 'UX-23 phone: the two ways on are there', ways.join(' | '))
  await p.locator(`${F} .ios-page[data-pos="top"] button.chat-link`).tap()
  await p.waitForTimeout(1200)
  say((await A.state(p)).front === 'finder', 'UX-23 phone: "See the portfolio" opens Files', JSON.stringify(await A.state(p)))

  say(A.realErrors(t.errors).length === 0, 'phone: no console errors', A.realErrors(t.errors).join(' | ').slice(0, 300))
  await t.ctx.close()

  // ---- the + menu and the alert from the keyboard (the iPhone in its frame, on a computer)
  t = await A.open(browser, { device: { w: 700, h: 900, dpr: 1 }, base: BASE, query: 'still' })
  p = t.page
  await A.unlock(p)
  await A.at(p, 'messages', ['c:group'])
  await p.focus(`${F} .msg-more__button`)
  await p.keyboard.press('Enter')
  await p.waitForTimeout(400)
  const m1 = await p.evaluate(() => document.activeElement?.textContent.trim())
  await p.keyboard.press('ArrowDown')
  const m2 = await p.evaluate(() => document.activeElement?.textContent.trim())
  await p.keyboard.press('Escape')
  await p.waitForTimeout(500)
  const m3 = await p.evaluate((F) => ({ on: document.activeElement?.className, open: document.querySelector(`${F} .msg-more__button`).getAttribute('aria-expanded'), place: history.state?.shrug?.stacks?.messages?.join() }), F)
  say(m1 === 'Portfolio' && m2 === 'FAQs' && /msg-more__button/.test(m3.on) && m3.open === 'false' && m3.place === 'c:group', 'AX-12/AX-7 the phone’s + menu: Enter, the arrows, Escape back to the +, the screen stays', JSON.stringify([m1, m2, m3]))
  await p.focus(`${F} [aria-label="FaceTime"]`)
  await p.keyboard.press('Enter')
  await p.waitForTimeout(600)
  await p.keyboard.press('Tab')
  const trapped = await p.evaluate(() => !!document.activeElement?.closest('.msg-alert__box'))
  await p.keyboard.press('Escape')
  await p.waitForTimeout(700)
  const backOn = await p.evaluate(() => ({ on: document.activeElement?.getAttribute('aria-label'), sheet: history.state?.shrug?.sheet, place: history.state?.shrug?.stacks?.messages?.join() }))
  say(trapped && backOn.on === 'FaceTime' && backOn.sheet === null && backOn.place === 'c:group', 'UX-17 the alert keeps Tab, closes on Escape alone, and gives the keyboard back', JSON.stringify({ trapped, ...backOn }))
  say(A.realErrors(t.errors).length === 0, 'framed phone: no console errors', A.realErrors(t.errors).join(' | ').slice(0, 300))
  await t.ctx.close()
}

async function keep(browser) {
  // ---- RS-17 / MK-7: a reload comes back with what had been said, the visitor's own included, and carries on
  for (const device of ['desktop', 'iphone']) {
    const t = await A.open(browser, { device, base: BASE, query: 'still' })
    const p = t.page
    const root = device === 'desktop' ? W : F
    const field = device === 'desktop' ? `${W} .composer__input` : `${F} .msg-field__input`
    if (device === 'iphone') { await A.unlock(p); await A.at(p, 'messages', ['c:group']) }
    await p.waitForSelector(field, { timeout: 20000 })
    await p.waitForFunction((root) => document.querySelectorAll(`${root} .chat__thread [data-person]:not([data-typing])`).length >= 2, root, { timeout: 40000 })
    await p.fill(field, 'kept across a reload')
    await p.keyboard.press('Enter')
    await p.waitForFunction((root) => document.querySelectorAll(`${root} .chat__thread [data-person]:not([data-typing])`).length >= 3, root, { timeout: 40000 })
    await p.fill(field, 'not sent yet')
    const before = await p.evaluate((root) => [...document.querySelectorAll(`${root} .chat__thread > .ss-bubble-row`)].map((r) => (r.classList.contains('chat-failed') ? 'mine' : r.querySelector('[data-person]') ? `p${r.querySelector('[data-person]').dataset.person}` : 'shrug')).filter((x) => x !== 'shrug'), root)
    await p.reload({ waitUntil: 'load' })
    await p.waitForSelector(field, { timeout: 20000 })
    await p.waitForTimeout(700)
    const after = await p.evaluate((root) => ({
      order: [...document.querySelectorAll(`${root} .chat__thread > .ss-bubble-row`)].filter((r) => !r.querySelector('[data-typing]')).map((r) => (r.classList.contains('chat-failed') ? 'mine' : r.querySelector('[data-person]') ? `p${r.querySelector('[data-person]').dataset.person}` : 'shrug')).filter((x) => x !== 'shrug'),
      mine: document.querySelector(`${root} .chat-failed .ss-bubble__text`)?.textContent,
      line: document.querySelector(`${root} .chat-undelivered`)?.textContent,
      question: [...document.querySelectorAll(`${root} .chat__thread .ss-bubble-row[data-from="me"] .ss-bubble__text`)].slice(0, 2).map((x) => x.textContent).join(' '),
      badge: document.querySelector('.dock__badge, .sb-dock .sb-badge')?.textContent ?? null,
    }), root)
    const kept = before.filter((x) => !/typing/.test(x))
    say(after.question === 'ok be honest. what’s it actually like working with us?' && after.order.slice(0, kept.length - 1).join() === kept.slice(0, kept.length - 1).join() && after.order.length >= 3, `RS-17 ${device}: after a reload the replies that had come in are there, in place`, JSON.stringify({ before, after: after.order }))
    say(after.mine === 'kept across a reload' && after.line === 'Not Delivered' && after.order.includes('mine'), `MK-7 ${device}: the visitor’s own message is back, where it was`, JSON.stringify(after))
    say((await p.inputValue(field)) === 'not sent yet', `tb-6 ${device}: what was typed and not sent is back too`, await p.inputValue(field))
    say(after.badge === null, `RS-17 ${device}: what had been seen is not new again`, String(after.badge))
    const n = after.order.filter((x) => x !== 'mine').length
    await p.waitForFunction(([root, n]) => document.querySelectorAll(`${root} .chat__thread [data-person]:not([data-typing])`).length > n, [root, n], { timeout: 40000 }).catch(() => {})
    say((await replies(p, root)) > n, `RS-17 ${device}: and the conversation carries on from there`, `${n} -> ${await replies(p, root)}`)
    // Play From the Start still starts over
    if (device === 'desktop') {
      await pick(p, 'view', 'Play From the Start')
      await p.waitForTimeout(900)
      say((await replies(p, root)) === 0, 'RS-17 Play From the Start starts over', String(await replies(p, root)))
      await p.reload({ waitUntil: 'load' })
      await p.waitForSelector(field, { timeout: 20000 })
      await p.waitForTimeout(600)
      say((await replies(p, root)) <= 1, 'RS-17 …and a reload straight after is a fresh start', String(await replies(p, root)))
    }
    say(A.realErrors(t.errors).length === 0, `${device} (reload): no console errors`, A.realErrors(t.errors).join(' | ').slice(0, 300))
    await t.ctx.close()
  }
  // a tab whose storage is refused still works (a sandboxed frame): nothing kept, nothing broken
  const t = await A.open(browser, { device: 'desktop', base: BASE, goto: false })
  await t.page.addInitScript(() => { Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('denied', 'SecurityError') } }) })
  await t.page.goto(BASE + '?still', { waitUntil: 'load' })
  await t.page.waitForFunction((W) => document.querySelectorAll(`${W} .chat__thread [data-person]`).length >= 1, W, { timeout: 40000 }).catch(() => {})
  say((await t.page.locator(`${W} .chat__thread [data-person]`).count()) >= 1 && A.realErrors(t.errors).length === 0, 'RS-17 with storage refused the conversation still plays, with no error', A.realErrors(t.errors).join(' | ').slice(0, 200))
  await t.ctx.close()
}

;(async () => {
  const browser = await A.launch()
  try {
    if (!ONLY || ONLY === 'desk') await desk(browser)
    if (!ONLY || ONLY === 'phone') await phone(browser)
    if (!ONLY || ONLY === 'keep') await keep(browser)
  } catch (e) {
    failed++
    console.log('FAIL  the run stopped  (' + String(e).split('\n')[0] + ')')
  }
  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'ALL PASS')
  process.exit(failed ? 1 : 0)
})()
