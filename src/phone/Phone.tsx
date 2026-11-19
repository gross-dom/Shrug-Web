import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Phone as Device } from '../kit/phone'
import { useStore } from '../os/store'
import { PHONE_UNDER, wm } from '../os/wm'
import { useEdges } from './edges'
import { SoftKeyboard } from './Keyboard'
import { Springboard } from './Springboard'
import { SITE } from '../data/site'
import { moving, sys } from './system'
import { clockOf, useNow } from './time'

// The site as an iPhone. On a real phone the phone itself is the frame: the
// screen is drawn edge to edge, under the phone's own status bar, and the
// browser's bars are painted to match what is showing, so that the page runs
// to the top and the foot of the phone (edges.ts). Anywhere else (a narrow
// window on a computer, or `?phone`) it is drawn inside the kit's iPhone, at
// the real proportions, with the status bar and the island the kit draws:
// unless the window is too small to hold that at a size that can be read, in
// which case it is edge to edge there too. That layout reflows to whatever
// room there is, so a window zoomed to twice or four times its size gets
// larger type and loses nothing; a frame can only shrink.

/** The kit's iPhone, frame and all, in points. */
const DEVICE = { w: 428, h: 900 }

/** `?phone=hand` draws it edge to edge whatever it is running on: for trying
 * the layout a real phone gets in a browser that isn't one. */
const HANDED = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('phone') === 'hand'

/** Whether this is a phone in the hand: a touch screen about a phone's width. */
const inHand = (w: number, h: number) => HANDED || (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches && Math.min(w, h) <= 500)

/** How wide the frame can be drawn in a window, in points: as large as the
 * window allows, and never larger than life. */
const frameWidth = (w: number, h: number) => Math.floor(Math.min(DEVICE.w, w - 32, ((h - 40) * DEVICE.w) / DEVICE.h))

/** The least of its real size the frame is worth drawing at. Under two thirds,
 * the phone's 17-point type is under 12 pixels and the names under its icons
 * under 8: a window that small (about 650 pixels tall, or 320 wide) is the
 * phone's screen itself instead. Where the window is a desktop's and the phone
 * was asked for (`?phone`, a preview), the frame is what was asked for and is
 * kept a little smaller; it always fits there. */
const LEAST = { small: 0.68, asked: 0.58 }

/** Whether the frame can be drawn in this window at a size that can be read. */
function framable(w: number, h: number) {
  const small = w < PHONE_UNDER.w || h < PHONE_UNDER.h
  return frameWidth(w, h) / DEVICE.w >= (small ? LEAST.small : LEAST.asked)
}

export function Phone() {
  const viewport = useStore(wm, (s) => s.viewport)
  const { dark, darkFoot, top, foot } = useEdges()
  const now = useNow()
  const root = useRef<HTMLDivElement>(null)
  const bleed = inHand(viewport.w, viewport.h) || !framable(viewport.w, viewport.h)
  // A move is being drawn: the screens take no presses until it has been (phone.css)
  const busy = useStore(moving, (on) => on)
  // While the phone is locked its status bar names the network where the time would be, as an iPhone's
  // does (the Lock Screen's own clock is right under it): the network here is Shrug
  const locked = useStore(sys, (s) => s.locked)

  // The frame's signal, Wi-Fi and battery are pictures of a status bar, not readings: nothing for a screen reader
  useEffect(() => {
    if (!bleed) document.querySelector('.ph-device .ss-phone__glyphs')?.setAttribute('aria-hidden', 'true')
  }, [bleed])

  // A real phone: the browser's own bars take the colour of what is at the edge they are on. Safari reads
  // it from the strips fixed along the page's top and foot (drawn below, outside everything else on the
  // page, where nothing can make them less than fixed), and falls back on the page's own colour; an older
  // browser reads `theme-color`. All three say the same thing (edges.ts)
  useEffect(() => {
    if (!bleed) return
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const root = document.documentElement
    const before = { meta: meta?.content, root: root.style.backgroundColor, body: document.body.style.backgroundColor }
    if (meta) meta.content = top
    root.style.backgroundColor = top
    document.body.style.backgroundColor = foot
    return () => {
      if (meta && before.meta) meta.content = before.meta
      root.style.backgroundColor = before.root
      document.body.style.backgroundColor = before.body
    }
  }, [bleed, top, foot])

  useEffect(() => {
    const el = root.current
    const vv = window.visualViewport
    if (!el || !bleed) return
    // Lets :active show under a finger in Safari, which otherwise waits for a listener
    const touch = () => {}
    document.addEventListener('touchstart', touch, { passive: true })
    // The keyboard takes the bottom of the screen: the phone keeps to what is
    // left above it. A pinch-zoom is not a keyboard.
    const fit = () => {
      if (!vv || Math.abs(vv.scale - 1) > 0.01) return
      const keyboard = window.innerHeight - vv.height > 120
      el.toggleAttribute('data-keyboard', keyboard)
      if (keyboard) {
        el.style.setProperty('--vv-h', `${vv.height}px`)
        el.style.setProperty('--vv-top', `${vv.offsetTop}px`)
      } else {
        el.style.removeProperty('--vv-h')
        el.style.removeProperty('--vv-top')
        // Safari can leave the page nudged up after the keyboard has gone
        if (window.scrollY) window.scrollTo(0, 0)
      }
    }
    fit()
    vv?.addEventListener('resize', fit)
    vv?.addEventListener('scroll', fit)
    return () => {
      document.removeEventListener('touchstart', touch)
      vv?.removeEventListener('resize', fit)
      vv?.removeEventListener('scroll', fit)
    }
  }, [bleed])

  if (bleed)
    return (
      <>
        <div ref={root} className="ph ph--bleed" data-dark={dark || undefined} data-dark-foot={darkFoot || undefined} data-moving={busy || undefined}>
          <Springboard framed={false} />
        </div>
        {/* The colour of the screen's top edge and of its foot, each in a strip fixed along that edge: what the
            browser's bars are painted from */}
        {createPortal(
          <>
            <span className="ph-edge ph-edge--top" style={{ backgroundColor: top }} aria-hidden />
            <span className="ph-edge ph-edge--foot" style={{ backgroundColor: foot }} aria-hidden />
          </>,
          document.body,
        )}
      </>
    )

  const width = frameWidth(viewport.w, viewport.h)
  return (
    <div className="ph-desk">
      <Device width={width} time={locked ? SITE.name : clockOf(now)} dark={dark} wallpaper="#000" className="ph-device">
        <div ref={root} className="ph ph--framed" data-dark={dark || undefined} data-dark-foot={darkFoot || undefined} data-moving={busy || undefined}>
          <Springboard framed />
        </div>
        <SoftKeyboard screen={root} />
      </Device>
    </div>
  )
}
