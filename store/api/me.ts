import { json } from './_lib/http.ts'
import { answerFor, rowOf } from './_lib/members.ts'
import { noSessionCookie, signedIn } from './_lib/session.ts'
import { trouble } from './_lib/who.ts'

// Who is asking: nobody, someone who signed in and is not on the list, or a member, with their card.
export async function GET(request: Request) {
  try {
    const email = signedIn(request)
    if (!email) return json({ status: 'anon' }, { headers: { 'Set-Cookie': noSessionCookie() } })
    const row = await rowOf(email)
    return json(row ? await answerFor(row) : { status: 'applied' })
  } catch (error) {
    return trouble('me', error)
  }
}
