import type { Address, Member, Order, Product } from '../shared/rules'

// What the page asks of the server, and the answers it can get. Built as the demo, a stand-in in the browser
// answers instead (demo.ts), in exactly these shapes.

declare const __DEMO__: boolean
export const DEMO = __DEMO__

export type StoreAnswer =
  | { status: 'anon' }
  | { status: 'applied' }
  | { status: 'member'; member: Member & { number?: string }; products: Product[]; orders: Order[]; stripeKey: string }

export type Failed = { error: string }
export type Placed = { ok: true; order: Order; points: number }
export type PayStart = { ok: true; clientSecret: string; payment: string } | { ok: true; demo: true }

export interface Asked {
  product: string
  option?: string
  address?: Address | null
}

export interface Backend {
  store(): Promise<StoreAnswer | Failed>
  order(asked: Asked): Promise<Placed | Failed>
  /** The start of a payment, for something with a floor. */
  pay(asked: Asked): Promise<PayStart | Failed>
  /** A payment made: the order it becomes. In the demo there is no payment, only what was asked for. */
  paid(payment: string, asked: Asked): Promise<Placed | Failed>
  /** A document's file, saved to the device. */
  download(product: Product): Promise<true | Failed>
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

export const server: Backend = {
  store: () => call<StoreAnswer>('GET', '/api/store'),
  order: (asked) => call<Placed>('POST', '/api/order', asked),
  pay: (asked) => call<PayStart>('POST', '/api/pay', asked),
  paid: (payment) => call<Placed>('POST', '/api/order', { payment }),
  async download(product) {
    try {
      const res = await fetch(`/api/file?product=${encodeURIComponent(product.id)}`, { credentials: 'same-origin', cache: 'no-store' })
      if (!res.ok) return { error: ((await res.json().catch(() => null)) as Failed | null)?.error ?? 'server' }
      save(await res.blob(), /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? `${product.name}.pdf`)
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
