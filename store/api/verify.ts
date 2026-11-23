import { add, all, F, str, T } from './_lib/airtable.js'
import { checkCode } from './_lib/codes.js'
import { json, read, text } from './_lib/http.js'
import { answerFor, rowOf, sameAddress } from './_lib/members.js'
import { sessionCookie } from './_lib/session.js'
import { trouble } from './_lib/who.js'

// The second half: the six digits come back. A right code signs the address in. A member is shown their
// card; anyone else is noted in Applications, once, and told they are not on the list yet.
export async function POST(request: Request) {
  try {
    const body = await read(request)
    const email = text(body.email, 254).toLowerCase()
    const code = text(body.code, 12).replace(/\D/g, '')
    if (!email || code.length !== 6) return json({ error: 'wrong', left: 0 }, { status: 400 })
    const checked = await checkCode(email, code)
    if ('error' in checked) return json(checked, { status: 400 })
    const headers = { 'Set-Cookie': sessionCookie(email) }
    const row = await rowOf(email)
    if (row) return json(await answerFor(row), { headers })
    const applied = await all(T.applications)
    if (!applied.some((a) => sameAddress(str(a.fields[F.application.email]), email))) await add(T.applications, { [F.application.email]: email, [F.application.applied]: new Date().toISOString() })
    return json({ status: 'applied' }, { headers })
  } catch (error) {
    return trouble('verify', error)
  }
}
