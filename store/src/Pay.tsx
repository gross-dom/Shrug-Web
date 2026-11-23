import { useEffect, useRef, useState } from 'react'
import { centsOf, complete, dollarsOf, fmtDollars, type Address, type Product } from '../shared/rules.ts'
import type { Backend, Failed, Placed } from './backend.ts'

// Taking the dollars: the floor and the postage. For real this is Stripe's own Apple Pay button (with Google
// Pay and Link where a device has those and not Apple Pay), which also asks where to send the thing; under
// it, for a device with none of them, a card form and an address. In the demo there is no Stripe: a button
// that says what it stands for, and the store's own address form.

interface Props {
  backend: Backend
  product: Product
  option: string
  stripeKey: string
  onDone: (placed: Placed) => void
}

const WHY: Record<string, string> = {
  offline: 'No connection. Nothing was taken.',
  short: 'You no longer have the points for this.',
  'sold-out': 'The last one has just gone.',
  unpaid: 'The payment did not go through. Nothing was taken.',
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
      <legend className="label">Send it to</legend>
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

function DemoPay({ backend, product, option, onDone }: Props) {
  const [address, setAddress] = useState<Address>(NOWHERE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pay = async () => {
    setBusy(true)
    setError('')
    const placed = await backend.paid('demo', { product: product.id, option, address })
    setBusy(false)
    if ('error' in placed) setError(whyNot(placed.error))
    else onDone(placed)
  }
  return (
    <div className="pay">
      <AddressForm value={address} onChange={setAddress} />
      <button type="button" className="buy buy--pay" disabled={busy || !complete(address)} onClick={pay}>
        {busy ? 'Paying…' : `Pay ${fmtDollars(dollarsOf(product))} with Apple Pay`}
      </button>
      <p className="small">Demo: this stands in for Apple Pay, which gives the address too. No money moves.</p>
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

function StripePay({ backend, product, option, stripeKey, onDone }: Props) {
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
    const started = await backend.pay({ product: product.id, option })
    if ('error' in started) return started
    if (!('clientSecret' in started)) return { error: 'server' }
    const { error: refused, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret: started.clientSecret,
      confirmParams: { return_url: `${window.location.origin}${window.location.pathname}`, ...(shipping ? { shipping } : {}) },
      redirect: 'if_required',
    })
    if (refused) return { error: refused.message ?? 'unpaid' }
    const placed = await backend.paid(paymentIntent?.id ?? started.payment, { product: product.id, option })
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
          amount: centsOf(product),
          currency: 'usd',
          appearance: { theme: 'night', variables: { colorPrimary: '#d7b65f', colorBackground: '#131316', colorText: '#ffffff', borderRadius: '10px', fontFamily: 'ui-monospace, Menlo, Consolas, monospace' } },
        })
        kit.current = { stripe, elements }
        const button = elements.create('expressCheckout', {
          buttonType: { applePay: 'buy', googlePay: 'buy' },
          buttonTheme: { applePay: 'white-outline' },
          buttonHeight: 50,
          shippingAddressRequired: true,
          // The postage is already in the amount: it is the same wherever the thing goes
          shippingRates: [{ id: 'post', displayName: 'Postage', amount: 0 }],
          lineItems: [
            { name: product.name + (option ? `, ${option}` : ''), amount: Math.round((product.price ?? 0) * 100) },
            { name: 'Postage', amount: Math.round((product.postage ?? 0) * 100) },
          ],
        })
        button.on('ready', (event: any) => !gone && setWallet(!!event.availablePaymentMethods))
        button.on('confirm', async (event: any) => {
          const to = event.shippingAddress
          const failed = await take(to ? { name: to.name, address: to.address } : undefined)
          if (failed && !gone) setError(whyNot(failed.error))
        })
        button.mount(express.current!)
        const address = elements.create('address', { mode: 'shipping' })
        address.mount(addressBox.current!)
        const card = elements.create('payment', { wallets: { applePay: 'never', googlePay: 'never' } })
        card.mount(cardBox.current!)
        made.push(button, address, card)
        setReady('ready')
      })
      .catch(() => !gone && setReady('failed'))
    return () => {
      gone = true
      for (const element of made) element.destroy()
    }
  }, [product.id, option, stripeKey]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <button type="button" className="buy buy--pay" disabled={busy || ready !== 'ready'} onClick={byCard}>
          {busy ? 'Paying…' : `Pay ${fmtDollars(dollarsOf(product))}`}
        </button>
      </details>
      {error && <p className="oops" role="alert">{error}</p>}
    </div>
  )
}

export function Pay(props: Props) {
  return props.stripeKey ? <StripePay {...props} /> : <DemoPay {...props} />
}
