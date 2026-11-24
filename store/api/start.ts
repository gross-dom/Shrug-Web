import { newCode, RESEND_IN } from './_lib/codes.js'
import { json, read, text } from './_lib/http.js'
import { sendCode } from './_lib/mail.js'
import { phoneOn, rowOf, wayIn } from './_lib/members.js'
import { TEXT_AGAIN_IN, textCode } from './_lib/texts.js'
import { trouble } from './_lib/who.js'
import { endOf } from '../shared/rules.js'

// The first step of signing in: an email address is given, and the answer says what comes next.
//   phone   nobody has this address yet. A phone number is asked for (api/text.ts), and nothing is sent
//   text    six digits have been texted to the number on their row
//   inbox   six digits have been emailed: to someone on the list who has not yet confirmed their email, or
//           to anyone whose account has no number
// `by: 'inbox'` asks for the email whatever the row says: for someone whose number is lost or has changed.
// (The answer does say whether an address has an account, and whether it is waiting to be confirmed: it has
// to, to ask the right thing next. It never says who anyone is.)
export async function POST(request: Request) {
  try {
    const body = await read(request)
    const email = text(body.email, 254).toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'email' }, { status: 400 })
    const row = await rowOf(email)
    if (!row) return json({ ok: true, step: 'phone' })
    if (body.by !== 'inbox' && wayIn(row) === 'text') {
      const phone = phoneOn(row)!
      const sent = await textCode(phone)
      // Too many asked for: the one already sent may still be good, so the page goes on to the six digits
      if ('error' in sent) return json({ error: sent.error === 'wait' ? 'wait' : 'text', step: 'text', to: endOf(phone) }, { status: sent.error === 'wait' ? 429 : 502 })
      return json({ ok: true, step: 'text', to: endOf(phone), resendIn: TEXT_AGAIN_IN })
    }
    const made = await newCode(email)
    if ('wait' in made) return json({ error: 'wait', step: 'inbox', retryIn: made.wait }, { status: 429 })
    if (!(await sendCode(email, made.code))) return json({ error: 'mail' }, { status: 502 })
    return json({ ok: true, step: 'inbox', resendIn: RESEND_IN })
  } catch (error) {
    return trouble('start', error)
  }
}
