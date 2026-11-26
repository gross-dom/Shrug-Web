import { ordersFor, shelvesFor, shelvesForAVisitor } from './_lib/catalogue.js'
import { json, read, text } from './_lib/http.js'
import { tidied } from './_lib/members.js'
import { payCookie, sessionOf } from './_lib/session.js'
import { newIntent } from './_lib/stripe.js'
import { memberAsking, trouble } from './_lib/who.js'
import { asksAddress, countOf, dueCents, onFile, refusalOf, soldOut, times, wayOf } from '../shared/rules.js'

// The start of a payment. The page says which product and how many points to use; the store works out
// what is then left to pay (the price less those points, never under the floor, and the postage), asks
// Stripe for a payment of exactly that, and hands the page what it needs to take it. The amount is the
// store's own, from Airtable as it is now: nothing the page says about a price is used.
//
// A visitor can pay too. Nobody is signed in, so they say where the receipt goes (their email) and, for
// something that is posted, where to send it (unless Apple Pay will say: `wallet`). They pay the price as it
// stands: points are a member's. The payment, once made, makes their account (api/order.ts). Only what is
// bought with money can be had this way: asking, reserving and anything that costs nothing need an account.
async function fromAVisitor(body: Record<string, unknown>) {
  const email = text(body.email, 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'email' }, { status: 400 })
  const product = (await shelvesForAVisitor()).find((p) => p.id === text(body.product, 40))
  if (!product) return json({ error: 'hidden' }, { status: 404 })
  // (so many of it, for a book: the price of the lot)
  const count = countOf(product, body.count)
  const due = dueCents(times(product, count), 0)
  if (wayOf(product) !== 'buy' || due <= 0) return json({ error: 'anon' }, { status: 401 })
  if (soldOut(product)) return json({ error: 'sold-out' }, { status: 400 })
  const option = text(body.option, 60)
  if (product.options.length && !product.options.includes(option)) return json({ error: 'option' }, { status: 400 })
  const shipTo = tidied(body.shipTo)
  if (asksAddress(product) && !onFile(shipTo) && body.wallet !== true) return json({ error: 'address' }, { status: 400 })
  // (their name, as they gave it at checkout: the account the payment makes is under it)
  const buyer = text(body.name, 80)
  const intent = await newIntent(due, { member: '', visitor: '1', email, buyer, product: product.id, option, count: String(count), points: '0', name: product.name, shipTo })
  return json({ ok: true, clientSecret: intent.client_secret, payment: intent.id, cents: due }, { headers: { 'Set-Cookie': payCookie(intent.id) } })
}

export async function POST(request: Request) {
  try {
    const body = await read(request)
    if (!sessionOf(request)) return await fromAVisitor(body)
    const who = await memberAsking(request)
    if ('refuse' in who) return who.refuse
    const { products, rows } = await shelvesFor(who.member)
    const product = products.find((p) => p.id === text(body.product, 40))
    if (!product) return json({ error: 'hidden' }, { status: 404 })
    if (wayOf(product) !== 'buy') return json({ error: 'pay' }, { status: 400 })
    const { orders } = await ordersFor(who.member.id, rows)
    const option = text(body.option, 60)
    const points = typeof body.points === 'number' ? body.points : 0
    const count = countOf(product, body.count)
    const lot = times(product, count)
    const refusal = refusalOf(who.member, lot, orders, { option, points })
    if (refusal) return json({ error: refusal }, { status: 400 })
    const due = dueCents(lot, points)
    // Nothing left to pay is an order, not a payment
    if (due <= 0) return json({ error: 'pay' }, { status: 400 })
    const intent = await newIntent(due, { member: who.row.id, email: who.email, product: product.id, option, count: String(count), points: String(points), name: product.name })
    return json({ ok: true, clientSecret: intent.client_secret, payment: intent.id, cents: due })
  } catch (error) {
    return trouble('pay', error)
  }
}
