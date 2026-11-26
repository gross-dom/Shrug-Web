// Fixer I: the shared iPhone parts in WebKit (Safari's engine): a menu, a menu on a short screen, a sheet, headings.
const wk = require('./webkit.cjs')
const path = require('path')
// (the site it looks at: the one it is given, as every other check takes it; a dev server's own address if none)
const BASE = process.argv[2] && /^https?:/.test(process.argv[2]) ? process.argv[2] : process.env.BASE || 'http://127.0.0.1:5173/'
;(async () => {
  const out = (n) => path.join(__dirname, '..', 'audit', 'shots', `wk-${n}.png`)
  const TOP = '.sb-slot[data-front] .ios-page[data-pos="top"]'
  const run = async (name, width, height) => {
    const b = await wk.start({ width, height })
    await b.go(`${BASE}?phone=hand&still`)
    await b.js(`window.__errs = []; window.addEventListener('error', (e) => window.__errs.push(String(e.message))); return 1`)
    await wk.sleep(5000)
    await b.js(`document.querySelector('.sb-lock__hint')?.click(); return 1`); await wk.sleep(1500)
    const at = async (app, stack, sheet = null, wait = 1200) => {
      await b.js(`const [app, stack, sheet] = arguments; const cur = history.state?.shrug ?? { app: null, stacks: {}, sheet: null }; const state = { shrug: { app, stacks: app ? { ...cur.stacks, [app]: stack } : cur.stacks, sheet }, n: (history.state?.n ?? 0) + 1 }; history.pushState(state, ''); window.dispatchEvent(new PopStateEvent('popstate', { state })); return 1`, [app, stack, sheet])
      await wk.sleep(wait)
    }
    // No banners over the bar while this looks at it. The phone has no Settings to turn them off in: the replies
    // are paused the way a visitor can, in the conversation's details
    await at('messages', ['c:group'], 'details')
    await b.js(`document.querySelector('.sb-slot[data-front] .ios-sheet .ios-switch[aria-label="Pause Replies"]')?.click(); return 1`); await wk.sleep(400)
    await at('notes', ['f:faqs'])
    await b.js(`document.querySelector(arguments[0] + ' .ios-bar .ios-menu > button').click(); return 1`, [TOP]); await wk.sleep(900)
    const menu = await b.js(`const l = document.querySelector(arguments[0] + ' .ios-menu__list[data-show]'); if (!l) return null; const r = l.getBoundingClientRect(); const sc = l.querySelector('.ios-menu__scroll'); const items = [...l.querySelectorAll('.ios-menu__item')]; const last = items[items.length - 1]; last.scrollIntoView({ block: 'nearest' }); const q = last.getBoundingClientRect(); const el = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: innerHeight, scroll: [sc.clientHeight, sc.scrollHeight], lastPressable: !!el && last.contains(el), focus: document.activeElement?.className?.toString().slice(0, 30), barZ: getComputedStyle(l.closest('.ios-bar')).zIndex }`, [TOP])
    console.log(name, 'Notes More:', JSON.stringify(menu))
    await b.shot(out(`${name}-menu`))
    await b.js(`document.querySelector(arguments[0] + ' .ios-bar .ios-menu > button').click(); return 1`, [TOP]); await wk.sleep(500)
    await at('messages', ['c:group'], 'details')
    const sheet = await b.js(`const p = document.querySelector(arguments[0]); const s = document.querySelector('.sb-slot[data-front] .ios-sheet'); return { inert: p.hasAttribute('inert'), sheet: !!s, closes: s ? [...s.querySelectorAll('[aria-label="Close"]')].filter((e) => !e.closest('[aria-hidden="true"]')).length : 0, named: document.getElementById(p.getAttribute('aria-labelledby'))?.textContent }`, [TOP])
    console.log(name, 'sheet:', JSON.stringify(sheet))
    await b.shot(out(`${name}-sheet`))
    await at('finder', []); await b.shot(out(`${name}-contacts`))
    const index = await b.js(`const sc = document.querySelector(arguments[0] + ' [data-scroller]'); const head = sc.querySelector('.contacts-letter'); const letters = [...document.querySelectorAll(arguments[0] + ' .contacts-index__letter')].filter((l) => l.getClientRects().length); return { letters: letters.length, sticky: getComputedStyle(head).position, glass: getComputedStyle(head).webkitBackdropFilter || getComputedStyle(head).backdropFilter }`, [TOP])
    console.log(name, 'contacts:', JSON.stringify(index))
    await at('finder', ['co:Varda']); await b.shot(out(`${name}-contacts-card`))
    const errs = (await b.js('return window.__errs || []')) || []
    console.log(name, errs.length ? 'PAGE ERRORS: ' + [...new Set(errs)].slice(0, 6).join(' | ') : 'no page errors')
    await b.end()
  }
  await run('up', 460, 800)
  await run('land', 620, 320)
})().catch((e) => { console.error('FAILED', e.message); process.exit(1) })
