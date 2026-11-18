import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { ArrowUpRight, Check, ChevronDown, Copy, Ellipsis, Folder, FolderPlus, LayoutGrid, List as ListIcon, Minus, Paperclip, Search, Share, SquarePen, Trash2, X } from 'lucide-react'
import { showNote, sought } from '../../apps/state'
import { ANSWER_PENDING, ANSWER_PLACEHOLDER, FAQS, waysOn } from '../../data/faqs'
import { DRAFT, SITE } from '../../data/site'
import { useStore } from '../../os/store'
import '../../styles/phone/notes.css'
import { pageUrl, share } from '../native'
import { closeSheet, launchAt, openSheet, pop, push, sys, topOf } from '../system'
import { BackButton, Cell, Empty, GlassButton, GlassGroup, GroupButton, List, Menu, NavStack, Screen, SearchBar, Sheet, SheetHost, type MenuItem } from '../ui'
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
  found,
  isBlank,
  isFolder,
  isOwnFolder,
  nameOnOffer,
  ownView,
  pageDate,
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
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
      <circle cx="5.2" cy="6" r="2.4" fill="currentColor" />
      <circle cx="5.2" cy="12" r="2.4" />
      <circle cx="5.2" cy="18" r="2.4" />
      <path d="M11.2 6H21M11.2 12H21M11.2 18H21" />
    </svg>
  )
}

/** The tip of a pen, in a circle. */
function MarkupGlyph() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9.3" />
      <path d="M8.7 19.6 12 7.2l3.3 12.4M10.4 13.2h3.2" />
    </svg>
  )
}

const bar = { size: 22, strokeWidth: 2.1, 'aria-hidden': true } as const
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

/** Text with the part that matched the search marked, as Notes marks it. */
function Marked({ text, q }: { text: string; q: string }): ReactNode {
  const at = q ? text.toLowerCase().indexOf(q) : -1
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <mark className="notes-hit">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  )
}

/** A row shows one line of its note. When the search matched further in than
 * that line reaches, the line starts just before the match instead. */
function lineFor(entry: Entry, q: string) {
  const text = entry.text.replace(/\s+/g, ' ').trim()
  const at = q ? text.toLowerCase().indexOf(q) : -1
  if (at < 0) return restOf(entry)
  if (at < 26) return text
  const from = text.lastIndexOf(' ', at - 12)
  return `…${text.slice(from < 0 ? at : from + 1)}`
}

interface Searching {
  query: string
  /** The query as it is matched: trimmed, in lower case. */
  q: string
  /** The field has the keyboard, or has something in it: the screen is given over to the search. */
  active: boolean
  setQuery: (query: string) => void
  onFocus: () => void
  onBlur: () => void
  cancel: () => void
}

function useSearching(): Searching {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const leaving = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(leaving.current), [])
  return {
    query,
    q: query.trim().toLowerCase(),
    active: focused || query !== '',
    setQuery,
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
      <SquarePen {...bar} />
    </GlassButton>
  )
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
      onClick={() => push(entry.view)}
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
  const search = useSearching()
  const within = (id: string) => notes.filter((n) => n.folder === id).length
  const rows = [{ id: FAQS_ID, name: 'FAQs', count: FAQS.length, own: false }, { id: NOTES_ID, name: 'Notes', count: within(NOTES_ID), own: false }, ...folders.map((f) => ({ id: f.id, name: f.name, count: within(f.id), own: true }))]
  const icon = <Folder className="notes-folder__icon" size={24} strokeWidth={1.9} aria-hidden />

  return (
    <Screen
      title="Folders"
      large
      tone="grouped"
      className="notes-screen"
      trailing={
        search.active ? undefined : editing ? (
          <GlassButton label="Done" prominent onClick={() => setEditing(false)}>
            <Check size={22} strokeWidth={2.8} aria-hidden />
          </GlassButton>
        ) : (
          <GlassButton label="Edit" wide onClick={() => setEditing(true)}>
            Edit
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
  const search = useSearching()
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
      large
      subtitle={countOf(entries.length)}
      tone="grouped"
      className="notes-screen"
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
    // A link that opens on the FAQs, where the page has an address to link to
    const url = /^https?:$/.test(location.protocol) ? `${pageUrl()}?open=faqs` : undefined
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
      leading={<BackButton onClick={leave} />}
      trailing={
        <span className="notes-contents" onMouseDown={keepKeyboard}>
          <GlassGroup label="This note">
            <GroupButton label={said ?? 'Share'} disabled={!words} onClick={send}>
              {said ? <Check size={21} strokeWidth={2.6} aria-hidden /> : <Share size={21} strokeWidth={2.1} aria-hidden style={{ marginTop: -2 }} />}
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
              <Paperclip size={21} strokeWidth={2} aria-hidden />
            </GroupButton>
            <GroupButton label="Markup" disabled>
              <MarkupGlyph />
            </GroupButton>
          </GlassGroup>
          <GlassButton label="New Note" onClick={() => compose(entry.folder)}>
            <SquarePen {...bar} />
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

  return (
    <NoteScreen entry={entry}>
      <article className="notes-note">
        <p className="notes-note__date">{pageDate(entry.edited)}</p>
        <h2 className="notes-note__title">{faq.question}</h2>
        {faq.answer ? (
          <p className="notes-note__body">{faq.answer}</p>
        ) : DRAFT ? (
          <p className="notes-slot">{ANSWER_PLACEHOLDER}</p>
        ) : (
          // No answer yet: said to the visitor as it is, with the way on
          <>
            <p className="notes-note__body">{ANSWER_PENDING}</p>
            <p className="notes-ways">
              {waysOn(faq.question).map((way) => (
                <a key={way.label} className="notes-way" href={way.href} {...(way.leaves ? { target: '_blank', rel: 'noreferrer' } : null)}>
                  {way.label}
                  {way.leaves && (
                    <>
                      <ArrowUpRight size={18} strokeWidth={2.6} aria-hidden />
                      <span className="sr-only">, opens in a new tab</span>
                    </>
                  )}
                </a>
              ))}
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
