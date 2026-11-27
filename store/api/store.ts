import { ordersFor, shelvesFor, shelvesForAVisitor, updatesFor, updatesForAVisitor } from './_lib/catalogue.js'
import { env } from './_lib/env.js'
import { json } from './_lib/http.js'
import { noSessionCookie, sessionOf } from './_lib/session.js'
import { cardOf, memberOf, needsOf, rowOf } from './_lib/members.js'
import { trouble } from './_lib/who.js'

// Everything the pages are drawn from, for whoever is asking. A visitor (nobody signed in) is shown the
// store: what is for Everyone, at its price, and nothing of anybody's; and the updates anyone is shown (the
// ones that are for anyone, to read, and the listed ones by name, closed). A member is shown what is in the
// store for them, the updates they are shown (documents are not for sale and are not among the products: an
// LP's are an LP's alone), what they have ordered, and their card, balance and address.
export async function GET(request: Request) {
  try {
    const session = sessionOf(request)
    const row = session ? await rowOf(session.email) : null
    // Nobody signed in, or someone whose row has been taken out of Members: a visitor, with no session
    if (!row) return json({ status: 'visitor', products: await shelvesForAVisitor(), updates: await updatesForAVisitor(), stripeKey: env.stripePublic }, { headers: { 'Set-Cookie': noSessionCookie() } })
    const member = memberOf(row)
    const { products, rows } = await shelvesFor(member)
    const { orders } = await ordersFor(member.id, rows)
    const card = cardOf(row)
    return json({
      status: 'member',
      member: { ...member, number: card.number, since: card.since, reason: card.reason, emails: card.emails, email: card.email, shipTo: card.shipTo, picture: card.picture },
      needs: needsOf(row),
      via: session!.via,
      products: products.filter((product) => product.kind !== 'Document'),
      updates: updatesFor(member, rows, orders),
      orders,
      stripeKey: env.stripePublic,
    })
  } catch (error) {
    return trouble('store', error)
  }
}
