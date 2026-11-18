// S2 in WebKit (Safari's engine, WebKitGTK here): the folders are drawn the size the rules say at each window size
// (so the long container queries are read as written), an open folder and search look right, and nothing throws.
//   node folders-webkit.cjs [base]
const wk = require('./webkit.cjs')
const path = require('path')
const BASE = process.argv[2] || process.env.BASE || 'http://127.0.0.1:5173/'
const out = (n) => path.join(__dirname, '..', 'audit', 'shots', `fix-s2-wk-${n}.png`)
let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + detail : ''))
}
// The stylesheet's own rule, written again here: what size the folders should be in a screen w by h
const want = (w, h) => {
  const side = w / h >= 1.25 && h <= 520
  if (side) return w < 720 || h < 320 || (w >= 760 && h < 328) || (w >= 800 && h < 335) ? 'small' : 'large'
  const under = (steps) => steps.some(([over, limit]) => w > over && h < limit)
  if (under([[0, 513], [353, 519], [360, 531], [375, 545], [393, 562], [414, 575], [430, 586], [444, 596]])) return 'none'
  if (under([[0, 580], [300, 586], [320, 592], [340, 597], [353, 604], [360, 619], [375, 629], [384, 638], [393, 647], [402, 660], [414, 676], [430, 691], [444, 701]])) return 'small'
  return 'large'
}
;(async () => {
  const b = await wk.start({ width: 460, height: 760 })
  await b.go(BASE + '?phone=hand&still')
  await b.js(`window.__errs = []; window.addEventListener('error', (e) => window.__errs.push(String(e.message))); return 1`)
  await wk.sleep(5000)
  await b.js(`document.querySelector('.sb-lock__hint')?.click(); return 1`); await wk.sleep(1500)
  const seen = new Set()
  for (const [w, h] of [[460, 760], [460, 690], [460, 640], [460, 590], [500, 705], [500, 600], [667, 375], [700, 400], [760, 340], [760, 322], [820, 330], [932, 430]]) {
    const [W, H] = await b.size(w, h)
    await wk.sleep(500)
    const m = await b.js(`
      const icon = document.querySelector('.sb-grid a .sb-icon__tile, .sb-grid .sb-icon:not(.sb-folder) .sb-icon__tile')?.getBoundingClientRect().width || 0
      const faces = [...document.querySelectorAll('.sb-folder')].filter((f) => f.getClientRects().length).map((f) => { const r = f.querySelector('.sb-folder__face').getBoundingClientRect(), c = f.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom, c.left, c.right] })
      const search = document.querySelector('.sb-search').getBoundingClientRect()
      const low = Math.max(...[...document.querySelectorAll('.sb-grid .sb-icon__name')].filter((n) => n.getClientRects().length).map((n) => n.getBoundingClientRect().bottom))
      return { icon, faces, gap: search.top - low, ph: [document.querySelector('.ph').offsetWidth, document.querySelector('.ph').offsetHeight] }`)
    const got = m.faces.length === 0 ? 'none' : m.faces[0][3] - m.faces[0][1] > m.icon * 1.5 ? 'large' : 'small'
    const exp = want(m.ph[0], m.ph[1])
    seen.add(exp)
    check(`WebKit ${m.ph.join('x')}: folders ${exp}`, got === exp, `got ${got}`)
    check(`WebKit ${m.ph.join('x')}: faces keep to their cells`, m.faces.every((f) => f[0] >= f[4] - 0.6 && f[2] <= f[5] + 0.6), JSON.stringify(m.faces.map((f) => f.map(Math.round))))
    const side = m.ph[0] / m.ph[1] >= 1.25 && m.ph[1] <= 520
    if (!side && exp !== 'none') check(`WebKit ${m.ph.join('x')}: icons clear of Search`, m.gap >= 7.5, `gap ${m.gap.toFixed(1)}`)
    if ([460, 667, 760].includes(w) && [760, 640, 375, 340].includes(h)) await b.shot(out(`home-${w}x${h}`))
  }
  check('WebKit: every size of folder was seen', ['large', 'small', 'none'].every((k) => seen.has(k)), [...seen].join())
  // an open folder, and search
  await b.size(460, 760); await wk.sleep(400)
  await b.js(`document.querySelector('.sb-folder')?.click(); return 1`); await wk.sleep(1300)
  const open = await b.js(`const s = [...document.querySelectorAll('.sb-open__step')].map((x) => Math.round(x.getBoundingClientRect().height)); return { steps: s, dots: document.querySelectorAll('.sb-open__dot').length, apps: document.querySelectorAll('.sb-open__app').length }`)
  check('WebKit: the folder opens, with its strip', open.apps === 81 && open.dots === 9 && open.steps.length === 2 && open.steps.every((x) => x >= 44), JSON.stringify(open))
  await b.shot(out('open'))
  await b.js(`document.querySelector('.sb-open__step[data-way="on"]').click(); return 1`); await wk.sleep(900)
  check('WebKit: the right half turns the page', (await b.js(`return [...document.querySelectorAll('.sb-open__dot')].findIndex((d) => d.hasAttribute('data-current'))`)) === 1)
  // closed by a press outside it, as a visitor would
  await b.js(`document.querySelector('.sb-open__away').click(); return 1`); await wk.sleep(900)
  check('WebKit: a press outside closes the folder', (await b.js(`return document.querySelectorAll('.sb-open:not([data-closing])').length`)) === 0)
  await b.js(`document.querySelector('.sb-search')?.click(); return 1`); await wk.sleep(900)
  await b.tap('.spot-input'); await wk.sleep(200)
  await b.type('contact'); await wk.sleep(600)
  if (!(await b.js(`return document.querySelector('.spot-input')?.value`))) {
    // the driver's keys did not reach the field: set it as typing does
    await b.js(`const i = document.querySelector('.spot-input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'contact'); i.dispatchEvent(new Event('input', { bubbles: true })); return 1`); await wk.sleep(500)
  }
  const top = await b.js(`const t = document.querySelector('.spot-row[data-top]'); return t ? [t.querySelector('.spot-row__title').textContent, t.tagName] : null`)
  check('WebKit: search puts the way to Shrug first for "contact"', top && top[0] === 'Get in Touch' && top[1] === 'A', JSON.stringify(top))
  await b.shot(out('search'))
  const errs = (await b.js('return window.__errs || []')) || []
  check('WebKit: no page errors', errs.length === 0, [...new Set(errs)].slice(0, 4).join(' | '))
  await b.end()
  console.log(failed ? `${failed} FAILED` : 'webkit: all ok')
  process.exit(failed ? 1 : 0)
})().catch((e) => { console.error('FAILED', e.message); process.exit(1) })
