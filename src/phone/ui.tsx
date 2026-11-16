import { createContext, useContext, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ChevronLeft, Search, X } from 'lucide-react'
import { GROUP_NAME } from '../apps/chat-ui'
import { closeApp, closeSheet } from './nav'

// The parts of the phone's screens other than the conversation itself: a page
// with a back button and a large title that moves into the bar as it scrolls,
// a search field, grouped lists, and a sheet that can be dragged away. The
// phone's own status bar and home indicator are the real ones.

/** Whether a screen is the one in front, with nothing over it. */
export const ViewContext = createContext<{ active: boolean }>({ active: true })
export const useView = () => useContext(ViewContext)

export interface PageProps {
  /** The page's name: large at the top of the content, and in the bar once that has scrolled away. */
  title?: string
  /** In the bar's middle, in place of the title: a conversation's face and name. */
  center?: ReactNode
  trailing?: ReactNode
  /** plain: white. grouped: the gray that grouped lists sit on. */
  tone?: 'plain' | 'grouped'
  /** The content manages its own scrolling (a conversation): the page doesn't scroll. */
  fixed?: boolean
  className?: string
  children: ReactNode
}

/** Something opened out of the conversation: a bar whose back button returns to it, and the content under it. */
export function Page({ title, center, trailing, tone = 'plain', fixed, className, children }: PageProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const large = !!title && !center

  // The large title has gone under the bar: the bar takes the title
  useEffect(() => {
    const root = scroller.current
    const el = heading.current
    if (!root || !el || !large) return
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry!.isIntersecting), { root, rootMargin: '-56px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [large])

  return (
    <div className={`ph-page${className ? ` ${className}` : ''}`} data-tone={tone} data-fixed={fixed || undefined}>
      <header className="ph-nav" data-scrolled={scrolled || !large || undefined} data-center={center ? '' : undefined}>
        <div className="ph-nav__side">
          <button type="button" className="ph-back" aria-label={`Back to ${GROUP_NAME}`} onClick={closeApp}>
            <ChevronLeft size={22} strokeWidth={2.4} aria-hidden />
            <span>{GROUP_NAME}</span>
          </button>
        </div>
        <div className="ph-nav__middle">{center}</div>
        <div className="ph-nav__side ph-nav__side--end">{trailing}</div>
      </header>
      <div ref={scroller} className="ph-page__content" data-scroller={fixed ? undefined : ''}>
        {large && (
          <h2 ref={heading} className="ph-large-title">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  )
}

/** The search field at the top of a list. */
export function PhoneSearch({ value, onChange, label, placeholder = 'Search' }: { value: string; onChange: (value: string) => void; label: string; placeholder?: string }) {
  return (
    <label className="ph-search" data-filled={value ? '' : undefined}>
      <Search size={17} strokeWidth={2.2} aria-hidden />
      <input type="text" inputMode="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" spellCheck={false} placeholder={placeholder} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button type="button" className="ph-search__clear" aria-label="Clear search" onClick={() => onChange('')}>
          <X size={11} strokeWidth={3} aria-hidden />
        </button>
      )}
    </label>
  )
}

/** A row of filters that scrolls sideways. */
export function Chips<T extends string | number | null>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="ph-chips" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={String(option.value)} type="button" className="ph-chip" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** A grouped list: rounded, inset from the screen's edges, hairlines between its rows. */
export function Group({ label, footer, children }: { label?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="ph-group">
      {label && <h3 className="ph-group__label">{label}</h3>}
      <div className="ph-group__rows">{children}</div>
      {footer && <p className="ph-group__footer">{footer}</p>}
    </section>
  )
}

/** How far a sheet must be dragged, or how fast flicked, to go. */
const AWAY = { distance: 110, speed: 0.55 }

/** A sheet over the app: a grabber to drag it away by, a close button, and what
 * it holds. `leading` goes where a back button would, when the sheet has
 * somewhere to go back to. */
export function Sheet({ label, closing, leading, children }: { label: string; closing?: boolean; leading?: ReactNode; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  const shade = useRef<HTMLButtonElement>(null)
  const drag = useRef<{ y: number; t: number; dy: number; v: number } | null>(null)

  const place = (dy: number, moving: boolean) => {
    const el = panel.current
    if (!el) return
    el.style.transition = moving ? 'none' : ''
    el.style.transform = dy ? `translateY(${dy}px)` : ''
    if (shade.current) {
      shade.current.style.transition = moving ? 'none' : ''
      shade.current.style.opacity = dy ? String(Math.max(0, 1 - dy / (el.offsetHeight || 1))) : ''
    }
  }

  const down = (e: ReactPointerEvent) => {
    if (closing || (e.target as HTMLElement).closest('button, a, input')) return
    drag.current = { y: e.clientY, t: e.timeStamp, dy: 0, v: 0 }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const dy = Math.max(0, e.clientY - d.y)
    const dt = Math.max(1, e.timeStamp - d.t)
    // The speed of the last stretch of the drag, eased so one jumpy sample doesn't decide it
    d.v = d.v * 0.6 + ((dy - d.dy) / dt) * 0.4
    d.dy = dy
    d.t = e.timeStamp
    place(dy, true)
  }

  const up = (e: ReactPointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const el = panel.current
    // A finger that came to rest before letting go wasn't flicking
    const speed = e.timeStamp - d.t > 90 ? 0 : d.v
    if (el && (d.dy > AWAY.distance || (d.dy > 24 && speed > AWAY.speed))) {
      // Let go far enough, or fast enough: it carries on down and is gone
      el.style.transition = 'transform 0.26s cubic-bezier(0.4, 0, 0.9, 0.6)'
      el.style.transform = 'translateY(110%)'
      if (shade.current) {
        shade.current.style.transition = 'opacity 0.26s ease'
        shade.current.style.opacity = '0'
      }
      setTimeout(() => closeSheet(false), 250)
    } else place(0, false)
  }

  // Escape closes it, as it closes any dialog
  useEffect(() => {
    if (closing) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [closing])

  return (
    <div className="ph-sheet" data-closing={closing || undefined} role="dialog" aria-modal="true" aria-label={label} {...(closing ? ({ inert: '' } as object) : null)}>
      <button ref={shade} type="button" className="ph-sheet__shade" aria-label="Close" tabIndex={-1} onClick={() => closeSheet()} />
      <div ref={panel} className="ph-sheet__panel">
        <div className="ph-sheet__bar" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <span className="ph-sheet__grabber" aria-hidden />
          <span className="ph-sheet__lead">{leading}</span>
          <button type="button" className="ph-sheet__close" aria-label="Close" onClick={() => closeSheet()}>
            <X size={16} strokeWidth={2.8} aria-hidden />
          </button>
        </div>
        <div className="ph-sheet__body">{children}</div>
      </div>
    </div>
  )
}
