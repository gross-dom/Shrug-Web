import { useEffect, useRef, useState } from 'react'
import { asksAddress, complete, fmtCents, postageCents, priceCents, type Address, type Product } from '../shared/rules'
import type { Backend, Failed, Placed } from './backend'

// Taking the dollars: what is left of the price once the points have come off, and the postage. For real
// this is Stripe's own Apple Pay button (with Google Pay and Link where a device has those and not Apple
// Pay), which also asks where to send the thing; under it, for a device with none of them, a card form and
// an address. In the demo there is no Stripe: a button that says what it stands for, and the store's own
// address form.

interface Props {
  backend: Backend
  product: Product
  option: string
  /** The points being used. */
  points: number
  /** What is to be paid, in cents. The server works it out again for itself; this is only what is shown. */
  cents: number
  stripeKey: string
  onDone: (placed: Placed) => void
}

const WHY: Record<string, string> = {
  offline: 'No connection. Nothing was taken.',
  points: 'Your points have changed since this was opened. Close it and open it again.',
  'sold-out': 'The last one has just gone. Nothing was taken.',
  unpaid: 'The payment did not go through. Nothing was taken.',
  already: 'You already have this.',
}
export const whyNot = (error: string) => WHY[error] ?? 'That did not work. Nothing was taken.'

export function AddressForm({ value, onChange }: { value: Address; onChange: (address: Address) => void }) {
  const field = (key: keyof Address, label: string, auto: string, wide = true) => (
    <label className={wide ? 'field' : 'field field--half'}>
      <span>{label}</span>
      <input value={value[key]} autoComplete={auto} onChange={(e) => onChange({ ...value, [key]: e.target.value })} />
    </label>
  )
  return (
    <fieldset className="address">
      <legend className="k">Send it to</legend>
      {field('name', 'Name', 'name')}
      {field('line1', 'Address', 'address-line1')}
      {field('line2', 'Flat, suite (optional)', 'address-line2')}
      {field('city', 'City', 'address-level2', false)}
      {field('region', 'State', 'address-level1', false)}
      {field('postcode', 'ZIP', 'postal-code', false)}
      {field('country', 'Country', 'country-name', false)}
    </fieldset>
  )
}

export const NOWHERE: Address = { name: '', line1: '', line2: '', city: '', region: '', postcode: '', country: 'United States' }

/** The gold strip that is pressed to pay or to take: the pack's tear strip again. */
export function Strip({ children, disabled, busy, onClick, white }: { children: React.ReactNode; disabled?: boolean; busy?: boolean; onClick?: () => void; white?: boolean }) {
  return (
    <button type="button" className="strip" data-white={white || undefined} data-busy={busy || undefined} disabled={disabled || busy} onClick={onClick}>
      <span className="strip__chevs" aria-hidden>
        ›››
      </span>
      <span className="strip__word">{children}</span>
      <span className="strip__chevs" aria-hidden>
        ›››
      </span>
    </button>
  )
}

function DemoPay({ backend, product, option, points, cents, onDone }: Props) {
  const ships = asksAddress(product)
  const [address, setAddress] = useState<Address>(NOWHERE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pay = async () => {
    setBusy(true)
    setError('')
    const placed = await backend.paid('demo', { product: product.id, option, points, address: ships ? address : null })
    setBusy(false)
    if ('error' in placed) setError(whyNot(placed.error))
    else onDone(placed)
  }
  return (
    <div className="pay">
      {ships && <AddressForm value={address} onChange={setAddress} />}
      <Strip white busy={busy} disabled={ships && !complete(address)} onClick={pay}>
        {busy ? 'Paying' : `Apple Pay ${fmtCents(cents)}`}
      </Strip>
      <p className="fine">Demo: this stands in for Apple Pay, which gives the address too. No money moves.</p>
      {error && <p className="oops" role="alert">{error}</p>}
    </div>
  )
}

type StripeJs = (key: string) => any
let loading: Promise<StripeJs> | null = null
/** Stripe's own script, fetched from Stripe the first time something is paid for. */
const stripeJs = () =>
  (loading ??= new Promise<StripeJs>((resolve, reject) => {
    const script = Object.assign(document.createElement('script'), { src: 'https://js.stripe.com/v3/', async: true })
    script.onload = () => ((window as any).Stripe ? resolve((window as any).Stripe) : reject(new Error('Stripe')))
    script.onerror = () => {
      loading = null
      reject(new Error('Stripe'))
    }
    document.head.append(script)
  }))

function StripePay({ backend, product, option, points, cents, stripeKey, onDone }: Props) {
  const ships = asksAddress(product)
  const express = useRef<HTMLDivElement>(null)
  const cardBox = useRef<HTMLDivElement>(null)
  const addressBox = useRef<HTMLDivElement>(null)
  const kit = useRef<{ stripe: any; elements: any } | null>(null)
  const [ready, setReady] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [wallet, setWallet] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  /** The payment itself: the store says how much (never the page), Stripe takes it, and the store checks with Stripe that it came. */
  const take = async (shipping?: unknown): Promise<Failed | null> => {
    const { stripe, elements } = kit.current!
    const { error: unfinished } = await elements.submit()
    if (unfinished) return { error: unfinished.message ?? 'card' }
    const started = await backend.pay({ product: product.id, option, points })
    if ('error' in started) return started
    if (!('clientSecret' in started)) return { error: 'server' }
    // The price was changed between the page being drawn and now: nothing is taken at a price that was not shown
    if (started.cents !== cents) return { error: 'points' }
    const { error: refused, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret: started.clientSecret,
      confirmParams: { return_url: `${window.location.origin}${window.location.pathname}`, ...(shipping ? { shipping } : {}) },
      redirect: 'if_required',
    })
    if (refused) return { error: refused.message ?? 'unpaid' }
    const placed = await backend.paid(paymentIntent?.id ?? started.payment, { product: product.id, option, points })
    if ('error' in placed) return placed
    onDone(placed)
    return null
  }

  useEffect(() => {
    let gone = false
    const made: any[] = []
    stripeJs()
      .then((Stripe) => {
        if (gone) return
        const stripe = Stripe(stripeKey)
        const elements = stripe.elements({
          mode: 'payment',
          amount: cents,
          currency: 'usd',
          appearance: { theme: 'night', variables: { colorPrimary: '#d7b65f', colorBackground: '#131316', colorText: '#ffffff', borderRadius: '4px', fontFamily: 'ui-monospace, Menlo, Consolas, monospace' } },
        })
        kit.current = { stripe, elements }
        const postage = postageCents(product)
        const button = elements.create('expressCheckout', {
          buttonType: { applePay: 'buy', googlePay: 'buy' },
          buttonTheme: { applePay: 'white-outline' },
          buttonHeight: 50,
          shippingAddressRequired: ships,
          // The postage is already in the amount: it is the same wherever the thing goes
          ...(ships ? { shippingRates: [{ id: 'post', displayName: 'Postage', amount: 0 }] } : {}),
          lineItems: [{ name: product.name + (option ? `, ${option}` : ''), amount: cents - postage }, ...(postage ? [{ name: 'Postage', amount: postage }] : [])],
        })
        button.on('ready', (event: any) => !gone && setWallet(!!event.availablePaymentMethods))
        button.on('confirm', async (event: any) => {
          const to = event.shippingAddress
          const failed = await take(to ? { name: to.name, address: to.address } : undefined)
          if (failed && !gone) setError(whyNot(failed.error))
        })
        button.mount(express.current!)
        made.push(button)
        if (ships) {
          const address = elements.create('address', { mode: 'shipping' })
          address.mount(addressBox.current!)
          made.push(address)
        }
        const card = elements.create('payment', { wallets: { applePay: 'never', googlePay: 'never' } })
        card.mount(cardBox.current!)
        made.push(card)
        setReady('ready')
      })
      .catch(() => !gone && setReady('failed'))
    return () => {
      gone = true
      for (const element of made) element.destroy()
    }
  }, [product.id, option, cents, stripeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const byCard = async () => {
    setBusy(true)
    setError('')
    const failed = await take()
    setBusy(false)
    if (failed) setError(whyNot(failed.error))
  }

  return (
    <div className="pay" aria-busy={ready === 'loading'}>
      {ready === 'failed' && <p className="oops" role="alert">The payment form did not load. Check your connection and open this again.</p>}
      <div ref={express} className="pay__express" hidden={!wallet} />
      <details className="pay__card" open={!wallet}>
        <summary>{wallet ? 'Or pay by card' : 'Pay by card'}</summary>
        <div ref={addressBox} />
        <div ref={cardBox} />
        <Strip busy={busy} disabled={ready !== 'ready'} onClick={byCard}>
          {busy ? 'Paying' : `Pay ${fmtCents(cents)}`}
        </Strip>
      </details>
      {error && <p className="oops" role="alert">{error}</p>}
    </div>
  )
}

export function Pay(props: Props) {
  return props.stripeKey ? <StripePay {...props} /> : <DemoPay {...props} />
}

/** For the sums on a ticket: the price before points and postage. */
export const fullPrice = (product: Product) => fmtCents(priceCents(product))
