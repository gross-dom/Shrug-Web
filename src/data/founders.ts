import { PEOPLE } from './people'
import { COMPANIES } from './portfolio'

// Who in the group chat is behind which company in the portfolio. Nothing is
// written here by hand: a person's role, as Shrug gives it ("Co-Founder of
// Living Carbon"), names the company, and that is all the two lists need to
// find each other. A company's card can then say who in the conversation
// speaks for it, and a person's card which company is theirs, each a press
// away from the other.
//
// The name has to be there whole and by itself: "Founder of Acquire.com" is
// Acquire, and nobody's role is taken for a company whose name is only part
// of a longer word. The two companies that share a name are left out, since a
// role could not say which of them it meant.

const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const shared = new Set(COMPANIES.map((company) => company.name).filter((name, i, all) => all.indexOf(name) !== i))

/** By a person's place in the group: the key of the company their role names, or null. */
export const COMPANY_OF: (string | null)[] = PEOPLE.map((person) => {
  const theirs = COMPANIES.find((company) => !shared.has(company.name) && new RegExp(`(^|[^\\p{L}\\p{N}])${literal(company.name)}($|[^\\p{L}\\p{N}])`, 'iu').test(person.role))
  return theirs ? theirs.key : null
})

/** By a company's key: the people in the group whose role names it, in the order they reply in. */
export const PEOPLE_OF: Record<string, number[]> = {}
COMPANY_OF.forEach((key, person) => {
  if (key) (PEOPLE_OF[key] ??= []).push(person)
})

/** The people in the group who speak for a company; none for most. */
export const peopleOf = (key: string): number[] => PEOPLE_OF[key] ?? NOBODY
const NOBODY: number[] = []
