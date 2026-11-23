import { canSee, dueCents, numberOf, refusalOf, wayOf, type Member, type Order, type OrderStatus, type Product } from '../shared/rules'
import { samplePdf } from '../shared/sample'
import { save, type Asked, type Backend, type Failed, type Placed } from './backend'

// A stand-in for the server, for the click-through demo only. It lives in the browser, sends no email, takes
// no money and talks to nothing. It shares the card page's own demo (the same people, the same balance, kept
// in the same place), so points spent here are gone from the card there. The rules it goes by are the
// server's own (shared/rules.ts); only where things are kept is different.

/** The card page's demo keeps who is signed in here (see the stand-in at the foot of card/index.html). */
const CARD = 'shrugdemo.v1'
const STORE = 'shrugdemo.store.v1'

export const PEOPLE: Record<string, { label: string; member: { name: string; first: string; roles: string[]; tier: string; points: number; number: string; since: number } | null; funds: string[] }> = {
  founder: { label: 'Founder, silver', member: { name: 'Sample Member', first: 'Sample', roles: ['Founder'], tier: 'silver', points: 1250, number: '014', since: 2026 }, funds: [] },
  lp: { label: 'LP in Shrug 1, gold', member: { name: 'Sample Member', first: 'Sample', roles: ['LP'], tier: 'gold', points: 8400, number: '003', since: 2021 }, funds: ['Shrug 1'] },
  investor: { label: 'Investor, silver', member: { name: 'Sample Member', first: 'Sample', roles: ['Investor'], tier: 'silver', points: 400, number: '027', since: 2024 }, funds: [] },
  black: { label: 'Investor, black', member: { name: 'Sample Member', first: 'Sample', roles: ['Investor'], tier: 'black', points: 400, number: '027', since: 2024 }, funds: [] },
}

const item = (id: string, name: string, more: Partial<Product>): Product => ({
  id, name, kind: 'Other', status: 'Available', visibleTo: ['Everyone'], points: null, floor: null, postage: null, description: '', picture: null, hasFile: false, options: [], editionOf: null, left: null, limited: false, needsAddress: false, place: 0, ...more,
})

/** The shelves as they are in Airtable to begin with (Products), so the demo shows what the store will. */
const SHELVES: Product[] = [
  item('chromatic', 'Chromatic', { kind: 'Book', points: 400, needsAddress: true }),
  item('chair', 'Workspace Chair', { kind: 'Chair', points: 10000, floor: 450, postage: 70, options: ['Black', 'Stone', 'White'], limited: true, needsAddress: true }),
  item('chair-red', 'Workspace Chair, Ferrari Red', { kind: 'Chair', status: 'On request', points: 15000, floor: 1500, needsAddress: true }),
  item('acrylic', 'Art on Acrylic', { kind: 'Art', points: 2800, floor: 75, postage: 5, editionOf: 10, left: 10, needsAddress: true }),
  item('catalog', 'WS Catalog', { kind: 'Book', points: 1000, needsAddress: true }),
  item('2027', 'Shrug 2027', { kind: 'Book', status: 'Pre-order', needsAddress: true }),
  item('update-4', 'Shrug 4 LP Update', { kind: 'Document', points: 0, hasFile: true }),
  item('update-1', 'Shrug 1 LP Update', { kind: 'Document', points: 0, hasFile: true, visibleTo: ['Shrug 1 LPs'] }),
].map((product, place) => ({ ...product, place }))

interface CardState {
  pick: string
  session: { member: NonNullable<(typeof PEOPLE)[string]['member']> | null; seen: number | null; emails?: boolean; reason?: string } | null
  wrong?: number
  bumps?: number
}
interface StoreState {
  orders: (Order & { who: string })[]
  left: Record<string, number>
}

const read = <T,>(key: string, otherwise: T): T => {
  try {
    return (JSON.parse(window.localStorage.getItem(key) ?? 'null') as T) ?? otherwise
  } catch {
    return otherwise
  }
}
const write = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // No storage (a private window): the demo forgets between pages, and that is all
  }
}

const card = () => read<CardState>(CARD, { pick: 'founder', session: null })
const kept = () => read<StoreState>(STORE, { orders: [], left: {} })
const lag = (ms: number) => new Promise((done) => setTimeout(done, ms))

function now(): { state: CardState; member: Member | null } {
  const state = card()
  const who = state.session?.member
  const member = who ? { id: state.pick, name: who.name, first: who.first, roles: who.roles, funds: PEOPLE[state.pick]?.funds ?? [], tier: who.tier, points: who.points } : null
  return { state, member }
}

const shelves = (store: StoreState) => SHELVES.map((product) => ({ ...product, left: product.left === null ? null : (store.left[product.id] ?? product.left) }))
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const reference = () => 'SV-' + Array.from({ length: 6 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('')

function place(asked: Asked, paying: boolean): Placed | Failed {
  const { state, member } = now()
  if (!member || !state.session?.member) return { error: 'anon' }
  const store = kept()
  const product = shelves(store).find((p) => p.id === asked.product && canSee(member, p))
  if (!product) return { error: 'hidden' }
  const mine = store.orders.filter((order) => order.who === member.id)
  const refusal = refusalOf(member, product, mine, asked)
  if (refusal) return { error: refusal }
  const way = wayOf(product)
  const points = way === 'buy' ? (asked.points ?? 0) : 0
  const due = way === 'buy' ? dueCents(product, points) : 0
  if (due > 0 && !paying) return { error: 'pay' }
  const status: OrderStatus = way === 'request' ? 'Requested' : way === 'reserve' || product.status === 'Pre-order' ? 'Pre-order' : due > 0 ? 'Paid' : 'Points'
  const order = { id: `demo-${Date.now()}`, reference: reference(), status, productId: product.id, productName: product.name, option: asked.option ?? '', number: way === 'buy' ? numberOf(product) : '', points, paid: due / 100, placed: new Date().toISOString(), who: member.id }
  store.orders.unshift(order)
  if (way === 'buy' && product.left !== null) store.left[product.id] = product.left - 1
  write(STORE, store)
  state.session.member.points -= points
  // Spent points are no news to the card: its "since you last looked" is for points that arrive
  state.session.seen = state.session.member.points
  write(CARD, state)
  return { ok: true, order, points: state.session.member.points }
}

export const demo: Backend = {
  async store() {
    await lag(350)
    const { state, member } = now()
    if (!state.session) return { status: 'anon' }
    if (!member) return { status: 'applied' }
    const store = kept()
    return { status: 'member', member: { ...member, number: state.session.member?.number }, products: shelves(store).filter((p) => canSee(member, p)), orders: store.orders.filter((order) => order.who === member.id), stripeKey: '' }
  },
  async order(asked) {
    await lag(600)
    return place(asked, false)
  },
  async pay(asked) {
    await lag(300)
    const { member } = now()
    const product = member && shelves(kept()).find((p) => p.id === asked.product && canSee(member, p))
    if (!member || !product) return { error: 'hidden' }
    return { ok: true, demo: true, cents: dueCents(product, asked.points ?? 0) }
  },
  async paid(_payment, asked) {
    await lag(900)
    return place(asked, true)
  },
  async download(product) {
    await lag(300)
    save(new Blob([samplePdf(product.name)], { type: 'application/pdf' }), `${product.name}.pdf`)
    return true
  },
  async signout() {
    const state = card()
    state.session = null
    write(CARD, state)
  },
}

// ---- What the demo's own bar does

export const demoPick = () => card().pick
/** Puts one of the sample people in the pack, already opened: the store is theirs at once. */
export function demoSignIn(pick: string) {
  const person = PEOPLE[pick]
  if (!person?.member) return
  write(CARD, { ...card(), pick, session: { member: { ...person.member }, seen: person.member.points, emails: true } })
}
export function demoAddPoints(points: number) {
  const state = card()
  if (!state.session?.member) return
  state.session.member.points += points
  state.session.seen = state.session.member.points
  write(CARD, state)
}
/** The shelves full again and nothing ordered. */
export const demoReset = () => write(STORE, { orders: [], left: {} })
