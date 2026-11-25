import { useState } from 'react'
import { awardFor, AWARDS, fmtPoints, onFile, POINTS_PER_DOLLAR, STARTING_POINTS, stockOf, totalPoints, type Order } from '../shared/rules'
import { CARD, type Backend, type Shop } from './backend'
import { Points, Wordmark } from './brand'
import { DESK } from './desk'
import { DocIcon } from './icons'
import { Lines, Paid, Picture } from './Product'
import { editionOf } from './words'

// My VIP (the section the address still calls "yours"): the member's card as the card page draws it (pressed,
// it goes to the card page), their account at a glance (what kind of member they are, their balance, how
// long they have been one, what they have bought and which funds they are in: a word and a figure each,
// and no more), then the history behind each: purchases and where each stands; apart from those, what they
// have only asked for or had kept for them; investments; the points that have been awarded and spent; how
// points work; and the cards at the side: where things are sent, emails, and whose account this is.
// Everything here is what the server says of them: nothing is worked out that it does not know.

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

const nothingOf = (order: Order) => (order.status === 'Pre-order' ? 'Nothing taken' : order.status === 'Requested' ? '' : 'Free')
const nameOf = (order: Order) => `${order.productName}${order.option ? `, ${order.option.replace(/\s#[0-9a-f]{3,8}$/i, '')}` : ''}`
/** A purchase: something was taken for it, points or dollars, or it was claimed for nothing. A request, and a
 * place kept with nothing taken, are not: they are listed apart, so that neither is read as something bought. */
const purchased = (order: Order) => order.status !== 'Requested' && order.status !== 'Ready' && !(order.status === 'Pre-order' && !order.points && !order.paid)
/** What was bought, and not since given back. */
const boughtOf = (orders: Order[]) => orders.filter((order) => purchased(order) && order.status !== 'Refunded')
const WORDS: Record<string, string> = { Founder: 'Founder', LP: 'Limited partner', Investor: 'Investor' }

/** Where things are sent: shown, and changed here. */
function Address({ shop, backend, onChange, style }: { shop: Shop; backend: Backend; onChange: () => void; style?: React.CSSProperties }) {
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
    onChange()
  }
  if (typing !== null)
    return (
      <div className="ui-card" style={style}>
        <label className="ui-field">
          <span className="t-sm t-2">Shipping address</span>
          <textarea className="ui-area" rows={4} autoFocus value={typing} placeholder={'Name\nStreet address\nCity, State ZIP'} autoComplete="street-address" onChange={(e) => setTyping(e.target.value)} />
        </label>
        {said && (
          <p className="t-sm" style={{ color: 'var(--red)', paddingTop: 8 }} role="alert">
            {said}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, paddingTop: 12 }}>
          <button type="button" className="ui-btn sm" data-busy={busy || undefined} disabled={busy || !onFile(typing)} onClick={save}>
            Save
          </button>
          <button type="button" className="ui-btn sec sm" disabled={busy} onClick={() => setTyping(null)}>
            Cancel
          </button>
        </div>
      </div>
    )
  return (
    <div className="ui-card" style={style}>
      <div className="ui-split">
        <div>
          <span className="t-sm t-2">Shipping address</span>
          <p>{onFile(shop.member.shipTo) ? <Lines text={shop.member.shipTo} /> : <span className="t-2">None yet</span>}</p>
        </div>
        <button type="button" className="ui-btn sec sm" onClick={() => (setSaid(''), setTyping(shop.member.shipTo))}>
          {onFile(shop.member.shipTo) ? 'Change' : 'Add'}
        </button>
      </div>
    </div>
  )
}

/** What is on a card where a name would be, until its member has given one: two lines, as the card page sets them. */
const NO_NAME = ['Your name', 'here']

export function YoursView({ shop, phone, backend, onChange, onSignOut }: { shop: Shop; phone: boolean; backend: Backend; onChange: () => void; onSignOut: () => void }) {
  const me = shop.member
  const [emails, setEmails] = useState(me.emails)
  const stock = stockOf(me.tier)
  const Stock = stock[0]!.toUpperCase() + stock.slice(1)
  const spent = shop.orders.filter((order) => order.points > 0 && order.status !== 'Refunded')
  const bought = boughtOf(shop.orders)
  /** What each purchase awarded (shared/rules.ts says what buying a thing awards). */
  const awards = bought.map((order) => ({ order, points: awardFor(shop.products.find((p) => p.id === order.productId) ?? { kind: 'Other', status: 'Available', points: null }) })).filter((award) => award.points > 0)
  /** Every point they have been awarded: it is what their card shows, and it only goes up. */
  const total = totalPoints(me, shop.orders)
  // Airtable keeps the balance and the last reason, not each award: what was awarded apart from purchases is
  // said as the one line it comes to, which is everything they have had less what their purchases awarded
  const given = Math.max(0, total - awards.reduce((sum, award) => sum + award.points, 0))
  const flip = async () => {
    const next = !emails
    setEmails(next)
    const told = await backend.emails(next)
    if ('error' in told) setEmails(!next)
  }

  // The account at a glance: a word and a figure each. Each figure is one the lists below it account for
  const stats = (
    <dl className="ui-stats">
      <div>
        <dt>Account</dt>
        <dd>{me.roles.length ? me.roles.join(' · ') : 'Member'}</dd>
      </div>
      <div>
        <dt>Card</dt>
        <dd>{Stock}</dd>
      </div>
      <div>
        <dt>Balance</dt>
        <dd>
          <Points n={me.points} size={18} />
        </dd>
      </div>
      <div>
        <dt>Member since</dt>
        <dd>{me.since ?? '—'}</dd>
      </div>
      <div>
        <dt>Purchases</dt>
        <dd>{bought.length}</dd>
      </div>
      <div>
        <dt>Investments</dt>
        <dd>{me.funds.length}</dd>
      </div>
    </dl>
  )

  const rows = (list: Order[]) => (
        <ol className="ui-list">
          {list.map((order) => {
            const product = shop.products.find((p) => p.id === order.productId)
            const facts = [editionOf(order.number), order.reference, when(order.placed)].filter(Boolean).join(' · ')
            const taken = order.points || order.paid ? <Paid order={order} size={13} /> : nothingOf(order)
            return (
              <li key={order.id} className="ui-row ui-ord">
                {!phone && <span className="ui-thumb lg">{product ? <Picture product={product} size={20} /> : <DocIcon />}</span>}
                <span className="who">
                  <b>{nameOf(order)}</b>
                  <span>{phone ? <>{[editionOf(order.number), when(order.placed)].filter(Boolean).join(' · ')}</> : facts}</span>
                </span>
                <span className="ui-badge">{standOf(order, shop)}</span>
                {!phone && <span className="r t-sm t-2">{taken || ' '}</span>}
              </li>
            )
          })}
        </ol>
  )
  const purchases = shop.orders.filter(purchased)
  const asks = shop.orders.filter((order) => !purchased(order))
  // What has been bought, and then, under a heading of its own, what has only been asked for or kept
  const orders = (
    <>
      <h2 className="ui-sect">Purchase history</h2>
      {purchases.length > 0 ? rows(purchases) : <p className="ui-none">Nothing yet. What you buy in ArtStore, Books or Workspace is kept here.</p>}
      {asks.length > 0 && (
        <>
          <h2 className="ui-sect">Requests and reservations</h2>
          {rows(asks)}
        </>
      )}
    </>
  )
  const funds = me.funds.length > 0 && (
    <>
      <h2 className="ui-sect">Investment history</h2>
      <ol className="ui-list">
        {me.funds.map((fund) => (
          <li key={fund} className="ui-row ui-pts">
            <span className="who">
              <b>{fund}</b>
              <span>{me.roles.includes('LP') ? 'Limited partner' : (WORDS[me.roles[0] ?? ''] ?? 'Member')}</span>
            </span>
            <span className="r t-sm t-2">Fund</span>
          </li>
        ))}
      </ol>
    </>
  )
  const points = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 className="ui-sect">Points</h2>
        <span className="t-sm t-2 pts-sum">
          Balance <Points n={me.points} size={13} />
        </span>
      </div>
      <ol className="ui-list">
        {spent.map((order) => (
          <li key={order.id} className="ui-row ui-pts">
            <span className="who">
              <b>{nameOf(order)}</b>
              <span>{when(order.placed)}</span>
            </span>
            <span className="r">
              <Points n={order.points} size={14} sign="−" />
            </span>
          </li>
        ))}
        {awards.map(({ order, points }) => (
          <li key={`award-${order.id}`} className="ui-row ui-pts">
            <span className="who">
              <b>Awarded for {nameOf(order)}</b>
              <span>{when(order.placed)}</span>
            </span>
            <span className="r t-gold">
              <Points n={points} size={14} sign="+" />
            </span>
          </li>
        ))}
        {given > 0 && (
          <li className="ui-row ui-pts">
            <span className="who">
              <b>{me.reason ? `For ${me.reason}` : 'Points awarded'}</b>
              <span>{me.since ? `Member since ${me.since}` : ' '}</span>
            </span>
            <span className="r t-gold">
              <Points n={given} size={14} sign="+" />
            </span>
          </li>
        )}
      </ol>
    </>
  )
  // How points work, in the three things there are to know: how they come, what they do, and what the card shows
  const chair = AWARDS.Chair ?? 0
  const how = (
    <>
      <h2 className="ui-sect">How points work</h2>
      <ol className="ui-how">
        <li>
          <b>Earn</b>
          <span>
            {fmtPoints(STARTING_POINTS)} points when you join{chair > 0 ? `, and ${fmtPoints(chair)} each time you buy a Workspace chair` : ''}.
          </span>
        </li>
        <li>
          <b>Spend</b>
          <span>
            {POINTS_PER_DOLLAR} points take $1 off anything in ArtStore, Books and Workspace. You choose how many to use at checkout.
          </span>
        </li>
        <li>
          <b>Total</b>
          <span>Your card shows every point you’ve been awarded, so it only goes up. Your balance is what’s left to spend.</span>
        </li>
      </ol>
    </>
  )
  const emailsCard = (
    <div className="ui-card" style={phone ? { marginTop: 14 } : undefined}>
      <div className="ui-split" style={{ alignItems: 'center' }}>
        <div>
          <span className="t-sm t-2">Emails</span>
          <p>Points and new arrivals</p>
        </div>
        <button type="button" className="ui-toggle" role="switch" aria-checked={emails} aria-label="Emails about points and new arrivals" onClick={flip} />
      </div>
    </div>
  )
  const account = (
    <div className="ui-card" style={phone ? { marginTop: 14 } : undefined}>
      <div className="ui-split" style={{ alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          {/* (in a window of the desk, in the desk's own words for it: Log In and Log Out) */}
          <span className="t-sm t-2">{DESK ? 'Logged in as' : 'Signed in as'}</span>
          <p style={{ overflowWrap: 'anywhere' }}>{me.email}</p>
        </div>
        {/* (in a window of the desk the way out is the menu bar's, and nowhere else) */}
        {!DESK && (
          <button type="button" className="ui-btn sec sm" onClick={onSignOut}>
            Sign out
          </button>
        )}
      </div>
    </div>
  )

  // Their card, as the card page draws it. Pressed, it goes there
  const card = (
    <a className="mc-link" href={CARD}>
      {/* (said first, and what is on the card after it: a link's name holds the words it shows) */}
      <span className="sr">Your card. Open it. </span>
      <div className={`mc m-${stock}`}>
        <div className="mc-top">
          <Wordmark lockup="shrug" height={15} />
          <small>
            {Stock}
            {me.number ? ` · No. ${me.number}` : ''}
          </small>
        </div>
        <div className="mc-win">
          {/* A long name is set smaller, so that its longest word still fits the window */}
          {/* A member who has not given a name yet (a standard one, newly made) has the card's own words there */}
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
    </a>
  )

  if (phone)
    return (
      <main className="up-body" style={{ gap: 0, paddingBottom: 28 }}>
        <h1 className="t-title">My VIP</h1>
        <div className="mc-row">{card}</div>
        {stats}
        {orders}
        {funds}
        {points}
        {how}
        <Address shop={shop} backend={backend} onChange={onChange} style={{ marginTop: 14 }} />
        {emailsCard}
        {account}
      </main>
    )

  return (
    <main className="ui-page" style={{ gridTemplateColumns: '223px minmax(0, 1fr) minmax(260px, 320px)' }}>
      <div style={{ paddingTop: 6 }}>{card}</div>
      <div>
        <div className="ui-head" style={{ paddingBottom: 14 }}>
          <h1 className="t-title">My VIP</h1>
        </div>
        {stats}
        {orders}
        {funds}
        {points}
        {how}
      </div>
      <aside className="ui-side" style={{ paddingTop: 58 }}>
        <Address shop={shop} backend={backend} onChange={onChange} />
        {emailsCard}
        {account}
      </aside>
    </main>
  )
}
