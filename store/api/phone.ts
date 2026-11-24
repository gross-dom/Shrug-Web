import { change, F, T } from './_lib/airtable.js'
import { json, read, text } from './_lib/http.js'
import { answerFor, listed, phoneOn, rowByPhone } from './_lib/members.js'
import { TEXT_AGAIN_IN, checkText, textCode } from './_lib/texts.js'
import { memberAsking, trouble } from './_lib/who.js'
import { phoneOf } from '../shared/rules.js'

// A phone number for an account that is signed in: the one they will sign in with from then on. Asked with a
// number alone, six digits are texted to it; asked again with the six digits, the number is put on their row.
//
// Who may: someone who has just proved their email (a code to their inbox, or their personal link), which is
// how someone on the list adds theirs and how anyone changes one; and someone not on the list whose account
// has no number yet (made by buying something). Nobody else: a session that began with a texted code cannot
// move the account to another number without the email being proved first (`confirm`).
export async function POST(request: Request) {
  try {
    const who = await memberAsking(request)
    if ('refuse' in who) return who.refuse
    const body = await read(request)
    const phone = phoneOf(body.phone)
    if (!phone) return json({ error: 'phone' }, { status: 400 })
    const proved = who.via === 'inbox' || who.via === 'link'
    if (!proved && (listed(who.row) || phoneOn(who.row))) return json({ error: 'confirm' }, { status: 403 })
    const code = text(body.code, 12).replace(/\D/g, '')
    if (!code) {
      const sent = await textCode(phone)
      if ('error' in sent) return json({ error: sent.error }, { status: sent.error === 'phone' ? 400 : sent.error === 'wait' ? 429 : 502 })
      return json({ ok: true, phone, resendIn: TEXT_AGAIN_IN })
    }
    if (code.length !== 6) return json({ error: 'wrong' }, { status: 400 })
    const checked = await checkText(phone, code)
    if ('error' in checked) return json(checked.error === 'locked' ? { ...checked, retryIn: 10 * 60 } : checked, { status: 400 })
    // A number belongs to one account. It is theirs (they have just read its text), so they are told to use it
    const other = await rowByPhone(phone)
    if (other && other.id !== who.row.id) return json({ error: 'taken' }, { status: 409 })
    const row = await change(T.members, who.row.id, { [F.member.phone]: phone })
    return json({ ok: true, ...(await answerFor(row, who.via)) })
  } catch (error) {
    return trouble('phone', error)
  }
}
