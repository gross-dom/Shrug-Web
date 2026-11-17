import { FAQS } from '../../data/faqs'
import { createStore } from '../../os/store'
import { sys } from '../system'
import { FAQS_FOLDER, noteView } from './routes'

// What Notes holds on the phone. The FAQs are the site's: a folder of seven
// notes, there to be read. Beside it the visitor has what any Notes has, a
// Notes folder of their own, folders they make, and notes they write. Those
// last as long as the page does: nothing is stored, and nothing is sent.

// ---- Folders ----

/** The names of Notes' screens in the app's stack (`sys.stacks.notes`). A
 * folder is `f:faqs`, `f:notes`, `f:u1`; a note of the visitor's is `u:a1`;
 * one of the site's is `n:3` (`noteView`, which search on the Home Screen uses too). */
export const folderViewOf = (id: string) => `f:${id}`
export const ownView = (id: string) => `u:${id}`

/** The site's folder, named as the rest of the phone names it, and the one the visitor's notes go in. */
export const FAQS_ID = FAQS_FOLDER.slice(2)
export const NOTES_ID = 'notes'

export interface OwnFolder {
  /** `u1`, `u2`: what tells a folder the visitor made from the two that come with the app. */
  id: string
  name: string
}

export interface OwnNote {
  id: string
  /** The folder it is in: `notes`, or one the visitor made. */
  folder: string
  /** Its first line. */
  title: string
  /** The rest of it. */
  body: string
  edited: number
}

export interface Book {
  folders: OwnFolder[]
  notes: OwnNote[]
  /** A folder's notes as thumbnails instead of rows. */
  gallery: boolean
  sort: 'edited' | 'title'
  /** Rows under Today, Yesterday, Previous 7 Days and so on. Only when sorted by date. */
  grouped: boolean
}

export const book = createStore<Book>({ folders: [], notes: [], gallery: false, sort: 'edited', grouped: true })

export const isOwnFolder = (folders: OwnFolder[], id: string) => folders.some((f) => f.id === id)

/** A folder's name, or null if there is no such folder. */
export function folderName(folders: OwnFolder[], id: string): string | null {
  if (id === FAQS_ID) return 'FAQs'
  if (id === NOTES_ID) return 'Notes'
  return folders.find((f) => f.id === id)?.name ?? null
}

let made = 0

export function addFolder(name: string) {
  const id = `u${++made}`
  book.set((s) => ({ ...s, folders: [...s.folders, { id, name }] }))
  return id
}

/** Takes a folder the visitor made away. What was in it goes to Notes, where it can still be found. */
export function removeFolder(id: string) {
  book.set((s) => ({ ...s, folders: s.folders.filter((f) => f.id !== id), notes: s.notes.map((n) => (n.folder === id ? { ...n, folder: NOTES_ID } : n)) }))
}

// ---- The visitor's notes ----

export function addNote(folder: string) {
  const id = `a${++made}`
  book.set((s) => ({ ...s, notes: [{ id, folder, title: '', body: '', edited: Date.now() }, ...s.notes] }))
  return id
}

export function editNote(id: string, change: Partial<Pick<OwnNote, 'title' | 'body'>>) {
  book.set((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, ...change, edited: Date.now() } : n)) }))
}

export const removeNote = (id: string) => book.set((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }))

export const isBlank = (note: OwnNote) => !note.title.trim() && !note.body.trim()

// A note nothing was typed in is not kept once it has been left, as Notes
// drops one. "Left" is no longer being anywhere in the app's stack. It is
// looked for a moment after each move, so a screen that is still sliding away
// keeps its note until it has gone.
let pruning: ReturnType<typeof setTimeout> | undefined

function prune() {
  const open = new Set(sys.get().stacks.notes)
  book.set((s) => {
    const notes = s.notes.filter((n) => !isBlank(n) || open.has(ownView(n.id)))
    return notes.length === s.notes.length ? s : { ...s, notes }
  })
}

sys.subscribe(() => {
  clearTimeout(pruning)
  pruning = setTimeout(prune, 700)
})

// ---- Every note, the site's and the visitor's, as a list shows them ----

export interface Entry {
  /** The view that opens it. */
  view: string
  /** The folder it is in. */
  folder: string
  /** Its first line. Empty where nothing has been typed yet. */
  title: string
  /** The rest of it. Empty where there is none: an answer not written yet. */
  text: string
  edited: number
  /** Which question it is, for one of the site's. */
  faq: number | null
  /** The note itself, for one of the visitor's. */
  own: OwnNote | null
}

const DAY_MS = 86_400_000
const startOfDay = (t: number) => new Date(t).setHours(0, 0, 0, 0)

/** The moment the visit began: what the site's notes are dated back from. */
const OPENED = Date.now()

/** Notes dates every note, and the questions have no dates of their own. Each
 * is dated back from the visit by its place in the folder: the first earlier
 * today, the next yesterday, and on back (days ago, then the time of day), so
 * the folder reads newest first in the order the questions are asked, under
 * each of the headings Notes sorts by. The dates are dressing: nothing was
 * written then. */
const BACK: [days: number, hour: number, minute: number][] = [
  [1, 16, 12],
  [3, 10, 5],
  [5, 18, 40],
  [12, 9, 27],
  [20, 14, 3],
  [75, 11, 48],
]

function faqEdited(index: number) {
  // Two hours before the visit began, or just after midnight where the day is younger than that
  if (index === 0) return Math.max(OPENED - 2 * 3_600_000, Math.min(OPENED, startOfDay(OPENED) + 60_000))
  const [days, hour, minute] = BACK[index - 1] ?? [75 + 30 * (index - BACK.length), 11, 48]
  const then = new Date(startOfDay(OPENED))
  then.setDate(then.getDate() - days)
  then.setHours(hour, minute, 0, 0)
  return then.getTime()
}

const FAQ_ENTRIES: Entry[] = FAQS.map((faq, index) => ({ view: noteView(index), folder: FAQS_ID, title: faq.question, text: faq.answer ?? '', edited: faqEdited(index), faq: index, own: null }))

const ownEntry = (note: OwnNote): Entry => ({ view: ownView(note.id), folder: note.folder, title: note.title, text: note.body, edited: note.edited, faq: null, own: note })

/** The notes in a folder. */
export const entriesIn = (notes: OwnNote[], folder: string): Entry[] => (folder === FAQS_ID ? FAQ_ENTRIES : notes.filter((n) => n.folder === folder).map(ownEntry))

/** Every note there is. */
export const allEntries = (notes: OwnNote[]): Entry[] => [...FAQ_ENTRIES, ...notes.map(ownEntry)]

export const faqEntry = (index: number): Entry | null => FAQ_ENTRIES[index] ?? null

/** A note's name in a list. One with nothing typed in it yet is "New Note", as Notes has it. */
export const titleOf = (entry: Entry) => entry.title.trim() || 'New Note'

/** What a list shows under the name: the first line of the rest, or what Notes says of a note that is only a title. */
export const NO_TEXT = 'No additional text'
export const firstLine = (entry: Entry) =>
  entry.text
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) ?? ''

export function sorted(entries: Entry[], sort: Book['sort']) {
  const by = sort === 'title' ? (a: Entry, b: Entry) => titleOf(a).localeCompare(titleOf(b)) : (a: Entry, b: Entry) => b.edited - a.edited
  return [...entries].sort(by)
}

/** The notes that have the words searched for, in their name or in the rest. `q` is trimmed and in lower case. */
export const found = (entries: Entry[], q: string) => (q ? entries.filter((e) => titleOf(e).toLowerCase().includes(q) || e.text.toLowerCase().includes(q)) : [])

// ---- Dates, as Notes writes them ----

const TIME = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: 'long' })
const SHORT = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'numeric', year: '2-digit' })
const MONTH = new Intl.DateTimeFormat(undefined, { month: 'long' })
const FULL = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' })

/** How many midnights ago a moment was. */
const daysAgo = (t: number) => Math.round((startOfDay(Date.now()) - startOfDay(t)) / DAY_MS)

/** A note's date in its row: the time today, then Yesterday, the weekday, the date. */
export function rowDate(t: number) {
  const days = daysAgo(t)
  return days <= 0 ? TIME.format(t) : days === 1 ? 'Yesterday' : days < 7 ? WEEKDAY.format(t) : SHORT.format(t)
}

/** The date over a note's own page: November 16, 2026 at 9:41 AM. */
export const pageDate = (t: number) => FULL.format(t)

/** The heading a note goes under when a folder is grouped by date. */
function heading(t: number) {
  const days = daysAgo(t)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days <= 7) return 'Previous 7 Days'
  if (days <= 30) return 'Previous 30 Days'
  const then = new Date(t)
  return then.getFullYear() === new Date().getFullYear() ? MONTH.format(then) : String(then.getFullYear())
}

export interface Group {
  /** Its heading; null where the folder isn't grouped. */
  label: string | null
  entries: Entry[]
}

/** Notes sorted newest first, under the headings Notes gives them. */
export function byDate(entries: Entry[]): Group[] {
  const groups: Group[] = []
  for (const entry of entries) {
    const label = heading(entry.edited)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.entries.push(entry)
    else groups.push({ label, entries: [entry] })
  }
  return groups
}

/** "7 Notes", "1 Note", "No Notes". */
export const countOf = (n: number) => (n === 0 ? 'No Notes' : `${n} ${n === 1 ? 'Note' : 'Notes'}`)
