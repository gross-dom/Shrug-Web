import { useEffect, useRef, useState } from 'react'
import { asksAddress, dueCents, fitPoints, fmtCents, fmtPoints, has, mostPoints, numberOf, onFile, POINTS_PER_DOLLAR, postageCents, priceCents, soldOut, wayOf, type Order, type Product } from '../shared/rules'
import { CARD, type Backend, type Placed, type Shop } from './backend'
import { Points, PointsMark } from './brand'
import { DESK } from './desk'
import { KindIcon, Left, Right, Tick } from './icons'
import { Pay, whyNot } from './Pay'
import { shotsOf, tileSizes, wholeSizes } from './pictures'
import { NAMES, nameIn, ROOM } from './room'
import { badgeOf, editionOf, keptOf, offCents, owned, pointsOf, shortOf } from './words'

// One product to a screen: its pictures, then what it is and what it costs this member. The arrows on the
// picture (and the arrow keys, and a finger drawn across it) page through that product's own pictures; the
// foot is the way to another product. Checkout and the receipt take the panel's place; the picture stays.
// Everything that is bought goes through the same checkout, whether points cover it or not: what it is,
// the sums, and the ways to finish. The address is asked for only once a way is chosen that needs one (a
// card, or points alone: Apple Pay brings its own), and only if there is none on file. The sums are the
// store's rules (shared/rules.ts).

export type Go = (to: { view: 'store' } | { view: 'product'; id: string } | { view: 'yours' }) => void

/** The colours a thing comes in, as they are drawn. An option may carry its own ("Sand #c8b89a"); these are known without. */
const COLORS: Record<string, string> = { black: '#1b1c1f', stone: '#b9b2a3', white: '#f4f4f1' }
function swatchOf(option: string): { name: string; color: string | null } {
  const hex = /\s(#[0-9a-f]{3,8})$/i.exec(option)
  const name = hex ? option.slice(0, hex.index).trim() : option
  const known = COLORS[name.toLowerCase()]
  return { name, color: hex?.[1] ?? known ?? (typeof CSS !== 'undefined' && CSS.supports('color', name.toLowerCase()) ? name.toLowerCase() : null) }
}

/** A product's first photograph, filling whatever it is put in: small for a thumbnail, and for a tile in the
 * display (`tile`) whichever of its sizes is sharp there. Until it has one, a drawing of the sort of thing it is. */
export function Picture({ product, size, tile }: { product: Product; size: number; tile?: boolean }) {
  const shot = shotsOf(product)[0]
  return shot ? (
    <img src={tile ? shot.full : shot.small} srcSet={tile ? shot.set : undefined} sizes={tile ? tileSizes(shot) : undefined} alt="" decoding="async" loading="lazy" style={shot.at ? { objectPosition: shot.at } : undefined} />
  ) : (
    <span className="t-3">
      <KindIcon kind={product.kind} size={size} width={size > 40 ? 1.1 : size > 22 ? 1.2 : 1.6} />
    </span>
  )
}

/** A price beside a name, in dollars: "$150", "Free", or nothing for something with no price yet. Something
 * that is only ever asked for has no price to say, and says how it is had instead. A chair's price is for
 * someone logged in: a visitor is told so in its place. */
export function Price({ product }: { product: Product; size?: number }) {
  const points = pointsOf(product)
  if (wayOf(product) === 'request') return <span className="t-3">On request</span>
  if (product.priceHidden) return <span className="t-3">Log in for price</span>
  return points === null ? null : points === 0 ? <>Free</> : <>{fmtCents(priceCents(product))}</>
}

/** What an order came to: what was paid, in dollars, and the points that were used besides. */
export function Paid({ order, size = 15 }: { order: Pick<Order, 'points' | 'paid'>; size?: number }) {
  if (!order.points && !order.paid) return null
  return (
    <span className="pts-sum">
      {order.paid > 0 && <span>{fmtCents(Math.round(order.paid * 100))}</span>}
      {order.points > 0 && order.paid > 0 && <span> + </span>}
      {order.points > 0 && <Points n={order.points} size={size} />}
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

/** Where it is going, when there is an address on file: the address, with the way to change it. */
function OnFile({ shop, go }: { shop: Shop; go: Go }) {
  return (
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
  )
}

/** Somewhere to type an address, when there is none on file: it is kept for next time. It is as tall as what is typed in it. */
function AddressField({ typed, onType }: { typed: string; onType: (text: string) => void }) {
  return (
    <div className="ui-card">
      <label className="ui-field">
        <span className="t-sm t-2">Ship to</span>
        <textarea className="ui-area" rows={Math.min(7, Math.max(3, typed.split('\n').length))} autoFocus value={typed} placeholder={'Name\nStreet address\nCity, State ZIP'} autoComplete="street-address" onChange={(e) => onType(e.target.value)} />
      </label>
    </div>
  )
}

/** After a visitor has paid: their payment made them an account, under the email they checked out with.
 * They are told so and asked for a phone number, for news of the order (and it is how they log in from then
 * on: it is texted six digits, and the six digits make it theirs). A number or a code that cannot be one is
 * said to be so where it was typed. With the number added they are taken to My VIP, where the order is (and,
 * the first time, their pack); what is left here says so, for when they come back to this window. */
function NewAccount({ backend, email, onLater, onYours }: { backend: Backend; email: string; onLater: () => void; onYours: () => void }) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code' | 'done'>('phone')
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState('')
  const WHY: Record<string, string> = { phone: 'That doesn’t look like a phone number. Include the area code.', wrong: 'That code isn’t right. Try again.', taken: 'That number is on another account. Log in with it instead.', locked: 'Too many tries. Try again in a few minutes.', expired: 'That code has run out. Send a new one.', wait: 'One was sent a moment ago. Give it a minute.' }
  /** What is wrong with what was typed, before anything is asked of the server; nothing, if it could be right. */
  const wrong = (): string => {
    if (step === 'phone') {
      if (/[a-z]/i.test(phone)) return 'A phone number is digits only.'
      const digits = phone.replace(/\D/g, '')
      if (digits.length < 10) return 'That number is too short. Include the area code.'
      if (digits.length > 15) return 'That number is too long.'
      return ''
    }
    return /^\d{6}$/.test(code) ? '' : 'The code is six digits.'
  }
  const ask = async (given?: string) => {
    const before = wrong()
    if (before) return setSaid(before)
    setBusy(true)
    setSaid('')
    const answer = await backend.phone(phone, given)
    setBusy(false)
    if ('error' in answer) return setSaid(WHY[answer.error] ?? 'That didn’t work. Try again.')
    if (!given) return setStep('code')
    setStep('done')
    // The desk shows who is logged in: it is told there is someone now. And they are taken straight to
    // My VIP, where their order is and their pack is waiting: nothing more is said here first
    DESK?.changed()
    onYours()
  }
  if (step === 'done')
    return (
      <>
        <div className="ui-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="t-h2">You’re all set.</h2>
          <p className="t-sm t-2">Order updates will come to that number. Track this order in My VIP.</p>
        </div>
        <button type="button" className="ui-btn" onClick={onYours}>
          Open My VIP
        </button>
      </>
    )
  return (
    <>
      <div className="ui-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 className="t-h2">You have an account now.</h2>
        <p className="t-sm t-2">It uses the email you just checked out with. Please add your phone number for order updates.</p>
        {step === 'phone' ? (
          <input className="ui-in" type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 (___) ___ ____" aria-label="Phone number" aria-invalid={!!said || undefined} value={phone} onChange={(e) => (setPhone(e.target.value), setSaid(''))} onKeyDown={(e) => e.key === 'Enter' && !busy && void ask()} />
        ) : (
          <input className="ui-in" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="The six digits we texted" aria-label="Six-digit code" aria-invalid={!!said || undefined} value={code} onChange={(e) => (setCode(e.target.value.slice(0, 6)), setSaid(''))} onKeyDown={(e) => e.key === 'Enter' && !busy && void ask(code)} />
        )}
        {said && (
          <p className="ui-note" role="alert">
            {said}
          </p>
        )}
        <button type="button" className="ui-btn" data-busy={busy || undefined} disabled={busy || (step === 'phone' ? !phone.trim() : !code.trim())} onClick={() => ask(step === 'code' ? code : undefined)}>
          {step === 'phone' ? 'Text Me a Code' : 'Confirm'}
        </button>
      </div>
      <button type="button" className="ui-link quiet ui-other" onClick={onLater}>
        Not now
      </button>
      {email && (
        <p className="t-sm t-3" style={{ textAlign: 'center' }}>
          Your receipt is on its way to {email} either way.
        </p>
      )}
    </>
  )
}

export function ProductView({ shop, visiting, product, phone, backend, go, onPlaced }: { shop: Shop; /** Nobody is signed in: everything is shown, and the button is the way to the card. */ visiting?: boolean; product: Product; phone: boolean; backend: Backend; go: Go; onPlaced: (placed: Placed) => void }) {
  const all = shop.products
  const at = all.findIndex((p) => p.id === product.id)
  const way = wayOf(product)
  const shots = shotsOf(product)
  // What the member has to spend. It stays as it was once something is bought here, so that the receipt's
  // sums are the ones that were paid; until then it follows what they have now (below)
  const [balance, setBalance] = useState(shop.member.points)
  const most = mostPoints({ points: balance }, product)
  const [option, setOption] = useState(product.options.length === 1 ? product.options[0]! : '')
  // To begin with every point it will take is used: that is its best price, and the member can ease them off
  const [wanted, setWanted] = useState(most)
  const [mode, setMode] = useState<'product' | 'checkout'>('product')
  const [done, setDone] = useState<Placed | null>(null)
  const [typed, setTyped] = useState('')
  /** A visitor's email: where the receipt goes, and what the account their payment makes is under. */
  const [email, setEmail] = useState('')
  /** A visitor's name: whose account it is, and what their card is printed with. */
  const [name, setName] = useState('')
  /** A visitor whose payment made them an account has put off giving it a phone number. */
  const [later, setLater] = useState(false)
  /** At checkout: a way to finish that needs an address has been chosen (a card, or points alone), so the address is asked for now, if there is none on file. */
  const [finishing, setFinishing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  /** Which of its pictures is on show. */
  const [seen, setSeen] = useState(0)
  const swipe = useRef<number | null>(null)

  // Someone who logs in while they are looking at this, or spends points in another of the desk's stores,
  // is shown their own sums: every point they have now, to begin with
  useEffect(() => {
    if (done || busy || shop.member.points === balance) return
    setBalance(shop.member.points)
    setWanted(mostPoints({ points: shop.member.points }, product))
  }, [shop.member.points]) // eslint-disable-line react-hooks/exhaustive-deps

  // Checkout can be taller than the room a window gives it (an address on file, points to choose, two ways
  // to pay; or the address asked for under the sums). Where it is, the column is taken to its foot, so that
  // the ways to pay are in sight and it is the heading, which they have just read, that is scrolled away
  useEffect(() => {
    if (mode !== 'checkout') return
    const toFoot = () => {
      const col = document.querySelector<HTMLElement>('.ui-col[aria-label="Checkout"], .up-sheet')
      col?.scrollTo({ top: col.scrollHeight, behavior: 'smooth' })
    }
    const now = requestAnimationFrame(toFoot)
    // (and again once the card's own fields, which arrive a moment later, have taken their room)
    const later = setTimeout(toFoot, 600)
    return () => (cancelAnimationFrame(now), clearTimeout(later))
  }, [mode, finishing])

  const points = way === 'buy' ? fitPoints({ points: balance }, product, wanted) : 0
  const price = priceCents(product)
  const postage = postageCents(product)
  const due = way === 'buy' ? dueCents(product, points) : 0
  const asked = has(shop.orders, product)
  const bought = owned(shop.orders, product)
  const out = soldOut(product) && way !== 'request'
  const ships = asksAddress(product)
  // It is posted, and there is nowhere on file to post it: an address is wanted before a card is taken or points alone are used
  const needsAddress = ships && !onFile(shop.member.shipTo)
  const number = way === 'buy' && !out ? numberOf(product) : ''
  const needsOption = product.options.length > 0 && !option
  // Wherever points can be used the member says how many, on the product and again at checkout: all of
  // them to begin with, and fewer if they would sooner keep some and pay the rest by card
  const choosing = way === 'buy' && most > 0 && price > 0
  // At checkout the sums follow the slider at once; the way to pay is set up for the figure it comes to rest on
  const [settled, setSettled] = useState(points)
  useEffect(() => {
    const rest = setTimeout(() => setSettled(points), 350)
    return () => clearTimeout(rest)
  }, [points])
  const settledDue = way === 'buy' ? dueCents(product, settled) : 0
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

  /** What it comes to, in dollars: the price, less what the points take off, and the postage. */
  const total = price + postage === 0 ? 'Free' : fmtCents(due)

  const sums = (withRange: boolean, full: boolean) => (
    <dl className="ui-card rows">
      <div>
        <dt>Price</dt>
        <dd>{price === 0 ? 'Free' : fmtCents(price)}</dd>
      </div>
      {way === 'buy' && price > 0 && most > 0 && (
        <div className="pts">
          <dt>
            <Points n={points} /> <span className="t-3">of your {fmtPoints(balance)}</span>
          </dt>
          <dd>{points > 0 ? `−${fmtCents(offCents(points))}` : fmtCents(0)}</dd>
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
              aria-valuetext={`${fmtPoints(points)} points, ${fmtCents(offCents(points))} off, ${fmtCents(due)} to pay`}
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
  const checkOut = () => (setError(''), setFinishing(false), setMode('checkout'))
  const button = (() => {
    if (way !== 'buy' && asked) return { text: way === 'request' ? 'Requested' : 'Reserved', off: true }
    if (out) return { text: 'Sold out', off: true }
    if (bought && product.left === null && !product.editionOf && price === 0) return { text: 'Yours', off: true }
    // A visitor can buy what is paid for with money: the payment makes their account. Asking, reserving and
    // what costs nothing need someone for the order to belong to, so those are the way in instead
    // (in a window of the desk, the desk's Log In, which says what it was opened for)
    // A chair's price is for someone logged in: the way to it is the way in
    if (product.priceHidden) return DESK ? { text: 'Log in to see the price', act: () => DESK!.logIn('price') } : { text: 'Sign in to see the price', act: () => window.location.assign(`${CARD}?signin=store`) }
    if (visiting && !(way === 'buy' && due > 0)) {
      const what = way === 'request' ? 'request' : way === 'reserve' ? 'reserve' : 'claim'
      return DESK ? { text: `Log in to ${what}`, act: () => DESK!.logIn(way === 'request' ? 'request' : 'store') } : { text: `Open your pack to ${what}`, act: () => window.location.assign(CARD) }
    }
    if (needsOption) return { text: label === 'Color' ? 'Choose a color' : 'Choose one', off: true }
    if (way === 'request') return { text: 'Request', act: order }
    if (way === 'reserve') return { text: 'Reserve', act: order }
    const verb = product.status === 'Pre-order' ? 'Pre-order' : 'Buy'
    // In dollars, as everything is: what is left to pay once the points they are using have come off
    if (due > 0) return { text: `${verb} for ${fmtCents(due)}`, act: checkOut }
    return { text: points > 0 ? `${verb} with ${fmtPoints(points)} points` : price + postage === 0 ? `${verb === 'Buy' ? 'Claim' : verb} for free` : `${verb} for ${fmtCents(0)}`, act: checkOut }
  })()
  const press = (
    <button type="button" className={`ui-btn${button.off ? ' off' : ''}`} data-busy={busy || undefined} disabled={button.off || busy} onClick={button.act}>
      {button.text}
    </button>
  )
  const caption = way !== 'buy' && asked ? `${way === 'request' ? 'We’ll write to you about it.' : 'We’ll let you know when it’s ready.'} It is in My VIP.` : ''
  const preorder = product.status === 'Pre-order' && !asked && !bought && <p className="t-words">Reserve a copy and we’ll let you know when it’s ready.</p>
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
          <img className="ui-media-pic" key={shot.full} src={shot.full} srcSet={shot.set} sizes={wholeSizes(shot)} alt={shot.drawn ? `${product.name}: a drawing of it` : shots.length > 1 ? `${product.name}: picture ${seen + 1} of ${shots.length}` : product.name} decoding="async" />
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
    </>
  )

  const receipt = done && (
    <>
      <span className="ui-check">
        <Tick />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: phone ? 6 : 8 }}>
        <h1 className="t-title">{done.order.status === 'Requested' ? 'Requested.' : done.order.status === 'Pre-order' ? (done.order.points || done.order.paid ? 'Pre-ordered.' : 'Reserved.') : 'It’s yours.'}</h1>
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
            {nameIn({ name: done.order.productName })}
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
      {(done.awarded ?? 0) > 0 && (
        <p className="ui-earned" role="status">
          <PointsMark size={16} />
          You earned {fmtPoints(done.awarded!)} points for this purchase.
        </p>
      )}
    </>
  )
  const after =
    done?.account === 'new' && !later ? (
      // A visitor's payment made them an account: they are told so, and asked for the number they will log in with
      <NewAccount backend={backend} email={done.email ?? email} onLater={() => setLater(true)} onYours={() => go({ view: 'yours' })} />
    ) : (
    <>
      {done?.account === 'theirs' && <p className="t-sm t-2">That email already has an account, so this order is in its My VIP. Log in to see it.</p>}
      <a className="ui-btn" href="./" onClick={(e) => (e.preventDefault(), go({ view: 'store' }))}>
        {/* (in a window of the desk, by the window's own name) */}
        Back to {ROOM && ROOM !== 'yours' ? NAMES[ROOM] : 'the store'}
      </a>
      <a className="ui-btn sec" href="?s=yours" onClick={(e) => (e.preventDefault(), go({ view: 'yours' }))}>
        View in My VIP
      </a>
    </>
    )

  // Checkout: the same whether points cover it or not, with the slider again in case they would sooner not
  // use them all. First the ways to finish: with something left to pay, Apple Pay and the card; with nothing,
  // one button that places the order. Then, for a way that needs one, the address
  const addressField = <AddressField typed={typed} onType={(text) => (setTyped(text), setError(''))} />
  const waiting = finishing && needsAddress && !onFile(typed)
  const checkout = (
    <>
      <div className="ui-item">
        <span className="ui-thumb lg">
          <Picture product={product} size={20} />
        </span>
        <div>
          <b>{nameIn(product)}</b>
          {/* (which color, and which of the edition: nothing, where there is neither) */}
          {(option || number) && <span className="t-sm t-2">{[option ? swatchOf(option).name : '', editionOf(number)].filter(Boolean).join(' · ')}</span>}
        </div>
      </div>
      {ships && onFile(shop.member.shipTo) && <OnFile shop={shop} go={go} />}
      {visiting && (
        <div className="ui-pair">
          <label className="ui-field">
            <span className="sr">Your name</span>
            <input className="ui-in" type="text" autoComplete="name" autoCapitalize="words" spellCheck={false} placeholder="Your name" value={name} onChange={(e) => (setName(e.target.value), setError(''))} />
          </label>
          <label className="ui-field">
            <span className="sr">Email for the receipt</span>
            <input className="ui-in" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="Email for the receipt" value={email} onChange={(e) => (setEmail(e.target.value), setError(''))} />
          </label>
        </div>
      )}
      {sums(true, true)}
      {said}
      {due > 0 ? (
        settledDue > 0 ? (
          <div className="ui-pay" data-moving={settled !== points || undefined}>
            <Pay
              backend={backend}
              product={product}
              option={option}
              points={settled}
              cents={settledDue}
              stripeKey={shop.stripeKey}
              shipTo={needsAddress && onFile(typed) ? typed : ''}
              needsAddress={needsAddress}
              email={visiting ? email : undefined}
              name={visiting ? name : undefined}
              byCard={finishing}
              onCard={() => setFinishing(true)}
              onOptions={() => (setError(''), setFinishing(false))}
              address={addressField}
              onDone={finish}
              onError={setError}
            />
          </div>
        ) : (
          <button type="button" className="ui-btn off" disabled>
            Pay {fmtCents(due)}
          </button>
        )
      ) : (
        <>
          {finishing && needsAddress && addressField}
          {/* Points alone give no address: pressed with none on file, this asks for one, and then places the order */}
          <button type="button" className={`ui-btn${waiting ? ' off' : ''}`} data-busy={busy || undefined} disabled={busy || waiting} onClick={() => (needsAddress && !onFile(typed) ? setFinishing(true) : order())}>
            {waiting ? 'Add where to send it' : 'Confirm order'}
          </button>
        </>
      )}
    </>
  )

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
                {((badge && !bought) || keptOf(product)) && (
                  <div className="ui-meta">
                    {badge && !bought && <span className={`ui-badge${badge.tone ? ` ${badge.tone}` : ''}`}>{badge.text}</span>}
                    {keptOf(product) && <span className="ui-badge">{keptOf(product)}</span>}
                  </div>
                )}
                <h1 className="t-title">{nameIn(product)}</h1>
                {product.description && <p className="t-words">{product.description}</p>}
              </div>
              {preorder}
              {swatches}
              {way !== 'reserve' && !product.priceHidden && sums(true, true)}
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
                {nameIn(product)}
              </a>
            </div>
            <h1 className="t-title" style={{ fontSize: 28 }}>
              Checkout
            </h1>
            {checkout}
          </section>
        ) : (
          <section className="ui-col" aria-label={product.name} key="product">
            {((badge && !bought) || keptOf(product)) && (
              <div className="ui-meta">
                {badge && !bought && <span className={`ui-badge${badge.tone ? ` ${badge.tone}` : ''}`}>{badge.text}</span>}
                {keptOf(product) && <span className="ui-badge">{keptOf(product)}</span>}
              </div>
            )}
            <div className="ui-name">
              <h1 className="t-title">{nameIn(product)}</h1>
              {product.description && <p className="t-words">{product.description}</p>}
            </div>
            {preorder}
            {swatches}
            {way !== 'reserve' && !product.priceHidden && sums(true, true)}
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
                  <small>{owned(shop.orders, p) ? 'You own this' : pointsOf(p) === null ? 'Pre-order' : <Price product={p} size={13} />}</small>
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
