// The server, checked end to end with nothing real behind it: Airtable, Stripe, Resend and Twilio are stood in for
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
const NAMES = ['me', 'start', 'text', 'verify', 'phone', 'profile', 'link', 'signout', 'emails', 'store', 'order', 'pay', 'stripe', 'file', 'address']
await build({ entryPoints: NAMES.map((name) => resolve(here, `../api/${name}.ts`)), outdir: out, bundle: true, format: 'esm', platform: 'node', logLevel: 'error', outExtension: { '.js': '.mjs' } })
const api = Object.fromEntries(await Promise.all(NAMES.map(async (name) => [name, await import(pathToFileURL(join(out, `${name}.mjs`)).href)])))
const { T, F } = await import(pathToFileURL(join(out, 'me.mjs')).href).then(async () => {
  await build({ entryPoints: [resolve(here, '../api/_lib/airtable.ts')], outfile: join(out, 'airtable.mjs'), bundle: true, format: 'esm', platform: 'node', logLevel: 'error' })
  return import(pathToFileURL(join(out, 'airtable.mjs')).href)
})

Object.assign(process.env, { AIRTABLE_TOKEN: 'test', SESSION_SECRET: 'a-test-secret', RESEND_API_KEY: 'test', MAIL_FROM: 'Shrug <vip@example.test>', STRIPE_SECRET_KEY: 'sk_test_x', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_test', TWILIO_ACCOUNT_SID: 'AC_test', TWILIO_AUTH_TOKEN: 'test', TWILIO_VERIFY_SID: 'VA_test' })

// ---- The stand-ins
const tables = Object.fromEntries(Object.values(T).map((id) => [id, []]))
let made = 0
const rec = (table, fields) => { const row = { id: `rec${String(++made).padStart(14, '0')}`, createdTime: new Date().toISOString(), fields: { ...fields } }; tables[table].push(row); return row }
const mail = []
const intents = new Map()
// Twilio's Verify: every text it was asked to send, and the code waiting for each number (five guesses, as there)
const texts = []
const waiting = new Map()
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
  if (url.host === 'content.airtable.com') {
    // A file put in an attachment column: /v0/<base>/<row>/<column>/uploadAttachment
    const [, , , id, field] = url.pathname.split('/')
    const row = Object.values(tables).flat().find((r) => r.id === id)
    if (!row) return answer({ error: 'NOT_FOUND' }, 404)
    const body = JSON.parse(init.body)
    row.fields[field] = [...(row.fields[field] ?? []), { id: `att${(row.fields[field] ?? []).length + 1}`, url: `https://files.example.test/${body.filename}`, filename: body.filename, type: body.contentType, size: body.file.length }]
    return answer({ id, fields: row.fields })
  }
  if (url.host === 'verify.twilio.com') {
    const form = new URLSearchParams(init.body)
    const to = form.get('To')
    if (url.pathname.endsWith('/Verifications')) {
      if (!/^\+\d{8,15}$/.test(to) || to.endsWith('0000000')) return answer({ code: 60200, status: 400 }, 400)
      const code = String(100000 + ((texts.length * 7919 + 4242) % 900000))
      waiting.set(to, { code, left: 5 })
      texts.push({ to, code })
      return answer({ status: 'pending', to }, 201)
    }
    const kept = waiting.get(to)
    if (!kept) return answer({ code: 20404, status: 404 }, 404)
    if (kept.left <= 0) return answer({ code: 60202, status: 429 }, 429)
    if (form.get('Code') === kept.code) { waiting.delete(to); return answer({ status: 'approved', valid: true }) }
    kept.left--
    return answer({ status: 'pending', valid: false })
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
const next = rec(T.products, { [P.name]: 'Shrug 2027', [P.kind]: 'Book', [P.status]: 'Pre-order', [P.visibleTo]: ['Everyone'], [P.place]: 6, [P.shipsOn]: '2027-02-15' })
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
  // Every cookie the answer sets is kept, by its name; one set to nothing is thrown away, as a browser would
  for (const set of res.headers.getSetCookie()) {
    const [name, value] = set.split(';')[0].split('=')
    const kept = Object.fromEntries((jar[who] ?? '').split('; ').filter(Boolean).map((pair) => pair.split('=')))
    if (value) kept[name] = value
    else delete kept[name]
    jar[who] = Object.entries(kept).map(([n, v]) => `${n}=${v}`).join('; ')
  }
  const type = res.headers.get('content-type') ?? ''
  return { status: res.status, body: type.includes('json') ? await res.json() : await res.text(), headers: res.headers }
}
const codeIn = (email) => mail.filter((m) => m.to[0] === email).pop().text.match(/(\d{3}) (\d{3})/).slice(1).join('')
/** The six digits last texted to a number. */
const textIn = (phone) => texts.filter((t) => t.to === phone).pop().code
const rowFor = (email) => tables[T.members].find((r) => r.fields[M.email].toLowerCase() === email.toLowerCase())
/** Signs someone in the way the server says to: someone new by the number given, anyone else by the text or the email their row calls for. */
async function signIn(who, email, phone) {
  const started = await call(who, 'start', 'POST', { email })
  if (started.body.step === 'phone') {
    await call(who, 'text', 'POST', { email, phone })
    return call(who, 'verify', 'POST', { email, phone, code: textIn(phone) })
  }
  if (started.body.step === 'text') return call(who, 'verify', 'POST', { email, code: textIn(rowFor(email).fields[M.phone]) })
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
check('a pre-order says the day it is sent, where the catalogue names one (Products → Ships on), and nothing else has one', visitor.products.find((p) => p.name === 'Shrug 2027')?.shipsOn === '2027-02-15' && visitor.products.filter((p) => p.name !== 'Shrug 2027').every((p) => p.shipsOn === null), JSON.stringify(visitor.products.map((p) => [p.name, p.shipsOn])))
check('and no document, hidden thing or thing for nobody', !JSON.stringify(visitor).match(/Update|Not out yet|For nobody/))
check('a visitor can order nothing and fetch no file; and to pay, they have to say where the receipt goes', (await call('nobody', 'order', 'POST', { product: book.id })).body.error === 'anon' && (await call('nobody', 'pay', 'POST', { product: book.id, points: 0 })).body.error === 'email' && (await call('nobody', 'file', 'GET', null, `?product=${update4.id}`)).body.error === 'anon')

// Someone not on the list: a standard user
const members = tables[T.members].length
const stranger = await signIn('sam', 'sam@elsewhere.test', '+14155550101')
const samRow = tables[T.members].at(-1)
check('someone not on the list is given an account: no Role, the standard tier, 200 points', stranger.body.status === 'member' && stranger.body.member.tier === 'standard' && stranger.body.member.points === 200 && stranger.body.member.roles.length === 0 && tables[T.members].length === members + 1 && samRow.fields[M.email] === 'sam@elsewhere.test' && samRow.fields[M.points] === 200 && !samRow.fields[M.role] && tables[T.applications].length === 0, JSON.stringify(stranger.body))
await call('sam', 'signout', 'POST', {})
await new Promise((done) => setTimeout(done, 5))
tables[T.signIns].length = 0
check('and signing in again makes no second account, and gives no more points', (await signIn('sam', 'sam@elsewhere.test')).body.member.points === 200 && tables[T.members].length === members + 1)
check('it is their number they sign in with from then on: the code is texted, and nothing is emailed', texts.filter((t) => t.to === '+14155550101').length === 2 && !mail.some((m) => m.to[0] === 'sam@elsewhere.test'))
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
check('paid: the order, the points used, the 200 a chair awards, and the address', paid.body.ok && paid.body.order.status === 'Paid' && paid.body.order.paid === 520 && paid.body.order.points === 5500 && paid.body.order.option === 'Stone' && paid.body.points === 6300 && paid.body.awarded === 200 && founder.fields[M.points] === 6300 && tables[T.orders].at(-1).fields[F.order.shipTo].includes('San Francisco'), JSON.stringify(paid.body))
const event = JSON.stringify({ type: 'payment_intent.succeeded', data: { object: { id: intent.id } } })
const at = Math.floor(Date.now() / 1000)
const sig = (secret) => `t=${at},v1=${createHmac('sha256', secret).update(`${at}.${event}`).digest('hex')}`
const hook = (signature) => api.stripe.POST(new Request('https://store.test/api/stripe', { method: 'POST', headers: { 'stripe-signature': signature }, body: event }))
check('a webhook not from Stripe is refused', (await hook(sig('whsec_wrong'))).status === 400)
check('Stripe saying so again makes no second order', (await hook(sig('whsec_test'))).status === 200 && tables[T.orders].filter((o) => o.fields[F.order.payment] === intent.id).length === 1 && founder.fields[M.points] === 6300)

// An edition
const artPay = await call('ada', 'pay', 'POST', { product: art.id, points: 2050 })
check('the acrylic: $280 less 2,050 points is its $75 floor, and $5 postage', artPay.body.cents === 8000)
Object.assign(intents.get(artPay.body.payment), { status: 'succeeded', amount_received: 8000 })
const artPaid = await call('ada', 'order', 'POST', { payment: artPay.body.payment })
check('an edition is numbered and counted down', artPaid.body.order.number === '2/3' && art.fields[P.left] === 1 && artPaid.body.points === 4250 && artPaid.body.awarded === 0, JSON.stringify(artPaid.body.order))
// Money arrives for something that no longer adds up: nothing more is taken, and it is marked
const late = await call('ada', 'pay', 'POST', { product: art.id, points: 2050 })
art.fields[P.left] = 0
Object.assign(intents.get(late.body.payment), { status: 'succeeded', amount_received: 8000 })
const review = await call('ada', 'order', 'POST', { payment: late.body.payment })
const adaSpent = tables[T.orders].filter((o) => (o.fields[F.order.member] ?? []).includes(founder.id) && o.fields[F.order.status] !== 'Refunded').reduce((sum, o) => sum + (o.fields[F.order.points] ?? 0), 0)
const adaCard = (await call('ada', 'me', 'GET')).body
check('the card is told what they have spent, beside their balance: together, every point they have been awarded', adaSpent >= 7550 && adaCard.spent === adaSpent && adaCard.member.points === 4250, JSON.stringify({ adaSpent, spent: adaCard.spent, points: adaCard.member?.points }))
check('money in for a sold-out thing is marked for review, with no points taken', review.body.order.status === 'Needs review' && review.body.points === 4250 && founder.fields[M.points] === 4250)
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

// ---- More than one of a book (Niv, 27 Nov): the price so many times over, posted once, and said on the order
const posted = rec(T.products, { [P.name]: 'Posted Book', [P.kind]: 'Book', [P.status]: 'Available', [P.visibleTo]: ['Everyone'], [P.points]: 400, [P.postage]: 5, [P.needsAddress]: true, [P.place]: 11 })
const three = await call('new', 'pay', 'POST', { product: posted.id, count: 3, points: 0 })
check('three of a book are three times its price, posted once: 3 × $40 and $5', three.body.ok && three.body.cents === 12500 && intents.get(three.body.payment).amount === 12500 && intents.get(three.body.payment).metadata.count === '3', JSON.stringify(three.body))
Object.assign(intents.get(three.body.payment), { status: 'succeeded', amount_received: 12500 })
const threePaid = await call('new', 'order', 'POST', { payment: three.body.payment })
check('paid, the order says how many, for whoever packs it', threePaid.body.ok && threePaid.body.order.status === 'Paid' && threePaid.body.order.option === 'Quantity: 3' && tables[T.orders].at(-1).fields[F.order.option] === 'Quantity: 3' && tables[T.orders].at(-1).fields[F.order.paid] === 125, JSON.stringify(threePaid.body))
lp.fields[M.points] = 1000
const lot = await call('lee', 'pay', 'POST', { product: posted.id, count: 2, points: 800 })
check('points go towards the lot: two at $40 less 800 points leaves the $5 postage', lot.body.ok && lot.body.cents === 500 && intents.get(lot.body.payment).metadata.points === '800', JSON.stringify(lot.body))
check('more points than the lot costs cannot be used, and for one book no more than one book costs', (await call('lee', 'pay', 'POST', { product: posted.id, count: 2, points: 900 })).body.error === 'points' && (await call('lee', 'pay', 'POST', { product: posted.id, points: 800 })).body.error === 'points')
const tooMany = await call('new', 'pay', 'POST', { product: posted.id, count: 99, points: 0 })
check('no more than ten at once, and a number that is not whole is one', tooMany.body.cents === 40500 && (await call('new', 'pay', 'POST', { product: posted.id, count: 2.5, points: 0 })).body.cents === 4500 && (await call('new', 'pay', 'POST', { product: posted.id, count: -4, points: 0 })).body.cents === 4500, JSON.stringify(tooMany.body))
const oneArt = await call('new', 'pay', 'POST', { product: art.id, count: 3, points: 0 })
check('only a book is sold several at once: three of an art piece is one', oneArt.body.ok ? oneArt.body.cents === 28500 && intents.get(oneArt.body.payment).metadata.count === '1' : oneArt.body.error === 'sold-out', JSON.stringify(oneArt.body))
const underpaid = await call('new', 'pay', 'POST', { product: posted.id, count: 3, points: 0 })
Object.assign(intents.get(underpaid.body.payment), { status: 'succeeded', amount_received: 4500 })
const looked = await call('new', 'order', 'POST', { payment: underpaid.body.payment })
check('a payment that is not the lot\'s price is kept for Shrug to look at, with how many were asked for', looked.body.ok && looked.body.order.status === 'Needs review' && looked.body.order.option === 'Quantity: 3', JSON.stringify(looked.body))

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

// ---- Signing in: an email first, then a text or the inbox
const si_before = { mail: mail.length, texts: texts.length, members: tables[T.members].length }
const kitStart = await call('kit', 'start', 'POST', { email: 'kit@elsewhere.test' })
check('an address nobody has is asked for a phone number, and nothing is sent', kitStart.body.step === 'phone' && mail.length === si_before.mail && texts.length === si_before.texts)
check('a number that is not one is refused', (await call('kit', 'text', 'POST', { email: 'kit@elsewhere.test', phone: '12345' })).body.error === 'phone' && (await call('kit', 'text', 'POST', { email: 'kit@elsewhere.test', phone: '+1 415 000 0000' })).body.error === 'phone')
const kitText = await call('kit', 'text', 'POST', { email: 'kit@elsewhere.test', phone: '(415) 555-0102' })
check('a number typed as it is spoken is texted as it is dialed', kitText.body.ok && kitText.body.phone === '+14155550102' && texts.at(-1).to === '+14155550102')
check('a wrong code is wrong, and makes no account', (await call('kit', 'verify', 'POST', { email: 'kit@elsewhere.test', phone: '(415) 555-0102', code: '000000' })).body.error === 'wrong' && tables[T.members].length === si_before.members)
const kitIn = await call('kit', 'verify', 'POST', { email: 'kit@elsewhere.test', phone: '(415) 555-0102', code: textIn('+14155550102') })
const kitRow = rowFor('kit@elsewhere.test')
check('the right one makes their account, with the number on it', kitIn.body.status === 'member' && kitIn.body.member.tier === 'standard' && kitIn.body.member.points === 200 && kitRow?.fields[M.phone] === '+14155550102' && kitIn.body.via === 'text' && kitIn.body.existing === false, JSON.stringify(kitIn.body))
check('it lacks a name of its own, and not a number', kitIn.body.needs.profile === true && kitIn.body.needs.phone === false)
check('a number cannot be typed onto an account that exists', (await call('x', 'text', 'POST', { email: 'kit@elsewhere.test', phone: '+14155550177' })).body.error === 'start')
await call('kit2', 'start', 'POST', { email: 'kit+two@elsewhere.test' })
await call('kit2', 'text', 'POST', { email: 'kit+two@elsewhere.test', phone: '+14155550102' })
const kitTwo = await call('kit2', 'verify', 'POST', { email: 'kit+two@elsewhere.test', phone: '+14155550102', code: textIn('+14155550102') })
check('a number belongs to one account: another address with the same number is signed in to it, and given nothing', kitTwo.body.existing === true && kitTwo.body.member.email === 'kit@elsewhere.test' && kitTwo.body.member.points === 200 && tables[T.members].length === si_before.members + 1 && !rowFor('kit+two@elsewhere.test'), JSON.stringify(kitTwo.body))

// Someone on the list: their inbox once, then a number
const zoe = rec(T.members, { [M.name]: 'Zoe Example', [M.email]: 'zoe@example.test', [M.role]: ['LP'], [M.funds]: ['Shrug 2'], [M.points]: 500 })
const zoeStart = await call('zoe', 'start', 'POST', { email: 'zoe@example.test' })
check('someone on the list confirms their inbox first', zoeStart.body.step === 'inbox' && mail.at(-1).to[0] === 'zoe@example.test')
const zoeIn = await call('zoe', 'verify', 'POST', { email: 'zoe@example.test', code: codeIn('zoe@example.test') })
check('which is noted on their row, and they are in', zoeIn.body.status === 'member' && zoeIn.body.via === 'inbox' && !!zoe.fields[M.confirmed] && zoeIn.body.needs.phone === true, JSON.stringify(zoeIn.body))
const zoeText = await call('zoe', 'phone', 'POST', { phone: '+14155550103' })
check('then they add a number, which is texted', zoeText.body.ok && texts.at(-1).to === '+14155550103' && !zoe.fields[M.phone])
check('and is theirs once they give its six digits', (await call('zoe', 'phone', 'POST', { phone: '+14155550103', code: '000000' })).body.error === 'wrong' && (await call('zoe', 'phone', 'POST', { phone: '+14155550103', code: textIn('+14155550103') })).body.needs?.phone === false && zoe.fields[M.phone] === '+14155550103')
await call('zoe', 'signout', 'POST', {})
const zoeAgain = await call('zoe', 'start', 'POST', { email: 'zoe@example.test' })
check('from then on they are texted, and told only where the number ends', zoeAgain.body.step === 'text' && zoeAgain.body.to === '03' && !JSON.stringify(zoeAgain.body).includes('4155550103'), JSON.stringify(zoeAgain.body))
check('and the text signs them in', (await call('zoe', 'verify', 'POST', { email: 'zoe@example.test', code: textIn('+14155550103') })).body.via === 'text')
check('signed in by a text, the number cannot be moved: the email is proved first', (await call('zoe', 'phone', 'POST', { phone: '+14155550104' })).body.error === 'confirm')
await call('zoe', 'signout', 'POST', {})
const si_lost = await call('zoe', 'start', 'POST', { email: 'zoe@example.test', by: 'inbox' })
const zoeBack = await call('zoe', 'verify', 'POST', { email: 'zoe@example.test', by: 'inbox', code: codeIn('zoe@example.test') })
check('someone whose number is si_lost gets in by their inbox, and may then change it', si_lost.body.step === 'inbox' && zoeBack.body.via === 'inbox' && (await call('zoe', 'phone', 'POST', { phone: '+14155550104' })).body.ok && (await call('zoe', 'phone', 'POST', { phone: '+14155550104', code: textIn('+14155550104') })).body.ok && zoe.fields[M.phone] === '+14155550104')
check('but not to a number that is somebody else\'s', (await call('zoe', 'phone', 'POST', { phone: '+14155550102' })).body.ok && (await call('zoe', 'phone', 'POST', { phone: '+14155550102', code: textIn('+14155550102') })).body.error === 'taken' && zoe.fields[M.phone] === '+14155550104')

// A number that was on a row si_before Shrug listed it counts for nothing until its email is confirmed
rec(T.members, { [M.email]: 'ivy@example.test', [M.role]: ['LP'], [M.funds]: ['Shrug 1'], [M.phone]: '+14155550199', [M.points]: 100 })
const ivyStart = await call('thief', 'start', 'POST', { email: 'ivy@example.test' })
check('a number put on a row si_before Shrug listed it lets nobody in: the inbox is asked, and nothing is texted', ivyStart.body.step === 'inbox' && !texts.some((t) => t.to === '+14155550199'))
await call('thief', 'text', 'POST', { email: 'new@thief.test', phone: '+14155550199' })
const theft = await call('thief', 'verify', 'POST', { email: 'new@thief.test', phone: '+14155550199', code: textIn('+14155550199') })
check('nor does proving that number under another address', theft.body.error === 'taken' && (await call('thief', 'me', 'GET')).body.status === 'anon', JSON.stringify(theft.body))
await call('thief', 'text', 'POST', { email: 'other@thief.test', phone: '+14155550199' })
check('nor giving its texted code against the listed address', 'error' in (await call('thief', 'verify', 'POST', { email: 'ivy@example.test', code: textIn('+14155550199') })).body && (await call('thief', 'me', 'GET')).body.status === 'anon')

// Out of guesses
rec(T.members, { [M.name]: 'Ned Example', [M.email]: 'ned@example.test', [M.role]: ['Investor'] })
await call('ned', 'start', 'POST', { email: 'ned@example.test' })
let si_guess
for (let i = 0; i < 5; i++) si_guess = await call('ned', 'verify', 'POST', { email: 'ned@example.test', code: codeIn('ned@example.test') === '999999' ? '999998' : '999999' })
check('five wrong guesses and an emailed code is done, and says for how long', si_guess.body.error === 'locked' && si_guess.body.retryIn > 0 && si_guess.body.retryIn <= 600, JSON.stringify(si_guess.body))
const nedKept = tables[T.signIns].find((r) => r.fields[F.signIn.email] === 'ned@example.test')
nedKept.fields[F.signIn.state] = JSON.stringify({ ...JSON.parse(nedKept.fields[F.signIn.state]), sent: Date.now() - 60_000 })
const nedAgain = await call('ned', 'start', 'POST', { email: 'ned@example.test' })
check('and no new one is sent until the old one would have run out', nedAgain.body.error === 'wait' && nedAgain.body.retryIn > 500, JSON.stringify(nedAgain.body))
await call('pat', 'text', 'POST', { email: 'pat@elsewhere.test', phone: '+14155550105' })
let patGuess
for (let i = 0; i < 6; i++) patGuess = await call('pat', 'verify', 'POST', { email: 'pat@elsewhere.test', phone: '+14155550105', code: '000000' })
check('a texted code has five guesses too', patGuess.body.error === 'locked' && patGuess.body.retryIn === 600 && !rowFor('pat@elsewhere.test'), JSON.stringify(patGuess.body))

// A name and a picture of their own
const si_named = await call('kit', 'profile', 'POST', { name: '  Kit   Example ', face: 'face-3' })
check('a display name and one of Shrug\'s faces', si_named.body.ok && si_named.body.member.name === 'Kit Example' && si_named.body.member.first === 'Kit' && si_named.body.member.picture?.face === 'face-3' && si_named.body.needs.profile === false && kitRow.fields[M.displayName] === 'Kit Example', JSON.stringify(si_named.body))
const pictured = await call('kit', 'profile', 'POST', { photo: `data:image/jpeg;base64,${Buffer.from('a photo').toString('base64')}` })
check('a photo of their own takes the face\'s place, and the name stays', pictured.body.member.picture?.url === 'https://files.example.test/photo.jpg' && kitRow.fields[M.picture].length === 1 && pictured.body.member.name === 'Kit Example', JSON.stringify(pictured.body))
check('nothing that is not a name or a picture is kept', (await call('kit', 'profile', 'POST', { name: '   ' })).body.error === 'name' && (await call('kit', 'profile', 'POST', { face: '../etc' })).body.error === 'picture' && (await call('kit', 'profile', 'POST', { photo: 'data:text/html;base64,PGI+' })).body.error === 'picture' && (await call('kit', 'profile', 'POST', {})).body.error === 'nothing' && (await call('nobody', 'profile', 'POST', { name: 'X' })).body.error === 'anon')
await call('zoe', 'profile', 'POST', { name: 'Zed' })
check('the name they chose is the one the store shows, and Shrug\'s name for them is kept', (await call('zoe', 'store', 'GET')).body.member.name === 'Zed' && zoe.fields[M.name] === 'Zoe Example')

// A personal link, as an update email carries
const linkFor = (email, until = Date.now() + 864e5, secret = 'a-test-secret') => { const payload = Buffer.from(JSON.stringify({ email, until })).toString('base64url'); return `?t=${payload}.${createHmac('sha256', secret).update(`link:${payload}`).digest('base64url')}` }
const una = rec(T.members, { [M.name]: 'Una Example', [M.email]: 'una@example.test', [M.role]: ['LP'], [M.funds]: ['Shrug 4'] })
check('a link nobody at Shrug made, or one that has run out, opens nothing', !(await call('forged', 'link', 'GET', null, linkFor('una@example.test', undefined, 'another-secret'))).headers.get('set-cookie') && !(await call('late', 'link', 'GET', null, linkFor('una@example.test', Date.now() - 1000))).headers.get('set-cookie') && !una.fields[M.confirmed])
const si_opened = await call('una', 'link', 'GET', null, linkFor('una@example.test'))
const unaMe = (await call('una', 'me', 'GET')).body
check('a personal link signs its LP in, with their email confirmed, and takes them to the desk', si_opened.status === 302 && si_opened.headers.get('location') === '/?login=1' && !!una.fields[M.confirmed] && unaMe.via === 'link' && unaMe.member.email === 'una@example.test' && unaMe.needs.phone === true, JSON.stringify(unaMe))
check('they add their number with no code to their inbox', (await call('una', 'phone', 'POST', { phone: '+14155550106' })).body.ok && (await call('una', 'phone', 'POST', { phone: '+14155550106', code: textIn('+14155550106') })).body.ok && una.fields[M.phone] === '+14155550106' && !mail.some((m) => m.to[0] === 'una@example.test'))
check('and the link is spent once the account has a number', !(await call('una2', 'link', 'GET', null, linkFor('una@example.test'))).headers.get('set-cookie') && (await call('una2', 'me', 'GET')).body.status === 'anon')

// ---- A visitor buys: the payment makes their account
/** Stripe's own word that a payment arrived, as its webhook brings it. */
const settledBy = (payment) => {
  const said = JSON.stringify({ type: 'payment_intent.succeeded', data: { object: { id: payment } } })
  const when = Math.floor(Date.now() / 1000)
  return api.stripe.POST(new Request('https://store.test/api/stripe', { method: 'POST', headers: { 'stripe-signature': `t=${when},v1=${createHmac('sha256', 'whsec_test').update(`${when}.${said}`).digest('hex')}` }, body: said }))
}
const home2 = 'Vera Example\n9 Example Road\nPortland, OR 97201'
check('a visitor says where the receipt goes, and where a posted thing is sent', (await call('vera', 'pay', 'POST', { product: book.id })).body.error === 'email' && (await call('vera', 'pay', 'POST', { product: book.id, email: 'vera@example.test' })).body.error === 'address')
check('only what is for everyone and is bought with money: not a request, not what they are not shown', (await call('vera', 'pay', 'POST', { product: red.id, email: 'vera@example.test' })).body.error === 'anon' && (await call('vera', 'pay', 'POST', { product: update4.id, email: 'vera@example.test' })).status === 404)
const veraPay = await call('vera', 'pay', 'POST', { product: book.id, email: 'Vera@Example.test', shipTo: home2 })
const veraIntent = intents.get(veraPay.body.payment)
check('a visitor pays the price as it stands, with no points', veraPay.body.ok && veraPay.body.cents === 4000 && veraIntent.metadata.visitor === '1' && veraIntent.metadata.email === 'vera@example.test' && veraIntent.metadata.points === '0' && veraIntent.metadata.shipTo === home2, JSON.stringify(veraPay.body))
check('it is nothing until the money has arrived', (await call('vera', 'order', 'POST', { payment: veraPay.body.payment })).body.error === 'unpaid' && !rowFor('vera@example.test'))
Object.assign(veraIntent, { status: 'succeeded', amount_received: 4000 })
check('and is nobody else\'s to make into an order: only the browser that began it is answered', (await call('nobody', 'order', 'POST', { payment: veraPay.body.payment })).status === 401 && !rowFor('vera@example.test'))
const veraOrder = await call('vera', 'order', 'POST', { payment: veraPay.body.payment })
const vera = rowFor('vera@example.test')
check('the payment makes their account: a standard one, with their address on file, and the order is its', veraOrder.body.ok && veraOrder.body.account === 'new' && veraOrder.body.order.status === 'Paid' && !!vera && vera.fields[M.tier] === 'Standard' && vera.fields[M.points] === 200 && vera.fields[M.shipTo] === home2 && !vera.fields[M.phone] && tables[T.orders].at(-1).fields[F.order.member][0] === vera.id && tables[T.orders].at(-1).fields[F.order.shipTo] === home2, JSON.stringify(veraOrder.body))
const veraMe = (await call('vera', 'me', 'GET')).body
check('the account is under the name they paid with (the one the parcel is addressed to, where they gave no other), which is the name on their card', vera.fields[M.displayName] === 'Vera Example' && veraMe.member?.name === 'Vera Example', JSON.stringify(veraMe.member))
check('they are signed in to it, and it lacks a number', veraMe.status === 'member' && veraMe.via === 'pay' && veraMe.needs.phone === true && (await call('vera', 'store', 'GET')).body.orders.length === 1, JSON.stringify(veraMe))
check('which they add there and then, with no code to their inbox', (await call('vera', 'phone', 'POST', { phone: '+14155550107' })).body.ok && (await call('vera', 'phone', 'POST', { phone: '+14155550107', code: textIn('+14155550107') })).body.ok && vera.fields[M.phone] === '+14155550107' && !mail.some((m) => m.to[0] === 'vera@example.test'))
check('asked twice, the payment is still one order and one account', (await call('vera', 'order', 'POST', { payment: veraPay.body.payment })).body.order?.reference === veraOrder.body.order.reference && tables[T.members].filter((r) => r.fields[M.email] === 'vera@example.test').length === 1)
// Paying with an address that has an account already: the order is that account's, and nobody is let in
const adaShip = founder.fields[M.shipTo]
const adaOrders = tables[T.orders].filter((r) => r.fields[F.order.member]?.[0] === founder.id).length
const asAda = await call('stranger', 'pay', 'POST', { product: book.id, email: 'ada@example.test', shipTo: 'A Stranger\n1 Other Street\nElsewhere, NY 10001' })
Object.assign(intents.get(asAda.body.payment), { status: 'succeeded', amount_received: 4000 })
const asAdaOrder = await call('stranger', 'order', 'POST', { payment: asAda.body.payment })
check('paying with an address that has an account puts the order on that account, and lets nobody in', asAdaOrder.body.ok && asAdaOrder.body.account === 'theirs' && (await call('stranger', 'me', 'GET')).body.status === 'anon' && tables[T.orders].filter((r) => r.fields[F.order.member]?.[0] === founder.id).length === adaOrders + 1)
check('it goes where the payer said, and the address on file is not theirs to change', tables[T.orders].at(-1).fields[F.order.shipTo].includes('1 Other Street') && founder.fields[M.shipTo] === adaShip)
// Stripe's own word arriving first: the account is made then, and the browser that paid is still signed in to it
const walPay = await call('wal', 'pay', 'POST', { product: art.id, email: 'wal@example.test', wallet: true })
Object.assign(intents.get(walPay.body.payment), { status: 'succeeded', amount_received: 28500, shipping: { name: 'Wal Example', address: { line1: '3 Example Quay', city: 'Seattle', state: 'WA', postal_code: '98101', country: 'US' } } })
await settledBy(walPay.body.payment)
const wal = rowFor('wal@example.test')
const walOrder = await call('wal', 'order', 'POST', { payment: walPay.body.payment })
check('paid by Apple Pay, no address is typed: the one the payment gives is used and kept', walPay.body.ok && !!wal && wal.fields[M.shipTo].includes('3 Example Quay'))
check('where Stripe\'s word came first, the account was made then, and the browser that paid is still signed in to it', walOrder.body.ok && walOrder.body.account === 'new' && (await call('wal', 'me', 'GET')).body.via === 'pay' && tables[T.members].filter((r) => r.fields[M.email] === 'wal@example.test').length === 1 && tables[T.orders].filter((r) => r.fields[F.order.payment] === walPay.body.payment).length === 1)
// An account made by a payment and left without a number is opened only by its inbox, and by no second payment
const again2 = await call('wal2', 'pay', 'POST', { product: book.id, email: 'wal@example.test', shipTo: home2 })
Object.assign(intents.get(again2.body.payment), { status: 'succeeded', amount_received: 4000 })
check('a second payment with that address, from anywhere, lets nobody in to it', (await call('wal2', 'order', 'POST', { payment: again2.body.payment })).body.account === 'theirs' && (await call('wal2', 'me', 'GET')).body.status === 'anon')
check('and its way in, with no number, is its inbox', (await call('wal3', 'start', 'POST', { email: 'wal@example.test' })).body.step === 'inbox')

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
