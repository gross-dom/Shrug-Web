import { useCallback, useEffect, useRef, useState } from 'react'
import { fmtPoints } from '../shared/rules'
import { DEMO, server, type Backend, type Placed, type Shop, type StoreAnswer } from './backend'
import { PointsMark, Wordmark } from './brand'
import { demo, demoAddPoints, demoPick, demoReset, demoScene, demoSetScene, demoSignIn, PEOPLE, SCENES } from './demo'
import { Lock, NoCloud } from './icons'
import { Picture, Price, ProductView, type Go } from './Product'
import { UpdatesView } from './Updates'
import { badgeOf, priceOf } from './words'
import { YoursView } from './Yours'

// The store. Three sections under one bar: the store itself (a display of everything in it, pictures first,
// and a screen for each product), Updates, and My VIP (the address still says ?s=yours, as links already
// sent do). The card (the site's front page) is where a member signs in; these pages show what the server
// says is theirs, and ask it for everything they do.

const backend: Backend = DEMO ? demo : server

type Section = 'store' | 'updates' | 'yours'
interface Place {
  section: Section
  /** The product on screen, in the store. */
  product: string | null
}

/** Where an address says the page is: /store/?p=<id> is a product, ?s=updates and ?s=yours the other sections. */
function placeOf(search: string): Place {
  const asked = new URLSearchParams(search)
  const section = asked.get('s')
  return { section: section === 'updates' || section === 'yours' ? section : 'store', product: asked.get('p') }
}
const addressOf = (place: Place) => (place.section !== 'store' ? `?s=${place.section}` : place.product ? `?p=${encodeURIComponent(place.product)}` : './')

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

/** The balance at the right of the bar: the points mark, and their points. It goes to their card. */
function Wallet({ shop, spent }: { shop: Shop; spent: number }) {
  const me = shop.member
  const metal = me.tier === 'gold' || me.tier === 'black' ? me.tier : 'silver'
  const points = useCount(me.points)
  return (
    <a className="ui-wallet" href="/" aria-label={`Your card: ${metal}${me.number ? `, number ${me.number}` : ''}, ${fmtPoints(me.points)} points`}>
      <span className="pts-n">
        <PointsMark size={16} />
        {fmtPoints(points)}
      </span>
      {spent > 0 && <span className="ui-delta">&minus;{fmtPoints(spent)}</span>}
    </a>
  )
}

function Sections({ at, go }: { at: Section; go: (section: Section) => void }) {
  const link = (section: Section, label: string) => (
    <a href={addressOf({ section, product: null })} aria-current={at === section ? 'page' : undefined} onClick={(e) => (e.preventDefault(), go(section))}>
      {label}
    </a>
  )
  return (
    <nav className="ui-seg" aria-label="Sections">
      {link('store', 'Store')}
      {link('updates', 'Updates')}
      {link('yours', 'My VIP')}
    </nav>
  )
}

/** The display: everything in the store, pictures first. Nothing is bought from here; each is a way in to its own screen. */
function Display({ shop, phone, open }: { shop: Shop; phone: boolean; open: (id: string) => void }) {
  const products = shop.products
  if (!products.length)
    return (
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
            <a className="ui-prod" href={`?p=${encodeURIComponent(product.id)}`} aria-label={[product.name, product.kind, priceOf(product), badge?.text].filter(Boolean).join(', ')} onClick={(e) => (e.preventDefault(), open(product.id))}>
              <span className="ui-prod-pic">
                <Picture product={product} size={phone ? 26 : 44} />
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
      <h1 className="sr">Shrug VIP Store</h1>
      {list}
    </main>
  ) : (
    <main className="ui-display">
      <h1 className="sr">Shrug VIP Store</h1>
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
    setAnswer('error' in got ? (got.error === 'anon' ? { status: 'anon' } : got.error === 'member' ? { status: 'applied' } : { status: 'down' }) : got)
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
    if (addressOf(next) !== addressOf(place)) window.history.pushState(null, '', addressOf(next))
    setPlace(next)
    window.scrollTo(0, 0)
  }
  const go: Go = (to) => move(to.view === 'product' ? { section: 'store', product: to.id } : { section: to.view === 'yours' ? 'yours' : 'store', product: null })
  const signout = async () => {
    await backend.signout()
    window.location.assign('/')
  }
  const placed = (done: Placed) => {
    setSpent((n) => n + done.order.points)
    load()
  }

  const shop = answer.status === 'member' ? answer : null
  const product = shop && place.section === 'store' ? (shop.products.find((p) => p.id === place.product) ?? null) : null
  useEffect(() => {
    const names: Record<Section, string> = { store: product ? product.name : 'Store', updates: 'Updates', yours: 'My VIP' }
    document.title = `${names[place.section]} · Shrug VIP`
  }, [place.section, product])

  let body: JSX.Element
  if (shop) {
    body =
      place.section === 'updates' ? (
        <UpdatesView shop={shop} phone={phone} backend={backend} onChange={load} onSpent={(points) => setSpent((n) => n + points)} />
      ) : place.section === 'yours' ? (
        <YoursView shop={shop} phone={phone} backend={backend} onChange={load} onSignOut={signout} />
      ) : product ? (
        <ProductView key={product.id} shop={shop} product={product} phone={phone} backend={backend} go={go} onPlaced={placed} />
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
      ) : answer.status === 'anon' ? (
        <div className="ui-gate">
          <span className="ui-thumb lg">
            <Lock />
          </span>
          <h2 className="t-h2">Sign in to come in.</h2>
          <p className="t-words">The store is for members. New here? Open your pack first.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, paddingTop: 6 }}>
            <a className="ui-btn fit" href="/?signin=store">
              Sign in
            </a>
            <a className="ui-btn sec fit" href="/">
              Open your pack
            </a>
          </div>
        </div>
      ) : (
        <div className="ui-gate">
          <h2 className="t-h2">You’re not on the list yet.</h2>
          <p className="t-words">We’ll write when it’s your time.</p>
          <div style={{ paddingTop: 6 }}>
            <a className="ui-btn sec fit" href="/">
              Back to your card
            </a>
          </div>
        </div>
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
  return (
    <>
      {phone ? (
        <div className={`up${oneScreen ? ' fix' : ''}`}>
          <header className="up-top">
            {mark}
            {shop && <Wallet shop={shop} spent={spent} />}
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
            {shop ? <Wallet shop={shop} spent={spent} /> : <span />}
          </header>
          {body}
        </div>
      )}
      {DEMO && <DemoTab signedIn={!!shop} onChange={load} />}
    </>
  )
}
