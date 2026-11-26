import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useNewReplies } from '../apps/state'
import { APPS, GUEST_APPS, type AppId } from './apps'
import { FIXED, dropOnDesk, layout, offDock, toDock } from './layout'
import { dockPoint, prefersReducedMotion } from './dom'
import { AppIcon } from './icons'
import { useStore } from './store'
import { activeApp, closeApp, focusApp, focusWindow, minimizeApp, openApp, wm } from './wm'

// The Dock: one icon per app, a dot under the ones that are open, a hop when
// one launches, and icons that swell under the pointer (unless the visitor
// has asked for less motion). Minimized windows go back into their app's
// icon, and the group chat's icon counts the replies that came in while the
// conversation wasn't showing.
//
// Every icon opens a window. VIP Store is last: it was a link to the points
// site, and is the store in a window now (apps/Store.tsx). The one-pager,
// which was after a rule at the Dock's end, is a file on the desk.
//
// After the apps, and a rule, are the apps that are here only while they have
// something open: Preview, when a document is. With none open there is no rule.
//
// Which apps are here, and in what order, is the layout's (layout.ts). An icon
// can be dragged along the Dock to another place in it, or up out of it onto
// the desk, where it stays; an app's icon on the desk can be dragged in. The
// first icon stays where it is, as the Finder's does on a Mac.
//
// A right click on an icon (or the menu key, with the keyboard on it) opens its menu, as a Mac's Dock has:
// Open, Remove from Dock (the icon goes to the desk), and for an app that is open, Hide and Quit.

/** One icon's menu: a small sheet of glass over it, with a point at its foot. */
function DockMenu({ id, x, inDock, open, onClose }: { id: AppId; x: number; inDock: boolean; open: boolean; onClose: (refocus: boolean) => void }) {
  const sheet = useRef<HTMLDivElement>(null)
  const showing = useStore(wm, (s) => s.wins[id].open && !s.wins[id].minimized)
  // Kept inside the screen: the point stays over the icon
  const left = Math.max(104, Math.min(window.innerWidth - 104, x))
  useEffect(() => {
    sheet.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const away = (e: PointerEvent) => !sheet.current?.contains(e.target as Node) && onClose(false)
    const gone = () => onClose(false)
    document.addEventListener('pointerdown', away, true)
    window.addEventListener('blur', gone)
    window.addEventListener('resize', gone)
    return () => {
      document.removeEventListener('pointerdown', away, true)
      window.removeEventListener('blur', gone)
      window.removeEventListener('resize', gone)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(sheet.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const at = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape' || e.key === 'Tab') return e.preventDefault(), e.stopPropagation(), onClose(true)
    const to = e.key === 'ArrowDown' ? (at + 1) % items.length : e.key === 'ArrowUp' ? (at - 1 + items.length) % items.length : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : -1
    if (to < 0) return
    e.preventDefault()
    e.stopPropagation()
    items[to]?.focus()
  }
  const item = (label: string, does: () => void, refocus = false) => (
    <button type="button" role="menuitem" className="dock-menu__item" onClick={() => (onClose(refocus), does())}>
      {label}
    </button>
  )
  return (
    <div ref={sheet} className="dock-menu" role="menu" aria-label={APPS[id].name} style={{ left, ['--point' as string]: `${x - left}px` }} onKeyDown={onKey} onContextMenu={(e) => e.preventDefault()}>
      {!showing && item(open ? 'Show' : 'Open', () => (openApp(id, dockPoint(id)), focusWindow(id)))}
      {showing && item('Show', () => (focusApp(id), focusWindow(id)))}
      {inDock && id !== FIXED && item('Remove from Dock', () => offDock(id))}
      {open && (
        <>
          <span className="dock-menu__rule" role="separator" />
          {showing && item('Hide', () => minimizeApp(id, dockPoint(id)), true)}
          {item('Quit', () => closeApp(id), true)}
        </>
      )}
    </div>
  )
}

/** How much the icon under the pointer grows, and how far the swell reaches. */
const SWELL = 0.55
const REACH = 150

export function Dock() {
  const compact = useStore(wm, (s) => s.compact)
  const DOCK = useStore(layout, (s) => s.dock)
  const inDock = DOCK.join(' ')
  const openApps = useStore(wm, (s) => [...(inDock.split(' ') as AppId[]), ...GUEST_APPS].filter((id) => s.wins[id].open).join(' '))
  const active = useStore(wm, activeApp)
  const unread = useNewReplies()
  const shelf = useRef<HTMLDivElement>(null)
  const [hopping, setHopping] = useState<AppId | null>(null)
  const frame = useRef(0)
  /** The icon whose menu is open, and where its middle is. */
  const [menu, setMenu] = useState<{ id: AppId; x: number } | null>(null)

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

  const guests = GUEST_APPS.filter((id) => open.includes(id) && !DOCK.includes(id))

  /** A press that became a drag has moved the icon: the click that ends it opens nothing. */
  const dragged = useRef(false)
  /** A drag: the icon follows the pointer. Let go along the Dock, it takes that place; let go above it, it is out on the desk. */
  const drag = (e: ReactPointerEvent<HTMLButtonElement>, id: AppId) => {
    dragged.current = false
    if (e.pointerType === 'touch' || e.button !== 0 || compact || id === FIXED || !DOCK.includes(id)) return
    const el = e.currentTarget
    const from = { x: e.clientX, y: e.clientY }
    let moved = false
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - from.x
      const dy = ev.clientY - from.y
      if (!moved && Math.hypot(dx, dy) < 6) return
      if (!moved) {
        moved = true
        dragged.current = true
        el.setAttribute('data-dragging', '')
        document.documentElement.setAttribute('data-wm-busy', '')
        swell(null)
      }
      el.style.transform = `translate(${dx}px, ${dy}px)`
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (!moved) return
      el.style.transform = ''
      el.removeAttribute('data-dragging')
      document.documentElement.removeAttribute('data-wm-busy')
      const bar = shelf.current?.getBoundingClientRect()
      if (ev.type === 'pointercancel' || !bar) return
      if (ev.clientY < bar.top - 28) {
        // Up out of the Dock: on the desk, where it was let go
        const left = Math.max(8, Math.min(window.innerWidth - 100, ev.clientX - 46))
        const top = Math.max(34, Math.min(bar.top - 100, ev.clientY - 40))
        // (or, let go of over the line of icons down the right, into the line there)
        return dropOnDesk(id, { r: Math.round(window.innerWidth - left - 92), t: Math.round(top) })
      }
      // Along the Dock: before whichever of the others is to the right of where it was let go
      const others = [...(shelf.current?.querySelectorAll<HTMLElement>('[data-dock-item]:not([data-guest])') ?? [])].filter((icon) => icon !== el)
      toDock(id, others.filter((icon) => icon.getBoundingClientRect().left + icon.getBoundingClientRect().width / 2 < ev.clientX).length)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const tile = (id: AppId) => (
    <button
      key={id}
      type="button"
      className="dock__item"
      data-dock-item
      data-dock-app={id}
      data-guest={!DOCK.includes(id) || undefined}
      data-open={open.includes(id) || undefined}
      aria-current={active === id || undefined}
      data-hop={hopping === id || undefined}
      aria-label={`${APPS[id].name}: ${APPS[id].blurb}${id === 'messages' && unread ? `, ${unread} unread` : ''}`}
      aria-haspopup="menu"
      aria-expanded={menu?.id === id || undefined}
      onPointerDown={(e) => drag(e, id)}
      onClick={() => !dragged.current && launch(id)}
      onContextMenu={(e) => {
        e.preventDefault()
        if (compact) return
        const r = e.currentTarget.getBoundingClientRect()
        swell(null)
        setMenu({ id, x: r.left + r.width / 2 })
      }}
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
  )

  return (
    <nav className="dock" aria-label="Dock" data-compact={compact || undefined} data-menu={menu ? '' : undefined}>
      {menu && (
        <DockMenu
          key={menu.id}
          id={menu.id}
          x={menu.x}
          inDock={DOCK.includes(menu.id)}
          open={open.includes(menu.id)}
          onClose={(refocus) => {
            const id = menu.id
            setMenu(null)
            if (refocus) setTimeout(() => shelf.current?.querySelector<HTMLElement>(`[data-dock-app="${id}"]`)?.focus(), 0)
          }}
        />
      )}
      <div
        ref={shelf}
        className="dock__shelf"
        onKeyDown={onKey}
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse' || compact || menu || prefersReducedMotion() || document.documentElement.hasAttribute('data-wm-busy')) return
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
        {DOCK.map(tile)}
        {guests.length > 0 && <span className="dock__rule" aria-hidden />}
        {guests.map(tile)}
      </div>
    </nav>
  )
}
