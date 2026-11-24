import { useEffect, useRef, useState } from 'react'
import { PointsMark, Wordmark } from '../../store/src/brand'
import type { Desk, StoreInWindow } from '../../store/src/desk'
import { Window } from '../kit/window'
import { account, askLogIn, refreshAccount } from '../os/account'
import { createStore, useStore } from '../os/store'
import { focusApp, wm } from '../os/wm'

// The VIP Store, as a window (design/v1, "VIP Store").
//
// The store is the one already written (store/): its own pages, drawn by its own code and its own
// stylesheet, in a frame, so that nothing about how it looks is said twice. They are served by this site, at
// /vip/store/ (tools/store.mjs builds them into the desktop's own build), which is what lets one login do
// for both: the frame is this page's own site.
//
// What the window adds is its bar, where a Mac app keeps such things: one row with the traffic lights, the
// store's name at its head, Store and My VIP as a switch in the middle, and the balance at the far end.
// (That is a Mac's unified toolbar. Apple's guidance for a Mac is a segmented control in the toolbar to
// switch views, as Calendar and Activity Monitor do, so the switch is not a line further down.) The pages
// in the frame are drawn without a bar of their own (store/src/desk.ts).
//
// The pack: the first time someone logged in comes to the store in this browser, the frame shows the card's
// page instead (/vip/), with the pack hanging and its strip loose. It asks for no code: the desk has already
// logged them in. Torn, their card is there, and "Go to the store" under it leads on.

const CARD = '/vip/'
const SHELVES = '/vip/store/'

type Place = { section: 'store' | 'yours'; product: string | null }

/** A product another app has asked the store to open on (a door: Workspace's Buy, a link in a message). */
export const storeDoor = createStore<{ product: string | null; n: number }>({ product: null, n: 0 })
export const openProduct = (product: string) => storeDoor.set((s) => ({ product, n: s.n + 1 }))

// ---- What the desk leaves for the pages in the frame to ask of it (store/src/desk.ts)

const heard = { at: (_place: Place) => {}, changed: () => {} }
const desk: Desk = {
  logIn: (why) => askLogIn(why === 'request' ? 'request' : null),
  changed: () => {
    refreshAccount()
    heard.changed()
  },
  at: (place) => heard.at(place),
}
if (typeof window !== 'undefined') (window as Window & { shrugDesk?: Desk }).shrugDesk = desk

// ---- The pack is opened once to a browser, for each person who logs in on it

const packKey = (email: string) => `shrug:pack:${email.toLowerCase()}`
function packDue(email: string) {
  try {
    return window.localStorage.getItem(packKey(email)) === null
  } catch {
    return false
  }
}
function packShown(email: string) {
  try {
    window.localStorage.setItem(packKey(email), String(Date.now()))
  } catch {
    // No storage: it plays again next time, which is no harm
  }
}

const addressOf = (place: Place) => `${SHELVES}${place.section === 'yours' ? '?s=yours' : place.product ? `?p=${encodeURIComponent(place.product)}` : ''}`

/** A number that counts to where it is going, as the balance does when something is bought. */
function useCount(to: number) {
  const [shown, setShown] = useState(to)
  const from = useRef(to)
  useEffect(() => {
    const start = from.current
    from.current = to
    if (start === to || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setShown(to)
    const began = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / 600)
      setShown(Math.round(start + (to - start) * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [to])
  return shown
}

function Balance({ points, onOpen }: { points: number; onOpen: () => void }) {
  const shown = useCount(points)
  return (
    <button type="button" className="storebar__wallet" aria-label={`Your balance: ${points.toLocaleString('en-US')} points. My VIP`} onClick={onOpen}>
      <PointsMark size={16} />
      <span aria-hidden>{shown.toLocaleString('en-US')}</span>
    </button>
  )
}

export function StoreApp() {
  const open = useStore(wm, (s) => s.wins.store.open)
  // The frame is made when the window is first opened, and kept: closing the window does not lose their place
  const [made, setMade] = useState(false)
  useEffect(() => {
    if (open) setMade(true)
  }, [open])
  return (
    <Window className="app storewin" lightsSize="large" lead={made ? <Bar /> : <span className="storebar" />} body={{ className: 'storewin__body' }}>
      {made && <Frame />}
    </Window>
  )
}

// The bar and the frame are two parts of one window that know the same things: where the store is, and how
// to send it somewhere. They are kept between them here.
const shown = createStore<{ view: 'pack' | 'store'; place: Place }>({ view: 'store', place: { section: 'store', product: null } })
const go: { to: (place: Place) => void } = { to: () => {} }

function Bar() {
  const { view, place } = useStore(shown, (s) => s)
  const who = useStore(account, (s) => s)
  const member = who.status === 'member' ? who : null
  const tab = (section: Place['section'], label: string) => (
    <button type="button" aria-current={view === 'store' && place.section === section ? 'page' : undefined} onClick={() => go.to({ section, product: null })}>
      {label}
    </button>
  )
  return (
    <div className="storebar">
      <span className="storebar__mark">
        <Wordmark lockup="store" height={14} />
      </span>
      <nav className="storebar__seg" aria-label="Sections">
        {tab('store', 'Store')}
        {tab('yours', 'My VIP')}
      </nav>
      {/* A visitor has no balance, and nothing is drawn where one would be: Log In is in the menu bar */}
      {member ? <Balance points={member.points} onOpen={() => go.to({ section: 'yours', product: null })} /> : <span />}
    </div>
  )
}

function Frame() {
  const frame = useRef<HTMLIFrameElement>(null)
  const who = useStore(account, (s) => (s.status === 'member' ? s.email : s.status === 'anon' ? '' : null))
  const door = useStore(storeDoor, (s) => s)
  // Where the frame begins: the pack, for someone logged in who has not had it in this browser; otherwise the
  // store, on the product another app asked for if one did
  const [src] = useState(() => {
    const now = account.get()
    if (now.status === 'member' && packDue(now.email)) return CARD
    return addressOf({ section: 'store', product: storeDoor.get().product })
  })

  const inside = () => {
    try {
      return frame.current?.contentWindow as (Window & { shrugStore?: StoreInWindow }) | null
    } catch {
      return null
    }
  }
  const send = (place: Place) => {
    const page = inside()
    if (page?.shrugStore && shown.get().view === 'store') page.shrugStore.go(place)
    else if (frame.current) frame.current.src = addressOf(place)
  }
  go.to = send

  useEffect(() => {
    heard.at = (place) => shown.set({ view: 'store', place })
    return () => {
      heard.at = () => {}
    }
  }, [])

  // Each page the frame comes to: which it is (the pack, or the store), and what the window needs of it. A
  // press inside the frame is a press on this window, and anything done in there keeps the screen saver away
  const loaded = () => {
    const page = inside()
    if (!page) return
    let path = ''
    try {
      path = page.location.pathname
    } catch {
      return
    }
    const pack = !path.startsWith(SHELVES)
    if (pack) {
      shown.set((s) => ({ ...s, view: 'pack' }))
      const now = account.get()
      if (now.status === 'member') packShown(now.email)
    } else shown.set((s) => ({ ...s, view: 'store' }))
    const stir = () => window.dispatchEvent(new Event('wheel'))
    page.addEventListener('pointerdown', () => (focusApp('store'), stir()), true)
    page.addEventListener('pointermove', stir, { passive: true })
    page.addEventListener('keydown', stir, true)
    page.addEventListener('wheel', stir, { passive: true })
  }

  // Whoever is logged in has changed (the desk's Log In, or Log Out): the pages in the frame ask the server
  // again. Someone who has just logged in, with the store's front showing, gets their pack
  const was = useRef(who)
  useEffect(() => {
    if (who === null || was.current === who) return
    const before = was.current
    was.current = who
    if (before === null) return
    const now = account.get()
    const { view, place } = shown.get()
    if (now.status === 'member' && packDue(now.email) && view === 'store' && place.section === 'store' && !place.product && frame.current) frame.current.src = CARD
    else if (view === 'pack' && frame.current) frame.current.src = addressOf({ section: 'store', product: null })
    else inside()?.shrugStore?.reload()
  }, [who])

  // A door from another app: the store opens on that product
  const knocked = useRef(door.n)
  useEffect(() => {
    if (door.n === knocked.current) return
    knocked.current = door.n
    if (door.product) send({ section: 'store', product: door.product })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [door.n])

  return <iframe ref={frame} className="storewin__frame" title="VIP Store" src={src} onLoad={loaded} />
}
