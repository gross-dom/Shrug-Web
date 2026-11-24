import { useEffect, useRef, useState } from 'react'
import { asksAddress, dueCents, fitPoints, fmtCents, fmtPoints, has, mostPoints, numberOf, onFile, postageCents, priceCents, soldOut, wayOf, type Order, type Product } from '../shared/rules'
import type { Backend, Placed, Shop } from './backend'
import { Points } from './brand'
import { KindIcon, Left, Right, Tick } from './icons'
import { Pay, whyNot } from './Pay'
import { shotsOf } from './pictures'
import { badgeOf, captionOf, editionOf, keptOf, owned, pointsOf, shortOf } from './words'

// One product to a screen: its pictures, then what it is and what it costs this member. The arrows on the
// picture (and the arrow keys, and a finger drawn across it) page through that product's own pictures; the
// foot is the way to another product. Checkout and the receipt take the panel's place; the picture stays.
// Everything that is bought goes through the same checkout, whether points cover it or not: what it is,
// where it is going, the sums, and one thing to press. The sums are the store's rules (shared/rules.ts).

export type Go = (to: { view: 'store' } | { view: 'product'; id: string } | { view: 'yours' }) => void

/** The colours a thing comes in, as they are drawn. An option may carry its own ("Sand #c8b89a"); these are known without. */
const COLORS: Record<string, string> = { black: '#1b1c1f', stone: '#b9b2a3', white: '#f4f4f1' }
function swatchOf(option: string): { name: string; color: string | null } {
  const hex = /\s(#[0-9a-f]{3,8})$/i.exec(option)
  const name = hex ? option.slice(0, hex.index).trim() : option
  const known = COLORS[name.toLowerCase()]
  return { name, color: hex?.[1] ?? known ?? (typeof CSS !== 'undefined' && CSS.supports('color', name.toLowerCase()) ? name.toLowerCase() : null) }
}

/** A product's first photograph, small, filling whatever it is put in; until it has one, a drawing of the sort of thing it is. */
export function Picture({ product, size }: { product: Product; size: number }) {
  const shot = shotsOf(product)[0]
  return shot ? (
    <img src={shot.small} alt="" decoding="async" loading="lazy" style={shot.at ? { objectPosition: shot.at } : undefined} />
  ) : (
    <span className="t-3">
      <KindIcon kind={product.kind} size={size} width={size > 40 ? 1.1 : size > 22 ? 1.2 : 1.6} />
    </span>
  )
}

/** A price beside a name: the points mark and the figure, "Free", or nothing for something with no price yet. */
export function Price({ product, size = 16 }: { product: Product; size?: number }) {
  const points = pointsOf(product)
  return points === null ? null : points === 0 ? <>Free</> : <Points n={points} size={size} />
}

/** What an order came to: the points, and whatever was paid by card besides. */
export function Paid({ order, size = 15 }: { order: Pick<Order, 'points' | 'paid'>; size?: number }) {
  if (!order.points && !order.paid) return null
  return (
    <span className="pts-sum">
      {order.points > 0 && <Points n={order.points} size={size} />}
      {order.points > 0 && order.paid > 0 && <span> + </span>}
      {order.paid > 0 && <span>{fmtCents(Math.round(order.paid * 100))}</span>}
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

export function ProductView({ shop, product, phone, backend, go, onPlaced }: { shop: Shop; product: Product; phone: boolean; backend: Backend; go: Go; onPlaced: (placed: Placed) => void }) {
  const all = shop.products
  const at = all.findIndex((p) => p.id === product.id)
  const way = wayOf(product)
  const shots = shotsOf(product)
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
  /** Which of its pictures is on show. */
  const [seen, setSeen] = useState(0)
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
  const turn = (by: number) => setSeen((n) => (n + by + shots.length) % shots.length)

  // The arrow keys page through this product's pictures; Escape leaves checkout
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('input, textarea, select, iframe') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape' && mode === 'checkout') setMode('product')
      else if (shots.length > 1 && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) turn(e.key === 'ArrowRight' ? 1 : -1)
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  }, [mode, shots.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // The next picture is fetched while this one is looked at, so that turning to it is at once
  useEffect(() => {
    const next = shots[(seen + 1) % shots.length]
    if (shots.length > 1 && next) new Image().src = next.full
  }, [seen, product.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

  /** What it comes to: the points used, and whatever is left to pay by card. */
  const total =
    points > 0 ? (
      <span className="pts-sum">
        <Points n={points} size={18} />
        {due > 0 && <span> + {fmtCents(due)}</span>}
      </span>
    ) : due > 0 ? (
      fmtCents(due)
    ) : (
      'Free'
    )

  const sums = (withRange: boolean, full: boolean) => (
    <dl className="ui-card rows">
      <div>
        <dt>Price</dt>
        <dd>{price === 0 ? 'Free' : <Points n={Math.round(product.points ?? 0)} />}</dd>
      </div>
      {way === 'buy' && price > 0 && most > 0 && (
        <div className="pts">
          <dt>Use points</dt>
          <dd>
            <Points n={points} />
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
      {full && way === 'buy' && price + postage > 0 && (
        <div className="total">
          <dt>Total</dt>
          <dd>{total}</dd>
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

  /** The one white button, and what it does. Anything bought goes on to checkout; asking and reserving are one press. */
  const checkOut = () => (setError(''), setMode('checkout'))
  const button = (() => {
    if (way !== 'buy' && asked) return { text: way === 'request' ? 'Requested' : 'Reserved', off: true }
    if (out) return { text: 'Sold out', off: true }
    if (bought && product.left === null && !product.editionOf && price === 0) return { text: 'Yours', off: true }
    if (needsOption) return { text: label === 'Color' ? 'Choose a color' : 'Choose one', off: true }
    if (way === 'request') return { text: 'Request', act: order }
    if (way === 'reserve') return { text: 'Reserve', act: order }
    const verb = product.status === 'Pre-order' ? 'Pre-order' : 'Claim'
    if (points > 0) return { text: `${verb} for ${fmtPoints(points)} points${due > 0 ? ` + ${fmtCents(due)}` : ''}`, act: checkOut }
    return { text: due > 0 ? `${verb === 'Claim' ? 'Buy' : verb} for ${fmtCents(due)}` : `${verb} for free`, act: checkOut }
  })()
  const press = (
    <button type="button" className={`ui-btn${button.off ? ' off' : ''}`} data-busy={busy || undefined} disabled={button.off || busy} onClick={button.act}>
      {button.text}
    </button>
  )
  const caption = way !== 'buy' && asked ? `${way === 'request' ? 'We’ll write to you about it.' : 'We’ll let you know when it’s ready.'} It is in My VIP.` : way === 'buy' && !out && !button.off ? captionOf(product) : ''
  const preorder = product.status === 'Pre-order' && !asked && !bought && <p className="t-words">Reserve a copy and we’ll let you know when it’s ready. You can use points to pre-order today.</p>
  const said = error && (
    <p className="ui-note" role="alert">
      {error}
    </p>
  )

  const shot = shots[seen] ?? null
  const media = (
    <>
      {shot ? (
        <>
          {/* The same picture, out of focus, fills the tile behind it: a tall one and a wide one sit alike */}
          <img className="ui-media-bg" src={shot.small} alt="" aria-hidden="true" />
          <img className="ui-media-pic" key={shot.full} src={shot.full} alt={shots.length > 1 ? `${product.name}: picture ${seen + 1} of ${shots.length}` : product.name} decoding="async" />
        </>
      ) : (
        <span className="t-3">
          <KindIcon kind={product.kind} size={phone ? 40 : 64} width={1.1} />
        </span>
      )}
      {shots.length > 1 && (
        <>
          <button type="button" className="ui-round prev" aria-label="Previous picture" onClick={() => turn(-1)}>
            <Left />
          </button>
          <button type="button" className="ui-round next" aria-label="Next picture" onClick={() => turn(1)}>
            <Right />
          </button>
          <ol className="ui-dots" aria-label={`Picture ${seen + 1} of ${shots.length}`}>
            {shots.map((s, n) => (
              <li key={s.full}>
                <button type="button" className={n === seen ? 'at' : undefined} aria-label={`Picture ${n + 1}`} aria-current={n === seen ? 'true' : undefined} onClick={() => setSeen(n)} />
              </li>
            ))}
          </ol>
        </>
      )}
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
        <p className="t-words">{done.order.status === 'Requested' ? 'We’ll write to you about it.' : done.order.status === 'Pre-order' ? 'We’ll let you know when it’s ready.' : 'We’ll email you when it is on its way.'}</p>
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
            <dd>{done.order.points || done.order.paid ? <Paid order={done.order} /> : 'Free'}</dd>
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
        View in My VIP
      </a>
    </>
  )

  // Checkout: the same whether points cover it or not. With something left to pay, Apple Pay and the card;
  // with nothing, one button that places the order
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
      {due > 0 ? (
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
      ) : (
        <button type="button" className="ui-btn" data-busy={busy || undefined} disabled={busy || (ships && !here)} onClick={order}>
          {ships && !here ? 'Add where to send it' : 'Confirm order'}
        </button>
      )}
    </>
  )
  const taken = points > 0 && <p className="t-sm t-3">{due > 0 ? `Your ${fmtPoints(points)} points are taken with the payment.` : `${fmtPoints(points)} points are taken when you confirm.`}</p>

  if (phone)
    return (
      <>
        <main className="up-body" style={done ? { gap: 16, paddingTop: 28 } : undefined}>
          {done ? (
            receipt
          ) : (
            <>
              <figure
                className="up-media"
                onTouchStart={(e) => (swipe.current = e.touches[0]!.clientX)}
                onTouchEnd={(e) => {
                  const from = swipe.current
                  swipe.current = null
                  const moved = from === null ? 0 : e.changedTouches[0]!.clientX - from
                  // A finger drawn across the picture turns to the next one, or the one before
                  if (shots.length > 1 && Math.abs(moved) > 48) turn(moved < 0 ? 1 : -1)
                }}
              >
                {media}
              </figure>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="ui-meta">
                  <span>{product.kind}</span>
                  {badge && !bought && <span className={`ui-badge${badge.tone ? ` ${badge.tone}` : ''}`}>{badge.text}</span>}
                  {keptOf(product) && <span className="ui-badge">{keptOf(product)}</span>}
                </div>
                <h1 className="t-title">{product.name}</h1>
                {product.description && <p className="t-words">{product.description}</p>}
              </div>
              {preorder}
              {swatches}
              {way !== 'reserve' && sums(true, true)}
              {caption && <p className="t-sm t-3">{caption}</p>}
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
                {all.length > 1 ? (
                  <span className="up-step">
                    <a className="ui-round sm" aria-label={`Previous: ${neighbour(-1).name}`} {...to(neighbour(-1))}>
                      <Left size={16} />
                    </a>
                    <span>
                      {at + 1} of {all.length}
                    </span>
                    <a className="ui-round sm" aria-label={`Next: ${neighbour(1).name}`} {...to(neighbour(1))}>
                      <Right size={16} />
                    </a>
                  </span>
                ) : (
                  <span />
                )}
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
              {taken}
            </section>
          </>
        )}
      </>
    )

  return (
    <>
      <main className="ui-main">
        <figure className="ui-media">{media}</figure>
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
            {taken}
          </section>
        ) : (
          <section className="ui-col" aria-label={product.name} key="product">
            <div className="ui-meta">
              <span>{product.kind}</span>
              {badge && !bought && <span className={`ui-badge${badge.tone ? ` ${badge.tone}` : ''}`}>{badge.text}</span>}
              {keptOf(product) && <span className="ui-badge">{keptOf(product)}</span>}
            </div>
            <div className="ui-name">
              <h1 className="t-title">{product.name}</h1>
              {product.description && <p className="t-words">{product.description}</p>}
            </div>
            {preorder}
            {swatches}
            {way !== 'reserve' && sums(true, true)}
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
                  <small>{owned(shop.orders, p) ? 'Yours' : pointsOf(p) === null ? 'Pre-order' : <Price product={p} size={13} />}</small>
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
