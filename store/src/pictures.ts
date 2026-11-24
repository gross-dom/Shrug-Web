import type { Product } from '../shared/rules'

// A product's photographs. The ones Shrug has supplied are kept with the pages (store/public/pictures), each
// whole, and are found by the product's name, so that they are the same in the demo and in the real store.
// Each is kept at three sizes: small (760 on its long side: a thumbnail, and a phone's tile), the one a
// product's screen shows (1,800), and, where the original had the pixels for it, a large one (2,400) for big
// and dense screens. The browser is told how wide each file is and how large it will be drawn, and fetches
// the smallest that is sharp there: nothing is shown softer than the screen can show it, and no phone is
// sent a desktop's file. A product with none here shows what its row in Airtable has (Products → Picture),
// and one with nothing there shows a drawing of the sort of thing it is.

export interface Shot {
  /** The photograph, whole, for a product's own screen. */
  full: string
  /** The same, small: the foot, a thumbnail. */
  small: string
  /** Every size there is, as the browser is told of them ("…-s.webp 570w, ….webp 1350w, …-l.webp 1800w"); none for a picture from Airtable. */
  set?: string
  /** How wide it is for its height: 0.75 is upright, 1.5 is wide. Unknown for a picture from Airtable. */
  aspect?: number
  /** Where its subject is, for a tile that shows only part of it (the display crops to 4:5). */
  at?: string
}

const BASE = import.meta.env.BASE_URL

/** Each photograph kept here, in the order it is shown: how wide its small file is, how wide and tall the
 * one a product's screen shows, and how wide its large one, if it has one. (Written by the script that
 * makes the files: the widths are the files' own.) */
const SIZES: Record<string, number[][]> = {
  'chromatic': [[705, 1670, 1800, 2227], [760, 1800, 1200, 2400], [760, 1800, 1174, 2400]],
  'workspace-matte-black': [[570, 1350, 1800, 1800], [570, 1350, 1800, 1800], [507, 1200, 1800, 1600]],
  'workspace-ferrari-red': [[507, 1200, 1800, 1601], [507, 1200, 1800, 1601], [681, 1613, 1800, 2116]],
  'art-on-acrylic': [[608, 1440, 1800, 1920], [760, 1800, 1012, 2400], [760, 1800, 1013, 2400], [760, 1800, 1183, 2400]],
  'ws-catalog': [[760, 1734, 1220], [760, 1800, 1012, 2400], [760, 1800, 1008, 2400], [760, 1800, 1011, 2400]],
  'shrug-2027': [[608, 1122, 1402], [608, 1122, 1402]],
}

const set = (slug: string, at: Record<number, string> = {}): Shot[] =>
  (SIZES[slug] ?? []).map(([small, wide, tall, large], n) => {
    const at1 = `${BASE}pictures/${slug}-${n + 1}`
    return {
      full: `${at1}.webp`,
      small: `${at1}-s.webp`,
      set: [`${at1}-s.webp ${small}w`, `${at1}.webp ${wide}w`, ...(large ? [`${at1}-l.webp ${large}w`] : [])].join(', '),
      aspect: wide! / tall!,
      at: at[n + 1],
    }
  })

/** By name, in small letters. The chair goes by its old names too, in case a row in Airtable still has one. */
const KEPT: Record<string, Shot[]> = {
  chromatic: set('chromatic'),
  'workspace, matte black': set('workspace-matte-black'),
  'workspace chair': set('workspace-matte-black'),
  'workspace, ferrari red': set('workspace-ferrari-red'),
  'workspace chair, ferrari red': set('workspace-ferrari-red'),
  'art on acrylic': set('art-on-acrylic'),
  // The cover's lettering is at its right-hand edge
  'ws catalog': set('ws-catalog', { 1: '88% 50%' }),
  'shrug 2027': set('shrug-2027'),
}

/** Every photograph of a product, the first first; empty where it has none. */
export function shotsOf(product: Pick<Product, 'name' | 'picture' | 'pictures'>): Shot[] {
  const kept = KEPT[product.name.trim().toLowerCase()]
  if (kept) return kept
  const all = product.pictures?.length ? product.pictures : product.picture ? [product.picture] : []
  return all.map((full, n) => ({ full, small: n === 0 && product.picture ? product.picture : full }))
}

/** How wide a photograph is drawn in the display, for the browser to choose a file by. A tile is 4 by 5 and
 * the picture fills it, so one that is wider than the tile is drawn wider than the tile is. */
export function tileSizes(shot: Shot): string | undefined {
  if (!shot.set || !shot.aspect) return undefined
  const over = Math.max(1, shot.aspect / 0.8)
  const vw = (share: number) => `${Math.round(share * over)}vw`
  return `(max-width: 739px) ${vw(50)}, (min-width: 1700px) ${vw(25)}, ${vw(33)}`
}

/** And on a product's own screen, where it is shown whole in a tile that is most of the window. */
export function wholeSizes(shot: Shot): string | undefined {
  if (!shot.set || !shot.aspect) return undefined
  const a = shot.aspect.toFixed(3)
  return `(max-width: 739px) min(calc(100vw - 40px), calc(46vh * ${a})), min(58vw, calc((100vh - 200px) * ${a}))`
}
