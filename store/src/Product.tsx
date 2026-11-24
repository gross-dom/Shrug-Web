import { useEffect, useRef, useState } from 'react'
import { asksAddress, dueCents, fitPoints, fmtCents, fmtPoints, has, mostPoints, numberOf, onFile, POINTS_PER_DOLLAR, postageCents, priceCents, soldOut, wayOf, type Product } from '../shared/rules'
import { CARD, type Backend, type Placed, type Shop } from './backend'
import { KindIcon, Left, Right, Tick } from './icons'
import { Pay, whyNot } from './Pay'
import { badgeOf, captionOf, editionOf, keptOf, owned, paidOf, priceOf, shortOf } from './words'

// One product to a screen: its picture, then what it is and what it costs this member. Checkout and the
// receipt take the panel's place; the picture stays. The markup is the design's (store/design/screens:
// Product, ProductPointsOnly, Checkout, Receipt, States, and their Phone counterparts), and the sums are
// the store's rules (shared/rules.ts).

export type Go = (to: { view: 'store' } | { view: 'product'; id: string } | { view: 'yours' }) => void

/** The colours a chair comes in, as they are drawn. An option may carry its own ("Sand #c8b89a"); these are known without. */
const COLORS: Record<string, string> = { black: '#1b1c1f', stone: '#b9b2a3', white: '#f4f4f1' }
function swatchOf(option: string): { name: string; color: string | null } {
  const hex = /\s(#[0-9a-f]{3,8})$/i.exec(option)
  const name = hex ? option.slice(0, hex.index).trim() : option
  const known = COLORS[name.toLowerCase()]
  return { name, color: hex?.[1] ?? known ?? (typeof CSS !== 'undefined' && CSS.supports('color', name.toLowerCase()) ? name.toLowerCase() : null) }
}

/** A product's photograph; until it has one, a drawing of the sort of thing it is. */
export function Picture({ product, size }: { product: Product; size: number }) {
  return product.picture ? (
    <img src={product.picture} alt="" decoding="async" />
  ) : (
    <span className="t-3">
      <KindIcon kind={product.kind} size={size} width={size > 40 ? 1.1 : size > 22 ? 1.2 : 1.6} />
    </span>
  )
}

/** An address as a few lines. */
export const Lines = ({ text }: { text: string }) => (
  <>
    {text.split('\n').map((line, n) => (
      <span key={n}>
        {n > 0 && <br />}
        {line}
      </span>
    ))}
  </>
)

/** Where it is going: the address on file, with the way to change it; or, with none, somewhere to type one, which is kept. */
function ShipTo({ shop, typed, onType, go }: { shop: Shop; typed: string; onType: (text: string) => void; go: Go }) {
  return onFile(shop.member.shipTo) ? (
    <div className="ui-card">
      <div className="ui-split">
        <div>
          <span className="t-sm t-2">Ship to</span>
          <p>
            <Lines text={shop.member.shipTo} />
          </p>
        </div>
        <a className="ui-btn sec sm" href="?s=yours" onClick={(e) => (e.preventDefault(), go({ view: 'yours' }))}>
          Change
        </a>
      </div>
    </div>
  ) : (
    <div className="ui-card">
      <label className="ui-field">
        <span className="t-sm t-2">Ship to</span>
        <textarea className="ui-area" rows={3} value={typed} placeholder={'Name\nStreet address\nCity, State ZIP'} autoComplete="street-address" onChange={(e) => onType(e.target.value)} />
      </label>
    </div>
  )
}

export function ProductView({ shop, visiting, product, phone, backend, go, onPlaced }: { shop: Shop; /** Nobody is signed in: everything is shown, and the button is the way to the card. */ visiting?: boolean; product: Product; phone: boolean; backend: Backend; go: Go; onPlaced: (placed: Placed) => void }) {
  const all = shop.products
  const at = all.findIndex((p) => p.id === product.id)
  const way = wayOf(product)
  // What the member had when this was opened: the sums stay theirs while they are looked at
  const [balance] = useState(shop.member.points)
  const most = mostPoints({ points: balance }, product)
  const [option, setOption] = useState(product.options.length === 1 ? product.options[0]! : '')
  // To begin with every point it will take is used: that is its best price, and the member can ease them off
  const [wanted, setWanted] = useState(most)
  const [mode, setMode] = useState<'product' | 'checkout'>('product')
  const [done, setDone] = useState<Placed | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const swipe = useRef<number | null>(null)

  const points = way === 'buy' ? fitPoints({ points: balance }, product, wanted) : 0
  const price = priceCents(product)
  const postage = postageCents(product)
  const due = way === 'buy' ? dueCents(product, points) : 0
  const asked = has(shop.orders, product)
  const bought = owned(shop.orders, product)
  const out = soldOut(product) && way !== 'request'
  const ships = asksAddress(product)
  const here = onFile(shop.member.shipTo) || onFile(typed)
  const number = way === 'buy' && !out ? numberOf(product) : ''
  const needsOption = product.options.length > 0 && !option
  // Something to choose only where points do not cover it all: then the member says how many to use
  const choosing = way === 'buy' && most > 0 && dueCents(product, fitPoints({ points: balance }, product, most)) > 0
  const badge = badgeOf(product, shop.orders)
  const colors = product.options.map(swatchOf)
  const label = colors.length > 0 && colors.every((c) => c.color) ? 'Color' : 'Choice'
  const neighbour = (by: number) => all[(at + by + all.length) % all.length]!
  const to = (p: Product) => ({ href: `?p=${encodeURIComponent(p.id)}`, onClick: (e: React.MouseEvent) => (e.preventDefault(), go({ view: 'product', id: p.id })) })

  // The arrow keys move to the next product; Escape leaves checkout
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('input, textarea, select, iframe') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape' && mode === 'checkout') setMode('product')
      else if (mode === 'product' && !done && all.length > 1 && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) go({ view: 'product', id: neighbour(e.key === 'ArrowRight' ? 1 : -1).id })
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  }, [mode, done, at, all.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (placed: Placed) => {
    setDone(placed)
    setMode('product')
    setError('')
    onPlaced(placed)
  }
  const order = async () => {
    setBusy(true)
    setError('')
    const placed = await backend.order({ product: product.id, option, points, shipTo: onFile(typed) ? typed : undefined })
    setBusy(false)
    if ('error' in placed) setError(whyNot(placed.error))
    else finish(placed)
  }

  // ---- The parts, as the screens have them

  const sums = (withRange: boolean, full: boolean) => (
    <dl className="ui-card rows">
      <div>
        <dt>Price</dt>
        <dd>{price === 0 ? 'Free' : fmtCents(price)}</dd>
      </div>
      {way === 'buy' && price > 0 && most > 0 && (
        <div className="pts">
          <dt>Your points</dt>
          <dd>
            <small>{fmtPoints(points)} pts</small>&minus;{fmtCents(points * (100 / POINTS_PER_DOLLAR))}
          </dd>
        </div>
      )}
      {withRange && choosing && (
        <div className="range">
          {/* A list of sums has a name and a figure on every row: this row's are the slider's own */}
          <dt className="sr">Points to use</dt>
          <dd>
          <input
            type="range"
            className="ui-range"
            min={0}
            max={most}
            step={most % 10 === 0 ? 10 : 1}
            value={points}
            style={{ ['--at' as string]: `${most ? (points / most) * 100 : 0}%` }}
            aria-label={`Points to use, up to ${fmtPoints(most)}`}
            aria-valuetext={`${fmtPoints(points)} points, ${fmtCents(due)} to pay`}
            onChange={(e) => setWanted(Number(e.target.value))}
          />
          </dd>
        </div>
      )}
      {full && way === 'buy' && postage > 0 && (
        <div>
          <dt>Shipping</dt>
          <dd>{fmtCents(postage)}</dd>
        </div>
      )}
      {full && way === 'buy' && price > 0 && (
        <div className="total">
          <dt>Total</dt>
          <dd>{fmtCents(due)}</dd>
        </div>
      )}
    </dl>
  )

  const swatches = product.options.length > 0 && (
    <div className="ui-field">
      <span className="t-sm t-2">
        {label} · <b>{option ? swatchOf(option).name : 'Choose one'}</b>
      </span>
      <div className="ui-swatches" role="group" aria-label={label}>
        {product.options.map((choice) => {
          const { name, color } = swatchOf(choice)
          return (
            <button key={choice} type="button" className="ui-sw" aria-pressed={option === choice} aria-label={name} title={name} disabled={mode === 'checkout'} onClick={() => setOption(choice)}>
              <span style={{ background: color ?? 'var(--surface-3)' }} />
            </button>
          )
        })}
      </div>
    </div>
  )

  /** The one white button, and what it does. */
  const button = (() => {
    if (way !== 'buy' && asked) return { text: way === 'request' ? 'Requested' : 'Reserved', off: true }
    if (out) return { text: 'Sold out', off: true }
    if (bought && product.left === null && !product.editionOf && price === 0) return { text: 'Yours', off: true }
    // A visitor is shown everything and can take nothing yet: an order needs someone to belong to
    if (visiting) return { text: `Open your pack to ${way === 'request' ? 'request' : way === 'reserve' ? 'reserve' : price === 0 ? 'claim' : 'buy'}`, act: () => window.location.assign(CARD) }
    if (needsOption) return { text: label === 'Color' ? 'Choose a color' : 'Choose one', off: true }
    if (way === 'request') return { text: 'Request', act: order }
    if (way === 'reserve') return { text: 'Reserve', act: order }
    if (due > 0) return { text: `Buy for ${fmtCents(due)}`, act: () => (setError(''), setMode('checkout')) }
    return { text: points > 0 ? `Claim with ${fmtPoints(points)} points` : 'Claim for free', act: order, needs: ships && !here }
  })()
  const press = (
    <button type="button" className={`ui-btn${button.off ? ' off' : ''}`} data-busy={busy || undefined} disabled={button.off || busy || button.needs} onClick={button.act}>
      {button.text}
    </button>
  )
  const caption =
    way !== 'buy' && asked
      ? `${way === 'request' ? 'We’ll write to you about it.' : 'We’ll write when it is ready.'} It is in Yours.`
      : way === 'buy' && !out && !button.off
        ? captionOf(product, balance, points, due, number)
        : ''
  const claiming = way === 'buy' && !out && due === 0 && ships && !button.off
  const said = error && (
    <p className="ui-note" role="alert">
      {error}
    </p>
  )

  const media = (
    <>
      <span className="ui-count">
        {at + 1} of {all.length}
      </span>
      <Picture product={product} size={phone ? 40 : 64} />
      {(done || bought) && <span className="ui-badge on">Yours{done?.order.number ? ` · ${editionOf(done.order.number)}` : ''}</span>}
    </>
  )

  const receipt = done && (
    <>
      <span className="ui-check">
        <Tick />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: phone ? 6 : 8 }}>
        <h1 className="t-title">{done.order.status === 'Requested' ? 'Requested.' : done.order.status === 'Pre-order' ? 'Reserved.' : 'It’s yours.'}</h1>
        <p className="t-words">{done.order.status === 'Requested' ? 'We’ll write to you about it.' : done.order.status === 'Pre-order' ? 'We’ll write when it is ready. Nothing is taken now.' : 'We’ll email you when it is on its way.'}</p>
      </div>
      <dl className="ui-card rows">
        <div>
          <dt>Reference</dt>
          <dd>{done.order.reference}</dd>
        </div>
        <div>
          <dt>Item</dt>
          <dd>
            {done.order.productName}
            {done.order.option ? `, ${swatchOf(done.order.option).name}` : ''}
          </dd>
        </div>
        {done.order.number && (
          <div>
            <dt>Edition</dt>
            <dd>{editionOf(done.order.number)}</dd>
          </div>
        )}
        {way === 'buy' && (
          <div>
            <dt>Paid</dt>
            <dd>{paidOf(done.order) || 'Free'}</dd>
          </div>
        )}
        {ships && (onFile(typed) || onFile(shop.member.shipTo)) && (
          <div>
            <dt>Ship to</dt>
            <dd>{brief(onFile(typed) ? typed : shop.member.shipTo)}</dd>
          </div>
        )}
      </dl>
    </>
  )
  const after = (
    <>
      <a className="ui-btn" href="./" onClick={(e) => (e.preventDefault(), go({ view: 'store' }))}>
        Back to the store
      </a>
      <a className="ui-btn sec" href="?s=yours" onClick={(e) => (e.preventDefault(), go({ view: 'yours' }))}>
        View in Yours
      </a>
    </>
  )

  const checkout = (
    <>
      <div className="ui-item">
        <span className="ui-thumb lg">
          <Picture product={product} size={20} />
        </span>
        <div>
          <b>{product.name}</b>
          <span className="t-sm t-2">{[option ? swatchOf(option).name : '', editionOf(number)].filter(Boolean).join(' · ') || product.kind}</span>
        </div>
      </div>
      {ships && <ShipTo shop={shop} typed={typed} onType={setTyped} go={go} />}
      {sums(false, true)}
      {said}
      <Pay
        backend={backend}
        product={product}
        option={option}
        points={points}
        cents={due}
        stripeKey={shop.stripeKey}
        shipTo={onFile(typed) && !onFile(shop.member.shipTo) ? typed : ''}
        wantsAddress={ships && !here}
        askShipping={ships && !onFile(shop.member.shipTo)}
        onDone={finish}
        onError={setError}
      />
    </>
  )

  if (phone)
    return (
      <>
        <main
          className="up-body"
          style={done ? { gap: 16, paddingTop: 28 } : undefined}
          onTouchStart={(e) => (swipe.current = e.touches[0]!.clientX)}
          onTouchEnd={(e) => {
            const from = swipe.current
            swipe.current = null
            const moved = from === null ? 0 : e.changedTouches[0]!.clientX - from
            // A finger drawn across the picture moves to the next product, or the one before
            if (!done && mode === 'product' && all.length > 1 && Math.abs(moved) > 56 && !(e.target as HTMLElement).closest('input, textarea')) go({ view: 'product', id: neighbour(moved < 0 ? 1 : -1).id })
          }}
        >
          {done ? (
            receipt
          ) : (
            <>
              <figure className="up-media">{media}</figure>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="ui-meta">
                  <span>{product.kind}</span>
                  {badge && !bought && <span className={`ui-badge${badge.tone ? ` ${badge.tone}` : ''}`}>{badge.text}</span>}
                  {keptOf(product) && <span className="ui-badge">{keptOf(product)}</span>}
                </div>
                <h1 className="t-title">{product.name}</h1>
              </div>
              {way === 'reserve' && !asked && <p className="t-words">Not out yet. Reserve a copy and we’ll write when it is ready. Nothing is taken now.</p>}
              {way === 'request' && !asked && <p className="t-words">Made to order, and takes no points. Ask, and we’ll write to you about it.</p>}
              {swatches}
              {way !== 'reserve' && sums(true, false)}
              {claiming && <ShipTo shop={shop} typed={typed} onType={setTyped} go={go} />}
              {mode === 'product' && said}
            </>
          )}
        </main>
        <div className="up-dock" role="region" aria-label={done ? 'What next' : product.name}>
          {done ? (
            after
          ) : (
            <>
              {press}
              <div className="up-pager">
                <ol aria-label={`${at + 1} of ${all.length}`}>
                  {all.map((p) => (
                    <li key={p.id}>
                      <span className={p.id === product.id ? 'at' : undefined} />
                    </li>
                  ))}
                </ol>
                <a className="ui-link" href="./" onClick={(e) => (e.preventDefault(), go({ view: 'store' }))}>
                  View all
                  <Right size={16} />
                </a>
              </div>
            </>
          )}
        </div>
        {mode === 'checkout' && !done && (
          <>
            <div className="up-veil" onClick={() => setMode('product')} />
            <section className="up-sheet" aria-label="Checkout">
              <h1 className="t-h2">Checkout</h1>
              {checkout}
            </section>
          </>
        )}
      </>
    )

  return (
    <>
      <main className="ui-main">
        <figure className="ui-media">
          {all.length > 1 && (
            <a className="ui-round prev" aria-label="Previous" {...to(neighbour(-1))}>
              <Left />
            </a>
          )}
          {media}
          {all.length > 1 && (
            <a className="ui-round next" aria-label="Next" {...to(neighbour(1))}>
              <Right />
            </a>
          )}
        </figure>
        {done ? (
          <section className="ui-col" aria-label="Receipt" key="receipt">
            {receipt}
            {after}
          </section>
        ) : mode === 'checkout' ? (
          <section className="ui-col" style={{ gap: 16 }} aria-label="Checkout" key="checkout">
            <div style={{ margin: '-8px 0 -12px' }}>
              <a className="ui-link quiet" href={`?p=${encodeURIComponent(product.id)}`} onClick={(e) => (e.preventDefault(), setMode('product'))}>
                <Left size={16} />
                {product.name}
              </a>
            </div>
            <h1 className="t-title" style={{ fontSize: 28 }}>
              Checkout
            </h1>
            {checkout}
            {points > 0 && <p className="t-sm t-3">Your {fmtPoints(points)} points are taken with the payment.</p>}
          </section>
        ) : (
          <section className="ui-col" aria-label={product.name} key="product">
            <div className="ui-meta">
              <span>{product.kind}</span>
              {badge && !bought && <span className={`ui-badge${badge.tone ? ` ${badge.tone}` : ''}`}>{badge.text}</span>}
              {keptOf(product) && <span className="ui-badge">{keptOf(product)}</span>}
            </div>
            <h1 className="t-title">{product.name}</h1>
            {product.description && <p className="t-words">{product.description}</p>}
            {way === 'reserve' && !asked && <p className="t-words">Not out yet. Reserve a copy and we’ll write when it is ready. Nothing is taken now.</p>}
            {swatches}
            {way !== 'reserve' && sums(true, true)}
            {way === 'request' && !asked && <p className="t-words">Made to order, and takes no points. Ask, and we’ll write to you about it.</p>}
            {claiming && <ShipTo shop={shop} typed={typed} onType={setTyped} go={go} />}
            {said}
            {press}
            {caption && <p className="t-sm t-3">{caption}</p>}
          </section>
        )}
      </main>
      <nav className="ui-rail" aria-label="Everything in the store">
        <ol>
          {all.map((p) => (
            <li key={p.id}>
              <a aria-current={p.id === product.id ? 'true' : undefined} {...to(p)}>
                <span className="ui-thumb">
                  <Picture product={p} size={20} />
                </span>
                <span>
                  {shortOf(p.name)}
                  <small>{owned(shop.orders, p) ? 'Yours' : priceOf(p) || 'Pre-order'}</small>
                </span>
              </a>
            </li>
          ))}
        </ol>
        <a className="ui-link" href="./" onClick={(e) => (e.preventDefault(), go({ view: 'store' }))}>
          View all
          <Right size={16} />
        </a>
      </nav>
    </>
  )
}

/** An address in a few words, for a receipt: who, and which city. */
const brief = (shipTo: string) => {
  const lines = shipTo.split('\n').filter((line) => line.trim())
  const city = (lines.length > 2 ? lines[lines.length - 1]! : '').split(',')[0]!.trim()
  return [lines[0], city].filter(Boolean).join(', ')
}
