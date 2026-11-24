import { randomInt } from 'node:crypto'
import { add, all, change, F, num, one, remove, str, T, type Row } from './airtable.js'
import { keepAddress, rowFor } from './members.js'
import { orderOf, productOf } from './catalogue.js'
import { intentOf, type Intent } from './stripe.js'
import { dueCents, fitPoints, numberOf, soldOut, wayOf, written, type Address, type Order, type OrderStatus, type Product } from '../../shared/rules.js'

// Placing an order: the row in Orders, the points off the balance, and one fewer on the shelf.

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const reference = () => 'SV-' + Array.from({ length: 6 }, () => LETTERS[randomInt(LETTERS.length)]).join('')

interface Placing {
  member: Row
  productRow: Row
  product: Product
  status: OrderStatus
  option: string
  shipTo: string
  /** Dollars taken, and Stripe's reference for them. */
  paid?: number
  payment?: string
  /** Points to take from the balance. */
  points?: number
  /** Whether the shelf counts down and an edition is numbered (not for a request, a reservation, or an order to be looked at by hand). */
  takes: boolean
}

async function place({ member, productRow, product, status, option, shipTo, paid = 0, payment = '', points = 0, takes }: Placing): Promise<{ order: Order; points: number }> {
  const balance = num(member.fields[F.member.points]) ?? 0
  const row = await add(T.orders, {
    [F.order.reference]: reference(),
    [F.order.status]: status,
    [F.order.member]: [member.id],
    [F.order.product]: [productRow.id],
    [F.order.email]: str(member.fields[F.member.email]),
    [F.order.option]: option,
    [F.order.number]: takes ? numberOf(product) : '',
    [F.order.points]: points,
    [F.order.paid]: paid,
    [F.order.shipTo]: shipTo,
    [F.order.payment]: payment,
    [F.order.placed]: new Date().toISOString(),
  })
  const names = new Map([[productRow.id, product.name]])
  if (payment) {
    // A payment is settled once. The page and Stripe may both come to say it arrived, at the same moment:
    // each writes its row first, and only the earlier of the two goes on to take the points.
    const same = (await all(T.orders)).filter((other) => str(other.fields[F.order.payment]) === payment).sort((a, b) => a.id.localeCompare(b.id))
    const first = same[0]
    if (first && first.id !== row.id) {
      await remove(T.orders, row.id).catch(() => {})
      return { order: orderOf(first, names), points: balance }
    }
  }
  if (points > 0) {
    // The balance it was told of at the last email is brought down with it, so that the next rise is counted from here
    await change(T.members, member.id, { [F.member.points]: balance - points, [F.member.seenPoints]: balance - points, [F.member.notified]: balance - points })
  }
  if (takes && product.left !== null) await change(T.products, productRow.id, { [F.product.left]: Math.max(0, product.left - 1) })
  return { order: orderOf(row, names), points: balance - points }
}

/** A request for something sold on request: nothing is taken, and Shrug writes back. */
export const request = (member: Row, productRow: Row, product: Product, option: string) => place({ member, productRow, product, status: 'Requested', option, shipTo: '', takes: false })

/** A place kept for a pre-order that has no price yet. */
export const reserve = (member: Row, productRow: Row, product: Product, option: string) => place({ member, productRow, product, status: 'Pre-order', option, shipTo: '', takes: false })

/** Bought with nothing left to pay: the points cover it (or it costs nothing). */
export const withPoints = (member: Row, productRow: Row, product: Product, option: string, points: number, address: Address | string | null) =>
  place({ member, productRow, product, status: product.status === 'Pre-order' ? 'Pre-order' : 'Points', option, shipTo: !address ? '' : typeof address === 'string' ? address : written(address), points, takes: true })

const shipToOf = (intent: Intent) => {
  const to = intent.shipping
  if (!to) return ''
  const a = to.address ?? {}
  return written({ name: to.name ?? '', line1: a.line1 ?? '', line2: a.line2 ?? '', city: a.city ?? '', region: a.state ?? '', postcode: a.postal_code ?? '', country: a.country ?? '' })
}

/** A payment that Stripe says has arrived, made into its order. Asked twice of the same payment, it answers
 * with the same order. If the money is in but the order no longer adds up (the last one went, the points
 * were spent elsewhere meanwhile, or the price was changed), nothing more is taken and the order is marked
 * for Shrug to look at. */
export async function settle(paymentId: string, forMember?: string): Promise<{ order: Order; points: number; member: Row } | { error: 'unpaid' | 'unknown' }> {
  const intent = await intentOf(paymentId)
  if (intent.status !== 'succeeded') return { error: 'unpaid' }
  const productRow = await one(T.products, intent.metadata.product ?? '')
  if (!productRow) return { error: 'unknown' }
  // A visitor's payment (api/pay.ts): the email and address they paid with make their account, a standard
  // one, unless that address has one already, and the order is that account's
  const visitor = intent.metadata.visitor === '1' && !!intent.metadata.email
  const typed = (intent.metadata.shipTo ?? '').trim()
  const member = visitor ? (await rowFor(intent.metadata.email!, { shipTo: typed || shipToOf(intent) })).row : await one(T.members, intent.metadata.member ?? '')
  if (!member || (forMember && member.id !== forMember)) return { error: 'unknown' }
  const balance = num(member.fields[F.member.points]) ?? 0
  const already = (await all(T.orders)).find((row) => str(row.fields[F.order.payment]) === paymentId)
  if (already) return { order: orderOf(already, new Map([[productRow.id, str(productRow.fields[F.product.name])]])), points: balance, member }
  const product = productOf(productRow)
  // It goes to the address on file. With none, the one the payment gave is used, and kept for next time. (A
  // visitor's goes where they said this time, whatever an account of that address has on file: nobody has
  // shown the account is theirs)
  const kept = visitor ? '' : str(member.fields[F.member.shipTo]).trim()
  const shipTo = kept || typed || shipToOf(intent)
  if (!kept && shipTo && !str(member.fields[F.member.shipTo]).trim()) await keepAddress(member, shipTo).catch(() => {})
  const paid = intent.amount_received / 100
  const option = intent.metadata.option ?? ''
  // The points that were to be used are said on the payment itself, as the store wrote them when it began
  const points = Number(intent.metadata.points ?? 0)
  const sound = !!product && wayOf(product) === 'buy' && !soldOut(product) && Number.isInteger(points) && points === fitPoints({ points: balance }, product, points) && dueCents(product, points) === intent.amount_received
  if (!product || !sound) {
    const shown = product ?? ({ ...EMPTY, id: productRow.id, name: str(productRow.fields[F.product.name]) } as Product)
    return { ...(await place({ member, productRow, product: shown, status: 'Needs review', option, shipTo, paid, payment: paymentId, takes: false })), member }
  }
  return { ...(await place({ member, productRow, product, status: product.status === 'Pre-order' ? 'Pre-order' : 'Paid', option, shipTo, paid, payment: paymentId, points, takes: true })), member }
}

const EMPTY: Omit<Product, 'id' | 'name'> = {
  kind: 'Other', status: 'Available', visibleTo: [], points: null, floor: null, postage: null, description: '', picture: null, pictures: [], hasFile: false, options: [], editionOf: null, left: null, limited: false, needsAddress: false, place: 0,
}


