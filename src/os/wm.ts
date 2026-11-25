import { isOn } from './address'
import { APPS, APP_IDS, type AppId, type Size } from './apps'
import { focusFirst, focusLost } from './focus'
import { createStore } from './store'

// The window manager: which windows are open, where they are, which is in
// front. Everything a window can do (open from the Dock, close, minimize into
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
  /** Its free position and size, as the visitor left them. */
  rect: Rect
  /** The size of the screen that rect was set on. On a screen of any other
   * size the window is drawn fitted to it and the rect is kept, so that when
   * the room comes back (a browser window grown again, a tablet turned back,
   * a keyboard put away) the window goes back to where it was put. */
  fits: Size
  /** Tiled or zoomed: the rect is kept to go back to. */
  tile: Tile | null
  /** opening and closing play once and clear themselves. */
  phase: 'opening' | 'closing' | null
  /** Its geometry is easing to a new place (zoom, tile), not being dragged. */
  glide: boolean
  /** Where it opens from and minimizes to: its Dock icon. */
  origin: Point | null
}

export interface WM {
  wins: Record<AppId, Win>
  /** Back to front. */
  order: AppId[]
  viewport: Size
  /** A phone-sized screen: the desktop gives way to the phone layout (src/phone). */
  compact: boolean
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

/** The address asks for the phone whatever the screen's size (`?phone`), or a page holding this one does. */
const asked = typeof window !== 'undefined' && (isOn('phone') || (window as { __shrugHost?: { phone?: boolean } }).__shrugHost?.phone === true)

/** Under this size the site is the iPhone. Every tablet is a desktop both ways up: the narrowest
 * current one, an iPad mini, is 744 across. (index.html's preloads, tools/page.ts and tools/preview.cjs
 * repeat these two numbers.) */
export const PHONE_UNDER: Size = { w: 740, h: 480 }

const isCompact = (v: Size) => asked || v.w < PHONE_UNDER.w || v.h < PHONE_UNDER.h

/** A text field has the caret. */
const typing = () => {
  const el = typeof document === 'undefined' ? null : document.activeElement
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)
}

const viewportNow = (): Size => (typeof window === 'undefined' ? { w: 1440, h: 900 } : { w: window.innerWidth, h: window.innerHeight })

const blank = (id: AppId): Win => ({
  id,
  mounted: false,
  open: false,
  minimized: false,
  rect: { x: 0, y: 0, w: 0, h: 0 },
  fits: { w: 0, h: 0 },
  tile: null,
  phase: null,
  glide: false,
  origin: null,
})

const initialViewport = viewportNow()

export const wm = createStore<WM>({
  wins: Object.fromEntries(APP_IDS.map((id) => [id, blank(id)])) as Record<AppId, Win>,
  order: [],
  viewport: initialViewport,
  compact: isCompact(initialViewport),
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
  return win.tile ? tileRect(win.tile, viewport, false) : freeRect(win, viewport)
}

/** Where a window sits when it is not tiled: its own rect on the screen that
 * rect was set on, and on a screen of any other size that rect fitted to it. */
export function freeRect(win: Win, viewport: Size): Rect {
  return win.fits.w === viewport.w && win.fits.h === viewport.h ? win.rect : fitted(win.id, win.rect, viewport)
}

/** The desk less the small margin a window keeps from its edges, as tiles do. */
function room(viewport: Size): Rect {
  const d = desk(viewport, false)
  return { x: d.x + GAP, y: d.y + GAP, w: d.w - GAP * 2, h: d.h - GAP * 2 }
}

/** A rect as a desk of this size can show it: no bigger than the desk and
 * wholly on it, with the margin where it fits that way. */
function fitted(id: AppId, rect: Rect, viewport: Size): Rect {
  const spec = APPS[id]
  const d = desk(viewport, false)
  const box = room(viewport)
  const w = spec.resizable ? Math.max(Math.min(spec.min.w, d.w), Math.min(rect.w, box.w)) : rect.w
  const h = spec.resizable ? Math.max(Math.min(spec.min.h, d.h), Math.min(rect.h, box.h)) : Math.min(rect.h, box.h)
  return inside({ ...rect, w, h }, w <= box.w && h <= box.h ? box : d)
}

/** How much of two rects is the same ground. */
function shared(a: Rect, b: Rect) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

/** How the desk's icons are laid out (styles/os.css, .desk, says the same): down the right-hand side from
 * under the menu bar to above the Dock, as far apart as a Mac puts them where the screen is tall enough
 * for them all in one line, closer together on a shorter one, and in a second line beside the first only
 * where they would otherwise be closer than `least`. */
export const DESK_ICONS = { top: 42, right: 12, bottom: 96, wide: 92, gap: 8, least: 64, most: 99 }

/** How many icons the desk has. The desktop says (Surface.tsx), as soon as it is loaded: the first window
 * can open before the desk has been drawn, and has to know what it is keeping clear of. */
let onDesk = 3
export const deskHolds = (count: number) => void (onDesk = count)

/** The icons left out on the desk, top right: where they are drawn (the icons themselves, not the strip
 * they are laid out in, which runs the height of the desk however few they are), or where the stylesheet
 * puts them if they have not been drawn yet. */
function deskIcons(viewport: Size): Rect {
  // (the line of them down the right: one that has been dragged off to a place of its own is not kept clear
  // of, any more than a window on a Mac keeps clear of an icon)
  const line = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('.desk')
  const drawn = line ? [...line.querySelectorAll<HTMLElement>('.desk__item')].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0) : []
  // The desk is drawn, and every icon has been moved out of the line: there is nothing there to keep clear of
  if (line && !drawn.length && line.isConnected && document.querySelector('.desk-free, .dock')) return { x: viewport.w, y: 0, w: 0, h: 0 }
  if (drawn.length) {
    const x = Math.min(...drawn.map((r) => r.left))
    const y = Math.min(...drawn.map((r) => r.top))
    return { x, y, w: Math.max(...drawn.map((r) => r.right)) - x, h: Math.max(...drawn.map((r) => r.bottom)) - y }
  }
  const { top, right, bottom, wide, gap, least, most } = DESK_ICONS
  const room = viewport.h - top - bottom + gap
  const pitch = Math.max(least, Math.min(most, room / onDesk))
  const each = Math.max(1, Math.min(onDesk, Math.floor(room / pitch)))
  const lines = Math.ceil(onDesk / each)
  const w = lines * wide + (lines - 1) * gap
  return { x: viewport.w - right - w, y: top, w, h: each * pitch - gap }
}

/** The smallest screen the desk's widget is shown on: under it the room is the
 * windows' (the stylesheet says the same: styles/os.css, .sf). It is as wide
 * as leaves the widget clear of the conversation where that first opens. */
const WIDGET_FROM: Size = { w: 1240, h: 641 }

/** The widget on the desk, top left: where it is drawn, or where the
 * stylesheet puts it if the desk has not been drawn yet; null on a desk that
 * does not show one. */
function deskWidget(viewport: Size): Rect | null {
  const el = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('.sf')
  const r = el?.getBoundingClientRect()
  if (r) return r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null
  return viewport.w >= WIDGET_FROM.w && viewport.h >= WIDGET_FROM.h ? { x: 18, y: 46, w: 164, h: 164 } : null
}

/** Where a window opens for the first time: the app's own size for this desk,
 * in the middle and off it by the app's nudge as far as there is room for
 * one, never against an edge. Where that would sit on the windows already
 * open, and somewhere else clearly would not (beside the window in front, to
 * one side of a wide desk), it opens there instead. Wherever it opens, it
 * keeps off what is kept on the desk if it can: a place on the icons or on
 * the widget is taken beside them or under them. */
function placed(id: AppId, s: WM): Rect {
  const spec = APPS[id]
  const d = desk(s.viewport, false)
  const box = room(s.viewport)
  const size = spec.size({ w: d.w, h: d.h })
  const w = Math.min(size.w, box.w)
  const h = Math.min(size.h, box.h)
  const spare = { x: (box.w - w) / 2, y: (box.h - h) / 2 }
  // A wide desk has room for a longer lean
  const reach = Math.min(2.5, Math.max(1, d.w / 1440))
  const lean = (nudge: number, most: number) => Math.max(-most, Math.min(most, nudge))
  const home: Rect = {
    x: Math.round(box.x + spare.x + lean(spec.nudge.x * reach, spare.x)),
    y: Math.round(box.y + spare.y + lean(spec.nudge.y, spare.y)),
    w,
    h,
  }

  const front = activeApp(s)
  const others = APP_IDS.filter((other) => other !== id && isShowing(s.wins[other])).map((other) => geometry(s.wins[other], s.viewport, false))
  const icons = deskIcons(s.viewport)
  const widget = deskWidget(s.viewport)
  const things = widget ? [icons, widget] : [icons]
  /** How much of a place is on other windows, how much on what is kept on the desk, and how much of its size the window gives up for it. */
  const over = (r: Rect) => others.reduce((sum, other) => sum + shared(r, other), 0)
  const kept = (r: Rect) => things.reduce((sum, thing) => sum + shared(r, thing), 0)
  const lost = (r: Rect) => w * h - r.w * r.h
  /** How far one place is from another, in where it is and in how big. */
  const apart = (a: Rect, b: Rect) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.w - b.w) + Math.abs(a.h - b.h)

  const gap = 12
  /** A place, moved clear of what is kept on the desk by the least that does
   * it: beside the icons or the widget, or under them. Failing those, under
   * them a little shorter (a window that cannot be sized is not shortened);
   * and failing that, for a window that says it would sooner be (`slim`),
   * beside the icons a little narrower. A place that is clear, or cannot be
   * made so, is given back as it is. */
  const cleared = (spot: Rect): Rect => {
    const on = things.filter((thing) => shared(spot, thing) > 0)
    if (!on.length) return spot
    const whole: Rect[] = []
    const shorter: Rect[] = []
    const narrower: Rect[] = []
    if (on.includes(icons) && icons.x - gap - w >= box.x) whole.push({ ...spot, x: Math.round(icons.x - gap - w) })
    if (widget && on.includes(widget) && widget.x + widget.w + gap + w <= box.x + box.w) whole.push({ ...spot, x: Math.round(widget.x + widget.w + gap) })
    const y = Math.round(Math.max(...on.map((thing) => thing.y + thing.h)) + gap)
    const left = Math.min(h, box.y + box.h - y)
    if (left === h) whole.push({ ...spot, y })
    else if (spec.resizable && !spec.whole && left >= spec.min.h && left >= h * 0.75) shorter.push({ ...spot, y, h: left })
    const slim = Math.floor(icons.x - gap - box.x)
    if (on.includes(icons) && spec.slim && slim < w && slim >= spec.slim) narrower.push({ ...spot, x: box.x, w: slim })
    // Of the ways that do clear it, the one that covers least and goes least far
    const price = (way: Rect) => over(way) + apart(way, spot)
    const pick = (ways: Rect[]) => ways.filter((way) => kept(way) === 0).sort((a, b) => price(a) - price(b))[0]
    return pick(whole) ?? pick(shorter) ?? pick(narrower) ?? spot
  }

  const edge = 16
  const xs = new Set([home.x])
  if (w + edge * 2 <= box.w) {
    xs.add(box.x + edge)
    xs.add(box.x + box.w - edge - w)
  }
  if (front && front !== id) {
    const beside = geometry(s.wins[front], s.viewport, false)
    if (beside.x + beside.w + edge + w <= box.x + box.w) xs.add(beside.x + beside.w + edge)
    if (beside.x - edge - w >= box.x) xs.add(beside.x - edge - w)
  }
  // Each place to try, as it would be taken (clear of the desk's own things
  // if it can be), and what it costs. What is kept on the desk counts for
  // more than a window does: a window can be moved off another, the icons and
  // the widget cannot be moved. Moving a place clear is not counted in its
  // favour: it covers what it covered before the move, or after it if that is
  // more. And a place that makes the window smaller is charged what the
  // window gives up, or the smallest place would always look the clearest
  const tries = [...xs].map((x) => {
    const at: Rect = { x, y: home.y, w, h }
    const to = cleared(at)
    return { to, cost: Math.max(over(at), over(to)) + kept(to) * 4 + lost(to) }
  })
  // (The first of them is the middle: the set keeps the order it was filled in)
  const middle = tries[0]!
  if (middle.cost === 0) return middle.to
  let best = middle
  let bestScore = middle.cost + apart(middle.to, home)
  for (const one of tries.slice(1)) {
    // Among places as clear as each other, the one nearest the middle
    const score = one.cost + apart(one.to, home)
    if (score < bestScore) {
      best = one
      bestScore = score
    }
  }
  // Only where it is clearly better: on a small desk everything overlaps, and the nudged pile is the tidier one
  return best.cost <= middle.cost * 0.75 ? best.to : middle.to
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
        // A window that has been open before comes back where it was left (fitted, if the screen has changed)
        rect: !fresh ? win.rect : s.compact ? centered(id, s.viewport, true) : placed(id, s),
        fits: fresh ? s.viewport : win.fits,
        // A minimized window glides back out of its icon; a closed one opens
        phase: restoring ? null : 'opening',
        origin: origin ?? win.origin,
      },
    },
  })
  if (!restoring) later(`phase:${id}`, 460, () => patch(id, (w) => (w.phase === 'opening' ? { phase: null } : {})))
}

export function closeApp(id: AppId) {
  const win = wm.get().wins[id]
  if (!win.open || win.phase === 'closing') return
  patch(id, { phase: 'closing' })
  later(`close:${id}`, 190, () => {
    patch(id, { open: false, minimized: false, phase: null })
    settleFocus(id)
  })
}

export function minimizeApp(id: AppId, origin: Point | null = null) {
  const win = wm.get().wins[id]
  if (!win.open || win.minimized) return
  patch(id, { minimized: true, origin: origin ?? win.origin })
  settleFocus(id)
}

/** A window has closed or gone into its Dock icon. If that left the keyboard
 * with nothing, it goes to the window now in front, and with none left to the
 * icon the window went into (the mark's menu for About, which has no icon). */
function settleFocus(id: AppId) {
  if (typeof document === 'undefined') return
  requestAnimationFrame(() => {
    if (!focusLost(document.querySelector(`.wf[data-app="${id}"]`))) return
    const front = activeApp(wm.get())
    if (front) return focusWindow(front)
    focusFirst(document.querySelector(`[data-dock-app="${id}"]`), document.querySelector('[data-menu-title="mark"]'))
  })
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
  patch(id, { rect: clampRect(rect, s.viewport, s.compact), fits: s.viewport, tile: null, glide: false })
}

export function setPreview(preview: Tile | null) {
  wm.set((s) => (s.preview === preview ? s : { ...s, preview }))
}

/** Window > Bring All to Front, as a Mac means it: the windows that are showing are in front of
 * everything else, in the order they were in. A window that was put in the Dock stays there: it is
 * brought back from its icon, or by its name in the same menu. */
export function bringAllToFront() {
  wm.set((s) => {
    const showing = s.order.filter((id) => isShowing(s.wins[id]))
    const order = [...s.order.filter((id) => !showing.includes(id)), ...showing]
    return order.every((id, i) => id === s.order[i]) ? s : { ...s, order }
  })
}

export function setViewport(viewport: Size) {
  wm.set((s) => {
    if (s.viewport.w === viewport.w && s.viewport.h === viewport.h) return s
    // A keyboard that takes the foot of the page (some browsers shrink the page for theirs) is not a new
    // screen: while someone is typing, a change of height alone leaves the layout as it is
    const keyboard = viewport.w === s.viewport.w && typing()
    const compact = keyboard ? s.compact : isCompact(viewport)
    // The windows' own rects are left as they are: each is drawn fitted to the
    // screen there is now (freeRect), and goes back when the room does
    return { ...s, viewport, compact, preview: null }
  })
}

// ---- Kept for the tab: a reload brings the desk back as it was left (src/os/deskmemory.ts) ----

/** What is kept of a window that is open: whether it is in the Dock, where the visitor put it, how it is tiled. */
export interface KeptWin {
  minimized: boolean
  rect: Rect
  fits: Size
  tile: Tile | null
}

export interface KeptWins {
  /** Back to front. */
  order: AppId[]
  wins: Partial<Record<AppId, KeptWin>>
}

/** The open windows as they are now. A closed one is not kept: it opens afresh. */
export function keptWins(): KeptWins {
  const { wins, order } = wm.get()
  const kept: KeptWins['wins'] = {}
  for (const id of APP_IDS) {
    const win = wins[id]
    if (win.open && win.phase !== 'closing') kept[id] = { minimized: win.minimized, rect: win.rect, fits: win.fits, tile: win.tile }
  }
  return { order: order.filter((id) => kept[id]), wins: kept }
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isRect = (r: Partial<Rect> | undefined): r is Rect => !!r && isNumber(r.x) && isNumber(r.y) && isNumber(r.w) && isNumber(r.h) && r.w > 0 && r.h > 0
const isSize = (z: Partial<Size> | undefined): z is Size => !!z && isNumber(z.w) && isNumber(z.h) && z.w > 0 && z.h > 0

/** Puts windows back as they were kept, with no opening played: they are simply there. What does not
 * read as a window is left out (it was kept by another version of the site, or not by the site).
 * Says whether any window came back. */
export function restoreWins(kept: unknown): boolean {
  const from = kept as Partial<KeptWins> | null
  if (!from || typeof from !== 'object' || !from.wins || typeof from.wins !== 'object') return false
  const back: Partial<Record<AppId, Win>> = {}
  for (const id of APP_IDS) {
    const win = (from.wins as Partial<Record<AppId, Partial<KeptWin>>>)[id]
    if (!win || !isRect(win.rect) || !isSize(win.fits)) continue
    const tile = win.tile === 'fill' || win.tile === 'left' || win.tile === 'right' ? win.tile : null
    back[id] = { ...blank(id), mounted: true, open: true, minimized: win.minimized === true, rect: win.rect, fits: win.fits, tile }
  }
  const ids = APP_IDS.filter((id) => back[id])
  if (!ids.length) return false
  const said = Array.isArray(from.order) ? from.order.filter((id): id is AppId => ids.includes(id as AppId)) : []
  const order = [...new Set([...ids.filter((id) => !said.includes(id)), ...said])]
  wm.set((s) => ({ ...s, wins: { ...s.wins, ...back } as Record<AppId, Win>, order }))
  return true
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
