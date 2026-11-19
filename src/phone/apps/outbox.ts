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
  url: string | null
}

export interface Sent {
  id: string
  text: string
  files: SentFile[]
  state: 'sending' | 'sent' | 'failed'
  /** How much of it has gone, 0 to 1. */
  part: number
  /** Why it did not go: there is nowhere to send it yet, or the sending failed. */
  why: 'closed' | 'failed' | null
}

/** The most that one message takes. */
export const LIMITS = { files: 10, each: 25 * 1024 * 1024 }

interface Outbox {
  draft: string
  picked: Picked[]
  sent: Sent[]
  /** What was last turned away, to be said once: too many files, one too large. */
  refused: string | null
}

export const outbox = createStore<Outbox>({ draft: '', picked: [], sent: [], refused: null })

/** The files of each message, kept while the page is open so that one that failed can be tried again. */
const kept = new Map<string, File[]>()
let count = 0

export const setDraft = (draft: string) => outbox.set((s) => (s.draft === draft ? s : { ...s, draft }))

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
}

export function unpick(id: string) {
  outbox.set((s) => {
    const gone = s.picked.find((p) => p.id === id)
    if (gone?.url) URL.revokeObjectURL(gone.url)
    return { ...s, refused: null, picked: s.picked.filter((p) => p.id !== id) }
  })
}

const patch = (id: string, change: Partial<Sent>) => outbox.set((s) => ({ ...s, sent: s.sent.map((m) => (m.id === id ? { ...m, ...change } : m)) }))

function deliver(id: string, text: string, files: File[]) {
  const inbox = SITE.contact.inbox
  if (!inbox) {
    // Nowhere to send it yet. It is said so after a moment, as a message that will not go is
    setTimeout(() => patch(id, { state: 'failed', why: 'closed' }), 900)
    return
  }
  const body = new FormData()
  body.append('text', text)
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

/** Sends what has been written and picked. */
export function sendToShrug() {
  const { draft, picked } = outbox.get()
  const text = draft.trim()
  if (!text && !picked.length) return
  const id = `out-${++count}`
  const files = picked.map((p) => p.file)
  kept.set(id, files)
  outbox.set((s) => ({ ...s, draft: '', picked: [], refused: null, sent: [...s.sent, { id, text, files: picked.map((p) => ({ name: p.file.name, size: p.file.size, url: p.url })), state: 'sending', part: 0, why: null }] }))
  deliver(id, text, files)
}

/** Tries a message that did not go again. */
export function resend(id: string) {
  const message = outbox.get().sent.find((m) => m.id === id)
  if (!message || message.state !== 'failed') return
  patch(id, { state: 'sending', part: 0, why: null })
  deliver(id, message.text, kept.get(id) ?? [])
}

/** A file's size as Files gives it: 840 KB, 3.2 MB. */
export function sizeOf(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  const mb = bytes / (1024 * 1024)
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}
