import { awardFor, dueCents, mayHave, numberOf, onFile, refusalOf, unpriced, updateOf, VISITOR, wayOf, type Member, type Order, type OrderStatus, type Product, type Update } from '../shared/rules'
import { MORE_COLORS } from '../shared/colors'
import { samplePdf } from '../shared/sample'
import { save, type Asked, type Backend, type Failed, type Placed, type Who } from './backend'

// A stand-in for the server, for the click-through demo only. It lives in the browser, sends no email, takes
// no money and talks to nothing. It shares the card page's own demo (the same people, the same balance, kept
// in the same place), so points spent here are gone from the card there. The rules it goes by are the
// server's own (shared/rules.ts); only where things are kept is different.

/** The card page's demo keeps who is signed in here (see the stand-in at the foot of card/index.html). */
const CARD = 'shrugdemo.v1'
const STORE = 'shrugdemo.store.v3'

export const PEOPLE: Record<string, { label: string; member: { name: string; first: string; roles: string[]; tier: string; points: number; number: string; since: number } | null; funds: string[] }> = {
  founder: { label: 'Founder, silver, 1,250 points', member: { name: 'Sample Member', first: 'Sample', roles: ['Founder'], tier: 'silver', points: 1250, number: '014', since: 2026 }, funds: [] },
  lp: { label: 'LP in Shrug 2 and Shrug 4, gold, 8,400 points', member: { name: 'Sample Member', first: 'Sample', roles: ['LP'], tier: 'gold', points: 8400, number: '003', since: 2021 }, funds: ['Shrug 2', 'Shrug 4'] },
  investor: { label: 'Investor, silver, 400 points', member: { name: 'Sample Member', first: 'Sample', roles: ['Investor'], tier: 'silver', points: 400, number: '027', since: 2024 }, funds: [] },
  black: { label: 'Investor, black, 20,000 points', member: { name: 'Sample Member', first: 'Sample', roles: ['Investor'], tier: 'black', points: 20000, number: '027', since: 2024 }, funds: [] },
  // Not on the list: a standard member, as the server makes of anyone who signs in. No name until they give one
  standard: { label: 'Standard, not on the list, 100 points', member: { name: '', first: '', roles: [], tier: 'standard', points: 100, number: '', since: 2026 }, funds: [] },
}

/** Things the demo can be made to do, so that every state the store has can be seen. */
export const SCENES: Record<string, string> = {
  normal: 'As it is',
  soldout: 'Art No. 1 sold out',
  kept: 'Art No. 1 kept to Shrug 2 LPs',
  empty: 'Nothing in the store',
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

/** A chair, in one color: a product each (Workspace, Matte Black), as the store has them. Matte Black is
 * $1,100 and a painted one $1,200. Someone with the points for it can put as many towards one as they have;
 * the postage is the sample the demo has always had. */
const chair = (id: string, color: string, dollars: number, more: Partial<Product> = {}) => item(id, `Workspace, ${color}`, { kind: 'Chair', points: dollars * 10, postage: 70, needsAddress: true, description: LINE, ...more })
/** A book: posted for $5. */
const book = (id: string, name: string, dollars: number, more: Partial<Product> = {}) => item(id, name, { kind: 'Book', points: dollars * 10, postage: 5, needsAddress: true, description: LINE, ...more })
/** One of the six art pieces: $150, in an edition of 50. Their names are Shrug's to give. */
const art = (n: number, left = 50) => item(`art-${n}`, `Art No. ${n}`, { kind: 'Art', points: 1500, postage: 5, editionOf: 50, left, needsAddress: true, description: LINE })

/** Everything that is sold, as Shrug has it: five books (Books), six art pieces (ArtStore), and the chair in
 * each color (Workspace). The photographs are found by name (pictures.ts). The books' prices here are
 * samples: Shrug's own are in Airtable. */
const SHELVES: Product[] = [
  book('chromatic', 'Chromatic', 40),
  // (the two pre-orders are sent in two to three weeks, Dom's word of 26 Nov: neither has a day named, as
  // none has in Shrug's catalogue yet. Where one is, Products → Ships on, the day is what is said)
  book('build-the-future', 'Build the Future', 45, { status: 'Pre-order' }),
  book('what-is-shrug', 'What is Shrug?', 25),
  book('in-plain-sight', 'In Plain Sight', 55, { status: 'Pre-order' }),
  book('catalog', 'WS Catalog', 100),
  art(1, 43),
  art(2),
  art(3, 48),
  art(4),
  art(5),
  art(6),
  chair('chair-matte-black', 'Matte Black', 1100),
  chair('chair-scuderia-red', 'Scuderia Red', 1200),
  chair('chair-solar-orange', 'Solar Orange', 1200),
  chair('chair-alexandrite', 'Alexandrite', 1200),
  chair('chair-illusion-blue', 'Illusion Blue', 1200),
  chair('chair-supersonic', 'Supersonic', 1200),
  chair('chair-pearl-lavender', 'Pearl Lavender', 1200),
  chair('chair-mantis-green', 'Mantis Green', 1200),
  // The sixteen more colors (shared/colors.ts): each made to order, at a painted chair's price
  ...MORE_COLORS.map((color) => chair(`chair-${color.id}`, color.name, 1200)),
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
  /** `email` and `phone`: for an account a visitor's payment made, which has an address and, once they give it, a number. */
  session: { member: NonNullable<(typeof PEOPLE)[string]['member']> | null; seen: number | null; emails?: boolean; reason?: string; email?: string; phone?: string } | null
}
interface StoreState {
  /** `who`: the account an order is: its email (or, on the store's own site, where the demo has no emails, whoever it is viewed as). */
  orders: (Order & { who: string })[]
  left: Record<string, number>
  /** The address each account has on file. */
  shipTos: Record<string, string>
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
const kept = (): StoreState => ({ orders: [], left: {}, shipTos: {}, scene: 'normal', ...read<Partial<StoreState>>(STORE, {}) })
/** Which account is asking: an order and an address are that account's, and nobody else's who has used this browser. */
const accountOf = (state: CardState) => (state.session?.email ?? state.pick).toLowerCase()
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
    left: product.left === null ? null : product.id === 'art-1' && store.scene === 'soldout' ? 0 : (store.left[product.id] ?? product.left),
    visibleTo: product.id === 'art-1' && store.scene === 'kept' ? ['Shrug 2 LPs'] : product.visibleTo,
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
  const me = accountOf(state)
  const mine = store.orders.filter((order) => order.who === me)
  // Apple Pay gives the address saved in it, where the account has none on file: the real store keeps that
  // one (api/_lib/orders.ts). The demo has no Apple Pay to ask, so it keeps a stand-in under their own name
  const fromWallet = asked.wallet && !(asked.shipTo ?? '').trim() && !store.shipTos[me] ? `${member.name.trim() || 'Your name'}\n1 Example St\nSan Francisco, CA 94110` : ''
  const typed = (asked.shipTo ?? '').trim() || fromWallet
  const ask = (product: Product, status: OrderStatus, points: number, cents: number, takes: boolean): Placed => {
    const order = { id: `demo-${Date.now()}`, reference: reference(), status, productId: product.id, productName: product.name, option: asked.option ?? '', number: takes ? numberOf(product) : '', points, paid: cents / 100, placed: new Date().toISOString(), who: me }
    store.orders.unshift(order)
    if (takes && product.left !== null) store.left[product.id] = product.left - 1
    if (onFile(typed)) store.shipTos[me] = typed
    write(STORE, store)
    // What buying it awards (shared/rules.ts) is added with the order
    const awarded = takes ? awardFor(product) : 0
    state.session!.member!.points += awarded - points
    // Spent points are no news to the card: its "since you last looked" is for points that arrive, as the
    // ones this order awards do
    state.session!.seen = state.session!.member!.points - awarded
    write(CARD, state)
    return { ok: true, order, points: state.session!.member!.points, awarded }
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
  const product = shelves(store).find((p) => p.id === asked.product && mayHave(member, p))
  if (!product) return { error: 'hidden' }
  if (store.scene === 'lastgone') return { error: 'sold-out' }
  const refusal = refusalOf(member, product, mine, { ...asked, shipTo: onFile(typed) ? typed : store.shipTos[me] })
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
    // Nobody signed in (or the card's "not on the list", which the demo has no account for): a visitor
    // (and sent a chair without its figures, as the server sends it: its price is for someone logged in)
    if (!state.session || !member) return { status: 'visitor', products: shelves(store).filter((p) => mayHave(VISITOR, p)).map(unpriced), stripeKey: '' }
    const me = accountOf(state)
    const orders = store.orders.filter((order) => order.who === me)
    const who: Who = { ...member, number: state.session.member?.number ?? '', since: state.session.member?.since ?? null, reason: state.session.reason ?? null, emails: state.session.emails !== false, email: state.session.email ?? 'sample@example.com', shipTo: store.shipTos[me] ?? '' }
    return {
      status: 'member',
      member: who,
      products: shelves(store).filter((p) => mayHave(member, p)),
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
    const product = shelves(kept()).find((p) => p.id === asked.product && mayHave(member ?? VISITOR, p))
    if (!product) return { error: 'hidden' }
    // (a visitor cannot pay for what they are not shown the price of: api/pay.ts refuses the same)
    if (!member && unpriced(product).priceHidden) return { error: 'anon' }
    return { ok: true, demo: true, cents: dueCents(product, member ? (asked.points ?? 0) : 0) }
  },
  async paid(_payment, asked) {
    await lag(900)
    const state = card()
    if (state.session?.member) return place(asked, true)
    // A visitor: the payment makes their account, a standard one, from the email they paid with, and they are
    // signed in to it (api/order.ts does the same). The order is then that account's
    const email = (asked.email ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'email' }
    if (kept().scene === 'declined') return { error: 'unpaid' }
    // (under the name they gave at checkout, which is the name on their card)
    const name = (asked.name ?? '').trim().slice(0, 80)
    write(CARD, { ...state, pick: 'standard', session: { member: { ...PEOPLE.standard!.member!, name, first: name.split(/\s+/)[0] ?? '' }, seen: null, emails: true, email } })
    const placed = place({ ...asked, points: 0 }, true)
    if ('error' in placed) {
      write(CARD, state)
      return placed
    }
    return { ...placed, account: 'new', email }
  },
  async phone(phone, code) {
    await lag(500)
    const state = card()
    if (!state.session?.member) return { error: 'anon' }
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 8) return { error: 'phone' }
    if (!code) return { ok: true, phone }
    if (code === '000000') return { error: 'wrong' }
    write(CARD, { ...state, session: { ...state.session, phone } })
    return { ok: true }
  },
  async address(shipTo) {
    await lag(300)
    if (!onFile(shipTo)) return { error: 'address' }
    const tidy = shipTo.split('\n').map((line) => line.trim()).filter(Boolean).join('\n')
    const store = kept()
    store.shipTos[accountOf(card())] = tidy
    write(STORE, store)
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
export const demoReset = () => write(STORE, { orders: [], left: {}, shipTos: {}, scene: 'normal' })
