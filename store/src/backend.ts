import type { Member, Needs, Order, Picture, Product, Update, Via } from '../shared/rules'

// What the pages ask of the server, and the answers they can get. Built as the demo, a stand-in in the
// browser answers instead (demo.ts), in exactly these shapes.

declare const __DEMO__: boolean
// (the desktop's own windows read the demo's stand-in too, from a build that does not say: there it is the demo)
export const DEMO = typeof __DEMO__ === 'undefined' ? true : __DEMO__

/** A member, with what My VIP shows of them besides. */
export type Who = Member & { number: string; since: number | null; reason: string | null; emails: boolean; email: string; shipTo: string; picture?: Picture | null }

/** What the server says of whoever is asking: a visitor (nobody signed in), who is shown the store and nothing
 * of anybody's, or a member, with everything that is theirs. */
export type StoreAnswer = { status: 'visitor'; products: Product[]; stripeKey: string } | { status: 'member'; member: Who; products: Product[]; updates: Update[]; orders: Order[]; stripeKey: string; needs?: Needs; via?: Via }
export type Shop = Extract<StoreAnswer, { status: 'member' }>

/** The store as a visitor has it, in the shape the pages are drawn from: the same shelves, and a member who is
 * nobody, with no points, no orders and no address. What only a member can do is asked of `visiting`. */
export const shopOf = (answer: Extract<StoreAnswer, { status: 'visitor' }>): Shop => ({
  status: 'member',
  member: { id: '', name: '', first: '', roles: [], funds: [], tier: '', points: 0, number: '', since: null, reason: null, emails: false, email: '', shipTo: '' },
  products: answer.products,
  updates: [],
  orders: [],
  stripeKey: answer.stripeKey,
})

/** Where the card is: the page a member signs in on, one step up from the store's own (see vite.config.ts). */
export const CARD = import.meta.env.BASE_URL.replace(/store\/$/, '')

export type Failed = { error: string }
/** An order placed. For a visitor, who paid without an account: `account` says whether the payment made them
 * one (`new`: they are signed in to it, and are asked for a phone number) or the email already had one
 * (`theirs`: the order is that account's, and nobody is signed in), and `email` is where the receipt went. */
export type Placed = { ok: true; order: Order; points: number; account?: 'new' | 'theirs'; email?: string }
export type PayStart = { ok: true; clientSecret: string; payment: string; cents: number } | { ok: true; demo: true; cents: number }

export interface Asked {
  product: string
  option?: string
  /** How many of their points to put towards it. */
  points?: number
  /** An address typed with the order: where it goes, and kept on file from then on. */
  shipTo?: string
  /** A visitor's: where the receipt goes, which is the account the payment makes. */
  email?: string
  /** A visitor's: Apple Pay will give the address, so none is typed. */
  wallet?: boolean
}

export interface Backend {
  store(): Promise<StoreAnswer | Failed>
  order(asked: Asked): Promise<Placed | Failed>
  /** The start of a payment, for whatever the points asked for leave to pay. */
  pay(asked: Asked): Promise<PayStart | Failed>
  /** A payment made: the order it becomes. In the demo there is no payment, only what was asked for. */
  paid(payment: string, asked: Asked): Promise<Placed | Failed>
  /** Keeps an address on file. */
  address(shipTo: string): Promise<{ ok: true; shipTo: string } | Failed>
  emails(on: boolean): Promise<{ ok: true; emails: boolean } | Failed>
  /** Where an update can be read from, in the page. */
  view(update: Update): Promise<string | Failed>
  /** An update's file, saved to the device. */
  download(update: Update): Promise<true | Failed>
  /** A phone number for the account that is signed in: asked with the number alone, it is texted six digits; with the six digits, it is theirs to sign in with. */
  phone(phone: string, code?: string): Promise<{ ok: true; phone?: string } | Failed>
  signout(): Promise<void>
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T | Failed> {
  try {
    const res = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin', cache: 'no-store' })
    const answer = await res.json().catch(() => null)
    return answer && typeof answer === 'object' ? (answer as T) : { error: 'server' }
  } catch {
    return { error: 'offline' }
  }
}

const fileAt = (update: Update, view: boolean) => `/api/file?product=${encodeURIComponent(update.id)}${view ? '&view=1' : ''}`

export const server: Backend = {
  store: () => call<StoreAnswer>('GET', '/api/store'),
  order: (asked) => call<Placed>('POST', '/api/order', asked),
  pay: (asked) => call<PayStart>('POST', '/api/pay', asked),
  paid: (payment) => call<Placed>('POST', '/api/order', { payment }),
  address: (shipTo) => call<{ ok: true; shipTo: string }>('POST', '/api/address', { shipTo }),
  emails: (on) => call<{ ok: true; emails: boolean }>('POST', '/api/emails', { on }),
  // The page reads it straight from the server, which checks again that it is theirs and notes that it was opened
  view: async (update) => fileAt(update, true),
  async download(update) {
    try {
      const res = await fetch(fileAt(update, false), { credentials: 'same-origin', cache: 'no-store' })
      if (!res.ok) return { error: ((await res.json().catch(() => null)) as Failed | null)?.error ?? 'server' }
      save(await res.blob(), /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? `${update.name}.pdf`)
      return true
    } catch {
      return { error: 'offline' }
    }
  },
  phone: (phone, code) => call<{ ok: true; phone?: string }>('POST', '/api/phone', code ? { phone, code } : { phone }),
  async signout() {
    await call('POST', '/api/signout', {})
  },
}

/** Hands a file to the browser to keep. */
export function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
