import { json, read } from './_lib/http.js'
import { keepAddress, tidied } from './_lib/members.js'
import { memberAsking, trouble } from './_lib/who.js'
import { onFile } from '../shared/rules.js'

// The address a member's orders are sent to, kept on their row in Airtable (Members → Ship to). It is a few
// lines of text, as they would write it on a parcel. They set it at their first order and change it in Yours.
export async function POST(request: Request) {
  try {
    const who = await memberAsking(request)
    if ('refuse' in who) return who.refuse
    const shipTo = tidied((await read(request)).shipTo)
    if (!onFile(shipTo)) return json({ error: 'address' }, { status: 400 })
    await keepAddress(who.row, shipTo)
    return json({ ok: true, shipTo })
  } catch (error) {
    return trouble('address', error)
  }
}
