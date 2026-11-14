import { useEffect, useRef, useState } from 'react'
import { SITE } from '../data/site'
import { APPS, DOCK_APPS, type AppId } from './apps'
import { dockPoint } from './dom'
import { AppIcon, DocumentIcon } from './icons'
import { useStore } from './store'
import { activeApp, focusApp, openApp, wm } from './wm'

// The Dock: one icon per app, a dot under the ones that are open, a hop when
// one launches, and icons that swell under the pointer. Minimised windows go
// back into their app's icon.

/** How much the icon under the pointer grows, and how far the swell reaches. */
const SWELL = 0.55
const REACH = 150

export function Dock() {
  const compact = useStore(wm, (s) => s.compact)
  const openApps = useStore(wm, (s) => DOCK_APPS.filter((id) => s.wins[id].open).join(' '))
  const active = useStore(wm, activeApp)
  const shelf = useRef<HTMLDivElement>(null)
  const [hopping, setHopping] = useState<AppId | null>(null)
  const frame = useRef(0)

  const swell = (x: number | null) => {
    const el = shelf.current
    if (!el) return
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-dock-item]'))
    // Measured before any is resized, so the swell follows the pointer, not itself
    const centers = items.map((item) => {
      const r = item.getBoundingClientRect()
      return r.left + r.width / 2
    })
    items.forEach((item, i) => {
      const d = x === null ? Infinity : Math.abs(x - centers[i]!)
      const k = d >= REACH ? 0 : Math.pow(Math.cos((d / REACH) * (Math.PI / 2)), 2)
      item.style.setProperty('--swell', (1 + SWELL * k).toFixed(3))
    })
  }

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const launch = (id: AppId) => {
    const win = wm.get().wins[id]
    if (win.open && !win.minimized) return focusApp(id)
    if (!win.open) {
      setHopping(id)
      setTimeout(() => setHopping((h) => (h === id ? null : h)), 760)
    }
    openApp(id, dockPoint(id))
  }

  const open = openApps.split(' ')

  return (
    <nav className="dock" aria-label="Dock" data-compact={compact || undefined}>
      <div
        ref={shelf}
        className="dock__shelf"
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse' || compact) return
          const x = e.clientX
          shelf.current?.removeAttribute('data-settling')
          cancelAnimationFrame(frame.current)
          frame.current = requestAnimationFrame(() => swell(x))
        }}
        onPointerLeave={() => {
          cancelAnimationFrame(frame.current)
          shelf.current?.setAttribute('data-settling', '')
          swell(null)
        }}
      >
        {DOCK_APPS.map((id) => (
          <button
            key={id}
            type="button"
            className="dock__item"
            data-dock-item
            data-dock-app={id}
            data-open={open.includes(id) || undefined}
            aria-current={active === id || undefined}
            data-hop={hopping === id || undefined}
            aria-label={`${APPS[id].name}: ${APPS[id].blurb}`}
            onClick={() => launch(id)}
          >
            <span className="dock__label" aria-hidden>
              {APPS[id].name}
            </span>
            <span className="dock__icon">
              <AppIcon id={id} />
            </span>
            <span className="dock__dot" aria-hidden />
          </button>
        ))}
        <span className="dock__rule" aria-hidden />
        <a className="dock__item" data-dock-item href={SITE.onePager} target="_blank" rel="noreferrer" aria-label="One-pager (opens in a new tab)">
          <span className="dock__label" aria-hidden>
            One-pager
          </span>
          <span className="dock__icon dock__icon--doc">
            <DocumentIcon />
          </span>
          <span className="dock__dot" aria-hidden />
        </a>
      </div>
    </nav>
  )
}
