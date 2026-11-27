import { PEOPLE } from './people'

// Mail: twenty email exchanges that led to something, to be read and nothing more (design/v1, "Mail").
//
// The copy is templated for now, as the design has it: a sender, a subject and the lines of each email are
// in [square brackets], and stand where the real exchanges will go, with addresses and personal details
// removed. Mail is public, except an exchange that says it is `locked`: that one is listed to everyone and
// read only by someone logged in (Dom, 27 Nov). To put a real exchange in, replace a row of EXCHANGES: who it was
// from, its subject, its first line, what it led to (which is also the split it is filed under), its date,
// one line on what happened because of it, who was in it, and the emails themselves, oldest first.

/** What an exchange led to. It is the tag on its row, and the split it is under. */
export type Led = 'Investment' | 'Intro' | 'Hire' | 'Drop'

export interface Email {
  from: string
  to: string
  /** When it was sent, as a date and time. */
  at: string
  /** Its paragraphs. */
  body: string[]
}

export interface Exchange {
  id: string
  from: string
  subject: string
  /** The first line of the newest email, as the inbox shows it. */
  first: string
  led: Led
  /** The day of the newest email. */
  date: string
  /** One line: what happened because of this exchange, and how soon. */
  ledTo: string
  /** Something on the desktop that shows what it led to: a company in the Portfolio, or the VIP Store. */
  opens?: { company: string } | { app: 'store' }
  /** Who was in it, and where each is from. */
  people: { name: string; of: string }[]
  emails: Email[]
  /** It is for someone logged in: anyone else sees who it was from and its subject, with a lock, and is asked to log in to read it. */
  locked?: boolean
}

export const SPLITS: { id: 'all' | Led; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'Investment', label: 'Investments' },
  { id: 'Intro', label: 'Intros' },
  { id: 'Hire', label: 'Hires' },
  { id: 'Drop', label: 'Drops' },
]

// ---- The template: twenty rows, as the design lists them

const WHO = ['Founder', 'Investor', 'Operator', 'Creator', 'Athlete']
const SUBJECTS = ['Intro: [Founder] and [Investor]', 'Re: [Company] seed round', 'Quick favor', 'Re: the [role] search', '[Drop] is on its way', 'Following up from [event]', 'Re: thoughts on the deck?', 'You two should meet', 'Re: allocation', 'A small thank-you']
const LED: Led[] = ['Investment', 'Intro', 'Investment', 'Hire', 'Drop', 'Intro', 'Investment', 'Intro', 'Investment', 'Drop', 'Intro', 'Hire', 'Investment', 'Drop', 'Intro', 'Investment', 'Hire', 'Intro', 'Drop', 'Investment']
const DAYS = ['2026-11-18', '2026-11-11', '2026-10-30', '2026-10-22', '2026-10-09', '2026-09-27', '2026-09-14', '2026-08-31', '2026-08-12', '2026-07-29', '2026-07-08', '2026-06-20', '2026-06-02', '2026-05-19', '2026-05-06', '2026-04-23', '2026-04-04', '2026-03-17', '2026-02-26', '2026-02-03']

const before = (day: string, days: number) => new Date(Date.parse(`${day}T12:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10)

export const EXCHANGES: Exchange[] = DAYS.map((day, i) => {
  const from = `[${WHO[i % WHO.length]} ${String(i + 1).padStart(2, '0')}]`
  return {
    id: `exchange-${i + 1}`,
    from,
    subject: SUBJECTS[i % SUBJECTS.length]!,
    first: '[First line of the email, as written.]',
    led: LED[i]!,
    // (in the template, the ones that led to an investment are the ones kept for someone logged in: seven of the twenty)
    locked: LED[i] === 'Investment',
    date: day,
    ledTo: '[One line: what happened because of this exchange, and how soon.]',
    people: [
      { name: 'Niv', of: 'Shrug' },
      { name: '[Founder]', of: '[Company]' },
      { name: from, of: '[Firm]' },
    ],
    emails: [
      { from, to: 'Niv', at: `${before(day, 2)}T16:20:00`, body: ['[First line of the earlier email.]'] },
      { from: 'Niv', to: from, at: `${before(day, 1)}T08:05:00`, body: ['[First line of the reply.]'] },
      { from: 'Niv', to: `[Founder], ${from}`, at: `${day}T09:14:00`, body: ['[The email, as written. Addresses and personal details are removed.]', '[Second paragraph.]'] },
      { from: '[Founder]', to: `Niv, ${from}`, at: `${day}T09:52:00`, body: ['[The reply, as written.]'] },
    ],
  }
})

/** Inbox Zero's line: a sentence from the testimonials about how quick Shrug is to answer, in its speaker's own words. */
export const ZERO_LINE = (() => {
  for (const person of PEOPLE) {
    const sentence = person.quote?.match(/[^.!?]*\bresponsive\b[^.!?]*[.!?]/i)?.[0]?.trim()
    if (sentence) return { words: sentence, by: person.name }
  }
  return null
})()
