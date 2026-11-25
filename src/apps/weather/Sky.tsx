import { useEffect, useRef, type CSSProperties } from 'react'
import { prefersReducedMotion } from '../../os/dom'
import type { SkyKind, SkyLight } from '../../os/weather'

// The sky behind the Weather window, and behind each place's card: moving, as the Mac's own is. Its ground is
// the light it is in (day, the hour about sunrise and sunset, night) and what is in it (styles/desk/weather.css);
// over that, clouds that drift, as many as the sky has; a sun's glow on a clear day; and on a canvas whatever
// falls or shines: rain, snow, a storm's flashes, the stars. A card's sky is the same sky, still.
//
// It moves only while its window is in sight, and not at all for a visitor who has asked for less motion:
// then it is one still picture of the same weather.

/** How many clouds each sky has. */
const CLOUDS: Record<SkyKind, number> = { clear: 0, some: 3, cloud: 6, fog: 5, rain: 6, snow: 6, storm: 7 }

interface Mote {
  x: number
  y: number
  /** How fast it falls, how long or large it is, and how far through its twinkle it began. */
  v: number
  size: number
  at: number
}

export function Sky({ kind, light, live = false, still = false }: { kind: SkyKind; light: SkyLight; live?: boolean; still?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const falls = kind === 'rain' || kind === 'storm' ? 'rain' : kind === 'snow' ? 'snow' : light === 'night' && (kind === 'clear' || kind === 'some') ? 'stars' : null

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx || !falls) return
    const moving = live && !prefersReducedMotion()
    let w = 0
    let h = 0
    let motes: Mote[] = []
    let frame = 0
    let last = performance.now()
    /** A storm's flash: when the next one is, and how bright the last one still is. */
    let flashAt = last + 4000 + Math.random() * 5000
    let flash = 0
    const scatter = () => {
      const count = falls === 'rain' ? Math.round((w * h) / 5200) : falls === 'snow' ? Math.round((w * h) / 9000) : Math.round((w * h) / 7000)
      motes = Array.from({ length: Math.max(24, Math.min(count, 260)) }, () => ({
        x: Math.random() * w,
        y: Math.random() * (falls === 'stars' ? h * 0.75 : h),
        v: falls === 'rain' ? 620 + Math.random() * 380 : falls === 'snow' ? 26 + Math.random() * 42 : 0,
        size: falls === 'rain' ? 10 + Math.random() * 14 : falls === 'snow' ? 1 + Math.random() * 2.2 : 0.5 + Math.random() * 1.1,
        at: Math.random() * Math.PI * 2,
      }))
    }
    const fit = () => {
      const box = el.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      w = Math.max(1, box.width)
      h = Math.max(1, box.height)
      el.width = Math.round(w * ratio)
      el.height = Math.round(h * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      scatter()
      draw(0)
    }
    const draw = (dt: number) => {
      ctx.clearRect(0, 0, w, h)
      if (falls === 'rain') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)'
        ctx.lineWidth = 1.1
        ctx.lineCap = 'round'
        ctx.beginPath()
        for (const m of motes) {
          m.y += m.v * dt
          m.x -= m.v * dt * 0.16
          if (m.y > h + 20) (m.y = -20), (m.x = Math.random() * (w + 60))
          ctx.moveTo(m.x, m.y)
          ctx.lineTo(m.x - m.size * 0.16, m.y + m.size)
        }
        ctx.stroke()
        if (kind === 'storm' && flash > 0.01) {
          ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.5})`
          ctx.fillRect(0, 0, w, h)
        }
      } else if (falls === 'snow') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.86)'
        for (const m of motes) {
          m.at += dt
          m.y += m.v * dt
          m.x += Math.sin(m.at) * 12 * dt
          if (m.y > h + 6) (m.y = -6), (m.x = Math.random() * w)
          ctx.beginPath()
          ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2)
          ctx.fill()
        }
      } else {
        for (const m of motes) {
          m.at += dt * (0.6 + m.size)
          ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + 0.5 * (0.5 + 0.5 * Math.sin(m.at))})`
          ctx.beginPath()
          ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (kind === 'storm') {
        if (now > flashAt) (flash = 1), (flashAt = now + 5000 + Math.random() * 7000)
        flash *= 0.9
      }
      draw(dt)
      frame = requestAnimationFrame(tick)
    }
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    if (moving) frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      watch.disconnect()
    }
  }, [falls, kind, live])

  return (
    <span className="wt-sky" data-kind={kind} data-light={light} data-still={still || !live || undefined} aria-hidden>
      {light !== 'night' && (kind === 'clear' || kind === 'some') && <i className="wt-sun" />}
      {Array.from({ length: still ? Math.min(2, CLOUDS[kind]) : CLOUDS[kind] }, (_, i) => (
        <i key={i} className="wt-cloud" style={{ ['--n' as string]: i } as CSSProperties} />
      ))}
      {!still && falls && <canvas ref={canvas} />}
    </span>
  )
}
