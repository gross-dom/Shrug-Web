import { useEffect, useRef, useState } from 'react'
import { Window } from '../kit/window'
import { createStore, useStore } from '../os/store'
import { wm } from '../os/wm'
import { Balance, StoreFrame, type FrameHandle } from './storefront'

// ArtStore, as a window (it was the VIP Store: design/v1, "VIP Store").
//
// It sells the art, and only the art: six pieces, each in an edition of fifty. What is in the window is the
// store already written (store/), its own pages in a frame (storefront.tsx), on the art's shelf. Books are
// sold in Books and chairs in Workspace, and what is a member's (the pack, their card, points, orders and
// address) is in My VIP: nothing of those is here, so the window opens straight on the art.
//
// What the window adds is its bar, where a Mac app keeps such things: one row with the traffic lights, the
// store's name at its head, and the member's balance at the far end, which opens My VIP. (A Mac's unified
// toolbar. There is no switch in it any more: there is one section here.)

/** A product another app has asked this store to open on (a door: a link in a message). */
export const storeDoor = createStore<{ product: string | null; n: number }>({ product: null, n: 0 })
export const openProduct = (product: string) => storeDoor.set((s) => ({ product, n: s.n + 1 }))

export function StoreApp() {
  const open = useStore(wm, (s) => s.wins.store.open)
  // The frame is made when the window is first opened, and kept: closing the window does not lose their place
  const [made, setMade] = useState(false)
  useEffect(() => {
    if (open) setMade(true)
  }, [open])
  const frame = useRef<FrameHandle>(null)
  const [at, setAt] = useState<string | null>(null)

  // A door from another app: the store opens on that product
  const door = useStore(storeDoor, (s) => s)
  const knocked = useRef(door.n)
  useEffect(() => {
    if (door.n === knocked.current) return
    knocked.current = door.n
    if (door.product) frame.current?.go(door.product)
  }, [door.n, door.product])

  const bar = (
    <div className="storebar">
      <button type="button" className="storebar__name" aria-label="ArtStore: everything in it" aria-current={at ? undefined : 'page'} onClick={() => frame.current?.go(null)}>
        ArtStore
      </button>
      <span className="storebar__says">Six pieces. Fifty of each.</span>
      <Balance />
    </div>
  )
  return (
    <Window className="app storewin" lightsSize="large" lead={bar} body={{ className: 'storewin__body' }}>
      {made && <StoreFrame ref={frame} room="art" title="ArtStore" first={storeDoor.get().product ? `/vip/store/?k=art&p=${encodeURIComponent(storeDoor.get().product!)}` : undefined} onAt={(place) => setAt(place.product)} />}
    </Window>
  )
}
