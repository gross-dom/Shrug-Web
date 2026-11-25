import { useEffect, useRef, useState } from 'react'
import { Wordmark } from '../../store/src/brand'
import { Window } from '../kit/window'
import { account } from '../os/account'
import { APPS, type AppId } from '../os/apps'
import { AppIcon } from '../os/icons'
import { launchApp } from '../os/launch'
import { useStore } from '../os/store'
import { wm } from '../os/wm'
import { addressOf, Balance, CARD, StoreFrame, type FrameHandle } from './storefront'

// My VIP: what is a member's, in a window of its own.
//
// Their pack is opened here (the first time someone logged in comes to it, in this browser), and their card
// is under it. After that it is where their points are and when they arrived, what they have ordered from
// any of the three stores and where each order stands, and the address things are sent to, which every
// store's checkout reads so that it is typed once. (Later: what they have done, ways to earn more, people
// they have brought.) The stores themselves are not in it: ArtStore, Books and Workspace are their own
// windows, each opening straight on what it sells, and the three doors along the head of this one lead to them.
//
// What is in the window is the store's own pages (store/): the card's page for the pack, and My VIP's page
// for the rest (storefront.tsx). A visitor is shown the doors, and asked to log in for what is theirs.

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
    if (open) setMade(true)
  }, [open])
  const frame = useRef<FrameHandle>(null)
  const who = useStore(account, (s) => (s.status === 'member' ? s.email : s.status === 'anon' ? '' : null))
  const [page, setPage] = useState<'pack' | 'store'>('store')
  // Where the frame begins: the pack, for someone logged in who has not had it in this browser; otherwise My VIP
  const [first] = useState(() => {
    const now = account.get()
    return now.status === 'member' && packDue(now.email) ? CARD : addressOf('yours')
  })

  // Someone who has just logged in, with My VIP's own page showing, gets their pack; someone who logs out
  // while the pack is showing is taken off it
  const was = useRef(who)
  useEffect(() => {
    if (who === null || was.current === who) return
    const before = was.current
    was.current = who
    if (before === null || !made) return
    const now = account.get()
    if (now.status === 'member' && packDue(now.email) && page === 'store') frame.current?.to(CARD)
    else if (now.status !== 'member' && page === 'pack') frame.current?.to(addressOf('yours'))
  }, [who, made, page])

  const bar = (
    <div className="storebar">
      {/* (the window's name is its mark: MY VIP, and nothing is said again in the middle of the bar) */}
      <span className="storebar__mark">
        <Wordmark lockup="my" height={14} />
      </span>
      <span className="storebar__says" />
      <Balance />
    </div>
  )
  return (
    <Window className="app storewin myvip" lightsSize="large" lead={bar} body={{ className: 'storewin__body myvip__body' }}>
      {/* The ways in to the three stores: once the pack is opened, and for anyone who has no pack to open */}
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
          first={first}
          onPage={(now) => {
            setPage(now)
            const me = account.get()
            if (now === 'pack' && me.status === 'member') packShown(me.email)
          }}
        />
      )}
    </Window>
  )
}
