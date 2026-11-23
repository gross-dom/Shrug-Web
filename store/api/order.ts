import { ordersFor, shelvesFor } from './_lib/catalogue.ts'
import { json, read, text } from './_lib/http.ts'
import { request as ask, reserve, settle, withPoints } from './_lib/orders.ts'
import { memberAsking, trouble } from './_lib/who.ts'
import { refusalOf, wayOf, type Address } from '../shared/rules.ts'

const addressOf = (given: unknown): Address | null => {
  if (!given || typeof given !== 'object') return null
  const a = given as Record<string, unknown>
  return { name: text(a.name), line1: text(a.line1), line2: text(a.line2), city: text(a.city), region: text(a.region), postcode: text(a.postcode, 20), country: text(a.country, 60) }
}

// An order. Either the page says a payment has been made, and the store asks Stripe whether it has; or it
// asks for something that takes no money: a request, a reservation, or a thing bought with points alone.
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
    // Something they may not see is, to them, not there
    if (!product || !productRow) return json({ error: 'hidden' }, { status: 404 })
    const { orders } = await ordersFor(who.member.id, rows)
    const option = text(body.option, 60)
    const address = addressOf(body.address)
    const refusal = refusalOf(who.member, product, orders, { option, address })
    if (refusal) return json({ error: refusal }, { status: 400 })

    const way = wayOf(product)
    // Dollars are owed: that is /api/pay and then a payment, never this
    if (way === 'pay') return json({ error: 'pay' }, { status: 400 })
    const placed = way === 'request' ? await ask(who.row, productRow, product, option) : way === 'reserve' ? await reserve(who.row, productRow, product, option) : await withPoints(who.row, productRow, product, option, address)
    return json({ ok: true, ...placed })
  } catch (error) {
    return trouble('order', error)
  }
}
