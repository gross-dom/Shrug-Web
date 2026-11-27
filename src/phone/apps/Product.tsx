import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { dueCents, fmtCents, has, MOST_AT_ONCE, mostPoints, postageCents, priceCents, sellsMany, soldOut, times, wayOf, type Product } from '../../../store/shared/rules'
import { shotsOf, type Shot } from '../../../store/src/pictures'
import { badgeOf, keptOf, owned, shipsOf, shipsWhen } from '../../../store/src/words'
import { askLogIn } from '../../os/account'
import { useShop } from '../../os/shop'
import { BackButton, Screen } from '../ui'
import { checkOut } from './Buying'
import { drawnOn, optionName } from './storebits'
import { Wallet } from './Wallet'

// One thing the store sells, as a screen of the phone's own: its photographs across the top, edge to edge
// and square (or upright, for a thing that is: a book), drawn across with a finger; under them what it is
// and what it costs; and at the foot, always in reach, its price and the one button. The button brings
// checkout up over this page (Buying.tsx): nobody leaves the page to buy.

/** The colours a thing comes in, as they are drawn. An option may carry its own ("Sand #c8b89a"); these are known without. */
const COLORS: Record<string, string> = { black: '#1b1c1f', stone: '#b9b2a3', white: '#f4f4f1' }
const colorOf = (option: string): string | null => /\s(#[0-9a-f]{3,8})$/i.exec(option)?.[1] ?? COLORS[optionName(option).toLowerCase()] ?? null

/** A product's photographs, side by side: a finger draws the next across, and it comes to rest whole. */
function Gallery({ product, shots, drawn }: { product: Product; shots: Shot[]; drawn: string }) {
  const track = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(0)
  // (upright for a thing that is photographed upright; square for everything else)
  const tall = (shots[0]?.aspect ?? 1) < 0.9
  const to = (n: number) => track.current?.scrollTo({ left: n * track.current.clientWidth, behavior: 'smooth' })
  // Nothing photographed yet: a book is drawn as its cover, from its title, as the shelf draws it; anything
  // else is its name on the same ground
  if (!shots.length)
    return (
      <div className="pd-gallery pd-gallery--none" data-book={product.kind === 'Book' || undefined} aria-hidden>
        <span className="pd-drawn" style={{ background: drawn }}>
          <b>{product.name}</b>
          {product.kind === 'Book' && <small>Shrug</small>}
        </span>
      </div>
    )
  return (
    <div className="pd-gallery" data-tall={tall || undefined}>
      <div
        ref={track}
        className="pd-track"
        role="group"
        aria-roledescription="carousel"
        aria-label={shots.length > 1 ? `${product.name}: picture ${seen + 1} of ${shots.length}` : product.name}
        tabIndex={shots.length > 1 ? 0 : undefined}
        onScroll={(e) => setSeen(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') e.preventDefault(), to(Math.min(shots.length - 1, Math.max(0, seen + (e.key === 'ArrowRight' ? 1 : -1))))
        }}
      >
        {shots.map((shot, n) => (
          <div key={shot.full} className="pd-slide" style={shot.ground ? { background: shot.ground } : undefined}>
            <img
              src={shot.full}
              srcSet={shot.set}
              sizes="100vw"
              alt={shot.alt ?? (shots.length > 1 ? `${product.name}: picture ${n + 1} of ${shots.length}` : product.name)}
              loading={n === 0 ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
              // (a thing on a plain ground is shown whole on that ground, which runs to the edges; a photograph fills the place)
              data-whole={shot.ground ? '' : undefined}
              style={shot.at && !shot.ground ? { objectPosition: shot.at } : undefined}
            />
          </div>
        ))}
      </div>
      {shots.length > 1 && (
        <div className="pd-dots" aria-hidden>
          {shots.map((shot, n) => (
            <i key={shot.full} data-at={n === seen || undefined} />
          ))}
        </div>
      )}
    </div>
  )
}

export function ProductPage({ id, back }: { id: string; back: string }) {
  const got = useShop()
  const product = got?.shop.products.find((p) => p.id === id) ?? null
  const [option, setOption] = useState('')
  const [count, setCount] = useState(1)
  // (something that comes one way is that way)
  const only = product && product.options.length === 1 ? product.options[0]! : ''
  useEffect(() => {
    if (only) setOption(only)
  }, [only])

  if (!got || !product)
    return (
      <Screen title={back} tone="dark" className="pd" leading={<BackButton label={back} />}>
        {got ? <p className="st-none">That is not in the store just now.</p> : <div className="pd-gallery pd-gallery--wait" aria-busy="true" aria-label="Opening" />}
      </Screen>
    )

  const { shop, visiting } = got
  const way = wayOf(product)
  const shots = shotsOf(product)
  const many = sellsMany(product)
  const lot = times(product, many ? count : 1)
  const price = priceCents(lot)
  const postage = postageCents(lot)
  const most = mostPoints({ points: shop.member.points }, lot)
  const least = way === 'buy' ? dueCents(lot, most) : 0
  const asked = has(shop.orders, product)
  const bought = owned(shop.orders, product)
  const out = soldOut(product) && way !== 'request'
  const badge = badgeOf(product, shop.orders)
  const kept = keptOf(product)
  const colors = product.options.map(colorOf)
  const label = colors.length > 0 && colors.every(Boolean) ? 'Color' : 'Choice'
  const needsOption = product.options.length > 0 && !option
  const sent = shipsWhen(product)
  const dated = shipsOf(product)

  /** The one button, and what it does. Anything bought, asked for or reserved goes through checkout's tray. */
  const button: { text: string; off?: boolean; act?: () => void } = (() => {
    if (way !== 'buy' && asked) return { text: way === 'request' ? 'Requested' : 'Reserved', off: true }
    if (out) return { text: 'Sold Out', off: true }
    if (bought && product.left === null && !product.editionOf && price === 0) return { text: 'Yours', off: true }
    // A chair's price is for someone logged in: the way to it is the way in
    if (product.priceHidden) return { text: 'Log In to Enquire', act: () => askLogIn('price') }
    // A visitor can buy what is paid for with money (the payment makes their account). Asking, reserving and
    // what costs nothing need someone for the order to belong to
    if (visiting && !(way === 'buy' && price + postage > 0)) return { text: way === 'request' ? 'Log In to Request' : way === 'reserve' ? 'Log In to Reserve' : 'Log In to Claim', act: () => askLogIn(way === 'request' ? 'request' : null) }
    if (needsOption) return { text: label === 'Color' ? 'Choose a Color' : 'Choose One', off: true }
    const go = () => checkOut(product, option, many ? count : 1)
    if (way === 'request') return { text: 'Request', act: go }
    if (way === 'reserve') return { text: 'Reserve', act: go }
    return { text: product.status === 'Pre-order' ? 'Pre-order' : price + postage === 0 ? 'Claim' : 'Buy', act: go }
  })()

  /** What it costs, as the foot says it: a figure, and under it what else there is to know of it. */
  const figure = way === 'request' ? 'On request' : product.priceHidden ? 'Log in for price' : way === 'reserve' ? '' : price === 0 ? 'Free' : fmtCents(price)
  const under =
    way !== 'buy' || product.priceHidden || out
      ? ''
      : most > 0 && price > 0
        ? `${fmtCents(least)} with your points`
        : postage > 0
          ? `+ ${fmtCents(postage)} shipping`
          : ''

  return (
    <Screen
      title={product.name}
      tone="dark"
      // (its first photograph is under the status bar: the bar's ink is chosen for that, pale ground or dark)
      under={shots[0]?.ground ? 'pale' : 'dark'}
      className="pd"
      leading={<BackButton label={back} />}
      trailing={<Wallet />}
      foot={
        <div className="ios-glass pd-buy" data-dark role="region" aria-label={`Buy ${product.name}`}>
          <span className="pd-buy__price">
            {figure && <b>{figure}</b>}
            {under && <small>{under}</small>}
          </span>
          <button type="button" className="pd-buy__go" disabled={button.off} onClick={button.act}>
            {button.text}
          </button>
        </div>
      }
    >
      <Gallery product={product} shots={shots} drawn={drawnOn(shop.products, product)} />
      <div className="pd-info">
        {((badge && !bought) || kept) && (
          <p className="pd-badges">
            {badge && !bought && <span data-tone={badge.tone}>{badge.text}</span>}
            {kept && <span>{kept}</span>}
          </p>
        )}
        <h3 className="pd-name">{product.name}</h3>
        {bought && <p className="pd-owned">You own this</p>}
        {product.description && <p className="pd-words">{product.description}</p>}
        {product.status === 'Pre-order' && !asked && !bought && <p className="pd-words pd-ships">{way === 'reserve' ? `Reserve a copy and we’ll let you know when it’s ready.${dated ? ` It ships ${dated}.` : ''}` : sent ? `Ships ${sent}.` : 'We’ll email you when it ships.'}</p>}
        {way !== 'buy' && asked && <p className="pd-words">{way === 'request' ? 'We’ll write to you about it.' : 'We’ll let you know when it’s ready.'} It is in My VIP.</p>}

        {product.options.length > 0 && (
          <div className="pd-choice">
            <span className="pd-label">
              {label} <b>{option ? optionName(option) : 'Choose one'}</b>
            </span>
            <div className="pd-swatches" role="group" aria-label={label}>
              {product.options.map((choice) => (
                <button key={choice} type="button" aria-pressed={option === choice} aria-label={optionName(choice)} onClick={() => setOption(choice)}>
                  <span style={{ background: colorOf(choice) ?? '#3a3a3c' }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {many && way === 'buy' && !out && (
          <div className="pd-qty">
            <span className="pd-label">Quantity</span>
            <span className="pd-stepper" role="group" aria-label="Quantity">
              <button type="button" aria-label="One fewer" disabled={count <= 1} onClick={() => setCount((n) => Math.max(1, n - 1))}>
                <Minus size={18} strokeWidth={2.4} aria-hidden />
              </button>
              <output aria-live="polite">{count}</output>
              <button type="button" aria-label="One more" disabled={count >= MOST_AT_ONCE} onClick={() => setCount((n) => Math.min(MOST_AT_ONCE, n + 1))}>
                <Plus size={18} strokeWidth={2.4} aria-hidden />
              </button>
            </span>
          </div>
        )}

      </div>
    </Screen>
  )
}
