import type { AppId } from '../os/apps'
import { focusFirst, holdFocus } from '../os/focus'
import { createStore } from '../os/store'
import { FAQS_FOLDER } from './apps/routes'
import { addressable, addressOf, spotOfPlace } from '../os/place'

// The phone as a system: whether it is locked, which app is in front, how far
// into each app the visitor has gone, and the sheet over it. An iPhone keeps
// every app as it was left, so each app's place is kept while another is in
// front.
//
// Every move is a step in the browser's history, so the browser's own back
// (Safari's swipe from the left edge, an Android back button) is the phone's
// back. Moves made here are drawn with motion; moves the browser makes are
// drawn at once, because the browser has already slid the page across itself.

/** The apps on the phone are the desktop's windows, each redrawn as its iPhone counterpart. All but
 * one: About Shrug is a window of the desktop's own (a Mac has one; an iPhone has no such app), and
 * the phone has nothing in its place. */
export type PhoneApp = Exclude<AppId, 'about'>

export const PHONE_APPS: PhoneApp[] = ['messages', 'finder', 'notes', 'terminal', 'photos']

/** Whether an app of the site's is one the phone has. */
export const onPhone = (app: AppId | null | undefined): app is PhoneApp => (PHONE_APPS as unknown[]).includes(app)

export interface Place {
  /** The app in front, or null on the Home Screen. */
  app: PhoneApp | null
  /** What each app has open beyond its first screen, innermost last: `['c:group']`, `['f:faqs', 'n:3']`. */
  stacks: Record<PhoneApp, string[]>
  /** The sheet over the app in front: `details`, `request`. On the Home Screen (no app), the folder that is open: `folder:portfolio`. */
  sheet: string | null
  /** What is up over all of that: search, or the App Switcher. Each is a step of its own, so that the
   * browser's Back puts it away (and never leaves the site instead). */
  over?: Over
}

export type Over = 'search' | 'switcher' | null

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
 * where they were last used: Notes inside FAQs, a step in from its first
 * screen, with the way back out showing. Contacts opens on its list. */
const noStacks = (): Record<PhoneApp, string[]> => ({ messages: [], finder: [], notes: [FAQS_FOLDER], terminal: [], photos: [] })

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
  const over: Over = place.over === 'search' || place.over === 'switcher' ? place.over : null
  return { shrug: { app: isApp(place.app) ? place.app : null, stacks, sheet: typeof place.sheet === 'string' ? place.sheet : null, over }, n: typeof entry?.n === 'number' ? entry.n : 0 }
}

const placeOf = (s: Sys): Place => ({ app: s.app, stacks: s.stacks, sheet: s.sheet, over: s.spotlight ? 'search' : s.switcher ? 'switcher' : null })

const same = (a: Place, b: Place) => a.app === b.app && a.sheet === b.sheet && (a.over ?? null) === (b.over ?? null) && PHONE_APPS.every((id) => a.stacks[id].join('\n') === b.stacks[id].join('\n'))

const here = (): Entry => read(history.state) ?? { shrug: placeOf(sys.get()), n: 0 }

/** The steps taken since the page loaded, by their number: what a step back would land on. */
const steps = new Map<number, Place>()

/** Whether the next move the browser reports was asked for here, and so is drawn with motion. */
let expected: boolean | null = null
let overdue: ReturnType<typeof setTimeout> | undefined

function apply(place: Place, motion: boolean, origin: string | null = null) {
  sys.set((s) => {
    const recents = place.app ? [place.app, ...s.recents.filter((id) => id !== place.app)] : s.recents
    return {
      ...s,
      app: place.app,
      stacks: place.stacks,
      sheet: place.sheet,
      motion,
      prev: s.app,
      // What an app opened out of matters while it is opening; one already in front keeps its own
      origin: !place.app ? null : place.app === s.app ? s.origin : origin,
      recents,
      // The switcher has nothing to show with no app open (a step forward to it after they were all closed)
      switcher: place.over === 'switcher' && recents.length > 0,
      spotlight: place.over === 'search',
    }
  })
}

// ---- One press, one move ----

/** How long a move takes to draw, give or take: for that long after one, the screens under the visitor's
 * finger take no presses. */
const MOVE = 380

/** A move is being drawn. While it is, what is arriving or leaving takes no presses (src/styles/phone.css):
 * a second tap, or a third, lands on nothing instead of on whatever has just come under the finger, so
 * two taps do what one does. An iPhone does the same. */
export const moving = createStore(false)

let settling: ReturnType<typeof setTimeout> | undefined
let drawn = 0

function moved() {
  moving.set(true)
  clearTimeout(settling)
  cancelAnimationFrame(drawn)
  // The time, and then two frames really drawn: on a phone too busy to keep up, a press made during the
  // move is still waiting when the time is up, and is dealt with (and dropped) before those frames are
  settling = setTimeout(() => {
    drawn = requestAnimationFrame(() => {
      drawn = requestAnimationFrame(() => moving.set(false))
    })
  }, MOVE)
}

/** Writes the step the phone is on, or the one after it. Each step carries its address
 * (src/os/place.ts), so the address bar says where the phone is and a link copied from it opens
 * there. A page with no address of its own to change (opened from a file, held in a sandboxed
 * frame) keeps the one it has. */
function write(place: Place, n: number, push: boolean) {
  const entry = { shrug: place, n } satisfies Entry
  const address = addressable() ? addressOf(spotOfPlace(place)) : undefined
  try {
    if (push) history.pushState(entry, '', address)
    else history.replaceState(entry, '', address)
  } catch {
    if (push) history.pushState(entry, '')
    else history.replaceState(entry, '')
  }
  steps.set(n, place)
}

/** A move the visitor made: a new step in history. Search and the App Switcher are steps too, but ones
 * that are passed through, not stopped at: whatever is gone to from one (an app picked in it) takes its
 * step, so that Back from there is where the visitor was before, not search again. */
function go(place: Place, origin: string | null = null) {
  // A step back is on its way and the browser has not answered yet: one move at a time
  if (expected !== null) return
  if (same(placeOf(sys.get()), place)) return
  moved()
  const entry = here()
  if (entry.shrug.over) write(place, entry.n, false)
  else write(place, entry.n + 1, true)
  apply(place, true, origin)
}

/** A move that undoes the last one. Where the step before is the place it
 * leads to, it is a step back; otherwise it is one more step forward. */
function back(place: Place, motion = true) {
  // The browser has not answered the last step back yet: a second one now would go two steps, or out of the site
  if (expected !== null) return
  if (same(placeOf(sys.get()), place)) return
  moved()
  const entry = here()
  const before = steps.get(entry.n - 1)
  if (entry.n > 0 && before && same(before, place)) return rewind(-1, place, motion)
  // Out of search or the switcher to somewhere that is not the step under it: that somewhere takes its step
  if (entry.shrug.over) write(place, entry.n, false)
  else write(place, entry.n + 1, true)
  apply(place, motion)
}

/** Steps back through history to a step that is `place`. The browser answers in its own time (`watchHistory`
 * draws it then); a page held inside another (a preview) may never hear the answer, so if none has come
 * shortly, the step the phone is on is rewritten instead. */
function rewind(by: number, place: Place, motion: boolean) {
  const entry = here()
  expected = motion
  history.go(by)
  clearTimeout(overdue)
  overdue = setTimeout(() => {
    if (expected === null) return
    expected = null
    write(place, entry.n, false)
    apply(place, motion)
  }, 400)
}

/** Rewrites the step the phone is on, without taking one. */
const amend = (place: Place) => write(place, here().n, false)

// ---- Apps ----

/** Brings an app to the front, as it was left. `origin` names the element it grows out of, when that isn't its icon. */
export function launch(app: PhoneApp, origin: string | null = null) {
  const s = sys.get()
  if (s.locked) sys.set((now) => ({ ...now, locked: false }))
  // Already in front: only what is over it (the switcher) goes
  if (s.app === app && !s.sheet) return s.switcher || s.spotlight ? back({ app, stacks: s.stacks, sheet: null, over: null }) : undefined
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
  // Already there, with search or the switcher over it: that goes
  if (!s.app && (s.switcher || s.spotlight)) return back({ app: null, stacks: s.stacks, sheet: s.sheet, over: null })
  // Already there, with a folder open over it: the folder closes
  if (!s.app && s.sheet) return closeSheet()
  if (!s.app) return
  back({ app: null, stacks: s.stacks, sheet: null })
}

/** Closes an app for good, as flicking it out of the App Switcher does: it starts over next time. */
export function quit(app: PhoneApp) {
  const s = sys.get()
  const recents = s.recents.filter((id) => id !== app)
  // The switcher stays up while there is another card in it
  const showing = s.switcher && recents.length > 0
  const place: Place = { app: s.app === app ? null : s.app, stacks: { ...s.stacks, [app]: noStacks()[app] }, sheet: s.app === app ? null : s.sheet, over: showing ? 'switcher' : null }
  moved()
  // It was the last one, and the phone is on its Home Screen again. If an earlier step is that very Home
  // Screen (the one the app was opened from), the phone steps back to it, which leaves the browser's Back
  // nothing that changes nothing; otherwise the step it is on becomes it
  const n = here().n
  let earlier = -1
  if (!place.app && !place.over && expected === null) for (let k = n - 1; k >= 0 && k >= n - 12 && earlier < 0; k--) if (steps.has(k) && same(steps.get(k)!, place)) earlier = k
  if (earlier >= 0) rewind(earlier - n, place, false)
  else amend(place)
  sys.set((now) => ({ ...now, app: place.app, stacks: place.stacks, sheet: place.sheet, recents, switcher: showing }))
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

/** What had the keyboard when the phone locked, to be given it back when the phone opens. */
let held: ReturnType<typeof holdFocus> | null = null

export function lock() {
  const s = sys.get()
  if (s.locked) return
  // Before anything is drawn locked: what is under the Lock Screen is about to be shut off, and the keyboard with it
  held = holdFocus()
  // Search or the switcher was up: it goes, and its step with it
  const under: Place = { app: s.app, stacks: s.stacks, sheet: s.sheet, over: null }
  sys.set((now) => ({ ...now, locked: true, switcher: false, spotlight: false, motion: true }))
  const entry = here()
  if (!entry.shrug.over || expected !== null) return
  const before = steps.get(entry.n - 1)
  if (entry.n > 0 && before && same(before, under)) rewind(-1, under, false)
  else amend(under)
}

export function unlock() {
  if (!sys.get().locked) return
  moved()
  sys.set((s) => ({ ...s, locked: false, motion: true }))
}

/** Puts the keyboard somewhere real after the screen has changed under it: back on what had it when the
 * phone locked, if that is still there to take it, and otherwise on the first of `otherwise` that can. */
export function refocus(...otherwise: (Element | null | undefined)[]) {
  const give = held
  held = null
  return give ? give(...otherwise) : focusFirst(...otherwise)
}

/** Brings the App Switcher up over wherever the phone is, or puts it away. A step in history, as search is. */
export function showSwitcher(on: boolean) {
  const s = sys.get()
  if (s.switcher === on || (on && !s.recents.length)) return
  const under: Place = { app: s.app, stacks: s.stacks, sheet: s.sheet, over: null }
  if (on) go({ ...under, over: 'switcher' })
  else back(under)
}

/** Brings search up over the Home Screen, or puts it away. */
export function showSpotlight(on: boolean) {
  const s = sys.get()
  if (s.spotlight === on) return
  const under: Place = { app: s.app, stacks: s.stacks, sheet: s.sheet, over: null }
  if (on) go({ ...under, over: 'search' })
  else back(under)
}

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
    // What was up over the place (search, the switcher) is not come back to: the place itself is
    const place: Place = { ...entry.shrug, over: null }
    write(place, entry.n, false)
    apply(place, false)
    sys.set((s) => ({ ...s, locked: false }))
  } else amend(placeOf(sys.get()))
  return resumed
}

/** Takes out of every app's place the screens that name something no longer there, and everything
 * beyond them: a note or a folder the visitor made, which a reload may not have kept. The phone lands on
 * the screen those were opened from. `lost` says which. The step the phone is on is rewritten to match. */
export function dropLost(lost: (app: PhoneApp, view: string) => boolean) {
  const s = sys.get()
  let changed = false
  const stacks = { ...s.stacks }
  for (const app of PHONE_APPS) {
    const at = stacks[app].findIndex((view) => lost(app, view))
    if (at < 0) continue
    stacks[app] = stacks[app].slice(0, at)
    changed = true
  }
  if (!changed) return
  // A sheet that was over a screen that has gone has nothing left to be over
  const sheet = s.app && stacks[s.app] !== s.stacks[s.app] ? null : s.sheet
  sys.set((now) => ({ ...now, stacks, sheet, motion: false }))
  amend(placeOf(sys.get()))
}

/** A link that names an app (`?open=portfolio`) arrives with it open and the
 * phone unlocked; so does a visit that was on the desktop until the screen
 * changed (src/os/crossing.ts), at the screens it was on there (`stack`,
 * `sheet`). Nobody tapped anything, so it takes the place of the step the
 * phone is on instead of adding one. */
export function arriveIn(app: PhoneApp, stack?: string[], sheet: string | null = null) {
  const stacks = stack ? { ...sys.get().stacks, [app]: stack } : sys.get().stacks
  const place: Place = { app, stacks, sheet }
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
    // The browser's own Back or Forward is a move as much as a tap is
    moved()
    apply(entry?.shrug ?? { app: null, stacks: sys.get().stacks, sheet: null }, motion)
  }
  window.addEventListener('popstate', onPop)
  return () => window.removeEventListener('popstate', onPop)
}

// ---- Reading it ----

/** The screen an app is on: the innermost view of its stack, or null on its first screen. */
export const topOf = (s: Sys, app: PhoneApp) => s.stacks[app][s.stacks[app].length - 1] ?? null
