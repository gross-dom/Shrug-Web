import { attach, change, F, one, T } from './_lib/airtable.js'
import { json, read, text } from './_lib/http.js'
import { answerFor } from './_lib/members.js'
import { memberAsking, trouble } from './_lib/who.js'

// What a member makes their own: a display name, and a picture. Asked for once, the first time they sign
// in, and theirs to change afterwards. Both are kept on their row in Members.
//
// A picture is one of Shrug's own faces or a photo of theirs. A face is kept as a file named for it
// (face-3.png) and nothing more: the pages have the artwork, and draw it by that name, so the set can be
// changed without touching anyone's row. A photo is kept as the photo, made small by the page before it is
// sent (a square, a few hundred pixels across).

/** One transparent pixel: what a face's file holds. Its name is what says which face. */
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
/** The most a photo may be, as it is sent (in base64): about 750 KB of picture. */
const MOST = 1_000_000
const KINDS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** A name as it is kept: one line, no more than 40 characters, nothing that is not text. */
const named = (given: unknown) => text(typeof given === 'string' ? given.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e]/g, ' ').replace(/\s+/g, ' ') : '', 40)

export async function POST(request: Request) {
  try {
    const who = await memberAsking(request)
    if ('refuse' in who) return who.refuse
    const body = await read(request)

    let file: { name: string; type: string; base64: string } | null = null
    if (typeof body.face === 'string') {
      if (!/^face-[a-z0-9-]{1,24}$/.test(body.face)) return json({ error: 'picture' }, { status: 400 })
      file = { name: `${body.face}.png`, type: 'image/png', base64: PIXEL }
    } else if (typeof body.photo === 'string') {
      const photo = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(body.photo)
      if (!photo || photo[2]!.length > MOST) return json({ error: 'picture' }, { status: 400 })
      file = { name: `photo.${KINDS[photo[1]!]}`, type: photo[1]!, base64: photo[2]! }
    }
    const name = 'name' in body ? named(body.name) : null
    if (name === '') return json({ error: 'name' }, { status: 400 })
    if (name === null && !file) return json({ error: 'nothing' }, { status: 400 })

    if (name !== null) await change(T.members, who.row.id, { [F.member.displayName]: name })
    if (file) {
      // The new picture takes the old one's place
      await change(T.members, who.row.id, { [F.member.picture]: [] })
      await attach(who.row.id, F.member.picture, file)
    }
    const row = (await one(T.members, who.row.id)) ?? who.row
    return json({ ok: true, ...(await answerFor(row, who.via)) })
  } catch (error) {
    return trouble('profile', error)
  }
}
