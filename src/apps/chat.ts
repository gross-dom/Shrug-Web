import { PEOPLE } from '../data/people'
import { prefersReducedMotion } from '../os/dom'
import { createStore } from '../os/store'

// The group chat as it plays out. This is Shrug's own Messages: the question
// is typed into the field and sent, then everyone replies, each one written
// and then sent, briskly, the way a group that has a lot to say fills a
// thread. The last reply is the end of it. It runs on its own clock whether or
// not its window is showing, how far it has got is kept for the tab, so a
// reload carries on where it was, and whoever would sooner not wait can have
// every reply at once (`finishChat`).

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
  /** Everyone has replied. */
  done: boolean
  paused: boolean
  started: boolean
  /** It began with everything already said (reduced motion): it is read from its top, and none of it is new. */
  whole: boolean
  /** When the conversation began, and when each person replied (0 until they do). */
  startedAt: number
  repliedAt: number[]
  /** What the visitor has typed into one of the other conversations, by its id. */
  direct: Record<string, Written[]>
}

/** A message the visitor sent in one of the other conversations, and when: the conversation's row in the
 * list says both. (One kept by this tab before the time was kept has none.) */
export interface Written {
  key: string
  text: string
  at?: number
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
  whole: false,
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
  return {
    ...from,
    items: [...opening, ...items, ...people],
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

/** How many messages the visitor has sent: each new one is numbered on from it (`me-3`). */
let sent = 0

// ---- Kept for the tab ----

// A reload, or a tab a phone threw away and brought back, picks the
// conversation up where it was: the replies that had come in are in, and the
// next one is on its way. It is kept in the tab's own storage, which a
// sandboxed frame may refuse: then nothing is kept and a reload starts over.

/** Reads something kept for the tab; null if there is nothing, or no storage to keep it in. */
export function keptFor(name: string): unknown {
  try {
    const text = sessionStorage.getItem(`shrug:${name}`)
    return text === null ? null : (JSON.parse(text) as unknown)
  } catch {
    return null
  }
}

/** Keeps something for the tab, if there is storage to keep it in. */
export function keepFor(name: string, value: unknown) {
  try {
    sessionStorage.setItem(`shrug:${name}`, JSON.stringify(value))
  } catch {
    // Nothing to keep it in: a reload starts over
  }
}

/** One of the visitor's own messages in the group, and the key of what it came after there. */
interface KeptMessage {
  key: string
  text: string
  after: string
}

interface Kept {
  replied: number
  done: boolean
  startedAt: number
  repliedAt: number[]
  /** What the visitor sent: into the group (each with its place), and into the other conversations. */
  mine: KeptMessage[]
  direct: Chat['direct']
}

const MOST = 200
const words = (value: unknown) => (typeof value === 'string' ? value.slice(0, 5000) : '')
const listOf = (value: unknown) => (Array.isArray(value) ? (value.slice(0, MOST) as Record<string, unknown>[]).filter((entry) => !!entry && typeof entry === 'object') : [])

/** What this tab had of the conversation, read with care (it is only text in storage): null if there is nothing of use. */
function kept(): Kept | null {
  const was = keptFor('chat') as Partial<Record<keyof Kept, unknown>> | null
  if (!was || typeof was !== 'object') return null
  const replied = typeof was.replied === 'number' && Number.isInteger(was.replied) && was.replied >= 0 && was.replied <= TOTAL ? was.replied : 0
  const startedAt = typeof was.startedAt === 'number' && Number.isFinite(was.startedAt) && was.startedAt <= Date.now() ? was.startedAt : Date.now()
  const repliedAt = Array.isArray(was.repliedAt) ? was.repliedAt.map((t) => (typeof t === 'number' && Number.isFinite(t) ? t : 0)) : []
  const mine = listOf(was.mine)
    .map((entry) => ({ key: words(entry.key), text: words(entry.text), after: words(entry.after) }))
    .filter((message) => message.key && message.text)
  const direct: Chat['direct'] = {}
  if (was.direct && typeof was.direct === 'object')
    for (const [to, list] of Object.entries(was.direct as Record<string, unknown>).slice(0, MOST)) {
      const said = listOf(list)
        .map((entry): Written => ({ key: words(entry.key), text: words(entry.text), ...(typeof entry.at === 'number' && Number.isFinite(entry.at) && entry.at <= Date.now() ? { at: entry.at } : null) }))
        .filter((message) => message.key && message.text)
      if (said.length) direct[to] = said
    }
  if (!replied && !mine.length && !Object.keys(direct).length) return null
  return { replied, done: was.done === true && replied === TOTAL, startedAt, repliedAt, mine, direct }
}

// Kept as it changes: how far it has got, and what the visitor has sent
let keptAs = ''
let keptOf: { items: ChatItem[]; direct: Chat['direct']; done: boolean } | null = null
chat.subscribe(() => {
  const s = chat.get()
  if (!s.started) return
  // Shrug's own typing changes the field many times a second, and nothing that is kept
  if (keptOf && keptOf.items === s.items && keptOf.direct === s.direct && keptOf.done === s.done) return
  keptOf = { items: s.items, direct: s.direct, done: s.done }
  const mine = s.items.flatMap((item, i) => (item.kind === 'me' && item.by === 'visitor' ? [{ key: item.key, text: item.text, after: s.items[i - 1]?.key ?? '' }] : []))
  const now: Kept = { replied: s.replied, done: s.done, startedAt: s.startedAt, repliedAt: s.repliedAt.slice(0, s.replied), mine, direct: s.direct }
  const as = JSON.stringify(now)
  if (as === keptAs) return
  keptAs = as
  keepFor('chat', now)
})

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
    after(paced(200, 'typing'), () => {
      chat.set((s) => ({ ...s, draft: null, items: [...s.items, asMine(text, key)] }))
      then()
    })
  }
  after(paced(each, 'typing'), step)
}

/** Every reply keeps the same time: its dots show while it is written, it is
 * sent, and there is a moment before the next person starts. Quick, as a
 * group with something to say is: a reply lands a little over once a second,
 * so the first are there within a few seconds of arriving and the thread never
 * stands still. Out of sight (see above) each is shorter again. */
export const WRITING = 800
export const BETWEEN = 400

function person(index: number) {
  // The last reply is the end of the conversation
  if (index >= TOTAL) return chat.set((s) => ({ ...s, done: true }))
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

function opening() {
  typeAndSend(QUESTION[0]!, 'ask-0', 26, () =>
    after(paced(240, 'typing'), () =>
      typeAndSend(QUESTION[1]!, 'ask-1', 17, () => {
        chat.set((s) => ({ ...s, asked: true }))
        after(paced(BETWEEN, 'replies'), () => person(0))
      }),
    ),
  )
}

/** The conversation as this tab left it: the replies that had come in, and
 * what the visitor sent, each of their messages where it was (after what it
 * came after; at the end, if that has not been said again yet). */
function restored(was: Kept): Chat {
  const begun = was.replied > 0
  const items: ChatItem[] = begun ? [...QUESTION.map((text, n) => asMine(text, `ask-${n}`)), ...PEOPLE.slice(0, was.replied).map((_, index): ChatItem => ({ key: `p-${index}`, kind: 'person', index, typing: false }))] : []
  for (const message of was.mine) {
    const at = items.findIndex((item) => item.key === message.after)
    const item: ChatItem = { key: message.key, kind: 'me', text: message.text, by: 'visitor' }
    if (at < 0) items.push(item)
    else items.splice(at + 1, 0, item)
  }
  // New messages are numbered on from the ones that came back
  for (const key of [...was.mine.map((m) => m.key), ...Object.values(was.direct).flatMap((list) => list.map((m) => m.key))]) sent = Math.max(sent, Number(key.replace(/^me-/, '')) || 0)
  return {
    ...fresh(),
    started: true,
    asked: begun,
    startedAt: begun ? was.startedAt : Date.now(),
    replied: was.replied,
    repliedAt: PEOPLE.map((_, i) => (i < was.replied ? was.repliedAt[i] || was.startedAt : 0)),
    items,
    direct: was.direct,
  }
}

// ---- Controls ----

/** Starts the conversation, once. Under reduced motion it has all been said
 * already; in a tab where it had got somewhere, it carries on from there. */
export function startChat() {
  if (chat.get().started) return
  const was = kept()
  const base = was ? restored(was) : { ...fresh(), started: true }
  if (prefersReducedMotion()) return chat.set({ ...everything(base), whole: true })
  // Everyone had replied: it is all there
  if (was?.done) return chat.set(everything(base))
  chat.set(base)
  // Under way: the next reply. Not yet begun: from the question
  if (base.asked) after(paced(BETWEEN, 'replies'), () => person(base.replied))
  else after(paced(400, 'typing'), opening)
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
  after(paced(400, 'typing'), opening)
}

/** Everyone replies at once. */
export function finishChat() {
  reset()
  chat.set((s) => everything(s))
}

// ---- The visitor's own messages ----

/** What the visitor has typed and not sent, by conversation. It is kept here
 * and not in the field it was typed into, so that it is still there when the
 * layout changes under them (a tablet turned) or a conversation is left and
 * come back to. */
export const unsent = createStore<Record<string, string>>(typedBefore())

export const setUnsent = (conversation: string, text: string) => unsent.set((s) => ((s[conversation] ?? '') === text ? s : { ...s, [conversation]: text }))

/** What this tab had typed and not sent, by conversation. */
function typedBefore() {
  const was = keptFor('unsent')
  const typed: Record<string, string> = {}
  if (was && typeof was === 'object') for (const [conversation, text] of Object.entries(was as Record<string, unknown>).slice(0, MOST)) if (typeof text === 'string' && text) typed[conversation] = text.slice(0, 5000)
  return typed
}

unsent.subscribe(() => keepFor('unsent', unsent.get()))

/** Something the visitor typed, into the group or into one of the other
 * conversations (by its id). It joins the conversation as any sent message
 * does, and is marked Delivered. (Nothing leaves the page: the conversation is
 * a recording, and there is nobody at the other end to answer.) */
export function sendMessage(text: string, to = 'group') {
  const body = text.trim()
  if (!body) return
  const key = `me-${++sent}`
  chat.set((s) =>
    to === 'group'
      ? { ...s, items: [...s.items, { key, kind: 'me', text: body, by: 'visitor' }] }
      : { ...s, direct: { ...s.direct, [to]: [...(s.direct[to] ?? []), { key, text: body, at: Date.now() }] } },
  )
}
