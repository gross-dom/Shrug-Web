import { PEOPLE } from '../data/people'
import { SITE } from '../data/site'
import { prefersReducedMotion } from '../os/dom'
import { createStore } from '../os/store'

// The group chat as it plays out. This is Shrug's own Messages: the question
// is typed into the field and sent, then ninety people reply, each one
// written and then sent at the same unhurried pace, and Shrug signs off with a
// shrug. It runs on its own clock whether or not its window is showing.

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
  /** What the visitor has typed into one of the other conversations, by its id. */
  direct: Record<string, { key: string; text: string }[]>
}

export const TOTAL = PEOPLE.length
export const QUESTION = ['ok be honest.', 'what’s it actually like working with us?']

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
  const asked = (key: string) => key.startsWith('ask-')
  // The question first, whole and in order, however much of it had been sent
  const opening = QUESTION.map((text, n) => asMine(text, `ask-${n}`))
  const items = from.items.filter((i) => !asked(i.key)).map((i) => (i.kind === 'person' && i.typing ? { ...i, typing: false } : i))
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

// ---- The pace ----

/** Whether anyone can see the conversation being written. On the desktop it
 * always can be. On the phone it is out of sight on the Lock Screen, on the
 * Home Screen and behind another app: there a reply is only news (a
 * notification, a line in the widget), with no message field to watch being
 * typed into and no dots to watch being written, so those waits are cut short. */
let unseen = false

/** How much of a wait is kept while the conversation is out of sight: Shrug's
 * own typing, which nobody there sees at all, and the time each reply takes. */
const UNSEEN = { typing: 0.3, replies: 0.68 }

/** Told by the phone when the conversation goes out of sight and comes back. The wait under way keeps its time; the next one has the new pace. */
export function setChatUnseen(on: boolean) {
  unseen = on
}

const paced = (ms: number, part: keyof typeof UNSEEN) => (unseen ? Math.round(ms * UNSEEN[part]) : ms)

// ---- The script ----

/** Types `text` into the message field a character at a time, then sends it. */
function typeAndSend(text: string, key: string, each: number, then: () => void) {
  let at = 0
  const step = () => {
    at++
    chat.set((s) => ({ ...s, draft: text.slice(0, at) }))
    if (at < text.length) return after(paced(each, 'typing'), step)
    after(paced(320, 'typing'), () => {
      chat.set((s) => ({ ...s, draft: null, items: [...s.items, asMine(text, key)] }))
      then()
    })
  }
  after(paced(each, 'typing'), step)
}

/** Every reply keeps the same time: its dots show while it is written, it is
 * sent, and there is a breath before the next person starts. It never speeds
 * up while it is being watched; out of sight (see above) each is shorter. */
export const WRITING = 1700
export const BETWEEN = 1100

function person(index: number) {
  if (index >= TOTAL) return after(paced(BETWEEN, 'replies'), closing)
  const key = `p-${index}`
  // Being written: their dots
  chat.set((s) => ({ ...s, typing: index, items: [...s.items, { key, kind: 'person', index, typing: true }] }))
  after(paced(WRITING, 'replies'), () => {
    // Sent: the dots grow into the message
    chat.set((s) => {
      const repliedAt = s.repliedAt.slice()
      repliedAt[index] = Date.now()
      return { ...s, typing: -1, replied: index + 1, repliedAt, items: s.items.map((item) => (item.key === key && item.kind === 'person' ? { ...item, typing: false } : item)) }
    })
    after(paced(BETWEEN, 'replies'), () => person(index + 1))
  })
}

function closing() {
  typeAndSend(SITE.mark, 'end', 95, () => chat.set((s) => ({ ...s, done: true })))
}

function opening() {
  typeAndSend(QUESTION[0]!, 'ask-0', 46, () =>
    after(paced(380, 'typing'), () =>
      typeAndSend(QUESTION[1]!, 'ask-1', 30, () => {
        chat.set((s) => ({ ...s, asked: true }))
        after(paced(BETWEEN, 'replies'), () => person(0))
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
  after(paced(900, 'typing'), opening)
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
  after(paced(700, 'typing'), opening)
}

/** Everyone replies at once. */
export function finishChat() {
  reset()
  chat.set((s) => everything(s))
}

// ---- The visitor's own messages ----

let sent = 0

/** Something the visitor typed, into the group or into one of the other
 * conversations (by its id). Nothing leaves the page: the bubble is marked
 * Not Delivered, as Messages marks a message that didn't go. */
export function sendMessage(text: string, to = 'group') {
  const body = text.trim()
  if (!body) return
  const key = `me-${++sent}`
  chat.set((s) =>
    to === 'group'
      ? { ...s, items: [...s.items, { key, kind: 'me', text: body, by: 'visitor' }] }
      : { ...s, direct: { ...s.direct, [to]: [...(s.direct[to] ?? []), { key, text: body }] } },
  )
}
