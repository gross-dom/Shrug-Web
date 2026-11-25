import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowLeft, Calendar, Check, ChevronDown, ChevronUp, CircleHelp, Clock, CornerDownLeft, Flame, Forward, Inbox, Keyboard, Lightbulb, Link2, Lock, Mail as MailGlyph, Menu, MessageCircle, Reply, Search, Sparkles, SquarePen, Undo2, X, Zap } from 'lucide-react'
import { EXCHANGES, SPLITS, ZERO_LINE, type Exchange, type Led } from '../data/mail'
import { Window } from '../kit/window'
import { launchApp, showCompany } from '../os/launch'
import { writeToShrug } from '../os/write'
import '../styles/desk/mail.css'

// Mail (design/v1, "Mail"): twenty email exchanges that led to something, in a window that looks and is
// driven as Superhuman is. It is read-only. Every one of Superhuman's shortcuts is answered: the ones that
// move about, open, search and ask for the command palette do what they do there; the ones that would send,
// archive, star, snooze, label or delete say that nothing here changes. Reply opens a new message to Shrug
// in Messages. Everything in Mail is public.
//
// The shortcuts are COMMANDS, below: each has its name, its keys as Superhuman has them, and what it does
// here. The command palette (Cmd K) lists them, and so does the sheet that ? opens.

type Split = 'all' | Led

/** What a command does here. A string is what a read-only one says instead of doing anything. */
type Does = 'next' | 'previous' | 'open' | 'back' | 'next-split' | 'previous-split' | 'top' | 'bottom' | 'inbox' | 'search' | 'command' | 'shortcuts' | 'reply' | 'led' | 'next-message' | 'previous-message' | 'expand' | 'zero' | 'undo' | { says: string }

interface Command {
  id: string
  name: string
  /** Its keys, as they are drawn: one string to a key. */
  keys: string[]
  /** What a press must be to be it (see `pressed`): any of these. A pair after G is written "g i". */
  when: string[]
  group: 'Move about' | 'In a conversation' | 'Find and ask' | 'Read-only here'
  does: Does
}

const nothing = (done: string): Does => ({ says: `Read-only. Nothing is ${done}.` })
const elsewhere: Does = { says: 'There is only the inbox here: twenty exchanges that led to something.' }

const COMMANDS: Command[] = [
  { id: 'zero', name: 'Achieve Inbox Zero', keys: ['⌘', '⇧', 'E'], when: ['mod+shift+e'], group: 'Find and ask', does: 'zero' },
  { id: 'inbox', name: 'Go to Inbox', keys: ['G', 'I'], when: ['g i'], group: 'Move about', does: 'inbox' },
  { id: 'reply', name: 'Reply to Shrug in Messages', keys: ['R'], when: ['r'], group: 'In a conversation', does: 'reply' },
  { id: 'led', name: 'Open what this led to', keys: ['O'], when: [], group: 'In a conversation', does: 'led' },
  { id: 'search', name: 'Search all twenty', keys: ['/'], when: ['/'], group: 'Find and ask', does: 'search' },
  { id: 'shortcuts', name: 'Show keyboard shortcuts', keys: ['?'], when: ['?', 'mod+/'], group: 'Find and ask', does: 'shortcuts' },
  { id: 'command', name: 'Command', keys: ['⌘', 'K'], when: ['mod+k'], group: 'Find and ask', does: 'command' },
  { id: 'next', name: 'Next conversation', keys: ['J'], when: ['j', 'ArrowDown'], group: 'Move about', does: 'next' },
  { id: 'previous', name: 'Previous conversation', keys: ['K'], when: ['k', 'ArrowUp'], group: 'Move about', does: 'previous' },
  { id: 'open', name: 'Open conversation', keys: ['↵'], when: [], group: 'Move about', does: 'open' },
  { id: 'back', name: 'Back to inbox', keys: ['esc'], when: ['Escape'], group: 'Move about', does: 'back' },
  { id: 'next-split', name: 'Next split', keys: ['⇥'], when: ['Tab'], group: 'Move about', does: 'next-split' },
  { id: 'previous-split', name: 'Previous split', keys: ['⇧', '⇥'], when: ['shift+Tab'], group: 'Move about', does: 'previous-split' },
  { id: 'top', name: 'Go to top', keys: ['⌘', '↑'], when: ['mod+ArrowUp', 'Home'], group: 'Move about', does: 'top' },
  { id: 'bottom', name: 'Go to bottom', keys: ['⌘', '↓'], when: ['mod+ArrowDown', 'End'], group: 'Move about', does: 'bottom' },
  { id: 'next-message', name: 'Next message', keys: ['N'], when: ['n'], group: 'In a conversation', does: 'next-message' },
  { id: 'previous-message', name: 'Previous message', keys: ['P'], when: ['p'], group: 'In a conversation', does: 'previous-message' },
  { id: 'expand', name: 'Expand all messages', keys: ['⇧', 'O'], when: ['shift+o'], group: 'In a conversation', does: 'expand' },
  { id: 'reply-all', name: 'Reply all', keys: ['↵'], when: [], group: 'In a conversation', does: 'reply' },
  { id: 'compose', name: 'Compose', keys: ['C'], when: ['c'], group: 'In a conversation', does: 'reply' },
  { id: 'undo', name: 'Undo', keys: ['Z'], when: ['z'], group: 'Find and ask', does: 'undo' },
  // ---- what would change mail: said, and not done
  { id: 'done', name: 'Mark done', keys: ['E'], when: ['e'], group: 'Read-only here', does: nothing('marked done') },
  { id: 'not-done', name: 'Mark not done', keys: ['⇧', 'E'], when: ['shift+e'], group: 'Read-only here', does: nothing('moved back') },
  { id: 'remind', name: 'Remind me', keys: ['H'], when: ['h'], group: 'Read-only here', does: nothing('snoozed') },
  { id: 'star', name: 'Star', keys: ['S'], when: ['s'], group: 'Read-only here', does: nothing('starred') },
  { id: 'unread', name: 'Mark unread', keys: ['U'], when: ['u'], group: 'Read-only here', does: nothing('marked unread') },
  { id: 'read', name: 'Mark read', keys: ['⇧', 'U'], when: ['shift+u'], group: 'Read-only here', does: nothing('marked read') },
  { id: 'trash', name: 'Trash', keys: ['#'], when: ['#'], group: 'Read-only here', does: nothing('deleted') },
  { id: 'spam', name: 'Mark as spam', keys: ['!'], when: ['!'], group: 'Read-only here', does: nothing('marked as spam') },
  { id: 'label', name: 'Add or remove label', keys: ['L'], when: ['l'], group: 'Read-only here', does: nothing('labeled') },
  { id: 'unlabel', name: 'Remove label', keys: ['Y'], when: ['y'], group: 'Read-only here', does: nothing('unlabeled') },
  { id: 'move', name: 'Move', keys: ['V'], when: ['v'], group: 'Read-only here', does: nothing('moved') },
  { id: 'mute', name: 'Mute', keys: ['⇧', 'M'], when: ['shift+m'], group: 'Read-only here', does: nothing('muted') },
  { id: 'unsubscribe', name: 'Unsubscribe', keys: ['⌘', 'U'], when: ['mod+u'], group: 'Read-only here', does: nothing('unsubscribed from') },
  { id: 'select', name: 'Select conversation', keys: ['X'], when: ['x'], group: 'Read-only here', does: nothing('selected') },
  { id: 'select-more', name: 'Add to selection', keys: ['⇧', 'J'], when: ['shift+j', 'shift+k', 'shift+ArrowDown', 'shift+ArrowUp'], group: 'Read-only here', does: nothing('selected') },
  { id: 'forward', name: 'Forward', keys: ['F'], when: ['f'], group: 'Read-only here', does: nothing('forwarded') },
  { id: 'send', name: 'Send', keys: ['⌘', '↵'], when: ['mod+Enter', 'mod+shift+Enter'], group: 'Read-only here', does: nothing('sent') },
  { id: 'send-later', name: 'Send later', keys: ['⌘', '⇧', 'L'], when: ['mod+shift+l'], group: 'Read-only here', does: nothing('scheduled') },
  { id: 'snippet', name: 'Use snippet', keys: [';'], when: [';', 'mod+;'], group: 'Read-only here', does: nothing('written') },
  { id: 'intro', name: 'Instant intro', keys: ['⌘', '⇧', 'I'], when: ['mod+shift+i'], group: 'Read-only here', does: nothing('sent') },
  { id: 'redo', name: 'Redo', keys: ['⇧', 'Z'], when: ['shift+z'], group: 'Read-only here', does: nothing('redone') },
  { id: 'starred', name: 'Go to Starred', keys: ['G', 'S'], when: ['g s'], group: 'Read-only here', does: elsewhere },
  { id: 'drafts', name: 'Go to Drafts', keys: ['G', 'D'], when: ['g d'], group: 'Read-only here', does: elsewhere },
  { id: 'sent', name: 'Go to Sent', keys: ['G', 'T'], when: ['g t'], group: 'Read-only here', does: elsewhere },
  { id: 'done-folder', name: 'Go to Done', keys: ['G', 'E'], when: ['g e'], group: 'Read-only here', does: elsewhere },
  { id: 'reminders', name: 'Go to Reminders', keys: ['G', 'H'], when: ['g h'], group: 'Read-only here', does: elsewhere },
  { id: 'all-mail', name: 'Go to All Mail', keys: ['G', 'A'], when: ['g a'], group: 'Read-only here', does: elsewhere },
  { id: 'trash-folder', name: 'Go to Trash', keys: ['G', '#'], when: ['g #'], group: 'Read-only here', does: elsewhere },
  { id: 'spam-folder', name: 'Go to Spam', keys: ['G', '!'], when: ['g !'], group: 'Read-only here', does: elsewhere },
  { id: 'label-folder', name: 'Go to label', keys: ['G', 'L'], when: ['g l'], group: 'Read-only here', does: elsewhere },
]

/** The six the palette opens on, as the design lists them. */
const FIRST = ['zero', 'inbox', 'reply', 'led', 'search', 'shortcuts']
const GROUPS: Command['group'][] = ['Move about', 'In a conversation', 'Find and ask', 'Read-only here']

/** A press, as COMMANDS write one: "j", "shift+o", "mod+k", "Escape". (Shift is said for a letter and a named
 * key; a sign that needs it to be typed, as ? and # do, is the sign alone.) */
function pressed(e: KeyboardEvent | globalThis.KeyboardEvent) {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
  const parts: string[] = []
  if (e.metaKey || e.ctrlKey) parts.push('mod')
  if (e.shiftKey && (/^[a-z]$/.test(key) || key.length > 1)) parts.push('shift')
  parts.push(key)
  return parts.join('+')
}

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short' })
const MONTH_LONG = new Intl.DateTimeFormat('en-US', { month: 'long' })
const noon = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00`)
/** A day as Superhuman's list writes one: 18 NOV. */
const dayOf = (date: string) => `${noon(date).getDate()} ${MONTH.format(noon(date)).toUpperCase()}`
/** The heading a day's exchanges are listed under: the last week, the rest of this month, then a month at a time. */
function groupOf(date: string, now = new Date()): string {
  const day = noon(date)
  const ago = (now.getTime() - day.getTime()) / 86_400_000
  if (ago >= 0 && ago < 8) return 'Last 7 days'
  if (day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth()) return 'Earlier this month'
  return day.getFullYear() === now.getFullYear() ? MONTH_LONG.format(day) : `${MONTH_LONG.format(day)} ${day.getFullYear()}`
}

const K = ({ children }: { children: ReactNode }) => <kbd className="k">{children}</kbd>
const Keys = ({ keys }: { keys: string[] }) => (
  <span className="ml-keys">
    {keys.map((key, i) => (
      <K key={i}>{key}</K>
    ))}
  </span>
)

const ICON: Partial<Record<string, ReactNode>> = {
  zero: <Sparkles size={16} strokeWidth={1.9} aria-hidden />,
  inbox: <Inbox size={16} strokeWidth={1.9} aria-hidden />,
  reply: <MessageCircle size={16} strokeWidth={1.9} aria-hidden />,
  led: <CornerDownLeft size={16} strokeWidth={1.9} aria-hidden />,
  search: <Search size={16} strokeWidth={1.9} aria-hidden />,
  shortcuts: <Keyboard size={16} strokeWidth={1.9} aria-hidden />,
  undo: <Undo2 size={16} strokeWidth={1.9} aria-hidden />,
}

export function MailApp() {
  const root = useRef<HTMLDivElement>(null)
  const [split, setSplit] = useState<Split>('all')
  const [query, setQuery] = useState<string | null>(null)
  const [at, setAt] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const [over, setOver] = useState<'command' | 'shortcuts' | null>(null)
  const [zero, setZero] = useState(false)
  /** In a conversation: the message the keyboard is on, and the ones opened out of their one line. */
  const [message, setMessage] = useState(0)
  const [unfolded, setUnfolded] = useState<number[]>([])
  const [lit, setLit] = useState(false)
  const [said, setSaid] = useState<{ text: string; n: number } | null>(null)
  /** The hint under a search opened with the pointer: there is a key for it. */
  const [hint, setHint] = useState(false)
  const [tip, setTip] = useState(true)
  const g = useRef(0)

  const q = (query ?? '').trim().toLowerCase()
  const rows = useMemo(
    () => EXCHANGES.filter((x) => (split === 'all' || x.led === split) && (!q || [x.from, x.subject, x.first, x.led, x.ledTo].some((text) => text.toLowerCase().includes(q)))),
    [split, q],
  )
  const cursor = Math.min(at, Math.max(0, rows.length - 1))
  const thread = open ? (EXCHANGES.find((x) => x.id === open) ?? null) : null
  const count = (id: Split) => (id === 'all' ? EXCHANGES.length : EXCHANGES.filter((x) => x.led === id).length)

  const say = (text: string) => setSaid((s) => ({ text, n: (s?.n ?? 0) + 1 }))
  useEffect(() => {
    if (!said) return
    const timer = setTimeout(() => setSaid(null), 2600)
    return () => clearTimeout(timer)
  }, [said])
  // The keyboard is the window's own whenever nothing in it is being typed into
  const back = () => root.current?.focus()
  useEffect(() => {
    if (!over && query === null) back()
  }, [over, query, open, zero, unfolded])
  // The row the keyboard is on is kept in sight
  useEffect(() => {
    root.current?.querySelector('.ml-row.on')?.scrollIntoView({ block: 'nearest' })
  }, [cursor, split, q, open])

  const show = (x: Exchange) => {
    setOpen(x.id)
    // A conversation opens on its newest emails: the earlier ones are a line each until they are asked for
    setUnfolded([])
    setMessage(Math.max(0, x.emails.length - 2))
    setLit(false)
  }
  const stepThread = (by: number) => {
    const list = split === 'all' && !q ? EXCHANGES : rows
    const now = list.findIndex((x) => x.id === open)
    const to = list[Math.max(0, Math.min(list.length - 1, (now < 0 ? 0 : now) + by))]
    if (to) show(to), setAt(Math.max(0, rows.indexOf(to)))
  }

  const run = (does: Does) => {
    if (typeof does !== 'string') return say(does.says)
    switch (does) {
      case 'next':
        return thread ? stepThread(1) : setAt(Math.min(rows.length - 1, cursor + 1))
      case 'previous':
        return thread ? stepThread(-1) : setAt(Math.max(0, cursor - 1))
      case 'open':
        return void (!thread && rows[cursor] && show(rows[cursor]!))
      case 'back':
        if (zero) return setZero(false)
        if (thread) return setOpen(null)
        if (query !== null) return setQuery(null)
        return
      case 'next-split':
      case 'previous-split': {
        const now = SPLITS.findIndex((s) => s.id === split)
        setSplit(SPLITS[(now + (does === 'next-split' ? 1 : -1) + SPLITS.length) % SPLITS.length]!.id)
        setOpen(null)
        return setAt(0)
      }
      case 'top':
        return thread ? setMessage(0) : setAt(0)
      case 'bottom':
        return thread ? setMessage(thread.emails.length - 1) : setAt(rows.length - 1)
      case 'inbox':
        setZero(false)
        setOpen(null)
        setQuery(null)
        setSplit('all')
        return setAt(0)
      case 'search':
        setZero(false)
        setOpen(null)
        return setQuery((was) => was ?? '')
      case 'command':
        return setOver('command')
      case 'shortcuts':
        return setOver('shortcuts')
      case 'reply':
        // Nothing sends from here: a reply is a new message to Shrug, in Messages
        return writeToShrug(thread ? { subject: thread.subject } : undefined)
      case 'led': {
        const x = thread ?? rows[cursor]
        if (!x) return
        if (!thread) show(x)
        // Where the desktop has what it led to, that opens: the company in the Portfolio, or the store
        if (x.opens && 'company' in x.opens) return showCompany(x.opens.company)
        if (x.opens) return launchApp('store')
        return setLit(true)
      }
      case 'next-message':
        return void (thread && setMessage((m) => Math.min(thread.emails.length - 1, m + 1)))
      case 'previous-message':
        return void (thread && setMessage((m) => Math.max(0, m - 1)))
      case 'expand':
        return void (thread && setUnfolded(thread.emails.map((_, i) => i)))
      case 'zero':
        setOpen(null)
        setQuery(null)
        return setZero(true)
      case 'undo':
        return zero ? setZero(false) : say('Nothing to undo: nothing here changes.')
    }
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    // What is typed into a field is the field's, and a sheet over the window answers its own keys
    if (over || (e.target as HTMLElement).closest('input, textarea')) return
    if (e.altKey) return
    const press = pressed(e)
    // G, and then where to go
    if (g.current && Date.now() - g.current < 1500 && !e.metaKey && !e.ctrlKey && e.key.length === 1) {
      g.current = 0
      const pair = COMMANDS.find((c) => c.when.includes(`g ${press}`))
      e.preventDefault()
      return pair ? run(pair.does) : undefined
    }
    if (press === 'g') {
      g.current = Date.now()
      return e.preventDefault()
    }
    // Return and O say different things in the inbox and in a conversation
    let does: Does | undefined
    if (press === 'Enter' || press === 'o') does = zero ? undefined : thread ? (press === 'o' ? 'led' : 'reply') : 'open'
    else {
      does = COMMANDS.find((c) => c.when.includes(press))?.does
      // At Inbox Zero there is nothing to move through or act on: what answers is what leaves it, finds, or asks
      if (zero && !(typeof does === 'string' && ['undo', 'back', 'inbox', 'search', 'command', 'shortcuts', 'reply'].includes(does))) does = undefined
    }
    if (!does) return
    e.preventDefault()
    e.stopPropagation()
    run(does)
  }

  // A message the keyboard has moved to is opened out, and brought into sight
  useEffect(() => {
    if (!thread) return
    root.current?.querySelector(`[data-email="${message}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [message, thread])

  const splitName = SPLITS.find((s) => s.id === split)!.label
  /** Who the pane at the right is about: whoever the conversation open, or the row the keyboard is on, is from. */
  const about = thread ?? rows[cursor] ?? null
  const readOnly = (what: string) => say(`Read-only. Nothing is ${what}.`)

  // The title bar: one long pill, as a browser's tab would be, saying where this is
  const bar = (
    <div className="mlbar" data-zero={zero || undefined}>
      <span className="mlbar__pill">
        <i aria-hidden />
        {query !== null ? 'Search' : `${splitName} (${count(split)})`} - Mail
      </span>
      <span className="mlbar__plus" aria-hidden>
        +
      </span>
    </div>
  )

  const tabs = (
    <div className="ml-tabs" role="tablist" aria-label="Splits">
      {SPLITS.map((s) => (
        <button key={s.id} type="button" role="tab" aria-selected={split === s.id} className={split === s.id ? 'on' : undefined} onClick={() => (setSplit(s.id), setOpen(null), setZero(false), setAt(0), back())}>
          {s.label} <small>{count(s.id)}</small>
        </button>
      ))}
    </div>
  )
  const tools = (
    <span className="ml-tools">
      <button type="button" aria-label="New message to Shrug, in Messages" onClick={() => run('reply')}>
        <SquarePen size={15} strokeWidth={1.7} aria-hidden />
      </button>
      <button type="button" aria-label="Search all twenty" onClick={() => (setHint(true), run('search'))}>
        <Search size={15} strokeWidth={1.7} aria-hidden />
      </button>
    </span>
  )

  /** The list: each exchange a line, under the heading its day falls under. */
  const list = (found: Exchange[]) => {
    let under = ''
    return (
      <ol className="ml-list" tabIndex={0} role="listbox" aria-label={`${splitName}: ${found.length === 1 ? 'one exchange' : `${found.length} exchanges`}`} aria-activedescendant={found[cursor] ? `mail-${found[cursor]!.id}` : undefined}>
        {found.map((x, i) => {
          const group = groupOf(x.date)
          const head = group !== under
          under = group
          return (
            <li key={x.id} id={`mail-${x.id}`} role="option" aria-selected={i === cursor} className={`ml-row${i === cursor ? ' on' : ''}`} data-group={head ? group : undefined} onPointerMove={(e) => e.pointerType === 'mouse' && i !== cursor && setAt(i)} onClick={() => (setAt(i), show(x))}>
              <b>{x.from}</b>
              <span className="s">
                <span className={`ml-chip ${x.led.toLowerCase()}`}>{x.led.toLowerCase()}</span>
                <em>{x.subject}</em>
                {x.first}
              </span>
              {i === cursor ? (
                // (what Superhuman offers on the row it is on: each would change mail, and says so)
                <span className="ml-acts" aria-hidden>
                  <Check size={15} strokeWidth={1.7} onClick={(e) => (e.stopPropagation(), readOnly('marked done'))} />
                  <Clock size={14} strokeWidth={1.7} onClick={(e) => (e.stopPropagation(), readOnly('snoozed'))} />
                  <Zap size={14} strokeWidth={1.7} onClick={(e) => (e.stopPropagation(), readOnly('sent'))} />
                </span>
              ) : (
                <span className="d">{dayOf(x.date)}</span>
              )}
            </li>
          )
        })}
      </ol>
    )
  }

  /** The pane at the right: who it is from, what else they wrote about, and where it led. */
  const pane = (
    <aside className="ml-pane" aria-label={query !== null && !thread ? 'Search tips' : 'About the sender'}>
      {query !== null && !thread ? (
        <>
          <h2>Tips</h2>
          <dl className="ml-tips">
            {[
              ['investment', 'led to an investment'],
              ['intro', 'led to an intro'],
              ['hire', 'led to a hire'],
              ['drop', 'led to a drop'],
              ['founder', 'from a founder'],
              ['investor', 'from an investor'],
              ['seed round', 'subject contains "seed round"'],
              ['thank-you', 'subject contains "thank-you"'],
            ].map(([term, means]) => (
              <div key={term}>
                <dt>
                  <button type="button" onClick={() => (setQuery(term!), setAt(0))}>
                    {term}
                  </button>
                </dt>
                <dd>{means}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : about ? (
        <>
          <h2>{about.from}</h2>
          <div className="ml-who">
            <span className="ml-face" aria-hidden>
              <svg viewBox="0 0 50 50">
                <circle cx="25" cy="19" r="9" />
                <path d="M7 50c0-12 8-19 18-19s18 7 18 19z" />
              </svg>
            </span>
            <span>
              <b>{about.people.find((person) => person.name === about.from)?.of ?? about.people[about.people.length - 1]?.of}</b>
              <small>With {about.people.filter((person) => person.name !== about.from).map((person) => person.name).join(' and ')}</small>
            </span>
          </div>
          <div className="ml-refer">
            <button type="button" className="ml-outline" onClick={() => run('led')}>
              {about.led}
            </button>
            <span>What it led to</span>
          </div>
          <h3>
            <MailGlyph size={13} strokeWidth={1.7} aria-hidden />
            Mail
          </h3>
          <ul className="ml-more">
            {EXCHANGES.filter((x) => x.led === about.led && x.id !== about.id)
              .slice(0, 4)
              .map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => (setQuery(null), setSplit('all'), setAt(EXCHANGES.indexOf(x)), show(x))}>{x.subject}</button>
                </li>
              ))}
          </ul>
          <p className="ml-link">
            <Link2 size={13} strokeWidth={1.7} aria-hidden />
            <b>{about.people[1]?.of}</b>
          </p>
        </>
      ) : (
        <h2>Mail</h2>
      )}
      <div className="ml-end">
        {tip && (
          <div className="ml-tip">
            <Lightbulb size={13} strokeWidth={1.8} aria-hidden />
            <button type="button" onClick={() => setOver('shortcuts')}>
              Learn every shortcut
            </button>
            <button type="button" aria-label="Put this away" onClick={() => setTip(false)}>
              <X size={14} strokeWidth={1.7} aria-hidden />
            </button>
          </div>
        )}
        <p className="ml-readonly">
          <span>
            <Lock size={12} strokeWidth={2} aria-hidden />
            Read-only
          </span>
          <button type="button" aria-label="Keyboard shortcuts" onClick={() => setOver('shortcuts')}>
            <CircleHelp size={14} strokeWidth={1.7} aria-hidden />
          </button>
        </p>
      </div>
    </aside>
  )

  return (
    <Window className={`app mailwin${zero ? ' zero' : ''}`} lightsSize="large" lead={bar} body={{ className: 'mailwin__body' }}>
      <div ref={root} className="ml" data-zero={zero || undefined} data-autofocus tabIndex={0} role="application" aria-label="Mail: twenty exchanges that led to something. Read-only. Press ? for its keys." onKeyDown={onKey}>
        {zero && <img className="ml-photo" src="/wallpapers/lagoon.webp" alt="" />}
        <nav className="ml-rail" aria-label="Mail">
          <button type="button" className="spark" aria-label="Command" onClick={() => setOver('command')}>
            <Sparkles size={14} strokeWidth={1.7} aria-hidden />
          </button>
          <span className="ml-rail__set">
            <button type="button" aria-label="Inbox" aria-current={!zero ? 'page' : undefined} onClick={() => run('inbox')}>
              <MailGlyph size={14} strokeWidth={1.7} aria-hidden />
            </button>
            <button type="button" aria-label="Calendar" onClick={() => say('There is only the inbox here: twenty exchanges that led to something.')}>
              <Calendar size={14} strokeWidth={1.7} aria-hidden />
            </button>
          </span>
        </nav>
        {zero ? (
          <div className="ml-main ml-zero">
            <header className="ml-top">
              <span className="ml-menu" aria-hidden>
                <Menu size={15} strokeWidth={1.7} />
              </span>
              {tabs}
              {tools}
            </header>
            <p className="ml-hit">
              <b>
                You’ve hit Inbox Zero! <Flame size={13} strokeWidth={1.8} aria-hidden />
              </b>
              {ZERO_LINE && (
                <span>
                  “{ZERO_LINE.words.replace(/^[“"]|[”"]$/g, '')}” {ZERO_LINE.by}
                </span>
              )}
              <button type="button" onClick={() => setZero(false)}>
                Press <K>Z</K> to bring them back
              </button>
            </p>
          </div>
        ) : thread ? (
          <Thread
            x={thread}
            message={message}
            unfolded={unfolded}
            lit={lit}
            onUnfold={(i) => (setUnfolded((u) => (u.includes(i) ? u : [...u, i])), setMessage(i))}
            onBack={() => setOpen(null)}
            onReply={() => run('reply')}
            onStep={(by) => stepThread(by)}
            onNo={readOnly}
          />
        ) : query !== null ? (
          <div className="ml-main ml-finding">
            <header className="ml-top">
              <label className="ml-search">
                <span className="sr-only">Search all twenty</span>
                <input
                  autoFocus
                  type="text"
                  value={query}
                  placeholder="Search all twenty"
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(e) => (setQuery(e.target.value), setAt(0))}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') return e.preventDefault(), e.stopPropagation(), setQuery(null), setHint(false)
                    // Return, or the down arrow, goes into what was found
                    if (e.key === 'Enter' || e.key === 'ArrowDown') e.preventDefault(), back()
                  }}
                />
              </label>
              <span className="ml-tools">
                <button type="button" aria-label="Close search" onClick={() => (setQuery(null), setHint(false))}>
                  <X size={16} strokeWidth={1.6} aria-hidden />
                </button>
              </span>
            </header>
            {rows.length ? (
              list(rows)
            ) : (
              <div className="ml-none" role="status">
                Nothing among the twenty says “{query}”.
              </div>
            )}
            {hint && (
              <p className="ml-hint" role="status">
                Next time, hit <K>/</K> to search instantly!
                <button type="button" aria-label="Put this away" onClick={() => setHint(false)}>
                  <X size={13} strokeWidth={1.8} aria-hidden />
                </button>
              </p>
            )}
          </div>
        ) : (
          <div className="ml-main">
            <header className="ml-top">
              <button type="button" className="ml-menu" aria-label="Keyboard shortcuts" onClick={() => setOver('shortcuts')}>
                <Menu size={15} strokeWidth={1.7} aria-hidden />
              </button>
              {tabs}
              {tools}
            </header>
            {list(rows)}
          </div>
        )}
        {!zero && pane}
        {said && (
          <div className="ml-said" role="status" key={said.n}>
            {said.text}
          </div>
        )}
      </div>
      {over === 'command' && <Palette thread={!!thread} onClose={() => setOver(null)} onRun={(does) => (setOver(null), run(does))} />}
      {over === 'shortcuts' && <Shortcuts onClose={() => setOver(null)} />}
    </Window>
  )
}

function Thread({ x, message, unfolded, lit, onUnfold, onBack, onReply, onStep, onNo }: { x: Exchange; message: number; unfolded: number[]; lit: boolean; onUnfold: (i: number) => void; onBack: () => void; onReply: () => void; onStep: (by: number) => void; onNo: (what: string) => void }) {
  // The newest two are open; the earlier ones are a line each until they are asked for
  const folded = (i: number) => i < x.emails.length - 2 && !unfolded.includes(i)
  return (
    <div className="ml-main ml-thread">
      <button type="button" className="ml-back" aria-label="Back to inbox" onClick={onBack}>
        <ArrowLeft size={15} strokeWidth={1.7} aria-hidden />
      </button>
      <div className="ml-col">
        <header className="ml-head">
          <h1>{x.subject}</h1>
          <span className="ml-does">
            <button type="button" className="t" onClick={() => onNo('shared')}>
              Share
            </button>
            <button type="button" aria-label="Mark done" onClick={() => onNo('marked done')}>
              <Check size={15} strokeWidth={1.7} aria-hidden />
            </button>
            <button type="button" aria-label="Remind me" onClick={() => onNo('snoozed')}>
              <Clock size={14} strokeWidth={1.7} aria-hidden />
            </button>
            <button type="button" aria-label="Instant reply" onClick={() => onNo('sent')}>
              <Zap size={14} strokeWidth={1.7} aria-hidden />
            </button>
            <button type="button" aria-label="Previous conversation" onClick={() => onStep(-1)}>
              <ChevronUp size={16} strokeWidth={1.6} aria-hidden />
            </button>
            <button type="button" aria-label="Next conversation" onClick={() => onStep(1)}>
              <ChevronDown size={16} strokeWidth={1.6} aria-hidden />
            </button>
          </span>
        </header>
        {/* One line on what it led to, where Superhuman sets its one line on what a conversation is */}
        <p className="ml-led" data-lit={lit || undefined}>
          <span className={`ml-chip ${x.led.toLowerCase()}`}>{x.led.toLowerCase()}</span>
          <span>{x.ledTo}</span>
        </p>
        <div className="ml-card">
          {x.emails.map((email, i) =>
            folded(i) ? (
              <button key={i} type="button" className="ml-msg fold" data-email={i} data-at={i === message || undefined} onClick={() => onUnfold(i)}>
                <b>{email.from}</b>
                <span>{email.body[0]}</span>
                {dayOf(email.at)}
                <i className="sr-only">. Show this email</i>
              </button>
            ) : (
              <article key={i} className="ml-msg" data-email={i} data-at={i === message || undefined}>
                <header>
                  <b>{email.from}</b>
                  <span>to {email.to}</span>
                  <span className="ml-mini" aria-hidden>
                    <Reply size={14} strokeWidth={1.6} />
                    <Forward size={14} strokeWidth={1.6} />
                  </span>
                  <small>{dayOf(email.at)}</small>
                </header>
                {email.body.map((paragraph, n) => (
                  <p key={n}>{paragraph}</p>
                ))}
              </article>
            ),
          )}
        </div>
      </div>
      <div className="ml-reply">
        <span>Nothing sends from here. Reply opens a new message to Shrug in Messages.</span>
        <button type="button" className="ml-go" onClick={onReply}>
          <MessageCircle size={13} strokeWidth={2} aria-hidden />
          Reply to Shrug <K>R</K>
        </button>
      </div>
    </div>
  )
}

/** The command palette: every command by name, found as it is typed. Return runs the one it is on. */
function Palette({ thread, onClose, onRun }: { thread: boolean; onClose: () => void; onRun: (does: Does) => void }) {
  const [typed, setTyped] = useState('')
  const [at, setAt] = useState(0)
  const q = typed.trim().toLowerCase()
  const found = useMemo(() => {
    // (Open conversation is the inbox's; Open what this led to and Reply all are a conversation's)
    const all = COMMANDS.filter((c) => c.id !== 'command' && (thread ? c.id !== 'open' : c.id !== 'reply-all'))
    if (!q) return FIRST.map((id) => all.find((c) => c.id === id)!).filter(Boolean)
    const words = q.split(/\s+/)
    return all.filter((c) => words.every((word) => c.name.toLowerCase().includes(word) || c.keys.join('').toLowerCase() === word)).slice(0, 9)
  }, [q, thread])
  const on = Math.min(at, Math.max(0, found.length - 1))
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) return e.preventDefault(), e.stopPropagation(), onClose()
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') return e.preventDefault(), setAt(Math.max(0, Math.min(found.length - 1, on + (e.key === 'ArrowDown' ? 1 : -1))))
    if (e.key === 'Enter') return e.preventDefault(), e.stopPropagation(), found[on] ? onRun(found[on]!.does) : undefined
    // (the keyboard stays in the palette until it is put away)
    if (e.key === 'Tab') e.preventDefault()
    e.stopPropagation()
  }
  return (
    <>
      <div className="ml-dim" onPointerDown={onClose} />
      <div className="ml-pal" role="dialog" aria-label="Command" onKeyDown={onKey}>
        <h2>
          <Zap size={15} strokeWidth={1.7} aria-hidden />
          Mail Command
        </h2>
        <label className="in">
          <span className="sr-only">Command</span>
          <input autoFocus type="text" role="combobox" aria-expanded aria-controls="mail-commands" aria-activedescendant={found[on] ? `mail-command-${found[on]!.id}` : undefined} value={typed} spellCheck={false} autoComplete="off" onChange={(e) => (setTyped(e.target.value), setAt(0))} />
        </label>
        <ul id="mail-commands" role="listbox" aria-label="Commands">
          {found.map((c, i) => (
            <li key={c.id} id={`mail-command-${c.id}`} role="option" aria-selected={i === on} className={i === on ? 'on' : undefined} onPointerMove={() => i !== on && setAt(i)} onClick={() => onRun(c.does)}>
              {ICON[c.id] ?? (typeof c.does === 'string' ? <CornerDownLeft size={16} strokeWidth={1.7} aria-hidden /> : <Lock size={15} strokeWidth={1.7} aria-hidden />)}
              <span>{c.name}</span>
              <Keys keys={c.keys} />
            </li>
          ))}
          {!found.length && <li className="none">No command is called that.</li>}
        </ul>
      </div>
    </>
  )
}

/** Every key Mail answers to, as Superhuman has them: what each does here, and which only say that Mail is read-only. */
function Shortcuts({ onClose }: { onClose: () => void }) {
  const sheet = useRef<HTMLDivElement>(null)
  useEffect(() => sheet.current?.focus(), [])
  return (
    <>
      <div className="ml-dim" onPointerDown={onClose} />
      <div
        ref={sheet}
        className="ml-pal ml-sheet"
        role="dialog"
        aria-label="Keyboard shortcuts"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || e.key === '?') e.preventDefault(), onClose()
          if (e.key === 'Tab') e.preventDefault()
          e.stopPropagation()
        }}
      >
        <h2>
          <Keyboard size={15} strokeWidth={1.7} aria-hidden />
          Keyboard shortcuts
          <button type="button" aria-label="Close: esc" onClick={onClose}>
            <K>esc</K>
          </button>
        </h2>
        <p className="ml-leave">
          Tab moves between splits here, as it does in Superhuman. <K>F6</K> leaves Mail for the Dock or the menu bar.
        </p>
        <div className="ml-groups" tabIndex={0} role="group" aria-label="Every key">
          {GROUPS.map((group) => (
            <section key={group}>
              <h3>{group}</h3>
              <ul>
                {COMMANDS.filter((c) => c.group === group).map((c) => (
                  <li key={c.id}>
                    <span>{c.name}</span>
                    <Keys keys={c.keys} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>
  )
}
