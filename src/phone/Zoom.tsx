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
// Two things move, on one clock and one curve: the app (from the icon's box to
// its own size, its corners from the icon's to the screen's) and the icon's
// picture over it (from its own size to as wide as the screen). Both are
// moved by a transform and nothing else, so the browser can draw the whole of
// it without the page's own thread: an app that is still being put together
// while it opens does not hold the opening up, and the window is never
// somewhere its contents are not. (A clip that had to be redrawn each frame
// was: on a phone it fell behind, and the app seemed to start from the middle
// of the screen.) The corners are the one thing set each frame, and are only
// a shape.
//
// The picture keeps its own shape as it grows. The window goes from a square
// to the shape of the screen, twice as tall as it is wide, and a picture
// stretched to cover it all the way was drawn tall and thin in mid-flight
// (a terminal's prompt, a company's logo). So the picture grows by one amount, the
// one that keeps it as wide as the window, and stays in the middle of the
// window's height while it fades.

/** How long an app takes to open and to be put away. Both follow the phone's spring (`--spring`, ios.css):
 * off from a standstill, most of the way in the first third of the time, and a long soft landing. */
export const ZOOM = { open: 400, close: 340 }

export function Zoom({
  open,
  from,
  radius = 16,
  still,
  face,
  quick,
  vanish,
  children,
  className,
  style,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  open: boolean
  /** What it opens out of, in the stage's pixels. */
  from: Rect
  radius?: number
  /** It is where it is going already: nothing moves. */
  still?: boolean
  face: ReactNode
  /** What it opens out of has words on it (a widget): its picture goes sooner, before the app's own words are read through it. */
  quick?: boolean
  /** What it is going back into is not a picture of it (a row of words in a list): no picture comes up
   * over it, and it fades away over the last third of the way there instead of landing on the row. */
  vanish?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Where the screen sits on the stage, and how much it is scaled there (the stage's scale, times a framed phone's own)
  const [box, setBox] = useState({ w: 0, h: 0, x: 0, y: 0, k: 1 })
  useLayoutEffect(() => {
    const p = ref.current?.parentElement
    const stage = p?.closest<HTMLElement>('.ss-stage')
    if (!p || !stage) return
    const sr = stage.getBoundingClientRect()
    const pr = p.getBoundingClientRect()
    const s = sr.width / stage.offsetWidth || 1
    const k = pr.width / p.offsetWidth || 1
    const next = { w: p.clientWidth, h: p.clientHeight, x: (pr.left - sr.left) / s + (p.clientLeft * k) / s, y: (pr.top - sr.top) / s + (p.clientTop * k) / s, k: k / s }
    setBox((was) => (was.w === next.w && was.h === next.h && was.x === next.x && was.y === next.y && was.k === next.k ? was : next))
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
  const sx = box.w ? w / box.w : 1
  const sy = box.h ? h / box.h : 1
  const ms = reduced || still || !moving ? 0 : open ? ZOOM.open : ZOOM.close
  const go = `${ms}ms var(--spring)`
  // The icon's picture is gone by the time the app is half-way out, and back as it lands: `first` and `wait` are shares of the move
  const fade = (first: number, wait: number) => `opacity ${Math.round(ms * first)}ms ease ${Math.round(ms * wait)}ms`
  // Pressed onto the icon, the app is scaled by different amounts across and down: its corners are set so
  // that, scaled, they come out as the icon's own round ones
  const appAt: CSSProperties = {
    transform: open ? 'translate(0px, 0px) scale(1, 1)' : `translate(${x}px, ${y}px) scale(${sx}, ${sy})`,
    borderRadius: open || !sx || !sy ? '0px' : `${radius / sx}px / ${radius / sy}px`,
    transition: `transform ${go}, border-radius ${go}`,
  }
  // The picture grows by the one amount, across and down, that keeps it as wide as the window, and is kept
  // in the middle of the window's height. The window's height and the picture's both change evenly with
  // the move, so a picture that is in the middle at either end is in the middle all the way
  const grown = sx ? 1 / sx : 1
  const faceAt: CSSProperties = {
    width: w,
    height: h,
    transform: open ? `translate(0px, ${(box.h - h * grown) / 2}px) scale(${grown})` : `translate(${x}px, ${y}px) scale(1)`,
    opacity: open || vanish ? 0 : 1,
    // (While the window is much taller than the picture, the app shows over and under it: so the picture is
    // gone early on the way out, and comes back late on the way in, when the window is all but its shape again)
    transition: `transform ${go}, ${open ? (quick ? fade(0.2, 0) : fade(0.26, 0.02)) : fade(0.3, 0.48)}`,
  }
  // Going back into a row, the whole of it fades over the last third of the way; opening, it is simply there
  const rootAt: CSSProperties = !open && vanish ? { opacity: 0, transition: `opacity ${Math.round(ms / 3)}ms ease ${Math.round((ms * 2) / 3)}ms` } : {}
  return (
    <div {...rest} ref={ref} className={`sb-zoom${className ? ` ${className}` : ''}`} data-open={open || undefined} style={{ ...(unmeasured ? { visibility: 'hidden' } : null), ...rootAt, ...style }}>
      <div className="sb-zoom__app" style={appAt}>
        {children}
      </div>
      <div className="sb-zoom__face" style={faceAt} aria-hidden>
        {face}
      </div>
    </div>
  )
}
