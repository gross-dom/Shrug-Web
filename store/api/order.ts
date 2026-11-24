import { F, str } from './_lib/airtable.js'
import { ordersFor, productOf, shelvesFor } from './_lib/catalogue.js'
import { json, read, text } from './_lib/http.js'
import { keepAddress, tidied } from './_lib/members.js'
import { request as ask, reserve, settle, withPoints } from './_lib/orders.js'
import { memberAsking, trouble } from './_lib/who.js'
import { dueCents, has, onFile, refusalOf, updateOf, wayOf, type Address } from '../shared/rules.js'

const addressOf = (given: unknown): Address | null => {
  if (!given || typeof given !== 'object') return null
  const a = given as Record<string, unknown>
  return { name: text(a.name), line1: text(a.line1), line2: text(a.line2), city: text(a.city), region: text(a.region), postcode: text(a.postcode, 20), country: text(a.country, 60) }
}

// An order. Either the page says a payment has been made, and the store asks Stripe whether it has; or it
// asks for something that takes no money: a request, a reservation, or a thing whose price the member's
// points cover in full.
export async function POST(request: Request) {
  try {
    const who = await memberAsking(request)
    if ('refuse' in who) return who.refuse
    const body = await read(request)

    const payment = text(body.payment, 80)
    if (payment) {
      const settled = await settle(payment, who.row.id)
      return 'error' in settled ? json(settled, { status: 400 }) : json({ ok: true, ...settled })
    }

    const { products, rows } = await shelvesFor(who.member)
    const product = products.find((p) => p.id === text(body.product, 40))
    const productRow = rows.find((row) => row.id === product?.id)
    const { orders } = await ordersFor(who.member.id, rows)
    if (!product || !productRow) {
      // An update listed to everyone but written for others can be asked for, once. Anything else they may
      // not see is, to them, not there
      const listedRow = rows.find((row) => row.id === text(body.product, 40))
      const listed = listedRow ? productOf(listedRow) : null
      const update = listed ? updateOf(who.member, listed, orders) : null
      if (!listedRow || !listed || !update) return json({ error: 'hidden' }, { status: 404 })
      if (update.state !== 'request') return json({ error: has(orders, listed) ? 'already' : 'hidden' }, { status: 400 })
      return json({ ok: true, ...(await ask(who.row, listedRow, listed, '')) })
    }
    const option = text(body.option, 60)
    const address = addressOf(body.address)
    const points = typeof body.points === 'number' ? body.points : 0
    // An address typed with the order is kept on file; with none typed, the one on file is where it goes
    const typed = tidied(body.shipTo)
    const shipTo = onFile(typed) ? typed : str(who.row.fields[F.member.shipTo]).trim()
    if (onFile(typed) && typed !== str(who.row.fields[F.member.shipTo]).trim()) await keepAddress(who.row, typed)
    const refusal = refusalOf(who.member, product, orders, { option, points, address, shipTo })
    if (refusal) return json({ error: refusal }, { status: 400 })

    const way = wayOf(product)
    // Dollars are owed: that is /api/pay and then a payment, never this
    if (way === 'buy' && dueCents(product, points) > 0) return json({ error: 'pay' }, { status: 400 })
    const placed = way === 'request' ? await ask(who.row, productRow, product, option) : way === 'reserve' ? await reserve(who.row, productRow, product, option) : await withPoints(who.row, productRow, product, option, points, address ?? (onFile(shipTo) ? shipTo : null))
    return json({ ok: true, ...placed })
  } catch (error) {
    return trouble('order', error)
  }
}
