import { env } from './env.js'

// The Shrug base in Airtable, which is where everything is kept: the members and their points, what is in
// the store and who may see it, and what has been ordered. Tables and columns are named here by their ids,
// not by what they are called, so that renaming a column in Airtable breaks nothing.

const BASE = 'appEaJzYP0vuEYRjr'

export const T = {
  members: 'tblHhPD5QmC0j3HY4',
  applications: 'tblaiQaqaPGiXiVPw',
  signIns: 'tblxvVY5oQzLfKMJD',
  products: 'tblCKNmIKo1ILyqbA',
  orders: 'tblYKwwbauvFT3IiM',
  opens: 'tblt5ocEIaPmBjxXM',
} as const

export const F = {
  member: {
    name: 'fldVuApViOxkkG0lI',
    email: 'fld3usOsgsRnPJGg3',
    role: 'fldB9dzDAFmd0M5wq',
    tier: 'fldKoqmDScJFuUt0r',
    points: 'fldsdXeNlPNDTgxaW',
    reason: 'fldtlFpF7p7lv5InE',
    number: 'fld28BN3HW0Qnivlg',
    since: 'fld6H4snGGi55QHnn',
    noEmails: 'fldxAo5UbIeGgOsJH',
    notified: 'fldI3slmIHsmIcf3b',
    seenPoints: 'fldXJxGGsGHydiXtX',
    lastSeen: 'fldw1If6Q1JJxzhFt',
    funds: 'fldkEroVBB9NlXr5s',
    shipTo: 'fldLUYHJH76iYCXFX',
    phone: 'fld5hd6oUjtDdVKZl',
    displayName: 'fldBLn21tUgCQSlfF',
    picture: 'fldVCBtgV8YYXquH8',
    confirmed: 'fldhRhMl8swF5IBB3',
  },
  application: { email: 'fld9g8dpI4OvhZIgJ', applied: 'fld9cmamUhBgPMwAB' },
  signIn: { email: 'fld29paPsXRkNu1pL', state: 'fldb64o16mO357J5n' },
  product: {
    name: 'fldBSBqzmoOFede2U',
    kind: 'fldhxMYxvMngaWfbv',
    status: 'fldL6HHHmeXe985BK',
    visibleTo: 'fldxYyQggka0KGY4W',
    points: 'fldPf6D1VW3qyW2C1',
    floor: 'fldPK7CoF5kHGWZHS',
    postage: 'flduA26PYHalayx77',
    description: 'fld9tCyCRHJBxoZ8q',
    picture: 'fldsl3HqNKDE3B0tO',
    file: 'fldTu85O1H11wlJVI',
    options: 'fldbqDeV1dwX2PFb2',
    editionOf: 'fldF4bqNOY59eSXZJ',
    left: 'fldERdEua8IHiQKUO',
    limited: 'fldp2S6k2iRbBFAKn',
    needsAddress: 'fldu3m5SIHPJAIWoT',
    place: 'fld6yXcQRnqjkQc7w',
    listed: 'fldxK7H44CRxDVOTy',
    group: 'fldEo9R1TCFpL8GMz',
  },
  order: {
    reference: 'fldgPuTLwX6GcDsk1',
    status: 'fldzLGMnm6z9EmB6i',
    member: 'fldMxdLpFYywZgl7z',
    product: 'fldt0kJOIkV5ocKYw',
    email: 'fld7g4T5eUkKOHDEc',
    option: 'fldxcunYtmCgbeQja',
    number: 'fldxO1zrmqJCc4yRf',
    points: 'fldLyk9hc2krI66LO',
    paid: 'fld1rnhgAzjTVhoy0',
    shipTo: 'fldMrFpndIIs6CK7Q',
    payment: 'fldzCk31hrEH5VB6y',
    placed: 'fldAdydjtlAOXXigA',
  },
  open: { what: 'fldazM3kVUOVJQ5SB', member: 'fldqPwDpBWIfvuI07', product: 'fldMkzqavs1XCWnEi', how: 'fldh7hLEDig37xDPa', when: 'fldIagwuxwzIlIwKY' },
} as const

export type Fields = Record<string, unknown>
export interface Row {
  id: string
  fields: Fields
  /** When the row was added, as Airtable gives it with every row. */
  createdTime?: string
}

async function ask(method: string, table: string, query: string, body?: unknown): Promise<any> {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${table}${query}`, {
    method,
    headers: { Authorization: `Bearer ${env.airtable}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`Airtable ${method} ${table}: ${res.status}`)
  return res.json()
}

/** Every row of a table. (Airtable hands them over a hundred at a time.) */
export async function all(table: string): Promise<Row[]> {
  const rows: Row[] = []
  let offset = ''
  do {
    const page = await ask('GET', table, `?returnFieldsByFieldId=true&pageSize=100${offset ? `&offset=${encodeURIComponent(offset)}` : ''}`)
    rows.push(...(page.records as Row[]))
    offset = page.offset ?? ''
  } while (offset)
  return rows
}

export async function one(table: string, id: string): Promise<Row | null> {
  try {
    return (await ask('GET', table, `/${encodeURIComponent(id)}?returnFieldsByFieldId=true`)) as Row
  } catch {
    return null
  }
}

export async function add(table: string, fields: Fields): Promise<Row> {
  const made = await ask('POST', table, '', { records: [{ fields }], typecast: true, returnFieldsByFieldId: true })
  return made.records[0] as Row
}

export async function change(table: string, id: string, fields: Fields): Promise<Row> {
  const made = await ask('PATCH', table, '', { records: [{ id, fields }], typecast: true, returnFieldsByFieldId: true })
  return made.records[0] as Row
}

/** Puts a file in an attachment column of a row, after whatever is there. (Airtable takes these at an address of their own, five megabytes at most.) */
export async function attach(id: string, field: string, file: { name: string; type: string; base64: string }): Promise<void> {
  const res = await fetch(`https://content.airtable.com/v0/${BASE}/${encodeURIComponent(id)}/${field}/uploadAttachment`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.airtable}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType: file.type, filename: file.name, file: file.base64 }),
  })
  if (!res.ok) throw new Error(`Airtable attach ${field}: ${res.status}`)
}

export async function remove(table: string, id: string): Promise<void> {
  await ask('DELETE', table, `/${encodeURIComponent(id)}`)
}

export const str = (value: unknown) => (typeof value === 'string' ? value : '')
export const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
export const list = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])
/** The files in an attachment column. */
export const files = (value: unknown) =>
  Array.isArray(value) ? (value as { url?: string; filename?: string; type?: string; thumbnails?: { large?: { url?: string } } }[]).filter((file) => typeof file?.url === 'string') : []
