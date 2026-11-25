import { fmtCents, fmtPoints, has, keptTo, POINTS_PER_DOLLAR, priceCents, soldOut, wayOf, type Order, type Product } from '../shared/rules'

// What the store says about a product, in the design's own words: its badge, its price, and the short name
// it goes by along the foot. A price is said in dollars everywhere. Points are a member's balance, and what
// they do is take dollars off: at a product and at checkout a member says how many to use, and is shown what
// that takes off the price.

export interface Badge {
  text: string
  /** gold: Pre-order and Made to order. on: You own this. */
  tone?: 'gold' | 'on'
}

const SHIPS = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const SHIPS_SHORT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/** The day a pre-order is sent, as it is written: "February 15, 2027" (or, where there is little room, "Feb 15, 2027").
 * Nothing where Shrug has not said. */
export function shipsOf(product: Pick<Product, 'status' | 'shipsOn'> | null | undefined, short = false): string | null {
  if (!product || product.status !== 'Pre-order' || !product.shipsOn) return null
  const day = new Date(`${product.shipsOn}T12:00:00Z`)
  return Number.isNaN(day.getTime()) ? null : (short ? SHIPS_SHORT : SHIPS).format(day)
}

/** Whether a member has bought it (a request or a reservation is not having it). */
export const owned = (orders: Order[], product: Product) => orders.some((order) => order.productId === product.id && ['Paid', 'Points', 'Sent'].includes(order.status))

/** The badge in the corner of a product: what is scarce or different about it, and that they own it once they do. */
export function badgeOf(product: Product, orders: Order[]): Badge | null {
  if (owned(orders, product)) return { text: 'You own this', tone: 'on' }
  if (product.status === 'Pre-order') return { text: 'Pre-order', tone: 'gold' }
  if (product.status === 'On request') return { text: 'Made to order', tone: 'gold' }
  if (soldOut(product)) return { text: 'Sold out' }
  if (product.editionOf && product.left !== null) return { text: `${product.left} of ${product.editionOf} left` }
  if (product.editionOf) return { text: `Edition of ${product.editionOf}` }
  if (product.left !== null) return { text: `${product.left} left` }
  if (product.limited) return { text: 'Limited' }
  return null
}

/** A price, in points: 0 is free, and null is something with no price yet. */
export function pointsOf(product: Product): number | null {
  if (wayOf(product) === 'reserve') return null
  return Math.max(0, Math.round(product.points ?? 0))
}

/** The same in dollars, as it is shown: "$1,200", "Free", or nothing for something with no price yet (or whose price is for someone logged in). */
export function priceOf(product: Product): string {
  const points = pointsOf(product)
  return product.priceHidden || points === null ? '' : points === 0 ? 'Free' : fmtCents(priceCents(product))
}

/** What so many points take off a price, in cents. */
export const offCents = (points: number) => points * (100 / POINTS_PER_DOLLAR)

/** Along the foot there is room for a few words: "Workspace, Ferrari Red" goes by "Ferrari Red". */
export const shortOf = (name: string) => (name.includes(', ') ? name.slice(name.indexOf(', ') + 2) : name)

/** "3/5", as the server numbers an edition, said as "No. 3 of 5". */
export const editionOf = (number: string) => (number ? `No. ${number.replace('/', ' of ')}` : '')

/** What an order came to, in words: "$680 + 8,400 points", "$40", "1,000 points", or nothing. */
export const paidOf = (order: Pick<Order, 'points' | 'paid'>) => [order.paid ? fmtCents(Math.round(order.paid * 100)) : '', order.points ? `${fmtPoints(order.points)} points` : ''].filter(Boolean).join(' + ')

/** Who a product is kept to, as its panel says it: "Shrug 1 LPs only". */
export const keptOf = (product: Product) => (keptTo(product).length ? `${keptTo(product).join(', ')} only` : '')

export { has }
