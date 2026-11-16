import { APPS, APP_IDS, type AppId, type Size } from './apps'
import { createStore } from './store'

// The window manager: which windows are open, where they are, which is in
// front. Everything a window can do (open from the Dock, close, minimise into
// its icon, zoom, tile to half the screen, be dragged and resized) ends up as
// one of the functions below.

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

/** fill: the whole desktop. left and right: half of it. */
export type Tile = 'fill' | 'left' | 'right'

export interface Win {
  id: AppId
  /** Opened at least once. Its contents stay mounted from then on, so a
   * closed window comes back as it was left. */
  mounted: boolean
  open: boolean
  minimized: boolean
  /** Its free position and size. */
  rect: Rect
  /** Tiled or zoomed: the rect is kept to go back to. */
  tile: Tile | null
  /** opening and closing play once and clear themselves. */
  phase: 'opening' | 'closing' | null
  /** Its geometry is easing to a new place (zoom, tile), not being dragged. */
  glide: boolean
  /** Where it opens from and minimises to: its Dock icon. */
  origin: Point | null
}

export interface WM {
  wins: Record<AppId, Win>
  /** Back to front. */
  order: AppId[]
  /** The desk the windows are laid out on: the screen, unless one has been lent (see lendDesk). */
  viewport: Size
  /** That desk is phone-sized: too small for windows to be moved about on. */
  compact: boolean
  /** The screen itself is phone-sized, whatever desk the windows are on: the
   * desktop gives way to the phone layout (src/phone). */
  phone: boolean
  /** The outline shown while a dragged window is held against an edge. */
  preview: Tile | null
}

/** Space between tiled windows and the screen's edges, as macOS leaves it. */
export const GAP = 8

export const metrics = (compact: boolean) => ({
  /** The menu bar's height. */
  bar: compact ? 36 : 28,
  /** Room kept clear for the Dock under a zoomed or tiled window. */
  dock: compact ? 74 : 82,
})

const isCompact = (v: Size) => v.w < 760 || v.h < 480

const viewportNow = (): Size => (typeof window === 'undefined' ? { w: 1440, h: 900 } : { w: window.innerWidth, h: window.innerHeight })

const blank = (id: AppId): Win => ({
  id,
  mounted: false,
  open: false,
  minimized: false,
  rect: { x: 0, y: 0, w: 0, h: 0 },
  tile: null,
  phase: null,
  glide: false,
  origin: null,
})

const initialViewport = viewportNow()

/** The screen's own size, as last reported. */
let screenSize: Size = initialViewport
/** A desk lent in place of the screen's, and how a point on the screen falls on it. */
let lent: { size: Size; onto: (point: Point) => Point } | null = null

export const wm = createStore<WM>({
  wins: Object.fromEntries(APP_IDS.map((id) => [id, blank(id)])) as Record<AppId, Win>,
  order: [],
  viewport: initialViewport,
  compact: isCompact(initialViewport),
  phone: isCompact(initialViewport),
  preview: null,
})

// ---- Geometry ----

/** The part of the screen windows live in: under the menu bar, above the Dock. */
export function desk(viewport: Size, compact: boolean): Rect {
  const m = metrics(compact)
  return { x: 0, y: m.bar, w: viewport.w, h: Math.max(160, viewport.h - m.bar - m.dock) }
}

export function tileRect(tile: Tile, viewport: Size, compact: boolean): Rect {
  const d = desk(viewport, compact)
  if (compact) return d
  const y = d.y + GAP
  const h = d.h - GAP * 2
  if (tile === 'fill') return { x: GAP, y, w: d.w - GAP * 2, h }
  const half = Math.floor((d.w - GAP * 3) / 2)
  return tile === 'left' ? { x: GAP, y, w: half, h } : { x: d.w - GAP - half, y, w: half, h }
}

/** Where a window is drawn right now. */
export function geometry(win: Win, viewport: Size, compact: boolean): Rect {
  if (compact) return APPS[win.id].resizable ? tileRect('fill', viewport, true) : centered(win.id, viewport, true)
  return win.tile ? tileRect(win.tile, viewport, false) : win.rect
}

function centered(id: AppId, viewport: Size, compact: boolean): Rect {
  const spec = APPS[id]
  const d = desk(viewport, compact)
  const size = spec.size({ w: d.w, h: d.h })
  const w = Math.min(size.w, d.w - (compact ? 24 : 0))
  const h = Math.min(size.h, d.h - (compact ? 16 : 0))
  return inside(
    {
      x: Math.round(d.x + (d.w - w) / 2 + (compact ? 0 : spec.nudge.x)),
      y: Math.round(d.y + (d.h - h) / 2 + (compact ? 0 : spec.nudge.y)),
      w,
      h,
    },
    d,
  )
}

/** Moves a rect wholly inside a box when it fits, and to the box's top left when it doesn't. */
function inside(r: Rect, box: Rect): Rect {
  const x = Math.max(box.x, Math.min(r.x, box.x + box.w - r.w))
  const y = Math.max(box.y, Math.min(r.y, box.y + box.h - r.h))
  return { x: Math.round(x), y: Math.round(y), w: Math.round(r.w), h: Math.round(r.h) }
}

/** Keeps a dragged window reachable: its bar under the menu bar, above the
 * Dock, and with enough of it on screen to take hold of. */
export function clampRect(r: Rect, viewport: Size, compact: boolean): Rect {
  const d = desk(viewport, compact)
  const keep = 96
  const x = Math.min(viewport.w - keep, Math.max(keep - r.w, r.x))
  const y = Math.min(d.y + d.h - 44, Math.max(d.y, r.y))
  return { x: Math.round(x), y: Math.round(y), w: Math.round(r.w), h: Math.round(r.h) }
}

/** Brings a window back onto a desk that changed size: no bigger than the
 * desk, and wholly on it. */
function refit(win: Win, viewport: Size): Win {
  if (!win.mounted) return win
  const spec = APPS[win.id]
  const d = desk(viewport, false)
  const w = spec.resizable ? Math.max(Math.min(spec.min.w, d.w), Math.min(win.rect.w, d.w)) : win.rect.w
  const h = spec.resizable ? Math.max(Math.min(spec.min.h, d.h), Math.min(win.rect.h, d.h)) : Math.min(win.rect.h, d.h)
  const rect = inside({ ...win.rect, w, h }, d)
  const same = rect.x === win.rect.x && rect.y === win.rect.y && rect.w === win.rect.w && rect.h === win.rect.h
  return same ? win : { ...win, rect }
}

// ---- Reading ----

export const isShowing = (win: Win) => win.open && !win.minimized && win.phase !== 'closing'

/** The window in front, the one the menu bar speaks for. */
export function activeApp(state: WM): AppId | null {
  for (let i = state.order.length - 1; i >= 0; i--) {
    const id = state.order[i]!
    if (isShowing(state.wins[id])) return id
  }
  return null
}

// ---- Changing ----

const patch = (id: AppId, change: Partial<Win> | ((win: Win) => Partial<Win>)) =>
  wm.set((s) => {
    const win = s.wins[id]
    const next = typeof change === 'function' ? change(win) : change
    return { ...s, wins: { ...s.wins, [id]: { ...win, ...next } } }
  })

const raise = (order: AppId[], id: AppId) => (order[order.length - 1] === id ? order : [...order.filter((x) => x !== id), id])

const timers = new Map<string, ReturnType<typeof setTimeout>>()
function later(key: string, ms: number, fn: () => void) {
  clearTimeout(timers.get(key))
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key)
      fn()
    }, ms),
  )
}

/** A point on the screen (a Dock icon's middle), as a point on the desk the windows are on. */
const onDesk = (point: Point | null) => (point && lent ? lent.onto(point) : point)

/** Opens an app's window, or brings it back and to the front. */
export function openApp(id: AppId, origin: Point | null = null) {
  const s = wm.get()
  const win = s.wins[id]
  if (win.open && !win.minimized && win.phase !== 'closing') return focusApp(id)
  clearTimeout(timers.get(`close:${id}`))
  const fresh = !win.mounted
  const restoring = win.open && win.minimized
  wm.set({
    ...s,
    order: raise(s.order, id),
    wins: {
      ...s.wins,
      [id]: {
        ...win,
        mounted: true,
        open: true,
        minimized: false,
        rect: fresh ? centered(id, s.viewport, s.compact) : s.compact ? win.rect : refit(win, s.viewport).rect,
        // A minimised window glides back out of its icon; a closed one opens
        phase: restoring ? null : 'opening',
        origin: onDesk(origin) ?? win.origin,
      },
    },
  })
  if (!restoring) later(`phase:${id}`, 460, () => patch(id, (w) => (w.phase === 'opening' ? { phase: null } : {})))
}

export function closeApp(id: AppId) {
  const win = wm.get().wins[id]
  if (!win.open || win.phase === 'closing') return
  patch(id, { phase: 'closing' })
  later(`close:${id}`, 190, () => patch(id, { open: false, minimized: false, phase: null }))
}

export function minimizeApp(id: AppId, origin: Point | null = null) {
  const win = wm.get().wins[id]
  if (!win.open || win.minimized) return
  patch(id, { minimized: true, origin: onDesk(origin) ?? win.origin })
}

export function focusApp(id: AppId) {
  wm.set((s) => {
    const order = raise(s.order, id)
    return order === s.order ? s : { ...s, order }
  })
}

function glide(id: AppId, change: Partial<Win>) {
  patch(id, { ...change, glide: true })
  later(`glide:${id}`, 420, () => patch(id, { glide: false }))
}

/** The green light: fills the desktop, or goes back to the size it was. */
export function toggleZoom(id: AppId) {
  const win = wm.get().wins[id]
  if (!APPS[id].resizable || wm.get().compact) return
  glide(id, { tile: win.tile ? null : 'fill' })
  focusApp(id)
}

export function tileApp(id: AppId, tile: Tile | null) {
  if (!APPS[id].resizable || wm.get().compact) return
  glide(id, { tile })
  focusApp(id)
}

/** A drag or resize has ended: this is where the window is now. */
export function placeApp(id: AppId, rect: Rect) {
  const s = wm.get()
  patch(id, { rect: clampRect(rect, s.viewport, s.compact), tile: null, glide: false })
}

export function setPreview(preview: Tile | null) {
  wm.set((s) => (s.preview === preview ? s : { ...s, preview }))
}

export function bringAllToFront() {
  wm.set((s) => ({
    ...s,
    wins: Object.fromEntries(APP_IDS.map((id) => [id, s.wins[id].open ? { ...s.wins[id], minimized: false } : s.wins[id]])) as Record<AppId, Win>,
  }))
}

/** Every window brought onto a desk of this size. */
const refitAll = (wins: Record<AppId, Win>, viewport: Size) => Object.fromEntries(APP_IDS.map((id) => [id, refit(wins[id], viewport)])) as Record<AppId, Win>

/** The screen changed size. */
export function setViewport(viewport: Size) {
  screenSize = viewport
  wm.set((s) => {
    const phone = isCompact(viewport)
    // On a lent desk the windows stay where they are: only what the screen is has changed
    if (lent) return s.phone === phone ? s : { ...s, phone }
    if (s.viewport.w === viewport.w && s.viewport.h === viewport.h && s.phone === phone) return s
    // A phone-sized screen draws its own layout and never reads these rects:
    // leave them as they are, to come back to
    return { ...s, viewport, compact: phone, phone, wins: phone ? s.wins : refitAll(s.wins, viewport), preview: null }
  })
}

/** Lays the windows out on a desk of a size of its own, whatever the screen's.
 * The phone's "window" version does this: it draws the Mac at desktop size and
 * looks at it through the phone. `onto` turns a point on the screen into a
 * point on that desk. Returns the way to give the desk back. */
export function lendDesk(size: Size, onto: (point: Point) => Point): () => void {
  const mine = { size, onto }
  lent = mine
  wm.set((s) => ({ ...s, viewport: size, compact: false, wins: refitAll(s.wins, size), preview: null }))
  return () => {
    if (lent !== mine) return
    lent = null
    const phone = isCompact(screenSize)
    wm.set((s) => ({ ...s, viewport: screenSize, compact: phone, phone, wins: phone ? s.wins : refitAll(s.wins, screenSize), preview: null }))
  }
}

/** Puts the keyboard in a window: on what it marks to take it, or on the window itself. */
export function focusWindow(id: AppId) {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(`.wf[data-app="${id}"]`)
    if (!el || el.hasAttribute('inert')) return
    if (el.contains(document.activeElement) && document.activeElement !== el) return
    ;(el.querySelector<HTMLElement>('[data-autofocus]') ?? el).focus({ preventScroll: true })
  })
}
