import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { startChat } from '../apps/chat'
import { arriveIn, startSystem, watchHistory } from '../phone/system'
import { APP_IDS, type AppId } from './apps'
import { dockPoint } from './dom'
import { saver, startSaver } from './saver'
import { useStore } from './store'
import { openApp, setViewport, wm } from './wm'

// The site's root: the wallpaper, and over it either the desktop (the menu
// bar, the desk, the windows, the Dock) or, on a phone-sized screen or when
// the address asks with `?phone`, an iPhone with the same apps, each redrawn as
// its iOS counterpart (src/phone). The root carries the kit's stage class, so
// every kit part inside reads the same look.
//
// The two are separate downloads: a visitor gets the one their screen shows.
// Whichever that is starts loading at once, alongside this file.

const load = {
  surface: () => import('./Surface'),
  phone: () => import('../phone/Phone').then((m) => ({ default: m.Phone })),
}

/** What this screen shows first, already on its way. */
const first = wm.get().compact ? load.phone() : load.surface()

const Surface = lazy(load.surface)
const Phone = lazy(load.phone)

/** The names a link can ask for: `?open=portfolio,faqs` opens those windows too. */
const ALIASES: Record<string, AppId> = {
  chat: 'messages',
  'group-chat': 'messages',
  portfolio: 'finder',
  files: 'finder',
  settings: 'about',
  faqs: 'notes',
  faq: 'notes',
  'case-studies': 'terminal',
  vip: 'photos',
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
    // A phone picks up where a reload left it; a new visit starts on its Lock Screen
    const resumed = startSystem()
    let gone = false
    let t1: ReturnType<typeof setTimeout> | undefined
    let t2: ReturnType<typeof setTimeout> | undefined
    const open = () => {
      if (gone) return
      t1 = setTimeout(() => setBooted(true), 60)
      t2 = setTimeout(
        () => {
          started.current = true
          if (wm.get().compact) {
            // A link that names an app arrives with it open (the last one named), and the phone unlocked
            const asked = extra.pop()
            if (!resumed && asked) arriveIn(asked)
          } else {
            if (!query.has('empty')) openApp('messages', dockPoint('messages'))
            extra.forEach((id) => openApp(id, dockPoint(id)))
          }
          // The group chat plays whichever is showing: on a phone its replies arrive as notifications
          startChat()
          if (query.has('saver') && !wm.get().compact) startSaver()
        },
        quiet ? 0 : 520,
      )
    }
    // Once what this screen shows has arrived and been drawn: the chat opens out of a Dock that is there
    void first.then(
      () => requestAnimationFrame(() => requestAnimationFrame(open)),
      () => open(),
    )
    return () => {
      gone = true
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  // The layout changed under a visit already going: the other one's conversation
  // starts too, and a desktop that has never had a window opens the chat
  useEffect(() => {
    if (!started.current || compact) return
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
      <Suspense fallback={null}>{compact ? <Phone /> : <Surface />}</Suspense>
    </div>
  )
}
