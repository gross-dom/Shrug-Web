// Fixer T's checks: Case Studies (the terminal) and VIP, on both layouts. VIP was a photo library when these
// were written; it is the way to the points site now, a link wherever it appears, and its half of these holds
// to that: the link by every route, no window or app by any, and the two windows still laid out with its
// classes (Wallpapers, Updates) looking as they did.
//   node terminal-vip.cjs [base] [only: term|vip|axe]
// (term: terminal-vip.cjs itself; vip: terminal-vip-link.cjs; axe: terminal-vip-axe.cjs, axe-core over the same screens on both layouts.)
// The base is the dev server unless given (the built site: http://127.0.0.1:4173/). One group of checks needs a
// module swapped under the page (a contact address): it runs on the dev server only.
const A = require('./lib.cjs')
const path = require('path')
const BASE = process.argv[2] || 'http://127.0.0.1:5173/'
const ONLY = process.argv[3]
const DEV = /:5173\//.test(BASE)
const OUT = A.OUT
require('fs').mkdirSync(OUT, { recursive: true })

let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail && (!ok || process.env.VERBOSE) ? '  ' + String(detail).slice(0, 400) : ''))
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') })
const arrived = (page) => page.waitForFunction(() => !document.getElementById('boot') && !!document.querySelector('.os[data-booted]'), null, { timeout: 30000 })

/** Swaps a module of the site's for an edited copy, for this page only (dev server). */
const swap = (page, file, edit) =>
  page.route('**/' + file + '*', async (route) => {
    const res = await route.fetch()
    const body = edit(await res.text())
    await route.fulfill({ response: res, body })
  })

// ---------------------------------------------------------------- the terminal

async function terminal(browser) {
  // ---- desktop, mouse and keyboard
  let t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&open=case-studies' })
  let p = t.page
  await arrived(p)
  await p.waitForSelector('.wf[data-app="terminal"] .term__input', { timeout: 15000 })
  await p.waitForTimeout(900)
  const log = () => p.locator('.wf[data-app="terminal"] .term__log').innerText()
  const lines = () => p.$$eval('.wf[data-app="terminal"] .term__log > *', (els) => els.map((e) => e.textContent))
  const type = async (text) => {
    await p.locator('.wf[data-app="terminal"] .term__input').click()
    if (text) await p.keyboard.type(text)
    await p.keyboard.press('Enter')
    await p.waitForTimeout(120)
  }
  check('desktop: opens on the listing, the refusal and the question', /permission denied/.test(await log()) && /request access\? \(y\/n\)/.test(await log()))
  const listing = (await lines())[1]
  check('desktop: the listing has the two public case studies after the private ones', /^varda\/ .*superhuman\/  alt\/  lula\/$/.test(listing) && !/\.rules/.test(listing), listing)
  check('desktop: no keys with a mouse', (await p.locator('.term__keys').evaluate((el) => getComputedStyle(el).display)) === 'none')
  const title = await p.locator('.wf[data-app="terminal"] .ss-term__title').evaluate((el) => getComputedStyle(el).color)
  check('desktop: the title is a grey that reads (AX-15)', title === 'rgb(142, 142, 147)', title)

  await type('y')
  let text = await log()
  check('y: asks for nothing and takes no request; says two are public and the rest are not (UX-3)', /two are public:/.test(text) && /the rest aren’t\. start with the one-pager:/.test(text) && !/by hand|request (sent|received|taken)|we’ll|email\?/i.test(text) && !/prototype/.test(text), text.slice(-260))
  const links = await p.$$eval('.wf[data-app="terminal"] .term__link', (as) => as.map((a) => [a.childNodes[0].textContent, a.getAttribute('href'), a.target, a.rel]))
  check('y: the two public case studies are links to their pages', links.some(([t, h]) => t === 'alt/' && /shrug\.notion\.site\/Alt-/.test(h)) && links.some(([t, h]) => t === 'lula/' && /shrug\.notion\.site\/Lula-/.test(h)), JSON.stringify(links))
  check('y: then the way on: the one-pager, a line to press that goes nowhere else (on the desktop it opens in Preview: preview.cjs)', links.some(([t, h]) => t === 'read the one-pager' && h === null) && (await p.$$eval('.wf[data-app="terminal"] .term__link', (els) => els.filter((el) => /one-pager/.test(el.textContent)).every((el) => el.tagName === 'BUTTON'))), JSON.stringify(links))
  check('y: the line is still a plain text field', (await p.locator('.wf[data-app="terminal"] .term__input').getAttribute('type')) === 'text')
  await shot(p, 'term-desktop-y')

  // every way back comes back to the question (DK-2)
  for (const word of ['n', 'no', 'cancel', 'back', 'exit', 'q']) {
    await type(word)
    const last = (await lines()).slice(-2)
    check(`"${word}": back to the question`, /they’ll be here/.test(last[0]) && /\(y\/n\)/.test(last[1]), JSON.stringify(last))
  }
  // in character (UX-22, DK-12)
  await type('help')
  check('help: says what can be typed', /cat <name>/.test(await log()) && /open <app>/.test(await log()) && /clear/.test(await log()))
  const help = (await lines()).slice(-10)
  check('help: a line to a command, each short enough for a phone held upright (40 characters)', help.length === 10 && help.every((l) => l.length <= 40) && help.some((l) => /^whois <name> +a person, or a company$/.test(l)) && help.some((l) => /^fortune +something one of them said$/.test(l)), help.map((l) => l.length).join())
  check('help: has please and date, and leaves .rules to be found', help.some((l) => /^please +ask nicely$/.test(l)) && help.some((l) => /^date +the time in san francisco$/.test(l)) && !help.some((l) => /rules/.test(l)), help.join(' | '))
  await type('ls')
  check('ls: lists the case studies again, the public ones with them', (await lines()).slice(-1)[0] === listing, (await lines()).slice(-1)[0])
  // a file to be found: ls -a shows it, and it holds the rules of engagement as the FAQs give them
  await type('ls -a')
  check('ls -a: lists .rules too, first', (await lines()).slice(-1)[0] === '.rules  ' + listing, (await lines()).slice(-1)[0])
  await type('ll -la')
  check('ll -la: the same', (await lines()).slice(-1)[0] === '.rules  ' + listing, (await lines()).slice(-1)[0])
  await type('cat .rules')
  const rules = (await lines()).slice(-6)
  check('cat .rules: Shrug’s rules of engagement, a line each', (await lines()).slice(-7)[0] === '> cat .rules' && /^We don’t talk about ourselves publicly$/.test(rules[0]) && /^We always come with gifts!$/.test(rules[5]), rules.join(' | '))
  // the time where the desk's widget keeps its clock
  const there = () => {
    const of = Object.fromEntries(new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }).formatToParts(new Date()).map((part) => [part.type, part.value]))
    return `${of.weekday} ${of.month} ${of.day}, ${of.hour}:${of.minute} ${of.dayPeriod} in san francisco.`.toLowerCase()
  }
  const around = [there()]
  await type('date')
  around.push(there())
  check('date: the day and the time in San Francisco, in the terminal’s lower case', around.includes((await lines()).slice(-1)[0]), `${(await lines()).slice(-1)[0]} (there it is: ${around[1]})`)
  // asked nicely, as the Dock's label says to
  await type('please')
  const nicely = (await lines()).slice(-3)
  const given = await p.$$eval('.wf[data-app="terminal"] .term__link', (as) => as.slice(-2).map((a) => [a.childNodes[0].textContent, a.getAttribute('href')]))
  check('please: the two public case studies, with their links', nicely[0] === 'since you asked nicely. two are public:' && given[0][0] === 'alt/' && /shrug\.notion\.site\/Alt-/.test(given[0][1]) && given[1][0] === 'lula/' && /shrug\.notion\.site\/Lula-/.test(given[1][1]) && !/command not found: please/.test(await log()), nicely.join(' | '))
  await type('cat feastables/README')
  check('cat <a private one>: refused, and the question', /permission denied/.test((await lines()).slice(-2)[0]) && /\(y\/n\)/.test((await lines()).slice(-1)[0]))
  await type('cat alt/README')
  check('cat alt: it is public, here it is', /alt\/ is public/.test((await lines()).slice(-2)[0]) && (await lines()).slice(-1)[0].startsWith('alt/'))
  await type('whoami')
  check('whoami', /a founder, probably/.test((await lines()).slice(-1)[0]))
  await type('sudo make me a sandwich')
  check('sudo', /nice try/.test((await lines()).slice(-1)[0]))
  await type('cd ..')
  check('cd', /nowhere else to go/.test((await lines()).slice(-1)[0]))
  await type('')
  check('an empty line is an empty line: no scolding', (await lines()).slice(-1)[0] === '>' && !/y or n\.$/.test(await log()), JSON.stringify((await lines()).slice(-2)))
  await type('frobnicate now')
  check('anything else: command not found, and where to look', /command not found: frobnicate/.test((await lines()).slice(-2)[0]) && /help/.test((await lines()).slice(-1)[0]))
  await type('someone@example.com')
  text = (await lines()).slice(-3).join(' | ')
  check('an email typed anyway: not "noted", told it was not taken and where to go', /we don’t take addresses here\. that one stays with you\./.test(text) && /one-pager/.test(text) && !/noted/.test(await log()), text)

  // Up and Down walk what was typed
  const field = p.locator('.wf[data-app="terminal"] .term__input')
  await field.click()
  await p.keyboard.type('half')
  await p.keyboard.press('ArrowUp')
  const up1 = await field.inputValue()
  await p.keyboard.press('ArrowUp')
  const up2 = await field.inputValue()
  await p.keyboard.press('ArrowDown')
  await p.keyboard.press('ArrowDown')
  const down = await field.inputValue()
  check('ArrowUp recalls what was typed, ArrowDown comes back to the line', up1 === 'someone@example.com' && up2 === 'frobnicate now' && down === 'half', JSON.stringify([up1, up2, down]))
  // Escape: the line first, then the question
  await p.keyboard.press('Escape')
  check('Escape empties the line', (await field.inputValue()) === '')
  await type('y')
  await field.click()
  await p.keyboard.press('Escape')
  await p.waitForTimeout(100)
  check('Escape on an empty line: back to the question', /request access\? \(y\/n\)/.test((await lines()).slice(-1)[0]))

  // a line has a sensible length (MK-17)
  await p.locator('.wf[data-app="terminal"] .term__input').click()
  await p.keyboard.insertText('a'.repeat(5000) + '@example.com')
  const held = (await p.locator('.wf[data-app="terminal"] .term__input').inputValue()).length
  await p.keyboard.press('Enter')
  await p.waitForTimeout(150)
  const echoed = (await lines()).slice(-3)[0]
  check('a line is no longer than 120 characters, typed or pasted (MK-17)', held === 120 && echoed.length === 122 && /command not found/.test((await lines()).slice(-2)[0]), `${held} held, ${echoed.length} echoed, then: ${(await lines()).slice(-2)[0].slice(0, 40)}`)

  // open <app>
  await type('open portfolio')
  await p.waitForTimeout(700)
  const front = () => p.evaluate(() => [...document.querySelectorAll('.wf[data-app]')].filter((w) => !w.hasAttribute('inert') && getComputedStyle(w).visibility !== 'hidden').sort((a, b) => Number(getComputedStyle(b).zIndex || 0) - Number(getComputedStyle(a).zIndex || 0))[0]?.getAttribute('data-app'))
  check('open portfolio: the Portfolio window comes to the front', (await front()) === 'finder', await front())
  await p.click('[data-dock-app="terminal"]')
  await p.waitForTimeout(500)
  // everything `open` offers opens its window (asked what, it says which there are). VIP is the store, in a
  // window of its own, as any of the others is
  await type('open')
  const offered = (await lines()).slice(-1)[0].replace(/^open: what\? /, '').replace(/\.$/, '').split(', ')
  const windows = { portfolio: 'finder', faqs: 'notes', vip: 'myvip', chat: 'messages', about: 'about' }
  const opened = []
  for (const name of offered) {
    await type(`open ${name}`)
    await p.waitForTimeout(700)
    opened.push(`${name}:${await front()}`)
    await p.click('[data-dock-app="terminal"]')
    await p.waitForTimeout(500)
  }
  check('open <app>: each of the five it offers opens its window, VIP My VIP’s', offered.join() === 'portfolio,faqs,vip,chat,about' && opened.join() === offered.map((name) => `${name}:${windows[name]}`).join(), opened.join())
  const pagesBefore = t.ctx.pages().length
  await type('open vip')
  await p.waitForTimeout(1200)
  const handed = { said: (await lines()).slice(-1)[0], links: await p.locator('.wf[data-app="terminal"] .term__link', { hasText: 'open vip' }).count(), front: await front(), path: await p.evaluate(() => { try { return document.querySelector('.wf[data-app="myvip"] iframe')?.contentWindow?.location?.pathname ?? null } catch { return null } }) }
  check('open vip: says it is opening, and opens My VIP’s window on the store’s own pages: no link, and no tab', handed.said === 'opening vip.' && handed.links === 0 && handed.front === 'myvip' && handed.path === '/vip/store/' && t.ctx.pages().length === pagesBefore && (await p.locator('.wf[data-app="photos"]').count()) === 0, JSON.stringify(handed))
  await p.click('[data-dock-app="terminal"]')
  await p.waitForTimeout(500)
  await type('open photos')
  check('open photos: the name the VIP window had opens nothing, and says so', /^open: nothing called photos\. try portfolio, faqs, vip, chat, about\.$/.test((await lines()).slice(-1)[0]) && (await front()) === 'terminal', (await lines()).slice(-1)[0])
  // the rules the terminal printed are the FAQs' own, word for word
  await p.click('[data-dock-app="notes"]')
  await p.waitForTimeout(500)
  await p.locator('.wf[data-app="notes"] .faq-row', { hasText: 'How do you do marketing?' }).click()
  await p.waitForTimeout(300)
  const asked = await p.$$eval('.wf[data-app="notes"] .faq__note ul.answer__list', (lists) => [...lists[lists.length - 1].children].map((li) => li.textContent))
  check('cat .rules: the same lines as the list under "Our rules of engagement" in the FAQs', asked.length === 6 && asked.join('|') === rules.join('|'), asked.join(' | '))
  await p.click('[data-dock-app="terminal"]')
  await p.waitForTimeout(500)
  await type('open nothing-like-this')
  check('open <unknown>: says so, with what there is', /nothing called nothing-like-this/.test((await lines()).slice(-1)[0]))
  await type('open case studies')
  check('open case studies: you are in it', /you’re in it/.test((await lines()).slice(-1)[0]))

  // Tab finishes the word being typed, and never takes the keyboard out of the window while there is something to finish
  const line = () => p.locator('.wf[data-app="terminal"] .term__input').inputValue()
  const tab = async (text) => {
    await p.locator('.wf[data-app="terminal"] .term__input').click()
    await p.keyboard.press('Escape')
    await p.keyboard.type(text)
    await p.keyboard.press('Tab')
    await p.waitForTimeout(80)
    return line()
  }
  const inTerm = () => p.evaluate(() => !!document.activeElement?.closest('.wf[data-app="terminal"]') && document.activeElement.classList.contains('term__input'))
  const done = [await tab('fo'), await tab('cat va'), await tab('cat varda/'), await tab('open port'), await tab('whois tony h'), await tab('open vi')]
  check('Tab: finishes a command, a directory, the file in it, an app, a name, and VIP', done.join('|') === 'fortune |cat varda/|cat varda/README |open portfolio |whois tony hawk |open vip ' && (await inTerm()), done.join('|'))
  const before = (await lines()).length
  const several = await tab('cat s')
  check('Tab: several it could be: as far as they agree', several === 'cat super' && (await inTerm()), several)
  await p.keyboard.press('Tab')
  await p.waitForTimeout(80)
  check('Tab again, no further to go: the several are listed, and the line is as it was', (await line()) === 'cat super' && (await lines()).length === before + 1 && (await lines()).slice(-1)[0] === 'superplastic/  superhuman/', (await lines()).slice(-1)[0])
  check('Tab: nothing begins that way: the line and the keyboard stay', (await tab('zzz')) === 'zzz' && (await inTerm()))
  await p.keyboard.press('Escape')
  await p.keyboard.press('Tab')
  await p.waitForTimeout(80)
  check('Tab with nothing typed is the page’s own: the keyboard moves on', !(await inTerm()), await p.evaluate(() => document.activeElement?.className))
  // (where it moved on to may be another window, now in front: the terminal is brought back)
  await p.click('[data-dock-app="terminal"]')
  await p.waitForTimeout(500)

  // who someone is, and what a company does, from the site's own lists
  await type('whois maddie')
  let who = (await lines()).slice(-5)
  let goes = await p.$$eval('.wf[data-app="terminal"] button.term__link', (els) => els.slice(-2).map((e) => e.textContent))
  check('whois <a person>: their name, role and how they know Shrug, and the ways to their reply and their company', who[0] === 'Maddie Hall' && who[1] === 'Co-Founder of Living Carbon' && who[2] === 'backed by shrug' && goes.join('|') === 'Maddie Hall in the chat|Living Carbon in the portfolio', who.join(' | ') + ' // ' + goes.join('|'))
  await type('whois lula')
  who = (await lines()).slice(-6)
  goes = await p.$$eval('.wf[data-app="terminal"] button.term__link', (els) => els.slice(-2).map((e) => e.textContent))
  check('whois <a company>: its name, vertical and what it does, the way to it and to its founder’s reply', who.includes('Lula') && who.includes('Fintech') && goes.join('|') === 'Lula in the portfolio|Matthew Vega-Sanz in the chat', who.join(' | ') + ' // ' + goes.join('|'))
  await type('whois nobody-of-that-name')
  check('whois <nobody>: says so', /^whois: nobody here called nobody-of-that-name\.$/.test((await lines()).slice(-2)[0]), (await lines()).slice(-2)[0])
  await type('whois')
  check('whois, of Shrug itself: its own line, and what About Shrug says', (await lines()).slice(-5)[0] === 'Shrug Capital is an early-stage venture fund.' && /^started +2017$/.test((await lines()).slice(-4)[0]) && (await p.$$eval('.wf[data-app="terminal"] button.term__link', (els) => els.slice(-1)[0].textContent)) === 'about shrug', (await lines()).slice(-5).join(' | '))
  // something one of them said, as they said it
  const people = await p.evaluate(() => [...document.querySelectorAll('.wf[data-app="terminal"] .term__log > *')].length)
  await type('fortune')
  const told = (await lines()).slice(-3)
  check('fortune: something one of them said, who said it, and the way to it in the chat', told[0].length > 20 && told[0].length <= 220 && /^ {4}— .+, .+$/.test(told[1]) && / in the chat$/.test(told[2]) && told[1].includes(told[2].replace(/ in the chat$/, '')), told.join(' | '))
  await type('fortune')
  check('fortune: never the same one twice running', (await lines()).slice(-3)[0] !== told[0])
  await type('neofetch')
  const counted = (await lines()).slice(-7)
  check('neofetch: the site, counted from its own lists', /\(ツ\)/.test(counted[0]) && counted[1] === 'shrug capital' && /^people +80 in the group chat$/.test(counted[2]) && /^portfolio +100\+ companies, 13 verticals$/.test(counted[3]) && /^studies +6 private, 2 public$/.test(counted[5]), counted.join(' | '))
  // a private case study that is of a portfolio company opens the company, and says why
  await type('open varda')
  await p.waitForTimeout(900)
  check('open <a private case study>: its company, selected in the Portfolio window', (await front()) === 'finder' && (await p.locator('.wf[data-app="finder"] .pf-preview__name').innerText()) === 'Varda' && /^varda\/ is private\. here’s Varda in the portfolio\.$/.test((await lines()).slice(-1)[0]), (await lines()).slice(-1)[0])
  check('…and the company’s preview has the way to its founder’s reply', (await p.locator('.wf[data-app="finder"] .pf-preview__voice-text').innerText()).replace(/\s+/g, ' ') === 'Delian Asparouhov in Testimonials', await p.locator('.wf[data-app="finder"] .pf-preview__voice-text').innerText())
  await p.click('[data-dock-app="terminal"]')
  await p.waitForTimeout(500)
  await type('open feastables')
  check('open <a private case study of no portfolio company>: refused, and the question', /permission denied/.test((await lines()).slice(-2)[0]) && /\(y\/n\)/.test((await lines()).slice(-1)[0]), (await lines()).slice(-2).join(' | '))
  void people

  // clear, and closing the window never leaves anyone stuck
  await type('clear')
  check('clear: back to how it opened', (await lines()).length === 5 && /request access\? \(y\/n\)/.test((await lines())[4]), String((await lines()).length))
  await type('y')
  await p.locator('.wf[data-app="terminal"] [aria-label^="Close"]').first().click()
  await p.waitForTimeout(600)
  await p.click('[data-dock-app="terminal"]')
  await p.waitForTimeout(700)
  await type('n')
  check('closed and opened again: still answers (DK-2)', /they’ll be here/.test((await lines()).slice(-2)[0]))
  check('desktop: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- desktop, a finger (tb-3, tb-17, tb-8)
  t = await A.open(browser, { device: 'ipad-land', base: BASE, query: 'still&open=case-studies' })
  p = t.page
  await arrived(p)
  await p.waitForSelector('.wf[data-app="terminal"] .term__input', { timeout: 15000 })
  await p.waitForTimeout(900)
  check('touch: the page reports a touch screen', await p.evaluate(() => matchMedia('(any-pointer: coarse)').matches))
  await p.touchscreen.tap(40, 300) // the wallpaper: the caret is nowhere
  await p.waitForTimeout(200)
  const box = await p.locator('.wf[data-app="terminal"] .term__screen').boundingBox()
  await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.82) // the empty part, well under the line
  await p.waitForTimeout(350)
  check('touch: a tap anywhere in the terminal puts the caret in the line (tb-3)', await p.evaluate(() => document.activeElement?.classList.contains('term__input')), await p.evaluate(() => document.activeElement?.className))
  const keys = await p.$$eval('.wf[data-app="terminal"] .term__key', (els) => els.map((e) => ({ text: e.textContent, h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) })))
  check('touch: y and n to tap, 44px tall (tb-17, tb-8)', keys.length === 2 && keys[0].text === 'y' && keys[1].text === 'n' && keys.every((k) => k.h >= 44 && k.w >= 44), JSON.stringify(keys))
  await p.locator('.wf[data-app="terminal"] .term__key', { hasText: 'y' }).tap()
  await p.waitForTimeout(300)
  check('touch: the y key answers', /two are public:/.test(await p.locator('.wf[data-app="terminal"] .term__log').innerText()))
  check('touch: tapping a key leaves the caret in the line', await p.evaluate(() => document.activeElement?.classList.contains('term__input')))
  const after = await p.$$eval('.wf[data-app="terminal"] .term__key', (els) => els.map((e) => e.textContent))
  check('touch: then help and clear to tap', after.join() === 'help,clear', after.join())
  const linkH = await p.$$eval('.wf[data-app="terminal"] .term__link', (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
  check('touch: a link is tall enough to press', linkH.length === 3 && linkH.every((h) => h >= 36), linkH.join())
  await shot(p, 'term-touch-y')
  await p.locator('.wf[data-app="terminal"] .term__key', { hasText: 'clear' }).tap()
  await p.waitForTimeout(300)
  check('touch: clear starts over', (await p.$$eval('.wf[data-app="terminal"] .term__log > *', (els) => els.length)) === 5)
  check('touch: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- the iPhone
  t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still&open=case-studies' })
  p = t.page
  await arrived(p)
  const app = p.locator('.sb-slot[data-front]')
  await app.locator('.term-ios-screen').waitFor({ timeout: 15000 })
  await p.waitForTimeout(900)
  const names = () => app.locator('.term-ios-key').evaluateAll((els) => els.map((e) => e.textContent.trim()))
  check('phone: y, n and help at the foot', (await names()).join() === 'y,n,help', (await names()).join())
  check('phone: the way Home is in the corner, as it is in Contacts', (await app.locator('.ios-bar button[aria-label="Home Screen"]').count()) === 1)
  await app.locator('.term-ios-key', { hasText: /^y$/ }).tap()
  await p.waitForTimeout(700)
  text = await app.locator('.term__log').innerText()
  check('phone: y asks for nothing and gives the public ones and the one-pager', /two are public:/.test(text) && /the rest aren’t\./.test(text) && /alt\//.test(text) && /lula\//.test(text) && /one-pager/.test(text) && !/email|by hand/i.test(text), text.slice(-200))
  check('phone: no email keyboard, no keys for one', (await app.locator('.term__input').getAttribute('inputmode')) === null && !(await names()).includes('@'), (await names()).join())
  check('phone: then help, ls and clear at the foot', (await names()).join() === 'help,ls,clear', (await names()).join())
  const tall = await app.locator('.term__link').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
  check('phone: links tall enough for a finger', tall.length === 3 && tall.every((h) => h >= 40), tall.join())
  await shot(p, 'term-phone-y')
  await app.locator('.term-ios-key', { hasText: 'help' }).tap()
  await p.waitForTimeout(400)
  check('phone: the help key', /cat <name>/.test(await app.locator('.term__log').innerText()))
  const fits = await app.locator('.term__log').evaluate((el) => [...el.children].every((c) => c.scrollWidth <= c.clientWidth + 1))
  check('phone: nothing in the log runs off the side', fits)
  await app.locator('.term-ios-key', { hasText: 'clear' }).tap()
  await p.waitForTimeout(500)
  check('phone: clear starts over', (await app.locator('.term__log > *').count()) === 5 && (await names()).join() === 'y,n,help')
  await app.locator('button[aria-haspopup="menu"]').first().tap()
  await p.waitForTimeout(450)
  // (With no address to write to, the menu does not offer a request that cannot be made: it offers what can be read)
  const offers = await app.locator('[role^="menuitem"]').evaluateAll((els) => els.map((e) => e.textContent.trim()))
  await app.locator('[role^="menuitem"]', { hasText: 'Public Case Studies' }).first().tap()
  await p.waitForTimeout(700)
  check('phone: More › Public Case Studies hands them over; no request is offered that cannot be made', offers.join() === 'Public Case Studies,Clear' && /since you asked nicely\. two are public:/.test(await app.locator('.term__log').innerText()), offers.join())
  // typed, with Escape: the line first (the phone's own Escape leaves the app only once it is empty)
  await app.locator('.term__input').fill('half a thought')
  await app.locator('.term__input').press('Escape')
  await p.waitForTimeout(300)
  const still = await A.state(p)
  check('phone: Escape empties the line and stays in the app', (await app.locator('.term__input').inputValue()) === '' && still.place?.app === 'terminal', JSON.stringify(still.place))
  // VIP is no app on the phone either: open vip stays in the terminal and hands over the three stores, each a link to the store's own page
  await app.locator('.term__input').fill('open vip')
  await app.locator('.term__input').press('Enter')
  await p.waitForTimeout(1200)
  const vipLine = await app.locator('.term__link').last().evaluate((a) => ({ words: a.childNodes[0].textContent, href: a.getAttribute('href'), target: a.target, rel: a.rel, tall: Math.round(a.getBoundingClientRect().height) }))
  check('phone: open vip launches nothing: the terminal stays, with a link to each of the three stores, tall enough for a finger', (await A.state(p)).place?.app === 'terminal' && vipLine.words === 'open books' && vipLine.href === A.storeAt(BASE, 'books') && vipLine.target === '_blank' && vipLine.rel === 'noopener' && vipLine.tall >= 40 && /the stores open in a tab of their own:\s+open workspace\s+open artstore\s+open books/.test((await app.locator('.term__log').innerText()).replace(/, in a new tab/g, '')), JSON.stringify({ place: (await A.state(p)).place, vipLine, log: (await app.locator('.term__log').innerText()).slice(-200) }))
  const vipTab = await A.tabFrom(t.ctx, () => app.locator('.term__link').last().tap())
  await p.waitForTimeout(600)
  check('phone: tapped, it opens that store in a tab of its own, and the phone is still in the terminal', !!vipTab && vipTab.url === A.storeAt(BASE, 'books') && vipTab.alone === true && (await A.state(p)).place?.app === 'terminal' && (await p.locator('.sb-slot[data-app="photos"]').count()) === 0, JSON.stringify(vipTab))
  // every app help offers opens something. The phone has no About Shrug: Shrug's own card in Contacts opens
  const term = p.locator('.sb-slot[data-app="terminal"]')
  const reached = []
  for (const name of ['portfolio', 'faqs', 'chat', 'about']) {
    await term.locator('.term__input').fill(`open ${name}`)
    await term.locator('.term__input').press('Enter')
    await p.waitForTimeout(1200)
    const at = (await A.state(p)).place
    reached.push(`${name}:${at?.app}/${at?.stack.join()}`)
    await A.at(p, 'terminal', [])
  }
  check('phone: open portfolio, faqs and chat launch their apps, and open about Shrug’s card in Contacts', reached.join(' ') === 'portfolio:finder/ faqs:notes/f:faqs chat:messages/ about:finder/me', reached.join(' '))
  check('phone: …and the terminal said so each time', /opening about\./.test(await term.locator('.term__log').innerText()))
  await term.locator('.term__input').fill('cat .rules')
  await term.locator('.term__input').press('Enter')
  await p.waitForTimeout(400)
  const said = await term.locator('.term__log > *').evaluateAll((els) => els.slice(-6).map((e) => e.textContent))
  check('phone: cat .rules prints the six rules there too, and none runs off the side', /^We don’t talk about ourselves publicly$/.test(said[0]) && /^We always come with gifts!$/.test(said[5]) && (await term.locator('.term__log').evaluate((el) => [...el.children].every((c) => c.scrollWidth <= c.clientWidth + 1))), said.join(' | '))
  check('phone: a line is capped at 120 too (MK-17)', (await p.locator('.sb-slot[data-app="terminal"] .term__input').getAttribute('maxlength')) === '120')
  check('phone: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ---- typed the instant the app is opened from the Home Screen: the first letter lands too (MK-17)
  for (const device of ['iphone', { w: 600, h: 900, dpr: 1 }]) {
    const got = []
    for (let i = 0; i < 3; i++) {
      t = await A.open(browser, { device, base: BASE, query: '' })
      p = t.page
      await arrived(p)
      await A.unlock(p)
      const box = await p.locator('.sb-icon[aria-label^="Case Studies"]').boundingBox()
      const [x, y] = [box.x + box.width / 2, box.y + box.height / 2]
      if (t.device.touch) {
        await t.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
        await t.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      } else await p.mouse.click(x, y)
      await p.keyboard.type('hello world', { delay: 12 })
      await p.waitForTimeout(1100)
      got.push(await p.evaluate(() => document.querySelector('.term-ios-input')?.value ?? '(no field)'))
      await t.ctx.close()
    }
    check(`typed the instant Case Studies opens (${typeof device === 'string' ? 'in the hand' : 'in its frame'}, three goes): nothing dropped`, got.every((v) => v === 'hello world'), JSON.stringify(got))
  }

  // ---- with an address to write to (dev server only: the address is swapped in under the page)
  if (!DEV) return console.log('skip the checks with a contact address: they need the dev server')
  t = await A.open(browser, { device: 'desktop', base: BASE, goto: false })
  p = t.page
  await swap(p, 'src/data/site.ts', (js) => js.replace('email: null', 'email: "hello@example.com"'))
  let went = null
  await p.addInitScript(() => {
    // a mail app cannot open here: note where the page tried to go
    window.addEventListener('beforeunload', () => {})
  })
  p.on('request', (r) => { if (/^mailto:/.test(r.url())) went = r.url() })
  p.on('framenavigated', (f) => { if (/^mailto:/.test(f.url())) went = f.url() })
  await p.goto(BASE + '?still&open=case-studies')
  await arrived(p)
  await p.waitForSelector('.wf[data-app="terminal"] .term__input', { timeout: 15000 })
  await p.waitForTimeout(900)
  await p.locator('.wf[data-app="terminal"] .term__input').click()
  await p.keyboard.type('y')
  await p.keyboard.press('Enter')
  await p.waitForTimeout(500)
  text = await p.locator('.wf[data-app="terminal"] .term__log').innerText()
  const mail = await p.$$eval('.wf[data-app="terminal"] .term__link', (as) => as.map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('target')]))
  check('with an address: y hands over to the mail app and says so', /over to your mail app/.test(text) && mail.some(([t, h, target]) => t === 'email shrug' && /^mailto:hello@example\.com\?subject=Case%20study%20access$/.test(h) && !target), JSON.stringify(mail))
  check('with an address: the public ones are still offered, and no email is asked for', /meanwhile, two are public/.test(text) && !/email\?/.test(text))
  await shot(p, 'term-desktop-reachable')
  await t.ctx.close()
}

// ---------------------------------------------------------------- VIP (terminal-vip-link.cjs)

async function vip(browser) {
  const { vipChecks } = require('./terminal-vip-link.cjs')
  await vipChecks({ A, browser, BASE, check, shot, arrived })
}

;(async () => {
  const browser = await A.launch()
  try {
    if (!ONLY || ONLY === 'term') await terminal(browser)
    if (!ONLY || ONLY === 'vip') await vip(browser)
    if (!ONLY || ONLY === 'axe') {
      const res = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'terminal-vip-axe.cjs'), BASE], { encoding: 'utf8', env: process.env, timeout: 900000 })
      const lines = (res.stdout || '').trim().split('\n')
      for (const line of lines.filter((l) => /^FAIL/.test(l))) console.log(line.slice(0, 500))
      check('axe: no violations on the terminal, on where VIP is, on the windows laid out with its classes, or on the windows of design/v1 and Workspace, either layout', res.status === 0, lines.slice(-1)[0] + (res.stderr || '').slice(0, 300))
    }
  } catch (e) {
    failed++
    console.log('FAIL the run stopped: ' + (e.stack || e).toString().split('\n').slice(0, 4).join(' / '))
  }
  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'ALL PASS')
  process.exit(failed ? 1 : 0)
})()
