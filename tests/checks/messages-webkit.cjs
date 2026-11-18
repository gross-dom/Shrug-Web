// Fixer M's things in WebKit (Safari's engine): a message of the visitor's own, delivered, on the phone and on the
// desktop; and the phone's FaceTime alert.
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
  // It is delivered, as a message is: a bubble like any other of the visitor's, "Delivered" under the last of them
  await b.shot(out('1-phone-sent'))
  console.log('phone, after send in WebKit:', JSON.stringify(await b.js(`const f = document.querySelector('.sb-slot[data-front]'); return { receipt: f.querySelector('.chat-sent')?.textContent?.trim() ?? null, undelivered: f.querySelectorAll('.chat-undelivered, .msg-alert').length, field: f.querySelector('.msg-field__input')?.value }`)))
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
  await b.shot(out('3-desk-sent'))
  console.log('desktop, after send in WebKit:', JSON.stringify(await b.js(`const w = document.querySelector('${W}'); return { receipt: w.querySelector('.chat-sent')?.textContent?.trim() ?? null, undelivered: w.querySelectorAll('.chat-undelivered, .chat-why').length }`)))
  errs = (await b.js('return window.__errs || []')) || []
  console.log(errs.length ? 'PAGE ERRORS: ' + [...new Set(errs)].slice(0, 6).join(' | ') : 'desktop: no page errors')
  await b.end()
})().catch((e) => { console.error('FAILED', e.message); process.exit(1) })
