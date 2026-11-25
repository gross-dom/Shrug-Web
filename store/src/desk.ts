import type { Shelf } from '../shared/rules'

// The desk this store is a window of, when it is one.
//
// On Shrug's own site the store is opened in a window of the desktop (src/apps/Store.tsx, in the desktop's
// folder): these same pages, in a frame, with the bar (the name, Store and My VIP, the balance) drawn by the
// window itself, as a Mac app's toolbar is. The desk is the page that frame is in. It is this page's own
// site, so the two can speak plainly: the desk leaves a few things here to be asked of it (`shrugDesk`), and
// the store leaves a few for the desk (`shrugStore`: see App.tsx).
//
// What changes in a window: nothing here signs anyone in (Log In is the desk's one sheet), the bar is not
// drawn, the layout is sized to the window (app.css, "In a window"), and moving about the store does not
// add to the browser's history, which is the desk's.

/** Which of the desk's windows these pages are in: one of the three stores (its shelf), or My VIP. */
export type Room = Shelf | 'yours'

export interface Desk {
  /** Lets down the desk's Log In, which says what it was opened for. */
  logIn(why: 'store' | 'request' | 'price'): void
  /** Something happened here that the desk shows: points were spent, or someone signed out. */
  changed(): void
  /** Where these pages are now, for the window they are in. */
  at(place: { section: 'store' | 'yours'; product: string | null }, room: Room): void
  /** Opens another of the desk's windows: My VIP from a receipt in a store, a store from My VIP. */
  open(room: Room): void
}

/** What the store leaves for the desk to ask of it. */
export interface StoreInWindow {
  go(place: { section: 'store' | 'yours'; product: string | null }): void
  /** Whoever is logged in has changed, or what they have: ask the server again. */
  reload(): void
}

export const DESK: Desk | null = (() => {
  try {
    const up = window.parent as Window & { shrugDesk?: Desk }
    return up !== window && up.shrugDesk ? up.shrugDesk : null
  } catch {
    // A frame on somebody else's site: not a window of the desk
    return null
  }
})()
