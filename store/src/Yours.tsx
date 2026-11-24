import { useState } from 'react'
import { fmtCents, fmtPoints, onFile, type Order } from '../shared/rules'
import type { Backend, Shop } from './backend'
import { Points, Wordmark } from './brand'
import { DocIcon } from './icons'
import { Lines, Paid, Picture } from './Product'
import { editionOf } from './words'

// My VIP (the section the address still calls "yours"): the member's card as the card page draws it, their
// account at a glance (what kind of member they are, their balance, how long they have been one, what they
// have bought and which funds they are in), then the history behind each: purchases and where each stands,
// investments, the points that have come and gone; and three cards: where things are sent, emails, and the
// account. Everything here is what the server says of them: nothing is worked out that it does not know.

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
/** What was bought, and not since given back: an update unlocked counts, a request or a reservation does not. */
const boughtOf = (orders: Order[]) => orders.filter((order) => ['Paid', 'Points', 'Sent', 'Ready'].includes(order.status))
const WORDS: Record<string, string> = { Founder: 'Founder', LP: 'Limited partner', Investor: 'Investor' }
/** How long a member has been one, from the year on their card. */
const yearsOf = (since: number) => {
  const years = new Date().getFullYear() - since
  return years <= 0 ? 'This year' : years === 1 ? '1 year' : `${years} years`
}

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

export function YoursView({ shop, phone, backend, onChange, onSignOut }: { shop: Shop; phone: boolean; backend: Backend; onChange: () => void; onSignOut: () => void }) {
  const me = shop.member
  const [emails, setEmails] = useState(me.emails)
  const metal = me.tier === 'gold' || me.tier === 'black' ? me.tier : 'silver'
  const Metal = metal[0]!.toUpperCase() + metal.slice(1)
  const spent = shop.orders.filter((order) => order.points > 0)
  const spentPoints = spent.reduce((sum, order) => sum + order.points, 0)
  const bought = boughtOf(shop.orders)
  const paid = bought.reduce((sum, order) => sum + order.paid, 0)
  // Airtable keeps the balance and the last reason, not each award: what was given is said as the one line
  // it comes to, the balance and everything since spent
  const given = me.points + spentPoints
  const flip = async () => {
    const next = !emails
    setEmails(next)
    const told = await backend.emails(next)
    if ('error' in told) setEmails(!next)
  }

  // The account at a glance. Each figure is one the lists below it account for
  const stats = (
    <dl className="ui-stats">
      <div>
        <dt>Account type</dt>
        <dd>{me.roles.length ? me.roles.join(' · ') : 'Member'}</dd>
        <dd className="sub">{me.roles.map((role) => WORDS[role] ?? role).join(', ') || 'On the list'}</dd>
      </div>
      <div>
        <dt>Card</dt>
        <dd>{Metal}</dd>
        <dd className="sub">{me.number ? `No. ${me.number} · Series 01` : 'Series 01'}</dd>
      </div>
      <div>
        <dt>Balance</dt>
        <dd>
          <Points n={me.points} size={18} />
        </dd>
        <dd className="sub">{spentPoints > 0 ? `${fmtPoints(spentPoints)} spent so far` : 'Nothing spent yet'}</dd>
      </div>
      <div>
        <dt>Member since</dt>
        <dd>{me.since ?? '—'}</dd>
        <dd className="sub">{me.since ? yearsOf(me.since) : 'Not on file'}</dd>
      </div>
      <div>
        <dt>Purchases</dt>
        <dd>{bought.length}</dd>
        <dd className="sub">{bought.length === 0 ? 'Nothing yet' : paid > 0 ? `${fmtCents(Math.round(paid * 100))} paid by card` : 'All with points'}</dd>
      </div>
      <div>
        <dt>Investments</dt>
        <dd>{me.funds.length}</dd>
        <dd className="sub">{me.funds.length ? me.funds.join(', ') : 'No funds on file'}</dd>
      </div>
    </dl>
  )

  const orders = (
    <>
      <h2 className="ui-sect">Purchase history</h2>
      {shop.orders.length > 0 ? (
        <ol className="ui-list">
          {shop.orders.map((order) => {
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
      ) : (
        <p className="ui-none">Nothing yet. What you claim in the store is kept here.</p>
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
        {given > 0 && (
          <li className="ui-row ui-pts">
            <span className="who">
              <b>{me.reason ? `For ${me.reason}` : 'Points given'}</b>
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
          <span className="t-sm t-2">Signed in as</span>
          <p style={{ overflowWrap: 'anywhere' }}>{me.email}</p>
        </div>
        <button type="button" className="ui-btn sec sm" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  )

  if (phone)
    return (
      <main className="up-body" style={{ gap: 0, paddingBottom: 28 }}>
        <h1 className="t-title">My VIP</h1>
        {stats}
        {orders}
        {funds}
        {points}
        <Address shop={shop} backend={backend} onChange={onChange} style={{ marginTop: 14 }} />
        {emailsCard}
        {account}
      </main>
    )

  return (
    <main className="ui-page" style={{ gridTemplateColumns: '223px minmax(0, 1fr) minmax(260px, 320px)' }}>
      <div style={{ paddingTop: 6 }}>
        <div className={`mc m-${metal}`} aria-label="Your card">
          <div className="mc-top">
            <Wordmark lockup="shrug" height={15} />
            <small>
              {Metal}
              {me.number ? ` · No. ${me.number}` : ''}
            </small>
          </div>
          <div className="mc-win">
            {/* A long name is set smaller, so that its longest word still fits the window */}
            <b style={{ fontSize: Math.min(60, Math.round(430 / Math.max(...me.name.split(/\s+/).map((word) => word.length), 1))) }}>{me.name}</b>
          </div>
          <div className="mc-band">
            <b>{me.roles[0] ?? 'Member'}</b>
            <small>{me.since ? `Member since ${me.since}` : ''}</small>
          </div>
          <div className="mc-pts">
            <div>
              <small>Points</small>
              <b>{fmtPoints(me.points)}</b>
            </div>
            <i>
              Series 01
              <br />1 of 1
            </i>
          </div>
        </div>
      </div>
      <div>
        <div className="ui-head" style={{ paddingBottom: 14 }}>
          <h1 className="t-title">My VIP</h1>
        </div>
        {stats}
        {orders}
        {funds}
        {points}
      </div>
      <aside className="ui-side" style={{ paddingTop: 58 }}>
        <Address shop={shop} backend={backend} onChange={onChange} />
        {emailsCard}
        {account}
      </aside>
    </main>
  )
}
