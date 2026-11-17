import type { AppId } from '../os/apps'
import { createStore } from '../os/store'
import { FAQS_FOLDER, PORTFOLIO_FOLDER } from './apps/routes'

// The phone as a system: whether it is locked, which app is in front, how far
// into each app the visitor has gone, and the sheet over it. An iPhone keeps
// every app as it was left, so each app's place is kept while another is in
// front.
//
// Every move is a step in the browser's history, so the browser's own back
// (Safari's swipe from the left edge, an Android back button) is the phone's
// back. Moves made here are drawn with motion; moves the browser makes are
// drawn at once, because the browser has already slid the page across itself.

/** The apps on the phone are the desktop's windows, each redrawn as its iPhone counterpart. */
export type PhoneApp = AppId

export const PHONE_APPS: PhoneApp[] = ['messages', 'finder', 'notes', 'terminal', 'photos', 'about']

export interface Place {
  /** The app in front, or null on the Home Screen. */
  app: PhoneApp | null
  /** What each app has open beyond its first screen, innermost last: `['c:group']`, `['f:2', 'c:Anduril']`. */
  stacks: Record<PhoneApp, string[]>
  /** The sheet over the app in front: `details`, `request`. On the Home Screen (no app), the folder that is open: `folder:portfolio`. */
  sheet: string | null
}

export interface Sys extends Place {
  locked: boolean
  /** The apps that are open, the most recently used first. */
  recents: PhoneApp[]
  /** The App Switcher is showing. */
  switcher: boolean
  /** Search is showing over the Home Screen. */
  spotlight: boolean
  /** Whether the last move is drawn with motion. */
  motion: boolean
  /** The app that was in front before the last move, or null if it was the Home Screen. */
  prev: PhoneApp | null
  /** What the app in front opened out of: the name of an element marked
   * `data-origin`, so that it grows out of that and goes back into it. With
   * none, an app opens out of its own icon. */
  origin: string | null
}

/** Where each app is when it is first opened. An iPhone's apps come back to
 * where they were last used: Files inside the Portfolio folder and Notes inside
 * FAQs, each a step in from its first screen, with the way back out showing. */
const noStacks = (): Record<PhoneApp, string[]> => ({ messages: [], finder: [PORTFOLIO_FOLDER], notes: [FAQS_FOLDER], terminal: [], photos: [], about: [] })

export const sys = createStore<Sys>({ app: null, stacks: noStacks(), sheet: null, locked: true, recents: [], switcher: false, spotlight: false, motion: false, prev: null, origin: null })

// ---- History ----

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
  const stacks = noStacks()
  for (const id of PHONE_APPS) {
    const stack = (place.stacks as Partial<Record<PhoneApp, unknown>> | undefined)?.[id]
    if (Array.isArray(stack)) stacks[id] = stack.filter((view): view is string => typeof view === 'string')
  }
  return { shrug: { app: isApp(place.app) ? place.app : null, stacks, sheet: typeof place.sheet === 'string' ? place.sheet : null }, n: typeof entry?.n === 'number' ? entry.n : 0 }
}

const placeOf = (s: Place): Place => ({ app: s.app, stacks: s.stacks, sheet: s.sheet })

const same = (a: Place, b: Place) => a.app === b.app && a.sheet === b.sheet && PHONE_APPS.every((id) => a.stacks[id].join('\n') === b.stacks[id].join('\n'))

const here = (): Entry => read(history.state) ?? { shrug: placeOf(sys.get()), n: 0 }

/** The steps taken since the page loaded, by their number: what a step back would land on. */
const steps = new Map<number, Place>()

/** Whether the next move the browser reports was asked for here, and so is drawn with motion. */
let expected: boolean | null = null
let overdue: ReturnType<typeof setTimeout> | undefined

function apply(place: Place, motion: boolean, origin: string | null = null) {
  sys.set((s) => ({
    ...s,
    ...place,
    motion,
    prev: s.app,
    // What an app opened out of matters while it is opening; one already in front keeps its own
    origin: !place.app ? null : place.app === s.app ? s.origin : origin,
    recents: place.app ? [place.app, ...s.recents.filter((id) => id !== place.app)] : s.recents,
    switcher: false,
    spotlight: false,
  }))
}

/** A move the visitor made: a new step in history. */
function go(place: Place, origin: string | null = null) {
  if (same(placeOf(sys.get()), place)) return
  const n = here().n + 1
  history.pushState({ shrug: place, n } satisfies Entry, '')
  steps.set(n, place)
  apply(place, true, origin)
}

/** A move that undoes the last one. Where the step before is the place it
 * leads to, it is a step back; otherwise it is one more step forward. */
function back(place: Place, motion = true) {
  if (same(placeOf(sys.get()), place)) return
  const entry = here()
  const before = steps.get(entry.n - 1)
  if (entry.n > 0 && before && same(before, place)) {
    expected = motion
    history.back()
    // A page held inside another (a preview) may never hear its own step back
    clearTimeout(overdue)
    overdue = setTimeout(() => {
      if (expected === null) return
      expected = null
      history.replaceState({ shrug: place, n: entry.n } satisfies Entry, '')
      steps.set(entry.n, place)
      apply(place, motion)
    }, 400)
    return
  }
  const n = entry.n + 1
  history.pushState({ shrug: place, n } satisfies Entry, '')
  steps.set(n, place)
  apply(place, motion)
}

/** Rewrites the step the phone is on, without taking one. */
function amend(place: Place) {
  const n = here().n
  history.replaceState({ shrug: place, n } satisfies Entry, '')
  steps.set(n, place)
}

// ---- Apps ----

/** Brings an app to the front, as it was left. `origin` names the element it grows out of, when that isn't its icon. */
export function launch(app: PhoneApp, origin: string | null = null) {
  const s = sys.get()
  if (s.locked) sys.set((now) => ({ ...now, locked: false }))
  if (s.app === app && !s.sheet) return sys.set((now) => (now.switcher || now.spotlight ? { ...now, switcher: false, spotlight: false, motion: true } : now))
  go({ app, stacks: s.stacks, sheet: null }, origin)
}

/** Brings an app to the front at a place inside it: a notification opens its
 * conversation. `sheet` is a sheet to have up over that place. */
export function launchAt(app: PhoneApp, stack: string[], origin: string | null = null, sheet: string | null = null) {
  const s = sys.get()
  if (s.locked) sys.set((now) => ({ ...now, locked: false }))
  go({ app, stacks: { ...s.stacks, [app]: stack }, sheet }, origin)
}

/** Back to the Home Screen. The app stays as it is. */
export function goHome() {
  const s = sys.get()
  // Already there, with a folder open over it: the folder closes
  if (!s.app && s.sheet) return closeSheet()
  if (!s.app) return sys.set((now) => (now.switcher || now.spotlight ? { ...now, switcher: false, spotlight: false, motion: true } : now))
  back({ app: null, stacks: s.stacks, sheet: null })
}

/** Closes an app for good, as flicking it out of the App Switcher does: it starts over next time. */
export function quit(app: PhoneApp) {
  const s = sys.get()
  const place: Place = { app: s.app === app ? null : s.app, stacks: { ...s.stacks, [app]: noStacks()[app] }, sheet: s.app === app ? null : s.sheet }
  amend(place)
  sys.set((now) => ({ ...now, ...place, recents: now.recents.filter((id) => id !== app), switcher: now.switcher && now.recents.length > 1 }))
}

// ---- Inside an app ----

/** Goes a screen deeper in the app in front. */
export function push(view: string) {
  const s = sys.get()
  if (!s.app) return
  go({ app: s.app, stacks: { ...s.stacks, [s.app]: [...s.stacks[s.app], view] }, sheet: null })
}

/** Back a screen in the app in front. */
export function pop() {
  const s = sys.get()
  if (!s.app || !s.stacks[s.app].length) return
  back({ app: s.app, stacks: { ...s.stacks, [s.app]: s.stacks[s.app].slice(0, -1) }, sheet: null })
}

/** Swaps the screen the app in front is on for another, at the same depth. */
export function swap(view: string) {
  const s = sys.get()
  if (!s.app || !s.stacks[s.app].length) return
  const place: Place = { app: s.app, stacks: { ...s.stacks, [s.app]: [...s.stacks[s.app].slice(0, -1), view] }, sheet: s.sheet }
  amend(place)
  sys.set((now) => ({ ...now, ...place, motion: false }))
}

/** Brings a sheet up over the app in front. */
export function openSheet(sheet: string) {
  const s = sys.get()
  go({ app: s.app, stacks: s.stacks, sheet })
}

/** Closes the sheet. `motion` is false when it has already been dragged away by hand. */
export function closeSheet(motion = true) {
  const s = sys.get()
  if (!s.sheet) return
  back({ app: s.app, stacks: s.stacks, sheet: null }, motion)
}

// ---- The lock, the switcher, search ----

export const lock = () => sys.set((s) => ({ ...s, locked: true, switcher: false, spotlight: false, motion: true }))
export const unlock = () => sys.set((s) => (s.locked ? { ...s, locked: false, motion: true } : s))
export const showSwitcher = (on: boolean) => sys.set((s) => (s.switcher === on || (on && !s.recents.length) ? s : { ...s, switcher: on, spotlight: false, motion: true }))
export const showSpotlight = (on: boolean) => sys.set((s) => (s.spotlight === on ? s : { ...s, spotlight: on, switcher: false, motion: true }))

// ---- Start-up ----

let resumed: boolean | null = null

/** Sets the phone up when the page loads: where a reload left it (unlocked),
 * or locked at the start of a visit. Returns true if it picked up from a reload. */
export function startSystem(): boolean {
  // Once a page load, however many times it is asked
  if (resumed !== null) return resumed
  const entry = read(history.state)
  resumed = !!entry
  if (entry) {
    steps.set(entry.n, entry.shrug)
    apply(entry.shrug, false)
    sys.set((s) => ({ ...s, locked: false }))
  } else amend(placeOf(sys.get()))
  return resumed
}

/** A link that names an app (`?open=portfolio`) arrives with it open and the
 * phone unlocked. Nobody tapped anything, so it takes the place of the step
 * the visit began on instead of adding one. */
export function arriveIn(app: PhoneApp) {
  const place: Place = { app, stacks: sys.get().stacks, sheet: null }
  amend(place)
  apply(place, false)
  sys.set((s) => ({ ...s, locked: false }))
}

/** Follows the browser's history. */
export function watchHistory() {
  const onPop = (e: PopStateEvent) => {
    const motion = expected ?? false
    expected = null
    clearTimeout(overdue)
    const entry = read(e.state)
    if (entry) steps.set(entry.n, entry.shrug)
    apply(entry?.shrug ?? { app: null, stacks: sys.get().stacks, sheet: null }, motion)
  }
  window.addEventListener('popstate', onPop)
  return () => window.removeEventListener('popstate', onPop)
}

// ---- Reading it ----

/** The screen an app is on: the innermost view of its stack, or null on its first screen. */
export const topOf = (s: Sys, app: PhoneApp) => s.stacks[app][s.stacks[app].length - 1] ?? null
