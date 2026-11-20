import { keepFor, keptFor } from '../apps/chat'
import { WALLPAPERS } from '../data/wallpapers'
import { asked, isOn } from './address'
import { createStore } from './store'
import { wm } from './wm'

// The desktop's wallpaper: which of the wallpapers (src/data/wallpapers.ts) the desk is showing. A visit
// begins on the first, which is the picture the site has always had, and the desk moves on to the next
// every two minutes, round and round, as a Mac set to change its picture does. One chosen in the
// Wallpapers window stays until another is chosen, or the desk is told to change by itself again.
//
// Which is showing, and whether it changes by itself, are kept for the tab, as the rest of the desk is
// (deskmemory.ts): a reload comes back to the wallpaper it left. Only the desktop does any of this: a phone
// has a wallpaper of its own, and none of these is fetched there.

/** How long the desk keeps a wallpaper before it moves on to the next. */
export const EVERY = 2 * 60 * 1000

/** `?wallpapers=10` in the address: the seconds asked for in place of the two minutes, for trying it out
 * (as `?idle=20` is for the screen saver). */
function askedEvery(): number | null {
  const seconds = Number(asked('wallpapers') ?? NaN)
  return Number.isFinite(seconds) && seconds >= 3 ? seconds * 1000 : null
}

interface Showing {
  /** Which of WALLPAPERS is on the desk. */
  at: number
  /** The desk moves on to the next by itself. */
  auto: boolean
}

const NAME = 'wallpaper'

/** What this tab was showing, read with care (it is only text in storage). */
function kept(): Showing | null {
  const was = keptFor(NAME) as Partial<Showing> | null
  if (!was || typeof was !== 'object') return null
  const at = typeof was.at === 'number' && Number.isInteger(was.at) && was.at >= 0 && was.at < WALLPAPERS.length ? was.at : 0
  return { at, auto: was.auto !== false }
}

export const wallpaper = createStore<Showing>((typeof window !== 'undefined' && kept()) || { at: 0, auto: true })

wallpaper.subscribe(() => keepFor(NAME, wallpaper.get()))

/** Puts one wallpaper on the desk, to stay: the desk stops changing it by itself. */
export const setWallpaper = (at: number) => wallpaper.set((s) => (at < 0 || at >= WALLPAPERS.length || (s.at === at && !s.auto) ? s : { at, auto: false }))

/** Whether the desk moves on to the next wallpaper by itself. */
export const setWallpaperAuto = (auto: boolean) => wallpaper.set((s) => (s.auto === auto ? s : { ...s, auto }))

/** The next wallpaper, now. (It does not change whether the desk goes on changing by itself.) */
export const nextWallpaper = () => wallpaper.set((s) => ({ ...s, at: (s.at + 1) % WALLPAPERS.length }))

/** Starts the desk changing its wallpaper, from now on. Returns what stops it.
 * It moves on only while the desktop is what is showing and the page can be seen: nobody is shown a
 * wallpaper that came and went while the tab was in the background. With `?still` in the address (the
 * site held still, to be looked at or checked) it keeps the one it has, unless the address also says how
 * often to change it. */
export function runWallpapers() {
  const every = askedEvery()
  if (isOn('still') && !every) return () => {}
  const timer = setInterval(() => {
    if (!wallpaper.get().auto || document.hidden || wm.get().compact) return
    nextWallpaper()
  }, every ?? EVERY)
  return () => clearInterval(timer)
}
