import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { chat, QUESTION, setChatUnseen, TOTAL } from '../apps/chat'
import { GROUP_NAME, GroupAvatar, PersonAvatar } from '../apps/chat-ui'
import { eggOf } from '../data/eggs'
import { FAQS } from '../data/faqs'
import { PEOPLE } from '../data/people'
import { COMPANIES } from '../data/portfolio'
import { SITE } from '../data/site'
import type { Rect } from '../kit/measure'
import { Expand } from '../kit/motion/Expand'
import { LockScreen, Notification } from '../kit/phone'
import { Boundary } from '../os/Boundary'
import { firstControl, focusFirst, focusLost } from '../os/focus'
import { useStore } from '../os/store'
import { setTitle } from '../os/title'
import { DOCKED, ON_HOME, PHONE } from './apps'
import { GROUP_VIEW } from './apps/routes'
import { COLOR, carried, chrome } from './chrome'
import { HomeFolder, OpenFolder, useOpenFolder } from './Folder'
import { LockGlyph, OnePagerIcon, PhoneIcon } from './icons'
import { haptic } from './native'
import { settings } from './settings'
import { Spotlight } from './Spotlight'
import { book, isFolder } from './apps/notes-store'
import { dropLost, goHome, launch, launchAt, lock, pop, quit, refocus, showSpotlight, showSwitcher, sys, topOf, unlock, type PhoneApp, type Sys } from './system'
import { clockOf, dateOf, useNow } from './time'
import { useNewCount } from './unread'
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

/** What each app last opened out of, when that was not its own icon (a widget, a notification): where the
 * keyboard goes back to when the app is put away. */
const cameFrom = new Map<PhoneApp, string>()

/** The thing on the Home Screen that an app opened out of, to give the keyboard back to: what is marked
 * with that origin if it is there (the widget), or else the app's icon. */
function opener(home: HTMLElement | null, app: PhoneApp | null) {
  if (!home || !app) return null
  const marked = (name: string) => [...home.querySelectorAll<HTMLElement>('[data-origin]')].find((el) => el.dataset.origin === name)?.closest<HTMLElement>('button, a') ?? null
  const from = cameFrom.get(app)
  return (from ? marked(from) : null) ?? marked(iconOrigin(app))
}

/** Something opens the conversation: the reply it is about, as a notification shows it. */
function Reply({ index, banner, origin, onOpen, className }: { index: number; banner?: boolean; origin: string; onOpen: () => void; className?: string }) {
  const person = PEOPLE[index]!
  const previews = useStore(settings, (s) => s.previews)
  return (
    <Notification
      banner={banner}
      className={`sb-note${className ? ` ${className}` : ''}`}
      data-origin={origin}
      role="button"
      tabIndex={0}
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
            <PhoneIcon id="messages" />
          </span>
        </span>
      }
      title={person.name}
      body={
        previews ? (
          <>
            <b>{GROUP_NAME}</b>
            <br />
            {person.quote ?? person.role}
          </>
        ) : (
          // Previews off: who it is from, and no more, as iOS has it
          'iMessage'
        )
      }
    />
  )
}

const openGroup = (origin: string) => launchAt('messages', [GROUP_VIEW], origin)

// ---- The Lock Screen ----

function Lock() {
  const locked = useStore(sys, (s) => s.locked)
  const replied = useStore(chat, (s) => s.replied)
  const announced = useStore(settings, (s) => s.notifications)
  const now = useNow()
  const root = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; t: number; dy: number; v: number; k: number; moving: boolean } | null>(null)
  /** When the screen was last tapped where there is nothing to press: a second tap soon after opens it. */
  const tapped = useRef(0)
  // It stays drawn while it slides away
  const [shown, setShown] = useState(locked)
  const [torch, setTorch] = useState(false)
  if (locked && !shown) setShown(true)
  useEffect(() => {
    if (locked || !shown) return
    const t = setTimeout(() => setShown(false), 520)
    return () => clearTimeout(t)
  }, [locked, shown])

  // The torch does not stay on behind a phone that has been opened
  useEffect(() => {
    tapped.current = 0
    if (!locked) setTorch(false)
  }, [locked])

  // Any key opens it. A key pressed on one of its own controls (a notification, the torch) is that control's
  useEffect(() => {
    if (!locked) return
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key === 'Tab' || e.key === 'Shift') return
      if ((e.target as HTMLElement).closest?.('.sb-note, button')) return
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
    if (!locked) return
    drag.current = { y: e.clientY, t: e.timeStamp, dy: 0, v: 0, k: scaleOf(root.current), moving: false }
  }

  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const dy = Math.min(0, (e.clientY - d.y) / d.k)
    // The swipe can start anywhere, a notification included. Until the finger
    // has moved it may still be a tap on one; once it has, the screen has it,
    // and letting go won't press what it started on
    if (!d.moving) {
      if (dy > -8) return
      d.moving = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    const dt = Math.max(1, e.timeStamp - d.t)
    d.v = d.v * 0.6 + ((dy - d.dy) / dt) * 0.4
    d.dy = dy
    d.t = e.timeStamp
    place(dy, true)
  }

  /** The screen lifts a little and falls back, as an iPhone's does when it is tapped: which way it opens. */
  const nudge = () => {
    const el = root.current
    if (!el) return
    el.removeAttribute('data-nudge')
    // Read once, so that a second tap starts the move over instead of being swallowed by the first
    void el.offsetWidth
    el.setAttribute('data-nudge', '')
  }

  const up = (e: ReactPointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (!d.moving) {
      // A tap, which is what most people try first. On a notification or a button it is theirs. Anywhere
      // else the screen answers it (it lifts and falls back under the words that say how it opens), and a
      // second tap soon after opens it
      if ((e.target as HTMLElement).closest?.('.sb-note, button')) return
      if (tapped.current && e.timeStamp - tapped.current < 2000) {
        haptic()
        // If it is still falling back from the first tap, it goes up from where it is
        root.current?.removeAttribute('data-nudge')
        return unlock()
      }
      tapped.current = e.timeStamp
      return nudge()
    }
    const speed = e.timeStamp - d.t > 90 ? 0 : d.v
    place(0, false)
    if (d.dy < -110 || (d.dy < -20 && speed < -0.45)) {
      haptic()
      unlock()
    }
  }

  /** The touch was taken away (a call, a system gesture): nothing was tapped. */
  const cancel = () => {
    const d = drag.current
    drag.current = null
    if (d?.moving) place(0, false)
  }

  if (!shown) return null
  return (
    <div
      ref={root}
      className="sb-lock"
      data-leaving={!locked || undefined}
      data-torch={torch || undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      onAnimationEnd={(e) => e.target === e.currentTarget && e.currentTarget.removeAttribute('data-nudge')}
      {...(locked ? null : ({ inert: '' } as object))}
    >
      {/* The torch's light, up from its button */}
      <span className="sb-lock__beam" aria-hidden />
      {/* The kit draws its two round buttons as pictures; the ones below it can be pressed */}
      <LockScreen date={dateOf(now)} time={clockOf(now)} controls={false}>
        {announced && replied > 0 && (
          <div className="sb-stack" data-more={replied > 1 ? (replied > 2 ? 2 : 1) : undefined}>
            <Reply key={replied} index={replied - 1} origin="lock-note" onOpen={() => openGroup('lock-note')} />
          </div>
        )}
      </LockScreen>
      <div className="sb-lock__controls">
        <button
          type="button"
          className="sb-lock__control"
          aria-label="Flashlight"
          aria-pressed={torch}
          onClick={() => {
            haptic()
            setTorch((on) => !on)
          }}
        >
          <LockGlyph name="torch" />
        </button>
        {/* An iPhone's camera is where its photos come from; this one opens where Shrug's are */}
        <button type="button" className="sb-lock__control" aria-label={`Camera: opens ${PHONE.photos.label}`} data-origin="lock:camera" onClick={() => launch('photos', 'lock:camera')}>
          <LockGlyph name="camera" />
        </button>
      </div>
      {/* A swipe opens it, as on any iPhone; the words can be pressed too, for a mouse or a keyboard */}
      <button type="button" className="sb-lock__hint" onClick={unlock}>
        Swipe up to open
      </button>
    </div>
  )
}

// ---- The Home Screen ----

function HomeIcon({ id }: { id: PhoneApp }) {
  // The badge on Messages: the replies that have come in and not been seen yet. It ticks up as they arrive
  const unseen = useNewCount()
  const badge = id === 'messages' ? unseen : 0
  return (
    <button type="button" className="sb-icon" aria-label={`${PHONE[id].label}${badge ? `, ${badge} unread` : ''}`} onClick={() => launch(id)}>
      <span className="sb-icon__tile" data-origin={iconOrigin(id)}>
        <PhoneIcon id={id} />
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
    <a className="sb-icon" href={href} target="_blank" rel="noreferrer" draggable={false}>
      <span className="sb-icon__tile">{children}</span>
      <span className="sb-icon__name">
        {name}
        <span className="sr-only">, opens in a new tab</span>
      </span>
    </a>
  )
}

/** The group chat as a widget: the question, and the newest reply to it. */
function ChatWidget() {
  const replied = useStore(chat, (s) => s.replied)
  const latest = replied > 0 ? PEOPLE[replied - 1]! : null
  return (
    <button type="button" className="sb-widget sb-widget--wide" onClick={() => openGroup('widget:chat')}>
      <span className="sb-widget__face sb-chat" data-origin="widget:chat">
        <span className="sb-chat__head">
          <GroupAvatar size={24} />
          <span className="sb-chat__name">{GROUP_NAME}</span>
          <span className="sb-chat__count">
            <span aria-hidden>
              {replied} of {TOTAL}
            </span>
            <span className="sr-only">{replied === 0 ? 'No one has replied yet' : `${replied} of ${TOTAL} ${replied === 1 ? 'has' : 'have'} replied`}</span>
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

function Home() {
  const covered = useStore(sys, (s) => s.app !== null || s.switcher)
  const locked = useStore(sys, (s) => s.locked)
  const spotlight = useStore(sys, (s) => s.spotlight)
  // A folder open over the Home Screen: the icons fall out of focus behind it
  const open = useOpenFolder()
  const folder = open !== null
  const hidden = covered || locked || spotlight || folder
  // A pull down on the Home Screen brings up search, as it does on an iPhone
  const pull = useRef<{ x: number; y: number; k: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  /** The folder that was last open over it. */
  const wasOpen = useRef<string | null>(null)
  if (open) wasOpen.current = open

  // The Home Screen is back in front (an app has been put away, a folder shut, the phone opened) and the
  // keyboard was on what has gone: it goes to what that came out of (the folder, the app's icon, the
  // widget), or to what had it when the phone locked, and never to nowhere
  useEffect(() => {
    if (hidden) return
    const shut = wasOpen.current
    wasOpen.current = null
    const frame = requestAnimationFrame(() => {
      const el = root.current
      if (!el || !focusLost()) return
      const tile = shut ? el.querySelector<HTMLElement>(`[data-origin="folder:${shut}"]`)?.closest<HTMLElement>('button') : null
      refocus(tile, opener(el, sys.get().prev), firstControl(el))
    })
    return () => cancelAnimationFrame(frame)
  }, [hidden])

  return (
    <div
      ref={root}
      className="sb-home"
      data-covered={covered || undefined}
      data-locked={locked || undefined}
      data-searching={spotlight || undefined}
      data-folder={folder || undefined}
      onPointerDown={(e) => {
        // Where the Home Screen scrolls (a screen too small to lay it out on), a drag down is a scroll, not the pull
        const scrolls = e.currentTarget.scrollHeight > e.currentTarget.clientHeight + 1
        if (e.pointerType !== 'mouse' && !scrolls) pull.current = { x: e.clientX, y: e.clientY, k: scaleOf(e.currentTarget) }
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
        <HomeFolder id="portfolio" />
        <HomeFolder id="faqs" />
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
      <nav className="sb-dock" aria-label="Dock" data-full={DOCKED.length >= 4 || undefined}>
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
  // One app opened from inside another slides in over it, as iOS takes you from app to app
  const [slide, setSlide] = useState<'in' | 'under' | null>(null)
  const wasSwitcher = useRef(switcher)
  const slot = useRef<HTMLDivElement>(null)
  /** Ends `lingering`. Kept here, not in the effect that starts it: that effect's own cleanup runs when
   * the app is left again a moment later, and would take the timer with it and leave the mark on for good. */
  const settle = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(settle.current), [])
  const Root = PHONE[id].Root

  // What it opened out of, for the keyboard to go back to when it is put away
  useEffect(() => {
    if (!front) return
    if (origin && !origin.startsWith('icon:')) cameFrom.set(id, origin)
    else cameFrom.delete(id)
  }, [front, origin, id])

  useLayoutEffect(() => {
    const left = wasSwitcher.current && !switcher
    wasSwitcher.current = switcher
    if (switcher) return
    clearTimeout(settle.current)
    if (left) {
      // Out of the switcher: the card that was picked grows to the screen, the others slide off
      setZoom((z) => ({ ...z, open: front, still: true }))
      setLingering(true)
      settle.current = setTimeout(() => setLingering(false), SETTLE)
      return
    }
    // Anything else that happens to it (it is left again before the cards have gone) ends that at once
    setLingering(false)
    const now = sys.get()
    if (!front) {
      if (now.app && motion && now.prev === id) {
        // Another app has come in over this one: it stays where it is until that one has slid across
        setZoom((z) => ({ ...z, open: false, still: true }))
        setSlide('under')
        const t = setTimeout(() => setSlide(null), SETTLE + 80)
        return () => clearTimeout(t)
      }
      // Home: back into its icon
      const from = originRect(iconOrigin(id))
      setZoom((z) => ({ open: false, from: from ?? z.from, still: !motion || !from }))
      return
    }
    const from = originRect(origin ?? iconOrigin(id)) ?? originRect(iconOrigin(id))
    if (motion && now.prev && now.prev !== id && !origin) {
      // Opened from inside another app: there is no icon in sight to grow out of
      setZoom((z) => ({ open: true, from: from ?? z.from, still: true }))
      setSlide('in')
      const t = setTimeout(() => setSlide(null), SETTLE + 80)
      return () => clearTimeout(t)
    }
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

  const open = switcher || lingering || slide === 'under' ? true : zoom.open
  const still = switcher || lingering || slide ? true : zoom.still
  const active = front && !locked && !switcher

  // In front and open: the keyboard comes in with it, onto the screen it is showing (or back to where it
  // was in here, if the phone has just been opened again over it). Whatever opened it is behind it now
  useEffect(() => {
    if (!active || !open) return
    const frame = requestAnimationFrame(() => {
      const el = slot.current
      if (!el || el.contains(document.activeElement)) return
      const pages = el.querySelectorAll<HTMLElement>('.ios-page[data-pos="top"]')
      refocus(pages[pages.length - 1], el.querySelector('.sb-drag'))
    })
    return () => cancelAnimationFrame(frame)
  }, [active, open])
  // Out of anything but its icon (a widget, a notification), it grows from a plain card the shape of that thing
  const card = origin !== null && !origin.startsWith('icon:')
  return (
    <div ref={slot} className="sb-slot" data-app={id} data-front={front || undefined} data-open={(front && zoom.open) || undefined} data-lingering={lingering || undefined} data-slide={slide ?? undefined} style={{ '--i': order, '--tone': COLOR[tone] } as CSSProperties}>
      <div className="sb-slot__label" aria-hidden>
        <span className="sb-slot__icon">
          <PhoneIcon id={id} />
        </span>
        {PHONE[id].label}
      </div>
      {switcher && <CardClose id={id} />}
      <div className="sb-card">
        <Expand
          open={open}
          from={zoom.from}
          radius={card ? 24 : zoom.from.width * 0.225}
          duration={still ? 0 : undefined}
          face={card ? <span className="sb-face sb-face--card" /> : <PhoneIcon id={id} />}
          className="sb-app"
          data-app={id}
          data-shut={!open || undefined}
          data-snap={still || undefined}
          style={{ '--ss-expand-bg': COLOR[tone] } as CSSProperties}
          {...(active ? null : ({ inert: '' } as object))}
        >
          <div className="sb-drag" tabIndex={-1}>
            <AppContext.Provider value={{ app: id, active }}>
              {/* An app that fails does what an app on an iPhone does: it is gone, back to the Home Screen, and starts afresh next time */}
              <Boundary onError={() => quit(id)}>
                <Root />
              </Boundary>
            </AppContext.Provider>
          </div>
        </Expand>
        {switcher && <CardHandle id={id} />}
      </div>
    </div>
  )
}

const strip = () => document.querySelector<HTMLElement>('.sb-apps')
const slotOf = (el: Element) => el.closest<HTMLElement>('.sb-slot')

/** How far apart the App Switcher's cards are, as a share of the screen's width. */
const STRIDE = 0.76

/** Rests the App Switcher on one of its cards (0 is the app last in front). The card is remembered, not
 * the distance: when the screen turns, the distance is worked out again for the new width. */
function restOn(apps: HTMLElement, at: number) {
  apps.dataset.at = String(at)
  apps.style.setProperty('--pan', `${at * apps.offsetWidth * STRIDE}px`)
}

/** The card the App Switcher is resting on, as the button that takes the keyboard. The cards are in the page in
 * the order their apps were first opened, not the order they are shown in. */
function cardAt(apps: HTMLElement, at: number) {
  const id = sys.get().recents[at]
  return id ? apps.querySelector<HTMLElement>(`.sb-slot[data-app="${id}"] .sb-card__hit`) : null
}

/** Closes an app from the App Switcher: its card flies off the top, the others close up, and the keyboard
 * goes to the card that is left in its place. With none left, it is the Home Screen. */
function throwAway(id: PhoneApp, el: HTMLElement, apps: HTMLElement) {
  el.style.setProperty('--lift', `-130%`)
  el.setAttribute('data-thrown', '')
  setTimeout(() => {
    const keyboard = el.contains(document.activeElement)
    quit(id)
    const left = sys.get().recents.length
    restOn(apps, Math.min(Number(apps.dataset.at ?? 0), Math.max(0, left - 1)))
    if (!left) return goHome()
    if (keyboard) requestAnimationFrame(() => focusFirst(cardAt(apps, Number(apps.dataset.at ?? 0)), apps.querySelector('.sb-card__hit')))
  }, 240)
}

/** The small button over a card in the App Switcher that closes its app: for a hand, or a pointer, that cannot flick. */
function CardClose({ id }: { id: PhoneApp }) {
  return (
    <button
      type="button"
      className="sb-slot__close"
      aria-label={`Close ${PHONE[id].label}`}
      onClick={(e) => {
        const apps = strip()
        const el = slotOf(e.currentTarget)
        if (apps && el) throwAway(id, el, apps)
      }}
    >
      <X size={15} strokeWidth={3} aria-hidden />
    </button>
  )
}

/** A card in the App Switcher: tap it to go to the app, flick it up to close it (or press its close button, or Delete). The row of cards pans under a sideways drag. */
function CardHandle({ id }: { id: PhoneApp }) {
  const drag = useRef<{ x: number; y: number; t: number; dx: number; dy: number; vy: number; k: number; axis: 'x' | 'y' | null; pan: number } | null>(null)
  /** The press that is ending was a drag (a pan, a flick): the click that follows it picks nothing. */
  const dragged = useRef(false)
  const slot = slotOf

  const down = (e: ReactPointerEvent) => {
    const apps = strip()
    drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, dx: 0, dy: 0, vy: 0, k: scaleOf(apps), axis: null, pan: parseFloat(apps?.style.getPropertyValue('--pan') || '0') }
    dragged.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    const apps = strip()
    const el = slot(e.currentTarget)
    if (!d || !apps || !el) return
    const dx = (e.clientX - d.x) / d.k
    const dy = (e.clientY - d.y) / d.k
    if (!d.axis && Math.hypot(dx, dy) > 8) {
      d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      dragged.current = true
    }
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
    // A tap: the click that follows it picks the app. Picking it here, as the finger lifts, would put the
    // app in front before that click is sent, and the click would land on whatever in it was under the finger
    if (!d.axis) return
    if (d.axis === 'x') {
      // Comes to rest on the nearest card
      const count = sys.get().recents.length
      return restOn(apps, Math.max(0, Math.min(count - 1, Math.round((d.pan + d.dx) / (apps.offsetWidth * STRIDE)))))
    }
    const speed = e.timeStamp - d.t > 90 ? 0 : d.vy
    // Flicked away: the app is closed
    if (d.dy < -130 || (d.dy < -30 && speed < -0.5)) throwAway(id, el, apps)
    else el.style.setProperty('--lift', '0px')
  }

  return (
    <button
      type="button"
      className="sb-card__hit"
      aria-label={`${PHONE[id].label}. Open it, or press Delete to close it.`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onClick={() => {
        if (!dragged.current) launch(id)
      }}
      // A card off to the side that takes the keyboard is brought to the middle
      onFocus={(e) => {
        const apps = strip()
        const at = sys.get().recents.indexOf(id)
        if (apps && at >= 0 && e.currentTarget.matches(':focus-visible')) restOn(apps, at)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Delete' && e.key !== 'Backspace') return
        e.preventDefault()
        const apps = strip()
        const el = slot(e.currentTarget)
        if (apps && el) throwAway(id, el, apps)
      }}
    />
  )
}

function Apps() {
  const recents = useStore(sys, (s) => s.recents)
  const switcher = useStore(sys, (s) => s.switcher)
  const locked = useStore(sys, (s) => s.locked)
  const root = useRef<HTMLDivElement>(null)
  // Apps keep their place in the page whatever order they were last used in, so nothing remounts
  const [mounted, setMounted] = useState<PhoneApp[]>(recents)
  const next = [...mounted.filter((id) => recents.includes(id)), ...recents.filter((id) => !mounted.includes(id))]
  if (next.length !== mounted.length || next.some((id, i) => id !== mounted[i])) setMounted(next)

  // The switcher opens on the app that was last in front, and stays on the card it is panned to when the screen turns
  useLayoutEffect(() => {
    const el = root.current
    if (!switcher || !el) return
    restOn(el, 0)
    const turned = () => restOn(el, Number(el.dataset.at ?? 0))
    window.addEventListener('resize', turned)
    return () => window.removeEventListener('resize', turned)
  }, [switcher])

  // Opened from the keyboard, the keyboard goes to the first card
  useEffect(() => {
    if (!switcher) return
    const frame = requestAnimationFrame(() => {
      const el = root.current
      if (el && (focusLost() || document.activeElement?.closest('.sb-homebar'))) focusFirst(cardAt(el, 0), el.querySelector('.sb-card__hit'))
    })
    return () => cancelAnimationFrame(frame)
  }, [switcher])

  return (
    <div ref={root} className="sb-apps" data-switcher={switcher || undefined} data-locked={locked || undefined}>
      {/* A press beside the cards goes home. For a pointer only: the home bar's own button says "Home Screen" once */}
      {switcher && <div className="sb-apps__away" aria-hidden onClick={goHome} />}
      {mounted.map((id) => (
        <AppSlot key={id} id={id} order={recents.indexOf(id)} />
      ))}
    </div>
  )
}

// ---- Banners ----

/** How long a banner stays, the least time between two, and how long one has been down before it takes a
 * press (it drops over the top bar, where Back and Cancel are: a finger already on its way to one of those
 * should not open the conversation instead). */
const BANNER = { stay: 4600, apart: 20_000, live: 300 }

/** A reply landing while something other than Messages is showing drops in at the top of the screen. */
function Banners() {
  const replied = useStore(chat, (s) => s.replied)
  const [shown, setShown] = useState<{ index: number; leaving: boolean } | null>(null)
  // When the last one dropped. There has been none yet, so the first reply to land while something else is
  // showing gets one, however early in the visit that is
  const last = useRef({ replied, at: -Infinity })
  const drag = useRef<{ y: number; dy: number; k: number } | null>(null)

  useEffect(() => {
    const before = last.current.replied
    last.current.replied = replied
    if (replied <= before) return
    const s = sys.get()
    // Messages itself is showing: the reply is there to see, in the conversation or in the list
    if (!settings.get().notifications || s.locked || s.switcher || s.app === 'messages' || performance.now() - last.current.at < BANNER.apart) return
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
      <Reply
        index={shown.index}
        banner
        origin="banner"
        onOpen={() => {
          if (performance.now() - last.current.at < BANNER.live) return
          if (!(drag.current && drag.current.dy < -14)) openGroup('banner')
        }}
      />
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
  /** `reach` is the farthest the finger has been from where it came down, whichever way. */
  const drag = useRef<{ x: number; y: number; t: number; dy: number; dx: number; v: number; k: number; h: number; reach: number; el: HTMLElement | null } | null>(null)
  const hold = useRef<ReturnType<typeof setTimeout>>()
  const press = useRef<ReturnType<typeof setTimeout>>()
  const at = useStore(sys, (s) => (s.locked ? 'lock' : s.switcher ? 'switcher' : s.app ? 'app' : 'home'))
  // Something is over the Home Screen that "Home Screen" would put away: an app, the switcher, search, a folder
  const away = useStore(sys, (s) => !s.locked && (s.app !== null || s.switcher || s.spotlight || s.sheet !== null))
  const running = useStore(sys, (s) => s.recents.length > 0)

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
    drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, dy: 0, dx: 0, v: 0, k: scaleOf(screen), h: screen.offsetHeight, reach: 0, el }
    e.currentTarget.setPointerCapture(e.pointerId)
    // Pressed and held where it is, it asks for the App Switcher too: for a hand that cannot drag, and for a mouse
    clearTimeout(press.current)
    if (at !== 'switcher' && sys.get().recents.length)
      press.current = setTimeout(() => {
        const d = drag.current
        if (!d || d.reach > 6) return
        drag.current = null
        settle(d.el)
        haptic()
        showSwitcher(true)
      }, 550)
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
    d.reach = Math.max(d.reach, Math.abs((e.clientY - d.y) / d.k), Math.abs(dx))
    if (d.reach > 6) clearTimeout(press.current)
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
    clearTimeout(press.current)
    if (!d) return
    const speed = e.timeStamp - d.t > 90 ? 0 : d.v
    const far = -d.dy / d.h
    settle(d.el)
    // A tap is a press that never went anywhere: a swipe that was taken back to where it began, or went
    // along the bar, is neither a tap nor a swipe up, and does nothing
    const tap = d.reach < 6
    const flick = d.dy <= -6 && (far > 0.22 || speed < -0.4)
    if (at === 'switcher') return tap || flick ? goHome() : undefined
    // On the bare Home Screen there is nothing to carry off: only the hold means anything. With a folder
    // open over it, or search, a tap or a flick up puts that away
    if (at === 'home') return away && (tap || flick) ? goHome() : undefined
    // A tap on the bar goes home too: a mouse has no swipe to speak of
    if (tap) return goHome()
    if (flick) {
      haptic()
      return goHome()
    }
  }

  return (
    <div ref={root} className="sb-homebar" data-at={at} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {drawn && <span className="sb-homebar__pill" />}
      {/* The bar's two gestures as buttons, for a keyboard or a screen reader: out of sight until one has the
          keyboard, when it shows over the bar, saying what it does */}
      {away && (
        <button type="button" className="sr-only sb-homebar__key" onClick={goHome}>
          Home Screen
        </button>
      )}
      {at !== 'lock' && at !== 'switcher' && running && (
        <button type="button" className="sb-homebar__key" onClick={() => showSwitcher(true)}>
          App Switcher
        </button>
      )}
    </div>
  )
}

// ---- All of it ----

/** A screen that is there to be read: a question's note, a note of the visitor's own, a conversation. */
function reading(s: Sys) {
  if (!s.app || s.switcher || s.spotlight) return false
  const top = topOf(s, s.app) ?? ''
  return (s.app === 'notes' && /^[nu]:/.test(top)) || (s.app === 'messages' && top.startsWith('c:'))
}

/** Where the phone is, as the page's title says it, innermost first and one to a line: the conversation,
 * company, question or album where the screen is one, then the app. Nothing on the Lock Screen and the
 * Home Screen, which are the site itself. */
function placeName(s: Sys) {
  if (s.locked) return ''
  if (s.spotlight) return 'Search'
  if (s.switcher) return 'App Switcher'
  if (!s.app) return s.sheet === 'folder:portfolio' ? 'Portfolio' : s.sheet === 'folder:faqs' ? 'FAQs' : ''
  const top = topOf(s, s.app) ?? ''
  const at = top.slice(2)
  let screen: string | null | undefined = null
  if (s.app === 'messages' && top.startsWith('c:')) screen = at === 'group' ? GROUP_NAME : eggOf(at)?.name
  else if (s.app === 'finder') screen = s.sheet?.startsWith('company:') ? COMPANIES.find((company) => company.key === s.sheet!.slice(8))?.name : top === 'f:all' ? 'Portfolio' : null
  else if (s.app === 'notes') screen = top.startsWith('n:') ? FAQS[Number(at)]?.question : top === 'f:faqs' ? 'FAQs' : null
  else if (s.app === 'photos' && top.startsWith('a:')) screen = at
  return [screen, PHONE[s.app].label].filter(Boolean).join('\n')
}

export function Springboard({ framed }: { framed: boolean }) {
  const at = useStore(sys, (s) => (s.locked ? 'lock' : s.switcher ? 'switcher' : s.app ? 'app' : 'home'))
  // Out of the conversation, replies are only news (a notification, the widget), and they come a little quicker
  const watched = useStore(sys, (s) => !s.locked && !s.switcher && s.app === 'messages' && topOf(s, 'messages') === GROUP_VIEW)
  useLayoutEffect(() => {
    setChatUnseen(!watched)
    return () => setChatUnseen(false)
  }, [watched])
  // Left alone for as long as Auto-Lock in Settings says, the phone locks itself. Alone means alone: the
  // wait starts over with anything a visitor does, a screen reader's reading and a selection included; it
  // does not run while the page is out of sight (and starts afresh when the page is looked at again, so
  // coming back is not met by a Lock Screen); and a note or a conversation, which are there to be read
  // for longer than that without a touch, is never locked over
  const autoLock = useStore(settings, (s) => s.autoLock)
  useEffect(() => {
    if (autoLock === null) return
    const wait = autoLock * 1000
    let timer: ReturnType<typeof setTimeout>
    const arm = () => {
      clearTimeout(timer)
      if (document.hidden) return
      timer = setTimeout(() => {
        const s = sys.get()
        if (!document.hidden && !s.locked && !reading(s) && !document.querySelector('.ph :is(input, textarea):focus')) lock()
        arm()
      }, wait)
    }
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll', 'focusin'] as const
    events.forEach((name) => window.addEventListener(name, arm, { passive: true, capture: true }))
    document.addEventListener('selectionchange', arm)
    document.addEventListener('visibilitychange', arm)
    window.addEventListener('pageshow', arm)
    arm()
    return () => {
      clearTimeout(timer)
      events.forEach((name) => window.removeEventListener(name, arm, { capture: true }))
      document.removeEventListener('selectionchange', arm)
      document.removeEventListener('visibilitychange', arm)
      window.removeEventListener('pageshow', arm)
    }
  }, [autoLock])
  // A reload comes back to where the phone was. A screen that names something the visitor made (a note,
  // a folder of theirs) is only there to come back to if that was kept: where it was not, the phone lands
  // on the screen it was opened from
  useLayoutEffect(() => {
    dropLost((app, view) => {
      if (app !== 'notes') return false
      const { notes, folders } = book.get()
      if (view.startsWith('u:')) return !notes.some((note) => note.id === view.slice(2))
      return view.startsWith('f:') && !isFolder(folders, view.slice(2))
    })
  }, [])
  // The page's title names the place: a tab, a screen reader and the browser's history all read it
  const place = useStore(sys, placeName)
  useEffect(() => {
    setTitle(...place.split('\n'))
  }, [place])
  useEffect(() => () => setTitle(), [])
  // Escape steps back out: a sheet (which sees to itself), then a screen, then the app
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const s = sys.get()
      if (s.locked || s.sheet) return
      if (s.switcher || s.spotlight) return goHome()
      if (!s.app || (e.target as HTMLElement).closest?.('input, textarea')) return
      if (s.stacks[s.app].length) pop()
      else goHome()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  return (
    <>
      <div className="sb-wall" data-at={at} aria-hidden />
      <Home />
      <OpenFolder />
      <Apps />
      <Boundary onError={() => showSpotlight(false)}>
        <Spotlight />
      </Boundary>
      <Lock />
      <Banners />
      <HomeBar drawn={!framed} />
    </>
  )
}
