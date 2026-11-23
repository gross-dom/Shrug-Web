import { all, F, files, list, num, str, T, type Row } from './airtable.js'
import { canSee, type Kind, type Member, type Order, type OrderStatus, type Product, type Status } from '../../shared/rules.js'

// The store's shelves and a member's orders, read from Airtable and put into the shapes the rules work with.

const KINDS: Kind[] = ['Book', 'Chair', 'Art', 'Document', 'Other']

/** A row of Products as a product, or null for one that is hidden or has no name. */
export function productOf(row: Row): Product | null {
  const f = row.fields
  const status = str(f[F.product.status])
  const name = str(f[F.product.name]).trim()
  if (!name || (status !== 'Available' && status !== 'Pre-order' && status !== 'On request')) return null
  const kind = str(f[F.product.kind]) as Kind
  const picture = files(f[F.product.picture])[0]
  return {
    id: row.id,
    name,
    kind: KINDS.includes(kind) ? kind : 'Other',
    status: status as Status,
    visibleTo: list(f[F.product.visibleTo]),
    points: num(f[F.product.points]),
    price: num(f[F.product.price]),
    postage: num(f[F.product.postage]),
    description: str(f[F.product.description]).trim(),
    // Airtable's links to a picture last a couple of hours, which is longer than a page is looked at
    picture: picture ? (picture.thumbnails?.large?.url ?? picture.url ?? null) : null,
    hasFile: files(f[F.product.file]).length > 0,
    options: str(f[F.product.options])
      .split(',')
      .map((option) => option.trim())
      .filter(Boolean),
    editionOf: num(f[F.product.editionOf]),
    left: num(f[F.product.left]),
    limited: f[F.product.limited] === true,
    needsAddress: f[F.product.needsAddress] === true,
    place: num(f[F.product.place]) ?? 9999,
  }
}

/** Everything a member is shown, in its order. What they may not see is never sent to them at all. */
export async function shelvesFor(member: Member): Promise<{ products: Product[]; rows: Row[] }> {
  const rows = await all(T.products)
  const products = rows
    .map(productOf)
    .filter((product): product is Product => !!product && canSee(member, product))
    .sort((a, b) => a.place - b.place || a.name.localeCompare(b.name))
  return { products, rows }
}

export function orderOf(row: Row, names: Map<string, string>): Order {
  const f = row.fields
  const productId = list(f[F.order.product])[0] ?? ''
  return {
    id: row.id,
    reference: str(f[F.order.reference]),
    status: (str(f[F.order.status]) || 'Points') as OrderStatus,
    productId,
    productName: names.get(productId) ?? '',
    option: str(f[F.order.option]),
    number: str(f[F.order.number]),
    points: num(f[F.order.points]) ?? 0,
    paid: num(f[F.order.paid]) ?? 0,
    placed: str(f[F.order.placed]),
  }
}

/** A member's orders, newest first, and every row of Orders (to look a payment up in). */
export async function ordersFor(memberId: string, productRows: Row[]): Promise<{ orders: Order[]; rows: Row[] }> {
  const rows = await all(T.orders)
  const names = new Map(productRows.map((row) => [row.id, str(row.fields[F.product.name])]))
  const orders = rows
    .filter((row) => list(row.fields[F.order.member]).includes(memberId))
    .map((row) => orderOf(row, names))
    .sort((a, b) => b.placed.localeCompare(a.placed))
  return { orders, rows }
}
