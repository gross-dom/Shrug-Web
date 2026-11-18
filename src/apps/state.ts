import { createStore, useStore } from '../os/store'
import { chat, keepFor, keptFor } from './chat'

// What each app is showing. Kept outside the windows so the menu bar's View
// menu can change it, and so a closed window comes back the way it was left.

// ---- Searches (Portfolio, FAQs) ----

/** What was looked for, as a search that found nothing says it back: trimmed, and cut short where
 * someone has leant on a key (the whole of it would push what there is to say off the screen). */
export function sought(query: string) {
  const q = query.trim()
  return q.length > 40 ? `${q.slice(0, 40)}…` : q
}

// ---- Portfolio (the Finder window) ----

export interface FinderState {
  /** The vertical being shown: an index into VERTICALS, or -1 for all of them. */
  vertical: number
  view: 'icons' | 'list'
  query: string
  /** Where Back and Forward go. */
  trail: number[]
  at: number
  /** The company picked in the list, by its key. */
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
  /** The photo or video opened large in the window, by its place in MEDIA; null while the grid is showing. */
  look: number | null
}

export const photos = createStore<PhotosState>({ filter: 'all', look: null })

// Changing what the grid shows goes back to the grid
export const setMediaFilter = (filter: MediaFilter) => photos.set((s) => ({ ...s, filter, look: null }))
export const lookAt = (look: number | null) => photos.set((s) => (s.look === look ? s : { ...s, look }))

// ---- FAQs (the notes window) ----

export const notes = createStore<{ note: number; query: string }>({ note: 0, query: '' })

export const showNote = (note: number) => notes.set((s) => ({ ...s, note }))
export const setNotesQuery = (query: string) => notes.set((s) => ({ ...s, query }))

// ---- Group chat (the messages window) ----

/** A conversation: `group` is the group chat (Testimonials), where every reply is; any other is
 * one of the easter eggs, by its id (src/data/eggs.ts). */
export type Conversation = string

export interface Inbox {
  /** The conversation that is showing. */
  open: Conversation
  /** How many replies had come in when the group conversation was last on screen. */
  groupSeen: number
  query: string
  /** A reply to bring into view in the group conversation. */
  jump: number | null
}

/** How much of the group this tab had seen when it was last open: a reload brings the conversation back as far as it
 * had got (src/apps/chat.ts), and what had been seen of it is not new again. */
const seenBefore = () => {
  const seen = keptFor('seen')
  return typeof seen === 'number' && Number.isInteger(seen) && seen > 0 ? seen : 0
}

export const inbox = createStore<Inbox>({ open: 'group', groupSeen: seenBefore(), query: '', jump: null })

export const openConversation = (open: Conversation) => inbox.set((s) => (s.open === open && s.jump === null ? s : { ...s, open, jump: null }))

/** Goes to the group conversation and brings one person's reply into view. */
export function showInGroup(index: number) {
  inbox.set((s) => ({ ...s, open: 'group', jump: index }))
}

export const clearJump = () => inbox.set((s) => (s.jump === null ? s : { ...s, jump: null }))
export const setInboxQuery = (query: string) => inbox.set((s) => ({ ...s, query }))

// What is new, by one rule everywhere: the replies that have come in to the
// group and not been seen there yet. Whatever is showing the group (the
// desktop's window, the phone's screen) says so as each reply lands.

/** The group conversation is on screen: everything in it so far has been seen. */
export function seeGroup() {
  const replied = chat.get().replied
  inbox.set((s) => (s.groupSeen === replied ? s : { ...s, groupSeen: replied }))
}

// Played again from the start, nothing has been seen. Begun with everything
// already said (reduced motion), none of it is news: it is all there to read
chat.subscribe(() => {
  const { replied, whole } = chat.get()
  const seen = inbox.get().groupSeen
  if (replied < seen || (whole && seen < replied)) inbox.set((s) => ({ ...s, groupSeen: replied }))
})

let seenKept = inbox.get().groupSeen
inbox.subscribe(() => {
  const seen = inbox.get().groupSeen
  if (seen === seenKept) return
  seenKept = seen
  keepFor('seen', seen)
})

/** How many replies are new: what the badge on Messages says, in the desktop's Dock and on the phone's icon. */
export function useNewReplies() {
  const replied = useStore(chat, (s) => s.replied)
  const seen = useStore(inbox, (s) => s.groupSeen)
  return Math.max(0, replied - seen)
}
