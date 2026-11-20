import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref } from 'react'
import { Check, ChevronLeft, ChevronRight, Mic, Search, X } from 'lucide-react'
import { Popover } from '../kit/motion/Popover'
import { focusFirst, focusLost, holdFocus, useReturnFocus } from '../os/focus'
import { createStore, useStore } from '../os/store'
import { COLOR, setTone, sheeted, type Ground } from './chrome'
import { closeSheet, pop, sys, type PhoneApp } from './system'

// The parts every app on the phone is built from, drawn the way the current
// iOS draws them: a screen with its floating glass buttons and a large title
// that folds into the bar, a stack of such screens that push and pop, grouped
// lists, the bars that float at the foot of a screen (search, tabs), sheets
// and menus. Sizes are iOS points; inside the phone a point is a pixel.

// ---- Where a part is ----

/** The app a part belongs to, and whether that app is the one in front. */
export const AppContext = createContext<{ app: PhoneApp; active: boolean }>({ app: 'messages', active: true })
export const useApp = () => useContext(AppContext)

/** How deep in its app a screen is: 0 for the first. */
const DepthContext = createContext(0)

/** Whether a screen is the one on top of its app's stack. */
const TopContext = createContext(true)

/** The id the heading of a page takes. The page is named by that heading, so that arriving on it (it
 * takes the keyboard when it comes to the top) says where one is. */
const PageHeadingContext = createContext<string | undefined>(undefined)

/** For a screen that draws its heading in the page itself (`ownHeading`): the id to give that heading. */
export const usePageHeadingId = () => useContext(PageHeadingContext)

/** How many things each app has up over its screens: a sheet, an alert of its own. What is behind one is
 * shut off while it is up: it is a dialog, and the keyboard and a screen reader stay in it. */
const covers = createStore<Partial<Record<PhoneApp, number>>>({})
const cover = (app: PhoneApp, by: 1 | -1) => covers.set((up) => ({ ...up, [app]: Math.max(0, (up[app] ?? 0) + by) }))

/** For something of an app's own that goes over its screens as a sheet does (an alert, a prompt): while
 * `up`, the app's screens are shut off behind it, as they are behind a sheet, and come back when it has
 * gone. Draw the thing itself beside the app's `NavStack` (where its `SheetHost` is), not inside a
 * screen: a screen that is shut off takes everything in it with it. */
export function useCovering(up: boolean) {
  const { app } = useApp()
  useLayoutEffect(() => {
    if (!up) return
    cover(app, 1)
    return () => cover(app, -1)
  }, [app, up])
}

/** How much the phone is scaled on the page: 1 on a real phone, less where it
 * is drawn inside a frame. Anything that turns a finger's movement into a
 * distance on the screen divides by it. */
export const scaleOf = (el: Element | null) => {
  const node = el as HTMLElement | null
  return node && node.offsetWidth ? node.getBoundingClientRect().width / node.offsetWidth || 1 : 1
}

// ---- Glass buttons ----

export interface GlassButtonProps {
  /** What it does, for assistive tech (and all it says, when it is only an icon). */
  label: string
  onClick?: () => void
  /** Words beside or instead of the icon make it a capsule. */
  wide?: boolean
  /** Blue ink: the screen's own action. */
  tint?: boolean
  /** A filled blue button: the one that finishes the task. */
  prominent?: boolean
  disabled?: boolean
  pressed?: boolean
  className?: string
  children: ReactNode
}

/** The round glass button iOS floats over a screen: Back, Compose, More. */
export function GlassButton({ label, onClick, wide, tint, prominent, disabled, pressed, className, children }: GlassButtonProps) {
  return (
    <button type="button" className={`ios-glass ios-button${className ? ` ${className}` : ''}`} data-wide={wide || undefined} data-tint={tint || undefined} data-prominent={prominent || undefined} aria-label={label} aria-pressed={pressed} aria-disabled={disabled || undefined} onClick={disabled ? undefined : onClick}>
      {children}
    </button>
  )
}

/** Two or three buttons sharing one piece of glass. */
export function GlassGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="ios-glass ios-group" role="group" aria-label={label}>
      {children}
    </span>
  )
}

export function GroupButton({ label, onClick, tint, disabled, children }: { label: string; onClick?: () => void; tint?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" className="ios-group__part" data-tint={tint || undefined} aria-label={label} aria-disabled={disabled || undefined} onClick={disabled ? undefined : onClick}>
      {children}
    </button>
  )
}

/** Back a screen: the chevron in its glass circle. */
export function BackButton({ onClick, label = 'Back' }: { onClick?: () => void; label?: string }) {
  return (
    <GlassButton label={label} onClick={onClick ?? pop}>
      <ChevronLeft size={31} strokeWidth={2} aria-hidden style={{ marginLeft: -2.5 }} />
    </GlassButton>
  )
}

// ---- Signs ----

// Two signs that iOS draws its own way and that every app here uses: drawn here, in the line the
// other icons are in, so that they are the same wherever they appear.

/** Passing something on: an arrow rising out of a box. */
export function ShareGlyph({ size = 25, strokeWidth = 1.9 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ marginTop: -2 }}>
      <path d="M8.4 9.2H7.5a3.2 3.2 0 0 0-3.2 3.2v6a3.2 3.2 0 0 0 3.2 3.2h9a3.2 3.2 0 0 0 3.2-3.2v-6a3.2 3.2 0 0 0-3.2-3.2h-.9" />
      <path d="M12 14.6V2.5M8.3 6.1 12 2.4l3.7 3.7" />
    </svg>
  )
}

/** Writing something new: a pencil across the corner of a sheet. */
export function ComposeGlyph({ size = 25, strokeWidth = 1.9 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11.6 4.4H7.4A3.8 3.8 0 0 0 3.6 8.2v8.6a3.8 3.8 0 0 0 3.8 3.8h8.6a3.8 3.8 0 0 0 3.8-3.8v-4.2" />
      <path d="m10 14.2.8-3.3 9.4-9.4a1.4 1.4 0 0 1 2.4 1 1.4 1.4 0 0 1-.4 1l-9.4 9.4z" />
    </svg>
  )
}

// ---- A screen ----

export interface ScreenProps {
  /** Its name: the large title, and what the bar says once that has scrolled away. */
  title: string
  /** A large title at the top of the page that folds into the bar as the page scrolls. */
  large?: boolean
  /** A quiet line under the title, large or in the bar: a count ("7 Notes"), when it was last brought up to date. */
  subtitle?: ReactNode
  /** Drawn in the middle of the bar in place of the title (a conversation's avatar and name). */
  center?: ReactNode
  /** In the bar's leading corner in place of Back. `null` leaves it empty. */
  leading?: ReactNode
  /** The bar's trailing corner: glass buttons. */
  trailing?: ReactNode
  /** Under the large title, scrolling with the page: a count, a segmented control. */
  header?: ReactNode
  /** Floating at the foot of the screen: a search field, a tab bar, a toolbar. */
  foot?: ReactNode
  /** Down the screen's trailing edge, over the page and between its bars: an index to slide a finger along. */
  edge?: ReactNode
  /** plain: white. grouped: the gray that inset lists sit on. dark: black, with light ink. */
  tone?: 'plain' | 'grouped' | 'dark'
  /** A colour of the screen's own, in place of its tone's (a contact's card takes its picture's): the page is
   * drawn in it (`--page`), and the browser's bars are given it. Two colours for a page that runs from one
   * at its top into another at its foot; the page is drawn in the foot's. */
  ground?: Ground
  /** What is under the status bar is a picture, dark or pale, whatever the screen's own tone: the status
   * bar's ink is chosen for that (white over a dark one). The screen itself keeps its tone. */
  under?: 'dark' | 'pale'
  /** The screen lays out and scrolls its own contents (a conversation, a terminal). */
  fixed?: boolean
  /** The page draws its own heading (a card, a face, with `usePageHeadingId` for its id): the screen adds none. */
  ownHeading?: boolean
  /** The page is there to be read and has nothing in it to press (a question's answer): the page itself
   * takes the keyboard, so that the arrows, Space and Page Down scroll it. */
  readable?: boolean
  className?: string
  scrollRef?: Ref<HTMLDivElement>
  children: ReactNode
}

/** One screen of an app. The bar's buttons float over the page; under them the
 * page fades and blurs as it scrolls past, as iOS's scroll edge does. */
export function Screen({ title, large, subtitle, center, leading, trailing, header, foot, edge, tone = 'plain', ground, under, fixed, ownHeading, readable, className, scrollRef, children }: ScreenProps) {
  const depth = useContext(DepthContext)
  const top = useContext(TopContext)
  const headingId = useContext(PageHeadingContext)
  const { app } = useApp()
  // Every screen has one heading, its name: the large title where there is one, otherwise the name in the
  // bar; where the bar holds something else (a face, a button), a heading that is only read out
  const big = large && !fixed
  const scroller = useRef<HTMLDivElement | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [folded, setFolded] = useState(false)

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    setScrolled(el.scrollTop > 2)
    const h = heading.current
    // Folded once the large title has gone up under the bar
    if (h) setFolded(el.scrollTop > h.offsetTop + h.offsetHeight - 58)
  }

  // The status bar over this screen takes its ink from it, and the browser's bars its colour
  const groundTop = typeof ground === 'object' ? ground.top : ground
  const groundFoot = typeof ground === 'object' ? ground.foot : ground
  // (a screen with a picture under the status bar says which ink reads over the picture)
  const over = under === 'dark' ? 'dark' : under === 'pale' ? 'plain' : undefined
  useEffect(() => {
    if (top) setTone(app, tone, groundTop && groundFoot ? (groundTop === groundFoot ? groundTop : { top: groundTop, foot: groundFoot }) : undefined, over)
  }, [top, app, tone, over, groundTop, groundFoot])

  const setScroller = (el: HTMLDivElement | null) => {
    scroller.current = el
    if (typeof scrollRef === 'function') scrollRef(el)
    else if (scrollRef) (scrollRef as { current: HTMLDivElement | null }).current = el
  }

  return (
    <div className={`ios-screen${className ? ` ${className}` : ''}`} data-tone={tone} data-ground={groundFoot ? '' : undefined} data-scrolled={scrolled || undefined} data-folded={folded || !large || undefined} data-foot={foot ? '' : undefined} style={groundFoot ? ({ '--page': groundFoot, '--page-top': groundTop } as CSSProperties) : undefined}>
      {/* Without a large title the heading comes first, read and not seen (what the bar shows of it is for the
          eye, further on): a page's headings then run in order, its own before any that part its rows */}
      {!big && !ownHeading && (
        <>
          <h2 id={headingId} className="sr-only" dir="auto">
            {title}
          </h2>
          {subtitle && center === undefined && <p className="sr-only">{subtitle}</p>}
        </>
      )}
      {fixed ? (
        <div className="ios-screen__body">{children}</div>
      ) : (
        <div ref={setScroller} className="ios-screen__scroll" data-scroller onScroll={onScroll} {...(readable ? { tabIndex: 0, role: 'group', 'aria-labelledby': headingId } : null)}>
          {large && (
            <h2 ref={heading} id={headingId} className="ios-large" dir="auto">
              {title}
            </h2>
          )}
          {large && subtitle && <p className="ios-large-sub">{subtitle}</p>}
          {header}
          {children}
        </div>
      )}
      {/* Not a <header>: that would make every screen's bar a banner for the whole page, which has one of its own */}
      <div className="ios-bar">
        <div className="ios-bar__edge" aria-hidden />
        <div className="ios-bar__side">{leading !== undefined ? leading : depth > 0 && <BackButton />}</div>
        {/* The bar's own name is for the eye: the screen's heading (its large title, or the one that is only read) says it once */}
        <div className="ios-bar__title" aria-hidden={center === undefined ? true : undefined}>
          {center ?? (
            <span className="ios-bar__name">
              <span className="ios-bar__heading" dir="auto">
                {title}
              </span>
              {subtitle && <span className="ios-bar__sub">{subtitle}</span>}
            </span>
          )}
        </div>
        <div className="ios-bar__side ios-bar__side--end">{trailing}</div>
      </div>
      {edge && <div className="ios-edge">{edge}</div>}
      {foot && (
        <div className="ios-foot">
          <div className="ios-foot__edge" aria-hidden />
          {foot}
        </div>
      )}
    </div>
  )
}

// ---- A stack of screens ----

interface Gone {
  view: string
  depth: number
}

/** An app's screens, one on top of another: a new one slides in from the
 * right over the last, and goes back out that way. `children` draws the screen
 * for a view (null is the app's first screen). The stack itself is the app's
 * in `sys`: `push`, `pop`. */
export function NavStack({ children }: { children: (view: string | null, depth: number) => ReactNode }) {
  const { app, active } = useApp()
  const theirs = useStore(sys, (s) => s.stacks[app])
  const front = useStore(sys, (s) => s.app === app)
  const moves = useStore(sys, (s) => s.motion)
  const [seen, setSeen] = useState<{ stack: string[]; gone: Gone[] }>({ stack: theirs, gone: [] })
  // An app that is put away as its screens change (backed out of, to the folder it was opened from) leaves
  // as it was: the screen it was on goes with it into what it came out of, and its screens are changed once
  // it has gone, with nothing to be seen moving
  const [held, setHeld] = useState<string[] | null>(null)
  const late = useRef(false)
  const holding = !held && !late.current && seen.stack !== theirs && !front && moves
  if (holding) setHeld(seen.stack)
  const stack = holding ? seen.stack : (held ?? theirs)
  const motion = moves && !late.current
  useEffect(() => {
    if (!held) return
    const release = () => {
      late.current = true
      setHeld(null)
    }
    // (Brought back to the front before it had gone: at once)
    if (front) return release()
    const t = setTimeout(release, 470)
    return () => clearTimeout(t)
  }, [held, front])
  useEffect(() => {
    if (!held) late.current = false
  })
  // Screens that are there when the app first draws are simply there
  const first = useRef(true)
  const fresh = useRef(new Set<string>())
  const nav = useRef<HTMLDivElement>(null)
  // A sheet (or an alert of the app's own) is up over the app: the screen behind it is shut off until it has gone
  const covered = useStore(covers, (up) => (up[app] ?? 0) > 0)
  /** What had the keyboard on each screen when another was pushed over it, by the screen's depth. */
  const openers = useRef(new Map<number, HTMLElement>())
  /** How deep the stack was when the keyboard was last placed. */
  const depthWas = useRef(stack.length)

  if (seen.stack !== stack) {
    let kept = 0
    while (kept < seen.stack.length && kept < stack.length && seen.stack[kept] === stack[kept]) kept++
    // The row or button that pushes a screen has the keyboard as it does (it is read here, before the
    // screen it is on is shut off): going back puts the keyboard on it again
    // (a screen that is put on from outside the app, by search or a link, was pushed by nothing here:
    // whatever pushed one at that depth before is forgotten, or Back would go looking for it)
    const pressed = document.activeElement
    if (stack.length > seen.stack.length) {
      if (pressed instanceof HTMLElement && nav.current?.contains(pressed)) openers.current.set(seen.stack.length, pressed)
      else openers.current.delete(seen.stack.length)
    }
    for (const depth of [...openers.current.keys()]) if (depth > stack.length) openers.current.delete(depth)
    // The screen on top when the stack got shorter stays drawn until it has slid away
    const gone = motion && seen.stack.length > kept ? [{ view: seen.stack[seen.stack.length - 1]!, depth: seen.stack.length }] : []
    for (let i = kept; i < stack.length; i++) if (motion) fresh.current.add(`${i}:${stack[i]}`)
    setSeen({ stack, gone })
  }

  // A screen that has just come to the top takes the keyboard, so that keys
  // and a screen reader carry on from it and not from the screen it covered.
  // Not when something on it has taken the keyboard already (a field that
  // opens ready to type), and not for the screens an app first draws with.
  // Back on a screen that pushed another, the keyboard returns to what pushed it.
  useEffect(() => {
    const back = stack.length < depthWas.current
    depthWas.current = stack.length
    if (first.current || !active) return
    const page = nav.current?.querySelector<HTMLElement>(':scope > .ios-page[data-pos="top"]')
    if (!page || page.contains(document.activeElement)) return
    const opener = back ? openers.current.get(stack.length) : undefined
    if (!(opener && page.contains(opener) && focusFirst(opener))) page.focus({ preventScroll: true })
  }, [stack, active])

  useEffect(() => {
    first.current = false
  }, [])

  // While its screens slide, the stack says so: what is costly to draw on a moving screen (glass, which
  // has to blur what is behind it afresh at every frame) is drawn plainly until they have landed (ios.css)
  const depth = stack.length
  useLayoutEffect(() => {
    const el = nav.current
    if (first.current || !el || !motion) return
    el.setAttribute('data-sliding', '')
    const t = setTimeout(() => el.removeAttribute('data-sliding'), 560)
    return () => clearTimeout(t)
  }, [depth]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!seen.gone.length) return
    const t = setTimeout(() => setSeen((s) => (s.gone.length ? { ...s, gone: [] } : s)), 400)
    return () => clearTimeout(t)
  }, [seen.gone])

  const top = stack.length
  const page = (view: string | null, depth: number, pos: 'top' | 'under' | 'gone') => {
    const key = depth === 0 ? 'root' : `${depth - 1}:${view}`
    const enter = depth > 0 && !first.current && fresh.current.has(key)
    const live = pos === 'top' && active && !covered
    // The page is named by its screen's heading: taking the keyboard as it arrives, it says where one is
    const headingId = `${app}-screen-${key.replace(/[^\w-]/g, '_')}`
    return (
      <div key={key} className="ios-page" role="group" aria-labelledby={headingId} tabIndex={-1} data-pos={pos} data-enter={enter || undefined} data-depth={depth} {...(live ? null : ({ inert: '' } as object))} aria-hidden={pos === 'top' && !covered ? undefined : true} onAnimationEnd={(e) => e.target === e.currentTarget && fresh.current.delete(key)}>
        <DepthContext.Provider value={depth}>
          <TopContext.Provider value={pos === 'top'}>
            <PageHeadingContext.Provider value={headingId}>{children(view, depth)}</PageHeadingContext.Provider>
          </TopContext.Provider>
        </DepthContext.Provider>
      </div>
    )
  }

  // One list, so a screen that is leaving is the same screen it was (its place on the page, what it had scrolled to), not a new one
  return (
    <div ref={nav} className="ios-nav" data-snap={!motion || undefined}>
      {[
        page(null, 0, top === 0 ? 'top' : 'under'),
        ...stack.map((view, i) => page(view, i + 1, i + 1 === top ? 'top' : 'under')),
        ...seen.gone.filter((g) => g.depth > top).map((g) => page(g.view, g.depth, 'gone')),
      ]}
    </div>
  )
}

// ---- Lists ----

/** A page of grouped rows: a contact card, a folder's details. */
export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`ios-list${className ? ` ${className}` : ''}`}>{children}</div>
}

export function Section({ header, footer, children, plain }: { header?: ReactNode; footer?: ReactNode; children: ReactNode; plain?: boolean }) {
  return (
    <section className="ios-section" data-plain={plain || undefined}>
      {header && <h3 className="ios-section__header">{header}</h3>}
      <div className="ios-section__rows">{children}</div>
      {footer && <p className="ios-section__footer">{footer}</p>}
    </section>
  )
}

export interface CellProps {
  /** At the leading edge: an icon tile, an avatar, a thumbnail. */
  lead?: ReactNode
  title: ReactNode
  /** A second, quieter line under the title. */
  subtitle?: ReactNode
  /** At the trailing edge, in gray: a value, a count. */
  value?: ReactNode
  /** A chevron at the trailing edge: the row goes somewhere. */
  chevron?: boolean
  /** Blue: the row is an action. */
  tint?: boolean
  /** Red: the row destroys something. */
  destructive?: boolean
  onClick?: () => void
  /** A link out of the site. */
  href?: string
  disabled?: boolean
  /** In place of the value and chevron: a switch, a button. */
  trailing?: ReactNode
  label?: string
  className?: string
}

/** One row of a grouped list. */
export function Cell({ lead, title, subtitle, value, chevron, tint, destructive, onClick, href, disabled, trailing, label, className }: CellProps) {
  const body = (
    <>
      {lead && <span className="ios-cell__lead">{lead}</span>}
      <span className="ios-cell__text">
        <span className="ios-cell__title" dir="auto">
          {title}
        </span>
        {subtitle && (
          <span className="ios-cell__subtitle" dir="auto">
            {subtitle}
          </span>
        )}
      </span>
      {value !== undefined && <span className="ios-cell__value">{value}</span>}
      {trailing}
      {chevron && <ChevronRight className="ios-cell__chevron" size={17} strokeWidth={2.6} aria-hidden />}
    </>
  )
  const shared = { className: `ios-cell${className ? ` ${className}` : ''}`, 'data-tint': tint || undefined, 'data-destructive': destructive || undefined, 'data-lead': lead ? '' : undefined, 'aria-label': label }
  if (href) {
    // A link out of the site opens beside it. One that hands over to another app (mail, messages) just goes
    const away = /^https?:/i.test(href)
    return (
      <a {...shared} href={href} {...(away ? { target: '_blank', rel: 'noreferrer' } : null)}>
        {body}
      </a>
    )
  }
  if (onClick)
    return (
      <button type="button" {...shared} aria-disabled={disabled || undefined} onClick={disabled ? undefined : onClick}>
        {body}
      </button>
    )
  return <div {...shared}>{body}</div>
}

/** The iOS switch: wider than tall, green when on. */
export function Switch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" className="ios-switch" role="switch" aria-checked={on} aria-label={label} aria-disabled={disabled || undefined} onClick={() => !disabled && onChange(!on)}>
      <span className="ios-switch__knob" />
    </button>
  )
}

// ---- What floats at the foot of a screen ----

/** The search field iOS floats at the foot of a list: a glass capsule. Give it
 * the page's own filter; typing filters as it goes. */
export function SearchBar({ value, onChange, placeholder = 'Search', label, onFocus, onBlur }: { value: string; onChange: (value: string) => void; placeholder?: string; label: string; onFocus?: () => void; onBlur?: () => void }) {
  const field = useRef<HTMLInputElement>(null)
  return (
    <label className="ios-glass ios-search" data-filled={value ? '' : undefined}>
      <Search size={19} strokeWidth={2.4} className="ios-search__glass" aria-hidden />
      <input
        ref={field}
        className="ios-search__input"
        type="text"
        dir="auto"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder={placeholder}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(e) => {
          // Escape means one thing in every app's search: first it clears what was typed, then it lets go
          // of the field; after that it is the phone's own (Back, Home), which is not heard here
          if (e.key !== 'Escape') return
          e.preventDefault()
          e.stopPropagation()
          if (value) onChange('')
          else e.currentTarget.blur()
        }}
      />
      {value ? (
        // Clearing leaves the caret where it was, in the field: the press does not take the keyboard from it
        // (the button goes as it is pressed, and a phone would put its keyboard away), and a key press hands it back
        <button
          type="button"
          className="ios-search__clear"
          aria-label="Clear search"
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange('')
            field.current?.focus({ preventScroll: true })
          }}
        >
          <X size={11} strokeWidth={3.2} aria-hidden />
        </button>
      ) : (
        <Mic size={21} strokeWidth={2} className="ios-search__mic" aria-hidden />
      )}
    </label>
  )
}

// ---- Menus ----

export interface MenuItem {
  label: string
  icon?: ReactNode
  /** A tick beside it: the choice that is on. */
  checked?: boolean
  /** It is switched on and off by itself, where a ticked item is otherwise one choice out of several. */
  toggle?: boolean
  destructive?: boolean
  disabled?: boolean
  /** A rule above it: the start of another group. */
  divided?: boolean
  onSelect: () => void
}

/** A glass button that opens a menu under itself, as iOS's pull-down menus do.
 * `part` makes the button one of a `GlassGroup`'s, sharing that group's glass.
 * `rise` is for a button at the foot of a screen: its menu opens upward out of it. */
export function Menu({ label, items, children, tint, wide, part, rise }: { label: string; items: MenuItem[]; children: ReactNode; tint?: boolean; wide?: boolean; part?: boolean; rise?: boolean }) {
  const [open, setOpen] = useState(false)
  // Up: open, or still fading away. Its bar stays over the rest of the screen for as long
  const [up, setUp] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  /** Where the keyboard goes when the menu opens: set when a key opened it, null when a finger did. */
  const enter = useRef<'first' | 'last' | null>(null)
  const entries = () => [...(root.current?.querySelectorAll<HTMLElement>('.ios-menu__item') ?? [])]

  useEffect(() => {
    if (open) return setUp(true)
    const t = setTimeout(() => setUp(false), 320)
    return () => clearTimeout(t)
  }, [open])

  // Closed, the keyboard goes back to the button the menu hangs from (unless choosing something moved it on)
  useReturnFocus(open, () => button.current)

  // Opened from the keyboard, the menu takes it: on its first row, or its last for an arrow up
  useEffect(() => {
    if (!open || !enter.current) return
    const list = entries()
    ;(enter.current === 'first' ? list[0] : list[list.length - 1])?.focus({ preventScroll: true })
    enter.current = null
  }, [open])

  const show = (at: 'first' | 'last') => {
    enter.current = at
    if (open) {
      // Already open (a finger opened it, then a key): the keyboard goes in now
      const list = entries()
      ;(at === 'first' ? list[0] : list[list.length - 1])?.focus({ preventScroll: true })
      enter.current = null
    } else setOpen(true)
  }

  /** On the button: the arrows open the menu and go into it. */
  const onButtonKey = (e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    show(e.key === 'ArrowDown' ? 'first' : 'last')
  }

  /** In the menu: the arrows, Home and End move along its rows, as they do in the menu bar's menus. */
  const onMenuKey = (e: ReactKeyboardEvent) => {
    const list = entries()
    const at = list.indexOf(document.activeElement as HTMLElement)
    const go = (to: number) => {
      e.preventDefault()
      list[(to + list.length) % list.length]?.focus({ preventScroll: true })
    }
    if (e.key === 'ArrowDown') go(at + 1)
    else if (e.key === 'ArrowUp') go(at < 0 ? list.length - 1 : at - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(list.length - 1)
    else if (e.key === 'Tab') setOpen(false)
  }
  // A column for ticks only where something can be ticked, and one for glyphs only where something has one
  const ticks = items.some((item) => item.checked !== undefined)
  const glyphs = items.some((item) => item.icon)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (root.current?.contains(e.target as Node)) return
      setOpen(false)
      // The press that puts the menu away does only that: it doesn't also press what was under it
      const swallow = (click: MouseEvent) => {
        click.stopPropagation()
        click.preventDefault()
      }
      document.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => document.removeEventListener('click', swallow, true), 500)
    }
    // Escape puts the menu away and does nothing else: it is heard first, and goes no further
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('pointerdown', away, true)
    window.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('pointerdown', away, true)
      window.removeEventListener('keydown', key, true)
    }
  }, [open])
  return (
    <span ref={root} className="ios-menu" data-up={up || open || undefined} data-rise={rise || undefined}>
      <button
        ref={button}
        type="button"
        className={part ? 'ios-group__part' : 'ios-glass ios-button'}
        data-wide={wide || undefined}
        data-tint={tint || undefined}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onKeyDown={onButtonKey}
        onClick={(e: ReactMouseEvent) => {
          // A click with no pointer behind it is Enter or Space: the keyboard opened the menu, and goes into it
          if (!open && e.detail === 0) enter.current = 'first'
          setOpen((o) => !o)
        }}
      >
        {children}
      </button>
      <Popover show={open} origin={rise ? 'bottom left' : 'top right'} className="ios-menu__list" role="menu" aria-label={label} onKeyDown={onMenuKey} {...(open ? null : ({ inert: '' } as object))}>
        {/* The rows scroll inside the menu where a screen is too short for all of them (a phone on its side) */}
        <div className="ios-menu__scroll" role="presentation">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className="ios-menu__item"
              role={item.checked === undefined ? 'menuitem' : item.toggle ? 'menuitemcheckbox' : 'menuitemradio'}
              aria-checked={item.checked}
              aria-disabled={item.disabled || undefined}
              data-destructive={item.destructive || undefined}
              data-divided={item.divided || undefined}
              onClick={() => {
                if (item.disabled) return
                setOpen(false)
                item.onSelect()
              }}
            >
              {ticks && <span className="ios-menu__tick">{item.checked && <Check size={16} strokeWidth={2.8} aria-hidden />}</span>}
              {/* The glyph comes before the words, as the current iOS has its menus */}
              {glyphs && (
                <span className="ios-menu__icon" aria-hidden>
                  {item.icon}
                </span>
              )}
              <span className="ios-menu__label">{item.label}</span>
            </button>
          ))}
        </div>
      </Popover>
    </span>
  )
}

// ---- Sheets ----

const SheetContext = createContext(false)

/** Draws the app's sheet while one is up, and for as long as it takes to go
 * away. `children` draws the sheet for a name (`sys.sheet`, opened with
 * `openSheet`); return a `Sheet`. Put one of these in the app, after its stack. */
export function SheetHost({ children }: { children: (name: string) => ReactNode }) {
  const { app } = useApp()
  const name = useStore(sys, (s) => (s.app === app ? s.sheet : null))
  const motion = useStore(sys, (s) => s.motion)
  // `turn` counts the times a sheet has been brought back while it was still on its way out. It is the
  // sheet's key, so that one comes up new (its own state as at first, its field taking the keyboard
  // again) and is not the departing one turned round with what it held
  const [shown, setShown] = useState<{ name: string; closing: boolean; turn: number } | null>(name ? { name, closing: false, turn: 0 } : null)
  if (name && (!shown || shown.name !== name || shown.closing)) setShown({ name, closing: false, turn: shown ? shown.turn + (shown.closing ? 1 : 0) : 0 })
  else if (!name && shown && !shown.closing) setShown(motion ? { ...shown, closing: true } : null)
  useEffect(() => {
    if (!shown?.closing) return
    const t = setTimeout(() => setShown((s) => (s?.closing ? null : s)), 340)
    return () => clearTimeout(t)
  }, [shown])
  if (!shown) return null
  return (
    <SheetContext.Provider key={shown.turn} value={shown.closing}>
      {children(shown.name)}
    </SheetContext.Provider>
  )
}

/** How far a sheet must be dragged, or how fast flicked, to go. */
const AWAY = { distance: 110, speed: 0.55 }

export interface SheetProps {
  /** Its name, for assistive tech. */
  label: string
  /** In the middle of its bar. */
  title?: ReactNode
  /** large: nearly the whole screen. medium: about half of it, floating clear of the edges. */
  detent?: 'large' | 'medium'
  /** The bar's leading corner. */
  leading?: ReactNode
  /** The bar's trailing corner, in place of the close button. */
  trailing?: ReactNode
  tone?: 'plain' | 'grouped'
  className?: string
  children: ReactNode
}

/** A sheet over the app: a grabber to drag it away by, a close button, and what it holds. */
export function Sheet({ label, title, detent = 'large', leading, trailing, tone = 'grouped', className, children }: SheetProps) {
  const closing = useContext(SheetContext)
  const motion = useStore(sys, (s) => s.motion)
  const sheet = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const shade = useRef<HTMLDivElement>(null)
  /** Gives the keyboard back to what had it when the sheet came up. */
  const giveBack = useRef<ReturnType<typeof holdFocus> | null>(null)
  /** What the sheet is drawn in: its app, where the screen it covers is too. */
  const host = useRef<HTMLElement | null>(null)
  const drag = useRef<{ y: number; t: number; dy: number; v: number; k: number } | null>(null)

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

  /** Takes hold of the sheet where a finger (or the mouse) is. */
  const hold = (y: number, at: number) => {
    drag.current = { y, t: at, dy: 0, v: 0, k: scaleOf(panel.current) }
  }

  /** The sheet follows the finger down. */
  const follow = (y: number, at: number) => {
    const d = drag.current
    if (!d) return
    const dy = Math.max(0, (y - d.y) / d.k)
    const dt = Math.max(1, at - d.t)
    // The speed of the last stretch of the drag, eased so one jumpy sample doesn't decide it
    d.v = d.v * 0.6 + ((dy - d.dy) / dt) * 0.4
    d.dy = dy
    d.t = at
    place(dy, true)
  }

  const down = (e: ReactPointerEvent) => {
    if (closing || (e.target as HTMLElement).closest('button, a, input')) return
    hold(e.clientY, e.timeStamp)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const move = (e: ReactPointerEvent) => follow(e.clientY, e.timeStamp)

  const up = (e: { timeStamp: number }) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const el = panel.current
    // A finger that came to rest before letting go wasn't flicking
    const speed = e.timeStamp - d.t > 90 ? 0 : d.v
    if (el && (d.dy > AWAY.distance || (d.dy > 24 && speed > AWAY.speed))) {
      // Let go far enough, or fast enough: it carries on down and is gone
      el.style.transition = 'transform 0.26s cubic-bezier(0.4, 0, 0.9, 0.6)'
      el.style.transform = 'translateY(115%)'
      if (shade.current) {
        shade.current.style.transition = 'opacity 0.26s ease'
        shade.current.style.opacity = '0'
      }
      setTimeout(() => closeSheet(false), 250)
    } else place(0, false)
  }

  // A finger pulls the sheet away by what it holds, too, once that is at its top: most people never aim
  // for the bar. Anywhere further down its contents a pull is a scroll back up, and a pull that starts
  // on a field is left to the field. (Touch events, and not passive ones: the pull has to be taken
  // from the page before the browser makes a scroll of it.)
  const holding = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = holding.current
    if (!el || closing) return
    let from: { x: number; y: number } | null = null
    let pulling = false
    const start = (e: TouchEvent) => {
      pulling = false
      const finger = e.touches[0]
      from = e.touches.length === 1 && finger && el.scrollTop <= 0 && !(e.target as HTMLElement).closest('input, textarea, [contenteditable="true"]') ? { x: finger.clientX, y: finger.clientY } : null
    }
    const pull = (e: TouchEvent) => {
      const finger = e.touches[0]
      if (!from || !finger) return
      if (!pulling) {
        const dx = finger.clientX - from.x
        const dy = finger.clientY - from.y
        // Up, or sideways: not this
        if (dy < -4 || Math.abs(dx) > Math.max(8, Math.abs(dy))) return void (from = null)
        if (dy < 6) return
        pulling = true
        hold(from.y, e.timeStamp)
      }
      if (e.cancelable) e.preventDefault()
      follow(finger.clientY, e.timeStamp)
    }
    const end = (e: TouchEvent) => {
      if (pulling) up(e)
      from = null
      pulling = false
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', pull, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', pull)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
    }
  }, [closing]) // eslint-disable-line react-hooks/exhaustive-deps

  // While it is up the top edge of the screen is the app under its shade, and (for a sheet that runs to
  // the foot of the screen) the foot is the sheet's own ground: a real phone's browser paints its bars to match
  useLayoutEffect(() => {
    if (closing) return
    const half = detent === 'medium'
    sheeted.set({ shade: half ? 0.12 : 0.26, foot: half ? null : COLOR[tone] })
    return () => sheeted.set({ shade: 0, foot: null })
  }, [closing, detent, tone])

  // Escape closes it, as it closes any dialog
  useEffect(() => {
    if (closing) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [closing])

  // The keyboard goes to the sheet when it arrives, and back to what opened it when it goes: the row or
  // button if that can still take it, otherwise the screen the sheet was over. (It is asked a frame
  // later, once that screen is no longer shut off.)
  const returnFocus = () => {
    const give = giveBack.current
    requestAnimationFrame(() => {
      if (focusLost()) give?.(host.current?.querySelector<HTMLElement>('.ios-nav > .ios-page[data-pos="top"]'))
    })
  }
  useLayoutEffect(() => {
    // Once: drawn a second time by React's checks, the keyboard would already be on the sheet itself
    giveBack.current ??= holdFocus()
    host.current = sheet.current?.parentElement ?? null
    panel.current?.focus({ preventScroll: true })
    return returnFocus
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (closing) returnFocus()
  }, [closing]) // eslint-disable-line react-hooks/exhaustive-deps

  // While it is up, the screen behind it is shut off (see NavStack). On its way out it no longer is
  useCovering(!closing)

  return (
    <div ref={sheet} className={`ios-sheet${className ? ` ${className}` : ''}`} data-detent={detent} data-tone={tone} data-closing={closing || undefined} data-snap={!motion || undefined} role="dialog" aria-modal="true" aria-label={label} {...(closing ? ({ inert: '' } as object) : null)}>
      {/* A press beside the sheet closes it. For a finger or a mouse only: the sheet's own Close is the one that is read out */}
      <div ref={shade} className="ios-sheet__shade" aria-hidden onClick={() => closeSheet()} />
      <div ref={panel} className="ios-sheet__panel" tabIndex={-1}>
        <h2 className="sr-only">{label}</h2>
        <div className="ios-sheet__bar" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <span className="ios-sheet__grabber" aria-hidden />
          <span className="ios-sheet__side">{leading}</span>
          <span className="ios-sheet__title" dir="auto">
            {title}
          </span>
          <span className="ios-sheet__side ios-sheet__side--end">
            {trailing ?? (
              <GlassButton label="Close" onClick={() => closeSheet()}>
                <X size={20} strokeWidth={2.4} aria-hidden />
              </GlassButton>
            )}
          </span>
        </div>
        <div ref={holding} className="ios-sheet__body" data-scroller>
          {children}
        </div>
      </div>
    </div>
  )
}

// ---- Small things ----

/** What was searched for, as a page quotes it back ("No Results for “varda”"): cut short where it runs
 * on, so that a held-down key cannot push the words that matter off the screen. */
export const quoted = (query: string, most = 40) => {
  const q = query.trim()
  return q.length > most ? `${q.slice(0, most).trimEnd()}…` : q
}

/** What a page says when it has nothing to show: a glyph, a line, a quieter line. */
export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="ios-empty">
      {icon && (
        <span className="ios-empty__icon" aria-hidden>
          {icon}
        </span>
      )}
      <span className="ios-empty__title" dir="auto">
        {title}
      </span>
      {children && (
        <span className="ios-empty__text" dir="auto">
          {children}
        </span>
      )}
    </div>
  )
}
