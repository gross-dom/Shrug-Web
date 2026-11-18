// What every audit script needs: a page opened as a given device, ways to get to any screen, and a few detectors.
//   const A = require('./lib.cjs')
//   const browser = await A.launch()
//   const t = await A.open(browser, { device: 'iphone', query: 'still' })   // -> { ctx, page, cdp, errors, sleep }
//   await A.unlock(t.page); await A.at(t.page, 'notes', ['f:faqs', 'n:2']); await A.shot(t.page, 'notes-note')
// BASE is the production build unless BASE is set in the environment (dev: http://127.0.0.1:5173/).
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
const { execFileSync } = require('child_process')

const S = path.join(__dirname, '..')
exports.S = S
exports.BASE = process.env.BASE || 'http://127.0.0.1:4173/'
exports.OUT = path.join(S, 'audit', 'shots')
fs.mkdirSync(exports.OUT, { recursive: true })

/** Viewports in CSS pixels. touch: a finger and no mouse. */
exports.DEVICES = {
  // phones, upright
  fold: { w: 280, h: 653, touch: true, dpr: 3 },
  se1: { w: 320, h: 568, touch: true, dpr: 2 },
  android: { w: 360, h: 640, touch: true, dpr: 3 },
  se3: { w: 375, h: 667, touch: true, dpr: 2 },
  iphone: { w: 393, h: 760, touch: true, dpr: 3 }, // an iPhone 15/16 inside Safari, bars showing
  iphonefull: { w: 393, h: 852, touch: true, dpr: 3 },
  pixel: { w: 412, h: 800, touch: true, dpr: 2.6 },
  max: { w: 430, h: 840, touch: true, dpr: 3 },
  // phones, on their side
  'se1-land': { w: 568, h: 320, touch: true, dpr: 2 },
  'iphone-land': { w: 760, h: 340, touch: true, dpr: 3 },
  'max-land': { w: 932, h: 380, touch: true, dpr: 3 },
  // tablets
  ipadmini: { w: 744, h: 1133, touch: true, dpr: 2 },
  ipad: { w: 820, h: 1180, touch: true, dpr: 2 },
  'ipad-land': { w: 1180, h: 820, touch: true, dpr: 2 },
  ipadpro: { w: 1024, h: 1366, touch: true, dpr: 2 },
  'ipadpro-land': { w: 1366, h: 1024, touch: true, dpr: 2 },
  surface: { w: 912, h: 1368, touch: true, mouse: true, dpr: 2 },
  // computers
  tiny: { w: 500, h: 400, dpr: 1 },
  narrow: { w: 760, h: 600, dpr: 1 },
  laptop: { w: 1280, h: 720, dpr: 1 },
  desktop: { w: 1440, h: 900, dpr: 1 },
  fhd: { w: 1920, h: 1080, dpr: 1 },
  ultrawide: { w: 2560, h: 1080, dpr: 1 },
  uhd: { w: 3840, h: 2160, dpr: 1 },
}

const NETWORK = {
  // latency ms, bytes/s down, bytes/s up
  slow3g: { offline: false, latency: 400, downloadThroughput: (500 * 1024) / 8, uploadThroughput: (500 * 1024) / 8 },
  fast3g: { offline: false, latency: 150, downloadThroughput: (1600 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
  '4g': { offline: false, latency: 40, downloadThroughput: (9000 * 1024) / 8, uploadThroughput: (9000 * 1024) / 8 },
  offline: { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 },
}

exports.launch = () => chromium.launch()

/** Opens the site as a device. opts: device | {w,h,touch,dpr}, query, base, reducedMotion, colorScheme, forcedColors,
 * locale, timezoneId, userAgent, network ('slow3g' | 'fast3g' | '4g' | 'offline'), cpu (slowdown factor), js (false to
 * turn scripts off), goto (false to open nothing yet). */
exports.open = async (browser, opts = {}) => {
  const d = typeof opts.device === 'string' ? exports.DEVICES[opts.device] : opts.device || exports.DEVICES.iphone
  if (!d) throw new Error('no such device: ' + opts.device)
  const ctx = await browser.newContext({
    viewport: { width: d.w, height: d.h },
    deviceScaleFactor: opts.dpr || d.dpr || 1,
    hasTouch: !!d.touch,
    isMobile: !!d.touch && !d.mouse && d.w < 700,
    reducedMotion: opts.reducedMotion ? 'reduce' : 'no-preference',
    colorScheme: opts.colorScheme || 'light',
    forcedColors: opts.forcedColors ? 'active' : 'none',
    locale: opts.locale,
    timezoneId: opts.timezoneId,
    userAgent: opts.userAgent,
    javaScriptEnabled: opts.js !== false,
  })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)))
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url().slice(0, 120)))
  const cdp = await ctx.newCDPSession(page)
  if (opts.network) await cdp.send('Network.emulateNetworkConditions', NETWORK[opts.network])
  if (opts.cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: opts.cpu })
  const t = { ctx, page, cdp, errors, device: d, sleep: (ms) => page.waitForTimeout(ms) }
  if (opts.goto !== false) await page.goto((opts.base || exports.BASE) + (opts.query ? '?' + opts.query : ''), { waitUntil: 'load', timeout: 90000 })
  return t
}

/** Whether the page is showing the iPhone or the desktop. */
exports.layout = async (page) => {
  await page.waitForSelector('.ph, .dock', { timeout: 20000 }).catch(() => {})
  return page.evaluate(() => (document.querySelector('.ph--bleed') ? 'phone-bleed' : document.querySelector('.ph--framed') ? 'phone-framed' : document.querySelector('.dock') ? 'desktop' : 'none'))
}

/** Past the Lock Screen (iPhone layout). */
exports.unlock = async (page) => {
  await page.waitForSelector('.sb-lock', { timeout: 20000 })
  await page.waitForTimeout(700)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1100)
}

/** Goes to a place on the iPhone through history, which the phone follows: at(page, 'notes', ['f:faqs', 'n:2']),
 * at(page, 'finder', ['v:0'], 'company:Varda') (a company over its card), at(page, null, [], 'folder:portfolio') (Home Screen, folder open),
 * at(page, null, []) (Home Screen). Drawn without motion. */
exports.at = async (page, app, stack = [], sheet = null, wait = 900) => {
  await page.evaluate(([app, stack, sheet]) => {
    const cur = history.state?.shrug ?? { app: null, stacks: {}, sheet: null }
    const state = { shrug: { app, stacks: app ? { ...cur.stacks, [app]: stack } : cur.stacks, sheet }, n: (history.state?.n ?? 0) + 1 }
    history.pushState(state, '')
    window.dispatchEvent(new PopStateEvent('popstate', { state }))
  }, [app, stack, sheet])
  await page.waitForTimeout(wait)
}

/** The iPhone's state, as it keeps it. */
exports.state = (page) =>
  page.evaluate(() => ({
    place: history.state?.shrug ? { app: history.state.shrug.app, stack: history.state.shrug.app ? history.state.shrug.stacks[history.state.shrug.app] : [], sheet: history.state.shrug.sheet } : null,
    n: history.state?.n,
    locked: !!document.querySelector('.sb-lock:not([data-leaving])'),
    front: document.querySelector('.sb-slot[data-front]')?.getAttribute('data-app') ?? null,
    badge: document.querySelector('.sb-dock .sb-badge')?.textContent ?? null,
  }))

/** The iPhone's every screen: [name, app, stack, sheet]. */
exports.PHONE_SCREENS = [
  ['home', null, []],
  ['folder-portfolio', null, [], 'folder:portfolio'],
  ['folder-faqs', null, [], 'folder:faqs'],
  ['messages', 'messages', []],
  ['messages-group', 'messages', ['c:group']],
  ['messages-details', 'messages', ['c:group'], 'details'],
  ['messages-egg', 'messages', ['c:founder']],
  ['wallet-cards', 'finder', []],
  ['wallet-card', 'finder', ['v:4']],
  ['wallet-company', 'finder', ['v:0'], 'company:Varda'],
  ['notes-faqs', 'notes', ['f:faqs']],
  ['notes-note', 'notes', ['f:faqs', 'n:0']],
  ['notes-folders', 'notes', []],
  ['notes-newfolder', 'notes', [], 'new-folder'],
  ['notes-own', 'notes', ['f:notes']],
  ['vip-library', 'photos', []],
  ['vip-viewer', 'photos', ['m:0']],
  ['vip-info', 'photos', ['m:0'], 'info'],
  ['terminal', 'terminal', []],
]

/** A picture, saved under audit/shots. Returns its path. */
exports.shot = async (page, name, opts = {}) => {
  const file = path.join(exports.OUT, name + '.png')
  await page.screenshot({ path: file, ...opts })
  return file
}

/** Several pictures on one sheet: sheet(['a.png', ...], 'out.png', columns, scale). Needs python3 with Pillow. */
exports.sheet = (files, out, cols = 4, scale = 0.5) => {
  execFileSync('python3', [path.join(__dirname, 'sheet.py'), out, String(cols), String(scale), ...files], { stdio: 'inherit' })
  return out
}

/** What is spilling: things drawn past the edges of the screen, and text cut off without an ellipsis.
 * Skips what is hidden, inert or deliberately scrollable. Returns [{ kind, sel, text, rect }]. */
exports.overflow = (page) =>
  page.evaluate(() => {
    const vw = innerWidth
    const vh = innerHeight
    const out = []
    const name = (el) => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''))
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('[inert], [aria-hidden="true"], svg, .sr-only')) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      const text = (el.textContent || '').trim().slice(0, 40)
      if (r.bottom > 0 && r.top < vh && (r.right > vw + 1.5 || r.left < -1.5) && !el.closest('[data-scroller], .sb-open__pages, .photos-albums, .chat__scroll')) {
        // only the outermost offender of a subtree
        if (!out.some((o) => o.kind === 'offscreen-x' && o.el.contains(el))) out.push({ kind: 'offscreen-x', el, sel: name(el), text, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] })
      }
      if (el.children.length === 0 && text && el.scrollWidth > el.clientWidth + 1 && ['hidden', 'clip'].includes(cs.overflowX) && cs.textOverflow !== 'ellipsis' && !cs.webkitLineClamp?.match(/\d/))
        out.push({ kind: 'clipped-text', el, sel: name(el), text, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] })
    }
    return out.map(({ el, ...rest }) => rest)
  })

/** Things to press that are smaller than `min` px either way (44 on a phone). Returns [{ sel, label, w, h }]. */
exports.targets = (page, min = 44) =>
  page.evaluate((min) => {
    const out = []
    const name = (el) => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '')
    for (const el of document.querySelectorAll('button, a[href], input, textarea, select, [role="button"], [role="switch"], [role="tab"], [role^="menuitem"], [tabindex="0"]')) {
      if (el.closest('[inert], [aria-hidden="true"]') || el.classList.contains('sr-only')) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') continue
      // A field inside a capsule is pressed by its capsule
      const r = (el.matches('input, textarea') && el.closest('label') ? el.closest('label') : el).getBoundingClientRect()
      if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue
      if (r.width < min - 0.5 || r.height < min - 0.5) out.push({ sel: name(el), label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) })
    }
    return out
  }, min)

/** Console errors worth reporting (dev-server chatter left out). */
exports.realErrors = (errors) => [...new Set(errors)].filter((e) => !/\[vite\]|favicon/.test(e))
