import { Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { APPS } from '../os/apps'
import { useStore } from '../os/store'
import { AppScreen, SheetScreen } from './apps'
import type { ShotApp } from './convo'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Chooser } from './Chooser'
import { phone } from './nav'
import { ViewContext } from './ui'
import { goToVariant, variantFromUrl, VARIANTS } from './variants'

// The site on a phone. While the phone's design is being chosen there are ten
// versions of it (src/phone/variants): the address picks one (`?v=3`), and with
// none it shows the list. A version is the phone's home; the pages and sheets
// that can open over it are shared. It is drawn edge to edge and leaves the
// status bar and the home indicator to the real phone.

/** The version this page is showing: fixed for the life of the page. */
const PICKED = variantFromUrl()

/** What a screenshot opens into: full screen, out of the bubble it was sent in and back into it. */
function Opened({ app, state, still, active }: { app: ShotApp; state: 'open' | 'closing'; still: boolean; active: boolean }) {
  const ref = useRef<HTMLElement>(null)
  // Where its bubble is from here: the move it makes on the way in and on the way out
  useLayoutEffect(() => {
    const el = ref.current
    const box = el?.parentElement?.getBoundingClientRect()
    const shots = document.querySelectorAll<HTMLElement>(`[data-shot="${app}"]`)
    const shot = shots[shots.length - 1]?.getBoundingClientRect()
    if (!el || !box || !box.width) return
    // No bubble to come from (a link straight to it): it rises a little, from where it is
    el.style.setProperty('--dx', shot ? `${(shot.left + shot.width / 2 - (box.left + box.width / 2)).toFixed(1)}px` : '0px')
    el.style.setProperty('--dy', shot ? `${(shot.top + shot.height / 2 - (box.top + box.height / 2)).toFixed(1)}px` : '48px')
    el.style.setProperty('--k', shot ? (shot.width / box.width).toFixed(4) : '0.94')
  }, [app, state])
  return (
    <section ref={ref} className="ph-app" data-app={app} data-state={state} data-still={still || undefined} aria-label={APPS[app].name} {...(active ? null : ({ inert: '' } as object))}>
      <ViewContext.Provider value={{ active }}>
        <AppScreen app={app} />
      </ViewContext.Provider>
    </section>
  )
}

export function Phone() {
  const { app, sheet, leaving, closing, motion } = useStore(phone, (s) => s)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = root.current
    const vv = window.visualViewport
    if (!el) return
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
  }, [])

  const opened = app && app !== 'messages' ? app : null
  const going = leaving && leaving !== 'messages' && leaving !== opened ? leaving : null
  const over = sheet ?? closing
  const variant = VARIANTS[PICKED - 1]

  if (!variant)
    return (
      <div ref={root} className="ph">
        <Chooser />
      </div>
    )

  const Home = variant.Home
  return (
    <div ref={root} className="ph" data-v={variant.id}>
      {/* Scaffolding for choosing between the versions: not part of any of them */}
      <nav className="ph-proto" aria-label="Versions">
        <button type="button" className="ph-proto__all" onClick={() => goToVariant(0)}>
          <ChevronLeft size={15} strokeWidth={2.6} aria-hidden />
          All
        </button>
        <span className="ph-proto__name">
          {variant.id} · {variant.name}
        </span>
        <span className="ph-proto__step">
          <button type="button" aria-label="Previous version" disabled={variant.id === 1} onClick={() => goToVariant(variant.id - 1)}>
            <ChevronLeft size={16} strokeWidth={2.6} aria-hidden />
          </button>
          <button type="button" aria-label="Next version" disabled={variant.id === VARIANTS.length} onClick={() => goToVariant(variant.id + 1)}>
            <ChevronRight size={16} strokeWidth={2.6} aria-hidden />
          </button>
        </span>
      </nav>
      <div className="ph-stage">
        <div className="ph-under" data-covered={opened ? '' : undefined} {...(opened || sheet ? ({ inert: '' } as object) : null)}>
          <Suspense fallback={null}>
            <Home active={!opened && !sheet} />
          </Suspense>
        </div>
        {going && <Opened key={going} app={going} state="closing" still={!motion} active={false} />}
        {opened && <Opened key={opened} app={opened} state="open" still={!motion} active={!sheet} />}
        {over && <SheetScreen key={over} sheet={over} closing={!sheet} />}
      </div>
    </div>
  )
}
