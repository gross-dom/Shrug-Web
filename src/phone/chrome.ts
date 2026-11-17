import { createStore } from '../os/store'
import type { PhoneApp } from './system'

// What the top of each app's screen looks like right now, so the status bar
// over it can be read: light ink over a dark screen, dark ink over a light one.
// On a real phone the same colour is given to the browser, which paints its
// own bars to match.

export type Tone = 'plain' | 'grouped' | 'dark'

export const COLOR: Record<Tone, string> = { plain: '#ffffff', grouped: '#f2f2f7', dark: '#000000' }

/** The wallpaper's colour at the top of the screen: what the lock and home screens give the browser. */
export const WALLPAPER_TOP = '#040618'

export const chrome = createStore<Record<PhoneApp, Tone>>({ messages: 'plain', finder: 'plain', notes: 'plain', terminal: 'dark', photos: 'plain', about: 'grouped' })

/** Called by the screen on top of an app: this is what is under the status bar now. */
export const setTone = (app: PhoneApp, tone: Tone) => chrome.set((s) => (s[app] === tone ? s : { ...s, [app]: tone }))

/** An app is being carried off by a finger on the home indicator: the wallpaper is showing around it. */
export const carried = createStore(false)
