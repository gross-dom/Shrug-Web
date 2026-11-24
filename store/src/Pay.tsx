import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fmtCents, postageCents, type Product } from '../shared/rules'
import type { Backend, Failed, Placed } from './backend'

// Taking the dollars: what is left of the price once the points have come off, and the shipping. First the
// ways to pay are offered, and one is chosen. Apple Pay (with Google Pay and Link where a device has those
// and not Apple Pay) brings an address with it, so it asks for nothing more. A card does not: once it is
// chosen, the address is asked for if there is none on file, and then the card. For real this is Stripe's
// own Apple Pay button and Stripe's card form; in the demo there is no Stripe, and each button stands for a
// payment that goes through.

interface Props {
  backend: Backend
  product: Product
  option: string
  points: number
  /** What is to be paid, in cents. The server works it out again for itself; this is only what is shown. */
  cents: number
  stripeKey: string
  /** An address typed at checkout, to be kept on file with the order; '' where there is one on file or none has been typed. */
  shipTo: string
  /** It is posted and there is no address on file: a card cannot be taken until one is typed. (Apple Pay gives its own, and the first one given is kept.) */
  needsAddress: boolean
  /** A visitor's email, for the receipt and for the account the payment makes. Not given for a member. */
  email?: string
  /** Paying by card has been chosen. */
  byCard: boolean
  onCard: () => void
  /** Back to the ways to pay. */
  onOptions: () => void
  /** Somewhere to type the address: shown once the card is chosen, where one is needed. */
  address: ReactNode
  onDone: (placed: Placed) => void
  onError: (said: string) => void
}

const WHY: Record<string, string> = {
  offline: 'No connection. Nothing was taken.',
  points: 'Your points have changed since this was opened. Go back and open it again.',
  'sold-out': 'The last one has just gone.',
  unpaid: 'The payment did not go through. Nothing was taken.',
  already: 'You already have this.',
  address: 'Add where to send it first.',
  email: 'Add your email for the receipt first.',
}
const anEmail = (text: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim())
export const whyNot = (error: string) => WHY[error] ?? 'That did not work. Nothing was taken.'

/** The way back from the card to the ways to pay. */
const Others = ({ onOptions, off }: { onOptions: () => void; off: boolean }) => (
  <button type="button" className="ui-link quiet ui-other" disabled={off} onClick={onOptions}>
    Other ways to pay
  </button>
)

function DemoPay({ backend, product, option, points, cents, shipTo, needsAddress, email, byCard, onCard, onOptions, address, onDone, onError }: Props) {
  const [busy, setBusy] = useState(false)
  const pay = async () => {
    if (email !== undefined && !anEmail(email)) return onError(whyNot('email'))
    setBusy(true)
    onError('')
    const placed = await backend.paid('demo', { product: product.id, option, points, shipTo: shipTo || undefined, ...(email !== undefined ? { email: email.trim() } : {}) })
    setBusy(false)
    if ('error' in placed) onError(whyNot(placed.error))
    else onDone(placed)
  }
  if (!byCard)
    return (
      <>
        <button type="button" className="ui-btn" data-busy={busy || undefined} disabled={busy} onClick={pay}>
          Pay with Apple Pay
        </button>
        <button type="button" className="ui-btn sec" disabled={busy} onClick={() => (onError(''), onCard())}>
          Pay with card
        </button>
      </>
    )
  const waiting = needsAddress && !shipTo
  return (
    <>
      {needsAddress && address}
      <button type="button" className={`ui-btn${waiting ? ' off' : ''}`} data-busy={busy || undefined} disabled={busy || waiting} onClick={pay}>
        {waiting ? 'Add where to send it' : `Pay ${fmtCents(cents)}`}
      </button>
      <Others onOptions={onOptions} off={busy} />
    </>
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

function StripePay({ backend, product, option, points, cents, stripeKey, shipTo, needsAddress, email, byCard, onCard, onOptions, address, onDone, onError }: Props) {
  const express = useRef<HTMLDivElement>(null)
  const cardBox = useRef<HTMLDivElement>(null)
  const kit = useRef<{ stripe: any; elements: any } | null>(null)
  // What is typed changes while the form stands: the payment reads it as it is when it is made
  const typed = useRef(shipTo)
  typed.current = shipTo
  const mail = useRef(email)
  mail.current = email
  const [ready, setReady] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [wallet, setWallet] = useState(true)
  const [busy, setBusy] = useState(false)
  // With no wallet on this device the card is the only way, and is open from the start
  const card = byCard || !wallet

  /** The payment itself: the store says how much (never the page), Stripe takes it, and the store checks with Stripe that it came. */
  const take = async (shipping?: unknown): Promise<Failed | null> => {
    const { stripe, elements } = kit.current!
    // A visitor has no account yet: the payment makes it, from the email given here and the address (typed
    // here, or Apple Pay's own), so both go with the payment and nothing is kept on file beforehand
    const visitor = mail.current !== undefined
    if (visitor && !anEmail(mail.current!)) return { error: 'email' }
    const { error: unfinished } = await elements.submit()
    if (unfinished) return { error: unfinished.message ?? 'card' }
    // An address typed here is kept on file first, so that the order is sent to it
    if (typed.current && !visitor) {
      const kept = await backend.address(typed.current)
      if ('error' in kept) return kept
    }
    const started = await backend.pay(visitor ? { product: product.id, option, points: 0, email: mail.current!.trim(), shipTo: typed.current || undefined, wallet: !!shipping } : { product: product.id, option, points })
    if ('error' in started) return started
    if (!('clientSecret' in started)) return { error: 'server' }
    // The price was changed between the page being drawn and now: nothing is taken at a price that was not shown
    if (started.cents !== cents) return { error: 'points' }
    const { error: refused, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret: started.clientSecret,
      confirmParams: { return_url: window.location.href, ...(shipping ? { shipping } : {}) },
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
          appearance: { theme: 'night', variables: { colorPrimary: '#f5f5f7', colorBackground: '#17171a', colorText: '#f5f5f7', borderRadius: '12px', fontFamily: 'Inter, -apple-system, system-ui, sans-serif' } },
        })
        kit.current = { stripe, elements }
        const postage = postageCents(product)
        const button = elements.create('expressCheckout', {
          buttonType: { applePay: 'plain', googlePay: 'plain' },
          buttonTheme: { applePay: 'white', googlePay: 'white' },
          buttonHeight: 52,
          // With no address on file the wallet is asked for one, and it is kept
          shippingAddressRequired: needsAddress,
          // Shipping is already in the amount: it is the same wherever the thing goes
          ...(needsAddress ? { shippingRates: [{ id: 'post', displayName: 'Shipping', amount: 0 }] } : {}),
          lineItems: [{ name: product.name + (option ? `, ${option}` : ''), amount: cents - postage }, ...(postage ? [{ name: 'Shipping', amount: postage }] : [])],
        })
        button.on('ready', (event: any) => !gone && setWallet(!!event.availablePaymentMethods))
        button.on('confirm', async (event: any) => {
          const to = event.shippingAddress
          const failed = await take(to ? { name: to.name, address: to.address } : undefined)
          if (failed && !gone) onError(whyNot(failed.error))
        })
        button.mount(express.current!)
        const form = elements.create('payment', { wallets: { applePay: 'never', googlePay: 'never' } })
        form.mount(cardBox.current!)
        made.push(button, form)
        setReady('ready')
      })
      .catch(() => !gone && setReady('failed'))
    return () => {
      gone = true
      for (const element of made) element.destroy()
    }
  }, [product.id, option, cents, stripeKey, needsAddress]) // eslint-disable-line react-hooks/exhaustive-deps

  const waiting = needsAddress && !shipTo
  const payByCard = async () => {
    // A card gives no address: one has to be on file, or typed above
    if (waiting) return onError(whyNot('address'))
    setBusy(true)
    onError('')
    const failed = await take()
    setBusy(false)
    if (failed) onError(whyNot(failed.error))
  }

  return (
    <>
      {ready === 'failed' && (
        <p className="ui-note" role="alert">
          The payment form did not load. Check your connection and open this again.
        </p>
      )}
      <div ref={express} className="pay-express" hidden={!wallet || card} />
      {!card && (
        <button type="button" className="ui-btn sec" onClick={() => (onError(''), onCard())}>
          Pay with card
        </button>
      )}
      <div className="pay-card" hidden={!card}>
        {card && needsAddress && address}
        <div ref={cardBox} />
        <button type="button" className={`ui-btn${waiting ? ' off' : ''}`} data-busy={busy || undefined} disabled={busy || waiting || ready !== 'ready'} onClick={payByCard}>
          {waiting ? 'Add where to send it' : `Pay ${fmtCents(cents)}`}
        </button>
        {wallet && <Others onOptions={onOptions} off={busy} />}
      </div>
    </>
  )
}

export function Pay(props: Props) {
  return props.stripeKey ? <StripePay {...props} /> : <DemoPay {...props} />
}
