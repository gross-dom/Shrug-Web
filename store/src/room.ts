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

/** A color the window has asked these pages to be drawn in (?c=rrggbb): Workspace's, which keeps the chair's
 * color through its checkout. None anywhere else. */
export const TINT: string | null = (() => {
  const asked = new URLSearchParams(window.location.search).get('c') ?? ''
  return /^[0-9a-f]{6}$/i.test(asked) ? `#${asked.toLowerCase()}` : null
})()
