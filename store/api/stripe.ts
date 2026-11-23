import { json } from './_lib/http.js'
import { settle } from './_lib/orders.js'
import { fromStripe } from './_lib/stripe.js'
import { trouble } from './_lib/who.js'

// Stripe's own word that a payment arrived. The page says so too, the moment it happens; this is for the
// payment whose page was closed before it could. Either way the order is made once (see settle).
export async function POST(request: Request) {
  try {
    const raw = await request.text()
    if (!fromStripe(raw, request.headers.get('stripe-signature'))) return json({ error: 'signature' }, { status: 400 })
    const event = JSON.parse(raw)
    if (event?.type === 'payment_intent.succeeded' && typeof event.data?.object?.id === 'string') await settle(event.data.object.id)
    return json({ received: true })
  } catch (error) {
    return trouble('stripe', error)
  }
}
