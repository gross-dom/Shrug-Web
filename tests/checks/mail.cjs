// Mail (design/v1, "Mail"): twenty exchanges that led to something, in a window drawn after Superhuman as it
// is (Dom's screenshots of it are the look) and driven as Superhuman is. Its keys move about, open, search and
// ask for the command palette. What can be done here is real and kept in the browser: Mark Done (and a Done
// split), Star, Mark Unread, Share (a link to the conversation). An email in a conversation opens and closes.
// The keys that would send, snooze or delete say that is not here. Reply opens Messages.
//   node mail.cjs http://127.0.0.1:4273/
const A = require('./lib.cjs')
const BASE = process.argv[2] || A.BASE

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

;(async () => {
  const browser = await A.launch()
  const M = '.wf[data-app="mail"]'
  // (`mail=open`: none of the twenty is locked, so that what the inbox does is gone through as a visitor. The
  // locked ones, and what a visitor is shown of them, are investors.cjs's)
  const t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty&mail=open' })
  const p = t.page
  await p.waitForTimeout(1600)
  const front = () => p.evaluate(() => document.querySelector('.wf[data-active]')?.dataset.app ?? null)
  const inbox = () =>
    p.evaluate((M) => {
      const w = document.querySelector(M)
      const rows = [...w.querySelectorAll('.ml-row')]
      return { rows: rows.length, on: rows.findIndex((r) => r.classList.contains('on')), tabs: [...w.querySelectorAll('.ml-tabs button[role="tab"]')].map((b) => `${b.firstChild.textContent.trim()} ${b.querySelector('small').textContent}${b.classList.contains('on') ? '*' : ''}`).join(' | '), place: (() => { const h = w.querySelector('.ml-tabs--place h2'); return h ? `${h.firstChild.textContent.trim()} ${h.querySelector('small').textContent}` : null })(), pill: w.querySelector('.mlbar__pill')?.textContent.trim() ?? null, thread: !!w.querySelector('.ml-thread'), zero: !!w.querySelector('.ml-zero'), said: w.querySelector('.ml-said')?.textContent ?? null, pal: w.querySelectorAll('.ml-pal').length, held: document.activeElement?.className ?? '' }
    }, M)
  const key = async (k, wait = 180) => { await p.keyboard.press(k); await p.waitForTimeout(wait) }

  // ---- in the Dock, after Case Studies; opened, the inbox
  const dock = await p.evaluate(() => [...document.querySelectorAll('.dock [data-dock-item]')].map((b) => b.dataset.dockApp).join(' '))
  check('Mail is in the Dock after Case Studies, before Workspace and the stores', /terminal mail workspace store books myvip$/.test(dock), dock)
  await p.click('.dock [data-dock-app="mail"]')
  await p.waitForSelector(`${M}[data-open] .ml-row`, { timeout: 15000 })
  await p.waitForTimeout(600)
  const size = await p.evaluate((M) => { const r = document.querySelector(M).getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}` }, M)
  let s = await inbox()
  check('it opens 1180 by 740 on its inbox: twenty rows, the first picked, and the keyboard in the window', size === '1180x740' && s.rows === 20 && s.on === 0 && /\bml\b/.test(s.held) && (await front()) === 'mail', JSON.stringify({ size, s }))
  check('its splits are along the top, each with its count, All picked; and no Done split, nothing being done yet', s.tabs === 'All 20* | Investments 7 | Intros 6 | Hires 3 | Drops 4', s.tabs)
  const near = await p.evaluate((M) => { const b = document.querySelector(`${M} .ml-tabs button`); const r = document.createRange(); r.selectNodeContents(b.firstChild); return Math.round(b.querySelector('small').getBoundingClientRect().left - r.getBoundingClientRect().right) }, M)
  check('a count sits close against its split’s name', near >= 2 && near <= 6, String(near))
  const row = await p.evaluate((M) => {
    const w = document.querySelector(M)
    const rows = [...w.querySelectorAll('.ml-row')]
    const r = rows[1]
    const list = w.querySelector('.ml-list')
    return {
      h: Math.round(r.getBoundingClientRect().height),
      parts: [...r.children].map((c) => c.className || c.tagName).join(' '),
      chip: r.querySelector('.ml-chip').textContent,
      chipIn: r.querySelector('.ml-chip').parentElement.className,
      date: r.querySelector('.d').textContent,
      acts: rows[0].querySelectorAll('.ml-acts svg').length,
      tips: [...rows[0].querySelectorAll('.ml-acts [data-tip]')].map((x) => x.dataset.tip).join(' | '),
      hand: getComputedStyle(rows[1]).cursor,
      groups: rows.map((x) => x.dataset.group).filter(Boolean).join(' | '),
      wide: list.scrollWidth - list.clientWidth,
      pill: w.querySelector('.mlbar__pill').textContent.trim(),
      rail: w.querySelectorAll('.ml-rail button').length,
      pane: w.querySelector('.ml-pane').getAttribute('aria-label'),
      who: w.querySelector('.ml-pane .ml-who')?.textContent.trim().length > 0,
      readonly: w.querySelector('.ml-readonly').textContent.trim(),
      light: (() => { let el = w.querySelector('.ml-list'); while (el && /^rgba\(0, 0, 0, 0\)$|^transparent$/.test(getComputedStyle(el).backgroundColor)) el = el.parentElement; return el ? getComputedStyle(el).backgroundColor : '' })(),
    }
  }, M)
  check('its bar is one long pill that says where this is; under it the list, with no rail of icons beside it, and a pane about whoever the row is from', row.pill === 'All (20) - Mail' && row.rail === 0 && row.pane === 'About the sender' && row.who, JSON.stringify(row))
  check('a row is one line: who, a label for what it led to before the subject and first line, and the day as Superhuman writes it', row.h >= 28 && row.h <= 40 && /^B s d$/.test(row.parts) && /^(investment|intro|hire|drop)$/.test(row.chip) && row.chipIn === 's' && /^[A-Z]{3} \d{1,2}$/.test(row.date) && row.wide <= 0, JSON.stringify(row))
  check('the rows are under headings for when they came, and the row it is on offers Mark Done and the command palette (no clock)', row.groups.split(' | ').length >= 2 && row.acts === 2 && row.tips === 'Mark Done | Mail Command', JSON.stringify({ groups: row.groups, acts: row.acts, tips: row.tips }))
  check('a row shows the pointing hand', row.hand === 'pointer', row.hand)
  check('it is light, as Superhuman is, and its pane says which key writes to Shrug', /^rgb\(2[45]\d, 2[45]\d, 2[45]\d\)$/.test(row.light) && /^C\s*writes to Shrug$/.test(row.readonly), JSON.stringify({ light: row.light, readonly: row.readonly }))

  // ---- moving about, as in Superhuman
  await key('j'); await key('j')
  s = await inbox()
  await key('k')
  check('J and K move down and up the rows', s.on === 2 && (await inbox()).on === 1)
  await key('ArrowDown')
  check('so do the arrows', (await inbox()).on === 2)
  await key('Tab')
  s = await inbox()
  check('Tab goes to the next split: Investments, and only its seven', s.tabs.includes('Investments 7*') && s.rows === 7 && s.on === 0, JSON.stringify(s))
  await key('Shift+Tab')
  check('Shift Tab goes back', (await inbox()).tabs.includes('All 20*') && (await inbox()).rows === 20)
  await key('g'); await key('i')
  check('G then I goes to the inbox', (await inbox()).on === 0 && (await inbox()).tabs.includes('All 20*'))

  // ---- what is not here says so, and changes nothing
  const refused = []
  for (const [k, says] of [['h', 'Nothing is snoozed.'], ['#', 'Nothing is deleted.'], ['f', 'Nothing is forwarded.'], ['Shift+M', 'Nothing is muted.']]) {
    await key(k, 250)
    const now = await inbox()
    refused.push({ k, ok: now.said === `Not here. ${says}` && now.rows === 20, said: now.said })
  }
  check('H, #, F and Shift M each say that is not here, and nothing changes', refused.every((r) => r.ok), JSON.stringify(refused.filter((r) => !r.ok)))
  await key('g'); await key('d', 250)
  check('G then D (Drafts) says what there is here', /inbox, Done and Starred here/.test((await inbox()).said ?? ''), String((await inbox()).said))

  // ---- what can be done here is real: Mark Done, Star, Mark Unread
  await key('g'); await key('i', 250)
  const firstId = await p.evaluate((M) => document.querySelector(`${M} .ml-row.on`).id, M)
  await key('e', 300)
  s = await inbox()
  check('E marks the conversation done: it leaves the inbox, and Done is not put among the splits along the top (it is gone to with G then E)', s.rows === 19 && /All 19\*/.test(s.tabs) && !/Done/.test(s.tabs) && s.place === null && s.said === 'Marked Done. Z brings it back.' && !(await p.evaluate(([M, id]) => !!document.querySelector(`${M} #${id}`), [M, firstId])), JSON.stringify(s))
  await key('g'); await key('e', 300)
  s = await inbox()
  const back = await p.evaluate((M) => document.querySelector(`${M} .ml-tabs__back`)?.getAttribute('aria-label'), M)
  check('G then E goes to Done, which has it: the bar says Done in the splits’ place, with the way back to the inbox, and the window’s title says so too', s.rows === 1 && s.tabs === '' && s.place === 'Done 1' && back === 'Back to the inbox' && /^Done \(1\) - Mail$/.test(s.pill ?? '') && (await p.evaluate(([M, id]) => !!document.querySelector(`${M} #${id}`), [M, firstId])), JSON.stringify({ ...s, back }))
  await p.locator(`${M} .ml-tabs__back`).click(); await p.waitForTimeout(250)
  s = await inbox()
  check('its back arrow is the inbox again', s.rows === 19 && /All 19\*/.test(s.tabs) && s.place === null, JSON.stringify(s))
  await key('z', 300)
  s = await inbox()
  check('Z brings it back to the inbox', s.rows === 20 && /All 20\*/.test(s.tabs) && !/Done/.test(s.tabs) && s.said === 'Moved back to the inbox.', JSON.stringify(s))
  await key('s', 250)
  s = await inbox()
  const starred = await p.evaluate((M) => ({ star: !!document.querySelector(`${M} .ml-row.on .ml-star`), tabs: [...document.querySelectorAll(`${M} .ml-tabs button`)].map((b) => b.firstChild.textContent.trim()).join(' ') }), M)
  check('S stars the conversation: a star on its row, and a Starred split', starred.star && / Starred$/.test(starred.tabs) && s.said === 'Starred.', JSON.stringify({ starred, said: s.said }))
  await key('s', 250)
  check('S again takes the star off, and the split goes', !(await p.evaluate((M) => !!document.querySelector(`${M} .ml-row.on .ml-star`), M)) && !/Starred/.test((await inbox()).tabs), (await inbox()).tabs)
  await key('u', 250)
  check('U marks it unread: its row is heavier, with a dot', await p.evaluate((M) => { const r = document.querySelector(`${M} .ml-row.on`); return r.classList.contains('unread') && !!r.querySelector('.ml-dot') }, M))
  await key('Shift+U', 250)
  check('Shift U marks it read again', !(await p.evaluate((M) => document.querySelector(`${M} .ml-row.on`).classList.contains('unread'), M)))
  // (kept in the browser: a reload has them)
  await key('j'); await key('e', 300)
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1600)
  await p.click('.dock [data-dock-app="mail"]'); await p.waitForSelector(`${M}[data-open] .ml-row`, { timeout: 15000 }); await p.waitForTimeout(500)
  s = await inbox()
  check('what was marked done is still done after a reload', s.rows === 19 && !/Done/.test(s.tabs), s.tabs)
  await key('g'); await key('e', 300)
  check('and is in Done', (await inbox()).place === 'Done 1', JSON.stringify(await inbox()))
  await key('Shift+E', 300)
  s = await inbox()
  check('Shift E, in Done, puts it back: with nothing left in it, Done gives way to the inbox', s.rows === 20 && s.place === null && /All 20\*/.test(s.tabs), JSON.stringify(s))

  // ---- done from inside a conversation: on to the next one, not back to the list
  await key('g'); await key('i', 250)
  const order = await p.evaluate((M) => [...document.querySelectorAll(`${M} .ml-row`)].slice(0, 4).map((r) => r.querySelector('.s em').textContent), M)
  await key('Enter', 400)
  const openedOn = await p.evaluate((M) => document.querySelector(`${M} .ml-col h1`)?.textContent, M)
  await key('e', 400)
  let on = await p.evaluate((M) => ({ thread: !!document.querySelector(`${M} .ml-thread`), head: document.querySelector(`${M} .ml-col h1`)?.textContent ?? null, said: document.querySelector(`${M} .ml-said`)?.textContent ?? null }), M)
  check('E inside a conversation marks it done and goes straight on to the next one, as Superhuman does (not back to the list)', openedOn === order[0] && on.thread && on.head === order[1] && on.said === 'Marked Done. Z brings it back.', JSON.stringify({ order, openedOn, on }))
  await p.locator(`${M} .ml-does button[aria-label="Mark done"]`).click(); await p.waitForTimeout(400)
  on = await p.evaluate((M) => ({ thread: !!document.querySelector(`${M} .ml-thread`), head: document.querySelector(`${M} .ml-col h1`)?.textContent ?? null }), M)
  check('and so does its Mark Done button', on.thread && on.head === order[2], JSON.stringify(on))
  await key('Escape', 300)
  s = await inbox()
  check('back in the list, the two are gone from it and it is on the one that was open', s.rows === 18 && !s.thread && (await p.evaluate((M) => document.querySelector(`${M} .ml-row.on .s em`)?.textContent, M)) === order[2], JSON.stringify(s))
  await key('g'); await key('e', 300)
  await key('Shift+E', 300); await key('Shift+E', 300)
  await key('g'); await key('i', 250)
  s = await inbox()
  check('(both put back)', s.rows === 20, JSON.stringify(s))

  // ---- the row under the pointer is the row it is on, at once
  const rowBox = await p.locator(`${M} .ml-row`).nth(5).boundingBox()
  await p.mouse.move(rowBox.x + 260, rowBox.y + rowBox.height / 2, { steps: 3 }); await p.waitForTimeout(120)
  const swept = await p.evaluate((M) => { const rows = [...document.querySelectorAll(`${M} .ml-row`)]; const lit = (r) => getComputedStyle(r).backgroundColor !== 'rgba(0, 0, 0, 0)'; return { on: rows.findIndex((r) => r.classList.contains('on')), hovered: rows.findIndex((r) => r.matches(':hover')), keys: document.querySelector(`${M} .ml`).hasAttribute('data-keys'), acts: !!rows[5].querySelector('.ml-acts') } }, M)
  check('the pointer over a row makes it the row Mail is on (lit by the pointer itself, with what can be done to it at its end)', swept.on === 5 && swept.hovered === 5 && !swept.keys && swept.acts, JSON.stringify(swept))
  await key('j', 200)
  const byKeys = await p.evaluate((M) => { const rows = [...document.querySelectorAll(`${M} .ml-row`)]; return { on: rows.findIndex((r) => r.classList.contains('on')), keys: document.querySelector(`${M} .ml`).hasAttribute('data-keys'), under: getComputedStyle(rows[5]).backgroundColor } }, M)
  check('a key takes the list back from the pointer: J moves on, and the row the pointer is lying on is not lit', byKeys.on === 6 && byKeys.keys && byKeys.under === 'rgba(0, 0, 0, 0)', JSON.stringify(byKeys))
  await p.mouse.move(8, 8); await p.waitForTimeout(100)
  await key('g'); await key('i', 250)

  // ---- a conversation
  await key('j'); await key('Enter', 400)
  const thread = await p.evaluate((M) => {
    const w = document.querySelector(M)
    return {
      head: w.querySelector('.ml-col h1')?.textContent,
      led: [...(w.querySelector('.ml-led')?.children ?? [])].map((c) => c.textContent.trim()).join(' / '),
      folded: w.querySelectorAll('.ml-msg.fold').length,
      open: w.querySelectorAll('article.ml-msg').length,
      does: [...w.querySelectorAll('.ml-does button')].map((b) => b.getAttribute('aria-label') ?? b.textContent.trim()).join(' | '),
      back: w.querySelector('.ml-back')?.getAttribute('aria-label'),
      pane: w.querySelector('.ml-pane').getAttribute('aria-label'),
      pill: w.querySelector('.mlbar__pill').textContent.trim(),
      reply: w.querySelector('.ml-reply')?.innerText.replace(/\s*\n\s*/g, ' / ') ?? null,
      banner: /These twenty are for reading/.test(w.innerText),
    }
  }, M)
  check('Return opens the one it is on: a column with its subject, and one line on what it led to under a label', thread.head === 'Re: [Company] seed round' && /^(investment|intro|hire|drop) \/ \S/.test(thread.led ?? '') && thread.back === 'Back to inbox', JSON.stringify(thread))
  check('its earlier emails are a line each and its newest is open, a card of its own; over it Share, Mark done, the command palette and the way on (no clock); and the pane is still about the sender', thread.folded >= 1 && thread.open === 1 && thread.does === 'Share | Mark done | Command | Previous conversation | Next conversation' && thread.pane === 'About the sender', JSON.stringify(thread))
  check('nothing is written along its foot: no banner under the conversation (a reply is R, or the arrow on an email)', thread.reply === null && !thread.banner, JSON.stringify({ reply: thread.reply, banner: thread.banner }))
  await p.locator(`${M} .ml-msg.fold`).first().click()
  await p.waitForTimeout(200)
  check('an earlier email opens out when it is pressed', (await p.evaluate((M) => ({ closed: document.querySelectorAll(`${M} .ml-msg.fold`).length, open: document.querySelectorAll(`${M} article.ml-msg`).length }), M)).open === 2)
  await p.locator(`${M} article.ml-msg .ml-fold`).first().click()
  await p.waitForTimeout(200)
  check('and an open email closes to its line again when its head is pressed', (await p.evaluate((M) => document.querySelectorAll(`${M} article.ml-msg`).length, M)) === 1)
  // Share: a link that opens this conversation on the desk
  await t.ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
  await p.locator(`${M} .ml-does .t`).click()
  await p.waitForTimeout(350)
  const shared = { said: (await inbox()).said, link: await p.evaluate(() => navigator.clipboard.readText().catch(() => '')), at: new URL(p.url()).searchParams.get('at') }
  check('Share copies a link to this conversation, which the address names', shared.said === 'Link copied. It opens this conversation here.' && /[?&]open=mail/.test(shared.link) && /[?&]at=exchange-\d+/.test(shared.link) && /^exchange-\d+$/.test(shared.at ?? ''), JSON.stringify(shared))
  const tip = await p.evaluate((M) => { const b = document.querySelector(`${M} .ml-does .t`); return { tip: b.dataset.tip, keys: b.dataset.keys, hand: getComputedStyle(b).cursor } }, M)
  check('what can be pressed there says what it is and its key, and shows the pointing hand', tip.tip === 'Share Conversation' && tip.keys === '⌘ S' && tip.hand === 'pointer', JSON.stringify(tip))
  await key('j', 300)
  const next = await p.evaluate((M) => document.querySelector(`${M} .ml-col h1`)?.textContent, M)
  check('J goes on to the next conversation', !!next && next !== thread.head, String(next))
  await p.locator(`${M} .ml-does button[aria-label="Command"]`).click()
  await p.waitForTimeout(300)
  check('the lightning bolt over a conversation opens Mail Command', (await inbox()).pal === 1)
  await key('Escape', 250)
  await key('Escape', 300)
  s = await inbox()
  check('Escape goes back to the inbox, on the row that was open', !s.thread && s.on === 2, JSON.stringify(s))

  // ---- the command palette
  await key('Control+k', 350)
  const pal = await p.evaluate((M) => { const el = document.querySelector(`${M} .ml-pal`); return { role: el?.getAttribute('role'), name: el?.getAttribute('aria-label'), held: document.activeElement?.getAttribute('role'), list: [...el.querySelectorAll('li')].map((li) => `${li.querySelector('span').textContent} ${[...li.querySelectorAll('kbd')].map((k) => k.textContent).join('')}${li.classList.contains('on') ? '*' : ''}`) } }, M)
  check('Command K opens the palette, the keyboard in its field, on what can be done here: Mark Done, Star, Mark Unread, Search, Write to Shrug', pal.role === 'dialog' && pal.name === 'Command' && pal.held === 'combobox' && pal.list.join(' | ') === 'Mark Done E* | Star S | Mark Unread U | Search all twenty / | Write to Shrug C', pal.list.join(' | '))
  await p.keyboard.type('star')
  await p.waitForTimeout(250)
  const found = await p.evaluate((M) => [...document.querySelectorAll(`${M} .ml-pal li`)].map((li) => li.querySelector('span')?.textContent).join(' | '), M)
  await key('Enter', 300)
  s = await inbox()
  check('typed into, it finds commands by name, and only ones that can be done here; run, it is done', /^Star \| Go to Starred$/.test(found) && s.pal === 0 && s.said === 'Starred.', JSON.stringify({ found, said: s.said }))
  await key('s', 250)
  check('and the keyboard is back in the window', /\bml\b/.test(s.held), s.held)

  // ---- search
  await key('/', 300)
  await p.keyboard.type('thank')
  await p.waitForTimeout(250)
  s = await inbox()
  check('/ searches the twenty as it is typed', s.rows === 2 && (await p.evaluate(() => document.activeElement?.closest('label')?.textContent.trim())) === 'Search all twenty', JSON.stringify(s))
  await key('Escape', 250)
  check('Escape ends the search, and all twenty are back', (await inbox()).rows === 20)

  // ---- every key, on one sheet
  await key('?', 300)
  const sheet = await p.evaluate((M) => { const el = document.querySelector(`${M} .ml-sheet`); return { name: el?.getAttribute('aria-label'), groups: [...el.querySelectorAll('h3')].map((h) => h.textContent).join(' | '), lines: el.querySelectorAll('li').length, f6: /F6/.test(el.textContent) } }, M)
  check('? opens every key Mail answers to, in its groups, with the way out of the window', sheet.name === 'Keyboard shortcuts' && sheet.groups === 'Move about | In a conversation | Yours to do | Find and ask | Not here' && sheet.lines >= 45 && sheet.f6, JSON.stringify(sheet))
  await key('Escape', 250)

  // ---- the easter egg
  await key('Control+Shift+E', 400)
  const zero = await p.evaluate((M) => {
    const w = document.querySelector(M)
    const z = w.querySelector('.ml-zero')
    const pic = w.querySelector('.ml-photo')?.getBoundingClientRect()
    const win = w.getBoundingClientRect()
    return { head: z?.querySelector('.ml-hit b')?.textContent.trim(), line: z?.querySelector('.ml-hit span')?.textContent ?? '', back: z?.querySelector('.ml-hit button')?.textContent.replace(/\s+/g, ' ').trim(), rows: w.querySelectorAll('.ml-row').length, pic: !!pic && pic.width >= win.width - 2 && pic.height >= win.height - 2 }
  }, M)
  check('Command Shift E is Inbox Zero: a picture the whole window over, a line from the testimonials at its foot, and the way back', zero.head === 'You’ve hit Inbox Zero!' && zero.pic && /responsive/.test(zero.line) && !/\[/.test(zero.line) && zero.back === 'Press Z to bring them back' && zero.rows === 0, JSON.stringify(zero))
  await key('z', 300)
  check('Z brings all twenty back: nothing was archived', (await inbox()).rows === 20 && !(await inbox()).zero)

  // ---- Writing to Shrug, from here
  const letter = () => p.evaluate((M) => {
    const w = document.querySelector(M)
    const c = w.querySelector('.ml-compose')
    if (!c) return null
    const f = [...c.querySelectorAll('input')]
    return {
      head: c.querySelector('h1').textContent.trim(),
      to: c.querySelector('output').textContent.replace(/\s+/g, ' ').trim(),
      from: f[0].value,
      fromType: f[0].type,
      subject: f[1].value,
      text: c.querySelector('textarea').value,
      send: c.querySelector('.ml-send').textContent.trim(),
      off: c.querySelector('.ml-send').getAttribute('aria-disabled') === 'true',
      says: c.querySelector('.ml-says').textContent.trim(),
      on: document.activeElement === f[0] ? 'from' : document.activeElement === c.querySelector('textarea') ? 'text' : document.activeElement?.tagName ?? '',
      pane: !!w.querySelector('.ml-pane, aside.ml-side'),
      title: w.querySelector('.ss-window__title, .ss-titlebar')?.textContent.trim() ?? '',
    }
  }, M)
  await key('Enter', 300)
  const about = await p.evaluate((M) => document.querySelector(`${M} .ml-thread .ml-head h1`)?.textContent.trim() ?? '', M)
  await key('r', 500)
  let l = await letter()
  check('R in a conversation writes back here, in Mail: a new message to Shrug at its address, with the conversation’s subject (and one Re:)', (await front()) === 'mail' && !!l && l.head === 'New Message' && l.to === 'Shrug hello@shrug.vc' && about.length > 0 && l.subject === (/^re:/i.test(about) ? about : `Re: ${about}`) && l.fromType === 'email', JSON.stringify({ about, l }))
  check('nobody logged in, it asks where to reply to first, and Send waits for an address and something written', !!l && l.from === '' && l.on === 'from' && l.send === 'Send' && l.off, JSON.stringify(l))
  await p.locator(`${M} .ml-compose .ml-send`).click({ force: true }); await p.waitForTimeout(200)
  l = await letter()
  check('Send, with no address, says what is missing and sends nothing', !!l && l.says === 'Add your email, so Shrug can reply.', l?.says)
  await p.locator(`${M} .ml-compose input[type=email]`).fill('sam@example.test')
  await p.locator(`${M} .ml-compose textarea`).fill('A question about the fund.')
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  check('Escape puts it by: back in the conversation, nothing lost', !(await letter()) && (await inbox()).thread)
  await key('Escape', 300)
  await key('c', 400)
  l = await letter()
  check('C writes to Shrug from anywhere, and what was being written is still there', !!l && l.from === 'sam@example.test' && l.text === 'A question about the fund.' && !l.off, JSON.stringify(l))
  await p.keyboard.press('Control+Enter'); await p.waitForTimeout(1500)
  s = await inbox()
  check('Command Return sends it: in the demo it is shown as sent, and says nothing was', !(await letter()) && s.said === 'Message sent. (Demo: nothing was sent.)', s.said)
  await p.locator(`${M} button[aria-label="New message to Shrug"]`).click(); await p.waitForTimeout(400)
  l = await letter()
  check('the pen in the bar writes another, which starts empty', !!l && l.text === '' && l.subject === '', JSON.stringify(l))
  await p.locator(`${M} .ml-compose textarea`).fill('x')
  await p.locator(`${M} .ml-compose .ml-bin`).click(); await p.waitForTimeout(300)
  await key('c', 400)
  l = await letter()
  check('the bin discards what was written', !!l && l.from === '' && l.text === '', JSON.stringify(l))
  await p.keyboard.press('Escape'); await p.waitForTimeout(200)
  check('nothing went wrong on the way', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error('FAILED', e.message.split('\n').slice(0, 10).join('\n'))
  process.exit(1)
})
