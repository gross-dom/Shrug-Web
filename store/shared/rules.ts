// The store's rules, in one place: who sees what, what a thing costs, and how it is got. The server decides
// by these, and the page draws by them, so the two can never tell a member different things. Nothing here
// reads or writes anything: each is a plain answer to a plain question.
//
// How a price works. Everything has a price in dollars, kept in Airtable as points (10 points are $1, so
// 10,000 points is $1,000). A member pays in dollars, and may bring the price down with their points, as
// many or as few as they like. Some things have a floor: however many points are used, at least that much
// is paid in dollars. Postage is added on top. A chair at 10,000 points with a floor of $450 and $70
// postage is $1,070 with no points, and $520 with 5,500 of them, which is the least it can cost.

/** 10 points are $1. */
export const POINTS_PER_DOLLAR = 10

// Who is asking. There are three kinds of person, and the same rules answer for each:
//   a visitor        nobody signed in. They are shown what is for Everyone, at its price, and no points
//   a standard user  signed in, and not on Shrug's list: a member with no Role. They are given a few points
//                    to begin with, and see what a visitor sees
//   someone listed   a member with a Role (Founder, LP, Investor), and for an LP the funds they are in
// Documents are a matter apart: they are what Shrug has written to its LPs, and only an LP is ever shown one.

/** What someone who signs in without being on the list is given to begin with: 100 points, which is $10. */
export const STARTING_POINTS = 100
/** The tier of a member who is not on the list. Their card is the standard one. */
export const STANDARD_TIER = 'standard'
/** What a member's card is printed on: one of three metals, or the standard card's black stock. */
export type Stock = 'silver' | 'gold' | 'black' | 'standard'
/** The stock for a tier: gold, black and standard are themselves, and anything else is silver. */
export const stockOf = (tier: string): Stock => (tier === 'gold' || tier === 'black' || tier === STANDARD_TIER ? tier : 'silver')
/** Nobody signed in, as the rules see them: in no group at all. */
export const VISITOR: Pick<Member, 'roles' | 'funds'> = { roles: [], funds: [] }

export const isLP = (member: Pick<Member, 'roles'>): boolean => member.roles.includes('LP')

// Signing in. An email comes first, and says which way someone gets in:
//   nobody's yet     a phone number is asked for and texted six digits: that makes the account
//   a number on file six digits are texted to it
//   otherwise        six digits are emailed. Someone on the list always confirms their inbox once before a
//                    number counts for them; and an account with no number is only ever opened by its inbox
// A number belongs to one account. See api/start.ts, api/text.ts, api/verify.ts and api/phone.ts.

/** A phone number as it is kept and texted: a plus, the country's code and the number, with nothing between
 * them (+14155550134). A number typed with no country is taken to be an American one. Null: not a number. */
export function phoneOf(typed: unknown): string | null {
  if (typeof typed !== 'string') return null
  const said = typed.trim()
  const digits = said.replace(/\D/g, '')
  const whole = said.startsWith('+') ? digits : said.startsWith('00') ? digits.slice(2) : digits.length === 10 ? `1${digits}` : digits.length === 11 && digits.startsWith('1') ? digits : ''
  return whole.length >= 8 && whole.length <= 15 && !whole.startsWith('0') ? `+${whole}` : null
}

/** The end of a number, to say where a code went without saying the number. */
export const endOf = (phone: string): string => phone.slice(-2)

/** An email address with most of its name hidden: j•••••@example.com. */
export const hidden = (email: string): string => email.replace(/^(.)[^@]*/, '$1•••••')

/** A member's picture: one of Shrug's own faces, by its name, or a photo of theirs, by where it is. */
export type Picture = { face: string } | { url: string }

/** What an account still lacks: a phone number to sign in with, and a name and picture of its own. */
export interface Needs {
  phone: boolean
  profile: boolean
}

/** How whoever is signed in proved who they are: a texted code, a code to their inbox, their personal link, or a payment. */
export type Via = 'text' | 'inbox' | 'link' | 'pay'

export interface Member {
  id: string
  name: string
  first: string
  /** Founder, LP, Investor: any of them. */
  roles: string[]
  /** The Shrug funds they are an LP in: "Shrug 1" … */
  funds: string[]
  /** gold, black, standard (not on the list), or anything else for silver: see stockOf. */
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
  /** Its price, in points (10 to the dollar), or null where it has none yet. */
  points: number | null
  /** The least that is paid in dollars, however many points are used. */
  floor: number | null
  postage: number | null
  description: string
  /** Where its picture is, if it has one: the first of its pictures. */
  picture: string | null
  /** Every picture it has, the first first. A product's own screen pages through them. */
  pictures?: string[]
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
  /** For a document: every member is shown it in Updates, and those it is not written for may ask for it. */
  listed?: boolean
  /** For a document: the heading it is listed under in Updates. */
  group?: string
  /** When it was added to the store, as a date and time: an update is dated by it. */
  added?: string | null
}

/** An update: a document, as one member is shown it. Not for sale, so not in the store.
 *   open       theirs to read
 *   locked     theirs to unlock: it has a price in points, and they have not paid it yet
 *   request    listed to them, but written for others: they may ask
 *   requested  they have asked
 *   soon       listed, with no file yet */
export type UpdateState = 'open' | 'locked' | 'request' | 'requested' | 'soon'

export interface Update {
  id: string
  name: string
  /** The heading it is under: Funds, SPVs. */
  group: string
  /** Who it was written for, as its second line says it: "Everyone on the list", "Shrug 1 LPs". */
  forWhom: string
  state: UpdateState
  /** What it costs to unlock, in points: nothing for one that is simply theirs to read. */
  points: number
  /** When it was added, as a date and time, where that is known. */
  date: string | null
}

export const UPDATE_GROUPS = ['Funds', 'SPVs']

/** A document as an update for one member, or null where they are not shown it at all. */
export function updateOf(member: Pick<Member, 'roles' | 'funds'>, product: Product, orders: Pick<Order, 'productId' | 'status'>[]): Update | null {
  // Only an LP is shown an update, or told that one exists: not its name, and not that it can be asked for
  if (product.kind !== 'Document' || !isLP(member)) return null
  const theirs = canSee(member, product)
  if (!theirs && !product.listed) return null
  // Theirs to read once it has a file. One with a price is unlocked first, with points; one written for
  // others is asked for
  const state: UpdateState = !product.hasFile ? 'soon' : theirs && (free(product) || has(orders, product)) ? 'open' : theirs ? 'locked' : has(orders, product) ? 'requested' : 'request'
  return { id: product.id, name: product.name, group: product.group || UPDATE_GROUPS[0]!, forWhom: product.visibleTo.includes('Everyone') ? 'Everyone on the list' : product.visibleTo.join(', '), state, points: Math.max(0, Math.round(product.points ?? 0)), date: product.added ?? null }
}

/** An address kept on file is a few lines of text: a name, a street, a city. Two lines at least. */
export const onFile = (shipTo: string | null | undefined): shipTo is string => !!shipTo && shipTo.split('\n').filter((line) => line.trim()).length >= 2

export type OrderStatus = 'Paid' | 'Points' | 'Pre-order' | 'Ready' | 'Requested' | 'Needs review' | 'Sent' | 'Refunded'

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

/** Whether a member may be handed a product at all: what they can see, and for a document only if they are an LP.
 * "Everyone" on a document means every LP. It was written when everyone was on the list, and anyone can sign
 * in now, so a box ticked in Airtable cannot by itself put an LP update in front of the public. */
export const mayHave = (member: Pick<Member, 'roles' | 'funds'>, product: Pick<Product, 'visibleTo' | 'kind'>): boolean =>
  canSee(member, product) && (product.kind !== 'Document' || isLP(member))

/** The groups a product is kept to, for the label on it: nothing where everyone sees it. */
export const keptTo = (product: Pick<Product, 'visibleTo'>): string[] => (product.visibleTo.includes('Everyone') ? [] : product.visibleTo)

type Priced = Pick<Product, 'points' | 'floor' | 'postage'>

/** The price, in cents, before any points and without postage. */
export const priceCents = (product: Pick<Product, 'points'>): number => Math.max(0, Math.round(product.points ?? 0)) * (100 / POINTS_PER_DOLLAR)
/** The floor, in cents: never more than the price. */
export const floorCents = (product: Priced): number => Math.min(priceCents(product), Math.max(0, Math.round((product.floor ?? 0) * 100)))
export const postageCents = (product: Priced): number => Math.max(0, Math.round((product.postage ?? 0) * 100))

/** The most points a member can put towards it: what they have, or what takes the price down to its floor. */
export const mostPoints = (member: Pick<Member, 'points'>, product: Priced): number =>
  Math.max(0, Math.min(Math.floor(member.points), Math.floor((priceCents(product) - floorCents(product)) / (100 / POINTS_PER_DOLLAR))))

/** What is left to pay, in cents, with so many points used: the price less the points, and the postage. */
export const dueCents = (product: Priced, points: number): number => priceCents(product) - points * (100 / POINTS_PER_DOLLAR) + postageCents(product)

/** The least a card payment can be. Under it, the points are eased off until the payment is this much or nothing. */
export const LEAST_PAYMENT = 50

/** The nearest number of points to the one wanted that can really be used: whole, no more than the most,
 * and never leaving a payment too small to take. */
export function fitPoints(member: Pick<Member, 'points'>, product: Priced, wanted: number): number {
  let points = Math.max(0, Math.min(mostPoints(member, product), Math.round(wanted)))
  const due = dueCents(product, points)
  if (due > 0 && due < LEAST_PAYMENT) points = Math.max(0, points - Math.ceil((LEAST_PAYMENT - due) / (100 / POINTS_PER_DOLLAR)))
  return points
}

/** How a product is got.
 *   request  no buying: the member asks, and Shrug writes back
 *   reserve  a pre-order with no price yet: a place is kept, and nothing is taken
 *   buy      dollars, less whatever points are used; with enough points, and no floor or postage, nothing to pay */
export type Way = 'request' | 'reserve' | 'buy'

export function wayOf(product: Pick<Product, 'status' | 'points'>): Way {
  if (product.status === 'On request') return 'request'
  if (product.status === 'Pre-order' && !product.points) return 'reserve'
  return 'buy'
}

/** Whether it is posted, so that somewhere to send it is needed. A document is a download, and a request is only a question. */
export function asksAddress(product: Pick<Product, 'kind' | 'status' | 'points' | 'floor' | 'postage' | 'needsAddress'>): boolean {
  if (product.kind === 'Document' || wayOf(product) !== 'buy') return false
  return product.needsAddress || postageCents(product) > 0
}

export const soldOut = (product: Pick<Product, 'left'>): boolean => product.left !== null && product.left <= 0

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
export const free = (product: Pick<Product, 'kind' | 'status' | 'points' | 'floor' | 'postage'>): boolean => product.kind === 'Document' && wayOf(product) === 'buy' && priceCents(product) + postageCents(product) === 0

/** Why an order cannot be placed, or null when it can. The page shows these; the server refuses by them. */
export type Refusal = 'hidden' | 'sold-out' | 'points' | 'option' | 'address' | 'already'

/** What is asked for: the points to use, the choice made, and (where nothing is left to pay, so no payment
 * will give one) where to send it. */
export interface Asking {
  option?: string
  points?: number
  address?: Address | null
  /** The address the member has on file, which does as well. */
  shipTo?: string | null
}

export function refusalOf(member: Member, product: Product, orders: Order[], asked: Asking): Refusal | null {
  if (!mayHave(member, product)) return 'hidden'
  const way = wayOf(product)
  // One request, one reservation and one copy of a document each
  if ((way !== 'buy' || product.kind === 'Document') && has(orders, product)) return 'already'
  if (way === 'request') return null
  if (soldOut(product)) return 'sold-out'
  if (product.options.length && !product.options.includes(asked.option ?? '')) return 'option'
  if (way === 'reserve') return null
  const points = asked.points ?? 0
  if (!Number.isInteger(points) || points !== fitPoints(member, product, points)) return 'points'
  // Something to pay: Apple Pay or the card form gives the address, at the payment
  if (dueCents(product, points) === 0 && asksAddress(product) && !complete(asked.address) && !onFile(asked.shipTo)) return 'address'
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

/** Cents as dollars, for showing: $520, or $39.50. */
export const fmtCents = (cents: number) => fmtDollars(cents / 100)
export const fmtPoints = (points: number) => points.toLocaleString('en-US')
export const fmtDollars = (dollars: number) => (Number.isInteger(dollars) ? `$${dollars.toLocaleString('en-US')}` : `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
