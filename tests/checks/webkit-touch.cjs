// tb's copy of webkit.cjs with a finger added (pointerType touch), if the driver will send one.
// A small WebDriver client for WebKitGTK's MiniBrowser: the closest thing here to Safari's engine.
// Usage: const wk = await require('./webkit.cjs').start({ width, height }); await wk.go(url); await wk.shot(path); await wk.js('return ...'); await wk.end()
const { spawn } = require('child_process')
const fs = require('fs')
const PORT = 4900 + Math.floor(Math.random() * 300)
const base = `http://127.0.0.1:${PORT}`
const call = async (method, path, body) => {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (json.value && json.value.error) throw new Error(`${json.value.error}: ${json.value.message}`)
  return json.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
exports.sleep = sleep
exports.start = async ({ width = 390, height = 844 } = {}) => {
  const driver = spawn('xvfb-run', ['-a', '-s', '-screen 0 1600x1200x24', 'WebKitWebDriver', `--port=${PORT}`], { stdio: 'ignore', env: { ...process.env, WEBKIT_DISABLE_COMPOSITING_MODE: '0', GDK_BACKEND: 'x11' } })
  for (let i = 0; i < 60; i++) { try { await call('GET', '/status'); break } catch { await sleep(250) } }
  const session = await call('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'MiniBrowser', 'webkitgtk:browserOptions': { binary: process.env.MINIBROWSER || '/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/MiniBrowser', args: ['--automation'] } } } })
  const id = session.sessionId
  const s = `/session/${id}`
  const api = {
    go: (url) => call('POST', `${s}/url`, { url }),
    js: (script, args = []) => call('POST', `${s}/execute/sync`, { script, args }),
    shot: async (file) => fs.writeFileSync(file, Buffer.from(await call('GET', `${s}/screenshot`), 'base64')),
    back: () => call('POST', `${s}/back`, {}),
    forward: () => call('POST', `${s}/forward`, {}),
    // fit the window so the page's own viewport is the size asked for
    size: async (w, h) => {
      await call('POST', `${s}/window/rect`, { width: w, height: h + 120 })
      await sleep(400)
      const inner = await api.js('return [innerWidth, innerHeight]')
      await call('POST', `${s}/window/rect`, { width: w + (w - inner[0]), height: h + 120 + (h - inner[1]) })
      await sleep(400)
      return api.js('return [innerWidth, innerHeight]')
    },
    tap: async (selector, nth = 0) => {
      const r = await api.js(`const el = document.querySelectorAll(arguments[0])[arguments[1]]; if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]`, [selector, nth])
      if (!r) throw new Error('no element for ' + selector)
      await call('POST', `${s}/actions`, { actions: [{ type: 'pointer', id: 'p1', parameters: { pointerType: 'mouse' }, actions: [{ type: 'pointerMove', duration: 0, x: r[0], y: r[1] }, { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 40 }, { type: 'pointerUp', button: 0 }] }] })
    },
    drag: async (from, to, ms = 300) => call('POST', `${s}/actions`, { actions: [{ type: 'pointer', id: 'p1', parameters: { pointerType: 'mouse' }, actions: [{ type: 'pointerMove', duration: 0, x: from[0], y: from[1] }, { type: 'pointerDown', button: 0 }, { type: 'pointerMove', duration: ms, x: to[0], y: to[1] }, { type: 'pointerUp', button: 0 }] }] }),
    touchTap: (x, y, hold = 40) => call('POST', `${s}/actions`, { actions: [{ type: 'pointer', id: 't1', parameters: { pointerType: 'touch' }, actions: [{ type: 'pointerMove', duration: 0, x: Math.round(x), y: Math.round(y) }, { type: 'pointerDown', button: 0 }, { type: 'pause', duration: hold }, { type: 'pointerUp', button: 0 }] }] }),
    touchDrag: (from, to, ms = 300) => call('POST', `${s}/actions`, { actions: [{ type: 'pointer', id: 't1', parameters: { pointerType: 'touch' }, actions: [{ type: 'pointerMove', duration: 0, x: Math.round(from[0]), y: Math.round(from[1]) }, { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 60 }, { type: 'pointerMove', duration: ms, x: Math.round(to[0]), y: Math.round(to[1]) }, { type: 'pause', duration: 60 }, { type: 'pointerUp', button: 0 }] }] }),
    release: () => call('DELETE', `${s}/actions`),
    type: (text) => call('POST', `${s}/actions`, { actions: [{ type: 'key', id: 'k1', actions: [...text].flatMap((ch) => [{ type: 'keyDown', value: ch }, { type: 'keyUp', value: ch }]) }] }),
    end: async () => { try { await call('DELETE', s) } catch {} driver.kill('SIGTERM') },
  }
  const got = await api.size(width, height)
  api.viewport = got
  return api
}
