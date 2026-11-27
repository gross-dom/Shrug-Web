import { add, all, F, files, T, type Row } from './_lib/airtable.js'
import { ordersFor, productOf, shelvesFor } from './_lib/catalogue.js'
import { json } from './_lib/http.js'
import { memberAsking, trouble } from './_lib/who.js'
import { forAnyone, free, has } from '../shared/rules.js'

// A document, handed to a member who has it (or who may see it, where it costs nothing), or to anyone at all
// where it is for anyone (Products → Visible to: Public). With ?view=1 it is sent to be read in the page;
// without, to be saved. A member's reading is written to Opens, saying who and when. The file is kept in
// Airtable (Products → File) and is fetched from there each time: it has no address of its own that could be
// passed on to anyone else.
export async function GET(request: Request) {
  try {
    const asked = new URL(request.url).searchParams
    const id = asked.get('product') ?? ''
    const view = asked.get('view') === '1'
    const who = await memberAsking(request)
    // Nobody signed in: only what is for anyone, and nothing is asked of them for it
    if ('refuse' in who) {
      const row = (await all(T.products)).find((r) => r.id === id)
      const product = row ? productOf(row) : null
      if (!row || !product || product.kind !== 'Document' || !forAnyone(product)) return who.refuse
      return handed(row, product.name, view)
    }
    const { products, rows } = await shelvesFor(who.member)
    const product = products.find((p) => p.id === id)
    const row = rows.find((r) => r.id === id)
    if (!product || !row || product.kind !== 'Document') return json({ error: 'hidden' }, { status: 404 })
    // One that costs nothing, or is for anyone, is theirs for the seeing; anything else has to have been got first
    if (!forAnyone(product) && !free(product) && !has((await ordersFor(who.member.id, rows)).orders, product)) return json({ error: 'not-yours' }, { status: 403 })
    // Noted, but never in the way: a document is handed over whether or not the note could be written
    await add(T.opens, { [F.open.what]: `${product.name} · ${who.email}`, [F.open.member]: [who.row.id], [F.open.product]: [row.id], [F.open.how]: view ? 'Opened' : 'Downloaded', [F.open.when]: new Date().toISOString() }).catch(() => {})
    return handed(row, product.name, view)
  } catch (error) {
    return trouble('file', error)
  }
}

/** The file itself, from where it is kept. */
async function handed(row: Row, called: string, view: boolean): Promise<Response> {
  const file = files(row.fields[F.product.file])[0]
  if (!file?.url) return json({ error: 'no-file' }, { status: 404 })
  const got = await fetch(file.url)
  if (!got.ok || !got.body) return json({ error: 'no-file' }, { status: 502 })
  const name = (file.filename || `${called}.pdf`).replace(/[^\w .()-]+/g, '_')
  return new Response(got.body, { headers: { 'Content-Type': file.type || 'application/pdf', 'Content-Disposition': `${view ? 'inline' : 'attachment'}; filename="${name}"`, 'Cache-Control': 'private, no-store' } })
}
