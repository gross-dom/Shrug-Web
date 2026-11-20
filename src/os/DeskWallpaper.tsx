import { useEffect, useState, type CSSProperties } from 'react'
import { WALLPAPERS } from '../data/wallpapers'
import { useStore } from './store'
import { runWallpapers, wallpaper } from './wallpaper'

// The desk's wallpaper, as it is drawn: the picture showing, and for a moment under it the one it is
// taking over from. A wallpaper is not put on the desk until its picture has arrived, so one fades into
// the next and the desk is never bare between them. The picture itself is named in a property and only
// used where the desktop's wallpaper shows (os.css): a phone in the hand never fetches any of them.

const picture = (at: number) => ({ '--picture': `url('${WALLPAPERS[at]!.src}')` }) as CSSProperties

export function DeskWallpaper() {
  const at = useStore(wallpaper, (s) => s.at)
  /** The wallpaper on the desk, and the one it faded in over (until the fade is done). */
  const [shown, setShown] = useState({ on: at, under: null as number | null, first: true })

  useEffect(() => runWallpapers(), [])

  useEffect(() => {
    if (at === shown.on) return
    let live = true
    const arrive = () => {
      if (live) setShown((was) => ({ on: at, under: was.on, first: false }))
    }
    const fetched = new Image()
    fetched.src = WALLPAPERS[at]!.src
    // Drawn only once it can be: decoded where the browser can say so, loaded where it cannot
    if (typeof fetched.decode === 'function') fetched.decode().then(arrive, arrive)
    else fetched.onload = fetched.onerror = arrive
    return () => {
      live = false
    }
  }, [at, shown.on])

  return (
    <>
      {shown.under !== null && <div key={shown.under} className="os__picture" style={picture(shown.under)} />}
      <div
        key={shown.on}
        className="os__picture"
        // The first is simply there, as the desk is; each one after it fades in over the last
        data-arriving={shown.first ? undefined : ''}
        data-wallpaper={WALLPAPERS[shown.on]!.id}
        style={picture(shown.on)}
        onAnimationEnd={() => setShown((was) => (was.under === null ? was : { ...was, under: null }))}
      />
    </>
  )
}
