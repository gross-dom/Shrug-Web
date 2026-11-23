import { CASE_STUDIES } from '@data/caseStudies'
import { DROPS, MEDIA } from '@data/drops'
import { PEOPLE, type Person, type Relation } from '@data/people'
import { COMPANIES, VERTICALS } from '@data/portfolio'
import { ABOUT, SITE } from '@data/site'

// What the pages say that is not a quote, a company or an answer: read from the same data as the desktop
// site, or written here where it is this site's own. Nothing here claims more than that data does.

export { CASE_STUDIES, COMPANIES, DROPS, MEDIA, PEOPLE, SITE, VERTICALS }
export type { Person, Relation }

/** How each kind of person is named on this site: a founder Shrug backed, someone who invests in Shrug, someone who invests beside it. */
export const KINDS: { id: Relation; label: string; one: string }[] = [
  { id: 'F', label: 'Founders', one: 'Founder backed by Shrug' },
  { id: 'L', label: 'Investors in Shrug', one: 'Investor in Shrug' },
  { id: 'C', label: 'Co-investors', one: 'Co-investor' },
]

/** The people who have something to say: everyone with a quote, in Shrug's own order. */
export const VOICES = PEOPLE.filter((person): person is Person & { quote: string } => !!person.quote)

/** The facts under the headline, each said in Shrug's own FAQs (src/data/site.ts keeps them). */
export const FACTS = [
  ...ABOUT.facts,
  { label: 'Backs', value: ABOUT.backs },
]

export const SOCIAL = [
  { label: 'X', href: 'https://twitter.com/ShrugCap' },
  { label: 'Instagram', href: 'https://www.instagram.com/shrugcap/' },
]

/** Where the case studies are kept once the PDF is supplied (vc/public). */
export const CASE_STUDIES_PDF = '/shrug-case-studies.pdf'
declare const __CASE_STUDIES_PDF__: boolean
export const HAS_CASE_STUDIES_PDF = __CASE_STUDIES_PDF__

/** Shrug's own write-up of each drop, where it has one (the pages its present site links to). */
export const DROP_STORY: Record<string, string> = {
  'Atoms x MKBHD': 'https://shrug.notion.site/Atoms-x-MKBHD-069fbc0e6a1844278826ed71041e03f0',
  'Feastables x Shrug': 'https://shrug.notion.site/Feastables-Drops-f0d490e8c717409198d29bfc632cf6b6',
  Billboards: 'https://shrug.notion.site/Shrug-Billboards-c463d3623cae4bfda122c0d2695a8658',
  'Alt x Shrug': 'https://shrug.notion.site/Alt-5c6b0293534f42e386984ee0d1918947',
  'VC Puzzle': 'https://shrug.notion.site/VC-Puzzle-bfe01898924149f4b0f24575f25e0c0e',
  'VC Sticker Pack': 'https://apps.apple.com/us/app/vc-sticker-pack/id1476977521',
}

/** A link's host, as it reads: no scheme, no www. */
export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Two letters for someone with no photograph. */
export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]!)
    .slice(0, 2)
    .join('')
    .toUpperCase()

/** The quotes that talk about the drops themselves (the merch, the boxes, the billboards): they stand among the pictures on the VIP wall. */
export const DROP_VOICES = VOICES.filter((person) => /\b(merch|billboard|boxes|gifts?|swag|calendar|puzzle|socks)\b/i.test(person.quote))
