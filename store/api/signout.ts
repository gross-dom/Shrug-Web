import { json } from './_lib/http.ts'
import { noSessionCookie } from './_lib/session.ts'

export async function POST() {
  return json({ ok: true }, { headers: { 'Set-Cookie': noSessionCookie() } })
}
