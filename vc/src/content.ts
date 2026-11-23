import { MEDIA } from '@data/drops'
import { PEOPLE, type Person, type Relation } from '@data/people'
import { COMPANIES, type Company } from '@data/portfolio'
import { SITE } from '@data/site'

// What the pages say that is not a quote, a company or an answer: read from the same data as the desktop
// site, or written here where it is this site's own. Nothing here claims more than that data does.

export { COMPANIES, MEDIA, SITE }
export type { Company, Person }

/** The line at the top left of every page, in place of a logo: the Story line from the brand strategy. */
export const LINE = 'Founders and their teams deserve fans.'

/** Where a visitor writes to. */
export const EMAIL = 'niv@shrug.vc'

/** The people who have something to say: everyone with a quote, in Shrug's own order. */
export const VOICES = PEOPLE.filter((person): person is Person & { quote: string } => !!person.quote)

/** What someone is to Shrug, as the pill under their name says it. The wording is the live site's, and the
 * look of each pill (solid, outlined, grey) is the design's: both are fixed. */
export const TAGS: Record<Relation, { says: string; look: 'solid' | 'outlined' | 'grey' }> = {
  F: { says: 'Received funding from Shrug', look: 'solid' },
  C: { says: 'Co-invested with Shrug', look: 'outlined' },
  L: { says: 'Investor in Shrug', look: 'grey' },
}

/** The small links at the foot of the menu. */
export const LINKS = [
  { label: 'X', href: 'https://twitter.com/ShrugCap' },
  { label: 'Instagram', href: 'https://instagram.com/shrugcap' },
  { label: 'Merch', href: 'https://shrug-capital-shop.fourthwall.com' },
  { label: 'shrug.vip', href: 'https://shrug.vip' },
  { label: EMAIL, href: `mailto:${EMAIL}` },
]

/** Where the VIP page sends a visitor who wants the whole of it. */
export const VIP_SITE = 'https://shrug.vip'

/** The case studies are one PDF, kept in vc/public once Shrug has supplied it. Until it is there the menu's
 * link goes to the page the case studies are on today. */
export const CASE_STUDIES_PDF = '/shrug-case-studies.pdf'
export const CASE_STUDIES_PAGE = 'https://www.shrug.vc/case-studies'
declare const __CASE_STUDIES_PDF__: boolean
export const HAS_CASE_STUDIES_PDF = __CASE_STUDIES_PDF__

/** The year the site was built in: what the copyright line says until the page has looked at the clock
 * (vc/vite.config.ts), so that the page as written and the page as it starts up agree. */
declare const __BUILT_IN__: number
export const BUILT_IN = __BUILT_IN__

/** Where one of the drops' photographs is on this site. The shared data has them at /vip, which here is a page. */
export const pictureOf = (src: string) => src.replace(/^\/vip\//, '/drops/')

/** Two letters for someone with no photograph. */
export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]!)
    .slice(0, 2)
    .join('')
    .toUpperCase()
