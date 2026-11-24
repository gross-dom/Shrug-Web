import { checkCode } from './_lib/codes.js'
import { json, read, text } from './_lib/http.js'
import { answerFor, rowOf, welcome } from './_lib/members.js'
import { sessionCookie } from './_lib/session.js'
import { trouble } from './_lib/who.js'

// The second half: the six digits come back. A right code signs the address in. Someone on the list is
// shown their card. Anyone else is given an account there and then: a row in Members with no Role and a few
// points to begin with (a standard user), and is shown theirs.
export async function POST(request: Request) {
  try {
    const body = await read(request)
    const email = text(body.email, 254).toLowerCase()
    const code = text(body.code, 12).replace(/\D/g, '')
    if (!email || code.length !== 6) return json({ error: 'wrong', left: 0 }, { status: 400 })
    const checked = await checkCode(email, code)
    if ('error' in checked) return json(checked, { status: 400 })
    const headers = { 'Set-Cookie': sessionCookie(email) }
    const row = (await rowOf(email)) ?? (await welcome(email))
    return json(await answerFor(row), { headers })
  } catch (error) {
    return trouble('verify', error)
  }
}
