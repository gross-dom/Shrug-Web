import { useEffect, useRef, useState } from 'react'
import { startChat } from '../apps/chat'
import { AboutApp } from '../apps/About'
import { FinderApp } from '../apps/Finder'
import { MessagesApp } from '../apps/Messages'
import { NotesApp } from '../apps/Notes'
import { PhotosApp } from '../apps/Photos'
import { TerminalApp } from '../apps/Terminal'
import { SITE } from '../data/site'
import { arriveIn, PHONE_APPS, startNav, watchHistory, type PhoneApp } from '../phone/nav'
import { startConvo } from '../phone/convo'
import { Phone } from '../phone/Phone'
import { APP_IDS, type AppId } from './apps'
import { Dock } from './Dock'
import { dockPoint } from './dom'
import { DocumentIcon, FolderIcon } from './icons'
import { MenuBar } from './MenuBar'
import { ScreenSaver } from './ScreenSaver'
import { saver, startSaver } from './saver'
import { useStore } from './store'
import { openApp, setViewport, tileRect, wm } from './wm'
import { WindowFrame } from './WindowFrame'

// The desktop: wallpaper, the menu bar, a few things left out on the desk, the
// windows, the Dock, and the screen saver over all of it. The root carries the
// kit's stage class, so every kit part inside reads the same look.
// On a phone-sized screen the same root holds a phone instead: a Home Screen
// of the same apps, each full screen.

const WINDOWS: Record<AppId, () => JSX.Element> = {
  finder: FinderApp,
  messages: MessagesApp,
  notes: NotesApp,
  terminal: TerminalApp,
  photos: PhotosApp,
  about: AboutApp,
}

/** The names a link can ask for: `?open=portfolio,faqs` opens those windows too. */
const ALIASES: Record<string, AppId> = {
  chat: 'messages',
  'group-chat': 'messages',
  portfolio: 'finder',
  faqs: 'notes',
  faq: 'notes',
  'case-studies': 'terminal',
  vip: 'photos',
}

interface DeskItem {
  id: string
  name: string
  icon: JSX.Element
  open: () => void
}

const DESK: DeskItem[] = [
  { id: 'portfolio', name: 'Portfolio', icon: <FolderIcon />, open: () => openApp('finder', dockPoint('finder')) },
  { id: 'one-pager', name: 'One-pager', icon: <DocumentIcon />, open: () => window.open(SITE.onePager, '_blank', 'noopener,noreferrer') },
]

function DeskIcons() {
  const [picked, setPicked] = useState<string | null>(null)
  /** What last pressed an icon: a mouse picks first, a finger or a key opens. */
  const pointer = useRef('')
  useEffect(() => {
    if (!picked) return
    const away = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.desk__item')) setPicked(null)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [picked])
  return (
    <ul className="desk" aria-label="On the desktop">
      {DESK.map((item) => (
        <li key={item.id} className="desk__cell">
          <button
            type="button"
            className="desk__item"
            data-picked={picked === item.id || undefined}
            aria-label={`${item.name}. Double-click to open.`}
            onPointerDown={(e) => {
              pointer.current = e.pointerType
              if (e.pointerType === 'mouse') setPicked(item.id)
            }}
            onClick={(e) => {
              // A mouse picks on the first click and opens on the second; a
              // finger or the keyboard (a click with no count) opens at once
              if (pointer.current !== 'mouse' || e.detail === 0) item.open()
            }}
            onDoubleClick={() => {
              if (pointer.current === 'mouse') item.open()
            }}
          >
            <span className="desk__icon">{item.icon}</span>
            <span className="desk__name">{item.name}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** The outline a dragged window will take if let go against this edge. It
 * sits just under the window being dragged, over the others. */
function TilePreview() {
  const preview = useStore(wm, (s) => s.preview)
  const viewport = useStore(wm, (s) => s.viewport)
  const front = useStore(wm, (s) => s.order.length)
  const [last, setLast] = useState(preview)
  useEffect(() => {
    if (preview) setLast(preview)
  }, [preview])
  const tile = preview ?? last
  const r = tile ? tileRect(tile, viewport, false) : null
  return <div className="tile-preview" data-show={preview ? '' : undefined} style={r ? { left: r.x, top: r.y, width: r.w, height: r.h, zIndex: 9 + front } : undefined} aria-hidden />
}

export function Desktop() {
  const saving = useStore(saver, (s) => s.on)
  const compact = useStore(wm, (s) => s.compact)
  const [booted, setBooted] = useState(false)
  /** The opening has played: the chat is open and under way. */
  const started = useRef(false)

  useEffect(() => {
    const fit = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  // The phone's screens are steps in the browser's history
  useEffect(() => watchHistory(), [])

  // The desk arrives, then the group chat opens out of its icon and begins
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const extra = (query.get('open') ?? '')
      .split(',')
      .map((name) => ALIASES[name.trim().toLowerCase()] ?? name)
      .filter((id): id is AppId => (APP_IDS as string[]).includes(id))
    const quiet = query.has('still')
    const resumed = startNav()
    const t1 = setTimeout(() => setBooted(true), 60)
    const t2 = setTimeout(
      () => {
        started.current = true
        if (wm.get().compact) {
          // A phone is the conversation, with at most one thing open out of it:
          // the last one a link asked for. After a reload it is where it was left.
          const asked = extra.filter((id): id is PhoneApp => (PHONE_APPS as string[]).includes(id)).pop()
          if (!resumed && asked) arriveIn(asked)
          startConvo()
        } else {
          if (!query.has('empty')) openApp('messages', dockPoint('messages'))
          extra.forEach((id) => openApp(id, dockPoint(id)))
          startChat()
        }
        if (query.has('saver') && !wm.get().compact) startSaver()
      },
      quiet ? 0 : 520,
    )
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  // The layout changed under a visit already going: the other one's conversation
  // starts too, and a desktop that has never had a window opens the chat
  useEffect(() => {
    if (!started.current) return
    if (compact) return startConvo()
    startChat()
    const { wins } = wm.get()
    if (!APP_IDS.some((id) => wins[id].mounted)) openApp('messages', dockPoint('messages'))
  }, [compact])

  return (
    <div className="os ss-stage" data-theme="light" data-greys="cool" data-palette="accent" data-fidelity="standard" data-booted={booted || undefined} data-saving={saving || undefined} data-compact={compact || undefined}>
      <div className="os__wallpaper" aria-hidden>
        <div className="os__grain" />
      </div>
      <h1 className="sr-only">Shrug: what people say, the portfolio, FAQs and drops</h1>
      {compact ? (
        <Phone />
      ) : (
        <>
          <MenuBar />
          <DeskIcons />
          <main className="os__windows">
            <TilePreview />
            {APP_IDS.map((id) => {
              const Body = WINDOWS[id]
              return (
                <WindowFrame key={id} id={id}>
                  <Body />
                </WindowFrame>
              )
            })}
          </main>
          <Dock />
        </>
      )}
      <ScreenSaver />
    </div>
  )
}
