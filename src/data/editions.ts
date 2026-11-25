import { answerBlocks, FAQS, type Block } from './faqs'

// The books that can be read here: the Library in Books (src/apps/Books.tsx), and its reader
// (src/apps/Reader.tsx). Each is a preview, in leaves: a title leaf, chapters of words, and plates
// (a photograph to a page).
//
// What is in them is real and Shrug's own, and nothing is written for them: "What is Shrug?" is set from the
// questions Shrug is asked and its answers (src/data/faqs.ts), and Chromatic and the WS Catalog from the
// photographs of those books that the store has (store/public/pictures). They stand in for the books'
// own pages, which are Shrug's to supply (a book's text, or its pages as pictures: an edition takes either).
// Until they are, each is marked `standIn`, and a live build leaves a stand-in out of the Library, so that
// nobody is told these are the printed pages.

export type Leaf =
  | { kind: 'title'; title: string; by: string; note: string }
  | { kind: 'chapter'; id: string; title: string; blocks: Block[] }
  | { kind: 'plate'; id: string; src: string; set?: string; alt: string }

export interface Edition {
  /** The book it is of: the product's name in the store, in small letters. */
  of: string
  title: string
  leaves: Leaf[]
  /** Its pages are not the book's own yet (see above). */
  standIn: boolean
}

const PICTURES = '/vip/store/pictures'
const plates = (slug: string, count: number, alt: string): Leaf[] =>
  Array.from({ length: count }, (_, n) => ({ kind: 'plate' as const, id: `${slug}-${n + 1}`, src: `${PICTURES}/${slug}-${n + 1}.webp`, set: `${PICTURES}/${slug}-${n + 1}-s.webp 760w, ${PICTURES}/${slug}-${n + 1}.webp 1800w`, alt: `${alt}, photograph ${n + 1}` }))

const ALL: Edition[] = [
  {
    of: 'what is shrug?',
    title: 'What is Shrug?',
    standIn: true,
    leaves: [
      { kind: 'title', title: 'What is Shrug?', by: 'Made by Shrug', note: 'A preview: the questions Shrug is asked, and its answers.' },
      ...FAQS.filter((faq) => faq.answer !== null).map((faq, n) => ({ kind: 'chapter' as const, id: `q${n + 1}`, title: faq.question, blocks: answerBlocks(faq.answer!) })),
    ],
  },
  {
    of: 'chromatic',
    title: 'Chromatic',
    standIn: true,
    leaves: [{ kind: 'title', title: 'Chromatic', by: 'Made by Shrug', note: 'A preview: the book, in photographs.' }, ...plates('chromatic', 3, 'Chromatic')],
  },
  {
    of: 'ws catalog',
    title: 'WS Catalog',
    standIn: true,
    leaves: [{ kind: 'title', title: 'WS Catalog', by: 'Made by Shrug', note: 'A preview: the book, in photographs.' }, ...plates('ws-catalog', 4, 'WS Catalog')],
  },
]

const LIVE = import.meta.env.VITE_ACCOUNT === 'live'
/** The editions this build has: a live one leaves the stand-ins out. */
export const EDITIONS = ALL.filter((edition) => !LIVE || !edition.standIn)
export const editionOf = (name: string) => EDITIONS.find((edition) => edition.of === name.trim().toLowerCase()) ?? null
