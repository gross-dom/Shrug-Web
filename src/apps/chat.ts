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
  /** What the visitor has typed to one person, by that person's index. */
  direct: Record<number, { key: string; text: string }[]>
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

/** How long before the conversation began each person's own message reached
 * Shrug: the first a few minutes before, the last a couple of days. Made from
 * their place in the list, so it is the same on every visit. */
const AGO = (() => {
  let minutes = 0
  return PEOPLE.map((_, i) => (minutes += 7 + ((i * 37 + 11) % 43)) * 60_000)
})()

/** When a person's own message to Shrug is dated. */
export const sentAt = (index: number, startedAt: number) => startedAt - AGO[index]!

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

/** Every reply keeps the same time: its dots show while it is written, it is
 * sent, and there is a breath before the next person starts. It never speeds up. */
const WRITING = 1700
const BETWEEN = 1100

function person(index: number) {
  if (index >= TOTAL) return after(BETWEEN, closing)
  const key = `p-${index}`
  // Being written: their dots
  chat.set((s) => ({ ...s, typing: index, items: [...s.items, { key, kind: 'person', index, typing: true }] }))
  after(WRITING, () => {
    // Sent: the dots grow into the message
    chat.set((s) => {
      const repliedAt = s.repliedAt.slice()
      repliedAt[index] = Date.now()
      return { ...s, typing: -1, replied: index + 1, repliedAt, items: s.items.map((item) => (item.key === key && item.kind === 'person' ? { ...item, typing: false } : item)) }
    })
    after(BETWEEN, () => person(index + 1))
  })
}

function closing() {
  typeAndSend(SITE.mark, 'end', 95, () => chat.set((s) => ({ ...s, done: true })))
}

function opening() {
  typeAndSend(QUESTION[0]!, 'ask-0', 46, () =>
    after(380, () =>
      typeAndSend(QUESTION[1]!, 'ask-1', 30, () => {
        chat.set((s) => ({ ...s, asked: true }))
        after(BETWEEN, () => person(0))
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
