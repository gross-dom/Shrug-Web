import { useEffect, useState, type ReactNode } from 'react'
import { ChevronRight, Lock } from 'lucide-react'
import { awardFor, fmtPoints, onFile, stockOf, totalPoints, type Order } from '../../../store/shared/rules'
import type { Shop } from '../../../store/src/backend'
import { PointsMark, Wordmark } from '../../../store/src/brand'
import { editionOf, paidOf, shipsOf } from '../../../store/src/words'
import { account, askLogIn } from '../../os/account'
import { launchApp } from '../../os/launch'
import { backend, loadShop, useShop, wantShop } from '../../os/shop'
import { useStore } from '../../os/store'
import { LOGIN, LogInSheet } from '../LogIn'
import { closeSheet } from '../system'
import { NavStack, Screen, Sheet, SheetHost, Switch, useApp } from '../ui'
import { drawnOn, optionName, Thumb } from './storebits'
import { Me } from './Wallet'
import '../../styles/phone/shop.css'

// My VIP, on the phone: what is a member's. Their card, their account at a glance (a word and a figure
// each), then the history behind each figure: what they have bought and where each order stands; what they
// have only asked for; the funds they are in; the points awarded and spent; and where things are sent,
// emails, and where to write for help. It is the store's own My VIP (store/src/Yours.tsx) drawn as the
// phone's, from the same answer: nothing is worked out here that the store does not say.
//
// It comes two ways. From a store (the balance in its bar) it is a sheet over the store, put away with a
// pull or its Done: nobody is taken out of what they were buying to look at their points. As an app of its
// own (from search, or a link) it is the same thing as a screen, with the ways in to the three stores.

/** What points are, in the one line there is of it for now (Dom, 26 Nov). */
const POINTS_EXPLAINED = 'Earn points and use them across the Shrug VIP experience.'
/** Where a member writes for help (Dom, 26 Nov). */
const SUPPORT = 'support@vip.labs'

const WHEN = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const when = (iso: string) => (Number.isFinite(Date.parse(iso)) ? WHEN.format(Date.parse(iso)) : '')

/** Where an order stands, as its badge says it. A request for an update that has since been opened to them says Open. */
function standOf(order: Order, shop: Shop): string {
  const update = shop.updates.some((u) => u.id === order.productId)
  if (order.status === 'Requested') return shop.updates.some((u) => u.id === order.productId && u.state === 'open') ? 'Open' : 'Requested'
  if (update && (order.status === 'Points' || order.status === 'Paid')) return 'Unlocked'
  if (order.status === 'Pre-order' && (order.points || order.paid)) return 'Pre-ordered'
  return ({ Paid: 'Ordered', Points: 'Ordered', Sent: 'Sent', 'Pre-order': 'Reserved', Ready: 'Ready', 'Needs review': 'Being checked', Refunded: 'Refunded' } as Record<string, string>)[order.status] ?? order.status
}
const nameOf = (order: Order) => `${order.productName}${order.option ? `, ${optionName(order.option)}` : ''}`
/** A purchase: something was taken for it, points or dollars, or it was claimed for nothing. A request, and a
 * place kept with nothing taken, are not: they are listed apart, so that neither is read as something bought. */
const purchased = (order: Order) => order.status !== 'Requested' && order.status !== 'Ready' && !(order.status === 'Pre-order' && !order.points && !order.paid)
const WORDS: Record<string, string> = { Founder: 'Founder', LP: 'Limited partner', Investor: 'Investor' }
/** What is on a card where a name would be, until its member has given one. */
const NO_NAME = ['Your name', 'here']

/** The three stores, as My VIP leads to them, each in Dom's line for it (27 Nov). */
const DOORS = [
  { app: 'store', name: 'ArtStore', says: 'Tech Culture art for your walls' },
  { app: 'books', name: 'Books', says: 'Beautifully designed reading material' },
  { app: 'workspace', name: 'Workspace', says: 'Your new daily driver' },
] as const

const Pts = ({ n, sign = '' }: { n: number; sign?: string }) => (
  <span className="vp-pts">
    <PointsMark size={14} />
    {sign}
    {fmtPoints(n)}
  </span>
)

/** Where things are sent: shown, and changed in its place. */
function Address({ shop }: { shop: Shop }) {
  const [typing, setTyping] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState('')
  const save = async () => {
    setBusy(true)
    setSaid('')
    const kept = await backend.address(typing ?? '')
    setBusy(false)
    if ('error' in kept) return setSaid(kept.error === 'address' ? 'A name and an address, on a line each.' : kept.error === 'offline' ? 'No connection.' : 'That did not save. Try again.')
    setTyping(null)
    void loadShop()
  }
  if (typing !== null)
    return (
      <div className="vp-group vp-edit">
        <label>
          <span className="sr-only">Shipping address</span>
          <textarea rows={4} autoFocus value={typing} placeholder={'Name\nStreet address\nCity, State ZIP'} autoComplete="street-address" onChange={(e) => setTyping(e.target.value)} />
        </label>
        {said && (
          <p className="vp-said" role="alert">
            {said}
          </p>
        )}
        <div className="vp-edit__acts">
          <button type="button" disabled={busy} onClick={() => setTyping(null)}>
            Cancel
          </button>
          <button type="button" data-go disabled={busy || !onFile(typing)} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  return (
    <div className="vp-group">
      <button type="button" className="vp-row" onClick={() => (setSaid(''), setTyping(shop.member.shipTo))}>
        <span className="vp-who">
          {onFile(shop.member.shipTo) ? (
            shop.member.shipTo.split('\n').map((line, n) => (n === 0 ? <b key={n}>{line}</b> : <small key={n}>{line}</small>))
          ) : (
            <b className="vp-quiet">None yet</b>
          )}
        </span>
        <span className="vp-act">{onFile(shop.member.shipTo) ? 'Change' : 'Add'}</span>
      </button>
    </div>
  )
}

/** Everything that is a member's. `doors`: with the ways in to the three stores (the app has them; over a store, the sheet does not). */
export function VipBody({ doors }: { doors?: boolean }) {
  const got = useShop()
  const who = useStore(account, (s) => s.status)
  const [emails, setEmails] = useState<boolean | null>(null)

  if (who === 'anon' || (got && got.visiting && who !== 'checking'))
    return (
      <div className="vp vp-door">
        <Lock size={30} strokeWidth={1.8} aria-hidden />
        <h3>Log in to see My VIP</h3>
        <p>Your card, your points and your orders are kept here.</p>
        <button type="button" className="vp-go" onClick={() => askLogIn()}>
          Log In
        </button>
      </div>
    )
  if (!got || got.visiting) return <div className="vp vp-wait" aria-busy="true" aria-label="Opening My VIP" />

  const shop = got.shop
  const me = shop.member
  const stock = stockOf(me.tier)
  const Stock = stock[0]!.toUpperCase() + stock.slice(1)
  const live = shop.orders.filter((order) => order.status !== 'Refunded')
  const bought = live.filter(purchased)
  const spent = live.filter((order) => order.points > 0)
  /** What each purchase awarded (store/shared/rules.ts says what buying a thing awards). */
  const awards = bought.map((order) => ({ order, points: awardFor(shop.products.find((p) => p.id === order.productId) ?? { kind: 'Other', status: 'Available', points: null }) })).filter((award) => award.points > 0)
  /** Every point they have been awarded: it is what their card shows, and it only goes up. */
  const total = totalPoints(me, shop.orders)
  const given = Math.max(0, total - awards.reduce((sum, award) => sum + award.points, 0))
  const purchases = shop.orders.filter(purchased)
  const asks = shop.orders.filter((order) => !purchased(order))
  const on = emails ?? me.emails
  const flip = async (next: boolean) => {
    setEmails(next)
    const told = await backend.emails(next)
    if ('error' in told) setEmails(!next)
  }

  const rows = (list: Order[]) => (
    <ol className="vp-group">
      {list.map((order) => {
        const product = shop.products.find((p) => p.id === order.productId)
        // (a pre-order that has not been sent says when it will be, where Shrug has said)
        const ships = order.status === 'Pre-order' ? shipsOf(product, true) : null
        const taken = paidOf(order)
        return (
          <li key={order.id} className="vp-row">
            <Thumb product={product} size={44} drawn={drawnOn(shop.products, product)} />
            <span className="vp-who">
              <b>{nameOf(order)}</b>
              <small>{[editionOf(order.number), when(order.placed), ships && `Ships ${ships}`].filter(Boolean).join(' · ')}</small>
              {taken && <small>{taken}</small>}
            </span>
            <span className="vp-badge">{standOf(order, shop)}</span>
          </li>
        )
      })}
    </ol>
  )
  const Stat = ({ name, children }: { name: string; children: ReactNode }) => (
    <div>
      <dt>{name}</dt>
      <dd>{children}</dd>
    </div>
  )

  return (
    <div className="vp">
      <div className="vp-card">
        <div className={`mc m-${stock}`} role="img" aria-label={`Your card: ${me.name || 'no name yet'}, ${me.roles[0] ?? 'Member'}, ${fmtPoints(total)} total points`}>
          <div className="mc-top">
            <Wordmark lockup="shrug" height={15} />
            <small>
              {Stock}
              {me.number ? ` · No. ${me.number}` : ''}
            </small>
          </div>
          <div className="mc-win">
            {/* A long name is set smaller, so that its longest word still fits the window */}
            {me.name ? (
              <b style={{ fontSize: Math.min(60, Math.round(430 / Math.max(...me.name.split(/\s+/).map((word) => word.length), 1))) }}>{me.name}</b>
            ) : (
              <b style={{ fontSize: Math.round(430 / NO_NAME[0]!.length), whiteSpace: 'nowrap' }}>
                {NO_NAME[0]}
                <br />
                {NO_NAME[1]}
              </b>
            )}
          </div>
          <div className="mc-band">
            <b>{me.roles[0] ?? 'Member'}</b>
            <small>{me.since ? `Member since ${me.since}` : ''}</small>
          </div>
          <div className="mc-pts">
            <div>
              <small>Total points</small>
              <b>{fmtPoints(total)}</b>
            </div>
            <i>
              Series 01
              <br />1 of 1
            </i>
          </div>
        </div>
      </div>

      <dl className="vp-stats">
        <Stat name="Account">{me.roles.length ? me.roles.join(' · ') : 'Member'}</Stat>
        <Stat name="Card">{Stock}</Stat>
        <Stat name="Balance">
          <Pts n={me.points} />
        </Stat>
        <Stat name="Member since">{me.since ?? '—'}</Stat>
        <Stat name="Purchases">{bought.length}</Stat>
        <Stat name="Investments">{me.funds.length}</Stat>
      </dl>
      <p className="vp-fine">{POINTS_EXPLAINED}</p>

      {doors && <h3 className="vp-sect">Our Shops</h3>}
      {doors && (
        <nav className="vp-group" aria-label="Our Shops">
          {DOORS.map((door) => (
            <button key={door.app} type="button" className="vp-row" onClick={() => launchApp(door.app)}>
              <span className="vp-who">
                <b>{door.name}</b>
                <small>{door.says}</small>
              </span>
              <ChevronRight size={17} strokeWidth={2.6} aria-hidden />
            </button>
          ))}
        </nav>
      )}

      <h3 className="vp-sect">Purchase history</h3>
      {purchases.length > 0 ? rows(purchases) : <p className="vp-none">Nothing yet. What you buy in ArtStore, Books or Workspace is kept here.</p>}
      {asks.length > 0 && (
        <>
          <h3 className="vp-sect">Requests and reservations</h3>
          {rows(asks)}
        </>
      )}

      {me.funds.length > 0 && (
        <>
          <h3 className="vp-sect">Investment history</h3>
          <ol className="vp-group">
            {me.funds.map((fund) => (
              <li key={fund} className="vp-row">
                <span className="vp-who">
                  <b>{fund}</b>
                  <small>{me.roles.includes('LP') ? 'Limited partner' : (WORDS[me.roles[0] ?? ''] ?? 'Member')}</small>
                </span>
                <span className="vp-act vp-quiet">Fund</span>
              </li>
            ))}
          </ol>
        </>
      )}

      <h3 className="vp-sect">
        Points
        <span>
          Balance <Pts n={me.points} />
        </span>
      </h3>
      {spent.length + awards.length > 0 || given > 0 ? (
        <ol className="vp-group">
          {spent.map((order) => (
            <li key={order.id} className="vp-row">
              <span className="vp-who">
                <b>{nameOf(order)}</b>
                <small>{when(order.placed)}</small>
              </span>
              <Pts n={order.points} sign="−" />
            </li>
          ))}
          {awards.map(({ order, points }) => (
            <li key={`award-${order.id}`} className="vp-row" data-gold>
              <span className="vp-who">
                <b>Awarded for {nameOf(order)}</b>
                <small>{when(order.placed)}</small>
              </span>
              <Pts n={points} sign="+" />
            </li>
          ))}
          {given > 0 && (
            <li className="vp-row" data-gold>
              <span className="vp-who">
                <b>{me.reason ? `For ${me.reason}` : 'Points awarded'}</b>
                {me.since && <small>Member since {me.since}</small>}
              </span>
              <Pts n={given} sign="+" />
            </li>
          )}
        </ol>
      ) : (
        <p className="vp-none">No points yet.</p>
      )}

      <h3 className="vp-sect">Shipping address</h3>
      <Address shop={shop} />

      <h3 className="vp-sect">Account</h3>
      <div className="vp-group">
        <div className="vp-row">
          <span className="vp-who">
            <b>Emails</b>
            <small>Points and new arrivals</small>
          </span>
          <Switch on={on} label="Emails about points and new arrivals" onChange={(next) => void flip(next)} />
        </div>
        <button type="button" className="vp-row" onClick={() => askLogIn()}>
          <span className="vp-who">
            <b>Logged in as</b>
            <small>{me.email}</small>
          </span>
          <ChevronRight size={17} strokeWidth={2.6} aria-hidden />
        </button>
        <a className="vp-row" href={`mailto:${SUPPORT}`}>
          <span className="vp-who">
            <b>Need help?</b>
            <small>We’ll write back.</small>
          </span>
          <span className="vp-act">Contact Support</span>
        </a>
      </div>
    </div>
  )
}

/** My VIP over a store: a sheet, put away with a pull or Done. Drawn by an app's sheets for the name `VIP`. */
export function MyVipSheet() {
  useEffect(() => wantShop(), [])
  return (
    <Sheet
      label="My VIP"
      title="My VIP"
      ground="#1c1c1e"
      className="ios-sheet--dark vp-sheet"
      trailing={
        <button type="button" className="vp-done" onClick={() => closeSheet()}>
          Done
        </button>
      }
    >
      <VipBody />
    </Sheet>
  )
}

function Front() {
  return (
    <Screen title="My VIP" large tone="dark" trailing={<Me />} className="vp-screen">
      <VipBody doors />
    </Screen>
  )
}

export function MyVipApp() {
  const { active } = useApp()
  // A card has a name on it: someone logged in who has not yet said what they are called is asked as it opens
  const nameless = useStore(account, (s) => s.status === 'member' && !s.name.trim())
  useEffect(() => {
    if (active) wantShop()
  }, [active])
  useEffect(() => {
    if (active && nameless) askLogIn('name')
  }, [active, nameless])
  return (
    <>
      <NavStack>{() => <Front />}</NavStack>
      <SheetHost>{(name) => (name === LOGIN ? <LogInSheet /> : null)}</SheetHost>
    </>
  )
}
