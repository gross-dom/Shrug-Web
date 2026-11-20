// Makes the site's wallpaper from its drawing: tools/wallpaper.svg for the desktop and
// tools/wallpaper-phone.svg for the iPhone (the s of the logo, very large, as ribbons of glass
// over a sky that runs from near-black to blue). Each is drawn at the size it is shown, then
// given the grain and the compression the wallpapers have always had (tools/wallpaper.py does
// that part: without the grain the long gradients band once they are compressed). Needs
// Playwright, and Python with numpy and Pillow.
//   node tools/wallpaper.cjs      (writes public/wallpaper.webp, 2880x1620, and public/wallpaper-phone.webp, 780x1688,
//                                  the desktop's other colourways in public/wallpapers, and src/data/wallpapers.ts)
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { chromium } = require('playwright')

// How wide each picture is made. A phone stretches this one less than it did the picture before
// it, a desktop about as much, and neither file is heavier than the one it replaces.
const PICTURES = [
  { from: 'wallpaper.svg', to: 'wallpaper.webp', width: 2880 },
  { from: 'wallpaper-phone.svg', to: 'wallpaper-phone.webp', width: 780 },
]
const QUALITY = 86

// The desktop's wallpapers: the drawing as it is, and the same drawing in other colours. The desk shows
// the next one each visit, and the Wallpapers window on the desk has them all, to
// look at, to keep on the desk and to download (src/os/wallpaper.ts, src/apps/Wallpapers.tsx).
// A colourway turns every colour of the drawing but its white the same way round the colour wheel
// (`hue`, in degrees), and can make them stronger or weaker (`sat`) and lighter or darker (`light`).
// The first is the drawing untouched, and is the picture the site has always had (public/wallpaper.webp).
// Each is made three times over: as the desk shows it (2880 across), small for the window's grid (640),
// and large to download (3840 x 2160, a JPEG: the form a wallpaper is kept in).
// To add one, or to put a picture of Shrug's own in a colourway's place, see `others` below and the README.
const COLOURWAYS = [
  { id: 'indigo', name: 'Indigo', to: 'wallpaper.webp' },
  { id: 'dusk', name: 'Dusk', hue: 50, sat: 0.7, light: 0.96 },
  { id: 'ember', name: 'Ember', hue: 148, sat: 0.9, light: 0.96 },
  { id: 'lagoon', name: 'Lagoon', hue: -58, sat: 0.88, light: 0.94 },
  { id: 'graphite', name: 'Graphite', sat: 0.1, light: 0.92 },
]
const SMALL = 640
const LARGE = 3840

const toHsl = (hex) => {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}
const toHex = ([h, s, l]) => {
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const part = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return '#' + [0, 8, 4].map((n) => Math.round(part(n) * 255).toString(16).padStart(2, '0')).join('')
}

/** The drawing in a colourway's colours: every six-figure colour in it turned, its whites left white. */
const recoloured = (svg, { hue = 0, sat = 1, light = 1 }) =>
  hue === 0 && sat === 1 && light === 1
    ? svg
    : svg.replace(/#[0-9a-f]{6}\b/gi, (hex) => {
        const [h, s, l] = toHsl(hex)
        return toHex([(((h + hue) % 360) + 360) % 360, Math.min(1, s * sat), Math.min(1, l * light)])
      })

;(async () => {
  const browser = await chromium.launch()
  const draw = async (svg, width, out, quality = QUALITY) => {
    // The drawing's own shape: the picture keeps it
    const box = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)
    if (!box) throw new Error('a drawing has no viewBox to take its shape from')
    const height = Math.round((width * box[2]) / box[1])
    const page = await (await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })).newPage()
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${width}px;height:${height}px}</style>${svg}`)
    const drawn = path.join(os.tmpdir(), `${path.basename(out)}.png`)
    await page.screenshot({ path: drawn })
    await page.context().close()
    execFileSync('python3', [path.join(__dirname, 'wallpaper.py'), 'grain', drawn, out, String(quality)], { stdio: 'inherit' })
    fs.unlinkSync(drawn)
    return { width, height }
  }
  const pub = path.join(__dirname, '..', 'public')
  for (const { from, to, width } of PICTURES) await draw(fs.readFileSync(path.join(__dirname, from), 'utf8'), width, path.join(pub, to))

  // The colourways
  fs.mkdirSync(path.join(pub, 'wallpapers'), { recursive: true })
  const desk = fs.readFileSync(path.join(__dirname, 'wallpaper.svg'), 'utf8')
  const listed = []
  for (const way of COLOURWAYS) {
    const svg = recoloured(desk, way)
    const to = way.to ?? `wallpapers/${way.id}.webp`
    if (!way.to) await draw(svg, 2880, path.join(pub, to))
    await draw(svg, SMALL, path.join(pub, 'wallpapers', `${way.id}-small.webp`), 84)
    const full = `wallpapers/shrug-${way.id}.jpg`
    const { width, height } = await draw(svg, LARGE, path.join(pub, full), 92)
    listed.push({ id: way.id, name: way.name, src: `/${to}`, small: `/wallpapers/${way.id}-small.webp`, full: `/${full}`, width, height, bytes: fs.statSync(path.join(pub, full)).size })
  }
  const lines = [
    '// The desktop\'s wallpapers, as tools/wallpaper.cjs made them: the picture the desk shows, the same small for',
    '// the Wallpapers window\'s grid, and large to download (its size in pixels and in bytes). Each visit shows',
    '// the next of them (src/os/wallpaper.ts). Written by that tool: run it again when a colourway is added or',
    '// changed. (It writes the same pictures, in the same order, into the script at the head of index.html.)',
    '',
    'export interface Wallpaper {',
    '  id: string',
    '  name: string',
    '  src: string',
    '  small: string',
    '  full: string',
    '  width: number',
    '  height: number',
    '  bytes: number',
    '}',
    '',
    'export const WALLPAPERS: Wallpaper[] = [',
    ...listed.map((w) => `  { id: '${w.id}', name: '${w.name}', src: '${w.src}', small: '${w.small}', full: '${w.full}', width: ${w.width}, height: ${w.height}, bytes: ${w.bytes} },`),
    ']',
    '',
  ]
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'wallpapers.ts'), lines.join('\n'))
  console.log(`wrote src/data/wallpapers.ts (${listed.length} wallpapers)`)
  // The page settles which wallpaper a visit shows before the site has loaded, so it has their pictures too
  const page = path.join(__dirname, '..', 'index.html')
  const html = fs.readFileSync(page, 'utf8')
  const line = /(\/\* wallpapers \*\/ var PICTURES = )\[[^\]]*\]/
  if (!line.test(html)) throw new Error('index.html has no list of wallpapers to bring up to date')
  fs.writeFileSync(page, html.replace(line, `$1[${listed.map((w) => `'${w.src}'`).join(', ')}]`))
  console.log('brought index.html up to date')
  await browser.close()
})().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
