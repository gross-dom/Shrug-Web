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
const NAMES = ['me', 'start', 'verify', 'signout', 'emails', 'store', 'order', 'pay', 'stripe', 'file', 'address']
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
// An LP in another fund: what is written for Shrug 1 is not theirs, and they may ask for it
const max = rec(T.members, { [M.name]: 'Max Example', [M.email]: 'max@example.test', [M.role]: ['LP'], [M.funds]: ['Shrug 3'], [M.points]: 0, [M.number]: 9, [M.since]: '2023' })
const book = rec(T.products, { [P.name]: 'Chromatic', [P.kind]: 'Book', [P.status]: 'Available', [P.visibleTo]: ['Everyone'], [P.points]: 400, [P.needsAddress]: true, [P.place]: 1 })
const chair = rec(T.products, { [P.name]: 'Workspace Chair', [P.kind]: 'Chair', [P.status]: 'Available', [P.visibleTo]: ['Everyone'], [P.points]: 10000, [P.floor]: 450, [P.postage]: 70, [P.options]: 'Black, Stone, White', [P.limited]: true, [P.place]: 2 })
const red = rec(T.products, { [P.name]: 'Workspace Chair, Ferrari Red', [P.kind]: 'Chair', [P.status]: 'On request', [P.visibleTo]: ['Everyone'], [P.points]: 15000, [P.floor]: 1500, [P.place]: 3 })
const art = rec(T.products, { [P.name]: 'Art on Acrylic', [P.kind]: 'Art', [P.status]: 'Available', [P.visibleTo]: ['Everyone'], [P.points]: 2800, [P.floor]: 75, [P.postage]: 5, [P.editionOf]: 3, [P.left]: 2, [P.place]: 4 })
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
// A visitor: nobody signed in
const visitor = (await call('nobody', 'store', 'GET')).body
check('a visitor is shown the store: what is for everyone, in order, and nothing of anybody\'s', visitor.status === 'visitor' && visitor.products.map((p) => p.name).join('|') === 'Chromatic|Workspace Chair|Workspace Chair, Ferrari Red|Art on Acrylic|Shrug 2027' && !('member' in visitor) && !('updates' in visitor) && !('orders' in visitor), JSON.stringify(visitor).slice(0, 300))
check('and no document, hidden thing or thing for nobody', !JSON.stringify(visitor).match(/Update|Not out yet|For nobody/))
check('a visitor can order nothing, pay for nothing and fetch no file', (await call('nobody', 'order', 'POST', { product: book.id })).body.error === 'anon' && (await call('nobody', 'pay', 'POST', { product: book.id, points: 0 })).body.error === 'anon' && (await call('nobody', 'file', 'GET', null, `?product=${update4.id}`)).body.error === 'anon')

// Someone not on the list: a standard user
const members = tables[T.members].length
const stranger = await signIn('sam', 'sam@elsewhere.test')
const samRow = tables[T.members].at(-1)
check('someone not on the list is given an account: no Role, the standard tier, 100 points', stranger.body.status === 'member' && stranger.body.member.tier === 'standard' && stranger.body.member.points === 100 && stranger.body.member.roles.length === 0 && tables[T.members].length === members + 1 && samRow.fields[M.email] === 'sam@elsewhere.test' && samRow.fields[M.points] === 100 && !samRow.fields[M.role] && tables[T.applications].length === 0, JSON.stringify(stranger.body))
await call('sam', 'signout', 'POST', {})
await new Promise((done) => setTimeout(done, 5))
tables[T.signIns].length = 0
check('and signing in again makes no second account, and gives no more points', (await signIn('sam', 'sam@elsewhere.test')).body.member.points === 100 && tables[T.members].length === members + 1)
const samStore = (await call('sam', 'store', 'GET')).body
check('they are shown what a visitor is, and no update: not its name, and not that it can be asked for', samStore.status === 'member' && samStore.products.map((p) => p.name).join('|') === visitor.products.map((p) => p.name).join('|') && samStore.updates.length === 0 && !JSON.stringify(samStore).match(/Update/))
check('nor handed one, for everyone or not, nor able to ask', (await call('sam', 'file', 'GET', null, `?product=${update4.id}`)).status === 404 && (await call('sam', 'file', 'GET', null, `?product=${update1.id}`)).status === 404 && (await call('sam', 'order', 'POST', { product: update4.id })).status === 404)
const samPay = await call('sam', 'pay', 'POST', { product: book.id, points: 100 })
check('their points are points: $40 less 100 of them is $30', samPay.body.ok && samPay.body.cents === 3000, JSON.stringify(samPay.body))
await signIn('lee', 'lee@example.test')
await signIn('max', 'max@example.test')

// Who sees what
const adaStore = (await call('ada', 'store', 'GET')).body
const leeStore = (await call('lee', 'store', 'GET')).body
const names = (s) => s.products.map((p) => p.name)
const updates = (s) => s.updates.map((u) => `${u.name}:${u.state}`)
check('everyone sees what is for everyone, in order', names(adaStore).join('|') === 'Chromatic|Workspace Chair|Workspace Chair, Ferrari Red|Art on Acrylic|Shrug 2027', names(adaStore).join('|'))
const maxStore = (await call('max', 'store', 'GET')).body
check('documents are not in the store: they are updates', updates(maxStore).join('|') === 'Shrug 4 LP Update:open' && !names(leeStore).some((n) => /Update/.test(n)), updates(maxStore).join('|'))
check('updates are for LPs alone: a founder on the list is shown none, even one for everyone', adaStore.updates.length === 0 && !JSON.stringify(adaStore).match(/Update/), updates(adaStore).join('|'))
check('only Shrug 1 LPs see the Shrug 1 update, which has no file yet', updates(leeStore).join('|') === 'Shrug 4 LP Update:open|Shrug 1 LP Update:soon' && !JSON.stringify(maxStore).includes('Shrug 1 LP Update'), updates(leeStore).join('|'))
check('an update says who it was written for and which heading it is under', leeStore.updates[0].forWhom === 'Everyone on the list' && leeStore.updates[1].forWhom === 'Shrug 1 LPs' && leeStore.updates.every((u) => u.group === 'Funds'))
check('the store is told what My VIP shows: the card, the address, the email', adaStore.member.number === '014' && adaStore.member.since === 2026 && adaStore.member.email === 'Ada@Example.test' && adaStore.member.shipTo === '' && adaStore.member.emails === true, JSON.stringify(adaStore.member))
check('hidden things, and things for nobody, are never sent', !JSON.stringify([adaStore, leeStore]).match(/Not out yet|For nobody/))
check('what is not theirs to see cannot be ordered', (await call('ada', 'order', 'POST', { product: update1.id })).status === 404)
check('nor ordered by someone signed out', (await call('nobody', 'order', 'POST', { product: book.id })).body.error === 'anon')

// Paid for in full with points
check('a posted thing needs an address', (await call('ada', 'order', 'POST', { product: book.id, points: 400 })).body.error === 'address')
const address = { name: 'Ada Example', line1: '1 Example Street', line2: '', city: 'San Francisco', region: 'CA', postcode: '94103', country: 'US' }
check('with fewer points than its price, there is something to pay: not an order', (await call('ada', 'order', 'POST', { product: book.id, points: 100, address })).body.error === 'pay')
check('more points than its price cannot be used', (await call('ada', 'order', 'POST', { product: book.id, points: 500, address })).body.error === 'points')
check('nor part of a point, nor fewer than none', (await call('ada', 'order', 'POST', { product: book.id, points: 399.5, address })).body.error === 'points' && (await call('ada', 'order', 'POST', { product: book.id, points: -10, address })).body.error === 'points')
const bought = await call('ada', 'order', 'POST', { product: book.id, points: 400, address })
check('points cover the book', bought.body.ok && bought.body.points === 11600 && bought.body.order.status === 'Points' && bought.body.order.points === 400 && /^SV-[A-Z2-9]{6}$/.test(bought.body.order.reference), JSON.stringify(bought.body))
check('the balance and the order are in Airtable', founder.fields[M.points] === 11600 && tables[T.orders][0].fields[F.order.shipTo].includes('1 Example Street') && tables[T.orders][0].fields[F.order.member][0] === founder.id)
check('more points than the member has cannot be used', (await call('lee', 'order', 'POST', { product: book.id, points: 400, address })).body.error === 'points' && lp.fields[M.points] === 300)

// Points and dollars: someone without enough points pays the rest
const part = await call('lee', 'pay', 'POST', { product: book.id, points: 300 })
check('the rest is a payment: $40 less 300 points is $10', part.body.ok && part.body.cents === 1000 && intents.get(part.body.payment).amount === 1000 && intents.get(part.body.payment).metadata.points === '300', JSON.stringify(part.body))
const none = await call('lee', 'pay', 'POST', { product: book.id, points: 0 })
check('with no points at all, the whole price', none.body.cents === 4000)
Object.assign(intents.get(part.body.payment), { status: 'succeeded', amount_received: 1000, shipping: { name: 'Lee Example', address: { line1: '2 Example Street', city: 'Oakland', state: 'CA', postal_code: '94607', country: 'US' } } })
const partPaid = await call('lee', 'order', 'POST', { payment: part.body.payment })
check('paid: the points used come off, and the dollars are on the order', partPaid.body.ok && partPaid.body.order.status === 'Paid' && partPaid.body.order.points === 300 && partPaid.body.order.paid === 10 && partPaid.body.points === 0 && lp.fields[M.points] === 0, JSON.stringify(partPaid.body))
lp.fields[M.points] = 300

// A document
const got = await call('lee', 'order', 'POST', { product: update4.id })
check('a free document is got with no address', got.body.ok && got.body.points === 300)
check('and only once', (await call('lee', 'order', 'POST', { product: update4.id })).body.error === 'already')
const file = await call('lee', 'file', 'GET', null, `?product=${update4.id}`)
check('its file comes down', file.status === 200 && file.body.startsWith('%PDF') && file.headers.get('content-disposition').includes('Shrug 4.pdf'))
check('a free document needs no order first', (await call('max', 'file', 'GET', null, `?product=${update4.id}`)).status === 200)
check('but it is never handed to someone who is not an LP', (await call('ada', 'file', 'GET', null, `?product=${update4.id}`)).status === 404 && (await call('ada', 'order', 'POST', { product: update4.id })).status === 404)
update4.fields[P.points] = 50
check('one with a price is not handed to someone who has not got it', (await call('max', 'file', 'GET', null, `?product=${update4.id}`)).body.error === 'not-yours' && (await call('lee', 'file', 'GET', null, `?product=${update4.id}`)).status === 200)
update4.fields[P.points] = 0
check('nor a document they may not see', (await call('max', 'file', 'GET', null, `?product=${update1.id}`)).status === 404)

// On request, and a pre-order
const asked = await call('ada', 'order', 'POST', { product: red.id })
check('a request takes nothing', asked.body.ok && asked.body.order.status === 'Requested' && asked.body.points === 11600)
check('one request each', (await call('ada', 'order', 'POST', { product: red.id })).body.error === 'already')
check('something on request cannot be paid for', (await call('ada', 'pay', 'POST', { product: red.id, points: 0 })).body.error === 'pay')
const kept = await call('ada', 'order', 'POST', { product: next.id })
check('a pre-order with no price is a reservation', kept.body.ok && kept.body.order.status === 'Pre-order' && kept.body.points === 11600)

// A floor: points bring the price down, but not under it
check('a colour has to be chosen', (await call('ada', 'pay', 'POST', { product: chair.id, points: 5500 })).body.error === 'option')
check('points cannot take it under its floor', (await call('ada', 'pay', 'POST', { product: chair.id, option: 'Stone', points: 5510 })).body.error === 'points' && (await call('ada', 'order', 'POST', { product: chair.id, option: 'Stone', points: 10000, address })).body.error === 'points')
const full = await call('lee', 'pay', 'POST', { product: chair.id, option: 'Black', points: 0 })
check('with no points, the chair is its whole price and the postage', full.body.cents === 107000)
const some = await call('lee', 'pay', 'POST', { product: chair.id, option: 'Black', points: 300 })
check('with a few points, that much less', some.body.cents === 104000)
const pay = await call('ada', 'pay', 'POST', { product: chair.id, option: 'Stone', points: 5500 })
const intent = intents.get(pay.body.payment)
check('with all the points it will take, the floor and the postage', pay.body.ok && pay.body.cents === 52000 && intent.amount === 52000 && intent.metadata.member === founder.id && intent.metadata.option === 'Stone' && intent.metadata.points === '5500', JSON.stringify(pay.body))
check('unpaid is not an order', (await call('ada', 'order', 'POST', { payment: intent.id })).body.error === 'unpaid')
Object.assign(intent, { status: 'succeeded', amount_received: 52000, shipping: { name: 'Ada Example', address: { line1: '1 Example Street', city: 'San Francisco', state: 'CA', postal_code: '94103', country: 'US' } } })
check("someone else's payment is not theirs to claim", (await call('lee', 'order', 'POST', { payment: intent.id })).body.error === 'unknown')
const paid = await call('ada', 'order', 'POST', { payment: intent.id })
check('paid: the order, the points used and the address', paid.body.ok && paid.body.order.status === 'Paid' && paid.body.order.paid === 520 && paid.body.order.points === 5500 && paid.body.order.option === 'Stone' && paid.body.points === 6100 && founder.fields[M.points] === 6100 && tables[T.orders].at(-1).fields[F.order.shipTo].includes('San Francisco'), JSON.stringify(paid.body))
const event = JSON.stringify({ type: 'payment_intent.succeeded', data: { object: { id: intent.id } } })
const at = Math.floor(Date.now() / 1000)
const sig = (secret) => `t=${at},v1=${createHmac('sha256', secret).update(`${at}.${event}`).digest('hex')}`
const hook = (signature) => api.stripe.POST(new Request('https://store.test/api/stripe', { method: 'POST', headers: { 'stripe-signature': signature }, body: event }))
check('a webhook not from Stripe is refused', (await hook(sig('whsec_wrong'))).status === 400)
check('Stripe saying so again makes no second order', (await hook(sig('whsec_test'))).status === 200 && tables[T.orders].filter((o) => o.fields[F.order.payment] === intent.id).length === 1 && founder.fields[M.points] === 6100)

// An edition
const artPay = await call('ada', 'pay', 'POST', { product: art.id, points: 2050 })
check('the acrylic: $280 less 2,050 points is its $75 floor, and $5 postage', artPay.body.cents === 8000)
Object.assign(intents.get(artPay.body.payment), { status: 'succeeded', amount_received: 8000 })
const artPaid = await call('ada', 'order', 'POST', { payment: artPay.body.payment })
check('an edition is numbered and counted down', artPaid.body.order.number === '2/3' && art.fields[P.left] === 1 && artPaid.body.points === 4050, JSON.stringify(artPaid.body.order))
// Money arrives for something that no longer adds up: nothing more is taken, and it is marked
const late = await call('ada', 'pay', 'POST', { product: art.id, points: 2050 })
art.fields[P.left] = 0
Object.assign(intents.get(late.body.payment), { status: 'succeeded', amount_received: 8000 })
const review = await call('ada', 'order', 'POST', { payment: late.body.payment })
check('money in for a sold-out thing is marked for review, with no points taken', review.body.order.status === 'Needs review' && review.body.points === 4050 && founder.fields[M.points] === 4050)
check('sold out cannot start a payment', (await call('ada', 'pay', 'POST', { product: art.id, points: 0 })).body.error === 'sold-out')
// The points are spent elsewhere between starting to pay and paying
art.fields[P.left] = 2
const raced = await call('ada', 'pay', 'POST', { product: art.id, points: 2050 })
founder.fields[M.points] = 100
Object.assign(intents.get(raced.body.payment), { status: 'succeeded', amount_received: 8000 })
const short = await call('ada', 'order', 'POST', { payment: raced.body.payment })
check('money in with the points since spent is marked for review too', short.body.order.status === 'Needs review' && founder.fields[M.points] === 100 && art.fields[P.left] === 2)

// Updates: listed to everyone, written for some
update1.fields[P.file] = [{ url: 'https://files.example.test/u1.pdf', filename: 'Shrug 1.pdf', type: 'application/pdf' }]
update1.fields[P.listed] = true
update1.fields[P.group] = 'SPVs'
const spv = rec(T.products, { [P.name]: 'SPV updates', [P.kind]: 'Document', [P.status]: 'Available', [P.visibleTo]: ['Shrug 2 LPs'], [P.listed]: true, [P.group]: 'SPVs', [P.place]: 9 })
const seen = async (who) => (await call(who, 'store', 'GET')).body.updates.map((u) => `${u.name}:${u.state}:${u.group}`).join('|')
check('listed to every LP: those it is for open it, the rest may ask; no file is coming soon', (await seen('lee')) === 'Shrug 4 LP Update:open:Funds|Shrug 1 LP Update:open:SPVs|SPV updates:soon:SPVs' && (await seen('max')) === 'Shrug 4 LP Update:open:Funds|Shrug 1 LP Update:request:SPVs|SPV updates:soon:SPVs', await seen('max'))
check('listed is listed to LPs: a founder and a standard user are still shown none, and cannot ask', (await seen('ada')) === '' && (await seen('sam')) === '' && (await call('ada', 'order', 'POST', { product: update1.id })).status === 404 && (await call('sam', 'order', 'POST', { product: update1.id })).status === 404)
check('asking does not hand the file over', (await call('max', 'file', 'GET', null, `?product=${update1.id}`)).status === 404)
const wanted = await call('max', 'order', 'POST', { product: update1.id })
check('a request for an update is an order, Requested, with nothing taken', wanted.body.ok && wanted.body.order.status === 'Requested' && wanted.body.order.productName === 'Shrug 1 LP Update' && wanted.body.points === max.fields[M.points], JSON.stringify(wanted.body))
check('it then says Requested, and cannot be asked for twice', (await seen('max')).includes('Shrug 1 LP Update:requested') && (await call('max', 'order', 'POST', { product: update1.id })).body.error === 'already')
max.fields[M.funds] = ['Shrug 3', 'Shrug 1']
check('once Shrug adds them to the group it opens', (await seen('max')).includes('Shrug 1 LP Update:open') && (await call('max', 'file', 'GET', null, `?product=${update1.id}`)).status === 200)
max.fields[M.funds] = ['Shrug 3']
check('something not listed, and not theirs, cannot be asked for', (() => { update1.fields[P.listed] = false; return true })() && (await call('sam2', 'order', 'POST', { product: update1.id })).body.error === 'anon' && !(await seen('max')).includes('Shrug 1'))
check('an update with no file yet cannot be asked for', (await call('max', 'order', 'POST', { product: spv.id })).body.error === 'hidden')

// Reading one in the page, and the note that is kept
const before = tables[T.opens].length
const inPage = await call('lee', 'file', 'GET', null, `?product=${update4.id}&view=1`)
check('with view=1 a document is sent to be read in the page', inPage.status === 200 && inPage.headers.get('content-disposition').startsWith('inline'))
const saved = await call('lee', 'file', 'GET', null, `?product=${update4.id}`)
check('without, to be saved', saved.headers.get('content-disposition').startsWith('attachment'))
const notes = tables[T.opens].slice(before)
check('each is noted in Opens: who, what, how and when', notes.length === 2 && notes[0].fields[F.open.how] === 'Opened' && notes[1].fields[F.open.how] === 'Downloaded' && notes[0].fields[F.open.member][0] === lp.id && notes[0].fields[F.open.product][0] === update4.id && !!notes[0].fields[F.open.when], JSON.stringify(notes.map((n) => n.fields)))
check('a refusal is not noted', (await call('ada', 'file', 'GET', null, `?product=${update1.id}`)).status === 404 && tables[T.opens].length === before + 2)

// An address on file
founder.fields[M.points] = 5000
art.fields[P.left] = 2
const was = founder.fields[M.shipTo]
check('too little to be an address is refused, and changes nothing', (await call('ada', 'address', 'POST', { shipTo: 'Ada' })).body.error === 'address' && founder.fields[M.shipTo] === was)
const home = 'Ada Example\n9 Example Road\nPortland, OR 97201'
const kept1 = await call('ada', 'address', 'POST', { shipTo: `  ${home}  \n\n` })
check('an address is kept on the member, tidied', kept1.body.ok && kept1.body.shipTo === home && founder.fields[M.shipTo] === home && (await call('ada', 'store', 'GET')).body.member.shipTo === home)
check('nobody signed out can set one', (await call('nobody', 'address', 'POST', { shipTo: home })).body.error === 'anon')
const second = rec(T.products, { [P.name]: 'Second Book', [P.kind]: 'Book', [P.status]: 'Available', [P.visibleTo]: ['Everyone'], [P.points]: 100, [P.needsAddress]: true, [P.place]: 10 })
const toHome = await call('ada', 'order', 'POST', { product: second.id, points: 100 })
check('with one on file, a posted thing needs no address given', toHome.body.ok && tables[T.orders].at(-1).fields[F.order.shipTo] === home, JSON.stringify(toHome.body))
lp.fields[M.points] = 1000
const typed = 'Lee Example\n4 Example Lane\nAustin, TX 78701'
const firstTime = await call('lee', 'order', 'POST', { product: second.id, points: 100, shipTo: typed })
check('one typed with an order is where it goes, and is kept for next time', firstTime.body.ok && tables[T.orders].at(-1).fields[F.order.shipTo] === typed && lp.fields[M.shipTo] === typed)
const artHome = await call('ada', 'pay', 'POST', { product: art.id, points: 2050 })
Object.assign(intents.get(artHome.body.payment), { status: 'succeeded', amount_received: 8000, shipping: { name: 'Someone Else', address: { line1: '1 Other Street', city: 'Elsewhere', state: 'NY', postal_code: '10001', country: 'US' } } })
await call('ada', 'order', 'POST', { payment: artHome.body.payment })
check('a paid order goes to the address on file, not the payment\'s', tables[T.orders].at(-1).fields[F.order.shipTo] === home && founder.fields[M.shipTo] === home)
const newcomer = rec(T.members, { [M.name]: 'New Example', [M.email]: 'new@example.test', [M.role]: ['Investor'], [M.points]: 0 })
await signIn('new', 'new@example.test')
const newPay = await call('new', 'pay', 'POST', { product: second.id, points: 0 })
Object.assign(intents.get(newPay.body.payment), { status: 'succeeded', amount_received: 1000, shipping: { name: 'New Example', address: { line1: '7 Example Way', city: 'Denver', state: 'CO', postal_code: '80202', country: 'US' } } })
await call('new', 'order', 'POST', { payment: newPay.body.payment })
check('with none on file, the address a payment gives is used and kept', tables[T.orders].at(-1).fields[F.order.shipTo].includes('7 Example Way') && newcomer.fields[M.shipTo].includes('7 Example Way'))

// An update with a price in points: locked until it is unlocked, by the LPs it was written for
const locked = rec(T.products, { [P.name]: 'Shrug 5 LP Update', [P.kind]: 'Document', [P.status]: 'Available', [P.visibleTo]: ['Shrug 1 LPs'], [P.listed]: true, [P.points]: 10, [P.file]: [{ url: 'https://files.example.test/u5.pdf', filename: 'Shrug 5.pdf', type: 'application/pdf' }], [P.place]: 12 })
const stateOf = async (who) => (await call(who, 'store', 'GET')).body.updates.find((u) => u.name === 'Shrug 5 LP Update')
check('an update with a price is locked for those it is for, and says what it costs', (await stateOf('lee')).state === 'locked' && (await stateOf('lee')).points === 10, JSON.stringify(await stateOf('lee')))
check('for an LP it was not written for it is still one to ask for, never one to buy', (await stateOf('max')).state === 'request' && (await call('max', 'order', 'POST', { product: locked.id, points: 10 })).body.order?.status === 'Requested' && (await call('max', 'file', 'GET', null, `?product=${locked.id}`)).status === 404)
check('and someone who is not an LP is not shown it, and cannot unlock it', (await stateOf('ada')) === undefined && (await call('ada', 'order', 'POST', { product: locked.id, points: 10 })).status === 404)
check('locked, its file is not handed over', (await call('lee', 'file', 'GET', null, `?product=${locked.id}`)).body.error === 'not-yours')
check('it is not unlocked for nothing', (await call('lee', 'order', 'POST', { product: locked.id })).body.error === 'pay')
const had = lp.fields[M.points]
const unlocked = await call('lee', 'order', 'POST', { product: locked.id, points: 10 })
check('unlocking takes its points, and is an order', unlocked.body.ok && unlocked.body.order.status === 'Points' && unlocked.body.order.points === 10 && unlocked.body.points === had - 10 && lp.fields[M.points] === had - 10, JSON.stringify(unlocked.body))
check('it is then open, and its file is theirs', (await stateOf('lee')).state === 'open' && (await call('lee', 'file', 'GET', null, `?product=${locked.id}`)).status === 200)
check('and is not unlocked twice', (await call('lee', 'order', 'POST', { product: locked.id, points: 10 })).body.error === 'already' && lp.fields[M.points] === had - 10)
locked.fields[P.status] = 'Hidden'

// Emails, and out
check('emails can be turned off', (await call('ada', 'emails', 'POST', { on: false })).body.emails === false && founder.fields[M.noEmails] === true && (await call('ada', 'me', 'GET')).body.member.emails === false)
await call('ada', 'signout', 'POST', {})
check('signed out is a visitor to the store, and nobody to the card', (await call('ada', 'store', 'GET')).body.status === 'visitor' && (await call('ada', 'me', 'GET')).body.status === 'anon')
tables[T.members].splice(tables[T.members].indexOf(samRow), 1)
check('taken out of Members, someone signed in is a visitor again, and nobody to the card', (await call('sam', 'store', 'GET')).body.status === 'visitor' && (await call('sam', 'me', 'GET')).body.status === 'anon' && (await call('sam', 'order', 'POST', { product: book.id })).body.error === 'anon')
const orders = (await call('lee', 'store', 'GET')).body.orders
check('a member is shown only their own orders', orders.map((o) => o.productName).sort().join('|') === 'Chromatic|Second Book|Shrug 4 LP Update|Shrug 5 LP Update', orders.map((o) => o.productName).sort().join('|'))

rmSync(out, { recursive: true, force: true })
console.log(failed ? `\n${failed} failed` : '\nall passed')
process.exit(failed ? 1 : 0)
