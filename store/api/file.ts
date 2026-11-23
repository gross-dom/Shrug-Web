import { F, files } from './_lib/airtable.ts'
import { ordersFor, shelvesFor } from './_lib/catalogue.ts'
import { json } from './_lib/http.ts'
import { memberAsking, trouble } from './_lib/who.ts'
import { free, has } from '../shared/rules.ts'

// A document, handed to a member who has it (or who may see it, where it costs nothing). The file is kept in Airtable (Products → File) and is fetched
// from there for them each time: it has no address of its own that could be passed on to anyone else.
export async function GET(request: Request) {
  try {
    const who = await memberAsking(request)
    if ('refuse' in who) return who.refuse
    const id = new URL(request.url).searchParams.get('product') ?? ''
    const { products, rows } = await shelvesFor(who.member)
    const product = products.find((p) => p.id === id)
    const row = rows.find((r) => r.id === id)
    if (!product || !row || product.kind !== 'Document') return json({ error: 'hidden' }, { status: 404 })
    // One that costs nothing is theirs for the seeing; anything else has to have been got first
    if (!free(product) && !has((await ordersFor(who.member.id, rows)).orders, product)) return json({ error: 'not-yours' }, { status: 403 })
    const file = files(row.fields[F.product.file])[0]
    if (!file?.url) return json({ error: 'no-file' }, { status: 404 })
    const got = await fetch(file.url)
    if (!got.ok || !got.body) return json({ error: 'no-file' }, { status: 502 })
    const name = (file.filename || `${product.name}.pdf`).replace(/[^\w .()-]+/g, '_')
    return new Response(got.body, { headers: { 'Content-Type': file.type || 'application/pdf', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return trouble('file', error)
  }
}
