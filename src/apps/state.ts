import { createStore, useStore } from '../os/store'
import { chat } from './chat'

// What each app is showing. Kept outside the windows so the menu bar's View
// menu can change it, and so a closed window comes back the way it was left.

// ---- Portfolio (the Finder window) ----

export interface FinderState {
  /** The vertical being shown: an index into VERTICALS, or -1 for all of them. */
  vertical: number
  view: 'icons' | 'list'
  query: string
  /** Where Back and Forward go. */
  trail: number[]
  at: number
  /** The company picked in the list, by name. */
  picked: string | null
}

export const finder = createStore<FinderState>({ vertical: -1, view: 'icons', query: '', trail: [-1], at: 0, picked: null })

export function showVertical(vertical: number) {
  finder.set((s) => {
    if (s.vertical === vertical) return s
    const trail = [...s.trail.slice(0, s.at + 1), vertical]
    return { ...s, vertical, trail, at: trail.length - 1, picked: null }
  })
}

export function stepVertical(by: -1 | 1) {
  finder.set((s) => {
    const at = s.at + by
    if (at < 0 || at >= s.trail.length) return s
    return { ...s, at, vertical: s.trail[at]!, picked: null }
  })
}

export const setFinderView = (view: FinderState['view']) => finder.set((s) => ({ ...s, view }))
export const setFinderQuery = (query: string) => finder.set((s) => ({ ...s, query, picked: null }))
export const pickCompany = (picked: string | null) => finder.set((s) => (s.picked === picked ? s : { ...s, picked }))

// ---- VIP (the photo library) ----

export type MediaFilter = 'all' | 'photo' | 'video'

export interface PhotosState {
  filter: MediaFilter
  /** Only this drop's photos and videos, or every drop. */
  drop: string | null
}

export const photos = createStore<PhotosState>({ filter: 'all', drop: null })

export const setMediaFilter = (filter: MediaFilter) => photos.set((s) => ({ ...s, filter }))
export const setDrop = (drop: string | null) => photos.set((s) => ({ ...s, drop }))

// ---- FAQs (the notes window) ----

export const notes = createStore<{ note: number; query: string }>({ note: 0, query: '' })

export const showNote = (note: number) => notes.set((s) => ({ ...s, note }))
export const setNotesQuery = (query: string) => notes.set((s) => ({ ...s, query }))

// ---- Group chat (the messages window) ----

/** The group conversation, or one person's own, by their index. */
export type Conversation = 'group' | number

export interface Inbox {
  /** The conversation that is showing. */
  open: Conversation
  /** People whose own conversation has been opened: their unread dot is gone. */
  read: number[]
  /** How many replies had landed when the group conversation was last on screen. */
  groupSeen: number
  query: string
  /** A reply to bring into view in the group conversation. */
  jump: number | null
}

export const inbox = createStore<Inbox>({ open: 'group', read: [], groupSeen: 0, query: '', jump: null })

export function openConversation(open: Conversation) {
  inbox.set((s) => {
    const replied = chat.get().replied
    return {
      ...s,
      open,
      jump: null,
      // Leaving the group: remember how far it had got, so later replies read as new
      groupSeen: s.open === 'group' ? replied : s.groupSeen,
      read: typeof open === 'number' && open < replied && !s.read.includes(open) ? [...s.read, open] : s.read,
    }
  })
}

/** Goes to the group conversation and brings one person's reply into view. */
export function showInGroup(index: number) {
  inbox.set((s) => ({ ...s, open: 'group', jump: index }))
}

export const clearJump = () => inbox.set((s) => (s.jump === null ? s : { ...s, jump: null }))
export const setInboxQuery = (query: string) => inbox.set((s) => ({ ...s, query }))

/** Conversations with a reply nobody has opened yet: what the Dock's badge counts. */
export const unreadCount = (replied: number, read: number[]) => replied - read.filter((i) => i < replied).length

/** The same count, kept up to date for whatever shows it. */
export const useUnread = () =>
  unreadCount(
    useStore(chat, (s) => s.replied),
    useStore(inbox, (s) => s.read),
  )
