import { CASE_STUDIES } from './caseStudies'
import { listUnder } from './faqs'
import { PEOPLE } from './people'
import { COMPANIES, COMPANY_COUNT, VERTICALS } from './portfolio'
import { ABOUT, DRAFT, SITE } from './site'

// The one-pager: every line on its two pages (src/apps/preview/OnePager.tsx draws them, after design/v1's
// OnePager-Page1 and OnePager-Page2). It is the file on the desk, and it opens in Preview.
//
// The design's pages are a template: most of their lines are in [square brackets], for Shrug to write. A
// visitor never reads a note written for Shrug, so a line that has not been written is left off the page
// they are shown, and a block with nothing left in it goes with it. What they are shown instead is what
// the site already says, so that the page and the site cannot disagree: Shrug's own sentence, how many
// companies, the year, the fund, the partners, its rules of engagement (from its FAQs, in its own words),
// the first testimonials of the conversation, the verticals, the companies named. With `?draft` in the
// address the bracketed lines are drawn where they go, as the design has them.
//
// To write one: replace `todo('[…]')` with the line. Then run tools/onepager.cjs, which prints the file a
// visitor downloads.

/** A line that is Shrug's to write: drawn, in its brackets, only for the editor. */
const todo = (slot: string): string | null => (DRAFT ? slot : null)
/** A line written for the editor in place of one the site already has, which is what a visitor is shown. */
const until = (slot: string, said: string): string => (DRAFT ? slot : said)

const fact = (label: string) => ABOUT.facts.find((f) => f.label === label)?.value ?? ''
const sentence = (words: string) => words.charAt(0).toUpperCase() + words.slice(1)

/** The companies named on the first page, where the portfolio has them. */
const NAMED = ['Anduril', 'Varda', 'Hadrian', 'Eight Sleep', 'ModRetro', 'Liquid Death', 'Superhuman', 'Cameo'].filter((name) => COMPANIES.some((company) => company.name === name))

/** The first testimonials of the conversation that are short enough to set large, in the order the site has them. */
const SAID = PEOPLE.filter((person) => person.quote && person.quote.length <= 150)
  .slice(0, 4)
  .map((person) => ({ words: person.quote!, by: `${person.name}, ${person.role}` }))
const quote = (n: number, slot: string) => (DRAFT ? { words: slot, by: '[Name], [Role, Company]' } : (SAID[n] ?? null))

export interface Stat {
  value: string
  label: string
}

const partners = fact('Partners')
  .split(/,\s*/)
  .filter(Boolean)

export const ONE_PAGER = {
  /** The file's name, as Preview's bar and a download have it. */
  file: 'One-pager.pdf',
  dated: todo('[Month 2026]'),
  site: 'shrug.vip',
  contact: SITE.contact.email ?? todo('[Contact address]'),
  first: {
    headline: until('[One sentence on what Shrug is and who it backs.]', SITE.line),
    lead: todo(`${SITE.line} [Two more sentences: what it does for a founder beyond the check, and what Shrug V is.]`),
    stats: (DRAFT
      ? [
          { value: '[Fund size]', label: 'Shrug V' },
          { value: '[Check size]', label: 'First check' },
          { value: String(COMPANY_COUNT), label: 'Companies backed' },
          { value: fact('Started') || '[Year]', label: 'Investing since' },
        ]
      : [
          { value: fact('Fund').split(',')[0] ?? '', label: 'The fund' },
          { value: String(COMPANY_COUNT), label: 'Companies backed' },
          { value: String(PEOPLE.length), label: 'People on the record' },
          { value: fact('Started'), label: 'Investing since' },
        ]
    ).filter((stat) => stat.value) as Stat[],
    backs: DRAFT ? ['[Focus one]', '[Focus two]', '[Focus three]'] : ABOUT.backs.split(/,\s*|\s+and\s+/).map(sentence),
    // (Shrug's rules of engagement, as its FAQs give them)
    works: DRAFT ? ['[Principle one]', '[Principle two]', '[Principle three]'] : listUnder(/\brules\b/i),
    quotes: [quote(0, '[A testimonial, in the founder’s own words.]'), quote(1, '[A second testimonial.]')],
    beyond: DRAFT ? [1, 2, 3].map(() => ({ does: '[What Shrug does]', line: '[One line on it]' })) : [],
    portfolio: NAMED,
  },
  second: {
    headline: until('[What is different about Shrug V.]', `${fact('Fund')} fund.`),
    glance: (DRAFT
      ? [
          ['Fund', '[Size and vehicle]'],
          ['Stage', '[Stage]'],
          ['Check', '[Range]'],
          ['Leads rounds', '[Yes or no, and when]'],
          ['Board seats', '[Policy]'],
          ['First close', '[Date]'],
        ]
      : [
          ['Fund', fact('Fund')],
          ['Investing since', fact('Started')],
          ['Partners', partners.join(', ')],
          ['Backs', ABOUT.backs],
        ]
    ).filter((row) => row[1]) as [string, string][],
    team: (partners.length ? partners : DRAFT ? ['[Partner name]', '[Partner name]'] : []).map((name) => ({ name, line: todo('[One line]') })),
    cases: DRAFT ? [1, 2, 3].map(() => '[Company]: [what happened, in a line]') : CASE_STUDIES,
    // (the verticals the portfolio is sorted into, less the one whose name is a joke between friends)
    verticals: VERTICALS.map((vertical) => vertical.name).filter((name) => !name.startsWith('“')),
    quotes: [quote(2, '[A third testimonial.]'), quote(3, '[A fourth testimonial.]')],
    said: `${PEOPLE.length} founders and investors say what it is like to work with Shrug, in the group chat at shrug.vip.`,
  },
}
