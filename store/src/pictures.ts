import type { Product } from '../shared/rules'

// A product's photographs. The ones Shrug has supplied are kept with the pages (store/public/pictures), each
// whole and at two sizes, and are found by the product's name, so that they are the same in the demo and in
// the real store. A product with none here shows what its row in Airtable has (Products → Picture), and one
// with nothing there shows a drawing of the sort of thing it is.

export interface Shot {
  /** The photograph, whole, for a product's own screen. */
  full: string
  /** The same, small: the display, the foot, a thumbnail. */
  small: string
  /** Where its subject is, for a tile that shows only part of it (the display crops to 4:5). */
  at?: string
}

const BASE = import.meta.env.BASE_URL
const set = (slug: string, count: number, at: Record<number, string> = {}): Shot[] =>
  Array.from({ length: count }, (_, n) => ({ full: `${BASE}pictures/${slug}-${n + 1}.webp`, small: `${BASE}pictures/${slug}-${n + 1}-s.webp`, at: at[n + 1] }))

/** By name, in small letters. The chair goes by its old names too, until its rows in Airtable are renamed. */
const KEPT: Record<string, Shot[]> = {
  chromatic: set('chromatic', 3),
  'workspace, matte black': set('workspace-matte-black', 3),
  'workspace chair': set('workspace-matte-black', 3),
  'workspace, ferrari red': set('workspace-ferrari-red', 3),
  'workspace chair, ferrari red': set('workspace-ferrari-red', 3),
  'art on acrylic': set('art-on-acrylic', 4),
  // The cover's lettering is at its right-hand edge
  'ws catalog': set('ws-catalog', 4, { 1: '88% 50%' }),
  'shrug 2027': set('shrug-2027', 2),
}

/** Every photograph of a product, the first first; empty where it has none. */
export function shotsOf(product: Pick<Product, 'name' | 'picture' | 'pictures'>): Shot[] {
  const kept = KEPT[product.name.trim().toLowerCase()]
  if (kept) return kept
  const all = product.pictures?.length ? product.pictures : product.picture ? [product.picture] : []
  return all.map((full, n) => ({ full, small: n === 0 && product.picture ? product.picture : full }))
}
