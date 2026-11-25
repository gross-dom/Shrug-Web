import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowLeft, Check, ChevronDown, ChevronUp, CircleHelp, CornerDownLeft, Flame, Inbox, Keyboard, Lightbulb, Link2, Mail as MailGlyph, MailOpen, Menu, MessageCircle, Reply, Search, Share, Sparkles, SquarePen, Star, Trash2, Undo2, X, Zap } from 'lucide-react'
import { EXCHANGES, SPLITS, ZERO_LINE, type Exchange, type Led } from '../data/mail'
import { Window } from '../kit/window'
import { SITE } from '../data/site'
import { LogoDisc } from '../os/icons'
import { launchApp, showCompany } from '../os/launch'
import { mail, markDone, markUnread, openExchange, star } from '../os/mail'
import { linkTo } from '../os/place'
import { useStore } from '../os/store'
import { account } from '../os/account'
import { CAN_POST, mailtoShrug, postToShrug, SHRUG_MAIL } from '../phone/apps/outbox'
import '../styles/desk/mail.css'

// Mail (design/v1, "Mail", and Dom's notes after testing it): twenty email exchanges that led to something,
// in a window that looks and is driven as Superhuman is. The emails cannot be changed and nothing is sent
// from here; what a visitor can do is what is theirs to do with them: mark one done (it goes to Done, in the
// bar), star it, mark it unread, share it (a link that opens it on this site), search, and compose (a new
// message to Shrug, in Messages). Those are kept in their browser (src/os/mail.ts).
//
// Every one of Superhuman's shortcuts is answered. The ones that move about, open, search and ask for the
// command palette do what they do there; so do the ones above; the ones that would send, snooze, label or
// delete say that nothing of the kind happens here. Everything in Mail is public.
//
// The shortcuts are COMMANDS, below: each has its name, its keys as Superhuman has them, and what it does
// here. The sheet that ? opens lists them all; the command palette (Cmd K, or the lightning bolt) lists only
// what can be done.

/** The splits along the bar: the inbox's five, then Done, and Starred once anything is. */
type Split = 'all' | Led | 'done' | 'starred'

/** What a command does here. A string is what a read-only one says instead of doing anything. */
type Does = 'next' | 'previous' | 'open' | 'back' | 'next-split' | 'previous-split' | 'top' | 'bottom' | 'inbox' | 'search' | 'command' | 'shortcuts' | 'reply' | 'led' | 'next-message' | 'previous-message' | 'expand' | 'zero' | 'undo' | 'done' | 'not-done' | 'star' | 'unread' | 'read' | 'share' | 'go-done' | 'go-starred' | 'compose' | { says: string }

interface Command {
  id: string
  name: string
  /** Its keys, as they are drawn: one string to a key. */
  keys: string[]
  /** What a press must be to be it (see `pressed`): any of these. A pair after G is written "g i". */
  when: string[]
  group: 'Move about' | 'In a conversation' | 'Yours to do' | 'Find and ask' | 'Not here'
  does: Does
}

const nothing = (done: string): Does => ({ says: `Not here. Nothing is ${done}.` })
const elsewhere: Does = { says: 'There is the inbox, Done and Starred here: twenty exchanges that led to something.' }

const COMMANDS: Command[] = [
  { id: 'zero', name: 'Achieve Inbox Zero', keys: ['⌘', '⇧', 'E'], when: ['mod+shift+e'], group: 'Find and ask', does: 'zero' },
  { id: 'inbox', name: 'Go to Inbox', keys: ['G', 'I'], when: ['g i'], group: 'Move about', does: 'inbox' },
  { id: 'reply', name: 'Reply to Shrug', keys: ['R'], when: ['r'], group: 'In a conversation', does: 'reply' },
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
  { id: 'compose', name: 'Compose', keys: ['C'], when: ['c'], group: 'In a conversation', does: 'compose' },
  { id: 'undo', name: 'Undo', keys: ['Z'], when: ['z'], group: 'Find and ask', does: 'undo' },
  // ---- what a visitor can do with the twenty: kept in their own browser
  { id: 'done', name: 'Mark Done', keys: ['E'], when: ['e'], group: 'Yours to do', does: 'done' },
  { id: 'not-done', name: 'Mark Not Done', keys: ['⇧', 'E'], when: ['shift+e'], group: 'Yours to do', does: 'not-done' },
  { id: 'star', name: 'Star', keys: ['S'], when: ['s'], group: 'Yours to do', does: 'star' },
  { id: 'unread', name: 'Mark Unread', keys: ['U'], when: ['u'], group: 'Yours to do', does: 'unread' },
  { id: 'read', name: 'Mark Read', keys: ['⇧', 'U'], when: ['shift+u'], group: 'Yours to do', does: 'read' },
  { id: 'share', name: 'Share Conversation', keys: ['⌘', 'S'], when: ['mod+s'], group: 'Yours to do', does: 'share' },
  { id: 'done-folder', name: 'Go to Done', keys: ['G', 'E'], when: ['g e'], group: 'Move about', does: 'go-done' },
  { id: 'starred', name: 'Go to Starred', keys: ['G', 'S'], when: ['g s'], group: 'Move about', does: 'go-starred' },
  // ---- what would send, file or delete mail: said, and not done
  { id: 'remind', name: 'Remind me', keys: ['H'], when: ['h'], group: 'Not here', does: nothing('snoozed') },
  { id: 'trash', name: 'Trash', keys: ['#'], when: ['#'], group: 'Not here', does: nothing('deleted') },
  { id: 'spam', name: 'Mark as spam', keys: ['!'], when: ['!'], group: 'Not here', does: nothing('marked as spam') },
  { id: 'label', name: 'Add or remove label', keys: ['L'], when: ['l'], group: 'Not here', does: nothing('labeled') },
  { id: 'unlabel', name: 'Remove label', keys: ['Y'], when: ['y'], group: 'Not here', does: nothing('unlabeled') },
  { id: 'move', name: 'Move', keys: ['V'], when: ['v'], group: 'Not here', does: nothing('moved') },
  { id: 'mute', name: 'Mute', keys: ['⇧', 'M'], when: ['shift+m'], group: 'Not here', does: nothing('muted') },
  { id: 'unsubscribe', name: 'Unsubscribe', keys: ['⌘', 'U'], when: ['mod+u'], group: 'Not here', does: nothing('unsubscribed from') },
  { id: 'select', name: 'Select conversation', keys: ['X'], when: ['x'], group: 'Not here', does: nothing('selected') },
  { id: 'select-more', name: 'Add to selection', keys: ['⇧', 'J'], when: ['shift+j', 'shift+k', 'shift+ArrowDown', 'shift+ArrowUp'], group: 'Not here', does: nothing('selected') },
  { id: 'forward', name: 'Forward', keys: ['F'], when: ['f'], group: 'Not here', does: nothing('forwarded') },
  { id: 'send', name: 'Send', keys: ['⌘', '↵'], when: ['mod+Enter', 'mod+shift+Enter'], group: 'Not here', does: nothing('sent') },
  { id: 'send-later', name: 'Send later', keys: ['⌘', '⇧', 'L'], when: ['mod+shift+l'], group: 'Not here', does: nothing('scheduled') },
  { id: 'snippet', name: 'Use snippet', keys: [';'], when: [';', 'mod+;'], group: 'Not here', does: nothing('written') },
  { id: 'intro', name: 'Instant intro', keys: ['⌘', '⇧', 'I'], when: ['mod+shift+i'], group: 'Not here', does: nothing('sent') },
  { id: 'redo', name: 'Redo', keys: ['⇧', 'Z'], when: ['shift+z'], group: 'Not here', does: nothing('redone') },
  { id: 'drafts', name: 'Go to Drafts', keys: ['G', 'D'], when: ['g d'], group: 'Not here', does: elsewhere },
  { id: 'sent', name: 'Go to Sent', keys: ['G', 'T'], when: ['g t'], group: 'Not here', does: elsewhere },
  { id: 'reminders', name: 'Go to Reminders', keys: ['G', 'H'], when: ['g h'], group: 'Not here', does: elsewhere },
  { id: 'all-mail', name: 'Go to All Mail', keys: ['G', 'A'], when: ['g a'], group: 'Not here', does: elsewhere },
  { id: 'trash-folder', name: 'Go to Trash', keys: ['G', '#'], when: ['g #'], group: 'Not here', does: elsewhere },
  { id: 'spam-folder', name: 'Go to Spam', keys: ['G', '!'], when: ['g !'], group: 'Not here', does: elsewhere },
  { id: 'label-folder', name: 'Go to label', keys: ['G', 'L'], when: ['g l'], group: 'Not here', does: elsewhere },
]

/** What the palette opens on: the five things there are to do (Dom's list). */
const FIRST = ['done', 'star', 'unread', 'search', 'compose']
const GROUPS: Command['group'][] = ['Move about', 'In a conversation', 'Yours to do', 'Find and ask', 'Not here']

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
  done: <Check size={16} strokeWidth={1.9} aria-hidden />,
  'not-done': <Inbox size={16} strokeWidth={1.9} aria-hidden />,
  star: <Star size={16} strokeWidth={1.9} aria-hidden />,
  unread: <MailGlyph size={16} strokeWidth={1.9} aria-hidden />,
  read: <MailOpen size={16} strokeWidth={1.9} aria-hidden />,
  compose: <SquarePen size={16} strokeWidth={1.9} aria-hidden />,
  share: <Share size={16} strokeWidth={1.9} aria-hidden />,
}

export function MailApp() {
  const root = useRef<HTMLDivElement>(null)
  const [split, setSplit] = useState<Split>('all')
  const [query, setQuery] = useState<string | null>(null)
  const [at, setAt] = useState(0)
  // Which conversation is open, and what has been done with the twenty, are kept where the desk can reach
  // them (src/os/mail.ts): the address says which is open, and a link that names one opens it
  const { open, done, starred, unread } = useStore(mail, (s) => s)
  const setOpen = openExchange
  const [over, setOver] = useState<'command' | 'shortcuts' | null>(null)
  const [zero, setZero] = useState(false)
  /** A new message to Shrug, being written here: what it has in it so far. It is kept while it is put by (Escape, the way back), and gone once it is sent or discarded. */
  const [letter, setLetter] = useState<Letter>(BLANK)
  const [composing, setComposing] = useState(false)
  /** In a conversation: the message the keyboard is on, and the ones that are open (the rest are a line each). */
  const [message, setMessage] = useState(0)
  const [unfolded, setUnfolded] = useState<number[]>([])
  /** The last thing marked done, which Z brings back. */
  const undone = useRef<string | null>(null)
  const [lit, setLit] = useState(false)
  const [said, setSaid] = useState<{ text: string; n: number } | null>(null)
  /** The hint under a search opened with the pointer: there is a key for it. */
  const [hint, setHint] = useState(false)
  const [tip, setTip] = useState(true)
  const g = useRef(0)

  const q = (query ?? '').trim().toLowerCase()
  /** Which split an exchange is under: Done once it is marked done (it has left the inbox), Starred if it is starred, or its own. */
  const under = (x: Exchange, id: Split) => (id === 'done' ? done.includes(x.id) : id === 'starred' ? starred.includes(x.id) : !done.includes(x.id) && (id === 'all' || x.led === id))
  const rows = useMemo(
    // (a search looks through all twenty, wherever they are)
    () => EXCHANGES.filter((x) => (q ? [x.from, x.subject, x.first, x.led, x.ledTo].some((text) => text.toLowerCase().includes(q)) : under(x, split))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [split, q, done, starred],
  )
  const cursor = Math.min(at, Math.max(0, rows.length - 1))
  const thread = open ? (EXCHANGES.find((x) => x.id === open) ?? null) : null
  const count = (id: Split) => EXCHANGES.filter((x) => under(x, id)).length
  /** The splits along the bar: Done is there once something has been marked done, and Starred once something is starred. */
  const splits: { id: Split; label: string }[] = [...SPLITS, ...(done.length ? [{ id: 'done' as const, label: 'Done' }] : []), ...(starred.length || split === 'starred' ? [{ id: 'starred' as const, label: 'Starred' }] : [])]
  // (the last of Done brought back to the inbox: Done is no longer a place to be)
  useEffect(() => {
    if (split === 'done' && !done.length) setSplit('all')
  }, [split, done.length])

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

  const show = (x: Exchange) => setOpen(x.id)
  // A conversation opens on its newest email: the earlier ones are a line each until they are asked for.
  // (Whatever opened it: a row, a key, or a link that named it)
  useEffect(() => {
    if (!thread) return
    setUnfolded([thread.emails.length - 1])
    setMessage(thread.emails.length - 1)
    setLit(false)
    setZero(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  /** What a command acts on: the conversation that is open, or the row the keyboard is on. */
  const target = () => thread ?? rows[cursor] ?? null
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
        const now = splits.findIndex((s) => s.id === split)
        setSplit(splits[(now + (does === 'next-split' ? 1 : -1) + splits.length) % splits.length]!.id)
        setOpen(null)
        return setAt(0)
      }
      case 'go-done':
      case 'go-starred':
        // (Done is somewhere to go once something has been marked done)
        if (does === 'go-done' && !done.length) return say('Nothing is marked done yet.')
        setZero(false)
        setOpen(null)
        setQuery(null)
        setSplit(does === 'go-done' ? 'done' : 'starred')
        return setAt(0)
      case 'done':
      case 'not-done': {
        const x = target()
        if (!x) return
        const on = does === 'done'
        if (on === done.includes(x.id)) return say(on ? 'It is in Done already.' : 'It is in the inbox already.')
        markDone(x.id, on)
        undone.current = on ? x.id : null
        // Done with, it is put away: the list is what is left
        if (thread) setOpen(null)
        return say(on ? 'Marked Done. Z brings it back.' : 'Moved back to the inbox.')
      }
      case 'star': {
        const x = target()
        if (!x) return
        const on = !starred.includes(x.id)
        star(x.id, on)
        return say(on ? 'Starred.' : 'Star removed.')
      }
      case 'unread':
      case 'read': {
        const x = target()
        if (!x) return
        markUnread(x.id, does === 'unread')
        // (unread, it is back in the list as it was before it was opened)
        if (does === 'unread' && thread) setOpen(null)
        return say(does === 'unread' ? 'Marked Unread.' : 'Marked Read.')
      }
      case 'share': {
        const x = target()
        if (!x) return
        // A link to this conversation on this site: whoever opens it lands in Mail, on it
        const link = linkTo({ app: 'mail', at: x.id })
        const copied = () => say('Link copied. It opens this conversation here.')
        if (navigator.clipboard?.writeText) return void navigator.clipboard.writeText(link).then(copied, () => say(link))
        return say(link)
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
      case 'compose': {
        // A new message, written here, to Shrug: a reply to a conversation takes its subject
        const re = does === 'reply' && thread ? (/^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`) : null
        if (re && letter.subject !== re) setLetter((was) => ({ ...was, subject: re }))
        setZero(false)
        return setComposing(true)
      }
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
      case 'previous-message': {
        if (!thread) return
        const to = Math.max(0, Math.min(thread.emails.length - 1, message + (does === 'next-message' ? 1 : -1)))
        setMessage(to)
        return setUnfolded((u) => (u.includes(to) ? u : [...u, to]))
      }
      case 'expand':
        return void (thread && setUnfolded(thread.emails.map((_, i) => i)))
      case 'zero':
        setOpen(null)
        setQuery(null)
        return setZero(true)
      case 'undo':
        if (zero) return setZero(false)
        if (undone.current) {
          markDone(undone.current, false)
          undone.current = null
          return say('Moved back to the inbox.')
        }
        return say('Nothing to undo.')
    }
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    // What is typed into a field is the field's, a sheet over the window answers its own keys, and so does a message being written
    if (over || composing || (e.target as HTMLElement).closest('input, textarea')) return
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

  const splitName = splits.find((s) => s.id === split)?.label ?? 'All'
  /** Who the pane at the right is about: whoever the conversation open, or the row the keyboard is on, is from. */
  const about = thread ?? rows[cursor] ?? null

  // The title bar: one long pill, as a browser's tab would be, saying where this is
  const bar = (
    <div className="mlbar" data-zero={zero || undefined}>
      <span className="mlbar__pill">
        <i aria-hidden />
        {composing ? 'New Message' : query !== null ? 'Search' : `${splitName} (${count(split)})`} - Mail
      </span>
      <span className="mlbar__plus" aria-hidden>
        +
      </span>
    </div>
  )

  const tabs = (
    <div className="ml-tabs" role="tablist" aria-label="Splits">
      {splits.map((s) => (
        <button key={s.id} type="button" role="tab" aria-selected={split === s.id} className={split === s.id ? 'on' : undefined} onClick={() => (setSplit(s.id), setOpen(null), setZero(false), setAt(0), back())}>
          {/* (the count sits close against its split's name, as Superhuman sets it; read aloud, a comma is between them) */}
          {s.label}
          <span className="sr-only">, </span>
          <small>{count(s.id)}</small>
        </button>
      ))}
    </div>
  )
  const tools = (
    <span className="ml-tools">
      <button type="button" aria-label="New message to Shrug" onClick={() => run('compose')}>
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
            <li
              key={x.id}
              id={`mail-${x.id}`}
              role="option"
              aria-selected={i === cursor}
              className={`ml-row${i === cursor ? ' on' : ''}${unread.includes(x.id) ? ' unread' : ''}`}
              data-group={head ? group : undefined}
              onPointerMove={(e) => e.pointerType === 'mouse' && i !== cursor && setAt(i)}
              onClick={() => (setAt(i), show(x))}
            >
              <b>
                {unread.includes(x.id) && <i className="ml-dot" aria-label="Unread" role="img" />}
                {x.from}
              </b>
              <span className="s">
                {starred.includes(x.id) && <Star className="ml-star" size={12} strokeWidth={0} fill="currentColor" aria-label="Starred" role="img" />}
                <span className={`ml-chip ${x.led.toLowerCase()}`}>{x.led.toLowerCase()}</span>
                <em>{x.subject}</em>
                {x.first}
              </span>
              {i === cursor ? (
                // (what there is to do with the row it is on, as Superhuman sets it there: done, and the command palette.
                // The keys are E and Command K; these are the pointer's way to the same)
                <span className="ml-acts" aria-hidden>
                  <span data-tip={done.includes(x.id) ? 'Mark Not Done' : 'Mark Done'} data-keys={done.includes(x.id) ? '⇧ E' : 'E'} onClick={(e) => (e.stopPropagation(), setAt(i), markDone(x.id, !done.includes(x.id)), (undone.current = done.includes(x.id) ? null : x.id), say(done.includes(x.id) ? 'Moved back to the inbox.' : 'Marked Done. Z brings it back.'))}>
                    <Check size={15} strokeWidth={1.7} />
                  </span>
                  <span data-tip="Mail Command" data-keys="⌘ K" onClick={(e) => (e.stopPropagation(), setAt(i), setOver('command'))}>
                    <Zap size={14} strokeWidth={1.7} />
                  </span>
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
    <aside className="ml-pane" aria-label={composing ? `About ${SITE.name}` : query !== null && !thread ? 'Search tips' : 'About the sender'}>
      {composing ? (
        // A new message has one recipient, and the pane is about them, as Superhuman's is about whoever a
        // message is to: Shrug, its address, what it is in its own line, and the one-pager
        <>
          <h2>{SITE.name}</h2>
          <div className="ml-who">
            <span className="ml-face ml-face--shrug" aria-hidden>
              <LogoDisc size="100%" />
            </span>
            <span>
              <b>{SHRUG_MAIL}</b>
              <small>{SITE.line}</small>
            </span>
          </div>
          <p className="ml-link">
            <Link2 size={13} strokeWidth={1.7} aria-hidden />
            <a href={SITE.onePager} target="_blank" rel="noopener noreferrer">
              One-pager<span className="sr-only">, opens in a new tab</span>
            </a>
          </p>
        </>
      ) : query !== null && !thread ? (
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
            <K>C</K> writes to Shrug
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
      <div ref={root} className="ml" data-zero={zero || undefined} data-autofocus tabIndex={0} role="application" aria-label="Mail: twenty exchanges that led to something. Press ? for its keys." onKeyDown={onKey}>
        {zero && <img className="ml-photo" src="/wallpapers/lagoon.webp" alt="" />}
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
        ) : composing ? (
          <Compose
            letter={letter}
            onChange={setLetter}
            onPutBy={() => (setComposing(false), back())}
            onDiscard={() => (setLetter(BLANK), setComposing(false), back())}
            onSent={(how) => {
              setLetter(BLANK)
              setComposing(false)
              say(how === 'demo' ? 'Message sent. (Demo: nothing was sent.)' : 'Message sent.')
              back()
            }}
          />
        ) : thread ? (
          <Thread
            x={thread}
            message={message}
            unfolded={unfolded}
            lit={lit}
            done={done.includes(thread.id)}
            starred={starred.includes(thread.id)}
            onFold={(i) => {
              // An email is opened, or closed back to its one line; the keyboard is on whichever was pressed
              setUnfolded((u) => (u.includes(i) ? u.filter((n) => n !== i) : [...u, i]))
              setMessage(i)
            }}
            onBack={() => setOpen(null)}
            onReply={() => run('reply')}
            onStep={(by) => stepThread(by)}
            onRun={run}
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
            {rows.length ? (
              list(rows)
            ) : (
              <div className="ml-none" role="status">
                {split === 'done' ? 'Nothing is marked done. Press E on a conversation and it comes here.' : split === 'starred' ? 'Nothing is starred. Press S on a conversation and it is.' : 'Nothing here: every one of these is in Done.'}
              </div>
            )}
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

/** A conversation: its subject, what there is to do with it, one line on what it led to, and its emails. An
 * email is a line (who, how it begins, the day) until it is opened; opened, it is a card of its own, and its
 * head closes it again. The one the keyboard is on has a violet edge, as in Superhuman. */
function Thread({ x, message, unfolded, lit, done, starred, onFold, onBack, onReply, onStep, onRun }: { x: Exchange; message: number; unfolded: number[]; lit: boolean; done: boolean; starred: boolean; onFold: (i: number) => void; onBack: () => void; onReply: () => void; onStep: (by: number) => void; onRun: (does: Does) => void }) {
  return (
    <div className="ml-main ml-thread">
      <button type="button" className="ml-back" aria-label="Back to inbox" onClick={onBack}>
        <ArrowLeft size={15} strokeWidth={1.7} aria-hidden />
      </button>
      <div className="ml-col">
        <header className="ml-head">
          <h1>
            {x.subject}
            {starred && <Star className="ml-star" size={14} strokeWidth={0} fill="currentColor" aria-label="Starred" role="img" />}
          </h1>
          {/* What there is to do with a conversation here: share it, mark it done, ask for the rest (the
              command palette), and step to the one before or after */}
          <span className="ml-does">
            <button type="button" className="t" data-tip="Share Conversation" data-keys="⌘ S" onClick={() => onRun('share')}>
              Share
            </button>
            <button type="button" aria-label={done ? 'Mark not done' : 'Mark done'} aria-pressed={done} data-tip={done ? 'Mark Not Done' : 'Mark Done'} data-keys={done ? '⇧ E' : 'E'} onClick={() => onRun(done ? 'not-done' : 'done')}>
              <Check size={15} strokeWidth={done ? 2.6 : 1.7} aria-hidden />
            </button>
            <button type="button" aria-label="Command" data-tip="Mail Command" data-keys="⌘ K" onClick={() => onRun('command')}>
              <Zap size={14} strokeWidth={1.7} aria-hidden />
            </button>
            <button type="button" aria-label="Previous conversation" data-tip="Previous Conversation" data-keys="K" onClick={() => onStep(-1)}>
              <ChevronUp size={16} strokeWidth={1.6} aria-hidden />
            </button>
            <button type="button" aria-label="Next conversation" data-tip="Next Conversation" data-keys="J" onClick={() => onStep(1)}>
              <ChevronDown size={16} strokeWidth={1.6} aria-hidden />
            </button>
          </span>
        </header>
        {/* One line on what it led to, where Superhuman sets its one line on what a conversation is */}
        <p className="ml-led" data-lit={lit || undefined}>
          <span className={`ml-chip ${x.led.toLowerCase()}`}>{x.led.toLowerCase()}</span>
          <span>{x.ledTo}</span>
        </p>
        <div className="ml-msgs">
          {x.emails.map((email, i) =>
            !unfolded.includes(i) ? (
              <button key={i} type="button" className="ml-msg fold" data-email={i} data-at={i === message || undefined} aria-expanded={false} onClick={() => onFold(i)}>
                <b>{email.from}</b>
                <span>{email.body[0]}</span>
                <time>{dayOf(email.at)}</time>
                <i className="sr-only">. Open this email</i>
              </button>
            ) : (
              <article key={i} className="ml-msg" data-email={i} data-at={i === message || undefined}>
                {/* (its head is the way to close it again: pressed, the email is its one line) */}
                <header>
                  <button type="button" className="ml-fold" aria-expanded onClick={() => onFold(i)}>
                    <b>
                      {email.from} to {email.to}
                    </b>
                    <i className="sr-only">. Close this email</i>
                  </button>
                  <button type="button" className="ml-mini" aria-label="Reply to Shrug" data-tip="Reply" data-keys="R" onClick={onReply}>
                    <Reply size={14} strokeWidth={1.6} aria-hidden />
                  </button>
                  <time>{dayOf(email.at)}</time>
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
        <span>These twenty are for reading. A reply is a new message to Shrug.</span>
        <button type="button" className="ml-go" onClick={onReply}>
          <Reply size={13} strokeWidth={2} aria-hidden />
          Reply to Shrug <K>R</K>
        </button>
      </div>
    </div>
  )
}

/** What a new message has in it. */
interface Letter {
  from: string
  subject: string
  text: string
}
const BLANK: Letter = { from: '', subject: '', text: '' }

/** A new message, as Superhuman sets one out (Dom's screenshot of it): the way back at the left, "New
 * Message", and a card: who it is to, who it is from, its subject, what it says, and along its foot Send
 * and the bin. It has one recipient, Shrug. ⌘ Return sends it; Escape puts it by, as it was, for later.
 *
 * It goes where a message to Shrug goes (src/phone/apps/outbox.ts): to Shrug's inbox where the site has
 * one; in the demo it is shown as sent, and says nothing was; and on a live site with no inbox yet, Send
 * hands the letter to the visitor's own mail app. */
function Compose({ letter, onChange, onPutBy, onDiscard, onSent }: { letter: Letter; onChange: (next: Letter) => void; onPutBy: () => void; onDiscard: () => void; onSent: (how: 'sent' | 'demo') => void }) {
  const who = useStore(account, (s) => s)
  const mine = who.status === 'member' ? who.email : ''
  const [state, setState] = useState<'writing' | 'sending' | 'failed'>('writing')
  const [asked, setAsked] = useState(false)
  const from = letter.from || mine
  const first = useRef<HTMLInputElement>(null)
  const words = useRef<HTMLTextAreaElement>(null)
  // The keyboard goes to the first thing still to be filled in
  useEffect(() => {
    if (!from) first.current?.focus()
    else words.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const set = (part: Partial<Letter>) => (setState('writing'), onChange({ ...letter, ...part }))
  const address = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from.trim())
  const ready = letter.text.trim().length > 0 && address
  const send = () => {
    setAsked(true)
    if (!ready || state === 'sending') return
    setState('sending')
    void postToShrug({ via: 'mail', from: from.trim(), email: from.trim(), subject: letter.subject.trim(), text: letter.text.trim() }).then((how) => (how === 'failed' ? setState('failed') : onSent(how)))
  }
  return (
    <div
      className="ml-main ml-thread ml-compose"
      onKeyDown={(e) => {
        if (e.key === 'Escape') return e.preventDefault(), e.stopPropagation(), onPutBy()
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.preventDefault(), e.stopPropagation(), send()
      }}
    >
      <button type="button" className="ml-back" aria-label="Back to inbox" onClick={onPutBy}>
        <ArrowLeft size={15} strokeWidth={1.7} aria-hidden />
      </button>
      <div className="ml-col">
        <header className="ml-head">
          <h1>New Message</h1>
        </header>
        <form
          className="ml-card"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <div className="ml-line">
            <span>To</span>
            <output>
              <b>Shrug</b> {SHRUG_MAIL}
            </output>
          </div>
          <label className="ml-line">
            <span>From</span>
            <input ref={first} type="email" value={from} placeholder="Your email, for the reply" autoComplete="email" spellCheck={false} aria-invalid={(asked && !address) || undefined} onChange={(e) => set({ from: e.target.value })} />
          </label>
          <label className="ml-line">
            <span className="sr-only">Subject</span>
            <input type="text" value={letter.subject} placeholder="Subject" autoComplete="off" onChange={(e) => set({ subject: e.target.value })} />
          </label>
          <textarea ref={words} value={letter.text} placeholder="Write to Shrug" aria-label="Message" rows={9} onChange={(e) => set({ text: e.target.value })} />
          <footer>
            {CAN_POST ? (
              <button type="submit" className="ml-send" aria-disabled={!ready || state === 'sending' || undefined}>
                {state === 'sending' ? 'Sending…' : 'Send'}
              </button>
            ) : (
              // No inbox on this site yet: the letter is handed to the visitor's own mail app, which sends it
              <a className="ml-send" href={mailtoShrug(letter.subject, letter.text)}>
                Send from your mail app
              </a>
            )}
            {CAN_POST && (
              <small aria-hidden>
                <K>⌘</K> <K>↵</K>
              </small>
            )}
            <span role="status" className="ml-says">
              {state === 'failed' ? 'Not sent. Check your connection and try again.' : asked && !address ? 'Add your email, so Shrug can reply.' : asked && !letter.text.trim() ? 'Write something first.' : ''}
            </span>
            <button type="button" className="ml-bin" aria-label="Discard this message" data-tip="Discard" onClick={onDiscard}>
              <Trash2 size={15} strokeWidth={1.6} aria-hidden />
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

/** The command palette: what there is to do, by name, found as it is typed. It opens on the five things a
 * visitor can do with the twenty (mark done, star, mark unread, search, compose); typed into, it finds any
 * command that does something here. What would send, file or delete is not offered. Return runs the one it is on. */
function Palette({ thread, onClose, onRun }: { thread: boolean; onClose: () => void; onRun: (does: Does) => void }) {
  const [typed, setTyped] = useState('')
  const [at, setAt] = useState(0)
  const q = typed.trim().toLowerCase()
  const found = useMemo(() => {
    // (Open conversation is the inbox's; Open what this led to and Reply all are a conversation's)
    const all = COMMANDS.filter((c) => typeof c.does === 'string' && c.id !== 'command' && (thread ? c.id !== 'open' : c.id !== 'reply-all'))
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
              {ICON[c.id] ?? <CornerDownLeft size={16} strokeWidth={1.7} aria-hidden />}
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
