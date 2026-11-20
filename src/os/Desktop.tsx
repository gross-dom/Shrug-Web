import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from 'react'
import { startChat } from '../apps/chat'
import { finder, inbox, notes, photos, showInGroup } from '../apps/state'
import { MY_CARD } from '../phone/apps/routes'
import { arriveIn, onPhone, startSystem, unlock, watchHistory } from '../phone/system'
import { asked, isOn, opens, says } from './address'
import { Boundary } from './Boundary'
import { cross, showOnDesk, spotOfDesk } from './crossing'
import { keepDesk, restoreDesk, returning } from './deskmemory'
import { dockPoint } from './dom'
import { addressable, addressOf, personAt, placeOfSpot } from './place'
import { saver, startSaver } from './saver'
import { Arriving, Stalled, unfetched } from './Stalled'
import { useStore } from './store'
import { WALLPAPERS } from '../data/wallpapers'
import { DeskWallpaper } from './DeskWallpaper'
import { wallpaper } from './wallpaper'
import { openApp, PHONE_UNDER, setViewport, wm } from './wm'

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

type Half = keyof typeof load

/** Each half is asked for once and that one asking is what everything waits on: asked for twice, the
 * second would not wait for its stylesheet (it counts as seen) and the phone would be drawn bare. A
 * half that did not arrive is forgotten, so that another go asks afresh. */
const asking: { [H in Half]?: Promise<{ default: ComponentType }> } = {}
function fetchHalf(half: Half): Promise<{ default: ComponentType }> {
  const going =
    asking[half] ??
    (load[half]() as Promise<{ default: ComponentType }>).catch((error: unknown) => {
      delete asking[half]
      throw error
    })
  asking[half] = going
  return going
}

/** What this screen shows first, already on its way. */
const first = fetchHalf(wm.get().compact ? 'phone' : 'surface')

/** The two as React draws them. Made afresh for another go, when one would not arrive. */
const parts = () => ({ Surface: lazy(() => fetchHalf('surface')), Phone: lazy(() => fetchHalf('phone')) })

/** The half this screen is not showing, fetched once the one it is showing has settled: a window dragged
 * narrow or a tablet turned then has it to hand, connection or none. Not on a screen that could never show it
 * (a phone has no desktop), nor for a visitor who has asked their browser to save data. */
const fetchOther = () => {
  const { compact } = wm.get()
  const long = Math.max(window.screen.width, window.screen.height)
  const short = Math.min(window.screen.width, window.screen.height)
  if (compact && (long < PHONE_UNDER.w || short < PHONE_UNDER.h)) return
  if ((navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return
  void fetchHalf(compact ? 'surface' : 'phone').catch(() => {})
}

/** What the address this visit arrived on asks for: the apps it names, and what is open in the last of
 * them (`?open=portfolio&at=varda`: src/os/place.ts). Read once, as the page loads, because the address
 * is rewritten from then on to follow the visitor. */
const LINKED = { apps: opens(), at: asked('at'), about: says('about') }

interface Boot {
  done(): void
  styled(then: () => void): void
}
const boot = () => (window as { __shrugBoot?: Boot }).__shrugBoot

/** The site is drawn: the loading screen in index.html gives way to it. */
const landed = () => boot()?.done()

/** The site's stylesheet is on. The built page fetches it without holding up the loading screen
 * (tools/page.ts), so the site can be running before it is dressed: nothing is measured or shown until it is. */
const styled = () => new Promise<void>((resolve) => (boot() ? boot()!.styled(resolve) : resolve()))

export function Desktop() {
  const saving = useStore(saver, (s) => s.on)
  const compact = useStore(wm, (s) => s.compact)
  const showing = useStore(wallpaper, (s) => WALLPAPERS[s.at]!.id)
  const [booted, setBooted] = useState(false)
  const [part, setPart] = useState(parts)
  /** Why there is nothing to draw: half of the site did not arrive, or it fell over. */
  const [failure, setFailure] = useState<'fetch' | 'crash'>('fetch')
  /** The opening has played: the chat is open and under way. */
  const started = useRef(false)
  /** The same, as something to draw on: the desk is as the visit found it, and can be kept from here on. */
  const [settled, setSettled] = useState(false)

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
    const { apps: extra, at } = LINKED
    const named = extra[extra.length - 1]
    const quiet = isOn('still')
    // A phone picks up where a reload left it; a new visit starts on its Lock Screen. A link that names
    // an app arrives in it (the last one named) with the phone already unlocked: no Lock Screen first,
    // and for the chat, the conversation itself
    const resumed = startSystem()
    if (wm.get().compact && !resumed && named) {
      if (onPhone(named)) {
        const { stack, sheet } = placeOfSpot({ app: named, at })
        arriveIn(named, stack, sheet)
        // A link to one person's reply: the conversation opens at what they said
        const who = named === 'messages' ? personAt(at) : null
        if (who !== null) showInGroup(who)
      }
      // An app the phone does not have. About Shrug is the desktop's: who Shrug is, on a phone, is on Shrug's
      // own card in Contacts, so that is where a link to it arrives. (Settings, which an old link may still
      // name, is nowhere on the phone: its Home Screen, unlocked)
      else if (LINKED.about) arriveIn('finder', [MY_CARD])
      else unlock()
    }
    let gone = false
    let t1: ReturnType<typeof setTimeout> | undefined
    let t2: ReturnType<typeof setTimeout> | undefined
    let t3: ReturnType<typeof setTimeout> | undefined
    const open = () => {
      if (gone) return
      landed()
      t1 = setTimeout(() => setBooted(true), 60)
      t2 = setTimeout(
        () => {
          started.current = true
          // A reload brings the desk back as it was left (src/os/deskmemory.ts). A visit beginning opens the
          // conversation, and the windows its link names, the last of them showing what the link says
          if (!wm.get().compact && !(returning() && restoreDesk())) {
            if (!isOn('empty')) openApp('messages', dockPoint('messages'))
            if (named) showOnDesk({ app: named, at })
            extra.forEach((id) => openApp(id, dockPoint(id)))
          }
          setSettled(true)
          // The group chat plays whichever is showing: on a phone its replies arrive as notifications
          startChat()
          if (isOn('saver') && !wm.get().compact) startSaver()
        },
        quiet ? 0 : 520,
      )
      t3 = setTimeout(fetchOther, 6000)
    }
    // Once what this screen shows has arrived and been drawn: the chat opens out of a Dock that is there
    void Promise.all([first, styled()]).then(
      () => requestAnimationFrame(() => requestAnimationFrame(open)),
      () => open(),
    )
    return () => {
      gone = true
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [])

  // On the desktop the address names the window in front and what it is showing, so a link copied from it
  // opens there (the iPhone's does the same as it moves: src/phone/system.ts), and the desk is kept for a reload
  useEffect(() => {
    if (!settled || compact) return
    const stopKeeping = keepDesk()
    let last = ''
    const tell = () => {
      if (!addressable()) return
      const address = addressOf(spotOfDesk())
      if (address === last) return
      last = address
      try {
        history.replaceState(history.state, '', address)
      } catch {
        // An address the page may not write: it keeps the one it has
      }
    }
    const stops = [wm, finder, notes, inbox, photos].map((store) => store.subscribe(tell))
    tell()
    return () => {
      stopKeeping()
      stops.forEach((stop) => stop())
    }
  }, [settled, compact])

  // The layout changed under a visit already going: the visitor is put where
  // they were in the other one, and its conversation starts too
  useEffect(() => {
    if (!started.current) return
    cross(compact)
    if (!compact) startChat()
  }, [compact])

  return (
    <div className="os ss-stage" data-theme="light" data-greys="cool" data-palette="accent" data-fidelity="standard" data-booted={booted || undefined} data-saving={saving || undefined} data-compact={compact || undefined} data-wallpaper={showing}>
      <div className="os__wallpaper" aria-hidden>
        <DeskWallpaper />
        <div className="os__grain" />
      </div>
      {/* The page's own heading: in a banner, so that nothing on the page sits outside a landmark */}
      <header className="sr-only">
        <h1>Shrug: what people say, the portfolio, FAQs and drops</h1>
      </header>
      {/* One for each: a size change away from the half that failed puts the other back as it was */}
      <Boundary
        key={compact ? 'phone' : 'desk'}
        onError={(error) => {
          const missing = unfetched(error)
          setFailure(missing ? 'fetch' : 'crash')
          // Asked for again the next time its turn comes, where the browser will ask again
          if (missing) setPart(parts())
        }}
        fallback={(retry) => <Stalled kind={failure} onRetry={retry} />}
      >
        <Suspense fallback={<Arriving />}>{compact ? <part.Phone /> : <part.Surface />}</Suspense>
      </Boundary>
    </div>
  )
}
