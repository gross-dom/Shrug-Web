import { useCallback, useEffect, useRef, useState } from 'react'
import { fmtPoints, onShelf, shelfOf } from '../shared/rules'
import { CARD, DEMO, server, shopOf, type Backend, type Placed, type Shop, type StoreAnswer } from './backend'
import { PointsMark, Wordmark } from './brand'
import { demo, demoAddPoints, demoPick, demoReset, demoScene, demoSetScene, demoSignIn, PEOPLE, SCENES } from './demo'
import { DESK, type Room, type StoreInWindow } from './desk'
import { Lock, NoCloud } from './icons'
import { Picture, Price, ProductView, type Go } from './Product'
import { Visiting } from './visiting'
import { badgeOf } from './words'
import { YoursView } from './Yours'

// The store. Two sections under one bar: the store itself (a display of everything in it, pictures first,
// and a screen for each product) and My VIP (the address still says ?s=yours, as links already sent do).
// Updates are not shown here any more: Shrug has them elsewhere. (The server still answers with them, for
// whatever reads them.) The card (the site's front page) is where a member signs in; these pages show what
// the server says is theirs, and ask it for everything they do. A visitor, who has not signed in, is shown
// the store all the same: what is for everyone, at its price, with the way to sign in where a member's
// balance would be.
//
// As a window of the desktop (desk.ts) the same pages are drawn without their bar, which the window draws
// as its own, and Log In is the desk's.

const backend: Backend = DEMO ? demo : server

/** Which of the desk's windows this is, by the address it was opened at (?k=): one of the three stores, which
 * shows its own shelf and nothing else, or My VIP, which shows what is the member's and no shelf at all. On
 * its own site (no window) there is none: the whole store, and My VIP beside it, as before. */
const ROOM: Room | null = (() => {
  const asked = new URLSearchParams(window.location.search).get('k')
  return asked === 'yours' ? 'yours' : shelfOf(asked)
})()
const SHELF = ROOM === 'yours' ? null : ROOM
/** What each window calls itself. */
const NAMES: Record<Room, string> = { art: 'ArtStore', books: 'Books', chairs: 'Workspace', yours: 'My VIP' }

type Section = 'store' | 'yours'
interface Place {
  section: Section
  /** The product on screen, in the store. */
  product: string | null
}

/** Where an address says the page is: /store/?p=<id> is a product, and ?s=yours is My VIP. (An old link to ?s=updates lands on the store.) */
function placeOf(search: string): Place {
  const asked = new URLSearchParams(search)
  const section = asked.get('s')
  return { section: ROOM === 'yours' || (section === 'yours' && !ROOM) ? 'yours' : 'store', product: asked.get('p') }
}
/** (a window's address keeps which window it is) */
const addressOf = (place: Place) => {
  const said = [ROOM ? `k=${ROOM}` : '', place.section !== 'store' && !ROOM ? `s=${place.section}` : '', place.section === 'store' && place.product ? `p=${encodeURIComponent(place.product)}` : ''].filter(Boolean).join('&')
  return said ? `?${said}` : './'
}

/** A phone's layout, under 740px across. */
function usePhone() {
  const [phone, setPhone] = useState(() => window.matchMedia('(max-width: 739px)').matches)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 739px)')
    const told = () => setPhone(query.matches)
    query.addEventListener('change', told)
    return () => query.removeEventListener('change', told)
  }, [])
  return phone
}

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

/** The balance at the right of the bar: the points mark, and their points. It goes to My VIP (where their card is, and the way to it). */
function Wallet({ shop, spent, onOpen }: { shop: Shop; spent: number; onOpen: () => void }) {
  const me = shop.member
  const points = useCount(me.points)
  return (
    <a className="ui-wallet" href="?s=yours" aria-label={`Your balance: ${fmtPoints(me.points)} points. My VIP`} onClick={(e) => (e.preventDefault(), onOpen())}>
      <span className="pts-n">
        <PointsMark size={16} />
        {fmtPoints(points)}
      </span>
      {spent > 0 && <span className="ui-delta">&minus;{fmtPoints(spent)}</span>}
    </a>
  )
}

/** Where a member signs in: the card's page, asked to go straight to signing in and then back to the store. */
const SIGN_IN = `${CARD}?signin=store`

/** Where a member's balance would be, for a visitor: the way to sign in. */
const SignIn = () => (
  <a className="ui-btn sec sm" href={SIGN_IN}>
    Sign in
  </a>
)

function Sections({ at, go }: { at: Section; go: (section: Section) => void }) {
  const link = (section: Section, label: string) => (
    <a href={addressOf({ section, product: null })} aria-current={at === section ? 'page' : undefined} onClick={(e) => (e.preventDefault(), go(section))}>
      {label}
    </a>
  )
  return (
    <nav className="ui-seg" aria-label="Sections">
      {link('store', 'Store')}
      {link('yours', 'My VIP')}
    </nav>
  )
}

/** The display: everything in the store, pictures first. Nothing is bought from here; each is a way in to its own screen. */
function Display({ shop, phone, open }: { shop: Shop; phone: boolean; open: (id: string) => void }) {
  const products = shop.products
  if (!products.length)
    return DESK ? (
      <main className="ui-door">
        <h2 className="t-h2">Nothing here yet</h2>
        <p className="t-words">New pieces land here first. We’ll email you when one does.</p>
      </main>
    ) : (
      <main className={phone ? 'up-body' : 'ui-display'}>
        <div className="ui-gate">
          <h2 className="t-h2">Nothing in the store just now.</h2>
          <p className="t-words">We’ll email you when something new arrives.</p>
        </div>
      </main>
    )
  const list = (
    <ol className="ui-shop">
      {products.map((product) => {
        const badge = badgeOf(product, shop.orders)
        return (
          <li key={product.id}>
            <a className="ui-prod" href={`?p=${encodeURIComponent(product.id)}`} onClick={(e) => (e.preventDefault(), open(product.id))}>
              <span className="ui-prod-pic">
                <Picture product={product} size={phone ? 26 : 44} tile />
                {badge && <span className={`ui-badge${badge.tone ? ` ${badge.tone}` : ''}`}>{badge.text}</span>}
              </span>
              <span className="ui-prod-cap">
                <span>
                  <b>{product.name}</b>
                  <small>{product.kind}</small>
                </span>
                <span className="r">
                  <Price product={product} />
                </span>
              </span>
            </a>
          </li>
        )
      })}
    </ol>
  )
  // The bar says where this is (Shrug VIP Store): the page itself goes straight to what is in it
  return phone ? (
    <main className="up-body" style={{ paddingBottom: 28 }}>
      <h1 className="sr">{SHELF ? NAMES[SHELF] : 'Shrug VIP Store'}</h1>
      {list}
    </main>
  ) : (
    <main className="ui-display">
      <h1 className="sr">{SHELF ? NAMES[SHELF] : 'Shrug VIP Store'}</h1>
      {list}
    </main>
  )
}

/** The demo's own controls: who is looking, more points, and the states that cannot otherwise be got to. Never in the real store. */
function DemoTab({ signedIn, onChange }: { signedIn: boolean; onChange: () => void }) {
  const [pick, setPick] = useState(demoPick())
  const [scene, setScene] = useState(demoScene())
  return (
    <details className="demo">
      <summary>Demo</summary>
      <div className="demo__box" role="group" aria-label="Demo controls">
        <span>Nothing is sent, and no money moves.</span>
        <label>
          Viewing as
          <select
            value={signedIn ? pick : ''}
            onChange={(e) => {
              if (!e.target.value) return
              setPick(e.target.value)
              demoSignIn(e.target.value)
              onChange()
            }}
          >
            {!signedIn && <option value="">Choose…</option>}
            {Object.entries(PEOPLE).map(([key, person]) => (
              <option key={key} value={key}>
                {person.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Show
          <select value={scene} onChange={(e) => (setScene(e.target.value), demoSetScene(e.target.value), onChange())}>
            {Object.entries(SCENES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div>
          <button type="button" disabled={!signedIn} onClick={() => (demoAddPoints(5000), onChange())}>
            +5,000 points
          </button>
          <button type="button" onClick={() => (demoReset(), setScene('normal'), onChange())}>
            Start again
          </button>
        </div>
        <button type="button" onClick={(e) => (e.currentTarget.closest('details')!.open = false)}>
          Close
        </button>
      </div>
    </details>
  )
}

export function App() {
  const phone = usePhone()
  const [answer, setAnswer] = useState<StoreAnswer | { status: 'loading' } | { status: 'down' }>({ status: 'loading' })
  const [place, setPlace] = useState<Place>(() => placeOf(window.location.search))
  /** Points spent this visit, shown beside the balance. */
  const [spent, setSpent] = useState(0)

  const load = useCallback(async () => {
    const got = await backend.store()
    setAnswer('error' in got ? { status: 'down' } : got)
  }, [])
  useEffect(() => {
    load()
    // Back from the card, or from another tab: the balance may have moved
    const again = () => document.visibilityState === 'visible' && load()
    const back = () => setPlace(placeOf(window.location.search))
    document.addEventListener('visibilitychange', again)
    window.addEventListener('pageshow', again)
    window.addEventListener('popstate', back)
    return () => {
      document.removeEventListener('visibilitychange', again)
      window.removeEventListener('pageshow', again)
      window.removeEventListener('popstate', back)
    }
  }, [load])

  const move = (next: Place) => {
    // In a window of the desk the browser's history is the desk's: the address follows, and nothing is added to it
    if (addressOf(next) !== addressOf(place)) window.history[DESK ? 'replaceState' : 'pushState'](null, '', addressOf(next))
    setPlace(next)
    window.scrollTo(0, 0)
  }
  // The desk is told where the store is (its bar shows it), and is left the two things it asks: to go
  // somewhere, and to ask the server again when whoever is logged in has changed
  const mover = useRef(move)
  mover.current = move
  useEffect(() => {
    if (ROOM) DESK?.at({ section: place.section, product: place.product }, ROOM)
  }, [place.section, place.product])
  useEffect(() => {
    if (!DESK) return
    const here = window as Window & { shrugStore?: StoreInWindow }
    here.shrugStore = { go: (to) => mover.current({ section: ROOM === 'yours' || (to.section === 'yours' && !ROOM) ? 'yours' : 'store', product: to.product }), reload: load }
    return () => {
      delete here.shrugStore
    }
  }, [load])
  const go: Go = (to) => {
    // From a store's window, My VIP is another window; from My VIP's, the store is (the desk opens it)
    if (DESK && ROOM && ROOM !== 'yours' && to.view === 'yours') return DESK.open('yours')
    if (DESK && ROOM === 'yours' && to.view !== 'yours') return DESK.open('art')
    move(to.view === 'product' ? { section: 'store', product: to.id } : { section: to.view === 'yours' ? 'yours' : 'store', product: null })
  }
  const signout = async () => {
    await backend.signout()
    // In a window, who is logged in is the desk's to say: it is told, and asks these pages to look again
    if (DESK) return DESK.changed()
    window.location.assign(CARD)
  }
  const placed = (done: Placed) => {
    setSpent((n) => n + done.order.points)
    load()
    DESK?.changed()
  }

  const visiting = answer.status === 'visitor'
  const all = answer.status === 'member' ? answer : answer.status === 'visitor' ? shopOf(answer) : null
  // What this window sells: its own shelf of what they are shown. (My VIP is drawn from everything: an order
  // is of whatever it was, from whichever store)
  const shop = all && { ...all, products: onShelf(all.products, SHELF) }
  const product = shop && place.section === 'store' ? (shop.products.find((p) => p.id === place.product) ?? null) : null
  const storeName = SHELF ? NAMES[SHELF] : 'Store'
  useEffect(() => {
    const names: Record<Section, string> = { store: product ? product.name : storeName, yours: 'My VIP' }
    document.title = `${names[place.section]} · Shrug VIP`
  }, [place.section, product, storeName])

  let body: JSX.Element
  /** What a visitor is told where only a member's things are: My VIP. */
  const door = (
    <div className="ui-gate">
      <span className="ui-thumb lg">
        <Lock />
      </span>
      <h2 className="t-h2">Sign in to come in.</h2>
      <p className="t-words">This part is for members. New here? Open your pack first.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, paddingTop: 6 }}>
        <a className="ui-btn fit" href={SIGN_IN}>
          Sign in
        </a>
        <a className="ui-btn sec fit" href={CARD}>
          Open your pack
        </a>
      </div>
    </div>
  )
  if (shop && visiting && place.section !== 'store') {
    body = DESK ? (
      // In a window: My VIP is a door to the desk's Log In
      <main className="ui-door">
        <h1 className="sr">Shrug VIP: My VIP</h1>
        <Lock />
        <h2 className="t-h2">Log in to see My VIP</h2>
        <p className="t-words">Your card, your orders and the address on file live here.</p>
        <button type="button" className="ui-btn fit" onClick={() => DESK!.logIn('store')}>
          Log In
        </button>
      </main>
    ) : (
      <main className={phone ? 'up-body' : 'ui-display'}>
        <h1 className="sr">Shrug VIP: My VIP</h1>
        {door}
      </main>
    )
  } else if (shop) {
    body =
      place.section === 'yours' ? (
        <YoursView shop={all!} phone={phone} backend={backend} onChange={load} onSignOut={signout} />
      ) : product ? (
        <ProductView key={product.id} shop={shop} visiting={visiting} product={product} phone={phone} backend={backend} go={go} onPlaced={placed} />
      ) : (
        <Display shop={shop} phone={phone} open={(id) => go({ view: 'product', id })} />
      )
  } else {
    const gate =
      answer.status === 'loading' ? (
        <div className="ui-gate" aria-busy="true" aria-label="Opening the store">
          <div style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ height: 120, borderRadius: 16, background: '#222226' }} />
            <div style={{ height: 18, width: '60%', borderRadius: 6, background: '#222226' }} />
            <div style={{ height: 18, width: '40%', borderRadius: 6, background: '#222226' }} />
          </div>
        </div>
      ) : answer.status === 'down' && DESK ? (
        <main className="ui-door">
          <NoCloud />
          <h2 className="t-h2">The store isn’t answering</h2>
          <p className="t-words">Nothing was charged. Check your connection and try again.</p>
          <button type="button" className="ui-btn fit" onClick={() => (setAnswer({ status: 'loading' }), load())}>
            Try Again
          </button>
        </main>
      ) : answer.status === 'down' ? (
        <div className="ui-gate">
          <span className="ui-thumb lg">
            <NoCloud />
          </span>
          <h2 className="t-h2">The store didn’t answer.</h2>
          <div style={{ paddingTop: 6 }}>
            <button type="button" className="ui-btn fit" onClick={() => (setAnswer({ status: 'loading' }), load())}>
              Try again
            </button>
          </div>
        </div>
      ) : (
        door
      )
    body = (
      <main className={phone ? 'up-body' : 'ui-display'}>
        <h1 className="sr">Shrug VIP: the store</h1>
        {gate}
      </main>
    )
  }

  const mark = (
    <a className="ui-mark" href="./" onClick={(e) => (e.preventDefault(), move({ section: 'store', product: null }))}>
      <Wordmark lockup="store" height={phone ? 12 : 14} />
    </a>
  )
  // A product is one screen and does not scroll; everything else on a phone is a page, as long as it is
  const oneScreen = !!shop && !!product
  // In a window of the desk: the pages alone, sized to the window. The bar is the window's own
  if (DESK)
    return (
      <Visiting.Provider value={visiting}>
        <div className="win">
          <div className="ui">{body}</div>
        </div>
      </Visiting.Provider>
    )
  return (
    <Visiting.Provider value={visiting}>
      {phone ? (
        <div className={`up${oneScreen ? ' fix' : ''}`}>
          <header className="up-top">
            {mark}
            {shop && (visiting ? <SignIn /> : <Wallet shop={shop} spent={spent} onOpen={() => move({ section: 'yours', product: null })} />)}
          </header>
          {shop && (
            <div className="up-tabs">
              <Sections at={place.section} go={(section) => move({ section, product: null })} />
            </div>
          )}
          {body}
        </div>
      ) : (
        <div className="ui">
          <header className="ui-top">
            {mark}
            {shop ? <Sections at={place.section} go={(section) => move({ section, product: null })} /> : <span />}
            {shop ? visiting ? <SignIn /> : <Wallet shop={shop} spent={spent} onOpen={() => move({ section: 'yours', product: null })} /> : <span />}
          </header>
          {body}
        </div>
      )}
      {DEMO && <DemoTab signedIn={!!shop && !visiting} onChange={load} />}
    </Visiting.Provider>
  )
}
