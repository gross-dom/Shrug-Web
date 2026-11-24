import { F, str } from './_lib/airtable.js'
import { checkCode } from './_lib/codes.js'
import { json, read, text } from './_lib/http.js'
import { answerFor, confirm, phoneOn, rowByPhone, rowOf, wayIn, welcome } from './_lib/members.js'
import { sessionCookie } from './_lib/session.js'
import { checkText } from './_lib/texts.js'
import { trouble } from './_lib/who.js'
import { phoneOf, type Via } from '../shared/rules.js'

/** How long a number waits once its guesses are used up, in seconds: as long as a texted code lasts. */
const TEXT_LOCKED_FOR = 10 * 60

// The last step: the six digits come back, and a right code signs them in.
//
// Someone new sends their number with it, and the code is the one texted there. That makes their account: a
// row in Members with no Role, a few points to begin with, and the number (a standard user). A number
// belongs to one account, so someone whose number already has one is signed in to that one instead, and no
// second account is made, whatever address they typed.
//
// Someone with a row is checked the way their row says (see wayIn): against the text sent to the number on
// file, or against the code sent to their inbox. A right inbox code confirms their email, which is what lets
// someone on the list add a number and use it from then on.
export async function POST(request: Request) {
  try {
    const body = await read(request)
    const email = text(body.email, 254).toLowerCase()
    const code = text(body.code, 12).replace(/\D/g, '')
    if (!email || code.length !== 6) return json({ error: 'wrong' }, { status: 400 })
    let row = await rowOf(email)
    let via: Via = 'text'
    let existing = false
    if (!row) {
      const phone = phoneOf(body.phone)
      if (!phone) return json({ error: 'expired' }, { status: 400 })
      const checked = await checkText(phone, code)
      if ('error' in checked) return json(checked.error === 'locked' ? { ...checked, retryIn: TEXT_LOCKED_FOR } : checked, { status: 400 })
      const theirs = await rowByPhone(phone)
      // A number on the row of someone on the list who has not confirmed their email does not count yet
      if (theirs && wayIn(theirs) !== 'text') return json({ error: 'taken' }, { status: 409 })
      existing = !!theirs
      row = theirs ?? (await welcome(email, { phone }))
    } else if (body.by !== 'inbox' && wayIn(row) === 'text') {
      const checked = await checkText(phoneOn(row)!, code)
      if ('error' in checked) return json(checked.error === 'locked' ? { ...checked, retryIn: TEXT_LOCKED_FOR } : checked, { status: 400 })
    } else {
      const checked = await checkCode(email, code)
      if ('error' in checked) return json(checked, { status: 400 })
      row = await confirm(row)
      via = 'inbox'
    }
    const headers = { 'Set-Cookie': sessionCookie(str(row.fields[F.member.email]).trim().toLowerCase(), via) }
    return json({ ...(await answerFor(row, via)), existing }, { headers })
  } catch (error) {
    return trouble('verify', error)
  }
}
