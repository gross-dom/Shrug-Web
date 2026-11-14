import { createStore } from '../os/store'

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
