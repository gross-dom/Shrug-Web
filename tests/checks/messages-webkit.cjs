// Fixer M's new things in WebKit (Safari's engine): the phone's alert and the end of the conversation; the desktop's popover.
const wk = require('./webkit.cjs')
const path = require('path')
const BASE = process.argv[2] || 'http://127.0.0.1:5173/'
;(async () => {
  const out = (n) => path.join(__dirname, '..', 'audit', 'shots', `wk-${n}.png`)
  let b = await wk.start({ width: 500, height: 860 })
  await b.go(BASE + '?phone=hand&still')
  await b.js(`window.__errs = []; window.addEventListener('error', (e) => window.__errs.push(String(e.message))); return 1`)
  await wk.sleep(5000)
  await b.js(`document.querySelector('.sb-lock__hint')?.click(); return 1`); await wk.sleep(1500)
  const at = async (app, stack, sheet = null, wait = 1300) => {
    await b.js(`const [app, stack, sheet] = arguments; const cur = history.state?.shrug ?? { app: null, stacks: {}, sheet: null }; const state = { shrug: { app, stacks: app ? { ...cur.stacks, [app]: stack } : cur.stacks, sheet }, n: (history.state?.n ?? 0) + 1 }; history.pushState(state, ''); window.dispatchEvent(new PopStateEvent('popstate', { state })); return 1`, [app, stack, sheet])
    await wk.sleep(wait)
  }
  await at('messages', ['c:group'])
  // a message of the visitor's, sent
  await b.js(`const i = document.querySelector('.sb-slot[data-front] .msg-field__input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'hello there'); i.dispatchEvent(new Event('input', { bubbles: true })); return 1`)
  await wk.sleep(400)
  await b.js(`document.querySelector('.sb-slot[data-front] .msg-field').requestSubmit(); return 1`); await wk.sleep(1200)
  await b.js(`document.querySelector('.sb-slot[data-front] .chat-undelivered').click(); return 1`); await wk.sleep(900)
  await b.shot(out('1-phone-why'))
  const alert = await b.js(`const a = document.querySelector('.msg-alert__box'); return a ? { text: a.innerText.replace(/\\n+/g, ' | '), focus: document.activeElement?.textContent, blur: getComputedStyle(a).webkitBackdropFilter || getComputedStyle(a).backdropFilter } : null`)
  console.log('phone alert in WebKit:', JSON.stringify(alert))
  await b.js(`[...document.querySelectorAll('.msg-alert__act')].pop().click(); return 1`); await wk.sleep(900)
  console.log('after Cancel: sheet', await b.js(`return history.state?.shrug?.sheet ?? null`), '| focus', await b.js(`return document.activeElement?.className`))
  await b.js(`document.querySelector('.sb-slot[data-front] [aria-label="FaceTime"]').click(); return 1`); await wk.sleep(900)
  await b.shot(out('2-phone-facetime'))
  await b.js(`document.querySelector('.msg-alert__act').click(); return 1`); await wk.sleep(900)
  let errs = (await b.js('return window.__errs || []')) || []
  console.log(errs.length ? 'PAGE ERRORS: ' + [...new Set(errs)].slice(0, 6).join(' | ') : 'phone: no page errors')
  await b.end()

  b = await wk.start({ width: 1280, height: 800 })
  await b.go(BASE + '?still')
  await b.js(`window.__errs = []; window.addEventListener('error', (e) => window.__errs.push(String(e.message))); return 1`)
  await wk.sleep(7000)
  const W = '.wf[data-app="messages"]'
  await b.js(`const i = document.querySelector('${W} .composer__input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'hello there'); i.dispatchEvent(new Event('input', { bubbles: true })); return 1`)
  await wk.sleep(300)
  await b.js(`document.querySelector('${W} .composer').requestSubmit(); return 1`); await wk.sleep(1200)
  console.log('desktop, after send: focus', await b.js(`return document.activeElement?.className`))
  await b.tap(`${W} .chat-undelivered`); await wk.sleep(700)
  await b.shot(out('3-desk-why'))
  console.log('desktop popover in WebKit:', JSON.stringify(await b.js(`const w = document.querySelector('${W} .chat-why'); return { show: w.hasAttribute('data-show'), focus: document.activeElement?.textContent }`)))
  await b.js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 1`); await wk.sleep(600)
  console.log('after Escape: open', await b.js(`return document.querySelector('${W} .chat-why').hasAttribute('data-show')`), '| focus', await b.js(`return document.activeElement?.className`))
  errs = (await b.js('return window.__errs || []')) || []
  console.log(errs.length ? 'PAGE ERRORS: ' + [...new Set(errs)].slice(0, 6).join(' | ') : 'desktop: no page errors')
  await b.end()
})().catch((e) => { console.error('FAILED', e.message); process.exit(1) })
