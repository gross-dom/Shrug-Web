// Fixer M: every Messages fix, on both layouts. Exits non-zero if one fails.
//   node messages.cjs [base]        (default http://127.0.0.1:5173/; the production build is :4173)
//   node messages.cjs [base] desk|phone|keep    (one part only)
const A = require('./lib.cjs')
const path = require('path')
const fs = require('fs')
const BASE = process.argv[2] && /^https?:/.test(process.argv[2]) ? process.argv[2] : process.env.BASE || 'http://127.0.0.1:5173/'
const ONLY = process.argv.slice(2).find((a) => !/^https?:/.test(a))
const OUT = A.OUT
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
  // ---- a message of the visitor's own: it goes as any message does, and the keyboard is where it should be
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
  // Shrug's own question says Delivered as a message of the visitor's does: a moment after its bubble has landed
  const asked = await p.evaluate((W) => { const r = document.querySelector(`${W} .chat__thread .ss-receipt`); return r ? { under: r.previousElementSibling?.querySelector('.ss-bubble')?.getAttribute('aria-label'), says: r.textContent.trim(), waits: r.classList.contains('chat-sent'), by: getComputedStyle(r).animationDelay } : null }, W)
  say(!!asked && asked.under === 'Shrug' && asked.says === 'Delivered' && asked.waits && asked.by === '0.7s', 'under Shrug’s question, "Delivered" waits for the bubble to land, as it does under the visitor’s', JSON.stringify(asked))
  // The offer of every reply has room of its own at the head of the thread: the day over the first message starts under it
  const offer = await p.evaluate((W) => { const pill = document.querySelector(`${W} .chat__all[data-show]`); const day = document.querySelector(`${W} .chat-stamp`); if (!pill || !day) return null; const cs = getComputedStyle(pill); return { says: pill.textContent.trim(), clear: Math.round(day.getBoundingClientRect().top - pill.getBoundingClientRect().bottom), glass: cs.backdropFilter || cs.webkitBackdropFilter } }, W)
  say(!!offer && /^Load all 89 replies$/.test(offer.says) && offer.clear >= 8 && /blur/.test(offer.glass), 'the offer of every reply sits clear above the day the conversation begins with, on glass of its own', JSON.stringify(offer))
  // nothing moves under the checks that follow
  await pick(p, 'view', 'Pause Replies')
  // Paused, the head of the thread says so, where that offer was, and whoever was writing holds still
  const held = await p.evaluate((W) => { const pill = document.querySelector(`${W} .chat__all--paused`); return { shown: pill?.hasAttribute('data-show'), says: pill?.textContent.replace(/\s+/g, ' ').trim(), name: pill?.getAttribute('aria-label'), offer: !!document.querySelector(`${W} .chat__all:not(.chat__all--paused)[data-show]`), dots: [...document.querySelectorAll(`${W} .ss-bubble__dots i`)].map((d) => getComputedStyle(d).animationPlayState) } }, W)
  say(held.shown && /^Replies paused\s?·\s?Resume$/.test(held.says || '') && held.name === 'Replies paused. Resume' && !held.offer && held.dots.every((s) => s === 'paused'), 'paused: the head of the thread says "Replies paused · Resume" in place of the offer, and the dots hold still', JSON.stringify(held))

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
  say(/^Delivered\.\s?$/.test(told), 'AX-s a message that has gone is said in the status line', told)

  // UX-2 (as it is now): a message of the visitor's own is delivered, as any message is. "Delivered" is under the
  // last one sent and nowhere else; nothing says it did not go, and there is nothing to press to be told why
  const sent = await p.evaluate((W) => {
    const rows = [...document.querySelectorAll(`${W} .chat__thread > *`)]
    const mine = rows.filter((r) => r.querySelector('.ss-bubble[aria-label="You"]'))
    const last = rows.findIndex((r) => r.textContent.includes('and again'))
    return { mine: mine.map((r) => r.querySelector('.ss-bubble__text').textContent), from: mine.every((r) => r.dataset.from === 'me'), under: rows[last + 1]?.textContent.trim(), receipts: rows.filter((r) => r.textContent.trim() === 'Delivered').length, failed: document.querySelectorAll(`${W} .chat-failed, ${W} .chat-undelivered, ${W} .chat-why, ${W} [data-failed]`).length }
  }, W)
  say(sent.mine.join('|') === 'hello from a visitor|and again' && sent.from && sent.under === 'Delivered' && sent.receipts === 1 && sent.failed === 0, 'UX-2 a message of the visitor’s own is delivered: "Delivered" under the last one sent, and nothing that says it did not go', JSON.stringify(sent))
  await p.screenshot({ path: path.join(OUT, 'desk-delivered.png') })

  // tb-6: what is typed and not sent is kept with its conversation
  await p.fill(`${W} .composer__input`, 'half a thought')
  await p.click(`${W} [data-conversation="founder"]`)
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

  // DK-5 / AX-22: search is of everyone in the conversation. Who has replied is found by what they said too; who has
  // not yet, by who they are alone, and is marked so. Nothing found is said outside the list
  const found = () => p.evaluate((W) => [...document.querySelectorAll(`${W} .conv-list [data-row]`)].map((row) => ({ row: row.dataset.row, yet: row.hasAttribute('data-yet'), said: row.querySelector('.ss-row__preview')?.textContent.trim() })), W)
  await p.fill(`${W} .search__input`, 'maggie norris')
  await p.waitForTimeout(400)
  const yet = await found()
  say(yet.length === 1 && yet[0].row === 'p:88' && yet[0].yet && yet[0].said === 'Hasn’t replied yet', 'DK-5 someone who has not replied yet is found by name, marked "Hasn’t replied yet"', JSON.stringify(yet))
  await p.fill(`${W} .search__input`, 'sounding board')
  await p.waitForTimeout(400)
  const none = await p.evaluate((W) => { const l = document.querySelector(`${W} .conv-list`); const n = document.querySelector(`${W} .conv-none`); return { rows: l.querySelectorAll('[data-row]').length, strays: [...l.children].filter((c) => !c.matches('[role="option"], [role="group"]')).length, none: n?.textContent.trim(), role: n?.getAttribute('role'), inList: !!l.querySelector('.conv-none, .side-empty') } }, W)
  say(none.rows === 0 && none.none === 'No Results', 'DK-5 …and not by what they have yet to say', JSON.stringify(none))
  say(none.role === 'status' && !none.inList && none.strays === 0, 'AX-22 "No Results" is a status outside the listbox', JSON.stringify(none))
  await p.fill(`${W} .search__input`, 'pentatonix')
  await p.waitForTimeout(400)
  say((await p.locator(`${W} [data-row="p:0"]`).count()) === 1, 'DK-5 someone who has replied is found')
  // typed in capitals, with a keyboard's apostrophe: the reply is set with a typographer's
  await p.fill(`${W} .search__input`, 'THEY\'RE THE BEST')
  await p.waitForTimeout(400)
  const typed = await found()
  say(typed.length === 1 && typed[0].row === 'p:0' && !typed[0].yet && /^They’re the best/.test(typed[0].said || ''), 'DK-5 …by what they said, whichever apostrophe and case it is typed in', JSON.stringify(typed))
  // DK-10: Return opens the first thing found; the down arrow goes into the list
  await p.fill(`${W} .search__input`, 'akash')
  await p.waitForTimeout(300)
  await p.keyboard.press('Enter')
  await p.waitForTimeout(500)
  say((await p.textContent(`${W} .chat-id__name span`)) === 'Akash Nigam', 'DK-10 Return in the search opens the first conversation found', await p.textContent(`${W} .chat-id__name span`))
  await p.keyboard.press('ArrowDown')
  await p.waitForTimeout(300)
  say((await active(p)) === 'div.conv-list', 'DK-10 the down arrow goes into the list', await active(p))
  // UX-19: one wording for a link that leaves
  await p.fill(`${W} .search__input`, '')
  await p.click(`${W} [data-conversation="unknown"]`)
  await p.waitForTimeout(500)
  say((await p.textContent(`${W} a.chat-link .sr-only`)) === ', opens in a new tab', 'UX-19 a link bubble says ", opens in a new tab"')
  // The conversations beside the group: a founder by name, heard from in the small hours; no Mom, no verification code
  const eggs = await p.evaluate((W) => [...document.querySelectorAll(`${W} .conv`)].map((row) => ({ name: row.querySelector('.ss-row__title').textContent.replace(/, unread$/, ''), when: row.querySelector('.ss-row__meta')?.textContent.trim(), said: row.querySelector('.ss-row__preview')?.textContent.trim() })), W)
  say(eggs.map((e) => e.name).join(' | ') === 'Testimonials | Akash Nigam | +1 (555) 010-0142 | Drops', 'the list is Testimonials and three others: no Mom, no verification code', eggs.map((e) => e.name).join(' | '))
  // (in the small hours themselves, before the hour he writes at, he was heard from a few minutes ago: src/apps/chat-ui.tsx, eggAt)
  const small = (await p.evaluate(() => new Date().getHours())) < 3
  say(eggs[1].said === 'we just closed another customer' && (small ? /^(0?[0-4]|12):\d\d( ?AM)?$/ : /^(0?[1-4]:\d\d( ?AM)?)$/).test(eggs[1].when), 'the founder is Akash Nigam, heard from late at night: "we just closed another customer"', JSON.stringify(eggs[1]))
  await p.click(`${W} [data-conversation="founder"]`)
  await p.waitForTimeout(500)
  const night = await p.evaluate((W) => [...document.querySelectorAll(`${W} .chat__thread .ss-bubble__text`)].map((x) => x.textContent), W)
  say(night.join(' | ') === 'you up? | always | we just closed another customer', 'and the conversation with him says so', night.join(' | '))
  // One of them written in is the one last used: its row says what the visitor wrote, and when, at the head of the others
  await p.click(`${W} [data-conversation="drops"]`)
  await p.waitForTimeout(400)
  await p.fill(`${W} .composer__input`, 'thank you!')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(900)
  const wrote = await p.evaluate((W) => ({ rows: [...document.querySelectorAll(`${W} .conv`)].map((row) => ({ name: row.querySelector('.ss-row__title').textContent, when: row.querySelector('.ss-row__meta')?.textContent.trim(), said: row.querySelector('.ss-row__preview')?.textContent.trim() })), now: [0, 60_000].map((ago) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(Date.now() - ago)) }), W)
  say(wrote.rows.map((r) => r.name).join(' | ') === 'Testimonials | Drops | Akash Nigam | +1 (555) 010-0142' && wrote.rows[1].said === 'thank you!' && wrote.now.includes(wrote.rows[1].when), 'a conversation written in moves to the head of the others, its row saying what was written and the time', JSON.stringify(wrote))
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
  say(det.stops === 1 && det.people === 89, 'AX-7 eighty-nine people are one Tab stop', `${det.stops} of ${det.people}`)
  say(det.name === 'Testimonials. Details' && det.dialog === 'Testimonials details', 'AX-23 one name for Details', `${det.name} / ${det.dialog}`)
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
  say(allTold === 'All 89 have replied.', 'AX-8 …and that everyone has', allTold)
  await p.evaluate((W) => { const s = document.querySelector(`${W} .chat__scroll`); s.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -900 })); s.scrollTop = 600 }, W)
  await p.waitForTimeout(500)
  say((await p.locator(`${W} .chat__new[data-show]`).count()) === 1, 'DK-4 (setup) scrolled back: the pill shows')
  await p.fill(`${W} .composer__input`, 'sent from far up')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(1400)
  const seen = await p.evaluate((W) => { const s = document.querySelector(`${W} .chat__scroll`); const b = [...document.querySelectorAll(`${W} .ss-bubble[aria-label="You"]`)].pop().getBoundingClientRect(); const r = s.getBoundingClientRect(); return { inView: b.top >= r.top && b.bottom <= r.bottom + 1, fromEnd: Math.round(s.scrollHeight - s.scrollTop - s.clientHeight), pill: !!document.querySelector(`${W} .chat__new[data-show]`) } }, W)
  say(seen.inView && !seen.pill, 'DK-4 a message sent after scrolling back comes into view', JSON.stringify(seen))
  // AX-10: pressing the pill puts the keyboard on the thread
  await p.evaluate((W) => { const s = document.querySelector(`${W} .chat__scroll`); s.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -900 })); s.scrollTop = 600 }, W)
  await p.waitForTimeout(500)
  await p.focus(`${W} .chat__new`)
  await p.keyboard.press('Enter')
  await p.waitForTimeout(900)
  say((await active(p)) === 'div.chat__scroll', 'AX-10 the pill hands the keyboard to the thread', await active(p))

  // UX-23 (as it is now): the last reply is the end of the conversation. Shrug says nothing after it: no shrug, no
  // "anyway.", no bubbles that lead somewhere else
  const end = await p.evaluate((W) => {
    const rows = [...document.querySelectorAll(`${W} .chat__thread > *`)]
    const shrugs = rows.filter((r) => r.querySelector('.ss-bubble[aria-label="Shrug"]')).map((r) => r.textContent.trim())
    const lastReply = rows.map((r, i) => (r.querySelector('[data-person]') ? i : -1)).filter((i) => i >= 0).pop()
    return { shrugs, links: document.querySelectorAll(`${W} .chat__thread .chat-link`).length, people: document.querySelectorAll(`${W} .chat__thread [data-person]`).length, after: rows.slice(lastReply + 1).map((r) => r.textContent.trim()), mark: /ツ/.test(document.querySelector(`${W} .chat__thread`).textContent) }
  }, W)
  say(end.people === 89 && end.shrugs.join(' | ') === 'ok be honest. | what’s it actually like working with us?' && end.links === 0 && !end.mark && end.after.every((x) => /^(sent from far up|Delivered)$/.test(x)), 'UX-23 the last reply is the end of it: Shrug says nothing after it, and nothing in it leads elsewhere', JSON.stringify(end))
  say(A.realErrors(t.errors).length === 0, 'desktop: no console errors', A.realErrors(t.errors).join(' | ').slice(0, 300))
  await t.ctx.close()

  // ---- while the replies are still coming: Resume, someone found before they have replied, and what the details start
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still' })
  p = t.page
  await p.waitForSelector(`${W} .composer__input`, { timeout: 20000 })
  await p.waitForFunction((W) => document.querySelectorAll(`${W} .chat__thread [data-person]:not([data-typing])`).length >= 2, W, { timeout: 30000 })
  await pick(p, 'view', 'Pause Replies')
  const stopped = await replies(p, W)
  await p.click(`${W} .chat__all--paused`)
  const went = await p.waitForFunction(([W, n]) => document.querySelectorAll(`${W} .chat__thread [data-person]:not([data-typing])`).length > n, [W, stopped], { timeout: 15000 }).then(() => true, () => false)
  const resumed = await p.evaluate((W) => ({ paused: !!document.querySelector(`${W} .chat__all--paused[data-show]`), offer: !!document.querySelector(`${W} .chat__all:not(.chat__all--paused)[data-show]`), menu: [...document.querySelectorAll('[data-menu="view"] [data-menu-item]')].map((i) => i.textContent.trim()).find((x) => /Replies$/.test(x)) }), W)
  say(went && !resumed.paused && resumed.offer && resumed.menu === 'Pause Replies' && (await active(p)) === 'div.chat__scroll', 'paused: Resume there sets the replies going again, with the keyboard on the thread', JSON.stringify({ went, ...resumed, on: await active(p) }))
  // someone still to reply, come to with the arrows from the search: picked out, and the conversation left to play
  await p.fill(`${W} .search__input`, 'aidaly')
  await p.waitForTimeout(400)
  await p.keyboard.press('ArrowDown')
  await p.waitForTimeout(400)
  const passed = await p.evaluate((W) => ({ people: document.querySelectorAll(`${W} .chat__thread [data-person]`).length, row: document.querySelector(`${W} .conv[data-selected]`)?.dataset.row, yet: document.querySelector(`${W} .conv[data-selected]`)?.hasAttribute('data-yet') }), W)
  say(passed.row === 'p:88' && passed.yet && passed.people < 89, 'DK-5 the arrows pass over someone still to reply without hurrying anyone', JSON.stringify(passed))
  // …and pressed: every reply is brought in, and theirs is gone to
  await p.keyboard.press('Enter')
  await p.waitForTimeout(1600)
  const brought = await p.evaluate((W) => { const s = document.querySelector(`${W} .chat__scroll`).getBoundingClientRect(); const b = document.querySelector(`${W} .chat__thread [data-person="88"]`)?.getBoundingClientRect(); const row = document.querySelector(`${W} [data-row="p:88"]`); return { people: document.querySelectorAll(`${W} .chat__thread [data-person]:not([data-typing])`).length, inView: !!b && b.top >= s.top - 2 && b.bottom <= s.bottom + 2, yet: row?.hasAttribute('data-yet'), said: row?.querySelector('.ss-row__preview')?.textContent.trim() } }, W)
  say(brought.people === 89 && brought.inView && !brought.yet && brought.said === 'Founder of Aidaly', 'DK-5 pressed, everyone’s replies are brought in and theirs is gone to', JSON.stringify(brought))
  await p.fill(`${W} .search__input`, '')
  // The details close on what changes the thread under them, so that it is seen
  await p.click(`${W} .chat-id`)
  await p.waitForTimeout(500)
  await p.locator(`${W} .details__row`, { hasText: 'Play From the Start' }).click()
  await p.waitForTimeout(700)
  const again = await p.evaluate((W) => ({ details: !!document.querySelector(`${W} .chat-details[data-show]`), people: document.querySelectorAll(`${W} .chat__thread [data-person]:not([data-typing])`).length }), W)
  say(!again.details && again.people === 0 && (await active(p)) === 'button.chat-id', 'Play From the Start in the details starts over and closes them, the keyboard back on the name', JSON.stringify({ ...again, on: await active(p) }))
  await p.click(`${W} .chat-id`)
  await p.waitForTimeout(500)
  await p.locator(`${W} .details__row`, { hasText: 'Show Every Reply' }).click()
  await p.waitForTimeout(900)
  const every = await p.evaluate((W) => ({ details: !!document.querySelector(`${W} .chat-details[data-show]`), people: document.querySelectorAll(`${W} .chat__thread [data-person]:not([data-typing])`).length }), W)
  say(!every.details && every.people === 89, 'Show Every Reply there brings everyone in and closes them too', JSON.stringify(every))
  say(A.realErrors(t.errors).length === 0, 'desktop (while replies come): no console errors', A.realErrors(t.errors).join(' | ').slice(0, 300))
  await t.ctx.close()

  // ---- DK-16: replies that land where nobody can see them are new
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still' })
  p = t.page
  await p.waitForSelector(`${W} .composer__input`, { timeout: 20000 })
  await p.waitForFunction((W) => document.querySelectorAll(`${W} .chat__thread [data-person]:not([data-typing])`).length >= 1, W, { timeout: 30000 })
  await p.locator('.dock__item[data-dock-app="finder"]').click()
  await p.waitForTimeout(700)
  // (behind another window, what is picked in its list is grey: the blue is the window in front's)
  const dim = await p.evaluate((W) => getComputedStyle(document.querySelector(`${W} .conv[data-selected]`)).backgroundColor, W)
  say(dim === 'rgb(220, 220, 225)', 'behind another window, the conversation picked in the list is grey, not blue', dim)
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
  say(half.width < 640 && half.side > 150 && half.rows === 4 && half.search && half.back === 'none' && half.pane > 300, 'DK-8 tiled to half of 1280 the chat keeps its list and search', JSON.stringify(half))
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
  say(listing.side !== 'none' && listing.main === 'none' && listing.rows === 4 && listing.wide > 350, 'DK-8 the list is a pane of its own', JSON.stringify(listing))
  await p.screenshot({ path: path.join(OUT, 'desk-folded-list.png') })
  await p.click(`${W} [data-conversation="founder"]`)
  await p.waitForTimeout(400)
  const back = await p.evaluate((W) => ({ main: getComputedStyle(document.querySelector(`${W} .ss-window__main`)).display, name: document.querySelector(`${W} .chat-id__name span`).textContent }), W)
  say(back.main !== 'none' && back.name === 'Akash Nigam', 'DK-8 picking a conversation goes to it', JSON.stringify(back))
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
  const whole = await p.evaluate((W) => { const s = document.querySelector(`${W} .chat__scroll`); return { replies: document.querySelectorAll(`${W} .chat__thread [data-person]`).length, top: s.scrollTop, pill: document.querySelector(`${W} .chat__new[data-show]`)?.textContent.trim(), badge: document.querySelector('.dock__badge')?.textContent ?? null, next: !!document.querySelector(`${W} .chat__thread .chat-link`), all: !!document.querySelector(`${W} .chat__all[data-show]`) } }, W)
  say(whole.replies === 89 && whole.top === 0 && whole.pill === 'Latest' && whole.badge === null && !whole.next && !whole.all, 'AX-14 reduced motion: all eighty-nine, from the top, "Latest" offered, nothing unread and nothing left to load', JSON.stringify(whole))
  await t.ctx.close()
  t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still', reducedMotion: true })
  p = t.page
  await A.unlock(p)
  await p.waitForTimeout(600)
  const homeBadge = await p.evaluate(() => document.querySelector('.sb-dock .sb-badge')?.textContent ?? null)
  await A.at(p, 'messages', ['c:group'])
  await p.waitForTimeout(600)
  const there = await p.evaluate((F) => { const s = document.querySelector(`${F} .chat__scroll`); return { top: s.scrollTop, pill: document.querySelector(`${F} .chat__new[data-show]`)?.textContent.trim(), replies: document.querySelectorAll(`${F} .chat__thread [data-person]`).length } }, F)
  say(homeBadge === null && there.top === 0 && there.pill === 'Latest' && there.replies === 89, 'AX-14 on the iPhone too: no badge of eighty-nine, and the conversation from its top', JSON.stringify({ homeBadge, ...there }))
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
  await p.waitForFunction(() => /^1 of 89/.test([...document.querySelectorAll('.ios-sheet *')].map((x) => (x.children.length ? '' : x.textContent)).find((x) => /of 89/.test(x)) || ''), null, { timeout: 30000 }).catch(() => {})
  const f1 = await foot()
  say(/^(No one has replied yet\.|\d+ of 89 ha(s|ve) replied so far\.)$/.test(f0 || '') && (f1 === null || /^\d+ of 89 ha(s|ve) replied so far\.$/.test(f1)) && !/^1 of 89 have/.test(f1 || '') && !/^1 of 89 have/.test(f0 || ''), 'UX-19 "No one has replied yet." / "1 of 89 has replied so far."', `${f0} -> ${f1}`)
  await A.at(p, 'messages', ['c:group'])

  // AX-23: one control for Details; the camera is FaceTime
  const head = await p.evaluate((F) => ({ name: document.querySelector(`${F} .msg-head`)?.textContent.replace(/\s+/g, ' ').trim(), cam: document.querySelector(`${F} .ios-bar [aria-label="FaceTime"]`) ? 'FaceTime' : null, twins: document.querySelectorAll(`${F} [aria-label$="details"]`).length }), F)
  say(head.name === 'Testimonials. Details' && head.cam === 'FaceTime' && head.twins === 0, 'AX-23 the name opens Details; the camera is named for what it is', JSON.stringify(head))

  // Paused from the details, the conversation says so at its head; Resume there sets it going again
  const TOP = `${F} .ios-page[data-pos="top"]`
  await A.at(p, 'messages', ['c:group'], 'details')
  await p.locator(`${F} .ios-sheet [role="switch"][aria-label="Pause Replies"]`).tap()
  await p.waitForTimeout(400)
  await A.at(p, 'messages', ['c:group'])
  const held = await p.evaluate((TOP) => { const pill = document.querySelector(`${TOP} .chat__all--paused`); return { shown: pill?.hasAttribute('data-show'), says: pill?.textContent.replace(/\s+/g, ' ').trim(), n: document.querySelectorAll(`${TOP} .chat__thread [data-person]:not([data-typing])`).length } }, TOP)
  await p.locator(`${TOP} .chat__all--paused`).tap()
  const went = await p.waitForFunction(([TOP, n]) => document.querySelectorAll(`${TOP} .chat__thread [data-person]:not([data-typing])`).length > n, [TOP, held.n], { timeout: 15000 }).then(() => true, () => false)
  say(held.shown && /^Replies paused\s?·\s?Resume$/.test(held.says || '') && went && !(await p.locator(`${TOP} .chat__all--paused[data-show]`).count()), 'phone: paused, the head of the conversation says "Replies paused · Resume", and a tap there sets the replies going again', JSON.stringify({ ...held, went }))

  // UX-17: FaceTime answers in character
  await p.locator(`${F} [aria-label="FaceTime"]`).tap()
  await p.waitForTimeout(700)
  const ft = await p.evaluate(() => { const a = document.querySelector('.msg-alert__box'); return { sheet: history.state?.shrug?.sheet, role: a?.getAttribute('role'), title: a?.querySelector('.msg-alert__title')?.textContent, say: a?.querySelector('.msg-alert__say')?.textContent, acts: [...(a?.querySelectorAll('.msg-alert__act') ?? [])].map((x) => x.textContent), focus: document.activeElement?.textContent } })
  say(ft.sheet === 'facetime' && ft.role === 'alertdialog' && ft.title === 'FaceTime Unavailable' && ft.say === 'Testimonials is not available for FaceTime.' && ft.acts.join() === 'OK' && ft.focus === 'OK', 'UX-17 the camera: "FaceTime Unavailable"', JSON.stringify(ft))
  await p.screenshot({ path: path.join(OUT, 'phone-facetime.png') })
  await p.locator('.msg-alert__act').tap()
  await p.waitForTimeout(700)
  say((await A.state(p)).place.sheet === null && !(await p.locator('.msg-alert').count()), 'UX-17 OK closes it')
  await A.at(p, 'messages', ['c:founder'])
  await p.locator(`${F} [aria-label="FaceTime"]`).tap()
  await p.waitForTimeout(700)
  say((await p.textContent('.msg-alert__say')) === 'Akash Nigam is not available for FaceTime.', 'UX-17 in another conversation it is that person', await p.textContent('.msg-alert__say'))
  await p.goBack(); await p.waitForTimeout(700)
  say(!(await p.locator('.msg-alert:not([data-closing])').count()), 'UX-17 the browser’s Back closes it')

  // UX-2 (as it is now): a message sent in another conversation is delivered too
  await p.fill(`${F} .msg-field__input`, 'congrats')
  await p.locator(`${F} .msg-field__send`).tap()
  await p.waitForTimeout(1300)
  say((await active(p)) === 'input.msg-field__input', 'tb-10 the phone’s send button does not take the caret', await active(p))
  const sent = await p.evaluate((F) => { const rows = [...document.querySelectorAll(`${F} .ios-page[data-pos="top"] .chat__thread > *`)]; const at = rows.findIndex((r) => r.textContent.includes('congrats')); return { yours: !!rows[at]?.querySelector('.ss-bubble[aria-label="You"]'), under: rows[at + 1]?.textContent.trim(), last: at === rows.length - 2, failed: document.querySelectorAll(`${F} .chat-failed, ${F} .chat-undelivered`).length, sheet: history.state?.shrug?.sheet ?? null } }, F)
  say(sent.yours && sent.under === 'Delivered' && sent.last && sent.failed === 0 && sent.sheet === null, 'UX-2 phone: a message sent to anyone is delivered, with nothing to say it did not go', JSON.stringify(sent))
  await p.screenshot({ path: path.join(OUT, 'phone-delivered.png') })

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
  const rtl = await p.evaluate((F) => { const x = [...document.querySelectorAll(`${F} .ss-bubble[aria-label="You"] .ss-bubble__text`)].pop(); return x ? getComputedStyle(x).direction : null }, F)
  say(rtl === 'rtl', 'MK-17 right-to-left words are laid out right to left', String(rtl))

  // The list: the conversation written in (above) says what was written, and when
  await p.locator(`${F} .msg-back`).tap()
  await p.waitForTimeout(900)
  const listed = await p.evaluate((F) => ({ rows: [...document.querySelectorAll(`${F} .msg-row`)].map((row) => ({ name: row.querySelector('.ss-row__title').textContent.replace(/, unread$/, ''), when: row.querySelector('.ss-row__meta')?.textContent.trim(), said: row.querySelector('.ss-row__preview')?.textContent.trim() })), now: [0, 60_000, 120_000].map((ago) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(Date.now() - ago)) }), F)
  say(listed.rows[1]?.name === 'Akash Nigam' && listed.rows[1].said === 'congrats' && listed.now.includes(listed.rows[1].when), 'phone: the row of a conversation written in says what was written, and the time', JSON.stringify(listed))
  // DK-5 on the phone: search finds someone who has not replied yet by name, and says that they have not
  await p.fill(`${F} .ios-search__input`, 'maggie norris')
  await p.waitForTimeout(500)
  const yet = await p.evaluate((F) => [...document.querySelectorAll(`${F} .msg-row`)].map((row) => ({ row: row.dataset.row, said: row.querySelector('.ss-row__preview')?.textContent.trim() })), F)
  say(yet.length === 1 && yet[0].row === 'p:88' && yet[0].said === 'Hasn’t replied yet', 'DK-5 the phone’s search finds someone who has not replied yet, marked "Hasn’t replied yet"', JSON.stringify(yet))
  await p.fill(`${F} .ios-search__input`, '')

  // MK-13: flicked out of the App Switcher, Messages starts over: nothing is still being looked for
  await p.fill(`${F} .ios-search__input`, 'akash')
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
  say(quit && after.q === '' && after.rows === 4, 'MK-13 flicked out of the switcher, Messages comes back with no search', JSON.stringify({ quit, ...after }))
  // UX-23 on the phone (as it is now): everyone in, the last reply is the end of the conversation
  await A.at(p, 'messages', ['c:group'], 'details')
  await p.locator(`${F} .ios-sheet .ios-cell`, { hasText: 'Show Every Reply' }).tap()
  await p.waitForTimeout(1500)
  const ended = await p.evaluate((F) => { const thread = document.querySelector(`${F} .ios-page[data-pos="top"] .chat__thread`); return { people: thread.querySelectorAll('[data-person]').length, links: thread.querySelectorAll('.chat-link').length, anyway: /anyway\.|ツ/.test(thread.textContent) } }, F)
  say(ended.people === 89 && ended.links === 0 && !ended.anyway, 'UX-23 phone: the last reply is the end of it; nothing after it leads elsewhere', JSON.stringify(ended))

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
  // DK-5: someone found in the list before they have replied. Pressed, everyone's replies are brought in and theirs is gone to
  await A.at(p, 'messages', [])
  await p.fill(`${F} .ios-search__input`, 'maggie norris')
  await p.waitForTimeout(500)
  await p.locator(`${F} .msg-row[data-row="p:88"]`).click()
  await p.waitForTimeout(2200)
  const brought = await p.evaluate((F) => { const top = document.querySelector(`${F} .ios-page[data-pos="top"]`); const s = top.querySelector('.chat__scroll')?.getBoundingClientRect(); const b = top.querySelector('.chat__thread [data-person="88"]')?.getBoundingClientRect(); return { place: history.state?.shrug?.stacks?.messages?.join(), people: top.querySelectorAll('.chat__thread [data-person]:not([data-typing])').length, inView: !!s && !!b && b.top >= s.top - 2 && b.bottom <= s.bottom + 2 } }, F)
  say(brought.place === 'c:group' && brought.people === 89 && brought.inView, 'DK-5 phone: pressed, everyone’s replies are brought in and theirs is gone to', JSON.stringify(brought))
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
    const before = await p.evaluate((root) => [...document.querySelectorAll(`${root} .chat__thread > .ss-bubble-row`)].map((r) => (r.querySelector('.ss-bubble[aria-label="You"]') ? 'mine' : r.querySelector('[data-person]') ? `p${r.querySelector('[data-person]').dataset.person}` : 'shrug')).filter((x) => x !== 'shrug'), root)
    await p.reload({ waitUntil: 'load' })
    await p.waitForSelector(field, { timeout: 20000 })
    await p.waitForTimeout(700)
    const after = await p.evaluate((root) => ({
      order: [...document.querySelectorAll(`${root} .chat__thread > .ss-bubble-row`)].filter((r) => !r.querySelector('[data-typing]')).map((r) => (r.querySelector('.ss-bubble[aria-label="You"]') ? 'mine' : r.querySelector('[data-person]') ? `p${r.querySelector('[data-person]').dataset.person}` : 'shrug')).filter((x) => x !== 'shrug'),
      mine: document.querySelector(`${root} .ss-bubble[aria-label="You"] .ss-bubble__text`)?.textContent,
      line: document.querySelector(`${root} .ss-bubble[aria-label="You"]`)?.closest('.ss-bubble-row')?.nextElementSibling?.textContent.trim(),
      question: [...document.querySelectorAll(`${root} .chat__thread .ss-bubble-row[data-from="me"] .ss-bubble__text`)].slice(0, 2).map((x) => x.textContent).join(' '),
      badge: document.querySelector('.dock__badge, .sb-dock .sb-badge')?.textContent ?? null,
    }), root)
    const kept = before.filter((x) => !/typing/.test(x))
    say(after.question === 'ok be honest. what’s it actually like working with us?' && after.order.slice(0, kept.length - 1).join() === kept.slice(0, kept.length - 1).join() && after.order.length >= 3, `RS-17 ${device}: after a reload the replies that had come in are there, in place`, JSON.stringify({ before, after: after.order }))
    say(after.mine === 'kept across a reload' && after.line === 'Delivered' && after.order.includes('mine'), `MK-7 ${device}: the visitor’s own message is back, where it was`, JSON.stringify(after))
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
