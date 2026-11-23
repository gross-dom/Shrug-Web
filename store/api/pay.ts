import { ordersFor, shelvesFor } from './_lib/catalogue.js'
import { json, read, text } from './_lib/http.js'
import { newIntent } from './_lib/stripe.js'
import { memberAsking, trouble } from './_lib/who.js'
import { centsOf, refusalOf, wayOf } from '../shared/rules.js'

// The start of a payment: for something with a floor, the store asks Stripe for a payment of exactly the
// floor and the postage, and hands the page what it needs to take it. The amount is the store's own, read
// from Airtable now: nothing the page says about a price is used.
export async function POST(request: Request) {
  try {
    const who = await memberAsking(request)
    if ('refuse' in who) return who.refuse
    const body = await read(request)
    const { products, rows } = await shelvesFor(who.member)
    const product = products.find((p) => p.id === text(body.product, 40))
    if (!product) return json({ error: 'hidden' }, { status: 404 })
    if (wayOf(product) !== 'pay') return json({ error: 'pay' }, { status: 400 })
    const { orders } = await ordersFor(who.member.id, rows)
    const option = text(body.option, 60)
    const refusal = refusalOf(who.member, product, orders, { option })
    if (refusal) return json({ error: refusal }, { status: 400 })
    const intent = await newIntent(centsOf(product), { member: who.row.id, email: who.email, product: product.id, option, points: String(product.points ?? 0), name: product.name })
    return json({ ok: true, clientSecret: intent.client_secret, payment: intent.id })
  } catch (error) {
    return trouble('pay', error)
  }
}
