// An accessibility pass over every iPhone screen with axe: names, roles, ARIA and contrast.
//   node phone-axe.cjs [base url]
const { chromium } = require('playwright')
const path = require('path')
const AXE = (() => {
  // axe-core where it is installed (npm install --no-save axe-core), or beside these checks
  try {
    return require.resolve('axe-core/axe.min.js')
  } catch {
    return path.join(__dirname, '..', 'axe', 'node_modules', 'axe-core', 'axe.min.js')
  }
})()
const base = process.argv[2] || 'http://127.0.0.1:5173/'
;(async () => {
  const browser = await chromium.launch()
  const found = new Map()
  const ctx = await browser.newContext({ viewport: { width: 393, height: 760 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const sleep = (ms) => page.waitForTimeout(ms)
  await page.goto(base); await sleep(2500)
  await page.addScriptTag({ path: AXE })
  let screens = 0
  const run = async (where) => {
    screens++
    const result = await page.evaluate(async () => {
      const r = await window.axe.run(document.querySelector('.ph'), { resultTypes: ['violations'], rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false }, 'landmark-one-main': { enabled: false } } })
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => ({ html: n.html.slice(0, 150), cls: (n.html.match(/class="([^"]*)"/) || [])[1] || n.html.slice(0, 40), why: (n.any[0] || n.all[0] || n.none[0] || {}).message })) }))
    })
    for (const v of result) {
      if (!found.has(v.id)) found.set(v.id, { ...v, nodes: [], where: [] })
      found.get(v.id).where.push(where)
      found.get(v.id).nodes.push(...v.nodes.map((n) => ({ ...n, where })))
    }
  }
  const at = async (app, stack, sheet = null) => {
    await page.evaluate(([app, stack, sheet]) => {
      const cur = history.state?.shrug ?? { app: null, stacks: {}, sheet: null }
      const state = { shrug: { app, stacks: app ? { ...cur.stacks, [app]: stack } : cur.stacks, sheet }, n: (history.state?.n ?? 0) + 1 }
      history.pushState(state, '')
      window.dispatchEvent(new PopStateEvent('popstate', { state }))
    }, [app, stack, sheet])
    await sleep(700)
  }
  const top = () => page.locator('.sb-slot[data-front] .ios-page[data-pos="top"]')
  await run('lock')
  await page.locator('.sb-lock__hint').tap(); await sleep(800)
  await run('home')
  await page.locator('.sb-search').tap(); await sleep(700); await run('search')
  await page.locator('.ph input[aria-label*="Search" i]').last().fill('an'); await sleep(600); await run('search results')
  await page.keyboard.press('Escape'); await sleep(300); await page.keyboard.press('Escape'); await sleep(500)
  for (const [where, app, stack, sheet] of [
    ['messages', 'messages', []], ['conversation', 'messages', ['c:group']], ['details', 'messages', ['c:group'], 'details'], ['easter egg', 'messages', ['c:founder']], ['portfolio folder', null, [], 'folder:portfolio'], ['faqs folder', null, [], 'folder:faqs'],
    ['contacts', 'finder', []], ['company', 'finder', ['co:Varda']], ['company with no site', 'finder', ['co:HQ Trivia']], ['my card', 'finder', ['me']],
    ['notes list', 'notes', ['f:faqs']], ['note', 'notes', ['f:faqs', 'n:4']], ['folders', 'notes', []], ['new folder', 'notes', [], 'new-folder'], ['notes folder', 'notes', ['f:notes']],
    ['terminal', 'terminal', []],
    // (the phone's own apps for the stores, the one-pager and Updates, since 27 Nov. The store's pages in a frame
    // are the store's own, and are looked at where the desk's window holds them: terminal-vip-axe.cjs)
    ['workspace: the colors', 'workspace', []], ['workspace: a studio', 'workspace', ['studio']], ['workspace: the sixteen more', 'workspace', [], 'more'], ['workspace: owners', 'workspace', ['owners']], ['workspace: BTS', 'workspace', ['bts']],
    ['books: the shelf', 'books', []], ['books: the reader', 'books', ['r:frequently asked']], ['artstore', 'store', []], ['my vip', 'myvip', []], ['the one-pager', 'preview', []], ['updates, locked', 'updates', []], ['log in', 'updates', [], 'login'],
  ]) { await at(app, stack, sheet ?? null); if (app === 'workspace' || app === 'preview') await sleep(900); await run(where) }
  // Screens reached by their own controls
  const must = async (what, step) => { try { await step() } catch (e) { errors.push(`could not reach ${what}: ${e.message.split('\n')[0]}`) } }
  // Contacts' search: with the field taken up, with companies found, and with none; and the list part-way down, a heading stuck under the bar
  await at('finder', [])
  await must('contacts scrolled', async () => { await top().locator('.contacts-index__letter[data-letter="M"]').tap({ timeout: 8000 }); await sleep(400) }); await run('contacts part-way down')
  await must('contacts search', async () => { await top().locator('.ios-search__input').tap({ timeout: 8000 }); await sleep(500) }); await run('contacts search')
  await must('contacts search results', async () => { await top().locator('.ios-search__input').fill('an', { timeout: 8000 }); await sleep(500) }); await run('contacts search results')
  await must('contacts search with nothing found', async () => { await top().locator('.ios-search__input').fill('zzzz', { timeout: 8000 }); await sleep(500) }); await run('contacts search, nothing found')
  await must('contacts search ending', async () => { await top().locator('button[aria-label="Cancel"]').tap({ timeout: 8000 }); await sleep(500) })
  // What search finds for "vip": My VIP, the app
  await at(null, [])
  await must('search, VIP found', async () => { await page.locator('.sb-search').tap({ timeout: 8000 }); await sleep(700); await page.locator('.ph input[aria-label*="Search" i]').last().fill('vip', { timeout: 8000 }); await sleep(600); if (!(await page.locator('.ph button[data-top]').count())) throw new Error('My VIP was not found as an app') }); await run('search, VIP found')
  await page.keyboard.press('Escape'); await sleep(300); await page.keyboard.press('Escape'); await sleep(500)
  // The conversation whose link leads to VIP
  await at('messages', ['c:drops']); await run('the Drops conversation')
  // A message of the visitor's own, delivered
  await at('messages', ['c:founder'])
  await must('a sent message', async () => { await top().locator('input[aria-label="iMessage"]').fill('Hello', { timeout: 8000 }); await page.keyboard.press('Enter'); await sleep(1500); if (!(await top().locator('.chat-sent').count())) throw new Error('no Delivered receipt') }); await run('a sent message')
  await at('notes', ['f:faqs']); await top().locator('button[aria-label="More"]').first().tap(); await sleep(500); await run('notes menu'); await page.keyboard.press('Escape'); await sleep(300)
  await top().locator('input[aria-label*="Search" i]').fill('drop'); await sleep(500); await run('notes search')
  await at('notes', []); await top().locator('button[aria-label="New Note"]').first().tap(); await sleep(900); await page.keyboard.type('Mine'); await run('own note')
  await browser.close()
  console.log(`${screens} screens looked at${errors.length ? '; page errors: ' + [...new Set(errors)].slice(0, 4).join(' | ') : ''}`)
  if (!found.size) return console.log('no violations')
  for (const v of [...found.values()].sort((a, b) => (a.impact < b.impact ? -1 : 1))) {
    console.log(`\n[${v.impact}] ${v.id}: ${v.help}\n   on: ${[...new Set(v.where)].join(', ')}`)
    const seen = new Map()
    for (const n of v.nodes) { const k = n.cls + ' | ' + (n.why || '').replace(/Element has insufficient color contrast of ([\d.]+) \(foreground color: (#\w+), background color: (#\w+), font size: [\d.]+pt \((\d+(?:\.\d+)?px)\), font weight: (\w+)\)\. Expected contrast ratio of ([\d.:]+)/, '$1 ($2 on $3, $4 $5) needs $6'); if (!seen.has(k)) seen.set(k, new Set()); seen.get(k).add(n.where) }
    for (const [k, w] of seen) console.log(`   - ${k.slice(0, 200)}   [${[...w].join(',')}]`)
  }
})().catch((e) => { console.error('FAILED', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1) })
