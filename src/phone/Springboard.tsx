import { startTransition, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { chat, QUESTION, setChatUnseen, TOTAL } from '../apps/chat'
import { GROUP_NAME, GroupAvatar, PersonAvatar } from '../apps/chat-ui'
import { eggOf } from '../data/eggs'
import { FAQS } from '../data/faqs'
import { PEOPLE } from '../data/people'
import { COMPANIES } from '../data/portfolio'
import { CompanyLogo, warmLogos } from '../apps/portfolio-ui'
import { SITE } from '../data/site'
import type { Rect } from '../kit/measure'
import { LockScreen, Notification } from '../kit/phone'
import { LockClock } from './LockClock'
import { Boundary } from '../os/Boundary'
import { prefersReducedMotion } from '../os/dom'
import { firstControl, focusFirst, focusLost } from '../os/focus'
import { createStore, useStore } from '../os/store'
import { setTitle } from '../os/title'
import { DOCKED, ON_HOME, PHONE } from './apps'
import { companyOf, GROUP_VIEW, MY_CARD } from './apps/routes'
import { COLOR, carried, chrome, grounds, setTone } from './chrome'
import { HomeFolder, OpenFolder, useOpenFolder } from './Folder'
import { OnePagerIcon, PhoneIcon } from './icons'
import { AppIcon } from '../os/icons'
import { haptic } from './native'
import { settings } from './settings'
import { Spotlight } from './Spotlight'
import { book, isFolder } from './apps/notes-store'
import { dropLost, goHome, launch, launchAt, lock, pop, quit, refocus, showSpotlight, showSwitcher, sys, topOf, unlock, type PhoneApp, type Sys } from './system'
import { clockOf, dateOf, useNow } from './time'
import { useNewCount } from './unread'
import { AppContext, scaleOf } from './ui'
import { Zoom, ZOOM } from './Zoom'

// The phone itself, under and around its apps: the wallpaper, the Lock Screen
// with the group's replies arriving on it, the Home Screen (widgets, icons,
// the Dock), the apps opening out of their icons, the App Switcher, and the
// banners that drop in when a reply lands while something else is showing.
// The kit draws the Lock Screen and the notifications; the zoom an app opens
// with is the site's own (Zoom.tsx), and the gestures are here.

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

/** Puts an app's picture where its window is, before both are sent back into its icon. The two move as
 * one (Zoom.tsx) except under a finger: carried up the screen by the home indicator, the window alone is
 * moved, and is small and off to one side by the time it is let go, while its picture is still the size
 * of the screen it was left on, and came up oversized around it. The picture is set as wide as the window
 * and in the middle of its height, as it is all through the move. */
function gather(slot: HTMLElement | null) {
  const app = slot?.querySelector<HTMLElement>('.sb-zoom__app')
  const face = slot?.querySelector<HTMLElement>('.sb-zoom__face')
  if (!app || !face || !app.offsetWidth || !face.offsetWidth) return
  const box = app.getBoundingClientRect()
  const picture = face.getBoundingClientRect()
  // It is there already (nothing carried the window off): left as it is, mid-move or not
  if (Math.abs(box.width - picture.width) < 1 && Math.abs(box.left - picture.left) < 1) return
  const at = new DOMMatrixReadOnly(getComputedStyle(app).transform)
  const k = (at.a * app.offsetWidth) / face.offsetWidth
  // Put there at once. (How far it has faded is left to carry on: only where it is drawn is set)
  face.style.transitionProperty = 'opacity'
  face.style.transform = `translate(${at.e}px, ${at.f + (at.d * app.offsetHeight - k * face.offsetHeight) / 2}px) scale(${k})`
}

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

/** Something opens the conversation: the reply it is about, as a notification shows it. `was`: it is the
 * one that was showing, kept drawn under the one taking its place: a picture of it, with nothing to press.
 * `turn` counts the replies it has shown: with each it comes in afresh (phone.css). */
function Reply({ index, banner, origin, onOpen, was, turn }: { index: number; banner?: boolean; origin?: string; onOpen?: () => void; was?: boolean; turn?: number }) {
  const person = PEOPLE[index]!
  const previews = useStore(settings, (s) => s.previews)
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    onOpen?.()
  }
  return (
    <Notification
      banner={banner}
      className={`sb-note${was ? ' sb-note--was' : ''}`}
      data-origin={was ? undefined : origin}
      data-turn={turn === undefined ? undefined : turn % 2}
      role={was ? undefined : 'button'}
      tabIndex={was ? undefined : 0}
      aria-hidden={was || undefined}
      onClick={was ? undefined : onOpen}
      onKeyDown={was ? undefined : onKey}
      {...(was ? ({ inert: '' } as object) : null)}
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

/** Opens the conversation, out of what was pressed (`origin`); with none, as an app comes in over another. */
const openGroup = (origin: string | null) => launchAt('messages', [GROUP_VIEW], origin)

// ---- The newest reply, as news ----

/** How long a reply is shown, at the least, where it is news (the Lock Screen's notification, the widget)
 * before the next takes its place. Out of the conversation a reply lands every 0.8 seconds, and one shown
 * for that long and no longer cannot be read: each was gone as it finished arriving. The conversation is
 * not slowed for it (src/apps/chat.ts keeps its own time); what is shown here skips to the newest. */
const READ = 2600

/** How long one reply takes to cross over to the next: the one going stays drawn under the one coming until it is in. */
const CROSS = 520

/** How many had replied when the reply now shown as news was the newest. */
const news = createStore(chat.get().replied)
let newsAt = -Infinity
let newsDue: ReturnType<typeof setTimeout> | undefined
chat.subscribe(() => {
  const { replied } = chat.get()
  const shown = news.get()
  if (replied === shown) return
  const show = () => {
    newsAt = performance.now()
    news.set(chat.get().replied)
  }
  clearTimeout(newsDue)
  // The first is shown as it lands, and a conversation played from the start is back at its start at once
  const wait = shown === 0 || replied < shown ? 0 : READ - (performance.now() - newsAt)
  if (wait <= 0) show()
  else newsDue = setTimeout(show, wait)
})

/** The reply to show as news (`now`: how many had replied when it landed, so it is that many less one),
 * the one it took over from (`was`, or 0), which is kept drawn under it while it arrives, and how many
 * times it has changed (`turn`). */
function useNews() {
  const shown = useStore(news, (n) => n)
  const [reply, setReply] = useState({ now: shown, was: 0, turn: 0 })
  if (reply.now !== shown) setReply({ now: shown, was: prefersReducedMotion() ? 0 : reply.now, turn: reply.turn + 1 })
  useEffect(() => {
    if (!reply.was) return
    const t = setTimeout(() => setReply((r) => (r.was ? { ...r, was: 0 } : r)), CROSS)
    return () => clearTimeout(t)
  }, [reply])
  return reply
}

// ---- The Lock Screen ----


function Lock() {
  const locked = useStore(sys, (s) => s.locked)
  const reply = useNews()
  const announced = useStore(settings, (s) => s.notifications)
  const now = useNow()
  const root = useRef<HTMLDivElement>(null)
  /** `reach` is the farthest the finger has been from where it came down, whichever way. */
  const drag = useRef<{ x: number; y: number; t: number; dy: number; v: number; k: number; reach: number; moving: boolean } | null>(null)
  /** When the screen was last tapped where there is nothing to press: a second tap soon after opens it. */
  const tapped = useRef(0)
  // It stays drawn while it slides away
  const [shown, setShown] = useState(locked)
  if (locked && !shown) setShown(true)
  useEffect(() => {
    if (locked || !shown) return
    const t = setTimeout(() => setShown(false), 420)
    return () => clearTimeout(t)
  }, [locked, shown])

  // A tap made before it was last opened does not count towards opening it again
  useEffect(() => {
    tapped.current = 0
  }, [locked])

  // Any key opens it. A key pressed on one of its own controls (a notification, the words that open it) is that control's
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

  /** The screen is where the finger has lifted it to, thinner the higher it is. What is on it is thinned
   * piece by piece (`--fade`, which each takes for itself: phone.css), never the screen as a whole: a
   * notification is a pane of glass, and glass inside anything see-through has nothing behind it to frost. */
  const place = (dy: number, moving: boolean) => {
    const el = root.current
    if (!el) return
    el.style.transition = moving ? 'none' : ''
    el.style.transform = dy ? `translateY(${dy}px)` : ''
    if (dy) el.style.setProperty('--fade', String(Math.max(0.2, 1 + dy / 520)))
    else el.style.removeProperty('--fade')
    el.toggleAttribute('data-held', moving)
  }

  const reached = (d: NonNullable<typeof drag.current>, e: ReactPointerEvent) => Math.max(d.reach, Math.hypot(e.clientX - d.x, e.clientY - d.y) / d.k)

  const down = (e: ReactPointerEvent) => {
    if (!locked) return
    drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, dy: 0, v: 0, k: scaleOf(root.current), reach: 0, moving: false }
  }

  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    d.reach = reached(d, e)
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
      // A press that went somewhere and was not the swipe up (a drag across the screen, or down it) is not
      // a tap either: two of those do not open the phone
      if (reached(d, e) >= 10) return
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
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      onAnimationEnd={(e) => e.target === e.currentTarget && e.currentTarget.removeAttribute('data-nudge')}
      {...(locked ? null : ({ inert: '' } as object))}
    >
      {/* The day and the time, as an iPhone's Lock Screen sets them: the kit's own are left out for these */}
      <div className="sb-lock__head">
        <p className="sb-lock__date">{dateOf(now)}</p>
        <LockClock time={clockOf(now)} />
      </div>
      <LockScreen clock={false} controls={false}>
        {announced && reply.now > 0 && (
          <>
            {/* The one notification stays, and takes the newest reply in its turn: the keyboard is not thrown
                off it each time. The reply it showed before is drawn under it until the new one is in */}
            <div className="sb-stack" data-more={reply.now > 1 ? (reply.now > 2 ? 2 : 1) : undefined}>
              <Reply index={reply.now - 1} turn={reply.turn} origin="lock-note" onOpen={() => openGroup('lock-note')} />
              {reply.was > 0 && <Reply key={reply.was} index={reply.was - 1} was />}
            </div>
          </>
        )}
      </LockScreen>
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
          <span className="sb-badge" data-digits={String(badge).length} aria-hidden>
            {badge}
          </span>
        )}
      </span>
      <span className="sb-icon__name">{PHONE[id].label}</span>
    </button>
  )
}

/** The stores on a phone: Workspace in the Dock, where VIP was, and the other two on the Home Screen. */
const DOCK_STORE = SITE.stores[0]
const HOME_STORES = SITE.stores.slice(1)

/** A link dressed as an app: the one-pager, and the three stores (the store's own pages, until the phone has
 * stores of its own), each of which opens in a tab of its own. It is named on the link itself as well as
 * under its tile, since the Dock shows no names. */
function LinkIcon({ name, href, children }: { name: string; href: string; children: ReactNode }) {
  return (
    <a className="sb-icon" href={href} target="_blank" rel="noopener noreferrer" draggable={false} aria-label={`${name}, opens in a new tab`}>
      <span className="sb-icon__tile">{children}</span>
      <span className="sb-icon__name">
        {name}
        <span className="sr-only">, opens in a new tab</span>
      </span>
    </a>
  )
}

/** The face of the group chat's widget: the question, and the newest reply to it. Drawn on the Home Screen,
 * and again over the conversation as it opens out of the widget (`origin` marks the one on the Home Screen). */
function ChatFace({ origin }: { origin?: string }) {
  const replied = useStore(chat, (s) => s.replied)
  // The count follows every reply as it lands; the reply shown stays long enough to be read (`READ`)
  const reply = useNews()
  const said = (index: number, was?: boolean) => {
    const person = PEOPLE[index]!
    return (
      <span className={`sb-chat__reply${was ? ' sb-chat__reply--was' : ''}`} key={was ? `was-${index}` : 'now'} data-turn={was ? undefined : reply.turn % 2} aria-hidden={was || undefined}>
        <PersonAvatar index={index} size={30} />
        <span className="sb-chat__bubble">
          <b>{person.name}</b>
          <span>{person.quote ?? person.role}</span>
        </span>
      </span>
    )
  }
  return (
    <span className="sb-widget__face sb-chat" data-origin={origin}>
      <span className="sb-chat__head">
        <GroupAvatar size={24} />
        <span className="sb-chat__name">{GROUP_NAME}</span>
        <span className="sb-chat__count">
          <span aria-hidden>
            {replied} of {TOTAL}
          </span>
          {origin && <span className="sr-only">{replied === 0 ? 'No one has replied yet' : `${replied} of ${TOTAL} ${replied === 1 ? 'has' : 'have'} replied`}</span>}
        </span>
      </span>
      {reply.now > 0 ? (
        // The reply that was showing stays drawn under the one taking its place until that one is in
        <span className="sb-chat__news">
          {said(reply.now - 1)}
          {reply.was > 0 && said(reply.was - 1, true)}
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
  )
}

/** The group chat as a widget. */
function ChatWidget() {
  return (
    <button type="button" className="sb-widget sb-widget--wide" onClick={() => openGroup('widget:chat')}>
      <ChatFace origin="widget:chat" />
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
  // Come back to from the app that was opened out of it: the icons are out of focus behind it already as
  // they come into sight, not sharp for a moment first (phone.css)
  const returned = useStore(sys, (s) => s.app === null && s.prev !== null)
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
      data-folder={folder ? (returned ? 'back' : '') : undefined}
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
        {/* Two of the three stores, in the two places the row had left; the third is in the Dock, where VIP was */}
        {HOME_STORES.map((shop) => (
          <LinkIcon key={shop.app} name={shop.name} href={shop.href}>
            <AppIcon id={shop.app} />
          </LinkIcon>
        ))}
        {ON_HOME.slice(1).map((id) => (
          <HomeIcon key={id} id={id} />
        ))}
      </div>
      <button type="button" className="sb-search" onClick={() => showSpotlight(true)}>
        <Search size={12} strokeWidth={3} aria-hidden />
        Search
      </button>
      {/* The apps, and after them Workspace, which is a link as the one-pager is: it leads to the chair's own
          store. (VIP was here, a link to the old points site: Dom took it out on 26 Nov) */}
      <nav className="sb-dock" aria-label="Dock" data-full={DOCKED.length + 1 >= 4 || undefined}>
        {DOCKED.map((id) => (
          <HomeIcon key={id} id={id} />
        ))}
        <LinkIcon name={DOCK_STORE.name} href={DOCK_STORE.href}>
          <AppIcon id={DOCK_STORE.app} />
        </LinkIcon>
      </nav>
    </div>
  )
}

// ---- Apps ----

/** How long a card takes to settle into the App Switcher, or out of it. */
const SETTLE = 380

/** What an app opens out of, drawn over it as it grows: its icon's own picture; the widget, for the
 * conversation opened from it; a company's logo, out of the folder; and for anything else (a notification,
 * a row) a plain card the shape of that thing. */
function Face({ id, origin }: { id: PhoneApp; origin: string | null }) {
  if (!origin || origin.startsWith('icon:')) return <PhoneIcon id={id} />
  if (origin === 'widget:chat') return <ChatFace />
  const company = /^folder:(?!faq:)/.test(origin) ? COMPANIES.find((c) => c.key === origin.slice(7)) : null
  if (company)
    return (
      <span className="sb-face sb-face--logo">
        <CompanyLogo company={company} size={60} eager />
      </span>
    )
  return <span className="sb-face sb-face--card" />
}

/** How long an app opening out of its icon stays a flat launch screen before its own screens come up: by
 * then it has all but filled the phone (the move is quickest at its start). */
const REVEAL = 250

function AppSlot({ id, order }: { id: PhoneApp; order: number }) {
  const front = useStore(sys, (s) => s.app === id)
  const locked = useStore(sys, (s) => s.locked)
  const switcher = useStore(sys, (s) => s.switcher)
  const motion = useStore(sys, (s) => s.motion)
  const origin = useStore(sys, (s) => (s.app === id ? s.origin : null))
  const tone = useStore(chrome, (s) => s[id])
  // A screen in a colour of its own (a contact's card): the app is drawn out of its icon onto that colour
  const own = useStore(grounds, (s) => s[id])
  const ground = typeof own === 'object' ? own.foot : (own ?? COLOR[tone])
  const [zoom, setZoom] = useState<{ open: boolean; from: Rect; still: boolean }>({ open: false, from: EMPTY, still: true })
  // An app's own screens are not drawn the moment it is first opened: putting them together takes long
  // enough to hold the opening up. It opens as a flat screen in the colour of what it is opening on (a
  // launch screen, as an iPhone shows one), and its screens are drawn while that is under way and come
  // up over it. From then on the app is kept as it was left, so opening it again shows it at once.
  // (Arrived at with no move to draw, on a reload or from a link, it is simply there; and so is one that
  // takes typing the instant it opens: `eager`, apps/index.tsx.)
  const [loaded, setLoaded] = useState(() => !sys.get().motion || !!PHONE[id].eager)
  const cold = useRef(!loaded)
  // Opening out of its icon, an app is a flat screen in its own colour until it has all but filled the
  // phone, and its screens come up over that in a blink: nothing of them is seen stretching into place,
  // which is how an iPhone's launch screen reads, and a flat sheet is the easiest thing there is to move
  const [veiled, setVeiled] = useState(false)
  // In flight (opening, or going back into its icon): what is costly to draw on something moving is left off (phone.css)
  const [flying, setFlying] = useState(false)
  useEffect(() => {
    if (!veiled) return
    const t = setTimeout(() => setVeiled(false), REVEAL)
    return () => clearTimeout(t)
  }, [veiled])
  useEffect(() => {
    if (!flying) return
    const t = setTimeout(() => setFlying(false), ZOOM.open + 80)
    return () => clearTimeout(t)
  }, [flying])
  /** What it is going back into, when that is not its icon: the thing in a folder it was opened out of. */
  const [dest, setDest] = useState<string | null>(null)
  // Cards stay drawn for a moment after the switcher closes, while they clear the screen
  const [lingering, setLingering] = useState(false)
  // One app opened from inside another slides in over it, as iOS takes you from app to app
  const [slide, setSlide] = useState<'in' | 'under' | null>(null)
  const wasSwitcher = useRef(switcher)
  const slot = useRef<HTMLDivElement>(null)
  /** What it has been placed on, shut to open out of it or open to go back into it, until it is let go from there. */
  const placed = useRef<{ on: Rect; open: boolean } | null>(null)
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

  // Before its screens are there to say so themselves: the colour of the screen it is opening on, which
  // its launch screen is drawn in and the status bar is read against
  useLayoutEffect(() => {
    if (loaded) return
    const first = PHONE[id].first?.(topOf(sys.get(), id))
    if (first) setTone(id, first.tone, first.ground, first.over)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Its screens are drawn once the frame that starts the opening has been: from there the opening is the
  // browser's to draw, off this thread, and is not held up by them
  useEffect(() => {
    if (loaded) return
    let timer: ReturnType<typeof setTimeout>
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => startTransition(() => setLoaded(true)), 0)
    })
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [loaded])

  useLayoutEffect(() => {
    const left = wasSwitcher.current && !switcher
    wasSwitcher.current = switcher
    placed.current = null
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
      // Home: back into its icon. Or, backed out of to the folder it was opened from (a company picked in
      // Portfolio: `pop`, system.ts), back into what was pressed there, which is in sight again
      // The conversation opened out of the Home Screen's widget goes back into the widget, which is in
      // sight again there: the way back is the way in
      const came = cameFrom.get(id)
      const out = now.sheet?.startsWith('folder:') ? came : !now.sheet && came === 'widget:chat' ? came : undefined
      const into = out?.startsWith('folder:') || out === 'widget:chat' ? originRect(out) : null
      const from = into ?? originRect(iconOrigin(id))
      setDest(into ? out! : null)
      if (!motion || !from || !zoom.open) return setZoom((z) => ({ open: false, from: from ?? z.from, still: true }))
      // What it goes back into need not be what it came out of (opened out of the widget, it goes back into
      // its icon). So it is first set open on what it is going into, which changes nothing that is seen,
      // and let go from there (below). Sent straight there, its picture would start from the size it had
      // been stretched to over the other thing: a squeezed slab, landing as a small tile in the corner of
      // a larger window
      placed.current = { on: from, open: false }
      setZoom({ open: true, from, still: true })
      return
    }
    setDest(null)
    const from = originRect(origin ?? iconOrigin(id)) ?? originRect(iconOrigin(id))
    if (motion && now.prev && now.prev !== id && !origin) {
      // Opened from inside another app: there is no icon in sight to grow out of
      setZoom((z) => ({ open: true, from: from ?? z.from, still: true }))
      setSlide('in')
      const t = setTimeout(() => setSlide(null), SETTLE + 80)
      return () => clearTimeout(t)
    }
    if (!motion || !from) return setZoom((z) => ({ open: true, from: from ?? z.from, still: true }))
    // Opening: placed on what it opens out of first (below lets it go)
    placed.current = { on: from, open: true }
    setVeiled(true)
    setZoom({ open: false, from, still: true })
  }, [front, switcher]) // eslint-disable-line react-hooks/exhaustive-deps

  // Placed on what it opens out of, or goes back into (and drawn so: this runs once that has been): the
  // browser is made to look at it there (the read does that), and it is let go in the same breath, so the
  // first frame drawn after the tap is already the move
  useLayoutEffect(() => {
    const at = placed.current
    if (!at || zoom.from !== at.on || zoom.open === at.open) return
    placed.current = null
    // Going back, its picture is put where its window is before both are let go
    if (!at.open) gather(slot.current)
    void slot.current?.offsetWidth
    setFlying(true)
    setZoom((z) => ({ ...z, open: at.open, still: false }))
  }, [zoom])

  const open = switcher || lingering || slide === 'under' ? true : zoom.open
  const still = switcher || lingering || slide ? true : zoom.still
  const active = front && !locked && !switcher

  // In front and open: the keyboard comes in with it, onto the screen it is showing (or back to where it
  // was in here, if the phone has just been opened again over it). Whatever opened it is behind it now.
  // While only its launch screen is there the app itself holds the keyboard, and hands it on when its screens are
  useEffect(() => {
    if (!active || !open) return
    const frame = requestAnimationFrame(() => {
      const el = slot.current
      const whole = el?.querySelector<HTMLElement>('.sb-drag')
      if (!el || (el.contains(document.activeElement) && document.activeElement !== whole)) return
      const pages = el.querySelectorAll<HTMLElement>('.ios-page[data-pos="top"]')
      refocus(pages[pages.length - 1], whole)
    })
    return () => cancelAnimationFrame(frame)
  }, [active, open, loaded])
  // Out of anything but its icon (a widget, a notification), it grows from the shape of that thing; and goes
  // back into the shape of what it is going back into
  const out = front ? origin : dest
  const card = out !== null && !out.startsWith('icon:')
  return (
    <div ref={slot} className="sb-slot" data-app={id} data-front={front || undefined} data-open={(front && zoom.open) || undefined} data-lingering={lingering || undefined} data-slide={slide ?? undefined} data-veiled={(veiled && front) || undefined} data-flying={flying || undefined} style={{ '--i': order, '--tone': ground } as CSSProperties}>
      <div className="sb-slot__label" aria-hidden>
        <span className="sb-slot__icon">
          <PhoneIcon id={id} />
        </span>
        <span className="sb-slot__name">{PHONE[id].label}</span>
      </div>
      {switcher && <CardClose id={id} />}
      <div className="sb-card">
        <Zoom
          open={open}
          from={zoom.from}
          radius={card ? (out === 'widget:chat' ? 24 : Math.min(24, zoom.from.width * 0.23, zoom.from.height * 0.5)) : zoom.from.width * 0.225}
          still={still}
          face={<Face id={id} origin={out} />}
          quick={card && front}
          // Back into a question's row in the FAQs folder, which is words and no picture of the app
          vanish={!front && dest !== null && dest !== 'widget:chat' && !/^folder:(?!faq:)/.test(dest)}
          className="sb-app"
          data-app={id}
          data-shut={!open || undefined}
          data-snap={still || undefined}
          style={{ '--zoom-bg': ground } as CSSProperties}
          {...(active ? null : ({ inert: '' } as object))}
        >
          <div className="sb-drag" tabIndex={-1} aria-busy={!loaded || undefined}>
            {loaded && (
              <div className="sb-live" data-fresh={cold.current || undefined} onAnimationEnd={(e) => e.target === e.currentTarget && e.currentTarget.removeAttribute('data-fresh')}>
                <AppContext.Provider value={{ app: id, active }}>
                  {/* An app that fails does what an app on an iPhone does: it is gone, back to the Home Screen, and starts afresh next time */}
                  <Boundary onError={() => quit(id)}>
                    <Root />
                  </Boundary>
                </AppContext.Provider>
              </div>
            )}
          </div>
        </Zoom>
        {switcher && <CardHandle id={id} />}
      </div>
    </div>
  )
}

const strip = () => document.querySelector<HTMLElement>('.sb-apps')
const slotOf = (el: Element) => el.closest<HTMLElement>('.sb-slot')

/** How far apart the App Switcher's cards are, as a share of the screen's width. */
const STRIDE = 0.76

/** How far the row of cards is panned, told to each card itself and to nothing else. Told to the row, it
 * was handed down to everything inside every card (a style a card's whole app had to be gone over again
 * for, at each move of the finger), which is what made the row stutter under a thumb. */
function setPan(apps: HTMLElement, px: number) {
  apps.dataset.pan = String(px)
  for (const el of apps.querySelectorAll<HTMLElement>('.sb-slot')) el.style.setProperty('--pan', `${px}px`)
}

/** Marks the card in the middle of the App Switcher (`at`, counted from the app last in front). Its name
 * and the button that closes it are the only ones shown (phone.css): a neighbour's sit over the edge of
 * the screen, where a corner of its card peeks in, and its ✕ there read as the middle card's own while
 * it closed an app that was not in view. */
function midOn(apps: HTMLElement, at: number) {
  const id = sys.get().recents[at]
  for (const el of apps.querySelectorAll<HTMLElement>('.sb-slot')) el.toggleAttribute('data-mid', el.dataset.app === id)
}

/** Rests the App Switcher on one of its cards (0 is the app last in front). The card is remembered, not
 * the distance: when the screen turns, the distance is worked out again for the new width. */
function restOn(apps: HTMLElement, at: number) {
  apps.dataset.at = String(at)
  setPan(apps, at * apps.offsetWidth * STRIDE)
  midOn(apps, at)
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
    drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, dx: 0, dy: 0, vy: 0, k: scaleOf(apps), axis: null, pan: parseFloat(apps?.dataset.pan || '0') }
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
      setPan(apps, d.pan + dx)
      // The name and the ✕ go with whichever card is nearest the middle
      midOn(apps, Math.max(0, Math.min(sys.get().recents.length - 1, Math.round((d.pan + dx) / (apps.offsetWidth * STRIDE)))))
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
    // The cards that were not in front come in from the side, at the size of a card. They are set down
    // there with nothing to move from (the mark stays only until the browser has looked at them so):
    // moved there, each was drawn once at the size of the screen, behind the card being held, and shrank away
    el.setAttribute('data-entering', '')
    void el.offsetWidth
    el.removeAttribute('data-entering')
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
      // What a banner has dropped over still works. It lands on the top bar of whatever app is open, where
      // Back and Share are, and stays for seconds: a press on it where one of those is lies goes to that
      // button, and the banner gets out of the way. Anywhere else on it opens the conversation. (A click
      // with no place is the keyboard's, and is the banner's own)
      onClickCapture={(e) => {
        if (!e.detail) return
        const banner = e.currentTarget
        const under = document.elementsFromPoint(e.clientX, e.clientY).find((el) => !banner.contains(el))
        const control = under?.closest<HTMLElement>('.sb-slot[data-front] :is(button, a[href], [role="button"])')
        if (!control || control.getAttribute('aria-disabled') === 'true') return
        e.preventDefault()
        e.stopPropagation()
        setShown((b) => (b ? { ...b, leaving: true } : b))
        control.click()
      }}
    >
      <Reply
        index={shown.index}
        banner
        origin="banner"
        onOpen={() => {
          if (performance.now() - last.current.at < BANNER.live) return
          if (drag.current && drag.current.dy < -14) return
          // Over the Home Screen the conversation opens out of the banner. From inside another app it
          // comes in over that app from the side, as one app does from another: grown out of the banner
          // while the app under it slid away, it left the wallpaper showing down one side and along the foot
          openGroup(sys.get().app ? null : 'banner')
        }}
      />
    </div>
  )
}

// ---- The home indicator ----

/** The bar at the foot of the screen. Swipe it up to go home; swipe up and
 * hold for the App Switcher; swipe along it for the app that was in front
 * before this one. A real phone has one of its own below the browser, which
 * leaves the browser; this one is the site's. `drawn` is false where the
 * phone's frame draws the bar itself. */
function HomeBar({ drawn }: { drawn: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  /** `reach` is the farthest the finger has been from where it came down, whichever way. `el` is the app
   * in front (the same part the opening moves, Zoom.tsx), and `was` how it was set before it was picked up. */
  const drag = useRef<{ x: number; y: number; t: number; dy: number; dx: number; v: number; k: number; w: number; h: number; reach: number; el: HTMLElement | null; was: { transform: string; transition: string; radius: string } | null } | null>(null)
  const hold = useRef<ReturnType<typeof setTimeout>>()
  const press = useRef<ReturnType<typeof setTimeout>>()
  /** An app let go on its way home: until the phone says it has gone, it is held where it was let go. */
  const thrown = useRef<ReturnType<typeof setTimeout>>()
  /** Takes off the mark that says which side the app before comes in from (`data-swept`, phone.css), once it is in. */
  const swept = useRef<ReturnType<typeof setTimeout>>()
  const at = useStore(sys, (s) => (s.locked ? 'lock' : s.switcher ? 'switcher' : s.app ? 'app' : 'home'))
  // Something is over the Home Screen that "Home Screen" would put away: an app, the switcher, search, a folder
  const away = useStore(sys, (s) => !s.locked && (s.app !== null || s.switcher || s.spotlight || s.sheet !== null))
  const running = useStore(sys, (s) => s.recents.length > 0)

  const screenOf = () => root.current?.closest<HTMLElement>('.ph') ?? null

  /** The app follows the finger up the screen, growing smaller as it goes, its foot under the finger. It is
   * moved the way the opening moves it (from its top left corner), so that when it is let go for home it
   * carries on from wherever it is into its icon, in one move. */
  const follow = (d: NonNullable<typeof drag.current>) => {
    const el = d.el
    if (!el) return
    const p = Math.max(0, Math.min(1, -d.dy / d.h))
    // It shrinks a little faster than the finger climbs, so that its head stays on the screen under it
    const k = Math.max(0.3, 1 - p * 1.15)
    el.style.transition = 'none'
    el.style.transform = `translate(${d.dx * 0.7 + (d.w / 2) * (1 - k)}px, ${d.h * (1 - k) + d.dy}px) scale(${k})`
    el.style.borderRadius = `${38 / k}px`
    // How far it has been carried: the Home Screen comes into sight behind it by that much (phone.css)
    // (Told to the Home Screen, which is all that reads it: told to the whole phone, every app in it was restyled at each move)
    screenOf()?.querySelector<HTMLElement>('.sb-home')?.style.setProperty('--carry', p.toFixed(3))
  }

  /** No longer carried: the marks that say so come off. */
  const unmark = () => {
    const screen = screenOf()
    screen?.removeAttribute('data-dragging')
    screen?.querySelector<HTMLElement>('.sb-home')?.style.removeProperty('--carry')
    carried.set(false)
  }

  /** Let go without being sent home (or picked up and never moved): it glides back to where it was. How
   * it was set is put back at once, as the phone itself keeps it, and the glide is an animation of its
   * own over that: whatever the phone does to it meanwhile (the App Switcher takes it up) does not cut it short. */
  const settle = (d: NonNullable<typeof drag.current>) => {
    unmark()
    const { el, was } = d
    if (!el || !was) return
    const from = { transform: el.style.transform, borderRadius: el.style.borderRadius }
    el.style.transition = 'none'
    el.style.transform = was.transform
    el.style.borderRadius = was.radius
    void el.offsetWidth
    el.style.transition = was.transition
    if (from.transform === was.transform || prefersReducedMotion()) return
    try {
      el.animate([from, { transform: was.transform, borderRadius: was.radius }], { duration: 400, easing: getComputedStyle(el).getPropertyValue('--spring').trim() || 'ease-out' })
    } catch {
      // A curve this browser does not read: it is back where it was already
    }
  }

  /** Let go on its way home: it stays exactly where it was let go until the phone has gone home (the
   * browser's history answers a moment later), and then goes from there into its icon. If the phone does
   * not go after all, it is put back. */
  const sendHome = (d: NonNullable<typeof drag.current>) => {
    clearTimeout(thrown.current)
    thrown.current = setTimeout(() => {
      thrown.current = undefined
      if (sys.get().app) settle(d)
      else unmark()
    }, 700)
    goHome()
  }

  // The phone has gone home (or anywhere else): what marked the app as carried comes off in the same
  // breath as its window is sent to its icon, so nothing is drawn in between
  useLayoutEffect(() => {
    if (at === 'app' || thrown.current === undefined) return
    clearTimeout(thrown.current)
    thrown.current = undefined
    unmark()
  }, [at]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      clearTimeout(thrown.current)
      clearTimeout(swept.current)
    },
    [],
  )

  const down = (e: ReactPointerEvent) => {
    const screen = screenOf()
    if (!screen || at === 'lock') return
    const el = at === 'app' ? screen.querySelector<HTMLElement>('.sb-slot[data-front] .sb-zoom__app') : null
    drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, dy: 0, dx: 0, v: 0, k: scaleOf(screen), w: screen.offsetWidth, h: screen.offsetHeight, reach: 0, el, was: null }
    e.currentTarget.setPointerCapture(e.pointerId)
    // Pressed and held where it is, it asks for the App Switcher too: for a hand that cannot drag, and for a mouse
    clearTimeout(press.current)
    if (at !== 'switcher' && sys.get().recents.length)
      press.current = setTimeout(() => {
        const d = drag.current
        if (!d || d.reach > 6) return
        drag.current = null
        settle(d)
        haptic()
        showSwitcher(true)
      }, 550)
  }

  /** The finger has come to rest part-way up: that asks for the App Switcher. */
  const rested = () => {
    const d = drag.current
    if (!d || -d.dy / d.h < 0.07) return
    drag.current = null
    settle(d)
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
    if (at === 'app' && dy < -6 && d.el) {
      // Picked up: how it was set is kept, to put back
      if (!d.was) {
        clearTimeout(thrown.current)
        thrown.current = undefined
        d.el.getAnimations().forEach((animation) => animation.cancel())
        d.was = { transform: 'translate(0px, 0px) scale(1, 1)', transition: d.el.style.transition === 'none' ? 'transform 0ms var(--spring), border-radius 0ms var(--spring)' : d.el.style.transition, radius: '0px' }
      }
      screenOf()?.setAttribute('data-dragging', '')
      carried.set(true)
      follow(d)
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
    // A tap is a press that never went anywhere: a swipe that was taken back to where it began is neither
    // a tap nor a swipe up, and does nothing
    const tap = d.reach < 6
    const flick = d.dy <= -6 && (far > 0.22 || speed < -0.4)
    // Along the bar, and hardly up it at all. (Whatever is a swipe up is taken as one first, so this
    // takes nothing from that)
    const along = !flick && Math.abs(d.dx) > 48 && Math.abs(d.dx) > 2.5 * -d.dy
    if (at === 'app' && d.was && flick && e.type !== 'pointercancel') {
      haptic()
      return sendHome(d)
    }
    settle(d)
    if (e.type === 'pointercancel') return
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
    // A swipe along the bar goes to the app that was in front before this one, as it does on an iPhone:
    // to the right brings it back in from the left, and a swipe the other way goes on to it from the right
    const before = sys.get().recents[1]
    if (!along || !before) return
    const screen = screenOf()
    clearTimeout(swept.current)
    screen?.toggleAttribute('data-swept', d.dx > 0)
    swept.current = setTimeout(() => screen?.removeAttribute('data-swept'), SETTLE + 240)
    haptic()
    launch(before)
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
 * company or question where the screen is one, then the app. Nothing on the Lock Screen and the
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
  else if (s.app === 'finder') screen = companyOf(top) ? COMPANIES.find((company) => company.key === companyOf(top))?.name : top === MY_CARD ? SITE.legalName : 'Portfolio'
  else if (s.app === 'notes') screen = top.startsWith('n:') ? FAQS[Number(at)]?.question : top === 'f:faqs' ? 'FAQs' : null
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
  // Left alone for as long as its Auto-Lock says (src/phone/settings.ts), the phone locks itself. Alone means alone: the
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
  // Once the phone is open, and with nothing else going on, the companies' logos are fetched ahead of
  // Contacts being opened: its list then opens with its faces in it
  const opened = useStore(sys, (s) => !s.locked)
  useEffect(() => {
    if (!opened) return
    const t = setTimeout(warmLogos, 1200)
    return () => clearTimeout(t)
  }, [opened])
  // A reload comes back to where the phone was. A screen that names something the visitor made (a note,
  // a folder of theirs) is only there to come back to if that was kept: where it was not, the phone lands
  // on the screen it was opened from
  useLayoutEffect(() => {
    dropLost((app, view) => {
      // A screen from before the portfolio was kept in Contacts (a card of the Wallet, a folder of Files), or a company that is no longer there
      if (app === 'finder') return view !== MY_CARD && companyOf(view) === null
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
