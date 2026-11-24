import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowLeft, Command as CommandIcon, CornerDownLeft, Inbox, Keyboard, Lock, MessageCircle, Search, Sparkles, Undo2 } from 'lucide-react'
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

const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const TIME = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const dayOf = (date: string) => DAY.format(new Date(`${date.slice(0, 10)}T12:00:00`))
const timeOf = (at: string) => TIME.format(new Date(at))

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

  const bar = (
    <div className="mlbar">
      <div className="ml-tabs" role="tablist" aria-label="Splits">
        {SPLITS.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={split === s.id} className={split === s.id ? 'on' : undefined} onClick={() => (setSplit(s.id), setOpen(null), setZero(false), setAt(0), back())}>
            {s.label} <small>{count(s.id)}</small>
          </button>
        ))}
      </div>
      <span className="mlbar__grow" />
      {query !== null ? (
        <label className="ml-search">
          <Search size={14} strokeWidth={2} aria-hidden />
          <input
            autoFocus
            type="text"
            value={query}
            aria-label="Search all twenty"
            placeholder="Search all twenty"
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => (setQuery(e.target.value), setAt(0))}
            onKeyDown={(e) => {
              if (e.key === 'Escape') return e.preventDefault(), e.stopPropagation(), setQuery(null)
              // Return, or the down arrow, goes into what was found
              if (e.key === 'Enter' || e.key === 'ArrowDown') e.preventDefault(), back()
            }}
          />
          <K>esc</K>
        </label>
      ) : (
        <button type="button" className="ml-k" aria-label="Search all twenty" onClick={() => run('search')}>
          <Search size={14} strokeWidth={2} aria-hidden />
          <K>/</K>
        </button>
      )}
      <button type="button" className="ml-k" onClick={() => setOver('command')}>
        Command <K>⌘</K>
        <K>K</K>
      </button>
    </div>
  )

  return (
    <Window className="app mailwin" lightsSize="large" lead={bar} body={{ className: 'mailwin__body' }}>
      <div ref={root} className="ml" data-autofocus tabIndex={0} role="application" aria-label="Mail: twenty exchanges that led to something. Read-only. Press ? for its keys." onKeyDown={onKey}>
        {zero ? (
          <div className="ml-zero">
            <img src="/wallpapers/dusk.webp" alt="" />
            <h2>Inbox Zero.</h2>
            {ZERO_LINE && (
              <p>
                “{ZERO_LINE.words.replace(/^[“"]|[”"]$/g, '')}” <span>{ZERO_LINE.by}</span>
              </p>
            )}
            <button type="button" className="ml-k" onClick={() => setZero(false)}>
              Press <K>Z</K> to bring them back
            </button>
          </div>
        ) : thread ? (
          <Thread
            x={thread}
            place={`${EXCHANGES.indexOf(thread) + 1} of ${EXCHANGES.length}`}
            message={message}
            unfolded={unfolded}
            lit={lit}
            onUnfold={(i) => (setUnfolded((u) => (u.includes(i) ? u : [...u, i])), setMessage(i))}
            onBack={() => setOpen(null)}
            onReply={() => run('reply')}
          />
        ) : (
          <>
            {rows.length ? (
              <ol className="ml-list" role="listbox" aria-label={`${SPLITS.find((s) => s.id === split)!.label}: ${rows.length === 1 ? 'one exchange' : `${rows.length} exchanges`}`} aria-activedescendant={rows[cursor] ? `mail-${rows[cursor]!.id}` : undefined}>
                {rows.map((x, i) => (
                  <li key={x.id} id={`mail-${x.id}`} role="option" aria-selected={i === cursor} className={`ml-row${i === cursor ? ' on' : ''}`} onPointerMove={(e) => e.pointerType === 'mouse' && i !== cursor && setAt(i)} onClick={() => (setAt(i), show(x))}>
                    <b>{x.from}</b>
                    <span className="s">
                      <em>{x.subject}</em>
                      {x.first}
                    </span>
                    <span className={`ml-tag${i === cursor ? ' v' : ''}`}>{x.led}</span>
                    <span className="d">{dayOf(x.date)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="ml-none" role="status">
                Nothing among the twenty says “{query}”.
              </div>
            )}
            <div className="ml-foot">
              <span>
                <Lock size={12} strokeWidth={2.2} aria-hidden />
                Read-only. Twenty exchanges that led to something.
              </span>
              <span aria-hidden>
                <K>J</K>
                <K>K</K> move <K>↵</K> open <K>R</K> reply to Shrug <K>esc</K> back
              </span>
            </div>
          </>
        )}
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

function Thread({ x, place, message, unfolded, lit, onUnfold, onBack, onReply }: { x: Exchange; place: string; message: number; unfolded: number[]; lit: boolean; onUnfold: (i: number) => void; onBack: () => void; onReply: () => void }) {
  // The newest two are open; the earlier ones are a line each until they are asked for
  const folded = (i: number) => i < x.emails.length - 2 && !unfolded.includes(i)
  return (
    <div className="ml-thread">
      <div className="ml-col">
        <div className="ml-head">
          <button type="button" className="ml-k" onClick={onBack}>
            <ArrowLeft size={14} strokeWidth={2} aria-hidden />
            <span className="sr-only">Back to inbox</span>
            <K>esc</K>
          </button>
          <span className="ml-tag v">{x.led}</span>
          <span className="ml-k ml-place">{place}</span>
        </div>
        <h1>{x.subject}</h1>
        <div className="ml-led" data-lit={lit || undefined}>
          <b>What this led to</b>
          <span>{x.ledTo}</span>
        </div>
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
                <span className="av" aria-hidden>
                  {/^\[/.test(email.from) ? '[ ]' : email.from.charAt(0)}
                </span>
                <span>
                  <b>{email.from}</b> to {email.to}
                </span>
                <small>{timeOf(email.at)}</small>
              </header>
              {email.body.map((paragraph, n) => (
                <p key={n}>{paragraph}</p>
              ))}
            </article>
          ),
        )}
        <div className="ml-reply">
          <span>Nothing sends from here. Reply opens a new message to Shrug in Messages.</span>
          <button type="button" className="ml-go" onClick={onReply}>
            <MessageCircle size={14} strokeWidth={2.2} aria-hidden />
            Reply to Shrug <K>R</K>
          </button>
        </div>
      </div>
      <aside className="ml-side" aria-label="About this thread">
        <h2>In this thread</h2>
        <ul>
          {x.people.map((person) => (
            <li key={person.name}>
              {person.name}
              <span className="ml-tag">{person.of}</span>
            </li>
          ))}
        </ul>
        <h2>Shortcuts</h2>
        <ul>
          <li>
            Next thread<K>J</K>
          </li>
          <li>
            Previous thread<K>K</K>
          </li>
          <li>
            Reply to Shrug<K>R</K>
          </li>
          <li>
            Back to inbox<K>esc</K>
          </li>
          <li>
            Command
            <span>
              <K>⌘</K>
              <K>K</K>
            </span>
          </li>
        </ul>
      </aside>
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
        <label className="in">
          <CommandIcon size={18} strokeWidth={2} aria-hidden />
          <input autoFocus type="text" role="combobox" aria-expanded aria-controls="mail-commands" aria-activedescendant={found[on] ? `mail-command-${found[on]!.id}` : undefined} aria-label="Command" value={typed} spellCheck={false} autoComplete="off" onChange={(e) => (setTyped(e.target.value), setAt(0))} />
        </label>
        <h2>Commands</h2>
        <ul id="mail-commands" role="listbox" aria-label="Commands">
          {found.map((c, i) => (
            <li key={c.id} id={`mail-command-${c.id}`} role="option" aria-selected={i === on} className={i === on ? 'on' : undefined} onPointerMove={() => i !== on && setAt(i)} onClick={() => onRun(c.does)}>
              {ICON[c.id] ?? (typeof c.does === 'string' ? <CornerDownLeft size={16} strokeWidth={1.9} aria-hidden /> : <Lock size={15} strokeWidth={1.9} aria-hidden />)}
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
        <div className="in">
          <Keyboard size={18} strokeWidth={2} aria-hidden />
          <span>Keyboard shortcuts</span>
          <button type="button" className="ml-k" onClick={onClose}>
            <K>esc</K>
          </button>
        </div>
        <p className="ml-leave">
          Tab moves between splits here, as it does in Superhuman. <K>F6</K> leaves Mail for the Dock or the menu bar.
        </p>
        <div className="ml-groups" tabIndex={0} role="group" aria-label="Every key">
          {GROUPS.map((group) => (
            <section key={group}>
              <h2>{group}</h2>
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
