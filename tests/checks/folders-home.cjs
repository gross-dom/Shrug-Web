// S2: the Home Screen's two folders at every size. How they are drawn (large, icon-sized, or left off), that what
// is drawn fits (nothing under Search or the Dock, no face past its cell or into its neighbour), and pictures.
//   node folders-home.cjs [base] [shots]
const A = require('./lib.cjs')
const BASE = process.argv[2] || process.env.BASE || 'http://127.0.0.1:5173/'
const SHOTS = process.argv[3] === 'shots'
let failed = 0
const check = (name, ok, detail = '') => {
  if (!ok) failed++
  if (!ok || process.env.ALL) console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + detail : ''))
}

const measure = (page) =>
  page.evaluate(() => {
    const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } }
    const home = document.querySelector('.sb-home')
    const icon = parseFloat(getComputedStyle(home).getPropertyValue('--icon')) || document.querySelector('.sb-grid .sb-icon__tile').getBoundingClientRect().width
    const tile = document.querySelector('.sb-grid .sb-icon:not(.sb-folder) .sb-icon__tile, .sb-grid a .sb-icon__tile')
    const folders = [...document.querySelectorAll('.sb-folder')].map((f) => {
      const face = f.querySelector('.sb-folder__face')
      const shown = f.getClientRects().length > 0
      return { id: face.dataset.folder, shown, cell: shown ? box(f) : null, face: shown ? box(face) : null, name: shown ? box(f.querySelector('.sb-icon__name')) : null }
    })
    const items = [...document.querySelectorAll('.sb-grid > *')].filter((e) => e.getClientRects().length > 0)
    const names = items.map((e) => e.querySelector('.sb-icon__name')).filter(Boolean).map(box)
    const faces = items.map((e) => e.querySelector('.sb-widget__face, .sb-folder__face, .sb-icon__tile')).filter(Boolean).map(box)
    const search = box(document.querySelector('.sb-search'))
    const dock = box(document.querySelector('.sb-dock'))
    const screen = box(document.querySelector('.ph'))
    const k = screen.w / document.querySelector('.ph').offsetWidth
    return { icon: tile ? tile.getBoundingClientRect().width / k : icon, k, folders, names, faces, search, dock, screen, cq: [document.querySelector('.ph').offsetWidth, document.querySelector('.ph').offsetHeight] }
  })

const over = (a, b, slack = 0.5) => a.l < b.r - slack && b.l < a.r - slack && a.t < b.b - slack && b.t < a.b - slack

;(async () => {
  const browser = await A.launch()
  const sizes = [
    // upright, edge to edge: [w, h, what the folders should be]. Each step of the rule at its edge: the last width of the
    // step at the step's own height (large, with room to spare), a point shorter (an icon-sized folder), and the same for
    // the step under which there is no room for a folder at all
    [280, 653, 'large'], [300, 580, 'large'], [300, 579, 'small'], [320, 586, 'large'], [320, 585, 'small'], [320, 568, 'small'], [320, 513, 'small'], [320, 512, 'none'], [320, 454, 'none'],
    [340, 592, 'large'], [340, 591, 'small'], [353, 597, 'large'], [353, 596, 'small'], [353, 513, 'small'], [353, 512, 'none'],
    [360, 640, 'large'], [360, 604, 'large'], [360, 603, 'small'], [360, 560, 'small'], [360, 519, 'small'], [360, 518, 'none'],
    [375, 667, 'large'], [375, 629, 'large'], [375, 619, 'large'], [375, 618, 'small'], [375, 553, 'small'], [375, 531, 'small'], [375, 530, 'none'],
    [384, 629, 'large'], [384, 628, 'small'], [390, 664, 'large'], [393, 659, 'large'], [393, 638, 'large'], [393, 637, 'small'], [393, 760, 'large'], [393, 545, 'small'], [393, 544, 'none'],
    [402, 647, 'large'], [402, 646, 'small'], [412, 800, 'large'], [412, 660, 'large'], [412, 659, 'small'], [414, 660, 'large'], [414, 659, 'small'], [414, 562, 'small'], [414, 561, 'none'],
    [430, 840, 'large'], [430, 676, 'large'], [430, 675, 'small'], [430, 660, 'small'], [430, 575, 'small'], [430, 574, 'none'],
    [444, 691, 'large'], [444, 690, 'small'], [444, 586, 'small'], [444, 585, 'none'], [500, 700, 'small'], [500, 701, 'large'], [500, 596, 'small'], [500, 595, 'none'],
    // on its side
    [568, 320, 'small'], [568, 270, 'small'], [640, 280, 'small'], [640, 360, 'small'], [667, 375, 'small'], [719, 400, 'small'], [720, 320, 'large'], [720, 319, 'small'], [736, 414, 'large'],
    [760, 340, 'large'], [760, 327, 'small'], [800, 334, 'small'], [800, 360, 'large'], [844, 390, 'large'], [932, 380, 'large'], [932, 430, 'large'], [932, 334, 'small'],
  ]
  const shots = []
  // one phone in the hand, turned and resized from size to size (the layout follows the screen's size alone)
  const t = await A.open(browser, { device: { w: 393, h: 760, touch: true, dpr: 1 }, base: BASE, query: 'still&phone=hand' })
  await A.unlock(t.page)
  for (const [w, h, want] of sizes) {
    await t.page.setViewportSize({ width: w, height: h })
    await t.page.waitForTimeout(350)
    // another fixer's edit can reload the dev page under this one: wait for the Home Screen, unlocking again if need be
    for (let i = 0; i < 3 && !(await t.page.$('.sb-home:not([data-locked])')); i++) { await t.page.waitForTimeout(1200); if (await t.page.$('.sb-lock:not([data-leaving])')) await A.unlock(t.page).catch(() => {}) }
    await t.page.evaluate(() => document.activeElement?.blur())
    const m = await measure(t.page)
    const land = w / h >= 1.25 && h <= 520
    const shown = m.folders.filter((f) => f.shown)
    const got = shown.length === 0 ? 'none' : shown[0].face.h / m.k > m.icon * 1.5 ? 'large' : 'small'
    check(`${w}x${h}: folders ${want}`, got === want, `got ${got} (icon ${m.icon.toFixed(1)}, face ${shown[0] ? (shown[0].face.w / m.k).toFixed(0) + 'x' + (shown[0].face.h / m.k).toFixed(0) : '-'})`)
    // nothing in the grid under Search (8px clear, as the audit measured it) or the Dock
    const lowest = Math.max(...m.names.map((n) => n.b), ...m.faces.map((f) => f.b))
    const gap = (m.search.t - lowest) / m.k
    if (!land) check(`${w}x${h}: icons clear of Search`, gap >= 7.5 || want === 'none', `gap ${gap.toFixed(1)}`)
    else {
      // on its side Search is beside nothing but must not sit on a name or a face
      const hits = [...m.names, ...m.faces].filter((r) => over(r, m.search))
      check(`${w}x${h}: nothing under Search`, hits.length === 0, `${hits.length} under it`)
    }
    check(`${w}x${h}: nothing under the Dock`, ![...m.names, ...m.faces].some((r) => over(r, m.dock)))
    // each face inside its own cell, and no two faces touching
    for (const f of shown) check(`${w}x${h}: ${f.id} face keeps to its cell`, f.face.l >= f.cell.l - 0.6 && f.face.r <= f.cell.r + 0.6, `face ${f.face.l.toFixed(0)}..${f.face.r.toFixed(0)} cell ${f.cell.l.toFixed(0)}..${f.cell.r.toFixed(0)}`)
    for (let i = 0; i < m.faces.length; i++) for (let j = i + 1; j < m.faces.length; j++) check(`${w}x${h}: faces ${i} and ${j} apart`, !over(m.faces[i], m.faces[j]))
    if (shown.length === 2 && shown[0].face.t === shown[1].face.t) check(`${w}x${h}: room between the two folders`, (shown[1].face.l - shown[0].face.r) / m.k >= 4, `${((shown[1].face.l - shown[0].face.r) / m.k).toFixed(1)}px`)
    // no stray letters: every title drawn in the FAQs face is wholly inside it
    const stray = await t.page.evaluate(() => {
      const face = document.querySelector('.sb-folder__face[data-folder="faqs"]')
      if (!face || !face.getClientRects().length) return 0
      const box = face.querySelector('.sb-folder__titles').getBoundingClientRect()
      return [...face.querySelectorAll('.sb-folder__titles span')].filter((s) => { const r = s.getBoundingClientRect(); return r.width > 0 && r.left < box.right - 0.5 && r.right > box.right + 0.5 }).length
    })
    check(`${w}x${h}: no title half shown`, stray === 0, `${stray}`)
    if (SHOTS) shots.push(await A.shot(t.page, `fix-s2-home-${w}x${h}`))
  }
  check('no errors at any size', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | ').slice(0, 200))
  await t.ctx.close()
  // in its frame on a computer: always the large ones
  for (const [w, h] of [[600, 900], [700, 1000], [500, 760]]) {
    const t = await A.open(browser, { device: { w, h, dpr: 1 }, base: BASE, query: 'still' })
    if ((await A.layout(t.page)) !== 'phone-framed') { console.log(`     ${w}x${h}: not framed here (${await A.layout(t.page)}), skipped`); await t.ctx.close(); continue }
    await A.unlock(t.page)
    const m = await measure(t.page)
    const shown = m.folders.filter((f) => f.shown)
    check(`framed ${w}x${h}: folders large`, shown.length === 2 && shown[0].face.h / m.k > m.icon * 1.5, `screen ${m.cq.join('x')}`)
    const lowest = Math.max(...m.names.map((n) => n.b), ...m.faces.map((f) => f.b))
    check(`framed ${w}x${h}: icons clear of Search`, (m.search.t - lowest) / m.k >= 7.5, `gap ${((m.search.t - lowest) / m.k).toFixed(1)}`)
    if (SHOTS) shots.push(await A.shot(t.page, `fix-s2-home-framed-${w}x${h}`))
    await t.ctx.close()
  }
  if (SHOTS) console.log(shots.join('\n'))
  await browser.close()
  console.log(failed ? `${failed} FAILED` : 'home: all ok')
  process.exit(failed ? 1 : 0)
})()
