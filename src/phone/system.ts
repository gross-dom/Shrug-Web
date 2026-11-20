import type { AppId } from '../os/apps'
import { focusFirst, holdFocus } from '../os/focus'
import { createStore } from '../os/store'
import { FAQS_FOLDER } from './apps/routes'
import { addressable, addressOf, spotOfPlace } from '../os/place'
import { ZOOM } from './Zoom'

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
export type PhoneApp = Exclude<AppId, 'about' | 'wallpapers'>

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
  /** The phone was locked when the step was last written. A reload comes back to the phone as it was: on
   * its Lock Screen, if that is where it was left (a step from before this was kept says nothing, and is open). */
  locked: boolean
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
  return { shrug: { app: isApp(place.app) ? place.app : null, stacks, sheet: typeof place.sheet === 'string' ? place.sheet : null, over }, n: typeof entry?.n === 'number' ? entry.n : 0, locked: entry?.locked === true }
}

const placeOf = (s: Sys): Place => ({ app: s.app, stacks: s.stacks, sheet: s.sheet, over: s.spotlight ? 'search' : s.switcher ? 'switcher' : null })

const same = (a: Place, b: Place) => a.app === b.app && a.sheet === b.sheet && (a.over ?? null) === (b.over ?? null) && PHONE_APPS.every((id) => a.stacks[id].join('\n') === b.stacks[id].join('\n'))

const here = (): Entry => read(history.state) ?? { shrug: placeOf(sys.get()), n: 0, locked: sys.get().locked }

/** The steps taken since the page loaded, by their number: what a step back would land on. */
const steps = new Map<number, Place>()

/** A step back that was asked for here, which the browser has yet to answer: the step it is to land on,
 * the place the phone is to be at when it has (which need not be the place that step was left at: see
 * `back`), and whether it is drawn with motion. A move the browser reports with none asked for is its own. */
let expected: { n: number; place: Place; motion: boolean } | null = null
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

/** How long a move takes to draw, give or take: a screen pushed or popped, a sheet, a folder, search. */
const MOVE = 380

/** And where it is an app coming to the front or being put away, which takes the longest (Zoom.tsx): the
 * whole of it and a little over. The second tap of two is often that late, and what it would land on is
 * the app that has just come under the finger: its search field, a picture in it. */
const ZOOMED = ZOOM.open + 120

/** For this long after a move nothing under the visitor's finger takes a press at all: the tap that made
 * the move is still being dealt with, and whatever it was on has not been drawn gone. */
const HELD = 120

/** A move is being drawn, and has only just begun: what is arriving or leaving takes no presses
 * (src/styles/phone.css). After that, and until the move is done, only a press where the last one was is
 * turned away (`echoes`, below): the second tap of two lands on nothing instead of on whatever has just
 * come under the finger, so two taps do what one does, while a press anywhere else is taken at once. An
 * iPhone is the same: Back can be pressed while a screen is still sliding in, and another app opened
 * while the last is on its way into its icon. */
export const moving = createStore(false)

let settling: ReturnType<typeof setTimeout> | undefined
let drawn = 0

const NOWHERE = { x: -1e5, y: -1e5, t: 0 }
/** Where the visitor last pressed, and when. */
let pressed = NOWHERE
/** The press that made the last move, when that move was made, and how long it is being drawn for. */
let madeBy = NOWHERE
let movedAt = -1e5
let drawnFor = MOVE

/** A move has been made. `zoomed`: it brings an app to the front or puts one away (or opens the phone). */
function moved(zoomed = false) {
  const now = performance.now()
  // A move made from the keyboard, or by the browser's own Back, was made by no press
  madeBy = now - pressed.t < 700 ? pressed : NOWHERE
  movedAt = now
  drawnFor = zoomed ? ZOOMED : MOVE
  moving.set(true)
  clearTimeout(settling)
  cancelAnimationFrame(drawn)
  // The time, and then two frames really drawn: on a phone too busy to keep up, a press made during the
  // move is still waiting when the time is up, and is dealt with (and dropped) before those frames are
  settling = setTimeout(() => {
    drawn = requestAnimationFrame(() => {
      drawn = requestAnimationFrame(() => moving.set(false))
    })
  }, HELD)
}

/** When a press was made, as the press itself says. A phone that is busy putting an app together deals
 * with a tap some time after it was made, and it is when it was made that tells the second tap of two.
 * (Where what it says cannot be that, it is taken as made now.) */
function madeAt(e: Event) {
  const now = performance.now()
  return e.timeStamp > 0 && e.timeStamp <= now && now - e.timeStamp < 5000 ? e.timeStamp : now
}

/** Whether a press at this point, made at this time, is the second tap of two: the press that made the move now being drawn, again. */
const echoes = (x: number, y: number, at: number) => at - movedAt < drawnFor && Math.hypot(x - madeBy.x, y - madeBy.y) < 44

/** Watches where the visitor presses, and turns away the second tap of two (see `moving`): the whole of
 * it, from the moment it comes down. A press does things before its click does (a field takes the
 * keyboard as the finger lifts, a button under a mouse as it is pressed), so stopping the click alone
 * left the second tap of two on an app's icon typing into that app's search field. The home indicator is
 * left alone: it is how to change one's mind. */
function watchPresses() {
  /** The press that is down, or has just lifted, is being turned away: what follows from it is too. */
  let turned = false
  let over: ReturnType<typeof setTimeout> | undefined
  const onScreen = (on: Element | null) => !!on?.closest?.('.ph') && !on.closest('.sb-homebar')
  const down = (e: PointerEvent) => {
    clearTimeout(over)
    turned = onScreen(e.target as Element | null) && echoes(e.clientX, e.clientY, madeAt(e))
    if (!turned) return void (pressed = { x: e.clientX, y: e.clientY, t: performance.now() })
    // Nothing is given the keyboard by it, and nothing that follows a finger is picked up by it
    e.preventDefault()
    e.stopPropagation()
  }
  // What a lifted finger still has to send (the mouse's events a browser makes up for it, the click) comes within a moment
  const up = () => {
    if (turned) over = setTimeout(() => (turned = false), 400)
  }
  const mouse = (e: MouseEvent) => {
    if (!turned) return
    e.preventDefault()
    e.stopPropagation()
  }
  // A touch that ends with its default prevented sends no mouse events and no click
  const lifted = (e: TouchEvent) => {
    if (turned && e.cancelable) e.preventDefault()
  }
  const click = (e: MouseEvent) => {
    const on = e.target as Element | null
    // (A click with no place is the keyboard's)
    if (!e.detail || !onScreen(on)) return
    // A press that made the move as it lifted (a card picked, the Lock Screen opened) is followed by its own click, which is an echo too
    if (!turned && !echoes(e.clientX, e.clientY, madeAt(e))) return
    e.preventDefault()
    e.stopPropagation()
  }
  const events: [string, (e: never) => void][] = [['pointerdown', down], ['pointerup', up], ['pointercancel', up], ['mousedown', mouse], ['touchend', lifted], ['click', click]]
  for (const [name, on] of events) document.addEventListener(name, on as EventListener, { capture: true, passive: false })
  return () => {
    clearTimeout(over)
    for (const [name, on] of events) document.removeEventListener(name, on as EventListener, { capture: true })
  }
}

/** Writes the step the phone is on, or the one after it. Each step carries its address
 * (src/os/place.ts), so the address bar says where the phone is and a link copied from it opens
 * there. A page with no address of its own to change (opened from a file, held in a sandboxed
 * frame) keeps the one it has. */
function write(place: Place, n: number, push: boolean) {
  const entry = { shrug: place, n, locked: sys.get().locked } satisfies Entry
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
  const now = sys.get()
  if (same(placeOf(now), place)) return
  moved(place.app !== now.app)
  const entry = here()
  if (entry.shrug.over) write(place, entry.n, false)
  else write(place, entry.n + 1, true)
  apply(place, true, origin)
}

/** The nearest step before step `n` that is the Home Screen with this over it (a folder, or nothing),
 * whatever each app had open at the time; -1 if there is none among the steps taken since the page loaded. */
function homeBefore(n: number, sheet: string | null) {
  for (let k = n - 1; k >= 0; k--) {
    const step = steps.get(k)
    // Not a step of this page load: what lies before it is not known
    if (!step) return -1
    if (!step.app && !step.over && step.sheet === sheet) return k
  }
  return -1
}

/** A move that undoes the last one. Where the step before is the place it
 * leads to, it is a step back; otherwise it is one more step forward. */
function back(place: Place, motion = true) {
  // The browser has not answered the last step back yet: a second one now would go two steps, or out of the site
  if (expected !== null) return
  const now = sys.get()
  if (same(placeOf(now), place)) return
  moved(place.app !== now.app)
  const entry = here()
  const before = steps.get(entry.n - 1)
  if (entry.n > 0 && before && same(before, place)) return rewind(-1, place, motion)
  // Home. The Home Screen the app was opened from is still there, a step or more back, but it is not the
  // same place to the letter: the app has been somewhere since (it was opened at a conversation out of
  // the widget, or gone further into), and each app is kept as it was left. The phone steps back to that
  // Home Screen all the same, and the step is written again with the apps as they are now. A new step
  // for it would leave the browser's Back, on the Home Screen, opening the app that had just been left,
  // and two steps in history for every visit to an app
  if (!place.app && !place.over) {
    const home = homeBefore(entry.n, place.sheet)
    if (home >= 0) return rewind(home - entry.n, place, motion)
  }
  // Out of search or the switcher to somewhere that is not the step under it: that somewhere takes its step
  if (entry.shrug.over) write(place, entry.n, false)
  else write(place, entry.n + 1, true)
  apply(place, motion)
}

/** Steps back through history, `by` steps, to be at `place` there. The browser answers in its own time
 * (`watchHistory` draws it then, and writes the step again if it was not left as `place`); a page held
 * inside another (a preview) may never hear the answer, so if none has come shortly, the step the phone
 * is on is rewritten instead. */
function rewind(by: number, place: Place, motion: boolean) {
  const entry = here()
  expected = { n: entry.n + by, place, motion }
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

/** Opens the phone where something on its Lock Screen leads straight into an app (a notification pressed).
 * The step it was locked on says it is open from here on, whether or not the app takes a step of its own. */
function opened() {
  if (!sys.get().locked) return
  sys.set((now) => ({ ...now, locked: false }))
  if (expected === null) amend(placeOf(sys.get()))
}

/** Brings an app to the front, as it was left. `origin` names the element it grows out of, when that isn't its icon. */
export function launch(app: PhoneApp, origin: string | null = null) {
  opened()
  const s = sys.get()
  // Already in front: only what is over it (the switcher) goes
  if (s.app === app && !s.sheet) return s.switcher || s.spotlight ? back({ app, stacks: s.stacks, sheet: null, over: null }) : undefined
  go({ app, stacks: s.stacks, sheet: null }, origin)
}

/** Brings an app to the front at a place inside it: a notification opens its
 * conversation. `sheet` is a sheet to have up over that place. */
export function launchAt(app: PhoneApp, stack: string[], origin: string | null = null, sheet: string | null = null) {
  opened()
  const s = sys.get()
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
  // It was the last one, and the phone is on its Home Screen again. If an earlier step is the Home Screen
  // (the one the app was opened from), the phone steps back to it, as it does when an app is sent home
  // (`back`), which leaves the browser's Back nothing that changes nothing; otherwise the step it is on becomes it
  const n = here().n
  const earlier = !place.app && !place.over && expected === null ? homeBefore(n, place.sheet) : -1
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

/** Back a screen in the app in front. Where the app was opened on this very screen out of a folder on the
 * Home Screen (a company picked in Portfolio, a question in FAQs), Back leads back out to that folder,
 * open as it was, and not further into the app: the way back is the way in. */
export function pop() {
  const s = sys.get()
  if (!s.app || !s.stacks[s.app].length) return
  if (expected === null) {
    const entry = here()
    const before = steps.get(entry.n - 1)
    if (entry.n > 0 && before && !before.app && !before.over && before.sheet?.startsWith('folder:') && same(entry.shrug, placeOf(s)) && s.origin?.startsWith('folder:')) {
      moved(true)
      return rewind(-1, before, true)
    }
  }
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
  // (A step back that is on its way is written as locked when it lands: `watchHistory`)
  if (expected !== null) return
  const entry = here()
  const before = steps.get(entry.n - 1)
  if (entry.shrug.over && entry.n > 0 && before && same(before, under)) rewind(-1, under, false)
  // The step the phone is on says it is locked: a reload now comes back to the Lock Screen
  else amend(under)
}

export function unlock() {
  if (!sys.get().locked) return
  moved(true)
  sys.set((s) => ({ ...s, locked: false, motion: true }))
  // And that it is open, from here on
  if (expected === null) amend(placeOf(sys.get()))
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

/** Sets the phone up when the page loads: where a reload left it, and as it left it (open, or on its
 * Lock Screen if it had not been opened yet or had locked itself), or locked at the start of a visit.
 * Returns true if it picked up from a reload. */
export function startSystem(): boolean {
  // Once a page load, however many times it is asked
  if (resumed !== null) return resumed
  const entry = read(history.state)
  resumed = !!entry
  if (entry) {
    // What was up over the place (search, the switcher) is not come back to: the place itself is
    const place: Place = { ...entry.shrug, over: null }
    sys.set((s) => ({ ...s, locked: entry.locked }))
    write(place, entry.n, false)
    apply(place, false)
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
  // (Open before the step is written, which says so)
  sys.set((s) => ({ ...s, locked: false }))
  amend(place)
  apply(place, false)
}

/** Follows the browser's history. */
export function watchHistory() {
  const onPop = (e: PopStateEvent) => {
    const entry = read(e.state)
    // A step back asked for here has landed where it was sent: the phone is at the place it was sent to
    // be at. Anything else is the browser's own Back or Forward, and the place is the step's own
    const asked = expected && entry?.n === expected.n ? expected : null
    expected = null
    clearTimeout(overdue)
    const place = asked?.place ?? entry?.shrug ?? { app: null, stacks: sys.get().stacks, sheet: null }
    // The browser's own Back or Forward is a move as much as a tap is
    moved(place.app !== sys.get().app)
    apply(place, asked?.motion ?? false)
    if (!entry) return
    // The step says where the phone is and whether it is locked. Where it no longer does (it was stepped
    // back to with the apps as they are now, not as they were then; or the phone has been locked or opened
    // since it was written), it is written again
    if (!same(entry.shrug, place) || entry.locked !== sys.get().locked) write(place, entry.n, false)
    else steps.set(entry.n, entry.shrug)
  }
  window.addEventListener('popstate', onPop)
  const unwatch = watchPresses()
  return () => {
    window.removeEventListener('popstate', onPop)
    unwatch()
  }
}

// ---- Reading it ----

/** The screen an app is on: the innermost view of its stack, or null on its first screen. */
export const topOf = (s: Sys, app: PhoneApp) => s.stacks[app][s.stacks[app].length - 1] ?? null
