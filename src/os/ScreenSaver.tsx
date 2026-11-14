import { useEffect, useRef, useState } from 'react'
import { PEOPLE } from '../data/people'
import { PhoneLock } from '../phone/Lock'
import { SITE } from '../data/site'
import { prefersReducedMotion } from './dom'
import { idleSeconds, saver, startSaver, wakeSaver } from './saver'
import { useStore } from './store'
import { wm } from './wm'

// The screen saver. The shrug drifts across a dark screen and turns at the
// edges, the clock sits where a lock screen keeps it, and the people from the
// group chat pass by one at a time. Any key, click or movement wakes the desk.
// On a phone it is the phone's lock screen instead.

const DATE = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
const TIME = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

/** The colors the shrug takes, one after another, each time it turns. */
const TINTS = ['#ffffff', '#9fd0ff', '#ffd66b', '#ff9d8a', '#b9a4ff', '#8ee6b8']

export function ScreenSaver() {
  const on = useStore(saver, (s) => s.on)
  const compact = useStore(wm, (s) => s.compact)
  const [now, setNow] = useState(() => new Date())
  const [who, setWho] = useState(0)
  const mark = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const clock = useRef<HTMLDivElement>(null)
  const foot = useRef<HTMLDivElement>(null)

  // Starts itself once the desk has been still long enough
  useEffect(() => {
    const wait = idleSeconds() * 1000
    let timer: ReturnType<typeof setTimeout>
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!document.hidden) startSaver()
      }, wait)
    }
    const stir = () => {
      if (saver.get().on) wakeSaver()
      arm()
    }
    // The key that wakes it is swallowed: it must not also type into, or
    // press, whatever had the keyboard underneath
    const key = (e: KeyboardEvent) => {
      if (!saver.get().on) return
      e.preventDefault()
      e.stopPropagation()
    }
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    window.addEventListener('keydown', key, true)
    events.forEach((name) => window.addEventListener(name, stir, { passive: true }))
    arm()
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', key, true)
      events.forEach((name) => window.removeEventListener(name, stir))
    }
  }, [])

  // While it's on: the clock ticks, the names turn over, the shrug drifts
  useEffect(() => {
    if (!on) return
    setNow(new Date())
    const tick = setInterval(() => setNow(new Date()), 5000)
    const turn = setInterval(() => setWho((n) => (n + 1) % PEOPLE.length), 4200)
    const el = mark.current
    const box = root.current
    let frame = 0
    if (el && box && !prefersReducedMotion()) {
      const size = { w: el.offsetWidth, h: el.offsetHeight }
      // Its room: under the clock, over the names, edge to edge
      const band = () => {
        const top = clock.current ? clock.current.offsetTop + clock.current.offsetHeight : 0
        const bottom = foot.current ? foot.current.offsetTop : box.clientHeight
        const minY = Math.min(top, Math.max(0, box.clientHeight - size.h))
        return { maxX: Math.max(0, box.clientWidth - size.w), minY, maxY: Math.max(minY, bottom - size.h) }
      }
      const start = band()
      let x = start.maxX * 0.3
      let y = start.minY + (start.maxY - start.minY) * 0.5
      let vx = 46
      let vy = 30
      let tint = 0
      let last = performance.now()
      const loop = (t: number) => {
        const dt = Math.min(0.05, (t - last) / 1000)
        last = t
        const { maxX, minY, maxY } = band()
        x += vx * dt
        y += vy * dt
        let turned = false
        if (x <= 0 || x >= maxX) {
          vx = x <= 0 ? Math.abs(vx) : -Math.abs(vx)
          x = Math.min(maxX, Math.max(0, x))
          turned = true
        }
        if (y <= minY || y >= maxY) {
          vy = y <= minY ? Math.abs(vy) : -Math.abs(vy)
          y = Math.min(maxY, Math.max(minY, y))
          turned = true
        }
        if (turned) {
          tint = (tint + 1) % TINTS.length
          el.style.color = TINTS[tint]!
        }
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
        frame = requestAnimationFrame(loop)
      }
      frame = requestAnimationFrame(loop)
    }
    return () => {
      clearInterval(tick)
      clearInterval(turn)
      cancelAnimationFrame(frame)
    }
  }, [on, compact])

  if (compact) return <PhoneLock on={on} now={now} />

  const person = PEOPLE[who]!

  return (
    <div ref={root} className="saver" data-on={on || undefined} aria-hidden={!on} {...(on ? null : ({ inert: '' } as object))}>
      <div className="saver__sky" />
      <div ref={clock} className="saver__clock">
        <div className="saver__date">{DATE.format(now)}</div>
        <div className="saver__time">{TIME.format(now).replace(/\s?[AP]M$/i, '')}</div>
      </div>
      <div ref={mark} className="saver__mark">
        {SITE.mark}
      </div>
      <div ref={foot} className="saver__foot">
        <div className="saver__who" key={who}>
          <span className="saver__name">{person.name}</span>
          <span className="saver__role">{person.role}</span>
        </div>
        <div className="saver__hint">Move, click or press a key to wake</div>
      </div>
    </div>
  )
}
