import { add, all, change, F, files, list, num, remove, str, T, type Row } from './airtable.js'
import { phoneOf, STANDARD_TIER, STARTING_POINTS, type Member, type Needs, type Picture, type Via } from '../../shared/rules.js'

// The members, as Airtable has them, and as the card and the store are told of them.

export const sameAddress = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** The row in Members for an address, or null: they are not on the list. */
export async function rowOf(email: string): Promise<Row | null> {
  const rows = await all(T.members)
  return rows.find((row) => sameAddress(str(row.fields[F.member.email]), email)) ?? null
}

/** Whether a member is on Shrug's list: someone Shrug has given a Role. Anyone else is a standard user. */
export const listed = (row: Row) => list(row.fields[F.member.role]).length > 0

/** The phone number on a member's row, as it is texted (+14155550134), or null where there is none. */
export const phoneOn = (row: Row): string | null => phoneOf(str(row.fields[F.member.phone]))

/** The row a phone number is on, or null. A number belongs to one account. */
export async function rowByPhone(phone: string): Promise<Row | null> {
  const rows = await all(T.members)
  return rows.find((row) => phoneOn(row) === phone) ?? null
}

/** Whether a member has proved their email is theirs: by a code sent to it, or by their personal link. */
export const confirmed = (row: Row) => str(row.fields[F.member.confirmed]) !== ''

/** Notes that a member has just proved their email. */
export const confirm = (row: Row): Promise<Row> => change(T.members, row.id, { [F.member.confirmed]: new Date().toISOString() })

/** How someone who has a row gets in. With a number on file, by a text to it. But a number only counts for
 * someone on the list once they have confirmed their email: until then a number on their row may have been
 * put there by whoever made an account with that address before Shrug listed it. Anyone else, and anyone
 * with no number, gets in by a code to their inbox. */
export const wayIn = (row: Row): 'text' | 'inbox' => (phoneOn(row) && (!listed(row) || confirmed(row)) ? 'text' : 'inbox')

/** A row for someone who is not on the list: a standard user, with a few points to begin with. They have no
 * Role, so they are in no group, and are shown what is for Everyone and nothing else. They are made by a
 * proved phone number (signing in) or by a payment (buying as a visitor), never by an address alone. */
export const welcome = (email: string, more: { phone?: string; shipTo?: string } = {}): Promise<Row> =>
  add(T.members, {
    [F.member.email]: email,
    [F.member.tier]: STANDARD_TIER[0]!.toUpperCase() + STANDARD_TIER.slice(1),
    [F.member.points]: STARTING_POINTS,
    [F.member.reason]: 'A welcome from Shrug',
    [F.member.since]: String(new Date().getUTCFullYear()),
    ...(more.phone ? { [F.member.phone]: more.phone } : {}),
    ...(more.shipTo ? { [F.member.shipTo]: more.shipTo } : {}),
  })

/** The row for an address, made if there is none: for a payment by a visitor, which makes their account.
 * The page and Stripe may both come to say the payment arrived, at the same moment, and each would make the
 * row: each makes its own first, and only the earlier of the two is kept. `made` says whether it was made now. */
export async function rowFor(email: string, more: { shipTo?: string } = {}): Promise<{ row: Row; made: boolean }> {
  const there = await rowOf(email)
  if (there) return { row: there, made: false }
  const mine = await welcome(email, more)
  const same = (await all(T.members)).filter((row) => sameAddress(str(row.fields[F.member.email]), email)).sort((a, b) => a.id.localeCompare(b.id))
  const first = same[0]
  if (first && first.id !== mine.id) {
    await remove(T.members, mine.id).catch(() => {})
    return { row: first, made: false }
  }
  return { row: mine, made: true }
}

/** A member's picture: one of Shrug's faces (kept as a file named for it, face-3.png) or a photo of theirs. */
export function pictureOf(row: Row): Picture | null {
  const file = files(row.fields[F.member.picture])[0]
  if (!file?.url) return null
  const face = /^(face-[a-z0-9-]+)\./i.exec(file.filename ?? '')
  // Airtable's links to a photo last a couple of hours, which is longer than a page is looked at
  return face ? { face: face[1]!.toLowerCase() } : { url: file.thumbnails?.large?.url ?? file.url! }
}

/** The name a member chose for themselves, or none. */
export const displayNameOf = (row: Row) => str(row.fields[F.member.displayName]).trim()

/** What an account still lacks: a number to sign in with, and a name of its own choosing (asked for once, with a picture). */
export const needsOf = (row: Row): Needs => ({ phone: !phoneOn(row), profile: !displayNameOf(row) })

export function memberOf(row: Row): Member {
  // The name they chose is the one shown; until they choose one, the name Shrug has for them
  const name = displayNameOf(row) || str(row.fields[F.member.name]).trim()
  return {
    id: row.id,
    name,
    first: name.split(/\s+/)[0] ?? '',
    roles: list(row.fields[F.member.role]),
    funds: list(row.fields[F.member.funds]),
    tier: str(row.fields[F.member.tier]).toLowerCase(),
    points: num(row.fields[F.member.points]) ?? 0,
  }
}

/** What the card is told: the member, and what is printed on their card. */
export function cardOf(row: Row) {
  const member = memberOf(row)
  const number = num(row.fields[F.member.number])
  const since = parseInt(str(row.fields[F.member.since]), 10)
  return {
    name: member.name,
    first: member.first,
    roles: member.roles,
    funds: member.funds,
    tier: member.tier,
    points: member.points,
    number: number === null ? '' : String(number).padStart(3, '0'),
    since: Number.isFinite(since) ? since : null,
    reason: str(row.fields[F.member.reason]) || null,
    emails: row.fields[F.member.noEmails] !== true,
    email: str(row.fields[F.member.email]),
    shipTo: str(row.fields[F.member.shipTo]).trim(),
    picture: pictureOf(row),
  }
}

/** An address as it is kept on file: a few lines, none of them long, nothing else. */
export const tidied = (shipTo: unknown) =>
  typeof shipTo === 'string'
    ? shipTo
        .split('\n')
        .map((line) => line.trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 6)
        .join('\n')
    : ''

/** Keeps an address on a member's row, for their next order. */
export const keepAddress = (row: Row, shipTo: string) => change(T.members, row.id, { [F.member.shipTo]: shipTo })

/** The answer to "who am I", for a member: their card, the balance they last saw, what their account still
 * lacks, and how they got in. Looking counts as seeing. */
export async function answerFor(row: Row, via: Via) {
  const seen = num(row.fields[F.member.seenPoints])
  const member = cardOf(row)
  await change(T.members, row.id, { [F.member.seenPoints]: member.points, [F.member.lastSeen]: new Date().toISOString() }).catch(() => {})
  // The card is told what it always was: an address is the store's business, and is not sent to it
  const { shipTo: _shipTo, ...card } = member
  return { status: 'member' as const, member: card, seenPoints: seen, needs: needsOf(row), via }
}
