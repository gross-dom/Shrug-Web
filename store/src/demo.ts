import { canSee, dueCents, numberOf, onFile, refusalOf, updateOf, wayOf, type Member, type Order, type OrderStatus, type Product, type Update } from '../shared/rules'
import { samplePdf } from '../shared/sample'
import { save, type Asked, type Backend, type Failed, type Placed, type Who } from './backend'

// A stand-in for the server, for the click-through demo only. It lives in the browser, sends no email, takes
// no money and talks to nothing. It shares the card page's own demo (the same people, the same balance, kept
// in the same place), so points spent here are gone from the card there. The rules it goes by are the
// server's own (shared/rules.ts); only where things are kept is different.

/** The card page's demo keeps who is signed in here (see the stand-in at the foot of card/index.html). */
const CARD = 'shrugdemo.v1'
const STORE = 'shrugdemo.store.v2'

export const PEOPLE: Record<string, { label: string; member: { name: string; first: string; roles: string[]; tier: string; points: number; number: string; since: number } | null; funds: string[] }> = {
  founder: { label: 'Founder, silver, 1,250 points', member: { name: 'Sample Member', first: 'Sample', roles: ['Founder'], tier: 'silver', points: 1250, number: '014', since: 2026 }, funds: [] },
  lp: { label: 'LP in Shrug 1, gold, 8,400 points', member: { name: 'Sample Member', first: 'Sample', roles: ['LP'], tier: 'gold', points: 8400, number: '003', since: 2021 }, funds: ['Shrug 1'] },
  investor: { label: 'Investor, silver, 400 points', member: { name: 'Sample Member', first: 'Sample', roles: ['Investor'], tier: 'silver', points: 400, number: '027', since: 2024 }, funds: [] },
  black: { label: 'Investor, black, 20,000 points', member: { name: 'Sample Member', first: 'Sample', roles: ['Investor'], tier: 'black', points: 20000, number: '027', since: 2024 }, funds: [] },
}

/** Things the demo can be made to do, so that every state the store has can be seen. */
export const SCENES: Record<string, string> = {
  normal: 'As it is',
  soldout: 'The acrylic sold out',
  kept: 'The acrylic kept to Shrug 1 LPs',
  empty: 'Nothing in the store, no updates',
  down: 'The store does not answer',
  declined: 'A payment that fails',
  lastgone: 'The last one goes as you buy',
  offline: 'No connection as you buy',
}

const item = (id: string, name: string, more: Partial<Product>): Product => ({
  id, name, kind: 'Other', status: 'Available', visibleTo: ['Everyone'], points: null, floor: null, postage: null, description: '', picture: null, pictures: [], hasFile: false, options: [], editionOf: null, left: null, limited: false, needsAddress: false, place: 0, ...more,
})

/** Where each product's one line goes, until Shrug has written them (Products → Description in Airtable). */
const LINE = 'A one-line write-up goes here.'

/** The store as Shrug has it. A chair is a product for each color (Workspace, Matte Black), and the
 * photographs are found by name (pictures.ts). */
const SHELVES: Product[] = [
  item('chromatic', 'Chromatic', { kind: 'Book', points: 400, needsAddress: true, description: LINE }),
  item('chair', 'Workspace, Matte Black', { kind: 'Chair', points: 14500, floor: 500, postage: 70, editionOf: 5, left: 3, needsAddress: true, description: LINE }),
  item('chair-red', 'Workspace, Ferrari Red', { kind: 'Chair', status: 'On request', points: 15000, floor: 1500, needsAddress: true, description: LINE }),
  item('acrylic', 'Art on Acrylic', { kind: 'Art', points: 2800, floor: 75, postage: 5, editionOf: 10, left: 7, needsAddress: true, description: LINE }),
  item('catalog', 'WS Catalog', { kind: 'Book', points: 1000, needsAddress: true, description: LINE }),
  item('2027', 'Shrug 2027', { kind: 'Book', status: 'Pre-order', needsAddress: true, description: LINE }),
].map((product, place) => ({ ...product, place }))

/** An update is unlocked for 10 points by the people it was written for (Products → Points on its row). */
const paper = (id: string, name: string, more: Partial<Product>): Product => item(id, name, { kind: 'Document', points: 10, hasFile: true, group: 'Funds', ...more })
const PAPERS: Product[] = [
  paper('update-4', 'Shrug 4 LP Update', {}),
  paper('update-capital', 'Shrug Capital Update', {}),
  paper('update-1', 'Shrug 1 LP Update', { visibleTo: ['Shrug 1 LPs'], listed: true }),
  paper('update-2', 'Shrug 2 LP Update', { visibleTo: ['Shrug 2 LPs'], listed: true }),
  paper('update-3', 'Shrug 3 LP Update', { visibleTo: ['Shrug 3 LPs'], listed: true }),
  paper('update-spv', 'SPV updates', { group: 'SPVs', hasFile: false }),
].map((product, place) => ({ ...product, place: 100 + place }))

interface CardState {
  pick: string
  session: { member: NonNullable<(typeof PEOPLE)[string]['member']> | null; seen: number | null; emails?: boolean; reason?: string } | null
}
interface StoreState {
  orders: (Order & { who: string })[]
  left: Record<string, number>
  shipTo: string
  scene: string
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
const kept = (): StoreState => ({ orders: [], left: {}, shipTo: '', scene: 'normal', ...read<Partial<StoreState>>(STORE, {}) })
const lag = (ms: number) => new Promise((done) => setTimeout(done, ms))

function now(): { state: CardState; member: Member | null } {
  const state = card()
  const who = state.session?.member
  const member = who ? { id: state.pick, name: who.name, first: who.first, roles: who.roles, funds: PEOPLE[state.pick]?.funds ?? [], tier: who.tier, points: who.points } : null
  return { state, member }
}

function shelves(store: StoreState): Product[] {
  if (store.scene === 'empty') return []
  return SHELVES.map((product) => ({
    ...product,
    left: product.left === null ? null : product.id === 'acrylic' && store.scene === 'soldout' ? 0 : (store.left[product.id] ?? product.left),
    visibleTo: product.id === 'acrylic' && store.scene === 'kept' ? ['Shrug 1 LPs'] : product.visibleTo,
  }))
}
const papers = (store: StoreState) => (store.scene === 'empty' ? [] : PAPERS)
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const reference = () => 'SV-' + Array.from({ length: 6 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('')

function place(asked: Asked, paying: boolean): Placed | Failed {
  const { state, member } = now()
  if (!member || !state.session?.member) return { error: 'anon' }
  const store = kept()
  if (store.scene === 'offline') return { error: 'offline' }
  const mine = store.orders.filter((order) => order.who === member.id)
  const typed = (asked.shipTo ?? '').trim()
  const ask = (product: Product, status: OrderStatus, points: number, cents: number, takes: boolean): Placed => {
    const order = { id: `demo-${Date.now()}`, reference: reference(), status, productId: product.id, productName: product.name, option: asked.option ?? '', number: takes ? numberOf(product) : '', points, paid: cents / 100, placed: new Date().toISOString(), who: member.id }
    store.orders.unshift(order)
    if (takes && product.left !== null) store.left[product.id] = product.left - 1
    if (onFile(typed)) store.shipTo = typed
    write(STORE, store)
    state.session!.member!.points -= points
    // Spent points are no news to the card: its "since you last looked" is for points that arrive
    state.session!.seen = state.session!.member!.points
    write(CARD, state)
    return { ok: true, order, points: state.session!.member!.points }
  }
  // An update that is listed to them and written for others: asked for
  const doc = papers(store).find((p) => p.id === asked.product)
  if (doc) {
    const state = updateOf(member, doc, mine)?.state
    if (state === 'request') return ask(doc, 'Requested', 0, 0, false)
    // Theirs to unlock: the points it costs are taken, and it is open to them from then on
    if (state === 'locked') return refusalOf(member, doc, mine, { points: asked.points ?? 0 }) || dueCents(doc, asked.points ?? 0) > 0 ? { error: 'points' } : ask(doc, 'Points', asked.points ?? 0, 0, false)
    return { error: 'already' }
  }
  const product = shelves(store).find((p) => p.id === asked.product && canSee(member, p))
  if (!product) return { error: 'hidden' }
  if (store.scene === 'lastgone') return { error: 'sold-out' }
  const refusal = refusalOf(member, product, mine, { ...asked, shipTo: onFile(typed) ? typed : store.shipTo })
  if (refusal) return { error: refusal }
  const way = wayOf(product)
  const points = way === 'buy' ? (asked.points ?? 0) : 0
  const due = way === 'buy' ? dueCents(product, points) : 0
  if (due > 0 && !paying) return { error: 'pay' }
  if (due > 0 && store.scene === 'declined') return { error: 'unpaid' }
  const status: OrderStatus = way === 'request' ? 'Requested' : way === 'reserve' || product.status === 'Pre-order' ? 'Pre-order' : due > 0 ? 'Paid' : 'Points'
  return ask(product, status, points, due, way === 'buy')
}

export const demo: Backend = {
  async store() {
    await lag(350)
    const { state, member } = now()
    const store = kept()
    if (store.scene === 'down') return { error: 'server' }
    if (!state.session) return { status: 'anon' }
    if (!member) return { status: 'applied' }
    const orders = store.orders.filter((order) => order.who === member.id)
    const who: Who = { ...member, number: state.session.member?.number ?? '', since: state.session.member?.since ?? null, reason: state.session.reason ?? null, emails: state.session.emails !== false, email: 'sample@example.com', shipTo: store.shipTo }
    return {
      status: 'member',
      member: who,
      products: shelves(store).filter((p) => canSee(member, p)),
      updates: papers(store).map((p) => updateOf(member, p, orders)).filter((u): u is Update => !!u),
      orders,
      stripeKey: '',
    }
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
  async address(shipTo) {
    await lag(300)
    if (!onFile(shipTo)) return { error: 'address' }
    const tidy = shipTo.split('\n').map((line) => line.trim()).filter(Boolean).join('\n')
    write(STORE, { ...kept(), shipTo: tidy })
    return { ok: true, shipTo: tidy }
  },
  async emails(on) {
    await lag(250)
    const state = card()
    if (state.session) write(CARD, { ...state, session: { ...state.session, emails: on } })
    return { ok: true, emails: on }
  },
  async view(update) {
    await lag(300)
    return URL.createObjectURL(new Blob([samplePdf(update.name)], { type: 'application/pdf' }))
  },
  async download(update) {
    await lag(300)
    save(new Blob([samplePdf(update.name)], { type: 'application/pdf' }), `${update.name}.pdf`)
    return true
  },
  async signout() {
    const state = card()
    state.session = null
    write(CARD, state)
  },
}

// ---- What the demo's own controls do

export const demoPick = () => card().pick
export const demoScene = () => kept().scene
export const demoSetScene = (scene: string) => write(STORE, { ...kept(), scene })
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
  state.session.reason = 'the demo'
  write(CARD, state)
}
/** Everything as it began: the shelves full, nothing ordered, no address. */
export const demoReset = () => write(STORE, { orders: [], left: {}, shipTo: '', scene: 'normal' })
