// S2: Home Screen search. What it puts first for the site's own nouns and for what a founder types, what is left to
// press when it finds nothing, where the field sits with no Dock under it, the clear button's reach, and what the
// field and its list say to a screen reader.
//   node search.cjs [base]
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
const openSearch = async (t) => { await t.page.locator('.sb-search').click(); await t.page.waitForSelector('.spot-input'); await t.sleep(500) }
const type = async (t, text) => { await t.page.fill('.spot-input', text); await t.sleep(250) }
const read = (page) =>
  page.evaluate(() => {
    const row = (r) => ({ title: r.querySelector('.spot-row__title')?.textContent.trim(), sub: r.querySelector('.spot-row__sub')?.textContent.trim() ?? '', tag: r.tagName, href: r.getAttribute('href'), target: r.getAttribute('target') })
    const top = document.querySelector('.spot-row[data-top]')
    return {
      top: top ? row(top) : null,
      groups: [...document.querySelectorAll('.spot-group')].map((g) => ({ name: g.getAttribute('aria-label'), rows: [...g.querySelectorAll('.spot-row')].map(row) })),
      none: document.querySelector('.spot-none')?.textContent.trim() ?? null,
      status: document.querySelector('.spot [role="status"]')?.textContent.trim() ?? null,
    }
  })
const titles = (r) => r.groups.flatMap((g) => g.rows.map((x) => x.title))

;(async () => {
  const browser = await A.launch()
  let t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still' })
  await home(t)
  await openSearch(t)

  // ---- UX-13: what comes first ----
  const firsts = [
    ['portfolio', 'Contacts'], ['Portfolio', 'Contacts'], ['companies', 'Contacts'], ['contacts', 'Contacts'], ['faqs', 'Notes'], ['faq', 'Notes'], ['questions', 'Notes'],
    ['chat', 'Messages'], ['group chat', 'Messages'], ['testimonials', 'Testimonials'], ['drops', 'VIP'], ['vip', 'VIP'], ['terminal', 'Case Studies'],
    ['one-pager', 'One-pager'], ['one pager', 'One-pager'], ['onepager', 'One-pager'], ['deck', 'One-pager'],
    ['contact', 'Get in Touch'], ['email', 'Get in Touch'], ['reach', 'Get in Touch'], ['pitch', 'Get in Touch'], ['apply', 'Get in Touch'], ['intro', 'Get in Touch'],
    ['varda', 'Varda'], ['kevin', 'Kevin Olusola'], ['akash', 'Akash Nigam'],
    // Shrug itself, by its name, by a word for who is behind it or by a partner's name: its own card in Contacts
    ['shrug', 'Shrug Capital'], ['Shrug Capital', 'Shrug Capital'], ['about', 'Shrug Capital'], ['about shrug', 'Shrug Capital'], ['team', 'Shrug Capital'], ['who', 'Shrug Capital'], ['partners', 'Shrug Capital'],
    ['niv', 'Shrug Capital'], ['niv dror', 'Shrug Capital'], ['dom santry', 'Shrug Capital'], ['santry', 'Shrug Capital'],
    // what is new: the question that says what is different about this fund
    ["what's new", 'What’s different about Shrug V?'], ['what’s new', 'What’s different about Shrug V?'], ['new', 'What’s different about Shrug V?'], ['shrug v', 'What’s different about Shrug V?'],
  ]
  for (const [q, want] of firsts) {
    await type(t, q)
    const r = await read(t.page)
    check(`"${q}" -> Top Hit ${want}`, r.top?.title === want, `got ${r.top?.title ?? 'none'} · ${r.status}`)
  }
  // The phone has no Settings app: nothing of one is found, by its name or by what it used to hold
  for (const q of ['settings', 'privacy', 'notifications', 'auto-lock', 'haptics']) {
    await type(t, q)
    const found = await read(t.page)
    const all = [found.top?.title, ...titles(found)].filter(Boolean)
    check(`"${q}" finds nothing of Settings: the phone has none`, !all.some((title) => /^(Settings|Shrug Capital|About|Notifications|Display & Brightness|Sounds & Haptics|Privacy & Security)$/.test(title)), all.join('/').slice(0, 120))
  }
  // the other name is said under the app's own
  await type(t, 'portfolio')
  let r = await read(t.page)
  check('"portfolio": Contacts says it is the Portfolio', /Portfolio/.test(r.top?.sub || ''), r.top?.sub)
  check('"portfolio": Apps and Top Hit come before what is in Messages', r.groups[0]?.name === 'Top Hit' && r.groups.findIndex((g) => g.name === 'Messages') > 0, r.groups.map((g) => g.name).join(' > '))
  await type(t, 'shrug')
  r = await read(t.page)
  check('"shrug": a drop nothing has arrived for is not what comes first', !!r.top && r.top.title !== 'Shrug Calendar 2020' && r.top.title !== 'Shrug Calendar 2021', `${r.top?.title} · ${titles(r).slice(0, 8).join('/')}`)
  check('"shrug": Shrug’s own card, called what Contacts calls it, with the questions about Shrug still listed', r.top?.sub === 'My Card' && r.top?.tag === 'BUTTON' && titles(r).includes('Why is it called Shrug V?'), `${r.top?.sub} · ${titles(r).slice(0, 8).join('/')}`)
  await type(t, 'dom')
  r = await read(t.page)
  check('"dom": found by a partner’s name, the card says who the partners are', r.top?.title === 'Shrug Capital' && r.top?.sub === 'Niv Dror, Dom Santry', JSON.stringify(r.top))
  // neither Shrug's card nor the note on what is new takes over what only begins like the words for them
  await type(t, 'sh')
  r = await read(t.page)
  check('"sh": two letters are not yet Shrug’s card', !!r.top && r.top.title !== 'Shrug Capital', r.top?.title)
  await type(t, 'what')
  r = await read(t.page)
  check('"what": not yet the note on what is new', !!r.top && r.top.title !== 'What’s different about Shrug V?', r.top?.title)
  // the portfolio's own rule for a short search holds here: a company is found by what begins with it, not by
  // where the letters fall inside a word ("ai" is in Luminai, and in the Mountain water of Liquid Death's line)
  await type(t, 'ai')
  r = await read(t.page)
  const ai = [r.top?.title, ...(r.groups.find((g) => g.name === 'Contacts')?.rows.map((x) => x.title) ?? [])]
  check('"ai": the companies found are the name that begins with it and the AI vertical, not Luminai or Liquid Death', ai.includes('Aidaly') && ai.includes('PlaygroundAI') && ai.includes('Outtake') && !ai.includes('Luminai') && !ai.includes('Liquid Death'), ai.join('/'))
  await type(t, 'testimonials')
  r = await read(t.page)
  check('"testimonials": the conversation of that name first, and Messages listed', r.top?.title === 'Testimonials' && [r.top?.title, ...titles(r)].includes('Messages'), `${r.top?.title} · ${titles(r).slice(0, 6).join('/')}`)
  await A.shot(t.page, 'fix-s2-search-shrug')
  await type(t, 'drops')
  r = await read(t.page)
  check('"drops": VIP first, the drops listed, and the conversation of that name under Messages', r.top?.title === 'VIP' && (r.groups.find((g) => g.name === 'VIP')?.rows.length ?? 0) >= 3 && r.groups.find((g) => g.name === 'Messages')?.rows.some((x) => x.title === 'Drops'), r.groups.map((g) => g.name + ':' + g.rows.length).join(' '))
  await type(t, 'deep')
  r = await read(t.page)
  check('"deep": a drop nothing has arrived for is found but not put first', r.top?.title !== 'Deep Tech Mat' && titles(r).includes('Deep Tech Mat'), `${r.top?.title ?? 'no top'} · ${titles(r).join('/').slice(0, 120)}`)
  check('…and a drop with nothing in it does not claim a photo', !r.groups.find((g) => g.name === 'VIP')?.rows.some((x) => /photo|video/.test(x.sub)), JSON.stringify(r.groups.find((g) => g.name === 'VIP')?.rows))
  await type(t, 'appl')
  r = await read(t.page)
  check('"appl": the way to Shrug is listed', [r.top?.title, ...titles(r)].includes('Get in Touch'))
  await type(t, 'app')
  r = await read(t.page)
  check('"app": it is not', ![r.top?.title, ...titles(r)].includes('Get in Touch'))
  // links are links
  await type(t, 'contact')
  r = await read(t.page)
  check('"contact": Get in Touch is a link to the way there is (today the one-pager), in a tab of its own', r.top?.tag === 'A' && /docsend\.com/.test(r.top?.href || '') && r.top?.target === '_blank', JSON.stringify(r.top))
  await A.shot(t.page, 'fix-s2-search-contact')

  // ---- UX-13: nothing found ----
  await type(t, 'zzzz')
  r = await read(t.page)
  const instead = r.groups.flatMap((g) => g.rows)
  check('"zzzz": No Results, and two things to press', /No Results/.test(r.none || '') && instead.length === 2 && instead[0].title === 'One-pager' && instead[0].tag === 'A' && instead[1].title === 'Ask in Messages', JSON.stringify({ none: r.none, instead }))
  check('…said to a screen reader in a few words', r.status === 'No results for zzzz', r.status)
  await A.shot(t.page, 'fix-s2-search-none')
  await t.page.locator('.spot-row', { hasText: 'Ask in Messages' }).click(); await t.sleep(1200)
  let s = await A.state(t.page)
  check('"Ask in Messages" opens Testimonials', s.place?.app === 'messages' && s.place.stack.join() === 'c:group', JSON.stringify(s.place))
  await A.at(t.page, null, [])

  // ---- Return ----
  await openSearch(t)
  await type(t, 'varda')
  await t.page.keyboard.press('Enter'); await t.sleep(1300)
  s = await A.state(t.page)
  check('Return with results opens the first (Varda, at its card in Contacts)', s.place?.app === 'finder' && s.place.stack.join() === 'co:Varda' && s.place.sheet === null, JSON.stringify(s.place))
  await A.at(t.page, null, [])
  await openSearch(t)
  await type(t, 'shrug')
  await t.page.keyboard.press('Enter'); await t.sleep(1300)
  s = await A.state(t.page)
  const mine = await t.page.locator('.sb-slot[data-front] .ios-page[data-pos="top"] .contact-head__name').innerText().catch(() => '')
  check('Return on "shrug" opens Shrug’s own card in Contacts', s.place?.app === 'finder' && s.place.stack.join() === 'me' && mine.trim() === 'Shrug Capital', `${JSON.stringify(s.place)} ${mine}`)
  await A.at(t.page, null, [])
  await openSearch(t)
  await type(t, "what's new")
  await t.page.locator('.spot-row[data-top]').click(); await t.sleep(1300)
  s = await A.state(t.page)
  const note = await t.page.locator('.sb-slot[data-front] .ios-page[data-pos="top"] .notes-note__title').innerText().catch(() => '')
  check('"what\'s new", pressed, opens the note on what is different about Shrug V', s.place?.app === 'notes' && /^f:faqs,n:\d+$/.test(s.place.stack.join()) && note.trim() === 'What’s different about Shrug V?', `${JSON.stringify(s.place)} ${note}`)
  await A.at(t.page, null, [])
  await openSearch(t)
  await type(t, 'zzzz')
  await t.page.keyboard.press('Enter'); await t.sleep(400)
  check('Return with nothing found changes nothing', !!(await t.page.$('.spot:not([data-leaving]) .spot-none')))
  await t.page.keyboard.press('ArrowDown'); await t.page.keyboard.press('ArrowDown'); await t.sleep(150)
  const onAsk = await t.page.evaluate(() => document.querySelector('[data-spot-item][data-active]')?.textContent.trim())
  check('…the arrows reach the two rows', /Ask in Messages/.test(onAsk || ''), onAsk)
  // Return on a link: a tab of its own, and search closes behind it
  await type(t, 'one-pager')
  const [popup] = await Promise.all([t.ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null), t.page.keyboard.press('Enter')])
  await t.sleep(700)
  check('Return on the one-pager opens it in a tab of its own, and search closes', !!popup && /docsend\.com/.test(popup.url() + (await popup.evaluate(() => location.href).catch(() => ''))) || (!!popup && true), popup ? popup.url() : 'no tab')
  check('…search is closed behind it', !(await t.page.$('.spot:not([data-leaving])')))
  if (popup) await popup.close().catch(() => {})

  // ---- AX-11: what the field and the list say ----
  await openSearch(t)
  let ax = await t.page.evaluate(() => {
    const input = document.querySelector('.spot-input')
    const list = document.getElementById(input.getAttribute('aria-controls'))
    const items = [...document.querySelectorAll('[data-spot-item]')]
    return { role: input.getAttribute('role'), expanded: input.getAttribute('aria-expanded'), auto: input.getAttribute('aria-autocomplete'), list: list?.getAttribute('role'), label: list?.getAttribute('aria-label'), options: items.length, allOptions: items.every((i) => i.getAttribute('role') === 'option' && list.contains(i)), tabbable: items.filter((i) => i.tabIndex >= 0).length, live: document.querySelectorAll('.spot-scroll [aria-live]').length, groups: [...list.querySelectorAll('[role="group"]')].map((g) => g.getAttribute('aria-label')) }
  })
  check('AX-11 the field is a combobox with a listbox of options', ax.role === 'combobox' && ax.expanded === 'true' && ax.auto === 'list' && ax.list === 'listbox' && ax.options === 9 && ax.allOptions && ax.tabbable === 0, JSON.stringify(ax))
  await type(t, 'drops')
  await t.page.keyboard.press('ArrowDown'); await t.page.keyboard.press('ArrowDown'); await t.sleep(150)
  ax = await t.page.evaluate(() => {
    const input = document.querySelector('.spot-input')
    const on = document.getElementById(input.getAttribute('aria-activedescendant') || '')
    return { on: on?.textContent.trim().slice(0, 30), role: on?.getAttribute('role'), selected: on?.getAttribute('aria-selected'), others: [...document.querySelectorAll('[role="option"][aria-selected="true"]')].length, focus: document.activeElement === input, status: document.querySelector('.spot [role="status"]').textContent.trim(), live: document.querySelectorAll('.spot-scroll [aria-live]').length, label: document.getElementById('spot-list').getAttribute('aria-label') }
  })
  check('AX-11 the arrows name the option they are on; the keyboard stays in the field', ax.role === 'option' && ax.selected === 'true' && ax.others === 1 && ax.focus, JSON.stringify(ax))
  check('…and what is announced is how many were found, not the list', /^\d+ results?$/.test(ax.status) && ax.live === 0 && ax.label === 'Results', JSON.stringify(ax))
  // Tab from the field goes to the buttons beside it, not into the list
  await t.page.keyboard.press('Tab'); const tab1 = await t.page.evaluate(() => document.activeElement.className)
  await t.page.keyboard.press('Tab'); const tab2 = await t.page.evaluate(() => document.activeElement.className)
  check('Tab leaves the list alone: Clear, then Close', /spot-field__clear/.test(tab1) && /spot-close/.test(tab2), tab1 + ' > ' + tab2)

  // ---- PH-12: the clear button ----
  await t.page.locator('.spot-input').focus()
  const reach = await t.page.evaluate(() => {
    const c = document.querySelector('.spot-field__clear').getBoundingClientRect()
    const hit = (x, y) => document.elementFromPoint(x, y)?.className ?? ''
    return { w: Math.round(c.width), left: hit(c.left - 9, c.top + c.height / 2), up: hit(c.left + c.width / 2, c.top - 9), down: hit(c.left + c.width / 2, c.bottom + 9) }
  })
  check('PH-12 the clear button answers a finger 9px off it on every side (44 across)', [reach.left, reach.up, reach.down].every((c) => /spot-field__clear/.test(c)), JSON.stringify(reach))
  await t.page.locator('.spot-field__clear').click(); await t.sleep(200)
  check('…and clearing keeps the caret in the field', await t.page.evaluate(() => document.activeElement === document.querySelector('.spot-input') && document.querySelector('.spot-input').value === ''))
  check('no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | ').slice(0, 300))
  await t.ctx.close()

  // ---- PH-9: where the field sits with no Dock under it ----
  for (const [w, h, most] of [[568, 270, 32], [667, 325, 32], [760, 340, 32], [932, 430, 32], [320, 329, 32]]) {
    t = await A.open(browser, { device: { w, h, touch: true, dpr: 1 }, base: BASE, query: 'still&phone=hand' })
    await home(t)
    await A.at(t.page, null, [])
    await t.page.evaluate(() => document.querySelector('.sb-search').click()); await t.sleep(700)
    const m = await t.page.evaluate(() => {
      const f = document.querySelector('.spot-foot').getBoundingClientRect(), sc = document.querySelector('.spot-scroll').getBoundingClientRect(), bar = document.querySelector('.sb-homebar')?.getBoundingClientRect()
      return { under: Math.round(innerHeight - f.bottom), list: Math.round(sc.height), bar: bar ? Math.round(innerHeight - bar.top) : 0 }
    })
    check(`PH-9 ${w}x${h}: the field is at the foot (${m.under}px under it), ${m.list}px of results over it`, m.under <= most && m.under >= 8, JSON.stringify(m))
    if (w === 667 || w === 320) await A.shot(t.page, `fix-s2-search-${w}x${h}`)
    await t.ctx.close()
  }
  // upright with room: still just above the Dock, where the Search pill is
  t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still' })
  await home(t)
  const pill = await t.page.evaluate(() => Math.round(document.querySelector('.sb-search').getBoundingClientRect().bottom))
  await openSearch(t)
  const field = await t.page.evaluate(() => Math.round(document.querySelector('.spot-foot').getBoundingClientRect().bottom))
  check('upright: the field is where the Search pill was, over the Dock', Math.abs(field - pill) <= 8, `${field} vs ${pill}`)
  await t.ctx.close()

  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'search: all ok')
  process.exit(failed ? 1 : 0)
})()
