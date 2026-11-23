import { newCode, RESEND_IN } from './_lib/codes.ts'
import { json, read, text } from './_lib/http.ts'
import { sendCode } from './_lib/mail.ts'
import { trouble } from './_lib/who.ts'

// The first half of signing in: an address is given, and six digits are emailed to it. The answer is the same
// whether or not the address is a member's, so that nobody can ask the store who is on the list.
export async function POST(request: Request) {
  try {
    const email = text((await read(request)).email, 254).toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'email' }, { status: 400 })
    const made = await newCode(email)
    if ('wait' in made) return json({ error: 'wait', retryIn: made.wait }, { status: 429 })
    if (!(await sendCode(email, made.code))) return json({ error: 'mail' }, { status: 502 })
    return json({ ok: true, resendIn: RESEND_IN })
  } catch (error) {
    return trouble('start', error)
  }
}
