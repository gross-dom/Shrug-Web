import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { Check, ChevronDown, Copy, Ellipsis, Folder, FolderPlus, LayoutGrid, List as ListIcon, Minus, Paperclip, Search, Share, Trash2, X } from 'lucide-react'
import { showNote, sought } from '../../apps/state'
import { Answer } from '../../apps/answer'
import { ANSWER_PENDING, ANSWER_PLACEHOLDER, FAQS, waysOn } from '../../data/faqs'
import { DRAFT, SITE } from '../../data/site'
import { useStore } from '../../os/store'
import { openOnePager } from '../../os/papers'
import '../../styles/phone/notes.css'
import { pageUrl, share } from '../native'
import { closeSheet, goHome, launchAt, openSheet, pop, push, sys, topOf } from '../system'
import { BackButton, Cell, ComposeGlyph, Empty, GlassButton, GlassGroup, GroupButton, List, Menu, NavStack, scaleOf, Screen, SearchBar, ShareGlyph, Sheet, SheetHost, type MenuItem } from '../ui'
import {
  FAQS_ID,
  NAME_LENGTH,
  NOTES_ID,
  addFolder,
  addNote,
  allEntries,
  book,
  byDate,
  countOf,
  editNote,
  entriesIn,
  faqEntry,
  folderName,
  folderViewOf,
  folded,
  found,
  isBlank,
  isFolder,
  isOwnFolder,
  nameOnOffer,
  ownView,
  pageDate,
  placeOf,
  removeFolder,
  removeNote,
  restOf,
  rowDate,
  sorted,
  titleOf,
  type Entry,
  type OwnNote,
} from './notes-store'

// The FAQs as the Notes app, laid out as Notes is: Folders, a folder's notes
// under the days they were last touched, and a note on a page of its own. The
// questions are the site's and are there to be read; the answers haven't been
// written yet, so each note says so and gives the way on (the editor's view,
// `?draft`, shows the slot the answer goes in). Beside them the visitor has
// what any Notes has: a note of their own to write, and folders to make.

// ---- Glyphs the icon set has nothing close to ----

/** Three rows, each a mark and a line; the first one ticked off. */
function ChecklistGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="5.3" cy="7" r="4.3" fill="currentColor" stroke="none" />
      <path d="m3.4 7.1 1.4 1.4 2.5-2.9" stroke="#fff" strokeWidth="1.5" />
      <circle cx="5.3" cy="17" r="3.3" />
      <path d="M13 7h9M13 17h9" />
    </svg>
  )
}

/** The tip of a pen, in a circle. */
function MarkupGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9.6" />
      <path d="M8.6 20.2 12 7.4l3.4 12.8M10.2 14h3.6" />
    </svg>
  )
}

/** A pen across three loops: the tools that rewrite what is written. */
function RewriteGlyph() {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <ellipse cx="11.2" cy="12.8" rx="9" ry="4.1" transform="rotate(60 11.2 12.8)" />
      <ellipse cx="11.2" cy="12.8" rx="9" ry="4.1" transform="rotate(-60 11.2 12.8)" />
      <ellipse cx="11.2" cy="12.8" rx="9" ry="4.1" />
      <path d="m9.6 15.2.7-3 8.6-8.6a1.5 1.5 0 0 1 2.2 2.2l-8.6 8.6z" fill="var(--glyph-ground, #fff)" />
    </svg>
  )
}

const bar = { size: 24, strokeWidth: 2, 'aria-hidden': true } as const
const inMenu = { size: 19, strokeWidth: 2.1 } as const

// ---- New notes ----

const NEW_FOLDER = 'new-folder'

/** The note a New Note press has just made: its page takes the keyboard as it arrives. */
let fresh: string | null = null

/** The title of the visitor's note that is open, for a New Note press that finds it still empty. */
let openTitle: HTMLTextAreaElement | null = null

/** A new note, opened ready to type. It goes in the folder being looked at if
 * that is one of the visitor's, and in Notes otherwise: the FAQs are the site's. */
function compose(from: string) {
  const state = book.get()
  const into = from === NOTES_ID || isOwnFolder(state.folders, from) ? from : NOTES_ID
  // An empty note that is already open is the new note
  const stack = sys.get().stacks.notes
  const open = state.notes.find((n) => ownView(n.id) === stack[stack.length - 1])
  if (open && isBlank(open)) return openTitle?.focus({ preventScroll: true })
  const id = addNote(into)
  fresh = id
  // Its folder goes under it, so that Back shows where the note is kept
  launchAt('notes', [folderViewOf(into), ownView(id)])
}

/** Takes one of the visitor's notes away, once the page it was on has slid off. */
function discard(id: string) {
  pop()
  setTimeout(() => removeNote(id), 600)
}

// ---- Search ----

/** Text with the part that matched the search marked, as Notes marks it. `q` is as search compares it
 * (`folded`): what is marked is the text as it is written, its capitals and its curled marks with it. */
function Marked({ text, q }: { text: string; q: string }): ReactNode {
  const place = placeOf(text, q)
  if (!place) return text
  return (
    <>
      {text.slice(0, place[0])}
      <mark className="notes-hit">{text.slice(place[0], place[1])}</mark>
      {text.slice(place[1])}
    </>
  )
}

/** A row shows one line of its note. When the search matched further in than
 * that line reaches, the line starts just before the match instead. */
function lineFor(entry: Entry, q: string) {
  const text = entry.text.replace(/\s+/g, ' ').trim()
  const at = placeOf(text, q)?.[0] ?? -1
  if (at < 0) return restOf(entry)
  if (at < 26) return text
  const from = text.lastIndexOf(' ', at - 12)
  return `…${text.slice(from < 0 ? at : from + 1)}`
}

interface Searching {
  query: string
  /** The query as it is matched: trimmed, and folded as search folds what it compares (notes-store.ts). */
  q: string
  /** The field has the keyboard, or has something in it: the screen is given over to the search. */
  active: boolean
  setQuery: (query: string) => void
  onFocus: () => void
  onBlur: () => void
  cancel: () => void
}

/** `page` is what scrolls on the screen that is searched: what a search finds takes the list's place
 * there, beginning at its top, and the list comes back where it was left when the search is over (or has
 * nothing typed in it any more). */
function useSearching(page: RefObject<HTMLDivElement>): Searching {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const leaving = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(leaving.current), [])
  const q = folded(query.trim())
  /** Where the list was when what was found took its place: read as the first letter is typed, while the list is still what the page holds. */
  const place = useRef<number | null>(null)
  const finding = q !== ''
  useLayoutEffect(() => {
    const el = page.current
    if (!el) return
    if (finding) el.scrollTop = 0
    else if (place.current !== null) {
      el.scrollTop = place.current
      place.current = null
    }
  }, [finding]) // eslint-disable-line react-hooks/exhaustive-deps
  return {
    query,
    q,
    active: focused || query !== '',
    setQuery: (next) => {
      if (!q && folded(next.trim()) && place.current === null) place.current = page.current?.scrollTop ?? null
      setQuery(next)
    },
    onFocus: () => {
      clearTimeout(leaving.current)
      setFocused(true)
    },
    // A press on the close button takes the keyboard from the field first: the button stays until the press has landed
    onBlur: () => {
      leaving.current = setTimeout(() => setFocused(false), 180)
    },
    cancel: () => {
      clearTimeout(leaving.current)
      setQuery('')
      setFocused(false)
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    },
  }
}

/** The search field at the foot of a list. Escape is the shared search bar's to answer, as in every
 * app: it empties the field, then lets go of it, and only then means Back. */
function SearchField({ search }: { search: Searching }) {
  return <SearchBar value={search.query} onChange={search.setQuery} label="Search" onFocus={search.onFocus} onBlur={search.onBlur} />
}

/** What the trailing end of a list's foot holds: New Note, or the button that ends a search. */
function FootEnd({ search, folder }: { search: Searching; folder: string }) {
  return search.active ? (
    <GlassButton label="Cancel" onClick={search.cancel}>
      <X size={21} strokeWidth={2.4} aria-hidden />
    </GlassButton>
  ) : (
    <GlassButton label="New Note" onClick={() => compose(folder)}>
      <ComposeGlyph />
    </GlassButton>
  )
}

// ---- What a search found, in its note ----

/** What a search was looking for (folded, as it is matched) when one of the notes it found was opened,
 * and which note, and when: the note's page takes it up as it arrives. */
let carried: { view: string; q: string; at: number } | null = null

/** What the note at `view` was opened looking for, if it was opened from what a search found a moment ago. */
const carriedTo = (view: string) => (carried && carried.view === view && performance.now() - carried.at < 2000 ? carried.q : '')

/** The name the marks go by in the browser's own registry of them. notes.css colours them as it colours
 * a match in the list (`.notes-hit`). */
const HITS = 'notes-hit'

/** Shows where in a note the words a search was looking for are: every place is marked, and the first
 * is brought into sight. The note's words are not all this file's to draw (an answer is drawn by what the
 * desktop's window draws it with), so nothing is put round them: the browser is given the places and
 * paints them itself, where it can do that (where it cannot, the first is still brought into sight).
 * Only what is drawn as text can be marked so: a note of the visitor's own is two fields, and is left. */
function useHits(root: RefObject<HTMLElement>, q: string) {
  useLayoutEffect(() => {
    const el = root.current
    if (!q || !el) return
    // The note's words as search compares them, each folded letter known by the text it is in and where
    let all = ''
    const from: { node: Text; start: number; end: number }[] = []
    let block: Element | null = null
    const texts = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (node) => (node.parentElement?.closest('.sr-only, .notes-note__date') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) })
    for (let node = texts.nextNode() as Text | null; node; node = texts.nextNode() as Text | null) {
      // (the end of one paragraph and the start of the next are not one run of words)
      const within = node.parentElement?.closest('p, li, h2') ?? null
      if (block && within !== block) {
        all += '\n'
        from.push({ node, start: 0, end: 0 })
      }
      block = within
      let at = 0
      for (const ch of node.data) {
        const one = folded(ch)
        for (let i = 0; i < one.length; i++) from.push({ node, start: at, end: at + ch.length })
        all += one
        at += ch.length
      }
    }
    const places: Range[] = []
    for (let at = all.indexOf(q); at >= 0; at = all.indexOf(q, at + q.length)) {
      const first = from[at]!
      const last = from[at + q.length - 1]!
      const place = document.createRange()
      place.setStart(first.node, first.start)
      place.setEnd(last.node, last.end)
      places.push(place)
    }
    if (!places.length) return
    const marks = typeof Highlight === 'function' && typeof CSS !== 'undefined' && CSS.highlights ? new Highlight(...places) : null
    if (marks) CSS.highlights.set(HITS, marks)
    // The first of them, brought to a third of the way down the page unless it is in plain sight already
    // (under the bar, and over what floats at the foot)
    const page = el.closest<HTMLElement>('[data-scroller]')
    if (page) {
      const k = scaleOf(page)
      const top = (places[0]!.getBoundingClientRect().top - page.getBoundingClientRect().top) / k
      const clear = parseFloat(getComputedStyle(page).paddingTop) || 0
      if (top < clear + 8 || top > page.clientHeight - 150) page.scrollTop += top - Math.max(clear + 24, page.clientHeight / 3)
    }
    return () => {
      // (only its own: the next note to be opened may have set its marks before this one has gone)
      if (marks && CSS.highlights.get(HITS) === marks) CSS.highlights.delete(HITS)
    }
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps
}

// ---- A note in a list ----

/** A note's row: its name, then one line with its date and how it starts. `where` adds the folder it is in. */
function Row({ entry, q = '', where }: { entry: Entry; q?: string; where?: string | null }) {
  return (
    <Cell
      className="notes-row"
      // A title may be in a right-to-left script: it is set in its own direction, whatever is beside it
      title={
        <bdi>
          <Marked text={titleOf(entry)} q={q} />
        </bdi>
      }
      subtitle={
        <>
          {/* The commas are for a screen reader, which would otherwise run a row's parts together: "9:51 PMAnswer on its way" */}
          <span className="notes-row__line">
            <span className="sr-only">, </span>
            <span className="notes-row__when">{rowDate(entry.edited)}</span>
            <span className="sr-only">, </span>
            <Marked text={lineFor(entry, q)} q={q} />
          </span>
          {where && (
            <span className="notes-row__where">
              <Folder size={15} strokeWidth={2} aria-hidden />
              <span className="sr-only">, in </span>
              {where}
            </span>
          )}
        </>
      }
      onClick={() => {
        // Opened from what a search found, the note is told what was looked for: it shows where
        carried = q ? { view: entry.view, q, at: performance.now() } : null
        push(entry.view)
      }}
    />
  )
}

/** The same note in the gallery: its page in small, its name and its date. */
function Tile({ entry }: { entry: Entry }) {
  return (
    <button type="button" className="notes-tile" onClick={() => push(entry.view)}>
      <span className="notes-tile__page" aria-hidden>
        <b>{titleOf(entry)}</b>
        <span>{entry.text || (entry.faq === null ? '' : DRAFT ? ANSWER_PLACEHOLDER : ANSWER_PENDING)}</span>
      </span>
      <span className="notes-tile__title" dir="auto">
        {titleOf(entry)}
      </span>
      <span className="sr-only">, </span>
      <span className="notes-tile__when">{rowDate(entry.edited)}</span>
    </button>
  )
}

/** What a search found, in every folder. */
function Results({ search }: { search: Searching }) {
  const notes = useStore(book, (s) => s.notes)
  const folders = useStore(book, (s) => s.folders)
  const hits = useMemo(() => sorted(found(allEntries(notes), search.q), 'edited'), [notes, search.q])
  if (!hits.length)
    return (
      <Empty icon={<Search size={46} strokeWidth={2.2} />} title={`No Results for “${sought(search.query)}”`}>
        Check the spelling or try a new search.
      </Empty>
    )
  return (
    <List className="notes-list">
      <section className="ios-section">
        <h3 className="notes-group__header">Top Hits</h3>
        <div className="ios-section__rows">
          {hits.map((entry) => (
            <Row key={entry.view} entry={entry} q={search.q} where={folderName(folders, entry.folder)} />
          ))}
        </div>
      </section>
    </List>
  )
}

// ---- Folders ----

/** What a folder that can't be edited does when pressed while the others are being edited. */
const fixed = () => {}

function Folders() {
  const folders = useStore(book, (s) => s.folders)
  const notes = useStore(book, (s) => s.notes)
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(true)
  const scroll = useRef<HTMLDivElement>(null)
  const search = useSearching(scroll)
  const within = (id: string) => notes.filter((n) => n.folder === id).length
  const rows = [{ id: FAQS_ID, name: 'FAQs', count: FAQS.length, own: false }, { id: NOTES_ID, name: 'Notes', count: within(NOTES_ID), own: false }, ...folders.map((f) => ({ id: f.id, name: f.name, count: within(f.id), own: true }))]
  const icon = <Folder className="notes-folder__icon" size={24} strokeWidth={1.9} aria-hidden />

  return (
    <Screen
      title="Folders"
      large
      tone="grouped"
      className="notes-screen"
      scrollRef={scroll}
      // Where Notes has Edit, the way out: this is as far back as the app goes, and the Home Screen is next.
      // (Edit is still there, across the bar, once there is a folder of the visitor's own to take away)
      leading={
        !search.active && !editing && folders.length > 0 ? (
          <GlassButton label="Edit" wide onClick={() => setEditing(true)}>
            Edit
          </GlassButton>
        ) : undefined
      }
      trailing={
        search.active ? undefined : editing ? (
          <GlassButton label="Done" prominent onClick={() => setEditing(false)}>
            <Check size={22} strokeWidth={2.8} aria-hidden />
          </GlassButton>
        ) : (
          <GlassButton label="Exit to the Home Screen" wide onClick={goHome}>
            Exit
          </GlassButton>
        )
      }
      foot={
        <>
          {!search.active && (
            <GlassButton label="New Folder" onClick={() => openSheet(NEW_FOLDER)}>
              <FolderPlus {...bar} />
            </GlassButton>
          )}
          <SearchField search={search} />
          <FootEnd search={search} folder={NOTES_ID} />
        </>
      }
    >
      {search.q ? (
        <Results search={search} />
      ) : (
        <List className="notes-folders">
          {/* The account the folders are in, as Notes heads them: its name, and a chevron that folds them away */}
          <section className="ios-section notes-account" data-collapsed={!open || undefined}>
            <h3 className="notes-account__header">
              <button type="button" className="notes-account__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                <span>{SITE.name}</span>
                <ChevronDown className="notes-account__chevron" size={21} strokeWidth={2.7} aria-hidden />
              </button>
            </h3>
            <div className="notes-account__fold" {...(open ? null : ({ inert: '' } as object))}>
              <div className="ios-section__rows">
                {rows.map((row) =>
                  !editing ? (
                    <Cell key={row.id} className="notes-folder" lead={icon} title={row.name} value={row.count} chevron onClick={() => push(folderViewOf(row.id))} />
                  ) : row.own ? (
                    <Cell
                      key={row.id}
                      className="notes-folder notes-folder--editing"
                      lead={
                        <>
                          <button type="button" className="notes-minus" aria-label={`Delete ${row.name}`} onClick={() => removeFolder(row.id)}>
                            <Minus size={14} strokeWidth={3.6} aria-hidden />
                          </button>
                          {icon}
                        </>
                      }
                      title={row.name}
                      value={row.count}
                    />
                  ) : (
                    // The two folders Notes comes with can't be changed: they stand back, switched off, while the others are edited
                    <Cell
                      key={row.id}
                      className="notes-folder notes-folder--editing notes-folder--fixed"
                      lead={
                        <>
                          <span className="notes-minus-gap" aria-hidden />
                          {icon}
                        </>
                      }
                      title={row.name}
                      value={row.count}
                      disabled
                      onClick={fixed}
                    />
                  ),
                )}
              </div>
            </div>
          </section>
        </List>
      )}
    </Screen>
  )
}

/** The sheet a new folder is named in. */
function NewFolder() {
  // The name on offer is one no folder has yet: New Folder, New Folder 2, …
  const [name, setName] = useState(() => nameOnOffer(book.get().folders))
  const input = useRef<HTMLInputElement>(null)
  const ok = name.trim() !== ''

  // The name is there to be typed over
  useEffect(() => {
    input.current?.focus({ preventScroll: true })
    input.current?.select()
  }, [])

  const save = () => {
    if (!ok) return
    addFolder(name.trim())
    closeSheet()
  }

  return (
    <Sheet
      label="New Folder"
      title="New Folder"
      className="notes-sheet"
      leading={
        <GlassButton label="Cancel" onClick={() => closeSheet()}>
          <X size={20} strokeWidth={2.4} aria-hidden />
        </GlassButton>
      }
      trailing={
        <GlassButton label="Done" prominent disabled={!ok} onClick={save}>
          <Check size={22} strokeWidth={2.8} aria-hidden />
        </GlassButton>
      }
    >
      <div className="notes-name">
        <input
          ref={input}
          className="notes-name__input"
          type="text"
          aria-label="Name"
          placeholder="Name"
          autoComplete="off"
          enterKeyHint="done"
          dir="auto"
          maxLength={NAME_LENGTH}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
            e.preventDefault()
            save()
          }}
        />
        {name && (
          <button
            type="button"
            className="notes-name__clear"
            aria-label="Clear text"
            onClick={() => {
              setName('')
              input.current?.focus({ preventScroll: true })
            }}
          >
            <X size={11} strokeWidth={3.2} aria-hidden />
          </button>
        )}
      </div>
    </Sheet>
  )
}

// ---- A folder's notes ----

/** `folder` is a folder's id. One that isn't there (an address from before it was deleted) is an empty folder. */
function NotesList({ folder }: { folder: string }) {
  const name = useStore(book, (s) => folderName(s.folders, folder))
  const notes = useStore(book, (s) => s.notes)
  const gallery = useStore(book, (s) => s.gallery)
  const sort = useStore(book, (s) => s.sort)
  const grouped = useStore(book, (s) => s.grouped)
  const scroll = useRef<HTMLDivElement>(null)
  const search = useSearching(scroll)
  const entries = useMemo(() => sorted(entriesIn(notes, folder), sort), [notes, folder, sort])
  // The headings are by date, so they are for a folder in date order
  const dated = grouped && sort === 'edited'
  const groups = useMemo(() => (dated ? byDate(entries) : [{ label: null, entries }]), [entries, dated])

  const items: MenuItem[] = [
    gallery ? { label: 'View as List', icon: <ListIcon {...inMenu} />, onSelect: () => book.set((s) => ({ ...s, gallery: false })) } : { label: 'View as Gallery', icon: <LayoutGrid {...inMenu} />, onSelect: () => book.set((s) => ({ ...s, gallery: true })) },
    { label: 'Sort by Date Edited', checked: sort === 'edited', divided: true, onSelect: () => book.set((s) => ({ ...s, sort: 'edited' })) },
    { label: 'Sort by Title', checked: sort === 'title', onSelect: () => book.set((s) => ({ ...s, sort: 'title' })) },
    { label: 'Group by Date', checked: dated, toggle: true, disabled: sort !== 'edited', divided: true, onSelect: () => book.set((s) => ({ ...s, grouped: !s.grouped })) },
  ]

  return (
    <Screen
      title={name ?? 'Notes'}
      subtitle={countOf(entries.length)}
      tone="grouped"
      className="notes-screen"
      scrollRef={scroll}
      trailing={
        <Menu label="More" items={items}>
          <Ellipsis size={24} strokeWidth={2.3} aria-hidden />
        </Menu>
      }
      foot={
        <>
          <SearchField search={search} />
          <FootEnd search={search} folder={folder} />
        </>
      }
    >
      {search.q ? (
        <Results search={search} />
      ) : entries.length === 0 ? (
        <Empty title="No Notes" />
      ) : (
        <List className="notes-list">
          {groups.map((group) => (
            <section key={group.label ?? 'all'} className="ios-section">
              {group.label && <h3 className="notes-group__header">{group.label}</h3>}
              {gallery ? (
                <div className="notes-gallery">
                  {group.entries.map((entry) => (
                    <Tile key={entry.view} entry={entry} />
                  ))}
                </div>
              ) : (
                <div className="ios-section__rows">
                  {group.entries.map((entry) => (
                    <Row key={entry.view} entry={entry} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </List>
      )}
    </Screen>
  )
}

// ---- A note ----


/** A press on the bar doesn't take the keyboard from the note, as it doesn't on a phone. */
const keepKeyboard = (e: MouseEvent) => e.preventDefault()

/** Back from a note. The keyboard goes down with the page, not after it. */
function leave() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  pop()
}

/** The screen a note is on: Share and More over it, and the note's tools at its foot. */
function NoteScreen({ entry, editing = false, children }: { entry: Entry; editing?: boolean; children: ReactNode }) {
  const [said, setSaid] = useState<'Copied' | 'Link copied' | null>(null)
  const words = [entry.title.trim(), entry.text.trim()].filter(Boolean).join('\n\n')

  useEffect(() => {
    if (!said) return
    const t = setTimeout(() => setSaid(null), 1800)
    return () => clearTimeout(t)
  }, [said])

  const send = async () => {
    if (entry.faq === null) {
      if ((await share({ title: titleOf(entry), text: words, url: null })) === 'copied') setSaid('Copied')
      return
    }
    // A link that opens on this question
    const url = pageUrl()
    if ((await share({ title: `${SITE.name} FAQs`, text: entry.title, url })) === 'copied') setSaid('Link copied')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(words)
      setSaid('Copied')
    } catch {
      // Not allowed: nothing was copied, and nothing says it was
    }
  }

  const own = entry.own
  const items: MenuItem[] = [
    { label: 'Copy', icon: <Copy {...inMenu} />, disabled: !words, onSelect: copy },
    { label: 'Share Note', icon: <Share {...inMenu} />, disabled: !words, onSelect: send },
    ...(own ? [{ label: 'Delete Note', icon: <Trash2 {...inMenu} />, destructive: true, divided: true, onSelect: () => discard(own.id) }] : []),
  ]

  return (
    <Screen
      title={titleOf(entry)}
      // Notes keeps a note's bar clear: its title is the first line of the page
      center={<></>}
      className="notes-screen notes-screen--note"
      // One of the site's questions is only read: its page takes the keyboard so that a long answer can be scrolled with it
      readable={entry.faq !== null}
      leading={<BackButton onClick={leave} />}
      trailing={
        <span className="notes-contents" onMouseDown={keepKeyboard}>
          <GlassGroup label="This note">
            <GroupButton label={said ?? 'Share'} disabled={!words} onClick={send}>
              {said ? <Check size={22} strokeWidth={2.6} aria-hidden /> : <ShareGlyph />}
            </GroupButton>
            <Menu part label="More" items={items}>
              <Ellipsis size={24} strokeWidth={2.3} aria-hidden />
            </Menu>
          </GlassGroup>
          {editing && (
            <GlassButton
              label="Done"
              prominent
              onClick={() => {
                if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
              }}
            >
              <Check size={22} strokeWidth={2.8} aria-hidden />
            </GlassButton>
          )}
          <span className="sr-only" role="status">
            {said ?? ''}
          </span>
        </span>
      }
      foot={
        <>
          {/* Notes' tools for a note. None of them has anything to do here, and they say so */}
          <GlassGroup label="Tools">
            <GroupButton label="Checklist" disabled>
              <ChecklistGlyph />
            </GroupButton>
            <GroupButton label="Attachment" disabled>
              <Paperclip size={24} strokeWidth={2} aria-hidden />
            </GroupButton>
            <GroupButton label="Markup" disabled>
              <MarkupGlyph />
            </GroupButton>
            <GroupButton label="Writing Tools" disabled>
              <RewriteGlyph />
            </GroupButton>
          </GlassGroup>
          <GlassButton label="New Note" onClick={() => compose(entry.folder)}>
            <ComposeGlyph />
          </GlassButton>
        </>
      }
    >
      {children}
    </Screen>
  )
}

/** One of the site's questions, as a note. It is there to be read. */
function FaqNote({ index }: { index: number }) {
  const entry = faqEntry(index)!
  const faq = FAQS[index]!

  // The desktop's notes window shows the same note, should the screen become one
  useEffect(() => showNote(index), [index])

  // Opened from what a search found: where the words looked for are is marked, and brought into sight.
  // (What was looked for is read as the page is first drawn, and let go of once it has been)
  const page = useRef<HTMLElement>(null)
  const [q] = useState(() => carriedTo(entry.view))
  useEffect(() => {
    carried = null
  }, [])
  useHits(page, q)

  return (
    <NoteScreen entry={entry}>
      {/* No date over it, as there is over a note of the visitor's own: Notes shows none until the page is
          pulled down, and the dates the questions are filed under are dressing (notes-store.ts) */}
      <article ref={page} className="notes-note">
        <h2 className="notes-note__title">{faq.question}</h2>
        {faq.answer ? (
          <Answer text={faq.answer} className="notes-note__body" />
        ) : DRAFT ? (
          <p className="notes-slot">{ANSWER_PLACEHOLDER}</p>
        ) : (
          // No answer yet: said to the visitor as it is, with the way on
          <>
            <p className="notes-note__body">{ANSWER_PENDING}</p>
            <p className="notes-ways">
              {waysOn(faq.question).map((way) =>
                // The one-pager is an app here: nothing leaves for a tab of its own
                way.leaves ? (
                  <button key={way.label} type="button" className="notes-way" onClick={openOnePager}>
                    {way.label}
                  </button>
                ) : (
                  <a key={way.label} className="notes-way" href={way.href}>
                    {way.label}
                  </a>
                ),
              )}
            </p>
          </>
        )}
      </article>
    </NoteScreen>
  )
}

/** Puts the keyboard in a field, at its start or its end. */
function enter(field: HTMLTextAreaElement | null, at: 'start' | 'end') {
  if (!field) return
  field.focus({ preventScroll: true })
  const to = at === 'start' ? 0 : field.value.length
  field.setSelectionRange(to, to)
}

/** A note of the visitor's own: a title and what follows it, both typed straight onto the page. */
function OwnNotePage({ note }: { note: OwnNote }) {
  const [editing, setEditing] = useState(false)
  const title = useRef<HTMLTextAreaElement | null>(null)
  const body = useRef<HTMLTextAreaElement>(null)
  const entry = useMemo<Entry>(() => ({ view: ownView(note.id), folder: note.folder, title: note.title, text: note.body, edited: note.edited, faq: null, own: note }), [note])

  // Just made: the keyboard comes up on its title
  useLayoutEffect(() => {
    if (fresh !== note.id) return
    fresh = null
    title.current?.focus({ preventScroll: true })
  }, [note.id])

  const onTitle = (value: string) => {
    // A title is one line: anything pasted in below it belongs to the rest
    const [first = '', ...rest] = value.split('\n')
    if (!rest.length) return editNote(note.id, { title: first })
    editNote(note.id, { title: first, body: [...rest, note.body].join('\n').replace(/^\n+/, '') })
    requestAnimationFrame(() => enter(body.current, 'start'))
  }

  const onTitleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const field = e.currentTarget
    if (e.key === 'Escape') {
      e.preventDefault()
      field.blur()
    } else if ((e.key === 'Enter' && !e.nativeEvent.isComposing) || (e.key === 'ArrowDown' && field.selectionStart === field.value.length)) {
      e.preventDefault()
      enter(body.current, 'start')
    }
  }

  const onBodyKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const field = e.currentTarget
    const atStart = field.selectionStart === 0 && field.selectionEnd === 0
    if (e.key === 'Escape') {
      e.preventDefault()
      field.blur()
    } else if (atStart && (e.key === 'ArrowUp' || (e.key === 'Backspace' && !field.value))) {
      // Back up out of the top of the text is back into the title
      e.preventDefault()
      enter(title.current, 'end')
    }
  }

  return (
    <NoteScreen entry={entry} editing={editing}>
      <article
        className="notes-note notes-note--own"
        onFocus={() => setEditing(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setEditing(false)
        }}
        // A press on the page under the words carries on at their end
        onClick={(e) => {
          if (e.target === e.currentTarget) enter(body.current, 'end')
        }}
      >
        <p className="notes-note__date">{pageDate(note.edited)}</p>
        <span className="notes-grow notes-note__title" data-value={note.title}>
          <textarea
            ref={(el) => {
              if (el) openTitle = el
              else if (openTitle === title.current) openTitle = null
              title.current = el
            }}
            rows={1}
            aria-label="Title"
            autoCapitalize="sentences"
            enterKeyHint="next"
            dir="auto"
            value={note.title}
            onChange={(e) => onTitle(e.target.value)}
            onKeyDown={onTitleKey}
          />
        </span>
        <span className="notes-grow notes-note__body" data-value={note.body}>
          <textarea ref={body} rows={1} aria-label="Note" autoCapitalize="sentences" dir="auto" value={note.body} onChange={(e) => editNote(note.id, { body: e.target.value })} onKeyDown={onBodyKey} />
        </span>
      </article>
    </NoteScreen>
  )
}

// ---- The app ----

/** A view that names something no longer there: a note since deleted (Forward
 * can still ask for it), or a note or folder from before a reload on a page that
 * could not keep them, or an address from an older version of the page. It has
 * nothing of its own to draw. It is drawn as what it was in, and once it is the
 * screen in front the phone steps back to that: never an empty "Notes" that
 * was nobody's. */
function Gone({ view }: { view: string }) {
  const stack = useStore(sys, (s) => s.stacks.notes)
  const front = useStore(sys, (s) => s.app === 'notes' && !s.locked && !s.sheet)
  const at = stack.lastIndexOf(view)
  const top = at >= 0 && at === stack.length - 1

  useEffect(() => {
    if (!front || !top) return
    // Looked at afresh: where React runs an effect twice to check it, the step back has been taken by the second time
    const s = sys.get()
    if (s.app === 'notes' && topOf(s, 'notes') === view) pop()
  }, [front, top, view])

  // What it was in: the view under it, or, once it has left the stack and is sliding away, the one now in front
  return <Page view={at > 0 ? stack[at - 1]! : at === 0 ? null : (stack[stack.length - 1] ?? null)} />
}

/** The screen for a view in the app's stack. */
function Page({ view }: { view: string | null }) {
  const notes = useStore(book, (s) => s.notes)
  const folders = useStore(book, (s) => s.folders)
  if (view === null) return <Folders />
  const kind = view.slice(0, 2)
  const name = view.slice(2)
  if (kind === 'f:' && isFolder(folders, name)) return <NotesList folder={name} />
  if (kind === 'n:' && /^\d+$/.test(name) && FAQS[Number(name)]) return <FaqNote index={Number(name)} />
  const own = kind === 'u:' ? notes.find((n) => n.id === name) : undefined
  return own ? <OwnNotePage note={own} /> : <Gone view={view} />
}

export function NotesApp() {
  return (
    <>
      <NavStack>{(view) => <Page view={view} />}</NavStack>
      <SheetHost>{(name) => (name === NEW_FOLDER ? <NewFolder /> : null)}</SheetHost>
    </>
  )
}
