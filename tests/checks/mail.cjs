// Mail (design/v1, "Mail"): twenty exchanges that led to something, read-only, in a window drawn after
// Superhuman as it is (Dom's screenshots of it are the look) and driven as Superhuman is. Its keys move about, open, search and ask for the command palette; the ones that would
// send, archive, star or delete say that nothing here changes. Reply opens Messages.
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
  const t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  const p = t.page
  await p.waitForTimeout(1600)
  const front = () => p.evaluate(() => document.querySelector('.wf[data-active]')?.dataset.app ?? null)
  const inbox = () =>
    p.evaluate((M) => {
      const w = document.querySelector(M)
      const rows = [...w.querySelectorAll('.ml-row')]
      return { rows: rows.length, on: rows.findIndex((r) => r.classList.contains('on')), tabs: [...w.querySelectorAll('.ml-tabs button')].map((b) => `${b.textContent.replace(/\s+/g, ' ').trim()}${b.classList.contains('on') ? '*' : ''}`).join(' | '), thread: !!w.querySelector('.ml-thread'), zero: !!w.querySelector('.ml-zero'), said: w.querySelector('.ml-said')?.textContent ?? null, pal: w.querySelectorAll('.ml-pal').length, held: document.activeElement?.className ?? '' }
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
  check('its splits are along the top, each with its count, All picked', s.tabs === 'All 20* | Investments 7 | Intros 6 | Hires 3 | Drops 4', s.tabs)
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
  check('its bar is one long pill that says where this is; under it a rail of icons, the list, and a pane about whoever the row is from', row.pill === 'All (20) - Mail' && row.rail >= 3 && row.pane === 'About the sender' && row.who, JSON.stringify(row))
  check('a row is one line: who, a label for what it led to before the subject and first line, and the day as Superhuman writes it', row.h >= 28 && row.h <= 40 && /^B s d$/.test(row.parts) && /^(investment|intro|hire|drop)$/.test(row.chip) && row.chipIn === 's' && /^\d{1,2} [A-Z]{3}$/.test(row.date) && row.wide <= 0, JSON.stringify(row))
  check('the rows are under headings for when they came, and the row it is on offers what Superhuman offers there', row.groups.split(' | ').length >= 2 && row.acts === 3, JSON.stringify({ groups: row.groups, acts: row.acts }))
  check('it is light, as Superhuman is, and its pane says it is read-only', /^rgb\(2[45]\d, 2[45]\d, 2[45]\d\)$/.test(row.light) && row.readonly === 'Read-only', JSON.stringify({ light: row.light, readonly: row.readonly }))

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

  // ---- what would change mail says so, and changes nothing
  const refused = []
  for (const [k, says] of [['e', 'Nothing is marked done.'], ['s', 'Nothing is starred.'], ['h', 'Nothing is snoozed.'], ['#', 'Nothing is deleted.'], ['u', 'Nothing is marked unread.'], ['f', 'Nothing is forwarded.'], ['Shift+M', 'Nothing is muted.']]) {
    await key(k, 250)
    const now = await inbox()
    refused.push({ k, ok: now.said === `Read-only. ${says}` && now.rows === 20, said: now.said })
  }
  check('E, S, H, #, U, F and Shift M each say Mail is read-only, and nothing changes', refused.every((r) => r.ok), JSON.stringify(refused.filter((r) => !r.ok)))
  await key('g'); await key('s', 250)
  check('G then S (Starred) says there is only the inbox', /only the inbox here/.test((await inbox()).said ?? ''), String((await inbox()).said))

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
      reply: w.querySelector('.ml-reply')?.innerText.replace(/\s*\n\s*/g, ' / '),
    }
  }, M)
  check('Return opens the one it is on: a column with its subject, and one line on what it led to under a label', thread.head === 'Re: [Company] seed round' && /^(investment|intro|hire|drop) \/ \S/.test(thread.led ?? '') && thread.back === 'Back to inbox', JSON.stringify(thread))
  check('its earlier emails are a line each and its newest two are open, in one card; over it what Superhuman offers, and the pane is still about the sender', thread.folded === 2 && thread.open === 2 && thread.does === 'Share | Mark done | Remind me | Instant reply | Previous conversation | Next conversation' && thread.pane === 'About the sender', JSON.stringify(thread))
  check('under it: nothing sends from here, and Reply to Shrug', /^Nothing sends from here\. Reply opens a new message to Shrug in Messages\. \/ Reply to Shrug/.test(thread.reply ?? ''), thread.reply)
  await p.locator(`${M} .ml-msg.fold`).first().click()
  await p.waitForTimeout(200)
  check('an earlier email opens out when it is pressed', (await p.evaluate((M) => document.querySelectorAll(`${M} .ml-msg.fold`).length, M)) === 1)
  await key('j', 300)
  const next = await p.evaluate((M) => document.querySelector(`${M} .ml-col h1`)?.textContent, M)
  check('J goes on to the next conversation', !!next && next !== thread.head, String(next))
  await p.locator(`${M} .ml-does button[aria-label="Mark done"]`).click()
  await p.waitForTimeout(250)
  check('what Superhuman offers over a conversation says Mail is read-only', (await inbox()).said === 'Read-only. Nothing is marked done.', String((await inbox()).said))
  await key('Escape', 300)
  s = await inbox()
  check('Escape goes back to the inbox, on the row that was open', !s.thread && s.on === 2, JSON.stringify(s))

  // ---- the command palette
  await key('Control+k', 350)
  const pal = await p.evaluate((M) => { const el = document.querySelector(`${M} .ml-pal`); return { role: el?.getAttribute('role'), name: el?.getAttribute('aria-label'), held: document.activeElement?.getAttribute('role'), list: [...el.querySelectorAll('li')].map((li) => `${li.querySelector('span').textContent} ${[...li.querySelectorAll('kbd')].map((k) => k.textContent).join('')}${li.classList.contains('on') ? '*' : ''}`) } }, M)
  check('Command K opens the palette, the keyboard in its field, on the six the design lists', pal.role === 'dialog' && pal.name === 'Command' && pal.held === 'combobox' && pal.list.join(' | ') === 'Achieve Inbox Zero ⌘⇧E* | Go to Inbox GI | Reply to Shrug in Messages R | Open what this led to O | Search all twenty / | Show keyboard shortcuts ?', pal.list.join(' | '))
  await p.keyboard.type('star')
  await p.waitForTimeout(250)
  const found = await p.evaluate((M) => [...document.querySelectorAll(`${M} .ml-pal li`)].map((li) => li.querySelector('span')?.textContent).join(' | '), M)
  await key('Enter', 300)
  s = await inbox()
  check('typed into, it finds commands by name; one that would change mail runs as a refusal', /^Star \| Go to Starred$/.test(found) && s.pal === 0 && s.said === 'Read-only. Nothing is starred.', JSON.stringify({ found, said: s.said }))
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
  check('? opens every key Mail answers to, in its groups, with the way out of the window', sheet.name === 'Keyboard shortcuts' && sheet.groups === 'Move about | In a conversation | Find and ask | Read-only here' && sheet.lines >= 45 && sheet.f6, JSON.stringify(sheet))
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

  // ---- Reply opens Messages
  await key('Enter', 300)
  await key('r', 700)
  check('R in a conversation opens Messages, where a reply is a new message to Shrug', (await front()) === 'messages')
  check('nothing went wrong on the way', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error('FAILED', e.message.split('\n').slice(0, 10).join('\n'))
  process.exit(1)
})
