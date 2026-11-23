// Builds the whole site into dist/: the card as its front page, and the store under /store/.
//
// The card (card/index.html) is one page, complete in itself. As it is kept here it carries a stand-in for the
// server at its foot, for the click-through demo. For the real site that stand-in is taken out, so the page
// talks to the server in api/; for the demo (SHRUG_DEMO=1) it is left in, and the store is built with its own.
// Either way the card's line about the store, written when there was none, becomes the way in to it.

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

// The store is open. Where the card's ticket said it was not, the ticket now ends in a gold strip, the pack's
// own tear strip again, that goes there: pressed, the card's page fades out and the store's wall comes in.
swap(`if (moved) body.push('Was ' + fmt(S.printed) + ". The store still isn't open. ");`, `if (moved) body.push('Was ' + fmt(S.printed) + '. ');`)
swap(`else body.push("The store isn't open yet. ");`, ``)
swap(`else body.push(moved ? "We'll email you when it is." : "We'll email you when your points move, or when a new drop lands on the shelf.");`, `else body.push("We'll email you when your points move, or when a new drop lands on the shelf.");`)
swap(
  `return ticket('Your balance', fmt(m.points) + ' pts', moved ? { chip: '+' + fmt(m.points - S.printed), why: m.reason || 'since you last looked' } : null, body, when);`,
  `const t = ticket('Your balance', fmt(m.points) + ' pts', moved ? { chip: '+' + fmt(m.points - S.printed), why: m.reason || 'since you last looked' } : null, body, when);
    t.append(storeGo());
    return t;`,
)
swap(
  `  function cardTicket(who, when) {`,
  `  /** The way in to the store: a strip across the foot of the ticket. */
  function storeGo() {
    const a = h('a', 'store-go', h('span', 'store-go-chevs', '›››'), h('span', 'store-go-word', 'Spend them in the store'), h('span', 'store-go-chevs', '›››'));
    a.href = 'store/';
    a.addEventListener('click', (e) => {
      // A new tab or window is the browser's to open; and nothing is drawn out for someone who has asked for less motion
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      e.preventDefault();
      document.body.classList.add('to-store');
      setTimeout(() => { window.location.href = a.href; }, 430);
    });
    return a;
  }
  // Back from the store through the browser's history, the page is brought back as it was left: faded out
  window.addEventListener('pageshow', () => document.body.classList.remove('to-store'));

  function cardTicket(who, when) {`,
)
swap(
  `</style>`,
  `
/* The way in to the store (build.mjs): the tear strip again, across the foot of the balance ticket */
.store-go {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  margin: 12px -16px -13px; padding: 10px 10px 9px; border-radius: 0 0 4px 4px;
  border-top: 1.5px dashed rgba(11, 12, 16, 0.62);
  background-color: var(--tear);
  background-image: linear-gradient(90deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0) 8%, rgba(255, 255, 255, 0.26) 20%, rgba(255, 255, 255, 0) 34%, rgba(0, 0, 0, 0.05) 52%, rgba(255, 255, 255, 0.18) 72%, rgba(255, 255, 255, 0) 86%, rgba(0, 0, 0, 0.16) 100%);
  color: var(--ink); text-decoration: none; cursor: pointer; -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
}
.store-go-word { font-family: var(--display); font-size: calc(19px * var(--tf)); line-height: 1; letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap; }
.store-go-chevs { font-family: var(--display); font-size: calc(18px * var(--tf)); line-height: 1; letter-spacing: 0.06em; opacity: 0.4; transition: opacity 0.3s, transform 0.4s cubic-bezier(0.2, 0.7, 0.2, 1); }
.store-go:hover .store-go-chevs, .store-go:focus-visible .store-go-chevs { opacity: 0.85; transform: translateX(4px); }
.store-go:focus-visible { outline: 2px solid var(--paper); outline-offset: 2px; }
body.to-store .page { opacity: 0; transform: scale(1.03); transition: opacity 0.4s ease, transform 0.45s ease; }
</style>`,
)

if (!demo) {
  const from = card.indexOf('<script>\n/* A stand-in for the server')
  const to = card.indexOf('</script>', from)
  if (from < 0 || to < 0) throw new Error('card/index.html has changed: could not find the demo stand-in')
  card = card.slice(0, from) + card.slice(to + '</script>'.length)
}

writeFileSync(resolve(dist, 'index.html'), card)
console.log(`${demo ? 'demo' : 'real'} site built: the card ${(card.length / 1024).toFixed(0)} KB, the store in dist/store/`)
