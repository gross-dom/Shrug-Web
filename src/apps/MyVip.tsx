import { useEffect, useRef, useState } from 'react'
import { Window } from '../kit/window'
import { account, askLogIn } from '../os/account'
import { APPS, type AppId } from '../os/apps'
import { AppIcon } from '../os/icons'
import { launchApp } from '../os/launch'
import { useStore } from '../os/store'
import { wm } from '../os/wm'
import { addressOf, StoreFrame, type FrameHandle } from './storefront'

// My VIP: what is a member's, in a window of its own.
//
// Their card, their points and when they arrived, what they have ordered from any of the three stores and
// where each order stands, and the address things are sent to, which every store's checkout reads so that
// it is typed once. (Later: what they have done, ways to earn more, people they have brought.) The stores
// themselves are not in it: ArtStore, Books and Workspace are their own windows, each opening straight on
// what it sells, and the three doors along the head of this one lead to them.
//
// What is in the window is the store's own pages (store/): My VIP's page, and the card's page when the card
// on it is pressed (storefront.tsx). A visitor is shown the doors, and asked to log in for what is theirs.
//
// (A member's card used to come in a pack, torn open here the first time they came. Dom took the pack
// opening out of the product on 26 Nov: the window opens on My VIP's page, for everyone.)

/** The three stores, as My VIP leads to them. */
const DOORS: { app: AppId; says: string }[] = [
  { app: 'store', says: 'Six pieces, in editions of fifty.' },
  { app: 'books', says: 'Five books, two on pre-order.' },
  { app: 'workspace', says: 'The chair, in every color.' },
]

export function MyVipApp() {
  const open = useStore(wm, (s) => s.wins.myvip.open)
  // The frame is made when the window is first opened, and kept: closing the window does not lose their place
  const [made, setMade] = useState(false)
  useEffect(() => {
    if (open && !made) setMade(true)
  }, [open, made])
  const frame = useRef<FrameHandle>(null)
  /** Who is logged in: a change is looked at below. */
  const who = useStore(account, (s) => (s.status === 'member' ? s.email : s.status === 'anon' ? '' : null))
  const [page, setPage] = useState<'card' | 'store'>('store')

  // Someone who logs out while their card's page is showing is taken off it, back to My VIP's own page
  // (which asks a visitor to log in)
  const was = useRef(who)
  useEffect(() => {
    if (who === null || was.current === who) return
    const before = was.current
    was.current = who
    if (before === null || !made) return
    if (account.get().status !== 'member' && page === 'card') frame.current?.to(addressOf('yours'))
  }, [who, made, page])

  // A card has a name on it: someone logged in who has not yet said what they are called is asked, as My VIP
  // opens, before their card is anything to look at
  const nameless = useStore(account, (s) => s.status === 'member' && !s.name.trim())
  useEffect(() => {
    if (open && nameless) askLogIn('name')
  }, [open, nameless])

  const bar = (
    <div className="storebar">
      {/* (its name, set as ArtStore's is in its own bar: the two windows are one family) */}
      <span className="storebar__name">My VIP</span>
      <span className="storebar__says" />
    </div>
  )
  return (
    <Window className="app storewin myvip" lightsSize="large" lead={bar} body={{ className: 'storewin__body myvip__body' }}>
      {/* The ways in to the three stores, over My VIP's own page (and not over the card's) */}
      {page === 'store' && (
        <nav className="myvip__doors" aria-label="The stores">
          {DOORS.map(({ app, says }) => (
            <button key={app} type="button" className="myvip__door" onClick={() => launchApp(app)}>
              <span className="myvip__icon" aria-hidden>
                <AppIcon id={app} />
              </span>
              <span>
                <b>{APPS[app].name}</b>
                <small>{says}</small>
              </span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 3.5 10.5 8 6 12.5" />
              </svg>
            </button>
          ))}
        </nav>
      )}
      {made && (
        <StoreFrame
          ref={frame}
          room="yours"
          title="My VIP"
          onPage={setPage}
        />
      )}
    </Window>
  )
}
