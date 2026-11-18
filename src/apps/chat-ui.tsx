import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type MouseEvent, type MutableRefObject, type ReactElement, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, Plus, UserRound } from 'lucide-react'
import { EGGS, eggOf, lastWords, type Egg, type EggLink } from '../data/eggs'
import { PEOPLE, RELATION_LABEL } from '../data/people'
import { reach, SITE } from '../data/site'
import { Badge } from '../kit/controls/Badge'
import { Toggle } from '../kit/controls/Toggle'
import { Bubble, Receipt, Stamp, Thread } from '../kit/messages'
import { Popover } from '../kit/motion/Popover'
import { Avatar } from '../kit/parts/Avatar'
import { Row } from '../kit/parts/Row'
import { APPS, DOCK_APPS } from '../os/apps'
import { prefersReducedMotion } from '../os/dom'
import { firstControl, focusFirst, useReturnFocus } from '../os/focus'
import { AppIcon, DocumentIcon } from '../os/icons'
import { launchApp } from '../os/launch'
import { useStore } from '../os/store'
import { chat, deleteMessage, finishChat, replayChat, sendMessage, sentMessage, setUnsent, toggleChat, TOTAL, unsent, type Chat, type ChatItem } from './chat'
import { clearJump, inbox, openConversation, setInboxQuery, showInGroup, type Conversation } from './state'
import { SearchField, ShrugAvatar } from './ui'
import { formatter } from '../os/dates'

// The parts of the group chat that the Mac window and the phone screen share:
// the conversation itself, the message field, the list of conversations and
// the details panel. The kit draws the bubbles, typing dots, stamps and
// receipts; everything here is laid out the way Messages lays it out, and the
// two screens differ only in their chrome and their sizes.

export const GROUP_NAME = 'Shrug Family'

const TIME = formatter({ hour: 'numeric', minute: '2-digit' })
/** A time as Messages writes it beside a conversation. */
export const clock = (t: number) => TIME.format(t || Date.now())

export const relationsOf = (index: number) => PEOPLE[index]!.relations.map((r) => RELATION_LABEL[r])

// ---- Faces ----

/** A contact with no photo: the gray monogram Messages gives them. It is a
 * picture of the name beside it, so its initials are never read out before the name. */
export function PersonAvatar({ index, size = 28 }: { index: number; size?: number }) {
  return <Avatar name={PEOPLE[index]!.name.replace(' & ', ' ')} tone="ios" size={size} aria-hidden />
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

/** When one of the other conversations last heard something: so long before this visit began, so it stays put while the visit lasts. */
export const eggAt = (egg: Egg, startedAt: number) => startedAt - egg.ago * 60_000

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

/** What a message that didn't go says when it is asked why. Nothing typed here leaves the page: the truth, and the way on. */
export const NOT_DELIVERED = {
  title: 'Not Delivered',
  message: 'This conversation is a recording of what people said about Shrug. Messages here don’t send.',
}

/** Under a message of the visitor's: the line Messages puts there, and (with
 * the red mark beside the bubble, which answers to the same press) the button
 * that says why and what to do instead. */
const undelivered = (key: string) => (
  <button key={`${key}-failed`} type="button" className="chat-undelivered" data-failed={key} aria-haspopup="dialog">
    Not Delivered
  </button>
)

/** Whose bubble it is, for assistive tech: without it a conversation is loose
 * lines, with nothing to tie a name to what was said or to tell Shrug's from
 * anyone else's. */
const said = (who: string) => ({ role: 'group', 'aria-label': who }) as object
const SHRUGS = said(SITE.name)
const YOURS = said('You')

const delivered = (
  <Receipt key="receipt" show>
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
  let lastSent = ''
  for (const item of items) if (item.kind === 'link' || (item.kind === 'me' && item.by === 'shrug')) lastSent = item.key
  for (const item of items) {
    if (item.kind === 'link') {
      // Where to go from here, once everyone has replied: Shrug's own bubble, and a link
      nodes.push(
        <Bubble key={item.key} from="me" {...SHRUGS}>
          <Linked link={item.link} />
        </Bubble>,
      )
      if (item.key === lastSent) nodes.push(delivered)
    } else if (item.kind === 'me') {
      const failed = item.by === 'visitor'
      nodes.push(
        <Bubble key={item.key} from="me" source={source} className={failed ? 'chat-failed' : undefined} {...(failed ? YOURS : SHRUGS)}>
          {item.text}
        </Bubble>,
      )
      if (failed) nodes.push(undelivered(item.key))
      // Under the last message that went: where Messages keeps "Delivered"
      else if (asked && item.key === lastSent) nodes.push(delivered)
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
function eggNodes(egg: Egg, at: number, direct: { key: string; text: string }[], source: string) {
  const nodes: ReactElement[] = [stamp(at)]
  const theirs = said(egg.name)
  egg.messages.forEach((message, n) =>
    nodes.push(
      <Bubble key={`said-${n}`} from={message.from} {...(message.from === 'me' ? SHRUGS : theirs)}>
        {'link' in message ? <Linked link={message.link} /> : message.text}
      </Bubble>,
    ),
  )
  // Under the last message, if it is Shrug's: where Messages keeps "Delivered"
  if (egg.messages[egg.messages.length - 1]?.from === 'me') nodes.push(delivered)
  for (const message of direct) {
    nodes.push(
      <Bubble key={message.key} from="me" source={source} className="chat-failed" {...YOURS}>
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
  /** A message that didn't go was pressed (its line, or the red mark beside it): its key, and the line's button. */
  onFailed?: (key: string, button: HTMLElement) => void
  /** What assistive tech is told as the conversation goes on. The thread itself is never read out as it grows. */
  status?: string
}

/** A conversation's messages: they scroll, and the view stays on the newest
 * one the way a chat does, until the reader scrolls back to read. The desktop's
 * conversations and the phone's are both drawn through this. */
export function Scroller({ label, nodes, jump, onJumped, active = true, foot, onTap, mine = 0, fromTop = false, onFailed, status = '' }: ScrollerProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const flow = useRef<HTMLDivElement>(null)
  /** Following the newest message, until the reader scrolls back. */
  const pinned = useRef(!fromTop)
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
    const ro = new ResizeObserver(() => {
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

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    onTap?.(e)
    if (!onFailed) return
    const target = e.target as HTMLElement
    let button = target.closest<HTMLElement>('[data-failed]')
    // The red mark beside a bubble that didn't go is drawn by the bubble's row:
    // a press on that row past the bubble's edge is a press on the mark
    if (!button && target.classList.contains('chat-failed')) {
      const bubble = target.querySelector('.ss-bubble')
      const line = target.nextElementSibling
      if (bubble && e.clientX > bubble.getBoundingClientRect().right && line instanceof HTMLElement && line.matches('[data-failed]')) button = line
    }
    if (button?.dataset.failed) onFailed(button.dataset.failed, button)
  }

  return (
    <div className="chat__pane">
      {/* Any scroll the reader starts takes over from ours */}
      <div
        ref={scroller}
        className="chat__scroll"
        onClick={onClick}
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
 * silent log: ninety replies read out as they land would be worse than none.
 * Instead: the first reply, then every tenth, then that everyone has; and a
 * message of the visitor's own that did not go. Only what happens while the
 * conversation is on screen: what was there when it arrived is there to read. */
function useAnnounced(group: boolean, replied: number, mine: number) {
  const [told, setTold] = useState('')
  const before = useRef({ replied, mine })
  useEffect(() => {
    const was = before.current
    before.current = { replied, mine }
    // The same words twice running would not be heard the second time: the second differs by a space nobody sees
    const tell = (words: string) => setTold((last) => (last === words ? `${words}\u00a0` : words))
    if (mine > was.mine) return tell('Not Delivered. Your message was not sent.')
    if (!group || replied <= was.replied) return
    if (replied === TOTAL) tell(`All ${TOTAL} have replied.`)
    else if (was.replied === 0) tell(replied === 1 ? `${PEOPLE[0]!.name} replied.` : `${replied} of ${TOTAL} have replied.`)
    else if (Math.floor(replied / 10) > Math.floor(was.replied / 10)) tell(`${Math.floor(replied / 10) * 10} of ${TOTAL} have replied.`)
  }, [group, replied, mine])
  return told
}

/** A conversation's messages: the group as it plays out, or one of the others. */
export function Transcript({ conversation, source, active = true, onFailed }: { conversation: Conversation; source: string; active?: boolean; onFailed?: (key: string, button: HTMLElement) => void }) {
  const egg = conversation === 'group' ? null : eggOf(conversation)
  const items = useStore(chat, (s) => s.items)
  const asked = useStore(chat, (s) => s.asked)
  const startedAt = useStore(chat, (s) => s.startedAt)
  const replied = useStore(chat, (s) => s.replied)
  const whole = useStore(chat, (s) => s.whole)
  const direct = useStore(chat, (s) => (egg ? (s.direct[egg.id] ?? NO_MESSAGES) : NO_MESSAGES))
  const jump = useStore(inbox, (s) => (egg ? null : s.jump))
  const nodes = useMemo(() => (egg ? eggNodes(egg, eggAt(egg, startedAt), direct, source) : groupNodes(items, asked, startedAt, source)), [egg, items, asked, startedAt, direct, source])
  /** How many of the visitor's own messages are in it. */
  const mine = useMemo(() => (egg ? direct.length : items.reduce((n, item) => n + (item.kind === 'me' && item.by === 'visitor' ? 1 : 0), 0)), [egg, items, direct])
  const status = useAnnounced(!egg, replied, mine)
  return <Scroller label={conversationName(conversation)} nodes={nodes} jump={jump} onJumped={clearJump} active={active} mine={mine} fromTop={!egg && whole} onFailed={onFailed} status={status} />
}

// ---- The message field ----

/** A menu that opens from a button, worked from the keyboard the way the menu
 * bar's are: Enter, Space or the down arrow opens it on its first item (the up
 * arrow on its last); the arrows, Home and End move through it; Escape puts it
 * away and Tab leaves it. However it closes, the keyboard goes back to the
 * button if it would otherwise be left with nothing. The menu is the
 * `role="menu"` beside the button, its items the `role="menuitem"`s in it. */
export function useMenuKeys(open: boolean, setOpen: (open: boolean) => void) {
  const button = useRef<HTMLButtonElement>(null)
  /** Asked for from the keyboard: where the keyboard goes once the menu is open. */
  const want = useRef<'first' | 'last' | null>(null)
  const entries = () => Array.from(button.current?.parentElement?.querySelectorAll<HTMLElement>('[role="menu"] [role="menuitem"]') ?? [])
  const land = (which: 'first' | 'last') => {
    const all = entries()
    ;(which === 'first' ? all[0] : all[all.length - 1])?.focus()
  }

  useReturnFocus(open, () => button.current)

  useEffect(() => {
    const which = want.current
    want.current = null
    if (!open || !which) return
    // Once it is drawn, and no longer shut off
    const frame = requestAnimationFrame(() => land(which))
    return () => cancelAnimationFrame(frame)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const onButtonKey = (e: KeyboardEvent) => {
    const opens = e.key === 'ArrowDown' || e.key === 'ArrowUp' || ((e.key === 'Enter' || e.key === ' ') && !open)
    if (!opens) return
    e.preventDefault()
    const which = e.key === 'ArrowUp' ? 'last' : 'first'
    if (open) return land(which)
    want.current = which
    setOpen(true)
  }

  const onMenuKey = (e: KeyboardEvent) => {
    const all = entries()
    const at = all.indexOf(document.activeElement as HTMLElement)
    const go = (to: HTMLElement | undefined) => {
      e.preventDefault()
      to?.focus()
    }
    if (e.key === 'ArrowDown') go(all[(at + 1) % all.length])
    else if (e.key === 'ArrowUp') go(all[(at - 1 + all.length) % all.length])
    else if (e.key === 'Home') go(all[0])
    else if (e.key === 'End') go(all[all.length - 1])
    else if (e.key === 'Tab') setOpen(false)
    else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      button.current?.focus()
    }
  }

  return { button, onButtonKey, onMenuKey }
}

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
  const [more, setMore] = useState(false)
  const draft = useStore(chat, (s) => (conversation === 'group' ? s.draft : null))
  const root = useRef<HTMLFormElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const menu = useMenuKeys(more, setMore)
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
    setUnsent(conversation, '')
    // The send button goes as the field empties: the caret stays in the field, for the next message
    input.current?.focus({ preventScroll: true })
  }

  return (
    <form ref={root} className="composer" onSubmit={submit}>
      <button ref={menu.button} type="button" className="composer__plus" aria-label="More from Shrug" aria-haspopup="menu" aria-expanded={more} onClick={() => setMore((m) => !m)} onKeyDown={menu.onButtonKey}>
        <Plus size={18} strokeWidth={2.2} aria-hidden />
      </button>
      <Popover show={more} origin="bottom left" className="composer__more" role="menu" aria-label="More from Shrug" onKeyDown={menu.onMenuKey} {...(more ? null : ({ inert: '' } as object))}>
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
          <span className="sr-only">, opens in a new tab</span>
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
        <input ref={input} className="composer__input" type="text" dir="auto" placeholder={ghost ? '' : 'iMessage'} aria-label="iMessage" autoComplete="off" enterKeyHint="send" value={text} onChange={(e) => setUnsent(conversation, e.target.value)} />
        <button type="submit" className="composer__send" aria-label="Send" data-ready={ready || undefined} aria-disabled={!ready} tabIndex={ready ? 0 : -1} {...keepsCaret}>
          <ArrowUp size={15} strokeWidth={2.8} aria-hidden />
        </button>
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
    if (item.kind === 'link') return item.link.label
    if (item.kind === 'me') return item.text
    if (!item.typing) return PEOPLE[item.index]!.quote ?? ''
  }
  return ''
}

/** The rows of the list of conversations: Shrug Family, then the others, the
 * one heard from most lately first. While something is being looked for
 * (`inbox.query`), the conversations it is in, and then the people in Shrug
 * Family it finds, by name, by role or by what they said. A person's reply is
 * in the group and nowhere else, so that is where their row goes: once it is
 * there. Someone who has not replied yet has said nothing to find, and a row
 * for them would give their words away early and lead nowhere. */
export function useConversationRows(): ListRow[] {
  const replied = useStore(chat, (s) => s.replied)
  const repliedAt = useStore(chat, (s) => s.repliedAt)
  const startedAt = useStore(chat, (s) => s.startedAt)
  const last = useStore(chat, lastSaid)
  const groupSeen = useStore(inbox, (s) => s.groupSeen)
  const q = useStore(inbox, (s) => s.query).trim().toLowerCase()

  return useMemo(() => {
    const has = (text: string) => text.toLowerCase().includes(q)
    const out: ListRow[] = []
    // New in the group: replies that have come in since it was last on screen
    if (!q || has(GROUP_NAME)) out.push({ key: 'group', conversation: 'group', name: GROUP_NAME, preview: last || ' ', when: clock(replied ? repliedAt[replied - 1]! : startedAt), unread: replied > groupSeen })
    for (const egg of EGGS_BY_AGE) {
      if (q && !has(egg.name) && !egg.messages.some((m) => has('link' in m ? m.link.label : m.text))) continue
      // The others are old conversations, read long ago
      out.push({ key: egg.id, conversation: egg.id, name: egg.name, preview: lastWords(egg), when: rowTime(eggAt(egg, startedAt)), unread: false })
    }
    if (q)
      PEOPLE.slice(0, replied).forEach((person, i) => {
        const known = has(person.name) || has(person.role)
        if (!known && !has(person.quote ?? '')) return
        // What they said, where that is what was found; otherwise who they are
        out.push({ key: `p:${i}`, conversation: 'group', person: i, name: person.name, preview: known ? person.role : person.quote, when: '', unread: false })
      })
    return out
  }, [q, last, replied, repliedAt, startedAt, groupSeen])
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
    else showInGroup(row.person)
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

/** Where the popover for a message that didn't go sits: by the message, inside the conversation's box. */
interface FailedAt {
  key: string
  style: CSSProperties
  origin: 'top right' | 'bottom right'
}

/** One conversation and the field under it. Sent bubbles form out of this pane's own field.
 * A message of the visitor's that didn't go answers a press with why, and where to take it instead. */
export function ConversationPane({ conversation, active = true }: { conversation: Conversation; active?: boolean }) {
  const target = `composer-${useId().replace(/:/g, '')}`
  const [failed, setFailed] = useState<FailedAt | null>(null)
  /** What it last showed: its words stay while it fades. */
  const last = useRef<FailedAt | null>(null)
  if (failed) last.current = failed
  const shown = failed ?? last.current
  const pop = useRef<HTMLDivElement>(null)
  const close = () => setFailed(null)

  // The keyboard goes in when it opens, and back to the line that opened it (or to the field, if that line has gone)
  useReturnFocus(!!failed, () => pop.current?.closest('.chat__body')?.querySelector('.composer__input'))
  useEffect(() => {
    if (!failed) return
    const frame = requestAnimationFrame(() => focusFirst(firstControl(pop.current)))
    // It closes on a press anywhere else, on Escape, and when the conversation moves under it
    const away = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.chat-why, [data-failed]')) close()
    }
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const scroller = pop.current?.closest('.chat__body')?.querySelector('.chat__scroll')
    document.addEventListener('pointerdown', away, true)
    window.addEventListener('keydown', key)
    scroller?.addEventListener('scroll', close, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', away, true)
      window.removeEventListener('keydown', key)
      scroller?.removeEventListener('scroll', close)
    }
  }, [failed])

  const onFailed = (key: string, button: HTMLElement) => {
    if (failed?.key === key) return close()
    const body = button.closest<HTMLElement>('.chat__body')
    if (!body) return
    const box = body.getBoundingClientRect()
    const at = button.getBoundingClientRect()
    const k = box.width / body.offsetWidth || 1
    const right = Math.max(8, (box.right - at.right) / k - 6)
    // Under the line where there is room for it, so that the message it is about stays in view; over it otherwise
    const under = (box.bottom - at.bottom) / k > 230
    setFailed(under ? { key, origin: 'top right', style: { right, top: (at.bottom - box.top) / k + 6 } } : { key, origin: 'bottom right', style: { right, bottom: (box.bottom - at.top) / k + 6 } })
  }

  const words = shown ? (sentMessage(shown.key)?.text ?? '') : ''
  const way = reach(words)

  return (
    <>
      <Transcript conversation={conversation} source={target} active={active} onFailed={onFailed} />
      <Composer conversation={conversation} target={target} />
      <Popover show={!!failed} origin={shown?.origin ?? 'bottom right'} className="chat-why" role="dialog" aria-label={NOT_DELIVERED.title} style={shown?.style} {...(failed ? null : ({ inert: '' } as object))}>
        <div ref={pop} className="chat-why__in">
          <div className="chat-why__title">{NOT_DELIVERED.title}</div>
          <p className="chat-why__say">{NOT_DELIVERED.message}</p>
          <div className="chat-why__acts">
            {/* A real way to Shrug, when there is one: the visitor's words go with them */}
            {way.kind !== 'doc' && (
              <a className="chat-why__act" href={way.href} onClick={close}>
                {way.label}
              </a>
            )}
            <a className="chat-why__act" href={SITE.onePager} target="_blank" rel="noreferrer" onClick={close}>
              Read the One-pager
              <span className="sr-only">, opens in a new tab</span>
            </a>
            <button
              type="button"
              className="chat-why__act"
              data-destructive
              onClick={() => {
                if (shown) deleteMessage(shown.key)
                close()
              }}
            >
              Delete Message
            </button>
          </div>
        </div>
      </Popover>
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
  /** The one row of the ninety that Tab stops on: the arrows walk the rest. */
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

  /** Up and down the list of people, Home and End to its ends: ninety rows are one Tab stop, not ninety. */
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
          </div>
        ) : (
          <p className="details__note">Hasn’t replied yet.</p>
        )}
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
        <button type="button" className="details__row details__row--action" aria-disabled={done || undefined} onClick={done ? undefined : finishChat}>
          Show Every Reply
        </button>
        <button type="button" className="details__row details__row--action" onClick={replayChat}>
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
