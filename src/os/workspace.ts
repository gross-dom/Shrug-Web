import { createStore } from './store'

// The color picked in Workspace. The Workspace icon in the Dock turns that color, and stays that way on the
// next visit (design/v1-workspace, WS-Dock): it is kept in this browser.

export interface Picked {
  /** The paint's id, or "own" for a color of the visitor's own. */
  id: string
  color: string
  /** The colors a color-shifting paint moves through. */
  shift?: string[]
  /** For a color of their own: what they typed, so that it is there when they come back. */
  typed?: string
}

const KEPT = 'shrug:workspace.v1'

function kept(): Picked | null {
  try {
    const was = JSON.parse(window.localStorage.getItem(KEPT) ?? 'null') as Picked | null
    return was && typeof was.id === 'string' && /^#[0-9a-f]{6}$/i.test(was.color) ? was : null
  } catch {
    return null
  }
}

export const picked = createStore<Picked | null>(typeof window === 'undefined' ? null : kept())

export function pick(next: Picked | null) {
  picked.set(next)
  try {
    if (next) window.localStorage.setItem(KEPT, JSON.stringify(next))
    else window.localStorage.removeItem(KEPT)
  } catch {
    // No storage: the color is kept for as long as the page is open
  }
}

// The colors on the studio's bar beyond the eight it opens with: one of the sixteen more that has been picked
// is added to the bar (Dom's fourth round: the bar grows by one, and the picker is still at its end). For this
// visit only: the studio opens on the eight every time the site is loaded (Dom, 27 Nov: it was kept in the
// browser, and a bar that had been added to on other days opened with too many on it).

const BAR = 'shrug:workspace.bar.v1'
try {
  // (what an earlier version of the site kept there)
  if (typeof window !== 'undefined') window.localStorage.removeItem(BAR)
} catch {
  // No storage: there is nothing kept to clear
}

/** The ids of the colors added to the bar, in the order they were picked. */
export const onBar = createStore<string[]>([])

export function addToBar(id: string) {
  if (onBar.get().includes(id)) return
  onBar.set((was) => [...was, id])
}
