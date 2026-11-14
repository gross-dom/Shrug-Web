import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactElement, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Pause, Play, RotateCcw } from 'lucide-react'
import { PEOPLE, RELATION_LABEL } from '../data/people'
import { Bubble, Receipt, Stamp, Thread } from '../kit/messages'
import { Count } from '../kit/motion/Count'
import { Avatar } from '../kit/parts/Avatar'
import { Check } from '../kit/parts/Check'
import { Row } from '../kit/parts/Row'
import { Window } from '../kit/window'
import { prefersReducedMotion } from '../os/dom'
import { useStore } from '../os/store'
import { chat, replayChat, sendMessage, toggleChat, TOTAL, type ChatItem } from './chat'
import { SearchField, ShrugAvatar, SideLabel, Tool } from './ui'

// The group chat: Shrug asks what it's like to work with them and ninety
// people answer. The kit draws the conversation (its thread, bubbles, typing
// dots and receipts); this lays it out as a messages window, lets it scroll,
// and keeps it pinned to the newest reply the way a chat does.

/** Stand-in lines for a quote that hasn't been supplied, sized as the canvas sized them. */
function lineWidths(index: number) {
  const words = 12 + ((index * 7) % 5) * 5
  const perLine = 11
  const lines: number[] = Array(Math.floor(words / perLine)).fill(292)
  const rest = words % perLine
  if (rest) lines.push(Math.max(72, Math.round((rest / perLine) * 292)))
  return lines
}

/** One element per person, made once: a bubble only re-measures when its content really changes. */
const QUOTES: ReactNode[] = PEOPLE.map((person, index) =>
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

const whoLine = (index: number) => {
  const person = PEOPLE[index]!
  const relations = person.relations.map((r) => RELATION_LABEL[r]).join(', ')
  return (
    <>
      <b>{person.name}</b>
      <span>
        {' · '}
        {person.role}
        {relations ? ` · ${relations}` : ''}
      </span>
    </>
  )
}

/** Scrolls the thread to a person's reply and marks it for a moment. */
export function jumpToPerson(index: number) {
  const bubble = document.querySelector<HTMLElement>(`.chat [data-person="${index}"]`)
  if (!bubble) return
  bubble.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  bubble.removeAttribute('data-flash')
  void bubble.offsetWidth
  bubble.setAttribute('data-flash', '')
  setTimeout(() => bubble.removeAttribute('data-flash'), 1600)
}

function threadNodes(items: ChatItem[], receipt: boolean) {
  const nodes: ReactElement[] = []
  let lastMine = ''
  for (const item of items) if (item.kind === 'me') lastMine = item.key
  items.forEach((item, i) => {
    if (item.kind === 'stamp') {
      nodes.push(<Stamp key={item.key}>{item.text}</Stamp>)
    } else if (item.kind === 'shrug') {
      const first = items[i - 1]?.kind !== 'shrug'
      const last = items[i + 1]?.kind !== 'shrug'
      if (first)
        nodes.push(
          <div key={`${item.key}-who`} className="chat-who">
            <b>Shrug</b>
          </div>,
        )
      nodes.push(
        <Bubble key={item.key} from="them" className="chat-shrug" typing={item.typing} tail={last} avatar={last ? <ShrugAvatar size={28} /> : <span className="chat-gap" />}>
          {item.text}
        </Bubble>,
      )
    } else if (item.kind === 'person') {
      const person = PEOPLE[item.index]!
      nodes.push(
        <div key={`${item.key}-who`} className="chat-who">
          {whoLine(item.index)}
        </div>,
      )
      nodes.push(
        <Bubble key={item.key} from="them" typing={item.typing} tail avatar={<Avatar name={person.name} size={28} />} data-person={item.index}>
          {QUOTES[item.index]}
        </Bubble>,
      )
    } else {
      nodes.push(
        <Bubble key={item.key} from="me" source="chat-composer" tail>
          {item.text}
        </Bubble>,
      )
      if (receipt && item.key === lastMine)
        nodes.push(
          <Receipt key="receipt" show>
            Prototype: nothing has been sent
          </Receipt>,
        )
    }
  })
  return nodes
}

/** The thread's own scrolling curve: quick off the mark, a long settle. */
const settle = (k: number) => 1 - Math.pow(1 - k, 4)
const FOLLOW_MS = 550

function ChatThread() {
  const items = useStore(chat, (s) => s.items)
  const receipt = useStore(chat, (s) => s.receipt)
  const scroller = useRef<HTMLDivElement>(null)
  const flow = useRef<HTMLDivElement>(null)
  /** Following the newest reply, until the reader scrolls back. */
  const pinned = useRef(true)
  /** The scroll that is moving is ours, not the reader's. */
  const run = useRef<{ frame: number; from: number; t0: number } | null>(null)
  const count = items.length
  const [seen, setSeen] = useState(count)
  const [away, setAway] = useState(false)
  const first = useRef(true)
  const latest = useRef(count)
  latest.current = count

  const stop = () => {
    if (run.current) cancelAnimationFrame(run.current.frame)
    run.current = null
  }

  /** Eases the thread to its end. Called again mid-way (a bubble still
   * growing, another reply landing) it carries on from where it is. */
  const follow = (instant = false) => {
    const el = scroller.current
    if (!el) return
    const end = el.scrollHeight - el.clientHeight
    if (instant || prefersReducedMotion() || end - el.scrollTop < 1) {
      stop()
      el.scrollTop = end
      return
    }
    // Not yet begun: it will read the newest end when it does
    if (run.current && !run.current.t0) return
    const step = (now: number) => {
      const state = run.current
      if (!state) return
      // A fresh run starts its clock on its first frame, the same frame the
      // arriving bubble starts fading in on, so the two can't drift apart
      // when the page is busy
      if (!state.t0) state.t0 = now
      const target = el.scrollHeight - el.clientHeight
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
    const carrying = run.current !== null
    stop()
    const state = { frame: 0, from: el.scrollTop, t0: carrying ? performance.now() : 0 }
    run.current = state
    state.frame = requestAnimationFrame(step)
  }

  // A reply has landed: pinned, the thread follows it
  useLayoutEffect(() => {
    if (!pinned.current) return
    follow(first.current)
    first.current = false
    setSeen(count)
  }, [count]) // eslint-disable-line react-hooks/exhaustive-deps

  // A bubble growing out of its typing dots, or the window being resized,
  // changes the height without a new reply: stay on the end through that too
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
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = scroller.current
    if (!el || run.current) return
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 56
    pinned.current = atEnd
    setAway(!atEnd)
    if (atEnd) setSeen(latest.current)
  }

  const nodes = useMemo(() => threadNodes(items, receipt), [items, receipt])
  const unseen = away ? Math.max(0, count - seen) : 0

  return (
    <div className="chat__pane">
      {/* Any scroll the reader starts takes over from ours */}
      <div ref={scroller} className="chat__scroll" onScroll={onScroll} onWheel={stop} onTouchStart={stop} onPointerDown={stop} onKeyDown={stop} tabIndex={0} role="log" aria-label="The Shrug group chat" aria-live="off">
        <div ref={flow} className="chat__flow">
          <Thread app="imessage" className="chat__thread">
            {nodes}
          </Thread>
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
        {unseen > 0 ? `${unseen} new ${unseen === 1 ? 'reply' : 'replies'}` : 'Latest'}
      </button>
    </div>
  )
}

function Composer() {
  const [text, setText] = useState('')
  const done = useStore(chat, (s) => s.done)
  const ready = text.trim().length > 0
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    sendMessage(text)
    setText('')
  }
  return (
    <form className="composer" data-done={done || undefined} onSubmit={submit}>
      <div className="composer__field">
        {/* Where the typed words start: a sent bubble forms out of this spot */}
        <span className="composer__origin" data-target="chat-composer" aria-hidden />
        <input className="composer__input" type="text" placeholder="Message Shrug" aria-label="Message Shrug" autoComplete="off" enterKeyHint="send" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="composer__send" aria-label="Send" data-ready={ready || undefined} aria-disabled={!ready}>
          <ArrowUp size={15} strokeWidth={2.8} aria-hidden />
        </button>
      </div>
    </form>
  )
}

const PersonRow = memo(function PersonRow({ index, state }: { index: number; state: 'waiting' | 'typing' | 'replied' }) {
  const person = PEOPLE[index]!
  const replied = state === 'replied'
  return (
    <Row
      className="chat-person"
      pad={6}
      role="button"
      tabIndex={replied ? 0 : -1}
      aria-disabled={!replied}
      aria-label={`${person.name}, ${person.role}${replied ? '. Show their reply.' : state === 'typing' ? ', typing' : ', yet to reply'}`}
      data-state={state}
      data-person-row={index}
      lead={<Avatar name={person.name} size={22} />}
      title={person.name}
      onClick={replied ? () => jumpToPerson(index) : undefined}
      onKeyDown={(e) => {
        if (replied && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          jumpToPerson(index)
        }
      }}
    >
      <Check on={replied} pending={state === 'typing'} size={14} />
    </Row>
  )
})

function ChatSidebar() {
  const replied = useStore(chat, (s) => s.replied)
  const typing = useStore(chat, (s) => s.typing)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = useMemo(() => PEOPLE.map((p, i) => ({ p, i })).filter(({ p }) => !q || p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q)), [q])
  const list = useRef<HTMLDivElement>(null)
  /** When the reader last scrolled the list themselves. */
  const touched = useRef(0)
  // The list keeps up with whoever replied last, unless it's being read
  useEffect(() => {
    const el = list.current
    if (!el || q || performance.now() - touched.current < 6000) return
    const row = el.querySelector<HTMLElement>(`[data-person-row="${Math.min(TOTAL - 1, Math.max(replied, typing))}"]`)
    if (!row) return
    const top = row.offsetTop - el.clientHeight * 0.62
    el.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [replied, typing, q])
  const touch = () => {
    touched.current = performance.now()
  }
  return (
    <div className="chat-side">
      <div className="chat-side__top">
        <SearchField value={query} onChange={setQuery} label="Search people" />
      </div>
      <Row
        className="chat-conv"
        pad={8}
        selected
        lead={<ShrugAvatar size={36} />}
        title="The Shrug group chat"
        subtitle={
          <>
            <Count value={replied} /> of {TOTAL} replied
          </>
        }
      />
      <SideLabel count={q ? `${shown.length} of ${TOTAL}` : TOTAL}>People</SideLabel>
      <div ref={list} className="chat-side__list" role="list" onWheel={touch} onTouchStart={touch} onPointerDown={touch} onKeyDown={touch}>
        {shown.map(({ i }) => (
          <PersonRow key={i} index={i} state={i < replied ? 'replied' : i === typing ? 'typing' : 'waiting'} />
        ))}
        {shown.length === 0 && <div className="side-empty">No one by that name</div>}
      </div>
    </div>
  )
}

function ChatHeading() {
  const replied = useStore(chat, (s) => s.replied)
  return (
    <div className="chat-head">
      <ShrugAvatar size={32} />
      <div className="chat-head__text">
        <div className="chat-head__title">The Shrug group chat</div>
        <div className="chat-head__sub">
          {TOTAL} people · <Count value={replied} /> replied
        </div>
      </div>
    </div>
  )
}

function ChatTools() {
  const paused = useStore(chat, (s) => s.paused)
  const done = useStore(chat, (s) => s.done)
  return (
    <span className="tools">
      <Tool label={paused ? 'Resume' : 'Pause'} onClick={toggleChat} disabled={done}>
        {paused ? <Play size={15} strokeWidth={1.9} aria-hidden /> : <Pause size={15} strokeWidth={1.9} aria-hidden />}
      </Tool>
      <Tool label="Replay" onClick={replayChat}>
        <RotateCcw size={15} strokeWidth={1.9} aria-hidden />
      </Tool>
    </span>
  )
}

export function MessagesApp() {
  return (
    <Window className="app chat" sidebar={<ChatSidebar />} sidebarWidth={264} sidebarStyle="floating" lightsSize="large" barSize="tall" lead={<ChatHeading />} toolbar={<ChatTools />} body={{ className: 'chat__body' }}>
      <ChatThread />
      <Composer />
    </Window>
  )
}
