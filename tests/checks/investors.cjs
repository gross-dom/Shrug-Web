// What Dom's notes of 27 Nov added for investors, and around them: Accredited Investors Only, which asks an
// LP which deals they want to see and anyone else what an application to become one asks; the Updates folder
// as anyone is shown it (one update for everyone, the rest locked); the Investor Portal folder, which is
// empty; the emails in Mail that are for someone logged in; Workspace's catalogue; and shelves with no prices.
//   node investors.cjs http://127.0.0.1:4273/
const A = require('./lib.cjs')
const BASE = process.argv[2] || A.BASE

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

;(async () => {
  const browser = await A.launch()
  const I = '.wf[data-app="investors"]'
  const U = '.wf[data-app="updates"]'
  const P = '.wf[data-app="preview"]'
  const M = '.wf[data-app="mail"]'
  const W = '.wf[data-app="workspace"]'
  const page = (p) => p.evaluate((I) => { const w = document.querySelector(I); const pg = w?.querySelector('.inv-page'); return pg ? { kind: pg.dataset.kind, head: pg.querySelector('h1')?.textContent ?? '', says: [...pg.querySelectorAll(':scope > p')].map((x) => x.textContent).join(' / '), choices: [...pg.querySelectorAll('.inv-choice')].map((c) => `${c.textContent}${c.getAttribute('aria-checked') === 'true' ? '*' : ''}`), role: pg.querySelector('.inv-choices')?.getAttribute('role') ?? null, go: w.querySelector('.inv-go')?.textContent.trim(), ready: w.querySelector('.inv-go')?.getAttribute('aria-disabled') !== 'true', back: !!w.querySelector('.inv-back'), steps: [...w.querySelectorAll('.inv-steps i')].map((i) => (i.hasAttribute('data-on') ? '1' : '0')).join(''), link: w.querySelector('.inv-link')?.textContent.trim() ?? null } : null }, I)
  const go = async (p) => { await p.locator(`${I} .inv-go`).click(); await p.waitForTimeout(650) }
  const pick = async (p, text) => { await p.locator(`${I} .inv-choice`, { hasText: text }).first().click(); await p.waitForTimeout(150) }
  const logIn = async (p, email, phone, name) => {
    await p.locator('.account input[type=email]').fill(email)
    await p.keyboard.press('Enter'); await p.waitForTimeout(900)
    await p.keyboard.type(phone); await p.keyboard.press('Enter'); await p.waitForTimeout(900)
    await p.keyboard.type('246810'); await p.waitForTimeout(1500)
    await p.keyboard.type(name); await p.locator('.account__go').click(); await p.waitForTimeout(1900)
  }

  /** An address on Shrug's list: confirmed by its inbox first, then a number to use from then on, then the name Shrug has for them. */
  const logInLP = async (p, phone) => {
    await p.locator('.account input[type=email]').fill('lp@example.test')
    await p.keyboard.press('Enter'); await p.waitForTimeout(900)
    await p.keyboard.type('246810'); await p.waitForTimeout(1500)
    await p.keyboard.type(phone); await p.keyboard.press('Enter'); await p.waitForTimeout(900)
    await p.keyboard.type('246810'); await p.waitForTimeout(1500)
    await p.locator('.account__go').click(); await p.waitForTimeout(1900)
  }

  // ---- Accredited Investors Only, for someone who is not an LP: an application
  let t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  let p = t.page
  await p.waitForTimeout(1600)
  const icon = await p.evaluate(() => { const el = document.querySelector('[data-desk="investors"]'); const name = el?.querySelector('.desk__name'); return { says: el?.getAttribute('aria-label'), lines: name ? Math.round(name.getBoundingClientRect().height / 15) : 0, drawn: !!el?.querySelector('svg.app-icon'), dock: document.querySelectorAll('.dock [data-dock-app="investors"]').length } })
  check('Accredited Investors Only is on the desk under Updates, its name on two lines, and is not in the Dock', icon.says === 'Accredited Investors Only, desktop icon' && icon.lines === 2 && icon.drawn && icon.dock === 0, JSON.stringify(icon))
  await p.locator('[data-desk="investors"]').dblclick()
  await p.waitForSelector(`${I}[data-open] .inv-page`, { timeout: 15000 })
  await p.waitForTimeout(700)
  let at = await page(p)
  const shape = await p.evaluate((I) => { const r = document.querySelector(I).getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), grips: document.querySelectorAll(`${I} .wf__grip`).length, title: document.title, menu: document.querySelector('.menubar__menu[data-strong] .menubar__title')?.textContent } }, I)
  check('opened, it is a window of its one size, named in the bar and the tab, that cannot be sized', shape.w >= 520 && shape.w <= 560 && shape.h >= 560 && shape.grips === 0 && /^Accredited Investors Only/.test(shape.title) && shape.menu === 'Accredited Investors Only', JSON.stringify(shape))
  check('its first page says what it is for, with one button and, for nobody logged in, the way in for an LP', at.kind === 'intro' && at.head === 'Accredited Investors Only' && /^Apply to invest with Shrug/.test(at.says) && at.go === 'Get Started' && at.ready && !at.back && at.steps === '' && at.link === 'Already an LP? Log In', JSON.stringify(at))
  await go(p)
  at = await page(p)
  check('then its questions, one to a page: the first, with how far along at its head and a way back; Continue waits for an answer', at.head === 'What are you interested in?' && at.role === 'group' && at.choices.join(' | ') === 'Becoming an LP in a Shrug fund | Receiving SPVs, deal by deal' && at.go === 'Continue' && !at.ready && at.back && at.steps === '1000', JSON.stringify(at))
  await pick(p, 'Becoming an LP')
  await pick(p, 'Receiving SPVs')
  at = await page(p)
  check('more than one may be chosen where it says so, each marked as it is', at.choices.join(' | ') === 'Becoming an LP in a Shrug fund* | Receiving SPVs, deal by deal*' && at.ready, at.choices.join(' | '))
  await go(p)
  at = await page(p)
  check('the next is one choice of three', at.head === 'Are you an accredited investor?' && at.role === 'radiogroup' && at.choices.join(' | ') === 'Yes | No | I’m not sure' && !at.ready && at.steps === '1100', JSON.stringify(at))
  await pick(p, 'No')
  await pick(p, 'Yes')
  at = await page(p)
  check('choosing another takes the place of the first', at.choices.join(' | ') === 'Yes* | No | I’m not sure' && at.ready, at.choices.join(' | '))
  // (the way back keeps what was answered)
  await p.locator(`${I} .inv-back`).click(); await p.waitForTimeout(600)
  at = await page(p)
  check('the way back comes to the question before, still answered', at.head === 'What are you interested in?' && at.choices.every((c) => c.endsWith('*')), JSON.stringify(at.choices))
  await go(p)
  await go(p)
  at = await page(p)
  check('then what they are looking to invest, as one of five', at.head === 'How much are you looking to invest over the next 12 months?' && at.choices.length === 5 && at.choices[0] === 'Under $25,000' && at.choices[4] === 'Over $1 million' && at.steps === '1110', JSON.stringify(at))
  await pick(p, '$100,000 to $250,000')
  await go(p)
  at = await page(p)
  const fields = await p.evaluate((I) => [...document.querySelectorAll(`${I} .inv-field`)].map((f) => `${f.querySelector('span').textContent}:${f.querySelector('input, textarea').tagName.toLowerCase()}:${f.querySelector('input')?.type ?? ''}`).join(' | '), I)
  check('and last, where to reach them: a name, an email and anything else, with Submit', at.head === 'Where can we reach you?' && at.kind === 'fields' && fields === 'Name:input:text | Email:input:email | Anything we should know?:textarea:' && at.go === 'Submit' && !at.ready && at.steps === '1111', JSON.stringify({ at, fields }))
  await p.locator(`${I} .inv-field input[type=text]`).fill('Pat Example')
  await p.locator(`${I} .inv-field input[type=email]`).fill('pat@example')
  check('Submit waits for a name and an address that is one', !(await page(p)).ready)
  await p.locator(`${I} .inv-field input[type=email]`).fill('pat@example.com')
  await p.waitForTimeout(150)
  check('and is ready once it has them; the note is not asked for', (await page(p)).ready)
  await go(p)
  await p.waitForTimeout(1200)
  at = await page(p)
  check('sent, it says so in Dom’s words, and that the demo sent nothing; its button is Done', at.kind === 'done' && at.head === 'Thank you, we’ll be in touch.' && /Your application is with Shrug\./.test(at.says) && /Demo: nothing was sent\./.test(at.says) && at.go === 'Done' && !at.back, JSON.stringify(at))
  await go(p)
  check('Done closes the window', (await p.locator(`${I}[data-open]`).count()) === 0)

  // ---- the Updates folder, as anyone is shown it: the update for everyone is read with nobody logged in
  await p.locator('[data-desk="updates"]').dblclick()
  await p.waitForSelector(`${U}[data-open] .upd-row`, { timeout: 15000 })
  await p.waitForTimeout(500)
  await p.locator(`${U} .upd-row[data-doc="update-4"] button`).click()
  await p.waitForSelector(`${P} .pv-canvas[data-drawn]`, { timeout: 30000 })
  await p.waitForTimeout(800)
  const read = await p.evaluate((P) => { const w = document.querySelector(P); return { name: w.querySelector('.pvbar__name, .pvbar b')?.textContent.trim(), tag: [...w.querySelectorAll('.pvbar .v-chip')].map((c) => c.textContent.trim()).join(), pages: w.querySelectorAll('.pv-thumbs button, .pv-thumb').length, forWhom: w.querySelector('.pv-for')?.textContent ?? null, sheet: document.querySelectorAll('.account').length } }, P)
  check('Update 4, which is for everyone, opens in Preview with nobody logged in: its pages drawn, not tagged Private, and nobody’s name under them', /Update 4\.pdf/.test(read.name ?? '') && !/Private/.test(read.tag) && read.forWhom === null && read.sheet === 0, JSON.stringify(read))
  const closedRow = await p.evaluate((U) => { const r = document.querySelector(`${U} .upd-row[data-doc="update-1"]`); return { button: r.querySelectorAll('button').length, says: r.querySelector('.s').textContent.trim(), sub: r.querySelector('small').textContent } }, U)
  check('a locked update has no button: it says who it was written for, and LPs only', closedRow.button === 0 && closedRow.says === 'LPs only' && closedRow.sub === 'Written for Shrug 1 LPs', JSON.stringify(closedRow))
  check('nothing went wrong on the way', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- Accredited Investors Only, for an LP: logged in from its first page, they are asked which deals they
  // want to see, and its last page opens their Updates folder
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  p = t.page
  await p.waitForTimeout(1600)
  await p.locator('[data-desk="investors"]').dblclick()
  await p.waitForSelector(`${I}[data-open] .inv-page`, { timeout: 15000 })
  await p.waitForTimeout(600)
  await p.locator(`${I} .inv-link`).click()
  await p.waitForTimeout(500)
  const why = await p.evaluate(() => ({ head: document.querySelector('.account__head')?.textContent, lead: document.querySelector('.account__lead')?.textContent }))
  check('"Already an LP? Log In" lets Log In down, which says what for', why.head === 'Log in as an LP' && /LP email/.test(why.lead ?? ''), JSON.stringify(why))
  await logInLP(p, '4155550190')
  await p.waitForTimeout(600)
  at = await page(p)
  check('logged in as an LP, the window is theirs from its first page: it greets them by name and says what it will ask', at?.kind === 'intro' && at.head === 'Welcome back, Jordan.' && /which deals you want to see/.test(at.says) && at.link === null, JSON.stringify(at))
  await go(p)
  at = await page(p)
  check('it asks which stages, any number of them', at.head === 'Which stages do you want to see?' && at.role === 'group' && at.choices.join(' | ') === 'Pre-seed | Seed | Series A | Series B and later | Secondaries' && at.steps === '100', JSON.stringify(at))
  await pick(p, 'Seed')
  await pick(p, 'Series A')
  await go(p)
  at = await page(p)
  const cols = await p.evaluate((I) => new Set([...document.querySelectorAll(`${I} .inv-choice`)].map((c) => Math.round(c.getBoundingClientRect().left))).size, I)
  check('then which categories: the portfolio’s own verticals, two to a line', at.head === 'Which categories?' && at.choices.join(' | ') === 'Deep tech | Climate and energy | Creator | Health | Consumer | Fintech | Web3 | Marketplaces | AI | Products | Enterprise' && cols === 2, JSON.stringify({ choices: at.choices, cols }))
  await pick(p, 'Deep tech')
  await go(p)
  at = await page(p)
  check('and how they would have them sent, with Save', at.head === 'How should we send them?' && at.choices.join(' | ') === 'Email | Text message | Either' && at.go === 'Save' && at.steps === '111', JSON.stringify(at))
  await pick(p, 'Email')
  await go(p)
  await p.waitForTimeout(700)
  at = await page(p)
  check('saved, it says they are set, and that their Updates folder is open', at?.kind === 'done' && at.head === 'You’re all set.' && /Updates folder is open/.test(at.says) && at.go === 'Open Updates', JSON.stringify(at))
  await p.waitForSelector(`${U}[data-open] .upd-row`, { timeout: 8000 }).catch(() => {})
  await p.waitForTimeout(900)
  const after = await p.evaluate(({ I, U }) => ({ investors: !!document.querySelector(`${I}[data-open]`), front: document.querySelector('.wf[data-active]')?.dataset.app, rows: [...document.querySelectorAll(`${U} .upd-row`)].map((r) => `${r.querySelector('b').textContent}:${r.dataset.state}`).join(' | '), lock: !!document.querySelector('[data-desk="updates"] [data-lock]') }), { I, U })
  check('and it does: the folder opens in front with what is theirs, and the questions are put away', !after.investors && after.front === 'updates' && after.rows === 'Update 1:request | Update 2:open | Update 3:request | Update 4:open' && !after.lock, JSON.stringify(after))

  // ---- Investor Portal: a folder with nothing in it
  await p.locator('[data-desk="portal"]').dblclick()
  await p.waitForSelector('.wf[data-app="portal"][data-open]', { timeout: 15000 })
  await p.waitForTimeout(600)
  const portal = await p.evaluate(() => { const w = document.querySelector('.wf[data-app="portal"]'); return { icon: document.querySelector('[data-desk="portal"]').getAttribute('aria-label'), folder: !!document.querySelector('[data-desk="portal"] .folder-icon'), title: w.querySelector('.ss-window__title')?.textContent ?? w.querySelector('.ss-window__bar')?.textContent.trim(), foot: w.querySelector('.portal__foot')?.textContent, things: w.querySelector('.portal__empty').children.length, front: document.querySelector('.wf[data-active]')?.dataset.app } })
  check('Investor Portal is a folder on the desk; opened, it is an empty window that says so at its foot', portal.icon === 'Investor Portal, desktop icon' && portal.folder && /Investor Portal/.test(portal.title ?? '') && portal.foot === '0 items' && portal.things === 0 && portal.front === 'portal', JSON.stringify(portal))
  check('nothing went wrong on the way (an LP)', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- Mail: the exchanges that are for someone logged in
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty&open=mail' })
  p = t.page
  await p.waitForSelector(`${M}[data-open] .ml-row`, { timeout: 20000 })
  await p.waitForTimeout(900)
  const rows = await p.evaluate((M) => { const all = [...document.querySelectorAll(`${M} .ml-row`)]; const shut = all.filter((r) => r.classList.contains('locked')); return { all: all.length, shut: shut.length, chips: [...new Set(shut.map((r) => r.querySelector('.ml-chip').textContent))].join(), says: [...new Set(shut.map((r) => r.querySelector('.s').lastChild.textContent.trim()))].join(), locks: shut.every((r) => !!r.querySelector('.ml-lock')), open: all.filter((r) => !r.classList.contains('locked')).every((r) => !r.querySelector('.ml-lock') && !/Log in to read/.test(r.textContent)) } }, M)
  check('to nobody logged in, seven of the twenty have a lock before their subject and "Log in to read" where their first line would be; the rest are as they were', rows.all === 20 && rows.shut === 7 && rows.chips === 'investment' && rows.says === 'Log in to read' && rows.locks && rows.open, JSON.stringify(rows))
  await p.locator(`${M} .ml-row.locked`).first().click()
  await p.waitForTimeout(900)
  const shut = await p.evaluate((M) => ({ pane: document.querySelector(`${M} .ml-shut__in`)?.innerText.replace(/\s*\n\s*/g, ' / ') ?? '', emails: document.querySelectorAll(`${M} .ml-thread .ml-col`).length, head: document.querySelector('.account__head')?.textContent, lead: document.querySelector('.account__lead')?.textContent }), M)
  check('one opened says what it is and who it is for, shows none of its emails, and lets Log In down, which says what for', /^Intro: \[Founder\] and \[Investor\] \/ From \[Founder 01\]\. This one is for people who are logged in\. \/ Log In to Read$/.test(shut.pane) && shut.emails === 0 && shut.head === 'Log in to read this', JSON.stringify(shut))
  await logIn(p, 'riley@example.com', '4155550191', 'Riley Example')
  await p.waitForTimeout(700)
  const opened = await p.evaluate((M) => ({ thread: document.querySelectorAll(`${M} .ml-thread .ml-col`).length, shut: document.querySelectorAll(`${M} .ml-shut__in`).length, subject: document.querySelector(`${M} .ml-head h1`)?.textContent.trim() ?? '' }), M)
  check('logged in, it is there to read, where it was asked for', opened.thread === 1 && opened.shut === 0 && /^Intro: \[Founder\] and \[Investor\]/.test(opened.subject), JSON.stringify(opened))
  await p.locator(`${M} .ml-back`).click(); await p.waitForTimeout(600)
  check('and no row has a lock', (await p.locator(`${M} .ml-row.locked`).count()) === 0 && (await p.locator(`${M} .ml-row`).count()) === 20)
  check('nothing went wrong on the way (Mail)', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- Workspace's catalogue, and shelves without prices
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty&open=workspace' })
  p = t.page
  await p.waitForSelector(`${W}[data-open] .fl-slab`, { timeout: 20000 })
  await p.waitForTimeout(800)
  const pills = await p.evaluate((W) => [...document.querySelectorAll(`${W} .wxbar .pill`)].map((b) => b.textContent.trim()).join(' | '), W)
  check('Workspace’s bar has Catalog before BTS and Notable Owners', pills === 'Catalog | BTS | Notable Owners', pills)
  await p.locator(`${W} .wxbar .pill`, { hasText: 'Catalog' }).click()
  await p.waitForSelector(`${W} .cat-grid img`, { timeout: 10000 })
  await p.waitForFunction((W) => [...document.querySelectorAll(`${W} .cat-grid img`)].slice(0, 8).every((i) => i.complete && i.naturalWidth > 0), W, { timeout: 15000 }).catch(() => {})
  await p.waitForTimeout(500)
  const cat = await p.evaluate((W) => { const tiles = [...document.querySelectorAll(`${W} .cat-grid button`)]; const r = tiles.map((b) => b.getBoundingClientRect()); const first = r.filter((x) => Math.abs(x.top - r[0].top) < 2); const css = getComputedStyle(tiles[0]); return { n: tiles.length, perLine: first.length, gapX: Math.round(first[1].left - first[0].right), gapY: Math.round(r[4].top - r[0].bottom), shape: Math.round((r[0].width / r[0].height) * 100) / 100, same: r.every((x) => Math.abs(x.width - r[0].width) < 1 && Math.abs(x.height - r[0].height) < 1), round: parseFloat(css.borderTopLeftRadius), words: document.querySelector(`${W} .cat`).innerText.trim(), names: tiles.map((b) => b.getAttribute('aria-label')).slice(0, 3).join(' | '), ground: getComputedStyle(document.querySelector(`${W} .ss-window`)).backgroundColor, cover: getComputedStyle(tiles[0].querySelector('img')).objectFit, pressed: document.querySelector(`${W} .wxbar .pill[aria-pressed="true"]`)?.textContent.trim() } }, W)
  check('the catalogue is every color by one upright photograph, four to a line in an even grid with rounded corners, on the store’s dark ground', cat.n === 24 && cat.perLine === 4 && cat.gapX === cat.gapY && cat.gapX >= 12 && cat.shape === 0.8 && cat.same && cat.round >= 12 && cat.cover === 'cover' && cat.ground === 'rgb(12, 12, 13)' && cat.pressed === 'Catalog', JSON.stringify(cat))
  check('nothing is written on a photograph or under it: each is named only to someone who cannot see it', cat.words === 'Catalog: every color' && cat.names === 'Matte Leather: to its checkout | Scuderia Red: to its checkout | Solar Orange: to its checkout', JSON.stringify({ words: cat.words, names: cat.names }))
  await p.locator(`${W} .cat-grid button`).nth(2).click()
  await p.waitForFunction(() => /[?&]p=chair-solar-orange/.test([...document.querySelectorAll('.wf[data-app="workspace"] iframe')].map((f) => f.contentWindow?.location.search ?? '').join(' ')), null, { timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(1500)
  const bought = await p.evaluate((W) => { const f = document.querySelector(`${W} iframe`); return { search: f?.contentWindow.location.search ?? '', title: f?.contentDocument.querySelector('.ui-col h1, .ui-col .t-title')?.textContent ?? '', back: document.querySelector(`${W} .wxbar__back`)?.textContent.trim(), rail: [...(f?.contentDocument.querySelectorAll('.ui-rail li') ?? [])].map((li) => li.textContent.trim()).slice(0, 4).join(' | ') } }, W)
  check('one pressed goes straight to that color’s page to be bought, with the way back to the catalogue', /p=chair-solar-orange/.test(bought.search) && bought.title === 'Solar Orange' && bought.back === 'Back to Catalog', JSON.stringify(bought))
  check('the row of other chairs along that page’s foot names each and gives no price', bought.rail.length > 0 && !/\$/.test(bought.rail), bought.rail)
  await p.locator(`${W} .wxbar__back`).click()
  await p.waitForTimeout(700)
  check('Back to Catalog comes back to it', (await p.locator(`${W} .cat-grid`).count()) === 1)
  await p.locator('.dock [data-dock-app="store"]').click()
  await p.waitForSelector('.wf[data-app="store"][data-open] iframe', { timeout: 20000 })
  await p.waitForFunction(() => (document.querySelector('.wf[data-app="store"] iframe')?.contentDocument?.querySelectorAll('.ui-prod').length ?? 0) > 0, null, { timeout: 20000 }).catch(() => {})
  await p.waitForTimeout(700)
  const shelf = await p.evaluate(() => { const d = document.querySelector('.wf[data-app="store"] iframe').contentDocument; const tiles = [...d.querySelectorAll('.ui-prod')]; return { n: tiles.length, caps: tiles.map((x) => x.querySelector('.ui-prod-cap').textContent.trim()).join(' | ') } })
  check('ArtStore’s shelf names each piece and gives no price', shelf.n >= 3 && !/\$|Free|On request/.test(shelf.caps), shelf.caps)
  await p.evaluate(() => document.querySelector('.wf[data-app="store"] iframe').contentDocument.querySelector('.ui-prod').click())
  await p.waitForTimeout(1800)
  const piece = await p.evaluate(() => document.querySelector('.wf[data-app="store"] iframe').contentDocument.querySelector('.ui-col')?.innerText ?? '')
  check('a piece opened says its price, on its own page', /\$\d/.test(piece), piece.replace(/\s+/g, ' ').slice(0, 120))
  check('nothing went wrong on the way (Workspace and ArtStore)', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error('FAILED', e.message.split('\n').slice(0, 10).join('\n'))
  process.exit(1)
})
