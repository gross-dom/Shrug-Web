// Makes the personal links an update email carries, one for each address:
//   SESSION_SECRET=… node tools/link.mjs https://shrug.vip 30 ada@example.com lee@example.com
// The site's address, how many days the links last, then the addresses. It prints each address and its link,
// tab between, ready to paste into a mail merge. SESSION_SECRET is the server's own (Vercel → Settings →
// Environment Variables): a link is only good on a server that has the secret it was made with.
//
// What a link does is in api/link.ts: it signs its LP in once, to add a phone number, and is spent after.
import { createHmac } from 'node:crypto'

const [site, days, ...emails] = process.argv.slice(2)
const secret = process.env.SESSION_SECRET
if (!secret || !site || !/^https?:\/\//.test(site) || !(Number(days) > 0) || !emails.length) {
  console.error('usage: SESSION_SECRET=… node tools/link.mjs <https://site> <days> <email>…')
  process.exit(1)
}
const until = Date.now() + Number(days) * 864e5
for (const email of emails) {
  const payload = Buffer.from(JSON.stringify({ email: email.trim().toLowerCase(), until })).toString('base64url')
  const mark = createHmac('sha256', secret).update(`link:${payload}`).digest('base64url')
  console.log(`${email}\t${site.replace(/\/+$/, '')}/api/link?t=${payload}.${mark}`)
}
