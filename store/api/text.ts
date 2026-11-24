import { json, read, text } from './_lib/http.js'
import { rowOf } from './_lib/members.js'
import { TEXT_AGAIN_IN, textCode } from './_lib/texts.js'
import { trouble } from './_lib/who.js'
import { phoneOf } from '../shared/rules.js'

// The second step for someone new: their phone number, which is texted six digits. Proving the number is
// what makes their account (api/verify.ts), and the number is how they sign in from then on.
//
// Only for an address nobody has. Someone with a row gets in the way their row says (api/start.ts), so a
// number typed here can never be put on an account that already exists.
export async function POST(request: Request) {
  try {
    const body = await read(request)
    const email = text(body.email, 254).toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'email' }, { status: 400 })
    const phone = phoneOf(body.phone)
    if (!phone) return json({ error: 'phone' }, { status: 400 })
    if (await rowOf(email)) return json({ error: 'start' }, { status: 409 })
    const sent = await textCode(phone)
    if ('error' in sent) return json({ error: sent.error }, { status: sent.error === 'phone' ? 400 : sent.error === 'wait' ? 429 : 502 })
    return json({ ok: true, step: 'text', phone, resendIn: TEXT_AGAIN_IN })
  } catch (error) {
    return trouble('text', error)
  }
}
