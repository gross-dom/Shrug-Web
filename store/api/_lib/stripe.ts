import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from './env.js'

// Stripe, for the dollars: the floor and the postage. The store asks it for a payment of an exact amount,
// the page takes it by Apple Pay (or a card, where there is no Apple Pay), and the store then asks Stripe
// itself whether the money arrived. Nothing the page says about a payment is taken on trust.

async function ask(method: string, path: string, form?: Record<string, string>): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.stripe}`, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: form ? new URLSearchParams(form).toString() : undefined,
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body) throw new Error(`Stripe ${method} ${path}: ${res.status}`)
  return body
}

export interface Intent {
  id: string
  client_secret: string
  status: string
  amount: number
  amount_received: number
  metadata: Record<string, string>
  shipping: { name?: string; address?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string } } | null
}

/** A payment to be made: so many cents, for one product, by one member; or by a visitor, who has no row yet
 * (`visitor`), with the address they typed (`shipTo`). The account is made from the payment once it arrives. */
export function newIntent(cents: number, says: { member: string; email: string; product: string; option: string; points: string; name: string; visitor?: string; buyer?: string; shipTo?: string }): Promise<Intent> {
  const form: Record<string, string> = {
    amount: String(cents),
    currency: 'usd',
    'automatic_payment_methods[enabled]': 'true',
    description: `Shrug VIP: ${says.name}${says.option ? ` (${says.option})` : ''}`,
    receipt_email: says.email,
  }
  for (const [key, value] of Object.entries(says)) if (value !== undefined) form[`metadata[${key}]`] = value
  return ask('POST', 'payment_intents', form)
}

export const intentOf = (id: string): Promise<Intent> => ask('GET', `payment_intents/${encodeURIComponent(id)}`)

/** Whether what arrived at /api/stripe is from Stripe: it signs the time and the body with the shared secret. */
export function fromStripe(raw: string, header: string | null): boolean {
  const secret = env.stripeWebhook
  if (!secret || !header) return false
  const parts = Object.fromEntries(header.split(',').map((part) => part.split('=') as [string, string]))
  const at = Number(parts.t)
  if (!parts.v1 || !Number.isFinite(at) || Math.abs(Date.now() / 1000 - at) > 300) return false
  const good = Buffer.from(createHmac('sha256', secret).update(`${parts.t}.${raw}`).digest('hex'))
  const given = Buffer.from(parts.v1)
  return good.length === given.length && timingSafeEqual(good, given)
}
