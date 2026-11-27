import { PUBLIC, STARTING_POINTS, endOf, phoneOf, updateOf, type Needs, type Picture, type Product, type Update, type Via } from '../../store/shared/rules'
import { samplePdf } from '../../store/shared/sample'
import { createStore } from './store'

// Who is logged in on the desktop, and what is theirs. It is the store's own system (store/): the same
// members, the same way in, and the same rule for who sees what (Products → Visible to in Airtable, against a
// member's Role and Funds). The desktop asks that server, at /api on its own address (vercel.json sends those
// requests on to it), so the answer here and the answer in the store are always the same one.
//
// Logging in, as the server has it (store/README.md, "Signing in"): an email first, and the answer says what
// comes next. An address nobody has is asked for a phone number, which is texted six digits. An address with
// a number on file is texted there. Someone on the list confirms their inbox once, and then adds a number.
// The first time, a display name and a picture are asked for.
//
// Until that server is live the desktop is built as a demo (anything but VITE_ACCOUNT=live): a stand-in
// here in the browser answers instead, by the same rules. It sends nothing. Any six digits are right and
// 000000 is wrong; an address that begins "lp" is on the list (an LP in Shrug 2 and Shrug 4); any other is
// not. What it knows is kept in this browser, so someone who has logged in is known the next time.

const LIVE = import.meta.env.VITE_ACCOUNT === 'live'
export const ACCOUNT_DEMO = !LIVE

/** A document in the Updates folder, as the LP who is logged in is shown it (store/shared/rules.ts, `Update`):
 *   open       theirs to read: it opens in Preview
 *   locked     theirs, at a price in points: the VIP Store is where it is unlocked
 *   request    written for the LPs of another fund: they may ask for it
 *   requested  they have asked
 *   soon       listed, with no file yet
 *   closed     written for a fund's LPs, and shown by name to someone who is not an LP: not theirs to read or ask for */
export interface Doc {
  id: string
  name: string
  /** The heading it is under: Funds, SPVs. */
  group: string
  /** Who it was written for, as its second line has it ("Shrug 4 LPs", "All LPs") and as its tag does ("Shrug 4", "All"). */
  forWhom: string
  tag: string
  /** When it was added, as a date and time; or, in words, when one still to come is expected ("December"). Empty where neither is known. */
  date: string
  state: Update['state']
  /** What it costs to unlock, in points, where it is locked. */
  points: number
  /** It may be saved as well as read. Shrug can switch that off for a document. */
  download: boolean
}

export interface Member {
  first: string
  name: string
  email: string
  points: number
  /** Founder, LP, Investor: any of them, or none for a standard member. */
  roles: string[]
  /** The Shrug funds they are an LP in. */
  funds: string[]
  picture: Picture | null
  /** What their account still lacks: a number to log in with, a name and picture of their own. */
  needs: Needs
  /** How they got in this time. Someone who has just proved their email may add or change a number. */
  via: Via
  docs: Doc[]
}

/** (`docs` on nobody logged in: what anyone is shown of the Updates folder. One update may be for everyone.) */
export type Account = { status: 'checking' | 'down' } | { status: 'anon'; docs?: Doc[] } | ({ status: 'member' } & Member)

/** The Updates folder's documents as someone is shown them: their own, or, logged out, what anyone is. */
export const docsOf = (who: Account): Doc[] => (who.status === 'member' ? who.docs : who.status === 'anon' ? (who.docs ?? []) : [])

export const account = createStore<Account>({ status: 'checking' })

/** One of Shrug's LPs: the Updates folder is theirs to open. */
export const isLP = (who: Account): boolean => who.status === 'member' && who.roles.includes('LP')

// ---- The sheet: let down by Log In itself, or by something locked that needs someone logged in

/** What the sheet was opened for, where something locked opened it: it says so at its head. */
export type Why = 'updates' | 'request' | 'post' | 'price' | 'booth' | 'name' | 'invest' | 'mail' | null

/** An LP has just logged in: when, and how many documents are theirs. The desk says so once (Surface.tsx). */
export const unlocked = createStore<{ at: number; docs: number } | null>(null)

/** `says` is a line of the opener's own under the sheet's head, in place of the usual one: what is kept while they log in. */
export const logIn = createStore<{ open: boolean; why: Why; says?: string }>({ open: false, why: null })
export const askLogIn = (why: Why = null, says?: string) => {
  // What has the keyboard as it is asked for, and the window that is in (a row of a list is gone once it is
  // opened, its window is not): where the keyboard is given back if the sheet is put away with Escape
  const had = typeof document !== 'undefined' ? document.activeElement : null
  askedFrom = had instanceof HTMLElement && had !== document.body ? { el: had, win: had.closest<HTMLElement>('.wf') } : null
  logIn.set({ open: true, why, says })
}
let askedFrom: { el: HTMLElement; win: HTMLElement | null } | null = null
/** Where the keyboard goes back to as Log In is put away: what had it, or its window's own place for the keyboard; null for the bar's Log In. */
export function keyboardBack(): HTMLElement | null {
  const had = askedFrom
  askedFrom = null
  return had?.el.isConnected ? had.el : had?.win?.isConnected ? (had.win.querySelector<HTMLElement>('[data-autofocus]') ?? null) : null
}
export const closeLogIn = () => logIn.set((s) => (s.open || s.why ? { open: false, why: null } : s))

// ---- What the server answers

export interface Failed {
  error: string
  /** How long until it can be tried again, in seconds. */
  retryIn?: number
  /** Guesses left at a code. */
  left?: number
  /** A code sent a moment ago is still good: which kind, and (for a text) where the number ends. */
  step?: 'text' | 'inbox'
  to?: string
}
/** What comes after an email: a phone number to give; a code texted to the number on file; a code in their inbox. */
export type Started = { step: 'phone' } | { step: 'text'; to: string; resendIn: number } | { step: 'inbox'; resendIn: number }
export type Texted = { ok: true; phone: string; resendIn: number }

type StoreAnswer =
  | { status: 'visitor'; updates?: Update[] }
  | { status: 'member'; member: { name: string; first: string; email: string; points: number; roles: string[]; funds: string[]; picture: Picture | null }; needs: Needs; via: Via; updates: Update[] }
  | { error: string }

async function call<T>(method: string, path: string, body?: unknown): Promise<T | Failed> {
  try {
    const res = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin', cache: 'no-store' })
    const answer = await res.json().catch(() => null)
    return answer && typeof answer === 'object' ? (answer as T) : { error: 'server' }
  } catch {
    return { error: 'offline' }
  }
}

/** The folder holds the same list as the server's updates, which is where it is said what each member is shown. */
const asDocs = (updates: (Update & { download?: boolean })[]): Doc[] =>
  updates.map((update) => {
    const all = update.forWhom === 'Everyone on the list'
    const anyone = update.forWhom === 'Everyone'
    return {
      id: update.id,
      name: update.name,
      group: update.group,
      forWhom: all ? 'All LPs' : update.forWhom,
      // "Shrug 2 LPs, Shrug 4 LPs" is tagged "Shrug 2, Shrug 4"
      tag: all ? 'All' : anyone ? 'Everyone' : update.forWhom.replace(/ LPs\b/g, ''),
      date: update.date ?? '',
      state: update.state,
      points: update.points,
      download: update.download !== false,
    }
  })

// ---- The stand-in, for the demo

const KEPT = 'shrug:account-demo.v2'

interface DemoRow {
  email: string
  listed: boolean
  confirmed: boolean
  phone: string | null
  /** The name Shrug has for someone on the list. */
  shrugName: string
  /** The name they chose. */
  name: string
  picture: Picture | null
  points: number
  roles: string[]
  funds: string[]
}
interface Demo {
  rows: Record<string, DemoRow>
  in: string | null
  via: Via
  /** Wrong guesses since the last code, and until when codes are paused. */
  wrong: number
  pausedUntil: number
  /** The documents each address has asked for. */
  asked?: Record<string, string[]>
}

// The demo's Updates folder (Dom, 27 Nov): four updates. Updates 1, 2 and 3 were written for the LPs of Shrug
// 1, 2 and 3, and are locked to everyone else; Update 4 is for everyone, logged in or not. They are dummy
// files, standing where Shrug's own will (each to be called "Shrug Capital Update" when it is uploaded: a
// document's name is its row's in Products). Who is shown what is worked out by the store's own rule
// (updateOf, store/shared/rules.ts), as the server works it out, so the demo cannot say otherwise: the demo's
// LP, who is in Shrug 2 and Shrug 4, reads Update 2 and Update 4 and may ask for 1 and 3.
const dummy = (n: number, visibleTo: string[], added: string): Product => ({ id: `update-${n}`, name: `Update ${n}`, kind: 'Document', status: 'Available', visibleTo, points: 0, floor: null, postage: null, description: '', picture: null, hasFile: true, options: [], editionOf: null, left: null, limited: false, needsAddress: false, place: n, listed: true, group: 'Funds', added })
const DEMO_UPDATES: Product[] = [dummy(1, ['Shrug 1 LPs'], '2026-08-14T17:00:00Z'), dummy(2, ['Shrug 2 LPs'], '2026-09-12T17:00:00Z'), dummy(3, ['Shrug 3 LPs'], '2026-10-11T17:00:00Z'), dummy(4, [PUBLIC], '2026-11-24T17:00:00Z')]
/** The demo's fuller folder, for an LP, at an address that says ?docs=more: each of the states a document
 * can be in, which the four above do not all show (one read here and not saved, one still to come, one under
 * SPVs). It is there for the checks, which need every state to look at. */
const MORE_DOCS = typeof window !== 'undefined' && /[?&]docs=more\b/.test(window.location.search)
const paper = (id: string, name: string, tag: string, date: string, state: Doc['state'], more: Partial<Doc> = {}): Doc => ({ id, name, group: 'Funds', forWhom: `${tag} LPs`, tag, date, state, points: 0, download: true, ...more })
const FULLER: Doc[] = [
  paper('update-4', 'Shrug 4 update, Q3 2026', 'Shrug 4', '2026-11-14T17:00:00Z', 'open'),
  // (one that Shrug has said is to be read here and not saved)
  paper('update-2', 'Shrug 2 update, Q3 2026', 'Shrug 2', '2026-11-12T17:00:00Z', 'open', { download: false }),
  paper('update-capital', 'Shrug Capital update, 2026', 'All', '2026-11-24T17:00:00Z', 'open'),
  paper('update-3', 'Shrug 3 update, Q3 2026', 'Shrug 3', '2026-11-11T17:00:00Z', 'request'),
  paper('letter-2', 'Shrug 2 annual letter', 'Shrug 2', 'December', 'soon'),
  paper('update-spv', 'SPV update', 'SPV', '2026-10-03T17:00:00Z', 'request', { group: 'SPVs' }),
]
/** What someone is shown of them: `asked` is the ones they have asked for. */
const demoDocs = (who: { roles: string[]; funds: string[] }, asked: string[] = []): Doc[] =>
  MORE_DOCS && who.roles.includes('LP')
    ? FULLER.map((doc) => (doc.state === 'request' && asked.includes(doc.id) ? { ...doc, state: 'requested' as const } : doc))
    : asDocs(DEMO_UPDATES.map((product) => updateOf(who, product, asked.map((productId) => ({ productId, status: 'Requested' as const })))).filter((update): update is Update => !!update))
/** How many pages each of the demo's documents has: a stand-in is drawn with that many. */
const DEMO_PAGES: Record<string, number> = MORE_DOCS ? { 'update-4': 4, 'update-2': 6, 'update-capital': 14 } : { 'update-1': 5, 'update-2': 6, 'update-3': 4, 'update-4': 8 }
/** How long the demo pauses codes for after five wrong guesses: long enough to see, short enough to wait out. */
const DEMO_PAUSE = 30
const DEMO_AGAIN = 20
/** The address the demo's personal link is for. */
const DEMO_LP = 'lp@example.com'
const lag = (ms: number) => new Promise((done) => setTimeout(done, ms))
const onList = (email: string) => /^lp([.+_-][^@]*)?@/i.test(email)

function demo(): Demo {
  try {
    const kept = JSON.parse(window.localStorage.getItem(KEPT) ?? 'null') as Demo | null
    if (kept && typeof kept === 'object' && kept.rows) return kept
  } catch {
    // No storage, or nothing kept: begin again
  }
  return { rows: {}, in: null, via: 'text', wrong: 0, pausedUntil: 0 }
}
let held: Demo | null = null
const state = () => (held ??= demo())
function keep() {
  try {
    window.localStorage.setItem(KEPT, JSON.stringify(state()))
  } catch {
    // No storage: logged in for as long as the page is open
  }
  toStore()
}

// The store's pages have a demo of their own (the card's page keeps who is signed in, and the store reads it
// there: store/src/demo.ts). In the VIP Store window they are this site's own pages, so the two demos are
// kept as one: whoever is logged in here is who the store's demo finds signed in, with the same points, and
// what is spent or signed out of there is read back here.
const STORE_DEMO = 'shrugdemo.v1'

function toStore() {
  const s = state()
  const row = s.in ? s.rows[s.in] : null
  const name = row ? row.name || row.shrugName : ''
  const lp = !!row?.roles.includes('LP')
  const session = row ? { member: { name, first: name.split(/\s+/)[0] ?? '', roles: row.roles, tier: lp ? 'gold' : row.listed ? 'silver' : 'standard', points: row.points, number: row.listed ? '003' : '', since: row.listed ? 2021 : 2026 }, seen: row.points, emails: true, email: row.email, ...(row.phone ? { phone: row.phone } : {}) } : null
  try {
    window.localStorage.setItem(STORE_DEMO, JSON.stringify({ pick: lp ? 'lp' : 'standard', session, wrong: 0, bumps: 0, phoned: true }))
  } catch {
    // No storage: the store's demo begins as nobody
  }
}

/** What the store's demo has done since: points spent there are spent here, and signed out there is logged out here. */
function fromStore() {
  const s = state()
  let row = s.in ? s.rows[s.in] : null
  try {
    const theirs = JSON.parse(window.localStorage.getItem(STORE_DEMO) ?? 'null') as { session?: { member?: { points?: number; name?: string }; email?: string; phone?: string } | null } | null
    if (!theirs) return
    // A visitor who has just paid there: the payment made them an account, and they are logged in to it
    if (!row && theirs.session?.member && theirs.session.email) {
      const email = theirs.session.email
      row = s.rows[email] ??= standardRow(email, null)
      // The name they gave at the checkout is the name on the account it made (only then: someone who logs
      // in on the desk is asked for theirs there)
      if (theirs.session.member.name && !row.name) row.name = theirs.session.member.name
      s.in = email
      s.via = 'pay'
    }
    if (!row) return
    if (!theirs.session) s.in = null
    else {
      if (typeof theirs.session.member?.points === 'number') row.points = theirs.session.member.points
      // The number they gave after paying is theirs to log in with
      if (theirs.session.phone && !row.phone) row.phone = phoneOf(theirs.session.phone) ?? row.phone
    }
    window.localStorage.setItem(KEPT, JSON.stringify(s))
  } catch {
    // Nothing to read back
  }
}
const listedRow = (email: string): DemoRow => ({ email, listed: true, confirmed: false, phone: null, shrugName: 'Jordan Avery', name: '', picture: null, points: 8400, roles: ['LP'], funds: ['Shrug 2', 'Shrug 4'] })
const standardRow = (email: string, phone: string | null): DemoRow => ({ email, listed: false, confirmed: false, phone, shrugName: '', name: '', picture: null, points: STARTING_POINTS, roles: [], funds: [] })
const textsIn = (row: DemoRow) => !!row.phone && (!row.listed || row.confirmed)

/** A guess at a code, in the demo: 000000 is wrong, five wrong ones pause codes, and anything else is right. */
function demoGuess(code: string): Failed | null {
  const s = state()
  const now = Date.now()
  if (now < s.pausedUntil) return { error: 'locked', retryIn: Math.ceil((s.pausedUntil - now) / 1000) }
  if (code !== '000000') {
    s.wrong = 0
    return null
  }
  s.wrong += 1
  if (s.wrong < 5) return keep(), { error: 'wrong', left: 5 - s.wrong }
  s.wrong = 0
  s.pausedUntil = now + DEMO_PAUSE * 1000
  keep()
  return { error: 'locked', retryIn: DEMO_PAUSE }
}

function demoAccount(): Account {
  const s = state()
  const row = s.in ? s.rows[s.in] : null
  if (!row) return { status: 'anon', docs: demoDocs({ roles: [], funds: [] }) }
  const name = row.name || row.shrugName
  return { status: 'member', first: name.split(/\s+/)[0] ?? '', name, email: row.email, points: row.points, roles: row.roles, funds: row.funds, picture: row.picture, needs: { phone: !row.phone, profile: !row.name }, via: s.via, docs: demoDocs(row, s.asked?.[row.email] ?? []) }
}

// ---- Asking

/** Asks who is logged in, and what is theirs. */
export async function refreshAccount(): Promise<Account> {
  let next: Account
  if (!LIVE) {
    fromStore()
    next = demoAccount()
  } else {
    const answer = await call<StoreAnswer>('GET', '/api/store')
    next =
      'error' in answer
        ? { status: 'down' }
        : answer.status === 'member'
          ? { status: 'member', ...answer.member, needs: answer.needs, via: answer.via, docs: asDocs(answer.updates ?? []) }
          : // Nobody logged in: the store calls them a visitor, and shows them its shelves and the updates anyone is shown
            { status: 'anon', docs: asDocs(answer.updates ?? []) }
  }
  account.set(next)
  return next
}

/** The first step: an email, and what comes next for it. `byInbox` asks for the email whatever their account says: for a number that is lost. */
export async function start(email: string, byInbox = false): Promise<Started | Failed> {
  if (LIVE) {
    const answer = await call<Started & { ok?: true }>('POST', '/api/start', byInbox ? { email, by: 'inbox' } : { email })
    return answer
  }
  await lag(450)
  email = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'email' }
  const s = state()
  if (Date.now() < s.pausedUntil) return { error: 'locked', retryIn: Math.ceil((s.pausedUntil - Date.now()) / 1000) }
  let row = s.rows[email]
  if (!row && !onList(email)) return { step: 'phone' }
  if (!row) {
    row = s.rows[email] = listedRow(email)
    keep()
  }
  return !byInbox && textsIn(row) ? { step: 'text', to: endOf(row.phone!), resendIn: DEMO_AGAIN } : { step: 'inbox', resendIn: DEMO_AGAIN }
}

/** For someone new: their number, which is texted six digits. */
export async function textTo(email: string, phone: string): Promise<Texted | Failed> {
  if (LIVE) return call<Texted>('POST', '/api/text', { email, phone })
  await lag(450)
  const number = phoneOf(phone)
  return number ? { ok: true, phone: number, resendIn: DEMO_AGAIN } : { error: 'phone' }
}

/** The six digits. Right, and the desk knows who is here. `phone` goes with it for someone new; `byInbox` as it was started. */
export async function verify(asked: { email: string; code: string; phone?: string; byInbox?: boolean }): Promise<{ ok: true; existing: boolean } | Failed> {
  let existing = false
  if (LIVE) {
    const answer = await call<{ status?: string; existing?: boolean }>('POST', '/api/verify', { email: asked.email, code: asked.code, ...(asked.phone ? { phone: asked.phone } : {}), ...(asked.byInbox ? { by: 'inbox' } : {}) })
    if ('error' in answer) return answer
    existing = answer.existing === true
  } else {
    await lag(550)
    const wrong = demoGuess(asked.code)
    if (wrong) return wrong
    const s = state()
    const email = asked.email.trim().toLowerCase()
    let row = s.rows[email]
    if (!row) {
      const number = phoneOf(asked.phone)
      if (!number) return { error: 'expired' }
      // One account to a number: someone whose number already has one is logged in to that
      const theirs = Object.values(s.rows).find((other) => other.phone === number)
      existing = !!theirs
      row = theirs ?? (s.rows[email] = standardRow(email, number))
      s.via = 'text'
    } else if (!asked.byInbox && textsIn(row)) s.via = 'text'
    else {
      row.confirmed = true
      s.via = 'inbox'
    }
    s.in = row.email
    keep()
  }
  await refreshAccount()
  return { ok: true, existing }
}

/** A number for whoever is logged in: asked with the number alone, it is texted six digits. */
export async function addPhone(phone: string): Promise<Texted | Failed> {
  if (LIVE) return call<Texted>('POST', '/api/phone', { phone })
  await lag(450)
  const s = state()
  const row = s.in ? s.rows[s.in] : null
  const number = phoneOf(phone)
  if (!row) return { error: 'anon' }
  if (!number) return { error: 'phone' }
  if (!(s.via === 'inbox' || s.via === 'link') && (row.listed || row.phone)) return { error: 'confirm' }
  return { ok: true, phone: number, resendIn: DEMO_AGAIN }
}

/** The six digits texted to it: right, and the number is theirs to log in with. */
export async function provePhone(phone: string, code: string): Promise<{ ok: true } | Failed> {
  if (LIVE) {
    const answer = await call<{ ok?: true }>('POST', '/api/phone', { phone, code })
    if ('error' in answer) return answer
  } else {
    await lag(550)
    const wrong = demoGuess(code)
    if (wrong) return wrong
    const s = state()
    const row = s.in ? s.rows[s.in] : null
    const number = phoneOf(phone)
    if (!row || !number) return { error: 'expired' }
    if (Object.values(s.rows).some((other) => other !== row && other.phone === number)) return { error: 'taken' }
    row.phone = number
    keep()
  }
  await refreshAccount()
  return { ok: true }
}

/** A display name, and a picture: one of Shrug's faces by its name, or a photo as a data: address. */
export async function saveProfile(asked: { name?: string; face?: string; photo?: string }): Promise<{ ok: true } | Failed> {
  if (LIVE) {
    const answer = await call<{ ok?: true }>('POST', '/api/profile', asked)
    if ('error' in answer) return answer
  } else {
    await lag(400)
    const s = state()
    const row = s.in ? s.rows[s.in] : null
    if (!row) return { error: 'anon' }
    if (asked.name !== undefined) {
      const name = asked.name.replace(/\s+/g, ' ').trim().slice(0, 40)
      if (!name) return { error: 'name' }
      row.name = name
    }
    if (asked.face) row.picture = { face: asked.face }
    else if (asked.photo) row.picture = { url: asked.photo }
    keep()
  }
  await refreshAccount()
  return { ok: true }
}

/** In the demo, what a personal link does (the address says ?login=link): an LP arrives with their email
 * confirmed, and is asked only for a number. On the real site the server has already done it (api/link.ts). */
export function demoLink() {
  if (LIVE) return
  const s = state()
  const row = (s.rows[DEMO_LP] ??= listedRow(DEMO_LP))
  if (row.phone) return
  row.confirmed = true
  s.in = row.email
  s.via = 'link'
  keep()
}

export async function logOut() {
  if (LIVE) await call('POST', '/api/signout', {})
  else {
    state().in = null
    keep()
  }
  // (the card's page keeps the card it last showed, to show it at once: that card was this person's)
  try {
    for (const kept of ['shrug.hint', 'shrug.card', 'shrug.pending']) window.localStorage.removeItem(kept)
  } catch {
    // Nothing kept, nothing to forget
  }
  // (logged out, the Updates folder is as anyone is shown it)
  account.set(LIVE ? { status: 'anon' } : { status: 'anon', docs: demoDocs({ roles: [], funds: [] }) })
  if (LIVE) void refreshAccount()
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** What came back when a document was asked for and not handed over:
 *   not-yours  it was written for others (the server says so to an LP it is listed to)
 *   missing    it is not there: no file yet, or moved
 *   anon       nobody is logged in
 *   offline    the request did not get there */
export type NotHere = { error: 'not-yours' | 'missing' | 'anon' | 'offline' }

const samplePages = (doc: Doc) => samplePdf(doc.name, DEMO_PAGES[doc.id] ?? 3)
const bytes = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff)

/** A document's file, to be read here (Preview). The server hands it over only to someone it is for, and
 * notes that it was opened; nothing of it is in the page until then. */
export async function readDoc(doc: Doc): Promise<Uint8Array | NotHere> {
  if (!LIVE) {
    await lag(500)
    // (one that is for everyone is read by anyone; anything else by someone logged in whom it is for)
    if (account.get().status !== 'member' && doc.state !== 'open') return { error: 'anon' }
    // (the demo's way to see a file that is gone: an address that says ?doc=missing)
    if (/[?&]doc=missing\b/.test(window.location.search)) return { error: 'missing' }
    return doc.state === 'open' ? bytes(samplePages(doc)) : { error: doc.state === 'soon' ? 'missing' : 'not-yours' }
  }
  try {
    const res = await fetch(`/api/file?product=${encodeURIComponent(doc.id)}&view=1`, { credentials: 'same-origin', cache: 'no-store' })
    if (res.ok) return new Uint8Array(await res.arrayBuffer())
    return { error: res.status === 401 ? 'anon' : res.status === 403 ? 'not-yours' : 'missing' }
  } catch {
    return { error: 'offline' }
  }
}

/** Asks Shrug for a document written for the LPs of another fund. Asked once: from then on it says Requested. */
export async function requestDoc(doc: Doc): Promise<true | { error: string }> {
  if (LIVE) {
    const answer = await call<{ ok: true }>('POST', '/api/order', { product: doc.id })
    // (asked already, from another window or another day: that is what they wanted)
    if ('error' in answer && answer.error !== 'already') return answer
  } else {
    await lag(400)
    const s = state()
    if (!s.in) return { error: 'anon' }
    const asked = ((s.asked ??= {})[s.in] ??= [])
    if (!asked.includes(doc.id)) asked.push(doc.id)
    keep()
  }
  await refreshAccount()
  return true
}

/** Downloads a document. The server hands it over only to someone it is for. */
export async function downloadDoc(doc: Doc): Promise<true | { error: string }> {
  if (!doc.download) return { error: 'kept' }
  if (!LIVE) {
    await lag(300)
    save(new Blob([samplePages(doc)], { type: 'application/pdf' }), `${doc.name}.pdf`)
    return true
  }
  try {
    const res = await fetch(`/api/file?product=${encodeURIComponent(doc.id)}`, { credentials: 'same-origin', cache: 'no-store' })
    if (!res.ok) return { error: ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'server' }
    save(await res.blob(), /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? `${doc.name}.pdf`)
    return true
  } catch {
    return { error: 'offline' }
  }
}
