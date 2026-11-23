// The store's rules, in one place: who sees what, what a thing costs, and how it is got. The server decides
// by these, and the page draws by them, so the two can never tell a member different things. Nothing here
// reads or writes anything: each is a plain answer to a plain question.

/** 10 points are $1. */
export const POINTS_PER_DOLLAR = 10

export interface Member {
  id: string
  name: string
  first: string
  /** Founder, LP, Investor: any of them. */
  roles: string[]
  /** The Shrug funds they are an LP in: "Shrug 1" … */
  funds: string[]
  /** gold, black, or anything else for silver. */
  tier: string
  points: number
}

export type Kind = 'Book' | 'Chair' | 'Art' | 'Document' | 'Other'
export type Status = 'Available' | 'Pre-order' | 'On request'

export interface Product {
  id: string
  name: string
  kind: Kind
  status: Status
  /** The groups that see it; "Everyone" among them means every member. */
  visibleTo: string[]
  /** What it costs in points, or null where it takes none. */
  points: number | null
  /** The floor: dollars still paid on top of the points. */
  price: number | null
  postage: number | null
  description: string
  /** Where its picture is, if it has one. */
  picture: string | null
  /** A Document whose file has been supplied. */
  hasFile: boolean
  /** Choices the buyer picks one of (a chair's colours). */
  options: string[]
  /** For a numbered edition, how many exist. */
  editionOf: number | null
  /** How many remain, or null where there is no limit. */
  left: number | null
  limited: boolean
  needsAddress: boolean
  place: number
}

export type OrderStatus = 'Paid' | 'Points' | 'Pre-order' | 'Requested' | 'Needs review' | 'Sent' | 'Refunded'

export interface Order {
  id: string
  reference: string
  status: OrderStatus
  productId: string
  productName: string
  option: string
  /** "2/3" for one of a numbered edition. */
  number: string
  points: number
  paid: number
  placed: string
}

export interface Address {
  name: string
  line1: string
  line2: string
  city: string
  region: string
  postcode: string
  country: string
}

/** The groups a member is in, as Products → Visible to names them. */
export function groupsOf(member: Pick<Member, 'roles' | 'funds'>): string[] {
  const groups: string[] = []
  if (member.roles.includes('Founder')) groups.push('Founders')
  if (member.roles.includes('LP')) groups.push('LPs')
  if (member.roles.includes('Investor')) groups.push('Investors')
  // "Shrug 1" in Members → Funds is the group "Shrug 1 LPs"
  for (const fund of member.funds) groups.push(`${fund} LPs`)
  return groups
}

/** Whether a member is shown a product. One that nobody is ticked for is shown to nobody. */
export function canSee(member: Pick<Member, 'roles' | 'funds'>, product: Pick<Product, 'visibleTo'>): boolean {
  if (product.visibleTo.includes('Everyone')) return true
  const groups = groupsOf(member)
  return product.visibleTo.some((group) => groups.includes(group))
}

/** The groups a product is kept to, for the label on it: nothing where everyone sees it. */
export const keptTo = (product: Pick<Product, 'visibleTo'>): string[] => (product.visibleTo.includes('Everyone') ? [] : product.visibleTo)

/** Dollars to pay: the floor and the postage together. */
export const dollarsOf = (product: Pick<Product, 'price' | 'postage'>): number => round2((product.price ?? 0) + (product.postage ?? 0))

/** The same in cents, which is how a payment is counted. */
export const centsOf = (product: Pick<Product, 'price' | 'postage'>): number => Math.round(dollarsOf(product) * 100)

const round2 = (n: number) => Math.round(n * 100) / 100

/** How a product is got.
 *   request  no buying: the member asks, and Shrug writes back
 *   reserve  a pre-order with no price yet: a place is kept, and nothing is taken
 *   pay      points, and dollars by Apple Pay or card
 *   points   points alone (or nothing at all, for something that costs none) */
export type Way = 'request' | 'reserve' | 'pay' | 'points'

export function wayOf(product: Pick<Product, 'status' | 'points' | 'price' | 'postage'>): Way {
  if (product.status === 'On request') return 'request'
  if (product.status === 'Pre-order' && !product.points && dollarsOf(product) === 0) return 'reserve'
  return dollarsOf(product) > 0 ? 'pay' : 'points'
}

/** Whether the store has to be told where to send it. A document is a download, and a request is only a question. */
export function asksAddress(product: Pick<Product, 'kind' | 'status' | 'points' | 'price' | 'postage' | 'needsAddress'>): boolean {
  const way = wayOf(product)
  if (product.kind === 'Document' || way === 'request' || way === 'reserve') return false
  return product.needsAddress || way === 'pay'
}

export const soldOut = (product: Pick<Product, 'left'>): boolean => product.left !== null && product.left <= 0

/** How many points short of it a member is: 0 when they have enough. */
export const shortBy = (member: Pick<Member, 'points'>, product: Pick<Product, 'points'>): number => Math.max(0, (product.points ?? 0) - member.points)

/** Which of an edition the next one sold is: the 3rd of 10 when 8 remain. Empty for anything not numbered. */
export function numberOf(product: Pick<Product, 'editionOf' | 'left'>): string {
  if (!product.editionOf) return ''
  const left = product.left ?? product.editionOf
  return `${Math.max(1, product.editionOf - left + 1)}/${product.editionOf}`
}

/** A document a member already has is theirs to download, not to get again. */
export const has = (orders: Pick<Order, 'productId' | 'status'>[], product: Pick<Product, 'id'>): boolean =>
  orders.some((order) => order.productId === product.id && order.status !== 'Refunded')

/** A document that costs nothing is anyone's who may see it: there is nothing to buy first. */
export const free = (product: Pick<Product, 'kind' | 'status' | 'points' | 'price' | 'postage'>): boolean => product.kind === 'Document' && wayOf(product) === 'points' && !product.points

/** Why an order cannot be placed, or null when it can. The page shows these; the server refuses by them. */
export type Refusal = 'hidden' | 'sold-out' | 'short' | 'option' | 'address' | 'already'

export function refusalOf(member: Member, product: Product, orders: Order[], asked: { option?: string; address?: Address | null }): Refusal | null {
  if (!canSee(member, product)) return 'hidden'
  const way = wayOf(product)
  // One request, one reservation and one copy of a document each
  if ((way === 'request' || way === 'reserve' || product.kind === 'Document') && has(orders, product)) return 'already'
  if (way === 'request') return null
  if (soldOut(product)) return 'sold-out'
  if (product.options.length && !product.options.includes(asked.option ?? '')) return 'option'
  if (way === 'reserve') return null
  if (shortBy(member, product) > 0) return 'short'
  // A paid order is given its address by Apple Pay or the card form, at the payment
  if (way === 'points' && asksAddress(product) && !complete(asked.address)) return 'address'
  return null
}

export const complete = (address: Address | null | undefined): address is Address =>
  !!address && [address.name, address.line1, address.city, address.postcode, address.country].every((part) => typeof part === 'string' && part.trim().length > 0)

/** An address as it is written on a parcel. */
export const written = (address: Address): string =>
  [address.name, address.line1, address.line2, [address.city, address.region, address.postcode].filter(Boolean).join(', '), address.country]
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')

export const fmtPoints = (points: number) => points.toLocaleString('en-US')
export const fmtDollars = (dollars: number) => (Number.isInteger(dollars) ? `$${dollars.toLocaleString('en-US')}` : `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
