import type { AppId } from '../os/apps'
import { createStore } from '../os/store'

// Where the phone is: the Home Screen, or an app, and how deep into it. The
// stack is mirrored into the browser's history, so the phone's own back
// gesture or button steps back through it instead of leaving the site.

export interface Screen {
  app: AppId
  /** The app's own place: a list, one conversation, one note. Each app reads its own. */
  view: string
}

export interface IconRect {
  x: number
  y: number
  w: number
  h: number
}

export interface PhoneNav {
  /** Empty on the Home Screen. */
  stack: Screen[]
  /** The app that is on its way out, kept drawn until it has gone. */
  leaving: Screen[] | null
  /** The icon the open app grew out of, and the leaving one shrinks back into. */
  origin: IconRect | null
}

export const phone = createStore<PhoneNav>({ stack: [], leaving: null, origin: null })

/** Where each app opens when it has nowhere to resume from. */
const START: Partial<Record<AppId, string[]>> = {
  messages: ['list', 'thread:group'],
  notes: ['list'],
}

/** The views an app was left on, to open it on again. Sheets aren't kept: an app comes back on a page. */
const resume: Partial<Record<AppId, string[]>> = {}

let leavingTimer: ReturnType<typeof setTimeout> | undefined

const iconOf = (app: AppId): IconRect | null => {
  const el = document.querySelector<HTMLElement>(`[data-home-app="${app}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null
}

function apply(next: Screen[], origin?: IconRect | null) {
  phone.set((s) => {
    const was = s.stack[0]?.app
    const now = next[0]?.app
    // Remember where an app was left, so its icon opens it there again
    if (was) resume[was] = s.stack.map((x) => x.view).filter((view) => !view.startsWith('company:'))
    const changed = was !== undefined && was !== now
    return {
      stack: next,
      leaving: changed ? s.stack : s.leaving,
      // Going home, the app shrinks into its own icon, wherever that is now
      origin: origin !== undefined ? origin : changed && !now ? (iconOf(was) ?? s.origin) : s.origin,
    }
  })
  if (phone.get().leaving) {
    clearTimeout(leavingTimer)
    leavingTimer = setTimeout(() => phone.set((s) => ({ ...s, leaving: null })), 520)
  }
}

/** Opens an app from the Home Screen (or from inside another app), where it was left. */
export function openPhoneApp(app: AppId, views?: string[]) {
  const steps = views ?? resume[app] ?? START[app] ?? ['root']
  const stack: Screen[] = []
  steps.forEach((view) => {
    stack.push({ app, view })
    history.pushState({ shrug: stack.slice() }, '')
  })
  apply(stack, iconOf(app))
}

/** Goes one step deeper into the app that is open. */
export function pushView(view: string) {
  const s = phone.get()
  const top = s.stack[s.stack.length - 1]
  if (!top) return
  const stack = [...s.stack, { app: top.app, view }]
  history.pushState({ shrug: stack }, '')
  apply(stack)
}

/** Swaps the view on top for another at the same depth: the next note, not a step deeper. */
export function replaceView(view: string) {
  const s = phone.get()
  const top = s.stack[s.stack.length - 1]
  if (!top) return
  const stack = [...s.stack.slice(0, -1), { app: top.app, view }]
  history.replaceState({ shrug: stack }, '')
  apply(stack)
}

/** One step back: out of a pushed view, or out of the app to the Home Screen. */
export function goBack() {
  if (phone.get().stack.length) history.back()
}

/** Back to the nearest view under the top one that matches. False if there is none. */
export function popTo(match: (view: string) => boolean) {
  const { stack } = phone.get()
  for (let i = stack.length - 2; i >= 0; i--) {
    if (!match(stack[i]!.view)) continue
    history.go(i - (stack.length - 1))
    return true
  }
  return false
}

/** Straight to the Home Screen. */
export function goHome() {
  const depth = phone.get().stack.length
  if (depth) history.go(-depth)
}

/** Follows the browser's history: call once, when the phone layout first shows. */
export function watchHistory() {
  if (!(history.state && 'shrug' in history.state)) history.replaceState({ shrug: [] }, '')
  const onPop = (e: PopStateEvent) => {
    const stack = (e.state && Array.isArray(e.state.shrug) ? e.state.shrug : []) as Screen[]
    apply(stack)
  }
  window.addEventListener('popstate', onPop)
  return () => window.removeEventListener('popstate', onPop)
}

/** The app on screen and its place in it, or null on the Home Screen. */
export const topScreen = (s: PhoneNav): Screen | null => s.stack[s.stack.length - 1] ?? null
