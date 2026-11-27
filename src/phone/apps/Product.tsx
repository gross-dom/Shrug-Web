import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Layers, Minus, Plus, Truck, X } from 'lucide-react'
import { dueCents, fmtCents, has, MOST_AT_ONCE, mostPoints, postageCents, priceCents, sellsMany, soldOut, times, wayOf, type Product } from '../../../store/shared/rules'
import { shotsOf, type Shot } from '../../../store/src/pictures'
import { keptOf, owned, shipsOf, shipsWhen } from '../../../store/src/words'
import { askLogIn } from '../../os/account'
import { useShop } from '../../os/shop'
import { haptic } from '../native'
import { BackButton, Screen } from '../ui'
import { checkOut } from './Buying'
import { drawnOn, optionName, Pic } from './storebits'
import { Wallet } from './Wallet'

// One thing the store sells, as a screen of the phone's own, set out as Apple's store sets one out (Dom,
// 27 Nov: its product page is the basis for ours): its name and what it costs at the head of the page; its
// photographs in a card with rounded corners, on the photograph's own ground so that it sits flush in it,
// the next one showing at the card's side, drawn across with a finger, with dots under it that say which;
// then what there is to choose (a colour, how many), what is known of its sending, and, floating at the foot
// and always in reach, its price and the one button. The button brings checkout up over this page
// (Buying.tsx): nobody leaves the page to buy.

/** The colours a thing comes in, as they are drawn. An option may carry its own ("Sand #c8b89a"); these are known without. */
const COLORS: Record<string, string> = { black: '#1b1c1f', stone: '#b9b2a3', white: '#f4f4f1' }
const colorOf = (option: string): string | null => /\s(#[0-9a-f]{3,8})$/i.exec(option)?.[1] ?? COLORS[optionName(option).toLowerCase()] ?? null

/** A photograph, whole, on black, over everything: the card cuts a photograph to its own shape, and a piece
 * is worth seeing to its edges. A finger draws the next across here too; a press anywhere, or its x, puts it away. */
function Whole({ product, shots, at, onClose }: { product: Product; shots: Shot[]; at: number; onClose: () => void }) {
  const track = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const [seen, setSeen] = useState(at)
  useLayoutEffect(() => {
    const el = track.current
    if (el) el.scrollLeft = at * el.clientWidth
    const before = document.activeElement as HTMLElement | null
    close.current?.focus({ preventScroll: true })
    return () => before?.focus?.({ preventScroll: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      className="pd-whole"
      role="dialog"
      aria-modal="true"
      aria-label={`${product.name}: its pictures, whole`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.stopPropagation(), onClose()
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') track.current?.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * track.current.clientWidth, behavior: 'smooth' })
      }}
    >
      {/* (it can be drawn across with the keyboard too: the arrows, on the track or on its x) */}
      <div ref={track} className="pd-whole__track" tabIndex={0} role="group" aria-label={`Picture ${seen + 1} of ${shots.length}`} onClick={onClose} onScroll={(e) => setSeen(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}>
        {shots.map((shot, n) => (
          <div key={shot.full} className="pd-whole__slide">
            <img src={shot.full} srcSet={shot.set} sizes="100vw" alt={shot.alt ?? (shots.length > 1 ? `${product.name}: picture ${n + 1} of ${shots.length}` : product.name)} decoding="async" draggable={false} />
          </div>
        ))}
      </div>
      <button ref={close} type="button" className="ios-glass ios-button pd-whole__close" data-dark aria-label="Close" onClick={onClose}>
        <X size={20} strokeWidth={2.4} aria-hidden />
      </button>
      {shots.length > 1 && (
        <div className="pd-dots pd-dots--over" aria-hidden>
          {shots.map((shot, n) => (
            <i key={shot.full} data-at={n === seen || undefined} />
          ))}
        </div>
      )}
    </div>
  )
}

/** A product's photographs, each in a card, side by side: a finger draws the next across, and it comes to rest. */
function Gallery({ product, shots, drawn }: { product: Product; shots: Shot[]; drawn: string }) {
  const track = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(0)
  /** Which photograph is being looked at whole, over the page; none, as a rule. */
  const [whole, setWhole] = useState<number | null>(null)
  /** How far it is from one card to the next. */
  const stride = () => {
    const el = track.current
    const first = el?.firstElementChild as HTMLElement | null
    const next = first?.nextElementSibling as HTMLElement | null
    return first && next ? next.offsetLeft - first.offsetLeft : (el?.clientWidth ?? 1)
  }
  const to = (n: number) => track.current?.scrollTo({ left: n * stride(), behavior: 'smooth' })
  // Nothing photographed yet: a book is drawn as its cover, from its title, as the shelf draws it; anything
  // else is its name on the same ground
  if (!shots.length)
    return (
      <div className="pd-gallery" aria-hidden>
        <div className="pd-track" data-one>
          <span className="pd-slide pd-slide--drawn" data-book={product.kind === 'Book' || undefined}>
            <span className="pd-drawn" style={{ background: drawn }}>
              <b>{product.name}</b>
              {product.kind === 'Book' && <small>Shrug</small>}
            </span>
          </span>
        </div>
      </div>
    )
  return (
    <div className="pd-gallery">
      <div
        ref={track}
        className="pd-track"
        data-one={shots.length === 1 || undefined}
        role="group"
        aria-roledescription="carousel"
        aria-label={shots.length > 1 ? `${product.name}: picture ${seen + 1} of ${shots.length}` : product.name}
        onScroll={(e) => setSeen(Math.min(shots.length - 1, Math.round(e.currentTarget.scrollLeft / Math.max(1, stride()))))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') e.preventDefault(), to(Math.min(shots.length - 1, Math.max(0, seen + (e.key === 'ArrowRight' ? 1 : -1))))
        }}
      >
        {shots.map((shot, n) => (
          <button key={shot.full} type="button" className="pd-slide" style={shot.ground ? { background: shot.ground } : undefined} aria-label={`${shot.alt ?? (shots.length > 1 ? `${product.name}: picture ${n + 1} of ${shots.length}` : product.name)}. See it whole`} onClick={() => setWhole(n)}>
            <Pic
              src={shot.full}
              srcSet={shot.set}
              sizes="90vw"
              alt=""
              loading={n === 0 ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
              // (a thing on a plain ground is shown whole on that ground, which is the card's; a photograph fills the card)
              data-whole={shot.ground ? '' : undefined}
              style={shot.at && !shot.ground ? { objectPosition: shot.at } : undefined}
            />
          </button>
        ))}
      </div>
      {shots.length > 1 && (
        <div className="pd-dots" aria-hidden>
          {shots.map((shot, n) => (
            <i key={shot.full} data-at={n === seen || undefined} />
          ))}
        </div>
      )}
      {whole !== null && <Whole product={product} shots={shots} at={whole} onClose={() => setWhole(null)} />}
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
      <Screen title={back} tone="grouped" className="pd" leading={<BackButton label={back} />}>
        {got ? (
          <p className="st-none">That is not in the store just now.</p>
        ) : (
          <div className="pd-gallery" aria-busy="true" aria-label="Opening">
            <div className="pd-track" data-one>
              <span className="pd-slide pd-slide--wait" />
            </div>
          </div>
        )}
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

  /** What one of it costs, as the head of the page says it. */
  const each = way === 'request' ? 'On request' : product.priceHidden ? 'Log in for price' : way === 'reserve' ? 'Pre-order' : priceCents(product) === 0 ? 'Free' : fmtCents(priceCents(product))
  /** What it comes to, as the foot says it: a figure, and under it what else there is to know of it. */
  const figure = way === 'request' ? 'On request' : product.priceHidden ? 'Log in for price' : way === 'reserve' ? '' : price === 0 ? 'Free' : fmtCents(price)
  const under = way !== 'buy' || product.priceHidden || out ? '' : most > 0 && price > 0 ? `${fmtCents(least)} with your points` : postage > 0 ? `+ ${fmtCents(postage)} shipping` : ''
  // What can be said for certain of its sending, and of which of an edition it is
  const ships = [product.status === 'Pre-order' && way === 'buy' && sent ? `Ships ${sent}` : '', way === 'buy' && !product.priceHidden && postage > 0 ? `${fmtCents(postageCents(product))} shipping` : ''].filter(Boolean)
  const edition = product.editionOf ? [`Edition of ${product.editionOf}`, product.left !== null && !out ? `${product.left} left` : ''].filter(Boolean) : []
  // Under its name: what it costs and, where there is something to say of it in a word, that
  const said = bought ? 'You own this' : out ? 'Sold out' : product.status === 'Pre-order' && way === 'buy' ? 'Pre-order' : ''

  return (
    <Screen
      title={product.name}
      large
      subtitle={[each, said].filter(Boolean).join(' · ')}
      tone="grouped"
      className="pd"
      leading={<BackButton label={back} />}
      trailing={<Wallet />}
      foot={
        <div className="ios-glass pd-buy" role="region" aria-label={`Buy ${product.name}`}>
          <span className="pd-buy__price">
            {figure && <b>{figure}</b>}
            {under && <small>{under}</small>}
          </span>
          <button type="button" className="pd-buy__go" disabled={button.off} onClick={() => (haptic(), button.act?.())}>
            {button.text}
          </button>
        </div>
      }
    >
      <Gallery product={product} shots={shots} drawn={drawnOn(shop.products, product)} />
      <div className="pd-info">
        {product.description && <p className="pd-words">{product.description}</p>}
        {kept && <p className="pd-words">{kept}</p>}
        {product.status === 'Pre-order' && way === 'reserve' && !asked && !bought && <p className="pd-words">Reserve a copy and we’ll let you know when it’s ready.{dated ? ` It ships ${dated}.` : ''}</p>}
        {way !== 'buy' && asked && <p className="pd-words">{way === 'request' ? 'We’ll write to you about it.' : 'We’ll let you know when it’s ready.'} It is in My VIP.</p>}

        {product.options.length > 0 && (
          <div className="pd-choice">
            <h4 className="pd-label">
              {label}
              {option ? ` - ${optionName(option)}` : ''}
            </h4>
            <div className="pd-swatches" role="group" aria-label={label}>
              {product.options.map((choice) => (
                <button key={choice} type="button" aria-pressed={option === choice} aria-label={optionName(choice)} onClick={() => (haptic(), setOption(choice))}>
                  <span style={{ background: colorOf(choice) ?? '#d2d2d7' }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {many && way === 'buy' && !out && (
          <div className="pd-box pd-qty">
            <span>
              <small>Quantity</small>
              <output aria-live="polite">{count}</output>
            </span>
            <span className="pd-stepper" role="group" aria-label="Quantity">
              <button type="button" aria-label="One fewer" disabled={count <= 1} onClick={() => (haptic(), setCount((n) => Math.max(1, n - 1)))}>
                <Minus size={18} strokeWidth={2.2} aria-hidden />
              </button>
              <button type="button" aria-label="One more" disabled={count >= MOST_AT_ONCE} onClick={() => (haptic(), setCount((n) => Math.min(MOST_AT_ONCE, n + 1)))}>
                <Plus size={18} strokeWidth={2.2} aria-hidden />
              </button>
            </span>
          </div>
        )}

        {(ships.length > 0 || edition.length > 0) && (
          <dl className="pd-facts">
            {ships.length > 0 && (
              <div>
                <dt>
                  <Truck size={22} strokeWidth={1.5} aria-hidden />
                  Shipping:
                </dt>
                {ships.map((line) => (
                  <dd key={line}>{line}</dd>
                ))}
              </div>
            )}
            {edition.length > 0 && (
              <div>
                <dt>
                  <Layers size={22} strokeWidth={1.5} aria-hidden />
                  Edition:
                </dt>
                {edition.map((line) => (
                  <dd key={line}>{line}</dd>
                ))}
              </div>
            )}
          </dl>
        )}
      </div>
    </Screen>
  )
}
