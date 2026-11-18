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

/** Both again where the wallpaper is darkened: behind the App Switcher (phone.css takes it to 0.72 of its
 * brightness) and under search's shade (spotlight.css lays rgb(14 18 58 / 0.34) over it). */
export const WALLPAPER_DIMMED = { switcher: { top: '#0b0c23', foot: '#5e6da0' }, search: { top: '#0f1133', foot: '#5b6aa6' } }

export const chrome = createStore<Record<PhoneApp, Tone>>({ messages: 'plain', finder: 'plain', notes: 'plain', terminal: 'dark', photos: 'plain' })

/** Called by the screen on top of an app: this is what is under the status bar now. */
export const setTone = (app: PhoneApp, tone: Tone) => chrome.set((s) => (s[app] === tone ? s : { ...s, [app]: tone }))

/** An app is being carried off by a finger on the home indicator: the wallpaper is showing around it. */
export const carried = createStore(false)

/** A sheet is up over the app in front: how dark the shade it lays over the app is (0 with none), and,
 * for a sheet that runs to the foot of the screen, the ground it is drawn on (the screen's foot is the
 * sheet's then). The sheet says so itself (ui.tsx), and the edges of the screen follow (edges.ts). */
export const sheeted = createStore<{ shade: number; foot: string | null }>({ shade: 0, foot: null })
