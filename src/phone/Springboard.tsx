import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { chat, QUESTION, TOTAL } from '../apps/chat'
import { GROUP_NAME, GroupAvatar, PersonAvatar } from '../apps/chat-ui'
import { ALL, CompanyLogo } from '../apps/portfolio-ui'
import { useUnread } from '../apps/state'
import { FAQS } from '../data/faqs'
import { PEOPLE } from '../data/people'
import { VERTICALS } from '../data/portfolio'
import { SITE } from '../data/site'
import type { Rect } from '../kit/measure'
import { Expand } from '../kit/motion/Expand'
import { LockScreen, Notification } from '../kit/phone'
import { AppIcon } from '../os/icons'
import { idleSeconds } from '../os/saver'
import { useStore } from '../os/store'
import { DOCKED, ON_HOME, PHONE } from './apps'
import { GROUP_VIEW } from './apps/routes'
import { COLOR, carried, chrome } from './chrome'
import { OnePagerIcon } from './icons'
import { haptic } from './native'
import { Spotlight } from './Spotlight'
import { goHome, launch, launchAt, lock, quit, showSpotlight, showSwitcher, sys, topOf, unlock, type PhoneApp } from './system'
import { clockOf, dateOf, useNow } from './time'
import { AppContext, scaleOf } from './ui'

// The phone itself, under and around its apps: the wallpaper, the Lock Screen
// with the group's replies arriving on it, the Home Screen (widgets, icons,
// the Dock), the apps opening out of their icons, the App Switcher, and the
// banners that drop in when a reply lands while something else is showing.
// The kit draws the Lock Screen, the notifications and the zoom an app opens
// with; the gestures are here.

// ---- Where things are ----

const EMPTY: Rect = { x: 0, y: 0, width: 0, height: 0 }

/** Where something marked `data-origin` is, in the stage's pixels, for an app
 * to grow out of. The Home Screen falls back a little while an app covers it
 * (it is scaled about its middle): an icon is measured where it rests, not
 * where it happens to be drawn mid-move. */
function originRect(name: string): Rect | null {
  const el = document.querySelector<HTMLElement>(`[data-origin="${name}"]`)
  const stage = el?.closest<HTMLElement>('.ss-stage')
  if (!el || !stage) return null
  const r = el.getBoundingClientRect()
  if (!r.width) return null
  const s = stage.getBoundingClientRect()
  let rect = { x: r.left, y: r.top, width: r.width, height: r.height }
  const home = el.closest<HTMLElement>('.sb-home')
  if (home) {
    const drawn = home.getBoundingClientRect()
    const k = drawn.width / (home.offsetWidth * scaleOf(home.parentElement)) || 1
    const cx = drawn.left + drawn.width / 2
    const cy = drawn.top + drawn.height / 2
    rect = { x: cx + (r.left - cx) / k, y: cy + (r.top - cy) / k, width: r.width / k, height: r.height / k }
  }
  return { x: rect.x - s.left, y: rect.y - s.top, width: rect.width, height: rect.height }
}

const iconOrigin = (id: PhoneApp) => `icon:${id}`

/** Something opens the conversation: the reply it is about, as a notification shows it. */
function Reply({ index, banner, origin, onOpen, className }: { index: number; banner?: boolean; origin: string; onOpen: () => void; className?: string }) {
  const person = PEOPLE[index]!
  return (
    <Notification
      banner={banner}
      className={`sb-note${className ? ` ${className}` : ''}`}
      data-origin={origin}
      role="button"
      tabIndex={0}
      aria-label={`${person.name}, in ${GROUP_NAME}: ${person.quote ?? ''}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      icon={
        <span className="sb-note__face">
          <PersonAvatar index={index} size={38} />
          <span className="sb-note__app">
            <AppIcon id="messages" />
          </span>
        </span>
      }
      title={person.name}
      body={
        <>
          <b>{GROUP_NAME}</b>
          <br />
          {person.quote ?? person.role}
        </>
      }
    />
  )
}

const openGroup = (origin: string) => launchAt('messages', [GROUP_VIEW], origin)

// ---- The Lock Screen ----

function Lock() {
  const locked = useStore(sys, (s) => s.locked)
  const replied = useStore(chat, (s) => s.replied)
  const now = useNow()
  const root = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; t: number; dy: number; v: number; k: number } | null>(null)
  // It stays drawn while it slides away
  const [shown, setShown] = useState(locked)
  const [hint, setHint] = useState(false)
  if (locked && !shown) setShown(true)
  useEffect(() => {
    if (locked || !shown) return
    const t = setTimeout(() => setShown(false), 520)
    return () => clearTimeout(t)
  }, [locked, shown])

  // "Swipe up to open" comes up after a moment, as it does on waking a phone
  useEffect(() => {
    if (!locked) return setHint(false)
    const t = setTimeout(() => setHint(true), 1400)
    return () => clearTimeout(t)
  }, [locked])

  // Any key opens it
  useEffect(() => {
    if (!locked) return
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key === 'Tab' || e.key === 'Shift') return
      if ((e.target as HTMLElement).closest?.('.sb-note')) return
      e.preventDefault()
      unlock()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [locked])

  const place = (dy: number, moving: boolean) => {
    const el = root.current
    if (!el) return
    el.style.transition = moving ? 'none' : ''
    el.style.transform = dy ? `translateY(${dy}px)` : ''
    el.style.opacity = dy ? String(Math.max(0.2, 1 + dy / 520)) : ''
  }

  const down = (e: ReactPointerEvent) => {
    if (!locked || (e.target as HTMLElement).closest('.sb-note, .sb-lock__hint')) return
    drag.current = { y: e.clientY, t: e.timeStamp, dy: 0, v: 0, k: scaleOf(root.current) }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const dy = Math.min(0, (e.clientY - d.y) / d.k)
    const dt = Math.max(1, e.timeStamp - d.t)
    d.v = d.v * 0.6 + ((dy - d.dy) / dt) * 0.4
    d.dy = dy
    d.t = e.timeStamp
    place(dy, true)
  }

  const up = (e: ReactPointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const speed = e.timeStamp - d.t > 90 ? 0 : d.v
    place(0, false)
    if (d.dy < -110 || (d.dy < -20 && speed < -0.45)) {
      haptic()
      unlock()
    }
  }

  if (!shown) return null
  return (
    <div ref={root} className="sb-lock" data-leaving={!locked || undefined} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} {...(locked ? null : ({ inert: '' } as object))}>
      <LockScreen date={dateOf(now)} time={clockOf(now)}>
        {replied > 0 && (
          <div className="sb-stack" data-more={replied > 1 ? (replied > 2 ? 2 : 1) : undefined}>
            <Reply key={replied} index={replied - 1} origin="lock-note" onOpen={() => openGroup('lock-note')} />
          </div>
        )}
      </LockScreen>
      {/* A swipe opens it, as on any iPhone; the words can be pressed too, for a mouse or a keyboard */}
      <button type="button" className="sb-lock__hint" data-show={hint || undefined} aria-label="Open the phone" onClick={unlock}>
        Swipe up to open
      </button>
    </div>
  )
}

// ---- The Home Screen ----

function HomeIcon({ id }: { id: PhoneApp }) {
  const unread = useUnread()
  const badge = id === 'messages' ? unread : 0
  return (
    <button type="button" className="sb-icon" aria-label={`${PHONE[id].label}${badge ? `, ${badge} unread` : ''}`} onClick={() => launch(id)}>
      <span className="sb-icon__tile" data-origin={iconOrigin(id)}>
        <AppIcon id={id} />
        {badge > 0 && (
          <span className="sb-badge" aria-hidden>
            {badge}
          </span>
        )}
      </span>
      <span className="sb-icon__name">{PHONE[id].label}</span>
    </button>
  )
}

/** A link dressed as an app: the one-pager opens in the browser. */
function LinkIcon({ name, href, children }: { name: string; href: string; children: ReactNode }) {
  return (
    <a className="sb-icon" href={href} target="_blank" rel="noreferrer">
      <span className="sb-icon__tile">{children}</span>
      <span className="sb-icon__name">{name}</span>
    </a>
  )
}

/** The group chat as a widget: the question, and the newest reply to it. */
function ChatWidget() {
  const replied = useStore(chat, (s) => s.replied)
  const latest = replied > 0 ? PEOPLE[replied - 1]! : null
  return (
    <button type="button" className="sb-widget sb-widget--wide" aria-label={`${GROUP_NAME}: ${replied} of ${TOTAL} have replied. Open the conversation.`} onClick={() => openGroup('widget:chat')}>
      <span className="sb-widget__face sb-chat" data-origin="widget:chat">
        <span className="sb-chat__head">
          <GroupAvatar size={24} />
          <span className="sb-chat__name">{GROUP_NAME}</span>
          <span className="sb-chat__count">
            {replied} of {TOTAL}
          </span>
        </span>
        {latest ? (
          <span className="sb-chat__reply" key={replied}>
            <PersonAvatar index={replied - 1} size={30} />
            <span className="sb-chat__bubble">
              <b>{latest.name}</b>
              <span>{latest.quote ?? latest.role}</span>
            </span>
          </span>
        ) : (
          <span className="sb-chat__ask">
            {QUESTION.map((line) => (
              <span key={line} className="sb-chat__mine">
                {line}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className="sb-icon__name">Messages</span>
    </button>
  )
}

const SHOWN = ALL.filter((c) => c.logo).slice(0, 4)

function PortfolioWidget() {
  return (
    <button type="button" className="sb-widget" aria-label={`Portfolio: ${ALL.length} companies. Open it.`} onClick={() => launch('finder', 'widget:portfolio')}>
      <span className="sb-widget__face sb-folio" data-origin="widget:portfolio">
        <span className="sb-folio__logos">
          {SHOWN.map((c) => (
            <CompanyLogo key={c.name} company={c} size={44} />
          ))}
        </span>
        <span className="sb-folio__text">
          <b>{ALL.length} companies</b>
          <span>{VERTICALS.length} verticals</span>
        </span>
      </span>
      <span className="sb-icon__name">Portfolio</span>
    </button>
  )
}

function FaqWidget() {
  return (
    <button type="button" className="sb-widget" aria-label={`FAQs: ${FAQS.length} questions. Open them.`} onClick={() => launch('notes', 'widget:faqs')}>
      <span className="sb-widget__face sb-faq" data-origin="widget:faqs">
        <span className="sb-faq__head">
          <b>FAQs</b>
          <span>{FAQS.length}</span>
        </span>
        <span className="sb-faq__list">
          {FAQS.slice(0, 4).map((f) => (
            <span key={f.question}>{f.question}</span>
          ))}
        </span>
      </span>
      <span className="sb-icon__name">FAQs</span>
    </button>
  )
}

function Home() {
  const covered = useStore(sys, (s) => s.app !== null || s.switcher)
  const locked = useStore(sys, (s) => s.locked)
  const spotlight = useStore(sys, (s) => s.spotlight)
  const hidden = covered || locked || spotlight
  // A pull down on the Home Screen brings up search, as it does on an iPhone
  const pull = useRef<{ x: number; y: number; k: number } | null>(null)
  return (
    <div
      className="sb-home"
      data-covered={covered || undefined}
      data-locked={locked || undefined}
      data-searching={spotlight || undefined}
      onPointerDown={(e) => {
        if (e.pointerType !== 'mouse') pull.current = { x: e.clientX, y: e.clientY, k: scaleOf(e.currentTarget) }
      }}
      onPointerMove={(e) => {
        const p = pull.current
        if (!p) return
        const dy = (e.clientY - p.y) / p.k
        const dx = (e.clientX - p.x) / p.k
        if (dy > 56 && Math.abs(dx) < dy * 0.6) {
          pull.current = null
          showSpotlight(true)
        }
      }}
      onPointerUp={() => (pull.current = null)}
      onPointerCancel={() => (pull.current = null)}
      {...(hidden ? ({ inert: '' } as object) : null)}
    >
      <div className="sb-grid">
        <ChatWidget />
        <PortfolioWidget />
        <FaqWidget />
        {ON_HOME.slice(0, 1).map((id) => (
          <HomeIcon key={id} id={id} />
        ))}
        <LinkIcon name="One-pager" href={SITE.onePager}>
          <OnePagerIcon />
        </LinkIcon>
        {ON_HOME.slice(1).map((id) => (
          <HomeIcon key={id} id={id} />
        ))}
      </div>
      <button type="button" className="sb-search" onClick={() => showSpotlight(true)}>
        <Search size={12} strokeWidth={3} aria-hidden />
        Search
      </button>
      <nav className="sb-dock" aria-label="Dock">
        {DOCKED.map((id) => (
          <HomeIcon key={id} id={id} />
        ))}
      </nav>
    </div>
  )
}

// ---- Apps ----

/** How long a card takes to settle into the App Switcher, or out of it. */
const SETTLE = 460

function AppSlot({ id, order }: { id: PhoneApp; order: number }) {
  const front = useStore(sys, (s) => s.app === id)
  const locked = useStore(sys, (s) => s.locked)
  const switcher = useStore(sys, (s) => s.switcher)
  const motion = useStore(sys, (s) => s.motion)
  const origin = useStore(sys, (s) => (s.app === id ? s.origin : null))
  const tone = useStore(chrome, (s) => s[id])
  const [zoom, setZoom] = useState<{ open: boolean; from: Rect; still: boolean }>({ open: false, from: EMPTY, still: true })
  // Cards stay drawn for a moment after the switcher closes, while they clear the screen
  const [lingering, setLingering] = useState(false)
  const wasSwitcher = useRef(switcher)
  const Root = PHONE[id].Root

  useLayoutEffect(() => {
    const left = wasSwitcher.current && !switcher
    wasSwitcher.current = switcher
    if (switcher) return
    if (left) {
      // Out of the switcher: the card that was picked grows to the screen, the others slide off
      setZoom((z) => ({ ...z, open: front, still: true }))
      setLingering(true)
      const t = setTimeout(() => setLingering(false), SETTLE)
      return () => clearTimeout(t)
    }
    if (!front) {
      // Home: back into its icon
      const from = originRect(iconOrigin(id))
      setZoom((z) => ({ open: false, from: from ?? z.from, still: !motion || !from }))
      return
    }
    const from = originRect(origin ?? iconOrigin(id)) ?? originRect(iconOrigin(id))
    if (!motion || !from) return setZoom((z) => ({ open: true, from: from ?? z.from, still: true }))
    // Opening: placed on what it opens out of first, then let go
    setZoom({ open: false, from, still: true })
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setZoom({ open: true, from, still: false }))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [front, switcher]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = switcher || lingering ? true : zoom.open
  const still = switcher || lingering ? true : zoom.still
  const active = front && !locked && !switcher
  const card = origin !== null && !origin.startsWith('icon:') && !origin.startsWith('widget:')
  return (
    <div className="sb-slot" data-app={id} data-front={front || undefined} data-lingering={lingering || undefined} style={{ '--i': order } as CSSProperties}>
      <div className="sb-slot__label" aria-hidden>
        <span className="sb-slot__icon">
          <AppIcon id={id} />
        </span>
        {PHONE[id].label}
      </div>
      <div className="sb-card">
        <Expand
          open={open}
          from={zoom.from}
          radius={zoom.from.width * (card ? 0.07 : 0.225)}
          duration={still ? 0 : undefined}
          face={card ? <span className="sb-face sb-face--card" /> : <AppIcon id={id} />}
          className="sb-app"
          data-app={id}
          data-shut={!open || undefined}
          data-still={still || undefined}
          style={{ '--ss-expand-bg': COLOR[tone] } as CSSProperties}
          {...(active ? null : ({ inert: '' } as object))}
        >
          <div className="sb-drag">
            <AppContext.Provider value={{ app: id, active }}>
              <Root />
            </AppContext.Provider>
          </div>
        </Expand>
        {switcher && <CardHandle id={id} />}
      </div>
    </div>
  )
}

/** A card in the App Switcher: tap it to go to the app, flick it up to close it. The row of cards pans under a sideways drag. */
function CardHandle({ id }: { id: PhoneApp }) {
  const drag = useRef<{ x: number; y: number; t: number; dx: number; dy: number; vy: number; k: number; axis: 'x' | 'y' | null; pan: number } | null>(null)
  const strip = () => document.querySelector<HTMLElement>('.sb-apps')
  const slot = (el: Element) => el.closest<HTMLElement>('.sb-slot')

  const down = (e: ReactPointerEvent) => {
    const apps = strip()
    drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, dx: 0, dy: 0, vy: 0, k: scaleOf(apps), axis: null, pan: parseFloat(apps?.style.getPropertyValue('--pan') || '0') }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    const apps = strip()
    const el = slot(e.currentTarget)
    if (!d || !apps || !el) return
    const dx = (e.clientX - d.x) / d.k
    const dy = (e.clientY - d.y) / d.k
    if (!d.axis && Math.hypot(dx, dy) > 8) d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    const dt = Math.max(1, e.timeStamp - d.t)
    d.vy = d.vy * 0.6 + ((dy - d.dy) / dt) * 0.4
    d.dx = dx
    d.dy = dy
    d.t = e.timeStamp
    if (d.axis === 'x') {
      apps.setAttribute('data-panning', '')
      apps.style.setProperty('--pan', `${d.pan + dx}px`)
    } else if (d.axis === 'y') {
      el.setAttribute('data-lifting', '')
      el.style.setProperty('--lift', `${Math.min(24, dy)}px`)
    }
  }

  const up = (e: ReactPointerEvent) => {
    const d = drag.current
    drag.current = null
    const apps = strip()
    const el = slot(e.currentTarget)
    if (!d || !apps || !el) return
    apps.removeAttribute('data-panning')
    el.removeAttribute('data-lifting')
    if (!d.axis) return launch(id)
    if (d.axis === 'x') {
      // Comes to rest on the nearest card
      const stride = apps.offsetWidth * 0.76
      const count = sys.get().recents.length
      const at = Math.max(0, Math.min(count - 1, Math.round((d.pan + d.dx) / stride)))
      apps.style.setProperty('--pan', `${at * stride}px`)
      return
    }
    const speed = e.timeStamp - d.t > 90 ? 0 : d.vy
    if (d.dy < -130 || (d.dy < -30 && speed < -0.5)) {
      // Flicked away: the app is closed
      el.style.setProperty('--lift', `-130%`)
      el.setAttribute('data-thrown', '')
      setTimeout(() => {
        quit(id)
        const left = sys.get().recents.length
        const stride = apps.offsetWidth * 0.76
        const pan = parseFloat(apps.style.getPropertyValue('--pan') || '0')
        apps.style.setProperty('--pan', `${Math.min(pan, Math.max(0, left - 1) * stride)}px`)
        if (!left) goHome()
      }, 240)
    } else el.style.setProperty('--lift', '0px')
  }

  return <button type="button" className="sb-card__hit" aria-label={`${PHONE[id].label}. Open it; flick it up to close it.`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={(e) => e.key === 'Enter' && launch(id)} />
}

function Apps() {
  const recents = useStore(sys, (s) => s.recents)
  const switcher = useStore(sys, (s) => s.switcher)
  const root = useRef<HTMLDivElement>(null)
  // Apps keep their place in the page whatever order they were last used in, so nothing remounts
  const [mounted, setMounted] = useState<PhoneApp[]>(recents)
  const next = [...mounted.filter((id) => recents.includes(id)), ...recents.filter((id) => !mounted.includes(id))]
  if (next.length !== mounted.length || next.some((id, i) => id !== mounted[i])) setMounted(next)

  // The switcher opens on the app that was last in front
  useLayoutEffect(() => {
    if (switcher) root.current?.style.setProperty('--pan', '0px')
  }, [switcher])

  return (
    <div ref={root} className="sb-apps" data-switcher={switcher || undefined}>
      {switcher && <button type="button" className="sb-apps__away" aria-label="Home Screen" onClick={goHome} />}
      {mounted.map((id) => (
        <AppSlot key={id} id={id} order={recents.indexOf(id)} />
      ))}
    </div>
  )
}

// ---- Banners ----

/** How long a banner stays, and the least time between two. */
const BANNER = { stay: 4600, apart: 20_000 }

/** A reply landing while something other than the conversation is showing drops in at the top of the screen. */
function Banners() {
  const replied = useStore(chat, (s) => s.replied)
  const [shown, setShown] = useState<{ index: number; leaving: boolean } | null>(null)
  const last = useRef({ replied, at: 0 })
  const drag = useRef<{ y: number; dy: number; k: number } | null>(null)

  useEffect(() => {
    const before = last.current.replied
    last.current.replied = replied
    if (replied <= before) return
    const s = sys.get()
    const reading = s.app === 'messages' && topOf(s, 'messages') === GROUP_VIEW
    if (s.locked || s.switcher || reading || performance.now() - last.current.at < BANNER.apart) return
    last.current.at = performance.now()
    setShown({ index: replied - 1, leaving: false })
  }, [replied])

  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => setShown((b) => (b ? (b.leaving ? null : { ...b, leaving: true }) : b)), shown.leaving ? 420 : BANNER.stay)
    return () => clearTimeout(t)
  }, [shown])

  // Opening the conversation, or locking, takes the banner with it
  const gone = useStore(sys, (s) => s.locked || (s.app === 'messages' && topOf(s, 'messages') === GROUP_VIEW))
  useEffect(() => {
    if (gone) setShown((b) => (b && !b.leaving ? { ...b, leaving: true } : b))
  }, [gone])

  if (!shown) return null
  return (
    <div
      className="sb-banner"
      data-leaving={shown.leaving || undefined}
      onPointerDown={(e) => {
        drag.current = { y: e.clientY, dy: 0, k: scaleOf(e.currentTarget) }
      }}
      onPointerMove={(e) => {
        if (drag.current) drag.current.dy = (e.clientY - drag.current.y) / drag.current.k
      }}
      onPointerUp={() => {
        // Pushed back up: put away
        if (drag.current && drag.current.dy < -14) setShown((b) => (b ? { ...b, leaving: true } : b))
        drag.current = null
      }}
    >
      <Reply index={shown.index} banner origin="banner" onOpen={() => (drag.current && drag.current.dy < -14 ? undefined : openGroup('banner'))} />
    </div>
  )
}

// ---- The home indicator ----

/** The bar at the foot of the screen. Swipe it up to go home; swipe up and
 * hold for the App Switcher. A real phone has one of its own below the
 * browser, which leaves the browser; this one is the site's. `drawn` is false
 * where the phone's frame draws the bar itself. */
function HomeBar({ drawn }: { drawn: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; t: number; dy: number; dx: number; v: number; k: number; h: number; el: HTMLElement | null } | null>(null)
  const hold = useRef<ReturnType<typeof setTimeout>>()
  const at = useStore(sys, (s) => (s.locked ? 'lock' : s.switcher ? 'switcher' : s.app ? 'app' : 'home'))

  const follow = (el: HTMLElement | null, dy: number, dx: number, h: number) => {
    if (!el) return
    const p = Math.max(0, Math.min(1, -dy / h))
    const k = 1 - p * 0.62
    el.style.transform = `translate(${dx * 0.7}px, ${(h / 2) * (1 - k) + dy}px) scale(${k})`
    el.style.borderRadius = `${38 / k}px`
  }

  const settle = (el: HTMLElement | null) => {
    const screen = root.current?.closest<HTMLElement>('.ph')
    screen?.removeAttribute('data-dragging')
    carried.set(false)
    if (!el) return
    el.style.transform = ''
    el.style.borderRadius = ''
  }

  const down = (e: ReactPointerEvent) => {
    const screen = root.current?.closest<HTMLElement>('.ph')
    if (!screen || at === 'lock') return
    const el = at === 'app' ? screen.querySelector<HTMLElement>('.sb-slot[data-front] .sb-drag') : null
    drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, dy: 0, dx: 0, v: 0, k: scaleOf(screen), h: screen.offsetHeight, el }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  /** The finger has come to rest part-way up: that asks for the App Switcher. */
  const rested = () => {
    const d = drag.current
    if (!d || -d.dy / d.h < 0.07) return
    drag.current = null
    settle(d.el)
    haptic()
    showSwitcher(true)
  }

  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const dy = Math.min(0, (e.clientY - d.y) / d.k)
    const dx = (e.clientX - d.x) / d.k
    const dt = Math.max(1, e.timeStamp - d.t)
    const v = (dy - d.dy) / dt
    d.v = d.v * 0.6 + v * 0.4
    // Holding still is how the switcher is asked for: the wait starts over each time the finger moves in earnest
    if (Math.abs(dy - d.dy) > 1.5 || Math.abs(dx - d.dx) > 1.5) {
      clearTimeout(hold.current)
      if (sys.get().recents.length) hold.current = setTimeout(rested, 190)
    }
    d.dy = dy
    d.dx = dx
    d.t = e.timeStamp
    if (at === 'app' && dy < -6) {
      root.current?.closest<HTMLElement>('.ph')?.setAttribute('data-dragging', '')
      carried.set(true)
      follow(d.el, dy, dx, d.h)
    }
  }

  const up = (e: ReactPointerEvent) => {
    const d = drag.current
    drag.current = null
    clearTimeout(hold.current)
    if (!d) return
    const speed = e.timeStamp - d.t > 90 ? 0 : d.v
    const far = -d.dy / d.h
    settle(d.el)
    if (at === 'switcher') return goHome()
    // On the Home Screen there is nothing to carry off: only the hold means anything
    if (at === 'home') return
    // A tap on the bar goes home too: a mouse has no swipe to speak of
    if (d.dy > -6) return goHome()
    if (far > 0.22 || speed < -0.4) {
      haptic()
      return goHome()
    }
  }

  return (
    <div ref={root} className="sb-homebar" data-at={at} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {drawn && <span className="sb-homebar__pill" />}
      {at !== 'lock' && (
        <button type="button" className="sr-only" onClick={goHome}>
          Home Screen
        </button>
      )}
    </div>
  )
}

// ---- All of it ----

export function Springboard({ framed }: { framed: boolean }) {
  const at = useStore(sys, (s) => (s.locked ? 'lock' : s.switcher ? 'switcher' : s.app ? 'app' : 'home'))
  // Left alone for as long as it takes the desktop's screen saver to start, the phone locks itself
  useEffect(() => {
    const wait = idleSeconds() * 1000
    let timer: ReturnType<typeof setTimeout>
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!document.hidden && !sys.get().locked && !document.querySelector('.ph :is(input, textarea):focus')) lock()
        arm()
      }, wait)
    }
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const
    events.forEach((name) => window.addEventListener(name, arm, { passive: true, capture: true }))
    arm()
    return () => {
      clearTimeout(timer)
      events.forEach((name) => window.removeEventListener(name, arm, { capture: true }))
    }
  }, [])
  // Escape steps back out: a sheet, then a screen, then the app (sheets and screens see to their own)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const s = sys.get()
      if (s.locked || s.sheet) return
      if (s.switcher || s.spotlight) return goHome()
      if (s.app && !s.stacks[s.app].length && !(e.target as HTMLElement).closest?.('input, textarea')) goHome()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  return (
    <>
      <div className="sb-wall" data-at={at} aria-hidden />
      <Home />
      <Apps />
      <Spotlight />
      <Lock />
      <Banners />
      <HomeBar drawn={!framed} />
    </>
  )
}
