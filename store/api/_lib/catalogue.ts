import { all, F, files, list, num, str, T, type Row } from './airtable.js'
import { mayHave, updateOf, VISITOR, type Kind, type Member, type Order, type OrderStatus, type Product, type Status, type Update } from '../../shared/rules.js'

// The store's shelves and a member's orders, read from Airtable and put into the shapes the rules work with.

const KINDS: Kind[] = ['Book', 'Chair', 'Art', 'Document', 'Other']

/** A row of Products as a product, or null for one that is hidden or has no name. */
export function productOf(row: Row): Product | null {
  const f = row.fields
  const status = str(f[F.product.status])
  const name = str(f[F.product.name]).trim()
  if (!name || (status !== 'Available' && status !== 'Pre-order' && status !== 'On request')) return null
  const kind = str(f[F.product.kind]) as Kind
  // Airtable's links to a picture last a couple of hours, which is longer than a page is looked at
  const pictured = files(f[F.product.picture])
  return {
    id: row.id,
    name,
    kind: KINDS.includes(kind) ? kind : 'Other',
    status: status as Status,
    visibleTo: list(f[F.product.visibleTo]),
    points: num(f[F.product.points]),
    floor: num(f[F.product.floor]),
    postage: num(f[F.product.postage]),
    description: str(f[F.product.description]).trim(),
    // The first, small, is what the display and the foot show; a product's own screen has every one, whole
    picture: pictured[0] ? (pictured[0].thumbnails?.large?.url ?? pictured[0].url ?? null) : null,
    pictures: pictured.map((picture) => picture.url ?? '').filter(Boolean),
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
    listed: f[F.product.listed] === true,
    group: str(f[F.product.group]),
  }
}

/** Everything a member is shown, in its order. What they may not see is never sent to them at all. */
export async function shelvesFor(member: Member): Promise<{ products: Product[]; rows: Row[] }> {
  const rows = await all(T.products)
  const products = rows
    .map(productOf)
    .filter((product): product is Product => !!product && mayHave(member, product))
    .sort((a, b) => a.place - b.place || a.name.localeCompare(b.name))
  return { products, rows }
}

/** What a visitor is shown: everything in the store that is for Everyone, in its order, and no document. */
export async function shelvesForAVisitor(): Promise<Product[]> {
  const rows = await all(T.products)
  return rows
    .map(productOf)
    .filter((product): product is Product => !!product && product.kind !== 'Document' && mayHave(VISITOR, product))
    .sort((a, b) => a.place - b.place || a.name.localeCompare(b.name))
}

/** The updates a member is shown: every document that is theirs, or listed to everyone, in its order. */
export function updatesFor(member: Member, rows: Row[], orders: Order[]): Update[] {
  return rows
    .map(productOf)
    .filter((product): product is Product => !!product)
    .sort((a, b) => a.place - b.place || a.name.localeCompare(b.name))
    .map((product) => updateOf(member, product, orders))
    .filter((update): update is Update => !!update)
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
