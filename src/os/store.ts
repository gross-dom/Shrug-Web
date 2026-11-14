import { useSyncExternalStore } from 'react'

// A tiny external store. The desktop's state (windows, the chat's progress)
// lives outside React so a window can be dragged, or a reply can land, without
// re-rendering anything that didn't select the part that changed.

export interface Store<T> {
  get(): T
  set(next: T | ((state: T) => T)): void
  subscribe(listener: () => void): () => void
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(next) {
      const value = typeof next === 'function' ? (next as (s: T) => T)(state) : next
      if (Object.is(value, state)) return
      state = value
      listeners.forEach((l) => l())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** Select a slice of a store. The selector must return a primitive or a stable reference. */
export function useStore<T, U>(store: Store<T>, select: (state: T) => U): U {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.get()),
  )
}
