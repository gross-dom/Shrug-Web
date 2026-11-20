// VIP's checks, run by terminal-vip.cjs (which hands over its helpers). The library has its pictures now
// (public/vip, named in src/data/drops.ts): these hold to what a visitor sees of them on both layouts.

exports.vipChecks = async ({ A, browser, BASE, check, shot, arrived }) => {
  const SLOT = /\bslot\b|\[name\]|not supplied|on its way|on their way/i

  // ================= the iPhone
  let t = await A.open(browser, { device: 'iphone', base: BASE, query: 'still&open=vip' })
  let p = t.page
  await arrived(p)
  const top = () => p.locator('.sb-slot[data-front] .ios-page[data-pos="top"]')
  await top().locator('.photos-tile').first().waitFor({ timeout: 15000 })
  await p.waitForTimeout(1500)
  const lib = await top().evaluate((el) => {
    const tiles = [...el.querySelectorAll('.photos-tile')]
    const head = el.querySelector('.photos-head')
    return {
      tiles: tiles.length,
      pictures: tiles.filter((tile) => tile.querySelector('img')?.getAttribute('src')?.startsWith('/vip/')).length,
      empty: el.querySelectorAll('.photos-pic[data-empty]').length,
      named: tiles.every((tile) => / from /.test(tile.getAttribute('aria-label') || '')),
      head: { top: Math.round(head.getBoundingClientRect().top), tall: Math.round(head.getBoundingClientRect().height), picture: !!head.querySelector('img'), line: head.querySelector('.photos-head__line')?.textContent.trim() },
      text: el.innerText,
      note: el.querySelector('.photos-note')?.innerText.replace(/\s+/g, ' ') ?? '',
    }
  })
  check('phone: every tile is one of Shrug’s pictures, none a stand-in', lib.tiles === 33 && lib.pictures === 33 && lib.empty === 0, JSON.stringify({ tiles: lib.tiles, pictures: lib.pictures, empty: lib.empty }))
  check('phone: each tile says which drop it is from', lib.named)
  check('phone: the first picture heads the page from its very top, with how many there are under the name', lib.head.top === 0 && lib.head.tall > 300 && lib.head.picture && lib.head.line === '33 Items', JSON.stringify(lib.head))
  check('phone: what is counted is what is there, and nothing is promised', /^33 Photos From the people who got a drop\.$/.test(lib.note) && !SLOT.test(lib.text), lib.note)
  // The bar over the picture is given the colour along the picture's top, so that it reads as running up under it
  const edge = await p.evaluate(() => ({ page: getComputedStyle(document.documentElement).backgroundColor, theme: document.querySelector('meta[name="theme-color"]')?.content ?? null }))
  check('phone: the browser’s bar over VIP is in the colour of the picture’s top edge, not a flat dark gray', !/^rgb\((28, 28, 30|0, 0, 0|255, 255, 255)\)$/.test(edge.page), JSON.stringify(edge))
  await shot(p, 'vip-phone')
  await top().locator('.photos-tile').nth(1).tap()
  await p.waitForTimeout(1000)
  const view = await top().evaluate((el) => ({ picture: !!el.querySelector('.photos-big img, .photos-viewer img'), text: el.innerText }))
  check('phone: a tile opens its picture whole', view.picture && !SLOT.test(view.text), view.text.slice(0, 80))
  check('phone: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()

  // ================= the desktop
  t = await A.open(browser, { device: 'desktop', base: BASE, query: 'still&open=vip' })
  p = t.page
  await arrived(p)
  const win = p.locator('.wf[data-app="photos"]')
  await win.locator('.vip-tile').first().waitFor({ timeout: 15000 })
  await p.waitForTimeout(1200)
  const desk = await win.evaluate((el) => ({ tiles: el.querySelectorAll('.vip-tile').length, open: el.querySelectorAll('.vip-tile--open img').length, quiet: el.querySelectorAll('.vip-tile--quiet, .vip-tile[data-empty]').length, sub: el.querySelector('.vip__sub')?.innerText, text: el.innerText }))
  check('desktop: the same 33 pictures, none a stand-in', desk.tiles === 33 && desk.open === 33 && desk.quiet === 0, JSON.stringify({ tiles: desk.tiles, open: desk.open, quiet: desk.quiet }))
  check('desktop: the heading says whose they are, and promises nothing', desk.sub === 'From the people who got one.' && !SLOT.test(desk.text), desk.sub)
  await win.locator('.vip-tile').nth(2).click()
  await p.waitForTimeout(900)
  const look = await win.evaluate((el) => { const l = el.querySelector('.vip-look'); return l ? { says: l.getAttribute('aria-label'), picture: !!l.querySelector('img.vip-look__media') } : null })
  check('desktop: a tile opens its picture large, and says which drop and where in the run it is', !!look && look.picture && /^Photo from .+\. 3 of 33\.$/.test(look.says || ''), JSON.stringify(look))
  await p.keyboard.press('Escape')
  await p.waitForTimeout(500)
  check('desktop: Escape puts it away', (await win.locator('.vip-look').count()) === 0)
  await shot(p, 'vip-desktop')
  check('desktop: no errors', A.realErrors(t.errors).length === 0, A.realErrors(t.errors).join(' | '))
  await t.ctx.close()
}
