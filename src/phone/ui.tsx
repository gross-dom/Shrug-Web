import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, LayoutGrid, Search, X } from 'lucide-react'
import { goBack, goHome } from './nav'

// The parts every screen on the phone is built from, laid out the way iOS
// lays them out: a bar of glass buttons over the content, a large title that
// shrinks into the bar as the page scrolls, a search field, grouped lists and
// a sheet. The phone's own status bar and home indicator are the real ones.

/** Where a view sits in its app: the first page has the way home, the rest go back. */
export const ViewContext = createContext<{ depth: number; top: boolean }>({ depth: 0, top: true })
export const useView = () => useContext(ViewContext)

/** A round glass button in the bar. */
export function BarButton({ label, onClick, children, badge }: { label: string; onClick: () => void; children: ReactNode; badge?: ReactNode }) {
  return (
    <button type="button" className="ph-bar-button" aria-label={label} data-badge={badge ? '' : undefined} onClick={onClick}>
      {children}
      {badge ? <span className="ph-bar-button__badge">{badge}</span> : null}
    </button>
  )
}

/** The bar's leading button: home from an app's first page, back from any other. */
function Leading({ badge, backLabel }: { badge?: ReactNode; backLabel?: string }) {
  const { depth } = useView()
  if (depth === 0)
    return (
      <BarButton label="Home Screen" onClick={goHome}>
        <LayoutGrid size={19} strokeWidth={2} aria-hidden />
      </BarButton>
    )
  return (
    <BarButton label={backLabel ?? 'Back'} onClick={goBack} badge={badge}>
      <ChevronLeft size={24} strokeWidth={2.2} aria-hidden />
    </BarButton>
  )
}

export interface PageProps {
  /** The page's name: large at the top of the content, and in the bar once that has scrolled away. */
  title?: string
  /** Shows the title large, in the content. */
  large?: boolean
  /** In the bar's middle, in place of the title: a conversation's face and name. */
  center?: ReactNode
  trailing?: ReactNode
  /** A count beside the back button, as Messages shows unread conversations. */
  badge?: ReactNode
  backLabel?: string
  /** plain: white. grouped: the gray that grouped lists sit on. dark: a terminal. */
  tone?: 'plain' | 'grouped' | 'dark'
  /** The content manages its own scrolling (a conversation): the page doesn't scroll. */
  fixed?: boolean
  className?: string
  children: ReactNode
}

/** One screen of an app. */
export function Page({ title, large, center, trailing, badge, backLabel, tone = 'plain', fixed, className, children }: PageProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [scrolled, setScrolled] = useState(false)

  // The large title has gone under the bar: the bar takes the title
  useEffect(() => {
    const root = scroller.current
    const el = heading.current
    if (!root || !el || !large) return
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry!.isIntersecting), { root, rootMargin: '-52px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [large])

  return (
    <div className={`ph-page${className ? ` ${className}` : ''}`} data-tone={tone} data-fixed={fixed || undefined}>
      <header className="ph-nav" data-scrolled={scrolled || !large || undefined} data-center={center ? '' : undefined}>
        <div className="ph-nav__side">
          <Leading badge={badge} backLabel={backLabel} />
        </div>
        <div className="ph-nav__middle">{center ?? (title ? <span className="ph-nav__title">{title}</span> : null)}</div>
        <div className="ph-nav__side ph-nav__side--end">{trailing}</div>
      </header>
      <div ref={scroller} className="ph-page__content" tabIndex={fixed ? undefined : -1}>
        {large && title && (
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

/** A sheet over the page under it: a grabber, a close button, and what it holds. */
export function Sheet({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ph-sheet" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" className="ph-sheet__backdrop" aria-label="Close" onClick={goBack} tabIndex={-1} />
      <div className="ph-sheet__panel">
        <span className="ph-sheet__grabber" aria-hidden />
        <button type="button" className="ph-sheet__close" aria-label="Close" onClick={goBack}>
          <X size={16} strokeWidth={2.6} aria-hidden />
        </button>
        {children}
      </div>
    </div>
  )
}
