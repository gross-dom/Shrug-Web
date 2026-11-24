import { timingSafeEqual } from 'node:crypto'
import { confirm, phoneOn, rowOf } from './_lib/members.js'
import { markOf, sessionCookie } from './_lib/session.js'

// A personal link, as an update email carries one for each LP: /api/link?t=…. Opening it proves the email is
// theirs (it was sent there, and nobody else can make one: see tools/link.mjs), so they are signed in and
// taken to the desk, where the sheet asks only for a phone number.
//
// It is a way in for an account with no number, and for nothing else. Once a number is on the account the
// link is spent, and opening it only brings up Log In: so a link forwarded on, or found in an old email,
// opens nothing. It also runs out, on the day it says.

const back = (to: string, cookie?: string) => new Response(null, { status: 302, headers: { Location: to, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...(cookie ? { 'Set-Cookie': cookie } : {}) } })

export async function GET(request: Request) {
  // Whatever happens, they land on the desk with Log In let down
  const desk = '/?login=1'
  try {
    const [payload, mark] = (new URL(request.url).searchParams.get('t') ?? '').split('.')
    if (!payload || !mark) return back(desk)
    const good = Buffer.from(markOf(`link:${payload}`))
    const given = Buffer.from(mark)
    if (good.length !== given.length || !timingSafeEqual(good, given)) return back(desk)
    const said = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (typeof said.email !== 'string' || typeof said.until !== 'number' || said.until <= Date.now()) return back(desk)
    const row = await rowOf(said.email)
    if (!row || phoneOn(row)) return back(desk)
    await confirm(row)
    return back(desk, sessionCookie(said.email.trim().toLowerCase(), 'link'))
  } catch (error) {
    console.error('link', error)
    return back(desk)
  }
}
