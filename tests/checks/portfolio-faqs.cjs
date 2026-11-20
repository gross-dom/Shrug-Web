// Fixer P's checks: Portfolio / Finder / Contacts, FAQs / Notes, and the desktop's search field.
//   node portfolio-faqs.cjs [base]        (base defaults to the dev server; the main session runs it on :4173)
// Exits non-zero if anything fails. Findings covered are named beside each check.
const A = require('./lib.cjs')
const BASE = process.argv[2] || process.env.BASE || 'http://127.0.0.1:5173/'

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  (' + detail + ')' : ''))
}
const up = (page) => page.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.os[data-booted]'), null, { timeout: 30000 })
const focusOf = (page) => page.evaluate(() => {
  const el = document.activeElement
  return el ? `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}${el.getAttribute('data-company') ? `[${el.getAttribute('data-company')}]` : ''}` : 'none'
})
const PENDING = 'Shrug hasn’t written this one down yet.'
const BRACKET = '[Shrug’s answer goes here'

;(async () => {
  const browser = await A.launch()
  const desk = async (query, device = 'laptop') => {
    const t = await A.open(browser, { device, base: BASE, query: 'still&' + query })
    await up(t.page)
    await t.sleep(1300)
    return t
  }

  // ---------- The desktop's Portfolio ----------
  {
    const t = await desk('open=portfolio')
    const win = t.page.locator('.wf[data-app="finder"]')
    const field = win.locator('.search__input')
    const tabs = []
    t.ctx.on('page', (p) => tabs.push(p))

    // DK-10: the search field hands over to the keyboard
    await field.click()
    await field.pressSequentially('liquid')
    await t.sleep(200)
    await field.press('ArrowDown')
    check('DK-10 Portfolio: ArrowDown in the search goes to the first result', (await focusOf(t.page)) === 'button.pf-file[Liquid Death]', await focusOf(t.page))
    await field.focus()
    await field.press('Enter')
    check('DK-10 Portfolio: Return in the search goes to the first result', (await focusOf(t.page)) === 'button.pf-file[Liquid Death]', await focusOf(t.page))
    await field.focus()
    await field.press('Escape')
    check('DK-10 Portfolio: Escape empties the search and keeps the caret in it', (await field.inputValue()) === '' && (await focusOf(t.page)) === 'input.search__input', `${await field.inputValue()} | ${await focusOf(t.page)}`)
    await field.pressSequentially('zzzz')
    await t.sleep(200)
    const none = (await win.locator('.pf__none').innerText()).replace(/\s+/g, ' ').trim()
    check('UX-19 Portfolio: an empty search says "No Results for “x”" and what to try', none === 'No Results for “zzzz” Check the spelling or try a new search.', none)
    await win.locator('.search__clear').click()
    check('DK-10 / tb-10 Portfolio: the clear button empties the search and the caret stays in the field', (await field.inputValue()) === '' && (await focusOf(t.page)) === 'input.search__input', `${await field.inputValue()} | ${await focusOf(t.page)}`)

    // UX-16 / DK-13: a company with no site
    await field.fill('drumroll')
    await t.sleep(250)
    const fate = win.locator('.pf-preview .pf-preview__fate')
    check('UX-16 Portfolio: a company with no site says so where its link would be', (await fate.count()) === 1 && (await fate.innerText()).trim() === 'No website listed' && (await win.locator('.pf-preview__visit').count()) === 0, (await fate.count()) ? await fate.innerText() : 'no line')
    await win.locator('[data-company="Drumroll"]').dblclick()
    await t.sleep(150)
    const nudged = await win.locator('.pf-preview__fate[data-nudged]').count()
    const said = await win.locator('.pf__foot [role="status"].sr-only').innerText().catch(() => '')
    check('DK-13 Portfolio: a double-click on it is answered (the line stirs and says so aloud), no tab opens', nudged === 1 && /Drumroll: No website listed/.test(said) && tabs.length === 0, `nudged ${nudged} | said "${said}" | tabs ${tabs.length}`)
    await t.sleep(2600)
    await win.locator('[data-company="Drumroll"]').focus()
    await t.page.keyboard.press('Enter')
    await t.sleep(150)
    check('DK-13 Portfolio: Return on it is answered the same way', (await win.locator('.pf-preview__fate[data-nudged]').count()) === 1 && tabs.length === 0)

    // A short search finds what begins with it, not what has it somewhere inside ("AI" is in "Mountain")
    const found = async (q) => {
      await field.fill(q)
      await t.sleep(250)
      return win.locator('.pf-file[data-company]').evaluateAll((els) => els.map((el) => el.getAttribute('data-company')))
    }
    const ai = await found('AI')
    check('Portfolio: "AI" finds the AI vertical and the name that begins with it, and no longer Liquid Death for its Mountain water', ai.join() === 'Aidaly,Outtake,Superhuman,Sauron,Voiceflow,DoNotPay,PlaygroundAI', ai.join(', '))
    const pay = await found('pay')
    check('Portfolio: a short search still finds a word inside a name that runs its words together', pay.join() === 'MoonPay,DoNotPay', pay.join(', '))
    const web = await found('web')
    check('Portfolio: …and every company of a vertical by the start of its name', ['RTFKT', 'MoonPay', 'OnCyber', 'Thirdweb', 'Crossmint', 'Layer2', 'Hang'].every((name) => web.includes(name)), web.join(', '))
    const inside = await found('ount')
    check('Portfolio: a longer search matches inside words, as it did', inside.join() === 'Liquid Death', inside.join(', '))

    // The two companies called Atoms
    await field.fill('atoms')
    await t.sleep(250)
    const hosts = await win.locator('.pf-file .pf-file__host').allInnerTexts()
    check('DK-13 Portfolio: the two called Atoms are told apart by their addresses', hosts.join() === 'atoms.co,atoms.com', hosts.join())
    check('DK-13 Portfolio: only namesakes carry an address under the name', (await (async () => { await field.fill('varda'); await t.sleep(200); return win.locator('.pf-file .pf-file__host').count() })()) === 0)

    // UX-26, AX-22: the link out, and the heading
    const visit = win.locator('.pf-preview .pf-preview__visit')
    const link = await visit.evaluate((a) => ({ rel: a.rel, target: a.target, href: a.getAttribute('href'), says: a.textContent }))
    check('UX-26 Portfolio: a company link is rel="noopener" (its site sees where the visit came from)', link.rel === 'noopener' && link.target === '_blank', JSON.stringify(link))
    check('UX-19 Portfolio: the link says it opens in a new tab', /, opens in a new tab$/.test(link.says), link.says)
    check('AX-22 Portfolio: the preview heading is an h2', (await win.locator('.pf-preview__name').evaluate((h) => h.tagName)) === 'H2')
    await win.locator('[data-company="Varda"]').dblclick()
    await t.sleep(600)
    check('Portfolio: a double-click on a company with a site still opens it in a new tab', tabs.length === 1, String(tabs.length))
    for (const p of tabs) await p.close().catch(() => {})

    // AX-15: greys that can be read
    const greys = await t.page.evaluate(() => {
      const c = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).color : null }
      return { count: c('.wf[data-app="finder"] .side-item__count') }
    })
    check('AX-15 Portfolio: sidebar counts are the readable grey', greys.count === 'rgb(99, 100, 107)', greys.count)

    // DK-9: as List on a laptop shows names in full
    await field.fill('')
    await win.locator('[aria-label="as List"]').click()
    await t.sleep(300)
    const list = async () => t.page.evaluate(() => {
      const w = document.querySelector('.wf[data-app="finder"]')
      const cut = (el) => el.scrollWidth > el.clientWidth + 1
      const names = [...w.querySelectorAll('.pf-row:not(.pf-row--head) .pf-row__name > span:not(.logo):not(.pf-row__host)')]
      const cells = [...w.querySelectorAll('.pf-row:not(.pf-row--head) > span')]
      const preview = w.querySelector('.pf-preview')
      const foot = w.querySelector('.pf__foot-visit, .pf__foot-fate')
      const second = w.querySelector('.pf-row[aria-selected="true"] > span:nth-child(2)')
      return {
        rows: names.length,
        namesCut: names.filter(cut).map((n) => n.textContent),
        titled: cells.every((c) => (c.getAttribute('title') ?? '') !== '' || c.textContent.trim() === ''),
        preview: !!preview && getComputedStyle(preview).display !== 'none',
        foot: !!foot && getComputedStyle(foot).display !== 'none' ? foot.textContent : null,
        second: second ? getComputedStyle(second).color : null,
        width: w.getBoundingClientRect().width,
      }
    })
    let l = await list()
    check('DK-9 Portfolio as List at 1280x720: every name in full', l.rows === 81 && l.namesCut.length === 0, `${l.rows} rows, cut: ${l.namesCut.join(', ') || 'none'} (window ${Math.round(l.width)})`)
    check('DK-9 Portfolio as List at 1280x720: the preview stands down and its link is in the foot', !l.preview && /Visit varda\.com/.test(l.foot ?? ''), `preview ${l.preview} | foot ${l.foot}`)
    check('DK-9 Portfolio as List: every cell carries its words in full as a title', l.titled)
    check('AX-15 Portfolio as List: the selected row\'s second line is white', l.second === 'rgb(255, 255, 255)', l.second)
    await win.locator('[data-company="YOLO"]').click()
    await t.sleep(150)
    l = await list()
    check('UX-16 Portfolio as List: a company with no site says so in the foot too', l.foot === 'No website listed', String(l.foot))
    await t.ctx.close()

    for (const [device, wantPreview] of [['desktop', false], ['fhd', true]]) {
      const d = await desk('open=portfolio', device)
      const w = d.page.locator('.wf[data-app="finder"]')
      await w.locator('[aria-label="as List"]').click()
      await d.sleep(300)
      const r = await d.page.evaluate(() => {
        const w = document.querySelector('.wf[data-app="finder"]')
        const names = [...w.querySelectorAll('.pf-row:not(.pf-row--head) .pf-row__name > span:not(.logo):not(.pf-row__host)')]
        const preview = w.querySelector('.pf-preview')
        return { cut: names.filter((el) => el.scrollWidth > el.clientWidth + 1).length, preview: !!preview && getComputedStyle(preview).display !== 'none', width: Math.round(w.getBoundingClientRect().width) }
      })
      check(`DK-9 Portfolio as List on ${device}: names in full, preview ${wantPreview ? 'kept' : 'stood down'}`, r.cut === 0 && r.preview === wantPreview, JSON.stringify(r))
      await d.ctx.close()
    }
  }

  // ---------- The desktop's FAQs ----------
  {
    const t = await desk('open=faqs')
    const win = t.page.locator('.wf[data-app="notes"]')
    const field = win.locator('.search__input')
    const body = async () => (await win.locator('.faq__note').innerText()).replace(/\s+/g, ' ')
    const text = await body()
    // Every question has Shrug's answer now: nothing is on its way, and nothing is left for the editor to fill in
    check('UX-4 FAQs: a question is answered in Shrug’s own words, with nothing left to come', text.includes('Shrug V is the fifth fund') && !text.includes(PENDING) && !(await win.innerText()).includes(BRACKET) && (await win.locator('.faq__pending, .faq__todo, .faq__way').count()) === 0, text.slice(0, 140))
    const previews = await win.locator('.faq-row .ss-row__preview').allInnerTexts()
    check('UX-4 FAQs: each row says how its answer begins', previews.length === 10 && previews.every((p) => p.trim().length > 12 && p.trim() !== 'Answer on its way'), previews.map((p) => p.trim().slice(0, 18)).join(' | '))
    check('AX-15 FAQs: "Question 1 of 10" is the readable grey', /^Question 1 of 10$/.test((await win.locator('.faq__meta').innerText()).trim()) && (await win.locator('.faq__meta').evaluate((el) => getComputedStyle(el).color)) === 'rgb(99, 100, 107)', await win.locator('.faq__meta').innerText())
    // An answer keeps its shape: what it lists is a list, and a link in it is a link
    await win.locator('.faq-row').nth(4).click()
    await t.sleep(250)
    const listed = await win.locator('.faq__note ul.answer__list > li').count()
    check('FAQs: an answer that lists things is set as a list', listed === 15 && (await win.locator('.faq__note .answer > p').count()) >= 2, `${listed} items`)
    // …and what it crosses out is crossed out: the answer is written "We are ~pleased to announce~ our go-to marketing checklist:"
    const crossed = (note) => {
      const s = note.querySelector('s.answer__struck')
      const words = s ? [...s.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('') : null
      return { words, line: s ? getComputedStyle(s).textDecorationLine : null, read: s?.closest('p').textContent ?? null, tilde: /~/.test(note.textContent) }
    }
    const struck = await win.locator('.faq__note').evaluate(crossed)
    check('FAQs: words written between tildes are crossed out, with no tilde drawn', struck.words === 'pleased to announce' && struck.line === 'line-through' && !struck.tilde, JSON.stringify(struck))
    check('FAQs: …and a screen reader is told where the crossing-out starts and stops', struck.read === 'We are crossed out: pleased to announce, end of crossing out, our go-to marketing checklist:', struck.read)
    const preview = (await win.locator('.faq-row').nth(4).innerText()).replace(/\s+/g, ' ')
    check('FAQs: …and the line under the question has the words, without the marks', preview.includes('We are pleased to announce our go-to marketing checklist:') && !/~/.test(preview), preview)
    await win.locator('.faq-row').nth(6).click()
    await t.sleep(250)
    const out = await win.locator('.faq__note a.answer__link').first().evaluate((a) => ({ href: a.href, target: a.target, rel: a.rel, says: a.textContent }))
    check('FAQs: a link out of an answer opens in a new tab, and says so', /foundersfund\.com/.test(out.href) && out.target === '_blank' && out.rel === 'noreferrer' && /^Good Quests, opens in a new tab$/.test(out.says), JSON.stringify(out))
    await win.locator('.faq-row').first().click()
    await t.sleep(200)

    // DK-10: the window follows the search
    await field.click()
    await field.pressSequentially('small fund')
    await t.sleep(300)
    check('DK-10 FAQs: the window follows the search as it is typed', (await win.locator('.faq__title').innerText()).trim() === 'Why should a founder make room for a small fund?', await win.locator('.faq__title').innerText())
    await field.press('Enter')
    check('DK-10 FAQs: Return goes to the first question found', /faq-row/.test(await t.page.evaluate(() => document.activeElement?.className ?? '')), await focusOf(t.page))
    await field.focus()
    await field.press('ArrowDown')
    check('DK-10 FAQs: so does ArrowDown', /faq-row/.test(await t.page.evaluate(() => document.activeElement?.className ?? '')), await focusOf(t.page))
    // Next question still goes where it says while a search is in
    await win.locator('[aria-label="Next question"]').click()
    await t.sleep(200)
    check('DK-10 FAQs: Next still steps on while a search is in the field', (await win.locator('.faq__title').innerText()).trim() === 'Do you lead rounds or take board seats?', await win.locator('.faq__title').innerText())
    await field.focus()
    await field.press('Escape')
    check('DK-10 FAQs: Escape empties the search and keeps the caret in it', (await field.inputValue()) === '' && (await focusOf(t.page)) === 'input.search__input', await focusOf(t.page))
    await field.pressSequentially('zzzz')
    await t.sleep(200)
    const none = (await win.locator('.side-empty').innerText()).replace(/\s+/g, ' ').trim()
    check('UX-19 FAQs: an empty search says "No Results for “x”" and what to try', none === 'No Results for “zzzz” Check the spelling or try a new search.', none)
    await win.locator('.search__clear').click()
    check('DK-10 / tb-10 FAQs: the clear button keeps the caret in the field', (await field.inputValue()) === '' && (await focusOf(t.page)) === 'input.search__input', await focusOf(t.page))
    // A link in an answer to the site's own chat opens the chat, in front
    await win.locator('.faq-row').nth(8).click()
    await t.sleep(250)
    await win.locator('.faq__note button.answer__link').click()
    await t.sleep(700)
    const chat = await t.page.evaluate(() => ({ front: document.querySelector('.wf[data-active]')?.getAttribute('data-app') ?? null, open: !!document.querySelector('.wf[data-app="messages"][data-open]') }))
    check('FAQs: a link in an answer to the site’s own chat opens the chat', chat.front === 'messages' && chat.open, JSON.stringify(chat))
    check('FAQs: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | ').slice(0, 200))
    await t.ctx.close()

    // The editor's view has nothing left to show here: an answered question reads the same
    const d = await desk('open=faqs&draft')
    const dw = d.page.locator('.wf[data-app="notes"]')
    const dt = (await dw.locator('.faq__note').innerText()).replace(/\s+/g, ' ')
    check('UX-4 FAQs with ?draft: an answered question reads the same, with no note for the editor', dt.includes('Shrug V is the fifth fund') && !dt.includes(BRACKET) && (await dw.locator('.faq__todo').count()) === 0, dt.slice(0, 120))
    await d.ctx.close()
  }

  // ---------- RS-10: logos that do not arrive ----------
  for (const device of ['laptop', 'iphone']) {
    const t = await A.open(browser, { device, base: BASE, query: 'still' + (device === 'laptop' ? '&open=portfolio' : ''), goto: false })
    await t.page.route('**/logos/**', (route) => route.abort())
    await t.page.goto(BASE + '?still' + (device === 'laptop' ? '&open=portfolio' : ''))
    if (device === 'iphone') {
      await A.unlock(t.page)
      await A.at(t.page, 'finder', [])
    } else {
      await up(t.page)
      await t.sleep(1500)
    }
    const scope = device === 'laptop' ? '.wf[data-app="finder"]' : '.sb-slot[data-front]'
    // (a company's logo is a tile in the desktop's window, and a round face in Contacts on the phone)
    const LOGO = device === 'laptop' ? '.logo' : '.contacts-row .contact-face'
    // go down the whole folder a screen at a time, so that each lazy picture is asked for
    const walk = () => t.page.evaluate(async ([scope, LOGO]) => {
      let box = document.querySelector(`${scope} ${LOGO}`)?.parentElement
      while (box && !(box.scrollHeight > box.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement
      if (!box) return
      for (let y = 0; y <= box.scrollHeight; y += Math.max(120, box.clientHeight - 60)) {
        box.scrollTop = y
        await new Promise((r) => setTimeout(r, 220))
      }
      await new Promise((r) => setTimeout(r, 700))
    }, [scope, LOGO])
    await walk()
    const state = () => t.page.evaluate(([scope, LOGO]) => {
      const logos = [...document.querySelectorAll(`${scope} ${LOGO}`)]
      const imgs = logos.map((l) => l.querySelector('img')).filter(Boolean)
      return { logos: logos.length, broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length, letters: logos.filter((l) => l.hasAttribute('data-empty') && l.textContent.trim().length === 1).length, drawn: imgs.filter((i) => i.complete && i.naturalWidth > 0).length }
    }, [scope, LOGO])
    let s = await state()
    check(`RS-10 ${device}: logos that fail are letter tiles, never a broken picture`, s.broken === 0 && s.letters === s.logos, JSON.stringify(s))
    await t.page.unroute('**/logos/**')
    await t.page.evaluate(() => window.dispatchEvent(new Event('online')))
    await walk()
    s = await state()
    check(`RS-10 ${device}: back online they are asked for again and arrive`, s.broken === 0 && s.drawn >= 71 && s.letters <= 12, JSON.stringify(s))
    await t.ctx.close()
  }

  // ---------- Touch sizes on the desktop (tb-8, tb-9) ----------
  {
    const t = await desk('open=portfolio', 'ipad-land')
    const win = t.page.locator('.wf[data-app="finder"]')
    await win.locator('.search__input').fill('a')
    await win.locator('[aria-label="as List"]').tap()
    await t.sleep(300)
    const sizes = await t.page.evaluate(() => {
      const w = document.querySelector('.wf[data-app="finder"]')
      const box = (sel) => { const r = w.querySelector(sel)?.getBoundingClientRect(); return r ? [Math.round(r.width), Math.round(r.height)] : null }
      const clear = w.querySelector('.search__clear').getBoundingClientRect()
      // 14px to the left of, and above, the clear button's middle: still the button, by its wider touch area
      const hit = (dx, dy) => document.elementFromPoint(clear.left + clear.width / 2 + dx, clear.top + clear.height / 2 + dy)?.closest('.search__clear') !== null && document.elementFromPoint(clear.left + clear.width / 2 + dx, clear.top + clear.height / 2 + dy)?.className.includes('search__clear')
      return { part: box('.tool__part'), row: box('.pf-row:not(.pf-row--head)'), side: box('.side-item'), foot: box('.pf__foot-visit'), clearHit: [hit(-14, 0), hit(0, -14), hit(14, 0), hit(0, 14)], any: matchMedia('(any-pointer: coarse)').matches }
    })
    check('tb-8 touch: toolbar buttons 40x36, list rows and sidebar rows 36 tall', sizes.part?.[0] >= 40 && sizes.part?.[1] >= 36 && sizes.row?.[1] >= 36 && sizes.side?.[1] >= 36, JSON.stringify(sizes))
    check('tb-8 touch: the clear button takes a press 14px from its middle', sizes.clearHit.filter(Boolean).length >= 3, JSON.stringify(sizes.clearHit))
    check('tb-8 touch: the foot\'s link is 36 tall', sizes.foot?.[1] >= 36, JSON.stringify(sizes.foot))
    // tb-10: a finger on the clear button leaves the caret in the field
    const field = win.locator('.search__input')
    await field.tap()
    await win.locator('.search__clear').tap()
    await t.sleep(150)
    check('tb-10 touch: a finger on the clear button leaves the caret in the field', (await field.inputValue()) === '' && (await focusOf(t.page)) === 'input.search__input', await focusOf(t.page))
    await win.locator('[aria-label="as Icons"]').tap()
    await field.fill('varda')
    await t.sleep(250)
    const visit = await win.locator('.pf-preview__visit').boundingBox()
    check('tb-8 touch: Visit is 36 tall', Math.round(visit.height) >= 36, JSON.stringify(visit))
    await t.ctx.close()
  }

  // ---------- The phone ----------
  {
    const t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still' })
    await A.unlock(t.page)
    const front = '.sb-slot[data-front] .ios-page[data-pos="top"]'

    // UX-4 / AX-23: Notes
    await A.at(t.page, 'notes', ['f:faqs'])
    const rows = await t.page.locator(`${front} .notes-row`).evaluateAll((els) => els.map((el) => ({ seen: el.innerText.replace(/\s+/g, ' ').trim(), read: el.textContent.replace(/\s+/g, ' ').trim() })))
    check('UX-4 Notes: each question\'s row says how its answer begins', rows.length === 10 && rows.every((r) => !/Answer on its way|No additional text/.test(r.seen) && r.seen.length > 40), rows[0]?.seen)
    check('AX-23 Notes: a row\'s parts are set apart for a screen reader', rows.every((r) => /\?\s?, [^,]+, .{12,}$/.test(r.read)), rows[0]?.read)
    await A.at(t.page, 'notes', ['f:faqs', 'n:3'])
    const note = (await t.page.locator(`${front} .notes-note`).innerText()).replace(/\s+/g, ' ')
    check('UX-4 Notes: a question is answered in Shrug’s own words, with nothing left to come', note.includes('Where do you find opportunities?') && note.length > 200 && !note.includes(PENDING) && !note.includes(BRACKET) && (await t.page.locator(`${front} .notes-slot, ${front} .notes-way`).count()) === 0 && (await t.page.locator(`${front} .notes-note .answer > p`).count()) >= 1, note.slice(0, 160))
    await A.at(t.page, 'notes', ['f:faqs', 'n:4'])
    check('Notes: an answer that lists things is set as a list', (await t.page.locator(`${front} .notes-note ul.answer__list > li`).count()) === 15)
    const struck = await t.page.locator(`${front} .notes-note`).evaluate((note) => {
      const s = note.querySelector('s.answer__struck')
      return { words: s ? [...s.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('') : null, line: s ? getComputedStyle(s).textDecorationLine : null, read: s?.closest('p').textContent ?? null, tilde: /~/.test(note.textContent) }
    })
    check('Notes: words written between tildes are crossed out there too, and said to be', struck.words === 'pleased to announce' && struck.line === 'line-through' && !struck.tilde && struck.read === 'We are crossed out: pleased to announce, end of crossing out, our go-to marketing checklist:', JSON.stringify(struck))
    await A.at(t.page, 'notes', ['f:faqs', 'n:6'])
    const out = await t.page.locator(`${front} .notes-note a.answer__link`).first().evaluate((a) => ({ href: a.href, target: a.target, says: a.textContent }))
    check('Notes: a link out of an answer opens in a new tab, and says so', /foundersfund\.com/.test(out.href) && out.target === '_blank' && /, opens in a new tab$/.test(out.says), JSON.stringify(out))
    await A.at(t.page, 'notes', ['f:faqs', 'n:8'])
    const smallFund = (await t.page.locator(`${front} .notes-note`).innerText()).replace(/\s+/g, ' ')
    await t.page.locator(`${front} .notes-note button.answer__link`).tap()
    await t.sleep(1100)
    check('Notes: a link in an answer to the site’s own chat opens Messages', (await A.state(t.page)).place?.app === 'messages', JSON.stringify((await A.state(t.page)).place))

    // UX-16: Contacts, a company with no site
    await A.at(t.page, 'finder', ['co:Drumroll'])
    const fate = t.page.locator(`${front} .contact-field__none`)
    const site = await t.page.locator(`${front} .contact-act`).first().evaluate((el) => ({ tag: el.tagName, off: el.getAttribute('aria-disabled'), says: el.textContent.trim() }))
    check('UX-16 Contacts: a company with no site says so where its address would be, and its website button is there but faint', (await fate.count()) === 1 && (await fate.innerText()).trim() === 'No website listed' && site.tag === 'SPAN' && site.off === 'true' && site.says === 'Website: No website listed' && (await t.page.locator(`${front} .contact-field a`).count()) === 0, JSON.stringify(site))
    await t.page.evaluate(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }) })
    const shareAndRead = async (by = '.ios-bar [aria-label="Share"]') => {
      await t.page.evaluate(() => navigator.clipboard.writeText('—'))
      await t.page.locator(`${front} ${by}`).tap()
      await t.sleep(300)
      return t.page.evaluate(() => navigator.clipboard.readText())
    }
    let sent = await shareAndRead()
    check('UX-16 Contacts: Share on it sends its name with no address', sent === 'Drumroll', sent)
    check('UX-16 Contacts: and says "Copied", not "Link copied"', (await t.page.locator(`${front} [role="status"]`).first().innerText().catch(() => '')) === 'Copied')
    await A.at(t.page, 'finder', ['co:Clubhouse'])
    sent = await shareAndRead()
    check('UX-16 Contacts: one with a line sends the name and the line, no address', sent === 'Clubhouse: A space for casual, drop-in audio conversations', sent)
    await A.at(t.page, 'finder', ['co:Varda'])
    sent = await shareAndRead()
    check('Contacts: Share on a company with a site still sends its address', /varda\.com/.test(sent), sent)
    sent = await shareAndRead('.contact-act:has-text("share")')
    const row = await shareAndRead('.contact-row')
    check('Contacts: the share button on the card and its Share Contact row send the same', /varda\.com/.test(sent) && row === sent, `${sent} | ${row}`)
    // Under that row: Shrug's rule for an introduction, as the FAQs say it and not retyped
    const under = await t.page.evaluate((front) => {
      const row = document.querySelector(`${front} .contact-row`)
      const foot = row.closest('.ios-section').querySelector('.ios-section__footer')
      return { says: foot?.textContent ?? null, below: !!foot && foot.getBoundingClientRect().top >= row.getBoundingClientRect().bottom, footers: document.querySelectorAll(`${front} .ios-section__footer`).length }
    }, front)
    check('Contacts: under Share Contact, the sentence on introductions from the FAQ about a small fund, word for word', under.says === 'Double opt-in, always.' && smallFund.includes(under.says) && under.below && under.footers === 1, JSON.stringify(under))
    const open = await t.page.locator(`${front} a.contact-act`).evaluate((a) => ({ rel: a.rel, target: a.target, says: a.textContent }))
    const link = await t.page.locator(`${front} .contact-field a`).evaluate((a) => ({ rel: a.rel, target: a.target, says: a.textContent }))
    check('UX-26 Contacts: a company link is rel="noopener" and says it opens in a new tab', [open, link].every((l) => l.rel === 'noopener' && l.target === '_blank' && /, opens in a new tab$/.test(l.says)), JSON.stringify([open, link]))
    const info = (await t.page.locator(`${front} .contact-fields`).first().innerText()).replace(/\s+/g, ' ').trim()
    check('Contacts: a company\'s card says its site, its vertical and what it does, and nothing of folders or tags', /^website varda\.com/.test(info) && /vertical Deep tech/.test(info) && /about Space factories/.test(info) && !/Tags|Kind|Where/.test(info), info)
    const set = await t.page.evaluate((front) => ['.contact-field__value', '.contact-row'].map((sel) => { const cs = getComputedStyle(document.querySelector(`${front} ${sel}`)); return `${cs.fontSize}/${cs.lineHeight}` }), front)
    check('Contacts: what a card knows, and Share Contact, are set in 17 points, as a contact\'s card sets them', set.join() === '17px/22px,17px/22px', set.join())

    // UX-19: Contacts, an empty search
    await A.at(t.page, 'finder', [])
    await t.page.locator(`${front} .ios-search__input`).tap()
    await t.sleep(400)
    await t.page.keyboard.type('zzzz')
    await t.sleep(300)
    const empty = (await t.page.locator('.sb-slot[data-front] .ios-page[data-pos="top"] .ios-empty').innerText()).replace(/\s+/g, ' ').trim()
    check('UX-19 Contacts: an empty search says "No Results for “x”" and what to try', empty === 'No Results for “zzzz” Check the spelling or try a new search.', empty)
    await t.page.locator(`${front} .ios-search__input`).fill('AI')
    await t.sleep(300)
    const ai = await t.page.locator(`${front} .contacts-row`).evaluateAll((els) => els.map((el) => el.getAttribute('data-company')))
    check('Contacts: "AI" finds the AI vertical and the name that begins with it there too, and not Liquid Death', ai.join() === 'Aidaly,Outtake,Superhuman,Sauron,Voiceflow,DoNotPay,PlaygroundAI', ai.join(', '))
    await t.page.locator('.sb-slot[data-front] .ios-page[data-pos="top"] [aria-label="Cancel"]').tap()
    await t.sleep(300)
    // The list is all there is: nothing of Files or of the Wallet is left (no tabs, no Recents, Shared or Browse, no cards)
    const left = await t.page.evaluate(() => { const app = document.querySelector('.sb-slot[data-front]'); return { tabs: app.querySelectorAll('.ios-tabs, [role="tablist"]').length, words: /Recents|Shared|Browse|Recently Deleted/.test(app.textContent), cards: app.querySelectorAll('.wallet-slot, .wallet-card').length, sections: app.querySelectorAll('.contacts-section').length } })
    check('Contacts: the list is all there is: no tabs, no Recents, Shared or Browse, no cards', left.tabs === 0 && !left.words && left.cards === 0 && left.sections === 13, JSON.stringify(left))
    check('phone: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | ').slice(0, 200))
    await t.ctx.close()

    // The rule under a vertical's name is drawn, on a screen with one dot to a point as on one with more (it
    // was half a point too low for a browser that draws to whole points: outside its band, which cut it off).
    // Looked for in the picture itself: the two points over the heading's foot, down the middle of the screen
    const inkDown = async (page, x, y, tall) => {
      const shot = (await page.screenshot({ clip: { x, y, width: 1, height: tall } })).toString('base64')
      return page.evaluate(async (shot) => {
        const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(shot), (c) => c.charCodeAt(0))], { type: 'image/png' }))
        const ink = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')
        ink.drawImage(bitmap, 0, 0)
        const { data } = ink.getImageData(0, 0, 1, bitmap.height)
        return Array.from({ length: bitmap.height }, (_, i) => data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2])
      }, shot)
    }
    for (const dpr of [1, 2, 3]) {
      const r = await A.open(browser, { device: { w: 402, h: 874, touch: true, dpr }, base: BASE, query: 'still' })
      await A.unlock(r.page)
      await r.page.addStyleTag({ content: '.sb-banner{display:none!important}' })
      await A.at(r.page, 'finder', [])
      for (const scrolled of [0, 437]) {
        await r.page.locator(`${front} [data-scroller]`).evaluate((el, top) => (el.scrollTop = top), scrolled)
        await r.sleep(250)
        const foot = await r.page.evaluate((front) => { const all = [...document.querySelectorAll(`${front} .contacts-letter`)]; return Math.round((all.find((h) => h.getBoundingClientRect().bottom > 80) ?? all[0]).getBoundingClientRect().bottom) }, front)
        const down = await inkDown(r.page, 200, foot - 2, 2)
        check(`Contacts at ${dpr}x: the rule under a vertical's name is drawn${scrolled ? ' while the name is held under the bar' : ''}`, down.some((sum) => sum < 735), JSON.stringify(down))
      }
      await r.ctx.close()
    }

    // A logo that is slow in coming: its row is the company's initial until it arrives, not an empty disc.
    // (The logos are held back here until they are let go, so that what is seen first does not depend on a clock)
    {
      let letGo
      const held = new Promise((done) => (letGo = done))
      const s = await A.open(browser, { device: 'iphone', base: BASE, query: 'still', goto: false })
      await s.page.route('**/logos/**', async (route) => { await held; await route.continue().catch(() => {}) })
      await s.page.goto(BASE + '?still')
      await A.unlock(s.page)
      await A.at(s.page, 'finder', [])
      await s.sleep(500)
      const faces = () => s.page.evaluate((front) => [...document.querySelectorAll(`${front} .contacts-section .contacts-row`)].slice(0, 6).map((row) => { const face = row.querySelector('.contact-face'); return { name: row.dataset.company, letter: face.hasAttribute('data-empty') ? face.textContent.trim() : null, seen: getComputedStyle(face).color !== 'rgba(0, 0, 0, 0)', coming: !!face.querySelector('img') } }), front)
      const waiting = await faces()
      check('Contacts on a slow line: a row whose logo has not arrived is the company\'s initial', waiting.length === 6 && waiting.every((f) => f.coming && f.seen && f.letter === f.name.trim()[0].toUpperCase()), JSON.stringify(waiting.map((f) => `${f.name}: ${f.letter}`)))
      letGo()
      await s.page.waitForFunction((front) => [...document.querySelectorAll(`${front} .contacts-section .contacts-row`)].slice(0, 6).every((row) => !row.querySelector('.contact-face').hasAttribute('data-empty')), front, { timeout: 15000 }).catch(() => {})
      const arrived = await faces()
      check('Contacts on a slow line: and its logo once that has', arrived.every((f) => f.letter === null && f.coming), JSON.stringify(arrived.map((f) => `${f.name}: ${f.letter}`)))
      await s.ctx.close()
    }

    // The editor's view has nothing left to show in Notes: an answered question reads the same
    const d = await A.open(browser, { device: 'iphone', base: BASE, query: 'still&draft' })
    await A.unlock(d.page)
    await A.at(d.page, 'notes', ['f:faqs', 'n:3'])
    const dn = (await d.page.locator(`${front} .notes-note`).innerText()).replace(/\s+/g, ' ')
    check('UX-4 Notes with ?draft: an answered question reads the same, with no note for the editor', dn.length > 200 && !dn.includes(BRACKET) && (await d.page.locator(`${front} .notes-slot`).count()) === 0, dn.slice(0, 120))
    await d.ctx.close()

    // PH-7: the narrowest phone
    const n = await A.open(browser, { device: 'fold', base: BASE, query: 'still' })
    await A.unlock(n.page)
    await A.at(n.page, 'notes', [])
    const ph = await n.page.locator(`${front} .ios-search__input`).evaluate((i) => ({ overflow: getComputedStyle(i).textOverflow, placeholder: getComputedStyle(i, '::placeholder').textOverflow, w: Math.round(i.getBoundingClientRect().width) }))
    check('PH-7 Notes at 280 wide: a placeholder that does not fit ends in an ellipsis', ph.overflow === 'ellipsis' && ph.placeholder === 'ellipsis', JSON.stringify(ph))
    await n.ctx.close()
  }

  // ---------- The chaos tester's findings (MK-7, MK-11, MK-15, MK-17) ----------
  {
    const front = '.sb-slot[data-front] .ios-page[data-pos="top"]'
    const sheet = '.sb-slot[data-front] .ios-sheet'
    const t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still' })
    await A.unlock(t.page)
    await A.at(t.page, 'notes', [])

    // MK-17: new folders are numbered; MK-11: a name stops at a hundred characters
    const newFolder = async (typed) => {
      await t.page.locator(`${front} [aria-label="New Folder"]`).tap()
      await t.page.waitForSelector(`${sheet} .notes-name__input`, { timeout: 5000 })
      await t.sleep(450)
      const offered = await t.page.locator(`${sheet} .notes-name__input`).inputValue()
      if (typed !== undefined) await t.page.locator(`${sheet} .notes-name__input`).fill(typed)
      const kept = await t.page.locator(`${sheet} .notes-name__input`).inputValue()
      await t.page.locator(`${sheet} [aria-label="Done"]`).tap()
      await t.sleep(900)
      return { offered, kept }
    }
    const first = await newFolder()
    const second = await newFolder()
    const third = await newFolder()
    check('MK-17 Notes: new folders are offered New Folder, New Folder 2, New Folder 3', [first.offered, second.offered, third.offered].join() === 'New Folder,New Folder 2,New Folder 3', [first.offered, second.offered, third.offered].join())
    const long = await newFolder('Questions for the Shrug partners about how early and how much and what happens after the check and how to get in front of them and what drops are and what VIP is')
    check('MK-11 Notes: a folder\'s name stops at a hundred characters', long.kept.length === 100, String(long.kept.length))
    const rows = await t.page.locator(`${front} .notes-folder`).evaluateAll((els) => els.map((el) => ({ name: el.querySelector('.ios-cell__title').textContent.slice(0, 24), h: Math.round(el.getBoundingClientRect().height), lines: Math.round(el.querySelector('.ios-cell__title').getBoundingClientRect().height / parseFloat(getComputedStyle(el.querySelector('.ios-cell__title')).lineHeight)) })))
    check('MK-11 Notes: a long name is two lines in the list, with the rest cut', rows.length === 6 && rows[5].lines === 2 && rows.slice(0, 5).every((r) => r.lines === 1), JSON.stringify(rows.map((r) => r.lines)))
    await t.page.screenshot({ path: require('path').join(A.OUT, 'fixP-mk-folders.png') })

    // MK-17: what is typed is set in its own direction
    await t.page.locator(`${front} [aria-label="New Note"]`).tap()
    await t.sleep(900)
    const title = t.page.locator(`${front} textarea[aria-label="Title"]`)
    const body = t.page.locator(`${front} textarea[aria-label="Note"]`)
    await title.fill('Ask about drops')
    await body.fill('שלום לכולם')
    await t.sleep(200)
    const dirs = await t.page.evaluate((front) => ({ title: document.querySelector(`${front} textarea[aria-label="Title"]`)?.dir, body: document.querySelector(`${front} textarea[aria-label="Note"]`)?.dir, bodyDir: getComputedStyle(document.querySelector(`${front} textarea[aria-label="Note"]`)).direction }), front)
    check('MK-17 Notes: a note\'s title and body are dir="auto" (Hebrew is set right to left)', dirs.title === 'auto' && dirs.body === 'auto' && dirs.bodyDir === 'rtl', JSON.stringify(dirs))

    // MK-7: a reload brings the visitor's notes and folders back, with the place
    const before = await A.state(t.page)
    await t.page.reload({ waitUntil: 'load' })
    await t.page.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.os[data-booted]'), null, { timeout: 30000 })
    await t.sleep(1200)
    const after = await A.state(t.page)
    const back = await t.page.evaluate((front) => ({ title: document.querySelector(`${front} textarea[aria-label="Title"]`)?.value ?? null, body: document.querySelector(`${front} textarea[aria-label="Note"]`)?.value ?? null }), front)
    check('MK-7 Notes: after a reload the note that was open is there, with its words', !after.locked && JSON.stringify(after.place) === JSON.stringify(before.place) && back.title === 'Ask about drops' && back.body === 'שלום לכולם', JSON.stringify({ place: after.place, back }))
    await A.at(t.page, 'notes', [])
    const names = await t.page.locator(`${front} .notes-folder .ios-cell__title`).allInnerTexts()
    check('MK-7 Notes: and so are the folders that were made', names.length === 6 && names[2] === 'New Folder' && names[3] === 'New Folder 2', names.map((n) => n.slice(0, 14)).join(' | '))
    const counts = await t.page.locator(`${front} .notes-folder .ios-cell__value`).allInnerTexts()
    check('MK-7 Notes: the Notes folder still counts its one note', counts[1]?.trim() === '1', counts.join())

    // MK-7: something that is no longer there shows what it was in, and the phone steps back to it
    for (const [stack, lands, says] of [
      [['f:notes', 'u:zz9'], 'f:notes', 'Notes'],
      [['f:u999'], '', 'Folders'],
      [['f:u999', 'u:zz9'], '', 'Folders'],
      [['f:faqs', 'n:99'], 'f:faqs', 'FAQs'],
      [['x:what'], '', 'Folders'],
    ]) {
      await A.at(t.page, 'notes', stack, null, 1500)
      const s = await A.state(t.page)
      const shown = await t.page.evaluate((front) => {
        const page = document.querySelector(front)
        return { title: (page?.querySelector('.ios-large, .ios-bar__title')?.textContent ?? '').trim(), empty: !!page?.querySelector('.ios-empty'), pages: document.querySelectorAll('.sb-slot[data-front] .ios-page').length }
      }, front)
      check(`MK-7 Notes: ${stack.join(' > ')} (gone) lands on ${says}`, s.place?.app === 'notes' && s.place.stack.join() === lands && shown.title.startsWith(says), JSON.stringify({ stack: s.place?.stack, shown }))
    }
    check('MK: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | ').slice(0, 300))
    await t.ctx.close()

    // MK-7: a page that may not keep anything carries on without
    const r = await A.open(browser, { device: 'iphone', base: BASE, query: 'still', goto: false })
    await r.page.addInitScript(() => {
      const refuse = () => { throw new DOMException('refused', 'SecurityError') }
      Storage.prototype.getItem = refuse
      Storage.prototype.setItem = refuse
    })
    await r.page.goto(BASE + '?still')
    await A.unlock(r.page)
    await A.at(r.page, 'notes', ['f:notes'])
    await r.page.locator(`${front} [aria-label="New Note"]`).tap()
    await r.sleep(900)
    await r.page.locator(`${front} textarea[aria-label="Title"]`).fill('Kept in memory')
    await A.at(r.page, 'notes', ['f:notes'])
    const mem = await r.page.locator(`${front} .notes-row`).allInnerTexts()
    check('MK-7 Notes: with storage refused, notes still work for as long as the page does', mem.length === 1 && /Kept in memory/.test(mem[0]) && A.realErrors(r.errors).length === 0, mem.join(' | ').replace(/\s+/g, ' ') + ' ' + A.realErrors(r.errors).join(' | ').slice(0, 200))
    await r.ctx.close()

    // MK-15: Escape in search, with a keyboard (the iPhone in its frame on a computer)
    const k = await A.open(browser, { device: { w: 600, h: 900, dpr: 1 }, base: BASE, query: 'still' })
    await A.unlock(k.page)
    const where = () => k.page.evaluate((front) => {
      const page = document.querySelector(front)
      const field = page?.querySelector('.ios-search__input')
      return { rows: page?.querySelectorAll('.contacts-row').length ?? 0, value: field?.value ?? null, focused: !!field && document.activeElement === field }
    }, front)
    await A.at(k.page, 'finder', [])
    await k.page.locator(`${front} .ios-search__input`).click()
    await k.sleep(400)
    await k.page.keyboard.type('varda')
    await k.sleep(200)
    const steps = [await where()]
    for (let i = 0; i < 3; i++) {
      await k.page.keyboard.press('Escape')
      await k.sleep(700)
      steps.push({ ...(await where()), stack: (await A.state(k.page)).place?.stack?.join() ?? null, app: (await A.state(k.page)).place?.app ?? null })
    }
    check('MK-15 Contacts: Escape empties the search, and the whole list is back', steps[0].rows === 1 && steps[1].rows === 81 && steps[1].value === '' && steps[1].focused, JSON.stringify([steps[0], steps[1]]))
    check('MK-15 Contacts: then lets go of the field', steps[2].app === 'finder' && !steps[2].focused, JSON.stringify(steps[2]))
    check('MK-15 Contacts: and only then leaves the app', steps[3].app === null, JSON.stringify(steps[3]))

    await A.at(k.page, 'notes', ['f:faqs'])
    await k.page.locator(`${front} .ios-search__input`).click()
    await k.page.keyboard.type('gifts')
    await k.sleep(300)
    const nwhere = async () => ({ ...(await k.page.evaluate((front) => { const f = document.querySelector(`${front} .ios-search__input`); return { value: f?.value ?? null, focused: !!f && document.activeElement === f } }, front)), stack: (await A.state(k.page)).place?.stack?.join() ?? null })
    const n = []
    for (let i = 0; i < 3; i++) {
      await k.page.keyboard.press('Escape')
      await k.sleep(700)
      n.push(await nwhere())
    }
    check('MK-15 Notes: Escape empties the search, then lets go, then goes Back', n[0].value === '' && n[0].focused && !n[1].focused && n[1].stack === 'f:faqs' && n[2].stack === '', JSON.stringify(n))
    await k.ctx.close()

    // A long answer can be read to its end from the keyboard: the page of a note takes the keyboard itself,
    // and is named by its question (there is nothing in an answer to press, so nothing else in it could)
    {
      const w = await A.open(browser, { device: 'laptop', base: BASE, query: 'still&open=faqs' })
      await up(w.page)
      await w.sleep(1300)
      await w.page.locator('.wf[data-app="notes"] .faq-row').nth(4).click()
      await w.sleep(300)
      const pane = w.page.locator('.wf[data-app="notes"] .faq__body')
      const said = await pane.evaluate((el) => ({ tab: el.tabIndex, role: el.getAttribute('role'), name: document.getElementById(el.getAttribute('aria-labelledby') || '')?.textContent?.trim() ?? null, scrolls: el.scrollHeight > el.clientHeight + 40 }))
      await pane.focus()
      await w.page.keyboard.press('End')
      await w.sleep(500)
      const read = await pane.evaluate((el) => ({ top: Math.round(el.scrollTop), end: el.scrollHeight - el.clientHeight, ring: el.matches(':focus-visible') ? getComputedStyle(el).outlineStyle : 'none' }))
      check('the desktop: a long answer\'s page takes the keyboard, is named by its question, and End reads it to its foot', said.tab === 0 && said.role === 'group' && said.name === 'How do you do marketing?' && said.scrolls && read.top > 40 && Math.abs(read.top - read.end) <= 2 && read.ring === 'solid', JSON.stringify({ said, read }))
      await w.ctx.close()

      const ph = await A.open(browser, { device: { w: 600, h: 900, dpr: 1 }, base: BASE, query: 'still' })
      await A.unlock(ph.page)
      await A.at(ph.page, 'notes', ['f:faqs', 'n:4'])
      const page = ph.page.locator(`${front} [data-scroller]`)
      const psaid = await page.evaluate((el) => ({ tab: el.tabIndex, role: el.getAttribute('role'), name: document.getElementById(el.getAttribute('aria-labelledby') || '')?.textContent?.trim() ?? null, scrolls: el.scrollHeight > el.clientHeight + 40 }))
      await ph.page.keyboard.press('Tab')
      const onPage = await page.evaluate((el) => document.activeElement === el)
      await ph.page.keyboard.press('End')
      await ph.sleep(500)
      const pread = await page.evaluate((el) => ({ top: Math.round(el.scrollTop), end: el.scrollHeight - el.clientHeight }))
      check('the phone: a question\'s note takes Tab first, is named by its question, and End reads it to its foot', psaid.tab === 0 && psaid.role === 'group' && psaid.name === 'How do you do marketing?' && psaid.scrolls && onPage && pread.top > 40 && Math.abs(pread.top - pread.end) <= 2, JSON.stringify({ psaid, onPage, pread }))
      // a note of the visitor's own has a field in it, which is what takes the keyboard there
      await A.at(ph.page, 'notes', [])
      await ph.page.locator(`${front} button[aria-label="New Note"]`).first().click()
      await ph.sleep(900)
      const own = await ph.page.locator(`${front} [data-scroller]`).evaluate((el) => ({ tab: el.getAttribute('tabindex'), field: !!el.querySelector('textarea, [contenteditable]') }))
      check('…and a note of the visitor\'s own keeps the keyboard in its field, not on its page', own.tab === null && own.field, JSON.stringify(own))
      await ph.ctx.close()
    }

    // MK-17: the desktop's search field is dir="auto" too
    const d = await A.open(browser, { device: 'laptop', base: BASE, query: 'still&open=portfolio' })
    await up(d.page)
    await d.sleep(1200)
    check('MK-17 the desktop\'s search field is dir="auto"', (await d.page.locator('.wf[data-app="finder"] .search__input').getAttribute('dir')) === 'auto')
    await d.page.locator('.wf[data-app="finder"] .search__input').fill('x'.repeat(300))
    await d.sleep(200)
    const cutTo = (await d.page.locator('.wf[data-app="finder"] .pf__none b').innerText()).length
    check('MK-6 a long word searched for is said back cut short', cutTo < 70, String(cutTo))
    await d.ctx.close()
  }

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'ALL PASS')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
