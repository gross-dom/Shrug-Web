import { answerBlocks, FAQS, type Block } from './faqs'
import { PEOPLE, RELATION_LABEL, type Relation } from './people'
import { VERTICALS } from './portfolio'

// The books that can be read here: the Library in Books (src/apps/Books.tsx), and its reader
// (src/apps/Reader.tsx). Each is in leaves: a title leaf, chapters of words, and plates (a photograph to a
// page).
//
// The Library is the digital shelf, and it has what the Book Store does not sell: three titles of its own,
// none of them one of the five printed books (Dom's fourth round: the two are not to be mixed up). Nothing
// is written for them. Each is set from what Shrug has already said on this site: Frequently Asked from the
// questions it is asked and its answers (src/data/faqs.ts), In Their Words from what the people it works
// with have said of it (src/data/people.ts), and The Portfolio from the companies it has backed and its one
// line on each (src/data/portfolio.ts). They stand in for the write-ups Shrug is working on. Until those
// arrive each is marked `standIn`, and a live build leaves a stand-in out of the Library, so that nobody is
// told these are finished books.

export type Leaf =
  | { kind: 'title'; title: string; by: string; note: string }
  | { kind: 'chapter'; id: string; title: string; blocks: Block[] }
  | { kind: 'plate'; id: string; src: string; set?: string; alt: string }

export interface Edition {
  /** What it goes by in addresses and in the reader's keeping: a short name of its own, in small letters. */
  of: string
  title: string
  leaves: Leaf[]
  /** Its pages are not the book's own yet (see above). */
  standIn: boolean
}

const titleLeaf = (title: string, note: string): Leaf => ({ kind: 'title', title, by: 'Made by Shrug', note })

/** What people have said, under how each of them knows Shrug: a chapter to each, their words and then who said them. */
const said = (relation: Relation): Block[] =>
  PEOPLE.filter((person) => person.quote && person.relations[0] === relation).flatMap((person): Block[] => [
    { kind: 'p', parts: [`“${person.quote!.replace(/^[“"]|[”"]$/g, '')}”`] },
    { kind: 'p', parts: [{ em: `${person.name}, ${person.role}` }] },
  ])

const ALL: Edition[] = [
  {
    of: 'frequently asked',
    title: 'Frequently Asked',
    standIn: true,
    leaves: [titleLeaf('Frequently Asked', 'The questions Shrug is asked, and its answers.'), ...FAQS.filter((faq) => faq.answer !== null).map((faq, n) => ({ kind: 'chapter' as const, id: `q${n + 1}`, title: faq.question, blocks: answerBlocks(faq.answer!) }))],
  },
  {
    of: 'in their words',
    title: 'In Their Words',
    standIn: true,
    leaves: [
      titleLeaf('In Their Words', 'What the people Shrug works with have said of it.'),
      ...(['F', 'L', 'C'] as Relation[]).map((relation) => ({ kind: 'chapter' as const, id: `said-${relation.toLowerCase()}`, title: RELATION_LABEL[relation], blocks: said(relation) })).filter((chapter) => chapter.blocks.length > 0),
    ],
  },
  {
    of: 'the portfolio',
    title: 'The Portfolio',
    standIn: true,
    leaves: [
      titleLeaf('The Portfolio', 'The companies Shrug has backed, by what they do.'),
      ...VERTICALS.map((vertical, n) => ({
        kind: 'chapter' as const,
        id: `v${n + 1}`,
        title: vertical.name,
        blocks: [{ kind: 'list' as const, items: vertical.companies.map((company) => [company.blurb ? `${company.name}: ${company.blurb}` : company.name]) }],
      })),
    ],
  },
]

const LIVE = import.meta.env.VITE_ACCOUNT === 'live'
/** The editions this build has: a live one leaves the stand-ins out. */
export const EDITIONS = ALL.filter((edition) => !LIVE || !edition.standIn)
export const editionOf = (name: string) => EDITIONS.find((edition) => edition.of === name.trim().toLowerCase()) ?? null
