// The chair's pictures, made from the chair itself: Dom's model of it (public/workspace/chair.glb), in the
// studio's own paint and under the studio's own lights (src/apps/workspace/stage.ts), stood in a
// photographer's white studio and taken as stills. A color with no photograph of its own is shown by these
// in the store (store/src/pictures.ts), and every color opens the store's page with one, so that the page
// to buy a chair on always has a proper picture of the product on it.
//
//   node tools/chair-mockups.cjs            every color, every picture
//   node tools/chair-mockups.cjs mantis-green matte-black     only these
//   node tools/chair-mockups.cjs --alone    only the chair alone, for every color (the studio pictures are left)
//   (needs Playwright, esbuild from node_modules, and python3 with Pillow and numpy)
//
// For each color it writes:
//   store/public/pictures/workspace-<color>-mock-1.webp, -1-s.webp   from behind at a three-quarter, where the color is
//   store/public/pictures/workspace-<color>-mock-2.webp, -2-s.webp   from in front
//   public/workspace/chairs/<color>.webp                             the chair alone, nothing behind it: a slab's, a card's
// Run it again when the chair's file, a paint or a color changes.
const { chromium } = require('playwright')
const esbuild = require('esbuild')
const { execFileSync } = require('child_process')
const http = require('http')
const path = require('path')
const fs = require('fs')
const os = require('os')

const ROOT = path.join(__dirname, '..')
const PICTURES = path.join(ROOT, 'store', 'public', 'pictures')
const ALONE = path.join(ROOT, 'public', 'workspace', 'chairs')

/** Every color: the eight the studio opens on (src/data/workspace.ts) and the sixteen more (store/shared/colors.ts), read as text. */
const read = (file, re) => [...fs.readFileSync(path.join(ROOT, file), 'utf8').matchAll(re)].map((m) => ({ id: m[1], color: m[2], shift: m[3] ? m[3].match(/#[0-9a-f]{6}/gi) : undefined, finish: m[4] }))
const EIGHT = read('src/data/workspace.ts', /\{ id: '([^']+)', name: '[^']+', color: '(#[0-9a-f]{6})',(?: shift: \[([^\]]+)\],)? finish: '([a-z]+)', stock/g)
const SIXTEEN = [...fs.readFileSync(path.join(ROOT, 'store/shared/colors.ts'), 'utf8').matchAll(/\{ id: '([^']+)', name: '[^']+', color: '(#[0-9a-f]{6})', finish: '([a-z]+)'(?:, shift: \[([^\]]+)\])? \}/g)].map((m) => ({ id: m[1], color: m[2], finish: m[3], shift: m[4] ? m[4].match(/#[0-9a-f]{6}/gi) : undefined }))
const COLORS = [...EIGHT, ...SIXTEEN]
if (COLORS.length !== 24) throw new Error(`read ${COLORS.length} colors, not 24: the lists have changed their shape`)

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const TRY = process.argv.includes('--try') // (small and quick, to look at: nothing is written to the site)
const ONLY_ALONE = process.argv.includes('--alone') // (only the chair alone: the studio pictures are left as they are)
const OUT = TRY ? process.env.MOCKUP_OUT || os.tmpdir() : null

/** The pictures: how the chair is turned, and how it is framed. Both are taken square, the chair standing in
 * the middle with the studio all round it, so that a place of another shape can show the middle of it. */
const SIDE = TRY ? 900 : 1800
const VIEWS = [
  { n: 1, turn: 0, down: 0.13 },
  { n: 2, turn: Math.PI - 0.42 - 0.62, down: 0.13 },
]
const STUDIO = { w: SIDE, h: SIDE, fills: 0.64, middle: 0.515, samples: TRY ? 12 : 24, shadow: 0.24 }
// (alone, the lamp throws no shadow: that one runs off to the side, past the picture's edge. The dark under the chair is enough)
const BARE = { n: 'alone', w: TRY ? 450 : 900, h: TRY ? 600 : 1200, fills: 0.84, middle: 0.49, down: 0.1, turn: 0, samples: TRY ? 8 : 16, shadow: 0 }

const COMPOSE = `
import sys, json, numpy as np
from PIL import Image, ImageFilter
job = json.load(open(sys.argv[1]))
w, h = job['w'], job['h']
raw = np.frombuffer(open(job['still'], 'rb').read(), dtype=np.uint8).reshape(h, w, 4)[::-1].astype(np.float32) / 255.0
rgb, a = raw[..., :3], raw[..., 3:4]
# The dark under the chair (the sky it keeps off the floor), softened as a floor softens it
ao = Image.frombuffer('L', (w, h), open(job['under'], 'rb').read(), 'raw', 'L', 0, 1).transpose(Image.FLIP_TOP_BOTTOM).filter(ImageFilter.GaussianBlur(w / 420))
ao = np.clip(np.asarray(ao, dtype=np.float32) / 255.0 * job['ao'], 0, 0.9)[..., None]
if job.get('bare'):
    # The chair alone, and the dark under it as so much black: whatever it is laid over shows through it. The
    # dark is let go of well inside the picture's edges, so that no edge of the picture is ever seen on a slab
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    far = np.sqrt(((xs / w - 0.5) / 0.46) ** 2 + ((ys / h - job['floor']) / 0.085) ** 2)
    ao = ao * (np.clip(1 - far, 0, 1) ** 0.9)[..., None]
    alpha = a + (1 - a) * ao
    straight = np.where(a > 1e-4, rgb / np.maximum(alpha, 1e-4), 0)
    out = np.concatenate([np.clip(straight, 0, 1), alpha], axis=2)
    im = Image.fromarray((out * 255 + 0.5).astype(np.uint8), 'RGBA')
    im.resize((job['out_w'], job['out_h']), Image.LANCZOS).save(job['to'][0], 'WEBP', quality=78, method=6, alpha_quality=88)
    sys.exit(0)
# The studio: a white sweep, lit a little more behind the chair than at its edges, the floor a shade under the wall
ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
u, v = xs / w - 0.5, ys / h - 0.46
glow = np.clip(1 - np.sqrt((u / 0.78) ** 2 + (v / 0.74) ** 2), 0, 1) ** 1.25
wall = 0.905 + 0.058 * glow
wall = wall - 0.02 / (1 + np.exp(-(ys / h - job['horizon']) / 0.035))
bg = np.clip(np.stack([wall * 0.998, wall * 0.998, wall * 1.004], axis=2), 0, 1)
# ... the dark under the chair on it, and over that the still: the shadow its lamp throws, and the chair
out = np.clip(bg * (1 - ao) * (1 - a) + rgb, 0, 1)
im = Image.fromarray((out * 255 + 0.5).astype(np.uint8), 'RGB')
for to, side, q in zip(job['to'], job['sides'], job['q']):
    (im if side == w else im.resize((side, side), Image.LANCZOS)).save(to, 'WEBP', quality=q, method=6)
`

;(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockup-'))
  // The page's script, with the studio's own stage in it
  await esbuild.build({ entryPoints: [path.join(__dirname, 'chair-mockups.entry.ts')], bundle: true, format: 'iife', outfile: path.join(tmp, 'mockup.js'), logLevel: 'error', define: { 'import.meta.env.BASE_URL': '"/"' } })
  fs.writeFileSync(path.join(tmp, 'index.html'), '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#888"><script src="/mockup.js"></script>')
  fs.writeFileSync(path.join(tmp, 'compose.py'), COMPOSE)
  // Served from here: the page and its script, and the chair's file from where the site keeps it
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0]
    const file = url.startsWith('/workspace/') ? path.join(ROOT, 'public', url) : path.join(tmp, url === '/' ? 'index.html' : url)
    fs.readFile(file, (err, data) => (err ? (res.writeHead(404), res.end()) : (res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream' }), res.end(data))))
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.error('page:', e.message))
  await page.goto(`http://127.0.0.1:${server.address().port}/`)
  await page.evaluate(() => window.mockup.ready)
  const save = async (b64, name) => (fs.writeFileSync(path.join(tmp, name), Buffer.from(b64, 'base64')), path.join(tmp, name))
  if (!TRY) fs.mkdirSync(ALONE, { recursive: true })

  // The dark under the chair, once for each way it is turned
  const unders = {}
  for (const view of [...(ONLY_ALONE ? [] : VIEWS.map((view) => ({ ...STUDIO, ...view }))), BARE]) {
    const began = Date.now()
    unders[view.n] = await save(await page.evaluate(([shot, lamps]) => window.mockup.under(shot, lamps), [{ ...view, color: '#888888', finish: 'gloss' }, TRY ? 96 : 240]), `under-${view.n}.bin`)
    console.log(`the floor under view ${view.n}: ${((Date.now() - began) / 1000).toFixed(0)}s`)
  }
  // Where the floor meets the wall, in the picture: the chair's feet are a little under it
  const horizon = STUDIO.middle + STUDIO.fills * 0.24

  for (const c of COLORS.filter((c) => !only.length || only.includes(c.id))) {
    const began = Date.now()
    for (const view of ONLY_ALONE ? [] : VIEWS) {
      const bin = await save(await page.evaluate((shot) => window.mockup.still(shot), { ...STUDIO, ...view, color: c.color, shift: c.shift, finish: c.finish }), 'still.bin')
      const to = TRY ? [path.join(OUT, `${c.id}-${view.n}.webp`)] : [path.join(PICTURES, `workspace-${c.id}-mock-${view.n}.webp`), path.join(PICTURES, `workspace-${c.id}-mock-${view.n}-s.webp`)]
      fs.writeFileSync(path.join(tmp, 'job.json'), JSON.stringify({ w: STUDIO.w, h: STUDIO.h, still: bin, under: unders[view.n], horizon, ao: 0.78, to, sides: TRY ? [SIDE] : [1800, 760], q: [86, 82] }))
      execFileSync('python3', [path.join(tmp, 'compose.py'), path.join(tmp, 'job.json')], { stdio: 'inherit' })
    }
    const bin = await save(await page.evaluate((shot) => window.mockup.still(shot), { ...BARE, color: c.color, shift: c.shift, finish: c.finish }), 'bare.bin')
    fs.writeFileSync(path.join(tmp, 'job.json'), JSON.stringify({ w: BARE.w, h: BARE.h, bare: true, still: bin, under: unders.alone, ao: 0.9, floor: BARE.middle + BARE.fills * 0.47, out_w: TRY ? 450 : 600, out_h: TRY ? 600 : 800, to: [TRY ? path.join(OUT, `${c.id}-alone.webp`) : path.join(ALONE, `${c.id}.webp`)] }))
    execFileSync('python3', [path.join(tmp, 'compose.py'), path.join(tmp, 'job.json')], { stdio: 'inherit' })
    console.log(`took ${c.id}: ${((Date.now() - began) / 1000).toFixed(0)}s`)
  }
  await browser.close()
  server.close()
  fs.rmSync(tmp, { recursive: true, force: true })
})().catch((e) => {
  console.error('FAILED', e.message.split('\n').slice(0, 8).join('\n'))
  process.exit(1)
})
