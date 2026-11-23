// Builds the whole site into dist/: the card as its front page, and the store under /store/.
//
// The card (card/index.html) is one page, complete in itself. As it is kept here it carries a stand-in for the
// server at its foot, for the click-through demo. For the real site that stand-in is taken out, so the page
// talks to the server in api/; for the demo (SHRUG_DEMO=1) it is left in, and the store is built with its own.
// Either way the card's line about the store, written when there was none, is made the way in to it.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))
const demo = process.env.SHRUG_DEMO === '1'
const dist = resolve(here, 'dist')

rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })
await build({ configFile: resolve(here, 'vite.config.ts'), logLevel: 'warn' })

let card = readFileSync(resolve(here, 'card/index.html'), 'utf8')
const swap = (from, to) => {
  if (!card.includes(from)) throw new Error(`card/index.html has changed: could not find ${JSON.stringify(from.slice(0, 60))}`)
  card = card.replace(from, to)
}

// The store is open: where the card said it was not, it now offers the way in
swap(`if (moved) body.push('Was ' + fmt(S.printed) + ". The store still isn't open. ");`, `if (moved) body.push('Was ' + fmt(S.printed) + '. ');`)
swap(`else body.push("The store isn't open yet. ");`, `body.push(Object.assign(h('a', 'linkbtn', 'Spend them in the store'), { href: 'store/' }), '. ');`)
swap(`else body.push(moved ? "We'll email you when it is." : "We'll email you when your points move, or when a new drop lands on the shelf.");`, `else body.push("We'll email you when your points move, or when a new drop lands on the shelf.");`)

if (!demo) {
  const from = card.indexOf('<script>\n/* A stand-in for the server')
  const to = card.indexOf('</script>', from)
  if (from < 0 || to < 0) throw new Error('card/index.html has changed: could not find the demo stand-in')
  card = card.slice(0, from) + card.slice(to + '</script>'.length)
}

writeFileSync(resolve(dist, 'index.html'), card)
console.log(`${demo ? 'demo' : 'real'} site built: the card ${(card.length / 1024).toFixed(0)} KB, the store in dist/store/`)
