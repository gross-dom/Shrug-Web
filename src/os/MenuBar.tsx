import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { chat, finishChat, replayChat, toggleChat } from '../apps/chat'
import { finder, photos, setFinderView, setMediaFilter, showNote, notes } from '../apps/state'
import { FAQS } from '../data/faqs'
import { SITE } from '../data/site'
import { Popover } from '../kit/motion/Popover'
import { APPS, DOCK_APPS, type AppId } from './apps'
import { formatter } from './dates'
import { dockPoint } from './dom'
import { focusLost } from './focus'
import { askedIdle, saver, setSaverNever, startSaver } from './saver'
import { useStore } from './store'
import { activeApp, bringAllToFront, closeApp, focusApp, focusWindow, minimizeApp, openApp, tileApp, toggleZoom, wm } from './wm'

// The menu bar: Shrug's mark where the system menu goes, the front app's name
// and its menus, and on the right the day and the time. Every item does
// something; nothing is there for show.

type Item =
  /** `says` is the item's name for assistive tech, where its words lean on the heading over it. */
  | { kind: 'item'; label: string; says?: string; run?: () => void; href?: string; checked?: boolean; disabled?: boolean }
  /** A line over a set of choices that says what they are choices of. */
  | { kind: 'heading'; label: string }
  | { kind: 'rule' }

interface MenuDef {
  id: string
  /** What the title says to assistive tech. */
  label: string
  title: ReactNode
  strong?: boolean
  items: Item[]
}

const item = (label: string, run: () => void, more: { checked?: boolean; disabled?: boolean; says?: string } = {}): Item => ({ kind: 'item', label, run, ...more })
const rule: Item = { kind: 'rule' }

const launch = (id: AppId) => openApp(id, dockPoint(id))

function useMenus(): MenuDef[] {
  const active = useStore(wm, activeApp)
  const open = useStore(wm, (s) => DOCK_APPS.concat('about').filter((id) => s.wins[id].open).join(' '))
  const tile = useStore(wm, (s) => (active ? s.wins[active].tile : null))
  const compact = useStore(wm, (s) => s.compact)
  const paused = useStore(chat, (s) => s.paused)
  const done = useStore(chat, (s) => s.done)
  const view = useStore(finder, (s) => s.view)
  const filter = useStore(photos, (s) => s.filter)
  const note = useStore(notes, (s) => s.note)
  const never = useStore(saver, (s) => s.never)
  /** The address sets the screen saver's wait itself (`?idle=20`): that is what it does, whatever was chosen. */
  const idle = askedIdle()
  const spec = active ? APPS[active] : null
  const sizable = !!spec?.resizable && !compact

  const viewItems: Item[] =
    active === 'messages'
      ? [item(paused ? 'Resume Replies' : 'Pause Replies', toggleChat, { disabled: done }), item('Show Every Reply', finishChat, { disabled: done }), rule, item('Play From the Start', replayChat)]
      : active === 'finder'
        ? [item('as Icons', () => setFinderView('icons'), { checked: view === 'icons' }), item('as List', () => setFinderView('list'), { checked: view === 'list' })]
        : active === 'photos'
          ? [
              item('All', () => setMediaFilter('all'), { checked: filter === 'all' }),
              item('Photos', () => setMediaFilter('photo'), { checked: filter === 'photo' }),
              item('Videos', () => setMediaFilter('video'), { checked: filter === 'video' }),
            ]
          : active === 'notes'
            ? [item('Next Question', () => showNote((note + 1) % FAQS.length)), item('Previous Question', () => showNote((note + FAQS.length - 1) % FAQS.length))]
            : []

  const menus: MenuDef[] = [
    {
      id: 'mark',
      label: 'Shrug menu',
      title: (
        <span className="menubar__mark" data-menu-mark>
          {SITE.mark}
        </span>
      ),
      items: [
        item('About Shrug', () => launch('about')),
        rule,
        // The replies can be held from here whatever window is in front, or none
        item(paused ? 'Resume Replies' : 'Pause Replies', toggleChat, { disabled: done }),
        rule,
        item('Start Screen Saver', startSaver),
        { kind: 'heading', label: 'Screen Saver' },
        item(idle ? `After ${idle} Seconds` : 'After 2½ Minutes', () => setSaverNever(false), { checked: idle ? true : !never, says: `Screen Saver: ${idle ? `After ${idle} Seconds` : 'After 2½ Minutes'}` }),
        item('Never', () => setSaverNever(true), { checked: idle ? false : never, disabled: idle !== null, says: 'Screen Saver: Never' }),
        rule,
        { kind: 'item', label: 'One-pager', href: SITE.onePager },
      ],
    },
    {
      id: 'app',
      // With no window open this one is the desk's, and the mark's is the only "Shrug menu"
      label: spec ? `${spec.name} menu` : `${SITE.name} desktop menu`,
      title: spec?.name ?? SITE.name,
      strong: true,
      items: spec && active ? [item(`Hide ${spec.name}`, () => minimizeApp(active, dockPoint(active)), { disabled: !spec.resizable }), item(`Quit ${spec.name}`, () => closeApp(active))] : [item('About Shrug', () => launch('about'))],
    },
    {
      id: 'go',
      label: 'Go menu',
      title: 'Go',
      items: [...DOCK_APPS.map((id) => item(APPS[id].name, () => launch(id))), rule, { kind: 'item', label: 'One-pager', href: SITE.onePager }],
    },
  ]
  if (viewItems.length) menus.push({ id: 'view', label: 'View menu', title: 'View', items: viewItems })
  const shown = open ? (open.split(' ') as AppId[]) : []
  menus.push({
    id: 'window',
    label: 'Window menu',
    title: 'Window',
    items: [
      item('Minimize', () => active && minimizeApp(active, dockPoint(active)), { disabled: !active || !spec?.resizable }),
      item(tile ? 'Restore' : 'Zoom', () => active && toggleZoom(active), { disabled: !sizable }),
      rule,
      item('Fill', () => active && tileApp(active, 'fill'), { disabled: !sizable, checked: tile === 'fill' }),
      item('Left Half', () => active && tileApp(active, 'left'), { disabled: !sizable, checked: tile === 'left' }),
      item('Right Half', () => active && tileApp(active, 'right'), { disabled: !sizable, checked: tile === 'right' }),
      rule,
      item('Bring All to Front', bringAllToFront, { disabled: !shown.length }),
      ...(shown.length ? [rule, ...shown.map((id) => item(APPS[id].name, () => (wm.get().wins[id].minimized ? openApp(id, dockPoint(id)) : focusApp(id)), { checked: id === active }))] : []),
    ],
  })
  return menus
}

function useNow(every = 10_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), every)
    return () => clearInterval(id)
  }, [every])
  return now
}

const DAY = formatter({ weekday: 'short', day: 'numeric', month: 'short' })
const TIME = formatter({ hour: 'numeric', minute: '2-digit' })

export function MenuBar() {
  const menus = useMenus()
  const [open, setOpen] = useState<string | null>(null)
  const bar = useRef<HTMLElement>(null)
  const compact = useStore(wm, (s) => s.compact)
  const now = useNow()

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as Node)) setOpen(null)
    }
    const blur = () => setOpen(null)
    document.addEventListener('pointerdown', away, true)
    window.addEventListener('blur', blur)
    return () => {
      document.removeEventListener('pointerdown', away, true)
      window.removeEventListener('blur', blur)
    }
  }, [open])

  // A menu that would run off the right of a narrow screen slides back onto it
  const width = useStore(wm, (s) => s.viewport.w)
  useLayoutEffect(() => {
    if (!open) return
    const menu = bar.current?.querySelector<HTMLElement>(`[data-menu="${open}"] .menu`)
    if (!menu) return
    menu.style.left = '0px'
    const over = menu.getBoundingClientRect().right - (width - 8)
    if (over > 0) menu.style.left = `${-Math.ceil(over)}px`
  }, [open, width])

  const title = (id: string) => bar.current?.querySelector<HTMLElement>(`[data-menu-title="${id}"]`)

  /** A choice has been made and its menu has gone, and the keyboard with it unless the choice put it
   * somewhere (a window opened, the screen saver came on). Left with nothing, it goes to the window in
   * front, or back to the menu's title. */
  const settle = (id: string) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!focusLost(bar.current?.querySelector(`[data-menu="${id}"] .menu`))) return
        const front = activeApp(wm.get())
        if (front) focusWindow(front)
        else title(id)?.focus({ preventScroll: true })
      }),
    )
  const entries = (id: string) => Array.from(bar.current?.querySelectorAll<HTMLElement>(`[data-menu="${id}"] [data-menu-item]:not([aria-disabled="true"])`) ?? [])

  /** Opens a menu and, from the keyboard, puts focus on its first or last item. */
  const show = (id: string, focus?: 'first' | 'last') => {
    setOpen(id)
    if (!focus) return
    requestAnimationFrame(() => {
      const list = entries(id)
      ;(focus === 'first' ? list[0] : list[list.length - 1])?.focus()
    })
  }

  const step = (from: string, by: number, focus?: 'first') => {
    const at = menus.findIndex((m) => m.id === from)
    const next = menus[(at + by + menus.length) % menus.length]!
    if (open) show(next.id, focus)
    if (!focus) title(next.id)?.focus()
  }

  const onTitleKey = (id: string) => (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      show(id, 'first')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      show(id, 'last')
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      step(id, 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      step(id, -1)
    } else if (e.key === 'Escape') setOpen(null)
  }

  const onMenuKey = (id: string) => (e: KeyboardEvent) => {
    const list = entries(id)
    const at = list.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      list[(at + 1) % list.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      list[(at - 1 + list.length) % list.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      list[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      list[list.length - 1]?.focus()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      step(id, 1, 'first')
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      step(id, -1, 'first')
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(null)
      title(id)?.focus()
    } else if (e.key === 'Tab') setOpen(null)
  }

  return (
    <header
      ref={bar}
      className="menubar"
      data-open={open ? '' : undefined}
      data-compact={compact || undefined}
      onPointerDown={(e) => {
        // A press on the bar itself, off the menus (the clock, the gaps), puts an open menu away
        if (open && !(e.target as HTMLElement).closest('.menubar__menu, .menubar__shade')) setOpen(null)
      }}
    >
      {/* With a menu open, a press anywhere else puts it away and does nothing more: this takes that press,
          so that nothing under it (a window, a Dock icon) does. It goes on the click, not the press: a
          finger's click comes after its press, and would land on whatever was underneath by then */}
      {open && <div className="menubar__shade" aria-hidden onClick={() => setOpen(null)} />}
      <nav className="menubar__menus" aria-label="Menu bar">
        {menus.map((menu) => {
          const shown = open === menu.id
          return (
            <div key={menu.id} className="menubar__menu" data-menu={menu.id} data-strong={menu.strong || undefined}>
              <button
                type="button"
                className="menubar__title"
                data-menu-title={menu.id}
                data-open={shown || undefined}
                aria-haspopup="menu"
                aria-expanded={shown}
                aria-label={menu.label}
                onPointerDown={(e) => {
                  if (e.button !== 0) return
                  e.preventDefault()
                  setOpen(shown ? null : menu.id)
                  e.currentTarget.focus()
                }}
                onPointerEnter={(e) => {
                  if (open && !shown && e.pointerType === 'mouse') setOpen(menu.id)
                }}
                onClick={(e) => {
                  // Assistive tech presses with a click that no pointer made
                  if (e.detail === 0 && !shown) show(menu.id, 'first')
                }}
                onKeyDown={onTitleKey(menu.id)}
              >
                {menu.title}
              </button>
              <Popover show={shown} origin="top left" className="menu" role="menu" aria-label={menu.label} onKeyDown={onMenuKey(menu.id)} {...(shown ? null : ({ inert: '' } as object))}>
                {menu.items.map((entry, i) => {
                  if (entry.kind === 'rule') return <div key={i} className="menu__rule" role="separator" />
                  if (entry.kind === 'heading')
                    return (
                      <div key={i} className="menu__heading" aria-hidden>
                        {entry.label}
                      </div>
                    )
                  const done = () => {
                    setOpen(null)
                    entry.run?.()
                    settle(menu.id)
                  }
                  const body = (
                    <>
                      <span className="menu__tick" aria-hidden>
                        {entry.checked && (
                          <svg viewBox="0 0 12 12" width="11" height="11">
                            <path d="M2.4 6.4l2.5 2.5 4.7-5.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className="menu__label">{entry.label}</span>
                      {entry.href && (
                        <svg className="menu__out" viewBox="0 0 12 12" width="10" height="10" aria-hidden>
                          <path d="M4 3h5v5M9 3L3.2 8.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </>
                  )
                  return entry.href ? (
                    <a
                      key={i}
                      className="menu__item"
                      data-menu-item
                      role="menuitem"
                      href={entry.href}
                      target="_blank"
                      rel="noreferrer"
                      draggable={false}
                      aria-label={`${entry.label}, opens in a new tab`}
                      onClick={() => {
                        setOpen(null)
                        settle(menu.id)
                      }}
                    >
                      {body}
                    </a>
                  ) : (
                    <button
                      key={i}
                      type="button"
                      className="menu__item"
                      data-menu-item
                      role={entry.checked === undefined ? 'menuitem' : 'menuitemradio'}
                      aria-checked={entry.checked === undefined ? undefined : entry.checked}
                      aria-label={entry.says}
                      aria-disabled={entry.disabled || undefined}
                      onClick={entry.disabled ? undefined : done}
                    >
                      {body}
                    </button>
                  )
                })}
              </Popover>
            </div>
          )
        })}
      </nav>
      <div className="menubar__status">
        <time className="menubar__clock" dateTime={now.toISOString()}>
          <span>{DAY.format(now)}</span>
          <span>{TIME.format(now)}</span>
        </time>
      </div>
    </header>
  )
}
