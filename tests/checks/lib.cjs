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

/** The Dock's apps, in their order, with the name and the line each tile says (src/os/apps.ts). The checks
 * that hold the Dock, the Go menu and the keys along them to what they are read it here, in one place. */
exports.DOCK = [
  ['finder', 'Portfolio', 'Every company, by vertical'],
  ['messages', 'Group Chat', 'What people say'],
  ['notes', 'FAQs', 'Questions about Shrug'],
  ['terminal', 'Case Studies', 'Private. Ask nicely.'],
  ['mail', 'Mail', 'Twenty exchanges that led to something'],
  ['workspace', 'Workspace', 'The chair, in every color'],
  ['store', 'ArtStore', 'Six pieces, fifty of each'],
  ['books', 'Books', 'Five books from Shrug'],
  ['myvip', 'My VIP', 'Your card, points and orders'],
]
exports.DOCK_IDS = exports.DOCK.map(([id]) => id)

/** What is out on the desk, down its right-hand side, in its order: each icon's own name, and what it says of itself. */
exports.DESK = [
  ['updates', 'Updates, desktop icon, locked'],
  ['portfolio', 'Portfolio, desktop icon'],
  ['one-pager', 'One-pager, desktop icon'],
  ['wallpapers', 'Wallpapers, desktop icon'],
  ['quicktime', 'QuickTime, desktop icon'],
  ['photobooth', 'Photo Booth, desktop icon'],
  ['spotify', 'Spotify, desktop icon'],
  ['youtube', 'YouTube, desktop icon'],
]

/** Where the store's own pages for each of the three stores are, on the site itself, by the name of the
 * desktop's window for it (`SITE.stores` in src/data/site.ts). A phone had them as links to these until
 * 27 Nov; they are apps there now, and these are what the frame in each holds. */
exports.STORES = { workspace: 'vip/store/?k=chairs', store: 'vip/store/?k=art', books: 'vip/store/?k=books' }
/** One of them, as an address on the site at `base`. */
exports.storeAt = (base, which) => new URL(exports.STORES[which], base).href

/** Presses something that should open a tab of its own, and says where the tab went: its address, whether
 * it was given no way back to the page that opened it (`alone`), or null if no tab opened. The tab is closed. */
exports.tabFrom = async (ctx, press) => {
  const [tab] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null), press()])
  if (!tab) return null
  await tab.waitForLoadState('domcontentloaded').catch(() => {})
  const went = { url: tab.url(), alone: await tab.evaluate(() => window.opener === null).catch(() => null) }
  await tab.close().catch(() => {})
  return went
}

/** Answers for the weather service the desk's widget and the Weather window ask (api.weather.gov), so that
 * nothing a check finds depends on the weather or on the service: 58 degrees and mostly cloudy, by day, a
 * north-west wind at 12, and a week to follow. `as` changes the hour that is running; `as: 'down'` has the
 * service fail. */
exports.weather = (ctx, as = {}) =>
  ctx.route('https://api.weather.gov/**', (route) => {
    if (as === 'down') return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
    const url = route.request().url()
    const headers = { 'access-control-allow-origin': '*' }
    const ok = (body) => route.fulfill({ status: 200, headers, contentType: 'application/geo+json', body: JSON.stringify(body) })
    if (/\/points\//.test(url)) return ok({ properties: { forecastHourly: 'https://api.weather.gov/gridpoints/MTR/85,105/forecast/hourly', forecast: 'https://api.weather.gov/gridpoints/MTR/85,105/forecast' } })
    const hour = { startTime: new Date(Date.now() - 600e3).toISOString(), endTime: new Date(Date.now() + 3000e3).toISOString(), temperature: 58, temperatureUnit: 'F', shortForecast: 'Mostly Cloudy', isDaytime: true, probabilityOfPrecipitation: { value: 10 }, relativeHumidity: { value: 76 }, dewpoint: { value: 10 }, windSpeed: '12 mph', windDirection: 'NW', ...as }
    if (/hourly/.test(url)) {
      // The hour that is running, and the day after it, an hour at a time
      const later = Array.from({ length: 24 }, (_, i) => ({ ...hour, startTime: new Date(Date.now() + 3000e3 + i * 3600e3).toISOString(), endTime: new Date(Date.now() + 3000e3 + (i + 1) * 3600e3).toISOString(), temperature: 57 - (i % 5), shortForecast: i % 8 === 5 ? 'Chance Light Rain' : 'Mostly Cloudy', probabilityOfPrecipitation: { value: i % 8 === 5 ? 40 : 10 } }))
      return ok({ properties: { periods: [hour, ...later] } })
    }
    // The week, by the half day
    const noon = new Date(); noon.setUTCHours(20, 0, 0, 0)
    return ok({ properties: { periods: Array.from({ length: 14 }, (_, i) => ({ startTime: new Date(noon.getTime() + i * 12 * 3600e3).toISOString(), isDaytime: i % 2 === 0, temperature: i % 2 === 0 ? 62 + (i % 4) : 50 + (i % 3), temperatureUnit: 'F', shortForecast: i % 6 === 2 ? 'Rain Showers Likely' : 'Mostly Cloudy', probabilityOfPrecipitation: { value: i % 6 === 2 ? 70 : 10 } })) } })
  })

/** Answers for Spotify, which the Spotify window asks for each row's title and cover (its oEmbed) and for its
 * player (its embed pages), so that nothing a check finds depends on Spotify or on the network: an episode is
 * "Stand-in episode <the last four of its id>", a playlist "Stand-in playlist …", with no cover, and the
 * player is an empty page. `as: 'down'` has Spotify fail. */
const SPOTIFY_API = `(function () {
  const api = {
    createController(el, opts, made) {
      const frame = document.createElement('iframe')
      frame.src = 'https://open.spotify.com/embed/' + String(opts.uri).split(':').slice(1).join('/')
      frame.width = '100%'
      frame.height = String(opts.height || 152)
      frame.title = 'Spotify Embed'
      el.replaceWith(frame)
      const heard = { ready: [], playback_update: [] }
      const st = { uri: opts.uri, paused: true, at: 0, of: 600000, calls: [] }
      let timer = null
      const say = () => heard.playback_update.forEach((fn) => fn({ data: { isPaused: st.paused, isBuffering: false, duration: st.of, position: st.at } }))
      const run = () => {
        clearInterval(timer)
        timer = setInterval(() => {
          if (st.paused) return
          st.at = Math.min(st.of, st.at + 1000)
          say()
        }, 250)
      }
      const controller = {
        loadUri(uri) { st.calls.push('load ' + uri); st.uri = uri; st.at = 0; st.paused = true; say() },
        play() { st.calls.push('play'); st.paused = false; say(); run() },
        pause() { st.calls.push('pause'); st.paused = true; say() },
        resume() { st.calls.push('resume'); st.paused = false; say(); run() },
        togglePlay() { st.calls.push('toggle'); st.paused = !st.paused; say(); run() },
        seek(seconds) { st.calls.push('seek ' + seconds); st.at = seconds * 1000; say() },
        destroy() { st.calls.push('destroy'); clearInterval(timer); frame.remove() },
        addListener(event, fn) { (heard[event] = heard[event] || []).push(fn) },
      }
      window.__spotify = st
      setTimeout(() => { made(controller); setTimeout(() => { heard.ready.forEach((fn) => fn()); say() }, 30) }, 30)
    },
  }
  if (typeof window.onSpotifyIframeApiReady === 'function') window.onSpotifyIframeApiReady(api)
})()`

/** A cover, as a stand-in: a small square of one color, which is one of a few by the picture's address. */
const COVER = (url) => {
  const tones = ['#7a5cc4', '#c4573f', '#3f8f8a', '#b08a2a', '#35508f', '#8f3b55']
  let n = 0
  for (const ch of url) n = (n * 31 + ch.charCodeAt(0)) >>> 0
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${tones[n % tones.length]}"/></svg>`
}

exports.spotify = async (ctx, as) => {
  // (the covers are pictures on Spotify's servers: here each is a square of color)
  for (const host of ['https://*.spotifycdn.com/**', 'https://*.scdn.co/**']) await ctx.route(host, (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: COVER(route.request().url()) }))
  return ctx.route('https://open.spotify.com/**', (route) => {
    if (as === 'down') return route.fulfill({ status: 503, contentType: 'text/plain', body: '' })
    const url = route.request().url()
    const headers = { 'access-control-allow-origin': '*' }
    // (Spotify's iFrame API, as a stand-in: a controller that keeps what it was told to do in window.__spotify,
    // and whose episode is ten minutes long and plays four times as fast as a clock)
    if (/\/embed\/iframe-api\//.test(url)) return route.fulfill({ status: 200, headers, contentType: 'text/javascript', body: SPOTIFY_API })
    if (/\/oembed\?/.test(url)) {
      const of = /(episode|playlist)%2F([A-Za-z0-9]+)|(episode|playlist)\/([A-Za-z0-9]+)(?!.*oembed)/.exec(url)
      const kind = of ? of[1] || of[3] : 'episode'
      const id = of ? of[2] || of[4] : '0000'
      return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ title: `Stand-in ${kind} ${id.slice(-4)}`, thumbnail_url: null, provider_name: 'Spotify' }) })
    }
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Spotify player (stand-in)</title><body style="margin:0;background:#282828"></body>' })
  })
}

/** Answers for YouTube, whose stills the YouTube window shows and whose player it frames, so that no check
 * depends on YouTube or on the network: a still is a small grey picture, and the player an empty page. */
exports.youtube = (ctx) =>
  Promise.all([
    ctx.route('https://i.ytimg.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAHd3dwAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64') })),
    ctx.route('https://www.youtube-nocookie.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>YouTube player (stand-in)</title><body style="margin:0;background:#000"></body>' })),
  ])

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
  if (opts.weather !== false) await exports.weather(ctx, opts.weather)
  if (opts.spotify !== false) await exports.spotify(ctx, opts.spotify)
  await exports.youtube(ctx)
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
 * at(page, 'finder', ['co:Varda']) (a company's card, over the list), at(page, null, [], 'folder:portfolio') (Home Screen, folder open),
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
  ['messages-new', 'messages', ['new']],
  ['messages-details', 'messages', ['c:group'], 'details'],
  ['messages-egg', 'messages', ['c:founder']],
  ['contacts', 'finder', []],
  ['contacts-card', 'finder', ['co:Varda']],
  ['contacts-mine', 'finder', ['me']],
  ['notes-faqs', 'notes', ['f:faqs']],
  ['notes-note', 'notes', ['f:faqs', 'n:0']],
  ['notes-folders', 'notes', []],
  ['notes-newfolder', 'notes', [], 'new-folder'],
  ['notes-own', 'notes', ['f:notes']],
  ['terminal', 'terminal', []],
  // (the stores, My VIP, the one-pager and Updates, which are apps of the phone's own since 27 Nov)
  ['workspace', 'workspace', []],
  ['workspace-studio', 'workspace', ['studio']],
  ['workspace-owners', 'workspace', ['owners']],
  ['workspace-bts', 'workspace', ['bts']],
  ['artstore', 'store', []],
  ['books', 'books', []],
  ['books-reader', 'books', ['r:frequently asked']],
  ['myvip', 'myvip', []],
  ['one-pager', 'preview', []],
  ['updates', 'updates', []],
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
      if (r.bottom > 0 && r.top < vh && (r.right > vw + 1.5 || r.left < -1.5) && !el.closest('[data-scroller], .sb-open__pages, .chat__scroll')) {
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
