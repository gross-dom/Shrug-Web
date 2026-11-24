import { SITE } from '../../data/site'
import { createStore } from '../../os/store'

// A message to Shrug, written on the phone: the one conversation in Messages
// that goes somewhere. The compose button starts it, and it can carry files (a
// deck, a one-pager), picked with the browser's own picker.
//
// Where it goes is `SITE.contact.inbox` (src/data/site.ts): an address that
// takes the words and the files as a form. Until there is one, nothing is sent
// anywhere and the message says so, the way Messages says a message has not
// gone. It never says Delivered of something that was not.
//
// What is being written and what was sent are kept for as long as the tab is,
// in the tab's own storage, as the visitor's notes are (notes-store.ts): a
// reload (a phone reloads a page it had put away, by itself) brings the
// conversation back. Words, and the names and sizes of files; not the files,
// which a page cannot keep, nor a file that was only picked and not yet sent.

/** A file picked to go with the message that is being written. */
export interface Picked {
  id: string
  file: File
  /** A picture's own address in the page, to show it small; null for anything else. */
  url: string | null
}

/** A file that went, or tried to, as the conversation shows it. */
export interface SentFile {
  name: string
  size: number
  /** A picture's own address in the page, for as long as the page that picked it lasts: after a reload
   * there is none, and the picture is shown by its name, as any other file is. */
  url: string | null
}

export interface Sent {
  id: string
  /** What it is about, where it was written under a subject (the desktop's compose): "Request a meeting". */
  subject?: string
  /** What the subject's form asked for, as it was filled in: who to meet, a name, an email. */
  details?: Record<string, string>
  text: string
  files: SentFile[]
  state: 'sending' | 'sent' | 'failed'
  /** How much of it has gone, 0 to 1. */
  part: number
  /** Why it did not go: there is nowhere to send it yet, or the sending failed. */
  why: 'closed' | 'failed' | null
  /** When it was sent. */
  at: number
}

/** The most that one message takes. */
export const LIMITS = { files: 10, each: 25 * 1024 * 1024 }

interface Outbox {
  draft: string
  picked: Picked[]
  sent: Sent[]
  /** What was last turned away, to be said once: too many files, one too large. It is taken back by
   * itself a few seconds on (`saidBriefly`). */
  refused: string | null
}

// ---- Kept for the tab ----

/** Where the conversation is kept: the tab's own storage, which goes when the tab does. */
const KEPT = 'shrug:outbox'

const isText = (value: unknown): value is string => typeof value === 'string'

/** A message as it comes back after a reload. One that had gone is as it was. One that had not, or was
 * still on its way when the page went (nothing can be known of how that ended), has not gone: with
 * nowhere to send it that is the whole of the reason, as it was before. Its pictures are files by now. */
function back(was: unknown): Sent | null {
  const m = was as Partial<Sent> | null
  if (!m || !isText(m.id) || !isText(m.text) || !Array.isArray(m.files)) return null
  const files = m.files.filter((f): f is SentFile => !!f && isText(f.name) && typeof f.size === 'number').map((f) => ({ name: f.name, size: f.size, url: null }))
  if (!m.text && !files.length) return null
  const at = typeof m.at === 'number' ? m.at : Date.now()
  const about = { ...(isText(m.subject) ? { subject: m.subject } : null), ...(m.details && typeof m.details === 'object' ? { details: m.details } : null) }
  if (m.state === 'sent') return { id: m.id, ...about, text: m.text, files, state: 'sent', part: 1, why: null, at }
  return { id: m.id, ...about, text: m.text, files, state: 'failed', part: 0, why: SITE.contact.inbox ? 'failed' : 'closed', at }
}

/** What was kept the last time this tab had the page, or nothing: a first visit, or a page that is
 * refused storage (a frame without leave to keep anything), or something in it that is not a conversation. */
function kept(): Pick<Outbox, 'draft' | 'sent'> {
  try {
    const was = JSON.parse(window.sessionStorage.getItem(KEPT) ?? 'null') as { draft?: unknown; sent?: unknown } | null
    if (!was || !Array.isArray(was.sent)) return { draft: '', sent: [] }
    return { draft: isText(was.draft) ? was.draft : '', sent: was.sent.map(back).filter((m): m is Sent => m !== null) }
  } catch {
    return { draft: '', sent: [] }
  }
}

export const outbox = createStore<Outbox>({ ...kept(), picked: [], refused: null })

/** What is kept of the conversation, as it is written to the tab's storage. */
const keeping = (s: Outbox) => JSON.stringify({ draft: s.draft, sent: s.sent.map(({ id, subject, details, text, files, state, at }) => ({ id, subject, details, text, files: files.map(({ name, size }) => ({ name, size })), state, at })) })

// Every change is kept as it is made (how much of a file has gone is no change to what is kept, and is
// not written). A page that may not keep anything carries on without
let last = keeping(outbox.get())
outbox.subscribe(() => {
  const now = keeping(outbox.get())
  if (now === last) return
  last = now
  try {
    window.sessionStorage.setItem(KEPT, now)
  } catch {
    // Refused, or full: the conversation lasts as long as the page does, as it always did
  }
})

/** The files of each message, held while the page is open so that one that failed can be tried again. */
const held = new Map<string, File[]>()

/** How many things have been numbered: the number in the newest id. It carries on from what was kept. */
let count = outbox.get().sent.reduce((most, { id }) => Math.max(most, Number(id.replace(/^out-/, '')) || 0), 0)

export const setDraft = (draft: string) => outbox.set((s) => (s.draft === draft ? s : { ...s, draft }))

// ---- What is turned away ----

/** How long what was turned away is said for. */
const SAID_FOR = 4000
let unsaying: ReturnType<typeof setTimeout> | undefined

/** What was turned away is news, not a state the message is left in: it is said for a few seconds and
 * then taken back, unless something else has been said (or it has been taken back) by then. */
function saidBriefly() {
  clearTimeout(unsaying)
  const said = outbox.get().refused
  if (said) unsaying = setTimeout(() => outbox.set((s) => (s.refused === said ? { ...s, refused: null } : s)), SAID_FOR)
}

// ---- Files ----

const isPicture = (file: File) => file.type.startsWith('image/') && !/svg/.test(file.type)

/** Adds files to the message being written, up to the most it takes. */
export function pick(files: File[]) {
  outbox.set((s) => {
    const room = LIMITS.files - s.picked.length
    const fits = files.filter((file) => file.size <= LIMITS.each)
    const taken = fits.slice(0, Math.max(0, room))
    const refused = fits.length < files.length ? 'A file over 25 MB was left out.' : taken.length < fits.length ? `A message takes ${LIMITS.files} files at most.` : null
    return { ...s, refused, picked: [...s.picked, ...taken.map((file) => ({ id: `pick-${++count}`, file, url: isPicture(file) ? URL.createObjectURL(file) : null }))] }
  })
  saidBriefly()
}

export function unpick(id: string) {
  outbox.set((s) => {
    const gone = s.picked.find((p) => p.id === id)
    if (gone?.url) URL.revokeObjectURL(gone.url)
    return { ...s, refused: null, picked: s.picked.filter((p) => p.id !== id) }
  })
}

// ---- Sending ----

const patch = (id: string, change: Partial<Sent>) => outbox.set((s) => ({ ...s, sent: s.sent.map((m) => (m.id === id ? { ...m, ...change } : m)) }))

function deliver(id: string, text: string, files: File[], about: Pick<Sent, 'subject' | 'details'> = {}) {
  const inbox = SITE.contact.inbox
  if (!inbox) {
    // Nowhere to send it yet. It is said so after a moment, as a message that will not go is
    setTimeout(() => patch(id, { state: 'failed', why: 'closed' }), 900)
    return
  }
  const body = new FormData()
  body.append('text', text)
  if (about.subject) body.append('subject', about.subject)
  for (const [name, value] of Object.entries(about.details ?? {})) body.append(name, value)
  for (const file of files) body.append('files', file, file.name)
  const request = new XMLHttpRequest()
  request.open('POST', inbox)
  request.upload.onprogress = (e) => {
    if (e.lengthComputable) patch(id, { part: e.loaded / e.total })
  }
  request.onload = () => patch(id, request.status >= 200 && request.status < 300 ? { state: 'sent', part: 1 } : { state: 'failed', why: 'failed' })
  request.onerror = request.ontimeout = () => patch(id, { state: 'failed', why: 'failed' })
  request.send(body)
}

/** Sends what has been written and picked. `about` is its subject and what the subject's form asked for, where it has one. */
export function sendToShrug(about: Pick<Sent, 'subject' | 'details'> = {}) {
  const { draft, picked } = outbox.get()
  const text = draft.trim()
  if (!text && !picked.length) return
  const id = `out-${++count}`
  const files = picked.map((p) => p.file)
  held.set(id, files)
  outbox.set((s) => ({ ...s, draft: '', picked: [], refused: null, sent: [...s.sent, { id, ...about, text, files: picked.map((p) => ({ name: p.file.name, size: p.file.size, url: p.url })), state: 'sending', part: 0, why: null, at: Date.now() }] }))
  deliver(id, text, files, about)
}

/** Tries a message that did not go again. One whose files went with the page it was written on (a
 * reload keeps their names and no more) cannot go again as it was, and is not sent without them as if
 * it could: that is said, and the files are there to be picked again. */
export function resend(id: string) {
  const message = outbox.get().sent.find((m) => m.id === id)
  if (!message || message.state !== 'failed') return
  const files = held.get(id)
  if (message.files.length && !files) {
    outbox.set((s) => ({ ...s, refused: 'Those files are no longer here. Add them again to send them.' }))
    return saidBriefly()
  }
  patch(id, { state: 'sending', part: 0, why: null })
  deliver(id, message.text, files ?? [], { subject: message.subject, details: message.details })
}

/** A file's size as Files gives it: 840 KB, 3.2 MB. */
export function sizeOf(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  const mb = bytes / (1024 * 1024)
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}
