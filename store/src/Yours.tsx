import { useState } from 'react'
import { fmtPoints, onFile, type Order } from '../shared/rules'
import type { Backend, Shop } from './backend'
import { DocIcon, KindIcon } from './icons'
import { Lines } from './Product'
import { editionOf, paidOf } from './words'

// Yours: the member's card as the card page draws it, what they have ordered and where each stands, the
// points that have come and gone, and three cards: where things are sent, emails, and the account. The
// markup is the design's (store/design/screens: Yours, PhoneYours).

const WHEN = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const when = (iso: string) => (Number.isFinite(Date.parse(iso)) ? WHEN.format(Date.parse(iso)) : '')

/** Where an order stands, as its badge says it. A request for an update that has since been opened to them says Open. */
function standOf(order: Order, shop: Shop): string {
  if (order.status === 'Requested') return shop.updates.some((u) => u.id === order.productId && u.state === 'open') ? 'Open' : 'Requested'
  return ({ Paid: 'Ordered', Points: 'Ordered', Sent: 'Sent', 'Pre-order': 'Reserved', Ready: 'Ready', 'Needs review': 'Being checked', Refunded: 'Refunded' } as Record<string, string>)[order.status] ?? order.status
}

const takenOf = (order: Order) => paidOf(order) || (order.status === 'Pre-order' ? 'Nothing taken' : order.status === 'Requested' ? '' : 'Free')
const nameOf = (order: Order) => `${order.productName}${order.option ? `, ${order.option.replace(/\s#[0-9a-f]{3,8}$/i, '')}` : ''}`

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
  const spent = shop.orders.filter((order) => order.points > 0)
  // Airtable keeps the balance and the last reason, not each award: what was given is said as the one line
  // it comes to, the balance and everything since spent
  const given = me.points + spent.reduce((sum, order) => sum + order.points, 0)
  const flip = async () => {
    const next = !emails
    setEmails(next)
    const told = await backend.emails(next)
    if ('error' in told) setEmails(!next)
  }

  const orders = shop.orders.length > 0 && (
    <>
      <h2 className="ui-sect">Orders</h2>
      <ol className="ui-list">
        {shop.orders.map((order) => {
          const product = shop.products.find((p) => p.id === order.productId)
          const facts = [editionOf(order.number), order.reference, when(order.placed)].filter(Boolean).join(' · ')
          return (
            <li key={order.id} className="ui-row ui-ord">
              {!phone && <span className="ui-thumb lg">{product ? <KindIcon kind={product.kind} size={20} width={1.6} /> : <DocIcon />}</span>}
              <span className="who">
                <b>{nameOf(order)}</b>
                <span>{phone ? [editionOf(order.number), takenOf(order) || 'We’ll write to you'].filter(Boolean).join(' · ') : facts}</span>
              </span>
              <span className="ui-badge">{standOf(order, shop)}</span>
              {!phone && <span className="r t-sm t-2">{takenOf(order) || ' '}</span>}
            </li>
          )
        })}
      </ol>
    </>
  )
  const points = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 className="ui-sect">Points</h2>
        <span className="t-sm t-2">Balance {fmtPoints(me.points)} pts</span>
      </div>
      <ol className="ui-list">
        {spent.map((order) => (
          <li key={order.id} className="ui-row ui-pts">
            <span className="who">
              <b>{nameOf(order)}</b>
              <span>{when(order.placed)}</span>
            </span>
            <span className="r">&minus;{fmtPoints(order.points)}</span>
          </li>
        ))}
        {given > 0 && (
          <li className="ui-row ui-pts">
            <span className="who">
              <b>{me.reason ? `For ${me.reason}` : 'Points given'}</b>
              <span>{me.since ? `Member since ${me.since}` : ' '}</span>
            </span>
            <span className="r t-gold">+{fmtPoints(given)}</span>
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
        <h1 className="t-title">Yours</h1>
        {orders}
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
            <b>Shrug</b>
            <small>
              {metal[0]!.toUpperCase() + metal.slice(1)}
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
        <div className="ui-head" style={{ paddingBottom: 0 }}>
          <h1 className="t-title">Yours</h1>
        </div>
        {orders}
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
