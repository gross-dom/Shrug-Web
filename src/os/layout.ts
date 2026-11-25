import { account } from './account'
import type { AppId } from './apps'
import { DOCK } from './held'
import { createStore } from './store'

// Where the icons are: which apps are in the Dock and in what order, which are out on the desk, and where on
// the desk each has been put. An icon can be dragged about the desk; an app's icon can be dragged from the
// desk into the Dock, along the Dock, and out of the Dock onto the desk (Surface.tsx and Dock.tsx do the
// dragging; this is what they change).
//
// It is kept for whoever is logged in, so that their desk is as they left it the next time: in this browser,
// under their account. Someone who is not logged in can move things too, for as long as the page is open;
// logging in keeps what they have arranged if their account has nothing kept yet. (Kept in the browser, it
// does not follow them to another device: that needs a place on their member's row, which is Shrug's to add.)
//
// Only the desktop reads this: a phone has neither a desk nor a Dock of this kind.

/** What is on the desk as it comes: files and folders (which stay on the desk), then the apps that live there. */
export const DESK_FILES = ['updates', 'one-pager', 'wallpapers'] as const
export const DESK_APPS: AppId[] = ['quicktime', 'photobooth', 'spotify', 'youtube']
/** The one Dock icon that stays where it is, as the Finder's does on a Mac. */
export const FIXED: AppId = 'finder'

/** Where an icon has been put on the desk: how far its right edge is from the screen's, and its top from the screen's. */
export interface Spot {
  r: number
  t: number
}

export interface Layout {
  /** The apps in the Dock, in order. */
  dock: AppId[]
  /** What is out on the desk, in the order it was put there. Something with no spot of its own is in the line down the right. */
  desk: string[]
  at: Record<string, Spot>
}

const fresh = (): Layout => ({ dock: [...DOCK], desk: [...DESK_FILES, ...DESK_APPS], at: {} })

/** A layout that was kept, made good: nothing in it that is not here any more, and nothing here left out of it. */
function sound(kept: Partial<Layout> | null): Layout {
  const base = fresh()
  if (!kept || !Array.isArray(kept.dock) || !Array.isArray(kept.desk)) return base
  const apps = new Set<string>([...base.dock, ...DESK_APPS])
  const dock = kept.dock.filter((id, i, all) => apps.has(id) && all.indexOf(id) === i)
  const desk = kept.desk.filter((id, i, all) => (apps.has(id) || (DESK_FILES as readonly string[]).includes(id)) && all.indexOf(id) === i && !dock.includes(id as AppId))
  // Whatever is new since it was kept goes where it comes: a Dock app to the Dock's end, the rest to the desk
  for (const id of base.dock) if (!dock.includes(id) && !desk.includes(id)) dock.push(id)
  for (const id of base.desk) if (!desk.includes(id) && !dock.includes(id as AppId)) desk.push(id)
  if (!dock.includes(FIXED)) dock.unshift(FIXED)
  const at: Record<string, Spot> = {}
  for (const id of desk) {
    const spot = kept.at?.[id]
    if (spot && Number.isFinite(spot.r) && Number.isFinite(spot.t)) at[id] = { r: spot.r, t: spot.t }
  }
  return { dock, desk: desk.filter((id) => id !== FIXED), at }
}

const KEY = (email: string) => `shrug:layout.v1:${email.toLowerCase()}`
function read(email: string): Layout | null {
  try {
    const kept = window.localStorage.getItem(KEY(email))
    return kept ? sound(JSON.parse(kept) as Partial<Layout>) : null
  } catch {
    return null
  }
}

export const layout = createStore<Layout>(fresh())

/** Whose layout this is: the address of whoever is logged in, or nobody. */
let whose: string | null = null
let touched = false

function change(next: Layout) {
  touched = true
  layout.set(next)
  if (!whose) return
  try {
    window.localStorage.setItem(KEY(whose), JSON.stringify(next))
  } catch {
    // No storage: it is as they left it for as long as the page is open
  }
}

// Whoever logs in gets their desk as they left it; whoever logs out leaves a desk as it comes
if (typeof window !== 'undefined')
  account.subscribe(() => {
    const now = account.get()
    if (now.status === 'checking') return
    const email = now.status === 'member' ? now.email : null
    if (email === whose) return
    whose = email
    if (!email) {
      touched = false
      return layout.set(fresh())
    }
    const kept = read(email)
    if (kept) layout.set(kept)
    // Nothing kept for them yet: what they arranged before logging in is theirs from now on
    else if (touched) change(layout.get())
  })

/** Puts something on the desk where it was dropped. */
export function placeOnDesk(id: string, spot: Spot) {
  const now = layout.get()
  change({ dock: now.dock.filter((app) => app !== id), desk: now.desk.includes(id) ? now.desk : [...now.desk, id], at: { ...now.at, [id]: spot } })
}

/** Moves an app into the Dock, before the icon that is at `index` there now. */
export function toDock(id: AppId, index: number) {
  const now = layout.get()
  if (id === FIXED) return
  const dock = now.dock.filter((app) => app !== id)
  // (never before the icon that stays put)
  dock.splice(Math.max(dock[0] === FIXED ? 1 : 0, Math.min(dock.length, index)), 0, id)
  const at = { ...now.at }
  delete at[id]
  change({ dock, desk: now.desk.filter((item) => item !== id), at })
}

/** Takes an app out of the Dock (its menu's Remove from Dock): it is on the desk, at the end of the line down the right. */
export function offDock(id: AppId) {
  const now = layout.get()
  if (id === FIXED || !now.dock.includes(id)) return
  const at = { ...now.at }
  delete at[id]
  change({ dock: now.dock.filter((app) => app !== id), desk: [...now.desk.filter((item) => item !== id), id], at })
}

/** Everything back where it comes. */
export function resetLayout() {
  change(fresh())
}

/** Whether something may go into the Dock: an app may; a file or a folder stays on the desk. */
export const dockable = (id: string): id is AppId => !(DESK_FILES as readonly string[]).includes(id)
