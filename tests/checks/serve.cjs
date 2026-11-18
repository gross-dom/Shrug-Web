// A static server that behaves like a real host for a built site: gzip for text, long caching for hashed files.
//   node serve.cjs <dir> <port>
// (`vite preview` sends everything uncompressed, which makes a slow connection look three times worse than it is.)
const http = require('http')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const dir = path.resolve(process.argv[2])
const port = Number(process.argv[3])
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon' }
const TEXT = new Set(['.html', '.js', '.css', '.svg', '.json', '.webmanifest'])
const zipped = new Map()

http
  .createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (rel.endsWith('/')) rel += 'index.html'
    let file = path.join(dir, rel)
    const there = file.startsWith(dir) && fs.existsSync(file) && !fs.statSync(file).isDirectory()
    // a file that is gone is gone (a build's old files, after a new one); any other address is the page
    if (!there && path.extname(rel)) return void res.writeHead(404, { 'content-type': 'text/plain' }).end('not found')
    if (!there) file = path.join(dir, 'index.html')
    const ext = path.extname(file)
    const headers = { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': /\/assets\//.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache' }
    let body = fs.readFileSync(file)
    if (TEXT.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      const key = file + '@' + fs.statSync(file).mtimeMs
      if (!zipped.has(key)) zipped.set(key, zlib.gzipSync(body, { level: 9 }))
      body = zipped.get(key)
      headers['content-encoding'] = 'gzip'
      headers.vary = 'accept-encoding'
    }
    headers['content-length'] = body.length
    res.writeHead(200, headers).end(body)
  })
  .listen(port, '127.0.0.1', () => console.log('serving', dir, 'on', port))
