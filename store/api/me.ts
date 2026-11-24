import { json } from './_lib/http.js'
import { answerFor, rowOf } from './_lib/members.js'
import { noSessionCookie, signedIn } from './_lib/session.js'
import { trouble } from './_lib/who.js'

// Who is asking: nobody, or a member, with their card. Someone signed in whose row has since been taken out
// of Members is nobody again, and their session is ended.
export async function GET(request: Request) {
  try {
    const email = signedIn(request)
    if (!email) return json({ status: 'anon' }, { headers: { 'Set-Cookie': noSessionCookie() } })
    const row = await rowOf(email)
    return row ? json(await answerFor(row)) : json({ status: 'anon' }, { headers: { 'Set-Cookie': noSessionCookie() } })
  } catch (error) {
    return trouble('me', error)
  }
}
