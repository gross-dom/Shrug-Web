// The server, checked end to end with nothing real behind it: Airtable, Stripe and Resend are stood in for
// here, in memory, and the store's own endpoints are run against them exactly as Vercel would run them.
//   npm test
import { build } from 'esbuild'
import { createHmac } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = mkdtempSync(join(tmpdir(), 'shrug-store-'))
const NAMES = ['me', 'start', 'verify', 'signout', 'emails', 'store', 'order', 'pay', 'stripe', 'file']
await build({ entryPoints: NAMES.map((name) => resolve(here, `../api/${name}.ts`)), outdir: out, bundle: true, format: 'esm', platform: 'node', logLevel: 'error', outExtension: { '.js': '.mjs' } })
const api = Object.fromEntries(await Promise.all(NAMES.map(async (name) => [name, await import(pathToFileURL(join(out, `${name}.mjs`)).href)])))
const { T, F } = await import(pathToFileURL(join(out, 'me.mjs')).href).then(async () => {
  await build({ entryPoints: [resolve(here, '../api/_lib/airtable.ts')], outfile: join(out, 'airtable.mjs'), bundle: true, format: 'esm', platform: 'node', logLevel: 'error' })
  return import(pathToFileURL(join(out, 'airtable.mjs')).href)
})

Object.assign(process.env, { AIRTABLE_TOKEN: 'test', SESSION_SECRET: 'a-test-secret', RESEND_API_KEY: 'test', MAIL_FROM: 'Shrug <vip@example.test>', STRIPE_SECRET_KEY: 'sk_test_x', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_test' })

// ---- The stand-ins
const tables = Object.fromEntries(Object.values(T).map((id) => [id, []]))
let made = 0
const rec = (table, fields) => { const row = { id: `rec${String(++made).padStart(14, '0')}`, createdTime: new Date().toISOString(), fields: { ...fields } }; tables[table].push(row); return row }
const mail = []
const intents = new Map()
const answer = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url)
  const method = init.method ?? 'GET'
  if (url.host === 'api.airtable.com') {
    const [, , , table, id] = url.pathname.split('/')
    const rows = tables[table]
    if (!rows) return answer({ error: 'NOT_FOUND' }, 404)
    if (method === 'GET' && id) { const row = rows.find((r) => r.id === id); return row ? answer(row) : answer({}, 404) }
    if (method === 'GET') return answer({ records: rows })
    if (method === 'DELETE') { const at = rows.findIndex((r) => r.id === id); if (at >= 0) rows.splice(at, 1); return answer({ deleted: true, id }) }
    const body = JSON.parse(init.body)
    if (method === 'POST') return answer({ records: body.records.map((r) => rec(table, r.fields)) })
    if (method === 'PATCH') return answer({ records: body.records.map((r) => { const row = rows.find((x) => x.id === r.id); Object.assign(row.fields, r.fields); return row }) })
  }
  if (url.host === 'api.resend.com') { const body = JSON.parse(init.body); mail.push(body); return answer({ id: 'email_1' }) }
  if (url.host === 'api.stripe.com') {
    if (method === 'POST' && url.pathname === '/v1/payment_intents') {
      const form = new URLSearchParams(init.body)
      const metadata = {}
      for (const [k, v] of form) { const m = /^metadata\[(.+)\]$/.exec(k); if (m) metadata[m[1]] = v }
      const intent = { id: `pi_${intents.size + 1}`, client_secret: `pi_${intents.size + 1}_secret`, status: 'requires_payment_method', amount: Number(form.get('amount')), amount_received: 0, metadata, shipping: null }
      intents.set(intent.id, intent)
      return answer(intent)
    }
    const intent = intents.get(url.pathname.split('/').pop())
    return intent ? answer(intent) : answer({ error: {} }, 404)
  }
  if (url.host === 'files.example.test') return new Response('%PDF-1.4 the file', { headers: { 'content-type': 'application/pdf' } })
  throw new Error(`unexpected request to ${url.host}`)
}

// ---- What is in Airtable to begin with
const P = F.product, M = F.member
const founder = rec(T.members, { [M.name]: 'Ada Example', [M.email]: 'Ada@Example.test', [M.role]: ['Founder'], [M.tier]: 'Gold', [M.points]: 12000, [M.number]: 14, [M.since]: '2026' })
const lp = rec(T.members, { [M.name]: 'Lee Example', [M.email]: 'lee@example.test', [M.role]: ['LP'], [M.funds]: ['Shrug 1'], [M.points]: 300, [M.number]: 3, [M.since]: '2021' })
const book = rec(T.products, { [P.name]: 'Chromatic', [P.kind]: 'Book', [P.status]: 'Available', [P.visibleTo]: ['Everyone'], [P.points]: 400, [P.needsAddress]: true, [P.place]: 1 })
const chair = rec(T.products, { [P.name]: 'Workspace Chair', [P.kind]: 'Chair', [P.status]: 'Available', [P.visibleTo]: ['Everyone'], [P.points]: 10000, [P.price]: 450, [P.postage]: 70, [P.options]: 'Black, Stone, White', [P.limited]: true, [P.place]: 2 })
const red = rec(T.products, { [P.name]: 'Workspace Chair, Ferrari Red', [P.kind]: 'Chair', [P.status]: 'On request', [P.visibleTo]: ['Everyone'], [P.price]: 1500, [P.place]: 3 })
const art = rec(T.products, { [P.name]: 'Art on Acrylic', [P.kind]: 'Art', [P.status]: 'Available', [P.visibleTo]: ['Everyone'], [P.points]: 2800, [P.price]: 75, [P.postage]: 5, [P.editionOf]: 3, [P.left]: 2, [P.place]: 4 })
const next = rec(T.products, { [P.name]: 'Shrug 2027', [P.kind]: 'Book', [P.status]: 'Pre-order', [P.visibleTo]: ['Everyone'], [P.place]: 6 })
const update4 = rec(T.products, { [P.name]: 'Shrug 4 LP Update', [P.kind]: 'Document', [P.status]: 'Available', [P.visibleTo]: ['Everyone'], [P.points]: 0, [P.file]: [{ url: 'https://files.example.test/u4.pdf', filename: 'Shrug 4.pdf', type: 'application/pdf' }], [P.place]: 7 })
const update1 = rec(T.products, { [P.name]: 'Shrug 1 LP Update', [P.kind]: 'Document', [P.status]: 'Available', [P.visibleTo]: ['Shrug 1 LPs'], [P.points]: 0, [P.place]: 8 })
rec(T.products, { [P.name]: 'Not out yet', [P.kind]: 'Other', [P.status]: 'Hidden', [P.visibleTo]: ['Everyone'], [P.points]: 1 })
rec(T.products, { [P.name]: 'For nobody', [P.kind]: 'Other', [P.status]: 'Available', [P.points]: 1 })

// ---- Asking
let failed = 0
const check = (name, ok, more = '') => { if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && more ? `  ${more}` : ''}`) }
const jar = {}
async function call(who, name, method, body, query = '') {
  const headers = { 'content-type': 'application/json' }
  if (jar[who]) headers.cookie = jar[who]
  const res = await api[name][method](new Request(`https://store.test/api/${name}${query}`, { method, headers, body: body ? JSON.stringify(body) : undefined }))
  const set = res.headers.get('set-cookie')
  if (set) jar[who] = set.split(';')[0]
  const type = res.headers.get('content-type') ?? ''
  return { status: res.status, body: type.includes('json') ? await res.json() : await res.text(), headers: res.headers }
}
const codeIn = (email) => mail.filter((m) => m.to[0] === email).pop().text.match(/(\d{3}) (\d{3})/).slice(1).join('')
async function signIn(who, email) {
  await call(who, 'start', 'POST', { email })
  return call(who, 'verify', 'POST', { email, code: codeIn(email) })
}

// Signing in
check('nobody is anon', (await call('ada', 'me', 'GET')).body.status === 'anon')
check('a bad address is refused', (await call('ada', 'start', 'POST', { email: 'nope' })).body.error === 'email')
const started = await call('ada', 'start', 'POST', { email: 'ada@example.test' })
check('a code is sent', started.body.ok === true && started.body.resendIn === 45 && mail.length === 1)
check('the code is not kept as itself', !JSON.stringify(tables[T.signIns]).includes(codeIn('ada@example.test')))
check('another at once must wait', (await call('ada', 'start', 'POST', { email: 'ada@example.test' })).body.error === 'wait')
const wrong = await call('ada', 'verify', 'POST', { email: 'ada@example.test', code: codeIn('ada@example.test') === '000000' ? '000001' : '000000' })
check('a wrong code costs a guess', wrong.body.error === 'wrong' && wrong.body.left === 4)
const right = await call('ada', 'verify', 'POST', { email: 'ada@example.test', code: codeIn('ada@example.test') })
check('the right code signs a member in', right.body.status === 'member' && right.body.member.name === 'Ada Example' && right.body.member.tier === 'gold' && right.body.member.number === '014' && right.body.member.since === 2026 && right.body.seenPoints === null, JSON.stringify(right.body))
check('a code works once', (await call('x', 'verify', 'POST', { email: 'ada@example.test', code: codeIn('ada@example.test') })).body.error === 'expired')
const me = await call('ada', 'me', 'GET')
check('me is the member, and looking was seeing', me.body.status === 'member' && me.body.seenPoints === 12000)
jar.forged = jar.ada.replace(/\.[^.]+$/, '.' + createHmac('sha256', 'not-the-secret').update('x').digest('base64url'))
check('a forged session is nobody', (await call('forged', 'me', 'GET')).body.status === 'anon')
const stranger = await signIn('sam', 'sam@elsewhere.test')
check('someone not on the list is applied, once', stranger.body.status === 'applied' && tables[T.applications].length === 1)
check('and is shown no store', (await call('sam', 'store', 'GET')).body.status === 'applied' && (await call('sam', 'order', 'POST', { product: book.id })).body.error === 'member')
await signIn('lee', 'lee@example.test')

// Who sees what
const adaStore = (await call('ada', 'store', 'GET')).body
const leeStore = (await call('lee', 'store', 'GET')).body
const names = (s) => s.products.map((p) => p.name)
check('everyone sees what is for everyone, in order', names(adaStore).join('|') === 'Chromatic|Workspace Chair|Workspace Chair, Ferrari Red|Art on Acrylic|Shrug 2027|Shrug 4 LP Update', names(adaStore).join('|'))
check('only Shrug 1 LPs see the Shrug 1 update', names(leeStore).includes('Shrug 1 LP Update') && !names(adaStore).includes('Shrug 1 LP Update'))
check('hidden things, and things for nobody, are never sent', !JSON.stringify([adaStore, leeStore]).match(/Not out yet|For nobody/))
check('what is not theirs to see cannot be ordered', (await call('ada', 'order', 'POST', { product: update1.id })).status === 404)
check('nor ordered by someone signed out', (await call('nobody', 'order', 'POST', { product: book.id })).body.error === 'anon')

// Points alone
check('a posted thing needs an address', (await call('ada', 'order', 'POST', { product: book.id })).body.error === 'address')
const address = { name: 'Ada Example', line1: '1 Example Street', line2: '', city: 'San Francisco', region: 'CA', postcode: '94103', country: 'US' }
const bought = await call('ada', 'order', 'POST', { product: book.id, address })
check('points buy the book', bought.body.ok && bought.body.points === 11600 && bought.body.order.status === 'Points' && bought.body.order.points === 400 && /^SV-[A-Z2-9]{6}$/.test(bought.body.order.reference), JSON.stringify(bought.body))
check('the balance and the order are in Airtable', founder.fields[M.points] === 11600 && tables[T.orders][0].fields[F.order.shipTo].includes('1 Example Street') && tables[T.orders][0].fields[F.order.member][0] === founder.id)
check('too few points is refused', (await call('lee', 'order', 'POST', { product: book.id, address })).body.error === 'short' && lp.fields[M.points] === 300)

// A document
const got = await call('lee', 'order', 'POST', { product: update4.id })
check('a free document is got with no address', got.body.ok && got.body.points === 300)
check('and only once', (await call('lee', 'order', 'POST', { product: update4.id })).body.error === 'already')
const file = await call('lee', 'file', 'GET', null, `?product=${update4.id}`)
check('its file comes down', file.status === 200 && file.body.startsWith('%PDF') && file.headers.get('content-disposition').includes('Shrug 4.pdf'))
check('a free document needs no order first', (await call('ada', 'file', 'GET', null, `?product=${update4.id}`)).status === 200)
update4.fields[P.points] = 50
check('one with a price is not handed to someone who has not got it', (await call('ada', 'file', 'GET', null, `?product=${update4.id}`)).body.error === 'not-yours' && (await call('lee', 'file', 'GET', null, `?product=${update4.id}`)).status === 200)
update4.fields[P.points] = 0
check('nor a document they may not see', (await call('ada', 'file', 'GET', null, `?product=${update1.id}`)).status === 404)

// On request, and a pre-order
const asked = await call('ada', 'order', 'POST', { product: red.id })
check('a request takes nothing', asked.body.ok && asked.body.order.status === 'Requested' && asked.body.points === 11600)
check('one request each', (await call('ada', 'order', 'POST', { product: red.id })).body.error === 'already')
const kept = await call('ada', 'order', 'POST', { product: next.id })
check('a pre-order with no price is a reservation', kept.body.ok && kept.body.order.status === 'Pre-order' && kept.body.points === 11600)

// With a floor: points and dollars
check('a floor cannot be bought with points alone', (await call('ada', 'order', 'POST', { product: chair.id, option: 'Stone', address })).body.error === 'pay')
check('a colour has to be chosen', (await call('ada', 'pay', 'POST', { product: chair.id })).body.error === 'option')
check('too few points cannot start a payment', (await call('lee', 'pay', 'POST', { product: chair.id, option: 'Stone' })).body.error === 'short')
const pay = await call('ada', 'pay', 'POST', { product: chair.id, option: 'Stone' })
const intent = intents.get(pay.body.payment)
check('the payment is for the floor and the postage', pay.body.ok && intent.amount === 52000 && intent.metadata.member === founder.id && intent.metadata.option === 'Stone', JSON.stringify(pay.body))
check('unpaid is not an order', (await call('ada', 'order', 'POST', { payment: intent.id })).body.error === 'unpaid')
Object.assign(intent, { status: 'succeeded', amount_received: 52000, shipping: { name: 'Ada Example', address: { line1: '1 Example Street', city: 'San Francisco', state: 'CA', postal_code: '94103', country: 'US' } } })
check("someone else's payment is not theirs to claim", (await call('lee', 'order', 'POST', { payment: intent.id })).body.error === 'unknown')
const paid = await call('ada', 'order', 'POST', { payment: intent.id })
check('paid: the order, the points and the address', paid.body.ok && paid.body.order.status === 'Paid' && paid.body.order.paid === 520 && paid.body.order.option === 'Stone' && paid.body.points === 1600 && founder.fields[M.points] === 1600, JSON.stringify(paid.body))
const event = JSON.stringify({ type: 'payment_intent.succeeded', data: { object: { id: intent.id } } })
const at = Math.floor(Date.now() / 1000)
const sig = (secret) => `t=${at},v1=${createHmac('sha256', secret).update(`${at}.${event}`).digest('hex')}`
const hook = (signature) => api.stripe.POST(new Request('https://store.test/api/stripe', { method: 'POST', headers: { 'stripe-signature': signature }, body: event }))
check('a webhook not from Stripe is refused', (await hook(sig('whsec_wrong'))).status === 400)
check('Stripe saying so again makes no second order', (await hook(sig('whsec_test'))).status === 200 && tables[T.orders].filter((o) => o.fields[F.order.payment] === intent.id).length === 1 && founder.fields[M.points] === 1600)

// An edition
founder.fields[M.points] = 6000
const artPay = await call('ada', 'pay', 'POST', { product: art.id })
Object.assign(intents.get(artPay.body.payment), { status: 'succeeded', amount_received: 8000 })
const artPaid = await call('ada', 'order', 'POST', { payment: artPay.body.payment })
check('an edition is numbered and counted down', artPaid.body.order.number === '2/3' && art.fields[P.left] === 1 && artPaid.body.points === 3200, JSON.stringify(artPaid.body.order))
// Money arrives for something that no longer adds up: nothing more is taken, and it is marked
const late = await call('ada', 'pay', 'POST', { product: art.id })
art.fields[P.left] = 0
Object.assign(intents.get(late.body.payment), { status: 'succeeded', amount_received: 8000 })
const review = await call('ada', 'order', 'POST', { payment: late.body.payment })
check('money in for a sold-out thing is marked for review, with no points taken', review.body.order.status === 'Needs review' && review.body.points === 3200 && founder.fields[M.points] === 3200)
check('sold out cannot start a payment', (await call('ada', 'pay', 'POST', { product: art.id })).body.error === 'sold-out')

// Emails, and out
check('emails can be turned off', (await call('ada', 'emails', 'POST', { on: false })).body.emails === false && founder.fields[M.noEmails] === true && (await call('ada', 'me', 'GET')).body.member.emails === false)
await call('ada', 'signout', 'POST', {})
check('signed out is anon', (await call('ada', 'store', 'GET')).body.status === 'anon')
const orders = (await call('lee', 'store', 'GET')).body.orders
check('a member is shown only their own orders', orders.length === 1 && orders[0].productName === 'Shrug 4 LP Update')

rmSync(out, { recursive: true, force: true })
console.log(failed ? `\n${failed} failed` : '\nall passed')
process.exit(failed ? 1 : 0)
