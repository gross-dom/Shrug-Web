import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent, type ReactElement, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { PEOPLE, RELATION_LABEL } from '../data/people'
import { SITE } from '../data/site'
import { Badge } from '../kit/controls/Badge'
import { Toggle } from '../kit/controls/Toggle'
import { Bubble, Receipt, Stamp, Thread } from '../kit/messages'
import { Popover } from '../kit/motion/Popover'
import { Avatar } from '../kit/parts/Avatar'
import { Row } from '../kit/parts/Row'
import { APPS, DOCK_APPS } from '../os/apps'
import { prefersReducedMotion } from '../os/dom'
import { AppIcon, DocumentIcon } from '../os/icons'
import { launchApp } from '../os/launch'
import { useStore } from '../os/store'
import { chat, finishChat, QUESTION, replayChat, sendMessage, sentAt, toggleChat, TOTAL, type ChatItem } from './chat'
import { clearJump, inbox, openConversation, setInboxQuery, showInGroup, type Conversation } from './state'
import { SearchField, ShrugAvatar } from './ui'

// The parts of the group chat that the Mac window and the phone screen share:
// the conversation itself, the message field, the list of conversations and
// the details panel. The kit draws the bubbles, typing dots, stamps and
// receipts; everything here is laid out the way Messages lays it out, and the
// two screens differ only in their chrome and their sizes.

export const GROUP_NAME = 'Shrug Family'

const TIME = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
/** A time as Messages writes it beside a conversation. */
export const clock = (t: number) => TIME.format(t || Date.now())

export const relationsOf = (index: number) => PEOPLE[index]!.relations.map((r) => RELATION_LABEL[r])

// ---- Faces ----

/** A contact with no photo: the gray monogram Messages gives them. */
export function PersonAvatar({ index, size = 28 }: { index: number; size?: number }) {
  return <Avatar name={PEOPLE[index]!.name.replace(' & ', ' ')} tone="ios" size={size} />
}

/** The group's own photo: Shrug's mark. */
export const GroupAvatar = ({ size = 28 }: { size?: number }) => <ShrugAvatar size={size} />

export const ConversationAvatar = ({ conversation, size }: { conversation: Conversation; size?: number }) =>
  conversation === 'group' ? <GroupAvatar size={size} /> : <PersonAvatar index={conversation} size={size} />

export const conversationName = (conversation: Conversation) => (conversation === 'group' ? GROUP_NAME : PEOPLE[conversation]!.name)

// ---- What people said ----

/** Stand-in lines for a quote that hasn't been supplied. */
function lineWidths(index: number) {
  const words = 12 + ((index * 7) % 5) * 5
  const perLine = 11
  const lines: number[] = Array(Math.floor(words / perLine)).fill(292)
  const rest = words % perLine
  if (rest) lines.push(Math.max(72, Math.round((rest / perLine) * 292)))
  return lines
}

/** One element per person, made once: a bubble only re-measures when its content really changes. */
export const QUOTES: ReactNode[] = PEOPLE.map((person, index) =>
  person.quote ? (
    person.quote
  ) : (
    <span key={index} className="quote-lines" role="img" aria-label="Quote to come">
      {lineWidths(index).map((w, i) => (
        <i key={i} style={{ width: w }} />
      ))}
    </span>
  ),
)

// ---- The conversation ----

const DAY_MS = 86_400_000
const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: 'long' })
const DATE = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'numeric', year: '2-digit' })

/** How many midnights ago a moment was. */
const daysAgo = (t: number) => Math.round((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / DAY_MS)

/** The day a message is from, as Messages names it: Today, Yesterday, the weekday, then the date. */
const dayOf = (t: number) => {
  const days = daysAgo(t)
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 7 ? WEEKDAY.format(t) : DATE.format(t)
}

/** When a conversation last heard something, as its row in the list says it: the time today, the day before that. */
export const rowTime = (t: number) => (daysAgo(t) <= 0 ? clock(t) : dayOf(t))

export const stamp = (at: number) => (
  <Stamp key="stamp" className="chat-stamp">
    <b>iMessage</b>
    <br />
    <b>{dayOf(at)}</b> {clock(at)}
  </Stamp>
)

const undelivered = (key: string) => (
  <div key={`${key}-failed`} className="chat-undelivered" role="status">
    Not Delivered
  </div>
)

function groupNodes(items: ChatItem[], asked: boolean, startedAt: number, source: string) {
  const nodes: ReactElement[] = [
    stamp(startedAt),
    <Stamp key="named" className="chat-note">
      You named the conversation “{GROUP_NAME}”.
    </Stamp>,
  ]
  let lastSent = ''
  for (const item of items) if (item.kind === 'me' && item.by === 'shrug') lastSent = item.key
  for (const item of items) {
    if (item.kind === 'me') {
      const failed = item.by === 'visitor'
      nodes.push(
        <Bubble key={item.key} from="me" source={source} className={failed ? 'chat-failed' : undefined}>
          {item.text}
        </Bubble>,
      )
      if (failed) nodes.push(undelivered(item.key))
      // Under the last message that went: where Messages keeps "Delivered"
      else if (asked && item.key === lastSent)
        nodes.push(
          <Receipt key="receipt" show>
            Delivered
          </Receipt>,
        )
    } else {
      const person = PEOPLE[item.index]!
      nodes.push(
        <div key={`${item.key}-who`} className="chat-who">
          {person.name}
          {person.role ? ` · ${person.role}` : ''}
        </div>,
      )
      nodes.push(
        <Bubble key={item.key} from="them" typing={item.typing} tail avatar={<PersonAvatar index={item.index} />} data-person={item.index}>
          {QUOTES[item.index]}
        </Bubble>,
      )
    }
  }
  return nodes
}

/** One person's own conversation: the question, and what they said to it. It is all there from the start. */
function personNodes(index: number, at: number, direct: { key: string; text: string }[], source: string) {
  const nodes: ReactElement[] = [stamp(at)]
  QUESTION.forEach((text, n) =>
    nodes.push(
      <Bubble key={`ask-${n}`} from="me">
        {text}
      </Bubble>,
    ),
  )
  nodes.push(
    <Receipt key="receipt" show>
      Delivered
    </Receipt>,
  )
  nodes.push(
    <Bubble key="reply" from="them" tail>
      {QUOTES[index]}
    </Bubble>,
  )
  for (const message of direct) {
    nodes.push(
      <Bubble key={message.key} from="me" source={source} className="chat-failed">
        {message.text}
      </Bubble>,
    )
    nodes.push(undelivered(message.key))
  }
  return nodes
}

/** The thread's own scrolling curve: quick off the mark, a long settle. */
const settle = (k: number) => 1 - Math.pow(1 - k, 4)
const FOLLOW_MS = 550
/** How long after a touch, a wheel or a key a scroll is still the reader's: a flick carries on after the finger lifts. */
const HAND_MS = 3000
const NO_MESSAGES: { key: string; text: string }[] = []

/** A conversation's messages: they scroll, and the view stays on the newest
 * one the way a chat does, until the reader scrolls back to read. The desktop's
 * conversations and the phone's are both drawn through this.
 * `jump` is a person whose reply to bring into view and ring. */
export function Scroller({ label, nodes, jump, onJumped, active = true, foot, onTap }: { label: string; nodes: ReactElement[]; jump?: number | null; onJumped?: () => void; active?: boolean; foot?: ReactNode; onTap?: (e: MouseEvent<HTMLDivElement>) => void }) {
  const scroller = useRef<HTMLDivElement>(null)
  const flow = useRef<HTMLDivElement>(null)
  /** Following the newest message, until the reader scrolls back. */
  const pinned = useRef(true)
  /** The scroll that is moving is ours, not the reader's. `to` is where it is
   * going: a fixed place, or null for the end, wherever that is by then. */
  const run = useRef<{ frame: number; from: number; t0: number; to: number | null } | null>(null)
  const flash = useRef<ReturnType<typeof setTimeout>>()
  const count = nodes.length
  const [seen, setSeen] = useState(count)
  const [away, setAway] = useState(false)
  const first = useRef(true)
  const latest = useRef(count)
  latest.current = count

  const stop = () => {
    if (run.current) cancelAnimationFrame(run.current.frame)
    run.current = null
  }

  /** Eases the thread to a place, or to its end. Called again mid-way (a
   * bubble still growing, another reply landing) it carries on from where it is. */
  const glide = (to: number | null, instant = false) => {
    const el = scroller.current
    if (!el) return
    const end = el.scrollHeight - el.clientHeight
    const goal = Math.max(0, Math.min(end, to ?? end))
    if (instant || prefersReducedMotion() || Math.abs(goal - el.scrollTop) < 1) {
      stop()
      el.scrollTop = goal
      return
    }
    // Not yet begun, and headed the same way: it will read the newest end when it does
    if (run.current && !run.current.t0 && run.current.to === to) return
    const step = (now: number) => {
      const state = run.current
      if (!state) return
      // A fresh run starts its clock on its first frame, the same frame the
      // arriving bubble starts fading in on, so the two can't drift apart
      // when the page is busy
      if (!state.t0) state.t0 = now
      const limit = el.scrollHeight - el.clientHeight
      const target = Math.max(0, Math.min(limit, state.to ?? limit))
      const k = Math.min(1, (now - state.t0) / FOLLOW_MS)
      el.scrollTop = state.from + (target - state.from) * settle(k)
      if (k < 1) state.frame = requestAnimationFrame(step)
      else {
        el.scrollTop = target
        // Held one more frame, so the scroll event this causes is still ours
        state.frame = requestAnimationFrame(() => {
          if (run.current === state) run.current = null
        })
      }
    }
    const carrying = run.current !== null && run.current.to === to
    stop()
    const next = { frame: 0, from: el.scrollTop, t0: carrying ? performance.now() : 0, to }
    run.current = next
    next.frame = requestAnimationFrame(step)
  }

  /** A finger is on the thread: it is the reader's to scroll, and nothing moves it for them. */
  const held = useRef(false)
  /** When the reader last had a hand on the thread. */
  const touched = useRef(-Infinity)
  const hand = () => {
    touched.current = performance.now()
    stop()
  }

  const follow = (instant = false) => {
    if (!held.current || instant) glide(null, instant)
  }

  // A message has landed: pinned, the thread follows it
  useLayoutEffect(() => {
    if (!pinned.current) return
    follow(first.current)
    first.current = false
    setSeen(count)
  }, [count]) // eslint-disable-line react-hooks/exhaustive-deps

  // A bubble growing out of its typing dots, or the window being resized,
  // changes the height without a new message: stay on the end through that too
  useEffect(() => {
    const el = scroller.current
    const inner = flow.current
    if (!el || !inner) return
    const ro = new ResizeObserver(() => {
      if (pinned.current) follow()
    })
    ro.observe(inner)
    ro.observe(el)
    return () => {
      ro.disconnect()
      stop()
      clearTimeout(flash.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Asked for from elsewhere: bring one person's reply to the middle and ring it
  useEffect(() => {
    if (jump === null || jump === undefined || !active) return
    const el = scroller.current
    const bubble = el?.querySelector<HTMLElement>(`[data-person="${jump}"]`)
    onJumped?.()
    if (!el || !bubble) return
    const box = el.getBoundingClientRect()
    const at = bubble.getBoundingClientRect()
    // What is measured on the page is as it is drawn: inside a scaled frame (the phone's), a distance on the page is that much less of the thread
    const k = box.width / el.offsetWidth || 1
    // A long reply is shown from its top; a short one sits in the middle
    const top = el.scrollTop + (at.top - box.top) / k - Math.max(28, (el.clientHeight - at.height / k) / 2)
    // The thread lets go of its end to stay here
    pinned.current = false
    setAway(el.scrollHeight - el.clientHeight - top > 56)
    glide(top)
    bubble.removeAttribute('data-flash')
    void bubble.offsetWidth
    bubble.setAttribute('data-flash', '')
    clearTimeout(flash.current)
    flash.current = setTimeout(() => bubble.removeAttribute('data-flash'), 1700)
  }, [jump, active]) // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = scroller.current
    if (!el || run.current) return
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 56
    // Only the reader lets go of the end. A browser can move the scroll
    // itself, by a few pixels, as a bubble changes size (Safari's does), and
    // say so before the thread has started to follow: that is nobody's hand
    if (!atEnd && !held.current && performance.now() - touched.current > HAND_MS) return
    pinned.current = atEnd
    setAway(!atEnd)
    if (atEnd) setSeen(latest.current)
  }

  const unseen = away ? Math.max(0, count - seen) : 0

  return (
    <div className="chat__pane">
      {/* Any scroll the reader starts takes over from ours */}
      <div
        ref={scroller}
        className="chat__scroll"
        onClick={onTap}
        onScroll={onScroll}
        onWheel={hand}
        onPointerDown={hand}
        onKeyDown={hand}
        onTouchStart={() => {
          held.current = true
          hand()
        }}
        onTouchMove={() => (touched.current = performance.now())}
        onTouchEnd={() => {
          held.current = false
          touched.current = performance.now()
        }}
        onTouchCancel={() => (held.current = false)}
        tabIndex={0}
        role="log"
        aria-label={label}
        aria-live="off"
      >
        <div ref={flow} className="chat__flow">
          <Thread app="imessage" className="chat__thread">
            {nodes}
          </Thread>
          {foot}
        </div>
      </div>
      <button
        type="button"
        className="chat__new"
        data-show={away || undefined}
        tabIndex={away ? 0 : -1}
        aria-hidden={!away}
        onClick={() => {
          pinned.current = true
          setAway(false)
          setSeen(latest.current)
          follow()
        }}
      >
        <ArrowDown size={13} strokeWidth={2.4} aria-hidden />
        {unseen > 0 ? `${unseen} new` : 'Latest'}
      </button>
    </div>
  )
}

/** One of the desktop's conversations: the group as it plays out, or one person's own. */
export function Transcript({ conversation, source, active = true }: { conversation: Conversation; source: string; active?: boolean }) {
  const items = useStore(chat, (s) => s.items)
  const asked = useStore(chat, (s) => s.asked)
  const startedAt = useStore(chat, (s) => s.startedAt)
  const direct = useStore(chat, (s) => (typeof conversation === 'number' ? (s.direct[conversation] ?? NO_MESSAGES) : NO_MESSAGES))
  const jump = useStore(inbox, (s) => (conversation === 'group' ? s.jump : null))
  const nodes = useMemo(
    () => (conversation === 'group' ? groupNodes(items, asked, startedAt, source) : personNodes(conversation, sentAt(conversation, startedAt), direct, source)),
    [conversation, items, asked, startedAt, direct, source],
  )
  return <Scroller label={conversationName(conversation)} nodes={nodes} jump={jump} onJumped={clearJump} active={active} />
}

// ---- The message field ----

/** The field at the foot of a conversation. The script types Shrug's own
 * messages into it; anything the visitor types is theirs to send. */
export function Composer({ conversation, target }: { conversation: Conversation; target: string }) {
  const [text, setText] = useState('')
  const [more, setMore] = useState(false)
  const draft = useStore(chat, (s) => (conversation === 'group' ? s.draft : null))
  const root = useRef<HTMLFormElement>(null)
  const ready = text.trim().length > 0
  const ghost = draft !== null && !text

  useEffect(() => {
    if (!more) return
    const away = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.composer__more, .composer__plus')) setMore(false)
    }
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setMore(false)
    }
    document.addEventListener('pointerdown', away, true)
    window.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away, true)
      window.removeEventListener('keydown', key)
    }
  }, [more])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    sendMessage(text, conversation)
    setText('')
  }

  return (
    <form ref={root} className="composer" onSubmit={submit}>
      <button type="button" className="composer__plus" aria-label="More from Shrug" aria-haspopup="menu" aria-expanded={more} onClick={() => setMore((m) => !m)}>
        <Plus size={18} strokeWidth={2.2} aria-hidden />
      </button>
      <Popover show={more} origin="bottom left" className="composer__more" role="menu" aria-label="More from Shrug" {...(more ? null : ({ inert: '' } as object))}>
        {DOCK_APPS.filter((id) => id !== 'messages').map((id) => (
          <button
            key={id}
            type="button"
            className="composer__app"
            role="menuitem"
            onClick={() => {
              setMore(false)
              launchApp(id)
            }}
          >
            <span className="composer__app-icon">
              <AppIcon id={id} />
            </span>
            {APPS[id].name}
          </button>
        ))}
        <a className="composer__app" role="menuitem" href={SITE.onePager} target="_blank" rel="noreferrer" onClick={() => setMore(false)}>
          <span className="composer__app-icon">
            <DocumentIcon />
          </span>
          One-pager
        </a>
      </Popover>
      <div className="composer__field" data-ghost={ghost || undefined}>
        {/* Where the words start: a sent bubble forms out of this spot */}
        <span className="composer__origin" data-target={target} aria-hidden />
        {ghost && (
          <span className="composer__ghost" aria-hidden>
            {draft}
            <i className="composer__caret" />
          </span>
        )}
        <input className="composer__input" type="text" placeholder={ghost ? '' : 'iMessage'} aria-label="iMessage" autoComplete="off" enterKeyHint="send" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="composer__send" aria-label="Send" data-ready={ready || undefined} aria-disabled={!ready} tabIndex={ready ? 0 : -1}>
          <ArrowUp size={15} strokeWidth={2.8} aria-hidden />
        </button>
      </div>
    </form>
  )
}

// ---- The list of conversations ----

interface ListRow {
  conversation: Conversation
  name: string
  preview: ReactNode
  /** When it last heard something, as the row says it. */
  when: string
  unread: boolean
}

const ConversationRow = memo(function ConversationRow({ row, selected, avatar, onPick }: { row: ListRow; selected: boolean; avatar: number; onPick: (c: Conversation) => void }) {
  return (
    <Row
      className="conv"
      pad={8}
      role="option"
      aria-selected={selected}
      aria-label={`${row.name}${row.unread ? ', unread' : ''}`}
      data-conversation={row.conversation}
      unread={row.unread}
      selected={selected}
      lead={<ConversationAvatar conversation={row.conversation} size={avatar} />}
      title={row.name}
      meta={row.when}
      preview={row.preview}
      onClick={() => onPick(row.conversation)}
    />
  )
})

/** Every conversation: the group, then everyone's own message to Shrug, all
 * there from the start, to read through while the group plays out beside them. */
export function ConversationList({ onPick, selectable = true, avatar = 40 }: { onPick?: (c: Conversation) => void; selectable?: boolean; avatar?: number }) {
  const replied = useStore(chat, (s) => s.replied)
  const repliedAt = useStore(chat, (s) => s.repliedAt)
  const startedAt = useStore(chat, (s) => s.startedAt)
  const last = useStore(chat, (s) => {
    for (let i = s.items.length - 1; i >= 0; i--) {
      const item = s.items[i]!
      if (item.kind === 'me') return item.text
      if (!item.typing) return PEOPLE[item.index]!.quote ?? ''
    }
    return ''
  })
  const { open, read, groupSeen, query } = useStore(inbox, (s) => s)
  const q = query.trim().toLowerCase()

  const rows = useMemo(() => {
    const out: ListRow[] = []
    if (!q || GROUP_NAME.toLowerCase().includes(q))
      out.push({ conversation: 'group', name: GROUP_NAME, preview: last || ' ', when: clock(replied ? repliedAt[replied - 1]! : startedAt), unread: open !== 'group' && replied > groupSeen })
    PEOPLE.forEach((person, i) => {
      if (q && !person.name.toLowerCase().includes(q) && !person.role.toLowerCase().includes(q) && !(person.quote ?? '').toLowerCase().includes(q)) return
      out.push({ conversation: i, name: person.name, preview: person.quote ?? [150, 96], when: rowTime(sentAt(i, startedAt)), unread: !read.includes(i) && open !== i })
    })
    return out
  }, [q, last, replied, repliedAt, startedAt, open, read, groupSeen])

  const pick = (c: Conversation) => {
    openConversation(c)
    onPick?.(c)
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return
    e.preventDefault()
    const at = rows.findIndex((r) => r.conversation === open)
    if (e.key === 'Enter') return void (rows[at] && pick(rows[at]!.conversation))
    const next = rows[Math.max(0, Math.min(rows.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))]
    if (!next) return
    pick(next.conversation)
    // Keeps the row that was picked in view, moving only the list
    const list = e.currentTarget as HTMLElement
    const row = list.querySelector<HTMLElement>(`[data-conversation="${next.conversation}"]`)
    if (!row) return
    const box = list.getBoundingClientRect()
    const r = row.getBoundingClientRect()
    const k = box.width / list.offsetWidth || 1
    if (r.top < box.top) list.scrollTop -= (box.top - r.top) / k + 8
    else if (r.bottom > box.bottom) list.scrollTop += (r.bottom - box.bottom) / k + 8
  }

  return (
    <div className="conv-list scrolls" role="listbox" aria-label="Conversations" tabIndex={0} onKeyDown={onKey}>
      {rows.map((row) => (
        <ConversationRow key={row.conversation} row={row} selected={selectable && row.conversation === open} avatar={avatar} onPick={pick} />
      ))}
      {rows.length === 0 && <div className="side-empty">No Results</div>}
    </div>
  )
}

export function ConversationSearch() {
  const query = useStore(inbox, (s) => s.query)
  return <SearchField value={query} onChange={setInboxQuery} label="Search conversations" />
}

/** One conversation and the field under it. Sent bubbles form out of this pane's own field. */
export function ConversationPane({ conversation, active = true }: { conversation: Conversation; active?: boolean }) {
  const target = `composer-${useId().replace(/:/g, '')}`
  return (
    <>
      <Transcript conversation={conversation} source={target} active={active} />
      <Composer conversation={conversation} target={target} />
    </>
  )
}

// ---- Details ----

/** A run of replies and its controls, as the details panel needs them. */
export interface ReplyStream {
  replied: number
  paused: boolean
  done: boolean
  toggle: () => void
  finish: () => void
  replay: () => void
}

/** What the info button opens: who is in the conversation, and the controls
 * for the replies as they play out. `tap` says what picking a person does: on
 * the desktop it opens their own conversation; on a phone, where there is only
 * the group, it shows their card (with what they said) in the same place. */
export function Details({ conversation, onPick, onDone, tap = 'conversation', stream }: { conversation: Conversation; onPick?: (c: Conversation) => void; onDone?: () => void; tap?: 'conversation' | 'details'; stream?: ReplyStream }) {
  const desktop = useStore(chat, (s) => s)
  // The replies the controls work: the desktop's group chat, unless another is handed in (the phone's own conversation)
  const { replied, paused, done, toggle, finish, replay } = stream ?? { replied: desktop.replied, paused: desktop.paused, done: desktop.done, toggle: toggleChat, finish: finishChat, replay: replayChat }

  if (typeof conversation === 'number') {
    const person = PEOPLE[conversation]!
    return (
      <div className="details">
        <div className="details__head">
          <PersonAvatar index={conversation} size={64} />
          <div className="details__name">{person.name}</div>
          <div className="details__sub">{person.role}</div>
          {person.relations.length > 0 && (
            <div className="details__tags">
              {relationsOf(conversation).map((label) => (
                <Badge key={label}>{label}</Badge>
              ))}
            </div>
          )}
        </div>
        {tap === 'details' && person.quote && <blockquote className="details__quote">{person.quote}</blockquote>}
        {conversation < replied && (
          <div className="details__group">
            <button
              type="button"
              className="details__row details__row--action"
              onClick={() => {
                showInGroup(conversation)
                onPick?.('group')
                onDone?.()
              }}
            >
              Show in {GROUP_NAME}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="details">
      <div className="details__head">
        <GroupAvatar size={64} />
        <div className="details__name">{GROUP_NAME}</div>
        <div className="details__sub">{TOTAL} People</div>
      </div>
      <div className="details__group">
        <button type="button" className="details__row" role="switch" aria-checked={paused} aria-disabled={done || undefined} onClick={done ? undefined : toggle}>
          <span>Pause Replies</span>
          <Toggle on={paused} aria-hidden />
        </button>
        <button type="button" className="details__row details__row--action" aria-disabled={done || undefined} onClick={done ? undefined : finish}>
          Show Every Reply
        </button>
        <button type="button" className="details__row details__row--action" onClick={replay}>
          Play From the Start
        </button>
      </div>
      <div className="details__label">{TOTAL} People</div>
      <div className="details__group details__people">
        {PEOPLE.map((person, i) => {
          return (
            <button
              key={i}
              type="button"
              className="details__row details__person"
              onClick={() => {
                if (tap === 'details') return onPick?.(i)
                openConversation(i)
                onPick?.(i)
                onDone?.()
              }}
            >
              <PersonAvatar index={i} size={30} />
              <span className="details__who">
                <span className="details__who-name">{person.name}</span>
                <span className="details__who-role">{person.role}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
