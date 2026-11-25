import { onShelf, type Order, type Product, type Shelf } from '../../store/shared/rules'
import { account } from './account'
import { createStore, useStore } from './store'

// The catalogue, as the desk's own windows read it.
//
// Books and Workspace show what they sell in their own way (a shelf of covers; the chair in a studio), and
// only hand over to the store's pages when something is to be bought. What there is, what it costs and what
// someone already has of it are the store's to say, so they ask the store: the same answer its own pages are
// drawn from (/api/store), or, in the demo, the same stand-in (store/src/demo.ts). A visitor is sent a chair
// without its price, which is for someone logged in (store/shared/rules.ts, `unpriced`).
//
// Only the desktop reads this: a phone has none of these apps.

const LIVE = import.meta.env.VITE_ACCOUNT === 'live'

export type Shop = { status: 'loading' } | { status: 'down' } | { status: 'ready'; visiting: boolean; products: Product[]; orders: Order[] }
export const shop = createStore<Shop>({ status: 'loading' })

let asking = 0
/** Asks the store what there is, for whoever is logged in now. */
export async function loadShop(): Promise<void> {
  const n = ++asking
  let answer: { status?: string; products?: Product[]; orders?: Order[]; error?: string } | null = null
  try {
    if (LIVE) {
      const res = await fetch('/api/store', { credentials: 'same-origin', cache: 'no-store' })
      answer = await res.json().catch(() => null)
    } else {
      const { demo } = await import('../../store/src/demo')
      answer = (await demo.store()) as unknown as typeof answer
    }
  } catch {
    answer = null
  }
  if (n !== asking) return
  shop.set(answer && Array.isArray(answer.products) ? { status: 'ready', visiting: answer.status !== 'member', products: answer.products, orders: answer.orders ?? [] } : { status: 'down' })
}

// Asked again whenever whoever is logged in changes, or what they have does: the prices a visitor is not
// shown, and the points and orders that are a member's
let who = ''
let started = false
function follow() {
  const now = account.get()
  const next = now.status === 'member' ? `${now.email}:${now.points}` : now.status
  if (next === who || now.status === 'checking') return
  who = next
  void loadShop()
}
/** Starts reading the catalogue, and keeps it in step with whoever is logged in. Asked by the first window that wants it. */
export function wantShop() {
  if (started) return
  started = true
  account.subscribe(follow)
  follow()
  if (shop.get().status === 'loading' && account.get().status === 'checking') void loadShop()
}

/** What one of the three stores sells, of what whoever is asking is shown; null until the store has answered. */
export function useShelf(shelf: Shelf): { products: Product[]; orders: Order[]; visiting: boolean; down: boolean } | null {
  const now = useStore(shop, (s) => s)
  if (now.status === 'loading') return null
  if (now.status === 'down') return { products: [], orders: [], visiting: true, down: true }
  return { products: onShelf(now.products, shelf), orders: now.orders, visiting: now.visiting, down: false }
}

/** A product's photographs live with the store's pages. */
export const PICTURES = '/vip/store/'
