import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { PointsMark } from '../../store/src/brand'
import type { Desk, Room, StoreInWindow } from '../../store/src/desk'
import { account, askLogIn, refreshAccount } from '../os/account'
import type { AppId } from '../os/apps'
import { launchApp } from '../os/launch'
import { loadShop } from '../os/shop'
import { useStore } from '../os/store'
import { focusApp } from '../os/wm'

// The store's own pages, in a frame, for whichever of the desk's windows sells something.
//
// There is one store (store/): one catalogue, one checkout, one address on file, one balance of points. On
// the desk it is sold from three places, each with its own things and nothing of the others': art in
// ArtStore, books in Books, chairs in Workspace. What is a member's (their card, their points, orders and
// address) is in a fourth, My VIP. Each of those windows shows the store's pages for its
// own room (`?k=art`, `books`, `chairs`, `yours`), in a frame, so that buying is the same everywhere and
// nothing about it is written twice. The pages are served by this site, at /vip/store/, which is what lets
// one login do for all of them.
//
// What the desk and the pages say to each other is in store/src/desk.ts. The desk leaves `shrugDesk` on its
// own window for every frame to ask of; each frame says which room it is when it speaks.

export const CARD = '/vip/'
export const SHELVES = '/vip/store/'
export type Place = { section: 'store' | 'yours'; product: string | null }
export type { Room }

/** The desk's window for each room. */
export const APP_OF: Record<Room, AppId> = { art: 'store', books: 'books', chairs: 'workspace', yours: 'myvip' }

/** Where a room's pages are: its front, or one product in it. */
export const addressOf = (room: Room, product?: string | null) => `${SHELVES}?k=${room}${product ? `&p=${encodeURIComponent(product)}` : ''}`

// ---- What the desk leaves for the pages in a frame to ask of it

const rooms: Partial<Record<Room, { at: (place: Place) => void; reload: () => void }>> = {}
const desk: Desk = {
  logIn: (why) => askLogIn(why === 'request' ? 'request' : why === 'price' ? 'price' : null),
  // Points were spent in one room, or someone logged out there: the desk's own figures are asked for again,
  // and so is every other room's, since the balance and the orders are the same ones everywhere
  changed: () => {
    void refreshAccount()
    void loadShop()
    for (const room of Object.values(rooms)) room?.reload()
  },
  at: (place, room) => rooms[room]?.at(place),
  open: (room) => launchApp(APP_OF[room]),
}
if (typeof window !== 'undefined') (window as Window & { shrugDesk?: Desk }).shrugDesk = desk

export interface FrameHandle {
  /** Shows a product of this room, or its front. */
  go(product: string | null): void
  /** Takes the frame to another page altogether (back from the card's page to My VIP's). */
  to(src: string): void
  /** Has the pages drawn in a color (Workspace's: a chair's own). */
  tint(color: string | null): void
}

/** A room's pages, in a frame that fills what it is put in. The window it is in is told where the pages are
 * (`onAt`: a product, or the front) and which page the frame has come to (`onPage`: the card's, or the store's). */
export const StoreFrame = forwardRef<FrameHandle, { room: Room; title: string; first?: string; onAt?: (place: Place) => void; onPage?: (page: 'card' | 'store') => void }>(function StoreFrame({ room, title, first, onAt, onPage }, handle) {
  const frame = useRef<HTMLIFrameElement>(null)
  // (who is logged in, and what they are called: the pages show both, a name on a card for one, so they ask
  // the server again when either changes. Someone new gives their name a step after they are logged in)
  const who = useStore(account, (s) => (s.status === 'member' ? `${s.email}|${s.name.trim()}` : s.status === 'anon' ? '' : null))
  const [src] = useState(() => first ?? addressOf(room))
  const page = useRef<'card' | 'store'>('store')
  const heard = useRef({ onAt, onPage })
  heard.current = { onAt, onPage }

  const inside = () => {
    try {
      return frame.current?.contentWindow as (Window & { shrugStore?: StoreInWindow }) | null
    } catch {
      return null
    }
  }
  useImperativeHandle(handle, () => ({
    go(product) {
      const within = inside()
      if (within?.shrugStore && page.current === 'store') within.shrugStore.go({ section: room === 'yours' ? 'yours' : 'store', product })
      else if (frame.current) frame.current.src = addressOf(room, product)
    },
    to(next) {
      if (frame.current) frame.current.src = next
    },
    tint(color) {
      inside()?.shrugStore?.tint(color)
    },
  }))

  useEffect(() => {
    rooms[room] = { at: (place) => heard.current.onAt?.(place), reload: () => inside()?.shrugStore?.reload() }
    return () => {
      delete rooms[room]
    }
  }, [room])

  // Each page the frame comes to: which it is, and what the window needs of it. A press inside the frame is a
  // press on this window, and anything done in there keeps the screen saver away
  const loaded = () => {
    const within = inside()
    if (!within) return
    let path = ''
    try {
      path = within.location.pathname
    } catch {
      return
    }
    page.current = path.startsWith(SHELVES) ? 'store' : 'card'
    heard.current.onPage?.(page.current)
    const stir = () => window.dispatchEvent(new Event('wheel'))
    within.addEventListener('pointerdown', () => (focusApp(APP_OF[room]), stir()), true)
    within.addEventListener('pointermove', stir, { passive: true })
    within.addEventListener('keydown', stir, true)
    within.addEventListener('wheel', stir, { passive: true })
  }

  // Whoever is logged in has changed (the desk's Log In, or Log Out), or what they are called: the pages ask the server again
  const was = useRef(who)
  useEffect(() => {
    if (who === null || was.current === who) return
    const before = was.current
    was.current = who
    if (before !== null) inside()?.shrugStore?.reload()
  }, [who])

  return <iframe ref={frame} className="storewin__frame" title={title} src={src} onLoad={loaded} />
})

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

/** Their points, at the end of a store's bar: the mark and the figure. It opens My VIP, where they are kept.
 * A visitor has none, and nothing is drawn where it would be (Log In is in the menu bar). */
export function Balance({ className = 'storebar__wallet' }: { className?: string }) {
  const points = useStore(account, (s) => (s.status === 'member' ? s.points : null))
  const shown = useCount(points ?? 0)
  if (points === null) return <span />
  return (
    <button type="button" className={className} aria-label={`Your balance: ${points.toLocaleString('en-US')} points. My VIP`} onClick={() => launchApp('myvip')}>
      <PointsMark size={16} />
      <span aria-hidden>{shown.toLocaleString('en-US')}</span>
    </button>
  )
}
