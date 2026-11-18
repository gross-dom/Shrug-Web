import { asked } from './address'
import { createStore } from './store'

// The screen saver: on when the desk has been left alone for a while, or when
// asked for from the menu. Any key, press or movement wakes it. Whether it
// starts by itself is the visitor's to say (the mark's menu), and kept.

const KEPT = 'shrug:saver'

/** What the visitor chose the last time: never to start by itself. */
function keptNever() {
  try {
    return window.localStorage.getItem(KEPT) === 'never'
  } catch {
    // No storage here (a private window, a page held inside another): the choice lasts the visit
    return false
  }
}

export const saver = createStore<{ on: boolean; never: boolean }>({ on: false, never: typeof window !== 'undefined' && keptNever() })

/** When it was last started, so the click that started it doesn't also wake it. */
let startedAt = 0

export function startSaver() {
  startedAt = performance.now()
  saver.set((s) => (s.on ? s : { ...s, on: true }))
}

/** Wakes the desk. Says whether it did: nothing wakes it in the first half second, which is the press that started it. */
export function wakeSaver() {
  if (!saver.get().on || performance.now() - startedAt < 500) return false
  saver.set((s) => ({ ...s, on: false }))
  return true
}

/** Whether it starts by itself once the desk has been still: the visitor's choice, kept for next time. */
export function setSaverNever(never: boolean) {
  saver.set((s) => (s.never === never ? s : { ...s, never }))
  try {
    window.localStorage.setItem(KEPT, never ? 'never' : 'idle')
  } catch {
    // As above
  }
}

/** `?idle=20` in the address: the seconds of stillness asked for, for trying it out. */
export function askedIdle(): number | null {
  const seconds = Number(asked('idle') ?? NaN)
  return Number.isFinite(seconds) && seconds >= 3 ? seconds : null
}

/** Seconds of stillness before it starts. */
export const idleSeconds = () => askedIdle() ?? 150

/** It starts by itself: always when the address asks for a wait of its own, otherwise unless the visitor has said never. */
export const startsItself = () => askedIdle() !== null || !saver.get().never
