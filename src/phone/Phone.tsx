import { useEffect, useRef } from 'react'
import { Phone as Device } from '../kit/phone'
import { useStore } from '../os/store'
import { wm } from '../os/wm'
import { COLOR, WALLPAPER_TOP, carried, chrome } from './chrome'
import { Springboard } from './Springboard'
import { sys } from './system'
import { clockOf, useNow } from './time'

// The site as an iPhone. On a real phone the phone itself is the frame: the
// screen is drawn edge to edge, under the phone's own status bar, and the
// browser's bars are painted to match what is showing. Anywhere else (a narrow
// window on a computer, or `?phone`) it is drawn inside the kit's iPhone, at
// the real proportions, with the status bar and the island the kit draws.

/** The kit's iPhone, frame and all, in points. */
const DEVICE = { w: 428, h: 900 }

/** Whether this is a phone in the hand: a touch screen about a phone's width. */
const inHand = (w: number, h: number) => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches && Math.min(w, h) <= 500

/** Whether the status bar's ink is light: over the wallpaper, or over a dark app. */
function useDark() {
  const tones = useStore(chrome, (s) => s)
  const lifted = useStore(carried, (s) => s)
  const app = useStore(sys, (s) => (s.locked || s.switcher || s.spotlight ? null : s.app))
  return { dark: !app || lifted || tones[app] === 'dark', color: app && !lifted ? COLOR[tones[app]] : WALLPAPER_TOP }
}

export function Phone() {
  const viewport = useStore(wm, (s) => s.viewport)
  const { dark, color } = useDark()
  const now = useNow()
  const root = useRef<HTMLDivElement>(null)
  const bleed = inHand(viewport.w, viewport.h)

  // A real phone: the browser's own bars take the colour of what is under them
  useEffect(() => {
    if (!bleed) return
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const before = { meta: meta?.content, body: document.body.style.backgroundColor }
    if (meta) meta.content = color
    document.body.style.backgroundColor = color
    return () => {
      if (meta && before.meta) meta.content = before.meta
      document.body.style.backgroundColor = before.body
    }
  }, [bleed, color])

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
      <div ref={root} className="ph ph--bleed" data-dark={dark || undefined}>
        <Springboard framed={false} />
      </div>
    )

  // As large as the window allows, and never larger than life
  const width = Math.max(220, Math.floor(Math.min(DEVICE.w, viewport.w - 32, ((viewport.h - 40) * DEVICE.w) / DEVICE.h)))
  return (
    <div className="ph-desk">
      <Device width={width} time={clockOf(now)} dark={dark} wallpaper="#000" className="ph-device">
        <div ref={root} className="ph ph--framed" data-dark={dark || undefined}>
          <Springboard framed />
        </div>
      </Device>
    </div>
  )
}
