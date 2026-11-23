import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { WALLPAPERS, type Wallpaper } from '../data/wallpapers'
import { Toggle } from '../kit/controls/Toggle'
import { Window } from '../kit/window'
import { focusFirst } from '../os/focus'
import { useStore } from '../os/store'
import { setWallpaper, setWallpaperAuto, wallpaper } from '../os/wallpaper'

// The Wallpapers folder on the desk, opened: the desk's wallpapers as a photo library (it is laid out with
// the head, the tiles and the dark room for one picture that were drawn for VIP's window, and still go by
// its name: `vip…` in styles/apps.css). A press on one opens it large, where it can be put on the desk or
// downloaded at its full size; the arrows step through the rest and Escape goes back to the grid. Each
// visit shows the next wallpaper (src/os/wallpaper.ts) until one is put on the desk by hand, and the switch
// in the bar sets it going again.

/** A file's size as a Mac says it. */
const sizeOf = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

/** What a wallpaper is, for someone who is told it and not shown it. */
const describe = (w: Wallpaper) => `${w.name} wallpaper, ${w.width} by ${w.height} pixels`

/** Whether the desk shows the next wallpaper each visit: a switch in the window's bar. */
function Auto() {
  const auto = useStore(wallpaper, (s) => s.auto)
  return (
    <button type="button" className="walls-auto" role="switch" aria-checked={auto} onClick={() => setWallpaperAuto(!auto)}>
      <span>Change Each Visit</span>
      <Toggle on={auto} aria-hidden role="presentation" />
    </button>
  )
}

/** One wallpaper, large, in the grid's place. */
function Look({ index, onLook }: { index: number; onLook: (index: number | null) => void }) {
  const w = WALLPAPERS[index]!
  const on = useStore(wallpaper, (s) => s.at === index)
  const panel = useRef<HTMLDivElement>(null)

  // Opened, it has the keyboard: the arrows and Escape are heard here
  useEffect(() => {
    focusFirst(panel.current?.querySelector('.vip-look__close'))
  }, [])

  const step = (by: -1 | 1) => {
    if (WALLPAPERS[index + by]) onLook(index + by)
  }
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onLook(null)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      step(e.key === 'ArrowRight' ? 1 : -1)
    }
  }

  return (
    <div ref={panel} className="vip-look walls-look" role="dialog" aria-label={`${describe(w)}. ${index + 1} of ${WALLPAPERS.length}.`} onKeyDown={keys}>
      <div className="vip-look__bar">
        <button type="button" className="vip-look__button vip-look__close" aria-label="Close" onClick={() => onLook(null)}>
          <X size={17} strokeWidth={2.4} aria-hidden />
        </button>
        <span className="vip-look__title">
          <b>{w.name}</b>
          <span>
            {w.width} × {w.height}
          </span>
        </span>
        {/* On the desk already, the button says so and does nothing more */}
        <button type="button" className="walls-act" data-on={on || undefined} aria-pressed={on} onClick={() => setWallpaper(index)}>
          {on && <Check size={14} strokeWidth={2.8} aria-hidden />}
          {on ? 'On the Desktop' : 'Set as Wallpaper'}
        </button>
        {/* The file itself, at its full size: the browser keeps it under the name it has here */}
        <a className="walls-act" href={w.full} download={w.full.split('/').pop()} draggable={false}>
          <Download size={14} strokeWidth={2.4} aria-hidden />
          Download
          <span className="walls-act__size">
            <span className="sr-only">, a JPEG of </span>
            {sizeOf(w.bytes)}
          </span>
        </a>
      </div>
      <div className="vip-look__stage">
        <img key={w.src} className="vip-look__media" src={w.src} width={w.width} height={w.height} alt={describe(w)} draggable={false} />
        <button type="button" className="vip-look__button vip-look__step" data-side="back" aria-label="Previous" aria-disabled={index === 0 || undefined} onClick={() => step(-1)}>
          <ChevronLeft size={20} strokeWidth={2.4} aria-hidden />
        </button>
        <button type="button" className="vip-look__button vip-look__step" data-side="on" aria-label="Next" aria-disabled={index === WALLPAPERS.length - 1 || undefined} onClick={() => step(1)}>
          <ChevronRight size={20} strokeWidth={2.4} aria-hidden />
        </button>
      </div>
    </div>
  )
}

export function WallpapersApp() {
  const at = useStore(wallpaper, (s) => s.at)
  /** The wallpaper opened large, or none: the grid. */
  const [look, setLook] = useState<number | null>(null)
  const browse = useRef<HTMLDivElement>(null)
  /** The tile that was open, to give the keyboard back to. */
  const left = useRef(-1)

  // Back at the grid: the keyboard is on the tile that was open
  useLayoutEffect(() => {
    if (look !== null) {
      left.current = look
      return
    }
    if (left.current < 0) return
    focusFirst(browse.current?.querySelector(`[data-tile="${left.current}"]`))
    left.current = -1
  }, [look])

  return (
    <Window
      className="app vip walls"
      title="Wallpapers"
      lightsSize="large"
      barSize="tall"
      toolbar={<Auto />}
      body={{
        className: `vip__body scrolls${look !== null ? ' vip__body--look' : ''}`,
        tabIndex: look !== null ? undefined : 0,
        role: 'group',
        'aria-label': 'Wallpapers',
      }}
    >
      <div ref={browse} className="vip__browse" style={look !== null ? { display: 'none' } : undefined}>
        <div className="vip__head">
          <h2 className="vip__title">Wallpapers</h2>
          <p className="vip__sub">Each visit opens on the next one. Open one to keep it on the desktop, or to download it.</p>
        </div>
        <div className="walls__grid">
          {WALLPAPERS.map((w, index) => (
            <button key={w.id} type="button" className="vip-tile vip-tile--open walls-tile" data-tile={index} data-on={index === at || undefined} onClick={() => setLook(index)}>
              <img className="vip-tile__media" src={w.small} alt="" loading="lazy" draggable={false} />
              <span className="vip-tile__cap">
                <b>
                  {w.name}
                  <span className="sr-only">, wallpaper{index === at ? ', on the desktop now' : ''}. Open it.</span>
                </b>
              </span>
              {index === at && (
                <span className="walls-tile__on" aria-hidden>
                  <Check size={12} strokeWidth={3.2} />
                  On the Desktop
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      {look !== null && <Look index={look} onLook={setLook} />}
    </Window>
  )
}
