import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Ellipsis, LayoutGrid, List as ListIcon, Search, Share } from 'lucide-react'
import { notes, setNotesQuery, showNote } from '../../apps/state'
import { ANSWER_PLACEHOLDER, FAQS } from '../../data/faqs'
import { SITE } from '../../data/site'
import { Popover } from '../../kit/motion/Popover'
import { useStore } from '../../os/store'
import '../../styles/phone/notes.css'
import { pageUrl, share } from '../native'
import { pop, push, swap, sys } from '../system'
import { Cell, Empty, GlassGroup, GroupButton, List, Menu, NavStack, Screen, SearchBar, Section, useApp } from '../ui'
import { noteView } from './routes'

// The FAQs as the Notes app: a folder of notes, one to a question, and each
// note open on a page of its own. The questions are real; the answers haven't
// been written yet, so each note holds the slot for one, as the desktop's does.

// ---- When each note is from ----

/** The moment the visit began: what the notes are dated back from. */
const OPENED = Date.now()

/** Notes dates every note, and these have no dates of their own. Each is dated
 * back from the visit by its place in the folder (the first a few minutes ago,
 * the seventh a few days), so the folder reads newest first in the order the
 * questions are asked. The dates are dressing: nothing was written then. */
const editedAt = (index: number) => OPENED - Math.round(12 * Math.pow(2.6, index)) * 60_000

const DAY_MS = 86_400_000
const TIME = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: 'long' })
const SHORT = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'numeric', year: '2-digit' })
const FULL = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' })

/** How many midnights ago a moment was. */
const daysAgo = (t: number) => Math.round((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / DAY_MS)

/** A note's date as its row gives it: the time today, then Yesterday, the weekday, the date. */
function rowDate(t: number) {
  const days = daysAgo(t)
  return days <= 0 ? TIME.format(t) : days === 1 ? 'Yesterday' : days < 7 ? WEEKDAY.format(t) : SHORT.format(t)
}

/** What a note says under its title: the answer, or the slot kept for it. */
const textOf = (index: number) => FAQS[index]!.answer ?? ANSWER_PLACEHOLDER

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
function snippet(text: string, q: string) {
  const at = q ? text.toLowerCase().indexOf(q) : -1
  if (at < 26) return text
  const from = text.lastIndexOf(' ', at - 12)
  return `…${text.slice(from < 0 ? at : from + 1)}`
}

// ---- The folder ----

function Folder() {
  const query = useStore(notes, (s) => s.query)
  const [gallery, setGallery] = useState(false)
  const q = query.trim().toLowerCase()
  const shown = useMemo(() => FAQS.map((faq, index) => ({ faq, index })).filter(({ faq }) => !q || faq.question.toLowerCase().includes(q) || (faq.answer ?? '').toLowerCase().includes(q)), [q])
  const open = (index: number) => push(noteView(index))

  return (
    <Screen
      title="FAQs"
      large
      tone="grouped"
      className="notes-screen"
      trailing={
        <Menu
          label="View options"
          items={[
            { label: 'View as List', icon: <ListIcon size={19} strokeWidth={2.1} />, checked: !gallery, onSelect: () => setGallery(false) },
            { label: 'View as Gallery', icon: <LayoutGrid size={19} strokeWidth={2.1} />, checked: gallery, onSelect: () => setGallery(true) },
          ]}
        >
          <Ellipsis size={24} strokeWidth={2.3} aria-hidden />
        </Menu>
      }
      foot={<SearchBar value={query} onChange={setNotesQuery} label="Search the FAQs" />}
    >
      {shown.length === 0 ? (
        <Empty icon={<Search size={46} strokeWidth={2.2} />} title={`No Results for “${query.trim()}”`}>
          Check the spelling or try a new search.
        </Empty>
      ) : gallery ? (
        <div className="notes-gallery">
          {shown.map(({ faq, index }) => (
            <button key={index} type="button" className="notes-tile" onClick={() => open(index)}>
              <span className="notes-tile__page" aria-hidden>
                <b>{faq.question}</b>
                <span>{textOf(index)}</span>
              </span>
              <span className="notes-tile__title">
                <Marked text={faq.question} q={q} />
              </span>
              <span className="notes-tile__when">{rowDate(editedAt(index))}</span>
            </button>
          ))}
        </div>
      ) : (
        <List>
          <Section
            header={
              q ? (
                <span className="notes-found">
                  <span>Notes</span>
                  <span>{shown.length} Found</span>
                </span>
              ) : undefined
            }
          >
            {shown.map(({ faq, index }) => (
              <Cell
                key={index}
                className="notes-row"
                title={<Marked text={faq.question} q={q} />}
                subtitle={
                  <>
                    <span className="notes-row__when">{rowDate(editedAt(index))}</span>
                    {/* Only an answer is searched: the slot kept for one is not the note's own words */}
                    {faq.answer ? <Marked text={snippet(faq.answer, q)} q={q} /> : ANSWER_PLACEHOLDER}
                  </>
                }
                onClick={() => open(index)}
              />
            ))}
          </Section>
        </List>
      )}
      {!q && (
        <p className="notes-count">
          {FAQS.length} {FAQS.length === 1 ? 'Note' : 'Notes'}
        </p>
      )}
    </Screen>
  )
}

// ---- A note ----

/** Going from one note to the next swaps the page for another. This is which
 * note was turned to and which way, so the new page can come in from that
 * side and the keyboard can stay on the control that was pressed. */
let turned: { to: number; by: -1 | 1; from: 'foot' | 'menu' | 'keys' } | null = null

function step(index: number, by: -1 | 1, from: 'foot' | 'menu' | 'keys') {
  const to = index + by
  if (to < 0 || to >= FAQS.length) return
  turned = { to, by, from }
  swap(noteView(to))
}

/** Share and More, on one piece of glass, as Notes has them over a note. The
 * shared Menu is a button of its own, so the menu is opened from here, with
 * the shared menu's own list. */
function Tools({ index }: { index: number }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  const faq = FAQS[index]!

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', away, true)
    window.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away, true)
      window.removeEventListener('keydown', key)
    }
  }, [open])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(t)
  }, [copied])

  const send = async () => {
    // A link that opens on the FAQs, where the page has an address to link to
    const url = /^https?:$/.test(location.protocol) ? `${pageUrl()}?open=faqs` : undefined
    if ((await share({ title: `${SITE.name} FAQs`, text: faq.question, url })) === 'copied') setCopied(true)
  }

  const items: { label: string; icon: ReactNode; disabled?: boolean; divided?: boolean; onSelect: () => void }[] = [
    { label: 'Previous Question', icon: <ChevronUp size={19} strokeWidth={2.3} />, disabled: index === 0, onSelect: () => step(index, -1, 'menu') },
    { label: 'Next Question', icon: <ChevronDown size={19} strokeWidth={2.3} />, disabled: index === FAQS.length - 1, onSelect: () => step(index, 1, 'menu') },
    { label: 'All Questions', icon: <ListIcon size={19} strokeWidth={2.1} />, divided: true, onSelect: pop },
  ]

  return (
    <span ref={root} className="ios-menu">
      <GlassGroup label="This note">
        <GroupButton label={copied ? 'Link copied' : 'Share'} onClick={send}>
          {copied ? <Check size={21} strokeWidth={2.6} aria-hidden /> : <Share size={21} strokeWidth={2.1} aria-hidden style={{ marginTop: -2 }} />}
        </GroupButton>
        <button type="button" className="ios-group__part" aria-label="More" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Ellipsis size={24} strokeWidth={2.3} aria-hidden />
        </button>
      </GlassGroup>
      <span className="sr-only" role="status">
        {copied ? 'Link copied' : ''}
      </span>
      <Popover show={open} origin="top right" className="ios-menu__list notes-more" role="menu" aria-label="More" {...(open ? null : ({ inert: '' } as object))}>
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className="ios-menu__item"
            role="menuitem"
            aria-disabled={item.disabled || undefined}
            data-divided={item.divided || undefined}
            onClick={() => {
              if (item.disabled) return
              setOpen(false)
              item.onSelect()
            }}
          >
            <span className="ios-menu__label">{item.label}</span>
            <span className="ios-menu__icon" aria-hidden>
              {item.icon}
            </span>
          </button>
        ))}
      </Popover>
    </span>
  )
}

function Note({ index }: { index: number }) {
  const { active } = useApp()
  const faq = FAQS[index]!
  const page = useRef<HTMLElement>(null)
  const foot = useRef<HTMLDivElement>(null)
  const turn = turned && turned.to === index ? turned : null

  // The desktop's notes window shows the same note, should the screen become one
  useEffect(() => showNote(index), [index])

  // Turned to from the note before: the keyboard stays on the control that did it
  useEffect(() => {
    const arrived = turned && turned.to === index ? turned : null
    if (!arrived) return
    if (arrived.from === 'foot') {
      const buttons = foot.current?.querySelectorAll<HTMLElement>('button:not([aria-disabled="true"])')
      const same = foot.current?.querySelector<HTMLElement>(`button[data-step="${arrived.by}"]:not([aria-disabled="true"])`)
      ;(same ?? buttons?.[0])?.focus({ preventScroll: true })
    }
    const t = setTimeout(() => {
      if (turned === arrived) turned = null
    }, 500)
    return () => clearTimeout(t)
  }, [index])

  // Left and right go from note to note, for a keyboard
  useEffect(() => {
    if (!active) return
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest?.('input, textarea, [role="menu"]')) return
      const s = sys.get()
      if (s.sheet || s.stacks.notes[s.stacks.notes.length - 1] !== noteView(index)) return
      e.preventDefault()
      step(index, e.key === 'ArrowLeft' ? -1 : 1, 'keys')
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [active, index])

  return (
    <Screen
      title={faq.question}
      // Notes keeps a note's bar clear: its title is the first line of the page
      center={<></>}
      className="notes-screen"
      trailing={<Tools index={index} />}
      foot={
        <div ref={foot} className="notes-step">
          <GlassGroup label="Questions">
            <button type="button" className="ios-group__part" data-step="-1" aria-label="Previous question" aria-disabled={index === 0 || undefined} onClick={() => step(index, -1, 'foot')}>
              <ChevronLeft size={23} strokeWidth={2.3} aria-hidden />
            </button>
            <span className="notes-step__count" aria-live="polite">
              {index + 1} of {FAQS.length}
            </span>
            <button type="button" className="ios-group__part" data-step="1" aria-label="Next question" aria-disabled={index === FAQS.length - 1 || undefined} onClick={() => step(index, 1, 'foot')}>
              <ChevronRight size={23} strokeWidth={2.3} aria-hidden />
            </button>
          </GlassGroup>
        </div>
      }
    >
      <article ref={page} className="notes-note" data-turn={turn ? (turn.by > 0 ? 'on' : 'back') : undefined}>
        <p className="notes-note__date">{FULL.format(editedAt(index))}</p>
        <h2 className="notes-note__title">{faq.question}</h2>
        {faq.answer ? <p className="notes-note__body">{faq.answer}</p> : <p className="notes-slot">{ANSWER_PLACEHOLDER}</p>}
      </article>
    </Screen>
  )
}

/** A note that isn't there: an address from an older version of the page, or a mistyped one. */
function Missing() {
  return (
    <Screen title="FAQs" center={<></>} className="notes-screen">
      <Empty title="No Such Note">It may have been moved or removed.</Empty>
    </Screen>
  )
}

export function NotesApp() {
  return (
    <NavStack>
      {(view) => {
        if (view === null) return <Folder />
        const index = view.startsWith('n:') ? Number(view.slice(2)) : NaN
        return Number.isInteger(index) && FAQS[index] ? <Note index={index} /> : <Missing />
      }}
    </NavStack>
  )
}
