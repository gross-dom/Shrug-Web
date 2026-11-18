// tb: a finger. Everything here goes through touch events (no mouse, no hover, no keyboard unless a test says so).
const A = require('./lib.cjs')

/** The middle of the first (or nth) element matching a selector, or null. */
async function mid(page, selector, nth = 0) {
  return page.evaluate(
    ([selector, nth]) => {
      const el = document.querySelectorAll(selector)[nth]
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, l: r.x, t: r.y, r: r.right, b: r.bottom }
    },
    [selector, nth],
  )
}

/** A tap with a finger at a point. */
async function tapAt(page, x, y) {
  await page.touchscreen.tap(x, y)
}

/** A tap with a finger on an element's middle. Returns false when it isn't there. */
async function tap(page, selector, nth = 0) {
  const p = await mid(page, selector, nth)
  if (!p) return false
  await page.touchscreen.tap(p.x, p.y)
  return true
}

/** A finger put down, moved and lifted. */
async function swipe(t, from, to, { steps = 12, ms = 260, hold = 0, holdEnd = 0 } = {}) {
  const pt = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 12, radiusY: 12, force: 1 }]
  await t.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from[0], from[1]) })
  if (hold) await t.page.waitForTimeout(hold)
  for (let i = 1; i <= steps; i++) {
    const k = i / steps
    await t.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k) })
    await t.page.waitForTimeout(ms / steps)
  }
  if (holdEnd) await t.page.waitForTimeout(holdEnd)
  await t.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

/** A finger held still on a point. */
async function press(t, x, y, ms = 900) {
  const pts = [{ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 12, radiusY: 12, force: 1 }]
  await t.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts })
  await t.page.waitForTimeout(ms)
  await t.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

/** Where every window is and which is in front. */
const windows = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('.wf')].map((w) => {
        const r = w.getBoundingClientRect()
        return [
          w.getAttribute('data-app'),
          {
            open: w.hasAttribute('data-open'),
            min: w.hasAttribute('data-min'),
            active: w.hasAttribute('data-active'),
            tile: w.getAttribute('data-tile'),
            z: Number(getComputedStyle(w).zIndex) || 0,
            x: Math.round(r.x),
            y: Math.round(r.y),
            w: Math.round(r.width),
            h: Math.round(r.height),
          },
        ]
      }),
    ),
  )

const win = async (page, id) => (await windows(page))[id]

/** Waits until a check in the page is true (the machine is shared and slow at times), up to ms. Returns whether it came true. */
async function until(page, fn, arg, ms = 2500) {
  try {
    await page.waitForFunction(fn, arg, { timeout: ms, polling: 50 })
    return true
  } catch {
    return false
  }
}

/** The middle of a menu's item, by what it says. */
const menuItem = (page, menu, label) =>
  page.evaluate(([menu, label]) => {
    const el = [...document.querySelectorAll(`[data-menu="${menu}"] [data-menu-item]`)].find((e) => e.textContent.trim() === label)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }, [menu, label])

/** Opens a menu with a finger and waits for it. */
async function openMenu(page, id) {
  await tap(page, `[data-menu-title="${id}"]`)
  const ok = await until(page, (id) => document.querySelector(`[data-menu-title="${id}"]`)?.getAttribute('aria-expanded') === 'true', id)
  await page.waitForTimeout(220)
  return ok
}

/** Picks an item from a menu with a finger. */
async function pick(page, menu, label) {
  if (!(await openMenu(page, menu))) return false
  const p = await menuItem(page, menu, label)
  if (!p) return false
  await page.touchscreen.tap(p.x, p.y)
  await until(page, () => !document.querySelector('.menubar').hasAttribute('data-open'), null)
  return true
}

module.exports = { A, mid, tap, tapAt, swipe, press, windows, win, until, menuItem, openMenu, pick }
