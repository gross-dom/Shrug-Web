import { floorCents, fmtCents, fmtPoints, has, keptTo, mostPoints, POINTS_PER_DOLLAR, priceCents, soldOut, wayOf, type Order, type Product } from '../shared/rules'

// What the store says about a product, in the design's own words: its badge, its price as a label, and the
// short name it goes by along the foot.

export interface Badge {
  text: string
  /** gold: Pre-order and Made to order. on: Yours. */
  tone?: 'gold' | 'on'
}

/** Whether a member has bought it (a request or a reservation is not having it). */
export const owned = (orders: Order[], product: Product) => orders.some((order) => order.productId === product.id && ['Paid', 'Points', 'Sent'].includes(order.status))

/** The badge in the corner of a product: what is scarce or different about it, and Yours once they have it. */
export function badgeOf(product: Product, orders: Order[]): Badge | null {
  if (owned(orders, product)) return { text: 'Yours', tone: 'on' }
  if (product.status === 'Pre-order') return { text: 'Pre-order', tone: 'gold' }
  if (product.status === 'On request') return { text: 'Made to order', tone: 'gold' }
  if (soldOut(product)) return { text: 'Sold out' }
  if (product.editionOf && product.left !== null) return { text: `${product.left} of ${product.editionOf} left` }
  if (product.editionOf) return { text: `Edition of ${product.editionOf}` }
  if (product.left !== null) return { text: `${product.left} left` }
  if (product.limited) return { text: 'Limited' }
  return null
}

/** A price as it is said beside a name: "$1,450", "Free", or nothing for something with no price yet. */
export function priceOf(product: Product): string {
  if (wayOf(product) === 'reserve') return ''
  const cents = priceCents(product)
  return cents === 0 ? 'Free' : fmtCents(cents)
}

/** Along the foot there is room for a few words: "Workspace Chair, Ferrari Red" goes by "Ferrari Red". */
export const shortOf = (name: string) => (name.includes(', ') ? name.slice(name.indexOf(', ') + 2) : name)

/** "3/5", as the server numbers an edition, said as "No. 3 of 5". */
export const editionOf = (number: string) => (number ? `No. ${number.replace('/', ' of ')}` : '')

/** What an order came to: "8,400 pts + $680", "$40", "1,000 pts", or nothing. */
export const paidOf = (order: Pick<Order, 'points' | 'paid'>) => [order.points ? `${fmtPoints(order.points)} pts` : '', order.paid ? fmtCents(Math.round(order.paid * 100)) : ''].filter(Boolean).join(' + ')

const NOUN: Record<string, string> = { Book: 'book', Chair: 'chair', Art: 'piece', Document: 'document', Other: 'item' }

/** The small print under the button: how far points go on it, what would be left, and which of an edition it would be. */
export function captionOf(product: Product, balance: number, points: number, due: number, number: string): string {
  const said: string[] = []
  const floor = floorCents(product)
  const price = priceCents(product)
  const cover = (price - floor) / (100 / POINTS_PER_DOLLAR)
  const most = mostPoints({ points: balance }, product)
  if (floor > 0 && floor < price) {
    const dollars = fmtCents(price - floor)
    said.push(balance >= cover ? `${dollars} is the most points can cover on this ${NOUN[product.kind]}.` : `Points can cover up to ${dollars} of this ${NOUN[product.kind]}.`)
  } else if (points > 0 && due === 0) said.push('Your points cover it.')
  if (points > 0 && (due === 0 || balance > most)) said.push(`You’d have ${fmtPoints(balance - points)} left.`)
  if (number) said.push(`Yours would be ${editionOf(number)}.`)
  return said.join(' ')
}

/** Who a product is kept to, as its panel says it: "Shrug 1 LPs only". */
export const keptOf = (product: Product) => (keptTo(product).length ? `${keptTo(product).join(', ')} only` : '')

export { has }
