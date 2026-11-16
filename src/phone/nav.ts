import type { AppId } from '../os/apps'
import { createStore } from '../os/store'

// Where the phone is: the conversation, or something opened out of it, with at
// most one sheet over that. Opening a thing is a step in the browser's history
// and closing it is the step back, so the phone's own back gesture or button
// closes whatever is open. Moves made here are drawn with motion; moves the
// browser makes (its back and forward) are drawn at once, because Safari has
// already slid the page across itself.

/** What a phone can have open: the conversation is `messages`; the others open out of it. */
export type PhoneApp = Exclude<AppId, 'about'>

export const PHONE_APPS: PhoneApp[] = ['messages', 'finder', 'notes', 'terminal', 'photos']

export interface Place {
  /** What is open over the conversation, or null when it is the conversation itself. */
  app: PhoneApp | null
  /** The sheet over it: `details`, `company:Anduril`, `request`. */
  sheet: string | null
}

export interface PhoneNav extends Place {
  /** The app on its way out, kept drawn until it has gone. */
  leaving: PhoneApp | null
  /** The sheet on its way out. */
  closing: string | null
  /** Whether the last move is drawn with motion. */
  motion: boolean
}

export const phone = createStore<PhoneNav>({ app: null, sheet: null, leaving: null, closing: null, motion: false })

interface Entry {
  shrug: Place
  /** How many steps into the site this entry is: 0 is the one it arrived on. */
  n: number
}

const isApp = (value: unknown): value is PhoneApp => (PHONE_APPS as unknown[]).includes(value)

function read(state: unknown): Entry | null {
  const entry = state as Partial<Entry> | null
  const place = entry?.shrug as Partial<Place> | undefined
  if (!place || typeof place !== 'object') return null
  const app = isApp(place.app) ? place.app : null
  return { shrug: { app, sheet: typeof place.sheet === 'string' ? place.sheet : null }, n: typeof entry?.n === 'number' ? entry.n : 0 }
}

const here = () => read(history.state) ?? { shrug: { app: null, sheet: null }, n: 0 }

/** Whether the next move the browser reports is one asked for here, and so drawn with motion. */
let expected: boolean | null = null

let appTimer: ReturnType<typeof setTimeout> | undefined
let sheetTimer: ReturnType<typeof setTimeout> | undefined

function apply(place: Place, motion: boolean) {
  const was = phone.get()
  const leaving = motion && was.app && was.app !== place.app ? was.app : null
  const closing = motion && was.sheet && was.sheet !== place.sheet && was.app === place.app ? was.sheet : null
  phone.set({ app: place.app, sheet: place.sheet, leaving, closing, motion })
  clearTimeout(appTimer)
  clearTimeout(sheetTimer)
  if (leaving) appTimer = setTimeout(() => phone.set((s) => (s.leaving ? { ...s, leaving: null } : s)), 460)
  if (closing) sheetTimer = setTimeout(() => phone.set((s) => (s.closing ? { ...s, closing: null } : s)), 420)
}

/** A move the visitor made: a new step in history. */
function go(place: Place) {
  const now = phone.get()
  if (now.app === place.app && now.sheet === place.sheet) return
  history.pushState({ shrug: place, n: here().n + 1 } satisfies Entry, '')
  apply(place, true)
}

/** Opens something out of the conversation. */
export const openApp = (app: PhoneApp) => go({ app: app === 'messages' ? null : app, sheet: null })

/** Closes what is open: a step back to the conversation, since opening it was a step forward. */
export function closeApp() {
  const now = phone.get()
  if (!now.app) return
  const entry = here()
  if (entry.n > 0) {
    expected = true
    history.back()
    return
  }
  // Arrived straight onto it (a restored tab): there is nothing to step back to
  history.replaceState({ shrug: { app: null, sheet: null }, n: entry.n } satisfies Entry, '')
  apply({ app: null, sheet: null }, true)
}

/** Brings a sheet up over whatever is open. */
export const openSheet = (sheet: string) => go({ app: phone.get().app, sheet })

/** Closes the sheet: a step back, since opening it was a step forward. `motion`
 * is false when the sheet has already been dragged away by hand. */
export function closeSheet(motion = true) {
  const now = phone.get()
  if (!now.sheet) return
  const entry = here()
  if (entry.n > 0 && entry.shrug.sheet) {
    expected = motion
    history.back()
    return
  }
  // Arrived straight onto a sheet (a restored tab): there is nothing to step back to
  history.replaceState({ shrug: { app: now.app, sheet: null }, n: entry.n } satisfies Entry, '')
  apply({ app: now.app, sheet: null }, motion)
}

let resumed: boolean | null = null

/** Sets the phone up when the page loads: where a reload left it, or where the
 * visit starts. Returns true if it picked up from a reload. */
export function startNav(): boolean {
  // Once a page load, however many times it is asked
  if (resumed !== null) return resumed
  const entry = read(history.state)
  resumed = !!entry
  if (entry) apply(entry.shrug, false)
  else history.replaceState({ shrug: { app: null, sheet: null }, n: 0 } satisfies Entry, '')
  return resumed
}

/** A link that names a window (`?open=portfolio`) arrives with it open. Nobody
 * tapped anything, so it takes the place of the entry the visit began on
 * instead of adding one: a browser's back button skips steps a page adds on
 * its own. */
export function arriveIn(app: PhoneApp) {
  if (app === 'messages') return
  history.replaceState({ shrug: { app, sheet: null }, n: here().n } satisfies Entry, '')
  apply({ app, sheet: null }, true)
}

/** Follows the browser's history. */
export function watchHistory() {
  const onPop = (e: PopStateEvent) => {
    const motion = expected ?? false
    expected = null
    apply(read(e.state)?.shrug ?? { app: null, sheet: null }, motion)
  }
  window.addEventListener('popstate', onPop)
  return () => window.removeEventListener('popstate', onPop)
}
