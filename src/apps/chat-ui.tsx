import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent, type MutableRefObject, type ReactElement, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronsDown, FileText, Pause, Plus, UserRound, X } from 'lucide-react'
import { EGGS, eggOf, lastWords, type Egg, type EggLink } from '../data/eggs'
import { COMPANY_OF } from '../data/founders'
import { PEOPLE, RELATION_LABEL } from '../data/people'
import { COMPANIES } from '../data/portfolio'
import { SITE } from '../data/site'
import { Badge } from '../kit/controls/Badge'
import { Toggle } from '../kit/controls/Toggle'
import { Bubble, Receipt, Stamp, Thread } from '../kit/messages'
import { Avatar } from '../kit/parts/Avatar'
import { Row } from '../kit/parts/Row'
import { prefersReducedMotion } from '../os/dom'
import { firstControl, focusFirst, useReturnFocus } from '../os/focus'
import { launchApp, showCompany } from '../os/launch'
import { atPerson, linkTo } from '../os/place'
import { useStore } from '../os/store'
import { attach, attached, attachedTo, chat, detach, finishChat, MOST_FILES, replayChat, resumeChat, sendMessage, setUnsent, toggleChat, TOTAL, unsent, type Chat, type ChatFile, type ChatItem, type Written } from './chat'
import { folded } from './fold'
import { clearJump, inbox, openConversation, setInboxQuery, showInGroup, type Conversation } from './state'
import { SearchField, ShrugAvatar } from './ui'
import { formatter } from '../os/dates'

// The parts of the group chat that the Mac window and the phone screen share:
// the conversation itself, the message field, the list of conversations and
// the details panel. The kit draws the bubbles, typing dots, stamps and
// receipts; everything here is laid out the way Messages lays it out, and the
// two screens differ only in their chrome and their sizes.

export const GROUP_NAME = 'Testimonials'

const TIME = formatter({ hour: 'numeric', minute: '2-digit' })
/** A time as Messages writes it beside a conversation. */
export const clock = (t: number) => TIME.format(t || Date.now())

export const relationsOf = (index: number) => PEOPLE[index]!.relations.map((r) => RELATION_LABEL[r])

// ---- Faces ----

/** A contact with no photo: the gray monogram Messages gives them. It is a
 * picture of the name beside it, so its initials are never read out before the name. */
export function PersonAvatar({ index, size = 28 }: { index: number; size?: number }) {
  const person = PEOPLE[index]!
  // Their photograph, where Shrug has supplied one; their initials otherwise
  return <Avatar name={person.name.replace(' & ', ' ')} tone="ios" size={size} src={person.photo ? `${import.meta.env.BASE_URL}people/${person.photo}` : undefined} aria-hidden />
}

/** The group's own photo: Shrug's mark. */
export const GroupAvatar = ({ size = 28 }: { size?: number }) => <ShrugAvatar size={size} />

/** The other side of one of the other conversations: a monogram where there is
 * a name, and where there is only a number the plain face Messages gives a
 * sender it doesn't know. */
export function EggAvatar({ egg, size = 28 }: { egg: Egg; size?: number }) {
  if (/[a-z]/i.test(egg.name)) return <Avatar name={egg.name} tone="ios" size={size} aria-hidden />
  return (
    <span className="chat-face" style={{ width: size, height: size }} aria-hidden>
      <Avatar tone="ios" size={size} />
      <UserRound className="chat-face__glyph" size={Math.round(size * 0.58)} strokeWidth={0} fill="currentColor" aria-hidden />
    </span>
  )
}

export function ConversationAvatar({ conversation, size }: { conversation: Conversation; size?: number }) {
  const egg = conversation === 'group' ? null : eggOf(conversation)
  return egg ? <EggAvatar egg={egg} size={size} /> : <GroupAvatar size={size} />
}

export const conversationName = (conversation: Conversation) => (conversation === 'group' ? GROUP_NAME : (eggOf(conversation)?.name ?? GROUP_NAME))

/** When one of the other conversations last heard something: so long before this visit began, so it stays put while the visit lasts.
 * One heard from at night was heard from the last time it was that hour: earlier today, or, on a visit
 * that is itself in the small hours and has not reached it, a few minutes ago. */
export const eggAt = (egg: Egg, startedAt: number) => {
  if (!egg.night) return startedAt - egg.ago * 60_000
  const then = new Date(startedAt).setHours(egg.night.hour, egg.night.minute, 0, 0)
  return then <= startedAt ? then : startedAt - 9 * 60_000
}

/** The others, the one heard from most lately first. */
const EGGS_BY_AGE = [...EGGS].sort((a, b) => a.ago - b.ago)

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
const WEEKDAY = formatter({ weekday: 'long' })
const DATE = formatter({ day: 'numeric', month: 'numeric', year: '2-digit' })

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

/** Whose bubble it is, for assistive tech: without it a conversation is loose
 * lines, with nothing to tie a name to what was said or to tell Shrug's from
 * anyone else's. */
const said = (who: string) => ({ role: 'group', 'aria-label': who }) as object
const SHRUGS = said(SITE.name)
const YOURS = said('You')

/** A file's size as Messages says it. */
export function sizeOf(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  const mb = bytes / (1024 * 1024)
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}

/** What a bubble that holds a file is marked with. (It rises into place as a received one does: only words
 * are lifted out of the field.) */
const FILED = { 'data-file': '' } as const

/** A file the visitor sent, in its bubble: a picture as itself, anything else by its name and its size.
 * (apps.css takes the bubble's blue and its tail off round both.) */
function FileSent({ file }: { file: ChatFile }) {
  return file.url ? (
    <img className="chat-pic" src={file.url} alt={file.name} draggable={false} />
  ) : (
    <span className="chat-file">
      <FileText size={26} strokeWidth={1.7} aria-hidden />
      <span className="chat-file__words">
        <b dir="auto">{file.name}</b>
        <span>{sizeOf(file.size)}</span>
      </span>
    </span>
  )
}

/** Under the last message of a conversation that was over long ago: it has been Delivered all along. */
const delivered = (
  <Receipt key="receipt" show>
    Delivered
  </Receipt>
)

/** Under a message sent while the conversation is watched, Shrug's own or the visitor's: it says Delivered a
 * moment after the bubble has landed, as Messages does, and not while its words are still on their way up
 * from the field (the wait is the stylesheet's: `.chat-sent`). */
const deliveredTo = (key: string) => (
  <Receipt key={`${key}-receipt`} show className="chat-sent">
    Delivered
  </Receipt>
)

function groupNodes(items: ChatItem[], asked: boolean, startedAt: number, source: string) {
  const nodes: ReactElement[] = [
    stamp(startedAt),
    <Stamp key="named" className="chat-note">
      You named the conversation “{GROUP_NAME}”.
    </Stamp>,
  ]
  // "Delivered" is kept under the last message that was sent from here, whoever has replied since
  let lastSent = ''
  for (const item of items) if (item.kind === 'me') lastSent = item.key
  for (const item of items) {
    if (item.kind === 'me') {
      const yours = item.by === 'visitor'
      nodes.push(
        <Bubble key={item.key} from="me" {...(item.file ? FILED : { source })} {...(yours ? YOURS : SHRUGS)}>
          {item.file ? <FileSent file={item.file} /> : item.text}
        </Bubble>,
      )
      if (item.key === lastSent && (yours || asked)) nodes.push(deliveredTo(item.key))
    } else {
      const person = PEOPLE[item.index]!
      // The line over the bubble is for the eye; the bubble says the same for assistive tech, as its own name
      nodes.push(
        <div key={`${item.key}-who`} className="chat-who" aria-hidden>
          {person.name}
          {person.role ? ` · ${person.role}` : ''}
        </div>,
      )
      nodes.push(
        <Bubble key={item.key} from="them" typing={item.typing} tail avatar={<PersonAvatar index={item.index} />} data-person={item.index} {...said(person.role ? `${person.name}, ${person.role}` : person.name)}>
          {QUOTES[item.index]}
        </Bubble>,
      )
    }
  }
  return nodes
}

/** What a bubble holds when it goes somewhere: a page in a new tab, or one of the site's own apps. */
function Linked({ link }: { link: EggLink }) {
  return 'href' in link ? (
    <a className="chat-link" href={link.href} target="_blank" rel="noreferrer">
      {link.label}
      <span className="sr-only">, opens in a new tab</span>
    </a>
  ) : (
    <button type="button" className="chat-link" onClick={() => launchApp(link.app)}>
      {link.label}
    </button>
  )
}

/** One of the other conversations: what was said in it, all there from the
 * start, and after that whatever the visitor has typed into it. */
function eggNodes(egg: Egg, at: number, direct: Written[], source: string) {
  const nodes: ReactElement[] = [stamp(at)]
  const theirs = said(egg.name)
  egg.messages.forEach((message, n) =>
    nodes.push(
      <Bubble key={`said-${n}`} from={message.from} {...(message.from === 'me' ? SHRUGS : theirs)}>
        {'link' in message ? <Linked link={message.link} /> : message.text}
      </Bubble>,
    ),
  )
  // Under the last message sent from here: where Messages keeps "Delivered"
  if (!direct.length && egg.messages[egg.messages.length - 1]?.from === 'me') nodes.push(delivered)
  direct.forEach((message, n) => {
    nodes.push(
      <Bubble key={message.key} from="me" {...(message.file ? FILED : { source })} {...YOURS}>
        {message.file ? <FileSent file={message.file} /> : message.text}
      </Bubble>,
    )
    if (n === direct.length - 1) nodes.push(deliveredTo(message.key))
  })
  return nodes
}

/** The thread's own scrolling curve: quick off the mark, a long settle. */
const settle = (k: number) => 1 - Math.pow(1 - k, 4)
/** Where a scroll of the thread's own is headed: a place, the end (null), or a place worked out as it goes. */
type Aim = number | null | (() => number)
const placeOf = (to: Aim) => (typeof to === 'function' ? to() : to)
const FOLLOW_MS = 550
/** How long after a touch, a wheel or a key a scroll is still the reader's: a flick carries on after the finger lifts. */
const HAND_MS = 3000
const NO_MESSAGES: Written[] = []

interface ScrollerProps {
  label: string
  nodes: ReactElement[]
  /** A person whose reply to bring into view and ring. */
  jump?: number | null
  onJumped?: () => void
  active?: boolean
  foot?: ReactNode
  onTap?: (e: MouseEvent<HTMLDivElement>) => void
  /** How many messages of the visitor's own are in it: one more is one just sent, and the thread goes to it. */
  mine?: number
  /** It is all there from the start, to be read from the top: it begins there, with the way to the newest offered. */
  fromTop?: boolean
  /** How many replies are still to come, and what brings them all at once: offered at the head of the thread
   * for as long as there are any, so that nobody has to wait for every one. */
  rest?: number
  onAll?: () => void
  /** The replies have been stopped where they were: the conversation says so at its head, where the offer of
   * every reply was, and that is where they are set going again. */
  paused?: boolean
  onResume?: () => void
  /** Its window has been closed (closed, not minimised or left for another). Opened again, the conversation is
   * at its newest message, as Messages opens one, wherever it had been scrolled to before. */
  shut?: boolean
  /** What assistive tech is told as the conversation goes on. The thread itself is never read out as it grows. */
  status?: string
}

/** A conversation's messages: they scroll, and the view stays on the newest
 * one the way a chat does, until the reader scrolls back to read. The desktop's
 * conversations and the phone's are both drawn through this. */
export function Scroller({ label, nodes: latestNodes, jump, onJumped, active = true, foot, onTap, mine = 0, fromTop = false, rest = 0, onAll, paused = false, onResume, shut = false, status = '' }: ScrollerProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const flow = useRef<HTMLDivElement>(null)
  // A thread that is not being drawn (its window is closed, its app is put away) is held as it was. A
  // bubble measures itself as its dots become its words, and one that does so while there is nothing to
  // measure keeps the size of its dots, with its words run far out of it: the thread came back with a
  // screen of nothing under its last message. Shown again, it catches up with all that was said meanwhile
  const [drawn, setDrawn] = useState(true)
  const held = useRef(latestNodes)
  if (drawn) held.current = latestNodes
  const nodes = held.current
  /** Where the thread was scrolled to when it was last drawn: a thread that is put away loses its place. */
  const place = useRef(0)
  /** Following the newest message, until the reader scrolls back. */
  const pinned = useRef(!fromTop)
  /** The scroll that is moving is ours, not the reader's. `to` is where it is
   * going: a fixed place, null for the end, wherever that is by then, or a
   * place that is asked for afresh each frame (a reply that is still being
   * moved down by what is growing above it). */
  const run = useRef<{ frame: number; from: number; t0: number; to: Aim } | null>(null)
  const flash = useRef<ReturnType<typeof setTimeout>>()
  // How many messages are in it: the lines over them (who said it, Delivered) are not counted as news
  const count = useMemo(() => nodes.reduce((n, node) => n + (node.type === Bubble ? 1 : 0), 0), [nodes])
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
  const glide = (to: Aim, instant = false) => {
    const el = scroller.current
    if (!el) return
    const end = el.scrollHeight - el.clientHeight
    const goal = Math.max(0, Math.min(end, placeOf(to) ?? end))
    // (A place that may still move is gone to even from where it already is, so as to stay on it)
    if (instant || prefersReducedMotion() || (typeof to !== 'function' && Math.abs(goal - el.scrollTop) < 1)) {
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
      const target = Math.max(0, Math.min(limit, placeOf(state.to) ?? limit))
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
  const fingered = useRef(false)
  /** When the reader last had a hand on the thread. */
  const touched = useRef(-Infinity)
  const hand = () => {
    touched.current = performance.now()
    stop()
  }

  const follow = (instant = false) => {
    if (!fingered.current || instant) glide(null, instant)
  }

  // A message has landed: pinned, the thread follows it
  useLayoutEffect(() => {
    const starting = first.current
    first.current = false
    if (!pinned.current) {
      // Begun whole and read from its top: the way to the newest is offered, where there is further to go
      const el = scroller.current
      if (starting && el) setAway(el.scrollHeight - el.clientHeight > 56)
      return
    }
    follow(starting)
    setSeen(count)
  }, [count]) // eslint-disable-line react-hooks/exhaustive-deps

  // A message of the reader's own is sent from the end of the conversation,
  // as Messages sends one: wherever the thread had been left, it goes there
  const sentSoFar = useRef(mine)
  useLayoutEffect(() => {
    const more = mine > sentSoFar.current
    sentSoFar.current = mine
    if (!more) return
    pinned.current = true
    setAway(false)
    setSeen(latest.current)
    follow()
  }, [mine]) // eslint-disable-line react-hooks/exhaustive-deps

  // A window that is closed is done with: opened again, its conversation is at the newest message, as
  // Messages opens one, and not part-way up where it happened to be left. (One that was only minimised,
  // or an app left for another on the phone, comes back where the reader was: see the observer below.)
  // A conversation that arrived whole, to be read from its top, is left as its reader left it
  useEffect(() => {
    if (!shut || fromTop) return
    pinned.current = true
    setAway(false)
    setSeen(latest.current)
  }, [shut]) // eslint-disable-line react-hooks/exhaustive-deps

  // Two things the kit's bubbles leave unsaid, said here as they are drawn.
  // A reply being written is three dots with a label and no role, which
  // assistive tech passes over: they are a picture, of this. And a bubble's
  // words are laid out left to right whatever they are: each finds its own
  // direction, so a message in Arabic or Hebrew reads from its right
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    el.querySelectorAll<HTMLElement>('.ss-bubble__dots:not([role])').forEach((dots) => {
      const person = PEOPLE[Number(dots.closest<HTMLElement>('[data-person]')?.dataset.person)]
      dots.setAttribute('role', 'img')
      dots.setAttribute('aria-label', person ? `${person.name} is typing` : 'Typing')
    })
    // The dots grow into the words in the same element: what was said of the dots is taken back
    el.querySelectorAll<HTMLElement>('.ss-bubble__text[role]').forEach((text) => text.removeAttribute('role'))
    el.querySelectorAll<HTMLElement>('.ss-bubble__text:not([dir])').forEach((text) => text.setAttribute('dir', 'auto'))
    el.querySelectorAll<HTMLElement>('.ss-bubble__dots[dir]').forEach((dots) => dots.removeAttribute('dir'))
  })

  // A bubble growing out of its typing dots, or the window being resized,
  // changes the height without a new message: stay on the end through that too
  useEffect(() => {
    const el = scroller.current
    const inner = flow.current
    if (!el || !inner) return
    let shown = el.clientHeight > 0
    const ro = new ResizeObserver(() => {
      const now = el.clientHeight > 0
      if (now !== shown) {
        shown = now
        setDrawn(now)
        // Back on screen: at its end if it was following the newest, and otherwise where the reader had left it
        if (now) {
          stop()
          if (pinned.current) el.scrollTop = el.scrollHeight
          else el.scrollTop = place.current
        }
        return
      }
      if (!now) return
      if (pinned.current) follow()
      // Still at the top it began at: whether there is further to go may only now be known
      else if (fromTop && el.scrollTop < 1) setAway(el.scrollHeight - el.clientHeight > 56)
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
    // Where that puts the thread. It is asked again all the way there: when every reply has just come in at
    // once (someone found before they had replied), the reply that was being written is still growing into
    // its words, and carries everything under it down as it does
    const spot = () => {
      if (!bubble.isConnected) return el.scrollTop
      const box = el.getBoundingClientRect()
      const at = bubble.getBoundingClientRect()
      // What is measured on the page is as it is drawn: inside a scaled frame (the phone's), a distance on the page is that much less of the thread
      const k = box.width / el.offsetWidth || 1
      // A long reply is shown from its top; a short one sits in the middle
      return el.scrollTop + (at.top - box.top) / k - Math.max(28, (el.clientHeight - at.height / k) / 2)
    }
    // The thread lets go of its end to stay here
    pinned.current = false
    setAway(el.scrollHeight - el.clientHeight - spot() > 56)
    glide(spot)
    bubble.removeAttribute('data-flash')
    void bubble.offsetWidth
    bubble.setAttribute('data-flash', '')
    clearTimeout(flash.current)
    flash.current = setTimeout(() => bubble.removeAttribute('data-flash'), 1700)
  }, [jump, active]) // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = scroller.current
    if (!el || !el.clientHeight) return
    place.current = el.scrollTop
    if (run.current) return
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 56
    // Only the reader lets go of the end. A browser can move the scroll
    // itself, by a few pixels, as a bubble changes size (Safari's does), and
    // say so before the thread has started to follow: that is nobody's hand
    if (!atEnd && !fingered.current && performance.now() - touched.current > HAND_MS) return
    pinned.current = atEnd
    setAway(!atEnd)
    if (atEnd) setSeen(latest.current)
  }

  const unseen = away ? Math.max(0, count - seen) : 0

  // Every reply at once. They land under where the reader is, who goes on reading down from there: the
  // thread lets go of its end, and the way to the newest is offered
  const all = () => {
    stop()
    pinned.current = false
    setAway(true)
    onAll?.()
    scroller.current?.focus({ preventScroll: true })
  }
  /** The offer of every reply is up: there are some to come, and they are coming. */
  const offered = rest > 0 && !paused
  // Set going again from the head of the thread. The button goes as it is pressed, and the keyboard with it to the thread
  const resume = () => {
    onResume?.()
    scroller.current?.focus({ preventScroll: true })
  }

  return (
    // Paused, whoever was writing stops where they were: their dots are held still (styles/apps.css)
    <div className="chat__pane" data-paused={paused || undefined}>
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
          fingered.current = true
          hand()
        }}
        onTouchMove={() => (touched.current = performance.now())}
        onTouchEnd={() => {
          fingered.current = false
          touched.current = performance.now()
        }}
        onTouchCancel={() => (fingered.current = false)}
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
      {/* While replies are still coming: all of them at once, for whoever would sooner not wait */}
      {onAll && (
        <button type="button" className="chat__all" data-show={offered || undefined} tabIndex={offered ? 0 : -1} aria-hidden={!offered} onClick={all}>
          <ChevronsDown size={13} strokeWidth={2.4} aria-hidden />
          Load all {TOTAL} replies
        </button>
      )}
      {/* Paused, the conversation says so in that same place, with the way to set it going again: a thread
          that has stopped is otherwise only a thread that looks stuck */}
      {onResume && (
        <button type="button" className="chat__all chat__all--paused" data-show={paused || undefined} tabIndex={paused ? 0 : -1} aria-hidden={!paused} aria-label="Replies paused. Resume" onClick={resume}>
          <Pause size={11} strokeWidth={0} fill="currentColor" aria-hidden />
          <span className="chat__all-state">Replies paused</span>
          <span className="chat__all-dot">·</span>
          Resume
        </button>
      )}
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
          // The button goes as it is pressed: the keyboard goes to the thread it brought to its end
          scroller.current?.focus({ preventScroll: true })
        }}
      >
        <ArrowDown size={13} strokeWidth={2.4} aria-hidden />
        {unseen > 0 ? `${unseen} new` : 'Latest'}
      </button>
      {/* There from the start, so that what is put in it later is heard */}
      <div className="sr-only" role="status">
        {status}
      </div>
    </div>
  )
}

/** What assistive tech is told as a conversation goes on. The thread is a
 * silent log: every reply read out as it lands would be worse than none.
 * Instead: the first reply, then every tenth, then that everyone has; and that
 * a message of the visitor's own has gone. Only what happens while the
 * conversation is on screen: what was there when it arrived is there to read. */
function useAnnounced(group: boolean, replied: number, mine: number) {
  const [told, setTold] = useState('')
  const before = useRef({ replied, mine })
  useEffect(() => {
    const was = before.current
    before.current = { replied, mine }
    // The same words twice running would not be heard the second time: the second differs by a space nobody sees
    const tell = (words: string) => setTold((last) => (last === words ? `${words}\u00a0` : words))
    if (mine > was.mine) return tell('Delivered.')
    if (!group || replied <= was.replied) return
    if (replied === TOTAL) tell(`All ${TOTAL} have replied.`)
    else if (was.replied === 0) tell(replied === 1 ? `${PEOPLE[0]!.name} replied.` : `${replied} of ${TOTAL} have replied.`)
    else if (Math.floor(replied / 10) > Math.floor(was.replied / 10)) tell(`${Math.floor(replied / 10) * 10} of ${TOTAL} have replied.`)
  }, [group, replied, mine])
  return told
}

/** A conversation's messages: the group as it plays out, or one of the others. */
export function Transcript({ conversation, source, active = true, shut = false }: { conversation: Conversation; source: string; active?: boolean; shut?: boolean }) {
  const egg = conversation === 'group' ? null : eggOf(conversation)
  const items = useStore(chat, (s) => s.items)
  const asked = useStore(chat, (s) => s.asked)
  const startedAt = useStore(chat, (s) => s.startedAt)
  const replied = useStore(chat, (s) => s.replied)
  const whole = useStore(chat, (s) => s.whole)
  const direct = useStore(chat, (s) => (egg ? (s.direct[egg.id] ?? NO_MESSAGES) : NO_MESSAGES))
  const paused = useStore(chat, (s) => !egg && s.paused)
  const jump = useStore(inbox, (s) => (egg ? null : s.jump))
  const nodes = useMemo(() => (egg ? eggNodes(egg, eggAt(egg, startedAt), direct, source) : groupNodes(items, asked, startedAt, source)), [egg, items, asked, startedAt, direct, source])
  /** How many of the visitor's own messages are in it. */
  const mine = useMemo(() => (egg ? direct.length : items.reduce((n, item) => n + (item.kind === 'me' && item.by === 'visitor' ? 1 : 0), 0)), [egg, items, direct])
  const status = useAnnounced(!egg, replied, mine)
  // Until the question has been asked there is nothing to hurry along
  const rest = egg || !asked ? 0 : TOTAL - replied
  // Asked to show the reply of someone who has not replied yet (they were found by a search, which finds
  // everyone in the group): everyone replies at once, and then theirs is there to go to. It is done here,
  // where the conversation is drawn, so that it holds whichever list they were picked from
  const early = jump !== null && jump >= replied
  useEffect(() => {
    if (early && active) finishChat()
  }, [early, active])
  return (
    <Scroller
      label={conversationName(conversation)}
      nodes={nodes}
      jump={early ? null : jump}
      onJumped={clearJump}
      active={active}
      mine={mine}
      fromTop={!egg && whole}
      rest={rest}
      onAll={egg ? undefined : finishChat}
      paused={paused}
      onResume={egg ? undefined : resumeChat}
      shut={shut}
      status={status}
    />
  )
}

// ---- The message field ----

/** A press on a button that sends or clears never takes the caret out of the
 * field it works on: on a touch screen the keyboard would go down with it. */
export const keepsCaret = {
  onPointerDown: (e: { preventDefault(): void }) => e.preventDefault(),
  onMouseDown: (e: { preventDefault(): void }) => e.preventDefault(),
}

/** The field at the foot of a conversation. The script types Shrug's own
 * messages into it; anything the visitor types is theirs to send. What they
 * have typed and not sent is kept with the conversation (src/apps/chat.ts),
 * not in the field. */
export function Composer({ conversation, target }: { conversation: Conversation; target: string }) {
  const text = useStore(unsent, (s) => s[conversation] ?? '')
  const waiting = useStore(attached, (s) => attachedTo(s, conversation))
  const draft = useStore(chat, (s) => (conversation === 'group' ? s.draft : null))
  const input = useRef<HTMLInputElement>(null)
  const files = useRef<HTMLInputElement>(null)
  const ready = text.trim().length > 0 || waiting.length > 0
  const ghost = draft !== null && !text && !waiting.length
  const full = waiting.length >= MOST_FILES

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    sendMessage(text, conversation)
    setUnsent(conversation, '')
    // The send button goes as the field empties: the caret stays in the field, for the next message
    input.current?.focus({ preventScroll: true })
  }

  return (
    <form className="composer" onSubmit={submit}>
      {/* The plus is the browser's own file picker, as it is on the phone: what is picked waits in the field,
          and goes into the conversation with the words. It is shown from where it is on the visitor's own
          computer: nothing is sent anywhere (chat.ts) */}
      <input
        ref={files}
        className="composer__picker"
        type="file"
        multiple
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          attach(conversation, [...(e.target.files ?? [])])
          e.target.value = ''
          input.current?.focus({ preventScroll: true })
        }}
      />
      <button type="button" className="composer__plus" aria-label="Add files" aria-disabled={full || undefined} onClick={() => !full && files.current?.click()}>
        <Plus size={18} strokeWidth={2.2} aria-hidden />
      </button>
      <div className="composer__field" data-ghost={ghost || undefined}>
        {waiting.length > 0 && (
          <ul className="composer__files" aria-label="Attached">
            {waiting.map((a) => (
              <li key={a.id} className="composer__file" data-picture={a.url ? '' : undefined}>
                {a.url ? (
                  <img src={a.url} alt={a.file.name} draggable={false} />
                ) : (
                  <>
                    <FileText size={18} strokeWidth={1.8} aria-hidden />
                    <span className="composer__file-words">
                      <b dir="auto">{a.file.name}</b>
                      <span>{sizeOf(a.file.size)}</span>
                    </span>
                  </>
                )}
                <button type="button" className="composer__file-drop" aria-label={`Remove ${a.file.name}`} onClick={() => detach(conversation, a.id)} {...keepsCaret}>
                  <X size={10} strokeWidth={3.2} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <span className="composer__row">
          {/* Where the words start: a sent bubble forms out of this spot */}
          <span className="composer__origin" data-target={target} aria-hidden />
          {ghost && (
            <span className="composer__ghost" aria-hidden>
              {draft}
              <i className="composer__caret" />
            </span>
          )}
          <input ref={input} className="composer__input" type="text" dir="auto" placeholder={ghost ? '' : waiting.length ? 'Add comment or Send' : 'iMessage'} aria-label="iMessage" autoComplete="off" enterKeyHint="send" value={text} onChange={(e) => setUnsent(conversation, e.target.value)} />
          <button type="submit" className="composer__send" aria-label="Send" data-ready={ready || undefined} aria-disabled={!ready} tabIndex={ready ? 0 : -1} {...keepsCaret}>
            <ArrowUp size={15} strokeWidth={2.8} aria-hidden />
          </button>
        </span>
      </div>
    </form>
  )
}

// ---- The list of conversations ----

export interface ListRow {
  /** Which row it is: a conversation's id, or `p:<index>` for someone found in the group. */
  key: string
  /** The conversation it opens. */
  conversation: Conversation
  /** For someone found in the group: whose reply to go to there. */
  person?: number
  /** That someone has not replied yet: there is no reply of theirs to go to until everyone's are brought in. */
  yet?: boolean
  name: string
  preview: ReactNode
  /** When it last heard something, as the row says it. */
  when: string
  unread: boolean
}

/** The newest thing said in the group: its row's preview. */
const lastSaid = (s: Chat) => {
  for (let i = s.items.length - 1; i >= 0; i--) {
    const item = s.items[i]!
    if (item.kind === 'me') return item.text
    if (!item.typing) return PEOPLE[item.index]!.quote ?? ''
  }
  return ''
}

/** Everyone in the group, as a search reads them. */
const SOUGHT = PEOPLE.map((person) => ({ name: folded(person.name), role: folded(person.role), quote: folded(person.quote ?? '') }))

/** Where what someone said would be, for someone found who has not said it yet. One element, made once:
 * a row is drawn again only when what it shows has changed. */
const NOT_YET = <span className="conv-yet">Hasn’t replied yet</span>

/** The rows of the list of conversations: the group, then the others, the
 * one last heard from, or written to, first. While something is being looked
 * for (`inbox.query`), the conversations it is in, and then the people in the
 * group it finds. A person's reply is in the group and nowhere else, so that
 * is where their row goes. Everyone in the group can be found by who they are
 * (their name, their role), whether or not they have replied: the details list
 * all of them, and a search that found only some would be saying the rest are
 * not here. By what they said, only those who have said it: someone still to
 * reply is listed as that, and nothing of their words is given away early. */
export function useConversationRows(): ListRow[] {
  const replied = useStore(chat, (s) => s.replied)
  const repliedAt = useStore(chat, (s) => s.repliedAt)
  const startedAt = useStore(chat, (s) => s.startedAt)
  const last = useStore(chat, lastSaid)
  const direct = useStore(chat, (s) => s.direct)
  const groupSeen = useStore(inbox, (s) => s.groupSeen)
  const q = folded(useStore(inbox, (s) => s.query).trim())

  return useMemo(() => {
    const has = (text: string) => folded(text).includes(q)
    const out: ListRow[] = []
    // New in the group: replies that have come in since it was last on screen
    if (!q || has(GROUP_NAME)) out.push({ key: 'group', conversation: 'group', name: GROUP_NAME, preview: last || ' ', when: clock(replied ? repliedAt[replied - 1]! : startedAt), unread: replied > groupSeen })
    // The others are old conversations, read long ago, until the visitor writes in one: then its row says
    // what they wrote and when, and it is the one last used, at the head of the others
    const others = EGGS_BY_AGE.map((egg) => {
      const written = direct[egg.id] ?? NO_MESSAGES
      const mine = written[written.length - 1]
      return { egg, written, said: mine ? mine.text : lastWords(egg), at: mine ? mine.at || startedAt : eggAt(egg, startedAt) }
    }).sort((a, b) => b.at - a.at)
    for (const { egg, written, said, at } of others) {
      if (q && !has(egg.name) && !egg.messages.some((m) => has('link' in m ? m.link.label : m.text)) && !written.some((m) => has(m.text))) continue
      out.push({ key: egg.id, conversation: egg.id, name: egg.name, preview: said, when: rowTime(at), unread: false })
    }
    if (q)
      PEOPLE.forEach((person, i) => {
        const sought = SOUGHT[i]!
        const known = sought.name.includes(q) || sought.role.includes(q)
        const yet = i >= replied
        if (!known && (yet || !sought.quote.includes(q))) return
        // What they said, where that is what was found; otherwise who they are. Someone still to reply: that they are
        out.push({ key: `p:${i}`, conversation: 'group', person: i, yet, name: person.name, preview: yet ? NOT_YET : known ? person.role : person.quote, when: '', unread: false })
      })
    return out
  }, [q, last, replied, repliedAt, startedAt, groupSeen, direct])
}

const ConversationRow = memo(function ConversationRow({ id, row, selected, avatar, onPick }: { id: string; row: ListRow; selected: boolean; avatar: number; onPick: (row: ListRow) => void }) {
  return (
    <Row
      id={id}
      className="conv"
      pad={8}
      role="option"
      aria-selected={selected}
      data-row={row.key}
      data-conversation={row.person === undefined ? row.conversation : undefined}
      data-yet={row.yet || undefined}
      unread={row.unread}
      selected={selected}
      lead={row.person === undefined ? <ConversationAvatar conversation={row.conversation} size={avatar} /> : <PersonAvatar index={row.person} size={avatar} />}
      // The row is read out as it is written: who, then (the dot, in words) whether there is something new
      title={
        <>
          {row.name}
          {row.unread && <span className="sr-only">, unread</span>}
        </>
      }
      meta={row.when}
      preview={row.preview}
      onClick={() => onPick(row)}
    />
  )
})

/** What the search field asks of the list beside it. */
export interface ListControl {
  /** Opens the first thing found. */
  first(): void
  /** Takes the keyboard into the list, on the conversation that is open or else on the first. */
  into(): void
}

/** The conversations, down the desktop's sidebar: the group, then the others.
 * Searching also finds the people in the group; picking one goes to their
 * reply there. The list takes the keyboard as a whole and says which row is
 * the active one (`aria-activedescendant`), so the arrows are read out. */
export function ConversationList({ onPick, selectable = true, avatar = 40, control }: { onPick?: (c: Conversation, by: 'press' | 'arrows') => void; selectable?: boolean; avatar?: number; control?: MutableRefObject<ListControl | null> }) {
  const rows = useConversationRows()
  const open = useStore(inbox, (s) => s.open)
  const query = useStore(inbox, (s) => s.query)
  const list = useRef<HTMLDivElement>(null)
  const base = useId()
  const idOf = (row: ListRow) => `${base}${row.key.replace(/[^a-z0-9]/gi, '-')}`
  /** The person whose row was picked last, while it is their reply the group is showing. */
  const [found, setFound] = useState<number | null>(null)
  useEffect(() => setFound(null), [query])
  useEffect(() => {
    if (open !== 'group') setFound(null)
  }, [open])

  /** `by` is how it was picked: pressed (a click, Return), or passed over on the way through the list with the arrow keys. */
  const pick = (row: ListRow, by: 'press' | 'arrows' = 'press') => {
    if (row.person === undefined) openConversation(row.conversation)
    else if (!row.yet) showInGroup(row.person)
    // Someone who has not replied yet. Pressed, every reply is brought in, and theirs is gone to; only
    // passed over with the arrows, they are picked out in the list and the conversation is left to play
    else if (by === 'press') {
      finishChat()
      showInGroup(row.person)
    } else openConversation('group')
    setFound(row.person ?? null)
    onPick?.(row.conversation, by)
  }
  const isSelected = (row: ListRow) => (found !== null ? row.person === found : row.person === undefined && row.conversation === open)

  // What the search field can ask for: kept up to date with what is listed
  useEffect(() => {
    if (!control) return
    control.current = {
      first: () => {
        if (rows[0]) pick(rows[0])
      },
      into: () => {
        list.current?.focus()
        if (!rows.some(isSelected) && rows[0]) pick(rows[0], 'arrows')
      },
    }
    return () => {
      control.current = null
    }
  })

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return
    e.preventDefault()
    const at = rows.findIndex(isSelected)
    if (e.key === 'Enter') return void (rows[at] && pick(rows[at]!))
    const next = rows[Math.max(0, Math.min(rows.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))]
    if (!next) return
    pick(next, 'arrows')
    // Keeps the row that was picked in view, moving only the list
    const box = e.currentTarget as HTMLElement
    const row = box.querySelector<HTMLElement>(`[data-row="${next.key}"]`)
    if (!row) return
    const frame = box.getBoundingClientRect()
    const r = row.getBoundingClientRect()
    const k = frame.width / box.offsetWidth || 1
    if (r.top < frame.top) box.scrollTop -= (frame.top - r.top) / k + 8
    else if (r.bottom > frame.bottom) box.scrollTop += (r.bottom - frame.bottom) / k + 8
  }

  const talks = rows.filter((row) => row.person === undefined)
  const people = rows.filter((row) => row.person !== undefined)
  const draw = (row: ListRow) => <ConversationRow key={row.key} id={idOf(row)} row={row} selected={selectable && isSelected(row)} avatar={avatar} onPick={pick} />
  const active = selectable ? rows.find(isSelected) : undefined

  return (
    <>
      <div ref={list} className="conv-list scrolls" role="listbox" aria-label="Conversations" aria-activedescendant={active ? idOf(active) : undefined} tabIndex={0} onKeyDown={onKey} data-empty={rows.length === 0 || undefined}>
        {talks.map(draw)}
        {people.length > 0 && (
          <div className="conv-found" role="group" aria-label={`In ${GROUP_NAME}`}>
            <div className="conv-found__label" aria-hidden>
              In {GROUP_NAME}
            </div>
            {people.map(draw)}
          </div>
        )}
      </div>
      {/* Not in the list, which holds conversations and nothing else; and there before there is anything to say, so that it is heard when there is */}
      <div className="conv-none" role="status">
        {rows.length === 0 ? 'No Results' : ''}
      </div>
    </>
  )
}

/** The sidebar's search. Return opens the first thing it finds; the down arrow goes into the list. */
export function ConversationSearch({ control }: { control?: MutableRefObject<ListControl | null> }) {
  const query = useStore(inbox, (s) => s.query)
  return <SearchField value={query} onChange={setInboxQuery} label="Search conversations" onEnter={() => query.trim() && control?.current?.first()} onArrowDown={() => control?.current?.into()} />
}

/** One conversation and the field under it. Sent bubbles form out of this pane's own field. */
export function ConversationPane({ conversation, active = true, shut = false }: { conversation: Conversation; active?: boolean; shut?: boolean }) {
  const target = `composer-${useId().replace(/:/g, '')}`
  return (
    <>
      <Transcript conversation={conversation} source={target} active={active} shut={shut} />
      <Composer conversation={conversation} target={target} />
    </>
  )
}

// ---- Details ----

/** Someone in the group: who they are, and how they know Shrug. */
export function PersonCard({ index, size = 64 }: { index: number; size?: number }) {
  const person = PEOPLE[index]!
  return (
    <div className="details__head">
      <PersonAvatar index={index} size={size} />
      <div className="details__name">{person.name}</div>
      <div className="details__sub">{person.role}</div>
      {person.relations.length > 0 && (
        <div className="details__tags">
          {relationsOf(index).map((label) => (
            <Badge key={label}>{label}</Badge>
          ))}
        </div>
      )}
    </div>
  )
}

/** The company in the portfolio that is theirs, where their role names one (src/data/founders.ts): a
 * press away, in the Portfolio window. Nothing for the many whose company is not in it. */
function TheirCompany({ person }: { person: number }) {
  const key = COMPANY_OF[person]
  const company = key ? COMPANIES.find((one) => one.key === key) : null
  if (!company) return null
  return (
    <div className="details__group">
      <button type="button" className="details__row details__row--action" onClick={() => showCompany(company.key)}>
        Show {company.name} in Portfolio
      </button>
    </div>
  )
}

/** A link to what one person said, to pass on (`?open=chat&at=tony-hawk`): it opens the conversation at
 * their reply. Copied, the row says so for a moment. */
function CopyReplyLink({ person }: { person: number }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(t)
  }, [copied])
  const copy = () => {
    const link = linkTo({ app: 'messages', at: atPerson(person) })
    // (Not allowed to write to the clipboard: the row says nothing it did not do)
    navigator.clipboard?.writeText(link).then(
      () => setCopied(true),
      () => {},
    )
  }
  return (
    <button type="button" className="details__row details__row--action" onClick={copy}>
      <span>{copied ? 'Link Copied' : 'Copy Link to Reply'}</span>
      <span className="sr-only" role="status">
        {copied ? 'Link copied' : ''}
      </span>
    </button>
  )
}

/** What the info button opens on the group: the controls for the replies as
 * they play out, and everyone in it. A person there opens their card, with the
 * way to their reply in the conversation. `shown` is whether it is open: closed,
 * it goes back to the group for the next time. */
export function Details({ shown = true, onDone }: { shown?: boolean; onDone?: () => void }) {
  const replied = useStore(chat, (s) => s.replied)
  const paused = useStore(chat, (s) => s.paused)
  const done = useStore(chat, (s) => s.done)
  const [person, setPerson] = useState<number | null>(null)
  const root = useRef<HTMLDivElement>(null)
  /** How far down the list of people was, and whose row was pressed, to come back to. */
  const place = useRef({ top: 0, row: -1 })
  /** The one row of them all that Tab stops on: the arrows walk the rest. */
  const [stop, setStop] = useState(0)

  useEffect(() => {
    if (!shown) setPerson(null)
  }, [shown])

  // Opened: the keyboard goes in, to the first of its controls
  useEffect(() => {
    if (!shown) return
    const frame = requestAnimationFrame(() => focusFirst(firstControl(root.current)))
    return () => cancelAnimationFrame(frame)
  }, [shown])

  /** Up and down the list of people, Home and End to its ends: the rows are one Tab stop, not one each. */
  const onPeopleKey = (e: KeyboardEvent) => {
    const rows = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-person-row]') ?? [])
    const at = rows.indexOf(document.activeElement as HTMLElement)
    const to = e.key === 'ArrowDown' ? at + 1 : e.key === 'ArrowUp' ? at - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : -1
    if (at < 0 || to < 0 || to >= rows.length) return
    e.preventDefault()
    rows[to]!.focus()
  }

  // The card starts at its top; the list comes back where it was left, and the keyboard goes with each
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    el.scrollTop = person === null ? place.current.top : 0
    if (!shown || (document.activeElement !== document.body && !el.contains(document.activeElement))) return
    const next = person === null ? el.querySelector<HTMLElement>(`[data-person-row="${place.current.row}"]`) : el.querySelector<HTMLElement>('.details__back')
    next?.focus({ preventScroll: true })
  }, [person]) // eslint-disable-line react-hooks/exhaustive-deps

  if (person !== null)
    return (
      <div ref={root} className="details">
        <button type="button" className="details__back" onClick={() => setPerson(null)}>
          <ChevronLeft size={15} strokeWidth={2.2} aria-hidden />
          {GROUP_NAME}
        </button>
        <PersonCard index={person} />
        {person < replied ? (
          <div className="details__group">
            <button
              type="button"
              className="details__row details__row--action"
              onClick={() => {
                showInGroup(person)
                onDone?.()
              }}
            >
              Show in {GROUP_NAME}
            </button>
            <CopyReplyLink person={person} />
          </div>
        ) : (
          <p className="details__note">Hasn’t replied yet.</p>
        )}
        <TheirCompany person={person} />
      </div>
    )

  return (
    <div ref={root} className="details">
      <div className="details__head">
        <GroupAvatar size={64} />
        <div className="details__name">{GROUP_NAME}</div>
        <div className="details__sub">{TOTAL} People</div>
      </div>
      <div className="details__group">
        <button type="button" className="details__row" role="switch" aria-checked={paused} aria-disabled={done || undefined} onClick={done ? undefined : toggleChat}>
          <span>Pause Replies</span>
          <Toggle on={paused} aria-hidden />
        </button>
        {/* Either changes the thread the details are open over: they close, so that what was asked for is seen */}
        <button
          type="button"
          className="details__row details__row--action"
          aria-disabled={done || undefined}
          onClick={
            done
              ? undefined
              : () => {
                  finishChat()
                  onDone?.()
                }
          }
        >
          Show Every Reply
        </button>
        <button
          type="button"
          className="details__row details__row--action"
          onClick={() => {
            replayChat()
            onDone?.()
          }}
        >
          Play From the Start
        </button>
      </div>
      <div className="details__label" id="details-people">
        {TOTAL} People
      </div>
      <div className="details__group details__people" role="group" aria-labelledby="details-people" onKeyDown={onPeopleKey}>
        {PEOPLE.map((person, i) => (
          <button
            key={i}
            type="button"
            className="details__row details__person"
            data-person-row={i}
            tabIndex={i === stop ? 0 : -1}
            onFocus={() => setStop(i)}
            onClick={() => {
              place.current = { top: root.current?.scrollTop ?? 0, row: i }
              setPerson(i)
            }}
          >
            <PersonAvatar index={i} size={30} />
            <span className="details__who">
              <span className="details__who-name">{person.name}</span>
              <span className="details__who-role">{person.role}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
