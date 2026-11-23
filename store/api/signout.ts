import { json } from './_lib/http.js'
import { noSessionCookie } from './_lib/session.js'

export async function POST() {
  return json({ ok: true }, { headers: { 'Set-Cookie': noSessionCookie() } })
}
