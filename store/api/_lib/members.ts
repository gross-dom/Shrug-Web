import { add, all, change, F, list, num, str, T, type Row } from './airtable.js'
import { STANDARD_TIER, STARTING_POINTS, type Member } from '../../shared/rules.js'

// The members, as Airtable has them, and as the card and the store are told of them.

export const sameAddress = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** The row in Members for an address, or null: they are not on the list. */
export async function rowOf(email: string): Promise<Row | null> {
  const rows = await all(T.members)
  return rows.find((row) => sameAddress(str(row.fields[F.member.email]), email)) ?? null
}

/** Whether a member is on Shrug's list: someone Shrug has given a Role. Anyone else is a standard user. */
export const listed = (row: Row) => list(row.fields[F.member.role]).length > 0

/** A row for someone who has signed in and is not on the list: a standard user, with a few points to begin
 * with. They have no Role, so they are in no group, and are shown what is for Everyone and nothing else. */
export const welcome = (email: string): Promise<Row> =>
  add(T.members, {
    [F.member.email]: email,
    [F.member.tier]: STANDARD_TIER[0]!.toUpperCase() + STANDARD_TIER.slice(1),
    [F.member.points]: STARTING_POINTS,
    [F.member.reason]: 'A welcome from Shrug',
    [F.member.since]: String(new Date().getUTCFullYear()),
  })

export function memberOf(row: Row): Member {
  const name = str(row.fields[F.member.name]).trim()
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

/** The answer to "who am I", for a member: their card, and the balance they last saw. Looking counts as seeing. */
export async function answerFor(row: Row) {
  const seen = num(row.fields[F.member.seenPoints])
  const member = cardOf(row)
  await change(T.members, row.id, { [F.member.seenPoints]: member.points, [F.member.lastSeen]: new Date().toISOString() }).catch(() => {})
  // The card is told what it always was: an address is the store's business, and is not sent to it
  const { email: _email, shipTo: _shipTo, ...card } = member
  return { status: 'member' as const, member: card, seenPoints: seen }
}
