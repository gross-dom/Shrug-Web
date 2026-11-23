import { all, change, F, list, num, str, T, type Row } from './airtable.ts'
import type { Member } from '../../shared/rules.ts'

// The members, as Airtable has them, and as the card and the store are told of them.

export const sameAddress = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** The row in Members for an address, or null: they are not on the list. */
export async function rowOf(email: string): Promise<Row | null> {
  const rows = await all(T.members)
  return rows.find((row) => sameAddress(str(row.fields[F.member.email]), email)) ?? null
}

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
  }
}

/** The answer to "who am I", for a member: their card, and the balance they last saw. Looking counts as seeing. */
export async function answerFor(row: Row) {
  const seen = num(row.fields[F.member.seenPoints])
  const member = cardOf(row)
  await change(T.members, row.id, { [F.member.seenPoints]: member.points, [F.member.lastSeen]: new Date().toISOString() }).catch(() => {})
  return { status: 'member' as const, member, seenPoints: seen }
}
