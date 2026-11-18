// The desktop shell in Safari's engine: a key wakes the screen saver (and types nothing), the desk comes back
// with the keyboard somewhere real, and a window opens clear of the edges.
const wk = require('./webkit-touch.cjs')
const BASE = process.argv[2] || 'http://127.0.0.1:5173/'
;(async () => {
  let failed = 0
  const check = (name, ok, detail = '') => { if (!ok) failed++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + detail : '')) }
  const b = await wk.start({ width: 1180, height: 820 })
  await b.go(BASE + '?still&saver')
  await wk.sleep(6000)
  const on = () => b.js(`return !!document.querySelector('.saver[data-on]')`)
  const state = await b.js(`const s = document.querySelector('.saver'); return JSON.stringify({ on: s.hasAttribute('data-on'), role: s.getAttribute('role'), desk: document.querySelector('.os__desk').hasAttribute('inert'), focus: document.activeElement === s, said: !!s.querySelector('.saver__said') })`)
  check('WebKit: the saver is on, a dialog holding the keyboard over an inert desk', /"on":true,"role":"dialog","desk":true,"focus":true/.test(state), state)
  await b.type('a')
  await wk.sleep(700)
  const after = await b.js(`return JSON.stringify({ on: !!document.querySelector('.saver[data-on]'), typed: [...document.querySelectorAll('.wf input, .wf textarea')].map((f) => f.value).join(''), focus: document.activeElement.closest('.wf') ? 'wf:' + document.activeElement.closest('.wf').dataset.app : document.activeElement.tagName, desk: document.querySelector('.os__desk').hasAttribute('inert'), title: document.title })`)
  check('WebKit: the key "a" wakes it, types nothing, and the keyboard is in the window in front', /"on":false,"typed":"","focus":"wf:messages","desk":false/.test(after), after)
  const win = await b.js(`const r = document.querySelector('.wf[data-app="messages"]').getBoundingClientRect(); return [r.x, r.y - 28, innerWidth - r.right, innerHeight - 82 - r.bottom].map(Math.round).join(',')`)
  check('WebKit: the window sits clear of every edge', win.split(',').every((n) => Number(n) >= 8), win)
  await b.end()
  console.log(failed ? `${failed} FAILED` : 'ALL PASS')
  process.exit(failed ? 1 : 0)
})().catch((e) => { console.error('FAILED', e.message); process.exit(1) })
