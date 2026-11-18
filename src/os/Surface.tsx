import { useEffect, useRef, useState } from 'react'
import { AboutApp } from '../apps/About'
import { FinderApp } from '../apps/Finder'
import { MessagesApp } from '../apps/Messages'
import { NotesApp } from '../apps/Notes'
import { PhotosApp } from '../apps/Photos'
import { TerminalApp } from '../apps/Terminal'
import { SITE } from '../data/site'
import { APPS, APP_IDS, type AppId } from './apps'
import { Boundary } from './Boundary'
import { Dock } from './Dock'
import { dockPoint } from './dom'
import { focusFirst } from './focus'
import { DocumentIcon, FolderIcon } from './icons'
import { MenuBar } from './MenuBar'
import { saver } from './saver'
import { ScreenSaver } from './ScreenSaver'
import { useStore } from './store'
import { setTitle } from './title'
import { activeApp, focusWindow, openApp, tileRect, wm } from './wm'
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
  /** What it is, after its name, for assistive tech. */
  says: string
  icon: JSX.Element
  open: () => void
}

const DESK: DeskItem[] = [
  {
    id: 'portfolio',
    name: 'Portfolio',
    says: 'desktop icon',
    icon: <FolderIcon />,
    open: () => {
      openApp('finder', dockPoint('finder'))
      // The window that was asked for takes the keyboard, as it does from the Dock
      focusWindow('finder')
    },
  },
  { id: 'one-pager', name: 'One-pager', says: 'desktop icon, opens in a new tab', icon: <DocumentIcon />, open: () => window.open(SITE.onePager, '_blank', 'noopener,noreferrer') },
]

function DeskIcons() {
  const [picked, setPicked] = useState<string | null>(null)
  /** What last pressed an icon, and whether that icon was already picked when it did. */
  const press = useRef({ pointer: '', again: false })
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
            aria-label={`${item.name}, ${item.says}`}
            onPointerDown={(e) => {
              press.current = { pointer: e.pointerType, again: picked === item.id }
              if (e.pointerType === 'mouse') setPicked(item.id)
            }}
            onClick={(e) => {
              // A mouse picks an icon with one click and opens it with the
              // next, however long after (a double-click is the two together);
              // a finger or the keyboard (a click with no count) opens at once
              const { pointer, again } = press.current
              if (pointer !== 'mouse' || e.detail === 0 || again) item.open()
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

/** F6 steps between the three places a keyboard works in: the menu bar, the window in front, the Dock.
 * Shift goes the other way. Without it, Tab has to walk every control of every open window to get from
 * one to the next. */
function stepRegion(back: boolean) {
  const front = document.querySelector<HTMLElement>('.wf[data-active]')
  const stops = [document.querySelector('.menubar [data-menu-title]'), front ? (front.querySelector('[data-autofocus]') ?? front) : null, document.querySelector('.dock [data-dock-item]')]
  const held = document.activeElement
  const at = held?.closest('.menubar') ? 0 : held?.closest('.wf') ? 1 : held?.closest('.dock') ? 2 : back ? 0 : -1
  focusFirst(...[1, 2, 3].map((n) => stops[(((at + (back ? -n : n)) % 3) + 3) % 3]))
}

/** Select All takes in the window in front and no more: not the windows behind it, the Dock's names or the desk's. */
function selectFront() {
  const content = document.querySelector('.wf[data-active] .wf__content')
  const selection = window.getSelection()
  if (!content || !selection) return
  const range = document.createRange()
  range.selectNodeContents(content)
  selection.removeAllRanges()
  selection.addRange(range)
}

/** The desktop's surface. */
export default function Surface() {
  const saving = useStore(saver, (s) => s.on)
  const front = useStore(wm, activeApp)

  // The page's title names the window in front; the bare desk and the screen saver are the site's own
  useEffect(() => setTitle(!saving && front ? APPS[front].name : null), [front, saving])
  useEffect(() => () => setTitle(), [])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (saver.get().on) return
      if (e.key === 'F6' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        stepRegion(e.shiftKey)
      } else if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'a') {
        // A field selects its own words, as ever
        if ((e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable="true"]')) return
        e.preventDefault()
        selectFront()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  // On a tablet the keyboard can leave the page nudged up after it has gone:
  // once no field has the caret, the page is put back
  useEffect(() => {
    if (!window.matchMedia('(any-pointer: coarse)').matches) return
    const field = (el: unknown) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
    let timer: ReturnType<typeof setTimeout>
    const left = (e: FocusEvent) => {
      if (!field(e.target)) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!field(document.activeElement) && (window.scrollX || window.scrollY)) window.scrollTo(0, 0)
      }, 80)
    }
    window.addEventListener('focusout', left)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focusout', left)
    }
  }, [])

  return (
    <>
      {/* Under the screen saver the desk is out of reach: of a pointer, of the keyboard and of a screen reader alike */}
      <div className="os__desk" {...(saving ? ({ inert: '' } as object) : null)}>
        <MenuBar />
        <main className="os__windows">
          <DeskIcons />
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
      </div>
      <ScreenSaver />
    </>
  )
}
