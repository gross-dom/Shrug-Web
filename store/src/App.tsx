import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { asksAddress, complete, dollarsOf, fmtDollars, fmtPoints, has, keptTo, POINTS_PER_DOLLAR, shortBy, soldOut, wayOf, type Address, type Order, type Product } from '../shared/rules'
import { DEMO, server, type Backend, type Placed, type StoreAnswer } from './backend'
import { demo, demoAddPoints, demoPick, demoReset, demoSignIn, PEOPLE } from './demo'
import { AddressForm, NOWHERE, Pay, whyNot } from './Pay'

// The store: what a member can spend their points on. The card (the site's front page) is where they sign
// in; this page is shown what the server says they may see, and asks it for everything it does.

const backend: Backend = DEMO ? demo : server
type Shop = Extract<StoreAnswer, { status: 'member' }>

/** What a thing costs, as a line: "400 pts", "10,000 pts + $450", "$1,500", "Free". */
function Cost({ product }: { product: Product }) {
  const way = wayOf(product)
  if (way === 'reserve') return <span className="cost">Pre-order</span>
  if (way === 'request') return <span className="cost">{product.price ? fmtDollars(product.price) : 'On request'}</span>
  if (!product.points && way === 'points') return <span className="cost">Free</span>
  return (
    <span className="cost">
      {fmtPoints(product.points ?? 0)} <i>pts</i>
      {product.price ? <b> + {fmtDollars(product.price)}</b> : null}
    </span>
  )
}

/** The labels on a product: how it is sold, how many there are, and who it is kept to. */
function tagsOf(product: Product): { text: string; kind?: 'gold' | 'out' }[] {
  const tags: { text: string; kind?: 'gold' | 'out' }[] = []
  if (product.status === 'Pre-order') tags.push({ text: 'Pre-order', kind: 'gold' })
  if (product.status === 'On request') tags.push({ text: 'By request', kind: 'gold' })
  if (soldOut(product)) tags.push({ text: 'Sold out', kind: 'out' })
  else if (product.editionOf) tags.push({ text: `Edition of ${product.editionOf}${product.left !== null ? ` · ${product.left} left` : ''}` })
  else if (product.left !== null) tags.push({ text: `${product.left} left` })
  else if (product.limited) tags.push({ text: 'Limited supply' })
  for (const group of keptTo(product)) tags.push({ text: `${group} only` })
  return tags
}

/** A product's picture; until Shrug has supplied one, its name set as a poster. */
function Picture({ product }: { product: Product }) {
  return product.picture ? (
    <img className="picture" src={product.picture} alt="" loading="lazy" decoding="async" />
  ) : (
    <span className="picture picture--none" aria-hidden>
      <span>{product.name}</span>
      <i>{product.kind}</i>
    </span>
  )
}

function Tags({ product }: { product: Product }) {
  const tags = tagsOf(product)
  return tags.length ? (
    <span className="tags">
      {tags.map((tag) => (
        <span key={tag.text} className="tag" data-kind={tag.kind}>
          {tag.text}
        </span>
      ))}
    </span>
  ) : null
}

const VERB: Record<string, string> = { request: 'Request', reserve: 'Reserve', pay: 'Buy', points: 'Get' }

function Shelf({ shop, onOpen }: { shop: Shop; onOpen: (product: Product) => void }) {
  return (
    <ul className="shelf">
      {shop.products.map((product, n) => {
        const mine = has(shop.orders, product)
        const way = wayOf(product)
        const short = way === 'points' || way === 'pay' ? shortBy(shop.member, product) : 0
        const note = product.kind === 'Document' && mine ? 'Yours' : (way === 'request' || way === 'reserve') && mine ? (way === 'request' ? 'Requested' : 'Reserved') : soldOut(product) && way !== 'request' ? 'Sold out' : short ? `${fmtPoints(short)} pts short` : VERB[way]
        return (
          <li key={product.id} style={{ ['--n' as string]: n }}>
            <button type="button" className="item" onClick={() => onOpen(product)}>
              <span className="item__top">
                <Picture product={product} />
                <Tags product={product} />
              </span>
              <span className="item__name">{product.name}</span>
              <span className="item__foot">
                <span className="item__cost">
                  <Cost product={product} />
                  {product.postage ? <span className="small">+ {fmtDollars(product.postage)} postage</span> : null}
                </span>
                <span className="item__go" data-quiet={note !== VERB[way] || undefined}>
                  {note}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** One product, opened: what it is, what it costs this member, and the way to get it. */
function Sheet({ shop, product, onClose, onPlaced }: { shop: Shop; product: Product; onClose: () => void; onPlaced: (placed: Placed) => void }) {
  const [option, setOption] = useState(product.options.length === 1 ? product.options[0]! : '')
  const [address, setAddress] = useState<Address>({ ...NOWHERE, name: DEMO ? '' : shop.member.name })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<Placed | null>(null)
  const [paying, setPaying] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const way = wayOf(product)
  const mine = has(shop.orders, product)
  const out = soldOut(product) && way !== 'request'
  const short = way === 'points' || way === 'pay' ? shortBy(shop.member, product) : 0
  const points = product.points ?? 0
  const needsOption = product.options.length > 0 && !option
  const needsAddress = way === 'points' && asksAddress(product)

  useEffect(() => {
    const was = document.activeElement as HTMLElement | null
    box.current?.focus()
    const overflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    // Heard from the whole page, not only from inside the sheet: the button that was just pressed may be
    // gone (it becomes "It's yours"), and the keyboard is then nowhere in particular
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
  // What was asked for has been done, and the button that asked is gone: the keyboard is put back on the sheet
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
    const placed = await backend.order({ product: product.id, option, address: needsAddress ? address : null })
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
        <p className="small">
          {o.status === 'Requested' ? 'We’ll write to you about it.' : o.status === 'Pre-order' && !o.points ? 'We’ll write when it is ready.' : product.kind === 'Document' ? 'Download it here, or from Yours, whenever you like.' : 'We’ll email you when it is on its way.'}
        </p>
        <dl className="sums">
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
          {o.points > 0 && (
            <div>
              <dt>Balance now</dt>
              <dd>{fmtPoints(done.points)} pts</dd>
            </div>
          )}
        </dl>
        {product.kind === 'Document' && (
          <button type="button" className="buy" disabled={busy} onClick={download}>
            {busy ? 'Fetching…' : 'Download'}
          </button>
        )}
      </div>
    )
  } else if (product.kind === 'Document' && mine) {
    action = (
      <button type="button" className="buy" disabled={busy} onClick={download}>
        {busy ? 'Fetching…' : 'Download'}
      </button>
    )
  } else if ((way === 'request' || way === 'reserve') && mine) {
    action = <p className="buy buy--said">{way === 'request' ? 'Requested. We’ll write to you about it.' : 'Reserved. We’ll write when it is ready.'}</p>
  } else if (out) {
    action = <p className="buy buy--said">Sold out</p>
  } else if (short) {
    action = (
      <p className="buy buy--said">
        {fmtPoints(short)} more points and it’s yours
      </p>
    )
  } else if (way === 'pay' && paying) {
    action = <Pay backend={backend} product={product} option={option} stripeKey={shop.stripeKey} onDone={finish} />
  } else {
    const label = way === 'request' ? 'Request it' : way === 'reserve' ? 'Reserve a copy' : way === 'pay' ? `Continue to pay ${fmtDollars(dollarsOf(product))}` : points ? `Spend ${fmtPoints(points)} points` : 'Get it'
    action = (
      <>
        {needsAddress && <AddressForm value={address} onChange={setAddress} />}
        <button type="button" className="buy" disabled={busy || needsOption || (needsAddress && !complete(address))} onClick={way === 'pay' ? () => setPaying(true) : order}>
          {busy ? 'One moment…' : needsOption ? 'Choose one above' : label}
        </button>
      </>
    )
  }

  return (
    <div className="veil" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={box}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        tabIndex={-1}
      >
        <button type="button" className="sheet__close" onClick={onClose}>
          Close
        </button>
        <div className="sheet__picture">
          <Picture product={product} />
        </div>
        <div className="sheet__body">
          <p className="label">{product.kind}</p>
          <h2 className="sheet__name">{product.name}</h2>
          <Tags product={product} />
          {product.description && <p className="sheet__words">{product.description}</p>}

          {product.options.length > 0 && !done && (
            <fieldset className="options">
              <legend className="label">Choose one</legend>
              {product.options.map((choice) => (
                <label key={choice} className="option">
                  <input type="radio" name="option" value={choice} checked={option === choice} disabled={paying} onChange={() => setOption(choice)} />
                  <span>{choice}</span>
                </label>
              ))}
            </fieldset>
          )}

          {!done && way !== 'reserve' && (
            <dl className="sums">
              {way === 'request' ? (
                <div>
                  <dt>Price</dt>
                  <dd>{product.price ? fmtDollars(product.price) : 'On request'}</dd>
                </div>
              ) : (
                <>
                  <div>
                    <dt>Points</dt>
                    <dd>{points ? fmtPoints(points) : 'None'}</dd>
                  </div>
                  {product.price ? (
                    <div>
                      <dt>Price</dt>
                      <dd>{fmtDollars(product.price)}</dd>
                    </div>
                  ) : null}
                  {product.postage ? (
                    <div>
                      <dt>Postage</dt>
                      <dd>{fmtDollars(product.postage)}</dd>
                    </div>
                  ) : null}
                  {way === 'pay' && (
                    <div className="sums__total">
                      <dt>To pay</dt>
                      <dd>{fmtDollars(dollarsOf(product))}</dd>
                    </div>
                  )}
                  {points > 0 && !short && (
                    <div className="sums__after">
                      <dt>Your balance after</dt>
                      <dd>{fmtPoints(shop.member.points - points)} pts</dd>
                    </div>
                  )}
                </>
              )}
            </dl>
          )}
          {way === 'request' && !done && !mine && <p className="small">This one is made to order and takes no points. Ask, and we’ll write to you about it.</p>}
          {way === 'reserve' && !done && !mine && <p className="small">Not out yet. Reserve a copy and we’ll write when it is ready: nothing is taken now.</p>}
          {action}
          {error && <p className="oops" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  )
}

const WHEN = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const SAID: Record<string, string> = { Paid: 'Bought', Points: 'Bought', 'Pre-order': 'Reserved', Requested: 'Requested', 'Needs review': 'Being checked', Sent: 'Sent', Refunded: 'Refunded' }

function Yours({ shop, onOpen }: { shop: Shop; onOpen: (product: Product) => void }) {
  if (!shop.orders.length) return null
  return (
    <section className="yours" aria-labelledby="yours-h">
      <h2 id="yours-h" className="h2">
        Yours
      </h2>
      <ul className="orders">
        {shop.orders.map((order: Order) => {
          const product = shop.products.find((p) => p.id === order.productId)
          const when = Date.parse(order.placed)
          return (
            <li key={order.id} className="order">
              <span className="order__what">
                <b>
                  {order.productName}
                  {order.option ? `, ${order.option}` : ''}
                </b>
                <span className="small">
                  {SAID[order.status] ?? order.status}
                  {order.number ? ` · No. ${order.number}` : ''}
                  {Number.isFinite(when) ? ` · ${WHEN.format(when)}` : ''} · {order.reference}
                </span>
              </span>
              <span className="order__cost small">
                {order.points ? `${fmtPoints(order.points)} pts` : ''}
                {order.points && order.paid ? ' + ' : ''}
                {order.paid ? fmtDollars(order.paid) : ''}
              </span>
              {product?.kind === 'Document' && order.status !== 'Refunded' && (
                <button type="button" className="pill" onClick={() => onOpen(product)}>
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

/** The demo's own bar: who is looking, a way to more points, and the shelves put back. Never in the real store. */
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

export function App() {
  const [answer, setAnswer] = useState<StoreAnswer | { status: 'loading' } | { status: 'down' }>({ status: 'loading' })
  const [open, setOpen] = useState<string | null>(null)
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
  const signout = async () => {
    await backend.signout()
    window.location.assign('/')
  }

  return (
    <>
      {DEMO && <DemoBar signedIn={!!shop} onChange={load} />}
      <header className="top">
        <a className="top__mark" href="/">
          Shrug VIP
        </a>
        {shop && (
          <div className="top__who">
            <span className="balance" aria-label={`${fmtPoints(shop.member.points)} points`}>
              <b>{fmtPoints(shop.member.points)}</b> pts
            </span>
            <a className="pill" href="/">
              Your card
            </a>
            <button type="button" className="pill pill--quiet" onClick={signout}>
              Sign out
            </button>
          </div>
        )}
      </header>

      <main className="page">
        {answer.status === 'loading' && <p className="wait label">Opening the store…</p>}
        {answer.status === 'down' && (
          <div className="gate">
            <h1 className="h1">The store didn’t answer.</h1>
            <button type="button" className="buy" onClick={load}>
              Try again
            </button>
          </div>
        )}
        {answer.status === 'anon' && (
          <div className="gate">
            <p className="label">Members only</p>
            <h1 className="h1">Open your pack to come in.</h1>
            <p className="lead">The store is for Shrug VIP members. Sign in with your card and it opens.</p>
            <a className="buy" href="/">
              Go to your card
            </a>
          </div>
        )}
        {answer.status === 'applied' && (
          <div className="gate">
            <p className="label">Not yet</p>
            <h1 className="h1">You’re not on the list yet.</h1>
            <p className="lead">We’ll write when it’s your time.</p>
            <a className="buy" href="/">
              Back to the card
            </a>
          </div>
        )}
        {shop && (
          <>
            <section className="hero">
              <p className="label">The store</p>
              <h1 className="h1">Spend your points.</h1>
              <p className="lead">
                {POINTS_PER_DOLLAR} points are $1. Some pieces also have a price in dollars, paid with Apple Pay.
              </p>
            </section>
            {shop.products.length ? <Shelf shop={shop} onOpen={(p) => setOpen(p.id)} /> : <p className="lead">Nothing on the shelves just now.</p>}
            <Yours shop={shop} onOpen={(p) => setOpen(p.id)} />
          </>
        )}
      </main>

      <footer className="foot">
        <span>One card per member. Points are not money and can’t be swapped for it.</span>
        <a href="https://www.shrug.vc" rel="noopener">
          shrug.vc
        </a>
      </footer>

      {shop && opened && (
        <Sheet
          key={opened.id}
          shop={shop}
          product={opened}
          onClose={() => setOpen(null)}
          onPlaced={() => {
            // The shelves, the balance and Yours are the server's to say: asked for afresh
            load()
          }}
        />
      )}
    </>
  )
}
