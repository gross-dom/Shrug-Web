import { free, has, keptTo, type Order, type Product } from '../../store/shared/rules'
import { samplePdf } from '../../store/shared/sample'
import { createStore } from './store'

// Who is logged in on the desktop, and the documents that are theirs to read. It is the points site's own
// system (store/): the same members, the same sign-in by a six-digit code, and the same rule for who sees
// what (Products → Visible to in Airtable, against a member's Role and Funds). The desktop asks that
// site's server, at /api on its own address (vercel.json sends those requests on to it), so the answer here
// and the answer in the store are always the same one.
//
// Until that server is live the desktop is built as a demo (anything but VITE_ACCOUNT=live): a stand-in
// here in the browser answers instead. It sends no email and knows one sample member, an LP in Shrug 1.

const LIVE = import.meta.env.VITE_ACCOUNT === 'live'
export const ACCOUNT_DEMO = !LIVE

/** A document in the LP Updates folder. */
export interface Doc {
  id: string
  name: string
  /** It can be downloaded now. One that has a price in points is got in the store first. */
  open: boolean
  /** The groups it is kept to, for its label: empty where every member sees it. */
  keptTo: string[]
}

export type Account = { status: 'checking' | 'anon' | 'applied' | 'down' } | { status: 'member'; first: string; name: string; points: number; docs: Doc[] }

export const account = createStore<Account>({ status: 'checking' })

type Answer = { status: 'anon' } | { status: 'applied' } | { status: 'member'; member: { name: string; first: string; points: number }; products: Product[]; orders: Order[] } | { error: string }
export type Sent = { ok: true; note?: string } | { error: string; retryIn?: number }
export type Checked = { ok: true } | { error: string; left?: number }

async function call<T>(method: string, path: string, body?: unknown): Promise<T | { error: string }> {
  try {
    const res = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin', cache: 'no-store' })
    const answer = await res.json().catch(() => null)
    return answer && typeof answer === 'object' ? (answer as T) : { error: 'server' }
  } catch {
    return { error: 'offline' }
  }
}

// ---- The stand-in, for the demo

const KEPT = 'shrug:account-demo'
const DEMO_DOCS: Doc[] = [
  { id: 'update-4', name: 'Shrug 4 LP Update', open: true, keptTo: [] },
  { id: 'update-1', name: 'Shrug 1 LP Update', open: true, keptTo: ['Shrug 1 LPs'] },
]
const lag = (ms: number) => new Promise((done) => setTimeout(done, ms))
const demoIn = () => {
  try {
    return window.localStorage.getItem(KEPT) === 'in'
  } catch {
    return false
  }
}
const demoKeep = (signedIn: boolean) => {
  try {
    if (signedIn) window.localStorage.setItem(KEPT, 'in')
    else window.localStorage.removeItem(KEPT)
  } catch {
    // No storage: logged in for as long as the page is open
  }
}

// ---- Asking

const docsOf = (products: Product[], orders: Order[]): Doc[] =>
  products.filter((product) => product.kind === 'Document').map((product) => ({ id: product.id, name: product.name, open: free(product) || has(orders, product), keptTo: keptTo(product) }))

/** Asks who is logged in, and what is theirs. */
export async function refreshAccount(): Promise<Account> {
  let next: Account
  if (!LIVE) {
    next = demoIn() ? { status: 'member', first: 'Sample', name: 'Sample Member', points: 8400, docs: DEMO_DOCS } : { status: 'anon' }
  } else {
    const answer = await call<Answer>('GET', '/api/store')
    next =
      'error' in answer
        ? { status: answer.error === 'anon' ? 'anon' : answer.error === 'member' ? 'applied' : 'down' }
        : answer.status === 'member'
          ? { status: 'member', first: answer.member.first, name: answer.member.name, points: answer.member.points, docs: docsOf(answer.products, answer.orders) }
          : { status: answer.status }
  }
  account.set(next)
  return next
}

/** The first half of logging in: a code is sent to the address. */
export async function sendCode(email: string): Promise<Sent> {
  if (LIVE) return call<Sent>('POST', '/api/start', { email })
  await lag(500)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? { ok: true, note: 'Demo: no email is sent. Any six digits will do.' } : { error: 'email' }
}

/** The second half: the six digits. Right, and the desk knows who is here. */
export async function checkCode(email: string, code: string): Promise<Checked> {
  if (LIVE) {
    const answer = await call<{ status?: string; error?: string; left?: number }>('POST', '/api/verify', { email, code })
    if (answer.error) return { error: answer.error, left: 'left' in answer ? answer.left : undefined }
  } else {
    await lag(600)
    if (code === '000000') return { error: 'wrong', left: 4 }
    demoKeep(true)
  }
  await refreshAccount()
  return { ok: true }
}

export async function logOut() {
  if (LIVE) await call('POST', '/api/signout', {})
  else demoKeep(false)
  account.set({ status: 'anon' })
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** Downloads a document. The server hands it over only to someone it is for. */
export async function downloadDoc(doc: Doc): Promise<true | { error: string }> {
  if (!LIVE) {
    await lag(300)
    save(new Blob([samplePdf(doc.name)], { type: 'application/pdf' }), `${doc.name}.pdf`)
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
