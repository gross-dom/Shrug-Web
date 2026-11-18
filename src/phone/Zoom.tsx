import { useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import type { Rect } from '../kit/measure'
import { useReducedMotion } from '../kit/reduced-motion'

// An app opening out of its icon (or out of a widget, a notification), the way
// an iPhone opens one. The whole of the app's screen is there from the first
// moment, pressed down onto the icon it comes out of, as wide and as tall as
// the icon is; it grows to fill the screen with the icon's own picture growing
// over it and fading as it goes. Nothing is uncovered from the top down: the
// foot of the app arrives at the foot of the screen as its sides arrive at
// the sides. Putting an app away is the same in reverse.
//
// Three things move together, on one clock and one curve: the window (a clip,
// from the icon's box to the whole screen, its corners from the icon's to the
// display's), the app inside it (from the icon's box to its own size), and the
// icon's picture over it (from its own size to the screen's). The kit's Expand
// does a launch by uncovering the app from its top edge, with what is in it
// faded in late; this stands in for it where an app opens.

/** How long an app takes to open and to be put away, and the curve both follow: quick off the mark and long to settle, like a spring with no bounce in it. */
export const ZOOM = { open: 380, close: 320, curve: 'cubic-bezier(0.25, 0.75, 0.25, 1)' }

export function Zoom({ open, from, radius = 16, still, face, children, className, style, ...rest }: HTMLAttributes<HTMLDivElement> & { open: boolean; /** What it opens out of, in the stage's pixels. */ from: Rect; radius?: number; /** It is where it is going already: nothing moves. */ still?: boolean; face: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  // Where the screen sits on the stage, and how much it is scaled there (the stage's scale, times a framed phone's own)
  const [box, setBox] = useState({ w: 0, h: 0, x: 0, y: 0, k: 1, r: 0 })
  useLayoutEffect(() => {
    const p = ref.current?.parentElement
    const stage = p?.closest<HTMLElement>('.ss-stage')
    if (!p || !stage) return
    const sr = stage.getBoundingClientRect()
    const pr = p.getBoundingClientRect()
    const s = sr.width / stage.offsetWidth || 1
    const k = pr.width / p.offsetWidth || 1
    // In a framed phone the open app keeps the display's own corners, and lands under the bezel's
    const r = parseFloat(getComputedStyle(p).getPropertyValue('--ss-screen-r')) || 0
    setBox({ w: p.clientWidth, h: p.clientHeight, x: (pr.left - sr.left) / s + (p.clientLeft * k) / s, y: (pr.top - sr.top) / s + (p.clientTop * k) / s, k: k / s, r })
  }, [from.x, from.y, from.width, from.height])
  const reduced = useReducedMotion()
  // Only opening and closing move. A new `from` while it stays as it is (the first measure, a re-measure)
  // is taken at once: moving to it would sweep the window in from wherever the unmeasured box put it
  const key = `${open}|${from.x}|${from.y}|${from.width}|${from.height}|${box.w}|${box.h}|${box.x}|${box.y}`
  const last = useRef({ open, key })
  const moving = last.current.key === key || last.current.open !== open || open
  useLayoutEffect(() => {
    last.current = { open, key }
  })
  // Nothing to open out of has been measured yet: it isn't shown at all
  const unmeasured = !open && (!from.width || !from.height || !box.w)
  // `from` in the screen's own pixels
  const x = (from.x - box.x) / box.k
  const y = (from.y - box.y) / box.k
  const w = from.width / box.k
  const h = from.height / box.k
  const right = Math.max(0, box.w - x - w)
  const below = Math.max(0, box.h - y - h)
  const sx = box.w ? w / box.w : 1
  const sy = box.h ? h / box.h : 1
  const ms = reduced || still || !moving ? 0 : open ? ZOOM.open : ZOOM.close
  const go = `${ms}ms ${ZOOM.curve}`
  // The app is seen as soon as it starts to grow, and until it is nearly its icon again; the icon's picture
  // is gone by the time the app is a third of the way out, and back for the last of the way in
  const fade = (first: number, wait: number) => `opacity ${Math.round(ms * first)}ms ease ${Math.round(ms * wait)}ms`
  const windowAt: CSSProperties = { clipPath: open ? `inset(0px 0px 0px 0px round ${box.r}px)` : `inset(${y}px ${right}px ${below}px ${x}px round ${radius}px)`, transition: `clip-path ${go}` }
  const appAt: CSSProperties = { transform: open ? 'translate(0px, 0px) scale(1, 1)' : `translate(${x}px, ${y}px) scale(${sx}, ${sy})`, opacity: open ? 1 : 0, transition: `transform ${go}, ${open ? fade(0.3, 0) : fade(0.3, 0.62)}` }
  const faceAt: CSSProperties = {
    width: w,
    height: h,
    transform: open ? `translate(0px, 0px) scale(${sx ? 1 / sx : 1}, ${sy ? 1 / sy : 1})` : `translate(${x}px, ${y}px) scale(1, 1)`,
    opacity: open ? 0 : 1,
    transition: `transform ${go}, ${open ? fade(0.36, 0) : fade(0.3, 0.6)}`,
  }
  return (
    <div {...rest} ref={ref} className={`sb-zoom${className ? ` ${className}` : ''}`} data-open={open || undefined} style={{ ...windowAt, ...(unmeasured ? { visibility: 'hidden' } : null), ...style }}>
      <div className="sb-zoom__app" style={appAt}>
        {children}
      </div>
      <div className="sb-zoom__face" style={faceAt}>
        {face}
      </div>
    </div>
  )
}
