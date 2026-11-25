import { EXCHANGES } from '../data/mail'
import { createStore } from './store'

// Mail's own state, kept where the desk can reach it.
//
// Which conversation is open is part of where the desk is: its address says it (`?open=mail&at=<id>`,
// src/os/crossing.ts), which is what Share hands on, and a link that names one opens Mail on it.
//
// What a visitor has done to the twenty (marked done, starred, marked unread) is theirs and nobody else's:
// it is kept in their browser, and changes nothing for anyone. The emails themselves cannot be changed.

export interface MailState {
  /** The conversation that is open, by its id; none, in the list. */
  open: string | null
  /** Marked done: out of the inbox, and under Done. */
  done: string[]
  starred: string[]
  unread: string[]
}

const KEPT = 'shrug:mail.v1'
const known = (ids: unknown): string[] => (Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && EXCHANGES.some((x) => x.id === id)) : [])

function kept(): Pick<MailState, 'done' | 'starred' | 'unread'> {
  try {
    const was = JSON.parse(window.localStorage.getItem(KEPT) ?? 'null') as Partial<MailState> | null
    return { done: known(was?.done), starred: known(was?.starred), unread: known(was?.unread) }
  } catch {
    return { done: [], starred: [], unread: [] }
  }
}

export const mail = createStore<MailState>({ open: null, ...(typeof window === 'undefined' ? { done: [], starred: [], unread: [] } : kept()) })

function keep() {
  const { done, starred, unread } = mail.get()
  try {
    window.localStorage.setItem(KEPT, JSON.stringify({ done, starred, unread }))
  } catch {
    // No storage: kept for as long as the page is open
  }
}

/** Opens a conversation (or, with null, goes back to the list). Opened, it is read. */
export function openExchange(id: string | null) {
  mail.set((s) => ({ ...s, open: id && EXCHANGES.some((x) => x.id === id) ? id : null, unread: id ? s.unread.filter((u) => u !== id) : s.unread }))
  if (id) keep()
}

/** The conversation an address names, or none. */
export const exchangeAt = (at: string | null) => (at && EXCHANGES.some((x) => x.id === at.toLowerCase()) ? at.toLowerCase() : null)

const toggled = (list: string[], id: string, on: boolean) => (on ? [...list.filter((x) => x !== id), id] : list.filter((x) => x !== id))

export function markDone(id: string, on = true) {
  mail.set((s) => ({ ...s, done: toggled(s.done, id, on) }))
  keep()
}
export function star(id: string, on: boolean) {
  mail.set((s) => ({ ...s, starred: toggled(s.starred, id, on) }))
  keep()
}
export function markUnread(id: string, on = true) {
  mail.set((s) => ({ ...s, unread: toggled(s.unread, id, on) }))
  keep()
}
