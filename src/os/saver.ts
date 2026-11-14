import { createStore } from './store'

// The screen saver: on when the desk has been left alone for a while, or when
// asked for from the menu. Any key or movement wakes it.

export const saver = createStore<{ on: boolean }>({ on: false })

/** When it was last started, so the click that started it doesn't also wake it. */
let startedAt = 0

export function startSaver() {
  startedAt = performance.now()
  saver.set({ on: true })
}

export function wakeSaver() {
  if (!saver.get().on || performance.now() - startedAt < 500) return
  saver.set({ on: false })
}

/** Seconds of stillness before it starts. `?idle=20` in the address sets it, for trying it out. */
export function idleSeconds() {
  const asked = Number(new URLSearchParams(window.location.search).get('idle'))
  return Number.isFinite(asked) && asked >= 3 ? asked : 150
}
