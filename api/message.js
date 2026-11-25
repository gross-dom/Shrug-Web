// Shrug's inbox: where a message written to Shrug on this site goes (Messages' conversation with Shrug, and
// Mail's New Message). It takes the form the page posts (src/phone/apps/outbox.ts: the words as `text`, a
// subject, what the subject's form asked for, and any files) and sends it on as an email, through Resend,
// with the writer's own address as the one to reply to.
//
// It is closed until it is given what it needs, in the project's environment on Vercel:
//   RESEND_API_KEY   a sending key for Resend
//   MESSAGE_FROM     who the email is from: an address on a domain Resend has verified,
//                    e.g. "Shrug.VIP <messages@shrug.vc>"
//   MESSAGE_TO       where it goes (hello@shrug.vc if this is not set)
// and the site is told to use it by building with VITE_INBOX=/api/message (src/data/site.ts). Closed, it
// answers 503 and sends nothing; the page then says a message was not delivered, as it always has.
//
// It answers only the site's own pages, takes at most 4 MB of files (a function's body may be no larger),
// and never repeats back what it was sent.

const MOST = 4 * 1024 * 1024
const FIELDS = ['via', 'name', 'role', 'email', 'from', 'meet', 'publish', 'about']

const answer = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
const said = (value) => (typeof value === 'string' ? value.trim() : '')
const oneLine = (text, most) => text.replace(/[\r\n]+/g, ' ').slice(0, most)

export async function POST(request) {
  const key = process.env.RESEND_API_KEY
  const from = process.env.MESSAGE_FROM
  const to = process.env.MESSAGE_TO || 'hello@shrug.vc'
  if (!key || !from) return answer(503, { error: 'closed' })

  // Only this site's own pages post here
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  try {
    if (origin && host && new URL(origin).host !== host) return answer(403, { error: 'origin' })
  } catch {
    return answer(403, { error: 'origin' })
  }

  let form
  try {
    form = await request.formData()
  } catch {
    return answer(400, { error: 'form' })
  }
  const text = said(form.get('text')).slice(0, 8000)
  const files = form.getAll('files').filter((file) => typeof file === 'object' && file !== null && typeof file.arrayBuffer === 'function' && file.size > 0)
  if (!text && !files.length) return answer(400, { error: 'empty' })
  if (files.length > 10 || files.reduce((all, file) => all + file.size, 0) > MOST) return answer(413, { error: 'large' })

  const details = FIELDS.map((name) => [name, oneLine(said(form.get(name)), 300)]).filter(([, value]) => value)
  const about = Object.fromEntries(details)
  const reply = [about.email, about.from].find((address) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address || ''))
  const subject = oneLine(said(form.get('subject')), 160)
  const lines = [text, '', '--', ...details.map(([name, value]) => `${name}: ${value}`), `sent from: ${oneLine(host || 'the site', 120)}`]
  const attachments = []
  for (const file of files) attachments.push({ filename: oneLine(file.name || 'file', 120), content: Buffer.from(await file.arrayBuffer()).toString('base64') })

  let sent
  try {
    sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        ...(reply ? { reply_to: reply } : null),
        subject: `[Shrug.VIP] ${subject || (about.via === 'mail' ? 'New message' : 'A message')}${about.name ? `, from ${about.name}` : ''}`,
        text: lines.join('\n'),
        ...(attachments.length ? { attachments } : null),
      }),
    })
  } catch {
    return answer(502, { error: 'send' })
  }
  return sent.ok ? answer(200, { ok: true }) : answer(502, { error: 'send' })
}

export const GET = () => answer(405, { error: 'method' })
