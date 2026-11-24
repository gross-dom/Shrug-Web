import { env } from './env.js'

// Codes by text. A phone number is proved by six digits sent to it, and Twilio's Verify does the whole of
// that: it makes the code, texts it, keeps it for ten minutes, allows five guesses, and refuses a number
// that is asked for too often. So nothing of a texted code is kept here or in Airtable: the store asks
// Twilio to send one, and later asks it whether the six digits it was given are right.

/** How long the page waits before offering to send another, in seconds. (Twilio keeps its own count besides.) */
export const TEXT_AGAIN_IN = 45

async function ask(path: string, form: Record<string, string>): Promise<{ status: number; body: any }> {
  const res = await fetch(`https://verify.twilio.com/v2/Services/${env.twilioVerify}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${env.twilioSid}:${env.twilioToken}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

/** Texts a code to a number. `phone`: not a number that can be texted. `wait`: it has been asked for too often. */
export async function textCode(phone: string): Promise<{ ok: true } | { error: 'phone' | 'wait' | 'text' }> {
  const { status, body } = await ask('Verifications', { To: phone, Channel: 'sms' })
  if (status >= 200 && status < 300 && body?.status === 'pending') return { ok: true }
  // 60200: not a number. 60205: a landline. 60203, and any 429: too many sent to it for now
  if (body?.code === 60200 || body?.code === 60205) return { error: 'phone' }
  if (status === 429 || body?.code === 60203) return { error: 'wait' }
  console.error('text', status, body?.code)
  return { error: 'text' }
}

/** Whether six digits are the ones texted to a number. A right code is used up. */
export async function checkText(phone: string, code: string): Promise<{ ok: true } | { error: 'wrong' | 'expired' | 'locked' }> {
  const { status, body } = await ask('VerificationCheck', { To: phone, Code: code })
  if (status >= 200 && status < 300) return body?.status === 'approved' ? { ok: true } : { error: 'wrong' }
  // 60202, and any 429: too many guesses. 404: no code is waiting for this number (none sent, run out, or used)
  if (status === 429 || body?.code === 60202) return { error: 'locked' }
  if (status === 404) return { error: 'expired' }
  throw new Error(`Twilio check: ${status}`)
}
