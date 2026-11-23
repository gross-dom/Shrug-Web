import { ordersFor, shelvesFor } from './_lib/catalogue.js'
import { env } from './_lib/env.js'
import { json } from './_lib/http.js'
import { noSessionCookie, signedIn } from './_lib/session.js'
import { cardOf, memberOf, rowOf } from './_lib/members.js'
import { trouble } from './_lib/who.js'

// The store, for whoever is asking: what they may see, what they have ordered, and their balance.
export async function GET(request: Request) {
  try {
    const email = signedIn(request)
    if (!email) return json({ status: 'anon' }, { headers: { 'Set-Cookie': noSessionCookie() } })
    const row = await rowOf(email)
    if (!row) return json({ status: 'applied' })
    const member = memberOf(row)
    const { products, rows } = await shelvesFor(member)
    const { orders } = await ordersFor(member.id, rows)
    return json({ status: 'member', member: { ...member, number: cardOf(row).number }, products, orders, stripeKey: env.stripePublic })
  } catch (error) {
    return trouble('store', error)
  }
}
