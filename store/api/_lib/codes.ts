import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { add, all, change, F, remove, str, T } from './airtable.ts'
import { env } from './env.ts'
import { sameAddress } from './members.ts'

// Sign-in codes. A member gives their address and is emailed six digits, good for ten minutes and five
// guesses. What is kept (Sign-ins, in Airtable) is never the code itself, only a mark made from it with
// the server's secret, with when it was sent, when it runs out and how many guesses remain.

const LASTS = 10 * 60 * 1000
const GUESSES = 5
/** How long before another code can be asked for, in seconds. The card counts this down. */
export const RESEND_IN = 45

interface State {
  mark: string
  sent: number
  until: number
  left: number
}

const markOf = (email: string, code: string) => createHmac('sha256', env.secret).update(`${email.toLowerCase()}:${code}`).digest('base64url')

async function kept(email: string) {
  const rows = await all(T.signIns)
  const row = rows.find((r) => sameAddress(str(r.fields[F.signIn.email]), email)) ?? null
  let state: State | null = null
  try {
    state = row ? (JSON.parse(str(row.fields[F.signIn.state])) as State) : null
  } catch {
    state = null
  }
  return { row, state }
}

/** A new code for an address: the six digits to send, or how long there is still to wait. */
export async function newCode(email: string): Promise<{ code: string } | { wait: number }> {
  const { row, state } = await kept(email)
  const now = Date.now()
  if (state && now - state.sent < RESEND_IN * 1000) return { wait: Math.ceil((RESEND_IN * 1000 - (now - state.sent)) / 1000) }
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const next: State = { mark: markOf(email, code), sent: now, until: now + LASTS, left: GUESSES }
  const fields = { [F.signIn.email]: email.toLowerCase(), [F.signIn.state]: JSON.stringify(next) }
  if (row) await change(T.signIns, row.id, fields)
  else await add(T.signIns, fields)
  return { code }
}

/** Whether a code is the one that was sent. A right one is used up; a wrong one costs a guess. */
export async function checkCode(email: string, code: string): Promise<{ ok: true } | { error: 'wrong'; left: number } | { error: 'locked' | 'expired' }> {
  const { row, state } = await kept(email)
  if (!row || !state) return { error: 'expired' }
  if (Date.now() > state.until) return { error: 'expired' }
  if (state.left <= 0) return { error: 'locked' }
  const good = Buffer.from(state.mark)
  const given = Buffer.from(markOf(email, code))
  if (good.length === given.length && timingSafeEqual(good, given)) {
    await remove(T.signIns, row.id).catch(() => {})
    return { ok: true }
  }
  const left = state.left - 1
  await change(T.signIns, row.id, { [F.signIn.state]: JSON.stringify({ ...state, left }) })
  return left <= 0 ? { error: 'locked' } : { error: 'wrong', left }
}
