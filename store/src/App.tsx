import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  asksAddress, complete, dueCents, fitPoints, floorCents, fmtCents, fmtPoints, has, keptTo, mostPoints, POINTS_PER_DOLLAR, postageCents, priceCents, soldOut, wayOf,
  type Address, type Kind, type Member, type Order, type Product,
} from '../shared/rules'
import { Art } from './Art'
import { DEMO, server, type Backend, type Placed, type StoreAnswer } from './backend'
import { demo, demoAddPoints, demoPick, demoReset, demoSignIn, PEOPLE } from './demo'
import { AddressForm, NOWHERE, Pay, Strip, whyNot } from './Pay'

// The store: a wall of things hung on pegs, as the pack is on the card's page, each with its shelf label.
// A thing is taken off the wall to be looked at, and bought at the counter: its price in dollars, brought
// down by as many of the member's points as they choose, with what is left paid by Apple Pay. The card (the
// site's front page) is where a member signs in; this page shows what the server says they may see, and
// asks it for everything it does.

const backend: Backend = DEMO ? demo : server
type Shop = Extract<StoreAnswer, { status: 'member' }>

/** The words on the gold strip across a pack: how it is sold, or how many there are. */
function stripOf(product: Product): string | null {
  if (soldOut(product) && wayOf(product) !== 'request') return 'Sold out'
  if (product.status === 'Pre-order') return 'Pre-order'
  if (product.status === 'On request') return 'By request'
  if (product.editionOf) return `Edition of ${product.editionOf}${product.left !== null ? ` · ${product.left} left` : ''}`
  if (product.left !== null) return `Only ${product.left} left`
  if (product.limited) return 'Limited supply'
  return null
}

/** The least a member can pay for it before postage: its price with every point of theirs that it will take. */
const bestCents = (member: Member, product: Product) => priceCents(product) - fitPoints(member, product, mostPoints(member, product)) * (100 / POINTS_PER_DOLLAR)

/** A product, as a pack on a peg: its crimped ends, the strip across it, its picture in the window, and its name. */
function Pack({ product, sticker }: { product: Product; sticker?: string }) {
  const strip = stripOf(product)
  return (
    <span className="pack" data-out={(soldOut(product) && wayOf(product) !== 'request') || undefined} data-long={product.name.length > 16 || undefined}>
      <span className="pack__crimp pack__crimp--top">
        <i className="pack__hole" />
      </span>
      <span className="pack__face">
        {strip && <span className="pack__strip">{strip}</span>}
        <span className="pack__window">{product.picture ? <img src={product.picture} alt="" loading="lazy" decoding="async" /> : <Art kind={product.kind} />}</span>
        <span className="pack__word">{product.name}</span>
        <span className="pack__facts">
          <span>{product.kind}</span>
          <span>{keptTo(product).length ? `${keptTo(product)[0]} only` : 'Series 01'}</span>
        </span>
      </span>
      <span className="pack__crimp pack__crimp--bot" />
      <span className="pack__sheen" aria-hidden />
      {sticker && (
        <span className="burst" aria-hidden>
          <span>{sticker}</span>
        </span>
      )}
    </span>
  )
}

/** The shelf label under a pack: its price, and what it comes to for this member. */
function Tag({ shop, product }: { shop: Shop; product: Product }) {
  const way = wayOf(product)
  const mine = has(shop.orders, product)
  const price = priceCents(product)
  const best = bestCents(shop.member, product)
  let left: string
  let right: string | null = null
  if (way === 'reserve') [left, right] = ['Pre-order', mine ? 'Reserved' : 'Reserve']
  else if (way === 'request') [left, right] = [price ? fmtCents(price) : 'On request', mine ? 'Requested' : 'Request']
  else if (product.kind === 'Document' && mine) [left, right] = ['Yours', 'Download']
  else if (soldOut(product)) [left, right] = [fmtCents(price), 'Sold out']
  else if (price === 0) [left, right] = ['Free', 'Get']
  else [left, right] = [fmtCents(price), best < price ? (best === 0 ? 'Free with points' : `${fmtCents(best)} with points`) : null]
  return (
    <span className="tag">
      <span className="tag__row">
        <span className="tag__price">{left}</span>
        {right && <span className="tag__with">{right}</span>}
      </span>
      {way === 'buy' && postageCents(product) > 0 && !soldOut(product) && <span className="tag__fine">+ {fmtCents(postageCents(product))} postage</span>}
    </span>
  )
}

function Hang({ shop, product, n, onOpen }: { shop: Shop; product: Product; n: number; onOpen: (product: Product) => void }) {
  return (
    <li className="hang" style={{ ['--n' as string]: n }}>
      <button type="button" className="hang__btn" onClick={() => onOpen(product)} aria-label={`${product.name}. Take it off the wall.`}>
        <i className="peg" aria-hidden />
        <span className="swing">
          <Pack product={product} />
        </span>
      </button>
      <Tag shop={shop} product={product} />
    </li>
  )
}

/** The one thing given the middle of the wall: a numbered edition if there is one, or else whatever is in
 * short supply. Nothing, where nothing is either. */
const starOf = (products: Product[]) => products.find((p) => p.editionOf && !soldOut(p)) ?? products.find((p) => (p.limited || p.left !== null) && !soldOut(p) && wayOf(p) === 'buy') ?? null

function Stage({ shop, product, onOpen }: { shop: Shop; product: Product; onOpen: (product: Product) => void }) {
  const price = priceCents(product)
  const best = bestCents(shop.member, product)
  return (
    <section className="stage" aria-label={`On the wall now: ${product.name}`}>
      <button type="button" className="hang__btn stage__pack" onClick={() => onOpen(product)} aria-label={`${product.name}. Take it off the wall.`}>
        <i className="peg" aria-hidden />
        <span className="swing">
          <Pack product={product} />
        </span>
      </button>
      <div className="ticket stage__ticket">
        <div className="ticket__head">
          <span className="k">On the wall now</span>
          <span className="v">{stripOf(product) ?? product.kind}</span>
        </div>
        <h2 className="counter__name">{product.name}</h2>
        {product.description && <p className="counter__words">{product.description}</p>}
        <dl className="rows">
          <div>
            <dt>Price</dt>
            <dd>{fmtCents(price)}</dd>
          </div>
          {best < price && (
            <div>
              <dt>With your points</dt>
              <dd className="gold">{best === 0 ? 'Free' : fmtCents(best)}</dd>
            </div>
          )}
        </dl>
        <Strip onClick={() => onOpen(product)}>Take a look</Strip>
      </div>
    </section>
  )
}

/** The counter: one product, taken off the wall. What it is, what it costs this member, and the way to get it. */
function Counter({ shop, product, onClose, onPlaced }: { shop: Shop; product: Product; onClose: () => void; onPlaced: (placed: Placed) => void }) {
  const way = wayOf(product)
  const most = mostPoints(shop.member, product)
  const [option, setOption] = useState(product.options.length === 1 ? product.options[0]! : '')
  // To begin with every point it will take is used: that is the best price, and the member can ease them off
  const [wanted, setWanted] = useState(most)
  const [address, setAddress] = useState<Address>(NOWHERE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<Placed | null>(null)
  const [paying, setPaying] = useState(false)
  // What the member had when this was opened: the sums stay theirs while they are looked at, whatever the shop is told since
  const [balance] = useState(shop.member.points)
  const box = useRef<HTMLDivElement>(null)

  const mine = has(shop.orders, product)
  const out = soldOut(product) && way !== 'request'
  const points = way === 'buy' ? fitPoints({ points: balance }, product, wanted) : 0
  const price = priceCents(product)
  const postage = postageCents(product)
  const due = way === 'buy' ? dueCents(product, points) : 0
  const floor = floorCents(product)
  const needsOption = product.options.length > 0 && !option
  const needsAddress = way === 'buy' && due === 0 && asksAddress(product)

  useEffect(() => {
    const was = document.activeElement as HTMLElement | null
    box.current?.focus()
    const overflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    // Heard from the whole page, not only from inside: the strip that was just pressed may be gone (it
    // becomes "It's yours"), and the keyboard is then nowhere in particular
    const keys = (e: KeyboardEvent) => {
      const sheet = box.current
      if (!sheet) return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'Tab') {
        const stops = [...sheet.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), summary, a[href]')].filter((el) => el.offsetParent !== null)
        const first = stops[0]
        const last = stops[stops.length - 1]
        const inside = sheet.contains(document.activeElement)
        if (!first || !last) (e.preventDefault(), sheet.focus())
        else if (e.shiftKey && (!inside || document.activeElement === first || document.activeElement === sheet)) (e.preventDefault(), last.focus())
        else if (!e.shiftKey && (!inside || document.activeElement === last)) (e.preventDefault(), first.focus())
      }
    }
    document.addEventListener('keydown', keys)
    return () => {
      document.removeEventListener('keydown', keys)
      document.documentElement.style.overflow = overflow
      was?.focus?.()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (done && !box.current?.contains(document.activeElement)) box.current?.focus()
  }, [done])

  const finish = (placed: Placed) => {
    setDone(placed)
    onPlaced(placed)
  }
  const order = async () => {
    setBusy(true)
    setError('')
    const placed = await backend.order({ product: product.id, option, points, address: needsAddress ? address : null })
    setBusy(false)
    if ('error' in placed) setError(whyNot(placed.error))
    else finish(placed)
  }
  const download = async () => {
    setBusy(true)
    setError('')
    const got = await backend.download(product)
    setBusy(false)
    if (got !== true) setError(got.error === 'no-file' ? 'The file has not been added yet. It will be here soon.' : 'That did not download. Try again.')
  }

  let action: JSX.Element
  if (done) {
    const o = done.order
    action = (
      <div className="done" role="status">
        <p className="done__head">{o.status === 'Requested' ? 'Requested.' : o.status === 'Pre-order' ? 'Reserved.' : 'It’s yours.'}</p>
        <p className="fine">
          {o.status === 'Requested' ? 'We’ll write to you about it.' : o.status === 'Pre-order' && !o.points && !o.paid ? 'We’ll write when it is ready.' : product.kind === 'Document' ? 'Download it here, or from Yours, whenever you like.' : 'We’ll email you when it is on its way.'}
        </p>
        <dl className="rows">
          <div>
            <dt>Reference</dt>
            <dd>{o.reference}</dd>
          </div>
          {o.number && (
            <div>
              <dt>Edition</dt>
              <dd>No. {o.number}</dd>
            </div>
          )}
          {o.paid > 0 && (
            <div>
              <dt>Paid</dt>
              <dd>{fmtCents(Math.round(o.paid * 100))}</dd>
            </div>
          )}
          {o.points > 0 && (
            <div>
              <dt>Points used</dt>
              <dd>{fmtPoints(o.points)}</dd>
            </div>
          )}
          {o.points > 0 && (
            <div>
              <dt>Balance now</dt>
              <dd>{fmtPoints(done.points)} pts</dd>
            </div>
          )}
        </dl>
        {product.kind === 'Document' && (
          <Strip busy={busy} onClick={download}>
            {busy ? 'Fetching' : 'Download'}
          </Strip>
        )}
      </div>
    )
  } else if (product.kind === 'Document' && mine) {
    action = (
      <Strip busy={busy} onClick={download}>
        {busy ? 'Fetching' : 'Download'}
      </Strip>
    )
  } else if (way !== 'buy' && mine) {
    action = <p className="said">{way === 'request' ? 'Requested. We’ll write to you about it.' : 'Reserved. We’ll write when it is ready.'}</p>
  } else if (out) {
    action = <p className="said">Sold out</p>
  } else if (way === 'buy' && due > 0 && paying) {
    action = <Pay backend={backend} product={product} option={option} points={points} cents={due} stripeKey={shop.stripeKey} onDone={finish} />
  } else {
    const label = way === 'request' ? 'Request it' : way === 'reserve' ? 'Reserve a copy' : due > 0 ? `Pay ${fmtCents(due)}` : points ? `Take it · ${fmtPoints(points)} pts` : 'Take it'
    action = (
      <>
        {needsAddress && <AddressForm value={address} onChange={setAddress} />}
        <Strip busy={busy} disabled={needsOption || (needsAddress && !complete(address))} onClick={way === 'buy' && due > 0 ? () => setPaying(true) : order}>
          {busy ? 'One moment' : needsOption ? 'Choose one above' : label}
        </Strip>
      </>
    )
  }

  const sticker = done ? (done.order.status === 'Requested' ? 'Asked' : done.order.status === 'Pre-order' ? 'Held' : 'Yours') : undefined
  const step = most % 10 === 0 ? 10 : 1

  return (
    <div className="veil" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} className="counter" role="dialog" aria-modal="true" aria-label={product.name} tabIndex={-1}>
        <button type="button" className="counter__close label" onClick={onClose}>
          Back to the wall
        </button>
        <div className="counter__pack" data-done={done ? '' : undefined}>
          <i className="peg" aria-hidden />
          <span className="swing">
            <Pack product={product} sticker={sticker} />
          </span>
          {done && (
            <span className="sparks" aria-hidden>
              {Array.from({ length: 14 }, (_, n) => (
                <i key={n} style={{ ['--a' as string]: `${n * 25.7}deg`, ['--d' as string]: `${70 + ((n * 37) % 60)}px` }} />
              ))}
            </span>
          )}
        </div>
        <section className="ticket counter__ticket">
          <div className="ticket__head">
            <span className="k">{product.kind}</span>
            <span className="v">{stripOf(product) ?? 'Series 01'}</span>
          </div>
          <h2 className="counter__name">{product.name}</h2>
          {product.description && <p className="counter__words">{product.description}</p>}
          {keptTo(product).length > 0 && <p className="fine">For {keptTo(product).join(', ')} only.</p>}

          {product.options.length > 0 && !done && (
            <fieldset className="options">
              <legend className="k">Choose one</legend>
              {product.options.map((choice) => (
                <label key={choice} className="option">
                  <input type="radio" name="option" value={choice} checked={option === choice} disabled={paying} onChange={() => setOption(choice)} />
                  <span>{choice}</span>
                </label>
              ))}
            </fieldset>
          )}

          {!done && way === 'request' && (
            <>
              <dl className="rows">
                <div className="rows__total">
                  <dt>Price</dt>
                  <dd>{price ? fmtCents(price) : 'On request'}</dd>
                </div>
              </dl>
              {!mine && <p className="fine">Made to order, at its price: points are not used on this one. Ask, and we’ll write to you about it.</p>}
            </>
          )}
          {!done && way === 'reserve' && !mine && <p className="fine">Not out yet. Reserve a copy and we’ll write when it is ready: nothing is taken now.</p>}
          {!done && way === 'buy' && !out && !(product.kind === 'Document' && mine) && price + postage > 0 && (
            <>
              <dl className="rows">
                <div>
                  <dt>Price</dt>
                  <dd>{fmtCents(price)}</dd>
                </div>
                {most > 0 && (
                  <div className="rows__points">
                    <dt>
                      <label htmlFor="points">Your points</label>
                    </dt>
                    <dd>{points ? `− ${fmtCents(points * (100 / POINTS_PER_DOLLAR))}` : 'None used'}</dd>
                    <div className="slide">
                      <input
                        id="points"
                        type="range"
                        min={0}
                        max={most}
                        step={step}
                        value={points}
                        disabled={paying}
                        style={{ ['--at' as string]: `${most ? (points / most) * 100 : 0}%` }}
                        aria-valuetext={`${fmtPoints(points)} points, ${fmtCents(due)} to pay`}
                        onChange={(e) => setWanted(Number(e.target.value))}
                      />
                      <p className="fine">
                        Using <b>{fmtPoints(points)}</b> of your {fmtPoints(balance)} pts
                        {floor > 0 && points === most && balance >= most ? `. It can’t go under ${fmtCents(floor)}.` : '.'}
                      </p>
                    </div>
                  </div>
                )}
                {postage > 0 && (
                  <div>
                    <dt>Postage</dt>
                    <dd>{fmtCents(postage)}</dd>
                  </div>
                )}
                <div className="rows__total">
                  <dt>To pay</dt>
                  <dd>{due > 0 ? fmtCents(due) : 'Nothing'}</dd>
                </div>
              </dl>
              {most === 0 && floor >= price && price > 0 && <p className="fine">Points are not used on this one.</p>}
              {most === 0 && floor < price && <p className="fine">You have no points to use yet: it is {fmtCents(due)} today.</p>}
            </>
          )}
          {action}
          {error && <p className="oops" role="alert">{error}</p>}
        </section>
      </div>
    </div>
  )
}

const WHEN = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const SAID: Record<string, string> = { Paid: 'Bought', Points: 'Bought', 'Pre-order': 'Reserved', Requested: 'Requested', 'Needs review': 'Being checked', Sent: 'Sent', Refunded: 'Refunded' }

/** What a member has: each order as its receipt. */
function Yours({ shop, onOpen }: { shop: Shop; onOpen: (product: Product) => void }) {
  if (!shop.orders.length) return null
  return (
    <section className="yours" aria-labelledby="yours-h">
      <h2 id="yours-h" className="label">
        Yours
      </h2>
      <ul className="receipts">
        {shop.orders.map((order: Order) => {
          const product = shop.products.find((p) => p.id === order.productId)
          const when = Date.parse(order.placed)
          const cost = [order.paid ? fmtCents(Math.round(order.paid * 100)) : '', order.points ? `${fmtPoints(order.points)} pts` : ''].filter(Boolean).join(' + ')
          return (
            <li key={order.id} className="ticket receipt">
              <div className="ticket__head">
                <span className="k">{order.reference}</span>
                <span className="v">{SAID[order.status] ?? order.status}</span>
              </div>
              <p className="receipt__name">
                {order.productName}
                {order.option ? `, ${order.option}` : ''}
              </p>
              <p className="fine">
                {[order.number ? `No. ${order.number}` : '', Number.isFinite(when) ? WHEN.format(when) : '', cost].filter(Boolean).join(' · ')}
              </p>
              {product?.kind === 'Document' && order.status !== 'Refunded' && (
                <button type="button" className="linkbtn" onClick={() => onOpen(product)}>
                  Download
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** The demo's own bar: who is looking, a way to more points, and the wall put back. Never in the real store. */
function DemoBar({ signedIn, onChange }: { signedIn: boolean; onChange: () => void }) {
  const [pick, setPick] = useState(demoPick())
  return (
    <div className="demo" role="region" aria-label="Demo controls">
      <span className="demo__tag">Demo</span>
      <span className="demo__hint">Nothing is sent, and no money moves.</span>
      <label>
        <span>Viewing as</span>
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
      <button type="button" disabled={!signedIn} onClick={() => (demoAddPoints(5000), onChange())}>
        +5,000 pts
      </button>
      <button type="button" onClick={() => (demoReset(), onChange())}>
        Restock
      </button>
    </div>
  )
}

const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'Book', label: 'Books' },
  { kind: 'Chair', label: 'Chairs' },
  { kind: 'Art', label: 'Art' },
  { kind: 'Document', label: 'Documents' },
  { kind: 'Other', label: 'Other' },
]

export function App() {
  const [answer, setAnswer] = useState<StoreAnswer | { status: 'loading' } | { status: 'down' }>({ status: 'loading' })
  const [open, setOpen] = useState<string | null>(null)
  const [kind, setKind] = useState<Kind | null>(null)
  const load = useCallback(async () => {
    const got = await backend.store()
    setAnswer('error' in got ? (got.error === 'anon' ? { status: 'anon' } : got.error === 'member' ? { status: 'applied' } : { status: 'down' }) : got)
  }, [])
  useEffect(() => {
    load()
    // Back from the card, or from another tab: the balance may have moved
    const again = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', again)
    window.addEventListener('pageshow', again)
    return () => {
      document.removeEventListener('visibilitychange', again)
      window.removeEventListener('pageshow', again)
    }
  }, [load])

  const shop = answer.status === 'member' ? answer : null
  const opened = useMemo(() => shop?.products.find((p) => p.id === open) ?? null, [shop, open])
  const kinds = useMemo(() => KINDS.filter(({ kind: k }) => shop?.products.some((p) => p.kind === k)), [shop])
  // With the whole wall showing, one thing has the middle of it, and is not hung again among the rest
  const star = shop && !kind ? starOf(shop.products) : null
  const shown = shop ? shop.products.filter((p) => (!kind || p.kind === kind) && p !== star) : []
  const signout = async () => {
    await backend.signout()
    window.location.assign('/')
  }

  return (
    <>
      {DEMO && <DemoBar signedIn={!!shop} onChange={load} />}
      <header className="top">
        <a className="wordmark" href="/">
          Shrug VIP
        </a>
        <div className="top__r">
          The store
          <br />
          Series 01
        </div>
      </header>

      <main className="main">
        <h1 className="sr">Shrug VIP: the store</h1>
        {answer.status === 'loading' && <p className="label wait">Opening the store</p>}
        {answer.status === 'down' && (
          <div className="gate">
            <p className="label">The store didn’t answer</p>
            <Strip onClick={load}>Try again</Strip>
          </div>
        )}
        {answer.status === 'anon' && (
          <div className="gate">
            <p className="label">Members only. Open your pack to come in.</p>
            <a className="strip" href="/">
              <span className="strip__chevs" aria-hidden>
                ›››
              </span>
              <span className="strip__word">Your card</span>
              <span className="strip__chevs" aria-hidden>
                ›››
              </span>
            </a>
          </div>
        )}
        {answer.status === 'applied' && (
          <div className="gate">
            <p className="label">You’re not on the list yet. We’ll write when it’s your time.</p>
            <a className="linkbtn" href="/">
              Back to the card
            </a>
          </div>
        )}
        {shop && (
          <>
            <div className="bar">
              {kinds.length > 1 && (
                <div className="filters" role="group" aria-label="Show">
                  <button type="button" className="label" aria-pressed={kind === null} onClick={() => setKind(null)}>
                    All
                  </button>
                  {kinds.map((k) => (
                    <button key={k.kind} type="button" className="label" aria-pressed={kind === k.kind} onClick={() => setKind(kind === k.kind ? null : k.kind)}>
                      {k.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="sticker" key={shop.member.points} aria-label={`Your balance: ${fmtPoints(shop.member.points)} points, worth ${fmtCents(shop.member.points * (100 / POINTS_PER_DOLLAR))} here`}>
                <span className="sticker__k">Your balance</span>
                <span className="sticker__v">
                  {fmtPoints(shop.member.points)} <i>pts</i>
                </span>
                <span className="sticker__k">Worth {fmtCents(shop.member.points * (100 / POINTS_PER_DOLLAR))} here</span>
              </div>
            </div>

            {star && <Stage shop={shop} product={star} onOpen={(p) => setOpen(p.id)} />}
            {shown.length ? (
              <ul className="rack">
                {shown.map((product, n) => (
                  <Hang key={product.id} shop={shop} product={product} n={n} onOpen={(p) => setOpen(p.id)} />
                ))}
              </ul>
            ) : (
              <p className="label wait">Nothing on the wall just now</p>
            )}

            <section className="how" aria-label="How it works">
              <div className="ticket">
                <div className="ticket__head">
                  <span className="k">01</span>
                  <span className="v">A price</span>
                </div>
                <p>Everything on the wall has a price in dollars.</p>
              </div>
              <div className="ticket">
                <div className="ticket__head">
                  <span className="k">02</span>
                  <span className="v">Your points</span>
                </div>
                <p>{POINTS_PER_DOLLAR} points take $1 off. Use as many or as few as you like.</p>
              </div>
              <div className="ticket">
                <div className="ticket__head">
                  <span className="k">03</span>
                  <span className="v">The rest</span>
                </div>
                <p>Some pieces have a floor they can’t go under, and postage is extra. Pay what’s left with Apple Pay.</p>
              </div>
            </section>

            <Yours shop={shop} onOpen={(p) => setOpen(p.id)} />
          </>
        )}
      </main>

      <footer className="bot">
        <span>{shop ? `Signed in as ${shop.member.first || 'you'}` : 'One card per member. No swaps.'}</span>
        <span className="bot__r">
          {shop && (
            <>
              <a className="linkbtn" href="/">
                Your card
              </a>
              <button type="button" className="linkbtn" onClick={signout}>
                Sign out
              </button>
            </>
          )}
          {!shop && (
            <a className="linkbtn" href="https://www.shrug.vc" rel="noopener">
              shrug.vc
            </a>
          )}
        </span>
      </footer>

      {shop && opened && <Counter key={opened.id} shop={shop} product={opened} onClose={() => setOpen(null)} onPlaced={() => load()} />}
    </>
  )
}
