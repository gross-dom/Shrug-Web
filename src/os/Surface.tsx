import { useEffect, useRef, useState } from 'react'
import { AboutApp } from '../apps/About'
import { FinderApp } from '../apps/Finder'
import { MailApp } from '../apps/Mail'
import { MessagesApp } from '../apps/Messages'
import { NotesApp } from '../apps/Notes'
import { PreviewApp } from '../apps/Preview'
import { StoreApp } from '../apps/Store'
import { TerminalApp } from '../apps/Terminal'
import { UpdatesApp } from '../apps/Updates'
import { WallpapersApp } from '../apps/Wallpapers'
import { account, askLogIn, unlocked } from './account'
import { APPS, APP_IDS, type AppId } from './apps'
import { Boundary } from './Boundary'
import { Dock } from './Dock'
import { dockPoint } from './dom'
import { focusFirst } from './focus'
import { FolderIcon, OnePagerIcon } from './icons'
import { MenuBar } from './MenuBar'
import { Notifications } from './Notifications'
import { openOnePager } from './papers'
import { SanFrancisco } from './SanFrancisco'
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
  about: AboutApp,
  wallpapers: WallpapersApp,
  updates: UpdatesApp,
  store: StoreApp,
  preview: PreviewApp,
  mail: MailApp,
}

interface DeskItem {
  id: string
  name: string
  /** What it is, after its name, for assistive tech. */
  says: string
  icon: JSX.Element
  /** A line under it while it is picked: what it is, where its icon alone does not say. */
  tip?: string
  open: () => void
}

/** What is left out on the desk, down its right-hand side, in this order (design/v1/DESIGN.md, section 3). The
 * Updates folder is first: it is always there, locked to everyone but Shrug's LPs. Portfolio is in the Dock. */
function useDesk(): DeskItem[] {
  const who = useStore(account, (s) => (s.status === 'member' ? (s.roles.includes('LP') ? 'lp' : 'member') : s.status === 'checking' ? 'checking' : 'nobody'))
  const locked = who !== 'lp'
  return [
    {
      id: 'updates',
      name: 'Updates',
      says: locked ? 'desktop icon, locked' : 'desktop icon',
      icon: <FolderIcon locked={locked} />,
      tip: who === 'lp' ? undefined : who === 'member' ? 'For Shrug’s LPs.' : 'For Shrug’s LPs. Log in to open.',
      open: () => {
        // Nobody logged in: the folder lets down Log In, which says what it was opened for. Someone logged
        // in is shown the window: what is theirs, or, for someone who is not an LP, who it is for
        if (account.get().status !== 'member') return askLogIn('updates')
        openApp('updates', dockPoint('updates'))
        focusWindow('updates')
      },
    },
    // A file: it opens in Preview (it was a link to a page elsewhere)
    { id: 'one-pager', name: 'One-pager', says: 'desktop icon', icon: <OnePagerIcon />, open: openOnePager },
    {
      id: 'wallpapers',
      name: 'Wallpapers',
      says: 'desktop icon',
      icon: <FolderIcon />,
      open: () => {
        // It has no icon in the Dock to open out of: it opens out of its own, here on the desk (dockPoint)
        openApp('wallpapers', dockPoint('wallpapers'))
        focusWindow('wallpapers')
      },
    },
  ]
}

function DeskIcons() {
  const [picked, setPicked] = useState<string | null>(null)
  const items = useDesk()
  // An LP who has just logged in is shown their folder: it is picked, as the note beside it says it is open
  const opened = useStore(unlocked, (s) => s?.at ?? 0)
  useEffect(() => {
    if (opened) setPicked('updates')
  }, [opened])
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
      {items.map((item) => (
        <li key={item.id} className="desk__cell">
          <button
            type="button"
            className="desk__item"
            data-desk={item.id}
            data-picked={picked === item.id || undefined}
            aria-label={`${item.name}, ${item.says}`}
            aria-describedby={item.tip ? `desk-tip-${item.id}` : undefined}
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
          {item.tip && (
            <span className="desk__tip" id={`desk-tip-${item.id}`} role="tooltip">
              {item.tip}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Said once, beside the desk's icons, when an LP has just logged in: their folder is open to them. It goes by itself. */
function Unlocked() {
  const note = useStore(unlocked, (s) => s)
  useEffect(() => {
    if (!note) return
    const timer = setTimeout(() => unlocked.set(null), 6500)
    return () => clearTimeout(timer)
  }, [note])
  if (!note) return null
  const count = ['No documents', 'One document', 'Two documents', 'Three documents', 'Four documents', 'Five documents'][note.docs] ?? `${note.docs} documents`
  return (
    <button type="button" className="desk-note" onClick={() => (unlocked.set(null), openApp('updates', dockPoint('updates')), focusWindow('updates'))}>
      <span className="desk-note__icon">
        <FolderIcon />
      </span>
      <span role="status">
        <b>Updates is unlocked</b>
        {note.docs ? `${count} written for your funds.` : 'Documents written for your funds will appear here.'}
      </span>
    </button>
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
          <Unlocked />
          <SanFrancisco />
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
        <Notifications />
        <Dock />
      </div>
      <ScreenSaver />
    </>
  )
}
