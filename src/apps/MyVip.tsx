import { useEffect, useRef, useState } from 'react'
import { Window } from '../kit/window'
import { account, askLogIn } from '../os/account'
import { APPS, type AppId } from '../os/apps'
import { AppIcon } from '../os/icons'
import { launchApp } from '../os/launch'
import { useStore } from '../os/store'
import { wm } from '../os/wm'
import { addressOf, PACK, StoreFrame, type FrameHandle } from './storefront'

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
  // Where the frame begins is decided when the window is first opened, by who is logged in then (someone
  // whose account was made a moment ago, at a checkout, has a pack to open): the pack, for someone logged in
  // who has not had it in this browser; otherwise My VIP
  const [first, setFirst] = useState(() => addressOf('yours'))
  useEffect(() => {
    if (!open || made) return
    const now = account.get()
    // (a pack has its owner's name in its window: someone who has not said what they are called yet is asked
    // first, below, and their pack hangs once they have)
    setFirst(now.status === 'member' && now.name.trim() && packDue(now.email) ? PACK : addressOf('yours'))
    setMade(true)
  }, [open, made])
  const frame = useRef<FrameHandle>(null)
  /** Who is logged in, and whether they have said what they are called: a change in either is looked at below. */
  const who = useStore(account, (s) => (s.status === 'member' ? `${s.email}|${s.name.trim() ? 'named' : ''}` : s.status === 'anon' ? '' : null))
  const [page, setPage] = useState<'pack' | 'store'>('store')

  // Someone who has just logged in (and said what they are called), with My VIP's own page showing, gets
  // their pack; someone who logs out while the pack is showing is taken off it
  const was = useRef(who)
  useEffect(() => {
    if (who === null || was.current === who) return
    const before = was.current
    was.current = who
    if (before === null || !made) return
    const now = account.get()
    if (now.status === 'member' && now.name.trim() && packDue(now.email) && page === 'store') frame.current?.to(PACK)
    else if (now.status !== 'member' && page === 'pack') frame.current?.to(addressOf('yours'))
  }, [who, made, page])

  // A card has a name on it: someone logged in who has not yet said what they are called is asked, as My VIP
  // opens, before their pack or their card is anything to look at
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
