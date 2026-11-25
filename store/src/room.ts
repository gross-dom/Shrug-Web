import { shelfOf, type Product } from '../shared/rules'
import type { Room } from './desk'

/** Which of the desk's windows this is, by the address it was opened at (?k=): one of the three stores, which
 * shows its own shelf and nothing else, or My VIP, which shows what is the member's and no shelf at all. On
 * its own site (no window) there is none: the whole store, and My VIP beside it, as before. */
export const ROOM: Room | null = (() => {
  const asked = new URLSearchParams(window.location.search).get('k')
  return asked === 'yours' ? 'yours' : shelfOf(asked)
})()
export const SHELF = ROOM === 'yours' ? null : ROOM
/** What each window calls itself. */
export const NAMES: Record<Room, string> = { art: 'ArtStore', books: 'Books', chairs: 'Workspace', yours: 'My VIP' }

/** A product's name, as this window says it. Inside Workspace a chair goes by its color alone ("Championship
 * Green"): the window says whose chair it is. Anywhere else it has its whole name ("Workspace, Championship
 * Green"), since there it sits among other things. */
export const nameIn = (product: Pick<Product, 'name'>): string => (ROOM === 'chairs' ? product.name.replace(/^Workspace,\s*/i, '') : product.name)

// ---- Drawn in a color. Workspace keeps a chair's color through its checkout: its window asks these pages to
// be drawn in it (?c=rrggbb when they are opened, and `shrugStore.tint` when the color changes meanwhile).
// The ground is then the color, and every word on it is white or near-black, whichever is read on it.

/** How light a color is, as the contrast of words on it is reckoned (WCAG's relative luminance). */
function lightOf(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const part = parseInt(hex.slice(at, at + 2), 16) / 255
    return part <= 0.03928 ? part / 12.92 : Math.pow((part + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const against = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

/** Draws these pages in a color, or (null) as they come. */
export function tint(asked: string | null) {
  const root = document.documentElement
  const hex = asked && /^#?[0-9a-f]{6}$/i.test(asked) ? `#${asked.replace('#', '').toLowerCase()}` : null
  if (!hex) {
    root.removeAttribute('data-tint')
    root.style.removeProperty('--tint')
    root.style.removeProperty('--tint-ink')
    return
  }
  const light = lightOf(hex)
  // White where it is read (WCAG AA), near-black where that is, and black on the few mid-tones where neither is
  const ink = against(1, light) >= 4.5 ? '#ffffff' : against(lightOf('#141414'), light) >= 4.5 ? '#141414' : '#000000'
  root.style.setProperty('--tint', hex)
  root.style.setProperty('--tint-ink', ink)
  root.setAttribute('data-tint', ink === '#ffffff' ? 'dark' : 'light')
}

// (as the page is opened)
tint(new URLSearchParams(window.location.search).get('c'))
