import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Popover } from '../kit/motion/Popover'
import { APPS, type AppId, type Size } from './apps'
import { dockPoint } from './dom'
import { useStore } from './store'
import { activeApp, clampRect, closeApp, focusApp, geometry, metrics, minimizeApp, placeApp, setPreview, tileApp, toggleZoom, wm, type Rect, type Tile } from './wm'

// One window on the desktop. The kit draws the chrome (the bar, the sidebar,
// the lights' place); this wraps it with everything a real window does: it
// comes to the front when touched, drags by its bar, resizes from its edges,
// and its traffic lights close, minimise and zoom it.

/** Where a press starts a drag: the kit's bars, and anything marked data-drag. */
const DRAG = '.ss-window__bar, .ss-window__side-top, .ss-window__tabs, [data-drag]'
/** ...unless it lands on a control. */
const NO_DRAG = 'button, a, input, textarea, select, label, [role="button"], [role="option"], [role="radio"], [role="tab"], [data-nodrag]'

/** The tiles the green light offers, each with where its half sits in the little screen. */
const TILES: { tile: Tile; label: string; x: number; w: number }[] = [
  { tile: 'left', label: 'Left', x: 3, w: 9.5 },
  { tile: 'right', label: 'Right', x: 13.5, w: 9.5 },
  { tile: 'fill', label: 'Fill', x: 3, w: 20 },
]

type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const EDGES: Edge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

function resized(start: Rect, edge: Edge, dx: number, dy: number, min: Size, viewport: Size, bar: number): Rect {
  let { x, y, w, h } = start
  if (edge.includes('e')) w = Math.min(Math.max(min.w, start.w + dx), viewport.w - start.x)
  if (edge.includes('s')) h = Math.min(Math.max(min.h, start.h + dy), viewport.h - start.y)
  if (edge.includes('w')) {
    const right = start.x + start.w
    x = Math.min(Math.max(0, start.x + dx), right - min.w)
    w = right - x
  }
  if (edge.includes('n')) {
    const bottom = start.y + start.h
    y = Math.min(Math.max(bar, start.y + dy), bottom - min.h)
    h = bottom - y
  }
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }
}

/** The edge a dragged window is being held against, if any. */
function zone(x: number, y: number, viewport: Size, bar: number): Tile | null {
  if (x <= 3) return 'left'
  if (x >= viewport.w - 4) return 'right'
  if (y <= bar + 1) return 'fill'
  return null
}

export function WindowFrame({ id, children }: { id: AppId; children: ReactNode }) {
  const win = useStore(wm, (s) => s.wins[id])
  const z = useStore(wm, (s) => s.order.indexOf(id))
  const active = useStore(wm, (s) => activeApp(s) === id)
  const compact = useStore(wm, (s) => s.compact)
  const viewport = useStore(wm, (s) => s.viewport)
  const ref = useRef<HTMLElement>(null)
  const spec = APPS[id]
  const geo = geometry(win, viewport, compact)
  const hidden = !win.open || win.minimized
  const live = useRef({ geo, win, viewport, compact })
  live.current = { geo, win, viewport, compact }

  // Resting the pointer on the green light offers the ways to tile, as the
  // system does; a click still just zooms
  const [tiles, setTiles] = useState(false)
  const tileTimer = useRef<ReturnType<typeof setTimeout>>()
  const tilesSoon = (show: boolean, ms: number) => {
    clearTimeout(tileTimer.current)
    tileTimer.current = setTimeout(() => setTiles(show), ms)
  }
  useEffect(() => () => clearTimeout(tileTimer.current), [])

  // The window in front takes the keyboard, unless something still showing
  // already has it: a window that opens, one that comes forward when another
  // closes or minimises, one picked from a menu
  const shown = win.open && !win.minimized
  useEffect(() => {
    if (!shown || !active) return
    const el = ref.current
    const held = document.activeElement as HTMLElement | null
    if (!el || el.contains(held)) return
    const loose = !held || held === document.body || !!held.closest('[inert]') || !!held.closest('.wf')
    if (!loose) return
    ;(el.querySelector<HTMLElement>('[data-autofocus]') ?? el).focus({ preventScroll: true })
  }, [shown, active])

  // A drag writes the frame's place straight to the element. Once it ends,
  // what's drawn is put back in step with what the window manager says:
  // React only rewrites the values that changed since its last render
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || el.hasAttribute('data-moving')) return
    el.style.left = `${geo.x}px`
    el.style.top = `${geo.y}px`
    el.style.width = `${geo.w}px`
    el.style.height = `${geo.h}px`
  })

  // Escape puts the tiling choices away
  useEffect(() => {
    if (!tiles) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTiles(false)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [tiles])

  if (!win.mounted) return null

  const apply = (r: Rect) => {
    const el = ref.current
    if (!el) return
    el.style.left = `${r.x}px`
    el.style.top = `${r.y}px`
    el.style.width = `${r.w}px`
    el.style.height = `${r.h}px`
  }

  /** Follows the pointer until it lifts, then hands the last rect to `done`. */
  const track = (e: ReactPointerEvent, step: (dx: number, dy: number, ev: PointerEvent) => Rect | null, done: (last: Rect | null) => void) => {
    const el = ref.current
    if (!el) return
    const from = { x: e.clientX, y: e.clientY }
    const pointer = e.pointerId
    let last: Rect | null = null
    let frame = 0
    let latest: PointerEvent | null = null
    const paint = () => {
      frame = 0
      if (!latest) return
      const next = step(latest.clientX - from.x, latest.clientY - from.y, latest)
      if (next) {
        last = next
        apply(next)
      }
    }
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointer) return
      latest = ev
      if (!frame) frame = requestAnimationFrame(paint)
    }
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointer) return
      if (frame) cancelAnimationFrame(frame)
      if (ev.type === 'pointerup') {
        latest = ev
        paint()
      }
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      el.removeAttribute('data-moving')
      document.documentElement.removeAttribute('data-wm-busy')
      done(last)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const startDrag = (e: ReactPointerEvent) => {
    if (e.button !== 0 || live.current.compact) return
    const target = e.target as HTMLElement
    if (!target.closest(DRAG) || target.closest(NO_DRAG)) return
    const el = ref.current
    if (!el) return
    const { geo: start, win: w, viewport: vp } = live.current
    const bar = metrics(false).bar
    let base = start
    let moved = false
    let snap: Tile | null = null
    track(
      e,
      (dx, dy, ev) => {
        if (!moved) {
          if (Math.hypot(dx, dy) < 4) return null
          moved = true
          el.setAttribute('data-moving', 'drag')
          document.documentElement.setAttribute('data-wm-busy', 'drag')
          // Pulled out of a tile, it takes its own size back under the pointer
          if (w.tile) {
            const f = (e.clientX - start.x) / start.w
            base = { x: Math.round(e.clientX - f * w.rect.w), y: start.y, w: w.rect.w, h: w.rect.h }
          }
        }
        snap = spec.resizable ? zone(ev.clientX, ev.clientY, vp, bar) : null
        setPreview(snap)
        return clampRect({ ...base, x: base.x + dx, y: base.y + dy }, vp, false)
      },
      (last) => {
        setPreview(null)
        if (!moved || !last) return
        // Held against an edge, it tiles there and keeps the place it was
        // dragged from to go back to
        placeApp(id, snap ? (w.tile ? w.rect : start) : last)
        if (snap) tileApp(id, snap)
      },
    )
  }

  const startResize = (edge: Edge) => (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const el = ref.current
    if (!el) return
    const { geo: start, viewport: vp } = live.current
    const bar = metrics(false).bar
    el.setAttribute('data-moving', 'resize')
    document.documentElement.setAttribute('data-wm-busy', edge)
    track(
      e,
      (dx, dy) => resized(start, edge, dx, dy, spec.min, vp, bar),
      (last) => {
        if (last) placeApp(id, last)
      },
    )
  }

  const origin = win.origin ?? { x: viewport.w / 2, y: viewport.h }
  const style = {
    left: geo.x,
    top: geo.y,
    width: geo.w,
    height: geo.h,
    zIndex: 10 + Math.max(0, z),
    '--ox': `${Math.round(origin.x - (geo.x + geo.w / 2))}px`,
    '--oy': `${Math.round(origin.y - (geo.y + geo.h / 2))}px`,
    '--lights-y': `${spec.lightsY}px`,
  } as CSSProperties

  return (
    <section
      ref={ref}
      className="wf"
      aria-label={spec.name}
      tabIndex={-1}
      data-app={id}
      data-active={active || undefined}
      data-open={win.open || undefined}
      data-min={win.minimized || undefined}
      data-phase={win.phase ?? undefined}
      data-glide={win.glide || undefined}
      data-tile={(!compact && win.tile) || undefined}
      data-fixed={!spec.resizable || undefined}
      style={style}
      onPointerDownCapture={() => focusApp(id)}
      onFocusCapture={() => focusApp(id)}
      onPointerDown={startDrag}
      onDoubleClick={(e) => {
        const target = e.target as HTMLElement
        if (target.closest(DRAG) && !target.closest(NO_DRAG)) toggleZoom(id)
      }}
      {...(hidden ? ({ inert: '' } as object) : null)}
    >
      <div className="wf__lights" data-nodrag>
        <button type="button" className="wf__light" data-kind="close" aria-label={`Close ${spec.name}`} onClick={() => closeApp(id)}>
          <svg viewBox="0 0 12 12" aria-hidden>
            <path d="M3.6 3.6l4.8 4.8M8.4 3.6L3.6 8.4" />
          </svg>
        </button>
        <button type="button" className="wf__light" data-kind="min" aria-label={`Minimise ${spec.name}`} disabled={!spec.resizable} onClick={() => minimizeApp(id, dockPoint(id))}>
          <svg viewBox="0 0 12 12" aria-hidden>
            <path d="M2.8 6h6.4" />
          </svg>
        </button>
        <button
          type="button"
          className="wf__light"
          data-kind="zoom"
          aria-label={win.tile ? `Restore ${spec.name}` : `Zoom ${spec.name}`}
          disabled={!spec.resizable || compact}
          onPointerEnter={(e) => {
            if (e.pointerType === 'mouse') tilesSoon(true, 520)
          }}
          onPointerLeave={() => tilesSoon(false, 240)}
          onClick={() => {
            tilesSoon(false, 0)
            toggleZoom(id)
          }}
        >
          <svg viewBox="0 0 12 12" aria-hidden>
            {win.tile ? <path className="wf__light-fill" d="M6.6 2.9v2.5h2.5zM5.4 9.1V6.6H2.9z" /> : <path className="wf__light-fill" d="M3.4 3.4h3.3L3.4 6.7zM8.6 8.6H5.3l3.3-3.3z" />}
          </svg>
        </button>
      </div>
      <div className="wf__content">{children}</div>
      {!compact && spec.resizable && (
        <Popover show={tiles} origin="top left" className="tile-menu" role="group" aria-label="Move and resize" onPointerEnter={() => clearTimeout(tileTimer.current)} onPointerLeave={() => tilesSoon(false, 240)} {...(tiles ? null : ({ inert: '' } as object))}>
          <div className="tile-menu__label">Move &amp; Resize</div>
          <div className="tile-menu__row">
            {TILES.map((option) => (
              <button
                key={option.tile}
                type="button"
                className="tile-menu__option"
                aria-label={option.label}
                aria-pressed={win.tile === option.tile}
                onClick={() => {
                  setTiles(false)
                  tileApp(id, win.tile === option.tile ? null : option.tile)
                }}
              >
                <svg viewBox="0 0 26 18" width="26" height="18" aria-hidden>
                  <rect x="1" y="1" width="24" height="16" rx="3.5" className="tile-menu__screen" />
                  <rect x={option.x} y="3" width={option.w} height="12" rx="1.8" className="tile-menu__part" />
                </svg>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </Popover>
      )}
      {!compact && spec.resizable && EDGES.map((edge) => <span key={edge} className="wf__grip" data-edge={edge} onPointerDown={startResize(edge)} aria-hidden />)}
    </section>
  )
}
