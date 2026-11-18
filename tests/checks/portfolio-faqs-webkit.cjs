// Fixer P's focus fixes in WebKit (WebKitGTK MiniBrowser, the nearest thing here to Safari): the desktop's search
// field hands over to the keyboard, its clear button keeps the caret, and the new lines are drawn.
//   node portfolio-faqs-webkit.cjs [base]
const wk = require('./webkit.cjs')
const path = require('path')
const BASE = process.argv[2] || 'http://127.0.0.1:5173/'
const out = (n) => path.join(__dirname, '..', 'audit', 'shots', `fixP-wk-${n}.png`)
let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  (' + detail + ')' : ''))
}
const KEY = { ArrowDown: '', Enter: '', Escape: '' }
;(async () => {
  const b = await wk.start({ width: 1280, height: 720 })
  try {
    await b.go(BASE + '?still&open=portfolio')
    await wk.sleep(4500)
    const focus = () => b.js(`const el = document.activeElement; return el ? el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + (el.dataset.company ? '[' + el.dataset.company + ']' : '') : 'none'`)
    const value = () => b.js(`return document.querySelector('.wf[data-app="finder"] .search__input').value`)
    await b.tap('.wf[data-app="finder"] .search__input')
    await b.type('liquid')
    await wk.sleep(400)
    await b.type(KEY.ArrowDown)
    await wk.sleep(300)
    check('WebKit: ArrowDown in the Portfolio search goes to the first result', (await focus()) === 'button.pf-file[Liquid Death]', await focus())
    await b.tap('.wf[data-app="finder"] .search__input')
    await b.type(KEY.Escape)
    await wk.sleep(300)
    check('WebKit: Escape empties the search and keeps the caret', (await value()) === '' && (await focus()) === 'input.search__input', `${await value()} | ${await focus()}`)
    await b.type('drumroll')
    await wk.sleep(400)
    await b.shot(out('nosite'))
    check('WebKit: a company with no site says so', (await b.js(`return document.querySelector('.wf[data-app="finder"] .pf-preview__fate')?.textContent ?? null`)) === 'No website listed')
    await b.tap('.wf[data-app="finder"] .search__clear')
    await wk.sleep(300)
    check('WebKit: the clear button empties the search and the caret stays in the field', (await value()) === '' && (await focus()) === 'input.search__input', `${await value()} | ${await focus()}`)

    await b.go(BASE + '?still&open=faqs')
    await wk.sleep(4500)
    await b.shot(out('faq'))
    const faq = await b.js(`const w = document.querySelector('.wf[data-app="notes"]'); return { text: w.querySelector('.faq__pending')?.textContent ?? null, way: w.querySelector('.faq__way')?.getBoundingClientRect().height ?? 0 }`)
    check('WebKit: an unanswered question is drawn with its line and its way on', /hasn’t written this one down yet/.test(faq.text ?? '') && faq.way >= 28, JSON.stringify(faq))
    await b.tap('.wf[data-app="notes"] .search__input')
    await b.type('drops')
    await wk.sleep(500)
    check('WebKit: the FAQs window follows the search', (await b.js(`return document.querySelector('.wf[data-app="notes"] .faq__title').textContent`)) === 'What are drops?')
    await b.type(KEY.Enter)
    await wk.sleep(300)
    check('WebKit: Return goes to the first question found', /ss-row|faq-row/.test(await focus()), await focus())
  } finally {
    await b.end()
  }
  console.log(failed ? `${failed} FAILED` : 'ALL PASS')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
