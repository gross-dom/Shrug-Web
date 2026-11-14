import { PEOPLE } from '../data/people'
import { SITE } from '../data/site'
import { prefersReducedMotion } from '../os/dom'
import { createStore } from '../os/store'

// The group chat as it plays out: Shrug asks, then ninety people reply, slowly
// at first so the opening line can be read, then piling in. It runs on its own
// clock whether or not its window is showing, so the menu bar can count along.

export type ChatItem =
  | { key: string; kind: 'stamp'; text: string }
  | { key: string; kind: 'shrug'; text: string; typing: boolean }
  | { key: string; kind: 'person'; index: number; typing: boolean }
  | { key: string; kind: 'me'; text: string }

export interface Chat {
  items: ChatItem[]
  /** How many people have replied. */
  replied: number
  /** The person whose dots are showing, or -1. */
  typing: number
  /** Everyone has replied and Shrug has shrugged. */
  done: boolean
  paused: boolean
  started: boolean
  /** The visitor has sent something: show that nothing was really delivered. */
  receipt: boolean
}

export const TOTAL = PEOPLE.length

const opening = (): ChatItem[] => [
  { key: 'stamp', kind: 'stamp', text: 'Shrug started the chat' },
  { key: 'ask-1', kind: 'shrug', text: 'ok be honest.', typing: false },
  { key: 'ask-2', kind: 'shrug', text: `what’s it actually like working with us? ${SITE.mark}`, typing: false },
]

const everyone = (): ChatItem[] => [
  ...opening(),
  ...PEOPLE.map((_, index): ChatItem => ({ key: `p-${index}`, kind: 'person', index, typing: false })),
  { key: 'end', kind: 'shrug', text: SITE.mark, typing: false },
]

const fresh = (): Chat => ({ items: opening(), replied: 0, typing: -1, done: false, paused: false, started: false, receipt: false })

export const chat = createStore<Chat>(fresh())

// ---- The clock ----

let timer: ReturnType<typeof setTimeout> | undefined
/** What runs next, and how long it still has to wait (kept across a pause). */
let pending: { fn: () => void; due: number; left: number } | null = null

function after(ms: number, fn: () => void) {
  clearTimeout(timer)
  pending = { fn, due: performance.now() + ms, left: ms }
  if (chat.get().paused || document.hidden) return
  timer = setTimeout(run, ms)
}

function run() {
  const next = pending
  pending = null
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

if (typeof document !== 'undefined') {
  // Nobody misses the replies while the tab is in the background
  document.addEventListener('visibilitychange', () => (document.hidden ? hold() : release()))
}

// ---- The script ----

/** The first few people are seen typing; after that the replies just land. */
const TYPED = 6

/** ms from one reply to the next: unhurried at first, then quickening. */
function pace(index: number) {
  if (index === 0) return 3400
  const t = Math.min(1, index / 26)
  const eased = 1 - Math.pow(1 - t, 2.2)
  return Math.round(1500 - eased * 1230)
}

function replace(items: ChatItem[], key: string, change: Partial<ChatItem>): ChatItem[] {
  return items.map((item) => (item.key === key ? ({ ...item, ...change } as ChatItem) : item))
}

function person(index: number) {
  if (index >= TOTAL) return after(900, closing)
  const key = `p-${index}`
  const land = () => {
    chat.set((s) => ({
      ...s,
      typing: -1,
      replied: index + 1,
      items: s.items.some((i) => i.key === key) ? replace(s.items, key, { typing: false }) : [...s.items, { key, kind: 'person', index, typing: false }],
    }))
    after(pace(index), () => person(index + 1))
  }
  if (index < TYPED) {
    chat.set((s) => ({ ...s, typing: index, items: [...s.items, { key, kind: 'person', index, typing: true }] }))
    after(index === 0 ? 1700 : 1100 - index * 110, land)
  } else land()
}

function closing() {
  chat.set((s) => ({ ...s, items: [...s.items, { key: 'end', kind: 'shrug', text: SITE.mark, typing: true }] }))
  after(1300, () => chat.set((s) => ({ ...s, done: true, items: replace(s.items, 'end', { typing: false }) })))
}

// ---- Controls ----

/** How many messages the visitor has sent, and Shrug's reply on its way to the last. */
let sent = 0
let answering: ReturnType<typeof setTimeout> | undefined

/** Starts the replies, once. Under reduced motion everyone has already replied. */
export function startChat() {
  if (chat.get().started) return
  if (prefersReducedMotion()) {
    chat.set({ ...fresh(), items: everyone(), replied: TOTAL, done: true, started: true })
    return
  }
  chat.set((s) => ({ ...s, started: true }))
  after(1500, () => person(0))
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
  clearTimeout(timer)
  clearTimeout(answering)
  timer = undefined
  pending = null
  chat.set({ ...fresh(), started: true })
  after(900, () => person(0))
}

/** Everyone replies at once. */
export function finishChat() {
  clearTimeout(timer)
  timer = undefined
  pending = null
  chat.set((s) => {
    const mine = s.items.filter((i) => i.kind === 'me' || i.key.startsWith('re-'))
    return { ...s, items: [...everyone(), ...mine], replied: TOTAL, typing: -1, done: true, paused: false, started: true }
  })
}

/** The visitor's own message. Nothing leaves the page: Shrug shrugs back and
 * the receipt says so. */
export function sendMessage(text: string) {
  const body = text.trim()
  if (!body) return
  const n = ++sent
  chat.set((s) => ({ ...s, receipt: true, items: [...s.items, { key: `me-${n}`, kind: 'me', text: body }] }))
  clearTimeout(answering)
  answering = setTimeout(() => {
    const key = `re-${n}`
    chat.set((s) => ({ ...s, items: [...s.items, { key, kind: 'shrug', text: SITE.mark, typing: true }] }))
    answering = setTimeout(() => chat.set((s) => ({ ...s, items: replace(s.items, key, { typing: false }) })), 1400)
  }, 700)
}
