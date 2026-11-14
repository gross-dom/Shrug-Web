import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { chat, QUESTION, TOTAL } from '../apps/chat'
import { PersonAvatar } from '../apps/chat-ui'
import { PEOPLE } from '../data/people'
import { SITE } from '../data/site'
import { Count } from '../kit/motion/Count'
import { Notification } from '../kit/phone'
import { APPS, type AppId } from '../os/apps'
import { AppIcon, DocumentIcon } from '../os/icons'
import { saver } from '../os/saver'
import { useStore } from '../os/store'
import { wm } from '../os/wm'
import { useUnread } from '../apps/state'
import { viewOf } from './apps'
import { openPhoneApp, phone, topScreen, type IconRect, type Screen } from './nav'
import { ViewContext } from './ui'

// The site on a phone: a Home Screen of the same apps, each opening full
// screen out of its icon the way an iPhone opens one. It is drawn edge to
// edge and leaves the status bar and the home indicator to the real phone.

const DOCKED: AppId[] = ['finder', 'messages', 'notes', 'photos']
const ON_GRID: AppId[] = ['terminal', 'about']

function HomeIcon({ id, badge }: { id: AppId; badge?: number }) {
  return (
    <button type="button" className="ph-icon" aria-label={`${APPS[id].name}${badge ? `, ${badge} unread` : ''}`} onClick={() => openPhoneApp(id)}>
      <span className="ph-icon__tile" data-home-app={id}>
        <AppIcon id={id} />
        {badge ? <span className="ph-icon__badge">{badge}</span> : null}
      </span>
      <span className="ph-icon__name">{id === 'about' ? 'About' : APPS[id].name}</span>
    </button>
  )
}

/** The group chat as a widget: how many have replied, and the newest of them. */
function ChatWidget() {
  const replied = useStore(chat, (s) => s.replied)
  const latest = replied > 0 ? PEOPLE[replied - 1]! : null
  return (
    <button type="button" className="ph-widget" aria-label={`Group chat: ${replied} of ${TOTAL} have replied`} onClick={() => openPhoneApp('messages', ['list', 'thread:group'])}>
      <span className="ph-widget__head">
        <span className="ph-widget__icon">
          <AppIcon id="messages" />
        </span>
        <span className="ph-widget__app">Group chat</span>
        <span className="ph-widget__count">
          <Count value={replied} /> of {TOTAL}
        </span>
      </span>
      <span className="ph-widget__ask">{QUESTION[1]}</span>
      {latest ? (
        <span className="ph-widget__reply" key={replied}>
          <PersonAvatar index={replied - 1} size={30} />
          <span className="ph-widget__text">
            <b>{latest.name}</b>
            <span>{latest.quote ?? latest.role}</span>
          </span>
        </span>
      ) : (
        <span className="ph-widget__reply ph-widget__reply--waiting">Waiting on {TOTAL} people…</span>
      )}
    </button>
  )
}

function Home({ covered }: { covered: boolean }) {
  const unread = useUnread()
  return (
    <div className="ph-home" data-covered={covered || undefined} {...(covered ? ({ inert: '' } as object) : null)}>
      <div className="ph-home__top">
        <div className="ph-home__mark" aria-hidden>
          {SITE.mark}
        </div>
        <div className="ph-home__name">{SITE.legalName}</div>
      </div>
      <ChatWidget />
      <div className="ph-grid">
        {ON_GRID.map((id) => (
          <HomeIcon key={id} id={id} />
        ))}
        <a className="ph-icon" href={SITE.onePager} target="_blank" rel="noreferrer" aria-label="One-pager (opens in a new tab)">
          <span className="ph-icon__tile ph-icon__tile--doc">
            <DocumentIcon />
          </span>
          <span className="ph-icon__name">One-pager</span>
        </a>
      </div>
      <nav className="ph-dock" aria-label="Dock">
        {DOCKED.map((id) => (
          <HomeIcon key={id} id={id} badge={id === 'messages' ? unread : undefined} />
        ))}
      </nav>
    </div>
  )
}

interface Layer {
  view: string
  depth: number
  exit: boolean
}

/** An app's views, one over another. The one that was just left stays for its way out. */
function Views({ app, views }: { app: AppId; views: string[] }) {
  const key = views.join('\n')
  const [seen, setSeen] = useState({ key, views })
  const [exiting, setExiting] = useState<Layer | null>(null)
  /** Views there when the app opened arrive with it; later ones slide in. */
  const arrived = useRef(new Map<string, boolean>())
  const mounted = useRef(false)

  if (seen.key !== key) {
    const was = seen.views
    setSeen({ key, views })
    // Stepped back: what was on top leaves, over the view it uncovers
    const popped = views.length < was.length && views.every((view, i) => view === was[i])
    setExiting(popped ? { view: was[views.length]!, depth: views.length, exit: true } : null)
  }

  useEffect(() => {
    mounted.current = true
  }, [])

  useEffect(() => {
    if (!exiting) return
    const timer = setTimeout(() => setExiting(null), 460)
    return () => clearTimeout(timer)
  }, [exiting])

  // A view that has gone is forgotten: pushed again, it slides in again
  useEffect(() => {
    const here = new Set(views.map((view, depth) => `${depth}:${view}`))
    if (exiting) here.add(`${exiting.depth}:${exiting.view}`)
    for (const id of Array.from(arrived.current.keys())) if (!here.has(id)) arrived.current.delete(id)
  })

  const layers: Layer[] = views.map((view, depth) => ({ view, depth, exit: false }))
  if (exiting && exiting.depth >= views.length) layers.push(exiting)
  const live = layers.filter((l) => !l.exit)

  return (
    <>
      {layers.map((layer, i) => {
        const id = `${layer.depth}:${layer.view}`
        if (!arrived.current.has(id)) arrived.current.set(id, mounted.current)
        const { kind, node } = viewOf(app, layer.view)
        const above = layer.exit ? null : live[i + 1]
        const cover = above ? viewOf(app, above.view).kind : null
        const top = !layer.exit && !above
        return (
          <div key={id} className="ph-view" data-kind={kind} data-enter={arrived.current.get(id) || undefined} data-exit={layer.exit || undefined} data-covered={cover ?? undefined} {...(top ? null : ({ inert: '' } as object))}>
            <ViewContext.Provider value={{ depth: layer.depth, top }}>{node}</ViewContext.Provider>
          </div>
        )
      })}
    </>
  )
}

/** An app, full screen: it grows out of its icon and shrinks back into it. */
function AppHost({ app, views, state, origin }: { app: AppId; views: string[]; state: 'open' | 'closing' | 'under'; origin: IconRect | null }) {
  const viewport = useStore(wm, (s) => s.viewport)
  const from = origin ?? { x: viewport.w / 2 - 30, y: viewport.h / 2 - 30, w: 60, h: 60 }
  // Shrunk to its icon's width about the point that puts its top left on the icon's
  const k = Math.min(0.9, from.w / Math.max(1, viewport.w))
  const style = {
    '--il': `${from.x}px`,
    '--it': `${from.y}px`,
    '--ir': `${Math.max(0, viewport.w - from.x - from.w)}px`,
    '--ib': `${Math.max(0, viewport.h - from.y - from.h)}px`,
    '--ox': `${from.x / (1 - k)}px`,
    '--oy': `${from.y / (1 - k)}px`,
    '--scale': k.toFixed(4),
  } as CSSProperties
  return (
    <section className="ph-app" data-app={app} data-state={state} style={style} aria-label={APPS[app].name} {...(state === 'open' ? null : ({ inert: '' } as object))}>
      <div className="ph-app__zoom">
        <Views app={app} views={views} />
      </div>
    </section>
  )
}

/** How many banners a visit gets, how far apart, and how long each stays. */
const BANNERS = { most: 3, apart: 20000, stay: 3800 }

/** A reply landing while the conversation isn't on screen drops in as a
 * banner: a few of them, well apart, not one for each of ninety replies. A
 * tap opens the conversation; a flick up sends the banner away. */
function Banners() {
  const replied = useStore(chat, (s) => s.replied)
  const inMessages = useStore(phone, (s) => topScreen(s)?.app === 'messages')
  const locked = useStore(saver, (s) => s.on)
  const [banner, setBanner] = useState<{ index: number; out: boolean } | null>(null)
  const lastAt = useRef(-Infinity)
  const shown = useRef(0)
  const before = useRef(replied)
  const pressedAt = useRef<number | null>(null)
  const quiet = inMessages || locked
  const hush = useRef(quiet)
  hush.current = quiet

  // Only a reply that lands now: not the ones that were already there
  useEffect(() => {
    const fresh = replied > before.current
    before.current = replied
    if (!fresh || hush.current || chat.get().done || shown.current >= BANNERS.most) return
    const now = performance.now()
    if (now - lastAt.current < BANNERS.apart) return
    lastAt.current = now
    shown.current++
    setBanner({ index: replied - 1, out: false })
  }, [replied])

  // It stays a few seconds, then lifts away; opening the conversation clears it at once
  useEffect(() => {
    if (!banner) return
    if (quiet) return setBanner(null)
    const timer = setTimeout(() => setBanner((b) => (b && !b.out ? { ...b, out: true } : null)), banner.out ? 340 : BANNERS.stay)
    return () => clearTimeout(timer)
  }, [banner, quiet])

  if (!banner) return null
  const person = PEOPLE[banner.index]!
  const dismiss = () => setBanner((b) => (b && !b.out ? { ...b, out: true } : b))
  return (
    <button
      type="button"
      className="ph-banner"
      data-out={banner.out || undefined}
      aria-label={`New reply from ${person.name}. Open the conversation.`}
      onPointerDown={(e) => {
        pressedAt.current = e.clientY
      }}
      onPointerMove={(e) => {
        if (pressedAt.current !== null && e.clientY - pressedAt.current < -12) {
          pressedAt.current = null
          dismiss()
        }
      }}
      onClick={() => {
        // A flick has already sent it away: that isn't a tap
        if (banner.out) return
        setBanner(null)
        openPhoneApp('messages', ['list', 'thread:group'])
      }}
    >
      <Notification icon={<AppIcon id="messages" />} title={person.name} body={person.quote ?? person.role} />
    </button>
  )
}

export function Phone() {
  const stack = useStore(phone, (s) => s.stack)
  const leaving = useStore(phone, (s) => s.leaving)
  const origin = useStore(phone, (s) => s.origin)
  const root = useRef<HTMLDivElement>(null)
  const app = stack[0]?.app ?? null
  const leavingApp = leaving?.[0]?.app ?? null

  // The keyboard takes the bottom of the screen: the phone keeps to what is left
  useEffect(() => {
    const vv = window.visualViewport
    const el = root.current
    if (!vv || !el) return
    const fit = () => {
      el.style.setProperty('--vv-h', `${vv.height}px`)
      el.style.setProperty('--vv-top', `${vv.offsetTop}px`)
    }
    fit()
    vv.addEventListener('resize', fit)
    vv.addEventListener('scroll', fit)
    return () => {
      vv.removeEventListener('resize', fit)
      vv.removeEventListener('scroll', fit)
    }
  }, [])

  const hosts: { app: AppId; screens: Screen[]; state: 'open' | 'closing' | 'under' }[] = []
  if (leaving && leavingApp && leavingApp !== app) hosts.push({ app: leavingApp, screens: leaving, state: app ? 'under' : 'closing' })
  if (app) hosts.push({ app, screens: stack, state: 'open' })

  return (
    <div ref={root} className="ph" data-open={app ?? undefined}>
      <Home covered={!!app} />
      {hosts.map((host) => (
        <AppHost key={host.app} app={host.app} views={host.screens.map((s) => s.view)} state={host.state} origin={origin} />
      ))}
      <Banners />
    </div>
  )
}
