import type { Member, Order, Product, Update } from '../shared/rules'

// What the pages ask of the server, and the answers they can get. Built as the demo, a stand-in in the
// browser answers instead (demo.ts), in exactly these shapes.

declare const __DEMO__: boolean
export const DEMO = __DEMO__

/** A member, with what My VIP shows of them besides. */
export type Who = Member & { number: string; since: number | null; reason: string | null; emails: boolean; email: string; shipTo: string }

export type StoreAnswer = { status: 'anon' } | { status: 'applied' } | { status: 'member'; member: Who; products: Product[]; updates: Update[]; orders: Order[]; stripeKey: string }
export type Shop = Extract<StoreAnswer, { status: 'member' }>

export type Failed = { error: string }
export type Placed = { ok: true; order: Order; points: number }
export type PayStart = { ok: true; clientSecret: string; payment: string; cents: number } | { ok: true; demo: true; cents: number }

export interface Asked {
  product: string
  option?: string
  /** How many of their points to put towards it. */
  points?: number
  /** An address typed with the order: where it goes, and kept on file from then on. */
  shipTo?: string
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
