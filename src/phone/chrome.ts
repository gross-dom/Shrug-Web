import { createStore } from '../os/store'
import type { PhoneApp } from './system'

// What the top of each app's screen looks like right now, so the status bar
// over it can be read: light ink over a dark screen, dark ink over a light one.
// On a real phone the same colour is given to the browser, which paints its
// own bars to match.

export type Tone = 'plain' | 'grouped' | 'dark'

export const COLOR: Record<Tone, string> = { plain: '#ffffff', grouped: '#f2f2f7', dark: '#000000' }

/** The wallpaper's colour at the top of the screen: what the lock and home screens give the browser. */
export const WALLPAPER_TOP = '#0f1130'

/** And along its foot, which is pale where the top is dark: what the browser's lower bar is given (edges.ts). */
export const WALLPAPER_FOOT = '#8297de'

/** Both again where the wallpaper is darkened: behind the App Switcher (phone.css lays rgb(4 6 20 / 0.46) over it) and under search's shade (spotlight.css lays
 * rgb(10 11 16 / 0.82) over it, and at the foot the keyboard's own glass over that, or none when it is put away: one colour between the two). */
export const WALLPAPER_DIMMED = { switcher: { top: '#0a0c29', foot: '#485481' }, search: { top: '#0b0c16', foot: '#23252f' } }

export const chrome = createStore<Record<PhoneApp, Tone>>({ messages: 'plain', finder: 'plain', notes: 'plain', terminal: 'dark', photos: 'plain' })

/** A screen in a colour of its own (a contact's card takes its picture's): what is at its top edge and at
 * its foot. One colour for a page that is one colour; two for one that runs from a picture down into another. */
export type Ground = string | { top: string; foot: string }

/** The colour of its own that the screen on top of each app is in, where it has one. */
export const grounds = createStore<Partial<Record<PhoneApp, Ground>>>({})

const sameGround = (a: Ground | undefined, b: Ground | undefined) => (typeof a === 'object' && typeof b === 'object' ? a.top === b.top && a.foot === b.foot : a === b)

/** What the status bar's ink is chosen against on the screen on top of each app, where that is not the
 * screen's own tone: a picture runs under the status bar there (dark: white ink), over a page that is pale
 * further down. The home indicator, at the foot, goes by the screen's own tone all the same. */
export const overs = createStore<Partial<Record<PhoneApp, Tone>>>({})

/** Called by the screen on top of an app: this is what the screen is, what colour of its own it is in,
 * and what is under the status bar where that differs. */
export const setTone = (app: PhoneApp, tone: Tone, ground?: Ground, over?: Tone) => {
  chrome.set((s) => (s[app] === tone ? s : { ...s, [app]: tone }))
  grounds.set((s) => (sameGround(s[app], ground) ? s : { ...s, [app]: ground }))
  overs.set((s) => (s[app] === over ? s : { ...s, [app]: over }))
}

/** An app is being carried off by a finger on the home indicator: the wallpaper is showing around it. */
export const carried = createStore(false)

/** A sheet is up over the app in front: how dark the shade it lays over the app is (0 with none), and,
 * for a sheet that runs to the foot of the screen, the ground it is drawn on (the screen's foot is the
 * sheet's then). The sheet says so itself (ui.tsx), and the edges of the screen follow (edges.ts). */
export const sheeted = createStore<{ shade: number; foot: string | null }>({ shade: 0, foot: null })
