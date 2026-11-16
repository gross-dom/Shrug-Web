import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Minus, Plus, Rotate3d, RotateCw } from 'lucide-react'
import type { AppId } from '../../os/apps'
import { DesktopSurface } from '../../os/Desktop'
import { prefersReducedMotion } from '../../os/dom'
import { saver } from '../../os/saver'
import { ScreenSaver } from '../../os/ScreenSaver'
import { useStore } from '../../os/store'
import { geometry, lendDesk, wm, type Point, type Rect, type WM } from '../../os/wm'
import { askMotion, hasMotion, watchHeld } from '../native'
import '../../styles/variants/v9.css'

// Version 9: the window. The phone is a window onto Niv's Mac. The real
// desktop (its menu bar, the things on the desk, the windows and the Dock, the
// same components the desktop layout draws) is laid out at a Mac's size and
// looked at through the phone: one finger moves the view, two zoom it, a
// double tap goes to the window under the finger and back out, and a tap that
// isn't any of those is a click on the Mac itself.
//
// The Mac is drawn outside the phone's own element (through a portal, over the
// place this version is given on the stage), so none of the phone's styles
// reach into its windows.

/** The Mac's screen, in its own points: the desk the windows are laid out on. */
const MAC = { w: 1280, h: 800 }
/** As close as the view goes. */
const CLOSEST = 1.5
/** Room kept between the Mac and the edges of the view. */
const EDGE = 10
/** How far a finger moves before it is moving the view and not pressing something. */
const SLOP = 7
/** The hint sits in the room above the Mac, and goes when the Mac is under it. */
const HINT = 62

/** Fields that take a double tap themselves, to pick a word. */
const TYPING = 'input, textarea, select, [contenteditable="true"]'
/** Things outside the windows that are pressed, not zoomed into. */
const PRESSED = 'button, a, label, [role="button"], [role="menuitem"]'
/** The parts of a window worth filling the screen with: a sidebar, a column, the part that is read. */
const PANES = '.ss-window__side, .ss-window__main, .ss-window__inspector, .chat, .conv-list, .pf-preview, .pf-grid, .pf-list, .note, .term, .about'

/** Where the Mac is drawn in the view: its top left corner, and how large. */
interface Cam {
  x: number
  y: number
  k: number
}

/** What the controls show of the view. */
interface Seen {
  /** The whole Mac is in view. */
  whole: boolean
  /** It is as close as it goes. */
  closest: boolean
  /** The phone is on its side. */
  wide: boolean
  /** The Mac has reached the hint's place above it. */
  under: boolean
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const settleOut = (p: number) => 1 - Math.pow(1 - p, 3)
const settleBoth = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)

/** The window in front that is open and not in the Dock. */
function frontWindow(s: WM): AppId | null {
  for (let i = s.order.length - 1; i >= 0; i--) {
    const win = s.wins[s.order[i]!]
    if (win.open && !win.minimized) return win.id
  }
  return null
}

/** The view onto the Mac: where it is, the fingers that move it, and the frames that carry it on. */
function makeLens(view: HTMLElement, mac: HTMLElement, parts: { frame: () => HTMLElement | null; covered: () => number }, tell: (seen: Seen) => void) {
  const still = prefersReducedMotion()
  let size = { w: 0, h: 0 }
  /** What the controls cover of the view's foot (upright only: on its side they sit in the corners). */
  let foot = 0
  let cam: Cam = { x: 0, y: 0, k: 1 }
  /** Tilting the phone leans the view about where it is: how far now, and how far it is heading. */
  const lean = { x: 0, y: 0, tx: 0, ty: 0 }
  /** What a flick leaves the view with, in points a second. */
  let vel = { x: 0, y: 0 }
  let glide: { from: Cam; to: Cam; t0: number; ms: number; ease: (p: number) => number } | null = null
  /** A list inside a window, let go of and still rolling. */
  let coast: { el: HTMLElement; top: number; left: number; vx: number; vy: number } | null = null
  /** The point a zoom that went too far comes back about. */
  let anchor: Point | null = null
  let frame = 0
  let last = 0
  let on = true
  /** The visitor has moved the view: the arrival leaves it where they put it. */
  let touched = false
  let seen: Seen | null = null
  /** The view as it was upright, to come back to after the phone has been on its side. */
  let upright: { x: number; y: number; k: number } | null = null
  let box = view.getBoundingClientRect()

  // ---- Where the Mac may be ----

  const room = () => ({ l: EDGE, r: size.w - EDGE, t: EDGE, b: size.h - foot - EDGE })
  /** The zoom at which the whole Mac is in view. */
  const widest = () => {
    const m = room()
    return Math.max(0.05, Math.min((m.r - m.l) / MAC.w, (m.b - m.t) / MAC.h))
  }
  const closest = () => Math.max(CLOSEST, widest())
  const hold = (k: number) => clamp(k, widest(), closest())

  /** Where the Mac rests at a zoom: in the middle where it is smaller than the view, edge to edge where it is larger. */
  const rest = (c: Cam): Cam => {
    const m = room()
    const w = MAC.w * c.k
    const h = MAC.h * c.k
    return {
      k: c.k,
      x: w <= m.r - m.l ? (m.l + m.r - w) / 2 : clamp(c.x, m.r - w, m.l),
      y: h <= m.b - m.t ? (m.t + m.b - h) / 2 : clamp(c.y, m.b - h, m.t),
    }
  }

  /** Past an edge the Mac follows the finger less and less. */
  const band = (over: number, span: number) => Math.sign(over) * (1 - 1 / ((Math.abs(over) * 0.55) / span + 1)) * span
  const unband = (shown: number, span: number) => Math.sign(shown) * (span / 0.55) * (1 / (1 - Math.min(0.98, Math.abs(shown) / span)) - 1)
  const banded = (raw: Cam): Cam => {
    const r = rest(raw)
    return { k: raw.k, x: r.x + band(raw.x - r.x, size.w), y: r.y + band(raw.y - r.y, size.h) }
  }
  const unbanded = (c: Cam): Cam => {
    const r = rest(c)
    return { k: c.k, x: r.x + unband(c.x - r.x, size.w), y: r.y + unband(c.y - r.y, size.h) }
  }

  /** The point of the Mac in the middle of the view. */
  const middle = (c: Cam) => ({ x: (size.w / 2 - c.x) / c.k, y: (size.h / 2 - c.y) / c.k })
  const whole = () => rest({ k: widest(), x: 0, y: 0 })
  /** A zoom that keeps the point of the Mac under a place in the view where it is. */
  const about = (p: Point, k: number, c: Cam = cam): Cam => ({ k, x: p.x - ((p.x - c.x) * k) / c.k, y: p.y - ((p.y - c.y) * k) / c.k })

  /** Where the Mac is drawn: where it has been put, leaned by the tilt as far as its edges allow. */
  const shown = (): Cam => {
    if (!lean.x && !lean.y) return cam
    const home = rest(cam)
    const far = rest({ k: cam.k, x: home.x + lean.x, y: home.y + lean.y })
    return { k: cam.k, x: cam.x + far.x - home.x, y: cam.y + far.y - home.y }
  }

  const draw = () => {
    const c = shown()
    mac.style.transform = `translate3d(${c.x.toFixed(2)}px, ${c.y.toFixed(2)}px, 0) scale(${c.k.toFixed(5)})`
    const mark = parts.frame()
    if (mark) {
      const x0 = clamp(-c.x / c.k, 0, MAC.w)
      const x1 = clamp((size.w - c.x) / c.k, 0, MAC.w)
      const y0 = clamp(-c.y / c.k, 0, MAC.h)
      const y1 = clamp((size.h - c.y) / c.k, 0, MAC.h)
      mark.style.left = `${((x0 / MAC.w) * 100).toFixed(2)}%`
      mark.style.top = `${((y0 / MAC.h) * 100).toFixed(2)}%`
      mark.style.width = `${(((x1 - x0) / MAC.w) * 100).toFixed(2)}%`
      mark.style.height = `${(((y1 - y0) / MAC.h) * 100).toFixed(2)}%`
    }
    const next: Seen = { whole: c.k <= widest() * 1.02, closest: c.k >= closest() * 0.985, wide: size.w > size.h, under: c.y < HINT }
    if (!seen || seen.whole !== next.whole || seen.closest !== next.closest || seen.wide !== next.wide || seen.under !== next.under) {
      seen = next
      tell(next)
    }
  }

  // ---- The frames that carry it on: a glide, a flick running down, a list rolling, the tilt easing ----

  const pts = new Map<number, Point>()

  const step = (t: number) => {
    frame = 0
    const dt = last ? Math.min(0.05, Math.max(0.001, (t - last) / 1000)) : 1 / 60
    last = t
    let busy = false

    if (glide) {
      const p = glide.ms ? clamp((t - glide.t0) / glide.ms, 0, 1) : 1
      const e = glide.ease(p)
      const k = glide.from.k * Math.pow(glide.to.k / glide.from.k, e)
      const a = middle(glide.from)
      const b = middle(glide.to)
      cam = { k, x: size.w / 2 - (a.x + (b.x - a.x) * e) * k, y: size.h / 2 - (a.y + (b.y - a.y) * e) * k }
      if (p >= 1) {
        cam = glide.to
        glide = null
      } else busy = true
    } else if (pts.size === 0) {
      // A zoom let go of past its ends comes back, about where the fingers were
      const goal = hold(cam.k)
      if (goal !== cam.k) {
        const near = Math.abs(goal - cam.k) < 0.0008
        const k = near ? goal : cam.k + (goal - cam.k) * (1 - Math.exp(-dt * 16))
        cam = about(anchor ?? { x: size.w / 2, y: size.h / 2 }, k)
        busy = busy || !near
      }
      // A flick runs down; past an edge it dies quickly and the Mac is drawn back
      const speed = Math.hypot(vel.x, vel.y)
      if (speed) {
        cam = { k: cam.k, x: cam.x + vel.x * dt, y: cam.y + vel.y * dt }
        const drag = Math.exp(-dt * 3.2)
        vel = { x: vel.x * drag, y: vel.y * drag }
      }
      const home = rest(cam)
      const ox = home.x - cam.x
      const oy = home.y - cam.y
      if (ox || oy) {
        const pull = 1 - Math.exp(-dt * 13)
        const brake = Math.exp(-dt * 24)
        cam = { k: cam.k, x: cam.x + ox * pull, y: cam.y + oy * pull }
        if (ox) vel.x *= brake
        if (oy) vel.y *= brake
      }
      if (Math.hypot(vel.x, vel.y) < 9) vel = { x: 0, y: 0 }
      else busy = true
      if (Math.abs(ox) > 0.35 || Math.abs(oy) > 0.35) busy = true
      else if (!busy) cam = rest(cam)
    }

    if (coast) {
      const { el } = coast
      coast.top += coast.vy * dt
      coast.left += coast.vx * dt
      el.scrollTop = coast.top
      el.scrollLeft = coast.left
      const drag = Math.exp(-dt * 2.6)
      coast.vx *= drag
      coast.vy *= drag
      // It has reached an end, or run down
      const stopped = Math.abs(el.scrollTop - coast.top) > 1.5 || Math.abs(el.scrollLeft - coast.left) > 1.5 || Math.hypot(coast.vx, coast.vy) < 14
      if (stopped) coast = null
      else busy = true
    }

    if (lean.x !== lean.tx || lean.y !== lean.ty) {
      const pull = 1 - Math.exp(-dt * 7)
      lean.x += (lean.tx - lean.x) * pull
      lean.y += (lean.ty - lean.y) * pull
      if (Math.abs(lean.tx - lean.x) < 0.25 && Math.abs(lean.ty - lean.y) < 0.25) {
        lean.x = lean.tx
        lean.y = lean.ty
      } else busy = true
    }

    draw()
    if (busy && on) frame = requestAnimationFrame(step)
    else {
      last = 0
      // Left alone it is drawn afresh at its new size, so type is sharp
      if (pts.size === 0) mac.removeAttribute('data-moving')
    }
  }

  const wake = () => {
    if (!on || frame) return
    mac.setAttribute('data-moving', '')
    frame = requestAnimationFrame(step)
  }

  /** Takes the view somewhere, over a moment. */
  const go = (to: Cam, ms: number, ease = settleOut) => {
    vel = { x: 0, y: 0 }
    coast = null
    if (still || !on || !ms) {
      glide = null
      cam = to
      draw()
      return
    }
    glide = { from: { ...cam }, to, t0: performance.now(), ms, ease }
    wake()
  }

  /** The view with a part of the Mac filling it: across (`wide`), or the whole of it in view. */
  const frameOn = (r: Rect, how: 'whole' | 'wide', by?: Point): Cam => {
    const m = room()
    const k = hold(how === 'whole' ? Math.min(size.w / r.w, (m.b - m.t) / r.h) : size.w / r.w)
    const x = size.w / 2 - (r.x + r.w / 2) * k
    let y = (m.t + m.b) / 2 - (r.y + r.h / 2) * k
    if (r.h * k > m.b - m.t) {
      // Taller than the view: the part under the finger stays under it; with no finger, its top
      const top = m.t - r.y * k
      const c = shown()
      y = by ? clamp(by.y - ((by.y - c.y) / c.k) * k, m.b - (r.y + r.h) * k, top) : top
    }
    return rest({ k, x, y })
  }

  /** A part of the page, as a rectangle on the Mac. */
  const onMac = (el: Element): Rect => {
    const c = shown()
    const r = el.getBoundingClientRect()
    return { x: (r.left - box.left - c.x) / c.k, y: (r.top - box.top - c.y) / c.k, w: r.width / c.k, h: r.height / c.k }
  }

  /** A window's place on the Mac, from the window manager: right even while it is still opening. */
  const windowRect = (id: AppId): Rect | null => {
    const s = wm.get()
    const win = s.wins[id]
    return win.open && !win.minimized ? geometry(win, MAC, false) : null
  }

  // ---- Fingers ----

  let mode: 'none' | 'press' | 'pan' | 'roll' | 'pinch' = 'none'
  let start = { x: 0, y: 0, t: 0, target: null as Element | null }
  /** Where the fingers alone would have the Mac, before its edges hold it back. */
  let raw: Cam = cam
  let trail: { x: number; y: number; t: number }[] = []
  /** The list inside a window that this drag is scrolling. */
  let roll: { el: HTMLElement; axis: 'x' | 'y'; at: number } | null = null
  /** A pinch: the gap it began at, and the point of the Mac between the fingers. */
  let pinch: { gap: number; k: number; px: number; py: number } | null = null
  /** A click before this moment is the end of a drag or of a double tap: not a press. */
  let swallow = 0
  let lastTap: { x: number; y: number; t: number } | null = null

  const at = (e: { clientX: number; clientY: number }): Point => ({ x: e.clientX - box.left, y: e.clientY - box.top })

  /** The nearest thing round a target that scrolls, and has somewhere left to scroll that way. */
  const scrollerFor = (from: Element | null, axis: 'x' | 'y', dir: number): HTMLElement | null => {
    for (let el = from as HTMLElement | null; el && el !== mac; el = el.parentElement) {
      const max = axis === 'y' ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth
      if (max < 2) continue
      const flow = getComputedStyle(el)[axis === 'y' ? 'overflowY' : 'overflowX']
      if (flow !== 'auto' && flow !== 'scroll') continue
      const now = axis === 'y' ? el.scrollTop : el.scrollLeft
      if (dir < 0 ? now > 0.5 : now < max - 0.5) return el
    }
    return null
  }

  const beginPinch = () => {
    const [a, b] = [...pts.values()] as [Point, Point]
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    pinch = { gap: Math.max(24, Math.hypot(a.x - b.x, a.y - b.y)), k: cam.k, px: (mx - cam.x) / cam.k, py: (my - cam.y) / cam.k }
    mode = 'pinch'
    roll = null
    swallow = Infinity
    for (const id of pts.keys()) {
      try {
        view.setPointerCapture(id)
      } catch {
        // A finger that has already gone
      }
    }
  }

  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // The first finger of a new touch: any still counted from before were never seen to lift
    if (e.isPrimary) pts.clear()
    if (pts.size >= 2) return
    box = view.getBoundingClientRect()
    pts.set(e.pointerId, at(e))
    touched = true
    // A finger down stops whatever it was doing, where it is. One that stops a flick is only that: not a press on what it lands on.
    const stopping = Math.hypot(vel.x, vel.y) > 90 || !!coast || !!glide
    glide = null
    vel = { x: 0, y: 0 }
    coast = null
    if (pts.size === 1) {
      const p = at(e)
      mode = 'press'
      start = { ...p, t: performance.now(), target: e.target as Element }
      trail = [{ ...p, t: performance.now() }]
      swallow = stopping ? Infinity : 0
      if (stopping) lastTap = null
      mac.setAttribute('data-moving', '')
    } else beginPinch()
  }

  const move = (e: PointerEvent) => {
    let was = pts.get(e.pointerId)
    if (!was) return
    const p = at(e)
    pts.set(e.pointerId, p)

    if (mode === 'pinch' && pinch) {
      if (pts.size < 2) return
      const [a, b] = [...pts.values()] as [Point, Point]
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      // The zoom follows the fingers, less and less past its ends
      const want = pinch.k * (Math.max(24, Math.hypot(a.x - b.x, a.y - b.y)) / pinch.gap)
      const lo = widest()
      const hi = closest()
      const k = want < lo ? lo * Math.pow(want / lo, 0.4) : want > hi ? hi * Math.pow(want / hi, 0.4) : want
      // and the point of the Mac that was between them stays between them
      cam = { k, x: mx - pinch.px * k, y: my - pinch.py * k }
      anchor = { x: mx, y: my }
      draw()
      return
    }

    if (mode === 'press') {
      const dx = p.x - start.x
      const dy = p.y - start.y
      const slop = e.pointerType === 'mouse' ? 4 : SLOP
      const d = Math.hypot(dx, dy)
      if (d < slop) return
      // It is a drag. Over a list that can still scroll that way, it scrolls the list; anywhere else it moves the view.
      const axis = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x'
      const el = scrollerFor(start.target, axis, (axis === 'y' ? dy : dx) > 0 ? -1 : 1)
      roll = el ? { el, axis, at: axis === 'y' ? el.scrollTop : el.scrollLeft } : null
      mode = el ? 'roll' : 'pan'
      raw = unbanded(cam)
      // It begins where the finger left its slop: nothing of the move is lost, and nothing jumps
      was = { x: start.x + (dx * slop) / d, y: start.y + (dy * slop) / d }
      trail = [{ ...was, t: performance.now() }]
      swallow = Infinity
      try {
        view.setPointerCapture(e.pointerId)
      } catch {
        // Not a finger that can be held on to
      }
    }

    const now = performance.now()
    trail.push({ ...p, t: now })
    while (trail.length > 2 && now - trail[0]!.t > 110) trail.shift()

    if (mode === 'roll' && roll) {
      const { el, axis } = roll
      const by = (axis === 'y' ? p.y - was.y : p.x - was.x) / cam.k
      roll.at -= by
      if (axis === 'y') el.scrollTop = roll.at
      else el.scrollLeft = roll.at
      const got = axis === 'y' ? el.scrollTop : el.scrollLeft
      // What the list could not take moves the view instead
      const left = roll.at - got
      if (Math.abs(left) > 1) {
        roll.at = got
        if (axis === 'y') raw.y -= left * cam.k
        else raw.x -= left * cam.k
        cam = banded(raw)
        draw()
      }
      return
    }

    if (mode === 'pan') {
      raw = { k: raw.k, x: raw.x + p.x - was.x, y: raw.y + p.y - was.y }
      cam = banded(raw)
      draw()
    }
  }

  /** What a finger leaves behind it when it lifts: points a second. */
  const flick = () => {
    const now = performance.now()
    const a = trail[0]
    const b = trail[trail.length - 1]
    if (!a || !b || a === b || now - b.t > 70 || b.t - a.t < 12) return { x: 0, y: 0 }
    const s = 1000 / (b.t - a.t)
    return { x: clamp((b.x - a.x) * s, -4200, 4200), y: clamp((b.y - a.y) * s, -4200, 4200) }
  }

  /** A double tap: into the window under the finger, then the part of it under the finger, then back out. */
  const twice = (target: Element, p: Point) => {
    const c = shown()
    const lo = widest()
    const frameEl = target.closest<HTMLElement>('.wf')
    const id = frameEl?.dataset.app as AppId | undefined
    const win = id ? windowRect(id) : null
    if (!frameEl || !win) return go(c.k > lo * 1.06 ? whole() : rest(about(p, hold(Math.max(c.k * 2.4, 0.56)), c)), 400)
    const kw = hold(size.w / win.w)
    if (c.k < kw * 0.94) return go(frameOn(win, 'wide', p), 420)
    const pane = target.closest<HTMLElement>(PANES)
    if (pane && frameEl.contains(pane)) {
      const part = onMac(pane)
      const kp = hold(size.w / part.w)
      if (kp > kw * 1.12 && c.k < kp * 0.94) return go(frameOn(part, 'wide', p), 420)
    }
    go(whole(), 420)
  }

  const tap = (e: PointerEvent) => {
    const now = performance.now()
    const p = at(e)
    if (e.type === 'pointercancel' || now - start.t > 600) {
      lastTap = null
      return
    }
    if (!lastTap || now - lastTap.t > 330 || Math.hypot(p.x - lastTap.x, p.y - lastTap.y) > 30) {
      lastTap = { ...p, t: now }
      return
    }
    lastTap = null
    const target = start.target
    if (!target || !mac.contains(target) || target.closest(TYPING)) return
    if (!target.closest('.wf') && target.closest(PRESSED)) return
    // The second tap is the zoom's, not another press on what is under it
    swallow = now + 420
    twice(target, p)
  }

  const up = (e: PointerEvent) => {
    if (!pts.delete(e.pointerId)) return
    if (mode === 'pinch') {
      pinch = null
      if (pts.size === 1) {
        // One finger is still down: it carries the view on, from where it is
        mode = 'pan'
        raw = unbanded(cam)
        trail = []
        return
      }
    }
    if (pts.size > 0) return
    const was = mode
    mode = 'none'
    if (was === 'press' && swallow !== Infinity) tap(e)
    else swallow = performance.now() + 380
    if (was === 'pan' && e.type !== 'pointercancel' && !still) vel = flick()
    if (was === 'roll' && roll && e.type !== 'pointercancel') {
      const v = flick()
      const { el, axis } = roll
      coast = { el, top: el.scrollTop, left: el.scrollLeft, vx: axis === 'x' ? -v.x / cam.k : 0, vy: axis === 'y' ? -v.y / cam.k : 0 }
    }
    roll = null
    wake()
  }

  /** After a press on the Dock, the menu bar or the desk has done what it does: go to the window it brought up. */
  const follow = (target: Element) => {
    if (!target.closest('.dock, .menubar, .desk')) return
    const asked = target.closest<HTMLElement>('[data-dock-app]')?.dataset.dockApp as AppId | undefined
    const before = wm.get()
    const front = frontWindow(before)
    setTimeout(() => {
      const s = wm.get()
      const id = asked ?? frontWindow(s)
      if (!id || !on) return
      const r = windowRect(id)
      if (!r) return
      const fresh = !before.wins[id].open || before.wins[id].minimized
      if (!asked && !fresh && id === front) return
      go(frameOn(r, 'whole'), 520, settleBoth)
    }, 0)
  }

  const click = (e: MouseEvent) => {
    if (performance.now() < swallow) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    if (e.target instanceof Element) follow(e.target)
  }

  const dblclick = (e: MouseEvent) => {
    if (performance.now() < swallow) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const wheel = (e: WheelEvent) => {
    box = view.getBoundingClientRect()
    if (e.ctrlKey || e.metaKey) {
      // A trackpad's pinch, or the wheel with a key held: zoom about the pointer
      e.preventDefault()
      touched = true
      glide = null
      cam = rest(about(at(e), hold(cam.k * Math.exp(-e.deltaY * 0.012))))
      draw()
      return
    }
    // A list under the pointer scrolls itself; anywhere else the wheel moves the view
    const axis = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? 'y' : 'x'
    if (scrollerFor(e.target as Element, axis, (axis === 'y' ? e.deltaY : e.deltaX) > 0 ? 1 : -1)) return
    e.preventDefault()
    touched = true
    glide = null
    cam = rest({ k: cam.k, x: cam.x - e.deltaX, y: cam.y - e.deltaY })
    draw()
  }

  /** Brings a field that has the keyboard into view, if it is out of it. */
  const reveal = (el: Element) => {
    if (pts.size || !on || !mac.contains(el)) return
    box = view.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const m = room()
    const l = r.left - box.left
    const t = r.top - box.top
    const dx = l < m.l || r.width > m.r - m.l ? m.l - l : l + r.width > m.r ? m.r - (l + r.width) : 0
    const dy = t < m.t ? m.t - t : t + r.height > m.b ? m.b - (t + r.height) : 0
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) go(rest({ k: cam.k, x: cam.x + dx, y: cam.y + dy }), 240)
  }
  let revealing: ReturnType<typeof setTimeout> | undefined
  const focusin = (e: FocusEvent) => {
    const el = e.target
    // A field that takes the keyboard, or anything the keyboard itself has moved on to (but not a whole window: the view goes to those by itself)
    if (!(el instanceof Element) || !(el.matches(TYPING) || (el.matches(':focus-visible') && !el.matches('.wf')))) return
    clearTimeout(revealing)
    // Once the keyboard has come up and the view has taken its new size
    revealing = setTimeout(() => reveal(el), 360)
  }

  const quiet = (e: Event) => e.preventDefault()

  view.addEventListener('pointerdown', down)
  view.addEventListener('pointermove', move)
  view.addEventListener('pointerup', up)
  view.addEventListener('pointercancel', up)
  view.addEventListener('click', click, true)
  view.addEventListener('dblclick', dblclick, true)
  view.addEventListener('wheel', wheel, { passive: false })
  view.addEventListener('focusin', focusin)
  // Safari's own pinch and the long-press menu would take the page, not the view
  view.addEventListener('gesturestart', quiet)
  view.addEventListener('gesturechange', quiet)
  view.addEventListener('contextmenu', quiet)
  view.addEventListener('dragstart', quiet)

  return {
    /** A point on the screen, as a point on the Mac. */
    toDesk(p: Point): Point {
      const b = view.getBoundingClientRect()
      const c = shown()
      return { x: (p.x - b.left - c.x) / c.k, y: (p.y - b.top - c.y) / c.k }
    },
    /** The view has a size, or a new one. On its side the whole Mac is in it; upright again, it goes back to where it was. */
    fit() {
      const w = view.clientWidth
      const h = view.clientHeight
      const covered = w > h ? 0 : parts.covered()
      if (!w || !h || (w === size.w && h === size.h && covered === foot)) return
      const first = !size.w
      const all = first || cam.k <= widest() * 1.02
      const mid = first ? { x: MAC.w / 2, y: MAC.h / 2 } : middle(cam)
      const turned = !first && size.w > size.h !== w > h
      const before = cam.k
      size = { w, h }
      foot = covered
      box = view.getBoundingClientRect()
      glide = null
      vel = { x: 0, y: 0 }
      const back = (c: { x: number; y: number; k: number }) => {
        const k = hold(c.k)
        return rest({ k, x: w / 2 - c.x * k, y: h / 2 - c.y * k })
      }
      if (turned && w > h) {
        upright = all ? null : { ...mid, k: before }
        cam = whole()
      } else if (turned && upright) {
        cam = back(upright)
        upright = null
      } else cam = all ? whole() : back({ ...mid, k: before })
      draw()
      const el = document.activeElement
      if (el && el.matches(TYPING)) requestAnimationFrame(() => reveal(el))
    },
    whole() {
      touched = true
      go(whole(), 420)
    },
    /** Closer or further, about the middle of what can be seen. */
    zoom(by: number) {
      touched = true
      const m = room()
      const from = glide ? glide.to : cam
      go(rest(about({ x: size.w / 2, y: (m.t + m.b) / 2 }, hold(from.k * by), from)), 260)
    },
    /** Puts a point of the Mac in the middle of the view. From the whole Mac it goes in closer too: there is nowhere to move to otherwise. */
    centre(p: Point, smooth: boolean) {
      touched = true
      const m = room()
      const k = cam.k < widest() * 1.05 ? hold(Math.max(widest() * 2.4, 0.6)) : cam.k
      const to = rest({ k, x: size.w / 2 - p.x * k, y: (m.t + m.b) / 2 - p.y * k })
      if (smooth) return go(to, 320)
      glide = null
      vel = { x: 0, y: 0 }
      cam = to
      draw()
    },
    nudge(dx: number, dy: number) {
      touched = true
      const from = glide ? glide.to : cam
      go(rest({ k: from.k, x: from.x + dx, y: from.y + dy }), 180)
    },
    /** The arrival: from the whole Mac into a window, unless the visitor has already taken hold of the view. */
    arrive(id: AppId) {
      const r = windowRect(id)
      if (touched || !r || size.w > size.h) return
      go(frameOn(r, 'whole'), 1100, settleBoth)
    },
    /** How the phone is held: left and right, away and toward, each -1 to 1. The view leans that way about where it is. */
    lean(x: number, y: number) {
      lean.tx = -x * size.w * 0.62
      lean.ty = -y * size.h * 0.46
      wake()
    },
    /** For tilting there has to be somewhere to lean to: from far out, it goes in. */
    closeEnough() {
      const m = room()
      if (cam.k < 0.8) go(rest(about({ x: size.w / 2, y: (m.t + m.b) / 2 }, hold(0.92))), 520, settleBoth)
    },
    /** Stops the frames while something is over the version, and starts them again after. */
    run(yes: boolean) {
      if (on === yes) return
      on = yes
      if (yes) return wake()
      cancelAnimationFrame(frame)
      frame = 0
      last = 0
      if (glide) cam = glide.to
      glide = null
      vel = { x: 0, y: 0 }
      coast = null
      pts.clear()
      mode = 'none'
      cam = rest({ ...cam, k: hold(cam.k) })
      mac.removeAttribute('data-moving')
      draw()
    },
    destroy() {
      on = false
      cancelAnimationFrame(frame)
      clearTimeout(revealing)
      view.removeEventListener('pointerdown', down)
      view.removeEventListener('pointermove', move)
      view.removeEventListener('pointerup', up)
      view.removeEventListener('pointercancel', up)
      view.removeEventListener('click', click, true)
      view.removeEventListener('dblclick', dblclick, true)
      view.removeEventListener('wheel', wheel)
      view.removeEventListener('focusin', focusin)
      view.removeEventListener('gesturestart', quiet)
      view.removeEventListener('gesturechange', quiet)
      view.removeEventListener('contextmenu', quiet)
      view.removeEventListener('dragstart', quiet)
    },
  }
}

type Lens = ReturnType<typeof makeLens>

/** How far an arrow key moves the view. */
const STEPS: Record<string, [number, number] | undefined> = { ArrowLeft: [90, 0], ArrowRight: [-90, 0], ArrowUp: [0, 90], ArrowDown: [0, -90] }

/** The whole desktop, small: its windows, and the part of it the view is on. A tap on it takes the view there. */
function MiniMap({ lens, frame }: { lens: RefObject<Lens | null>; frame: RefObject<HTMLSpanElement> }) {
  const wins = useStore(wm, (s) => s.wins)
  const order = useStore(wm, (s) => s.order)
  const front = order[order.length - 1]

  /** Where a finger went down on it: a tap glides there, a drag carries the view with it. */
  const pressed = useRef<Point | null>(null)

  const jump = (e: ReactPointerEvent<HTMLButtonElement>, smooth: boolean) => {
    const r = e.currentTarget.getBoundingClientRect()
    lens.current?.centre({ x: clamp((e.clientX - r.left) / r.width, 0, 1) * MAC.w, y: clamp((e.clientY - r.top) / r.height, 0, 1) * MAC.h }, smooth)
  }

  const onKey = (e: ReactKeyboardEvent) => {
    const by = STEPS[e.key]
    if (by) {
      e.preventDefault()
      lens.current?.nudge(by[0], by[1])
    } else if (e.key === '+' || e.key === '=') lens.current?.zoom(1.5)
    else if (e.key === '-') lens.current?.zoom(1 / 1.5)
  }

  return (
    <button
      type="button"
      className="v9__map"
      aria-label="Map of the desktop. Tap it to move the view there; with a keyboard, the arrow keys move the view."
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        pressed.current = { x: e.clientX, y: e.clientY }
        jump(e, true)
      }}
      onPointerMove={(e) => {
        const from = pressed.current
        if (from && e.currentTarget.hasPointerCapture(e.pointerId) && Math.hypot(e.clientX - from.x, e.clientY - from.y) > 4) jump(e, false)
      }}
      onPointerUp={() => (pressed.current = null)}
      onPointerCancel={() => (pressed.current = null)}
      onKeyDown={onKey}
    >
      <span className="v9__map-bar" aria-hidden />
      {order.map((id) => {
        const win = wins[id]
        if (!win.open || win.minimized) return null
        const r = geometry(win, MAC, false)
        return (
          <span
            key={id}
            className="v9__map-win"
            data-app={id}
            data-front={id === front || undefined}
            style={{ left: `${(r.x / MAC.w) * 100}%`, top: `${(r.y / MAC.h) * 100}%`, width: `${(r.w / MAC.w) * 100}%`, height: `${(r.h / MAC.h) * 100}%` }}
            aria-hidden
          />
        )
      })}
      <span className="v9__map-dock" aria-hidden />
      <span ref={frame} className="v9__map-view" aria-hidden />
    </button>
  )
}

// The Mac itself never changes from here: one element, made once, so nothing
// the controls do draws it again
const SURFACE = <DesktopSurface />

export default function V9({ active }: { active: boolean }) {
  /** The version's place on the stage. The Mac is drawn over it, from outside the phone's element. */
  const host = useRef<HTMLDivElement>(null)
  const [os] = useState(() => document.querySelector<HTMLElement>('.os'))
  const root = useRef<HTMLDivElement>(null)
  const view = useRef<HTMLDivElement>(null)
  const mac = useRef<HTMLDivElement>(null)
  const tools = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLSpanElement>(null)
  const lens = useRef<Lens | null>(null)
  const [seen, setSeen] = useState<Seen>({ whole: true, closest: false, wide: false, under: false })
  const [tilt, setTilt] = useState<'off' | 'on' | 'refused'>('off')
  const [canTilt] = useState(hasMotion)
  /** The Mac's screen saver, when its menu asks for it: on a phone it never starts by itself. */
  const saving = useStore(saver, (s) => s.on)

  // The window manager is lent a desk the size of a Mac's screen for as long as
  // this version is up, so the windows are laid out for that and not for the
  // phone; the view is what turns a place on the phone into a place on it.
  useLayoutEffect(() => {
    const viewEl = view.current
    const macEl = mac.current
    if (!viewEl || !macEl) return
    const made = makeLens(
      viewEl,
      macEl,
      {
        frame: () => frame.current,
        // What the controls cover: from their top to the view's foot
        covered: () => (tools.current ? viewEl.clientHeight - tools.current.offsetTop : 0),
      },
      setSeen,
    )
    lens.current = made
    const giveBack = lendDesk(MAC, made.toDesk)
    return () => {
      giveBack()
      made.destroy()
      lens.current = null
    }
  }, [])

  // Kept over the version's place on the stage, whatever happens to it: the
  // phone turning, the keyboard coming up
  useLayoutEffect(() => {
    const hostEl = host.current
    const rootEl = root.current
    if (!hostEl || !rootEl || !os) return
    const place = () => {
      const r = hostEl.getBoundingClientRect()
      const o = os.getBoundingClientRect()
      rootEl.style.left = `${r.left - o.left}px`
      rootEl.style.top = `${r.top - o.top}px`
      rootEl.style.width = `${r.width}px`
      rootEl.style.height = `${r.height}px`
      lens.current?.fit()
    }
    place()
    const watch = new ResizeObserver(place)
    watch.observe(hostEl)
    if (tools.current) watch.observe(tools.current)
    window.addEventListener('resize', place)
    window.visualViewport?.addEventListener('resize', place)
    window.visualViewport?.addEventListener('scroll', place)
    return () => {
      watch.disconnect()
      window.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('scroll', place)
    }
  }, [os])

  useEffect(() => {
    lens.current?.run(active)
  }, [active])

  // Arriving: the whole Mac, then, once the group chat has opened out of the
  // Dock, in to it
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let done = false
    const look = () => {
      if (done) return
      const s = wm.get()
      const id = s.wins.messages.open && !s.wins.messages.minimized ? 'messages' : frontWindow(s)
      if (!id) return
      done = true
      timer = setTimeout(() => lens.current?.arrive(id), s.wins[id].phase === 'opening' ? 900 : 500)
    }
    look()
    const stop = wm.subscribe(look)
    return () => {
      stop()
      clearTimeout(timer)
    }
  }, [])

  // Tilting the phone leans the view about where it is, like looking through a
  // hole at something larger
  useEffect(() => {
    if (tilt !== 'on' || !active) return
    lens.current?.closeEnough()
    const stop = watchHeld((held) => lens.current?.lean(held.x, held.y))
    return () => {
      stop()
      lens.current?.lean(0, 0)
    }
  }, [tilt, active])

  const toggleTilt = async () => {
    if (tilt === 'on') return setTilt('off')
    setTilt((await askMotion()) ? 'on' : 'refused')
  }

  return (
    <div ref={host} className="v9">
      {os &&
        createPortal(
          <div ref={root} className="v9 v9-lens" data-wide={seen.wide || undefined} data-covered={!active || undefined} aria-label="Niv’s Mac" role="region">
            <div ref={view} className="v9__view">
              <div ref={mac} className="v9__mac" data-nodrag>
                <div className="v9__wall" aria-hidden />
                {SURFACE}
                {saving && <ScreenSaver />}
              </div>
            </div>
            <p className="v9__hint" data-gone={seen.under || undefined} aria-hidden={seen.wide || seen.under || undefined}>
              <span>
                <RotateCw size={13} strokeWidth={2.4} aria-hidden />
                Turn your phone for the whole Mac
              </span>
              <span>Drag to look around. Pinch or double tap to go closer.</span>
            </p>
            <div ref={tools} className="v9__tools">
              <MiniMap lens={lens} frame={frame} />
              <div className="v9__buttons">
                {canTilt && (
                  <button type="button" className="v9__tilt" aria-pressed={tilt === 'on'} aria-label="Look around by tilting" onClick={toggleTilt}>
                    <Rotate3d size={15} strokeWidth={2.2} aria-hidden />
                    <span className="v9__tilt-long">{tilt === 'on' ? 'Tilting: tap to stop' : tilt === 'refused' ? 'Motion isn’t allowed here' : 'Look around by tilting'}</span>
                    <span className="v9__tilt-short">{tilt === 'on' ? 'Tilting' : 'Tilt'}</span>
                  </button>
                )}
                <div className="v9__zoom" role="group" aria-label="Zoom">
                  <button type="button" aria-label="Zoom out" disabled={seen.whole} onClick={() => lens.current?.zoom(1 / 1.6)}>
                    <Minus size={18} strokeWidth={2.4} aria-hidden />
                  </button>
                  <button type="button" className="v9__fit" aria-label="Fit the whole Mac in view" disabled={seen.whole} onClick={() => lens.current?.whole()}>
                    Fit
                  </button>
                  <button type="button" aria-label="Zoom in" disabled={seen.closest} onClick={() => lens.current?.zoom(1.6)}>
                    <Plus size={18} strokeWidth={2.4} aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          </div>,
          os,
        )}
    </div>
  )
}
