import { BETWEEN, QUESTION, TOTAL, WRITING } from '../apps/chat'
import { ALL } from '../apps/portfolio-ui'
import { answer, isEmail, term } from '../apps/Terminal'
import { DROPS, MEDIA } from '../data/drops'
import { ANSWER_PLACEHOLDER, FAQS } from '../data/faqs'
import { PEOPLE } from '../data/people'
import { COMPANY_COUNT, VERTICALS } from '../data/portfolio'
import { SITE } from '../data/site'
import { prefersReducedMotion } from '../os/dom'
import { createStore } from '../os/store'
import type { PhoneApp } from './nav'

// The site on a phone is one conversation, and the visitor is in it. Niv adds
// them to Shrug Family and asks the group his question; ninety people answer,
// one after another at the pace the desktop keeps. The visitor gets around by
// replying: a tap on a suggested reply, or their own words, and Niv answers in
// the thread with what a message can carry: a few lines, a screenshot of a
// window on his Mac to open, a link, a button that hands off to the real phone.
// While the visitor and Niv are talking the others hold on, until asked back.
//
// Niv's lines below, other than the two he opens with, are placeholder copy.

/** The windows of Niv's Mac he can send a screenshot of. */
export type ShotApp = Exclude<PhoneApp, 'messages'>

export type Item = (
  | /** A line the conversation itself says, as Messages does: who named it, who was added. */
  { key: string; kind: 'note'; text: string }
  | { key: string; kind: 'niv'; text: string; typing: boolean; todo?: boolean }
  | { key: string; kind: 'person'; index: number; typing: boolean }
  /** The visitor's own. `from` is the thing on screen its words lift out of. */
  | { key: string; kind: 'you'; text: string; from: 'field' | 'chip' }
  /** A company's logo, sent by the visitor as a sticker. */
  | { key: string; kind: 'sticker'; company: string }
  | { key: string; kind: 'shot'; app: ShotApp }
  | { key: string; kind: 'link' }
  /** A company, as a link Niv sends: its logo, its name, where it lives. */
  | { key: string; kind: 'company'; company: string }
  /** A photo or video from a drop, by its place in MEDIA. */
  | { key: string; kind: 'media'; index: number }
  | { key: string; kind: 'action'; act: 'people' | 'share' | 'reach' }
) & {
  /** When it was sent, or landed. */
  at?: number
}

export type TopicId = 'people' | 'portfolio' | 'questions' | 'cases' | 'drops' | 'onepager' | 'reach'

/** A suggested reply. Most are things to say; a few only steer. */
export interface Chip {
  id: string
  label: string
  kind: 'resume' | 'topic' | 'faq' | 'decline' | 'others'
}

export interface Convo {
  items: Item[]
  /** How many of the group have answered. */
  replied: number
  /** The group's answers are coming in. They hold while the visitor and Niv talk. */
  flowing: boolean
  /** Everyone has answered. */
  done: boolean
  started: boolean
  startedAt: number
  /** Niv has asked his question: the visitor can reply. */
  ready: boolean
  asked: TopicId[]
  /** The FAQs already asked, by index. */
  faqs: number[]
  /** Which replies are suggested: the things to ask about, or the FAQs themselves. */
  mode: 'topics' | 'faqs'
  /** Niv is waiting on the visitor's email. */
  awaiting: 'email' | null
  /** Messages the visitor has loved, by key. */
  loved: string[]
  /** People asked for by name, who answered ahead of their turn: the group doesn't have them answer twice. */
  early: number[]
}

const TOPICS: { id: TopicId; label: string; words: RegExp }[] = [
  { id: 'people', label: 'who’s in here?', words: /\b(who|people|everyone|members?|family)\b/i },
  { id: 'portfolio', label: 'show me the portfolio', words: /portfolio|compan|invested|startups?/i },
  { id: 'questions', label: 'i have questions', words: /question|faq/i },
  { id: 'cases', label: 'can i see the case studies?', words: /case|stud/i },
  { id: 'drops', label: 'what’s a drop?', words: /drop|vip|merch/i },
  { id: 'onepager', label: 'send me the one-pager', words: /one.?pager|deck|pdf|\bdoc/i },
  { id: 'reach', label: 'how do i reach you?', words: /reach|contact|text|e-?mail|call|talk|touch|number/i },
]

const fresh = (): Convo => ({ items: [], replied: 0, flowing: false, done: false, started: false, startedAt: Date.now(), ready: false, asked: [], faqs: [], mode: 'topics', awaiting: null, loved: [], early: [] })

export const convo = createStore<Convo>(fresh())

// ---- A clock that stops while the page is out of sight ----

interface Timer {
  fn: () => void
  left: number
  due: number
  id?: ReturnType<typeof setTimeout>
}

const timers = new Set<Timer>()

function arm(t: Timer) {
  t.due = performance.now() + t.left
  t.id = setTimeout(() => {
    timers.delete(t)
    t.fn()
  }, t.left)
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    const t: Timer = { fn: resolve, left: ms, due: 0 }
    timers.add(t)
    if (!document.hidden) arm(t)
  })

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    for (const t of timers) {
      if (document.hidden) {
        clearTimeout(t.id)
        t.left = Math.max(0, t.due - performance.now())
      } else arm(t)
    }
  })
}

/** Bumped when the conversation starts over: anything still waiting from before gives up. */
let epoch = 0
let serial = 0
const id = () => `m-${++serial}`

/** Adds a message. A second screenshot of the same window takes the place of the
 * first, so the thread never holds two copies of one window. */
const push = (item: Item) => convo.set((s) => ({ ...s, items: [...(item.kind === 'shot' ? s.items.filter((i) => !(i.kind === 'shot' && i.app === item.app)) : s.items), { at: Date.now(), ...item }] }))
const patch = (key: string, change: Partial<Item>) => convo.set((s) => ({ ...s, items: s.items.map((item) => (item.key === key ? ({ ...item, ...change } as Item) : item)) }))

// ---- Niv ----

/** Niv writes each line, then sends it. False if the conversation started over meanwhile. */
async function nivSays(my: number, ...lines: (string | { text: string; todo: true })[]) {
  for (const line of lines) {
    const text = typeof line === 'string' ? line : line.text
    const key = id()
    push({ key, kind: 'niv', text: '', typing: true })
    await wait(Math.min(1900, 650 + text.length * 22))
    if (my !== epoch) return false
    patch(key, { text, typing: false, at: Date.now(), todo: typeof line === 'string' ? undefined : true })
    await wait(420)
    if (my !== epoch) return false
  }
  return true
}

/** Niv sends something that isn't words: it arrives whole, after a moment. */
async function nivSends(my: number, item: Item) {
  await wait(520)
  if (my !== epoch) return false
  push(item)
  await wait(520)
  return my === epoch
}

/** Niv answers one thing at a time, in the order he was asked. */
let talking: Promise<unknown> = Promise.resolve()
const reply = (run: (my: number) => Promise<unknown>) => {
  const my = epoch
  talking = talking.then(() => (my === epoch ? run(my) : undefined))
}

// ---- The group ----

let streaming = false

/** The group answers, one after another, for as long as they are flowing. */
async function flow() {
  if (streaming) return
  streaming = true
  const my = epoch
  while (convo.get().flowing && convo.get().replied < TOTAL) {
    const index = convo.get().replied
    const key = `p-${index}`
    // Asked for by name already: they have had their say
    if (convo.get().early.includes(index)) {
      convo.set((s) => ({ ...s, replied: index + 1 }))
      continue
    }
    push({ key, kind: 'person', index, typing: true })
    await wait(WRITING)
    if (my !== epoch) return
    convo.set((s) => ({ ...s, replied: index + 1, items: s.items.map((item) => (item.key === key ? { ...item, typing: false, at: Date.now() } : item)) as Item[] }))
    await wait(BETWEEN)
    if (my !== epoch) return
  }
  streaming = false
  if (convo.get().replied >= TOTAL && !convo.get().done) {
    convo.set((s) => ({ ...s, done: true, flowing: false }))
    reply((mine) => nivSays(mine, SITE.mark))
  }
}

/** How many of the group have answered, in turn or asked for by name. */
export const answered = (s: Convo) => s.replied + s.early.filter((i) => i >= s.replied).length

/** The group holds on: the visitor and Niv are talking. */
export const hold = () => convo.set((s) => (s.flowing ? { ...s, flowing: false } : s))

export function resume() {
  if (convo.get().done) return
  convo.set((s) => ({ ...s, flowing: true }))
  void flow()
}

// ---- Starting, and starting over ----

async function opening() {
  const my = epoch
  await wait(700)
  if (my !== epoch) return
  if (!(await nivSays(my, QUESTION[0]!, QUESTION[1]!))) return
  convo.set((s) => ({ ...s, ready: true, flowing: true }))
  await wait(BETWEEN)
  if (my === epoch) void flow()
}

/** The whole conversation with the group at once: for when motion isn't wanted, or all of it is asked for. */
function everything(from: Convo): Convo {
  const have = new Set(from.items.map((i) => i.key))
  const opened = from.items.some((i) => i.kind === 'niv')
  const asks: Item[] = opened ? [] : QUESTION.map((text) => ({ key: id(), kind: 'niv', text, typing: false }))
  const people = Array.from({ length: TOTAL }, (_, index): Item => ({ key: `p-${index}`, kind: 'person', index, typing: false })).filter((i) => !have.has(i.key))
  const settled = from.items.map((i) => ((i.kind === 'person' || i.kind === 'niv') && i.typing ? { ...i, typing: false, ...(i.kind === 'niv' && !i.text ? { text: SITE.mark } : null) } : i)) as Item[]
  return { ...from, items: [...asks, ...settled, ...people, { key: id(), kind: 'niv', text: SITE.mark, typing: false }], replied: TOTAL, flowing: false, done: true, started: true, ready: true }
}

function reset() {
  epoch++
  streaming = false
  for (const t of timers) clearTimeout(t.id)
  timers.clear()
  talking = Promise.resolve()
}

/** Starts the conversation, once. */
export function startConvo() {
  if (convo.get().started) return
  if (prefersReducedMotion()) return convo.set(everything({ ...fresh(), started: true }))
  convo.set({ ...fresh(), started: true })
  void opening()
}

export function replayConvo() {
  reset()
  convo.set({ ...fresh(), started: true })
  void opening()
}

/** Everyone answers at once. */
export function finishConvo() {
  reset()
  convo.set((s) => everything(s))
}

// ---- What the visitor can say ----

/** The replies suggested above the field right now. */
export function suggestions(s: Convo): Chip[] {
  if (!s.ready) return []
  const out: Chip[] = []
  if (s.awaiting === 'email') out.push({ id: 'decline', label: 'no worries', kind: 'decline' })
  if (s.mode === 'faqs') {
    FAQS.forEach((faq, i) => {
      if (!s.faqs.includes(i)) out.push({ id: `faq-${i}`, label: faq.question, kind: 'faq' })
    })
    out.push({ id: 'others', label: 'other things', kind: 'others' })
    return out
  }
  if (!s.flowing && !s.done) out.push({ id: 'resume', label: s.replied ? 'keep the replies coming' : 'let them answer', kind: 'resume' })
  for (const topic of TOPICS) if (!s.asked.includes(topic.id)) out.push({ id: topic.id, label: topic.label, kind: 'topic' })
  return out
}

const you = (text: string, from: 'field' | 'chip') => push({ key: id(), kind: 'you', text, from })

const done = (topic: TopicId) => convo.set((s) => (s.asked.includes(topic) ? s : { ...s, asked: [...s.asked, topic] }))

function about(topic: TopicId) {
  done(topic)
  switch (topic) {
    case 'people':
      return reply(async (my) => (await nivSays(my, `${TOTAL} people.`, 'founders we’ve backed, people who back us, people we invest alongside.')) && nivSends(my, { key: id(), kind: 'action', act: 'people' }))
    case 'portfolio':
      return reply(async (my) => (await nivSays(my, `${COMPANY_COUNT} companies. ${VERTICALS.length} verticals.`, 'here’s the folder on my desktop.')) && nivSends(my, { key: id(), kind: 'shot', app: 'finder' }))
    case 'questions':
      // Not done with until every question has been asked
      convo.set((s) => ({ ...s, mode: 'faqs', asked: s.faqs.length >= FAQS.length ? s.asked : s.asked.filter((t) => t !== 'questions') }))
      return reply((my) => nivSays(my, 'ask away.'))
    case 'cases':
      return reply(async (my) => {
        if (!(await nivSends(my, { key: id(), kind: 'shot', app: 'terminal' }))) return
        if (term.get().step === 'done') return nivSays(my, `one request is plenty. ${SITE.mark}`)
        if (!(await nivSays(my, 'they’re private.', 'want access? send me your email.'))) return
        if (term.get().step !== 'done') convo.set((s) => ({ ...s, awaiting: 'email' }))
      })
    case 'drops':
      return reply(async (my) => (await nivSays(my, `${DROPS.length} so far.`)) && (await nivSends(my, { key: id(), kind: 'shot', app: 'photos' })) && nivSays(my, 'photos and videos from the people who got one.'))
    case 'onepager':
      return reply(async (my) => (await nivSays(my, 'here.')) && nivSends(my, { key: id(), kind: 'link' }))
    case 'reach':
      return reply(async (my) => {
        const line = SITE.contact.sms ? 'text me.' : SITE.contact.email ? 'email me.' : { text: '[A number or an email for Shrug goes in src/data/site.ts. With one, the button below opens the visitor’s real Messages or Mail, with a first line written.]', todo: true as const }
        if (!(await nivSays(my, line))) return
        if ((SITE.contact.sms || SITE.contact.email) && !(await nivSends(my, { key: id(), kind: 'action', act: 'reach' }))) return
        return (await nivSays(my, 'or pass the chat on.')) && nivSends(my, { key: id(), kind: 'action', act: 'share' })
      })
  }
}

function ask(index: number) {
  const faq = FAQS[index]!
  convo.set((s) => {
    const faqs = s.faqs.includes(index) ? s.faqs : [...s.faqs, index]
    const all = faqs.length >= FAQS.length
    // The last question asked: back to everything else
    return { ...s, faqs, mode: all ? 'topics' : s.mode, asked: all && !s.asked.includes('questions') ? [...s.asked, 'questions'] : s.asked }
  })
  reply((my) => nivSays(my, faq.answer ?? { text: ANSWER_PLACEHOLDER, todo: true }))
}

function decline() {
  convo.set((s) => ({ ...s, awaiting: null }))
  reply((my) => nivSays(my, `ok. they’ll be here. ${SITE.mark}`))
}

/** A suggested reply was tapped. */
export function pick(chip: Chip) {
  if (chip.kind === 'resume') return resume()
  if (chip.kind === 'others') return convo.set((s) => ({ ...s, mode: 'topics' }))
  hold()
  you(chip.label, 'chip')
  if (chip.kind === 'decline') return decline()
  if (chip.kind === 'faq') return ask(Number(chip.id.slice(4)))
  about(chip.id as TopicId)
}

/** The visitor typed something of their own. `from` is where its words lift out
 * of: the message field, or wherever `chip-origin` has been put. */
export function say(text: string, from: 'field' | 'chip' = 'field') {
  const body = text.trim()
  if (!body) return
  hold()
  you(body, from)
  // An email is only ever one thing here: asking for the case studies, whether or not Niv has got as far as asking for it
  if (isEmail(body)) {
    convo.set((c) => ({ ...c, awaiting: null, asked: c.asked.includes('cases') ? c.asked : [...c.asked, 'cases'] }))
    if (term.get().step === 'done') return reply((my) => nivSays(my, `one request is plenty. ${SITE.mark}`))
    // Told to the terminal on the Mac as well, so the two keep one account of it
    if (term.get().step === 'ask') answer('y')
    answer(body)
    return reply(async (my) => (await nivSays(my, `request noted for ${body}.`)) && push({ key: id(), kind: 'note', text: 'Prototype: nothing has been sent.' }))
  }
  if (convo.get().awaiting === 'email') return reply((my) => nivSays(my, 'that doesn’t look like an email. try again.'))
  const low = body.toLowerCase().replace(/[?!.]+$/, '')
  const faq = FAQS.findIndex((f) => f.question.toLowerCase().replace(/[?!.]+$/, '') === low)
  if (faq >= 0) return ask(faq)
  const topic = TOPICS.find((t) => t.words.test(body))
  if (topic) return about(topic.id)
  reply((my) => nivSays(my, SITE.mark, 'try one of the replies below.'))
}

// ---- Said from the apps, where the keyboard would be ----

/** Whether someone's reply is in the conversation yet (or on its way in). */
export const isHere = (index: number) => convo.get().items.some((i) => i.kind === 'person' && i.index === index)

/** Has one person answer now, whatever their turn. With `asking`, the visitor
 * asks for them by name first and they take a moment to write; without, their
 * reply is simply there. False if it already was. */
export function bring(index: number, asking = false) {
  if (!PEOPLE[index] || isHere(index)) return false
  const key = `p-${index}`
  convo.set((s) => ({ ...s, early: [...s.early, index] }))
  if (!asking) {
    push({ key, kind: 'person', index, typing: false })
    return true
  }
  hold()
  you(`@${PEOPLE[index].name}`, 'chip')
  reply(async (my) => {
    push({ key, kind: 'person', index, typing: true })
    await wait(WRITING)
    if (my === epoch) patch(key, { typing: false, at: Date.now() })
  })
  return true
}

/** A company's logo, sent as a sticker. Niv says what it does and sends where it lives. */
export function sendSticker(name: string) {
  const company = ALL.find((c) => c.name === name)
  if (!company) return
  hold()
  push({ key: id(), kind: 'sticker', company: name })
  reply(async (my) => (await nivSays(my, company.blurb ?? `${company.vertical}.`)) && nivSends(my, { key: id(), kind: 'company', company: name }))
}

/** One of the FAQs, asked from the list of them. */
export function askFaq(index: number) {
  if (!FAQS[index]) return
  hold()
  you(FAQS[index].question, 'chip')
  ask(index)
}

/** Asking after one case study. They are all private: the answer is the same. */
export function askCase(name: string) {
  hold()
  you(`can i see the ${name} case study?`, 'chip')
  about('cases')
}

/** Asking to see something from a drop: Niv sends the picture. */
export function showMedia(index: number) {
  const slot = MEDIA[index]
  if (!slot) return
  hold()
  you(`show me ${slot.drop}`, 'chip')
  reply((my) => nivSends(my, { key: id(), kind: 'media', index }))
}

/** Asking for the one-pager. */
export function sendOnePager() {
  hold()
  you('send me the one-pager', 'chip')
  about('onepager')
}

/** A double tap on a message loves it, or takes that back. */
export const love = (key: string) => convo.set((s) => ({ ...s, loved: s.loved.includes(key) ? s.loved.filter((k) => k !== key) : [...s.loved, key] }))
