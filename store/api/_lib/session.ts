import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from './env.js'
import { cookie, cookiesOf } from './http.js'
import type { Via } from '../../shared/rules.js'

// Who is signed in. A session is a cookie that says which address signed in, how (a texted code, a code to
// their inbox, their personal link, or a payment) and until when, signed with the server's secret so that it
// cannot be written by anyone else. It holds nothing more: who that address is, and what they have, is read
// from Airtable each time, so taking someone off the list signs them out at once.

const NAME = 'shrug_session'
const DAYS = 60

const sign = (payload: string) => createHmac('sha256', env.secret).update(payload).digest('base64url')

export function sessionCookie(email: string, via: Via = 'inbox'): string {
  const payload = Buffer.from(JSON.stringify({ email, via, until: Date.now() + DAYS * 864e5 })).toString('base64url')
  return cookie(NAME, `${payload}.${sign(payload)}`, DAYS * 86400)
}

export const noSessionCookie = () => cookie(NAME, '', 0)

const VIAS: Via[] = ['text', 'inbox', 'link', 'pay']

/** Who is signed in, and how they got in; or null. (A session from before `via` was kept is one by inbox: every code was emailed then.) */
export function sessionOf(request: Request): { email: string; via: Via } | null {
  const [payload, mark] = (cookiesOf(request)[NAME] ?? '').split('.')
  if (!payload || !mark) return null
  const good = Buffer.from(sign(payload))
  const given = Buffer.from(mark)
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null
  try {
    const said = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (typeof said.email !== 'string' || typeof said.until !== 'number' || said.until <= Date.now()) return null
    return { email: said.email, via: VIAS.includes(said.via) ? said.via : 'inbox' }
  } catch {
    return null
  }
}

/** The address that is signed in, or null. */
export const signedIn = (request: Request): string | null => sessionOf(request)?.email ?? null

/** A mark made with the server's secret, for anything else that has to be shown to be the server's own (a personal link). */
export const markOf = (what: string): string => sign(what)
