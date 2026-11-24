import { ordersFor, shelvesFor, updatesFor } from './_lib/catalogue.js'
import { env } from './_lib/env.js'
import { json } from './_lib/http.js'
import { noSessionCookie, signedIn } from './_lib/session.js'
import { cardOf, memberOf, rowOf } from './_lib/members.js'
import { trouble } from './_lib/who.js'

// Everything the pages are drawn from, for whoever is asking: what is in the store for them, the updates
// they are shown (documents are not for sale, and are not among the products), what they have ordered,
// and their card, balance and address.
export async function GET(request: Request) {
  try {
    const email = signedIn(request)
    if (!email) return json({ status: 'anon' }, { headers: { 'Set-Cookie': noSessionCookie() } })
    const row = await rowOf(email)
    if (!row) return json({ status: 'applied' })
    const member = memberOf(row)
    const { products, rows } = await shelvesFor(member)
    const { orders } = await ordersFor(member.id, rows)
    const card = cardOf(row)
    return json({
      status: 'member',
      member: { ...member, number: card.number, since: card.since, reason: card.reason, emails: card.emails, email: card.email, shipTo: card.shipTo },
      products: products.filter((product) => product.kind !== 'Document'),
      updates: updatesFor(member, rows, orders),
      orders,
      stripeKey: env.stripePublic,
    })
  } catch (error) {
    return trouble('store', error)
  }
}
