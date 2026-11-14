import { PEOPLE } from '../data/people'
import { SITE } from '../data/site'
import { prefersReducedMotion } from '../os/dom'
import { createStore } from '../os/store'

// The group chat as it plays out. This is Shrug's own Messages: Shrug types
// the question into the field and sends it, then ninety people reply, slowly
// at first so the opening line can be read, then piling in, and Shrug signs
// off with a shrug. It runs on its own clock whether or not its window is
// showing, so the menu bar and the Dock's badge can count along.

export type ChatItem =
  /** A message from this Mac: Shrug's own, or one the visitor typed. */
  | { key: string; kind: 'me'; text: string; by: 'shrug' | 'visitor' }
  | { key: string; kind: 'person'; index: number; typing: boolean }

export interface Chat {
  /** The group conversation, in order. */
  items: ChatItem[]
  /** How many people have replied. */
  replied: number
  /** The person whose dots are showing, or -1. */
  typing: number
  /** What the script is typing into the message field right now, or null. */
  draft: string | null
  /** Shrug's question has been sent. */
  asked: boolean
  /** Everyone has replied and Shrug has shrugged. */
  done: boolean
  paused: boolean
  started: boolean
  /** When the conversation began, and when each person replied (0 until they do). */
  startedAt: number
  repliedAt: number[]
  /** What the visitor has typed to one person, by that person's index. */
  direct: Record<number, { key: string; text: string }[]>
}

export const TOTAL = PEOPLE.length
export const QUESTION = ['ok be honest.', `what’s it actually like working with us? ${SITE.mark}`]

const asMine = (text: string, key: string): ChatItem => ({ key, kind: 'me', text, by: 'shrug' })

const fresh = (): Chat => ({
  items: [],
  replied: 0,
  typing: -1,
  draft: null,
  asked: false,
  done: false,
  paused: false,
  started: false,
  startedAt: Date.now(),
  repliedAt: PEOPLE.map(() => 0),
  direct: {},
})

/** The whole conversation at once, keeping anything the visitor has sent where it was. */
function everything(from: Chat): Chat {
  const now = Date.now()
  const have = new Set(from.items.map((i) => i.key))
  const items = from.items.map((i) => (i.kind === 'person' && i.typing ? { ...i, typing: false } : i))
  const opening = QUESTION.map((text, n) => asMine(text, `ask-${n}`)).filter((i) => !have.has(i.key))
  const people = PEOPLE.map((_, index): ChatItem => ({ key: `p-${index}`, kind: 'person', index, typing: false })).filter((i) => !have.has(i.key))
  const closing = have.has('end') ? [] : [asMine(SITE.mark, 'end')]
  return {
    ...from,
    items: [...opening, ...items, ...people, ...closing],
    replied: TOTAL,
    typing: -1,
    draft: null,
    asked: true,
    done: true,
    paused: false,
    started: true,
    repliedAt: from.repliedAt.map((t) => t || now),
  }
}

export const chat = createStore<Chat>(fresh())

// ---- The clock ----

let timer: ReturnType<typeof setTimeout> | undefined
/** What runs next, and how long it still has to wait (kept across a pause). */
let pending: { fn: () => void; due: number; left: number } | null = null

function after(ms: number, fn: () => void) {
  clearTimeout(timer)
  timer = undefined
  pending = { fn, due: performance.now() + ms, left: ms }
  if (chat.get().paused || document.hidden) return
  timer = setTimeout(run, ms)
}

function run() {
  const next = pending
  pending = null
  timer = undefined
  next?.fn()
}

function hold() {
  if (!pending || timer === undefined) return
  clearTimeout(timer)
  timer = undefined
  pending.left = Math.max(0, pending.due - performance.now())
}

function release() {
  if (!pending || chat.get().paused || document.hidden) return
  clearTimeout(timer)
  pending.due = performance.now() + pending.left
  timer = setTimeout(run, pending.left)
}

function reset() {
  clearTimeout(timer)
  timer = undefined
  pending = null
}

if (typeof document !== 'undefined') {
  // Nobody misses the replies while the tab is in the background
  document.addEventListener('visibilitychange', () => (document.hidden ? hold() : release()))
}

// ---- The script ----

/** Types `text` into the message field a character at a time, then sends it. */
function typeAndSend(text: string, key: string, each: number, then: () => void) {
  let at = 0
  const step = () => {
    at++
    chat.set((s) => ({ ...s, draft: text.slice(0, at) }))
    if (at < text.length) return after(each, step)
    after(320, () => {
      chat.set((s) => ({ ...s, draft: null, items: [...s.items, asMine(text, key)] }))
      then()
    })
  }
  after(each, step)
}

/** The first few people are seen typing; after that the replies just land. */
const TYPED = 6

/** ms from one reply to the next: unhurried at first, then quickening. */
function pace(index: number) {
  if (index === 0) return 3400
  const t = Math.min(1, index / 26)
  const eased = 1 - Math.pow(1 - t, 2.2)
  return Math.round(1600 - eased * 1230)
}

const settle = (items: ChatItem[], key: string): ChatItem[] => items.map((item) => (item.key === key && item.kind === 'person' ? { ...item, typing: false } : item))

function person(index: number) {
  if (index >= TOTAL) return after(1100, closing)
  const key = `p-${index}`
  const land = () => {
    chat.set((s) => {
      const repliedAt = s.repliedAt.slice()
      repliedAt[index] = Date.now()
      return {
        ...s,
        typing: -1,
        replied: index + 1,
        repliedAt,
        items: s.items.some((i) => i.key === key) ? settle(s.items, key) : [...s.items, { key, kind: 'person', index, typing: false }],
      }
    })
    after(pace(index), () => person(index + 1))
  }
  if (index < TYPED) {
    chat.set((s) => ({ ...s, typing: index, items: [...s.items, { key, kind: 'person', index, typing: true }] }))
    after(index === 0 ? 1800 : 1200 - index * 110, land)
  } else land()
}

function closing() {
  typeAndSend(SITE.mark, 'end', 95, () => chat.set((s) => ({ ...s, done: true })))
}

function opening() {
  typeAndSend(QUESTION[0]!, 'ask-0', 46, () =>
    after(380, () =>
      typeAndSend(QUESTION[1]!, 'ask-1', 30, () => {
        chat.set((s) => ({ ...s, asked: true }))
        after(1300, () => person(0))
      }),
    ),
  )
}

// ---- Controls ----

/** Starts the conversation, once. Under reduced motion it has all been said already. */
export function startChat() {
  if (chat.get().started) return
  if (prefersReducedMotion()) return chat.set(everything(fresh()))
  chat.set((s) => ({ ...s, started: true, startedAt: Date.now() }))
  after(900, opening)
}

export function pauseChat() {
  hold()
  chat.set((s) => ({ ...s, paused: true }))
}

export function resumeChat() {
  chat.set((s) => ({ ...s, paused: false }))
  release()
}

export const toggleChat = () => (chat.get().paused ? resumeChat() : pauseChat())

export function replayChat() {
  reset()
  chat.set({ ...fresh(), started: true })
  after(700, opening)
}

/** Everyone replies at once. */
export function finishChat() {
  reset()
  chat.set((s) => everything(s))
}

// ---- The visitor's own messages ----

let sent = 0

/** Something the visitor typed, to the group or to one person. Nothing leaves
 * the page: the bubble is marked Not Delivered, as Messages marks a message
 * that didn't go. */
export function sendMessage(text: string, to: 'group' | number = 'group') {
  const body = text.trim()
  if (!body) return
  const key = `me-${++sent}`
  chat.set((s) =>
    to === 'group'
      ? { ...s, items: [...s.items, { key, kind: 'me', text: body, by: 'visitor' }] }
      : { ...s, direct: { ...s.direct, [to]: [...(s.direct[to] ?? []), { key, text: body }] } },
  )
}
