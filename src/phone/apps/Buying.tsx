import { useEffect, useState, type ReactNode } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { asksAddress, dueCents, fitPoints, fmtCents, fmtPoints, mostPoints, numberOf, onFile, postageCents, priceCents, sellsMany, soldOut, times, wayOf, type Product } from '../../../store/shared/rules'
import type { Placed, Shop } from '../../../store/src/backend'
import { PointsMark } from '../../../store/src/brand'
import { Pay, whyNot } from '../../../store/src/Pay'
import { editionOf, offCents, paidOf, shipsOf, shipsWhen } from '../../../store/src/words'
import { refreshAccount } from '../../os/account'
import { backend, loadShop, useShop } from '../../os/shop'
import { createStore, useStore } from '../../os/store'
import { addPhoneNext, LOGIN, LogInSheet } from '../LogIn'
import { closeSheet, openSheet } from '../system'
import { SheetHost, Tray } from '../ui'
import { MyVipSheet } from './MyVip'
import { brief, drawnOn, optionName, Thumb } from './storebits'
import { VIP } from './Wallet'
import '../../styles/phone/shop.css'

// Buying, on the phone: one tray (ui.tsx, `Tray`), up over whatever is being bought, wherever that is: a
// piece in ArtStore, a book in Books, a chair in Workspace. It is the store's own checkout (store/src/
// Product.tsx) drawn as the phone's: what it is, where it is going, the sums (with the points a member would
// use, theirs to ease off), and the ways to pay; then, in the same tray, the receipt. The sums are the
// store's rules (store/shared/rules.ts) and the payment is the store's own (store/src/Pay.tsx): nothing about
// money is worked out here that is not worked out there.
//
// Nobody is taken anywhere to buy: the tray comes up over the page they were on, and put away leaves them
// on it. An address is asked for only once a way to finish is chosen that needs one (a card, or points
// alone: Apple Pay brings its own), and only if there is none on file.

export const CHECKOUT = 'checkout'

/** What is being bought: which product, in which colour, and how many (a book can be bought several at once). */
export const buying = createStore<{ id: string; option: string; count: number } | null>(null)

/** Brings checkout up for a product, over the app in front. */
export function checkOut(product: Pick<Product, 'id'>, option = '', count = 1) {
  buying.set({ id: product.id, option, count })
  openSheet(CHECKOUT)
}

function Checkout({ product, shop, visiting, option, count }: { product: Product; shop: Shop; visiting: boolean; option: string; count: number }) {
  const way = wayOf(product)
  const many = sellsMany(product)
  const lot = times(product, many ? count : 1)
  // What the member has to spend. It stays as it was once something is bought, so that the receipt's sums
  // are the ones that were paid
  const [balance, setBalance] = useState(shop.member.points)
  const most = mostPoints({ points: balance }, lot)
  // To begin with every point it will take is used: that is its best price, and the member can ease them off
  const [wanted, setWanted] = useState(most)
  const [done, setDone] = useState<Placed | null>(null)
  const [typed, setTyped] = useState('')
  /** A visitor's email (where the receipt goes, and what the account their payment makes is under) and name. */
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  /** A way to finish that needs an address has been chosen (a card, or points alone). */
  const [finishing, setFinishing] = useState(false)
  /** The address on file is being changed: what is typed of the new one. */
  const [changing, setChanging] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (done || busy || shop.member.points === balance) return
    setBalance(shop.member.points)
    setWanted(mostPoints({ points: shop.member.points }, lot))
  }, [shop.member.points]) // eslint-disable-line react-hooks/exhaustive-deps

  const points = way === 'buy' ? fitPoints({ points: balance }, lot, wanted) : 0
  const price = priceCents(lot)
  const postage = postageCents(lot)
  const due = way === 'buy' ? dueCents(lot, points) : 0
  const ships = asksAddress(product)
  const needsAddress = ships && !onFile(shop.member.shipTo)
  const number = way === 'buy' && !soldOut(product) ? numberOf(product) : ''
  const choosing = way === 'buy' && most > 0 && price > 0
  // The sums follow the slider at once; the way to pay is set up for the figure it comes to rest on
  const [settled, setSettled] = useState(points)
  useEffect(() => {
    const rest = setTimeout(() => setSettled(points), 350)
    return () => clearTimeout(rest)
  }, [points])
  const settledDue = way === 'buy' ? dueCents(lot, settled) : 0

  const finish = (placed: Placed) => {
    setDone(placed)
    setError('')
    // The balance and the orders are the same ones everywhere: the phone's own figures are asked for again
    void refreshAccount()
    void loadShop()
  }
  const order = async () => {
    setBusy(true)
    setError('')
    const placed = await backend.order({ product: product.id, option, count: many ? count : 1, points, shipTo: onFile(typed) ? typed : undefined })
    setBusy(false)
    if ('error' in placed) setError(whyNot(placed.error))
    else finish(placed)
  }
  const keep = async () => {
    setBusy(true)
    setError('')
    const kept = await backend.address(changing ?? '')
    setBusy(false)
    if ('error' in kept) return setError(kept.error === 'address' ? 'A name and an address, on a line each.' : kept.error === 'offline' ? 'No connection.' : 'That did not save. Try again.')
    setChanging(null)
    void loadShop()
  }

  const said = error && (
    <p className="co-said" role="alert">
      {error}
    </p>
  )
  const area = (value: string, onType: (text: string) => void) => (
    <label className="co-field co-address">
      <span>Ship to</span>
      <textarea rows={Math.min(6, Math.max(3, value.split('\n').length))} autoFocus value={value} placeholder={'Name\nStreet address\nCity, State ZIP'} autoComplete="street-address" onChange={(e) => (onType(e.target.value), setError(''))} />
    </label>
  )

  // ---- The receipt, in the tray the order was placed from
  if (done) {
    const sent = shipsWhen(product)
    const dated = shipsOf(product)
    const head = done.order.status === 'Requested' ? 'Requested.' : done.order.status === 'Pre-order' ? (done.order.points || done.order.paid ? 'Pre-ordered.' : 'Reserved.') : 'It’s yours.'
    const words =
      done.order.status === 'Requested'
        ? 'We’ll write to you about it.'
        : done.order.status === 'Pre-order'
          ? (done.order.paid || done.order.points ? sent : dated)
            ? `It ships ${done.order.paid || done.order.points ? sent : dated}. We’ll email you when it is on its way.`
            : 'We’ll let you know when it’s ready.'
          : 'We’ll email you when it is on its way.'
    const to = onFile(typed) ? typed : shop.member.shipTo
    return (
      <Tray label="Receipt" dark step="done" title={<span className="co-head">{head}</span>} leading={<Tick />}>
        <div className="co" data-at="done">
          <p className="co-words">{words}</p>
          <dl className="co-rows">
            <Row name="Reference">{done.order.reference}</Row>
            <Row name="Item">
              {done.order.productName}
              {done.order.option ? `, ${optionName(done.order.option)}` : ''}
            </Row>
            {done.order.number && <Row name="Edition">{editionOf(done.order.number)}</Row>}
            {way === 'buy' && <Row name="Paid">{paidOf(done.order) || 'Free'}</Row>}
            {ships && onFile(to) && <Row name="Ship to">{brief(to)}</Row>}
          </dl>
          {(done.awarded ?? 0) > 0 && (
            <p className="co-earned" role="status">
              <PointsMark size={16} />
              You earned {fmtPoints(done.awarded!)} points for this purchase.
            </p>
          )}
          {done.account === 'new' ? (
            <>
              <p className="co-words">You have an account now. It uses the email you just checked out with. Please add your phone number for order updates.</p>
              <button type="button" className="ui-btn" onClick={addPhoneNext}>
                Add Phone Number
              </button>
              <button type="button" className="ui-link" onClick={() => closeSheet()}>
                Not now
              </button>
              {(done.email ?? email) && <p className="co-fine">Your receipt is on its way to {done.email ?? email} either way.</p>}
            </>
          ) : (
            <>
              {done.account === 'theirs' && <p className="co-words">That email already has an account, so this order is in its My VIP. Log in to see it.</p>}
              <button type="button" className="ui-btn" onClick={() => closeSheet()}>
                Done
              </button>
              {done.account !== 'theirs' && (
                <button type="button" className="ui-btn sec" onClick={() => openSheet(VIP)}>
                  View in My VIP
                </button>
              )}
            </>
          )}
        </div>
      </Tray>
    )
  }

  // ---- The address on file, being changed
  if (changing !== null)
    return (
      <Tray label="Shipping address" dark step="address" title={<span className="co-head">Ship to</span>}>
        <div className="co" data-at="address">
          {area(changing, setChanging)}
          {said}
          <button type="button" className="ui-btn" data-busy={busy || undefined} disabled={busy || !onFile(changing)} onClick={() => void keep()}>
            Save
          </button>
          <button type="button" className="ui-link" disabled={busy} onClick={() => (setError(''), setChanging(null))}>
            Cancel
          </button>
        </div>
      </Tray>
    )

  // ---- What it is, where it goes, what it comes to, and the ways to finish
  const total = price + postage === 0 ? 'Free' : fmtCents(due)
  const facts = [option ? optionName(option) : '', editionOf(number), many && count > 1 ? `${count} × ${fmtCents(priceCents(product))}` : ''].filter(Boolean).join(' · ')
  const addressField = area(typed, setTyped)
  const waiting = finishing && needsAddress && !onFile(typed)
  const verb = way === 'request' ? 'Request' : way === 'reserve' ? 'Reserve' : null
  return (
    <Tray label="Checkout" dark step="review" title={<span className="co-head">{verb ?? 'Checkout'}</span>}>
      <div className="co" data-at="review">
        <div className="co-item">
          <Thumb product={product} drawn={drawnOn(shop.products, product)} />
          <span className="co-what">
            <b>{product.name}</b>
            {facts && <small>{facts}</small>}
          </span>
          {way === 'buy' && <span className="co-price">{price === 0 ? 'Free' : fmtCents(price)}</span>}
        </div>

        {visiting && way === 'buy' && (
          <div className="co-fields">
            <label className="co-field">
              <span className="sr-only">Your name</span>
              <input type="text" autoComplete="name" autoCapitalize="words" spellCheck={false} placeholder="Your name" value={name} onChange={(e) => (setName(e.target.value), setError(''))} />
            </label>
            <label className="co-field">
              <span className="sr-only">Email for the receipt</span>
              <input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="Email for the receipt" value={email} onChange={(e) => (setEmail(e.target.value), setError(''))} />
            </label>
          </div>
        )}

        {way === 'buy' && (
          <dl className="co-rows">
            {ships && onFile(shop.member.shipTo) && (
              <div className="co-row">
                <dt>Ship to</dt>
                <dd>
                  <button type="button" className="co-change" aria-label={`Ship to ${brief(shop.member.shipTo)}. Change`} onClick={() => (setError(''), setChanging(shop.member.shipTo))}>
                    {brief(shop.member.shipTo)}
                    <ChevronRight size={16} strokeWidth={2.6} aria-hidden />
                  </button>
                </dd>
              </div>
            )}
            {choosing && (
              <div className="co-row co-points">
                <dt>
                  <PointsMark size={15} />
                  {fmtPoints(points)} <small>of your {fmtPoints(balance)} points</small>
                </dt>
                <dd>{points > 0 ? `−${fmtCents(offCents(points))}` : fmtCents(0)}</dd>
                <input
                  type="range"
                  className="co-range"
                  min={0}
                  max={most}
                  step={most % 10 === 0 ? 10 : 1}
                  value={points}
                  style={{ ['--at' as string]: `${most ? (points / most) * 100 : 0}%` }}
                  aria-label={`Points to use, up to ${fmtPoints(most)}`}
                  aria-valuetext={`${fmtPoints(points)} points, ${fmtCents(offCents(points))} off, ${fmtCents(due)} to pay`}
                  onChange={(e) => setWanted(Number(e.target.value))}
                />
              </div>
            )}
            {postage > 0 && <Row name="Shipping">{fmtCents(postage)}</Row>}
            {price + postage > 0 && (
              <div className="co-row co-total">
                <dt>Total</dt>
                <dd>{total}</dd>
              </div>
            )}
          </dl>
        )}
        {way !== 'buy' && <p className="co-words">{way === 'request' ? 'We’ll write to you about it.' : `We’ll let you know when it’s ready.${shipsOf(product) ? ` It ships ${shipsOf(product)}.` : ''}`}</p>}
        {said}

        {way !== 'buy' ? (
          <button type="button" className="ui-btn" data-busy={busy || undefined} disabled={busy} onClick={() => void order()}>
            {verb}
          </button>
        ) : due > 0 ? (
          settledDue > 0 ? (
            <div className="co-pay" data-moving={settled !== points || undefined}>
              <Pay
                backend={backend}
                product={product}
                option={option}
                count={many ? count : 1}
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
            <button type="button" className={`ui-btn${waiting ? ' off' : ''}`} data-busy={busy || undefined} disabled={busy || waiting} onClick={() => (needsAddress && !onFile(typed) ? setFinishing(true) : void order())}>
              {waiting ? 'Confirm Address' : 'Confirm Order'}
            </button>
          </>
        )}
      </div>
    </Tray>
  )
}

const Row = ({ name, children }: { name: string; children: ReactNode }) => (
  <div className="co-row">
    <dt>{name}</dt>
    <dd>{children}</dd>
  </div>
)

const Tick = () => (
  <span className="co-check" aria-hidden>
    <Check size={17} strokeWidth={3.2} />
  </span>
)

/** The tray itself: drawn by an app's sheets for the name `CHECKOUT`. */
export function CheckoutTray() {
  const asked = useStore(buying, (s) => s)
  const got = useShop()
  const product = got && asked ? (got.shop.products.find((p) => p.id === asked.id) ?? null) : null
  if (!asked || !got || !product)
    return (
      <Tray label="Checkout" dark title={<span className="co-head">Checkout</span>}>
        <div className="co" aria-busy={!got || undefined}>
          {got && <p className="co-words">That is not in the store just now.</p>}
        </div>
      </Tray>
    )
  return <Checkout key={`${product.id}:${asked.option}:${asked.count}`} product={product} shop={got.shop} visiting={got.visiting} option={asked.option} count={asked.count} />
}

/** What can come up over an app that sells something: Log In, checkout, and My VIP. */
export function StoreSheets() {
  return <SheetHost>{(name) => (name === LOGIN ? <LogInSheet /> : name === CHECKOUT ? <CheckoutTray /> : name === VIP ? <MyVipSheet /> : null)}</SheetHost>
}
