// Preview, and what opens in it (design/v1, "Updates", "Preview", "One-pager"): the one-pager, which is a
// file on the desk and anyone's to read; and an LP's documents, from the Updates folder. Preview is in the
// Dock only while a document is open. (The site is built as a demo until the store's server is live: an
// address beginning "lp" is on the list, in Shrug 2 and Shrug 4, and any six digits but 000000 are right.)
//   node preview.cjs http://127.0.0.1:4273/
const A = require('./lib.cjs')
const BASE = process.argv[2] || A.BASE

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

;(async () => {
  const browser = await A.launch()
  const P = '.wf[data-app="preview"]'
  const U = '.wf[data-app="updates"]'
  const dock = (p) => p.evaluate(() => [...document.querySelector('.dock__shelf').children].map((el) => (el.classList.contains('dock__rule') ? '|' : `${el.dataset.dockApp}${el.hasAttribute('data-open') ? '*' : ''}`)).join(' '))
  const front = (p) => p.evaluate(() => document.querySelector('.wf[data-active]')?.dataset.app ?? null)
  /** What Preview's bar says, and which of its buttons can be pressed. */
  const bar = (p) =>
    p.evaluate((P) => {
      const w = document.querySelector(P)
      const off = (name) => w.querySelector(`.pvbar button[aria-label^="${name}"]`)?.getAttribute('aria-disabled') === 'true'
      return { name: w.querySelector('.pvbar__title b')?.textContent, tag: w.querySelector('.pvbar__private')?.textContent.trim() ?? null, sub: w.querySelector('.pvbar__sub')?.textContent, zoom: w.querySelector('.pvbar__pct')?.textContent, noDownload: off('Download'), noFull: off('Full Screen'), download: w.querySelector('.pvbar button[aria-label^="Download"]')?.getAttribute('aria-label') }
    }, P)
  const pages = (p) =>
    p.evaluate((P) => {
      const w = document.querySelector(P)
      const main = w.querySelector('.pv-main')
      const first = w.querySelector('.pv-page')?.getBoundingClientRect()
      const room = main?.getBoundingClientRect()
      return { n: w.querySelectorAll('.pv-pages .pv-page').length, thumbs: w.querySelectorAll('.pv-thumbcell').length, on: [...w.querySelectorAll('.pv-thumbcell')].findIndex((t) => t.getAttribute('aria-current')), page: first ? `${Math.round(first.width)}x${Math.round(first.height)}` : null, whole: !!first && !!room && first.top >= room.top && first.bottom <= room.bottom, ground: main ? getComputedStyle(main).backgroundColor : null, forWhom: w.querySelector('.pv-for')?.textContent ?? null }
    }, P)
  const logInLP = async (p) => {
    await p.locator('.menubar__login').click()
    await p.locator('.account input[type=email]').fill('lp@example.test')
    await p.keyboard.press('Enter')
    await p.waitForTimeout(900)
    await p.keyboard.type('246810')
    await p.waitForTimeout(1500)
    await p.keyboard.type('4155550177')
    await p.keyboard.press('Enter')
    await p.waitForTimeout(900)
    await p.keyboard.type('246810')
    await p.waitForTimeout(1500)
    await p.locator('.account__go').click()
    await p.waitForTimeout(1100)
  }

  // ---- the one-pager: a file on the desk, and it opens in Preview
  let t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  let p = t.page
  await p.waitForTimeout(1600)
  check('at rest the Dock has its apps, no rule after them and no Preview', (await dock(p)) === A.DOCK_IDS.join(' '), await dock(p))
  const file = await p.evaluate(() => { const b = document.querySelector('[data-desk="one-pager"]'); return { tag: b.tagName, says: b.getAttribute('aria-label'), links: document.querySelectorAll('.desk a').length } })
  check('the one-pager on the desk is a file, and no link: nothing says it opens anywhere else', file.tag === 'BUTTON' && file.says === 'One-pager, desktop icon' && file.links === 0, JSON.stringify(file))
  const tabs = t.ctx.pages().length
  await p.locator('[data-desk="one-pager"]').dblclick()
  await p.waitForSelector(`${P}[data-open] .pv-pages .op`, { timeout: 20000 })
  await p.waitForTimeout(900)
  const size = await p.evaluate((P) => { const r = document.querySelector(P).getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}` }, P)
  let b = await bar(p)
  let pg = await pages(p)
  check('opened, it is in Preview: a window of this desk, 980 by 720, in front, and no tab', size === '980x720' && (await front(p)) === 'preview' && t.ctx.pages().length === tabs && /^Preview/.test(await p.title()), JSON.stringify({ size }))
  check('Preview is in the Dock now, after a rule, with its dot', (await dock(p)) === `${A.DOCK_IDS.join(' ')} | preview*`, await dock(p))
  check('its bar has the file’s name over which page it is on, with no Private tag, and Download and Full Screen to press', b.name === 'One-pager.pdf' && b.tag === null && b.sub === 'Page 1 of 2' && !b.noDownload && !b.noFull && b.download === 'Download', JSON.stringify(b))
  check('its two pages are down the side, the first picked, and the first page is whole in the window, on Preview’s pale ground while the desk is light', pg.n === 2 && pg.thumbs === 2 && pg.on === 0 && pg.whole && pg.ground === 'rgb(255, 255, 255)' && pg.forWhom === null, JSON.stringify(pg))
  check('the page is fitted: a US Letter page at the 78% the window gives it', b.zoom === '78%' && pg.page === '478x619', JSON.stringify({ zoom: b.zoom, page: pg.page }))
  const sheet = await p.evaluate((P) => { const op = document.querySelector(`${P} .pv-pages .op`); return { mark: !!op.querySelector('.op-top svg'), wordmark: op.querySelector('.op-top [role=img]')?.getAttribute('aria-label'), top: op.querySelector('.op-top > span').textContent, stats: [...op.querySelectorAll('.op-stats')][0].innerText.replace(/\s*\n\s*/g, ' '), font: getComputedStyle(op).fontFamily.split(',')[0].replace(/["']/g, '') } }, P)
  check('the page is Shrug’s: an official document, so it is headed with the name in full, SHRUG CAPITAL, in the wordmark’s letters; set in its type, with what the site knows written in (the count of companies, the year)', sheet.mark && sheet.wordmark === 'Shrug Capital' && /1 of 2$/.test(sheet.top) && /\b79 Companies backed\b/.test(sheet.stats) && /\b2017 Investing since\b/.test(sheet.stats) && sheet.font === 'Inter Variable', JSON.stringify(sheet))

  const words = await p.evaluate((P) => [...document.querySelectorAll(`${P} .pv-pages .op`)].map((op) => op.innerText).join('\n'), P)
  check('nothing on its pages is a note for Shrug: no line is in square brackets, and what stands there is what the site says (its rules, its first testimonials)', !/\[[^\]]*\]/.test(words) && /We always come with gifts!/.test(words) && /Kevin Olusola/.test(words) && /Shrug Capital is an early-stage venture fund\./.test(words.replace(/\s+/g, ' ')), words.match(/\[[^\]]*\]/)?.[0] ?? '')

  // the bar: zoom, the sidebar, and the keys
  await p.locator(`${P} .pvbar button[aria-label="Zoom In"]`).click()
  await p.waitForTimeout(300)
  const bigger = { ...(await bar(p)), ...(await pages(p)) }
  await p.locator(`${P} .pvbar__pct`).click()
  await p.waitForTimeout(300)
  check('Zoom In makes the page a quarter bigger and the bar says so; the percentage puts it back to fitted', bigger.zoom === '98%' && bigger.page === '598x774' && (await bar(p)).zoom === '78%', JSON.stringify({ zoom: bigger.zoom, page: bigger.page }))
  await p.locator(`${P} .pv-thumbcell`).nth(1).click()
  await p.waitForTimeout(400)
  check('a page picked in the sidebar is the page it goes to', (await bar(p)).sub === 'Page 2 of 2' && (await pages(p)).on === 1)
  await p.locator(`${P} .pv-main`).focus()
  await p.keyboard.press('ArrowLeft')
  await p.waitForTimeout(300)
  check('the arrow keys step through the pages', (await bar(p)).sub === 'Page 1 of 2')
  await p.locator(`${P} .pvbar button[aria-label="Hide Sidebar"]`).click()
  await p.waitForTimeout(300)
  const hidden = await pages(p)
  await p.locator(`${P} .pvbar button[aria-label="Show Sidebar"]`).click()
  await p.waitForTimeout(300)
  check('the sidebar’s switch puts the thumbnails away and brings them back', hidden.thumbs === 0 && (await pages(p)).thumbs === 2)

  // Download hands over the file, by its name
  const [saved] = await Promise.all([p.waitForEvent('download'), p.locator(`${P} .pvbar button[aria-label="Download"]`).click()])
  const pdf = await (async () => { const fs = require('fs'); const at = await saved.path(); const buf = fs.readFileSync(at); return { name: saved.suggestedFilename(), kind: buf.subarray(0, 5).toString(), big: buf.length > 20000 } })()
  check('Download saves the one-pager as a PDF by its name', pdf.name === 'One-pager.pdf' && pdf.kind === '%PDF-' && pdf.big, JSON.stringify(pdf))

  // full screen: a page at a time, the arrows to step and Escape to leave
  await p.locator(`${P} .pvbar button[aria-label="Full Screen"]`).click()
  await p.waitForTimeout(700)
  const full = await p.evaluate(() => { const f = document.querySelector('.pv-full'); const r = f.getBoundingClientRect(); const page = f.querySelector('.pv-page').getBoundingClientRect(); return { role: f.getAttribute('role'), name: f.getAttribute('aria-label'), whole: r.width === innerWidth && r.height === innerHeight, black: getComputedStyle(f).backgroundColor, fits: page.height <= innerHeight && page.width <= innerWidth && page.height >= innerHeight * 0.9, hud: f.querySelector('.pv-hud').innerText.replace(/\s*\n\s*/g, ' '), held: f.contains(document.activeElement) } })
  check('Full Screen is the page on black over the whole desktop, fitted, with what steps through it along the foot', full.role === 'dialog' && full.name === 'One-pager.pdf, full screen' && full.whole && full.black === 'rgb(0, 0, 0)' && full.fits && /^1 of 2 \| ←→ to step esc to leave$/.test(full.hud) && full.held, JSON.stringify(full))
  await p.keyboard.press('ArrowRight')
  await p.waitForTimeout(300)
  const stepped = await p.evaluate(() => document.querySelector('.pv-hud__at').textContent.trim())
  await p.keyboard.press('ArrowRight')
  await p.waitForTimeout(200)
  check('the right arrow steps to the next page, and stops at the last', stepped === '2 of 2' && (await p.evaluate(() => document.querySelector('.pv-hud__at').textContent.trim())) === '2 of 2')
  await p.keyboard.press('Escape')
  await p.waitForTimeout(400)
  const left = await p.evaluate(() => ({ full: document.querySelectorAll('.pv-full').length, held: document.activeElement?.getAttribute('aria-label') }))
  check('Escape leaves it: the window is on the page it was left on, and the keyboard is back on Full Screen', left.full === 0 && left.held === 'Full Screen' && (await bar(p)).sub === 'Page 2 of 2', JSON.stringify(left))

  // closed, Preview leaves the Dock, and the rule with it
  await p.locator(`${P} button[aria-label^="Close"]`).click()
  await p.waitForTimeout(700)
  check('closed, Preview leaves the Dock and the rule goes with it', (await dock(p)) === A.DOCK_IDS.join(' '), await dock(p))

  // every way to the one-pager on the desktop opens it here
  await p.click('[data-menu-title="go"]')
  await p.waitForTimeout(250)
  const go = await p.evaluate(() => { const el = [...document.querySelectorAll('[data-menu="go"] [data-menu-item]')].find((i) => /One-pager/.test(i.textContent)); return { tag: el?.tagName, says: el?.getAttribute('aria-label') ?? el?.textContent.trim() } })
  await p.locator('[data-menu="go"] [data-menu-item]', { hasText: 'One-pager' }).click()
  await p.waitForSelector(`${P}[data-open] .pv-pages .op`, { timeout: 15000 })
  check('One-pager in the Go menu is an item like the apps, and opens it in Preview', go.tag === 'BUTTON' && go.says === 'One-pager' && (await front(p)) === 'preview' && t.ctx.pages().length === tabs, JSON.stringify(go))
  await p.locator(`${P} button[aria-label^="Close"]`).click()
  await p.waitForTimeout(500)
  await p.click('[data-dock-app="terminal"]')
  await p.waitForTimeout(600)
  await p.locator('.wf[data-app="terminal"] .term__input').click()
  await p.keyboard.type('open one-pager')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(500)
  const line = await p.evaluate(() => { const el = [...document.querySelectorAll('.wf[data-app="terminal"] .term__link')].pop(); return { tag: el?.tagName, says: el?.textContent } })
  await p.locator('.wf[data-app="terminal"] .term__link').last().click()
  await p.waitForSelector(`${P}[data-open] .pv-pages .op`, { timeout: 15000 })
  check('`open one-pager` in the terminal gives a line to press, which opens it in Preview and no tab', line.tag === 'BUTTON' && line.says === 'read the one-pager' && (await front(p)) === 'preview' && t.ctx.pages().length === tabs, JSON.stringify(line))
  check('nothing went wrong on the way', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // an address that names it opens it; and a reload comes back to it
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty&open=one-pager' })
  p = t.page
  await p.waitForSelector(`${P}[data-open] .pv-pages .op`, { timeout: 20000 })
  check('an address that asks for the one-pager opens it in Preview', (await bar(p)).name === 'One-pager.pdf' && (await front(p)) === 'preview')
  await p.reload({ waitUntil: 'load' })
  await p.waitForSelector(`${P}[data-open] .pv-pages .op`, { timeout: 20000 })
  check('a reload brings the desk back with it open', (await bar(p)).name === 'One-pager.pdf' && /preview\*/.test(await dock(p)))
  await t.ctx.close()

  // the editor's view (?draft) draws the lines that are Shrug's to write, in their brackets, where they go
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty&open=one-pager&draft' })
  p = t.page
  await p.waitForSelector(`${P}[data-open] .pv-pages .op`, { timeout: 20000 })
  const draft = await p.evaluate((P) => [...document.querySelectorAll(`${P} .pv-pages .op`)].map((op) => op.innerText).join('\n'), P)
  check('with ?draft the design’s bracketed lines are drawn: the headline to write, the fund’s size, a line on each partner', /\[One sentence on what Shrug is and who it backs\.\]/.test(draft) && /\[Fund size\]/.test(draft) && /\[One line\]/.test(draft) && /\[Month 2026\]/.test(draft), draft.slice(0, 200))
  await t.ctx.close()

  // ---- an LP's documents: the list, and one opened
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty' })
  p = t.page
  await p.waitForTimeout(1600)
  await logInLP(p)
  const before = await p.content()
  check('before the folder is opened, nothing of a document is in the page but what the list will say: no file has been fetched', !/A sample file from the Shrug VIP demo/.test(before) && (await p.evaluate(() => document.querySelectorAll('canvas.pv-canvas').length)) === 0)
  await p.locator('[data-desk="updates"]').dblclick()
  await p.waitForSelector(`${U}[data-open] .upd-row`, { timeout: 15000 })
  await p.waitForTimeout(600)
  const list = await p.evaluate((U) => {
    const w = document.querySelector(U)
    return { groups: [...w.querySelectorAll('.upd section')].map((s) => `${s.querySelector('h2').textContent}:${s.querySelectorAll('.upd-row').length}`).join(' '), rows: [...w.querySelectorAll('.upd-row')].map((r) => `${r.querySelector('b').textContent} / ${r.querySelector('small').textContent} / ${r.querySelector('.v-chip').textContent} / ${r.querySelector('.d').textContent} / ${r.querySelector('.s').textContent.trim()}`), buttons: [...w.querySelectorAll('.upd-row .s')].map((s) => s.querySelector('button')?.getAttribute('aria-label') ?? '-'), picked: w.querySelectorAll('.upd-row.on').length }
  }, U)
  check('the folder lists its documents under Funds and SPVs', list.groups === 'Funds:5 SPVs:1' && list.picked === 0, list.groups)
  check('each row names the fund it was written for, its date, and which of the four states it is in', list.rows.join(' | ') === 'Shrug 4 update, Q3 2026 / Written for Shrug 4 LPs / Shrug 4 / Nov 14, 2026 / Open | Shrug 2 update, Q3 2026 / Written for Shrug 2 LPs / Shrug 2 / Nov 12, 2026 / Open | Shrug Capital update, 2026 / Written for all LPs / All / Nov 24, 2026 / Open | Shrug 3 update, Q3 2026 / Written for Shrug 3 LPs / Shrug 3 / Nov 11, 2026 / Request | Shrug 2 annual letter / Written for Shrug 2 LPs / Shrug 2 / December / Coming soon | SPV update / Written for SPV LPs / SPV / Oct 3, 2026 / Request', list.rows.join(' | '))
  check('a row’s button says what it does to which document; one that is still to come has none', list.buttons.join(' | ') === 'Open Shrug 4 update, Q3 2026 | Open Shrug 2 update, Q3 2026 | Open Shrug Capital update, 2026 | Request Shrug 3 update, Q3 2026 | - | Request SPV update', list.buttons.join(' | '))
  // a click picks a row, as in a Finder window; the arrows move; Return opens
  await p.locator(`${U} .upd-row[data-doc="update-4"] b`).click()
  await p.waitForTimeout(250)
  const picked = await p.evaluate((U) => { const r = document.querySelector(`${U} .upd-row.on`); return { doc: r?.dataset.doc, ground: r ? getComputedStyle(r).backgroundColor : null, ink: r ? getComputedStyle(r).color : null, open: !!document.querySelector('.wf[data-app="preview"][data-open]') } }, U)
  check('a click picks a row, blue with white words, and opens nothing', picked.doc === 'update-4' && picked.ground === 'rgb(10, 109, 230)' && picked.ink === 'rgb(255, 255, 255)' && !picked.open, JSON.stringify(picked))
  await p.locator(`${U} .upd`).focus()
  await p.keyboard.press('ArrowDown')
  await p.waitForTimeout(200)
  check('the down arrow moves to the next row', (await p.evaluate((U) => document.querySelector(`${U} .upd-row.on`)?.dataset.doc, U)) === 'update-2')
  await p.keyboard.press('Enter')
  await p.waitForSelector(`${P}[data-open]`, { timeout: 15000 })
  const loading = await bar(p)
  await p.waitForSelector(`${P} .pv-canvas[data-drawn]`, { timeout: 30000 })
  await p.waitForTimeout(700)
  b = await bar(p)
  pg = await pages(p)
  check('Return opens it in Preview, which says it is loading until its pages are there', (loading.sub === 'Loading…' || /^Page 1 of 6$/.test(loading.sub)) && (await front(p)) === 'preview', JSON.stringify(loading))
  check('a private document: its name with Private by it, six pages down the side, and its reader’s name under its pages', b.name === 'Shrug 2 update, Q3 2026.pdf' && b.tag === 'Private' && b.sub === 'Page 1 of 6' && pg.n === 6 && pg.thumbs === 6 && pg.forWhom === 'Prepared for Jordan Avery', JSON.stringify({ b, pg }))
  check('this one has Download switched off, and the button says so', b.noDownload && b.download === 'Download: switched off for this document' && !b.noFull, JSON.stringify(b))
  const drawn = await p.evaluate((P) => { const c = document.querySelector(`${P} .pv-pages canvas`); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let ink = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 128) ink++; return { w: c.width, ink } }, P)
  check('its first page is drawn: there is ink on it', drawn.w > 300 && drawn.ink > 200, JSON.stringify(drawn))
  check('Preview’s Dock icon is there while it is open', /\| preview\*$/.test(await dock(p)), await dock(p))
  // one that may be saved: Download hands it over
  await p.locator('[data-desk="updates"]').dblclick()
  await p.waitForTimeout(600)
  await p.locator(`${U} .upd-row[data-doc="update-4"] button`).click()
  await p.waitForSelector(`${P} .pv-canvas[data-drawn]`, { timeout: 30000 })
  // (the page already drawn may be the last document's: this one is waited for by its own name and pages,
  // however long a busy machine takes over it, and not for a fixed half second)
  for (let i = 0; i < 150; i++) { b = await bar(p); if (b.name === 'Shrug 4 update, Q3 2026.pdf' && /^Page 1 of/.test(b.sub ?? '')) break; await p.waitForTimeout(200) }
  const [got] = await Promise.all([p.waitForEvent('download'), p.locator(`${P} .pvbar button[aria-label="Download"]`).click()])
  check('another document may be saved: Download hands it over by its name', b.name === 'Shrug 4 update, Q3 2026.pdf' && b.sub === 'Page 1 of 4' && !b.noDownload && got.suggestedFilename() === 'Shrug 4 update, Q3 2026.pdf', JSON.stringify(b))

  // one written for another fund: it is not shown, and can be asked for, once
  await p.locator('[data-desk="updates"]').dblclick()
  await p.waitForTimeout(600)
  await p.locator(`${U} .upd-row[data-doc="update-3"]`).dblclick()
  await p.waitForTimeout(800)
  b = await bar(p)
  const not = await p.evaluate((P) => { const e = document.querySelector(`${P} .v-empty`); return { head: e?.querySelector('h3')?.textContent, says: e?.querySelector('p')?.textContent, button: e?.querySelector('.v-btn')?.textContent.trim(), pages: document.querySelectorAll(`${P} .pv-page`).length } }, P)
  check('one written for another fund, opened: Preview says it is not theirs and whose it is, shows no page, and has Request', b.sub === 'Not shown' && b.tag === 'Private' && b.noDownload && b.noFull && not.head === 'This one isn’t yours to open' && not.says === 'It was written for the LPs of Shrug 3. If you think you should see it, ask and Shrug will take a look.' && not.button === 'Request' && not.pages === 0, JSON.stringify({ b, not }))
  await p.locator(`${P} .v-empty .v-btn`).click()
  await p.waitForTimeout(1200)
  const asked = await p.evaluate(({ P, U }) => ({ button: document.querySelector(`${P} .v-empty .v-btn`).textContent.trim(), off: document.querySelector(`${P} .v-empty .v-btn`).getAttribute('aria-disabled'), row: document.querySelector(`${U} .upd-row[data-doc="update-3"] .s`).textContent.trim(), rowButton: !!document.querySelector(`${U} .upd-row[data-doc="update-3"] .s button`) }), { P, U })
  check('asked for, the button is off and says Requested, and so does its row in the folder', asked.button === 'Requested' && asked.off === 'true' && asked.row === 'Requested' && !asked.rowButton, JSON.stringify(asked))
  // asked for from its row
  await p.locator('[data-desk="updates"]').dblclick()
  await p.waitForTimeout(600)
  await p.locator(`${U} .upd-row[data-doc="update-spv"] button`).click()
  await p.waitForTimeout(1200)
  check('Request on a row asks for it there, and the row says Requested', (await p.evaluate((U) => document.querySelector(`${U} .upd-row[data-doc="update-spv"] .s`).textContent.trim(), U)) === 'Requested')

  // a reload with a private document open comes back to it, for the same person
  await p.locator(`${U} .upd-row[data-doc="update-capital"] button`).click()
  await p.waitForSelector(`${P} .pv-canvas[data-drawn]`, { timeout: 30000 })
  await p.reload({ waitUntil: 'load' })
  await p.waitForSelector(`${P}[data-open] .pv-canvas[data-drawn]`, { timeout: 30000 })
  b = await bar(p)
  check('a reload comes back to the document that was open, fetched again for the person it is for', b.name === 'Shrug Capital update, 2026.pdf' && b.tag === 'Private' && b.sub === 'Page 1 of 14', JSON.stringify(b))
  // logged out, a private document is put away with them
  await p.locator('.menubar__login').click()
  await p.locator('.account__row', { hasText: 'Log Out' }).click()
  await p.waitForTimeout(1200)
  const gone = await p.evaluate((P) => ({ open: document.querySelector(P).hasAttribute('data-open'), canvases: document.querySelectorAll('canvas.pv-canvas').length, name: /Shrug Capital update/.test(document.body.innerText) }), P)
  check('logged out: the document is put away, its window with it, and nothing of it is left in the page', !gone.open && gone.canvases === 0 && !gone.name && !/preview/.test(await dock(p)), JSON.stringify(gone))
  check('nothing went wrong on the way (an LP)', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- a file that is gone (the demo's way to see it: an address that says ?doc=missing)
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&empty&doc=missing' })
  p = t.page
  await p.waitForTimeout(1600)
  await logInLP(p)
  await p.locator('[data-desk="updates"]').dblclick()
  await p.waitForSelector(`${U}[data-open] .upd-row`, { timeout: 15000 })
  await p.locator(`${U} .upd-row[data-doc="update-4"] button`).click()
  await p.waitForSelector(`${P} .v-empty`, { timeout: 15000 })
  b = await bar(p)
  const missing = await p.evaluate((P) => { const e = document.querySelector(`${P} .v-empty`); return { head: e.querySelector('h3').textContent, says: e.querySelector('p').textContent, button: e.querySelector('.v-btn').textContent.trim() } }, P)
  check('a file that is gone: Preview says it can’t be found, that nothing is wrong on their side, and offers Try Again', b.sub === 'Not found' && b.noDownload && missing.head === 'This file can’t be found' && missing.says === 'It may have been moved or replaced. Nothing is wrong on your side.' && missing.button === 'Try Again', JSON.stringify({ b, missing }))
  await t.ctx.close()

  // ---- a phone has no Preview window: the one-pager is an app of its own there (27 Nov), which an address
  // that names it arrives in, with the same two pages
  t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still&open=one-pager' })
  await t.page.waitForTimeout(2600)
  const phone = await t.page.evaluate(() => ({ locked: !!document.querySelector('.sb-lock:not([data-leaving])'), app: history.state?.shrug?.app ?? null, windows: document.querySelectorAll('.pv, .wf').length, pages: document.querySelectorAll('.sb-slot[data-front][data-app="preview"] .pp-page').length, headline: document.querySelector('.sb-slot[data-front][data-app="preview"] .op h1')?.textContent ?? null }))
  check('a phone asked for the one-pager by an address arrives in it, the phone’s own app: its two pages, and no window of the desk’s', !phone.locked && phone.app === 'preview' && phone.windows === 0 && phone.pages === 2 && !!phone.headline, JSON.stringify(phone))
  await t.ctx.close()

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error('FAILED', e.message.split('\n').slice(0, 10).join('\n'))
  process.exit(1)
})
