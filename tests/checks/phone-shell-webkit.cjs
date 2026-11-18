// Safari's engine (WebKitGTK), the parts fixer S1 changed: the Lock Screen's buttons and torch, a tap that lifts it,
// the Home Screen, the App Switcher with its close buttons, search as a step in history, a short window edge to edge.
//   node phone-shell-webkit.cjs [base]  ->  fix/s1/wk-*.png
const wk = require('./webkit.cjs')
const path = require('path')
const base = process.argv[2] || 'http://127.0.0.1:5173/'
const out = (n) => path.join(__dirname, '..', 'audit', 'shots', `wk-${n}.png`)
let failed = 0
const say = (ok, name, detail = '') => { if (!ok) failed++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + String(detail).slice(0, 240) : '')) }
;(async () => {
  const b = await wk.start({ width: 447, height: 800 })
  await b.go(`${base}?phone=hand&still`)
  await b.js(`window.__errs = []; window.addEventListener('error', (e) => window.__errs.push(String(e.message))); window.addEventListener('unhandledrejection', (e) => window.__errs.push(String(e.reason))); return 1`)
  await wk.sleep(6000)
  say((await b.js(`return document.querySelector('.ph')?.className`))?.includes('ph--bleed'), 'edge to edge')
  const lock = await b.js(`const h = document.querySelector('.sb-lock__hint'); const c = [...document.querySelectorAll('.sb-lock__control')].map((x) => [x.tagName, x.getAttribute('aria-label'), Math.round(x.getBoundingClientRect().width)]); return { hint: +getComputedStyle(h).opacity, c }`)
  say(lock.hint > 0.8 && lock.c.length === 2 && lock.c.every((x) => x[0] === 'BUTTON' && x[2] === 50), 'Lock Screen: the hint and two real buttons', JSON.stringify(lock))
  await b.js(`document.querySelector('.sb-lock__control[aria-label="Flashlight"]').click(); return 1`); await wk.sleep(600)
  say((await b.js(`return +getComputedStyle(document.querySelector('.sb-lock__beam')).opacity`)) > 0.9, 'the torch lights')
  await b.shot(out('lock-torch'))
  await b.js(`document.querySelector('.sb-lock__hint').click(); return 1`); await wk.sleep(1400)
  await b.shot(out('home'))
  const at = async (app, stack, sheet = null, wait = 1100) => {
    await b.js(`const [app, stack, sheet] = arguments; const cur = history.state?.shrug ?? { app: null, stacks: {}, sheet: null }; const state = { shrug: { app, stacks: app ? { ...cur.stacks, [app]: stack } : cur.stacks, sheet }, n: (history.state?.n ?? 0) + 1 }; history.pushState(state, ''); window.dispatchEvent(new PopStateEvent('popstate', { state })); return 1`, [app, stack, sheet])
    await wk.sleep(wait)
  }
  await at('notes', ['f:faqs']); await at('finder', ['f:all'])
  await b.js(`[...document.querySelectorAll('.sb-homebar__key')].find((k) => k.textContent.includes('App Switcher')).click(); return 1`); await wk.sleep(1300)
  const sw = await b.js(`return { on: !!document.querySelector('.sb-apps[data-switcher]'), closers: document.querySelectorAll('.sb-slot__close').length, over: history.state.shrug.over }`)
  say(sw.on && sw.closers === 2 && sw.over === 'switcher', 'the App Switcher opens from its button, a close button on each card', JSON.stringify(sw))
  await b.shot(out('switcher'))
  await b.js(`document.querySelector('.sb-slot[data-app="finder"] .sb-card__hit').click(); return 1`); await wk.sleep(1300)
  const picked = await b.js(`return { on: !!document.querySelector('.sb-apps[data-switcher]'), app: history.state.shrug.app, sheet: history.state.shrug.sheet, stack: history.state.shrug.stacks.finder.join() }`)
  say(!picked.on && picked.app === 'finder' && picked.sheet === null && picked.stack === 'f:all', 'a card picked brings its app forward as it was', JSON.stringify(picked))
  await b.js(`document.querySelector('.sb-homebar .sr-only').click(); return 1`); await wk.sleep(1200)
  await b.js(`document.querySelector('.sb-search').click(); return 1`); await wk.sleep(1100)
  const n1 = await b.js(`return { over: history.state.shrug.over, n: history.state.n }`)
  await b.js(`history.back(); return 1`); await wk.sleep(1100)
  const n2 = await b.js(`return { spot: !!document.querySelector('.spot:not([data-leaving])'), n: history.state.n, href: location.href }`)
  say(n1.over === 'search' && !n2.spot && n2.n === n1.n - 1 && n2.href.startsWith(base), "search is a step: Back puts it away and stays on the site", JSON.stringify({ n1, n2 }))
  const errs = await b.js(`return window.__errs`)
  say(errs.length === 0, 'no errors', errs.slice(0, 3).join(' | '))
  await b.end()

  // a short, wide window: edge to edge, with everything in it
  const c = await wk.start({ width: 900, height: 420 })
  await c.go(`${base}?still`)
  await wk.sleep(6000)
  const small = await c.js(`const h = document.querySelector('.sb-lock__hint').getBoundingClientRect(); return { cls: document.querySelector('.ph').className, hintIn: h.bottom <= innerHeight && h.top >= 0, w: innerWidth, h: innerHeight }`)
  say(small.cls.includes('ph--bleed') && small.hintIn, 'a window too short for the frame: edge to edge, the Lock Screen whole', JSON.stringify(small))
  await c.shot(out('short-lock'))
  await c.js(`document.querySelector('.sb-lock__hint').click(); return 1`); await wk.sleep(1400)
  await c.shot(out('short-home'))
  await c.end()
  console.log(failed ? `${failed} FAILED` : 'all ok')
  process.exit(failed ? 1 : 0)
})().catch((e) => { console.error(e.message); process.exit(1) })
