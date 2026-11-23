import { change, F, T } from './_lib/airtable.js'
import { json, read } from './_lib/http.js'
import { memberAsking, trouble } from './_lib/who.js'

// A member turns the points emails on or off for themselves (Members → No emails).
export async function POST(request: Request) {
  try {
    const who = await memberAsking(request)
    if ('refuse' in who) return who.refuse
    const on = (await read(request)).on !== false
    await change(T.members, who.row.id, { [F.member.noEmails]: !on })
    return json({ ok: true, emails: on })
  } catch (error) {
    return trouble('emails', error)
  }
}
