import { WALLPAPERS } from '../data/wallpapers'
import { createStore } from './store'

// The desktop's wallpaper: which of the wallpapers (src/data/wallpapers.ts) the desk is showing. Each visit
// shows the next one, round and round, from the first, which is the picture the site has always had. A
// reload is the same visit and keeps the wallpaper it had. One put on the desk by hand, in the Wallpapers
// window, stays from visit to visit, until the desk is told to change each visit again.
//
// Which one a visit shows is settled by the page itself before anything is drawn (the script at the head
// of index.html), so that the right picture is asked for at once: this reads what it settled, and keeps
// what changes from then on where that script will find it. The last shown is kept in the browser, for the
// next visit to move on from; the one showing is kept for the tab, for a reload to come back to. Only the
// desktop does any of this: a phone has a wallpaper of its own, and none of these is fetched there.

interface Showing {
  /** Which of WALLPAPERS is on the desk. */
  at: number
  /** The desk shows the next one each visit. */
  auto: boolean
}

const KEPT = 'shrug:wallpaper'

/** What the page settled on as it loaded, read with care; the first, changing each visit, where it settled nothing. */
function settled(): Showing {
  const was = typeof window === 'undefined' ? null : (window as { __shrugWallpaper?: Partial<Showing> }).__shrugWallpaper
  const at = was && typeof was.at === 'number' && Number.isInteger(was.at) && was.at >= 0 && was.at < WALLPAPERS.length ? was.at : 0
  return { at, auto: was?.auto !== false }
}

export const wallpaper = createStore<Showing>(settled())

wallpaper.subscribe(() => {
  const now = JSON.stringify(wallpaper.get())
  try {
    window.sessionStorage.setItem(KEPT, now)
    window.localStorage.setItem(KEPT, now)
  } catch {
    // No storage here (a private window, a page held inside another): the choice lasts the visit
  }
})

/** Puts one wallpaper on the desk, to stay: the desk stops changing it each visit. */
export const setWallpaper = (at: number) => wallpaper.set((s) => (at < 0 || at >= WALLPAPERS.length || (s.at === at && !s.auto) ? s : { at, auto: false }))

/** Whether the desk shows the next wallpaper each visit. */
export const setWallpaperAuto = (auto: boolean) => wallpaper.set((s) => (s.auto === auto ? s : { ...s, auto }))

/** The next wallpaper, now. (It does not change whether the desk goes on changing each visit.) */
export const nextWallpaper = () => wallpaper.set((s) => ({ ...s, at: (s.at + 1) % WALLPAPERS.length }))
