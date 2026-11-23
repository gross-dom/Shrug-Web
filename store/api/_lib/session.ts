import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from './env.ts'
import { cookie, cookiesOf } from './http.ts'

// Who is signed in. A session is a cookie that says which address signed in and until when, signed with the
// server's secret so that it cannot be written by anyone else. It holds nothing more: who that address is,
// and what they have, is read from Airtable each time, so taking someone off the list signs them out at once.

const NAME = 'shrug_session'
const DAYS = 60

const sign = (payload: string) => createHmac('sha256', env.secret).update(payload).digest('base64url')

export function sessionCookie(email: string): string {
  const payload = Buffer.from(JSON.stringify({ email, until: Date.now() + DAYS * 864e5 })).toString('base64url')
  return cookie(NAME, `${payload}.${sign(payload)}`, DAYS * 86400)
}

export const noSessionCookie = () => cookie(NAME, '', 0)

/** The address that is signed in, or null. */
export function signedIn(request: Request): string | null {
  const [payload, mark] = (cookiesOf(request)[NAME] ?? '').split('.')
  if (!payload || !mark) return null
  const good = Buffer.from(sign(payload))
  const given = Buffer.from(mark)
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null
  try {
    const said = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return typeof said.email === 'string' && typeof said.until === 'number' && said.until > Date.now() ? said.email : null
  } catch {
    return null
  }
}
