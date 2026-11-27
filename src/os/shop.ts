import { onShelf, type Order, type Product, type Shelf, type Update } from '../../store/shared/rules'
import { server, shopOf, type Backend, type Shop as StoreShop, type StoreAnswer, type Who } from '../../store/src/backend'
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
// A phone's stores are drawn here altogether (src/phone/apps/Shop.tsx and its neighbours: the shelf, a
// product's page, checkout and My VIP are the phone's own screens, with no frame), so they read more of the
// same answer: who the member is to the store (their address on file, their number), what is theirs to
// read, and the key a payment is taken with. They buy through `backend`, which is the store's server, or
// in the demo its stand-in: the same one the store's own pages use.

const LIVE = import.meta.env.VITE_ACCOUNT === 'live'

export type Shop = { status: 'loading' } | { status: 'down' } | { status: 'ready'; visiting: boolean; products: Product[]; orders: Order[]; member: Who | null; updates: Update[]; stripeKey: string }
export const shop = createStore<Shop>({ status: 'loading' })

/** What the store is asked through: its server, or the demo's stand-in for it (fetched when first asked of). */
const behind: Promise<Backend> | null = LIVE ? Promise.resolve(server) : null
let stood: Promise<Backend> | null = null
const real = (): Promise<Backend> => behind ?? (stood ??= import('../../store/src/demo').then((m) => m.demo))
export const backend: Backend = {
  store: async () => (await real()).store(),
  order: async (asked) => (await real()).order(asked),
  pay: async (asked) => (await real()).pay(asked),
  paid: async (payment, asked) => (await real()).paid(payment, asked),
  address: async (shipTo) => (await real()).address(shipTo),
  emails: async (on) => (await real()).emails(on),
  view: async (update) => (await real()).view(update),
  download: async (update) => (await real()).download(update),
  phone: async (phone, code) => (await real()).phone(phone, code),
  signout: async () => (await real()).signout(),
}

let asking = 0
/** Asks the store what there is, for whoever is logged in now. */
export async function loadShop(): Promise<void> {
  const n = ++asking
  let answer: StoreAnswer | { error: string } | null = null
  try {
    answer = await backend.store()
  } catch {
    answer = null
  }
  if (n !== asking) return
  if (!answer || 'error' in answer || !Array.isArray(answer.products)) return shop.set({ status: 'down' })
  shop.set(
    answer.status === 'member'
      ? { status: 'ready', visiting: false, products: answer.products, orders: answer.orders ?? [], member: answer.member, updates: answer.updates ?? [], stripeKey: answer.stripeKey ?? '' }
      : { status: 'ready', visiting: true, products: answer.products, orders: [], member: null, updates: [], stripeKey: answer.stripeKey ?? '' },
  )
}

// Asked again whenever whoever is logged in changes, or what they have does: the prices a visitor is not
// shown, and the points and orders that are a member's
let who = ''
let started = false
function follow() {
  const now = account.get()
  // (and what they are called: their card has their name on it)
  const next = now.status === 'member' ? `${now.email}:${now.points}:${now.name}` : now.status
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

/** The whole of the store's answer, in the shape its own pages are drawn from (a visitor is a member who is
 * nobody: store/src/backend.ts, `shopOf`); null until the store has answered, or while it is not answering. */
export function useShop(): { shop: StoreShop; visiting: boolean } | null {
  const now = useStore(shop, (s) => s)
  if (now.status !== 'ready') return null
  if (!now.member) return { shop: shopOf({ status: 'visitor', products: now.products, stripeKey: now.stripeKey }), visiting: true }
  return { shop: { status: 'member', member: now.member, products: now.products, updates: now.updates, orders: now.orders, stripeKey: now.stripeKey }, visiting: false }
}

/** A product's photographs live with the store's pages. */
export const PICTURES = '/vip/store/'
