import { json } from './http.js'
import { memberOf, rowOf } from './members.js'
import { noSessionCookie, signedIn } from './session.js'
import type { Row } from './airtable.js'
import type { Member } from '../../shared/rules.js'

/** The member asking, or the answer to give instead: not signed in, or signed in and not on the list. */
export async function memberAsking(request: Request): Promise<{ row: Row; member: Member; email: string } | { refuse: Response }> {
  const email = signedIn(request)
  if (!email) return { refuse: json({ error: 'anon' }, { status: 401, headers: { 'Set-Cookie': noSessionCookie() } }) }
  const row = await rowOf(email)
  if (!row) return { refuse: json({ error: 'member' }, { status: 403 }) }
  return { row, member: memberOf(row), email }
}

/** Something on the server's side went wrong: said plainly to the page, and in full to the log. */
export function trouble(where: string, error: unknown): Response {
  console.error(where, error)
  return json({ error: 'server' }, { status: 500 })
}
