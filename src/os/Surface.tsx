import { useEffect, useRef, useState } from 'react'
import { AboutApp } from '../apps/About'
import { FinderApp } from '../apps/Finder'
import { MessagesApp } from '../apps/Messages'
import { NotesApp } from '../apps/Notes'
import { PhotosApp } from '../apps/Photos'
import { TerminalApp } from '../apps/Terminal'
import { SITE } from '../data/site'
import { APP_IDS, type AppId } from './apps'
import { Boundary } from './Boundary'
import { Dock } from './Dock'
import { dockPoint } from './dom'
import { DocumentIcon, FolderIcon } from './icons'
import { MenuBar } from './MenuBar'
import { ScreenSaver } from './ScreenSaver'
import { useStore } from './store'
import { openApp, tileRect, wm } from './wm'
import { WindowFrame } from './WindowFrame'

// Everything on the desktop but its wallpaper: the menu bar, the things left
// out on the desk, the windows, the Dock, and the screen saver over them. It
// is loaded on its own, so a phone never downloads it.

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

/** The desktop's surface. */
export default function Surface() {
  return (
    <>
      <MenuBar />
      <DeskIcons />
      <main className="os__windows">
        <TilePreview />
        {APP_IDS.map((id) => {
          const Body = WINDOWS[id]
          return (
            <WindowFrame key={id} id={id}>
              {/* A window that fails says so, and the rest of the desktop carries on */}
              <Boundary
                fallback={(retry) => (
                  <div className="window-failed" role="alert">
                    <p>This window ran into a problem.</p>
                    <button type="button" className="window-failed__retry" onClick={retry}>
                      Try Again
                    </button>
                  </div>
                )}
              >
                <Body />
              </Boundary>
            </WindowFrame>
          )
        })}
      </main>
      <Dock />
      <ScreenSaver />
    </>
  )
}
