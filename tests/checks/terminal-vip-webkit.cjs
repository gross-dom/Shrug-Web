// Fixer T's screens in WebKit (Safari's engine): the phone's terminal and its Dock, where VIP is a link to the
// points site; and the desktop's Dock, with the same link, and the desktop terminal's click.
//   node terminal-vip-webkit.cjs [base]
const wk = require('./webkit.cjs')
const path = require('path')
const BASE = process.argv[2] || 'http://127.0.0.1:5173/'
const out = (n) => path.join(__dirname, '..', 'audit', 'shots', `wk-${n}.png`)
;(async () => {
  let b = await wk.start({ width: 447, height: 800 })
  await b.go(BASE + '?phone=hand&still&open=case-studies')
  await b.js(`window.__errs = []; window.addEventListener('error', (e) => window.__errs.push(String(e.message))); return 1`)
  await wk.sleep(5000)
  const at = async (app, stack, sheet = null, wait = 1300) => {
    await b.js(`const [app, stack, sheet] = arguments; const cur = history.state?.shrug ?? { app: null, stacks: {}, sheet: null }; const state = { shrug: { app, stacks: app ? { ...cur.stacks, [app]: stack } : cur.stacks, sheet }, n: (history.state?.n ?? 0) + 1 }; history.pushState(state, ''); window.dispatchEvent(new PopStateEvent('popstate', { state })); return 1`, [app, stack, sheet])
    await wk.sleep(wait)
  }
  await b.js(`[...document.querySelectorAll('.sb-slot[data-front] .term-ios-key')].find((k) => k.textContent.trim() === 'y').click(); return 1`)
  await wk.sleep(700)
  await b.shot(out('term-y'))
  console.log('terminal:', JSON.stringify(await b.js(`const f = document.querySelector('.sb-slot[data-front]'); return { links: [...f.querySelectorAll('.term__link')].map((a) => a.textContent + ' ' + Math.round(a.getBoundingClientRect().height)), keys: [...f.querySelectorAll('.term-ios-key')].map((k) => k.textContent.trim()) }`)))
  // The Home Screen: VIP is the fourth thing in the Dock, drawn as an app is, and a link (nothing is pressed
  // here: it would leave for the points site)
  await at(null, []); await b.shot(out('vip-home'))
  console.log('dock:', JSON.stringify(await b.js(`return [...document.querySelectorAll('.sb-dock > .sb-icon')].map((el) => ({ tag: el.tagName, name: el.getAttribute('aria-label'), href: el.getAttribute('href'), target: el.target || null, rel: el.rel || null, tile: Math.round(el.querySelector('.sb-icon__tile').getBoundingClientRect().width) }))`)))
  console.log('phone page errors:', JSON.stringify((await b.js('return window.__errs || []')) || []))
  await b.end()

  b = await wk.start({ width: 1280, height: 800 })
  await b.go(BASE + '?still&open=case-studies')
  await b.js(`window.__errs = []; window.addEventListener('error', (e) => window.__errs.push(String(e.message))); return 1`)
  await wk.sleep(5000)
  await b.js(`document.querySelector('[data-dock-app="terminal"]').click(); return 1`); await wk.sleep(800)
  await b.js(`document.activeElement?.blur(); return 1`)
  // a real click in the empty part of the terminal
  const r = await b.js(`const el = document.querySelector('.wf[data-app="terminal"] .term__screen'); const r = el.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height * 0.8)]`)
  await b.clickAt ? b.clickAt(r[0], r[1]) : b.js(`document.elementFromPoint(arguments[0], arguments[1]).click(); return 1`, r)
  await wk.sleep(400)
  console.log('desktop: after a click in the terminal the caret is in', await b.js(`return document.activeElement?.className`))
  await b.shot(out('desktop'))
  console.log('desktop dock:', JSON.stringify(await b.js(`return [...document.querySelectorAll('.dock [data-dock-item]')].map((el) => ({ tag: el.tagName, name: el.getAttribute('aria-label'), href: el.getAttribute('href'), target: el.target || null, rel: el.rel || null, icon: Math.round(el.querySelector('.dock__icon').getBoundingClientRect().width) }))`)))
  console.log('desktop: windows open', await b.js(`return [...document.querySelectorAll('.wf[data-app]')].map((w) => w.dataset.app).join()`))
  console.log('desktop page errors:', JSON.stringify((await b.js('return window.__errs || []')) || []))
  await b.end()
})().catch((e) => { console.error('FAILED', e.message); process.exit(1) })
