import { json } from './http.js'
import { memberOf, rowOf } from './members.js'
import { noSessionCookie, sessionOf } from './session.js'
import type { Row } from './airtable.js'
import type { Member, Via } from '../../shared/rules.js'

/** The member asking, and how they got in; or the answer to give instead: nobody is signed in, or whoever was has been taken out of Members. */
export async function memberAsking(request: Request): Promise<{ row: Row; member: Member; email: string; via: Via } | { refuse: Response }> {
  const session = sessionOf(request)
  if (!session) return { refuse: json({ error: 'anon' }, { status: 401, headers: { 'Set-Cookie': noSessionCookie() } }) }
  const row = await rowOf(session.email)
  if (!row) return { refuse: json({ error: 'anon' }, { status: 401, headers: { 'Set-Cookie': noSessionCookie() } }) }
  return { row, member: memberOf(row), email: session.email, via: session.via }
}

/** Something on the server's side went wrong: said plainly to the page, and in full to the log. */
export function trouble(where: string, error: unknown): Response {
  console.error(where, error)
  return json({ error: 'server' }, { status: 500 })
}
