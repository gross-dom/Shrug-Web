// Makes the site into one HTML file that can be sent to someone and opened
// anywhere, with nothing beside it:
//
//   node tools/preview.cjs <out.html>
//
// It builds the site, folds the build into one page (the script, the styles,
// the Latin font, the wallpapers and the logos all inside it) and wraps that
// page in one that shows the iPhone on a computer too, with a way over to the
// desktop. The site itself is untouched: this is only for previews.
const fs = require('fs')
const os = require('os')
const path = require('path')

const root = path.join(__dirname, '..')
const out = process.argv[2]
if (!out) {
  console.error('usage: node tools/preview.cjs <out.html>')
  process.exit(1)
}

/** Builds the site with everything in one script and one stylesheet. */
async function build(dir) {
  const vite = await import('vite')
  await vite.build({
    root,
    base: './',
    logLevel: 'warn',
    build: { outDir: dir, emptyOutDir: true, cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } },
  })
}

/** Folds a build into one page. */
function fold(dir) {
  const read = (href) => fs.readFileSync(path.join(dir, href.replace(/^\.?\//, '')), 'utf8')
  const data = (file, type) => `data:${type};base64,${fs.readFileSync(file).toString('base64')}`
  let html = read('index.html')

  html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => {
    let css = read(href)
    // The Latin font goes in the page; the other subsets are dropped, and the system's font stands in for them
    css = css.replace(/@font-face\{[^}]*\}/g, (rule) => {
      const m = /url\(([^)]+inter-latin-wght-normal[^)]+\.woff2)\)/.exec(rule)
      if (!m) return ''
      const font = data(path.join(dir, 'assets', path.basename(m[1].replace(/["']/g, ''))), 'font/woff2')
      return rule.replace(/src:[^;}]+/, `src:url(${font}) format("woff2-variations")`)
    })
    css = css.replace(/url\(([^)]*?)(wallpaper[\w-]*\.webp)\)/g, (_, __, file) => `url(${data(path.join(dir, file), 'image/webp')})`)
    return `<style>${css}</style>`
  })
  html = html.replace(/<link rel="preload"[^>]*>\s*/g, '')
  html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, src) => `<script type="module">${read(src).replace(/<\/script>/g, '<\\/script>')}</script>`)

  // The logos are files beside the page. They go in it as data, and the places
  // the script builds a logo's address are pointed at that data instead.
  const logos = {}
  for (const file of fs.readdirSync(path.join(dir, 'logos'))) logos[file] = data(path.join(dir, 'logos', file), 'image/webp')
  let swapped = 0
  html = html.replace(/`\.\/logos\/\$\{([\w$.]+)\}`/g, (_, name) => (swapped++, `(window.__logos[${name}]||"")`))
  if (!swapped || html.includes('./logos/')) throw new Error('a logo address in the script was not recognised: see fold() in tools/preview.cjs')
  html = html.replace('<script type="module">', () => `<script>window.__logos=${JSON.stringify(logos)}</script><script type="module">`)

  return html.replace(/href="[^"]*favicon\.svg"/, () => `href="${data(path.join(dir, 'favicon.svg'), 'image/svg+xml')}"`)
}

/** Wraps the page in one that shows it in a frame. On a phone that frame is
 * the whole screen and nothing else is drawn. On a computer the site would show
 * its desktop, so the frame is asked for the iPhone instead (the site draws it
 * in a phone's frame; see `asked` in src/os/wm.ts), with a button under it to
 * see the desktop. A file has no address to ask with (`?phone`), which is why
 * the asking is done from here. */
function wrap(app) {
  if (!/<head[^>]*>/.test(app)) throw new Error('the page has no <head>')
  // As a script's string, with every "<" spelled out so that nothing in it can end the script it sits in
  const text = JSON.stringify(app).replace(/</g, '\\u003c').split('\u2028').join('\\u2028').split('\u2029').join('\\u2029')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0b1150">
<title>Shrug</title>
<style>
  html, body { margin: 0; height: 100%; background: #0b1150; overflow: hidden; overscroll-behavior: none; }
  iframe { position: fixed; left: 0; top: 0; width: 100%; height: 100%; border: 0; display: block; background: #0b1150; }
  p { display: none; }
  /* On a computer: a strip under the frame to go between the iPhone and the desktop */
  body.wide { background: #05072e; }
  body.wide iframe { height: calc(100% - 44px); }
  body.wide p { display: flex; gap: 10px; justify-content: center; align-items: center; position: fixed; left: 0; right: 0; bottom: 0; height: 44px; margin: 0; font: 500 12px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: rgb(255 255 255 / 0.6); }
  button { font: inherit; color: #fff; background: rgb(255 255 255 / 0.14); border: 0; border-radius: 999px; padding: 6px 13px; cursor: pointer; }
  button:hover { background: rgb(255 255 255 / 0.22); }
</style>
</head>
<body>
<p><span>The site as it is on an iPhone.</span><button type="button">See the desktop</button></p>
<script>
const APP = ${text};
let frame = null, desk = false;
// A computer's screen, by the site's own rule for what is a phone (src/os/wm.ts)
const wide = () => innerWidth >= 760 && innerHeight >= 480;
const says = document.querySelector('span'), button = document.querySelector('button');
// What the site in the frame is told: whether to be the iPhone whatever the frame's size
const hook = (phone) => '\\u003cscript>window.__shrugHost={phone:' + phone + '}\\u003c/script>';
function show() {
  const next = document.createElement('iframe');
  next.title = 'Shrug';
  next.allow = 'web-share; clipboard-write';
  next.srcdoc = APP.replace(/<head[^>]*>/, (head) => head + hook(wide() && !desk));
  if (frame) frame.remove();
  document.body.append(next);
  frame = next;
  fit();
}
button.addEventListener('click', () => {
  desk = !desk;
  says.textContent = desk ? 'The site as it is on a computer.' : 'The site as it is on an iPhone.';
  button.textContent = desk ? 'See the iPhone' : 'See the desktop';
  show();
});
const size = () => document.body.classList.toggle('wide', wide());
// The keyboard takes the bottom of the screen: the frame keeps to what is left above it
const vv = window.visualViewport;
function fit() {
  if (!frame || !vv || Math.abs(vv.scale - 1) > 0.01 || document.body.classList.contains('wide')) return;
  const keyboard = innerHeight - vv.height > 120;
  frame.style.height = keyboard ? vv.height + 'px' : '';
  frame.style.top = keyboard ? vv.offsetTop + 'px' : '';
  if (!keyboard && scrollY) scrollTo(0, 0);
}
addEventListener('resize', () => { size(); fit(); });
if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); }
size();
show();
</script>
</body>
</html>
`
}

;(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shrug-preview-'))
  try {
    await build(dir)
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
    fs.writeFileSync(out, wrap(fold(dir)))
    console.log(`wrote ${out} (${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MB)`)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
