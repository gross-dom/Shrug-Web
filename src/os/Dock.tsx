import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useNewReplies } from '../apps/state'
import { SITE } from '../data/site'
import { APPS, DOCK_APPS, type AppId } from './apps'
import { dockPoint, prefersReducedMotion } from './dom'
import { AppIcon, DocumentIcon, VipIcon } from './icons'
import { useStore } from './store'
import { activeApp, focusApp, focusWindow, openApp, wm } from './wm'

// The Dock: one icon per app, a dot under the ones that are open, a hop when
// one launches, and icons that swell under the pointer (unless the visitor
// has asked for less motion). Minimized windows go back into their app's
// icon, and the group chat's icon counts the replies that came in while the
// conversation wasn't showing.
//
// Two of its icons are links and open no window: VIP, last among the apps,
// which is the way to the points site, and the one-pager after the rule.
// Each opens in a tab of its own and says so.

/** How much the icon under the pointer grows, and how far the swell reaches. */
const SWELL = 0.55
const REACH = 150

export function Dock() {
  const compact = useStore(wm, (s) => s.compact)
  const openApps = useStore(wm, (s) => DOCK_APPS.filter((id) => s.wins[id].open).join(' '))
  const active = useStore(wm, activeApp)
  const unread = useNewReplies()
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
    if (!win.open) {
      setHopping(id)
      setTimeout(() => setHopping((h) => (h === id ? null : h)), 760)
    }
    if (win.open && !win.minimized) focusApp(id)
    else openApp(id, dockPoint(id))
    // The window that was asked for takes the keyboard, wherever focus was
    focusWindow(id)
  }

  const open = openApps.split(' ')

  /** Along the Dock with the arrows, as along a Mac's: left and right from icon to icon, Home and End to
   * its ends. (Tab still stops on each, so nothing that worked before is taken away.) */
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    const items = Array.from(shelf.current?.querySelectorAll<HTMLElement>('[data-dock-item]') ?? [])
    const at = items.indexOf(document.activeElement as HTMLElement)
    const to = e.key === 'ArrowRight' ? at + 1 : e.key === 'ArrowLeft' ? at - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : -1
    if (at < 0 || to < 0 || to >= items.length) return
    e.preventDefault()
    items[to]!.focus()
  }

  return (
    <nav className="dock" aria-label="Dock" data-compact={compact || undefined}>
      <div
        ref={shelf}
        className="dock__shelf"
        onKeyDown={onKey}
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse' || compact || prefersReducedMotion() || document.documentElement.hasAttribute('data-wm-busy')) return
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
            aria-label={`${APPS[id].name}: ${APPS[id].blurb}${id === 'messages' && unread ? `, ${unread} unread` : ''}`}
            onClick={() => launch(id)}
          >
            <span className="dock__label" aria-hidden>
              {APPS[id].name}
            </span>
            <span className="dock__icon">
              <AppIcon id={id} />
              {id === 'messages' && unread > 0 && (
                <span className="dock__badge" data-digits={String(unread).length} aria-hidden>
                  {unread}
                </span>
              )}
            </span>
            <span className="dock__dot" aria-hidden />
          </button>
        ))}
        {/* VIP keeps its place, its tile and its name, and is a link: it has no window to open, no dot to
            light and nothing to hop for. The tab it opens is given no way back to this page, and is not
            told where the visit came from */}
        <a className="dock__item" data-dock-item data-dock-link="vip" href={SITE.points} target="_blank" rel="noopener noreferrer" draggable={false} aria-label="VIP, opens in a new tab">
          <span className="dock__label" aria-hidden>
            VIP
          </span>
          <span className="dock__icon">
            <VipIcon />
          </span>
          <span className="dock__dot" aria-hidden />
        </a>
        <span className="dock__rule" aria-hidden />
        <a className="dock__item" data-dock-item href={SITE.onePager} target="_blank" rel="noreferrer" draggable={false} aria-label="One-pager, opens in a new tab">
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
