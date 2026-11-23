import { ordersFor, shelvesFor } from './_lib/catalogue.js'
import { json, read, text } from './_lib/http.js'
import { newIntent } from './_lib/stripe.js'
import { memberAsking, trouble } from './_lib/who.js'
import { dueCents, refusalOf, wayOf } from '../shared/rules.js'

// The start of a payment. The page says which product and how many points to use; the store works out
// what is then left to pay (the price less those points, never under the floor, and the postage), asks
// Stripe for a payment of exactly that, and hands the page what it needs to take it. The amount is the
// store's own, from Airtable as it is now: nothing the page says about a price is used.
export async function POST(request: Request) {
  try {
    const who = await memberAsking(request)
    if ('refuse' in who) return who.refuse
    const body = await read(request)
    const { products, rows } = await shelvesFor(who.member)
    const product = products.find((p) => p.id === text(body.product, 40))
    if (!product) return json({ error: 'hidden' }, { status: 404 })
    if (wayOf(product) !== 'buy') return json({ error: 'pay' }, { status: 400 })
    const { orders } = await ordersFor(who.member.id, rows)
    const option = text(body.option, 60)
    const points = typeof body.points === 'number' ? body.points : 0
    const refusal = refusalOf(who.member, product, orders, { option, points })
    if (refusal) return json({ error: refusal }, { status: 400 })
    const due = dueCents(product, points)
    // Nothing left to pay is an order, not a payment
    if (due <= 0) return json({ error: 'pay' }, { status: 400 })
    const intent = await newIntent(due, { member: who.row.id, email: who.email, product: product.id, option, points: String(points), name: product.name })
    return json({ ok: true, clientSecret: intent.client_secret, payment: intent.id, cents: due })
  } catch (error) {
    return trouble('pay', error)
  }
}
