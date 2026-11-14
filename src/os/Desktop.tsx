import { useEffect, useState } from 'react'
import { startChat } from '../apps/chat'
import { AboutApp } from '../apps/About'
import { FinderApp } from '../apps/Finder'
import { MessagesApp } from '../apps/Messages'
import { NotesApp } from '../apps/Notes'
import { PhotosApp } from '../apps/Photos'
import { TerminalApp } from '../apps/Terminal'
import { SITE } from '../data/site'
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

const WINDOWS: Record<AppId, () => JSX.Element> = {
  finder: FinderApp,
  messages: MessagesApp,
  notes: NotesApp,
  terminal: TerminalApp,
  photos: PhotosApp,
  about: AboutApp,
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
              // A finger opens on the first tap; a mouse picks, then opens on the second
              if (e.pointerType === 'mouse') setPicked(item.id)
            }}
            onClick={(e) => {
              const mouse = (e.nativeEvent as PointerEvent).pointerType === 'mouse'
              if (!mouse) item.open()
            }}
            onDoubleClick={item.open}
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

  useEffect(() => {
    const fit = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  // The desk arrives, then the group chat opens out of the Dock and begins
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const extra = (query.get('open') ?? '').split(',').filter((id): id is AppId => (APP_IDS as string[]).includes(id))
    const quiet = query.has('still')
    const t1 = setTimeout(() => setBooted(true), 60)
    const t2 = setTimeout(
      () => {
        if (!query.has('empty')) openApp('messages', dockPoint('messages'))
        extra.forEach((id) => openApp(id, dockPoint(id)))
        startChat()
        if (query.has('saver')) startSaver()
      },
      quiet ? 0 : 520,
    )
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  return (
    <div className="os ss-stage" data-theme="light" data-greys="cool" data-palette="accent" data-fidelity="standard" data-booted={booted || undefined} data-saving={saving || undefined} data-compact={compact || undefined}>
      <div className="os__wallpaper" aria-hidden>
        <div className="os__ribbon os__ribbon--a" />
        <div className="os__ribbon os__ribbon--b" />
        <div className="os__ribbon os__ribbon--c" />
        <div className="os__grain" />
      </div>
      <h1 className="sr-only">Shrug: what people say, the portfolio, FAQs and drops</h1>
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
      <ScreenSaver />
    </div>
  )
}
